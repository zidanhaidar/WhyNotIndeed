/*
 * Rush Hour balance check: scripted traffic wardens on every level, on freshly generated cities.
 *   idle      never touches anything (queues and walkers complain, walkers jaywalk)
 *   careless  flips every light on a slow fixed timer (16 s) and never looks at the walkers
 *   planner   gives green to the busier direction (or the one that has waited too long), keeps each green a
 *             few seconds, and gives walkers the green man once a few are waiting or someone has waited a while
 * Rules for an endless game: the planner earns the first star on every level at least half the time, the
 * careless warden does clearly worse, the levels get harder in order, and every shift ends.
 * Run: node dev/balance_rush_hour.js [runs]
 */
const RH = require('../games/rush-hour/engine.js');
const RUNS = Number(process.argv[2]) || 24;
const LIMIT = 40 * 60;

function demand(w, jn, axis) {
  let n = 0, wait = 0;
  w.cars.forEach((c) => {
    const mk = c.marks[c.mark];
    if (!mk || mk.junction !== jn.id || mk.axis !== axis || c.s > mk.sStop + 0.1) return;
    const d = mk.sStop - c.s;
    if (d < 7) { n += c.kind === 'amb' ? 6 : 1; wait = Math.max(wait, c.wait * (c.kind === 'amb' ? 4 : 1)); }
  });
  return { n, wait };
}

function planner(w, careless, st) {
  const m = w.map;
  m.junctions.forEach((jn) => {
    st.held[jn.id] = (st.held[jn.id] || 0) + RH.DT * 3;
    if (jn.phase !== 'green' || jn.next) return;
    if (careless) { if (st.held[jn.id] > 16) { w.switchLight(jn.id); st.held[jn.id] = 0; } return; }
    const other = jn.axis === 'ns' ? 'ew' : 'ns', a = demand(w, jn, jn.axis), b = demand(w, jn, other);
    if ((st.held[jn.id] > 3.5 && b.n > a.n * 1.3 + 0.5) || (st.held[jn.id] > 2.5 && b.wait > 8) || (b.n && !a.n && st.held[jn.id] > 1.5)) { w.switchLight(jn.id); st.held[jn.id] = 0; }
  });
  m.zebras.forEach((z) => {
    const waiting = w.walkers.filter((p) => p.zebra === z.id && p.state === 'wait');
    const crossing = w.walkers.some((p) => p.zebra === z.id && p.state === 'cross');
    const oldest = Math.max(0, ...waiting.map((p) => w.t - p.born));
    if (careless) return; // never looks at the walkers
    if (!z.walk && (waiting.length >= 3 || oldest > 9)) w.toggleWalk(z.id);
    else if (z.walk && z.go && !waiting.length && !crossing) w.toggleWalk(z.id);
  });
}

function play(level, seed, who) {
  const w = new RH.World(level, seed, 1.6), st = { held: {} };
  let i = 0;
  while (!w.over && w.t < LIMIT) {
    if (who !== 'idle' && i % 3 === 0) planner(w, who === 'careless', st);
    w.step(); w.events.length = 0; i++;
  }
  return w;
}

const order = ['pip', 'gridlock', 'monolith', 'edith'];
const res = {};
let problems = 0;
for (const who of ['idle', 'careless', 'planner']) {
  res[who] = {};
  for (const level of order) {
    let sum = 0, star = 0, endless = 0, reasons = {}, time = 0, best = 0;
    for (let r = 0; r < RUNS; r++) {
      const w = play(level, 1000 + r * 7717, who);
      sum += w.trips(); time += w.t; best = Math.max(best, w.trips());
      if (w.trips() >= RH.STARS[0]) star++;
      if (!w.over) endless++;
      const why = w.reason === 'crash' ? 'crash' + (w.crash.jay ? '-jaywalker' : '') : w.reason || 'running';
      reasons[why] = (reasons[why] || 0) + 1;
    }
    res[who][level] = { avg: sum / RUNS, star: star / RUNS };
    console.log(who.padEnd(8), level.padEnd(9), 'trips avg', (sum / RUNS).toFixed(1).padStart(6), 'best', String(best).padStart(4), 'first star', (100 * star / RUNS).toFixed(0).padStart(3) + '%',
      'shift', (time / RUNS / 60).toFixed(1) + ' min', JSON.stringify(reasons));
    if (endless) { console.log('  PROBLEM: ' + endless + ' shifts never ended'); problems++; }
  }
}
order.forEach((lv, i) => {
  if (res.planner[lv].star < 0.5) { console.log('PROBLEM: planner first star on ' + lv + ' only ' + (100 * res.planner[lv].star).toFixed(0) + '%'); problems++; }
  if (res.careless[lv].avg > res.planner[lv].avg * 0.75) { console.log('PROBLEM: careless is too close to the planner on ' + lv); problems++; }
  if (i && res.planner[lv].avg > res.planner[order[i - 1]].avg * 1.05) { console.log('PROBLEM: ' + lv + ' is not harder than ' + order[i - 1]); problems++; }
});
console.log(problems ? problems + ' PROBLEMS' : 'ALL GOOD');
