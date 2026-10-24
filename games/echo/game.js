/*
 * Echo: drawing the dark maze and its fading echoes, moving and pinging, the keeper's wall shifts, and the end screen.
 * mount() runs after window.Arcade is ready (components/PageShell.jsx) and returns a cleanup function.
 */
import E from './engine.js';

export function mount() {
  var A = window.Arcade;
  var sc = A.scope();
  var GAME = 'echo';
  var ORDER = ['pip', 'gridlock', 'monolith', 'edith'];
  var KEYS = { arrowup: 'up', w: 'up', arrowright: 'right', d: 'right', arrowdown: 'down', s: 'down', arrowleft: 'left', a: 'left' };
  var STEP_MS = 85;

  function $(s) { return document.querySelector(s); }

  var S = { level: A.lastLevel(GAME), maze: null, bumps: {}, ping: null, lastLine: '', dirty: true, cell: 40, pad: 16 };

  var TALK = {
    pip: {
      blurb: 'Moves a random wall now and then, anywhere in the maze. Easy to forget about.',
      start: ['Hi! It is very dark in here. I like it.', 'I move walls sometimes. For fun.', 'Can you hear me? I can hear you!'],
      shift: ['Oops, did a wall move? Sorry!', 'Clunk! That was me.', 'I rearranged something. Somewhere.'],
      bump: ['Ow! Was that you?', 'Bonk! Ha ha.'], key: ['You found one! Nice!'],
      win: ['You got out! In the dark! Wow.'], lose: ['Out of steps? Stay a while!']
    },
    gridlock: {
      blurb: 'Moves walls far from you and never the same one twice in a row.',
      start: ['Maintenance mode active.', 'The maze is being optimized. Constantly.', 'Walls are temporary. Schedules are not.'],
      shift: ['Scheduled wall maintenance.', 'Wall relocated. Carry on.', 'Optimizing corridor layout.'],
      bump: ['Collision logged.', 'That wall is load-bearing.'], key: ['Keycard located.'],
      win: ['Exit used. Unscheduled.'], lose: ['Step budget exhausted.']
    },
    monolith: {
      blurb: 'Re-walls corridors you already walked, so the way back is never the way you remember.',
      start: ['The paths you remember will betray you.', 'I rebuild what you leave behind.', 'Memory is a map that is always out of date.'],
      shift: ['Your way back just changed.', 'That corridor you liked is closed now.', 'Behind you, something moved.'],
      bump: ['Your memory was wrong.', 'Not where you thought.'], key: ['You found it. Can you find your way back?'],
      win: ['You did not rely on memory. Wise.'], lose: ['Lost in your own footsteps.']
    },
    edith: {
      blurb: 'Listens for your pings and bumps. When she hears you, she walls off the route ahead. Stay quiet and she is only guessing.',
      start: ['Hi! Edith can hear every ping. Ping ping!', 'Make some noise so Edith knows where you are! Please?', 'Shh... Edith is listening.'],
      shift: ['Edith heard that! New wall!', 'Ooh, you were going this way, weren\'t you?', 'Hee hee. Try that corridor now.'],
      bump: ['Bonk! Edith heard that!', 'Found you! Hee hee.'], key: ['Hey! That was Edith\'s favorite keycard.'],
      win: ['You escaped Edith?! In the DARK?!'], lose: ['Out of steps! Edith wins hide and seek!']
    }
  };

  function pick(arr) {
    var c = arr.filter(function (l) { return l !== S.lastLine; });
    c = c.length ? c : arr;
    return c[Math.floor(Math.random() * c.length)];
  }
  function L() { return A.LEVEL_MAP[S.level]; }
  function cfg() { return E.LEVELS[S.level]; }

  function say(text, mood) {
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
    if (f.dataset.mood === mood && f.dataset.level === S.level) return;
    f.innerHTML = A.face(S.level, mood);
    f.dataset.mood = mood;
    f.dataset.level = S.level;
  }

  function sfx(kind) {
    switch (kind) {
      case 'step': A.noise(0.05, 0.02, 0, 260, 0.8); break;
      case 'bump': A.tone(90, 0.16, 'sine', 0.12, 0, 60); A.noise(0.08, 0.05, 0, 220); break;
      case 'ping': A.tone(1180, 0.5, 'sine', 0.06, 0, 1150); A.tone(1180, 0.35, 'sine', 0.025, 0.28, 1150); A.tone(1180, 0.25, 'sine', 0.012, 0.55, 1150); break;
      case 'shift': A.tone(70, 0.4, 'square', 0.03, 0.05, 45); A.noise(0.35, 0.03, 0.05, 160, 0.5); break;
      case 'key': A.jingle('good'); break;
      case 'locked': A.tone(300, 0.1, 'square', 0.03); A.tone(260, 0.12, 'square', 0.03, 0.12); break;
      case 'empty': A.tone(220, 0.15, 'triangle', 0.03, 0, 160); break;
    }
  }

  // ---------- drawing ----------

  var cvs = $('#maze'), ctx = cvs.getContext('2d');

  function layout() {
    var m = S.maze;
    if (!m) return;
    var box = cvs.parentNode.clientWidth - 24;
    var tall = Math.max(260, window.innerHeight - 260);
    S.cell = Math.max(18, Math.min(Math.floor((box - 2 * S.pad) / m.W), Math.floor((tall - 2 * S.pad) / m.H), 58));
    var w = m.W * S.cell + 2 * S.pad, h = m.H * S.cell + 2 * S.pad, dpr = window.devicePixelRatio || 1;
    cvs.width = Math.round(w * dpr);
    cvs.height = Math.round(h * dpr);
    cvs.style.width = w + 'px';
    cvs.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    S.dirty = true;
  }

  function X(x) { return S.pad + x * S.cell; }
  function Y(y) { return S.pad + y * S.cell; }

  function wallLine(arr, i) {
    var m = S.maze, x = i % m.W, y = (i / m.W) | 0;
    return arr === 'E' ? [X(x + 1), Y(y), X(x + 1), Y(y + 1)] : [X(x), Y(y + 1), X(x + 1), Y(y + 1)];
  }

  function draw(now) {
    var m = S.maze, c = cfg(), C = S.cell;
    if (!m) return;
    var w = m.W * C + 2 * S.pad, h = m.H * C + 2 * S.pad;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#05061A';
    ctx.fillRect(0, 0, w, h);
    // faint dots so you can count cells in the dark
    ctx.fillStyle = 'rgba(166, 180, 232, .14)';
    for (var yy = 0; yy < m.H; yy++) for (var xx = 0; xx < m.W; xx++) { ctx.beginPath(); ctx.arc(X(xx + 0.5), Y(yy + 0.5), 1.4, 0, Math.PI * 2); ctx.fill(); }
    // the outer edge, always faintly there
    ctx.strokeStyle = 'rgba(79, 227, 208, .22)';
    ctx.lineWidth = 3;
    ctx.strokeRect(X(0), Y(0), m.W * C, m.H * C);

    // your footsteps
    var trail = m.trail.slice(-10);
    trail.forEach(function (ci, k) {
      ctx.fillStyle = 'rgba(255, 107, 87, ' + (0.08 + 0.32 * k / trail.length) + ')';
      ctx.beginPath();
      ctx.arc(X(ci % m.W + 0.5), Y(((ci / m.W) | 0) + 0.5), C * 0.1, 0, Math.PI * 2);
      ctx.fill();
    });

    // echoes: walls as you last heard them, fading move by move
    var pingAge = S.ping ? now - S.ping.t0 : Infinity;
    ctx.lineCap = 'round';
    Object.keys(m.memory).forEach(function (k) {
      var mem = m.memory[k];
      if (!mem.wall) return;
      var age = m.moves - mem.at, alpha = Math.max(0, 1 - age / c.fade);
      if (alpha <= 0) return;
      if (S.ping && mem.at === S.ping.moves && !S.bumps[k]) {
        var a = mem.i, b = mem.arr === 'E' ? a + 1 : a + m.W;
        var d = Math.min(S.ping.dist[a] < 0 ? 99 : S.ping.dist[a], S.ping.dist[b] < 0 ? 99 : S.ping.dist[b]);
        if (pingAge < d * STEP_MS) return;
      }
      var seg = wallLine(mem.arr, mem.i), bump = S.bumps[k] === mem.at;
      ctx.strokeStyle = bump ? 'rgba(255, 107, 87, ' + alpha + ')' : 'rgba(79, 227, 208, ' + alpha + ')';
      ctx.shadowColor = bump ? '#FF6B57' : '#4FE3D0';
      ctx.shadowBlur = 10 * alpha;
      ctx.lineWidth = Math.max(3, C * 0.12);
      ctx.beginPath();
      ctx.moveTo(seg[0], seg[1]);
      ctx.lineTo(seg[2], seg[3]);
      ctx.stroke();
    });
    ctx.shadowBlur = 0;

    // keycards and the exit you have heard about
    m.keys.forEach(function (k) {
      if (k.got || !k.known) return;
      drawKey(X(k.x + 0.5), Y(k.y + 0.5), C);
    });
    if (m.exitKnown) drawExit(X(m.exit.x + 0.5), Y(m.exit.y + 0.5), C, m.keysLeft() === 0);

    // the ping ripple
    if (S.ping && pingAge < (c.radius + 2) * STEP_MS + 300) {
      var R = (pingAge / STEP_MS) * C, fade = Math.max(0, 1 - pingAge / ((c.radius + 2) * STEP_MS + 300));
      ctx.strokeStyle = 'rgba(79, 227, 208, ' + fade * 0.7 + ')';
      ctx.lineWidth = 3;
      [0, 0.35, 0.7].forEach(function (lag) {
        var r = R - lag * C * 1.5;
        if (r <= 0) return;
        ctx.beginPath();
        ctx.arc(X(S.ping.x + 0.5), Y(S.ping.y + 0.5), r, 0, Math.PI * 2);
        ctx.stroke();
      });
    }

    // you
    var px = X(m.pos.x + 0.5), py = Y(m.pos.y + 0.5);
    var glow = ctx.createRadialGradient(px, py, 0, px, py, C * 0.9);
    glow.addColorStop(0, 'rgba(255, 107, 87, .45)');
    glow.addColorStop(1, 'rgba(255, 107, 87, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(px, py, C * 0.9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#FF6B57';
    ctx.strokeStyle = '#1D1A33';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(px, py, C * 0.26, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(px - C * 0.07, py - C * 0.08, C * 0.06, 0, Math.PI * 2); ctx.fill();
  }

  function drawKey(x, y, C) {
    var w = C * 0.56, h = C * 0.38;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-0.15);
    ctx.shadowColor = '#FFC93C';
    ctx.shadowBlur = 12;
    ctx.fillStyle = '#FFC93C';
    ctx.strokeStyle = '#1D1A33';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(-w / 2, -h / 2, w, h, 4);
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#1D1A33';
    ctx.fillRect(-w / 2 + 4, -h / 2 + 4, w * 0.3, h * 0.35);
    ctx.restore();
  }

  function drawExit(x, y, C, open) {
    var w = C * 0.52, h = C * 0.66;
    ctx.save();
    ctx.translate(x, y);
    ctx.shadowColor = open ? '#2FBF71' : '#6B7394';
    ctx.shadowBlur = 14;
    ctx.fillStyle = open ? '#2FBF71' : '#3A4166';
    ctx.strokeStyle = '#1D1A33';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(-w / 2, -h / 2, w, h, [w / 2, w / 2, 3, 3]);
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = open ? '#fff' : '#FFC93C';
    ctx.font = '700 ' + Math.round(C * 0.28) + 'px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(open ? 'EXIT' : '•••', 0, h * 0.08);
    ctx.restore();
  }

  function frame(now) {
    sc.raf(frame);
    var animating = S.ping && now - S.ping.t0 < (cfg().radius + 2) * STEP_MS + 400;
    if (S.dirty || animating) { draw(now); S.dirty = false; }
  }

  // ---------- panel ----------

  function keyIcon(got) {
    return '<svg viewBox="0 0 34 24" aria-hidden="true"><rect x="2" y="2" width="30" height="20" rx="4" fill="' + (got ? '#FFC93C' : '#E3E8F6') + '" stroke="#1D1A33" stroke-width="2.5"/>' +
      '<rect x="6" y="6" width="9" height="7" rx="1.5" fill="' + (got ? '#1D1A33' : '#B9C1DB') + '"/></svg>';
  }

  function renderPanel() {
    var m = S.maze, c = cfg(), Lv = L();
    $('#bot-name').textContent = Lv.name;
    $('#bot-rank').textContent = Lv.rank + ' maze keeper';
    $('#steps').textContent = m.stepsLeft;
    $('#steps-fill').style.width = Math.max(0, 100 * m.stepsLeft / m.budget) + '%';
    document.querySelector('.stat-bar').classList.toggle('low', m.stepsLeft < m.budget * 0.2);
    $('#pings').textContent = m.pingsLeft;
    var dots = '';
    for (var i = 0; i < c.pings; i++) dots += '<i class="' + (i < m.pingsLeft ? '' : 'used') + '"></i>';
    $('#ping-dots').innerHTML = dots;
    var got = m.keys.filter(function (k) { return k.got; }).length;
    $('#keys').textContent = got + ' of ' + m.keys.length;
    $('#keycards').innerHTML = m.keys.map(function (k) { return keyIcon(k.got); }).join('');
    $('#btn-ping').disabled = m.pingsLeft <= 0 || m.over;
    var best = A.progress(GAME)[S.level];
    $('#best').textContent = best ? 'Your best against ' + Lv.name + ': ' + best.text + '.' : 'Nobody has escaped ' + Lv.name + '\'s maze. Yet.';
  }

  function renderTips() {
    var c = cfg(), tips = [
      'Ping to hear the walls around you. The sound travels ' + c.radius + ' steps along open corridors.',
      'Echoes fade after ' + c.fade + ' moves. After that, the map lives in your head.',
      'Bumping into a wall costs a step but shows you that wall.',
      'Find ' + c.keys + ' keycards, then the exit. A ping that reaches them makes them glow for good.',
      S.level === 'edith' ? 'Edith hears your pings and bumps. Go quiet and she loses track of you.' : 'The keeper moves a wall every ' + c.shift + ' steps. Listen for the clunk.'
    ];
    $('#tips').innerHTML = tips.map(function (t) { return '<li>' + A.esc(t) + '</li>'; }).join('');
  }

  // ---------- playing ----------

  function cue(text, kind) {
    var c = $('#cue');
    c.textContent = text;
    c.className = 'cue' + (kind ? ' ' + kind : '');
    c.hidden = false;
    sc.timeout(function () { c.hidden = true; }, 1100);
  }

  function newMaze() {
    A.closeModal(true);
    S.maze = new E.Maze(S.level, (Math.random() * 1e9) >>> 0);
    S.bumps = {};
    S.ping = null;
    layout();
    renderPanel();
    renderTips();
    say(pick(TALK[S.level].start), 'smug');
    A.music.intensity(0.4);
  }

  function handle(events) {
    var m = S.maze, T = TALK[S.level];
    events.forEach(function (ev) {
      if (ev.type === 'bump') {
        sfx('bump');
        var e = m.edge(m.pos.x, m.pos.y, ev.dir);
        if (e) S.bumps[m.key(e)] = m.moves;
        var s = document.querySelector('.screen');
        s.classList.remove('bump');
        void s.offsetWidth;
        s.classList.add('bump');
        if (Math.random() < 0.4) say(pick(T.bump), 'happy');
      } else if (ev.type === 'ping') {
        sfx('ping');
        S.ping = { t0: performance.now(), x: m.pos.x, y: m.pos.y, dist: ev.dist, moves: m.moves };
        if (ev.found.length) sc.timeout(function () { sfx('key'); cue(ev.found.indexOf('exit') >= 0 && ev.found.length === 1 ? 'Exit heard!' : 'Keycard heard!', 'gold'); }, 400);
      } else if (ev.type === 'shift') {
        sfx('shift');
        say(pick(T.shift), 'smug');
      } else if (ev.type === 'key') {
        sfx('key');
        cue(ev.left ? 'Keycard! ' + ev.left + ' to go' : 'All keycards! Find the exit', 'gold');
        say(pick(T.key), 'annoyed');
      } else if (ev.type === 'locked') {
        sfx('locked');
        cue('Locked. Find every keycard first.', 'bad');
      } else if (ev.type === 'end') {
        sc.timeout(endGame, 450);
      }
    });
    if (m.stepsLeft <= 10 && !m.over) A.music.intensity(0.8);
  }

  function move(dir) {
    var m = S.maze;
    if (!m || m.over || A.isBoss() || A.modalOpen()) return;
    m.events.length = 0;
    var res = m.move(dir);
    if (res && res.moved) sfx('step');
    handle(m.events.slice());
    S.dirty = true;
    renderPanel();
  }

  function ping() {
    var m = S.maze;
    if (!m || m.over || A.isBoss() || A.modalOpen()) return;
    if (m.pingsLeft <= 0) { sfx('empty'); cue('No pings left', 'bad'); return; }
    m.events.length = 0;
    m.ping();
    handle(m.events.slice());
    S.dirty = true;
    renderPanel();
  }

  function endGame() {
    var m = S.maze, c = cfg(), Lv = L(), T = TALK[S.level], won = m.result === 'win';
    var keys = m.keys.filter(function (k) { return k.got; }).length;
    var share = m.stepsLeft / m.budget, stars = !won ? 0 : share >= 0.35 ? 3 : share >= 0.15 ? 2 : 1;
    var base = 200 * keys + (won ? 500 + 10 * m.stepsLeft + 25 * m.pingsLeft : 0);
    A.account.submit(GAME, S.level, A.points(S.level, base), won ? 'Escaped with ' + m.stepsLeft + ' steps left' : keys + ' keycards, out of steps');
    A.music.intensity(0.4);
    // light the whole maze up so you can see what really happened
    m.interiorWalls(false).forEach(function (e) { m.memory[m.key(e)] = { wall: true, at: m.moves, arr: e.arr, i: e.i }; });
    S.dirty = true;
    if (won) {
      var rec = A.record(GAME, S.level, { stars: stars, score: m.stepsLeft, lowerIsBetter: false, text: 'escaped with ' + m.stepsLeft + ' steps to spare' });
      bar.refresh();
      A.jingle('win');
      say(pick(T.win), 'dead');
      var next = ORDER[ORDER.indexOf(S.level) + 1], buttons = [];
      if (next) buttons.push({ label: 'Next keeper: ' + A.LEVEL_MAP[next].name, kind: 'main', onClick: function () { switchTo(next); } });
      buttons.push({ label: 'New maze', kind: next ? 'line' : 'main', onClick: newMaze });
      A.modal({
        title: S.level === 'edith' ? 'You escaped Edith!' : 'You got out!',
        tone: 'win',
        html: '<p class="lead">All ' + m.keys.length + ' keycards and out the door with <strong>' + m.stepsLeft + ' steps</strong> and ' + m.pingsLeft + ' ping' + (m.pingsLeft === 1 ? '' : 's') + ' to spare.</p>' + A.stars(stars) +
          '<p><strong>' + (rec.better ? (rec.prev ? 'New best escape from ' + Lv.name + '!' : 'First escape from ' + Lv.name + '.') : 'Your best: ' + rec.prev.text + '.') + '</strong></p>' +
          (stars < 3 ? '<p class="soft">3 stars means escaping with at least a third of your steps left.</p>' : ''),
        buttons: buttons,
        link: { label: 'Close and look at the maze' }
      });
    } else {
      A.jingle('lose');
      say(pick(T.lose), 'happy');
      A.modal({
        title: 'Lost in the dark.',
        tone: 'lose',
        html: '<p class="lead">You ran out of steps with ' + keys + ' of ' + m.keys.length + ' keycards. The lights are on now, so you can see the maze as it really was.</p>' +
          '<p class="soft">Tips: ping at junctions, not in long corridors. Head for keycards you have already heard, and expect the way back to have changed. ' +
          (S.level === 'edith' ? 'Every ping tells Edith where you are, so move a few steps quietly before pinging again.' : 'Count steps between pings so you remember the shape after the echo fades.') + '</p>',
        buttons: [{ label: 'Try a new maze', kind: 'main', onClick: newMaze }],
        link: { label: 'Close and look at the maze' }
      });
    }
  }

  function switchTo(id) {
    S.level = id;
    bar.setLevel(id);
    newMaze();
  }

  function openHelp() {
    var rows = ORDER.map(function (id) {
      var Lv = A.LEVEL_MAP[id], c = E.LEVELS[id];
      return '<div><dt>' + Lv.name + ', ' + Lv.rank.toLowerCase() + '</dt><dd>' + TALK[id].blurb + ' ' + c.w + ' by ' + c.h + ' maze, ' + c.keys + ' keycards, ' + c.pings + ' pings.</dd></div>';
    }).join('');
    A.modal({
      title: 'How to play',
      wide: true,
      html: '<p>The lights are out. You cannot see the maze, only hear it.</p>' +
        '<ol><li>Move with the arrow keys or WASD. Each move costs a step, and you only have so many.</li>' +
        '<li>Ping (Space) to send out a sound. For a moment you see every wall it bounces off, then the echo fades.</li>' +
        '<li>Find every keycard, then the exit.</li>' +
        '<li>The robot maze keeper moves walls while you walk, so the map in your head slowly goes out of date.</li></ol>' +
        '<h3>Maze keepers</h3><dl>' + rows + '</dl>' +
        '<h3>Keys</h3><table class="keys"><tr><td><kbd>&uarr;</kbd> <kbd>&darr;</kbd> <kbd>&larr;</kbd> <kbd>&rarr;</kbd> or <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd></td><td>Move</td></tr>' +
        '<tr><td><kbd>Space</kbd></td><td>Ping</td></tr><tr><td><kbd>N</kbd></td><td>New maze</td></tr>' +
        '<tr><td><kbd>M</kbd></td><td>Music on or off</td></tr><tr><td><kbd>B</kbd></td><td>Panic button</td></tr></table>',
      buttons: [{ label: 'Into the dark', kind: 'main' }]
    });
  }

  var bar = A.mountBar({
    el: $('#bar'),
    game: GAME,
    title: 'Echo',
    tagline: 'A dark maze. Ping to hear the walls.',
    level: S.level,
    levelLabel: 'Maze keeper',
    canSwitch: function () { return S.maze && !S.maze.over && S.maze.moves > 5 ? 'This maze will be abandoned.' : true; },
    onLevel: function (id) { S.level = id; newMaze(); },
    onHelp: openHelp
  });
  sc.add(bar.destroy);

  cvs.addEventListener('click', function (e) {
    var m = S.maze, r = cvs.getBoundingClientRect();
    var x = Math.floor((e.clientX - r.left - S.pad) / S.cell), y = Math.floor((e.clientY - r.top - S.pad) / S.cell);
    if (x === m.pos.x && y === m.pos.y) return ping();
    var dx = x - m.pos.x, dy = y - m.pos.y;
    if (Math.abs(dx) + Math.abs(dy) !== 1) return;
    move(dx === 1 ? 'right' : dx === -1 ? 'left' : dy === 1 ? 'down' : 'up');
  });
  Array.prototype.forEach.call(document.querySelectorAll('.pad-btn'), function (b) { b.addEventListener('click', function () { move(b.dataset.dir); }); });
  $('#btn-ping').addEventListener('click', ping);
  $('#btn-new').addEventListener('click', function () {
    if (!(S.maze && !S.maze.over && S.maze.moves > 5)) return newMaze();
    A.confirm({ title: 'New maze?', text: 'You will start over in a brand new maze.', yes: 'New maze', no: 'Keep exploring', onYes: newMaze });
  });

  sc.on(document, 'keydown', function (e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    var k = e.key.toLowerCase();
    if (KEYS[k]) { e.preventDefault(); move(KEYS[k]); return; }
    if (k === ' ') {
      if (A.modalOpen()) return;
      // Space always pings, even if a button still has focus from a click
      e.preventDefault();
      ping();
      return;
    }
    if (k === 'n') { $('#btn-new').click(); return; }
    if (k === '?') openHelp();
  });
  var rt = 0;
  sc.on(window, 'resize', function () { clearTimeout(rt); rt = sc.timeout(layout, 80); });

  newMaze();
  sc.raf(frame);
  if (A.firstVisit(GAME)) openHelp();

  window.echoGame = { state: S, move: move, ping: ping, newMaze: newMaze };
  return sc.dispose;
}
