/*
 * Don't Click That: the desktop, dragging windows, the robot's pointer, backups and the end of a run.
 * mount() runs after window.Arcade is ready (components/PageShell.jsx) and returns a cleanup function.
 */
import E from './engine.js';

export function mount() {
  var A = window.Arcade;
  var sc = A.scope();
  var GAME = 'dont-click-that';
  var ORDER = ['pip', 'gridlock', 'monolith', 'edith'];
  var FW = E.W, FH = E.H + 40; // the desktop plus its taskbar
  var BARS = ['#3D86F0', '#2FBF71', '#B83B7D', '#EF6C2B', '#7E97C9', '#1F9C8E'];
  var FILE_COLORS = ['#FFC93C', '#7FCB5C', '#FF8FB1', '#7EC8F0', '#C9A3FF', '#FFB86B'];

  function $(s) { return document.querySelector(s); }

  var S = { level: A.lastLevel(GAME), d: null, running: false, paused: false, acc: 0, lastFrame: 0, lastLine: '', drag: null, endShown: false, text: {}, pops: [] };

  var TALK = {
    pip: {
      blurb: 'A clumsy pointer that wanders, gets distracted by shiny files, and only closes a window when it is completely stuck.',
      rank: 'Rookie pointer',
      start: ['Ooh, a big red button! What does it do?', 'Click click click! Which one is the fun button?', 'I am a mouse now. Squeak.'],
      close: ['This window is in my way. Bye!', 'Close! Close! I found the X!'],
      file: ['Ooh, a file! Into the bin you go!', 'Shiny! Mine!'],
      jump: ['Hey, the button moved!'], end: ['I clicked it! Was that bad?', 'Everything is gone! Neat!']
    },
    gridlock: {
      blurb: 'Takes the plain shortest way round your windows, rethinks slowly, and closes a window only when walled in.',
      rank: 'Pro pointer',
      start: ['Shortest path to the button. Calculating.', 'Your windows are just obstacles.', 'Left, up, click. Very simple.'],
      close: ['Obstacle closed.', 'Window dismissed.'],
      file: ['Filing this in the trash.'], jump: ['Button relocated. Recalculating.'], end: ['Clicked. As scheduled.']
    },
    monolith: {
      blurb: 'Rethinks every quarter second and closes a window whenever going round would take more than twice as long.',
      rank: 'Grandmaster pointer',
      start: ['Every window you open, I close.', 'I do not go around. I go through.', 'Patience is a pointer\'s best friend.'],
      close: ['Closing that saves me time.', 'Shortcut taken.'],
      file: ['A file for the trash, while you are busy.'], jump: ['Moving buttons. Cute.'], end: ['Deleted. Efficiently.']
    },
    edith: {
      blurb: 'Fast, closes windows the moment it pays, and fakes a move one way before darting the other.',
      rank: 'Impossible pointer',
      start: ['Hi! I know which way you think I will go. Hee hee.', 'Edith has the mouse now!', 'Big red button, here I come!'],
      close: ['Bye bye, window!', 'Nope! Closed!', 'Edith does not do detours.'],
      file: ['Ooh, your holiday pics? Trash!'], jump: ['Moving it won\'t save you!'], end: ['Edith clicked it! Everything is gone! Hee hee!']
    }
  };

  function pick(arr) {
    if (!arr || !arr.length) return '';
    var c = arr.filter(function (l) { return l !== S.lastLine; });
    c = c.length ? c : arr;
    return c[Math.floor(Math.random() * c.length)];
  }
  function L() { return A.LEVEL_MAP[S.level]; }
  function mmss(t) { var s = Math.floor(t); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
  function setText(id, v) { if (S.text[id] !== v) { S.text[id] = v; $(id).textContent = v; } }
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
  function cue(text, bad, ms) {
    var c = $('#cue');
    c.textContent = text;
    c.className = 'cue' + (bad ? ' bad' : '');
    c.hidden = false;
    S.cueUntil = performance.now() + (ms || 1300);
  }

  function sfx(kind) {
    switch (kind) {
      case 'pop': A.tone(880, 0.05, 'square', 0.025); A.tone(1320, 0.07, 'square', 0.02, 0.05); break;
      case 'grab': A.tone(520, 0.04, 'triangle', 0.03); break;
      case 'drop': A.tone(330, 0.05, 'triangle', 0.03); break;
      case 'closing': A.tone(700, 0.06, 'square', 0.025); A.tone(700, 0.06, 'square', 0.025, 0.12); break;
      case 'closed': A.tone(240, 0.12, 'sawtooth', 0.03, 0, 120); break;
      case 'trash': A.noise(0.18, 0.05, 0, 900); A.tone(180, 0.15, 'triangle', 0.03); break;
      case 'backup': A.tone(660, 0.08, 'triangle', 0.04); A.tone(990, 0.12, 'triangle', 0.04, 0.08); break;
      case 'jump': A.tone(400, 0.1, 'sine', 0.04, 0, 900); break;
      case 'click': A.tone(120, 0.6, 'sawtooth', 0.05, 0, 40); A.noise(0.5, 0.05, 0.1, 400); break;
    }
  }

  // ---------- drawing ----------

  var cvs = $('#desktop'), ctx = cvs.getContext('2d'), scale = 1;

  function layout() {
    var w = cvs.parentNode.clientWidth;
    scale = Math.max(0.2, w / FW);
    var dpr = window.devicePixelRatio || 1;
    cvs.width = Math.round(FW * scale * dpr);
    cvs.height = Math.round(FH * scale * dpr);
    cvs.style.height = FH * scale + 'px';
    draw(performance.now());
  }
  function rr(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function text(t, x, y, size, color, align, font) {
    ctx.font = size + 'px ' + (font || 'VT323, "Courier New", monospace');
    ctx.fillStyle = color;
    ctx.textAlign = align || 'left';
    ctx.fillText(t, x, y);
  }

  function drawWallpaper() {
    var g = ctx.createLinearGradient(0, 0, 0, E.H);
    g.addColorStop(0, '#13827F');
    g.addColorStop(1, '#0E6466');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, FW, E.H);
    ctx.fillStyle = 'rgba(255,255,255,.07)';
    for (var y = 20; y < E.H; y += 40) for (var x = 20 + (y % 80 ? 20 : 0); x < FW; x += 40) { ctx.beginPath(); ctx.arc(x, y, 2, 0, Math.PI * 2); ctx.fill(); }
    text('WNI', FW / 2, E.H / 2 + 40, 160, 'rgba(255,255,255,.06)', 'center');
  }

  function drawFile(f, x, y, alpha) {
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    ctx.fillStyle = FILE_COLORS[f.id % FILE_COLORS.length];
    ctx.strokeStyle = '#1D1A33';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(x - 14, y - 18); ctx.lineTo(x + 6, y - 18); ctx.lineTo(x + 14, y - 10); ctx.lineTo(x + 14, y + 18); ctx.lineTo(x - 14, y + 18); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(29,26,51,.35)';
    [-6, 0, 6].forEach(function (dy) { ctx.fillRect(x - 9, y + dy, 18, 2.5); });
    ctx.globalAlpha = 1;
  }

  function drawFiles() {
    var d = S.d;
    d.files.forEach(function (f) {
      if (!f.alive) return;
      drawFile(f, f.x, f.y);
      rr(f.x - 40, f.y + 22, 80, 18, 4);
      ctx.fillStyle = 'rgba(0,0,0,.35)';
      ctx.fill();
      text(f.name, f.x, f.y + 36, 18, '#fff', 'center');
    });
    // the trash
    var t = E.TRASH;
    ctx.fillStyle = '#C9CED8';
    ctx.strokeStyle = '#1D1A33';
    ctx.lineWidth = 3;
    rr(t.x - 18, t.y - 16, 36, 40, 5); ctx.fill(); ctx.stroke();
    rr(t.x - 22, t.y - 24, 44, 9, 3); ctx.fill(); ctx.stroke();
    ctx.beginPath(); [-8, 0, 8].forEach(function (dx) { ctx.moveTo(t.x + dx, t.y - 8); ctx.lineTo(t.x + dx, t.y + 16); }); ctx.stroke();
    text('Trash', t.x, t.y + 42, 18, '#fff', 'center');
  }

  function drawButton(now) {
    var d = S.d, b = d.button, p = d.pointer, pulse = 0.5 + 0.5 * Math.sin(now / 220);
    ctx.save();
    ctx.shadowColor = 'rgba(229,56,59,' + (0.5 + 0.4 * pulse) + ')';
    ctx.shadowBlur = 18;
    rr(b.x, b.y, b.w, b.h, 12);
    ctx.fillStyle = '#E5383B';
    ctx.fill();
    ctx.restore();
    rr(b.x, b.y, b.w, b.h, 12);
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#1D1A33';
    ctx.stroke();
    text('DELETE', b.x + b.w / 2, b.y + 22, 24, '#fff', 'center');
    text('EVERYTHING', b.x + b.w / 2, b.y + 40, 20, '#FFE3E3', 'center');
    if (p.hover > 0) {
      var k = Math.min(1, p.hover / d.cfg.aim);
      ctx.beginPath();
      ctx.arc(p.x, p.y, 26, -Math.PI / 2, -Math.PI / 2 + k * Math.PI * 2);
      ctx.lineWidth = 6;
      ctx.strokeStyle = '#FFC93C';
      ctx.stroke();
    }
  }

  function drawWindow(w, now) {
    var d = S.d, p = d.pointer, dragging = S.drag && S.drag.id === w.id;
    ctx.save();
    if (dragging) { ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 16; ctx.shadowOffsetY = 6; }
    rr(w.x, w.y, w.w, w.h, 8);
    ctx.fillStyle = '#FBF8EE';
    ctx.fill();
    ctx.restore();
    rr(w.x, w.y, w.w, w.h, 8);
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#1D1A33';
    ctx.stroke();
    // title bar
    ctx.save();
    rr(w.x, w.y, w.w, w.h, 8);
    ctx.clip();
    ctx.fillStyle = BARS[w.look % BARS.length];
    ctx.fillRect(w.x, w.y, w.w, 24);
    ctx.restore();
    ctx.fillStyle = '#1D1A33';
    ctx.fillRect(w.x, w.y + 24, w.w, 2.5);
    ctx.save();
    ctx.beginPath(); ctx.rect(w.x + 6, w.y, w.w - 34, 24); ctx.clip();
    text(w.title, w.x + 8, w.y + 18, 20, '#fff');
    ctx.restore();
    // the close button: it glows while the robot is closing this window
    var closing = p.closing && p.closing.w === w;
    ctx.beginPath(); ctx.arc(w.x + w.w - 14, w.y + 12, 8, 0, Math.PI * 2);
    ctx.fillStyle = closing ? '#FFC93C' : '#E5483A'; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = '#1D1A33'; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(w.x + w.w - 18, w.y + 8); ctx.lineTo(w.x + w.w - 10, w.y + 16); ctx.moveTo(w.x + w.w - 10, w.y + 8); ctx.lineTo(w.x + w.w - 18, w.y + 16);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
    // pretend content
    ctx.fillStyle = 'rgba(29,26,51,.14)';
    for (var ly = w.y + 40; ly < w.y + w.h - 22; ly += 16) {
      var lw = (w.w - 28) * (0.45 + 0.5 * (((ly * 7 + w.id * 13) % 10) / 10));
      ctx.fillRect(w.x + 14, ly, lw, 7);
    }
    // how long it stays open
    var k = Math.max(0, w.life / w.maxLife);
    ctx.fillStyle = 'rgba(29,26,51,.15)';
    ctx.fillRect(w.x + 10, w.y + w.h - 12, w.w - 20, 5);
    ctx.fillStyle = k < 0.25 ? '#E5483A' : '#2FBF71';
    ctx.fillRect(w.x + 10, w.y + w.h - 12, (w.w - 20) * k, 5);
  }

  function drawPointer(now) {
    var d = S.d, p = d.pointer, Lv = L();
    if (p.holding) drawFile(p.holding, p.x + 22, p.y + 26, 0.9);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(0, 30); ctx.lineTo(8, 23); ctx.lineTo(14, 36); ctx.lineTo(20, 33); ctx.lineTo(14, 21); ctx.lineTo(24, 21); ctx.closePath();
    ctx.fillStyle = '#fff'; ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = '#1D1A33'; ctx.lineJoin = 'round'; ctx.stroke();
    // the robot riding the pointer
    rr(16, -18, 26, 20, 6);
    ctx.fillStyle = Lv.color; ctx.fill(); ctx.lineWidth = 2.5; ctx.stroke();
    ctx.fillStyle = '#1D1A33';
    ctx.fillRect(21, -13, 16, 10);
    ctx.fillStyle = '#7FE3C2';
    ctx.fillRect(24, -10, 3, 3); ctx.fillRect(31, -10, 3, 3);
    if (S.level === 'edith') { ctx.fillStyle = '#E8577E'; ctx.beginPath(); ctx.arc(40, -18, 5, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  }

  function drawTaskbar() {
    var d = S.d, y = E.H;
    ctx.fillStyle = '#E9E1C9';
    ctx.fillRect(0, y, FW, 40);
    ctx.fillStyle = '#1D1A33';
    ctx.fillRect(0, y, FW, 3);
    rr(8, y + 7, 74, 27, 6);
    ctx.fillStyle = '#2FBF71'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = '#1D1A33'; ctx.stroke();
    text('WNI', 45, y + 28, 24, '#1D1A33', 'center');
    d.windows.forEach(function (w, i) {
      if (i > 7) return;
      var x = 96 + i * 104;
      rr(x, y + 8, 98, 25, 5);
      ctx.fillStyle = '#F7F2E2'; ctx.fill(); ctx.lineWidth = 2; ctx.stroke();
      ctx.save(); ctx.beginPath(); ctx.rect(x + 4, y + 8, 90, 25); ctx.clip();
      text(w.title, x + 6, y + 27, 18, '#1D1A33');
      ctx.restore();
    });
    text(mmss(d.t), FW - 14, y + 29, 26, '#1D1A33', 'right');
  }

  function drawPops(now) {
    S.pops = S.pops.filter(function (p) { return now - p.t < 1100; });
    S.pops.forEach(function (p) {
      var k = (now - p.t) / 1100;
      ctx.globalAlpha = 1 - k;
      ctx.font = '30px VT323, monospace';
      ctx.textAlign = 'center';
      ctx.lineWidth = 5; ctx.strokeStyle = '#1D1A33'; ctx.strokeText(p.text, p.x, p.y - k * 34);
      ctx.fillStyle = p.color; ctx.fillText(p.text, p.x, p.y - k * 34);
      ctx.globalAlpha = 1;
    });
  }

  function draw(now) {
    if (!S.d) return;
    var dpr = window.devicePixelRatio || 1;
    ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
    ctx.clearRect(0, 0, FW, FH);
    drawWallpaper();
    drawFiles();
    drawButton(now);
    S.d.windows.forEach(function (w) { drawWindow(w, now); });
    drawPointer(now);
    drawPops(now);
    drawTaskbar();
  }

  // ---------- panel ----------

  function renderHud() {
    var d = S.d, left = d.nextBackup();
    setText('#time', mmss(d.t));
    setText('#files', String(d.filesLeft()));
    setText('#backup', Math.ceil(left) + 's');
    $('#backup-fill').style.width = (100 * (1 - left / E.BACKUP)) + '%';
    A.music.intensity(Math.min(0.95, 0.45 + d.t / 240));
  }
  function renderPanel() {
    var Lv = L(), T = TALK[S.level];
    $('#bot-name').textContent = Lv.name;
    $('#bot-rank').textContent = T.rank;
    var best = A.progress(GAME)[S.level];
    $('#best').textContent = best ? 'Your best against ' + Lv.name + ': ' + best.text + '.' : 'No run against ' + Lv.name + ' yet. Stars at 1, 2 and 3 minutes and 20 seconds.';
    var tips = [
      'Drag windows by grabbing them anywhere. Drop one right over the button and the pointer has to close it first.',
      'Windows close by themselves (watch their green bar), and new pop-ups keep appearing.',
      'When the pointer is walled in it closes a window: the X glows yellow while it does.',
      'It also steals files for the trash. A file under a window is safe, and a covered trash takes nothing. Every backup pays for the files you still have.'
    ];
    $('#tips').innerHTML = tips.map(function (t) { return '<li>' + A.esc(t) + '</li>'; }).join('');
    S.text = {};
  }

  // ---------- playing ----------

  function newRun() {
    A.closeModal(true);
    S.d = new E.Desktop(S.level, (Math.random() * 1e9) >>> 0);
    S.d.events.length = 0;
    S.running = false;
    S.paused = false;
    S.drag = null;
    S.endShown = false;
    S.pops = [];
    $('#start-card').hidden = false;
    $('#cue').hidden = true;
    renderPanel();
    renderHud();
    say(pick(TALK[S.level].start), 'smug');
    A.music.intensity(0.4);
    draw(performance.now());
  }

  function start() {
    if (A.modalOpen()) return;
    if (S.d.over) { newRun(); return; }
    if (S.running) return;
    S.running = true;
    S.lastFrame = 0;
    $('#start-card').hidden = true;
    cue('Go!', false, 700);
  }

  function handle(ev) {
    var d = S.d, T = TALK[S.level], now = performance.now();
    if (ev.type === 'popup') sfx('pop');
    else if (ev.type === 'closing') sfx('closing');
    else if (ev.type === 'close' && ev.by === 'bot') { sfx('closed'); if (Math.random() < 0.5) say(pick(T.close), 'smug'); }
    else if (ev.type === 'grab') { sfx('grab'); say(pick(T.file), 'happy'); }
    else if (ev.type === 'trashed') { sfx('trash'); cue(ev.name + ' went in the trash!', true, 1300); }
    else if (ev.type === 'dropback') { sfx('drop'); cue('It dropped the ' + ev.name + '! Saved.', false, 1300); }
    else if (ev.type === 'backup') { sfx('backup'); S.pops.push({ text: '+' + ev.points, x: E.TRASH.x - 60, y: E.H - 40, t: now, color: '#4FE3B0' }); cue('Backup: ' + ev.files + ' file' + (ev.files === 1 ? '' : 's') + ' saved!', false, 1300); }
    else if (ev.type === 'jump') { sfx('jump'); cue('The button moved!', false, 1100); if (Math.random() < 0.5) say(pick(T.jump), 'annoyed'); }
    else if (ev.type === 'click') { sfx('click'); cue('Deleting everything...', true, 2000); }
    else if (ev.type === 'end') sc.timeout(endGame, 1100);
  }

  function frame(now) {
    sc.raf(frame);
    var d = S.d, dt = S.lastFrame ? Math.min(0.1, (now - S.lastFrame) / 1000) : 0;
    S.lastFrame = now;
    if (d && S.running && !d.over && !(S.paused || A.isBoss() || A.modalOpen() || document.hidden)) {
      S.acc += dt;
      while (S.acc >= E.DT && !d.over) {
        d.step();
        d.events.forEach(handle);
        d.events.length = 0;
        S.acc -= E.DT;
      }
      renderHud();
    } else S.acc = 0;
    $('#cue').hidden = now > (S.cueUntil || 0);
    $('#btn-pause').textContent = S.paused ? 'Resume (P)' : 'Pause (P)';
    $('#btn-pause').disabled = !S.running || !d || d.over;
    draw(now);
  }

  function endGame() {
    var d = S.d, Lv = L(), T = TALK[S.level];
    if (S.endShown) return;
    S.endShown = true;
    S.running = false;
    S.cueUntil = 0;
    var stars = d.stars(), secs = Math.floor(d.t);
    A.account.submit(GAME, S.level, A.points(S.level, d.points()), 'lasted ' + mmss(d.t) + ', ' + d.filesLeft() + ' files left');
    var rec = A.record(GAME, S.level, { stars: stars, score: secs, lowerIsBetter: false, text: 'lasted ' + mmss(d.t) });
    bar.refresh();
    renderPanel();
    A.music.intensity(0.4);
    A.jingle(stars ? 'win' : 'lose');
    say(pick(T.end), 'happy');
    var next = ORDER[ORDER.indexOf(S.level) + 1], buttons = [{ label: 'New run', kind: 'main', onClick: newRun }];
    if (stars && next) buttons.push({ label: 'Next pointer: ' + A.LEVEL_MAP[next].name, kind: 'line', onClick: function () { switchTo(next); } });
    A.modal({
      title: stars === 3 ? 'Firewall legend!' : stars ? 'You held it off!' : 'It clicked!',
      tone: stars ? 'win' : 'lose',
      html: '<p class="lead">You kept ' + Lv.name + ' away from the button for <strong>' + mmss(d.t) + '</strong>, with ' + d.filesLeft() + ' of 6 files still on the desktop.</p>' +
        '<p>That is ' + Math.floor(10 * d.t) + ' points for the time and ' + d.backupPoints + ' from ' + d.backups + ' backup' + (d.backups === 1 ? '' : 's') + '.</p>' + A.stars(stars) +
        '<p><strong>' + (rec.better ? (rec.prev ? 'New best against ' + Lv.name + '!' : 'Your first run against ' + Lv.name + ' is on the books.') : 'Your best: ' + rec.prev.text + '.') + '</strong></p>' +
        (stars < 3 ? '<p class="soft">Stars at 1:00, 2:00 and 3:20. Tip: keep one window over the button, and grab a fresh one the moment its X starts glowing.</p>' : ''),
      buttons: buttons,
      link: { label: 'Close and look at the desktop' }
    });
  }

  function switchTo(id) {
    S.level = id;
    bar.setLevel(id);
    newRun();
  }

  function openHelp() {
    var rows = ORDER.map(function (id) {
      var Lv = A.LEVEL_MAP[id];
      return '<div><dt>' + Lv.name + ', ' + Lv.rank.toLowerCase() + '</dt><dd>' + TALK[id].blurb + '</dd></div>';
    }).join('');
    A.modal({
      title: 'How to play',
      wide: true,
      html: '<p>A robot has taken over the mouse and wants to click the big red <b>Delete everything</b> button. Keep it away for as long as you can: it never stops on its own.</p>' +
        '<ol><li>Drag the open windows into its way. It cannot pass through a window, so it has to go around.</li>' +
        '<li>Walled in, it closes a window instead (the X glows yellow while it works). Smarter pointers also close one when going round takes too long.</li>' +
        '<li>Windows close by themselves after a while, new pop-ups keep appearing, the button jumps now and then, and the pointer keeps getting faster.</li>' +
        '<li>It also drags files to the trash. A file under a window cannot be grabbed, and while a window covers the trash it has to close that window first. Every 30 seconds a backup pays 100 points per file still on the desktop.</li>' +
        '<li>The run ends when it clicks the button.</li></ol>' +
        '<h3>Pointers</h3><dl>' + rows + '</dl>' +
        '<h3>Keys</h3><table class="keys"><tr><td>Mouse or finger</td><td>Drag windows</td></tr><tr><td><kbd>Enter</kbd></td><td>Start</td></tr>' +
        '<tr><td><kbd>P</kbd></td><td>Pause</td></tr><tr><td><kbd>N</kbd></td><td>New run</td></tr>' +
        '<tr><td><kbd>M</kbd></td><td>Music on or off</td></tr><tr><td><kbd>B</kbd></td><td>Panic button</td></tr></table>',
      buttons: [{ label: 'Hands off my files', kind: 'main' }]
    });
  }

  var bar = A.mountBar({
    el: $('#bar'),
    game: GAME,
    title: 'Don\'t Click That',
    tagline: 'Drag windows into its way. Never let it click.',
    level: S.level,
    levelLabel: 'Pointer',
    canSwitch: function () { return S.running && !S.d.over ? 'This run will be abandoned.' : true; },
    onLevel: function (id) { S.level = id; newRun(); },
    onHelp: openHelp
  });
  sc.add(bar.destroy);

  // ---------- dragging windows ----------

  function at(e) {
    var r = cvs.getBoundingClientRect();
    return [(e.clientX - r.left) / r.width * FW, (e.clientY - r.top) / r.height * FH];
  }
  cvs.addEventListener('pointerdown', function (e) {
    var d = S.d;
    if (!d || d.over || A.isBoss() || A.modalOpen() || e.button > 0) return;
    var pt = at(e), w = d.windowAt(pt[0], pt[1]);
    if (!w) return;
    if (!S.running) start();
    S.drag = { id: w.id, dx: pt[0] - w.x, dy: pt[1] - w.y };
    d.moveWindow(w.id, w.x, w.y);
    sfx('grab');
    cvs.classList.add('grabbing');
    try { cvs.setPointerCapture(e.pointerId); } catch (err) { /* pointer already gone */ }
    e.preventDefault();
  });
  cvs.addEventListener('pointermove', function (e) {
    var d = S.d, pt = at(e);
    if (S.drag) {
      if (S.paused || A.isBoss() || A.modalOpen() || d.over || !d.moveWindow(S.drag.id, pt[0] - S.drag.dx, pt[1] - S.drag.dy)) S.drag = null;
      return;
    }
    cvs.classList.toggle('grab', !!(d && d.windowAt(pt[0], pt[1])));
  });
  function release() {
    if (S.drag) sfx('drop');
    S.drag = null;
    cvs.classList.remove('grabbing');
  }
  cvs.addEventListener('pointerup', release);
  cvs.addEventListener('pointercancel', release);

  $('#btn-start').addEventListener('click', start);
  $('#btn-pause').addEventListener('click', function () { if (S.running && !S.d.over) { S.paused = !S.paused; if (S.paused) cue('Paused', false, 1e9); else cue('Back to it!', false, 700); } });
  $('#btn-new').addEventListener('click', function () {
    if (!(S.running && !S.d.over)) return newRun();
    A.confirm({ title: 'New run?', text: 'This run will be abandoned and the desktop starts over.', yes: 'New run', no: 'Keep going', onYes: newRun });
  });

  sc.on(document, 'keydown', function (e) {
    if (e.ctrlKey || e.metaKey || e.altKey || A.modalOpen()) return;
    var k = e.key.toLowerCase();
    if (k === 'enter' && !(e.target && e.target.tagName === 'BUTTON')) { e.preventDefault(); start(); return; }
    if (k === 'p') { $('#btn-pause').click(); return; }
    if (k === 'n') { $('#btn-new').click(); return; }
    if (k === '?') openHelp();
  });

  var rt = null;
  sc.on(window, 'resize', function () { clearTimeout(rt); rt = sc.timeout(layout, 80); });

  newRun();
  layout();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { if (sc.alive()) draw(performance.now()); });
  sc.raf(frame);
  if (A.firstVisit(GAME)) openHelp();

  window.dontClickThat = {
    state: S, start: start, newRun: newRun,
    // for the dev checks: runs forward quickly, handling every event on the way
    fastForward: function (sec) {
      var d = S.d;
      if (!S.running) start();
      for (var i = 0; i < sec / E.DT && !d.over; i++) { d.step(); d.events.forEach(handle); d.events.length = 0; }
      renderHud();
    }
  };
  return sc.dispose;
}
