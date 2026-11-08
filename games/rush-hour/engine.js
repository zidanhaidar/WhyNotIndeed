/*
 * Rush Hour engine: a little city grid at rush hour. Cars enter at the edges heading for the side of town shown on
 * their roof color; pedestrians wait at zebra crossings. You switch the traffic lights at every junction (with an
 * automatic amber and a moment of all-red) and give the walkers their green man. Cars stop for red lights, for a
 * green man and for anyone on a crossing; they never block a junction, and turning left they wait for oncoming cars.
 * A walker kept waiting too long complains and crosses anyway: a car that cannot stop in time hits them, and that
 * ends the shift at once. Other complaints: a car kept at a red light too long, a long queue of cars waiting to
 * get into town, and (Excel and Edith) an ambulance held at a red light. Five complaints end the shift; finishing a mission takes one back. Traffic keeps growing.
 * Pure logic, CommonJS (the dev scripts use it too).
 */
(function (global) {
  'use strict';

  var DT = 1 / 30;
  var STRIKES = 5;
  var STARS = [250, 600, 1000]; // trips (cars home plus walkers across) for one, two and three stars
  var COLORS = ['red', 'blue', 'green', 'yellow'];
  var LANE = 0.4, BOX = 0.85, STOP = 1.1, ROAD = 0.85; // lane offset, junction half size, stop line, road half width
  var CAR = { len: 0.85, wid: 0.46, acc: 3, dec: 6, hard: 11 };
  var WALK = { speed: 0.95, clear: 1.0 };
  var LIGHT = { amber: 1.3, allred: 0.9 };
  var QUEUE = 8; // cars waiting outside town at one entrance before the drivers complain

  /*
   * streets: vertical streets (horizontal ones are always 2), zebras: crossings, rate: cars per second at each street end [start, per
   * minute, most], walkers: pedestrians per second, speed: car top speed range, carWait/walkWait: seconds before a
   * complaint, brain (the robot sends the traffic): random, platoon, aim (cars head for the approaches at red).
   * amb: seconds between ambulances (0: none), ambWait: seconds an ambulance tolerates at a red light.
   */
  var LEVELS = {
    pip: { streets: 2, zebras: 2, rate: [0.045, 0.026, 1], walkers: [0.07, 0.04, 1.2], speed: [2.2, 2.7], carWait: 16, walkWait: 20, brain: 'random', amb: 0 },
    gridlock: { streets: 3, zebras: 3, rate: [0.05, 0.034, 1], walkers: [0.08, 0.05, 1.3], speed: [2.4, 2.9], carWait: 15, walkWait: 19, brain: 'platoon', amb: 0 },
    monolith: { streets: 3, zebras: 3, rate: [0.052, 0.044, 1], walkers: [0.09, 0.055, 1.4], speed: [2.5, 3.1], carWait: 14, walkWait: 18, brain: 'aim', amb: 45, ambWait: 4 },
    edith: { streets: 3, zebras: 4, rate: [0.056, 0.05, 1], walkers: [0.1, 0.06, 1.5], speed: [2.6, 3.2], carWait: 13, walkWait: 17, brain: 'aim', amb: 32, ambWait: 3.5 }
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

  function right(d) { return [-d[1], d[0]]; }
  function smooth(pts, r) {
    if (pts.length < 3) return pts.slice();
    var out = [pts[0]];
    for (var i = 1; i < pts.length - 1; i++) {
      var p = pts[i - 1], c = pts[i], n = pts[i + 1];
      var l1 = Math.hypot(c[0] - p[0], c[1] - p[1]), l2 = Math.hypot(n[0] - c[0], n[1] - c[1]);
      var rr = Math.min(r, l1 / 2, l2 / 2);
      if (rr < 0.01 || l1 < 1e-6 || l2 < 1e-6) { out.push(c); continue; }
      var a = [c[0] - (c[0] - p[0]) / l1 * rr, c[1] - (c[1] - p[1]) / l1 * rr], b = [c[0] + (n[0] - c[0]) / l2 * rr, c[1] + (n[1] - c[1]) / l2 * rr];
      for (var k = 0; k <= 8; k++) { var t = k / 8, u = 1 - t; out.push([u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]]); }
    }
    out.push(pts[pts.length - 1]);
    return out;
  }
  function Path(pts) {
    this.pts = pts; this.cum = [0];
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
  // the distance along the path of the point on it nearest to (x, y)
  Path.prototype.near = function (x, y) {
    var best = 0, bd = 1e9;
    for (var i = 0; i < this.pts.length - 1; i++) {
      var p = this.pts[i], q = this.pts[i + 1], dx = q[0] - p[0], dy = q[1] - p[1], l2 = dx * dx + dy * dy || 1e-9;
      var t = Math.max(0, Math.min(1, ((x - p[0]) * dx + (y - p[1]) * dy) / l2)), px = p[0] + dx * t, py = p[1] + dy * t, d = Math.hypot(px - x, py - y);
      if (d < bd) { bd = d; best = this.cum[i] + t * Math.sqrt(l2); }
    }
    return best;
  };

  // ---------- the city ----------

  function spread(n, span, rng, margin, gap) {
    for (var tries = 0; tries < 200; tries++) {
      var out = [];
      for (var i = 0; i < n; i++) out.push(span * (i + 1) / (n + 1) + (rng.next() - 0.5) * 2.4);
      out.sort(function (a, b) { return a - b; });
      var ok = out[0] >= margin && out[n - 1] <= span - margin;
      for (i = 1; i < n; i++) if (out[i] - out[i - 1] < gap) ok = false;
      if (ok) return out;
    }
    var even = [];
    for (var j = 0; j < n; j++) even.push(span * (j + 1) / (n + 1));
    return even;
  }

  function buildCity(levelId, rng, aspect) {
    var cfg = LEVELS[levelId], land = aspect >= 1;
    var W = land ? Math.max(26, Math.min(40, Math.round(20 * aspect))) : 20;
    var H = land ? 20 : Math.max(26, Math.min(40, Math.round(20 / aspect)));
    var nv = land ? (W >= 32 ? cfg.streets : Math.min(cfg.streets, 2)) : 2, nh = land ? 2 : (H >= 32 ? cfg.streets : 2);
    var xs = spread(nv, W, rng, 4.2, 6.5), ys = spread(nh, H, rng, 4.2, 6.5);
    var sides = rng.shuffle(COLORS.slice()); // top, right, bottom, left
    var city = { W: W, H: H, xs: xs, ys: ys, sides: { top: sides[0], right: sides[1], bottom: sides[2], left: sides[3] }, junctions: [], zebras: [], lots: [] };
    xs.forEach(function (x, i) { ys.forEach(function (y, j) { city.junctions.push({ id: city.junctions.length, i: i, j: j, x: x, y: y, axis: rng.next() < 0.5 ? 'ns' : 'ew', phase: 'green', t: 0, next: null, waitT: { n: 0, s: 0, e: 0, w: 0 }, key: '' }); }); });
    // zebra crossings in the middle of street stretches, away from junctions
    var spans = [];
    xs.forEach(function (x, i) {
      var cuts = [0].concat(ys).concat([H]);
      for (var k = 0; k < cuts.length - 1; k++) { var a = cuts[k], b = cuts[k + 1]; if (b - a >= 5.2) spans.push({ vertical: true, at: x, street: i, a: a, b: b }); }
    });
    ys.forEach(function (y, j) {
      var cuts = [0].concat(xs).concat([W]);
      for (var k = 0; k < cuts.length - 1; k++) { var a = cuts[k], b = cuts[k + 1]; if (b - a >= 5.2) spans.push({ vertical: false, at: y, street: j, a: a, b: b }); }
    });
    // prefer stretches between two junctions, then the ones at the edge
    rng.shuffle(spans);
    spans.sort(function (p, q) { var pi = p.a > 0 && p.b < (p.vertical ? H : W), qi = q.a > 0 && q.b < (q.vertical ? H : W); return (qi ? 1 : 0) - (pi ? 1 : 0); });
    spans.slice(0, cfg.zebras).forEach(function (sp) {
      var lo = sp.a + 2.4, hi = sp.b - 2.4, at = lo + rng.next() * Math.max(0, hi - lo);
      var z = { id: city.zebras.length, vertical: sp.vertical, street: sp.street, x: sp.vertical ? sp.at : at, y: sp.vertical ? at : sp.at, walk: false, go: false, t: 0, waiting: [[], []], key: '' };
      city.zebras.push(z);
    });
    city.junctions.forEach(function (jn, k) { jn.key = String(k + 1); });
    city.zebras.forEach(function (z, k) { z.key = 'QWER'[k]; });
    lots(city, rng);
    return city;
  }

  // what fills each block: offices, houses, a park or a car park
  function lots(city, rng) {
    var bx = [0].concat(city.xs).concat([city.W]), by = [0].concat(city.ys).concat([city.H]);
    for (var i = 0; i < bx.length - 1; i++) for (var j = 0; j < by.length - 1; j++) {
      var x0 = bx[i] + (i ? ROAD + 0.55 : -1), x1 = bx[i + 1] - (i + 1 < bx.length - 1 ? ROAD + 0.55 : -1);
      var y0 = by[j] + (j ? ROAD + 0.55 : -1), y1 = by[j + 1] - (j + 1 < by.length - 1 ? ROAD + 0.55 : -1);
      var r = rng.next(), kind = r < 0.16 ? 'park' : r < 0.26 ? 'parking' : 'buildings';
      var block = { x0: x0, y0: y0, x1: x1, y1: y1, kind: kind, items: [] };
      if (kind === 'buildings') {
        // split into lots along the longer side
        var horiz = x1 - x0 >= y1 - y0, len = horiz ? x1 - x0 : y1 - y0, pos = horiz ? x0 : y0;
        while (pos < (horiz ? x1 : y1) - 1.6) {
          var size = Math.min((horiz ? x1 : y1) - pos, 2.2 + rng.next() * 2.4);
          var depth = (horiz ? y1 - y0 : x1 - x0);
          var rows = depth > 6 ? 2 : 1;
          for (var rw = 0; rw < rows; rw++) {
            var d0 = (horiz ? y0 : x0) + rw * depth / rows, d1 = d0 + depth / rows;
            var it = horiz ? { x0: pos + 0.15, x1: pos + size - 0.15, y0: d0 + 0.15, y1: d1 - 0.15 } : { y0: pos + 0.15, y1: pos + size - 0.15, x0: d0 + 0.15, x1: d1 - 0.15 };
            it.type = rng.next() < 0.35 ? 'house' : 'office';
            it.hue = rng.int(0, 5);
            block.items.push(it);
          }
          pos += size;
        }
        void len;
      } else if (kind === 'park') {
        for (var t = 0; t < 14; t++) block.items.push({ x: x0 + 0.7 + rng.next() * Math.max(0.1, x1 - x0 - 1.4), y: y0 + 0.7 + rng.next() * Math.max(0.1, y1 - y0 - 1.4), r: 0.45 + rng.next() * 0.4, kind: rng.next() < 0.25 ? 'pine' : rng.next() < 0.7 ? 'tree' : 'bush', hue: rng.int(0, 3) });
      }
      city.lots.push(block);
    }
  }

  // ---------- routes ----------

  var DIRS = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] };
  function dirName(d) { return d[0] > 0 ? 'e' : d[0] < 0 ? 'w' : d[1] > 0 ? 's' : 'n'; }

  // street ends at the edge of the map: where cars come in and go out
  function ends(city) {
    var out = [];
    city.xs.forEach(function (x, i) { out.push({ side: 'top', x: x, y: -1.5, dir: [0, 1], j: 0, i: i }); out.push({ side: 'bottom', x: x, y: city.H + 1.5, dir: [0, -1], j: city.ys.length - 1, i: i }); });
    city.ys.forEach(function (y, j) { out.push({ side: 'left', x: -1.5, y: y, dir: [1, 0], i: 0, j: j }); out.push({ side: 'right', x: city.W + 1.5, y: y, dir: [-1, 0], i: city.xs.length - 1, j: j }); });
    return out;
  }
  function junctionAt(city, i, j) { return city.junctions.find(function (jn) { return jn.i === i && jn.j === j; }); }

  // the fewest-turns way through the grid from an entry to an exit
  function route(city, from, to) {
    var nx = city.xs.length, ny = city.ys.length;
    var start = { i: from.i, j: from.j, d: from.dir, turns: 0, list: [] };
    var best = null, queue = [start], seen = {};
    while (queue.length) {
      queue.sort(function (a, b) { return a.turns * 3 + a.list.length - (b.turns * 3 + b.list.length); });
      var cur = queue.shift(), key = cur.i + ',' + cur.j + ',' + dirName(cur.d);
      if (seen[key]) continue;
      seen[key] = 1;
      var list = cur.list.concat([{ i: cur.i, j: cur.j, din: cur.d }]);
      // leaving the grid here, straight on to the exit?
      ['n', 's', 'e', 'w'].forEach(function (nm) {
        var d = DIRS[nm];
        if (d[0] === -cur.d[0] && d[1] === -cur.d[1]) return; // no U-turns
        var ni = cur.i + d[0], nj = cur.j + d[1], turn = d[0] === cur.d[0] && d[1] === cur.d[1] ? 0 : 1;
        if (ni < 0 || nj < 0 || ni >= nx || nj >= ny) {
          var side = ni < 0 ? 'left' : ni >= nx ? 'right' : nj < 0 ? 'top' : 'bottom';
          var exitHere = side === to.side && (side === 'top' || side === 'bottom' ? cur.i === to.i : cur.j === to.j);
          if (exitHere) {
            var cand = { turns: cur.turns + turn, list: list, dout: d };
            if (!best || cand.turns * 3 + cand.list.length < best.turns * 3 + best.list.length) best = cand;
          }
          return;
        }
        queue.push({ i: ni, j: nj, d: d, turns: cur.turns + turn, list: list });
      });
    }
    if (!best) return null;
    // outgoing direction at every junction
    var legs = best.list.map(function (n, k) { return { i: n.i, j: n.j, din: n.din, dout: k + 1 < best.list.length ? best.list[k + 1].din : best.dout }; });
    return legs;
  }

  function lanePt(x, y, d, along) {
    var r = right(d);
    return [x + r[0] * LANE + d[0] * along, y + r[1] * LANE + d[1] * along];
  }

  function buildPath(city, from, to, legs) {
    var pts = [lanePt(from.x, from.y, from.dir, 0)], marks = [];
    legs.forEach(function (lg) {
      var jn = junctionAt(city, lg.i, lg.j), din = lg.din, dout = lg.dout;
      var ap = lanePt(jn.x, jn.y, din, -STOP), ex = lanePt(jn.x, jn.y, dout, STOP);
      var turn = din[0] === dout[0] && din[1] === dout[1] ? 'straight' : (right(din)[0] === dout[0] && right(din)[1] === dout[1]) ? 'right' : 'left';
      pts.push(ap);
      if (turn !== 'straight') { var o1 = right(din), o2 = right(dout); pts.push([jn.x + (o1[0] + o2[0]) * LANE, jn.y + (o1[1] + o2[1]) * LANE]); }
      pts.push(ex);
      marks.push({ junction: jn.id, ap: ap, ex: ex, turn: turn, axis: din[0] ? 'ew' : 'ns', from: dirName([-din[0], -din[1]]), din: din });
    });
    pts.push(lanePt(to.x, to.y, [-to.dir[0], -to.dir[1]], 0));
    var path = new Path(smooth(pts, 0.9));
    marks.forEach(function (mk) {
      mk.sStop = path.near(mk.ap[0], mk.ap[1]);
      mk.sOut = path.near(mk.ex[0], mk.ex[1]);
      mk.sYield = mk.sStop + 0.75;
    });
    // zebras on the way
    var zs = [];
    city.zebras.forEach(function (z) {
      var s = path.near(z.x, z.y), p = path.at(s);
      if (Math.hypot(p[0] - z.x, p[1] - z.y) > 0.7) return;
      var d = [Math.cos(p[2]), Math.sin(p[2])];
      // only if the car crosses it (moving along the zebra's street)
      if (z.vertical ? Math.abs(d[1]) < 0.9 : Math.abs(d[0]) < 0.9) return;
      zs.push({ zebra: z.id, sStop: s - STOP - 0.25, s: s });
    });
    return { path: path, marks: marks, zebras: zs };
  }

  // ---------- the city at work ----------

  function World(levelId, seed, aspect) {
    var cfg = LEVELS[levelId];
    this.level = levelId;
    this.cfg = cfg;
    this.rng = new Rng(seed || 1);
    this.map = buildCity(levelId, this.rng, aspect || 1.6);
    this.ends = ends(this.map);
    this.colors = [this.map.sides.top, this.map.sides.right, this.map.sides.bottom, this.map.sides.left];
    this.t = 0;
    this.cars = [];
    this.walkers = [];
    this.nextId = 1;
    this.strikes = 0;
    this.carsHome = 0;
    this.walked = 0;
    this.byColor = {};
    var self = this;
    this.colors.forEach(function (c) { self.byColor[c] = 0; });
    this.missionsDone = 0;
    this.over = false;
    this.reason = '';
    this.crash = null;
    this.events = [];
    this.ambT = cfg.amb ? cfg.amb * 0.7 : Infinity;
    this.newMission();
    for (var k = 0; k < 4; k++) this.spawnCar();
  }
  var P = World.prototype;

  P.trips = function () { return this.carsHome + this.walked; };
  P.rate = function (r) { return Math.min(r[2], r[0] + r[1] * this.t / 60); };
  P.light = function (jn, axis) {
    if (jn.axis !== axis) return 'red';
    return jn.phase === 'green' ? 'green' : jn.phase === 'amber' ? 'amber' : 'red';
  };

  P.spawnCar = function (endPick, amb) {
    var ends = this.ends, rng = this.rng, cfg = this.cfg;
    var from = endPick || rng.pick(ends);
    var blocked = this.entranceBlocked(from);
    if (blocked && !amb) { this.queueAt(from); return null; }
    var targets = ends.filter(function (e) { return e.side !== from.side; });
    var to = rng.pick(targets), legs = route(this.map, from, to);
    if (!legs) return null;
    var built = buildPath(this.map, from, to, legs);
    var p0 = built.path.at(0);
    var vmax = cfg.speed[0] + rng.next() * (cfg.speed[1] - cfg.speed[0]);
    var car = {
      id: this.nextId++, kind: amb ? 'amb' : 'car', path: built.path, marks: built.marks, zebras: built.zebras, s: 0, v: vmax * 0.8, vmax: amb ? 3.4 : vmax,
      x: p0[0], y: p0[1], h: p0[2], color: this.map.sides[to.side], from: from.side, look: rng.int(0, 7), wait: 0, braking: false, turnSig: 0, mark: 0
    };
    this.cars.push(car);
    if (amb) this.events.push({ type: 'ambulance', car: car.id });
    return car;
  };

  // a car can only come in when the first stretch of its lane is clear
  P.entranceBlocked = function (e) {
    var r = right(e.dir), x = e.x + r[0] * LANE, y = e.y + r[1] * LANE;
    return this.cars.some(function (c) { return Math.hypot(c.x - x, c.y - y) < CAR.len + 0.9; });
  };
  // otherwise it waits outside town; a long queue there is a complaint
  P.queueAt = function (e) {
    e.queue = (e.queue || 0) + 1;
    if (e.queue > QUEUE) { e.queue = Math.ceil(QUEUE / 2); this.strike('queue', { side: e.side, x: e.x, y: e.y }); }
  };

  P.spawnWalker = function () {
    var zs = this.map.zebras;
    if (!zs.length) return;
    var z = this.rng.pick(zs), side = this.rng.int(0, 1);
    if (z.waiting[side].length >= 5) return;
    var w = { id: this.nextId++, zebra: z.id, side: side, state: 'wait', t: 0, born: this.t, patience: this.cfg.walkWait * (0.85 + this.rng.next() * 0.3), look: this.rng.int(0, 5), shirt: this.rng.int(0, 5), slot: z.waiting[side].length, p: 0 };
    z.waiting[side].push(w.id);
    this.walkers.push(w);
  };

  // where a walker stands: across is 0 at their curb and 1 at the far curb, slot spreads a queue along the kerb
  P.walkerPos = function (w) {
    var z = this.map.zebras[w.zebra], half = ROAD + 0.45, sgn = w.side ? 1 : -1;
    var across = -sgn * half + sgn * 2 * half * w.p, along = w.state === 'wait' ? (w.slot % 3 - 1) * 0.28 : (w.lane || 0);
    var back = w.state === 'wait' ? Math.floor(w.slot / 3) * 0.3 : 0;
    across += -sgn * back;
    if (w.state === 'leave') across = sgn * (half + w.t * 0.9);
    return z.vertical ? [z.x + across, z.y + along] : [z.x + along, z.y + across];
  };

  // ---------- commands ----------

  P.switchLight = function (id) {
    var jn = this.map.junctions[id];
    if (!jn || this.over) return false;
    if (jn.phase !== 'green') { jn.next = jn.next ? null : (jn.axis === 'ns' ? 'ew' : 'ns'); return true; }
    jn.phase = 'amber'; jn.t = 0; jn.next = jn.axis === 'ns' ? 'ew' : 'ns';
    this.events.push({ type: 'light', junction: id });
    return true;
  };
  P.toggleWalk = function (id) {
    var z = this.map.zebras[id];
    if (!z || this.over) return false;
    z.walk = !z.walk; z.t = 0;
    if (!z.walk) z.go = false;
    this.events.push({ type: z.walk ? 'walk-on' : 'walk-off', zebra: id });
    return true;
  };

  // ---------- missions and complaints ----------

  P.newMission = function () {
    var n = this.missionsDone, cols = this.rng.shuffle(this.colors.slice()).slice(0, n < 2 ? 1 : 2);
    var need = {}, got = {};
    cols.forEach(function (c) { need[c] = 3 + Math.floor(n / 2); got[c] = 0; });
    need.walk = 2 + Math.floor(n * 0.75); got.walk = 0;
    this.mission = { n: n + 1, need: need, got: got };
  };
  P.progress = function (key) {
    var m = this.mission;
    if (m.need[key] && m.got[key] < m.need[key]) m.got[key]++;
    if (Object.keys(m.need).every(function (c) { return m.got[c] >= m.need[c]; })) {
      this.missionsDone++;
      var back = this.strikes > 0;
      if (back) this.strikes--;
      this.events.push({ type: 'mission', n: m.n, back: back });
      this.newMission();
    }
  };
  P.strike = function (why, data) {
    if (this.over) return;
    this.strikes++;
    var ev = { type: 'strike', why: why, strikes: this.strikes };
    for (var k in data) ev[k] = data[k];
    this.events.push(ev);
    if (this.strikes >= STRIKES) this.end('complaints');
  };
  P.end = function (reason, crash) {
    if (this.over) return;
    this.over = true; this.reason = reason; this.crash = crash || null;
    this.events.push({ type: 'end', reason: reason, crash: crash || null });
  };

  // ---------- one tick ----------

  P.step = function () {
    if (this.over) return;
    var self = this, cfg = this.cfg;
    this.t += DT;

    // lights
    this.map.junctions.forEach(function (jn) {
      jn.t += DT;
      if (jn.phase === 'amber' && jn.t > LIGHT.amber) { jn.phase = 'allred'; jn.t = 0; }
      else if (jn.phase === 'allred' && jn.t > LIGHT.allred) {
        jn.phase = 'green'; jn.t = 0;
        if (jn.next) { jn.axis = jn.next; jn.next = null; }
      }
    });

    // traffic
    var rate = this.rate(cfg.rate) * this.ends.length; // cars per second, per street end
    if (cfg.brain === 'platoon') {
      // a convoy of three lines up at one entrance and drives in nose to tail
      if (this.rng.next() < rate / 3 * DT) { var ce = this.rng.pick(this.ends); for (var q = 0; q < 3; q++) this.queueAt(ce); }
    } else if (this.rng.next() < rate * DT) {
      var e = null;
      if (cfg.brain === 'aim' && this.rng.next() < 0.6) {
        // come in where the first junction is red for you
        var reds = this.ends.filter(function (en) { var jn = junctionAt(self.map, en.i, en.j); return self.light(jn, en.dir[0] ? 'ew' : 'ns') !== 'green'; });
        if (reds.length) e = this.rng.pick(reds);
      }
      this.spawnCar(e);
    }
    // cars waiting outside town come in as soon as there is room
    this.ends.forEach(function (en) { if (en.queue > 0 && !self.entranceBlocked(en) && self.spawnCar(en)) en.queue--; });
    if (this.t >= this.ambT) { this.spawnCar(null, true); this.ambT = this.t + cfg.amb * (0.8 + this.rng.next() * 0.4); }
    if (this.rng.next() < this.rate(cfg.walkers) * DT) this.spawnWalker();

    this.walkersStep();
    if (this.over) return;
    this.carsStep();
    if (this.over) return;
    this.checkHits();
  };

  P.walkersStep = function () {
    var self = this, zs = this.map.zebras;
    zs.forEach(function (z) {
      z.t += DT;
      // the green man shows once nobody is about to drive over the crossing
      if (z.walk && !z.go) {
        var near = self.cars.some(function (c) { var d = Math.hypot(c.x - z.x, c.y - z.y); return self.onZebraLine(c, z) && (d < 1.35 || (c.v > 0.4 && d < 2.4)); });
        if (!near && z.t > 0.6) { z.go = true; self.events.push({ type: 'green-man', zebra: z.id }); }
      }
    });
    this.walkers.forEach(function (w) {
      var z = zs[w.zebra];
      if (w.state === 'wait') {
        if (z.go) { self.startCross(w, false); return; }
        if (self.t - w.born > w.patience) {
          self.strike('walker', { zebra: z.id });
          self.startCross(w, true);
          self.events.push({ type: 'jaywalk', zebra: z.id, walker: w.id });
        }
      } else if (w.state === 'cross') {
        w.p += WALK.speed * DT / (2 * (ROAD + 0.45)) * (w.run ? 1.6 : 1);
        if (w.p >= 1) { w.p = 1; w.state = 'leave'; w.t = 0; self.walked++; self.progress('walk'); self.events.push({ type: 'crossed', walker: w.id, zebra: z.id }); }
      } else if (w.state === 'leave') {
        w.t += DT;
        if (w.t > 1.6) w.gone = true;
      }
    });
    this.walkers = this.walkers.filter(function (w) { return !w.gone; });
  };
  P.startCross = function (w, jay) {
    var z = this.map.zebras[w.zebra], q = z.waiting[w.side], i = q.indexOf(w.id);
    if (i >= 0) q.splice(i, 1);
    var self = this;
    q.forEach(function (id, k) { var o = self.walkers.find(function (x) { return x.id === id; }); if (o) o.slot = k; });
    w.state = 'cross'; w.p = 0; w.jay = jay; w.run = jay; w.lane = (w.slot % 3 - 1) * 0.28;
  };

  // is car c driving along the street that zebra z crosses, and close to its line?
  P.onZebraLine = function (c, z) {
    var dx = Math.cos(c.h), dy = Math.sin(c.h);
    if (z.vertical ? Math.abs(dy) < 0.7 : Math.abs(dx) < 0.7) return false;
    return z.vertical ? Math.abs(c.x - z.x) < ROAD : Math.abs(c.y - z.y) < ROAD;
  };

  P.carsStep = function () {
    var self = this, cfg = this.cfg, m = this.map;
    var waitAt = {};
    this.cars.forEach(function (c) {
      var limit = c.path.len + 5, reason = null; // distance along the path the car may go up to
      // the car in front
      var hx = Math.cos(c.h), hy = Math.sin(c.h);
      self.cars.forEach(function (o) {
        if (o === c) return;
        var dx = o.x - c.x, dy = o.y - c.y, d = Math.hypot(dx, dy);
        if (d > 3.2) return;
        var fwd = dx * hx + dy * hy, lat = Math.abs(-dx * hy + dy * hx);
        // inside a junction only cars going the same way count (crossing ones are already on their way out)
        if (Math.cos(o.h - c.h) < 0.9 && self.inBox(o) && self.inBox(c)) return;
        if (fwd > 0.1 && lat < 0.42) limit = Math.min(limit, c.s + fwd - CAR.len - 0.3);
      });
      // junctions
      for (var k = c.mark; k < c.marks.length; k++) {
        var mk = c.marks[k], jn = m.junctions[mk.junction];
        if (c.s > mk.sOut) { c.mark = k + 1; continue; }
        if (c.s < mk.sStop - 0.02) {
          var lt = self.light(jn, mk.axis), dist = mk.sStop - c.s, stopDist = c.v * c.v / (2 * CAR.dec);
          var go = lt === 'green' || (lt === 'amber' && dist < stopDist + 0.05);
          // never into a blocked junction: crossing traffic inside, or no room on the far side
          if (go) {
            var cross = self.cars.some(function (o) { return o !== c && Math.abs(o.x - jn.x) < BOX && Math.abs(o.y - jn.y) < BOX && (Math.abs(Math.cos(o.h)) > 0.7 ? 'ew' : 'ns') !== mk.axis; });
            var full = self.cars.some(function (o) { return o !== c && Math.hypot(o.x - mk.ex[0], o.y - mk.ex[1]) < CAR.len + 0.25 && o.v < 0.8; });
            if (cross || full) go = false;
          }
          if (!go && dist >= -0.02) { if (mk.sStop < limit) { limit = mk.sStop; reason = { jn: jn.id, from: mk.from }; } }
          break;
        }
        // inside: a left turn waits for oncoming cars
        if (mk.turn === 'left' && c.s < mk.sYield + 0.4) {
          var oncoming = self.cars.some(function (o) {
            if (o === c) return false;
            var ohx = Math.cos(o.h), ohy = Math.sin(o.h);
            if (ohx * mk.din[0] + ohy * mk.din[1] > -0.8) return false; // not coming the other way
            var dx2 = jn.x - o.x, dy2 = jn.y - o.y, ahead = dx2 * ohx + dy2 * ohy;
            return ahead > -0.3 && ahead < 3.4 && Math.hypot(dx2, dy2) < 3.6 && o.v > 0.3;
          });
          if (oncoming && mk.sYield < limit) limit = Math.max(c.s, mk.sYield);
        }
        break;
      }
      // zebras: stop for a green man or anyone on the crossing
      c.zebras.forEach(function (zz) {
        if (c.s > zz.s + 0.6) return;
        var z = m.zebras[zz.zebra];
        var people = self.walkers.some(function (w) { return w.zebra === z.id && w.state === 'cross'; });
        if ((z.walk || people) && c.s < zz.sStop - 0.02) {
          var dist2 = zz.sStop - c.s, stopDist2 = c.v * c.v / (2 * CAR.hard);
          if (z.walk && !people && dist2 < stopDist2 && !z.go) return; // too close to stop: drive on before the green man shows
          if (zz.sStop < limit) { limit = zz.sStop; reason = reason || { zebra: z.id }; }
        }
        // somebody stepped out right in front: brake as hard as possible
        if (people && c.s >= zz.sStop - 0.02 && c.s < zz.s) limit = Math.min(limit, c.s);
      });
      var room = limit - c.s;
      var target = Math.min(c.vmax, Math.sqrt(2 * CAR.dec * Math.max(0, room)));
      c.braking = target < c.v - 0.05;
      c.v = target > c.v ? Math.min(target, c.v + CAR.acc * DT) : Math.max(target, c.v - CAR.hard * DT);
      if (room <= 0.01) c.v = Math.min(c.v, 0);
      c.s += c.v * DT;
      var p = c.path.at(c.s);
      c.x = p[0]; c.y = p[1]; c.h = p[2];
      // blinkers before a turn
      var nm = c.marks[c.mark];
      c.turnSig = nm && nm.turn !== 'straight' && c.s > nm.sStop - 3 ? (nm.turn === 'left' ? -1 : 1) : 0;
      // waiting at a red light (or a crossing) too long
      if (c.v < 0.05 && reason) {
        c.wait += DT;
        var key = reason.jn != null ? 'j' + reason.jn + reason.from : 'z' + reason.zebra;
        waitAt[key] = Math.max(waitAt[key] || 0, c.wait);
        if (c.kind === 'amb' && c.wait > cfg.ambWait) { c.wait = 0; self.strike('ambulance', { car: c.id }); }
        else if (c.kind === 'car' && c.wait > cfg.carWait) { c.wait = 0; self.strike('car', { car: c.id }); self.events.push({ type: 'honk', car: c.id }); }
        else if (c.kind === 'car' && Math.abs(c.wait - cfg.carWait * 0.6) < DT / 2) self.events.push({ type: 'honk', car: c.id });
      } else if (c.v > 0.3) c.wait = Math.max(0, c.wait - DT * 2);
      if (c.s >= c.path.len - 0.01) {
        c.gone = true;
        if (c.kind === 'car') { self.carsHome++; self.byColor[c.color]++; self.progress(c.color); self.events.push({ type: 'home', car: c.id, color: c.color }); }
        else self.events.push({ type: 'amb-through', car: c.id });
      }
    });
    this.cars = this.cars.filter(function (c) { return !c.gone; });
    this.waitAt = waitAt;
  };

  P.inBox = function (c) {
    return this.map.junctions.some(function (jn) { return Math.abs(c.x - jn.x) < BOX + 0.15 && Math.abs(c.y - jn.y) < BOX + 0.15; });
  };

  P.checkHits = function () {
    var self = this;
    this.walkers.forEach(function (w) {
      if (self.over || w.state !== 'cross') return;
      var p = self.walkerPos(w);
      var hit = self.cars.find(function (c) {
        var dx = p[0] - c.x, dy = p[1] - c.y, hx = Math.cos(c.h), hy = Math.sin(c.h);
        return Math.abs(dx * hx + dy * hy) < CAR.len / 2 + 0.12 && Math.abs(-dx * hy + dy * hx) < CAR.wid / 2 + 0.12 && c.v > 0.2;
      });
      if (hit) self.end('crash', { x: p[0], y: p[1], car: hit.id, walker: w.id, jay: !!w.jay });
    });
  };

  // ---------- scoring ----------

  P.points = function () { return Math.min(200000, 10 * this.carsHome + 15 * this.walked + 100 * this.missionsDone); };
  P.stars = function () { var d = this.trips(); return d >= STARS[2] ? 3 : d >= STARS[1] ? 2 : d >= STARS[0] ? 1 : 0; };

  var RH = {
    DT: DT, STRIKES: STRIKES, STARS: STARS, COLORS: COLORS, QUEUE: QUEUE, LANE: LANE, BOX: BOX, STOP: STOP, ROAD: ROAD, CAR: CAR, WALK: WALK, LIGHT: LIGHT,
    LEVELS: LEVELS, Rng: Rng, Path: Path, World: World, buildCity: buildCity, route: route
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = RH;
  else global.RushHour = RH;
})(typeof window !== 'undefined' ? window : globalThis);
