/*
 * Herd Instinct: drawing the meadow, steering the dog, and the end screen.
 * mount() runs after window.Arcade is ready (components/PageShell.jsx) and returns a cleanup function.
 */
import E from './engine.js';

export function mount() {
  var A = window.Arcade;
  var sc = A.scope();
  var GAME = 'herd-instinct';
  var ORDER = ['pip', 'gridlock', 'monolith', 'edith'];
  var FW = E.FW, FH = E.FH;

  function $(s) { return document.querySelector(s); }

  var S = {
    level: A.lastLevel(GAME),
    world: null,
    running: false,
    paused: false,
    pointer: null,      // field coords the dog runs toward
    keys: {},
    sneak: false,
    barkQueued: false,
    acc: 0,
    lastFrame: 0,
    lastLine: '',
    lastSay: 0,
    flashUntil: 0,
    rings: [],
    endShown: false
  };

  var TALK = {
    pip: {
      blurb: 'A dreamy lead sheep. Wanders wherever the grass looks nice.',
      start: ['Baa! Is that a dog? Hi, dog!', 'Ooh, grass. Ooh, more grass.', 'We are just going to wander, okay?'],
      penned: ['Oh, a fence. Cozy!', 'Baa. This pen is nice actually.'], scare: ['Baa! Too fast!', 'Eep! A dog!'],
      win: ['We are all in? Okay. Snack time?'], lose: ['Time is up! More grass for us!']
    },
    gridlock: {
      blurb: 'Keeps the flock bunched up tight. Hard to split, easy to steer once they all move.',
      start: ['Stay together, everyone. Formation!', 'Nobody leaves the group.', 'We move as one. Slowly.'],
      penned: ['Formation... compromised.', 'The group is going in. Fine.'], scare: ['Hold the line!', 'Steady, flock.'],
      win: ['The formation has been penned.'], lose: ['Formation held. Good work, flock.']
    },
    monolith: {
      blurb: 'Knows exactly where the gate is and leads the flock away from it.',
      start: ['I know where that gate is. We are not going there.', 'The pen is over there. We will be over here.', 'Lead the flock, avoid the gate. Simple.'],
      penned: ['Hm. You found a way through.', 'Unexpected route.'], scare: ['Calmly, everyone. Away from the gate.', 'Do not panic. Do as I do.'],
      win: ['Outmaneuvered by a dog.'], lose: ['The gate stayed empty. As planned.']
    },
    edith: {
      blurb: 'Leads the flock away from the gate and stirs up panic. Run near Edith\'s sheep and they scatter. There is a wolf around too.',
      start: ['Hi doggy! My flock gets scared SO easily. Hee hee.', 'Baa! Watch out for the wolf. Or don\'t!', 'Let\'s play tag! Everyone run!'],
      penned: ['Hey! Who said you could go in there?', 'Traitor! Okay, cute traitor.'], scare: ['Panic, everyone! PANIC!', 'Run run run!', 'Scatter! Hee hee!'],
      win: ['Edith is... in the pen? Edith is never in the pen!'], lose: ['Free as a sheep! Edith wins!']
    }
  };

  function pick(arr) {
    var c = arr.filter(function (l) { return l !== S.lastLine; });
    c = c.length ? c : arr;
    return c[Math.floor(Math.random() * c.length)];
  }
  function L() { return A.LEVEL_MAP[S.level]; }
  function cfg() { return E.LEVELS[S.level]; }
  function mmss(t) { t = Math.max(0, Math.ceil(t)); return Math.floor(t / 60) + ':' + ('0' + t % 60).slice(-2); }

  function say(text, mood, force) {
    var now = performance.now();
    if (!force && now - S.lastSay < 2200) return;
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
    if (f.dataset.mood === mood && f.dataset.level === S.level) return;
    f.innerHTML = A.face(S.level, mood);
    f.dataset.mood = mood;
    f.dataset.level = S.level;
  }

  function sfx(kind) {
    switch (kind) {
      case 'bark': A.noise(0.12, 0.09, 0, 700, 0.8); A.tone(300, 0.12, 'sawtooth', 0.05, 0, 180); A.noise(0.1, 0.07, 0.16, 800, 0.8); A.tone(320, 0.1, 'sawtooth', 0.04, 0.16, 200); break;
      case 'baa': A.tone(430, 0.32, 'sawtooth', 0.025, 0, 360); A.tone(436, 0.32, 'square', 0.012, 0, 350); break;
      case 'pen': A.tone(784, 0.08, 'triangle', 0.05); A.tone(1046, 0.12, 'triangle', 0.04, 0.07); break;
      case 'wolf': A.tone(300, 0.5, 'sine', 0.05, 0, 620); A.tone(620, 0.7, 'sine', 0.04, 0.5, 380); break;
      case 'caught': A.tone(240, 0.4, 'sawtooth', 0.05, 0, 90); break;
    }
  }

  // ---------- drawing ----------

  var cvs = $('#field'), ctx = cvs.getContext('2d'), scale = 1;
  var grass = null;

  function layout() {
    var w = cvs.parentNode.clientWidth;
    scale = w / FW;
    var dpr = window.devicePixelRatio || 1;
    cvs.width = Math.round(FW * scale * dpr);
    cvs.height = Math.round(FH * scale * dpr);
    cvs.style.height = FH * scale + 'px';
    ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
    grass = null;
    draw();
  }

  function line(fn) { ctx.beginPath(); fn(); ctx.stroke(); }

  function bakeGrass() {
    grass = document.createElement('canvas');
    var dpr = window.devicePixelRatio || 1;
    grass.width = Math.round(FW * scale * dpr);
    grass.height = Math.round(FH * scale * dpr);
    var g = grass.getContext('2d');
    g.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
    for (var i = 0; i < 12; i++) { g.fillStyle = i % 2 ? '#7CC468' : '#86CC72'; g.fillRect(i * FW / 12, 0, FW / 12, FH); }
    var r = E.rng(3);
    for (var k = 0; k < 140; k++) {
      var x = r() * FW, y = r() * FH;
      g.strokeStyle = '#5FA94C'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + 3, y - 7); g.lineTo(x + 6, y); g.stroke();
    }
    for (var f = 0; f < 40; f++) {
      g.fillStyle = ['#FFE27A', '#fff', '#FF9FB8'][f % 3];
      g.beginPath(); g.arc(r() * FW, r() * FH, 2.6, 0, Math.PI * 2); g.fill();
    }
    var w = S.world;
    // pen floor
    var P = E.PEN;
    g.fillStyle = '#C9A66B';
    g.fillRect(P.x, P.y, P.w, P.h);
    g.fillStyle = 'rgba(255,255,255,.18)';
    for (var s = 0; s < 8; s++) g.fillRect(P.x + 8, P.y + 12 + s * 26, P.w - 16, 6);
    // pond and trees
    w.obstacles.forEach(function (o) {
      if (o.kind === 'pond') {
        g.fillStyle = '#1D1A33'; g.beginPath(); g.ellipse(o.x + 3, o.y + 4, o.r + 4, o.r * 0.82 + 4, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#5DB7E8'; g.beginPath(); g.ellipse(o.x, o.y, o.r, o.r * 0.82, 0, 0, Math.PI * 2); g.fill();
        g.strokeStyle = '#1D1A33'; g.lineWidth = 3; g.stroke();
        g.strokeStyle = 'rgba(255,255,255,.6)'; g.lineWidth = 4;
        g.beginPath(); g.arc(o.x - o.r * 0.3, o.y - o.r * 0.25, o.r * 0.35, Math.PI * 1.1, Math.PI * 1.6); g.stroke();
        g.fillStyle = '#3CB371'; g.beginPath(); g.arc(o.x + o.r * 0.35, o.y + o.r * 0.2, 9, 0.4, Math.PI * 2 - 0.2); g.lineTo(o.x + o.r * 0.35, o.y + o.r * 0.2); g.fill();
      }
    });
    return g;
  }

  function drawTree(o) {
    ctx.fillStyle = 'rgba(0,0,0,.18)';
    ctx.beginPath(); ctx.arc(o.x + 6, o.y + 8, o.r, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = '#1D1A33';
    ctx.fillStyle = '#2E8B3E';
    [[0, 0, 1], [-0.45, -0.3, 0.62], [0.45, -0.25, 0.6], [0.1, 0.45, 0.58]].forEach(function (b) {
      ctx.beginPath(); ctx.arc(o.x + b[0] * o.r, o.y + b[1] * o.r, o.r * b[2], 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    });
    ctx.fillStyle = '#3FA650';
    ctx.beginPath(); ctx.arc(o.x - o.r * 0.25, o.y - o.r * 0.25, o.r * 0.35, 0, Math.PI * 2); ctx.fill();
  }

  function drawFence() {
    var P = E.PEN;
    ctx.lineCap = 'round';
    E.WALLS.forEach(function (w) {
      ctx.strokeStyle = '#1D1A33'; ctx.lineWidth = 10; line(function () { ctx.moveTo(w[0], w[1]); ctx.lineTo(w[2], w[3]); });
      ctx.strokeStyle = '#B07A3E'; ctx.lineWidth = 5; line(function () { ctx.moveTo(w[0], w[1]); ctx.lineTo(w[2], w[3]); });
      var dx = w[2] - w[0], dy = w[3] - w[1], n = Math.max(1, Math.round(Math.sqrt(dx * dx + dy * dy) / 34));
      for (var i = 0; i <= n; i++) {
        var x = w[0] + dx * i / n, y = w[1] + dy * i / n;
        ctx.fillStyle = '#1D1A33'; ctx.fillRect(x - 5, y - 5, 10, 10);
        ctx.fillStyle = '#8B5A2B'; ctx.fillRect(x - 3, y - 3, 6, 6);
      }
    });
    // gate arrows and sign
    ctx.fillStyle = 'rgba(255,255,255,.75)';
    var gx = P.x - 26, gy = E.GATE.y;
    ctx.beginPath(); ctx.moveTo(gx - 12, gy - 12); ctx.lineTo(gx + 6, gy); ctx.lineTo(gx - 12, gy + 12); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#1D1A33';
    ctx.fillRect(P.x + P.w / 2 - 32, P.y - 34, 64, 26);
    ctx.fillStyle = '#FFE27A';
    ctx.fillRect(P.x + P.w / 2 - 29, P.y - 31, 58, 20);
    ctx.fillStyle = '#1D1A33';
    ctx.font = '18px ' + getComputedStyle(document.documentElement).getPropertyValue('--display');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('PEN', P.x + P.w / 2, P.y - 20);
  }

  function drawSheep(s, color) {
    var ang = Math.atan2(s.vy, s.vx), moving = Math.abs(s.vx) + Math.abs(s.vy) > 3;
    if (!moving) ang = s.lastAng || 0; else s.lastAng = ang;
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.fillStyle = 'rgba(0,0,0,.16)';
    ctx.beginPath(); ctx.ellipse(3, 5, 15, 11, 0, 0, Math.PI * 2); ctx.fill();
    ctx.rotate(ang);
    // head
    ctx.fillStyle = '#1D1A33';
    ctx.beginPath(); ctx.ellipse(13, 0, 7, 6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(16, -2.4, 1.4, 0, Math.PI * 2); ctx.arc(16, 2.4, 1.4, 0, Math.PI * 2); ctx.fill();
    // wool
    ctx.lineWidth = 2.5; ctx.strokeStyle = '#1D1A33'; ctx.fillStyle = s.lost ? '#ccc' : '#fff';
    [[-6, -5, 7], [2, -6, 7], [-7, 5, 7], [2, 6, 7], [-2, 0, 8]].forEach(function (b) { ctx.beginPath(); ctx.arc(b[0], b[1], b[2], 0, Math.PI * 2); ctx.fill(); ctx.stroke(); });
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(-2, 0, 7.4, 0, Math.PI * 2); ctx.fill();
    if (color) {
      ctx.fillStyle = color; ctx.strokeStyle = '#1D1A33'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(8, 0, 4.2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
    ctx.restore();
    if (color) {
      // a little star marks the lead sheep
      ctx.save();
      ctx.translate(s.x, s.y - 22);
      ctx.fillStyle = color; ctx.strokeStyle = '#1D1A33'; ctx.lineWidth = 2;
      ctx.beginPath();
      for (var i = 0; i < 10; i++) { var rr = i % 2 ? 4.4 : 10, a = -Math.PI / 2 + i * Math.PI / 5; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.restore();
    }
    if (s.scare > 0 && !s.penned) {
      ctx.fillStyle = '#FF6B57'; ctx.strokeStyle = '#1D1A33'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(s.x + 10, s.y - 16, 7, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('!', s.x + 10, s.y - 15.5);
    }
  }

  function drawDog(d) {
    var ang = Math.atan2(d.vy, d.vx);
    if (d.speed < 4) ang = S.dogAng || 0; else S.dogAng = ang;
    ctx.save();
    ctx.translate(d.x, d.y);
    ctx.fillStyle = 'rgba(0,0,0,.18)';
    ctx.beginPath(); ctx.ellipse(3, 6, 18, 10, 0, 0, Math.PI * 2); ctx.fill();
    ctx.rotate(ang);
    ctx.lineWidth = 2.5; ctx.strokeStyle = '#1D1A33';
    var wag = Math.sin(performance.now() / 70) * 0.5;
    ctx.save(); ctx.translate(-14, 0); ctx.rotate(wag);
    ctx.fillStyle = '#B5651D'; ctx.beginPath(); ctx.ellipse(-8, 0, 9, 3.6, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.restore();
    ctx.fillStyle = '#B5651D';
    ctx.beginPath(); ctx.ellipse(-2, 0, 15, 9, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(-2, 0, 7, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#FF6B57'; ctx.fillRect(8, -6, 4, 12);
    ctx.fillStyle = '#B5651D'; ctx.beginPath(); ctx.arc(16, 0, 8.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#5C3310';
    ctx.beginPath(); ctx.ellipse(13, -8, 5, 3, -0.6, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(13, 8, 5, 3, 0.6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1D1A33'; ctx.beginPath(); ctx.arc(24, 0, 2.6, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function drawWolf(w) {
    if (!w || !w.active) return;
    var ang = Math.atan2(w.vy, w.vx);
    ctx.save();
    ctx.translate(w.x, w.y);
    ctx.rotate(ang);
    ctx.lineWidth = 2.5; ctx.strokeStyle = '#1D1A33';
    ctx.fillStyle = '#6E7781';
    ctx.beginPath(); ctx.ellipse(-20, 0, 10, 4, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(-2, 0, 17, 10, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(10, -9); ctx.lineTo(30, 0); ctx.lineTo(10, 9); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#FF3B3B'; ctx.beginPath(); ctx.arc(17, -3.5, 1.8, 0, Math.PI * 2); ctx.arc(17, 3.5, 1.8, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function draw() {
    var w = S.world;
    if (!w) return;
    if (!grass) bakeGrass();
    ctx.clearRect(0, 0, FW, FH);
    var dpr = window.devicePixelRatio || 1;
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(grass, 0, 0); ctx.restore();
    ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
    drawFence();
    var lead = A.LEVEL_MAP[S.level].color;
    w.sheep.forEach(function (s) { if (!s.lost && !s.leader) drawSheep(s, null); });
    w.sheep.forEach(function (s) { if (!s.lost && s.leader) drawSheep(s, lead); });
    w.obstacles.forEach(function (o) { if (o.kind === 'tree') drawTree(o); });
    drawWolf(w.wolf);
    // bark rings
    var now = performance.now();
    S.rings = S.rings.filter(function (r) { return now - r.t < 500; });
    S.rings.forEach(function (r) {
      var k = (now - r.t) / 500;
      ctx.strokeStyle = 'rgba(255,107,87,' + (1 - k) + ')';
      ctx.lineWidth = 5;
      ctx.beginPath(); ctx.arc(r.x, r.y, 20 + k * (E.DOG.barkR - 20), 0, Math.PI * 2); ctx.stroke();
    });
    if (S.pointer && S.running && !w.over) {
      ctx.strokeStyle = 'rgba(29,26,51,.55)'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(S.pointer.x, S.pointer.y, 9, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(S.pointer.x - 14, S.pointer.y); ctx.lineTo(S.pointer.x + 14, S.pointer.y); ctx.moveTo(S.pointer.x, S.pointer.y - 14); ctx.lineTo(S.pointer.x, S.pointer.y + 14); ctx.stroke();
    }
    drawDog(w.dog);
    // wolf warning from off screen
    if (w.wolf && w.wolf.active && (w.wolf.x < 0 || w.wolf.x > FW || w.wolf.y < 0 || w.wolf.y > FH)) {
      var x = Math.max(16, Math.min(FW - 16, w.wolf.x)), y = Math.max(16, Math.min(FH - 16, w.wolf.y));
      ctx.fillStyle = '#FF6B57'; ctx.strokeStyle = '#1D1A33'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(x, y, 13, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.font = 'bold 16px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('!', x, y + 1);
    }
  }

  // ---------- input ----------

  function toField(e) {
    var r = cvs.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width * FW, y: (e.clientY - r.top) / r.height * FH };
  }
  var touchDown = false;
  cvs.addEventListener('pointermove', function (e) {
    if (e.pointerType === 'touch' && !touchDown) return;
    S.pointer = toField(e);
  });
  cvs.addEventListener('pointerdown', function (e) {
    touchDown = true;
    S.pointer = toField(e);
    if (e.pointerType === 'touch') cvs.setPointerCapture(e.pointerId);
  });
  cvs.addEventListener('pointerup', function (e) { touchDown = false; if (e.pointerType === 'touch') S.pointer = null; });
  cvs.addEventListener('pointerleave', function () { S.pointer = null; });

  function input() {
    var w = S.world, k = S.keys, dx = 0, dy = 0;
    if (k.arrowleft || k.a) dx -= 1;
    if (k.arrowright || k.d) dx += 1;
    if (k.arrowup || k.w) dy -= 1;
    if (k.arrowdown || k.s) dy += 1;
    var inp = { walk: S.sneak || !!k.shift, bark: S.barkQueued };
    S.barkQueued = false;
    if (dx || dy) { inp.tx = w.dog.x + dx * 80; inp.ty = w.dog.y + dy * 80; S.pointer = null; }
    else if (S.pointer) { inp.tx = S.pointer.x; inp.ty = S.pointer.y; }
    return inp;
  }

  // ---------- flow ----------

  function newField() {
    A.closeModal(true);
    S.world = new E.World(S.level, (Math.random() * 1e9) >>> 0);
    S.running = false;
    S.paused = false;
    S.pointer = null;
    S.endShown = false;
    S.rings = [];
    grass = null;
    var c = cfg();
    $('#start-card').hidden = false;
    $('#start-text').textContent = 'Get ' + c.need + ' of ' + c.sheep + ' sheep into the pen within ' + mmss(c.time) + '.' +
      (c.panic ? ' Do not run close to them: they panic and scatter.' : '') + (c.wolf ? ' A wolf will come for stragglers. Chase it off!' : '');
    $('#lost-box').hidden = !c.wolf;
    say(pick(TALK[S.level].start), 'smug', true);
    renderPanel();
    renderHud();
    draw();
    A.music.intensity(0.4);
  }

  function start() {
    if (S.running || !S.world || S.world.over) return;
    S.running = true;
    S.acc = 0;
    S.lastFrame = 0;
    $('#start-card').hidden = true;
    sfx('bark');
    A.music.intensity(0.6);
  }

  function flash(text, bad) {
    var f = $('#flash');
    f.textContent = text;
    f.className = 'flash' + (bad ? ' bad' : '');
    f.hidden = false;
    S.flashUntil = performance.now() + 1300;
  }

  function handle(ev) {
    var T = TALK[S.level];
    if (ev.type === 'penned') { sfx('pen'); if (ev.leader) { flash('Leader penned!'); say(pick(T.penned), 'annoyed', true); } else if (Math.random() < 0.35) say(pick(T.penned), 'annoyed'); }
    else if (ev.type === 'bark') { sfx('bark'); S.rings.push({ x: S.world.dog.x, y: S.world.dog.y, t: performance.now() }); }
    else if (ev.type === 'stir') { sfx('baa'); say(pick(T.scare), 'happy'); }
    else if (ev.type === 'wolf') { sfx('wolf'); flash('Wolf!', true); say('A wolf! Eek! Hee hee.', 'surprised', true); }
    else if (ev.type === 'wolfgone') { flash('Wolf chased off!'); }
    else if (ev.type === 'caught') { sfx('caught'); flash('The wolf got one!', true); }
    else if (ev.type === 'end') sc.timeout(endGame, 400);
  }

  function frame(now) {
    sc.raf(frame);
    var w = S.world;
    var dt = S.lastFrame ? Math.min(0.1, (now - S.lastFrame) / 1000) : 0;
    S.lastFrame = now;
    if (w && S.running && !w.over && !(S.paused || A.isBoss() || A.modalOpen() || document.hidden)) {
      S.acc += dt;
      var scaredBefore = w.sheep.some(function (s) { return s.scare > 0.5 && !s.penned; });
      while (S.acc >= E.DT && !w.over) {
        w.step(input());
        w.events.forEach(handle);
        w.events.length = 0;
        S.acc -= E.DT;
      }
      var scared = w.sheep.some(function (s) { return s.scare > 0.5 && !s.penned; });
      if (scared && !scaredBefore && Math.random() < 0.5) { sfx('baa'); say(pick(TALK[S.level].scare), 'happy'); }
      renderHud();
    }
    $('#flash').hidden = now > S.flashUntil;
    draw();
  }

  function renderHud() {
    var w = S.world, c = cfg(), n = w.counts(), left = c.time - w.t;
    $('#time').textContent = mmss(left);
    $('#time').parentNode.classList.toggle('low', left < 20);
    $('#penned').textContent = n.penned;
    $('#need').textContent = c.need;
    $('#lost').textContent = n.lost;
    var b = $('.bark-meter');
    $('#bark-fill').style.width = (100 * (1 - w.bark / E.DOG.barkCool)) + '%';
    b.classList.toggle('ready', w.bark <= 0);
    $('#btn-pause').textContent = S.paused ? 'Resume (P)' : 'Pause (P)';
    $('#btn-pause').disabled = !S.running || w.over;
    $('#btn-sneak').setAttribute('aria-pressed', String(S.sneak));
    A.music.intensity(S.running ? 0.45 + 0.5 * Math.min(1, w.t / c.time) : 0.4);
  }

  function renderPanel() {
    var Lv = L(), c = cfg();
    $('#bot-name').textContent = Lv.name;
    $('#bot-rank').textContent = Lv.rank + ' lead sheep';
    var tips = [
      'Your dog runs toward the pointer. Keep the pointer close to the dog to move gently.',
      'Get behind the flock and push it toward the gate. Sheep run away from the dog.',
      'Round up stragglers first, then drive the whole group.',
      'Sneak (Shift) to creep up without spooking them. Bark (Space) scatters every sheep nearby.'
    ];
    if (c.panic) tips.push('Edith\'s sheep bolt if you run near them. Trot, do not sprint.');
    if (c.wolf) tips.push('Run at the wolf to chase it off before it reaches a sheep.');
    tips.push('The sheep with the star is ' + Lv.name + '. The others follow her.');
    $('#tips').innerHTML = tips.map(function (t) { return '<li>' + A.esc(t) + '</li>'; }).join('');
    var best = A.progress(GAME)[S.level];
    $('#best').textContent = best ? 'Your best against ' + Lv.name + ': ' + best.text + '.' : Lv.name + '\'s flock has never been penned.';
  }

  function endGame() {
    var w = S.world;
    if (S.endShown || !w.over) return;
    S.endShown = true;
    var c = cfg(), Lv = L(), n = w.counts(), won = w.result === 'win', left = Math.max(0, c.time - w.t);
    var stars = !won ? 0 : left >= c.time * 0.5 ? 3 : left >= c.time * 0.25 ? 2 : 1;
    var base = 100 * n.penned + (won ? 500 + Math.round(5 * left) : 0);
    A.account.submit(GAME, S.level, A.points(S.level, base), n.penned + ' sheep penned' + (won ? ' with ' + mmss(left) + ' left' : ''));
    renderHud();
    A.music.intensity(0.4);
    var T = TALK[S.level];
    if (won) {
      var rec = A.record(GAME, S.level, { stars: stars, score: Math.round(left), lowerIsBetter: false, text: 'penned with ' + mmss(left) + ' to spare' });
      bar.refresh();
      A.jingle('win');
      say(pick(T.win), 'dead', true);
      var next = ORDER[ORDER.indexOf(S.level) + 1], buttons = [];
      if (next) buttons.push({ label: 'Next flock: ' + A.LEVEL_MAP[next].name, kind: 'main', onClick: function () { switchTo(next); } });
      buttons.push({ label: 'New field', kind: next ? 'line' : 'main', onClick: newField });
      A.modal({
        title: S.level === 'edith' ? 'Edith\'s flock is in!' : 'Good dog!',
        tone: 'win',
        html: '<p class="lead">You penned ' + n.penned + ' sheep with <strong>' + mmss(left) + '</strong> left on the clock' + (n.lost ? ', and lost ' + n.lost + ' to the wolf' : '') + '.</p>' + A.stars(stars) +
          '<p><strong>' + (rec.better ? (rec.prev ? 'New best time against ' + Lv.name + '!' : 'First win against ' + Lv.name + '.') : 'Your best: ' + rec.prev.text + '.') + '</strong></p>' +
          (stars < 3 ? '<p class="soft">3 stars means finishing with at least half the time left.</p>' : ''),
        buttons: buttons
      });
    } else {
      A.jingle('lose');
      say(pick(T.lose), 'happy', true);
      A.modal({
        title: w.why === 'wolf' ? 'The wolf had dinner.' : 'Time is up!',
        tone: 'lose',
        html: '<p class="lead">You penned ' + n.penned + ' of the ' + c.need + ' sheep you needed' + (n.lost ? ', and the wolf took ' + n.lost : '') + '.</p>' +
          '<p class="soft">Tips: circle wide around the flock instead of running through it, then push from directly behind, pointing at the gate. Fetch stragglers first. ' +
          (c.panic ? 'Near Edith\'s sheep, keep the pointer close to your dog so it trots instead of sprinting.' : 'Sneak when you are close so they do not bolt past the gate.') + '</p>',
        buttons: [{ label: 'Try a new field', kind: 'main', onClick: newField }],
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
      var Lv = A.LEVEL_MAP[id], c = E.LEVELS[id];
      return '<div><dt>' + Lv.name + ', ' + Lv.rank.toLowerCase() + '</dt><dd>' + TALK[id].blurb + ' Pen ' + c.need + ' of ' + c.sheep + ' in ' + mmss(c.time) + '.</dd></div>';
    }).join('');
    A.modal({
      title: 'How to play',
      wide: true,
      html: '<p>You are the sheepdog. Get enough sheep through the gate and into the pen before the clock runs out.</p>' +
        '<ol><li>Your dog runs toward your pointer (or use the arrow keys or WASD). On a phone, drag on the field.</li>' +
        '<li>Sheep run away from the dog and stick together. Get behind them and push toward the gate.</li>' +
        '<li>The sheep with the star leads the flock. That is your opponent, and she has her own plans.</li>' +
        '<li>Hold Shift (or turn on Sneak) to creep up slowly. Space barks, which scares every sheep nearby. Use it sparingly.</li></ol>' +
        '<h3>Flocks</h3><dl>' + rows + '</dl>' +
        '<h3>Keys</h3><table class="keys"><tr><td><kbd>&uarr;</kbd> <kbd>&darr;</kbd> <kbd>&larr;</kbd> <kbd>&rarr;</kbd> or <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd></td><td>Move the dog</td></tr>' +
        '<tr><td><kbd>Shift</kbd></td><td>Sneak</td></tr><tr><td><kbd>Space</kbd></td><td>Bark</td></tr><tr><td><kbd>Enter</kbd> <kbd>P</kbd> <kbd>N</kbd></td><td>Start, pause, new field</td></tr>' +
        '<tr><td><kbd>M</kbd></td><td>Music on or off</td></tr><tr><td><kbd>B</kbd></td><td>Panic button (pauses the game)</td></tr></table>',
      buttons: [{ label: 'Good dog', kind: 'main' }]
    });
  }

  var bar = A.mountBar({
    el: $('#bar'),
    game: GAME,
    title: 'Herd Instinct',
    tagline: 'Be the sheepdog. Pen the flock before time runs out.',
    level: S.level,
    levelLabel: 'Flock',
    canSwitch: function () { return S.running && !S.world.over ? 'This round will be abandoned.' : true; },
    onLevel: function (id) { S.level = id; newField(); },
    onHelp: openHelp
  });
  sc.add(bar.destroy);

  $('#btn-start').addEventListener('click', start);
  $('#btn-pause').addEventListener('click', function () { if (S.running && !S.world.over) { S.paused = !S.paused; renderHud(); } });
  $('#btn-sneak').addEventListener('click', function () { S.sneak = !S.sneak; renderHud(); });
  $('#btn-bark').addEventListener('click', function () { if (S.running) S.barkQueued = true; });
  $('#btn-new').addEventListener('click', function () {
    if (!(S.running && !S.world.over)) return newField();
    A.confirm({ title: 'New field?', text: 'This round will be abandoned and the flock starts over.', yes: 'New field', no: 'Keep herding', onYes: newField });
  });

  var MOVE = ['arrowleft', 'arrowright', 'arrowup', 'arrowdown', 'w', 'a', 's', 'd'];
  sc.on(document, 'keydown', function (e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    var k = e.key.toLowerCase();
    if (MOVE.indexOf(k) >= 0) { e.preventDefault(); S.keys[k] = true; if (!S.running && !S.world.over && !A.modalOpen()) start(); return; }
    if (k === 'shift') { S.keys.shift = true; return; }
    if (k === ' ') { e.preventDefault(); if (S.running) S.barkQueued = true; return; }
    if (k === 'enter' && !(e.target && e.target.tagName === 'BUTTON')) { start(); return; }
    if (k === 'p') { $('#btn-pause').click(); return; }
    if (k === 'n') { $('#btn-new').click(); return; }
    if (k === '?') openHelp();
  });
  sc.on(document, 'keyup', function (e) { S.keys[e.key.toLowerCase()] = false; });
  sc.on(window, 'blur', function () { S.keys = {}; });

  var rt = null;
  sc.on(window, 'resize', function () { clearTimeout(rt); rt = sc.timeout(layout, 80); });

  newField();
  layout();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { if (sc.alive()) { grass = null; draw(); } });
  sc.raf(frame);
  if (A.firstVisit(GAME)) openHelp();

  window.herdInstinct = { state: S, start: start, newField: newField };
  return sc.dispose;
}
