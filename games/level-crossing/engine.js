/*
 * Level Crossing engine: a little railway that never closes. Passengers in colored shirts wait on platforms and
 * want the station of their own color. You drive the passenger trains (go and brake), flip the track switches,
 * lower and raise the crossing barriers for the road traffic and, on the hardest level, set the red and green
 * signals that hold back a freight train you do not drive. Every map is generated fresh.
 * A crash (train into train, or train into car) ends the shift at once; so do five complaints (a passenger who
 * gave up, a traffic jam at a closed barrier, a freight train held at a red light too long). Finishing a mission
 * takes one complaint back. The railway gets busier over time, so every shift ends sooner or later.
 * Pure logic, CommonJS (the dev scripts use it too).
 */
(function (global) {
  'use strict';

  var DT = 1 / 30;
  var B = 4;          // a block of the map, in track units
  var R = 1;          // radius of every curve
  var M = 2.6;        // margin around the track, room for platforms and roads
  var STEP = 0.05;    // spacing of the points along each piece of track
  var STRIKES = 5;
  var STARS = [30, 70, 120]; // passengers delivered for one, two and three stars
  var COLORS = ['red', 'blue', 'green', 'yellow'];
  var TRAIN = { cars: 3, car: 1.15, gap: 0.14, vmax: 3.2, acc: 1.3, brake: 2.4, cap: 18, perPerson: 0.16 };
  var FREIGHT = { cars: 4, car: 1.15, gap: 0.14, vmax: 2.3, acc: 1.0, brake: 2.4 };
  var CAR = { len: 0.9, acc: 4, dec: 7, lane: 0.3 };
  var PLATFORM = 4.2;
  var ARM = 1.0; // seconds for a barrier to go down or up
  var FREIGHT_IN = 25; // seconds before Edith's freight train arrives

  /*
   * stations, trains (yours), chords (shortcuts with a switch), roads and crossings (total, min to max).
   * patience: seconds a passenger waits. rate: [passengers per second, extra per minute, most per second].
   * car: road traffic, sent by the level's robot. brain: random (anywhere), platoon (bunches of cars), aim
   * (aims for the crossing your next train reaches first). freight: Edith's freight train and the signals.
   */
  var LEVELS = {
    pip: {
      stations: 3, trains: 1, chords: 1, roads: 1, crossings: [2, 3], patience: 100, rate: [0.16, 0.08, 2],
      car: { brain: 'random', rate: [0.14, 0.03, 0.4], speed: [2.0, 2.6], patience: 16 }, freight: 0
    },
    gridlock: {
      stations: 4, trains: 1, chords: 2, roads: 2, crossings: [3, 5], patience: 100, rate: [0.2, 0.07, 2],
      car: { brain: 'platoon', rate: [0.2, 0.04, 0.5], speed: [2.2, 2.9], patience: 14 }, freight: 0
    },
    monolith: {
      stations: 4, trains: 2, chords: 2, roads: 2, crossings: [4, 6], patience: 72, rate: [0.5, 0.4, 3],
      car: { brain: 'aim', rate: [0.24, 0.05, 0.6], speed: [2.4, 3.1], patience: 13 }, freight: 0
    },
    edith: {
      stations: 4, trains: 2, chords: 2, roads: 2, crossings: [4, 6], patience: 72, rate: [0.5, 0.4, 3],
      car: { brain: 'aim', rate: [0.26, 0.05, 0.65], speed: [2.5, 3.2], patience: 13 }, freight: 1, hold: 12
    }
  };
  // block layouts by screen shape (columns, rows): the map fills a wide screen or a tall phone
  var SHAPES = [[7, 4], [6, 4], [5, 4], [5, 5], [4, 5], [4, 6], [3, 6]];

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
  function shapeFor(aspect) {
    var best = SHAPES[1], err = 1e9;
    SHAPES.forEach(function (s) {
      var a = (s[0] * B + 2 * M) / (s[1] * B + 2 * M), e = Math.abs(Math.log(a / aspect));
      if (e < err) { err = e; best = s; }
    });
    return best;
  }

  // ---------- map generation ----------

  // A random blob of blocks with no holes and no corner-only touches: its outline is one simple loop.
  function makeBlob(rng, bw, bh) {
    for (var tries = 0; tries < 400; tries++) {
      var cells = [], i, x, y;
      for (i = 0; i < bw * bh; i++) cells.push(0);
      var target = Math.round(bw * bh * (0.55 + rng.next() * 0.25));
      var start = rng.int(1, bw - 2) + rng.int(1, bh - 2) * bw;
      cells[start] = 1;
      var count = 1, guard = 0;
      while (count < target && guard++ < 5000) {
        var filled = [];
        for (i = 0; i < cells.length; i++) if (cells[i]) filled.push(i);
        var c = rng.pick(filled), d = rng.pick([[1, 0], [-1, 0], [0, 1], [0, -1]]);
        x = c % bw + d[0]; y = Math.floor(c / bw) + d[1];
        if (x < 0 || y < 0 || x >= bw || y >= bh || cells[x + y * bw]) continue;
        cells[x + y * bw] = 1;
        count++;
      }
      if (!blobOk(cells, bw, bh)) continue;
      return cells;
    }
    // a plain ring as the last resort
    var ring = [];
    for (i = 0; i < bw * bh; i++) ring.push(1);
    return ring;
  }
  function blobOk(cells, bw, bh) {
    function at(x, y) { return x < 0 || y < 0 || x >= bw || y >= bh ? 0 : cells[x + y * bw]; }
    var minx = bw, maxx = -1, miny = bh, maxy = -1, x, y;
    for (y = 0; y < bh; y++) for (x = 0; x < bw; x++) if (at(x, y)) { minx = Math.min(minx, x); maxx = Math.max(maxx, x); miny = Math.min(miny, y); maxy = Math.max(maxy, y); }
    if (maxx - minx < bw - 1 || maxy - miny < bh - 2) return false;
    // no corner-only touches
    for (y = -1; y < bh; y++) for (x = -1; x < bw; x++) {
      var a = at(x, y), b = at(x + 1, y), c = at(x, y + 1), d = at(x + 1, y + 1);
      if (a === d && b === c && a !== b) return false;
    }
    // no holes: every empty block reaches the outside
    var seen = {}, stack = [];
    for (x = -1; x <= bw; x++) { stack.push([x, -1]); stack.push([x, bh]); }
    for (y = 0; y < bh; y++) { stack.push([-1, y]); stack.push([bw, y]); }
    while (stack.length) {
      var p = stack.pop(), k = p[0] + ',' + p[1];
      if (seen[k] || p[0] < -1 || p[1] < -1 || p[0] > bw || p[1] > bh || at(p[0], p[1])) continue;
      seen[k] = 1;
      stack.push([p[0] + 1, p[1]], [p[0] - 1, p[1]], [p[0], p[1] + 1], [p[0], p[1] - 1]);
    }
    for (y = 0; y < bh; y++) for (x = 0; x < bw; x++) if (!at(x, y) && !seen[x + ',' + y]) return false;
    return true;
  }

  // The outline of the blob as corner points, running clockwise on screen (the inside is on the right).
  function outline(cells, bw, bh) {
    function at(x, y) { return x < 0 || y < 0 || x >= bw || y >= bh ? 0 : cells[x + y * bw]; }
    var next = {}, first = null, x, y;
    function add(ax, ay, bx, by) { next[ax + ',' + ay] = [bx, by]; if (!first) first = [ax, ay]; }
    for (y = 0; y < bh; y++) for (x = 0; x < bw; x++) {
      if (!at(x, y)) continue;
      if (!at(x, y - 1)) add(x, y, x + 1, y);
      if (!at(x + 1, y)) add(x + 1, y, x + 1, y + 1);
      if (!at(x, y + 1)) add(x + 1, y + 1, x, y + 1);
      if (!at(x - 1, y)) add(x, y + 1, x, y);
    }
    var pts = [first], cur = first;
    for (var guard = 0; guard < 1000; guard++) {
      var n = next[cur[0] + ',' + cur[1]];
      if (n[0] === first[0] && n[1] === first[1]) break;
      pts.push(n);
      cur = n;
    }
    // keep only the corners
    var corners = [];
    for (var i = 0; i < pts.length; i++) {
      var p = pts[(i + pts.length - 1) % pts.length], c = pts[i], q = pts[(i + 1) % pts.length];
      if ((c[0] - p[0]) * (q[1] - c[1]) - (c[1] - p[1]) * (q[0] - c[0]) !== 0) corners.push([M + c[0] * B, M + c[1] * B]);
    }
    return corners;
  }

  // A rough polyline with rounded corners, then points at an even spacing.
  function Builder(x, y, d) { this.pts = [[x, y]]; this.x = x; this.y = y; this.d = d; }
  Builder.prototype.line = function (len) {
    this.x += this.d[0] * len; this.y += this.d[1] * len;
    this.pts.push([this.x, this.y]);
  };
  Builder.prototype.turn = function (side) { // side 1: right, -1: left; a quarter circle of radius R
    var n = side > 0 ? right(this.d) : [this.d[1], -this.d[0]];
    var cx = this.x + n[0] * R, cy = this.y + n[1] * R;
    var a0 = Math.atan2(this.y - cy, this.x - cx);
    for (var k = 1; k <= 16; k++) {
      var a = a0 + side * (Math.PI / 2) * k / 16;
      this.pts.push([cx + Math.cos(a) * R, cy + Math.sin(a) * R]);
    }
    this.x = cx + this.d[0] * R; this.y = cy + this.d[1] * R;
    this.pts[this.pts.length - 1] = [this.x, this.y];
    this.d = n;
  };
  function resample(raw, step) {
    var cum = [0], i;
    for (i = 1; i < raw.length; i++) cum.push(cum[i - 1] + Math.hypot(raw[i][0] - raw[i - 1][0], raw[i][1] - raw[i - 1][1]));
    var total = cum[cum.length - 1], n = Math.max(1, Math.round(total / step)), st = total / n;
    var xs = new Float64Array(n + 1), ys = new Float64Array(n + 1), j = 0;
    for (i = 0; i <= n; i++) {
      var s = i * st;
      while (j < raw.length - 2 && cum[j + 1] < s) j++;
      var seg = cum[j + 1] - cum[j] || 1, f = Math.max(0, Math.min(1, (s - cum[j]) / seg));
      xs[i] = raw[j][0] + (raw[j + 1][0] - raw[j][0]) * f;
      ys[i] = raw[j][1] + (raw[j + 1][1] - raw[j][1]) * f;
    }
    return { x: xs, y: ys, len: total, step: st };
  }
  function loopPath(corners) {
    var n = corners.length;
    function dir(a, b) { var dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy); return [dx / l, dy / l]; }
    var d0 = dir(corners[0], corners[1]);
    var b = new Builder(corners[0][0] + d0[0] * R, corners[0][1] + d0[1] * R, d0);
    for (var i = 1; i <= n; i++) {
      var c = corners[i % n], p = corners[i - 1], q = corners[(i + 1) % n];
      var din = dir(p, c), dout = dir(c, q);
      b.line(Math.hypot(c[0] - b.x, c[1] - b.y) - R);
      var cross = din[0] * dout[1] - din[1] * dout[0];
      b.turn(cross > 0 ? 1 : -1);
    }
    return b.pts;
  }

  // Shortcuts across the inside: straight lines through the middle of a column (or row) of blocks.
  function chordOptions(cells, bw, bh, vertical) {
    var out = [], c, r;
    var outer = vertical ? bw : bh, inner = vertical ? bh : bw;
    function at(a, b) { var x = vertical ? a : b, y = vertical ? b : a; return x < 0 || y < 0 || x >= bw || y >= bh ? 0 : cells[x + y * bw]; }
    for (c = 0; c < outer; c++) {
      r = 0;
      while (r < inner) {
        if (!at(c, r)) { r++; continue; }
        var r0 = r;
        while (r < inner && at(c, r)) r++;
        var r1 = r - 1, along = M + (c + 0.5) * B, lo = M + r0 * B, hi = M + (r1 + 1) * B;
        out.push({ line: c, runs: r1 - r0 + 1, a: vertical ? [along, lo] : [lo, along], b: vertical ? [along, hi] : [hi, along], vertical: vertical });
      }
    }
    return out;
  }
  function chordPath(J1, d1, J2) {
    var n = right(d1), dist = Math.abs((J2[0] - J1[0]) * n[0] + (J2[1] - J1[1]) * n[1]);
    var b = new Builder(J1[0], J1[1], d1);
    b.turn(1);
    b.line(dist - 2 * R);
    b.turn(1);
    return b.pts;
  }

  function nearestS(path, x, y) {
    var best = 0, bd = 1e9;
    for (var i = 0; i < path.x.length; i++) {
      var d = (path.x[i] - x) * (path.x[i] - x) + (path.y[i] - y) * (path.y[i] - y);
      if (d < bd) { bd = d; best = i; }
    }
    return best * path.step;
  }

  function Edge(id, x, y, step, kind) {
    this.id = id; this.x = x; this.y = y; this.step = step; this.len = (x.length - 1) * step; this.kind = kind;
    this.from = -1; this.to = -1; this.stations = []; this.crossings = [];
  }
  Edge.prototype.at = function (s) {
    var f = Math.max(0, Math.min(this.x.length - 1, s / this.step)), i = Math.min(this.x.length - 2, Math.floor(f)), k = f - i;
    return [this.x[i] + (this.x[i + 1] - this.x[i]) * k, this.y[i] + (this.y[i + 1] - this.y[i]) * k, Math.atan2(this.y[i + 1] - this.y[i], this.x[i + 1] - this.x[i])];
  };
  Edge.prototype.dir = function (s) { var p = this.at(s); return [Math.cos(p[2]), Math.sin(p[2])]; };
  // true when the track is straight from a to b (the same direction all the way)
  Edge.prototype.straight = function (a, b) {
    if (a < 0 || b > this.len) return false;
    var d0 = this.dir(a);
    for (var s = a; s <= b; s += 0.1) { var d = this.dir(s); if (Math.abs(d[0] - d0[0]) > 0.01 || Math.abs(d[1] - d0[1]) > 0.01) return false; }
    return true;
  };

  function buildMap(levelId, rng, shape) {
    var cfg = LEVELS[levelId], bw = shape[0], bh = shape[1];
    for (var attempt = 0; attempt < 60; attempt++) {
      var map = tryMap(cfg, rng, bw, bh);
      if (map) return map;
    }
    return null;
  }

  function tryMap(cfg, rng, bw, bh) {
    var cells = makeBlob(rng, bw, bh);
    var corners = outline(cells, bw, bh);
    var loop = resample(loopPath(corners), STEP);
    loop.x[loop.x.length - 1] = loop.x[0]; loop.y[loop.y.length - 1] = loop.y[0];

    // shortcuts: all across the same way, one per line, preferring long ones
    var vertical = rng.next() < 0.5;
    var opts = chordOptions(cells, bw, bh, vertical);
    if (opts.length < cfg.chords) { vertical = !vertical; opts = chordOptions(cells, bw, bh, vertical); }
    rng.shuffle(opts);
    opts.sort(function (a, b) { return Math.min(b.runs, 3) - Math.min(a.runs, 3); });
    var chosen = [], used = {};
    opts.forEach(function (o) { if (chosen.length < cfg.chords && !used[o.line]) { used[o.line] = 1; chosen.push(o); } });
    if (chosen.length < cfg.chords) return null;

    // junction points on the loop
    var junc = [];
    chosen.forEach(function (o, ci) {
      var fromA = rng.next() < 0.5, J1 = fromA ? o.a : o.b, J2 = fromA ? o.b : o.a;
      var s1 = nearestS(loop, J1[0], J1[1]), s2 = nearestS(loop, J2[0], J2[1]);
      var i1 = Math.round(s1 / loop.step), d1 = [loop.x[i1 + 1] - loop.x[i1], loop.y[i1 + 1] - loop.y[i1]], l = Math.hypot(d1[0], d1[1]);
      d1 = [Math.round(d1[0] / l), Math.round(d1[1] / l)];
      var raw = chordPath([loop.x[i1], loop.y[i1]], d1, J2);
      junc.push({ s: s1, type: 'switch', chord: ci, raw: raw });
      junc.push({ s: s2, type: 'merge', chord: ci });
    });
    junc.sort(function (a, b) { return a.s - b.s; });
    for (var j = 0; j < junc.length; j++) {
      var nx = junc[(j + 1) % junc.length], gap = (nx.s - junc[j].s + loop.len) % loop.len;
      if (gap < 3) return null;
    }

    // nodes and edges
    var nodes = [], edges = [], N = loop.x.length - 1;
    junc.forEach(function (jn, k) {
      var i = Math.round(jn.s / loop.step) % N;
      jn.i = i;
      nodes.push({ id: k, type: jn.type, x: loop.x[i], y: loop.y[i], outs: [], ins: [], state: 0, chord: jn.chord, key: '' });
    });
    junc.forEach(function (jn, k) {
      var nk = (k + 1) % junc.length, i0 = jn.i, i1 = junc[nk].i, xs = [], ys = [];
      for (var i = i0; ; i = (i + 1) % N) { xs.push(loop.x[i]); ys.push(loop.y[i]); if (i === i1 && xs.length > 1) break; }
      var e = new Edge(edges.length, Float64Array.from(xs), Float64Array.from(ys), loop.step, 'loop');
      e.from = k; e.to = nk;
      nodes[k].outs.unshift(e.id); nodes[nk].ins.push(e.id);
      edges.push(e);
    });
    junc.forEach(function (jn, k) {
      if (jn.type !== 'switch') return;
      var mk = junc.findIndex(function (o) { return o.type === 'merge' && o.chord === jn.chord; });
      var m = nodes[mk];
      jn.raw[jn.raw.length - 1] = [m.x, m.y];
      var p = resample(jn.raw, STEP);
      var e = new Edge(edges.length, p.x, p.y, p.step, 'chord');
      e.from = k; e.to = mk;
      nodes[k].outs.push(e.id); nodes[mk].ins.push(e.id);
      edges.push(e);
    });

    var W = 2 * M + bw * B, H = 2 * M + bh * B;
    var map = { W: W, H: H, bw: bw, bh: bh, cells: cells, nodes: nodes, edges: edges, loopLen: loop.len, vertical: vertical, roads: [], crossings: [], stations: [], decor: [] };
    if (!placeRoads(map, cfg, rng)) return null;
    if (!placeStations(map, cfg, rng)) return null;
    placeDecor(map, rng);
    return map;
  }

  // is any piece of track (other than the given spans) within r of the point?
  function trackNear(map, x, y, r, skip) {
    for (var e = 0; e < map.edges.length; e++) {
      var E = map.edges[e];
      for (var i = 0; i < E.x.length; i += 2) {
        if (skip && skip(E, i * E.step)) continue;
        if (Math.abs(E.x[i] - x) < r && Math.abs(E.y[i] - y) < r && Math.hypot(E.x[i] - x, E.y[i] - y) < r) return true;
      }
    }
    return false;
  }

  function placeRoads(map, cfg, rng) {
    // roads run straight across the whole map, all the same way (either way round)
    var first = rng.next() < 0.5;
    return roadsOneWay(map, cfg, rng, first) || roadsOneWay(map, cfg, rng, !first);
  }
  function roadsOneWay(map, cfg, rng, horizontal) {
    var span = horizontal ? map.H : map.W, cands = [];
    for (var v = M + 0.5; v < span - M - 0.4; v += 0.5) cands.push(v);
    rng.shuffle(cands);
    var total = 0, roads = [];
    for (var ci = 0; ci < cands.length && roads.length < cfg.roads; ci++) {
      var v = cands[ci];
      if (roads.some(function (r) { return Math.abs(r.at - v) < 3.5; })) continue;
      var xs = findCrossings(map, horizontal, v);
      if (!xs) continue;
      var left = cfg.roads - roads.length - 1;
      if (total + xs.length > cfg.crossings[1] - left) continue;
      if (left === 0 && total + xs.length < cfg.crossings[0]) continue;
      roads.push({ id: roads.length, horizontal: horizontal, at: v, len: (horizontal ? map.W : map.H) + 6, xs: xs });
      total += xs.length;
    }
    if (roads.length < cfg.roads) return false;
    roads.forEach(function (r) {
      r.xs.sort(function (a, b) { return a.p - b.p; });
      r.crossings = r.xs.map(function (c) {
        var cr = { id: map.crossings.length, road: r.id, edge: c.edge, s: c.s, x: c.x, y: c.y, p: c.p, down: false, arm: 0, waitT: 0, honked: false, key: '' };
        map.crossings.push(cr);
        map.edges[c.edge].crossings.push(cr.id);
        return cr.id;
      });
      delete r.xs;
      map.roads.push(r);
    });
    return true;
  }
  // where a road line meets the track; null if it meets it badly (on a bend, near a junction, alongside)
  function findCrossings(map, horizontal, v) {
    var out = [];
    for (var e = 0; e < map.edges.length; e++) {
      var E = map.edges[e], arr = horizontal ? E.y : E.x, other = horizontal ? E.x : E.y;
      for (var i = 0; i < arr.length - 1; i++) {
        var a = arr[i] - v, b = arr[i + 1] - v;
        if (a === 0 || a * b < 0) {
          var s = i * E.step;
          if (s < 1.8 || s > E.len - 1.8 || !E.straight(s - 1.3, s + 1.3)) return null;
          var d = E.dir(s);
          if (Math.abs(horizontal ? d[1] : d[0]) < 0.99) return null;
          if (out.some(function (o) { return o.edge === e && Math.abs(o.s - s) < 1; })) continue;
          out.push({ edge: e, s: s, x: E.x[i], y: E.y[i], p: other[i] + 3 });
        }
      }
      // a track running alongside the road is not allowed
      for (i = 0; i < arr.length; i += 2) {
        if (Math.abs(arr[i] - v) < 1.1) {
          var dd = E.dir(i * E.step);
          if (Math.abs(horizontal ? dd[1] : dd[0]) < 0.7) return null;
        }
      }
    }
    // crossings on one road need room between them for the barriers and a waiting car
    out.sort(function (a, b) { return a.p - b.p; });
    for (var k = 1; k < out.length; k++) if (out[k].p - out[k - 1].p < 4.5) return null;
    return out.length ? out : null;
  }

  function nearRoad(map, x, y, r) {
    return map.roads.some(function (rd) { return Math.abs((rd.horizontal ? y : x) - rd.at) < r; });
  }

  function placeStations(map, cfg, rng) {
    var cands = [];
    map.edges.forEach(function (E) {
      for (var s0 = 2.2; s0 + PLATFORM < E.len - 1.4; s0 += 0.5) {
        if (!E.straight(s0 - 1.4, s0 + PLATFORM)) continue;
        if (E.crossings.some(function (c) { var cs = map.crossings[c].s; return cs > s0 - 2.2 && cs < s0 + PLATFORM + 2.4; })) continue;
        var d = E.dir(s0), L = [d[1], -d[0]];
        [1, -1].forEach(function (side) {
          if (E.kind === 'loop' && side < 0) return; // loop platforms go on the outside
          var ok = true;
          for (var s = s0 - 0.6; s <= s0 + PLATFORM + 0.6 && ok; s += 0.3) {
            var p = E.at(s);
            for (var off = 0.6; off <= 2.0; off += 0.35) {
              var x = p[0] + L[0] * side * off, y = p[1] + L[1] * side * off;
              if (x < 0.4 || y < 0.4 || x > map.W - 0.4 || y > map.H - 0.4 || nearRoad(map, x, y, 1.0) ||
                trackNear(map, x, y, 0.55, function (EE, ss) { return EE === E && Math.abs(ss - s) < 2.5; })) { ok = false; break; }
            }
          }
          if (ok) cands.push({ edge: E.id, s0: s0, side: side });
        });
      }
    });
    if (cands.length < cfg.stations) return false;
    rng.shuffle(cands);
    var picks = [];
    function centre(c) { var p = map.edges[c.edge].at(c.s0 + PLATFORM / 2); return p; }
    // one on a shortcut when possible, so the switches matter; the rest spread out
    var onChord = cands.filter(function (c) { return map.edges[c.edge].kind === 'chord'; });
    picks.push(onChord.length ? onChord[0] : cands[0]);
    while (picks.length < cfg.stations) {
      var best = null, bd = -1;
      cands.forEach(function (c) {
        if (picks.some(function (p) { return p.edge === c.edge && Math.abs(p.s0 - c.s0) < PLATFORM + 3; })) return;
        var pc = centre(c), dmin = 1e9;
        picks.forEach(function (p) { var q = centre(p); dmin = Math.min(dmin, Math.hypot(q[0] - pc[0], q[1] - pc[1])); });
        if (dmin > bd) { bd = dmin; best = c; }
      });
      if (!best || bd < 4) return false;
      picks.push(best);
    }
    var colors = rng.shuffle(COLORS.slice()).slice(0, cfg.stations);
    picks.forEach(function (c, i) {
      var E = map.edges[c.edge], mid = E.at(c.s0 + PLATFORM / 2), d = E.dir(c.s0), L = [d[1] * c.side, -d[0] * c.side];
      var st = {
        id: i, color: colors[i], edge: c.edge, s0: c.s0, s1: c.s0 + PLATFORM, side: c.side, x: mid[0], y: mid[1], nx: L[0], ny: L[1],
        sig: c.s0 - 1.1, red: false, waiting: [], key: ''
      };
      map.stations.push(st);
      E.stations.push(i);
    });
    return true;
  }

  function placeDecor(map, rng) {
    // houses line the roads first, like little villages; then trees, bushes and the odd house anywhere
    for (var k = 0; k < 340 && map.decor.length < 52; k++) {
      var x, y, house = false, r, big;
      if (k < 120 && map.roads.length) {
        var rd = map.roads[k % map.roads.length], along = rng.next() * (rd.horizontal ? map.W : map.H), side = (rng.next() < 0.5 ? -1 : 1) * (2.05 + rng.next() * 0.5);
        x = rd.horizontal ? along : rd.at + side; y = rd.horizontal ? rd.at + side : along;
        house = true; r = 1.15;
      } else {
        x = rng.next() * map.W; y = rng.next() * map.H; big = rng.next() < 0.32;
        r = big ? 1.1 : 0.7;
        house = big && rng.next() < 0.35;
      }
      if (x < -0.5 || y < -0.5 || x > map.W + 0.5 || y > map.H + 0.5) continue;
      if (trackNear(map, x, y, r + 0.5) || nearRoad(map, x, y, house ? 1.95 : r + 0.7)) continue;
      if (map.stations.some(function (s) { return Math.hypot(s.x + s.nx * 1.2 - x, s.y + s.ny * 1.2 - y) < PLATFORM / 2 + r + 0.6; })) continue;
      if (map.decor.some(function (d) { return Math.hypot(d.x - x, d.y - y) < d.r + r + 0.2; })) continue;
      map.decor.push({ x: x, y: y, r: r, kind: house ? 'house' : r > 1 ? 'tree' : (rng.next() < 0.7 ? 'tree' : 'bush'), hue: rng.int(0, 3) });
    }
  }

  // ---------- the running railway ----------

  function World(levelId, seed, aspect) {
    var cfg = LEVELS[levelId];
    this.level = levelId;
    this.cfg = cfg;
    this.rng = new Rng(seed || 1);
    this.map = buildMap(levelId, this.rng, shapeFor(aspect || 1.5));
    for (var tries = 0; !this.map && tries < 20; tries++) this.map = buildMap(levelId, this.rng, SHAPES[tries % 3]);
    this.t = 0;
    this.strikes = 0;
    this.delivered = 0;
    this.byColor = {};
    this.colors = this.map.stations.map(function (s) { return s.color; });
    var self = this;
    this.colors.forEach(function (c) { self.byColor[c] = 0; });
    this.missionsDone = 0;
    this.over = false;
    this.reason = '';
    this.crash = null;
    this.events = [];
    this.cars = [];
    this.nextId = 1;
    this.platoon = { left: 0, gap: 0, road: 0, dir: 1, wait: 3 };
    this.trains = [];
    this.lastGiveUp = -99;
    this.keys();
    // your trains start at stations, doors open; the freight starts across the map
    for (var i = 0; i < cfg.trains; i++) {
      var st = this.map.stations[i === 0 ? 0 : this.farStation(0)];
      this.trains.push(this.makeTrain('you', i, st.edge, st.s1 - 0.25));
    }
    // Edith's freight train rolls in a little later, at the spot farthest from your trains
    this.freightAt = cfg.freight ? FREIGHT_IN : Infinity;
    this.newMission();
    // a couple of people already waiting
    for (var k = 0; k < this.map.stations.length + 1; k++) this.spawnPassenger();
  }
  var P = World.prototype;

  P.keys = function () {
    var m = this.map;
    m.crossings.forEach(function (c, i) { c.key = String(i + 1); });
    var sw = m.nodes.filter(function (n) { return n.type === 'switch'; });
    sw.forEach(function (n, i) { n.key = 'ASD'[i] || ''; });
    if (this.cfg.freight) m.stations.forEach(function (s, i) { s.key = 'ZXCV'[i] || ''; });
  };

  P.makeTrain = function (kind, idx, edge, s) {
    var spec = kind === 'freight' ? FREIGHT : TRAIN;
    var t = {
      id: idx, kind: kind, e: edge, s: s, v: 0, hist: [], want: kind === 'freight' ? 'go' : 'stop',
      riders: [], cap: TRAIN.cap, station: -1, doorT: 0, doors: false, served: false, holdT: 0, odo: 0,
      spec: spec, length: spec.cars * spec.car + (spec.cars - 1) * spec.gap, key: kind === 'freight' ? '' : 'QW'[idx]
    };
    // fill in the track behind the train
    var need = t.length + 1, back = s, e = edge;
    while (back < need) {
      e = this.prevEdge(e);
      t.hist.unshift(e);
      back += this.map.edges[e].len;
    }
    return t;
  };
  P.prevEdge = function (e) {
    var n = this.map.nodes[this.map.edges[e].from], self = this;
    var loopIn = n.ins.filter(function (id) { return self.map.edges[id].kind === 'loop'; });
    return loopIn.length ? loopIn[0] : n.ins[0];
  };
  P.farStation = function (from) {
    var a = this.map.stations[from], best = 1, bd = -1;
    this.map.stations.forEach(function (s, i) {
      if (i === from) return;
      var d = Math.hypot(s.x - a.x, s.y - a.y);
      if (d > bd) { bd = d; best = i; }
    });
    return best;
  };
  // Where the freight train enters: on the loop, clear of platforms, crossings and junctions, with the most track
  // between it and the back of the nearest passenger train ahead (and none of them close behind it).
  P.freightStart = function () {
    var self = this, best = null, bd = -1, F = FREIGHT.cars * FREIGHT.car + (FREIGHT.cars - 1) * FREIGHT.gap;
    var cars = [];
    this.trains.forEach(function (t) { self.carsOf(t).forEach(function (c) { cars.push(c); }); });
    this.map.edges.forEach(function (E) {
      if (E.kind !== 'loop') return;
      for (var s = F + 1.5; s < E.len - 2; s += 1) {
        if (E.stations.some(function (k) { var st = self.map.stations[k]; return s > st.sig - 1 && s - F < st.s1 + 1; })) continue;
        if (E.crossings.some(function (c) { var cs = self.map.crossings[c].s; return cs > s - F - 1.5 && cs < s + 1.5; })) continue;
        // nobody on or next to the stretch it appears on
        var clash = false;
        for (var q = s - F; q <= s && !clash; q += 0.5) {
          var pt = E.at(q);
          clash = cars.some(function (c) { return Math.hypot(c[0] - pt[0], c[1] - pt[1]) < 3.5; });
        }
        if (clash) continue;
        var ahead = Infinity;
        self.ahead(E.id, s, 80, function (Ed, a, b, off) {
          cars.forEach(function (c) { if (c[3] === Ed.id && c[4] >= a && c[4] <= b) ahead = Math.min(ahead, off + c[4] - a); });
          return ahead < Infinity;
        });
        var behind = Infinity;
        self.trains.forEach(function (t) {
          self.ahead(t.e, t.s, 30, function (Ed, a, b, off) { if (Ed.id === E.id && s - F >= a && s - F <= b) { behind = Math.min(behind, off + s - F - a); return true; } });
        });
        var score = Math.min(ahead, 80) + Math.min(behind, 30) * 0.5;
        if (behind > 12 && score > bd) { bd = score; best = [E.id, s]; }
      }
    });
    return best;
  };
  P.addFreight = function () {
    var spot = this.freightStart();
    if (!spot) { this.freightAt = this.t + 3; return; }
    this.freightAt = Infinity;
    this.trains.push(this.makeTrain('freight', this.cfg.trains, spot[0], spot[1]));
    this.trains[this.trains.length - 1].v = FREIGHT.vmax * 0.6;
    this.events.push({ type: 'freight', train: this.cfg.trains });
  };

  P.nextEdge = function (e) {
    var n = this.map.nodes[this.map.edges[e].to];
    return n.type === 'switch' ? n.outs[n.state] : n.outs[0];
  };

  // a point d behind the head of train t: [x, y, angle, edge, s]
  P.behind = function (t, d) {
    var E = this.map.edges[t.e];
    if (d <= t.s) { var p = E.at(t.s - d); return [p[0], p[1], p[2], t.e, t.s - d]; }
    d -= t.s;
    for (var k = t.hist.length - 1; k >= 0; k--) {
      var H = this.map.edges[t.hist[k]];
      if (d <= H.len) { var q = H.at(H.len - d); return [q[0], q[1], q[2], H.id, H.len - d]; }
      d -= H.len;
    }
    var f = this.map.edges[t.hist[0] != null ? t.hist[0] : t.e].at(0);
    return [f[0], f[1], f[2], t.e, 0];
  };
  P.trainHead = function (t) { return this.behind(t, 0); };
  // the middle of each car: [x, y, angle, edge, s]
  P.carsOf = function (t) {
    var out = [], sp = t.spec;
    for (var i = 0; i < sp.cars; i++) out.push(this.behind(t, i * (sp.car + sp.gap) + sp.car / 2));
    return out;
  };

  // Walks the track ahead of (e, s) for up to D units, following the switches as they are set now.
  // fn(edge, from, to, offset) gets each stretch; returning true stops the walk.
  P.ahead = function (e, s, D, fn) {
    var off = 0, guard = 0;
    while (off < D && guard++ < 40) {
      var E = this.map.edges[e], to = Math.min(E.len, s + (D - off));
      if (fn(E, s, to, off)) return;
      off += E.len - s;
      e = this.nextEdge(e);
      s = 0;
    }
  };

  P.brakeDist = function (t) { return t.v * t.v / (2 * t.spec.brake); };

  // the nearest red light ahead of a train: the distance to stop at, or Infinity
  P.redAhead = function (t, D) {
    var self = this, found = Infinity;
    if (!this.cfg.freight) return found;
    this.ahead(t.e, t.s, D, function (E, a, b, off) {
      for (var i = 0; i < E.stations.length; i++) {
        var st = self.map.stations[E.stations[i]];
        if (st.red && st.sig >= a - 1e-6 && st.sig <= b) { found = Math.min(found, off + st.sig - a - 0.3); }
      }
      return found < Infinity;
    });
    return found;
  };

  P.atStation = function (t) {
    if (t.kind !== 'you') return -1;
    var cars = this.carsOf(t), self = this;
    for (var k = 0; k < this.map.stations.length; k++) {
      var st = this.map.stations[k], n = 0;
      cars.forEach(function (c) { if (c[3] === st.edge && c[4] >= st.s0 - 0.2 && c[4] <= st.s1 + 0.2) n++; });
      if (n >= 2) return k;
    }
    return -1;
  };

  // ---------- controls ----------

  P.setWant = function (i, want) {
    var t = this.trains[i];
    if (!t || t.kind !== 'you' || this.over) return false;
    if (t.want === want) return false;
    t.want = want;
    if (want === 'go') {
      if (t.doors) { t.doors = false; this.events.push({ type: 'doors-close', train: i }); }
      this.events.push({ type: 'depart', train: i });
    } else if (t.v > 0.6) this.events.push({ type: 'brake', train: i });
    return true;
  };
  P.toggleTrain = function (i) {
    var t = this.trains[i];
    if (!t || t.kind !== 'you') return false;
    return this.setWant(i, t.want === 'go' ? 'stop' : 'go');
  };
  P.switchBusy = function (n) {
    var self = this, node = this.map.nodes[n];
    return this.trains.some(function (t) {
      return self.carsOf(t).some(function (c) { return Math.hypot(c[0] - node.x, c[1] - node.y) < 1.5; });
    });
  };
  P.flipSwitch = function (n) {
    var node = this.map.nodes[n];
    if (!node || node.type !== 'switch' || this.over) return false;
    if (this.switchBusy(n)) { this.events.push({ type: 'switch-busy', node: n }); return false; }
    node.state = 1 - node.state;
    this.events.push({ type: 'switch', node: n, state: node.state });
    return true;
  };
  P.setBarrier = function (c, down) {
    var cr = this.map.crossings[c];
    if (!cr || this.over || cr.down === down) return false;
    cr.down = down;
    if (!down) cr.waitT = 0;
    this.events.push({ type: down ? 'barrier-down' : 'barrier-up', crossing: c });
    return true;
  };
  P.toggleBarrier = function (c) { var cr = this.map.crossings[c]; return cr ? this.setBarrier(c, !cr.down) : false; };
  P.setSignal = function (k, red) {
    var st = this.map.stations[k];
    if (!st || !this.cfg.freight || this.over || st.red === red) return false;
    st.red = red;
    this.events.push({ type: 'signal', station: k, red: red });
    return true;
  };
  P.toggleSignal = function (k) { var st = this.map.stations[k]; return st ? this.setSignal(k, !st.red) : false; };

  // ---------- passengers and missions ----------

  P.rate = function (r) { return Math.min(r[2], r[0] + r[1] * this.t / 60); };

  P.spawnPassenger = function () {
    var sts = this.map.stations, k = this.rng.int(0, sts.length - 1), st = sts[k];
    var others = this.colors.filter(function (c) { return c !== st.color; });
    st.waiting.push({ id: this.nextId++, color: this.rng.pick(others), born: this.t, patience: this.cfg.patience * (0.85 + this.rng.next() * 0.3), look: this.rng.int(0, 5) });
  };

  P.newMission = function () {
    var n = this.missionsDone, cols = this.rng.shuffle(this.colors.slice()).slice(0, Math.min(this.colors.length, n < 2 ? 2 : 3));
    var total = 6 + n * 2, need = {}, got = {};
    cols.forEach(function (c, i) { need[c] = Math.floor(total / cols.length) + (i < total % cols.length ? 1 : 0); got[c] = 0; });
    this.mission = { n: n + 1, need: need, got: got };
  };

  P.deliver = function (t, st, p) {
    this.delivered++;
    this.byColor[p.color] = (this.byColor[p.color] || 0) + 1;
    var m = this.mission;
    if (m.need[p.color] && m.got[p.color] < m.need[p.color]) m.got[p.color]++;
    this.events.push({ type: 'deliver', train: t.id, station: st.id, color: p.color });
    var done = Object.keys(m.need).every(function (c) { return m.got[c] >= m.need[c]; });
    if (done) {
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
    this.over = true;
    this.reason = reason;
    this.crash = crash || null;
    this.events.push({ type: 'end', reason: reason, crash: crash || null });
  };

  // ---------- road traffic ----------

  P.roadPoint = function (road, p, dir) {
    var off = CAR.lane * (dir > 0 ? 1 : -1);
    // drive on the right: going +x the right side is +y; going +y the right side is -x
    return road.horizontal ? [p - 3, road.at + off] : [road.at - off, p - 3];
  };

  P.spawnCar = function (roadId, dir) {
    var road = this.map.roads[roadId], c = this.cfg.car;
    var p = dir > 0 ? 0 : road.len;
    // keep the lane clear at the entrance
    if (this.cars.some(function (k) { return k.road === roadId && k.dir === dir && Math.abs(k.p - p) < CAR.len + 0.8; })) return false;
    this.cars.push({ id: this.nextId++, road: roadId, dir: dir, p: p, v: c.speed[0] + this.rng.next() * (c.speed[1] - c.speed[0]), vmax: 0, look: this.rng.int(0, 5), wait: 0 });
    var car = this.cars[this.cars.length - 1];
    car.vmax = car.v;
    return true;
  };

  // which crossing will a passenger train reach first, and how soon (seconds)?
  P.nextCrossingFor = function (t) {
    var self = this, best = null;
    this.ahead(t.e, t.s, 30, function (E, a, b, off) {
      for (var i = 0; i < E.crossings.length; i++) {
        var cr = self.map.crossings[E.crossings[i]];
        if (cr.s >= a && cr.s <= b) { var d = off + cr.s - a; if (!best || d < best.d) best = { c: cr.id, d: d }; }
      }
      return !!best;
    });
    if (best) best.eta = best.d / Math.max(1.2, t.v);
    return best;
  };

  P.trafficStep = function () {
    var c = this.cfg.car, rate = this.rate(c.rate), roads = this.map.roads, self = this;
    if (c.brain === 'platoon') {
      var pl = this.platoon;
      if (pl.left > 0) {
        pl.gap -= DT;
        if (pl.gap <= 0 && this.spawnCar(pl.road, pl.dir)) { pl.left--; pl.gap = 0.7; }
      } else {
        pl.wait -= DT;
        if (pl.wait <= 0) {
          var size = this.rng.int(3, 5);
          pl.left = size; pl.gap = 0; pl.road = this.rng.int(0, roads.length - 1); pl.dir = this.rng.next() < 0.5 ? 1 : -1;
          pl.wait = size / rate * (0.7 + this.rng.next() * 0.6);
        }
      }
    } else if (this.rng.next() < rate * DT) {
      var road = this.rng.int(0, roads.length - 1), dir = this.rng.next() < 0.5 ? 1 : -1;
      if (c.brain === 'aim' && this.rng.next() < 0.7) {
        // aim for the crossing the next passenger train reaches first
        var soon = null;
        this.trains.forEach(function (t) { if (t.kind !== 'you') return; var n = self.nextCrossingFor(t); if (n && (!soon || n.eta < soon.eta)) soon = n; });
        if (soon) {
          var cr = this.map.crossings[soon.c];
          road = cr.road;
          // come from the side that reaches the crossing about when the train does
          var r = roads[road], tUp = cr.p / 2.6, tDown = (r.len - cr.p) / 2.6;
          dir = Math.abs(tUp - soon.eta) < Math.abs(tDown - soon.eta) ? 1 : -1;
        }
      }
      this.spawnCar(road, dir);
    }

    // drive
    var blockedBy = {};
    var lanes = {};
    this.cars.forEach(function (k) { var key = k.road + ':' + k.dir; (lanes[key] = lanes[key] || []).push(k); });
    Object.keys(lanes).forEach(function (key) {
      var list = lanes[key];
      list.sort(function (a, b) { return (b.p - a.p) * a.dir; }); // the front car first
      for (var i = 0; i < list.length; i++) {
        var k = list[i], road = roads[k.road], room = 1e9, front = k.p + k.dir * CAR.len / 2, stopAt = null;
        if (i > 0) room = Math.abs(list[i - 1].p - k.p) - CAR.len - 0.35;
        road.crossings.forEach(function (cid) {
          var cr = self.map.crossings[cid], line = cr.p - k.dir * 0.95, d = (line - front) * k.dir;
          if (d < -0.05) return; // already past the stop line
          var closed = cr.arm > 0.12 || cr.down || self.trainOn(cr, 1.3);
          // never stop on the tracks: wait until there is room on the far side
          // (cars can stop at once, so the car in front must already be far enough past the crossing)
          if (!closed && i > 0 && (list[i - 1].p - cr.p) * k.dir < 0.9 + CAR.len + 0.4) closed = true;
          if (closed && d < room) { room = d; stopAt = cid; }
        });
        var target = Math.min(k.vmax, Math.sqrt(2 * CAR.dec * Math.max(0, room)));
        k.v = target > k.v ? Math.min(target, k.v + CAR.acc * DT) : target;
        k.p += k.dir * k.v * DT;
        if (k.v < 0.05) {
          k.wait += DT;
          if (stopAt != null) blockedBy[stopAt] = true;
        } else k.wait = 0;
      }
    });
    this.cars = this.cars.filter(function (k) { return k.p > -1 && k.p < roads[k.road].len + 1; });

    // impatience at closed barriers
    this.map.crossings.forEach(function (cr) {
      if (blockedBy[cr.id] && cr.down) {
        cr.waitT += DT;
        if (cr.waitT > c.patience * 0.6 && !cr.honked) { cr.honked = true; self.events.push({ type: 'honk', crossing: cr.id }); }
        if (cr.waitT > c.patience) {
          cr.waitT = 0;
          cr.honked = false;
          self.strike('jam', { crossing: cr.id });
        }
      } else if (!blockedBy[cr.id]) { cr.waitT = Math.max(0, cr.waitT - DT * 2); if (cr.waitT === 0) cr.honked = false; }
    });
  };

  P.trainOn = function (cr, r) {
    var self = this;
    return this.trains.some(function (t) {
      return self.carsOf(t).some(function (c) { return Math.hypot(c[0] - cr.x, c[1] - cr.y) < r; });
    });
  };
  P.carOn = function (cr) {
    var self = this;
    return this.cars.find(function (k) { return k.road === cr.road && Math.abs(k.p - cr.p) < CAR.len / 2 + 0.45; });
  };
  P.carPos = function (k) { return this.roadPoint(this.map.roads[k.road], k.p, k.dir); };

  // ---------- one tick ----------

  P.step = function () {
    if (this.over) return;
    var self = this, cfg = this.cfg, i;
    this.t += DT;

    // barriers move
    this.map.crossings.forEach(function (cr) {
      cr.arm = cr.down ? Math.min(1, cr.arm + DT / ARM) : Math.max(0, cr.arm - DT / ARM);
    });

    // passengers
    if (this.rng.next() < this.rate(cfg.rate) * DT) this.spawnPassenger();
    this.map.stations.forEach(function (st) {
      for (var j = st.waiting.length - 1; j >= 0; j--) {
        var p = st.waiting[j];
        if (self.t - p.born > p.patience) {
          st.waiting.splice(j, 1);
          self.strike('gaveup', { station: st.id, color: p.color });
          if (self.over) return;
        }
      }
    });
    if (this.over) return;

    // trains
    if (this.t >= this.freightAt) this.addFreight();
    this.trains.forEach(function (t) { self.moveTrain(t); });
    if (this.over) return;

    // boarding
    this.trains.forEach(function (t) { if (t.kind === 'you') self.board(t); });

    // the road
    this.trafficStep();
    if (this.over) return;

    this.checkCrashes();
  };

  P.moveTrain = function (t) {
    var sp = t.spec, cfg = this.cfg, target;
    if (t.kind === 'freight') target = sp.vmax;
    else target = t.want === 'go' && !t.doors ? sp.vmax : 0;
    var red = this.redAhead(t, this.brakeDist(t) + 4);
    var allowed = red < Infinity ? Math.sqrt(2 * sp.brake * Math.max(0, red)) : Infinity;
    if (target > t.v && t.v < allowed) t.v = Math.min(target, allowed, t.v + sp.acc * DT);
    else if (t.v > target || t.v > allowed) t.v = Math.max(Math.max(0, Math.min(target, allowed)), t.v - sp.brake * DT);
    if (red < 0.05 && t.v < 0.3) t.v = 0;

    // a freight train held at a red light too long makes a complaint
    if (t.kind === 'freight') {
      if (t.v < 0.05 && red < 1.5) {
        t.holdT += DT;
        if (t.holdT > cfg.hold) { t.holdT = 0; this.strike('late', { train: t.id }); }
      } else t.holdT = Math.max(0, t.holdT - DT);
    }

    var move = t.v * DT, before = t.s, e0 = t.e;
    t.odo += move;
    t.s += move;
    while (t.s >= this.map.edges[t.e].len) {
      t.s -= this.map.edges[t.e].len;
      t.hist.push(t.e);
      t.e = this.nextEdge(t.e);
    }
    // trim the history to what the cars need
    var need = t.length + 2, have = t.s, keep = 0;
    for (var k = t.hist.length - 1; k >= 0 && have < need; k--) { have += this.map.edges[t.hist[k]].len; keep++; }
    if (t.hist.length > keep) t.hist.splice(0, t.hist.length - keep);

    // crossings passed by the front of the train
    var self = this;
    [[e0, before, e0 === t.e ? t.s : this.map.edges[e0].len]].concat(e0 === t.e ? [] : [[t.e, 0, t.s]]).forEach(function (r) {
      self.map.edges[r[0]].crossings.forEach(function (cid) {
        var cr = self.map.crossings[cid];
        if (cr.s > r[1] && cr.s <= r[2]) self.events.push({ type: 'pass', crossing: cid, train: t.id, up: cr.arm < 0.9 });
      });
    });
    if (t.kind === 'you' && t.v > 0.3) { t.station = -1; t.served = false; }
  };

  P.board = function (t) {
    if (t.v > 0.01) { t.doors = false; return; }
    var k = this.atStation(t);
    if (k < 0) { t.station = -1; return; }
    var st = this.map.stations[k];
    if (t.station !== k) {
      t.station = k;
      t.doorT = 0.5;
      t.doors = true;
      this.events.push({ type: 'doors-open', train: t.id, station: k });
    }
    if (!t.doors) return;
    t.doorT -= DT;
    if (t.doorT > 0) return;
    // riders for this color get off first, then waiting people get on
    var idx = -1;
    for (var i = 0; i < t.riders.length; i++) if (t.riders[i].color === st.color) { idx = i; break; }
    if (idx >= 0) {
      var p = t.riders.splice(idx, 1)[0];
      this.deliver(t, st, p);
      t.doorT = TRAIN.perPerson;
      return;
    }
    if (st.waiting.length && t.riders.length < t.cap) {
      // the most impatient first
      var w = 0;
      for (i = 1; i < st.waiting.length; i++) if (st.waiting[i].born + st.waiting[i].patience < st.waiting[w].born + st.waiting[w].patience) w = i;
      var q = st.waiting.splice(w, 1)[0];
      t.riders.push(q);
      this.events.push({ type: 'board', train: t.id, station: k, color: q.color });
      t.doorT = TRAIN.perPerson;
      return;
    }
    if (!t.served) { t.served = true; this.events.push({ type: 'ready', train: t.id, station: k }); }
  };

  P.checkCrashes = function () {
    var self = this, ts = this.trains, a, b;
    var cars = ts.map(function (t) { return self.carsOf(t); });
    for (a = 0; a < ts.length; a++) for (b = a + 1; b < ts.length; b++) {
      for (var i = 0; i < cars[a].length; i++) for (var j = 0; j < cars[b].length; j++) {
        var p = cars[a][i], q = cars[b][j];
        if (Math.hypot(p[0] - q[0], p[1] - q[1]) < 0.8) { this.end('crash', { kind: 'trains', x: (p[0] + q[0]) / 2, y: (p[1] + q[1]) / 2, a: ts[a].id, b: ts[b].id }); return; }
      }
    }
    this.map.crossings.forEach(function (cr) {
      if (self.over) return;
      var k = self.carOn(cr);
      if (!k) return;
      for (var a = 0; a < ts.length; a++) {
        if (cars[a].some(function (c) { return Math.hypot(c[0] - cr.x, c[1] - cr.y) < 0.85; })) {
          self.end('crash', { kind: 'car', x: cr.x, y: cr.y, crossing: cr.id, train: ts[a].id, car: k.id });
          return;
        }
      }
    });
  };

  // ---------- scoring ----------

  P.points = function () { return Math.min(200000, 10 * this.delivered + 100 * this.missionsDone); };
  P.stars = function () { var d = this.delivered; return d >= STARS[2] ? 3 : d >= STARS[1] ? 2 : d >= STARS[0] ? 1 : 0; };
  P.waiting = function () { return this.map.stations.reduce(function (n, s) { return n + s.waiting.length; }, 0); };
  P.onBoard = function () { return this.trains.reduce(function (n, t) { return n + t.riders.length; }, 0); };

  var LC = {
    DT: DT, B: B, R: R, M: M, STRIKES: STRIKES, STARS: STARS, COLORS: COLORS, TRAIN: TRAIN, FREIGHT: FREIGHT, CAR: CAR,
    PLATFORM: PLATFORM, ARM: ARM, FREIGHT_IN: FREIGHT_IN, LEVELS: LEVELS, SHAPES: SHAPES, shapeFor: shapeFor, Rng: Rng, World: World, buildMap: buildMap
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = LC;
  else global.LevelCrossing = LC;
})(typeof window !== 'undefined' ? window : globalThis);
