/*
 * Spot Kick engine: a penalty shootout against a robot that learns your habits.
 * You shoot at one of six zones and then keep goal; the robot predicts you from your history.
 * Pure logic, no DOM. window.SK in the browser, module.exports in Node (dev/balance_spot_kick.js).
 */
(function (global) {
  'use strict';

  // Zones: row 0 is high, row 1 is low; columns 0 left, 1 middle, 2 right (as seen by the shooter).
  var ZONES = [0, 1, 2, 3, 4, 5];
  function col(z) { return z % 3; }
  function row(z) { return (z / 3) | 0; }
  function adjacent(a, b) {
    return a !== b && ((col(a) === col(b) && row(a) !== row(b)) || (row(a) === row(b) && Math.abs(col(a) - col(b)) === 1));
  }
  var ZONE_NAMES = ['top left', 'top middle', 'top right', 'low left', 'low middle', 'low right'];

  /*
   * keeper: how the robot guesses your shots. reach: chance to save a shot next to its dive.
   * grab: chance to save a shot exactly where it dived. aim: its own shooting accuracy.
   */
  /*
   * keeper/shooter: how the robot reads you. grab/reach: its chance to save a shot where it dived, or next to it.
   * miss: chance its own shot goes wide. yourGrab/yourReach: your chance to save its shot where you dived, or next to it.
   * diveSecs: time you get to pick a dive. meter: speed of the power meter.
   */
  var LEVELS = {
    pip: { keeper: 'sloppy', grab: 0.62, reach: 0.08, shooter: 'random', miss: 0.16, yourGrab: 0.8, yourReach: 0.15, diveSecs: 3.2, meter: 1.0 },
    gridlock: { keeper: 'habit', grab: 0.76, reach: 0.16, shooter: 'habit', miss: 0.1, yourGrab: 0.72, yourReach: 0.12, diveSecs: 2.8, meter: 1.15 },
    monolith: { keeper: 'pattern', grab: 0.84, reach: 0.24, shooter: 'pattern', miss: 0.06, yourGrab: 0.65, yourReach: 0.1, diveSecs: 2.5, meter: 1.3 },
    edith: { keeper: 'ensemble', grab: 0.93, reach: 0.38, shooter: 'ensemble', miss: 0.02, yourGrab: 0.5, yourReach: 0.05, diveSecs: 2.2, meter: 1.45 }
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

  // ---------- predictors: each turns a history of zones into a guess for the next one ----------

  function counts(list) {
    var c = [1, 1, 1, 1, 1, 1];
    list.forEach(function (z) { c[z] += 1; });
    return c;
  }
  function norm(v) {
    var s = v.reduce(function (a, b) { return a + b; }, 0);
    return v.map(function (x) { return x / s; });
  }

  var PREDICTORS = {
    habit: { name: 'Favorite spot', fn: function (h) { return norm(counts(h)); } },
    recent: { name: 'Recent streak', fn: function (h) { return norm(counts(h.slice(-4))); } },
    copycat: { name: 'Copycat', fn: function (h) {
      var v = [1, 1, 1, 1, 1, 1];
      if (h.length) v[h[h.length - 1]] += 4;
      return norm(v);
    } },
    switcher: { name: 'Switch it up', fn: function (h) {
      var v = [1, 1, 1, 1, 1, 1];
      if (h.length) { var l = h[h.length - 1]; ZONES.forEach(function (z) { if (col(z) !== col(l)) v[z] += 2; }); }
      return norm(v);
    } },
    follow1: { name: 'After-that', fn: function (h) {
      var v = [1, 1, 1, 1, 1, 1];
      if (h.length < 2) return norm(v);
      var last = h[h.length - 1];
      for (var i = 1; i < h.length; i++) if (h[i - 1] === last) v[h[i]] += 2;
      return norm(v);
    } },
    follow2: { name: 'Two-step', fn: function (h) {
      var v = [1, 1, 1, 1, 1, 1];
      if (h.length < 3) return norm(v);
      var a = h[h.length - 2], b = h[h.length - 1];
      for (var i = 2; i < h.length; i++) if (h[i - 2] === a && h[i - 1] === b) v[h[i]] += 3;
      return norm(v);
    } },
    rhythm: { name: 'Rhythm', fn: function (h) {
      var v = [1, 1, 1, 1, 1, 1];
      if (h.length < 2) return norm(v);
      var a = h[h.length - 2], b = h[h.length - 1];
      var c2 = (col(b) + (col(b) - col(a)) + 3) % 3, r2 = (row(b) + (row(b) - row(a)) + 2) % 2;
      v[r2 * 3 + c2] += 3;
      return norm(v);
    } },
    mirror: { name: 'Mirror', fn: function (h) {
      var v = [1, 1, 1, 1, 1, 1];
      if (h.length) { var l = h[h.length - 1]; v[row(l) * 3 + (2 - col(l))] += 3; }
      return norm(v);
    } }
  };
  var ENSEMBLE = Object.keys(PREDICTORS);

  /*
   * A Reader watches one stream of choices (your shots, or your dives) and guesses the next.
   * The ensemble keeps a running score of how often each predictor would have been right
   * and listens to whichever is reading you best right now.
   */
  function Reader(style, rand, prior) {
    this.style = style;
    this.rand = rand;
    this.history = (prior || []).slice(-20);
    this.priorLen = this.history.length;
    this.scores = {};
    var self = this;
    ENSEMBLE.forEach(function (k) { self.scores[k] = 0; });
    this.lastUsed = null;
    this.lastGuess = null;
    this.confidence = 0;
  }

  Reader.prototype.distribution = function () {
    var h = this.history, s = this.style;
    if (s === 'random') { this.lastUsed = null; return [1, 1, 1, 1, 1, 1].map(function () { return 1 / 6; }); }
    if (s === 'sloppy') { this.lastUsed = 'copycat'; return PREDICTORS.copycat.fn(h); }
    if (s === 'habit') { this.lastUsed = 'habit'; return PREDICTORS.habit.fn(h); }
    if (s === 'pattern') {
      this.lastUsed = 'follow1';
      var a = PREDICTORS.follow1.fn(h), b = PREDICTORS.habit.fn(h);
      return norm(a.map(function (x, i) { return 0.65 * x + 0.35 * b[i]; }));
    }
    // ensemble: listen to whichever predictor has been reading you best lately
    var best = null, bestS = -Infinity, self = this;
    ENSEMBLE.forEach(function (k) { if (self.scores[k] > bestS + 1e-9) { bestS = self.scores[k]; best = k; } });
    this.lastUsed = best;
    return PREDICTORS[best].fn(h);
  };

  // Picks the zone where grab and reach catch the most of the predicted shots (or dives).
  Reader.prototype.cover = function (grab, reach) {
    var d = this.distribution(), rand = this.rand;
    var val = ZONES.map(function (z) {
      var v = grab * d[z];
      ZONES.forEach(function (a) { if (adjacent(a, z)) v += reach * d[a]; });
      return v + rand() * 1e-6;
    });
    var best = 0;
    ZONES.forEach(function (z) { if (val[z] > val[best]) best = z; });
    this.confidence = Math.max.apply(null, d);
    return { zone: best, dist: d, value: val };
  };

  Reader.prototype.guess = function (grab, reach) {
    var g = this.cover(grab, reach).zone;
    if (this.style === 'sloppy' && this.rand() < 0.45) g = Math.floor(this.rand() * 6);
    if (this.style === 'random') g = Math.floor(this.rand() * 6);
    this.lastGuess = g;
    return g;
  };

  // Each predictor earns the chance it gave to what really happened, minus a blind guess.
  Reader.prototype.observe = function (z) {
    var h = this.history, self = this;
    ENSEMBLE.forEach(function (k) {
      var d = PREDICTORS[k].fn(h);
      self.scores[k] = self.scores[k] * 0.8 + (d[z] - 1 / 6);
    });
    h.push(z);
    if (h.length > 40) h.shift();
  };

  // ---------- the shootout ----------

  function Match(levelId, seed, memory) {
    this.level = levelId;
    this.cfg = LEVELS[levelId];
    this.rand = rng(seed || 1);
    memory = memory || {};
    this.keeper = new Reader(this.cfg.keeper, this.rand, levelId === 'edith' || levelId === 'monolith' ? memory.shots : null);
    this.shooter = new Reader(this.cfg.shooter, this.rand, levelId === 'edith' || levelId === 'monolith' ? memory.dives : null);
    this.kicks = [];     // { who: 'you' | 'bot', zone, dive, result: 'goal' | 'save' | 'miss' }
    this.score = { you: 0, bot: 0 };
    this.turn = 'you';
    this.over = false;
    this.winner = null;
  }

  // Your kick. power is 0 to 1 from the meter: 0.55 to 0.85 is the sweet spot.
  Match.prototype.shoot = function (zone, power) {
    if (this.over || this.turn !== 'you') return null;
    var c = this.cfg, dive = this.keeper.guess(c.grab, c.reach), used = this.keeper.lastUsed, conf = this.keeper.confidence;
    var result, why = '';
    var sweet = power >= 0.55 && power <= 0.85, weak = power < 0.35;
    if (row(zone) === 0 && power > 0.9) { result = 'miss'; why = 'over'; }
    else if (col(zone) !== 1 && power > 0.96) { result = 'miss'; why = 'post'; }
    else {
      var save = 0;
      if (dive === zone) save = c.grab;
      else if (adjacent(dive, zone)) save = c.reach;
      if (sweet) save *= 0.72;
      if (weak) save = Math.min(0.95, save * 1.6 + (dive === zone ? 0.1 : 0));
      result = this.rand() < save ? 'save' : 'goal';
    }
    this.keeper.observe(zone);
    var k = { who: 'you', zone: zone, dive: dive, power: power, result: result, why: why, read: used, confidence: conf };
    this.kicks.push(k);
    if (result === 'goal') this.score.you++;
    this.turn = 'bot';
    this.check();
    return k;
  };

  // The robot's kick: it picks a spot first (call aim), then you dive.
  Match.prototype.aim = function () {
    var c = this.cfg, self = this;
    // shoot where it expects your dive to save the least
    var cov = this.shooter.cover(c.yourGrab, c.yourReach), best = 0;
    var risk = cov.value.map(function (v) { return v + self.rand() * (c.shooter === 'random' ? 10 : 0.04); });
    ZONES.forEach(function (z) { if (risk[z] < risk[best]) best = z; });
    var predicted = cov.dist.indexOf(Math.max.apply(null, cov.dist));
    this.pendingAim = { zone: best, predicted: predicted, read: this.shooter.lastUsed };
    return this.pendingAim;
  };

  Match.prototype.keep = function (dive) {
    if (this.over || this.turn !== 'bot') return null;
    var a = this.pendingAim || this.aim();
    this.pendingAim = null;
    var c = this.cfg, result;
    if (this.rand() < c.miss) result = 'miss';
    else {
      var save = 0;
      if (dive === a.zone) save = c.yourGrab;
      else if (dive != null && adjacent(dive, a.zone)) save = c.yourReach;
      result = this.rand() < save ? 'save' : 'goal';
    }
    if (dive != null) this.shooter.observe(dive);
    var k = { who: 'bot', zone: a.zone, dive: dive, result: result, read: a.read, predicted: a.predicted };
    this.kicks.push(k);
    if (result === 'goal') this.score.bot++;
    this.turn = 'you';
    this.check();
    return k;
  };

  Match.prototype.taken = function (who) { return this.kicks.filter(function (k) { return k.who === who; }).length; };

  Match.prototype.check = function () {
    var you = this.taken('you'), bot = this.taken('bot'), s = this.score;
    if (you <= 5 && bot <= 5) {
      // regulation: stop early once nobody can catch up
      var youLeft = 5 - you, botLeft = 5 - bot;
      if (s.you > s.bot + botLeft) return this.end('you');
      if (s.bot > s.you + youLeft) return this.end('bot');
      if (you === 5 && bot === 5 && s.you !== s.bot) return this.end(s.you > s.bot ? 'you' : 'bot');
      return;
    }
    // sudden death: after each pair
    if (you === bot && s.you !== s.bot) return this.end(s.you > s.bot ? 'you' : 'bot');
    if (you >= 15 && you === bot) return this.end('bot');
  };

  Match.prototype.end = function (w) { this.over = true; this.winner = w; };

  Match.prototype.saves = function () { return this.kicks.filter(function (k) { return k.who === 'bot' && k.result !== 'goal'; }).length; };
  Match.prototype.memory = function () {
    return {
      shots: this.keeper.history.slice(-20),
      dives: this.shooter.history.slice(-20)
    };
  };

  var SK = { ZONES: ZONES, ZONE_NAMES: ZONE_NAMES, LEVELS: LEVELS, PREDICTORS: PREDICTORS, Match: Match, Reader: Reader, rng: rng, col: col, row: row, adjacent: adjacent };
  if (typeof module !== 'undefined' && module.exports) module.exports = SK;
  else global.SK = SK;
})(typeof window !== 'undefined' ? window : this);
