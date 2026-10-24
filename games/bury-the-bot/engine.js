/*
 * Bury the Bot: game engine and AI.
 * Pure logic, no DOM. Works in the browser (window.BTB) and in Node (module.exports).
 *
 * Board: H rows of W-bit integers, row 0 at the top. The top HIDDEN rows sit
 * above the danger line. If anything is left above the line after a piece
 * locks (and lines clear), the bot loses.
 */
(function (global) {
  'use strict';

  var W = 10;
  var H = 22;
  var HIDDEN = 2;
  var FULL = (1 << W) - 1;
  var SPAWN_X = 3;
  var TYPES = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];

  // Rotation states in a 4x4 box, [x, y] with y going down.
  var SHAPES = {
    I: [[[0, 1], [1, 1], [2, 1], [3, 1]], [[2, 0], [2, 1], [2, 2], [2, 3]], [[0, 2], [1, 2], [2, 2], [3, 2]], [[1, 0], [1, 1], [1, 2], [1, 3]]],
    O: [[[1, 0], [2, 0], [1, 1], [2, 1]], [[1, 0], [2, 0], [1, 1], [2, 1]], [[1, 0], [2, 0], [1, 1], [2, 1]], [[1, 0], [2, 0], [1, 1], [2, 1]]],
    T: [[[1, 0], [0, 1], [1, 1], [2, 1]], [[1, 0], [1, 1], [2, 1], [1, 2]], [[0, 1], [1, 1], [2, 1], [1, 2]], [[1, 0], [0, 1], [1, 1], [1, 2]]],
    S: [[[1, 0], [2, 0], [0, 1], [1, 1]], [[1, 0], [1, 1], [2, 1], [2, 2]], [[1, 1], [2, 1], [0, 2], [1, 2]], [[0, 0], [0, 1], [1, 1], [1, 2]]],
    Z: [[[0, 0], [1, 0], [1, 1], [2, 1]], [[2, 0], [1, 1], [2, 1], [1, 2]], [[0, 1], [1, 1], [1, 2], [2, 2]], [[1, 0], [0, 1], [1, 1], [0, 2]]],
    J: [[[0, 0], [0, 1], [1, 1], [2, 1]], [[1, 0], [2, 0], [1, 1], [1, 2]], [[0, 1], [1, 1], [2, 1], [2, 2]], [[1, 0], [1, 1], [0, 2], [1, 2]]],
    L: [[[2, 0], [0, 1], [1, 1], [2, 1]], [[1, 0], [1, 1], [1, 2], [2, 2]], [[0, 1], [1, 1], [2, 1], [0, 2]], [[0, 0], [1, 0], [1, 1], [1, 2]]]
  };

  // Rotation states the piece passes through (at the spawn spot) to reach each target rotation.
  var ROT_PATH = { 0: [], 1: [1], 2: [1, 2], 3: [3] };

  // ---------- helpers ----------

  var POP = new Uint8Array(1 << 12);
  for (var i = 1; i < POP.length; i++) POP[i] = POP[i >> 1] + (i & 1);

  // Precomputed row masks: PM[type][rot][x] = { dys, masks, maxDy } or null when out of bounds.
  var PM = {};
  TYPES.forEach(function (t) {
    PM[t] = [];
    for (var r = 0; r < 4; r++) {
      PM[t][r] = [];
      for (var x = -3; x < W; x++) {
        var byRow = {};
        var ok = true;
        SHAPES[t][r].forEach(function (c) {
          var cx = x + c[0];
          if (cx < 0 || cx >= W) ok = false;
          byRow[c[1]] = (byRow[c[1]] || 0) | (1 << cx);
        });
        if (!ok) { PM[t][r][x + 3] = null; continue; }
        var dys = Object.keys(byRow).map(Number).sort(function (a, b) { return a - b; });
        PM[t][r][x + 3] = { dys: dys, masks: dys.map(function (d) { return byRow[d]; }), maxDy: dys[dys.length - 1], minDy: dys[0] };
      }
    }
  });

  function pm(type, rot, x) {
    if (x < -3 || x >= W) return null;
    return PM[type][rot][x + 3];
  }

  function fits(rows, type, rot, x, y) {
    var p = pm(type, rot, x);
    if (!p) return false;
    if (y + p.minDy < 0 || y + p.maxDy >= H) return false;
    for (var i = 0; i < p.dys.length; i++) {
      if (rows[y + p.dys[i]] & p.masks[i]) return false;
    }
    return true;
  }

  function dropY(rows, type, rot, x, y) {
    while (fits(rows, type, rot, x, y + 1)) y++;
    return y;
  }

  function cellsOf(type, rot, x, y) {
    return SHAPES[type][rot].map(function (c) { return [x + c[0], y + c[1]]; });
  }

  function emptyRows() { return new Int32Array(H); }

  // ---------- placements ----------

  // Every spot the bot can reach: rotate at the spawn spot, slide sideways, hard drop.
  function placements(rows, type, opts) {
    var out = [];
    var seen = {};
    if (!fits(rows, type, 0, SPAWN_X, 0)) return out;
    var rots = opts && opts.spinLock ? [0] : [0, 1, 2, 3];
    for (var ri = 0; ri < rots.length; ri++) {
      var r = rots[ri];
      var path = ROT_PATH[r];
      var blocked = false;
      for (var k = 0; k < path.length; k++) {
        if (!fits(rows, type, path[k], SPAWN_X, 0)) { blocked = true; break; }
      }
      if (blocked) continue;
      var xmin = SPAWN_X, xmax = SPAWN_X;
      while (fits(rows, type, r, xmin - 1, 0)) xmin--;
      while (fits(rows, type, r, xmax + 1, 0)) xmax++;
      for (var x = xmin; x <= xmax; x++) {
        var y = dropY(rows, type, r, x, 0);
        var p = pm(type, r, x);
        var key = '';
        for (var j = 0; j < p.dys.length; j++) key += (y + p.dys[j]) + ':' + p.masks[j] + ',';
        if (seen[key]) continue;
        seen[key] = true;
        out.push({ type: type, rot: r, x: x, y: y });
      }
    }
    return out;
  }

  // Lock a piece, clear full lines. Returns the new board and what happened.
  function lock(rows, type, rot, x, y) {
    var nr = rows.slice();
    var p = pm(type, rot, x);
    for (var i = 0; i < p.dys.length; i++) nr[y + p.dys[i]] |= p.masks[i];
    var out = new Int32Array(H);
    var w = H - 1;
    var cleared = 0;
    var clearedRows = [];
    for (var yy = H - 1; yy >= 0; yy--) {
      if (nr[yy] === FULL) { cleared++; clearedRows.push(yy); } else out[w--] = nr[yy];
    }
    var topOut = false;
    for (var h = 0; h < HIDDEN; h++) if (out[h]) topOut = true;
    var minY = y + p.minDy, maxY = y + p.maxDy;
    return {
      rows: out,
      cleared: cleared,
      clearedRows: clearedRows,
      topOut: topOut,
      landing: H - (minY + maxY) / 2
    };
  }

  // Push a junk row in from the bottom with one gap.
  function addJunk(rows, gap) {
    var out = new Int32Array(H);
    for (var y = 0; y < H - 1; y++) out[y] = rows[y + 1];
    out[H - 1] = FULL & ~(1 << gap);
    var topOut = rows[0] !== 0;
    for (var h = 0; h < HIDDEN; h++) if (out[h]) topOut = true;
    return { rows: out, topOut: topOut };
  }

  // ---------- board features ----------

  function features(rows) {
    var holes = 0, colT = 0, rowT = 0, wells = 0;
    var covered = 0, prev = 0;
    var depth = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    var heights = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    var seen = 0;
    var holeRows = 0;
    var WALLS = (1 << (W + 1)) | 1;
    var M = (1 << (W + 1)) - 1;
    for (var y = 0; y < H; y++) {
      var r = rows[y];
      var fresh = r & ~seen;
      if (fresh) {
        for (var x = 0; x < W; x++) if (fresh & (1 << x)) heights[x] = H - y;
        seen |= r;
      }
      var rowHoles = covered & ~r & FULL;
      if (rowHoles) { holes += POP[rowHoles]; holeRows++; }
      covered |= r;
      colT += POP[(r ^ prev) & FULL];
      prev = r;
      var v = (r << 1) | WALLS;
      rowT += POP[(v ^ (v >> 1)) & M];
      var well = ~r & ((r << 1) | 1) & ((r >> 1) | (1 << (W - 1))) & FULL;
      for (var c = 0; c < W; c++) {
        if (well & (1 << c)) { depth[c]++; wells += depth[c]; } else depth[c] = 0;
      }
    }
    colT += POP[(prev ^ FULL) & FULL];
    var agg = 0, bump = 0, maxH = 0;
    for (var k = 0; k < W; k++) {
      agg += heights[k];
      if (heights[k] > maxH) maxH = heights[k];
      if (k < W - 1) bump += Math.abs(heights[k] - heights[k + 1]);
    }
    return { holes: holes, holeRows: holeRows, colT: colT, rowT: rowT, wells: wells, heights: heights, agg: agg, bump: bump, maxH: maxH };
  }

  // El-Tetris weights (Islam El-Ashi), a refinement of Pierre Dellacherie's evaluator.
  function evalStrong(res) {
    var f = features(res.rows);
    return -4.500158825082766 * res.landing + 3.4181268101392694 * res.cleared
      - 3.2178882868487753 * f.rowT - 9.348695305445199 * f.colT
      - 7.899265427351652 * f.holes - 3.3855972247263626 * f.wells;
  }

  // Yiyuan Lee's classic four-feature weights.
  function evalSolid(res) {
    var f = features(res.rows);
    return -0.510066 * f.agg + 0.760666 * res.cleared - 0.35663 * f.holes - 0.184483 * f.bump;
  }

  // A sloppy player: likes clearing lines and keeping low, barely notices holes.
  function evalSloppy(res) {
    var f = features(res.rows);
    return -0.35 * f.agg + 0.9 * res.cleared - 0.06 * f.holes - 0.05 * f.bump - 0.2 * res.landing;
  }

  // Deterministic noise in [0, 1) so previews match what the bot really does.
  function hashNoise(a, b, c, d) {
    var h = 2166136261 >>> 0;
    var vals = [a, b, c, d];
    for (var i = 0; i < vals.length; i++) {
      h ^= (vals[i] + 1013) & 0xffff;
      h = Math.imul(h, 16777619) >>> 0;
      h ^= h >>> 13;
    }
    return (h >>> 0) / 4294967296;
  }

  var LOSS = -1e9;

  var BOTS = {
    pip: {
      score: function (res, pl, ctx) {
        return evalSloppy(res) + 2.4 * hashNoise(ctx.turn, pl.rot, pl.x, TYPES.indexOf(pl.type));
      }
    },
    gridlock: {
      score: function (res) { return evalSolid(res); }
    },
    // Looks at the two cards left in your hand.
    monolith: {
      lookahead: true,
      lookWeight: 0.5,
      score: function (res) { return evalStrong(res); }
    },
    // Looks at your whole next hand, including the card you are about to draw.
    edith: {
      lookahead: true,
      lookWeight: 1,
      knowsDeck: true,
      score: function (res) { return evalStrong(res); }
    }
  };

  function bestScore(rows, type, bot, ctx) {
    var ps = placements(rows, type, null);
    var best = LOSS * 2;
    for (var i = 0; i < ps.length; i++) {
      var res = lock(rows, type, ps[i].rot, ps[i].x, ps[i].y);
      var s = res.topOut ? LOSS : bot.score(res, ps[i], ctx);
      if (s > best) best = s;
    }
    return best;
  }

  /*
   * The bot's move. ctx = { turn, spinLock, remaining: [types the player still holds] }.
   * The Grandmaster also looks at the cards left in your hand and plays as if you
   * will hand it the worst one next.
   */
  function decide(rows, type, botId, ctx) {
    var bot = BOTS[botId];
    ctx = ctx || {};
    var ps = placements(rows, type, { spinLock: !!ctx.spinLock });
    if (!ps.length) {
      // Cannot even spawn: show the piece stuck at the top.
      return { placement: { type: type, rot: 0, x: SPAWN_X, y: 0 }, result: lock(rows, type, 0, SPAWN_X, 0), forced: true };
    }
    var nextTypes = [];
    if (bot.lookahead && ctx.remaining) {
      ctx.remaining.forEach(function (t) { if (nextTypes.indexOf(t) < 0) nextTypes.push(t); });
    }
    var best = null, bestS = -Infinity;
    for (var i = 0; i < ps.length; i++) {
      var pl = ps[i];
      var res = lock(rows, type, pl.rot, pl.x, pl.y);
      var s;
      if (res.topOut) {
        s = LOSS + res.landing * -1; // if every option loses, at least stay low
      } else {
        s = bot.score(res, pl, ctx);
        if (nextTypes.length) {
          var worst = Infinity;
          for (var n = 0; n < nextTypes.length; n++) {
            var b = bestScore(res.rows, nextTypes[n], bot, ctx);
            if (b < worst) worst = b;
          }
          s += (bot.lookWeight || 0.5) * worst;
        }
      }
      if (s > bestS) { bestS = s; best = { placement: pl, result: res }; }
    }
    // Shove: after the bot picks its spot, the piece gets bumped one column.
    if (ctx.shove) {
      var bp = best.placement;
      var nx = bp.x + ctx.shove;
      if (fits(rows, type, bp.rot, bp.x, 0) && fits(rows, type, bp.rot, nx, 0)) {
        var ny = dropY(rows, type, bp.rot, nx, 0);
        best = {
          placement: { type: type, rot: bp.rot, x: nx, y: ny },
          result: lock(rows, type, bp.rot, nx, ny),
          intended: bp,
          shoved: true
        };
      } else {
        best.shoveBlocked = true;
      }
    }
    return best;
  }

  // ---------- randomness and the deck ----------

  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // 7-bag deck: every 7 cards contain each piece once.
  function Deck(seed) {
    this.rand = rng(seed);
    this.bag = [];
  }
  Deck.prototype.peek = function () {
    var t = this.draw();
    this.bag.unshift(t);
    return t;
  };
  Deck.prototype.draw = function () {
    if (!this.bag.length) {
      var b = TYPES.slice();
      for (var i = b.length - 1; i > 0; i--) {
        var j = Math.floor(this.rand() * (i + 1));
        var t = b[i]; b[i] = b[j]; b[j] = t;
      }
      this.bag = b;
    }
    return this.bag.shift();
  };

  var api = {
    W: W, H: H, HIDDEN: HIDDEN, FULL: FULL, SPAWN_X: SPAWN_X,
    TYPES: TYPES, SHAPES: SHAPES, ROT_PATH: ROT_PATH, BOTS: BOTS,
    fits: fits, dropY: dropY, cellsOf: cellsOf, emptyRows: emptyRows,
    placements: placements, lock: lock, addJunk: addJunk,
    features: features, evalStrong: evalStrong, decide: decide,
    rng: rng, Deck: Deck
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.BTB = api;
})(typeof window !== 'undefined' ? window : this);
