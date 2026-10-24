/*
 * Spot Kick balance check. Run from the wni folder: node dev/balance_spot_kick.js
 * Plays thousands of shootouts with scripted players and prints win rates per level.
 * A truly unpredictable player must be able to beat every level (Edith included);
 * players with obvious habits should get punished harder the higher the level.
 */
'use strict';
const SK = require('../games/spot-kick/engine.js');
const LEVELS = ['pip', 'gridlock', 'monolith', 'edith'];
const N = Number(process.env.N) || 4000;
let ok = true;

// A player picks a shot (zone, power) and a dive from its own memory.
const PLAYERS = {
  random: (r) => ({ shot: () => [Math.floor(r() * 6), 0.35 + r() * 0.6], dive: () => Math.floor(r() * 6) }),
  'random, good timing': (r) => ({ shot: () => [Math.floor(r() * 6), r() < 0.75 ? 0.55 + r() * 0.3 : 0.3 + r() * 0.65], dive: () => Math.floor(r() * 6) }),
  'always low left': (r) => ({ shot: () => [3, 0.7], dive: () => 3 }),
  'left, right, left': () => { let i = 0, j = 0; return { shot: () => [(i++ % 2) ? 5 : 3, 0.7], dive: () => (j++ % 2) ? 5 : 3 }; },
  'favorite spot 60%': (r) => ({ shot: () => [r() < 0.6 ? 5 : Math.floor(r() * 6), 0.7], dive: () => (r() < 0.6 ? 3 : Math.floor(r() * 6)) }),
  'never repeats': (r) => { let last = -1, lastD = -1; return { shot: () => { let z; do { z = Math.floor(r() * 6); } while (z === last); last = z; return [z, 0.7]; }, dive: () => { let z; do { z = Math.floor(r() * 6); } while (z === lastD); lastD = z; return z; } }; }
};

const table = {};
for (const [name, make] of Object.entries(PLAYERS)) {
  table[name] = {};
  for (const lv of LEVELS) {
    let wins = 0, goals = 0, kicks = 0;
    for (let i = 0; i < N; i++) {
      const r = SK.rng(1000 + i), m = new SK.Match(lv, 77 + i * 13), p = make(r);
      while (!m.over) {
        if (m.turn === 'you') { const [z, pw] = p.shot(); m.shoot(z, pw); }
        else { m.aim(); m.keep(p.dive()); }
      }
      if (m.winner === 'you') wins++;
      goals += m.score.you;
      kicks += m.taken('you');
    }
    table[name][lv] = (100 * wins / N).toFixed(1) + '% (' + (100 * goals / kicks).toFixed(0) + '% goals)';
  }
}
console.log('win rate (your goal rate) per opponent, ' + N + ' shootouts each');
for (const [name, row] of Object.entries(table)) console.log(name.padEnd(22), LEVELS.map((l) => (l + ' ' + row[l]).padEnd(28)).join(''));

const pct = (s) => parseFloat(s);
const rnd = table['random, good timing'];
if (!(pct(rnd.edith) >= 8)) { ok = false; console.log('PROBLEM: an unpredictable player should beat Edith now and then'); }
if (!(pct(rnd.pip) > pct(rnd.gridlock) && pct(rnd.gridlock) > pct(rnd.monolith) && pct(rnd.monolith) > pct(rnd.edith))) { ok = false; console.log('PROBLEM: levels should get harder in order'); }
if (!(pct(table['always low left'].edith) < 2)) { ok = false; console.log('PROBLEM: Edith should crush a one-spot shooter'); }
if (!(pct(rnd.pip) >= 60)) { ok = false; console.log('PROBLEM: Pip should be easy for a varied player'); }
console.log(ok ? 'ALL GOOD' : 'PROBLEMS FOUND');
