/*
 * Cleared to Land balance check: scripted controllers on every level, on freshly generated airports.
 *   idle      never touches anything (planes divert, the first one waits at its gate)
 *   careless  clears every holding plane at once and sends departures whenever one is ready
 *   planner   one runway user at a time: lands the plane with the least fuel whose gate is free, slips a
 *             departure in when the next landing is far enough out, goes around if the runway is still busy,
 *             pushes back ready planes, and (Edith) sets the runway light red while the runway is in use
 * Rules for an endless game: the planner earns the first star on every level at least half the time, the
 * careless controller does clearly worse, the levels get harder in order, and every shift ends.
 * Run: node dev/balance_cleared_to_land.js [runs]
 */
const CL = require('../games/cleared-to-land/engine.js');
const RUNS = Number(process.argv[2]) || 24;
const LIMIT = 40 * 60;

function eta(w, p) { return p.path ? (p.path.len - p.s) / Math.max(1, p.v) : Infinity; }

function planner(w, careless) {
  const ps = w.planes, m = w.map;
  const approaching = ps.filter((p) => p.state === 'approach' && p.kind === 'plane');
  const jetApproach = ps.filter((p) => p.state === 'approach' && p.kind === 'jet');
  const rollout = ps.some((p) => p.state === 'rollout' && w.onRunway(p));
  const departing = ps.some((p) => p.state === 'lineup' || (p.state === 'climb' && p.alt < 0.4));
  const busy = rollout || departing || ps.some((p) => w.onRunway(p) && p.state !== 'approach');
  ps.forEach((p) => { if (p.state === 'ready') w.pushBack(p.id); });
  if (careless) {
    ps.forEach((p) => { if (p.state === 'hold') w.clearToLand(p.id); if (p.state === 'holdshort') w.takeOff(p.id); });
    return;
  }
  // go around if the runway is not clear for a plane about to land
  approaching.concat(jetApproach).forEach((p) => {
    if (p.final && eta(w, p) < 3.5 && (busy || ps.some((o) => o !== p && o.state === 'approach' && o.final && eta(w, o) < eta(w, p)))) w.goAround(p.id);
  });
  const nextLand = Math.min(...approaching.concat(jetApproach).map((p) => eta(w, p)), Infinity);
  // a departure fits in before the next landing
  const hs = ps.filter((p) => p.state === 'holdshort').sort((a, b) => b.waitT - a.waitT)[0];
  if (hs && !busy && nextLand > 10) w.takeOff(hs.id);
  // the next landing: one at a time, least fuel first, only if its gate will be free
  // the next landing can be cleared as soon as the runway will be free by the time it arrives
  const rollLeft = Math.max(0, ...ps.filter((p) => p.state === 'rollout' && w.onRunway(p)).map((p) => (p.path.len - p.s) / Math.max(1.5, p.v) - 4));
  // a departure that has waited a while goes before the next landing
  const urgent = hs && hs.waitT > 18;
  // in trail: a second landing may follow the first if it will arrive well after it
  const trailOk = approaching.length === 0 || (approaching.length === 1 && approaching[0].final);
  if (trailOk && !departing && !urgent && !(hs && nextLand > 10 && !busy)) {
    const holding = ps.filter((p) => p.kind === 'plane' && (p.state === 'hold' || p.state === 'inbound'));
    const gateOk = (c) => m.stands.some((s) => s.color === c && (s.by < 0 || ['ready', 'push-wait', 'board'].includes((ps.find((q) => q.id === s.by) || {}).state)));
    const cand = holding.filter((p) => gateOk(p.color)).sort((a, b) => a.fuel - b.fuel)[0];
    const myEta = cand ? (Math.hypot(cand.x - m.faf[0], cand.y - m.faf[1]) + CL.FINAL) / CL.AIR.speed : 0;
    const spacing = approaching.length ? myEta > nextLand + 11 : nextLand > 6 && rollLeft < 2.5 + myEta - 6;
    if (cand && spacing) w.clearToLand(cand.id);
  }
  if (w.cfg.jet) {
    const red = busy || approaching.some((p) => p.final) || ps.some((p) => p.state === 'lineup');
    if (w.runwayRed !== red) w.toggleRunway();
  }
}

function play(level, seed, who) {
  const w = new CL.World(level, seed, 1.6);
  let i = 0;
  while (!w.over && w.t < LIMIT) {
    if (who !== 'idle' && i % 3 === 0) planner(w, who === 'careless');
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
      sum += w.delivered; time += w.t; best = Math.max(best, w.delivered);
      if (w.delivered >= CL.STARS[0]) star++;
      if (!w.over) endless++;
      const why = w.reason || 'running';
      reasons[why] = (reasons[why] || 0) + 1;
    }
    res[who][level] = { avg: sum / RUNS, star: star / RUNS };
    console.log(who.padEnd(8), level.padEnd(9), 'passengers avg', (sum / RUNS).toFixed(1).padStart(7), 'best', String(best).padStart(5), 'first star', (100 * star / RUNS).toFixed(0).padStart(3) + '%',
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
