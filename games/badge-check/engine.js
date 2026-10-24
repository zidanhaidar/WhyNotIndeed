/*
 * Badge Check engine: you guard the office turnstile. Coworkers walk up with their badges and a robot forger
 * slips fakes into the queue. A real badge matches everything: the person matches the photo, the name is in the
 * staff directory exactly as written, the floor is the floor of that department, the date has not passed, and
 * it carries this week's stamp. A fake gets one of those wrong (or belongs to nobody on staff). Let the real
 * ones in, stop the fakes, before the timer runs out. Three mistakes end the shift; the timer keeps shrinking.
 * The forger learns which details slip past you. Pure logic, CommonJS (the dev scripts use it too).
 * Dates are real calendar dates with a year. In the game "today" is the player's own date (their computer's
 * timezone): a badge is valid through its date, and expired from the day after.
 */
(function (global) {
  'use strict';

  var DT = 1 / 30;
  var STRIKES = 3;
  var KINDS = ['photo', 'name', 'floor', 'expiry', 'stamp', 'ghost'];
  var FIRST = ['Ada', 'Ben', 'Carla', 'Dev', 'Elif', 'Femi', 'Greta', 'Hugo', 'Ines', 'Jonah', 'Kemi', 'Lars', 'Mina', 'Noor', 'Omar', 'Priya',
    'Quinn', 'Rosa', 'Sami', 'Tess', 'Umar', 'Vera', 'Wes', 'Yuki', 'Zane', 'Bella', 'Dario', 'Freya', 'Ivo', 'Lena', 'Milo', 'Nadia'];
  var LAST = ['Abbott', 'Baker', 'Castro', 'Dunn', 'Ellis', 'Fischer', 'Garcia', 'Hale', 'Iqbal', 'Jensen', 'Kowalski', 'Lindqvist', 'Moreau',
    'Novak', 'Okafor', 'Park', 'Quist', 'Rossi', 'Sato', 'Tanaka', 'Usman', 'Varga', 'Walsh', 'Young', 'Zhou', 'Brennan', 'Mendez', 'Petrov'];
  var DEPTS = ['Accounting', 'Marketing', 'IT', 'Legal', 'Sales', 'Design'];
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  var DAY = 86400000;
  var STAMP_COLORS = { red: '#E5483A', orange: '#EF8A2B', green: '#2FBF71', teal: '#1F9C8E', blue: '#3D86F0', purple: '#8E5BD6' };
  var NEAR = { red: 'orange', orange: 'red', green: 'teal', teal: 'green', blue: 'purple', purple: 'blue' };
  var SHAPES = ['star', 'circle', 'diamond', 'heart'];
  var LOOK = { skin: 6, hair: 5, hairColor: 6, shirt: 6 }; // how many of each the art has

  /*
   * fake: share of visitors with a forged badge (rises by `rise` per visitor, up to `most`).
   * timer: [seconds for the first visitor, the fewest]; it shrinks by `shrink` per visitor.
   * kinds: which forgeries this forger knows. subtle: 0 obvious to 3 sneaky (a one-letter typo, yesterday's
   * date, a near-miss stamp color). brain: random, rota (always the same order), learn (more of whatever got
   * past you), read (learns faster and, when you decide in a hurry, picks the slow-to-check details).
   */
  var LEVELS = {
    pip: { fake: 0.3, rise: 0.003, most: 0.45, timer: [15, 5], shrink: 0.15, kinds: ['photo', 'expiry', 'stamp', 'floor'], subtle: 0, brain: 'random' },
    gridlock: { fake: 0.35, rise: 0.003, most: 0.5, timer: [13, 6], shrink: 0.12, kinds: ['photo', 'expiry', 'stamp', 'floor', 'name'], subtle: 1, brain: 'rota' },
    monolith: { fake: 0.38, rise: 0.003, most: 0.5, timer: [12, 5.5], shrink: 0.12, kinds: KINDS, subtle: 2, brain: 'learn' },
    edith: { fake: 0.42, rise: 0.003, most: 0.55, timer: [11.5, 5.2], shrink: 0.12, kinds: KINDS, subtle: 3, brain: 'read' }
  };
  var STARS = [20, 45, 80]; // correct calls for one, two and three stars

  function Rng(seed) { this.a = seed >>> 0; }
  Rng.prototype.next = function () {
    this.a = (this.a + 0x6D2B79F5) >>> 0;
    var t = this.a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  Rng.prototype.int = function (a, b) { return a + Math.floor(this.next() * (b - a + 1)); };
  Rng.prototype.pick = function (arr) { return arr[this.int(0, arr.length - 1)]; };
  Rng.prototype.shuffle = function (arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = this.int(0, i); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  };

  // Dates are { year, month (0 to 11), day }. Day numbers count whole days, so comparing them compares dates.
  function dayNum(d) { return Math.round(Date.UTC(d.year, d.month, d.day) / DAY); }
  function fromDayNum(n) { var t = new Date(n * DAY); return { year: t.getUTCFullYear(), month: t.getUTCMonth(), day: t.getUTCDate() }; }
  function dateText(d) { return d.day + ' ' + MONTHS[d.month] + ' ' + d.year; }
  function weekday(d) { return WEEKDAYS[new Date(Date.UTC(d.year, d.month, d.day)).getUTCDay()]; }
  // the same day one year earlier (29 February becomes the 28th)
  function lastYear(d) { var y = d.year - 1, last = new Date(Date.UTC(y, d.month + 1, 0)).getUTCDate(); return { year: y, month: d.month, day: Math.min(d.day, last) }; }
  function expired(b, today) { return dayNum(b.expires) < dayNum(today); }

  // today: { year, month, day }; the game passes the player's own date. Left out (the dev scripts), it is a
  // date picked from the seed.
  function Shift(levelId, seed, today) {
    var c = LEVELS[levelId], r = new Rng(seed || 1);
    this.level = levelId;
    this.cfg = c;
    this.rng = r;
    // today, the floors of each department, this week's stamp
    this.today = today ? { year: today.year, month: today.month, day: today.day } : fromDayNum(dayNum({ year: 2026, month: 0, day: 1 }) + r.int(0, 1100));
    var floors = r.shuffle([2, 3, 4, 5, 6, 7]);
    this.floors = {};
    for (var i = 0; i < DEPTS.length; i++) this.floors[DEPTS[i]] = floors[i];
    var colors = Object.keys(STAMP_COLORS);
    this.stamp = { color: r.pick(colors), shape: r.pick(SHAPES) };
    // the staff directory: twelve people, two per department, each with their own look
    var firsts = r.shuffle(FIRST), lasts = r.shuffle(LAST);
    this.staff = [];
    for (var k = 0; k < 12; k++) {
      this.staff.push({ first: firsts[k], last: lasts[k], dept: DEPTS[k % DEPTS.length], look: this.randomLook() });
    }
    this.spareFirst = firsts.slice(12);
    this.spareLast = lasts.slice(12);
    this.served = 0;     // visitors decided
    this.correct = 0;
    this.strikes = 0;
    this.streak = 0;
    this.bonus = 0;      // streak and quick-call points
    this.history = [];   // { forged, letIn, correct, quick } per visitor
    this.weights = {};
    for (var kk = 0; kk < c.kinds.length; kk++) this.weights[c.kinds[kk]] = 1;
    this.rota = 0;
    this.over = false;
    this.events = [];
    this.visitor = null;
    this.next();
  }
  var P = Shift.prototype;

  P.randomLook = function () {
    var r = this.rng;
    return { skin: r.int(0, LOOK.skin - 1), hair: r.int(0, LOOK.hair - 1), hairColor: r.int(0, LOOK.hairColor - 1), glasses: r.next() < 0.35, shirt: r.int(0, LOOK.shirt - 1) };
  };
  P.timerFor = function (n) { var t = this.cfg.timer; return Math.max(t[1], t[0] - this.cfg.shrink * n); };
  P.points = function () { return Math.min(50000, 10 * this.correct + this.bonus); };
  P.stars = function () { var n = this.correct; return n >= STARS[2] ? 3 : n >= STARS[1] ? 2 : n >= STARS[0] ? 1 : 0; };
  P.dateText = function (d) { return dateText(d || this.today); };
  P.weekday = function () { return weekday(this.today); };

  // A new day began while you were playing (midnight on the player's clock). Badges are checked against the new
  // date, so the visitor in front of you may have just run out.
  P.setToday = function (d) {
    if (dayNum(d) === dayNum(this.today)) return false;
    this.today = { year: d.year, month: d.month, day: d.day };
    var v = this.visitor;
    if (v && !v.forged && expired(v.badge, this.today)) v.forged = 'expiry';
    this.events.push({ type: 'newday' });
    return true;
  };
  P.inDirectory = function (first, last) { return this.staff.some(function (s) { return s.first === first && s.last === last; }); };

  // ---------- the forger ----------

  P.chooseKind = function () {
    var c = this.cfg, r = this.rng, kinds = c.kinds;
    if (c.brain === 'random') return r.pick(kinds);
    if (c.brain === 'rota') return kinds[this.rota++ % kinds.length];
    var w = Object.assign({}, this.weights);
    if (c.brain === 'read') {
      // hurried calls lately? then the slow details are the ones being skipped
      var recent = this.history.slice(-4), hurried = recent.filter(function (h) { return h.quick; }).length;
      if (hurried >= 3) { w.name = (w.name || 1) * 2.5; w.ghost = (w.ghost || 1) * 2.5; w.floor = (w.floor || 1) * 2; }
    }
    var total = 0;
    kinds.forEach(function (k) { total += w[k]; });
    var roll = r.next() * total;
    for (var i = 0; i < kinds.length; i++) { roll -= w[kinds[i]]; if (roll < 0) return kinds[i]; }
    return kinds[kinds.length - 1];
  };

  // A badge that matches the staff member perfectly.
  P.trueBadge = function (s) {
    // valid through a date from today (it still counts on its last day) to about a year and a bit ahead
    var r = this.rng, exp = fromDayNum(dayNum(this.today) + (r.next() < 0.05 ? 0 : r.int(3, 420)));
    return { first: s.first, last: s.last, dept: s.dept, floor: this.floors[s.dept], expires: exp, stamp: { color: this.stamp.color, shape: this.stamp.shape }, photo: s.look };
  };

  function typo(name, r, subtle) {
    var i = r.int(1, name.length - 2), ch = name.split('');
    if (subtle >= 2) {
      // swap two letters next to each other, or double one: easy to read past
      if (r.next() < 0.5 && ch[i] !== ch[i + 1]) { var t = ch[i]; ch[i] = ch[i + 1]; ch[i + 1] = t; }
      else ch.splice(i, 0, ch[i]);
    } else {
      var vowels = 'aeiou', v = ch[i].toLowerCase();
      ch[i] = vowels.indexOf(v) >= 0 ? vowels.charAt((vowels.indexOf(v) + 2) % 5) : 'x';
      if (subtle === 0) ch.push('o');
    }
    var out = ch.join('');
    return out === name ? name + 'e' : out;
  }

  // Changes one detail of a true badge (or the person) according to the kind of forgery.
  P.forge = function (kind, s, badge, person) {
    var r = this.rng, sub = this.cfg.subtle;
    if (kind === 'photo') {
      var p = badge.photo = Object.assign({}, s.look);
      // the badge photo is somebody else: the more obvious the forger, the more that differs
      var changes = sub <= 0 ? 3 : sub === 1 ? 2 : 1;
      var keys = r.shuffle(['hairColor', 'hair', 'glasses', 'skin']).slice(0, changes);
      keys.forEach(function (k) {
        if (k === 'glasses') p.glasses = !p.glasses;
        else p[k] = (p[k] + 1 + r.int(0, LOOK[k] - 2)) % LOOK[k];
      });
    } else if (kind === 'name') {
      if (r.next() < 0.5) badge.last = typo(s.last, r, sub); else badge.first = typo(s.first, r, sub);
    } else if (kind === 'floor') {
      var right = badge.floor;
      if (sub === 0) badge.floor = 9;
      else if (sub >= 3) badge.floor = right === 7 ? 6 : right + (r.next() < 0.5 && right > 2 ? -1 : 1);
      else { var others = [2, 3, 4, 5, 6, 7].filter(function (f) { return f !== right; }); badge.floor = r.pick(others); }
    } else if (kind === 'expiry') {
      // a date before today: long ago for an obvious forger; for sneaky ones, yesterday, or today's day and
      // month but last year (only the year gives it away)
      if ((sub === 2 && r.next() < 0.3) || (sub >= 3 && r.next() < 0.5)) badge.expires = lastYear(this.today);
      else {
        var back = sub === 0 ? r.int(90, 500) : sub === 1 ? r.int(15, 90) : sub === 2 ? r.int(2, 14) : 1;
        badge.expires = fromDayNum(dayNum(this.today) - back);
      }
    } else if (kind === 'stamp') {
      if (sub >= 2 && r.next() < 0.5) badge.stamp.shape = r.pick(SHAPES.filter(function (x) { return x !== badge.stamp.shape; }));
      else badge.stamp.color = sub >= 2 ? NEAR[badge.stamp.color] : r.pick(Object.keys(STAMP_COLORS).filter(function (x) { return x !== badge.stamp.color && x !== NEAR[badge.stamp.color]; }));
    } else if (kind === 'ghost') {
      // somebody who is not on staff at all, with a perfectly made badge
      badge.first = r.pick(this.spareFirst);
      badge.last = r.pick(this.spareLast);
      person.look = badge.photo = this.randomLook();
    }
  };

  P.next = function () {
    var c = this.cfg, r = this.rng;
    var s = r.pick(this.staff), badge = this.trueBadge(s), person = { look: s.look };
    var fakeShare = Math.min(c.most, c.fake + c.rise * this.served), forged = null;
    if (r.next() < fakeShare) {
      forged = this.chooseKind();
      this.forge(forged, s, badge, person);
    }
    var t = this.timerFor(this.served);
    this.visitor = { id: this.served + 1, staff: s, person: person, badge: badge, forged: forged, timer: t, left: t };
    this.events.push({ type: 'visitor', id: this.visitor.id });
  };

  // ---------- your calls ----------

  P.step = function () {
    if (this.over || !this.visitor) return;
    this.visitor.left -= DT;
    if (this.visitor.left <= 0) this.judge(null);
  };

  // letIn: true to let the visitor in, false to stop them, null when the timer ran out.
  P.decide = function (letIn) { if (!this.over && this.visitor) this.judge(!!letIn); };

  P.judge = function (letIn) {
    var v = this.visitor, fake = !!v.forged, c = this.cfg;
    var timeout = letIn === null;
    var correct = !timeout && (letIn ? !fake : fake);
    var quick = !timeout && v.left >= v.timer * 0.5;
    this.served++;
    this.history.push({ forged: v.forged, letIn: letIn, correct: correct, quick: quick });
    var gained = 0;
    if (correct) {
      this.correct++;
      this.streak++;
      gained = 10 + 2 * Math.min(this.streak, 10) + (quick ? 5 : 0);
      this.bonus += gained - 10;
    } else {
      this.streak = 0;
      this.strikes++;
    }
    // the forger learns: a fake that got past you gets used more, one you caught gets used less
    if (fake && this.weights[v.forged] != null && !timeout) {
      var up = c.brain === 'read' ? 3.5 : 2.5, down = c.brain === 'read' ? 0.6 : 0.7;
      this.weights[v.forged] = Math.max(0.2, Math.min(12, this.weights[v.forged] * (letIn ? up : down)));
    }
    this.events.push({ type: 'judged', id: v.id, letIn: letIn, fake: fake, kind: v.forged, correct: correct, timeout: timeout, gained: gained, strikes: this.strikes });
    if (this.strikes >= STRIKES) {
      this.over = true;
      this.visitor = null;
      this.events.push({ type: 'end' });
      return;
    }
    this.next();
  };

  // What is wrong with a badge, in plain words (for the end of a call and for hints).
  P.explain = function (v) {
    var b = v.badge, s = v.staff;
    switch (v.forged) {
      case 'photo': return 'The photo on the badge was not this person.';
      case 'name': return 'The name was misspelled: the directory says ' + s.first + ' ' + s.last + '.';
      case 'floor': return b.dept + ' is on floor ' + this.floors[b.dept] + ', not floor ' + b.floor + '.';
      case 'expiry': return 'The badge ran out on ' + dateText(b.expires) + '. Today is ' + dateText(this.today) + '.';
      case 'stamp': return 'This week\'s stamp is a ' + this.stamp.color + ' ' + this.stamp.shape + '; the badge had a ' + b.stamp.color + ' ' + b.stamp.shape + '.';
      case 'ghost': return b.first + ' ' + b.last + ' is not in the staff directory.';
    }
    return 'Everything on the badge checked out.';
  };

  var BC = { DT: DT, STRIKES: STRIKES, KINDS: KINDS, DEPTS: DEPTS, MONTHS: MONTHS, STAMP_COLORS: STAMP_COLORS, SHAPES: SHAPES, LOOK: LOOK, LEVELS: LEVELS, STARS: STARS,
    Shift: Shift, Rng: Rng, dateText: dateText, dayNum: dayNum, fromDayNum: fromDayNum, weekday: weekday, expired: expired };
  if (typeof module !== 'undefined' && module.exports) module.exports = BC;
  else global.BC = BC;
})(typeof window !== 'undefined' ? window : this);
