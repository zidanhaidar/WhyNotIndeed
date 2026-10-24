/*
 * Coffee Spill balance check. Run from the wni folder: node dev/balance_coffee_spill.js
 * Plays every level on many shuffled desks with two scripted players:
 *   nothing   draws no ink at all (must lose)
 *   umbrella  draws an upside-down V of ink over the laptop that drains into both mugs
 *   shelf     draws one flat shelf from mug to mug just above the laptop, clear of Edith's phone
 * At least one design must reliably win every level, Edith included.
 */
'use strict';
const CS = require('../games/coffee-spill/engine.js');
const LEVELS = ['pip', 'gridlock', 'monolith', 'edith'];
const N = Number(process.env.N) || 16;
let ok = true;

function line(d, x0, y0, x1, y1) {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  for (let i = 0; i <= n; i++) d.draw(Math.round(x0 + (x1 - x0) * i / n), Math.round(y0 + (y1 - y0) * i / n));
}

function umbrella(d) {
  const L = d.laptop, mL = d.mugs[0], mR = d.mugs[1];
  const cx = Math.round(L.x + L.w / 2);
  // stay below the phone's lane if there is one, otherwise pitch the roof a bit higher
  const peak = d.phone ? d.phone.y + d.phone.h + 1 : L.y - 16;
  const end = Math.min(mL.y - 3, peak + 6);
  line(d, cx, peak, Math.round(mL.x + mL.w / 2), end);
  line(d, cx + 1, peak, Math.round(mR.x + mR.w / 2), end);
}

// A flat shelf just above the laptop (and above Edith's phone) running from mug to mug: cheaper than the umbrella.
function shelf(d) {
  const L = d.laptop, mL = d.mugs[0], mR = d.mugs[1];
  const y = d.phone ? d.phone.y - 3 : L.y - 4;
  line(d, Math.round(mL.x + mL.w / 2), y, Math.round(mR.x + mR.w / 2), y);
}

function play(lv, seed, painter) {
  const d = new CS.Desk(lv, seed);
  if (painter) painter(d);
  const used = d.cfg.ink - d.ink;
  d.start();
  while (!d.over && d.t < 8000) { d.step(); d.events.length = 0; }
  return { win: d.result === 'win', hits: d.laptop.hits, caught: d.caught, used };
}

for (const lv of LEVELS) {
  const cfg = CS.LEVELS[lv];
  const row = {};
  for (const [name, painter] of [['nothing', null], ['umbrella', umbrella], ['shelf', shelf]]) {
    let wins = 0, hits = 0, caught = 0, used = 0;
    for (let i = 0; i < N; i++) {
      const r = play(lv, 200 + i * 31, painter);
      if (r.win) wins++;
      hits += r.hits; caught += r.caught; used += r.used;
    }
    row[name] = wins / N;
    console.log(lv.padEnd(9), name.padEnd(9), 'wins', (100 * wins / N).toFixed(0).padStart(3) + '%', '| laptop hits', (hits / N).toFixed(1), 'of', cfg.limit,
      '| caught in mugs', (caught / N).toFixed(0), '| ink used', (used / N).toFixed(0), 'of', cfg.ink);
  }
  if (row.nothing > 0) { ok = false; console.log('PROBLEM: doing nothing should never save the laptop on', lv); }
  if (!(Math.max(row.umbrella, row.shelf) > 0.5)) { ok = false; console.log('PROBLEM: no scripted design reliably beats', lv); }
}
console.log(ok ? 'ALL GOOD' : 'PROBLEMS FOUND');
