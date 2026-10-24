/*
 * Coffee Spill engine: a falling-liquid cellular automaton on a desk.
 * The robot rides a coffee pot along the top and pours; you draw ink walls to steer the coffee
 * into mugs and away from the laptop. Pure logic, no DOM. window.CS in the browser, module.exports in Node.
 */
(function (global) {
  'use strict';

  var W = 120, H = 80;
  var EMPTY = 0, WALL = 1, INK = 2, COFFEE = 3, MUG = 4, LAPTOP = 5, PHONE = 6, FULL = 7;

  /*
   * ink: cells of wall you can draw. pot: drops in the pot. rate: drops per tick. speed: cells the pot slides per tick.
   * brain: wobble (drifts at random), hover (creeps over the laptop), trace (follows where coffee would flow),
   * scheme (traces several paths at once and re-plans often). limit: drops the laptop survives.
   * plan: seconds to draw before the pot tips. stars: mug drops needed for 2 and 3 stars. books: [x, y, w, h] before the per-game shuffle.
   */
  var LEVELS = {
    pip: { ink: 300, plan: 25, pot: 1300, rate: 2, speed: 0.12, brain: 'wobble', limit: 50, stars: [200, 330], laptopW: 30, gap: 7, phone: null,
      books: [[30, 40, 14, 6], [86, 34, 12, 8]] },
    gridlock: { ink: 240, plan: 20, pot: 1400, rate: 2, speed: 0.2, brain: 'hover', limit: 55, stars: [200, 320], laptopW: 34, gap: 6, phone: null,
      books: [[26, 38, 16, 6], [80, 38, 16, 6], [56, 24, 8, 10]] },
    monolith: { ink: 170, plan: 16, pot: 1500, rate: 2, speed: 0.3, brain: 'trace', limit: 45, stars: [200, 310], laptopW: 36, gap: 5, phone: null,
      books: [[22, 46, 16, 5], [82, 46, 16, 5], [51, 30, 18, 5], [8, 30, 10, 8]] },
    edith: { ink: 130, plan: 14, pot: 1500, rate: 2, speed: 0.42, brain: 'scheme', limit: 35, stars: [200, 300], laptopW: 36, gap: 5,
      phone: { y: 56, w: 12, h: 4, min: 2, max: 118, every: 3 },
      books: [[24, 40, 16, 5], [80, 40, 16, 5], [51, 28, 18, 5]] }
  };

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
  function idx(x, y) { return y * W + x; }

  function Desk(levelId, seed) {
    var c = LEVELS[levelId];
    this.level = levelId;
    this.cfg = c;
    this.rand = rng(seed || 1);
    this.cell = new Uint8Array(W * H);
    this.owner = new Int8Array(W * H).fill(-1);  // which mug a MUG cell belongs to
    this.moved = new Uint8Array(W * H);
    this.dir = new Int8Array(W * H);             // which way each drop is sliding
    this.objects = [];
    var self = this, r = this.rand;
    function jit(n) { return Math.round((r() - 0.5) * 2 * n); }
    this.fill(0, H - 1, W, 1, WALL);
    // each desk is a little different: books, mugs and the laptop shift around
    var lw = c.laptopW, lx = Math.round(W / 2 - lw / 2) + jit(4), mw = 15, mh = 16;
    this.mugs = [lx - c.gap - mw, lx + lw + c.gap].map(function (mx, i) {
      var x = mx, y = H - 1 - mh, w = mw, h = mh;
      self.fill(x, y, 2, h, WALL); self.fill(x + w - 2, y, 2, h, WALL); self.fill(x, y + h - 2, w, 2, WALL);
      self.fill(x + 2, y, w - 4, h - 2, MUG);
      for (var yy = y; yy < y + h - 2; yy++) for (var xx = x + 2; xx < x + w - 2; xx++) self.owner[idx(xx, yy)] = i;
      return { x: x, y: y, w: w, h: h, fill: 0, cap: (w - 4) * (h - 2), extra: 0 };
    });
    c.books.forEach(function (b) {
      var bx = b[0] + jit(5), by = b[1] + jit(3);
      self.fill(bx, by, b[2], b[3], WALL);
      self.objects.push({ kind: b[2] <= 10 ? 'stapler' : 'books', x: bx, y: by, w: b[2], h: b[3] });
    });
    var lh = 15;
    this.fill(lx, H - 1 - lh, lw, lh, LAPTOP);
    this.laptop = { x: lx, y: H - 1 - lh, w: lw, h: lh, hits: 0 };
    this.phone = c.phone ? { x: 10 + Math.floor(r() * 80), y: c.phone.y, w: c.phone.w, h: c.phone.h, vx: r() < 0.5 ? -1 : 1, tick: 0 } : null;
    if (this.phone) this.fill(this.phone.x, this.phone.y, this.phone.w, this.phone.h, PHONE);
    this.ink = c.ink;          // ink left in your pen
    this.pot = c.pot;          // drops left in the pot
    this.potX = 20 + Math.floor(r() * 80);
    this.potTarget = this.potX;
    this.pouring = false;
    this.t = 0;
    this.caught = 0;
    this.spilled = 0;
    this.smudged = 0;
    this.calm = 0;
    this.over = false;
    this.result = null;
    this.events = [];
    this.plan = null;
  }

  var P = Desk.prototype;

  P.fill = function (x, y, w, h, v) {
    for (var yy = y; yy < y + h; yy++) for (var xx = x; xx < x + w; xx++) if (xx >= 0 && yy >= 0 && xx < W && yy < H) this.cell[idx(xx, yy)] = v;
  };
  P.at = function (x, y) { return x < 0 || y < 0 || x >= W || y >= H ? -1 : this.cell[idx(x, y)]; };

  // Ink is drawn with a 2 by 2 nib so even diagonal lines hold water.
  P.draw = function (x, y) {
    var used = 0;
    for (var dy = 0; dy < 2; dy++) for (var dx = 0; dx < 2; dx++) {
      var xx = x + dx, yy = y + dy;
      if (xx < 0 || yy < 3 || xx >= W || yy >= H || this.ink <= 0) continue;
      var c = idx(xx, yy);
      if (this.cell[c] === EMPTY) { this.cell[c] = INK; this.ink--; used++; }
    }
    return used;
  };
  P.erase = function (x, y, r) {
    var got = 0;
    for (var yy = y - r; yy <= y + r; yy++) for (var xx = x - r; xx <= x + r; xx++) {
      if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
      var c = idx(xx, yy);
      if (this.cell[c] === INK) { this.cell[c] = EMPTY; this.ink++; got++; }
    }
    return got;
  };
  P.inkUsed = function () { return this.cfg.ink - this.ink - this.smudged; };

  P.start = function () { if (!this.pouring && !this.over) { this.pouring = true; this.events.push({ type: 'pour' }); } };

  // ---------- the robot's pouring brain ----------

  // Follows one drop from x along the top to where it ends up: 'laptop', 'mug', 'off' or 'stuck'.
  P.trace = function (x, lean) {
    var y = 2, d = lean || 1, steps = 0, cell = this.cell;
    while (steps++ < 600) {
      if (y + 1 >= H) return { where: 'off', x: x, steps: steps };
      var b = cell[idx(x, y + 1)];
      if (b === LAPTOP) return { where: 'laptop', x: x, steps: steps };
      if (b === MUG) return { where: 'mug', x: x, steps: steps };
      if (b === EMPTY || b === COFFEE) { y++; continue; }
      var moved = false;
      for (var k = 0; k < 2 && !moved; k++) {
        var dd = k ? -d : d, nx = x + dd;
        if (nx < 0 || nx >= W) return { where: 'off', x: x, steps: steps };
        var s = cell[idx(nx, y)], sd = cell[idx(nx, y + 1)];
        if (sd === LAPTOP && s === EMPTY) return { where: 'laptop', x: nx, steps: steps };
        if (sd === MUG && s === EMPTY) return { where: 'mug', x: nx, steps: steps };
        if (s === EMPTY && (sd === EMPTY || sd === COFFEE)) { x = nx; y++; d = dd; moved = true; }
      }
      if (moved) continue;
      // slide along the surface
      var nx2 = x + d;
      if (nx2 < 0 || nx2 >= W) return { where: 'off', x: x, steps: steps };
      if (cell[idx(nx2, y)] === LAPTOP) return { where: 'laptop', x: nx2, steps: steps };
      if (cell[idx(nx2, y)] === EMPTY || cell[idx(nx2, y)] === COFFEE) { x = nx2; continue; }
      d = -d;
      var nx3 = x + d;
      if (nx3 < 0 || nx3 >= W) return { where: 'off', x: x, steps: steps };
      if (cell[idx(nx3, y)] === LAPTOP) return { where: 'laptop', x: nx3, steps: steps };
      if (cell[idx(nx3, y)] === EMPTY || cell[idx(nx3, y)] === COFFEE) { x = nx3; continue; }
      return { where: 'stuck', x: x, steps: steps };
    }
    return { where: 'stuck', x: x, steps: steps };
  };

  P.score = function (x) {
    var lx = this.laptop.x + this.laptop.w / 2, total = 0;
    var tries = this.cfg.brain === 'scheme' ? [1, -1, 1, -1] : [lx > x ? 1 : -1];
    for (var i = 0; i < tries.length; i++) {
      var t = this.trace(x, tries[i]);
      total += t.where === 'laptop' ? 10 : t.where === 'mug' ? -1 : t.where === 'stuck' ? 1 : 0;
    }
    return total / tries.length - Math.abs(x - this.potX) * 0.01;
  };

  P.think = function () {
    var c = this.cfg, r = this.rand, lx = this.laptop.x + this.laptop.w / 2;
    if (c.brain === 'wobble') {
      // clumsy: drifts around somewhere near the laptop
      if (r() < 0.04) this.potTarget = Math.max(6, Math.min(W - 7, lx + (r() - 0.5) * 64));
    } else if (c.brain === 'hover') {
      if (this.t % 60 === 0) this.potTarget = lx + (r() - 0.5) * 24;
    } else if (this.t % (c.brain === 'scheme' ? 12 : 24) === 0) {
      var best = this.potX, bestS = -Infinity;
      for (var x = 2; x < W - 2; x += 2) {
        var s = this.score(x);
        if (s > bestS) { bestS = s; best = x; }
      }
      this.potTarget = best;
      this.plan = { x: best, good: bestS > 3 };
    }
    var d = this.potTarget - this.potX;
    this.potX += Math.max(-c.speed, Math.min(c.speed, d));
  };

  // ---------- one tick ----------

  P.step = function () {
    if (this.over) return;
    this.t++;
    var c = this.cfg, r = this.rand, cell = this.cell;
    if (this.pouring) {
      this.think();
      for (var k = 0; k < c.rate && this.pot > 0; k++) {
        var px = Math.round(this.potX) + (r() < 0.5 ? 0 : (r() < 0.5 ? -1 : 1));
        var pc = idx(px, 2);
        if (px >= 0 && px < W && cell[pc] === EMPTY) { cell[pc] = COFFEE; this.dir[pc] = r() < 0.5 ? -1 : 1; this.pot--; }
      }
    }
    this.flow();
    if (this.phone) this.movePhone();
    var caught = 0;
    this.mugs.forEach(function (m) { caught += m.fill; });
    this.caught = caught;
    if (this.laptop.hits >= c.limit) return this.finish('lose', 'laptop');
    if (this.pouring && this.pot <= 0) {
      // the pot is empty: the laptop survived once the last drops settle
      this.calm = this.active ? 0 : this.calm + 1;
      if (this.calm > 45) this.finish('win');
    }
  };

  P.flow = function () {
    var cell = this.cell, moved = this.moved, dir = this.dir, r = this.rand;
    moved.fill(0);
    var active = 0;
    for (var y = H - 1; y >= 0; y--) {
      var ltr = r() < 0.5;
      for (var i = 0; i < W; i++) {
        var x = ltr ? i : W - 1 - i, c = idx(x, y);
        if (cell[c] !== COFFEE || moved[c]) continue;
        if (y + 1 >= H) { cell[c] = EMPTY; this.spilled++; continue; }
        var below = idx(x, y + 1), b = cell[below];
        if (this.absorb(c, below, b)) { active++; continue; }
        if (b === EMPTY) { this.move(c, below); active++; continue; }
        var d = dir[c] || 1, done = false;
        for (var k = 0; k < 2 && !done; k++) {
          var dd = k ? -d : d, nx = x + dd;
          if (nx < 0 || nx >= W) { cell[c] = EMPTY; this.spilled++; done = true; active++; break; }
          var diag = idx(nx, y + 1), side = idx(nx, y);
          if (cell[side] === EMPTY && this.absorb(c, diag, cell[diag])) { done = true; active++; break; }
          if (cell[side] === EMPTY && cell[diag] === EMPTY) { this.move(c, diag); dir[diag] = dd; done = true; active++; }
        }
        if (done) continue;
        // spread sideways like a liquid
        for (var s = 0; s < 2 && !done; s++) {
          var sd = s ? -d : d, sx = x + sd;
          if (sx < 0 || sx >= W) { cell[c] = EMPTY; this.spilled++; done = true; active++; break; }
          var sc = idx(sx, y);
          if (cell[sc] === LAPTOP) { this.absorb(c, sc, LAPTOP); done = true; active++; break; }
          if (cell[sc] === EMPTY) { this.move(c, sc); dir[sc] = sd; done = true; if (r() < 0.6) active++; }
        }
      }
    }
    this.active = active > 2;
  };

  P.move = function (from, to) {
    this.cell[to] = COFFEE;
    this.cell[from] = EMPTY;
    this.moved[to] = 1;
    this.dir[to] = this.dir[from];
  };

  // A drop that reaches a mug or the laptop disappears into it.
  P.absorb = function (from, to, kind) {
    if (kind === MUG) {
      // mugs drink everything, but only count up to full
      var m = this.mugs[this.owner[to]];
      this.cell[from] = EMPTY;
      if (m.fill < m.cap) {
        m.fill++;
        if (m.fill === m.cap) this.events.push({ type: 'full', mug: this.mugs.indexOf(m) });
      } else m.extra++;
      return true;
    }
    if (kind === LAPTOP) {
      this.cell[from] = EMPTY;
      this.laptop.hits++;
      if (this.laptop.hits % 5 === 1) this.events.push({ type: 'zap', x: from % W, y: (from / W) | 0 });
      return true;
    }
    return false;
  };

  P.movePhone = function () {
    var ph = this.phone, c = this.cfg.phone;
    if (++ph.tick % c.every) return;
    var nx = ph.x + ph.vx;
    if (nx < c.min || nx + ph.w > c.max) { ph.vx = -ph.vx; return; }
    // clear old spot, then buzz into the new one
    for (var yy = ph.y; yy < ph.y + ph.h; yy++) for (var xx = ph.x; xx < ph.x + ph.w; xx++) if (this.cell[idx(xx, yy)] === PHONE) this.cell[idx(xx, yy)] = EMPTY;
    ph.x = nx;
    for (yy = ph.y; yy < ph.y + ph.h; yy++) for (xx = ph.x; xx < ph.x + ph.w; xx++) {
      var i = idx(xx, yy), v = this.cell[i];
      if (v === INK) { this.smudged++; this.events.push({ type: 'smudge', x: xx, y: yy }); }
      if (v === COFFEE) {
        var up = idx(xx, yy - 1);
        if (yy > 0 && this.cell[up] === EMPTY) this.cell[up] = COFFEE; else this.spilled++;
      }
      if (v === WALL || v === MUG || v === LAPTOP || v === FULL) continue;
      this.cell[i] = PHONE;
    }
  };

  P.finish = function (res, why) {
    this.over = true;
    this.result = res;
    this.why = why || null;
    this.events.push({ type: 'end', result: res, why: why });
  };

  P.ascii = function () {
    var ch = ['.', '#', '=', '~', 'm', 'L', 'P', 'M'], out = [];
    for (var y = 0; y < H; y++) {
      var row = '';
      for (var x = 0; x < W; x++) row += x === Math.round(this.potX) && y === 0 ? 'V' : ch[this.cell[idx(x, y)]];
      out.push(row);
    }
    return out.join('\n');
  };

  var CS = { W: W, H: H, EMPTY: EMPTY, WALL: WALL, INK: INK, COFFEE: COFFEE, MUG: MUG, LAPTOP: LAPTOP, PHONE: PHONE, FULL: FULL, LEVELS: LEVELS, Desk: Desk, rng: rng, idx: idx };
  if (typeof module !== 'undefined' && module.exports) module.exports = CS;
  else global.CS = CS;
})(typeof window !== 'undefined' ? window : this);
