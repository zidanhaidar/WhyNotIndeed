/*
 * Echo balance check. Run from the wni folder: node dev/balance_echo.js
 * Scripted explorers play every level on many generated mazes. They only know what they have heard or bumped into:
 *   silent    never pings, finds walls by bumping, heads for the far corner and anything it stumbles on
 *   explorer  plans with the walls it remembers (unknown passages count as open) and pings when its route
 *             runs into the unknown or a remembered route turns out to be blocked
 * Every level, Edith included, must be winnable by the explorer, and pinging should clearly beat staying silent.
 */
'use strict';
const EC = require('../games/echo/engine.js');
const LEVELS = ['pip', 'gridlock', 'monolith', 'edith'];
const N = Number(process.env.N) || 200;
let ok = true;

// Shortest route on the explorer's own mental map.
function plan(m, goals) {
  const W = m.W, H = m.H, prev = new Int32Array(W * H).fill(-2), q = [m.cell(m.pos.x, m.pos.y)];
  prev[q[0]] = -1;
  const isGoal = new Set(goals.map((g) => m.cell(g.x, g.y)));
  for (let h = 0; h < q.length; h++) {
    const u = q[h];
    if (isGoal.has(u)) {
      const path = [];
      let c = u;
      while (prev[c] !== -1) { path.unshift(c); c = prev[c]; }
      return path;
    }
    const ux = u % W, uy = (u / W) | 0;
    for (const d of EC.DIR_LIST) {
      const e = m.edge(ux, uy, d);
      if (!e) continue;
      const mem = m.memory[m.key(e)];
      if (mem && mem.wall) continue;
      const v = EC.DIRS[d], n = m.cell(ux + v[0], uy + v[1]);
      if (prev[n] === -2) { prev[n] = u; q.push(n); }
    }
  }
  return null;
}

function dirTo(m, cell) {
  const x = cell % m.W, y = (cell / m.W) | 0;
  for (const d of EC.DIR_LIST) { const v = EC.DIRS[d]; if (m.pos.x + v[0] === x && m.pos.y + v[1] === y) return d; }
  return 'up';
}

function goals(m) {
  const keys = m.keys.filter((k) => !k.got && k.known);
  if (keys.length) return keys;
  if (m.keysLeft() === 0 && m.exitKnown) return [m.exit];
  // explore: cells never sensed
  const out = [];
  for (let i = 0; i < m.W * m.H; i++) if (!m.seen[i]) out.push({ x: i % m.W, y: (i / m.W) | 0 });
  return out.length ? out : [m.exit];
}

const BRAINS = {
  silent: (m) => {
    const path = plan(m, goals(m));
    return path && path.length ? { move: dirTo(m, path[0]) } : { move: EC.DIR_LIST[m.moves % 4] };
  },
  explorer: (m, st) => {
    const path = plan(m, goals(m));
    const sinceLast = m.moves - (st.lastPing == null ? -99 : st.lastPing);
    let unknownAhead = false;
    if (path && path.length) {
      let x = m.pos.x, y = m.pos.y;
      for (let j = 0; j < Math.min(2, path.length); j++) {
        const d = dirTo({ W: m.W, pos: { x, y } }, path[j]), e = m.edge(x, y, d);
        if (e && !m.memory[m.key(e)]) unknownAhead = true;
        x = path[j] % m.W; y = (path[j] / m.W) | 0;
      }
    }
    if (m.pingsLeft > 0 && sinceLast >= 2 && (unknownAhead || st.bumped || !path)) { st.lastPing = m.moves; st.bumped = false; return { ping: true }; }
    return path && path.length ? { move: dirTo(m, path[0]) } : { move: EC.DIR_LIST[m.moves % 4] };
  }
};

const table = {};
for (const lv of LEVELS) {
  const line = [];
  table[lv] = {};
  for (const [name, brain] of Object.entries(BRAINS)) {
    let wins = 0, keys = 0, left = 0;
    for (let i = 0; i < N; i++) {
      const m = new EC.Maze(lv, 500 + i * 13), st = {};
      let guard = 0;
      while (!m.over && guard++ < 2000) {
        const a = brain(m, st);
        if (a.ping) m.ping();
        else { const res = m.move(a.move); if (res && res.bump) st.bumped = true; }
        m.events.length = 0;
      }
      if (m.result === 'win') { wins++; left += m.stepsLeft; }
      keys += m.keys.filter((k) => k.got).length;
    }
    table[lv][name] = wins / N;
    line.push(name + ' ' + (100 * wins / N).toFixed(0) + '% (keys ' + (keys / N).toFixed(1) + (wins ? ', steps left ' + (left / wins).toFixed(0) : '') + ')');
  }
  const c = EC.LEVELS[lv];
  console.log(lv.padEnd(9), (c.w + 'x' + c.h + ', ' + c.keys + ' keys, ' + c.pings + ' pings').padEnd(26), line.join('  |  '));
}
for (const lv of LEVELS) {
  if (!(table[lv].explorer > 0.08)) { ok = false; console.log('PROBLEM: the explorer cannot beat', lv); }
  if (!(table[lv].explorer > table[lv].silent)) { ok = false; console.log('PROBLEM: pinging should beat staying silent on', lv); }
}
if (!(table.pip.explorer > table.edith.explorer)) { ok = false; console.log('PROBLEM: Edith should be harder than Pip'); }
console.log(ok ? 'ALL GOOD' : 'PROBLEMS FOUND');
