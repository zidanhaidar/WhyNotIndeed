/*
 * Sock Trap engine: a robot vacuum cleans an office, and you place chairs, cables and socks to stop it.
 * Pure logic, no DOM. Loaded as a plain script (window.ST) and by Node scripts in dev/ (module.exports).
 */
(function (global) {
  'use strict';

  var W = 18, H = 12;
  var MIN_REACH = 0.6;
  var DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];
  var BLOCK = { '#': 'wall', d: 'desk', p: 'plant', k: 'counter', b: 'shelf', s: 'sofa' };

  // The original hand-drawn offices. Every game now gets freshly generated offices (makeOffice below);
  // these are only a fallback if the generator ever fails.
  // Maps: '#' wall, d desk, p plant, k kitchen counter, b bookshelf, s sofa, '.' floor, D dock.
  var MAPS = {
    pip: [
      '##################',
      '#.....#..........#',
      '#.kk..#..dd...dd.#',
      '#.....+..........#',
      '#.....#..dd...dd.#',
      '#.....#..........#',
      '###+###..........#',
      '#.....#.....p....#',
      '#.....+..........#',
      '#.ss..#.........D#',
      '#.....#..........#',
      '##################'
    ],
    gridlock: [
      '##################',
      '#....#......#....#',
      '#.kk.#..dd..#.bb.#',
      '#....+......+....#',
      '#....#..dd..#....#',
      '##+###......##+###',
      '#................#',
      '#..dd....p....dd.#',
      '#................#',
      '###+####..####+###',
      '#......#..#.....D#',
      '##################'
    ],
    monolith: [
      '##################',
      '#.....#.....#....#',
      '#.kk..+.dd..+.ss.#',
      '#.....#.dd..#....#',
      '#.....#.....#....#',
      '##++###.....###+##',
      '#................#',
      '#.dd..dd..p..dd..#',
      '#................#',
      '##+#####++#####+##',
      '#....b#.....#...D#',
      '##################'
    ],
    edith: [
      '##################',
      '#....#.......#...#',
      '#.kk.+..dd...+.s.#',
      '#....#..dd...#...#',
      '##.###.......##.##',
      '#.......p........#',
      '#.dd.dd...dd.dd..#',
      '#................#',
      '###.##..####..#.##',
      '#.b...#..b.#.....#',
      '#.....#....#....D#',
      '##################'
    ]
  };

  /*
   * brain: bounce (random), sweep (lawnmower), map (nearest dirty spot), plan (map + sees your traps coming)
   * knows: starts with the office layout. sense: sees items this many cells away (socks only for map).
   */
  var LEVELS = {
    pip: { brain: 'bounce', battery: 230, target: 45, items: { chair: 4, cable: 3, sock: 5 }, jam: 16, tangle: 26, knows: false, memory: false, sense: 0 },
    gridlock: { brain: 'sweep', battery: 160, target: 50, items: { chair: 4, cable: 3, sock: 4 }, jam: 14, tangle: 24, knows: false, memory: true, sense: 0 },
    monolith: { brain: 'map', battery: 150, target: 50, items: { chair: 4, cable: 2, sock: 4 }, jam: 14, tangle: 22, knows: true, memory: true, sense: 1 },
    edith: { brain: 'plan', battery: 140, target: 45, items: { chair: 3, cable: 2, sock: 3 }, jam: 12, tangle: 20, knows: true, memory: true, sense: 3 }
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

  function idx(x, y) { return y * W + x; }

  // ---------- generated offices ----------

  /*
   * rooms: how many rooms the office is split into. furn: squares of furniture. Smarter vacuums get busier
   * offices. floor: the range of open floor every office keeps, so batteries and targets stay fair.
   */
  var PLAN = {
    pip: { rooms: [3, 4], furn: [10, 14] },
    gridlock: { rooms: [4, 5], furn: [12, 16] },
    monolith: { rooms: [5, 6], furn: [13, 17] },
    edith: { rooms: [5, 6], furn: [14, 18] }
  };
  var FLOOR = [112, 140];
  // furniture pieces as rows of map letters; the ones marked wall go against a wall
  var PIECES = [
    { rows: ['dd'], weight: 4 }, { rows: ['d', 'd'], weight: 2 }, { rows: ['dd', 'dd'], weight: 2 },
    { rows: ['p'], weight: 3 }, { rows: ['kk'], wall: true, weight: 1, once: 'k' }, { rows: ['kkk'], wall: true, weight: 1, once: 'k' },
    { rows: ['ss'], wall: true, weight: 1 }, { rows: ['b'], wall: true, weight: 1 }, { rows: ['bb'], wall: true, weight: 1 }
  ];

  // Every floor square reachable from the first one?
  function connected(g) {
    var start = -1, total = 0;
    for (var i = 0; i < W * H; i++) if (g[i] === '.') { total++; if (start < 0) start = i; }
    if (start < 0) return false;
    var seen = new Uint8Array(W * H), q = [start], n = 0;
    seen[start] = 1;
    while (q.length) {
      var u = q.pop();
      n++;
      for (var d = 0; d < 4; d++) {
        var vx = u % W + DIRS[d][0], vy = ((u / W) | 0) + DIRS[d][1], v = idx(vx, vy);
        if (vx >= 0 && vy >= 0 && vx < W && vy < H && !seen[v] && g[v] === '.') { seen[v] = 1; q.push(v); }
      }
    }
    return n === total;
  }

  function tryOffice(plan, rand) {
    function ri(a, b) { return a + Math.floor(rand() * (b - a + 1)); }
    var g = [], doors = [], x, y;
    for (y = 0; y < H; y++) for (x = 0; x < W; x++) g.push(x === 0 || y === 0 || x === W - 1 || y === H - 1 ? '#' : '.');
    // 1. split the floor into rooms with walls, each wall with a doorway or two
    var rooms = [{ x0: 1, y0: 1, x1: W - 2, y1: H - 2 }], want = ri(plan.rooms[0], plan.rooms[1]);
    for (var guard = 0; rooms.length < want && guard < 40; guard++) {
      rooms.sort(function (a, b) { return (b.x1 - b.x0) * (b.y1 - b.y0) - (a.x1 - a.x0) * (a.y1 - a.y0); });
      var r = rooms[ri(0, Math.min(1, rooms.length - 1))], w = r.x1 - r.x0 + 1, h = r.y1 - r.y0 + 1;
      var vertical = w >= 7 && (h < 7 || w > h * 1.2 || (w * 1.2 >= h && rand() < 0.5));
      if (!vertical && h < 7) continue;
      var at = vertical ? ri(r.x0 + 3, r.x1 - 3) : ri(r.y0 + 3, r.y1 - 3);
      // a new wall must not run into a doorway of the walls around its room
      var blocked = doors.some(function (d) {
        return vertical ? d.x === at && (d.y === r.y0 - 1 || d.y === r.y1 + 1) : d.y === at && (d.x === r.x0 - 1 || d.x === r.x1 + 1);
      });
      if (blocked) continue;
      var span = [];
      if (vertical) for (y = r.y0; y <= r.y1; y++) span.push(idx(at, y));
      else for (x = r.x0; x <= r.x1; x++) span.push(idx(x, at));
      span.forEach(function (c) { g[c] = '#'; });
      var nd = span.length >= 8 && rand() < 0.45 ? 2 : 1, first = -9;
      for (var k = 0; k < nd; k++) {
        var di;
        do { di = ri(0, span.length - 1); } while (Math.abs(di - first) < 3);
        first = di;
        g[span[di]] = '.';
        doors.push({ x: span[di] % W, y: (span[di] / W) | 0 });
      }
      var a = vertical ? { x0: r.x0, y0: r.y0, x1: at - 1, y1: r.y1 } : { x0: r.x0, y0: r.y0, x1: r.x1, y1: at - 1 };
      var b = vertical ? { x0: at + 1, y0: r.y0, x1: r.x1, y1: r.y1 } : { x0: r.x0, y0: at + 1, x1: r.x1, y1: r.y1 };
      rooms.splice(rooms.indexOf(r), 1, a, b);
    }
    // squares next to a doorway stay clear so every doorway can be walked through
    var keep = new Uint8Array(W * H);
    doors.forEach(function (d) {
      keep[idx(d.x, d.y)] = 1;
      for (var q = 0; q < 4; q++) {
        var kx = d.x + DIRS[q][0], ky = d.y + DIRS[q][1];
        if (kx > 0 && ky > 0 && kx < W - 1 && ky < H - 1) keep[idx(kx, ky)] = 1;
      }
    });
    // 2. furnish the rooms without ever cutting any floor off
    var furn = ri(plan.furn[0], plan.furn[1]), placed = 0, used = {}, total = 0;
    PIECES.forEach(function (pc) { total += pc.weight; });
    for (var tries = 0; placed < furn && tries < 400; tries++) {
      var roll = rand() * total, pc = PIECES[0];
      for (var pi = 0; pi < PIECES.length; pi++) { roll -= PIECES[pi].weight; if (roll < 0) { pc = PIECES[pi]; break; } }
      if (pc.once && used[pc.once]) continue;
      var room = rooms[ri(0, rooms.length - 1)], ph = pc.rows.length, pw = pc.rows[0].length;
      if (room.x1 - room.x0 + 1 < pw + 1 || room.y1 - room.y0 + 1 < ph + 1) continue;
      var ox = ri(room.x0, room.x1 - pw + 1), oy = ri(room.y0, room.y1 - ph + 1), cells = [], fits = true, touches = false;
      for (var py = 0; py < ph && fits; py++) {
        for (var px = 0; px < pw; px++) {
          var cc = idx(ox + px, oy + py);
          if (g[cc] !== '.' || keep[cc]) { fits = false; break; }
          cells.push([cc, pc.rows[py].charAt(px)]);
          for (var q2 = 0; q2 < 4; q2++) if (g[idx(ox + px + DIRS[q2][0], oy + py + DIRS[q2][1])] === '#') touches = true;
        }
      }
      if (!fits || (pc.wall && !touches)) continue;
      cells.forEach(function (e) { g[e[0]] = e[1]; });
      if (!connected(g)) { cells.forEach(function (e) { g[e[0]] = '.'; }); continue; }
      if (pc.once) used[pc.once] = true;
      placed += cells.length;
    }
    // 3. the charging dock goes in a corner with room to roll out
    var corners = [];
    for (var c2 = 0; c2 < W * H; c2++) {
      if (g[c2] !== '.' || keep[c2]) continue;
      var walls = 0, open = 0;
      for (var q3 = 0; q3 < 4; q3++) {
        var t = g[idx(c2 % W + DIRS[q3][0], ((c2 / W) | 0) + DIRS[q3][1])];
        if (t === '#') walls++; else if (t === '.') open++;
      }
      if (walls >= 2 && open >= 2) corners.push(c2);
    }
    var floor = 0;
    for (var f = 0; f < W * H; f++) if (g[f] === '.') floor++;
    if (!corners.length || floor < FLOOR[0] || floor > FLOOR[1] || rooms.length < plan.rooms[0] || !connected(g)) return null;
    g[corners[ri(0, corners.length - 1)]] = 'D';
    var out = [];
    for (y = 0; y < H; y++) out.push(g.slice(y * W, y * W + W).join(''));
    return out;
  }

  // A brand new office for this vacuum: rooms, doorways, furniture and a dock, different every time.
  function makeOffice(levelId, rand) {
    for (var i = 0; i < 300; i++) {
      var m = tryOffice(PLAN[levelId], rand);
      if (m) return m;
    }
    return MAPS[levelId];
  }

  // map: an office to play in (rows of map letters); leave it out for a freshly generated one.
  function Game(levelId, seed, map) {
    var cfg = LEVELS[levelId];
    this.level = levelId;
    this.cfg = cfg;
    this.rand = rng(seed || 1);
    map = map || makeOffice(levelId, this.rand);
    this.map = map;
    this.tiles = [];
    this.dock = null;
    for (var y = 0; y < H; y++) {
      for (var x = 0; x < W; x++) {
        var ch = map[y].charAt(x) || '#';
        if (ch === 'D') this.dock = { x: x, y: y };
        this.tiles.push(BLOCK[ch] || 'floor');
      }
    }
    this.items = {};            // cell -> 'chair' | 'cable' | 'sock'
    this.left = { chair: cfg.items.chair, cable: cfg.items.cable, sock: cfg.items.sock };
    this.clean = new Uint8Array(W * H);
    this.known = new Uint8Array(W * H); // robot memory: 1 blocked, 2 sock seen
    this.robot = { x: this.dock.x, y: this.dock.y, dir: 2, stuck: 0, stuckBy: null, heading: -1, sweepDy: -1 };
    this.clean[idx(this.dock.x, this.dock.y)] = 1;
    this.battery = cfg.battery;
    this.t = 0;
    this.phase = 'setup';
    this.result = null;
    this.path = [];
    this.events = [];
    this.stats = { bumps: 0, jams: 0, tangles: 0 };
    if (cfg.knows) {
      for (var c = 0; c < W * H; c++) if (this.tiles[c] !== 'floor') this.known[c] = 1;
    }
  }

  var P = Game.prototype;

  P.isFloor = function (x, y) { return x >= 0 && y >= 0 && x < W && y < H && this.tiles[idx(x, y)] === 'floor'; };

  P.canPlace = function (x, y, type) {
    if (!this.isFloor(x, y)) return 'Only on the floor.';
    if (this.items[idx(x, y)]) return 'Something is already there.';
    if (this.left[type] <= 0) return 'None left.';
    var r = this.robot;
    if (this.phase === 'setup') {
      if (x === this.dock.x && y === this.dock.y) return 'That is the charging dock.';
      if (Math.abs(x - this.dock.x) + Math.abs(y - this.dock.y) <= 1) return 'Too close to the dock.';
      if (type !== 'sock' && this.reachAfter(idx(x, y)) < MIN_REACH) return 'No walling it in: it must reach ' + Math.round(MIN_REACH * 100) + '% of the floor.';
    } else {
      if (this.phase !== 'run' || type !== 'sock') return 'Only socks can be tossed now.';
      if (Math.max(Math.abs(x - r.x), Math.abs(y - r.y)) <= 1) return 'Too close to the robot.';
    }
    return '';
  };

  P.place = function (x, y, type) {
    if (this.canPlace(x, y, type)) return false;
    this.items[idx(x, y)] = type;
    this.left[type]--;
    if (this.phase === 'run') this.events.push({ type: 'toss', x: x, y: y });
    return true;
  };

  P.remove = function (x, y) {
    if (this.phase !== 'setup') return false;
    var c = idx(x, y), t = this.items[c];
    if (!t) return false;
    delete this.items[c];
    this.left[t]++;
    return true;
  };

  // Share of the floor the robot could reach from its dock if one more blocker went on cell c.
  P.reachAfter = function (c) {
    var block = function (i) { return i === c || this.tiles[i] !== 'floor' || this.items[i] === 'chair' || this.items[i] === 'cable'; }.bind(this);
    var total = 0;
    for (var i = 0; i < W * H; i++) if (this.tiles[i] === 'floor' && i !== c && this.items[i] !== 'chair' && this.items[i] !== 'cable') total++;
    var start = idx(this.dock.x, this.dock.y), seen = new Uint8Array(W * H), q = [start], n = 0;
    seen[start] = 1;
    while (q.length) {
      var u = q.pop();
      n++;
      for (var d = 0; d < 4; d++) {
        var vx = u % W + DIRS[d][0], vy = ((u / W) | 0) + DIRS[d][1];
        if (vx < 0 || vy < 0 || vx >= W || vy >= H) continue;
        var v = idx(vx, vy);
        if (!seen[v] && !block(v)) { seen[v] = 1; q.push(v); }
      }
    }
    return total ? n / total : 0;
  };
  P.reach = function () { return this.reachAfter(-1); };

  P.start = function () {
    if (this.phase !== 'setup') return;
    this.phase = 'run';
    this.sense();
  };

  // Countable floor: every floor cell not covered by one of your items.
  P.tally = function () {
    var total = 0, dirty = 0;
    for (var c = 0; c < W * H; c++) {
      if (this.tiles[c] !== 'floor' || this.items[c]) continue;
      total++;
      if (!this.clean[c]) dirty++;
    }
    return { total: total, dirty: dirty, pct: total ? (100 * dirty / total) : 0 };
  };

  P.itemsLeft = function () { return this.left.chair + this.left.cable + this.left.sock; };

  // What the robot can see of your items this tick.
  P.sense = function () {
    var cfg = this.cfg, r = this.robot;
    if (!cfg.sense) return;
    var R = cfg.sense;
    for (var y = r.y - R; y <= r.y + R; y++) {
      for (var x = r.x - R; x <= r.x + R; x++) {
        if (x < 0 || y < 0 || x >= W || y >= H) continue;
        var c = idx(x, y), it = this.items[c];
        if (!it) continue;
        if (cfg.brain === 'map' && it !== 'sock') continue;
        if (this.known[c] === 0) this.events.push({ type: 'spot', x: x, y: y, item: it });
        this.known[c] = it === 'sock' ? 2 : 1;
      }
    }
  };

  // Path search over what the robot believes. Socks it has seen cost extra; it walks over them only when it must.
  P.plan = function (sweep) {
    var r = this.robot, known = this.known, clean = this.clean;
    var dist = new Float64Array(W * H).fill(Infinity), prev = new Int32Array(W * H).fill(-1), done = new Uint8Array(W * H);
    var start = idx(r.x, r.y);
    dist[start] = 0;
    var best = -1, bestScore = Infinity;
    for (;;) {
      var u = -1, du = Infinity;
      for (var i = 0; i < W * H; i++) if (!done[i] && dist[i] < du) { du = dist[i]; u = i; }
      if (u < 0 || du > bestScore) break;
      done[u] = 1;
      if (u !== start && !clean[u]) {
        var score = du;
        if (this.cfg.brain === 'plan') score -= 0.12 * this.dirtyAround(u % W, (u / W) | 0);
        if (score < bestScore) { bestScore = score; best = u; }
      }
      var ux = u % W, uy = (u / W) | 0;
      for (var d = 0; d < 4; d++) {
        var vx = ux + DIRS[d][0], vy = uy + DIRS[d][1];
        if (vx < 0 || vy < 0 || vx >= W || vy >= H) continue;
        var v = idx(vx, vy);
        if (known[v] === 1) continue;
        var step = 1;
        if (known[v] === 2) step += 30;
        if (sweep) step += DIRS[d][1] !== 0 ? 0.6 : (DIRS[d][0] === r.heading ? 0 : 1.2);
        if (du + step < dist[v]) { dist[v] = du + step; prev[v] = u; }
      }
    }
    if (best < 0) return null;
    var path = [], c = best;
    while (c !== start && c >= 0) { path.unshift(c); c = prev[c]; }
    return path;
  };

  P.dirtyAround = function (x, y) {
    var n = 0;
    for (var yy = y - 2; yy <= y + 2; yy++) for (var xx = x - 2; xx <= x + 2; xx++) {
      if (this.isFloor(xx, yy) && !this.clean[idx(xx, yy)] && this.known[idx(xx, yy)] !== 1) n++;
    }
    return n;
  };

  // One tick: the robot spends a unit of battery and moves, bumps, or sits jammed.
  P.step = function () {
    if (this.phase !== 'run') return;
    var r = this.robot, cfg = this.cfg;
    this.t++;
    this.battery--;
    if (r.stuck > 0) {
      r.stuck--;
      if (r.stuck === 0) this.events.push({ type: 'free', by: r.stuckBy });
    } else {
      var d = this.choose();
      if (d < 0) {
        this.finish('done');
        return;
      }
      this.tryMove(d);
    }
    this.sense();
    if (this.battery <= 0) this.finish('battery');
  };

  P.choose = function () {
    var r = this.robot, cfg = this.cfg;
    if (cfg.brain === 'bounce') {
      // Sloppy: often sniffs out a dusty cell next to it, otherwise rolls on until it bumps into something.
      var ahead = idx(r.x + DIRS[r.dir][0], r.y + DIRS[r.dir][1]);
      if (this.isFloor(r.x + DIRS[r.dir][0], r.y + DIRS[r.dir][1]) && !this.clean[ahead] && this.rand() < 0.85) return r.dir;
      if (this.rand() < 0.6) {
        var dusty = [];
        for (var k = 0; k < 4; k++) {
          var ax = r.x + DIRS[k][0], ay = r.y + DIRS[k][1];
          if (this.isFloor(ax, ay) && !this.clean[idx(ax, ay)]) dusty.push(k);
        }
        if (dusty.length) { r.dir = dusty[Math.floor(this.rand() * dusty.length)]; return r.dir; }
      }
      if (this.rand() < 0.08) r.dir = Math.floor(this.rand() * 4);
      return r.dir;
    }
    var path = this.plan(cfg.brain === 'sweep');
    this.path = path || [];
    if (!path || !path.length) return -1;
    var nx = path[0] % W, ny = (path[0] / W) | 0;
    for (var d = 0; d < 4; d++) if (r.x + DIRS[d][0] === nx && r.y + DIRS[d][1] === ny) return d;
    return -1;
  };

  P.tryMove = function (d) {
    var r = this.robot, cfg = this.cfg;
    var nx = r.x + DIRS[d][0], ny = r.y + DIRS[d][1];
    r.dir = d;
    if (DIRS[d][0]) r.heading = DIRS[d][0];
    var c = idx(nx, ny), it = this.items[c];
    if (!this.isFloor(nx, ny) || it === 'chair') {
      this.stats.bumps++;
      if (cfg.memory) this.known[c] = 1;
      this.events.push({ type: 'bump', x: nx, y: ny, what: it || this.tiles[c] || 'wall' });
      if (cfg.brain === 'bounce') {
        var nd;
        do { nd = Math.floor(this.rand() * 4); } while (nd === d);
        r.dir = nd;
      }
      return;
    }
    if (it === 'cable') {
      this.stats.tangles++;
      r.stuck = cfg.tangle;
      r.stuckBy = 'cable';
      if (cfg.memory) this.known[c] = 1;
      this.events.push({ type: 'tangle', x: nx, y: ny });
      if (cfg.brain === 'bounce') r.dir = (d + 2) % 4;
      return;
    }
    r.x = nx;
    r.y = ny;
    var fresh = !this.clean[c];
    this.clean[c] = 1;
    if (it === 'sock') {
      delete this.items[c];
      this.known[c] = 0;
      this.stats.jams++;
      r.stuck = cfg.jam;
      r.stuckBy = 'sock';
      this.events.push({ type: 'jam', x: nx, y: ny });
    } else {
      this.events.push({ type: 'move', x: nx, y: ny, fresh: fresh });
    }
  };

  P.finish = function (why) {
    this.phase = 'over';
    var t = this.tally();
    this.result = t.pct >= this.cfg.target ? 'win' : 'lose';
    this.endReason = why;
    this.events.push({ type: 'end', why: why, result: this.result });
  };

  // Runs a whole game with no tosses. Used by dev/balance_sock_trap.js.
  P.runToEnd = function (onTick) {
    if (this.phase === 'setup') this.start();
    while (this.phase === 'run') {
      if (onTick) onTick(this);
      this.step();
      this.events.length = 0;
    }
    return this.tally();
  };

  var ST = { W: W, H: H, MIN_REACH: MIN_REACH, DIRS: DIRS, MAPS: MAPS, PLAN: PLAN, FLOOR: FLOOR, LEVELS: LEVELS, Game: Game, rng: rng, idx: idx, makeOffice: makeOffice };
  if (typeof module !== 'undefined' && module.exports) module.exports = ST;
  else global.ST = ST;
})(typeof window !== 'undefined' ? window : this);
