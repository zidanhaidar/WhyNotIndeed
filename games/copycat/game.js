/*
 * Copycat: the dance floor, your moves, the robot's late copies, and the end screen.
 * mount() runs after window.Arcade is ready (components/PageShell.jsx) and returns a cleanup function.
 */
import E from './engine.js';

export function mount() {
  var A = window.Arcade;
  var sc = A.scope();
  var GAME = 'copycat';
  var W = E.W, H = E.H, CS = 60;
  var NS = 'http://www.w3.org/2000/svg';
  var ORDER = ['pip', 'gridlock', 'monolith', 'edith'];
  var ARROW = { up: '↑', right: '→', down: '↓', left: '←', stay: '•' };
  var KEYS = { arrowup: 'up', w: 'up', arrowright: 'right', d: 'right', arrowdown: 'down', s: 'down', arrowleft: 'left', a: 'left', ' ': 'stay', '.': 'stay' };

  function $(s) { return document.querySelector(s); }

  var S = { level: A.lastLevel(GAME), game: null, busy: false, lastLine: '' };

  var TALK = {
    pip: {
      blurb: 'Copies your moves two to four beats late and gets a quarter of them wrong. Its paint roller is two tiles wide.',
      start: ['Ooh, a dance-off! I will copy everything. Probably.', 'You lead, I follow! Wait, which way was that?', 'I love this song!'],
      steal: ['Mine now! I think.', 'Ooh, pretty tile.'], drop: ['Wheee! Where did the floor go?', 'Ow. That was a hole.'],
      youDrop: ['Ha! You fell in!', 'Careful, there is a hole there. Was. Is.'], skip: [],
      win: ['You out-danced me? Again?'], lose: ['I won? I just copied you!']
    },
    gridlock: {
      blurb: 'Copies every move exactly three beats late. Its paint roller is three tiles wide.',
      start: ['Three beats behind. Every time. Precisely.', 'Your moves, my timing.', 'Dancing is just repeating, with style.'],
      steal: ['Tile reassigned.', 'Overwritten.'], drop: ['Trapdoor. Not in the routine.', 'Rhythm lost.'],
      youDrop: ['You missed a step.', 'Trapdoor: one. Dancer: zero.'], skip: [],
      win: ['Precision was not enough.'], lose: ['Repetition wins again.']
    },
    monolith: {
      blurb: 'Copies two beats late, picks the better of your last two moves, and can freeze three times to dodge trouble.',
      start: ['I only copy your good moves.', 'Two beats behind, and I choose which ones.', 'Your dance teaches me everything.'],
      steal: ['Your tile, my color.', 'Borrowed. Permanently.'], drop: ['A trap I did not see. Noted.', 'Hm. The floor moved.'],
      youDrop: ['A careless step.', 'The floor punishes hurry.'], skip: ['Not that move. I will wait.', 'I see the trap. Pausing.'],
      win: ['You led me into my own trap.'], lose: ['I copied the best of you.']
    },
    edith: {
      blurb: 'Picks her favorite of your last four moves, two beats late, freezes twice to dodge trouble, and paints three tiles wide.',
      start: ['Hi! I pick my favorite of your last four moves. Hee hee.', 'Dance-off! Edith never misses a beat.', 'Lead the way! I will take the good parts.'],
      steal: ['Thank you for this tile!', 'Mine, mine, mine!'], drop: ['Hey! Who opened that?!', 'Edith does not fall. Edith slipped.'],
      youDrop: ['Oopsie! Watch your feet!', 'Hee hee, bye bye!'], skip: ['Nope! Not that one.', 'Edith sees the hole. Edith waits.'],
      win: ['Edith lost a dance-off?! Rematch. Now.'], lose: ['Edith wins! You had good moves. I used them.']
    }
  };

  function pick(arr) {
    if (!arr || !arr.length) return '';
    var c = arr.filter(function (l) { return l !== S.lastLine; });
    c = c.length ? c : arr;
    return c[Math.floor(Math.random() * c.length)];
  }
  function L() { return A.LEVEL_MAP[S.level]; }
  function cfg() { return E.LEVELS[S.level]; }

  function say(text, mood) {
    if (!text) return;
    S.lastLine = text;
    var b = $('#bubble');
    b.textContent = text;
    b.classList.remove('pop');
    void b.offsetWidth;
    b.classList.add('pop');
    if (mood) setFace(mood);
  }
  function setFace(mood) {
    var f = $('#face');
    if (f.dataset.mood !== mood || f.dataset.level !== S.level) {
      f.innerHTML = A.face(S.level, mood);
      f.dataset.mood = mood;
      f.dataset.level = S.level;
    }
  }

  function sfx(kind, beat) {
    var scale = [523, 587, 659, 784, 880, 1046];
    switch (kind) {
      case 'step': A.tone(scale[(beat || 0) % scale.length], 0.07, 'triangle', 0.04); break;
      case 'bot': A.tone(scale[(beat || 0) % scale.length] / 2, 0.07, 'square', 0.02); break;
      case 'steal': A.tone(700, 0.08, 'sawtooth', 0.025, 0, 1100); break;
      case 'bump': A.tone(120, 0.1, 'square', 0.04); A.noise(0.06, 0.04, 0, 300); break;
      case 'drop': A.tone(600, 0.45, 'sine', 0.05, 0, 90); A.noise(0.3, 0.04, 0.1, 500); break;
      case 'skip': A.tone(400, 0.05, 'triangle', 0.03); A.tone(400, 0.05, 'triangle', 0.03, 0.08); break;
    }
  }

  // ---------- the floor ----------

  var svg = $('#floor');
  var layers = {}, tiles = [], dancers = {};

  function el(tag, attrs, parent) {
    var n = document.createElementNS(NS, tag);
    Object.keys(attrs || {}).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    if (parent) parent.appendChild(n);
    return n;
  }

  function propArt(x, y) {
    var k = (x * 7 + y * 3) % 3;
    if (k === 0) {
      return '<rect x="8" y="5" width="44" height="50" rx="7" fill="#1D1A33" stroke="#000" stroke-width="2"/>' +
        '<circle cx="30" cy="20" r="8" fill="#3A3460" stroke="#FF7AC8" stroke-width="2.5"/><circle cx="30" cy="40" r="11" fill="#3A3460" stroke="#FF7AC8" stroke-width="2.5"/>' +
        '<circle cx="30" cy="40" r="4" fill="#FF7AC8"/>';
    }
    if (k === 1) {
      return '<rect x="20" y="34" width="20" height="20" rx="4" fill="#B2643A" stroke="#1D1A33" stroke-width="2.5"/>' +
        '<g fill="#3CB371" stroke="#1D1A33" stroke-width="2"><ellipse cx="22" cy="24" rx="7" ry="13" transform="rotate(-25 22 24)"/><ellipse cx="38" cy="24" rx="7" ry="13" transform="rotate(25 38 24)"/><ellipse cx="30" cy="20" rx="6" ry="14"/></g>';
    }
    return '<rect x="26" y="34" width="8" height="20" fill="#9AA3AD" stroke="#1D1A33" stroke-width="2"/>' +
      '<circle cx="30" cy="24" r="16" fill="#D7DCE4" stroke="#1D1A33" stroke-width="2.5"/>' +
      '<path d="M14 24 h32 M30 8 v32 M18 14 h24 M18 34 h24" stroke="#9AA3AD" stroke-width="1.6"/><circle cx="24" cy="18" r="3" fill="#fff"/>';
  }

  function youArt() {
    return '<ellipse cx="0" cy="20" rx="17" ry="5" fill="#000" opacity=".3"/><g class="bob">' +
      '<circle r="19" fill="#FF6B57" stroke="#1D1A33" stroke-width="3"/>' +
      '<path d="M-17 -6 a17 17 0 0 1 34 0" fill="none" stroke="#1D1A33" stroke-width="4"/><rect x="-21" y="-8" width="7" height="12" rx="3" fill="#3D86F0" stroke="#1D1A33" stroke-width="2"/><rect x="14" y="-8" width="7" height="12" rx="3" fill="#3D86F0" stroke="#1D1A33" stroke-width="2"/>' +
      '<circle cx="-6" cy="0" r="2.6" fill="#1D1A33"/><circle cx="6" cy="0" r="2.6" fill="#1D1A33"/><path d="M-6 7 q6 6 12 0" fill="none" stroke="#1D1A33" stroke-width="2.4" stroke-linecap="round"/></g>';
  }
  function botArt() {
    var Lv = L();
    return '<ellipse cx="0" cy="21" rx="18" ry="5" fill="#000" opacity=".3"/><g class="bob">' +
      '<rect x="-21" y="-19" width="42" height="40" rx="10" fill="' + Lv.color + '" stroke="#1D1A33" stroke-width="3"/>' +
      A.face(S.level, 'smug').replace('<svg ', '<svg x="-18" y="-16" width="36" height="30.9" ') + '</g>';
  }

  function center(x, y) { return [x * CS + CS / 2, y * CS + CS / 2]; }

  function buildFloor() {
    var g = S.game;
    svg.setAttribute('viewBox', '0 0 ' + W * CS + ' ' + H * CS);
    svg.innerHTML = '<defs><pattern id="bot-stripes" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">' +
      '<rect width="4" height="10" fill="rgba(29,26,51,.28)"/></pattern></defs>';
    ['tiles', 'marks', 'traps', 'props', 'ghost', 'dancers', 'hit'].forEach(function (k) { layers[k] = el('g', {}, svg); });
    tiles = [];
    for (var y = 0; y < H; y++) {
      for (var x = 0; x < W; x++) {
        var i = E.idx(x, y);
        tiles[i] = el('rect', { x: x * CS + 2, y: y * CS + 2, width: CS - 4, height: CS - 4, rx: 9, class: 'tile', stroke: '#0B0820', 'stroke-width': 2 }, layers.tiles);
        if (g.prop[i]) {
          var p = el('g', { transform: 'translate(' + x * CS + ' ' + y * CS + ')' }, layers.props);
          p.innerHTML = propArt(x, y);
        }
        var hit = el('rect', { x: x * CS, y: y * CS, width: CS, height: CS, fill: 'transparent', class: 'hit' }, layers.hit);
        hit.dataset.x = x;
        hit.dataset.y = y;
      }
    }
    dancers.you = el('g', { class: 'dancer' }, layers.dancers);
    dancers.you.innerHTML = youArt();
    dancers.bot = el('g', { class: 'dancer' }, layers.dancers);
    dancers.bot.innerHTML = botArt();
    placeDancer('you', g.you.x, g.you.y, true);
    placeDancer('bot', g.bot.x, g.bot.y, true);
  }

  function placeDancer(who, x, y, instant) {
    var d = dancers[who], c = center(x, y);
    var prev = d.dataset.pos ? d.dataset.pos.split(',').map(Number) : null;
    var wrap = instant || !prev || Math.abs(prev[0] - x) > 1 || Math.abs(prev[1] - y) > 1;
    d.classList.toggle('wrap', wrap);
    d.style.transform = 'translate(' + c[0] + 'px, ' + c[1] + 'px)';
    d.style.setProperty('--at', 'translate(' + c[0] + 'px, ' + c[1] + 'px)');
    d.dataset.pos = x + ',' + y;
  }

  function renderTiles(flash) {
    var g = S.game, Lv = L();
    for (var i = 0; i < W * H; i++) {
      if (g.prop[i]) { tiles[i].setAttribute('fill', '#3A3460'); continue; }
      var x = i % W, y = (i / W) | 0, o = g.owner[i];
      tiles[i].setAttribute('fill', o === 1 ? '#FF6B57' : o === 2 ? Lv.color : ((x + y) % 2 ? '#2A2360' : '#322A6E'));
      if (flash && flash[i]) { tiles[i].classList.remove('flash'); void tiles[i].getBoundingClientRect(); tiles[i].classList.add('flash'); }
    }
    // the robot's tiles get stripes, so they never depend on color alone
    var marks = '';
    for (var mi = 0; mi < W * H; mi++) {
      if (g.owner[mi] !== 2 || g.prop[mi]) continue;
      marks += '<rect x="' + ((mi % W) * CS + 2) + '" y="' + (((mi / W) | 0) * CS + 2) + '" width="' + (CS - 4) + '" height="' + (CS - 4) + '" rx="9" fill="url(#bot-stripes)"/>';
    }
    layers.marks.innerHTML = marks;
    // trapdoors: an open hole, or a closed hatch, each with the beats until it changes
    var out = '';
    for (var j = 0; j < W * H; j++) {
      if (g.trap[j] < 0) continue;
      var tx = (j % W) * CS, ty = ((j / W) | 0) * CS, open = g.isOpen(j, g.turn), n = g.trapCountdown(j, g.turn);
      if (open) {
        out += '<rect x="' + (tx + 8) + '" y="' + (ty + 8) + '" width="' + (CS - 16) + '" height="' + (CS - 16) + '" rx="10" fill="#07051A" stroke="#FFC93C" stroke-width="3" stroke-dasharray="6 4"/>' +
          '<circle cx="' + (tx + CS - 12) + '" cy="' + (ty + 12) + '" r="10" fill="#E5483A" stroke="#1D1A33" stroke-width="2"/>';
      } else {
        out += '<rect x="' + (tx + 10) + '" y="' + (ty + 10) + '" width="' + (CS - 20) + '" height="' + (CS - 20) + '" rx="6" fill="none" stroke="rgba(255,255,255,.55)" stroke-width="2.5"/>' +
          '<path d="M' + (tx + 14) + ' ' + (ty + 14) + ' L' + (tx + CS - 14) + ' ' + (ty + CS - 14) + '" stroke="rgba(255,255,255,.35)" stroke-width="2"/>' +
          '<circle cx="' + (tx + CS - 12) + '" cy="' + (ty + 12) + '" r="10" fill="' + (n === 1 ? '#FFC93C' : '#2FBF71') + '" stroke="#1D1A33" stroke-width="2"/>';
      }
      out += '<text class="trap-num" x="' + (tx + CS - 12) + '" y="' + (ty + 16.5) + '" text-anchor="middle">' + n + '</text>';
    }
    layers.traps.innerHTML = out;
  }

  // Arrows showing what the robot may do next.
  function renderGhost() {
    var g = S.game, layer = layers.ghost;
    layer.innerHTML = '';
    if (g.over) return;
    var next = g.upcoming(1)[0] || [], c = center(g.bot.x, g.bot.y), seen = {};
    next.forEach(function (m) {
      var key = m == null ? '?' : m;
      if (seen[key]) return;
      seen[key] = true;
      if (m == null || m === 'stay') {
        el('circle', { cx: c[0], cy: c[1], r: 27, fill: 'none', stroke: '#FF7AC8', 'stroke-width': 3, 'stroke-dasharray': '5 5', class: 'ghost-arrow' }, layer);
        return;
      }
      var v = E.STEP[m], ax = c[0] + v[0] * 34, ay = c[1] + v[1] * 34;
      var ang = Math.atan2(v[1], v[0]) * 180 / Math.PI;
      var arrow = el('g', { transform: 'translate(' + ax + ' ' + ay + ') rotate(' + ang + ')', class: 'ghost-arrow' }, layer);
      arrow.innerHTML = '<path d="M-10 -9 L8 0 L-10 9 Z" fill="#FF7AC8" stroke="#1D1A33" stroke-width="2.5" stroke-linejoin="round" opacity="' + (next.length > 1 ? 0.7 : 1) + '"/>';
    });
  }

  function card(move, cls) {
    var s = document.createElement('span');
    s.className = 'tape-card ' + (cls || '');
    s.textContent = move == null ? '?' : ARROW[move];
    return s;
  }

  function renderTape() {
    var g = S.game, you = $('#tape-you'), bot = $('#tape-bot'), c = cfg();
    you.innerHTML = '';
    g.history.slice(-7).forEach(function (m, k, arr) { you.appendChild(card(m, k === arr.length - 1 ? 'new' : '')); });
    if (!g.history.length) you.innerHTML = '<span class="tape-card unknown">-</span>';
    bot.innerHTML = '';
    var up = g.upcoming(Math.max(2, c.delay[0] + 1));
    up.forEach(function (opts, j) {
      if (!opts.length) { bot.appendChild(card('stay', j === 0 ? 'next' : '')); return; }
      var uniq = opts.filter(function (m, k) { return opts.indexOf(m) === k; });
      if (uniq.length === 1) bot.appendChild(card(uniq[0], (j === 0 ? 'next' : '') + (uniq[0] == null ? ' unknown' : '')));
      else {
        var s = document.createElement('span');
        s.className = 'tape-card choice' + (j === 0 ? ' next' : '');
        s.textContent = uniq.map(function (m) { return m == null ? '?' : ARROW[m]; }).join('');
        bot.appendChild(s);
      }
    });
    $('#tape-bot-label').textContent = c.choose > 1 ? 'It picks one next' : c.delay[0] !== c.delay[1] ? 'It might repeat' : 'It repeats next';
  }

  function renderPanel() {
    var g = S.game, Lv = L(), c = cfg(), n = g.count(), floor = 0;
    for (var i = 0; i < W * H; i++) if (!g.prop[i]) floor++;
    $('#bot-name').textContent = Lv.name;
    $('#bot-rank').textContent = Lv.rank + ' copycat';
    $('#bot-short').textContent = Lv.name;
    $('#tiles-you').textContent = n.you;
    $('#tiles-bot').textContent = n.bot;
    document.querySelector('.disco').style.setProperty('--bot', Lv.color);
    $('#share-you').style.width = (100 * n.you / floor) + '%';
    $('#share-bot').style.width = (100 * n.bot / floor) + '%';
    var left = c.beats - g.turn;
    $('#beats-left').textContent = left;
    $('#beats-fill').style.width = (100 * left / c.beats) + '%';
    $('#skips').textContent = c.skips ? Lv.name + ' can still freeze ' + g.skipsLeft + ' time' + (g.skipsLeft === 1 ? '' : 's') + ' to dodge a bad move.' : '';
    var best = A.progress(GAME)[S.level];
    $('#best').textContent = best ? 'Your best against ' + Lv.name + ': ' + best.text + '.' : Lv.name + ' has never lost a dance-off to you.';
  }

  function renderTips() {
    var c = cfg(), tips = [
      'The robot repeats your moves later, from wherever it is standing. Watch "' + (c.choose > 1 ? 'It picks one next' : 'It repeats next') + '".',
      'Every tile you dance on lights up. Stepping on its tiles steals them back.',
      'Lead it into an open trapdoor and it falls back to its corner.',
      'The floor wraps around: dance off one edge and you come back on the other.',
      'Trapdoor numbers count the beats until they open or close.'
    ];
    $('#tips').innerHTML = tips.map(function (t) { return '<li>' + A.esc(t) + '</li>'; }).join('');
  }

  function renderAll() {
    renderTiles();
    renderGhost();
    renderTape();
    renderPanel();
  }

  // ---------- playing ----------

  function cue(text, bad) {
    var c = $('#cue');
    c.textContent = text;
    c.className = 'cue' + (bad ? ' bad' : '');
    c.hidden = false;
    sc.timeout(function () { c.hidden = true; }, 900);
  }

  function newGame() {
    A.closeModal(true);
    S.game = new E.Game(S.level, (Math.random() * 1e9) >>> 0);
    S.busy = false;
    S.queued = null;
    buildFloor();
    renderAll();
    renderTips();
    say(pick(TALK[S.level].start), 'smug');
    A.music.intensity(0.5);
  }

  function play(move) {
    var g = S.game;
    if (!g || g.over || A.isBoss() || A.modalOpen()) return;
    // a move pressed during the animation waits its turn instead of getting lost
    if (S.busy) { S.queued = move; return; }
    S.busy = true;
    var beat = g.turn;
    g.events.length = 0;
    g.play(move);
    var ev = g.events.slice(), T = TALK[S.level];
    var youDrop = ev.filter(function (e) { return e.type === 'drop' && e.who === 'you'; })[0];
    var botDrop = ev.filter(function (e) { return e.type === 'drop' && e.who === 'bot'; })[0];
    var flashYou = {}, flashBot = {};
    ev.forEach(function (e) {
      if (e.type === 'paint' || e.type === 'steal') (e.who === 'you' ? flashYou : flashBot)[E.idx(e.x, e.y)] = true;
    });
    // you move first
    placeDancer('you', youDrop ? youDrop.x : g.you.x, youDrop ? youDrop.y : g.you.y);
    sfx(ev.some(function (e) { return e.type === 'bump' && e.who === 'you'; }) ? 'bump' : 'step', beat);
    renderTiles(flashYou);
    // then the robot repeats an older move
    sc.timeout(function () {
      placeDancer('bot', botDrop ? botDrop.x : g.bot.x, botDrop ? botDrop.y : g.bot.y);
      var bumped = ev.some(function (e) { return e.type === 'bump' && e.who === 'bot'; });
      sfx(bumped ? 'bump' : 'bot', beat);
      renderTiles(Object.assign({}, flashYou, flashBot));
      if (ev.some(function (e) { return e.type === 'skip'; })) { sfx('skip'); say(pick(T.skip), 'smug'); }
      else if (ev.some(function (e) { return e.type === 'steal' && e.who === 'bot'; }) && Math.random() < 0.4) say(pick(T.steal), 'happy');
    }, 170);
    // then anyone on an open trapdoor falls through
    sc.timeout(function () {
      if (youDrop || botDrop) sfx('drop');
      if (youDrop) { fall('you'); cue('You fell!', true); say(pick(T.youDrop), 'happy'); }
      if (botDrop) { fall('bot'); cue(L().name + ' fell!'); say(pick(T.drop), 'panic'); faceDance(); }
    }, 330);
    sc.timeout(function () {
      if (youDrop) respawn('you');
      if (botDrop) respawn('bot');
      renderAll();
      S.busy = false;
      if (g.over) { S.queued = null; sc.timeout(endGame, 350); return; }
      if (S.queued) { var q = S.queued; S.queued = null; play(q); }
    }, youDrop || botDrop ? 760 : 360);
  }

  function fall(who) {
    var d = dancers[who];
    d.classList.remove('fall');
    void d.getBoundingClientRect();
    d.classList.add('fall');
  }
  function respawn(who) {
    var d = dancers[who], p = S.game[who];
    d.classList.remove('fall');
    placeDancer(who, p.x, p.y, true);
  }
  function faceDance() {
    var f = $('#face');
    f.classList.remove('dance');
    void f.offsetWidth;
    f.classList.add('dance');
  }

  function endGame() {
    var g = S.game, Lv = L(), T = TALK[S.level], n = g.count(), margin = n.you - n.bot, won = g.result === 'win';
    var stars = !won ? 0 : margin >= 12 ? 3 : margin >= 6 ? 2 : 1;
    var base = 12 * n.you + 40 * g.bot.drops + (won ? 500 + 30 * margin : 0);
    A.account.submit(GAME, S.level, A.points(S.level, base), n.you + ' tiles to ' + n.bot + (won ? ', won' : ', lost'));
    A.music.intensity(0.4);
    if (won) {
      var rec = A.record(GAME, S.level, { stars: stars, score: margin, lowerIsBetter: false, text: 'won by ' + margin + ' tile' + (margin === 1 ? '' : 's') });
      bar.refresh();
      A.jingle('win');
      say(pick(T.win), 'dead');
      var next = ORDER[ORDER.indexOf(S.level) + 1], buttons = [];
      if (next) buttons.push({ label: 'Next dancer: ' + A.LEVEL_MAP[next].name, kind: 'main', onClick: function () { switchTo(next); } });
      buttons.push({ label: 'Dance again', kind: next ? 'line' : 'main', onClick: newGame });
      A.modal({
        title: S.level === 'edith' ? 'You out-danced Edith!' : 'You own the floor!',
        tone: 'win',
        html: '<p class="lead">The song ends with <strong>' + n.you + ' tiles</strong> in your color and ' + n.bot + ' in ' + Lv.name + '\'s. ' +
          (g.bot.drops ? Lv.name + ' fell through a trapdoor ' + g.bot.drops + ' time' + (g.bot.drops === 1 ? '' : 's') + '.' : '') + '</p>' + A.stars(stars) +
          '<p><strong>' + (rec.better ? (rec.prev ? 'New best lead against ' + Lv.name + '!' : 'First win against ' + Lv.name + '.') : 'Your best: ' + rec.prev.text + '.') + '</strong></p>' +
          (stars < 3 ? '<p class="soft">3 stars means winning by 12 tiles or more.</p>' : ''),
        buttons: buttons
      });
    } else {
      A.jingle('lose');
      say(pick(T.lose), 'happy');
      A.modal({
        title: 'Out-copied!',
        tone: 'lose',
        html: '<p class="lead">' + Lv.name + ' ends with <strong>' + n.bot + ' tiles</strong> to your ' + n.you + '.</p>' +
          '<p class="soft">Tips: plan for the robot, not just for you. Before each move, look at where that move will send it in a few beats. ' +
          'Walk it into speakers and open trapdoors, and keep stealing back the tiles its wide roller paints.</p>',
        buttons: [{ label: 'Dance again', kind: 'main', onClick: newGame }],
        link: { label: 'Close and look at the floor' }
      });
    }
  }

  function switchTo(id) {
    S.level = id;
    bar.setLevel(id);
    newGame();
  }

  function openHelp() {
    var rows = ORDER.map(function (id) {
      var Lv = A.LEVEL_MAP[id];
      return '<div><dt>' + Lv.name + ', ' + Lv.rank.toLowerCase() + '</dt><dd>' + TALK[id].blurb + '</dd></div>';
    }).join('');
    A.modal({
      title: 'How to play',
      wide: true,
      html: '<p>A dance-off on a light-up floor. Every tile you dance on turns your color. The robot copies your moves a few beats later, from wherever it is standing, and paints with a wider roller.</p>' +
        '<ol><li>Each beat, pick a move: up, down, left, right, or stay put.</li>' +
        '<li>The tape under the floor shows your last moves and the ones the robot will repeat next.</li>' +
        '<li>Make moves that are good for you now but bad for it later: send it into speakers, plants and open trapdoors.</li>' +
        '<li>Fall through an open trapdoor and you go back to your corner. The floor wraps around at the edges.</li>' +
        '<li>Own more tiles than the robot when the song ends.</li></ol>' +
        '<h3>Dancers</h3><dl>' + rows + '</dl>' +
        '<h3>Keys</h3><table class="keys"><tr><td><kbd>&uarr;</kbd> <kbd>&darr;</kbd> <kbd>&larr;</kbd> <kbd>&rarr;</kbd> or <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd></td><td>Dance a step</td></tr>' +
        '<tr><td><kbd>Space</kbd></td><td>Stay put for a beat</td></tr><tr><td><kbd>N</kbd></td><td>New dance</td></tr>' +
        '<tr><td><kbd>M</kbd></td><td>Music on or off</td></tr><tr><td><kbd>B</kbd></td><td>Panic button</td></tr></table>',
      buttons: [{ label: 'Hit the floor', kind: 'main' }]
    });
  }

  var bar = A.mountBar({
    el: $('#bar'),
    game: GAME,
    title: 'Copycat',
    tagline: 'The robot copies your moves. A few beats late.',
    level: S.level,
    levelLabel: 'Dancer',
    canSwitch: function () { return S.game && !S.game.over && S.game.turn > 3 ? 'This dance will be abandoned.' : true; },
    onLevel: function (id) { S.level = id; newGame(); },
    onHelp: openHelp
  });
  sc.add(bar.destroy);

  svg.addEventListener('click', function (e) {
    var t = e.target.closest('.hit');
    if (!t) return;
    var g = S.game, x = Number(t.dataset.x), y = Number(t.dataset.y);
    for (var k = 0; k < E.MOVES.length; k++) {
      var m = E.MOVES[k], v = E.STEP[m];
      if ((g.you.x + v[0] + W) % W === x && (g.you.y + v[1] + H) % H === y) { play(m); return; }
    }
  });
  Array.prototype.forEach.call(document.querySelectorAll('.pad-btn'), function (b) {
    b.addEventListener('click', function () { play(b.dataset.move); });
  });
  $('#btn-new').addEventListener('click', function () {
    if (!(S.game && !S.game.over && S.game.turn > 3)) return newGame();
    A.confirm({ title: 'New dance?', text: 'This dance will be abandoned and the floor goes dark again.', yes: 'New dance', no: 'Keep dancing', onYes: newGame });
  });

  sc.on(document, 'keydown', function (e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    var k = e.key.toLowerCase();
    if (KEYS[k]) {
      if (A.modalOpen()) return;
      // Space always dances, even if a button still has focus from a click
      e.preventDefault();
      play(KEYS[k]);
      return;
    }
    if (k === 'n') { $('#btn-new').click(); return; }
    if (k === '?') openHelp();
  });

  newGame();
  if (A.firstVisit(GAME)) openHelp();

  window.copycat = { state: S, play: play, newGame: newGame };
  return sc.dispose;
}
