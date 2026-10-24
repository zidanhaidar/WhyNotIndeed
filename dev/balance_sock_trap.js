/*
 * Sock Trap balance check. Run from the wni folder: node dev/balance_sock_trap.js
 * Every office is generated fresh, so this plays many generated offices per vacuum:
 * 1. Every office is 18 x 12, has a dock, keeps its floor in range, and all its floor is connected.
 * 2. Doing nothing loses: it may sneak a single office now and then, but almost never a match.
 * 3. A strong player (a layout search run on each office, like a careful human trying ideas) wins most
 *    offices, so a match of five offices (win three) is winnable on every level, Edith included.
 * MAPS=n sets how many offices per vacuum (default 16), ITER=n the search length per office (default 800).
 */
'use strict';
const ST = require('../games/sock-trap/engine.js');
const LEVELS = ['pip', 'gridlock', 'monolith', 'edith'];
const MAPS = Number(process.env.MAPS) || 16;
const ITER = Number(process.env.ITER) || 800;
const ROUNDS = 5, NEED = 3;
let ok = true;
function check(cond, msg) { if (!cond) { ok = false; console.log('PROBLEM:', msg); } }

// chance of winning at least NEED of ROUNDS offices when each is won with chance p
function matchWin(p) {
  let sum = 0;
  const C = (n, k) => { let r = 1; for (let i = 1; i <= k; i++) r = r * (n - k + i) / i; return r; };
  for (let k = NEED; k <= ROUNDS; k++) sum += C(ROUNDS, k) * p ** k * (1 - p) ** (ROUNDS - k);
  return sum;
}

function shape(lv, map) {
  const g = new ST.Game(lv, 1, map);
  const floor = g.tiles.filter((t) => t === 'floor').length;
  const seen = new Set([ST.idx(g.dock.x, g.dock.y)]), q = [[g.dock.x, g.dock.y]];
  while (q.length) {
    const [x, y] = q.shift();
    for (const [dx, dy] of ST.DIRS) {
      const nx = x + dx, ny = y + dy, c = ST.idx(nx, ny);
      if (g.isFloor(nx, ny) && !seen.has(c)) { seen.add(c); q.push([nx, ny]); }
    }
  }
  return map.length === ST.H && map.every((r) => r.length === ST.W) && seen.size === floor && floor >= ST.FLOOR[0] && floor <= ST.FLOOR[1];
}

// dirty share at the end of a run with this layout (null if the layout is not allowed)
function run(lv, map, seed, layout) {
  const g = new ST.Game(lv, seed, map);
  for (const it of layout) if (!g.place(it[0], it[1], it[2])) return null;
  return g.runToEnd().pct;
}
function avgRun(lv, map, seeds, layout) {
  let sum = 0;
  for (const s of seeds) { const p = run(lv, map, s, layout); if (p == null) return null; sum += p; }
  return sum / seeds.length;
}

// Simulated annealing over item positions on one office.
function search(lv, map, R) {
  const cfg = ST.LEVELS[lv], g0 = new ST.Game(lv, 1, map), cells = [];
  for (let y = 0; y < ST.H; y++) for (let x = 0; x < ST.W; x++) if (g0.isFloor(x, y)) cells.push([x, y]);
  const seeds = cfg.brain === 'bounce' ? [11, 12, 13] : [1];
  const rand = () => {
    const L = [];
    for (const type of ['chair', 'cable', 'sock']) for (let i = 0; i < cfg.items[type]; i++) {
      const c = cells[Math.floor(R() * cells.length)];
      if (!L.some((l) => l[0] === c[0] && l[1] === c[1])) L.push([c[0], c[1], type]);
    }
    return L;
  };
  let cur = rand(), cv = avgRun(lv, map, seeds, cur);
  for (let k = 0; cv == null && k < 50; k++) { cur = rand(); cv = avgRun(lv, map, seeds, cur); }
  if (cv == null) return { layout: [], pct: 0 };
  let best = cur, bestV = cv, T = 8;
  for (let i = 0; i < ITER; i++) {
    const nxt = cur.map((x) => x.slice()), k = Math.floor(R() * nxt.length);
    if (R() < 0.6) { nxt[k][0] += Math.floor(R() * 5) - 2; nxt[k][1] += Math.floor(R() * 5) - 2; }
    else { const c = cells[Math.floor(R() * cells.length)]; nxt[k][0] = c[0]; nxt[k][1] = c[1]; }
    const v = avgRun(lv, map, seeds, nxt);
    if (v == null) continue;
    if (v >= cv || R() < Math.exp((v - cv) / T)) { cur = nxt; cv = v; }
    if (cv > bestV) { bestV = cv; best = cur.map((x) => x.slice()); }
    T = Math.max(0.3, T * 0.985);
  }
  return { layout: best, pct: bestV };
}

const t0 = Date.now();
for (const lv of LEVELS) {
  const cfg = ST.LEVELS[lv], R = ST.rng(99), random = cfg.brain === 'bounce';
  const evalSeeds = random ? Array.from({ length: 30 }, (_, i) => 100 + i) : [1];
  let noneWins = 0, noneSum = 0, wins = 0, sum = 0, bad = 0;
  for (let m = 0; m < MAPS; m++) {
    const map = ST.makeOffice(lv, ST.rng(5000 + m * 7919));
    if (!shape(lv, map)) bad++;
    for (const s of evalSeeds) {
      const p = run(lv, map, s, []);
      noneSum += p;
      if (p >= cfg.target) noneWins++;
    }
    const best = search(lv, map, R);
    for (const s of evalSeeds) {
      const p = run(lv, map, s, best.layout) || 0;
      sum += p;
      if (p >= cfg.target) wins++;
    }
  }
  const n = MAPS * evalSeeds.length, pWin = wins / n;
  console.log(lv.padEnd(9), 'target', cfg.target + '% |', 'no items: ' + (noneSum / n).toFixed(1) + '% dirty, wins ' + (100 * noneWins / n).toFixed(0) + '% |',
    'strong player: ' + (sum / n).toFixed(1) + '% dirty, wins ' + (100 * pWin).toFixed(0) + '% of offices, ' + (100 * matchWin(pWin)).toFixed(0) + '% of matches',
    '| no items wins ' + (100 * matchWin(noneWins / n)).toFixed(1) + '% of matches');
  check(bad === 0, lv + ': ' + bad + ' generated offices broke the rules');
  check(matchWin(noneWins / n) <= 0.05, lv + ' matches are won too often with no items');
  check(matchWin(pWin) >= 0.5, lv + ' matches are not reliably winnable');
}
console.log('took', ((Date.now() - t0) / 1000).toFixed(0) + 's');
console.log(ok ? 'ALL GOOD' : 'PROBLEMS FOUND');
