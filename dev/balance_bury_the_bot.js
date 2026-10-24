// Bury the Bot balance sim for the four-level cast (greedy dealer that uses powers).
const E = require(require('path').join(__dirname, '..', 'games', 'bury-the-bot', 'engine.js'));

function boardBad(rows) {
  const f = E.features(rows);
  return 3.2178882868487753 * f.rowT + 9.348695305445199 * f.colT + 7.899265427351652 * f.holes + 3.3855972247263626 * f.wells + 1.5 * f.maxH;
}

function play(botId, seed, o) {
  const deck = new E.Deck(seed);
  const rand = E.rng((seed * 2654435761) >>> 0);
  let hand = [deck.draw(), deck.draw(), deck.draw()];
  let rows = E.emptyRows();
  let turn = 0, pts = o.start;
  const C = { junk: o.cJunk, shove: o.cShove, spin: o.cSpin };
  const knows = E.BOTS[botId].knowsDeck;
  const rem = (i) => { const r = hand.filter((_, k) => k !== i); if (knows) r.push(deck.peek()); return r; };
  while (turn < o.max) {
    if (pts >= C.junk && E.features(rows).maxH >= o.junkAt) {
      const r = E.addJunk(rows, Math.floor(rand() * E.W));
      pts -= C.junk; rows = r.rows;
      if (r.topOut) return turn;
    }
    let pick = 0, spin = false, shove = 0, best = -Infinity;
    for (let i = 0; i < 3; i++) {
      const remaining = rem(i);
      for (const sl of [false, true]) for (const sh of [0, -1, 1]) {
        const cost = (sl ? C.spin : 0) + (sh ? C.shove : 0);
        if (cost > pts) continue;
        const d = E.decide(rows, hand[i], botId, { turn, spinLock: sl, shove: sh, remaining });
        if (sh && !d.shoved) continue;
        const bad = (d.result.topOut ? 1e6 : boardBad(d.result.rows) - 15 * d.result.cleared) - 6 * cost;
        if (bad > best) { best = bad; pick = i; spin = sl; shove = sh; }
      }
    }
    const d = E.decide(rows, hand[pick], botId, { turn, spinLock: spin, shove, remaining: rem(pick) });
    if (spin) pts -= C.spin;
    if (shove) pts -= C.shove;
    turn++;
    if (d.result.topOut) return turn;
    rows = d.result.rows;
    pts = Math.min(o.cap, pts + 1);
    hand.splice(pick, 1);
    hand.push(deck.draw());
  }
  return o.max + 1;
}

// Usage: node dev/balance_bury_the_bot.js [bot] [games] [key=value ...]
// With no bot given, runs all four. Output: how many pieces each bot survives (lower = easier to bury).
const [, , botArg, nStr, ...rest] = process.argv;
const o = { start: 3, cap: 10, cJunk: 7, cShove: 6, cSpin: 5, junkAt: 6, max: 200 };
rest.forEach((kv) => { const [k, v] = kv.split('='); o[k] = Number(v); });
const n = Number(nStr || 20);
for (const botId of (botArg ? [botArg] : Object.keys(E.BOTS))) {
  const t0 = Date.now();
  const res = [];
  for (let s = 1; s <= n; s++) res.push(play(botId, s * 7919 + 13, o));
  const s = res.slice().sort((a, b) => a - b);
  const q = (p) => s[Math.min(s.length - 1, Math.floor(p * s.length))];
  console.log(`${botId} ${rest.join(' ')} n=${n} | min ${s[0]} p25 ${q(0.25)} med ${q(0.5)} p75 ${q(0.75)} p90 ${q(0.9)} max ${s[s.length - 1]} | ${((Date.now() - t0) / 1000).toFixed(0)}s`);
}
