// Excel Dungeon balance: a sensible bot that explores, grabs items, fights in place and drinks when low.
const X = require(require('path').join(__dirname, '..', 'games', 'excel-dungeon', 'engine.js'));
const { W, H, FLOOR, DIRS, idx } = X;

function bfs(g, from, goalFn, known) {
  const prev = new Int16Array(W * H).fill(-2);
  const q = [idx(from.x, from.y)];
  prev[q[0]] = -1;
  for (let qi = 0; qi < q.length; qi++) {
    const c = q[qi], cx = c % W, cy = (c / W) | 0;
    if (qi > 0 && goalFn(cx, cy)) {
      let n = c;
      while (prev[n] !== q[0] && prev[n] >= 0) n = prev[n];
      const nx = n % W, ny = (n / W) | 0;
      for (let k = 0; k < 4; k++) if (cx === cx && from.x + DIRS[k][0] === nx && from.y + DIRS[k][1] === ny) return k;
      return -1;
    }
    for (let k = 0; k < 4; k++) {
      const nx = cx + DIRS[k][0], ny = cy + DIRS[k][1];
      if (g.tile(nx, ny) !== FLOOR) continue;
      if (known && !g.seen[idx(nx, ny)]) {
        // allow stepping into unseen cells only as a goal
        if (!goalFn(nx, ny)) continue;
      }
      const n = idx(nx, ny);
      if (prev[n] !== -2) continue;
      const m = g.monsterAt(nx, ny);
      if (m && !goalFn(nx, ny)) continue;
      prev[n] = c;
      q.push(n);
    }
  }
  return -1;
}

function play(level, seed, style) {
  const g = new X.Game(level, seed);
  let guard = 0;
  while (!g.over && guard++ < 5000) {
    const h = g.hero;
    const lowAt = style === 'careful' ? 0.5 : 0.35;
    if (h.hp < h.max * lowAt && h.potions > 0) { g.drink(); continue; }
    // adjacent monsters: attack the weakest
    let adj = null;
    for (let k = 0; k < 4; k++) {
      const m = g.monsterAt(h.x + DIRS[k][0], h.y + DIRS[k][1]);
      if (m && (!adj || m.hp < adj.m.hp)) adj = { m, k };
    }
    if (adj) { g.move(adj.k); continue; }
    // careful style: wait for awake monsters to come to you instead of walking into packs
    const awakeNear = g.monsters.some((m) => m.hp > 0 && m.awake && Math.abs(m.x - h.x) + Math.abs(m.y - h.y) <= 3);
    if (style === 'careful' && awakeNear) { g.wait(); continue; }
    const seenItem = (x, y) => g.seen[idx(x, y)] && g.items[idx(x, y)] && g.items[idx(x, y)].kind !== 'stairs' && !(g.items[idx(x, y)].kind === 'potion' && h.potions >= 5);
    let k = bfs(g, h, seenItem, true);
    if (k < 0) k = bfs(g, h, (x, y) => { const m = g.monsterAt(x, y); return m && g.seen[idx(x, y)] && !m.boss; }, true);
    if (k < 0) k = bfs(g, h, (x, y) => !g.seen[idx(x, y)], true);
    if (k < 0) k = bfs(g, h, (x, y) => { const it = g.items[idx(x, y)]; const m = g.monsterAt(x, y); return (it && it.kind === 'stairs') || (m && m.boss); }, false);
    if (k < 0) { g.wait(); continue; }
    if (!g.move(k)) g.wait();
  }
  return { result: g.result, floor: g.floor, lvl: g.hero.lvl, turns: g.turn };
}

// Usage: node dev/balance_excel_dungeon.js
// Optional: SWEEP='[["edith",{"potions":3}]]' to try level overrides. Output: bot win rate per level.
const SWEEP = process.env.SWEEP ? JSON.parse(process.env.SWEEP) : ['pip', 'gridlock', 'monolith', 'edith'].map((l) => [l, {}]);
for (const [level, over] of SWEEP) { Object.assign(X.LEVELS[level], over);
  for (const style of ["careful"]) {
    let wins = 0; const floors = [];
    const N = 300;
    for (let s = 1; s <= N; s++) {
      const o = play(level, s * 7919 + 1, style);
      if (o.result === 'win') wins++;
      floors.push(o.floor);
    }
    const hist = floors.reduce((a, f) => { a[f] = (a[f] || 0) + 1; return a; }, {});
    console.log(level.padEnd(9), JSON.stringify(over), 'win', (100 * wins / N).toFixed(1) + '%', 'died on floor', JSON.stringify(hist));
  }
}
