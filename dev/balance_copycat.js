/*
 * Copycat balance check. Run from the wni folder: node dev/balance_copycat.js
 * Scripted dancers play every level many times:
 *   random   any move
 *   greedy   paints the best tile next to it and dodges open trapdoors, ignoring what the robot will copy
 *   planner  looks a few beats ahead (including what the robot will copy) to out-paint it and drop it through trapdoors
 * Every level, Edith included, must be winnable by the planner; greedy painting should struggle against Edith.
 */
'use strict';
const CC = require('../games/copycat/engine.js');
const LEVELS = ['pip', 'gridlock', 'monolith', 'edith'];
const N = Number(process.env.N) || 150;
const DEPTH = Number(process.env.DEPTH) || 3;
let ok = true;

function value(g) {
  const n = g.count();
  return n.you - n.bot;
}

const PLAYERS = {
  random: (g, r) => CC.MOVES[r.int(0, 4)],
  greedy: (g, r) => {
    let best = 'stay', bestV = -Infinity;
    for (const m of CC.MOVES) {
      const to = g.land(g.you, m), i = CC.idx(to.x, to.y);
      const v = (g.isOpen(i, g.turn) ? -50 : 0) + (g.owner[i] === 0 ? 2 : g.owner[i] === 2 ? 3 : 0) - (to.bump ? 1 : 0) + r.next() * 0.1;
      if (v > bestV) { bestV = v; best = m; }
    }
    return best;
  },
  planner: (g) => {
    function search(s, depth) {
      if (depth === 0 || s.over) return value(s);
      let best = -Infinity;
      for (const m of CC.MOVES) {
        const c = s.clone();
        c.play(m);
        best = Math.max(best, search(c, depth - 1));
      }
      return best;
    }
    let best = 'stay', bestV = -Infinity;
    for (const m of CC.MOVES) {
      const c = g.clone();
      c.play(m);
      const v = search(c, DEPTH - 1);
      if (v > bestV) { bestV = v; best = m; }
    }
    return best;
  }
};
const table = {};
for (const [name, brain] of Object.entries(PLAYERS)) {
  table[name] = {};
  for (const lv of LEVELS) {
    let wins = 0, mine = 0, theirs = 0, drops = 0;
    const n = name === 'planner' ? Math.min(N, 80) : N;
    for (let i = 0; i < n; i++) {
      const g = new CC.Game(lv, 1000 + i * 17), r = new CC.Rng(9 + i);
      while (!g.over) { g.play(brain(g, r)); g.events.length = 0; }
      if (g.result === 'win') wins++;
      const n = g.count();
      mine += n.you; theirs += n.bot; drops += g.bot.drops;
    }
    table[name][lv] = wins / n;
    table[name][lv + 'txt'] = (100 * wins / n).toFixed(0) + '% (tiles ' + (mine / n).toFixed(1) + ' vs ' + (theirs / n).toFixed(1) + ', robot falls ' + (drops / n).toFixed(1) + ')';
  }
  console.log(name.padEnd(8), LEVELS.map((l) => (l + ' ' + table[name][l + 'txt']).padEnd(48)).join(''));
}
for (const lv of LEVELS) if (!(table.planner[lv] > 0.05)) { ok = false; console.log('PROBLEM: the planner cannot beat', lv); }
if (!(table.planner.pip > table.planner.edith && table.greedy.pip > table.greedy.gridlock && table.greedy.gridlock > table.greedy.edith)) { ok = false; console.log('PROBLEM: levels should get harder in order'); }
if (!(table.greedy.edith < 0.15)) { ok = false; console.log('PROBLEM: greedy painting should rarely beat Edith'); }
if (!(table.random.pip < 0.3)) { ok = false; console.log('PROBLEM: random moves should not beat Pip'); }
console.log(ok ? 'ALL GOOD' : 'PROBLEMS FOUND');
