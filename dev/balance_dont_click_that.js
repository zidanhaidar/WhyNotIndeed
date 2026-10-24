/*
 * Don't Click That balance check. Run from the wni folder: node dev/balance_dont_click_that.js
 * Plays many runs on every level with scripted players who, like a person, can drag one window every 0.8 s:
 *   idle     never touches a window
 *   blocker  drops a window on the pointer's route, a little ahead of it
 *   guard    keeps a window over the button and uses spare moves to block the route
 * The game is endless, so the checks are about pace: a good player earns the first star on every level
 * (Edith included) at least half the time, doing nothing loses fast, levels get harder in order, and every run ends.
 * It also checks the pointer's rules: it never freezes (it can reach every window's close button), a covered trash
 * takes no file, and a file under a window is never grabbed.
 */
'use strict';
const DC = require('../games/dont-click-that/engine.js');
const LEVELS = ['pip', 'gridlock', 'monolith', 'edith'];
const N = Number(process.env.N) || 40;
const GAP = 0.8, LIMIT = 30 * 60;
let ok = true;

function center(r) { return [r.x + r.w / 2, r.y + r.h / 2]; }
function busy(d, w) { const p = d.pointer; return p.closing && p.closing.w === w; }

// Drops window w centred on (x, y), nudged so it does not land on the pointer.
function drop(d, w, x, y) {
  const p = d.pointer;
  let nx = x - w.w / 2, ny = y - w.h / 2;
  if (p.x > nx - 12 && p.x < nx + w.w + 12 && p.y > ny - 12 && p.y < ny + w.h + 12) {
    const dx = x - p.x, dy = y - p.y, l = Math.hypot(dx, dy) || 1;
    nx += dx / l * (w.w / 2 + 20); ny += dy / l * (w.h / 2 + 20);
  }
  d.moveWindow(w.id, nx, ny);
}

// the window most worth moving: the one farthest from (x, y) that the robot is not closing
function spare(d, x, y, not) {
  let best = null, bd = -1;
  for (const w of d.windows) {
    if (busy(d, w) || w === not) continue;
    const c = center(w), dist = Math.hypot(c[0] - x, c[1] - y);
    if (dist > bd) { bd = dist; best = w; }
  }
  return best;
}

function blockAhead(d) {
  const p = d.pointer, path = p.path;
  if (!path.length) return false;
  const ahead = path[Math.min(path.length - 1, 6)];
  const w = spare(d, ahead[0], ahead[1]);
  if (!w) return false;
  drop(d, w, ahead[0], ahead[1]);
  return true;
}

const PLAYERS = {
  idle: () => false,
  blocker: (d) => blockAhead(d),
  guard: (d) => {
    const b = d.button, bc = center(b);
    const cover = d.windows.find((w) => !busy(d, w) && w.x <= b.x && w.y <= b.y && w.x + w.w >= b.x + b.w && w.y + w.h >= b.y + b.h);
    if (!cover) {
      const w = spare(d, bc[0] + 400, bc[1] + 400);
      // the closest free window goes over the button
      let best = null, bd = Infinity;
      for (const v of d.windows) {
        if (busy(d, v) || v.w < b.w + 8 || v.h < b.h + 8) continue;
        const c = center(v), dist = Math.hypot(c[0] - bc[0], c[1] - bc[1]);
        if (dist < bd) { bd = dist; best = v; }
      }
      if (best || w) { const v = best || w; d.moveWindow(v.id, bc[0] - v.w / 2, bc[1] - v.h / 2); return true; }
      return false;
    }
    return blockAhead(d);
  }
};

function play(lv, seed, player) {
  const d = new DC.Desktop(lv, seed);
  let cool = 0;
  while (!d.over && d.t < LIMIT) {
    cool -= DC.DT;
    if (cool <= 0 && player(d)) cool = GAP;
    d.step();
    d.events.length = 0;
  }
  return { t: d.t, stars: d.stars(), files: d.filesLeft(), points: d.points(), endless: !d.over };
}

