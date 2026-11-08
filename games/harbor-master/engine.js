/*
 * Harbor Master engine: a busy harbor with one cargo ship you steer yourself. Ships do not stop or turn on the
 * spot: the rudder swings slowly, the engine telegraph has five steps from full astern to full ahead, and the
 * ship's speed and turning catch up with them gradually. A forecast shows where the ship will be over the next
 * seconds with the controls as they are. Colored crates wait on the docks for a ship to take them to the dock of
 * their color. Stop alongside a dock and the cranes swap the cargo. A drawbridge carries a road across the harbor
 * (raise it to pass, but the drivers hate waiting), and robot boats are about: ramming one, or a lowered bridge,
 * ends the shift at once (a gentle touch is only a nudge). Hitting the shore hard costs a complaint; so does a crate that waits too long, a crate
 * turned away by a full dock, or a long
 * wait at the bridge. Five complaints end the shift; finishing a mission takes one back. Cargo keeps coming faster.
 * Pure logic, CommonJS (the dev scripts use it too).
 */
(function (global) {
  'use strict';

  var DT = 1 / 30;
  var STRIKES = 5;
  var STARS = [20, 50, 100]; // crates delivered for one, two and three stars
  var COLORS = ['red', 'blue', 'green', 'yellow'];
  var TELEGRAPH = [-1.0, -0.55, 0, 1.25, 2.4]; // target speed for full astern .. full ahead
  var SHIP = { len: 1.7, beam: 0.58, acc: 0.5, turn: 0.58, rudder: 1.3, yawLag: 0.8, cap: 6, crunch: 1.75, ram: 0.7 };
  var GRID = 0.5;     // water grid for route finding
  var FORECAST = 8;   // seconds of forecast
  var BERTH = 1.6;    // how close to a dock counts as alongside
  var BRIDGE = { span: 4.2, time: 2.2 };
  var THRUSTER = 0.45; // radians per second of turning on the spot

  /*
   * docks (colors), islands, bridge (a road across the harbor with a drawbridge), rate: crates per second [start,
   * extra per minute, most], patience: seconds a crate waits, bridgeWait: seconds drivers wait at a raised bridge,
   * boats: robot boats: sail (drifting sailboats), ferry (back and forth on a line), fish (wandering trawlers),
   * speed (Edith's speedboat: heads for where you are going). big: a longer ship that turns more slowly.
   */
  var LEVELS = {
    pip: { docks: 3, islands: 1, bridge: false, rate: [0.05, 0.06, 3], patience: 140, bridgeWait: 24, boats: ['sail', 'sail'], big: false },
    gridlock: { docks: 4, islands: 2, bridge: true, rate: [0.06, 0.022, 0.45], patience: 125, bridgeWait: 28, boats: ['sail', 'ferry'], big: false },
    monolith: { docks: 4, islands: 2, bridge: true, rate: [0.07, 0.025, 0.5], patience: 115, bridgeWait: 26, boats: ['ferry', 'fish', 'fish'], big: false },
    edith: { docks: 4, islands: 2, bridge: true, rate: [0.064, 0.023, 0.5], patience: 124, bridgeWait: 26, boats: ['ferry', 'fish', 'speed'], big: true }
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

  function inPoly(pts, x, y) {
    var inside = false;
    for (var i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      var xi = pts[i][0], yi = pts[i][1], xj = pts[j][0], yj = pts[j][1];
      if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) inside = !inside;
    }
    return inside;
  }

  // ---------- the harbor ----------

  function buildHarbor(levelId, rng, aspect) {
    var cfg = LEVELS[levelId];
    for (var tries = 0; tries < 80; tries++) {
      var m = tryHarbor(cfg, rng, aspect);
      if (m) return m;
    }
    return null;
  }

  function tryHarbor(cfg, rng, aspect) {
    var land = aspect >= 1;
    // the harbor is always laid out wide (coasts top and bottom); on a tall screen it is turned on its side
    var W = land ? Math.max(26, Math.min(40, Math.round(20 * aspect))) : Math.max(26, Math.min(40, Math.round(20 / aspect)));
    var H = 20;
    function wave() { var p = [rng.next() * 6, rng.next() * 6, rng.next() * 6], f = [0.18 + rng.next() * 0.1, 0.37 + rng.next() * 0.2, 0.8 + rng.next() * 0.3]; return function (x) { return 0.9 * Math.sin(x * f[0] + p[0]) + 0.5 * Math.sin(x * f[1] + p[1]) + 0.2 * Math.sin(x * f[2] + p[2]); }; }
    var wt = wave(), wb = wave(), dt0 = 3.0 + rng.next() * 0.6, db0 = 3.0 + rng.next() * 0.6;
    function top(x) { return Math.max(1.6, Math.min(5.2, dt0 + wt(x))); }
    function bottom(x) { return H - Math.max(1.6, Math.min(5.2, db0 + wb(x))); }
    var polys = [], tp = [], bp = [], x;
    for (x = -3; x <= W + 3; x += 0.5) { tp.push([x, top(x)]); bp.push([x, bottom(x)]); }
    tp.push([W + 3, -3], [-3, -3]);
    bp.push([W + 3, H + 3], [-3, H + 3]);
    polys.push({ kind: 'coast', pts: tp }, { kind: 'coast', pts: bp });
    var bridge = null;
    if (cfg.bridge) {
      var bx = W * (0.42 + rng.next() * 0.16), gy = H / 2 + (rng.next() - 0.5) * 3, hw = 0.85, gap = BRIDGE.span / 2;
      polys.push({ kind: 'causeway', pts: [[bx - hw, -3], [bx + hw, -3], [bx + hw, gy - gap], [bx - hw, gy - gap]] });
      polys.push({ kind: 'causeway', pts: [[bx - hw, gy + gap], [bx + hw, gy + gap], [bx + hw, H + 3], [bx - hw, H + 3]] });
      bridge = { x: bx, y: gy, hw: hw, gap: gap, arm: 0, up: false, cars: [], waitT: 0, honked: false };
    }
    // islands and rocks, clear of the coasts and the causeway
    function blob(cx, cy, r, n) {
      var a = [rng.next() * 6, rng.next() * 6], pts = [];
      for (var i = 0; i < n; i++) { var t = i / n * Math.PI * 2, rr = r * (1 + 0.16 * Math.sin(t * 2 + a[0]) + 0.1 * Math.sin(t * 3 + a[1])); pts.push([cx + Math.cos(t) * rr, cy + Math.sin(t) * rr]); }
      return pts;
    }
    var placed = [];
    for (var k = 0; k < cfg.islands; k++) {
      for (var g = 0; g < 40; g++) {
        var r = 1.1 + rng.next() * 1.0, cx = 4 + rng.next() * (W - 8), cy = H * 0.5 + (rng.next() - 0.5) * 4;
        if (cy - r < top(cx) + 3.6 || cy + r > bottom(cx) - 3.6) continue;
        if (bridge && Math.abs(cx - bridge.x) < r + 3.5) continue;
        if (placed.some(function (p) { return Math.hypot(p[0] - cx, p[1] - cy) < p[2] + r + 4; })) continue;
        placed.push([cx, cy, r]);
        polys.push({ kind: 'island', pts: blob(cx, cy, r, 28), cx: cx, cy: cy, r: r });
        break;
      }
    }
    for (k = 0; k < 3; k++) {
      for (g = 0; g < 30; g++) {
        var rr2 = 0.32 + rng.next() * 0.2, rx = 3 + rng.next() * (W - 6), ry = top(rx) + 1.0 + rng.next() * 1.4;
        if (rng.next() < 0.5) ry = bottom(rx) - 1.0 - rng.next() * 1.4;
        if (bridge && Math.abs(rx - bridge.x) < 3) continue;
        if (placed.some(function (p) { return Math.hypot(p[0] - rx, p[1] - ry) < p[2] + rr2 + 2.2; })) continue;
        placed.push([rx, ry, rr2]);
        polys.push({ kind: 'rock', pts: blob(rx, ry, rr2, 10), cx: rx, cy: ry, r: rr2 });
        break;
      }
    }
    var m = { W: W, H: H, land: land, polys: polys, bridge: bridge, top: top, bottom: bottom, docks: [] };
    m.isLand = function (px, py) {
      if (py < top(px) || py > bottom(px)) return true;
      for (var i = 2; i < polys.length; i++) { var P = polys[i]; if (inPoly(P.pts, px, py)) return true; }
      return false;
    };
    // the water grid, with room for a ship around every cell
    var gw = Math.ceil(W / GRID), gh = Math.ceil(H / GRID), water = new Uint8Array(gw * gh);
    for (var gy2 = 0; gy2 < gh; gy2++) for (var gx = 0; gx < gw; gx++) {
      var wx = (gx + 0.5) * GRID, wy = (gy2 + 0.5) * GRID, ok = !m.isLand(wx, wy);
      for (var a = 0; a < 12 && ok; a++) for (var rr3 = 0.55; rr3 <= 1.1 && ok; rr3 += 0.55) if (m.isLand(wx + Math.cos(a * Math.PI / 6) * rr3, wy + Math.sin(a * Math.PI / 6) * rr3)) ok = false;
      water[gy2 * gw + gx] = ok ? 1 : 0;
    }
    m.grid = { w: gw, h: gh, water: water };
    // a second grid with more room around every cell, for routes that keep well off the shore
    var wide = new Uint8Array(gw * gh);
    for (var c2 = 0; c2 < gw * gh; c2++) {
      if (!water[c2]) continue;
      var cx3 = c2 % gw, cy3 = (c2 / gw) | 0, ok2 = true;
      for (var oy = -1; oy <= 1 && ok2; oy++) for (var ox = -1; ox <= 1 && ok2; ox++) {
        var nx3 = cx3 + ox, ny3 = cy3 + oy;
        if (nx3 >= 0 && ny3 >= 0 && nx3 < gw && ny3 < gh && !water[ny3 * gw + nx3]) ok2 = false;
      }
      wide[c2] = ok2 ? 1 : 0;
    }
    m.wide = wide;
    // docks along the coasts, spread out, on both sides of the bridge
    var colors = rng.shuffle(COLORS.slice()).slice(0, cfg.docks), cands = [];
    for (x = 3; x < W - 3; x += 0.5) {
      [0, 1].forEach(function (side) {
        var base = side ? bottom(x) : top(x), dir = side ? -1 : 1, by2 = base + dir * 2.6;
        if (bridge && Math.abs(x - bridge.x) < 3.2) return;
        // a straight bit of coast for the quay
        var slope = Math.abs((side ? bottom(x + 0.6) - bottom(x - 0.6) : top(x + 0.6) - top(x - 0.6)));
        if (slope > 0.7) return;
        var cell = Math.floor(by2 / GRID) * gw + Math.floor(x / GRID);
        if (!water[cell]) return;
        if (polys.some(function (P, i) { return i >= 2 && P.kind !== 'causeway' && Math.hypot((P.cx || -99) - x, (P.cy || -99) - by2) < (P.r || 0) + 2.2; })) return;
        cands.push({ x: x, side: side, base: base, by: by2 });
      });
    }
    rng.shuffle(cands);
    var picks = [];
    for (var c = 0; c < cands.length && picks.length < colors.length; c++) {
      var cd = cands[c];
      if (picks.some(function (p) { return Math.hypot(p.x - cd.x, p.by - cd.by) < 7; })) continue;
      // keep docks on both sides of the bridge
      if (bridge && picks.length === colors.length - 1) {
        var left = picks.filter(function (p) { return p.x < bridge.x; }).length;
        if ((left === 0 && cd.x > bridge.x) || (left === picks.length && cd.x < bridge.x)) continue;
      }
      picks.push(cd);
    }
    if (picks.length < colors.length) return null;
    picks.forEach(function (p, i) {
      m.docks.push({ id: i, color: colors[i], x: p.x, y: p.by, base: p.base, side: p.side, crates: [], key: String(i + 1) });
    });
    // every dock must be reachable from every other
    var start = cellOf(m, m.docks[0].x, m.docks[0].y), seen = flood(m, start);
    if (!m.docks.every(function (d) { return seen[cellOf(m, d.x, d.y)]; })) return null;
    m.scenery = scenery(m, rng);
    return m;
  }

  function cellOf(m, x, y) { return Math.max(0, Math.min(m.grid.h - 1, Math.floor(y / GRID))) * m.grid.w + Math.max(0, Math.min(m.grid.w - 1, Math.floor(x / GRID))); }
  function flood(m, start) {
    var seen = new Uint8Array(m.grid.w * m.grid.h), stack = [start], g = m.grid;
    while (stack.length) {
      var c = stack.pop();
      if (seen[c] || !g.water[c]) continue;
      seen[c] = 1;
      var x = c % g.w, y = (c / g.w) | 0;
      if (x > 0) stack.push(c - 1); if (x < g.w - 1) stack.push(c + 1); if (y > 0) stack.push(c - g.w); if (y < g.h - 1) stack.push(c + g.w);
    }
    return seen;
  }

  // things on the land: trees, houses and warehouses near the docks, a lighthouse
  function scenery(m, rng) {
    var out = [];
    for (var t = 0; t < 500 && out.length < 60; t++) {
      var x = rng.next() * m.W, y = rng.next() * m.H, r = rng.next() < 0.3 ? 0.85 : 0.55;
      var coastTop = m.top(x), coastBot = m.bottom(x);
      var onTop = y < coastTop - r - 0.5, onBot = y > coastBot + r + 0.5;
      if (!onTop && !onBot) continue;
      if (m.bridge && Math.abs(x - m.bridge.x) < m.bridge.hw + r + 0.6) continue;
      if (m.docks.some(function (d) { return Math.abs(d.x - x) < 2.4 + r && Math.abs(d.base - y) < 2.2 + r; })) continue;
      if (out.some(function (o) { return Math.hypot(o.x - x, o.y - y) < o.r + r + 0.1; })) continue;
      out.push({ x: x, y: y, r: r, kind: rng.next() < 0.18 ? 'house' : rng.next() < 0.3 ? 'pine' : rng.next() < 0.8 ? 'tree' : 'bush', hue: rng.int(0, 3) });
    }
    return out;
  }

  // the shortest way over water between two points (A* on the water grid), as a list of points
  // the nearest open-water cell to a point (a ship close to the shore is not on one)
  function nearestWater(m, c) {
    var g = m.grid;
    if (g.water[c]) return c;
    var cx = c % g.w, cy = (c / g.w) | 0;
    for (var r = 1; r < 8; r++) {
      var best = -1, bd = 1e9;
      for (var dy = -r; dy <= r; dy++) for (var dx = -r; dx <= r; dx++) {
        var x = cx + dx, y = cy + dy;
        if (x < 0 || y < 0 || x >= g.w || y >= g.h || !g.water[y * g.w + x]) continue;
        var d = dx * dx + dy * dy;
        if (d < bd) { bd = d; best = y * g.w + x; }
      }
      if (best >= 0) return best;
    }
    return c;
  }
  // prefers routes that keep well off the shore, and falls back to any route over water
  function route(m, x0, y0, x1, y1, blockBridge) {
    return routeOn(m, x0, y0, x1, y1, blockBridge, true) || routeOn(m, x0, y0, x1, y1, blockBridge, false);
  }
  function routeOn(m, x0, y0, x1, y1, blockBridge, roomy) {
    var g = m.grid, s = nearestWater(m, cellOf(m, x0, y0)), e = nearestWater(m, cellOf(m, x1, y1)), N = g.w * g.h;
    var open2 = roomy ? m.wide : g.water;
    var cost = new Float64Array(N).fill(Infinity), prev = new Int32Array(N).fill(-1), done = new Uint8Array(N), open = [s];
    var br = m.bridge;
    function blocked(c) {
      if (!open2[c]) return !roomy ? c !== s && c !== e : Math.hypot((c % g.w) - (s % g.w), ((c / g.w) | 0) - ((s / g.w) | 0)) > 2.5 && Math.hypot((c % g.w) - (e % g.w), ((c / g.w) | 0) - ((e / g.w) | 0)) > 2.5;
      if (blockBridge && br) { var cx = (c % g.w + 0.5) * GRID, cy = ((c / g.w | 0) + 0.5) * GRID; if (Math.abs(cx - br.x) < br.hw + 0.8 && Math.abs(cy - br.y) < br.gap + 0.5) return true; }
      return false;
    }
    cost[s] = 0;
    function h(c) { return Math.hypot((c % g.w) - (e % g.w), ((c / g.w) | 0) - ((e / g.w) | 0)); }
    var steps = 0;
    while (open.length && steps++ < 20000) {
      var bi = 0;
      for (var i = 1; i < open.length; i++) if (cost[open[i]] + h(open[i]) < cost[open[bi]] + h(open[bi])) bi = i;
      var c = open[bi];
      open.splice(bi, 1);
      if (c === e) break;
      if (done[c]) continue;
      done[c] = 1;
      var cx2 = c % g.w, cy2 = (c / g.w) | 0;
      for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        var nx = cx2 + dx, ny = cy2 + dy;
        if (nx < 0 || ny < 0 || nx >= g.w || ny >= g.h) continue;
        var n = ny * g.w + nx;
        if (blocked(n)) continue;
        var nc = cost[c] + (dx && dy ? 1.414 : 1);
        if (nc < cost[n]) { cost[n] = nc; prev[n] = c; open.push(n); }
      }
    }
    if (prev[e] < 0 && s !== e) return null;
    var cells = [];
    for (var cur = e; cur >= 0; cur = prev[cur]) { cells.push(cur); if (cur === s) break; }
    cells.reverse();
    var pts = cells.map(function (c3) { return [(c3 % g.w + 0.5) * GRID, (((c3 / g.w) | 0) + 0.5) * GRID]; });
    pts[0] = [x0, y0]; pts[pts.length - 1] = [x1, y1];
    // drop points that a straight line over water can skip
    var out = [pts[0]], i2 = 0;
    while (i2 < pts.length - 1) {
      var j = pts.length - 1;
      while (j > i2 + 1 && !clearLine(m, pts[i2], pts[j], blockBridge)) j--;
      out.push(pts[j]); i2 = j;
    }
    return out;
  }
  function clearLine(m, a, b, blockBridge) {
    var d = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.ceil(d / 0.25);
    for (var i = 1; i < n; i++) {
      var x = a[0] + (b[0] - a[0]) * i / n, y = a[1] + (b[1] - a[1]) * i / n;
      if (!m.grid.water[cellOf(m, x, y)]) return false;
      if (blockBridge && m.bridge && Math.abs(x - m.bridge.x) < m.bridge.hw + 0.8 && Math.abs(y - m.bridge.y) < m.bridge.gap + 0.5) return false;
    }
    return true;
  }

  // ---------- the harbor at work ----------

  function World(levelId, seed, aspect) {
    var cfg = LEVELS[levelId];
    this.level = levelId;
    this.cfg = cfg;
    this.rng = new Rng(seed || 1);
    this.map = buildHarbor(levelId, this.rng, aspect || 1.6);
    for (var tries = 0; !this.map && tries < 20; tries++) this.map = buildHarbor(levelId, this.rng, 1.6);
    var m = this.map;
    this.colors = m.docks.map(function (d) { return d.color; });
    this.t = 0;
    this.strikes = 0;
    this.delivered = 0;
    this.byColor = {};
    var self = this;
    this.colors.forEach(function (c) { self.byColor[c] = 0; });
    this.missionsDone = 0;
    this.over = false;
    this.reason = '';
    this.crash = null;
    this.events = [];
    this.nextId = 1;
    var spec = { len: cfg.big ? 2.0 : SHIP.len, beam: cfg.big ? 0.66 : SHIP.beam, turn: cfg.big ? 0.48 : SHIP.turn };
    var d0 = m.docks[0];
    this.ship = { x: d0.x, y: d0.y, h: d0.side ? Math.PI : 0, v: 0, yaw: 0, rudder: 0, tele: 2, spec: spec, cargo: [], dock: -1, swapT: 0, bumpT: 0, rudderIn: 0 };
    this.boats = [];
    cfg.boats.forEach(function (kind, i) { self.addBoat(kind, i); });
    this.cars = [];
    this.newMission();
    for (var k = 0; k < m.docks.length + 2; k++) this.spawnCrate();
    this.dockCheck();
  }
  var P = World.prototype;

  P.randomWater = function (nearX, nearY, r) {
    var m = this.map;
    for (var t = 0; t < 400; t++) {
      var x = nearX != null ? nearX + (this.rng.next() - 0.5) * 2 * r : 1.5 + this.rng.next() * (m.W - 3);
      var y = nearY != null ? nearY + (this.rng.next() - 0.5) * 2 * r : 1.5 + this.rng.next() * (m.H - 3);
      if (x < 0.5 || y < 0.5 || x > m.W - 0.5 || y > m.H - 0.5) continue;
      if (m.grid.water[cellOf(m, x, y)] && (!m.bridge || Math.abs(x - m.bridge.x) > 2)) return [x, y];
    }
    return [m.docks[0].x, m.docks[0].y];
  };

  P.addBoat = function (kind, i) {
    var m = this.map, b = { id: this.nextId++, kind: kind, x: 0, y: 0, h: 0, v: 0, path: null, wp: 0, wait: 0, look: i };
    b.speed = kind === 'sail' ? 0.55 : kind === 'ferry' ? 1.15 : kind === 'fish' ? 0.75 : 1.6;
    b.len = kind === 'sail' ? 0.9 : kind === 'ferry' ? 1.6 : kind === 'fish' ? 1.15 : 1.0;
    b.beam = kind === 'sail' ? 0.4 : kind === 'ferry' ? 0.62 : kind === 'fish' ? 0.46 : 0.4;
    var p = this.randomWater(), ship = this.ship;
    for (var t = 0; t < 30 && Math.hypot(p[0] - ship.x, p[1] - ship.y) < 6; t++) p = this.randomWater();
    b.x = p[0]; b.y = p[1];
    if (kind === 'ferry') {
      // a fixed line across open water, on one side of the bridge
      for (var g = 0; g < 200; g++) {
        var a = this.randomWater(), c = this.randomWater();
        if (Math.hypot(a[0] - c[0], a[1] - c[1]) < 9 || !clearLine(m, a, c, true)) continue;
        if (Math.hypot(a[0] - ship.x, a[1] - ship.y) < 5) continue;
        b.line = [a, c]; b.x = a[0]; b.y = a[1]; b.leg = 1;
        break;
      }
      if (!b.line) { b.kind = 'fish'; b.speed = 0.75; b.len = 1.15; b.beam = 0.46; }
    }
    this.boats.push(b);
  };

  P.newMission = function () {
    var n = this.missionsDone, cols = this.rng.shuffle(this.colors.slice()).slice(0, n < 2 ? 2 : 3);
    var total = 4 + n * 2, need = {}, got = {};
    cols.forEach(function (c, i) { need[c] = Math.floor(total / cols.length) + (i < total % cols.length ? 1 : 0); got[c] = 0; });
    this.mission = { n: n + 1, need: need, got: got };
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
  P.rate = function (r) { return Math.min(r[2], r[0] + r[1] * this.t / 60); };

  P.spawnCrate = function () {
    var docks = this.map.docks, d = this.rng.pick(docks);
    // a full dock turns the crate away, and its owner complains
    if (d.crates.length >= 8) { this.strike('full', { dock: d.id }); return; }
    var others = this.colors.filter(function (c) { return c !== d.color; });
    d.crates.push({ id: this.nextId++, color: this.rng.pick(others), born: this.t, patience: this.cfg.patience * (0.85 + this.rng.next() * 0.3) });
  };

  // ---------- controls ----------

  P.setRudder = function (dir) { this.ship.rudderIn = dir; };          // -1 port, 1 starboard, 0 hold
  P.centerRudder = function () { this.ship.rudder = 0; this.ship.rudderIn = 0; this.events.push({ type: 'rudder' }); };
  P.telegraph = function (step) {
    var s = this.ship, t = Math.max(0, Math.min(4, s.tele + step));
    if (t === s.tele) return false;
    s.tele = t;
    this.events.push({ type: 'telegraph', tele: t });
    return true;
  };
  P.stopEngine = function () { if (this.ship.tele === 2) return false; this.ship.tele = 2; this.events.push({ type: 'telegraph', tele: 2 }); return true; };
  P.toggleBridge = function () {
    var b = this.map.bridge;
    if (!b || this.over) return false;
    b.up = !b.up;
    this.events.push({ type: b.up ? 'bridge-up' : 'bridge-down' });
    return true;
  };

  // ---------- ship movement ----------

  // the ship's hull: points along its outline for collisions
  function hullPoints(x, y, h, spec) {
    var c = Math.cos(h), s = Math.sin(h), L = spec.len / 2, B = spec.beam / 2, out = [];
    [[L, 0], [L * 0.55, B], [L * 0.55, -B], [0, B], [0, -B], [-L, B * 0.85], [-L, -B * 0.85], [-L * 0.5, B], [-L * 0.5, -B]].forEach(function (p) {
      out.push([x + c * p[0] - s * p[1], y + s * p[0] + c * p[1]]);
    });
    return out;
  }

  // do two hulls (rectangles with pointed ends, roughly) touch? checks each outline against the other's box
  function inBox(px, py, x, y, h, len, beam) {
    var dx = px - x, dy = py - y, c = Math.cos(h), s = Math.sin(h), a = dx * c + dy * s, b = -dx * s + dy * c;
    return Math.abs(a) < len / 2 && Math.abs(b) < beam / 2;
  }
  function hullsTouch(x1, y1, h1, l1, b1, x2, y2, h2, l2, b2) {
    if (Math.hypot(x1 - x2, y1 - y2) > (l1 + l2) / 2 + 0.2) return false;
    var spec1 = { len: l1, beam: b1 }, spec2 = { len: l2, beam: b2 };
    return hullPoints(x1, y1, h1, spec1).some(function (p) { return inBox(p[0], p[1], x2, y2, h2, l2, b2); }) ||
      hullPoints(x2, y2, h2, spec2).some(function (p) { return inBox(p[0], p[1], x1, y1, h1, l1, b1); });
  }

  // advances a ship state by dt with the given rudder and telegraph (shared by the forecast)
  function shipStep(st, spec, tele, rudder, dt) {
    var target = TELEGRAPH[tele];
    if (st.v < target) st.v = Math.min(target, st.v + SHIP.acc * dt);
    else st.v = Math.max(target, st.v - SHIP.acc * dt * (target === 0 ? 1.15 : 1));
    // the rudder works with speed; a bow thruster turns a slow ship on the spot
    var want = rudder * (st.v * spec.turn + THRUSTER * Math.max(0, 1 - Math.abs(st.v)));
    st.yaw += (want - st.yaw) * Math.min(1, dt / SHIP.yawLag);
    st.h += st.yaw * dt;
    st.x += Math.cos(st.h) * st.v * dt;
    st.y += Math.sin(st.h) * st.v * dt;
  }

  P.bridgeBlocks = function (x, y) {
    var b = this.map.bridge;
    return b && b.arm < 0.98 && Math.abs(x - b.x) < b.hw + 0.05 && Math.abs(y - b.y) < b.gap;
  };

  // where the ship will be over the next seconds, with the controls as they are now
  P.forecast = function (secs, step) {
    var s = this.ship, st = { x: s.x, y: s.y, h: s.h, v: s.v, yaw: s.yaw }, out = [], hit = null, t = 0;
    step = step || 0.25;
    while (t < secs) {
      for (var k = 0; k < Math.round(step / DT); k++) shipStep(st, s.spec, s.tele, s.rudder, DT);
      t += step;
      out.push({ x: st.x, y: st.y, h: st.h, t: t });
      if (!hit) {
        var self = this;
        if (hullPoints(st.x, st.y, st.h, s.spec).some(function (p) { return self.map.isLand(p[0], p[1]) || self.bridgeBlocks(p[0], p[1]); })) hit = { t: t, kind: 'land' };
        else {
          var bt = this.boatAt(t);
          if (bt.some(function (b) { return hullsTouch(st.x, st.y, st.h, s.spec.len + 0.2, s.spec.beam + 0.2, b[0], b[1], b[3], b[2], b[4]); })) hit = { t: t, kind: 'boat' };
        }
      }
    }
    return { pts: out, hit: hit };
  };
  // where the robot boats will be in t seconds, if they keep on as they are
  P.boatAt = function (t) {
    return this.boats.map(function (b) { var v = b.wait > t ? 0 : b.v; return [b.x + Math.cos(b.h) * v * t, b.y + Math.sin(b.h) * v * t, b.len, b.h, b.beam]; });
  };

  P.moveShip = function () {
    var s = this.ship, m = this.map, self = this;
    if (s.rudderIn) s.rudder = Math.max(-1, Math.min(1, s.rudder + s.rudderIn * SHIP.rudder * DT));
    var px = s.x, py = s.y, ph = s.h;
    shipStep(s, s.spec, s.tele, s.rudder, DT);
    s.bumpT = Math.max(0, s.bumpT - DT);
    var hull = hullPoints(s.x, s.y, s.h, s.spec);
    // a lowered bridge: crash
    if (hull.some(function (p) { return self.bridgeBlocks(p[0], p[1]); })) { this.end('crash', { kind: 'bridge', x: s.x, y: s.y }); return; }
    // past the open edges of the map, the current pushes the ship back in
    if (s.x < 0.6) s.x += (0.6 - s.x) * DT * 2; else if (s.x > m.W - 0.6) s.x -= (s.x - (m.W - 0.6)) * DT * 2;
    var hitLand = hull.some(function (p) { return m.isLand(p[0], p[1]); });
    if (hitLand) {
      // bump: back where it was, stopped; only a hard hit (a crunch) is a complaint
      var hard = Math.abs(s.v) > SHIP.crunch;
      s.x = px; s.y = py; s.h = ph; s.v = -0.35 * Math.sign(s.v || 1); s.yaw = 0;
      if (s.bumpT <= 0) {
        s.bumpT = 2.5;
        this.events.push({ type: 'bump', x: s.x, y: s.y, hard: hard });
        if (hard) this.strike('bump', { x: s.x, y: s.y });
      }
    }
  };

  P.dockCheck = function () {
    var s = this.ship, m = this.map;
    if (Math.abs(s.v) > 0.45) { s.dock = -1; return; }
    var d = m.docks.find(function (dk) { return Math.hypot(dk.x - s.x, dk.y - s.y) < BERTH; });
    if (!d) { s.dock = -1; return; }
    if (s.dock !== d.id) { s.dock = d.id; s.swapT = 0.8; this.events.push({ type: 'dock', dock: d.id }); }
    s.swapT -= DT;
    if (s.swapT > 0) return;
    // crates for this dock come off first, then waiting crates go on
    var i = s.cargo.findIndex(function (c) { return c.color === d.color; });
    if (i >= 0) {
      var c = s.cargo.splice(i, 1)[0];
      this.delivered++; this.byColor[c.color]++;
      var ms = this.mission;
      if (ms.need[c.color] && ms.got[c.color] < ms.need[c.color]) ms.got[c.color]++;
      this.events.push({ type: 'deliver', dock: d.id, color: c.color });
      if (Object.keys(ms.need).every(function (k) { return ms.got[k] >= ms.need[k]; })) {
        this.missionsDone++;
        var back = this.strikes > 0;
        if (back) this.strikes--;
        this.events.push({ type: 'mission', n: ms.n, back: back });
        this.newMission();
      }
      s.swapT = 0.45;
      return;
    }
    if (d.crates.length && s.cargo.length < SHIP.cap) {
      var w = 0;
      for (var k = 1; k < d.crates.length; k++) if (d.crates[k].born + d.crates[k].patience < d.crates[w].born + d.crates[w].patience) w = k;
      s.cargo.push(d.crates.splice(w, 1)[0]);
      this.events.push({ type: 'load', dock: d.id });
      s.swapT = 0.45;
    }
  };

  // ---------- robot boats ----------

  P.moveBoats = function () {
    var self = this, m = this.map, s = this.ship;
    this.boats.forEach(function (b) {
      if (b.wait > 0) { b.wait -= DT; b.v = 0; return; }
      if (b.kind === 'ferry') {
        var tgt = b.line[b.leg], d = Math.hypot(tgt[0] - b.x, tgt[1] - b.y);
        if (d < 0.3) { b.leg = 1 - b.leg; b.wait = 4; return; }
        b.target = tgt;
      } else {
        if (!b.path || b.wp >= b.path.length) {
          var goal;
          if (b.kind === 'speed') {
            // Edith heads for a spot just across where your ship will be in a few seconds
            var f = self.forecast(4, 0.5).pts, e = f[f.length - 1], side = self.rng.next() < 0.5 ? -1 : 1;
            goal = self.randomWater(e.x - Math.sin(e.h) * 2.2 * side, e.y + Math.cos(e.h) * 2.2 * side, 1.2);
          } else goal = self.randomWater(b.kind === 'sail' ? b.x : null, b.kind === 'sail' ? b.y : null, 6);
          b.path = route(m, b.x, b.y, goal[0], goal[1], true) || [[b.x, b.y]];
          b.wp = 1;
          if (b.kind !== 'speed') b.wait = 1 + self.rng.next() * 3;
          return;
        }
        var w = b.path[b.wp];
        if (Math.hypot(w[0] - b.x, w[1] - b.y) < 0.4) { b.wp++; return; }
        b.target = w;
      }
      // turn toward the target, slow down to turn
      var want = Math.atan2(b.target[1] - b.y, b.target[0] - b.x), dh = angDiff(b.h, want);
      b.h += Math.max(-1.6 * DT, Math.min(1.6 * DT, dh));
      var sp = b.speed * (Math.abs(dh) > 0.8 ? 0.4 : 1);
      // the others stop for your ship when it is right in front of them; Edith swerves away at the last moment
      var dx = s.x - b.x, dy = s.y - b.y, dd = Math.hypot(dx, dy), fwd = (dx * Math.cos(b.h) + dy * Math.sin(b.h));
      {
        // keep out of your ship's way (Edith's speedboat cuts it finer): stop when it is coming at us, and move off when it gets close
        var closing = -(dx * Math.cos(s.h) + dy * Math.sin(s.h)) / Math.max(0.01, dd) * s.v;
        var near2 = b.kind === 'speed' ? 2.6 : 3.4, front = b.kind === 'speed' ? 2.0 : 2.6;
        if (dd < near2 && (closing > 0.15 || (dd < front && fwd > 0.2))) {
          b.blockT = (b.blockT || 0) + DT;
          sp = 0;
          if (dd < front || b.blockT > 2) {
            // ship ahead of us: back off; ship behind or beside: turn away and go
            var away = Math.atan2(-dy, -dx), turn = angDiff(b.h, away);
            if (fwd > 0) sp = -0.6;
            else { b.h += Math.max(-1.6 * DT, Math.min(1.6 * DT, turn)); sp = 0.8; }
            b.dodge = true;
            if (b.kind !== 'ferry') b.path = null;
          }
        } else b.blockT = Math.max(0, (b.blockT || 0) - DT);
      }

      // small boats dodge at once; otherwise speed changes gently
      if (b.dodge) { b.v = sp; b.dodge = false; } else b.v += (sp - b.v) * Math.min(1, DT * 2);
      var nx = b.x + Math.cos(b.h) * b.v * DT, ny = b.y + Math.sin(b.h) * b.v * DT;
      if (!m.isLand(nx, ny)) { b.x = nx; b.y = ny; } else { b.path = null; b.v = 0; }
      b.wake = (b.wake || 0) + b.v * DT;
    });
  };

  // ---------- the road over the bridge ----------

  P.moveCars = function () {
    var b = this.map.bridge, cfg = this.cfg, self = this;
    if (!b) return;
    // the bridge only goes up once nobody is on it
    var onSpan = this.cars.some(function (c) { return Math.abs(c.y - b.y) < b.gap + 0.15; });
    if (b.up && !onSpan) b.arm = Math.min(1, b.arm + DT / BRIDGE.time);
    else if (!b.up) {
      // it will not come down on (or right in front of) your ship
      var shipUnder = hullPoints(this.ship.x, this.ship.y, this.ship.h, this.ship.spec).some(function (p) { return Math.abs(p[0] - b.x) < b.hw + 1.2 && Math.abs(p[1] - b.y) < b.gap + 0.3; });
      if (!shipUnder) b.arm = Math.max(0, b.arm - DT / BRIDGE.time);
    }
    if (this.rng.next() < (0.14 + this.t / 60 * 0.02) * DT && this.cars.length < 12) {
      var dir = this.rng.next() < 0.5 ? 1 : -1, y0 = dir > 0 ? -1 : this.map.H + 1;
      if (!this.cars.some(function (c) { return c.dir === dir && Math.abs(c.y - y0) < 1.2; })) this.cars.push({ id: this.nextId++, dir: dir, y: y0, v: 1.6, look: this.rng.int(0, 5) });
    }
    var waiting = false;
    var lanes = { '1': [], '-1': [] };
    this.cars.forEach(function (c) { lanes[c.dir].push(c); });
    Object.keys(lanes).forEach(function (k) {
      var list = lanes[k].sort(function (a, c) { return (c.y - a.y) * Number(k); });
      list.forEach(function (c, i) {
        var room = 99, stopY = b.y - c.dir * (b.gap + 0.5);
        if (i > 0) room = Math.abs(list[i - 1].y - c.y) - 1.0;
        var before = (stopY - c.y) * c.dir;
        if ((b.up || b.arm > 0.01) && before > -0.05) room = Math.min(room, before);
        var target = Math.min(1.6, Math.sqrt(2 * 5 * Math.max(0, room)));
        c.v = target > c.v ? Math.min(target, c.v + 3 * DT) : target;
        c.y += c.dir * c.v * DT;
        if (c.v < 0.05 && before > -0.05 && before < 0.3) waiting = true;
      });
    });
    this.cars = this.cars.filter(function (c) { return c.y > -2 && c.y < self.map.H + 2; });
    if (waiting) {
      b.waitT += DT;
      if (b.waitT > cfg.bridgeWait * 0.6 && !b.honked) { b.honked = true; this.events.push({ type: 'honk' }); }
      if (b.waitT > cfg.bridgeWait) { b.waitT = 0; b.honked = false; this.strike('bridge', {}); }
    } else { b.waitT = Math.max(0, b.waitT - DT * 2); if (!b.waitT) b.honked = false; }
  };

  // ---------- one tick ----------

  P.step = function () {
    if (this.over) return;
    var self = this, cfg = this.cfg, m = this.map;
    this.t += DT;
    if (this.rng.next() < this.rate(cfg.rate) * DT) this.spawnCrate();
    m.docks.forEach(function (d) {
      for (var i = d.crates.length - 1; i >= 0; i--) {
        if (self.t - d.crates[i].born > d.crates[i].patience) { var c = d.crates.splice(i, 1)[0]; self.strike('crate', { dock: d.id, color: c.color }); if (self.over) return; }
      }
    });
    if (this.over) return;
    this.moveShip();
    if (this.over) return;
    this.moveBoats();
    this.moveCars();
    if (this.over) return;
    this.dockCheck();
    // a robot boat and your ship
    var s = this.ship;
    var self2 = this;
    this.boats.forEach(function (b) {
      if (self2.over || !hullsTouch(s.x, s.y, s.h, s.spec.len, s.spec.beam, b.x, b.y, b.h, b.len, b.beam)) return;
      // how fast they meet: a real collision ends the shift, a gentle touch just nudges them apart
      var dx = b.x - s.x, dy = b.y - s.y, d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d;
      var closing = (Math.cos(s.h) * s.v - Math.cos(b.h) * b.v) * ux + (Math.sin(s.h) * s.v - Math.sin(b.h) * b.v) * uy;
      if (closing > SHIP.ram) { self2.end('crash', { kind: 'boat', x: (b.x + s.x) / 2, y: (b.y + s.y) / 2, boat: b.id }); return; }
      if (!self2.map.isLand(b.x + ux * 0.12, b.y + uy * 0.12)) { b.x += ux * 0.12; b.y += uy * 0.12; }
      s.v *= 0.5; b.v = 0;
      if (!b.touchT || self2.t - b.touchT > 1) { b.touchT = self2.t; self2.events.push({ type: 'touch', boat: b.id }); }
    });
  };

  // ---------- scoring ----------

  P.points = function () { return Math.min(200000, 15 * this.delivered + 100 * this.missionsDone); };
  P.stars = function () { var d = this.delivered; return d >= STARS[2] ? 3 : d >= STARS[1] ? 2 : d >= STARS[0] ? 1 : 0; };
  P.waiting = function () { return this.map.docks.reduce(function (n, d) { return n + d.crates.length; }, 0); };

  var HM = {
    DT: DT, THRUSTER: THRUSTER, STRIKES: STRIKES, STARS: STARS, COLORS: COLORS, TELEGRAPH: TELEGRAPH, SHIP: SHIP, GRID: GRID, FORECAST: FORECAST, BERTH: BERTH, BRIDGE: BRIDGE,
    LEVELS: LEVELS, Rng: Rng, World: World, buildHarbor: buildHarbor, route: route, clearLine: clearLine, hullPoints: hullPoints, hullsTouch: hullsTouch, shipStep: shipStep, cellOf: cellOf
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = HM;
  else global.HarborMaster = HM;
})(typeof window !== 'undefined' ? window : globalThis);
