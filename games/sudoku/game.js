/*
 * Sudoku: drawing the grid, picking squares and writing numbers or notes, the robot's race on its own copy, and
 * the end screen. mount() runs after window.Arcade is ready (components/PageShell.jsx) and returns a cleanup function.
 */
import SU from './engine.js';

export function mount() {
  var A = window.Arcade;
  var sc = A.scope();
  var GAME = 'sudoku';
  var ORDER = ['pip', 'gridlock', 'monolith', 'edith'];
  var MOVES = { arrowup: -9, arrowdown: 9, arrowleft: -1, arrowright: 1 };

  function $(s) { return document.querySelector(s); }

  var S = { level: A.lastLevel(GAME), g: null, running: false, paused: false, acc: 0, lastFrame: 0, sel: 40, noting: false,
    endShown: false, cueUntil: 0, lastLine: '', said: 0, shownSec: -1 };

  var TALK = {
    pip: {
      blurb: 'Solves one square at a time, slowly, and sometimes writes the wrong number and has to rub it out.',
      start: ['Hi! I love numbers. Especially 7.', 'I got my pencil ready! And my eraser. Mostly my eraser.', 'Let\'s both do it! No peeking!'],
      progress: ['I did a square!', 'Oops, rubbing that out. Okay, fixed!', 'Halfway! I think. Maybe.', 'This one is hard. Hmm. Hmmmm.'],
      mistake: ['Oops! I do that too.', 'That one\'s not right. Erasers are friends.'],
      win: ['You finished first! You\'re so good at this.'], lose: ['I finished! Did I win? I won!'], out: ['Three oopsies! That\'s the rule, sorry.']
    },
    gridlock: {
      blurb: 'Steady and methodical. Never guesses, rarely slips, and keeps going at the same pace.',
      start: ['Puzzle loaded. Beginning row scan.', 'Every square has exactly one answer. Efficient.', 'Solving procedure initiated.'],
      progress: ['Square resolved. Continuing.', 'Progress on schedule.', 'Column complete. Proceeding.', 'Box filled. Next.'],
      mistake: ['Error logged against you.', 'Incorrect value rejected.'],
      win: ['Completion before mine. Unexpected.'], lose: ['Puzzle complete. Ahead of schedule.'], out: ['Error limit reached. Session closed.']
    },
    monolith: {
      blurb: 'Quick, and uses the clever tricks too: pairs and pointing. When a square gets hard, it just thinks harder.',
      start: ['Every grid has a story. I read them fast.', 'Singles first. Then the pairs talk.', 'Shall we see who sees further?'],
      progress: ['A pair revealed itself. Of course.', 'The box points the way.', 'Another number, exactly where it had to be.', 'The grid is nearly mine.'],
      mistake: ['The grid does not forgive guesses.', 'A guess is a confession.'],
      win: ['You saw it before I did. Remarkable.'], lose: ['The last square falls. As it had to.'], out: ['Three guesses too many.']
    },
    edith: {
      blurb: 'The fastest pencil in the office. Knows every trick and never makes a mistake. Hardly any numbers to start with.',
      start: ['Hi! Edith already filled three squares! Kidding! Or am I?', 'Ready, set, Edith wins! Hee hee.', 'Edith\'s pencil is extra sharp today!'],
      progress: ['Scribble scribble! Edith is so fast!', 'Edith found a pair! Pairs are cute!', 'Edith is almost done! Are you?', 'Wheee, another one!'],
      mistake: ['Oopsie! Edith saw that!', 'Wrong! Edith never does that. Never ever.'],
      win: ['WHAT?! You beat Edith?! That\'s not allowed!'], lose: ['Done! Edith wins! Want a sticker?'], out: ['Three strikes! Edith is the umpire now.']
    }
  };

  function pick(arr) {
    var c = arr.filter(function (l) { return l !== S.lastLine; });
    c = c.length ? c : arr;
    return c[Math.floor(Math.random() * c.length)];
  }
  function L() { return A.LEVEL_MAP[S.level]; }

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

  function sfx(kind, d) {
    switch (kind) {
      case 'write': A.noise(0.07, 0.035, 0, 3200, 1.4); A.tone(520 + 30 * (d || 1), 0.08, 'triangle', 0.03, 0.02); break;
      case 'note': A.noise(0.04, 0.018, 0, 4200, 2); break;
      case 'wrong': A.jingle('bad'); break;
      case 'unit': A.jingle('good'); break;
      case 'robot': A.noise(0.05, 0.012, 0, 2600, 1.2); break;
      case 'tick': A.tone(900, 0.03, 'sine', 0.015); break;
    }
  }

  function clock(t) {
    t = Math.max(0, Math.round(t));
    return Math.floor(t / 60) + ':' + ('0' + (t % 60)).slice(-2);
  }

  // ---------- drawing ----------

  var grid = $('#grid'), cells = [], minis = [];

  function buildGrid() {
    var html = '';
    for (var i = 0; i < 81; i++) {
      var r = SU.ROW[i], c = SU.COL[i];
      html += '<button type="button" class="cell' + (c === 3 || c === 6 ? ' c' + c : '') + (r === 3 || r === 6 ? ' r' + r : '') + '" data-i="' + i + '"></button>';
    }
    grid.innerHTML = html;
    cells = Array.prototype.slice.call(grid.children);
    var mini = '';
    for (var k = 0; k < 81; k++) mini += '<i></i>';
    $('#mini').innerHTML = mini;
    minis = Array.prototype.slice.call($('#mini').children);
  }

  function renderCell(i) {
    var g = S.g, el = cells[i], v = g.values[i], sel = S.sel, sv = g.values[sel];
    var cls = 'cell' + (SU.COL[i] === 3 || SU.COL[i] === 6 ? ' c' + SU.COL[i] : '') + (SU.ROW[i] === 3 || SU.ROW[i] === 6 ? ' r' + SU.ROW[i] : '');
    if (g.given[i]) cls += ' given'; else if (v) cls += ' yours';
    if (S.running || g.over) {
      if (i === sel) cls += ' sel';
      else if (sv && v === sv) cls += ' same';
      else if (SU.ROW[i] === SU.ROW[sel] || SU.COL[i] === SU.COL[sel] || SU.BOX[i] === SU.BOX[sel]) cls += ' peer';
    }
    if (g.over && !v) cls += ' shown';
    if (el.className.indexOf(' done') >= 0) cls += ' done';
    el.className = cls;
    var label = 'Row ' + (SU.ROW[i] + 1) + ', column ' + (SU.COL[i] + 1) + ', ';
    if (v) { el.textContent = v; el.setAttribute('aria-label', label + v); return; }
    if (g.over) { el.textContent = g.solution[i]; el.setAttribute('aria-label', label + 'answer ' + g.solution[i]); return; }
    var n = g.notes[i];
    if (!n) { el.textContent = ''; el.setAttribute('aria-label', label + 'empty'); return; }
    var notes = '', said = [];
    for (var d = 1; d <= 9; d++) { var on = n & SU.bit(d); notes += '<i>' + (on ? d : '') + '</i>'; if (on) said.push(d); }
    el.innerHTML = '<span class="notes">' + notes + '</span>';
    el.setAttribute('aria-label', label + 'notes ' + said.join(' '));
  }
  function renderGrid() { for (var i = 0; i < 81; i++) renderCell(i); }

  function renderPad() {
    var g = S.g, html = '';
    for (var d = 1; d <= 9; d++) {
      var left = g.remaining(d);
      html += '<button type="button" class="num' + (left ? '' : ' used') + '" data-d="' + d + '" aria-label="' + d + ', ' + left + ' left">' + d + '<small>' + (left || '') + '</small></button>';
    }
    $('#pad').innerHTML = html;
  }

  function renderPanel() {
    var g = S.g, Lv = L();
    $('#bot-name').textContent = Lv.name;
    $('#bot-short').textContent = Lv.name;
    $('#bot-rank').textContent = Lv.rank + ' solver';
    $('#copy-head').textContent = Lv.name + '\'s copy (filled squares)';
    document.querySelector('.notebook').style.setProperty('--bot', Lv.color);
    $('#you-fill').style.width = (100 * g.filled / g.toFill) + '%';
    $('#you-count').textContent = g.toFill - g.filled;
    $('#bot-fill').style.width = (100 * g.robotDone / g.plan.length) + '%';
    $('#bot-count').textContent = g.plan.length - g.robotDone;
    var marks = '';
    for (var k = 0; k < SU.MISTAKES; k++) marks += '<i class="' + (k < g.mistakes ? 'used' : '') + '"></i>';
    $('#marks').innerHTML = marks;
    var best = A.progress(GAME)[S.level];
    $('#best').textContent = best ? 'Your best against ' + Lv.name + ': ' + best.text + '.' : 'Nobody has beaten ' + Lv.name + ' at Sudoku. Yet.';
  }

  function renderMini() {
    var g = S.g;
    for (var i = 0; i < 81; i++) minis[i].className = g.given[i] ? 'g' : '';
    for (var k = 0; k < g.robotDone; k++) minis[g.plan[k].cell].className = 'on';
  }

  function renderTips() {
    var c = SU.LEVELS[S.level], tips = [
      'Notes (Space, or Shift and a number) pencil in what a square might be.',
      'A wrong number does not stay, but it costs one of your ' + SU.MISTAKES + ' mistakes.',
      c.need === 2 ? 'These puzzles need more than singles: look for pairs, and for numbers boxed into one row.' : 'Look for the only number that fits a square, or the only place a number can go.'
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

  function newPuzzle() {
    A.closeModal(true);
    S.g = new SU.Game(S.level, (Math.random() * 1e9) >>> 0);
    S.g.events.length = 0;
    S.running = false;
    S.paused = false;
    S.endShown = false;
    S.said = 0;
    S.shownSec = -1;
    S.sel = 40;
    grid.classList.add('hidden');
    grid.classList.remove('solved');
    cells.forEach(function (el) { el.classList.remove('done'); });
    $('#cover').hidden = false;
    $('#cover-title').textContent = 'Ready?';
    $('#cover-text').textContent = L().name + ' gets the same puzzle. Fill your grid before it fills its own.';
    $('#cue').hidden = true;
    $('#time').textContent = '0:00';
    renderGrid();
    renderPad();
    renderPanel();
    renderMini();
    renderTips();
    say(pick(TALK[S.level].start), 'smug');
    A.music.intensity(0.35);
  }

  function start() {
    if (A.modalOpen()) return;
    if (S.g.over) { newPuzzle(); return; }
    if (S.running) return;
    S.running = true;
    S.lastFrame = 0;
    $('#cover').hidden = true;
    grid.classList.remove('hidden');
    renderGrid();
    cells[S.sel].focus({ preventScroll: true });
  }

  function canPlay() { return S.running && !S.g.over && !S.paused && !A.isBoss() && !A.modalOpen(); }

  function select(i) {
    if (i < 0 || i > 80 || !S.running) return;
    S.sel = i;
    renderGrid();
    // focus follows the selection, so screen readers announce the square
    if (document.activeElement !== cells[i]) cells[i].focus({ preventScroll: true });
  }

  function write(d) {
    var g = S.g, i = S.sel;
    if (!canPlay()) return;
    if (S.noting) { note(d); return; }
    if (g.given[i] || g.values[i]) { sfx('tick'); return; }
    g.events.length = 0;
    g.place(i, d);
    handle(g.events.slice());
  }

  function note(d) {
    var g = S.g, i = S.sel;
    if (!canPlay()) return;
    if (g.note(i, d)) { sfx('note'); renderCell(i); }
  }

  function erase() {
    var g = S.g, i = S.sel;
    if (!canPlay()) return;
    if (g.clearNotes(i)) { sfx('note'); renderCell(i); }
  }

  function setNoting(on) {
    S.noting = on;
    $('#btn-notes').setAttribute('aria-pressed', on ? 'true' : 'false');
    document.querySelector('.notebook').classList.toggle('noting', on);
  }

  function flash(units) {
    units.forEach(function (unit, n) {
      unit.forEach(function (c, k) {
        var el = cells[c];
        el.classList.remove('done');
        void el.offsetWidth;
        el.style.animationDelay = (k * 0.03 + n * 0.1) + 's';
        el.classList.add('done');
      });
    });
    sc.timeout(function () { cells.forEach(function (el) { el.classList.remove('done'); el.style.animationDelay = ''; }); }, 1200);
  }

  function handle(events) {
    var g = S.g, T = TALK[S.level], ended = false;
    events.forEach(function (ev) {
      if (ev.type === 'correct') {
        sfx('write', ev.digit);
        renderGrid();
        renderPad();
        if (ev.units.length) { sfx('unit'); flash(ev.units); }
        if (ev.digitDone) cue('All the ' + ev.digit + 's!', false, 800);
      } else if (ev.type === 'mistake') {
        sfx('wrong');
        var el = cells[ev.cell];
        el.innerHTML = '<span class="x">' + ev.digit + '</span>';
        el.classList.remove('wrong');
        void el.offsetWidth;
        el.classList.add('wrong');
        sc.timeout(function () { el.classList.remove('wrong'); if (S.g === g) renderCell(ev.cell); }, 650);
        cue(ev.mistakes >= SU.MISTAKES ? 'Third mistake!' : 'Not a ' + ev.digit + '. Mistake ' + ev.mistakes + ' of ' + SU.MISTAKES, true, 1100);
        say(pick(T.mistake), 'happy');
      } else if (ev.type === 'robot') {
        sfx('robot');
        renderMini();
        var share = ev.done / g.plan.length, mark = [0.25, 0.5, 0.75, 0.9].filter(function (m) { return share >= m; }).length;
        if (mark > S.said) { S.said = mark; say(pick(T.progress), share > g.filled / g.toFill ? 'smug' : 'worried'); }
        A.music.intensity(Math.min(0.9, 0.35 + 0.55 * share));
      } else if (ev.type === 'end') ended = true;
    });
    renderPanel();
    if (ended) sc.timeout(endGame, g.result === 'win' ? 700 : 500);
  }

  function frame(now) {
    sc.raf(frame);
    var g = S.g, dt = S.lastFrame ? Math.min(0.1, (now - S.lastFrame) / 1000) : 0;
    S.lastFrame = now;
    if (g && S.running && !g.over && !(S.paused || A.isBoss() || A.modalOpen() || document.hidden)) {
      S.acc += dt;
      while (S.acc >= SU.DT && !g.over) { g.step(); S.acc -= SU.DT; }
      if (g.events.length) { var evs = g.events.slice(); g.events.length = 0; handle(evs); }
    } else S.acc = 0;
    var sec = Math.floor(g.t);
    if (sec !== S.shownSec) { S.shownSec = sec; $('#time').textContent = clock(g.t); }
    $('#cue').hidden = now > S.cueUntil;
    $('#btn-pause').textContent = S.paused ? 'Resume (P)' : 'Pause (P)';
    $('#btn-pause').disabled = !S.running || g.over;
  }

  function endGame() {
    var g = S.g, Lv = L(), T = TALK[S.level], won = g.result === 'win';
    if (S.endShown) return;
    S.endShown = true;
    S.running = false;
    setNoting(false);
    var stars = g.stars(), margin = g.margin();
    A.account.submit(GAME, S.level, A.points(S.level, g.points()), won ? 'Solved ' + clock(margin) + ' ahead' : g.filled + ' of ' + g.toFill + ' squares');
    var rec = A.record(GAME, S.level, won
      ? { stars: stars, score: Math.round(margin), lowerIsBetter: false, text: 'solved ' + clock(margin) + ' ahead' }
      : { stars: 0, score: g.filled, lowerIsBetter: false, text: g.filled + ' of ' + g.toFill + ' squares' });
    bar.refresh();
    renderGrid();
    renderPanel();
    A.music.intensity(0.35);
    var recLine = '<p><strong>' + (rec.better ? (rec.prev ? 'New best against ' + Lv.name + '!' : 'Your first game against ' + Lv.name + ' is on the books.') : 'Your best: ' + rec.prev.text + '.') + '</strong></p>';
    if (won) {
      grid.classList.add('solved');
      cells.forEach(function (el, i) { el.style.setProperty('--d', ((SU.ROW[i] + SU.COL[i]) * 0.035) + 's'); });
      A.jingle('win');
      say(pick(T.win), 'dead');
      var next = ORDER[ORDER.indexOf(S.level) + 1], buttons = [];
      if (next) buttons.push({ label: 'Next solver: ' + A.LEVEL_MAP[next].name, kind: 'main', onClick: function () { switchTo(next); } });
      buttons.push({ label: 'New puzzle', kind: next ? 'line' : 'main', onClick: newPuzzle });
      A.modal({
        title: S.level === 'edith' ? 'You out-solved Edith!' : 'Solved first!',
        tone: 'win',
        html: '<p class="lead">You filled the grid in <strong>' + clock(g.t) + '</strong>, ' + clock(margin) + ' before ' + Lv.name + ' would have, with ' +
          (g.mistakes ? g.mistakes + ' mistake' + (g.mistakes === 1 ? '' : 's') : 'no mistakes') + '.</p>' + A.stars(stars) + recLine +
          (stars < 3 ? '<p class="soft">3 stars means no mistakes and at least a minute ahead of the robot. 2 stars: one mistake at most and 20 seconds ahead.</p>' : ''),
        buttons: buttons,
        link: { label: 'Close and admire the grid' }
      });
    } else {
      A.jingle('lose');
      var out = g.reason === 'mistakes';
      say(pick(out ? T.out : T.lose), 'happy');
      A.modal({
        title: out ? 'Three mistakes.' : Lv.name + ' finished first.',
        tone: 'lose',
        html: '<p class="lead">' + (out ? 'That was your third wrong number.' : Lv.name + ' filled its last square at ' + clock(g.t) + '.') + ' You had <strong>' + g.filled + ' of ' + g.toFill + '</strong> squares. The grey numbers show the answers you were missing.</p>' +
          recLine + '<p class="soft">Tips: look for the number a row, column or box is missing only one of. When a square can only be two numbers, note both; ' +
          (SU.LEVELS[S.level].need === 2 ? 'two squares in a box that can only be the same two numbers rule those numbers out everywhere else in that box.' : 'it often settles itself a few moves later.') + '</p>',
        buttons: [{ label: 'New puzzle', kind: 'main', onClick: newPuzzle }],
        link: { label: 'Close and look at the answers' }
      });
    }
  }

  function switchTo(id) {
    S.level = id;
    bar.setLevel(id);
    newPuzzle();
  }

  function openHelp() {
    var rows = ORDER.map(function (id) {
      var Lv = A.LEVEL_MAP[id], c = SU.LEVELS[id];
      return '<div><dt>' + Lv.name + ', ' + Lv.rank.toLowerCase() + '</dt><dd>' + TALK[id].blurb + ' Puzzles start with ' + c.givens[0] + ' to ' + c.givens[1] + ' numbers.</dd></div>';
    }).join('');
    A.modal({
      title: 'How to play',
      wide: true,
      html: '<p>Classic Sudoku, with a race. A robot gets an identical copy of your puzzle and solves it at the same time.</p>' +
        '<ol><li>Fill every empty square so that each row, column and 3 by 3 box has the numbers 1 to 9 once each.</li>' +
        '<li>Pick a square, then a number. Every puzzle has exactly one answer and can be solved without guessing.</li>' +
        '<li>A wrong number is a mistake and does not stay. Three mistakes and you are out.</li>' +
        '<li>Finish before the robot fills its own grid. The more time you have to spare, the more points you get.</li></ol>' +
        '<h3>Solvers</h3><dl>' + rows + '</dl>' +
        '<h3>Keys</h3><table class="keys"><tr><td><kbd>1</kbd> to <kbd>9</kbd></td><td>Write a number</td></tr>' +
        '<tr><td><kbd>Shift</kbd> and a number</td><td>Pencil a note</td></tr><tr><td><kbd>Space</kbd></td><td>Notes mode on or off</td></tr>' +
        '<tr><td><kbd>Delete</kbd> or <kbd>0</kbd></td><td>Clear a square\'s notes</td></tr><tr><td><kbd>&uarr;</kbd> <kbd>&darr;</kbd> <kbd>&larr;</kbd> <kbd>&rarr;</kbd></td><td>Move around the grid</td></tr>' +
        '<tr><td><kbd>Enter</kbd></td><td>Start</td></tr><tr><td><kbd>P</kbd></td><td>Pause (the grid hides)</td></tr><tr><td><kbd>N</kbd></td><td>New puzzle</td></tr>' +
        '<tr><td><kbd>M</kbd></td><td>Music on or off</td></tr><tr><td><kbd>B</kbd></td><td>Panic button</td></tr></table>',
      buttons: [{ label: 'Sharpen the pencil', kind: 'main' }]
    });
  }

  var bar = A.mountBar({
    el: $('#bar'),
    game: GAME,
    title: 'Sudoku',
    tagline: 'The classic number puzzle, against the clock and a robot.',
    level: S.level,
    levelLabel: 'Solver',
    canSwitch: function () { return S.running && !S.g.over ? 'This puzzle will be abandoned.' : true; },
    onLevel: function (id) { S.level = id; newPuzzle(); },
    onHelp: openHelp
  });
  sc.add(bar.destroy);

  buildGrid();

  grid.addEventListener('click', function (e) {
    var b = e.target.closest('.cell');
    if (b) select(Number(b.dataset.i));
  });
  $('#pad').addEventListener('click', function (e) {
    var b = e.target.closest('.num');
    if (b) write(Number(b.dataset.d));
  });
  $('#btn-start').addEventListener('click', start);
  $('#btn-notes').addEventListener('click', function () { setNoting(!S.noting); });
  $('#btn-clear').addEventListener('click', erase);
  $('#btn-pause').addEventListener('click', function () {
    if (!S.running || S.g.over) return;
    S.paused = !S.paused;
    // the grid hides while paused, so a pause is not free thinking time
    grid.classList.toggle('hidden', S.paused);
    if (S.paused) cue('Paused', false, 1e9); else cue('Back to it!', false, 700);
  });
  $('#btn-new').addEventListener('click', function () {
    if (!(S.running && !S.g.over)) return newPuzzle();
    A.confirm({ title: 'New puzzle?', text: 'This puzzle will be abandoned and a fresh one comes in.', yes: 'New puzzle', no: 'Keep solving', onYes: newPuzzle });
  });

  sc.on(document, 'keydown', function (e) {
    if (e.ctrlKey || e.metaKey || e.altKey || A.modalOpen()) return;
    var k = e.key.toLowerCase();
    // e.code keeps Shift and a number working on every keyboard layout (Shift+1 types "!")
    var m = /^(?:Digit|Numpad)([0-9])$/.exec(e.code || ''), d = m ? Number(m[1]) : /^[0-9]$/.test(e.key) ? Number(e.key) : -1;
    if (d >= 1) { e.preventDefault(); if (e.shiftKey) note(d); else write(d); return; }
    if (d === 0 || k === 'backspace' || k === 'delete') { e.preventDefault(); erase(); return; }
    if (MOVES[k] != null) {
      e.preventDefault();
      var i = S.sel, step = MOVES[k], col = SU.COL[i];
      if ((step === -1 && col === 0) || (step === 1 && col === 8)) i += step * -8;
      else i = (i + step + 81) % 81;
      select(i);
      return;
    }
    if (k === ' ') { e.preventDefault(); if (S.running) setNoting(!S.noting); return; }
    if (k === 'enter' && !(e.target && e.target.tagName === 'BUTTON' && !e.target.classList.contains('cell'))) { e.preventDefault(); start(); return; }
    if (k === 'p') { $('#btn-pause').click(); return; }
    if (k === 'n') { $('#btn-new').click(); return; }
    if (k === '?') openHelp();
  });

  newPuzzle();
  sc.raf(frame);
  if (A.firstVisit(GAME)) openHelp();

  window.sudokuGame = { state: S, start: start, select: select, write: write, note: note, newPuzzle: newPuzzle };
  return sc.dispose;
}
