/*
 * Excel Dungeon: roguelike rules. No DOM. Works in the browser (window.XDE) and in Node.
 * The map is a 26 x 24 sheet. Floors are sheet tabs; the last tab holds the boss.
 */
(function (global) {
  'use strict';

  var W = 26, H = 24;
  var VOID = 0, WALL = 1, FLOOR = 2;

  var MONSTERS = [
    { id: 'typo', name: 'Typo', hp: 4, atk: 1, xp: 2, from: 1 },
    { id: 'latefee', name: '#N/A', hp: 7, atk: 2, xp: 3, from: 1 },
    { id: 'invoice', name: '#VALUE!', hp: 10, atk: 3, xp: 5, from: 1 },
    { id: 'creep', name: 'Scope creep', hp: 9, atk: 3, xp: 6, fast: true, from: 2 },
    { id: 'audit', name: '#DIV/0!', hp: 18, atk: 4, xp: 8, slow: true, from: 2 },
    { id: 'cut', name: '#REF!', hp: 22, atk: 6, xp: 12, elite: true, from: 3 }
  ];

  var LEVELS = {
    pip: { tabs: ['Q1', 'Q2', 'Summary'], mult: 0.8, monsters: [4, 6], potions: 3, ups: 3, cash: 3,
      hero: { hp: 34, atk: 4, def: 0 }, boss: { hp: 30, atk: 5, def: 0 }, heal: 12 },
    gridlock: { tabs: ['Q1', 'Q2', 'Q3', 'Summary'], mult: 1.2, monsters: [7, 9], potions: 2, ups: 2, cash: 3,
      hero: { hp: 30, atk: 4, def: 0 }, boss: { hp: 55, atk: 8, def: 0 }, heal: 12 },
    monolith: { tabs: ['Q1', 'Q2', 'Q3', 'Q4', 'FY total'], mult: 1.35, monsters: [8, 10], potions: 2, ups: 2, cash: 3,
      hero: { hp: 30, atk: 4, def: 0 }, boss: { hp: 75, atk: 9, def: 1 }, heal: 11 },
    edith: { tabs: ['Q1', 'Q2', 'Q3', 'Q4', 'FY total'], mult: 1.45, monsters: [9, 11], potions: 2, ups: 2, cash: 3,
      hero: { hp: 28, atk: 4, def: 0 }, boss: { hp: 100, atk: 10, def: 2 }, heal: 10 }
  };

  var DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]];

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
  function ri(r, a, b) { return a + Math.floor(r() * (b - a + 1)); }
  function idx(x, y) { return y * W + x; }

  // ---------- map generation ----------

  function genMap(r) {
    for (var attempt = 0; attempt < 50; attempt++) {
      var grid = new Uint8Array(W * H);
      var rooms = [];
      for (var tries = 0; tries < 200 && rooms.length < 7; tries++) {
        var w = ri(r, 4, 8), h = ri(r, 3, 6);
        var x = ri(r, 1, W - w - 2), y = ri(r, 1, H - h - 2);
        var ok = rooms.every(function (q) { return x + w + 1 < q.x || q.x + q.w + 1 < x || y + h + 1 < q.y || q.y + q.h + 1 < y; });
        if (ok) rooms.push({ x: x, y: y, w: w, h: h });
      }
      if (rooms.length < 5) continue;
      // order rooms left to right, top to bottom so the path wanders across the sheet
      rooms.sort(function (a, b) { return (a.x + a.y * 0.6) - (b.x + b.y * 0.6); });
      rooms.forEach(function (q) {
        for (var yy = q.y; yy < q.y + q.h; yy++) for (var xx = q.x; xx < q.x + q.w; xx++) grid[idx(xx, yy)] = FLOOR;
      });
      for (var i = 1; i < rooms.length; i++) {
        var a = center(rooms[i - 1]), b = center(rooms[i]);
        if (r() < 0.5) { hLine(grid, a.x, b.x, a.y); vLine(grid, a.y, b.y, b.x); }
        else { vLine(grid, a.y, b.y, a.x); hLine(grid, a.x, b.x, b.y); }
      }
      // one extra loop so there is sometimes a second way round
      if (rooms.length > 4) {
        var c = center(rooms[0]), d = center(rooms[Math.floor(rooms.length / 2) + 1] || rooms[2]);
        hLine(grid, c.x, d.x, c.y); vLine(grid, c.y, d.y, d.x);
      }
      for (var yy2 = 0; yy2 < H; yy2++) for (var xx2 = 0; xx2 < W; xx2++) {
        if (grid[idx(xx2, yy2)] !== VOID) continue;
        for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) {
          var nx = xx2 + dx, ny = yy2 + dy;
          if (nx >= 0 && ny >= 0 && nx < W && ny < H && grid[idx(nx, ny)] === FLOOR) grid[idx(xx2, yy2)] = WALL;
        }
      }
      return { grid: grid, rooms: rooms };
    }
    throw new Error('map generation failed');
  }
  function center(q) { return { x: q.x + Math.floor(q.w / 2), y: q.y + Math.floor(q.h / 2) }; }
  function hLine(g, x1, x2, y) { for (var x = Math.min(x1, x2); x <= Math.max(x1, x2); x++) g[idx(x, y)] = FLOOR; }
  function vLine(g, y1, y2, x) { for (var y = Math.min(y1, y2); y <= Math.max(y1, y2); y++) g[idx(x, y)] = FLOOR; }

  // ---------- game ----------

  function Game(levelId, seed) {
    this.level = levelId;
    this.cfg = LEVELS[levelId];
    this.r = rng(seed);
    var h = this.cfg.hero;
    this.hero = { x: 0, y: 0, hp: h.hp, max: h.hp, atk: h.atk, def: h.def, lvl: 1, xp: 0, potions: 1, cash: 0 };
    this.floor = 0;
    this.turn = 0;
    this.over = false;
    this.result = null;
    this.log = [];
    this.fx = [];
    this.kills = 0;
    this.buildFloor();
  }

  Game.prototype.say = function (msg) { this.log.push(msg); };

  Game.prototype.buildFloor = function () {
    var r = this.r, cfg = this.cfg, f = this.floor + 1;
    var m = genMap(r);
    this.grid = m.grid;
    this.rooms = m.rooms;
    this.seen = new Uint8Array(W * H);
    this.items = {};
    this.monsters = [];
    var first = m.rooms[0], last = m.rooms[m.rooms.length - 1];
    var c = center(first);
    this.hero.x = c.x; this.hero.y = c.y;
    var taken = {};
    taken[idx(c.x, c.y)] = 1;
    var self = this;
    function freeCell(roomFrom) {
      for (var t = 0; t < 200; t++) {
        var q = m.rooms[ri(r, roomFrom, m.rooms.length - 1)];
        var x = ri(r, q.x, q.x + q.w - 1), y = ri(r, q.y, q.y + q.h - 1);
        if (!taken[idx(x, y)]) { taken[idx(x, y)] = 1; return { x: x, y: y }; }
      }
      return null;
    }
    var isBossFloor = this.floor === cfg.tabs.length - 1;
    if (isBossFloor) {
      var bc = center(last);
      taken[idx(bc.x, bc.y)] = 1;
      var b = cfg.boss;
      this.monsters.push({ id: 'boss', name: this.bossName(), x: bc.x, y: bc.y, hp: b.hp, max: b.hp, atk: b.atk, def: b.def, xp: 0, boss: true, awake: false, cool: 0 });
    } else {
      var sc = center(last);
      taken[idx(sc.x, sc.y)] = 1;
      this.items[idx(sc.x, sc.y)] = { kind: 'stairs' };
    }
    var count = ri(r, cfg.monsters[0], cfg.monsters[1]) + (isBossFloor ? -1 : 0);
    var pool = MONSTERS.filter(function (mm) { return mm.from <= f; });
    for (var i = 0; i < count; i++) {
      var p = freeCell(1);
      if (!p) break;
      var base = pool[Math.floor(r() * pool.length)];
      var hp = Math.round(base.hp * cfg.mult * (1 + 0.22 * (f - 1)));
      var atk = Math.round(base.atk * cfg.mult + 0.5 * (f - 1));
      this.monsters.push({ id: base.id, name: base.name, x: p.x, y: p.y, hp: hp, max: hp, atk: atk, def: 0, xp: base.xp + f, fast: !!base.fast, slow: !!base.slow, elite: !!base.elite, awake: false, cool: 0 });
    }
    function place(kind, n, extra) {
      for (var k = 0; k < n; k++) {
        var q = freeCell(0);
        if (q) { var it = { kind: kind }; for (var e in extra) it[e] = extra[e]; self.items[idx(q.x, q.y)] = it; }
      }
    }
    place('potion', cfg.potions, {});
    var ups = cfg.ups;
    for (var u = 0; u < ups; u++) place(r() < 0.6 ? 'atk' : 'def', 1, {});
    for (var cc = 0; cc < cfg.cash; cc++) place('cash', 1, { amount: (ri(r, 2, 9) * 10 + f * 20) });
    this.reveal();
  };

  Game.prototype.bossName = function () {
    return { pip: 'Pip', gridlock: 'Ted', monolith: 'Excel', edith: 'Edith' }[this.level];
  };

  Game.prototype.tile = function (x, y) {
    if (x < 0 || y < 0 || x >= W || y >= H) return VOID;
    return this.grid[idx(x, y)];
  };

  Game.prototype.monsterAt = function (x, y) {
    for (var i = 0; i < this.monsters.length; i++) {
      var m = this.monsters[i];
      if (m.hp > 0 && m.x === x && m.y === y) return m;
    }
    return null;
  };

  // Line of sight within radius 6 (rooms are convex, corridors narrow).
  Game.prototype.visible = function (x, y) {
    var h = this.hero;
    var dx = x - h.x, dy = y - h.y;
    if (dx * dx + dy * dy > 40) return false;
    var steps = Math.max(Math.abs(dx), Math.abs(dy));
    for (var s = 1; s < steps; s++) {
      var px = Math.round(h.x + dx * s / steps), py = Math.round(h.y + dy * s / steps);
      if (this.tile(px, py) !== FLOOR) return false;
    }
    return true;
  };

  Game.prototype.reveal = function () {
    var h = this.hero;
    for (var y = Math.max(0, h.y - 7); y <= Math.min(H - 1, h.y + 7); y++) {
      for (var x = Math.max(0, h.x - 7); x <= Math.min(W - 1, h.x + 7); x++) {
        if (this.visible(x, y)) this.seen[idx(x, y)] = 1;
      }
    }
  };

  Game.prototype.attackDamage = function (atk, def) {
    var roll = Math.floor(this.r() * 3) - 1;
    return Math.max(1, atk + roll - def);
  };

  // dir: 0 up, 1 right, 2 down, 3 left. Returns true if a turn was used.
  Game.prototype.move = function (dir) {
    if (this.over) return false;
    var h = this.hero, d = DIRS[dir];
    var nx = h.x + d[0], ny = h.y + d[1];
    var m = this.monsterAt(nx, ny);
    if (m) {
      this.heroAttack(m);
      this.endTurn();
      return true;
    }
    if (this.tile(nx, ny) !== FLOOR) return false;
    h.x = nx; h.y = ny;
    var it = this.items[idx(nx, ny)];
    if (it) this.pickUp(it, nx, ny);
    if (this.floorChanged) { this.floorChanged = false; return true; }
    this.endTurn();
    return true;
  };

  Game.prototype.wait = function () {
    if (this.over) return false;
    this.endTurn();
    return true;
  };

  Game.prototype.drink = function () {
    if (this.over) return false;
    var h = this.hero;
    if (h.potions <= 0) { this.say('No coffee left.'); return false; }
    if (h.hp >= h.max) { this.say('You are already at full health.'); return false; }
    h.potions--;
    var amt = Math.min(h.max - h.hp, this.cfg.heal + 2 * this.floor);
    h.hp += amt;
    this.fx.push({ x: h.x, y: h.y, text: '+' + amt, kind: 'heal' });
    this.say('You drink a coffee: +' + amt + ' HP.');
    this.endTurn();
    return true;
  };

  Game.prototype.heroAttack = function (m) {
    var h = this.hero;
    var dmg = this.attackDamage(h.atk, m.def || 0);
    m.hp -= dmg;
    m.awake = true;
    this.fx.push({ x: m.x, y: m.y, text: '-' + dmg, kind: 'hit' });
    if (m.hp <= 0) {
      this.kills++;
      if (m.boss) {
        this.say('You beat ' + m.name + '! Every sheet is fixed.');
        this.over = true;
        this.result = 'win';
        return;
      }
      this.say(m.name + ' fixed! +' + m.xp + ' XP.');
      this.gainXp(m.xp);
      if (this.r() < 0.35) this.items[idx(m.x, m.y)] = { kind: 'cash', amount: 10 * ri(this.r, 1, 5) };
    } else {
      this.say('You bonk ' + m.name + ' for ' + dmg + '. ' + m.hp + ' HP left.');
    }
  };

  Game.prototype.gainXp = function (n) {
    var h = this.hero;
    h.xp += n;
    while (h.xp >= this.xpNeeded()) {
      h.xp -= this.xpNeeded();
      h.lvl++;
      h.max += 6;
      h.hp = Math.min(h.max, h.hp + 10);
      h.atk += 1;
      this.say('Level up! You are level ' + h.lvl + ': +6 max HP and +1 attack.');
      this.fx.push({ x: h.x, y: h.y, text: 'LVL ' + h.lvl, kind: 'level' });
    }
  };
  Game.prototype.xpNeeded = function () { return 8 + this.hero.lvl * 6; };

  Game.prototype.pickUp = function (it, x, y) {
    var h = this.hero;
    if (it.kind === 'stairs') {
      this.floor++;
      this.say('On to sheet ' + this.cfg.tabs[this.floor] + '!');
      this.buildFloor();
      this.floorChanged = true;
      return;
    }
    delete this.items[idx(x, y)];
    if (it.kind === 'potion') {
      if (h.potions >= 5) { this.items[idx(x, y)] = it; this.say('You cannot carry more than 5 coffees.'); return; }
      h.potions++;
      this.say('Picked up a coffee. Press Q to drink it.');
    } else if (it.kind === 'atk') {
      h.atk++;
      this.say('Found a stapler: +1 attack.');
      this.fx.push({ x: x, y: y, text: '+1 ATK', kind: 'level' });
    } else if (it.kind === 'def') {
      h.def++;
      this.say('Found a binder shield: +1 defense.');
      this.fx.push({ x: x, y: y, text: '+1 DEF', kind: 'level' });
    } else if (it.kind === 'cash') {
      h.cash += it.amount;
      this.say('Found $' + it.amount + '.');
    }
  };

  Game.prototype.distMap = function () {
    var dist = new Int16Array(W * H).fill(-1);
    var h = this.hero, q = [idx(h.x, h.y)];
    dist[q[0]] = 0;
    for (var qi = 0; qi < q.length; qi++) {
      var c = q[qi], cx = c % W, cy = (c / W) | 0;
      for (var k = 0; k < 4; k++) {
        var nx = cx + DIRS[k][0], ny = cy + DIRS[k][1];
        if (this.tile(nx, ny) !== FLOOR) continue;
        var n = idx(nx, ny);
        if (dist[n] >= 0) continue;
        dist[n] = dist[c] + 1;
        q.push(n);
      }
    }
    return dist;
  };

  Game.prototype.endTurn = function () {
    if (this.over) return;
    this.turn++;
    this.reveal();
    var h = this.hero;
    var dist = this.distMap();
    var self = this;
    this.monsters.forEach(function (m) {
      if (m.hp <= 0 || self.over) return;
      if (!m.awake && self.visible(m.x, m.y)) m.awake = true;
      if (!m.awake) return;
      if (m.slow && self.turn % 2 === 0) return;
      var steps = m.fast ? 2 : 1;
      for (var s = 0; s < steps && !self.over; s++) {
        if (Math.abs(m.x - h.x) + Math.abs(m.y - h.y) === 1) {
          if (m.boss && m.cool > 0) { m.cool--; break; }
          var dmg = self.attackDamage(m.atk, h.def);
          h.hp -= dmg;
          self.fx.push({ x: h.x, y: h.y, text: '-' + dmg, kind: 'hurt' });
          self.say(m.name + ' hits you for ' + dmg + '.');
          if (m.boss && self.level === 'edith' && self.r() < 0.25) {
            var extra = self.attackDamage(Math.round(m.atk * 0.6), h.def);
            h.hp -= extra;
            self.say('Edith follows up with ' + extra + ' more damage.');
          }
          if (h.hp <= 0) {
            h.hp = 0;
            self.over = true;
            self.result = 'lose';
            self.say(m.name + ' knocked you out.');
          }
          break;
        }
        var best = null, bd = dist[idx(m.x, m.y)];
        if (bd < 0) break;
        for (var k = 0; k < 4; k++) {
          var nx = m.x + DIRS[k][0], ny = m.y + DIRS[k][1];
          if (self.tile(nx, ny) !== FLOOR || self.monsterAt(nx, ny) || (nx === h.x && ny === h.y)) continue;
          var dd = dist[idx(nx, ny)];
          if (dd >= 0 && dd < bd) { bd = dd; best = [nx, ny]; }
        }
        if (!best) break;
        m.x = best[0]; m.y = best[1];
      }
    });
  };

  var api = { W: W, H: H, VOID: VOID, WALL: WALL, FLOOR: FLOOR, LEVELS: LEVELS, MONSTERS: MONSTERS, DIRS: DIRS, Game: Game, idx: idx, rng: rng };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.XDE = api;
})(typeof window !== 'undefined' ? window : this);
