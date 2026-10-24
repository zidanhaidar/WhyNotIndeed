/*
 * Herd Instinct engine: a flock of sheep (simple flocking rules), a lead sheep with a mind of her own,
 * a sheepdog you steer, a pen with one gate, and for Edith a wolf.
 * Fixed time step, seeded randomness, no DOM. window.HI in the browser, module.exports in Node.
 */
(function (global) {
  'use strict';

  var FW = 960, FH = 600, DT = 1 / 30;
  var PEN = { x: 790, y: 190, w: 140, h: 220, gateY: 255, gateH: 90 };

  /*
   * leader: how the lead sheep behaves. wander (aimless), tight (keeps the flock bunched),
   * dodge (steers the flock away from the gate), sly (dodges and stirs the others up).
   * panic: dog speed that makes sheep bolt in all directions (0 = never). wolf: a wolf shows up.
   */
  var LEVELS = {
    pip: { sheep: 8, need: 6, time: 120, calm: 22, flee: 70, fear: 105, cohesion: 0.9, leader: 'wander', panic: 0, wolf: false,
      trees: [[300, 140, 26], [520, 470, 30], [600, 120, 24]], pond: null },
    gridlock: { sheep: 12, need: 10, time: 100, calm: 24, flee: 78, fear: 110, cohesion: 1.6, leader: 'tight', panic: 0, wolf: false,
      trees: [[300, 130, 26], [430, 470, 28], [610, 150, 26], [640, 440, 24]], pond: [480, 300, 58] },
    monolith: { sheep: 15, need: 11, time: 150, calm: 25, flee: 84, fear: 115, cohesion: 1.2, leader: 'dodge', panic: 0, wolf: false,
      trees: [[260, 120, 26], [420, 480, 28], [560, 130, 26], [660, 470, 26], [700, 300, 22]], pond: [470, 300, 62] },
    edith: { sheep: 16, need: 10, time: 170, calm: 26, flee: 92, fear: 120, cohesion: 1.0, leader: 'sly', panic: 175, wolf: true,
      trees: [[260, 120, 26], [420, 480, 28], [560, 120, 26], [660, 480, 26], [690, 300, 22]], pond: [470, 300, 62] }
  };

  var DOG = { run: 210, walk: 85, accel: 900, barkR: 170, barkCool: 3.2 };

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
  function len(x, y) { return Math.sqrt(x * x + y * y); }

  // Pen walls as line segments; the gate is the gap in the left wall.
  var WALLS = [
    [PEN.x, PEN.y, PEN.x + PEN.w, PEN.y],
    [PEN.x + PEN.w, PEN.y, PEN.x + PEN.w, PEN.y + PEN.h],
    [PEN.x, PEN.y + PEN.h, PEN.x + PEN.w, PEN.y + PEN.h],
    [PEN.x, PEN.y, PEN.x, PEN.gateY],
    [PEN.x, PEN.gateY + PEN.gateH, PEN.x, PEN.y + PEN.h]
  ];
  var GATE = { x: PEN.x, y: PEN.gateY + PEN.gateH / 2 };

  function inPen(x, y) { return x > PEN.x + 6 && x < PEN.x + PEN.w - 6 && y > PEN.y + 6 && y < PEN.y + PEN.h - 6; }

  function crosses(ax, ay, bx, by, w) {
    var cx = w[0], cy = w[1], dx = w[2], dy = w[3];
    function o(px, py, qx, qy, rx, ry) { return (qx - px) * (ry - py) - (qy - py) * (rx - px); }
    var d1 = o(cx, cy, dx, dy, ax, ay), d2 = o(cx, cy, dx, dy, bx, by), d3 = o(ax, ay, bx, by, cx, cy), d4 = o(ax, ay, bx, by, dx, dy);
    return ((d1 > 0) !== (d2 > 0)) && ((d3 > 0) !== (d4 > 0));
  }
  function wallPush(x, y, range) {
    var fx = 0, fy = 0;
    WALLS.forEach(function (w) {
      var vx = w[2] - w[0], vy = w[3] - w[1], L2 = vx * vx + vy * vy;
      var t = Math.max(0, Math.min(1, ((x - w[0]) * vx + (y - w[1]) * vy) / L2));
      var px = w[0] + t * vx, py = w[1] + t * vy, dx = x - px, dy = y - py, d = len(dx, dy);
      if (d < range && d > 0.01) { var k = (range - d) / range; fx += dx / d * k; fy += dy / d * k; }
    });
    return [fx, fy];
  }

  function World(levelId, seed) {
    var c = LEVELS[levelId];
    this.level = levelId;
    this.cfg = c;
    this.rand = rng(seed || 1);
    this.t = 0;
    this.over = false;
    this.result = null;
    this.events = [];
    this.bark = 0;
    this.barkAt = -10;
    var r = this.rand;
    this.sheep = [];
    for (var i = 0; i < c.sheep; i++) {
      var a = r() * Math.PI * 2, d = 20 + r() * 55;
      this.sheep.push({ id: i, x: 210 + Math.cos(a) * d, y: 300 + Math.sin(a) * d * 1.2, vx: 0, vy: 0, penned: false, lost: false, leader: i === 0, scare: 0, wander: r() * Math.PI * 2 });
    }
    this.dog = { x: 70, y: 540, vx: 0, vy: 0, speed: 0 };
    this.wolf = c.wolf ? { x: -60, y: 80, vx: 0, vy: 0, active: false, next: 28, prey: null, fled: 0 } : null;
    this.obstacles = c.trees.map(function (t) { return { x: t[0], y: t[1], r: t[2], kind: 'tree' }; });
    if (c.pond) this.obstacles.push({ x: c.pond[0], y: c.pond[1], r: c.pond[2], kind: 'pond' });
  }

  var P = World.prototype;

  P.counts = function () {
    var p = 0, l = 0;
    this.sheep.forEach(function (s) { if (s.penned) p++; if (s.lost) l++; });
    return { penned: p, lost: l, free: this.sheep.length - p - l };
  };

  /* input: { tx, ty } point the dog runs toward (or null to stop), walk: true to sneak slowly, max: optional speed cap, bark: true to bark */
  P.step = function (input) {
    if (this.over) return;
    input = input || {};
    var c = this.cfg, dog = this.dog, r = this.rand;
    this.t += DT;

    // dog
    var max = input.walk ? DOG.walk : DOG.run, ax = 0, ay = 0;
    if (input.max) max = Math.min(max, input.max);
    if (input.tx != null) {
      var dx = input.tx - dog.x, dy = input.ty - dog.y, d = len(dx, dy);
      var want = Math.min(max, d * 4);
      var wvx = d > 1 ? dx / d * want : 0, wvy = d > 1 ? dy / d * want : 0;
      ax = wvx - dog.vx; ay = wvy - dog.vy;
    } else { ax = -dog.vx; ay = -dog.vy; }
    var am = len(ax, ay), lim = DOG.accel * DT;
    if (am > lim) { ax = ax / am * lim; ay = ay / am * lim; }
    dog.vx += ax; dog.vy += ay;
    dog.x = Math.max(8, Math.min(FW - 8, dog.x + dog.vx * DT));
    dog.y = Math.max(8, Math.min(FH - 8, dog.y + dog.vy * DT));
    dog.speed = len(dog.vx, dog.vy);

    var barking = false;
    if (input.bark && this.t - this.barkAt >= DOG.barkCool) {
      this.barkAt = this.t;
      barking = true;
      this.events.push({ type: 'bark' });
    }
    this.bark = Math.max(0, DOG.barkCool - (this.t - this.barkAt));

    this.stepWolf();

    // sheep
    var flock = this.sheep, leader = flock[0];
    var free = flock.filter(function (s) { return !s.penned && !s.lost; });
    var self = this;
    flock.forEach(function (s) {
      if (s.lost) return;
      var fx = 0, fy = 0;
      if (s.penned) {
        // calm inside the pen
        s.wander += (r() - 0.5) * 0.5;
        fx += Math.cos(s.wander) * 0.3; fy += Math.sin(s.wander) * 0.3;
        self.move(s, fx, fy, c.calm * 0.6, true);
        return;
      }
      var sepX = 0, sepY = 0, cohX = 0, cohY = 0, aliX = 0, aliY = 0, n = 0;
      for (var j = 0; j < free.length; j++) {
        var o = free[j];
        if (o === s) continue;
        var ox = o.x - s.x, oy = o.y - s.y, od = len(ox, oy);
        if (od < 22 && od > 0.01) { sepX -= ox / od * (22 - od) / 22; sepY -= oy / od * (22 - od) / 22; }
        if (od < 90) { cohX += o.x; cohY += o.y; aliX += o.vx; aliY += o.vy; n++; }
      }
      var panic = s.scare > 0;
      fx += sepX * 2.2; fy += sepY * 2.2;
      if (n && !panic) {
        var cx = cohX / n - s.x, cy = cohY / n - s.y, cd = len(cx, cy) || 1;
        fx += cx / cd * Math.min(1, cd / 40) * c.cohesion * 0.6;
        fy += cy / cd * Math.min(1, cd / 40) * c.cohesion * 0.6;
        var al = len(aliX, aliY) || 1;
        fx += aliX / al * 0.25; fy += aliY / al * 0.25;
      }
      // follow the leader
      if (!s.leader && !leader.penned && !leader.lost && !panic) {
        var lx = leader.x - s.x, ly = leader.y - s.y, ld = len(lx, ly);
        if (ld > 30 && ld < 220) { fx += lx / ld * 0.35 * c.cohesion; fy += ly / ld * 0.35 * c.cohesion; }
      }
      // the dog
      var gx = s.x - dog.x, gy = s.y - dog.y, gd = len(gx, gy) || 1;
      var fear = c.fear + Math.min(60, dog.speed * 0.25);
      var speed = c.calm;
      if (gd < fear) {
        var k = (fear - gd) / fear;
        fx += gx / gd * k * 3.2; fy += gy / gd * k * 3.2;
        speed = c.calm + (c.flee - c.calm) * Math.min(1, k * 1.6);
        if (c.panic && dog.speed > c.panic && gd < fear * 0.8) s.scare = 1.6;
      }
      if (barking && gd < DOG.barkR) { s.scare = Math.max(s.scare, c.panic ? 1.4 : 0.6); }
      if (s.scare > 0) {
        s.scare -= DT;
        speed = Math.max(speed, c.flee);
        fx += gx / gd * 1.4; fy += gy / gd * 1.4;
        if (c.panic) { fx += Math.cos(s.wander) * 1.5; fy += Math.sin(s.wander) * 1.5; }
      }
      // the wolf
      if (self.wolf && self.wolf.active) {
        var wx = s.x - self.wolf.x, wy = s.y - self.wolf.y, wd = len(wx, wy) || 1;
        if (wd < 150) { var wk = (150 - wd) / 150; fx += wx / wd * wk * 3.5; fy += wy / wd * wk * 3.5; speed = Math.max(speed, c.flee); }
      }
      // the leader's own plans
      if (s.leader && !panic) {
        var tx = GATE.x - s.x, ty = GATE.y - s.y, td = len(tx, ty) || 1;
        if (c.leader === 'dodge' || c.leader === 'sly') {
          if (td < 330) { fx -= tx / td * 0.9 * (330 - td) / 330 * 2; fy -= ty / td * 0.9 * (330 - td) / 330 * 2; }
        }
        if (c.leader === 'sly' && gd < fear * 1.3 && r() < 0.007) {
          self.events.push({ type: 'stir', x: s.x, y: s.y });
          free.forEach(function (o) { if (len(o.x - s.x, o.y - s.y) < 70) o.scare = Math.max(o.scare, 0.9); });
        }
      }
      // wander
      s.wander += (r() - 0.5) * 0.6;
      fx += Math.cos(s.wander) * (s.leader ? 0.45 : 0.25); fy += Math.sin(s.wander) * (s.leader ? 0.45 : 0.25);
      // trees, pond, edges, pen walls
      self.obstacles.forEach(function (ob) {
        var bx = s.x - ob.x, by = s.y - ob.y, bd = len(bx, by), R = ob.r + 18;
        if (bd < R && bd > 0.01) { fx += bx / bd * (R - bd) / R * 4; fy += by / bd * (R - bd) / R * 4; }
      });
      var m = 40;
      if (s.x < m) fx += (m - s.x) / m * 2; if (s.x > FW - m) fx -= (s.x - FW + m) / m * 2;
      if (s.y < m) fy += (m - s.y) / m * 2; if (s.y > FH - m) fy -= (s.y - FH + m) / m * 2;
      var wp = wallPush(s.x, s.y, 16);
      fx += wp[0] * 2.5; fy += wp[1] * 2.5;
      self.move(s, fx, fy, speed, false);
    });

    // penning
    flock.forEach(function (s) {
      if (!s.penned && !s.lost && inPen(s.x, s.y)) {
        s.penned = true;
        self.events.push({ type: 'penned', id: s.id, leader: s.leader });
      }
    });

    var cnt = this.counts();
    if (cnt.penned >= c.need) this.finish('win');
    else if (cnt.penned + cnt.free < c.need) this.finish('lose', 'wolf');
    else if (this.t >= c.time) this.finish('lose', 'time');
  };

  P.move = function (s, fx, fy, speed, penned) {
    var fl = len(fx, fy);
    var tvx = fl > 0.05 ? fx / fl * speed * Math.min(1, fl) : 0, tvy = fl > 0.05 ? fy / fl * speed * Math.min(1, fl) : 0;
    s.vx += (tvx - s.vx) * 0.12;
    s.vy += (tvy - s.vy) * 0.12;
    var nx = s.x + s.vx * DT, ny = s.y + s.vy * DT;
    if (penned) {
      nx = Math.max(PEN.x + 14, Math.min(PEN.x + PEN.w - 14, nx));
      ny = Math.max(PEN.y + 14, Math.min(PEN.y + PEN.h - 14, ny));
    } else {
      for (var i = 0; i < WALLS.length; i++) if (crosses(s.x, s.y, nx, ny, WALLS[i])) { nx = s.x; ny = s.y; s.vx *= -0.3; s.vy *= -0.3; break; }
      // trees and the pond are solid
      for (var k = 0; k < this.obstacles.length; k++) {
        var ob = this.obstacles[k], dx = nx - ob.x, dy = ny - ob.y, d = len(dx, dy), R = ob.r + 6;
        if (d < R && d > 0.01) { nx = ob.x + dx / d * R; ny = ob.y + dy / d * R; }
      }
    }
    s.x = Math.max(6, Math.min(FW - 6, nx));
    s.y = Math.max(6, Math.min(FH - 6, ny));
  };

  P.stepWolf = function () {
    var w = this.wolf;
    if (!w) return;
    var dog = this.dog, r = this.rand;
    if (!w.active) {
      if (this.t >= w.next) {
        w.active = true;
        var side = r() < 0.5;
        w.x = side ? 30 : 400 + r() * 300;
        w.y = side ? 30 + r() * 540 : (r() < 0.5 ? 10 : FH - 10);
        w.prey = null;
        w.fled = 0;
        this.events.push({ type: 'wolf', x: w.x, y: w.y });
      }
      return;
    }
    var free = this.sheep.filter(function (s) { return !s.penned && !s.lost; });
    var dd = len(w.x - dog.x, w.y - dog.y), vx, vy, sp;
    if (dd < 150 || w.fled > 0) {
      // runs from the dog, and gives up for a while once chased far enough
      w.fled += DT;
      var ex = w.x - dog.x, ey = w.y - dog.y, el = len(ex, ey) || 1;
      vx = ex / el; vy = ey / el; sp = 150;
      if (w.fled > 2.5 && dd > 200) {
        w.active = false;
        w.next = this.t + 22 + r() * 8;
        this.events.push({ type: 'wolfgone' });
        return;
      }
    } else {
      var best = null, bd = Infinity;
      free.forEach(function (s) { var d = len(s.x - w.x, s.y - w.y); if (d < bd) { bd = d; best = s; } });
      if (!best) return;
      vx = (best.x - w.x) / (bd || 1); vy = (best.y - w.y) / (bd || 1); sp = 70;
      if (bd < 12) {
        best.lost = true;
        this.events.push({ type: 'caught', x: best.x, y: best.y, leader: best.leader });
        w.active = false;
        w.next = this.t + 24 + r() * 8;
        return;
      }
    }
    w.vx += (vx * sp - w.vx) * 0.15;
    w.vy += (vy * sp - w.vy) * 0.15;
    w.x = Math.max(-40, Math.min(FW + 40, w.x + w.vx * DT));
    w.y = Math.max(-40, Math.min(FH + 40, w.y + w.vy * DT));
  };

  P.finish = function (res, why) {
    this.over = true;
    this.result = res;
    this.why = why || null;
    this.events.push({ type: 'end', result: res, why: why });
  };

  var HI = { FW: FW, FH: FH, DT: DT, PEN: PEN, GATE: GATE, WALLS: WALLS, DOG: DOG, LEVELS: LEVELS, World: World, rng: rng, inPen: inPen };
  if (typeof module !== 'undefined' && module.exports) module.exports = HI;
  else global.HI = HI;
})(typeof window !== 'undefined' ? window : this);
