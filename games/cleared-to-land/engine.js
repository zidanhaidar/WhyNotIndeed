/*
 * Cleared to Land engine: a busy little airport that never closes. Planes arrive and circle in holding patterns
 * until you clear them to land. They land on the runway, roll out, taxi to a gate of their tail color and let their
 * passengers off. Then they board and wait for you to push them back, taxi to the runway's holding point, and take off.
 * Only one plane may use the runway at a time: two planes meeting on it is a crash and ends the shift at once.
 * Complaints (five end the shift): a plane that runs low on fuel and diverts, a plane kept waiting at the gate or
 * at the holding point too long, and (Edith) her jet kept circling too long by a red runway light. Finishing a
 * mission takes one complaint back. Arrivals keep getting busier, so every shift ends sooner or later.
 * Pure logic, CommonJS (the dev scripts use it too).
 */
(function (global) {
  'use strict';

  var DT = 1 / 30;
  var STRIKES = 5;
  var STARS = [100, 260, 480]; // passengers delivered for one, two and three stars
  var COLORS = ['red', 'blue', 'green', 'yellow'];
  var SIZES = [
    { len: 1.0, span: 1.05, pax: [6, 10], name: 'small' },
    { len: 1.35, span: 1.35, pax: [12, 18], name: 'medium' },
    { len: 1.7, span: 1.7, pax: [20, 28], name: 'large' }
  ];
  var AIR = { speed: 3.0, turn: 1.35, holdR: 1.7, climb: 0.45 };
  var GROUND = { taxi: 1.6, push: 0.7, touch: 3.2, exit: 2.0, roll: 0.25, acc: 0.95, top: 4.4, rotate: 3.5, climb: 0.38, gap: 1.9 };
  var FINAL = 5.5; // length of the straight final approach

  /*
   * colors (gates two each), rate: [arrivals per second, extra per minute, most], fuel: seconds a plane can hold,
   * patience: seconds a plane waits ready at a gate or at the holding point before a complaint.
   * brain (the level's robot sends the arrivals): random, waves (bunches of three), aim (low-fuel planes turn up
   * while the runway is busy). jet: seconds between Edith's private jets (0: none); jetHold: seconds it will circle.
   */
  var LEVELS = {
    pip: { colors: 3, rate: [0.05, 0.012, 0.2], fuel: [100, 135], patience: 75, brain: 'random', jet: 0 },
    gridlock: { colors: 4, rate: [0.072, 0.018, 0.3], fuel: [80, 110], patience: 65, brain: 'waves', jet: 0 },
    monolith: { colors: 4, rate: [0.064, 0.016, 0.28], fuel: [80, 110], patience: 60, brain: 'aim', jet: 0 },
    edith: { colors: 4, rate: [0.056, 0.015, 0.26], fuel: [80, 110], patience: 60, brain: 'aim', jet: 60, jetHold: 24 }
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
  Rng.prototype.pick = function (arr) { return arr[Math.floor(this.next() * arr.length)]; };
  Rng.prototype.shuffle = function (arr) {
    for (var i = arr.length - 1; i > 0; i--) { var j = Math.floor(this.next() * (i + 1)), t = arr[i]; arr[i] = arr[j]; arr[j] = t; }
    return arr;
  };

  function angDiff(a, b) { var d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; }

  // ---------- paths ----------

  // rounds every corner of a polyline with a curve of about radius r
  function smooth(pts, r) {
    if (pts.length < 3) return pts.slice();
    var out = [pts[0]];
    for (var i = 1; i < pts.length - 1; i++) {
      var p = pts[i - 1], c = pts[i], n = pts[i + 1];
      var l1 = Math.hypot(c[0] - p[0], c[1] - p[1]), l2 = Math.hypot(n[0] - c[0], n[1] - c[1]);
      var rr = Math.min(r, l1 / 2, l2 / 2);
      if (rr < 0.01) { out.push(c); continue; }
      var a = [c[0] - (c[0] - p[0]) / l1 * rr, c[1] - (c[1] - p[1]) / l1 * rr], b = [c[0] + (n[0] - c[0]) / l2 * rr, c[1] + (n[1] - c[1]) / l2 * rr];
      for (var k = 0; k <= 8; k++) {
        var t = k / 8, u = 1 - t;
        out.push([u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]]);
      }
    }
    out.push(pts[pts.length - 1]);
    return out;
  }
  function Path(pts) {
    this.pts = pts;
    this.cum = [0];
    for (var i = 1; i < pts.length; i++) this.cum.push(this.cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    this.len = this.cum[this.cum.length - 1];
  }
  Path.prototype.at = function (s) {
    s = Math.max(0, Math.min(this.len, s));
    var lo = 0, hi = this.cum.length - 1;
    while (hi - lo > 1) { var mid = (lo + hi) >> 1; if (this.cum[mid] <= s) lo = mid; else hi = mid; }
    var seg = this.cum[hi] - this.cum[lo] || 1, f = (s - this.cum[lo]) / seg, p = this.pts[lo], q = this.pts[hi];
    return [p[0] + (q[0] - p[0]) * f, p[1] + (q[1] - p[1]) * f, Math.atan2(q[1] - p[1], q[0] - p[0])];
  };

  // ---------- the airport ----------

  function buildAirport(levelId, rng, aspect) {
    var cfg = LEVELS[levelId], land = aspect >= 1;
    var W = land ? Math.max(28, Math.min(40, Math.round(20 * aspect))) : 20;
    var H = land ? 20 : Math.max(28, Math.min(40, Math.round(20 / aspect)));
    var Lu = land ? W : H, C = [W / 2, H / 2], u = land ? [1, 0] : [0, 1], v = land ? [0, 1] : [1, 0];
    function P(a, b) { return [C[0] + a * u[0] + b * v[0], C[1] + a * u[1] + b * v[1]]; }
    var side = rng.next() < 0.5 ? 1 : -1;      // which side of the runway the terminal is on
    var dir = rng.next() < 0.5 ? 1 : -1;       // which way planes land (into the wind)
    var Lr = Math.min(Lu - 7, 26);
    var bR = -side * (2.6 + rng.next() * 1.2), bT = bR + side * 2.6, bS = bR + side * 5.0, bF = bR + side * 6.2, bB = bR + side * 7.9;
    var aT = -dir * (Lr / 2 - 1.2), aE = dir * (Lr / 2 - 1.0), aH = -dir * (Lr / 2 - 2.0), aL = -dir * (Lr / 2 - 0.6);
    var colors = rng.shuffle(COLORS.slice()).slice(0, cfg.colors);
    var n = colors.length * 2, span = Math.abs(aE - aH) - 2.6, sp = Math.min(2.5, span / n);
    var stands = [];
    for (var i = 0; i < n; i++) {
      var a = (aE + aH) / 2 + (i - (n - 1) / 2) * sp * -dir * -1;
      stands.push({ id: i, color: colors[Math.floor(i / 2)], a: a, x: P(a, bS)[0], y: P(a, bS)[1], by: -1, heading: Math.atan2(side * v[1], side * v[0]) });
    }
    // the holding patterns: two beyond the runway (one by the approach end), one over the terminal
    var holds = [P(-dir * Lu * 0.3, bR - side * 4.5), P(dir * Lu * 0.14, bR - side * 4.5), P(-dir * Lu * 0.06, bB + side * 0.9)].map(function (p, k) { return { id: k, x: p[0], y: p[1], r: AIR.holdR }; });
    var map = {
      W: W, H: H, u: u, v: v, C: C, side: side, dir: dir, Lr: Lr, bR: bR, bT: bT, bS: bS, bF: bF, bB: bB,
      aT: aT, aE: aE, aH: aH, aL: aL, stands: stands, holds: holds, colors: colors, P: P,
      thr: P(aT, bR), faf: P(aT - dir * FINAL, bR), runwayEnd: P(dir * Lr / 2, bR),
      hold: P(aH, bT), sp: sp
    };
    map.decor = scenery(map, rng);
    return map;
  }

  // things to look at around the field: trees beyond the fence, hangars and a car park by the terminal
  function scenery(m, rng) {
    var out = [], tries = 0;
    function clearOf(x, y, r) {
      // keep off the runway, taxiway, apron and terminal strip, and the map edge
      var dx = x - m.C[0], dy = y - m.C[1], a = dx * m.u[0] + dy * m.u[1], b = dx * m.v[0] + dy * m.v[1];
      var lo = Math.min(m.bR, m.bB) - 1.3, hi = Math.max(m.bR, m.bB) + 1.0;
      if (b > lo - r && b < hi + r && Math.abs(a) < m.Lr / 2 + 2.5 + r) return false;
      return !out.some(function (d) { return Math.hypot(d.x - x, d.y - y) < d.r + r + 0.15; });
    }
    while (out.length < 70 && tries++ < 900) {
      var x = rng.next() * m.W, y = rng.next() * m.H, big = rng.next() < 0.3, r = big ? 0.95 : 0.6;
      if (!clearOf(x, y, r)) continue;
      out.push({ x: x, y: y, r: r, kind: rng.next() < 0.22 ? 'pine' : rng.next() < 0.75 ? 'tree' : 'bush', hue: rng.int(0, 3) });
    }
    return out;
  }

  // ---------- the airport at work ----------

  function World(levelId, seed, aspect) {
    var cfg = LEVELS[levelId];
    this.level = levelId;
    this.cfg = cfg;
    this.rng = new Rng(seed || 1);
    this.map = buildAirport(levelId, this.rng, aspect || 1.6);
    this.colors = this.map.colors;
    this.t = 0;
    this.planes = [];
    this.nextId = 1;
    this.strikes = 0;
    this.delivered = 0;
    this.byColor = {};
    var self = this;
    this.colors.forEach(function (c) { self.byColor[c] = 0; });
    this.departed = 0;
    this.landed = 0;
    this.missionsDone = 0;
    this.over = false;
    this.reason = '';
    this.crash = null;
    this.events = [];
    this.wave = { left: 0, gap: 0 };
    this.jetT = cfg.jet ? cfg.jet * 0.8 : Infinity;
    this.runwayRed = false;
    this.newMission();
    // the first two planes are already circling, and one waits at a gate
    this.spawn(true); this.spawn(true);
    var st = this.map.stands[this.rng.int(0, this.map.stands.length - 1)];
    var p = this.makePlane(st.color, 1);
    p.state = 'ready'; p.alt = 0; p.x = st.x; p.y = st.y; p.h = st.heading; p.stand = st.id; st.by = p.id; p.readyT = 0;
    this.planes.push(p);
  }
  var W = World.prototype;

  W.makePlane = function (color, size) {
    var sz = SIZES[size], id = this.nextId++;
    return {
      id: id, kind: 'plane', color: color, size: size, spec: sz, pax: this.rng.int(sz.pax[0], sz.pax[1]),
      label: color.charAt(0).toUpperCase() + (10 + (id * 37) % 89), state: 'inbound', x: 0, y: 0, h: 0, alt: 1, v: AIR.speed,
      path: null, s: 0, fuel: 0, fuelMax: 1, hold: 0, theta: 0, stand: -1, readyT: 0, timer: 0, waitT: 0, final: false, stack: 0
    };
  };

  W.edgePoint = function () {
    var m = this.map, r = this.rng.next(), side = this.rng.int(0, 3);
    if (side === 0) return [r * m.W, -1.5];
    if (side === 1) return [m.W + 1.5, r * m.H];
    if (side === 2) return [r * m.W, m.H + 1.5];
    return [-1.5, r * m.H];
  };

  W.spawn = function (near) {
    var c = this.rng.pick(this.colors), size = this.rng.next() < 0.3 ? 0 : this.rng.next() < 0.65 ? 1 : 2;
    var p = this.makePlane(c, size), e = this.edgePoint(), cfg = this.cfg;
    p.hold = this.rng.int(0, this.map.holds.length - 1);
    var hf = this.map.holds[p.hold];
    if (near) { p.x = hf.x + hf.r; p.y = hf.y; p.state = 'hold'; p.theta = 0; } else { p.x = e[0]; p.y = e[1]; }
    p.h = Math.atan2(hf.y - p.y, hf.x - p.x);
    p.fuelMax = p.fuel = cfg.fuel[0] + this.rng.next() * (cfg.fuel[1] - cfg.fuel[0]);
    if (cfg.brain === 'aim' && this.runwayBusy()) p.fuel *= 0.7;
    this.planes.push(p);
    this.events.push({ type: 'arrive', plane: p.id });
    return p;
  };

  W.spawnJet = function () {
    var p = this.makePlane('pink', 0), e = this.edgePoint();
    p.kind = 'jet'; p.color = 'jet'; p.pax = 0; p.label = 'EDITH';
    p.x = e[0]; p.y = e[1];
    p.fuel = p.fuelMax = 999;
    this.approach(p);
    this.planes.push(p);
    this.events.push({ type: 'jet', plane: p.id });
  };

  W.plane = function (id) { return this.planes.find(function (p) { return p.id === id; }); };
  W.onRunway = function (p) {
    var m = this.map, dx = p.x - m.C[0], dy = p.y - m.C[1], a = dx * m.u[0] + dy * m.u[1], b = dx * m.v[0] + dy * m.v[1];
    return p.alt < 0.35 && Math.abs(b - m.bR) < 0.95 && Math.abs(a) < m.Lr / 2 + 1.2;
  };
  W.runwayBusy = function () {
    var self = this;
    return this.planes.some(function (p) { return self.onRunway(p) || p.state === 'lineup' || p.state === 'takeoff' || p.state === 'rollout' || (p.state === 'approach' && p.final); });
  };

  // ---------- commands ----------

  W.approach = function (p) {
    var m = this.map;
    p.state = 'approach'; p.final = false;
    p.path = new Path([[p.x, p.y], m.faf, m.thr]);
    p.s = 0;
  };
  W.clearToLand = function (id) {
    var p = this.plane(id);
    if (!p || this.over || p.kind !== 'plane' || !(p.state === 'hold' || p.state === 'inbound')) return false;
    this.approach(p);
    this.events.push({ type: 'cleared', plane: p.id });
    return true;
  };
  W.goAround = function (id) {
    var p = this.plane(id);
    if (!p || this.over || p.state !== 'approach' || p.alt < 0.12) return false;
    this.toHold(p);
    this.events.push({ type: 'goaround', plane: p.id });
    return true;
  };
  W.toHold = function (p) {
    var m = this.map, best = 0, bd = 1e9;
    m.holds.forEach(function (h, k) { var d = Math.hypot(h.x - p.x, h.y - p.y); if (d < bd) { bd = d; best = k; } });
    p.state = 'inbound'; p.hold = best; p.final = false; p.path = null;
  };
  W.pushBack = function (id) {
    var p = this.plane(id);
    if (!p || this.over || p.state !== 'ready') return false;
    p.state = 'push-wait';
    this.events.push({ type: 'pushback', plane: p.id });
    return true;
  };
  W.takeOff = function (id) {
    var p = this.plane(id);
    if (!p || this.over || p.state !== 'holdshort') return false;
    var m = this.map, P = m.P;
    var pts = smooth([[p.x, p.y], P(m.aL, m.bT), P(m.aL, m.bR), P(m.aL + m.dir * 1.2, m.bR)], 0.7);
    pts.push(P(m.dir * (m.Lr / 2 + 9), m.bR));
    p.path = new Path(pts); p.s = 0; p.v = 0.9;
    p.state = 'lineup';
    this.events.push({ type: 'takeoff', plane: p.id });
    return true;
  };
  W.toggleRunway = function () {
    if (!this.cfg.jet || this.over) return false;
    this.runwayRed = !this.runwayRed;
    this.events.push({ type: 'runway-light', red: this.runwayRed });
    return true;
  };

  // the default command for a plane: whatever it is waiting for
  W.command = function (id) {
    var p = this.plane(id);
    if (!p) return false;
    if (p.state === 'hold' || p.state === 'inbound') return this.clearToLand(id);
    if (p.state === 'approach') return this.goAround(id);
    if (p.state === 'ready') return this.pushBack(id);
    if (p.state === 'holdshort') return this.takeOff(id);
    return false;
  };

  // ---------- missions ----------

  W.newMission = function () {
    var n = this.missionsDone, cols = this.rng.shuffle(this.colors.slice()).slice(0, n < 2 ? 2 : 3);
    var total = 3 + n, need = {}, got = {};
    cols.forEach(function (c, i) { need[c] = Math.floor(total / cols.length) + (i < total % cols.length ? 1 : 0); got[c] = 0; });
    this.mission = { n: n + 1, need: need, got: got };
  };
  W.strike = function (why, data) {
    if (this.over) return;
    this.strikes++;
    var ev = { type: 'strike', why: why, strikes: this.strikes };
    for (var k in data) ev[k] = data[k];
    this.events.push(ev);
    if (this.strikes >= STRIKES) this.end('complaints');
  };
  W.end = function (reason, crash) {
    if (this.over) return;
    this.over = true; this.reason = reason; this.crash = crash || null;
    this.events.push({ type: 'end', reason: reason, crash: crash || null });
  };

  // ---------- one tick ----------

  W.rate = function (r) { return Math.min(r[2], r[0] + r[1] * this.t / 60); };

  W.step = function () {
    if (this.over) return;
    var self = this, cfg = this.cfg;
    this.t += DT;

    // arrivals
    var rate = this.rate(cfg.rate);
    if (cfg.brain === 'waves') {
      if (this.wave.left > 0) { this.wave.gap -= DT; if (this.wave.gap <= 0) { this.spawn(); this.wave.left--; this.wave.gap = 3.5; } }
      else if (this.rng.next() < rate / 3 * DT) { this.wave.left = 3; this.wave.gap = 0; }
    } else if (this.rng.next() < rate * DT) this.spawn();
    if (this.t >= this.jetT) { this.spawnJet(); this.jetT = this.t + cfg.jet * (0.8 + this.rng.next() * 0.4); }

    // stack levels in each holding pattern
    var stacks = {};
    this.planes.forEach(function (p) { if (p.state === 'hold') { var k = stacks[p.hold] || 0; p.stack = k; stacks[p.hold] = k + 1; } });

    this.planes.slice().forEach(function (p) { if (!self.over) self.move(p); });
    if (this.over) return;
    this.planes = this.planes.filter(function (p) { return !p.gone; });
    this.checkCrash();
  };

  W.steer = function (p, tx, ty) {
    var want = Math.atan2(ty - p.y, tx - p.x), d = angDiff(p.h, want), turn = AIR.turn * DT;
    p.bank = Math.max(-1, Math.min(1, d * 2));
    p.h += Math.max(-turn, Math.min(turn, d));
    p.x += Math.cos(p.h) * p.v * DT; p.y += Math.sin(p.h) * p.v * DT;
  };

  W.groundAhead = function (p, dirx, diry) {
    // another plane on the ground close in front of where p is going
    var self = this;
    return this.planes.some(function (o) {
      if (o === p || o.alt > 0.3 || o.gone) return false;
      var lim = GROUND.gap + (o.spec.len + p.spec.len) * 0.2;
      // a plane being pushed back owns the spot it is backing into, too
      var spots = [[o.x, o.y]];
      if (o.state === 'pushback') { var e = o.path.at(o.path.len); spots.push([e[0], e[1]]); }
      return spots.some(function (q) {
        var dx = q[0] - p.x, dy = q[1] - p.y, d = Math.hypot(dx, dy);
        return d < lim && (dx * dirx + dy * diry) > 0.45 * d;
      });
    });
  };

  W.followGround = function (p, speed, backwards) {
    var q = p.path.at(p.s), hd = backwards ? q[2] + Math.PI : q[2];
    var mx = Math.cos(q[2]), my = Math.sin(q[2]);
    if (!backwards && this.groundAhead(p, mx, my)) speed = 0;
    p.v = speed > p.v ? Math.min(speed, p.v + 1.5 * DT) : speed;
    p.s = Math.min(p.path.len, p.s + p.v * DT);
    var r = p.path.at(p.s);
    p.x = r[0]; p.y = r[1]; p.h = backwards ? r[2] + Math.PI : r[2];
    void hd;
    return p.s >= p.path.len - 1e-6;
  };

  W.freeStand = function (color) {
    var m = this.map;
    return m.stands.find(function (s) { return s.color === color && s.by < 0; });
  };

  W.move = function (p) {
    var m = this.map, cfg = this.cfg, P = m.P, self = this;
    if (p.kind === 'plane' && p.alt > 0.3 && (p.state === 'inbound' || p.state === 'hold')) {
      p.fuel -= DT;
      if (p.fuel <= 0) {
        p.state = 'divert';
        var e = this.edgePoint();
        p.target = e;
        this.strike('divert', { plane: p.id, color: p.color });
        if (this.over) return;
      }
    }
    switch (p.state) {
      case 'inbound': {
        var hf = m.holds[p.hold];
        p.v = AIR.speed;
        p.alt = Math.min(1, p.alt + AIR.climb * DT);
        this.steer(p, hf.x, hf.y);
        if (Math.hypot(p.x - hf.x, p.y - hf.y) < hf.r + 0.15) { p.state = 'hold'; p.theta = Math.atan2(p.y - hf.y, p.x - hf.x); }
        if (p.kind === 'jet') p.holdT = 0;
        break;
      }
      case 'hold': {
        var h = m.holds[p.hold];
        p.theta += AIR.speed / h.r * DT;
        var nx = h.x + Math.cos(p.theta) * h.r, ny = h.y + Math.sin(p.theta) * h.r;
        p.h = Math.atan2(ny - p.y, nx - p.x); p.x = nx; p.y = ny; p.bank = 0.6;
        p.alt += ((1 + p.stack * 0.22) - p.alt) * Math.min(1, DT * 1.5);
        if (p.kind === 'jet') {
          if (!this.runwayRed) { this.approach(p); break; }
          p.holdT = (p.holdT || 0) + DT;
          if (p.holdT > cfg.jetHold) { p.holdT = 0; this.strike('jet', { plane: p.id }); }
        }
        break;
      }
      case 'approach': {
        p.v = AIR.speed;
        // pursue a point a little ahead along the approach path
        var near = 0, nd = 1e9;
        for (var s = p.s; s <= Math.min(p.path.len, p.s + 6); s += 0.25) { var q = p.path.at(s), d = Math.hypot(q[0] - p.x, q[1] - p.y); if (d < nd) { nd = d; near = s; } }
        p.s = near;
        var finalStart = p.path.cum[1];
        p.final = p.s >= finalStart - 0.6;
        var look = p.path.at(Math.min(p.path.len, p.s + 1.4));
        this.steer(p, look[0], look[1]);
        var toThr = Math.hypot(m.thr[0] - p.x, m.thr[1] - p.y);
        if (p.final) p.alt = Math.min(p.alt, Math.max(0, toThr / FINAL));
        else p.alt += (1 - p.alt) * Math.min(1, DT);
        // Edith's jet will not land through a red light
        if (p.kind === 'jet' && this.runwayRed && p.final && p.alt > 0.3) { this.toHold(p); break; }
        if (toThr < 0.35 || p.s >= p.path.len - 0.1) {
          p.alt = 0; p.final = false; p.state = 'rollout'; p.v = GROUND.touch;
          var pts = [m.thr, P(m.aE, m.bR)];
          if (p.kind === 'jet') { pts.push(P(m.dir * (m.Lr / 2 + 9), m.bR)); p.path = new Path(pts); }
          else {
            var st = this.freeStand(p.color);
            if (st) st.by = p.id;
            p.stand = st ? st.id : -1;
            pts.push(P(m.aE, m.bT), P(m.aE - m.dir * 1.6, m.bT));
            if (st) pts.push(P(st.a, m.bT), P(st.a, m.bS));
            p.path = new Path(smooth(pts, 0.75));
          }
          p.s = 0;
          this.events.push({ type: 'touchdown', plane: p.id });
        }
        break;
      }
      case 'rollout': {
        if (p.kind === 'jet') {
          // a touch and go: a short roll, then full power again
          p.timer = (p.timer || 0) + DT;
          p.v = p.timer < 1.6 ? Math.max(2.0, p.v - 0.6 * DT) : Math.min(GROUND.top, p.v + GROUND.acc * DT);
          p.s = Math.min(p.path.len, p.s + p.v * DT);
          var j = p.path.at(p.s); p.x = j[0]; p.y = j[1]; p.h = j[2];
          if (p.timer > 1.6 && p.v > GROUND.rotate) { p.state = 'climb'; this.events.push({ type: 'liftoff', plane: p.id }); }
          break;
        }
        var onRw = this.onRunway(p);
        var sp = onRw ? Math.max(GROUND.exit, p.v - GROUND.roll * DT) : GROUND.taxi;
        if (onRw) { p.s = Math.min(p.path.len, p.s + sp * DT); p.v = sp; var r = p.path.at(p.s); p.x = r[0]; p.y = r[1]; p.h = r[2]; }
        else p.state = 'taxi-in';
        break;
      }
      case 'taxi-in': {
        var done = this.followGround(p, GROUND.taxi);
        if (done) {
          if (p.stand < 0) {
            var fs = this.freeStand(p.color);
            if (fs) {
              fs.by = p.id; p.stand = fs.id;
              p.path = new Path(smooth([[p.x, p.y], P(fs.a, m.bT), P(fs.a, m.bS)], 0.75)); p.s = 0;
            } else p.v = 0;
          } else {
            var sd = m.stands[p.stand];
            p.state = 'unload'; p.h = sd.heading; p.v = 0; p.timer = 1.0 + p.pax * 0.12;
            this.events.push({ type: 'gate', plane: p.id, stand: sd.id });
          }
        }
        break;
      }
      case 'unload': {
        p.timer -= DT;
        if (p.timer <= 0) {
          this.delivered += p.pax; this.landed++;
          this.byColor[p.color] = (this.byColor[p.color] || 0) + p.pax;
          var ms = this.mission;
          if (ms.need[p.color] && ms.got[p.color] < ms.need[p.color]) ms.got[p.color]++;
          this.events.push({ type: 'deliver', plane: p.id, color: p.color, pax: p.pax });
          if (Object.keys(ms.need).every(function (c) { return ms.got[c] >= ms.need[c]; })) {
            this.missionsDone++;
            var back = this.strikes > 0;
            if (back) this.strikes--;
            this.events.push({ type: 'mission', n: ms.n, back: back });
            this.newMission();
          }
          p.state = 'board'; p.timer = 3 + this.rng.next() * 4;
        }
        break;
      }
      case 'board': {
        p.timer -= DT;
        if (p.timer <= 0) { p.state = 'ready'; p.readyT = 0; this.events.push({ type: 'ready', plane: p.id }); }
        break;
      }
      case 'ready': {
        p.readyT += DT;
        if (p.readyT > cfg.patience) { p.readyT = 0; this.strike('gate', { plane: p.id, color: p.color }); }
        break;
      }
      case 'push-wait': {
        var stw = m.stands[p.stand], exitPt = P(stw.a - m.dir * -1.3, m.bT);
        // only when the taxiway behind the stand is clear
        var busy = this.planes.some(function (o) { return o !== p && o.alt < 0.3 && !o.gone && Math.hypot(o.x - exitPt[0], o.y - exitPt[1]) < 4.2 && o.state !== 'unload' && o.state !== 'board' && o.state !== 'ready' && o.state !== 'push-wait'; });
        p.readyT += DT;
        if (p.readyT > cfg.patience) { p.readyT = 0; this.strike('gate', { plane: p.id, color: p.color }); }
        if (!busy) {
          p.state = 'pushback';
          p.path = new Path(smooth([[p.x, p.y], P(stw.a, m.bT), exitPt], 0.8)); p.s = 0; p.v = 0;
        }
        break;
      }
      case 'pushback': {
        if (this.followGround(p, GROUND.push, true)) {
          m.stands[p.stand].by = -1; p.stand = -1;
          p.state = 'taxi-out';
          p.path = new Path([[p.x, p.y], m.hold]); p.s = 0; p.v = 0;
        }
        break;
      }
      case 'taxi-out': {
        if (this.followGround(p, GROUND.taxi)) { p.state = 'holdshort'; p.waitT = 0; p.v = 0; this.events.push({ type: 'holdshort', plane: p.id }); }
        break;
      }
      case 'holdshort': {
        p.waitT += DT;
        if (p.waitT > cfg.patience) { p.waitT = 0; this.strike('holdshort', { plane: p.id, color: p.color }); }
        break;
      }
      case 'lineup': {
        // taxi onto the runway, then full power
        var onLine = p.s > p.path.cum[p.path.cum.length - 2] - 0.01 || this.onRunway(p) && p.s > 2.5;
        if (!onLine) { p.v = Math.min(1.1, p.v + DT); }
        else p.v = Math.min(GROUND.top, p.v + GROUND.acc * DT);
        p.s = Math.min(p.path.len, p.s + p.v * DT);
        var lq = p.path.at(p.s); p.x = lq[0]; p.y = lq[1]; p.h = lq[2];
        if (p.v > GROUND.rotate) { p.state = 'climb'; this.events.push({ type: 'liftoff', plane: p.id }); }
        break;
      }
      case 'climb': {
        p.v = Math.min(GROUND.top, p.v + GROUND.acc * DT);
        p.alt = Math.min(1.8, p.alt + GROUND.climb * DT);
        p.x += Math.cos(p.h) * p.v * DT; p.y += Math.sin(p.h) * p.v * DT;
        if (p.x < -3 || p.y < -3 || p.x > m.W + 3 || p.y > m.H + 3) {
          p.gone = true;
          if (p.kind === 'plane') { this.departed++; this.events.push({ type: 'departed', plane: p.id }); }
        }
        break;
      }
      case 'divert': {
        p.v = AIR.speed;
        this.steer(p, p.target[0], p.target[1]);
        if (p.x < -2.5 || p.y < -2.5 || p.x > m.W + 2.5 || p.y > m.H + 2.5) p.gone = true;
        break;
      }
    }
  };

  W.checkCrash = function () {
    var ps = this.planes;
    for (var i = 0; i < ps.length; i++) for (var j = i + 1; j < ps.length; j++) {
      var a = ps[i], b = ps[j];
      if (a.alt > 0.3 || b.alt > 0.3) continue;
      if (Math.hypot(a.x - b.x, a.y - b.y) < (a.spec.len + b.spec.len) * 0.42) {
        this.end('crash', { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, a: a.id, b: b.id });
        return;
      }
    }
  };

  // ---------- scoring ----------

  W.points = function () { return Math.min(200000, 2 * this.delivered + 50 * this.departed + 150 * this.missionsDone); };
  W.stars = function () { var d = this.delivered; return d >= STARS[2] ? 3 : d >= STARS[1] ? 2 : d >= STARS[0] ? 1 : 0; };
  W.holding = function () { return this.planes.filter(function (p) { return p.kind === 'plane' && (p.state === 'hold' || p.state === 'inbound'); }).length; };

  var CL = {
    DT: DT, STRIKES: STRIKES, STARS: STARS, COLORS: COLORS, SIZES: SIZES, AIR: AIR, GROUND: GROUND, FINAL: FINAL,
    LEVELS: LEVELS, Rng: Rng, Path: Path, World: World, buildAirport: buildAirport
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = CL;
  else global.ClearedToLand = CL;
})(typeof window !== 'undefined' ? window : globalThis);
