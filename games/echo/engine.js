/*
 * Echo engine: a pitch-black maze. You only learn its walls by pinging (sound travels along the corridors
 * and comes back off the walls) or by bumping into them. Find the keycards, then the exit, before your
 * steps run out, while the robot maze keeper quietly moves walls behind you.
 * Pure logic, CommonJS (the dev scripts use it too).
 */
(function (global) {
  'use strict';

  var DIRS = { up: [0, -1], right: [1, 0], down: [0, 1], left: [-1, 0] };
  var DIR_LIST = ['up', 'right', 'down', 'left'];

  /*
   * keys: keycards to collect. pings: how many pings you get. radius: how far a ping travels along corridors.
   * fade: moves before an echo fades from your screen. shift: the keeper moves a wall every this many steps.
   * slack: extra steps beyond the shortest route. brain: random, far (never near you, never twice in a row),
   * trail (re-walls the corridors you already walked), block (Edith: alternates trail walls with walling your
   * route ahead, but only when it heard you recently, and never closer than 3 cells to you).
   */
  var LEVELS = {
    pip: { w: 11, h: 7, keys: 2, pings: 16, radius: 6, fade: 12, shift: 9, slack: 2.2, braid: 0.3, brain: 'random' },
    gridlock: { w: 13, h: 8, keys: 3, pings: 12, radius: 5, fade: 8, shift: 7, slack: 1.75, braid: 0.25, brain: 'far' },
    monolith: { w: 15, h: 9, keys: 3, pings: 10, radius: 5, fade: 6, shift: 6, slack: 1.6, braid: 0.25, brain: 'trail' },
    edith: { w: 15, h: 9, keys: 3, pings: 10, radius: 5, fade: 4, shift: 6, slack: 1.6, braid: 0.2, brain: 'block' }
  };

  function Rng(seed) { this.a = seed >>> 0; }
  Rng.prototype.next = function () {
    this.a = (this.a + 0x6D2B79F5) >>> 0;
    var t = this.a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  Rng.prototype.int = function (a, b) { return a + Math.floor(this.next() * (b - a + 1)); };

  function Maze(levelId, seed) {
    var c = LEVELS[levelId];
    this.level = levelId;
    this.cfg = c;
    this.W = c.w;
    this.H = c.h;
    this.rng = new Rng(seed || 1);
    // E[i]: wall between cell i and its right neighbour; S[i]: wall between cell i and the cell below
    this.E = new Uint8Array(this.W * this.H).fill(1);
    this.S = new Uint8Array(this.W * this.H).fill(1);
    this.carve();
    this.place();
    this.moves = 0;
    this.stepsLeft = this.budget;
    this.pingsLeft = c.pings;
    this.memory = {};        // edge key -> { wall, at } as you last sensed it (it may be out of date)
    this.seen = new Uint8Array(this.W * this.H);
    this.trail = [this.cell(this.pos.x, this.pos.y)];
    this.heard = null;       // where the keeper last heard you: { x, y, at }
    this.lastShift = null;
    this.over = false;
    this.result = null;
    this.events = [];
    this.seen[this.cell(this.pos.x, this.pos.y)] = 1;
  }

  var P = Maze.prototype;

  P.cell = function (x, y) { return y * this.W + x; };
  P.inside = function (x, y) { return x >= 0 && y >= 0 && x < this.W && y < this.H; };

  // Wall between (x, y) and its neighbour in direction d. Borders are always walls.
  P.edge = function (x, y, d) {
    var v = DIRS[d], nx = x + v[0], ny = y + v[1];
    if (!this.inside(nx, ny)) return null;
    if (d === 'right') return { arr: 'E', i: this.cell(x, y) };
    if (d === 'left') return { arr: 'E', i: this.cell(nx, ny) };
    if (d === 'down') return { arr: 'S', i: this.cell(x, y) };
    return { arr: 'S', i: this.cell(nx, ny) };
  };
  P.wall = function (x, y, d) {
    var e = this.edge(x, y, d);
    return e ? !!this[e.arr][e.i] : true;
  };
  P.key = function (e) { return e.arr + e.i; };

  P.carve = function () {
    var W = this.W, H = this.H, r = this.rng, seen = new Uint8Array(W * H), stack = [[0, 0]];
    seen[0] = 1;
    while (stack.length) {
      var top = stack[stack.length - 1], x = top[0], y = top[1], opts = [];
      for (var k = 0; k < 4; k++) {
        var d = DIR_LIST[k], v = DIRS[d], nx = x + v[0], ny = y + v[1];
        if (this.inside(nx, ny) && !seen[this.cell(nx, ny)]) opts.push(d);
      }
      if (!opts.length) { stack.pop(); continue; }
      var dir = opts[r.int(0, opts.length - 1)], vv = DIRS[dir], e = this.edge(x, y, dir);
      this[e.arr][e.i] = 0;
      seen[this.cell(x + vv[0], y + vv[1])] = 1;
      stack.push([x + vv[0], y + vv[1]]);
    }
    // knock out some extra walls so there is more than one way around
    var interior = this.interiorWalls(), n = Math.round(interior.length * this.cfg.braid * 0.35);
    for (var j = 0; j < n; j++) {
      var w = interior[r.int(0, interior.length - 1)];
      this[w.arr][w.i] = 0;
    }
  };

  P.interiorWalls = function (open) {
    var out = [], W = this.W, H = this.H;
    for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) {
      var i = this.cell(x, y);
      if (x < W - 1 && !!this.E[i] === !open) out.push({ arr: 'E', i: i });
      if (y < H - 1 && !!this.S[i] === !open) out.push({ arr: 'S', i: i });
    }
    return out;
  };

  // Shortest-path distances from (x, y) through open passages.
  P.dist = function (x, y) {
    var W = this.W, d = new Int16Array(W * this.H).fill(-1), q = [this.cell(x, y)], head = 0;
    d[q[0]] = 0;
    while (head < q.length) {
      var u = q[head++], ux = u % W, uy = (u / W) | 0;
      for (var k = 0; k < 4; k++) {
        var dir = DIR_LIST[k];
        if (this.wall(ux, uy, dir)) continue;
        var v = DIRS[dir], n = this.cell(ux + v[0], uy + v[1]);
        if (d[n] < 0) { d[n] = d[u] + 1; q.push(n); }
      }
    }
    return d;
  };

  P.place = function () {
    var r = this.rng, W = this.W, H = this.H, c = this.cfg;
    var corners = [[0, 0], [W - 1, 0], [0, H - 1], [W - 1, H - 1]];
    var start = corners[r.int(0, 3)];
    this.pos = { x: start[0], y: start[1] };
    var fromStart = this.dist(start[0], start[1]), far = 0;
    for (var i = 0; i < W * H; i++) if (fromStart[i] > fromStart[far]) far = i;
    this.exit = { x: far % W, y: (far / W) | 0 };
    var fromExit = this.dist(this.exit.x, this.exit.y);
    this.keys = [];
    var guard = 0;
    while (this.keys.length < c.keys && guard++ < 2000) {
      var k = r.int(0, W * H - 1);
      if (fromStart[k] < 4 || fromExit[k] < 3) continue;
      var ok = true;
      for (var j = 0; j < this.keys.length; j++) {
        var o = this.keys[j];
        if (Math.abs(o.x - k % W) + Math.abs(o.y - ((k / W) | 0)) < 4) ok = false;
      }
      if (ok) this.keys.push({ x: k % W, y: (k / W) | 0, got: false, known: false });
    }
    this.exitKnown = false;
    this.budget = Math.ceil(this.bestRoute() * c.slack) + 6;
  };

  // Shortest tour from where you stand through the keys you still need, then out of the exit.
  P.bestRoute = function () {
    var pts = [this.pos].concat(this.keys.filter(function (k) { return !k.got; })), self = this;
    var dists = pts.map(function (p) { return self.dist(p.x, p.y); });
    var exitI = this.cell(this.exit.x, this.exit.y);
    var best = Infinity;
    function go(at, left, total) {
      if (!left.length) { best = Math.min(best, total + dists[at][exitI]); return; }
      for (var j = 0; j < left.length; j++) {
        var nxt = left[j], p = pts[nxt];
        go(nxt, left.slice(0, j).concat(left.slice(j + 1)), total + dists[at][self.cell(p.x, p.y)]);
      }
    }
    go(0, pts.map(function (_, i) { return i; }).slice(1), 0);
    return best;
  };

  P.remember = function (x, y, d, at) {
    var e = this.edge(x, y, d);
    if (!e) return;
    this.memory[this.key(e)] = { wall: !!this[e.arr][e.i], at: at, arr: e.arr, i: e.i };
  };

  /* One step. Returns { moved, bump }. */
  P.move = function (d) {
    if (this.over || !DIRS[d]) return null;
    this.stepsLeft--;
    this.moves++;
    var res;
    if (this.wall(this.pos.x, this.pos.y, d)) {
      this.remember(this.pos.x, this.pos.y, d, this.moves);
      this.events.push({ type: 'bump', dir: d });
      if (this.cfg.brain === 'block') this.heard = { x: this.pos.x, y: this.pos.y, at: this.moves };
      res = { moved: false, bump: true };
    } else {
      var v = DIRS[d];
      this.pos = { x: this.pos.x + v[0], y: this.pos.y + v[1] };
      var ci = this.cell(this.pos.x, this.pos.y);
      this.seen[ci] = 1;
      this.trail.push(ci);
      if (this.trail.length > 40) this.trail.shift();
      this.pickUp();
      res = { moved: true, bump: false };
    }
    if (!this.over && this.moves % this.cfg.shift === 0) this.shiftWall();
    if (!this.over && this.stepsLeft <= 0) this.finish('lose');
    return res;
  };

  P.pickUp = function () {
    var p = this.pos, self = this;
    this.keys.forEach(function (k) {
      if (!k.got && k.x === p.x && k.y === p.y) {
        k.got = true;
        k.known = true;
        self.events.push({ type: 'key', left: self.keys.filter(function (q) { return !q.got; }).length });
      }
    });
    if (p.x === this.exit.x && p.y === this.exit.y) {
      this.exitKnown = true;
      if (this.keys.every(function (k) { return k.got; })) this.finish('win');
      else this.events.push({ type: 'locked' });
    }
  };

  /* A ping: sound runs along open corridors up to the radius and reports every wall and item it reaches. */
  P.ping = function () {
    if (this.over || this.pingsLeft <= 0) return null;
    this.pingsLeft--;
    var W = this.W, R = this.cfg.radius, d = new Int16Array(W * this.H).fill(-1), start = this.cell(this.pos.x, this.pos.y), q = [start], head = 0, reached = [];
    d[start] = 0;
    while (head < q.length) {
      var u = q[head++], ux = u % W, uy = (u / W) | 0;
      reached.push(u);
      for (var k = 0; k < 4; k++) {
        var dir = DIR_LIST[k];
        this.remember(ux, uy, dir, this.moves);
        if (d[u] >= R || this.wall(ux, uy, dir)) continue;
        var v = DIRS[dir], n = this.cell(ux + v[0], uy + v[1]);
        if (d[n] < 0) { d[n] = d[u] + 1; q.push(n); }
      }
    }
    var self = this, found = [];
    reached.forEach(function (u) {
      self.seen[u] = 1;
      self.keys.forEach(function (key) { if (!key.got && !key.known && self.cell(key.x, key.y) === u) { key.known = true; found.push('key'); } });
      if (!self.exitKnown && self.cell(self.exit.x, self.exit.y) === u) { self.exitKnown = true; found.push('exit'); }
    });
    this.heard = { x: this.pos.x, y: this.pos.y, at: this.moves };
    this.events.push({ type: 'ping', reached: reached, dist: d, found: found });
    return { reached: reached, found: found };
  };

  // ---------- the maze keeper ----------

  P.nearPlayer = function (e) {
    var a = e.i, ax = a % this.W, ay = (a / this.W) | 0;
    var bx = e.arr === 'E' ? ax + 1 : ax, by = e.arr === 'S' ? ay + 1 : ay;
    var px = this.pos.x, py = this.pos.y;
    return Math.max(Math.abs(ax - px), Math.abs(ay - py)) < 2 || Math.max(Math.abs(bx - px), Math.abs(by - py)) < 2;
  };

  P.connectedAll = function () {
    var d = this.dist(this.pos.x, this.pos.y);
    for (var i = 0; i < d.length; i++) if (d[i] < 0) return false;
    return true;
  };

  // The next thing you are after: the nearest keycard you still need, else the exit.
  P.goalFrom = function (x, y) {
    var d = this.dist(x, y), best = null, bd = Infinity, self = this;
    this.keys.forEach(function (k) { if (!k.got) { var v = d[self.cell(k.x, k.y)]; if (v >= 0 && v < bd) { bd = v; best = k; } } });
    return best || this.exit;
  };

  P.pathEdges = function (from, to) {
    var d = this.dist(to.x, to.y), x = from.x, y = from.y, out = [], guard = 0;
    while ((x !== to.x || y !== to.y) && guard++ < 500) {
      var here = d[this.cell(x, y)], moved = false;
      for (var k = 0; k < 4 && !moved; k++) {
        var dir = DIR_LIST[k];
        if (this.wall(x, y, dir)) continue;
        var v = DIRS[dir], n = this.cell(x + v[0], y + v[1]);
        if (d[n] === here - 1) { out.push(this.edge(x, y, dir)); x += v[0]; y += v[1]; moved = true; }
      }
      if (!moved) break;
    }
    return out;
  };

  P.shiftWall = function () {
    var c = this.cfg, r = this.rng, self = this;
    var closable = this.interiorWalls(true).filter(function (e) { return !self.nearPlayer(e); });
    var openable = this.interiorWalls(false).filter(function (e) { return !self.nearPlayer(e); });
    if (!closable.length || !openable.length) return;
    var choices = [];
    this.shifts = (this.shifts || 0) + 1;
    // Edith alternates: block the route ahead (only with a fresh sound to go on), otherwise re-wall your trail
    var blockNow = c.brain === 'block' && this.heard && this.moves - this.heard.at <= c.shift && this.shifts % 2 === 0;
    if (c.brain === 'trail' || (c.brain === 'block' && !blockNow)) {
      var onTrail = {};
      for (var t = 1; t < this.trail.length - 3; t++) {
        var a = this.trail[t - 1], b = this.trail[t], lo = Math.min(a, b), hi = Math.max(a, b);
        onTrail[(hi - lo === 1 ? 'E' : 'S') + lo] = true;
      }
      choices = closable.filter(function (e) { return onTrail[self.key(e)]; });
    } else if (blockNow) {
      // only fresh sounds count: go quiet and Edith is guessing from an old position
      var from = this.heard, goal = this.goalFrom(from.x, from.y);
      var onPath = {};
      this.pathEdges(from, goal).forEach(function (e) { onPath[self.key(e)] = true; });
      choices = closable.filter(function (e) {
        var x = e.i % self.W, y = (e.i / self.W) | 0;
        return onPath[self.key(e)] && Math.abs(x - goal.x) + Math.abs(y - goal.y) >= 2 &&
          Math.abs(x - self.pos.x) + Math.abs(y - self.pos.y) >= 3;
      });
    } else if (c.brain === 'far') {
      choices = closable.filter(function (e) {
        var x = e.i % self.W, y = (e.i / self.W) | 0;
        return Math.abs(x - self.pos.x) + Math.abs(y - self.pos.y) >= 4 && (!self.lastShift || self.key(e) !== self.lastShift);
      });
    }
    if (!choices.length) choices = closable;
    // try a few candidates; the first that keeps every cell reachable wins (Edith keeps the meanest one)
    var best = null, bestCost = -Infinity;
    for (var attempt = 0; attempt < (blockNow ? 4 : 12); attempt++) {
      var close = choices[r.int(0, choices.length - 1)], open = openable[r.int(0, openable.length - 1)];
      this[close.arr][close.i] = 1;
      this[open.arr][open.i] = 0;
      if (this.connectedAll()) {
        var cost = 0;
        if (blockNow) {
          var g = this.goalFrom(this.heard.x, this.heard.y), dd = this.dist(this.heard.x, this.heard.y);
          cost = dd[this.cell(g.x, g.y)];
        }
        if (cost > bestCost) { bestCost = cost; best = { close: close, open: open }; }
        if (!blockNow) { this[close.arr][close.i] = 0; this[open.arr][open.i] = 1; break; }
      }
      this[close.arr][close.i] = 0;
      this[open.arr][open.i] = 1;
    }
    if (!best) return;
    this[best.close.arr][best.close.i] = 1;
    this[best.open.arr][best.open.i] = 0;
    this.lastShift = this.key(best.close);
    this.events.push({ type: 'shift', close: best.close, open: best.open });
  };

  P.finish = function (res) {
    this.over = true;
    this.result = res;
    this.events.push({ type: 'end', result: res });
  };

  P.keysLeft = function () { return this.keys.filter(function (k) { return !k.got; }).length; };

  var EC = { DIRS: DIRS, DIR_LIST: DIR_LIST, LEVELS: LEVELS, Maze: Maze, Rng: Rng };
  if (typeof module !== 'undefined' && module.exports) module.exports = EC;
  else global.EC = EC;
})(typeof window !== 'undefined' ? window : this);
