/*
 * Sudoku engine: the classic 9 x 9 puzzle, freshly made every game. Every puzzle has exactly one solution and can
 * be solved by logic alone (no guessing). The robot gets an identical copy and solves it beside you, one cell at a
 * time, using the same human techniques (singles first, pairs and pointing when it has to); finish your grid
 * before it finishes its own. A wrong number is a mistake (it does not stay in the grid); three mistakes and you
 * are out. Pure logic, CommonJS (the dev scripts use it too).
 */
(function (global) {
  'use strict';

  var DT = 1 / 30;
  var MISTAKES = 3;
  var ALL = 0x1FF;

  /*
   * givens: how many numbers the puzzle starts with. need: the hardest technique it may (and on Excel and Edith,
   * must) need: 1 = singles only, 2 = pointing, claiming and naked pairs too.
   * pace: the robot's seconds per cell for a single; a cell after a harder deduction takes `hard` times as long.
   * slip: chance the robot writes a wrong number first and loses time fixing it.
   */
  var LEVELS = {
    pip: { givens: [36, 40], need: 1, pace: 13, hard: 3, slip: 0.12 },
    gridlock: { givens: [30, 33], need: 1, pace: 10, hard: 3, slip: 0.05 },
    monolith: { givens: [27, 30], need: 2, pace: 9, hard: 3, slip: 0.02 },
    edith: { givens: [24, 27], need: 2, pace: 7.5, hard: 2.6, slip: 0 }
  };

  // ---------- the grid ----------

  var ROW = [], COL = [], BOX = [], UNITS = [], PEERS = [], POP = new Uint8Array(512);
  for (var m = 1; m < 512; m++) POP[m] = POP[m >> 1] + (m & 1);
  (function () {
    var i, u;
    for (i = 0; i < 81; i++) { ROW[i] = (i / 9) | 0; COL[i] = i % 9; BOX[i] = ((ROW[i] / 3) | 0) * 3 + ((COL[i] / 3) | 0); }
    for (u = 0; u < 9; u++) {
      var r = [], c = [], b = [];
      for (i = 0; i < 81; i++) { if (ROW[i] === u) r.push(i); if (COL[i] === u) c.push(i); if (BOX[i] === u) b.push(i); }
      UNITS.push(r, c, b);
    }
    for (i = 0; i < 81; i++) {
      var set = {};
      for (var j = 0; j < 81; j++) if (j !== i && (ROW[j] === ROW[i] || COL[j] === COL[i] || BOX[j] === BOX[i])) set[j] = true;
      PEERS.push(Object.keys(set).map(Number));
    }
  })();
  function bit(d) { return 1 << (d - 1); }
  function digitOf(mask) { for (var d = 1; d <= 9; d++) if (mask === bit(d)) return d; return 0; }

  function Rng(seed) { this.a = seed >>> 0; }
  Rng.prototype.next = function () {
    this.a = (this.a + 0x6D2B79F5) >>> 0;
    var t = this.a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  Rng.prototype.shuffle = function (a) {
    a = a.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(this.next() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  };

  // Counts solutions up to `limit` (backtracking on the cell with the fewest options). With `order` (digits to
  // try first), it fills g with the first solution it finds.
  function search(g, limit, order) {
    var rows = new Int32Array(9), cols = new Int32Array(9), boxes = new Int32Array(9), count = 0, i;
    for (i = 0; i < 81; i++) {
      if (!g[i]) continue;
      var b0 = bit(g[i]);
      if ((rows[ROW[i]] | cols[COL[i]] | boxes[BOX[i]]) & b0) return 0;
      rows[ROW[i]] |= b0; cols[COL[i]] |= b0; boxes[BOX[i]] |= b0;
    }
    var digits = order || [1, 2, 3, 4, 5, 6, 7, 8, 9];
    function rec() {
      var best = -1, bestMask = 0, bestN = 10;
      for (var k = 0; k < 81; k++) {
        if (g[k]) continue;
        var mk = ALL & ~(rows[ROW[k]] | cols[COL[k]] | boxes[BOX[k]]), n = POP[mk];
        if (n < bestN) { bestN = n; best = k; bestMask = mk; if (n <= 1) break; }
      }
      if (best < 0) { count++; return order ? true : false; }
      if (!bestN) return false;
      for (var q = 0; q < 9; q++) {
        var d = digits[q], bd = bit(d);
        if (!(bestMask & bd)) continue;
        g[best] = d; rows[ROW[best]] |= bd; cols[COL[best]] |= bd; boxes[BOX[best]] |= bd;
        if (rec()) return true;
        g[best] = 0; rows[ROW[best]] &= ~bd; cols[COL[best]] &= ~bd; boxes[BOX[best]] &= ~bd;
        if (count >= limit) return false;
      }
      return false;
    }
    rec();
    return count;
  }
  function solutions(puzzle, limit) { return search(puzzle.slice(), limit || 2); }
  function fullGrid(rng) {
    var g = new Array(81).fill(0);
    search(g, 1, rng.shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]));
    return g;
  }

  // ---------- solving like a person ----------

  // Solves with human techniques and lists each cell in the order it gets filled. hardest: 1 = singles were
  // enough, 2 = it needed pointing, claiming or naked pairs, 3 = it got stuck (too hard for these techniques).
  function humanSolve(puzzle) {
    var g = puzzle.slice(), cand = new Int32Array(81), steps = [], hardest = 0, harder = false, i;
    for (i = 0; i < 81; i++) {
      if (g[i]) continue;
      var used = 0;
      PEERS[i].forEach(function (p) { if (g[p]) used |= bit(g[p]); });
      cand[i] = ALL & ~used;
    }
    function place(k, d, how) {
      g[k] = d; cand[k] = 0;
      var bd = bit(d);
      PEERS[k].forEach(function (p) { cand[p] &= ~bd; });
      steps.push({ cell: k, digit: d, how: how, hard: harder });
      hardest = Math.max(hardest, harder ? 2 : 1);
      harder = false;
    }
    function singles() {
      for (var k = 0; k < 81; k++) if (!g[k] && POP[cand[k]] === 1) { place(k, digitOf(cand[k]), 'single'); return true; }
      for (var u = 0; u < 27; u++) {
        for (var d = 1; d <= 9; d++) {
          var bd = bit(d), spot = -1, n = 0;
          for (var q = 0; q < 9; q++) { var c = UNITS[u][q]; if (g[c] === d) { n = -9; break; } if (!g[c] && (cand[c] & bd)) { n++; spot = c; } }
          if (n === 1) { place(spot, d, 'hidden single'); return true; }
        }
      }
      return false;
    }
    function remove(cells, mask) {
      var changed = false;
      cells.forEach(function (c) { if (!g[c] && (cand[c] & mask)) { cand[c] &= ~mask; changed = true; } });
      return changed;
    }
    function eliminate() {
      var changed = false, u, d, q;
      // pointing and claiming: a digit's spots in one unit all sit inside another unit
      for (u = 0; u < 27; u++) {
        for (d = 1; d <= 9; d++) {
          var bd = bit(d), spots = [];
          for (q = 0; q < 9; q++) { var c = UNITS[u][q]; if (!g[c] && (cand[c] & bd)) spots.push(c); }
          if (spots.length < 2 || spots.length > 3) continue;
          [ROW, COL, BOX].forEach(function (key, kind) {
            var v = key[spots[0]];
            if (!spots.every(function (s) { return key[s] === v; })) return;
            var other = UNITS[v * 3 + kind];
            if (other === UNITS[u]) return;
            if (remove(other.filter(function (c) { return spots.indexOf(c) < 0; }), bd)) changed = true;
          });
        }
      }
      // naked pairs: two cells of a unit that share the same two options
      for (u = 0; u < 27; u++) {
        var unit = UNITS[u];
        for (var a = 0; a < 9; a++) {
          var ca = unit[a];
          if (g[ca] || POP[cand[ca]] !== 2) continue;
          for (var b = a + 1; b < 9; b++) {
            var cb = unit[b];
            if (g[cb] || cand[cb] !== cand[ca]) continue;
            if (remove(unit.filter(function (c) { return c !== ca && c !== cb; }), cand[ca])) changed = true;
          }
        }
      }
      return changed;
    }
    for (;;) {
      if (singles()) continue;
      if (eliminate()) { harder = true; continue; }
      break;
    }
    var solved = g.every(function (v) { return v > 0; });
    return { solved: solved, hardest: solved ? hardest : 3, steps: steps };
  }

  // ---------- making a puzzle ----------

  // Carves a symmetric puzzle out of a random full grid, keeping exactly one solution, until it fits the level.
  function makePuzzle(levelId, rng) {
    var c = LEVELS[levelId], fallback = null;
    // puzzles that need the harder techniques are rarer, so those levels get more tries
    for (var attempt = 0; attempt < (c.need === 2 ? 400 : 80); attempt++) {
      var solution = fullGrid(rng), puzzle = solution.slice(), givens = 81;
      var target = c.givens[0] + Math.floor(rng.next() * (c.givens[1] - c.givens[0] + 1));
      var order = rng.shuffle(Array.from({ length: 41 }, function (_, k) { return k; }));
      for (var k = 0; k < order.length && givens > target; k++) {
        var i = order[k], j = 80 - i, drop = i === j ? 1 : 2;
        if (givens - drop < c.givens[0]) continue;
        var vi = puzzle[i], vj = puzzle[j];
        puzzle[i] = 0; puzzle[j] = 0;
        if (solutions(puzzle, 2) === 1) givens -= drop;
        else { puzzle[i] = vi; puzzle[j] = vj; }
      }
      if (givens > c.givens[1]) continue;
      var rating = humanSolve(puzzle);
      if (rating.hardest === 3) continue;
      var made = { puzzle: puzzle, solution: solution, rating: rating, givens: givens };
      if (rating.hardest === c.need) return made;
      if (!fallback || (c.need === 1 && rating.hardest === 1)) fallback = made;
    }
    return fallback;
  }

  // When the robot fills each cell: its human solving order, at its own pace.
  function robotPlan(rating, c, rng) {
    var t = 2, plan = [];
    rating.steps.forEach(function (s) {
      t += c.pace * (s.hard ? c.hard : 1) * (0.7 + 0.6 * rng.next());
      if (rng.next() < c.slip) t += c.pace * 2.5;
      plan.push({ cell: s.cell, at: t });
    });
    return plan;
  }

  // ---------- a game ----------

  function Game(levelId, seed) {
    var c = LEVELS[levelId], rng = new Rng(seed || 1), made = makePuzzle(levelId, rng);
    this.level = levelId;
    this.cfg = c;
    this.puzzle = made.puzzle;
    this.solution = made.solution;
    this.rating = made.rating;
    this.values = made.puzzle.slice();
    this.given = made.puzzle.map(function (v) { return v > 0; });
    this.notes = new Array(81).fill(0);
    this.toFill = made.puzzle.filter(function (v) { return !v; }).length;
    this.filled = 0;
    this.mistakes = 0;
    this.plan = robotPlan(made.rating, c, rng);
    this.robotFinish = this.plan.length ? this.plan[this.plan.length - 1].at : 0;
    this.robotDone = 0;
    this.t = 0;
    this.over = false;
    this.result = null;
    this.reason = '';
    this.events = [];
  }
  var P = Game.prototype;

  P.margin = function () { return Math.max(0, this.robotFinish - this.t); };
  P.points = function () {
    var win = this.result === 'win';
    return Math.min(50000, 8 * this.filled + (win ? 500 + Math.round(3 * this.margin()) + 100 * (MISTAKES - this.mistakes) : 0));
  };
  P.stars = function () {
    if (this.result !== 'win') return 0;
    var m = this.margin();
    return this.mistakes === 0 && m >= 60 ? 3 : this.mistakes <= 1 && m >= 20 ? 2 : 1;
  };
  P.remaining = function (d) { var n = 0; for (var i = 0; i < 81; i++) if (this.values[i] === d) n++; return 9 - n; };
  P.peers = function (i) { return PEERS[i]; };

  P.step = function () {
    if (this.over) return;
    this.t += DT;
    var moved = false;
    while (this.robotDone < this.plan.length && this.plan[this.robotDone].at <= this.t) { this.robotDone++; moved = true; }
    if (moved) this.events.push({ type: 'robot', done: this.robotDone });
    if (this.robotDone >= this.plan.length) this.finish('lose', 'robot');
  };

  // Writes digit d in cell i. A right number stays (and clears that digit from the notes it sees); a wrong one is
  // a mistake and does not stay.
  P.place = function (i, d) {
    if (this.over || this.given[i] || this.values[i]) return false;
    if (d !== this.solution[i]) {
      this.mistakes++;
      this.events.push({ type: 'mistake', cell: i, digit: d, mistakes: this.mistakes });
      if (this.mistakes >= MISTAKES) this.finish('lose', 'mistakes');
      return false;
    }
    this.values[i] = d;
    this.notes[i] = 0;
    var bd = bit(d), self = this;
    PEERS[i].forEach(function (p) { self.notes[p] &= ~bd; });
    this.filled++;
    var done = [];
    // the row, column and box this cell belongs to (UNITS holds row u, column u, box u at u * 3, + 1, + 2)
    [UNITS[ROW[i] * 3], UNITS[COL[i] * 3 + 1], UNITS[BOX[i] * 3 + 2]].forEach(function (unit) {
      if (unit.every(function (c) { return self.values[c]; })) done.push(unit);
    });
    this.events.push({ type: 'correct', cell: i, digit: d, units: done, digitDone: this.remaining(d) === 0 });
    if (this.filled >= this.toFill) this.finish('win', 'solved');
    return true;
  };

  P.note = function (i, d) {
    if (this.over || this.given[i] || this.values[i]) return false;
    this.notes[i] ^= bit(d);
    return true;
  };
  P.clearNotes = function (i) {
    if (this.over || this.given[i] || this.values[i] || !this.notes[i]) return false;
    this.notes[i] = 0;
    return true;
  };

  P.finish = function (result, reason) {
    if (this.over) return;
    this.over = true;
    this.result = result;
    this.reason = reason;
    this.events.push({ type: 'end', result: result, reason: reason });
  };

  var SU = { DT: DT, MISTAKES: MISTAKES, LEVELS: LEVELS, ROW: ROW, COL: COL, BOX: BOX, UNITS: UNITS, PEERS: PEERS, bit: bit,
    Rng: Rng, solutions: solutions, humanSolve: humanSolve, makePuzzle: makePuzzle, robotPlan: robotPlan, Game: Game };
  if (typeof module !== 'undefined' && module.exports) module.exports = SU;
  else global.SU = SU;
})(typeof window !== 'undefined' ? window : this);
