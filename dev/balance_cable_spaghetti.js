/*
 * Cable Spaghetti balance check. Run from the wni folder: node dev/balance_cable_spaghetti.js
 * Plays many desks on every level with scripted players and prints how many devices each plugs in:
 *   messy   lets every cable wander (random detours)
 *   sloppy  plugs into any free socket it can reach, near or far (how a hurried person plays)
 *   greedy  always takes the shortest cable
 *   hugger  runs cables along the desk edge and the other cables, keeping open desk free
 *   planner tries a cable to every free socket (shortest and edge-hugging) and keeps the one that leaves
 *           the most desk still able to reach a socket
 * The game is endless, so the checks are about pace: the best scripted player usually earns the first star on
 * every level, Edith included, sloppy cabling does clearly worse, levels get harder in order, desks almost never
 * end within 8 devices (the IT team's rescues), and every desk fills up eventually.
 */
'use strict';
const CS = require('../games/cable-spaghetti/engine.js');
const LEVELS = ['pip', 'gridlock', 'monolith', 'edith'];
const N = Number(process.env.N) || 40;
const LIMIT = 600;
let ok = true;

function freeAround(d, i) { return d.neighbors(i).filter((n) => d.free(n)).length; }

// Shortest cable from a device to one particular socket (null if there is no way).
function pathTo(d, dev, target, costOf) {
  const prev = new Map([[dev.cell, -1]]), dist = new Map([[dev.cell, 0]]), todo = [dev.cell];
  while (todo.length) {
    todo.sort((a, b) => dist.get(a) - dist.get(b));
    const c = todo.shift();
    if (c === target) {
      const path = [c];
      while (prev.get(path[0]) >= 0) path.unshift(prev.get(path[0]));
      return path;
    }
    if (c !== dev.cell && !d.free(c)) continue;
    for (const n of d.neighbors(c)) {
      if (!(d.free(n) || n === target)) continue;
      const v = dist.get(c) + (costOf ? costOf(n) : 1);
      if (!dist.has(n) || v < dist.get(n)) { dist.set(n, v); prev.set(n, c); todo.push(n); }
    }
  }
  return null;
}

// Desk squares that can still reach a socket of each kind, after laying `path`.
function openAfter(d, path) {
  const wires = path.slice(1, -1), out = path[path.length - 1];
  wires.forEach((i) => { d.cells[i] = { t: 'wire', id: -1 }; });
  const saved = d.cells[out].dev;
  d.cells[out].dev = -1;
  let n = 0;
  for (const k of ['power', 'usb']) { const r = d.reach(k, -1); for (let i = 0; i < r.length; i++) if (r[i] >= 0) n++; }
  wires.forEach((i) => { d.cells[i] = null; });
  d.cells[out].dev = saved;
  return n;
}

const PLAYERS = {
  messy: (d, r) => (dev) => d.route(dev, () => 1 + r.next() * 12),
  sloppy: (d, r) => (dev) => {
    const ends = [];
    for (const s of d.strips) if (s.kind === dev.kind) for (const o of s.cells) if (d.cells[o].dev == null) ends.push(o);
    while (ends.length) {
      const o = ends.splice(r.int(0, ends.length - 1), 1)[0], p = pathTo(d, dev, o);
      if (p) return p;
    }
    return null;
  },
  greedy: (d) => (dev) => d.route(dev),
  hugger: (d) => (dev) => d.route(dev, (n) => (d.free(n) ? 1 + 0.35 * freeAround(d, n) : 1)),
  planner: (d) => (dev) => {
    let best = null, bv = -Infinity;
    for (const s of d.strips) {
      if (s.kind !== dev.kind) continue;
      for (const o of s.cells) {
        if (d.cells[o].dev != null) continue;
        for (const cost of [null, (n) => 1 + 0.35 * freeAround(d, n)]) {
          const p = pathTo(d, dev, o, cost);
          if (!p) continue;
          const v = openAfter(d, p) - 0.3 * p.length;
          if (v > bv) { bv = v; best = p; }
        }
      }
    }
    return best;
  }
};

function play(lv, seed, make) {
  const d = new CS.Desk(lv, seed), r = new CS.Rng(seed + 7), router = make(d, r);
  while (!d.over && d.turn < LIMIT) {
    const dev = d.unplugged()[0];
    const path = dev && router(dev);
    if (!path) { d.giveUp(); break; }
    d.plug(dev.id, path);
    d.events.length = 0;
  }
  return { plugged: d.plugged, neat: d.neat, stars: d.stars(), endless: !d.over, W: d.W, H: d.H, points: d.points() };
}

const table = {};
for (const lv of LEVELS) {
  table[lv] = {};
  for (const [name, make] of Object.entries(PLAYERS)) {
    const runs = [];
    for (let i = 0; i < N; i++) runs.push(play(lv, 300 + i * 61, make));
    const avg = (k) => runs.reduce((a, x) => a + x[k], 0) / runs.length;
    const share = (s) => runs.filter((x) => x.stars >= s).length / runs.length;
    const endless = runs.filter((x) => x.endless).length;
    const sorted = runs.map((x) => x.plugged).sort((a, b) => a - b);
    table[lv][name] = { plugged: avg('plugged'), star1: share(1), early: runs.filter((x) => x.plugged <= 8).length / runs.length };
    console.log(lv.padEnd(9), name.padEnd(7), 'devices', avg('plugged').toFixed(1).padStart(5), '| median', String(sorted[sorted.length >> 1]).padStart(3),
      '| neat', (100 * avg('neat') / Math.max(1, avg('plugged'))).toFixed(0).padStart(3) + '%', '| desk', avg('W').toFixed(1) + 'x' + avg('H').toFixed(1),
      '| stars 1/2/3', (100 * share(1)).toFixed(0) + '/' + (100 * share(2)).toFixed(0) + '/' + (100 * share(3)).toFixed(0) + '%', '| points', avg('points').toFixed(0),
      endless ? '| ENDLESS ' + endless : '');
    if (endless) { ok = false; console.log('PROBLEM: some', name, 'desks on', lv, 'never filled up'); }
  }
  if (!(table[lv].greedy.plugged > table[lv].sloppy.plugged * 1.15)) { ok = false; console.log('PROBLEM: short cables should clearly beat sloppy ones on', lv); }
  if (!(table[lv].greedy.early <= 0.05)) { ok = false; console.log('PROBLEM: too many desks end within 8 devices on', lv); }
  if (!(Math.max(table[lv].greedy.star1, table[lv].planner.star1) >= 0.5)) { ok = false; console.log('PROBLEM: good cabling should usually earn the first star on', lv); }
}
for (let i = 1; i < LEVELS.length; i++) {
  if (!(table[LEVELS[i]].greedy.plugged < table[LEVELS[i - 1]].greedy.plugged)) { ok = false; console.log('PROBLEM: levels should get harder in order at', LEVELS[i]); }
}
console.log(ok ? 'ALL GOOD' : 'PROBLEMS FOUND');
