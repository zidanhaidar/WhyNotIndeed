/*
 * Badge Check balance check. Run from the wni folder: node dev/balance_badge_check.js
 * A model of a person at the turnstile: every check takes time (the stamp is quick, scanning the directory is
 * slow) and misses a sneaky forgery now and then. Inspectors only check what fits in their time:
 *   careless  looks at the photo and the date, then decides
 *   thorough  checks in a fixed order (photo, date, stamp, floor, name) while time allows
 *   adaptive  checks first whatever the forger has been using lately
 * The game is endless, so the checks are about pace: the best inspector earns the first star on every level
 * (Edith included) at least half the time, careless checking does clearly worse, levels get harder in order,
 * and every shift ends.
 */
'use strict';
const BC = require('../games/badge-check/engine.js');
const LEVELS = ['pip', 'gridlock', 'monolith', 'edith'];
const N = Number(process.env.N) || 60;
let ok = true;

// seconds per check, and the chance of spotting a forgery of that kind at each sneakiness level
const COST = { photo: 1.2, expiry: 1.0, stamp: 0.8, floor: 2.0, name: 2.4 };
const SPOT = { photo: [0.99, 0.95, 0.9, 0.84], expiry: [0.99, 0.97, 0.93, 0.88], stamp: [0.99, 0.95, 0.88, 0.82], floor: [0.98, 0.95, 0.91, 0.87], name: [0.97, 0.92, 0.86, 0.8] };
const FALSE_ALARM = 0.004; // per check, on a real badge
const READ = 0.6;          // seconds to look up and decide
const COVERS = { ghost: 'name' };

function inspect(sh, order, r) {
  const v = sh.visitor, budget = v.timer * 0.85 - READ, sub = sh.cfg.subtle;
  let used = 0, caught = false, alarm = false;
  for (const k of order) {
    if (used + COST[k] > budget) break;
    used += COST[k];
    const forgedHere = v.forged && (v.forged === k || COVERS[v.forged] === k);
    if (forgedHere && r.next() < SPOT[k][sub]) caught = true;
    if (!v.forged && r.next() < FALSE_ALARM) alarm = true;
  }
  return { letIn: !(caught || alarm), time: used + READ };
}

const INSPECTORS = {
  careless: () => ['photo', 'expiry'],
  thorough: () => ['photo', 'expiry', 'stamp', 'floor', 'name'],
  adaptive: (seen) => {
    const all = ['photo', 'expiry', 'stamp', 'floor', 'name'];
    return all.slice().sort((a, b) => (seen[b] || 0) - (seen[a] || 0) || COST[a] - COST[b]);
  }
};

function play(lv, seed, inspector) {
  const sh = new BC.Shift(lv, seed), r = new BC.Rng(seed * 7 + 3), seen = {};
  while (!sh.over && sh.served < 2000) {
    const v = sh.visitor, order = inspector(seen), call = inspect(sh, order, r);
    // time passes while checking (the timer counts down), then the call
    const ticks = Math.floor(call.time / BC.DT);
    for (let i = 0; i < ticks && sh.visitor === v; i++) sh.step();
    if (sh.visitor !== v || sh.over) continue;
    const kind = v.forged;
    sh.decide(call.letIn);
    // after each call you find out what was going on, and remember which forgeries are about
    if (kind) { const k = COVERS[kind] || kind; seen[k] = (seen[k] || 0) * 0.8 + 1; }
    for (const k of Object.keys(seen)) seen[k] *= 0.97;
    sh.events.length = 0;
  }
  return { correct: sh.correct, served: sh.served, stars: sh.stars(), points: sh.points(), endless: !sh.over };
}

const table = {};
for (const lv of LEVELS) {
  table[lv] = {};
  for (const [name, inspector] of Object.entries(INSPECTORS)) {
    const runs = [];
    for (let i = 0; i < N; i++) runs.push(play(lv, 900 + i * 37, inspector));
    const avg = (k) => runs.reduce((a, x) => a + x[k], 0) / runs.length;
    const share = (s) => runs.filter((x) => x.stars >= s).length / runs.length;
    const endless = runs.filter((x) => x.endless).length;
    table[lv][name] = { correct: avg('correct'), star1: share(1) };
    console.log(lv.padEnd(9), name.padEnd(8), 'correct calls', avg('correct').toFixed(1).padStart(5), 'of', avg('served').toFixed(1).padStart(5),
      '| stars 1/2/3', (100 * share(1)).toFixed(0) + '/' + (100 * share(2)).toFixed(0) + '/' + (100 * share(3)).toFixed(0) + '%', '| points', avg('points').toFixed(0),
      endless ? '| ENDLESS ' + endless : '');
    if (endless) { ok = false; console.log('PROBLEM: some', name, 'shifts on', lv, 'never ended'); }
  }
  const best = Math.max(table[lv].thorough.star1, table[lv].adaptive.star1);
  if (!(best >= 0.5)) { ok = false; console.log('PROBLEM: a careful inspector should usually earn the first star on', lv); }
  if (!(table[lv].careless.correct < 0.8 * Math.max(table[lv].thorough.correct, table[lv].adaptive.correct))) { ok = false; console.log('PROBLEM: careless checking should do clearly worse on', lv); }
}
for (let i = 1; i < LEVELS.length; i++) {
  const best = (lv) => Math.max(table[lv].thorough.correct, table[lv].adaptive.correct);
  if (!(best(LEVELS[i]) < best(LEVELS[i - 1]))) { ok = false; console.log('PROBLEM: levels should get harder in order at', LEVELS[i]); }
}
console.log(ok ? 'ALL GOOD' : 'PROBLEMS FOUND');
