/*
 * Going Up: the tower, your elevator and its stops, the robot elevator next door, rushes and the end of a shift.
 * mount() runs after window.Arcade is ready (components/PageShell.jsx) and returns a cleanup function.
 */
import E from './engine.js';

export function mount() {
  var A = window.Arcade;
  var sc = A.scope();
  var GAME = 'going-up';
  var ORDER = ['pip', 'gridlock', 'monolith', 'edith'];
  // the drawing is laid out on a 600 x 640 board and scaled to fit
  var FW = 600, FH = 640, TOP = 58, BOTTOM = 12;
  var X = { label: 0, shaft: 54, land: 154, rival: 450, edge: 550 };
  var SHAFT = 96, LAND = X.rival - X.land;
  var SKIN = ['#F2C9A0', '#D9A066', '#A86B3C', '#7A4A2A', '#F6D7B8', '#C68B59'];
  var SHIRT = ['#3D86F0', '#2FBF71', '#B83B7D', '#FFC93C', '#7E97C9', '#EF6C2B'];
  var RUSH = {
    morning: 'Morning rush: the lobby wants to go up!',
    lunch: 'Lunch rush: everyone wants the canteen on the top floor!',
    home: 'Home time: everyone wants the ground floor!'
  };

  function $(s) { return document.querySelector(s); }

  var S = { level: A.lastLevel(GAME), b: null, running: false, paused: false, acc: 0, lastFrame: 0, lastLine: '', bannerUntil: 0, pops: [], flashes: [], endShown: false, text: {} };

  var TALK = {
    pip: {
      blurb: 'A slow little lift that wanders to any floor with people on it. It takes almost anyone, so it even helps a bit.',
      rank: 'Rookie lift',
      start: ['Going up! Or down. I forget which button is which.', 'Hi! I am the other elevator. We can share!', 'Ding! Wait, was that me?'],
      steal: ['Oh! Were they yours? Sorry!', 'Squeeze in, everyone!'],
      stairs: ['Oh no, they took the stairs!', 'The stairs are good exercise, I guess.'],
      rush: ['So many people!', 'Rush hour! Wheee!'],
      end: ['That was fun! Same time tomorrow?']
    },
    gridlock: {
      blurb: 'Rides from the bottom to the top and back, stopping wherever a happy rider waits. Like clockwork.',
      rank: 'Pro lift',
      start: ['Up, then down. Then up. Then down.', 'Schedule loaded. Doors closing.', 'Efficiency is a staircase nobody uses.'],
      steal: ['Passenger collected on schedule.', 'Your floor was on my route.'],
      stairs: ['Missed service detected.', 'Stairs: one. Elevators: zero.'],
      rush: ['Rush hour. Running the usual route.', 'Peak load. No change to the plan.'],
      end: ['Shift over. Route complete.']
    },
    monolith: {
      blurb: 'Heads for the biggest crowd and picks people up on the way. It only takes riders who still have plenty of patience.',
      rank: 'Grandmaster lift',
      start: ['I go where the crowds are.', 'Happy riders are quick riders. I take those.', 'You may keep the grumpy ones.'],
      steal: ['The crowd chose me.', 'A full car is a happy car.'],
      stairs: ['A rider lost to the stairs.', 'Patience runs out. Noted.'],
      rush: ['A crowd. Excellent.', 'The rush favors the prepared.'],
      end: ['The building has spoken.']
    },
    edith: {
      blurb: 'Races you to your next stop whenever she can get there first, waits where the next rush begins, and only takes the happiest riders.',
      rank: 'Impossible lift',
      start: ['Hi! I always know where you are going next. Hee hee.', 'Edith Express! Fastest lift in the tower.', 'You take the grumpy ones. I take the fun ones!'],
      steal: ['Beat you there!', 'Too slow! They are riding with Edith now.', 'Ding ding! Mine!'],
      stairs: ['Aww, someone took the stairs. Not my problem!', 'Oopsie! Your rider gave up.'],
      rush: ['Rush hour! Edith was already waiting.', 'I saw this rush coming. Did you?'],
      end: ['Edith never takes the stairs.']
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
  function fname(f) { return f === 0 ? 'G' : String(f); }
  function mmss(t) { var s = Math.floor(t); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
  // writes text only when it changed, since the panel updates every frame
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
  function banner(text, bad, ms) {
    var el = $('#banner');
    el.textContent = text;
    el.className = 'banner' + (bad ? ' bad' : '');
    el.hidden = false;
    S.bannerUntil = performance.now() + (ms || 2600);
  }

  function sfx(kind) {
    switch (kind) {
      case 'ding': A.tone(1318, 0.18, 'sine', 0.05); A.tone(1046, 0.3, 'sine', 0.05, 0.14); break;
      case 'coin': A.tone(988, 0.06, 'square', 0.025); A.tone(1318, 0.12, 'square', 0.025, 0.06); break;
      case 'press': A.tone(660, 0.05, 'triangle', 0.04); break;
      case 'unpress': A.tone(440, 0.05, 'triangle', 0.03); break;
      case 'stairs': [0, 0.08, 0.16, 0.24].forEach(function (d, i) { A.tone(520 - i * 60, 0.07, 'square', 0.03, d); }); break;
      case 'stolen': A.tone(300, 0.12, 'sawtooth', 0.03, 0, 200); break;
      case 'rush': A.tone(523, 0.12, 'triangle', 0.04); A.tone(659, 0.12, 'triangle', 0.04, 0.12); A.tone(784, 0.2, 'triangle', 0.04, 0.24); break;
    }
  }

  // ---------- drawing ----------

  var cvs = $('#building'), ctx = cvs.getContext('2d'), scale = 1;

  function layout() {
    var w = cvs.parentNode.clientWidth - 20;
    scale = Math.max(0.3, w / FW);
    var dpr = window.devicePixelRatio || 1;
    cvs.width = Math.round(FW * scale * dpr);
    cvs.height = Math.round(FH * scale * dpr);
    cvs.style.height = FH * scale + 'px';
    draw(performance.now());
  }

  function fh() { return (FH - TOP - BOTTOM) / S.b.floors; }
  function floorTop(f) { return FH - BOTTOM - (f + 1) * fh(); }
  function rr(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function moodColor(p) {
    var m = S.b.mood(p);
    return m >= cfg().rival.mood ? '#2FBF71' : m >= 0.2 ? '#EF8A2B' : '#E5483A';
  }

  function drawSky() {
    var g = ctx.createLinearGradient(0, 0, 0, TOP);
    g.addColorStop(0, '#0B3A45');
    g.addColorStop(1, '#14606F');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, FW, TOP);
    // the roof and its sign
    ctx.fillStyle = '#1D1A33';
    ctx.beginPath();
    ctx.moveTo(30, TOP); ctx.lineTo(70, 14); ctx.lineTo(FW - 70, 14); ctx.lineTo(FW - 30, TOP); ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#E0B13B';
    ctx.font = '24px Limelight, Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText('WNI  TOWER', FW / 2, 44);
    ctx.strokeStyle = '#E0B13B';
    ctx.lineWidth = 2;
    [[90, 22, 130, 22], [FW - 130, 22, FW - 90, 22]].forEach(function (l) { ctx.beginPath(); ctx.moveTo(l[0], l[1]); ctx.lineTo(l[2], l[3]); ctx.stroke(); });
  }

  function drawFloors(now) {
    var b = S.b, h = fh();
    for (var f = 0; f < b.floors; f++) {
      var y = floorTop(f);
      ctx.fillStyle = f % 2 ? '#F6E8C8' : '#FFF6E3';
      ctx.fillRect(X.land, y, LAND, h);
      ctx.fillStyle = '#E9D6AE';
      ctx.fillRect(X.label, y, X.shaft, h);
      ctx.fillRect(X.edge, y, FW - X.edge, h);
      // windows on the far side
      ctx.fillStyle = f === b.floors - 1 && b.floors > 1 ? '#FFC93C' : '#9CC9D3';
      rr(X.edge + 10, y + h * 0.22, FW - X.edge - 20, h * 0.5, 4); ctx.fill();
      // a flash on a floor where someone just gave up
      S.flashes.forEach(function (fl) {
        if (fl.floor !== f) return;
        var k = (now - fl.t) / 900;
        if (k < 1) { ctx.fillStyle = 'rgba(229,72,58,' + (0.45 * (1 - k)) + ')'; ctx.fillRect(X.land, y, LAND, h); }
      });
      // floor slab
      ctx.fillStyle = '#1D1A33';
      ctx.fillRect(0, y + h - 3, FW, 3);
      // floor name and call lamp
      ctx.fillStyle = '#1D1A33';
      ctx.font = 'bold ' + Math.round(Math.min(24, h * 0.42)) + 'px "Atkinson Hyperlegible", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(fname(f), 20, y + h * 0.62);
      var waiting = b.queues[f].length > 0;
      ctx.beginPath(); ctx.arc(42, y + h * 0.42, Math.min(6, h * 0.12), 0, Math.PI * 2);
      ctx.fillStyle = waiting ? '#FFC93C' : '#B9A983'; ctx.fill();
      ctx.lineWidth = 1.5; ctx.strokeStyle = '#1D1A33'; ctx.stroke();
      if (f === b.floors - 1 && b.floors > 2) {
        ctx.fillStyle = '#8E2B3D'; ctx.font = 'bold 11px "Atkinson Hyperlegible", sans-serif'; ctx.textAlign = 'right';
        ctx.fillText('CANTEEN', X.rival - 8, y + 13);
      }
    }
    // shafts
    [X.shaft, X.rival].forEach(function (x) {
      ctx.fillStyle = '#2B2440';
      ctx.fillRect(x, TOP, SHAFT, FH - TOP - BOTTOM);
      ctx.fillStyle = '#E0B13B';
      ctx.fillRect(x, TOP, 3, FH - TOP - BOTTOM);
      ctx.fillRect(x + SHAFT - 3, TOP, 3, FH - TOP - BOTTOM);
    });
    ctx.fillStyle = '#1D1A33';
    ctx.fillRect(0, FH - BOTTOM, FW, BOTTOM);
    // your stops, numbered in the order the car will visit them
    b.you.stops.forEach(function (f, si) {
      var y = floorTop(f), bh = Math.min(18, h * 0.34);
      rr(30, y + h - 6 - bh, 22, bh, 5);
      ctx.fillStyle = '#FF6B57'; ctx.fill(); ctx.strokeStyle = '#1D1A33'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.font = 'bold ' + Math.round(bh * 0.7) + 'px "Atkinson Hyperlegible", sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(String(si + 1), 41, y + h - 6 - bh * 0.25);
    });
  }

  function drawPerson(x, y, p, size, now) {
    var r = size, m = S.b.mood(p);
    var wob = m < 0.2 ? Math.sin(now / 60 + p.id) * 1.5 : 0;
    ctx.save();
    ctx.translate(x + wob, y);
    // body
    rr(-r * 0.9, -r * 0.2, r * 1.8, r * 2.1, r * 0.6);
    ctx.fillStyle = SHIRT[p.look % SHIRT.length]; ctx.fill();
    ctx.lineWidth = 1.6; ctx.strokeStyle = '#1D1A33'; ctx.stroke();
    // head with a mood ring
    ctx.beginPath(); ctx.arc(0, -r * 0.95, r * 0.8, 0, Math.PI * 2);
    ctx.fillStyle = SKIN[p.look % SKIN.length]; ctx.fill();
    ctx.lineWidth = 2.6; ctx.strokeStyle = moodColor(p); ctx.stroke();
    // where they are going
    ctx.beginPath(); ctx.arc(0, -r * 2.55, r * 0.78, 0, Math.PI * 2);
    ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = '#1D1A33'; ctx.stroke();
    ctx.fillStyle = '#1D1A33';
    ctx.font = 'bold ' + Math.round(r * 1.05) + 'px "Atkinson Hyperlegible", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(fname(p.dest), 0, -r * 2.55 + r * 0.38);
    ctx.restore();
  }

  function drawQueues(now) {
    var b = S.b, h = fh();
    var size = Math.max(4, Math.min(8, h * 0.13));
    for (var f = 0; f < b.floors; f++) {
      var q = b.queues[f], base = floorTop(f) + h - 3 - size * 1.9;
      var gap = Math.min(size * 3.2, (LAND - 30) / Math.max(1, q.length));
      for (var i = 0; i < q.length; i++) drawPerson(X.land + 16 + i * gap, base, q[i], size, now);
    }
  }

  function drawCar(car, x, mine) {
    var h = fh(), y = FH - BOTTOM - (car.y + 1) * h, inset = 7, w = SHAFT - inset * 2, ch = h - 6;
    var Lv = L();
    rr(x + inset, y + 2, w, ch, 6);
    ctx.fillStyle = mine ? '#FF6B57' : Lv.color; ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = '#1D1A33'; ctx.stroke();
    var open = car.state === 'doors';
    // the inside, with the riders' destinations
    var ix = x + inset + 5, iy = y + 7, iw = w - 10, ih = ch - 10;
    ctx.fillStyle = open ? '#FFF6E3' : mine ? '#C9493B' : 'rgba(0,0,0,.25)';
    ctx.fillRect(ix, iy, iw, ih);
    var n = car.riders.length, cols = 3, cell = iw / cols, chip = Math.min(cell - 4, ih / 2 - 3, 18);
    for (var i = 0; i < n; i++) {
      var p = car.riders[i], cxp = ix + (i % cols) * cell + cell / 2, cyp = iy + (i < cols ? ih * 0.3 : ih * 0.74);
      ctx.beginPath(); ctx.arc(cxp, cyp, chip / 2, 0, Math.PI * 2);
      ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = '#1D1A33'; ctx.stroke();
      ctx.fillStyle = '#1D1A33'; ctx.font = 'bold ' + Math.round(chip * 0.62) + 'px "Atkinson Hyperlegible", sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(fname(p.dest), cxp, cyp + chip * 0.22);
    }
    // doors: slid open to the sides, or closed in the middle
    ctx.fillStyle = mine ? '#B8432F' : 'rgba(29,26,51,.35)';
    if (open) { ctx.fillRect(ix, iy, 4, ih); ctx.fillRect(ix + iw - 4, iy, 4, ih); }
    else if (mine) { ctx.fillRect(ix + iw / 2 - 1, iy, 2, ih); }
    if (!mine) {
      // the robot's face on top of its car
      ctx.fillStyle = '#1D1A33';
      ctx.beginPath(); ctx.arc(x + SHAFT / 2 - 9, y + 2 + ch * 0.18, 2.6, 0, Math.PI * 2); ctx.arc(x + SHAFT / 2 + 9, y + 2 + ch * 0.18, 2.6, 0, Math.PI * 2); ctx.fill();
      if (S.level === 'edith') { ctx.fillStyle = '#E8577E'; ctx.beginPath(); ctx.arc(x + SHAFT / 2 + 20, y + 4, 6, 0, Math.PI * 2); ctx.fill(); }
    }
  }

  function drawPops(now) {
    S.pops = S.pops.filter(function (p) { return now - p.t < 1100; });
    S.pops.forEach(function (p) {
      var k = (now - p.t) / 1100;
      ctx.globalAlpha = 1 - k;
      ctx.font = 'bold 20px "Atkinson Hyperlegible", sans-serif';
      ctx.textAlign = 'center';
      ctx.lineWidth = 4; ctx.strokeStyle = '#1D1A33'; ctx.strokeText(p.text, p.x, p.y - k * 30);
      ctx.fillStyle = p.color; ctx.fillText(p.text, p.x, p.y - k * 30);
      ctx.globalAlpha = 1;
    });
    S.flashes = S.flashes.filter(function (f) { return now - f.t < 900; });
  }

  function draw(now) {
    if (!S.b) return;
    var dpr = window.devicePixelRatio || 1;
    ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
    ctx.clearRect(0, 0, FW, FH);
    drawSky();
    drawFloors(now);
    drawQueues(now);
    drawCar(S.b.you, X.shaft, true);
    drawCar(S.b.bot, X.rival, false);
    drawPops(now);
  }

  // ---------- panel ----------

  function strikeIcon() {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 20h5v-5h5v-5h5V5h3" fill="none" stroke="#1D1A33" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"/></svg>';
  }

  function buildButtons() {
    var wrap = $('#lift-btns');
    wrap.innerHTML = '';
    for (var f = E.MAX_FLOORS - 1; f >= 0; f--) {
      var bt = document.createElement('button');
      bt.type = 'button';
      bt.className = 'lift-btn';
      bt.dataset.floor = f;
      bt.textContent = fname(f);
      bt.setAttribute('aria-label', 'Stop at ' + (f === 0 ? 'the ground floor' : 'floor ' + f));
      bt.setAttribute('aria-pressed', 'false');
      wrap.appendChild(bt);
    }
  }
  function renderButtons() {
    var b = S.b;
    Array.prototype.forEach.call(document.querySelectorAll('.lift-btn'), function (bt) {
      var f = Number(bt.dataset.floor);
      bt.hidden = f >= b.floors;
      var on = String(b.you.stops.indexOf(f) >= 0);
      if (bt.getAttribute('aria-pressed') !== on) bt.setAttribute('aria-pressed', on);
    });
  }

  function renderHud() {
    var b = S.b, Lv = L(), nr = b.nextRush();
    setText('#riders', String(b.you.delivered));
    setText('#quick', String(b.quick));
    setText('#time', mmss(b.t));
    setText('#day', 'Day ' + b.day);
    var rush = nr.in === 0 ? (nr.kind === 'morning' ? 'Morning rush' : nr.kind === 'lunch' ? 'Lunch rush' : 'Home time') + ': ' + Math.ceil(nr.left) + 's left'
      : (nr.kind === 'morning' ? 'Morning rush' : nr.kind === 'lunch' ? 'Lunch rush' : 'Home time') + ' in ' + Math.ceil(nr.in) + 's';
    setText('#rush', rush);
    $('#rush').classList.toggle('hot', nr.in === 0 || nr.in <= 5);
    var used = $('#strikes').children;
    for (var i = 0; i < used.length; i++) used[i].classList.toggle('used', i < b.strikes);
    var stops = b.you.stops.map(fname);
    var stopsHtml = stops.length ? 'Next stops: ' + stops.map(function (s) { return '<b>' + s + '</b>'; }).join(' ') : 'No stops picked yet. Press a floor button.';
    if (S.text.stops !== stopsHtml) { S.text.stops = stopsHtml; $('#stops').innerHTML = stopsHtml; }
    setText('#rival', Lv.name + ' has carried ' + b.bot.delivered + ' of your would-be riders.');
    renderButtons();
    var w = b.waiting();
    A.music.intensity(Math.min(0.95, 0.4 + w / 24 + (nr.in === 0 ? 0.2 : 0)));
  }

  function renderPanel() {
    var Lv = L(), T = TALK[S.level];
    $('#bot-name').textContent = Lv.name;
    $('#bot-rank').textContent = T.rank;
    $('#strikes').innerHTML = [0, 1, 2].map(function () { return '<span class="strike">' + strikeIcon() + '</span>'; }).join('');
    var best = A.progress(GAME)[S.level];
    $('#best').textContent = best ? 'Your best against ' + Lv.name + ': ' + best.text + '.' : 'No shift against ' + Lv.name + ' yet. Stars at ' + E.STARS.join(', ') + ' riders.';
    var tips = [
      'Press floor buttons (or the keys 0 to 9, 0 is the ground floor) to add stops. Press again to cancel one.',
      'Your car stops in the order you pressed. Riders show the floor they want.',
      'Green rings: happy riders. ' + Lv.name + ' only takes those. Orange and red rings are yours alone.',
      'Three people taking the stairs ends the shift. Rushes start every few minutes.'
    ];
    $('#tips').innerHTML = tips.map(function (t) { return '<li>' + A.esc(t) + '</li>'; }).join('');
    S.text = {};
  }

  // ---------- playing ----------

  function newShift() {
    A.closeModal(true);
    S.b = new E.Building(S.level, (Math.random() * 1e9) >>> 0);
    S.running = false;
    S.paused = false;
    S.endShown = false;
    S.pops = [];
    S.flashes = [];
    $('#start-card').hidden = false;
    $('#banner').hidden = true;
    renderPanel();
    renderHud();
    say(pick(TALK[S.level].start), 'smug');
    A.music.intensity(0.4);
    draw(performance.now());
  }

  function start() {
    if (A.modalOpen()) return;
    if (S.b.over) { newShift(); return; }
    if (S.running) return;
    S.running = true;
    S.lastFrame = 0;
    $('#start-card').hidden = true;
    banner('Doors opening. Have a good shift!', false, 1800);
  }

  function press(f) {
    var b = S.b;
    if (!b || b.over || A.isBoss() || A.modalOpen() || f >= b.floors) return;
    if (!S.running) start();
    var had = b.you.stops.indexOf(f) >= 0;
    b.toggleStop(f);
    sfx(had ? 'unpress' : 'press');
    renderHud();
  }

  function carCenter(who) {
    var b = S.b, car = who === 'you' ? b.you : b.bot, h = fh();
    return [(who === 'you' ? X.shaft : X.rival) + SHAFT / 2, FH - BOTTOM - (car.y + 1) * h + 8];
  }

  function handle(ev) {
    var T = TALK[S.level], now = performance.now();
    if (ev.type === 'arrive' && ev.who === 'you') {
      if (ev.out) {
        sfx('coin');
        var c = carCenter('you');
        S.pops.push({ text: '+' + (10 * ev.out + 10 * ev.quick), x: c[0], y: c[1], t: now, color: ev.quick ? '#FFC93C' : '#fff' });
      } else sfx('ding');
    } else if (ev.type === 'stolen') {
      sfx('stolen');
      var rc = carCenter('bot');
      S.pops.push({ text: 'Mine!', x: rc[0], y: rc[1], t: now, color: L().color });
      if (Math.random() < 0.6) say(pick(T.steal), 'happy');
    } else if (ev.type === 'stairs') {
      sfx('stairs');
      S.flashes.push({ floor: ev.floor, t: now });
      banner(ev.strikes >= E.STRIKES ? 'Three riders took the stairs!' : 'Someone took the stairs! (' + ev.strikes + ' of ' + E.STRIKES + ')', true, 1800);
      say(pick(T.stairs), 'happy');
    } else if (ev.type === 'soon') {
      banner(RUSH[ev.kind].split(':')[0] + ' in 5 seconds!', false, 2000);
    } else if (ev.type === 'rush') {
      sfx('rush');
      banner(RUSH[ev.kind], false, 3000);
      if (Math.random() < 0.7) say(pick(T.rush), 'smug');
    } else if (ev.type === 'grow') {
      banner('A new floor opened: floor ' + (ev.floors - 1) + '!', false, 2200);
    } else if (ev.type === 'end') {
      sc.timeout(endGame, 700);
    }
  }

  function frame(now) {
    sc.raf(frame);
    var b = S.b;
    var dt = S.lastFrame ? Math.min(0.1, (now - S.lastFrame) / 1000) : 0;
    S.lastFrame = now;
    if (b && S.running && !b.over && !(S.paused || A.isBoss() || A.modalOpen() || document.hidden)) {
      S.acc += dt;
      while (S.acc >= E.DT && !b.over) {
        b.step();
        b.events.forEach(handle);
        b.events.length = 0;
        S.acc -= E.DT;
      }
      renderHud();
    } else S.acc = 0;
    $('#banner').hidden = now > S.bannerUntil;
    $('#btn-pause').textContent = S.paused ? 'Resume (P)' : 'Pause (P)';
    $('#btn-pause').disabled = !S.running || !b || b.over;
    draw(now);
  }

  function endGame() {
    var b = S.b, Lv = L(), T = TALK[S.level];
    if (S.endShown) return;
    S.endShown = true;
    S.running = false;
    var stars = b.stars(), d = b.you.delivered;
    A.account.submit(GAME, S.level, A.points(S.level, b.points()), d + ' riders in ' + mmss(b.t));
    A.music.intensity(0.4);
    // every shift counts towards your best; the lobby only lights a level once it has a star
    var rec = A.record(GAME, S.level, { stars: stars, score: d, lowerIsBetter: false, text: d + ' riders' });
    bar.refresh();
    renderPanel();
    A.jingle(stars ? 'win' : 'lose');
    say(pick(T.end), stars ? 'annoyed' : 'happy');
    var next = ORDER[ORDER.indexOf(S.level) + 1], buttons = [{ label: 'New shift', kind: 'main', onClick: newShift }];
    if (stars && next) buttons.push({ label: 'Next lift: ' + A.LEVEL_MAP[next].name, kind: 'line', onClick: function () { switchTo(next); } });
    var note = rec.better ? (rec.prev ? 'New best against ' + Lv.name + '!' : 'Your first shift against ' + Lv.name + ' is on the books.') : 'Your best: ' + rec.prev.text + '.';
    A.modal({
      title: stars === 3 ? 'Elevator legend!' : stars ? 'Shift complete!' : 'The stairs win this time',
      tone: stars ? 'win' : 'lose',
      html: '<p class="lead">You delivered <strong>' + d + ' riders</strong> (' + b.quick + ' quick trips) in a shift of ' + mmss(b.t) + ', and reached day ' + b.day + '.</p>' +
        '<p>' + Lv.name + ' carried ' + b.bot.delivered + ' riders. Three people took the stairs.</p>' + A.stars(stars) +
        '<p><strong>' + note + '</strong></p>' +
        (stars < 3 ? '<p class="soft">Stars at ' + E.STARS.join(', ') + ' riders. Tip: pick stops in an order that sweeps up or down, and rescue the red rings first.</p>' : ''),
      buttons: buttons,
      link: { label: 'Close and look at the tower' }
    });
  }

  function switchTo(id) {
    S.level = id;
    bar.setLevel(id);
    newShift();
  }

  function openHelp() {
    var rows = ORDER.map(function (id) {
      var Lv = A.LEVEL_MAP[id];
      return '<div><dt>' + Lv.name + ', ' + Lv.rank.toLowerCase() + '</dt><dd>' + TALK[id].blurb + '</dd></div>';
    }).join('');
    A.modal({
      title: 'How to play',
      wide: true,
      html: '<p>You run the elevator in an office tower. The shift never ends on its own: deliver as many riders as you can before three people give up and take the stairs.</p>' +
        '<ol><li>People appear on the floors. The bubble above each one shows the floor they want.</li>' +
        '<li>Press floor buttons to add stops. Your car visits them in the order you pressed; press a lit button again to cancel it.</li>' +
        '<li>At each stop, riders for that floor get out and waiting people get in (up to six).</li>' +
        '<li>A robot elevator works the next shaft. It only takes happy riders (green rings), so the grumpy ones are up to you.</li>' +
        '<li>Rushes, new floors and busier days keep coming. A trip under ' + E.QUICK + ' seconds from button to floor is a quick trip and scores double.</li></ol>' +
        '<h3>Robot lifts</h3><dl>' + rows + '</dl>' +
        '<h3>Keys</h3><table class="keys"><tr><td><kbd>1</kbd> to <kbd>9</kbd>, <kbd>0</kbd> or <kbd>G</kbd></td><td>Add or cancel a stop (0 and G are the ground floor)</td></tr>' +
        '<tr><td><kbd>Enter</kbd></td><td>Start the shift</td></tr><tr><td><kbd>P</kbd></td><td>Pause</td></tr><tr><td><kbd>N</kbd></td><td>New shift</td></tr>' +
        '<tr><td><kbd>M</kbd></td><td>Music on or off</td></tr><tr><td><kbd>B</kbd></td><td>Panic button</td></tr></table>',
      buttons: [{ label: 'Going up!', kind: 'main' }]
    });
  }

  var bar = A.mountBar({
    el: $('#bar'),
    game: GAME,
    title: 'Going Up',
    tagline: 'Run the elevator. Never let them take the stairs.',
    level: S.level,
    levelLabel: 'Lift',
    canSwitch: function () { return S.running && !S.b.over ? 'This shift will be abandoned.' : true; },
    onLevel: function (id) { S.level = id; newShift(); },
    onHelp: openHelp
  });
  sc.add(bar.destroy);

  buildButtons();
  $('#lift-btns').addEventListener('click', function (e) {
    var bt = e.target.closest('.lift-btn');
    if (bt) press(Number(bt.dataset.floor));
  });
  cvs.addEventListener('click', function (e) {
    var r = cvs.getBoundingClientRect(), y = (e.clientY - r.top) / r.height * FH;
    if (y < TOP || y > FH - BOTTOM) return;
    press(Math.floor((FH - BOTTOM - y) / fh()));
  });
  $('#btn-start').addEventListener('click', start);
  $('#btn-pause').addEventListener('click', function () { if (S.running && !S.b.over) { S.paused = !S.paused; banner(S.paused ? 'Paused' : 'Back to work!', false, S.paused ? 1e9 : 900); } });
  $('#btn-new').addEventListener('click', function () {
    if (!(S.running && !S.b.over)) return newShift();
    A.confirm({ title: 'New shift?', text: 'This shift will be abandoned and the tower starts over.', yes: 'New shift', no: 'Keep working', onYes: newShift });
  });

  sc.on(document, 'keydown', function (e) {
    if (e.ctrlKey || e.metaKey || e.altKey || A.modalOpen()) return;
    var k = e.key.toLowerCase();
    if (/^[0-9]$/.test(k)) { e.preventDefault(); press(Number(k)); return; }
    if (k === 'g') { press(0); return; }
    if (k === 'enter' && !(e.target && e.target.tagName === 'BUTTON')) { e.preventDefault(); start(); return; }
    if (k === 'p') { $('#btn-pause').click(); return; }
    if (k === 'n') { $('#btn-new').click(); return; }
    if (k === '?') openHelp();
  });

  var rt = null;
  sc.on(window, 'resize', function () { clearTimeout(rt); rt = sc.timeout(layout, 80); });

  newShift();
  layout();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { if (sc.alive()) draw(performance.now()); });
  sc.raf(frame);
  if (A.firstVisit(GAME)) openHelp();

  window.goingUp = {
    state: S, press: press, start: start, newShift: newShift,
    // for the dev checks: runs the shift forward quickly, handling every event on the way
    fastForward: function (sec) {
      var b = S.b;
      if (!S.running) start();
      for (var i = 0; i < sec / E.DT && !b.over; i++) { b.step(); b.events.forEach(handle); b.events.length = 0; }
      renderHud();
    }
  };
  return sc.dispose;
}
