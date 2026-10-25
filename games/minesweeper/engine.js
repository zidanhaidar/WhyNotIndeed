/*
 * Minesweeper engine: the classic. Open every safe square without touching a mine; numbers say how many mines
 * touch a square. The field is laid when you open your first square, so that square and its neighbours are always
 * safe, and every field can be cleared by logic alone (no guessing). The robot gets an identical field and clears
 * it beside you with the same logic at its own pace; clear yours first. Pip sometimes clicks without thinking and
 * can blow itself up. Pure logic, CommonJS (the dev scripts use it too).
 */
(function (global) {
  'use strict';

  var DT = 1 / 30;

  /*
   * w, h, mines: the field. pace: the robot's seconds per move (opening a square or planting a flag; a flag costs
   * `flag` of a move, quick robots barely bother). guess: chance per move that the robot clicks a random closed
   * square instead of thinking (only Pip does).
   */
  var LEVELS = {
    pip: { w: 9, h: 9, mines: 10, pace: 3.4, flag: 1, guess: 0.03 },
    gridlock: { w: 12, h: 12, mines: 22, pace: 2.6, flag: 0.8, guess: 0 },
    monolith: { w: 16, h: 16, mines: 40, pace: 1.9, flag: 0.5, guess: 0 },
    edith: { w: 16, h: 16, mines: 44, pace: 1.55, flag: 0.3, guess: 0 }
  };

  function Rng(seed) { this.a = seed >>> 0; }
  Rng.prototype.next = function () {
    this.a = (this.a + 0x6D2B79F5) >>> 0;
    var t = this.a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  function neighbours(w, h, i) {
    var x = i % w, y = (i / w) | 0, out = [];
    for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      var nx = x + dx, ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < w && ny < h) out.push(ny * w + nx);
    }
    return out;
  }

  // A field: where the mines are and the number on every square.
  function Field(w, h, mineCells) {
    this.w = w; this.h = h; this.n = w * h;
    this.mine = new Uint8Array(this.n);
    this.count = new Int8Array(this.n);
    this.nb = [];
    for (var i = 0; i < this.n; i++) this.nb.push(neighbours(w, h, i));
    var self = this;
    mineCells.forEach(function (c) { self.mine[c] = 1; });
    for (var k = 0; k < this.n; k++) this.count[k] = this.nb[k].reduce(function (a, c) { return a + self.mine[c]; }, 0);
    this.mines = mineCells.length;
  }

  // What someone sweeping the field knows: 0 closed, 1 open, 2 flagged. open() floods out from empty squares.
  function Sweep(field) {
    this.f = field;
    this.state = new Int8Array(field.n);
    this.opened = 0;
    this.flags = 0;
  }
  Sweep.prototype.open = function (i) {
    var f = this.f, st = this.state, list = [i], out = [];
    if (st[i] !== 0) return out;
    while (list.length) {
      var c = list.pop();
      if (st[c] !== 0 || f.mine[c]) continue;
      st[c] = 1; this.opened++; out.push(c);
      if (f.count[c] === 0) for (var k = 0; k < f.nb[c].length; k++) if (st[f.nb[c][k]] === 0) list.push(f.nb[c][k]);
    }
    return out;
  };
  Sweep.prototype.flag = function (i) { if (this.state[i] === 0) { this.state[i] = 2; this.flags++; } };
  Sweep.prototype.done = function () { return this.opened === this.f.n - this.f.mines; };

  // The next move logic can prove, or null: { type: 'open' | 'flag', cells: [...] }. Tries, in order: a number
  // already satisfied (the rest is safe) or needing every closed neighbour (all mines); one number's closed
  // squares inside another's (the difference is all safe or all mines); and the total mine count.
  Sweep.prototype.deduce = function () {
    var f = this.f, st = this.state, i, k, cons = [];
    for (i = 0; i < f.n; i++) {
      if (st[i] !== 1 || !f.count[i]) continue;
      var closed = [], flagged = 0;
      for (k = 0; k < f.nb[i].length; k++) { var c = f.nb[i][k]; if (st[c] === 0) closed.push(c); else if (st[c] === 2) flagged++; }
      if (!closed.length) continue;
      var left = f.count[i] - flagged;
      if (left === 0) return { type: 'open', cells: closed };
      if (left === closed.length) return { type: 'flag', cells: closed };
      cons.push({ cells: closed, mines: left, key: closed.join(',') });
    }
    for (var a = 0; a < cons.length; a++) {
      for (var b = 0; b < cons.length; b++) {
        if (a === b || cons[a].cells.length >= cons[b].cells.length) continue;
        var A = cons[a], B = cons[b];
        if (!A.cells.every(function (x) { return B.cells.indexOf(x) >= 0; })) continue;
        var diff = B.cells.filter(function (x) { return A.cells.indexOf(x) < 0; }), m = B.mines - A.mines;
        if (m === 0) return { type: 'open', cells: diff };
        if (m === diff.length) return { type: 'flag', cells: diff };
      }
    }
    var rest = [];
    for (i = 0; i < f.n; i++) if (st[i] === 0) rest.push(i);
    var minesLeft = f.mines - this.flags;
    if (rest.length && minesLeft === 0) return { type: 'open', cells: rest };
    if (rest.length && minesLeft === rest.length) return { type: 'flag', cells: rest };
    return null;
  };
  Sweep.prototype.apply = function (move) {
    var self = this, opened = [];
    move.cells.forEach(function (c) { if (move.type === 'open') opened = opened.concat(self.open(c)); else self.flag(c); });
    return opened;
  };

  // Lays a field for a first click at `first` that logic alone can clear. Returns null after too many tries.
  function layField(c, first, rng, tries) {
    var w = c.w, h = c.h, n = w * h, keep = neighbours(w, h, first).concat([first]);
    for (var t = 0; t < (tries || 2000); t++) {
      var pool = [];
      for (var i = 0; i < n; i++) if (keep.indexOf(i) < 0) pool.push(i);
      for (var k = pool.length - 1; k > 0; k--) { var j = Math.floor(rng.next() * (k + 1)), tmp = pool[k]; pool[k] = pool[j]; pool[j] = tmp; }
      var field = new Field(w, h, pool.slice(0, c.mines)), s = new Sweep(field);
      s.open(first);
      for (var move = s.deduce(); move; move = s.deduce()) s.apply(move);
      if (s.done()) return field;
    }
    return null;
  }

  // The robot's run on its own copy: when each move lands and how much it has opened by then. If Pip's careless
  // click hits a mine, the run stops there (boom).
  function robotRun(field, first, c, rng) {
    var s = new Sweep(field), t = 1.5, steps = [], boom = null;
    s.open(first);
    steps.push({ at: t, opened: s.opened });
    while (!s.done()) {
      var move = null;
      if (c.guess && rng.next() < c.guess) {
        var closed = [];
        for (var i = 0; i < field.n; i++) if (s.state[i] === 0) closed.push(i);
        move = { type: 'open', cells: [closed[Math.floor(rng.next() * closed.length)]] };
        t += c.pace * (0.5 + 0.5 * rng.next());
        if (field.mine[move.cells[0]]) { boom = t; break; }
      } else {
        move = s.deduce();
        if (!move) break;
        t += move.cells.length * c.pace * (move.type === 'flag' ? c.flag : 1) * (0.7 + 0.6 * rng.next());
      }
      s.apply(move);
      steps.push({ at: t, opened: s.opened });
    }
    return { steps: steps, boom: boom, finish: boom == null ? t : null };
  }

  // ---------- a game ----------

  function Game(levelId, seed) {
    var c = LEVELS[levelId];
    this.level = levelId;
    this.cfg = c;
    this.rng = new Rng(seed || 1);
    this.w = c.w; this.h = c.h; this.n = c.w * c.h; this.mines = c.mines;
    this.field = null;      // laid on the first click
    this.sweep = null;
    this.robot = null;
    this.robotStep = 0;
    this.robotOpened = 0;
    this.started = false;
    this.t = 0;
    this.over = false;
    this.result = null;
    this.reason = '';
    this.hit = -1;
    this.events = [];
  }
  var P = Game.prototype;

  P.safe = function () { return this.n - this.mines; };
  P.opened = function () { return this.sweep ? this.sweep.opened : 0; };
  P.flags = function () { return this.sweep ? this.sweep.flags : 0; };
  P.state = function (i) { return this.sweep ? this.sweep.state[i] : 0; };
  P.number = function (i) { return this.field ? this.field.count[i] : 0; };
  P.isMine = function (i) { return !!(this.field && this.field.mine[i]); };
  P.nb = function (i) { return neighbours(this.w, this.h, i); };
  // how long the robot would take without careless clicks: the time to beat for bonus points
  P.robotTime = function () { return this.robot ? this.robot.par : 0; };
  P.margin = function () { return Math.max(0, this.robotTime() - this.t); };
  P.points = function () {
    var win = this.result === 'win';
    return Math.min(50000, 2 * this.opened() + (win ? 500 + Math.round(2 * this.margin()) : 0));
  };
  P.stars = function () {
    if (this.result !== 'win') return 0;
    var m = this.margin();
    return m >= 60 ? 3 : m >= 20 ? 2 : 1;
  };

  P.start = function (first) {
    var c = this.cfg;
    this.field = layField(c, first, this.rng) || layField(c, first, this.rng, 8000);
    this.sweep = new Sweep(this.field);
    this.robot = robotRun(this.field, first, c, this.rng);
    // the time to beat: the same robot, minus Pip's careless clicks
    this.robot.par = robotRun(this.field, first, Object.assign({}, c, { guess: 0 }), new Rng(7)).finish;
    this.started = true;
    this.events.push({ type: 'start' });
  };

  // Opens square i (the very first one lays the field). Opening a mine ends the game.
  P.open = function (i) {
    if (this.over) return false;
    if (!this.started) this.start(i);
    if (this.sweep.state[i] !== 0) return false;
    if (this.field.mine[i]) {
      this.hit = i;
      this.events.push({ type: 'boom', cell: i });
      this.finish('lose', 'mine');
      return true;
    }
    var cells = this.sweep.open(i);
    this.events.push({ type: 'open', cells: cells });
    if (this.sweep.done()) this.finish('win', 'cleared');
    return true;
  };

  P.toggleFlag = function (i) {
    if (this.over || !this.started) return false;
    var st = this.sweep.state;
    if (st[i] === 0) { st[i] = 2; this.sweep.flags++; }
    else if (st[i] === 2) { st[i] = 0; this.sweep.flags--; }
    else return false;
    this.events.push({ type: 'flag', cell: i, on: st[i] === 2 });
    return true;
  };

  // Clicking an open number whose flags are all placed opens the rest of its neighbours (wrong flags are fatal).
  P.chord = function (i) {
    if (this.over || !this.started || this.sweep.state[i] !== 1 || !this.field.count[i]) return false;
    var nb = this.nb(i), st = this.sweep.state, flagged = nb.filter(function (c) { return st[c] === 2; }).length;
    if (flagged !== this.field.count[i]) return false;
    var any = false;
    for (var k = 0; k < nb.length && !this.over; k++) if (st[nb[k]] === 0) any = this.open(nb[k]) || any;
    return any;
  };

  P.step = function () {
    if (!this.started || this.over) return;
    this.t += DT;
    var r = this.robot;
    while (this.robotStep < r.steps.length && r.steps[this.robotStep].at <= this.t) { this.robotOpened = r.steps[this.robotStep].opened; this.robotStep++; }
    if (r.boom != null && this.t >= r.boom && !this.robotBoomed) { this.robotBoomed = true; this.events.push({ type: 'robot-boom' }); }
    if (r.finish != null && this.t >= r.finish) this.finish('lose', 'robot');
  };

  P.finish = function (result, reason) {
    if (this.over) return;
    this.over = true;
    this.result = result;
    this.reason = reason;
    this.events.push({ type: 'end', result: result, reason: reason });
  };

  var MS = { DT: DT, LEVELS: LEVELS, Rng: Rng, Field: Field, Sweep: Sweep, layField: layField, robotRun: robotRun, neighbours: neighbours, Game: Game };
  if (typeof module !== 'undefined' && module.exports) module.exports = MS;
  else global.MS = MS;
})(typeof window !== 'undefined' ? window : this);
