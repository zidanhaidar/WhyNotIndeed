/*
 * Cable Spaghetti engine: devices keep landing on a desk, and each one needs a cable to a free socket of its
 * kind (a plug for a power strip, a USB lead for a USB hub). Cables run square by square along the desk and
 * can never cross or share a square. Some devices are visitors that go home after a while and free their
 * cable; the rest stay for good. The desk grows and new strips arrive, but the cables pile up, so every shift
 * ends when a device has nowhere to plug in. The robot IT team decides where each device lands.
 * Pure logic, CommonJS (the dev scripts use it too).
 */
(function (global) {
  'use strict';

  var MAX_W = 14, MAX_H = 9;
  var N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  // [name, visitor]: visitors go home after a few more devices arrive
  var DEVICES = {
    power: [['lamp', false], ['monitor', false], ['printer', false], ['fan', true], ['kettle', true], ['radio', true]],
    usb: [['mouse', false], ['webcam', false], ['phone', true], ['headset', true], ['USB stick', true]]
  };

  /*
   * size: the desk to start with. growEvery: devices between desk extensions (one column or row each).
   * stripEvery: devices between new strips. visit: [share of visitors at first, drop per device, lowest share].
   * stay: how many devices a visitor stays for. far: new devices land at least this many wire squares from the
   * nearest free socket when the desk allows. brain: where the robot drops devices. hop: Edith moves her
   * unused strips every this many devices (0 = never). scissors: cable cuts you start with (one more every 12 devices).
   * rescues: times the IT team saves a full desk with an extra desk section and a fresh strip, so a desk never
   * ends after only a few devices.
   */
  var LEVELS = {
    pip: { size: [8, 6], growEvery: 6, stripEvery: 5, usb: 0.4, visit: [0.7, 0.008, 0.35], stay: [3, 6], far: 1, brain: 'scatter', hop: 0, scissors: 3, rescues: 2 },
    gridlock: { size: [8, 6], growEvery: 6, stripEvery: 5, usb: 0.4, visit: [0.7, 0.008, 0.35], stay: [3, 6], far: 2, brain: 'rows', hop: 0, scissors: 3, rescues: 1 },
    monolith: { size: [8, 6], growEvery: 6, stripEvery: 6, usb: 0.4, visit: [0.65, 0.011, 0.3], stay: [3, 6], far: 2, brain: 'tight', hop: 0, scissors: 2, rescues: 1 },
    edith: { size: [8, 6], growEvery: 7, stripEvery: 6, usb: 0.45, visit: [0.62, 0.011, 0.3], stay: [4, 7], far: 3, brain: 'choke', hop: 3, scissors: 2, rescues: 1 }
  };
  var STRIP = { power: 4, usb: 3 };
  var STARS = [25, 45, 70]; // devices plugged in for one, two and three stars

  function Rng(seed) { this.a = seed >>> 0; }
  Rng.prototype.next = function () {
    this.a = (this.a + 0x6D2B79F5) >>> 0;
    var t = this.a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  Rng.prototype.int = function (a, b) { return a + Math.floor(this.next() * (b - a + 1)); };

  function idx(x, y) { return y * MAX_W + x; }
  function cx(i) { return i % MAX_W; }
  function cy(i) { return (i / MAX_W) | 0; }

  function Desk(levelId, seed) {
    var c = LEVELS[levelId];
    this.level = levelId;
    this.cfg = c;
    this.rng = new Rng(seed || 1);
    this.W = c.size[0];
    this.H = c.size[1];
    this.cells = new Array(MAX_W * MAX_H).fill(null);
    this.devices = {};
    this.strips = [];
    this.nextId = 1;
    this.turn = 0;      // devices that have arrived
    this.plugged = 0;   // devices plugged in (re-plugging after a cut does not count again)
    this.neat = 0;      // cables as short as they could be
    this.scissors = c.scissors;
    this.rescues = c.rescues;
    this.over = false;
    this.reason = '';
    this.events = [];
    // the starting strips sit on the left and top edges, which stay edges as the desk grows
    this.addStrip('power', [0, 1, 'v']);
    this.addStrip('usb', [3, 0, 'h']);
    this.arrive();
  }
  var P = Desk.prototype;

  P.active = function (i) { return cx(i) < this.W && cy(i) < this.H; };
  P.neighbors = function (i) {
    var out = [], x = cx(i), y = cy(i);
    for (var k = 0; k < 4; k++) {
      var nx = x + N4[k][0], ny = y + N4[k][1];
      if (nx >= 0 && ny >= 0 && nx < this.W && ny < this.H) out.push(idx(nx, ny));
    }
    return out;
  };
  P.free = function (i) { return this.active(i) && this.cells[i] === null; };
  P.freeOutlet = function (i, kind) { var c = this.cells[i]; return !!c && c.t === 'out' && c.kind === kind && c.dev == null; };
  P.unplugged = function () { var d = this.devices; return Object.keys(d).map(function (k) { return d[k]; }).filter(function (v) { return !v.plugged; }); };
  P.points = function () { return Math.min(50000, 10 * this.plugged + 5 * this.neat); };
  P.stars = function () { var n = this.plugged; return n >= STARS[2] ? 3 : n >= STARS[1] ? 2 : n >= STARS[0] ? 1 : 0; };
  P.freeSockets = function (kind) {
    var n = 0, self = this;
    this.strips.forEach(function (s) { if (s.kind === kind) s.cells.forEach(function (i) { if (self.cells[i].dev == null) n++; }); });
    return n;
  };

  // Wire squares needed from every empty square to the nearest free socket of `kind` (-1: no way), with
  // square `block` treated as taken.
  P.reach = function (kind, block) {
    var dist = new Int16Array(MAX_W * MAX_H).fill(-1), q = [], self = this;
    this.strips.forEach(function (s) {
      if (s.kind !== kind) return;
      s.cells.forEach(function (o) {
        if (self.cells[o].dev != null) return;
        self.neighbors(o).forEach(function (n) {
          if (n !== block && self.free(n) && dist[n] < 0) { dist[n] = 0; q.push(n); }
        });
      });
    });
    for (var h = 0; h < q.length; h++) {
      var c = q[h], ns = this.neighbors(c);
      for (var k = 0; k < ns.length; k++) {
        var n = ns[k];
        if (n !== block && dist[n] < 0 && this.free(n)) { dist[n] = dist[c] + 1; q.push(n); }
      }
    }
    return dist;
  };

  // The fewest wire squares a placed device needs right now (-1: it cannot be plugged in).
  P.shortest = function (dev) {
    var dist = this.reach(dev.kind, -1), best = -1, self = this;
    this.neighbors(dev.cell).forEach(function (n) {
      var v = self.freeOutlet(n, dev.kind) ? 0 : dist[n] >= 0 ? dist[n] + 1 : -1;
      if (v >= 0 && (best < 0 || v < best)) best = v;
    });
    return best;
  };

  // A shortest cable for a device: the squares from the device to the socket (used by hints and the dev scripts).
  P.route = function (dev, costOf) {
    var self = this, N = MAX_W * MAX_H, d = new Float64Array(N).fill(Infinity), prev = new Int32Array(N).fill(-1), done = new Uint8Array(N);
    d[dev.cell] = 0;
    for (;;) {
      var c = -1, bv = Infinity;
      for (var i = 0; i < N; i++) if (!done[i] && d[i] < bv) { bv = d[i]; c = i; }
      if (c < 0) return null;
      if (c !== dev.cell && this.freeOutlet(c, dev.kind)) {
        var path = [c];
        while (prev[path[0]] >= 0) path.unshift(prev[path[0]]);
        return path;
      }
      done[c] = 1;
      if (c !== dev.cell && !this.free(c)) continue;
      this.neighbors(c).forEach(function (n) {
        if (done[n] || !(self.free(n) || self.freeOutlet(n, dev.kind))) return;
        var w = costOf ? costOf(n) : 1;
        if (d[c] + w < d[n]) { d[n] = d[c] + w; prev[n] = c; }
      });
    }
  };

  // ---------- your moves ----------

  // Checks a cable drawn from a device to a socket: squares in order, each next to the last, through empty desk.
  P.check = function (id, path) {
    var dev = this.devices[id];
    if (!dev || dev.plugged || !path || path.length < 2 || path[0] !== dev.cell) return false;
    var seen = {};
    for (var k = 1; k < path.length; k++) {
      var i = path[k];
      if (seen[i] || this.neighbors(path[k - 1]).indexOf(i) < 0) return false;
      seen[i] = true;
      if (k === path.length - 1) return this.freeOutlet(i, dev.kind);
      if (!this.free(i)) return false;
    }
    return false;
  };

  P.plug = function (id, path) {
    if (this.over || !this.check(id, path)) return false;
    var dev = this.devices[id], wires = path.slice(1, -1), self = this;
    var neat = this.shortest(dev) === wires.length;
    wires.forEach(function (i) { self.cells[i] = { t: 'wire', id: id }; });
    var out = path[path.length - 1];
    this.cells[out].dev = id;
    dev.plugged = true;
    dev.wires = wires;
    dev.outlet = out;
    var first = !dev.counted;
    if (first) { dev.counted = true; this.plugged++; if (neat) this.neat++; }
    this.events.push({ type: 'plug', id: id, neat: neat && first, first: first });
    if (!this.unplugged().length) this.endTurn();
    else this.checkStuck();
    return true;
  };

  // Snips a cable: the device has to be plugged in again before the next one arrives.
  P.cut = function (id) {
    var dev = this.devices[id];
    if (this.over || !dev || !dev.plugged || this.scissors <= 0) return false;
    this.scissors--;
    this.unwire(dev);
    this.events.push({ type: 'cut', id: id });
    this.checkStuck();
    return true;
  };

  P.unwire = function (dev) {
    var self = this;
    (dev.wires || []).forEach(function (i) { self.cells[i] = null; });
    if (dev.outlet != null && this.cells[dev.outlet]) this.cells[dev.outlet].dev = null;
    dev.wires = [];
    dev.outlet = null;
    dev.plugged = false;
  };

  // Ends the shift when a device waiting for a cable has no way to any socket and no cuts are left.
  P.checkStuck = function () {
    if (this.scissors > 0) return;
    var self = this, stuck = this.unplugged().filter(function (d) { return self.shortest(d) < 0; })[0];
    if (stuck) this.finish('The ' + stuck.name + ' cannot reach a free socket.', stuck.id);
  };

  P.giveUp = function () { if (!this.over) this.finish('You called it a day.'); };

  P.finish = function (reason, id) {
    this.over = true;
    this.reason = reason;
    this.events.push({ type: 'end', reason: reason, id: id });
  };

  // ---------- the desk between devices ----------

  P.endTurn = function () {
    var self = this, c = this.cfg;
    Object.keys(this.devices).forEach(function (k) {
      var d = self.devices[k];
      if (d.visit == null) return;
      d.visit--;
      if (d.visit > 0) return;
      self.unwire(d);
      self.cells[d.cell] = null;
      delete self.devices[k];
      self.events.push({ type: 'leave', id: d.id, name: d.name });
    });
    this.turn++;
    if (this.turn % 12 === 0 && this.scissors < 3) { this.scissors++; this.events.push({ type: 'scissors' }); }
    if (this.turn % c.growEvery === 0) this.grow();
    if (this.turn % c.stripEvery === 0) {
      var kind = this.freeSockets('usb') < this.freeSockets('power') ? 'usb' : 'power';
      if (this.addStrip(kind, null, true)) this.events.push({ type: 'strip', kind: kind });
    }
    if (c.hop && this.turn % c.hop === 0) this.hop();
    this.arrive();
  };

  P.grow = function () {
    var c = this.cfg;
    if (this.W >= MAX_W && this.H >= MAX_H) return;
    if (this.H >= MAX_H || (this.W < MAX_W && this.W - c.size[0] <= 2 * (this.H - c.size[1]))) this.W++;
    else this.H++;
    this.events.push({ type: 'grow', W: this.W, H: this.H });
  };

  // Runs of empty squares a strip could sit on, along the desk's edge first.
  P.stripSpots = function (len) {
    var edge = [], inner = [];
    for (var y = 0; y < this.H; y++) {
      for (var x = 0; x < this.W; x++) {
        for (var o = 0; o < 2; o++) {
          var cells = [], fits = true;
          for (var k = 0; k < len; k++) {
            var px = o ? x : x + k, py = o ? y + k : y;
            if (px >= this.W || py >= this.H || !this.free(idx(px, py))) { fits = false; break; }
            cells.push(idx(px, py));
          }
          if (!fits) continue;
          var onEdge = o ? (x === 0 || x === this.W - 1) : (y === 0 || y === this.H - 1);
          (onEdge ? edge : inner).push(cells);
        }
      }
    }
    return edge.length ? edge : inner;
  };

  P.addStrip = function (kind, at, robot) {
    var len = STRIP[kind], cells;
    if (at) {
      cells = [];
      for (var k = 0; k < len; k++) cells.push(at[2] === 'v' ? idx(at[0], at[1] + k) : idx(at[0] + k, at[1]));
    } else {
      var spots = this.stripSpots(len);
      if (!spots.length) return false;
      cells = spots[this.rng.int(0, spots.length - 1)];
    }
    var s = { id: this.strips.length + 1, kind: kind, cells: cells, robot: !!robot }, self = this;
    cells.forEach(function (i) { self.cells[i] = { t: 'out', kind: kind, strip: s.id, dev: null }; });
    this.strips.push(s);
    return true;
  };

  // Edith slides any strip she brought that nobody has plugged into yet to a new spot.
  P.hop = function () {
    var self = this;
    this.strips.forEach(function (s) {
      if (!s.robot || s.cells.some(function (i) { return self.cells[i].dev != null; })) return;
      s.cells.forEach(function (i) { self.cells[i] = null; });
      var spots = self.stripSpots(s.cells.length);
      var cells = spots.length ? spots[self.rng.int(0, spots.length - 1)] : s.cells;
      cells.forEach(function (i) { self.cells[i] = { t: 'out', kind: s.kind, strip: s.id, dev: null }; });
      var from = s.cells;
      s.cells = cells;
      self.events.push({ type: 'hop', strip: s.id, from: from });
    });
  };

  // ---------- the robot drops the next device ----------

  P.arrive = function () {
    var c = this.cfg, r = this.rng;
    var first = r.next() < c.usb ? 'usb' : 'power', order = [first, first === 'usb' ? 'power' : 'usb'];
    for (var k = 0; k < 2; k++) {
      var kind = order[k], dist = this.reach(kind, -1), spots = [], far = [];
      for (var i = 0; i < MAX_W * MAX_H; i++) {
        if (dist[i] < 0) continue;
        spots.push(i);
        if (dist[i] >= c.far) far.push(i);
      }
      if (!spots.length) continue;
      // devices land a few squares from the nearest free socket whenever there is room for that
      if (far.length) spots = far;
      var share = Math.max(c.visit[2], c.visit[0] - c.visit[1] * this.turn);
      var visitor = r.next() < share;
      var pool = DEVICES[kind].filter(function (d) { return d[1] === visitor; });
      var pickd = pool[r.int(0, pool.length - 1)];
      var cell = this[c.brain](spots, kind);
      var dev = { id: this.nextId++, name: pickd[0], kind: kind, cell: cell, visit: visitor ? r.int(c.stay[0], c.stay[1]) : null, plugged: false, wires: [], outlet: null };
      this.devices[dev.id] = dev;
      this.cells[cell] = { t: 'dev', id: dev.id };
      this.events.push({ type: 'arrive', id: dev.id });
      return dev;
    }
    // full: the IT team can rescue the desk a few times with an extra section and a fresh strip
    if (this.rescues > 0) {
      this.rescues--;
      var before = this.W * this.H;
      this.grow();
      var kind2 = this.freeSockets('usb') < this.freeSockets('power') ? 'usb' : 'power';
      var added = this.addStrip(kind2, null, false);
      if (this.W * this.H > before || added) {
        this.events.push({ type: 'rescue', kind: kind2 });
        return this.arrive();
      }
    }
    this.finish('The desk is full: there is nowhere left to plug anything in.');
    return null;
  };

  // Pip: anywhere.
  P.scatter = function (spots) { return spots[this.rng.int(0, spots.length - 1)]; };

  // Ted: fills the desk row by row from the far corner.
  P.rows = function (spots) { return spots[spots.length - 1]; };

  // Excel: right next to your busiest cables.
  P.tight = function (spots) {
    var self = this, best = [], bv = -1;
    spots.forEach(function (i) {
      var v = 0, x = cx(i), y = cy(i);
      for (var dy = -1; dy <= 1; dy++) {
        for (var dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          var nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= self.W || ny >= self.H) { v += 0.5; continue; }
          var c = self.cells[idx(nx, ny)];
          if (c) v += c.t === 'wire' ? 2 : 1;
        }
      }
      if (v > bv) { bv = v; best = [i]; } else if (v === bv) best.push(i);
    });
    return best[this.rng.int(0, best.length - 1)];
  };

  // Edith: the square that cuts off the most free desk from the sockets.
  P.choke = function (spots) {
    var self = this, best = [], bv = Infinity;
    function open(block) {
      var n = 0;
      ['power', 'usb'].forEach(function (k) { var d = self.reach(k, block); for (var i = 0; i < d.length; i++) if (d[i] >= 0) n++; });
      return n;
    }
    spots.forEach(function (i) {
      var v = open(i);
      if (v < bv) { bv = v; best = [i]; } else if (v === bv) best.push(i);
    });
    return best[this.rng.int(0, best.length - 1)];
  };

  var CS = { MAX_W: MAX_W, MAX_H: MAX_H, LEVELS: LEVELS, STARS: STARS, STRIP: STRIP, DEVICES: DEVICES, Desk: Desk, Rng: Rng, idx: idx, cx: cx, cy: cy };
  if (typeof module !== 'undefined' && module.exports) module.exports = CS;
  else global.CSP = CS;
})(typeof window !== 'undefined' ? window : this);
