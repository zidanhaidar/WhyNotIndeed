/*
 * Minesweeper: drawing the field, digging, flagging and chording (mouse, touch and keys), the robot's race on its
 * own copy, and the end screen. mount() runs after window.Arcade is ready (components/PageShell.jsx) and returns a
 * cleanup function.
 */
import MS from './engine.js';

export function mount() {
  var A = window.Arcade;
  var sc = A.scope();
  var GAME = 'minesweeper';
  var ORDER = ['pip', 'gridlock', 'monolith', 'edith'];
  var HOLD_MS = 380;

  function $(s) { return document.querySelector(s); }

  var S = { level: A.lastLevel(GAME), g: null, paused: false, acc: 0, lastFrame: 0, cur: 0, flagMode: false, endShown: false,
    cueUntil: 0, lastLine: '', said: 0, shownSec: -1, robotShown: -1, hold: null, held: false, pointer: 'mouse' };

  var TALK = {
    pip: {
      blurb: 'Sweeps slowly and sometimes clicks a square without thinking at all. Now and then it blows itself up.',
      start: ['Hi! Mines are like presents, right? You open them!', 'I\'ll click this one! No wait. This one!', 'Let\'s find all the safe squares! I mean, I think they\'re safe.'],
      progress: ['I opened a big empty bit! Wheee!', 'Is a 3 bad? It sounds bad.', 'Halfway! Or a bit less. Or more!', 'Flag, flag, flag! I like flags.'],
      boom: ['BOOM! Oh. Oh no. I\'m out, aren\'t I?'], flag: ['Ooh, a flag! Pretty.'],
      win: ['You did it! You\'re a real mine sweeper!'], lose: ['I finished! And I didn\'t even explode!'], mine: ['BOOM! Was that you? I heard a boom!']
    },
    gridlock: {
      blurb: 'Steady and careful. Never guesses, opens what the numbers allow, at a calm and constant pace.',
      start: ['Field loaded. Commencing sweep.', 'Mines are just numbers that have not been counted.', 'Safety procedure: think, then click.'],
      progress: ['Sector cleared.', 'Number satisfied. Neighbours opened.', 'Sweep on schedule.', 'Flag placed. Proceeding.'],
      boom: ['Unexpected detonation.'], flag: ['Mine marked. Correctly, I hope.'],
      win: ['Field cleared before mine. Noted.'], lose: ['Field cleared. All units safe.'], mine: ['Detonation detected. Your sweep has ended.']
    },
    monolith: {
      blurb: 'Fast, sees the clever patterns (a 1 inside a 2 next door) and barely bothers to plant flags.',
      start: ['Every number is a promise. I keep count.', 'Sixteen by sixteen. Forty secrets.', 'Shall we see whose nerves are steadier?'],
      progress: ['The ones and twos told me everything.', 'A whole region, open. As expected.', 'The edge is safe. Of course it is.', 'Few mines remain. I know where.'],
      boom: ['Impossible.'], flag: ['A flag is a doubt written down.'],
      win: ['You read the field faster than I did. Rare.'], lose: ['The last safe square is mine.'], mine: ['A guess, and a boom. Predictable.']
    },
    edith: {
      blurb: 'The fastest sweeper in the office, with four extra mines. Never guesses, never slips, never plants a flag if she can help it.',
      start: ['Hi! Edith can see the mines! No she can\'t. Or can she?', 'Ready, set, Edith wins! Hee hee.', 'Edith counted to eight really fast!'],
      progress: ['Click click click! Edith is zooming!', 'Edith opened a whole field! Did you?', 'Almost done! Edith is so fast!', 'Edith never flags. Flags are for slowpokes!'],
      boom: ['That was not Edith! Edith never explodes!'], flag: ['A flag! Cute! Slow, but cute.'],
      win: ['WHAT?! You swept faster than Edith?! Rematch!'], lose: ['Done! Edith wins! Want a little flag as a prize?'], mine: ['Boom! Edith heard that one from here!']
    }
  };

  function pick(arr) {
    var c = arr.filter(function (l) { return l !== S.lastLine; });
    c = c.length ? c : arr;
    return c[Math.floor(Math.random() * c.length)];
  }
  function L() { return A.LEVEL_MAP[S.level]; }
  function cfg() { return MS.LEVELS[S.level]; }

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

  function sfx(kind, n) {
    switch (kind) {
      case 'open': A.tone(420, 0.04, 'square', 0.018); if (n > 6) A.noise(0.18, 0.03, 0.02, 1800, 0.7); break;
      case 'flag': A.tone(880, 0.05, 'square', 0.025); A.tone(1320, 0.05, 'square', 0.02, 0.05); break;
      case 'unflag': A.tone(660, 0.05, 'square', 0.02); break;
      case 'boom': A.noise(0.7, 0.14, 0, 180, 0.6); A.tone(90, 0.6, 'sawtooth', 0.07, 0, 35); break;
      case 'far': A.noise(0.5, 0.04, 0, 140, 0.6); break;
      case 'nope': A.tone(200, 0.06, 'square', 0.015); break;
    }
  }

  function clock(t) {
    t = Math.max(0, Math.floor(t));
    return Math.floor(t / 60) + ':' + ('0' + (t % 60)).slice(-2);
  }

  // ---------- drawing ----------

  var FLAG = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M6 3v14" stroke="#1D1A33" stroke-width="2.4" stroke-linecap="round"/><path d="M7 3.5l8 3.5-8 3.5z" fill="#FF5A5F" stroke="#1D1A33" stroke-width="1.6" stroke-linejoin="round"/><path d="M3 17.5h8" stroke="#1D1A33" stroke-width="2.4" stroke-linecap="round"/></svg>';
  var MINE = '<svg viewBox="0 0 20 20" aria-hidden="true"><g stroke="#1D1A33" stroke-width="2.2" stroke-linecap="round"><path d="M10 1.8v16.4M1.8 10h16.4M4.2 4.2l11.6 11.6M15.8 4.2L4.2 15.8"/></g><circle cx="10" cy="10" r="5.6" fill="#1D1A33"/><circle cx="8" cy="8" r="1.6" fill="#fff"/></svg>';
  var CROSS = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M6 3v14" stroke="#1D1A33" stroke-width="2.4" stroke-linecap="round"/><path d="M7 3.5l8 3.5-8 3.5z" fill="#FF5A5F" stroke="#1D1A33" stroke-width="1.6" stroke-linejoin="round"/><path d="M3 3l14 14M17 3L3 17" stroke="#B3261E" stroke-width="2.6" stroke-linecap="round"/></svg>';
  function smiley(mood) {
    var mouth = mood === 'win' ? '<path d="M12 23q6 5 12 0" fill="none" stroke="#1D1A33" stroke-width="2.4" stroke-linecap="round"/>'
      : mood === 'lose' ? '<path d="M12 26q6 -5 12 0" fill="none" stroke="#1D1A33" stroke-width="2.4" stroke-linecap="round"/>'
        : mood === 'oh' ? '<ellipse cx="18" cy="24.5" rx="3" ry="3.6" fill="#1D1A33"/>'
          : '<path d="M12 22q6 4 12 0" fill="none" stroke="#1D1A33" stroke-width="2.4" stroke-linecap="round"/>';
    var eyes = mood === 'win' ? '<path d="M8 13.5h20" stroke="#1D1A33" stroke-width="2.4"/><rect x="8.5" y="12" width="8" height="5" rx="2" fill="#1D1A33"/><rect x="19.5" y="12" width="8" height="5" rx="2" fill="#1D1A33"/>'
      : mood === 'lose' ? '<path d="M10 11l5 5M15 11l-5 5M21 11l5 5M26 11l-5 5" stroke="#1D1A33" stroke-width="2.2" stroke-linecap="round"/>'
        : '<circle cx="13" cy="14" r="2.2" fill="#1D1A33"/><circle cx="23" cy="14" r="2.2" fill="#1D1A33"/>';
    return '<svg viewBox="0 0 36 36" aria-hidden="true"><circle cx="18" cy="18" r="15" fill="#FFD45C" stroke="#1D1A33" stroke-width="2.6"/>' + eyes + mouth + '</svg>';
  }

  var board = $('#board'), sqs = [];

  function buildBoard() {
    var g = S.g, html = '';
    $('.case').style.setProperty('--w', g.w);
    $('.case').style.setProperty('--h', g.h);
    board.style.setProperty('--w', g.w);
    board.style.setProperty('--h', g.h);
    for (var i = 0; i < g.n; i++) html += '<button type="button" class="sq" data-i="' + i + '"></button>';
    board.innerHTML = html;
    sqs = Array.prototype.slice.call(board.children);
  }

  function renderSq(i) {
    var g = S.g, el = sqs[i], st = g.state(i), cls = 'sq', html = '', label = 'Row ' + ((i / g.w | 0) + 1) + ', column ' + (i % g.w + 1) + ', ';
    var fresh = el.classList.contains('fresh');
    if (st === 1) {
      var n = g.number(i);
      cls += ' open' + (n ? ' n n' + n : '');
      html = n ? String(n) : '';
      label += n ? n + ' mines around' : 'empty';
    } else if (g.over && g.isMine(i)) {
      cls += st === 2 ? '' : ' mine' + (i === g.hit ? ' hit' : '');
      html = st === 2 ? FLAG : MINE;
      label += st === 2 ? 'flagged mine' : 'mine';
    } else if (st === 2) {
      cls += ' flag' + (g.over ? ' oops' : '');
      html = g.over ? CROSS : FLAG;
      label += g.over ? 'wrong flag' : 'flagged';
    } else label += 'closed';
    if (i === S.cur && !g.over) cls += ' cur';
    if (fresh) cls += ' fresh';
    if (el.className !== cls) el.className = cls;
    if (el.dataset.html !== html) { el.innerHTML = html; el.dataset.html = html; }
    el.setAttribute('aria-label', label);
  }
  function renderBoard() { for (var i = 0; i < S.g.n; i++) renderSq(i); }

  function renderPanel() {
    var g = S.g, Lv = L(), safe = g.safe();
    $('#bot-name').textContent = Lv.name;
    $('#bot-short').textContent = Lv.name;
    $('#bot-rank').textContent = Lv.rank + ' sweeper';
    document.querySelector('.field').style.setProperty('--bot', Lv.color);
    $('#mines-left').textContent = g.mines - g.flags();
    $('#you-fill').style.width = (100 * g.opened() / safe) + '%';
    $('#you-count').textContent = safe - g.opened();
    var boomed = !!g.robotBoomed;
    document.querySelector('.lane.bot').classList.toggle('boom', boomed);
    $('#bot-fill').style.width = (boomed ? 100 : 100 * g.robotOpened / safe) + '%';
    $('#bot-count').textContent = boomed ? 'out' : safe - g.robotOpened;
    var best = A.progress(GAME)[S.level];
    $('#best').textContent = best ? 'Your best against ' + Lv.name + ': ' + best.text + '.' : 'Nobody has out-swept ' + Lv.name + '. Yet.';
  }

  function renderTips() {
    var c = cfg(), tips = [
      'Your first square is always safe and opens an area. Every field can be cleared without guessing.',
      'Click a number whose mines are all flagged to open the rest of its neighbours at once.',
      c.mines + ' mines. The robot starts on the same field the moment you do.',
      S.level === 'pip' ? 'Pip sometimes clicks without looking. If it blows up, you only race the clock.' : 'The robot never guesses. Neither should you.'
    ];
    $('#tips').innerHTML = tips.map(function (t) { return '<li>' + A.esc(t) + '</li>'; }).join('');
  }

  function cue(text, bad, ms) {
    var c = $('#cue');
    c.textContent = text;
    c.className = 'cue' + (bad ? ' bad' : '');
    c.hidden = false;
    S.cueUntil = performance.now() + (ms || 900);
  }

  // ---------- the game ----------

  function newField() {
    A.closeModal(true);
    S.g = new MS.Game(S.level, (Math.random() * 1e9) >>> 0);
    S.paused = false;
    S.endShown = false;
    S.said = 0;
    S.shownSec = -1;
    S.robotShown = -1;
    S.cur = (S.g.h >> 1) * S.g.w + (S.g.w >> 1);
    buildBoard();
    board.classList.remove('hidden', 'shake');
    $('#veil').hidden = true;
    $('#cue').hidden = true;
    $('#time').textContent = '0:00';
    $('#btn-face').innerHTML = smiley('calm');
    renderBoard();
    renderPanel();
    renderTips();
    say(pick(TALK[S.level].start), 'smug');
    A.music.intensity(0.35);
  }

  function canPlay() { return !S.g.over && !S.paused && !A.isBoss() && !A.modalOpen(); }

  function opened(cells, from) {
    var g = S.g, fx = from % g.w, fy = (from / g.w) | 0;
    cells.forEach(function (c) {
      var el = sqs[c], d = Math.max(Math.abs(c % g.w - fx), Math.abs(((c / g.w) | 0) - fy));
      el.classList.remove('fresh');
      void el.offsetWidth;
      el.style.setProperty('--d', Math.min(0.45, d * 0.035) + 's');
      el.classList.add('fresh');
    });
    sc.timeout(function () { cells.forEach(function (c) { if (sqs[c]) sqs[c].classList.remove('fresh'); }); }, 900);
  }

  function handle(events, from) {
    var g = S.g, T = TALK[S.level], ended = false;
    events.forEach(function (ev) {
      if (ev.type === 'start') cue(L().name + ' is sweeping too!', false, 1100);
      else if (ev.type === 'open') { sfx('open', ev.cells.length); opened(ev.cells, from); }
      else if (ev.type === 'boom') {
        sfx('boom');
        board.classList.remove('shake');
        void board.offsetWidth;
        board.classList.add('shake');
        $('#btn-face').innerHTML = smiley('lose');
        say(pick(T.mine), 'happy');
      } else if (ev.type === 'flag') {
        sfx(ev.on ? 'flag' : 'unflag');
        if (ev.on && Math.random() < 0.12) say(pick(T.flag), 'calm');
      } else if (ev.type === 'robot-boom') {
        sfx('far');
        cue(L().name + ' hit a mine!', false, 1600);
        say(pick(T.boom), 'dead');
      } else if (ev.type === 'end') ended = true;
    });
    renderBoard();
    renderPanel();
    if (ended) sc.timeout(endGame, g.result === 'win' ? 500 : 900);
  }

  function act(fn, i) {
    var g = S.g;
    if (!canPlay()) return;
    g.events.length = 0;
    var did = fn(i);
    if (!did && !g.events.length) return false;
    var evs = g.events.slice();
    g.events.length = 0;
    handle(evs, i);
    return did;
  }
  function dig(i) {
    var g = S.g;
    if (!canPlay()) return;
    if (g.state(i) === 1) { if (g.number(i)) chord(i); return; }
    if (g.state(i) === 2) { sfx('nope'); return; }
    act(function (k) { return g.open(k); }, i);
  }
  function flag(i) {
    var g = S.g;
    if (!canPlay()) return;
    if (!g.started) { cue('Open a square first', false, 900); return; }
    if (g.state(i) === 1) { if (g.number(i)) chord(i); return; }
    act(function (k) { return g.toggleFlag(k); }, i);
  }
  function chord(i) {
    var g = S.g;
    if (act(function (k) { return g.chord(k); }, i) === false) sfx('nope');
  }

  function setCursor(i) {
    var prev = S.cur;
    S.cur = i;
    if (sqs[prev]) renderSq(prev);
    renderSq(i);
  }

  function frame(now) {
    sc.raf(frame);
    var g = S.g, dt = S.lastFrame ? Math.min(0.1, (now - S.lastFrame) / 1000) : 0;
    S.lastFrame = now;
    if (g && g.started && !g.over && !(S.paused || A.isBoss() || A.modalOpen() || document.hidden)) {
      S.acc += dt;
      while (S.acc >= MS.DT && !g.over) { g.step(); S.acc -= MS.DT; }
      if (g.events.length) { var evs = g.events.slice(); g.events.length = 0; handle(evs, S.cur); }
    } else S.acc = 0;
    if (g.robotOpened !== S.robotShown) {
      S.robotShown = g.robotOpened;
      renderPanel();
      var share = g.robotOpened / g.safe(), mark = [0.25, 0.5, 0.75, 0.9].filter(function (m) { return share >= m; }).length;
      if (mark > S.said && !g.over) { S.said = mark; say(pick(TALK[S.level].progress), share > g.opened() / g.safe() ? 'smug' : 'worried'); }
      if (g.started && !g.over) A.music.intensity(Math.min(0.9, 0.4 + 0.5 * share));
    }
    var sec = Math.floor(g.t);
    if (sec !== S.shownSec) { S.shownSec = sec; $('#time').textContent = clock(g.t); }
    $('#cue').hidden = now > S.cueUntil;
    $('#btn-pause').textContent = S.paused ? 'Resume (P)' : 'Pause (P)';
    $('#btn-pause').disabled = !g.started || g.over;
  }

  function endGame() {
    var g = S.g, Lv = L(), T = TALK[S.level], won = g.result === 'win';
    if (S.endShown) return;
    S.endShown = true;
    var stars = g.stars(), margin = g.margin(), safe = g.safe();
    A.account.submit(GAME, S.level, A.points(S.level, g.points()), won ? 'Cleared ' + clock(margin) + ' ahead' : g.opened() + ' of ' + safe + ' safe squares');
    var rec = A.record(GAME, S.level, won
      ? { stars: stars, score: Math.round(margin), lowerIsBetter: false, text: 'cleared ' + clock(margin) + ' ahead' }
      : { stars: 0, score: g.opened(), lowerIsBetter: false, text: g.opened() + ' of ' + safe + ' safe squares' });
    bar.refresh();
    A.music.intensity(0.35);
    var recLine = '<p><strong>' + (rec.better ? (rec.prev ? 'New best against ' + Lv.name + '!' : 'Your first field against ' + Lv.name + ' is on the books.') : 'Your best: ' + rec.prev.text + '.') + '</strong></p>';
    if (won) {
      // plant the flags you did not bother with
      for (var i = 0; i < g.n; i++) if (g.isMine(i) && g.state(i) === 0) g.sweep.flag(i);
      renderBoard();
      renderPanel();
      $('#btn-face').innerHTML = smiley('win');
      A.jingle('win');
      say(pick(T.win), 'dead');
      var next = ORDER[ORDER.indexOf(S.level) + 1], buttons = [];
      if (next) buttons.push({ label: 'Next sweeper: ' + A.LEVEL_MAP[next].name, kind: 'main', onClick: function () { switchTo(next); } });
      buttons.push({ label: 'New field', kind: next ? 'line' : 'main', onClick: newField });
      A.modal({
        title: S.level === 'edith' ? 'You out-swept Edith!' : 'Field cleared!',
        tone: 'win',
        html: '<p class="lead">Every safe square open in <strong>' + clock(g.t) + '</strong>, ' + clock(margin) + ' faster than ' + Lv.name + (g.robotBoomed ? ' would have managed without blowing itself up' : '') + '.</p>' +
          A.stars(stars) + recLine + (stars < 3 ? '<p class="soft">2 stars for finishing 20 seconds ahead of the robot, 3 stars for a full minute.</p>' : ''),
        buttons: buttons,
        link: { label: 'Close and look at the field' }
      });
    } else {
      A.jingle('lose');
      var mine = g.reason === 'mine';
      if (!mine) { $('#btn-face').innerHTML = smiley('oh'); say(pick(T.lose), 'happy'); }
      A.modal({
        title: mine ? 'Boom.' : Lv.name + ' cleared it first.',
        tone: 'lose',
        html: '<p class="lead">' + (mine ? 'That square was a mine.' : Lv.name + ' opened its last safe square at ' + clock(g.t) + '.') + ' You had opened <strong>' + g.opened() + ' of ' + safe + '</strong> safe squares.</p>' +
          recLine + '<p class="soft">Tips: start from the edges of the open area. A 1 touching a single closed square means that square is a mine; a number that already has all its mines flagged makes every other neighbour safe. ' +
          (S.level === 'monolith' || S.level === 'edith' ? 'When a 1 and a 2 sit side by side, the 2\'s extra square is often the mine.' : 'Click a satisfied number to open around it in one go.') + '</p>',
        buttons: [{ label: 'New field', kind: 'main', onClick: newField }],
        link: { label: 'Close and look at the field' }
      });
    }
  }

  function switchTo(id) {
    S.level = id;
    bar.setLevel(id);
    newField();
  }

  function openHelp() {
    var rows = ORDER.map(function (id) {
      var Lv = A.LEVEL_MAP[id], c = MS.LEVELS[id];
      return '<div><dt>' + Lv.name + ', ' + Lv.rank.toLowerCase() + '</dt><dd>' + TALK[id].blurb + ' ' + c.w + ' by ' + c.h + ', ' + c.mines + ' mines.</dd></div>';
    }).join('');
    A.modal({
      title: 'How to play',
      wide: true,
      html: '<p>Classic Minesweeper, with a race. A robot gets an identical field and starts sweeping the moment you open your first square.</p>' +
        '<ol><li>Open every square that is not a mine. A number tells you how many mines touch it.</li>' +
        '<li>Plant a flag where you know a mine is (right click, hold on a touch screen, or switch tapping to flags).</li>' +
        '<li>Click a number whose mines are all flagged to open the rest of its neighbours.</li>' +
        '<li>Your first square is always safe, and every field can be cleared without guessing. Open a mine and it is over.</li>' +
        '<li>Clear your field before the robot clears its own. The more time you have to spare, the more points you get.</li></ol>' +
        '<h3>Sweepers</h3><dl>' + rows + '</dl>' +
        '<h3>Keys</h3><table class="keys"><tr><td>Click</td><td>Open a square, or open around a number</td></tr><tr><td>Right click</td><td>Flag</td></tr>' +
        '<tr><td><kbd>&uarr;</kbd> <kbd>&darr;</kbd> <kbd>&larr;</kbd> <kbd>&rarr;</kbd></td><td>Move the cursor</td></tr><tr><td><kbd>Space</kbd> or <kbd>Enter</kbd></td><td>Open</td></tr>' +
        '<tr><td><kbd>F</kbd></td><td>Flag the square under the cursor or the pointer</td></tr><tr><td><kbd>P</kbd></td><td>Pause (the field hides)</td></tr><tr><td><kbd>N</kbd></td><td>New field</td></tr>' +
        '<tr><td><kbd>M</kbd></td><td>Music on or off</td></tr><tr><td><kbd>B</kbd></td><td>Panic button</td></tr></table>',
      buttons: [{ label: 'Tread carefully', kind: 'main' }]
    });
  }

  var bar = A.mountBar({
    el: $('#bar'),
    game: GAME,
    title: 'Minesweeper',
    tagline: 'The classic minefield, against the clock and a robot.',
    level: S.level,
    levelLabel: 'Sweeper',
    canSwitch: function () { return S.g.started && !S.g.over ? 'This field will be abandoned.' : true; },
    onLevel: function (id) { S.level = id; newField(); },
    onHelp: openHelp
  });
  sc.add(bar.destroy);

  function sqAt(e) { var b = e.target.closest && e.target.closest('.sq'); return b ? Number(b.dataset.i) : -1; }

  board.addEventListener('pointerdown', function (e) {
    var i = sqAt(e);
    S.pointer = e.pointerType || 'mouse';
    S.held = false;
    clearTimeout(S.hold);
    if (i < 0 || e.button !== 0) return;
    if (canPlay() && S.g.state(i) !== 1) $('#btn-face').innerHTML = smiley('oh');
    if (S.pointer !== 'mouse') S.hold = sc.timeout(function () { S.held = true; flag(i); if (navigator.vibrate) navigator.vibrate(25); }, HOLD_MS);
  });
  function release() {
    clearTimeout(S.hold);
    if (!S.g.over) $('#btn-face').innerHTML = smiley('calm');
  }
  board.addEventListener('pointerup', release);
  board.addEventListener('pointerleave', release);
  board.addEventListener('pointercancel', release);
  board.addEventListener('pointermove', function (e) {
    var i = sqAt(e);
    if (S.pointer === 'mouse' && i >= 0 && i !== S.cur) setCursor(i);
  });
  board.addEventListener('click', function (e) {
    var i = sqAt(e);
    if (i < 0) return;
    if (S.held) { S.held = false; return; }
    if (S.cur !== i) setCursor(i);
    if (S.flagMode && S.g.started) flag(i); else dig(i);
  });
  board.addEventListener('contextmenu', function (e) {
    var i = sqAt(e);
    if (i < 0) return;
    e.preventDefault();
    // a long touch is handled by the hold timer; some browsers also send a context menu for it
    if (S.pointer !== 'mouse') return;
    flag(i);
  });
  $('#btn-face').addEventListener('click', function () { $('#btn-new').click(); });
  $('#btn-mode').addEventListener('click', function () {
    S.flagMode = !S.flagMode;
    var b = $('#btn-mode');
    b.setAttribute('aria-pressed', S.flagMode ? 'true' : 'false');
    b.textContent = S.flagMode ? 'Tapping flags' : 'Tapping digs';
  });
  $('#btn-pause').addEventListener('click', function () {
    if (!S.g.started || S.g.over) return;
    S.paused = !S.paused;
    // the field hides while paused, so a pause is not free thinking time
    board.classList.toggle('hidden', S.paused);
    $('#veil').hidden = !S.paused;
  });
  $('#btn-new').addEventListener('click', function () {
    if (!(S.g.started && !S.g.over)) return newField();
    A.confirm({ title: 'New field?', text: 'This field will be abandoned and a fresh one is laid.', yes: 'New field', no: 'Keep sweeping', onYes: newField });
  });

  sc.on(document, 'keydown', function (e) {
    if (e.ctrlKey || e.metaKey || e.altKey || A.modalOpen()) return;
    var k = e.key.toLowerCase(), g = S.g;
    var mv = { arrowup: [0, -1], arrowdown: [0, 1], arrowleft: [-1, 0], arrowright: [1, 0] }[k];
    if (mv) {
      e.preventDefault();
      if (S.paused) return;
      var x = (S.cur % g.w + mv[0] + g.w) % g.w, y = (((S.cur / g.w) | 0) + mv[1] + g.h) % g.h;
      setCursor(y * g.w + x);
      return;
    }
    if (k === ' ' || (k === 'enter' && !(e.target && e.target.tagName === 'BUTTON' && !e.target.classList.contains('sq')))) { e.preventDefault(); dig(S.cur); return; }
    if (k === 'f') { flag(S.cur); return; }
    if (k === 'p') { $('#btn-pause').click(); return; }
    if (k === 'n') { $('#btn-new').click(); return; }
    if (k === '?') openHelp();
  });

  newField();
  sc.raf(frame);
  if (A.firstVisit(GAME)) openHelp();

  window.minesweeperGame = { state: S, dig: dig, flag: flag, chord: chord, newField: newField };
  return sc.dispose;
}
