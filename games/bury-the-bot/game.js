/*
 * Bury the Bot: game flow, rendering and UI.
 * mount() runs after window.Arcade is ready (components/PageShell.jsx) and returns a cleanup function.
 */
import E from './engine.js';

export function mount() {
  var A = window.Arcade;
  var sc = A.scope();
  var GAME = 'bury-the-bot';
  var W = E.W, H = E.H, HID = E.HIDDEN;
  var VISIBLE = H - HID;

  function $(s) { return document.querySelector(s); }

  // ---------- data ----------

  var COLORS = { I: '#4FB3D9', O: '#F2C14E', T: '#B07CC6', S: '#7CC47F', Z: '#E8644A', J: '#6384DA', L: '#F09A4A', X: '#76807A' };

  var STD_ECON = { start: 3, cost: { junk: 7, shove: 6, spin: 5, redraw: 3 } };
  var BOTS = {
    pip: {
      budget: 60, stars: [33, 45, 60], econ: STD_ECON,
      blurb: 'Sloppy. Chases line clears and barely notices holes.',
      start: ['Hi! I\'m Pip. I\'m really good at this. Probably.', 'Deal me something nice, okay?', 'I\'ve been practicing! On easy mode.'],
      win: ['I\'m going to go lie down for a bit.', 'That was not fair. Was it fair?', 'Okay. Okay. Rematch?'],
      lose: ['I survived! I\'m amazing!', 'Wow, I won? Tell everyone.', 'Out of pieces? Ha! Pip lives!']
    },
    gridlock: {
      budget: 75, stars: [42, 57, 75], econ: STD_ECON,
      blurb: 'Keeps its stack low and flat. Hard to rattle.',
      start: ['Ted online. Your pieces, my rules.', 'I have survived worse dealers than you.', 'Flat and low. That is the whole secret.'],
      win: ['Recalculating. Recalculating.', 'That stack was supposed to be flat.', 'Error: dealer too mean.'],
      lose: ['Budget spent. I am still standing.', 'Flat and low. Told you.', 'Better luck with the next deck.']
    },
    monolith: {
      budget: 90, stars: [50, 68, 90], econ: STD_ECON,
      blurb: 'Tournament-grade, and it peeks at your hand to plan for the worst card you hold.',
      start: ['I can see your hand, you know.', 'Every card you hold is already in my plans.', 'Deal. I have read this game before.'],
      win: ['This was not in my plans.', 'Impossible. I accounted for everything.', 'You have earned my respect. Briefly.'],
      lose: ['As predicted.', 'Ninety pieces. I needed eighty.', 'Your hand was an open book.']
    },
    edith: {
      budget: 42, stars: [35, 38, 42], econ: { start: 0, cost: { junk: 8, shove: 7, spin: 6, redraw: 4 } },
      blurb: 'Reads your hand and the next card in the deck. You start with zero mischief and every trick costs more.',
      start: ['Hi! I\'m Edith. I already know how this ends.', 'I memorized the deck. Hope that\'s okay!', 'Let\'s play! You go first. And last.'],
      win: ['Wait. That is not how it ends.', 'Edith has never lost before. Edith needs a minute.', 'Okay. You are allowed to brag.'],
      lose: ['Aww. You tried so hard!', 'Forty-two pieces. Just like I planned.', 'Again? I love this game.']
    }
  };
  var ORDER = ['pip', 'gridlock', 'monolith', 'edith'];

  var POWERS = {
    junk: { key: 'Q', name: 'Junk row', tip: 'Push a gray row with one gap up from the bottom.' },
    shove: { key: 'W', name: 'Shove', tip: 'After the bot aims, bump its piece one column. Click again to switch direction.' },
    spin: { key: 'E', name: 'Spin lock', tip: 'The bot cannot rotate its next piece.' },
    redraw: { key: 'R', name: 'Redraw', tip: 'Swap your whole hand for three new cards.' }
  };
  var POWER_ORDER = ['junk', 'shove', 'spin', 'redraw'];
  var MAX_POINTS = 10;

  var SPEEDS = { normal: 1, fast: 0.45, instant: 0 };
  var SPEED_ORDER = ['normal', 'fast', 'instant'];

  var LINES = {
    clear: ['Clean.', 'Thanks for that.', 'And it\'s gone.', 'Tidy, tidy.', 'That one was a gift.', 'Mmm, a line.'],
    tetris: ['Four lines! Are you even trying?', 'A full clear. Delicious.', 'Look at that. Spotless.'],
    hole: ['Hm. That left a gap.', 'I meant to do that.', 'That\'s fine. Totally fine.', 'Not my favorite shape.'],
    holes: ['Who designed these pieces?', 'Okay, that one hurt.', 'That is a lot of holes.', 'I will remember this.'],
    worried: ['It\'s getting tall in here.', 'I\'m fine. Everything is fine.', 'Could I get an I piece? Please?', 'Is it warm in here?'],
    panic: ['No no no no.', 'I can see the red line!', 'Please, anything long and straight.', 'Mayday. Mayday.'],
    shove: ['Hey! Hands off.', 'Did you just push me?', 'That is not where I put it!', 'Rude.'],
    shoveBlocked: ['Nice try. The wall is in the way.', 'Can\'t shove me through a wall.'],
    spin: ['My rotate button is stuck!', 'Why won\'t it turn?', 'Who glued my piece?'],
    junk: ['Where did that row come from?', 'The floor is rising!', 'That has to be against the rules.'],
    redraw: ['Shuffling? Scared of your own cards?', 'New hand, same result.', 'Take your time. I can wait.'],
    sz: ['Another one of those? Rude.', 'You really like those squiggles.'],
    idle: ['Your move.', 'Is that the best card you have?', 'I\'m not going anywhere.', 'Deal.', 'Keep them coming.']
  };

  var TIPS = [
    'Hold on to the I piece. Without it, deep wells never get cleared.',
    'S and Z on a flat stack almost always leave holes.',
    'Shove hurts most when the bot aims for a snug slot.',
    'Spin lock forces an I piece to lie flat. Check where it lands first.',
    'Save Junk row for the finish. It can push the stack over the line.',
    'The deck runs in sets of seven. Every piece comes back, so plan when to spend your S and Z.',
    'Watch the preview. If a card clears lines, keep it in your hand instead.'
  ];

  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- state ----------

  var S = {
    botId: A.lastLevel(GAME),
    speed: A.store.get('btb-speed', reduceMotion ? 'fast' : 'normal'),
    seed: 0, deck: null, junkRand: null,
    rows: null, colors: null,
    hand: [], dealt: 0, lines: 0, points: 0,
    armed: { shove: 0, spin: false },
    phase: 'idle', result: null,
    previews: [], hover: -1,
    active: null, flash: null, rise: 0, buried: -1, shake: 0,
    lastType: null, lastLine: '', moodTemp: null, moodUntil: 0,
    gameId: 0
  };
  if (!(S.speed in SPEEDS)) S.speed = 'normal';

  function botInfo() { return BOTS[S.botId]; }
  function botName(id) { return A.LEVEL_MAP[id || S.botId].name; }
  function cost(id) { return botInfo().econ.cost[id]; }

  // ---------- small helpers ----------

  function pick(arr) {
    var choices = arr.filter(function (l) { return l !== S.lastLine; });
    if (!choices.length) choices = arr;
    return choices[Math.floor(Math.random() * choices.length)];
  }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function factor() { return SPEEDS[S.speed]; }

  function wait(ms) {
    var f = factor();
    if (f === 0 || ms <= 0) return Promise.resolve();
    return new Promise(function (r) { sc.timeout(r, ms * f); });
  }

  function tween(ms, fn) {
    var f = factor();
    if (f === 0 || ms <= 0) { fn(1); return Promise.resolve(); }
    var dur = ms * f;
    return new Promise(function (resolve) {
      var t0 = performance.now();
      function step(now) {
        var t = clamp((now - t0) / dur, 0, 1);
        fn(t);
        if (t < 1) sc.raf(step); else resolve();
      }
      sc.raf(step);
    });
  }

  function makeColors() {
    var c = [];
    for (var y = 0; y < H; y++) c.push(new Array(W).fill(null));
    return c;
  }

  function starsFor(pieces) {
    var t = botInfo().stars;
    return pieces <= t[0] ? 3 : pieces <= t[1] ? 2 : 1;
  }

  function sfx(name) {
    switch (name) {
      case 'deal': A.tone(520, 0.06, 'triangle', 0.04); break;
      case 'tick': A.tone(900, 0.025, 'square', 0.015); break;
      case 'lock': A.tone(150, 0.09, 'sine', 0.12); break;
      case 'clear': A.jingle('good'); break;
      case 'shove': A.tone(220, 0.14, 'sawtooth', 0.04, 0, 90); break;
      case 'junk': A.tone(120, 0.22, 'sawtooth', 0.05, 0, 60); break;
      case 'redraw': A.tone(700, 0.05, 'triangle', 0.03); A.tone(840, 0.05, 'triangle', 0.03, 0.05); break;
      case 'win': A.jingle('win'); break;
      case 'lose': A.jingle('lose'); break;
    }
  }

  // ---------- board drawing ----------

  var cvs = $('#board');
  var ctx = cvs.getContext('2d');
  var CELL = 26;

  function layout() {
    var top = $('#bar').offsetHeight;
    var avail = window.innerHeight - top - 132 - 16 - 16 - 22;
    var byWidth = Math.floor((Math.min(window.innerWidth, 560) - 56) / W);
    var cell = Math.floor(avail / H);
    if (window.innerWidth <= 700) cell = Math.min(cell, byWidth);
    CELL = clamp(cell, 16, 34);
    var dpr = window.devicePixelRatio || 1;
    cvs.width = Math.round(W * CELL * dpr);
    cvs.height = Math.round(H * CELL * dpr);
    cvs.style.width = W * CELL + 'px';
    cvs.style.height = H * CELL + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function tile(x, y, color, alpha) {
    var s = CELL, px = x * s, py = y * s;
    var r = Math.max(2, s * 0.14);
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    ctx.fillStyle = color;
    roundRect(px + 1, py + 1, s - 2, s - 2, r);
    ctx.fill();
    var band = Math.max(2, Math.round(s * 0.13));
    ctx.fillStyle = 'rgba(255,255,255,.24)';
    ctx.fillRect(px + 3, py + 2.5, s - 6, band);
    ctx.fillStyle = 'rgba(0,0,0,.22)';
    ctx.fillRect(px + 3, py + s - 2.5 - band, s - 6, band);
    ctx.globalAlpha = 1;
  }

  function ghost(cells, color, faint) {
    var s = CELL;
    ctx.save();
    ctx.setLineDash(faint ? [2, 3] : [5, 3]);
    ctx.lineWidth = faint ? 1.5 : 2.5;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    cells.forEach(function (c) {
      ctx.globalAlpha = faint ? 0.08 : 0.32;
      roundRect(c[0] * s + 2, c[1] * s + 2, s - 4, s - 4, 3);
      ctx.fill();
      ctx.globalAlpha = faint ? 0.45 : 0.95;
      ctx.stroke();
    });
    ctx.restore();
  }

  function draw() {
    if (!S.rows) return;
    var s = CELL, bw = W * s, bh = H * s;
    ctx.save();
    ctx.clearRect(0, 0, bw, bh);
    if (S.shake > 0.05) ctx.translate((Math.random() - 0.5) * S.shake * 6, (Math.random() - 0.5) * S.shake * 4);

    ctx.fillStyle = '#0D2A21';
    ctx.fillRect(-8, -8, bw + 16, bh + 16);

    var dz = HID * s;
    ctx.fillStyle = S.buried >= 0 ? 'rgba(224,85,62,.32)' : 'rgba(224,85,62,.12)';
    ctx.fillRect(0, 0, bw, dz);
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, bw, dz); ctx.clip();
    ctx.strokeStyle = 'rgba(224,85,62,.16)';
    ctx.lineWidth = 1;
    for (var hx = -dz; hx < bw + dz; hx += 9) {
      ctx.beginPath(); ctx.moveTo(hx, dz); ctx.lineTo(hx + dz, 0); ctx.stroke();
    }
    ctx.restore();

    ctx.strokeStyle = 'rgba(244,239,225,.05)';
    ctx.lineWidth = 1;
    for (var gx = 1; gx < W; gx++) { ctx.beginPath(); ctx.moveTo(gx * s + 0.5, dz); ctx.lineTo(gx * s + 0.5, bh); ctx.stroke(); }
    for (var gy = HID + 1; gy < H; gy++) { ctx.beginPath(); ctx.moveTo(0, gy * s + 0.5); ctx.lineTo(bw, gy * s + 0.5); ctx.stroke(); }

    var zoneEmpty = !S.rows[0] && !S.rows[1] && !S.active;
    if (zoneEmpty && S.buried < 0) {
      ctx.fillStyle = 'rgba(244,239,225,.5)';
      ctx.font = '700 ' + Math.max(10, Math.round(s * 0.42)) + 'px ' + getComputedStyle(document.body).fontFamily;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Anything left up here buries the bot', bw / 2, dz / 2);
    }

    ctx.save();
    ctx.translate(0, S.rise * s);
    for (var y = 0; y < H; y++) {
      for (var x = 0; x < W; x++) {
        var k = S.colors[y][x];
        if (!k) continue;
        tile(x, y, S.buried >= 0 && y <= S.buried ? '#58615C' : COLORS[k]);
      }
    }
    ctx.restore();

    if (S.flash) {
      ctx.fillStyle = 'rgba(255,248,226,' + S.flash.alpha + ')';
      S.flash.rows.forEach(function (ry) { ctx.fillRect(0, ry * s, bw, s); });
    }

    if (S.phase === 'idle' && S.hover >= 0 && S.previews[S.hover]) {
      var d = S.previews[S.hover];
      var color = COLORS[d.placement.type];
      if (d.shoved) ghost(E.cellsOf(d.intended.type, d.intended.rot, d.intended.x, d.intended.y), color, true);
      ghost(E.cellsOf(d.placement.type, d.placement.rot, d.placement.x, d.placement.y), d.result.topOut ? '#FF7A5C' : color, false);
    }

    if (S.active) {
      var a = S.active;
      E.cellsOf(a.type, a.rot, a.x, 0).forEach(function (c) { tile(c[0], c[1] + a.y, COLORS[a.type]); });
    }

    ctx.strokeStyle = '#E0553E';
    ctx.lineWidth = 2;
    ctx.setLineDash([7, 5]);
    ctx.beginPath(); ctx.moveTo(0, dz); ctx.lineTo(bw, dz); ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  function kick(amount) {
    if (reduceMotion || factor() === 0) return;
    var running = S.shake > 0.05;
    S.shake = Math.max(S.shake, amount);
    if (running) return;
    (function loop() {
      S.shake *= 0.86;
      draw();
      if (S.shake > 0.05) sc.raf(loop); else { S.shake = 0; draw(); }
    })();
  }

  // ---------- piece art for cards ----------

  function pieceSVG(type, cell) {
    var cells = E.SHAPES[type][0];
    var xs = cells.map(function (c) { return c[0]; }), ys = cells.map(function (c) { return c[1]; });
    var minX = Math.min.apply(null, xs), minY = Math.min.apply(null, ys);
    var w = (Math.max.apply(null, xs) - minX + 1) * cell, h = (Math.max.apply(null, ys) - minY + 1) * cell;
    var col = COLORS[type];
    var out = '<svg width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '" aria-hidden="true">';
    cells.forEach(function (c) {
      var x = (c[0] - minX) * cell, y = (c[1] - minY) * cell;
      out += '<rect x="' + (x + 1) + '" y="' + (y + 1) + '" width="' + (cell - 2) + '" height="' + (cell - 2) + '" rx="3" fill="' + col + '"/>';
      out += '<rect x="' + (x + 3) + '" y="' + (y + 3) + '" width="' + (cell - 6) + '" height="2.5" fill="rgba(255,255,255,.32)"/>';
      out += '<rect x="' + (x + 3) + '" y="' + (y + cell - 5.5) + '" width="' + (cell - 6) + '" height="2.5" fill="rgba(0,0,0,.18)"/>';
    });
    return out + '</svg>';
  }

  // ---------- bot face ----------

  function stress() {
    var f = E.features(S.rows);
    return clamp((f.maxH - 3) / 15, 0, 1) * 82 + Math.min(f.holes, 9) * 2;
  }

  function baseMood() {
    if (S.phase === 'over') return S.result === 'win' ? 'dead' : 'happy';
    var st = stress();
    return st < 22 ? 'smug' : st < 45 ? 'calm' : st < 70 ? 'worried' : 'panic';
  }

  var moodTimer = null;
  function setMood(m, ms) {
    S.moodTemp = m;
    S.moodUntil = performance.now() + ms;
    renderFace();
    clearTimeout(moodTimer);
    moodTimer = sc.timeout(renderFace, ms + 20);
  }

  function renderFace() {
    var m = (S.moodTemp && performance.now() < S.moodUntil && S.phase !== 'over') ? S.moodTemp : baseMood();
    var holder = $('#face');
    if (holder.dataset.mood !== m || holder.dataset.bot !== S.botId) {
      holder.innerHTML = A.face(S.botId, m);
      holder.dataset.mood = m;
      holder.dataset.bot = S.botId;
    }
    var st = stress();
    var dead = S.phase === 'over' && S.result === 'win';
    var fill = $('#nerves-fill');
    fill.style.width = (dead ? 100 : clamp(st, 3, 100)) + '%';
    fill.style.background = dead ? '#E0553E' : st < 22 ? '#7CC47F' : st < 45 ? '#C9C866' : st < 70 ? '#E2B24C' : '#E0553E';
    $('#nerves-word').textContent = dead ? 'Broken' : st < 22 ? 'Relaxed' : st < 45 ? 'Focused' : st < 70 ? 'Sweating' : 'Panicking';
  }

  function faceAnim(cls) {
    if (reduceMotion) return;
    var f = $('#face');
    f.classList.remove('bump', 'cheer');
    void f.getBoundingClientRect();
    f.classList.add(cls);
  }

  function say(text) {
    if (!text) return;
    S.lastLine = text;
    var b = $('#bubble');
    b.textContent = text;
    b.classList.remove('pop');
    void b.offsetWidth;
    b.classList.add('pop');
  }

  // ---------- previews ----------

  function remainingFor(i) {
    var r = S.hand.filter(function (_, k) { return k !== i; });
    if (E.BOTS[S.botId].knowsDeck) r.push(S.deck.peek());
    return r;
  }

  function computePreviews() {
    S.previews = S.hand.map(function (t, i) {
      return E.decide(S.rows, t, S.botId, {
        turn: S.dealt,
        spinLock: S.armed.spin,
        shove: S.armed.shove,
        remaining: remainingFor(i)
      });
    });
  }

  function reserved() {
    return (S.armed.spin ? cost('spin') : 0) + (S.armed.shove ? cost('shove') : 0);
  }

  // ---------- panels ----------

  function renderSeat() {
    var L = A.LEVEL_MAP[S.botId];
    $('#bot-name').textContent = L.name;
    $('#bot-level').textContent = L.rank;
    $('#bot-blurb').textContent = botInfo().blurb;
    renderFace();
  }

  var lastPointer = window.matchMedia && window.matchMedia('(pointer: coarse)').matches ? 'touch' : 'mouse';

  function renderHand(newIdx) {
    var el = $('#hand');
    el.innerHTML = '';
    el.classList.toggle('busy', S.phase !== 'idle');
    S.hand.forEach(function (t, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'card' + (i === S.hover ? ' is-preview' : '') + (newIdx === 'all' || newIdx === i ? ' dealt-in' : '');
      b.style.setProperty('--fan', ((i - (S.hand.length - 1) / 2) * 5) + 'deg');
      b.style.setProperty('--c', COLORS[t]);
      b.setAttribute('aria-label', 'Deal the ' + t + ' piece, key ' + (i + 1));
      b.innerHTML = '<span class="card-corner">' + t + '</span><span class="card-art">' + pieceSVG(t, 15) + '</span>' +
        '<span class="card-key">' + (i + 1) + '</span><span class="card-corner flip">' + t + '</span>';
      b.addEventListener('pointerdown', function (e) { lastPointer = e.pointerType || 'mouse'; });
      b.addEventListener('pointerenter', function (e) { if (e.pointerType !== 'touch') setHover(i); });
      b.addEventListener('pointerleave', function (e) { if (e.pointerType !== 'touch') setHover(-1); });
      b.addEventListener('focus', function () { if (lastPointer !== 'touch') setHover(i); });
      b.addEventListener('blur', function () { setHover(-1); });
      b.addEventListener('click', function () {
        if (S.phase !== 'idle') return;
        if (lastPointer === 'touch' && S.hover !== i) { setHover(i); return; }
        deal(i);
      });
      el.appendChild(b);
    });
  }

  function setHover(i) {
    if (S.phase !== 'idle' && i >= 0) return;
    S.hover = i;
    Array.prototype.forEach.call($('#hand').children, function (c, k) { c.classList.toggle('is-preview', k === i); });
    renderPlan();
    draw();
  }

  function renderLedger() {
    var b = botInfo();
    var t = b.stars;
    $('#dealt').textContent = S.dealt;
    $('#budget').textContent = b.budget;
    var bar = $('#budget-bar');
    $('#budget-fill').style.width = (S.dealt / b.budget * 100) + '%';
    bar.classList.toggle('late', S.dealt > t[1]);
    Array.prototype.slice.call(bar.querySelectorAll('.tick')).forEach(function (n) { n.remove(); });
    var crowded = (t[1] - t[0]) / b.budget < 0.16;
    [[t[0], '3 stars'], [t[1], '2 stars']].forEach(function (p) {
      var tick = document.createElement('div');
      tick.className = 'tick';
      tick.style.left = (p[0] / b.budget * 100) + '%';
      tick.title = p[1] + ' at ' + p[0] + ' pieces or fewer';
      tick.innerHTML = crowded ? '' : '<span>' + p[1] + '</span>';
      bar.appendChild(tick);
    });
    $('#budget-note').textContent = 'Bury it within ' + t[0] + ' for 3 stars, ' + t[1] + ' for 2.';

    var f = E.features(S.rows);
    $('#st-lines').textContent = S.lines;
    var hEl = $('#st-holes');
    hEl.textContent = f.holes;
    hEl.className = f.holes >= 8 ? 'hot' : f.holes >= 4 ? 'warn' : '';
    var tEl = $('#st-height');
    tEl.textContent = f.maxH > VISIBLE ? 'Over' : f.maxH + ' / ' + VISIBLE;
    tEl.className = f.maxH >= 16 ? 'hot' : f.maxH >= 11 ? 'warn' : '';

    var res = reserved();
    $('#points-text').textContent = S.points - res + ' of ' + MAX_POINTS + (res ? ' (' + res + ' held)' : '');
    var pips = $('#pips');
    pips.innerHTML = '';
    for (var p = 0; p < MAX_POINTS; p++) {
      var pip = document.createElement('span');
      pip.className = 'pip' + (p < S.points - res ? ' on' : p < S.points ? ' held' : '');
      pips.appendChild(pip);
    }

    renderPowers();

    var best = A.progress(GAME)[S.botId];
    $('#best').textContent = best
      ? 'Your best against ' + botName() + ': ' + best.score + ' pieces, ' + best.stars + (best.stars === 1 ? ' star.' : ' stars.')
      : botName() + ' has not been buried yet.';
  }

  var POWER_ICONS = {
    junk: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="1" y="14" width="5" height="5" rx="1"/><rect x="7" y="14" width="5" height="5" rx="1"/><rect x="18" y="14" width="5" height="5" rx="1"/><path d="M12 11V4M9 7l3-3 3 3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    shoveL: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12H5M10 6l-6 6 6 6"/></svg>',
    shoveR: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12h15M14 6l6 6-6 6"/></svg>',
    shove: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h18M7 8l-4 4 4 4M17 8l4 4-4 4"/></svg>',
    spin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12a8 8 0 1 1-3-6.2"/><path d="M17 2v4h-4"/><path d="M4 20L20 4"/></svg>',
    redraw: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="3" y="5" width="11" height="15" rx="2"/><path d="M10 5V4a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2h-5"/></svg>'
  };

  function renderPowers() {
    var wrap = $('#powers');
    if (!wrap.children.length) {
      POWER_ORDER.forEach(function (id) {
        var p = POWERS[id];
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'chip';
        b.dataset.power = id;
        b.title = p.tip;
        b.innerHTML = '<span class="chip-disc"><span class="chip-face"></span><span class="chip-key">' + p.key + '</span></span>' +
          '<span class="chip-name">' + p.name + '</span><span class="chip-cost"></span>';
        b.addEventListener('click', function () { usePower(id); });
        wrap.appendChild(b);
      });
    }
    var free = S.points - reserved();
    Array.prototype.forEach.call(wrap.children, function (b) {
      var id = b.dataset.power, p = POWERS[id], c = cost(id);
      var armed = id === 'spin' ? S.armed.spin : id === 'shove' ? S.armed.shove !== 0 : false;
      b.disabled = !(S.phase === 'idle' && !A.isBoss() && (armed || free >= c));
      if (id === 'spin' || id === 'shove') b.setAttribute('aria-pressed', String(armed));
      var icon = id === 'shove' ? (S.armed.shove === -1 ? 'shoveL' : S.armed.shove === 1 ? 'shoveR' : 'shove') : id;
      var face = b.querySelector('.chip-face');
      if (face.dataset.icon !== icon) { face.innerHTML = POWER_ICONS[icon]; face.dataset.icon = icon; }
      b.querySelector('.chip-cost').textContent = c + ' pts';
      var label = p.name + ', costs ' + c + ' points, key ' + p.key;
      if (id === 'shove') {
        label += S.armed.shove === -1 ? '. Armed: left. Press again for right.' : S.armed.shove === 1 ? '. Armed: right. Press again to cancel.' : '';
        b.querySelector('.chip-name').textContent = S.armed.shove === -1 ? 'Shove left' : S.armed.shove === 1 ? 'Shove right' : 'Shove';
      }
      b.setAttribute('aria-label', label);
    });
  }

  function renderPlan() {
    var el = $('#plan');
    if (S.phase === 'over') {
      el.innerHTML = '<p class="plan-empty">Game over. Start a new deal or replay the same one.</p>';
      return;
    }
    var armed = [];
    if (S.armed.spin) armed.push('spin lock');
    if (S.armed.shove) armed.push('shove ' + (S.armed.shove < 0 ? 'left' : 'right'));
    var armedLine = armed.length ? '<p class="armed">Armed for the next card: ' + armed.join(' and ') + '.</p>' : '';

    var i = S.hover;
    if (S.phase !== 'idle' || i < 0 || !S.previews[i]) {
      var how = lastPointer === 'touch' ? 'Tap a card' : 'Point at a card';
      el.innerHTML = '<p class="plan-empty">' + how + ' to see exactly where ' + botName() + ' will put it.' +
        (lastPointer === 'touch' ? ' Tap it again to deal it.' : ' Click it to deal it.') + '</p>' + armedLine;
      return;
    }
    var d = S.previews[i];
    var t = S.hand[i];
    var head = '<p class="plan-head">If you deal <span class="chip-tag" style="--c:' + COLORS[t] + '">' + t + '</span></p>';
    if (d.result.topOut) {
      el.innerHTML = head + '<p class="win">This one buries it.</p>' + armedLine;
      return;
    }
    var before = E.features(S.rows), after = E.features(d.result.rows);
    var items = [];
    if (d.result.cleared) items.push('<li class="bad">Clears ' + d.result.cleared + ' line' + (d.result.cleared > 1 ? 's' : '') + '</li>');
    else items.push('<li>No lines cleared</li>');
    if (after.holes > before.holes) items.push('<li class="good">Holes go from ' + before.holes + ' to ' + after.holes + '</li>');
    else if (after.holes < before.holes) items.push('<li class="bad">Holes drop from ' + before.holes + ' to ' + after.holes + '</li>');
    else items.push('<li>Holes stay at ' + after.holes + '</li>');
    items.push('<li' + (after.maxH > before.maxH ? ' class="good"' : '') + '>Tallest column ' + after.maxH + ' of ' + VISIBLE + '</li>');
    if (d.shoved) items.push('<li class="good">Shove knocks it one column ' + (S.armed.shove < 0 ? 'left' : 'right') + '</li>');
    if (d.shoveBlocked) items.push('<li>Shove is blocked here</li>');
    el.innerHTML = head + '<ul>' + items.join('') + '</ul>' + armedLine;
  }

  function renderAll(newIdx) {
    renderSeat();
    renderHand(newIdx);
    renderLedger();
    renderPlan();
    draw();
  }

  // ---------- game flow ----------

  function newGame(seed) {
    A.closeModal(true);
    S.gameId++;
    S.seed = seed != null ? seed : (Math.floor(Math.random() * 4294967296) >>> 0);
    S.deck = new E.Deck(S.seed);
    S.junkRand = E.rng((S.seed ^ 0x5bd1e995) >>> 0);
    S.rows = E.emptyRows();
    S.colors = makeColors();
    S.hand = [S.deck.draw(), S.deck.draw(), S.deck.draw()];
    S.dealt = 0;
    S.lines = 0;
    S.points = botInfo().econ.start;
    S.armed = { shove: 0, spin: false };
    S.phase = 'idle';
    S.result = null;
    S.hover = -1;
    S.active = null;
    S.flash = null;
    S.rise = 0;
    S.buried = -1;
    S.lastType = null;
    S.moodTemp = null;
    computePreviews();
    renderAll('all');
    say(pick(botInfo().start));
  }

  function midGame() { return S.phase !== 'over' && S.dealt >= 4; }

  function placeColors(pl) {
    E.cellsOf(pl.type, pl.rot, pl.x, pl.y).forEach(function (c) { S.colors[c[1]][c[0]] = pl.type; });
  }

  function removeRows(rowsToClear) {
    var keep = S.colors.filter(function (_, y) { return rowsToClear.indexOf(y) < 0; });
    while (keep.length < H) keep.unshift(new Array(W).fill(null));
    S.colors = keep;
  }

  function flyCard(i) {
    var el = $('#hand').children[i];
    if (!el || factor() === 0 || reduceMotion) return Promise.resolve();
    var from = el.getBoundingClientRect();
    var cv = cvs.getBoundingClientRect();
    var clone = el.cloneNode(true);
    clone.classList.add('flying');
    clone.classList.remove('is-preview', 'dealt-in');
    clone.style.left = from.left + 'px';
    clone.style.top = from.top + 'px';
    document.body.appendChild(clone);
    el.style.visibility = 'hidden';
    var tx = cv.left + (E.SPAWN_X + 2) * CELL - (from.left + from.width / 2);
    var ty = cv.top + CELL - (from.top + from.height / 2);
    if (!clone.animate) { clone.remove(); return Promise.resolve(); }
    var anim = clone.animate([
      { transform: 'translate(0,0) rotate(0deg) scale(1)', opacity: 1 },
      { transform: 'translate(' + tx + 'px,' + ty + 'px) rotate(-8deg) scale(.32)', opacity: 0.2 }
    ], { duration: 300 * factor(), easing: 'cubic-bezier(.3,.6,.35,1)' });
    return anim.finished.then(function () { clone.remove(); }, function () { clone.remove(); });
  }

  async function deal(i) {
    if (S.phase !== 'idle' || A.isBoss() || !S.hand[i]) return;
    var gid = S.gameId;
    var d = S.previews[i];
    var type = S.hand[i];
    var usedSpin = S.armed.spin, usedShove = S.armed.shove;
    S.points -= reserved();
    S.armed = { shove: 0, spin: false };
    S.phase = 'anim';
    S.hover = -1;
    $('#hand').classList.add('busy');
    renderLedger();
    renderPlan();
    sfx('deal');
    await flyCard(i);
    if (gid !== S.gameId) return;

    S.hand.splice(i, 1);
    renderHand();

    var target = d.intended || d.placement;
    S.active = { type: type, rot: 0, x: E.SPAWN_X, y: 0 };
    draw();
    await wait(110);
    if (gid !== S.gameId) return;

    if (usedSpin) {
      say(pick(LINES.spin));
      setMood('surprised', 900);
      for (var w = 0; w < 3; w++) {
        S.active.x = E.SPAWN_X + (w % 2 ? -0.12 : 0.12); draw(); await wait(60);
      }
      S.active.x = E.SPAWN_X; draw();
      if (gid !== S.gameId) return;
    }

    var path = E.ROT_PATH[target.rot];
    for (var r = 0; r < path.length; r++) {
      S.active.rot = path[r]; draw(); sfx('tick');
      await wait(70);
      if (gid !== S.gameId) return;
    }
    while (S.active.x !== target.x) {
      S.active.x += target.x > S.active.x ? 1 : -1;
      draw(); sfx('tick');
      await wait(42);
      if (gid !== S.gameId) return;
    }

    if (usedShove) {
      await wait(130);
      if (gid !== S.gameId) return;
      if (d.shoved) {
        S.active.x = d.placement.x;
        draw();
        say(pick(LINES.shove));
        setMood('surprised', 1100);
        faceAnim('bump');
        kick(1);
        sfx('shove');
        await wait(170);
      } else {
        say(pick(LINES.shoveBlocked));
        setMood('smug', 1100);
        await wait(140);
      }
      if (gid !== S.gameId) return;
    }

    var endY = d.placement.y;
    await tween(80 + endY * 9, function (t) { S.active.y = endY * t * t; draw(); });
    if (gid !== S.gameId) return;

    var before = E.features(S.rows);
    S.active = null;
    placeColors(d.placement);
    sfx('lock');
    kick(0.35);
    if (d.result.cleared) {
      var cr = d.result.clearedRows.slice();
      S.flash = { rows: cr, alpha: 0 };
      sfx('clear');
      await tween(240, function (t) { S.flash.alpha = 0.85 * Math.sin(t * Math.PI); draw(); });
      S.flash = null;
      if (gid !== S.gameId) return;
      removeRows(cr);
    }
    S.rows = d.result.rows;
    S.dealt++;
    S.lines += d.result.cleared;
    S.points = Math.min(MAX_POINTS, S.points + 1);
    draw();

    if (d.result.topOut) return win();
    if (S.dealt >= botInfo().budget) return lose();

    S.hand.push(S.deck.draw());
    computePreviews();
    S.phase = 'idle';
    react(before, d, type, usedShove || usedSpin);
    S.lastType = type;
    renderHand(S.hand.length - 1);
    renderLedger();
    renderPlan();
    renderFace();
    draw();
  }

  function react(before, d, type, alreadyTalked) {
    var after = E.features(S.rows);
    var newHoles = after.holes - before.holes;
    var st = stress();
    if (d.result.cleared >= 4) { say(pick(LINES.tetris)); setMood('happy', 1500); faceAnim('cheer'); return; }
    if (d.result.cleared >= 1) { say(pick(LINES.clear)); setMood('happy', 1200); faceAnim('cheer'); return; }
    if (newHoles >= 2) { say(pick(LINES.holes)); setMood('annoyed', 1300); return; }
    if (alreadyTalked) return;
    if (newHoles === 1 && Math.random() < 0.6) { say(pick(LINES.hole)); setMood('annoyed', 1100); return; }
    if (st >= 72 && Math.random() < 0.7) { say(pick(LINES.panic)); return; }
    if (st >= 48 && Math.random() < 0.45) { say(pick(LINES.worried)); return; }
    if ((type === 'S' || type === 'Z') && (S.lastType === 'S' || S.lastType === 'Z') && Math.random() < 0.6) { say(pick(LINES.sz)); return; }
    if (Math.random() < 0.2) say(pick(LINES.idle));
  }

  async function usePower(id) {
    if (S.phase !== 'idle' || A.isBoss()) return;
    var c = cost(id);
    var free = S.points - reserved();
    if (id === 'spin') {
      if (!S.armed.spin && free < c) return;
      S.armed.spin = !S.armed.spin;
      return afterArm();
    }
    if (id === 'shove') {
      if (S.armed.shove === 0) {
        if (free < c) return;
        S.armed.shove = -1;
      } else if (S.armed.shove === -1) {
        S.armed.shove = 1;
      } else {
        S.armed.shove = 0;
      }
      return afterArm();
    }
    if (free < c) return;
    if (id === 'redraw') {
      S.points -= c;
      S.hand = [S.deck.draw(), S.deck.draw(), S.deck.draw()];
      sfx('redraw');
      say(pick(LINES.redraw));
      computePreviews();
      renderHand('all');
      renderLedger();
      renderPlan();
      draw();
      return;
    }
    if (id === 'junk') {
      var gid = S.gameId;
      S.points -= c;
      S.phase = 'anim';
      $('#hand').classList.add('busy');
      var gap = Math.floor(S.junkRand() * W);
      var res = E.addJunk(S.rows, gap);
      S.colors.shift();
      var row = new Array(W).fill('X');
      row[gap] = null;
      S.colors.push(row);
      S.rows = res.rows;
      S.rise = 1;
      renderLedger();
      renderPlan();
      sfx('junk');
      say(pick(LINES.junk));
      setMood('surprised', 1100);
      faceAnim('bump');
      await tween(240, function (t) { S.rise = (1 - t) * (1 - t); draw(); });
      S.rise = 0;
      if (gid !== S.gameId) return;
      kick(0.6);
      if (res.topOut) return win();
      S.phase = 'idle';
      computePreviews();
      renderHand();
      renderLedger();
      renderPlan();
      renderFace();
      draw();
    }
  }

  function afterArm() {
    computePreviews();
    renderLedger();
    renderPlan();
    draw();
  }

  async function win() {
    var gid = S.gameId;
    S.phase = 'over';
    S.result = 'win';
    S.hover = -1;
    var b = botInfo();
    say(pick(b.win));
    renderFace();
    renderPlan();
    $('#hand').classList.add('busy');
    sfx('win');
    kick(1.2);
    await tween(700, function (t) { S.buried = Math.floor(t * H); draw(); });
    if (gid !== S.gameId) return;
    S.buried = H;
    draw();

    var stars = starsFor(S.dealt);
    var rec = A.record(GAME, S.botId, { stars: stars, score: S.dealt, lowerIsBetter: true, text: S.dealt + ' pieces' });
    // leaderboard: 400 for the win, 20 per unused piece, 100 per star
    A.account.submit(GAME, S.botId, A.points(S.botId, 400 + 20 * (b.budget - S.dealt) + 100 * stars), 'Buried in ' + S.dealt + ' pieces');
    bar.refresh();
    renderLedger();
    var next = ORDER[ORDER.indexOf(S.botId) + 1];
    var bestLine = rec.better
      ? (rec.prev ? 'New best! Down from ' + rec.prev.score + '.' : 'First win against ' + botName() + '.')
      : 'Your best is still ' + rec.prev.score + ' pieces.';
    var buttons = [];
    if (next) buttons.push({ label: 'Take on ' + botName(next), kind: 'main', onClick: function () { switchTo(next); } });
    buttons.push({ label: 'New deal', kind: next ? 'line' : 'main', onClick: function () { newGame(); } });
    buttons.push({ label: 'Same deal again', kind: 'line', onClick: function () { newGame(S.seed); } });
    A.modal({
      title: S.botId === 'edith' ? 'You buried Edith.' : 'Buried.',
      tone: 'win',
      html: '<p class="lead">' + botName() + ' topped out after ' + S.dealt + ' piece' + (S.dealt === 1 ? '' : 's') + '. It cleared ' +
        S.lines + ' line' + (S.lines === 1 ? '' : 's') + ' on the way down.</p>' + A.stars(stars) +
        '<p><strong>' + bestLine + '</strong></p>' +
        (stars < 3 ? '<p class="soft">For 3 stars, bury it within ' + b.stars[0] + ' pieces.</p>' : ''),
      buttons: buttons,
      link: { label: 'Close and look at the board' }
    });
  }

  async function lose() {
    S.phase = 'over';
    S.result = 'lose';
    S.hover = -1;
    var b = botInfo();
    say(pick(b.lose));
    faceAnim('cheer');
    renderFace();
    renderLedger();
    renderPlan();
    $('#hand').classList.add('busy');
    sfx('lose');
    // leaderboard consolation: 10 per row of the tallest stack you forced
    A.account.submit(GAME, S.botId, A.points(S.botId, 10 * E.features(S.rows).maxH), 'Stack reached ' + E.features(S.rows).maxH + ' rows');
    var gid = S.gameId;
    await wait(500);
    if (gid !== S.gameId) return;
    A.modal({
      title: 'It survived.',
      tone: 'lose',
      html: '<p class="lead">' + botName() + ' lasted all ' + b.budget + ' pieces and cleared ' + S.lines + ' lines.</p>' +
        '<p class="soft">Tip: ' + TIPS[Math.floor(Math.random() * TIPS.length)] + '</p>',
      buttons: [
        { label: 'New deal', kind: 'main', onClick: function () { newGame(); } },
        { label: 'Same deal again', kind: 'line', onClick: function () { newGame(S.seed); } }
      ],
      link: { label: 'Close and look at the board' }
    });
  }

  function switchTo(id) {
    S.botId = id;
    bar.setLevel(id);
    newGame();
  }

  // ---------- help ----------

  function openHelp() {
    var rows = ORDER.map(function (id) {
      var L = A.LEVEL_MAP[id], b = BOTS[id];
      return '<div><dt>' + L.name + ', ' + L.rank.toLowerCase() + '</dt><dd>' + b.blurb + ' ' + b.budget + ' pieces to bury it.</dd></div>';
    }).join('');
    A.modal({
      title: 'How to play',
      wide: true,
      html:
        '<ol><li>You are the dealer. Each turn, deal one of the three cards in your hand.</li>' +
        '<li>The bot drops that piece wherever it thinks is best. Point at a card to see exactly where it will go.</li>' +
        '<li>If any block is left above the red line, the bot is buried and you win.</li>' +
        '<li>You only get so many pieces to do it. The fewer you use, the more stars you earn.</li>' +
        '<li>Cards come from shuffled sets of seven, so each piece shows up once per set. Spamming S and Z will not work, but timing them will.</li></ol>' +
        '<h3>Mischief</h3><p>You earn 1 point for every card you deal, up to 10. Spend them on:</p>' +
        '<dl><div><dt>Junk row</dt><dd>Push a gray row with one gap up from the bottom.</dd></div>' +
        '<div><dt>Shove</dt><dd>After the bot aims, its piece gets bumped one column. Click again to switch direction.</dd></div>' +
        '<div><dt>Spin lock</dt><dd>The bot cannot rotate its next piece.</dd></div>' +
        '<div><dt>Redraw</dt><dd>Swap your whole hand for three new cards.</dd></div></dl>' +
        '<p class="soft">Shove and spin lock apply to the next card you deal, and the preview already includes them. Prices are on each chip and go up against Edith.</p>' +
        '<h3>Opponents</h3><dl>' + rows + '</dl>' +
        '<h3>Keys</h3><table class="keys">' +
        '<tr><td><kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd></td><td>Deal a card</td></tr>' +
        '<tr><td><kbd>Q</kbd> <kbd>W</kbd> <kbd>E</kbd> <kbd>R</kbd></td><td>Junk row, shove, spin lock, redraw</td></tr>' +
        '<tr><td><kbd>N</kbd></td><td>New deal</td></tr>' +
        '<tr><td><kbd>B</kbd></td><td>Hide the game behind a dull spreadsheet. Press again to come back.</td></tr>' +
        '<tr><td><kbd>?</kbd></td><td>This help</td></tr></table>',
      buttons: [{ label: 'Start dealing', kind: 'main' }]
    });
  }

  // ---------- controls ----------

  var bar = A.mountBar({
    el: $('#bar'),
    game: GAME,
    title: 'Bury the Bot',
    tagline: 'You deal the pieces. It tries to survive.',
    level: S.botId,
    levelLabel: 'Opponent',
    canSwitch: function (id) {
      return midGame() ? 'The current game against ' + botName() + ' will be dropped.' : true;
    },
    onLevel: function (id) { S.botId = id; newGame(); },
    onHelp: openHelp
  });
  sc.add(bar.destroy);

  function setSpeedLabel() { $('#btn-speed').textContent = 'Speed: ' + S.speed; }
  $('#btn-speed').addEventListener('click', function () {
    S.speed = SPEED_ORDER[(SPEED_ORDER.indexOf(S.speed) + 1) % SPEED_ORDER.length];
    A.store.set('btb-speed', S.speed);
    setSpeedLabel();
  });
  $('#btn-new').addEventListener('click', function () {
    if (!midGame()) return newGame();
    A.confirm({ title: 'New deal?', text: 'This game will be dropped and you get a fresh deck.', yes: 'Deal again', no: 'Keep playing', onYes: function () { newGame(); } });
  });
  $('#btn-rematch').addEventListener('click', function () {
    if (!midGame()) return newGame(S.seed);
    A.confirm({ title: 'Same deal again?', text: 'This exact deal restarts from the very first card.', yes: 'Restart the deal', no: 'Keep playing', onYes: function () { newGame(S.seed); } });
  });
  sc.add(A.onBoss(function () { renderPowers(); }));

  sc.on(document, 'keydown', function (e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    var k = e.key.toLowerCase();
    lastPointer = 'keyboard';
    if (k === '1' || k === '2' || k === '3') { e.preventDefault(); deal(Number(k) - 1); return; }
    if (k === 'q') { usePower('junk'); return; }
    if (k === 'w') { usePower('shove'); return; }
    if (k === 'e') { usePower('spin'); return; }
    if (k === 'r') { usePower('redraw'); return; }
    if (k === 'n') { $('#btn-new').click(); return; }
    if (k === '?' || k === 'h') { openHelp(); return; }
  });

  var resizeTimer = null;
  sc.on(window, 'resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = sc.timeout(layout, 80);
  });

  // ---------- start ----------

  setSpeedLabel();
  newGame();
  layout();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { if (sc.alive()) layout(); });
  if (A.firstVisit(GAME)) openHelp();

  window.buryTheBot = { state: S, newGame: newGame };
  return sc.dispose;
}
