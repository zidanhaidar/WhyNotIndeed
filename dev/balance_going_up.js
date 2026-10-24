/*
 * Going Up balance check. Run from the wni folder: node dev/balance_going_up.js
 * Plays many shifts on every level with scripted operators and prints how many riders each delivers:
 *   idle     never moves the car (the shift must end quickly)
 *   nearest  always goes to the closest call or rider stop
 *   planner  weighs riders getting off, people it can pick up and people about to give up against travel time
 * The game is endless, so the checks are about pace: a good operator earns the first star on every level,
 * Edith included, levels get harder in order, and every shift ends.
 */
'use strict';
const GU = require('../games/going-up/engine.js');
const LEVELS = ['pip', 'gridlock', 'monolith', 'edith'];
const N = Number(process.env.N) || 40;
const LIMIT = 40 * 60; // seconds; a shift still running after this counts as endless
let ok = true;

function calls(b) {
  const out = new Set(b.you.riders.map((p) => p.dest));
  for (let f = 0; f < b.floors; f++) if (b.queues[f].length) out.add(f);
  return [...out];
}

const PLAYERS = {
  idle: () => {},
  nearest: (b) => {
    if (b.you.stops.length || b.you.state === 'doors') return;
    let best = null, bd = Infinity;
    for (const f of calls(b)) { const d = Math.abs(f - b.you.y); if (d < bd) { bd = d; best = f; } }
    if (best != null) b.toggleStop(best);
  },
  planner: (b) => {
    const car = b.you;
    if (car.stops.length || car.state === 'doors') return;
    let best = null, bv = 0;
    for (const f of calls(b)) {
      const eta = Math.abs(f - car.y) / car.speed + 0.4;
      const off = car.riders.filter((p) => p.dest === f).length;
      const room = car.cap - car.riders.length + off;
      const q = b.queues[f];
      const take = Math.min(room, q.length);
      let urgent = 0;
      for (let i = 0; i < take; i++) if (q[i].left < eta + 8) urgent++;
      const v = (off * 1.2 + take + urgent * 3) / (eta + 1.2);
      if (v > bv) { bv = v; best = f; }
    }
    if (best != null) b.toggleStop(best);
  }
};

function shift(lv, seed, player) {
  const b = new GU.Building(lv, seed);
  while (!b.over && b.t < LIMIT) { player(b); b.step(); b.events.length = 0; }
  return { delivered: b.you.delivered, t: b.t, quick: b.quick, rival: b.bot.delivered, stars: b.stars(), endless: !b.over, points: b.points() };
}

const table = {};
for (const lv of LEVELS) {
  table[lv] = {};
  for (const [name, player] of Object.entries(PLAYERS)) {
    const runs = [];
    for (let i = 0; i < (name === 'idle' ? 10 : N); i++) runs.push(shift(lv, 500 + i * 97, player));
    const avg = (k) => runs.reduce((a, r) => a + r[k], 0) / runs.length;
    const star1 = runs.filter((r) => r.stars >= 1).length / runs.length;
    const endless = runs.filter((r) => r.endless).length;
    table[lv][name] = { delivered: avg('delivered'), t: avg('t'), star1, endless };
    console.log(lv.padEnd(9), name.padEnd(8), 'riders', avg('delivered').toFixed(1).padStart(6), '| shift', (avg('t') / 60).toFixed(1).padStart(4) + ' min',
      '| quick', (100 * avg('quick') / Math.max(1, avg('delivered'))).toFixed(0).padStart(3) + '%', '| rival took', avg('rival').toFixed(1).padStart(5),
      '| 1 star', (100 * star1).toFixed(0).padStart(3) + '%', '| stars 2/3', (100 * runs.filter((r) => r.stars >= 2).length / runs.length).toFixed(0) + '/' + (100 * runs.filter((r) => r.stars >= 3).length / runs.length).toFixed(0) + '%',
      '| points', avg('points').toFixed(0), endless ? '| ENDLESS ' + endless : '');
    if (endless) { ok = false; console.log('PROBLEM: some', name, 'shifts on', lv, 'never ended'); }
  }
  if (!(table[lv].idle.t < 0.75 * table[lv].nearest.t)) { ok = false; console.log('PROBLEM: an idle elevator should lose much sooner than a working one on', lv); }
  if (!(table[lv].planner.delivered > table[lv].nearest.delivered)) { ok = false; console.log('PROBLEM: planning should beat nearest-first on', lv); }
  if (!(table[lv].planner.star1 >= 0.5)) { ok = false; console.log('PROBLEM: a good operator should usually earn the first star on', lv); }
}
for (let i = 1; i < LEVELS.length; i++) {
  if (!(table[LEVELS[i]].planner.delivered < table[LEVELS[i - 1]].planner.delivered)) { ok = false; console.log('PROBLEM: levels should get harder in order at', LEVELS[i]); }
}
console.log(ok ? 'ALL GOOD' : 'PROBLEMS FOUND');