// The rules the pointer must keep, whatever you do with the windows.
function rules() {
  let frozen = 0, intoCovered = 0, coveredGrabs = 0, setups = 0;
  for (const lv of LEVELS) for (let seed = 1; seed <= 30; seed++) {
    // a window over the button: the pointer must keep moving (closing something), never freeze
    const d = new DC.Desktop(lv, seed * 97);
    for (let i = 0; i < 30; i++) { d.step(); d.events.length = 0; }
    d.windows.forEach((w) => d.moveWindow(w.id, 960, 0));
    const w = d.windows[0], b = d.button;
    d.moveWindow(w.id, b.x + b.w / 2 - w.w / 2, b.y + b.h / 2 - w.h / 2);
    let moved = 0, px = d.pointer.x, py = d.pointer.y;
    for (let i = 0; i < 90 && !d.over; i++) { d.step(); d.events.length = 0; moved += Math.hypot(d.pointer.x - px, d.pointer.y - py); px = d.pointer.x; py = d.pointer.y; }
    setups++;
    if (moved < 5 && !d.over && !d.pointer.closing) frozen++;
    // a covered trash takes nothing, and a covered file is never grabbed
    const e = new DC.Desktop(lv, seed * 131), p = e.pointer, f = e.files[0];
    f.alive = false; p.holding = f; p.x = DC.TRASH.x - 20; p.y = DC.TRASH.y - 20; p.think = 0;
    const tw = e.windows[0];
    e.moveWindow(tw.id, DC.TRASH.x - tw.w / 2, DC.TRASH.y - tw.h / 2);
    for (let i = 0; i < 30 * 40 && !e.over; i++) {
      const v = e.windows[1], g2 = e.files[1];
      if (v && g2.alive) e.moveWindow(v.id, g2.x - v.w / 2, g2.y - v.h / 2);
      const coveredNow = new Set(e.files.filter((x) => x.alive && e.covered(x.x, x.y)).map((x) => x.id)), trashCovered = e.covered(DC.TRASH.x, DC.TRASH.y);
      e.step();
      for (const ev of e.events) {
        if (ev.type === 'trashed' && trashCovered) intoCovered++;
        if (ev.type === 'grab' && coveredNow.has(ev.id)) coveredGrabs++;
      }
      e.events.length = 0;
    }
  }
  console.log('rules:', setups, 'blocked setups,', frozen, 'frozen pointers,', intoCovered, 'files into a covered trash,', coveredGrabs, 'covered files grabbed');
  if (frozen || intoCovered || coveredGrabs) { ok = false; console.log('PROBLEM: the pointer broke a rule'); }
}
rules();

const table = {};
for (const lv of LEVELS) {
  table[lv] = {};
  for (const [name, player] of Object.entries(PLAYERS)) {
    const runs = [];
    for (let i = 0; i < N; i++) runs.push(play(lv, 700 + i * 131, player));
    const avg = (k) => runs.reduce((a, r) => a + r[k], 0) / runs.length;
    const share = (s) => runs.filter((r) => r.stars >= s).length / runs.length;
    const sorted = runs.map((r) => r.t).sort((a, b) => a - b);
    const endless = runs.filter((r) => r.endless).length;
    table[lv][name] = { t: avg('t'), star1: share(1) };
    console.log(lv.padEnd(9), name.padEnd(8), 'survived', avg('t').toFixed(0).padStart(4) + 's', '| median', sorted[sorted.length >> 1].toFixed(0).padStart(4) + 's',
      '| files left', avg('files').toFixed(1), '| stars 1/2/3', (100 * share(1)).toFixed(0) + '/' + (100 * share(2)).toFixed(0) + '/' + (100 * share(3)).toFixed(0) + '%',
      '| points', avg('points').toFixed(0), endless ? '| ENDLESS ' + endless : '');
    if (endless) { ok = false; console.log('PROBLEM: some', name, 'runs on', lv, 'never ended'); }
  }
  const best = Math.max(table[lv].blocker.star1, table[lv].guard.star1);
  if (!(best >= 0.5)) { ok = false; console.log('PROBLEM: a good player should usually earn the first star on', lv); }
  if (!(table[lv].idle.t < 0.5 * Math.max(table[lv].blocker.t, table[lv].guard.t))) { ok = false; console.log('PROBLEM: doing nothing should lose much sooner on', lv); }
}
for (let i = 1; i < LEVELS.length; i++) {
  const a = LEVELS[i - 1], b = LEVELS[i];
  if (!(table[b].guard.t < table[a].guard.t)) { ok = false; console.log('PROBLEM: levels should get harder in order at', b); }
}
console.log(ok ? 'ALL GOOD' : 'PROBLEMS FOUND');
