/*
 * Sneaky Hangman engine: the robot guesses letters, you answer, and your secret word may quietly change
 * as long as it still fits everything you have already shown.
 * Pure logic, no DOM. window.SH in the browser, module.exports in Node (dev/balance_sneaky_hangman.js).
 */
(function (global) {
  'use strict';

  var ALPHA = 'abcdefghijklmnopqrstuvwxyz'.split('');
  var ENGLISH = 'etaoinsrhldcumfpgwybvkxjqz'.split('');

  /*
   * len: word length. lives: wrong guesses the robot can make before it drops.
   * brain: freq (fixed English letter order), count (most common letter among words that still fit),
   * split (the guess that splits the words most evenly), squeeze (the guess that leaves you the fewest words
   * even when you answer as sneakily as possible).
   */
  var LEVELS = {
    pip: { len: 5, lives: 9, brain: 'freq' },
    gridlock: { len: 6, lives: 5, brain: 'count' },
    monolith: { len: 5, lives: 10, brain: 'split' },
    edith: { len: 5, lives: 9, brain: 'squeeze' }
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

  // Groups words by where a letter sits in them. Key '' means the letter is not in the word.
  function partition(words, letter) {
    var groups = {};
    for (var i = 0; i < words.length; i++) {
      var w = words[i], key = '';
      for (var j = 0; j < w.length; j++) if (w.charCodeAt(j) === letter.charCodeAt(0)) key += j;
      (groups[key] || (groups[key] = [])).push(w);
    }
    return groups;
  }

  function entropy(groups, total) {
    var h = 0;
    Object.keys(groups).forEach(function (k) {
      var p = groups[k].length / total;
      h -= p * Math.log(p);
    });
    return h;
  }

  function Round(levelId, wordsByLength, seed) {
    var cfg = LEVELS[levelId];
    this.level = levelId;
    this.cfg = cfg;
    this.rand = rng(seed || 1);
    // Each round uses a random 80% of the word list, so no two rounds play out the same way.
    var all = wordsByLength[cfg.len].split(' '), rand = this.rand;
    this.all = all.filter(function () { return rand() < 0.8; });
    this.cands = this.all.slice();
    this.pattern = [];
    for (var i = 0; i < cfg.len; i++) this.pattern.push('');
    this.guessed = [];
    this.wrong = [];
    this.lives = cfg.lives;
    this.pending = null;   // { letter, groups }
    this.over = false;
    this.winner = null;    // 'you' when the robot runs out of lives, 'bot' when it knows the word
    this.called = null;    // the word the robot calls out when it wins
    this.history = [];
  }

  var P = Round.prototype;

  // The robot picks its next letter (or calls the word once only one word fits).
  P.botMove = function () {
    if (this.over) return null;
    if (this.cands.length === 1) {
      this.called = this.cands[0];
      this.end('bot');
      return { word: this.called };
    }
    var letter = this.chooseLetter();
    this.pending = { letter: letter, groups: partition(this.cands, letter) };
    return { letter: letter };
  };

  P.unguessed = function () {
    var g = this.guessed;
    return ALPHA.filter(function (l) { return g.indexOf(l) < 0; });
  };

  P.chooseLetter = function () {
    var brain = this.cfg.brain, cands = this.cands, rand = this.rand, left = this.unguessed();
    if (brain === 'freq') {
      var order = ENGLISH.filter(function (l) { return left.indexOf(l) >= 0; });
      // sloppy: sometimes skips ahead in its list
      var i = 0;
      while (i < order.length - 1 && rand() < 0.3) i++;
      return order[i];
    }
    var best = null, bestV = -Infinity;
    left.forEach(function (l) {
      var groups = partition(cands, l), keys = Object.keys(groups), v;
      if (keys.length === 1 && keys[0] === '') { v = -1e9; }
      else if (brain === 'count') v = cands.length - (groups[''] ? groups[''].length : 0);
      else if (brain === 'split') v = entropy(groups, cands.length);
      else {
        // squeeze: assume you answer with the biggest group; misses hurt it more, so they count extra
        var worst = 0;
        keys.forEach(function (k) { worst = Math.max(worst, groups[k].length * (k === '' ? 1.35 : 1)); });
        v = -worst + 0.01 * entropy(groups, cands.length);
      }
      v += rand() * 1e-6;
      if (v > bestV) { bestV = v; best = l; }
    });
    return best;
  };

  // Your possible answers to the pending letter, biggest first: { key, positions, count, sample }
  P.options = function () {
    if (!this.pending) return [];
    var g = this.pending.groups;
    return Object.keys(g).map(function (k) {
      return { key: k, positions: k.split('').map(Number), count: g[k].length, sample: g[k].slice(0, 6) };
    }).sort(function (a, b) { return b.count - a.count || (a.key === '' ? -1 : b.key === '' ? 1 : 0); });
  };

  P.answer = function (key) {
    if (this.over || !this.pending || !this.pending.groups[key]) return null;
    var letter = this.pending.letter;
    this.cands = this.pending.groups[key];
    this.guessed.push(letter);
    var hit = key !== '';
    if (hit) key.split('').forEach(function (j) { this.pattern[Number(j)] = letter; }, this);
    else { this.wrong.push(letter); this.lives--; }
    this.pending = null;
    var res = { letter: letter, hit: hit, positions: hit ? key.split('').map(Number) : [], left: this.cands.length };
    this.history.push(res);
    if (this.lives <= 0) this.end('you');
    else if (this.pattern.every(function (c) { return c; })) { this.called = this.pattern.join(''); this.end('bot'); }
    return res;
  };

  P.end = function (w) { this.over = true; this.winner = w; };
  P.hidden = function () { return this.pattern.filter(function (c) { return !c; }).length; };

  // One sample word that fits, for showing "your word right now".
  P.example = function (prefer) {
    if (prefer && this.cands.indexOf(prefer) >= 0) return prefer;
    return this.cands[0];
  };

  var SH = { ALPHA: ALPHA, LEVELS: LEVELS, Round: Round, partition: partition, entropy: entropy, rng: rng };
  if (typeof module !== 'undefined' && module.exports) module.exports = SH;
  else global.SH = SH;
})(typeof window !== 'undefined' ? window : this);
