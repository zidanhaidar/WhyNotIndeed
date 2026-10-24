/*
 * Excel Dungeon: cartoon dungeon UI on top of engine.js and sprites.js.
 */
import X from './engine.js';
import SP from './sprites.js';

export function mount() {
  var A = window.Arcade;
  var sc = A.scope();
  var GAME = 'excel-dungeon';
  var W = X.W, H = X.H;
  var COLS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  function $(s) { return document.querySelector(s); }
  function addr(x, y) { return COLS[x] + (y + 1); }

  var INTRO = {
    pip: 'Hi! The spreadsheets are full of errors. Can you fix all three sheets? I\'ll be waiting on the last one!',
    gridlock: 'Four sheets. Fix every error before you reach me on the summary sheet.',
    monolith: 'Five sheets, full year. The errors get nastier. I will be at the end.',
    edith: 'Hi! Edith is waiting on the last sheet. Edith hits hard. Good luck!'
  };
  var TRAIT = {
    typo: 'A tiny mistake. Easy to fix.',
    latefee: 'Shows up where nobody expects it.',
    invoice: 'A grumpy error that hits back.',
    creep: 'Fast! Moves twice every turn.',
    audit: 'Big and tough, but slow: moves every other turn.',
    cut: 'Elite error. Hits really hard.',
    boss: 'The boss of this workbook. Beat them to win.'
  };
  var ITEM_INFO = {
    potion: ['Coffee', 'Walk over it to pick it up, then press Q to drink it and heal.'],
    atk: ['Stapler', 'Walk over it: +1 attack for the rest of the run.'],
    def: ['Binder shield', 'Walk over it: +1 defense, so every hit hurts less.'],
    cash: ['Coins', 'Walk over it to pick it up. Just for bragging rights.'],
    stairs: ['Next sheet', 'Walk into the door to move on to the next sheet.']
  };

  var S = { level: A.lastLevel(GAME), game: null, hover: null, intro: true, shownLog: 0, log: [], T: 40, face: 1, ents: {} };

  // ---------- tiles ----------

  var tiles = [];
  function buildTiles() {
    var wrap = $('#tiles');
    wrap.innerHTML = '';
    tiles = [];
    for (var y = 0; y < H; y++) {
      for (var x = 0; x < W; x++) {
        var d = document.createElement('div');
        d.className = 'tile fog';
        d.dataset.x = x;
        d.dataset.y = y;
        wrap.appendChild(d);
        tiles.push(d);
      }
    }
    wrap.addEventListener('mouseover', function (e) {
      var t = e.target.closest('.tile');
      if (!t) return;
      S.hover = { x: Number(t.dataset.x), y: Number(t.dataset.y) };
      renderWho();
    });
    wrap.addEventListener('mouseleave', function () { S.hover = null; renderWho(); });
    wrap.addEventListener('click', function (e) {
      var t = e.target.closest('.tile');
      if (!t || !S.game) return;
      var dx = Number(t.dataset.x) - S.game.hero.x, dy = Number(t.dataset.y) - S.game.hero.y;
      if (Math.abs(dx) + Math.abs(dy) !== 1) return;
      move(dx === 1 ? 1 : dx === -1 ? 3 : dy === 1 ? 2 : 0);
    });
  }

  function renderTiles() {
    var G = S.game;
    for (var y = 0; y < H; y++) {
      for (var x = 0; x < W; x++) {
        var i = X.idx(x, y), t = G.grid[i], cls;
        if (!G.seen[i] || t === X.VOID) cls = 'tile fog';
        else cls = 'tile ' + (t === X.WALL ? 'wall' : 'floor') + (G.visible(x, y) ? '' : ' dim');
        if (tiles[i].className !== cls) tiles[i].className = cls;
      }
    }
  }

  // ---------- entities ----------

  function entEl(key, html, cls) {
    var el = S.ents[key];
    if (!el) {
      el = document.createElement('div');
      el.className = 'ent ' + (cls || '');
      el.innerHTML = html;
      $('#ents').appendChild(el);
      S.ents[key] = el;
    }
    el.dataset.live = '1';
    return el;
  }
  function place(el, x, y) {
    el.style.transform = 'translate(' + (x * S.T) + 'px,' + (y * S.T) + 'px)';
  }

  function renderEnts() {
    var G = S.game, h = G.hero;
    for (var k in S.ents) S.ents[k].dataset.live = '';
    // items (remembered once seen)
    for (var key in G.items) {
      var i = Number(key), x = i % W, y = (i / W) | 0;
      if (!G.seen[i]) continue;
      var it = G.items[key];
      var el = entEl('i' + key + it.kind, SP.wrap(SP.item(it.kind)), 'item ' + it.kind + (it.kind === 'stairs' ? '' : ''));
      if (it.kind === 'stairs' && !el.querySelector('.door-tag')) el.insertAdjacentHTML('beforeend', '<span class="door-tag">' + G.cfg.tabs[G.floor + 1] + '</span>');
      place(el, x, y);
    }
    // monsters (only while you can see them)
    G.monsters.forEach(function (m, n) {
      if (m.hp <= 0 || !G.visible(m.x, m.y)) return;
      var html = m.boss ? '<div class="boss-face">' + A.face(G.level, m.hp < m.max * 0.35 ? 'worried' : 'smug') + '</div>' : SP.wrap(SP.monster(m.id, m.awake));
      var el = entEl('m' + G.floor + '-' + n, html + '<span class="hp"></span>', 'mon ' + m.id + (m.boss ? ' boss' : '') + (m.elite ? ' elite' : ''));
      if (m.boss) el.querySelector('.boss-face').innerHTML = A.face(G.level, m.hp < m.max * 0.35 ? 'worried' : 'smug');
      else if (el.dataset.awake !== String(m.awake)) { el.firstChild.outerHTML = SP.wrap(SP.monster(m.id, m.awake)); }
      el.dataset.awake = String(m.awake);
      el.querySelector('.hp').textContent = m.hp;
      place(el, m.x, m.y);
    });
    // hero
    var he = entEl('hero', '<div class="hero-in">' + SP.wrap(SP.hero()) + '</div>', 'hero');
    he.classList.toggle('flip', S.face < 0);
    he.classList.toggle('low', h.hp <= h.max * 0.3);
    he.classList.toggle('dead', G.result === 'lose');
    place(he, h.x, h.y);
    for (var k2 in S.ents) {
      if (!S.ents[k2].dataset.live) { S.ents[k2].remove(); delete S.ents[k2]; }
    }
  }

  function renderFx() {
    var G = S.game;
    G.fx.forEach(function (f) {
      var s = document.createElement('span');
      s.className = 'pop ' + f.kind;
      s.textContent = f.text;
      s.style.left = (f.x * S.T + S.T / 2) + 'px';
      s.style.top = (f.y * S.T) + 'px';
      $('#ents').appendChild(s);
      sc.timeout(function () { s.remove(); }, 900);
      if (f.kind === 'hit') flash('mon', f.x, f.y);
      if (f.kind === 'hurt') flash('hero');
    });
    G.fx.length = 0;
  }

  function flash(kind, x, y) {
    var el = null;
    if (kind === 'hero') el = S.ents.hero;
    else {
      var G = S.game;
      G.monsters.forEach(function (m, n) { if (m.x === x && m.y === y) el = S.ents['m' + G.floor + '-' + n]; });
    }
    if (!el) return;
    el.classList.remove('ouch'); void el.offsetWidth; el.classList.add('ouch');
  }

  function camera() {
    var G = S.game, view = $('#view'), T = S.T;
    var vw = view.clientWidth, vh = view.clientHeight, mw = W * T, mh = H * T;
    var cx = mw <= vw ? (vw - mw) / 2 : -Math.max(0, Math.min(mw - vw, G.hero.x * T + T / 2 - vw / 2));
    var cy = mh <= vh ? (vh - mh) / 2 : -Math.max(0, Math.min(mh - vh, G.hero.y * T + T / 2 - vh / 2));
    $('#map').style.transform = 'translate(' + Math.round(cx) + 'px,' + Math.round(cy) + 'px)';
  }

  // ---------- panels ----------

  function renderHud() {
    var G = S.game, h = G.hero;
    $('#hp-fill').style.width = Math.max(0, h.hp / h.max * 100) + '%';
    $('#hp-text').textContent = h.hp + ' / ' + h.max;
    $('.hpstat').classList.toggle('low', h.hp <= h.max * 0.3);
    $('#atk').textContent = h.atk;
    $('#def').textContent = h.def;
    $('#lvl').textContent = h.lvl;
    $('#xp-text').textContent = h.xp + ' / ' + G.xpNeeded() + ' XP';
    $('#xp-fill').style.width = (h.xp / G.xpNeeded() * 100) + '%';
    $('#coffee').textContent = h.potions;
    $('#cash').textContent = '$' + h.cash.toLocaleString('en-US');
    $('#cell').textContent = addr(h.x, h.y);
    $('#btn-drink').disabled = h.potions <= 0 || G.over || h.hp >= h.max;
    $('#tabs').innerHTML = G.cfg.tabs.map(function (name, i) {
      return '<span class="tab' + (i === G.floor ? ' on' : i < G.floor ? ' done' : ' locked') + '">' + (i < G.floor ? '&#10003; ' : '') + name + (i === G.cfg.tabs.length - 1 ? ' (boss)' : '') + '</span>';
    }).join('');
  }

  function monsterAtVisible(x, y) {
    var G = S.game, m = G.monsterAt(x, y);
    return m && G.visible(x, y) ? m : null;
  }

  function renderWho() {
    var G = S.game, h = G.hero, out = '', target = null, item = null;
    if (S.hover) {
      target = monsterAtVisible(S.hover.x, S.hover.y);
      var hi = X.idx(S.hover.x, S.hover.y);
      if (!target && G.seen[hi] && G.items[hi]) item = G.items[hi];
    }
    if (!target && !item) {
      G.monsters.forEach(function (m) {
        if (m.hp > 0 && Math.abs(m.x - h.x) + Math.abs(m.y - h.y) === 1 && (!target || m.hp < target.hp)) target = m;
      });
    }
    if (target) {
      var hits = Math.max(1, target.atk - h.def);
      var you = Math.max(1, h.atk - (target.def || 0));
      var art = target.boss ? '<div class="who-face">' + A.face(G.level, 'smug') + '</div>' : SP.wrap(SP.monster(target.id, true), 'who-spr');
      out = '<div class="who-top">' + art + '<div><span class="who-name">' + A.esc(target.name) + '</span><span class="who-trait">' + (target.boss ? TRAIT.boss : TRAIT[target.id]) + '</span></div></div>' +
        '<div class="who-hp"><i style="width:' + (target.hp / target.max * 100) + '%"></i><span>' + target.hp + ' / ' + target.max + ' HP</span></div>' +
        '<p class="who-math">It hits you for about <b>' + hits + '</b>. You hit it for about <b>' + you + '</b>, so roughly <b>' + Math.ceil(target.hp / you) + '</b> bonk' + (Math.ceil(target.hp / you) === 1 ? '' : 's') + ' to fix it.</p>';
    } else if (item) {
      var info = ITEM_INFO[item.kind];
      var name = item.kind === 'stairs' ? 'Door to sheet ' + G.cfg.tabs[G.floor + 1] : item.kind === 'cash' ? '$' + item.amount : info[0];
      out = '<div class="who-top">' + SP.wrap(SP.item(item.kind), 'who-spr') + '<div><span class="who-name">' + A.esc(name) + '</span><span class="who-trait">' + info[1] + '</span></div></div>';
    } else {
      out = '<div class="who-top">' + SP.wrap(SP.hero(), 'who-spr') + '<div><span class="who-name">You</span><span class="who-trait">Sheet ' + G.cfg.tabs[G.floor] + ', cell ' + addr(h.x, h.y) + '.</span></div></div>' +
        '<p class="who-math">Point at anything on the sheet to see what it is. Bump into an error to bonk it.</p>';
    }
    $('#who').innerHTML = out;
  }

  function renderLog() {
    var G = S.game;
    if (G.log.length > S.shownLog) {
      G.log.slice(S.shownLog).forEach(function (m) { S.log.unshift(m); });
      S.shownLog = G.log.length;
      S.log = S.log.slice(0, 6);
    }
    $('#log').innerHTML = S.log.length ? S.log.map(function (m, i) { return '<li class="' + (i === 0 ? 'new' : '') + '">' + A.esc(m) + '</li>'; }).join('') : '<li>Use the arrow keys to explore.</li>';
  }

  function renderNote() {
    var G = S.game, note = $('#note');
    if (!(S.intro && G.turn === 0 && G.floor === 0)) { note.hidden = true; return; }
    var L = A.LEVEL_MAP[S.level];
    note.innerHTML = '<div class="note-face">' + A.face(S.level, S.level === 'edith' ? 'happy' : 'calm') + '</div><div><b>' + L.name + ' says:</b> ' + A.esc(INTRO[S.level]) + '</div>';
    note.hidden = false;
  }

  function render() {
    renderTiles();
    renderEnts();
    renderFx();
    renderHud();
    renderWho();
    renderLog();
    renderNote();
    camera();
  }

  // ---------- turns ----------

  function act(fn) {
    var G = S.game;
    if (!G || G.over || A.modalOpen() || A.isBoss()) return;
    var floor = G.floor, hp = G.hero.hp, lvl = G.hero.lvl;
    var used = fn(G);
    if (used) S.intro = false;
    if (G.floor !== floor) {
      A.jingle('good');
      S.ents = {};
      $('#ents').innerHTML = '';
      var map = $('#map');
      map.classList.add('enter');
      sc.timeout(function () { map.classList.remove('enter'); }, 400);
    } else if (G.hero.lvl !== lvl) A.jingle('good');
    else if (G.hero.hp < hp) A.tone(180, 0.08, 'square', 0.03);
    else if (used) A.tone(640, 0.02, 'triangle', 0.015);
    render();
    if (G.over) sc.timeout(endGame, 500);
  }

  function move(d) {
    var G = S.game;
    if (!G) return;
    if (d === 1) S.face = 1;
    if (d === 3) S.face = -1;
    var tx = G.hero.x + X.DIRS[d][0], ty = G.hero.y + X.DIRS[d][1];
    var attacking = !!G.monsterAt(tx, ty);
    act(function (g) { return g.move(d); });
    if (attacking && S.ents.hero) {
      var he = S.ents.hero.querySelector('.hero-in');
      he.style.setProperty('--bx', (X.DIRS[d][0] * 10) + 'px');
      he.style.setProperty('--by', (X.DIRS[d][1] * 10) + 'px');
      he.classList.remove('bonk'); void he.offsetWidth; he.classList.add('bonk');
    }
  }

  function newGame() {
    A.closeModal(true);
    S.game = new X.Game(S.level, (Math.random() * 1e9) >>> 0);
    S.intro = true;
    S.shownLog = 0;
    S.log = [];
    S.ents = {};
    $('#ents').innerHTML = '';
    render();
  }

  function endGame() {
    var G = S.game, h = G.hero, L = A.LEVEL_MAP[S.level];
    // leaderboard: coins found, 100 per hero level, 150 per sheet reached, 600 for beating the boss plus 4 per HP left
    var won = G.result === 'win';
    var base = h.cash + 100 * h.lvl + 150 * G.floor + (won ? 600 + 4 * h.hp : 0);
    A.account.submit(GAME, S.level, A.points(S.level, base), won ? 'Beat ' + L.name + ', level ' + h.lvl : 'Knocked out on sheet ' + (G.floor + 1));
    if (G.result === 'win') {
      var ratio = h.hp / h.max;
      var stars = ratio >= 0.5 ? 3 : ratio >= 0.2 ? 2 : 1;
      var rec = A.record(GAME, S.level, { stars: stars, score: h.cash, lowerIsBetter: false, text: '$' + h.cash + ' found, level ' + h.lvl });
      bar.refresh();
      A.jingle('win');
      var order = ['pip', 'gridlock', 'monolith', 'edith'];
      var next = order[order.indexOf(S.level) + 1];
      var buttons = [];
      if (next) buttons.push({ label: 'Next boss: ' + A.LEVEL_MAP[next].name, kind: 'main', onClick: function () { bar.setLevel(next); S.level = next; newGame(); } });
      buttons.push({ label: 'New dungeon', kind: next ? 'line' : 'main', onClick: newGame });
      A.modal({
        title: S.level === 'edith' ? 'You beat Edith!' : 'Every sheet fixed!',
        tone: 'win',
        html: '<p class="lead">You beat ' + L.name + ' with ' + h.hp + ' of ' + h.max + ' HP left, at level ' + h.lvl + ', and found $' + h.cash.toLocaleString('en-US') + ' on the way.</p>' +
          A.stars(stars) + '<p><strong>' + (rec.better ? 'New best for this boss!' : 'Your best: ' + rec.prev.text + '.') + '</strong></p>' +
          (stars < 3 ? '<p class="soft">3 stars means finishing with at least half your health.</p>' : ''),
        buttons: buttons
      });
    } else {
      A.jingle('lose');
      A.modal({
        title: 'Knocked out!',
        tone: 'lose',
        html: '<p class="lead">You ran out of health on sheet ' + G.cfg.tabs[G.floor] + ' at level ' + h.lvl + '. ' + A.esc(G.log[G.log.length - 1] || '') + '</p>' +
          '<p class="soft">Tips: fight in narrow corridors so only one error can reach you. Let awake errors walk to you. Save some coffee for ' + L.name + ' on the last sheet.</p>',
        buttons: [{ label: 'Try a new dungeon', kind: 'main', onClick: newGame }],
        link: { label: 'Close and look around' }
      });
    }
  }

  // ---------- help ----------

  function openHelp() {
    var rows = ['pip', 'gridlock', 'monolith', 'edith'].map(function (id) {
      var L = A.LEVEL_MAP[id], c = X.LEVELS[id];
      return '<div><dt>' + L.name + ', ' + L.rank.toLowerCase() + '</dt><dd>' + c.tabs.length + ' sheets, tougher errors each time' +
        (id === 'edith' ? ', less coffee, and Edith sometimes hits twice' : '') + '. ' + L.name + ' is the boss on the last sheet.</dd></div>';
    }).join('');
    var icon = function (svg) { return '<span class="help-ic">' + SP.wrap(svg) + '</span>'; };
    A.modal({
      title: 'How to play',
      wide: true,
      html:
        '<p>The spreadsheets are crawling with errors. Explore each sheet, bonk the errors, and beat the boss on the last sheet.</p>' +
        '<ul class="legend">' +
        '<li>' + icon(SP.hero()) + '<span><b>You.</b> Move with the arrow keys or WASD. Walk into an error to bonk it.</span></li>' +
        '<li>' + icon(SP.monster('invoice', true)) + '<span><b>Errors.</b> The number above each one is its health. Every time you move, awake errors move too.</span></li>' +
        '<li>' + icon(SP.item('potion')) + '<span><b>Coffee.</b> Pick it up, then press Q to drink it and heal.</span></li>' +
        '<li>' + icon(SP.item('atk')) + icon(SP.item('def')) + '<span><b>Stapler and shield.</b> +1 attack and +1 defense.</span></li>' +
        '<li>' + icon(SP.item('stairs')) + '<span><b>Door.</b> Takes you to the next sheet.</span></li></ul>' +
        '<p>Fixing errors earns XP. Each level up gives you more health and attack.</p>' +
        '<h3>Levels</h3><dl>' + rows + '</dl>' +
        '<h3>Keys</h3><table class="keys"><tr><td><kbd>&uarr;</kbd> <kbd>&darr;</kbd> <kbd>&larr;</kbd> <kbd>&rarr;</kbd> or <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd></td><td>Move or bonk</td></tr>' +
        '<tr><td><kbd>Space</kbd></td><td>Wait a turn</td></tr><tr><td><kbd>Q</kbd></td><td>Drink a coffee</td></tr><tr><td><kbd>N</kbd></td><td>New dungeon</td></tr>' +
        '<tr><td><kbd>B</kbd></td><td>Panic button</td></tr></table>',
      buttons: [{ label: 'Let\'s go', kind: 'main' }]
    });
  }

  // ---------- wiring ----------

  var bar = A.mountBar({
    el: $('#bar'),
    game: GAME,
    title: 'Excel Dungeon',
    tagline: 'Bonk the errors. Grab the coffee.',
    level: S.level,
    levelLabel: 'Boss',
    canSwitch: function (id) {
      var G = S.game;
      return G && !G.over && G.turn > 10 ? 'This dungeon will be lost.' : true;
    },
    onLevel: function (id) { S.level = id; newGame(); },
    onHelp: openHelp
  });
  sc.add(bar.destroy);

  $('#ic-heart').innerHTML = '<svg viewBox="0 0 24 24"><path d="M12 21 C 4 15 2 11 2 7.5 A5 5 0 0 1 12 5.5 A5 5 0 0 1 22 7.5 C22 11 20 15 12 21 Z" fill="#E8504A" stroke="#1D1A33" stroke-width="2"/></svg>';
  $('#ic-atk').innerHTML = SP.wrap(SP.item('atk'));
  $('#ic-def').innerHTML = SP.wrap(SP.item('def'));
  $('#ic-coffee').innerHTML = SP.wrap(SP.item('potion'));
  $('#ic-cash').innerHTML = SP.wrap(SP.item('cash'));

  $('#btn-drink').addEventListener('click', function () { act(function (G) { return G.drink(); }); });
  $('#btn-new').addEventListener('click', function () {
    var G = S.game;
    if (!(G && !G.over && G.turn > 10)) return newGame();
    A.confirm({ title: 'New dungeon?', text: 'This dungeon and everything you found in it will be lost.', yes: 'Start fresh', no: 'Keep exploring', onYes: newGame });
  });
  Array.prototype.forEach.call(document.querySelectorAll('.pb'), function (b) {
    b.addEventListener('click', function () {
      if (b.dataset.d === 'wait') act(function (G) { return G.wait(); });
      else move(Number(b.dataset.d));
    });
  });

  var KEYS = { arrowup: 0, w: 0, arrowright: 1, d: 1, arrowdown: 2, s: 2, arrowleft: 3, a: 3 };
  sc.on(document, 'keydown', function (e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    var k = e.key.toLowerCase();
    if (k in KEYS) { e.preventDefault(); move(KEYS[k]); return; }
    if (k === ' ' || k === '.') { e.preventDefault(); act(function (G) { return G.wait(); }); return; }
    if (k === 'q') { act(function (G) { return G.drink(); }); return; }
    if (k === 'n') { $('#btn-new').click(); return; }
    if (k === '?') openHelp();
  });

  function sizeTiles() {
    var view = $('#view');
    S.T = view.clientHeight < 430 || window.innerWidth < 700 ? 32 : view.clientHeight >= 520 && view.clientWidth >= 800 ? 48 : 40;
    document.documentElement.style.setProperty('--t', S.T + 'px');
    if (S.game) {
      Object.keys(S.ents).forEach(function (k) { S.ents[k].remove(); });
      S.ents = {};
      render();
    }
  }
  var rt = null;
  sc.on(window, 'resize', function () { clearTimeout(rt); rt = sc.timeout(sizeTiles, 100); });
  sc.add(function () { document.documentElement.style.removeProperty('--t'); });

  buildTiles();
  newGame();
  sizeTiles();
  if (A.firstVisit(GAME)) openHelp();

  window.excelDungeon = { state: S, newGame: newGame };
  return sc.dispose;
}
