/*
 * Don't Click That engine: a robot's mouse pointer glides across an office computer desktop towards the big
 * red "Delete everything" button. You drag open windows into its way; it has to go around them, and when it is
 * walled in it closes a window instead (smarter robots also close one whenever that is quicker). Pop-ups keep
 * appearing, windows close by themselves after a while, the button jumps now and then, and the pointer keeps
 * getting faster. It sometimes drags a file to the trash; every backup pays for the files you still have.
 * The run ends when the pointer clicks the button. Pure logic, CommonJS (the dev scripts use it too).
 */
(function (global) {
  'use strict';

  var DT = 1 / 30;
  var W = 960, H = 560, CELL = 20, GW = W / CELL, GH = H / CELL;
  var BUTTON = { w: 132, h: 48 };
  var TRASH = { x: 900, y: 500 };
  var BACKUP = 30;           // seconds between backups
  var MAX_WINDOWS = 8;
  var SIZES = [[240, 150], [280, 170], [200, 130], [320, 120], [150, 230], [260, 200], [180, 180]];
  var TITLES = ['Update available', 'Printer says hi', '37 unread emails', 'Quick survey', 'Low battery', 'Meeting in 5 min', 'Reply all?',
    'Cookies?', 'Your password expires', 'Spreadsheet.xlsx', 'Lunch order', 'Calendar', 'Do not close!', 'Team photos', 'Weather', 'Notes'];

  /*
   * speed: pixels per second at the start (it grows by `ramp` of itself per minute, up to `cap` times).
   * aim: seconds it hovers on the button before clicking (cover the button in time and it has to start over).
   * close: seconds it needs to close a window. shortcut: also closes a window when going round is this many
   * times longer than the straight line (0 = only when walled in). rethink: seconds between route checks.
   * files: chance per decision of going after a file instead of the button. life: seconds a window stays open.
   * popEvery: seconds between pop-ups (a window's life shrinks over the run, so fewer stay open at once).
 * feint: Edith heads the wrong way for a moment now and then. jump: seconds between button jumps.
   */
  var LEVELS = {
    pip: { speed: 95, ramp: 0.35, cap: 2.0, aim: 0.7, close: 1.2, shortcut: 0, rethink: 0.6, files: 0.3, life: 18, popEvery: 6, feint: 0, jump: 40 },
    gridlock: { speed: 108, ramp: 0.4, cap: 2.1, aim: 0.6, close: 0.9, shortcut: 0, rethink: 0.9, files: 0.1, life: 16, popEvery: 5.5, feint: 0, jump: 35 },
    monolith: { speed: 138, ramp: 0.42, cap: 2.2, aim: 0.42, close: 0.6, shortcut: 2.2, rethink: 0.25, files: 0.06, life: 15, popEvery: 5, feint: 0, jump: 30 },
    edith: { speed: 172, ramp: 0.45, cap: 2.3, aim: 0.35, close: 0.45, shortcut: 1.8, rethink: 0.15, files: 0.05, life: 14, popEvery: 5, feint: 0.25, jump: 28 }
  };
  var STARS = [60, 120, 200]; // seconds survived for one, two and three stars

  function Rng(seed) { this.a = seed >>> 0; }
  Rng.prototype.next = function () {
    this.a = (this.a + 0x6D2B79F5) >>> 0;
    var t = this.a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  Rng.prototype.int = function (a, b) { return a + Math.floor(this.next() * (b - a + 1)); };

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function inside(px, py, r, pad) { pad = pad || 0; return px >= r.x - pad && py >= r.y - pad && px <= r.x + r.w + pad && py <= r.y + r.h + pad; }
  function overlap(a, b) { return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h; }

  function Desktop(levelId, seed) {
    var c = LEVELS[levelId];
    this.level = levelId;
    this.cfg = c;
    this.rng = new Rng(seed || 1);
    this.t = 0;
    this.windows = [];
    this.nextId = 1;
    this.files = [];
    this.backups = 0;
    this.backupPoints = 0;
    this.popT = 3;
    this.jumpT = c.jump;
    this.over = false;
    this.events = [];
    this.pointer = { x: 60, y: 60, goal: 'button', target: null, path: [], think: 0, hover: 0, closing: null, holding: null, feintT: 0, feint: null };
    this.button = { x: 0, y: 0, w: BUTTON.w, h: BUTTON.h };
    this.placeButton(true);
    var names = ['Budget', 'Holiday pics', 'Report', 'Memes', 'Contacts', 'Plans'];
    for (var i = 0; i < names.length; i++) this.addFile(names[i]);
    for (var k = 0; k < 3; k++) this.popup(true);
    this.blocked = this.grid();
  }
  var P = Desktop.prototype;

  P.speed = function () { var c = this.cfg; return c.speed * Math.min(c.cap, 1 + c.ramp * this.t / 60); };
  P.points = function () { return Math.min(50000, Math.floor(10 * this.t) + this.backupPoints); };
  P.stars = function () { return this.t >= STARS[2] ? 3 : this.t >= STARS[1] ? 2 : this.t >= STARS[0] ? 1 : 0; };
  P.filesLeft = function () { return this.files.filter(function (f) { return f.alive; }).length; };
  P.nextBackup = function () { return BACKUP - (this.t % BACKUP); };

  // ---------- the desktop ----------

  // A free spot for something w x h, at least `far` px from the pointer, avoiding `avoid` rectangles if it can.
  P.freeSpot = function (w, h, far, avoid) {
    var r = this.rng, best = null, bestBad = Infinity;
    for (var i = 0; i < 60; i++) {
      var x = r.int(20, W - w - 20), y = r.int(20, H - h - 20), rect = { x: x, y: y, w: w, h: h };
      var d = Math.hypot(x + w / 2 - this.pointer.x, y + h / 2 - this.pointer.y);
      var bad = (d < far ? 1000 : 0) + avoid.filter(function (a) { return overlap(rect, a); }).length;
      if (bad < bestBad) { bestBad = bad; best = rect; }
      if (!bad) break;
    }
    return best;
  };

  P.placeButton = function (first) {
    var spot = this.freeSpot(BUTTON.w, BUTTON.h, first ? 420 : 320, this.windows.concat([{ x: TRASH.x - 40, y: TRASH.y - 40, w: 80, h: 80 }]));
    this.button.x = spot.x;
    this.button.y = spot.y;
    this.pointer.hover = 0;
    if (!first) this.events.push({ type: 'jump' });
  };

  P.addFile = function (name) {
    var spot = this.freeSpot(56, 56, 0, this.files.map(function (f) { return { x: f.x - 34, y: f.y - 34, w: 68, h: 68 }; }).concat([this.button]));
    this.files.push({ id: this.nextId++, name: name, x: spot.x + 28, y: spot.y + 28, alive: true });
  };

  P.popup = function (quiet) {
    if (this.windows.length >= MAX_WINDOWS) return;
    var r = this.rng, s = SIZES[r.int(0, SIZES.length - 1)];
    var spot = this.freeSpot(s[0], s[1], 140, [this.button]);
    // windows stay open for less and less time, so holding the pointer off gets harder the longer you last
    var life = Math.max(4, this.cfg.life - this.t / 12) * (0.8 + 0.4 * r.next());
    var win = { id: this.nextId++, x: spot.x, y: spot.y, w: s[0], h: s[1], title: TITLES[r.int(0, TITLES.length - 1)], life: life, maxLife: life, look: r.int(0, 5) };
    this.windows.push(win);
    this.dirty = true;
    if (!quiet) this.events.push({ type: 'popup', id: win.id });
  };

  P.windowAt = function (x, y) {
    for (var i = this.windows.length - 1; i >= 0; i--) if (inside(x, y, this.windows[i])) return this.windows[i];
    return null;
  };

  // Moves a window (you dragging it). It comes to the front and stays on the desktop.
  P.moveWindow = function (id, x, y) {
    if (this.over) return false;
    var w = this.windows.filter(function (v) { return v.id === id; })[0];
    if (!w) return false;
    w.x = clamp(Math.round(x), 0, W - w.w);
    w.y = clamp(Math.round(y), 0, H - w.h);
    this.windows.splice(this.windows.indexOf(w), 1);
    this.windows.push(w);
    this.dirty = true;
    return true;
  };

  P.closeWindow = function (w, byRobot) {
    var i = this.windows.indexOf(w);
    if (i < 0) return;
    this.windows.splice(i, 1);
    this.dirty = true;
    this.events.push({ type: 'close', id: w.id, by: byRobot ? 'bot' : 'time' });
  };

  // ---------- routes around the windows ----------

  // Grid of blocked cells (1) for the pointer, from the windows, optionally leaving one window out.
  P.grid = function (skip) {
    var g = new Uint8Array(GW * GH), pad = 6;
    for (var i = 0; i < this.windows.length; i++) {
      var w = this.windows[i];
      if (w === skip) continue;
      var x0 = Math.max(0, Math.floor((w.x - pad) / CELL)), x1 = Math.min(GW - 1, Math.floor((w.x + w.w + pad) / CELL));
      var y0 = Math.max(0, Math.floor((w.y - pad) / CELL)), y1 = Math.min(GH - 1, Math.floor((w.y + w.h + pad) / CELL));
      for (var y = y0; y <= y1; y++) for (var x = x0; x <= x1; x++) g[y * GW + x] = 1;
    }
    return g;
  };
  function cellOf(x, y) { return clamp(Math.floor(y / CELL), 0, GH - 1) * GW + clamp(Math.floor(x / CELL), 0, GW - 1); }

  // Breadth-first walk over the cells the pointer can reach from (sx, sy). It never squeezes diagonally between
  // two windows, and if it starts inside a window (one was dropped on it) it may slide out. visit(cell) returns
  // true to stop. Gives back the walk's links, to turn a cell into a route.
  P.walk = function (g, sx, sy, visit) {
    var start = cellOf(sx, sy), prev = new Int32Array(GW * GH).fill(-2), q = [start];
    prev[start] = -1;
    for (var h = 0; h < q.length; h++) {
      var u = q[h];
      if (visit(u)) return { prev: prev, start: start, end: u };
      var ux = u % GW, uy = (u / GW) | 0;
      for (var dy = -1; dy <= 1; dy++) {
        for (var dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          var vx = ux + dx, vy = uy + dy;
          if (vx < 0 || vy < 0 || vx >= GW || vy >= GH) continue;
          var v = vy * GW + vx;
          if (prev[v] !== -2) continue;
          if (dx && dy && (g[uy * GW + vx] && g[vy * GW + ux])) continue;
          if (g[v] && !g[u]) continue;
          prev[v] = u;
          q.push(v);
        }
      }
    }
    return { prev: prev, start: start, end: -1 };
  };
  function trace(w, end) {
    var path = [];
    for (var c = end; c !== -1 && c !== w.start; c = w.prev[c]) path.unshift([(c % GW) * CELL + CELL / 2, ((c / GW) | 0) * CELL + CELL / 2]);
    return path;
  }

  // Shortest route (cell centres) from (sx, sy) to the first free cell that passes isGoal, or null.
  P.route = function (g, sx, sy, isGoal) {
    var w = this.walk(g, sx, sy, function (c) { return !g[c] && isGoal(c); });
    return w.end < 0 ? null : trace(w, w.end);
  };

  // The way to the reachable spot closest to (tx, ty), then a last reach onto (tx, ty) itself. A window's close
  // button can sit next to another window or in a corner of the screen, so the pointer reaches over to click it.
  P.reachToward = function (g, sx, sy, tx, ty) {
    var best = -1, bd = Infinity;
    var w = this.walk(g, sx, sy, function (c) {
      if (g[c]) return false;
      var d = Math.hypot((c % GW) * CELL + CELL / 2 - tx, ((c / GW) | 0) * CELL + CELL / 2 - ty);
      if (d < bd) { bd = d; best = c; }
      return false;
    });
    var path = best < 0 ? [] : trace(w, best);
    path.push([tx, ty]);
    return { path: path, gap: best < 0 ? Infinity : bd };
  };

  // Is (x, y) under a window (other than `skip`)? Covered files cannot be grabbed and a covered trash takes nothing.
  P.covered = function (x, y, skip) {
    for (var i = 0; i < this.windows.length; i++) if (this.windows[i] !== skip && inside(x, y, this.windows[i], 4)) return true;
    return false;
  };
  function length(path, x, y) {
    var d = 0, px = x, py = y;
    for (var i = 0; i < path.length; i++) { d += Math.hypot(path[i][0] - px, path[i][1] - py); px = path[i][0]; py = path[i][1]; }
    return d;
  }

  P.buttonGoal = function (g) {
    var b = this.button;
    var x0 = Math.floor((b.x + 8) / CELL), x1 = Math.floor((b.x + b.w - 8) / CELL), y0 = Math.floor((b.y + 8) / CELL), y1 = Math.floor((b.y + b.h - 8) / CELL);
    return function (c) { var x = c % GW, y = (c / GW) | 0; return x >= x0 && x <= x1 && y >= y0 && y <= y1 && !g[c]; };
  };
  function near(px, py, r) { return function (c) { return Math.hypot((c % GW) * CELL + CELL / 2 - px, ((c / GW) | 0) * CELL + CELL / 2 - py) <= r; }; }
  function closeSpot(w) { return [w.x + w.w - 14, w.y + 12]; }
  // a route plus the last little hop onto the exact spot it is aiming for
  function finish(path, x, y) { if (path) path.push([x, y]); return path; }

  // Decides what the pointer goes for next: the button, a window to close, or a file.
  // The window worth closing to reach a goal: goalRoute(grid without that window, window) gives the way on from
  // its close button, or null. Every window can be reached one way or another, so there is always an answer.
  P.bestClose = function (g, goalRoute) {
    var p = this.pointer, c = this.cfg, self = this, best = null;
    this.windows.forEach(function (w) {
      var cs = closeSpot(w), reach = self.reachToward(g, p.x, p.y, cs[0], cs[1]);
      if (reach.gap === Infinity) return;
      var after = goalRoute(self.grid(w), w, cs);
      var cost = length(reach.path, p.x, p.y) + reach.gap + c.close * self.speed() + (after ? length(after, cs[0], cs[1]) : 4000);
      if (!best || cost < best.cost) best = { w: w, path: reach.path, cost: cost };
    });
    return best;
  };

  // Decides what the pointer goes for next: the button, a window to close, a file, or the trash.
  P.decide = function () {
    var p = this.pointer, c = this.cfg, g = this.blocked, self = this;
    if (p.holding) {
      var toTrash = this.covered(TRASH.x, TRASH.y) ? null : finish(this.route(g, p.x, p.y, near(TRASH.x, TRASH.y, 30)), TRASH.x, TRASH.y);
      if (toTrash) { p.goal = 'trash'; p.path = toTrash; return; }
      // the trash is covered or walled off: close the window in the way first
      var fix = this.bestClose(g, function (g2, w, cs) {
        return self.covered(TRASH.x, TRASH.y, w) ? null : self.route(g2, cs[0], cs[1], near(TRASH.x, TRASH.y, 30));
      });
      if (fix) { p.goal = 'close'; p.target = fix.w; p.path = fix.path; return; }
      this.dropBack();
    }
    if (p.goal === 'file' && p.target && p.target.alive && !this.covered(p.target.x, p.target.y)) {
      var fp = finish(this.route(g, p.x, p.y, near(p.target.x, p.target.y, 18)), p.target.x, p.target.y);
      if (fp) { p.path = fp; return; }
    }
    var toButton = finish(this.route(g, p.x, p.y, this.buttonGoal(g)), this.button.x + this.button.w / 2, this.button.y + this.button.h / 2);
    var direct = Math.hypot(this.button.x + this.button.w / 2 - p.x, this.button.y + this.button.h / 2 - p.y);
    // now and then it gets distracted by a file it can get at (Pip often, the others when the button is hard to reach)
    var open = this.files.filter(function (f) { return f.alive && !self.covered(f.x, f.y); });
    var wantsFile = open.length && (this.rng.next() < c.files * (toButton ? 0.5 : 1.6));
    if (wantsFile) {
      var f = open[this.rng.int(0, open.length - 1)], route = finish(this.route(g, p.x, p.y, near(f.x, f.y, 18)), f.x, f.y);
      if (route) { p.goal = 'file'; p.target = f; p.path = route; this.events.push({ type: 'file-target', id: f.id }); return; }
    }
    var best = null;
    if (!toButton || (c.shortcut && length(toButton, p.x, p.y) > c.shortcut * direct + 80)) {
      // closing a window: the one that opens the shortest way to the button
      best = this.bestClose(g, function (g2, w, cs) { return self.route(g2, cs[0], cs[1], self.buttonGoal(g2)); });
    }
    if (best && (!toButton || best.cost < length(toButton, p.x, p.y))) {
      p.goal = 'close';
      p.target = best.w;
      p.path = best.path;
      return;
    }
    p.goal = 'button';
    p.target = null;
    p.path = toButton || [];
    // Edith fakes: for a moment she heads off to one side before going for the button
    if (c.feint && toButton && direct > 220 && this.rng.next() < c.feint) {
      var ang = Math.atan2(this.button.y - p.y, this.button.x - p.x) + (this.rng.next() < 0.5 ? 1.6 : -1.6);
      var fx = clamp(p.x + Math.cos(ang) * 160, 20, W - 20), fy = clamp(p.y + Math.sin(ang) * 160, 20, H - 20), fr = this.route(g, p.x, p.y, near(fx, fy, 30));
      if (fr) { p.path = fr.slice(0, 8); p.feintT = 0.7; this.events.push({ type: 'feint' }); }
    }
  };

  // It lets go of the file it was carrying: it lands on the desktop again, saved.
  P.dropBack = function () {
    var p = this.pointer, f = p.holding;
    if (!f) return;
    f.alive = true;
    f.x = clamp(p.x, 30, W - 30);
    f.y = clamp(p.y, 30, H - 50);
    p.holding = null;
    p.goal = 'button';
    p.think = 0;
    this.events.push({ type: 'dropback', id: f.id, name: f.name });
  };

  // ---------- one tick ----------

  P.step = function () {
    if (this.over) return;
    var c = this.cfg, p = this.pointer;
    this.t += DT;
    // windows close themselves when their time is up
    for (var i = this.windows.length - 1; i >= 0; i--) {
      var w = this.windows[i];
      w.life -= DT;
      if (w.life <= 0) this.closeWindow(w, false);
    }
    this.popT -= DT;
    if (this.popT <= 0) { this.popup(false); this.popT = c.popEvery * (0.8 + 0.4 * this.rng.next()); }
    this.jumpT -= DT;
    if (this.jumpT <= 0) { this.placeButton(false); this.jumpT = c.jump; this.dirty = true; }
    if (Math.floor(this.t / BACKUP) > this.backups) {
      this.backups++;
      var n = this.filesLeft();
      this.backupPoints += 100 * n;
      this.events.push({ type: 'backup', files: n, points: 100 * n });
    }
    if (this.dirty) { this.blocked = this.grid(); this.dirty = false; p.think = 0; }
    this.movePointer();
  };

  P.movePointer = function () {
    var p = this.pointer, c = this.cfg, b = this.button;
    // closing a window
    if (p.closing) {
      if (this.windows.indexOf(p.closing.w) < 0) { p.closing = null; p.think = 0; return; }
      p.closing.t -= DT;
      if (p.closing.t <= 0) { this.closeWindow(p.closing.w, true); p.closing = null; p.think = 0; }
      return;
    }
    // aiming at the button: cover it in time and it has to start over
    if (inside(p.x, p.y, b) && !this.blocked[cellOf(p.x, p.y)]) {
      p.hover += DT;
      if (p.hover >= c.aim) { this.over = true; this.events.push({ type: 'click' }, { type: 'end' }); }
      return;
    }
    p.hover = 0;
    p.think -= DT;
    p.feintT -= DT;
    if (p.think <= 0 && p.feintT <= 0) { this.decide(); p.think = c.rethink; }
    var step = this.speed() * DT;
    while (step > 0 && p.path.length) {
      var nx = p.path[0][0], ny = p.path[0][1], d = Math.hypot(nx - p.x, ny - p.y);
      if (d <= step) { p.x = nx; p.y = ny; step -= d; p.path.shift(); }
      else { p.x += (nx - p.x) / d * step; p.y += (ny - p.y) / d * step; step = 0; }
    }
    if (!p.path.length) this.arrive();
  };

  // The pointer reached the end of its route: grab a file, drop it in the trash, or start closing a window.
  P.arrive = function () {
    var p = this.pointer;
    if (p.goal === 'close' && p.target && this.windows.indexOf(p.target) >= 0) {
      var cs = closeSpot(p.target);
      if (Math.hypot(cs[0] - p.x, cs[1] - p.y) <= 40) { p.closing = { w: p.target, t: this.cfg.close }; this.events.push({ type: 'closing', id: p.target.id }); }
      p.think = 0;
    } else if (p.goal === 'file' && p.target && p.target.alive && !this.covered(p.target.x, p.target.y) && Math.hypot(p.target.x - p.x, p.target.y - p.y) <= 24) {
      p.holding = p.target;
      p.target.alive = false;
      p.think = 0;
      this.events.push({ type: 'grab', id: p.holding.id });
    } else if (p.goal === 'trash' && p.holding && !this.covered(TRASH.x, TRASH.y) && Math.hypot(TRASH.x - p.x, TRASH.y - p.y) <= 34) {
      this.events.push({ type: 'trashed', id: p.holding.id, name: p.holding.name });
      p.holding = null;
      p.goal = 'button';
      p.think = 0;
    } else p.think = Math.min(p.think, 0.05);
  };

  var DC = { DT: DT, W: W, H: H, CELL: CELL, BUTTON: BUTTON, TRASH: TRASH, BACKUP: BACKUP, LEVELS: LEVELS, STARS: STARS, Desktop: Desktop, Rng: Rng, inside: inside };
  if (typeof module !== 'undefined' && module.exports) module.exports = DC;
  else global.DC = DC;
})(typeof window !== 'undefined' ? window : this);
