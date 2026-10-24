/*
 * Copycat engine: a dance floor where the robot repeats your moves a few beats later, from wherever it stands.
 * Every tile you dance on lights up in your color (stepping on the robot's tile steals it). Own more of the
 * floor than the robot when the song ends. Trapdoors open and close to a rhythm, and the floor wraps around:
 * dance off one edge and you come back on the other.
 * Pure logic, CommonJS (the dev scripts use it too).
 */
(function (global) {
  'use strict';

  var W = 8, H = 8;
  var MOVES = ['up', 'right', 'down', 'left', 'stay'];
  var STEP = { up: [0, -1], right: [1, 0], down: [0, 1], left: [-1, 0], stay: [0, 0] };

  /*
   * delay: how many beats later the robot repeats a move ([min, max]; Pip's varies).
   * slip: chance it does a random move instead. skips: times it may stand still instead of a bad move.
   * choose: how many of your recent moves it can pick from (Edith reads ahead and takes the best one).
   * roller: how wide the robot's paint roller is (1 = just its tile, 3 = its tile and both tiles beside it).
   */
  var LEVELS = {
    pip: { beats: 32, delay: [2, 4], slip: 0.25, skips: 0, choose: 1, roller: 2, props: 6, traps: 7 },
    gridlock: { beats: 32, delay: [3, 3], slip: 0, skips: 0, choose: 1, roller: 3, props: 7, traps: 8 },
    monolith: { beats: 32, delay: [2, 2], slip: 0, skips: 3, choose: 2, roller: 3, props: 7, traps: 9 },
    edith: { beats: 32, delay: [2, 2], slip: 0, skips: 2, choose: 4, roller: 3, props: 8, traps: 10 }
  };
  var PERIOD = 4, OPEN = 2;

  function Rng(seed) { this.a = seed >>> 0; }
  Rng.prototype.next = function () {
    this.a = (this.a + 0x6D2B79F5) >>> 0;
    var t = this.a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  Rng.prototype.int = function (a, b) { return a + Math.floor(this.next() * (b - a + 1)); };

  function idx(x, y) { return y * W + x; }
  function inside(x, y) { return x >= 0 && y >= 0 && x < W && y < H; }

  function Game(levelId, seed) {
    if (levelId === undefined) return; // used by clone()
    var c = LEVELS[levelId];
    this.level = levelId;
    this.cfg = c;
    this.rng = new Rng(seed || 1);
    this.turn = 0;
    this.history = [];
    this.botMoves = [];
    this.over = false;
    this.result = null;
    this.skipsLeft = c.skips;
    this.events = [];
    this.you = { id: 1, x: 0, y: H - 1, sx: 0, sy: H - 1, drops: 0 };
    this.bot = { id: 2, x: W - 1, y: 0, sx: W - 1, sy: 0, drops: 0 };
    this.build();
    this.owner = new Uint8Array(W * H); // 0 dark, 1 yours, 2 the robot's
    this.owner[idx(this.you.x, this.you.y)] = 1;
    this.owner[idx(this.bot.x, this.bot.y)] = 2;
  }

  var P = Game.prototype;

  P.build = function () {
    var r = this.rng, c = this.cfg;
    for (var tries = 0; tries < 200; tries++) {
      this.prop = new Uint8Array(W * H);
      this.trap = new Int8Array(W * H).fill(-1); // phase, or -1 for plain floor
      var self = this;
      var near = function (x, y) {
        return Math.abs(x - self.you.sx) + Math.abs(y - self.you.sy) <= 1 || Math.abs(x - self.bot.sx) + Math.abs(y - self.bot.sy) <= 1;
      };
      var placed = 0;
      while (placed < c.props) {
        var x = r.int(0, W - 1), y = r.int(0, H - 1);
        if (near(x, y) || this.prop[idx(x, y)]) continue;
        this.prop[idx(x, y)] = 1;
        placed++;
      }
      if (!this.connected()) continue;
      placed = 0;
      while (placed < c.traps) {
        var tx = r.int(0, W - 1), ty = r.int(0, H - 1), i = idx(tx, ty);
        if (near(tx, ty) || this.prop[i] || this.trap[i] >= 0) continue;
        this.trap[i] = r.int(0, PERIOD - 1);
        placed++;
      }
      break;
    }
  };

  P.connected = function () {
    var seen = new Uint8Array(W * H), q = [idx(this.you.sx, this.you.sy)], n = 0, total = 0;
    for (var i = 0; i < W * H; i++) if (!this.prop[i]) total++;
    seen[q[0]] = 1;
    while (q.length) {
      var u = q.pop(), ux = u % W, uy = (u / W) | 0;
      n++;
      for (var k = 0; k < 4; k++) {
        var d = STEP[MOVES[k]], vx = (ux + d[0] + W) % W, vy = (uy + d[1] + H) % H;
        var v = idx(vx, vy);
        if (!seen[v] && !this.prop[v]) { seen[v] = 1; q.push(v); }
      }
    }
    return n === total;
  };

  P.isOpen = function (i, turn) {
    var ph = this.trap[i];
    return ph >= 0 && ((turn + ph) % PERIOD) < OPEN;
  };
  // Beats until this trapdoor next changes (for the countdown on the floor).
  P.trapCountdown = function (i, turn) {
    var ph = this.trap[i], k = (turn + ph) % PERIOD;
    return k < OPEN ? OPEN - k : PERIOD - k;
  };

  // Where a move from (x, y) ends up: blocked by the edge, props or the other dancer.
  P.land = function (who, move) {
    var d = STEP[move], other = who === this.you ? this.bot : this.you;
    var nx = (who.x + d[0] + W) % W, ny = (who.y + d[1] + H) % H;
    if (move === 'stay') return { x: who.x, y: who.y, bump: false };
    if (this.prop[idx(nx, ny)] || (nx === other.x && ny === other.y)) return { x: who.x, y: who.y, bump: true };
    return { x: nx, y: ny, bump: false, wrap: Math.abs(nx - who.x) > 1 || Math.abs(ny - who.y) > 1 };
  };

  P.step = function (who, move, tag) {
    var to = this.land(who, move);
    if (to.bump) this.events.push({ type: 'bump', who: tag });
    who.x = to.x;
    who.y = to.y;
    var self = this;
    this.rolled(who, move, to).forEach(function (c) { self.paintAt(who, c[0], c[1], tag); });
  };

  // The tiles a move paints: your tile, or for the robot its tile plus the ones beside it (across its direction).
  P.rolled = function (who, move, to) {
    var out = [[to.x, to.y]], w = who === this.bot ? this.cfg.roller : 1;
    if (w <= 1 || move === 'stay' || to.bump) return out;
    var d = STEP[move], sx = d[1] !== 0 ? 1 : 0, sy = d[0] !== 0 ? 1 : 0;
    var sides = w === 2 ? [1] : [1, -1];
    for (var k = 0; k < sides.length; k++) {
      var x = (to.x + sx * sides[k] + W) % W, y = (to.y + sy * sides[k] + H) % H;
      if (!this.prop[idx(x, y)]) out.push([x, y]);
    }
    return out;
  };

  P.paint = function (who, tag) { this.paintAt(who, who.x, who.y, tag); };
  P.paintAt = function (who, x, y, tag) {
    var i = idx(x, y), was = this.owner[i];
    if (was === who.id) return;
    this.owner[i] = who.id;
    this.events.push({ type: was ? 'steal' : 'paint', who: tag, x: x, y: y });
  };

  P.count = function () {
    var you = 0, bot = 0;
    for (var i = 0; i < W * H; i++) { if (this.owner[i] === 1) you++; else if (this.owner[i] === 2) bot++; }
    return { you: you, bot: bot };
  };

  // The moves the robot could use this beat.
  P.candidates = function (turn) {
    var c = this.cfg, h = this.history, out = [];
    if (c.choose > 1) {
      for (var k = c.delay[0]; k < c.delay[0] + c.choose; k++) if (turn - k >= 0 && out.indexOf(h[turn - k]) < 0) out.push(h[turn - k]);
    } else {
      var delay = c.delay[0] === c.delay[1] ? c.delay[0] : this.rng.int(c.delay[0], c.delay[1]);
      out.push(turn - delay >= 0 ? h[turn - delay] : 'stay');
    }
    return out.length ? out : ['stay'];
  };

  // How good a move looks to the robot right now: new tiles are good, stealing yours is better, trapdoors are terrible.
  P.judge = function (move) {
    var to = this.land(this.bot, move), i = idx(to.x, to.y), v = 0, self = this;
    if (this.isOpen(i, this.turn)) v -= 20;
    if (to.bump) v -= 2;
    this.rolled(this.bot, move, to).forEach(function (c) {
      var o = self.owner[idx(c[0], c[1])];
      v += o === 0 ? 2 : o === 1 ? 3 : 0;
    });
    return v;
  };

  P.botChoice = function () {
    var c = this.cfg, cands = this.candidates(this.turn), move = cands[0], self = this;
    if (c.slip && this.rng.next() < c.slip) move = MOVES[this.rng.int(0, 3)];
    else if (cands.length > 1) {
      var best = -Infinity;
      cands.forEach(function (m) { var v = self.judge(m); if (v > best) { best = v; move = m; } });
    }
    if (this.skipsLeft > 0 && move !== 'stay') {
      var to = this.land(this.bot, move);
      var bad = this.isOpen(idx(to.x, to.y), this.turn) || to.bump;
      var stayBad = this.isOpen(idx(this.bot.x, this.bot.y), this.turn);
      if (bad && !stayBad) { this.skipsLeft--; this.events.push({ type: 'skip' }); return { move: 'stay', copied: move, skipped: true, options: cands }; }
    }
    return { move: move, copied: move, skipped: false, options: cands };
  };

  P.drop = function (who, tag) {
    if (!this.isOpen(idx(who.x, who.y), this.turn)) return;
    who.drops++;
    var other = who === this.you ? this.bot : this.you;
    this.events.push({ type: 'drop', who: tag, x: who.x, y: who.y });
    who.x = who.sx;
    who.y = who.sy;
    if (other.x === who.x && other.y === who.y) { who.x = who.sx === 0 ? 1 : W - 2; }
    this.paint(who, tag);
  };

  /* One beat: you move, the robot repeats an older move, then anyone on an open trapdoor falls through. */
  P.play = function (move) {
    if (this.over || MOVES.indexOf(move) < 0) return null;
    this.step(this.you, move, 'you');
    this.history.push(move);
    var b = this.botChoice();
    this.step(this.bot, b.move, 'bot');
    this.botMoves.push(b);
    this.drop(this.you, 'you');
    this.drop(this.bot, 'bot');
    this.turn++;
    if (this.turn >= this.cfg.beats) {
      this.over = true;
      var n = this.count();
      this.result = n.you > n.bot ? 'win' : 'lose';
      this.events.push({ type: 'end', result: this.result });
    }
    return b;
  };

  // The robot's upcoming moves you already know about (for the move tape on screen).
  P.upcoming = function (n) {
    var c = this.cfg, out = [];
    for (var j = 0; j < n; j++) {
      var t = this.turn + j, opts = [];
      for (var k = c.delay[0]; k <= (c.choose > 1 ? c.delay[0] + c.choose - 1 : c.delay[1]); k++) {
        var h = t - k;
        if (h >= 0 && h < this.history.length) opts.push(this.history[h]);
        else if (h >= this.history.length) opts.push(null);
      }
      out.push(opts);
    }
    return out;
  };

  P.clone = function () {
    var g = new Game();
    g.level = this.level;
    g.cfg = this.cfg;
    g.rng = new Rng(0);
    g.rng.a = this.rng.a;
    g.turn = this.turn;
    g.history = this.history.slice();
    g.botMoves = [];
    g.over = this.over;
    g.result = this.result;
    g.skipsLeft = this.skipsLeft;
    g.events = [];
    g.you = Object.assign({}, this.you);
    g.bot = Object.assign({}, this.bot);
    g.prop = this.prop;
    g.trap = this.trap;
    g.owner = this.owner.slice();
    return g;
  };

  var CC = { W: W, H: H, MOVES: MOVES, STEP: STEP, LEVELS: LEVELS, PERIOD: PERIOD, OPEN: OPEN, Game: Game, Rng: Rng, idx: idx };
  if (typeof module !== 'undefined' && module.exports) module.exports = CC;
  else global.CC = CC;
})(typeof window !== 'undefined' ? window : this);
