/*
 * Coffee Spill: drawing the desk, the pen and eraser, the countdown, the pour, and the end screen.
 * mount() runs after window.Arcade is ready (components/PageShell.jsx) and returns a cleanup function.
 */
import E from './engine.js';

export function mount() {
  var A = window.Arcade;
  var sc = A.scope();
  var GAME = 'coffee-spill';
  var ORDER = ['pip', 'gridlock', 'monolith', 'edith'];
  var W = E.W, H = E.H, TICK = 1 / 30;

  function $(s) { return document.querySelector(s); }

  var S = {
    level: A.lastLevel(GAME),
    desk: null,
    tool: 'ink',
    phase: 'plan',   // plan, pour, over
    planLeft: 0,
    paused: false,
    acc: 0,
    lastFrame: 0,
    drawing: false,
    last: null,
    lastLine: '',
    lastSay: 0,
    flashUntil: 0,
    lastHits: 0,
    endShown: false
  };

  var TALK = {
    pip: {
      blurb: 'A clumsy pourer. Wobbles around somewhere near the laptop.',
      start: ['I am going to pour you a coffee! On the desk. Oops.', 'Careful, careful... I am never careful.', 'Who wants coffee? The laptop wants coffee!'],
      pour: ['Whoops!', 'Wheee!', 'Is this too much? This feels like too much.'],
      zap: ['Oh no, the laptop!', 'Sparkly!'], blocked: ['Hey, a wall!', 'Where did that come from?'],
      win: ['The laptop survived? Phew! I mean, darn.'], lose: ['Uh oh. Is it supposed to smoke?']
    },
    gridlock: {
      blurb: 'Creeps along the top until it is right above the laptop, then pours.',
      start: ['Target: laptop. Approach: direct.', 'I will be right above the keyboard shortly.', 'Pouring directly onto the problem.'],
      pour: ['Pouring on target.', 'Adjusting position.'], zap: ['Direct hit.', 'Keyboard located.'], blocked: ['Obstruction noted.', 'Walls are cheating.'],
      win: ['The laptop is dry. Unacceptable.'], lose: ['Laptop: offline. As intended.']
    },
    monolith: {
      blurb: 'Traces where the coffee would flow from every spot along the top and moves to wherever it reaches the laptop.',
      start: ['I can see every path your walls leave open.', 'Coffee always finds the gap.', 'Draw whatever you like. I will flow around it.'],
      pour: ['That path looks promising.', 'Following the gap.'], zap: ['Found the gap.', 'Your wall had a hole.'], blocked: ['Hm. Sealed.', 'A good wall. Searching.'],
      win: ['Every path was blocked. Impressive.'], lose: ['Liquid always wins.']
    },
    edith: {
      blurb: 'Traces several paths at once and re-plans constantly. Your ink is short and a buzzing phone smudges whatever it touches.',
      start: ['Coffee time! For the laptop, mostly.', 'Edith\'s phone is buzzing! Watch your lines, hee hee.', 'I see three gaps already. Want me to point them out? No!'],
      pour: ['Ooh, over here!', 'Edith found a leak!', 'Splish splash!'], zap: ['Bullseye!', 'Hee hee, sizzle!'], blocked: ['Hmph. Sneaky walls.', 'Fine, I will find another way.'],
      win: ['Edith\'s coffee... missed?! Edith never misses!'], lose: ['Oopsie. That laptop looked thirsty!']
    }
  };

  function pick(arr) {
    var c = arr.filter(function (l) { return l !== S.lastLine; });
    c = c.length ? c : arr;
    return c[Math.floor(Math.random() * c.length)];
  }
  function L() { return A.LEVEL_MAP[S.level]; }
  function cfg() { return E.LEVELS[S.level]; }

  function say(text, mood, force) {
    var now = performance.now();
    if (!force && now - S.lastSay < 2500) return;
    S.lastSay = now;
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
    renderPot(mood);
  }

  var lastBuzz = 0;
  function sfx(kind) {
    switch (kind) {
      case 'pour': A.noise(0.6, 0.05, 0, 900, 0.6); A.tone(500, 0.3, 'sine', 0.03, 0, 300); break;
      case 'ink': A.tone(880 + Math.random() * 200, 0.02, 'triangle', 0.012); break;
      case 'erase': A.noise(0.05, 0.02, 0, 3000, 1); break;
      case 'zap': A.noise(0.12, 0.07, 0, 4200, 2); A.tone(1400, 0.1, 'square', 0.03, 0, 300); break;
      case 'full': A.jingle('good'); break;
      case 'buzz': if (performance.now() - lastBuzz > 500) { lastBuzz = performance.now(); A.tone(120, 0.2, 'sawtooth', 0.02); } break;
      case 'tick': A.tone(780, 0.04, 'square', 0.015); break;
    }
  }

  // ---------- drawing ----------

  var cvs = $('#desk'), ctx = cvs.getContext('2d'), CW = 7;
  var base = null, cells = document.createElement('canvas'), cctx = null, img = null;
  cells.width = W;
  cells.height = H;
  cctx = cells.getContext('2d');
  img = cctx.createImageData(W, H);

  function layout() {
    var w = cvs.parentNode.clientWidth;
    CW = w / W;
    var dpr = window.devicePixelRatio || 1;
    cvs.width = Math.round(W * CW * dpr);
    cvs.height = Math.round(H * CW * dpr);
    cvs.style.height = H * CW + 'px';
    ctx.setTransform(CW * dpr, 0, 0, CW * dpr, 0, 0);
    base = null;
    draw();
  }

  function rr(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }

  function bake() {
    var d = S.desk, dpr = window.devicePixelRatio || 1;
    base = document.createElement('canvas');
    base.width = cvs.width;
    base.height = cvs.height;
    var g = base.getContext('2d');
    g.setTransform(CW * dpr, 0, 0, CW * dpr, 0, 0);
    // wood
    g.fillStyle = '#C8935E';
    g.fillRect(0, 0, W, H);
    var r = E.rng(11);
    for (var i = 0; i < 26; i++) {
      g.strokeStyle = i % 2 ? 'rgba(122,74,44,.18)' : 'rgba(255,240,220,.16)';
      g.lineWidth = 0.6 + r() * 0.8;
      g.beginPath();
      var y = r() * H;
      g.moveTo(0, y);
      g.bezierCurveTo(W * 0.3, y + (r() - 0.5) * 6, W * 0.7, y + (r() - 0.5) * 6, W, y + (r() - 0.5) * 4);
      g.stroke();
    }
    g.lineWidth = 0.45;
    g.strokeStyle = '#1D1A33';
    // books and the stapler
    d.objects.forEach(function (o, k) {
      if (o.kind === 'stapler') {
        g.fillStyle = '#E8504A'; rr(g, o.x, o.y, o.w, o.h, 1.6); g.fill(); g.stroke();
        g.fillStyle = '#9AA3AD'; g.fillRect(o.x + 1, o.y + o.h - 2, o.w - 2, 1.2);
        return;
      }
      var cols = ['#3D86F0', '#2FBF71', '#FFC93C', '#B07CC6', '#FF6B57'], n = Math.max(1, Math.round(o.h / 2.5));
      for (var b = 0; b < n; b++) {
        var bh = o.h / n;
        g.fillStyle = cols[(b + k) % cols.length];
        rr(g, o.x + (b % 2 ? 0.6 : 0), o.y + b * bh, o.w - 0.6, bh, 0.5); g.fill(); g.stroke();
        g.fillStyle = 'rgba(255,255,255,.55)'; g.fillRect(o.x + 1.2 + (b % 2 ? 0.6 : 0), o.y + b * bh + bh * 0.35, o.w - 3, bh * 0.25);
      }
    });
    // mugs
    d.mugs.forEach(function (m, i) {
      var col = i ? '#3D86F0' : '#2FBF71';
      g.fillStyle = col;
      g.beginPath();
      g.moveTo(m.x, m.y); g.lineTo(m.x + m.w, m.y); g.lineTo(m.x + m.w, m.y + m.h - 2); g.arcTo(m.x + m.w, m.y + m.h, m.x + m.w - 2, m.y + m.h, 2);
      g.lineTo(m.x + 2, m.y + m.h); g.arcTo(m.x, m.y + m.h, m.x, m.y + m.h - 2, 2); g.closePath();
      g.fill(); g.stroke();
      g.fillStyle = '#F7E8D6'; g.fillRect(m.x + 2, m.y, m.w - 4, m.h - 2);
      g.lineWidth = 1.2;
      g.beginPath(); g.arc(i ? m.x - 0.4 : m.x + m.w + 0.4, m.y + m.h * 0.45, 3.2, i ? Math.PI * 0.5 : -Math.PI * 0.5, i ? Math.PI * 1.5 : Math.PI * 0.5); g.strokeStyle = col; g.stroke();
      g.lineWidth = 0.45; g.strokeStyle = '#1D1A33';
    });
    // laptop
    var lp = d.laptop;
    g.fillStyle = '#C9D3DC'; rr(g, lp.x, lp.y, lp.w, lp.h - 3, 1.4); g.fill(); g.stroke();
    g.fillStyle = '#E4E9EE'; rr(g, lp.x - 2, lp.y + lp.h - 3, lp.w + 4, 3, 1); g.fill(); g.stroke();
    return g;
  }

  function hex(c) { return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]; }
  var COLS = { ink: hex('#1D1A33'), inkHi: hex('#FFC93C'), cof: [hex('#6B3E1F'), hex('#7A4A2C'), hex('#5C3310')], phone: hex('#2B2F36') };

  function draw() {
    var d = S.desk;
    if (!d) return;
    if (!base) bake();
    var dpr = window.devicePixelRatio || 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cvs.width, cvs.height);
    ctx.drawImage(base, 0, 0);
    ctx.setTransform(CW * dpr, 0, 0, CW * dpr, 0, 0);
    // mug coffee levels
    d.mugs.forEach(function (m) {
      var inner = m.h - 2, lvl = inner * Math.min(1, m.fill / m.cap);
      ctx.fillStyle = '#6B3E1F';
      ctx.fillRect(m.x + 2, m.y + inner - lvl, m.w - 4, lvl);
      if (m.fill >= m.cap) { ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.fillRect(m.x + 3, m.y + 1, m.w - 6, 1); }
    });
    // laptop screen shows how it is doing
    var lp = d.laptop, hurt = lp.hits / cfg().limit;
    ctx.fillStyle = hurt > 0.66 ? '#E8504A' : hurt > 0.33 ? '#FFC93C' : '#3D86F0';
    rr(ctx, lp.x + 1.5, lp.y + 1.5, lp.w - 3, lp.h - 7, 0.8); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = '700 4px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(hurt > 0.66 ? 'X_X' : hurt > 0.33 ? 'o_o;' : '^_^', lp.x + lp.w / 2, lp.y + (lp.h - 4) / 2);
    // cells: ink, coffee, phone
    var data = img.data, cell = d.cell;
    for (var i = 0; i < W * H; i++) {
      var v = cell[i], o = i * 4, c = null;
      if (v === E.INK) c = ((i / W) | 0) % 3 === 0 ? COLS.inkHi : COLS.ink;
      else if (v === E.COFFEE) c = COLS.cof[i % 3];
      if (c) { data[o] = c[0]; data[o + 1] = c[1]; data[o + 2] = c[2]; data[o + 3] = 255; }
      else data[o + 3] = 0;
    }
    cctx.putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(cells, 0, 0, W, H);
    // the phone
    if (d.phone) {
      var p = d.phone, buzz = S.phase === 'pour' ? (Math.random() - 0.5) * 0.6 : 0;
      ctx.fillStyle = '#2B2F36'; ctx.strokeStyle = '#1D1A33'; ctx.lineWidth = 0.45;
      rr(ctx, p.x + buzz, p.y, p.w, p.h, 1); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#E8577E'; rr(ctx, p.x + 1 + buzz, p.y + 0.8, p.w - 2, p.h - 1.6, 0.6); ctx.fill();
      if (S.phase === 'pour') {
        ctx.strokeStyle = '#1D1A33'; ctx.lineWidth = 0.4;
        ctx.beginPath(); ctx.moveTo(p.x - 1.5, p.y); ctx.lineTo(p.x - 2.5, p.y - 1); ctx.moveTo(p.x + p.w + 1.5, p.y); ctx.lineTo(p.x + p.w + 2.5, p.y - 1); ctx.stroke();
      }
    }
    // pot position and aim
    var pot = $('#pot');
    pot.style.left = ((d.potX + 0.5) / W * 100) + '%';
    var aim = $('#aim');
    aim.classList.toggle('on', S.phase === 'pour' && Math.abs(d.potTarget - d.potX) > 2);
    aim.style.left = ((d.potTarget + 0.5) / W * 100) + '%';
  }

  function renderPot(mood) {
    var Lv = L();
    $('#pot').innerHTML = '<svg viewBox="0 0 64 54" aria-hidden="true">' +
      '<rect x="20" y="0" width="24" height="10" rx="3" fill="#9AA3AD" stroke="#1D1A33" stroke-width="2"/>' +
      '<g transform="rotate(' + (S.phase === 'pour' ? 28 : 0) + ' 32 30)"><path d="M14 16 h30 l-3 28 a5 5 0 0 1 -5 4 h-14 a5 5 0 0 1 -5 -4 z" fill="#fff" stroke="#1D1A33" stroke-width="2.5"/>' +
      '<path d="M44 22 l9 6 l-3 3 l-7 -3" fill="#fff" stroke="#1D1A33" stroke-width="2.2" stroke-linejoin="round"/>' +
      '<path d="M14 24 h29" stroke="' + Lv.color + '" stroke-width="5"/></g>' +
      A.face(S.level, mood || 'smug').replace('<svg ', '<svg x="17" y="22" width="30" height="25.7" ') + '</svg>';
  }

  // ---------- pen ----------

  function toCell(e) {
    var r = cvs.getBoundingClientRect();
    return { x: Math.floor((e.clientX - r.left) / r.width * W), y: Math.floor((e.clientY - r.top) / r.height * H) };
  }
  function stroke(from, to, erase) {
    var d = S.desk, n = Math.max(Math.abs(to.x - from.x), Math.abs(to.y - from.y), 1), used = 0;
    for (var i = 0; i <= n; i++) {
      var x = Math.round(from.x + (to.x - from.x) * i / n), y = Math.round(from.y + (to.y - from.y) * i / n);
      used += erase ? d.erase(x, y, 2) : d.draw(x, y);
    }
    if (used) sfx(erase ? 'erase' : 'ink');
    if (!erase && d.ink <= 0 && used === 0 && !S.inkWarned) { S.inkWarned = true; flash('Out of ink! Erase something to get it back.', true); }
  }
  cvs.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  cvs.addEventListener('pointerdown', function (e) {
    if (S.phase === 'over' || A.isBoss()) return;
    S.drawing = true;
    S.erasing = S.tool === 'erase' || e.button === 2;
    S.last = toCell(e);
    cvs.setPointerCapture(e.pointerId);
    stroke(S.last, S.last, S.erasing);
    draw();
    renderPanel();
  });
  cvs.addEventListener('pointermove', function (e) {
    if (!S.drawing || S.phase === 'over') return;
    var p = toCell(e);
    stroke(S.last, p, S.erasing);
    S.last = p;
    if (S.phase !== 'pour') draw();
    renderPanel();
  });
  function endStroke() { S.drawing = false; S.inkWarned = false; }
  cvs.addEventListener('pointerup', endStroke);
  cvs.addEventListener('pointercancel', endStroke);

  function setTool(t) {
    S.tool = t;
    Array.prototype.forEach.call(document.querySelectorAll('.pen[data-tool]'), function (b) { b.setAttribute('aria-pressed', String(b.dataset.tool === t)); });
    cvs.classList.toggle('erasing', t === 'erase');
  }

  // ---------- flow ----------

  function newDesk() {
    A.closeModal(true);
    S.desk = new E.Desk(S.level, (Math.random() * 1e9) >>> 0);
    S.phase = 'plan';
    S.planLeft = cfg().plan;
    S.paused = false;
    S.acc = 0;
    S.lastFrame = 0;
    S.lastHits = 0;
    S.endShown = false;
    base = null;
    $('#countdown').hidden = false;
    $('#countdown').classList.remove('small');
    say(pick(TALK[S.level].start), 'smug', true);
    renderPanel();
    layout();
    A.music.intensity(0.4);
  }

  function pour() {
    if (S.phase !== 'plan') return;
    S.phase = 'pour';
    S.desk.start();
    $('#countdown').hidden = true;
    sfx('pour');
    say(pick(TALK[S.level].pour), 'happy', true);
    renderPot('happy');
    A.music.intensity(0.7);
  }

  function flash(text, bad) {
    var f = $('#flash');
    f.textContent = text;
    f.className = 'flash' + (bad ? ' bad' : '');
    f.hidden = false;
    S.flashUntil = performance.now() + 1500;
  }

  function handle(ev) {
    var T = TALK[S.level];
    if (ev.type === 'zap') {
      sfx('zap');
      var dk = $('.desk');
      dk.classList.remove('shake'); void dk.offsetWidth; dk.classList.add('shake');
      say(pick(T.zap), 'happy');
    } else if (ev.type === 'full') { sfx('full'); flash('Mug full!'); }
    else if (ev.type === 'smudge') sfx('buzz');
    else if (ev.type === 'end') sc.timeout(endGame, 400);
  }

  function frame(now) {
    sc.raf(frame);
    var d = S.desk;
    var dt = S.lastFrame ? Math.min(0.1, (now - S.lastFrame) / 1000) : 0;
    S.lastFrame = now;
    $('#flash').hidden = now > S.flashUntil;
    if (!d || S.phase === 'over') return;
    var halted = S.paused || A.isBoss() || A.modalOpen() || document.hidden;
    if (halted) return;
    if (S.phase === 'plan') {
      var before = Math.ceil(S.planLeft);
      S.planLeft -= dt;
      if (Math.ceil(S.planLeft) !== before && S.planLeft <= 5 && S.planLeft > 0) sfx('tick');
      $('#cd-num').textContent = Math.max(0, Math.ceil(S.planLeft));
      $('#countdown').classList.toggle('small', S.drawing || S.planLeft < cfg().plan - 3);
      if (S.planLeft <= 0) pour();
      return;
    }
    S.acc += dt;
    var stepped = false;
    while (S.acc >= TICK && !d.over) {
      d.step();
      d.events.forEach(handle);
      d.events.length = 0;
      S.acc -= TICK;
      stepped = true;
    }
    if (stepped) {
      if (d.laptop.hits === S.lastHits && d.t % 150 === 0 && d.plan && !d.plan.good) say(pick(TALK[S.level].blocked), 'annoyed');
      S.lastHits = d.laptop.hits;
      draw();
      renderPanel();
    }
  }

  function renderPanel() {
    var d = S.desk, c = cfg(), Lv = L();
    $('#bot-name').textContent = Lv.name;
    $('#bot-rank').textContent = Lv.rank + ' pourer';
    $('#ink-num').textContent = d.ink;
    $('#ink-fill').style.width = (100 * d.ink / c.ink) + '%';
    var health = Math.max(0, 1 - d.laptop.hits / c.limit);
    $('#lap-num').textContent = health >= 1 ? 'Dry' : Math.round(health * 100) + '%';
    $('#lap-fill').style.width = health * 100 + '%';
    $('.meter-bar.lap').classList.toggle('hurt', health < 0.5);
    var cap = d.mugs.reduce(function (a, m) { return a + m.cap; }, 0);
    $('#mug-num').textContent = d.caught;
    $('#mug-fill').style.width = Math.min(100, 100 * d.caught / cap) + '%';
    $('#tick2').style.left = (100 * c.stars[0] / cap) + '%';
    $('#tick3').style.left = (100 * c.stars[1] / cap) + '%';
    $('#tick2').title = '2 stars';
    $('#tick3').title = '3 stars';
    $('#pot-num').textContent = Math.round(100 * d.pot / c.pot) + '%';
    $('#pot-fill').style.width = (100 * d.pot / c.pot) + '%';
    $('#btn-pause').disabled = S.phase !== 'pour';
    $('#btn-pause').textContent = S.paused ? 'Resume (P)' : 'Pause (P)';
    var best = A.progress(GAME)[S.level];
    $('#best').textContent = best ? 'Your best against ' + Lv.name + ': ' + best.text + '.' : Lv.name + ' has never missed the laptop. Yet.';
  }

  function endGame() {
    var d = S.desk;
    if (S.endShown || !d.over) return;
    S.endShown = true;
    S.phase = 'over';
    var c = cfg(), Lv = L(), T = TALK[S.level], won = d.result === 'win';
    var stars = !won ? 0 : d.caught >= c.stars[1] ? 3 : d.caught >= c.stars[0] ? 2 : 1;
    var base2 = 3 * d.caught + (won ? 500 + 4 * d.ink : 0) - 5 * d.laptop.hits;
    A.account.submit(GAME, S.level, A.points(S.level, Math.max(0, base2)), d.caught + ' drops caught' + (won ? ', laptop saved' : ', laptop fried'));
    renderPanel();
    draw();
    A.music.intensity(0.4);
    if (won) {
      var rec = A.record(GAME, S.level, { stars: stars, score: d.caught, lowerIsBetter: false, text: d.caught + ' drops caught, laptop saved' });
      bar.refresh();
      A.jingle('win');
      say(pick(T.win), 'dead', true);
      var next = ORDER[ORDER.indexOf(S.level) + 1], buttons = [];
      if (next) buttons.push({ label: 'Next pourer: ' + A.LEVEL_MAP[next].name, kind: 'main', onClick: function () { switchTo(next); } });
      buttons.push({ label: 'New desk', kind: next ? 'line' : 'main', onClick: newDesk });
      A.modal({
        title: S.level === 'edith' ? 'Edith missed!' : 'Laptop saved!',
        tone: 'win',
        html: '<p class="lead">The pot is empty and the laptop ' + (d.laptop.hits ? 'only took ' + d.laptop.hits + ' drop' + (d.laptop.hits === 1 ? '' : 's') : 'stayed bone dry') + '. You caught <strong>' + d.caught + ' drops</strong> in the mugs.</p>' + A.stars(stars) +
          '<p><strong>' + (rec.better ? (rec.prev ? 'New best against ' + Lv.name + '!' : 'First save against ' + Lv.name + '.') : 'Your best: ' + rec.prev.text + '.') + '</strong></p>' +
          (stars < 3 ? '<p class="soft">2 stars at ' + c.stars[0] + ' drops in the mugs, 3 stars at ' + c.stars[1] + '.</p>' : ''),
        buttons: buttons
      });
    } else {
      A.jingle('lose');
      say(pick(T.lose), 'happy', true);
      A.modal({
        title: 'Fried!',
        tone: 'lose',
        html: '<p class="lead">The laptop took ' + d.laptop.hits + ' drops of coffee. That is its limit.</p>' +
          '<p class="soft">Tips: one long roof over the laptop that slopes down into both mugs stops almost everything. Keep lines thick and unbroken, because coffee squeezes through any gap. ' +
          (d.phone ? 'Edith\'s phone smudges ink in its lane, so keep your lines above or below it.' : 'Watch the arrow on the rail: it shows where the robot is heading next.') + '</p>',
        buttons: [{ label: 'Try a new desk', kind: 'main', onClick: newDesk }],
        link: { label: 'Close and look at the mess' }
      });
    }
  }

  function switchTo(id) {
    S.level = id;
    bar.setLevel(id);
    newDesk();
  }

  function openHelp() {
    var rows = ORDER.map(function (id) {
      var Lv = A.LEVEL_MAP[id], c = E.LEVELS[id];
      return '<div><dt>' + Lv.name + ', ' + Lv.rank.toLowerCase() + '</dt><dd>' + TALK[id].blurb + ' ' + c.ink + ' ink, ' + c.plan + ' seconds to plan, the laptop survives ' + c.limit + ' drops.</dd></div>';
    }).join('');
    A.modal({
      title: 'How to play',
      wide: true,
      html: '<p>The robot is about to pour a whole pot of coffee over your desk. Draw walls with your pen so the coffee runs into the mugs instead of the laptop.</p>' +
        '<ol><li>You get a few seconds to plan before the pot tips. Drag on the desk to draw.</li>' +
        '<li>Your ink is limited. The eraser (or right-click) gives the ink back, so you can move walls while it pours.</li>' +
        '<li>The robot slides along the top looking for a way to the laptop. Coffee also soaks in if it pools against the laptop\'s side.</li>' +
        '<li>Survive until the pot is empty. Coffee in the mugs earns stars and points.</li></ol>' +
        '<h3>Pourers</h3><dl>' + rows + '</dl>' +
        '<h3>Keys</h3><table class="keys"><tr><td><kbd>1</kbd> <kbd>2</kbd></td><td>Pen, eraser</td></tr><tr><td><kbd>Enter</kbd></td><td>Pour now</td></tr>' +
        '<tr><td><kbd>R</kbd></td><td>Clear all your ink</td></tr><tr><td><kbd>P</kbd> <kbd>N</kbd></td><td>Pause, new desk</td></tr>' +
        '<tr><td><kbd>M</kbd></td><td>Music on or off</td></tr><tr><td><kbd>B</kbd></td><td>Panic button (pauses the pour)</td></tr></table>',
      buttons: [{ label: 'Grab the pen', kind: 'main' }]
    });
  }

  var bar = A.mountBar({
    el: $('#bar'),
    game: GAME,
    title: 'Coffee Spill',
    tagline: 'Draw walls. Save the laptop. Fill the mugs.',
    level: S.level,
    levelLabel: 'Pourer',
    canSwitch: function () { return S.phase === 'pour' || (S.phase === 'plan' && S.desk && S.desk.inkUsed() > 0) ? 'This desk and your drawing will be cleared.' : true; },
    onLevel: function (id) { S.level = id; newDesk(); },
    onHelp: openHelp
  });
  sc.add(bar.destroy);

  Array.prototype.forEach.call(document.querySelectorAll('.pen[data-tool]'), function (b) { b.addEventListener('click', function () { setTool(b.dataset.tool); }); });
  $('#btn-clear').addEventListener('click', function () {
    var d = S.desk;
    if (S.phase === 'over') return;
    for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) if (d.cell[E.idx(x, y)] === E.INK) d.erase(x, y, 0);
    sfx('erase');
    draw();
    renderPanel();
  });
  $('#btn-pour').addEventListener('click', pour);
  $('#btn-pause').addEventListener('click', function () { if (S.phase === 'pour') { S.paused = !S.paused; renderPanel(); } });
  $('#btn-new').addEventListener('click', function () {
    if (!(S.phase === 'pour' || (S.phase === 'plan' && S.desk.inkUsed() > 0))) return newDesk();
    A.confirm({ title: 'New desk?', text: 'This desk and everything you drew will be cleared.', yes: 'New desk', no: 'Keep going', onYes: newDesk });
  });

  sc.on(document, 'keydown', function (e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    var k = e.key.toLowerCase();
    if (k === '1') { setTool('ink'); return; }
    if (k === '2') { setTool('erase'); return; }
    if (k === 'enter' && !(e.target && e.target.tagName === 'BUTTON')) { pour(); return; }
    if (k === 'r') { $('#btn-clear').click(); return; }
    if (k === 'p') { $('#btn-pause').click(); return; }
    if (k === 'n') { $('#btn-new').click(); return; }
    if (k === '?') openHelp();
  });

  var rt = null;
  sc.on(window, 'resize', function () { clearTimeout(rt); rt = sc.timeout(layout, 80); });

  newDesk();
  sc.raf(frame);
  if (A.firstVisit(GAME)) openHelp();

  window.coffeeSpill = { state: S, pour: pour, newDesk: newDesk };
  return sc.dispose;
}
