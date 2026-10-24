/*
 * Going Up engine: you run an office elevator through an endless working day. People appear on the floors and
 * press the button; you choose where your car stops. Deliver as many riders as you can. A rival robot elevator
 * in the next shaft snaps up riders too, but only people still in a good mood will ride with a robot, so the
 * grumpy ones are always yours. Three people giving up and taking the stairs ends the shift. The building
 * grows taller and the rushes get busier as the day goes on, so every shift ends sooner or later.
 * Pure logic, CommonJS (the dev scripts use it too).
 */
(function (global) {
  'use strict';

  var DT = 1 / 30;
  var START_FLOORS = 6, MAX_FLOORS = 10;
  var CAR = { speed: 2.4, cap: 6, door: 0.8, perPerson: 0.15 };
  var STRIKES = 3, QUICK = 20; // a quick trip: from pressing the button to arriving, in seconds
  // The day repeats: a calm spell, then a rush. Lunch sends everyone to the canteen on the top floor.
  var CYCLE = [
    { kind: 'calm', len: 35 }, { kind: 'morning', len: 15 },
    { kind: 'calm', len: 35 }, { kind: 'lunch', len: 15 },
    { kind: 'calm', len: 35 }, { kind: 'home', len: 15 }
  ];
  var RUSH = 1.9;

  /*
   * patience: seconds a person waits before taking the stairs (each person varies by up to 15%).
   * rate: [people per second at the start, extra per minute, most per second], times RUSH during a rush.
   * grow: seconds between new floors. rival.mood: the rival only takes people with at least this share of their
 * patience left. Smarter robots are pickier: they skim off the fresh, happy riders and leave you the grumpy ones.
   * Rival brains: wander (random calls), sweep (end to end like an old lift), crowd (the biggest crowd nearby),
   * snipe (races you to your next stop when it can get there first, and waits where the next rush starts).
   */
  var LEVELS = {
    pip: { patience: 42, rate: [0.22, 0.1, 1.0], grow: 50, rival: { brain: 'wander', speed: 1.2, cap: 3, mood: 0.3 } },
    gridlock: { patience: 37, rate: [0.25, 0.12, 1.1], grow: 45, rival: { brain: 'sweep', speed: 1.7, cap: 4, mood: 0.45 } },
    monolith: { patience: 33, rate: [0.27, 0.13, 1.2], grow: 45, rival: { brain: 'crowd', speed: 2.0, cap: 5, mood: 0.55 } },
    edith: { patience: 31, rate: [0.28, 0.14, 1.25], grow: 40, rival: { brain: 'snipe', speed: 2.3, cap: 6, mood: 0.6 } }
  };
  var STARS = [40, 90, 150]; // riders delivered for one, two and three stars

  function Rng(seed) { this.a = seed >>> 0; }
  Rng.prototype.next = function () {
    this.a = (this.a + 0x6D2B79F5) >>> 0;
    var t = this.a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  Rng.prototype.int = function (a, b) { return a + Math.floor(this.next() * (b - a + 1)); };

  function Car(speed, cap, y) {
    this.y = y;
    this.speed = speed;
    this.cap = cap;
    this.riders = [];
    this.stops = [];     // your car: the stops you picked, in order
    this.target = null;  // the rival's current goal
    this.state = 'idle'; // idle, move or doors
    this.doorT = 0;
    this.dir = 1;
    this.delivered = 0;
  }

  function Building(levelId, seed) {
    var c = LEVELS[levelId];
    this.level = levelId;
    this.cfg = c;
    this.rng = new Rng(seed || 1);
    this.t = 0;
    this.floors = START_FLOORS;
    this.queues = [];
    for (var f = 0; f < MAX_FLOORS; f++) this.queues.push([]);
    this.you = new Car(CAR.speed, CAR.cap, 0);
    this.bot = new Car(c.rival.speed, c.rival.cap, 3);
    this.quick = 0;
    this.strikes = 0;
    this.nextId = 1;
    this.phaseIdx = 0;
    this.phaseT = 0;
    this.day = 1;
    this.growT = 0;
    this.rethink = 0;
    this.warned = false;
    this.over = false;
    this.events = [];
  }
  var P = Building.prototype;

  P.phase = function () { return CYCLE[this.phaseIdx]; };
  // The next rush and how many seconds until it starts (0 while one is on).
  P.nextRush = function () {
    var cur = this.phase();
    if (cur.kind !== 'calm') return { kind: cur.kind, in: 0, left: cur.len - this.phaseT };
    var nxt = CYCLE[(this.phaseIdx + 1) % CYCLE.length];
    return { kind: nxt.kind, in: cur.len - this.phaseT, left: nxt.len };
  };
  P.rate = function () {
    var r = this.cfg.rate, base = Math.min(r[2], r[0] + r[1] * this.t / 60);
    return base * (this.phase().kind === 'calm' ? 1 : RUSH);
  };
  P.points = function () { return Math.min(50000, 10 * this.you.delivered + 10 * this.quick); };
  P.stars = function () { var d = this.you.delivered; return d >= STARS[2] ? 3 : d >= STARS[1] ? 2 : d >= STARS[0] ? 1 : 0; };
  P.waiting = function () { var n = 0; for (var f = 0; f < this.floors; f++) n += this.queues[f].length; return n; };
  P.mood = function (p) { return Math.max(0, p.left / p.patience); };

  // ---------- your controls ----------

  // Adds a stop to your car's list, or takes it off again. Pressing the floor you are parked at opens the doors.
  P.toggleStop = function (f) {
    if (this.over || f < 0 || f >= this.floors) return false;
    var car = this.you, i = car.stops.indexOf(f);
    if (i >= 0) { car.stops.splice(i, 1); return true; }
    car.stops.push(f);
    return true;
  };

  // ---------- one tick ----------

  P.step = function () {
    if (this.over) return;
    this.t += DT;
    this.advancePhase();
    this.growT += DT;
    if (this.growT >= this.cfg.grow && this.floors < MAX_FLOORS) {
      this.growT = 0;
      this.floors++;
      this.events.push({ type: 'grow', floors: this.floors });
    }
    if (this.rng.next() < this.rate() * DT) this.spawn();
    this.tickPatience();
    if (this.over) return;
    this.rival();
    this.moveCar(this.you, 'you');
    this.moveCar(this.bot, 'bot');
  };

  P.advancePhase = function () {
    this.phaseT += DT;
    var nr = this.nextRush();
    if (nr.in > 0 && nr.in <= 5 && !this.warned) { this.warned = true; this.events.push({ type: 'soon', kind: nr.kind }); }
    if (this.phaseT < this.phase().len) return;
    this.phaseT = 0;
    this.phaseIdx = (this.phaseIdx + 1) % CYCLE.length;
    if (this.phaseIdx === 0) this.day++;
    this.warned = false;
    var k = this.phase().kind;
    this.events.push({ type: k === 'calm' ? 'calm' : 'rush', kind: k });
  };

  P.spawn = function () {
    var r = this.rng, top = this.floors - 1, kind = this.phase().kind, o, d;
    if (kind === 'morning' && r.next() < 0.8) { o = 0; d = r.int(1, top); }
    else if (kind === 'lunch' && r.next() < 0.7) { o = r.int(0, top - 1); d = top; }
    else if (kind === 'home' && r.next() < 0.8) { o = r.int(1, top); d = 0; }
    else {
      o = r.next() < 0.3 ? 0 : r.int(0, top);
      d = o === 0 || r.next() < 0.5 ? (o === 0 ? r.int(1, top) : 0) : r.int(0, top);
      while (d === o) d = r.int(0, top);
    }
    var pat = this.cfg.patience * (0.85 + 0.3 * r.next());
    var p = { id: this.nextId++, floor: o, dest: d, t0: this.t, patience: pat, left: pat, look: r.int(0, 5) };
    this.queues[o].push(p);
    this.events.push({ type: 'spawn', floor: o });
    // someone arriving at a floor where a car stands open just walks in
    if (this.you.state === 'doors' && Math.round(this.you.y) === o) this.board(this.you, 'you', true);
    else if (this.bot.state === 'doors' && Math.round(this.bot.y) === o) this.board(this.bot, 'bot', true);
  };

  P.tickPatience = function () {
    for (var f = 0; f < this.floors; f++) {
      var q = this.queues[f];
      for (var i = q.length - 1; i >= 0; i--) {
        q[i].left -= DT;
        if (q[i].left > 0) continue;
        q.splice(i, 1);
        this.strikes++;
        this.events.push({ type: 'stairs', floor: f, strikes: this.strikes });
        if (this.strikes >= STRIKES) { this.over = true; this.events.push({ type: 'end' }); return; }
      }
    }
  };

  P.moveCar = function (car, who) {
    if (car.state === 'doors') {
      car.doorT -= DT;
      if (car.doorT <= 0) car.state = 'idle';
      return;
    }
    var target = who === 'you' ? (car.stops.length ? car.stops[0] : null) : car.target, park = false;
    if (target != null && target >= this.floors) { if (who === 'you') car.stops.shift(); else car.target = null; return; }
    if (target == null) {
      // never park between two floors
      var near = Math.round(car.y);
      if (Math.abs(car.y - near) < 1e-6) { car.state = 'idle'; return; }
      target = car.dir > 0 ? Math.ceil(car.y) : Math.floor(car.y);
      park = true;
    }
    var dy = target - car.y, step = car.speed * DT;
    if (Math.abs(dy) <= step) {
      car.y = target;
      if (park) car.state = 'idle';
      else this.arrive(car, who, target);
      return;
    }
    car.dir = dy > 0 ? 1 : -1;
    car.y += car.dir * step;
    car.state = 'move';
  };

  P.arrive = function (car, who, f) {
    if (who === 'you') car.stops.shift(); else car.target = null;
    var out = 0, quick = 0, keep = [];
    for (var i = 0; i < car.riders.length; i++) {
      var p = car.riders[i];
      if (p.dest !== f) { keep.push(p); continue; }
      out++;
      car.delivered++;
      if (who === 'you' && this.t - p.t0 <= QUICK) { this.quick++; quick++; }
    }
    car.riders = keep;
    car.state = 'doors';
    car.doorT = CAR.door + CAR.perPerson * out;
    var n = this.board(car, who, false);
    this.events.push({ type: 'arrive', who: who, floor: f, out: out, quick: quick, in: n, full: car.riders.length >= car.cap && this.queues[f].length > 0 });
  };

  // Lets waiting people on the car's floor in, up to its capacity. The robot only takes people in a good mood.
  P.board = function (car, who, late) {
    var f = Math.round(car.y), q = this.queues[f], n = 0, mood = this.cfg.rival.mood;
    for (var i = 0; i < q.length && car.riders.length < car.cap;) {
      var p = q[i];
      if (who === 'bot' && this.mood(p) < mood) { i++; continue; }
      q.splice(i, 1);
      car.riders.push(p);
      n++;
    }
    if (!n) return 0;
    car.doorT += CAR.perPerson * n;
    if (who === 'bot' && this.you.stops.length && this.you.stops[0] === f) this.events.push({ type: 'stolen', floor: f, n: n });
    if (late) this.events.push({ type: 'arrive', who: who, floor: f, out: 0, quick: 0, in: n, full: false });
    return n;
  };

  // ---------- the rival elevator ----------

  P.eligible = function (f) {
    var q = this.queues[f], n = 0;
    for (var i = 0; i < q.length; i++) if (this.mood(q[i]) >= this.cfg.rival.mood) n++;
    return n;
  };
  // How long your car needs to reach floor f if it is your next stop.
  P.etaYou = function (f) {
    var c = this.you;
    return Math.abs(c.y - f) / c.speed + (c.state === 'doors' ? c.doorT : 0);
  };

  P.rival = function () {
    var car = this.bot;
    if (car.state === 'doors') return;
    this.rethink -= DT;
    var brain = this.cfg.rival.brain;
    // Edith changes her mind on the way when a better chance turns up
    if (car.target != null && !(brain === 'snipe' && this.rethink <= 0)) return;
    this.rethink = 0.5;
    var t = this[brain]();
    if (t == null) { if (brain !== 'snipe') car.target = null; return; }
    car.target = t;
  };

  function nearest(list, y) {
    var best = null, bd = Infinity;
    list.forEach(function (f) { var d = Math.abs(f - y); if (d < bd) { bd = d; best = f; } });
    return best;
  }

  // Pip: the first rider's floor, or any floor with people, chosen at random.
  P.wander = function () {
    var car = this.bot;
    if (car.riders.length) return car.riders[0].dest;
    var calls = [];
    for (var f = 0; f < this.floors; f++) if (this.eligible(f)) calls.push(f);
    if (calls.length) return calls[this.rng.int(0, calls.length - 1)];
    return null;
  };

  // Ted: rides end to end, stopping wherever someone gets off or a happy person waits.
  P.sweep = function () {
    var car = this.bot, here = Math.round(car.y), room = car.riders.length < car.cap, self = this;
    function wants(f) {
      return car.riders.some(function (p) { return p.dest === f; }) || (room && self.eligible(f) > 0);
    }
    for (var turn = 0; turn < 2; turn++) {
      for (var f = here + car.dir; f >= 0 && f < this.floors; f += car.dir) if (wants(f)) return f;
      car.dir = -car.dir;
    }
    return null;
  };

  // A stop on the way to `goal` where happy people wait, or the goal itself.
  P.onTheWay = function (goal) {
    var car = this.bot, here = Math.round(car.y), dir = goal > here ? 1 : -1;
    if (goal !== here && car.riders.length < car.cap) {
      for (var f = here + dir; f !== goal; f += dir) {
        if (this.eligible(f) && !(this.you.state === 'doors' && Math.round(this.you.y) === f)) return f;
      }
    }
    return goal;
  };

  // Excel: delivers the nearest rider, collecting people on the way; otherwise heads for the biggest crowd.
  P.crowd = function () {
    var car = this.bot;
    if (car.riders.length) return this.onTheWay(nearest(car.riders.map(function (p) { return p.dest; }), car.y));
    var best = null, bv = 0;
    for (var f = 0; f < this.floors; f++) {
      if (this.you.state === 'doors' && Math.round(this.you.y) === f) continue;
      var v = this.eligible(f) / (1 + 0.25 * Math.abs(f - car.y));
      if (v > bv) { bv = v; best = f; }
    }
    return best;
  };

  // Edith: races you to your next stop when she can get there first, waits where the next rush begins,
  // and otherwise plays like Excel.
  P.snipe = function () {
    var car = this.bot, s = this.you.stops[0];
    if (s != null && car.riders.length < car.cap / 2 && this.eligible(s) > 0) {
      var mine = Math.abs(car.y - s) / car.speed;
      if (mine + 0.3 < this.etaYou(s)) return s;
    }
    if (!car.riders.length) {
      var nr = this.nextRush();
      if (nr.in > 0 && nr.in < 7) return nr.kind === 'morning' ? 0 : nr.kind === 'lunch' ? Math.floor((this.floors - 1) / 2) : this.floors - 1;
    }
    var t = this.crowd();
    return t == null ? this.bot.target : t;
  };

  var GU = {
    DT: DT, START_FLOORS: START_FLOORS, MAX_FLOORS: MAX_FLOORS, CAR: CAR, STRIKES: STRIKES, QUICK: QUICK,
    CYCLE: CYCLE, LEVELS: LEVELS, STARS: STARS, Building: Building, Rng: Rng
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = GU;
  else global.GU = GU;
})(typeof window !== 'undefined' ? window : this);
