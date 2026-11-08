/*
 * Level Crossing: the full-screen railway. Draws the map, the trains, cars and people on a canvas, turns clicks,
 * taps and keys into train, barrier, switch and signal commands, plays the railway sounds and runs the panel.
 * mount() runs after window.Arcade is ready (components/PageShell.jsx) and returns a cleanup function.
 */
import E from './engine.js';
import { building, prism, cylinder, tree3d, rectPts, lift, car3d, person3d, shade as tint } from '../shared/yard.js';

export function mount() {
  var A = window.Arcade;
  var sc = A.scope();
  var GAME = 'level-crossing';
  var ORDER = ['pip', 'gridlock', 'monolith', 'edith'];
  var INK = '#1D1A33';
  var COL = {
    red: { hex: '#E5483A', name: 'Red', shape: 'circle' },
    blue: { hex: '#3D86F0', name: 'Blue', shape: 'square' },
    green: { hex: '#2FBF71', name: 'Green', shape: 'triangle' },
    yellow: { hex: '#FFC93C', name: 'Yellow', shape: 'star' }
  };
  var TRAIN_COL = ['#7B4FD6', '#F28C28'];
  var CAR_COL = ['#F2F2F2', '#5B6BD9', '#E07A5F', '#81B29A', '#3D405B', '#F4D35E'];
  var SKIN = ['#F2C9A0', '#D9A066', '#A86B3C', '#7A4A2A', '#F6D7B8', '#C68B59'];

  function $(s) { return document.querySelector(s); }

  var S = {
    level: A.lastLevel(GAME), w: null, running: false, paused: false, acc: 0, lastFrame: 0, lastLine: '', bannerUntil: 0,
    pops: [], text: {}, endShown: false, sel: 0, view: { k: 20, ox: 0, oy: 0 }, fit: null, hover: null, crashAt: 0,
    bellT: {}, horned: {}, clack: {}, rumble: null
  };

  var TALK = {
    pip: {
      blurb: 'Runs the roads. Cars turn up whenever they like, at an easy pace, and drivers wait quite a while before they complain.',
      rank: 'Rookie traffic boss',
      start: ['Beep beep! I am in charge of the cars today.', 'Hi! I will send a few cars. Not too many. Probably.', 'Choo choo! Wait, I do the cars. Vroom vroom!'],
      jam: ['The cars are getting grumpy!', 'Honk honk! That was my cars, sorry.'],
      gaveup: ['Oh no, someone walked home!', 'A passenger gave up. Poor thing.'],
      mission: ['Mission done! You are good at this.', 'Yay, everyone got home!'],
      crash: ['Oh no! Is everyone okay?', 'Eek! That looked expensive.'],
      end: ['That was fun! Same time tomorrow?']
    },
    gridlock: {
      blurb: 'Sends the cars in tidy convoys of three to five, one road at a time. Patient, but the convoys keep coming.',
      rank: 'Pro traffic boss',
      start: ['Convoys depart on schedule.', 'Cars in neat lines. As it should be.', 'One convoy at a time. Keep your barriers tidy.'],
      jam: ['Convoy delayed. Complaint filed.', 'A queue of five. Unacceptable.'],
      gaveup: ['Passenger lost. Noted.', 'The timetable has failed someone.'],
      mission: ['Mission complete. On schedule.', 'Tidy work.'],
      crash: ['Collision recorded.', 'That was not on the timetable.'],
      end: ['Shift over. All convoys home.']
    },
    monolith: {
      blurb: 'Times the traffic: most cars head for the crossing your next train will reach first, arriving about when it does.',
      rank: 'Grandmaster traffic boss',
      start: ['I know where your train is going.', 'Your next crossing will be busy. I made sure.', 'Two trains, many roads. Let us see.'],
      jam: ['The drivers have had enough.', 'A closed barrier is a full road.'],
      gaveup: ['Another passenger walks.', 'Patience runs out. Noted.'],
      mission: ['Mission done. Impressive.', 'The passengers approve.'],
      crash: ['Timing is everything.', 'The road always wins in the end.'],
      end: ['The railway has spoken.']
    },
    edith: {
      blurb: 'Times the traffic like Excel, and runs her own freight train on your tracks. It never stops at stations, only at red lights, and it gets cross if you hold it too long.',
      rank: 'Impossible traffic boss',
      start: ['Hi! My freight train does not stop for anyone. Hee hee.', 'Edith Express is coming through. Better find your red lights!', 'I timed every car for your next crossing. You are welcome!'],
      jam: ['Honk honk! My drivers are SO bored.', 'Traffic jam! Was that you?'],
      gaveup: ['Aww, somebody walked home. Not my problem!', 'Oopsie, one less passenger!'],
      mission: ['Fine, you finished a mission. Whatever.', 'Lucky!'],
      crash: ['Edith Express never brakes!', 'Oopsie! Was that your train?'],
      end: ['Edith Express always gets through.']
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
  function mmss(t) { var s = Math.floor(t); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
  function setText(id, v) { if (S.text[id] !== v) { S.text[id] = v; $(id).textContent = v; } }
  function setHtml(id, v) { if (S.text[id] !== v) { S.text[id] = v; $(id).innerHTML = v; } }

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
    S.bannerUntil = performance.now() + (ms || 2400);
  }
  function chip(color, size) {
    var c = COL[color], s = size || 14, shape;
    if (c.shape === 'circle') shape = '<circle cx="8" cy="8" r="6.2"/>';
    else if (c.shape === 'square') shape = '<rect x="2.2" y="2.2" width="11.6" height="11.6" rx="1.5"/>';
    else if (c.shape === 'triangle') shape = '<path d="M8 1.6 L14.6 14 H1.4 Z"/>';
    else shape = '<path d="M8 1 L9.9 5.9 L15 6.1 L11 9.3 L12.4 14.4 L8 11.5 L3.6 14.4 L5 9.3 L1 6.1 L6.1 5.9 Z"/>';
    return '<svg class="chip" width="' + s + '" height="' + s + '" viewBox="0 0 16 16" aria-hidden="true"><g fill="' + c.hex + '" stroke="' + INK + '" stroke-width="1.6" stroke-linejoin="round">' + shape + '</g></svg>';
  }

  // ---------- sounds ----------
  // Short sounds use the shared tone and noise helpers; the rolling rumble is one looping noise on the sound bus.

  function soundLive() { return A.soundOn() && !A.isBoss(); }
  function horn(deep) {
    var f = deep ? [196, 247] : [349, 440];
    [0, 0.42].forEach(function (d, i) {
      if (deep && i) return;
      f.forEach(function (fr) { A.tone(fr, deep ? 0.75 : 0.32, 'sawtooth', 0.016, d); A.tone(fr * 2, deep ? 0.75 : 0.32, 'square', 0.004, d); });
    });
  }
  function sfx(kind, vol) {
    var v = vol == null ? 1 : vol;
    switch (kind) {
      case 'depart': A.noise(0.35, 0.035 * v, 0, 5200, 1.2); horn(false); A.tone(70, 0.9, 'sawtooth', 0.02 * v, 0.1, 110); break;
      case 'brake': A.noise(0.8, 0.028 * v, 0, 3600, 5); A.tone(2500, 0.7, 'sine', 0.01 * v, 0.05, 2200); A.tone(2700, 0.5, 'sine', 0.006 * v, 0.25, 2450); break;
      case 'stop': A.noise(0.5, 0.03, 0, 4800, 1.5); break; // air brakes letting go
      case 'doors': A.tone(784, 0.28, 'sine', 0.04); A.tone(622, 0.4, 'sine', 0.04, 0.24); A.noise(0.25, 0.015, 0.05, 2400, 1); break;
      case 'board': A.tone(700 + Math.random() * 300, 0.04, 'triangle', 0.014); break;
      case 'coin': A.tone(988, 0.06, 'square', 0.02); A.tone(1318, 0.12, 'square', 0.02, 0.05); break;
      case 'motor': A.tone(150, 0.9, 'sawtooth', 0.01, 0, 105); A.noise(0.9, 0.01, 0, 260, 1.2); break;
      case 'bell': A.tone(1568, 0.22, 'triangle', 0.024 * v); A.tone(4200, 0.12, 'sine', 0.004 * v); break;
      case 'bell2': A.tone(1397, 0.22, 'triangle', 0.024 * v); A.tone(3770, 0.12, 'sine', 0.004 * v); break;
      case 'pass': A.noise(0.8, 0.05 * v, 0, 480, 0.7); A.noise(0.5, 0.025 * v, 0.1, 1800, 0.8); break;
      case 'switch': A.noise(0.09, 0.07, 0, 340, 1.6); A.tone(110, 0.12, 'square', 0.03); A.tone(165, 0.08, 'square', 0.02, 0.06); break;
      case 'busy': A.tone(220, 0.12, 'square', 0.025); A.tone(196, 0.16, 'square', 0.025, 0.12); break;
      case 'signal': A.tone(1200, 0.03, 'square', 0.02); A.tone(600, 0.06, 'triangle', 0.025, 0.03); break;
      case 'honk': [0, 0.24].forEach(function (d) { A.tone(392, 0.16, 'square', 0.022, d); A.tone(494, 0.16, 'square', 0.016, d); }); break;
      case 'gaveup': A.tone(523, 0.14, 'triangle', 0.035); A.tone(392, 0.25, 'triangle', 0.035, 0.12, 330); break;
      case 'crash':
        A.noise(1.4, 0.14, 0, 260, 0.5); A.noise(0.7, 0.09, 0, 2600, 1); A.noise(0.35, 0.06, 0.15, 5200, 2);
        A.tone(80, 0.9, 'sine', 0.14, 0, 38); A.tone(1250, 0.6, 'square', 0.02, 0.05, 900); A.tone(1780, 0.5, 'triangle', 0.02, 0.12, 1500);
        break;
    }
  }
  function clack(vol) {
    A.noise(0.05, 0.03 * vol, 0, 900, 1.4);
    A.noise(0.05, 0.026 * vol, 0.085, 820, 1.4);
  }
  // the rolling rumble of every moving train, louder the faster they go
  function rumble(level) {
    if (!soundLive()) level = 0;
    if (!S.rumble && level > 0) {
      var ctx = A.audio(), bus = A.audioBus('sound'), buf = A.noiseBuffer();
      if (!ctx || !bus || !buf) return;
      var src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      src.buffer = buf; src.loop = true;
      f.type = 'lowpass'; f.frequency.value = 150; f.Q.value = 0.8;
      g.gain.value = 0.0001;
      src.connect(f); f.connect(g); g.connect(bus);
      src.start();
      S.rumble = { src: src, g: g, ctx: ctx };
    }
    if (S.rumble) S.rumble.g.gain.setTargetAtTime(Math.max(0.0001, level), S.rumble.ctx.currentTime, 0.15);
  }
  sc.add(function () {
    if (S.rumble) { try { S.rumble.src.stop(); S.rumble.src.disconnect(); S.rumble.g.disconnect(); } catch (e) { /* already stopped */ } S.rumble = null; }
  });

  // ---------- view ----------

  var cvs = $('#map'), ctx = cvs.getContext('2d'), stat = document.createElement('canvas'), sctx = stat.getContext('2d'), high = document.createElement('canvas'), hctx = high.getContext('2d');
  var panel = $('#panel'), stage = $('#stage');

  function fitRect() {
    var w = stage.clientWidth, h = stage.clientHeight;
    var beside = getComputedStyle(panel).position === 'absolute';
    var x0 = beside ? panel.offsetLeft + panel.offsetWidth + 12 : 8;
    return { w: w, h: h, x0: x0, y0: 8, x1: w - 8, y1: h - 8 };
  }

  function layout() {
    var f = fitRect(), dpr = window.devicePixelRatio || 1;
    S.fit = f;
    cvs.width = Math.max(1, Math.round(f.w * dpr));
    cvs.height = Math.max(1, Math.round(f.h * dpr));
    cvs.style.width = f.w + 'px';
    cvs.style.height = f.h + 'px';
    stat.width = high.width = cvs.width;
    stat.height = high.height = cvs.height;
    if (S.w) {
      var m = S.w.map, k = Math.min((f.x1 - f.x0) / m.W, (f.y1 - f.y0) / m.H);
      S.view = { k: k, ox: f.x0 + ((f.x1 - f.x0) - m.W * k) / 2, oy: f.y0 + ((f.y1 - f.y0) - m.H * k) / 2 };
      drawStatic();
    }
    draw(performance.now());
  }

  function X(u) { return S.view.ox + u * S.view.k; }
  function Y(u) { return S.view.oy + u * S.view.k; }

  function rr(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  function trackPath(c, Ed, off, from, to) {
    var a = Math.max(0, Math.floor((from || 0) / Ed.step)), b = Math.min(Ed.x.length - 1, to == null ? Ed.x.length - 1 : Math.ceil(to / Ed.step));
    c.beginPath();
    for (var i = a; i <= b; i++) {
      var j = Math.min(i, Ed.x.length - 2), dx = Ed.x[j + 1] - Ed.x[j], dy = Ed.y[j + 1] - Ed.y[j], l = Math.hypot(dx, dy) || 1;
      var x = X(Ed.x[i] - dy / l * off), y = Y(Ed.y[i] + dx / l * off);
      if (i === a) c.moveTo(x, y); else c.lineTo(x, y);
    }
  }

  function drawStatic() {
    var c = sctx, w = S.w, m = w.map, k = S.view.k, dpr = window.devicePixelRatio || 1, f = S.fit;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.fillStyle = '#8CCB5E';
    c.fillRect(0, 0, f.w, f.h);
    // meadow patches in a lighter and a darker green, then a soft pattern of grass tufts
    for (var pi = 0; pi < 26; pi++) {
      var gxp = hash(pi, m.W, 5) * f.w, gyp = hash(pi, m.H, 6) * f.h, gr = (1.2 + hash(pi, 1, 7) * 2.2) * k;
      c.beginPath(); c.ellipse(gxp, gyp, gr * 1.5, gr, hash(pi, 2, 8) * Math.PI, 0, Math.PI * 2);
      c.fillStyle = pi % 3 ? 'rgba(170, 220, 110, .35)' : 'rgba(60, 140, 60, .14)'; c.fill();
    }
    c.fillStyle = 'rgba(40, 110, 50, .14)';
    for (var gy = 6; gy < f.h; gy += 22) for (var gx = (gy / 22 % 2) * 11 + 4; gx < f.w; gx += 22) { c.beginPath(); c.arc(gx, gy, 1.6, 0, Math.PI * 2); c.fill(); }
    c.lineCap = 'round';
    c.lineJoin = 'round';

    // track bed and sleepers
    m.edges.forEach(function (Ed) {
      trackPath(c, Ed, 0);
      c.strokeStyle = '#C9B99A'; c.lineWidth = 0.86 * k; c.stroke();
      c.strokeStyle = 'rgba(29,26,51,.25)'; c.lineWidth = 0.86 * k + 2; c.globalCompositeOperation = 'destination-over'; c.stroke(); c.globalCompositeOperation = 'source-over';
      c.strokeStyle = '#7A5534'; c.lineWidth = Math.max(1.5, 0.13 * k); c.lineCap = 'butt';
      for (var s = 0.2; s < Ed.len; s += 0.42) {
        var p = Ed.at(s), dx = Math.cos(p[2]), dy = Math.sin(p[2]);
        c.beginPath(); c.moveTo(X(p[0] + dy * 0.34), Y(p[1] - dx * 0.34)); c.lineTo(X(p[0] - dy * 0.34), Y(p[1] + dx * 0.34)); c.stroke();
      }
      c.lineCap = 'round';
    });

    // roads, right across the screen
    m.roads.forEach(function (r) {
      var a = r.horizontal ? Y(r.at) : X(r.at), half = 0.66 * k;
      c.fillStyle = INK;
      if (r.horizontal) c.fillRect(0, a - half - 2, f.w, half * 2 + 4); else c.fillRect(a - half - 2, 0, half * 2 + 4, f.h);
      c.fillStyle = '#5E6372';
      if (r.horizontal) c.fillRect(0, a - half, f.w, half * 2); else c.fillRect(a - half, 0, half * 2, f.h);
      c.strokeStyle = '#FFE08A'; c.lineWidth = Math.max(1, 0.06 * k); c.setLineDash([0.45 * k, 0.4 * k]);
      c.beginPath();
      if (r.horizontal) { c.moveTo(0, a); c.lineTo(f.w, a); } else { c.moveTo(a, 0); c.lineTo(a, f.h); }
      c.stroke(); c.setLineDash([]);
    });
    // crossing planks and stop lines
    m.crossings.forEach(function (cr) {
      var r = m.roads[cr.road], hw = 0.66;
      c.fillStyle = '#4A4F5C';
      if (r.horizontal) c.fillRect(X(cr.x - 0.55), Y(r.at - hw), 1.1 * k, 2 * hw * k);
      else c.fillRect(X(r.at - hw), Y(cr.y - 0.55), 2 * hw * k, 1.1 * k);
      c.strokeStyle = '#fff'; c.lineWidth = Math.max(1, 0.07 * k);
      [-1, 1].forEach(function (sd) {
        c.beginPath();
        if (r.horizontal) { var sx = X(cr.x + sd * 0.95); c.moveTo(sx, Y(r.at + (sd > 0 ? -hw : 0))); c.lineTo(sx, Y(r.at + (sd > 0 ? 0 : hw))); }
        else { var sy = Y(cr.y + sd * 0.95); c.moveTo(X(r.at + (sd > 0 ? 0 : -hw)), sy); c.lineTo(X(r.at + (sd > 0 ? hw : 0)), sy); }
        c.stroke();
      });
    });

    // rails, over the road too
    m.edges.forEach(function (Ed) {
      [-0.16, 0.16].forEach(function (off) {
        trackPath(c, Ed, off);
        c.strokeStyle = '#5C6170'; c.lineWidth = Math.max(1.4, 0.075 * k); c.stroke();
      });
    });
    // arrows: trains run one way only
    m.edges.forEach(function (Ed) {
      for (var s = Ed.len * 0.5 % 6 + 2.5; s < Ed.len - 1.5; s += 6) {
        var p = Ed.at(s), a = p[2];
        if (m.stations.some(function (st) { return st.edge === Ed.id && s > st.s0 - 1.5 && s < st.s1 + 0.5; })) continue;
        if (Ed.crossings.some(function (ci) { return Math.abs(m.crossings[ci].s - s) < 1.5; })) continue;
        c.save(); c.translate(X(p[0]), Y(p[1])); c.rotate(a);
        c.fillStyle = 'rgba(255,255,255,.9)'; c.strokeStyle = INK; c.lineWidth = 1.2;
        c.beginPath(); c.moveTo(0.18 * k, 0); c.lineTo(-0.12 * k, -0.15 * k); c.lineTo(-0.04 * k, 0); c.lineTo(-0.12 * k, 0.15 * k); c.closePath(); c.fill(); c.stroke();
        c.restore();
      }
    });

    // platforms on the ground, then everything with height from the back to the front
    m.stations.forEach(function (st) { drawPlatform(c, st, k); });
    // the raised layer goes over the trains and cars, so they pass behind buildings and trees
    var h2 = hctx;
    h2.setTransform(dpr, 0, 0, dpr, 0, 0);
    h2.clearRect(0, 0, f.w, f.h);
    h2.lineCap = 'round'; h2.lineJoin = 'round';
    var raised = [];
    m.decor.forEach(function (d) { raised.push({ y: d.y + d.r * 0.5, fn: function () { drawDecor(h2, d, k); } }); });
    m.stations.forEach(function (st) { var hb = stationHouse(st); raised.push({ y: hb[3], fn: function () { drawStationHouse(h2, st, hb, k); } }); });
    raised.sort(function (a2, b2) { return a2.y - b2.y; });
    raised.forEach(function (it) { it.fn(); });
    m.stations.forEach(function (st) { stationBoard(h2, st, k); });
  }
  function world(c) { c.save(); c.translate(S.view.ox, S.view.oy); c.scale(S.view.k, S.view.k); }

  // ---------- houses, trees and stations, all seen from above ----------

  // a steady random number for a spot on the map, so the same map always looks the same
  function hash(x, y, n) { var v = Math.sin(x * 12.9898 + y * 78.233 + (n || 0) * 37.719) * 43758.5453; return v - Math.floor(v); }
  // draw in map units around (x, y), turned by angle a
  function local(c, x, y, a, k) { c.save(); c.translate(X(x), Y(y)); c.rotate(a || 0); c.scale(k, k); }
  function rect(c, x, y, w, h) { c.beginPath(); c.rect(x, y, w, h); }
  function rrect(c, x, y, w, h, r) { rr(c, x, y, w, h, r); }
  // a hipped roof seen from above: four slopes in three shades around a ridge
  function hipRoof(c, L, W, light, mid, dark, k) {
    var h = W / 2, ink = 2 / k;
    c.lineJoin = 'round';
    c.fillStyle = light; c.beginPath(); c.moveTo(-L / 2, -h); c.lineTo(L / 2, -h); c.lineTo(L / 2 - h, 0); c.lineTo(-L / 2 + h, 0); c.closePath(); c.fill();
    c.fillStyle = dark; c.beginPath(); c.moveTo(-L / 2, h); c.lineTo(L / 2, h); c.lineTo(L / 2 - h, 0); c.lineTo(-L / 2 + h, 0); c.closePath(); c.fill();
    c.fillStyle = mid;
    c.beginPath(); c.moveTo(-L / 2, -h); c.lineTo(-L / 2 + h, 0); c.lineTo(-L / 2, h); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(L / 2, -h); c.lineTo(L / 2 - h, 0); c.lineTo(L / 2, h); c.closePath(); c.fill();
    // roof tiles
    c.strokeStyle = 'rgba(29,26,51,.18)'; c.lineWidth = 1 / k;
    for (var t = 1; t < 3; t++) {
      var q = h * t / 3;
      c.beginPath(); c.moveTo(-L / 2 + q, -h + q); c.lineTo(L / 2 - q, -h + q); c.moveTo(-L / 2 + q, h - q); c.lineTo(L / 2 - q, h - q); c.stroke();
    }
    c.strokeStyle = INK; c.lineWidth = ink * 0.6;
    c.beginPath(); c.moveTo(-L / 2, -h); c.lineTo(-L / 2 + h, 0); c.lineTo(-L / 2, h); c.moveTo(L / 2, -h); c.lineTo(L / 2 - h, 0); c.lineTo(L / 2, h); c.moveTo(-L / 2 + h, 0); c.lineTo(L / 2 - h, 0); c.stroke();
    c.lineWidth = ink; rect(c, -L / 2, -h, L, W); c.stroke();
  }

  var ROOFS = [
    ['#F07A5A', '#D9603B', '#B54A2C'], ['#7FA3D9', '#5B7DB1', '#44628F'],
    ['#B98BC9', '#8E5B9E', '#6E447C'], ['#5CC2B5', '#2E9A8C', '#1F756A']
  ];

  var WALLS = ['#F4E9D8', '#F2DCC8', '#E8E4D8', '#F6E3C9'];

  // houses and corner shops standing up, facing the nearest road with a path to it
  function drawHouse(c, d, k) {
    var hv = hash(d.x, d.y), sc = d.r / 1.1, L = 1.5 * sc, W = 1.06 * sc, roof = ROOFS[d.hue % ROOFS.length];
    var road = null, gap = 1e9;
    S.w.map.roads.forEach(function (rd) { var g = Math.abs((rd.horizontal ? d.y : d.x) - rd.at); if (g < gap) { gap = g; road = rd; } });
    var ang = hv < 0.5 ? 0 : Math.PI / 2, walk = 0;
    if (road && gap < 3.4) {
      if (road.horizontal) ang = road.at > d.y ? 0 : Math.PI; else ang = road.at > d.x ? -Math.PI / 2 : Math.PI / 2;
      walk = gap - 0.66;
    }
    var side = Math.abs(Math.sin(ang)) > 0.5, fx = side ? W : L, fy = side ? L : W;
    var dirx = -Math.sin(ang), diry = Math.cos(ang); // the way the front door faces
    var shop = hash(d.x, d.y, 1) < 0.35;
    world(c);
    // the garden and the path, on the ground
    if (!shop) {
      rr(c, d.x - fx / 2 - 0.22, d.y - fy / 2 - 0.22, fx + 0.44, fy + 0.44, 0.16); c.fillStyle = '#A9DB7A'; c.fill();
      c.setLineDash([0.08, 0.07]); c.strokeStyle = '#fff'; c.lineWidth = 2 / k; c.stroke(); c.setLineDash([]);
    }
    if (walk > W / 2) {
      var w0 = W / 2, px = d.x + dirx * w0, py = d.y + diry * w0;
      c.beginPath(); c.moveTo(px - diry * 0.1, py + dirx * 0.1); c.lineTo(px + diry * 0.1, py - dirx * 0.1); c.lineTo(px + diry * 0.1 + dirx * (walk - w0), py - dirx * 0.1 + diry * (walk - w0)); c.lineTo(px - diry * 0.1 + dirx * (walk - w0), py + dirx * 0.1 + diry * (walk - w0)); c.closePath();
      c.fillStyle = '#E8D9B5'; c.fill();
    }
    var x0 = d.x - fx / 2, x1 = d.x + fx / 2, y0 = d.y - fy / 2, y1 = d.y + fy / 2;
    if (shop) {
      building(c, x0, y0, x1, y1, 0.75 * sc + 0.25, { k: k, wall: '#E8E4D8', tint: '#DDE1E8', window: '#9CC9D3', floors: 2, door: true });
      // a striped awning over the shop front when it faces us
      if (diry > 0.5) {
        var n = 6, sw = (x1 - x0 - 0.1) / n, Lh = lift(0.32);
        for (var i = 0; i < n; i++) {
          var ax = x0 + 0.05 + i * sw;
          c.beginPath(); c.moveTo(ax + Lh[0], y1 + Lh[1]); c.lineTo(ax + sw + Lh[0], y1 + Lh[1]); c.lineTo(ax + sw + Lh[0] * 0.55, y1 + 0.22 + Lh[1] * 0.55); c.lineTo(ax + Lh[0] * 0.55, y1 + 0.22 + Lh[1] * 0.55); c.closePath();
          c.fillStyle = i % 2 ? '#fff' : roof[1]; c.fill(); c.strokeStyle = INK; c.lineWidth = 1.2 / k; c.stroke();
        }
      }
    } else {
      var h = 0.62 * sc + 0.15;
      building(c, x0, y0, x1, y1, h, { k: k, wall: WALLS[d.hue % WALLS.length], kind: 'hip', roof: roof, window: '#9CC9D3', floors: 1, door: diry > 0.5 });
      // a chimney poking out of the roof
      var Lr = lift(h), cxp = d.x + (hash(d.x, d.y, 2) < 0.5 ? 1 : -1) * fx * 0.2 + Lr[0], cyp = d.y - fy * 0.2 + Lr[1];
      prism(c, rectPts(cxp, cyp, 0.18, 0.18, 0), 0.3, { k: k, top: '#6E3B2A', wall: '#9A4E36', shadow: false });
      // flowers by the door
      [[-0.3, '#FF8FB1'], [-0.18, '#FFE066'], [0.28, '#FF8FB1']].forEach(function (f) {
        c.beginPath(); c.arc(d.x + dirx * (W / 2 + 0.12) + diry * f[0], d.y + diry * (W / 2 + 0.12) - dirx * f[0], 0.06, 0, Math.PI * 2); c.fillStyle = f[1]; c.fill();
      });
    }
    c.restore();
  }

  function drawDecor(c, d, k) {
    if (d.kind === 'house') { drawHouse(c, d, k); return; }
    world(c);
    var kind = d.kind === 'tree' && hash(d.x, d.y, 3) < 0.3 ? 'pine' : d.kind;
    tree3d(c, d.x, d.y, d.r, kind, d.hue, k);
    c.restore();
  }

  function platformCorners(st, a, b) {
    var Ed = S.w.map.edges[st.edge], p0 = Ed.at(st.s0), p1 = Ed.at(st.s1);
    return [
      [p0[0] + st.nx * a, p0[1] + st.ny * a], [p1[0] + st.nx * a, p1[1] + st.ny * a],
      [p1[0] + st.nx * b, p1[1] + st.ny * b], [p0[0] + st.nx * b, p0[1] + st.ny * b]
    ];
  }
  function poly(c, pts) { c.beginPath(); pts.forEach(function (p, i) { if (i) c.lineTo(X(p[0]), Y(p[1])); else c.moveTo(X(p[0]), Y(p[1])); }); c.closePath(); }
  var STATION_SHADE = { red: ['#F27A6E', '#E5483A', '#B8352A'], blue: ['#78AAF5', '#3D86F0', '#2A63B8'], green: ['#6BD69A', '#2FBF71', '#1F8E52'], yellow: ['#FFDB7A', '#FFC93C', '#D9A21F'] };

  // the platform: a raised slab of paving with a yellow edge and lamp posts
  function drawPlatform(c, st, k) {
    var deck = platformCorners(st, 0.45, 1.32);
    world(c);
    var top = prism(c, deck, 0.12, { k: k, top: '#ECE4D2', wall: '#C9BFA9' });
    // paving lines and the yellow edge on the raised top
    var Ed = S.w.map.edges[st.edge], L = st.s1 - st.s0, d0 = Ed.dir(st.s0), lh = lift(0.12);
    c.strokeStyle = 'rgba(29,26,51,.1)'; c.lineWidth = 1.2 / k;
    for (var u = 0.42; u < L; u += 0.42) {
      var p = Ed.at(st.s0 + u);
      c.beginPath(); c.moveTo(p[0] + st.nx * 0.45 + lh[0], p[1] + st.ny * 0.45 + lh[1]); c.lineTo(p[0] + st.nx * 1.32 + lh[0], p[1] + st.ny * 1.32 + lh[1]); c.stroke();
    }
    var edge = platformCorners(st, 0.48, 0.6).map(function (q) { return [q[0] + lh[0], q[1] + lh[1]]; });
    c.beginPath(); edge.forEach(function (q, i) { if (i) c.lineTo(q[0], q[1]); else c.moveTo(q[0], q[1]); }); c.closePath(); c.fillStyle = '#FFD45C'; c.fill();
    void top; void d0;
    c.restore();
  }
  // the station house footprint (axis-aligned): behind the platform, in the middle
  function stationHouse(st) {
    var Ed = S.w.map.edges[st.edge], L = st.s1 - st.s0, hl = Math.min(3.0, L * 0.72), mid = (st.s0 + st.s1) / 2;
    var a = Ed.at(mid - hl / 2), b = Ed.at(mid + hl / 2), v0 = 1.36, v1 = 2.0;
    var xs = [a[0] + st.nx * v0, a[0] + st.nx * v1, b[0] + st.nx * v0, b[0] + st.nx * v1], ys = [a[1] + st.ny * v0, a[1] + st.ny * v1, b[1] + st.ny * v0, b[1] + st.ny * v1];
    return [Math.min.apply(null, xs), Math.min.apply(null, ys), Math.max.apply(null, xs), Math.max.apply(null, ys)];
  }
  function drawStationHouse(c, st, hb, k) {
    var sh = STATION_SHADE[st.color], Ed = S.w.map.edges[st.edge];
    world(c);
    building(c, hb[0], hb[1], hb[2], hb[3], 0.7, { k: k, wall: '#F3EEE3', kind: 'hip', roof: sh, window: '#9CC9D3', floors: 1, door: true });
    // lamp posts at both ends of the platform
    [st.s0 + 0.25, st.s1 - 0.25].forEach(function (s2) {
      var p = Ed.at(s2), lx = p[0] + st.nx * 1.2, ly = p[1] + st.ny * 1.2, lh = lift(0.12);
      var top = cylinder(c, lx + lh[0], ly + lh[1], 0.045, 0.75, { k: k, side: '#3D4A66', shadow: true, lw: 1 });
      c.beginPath(); c.arc(top[0], top[1], 0.2, 0, Math.PI * 2); c.fillStyle = 'rgba(255,230,140,.35)'; c.fill();
      c.beginPath(); c.arc(top[0], top[1], 0.09, 0, Math.PI * 2); c.fillStyle = '#FFF3B0'; c.fill(); c.strokeStyle = INK; c.lineWidth = 1.2 / k; c.stroke();
    });
    c.restore();
  }
  // the name board, upright and readable, over the station house roof
  function stationBoard(c, st, k) {
    var col = COL[st.color], Ed = S.w.map.edges[st.edge];
    var mid = Ed.at((st.s0 + st.s1) / 2), Lr = lift(0.95), sx = X(mid[0] + st.nx * 1.68 + Lr[0]), sy = Y(mid[1] + st.ny * 1.68 + Lr[1]);
    var label = col.name.toUpperCase(), fs = Math.max(10, Math.min(18, 0.46 * k));
    c.font = fs + 'px Staatliches, "Arial Narrow", sans-serif';
    var tw = c.measureText(label).width + fs * 1.7, th = fs * 1.45;
    rr(c, sx - tw / 2 + 2, sy - th / 2 + 2, tw, th, 5); c.fillStyle = INK; c.fill();
    rr(c, sx - tw / 2, sy - th / 2, tw, th, 5); c.fillStyle = '#fff'; c.fill();
    c.save(); rr(c, sx - tw / 2, sy - th / 2, tw, th, 5); c.clip(); c.fillStyle = col.hex; c.fillRect(sx - tw / 2, sy + th / 2 - 4, tw, 4); c.restore();
    rr(c, sx - tw / 2, sy - th / 2, tw, th, 5); c.strokeStyle = INK; c.lineWidth = 2; c.stroke();
    shape(c, col, sx - tw / 2 + fs * 0.72, sy - 1, fs * 0.42);
    c.fillStyle = INK; c.textAlign = 'left'; c.textBaseline = 'middle';
    c.fillText(label, sx - tw / 2 + fs * 1.32, sy);
  }

  function shape(c, col, x, y, r) {
    c.fillStyle = col.hex; c.strokeStyle = INK; c.lineWidth = 1.5;
    c.beginPath();
    if (col.shape === 'circle') c.arc(x, y, r, 0, Math.PI * 2);
    else if (col.shape === 'square') c.rect(x - r * 0.85, y - r * 0.85, r * 1.7, r * 1.7);
    else if (col.shape === 'triangle') { c.moveTo(x, y - r); c.lineTo(x + r, y + r * 0.8); c.lineTo(x - r, y + r * 0.8); c.closePath(); }
    else { for (var i = 0; i < 10; i++) { var a = -Math.PI / 2 + i * Math.PI / 5, rad = i % 2 ? r * 0.45 : r * 1.05; if (i) c.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad); else c.moveTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad); } c.closePath(); }
    c.fill(); c.stroke();
  }

  function keyBadge(c, x, y, key, k, on) {
    if (!key || k < 14) return;
    var s = Math.max(14, 0.48 * k);
    rr(c, x - s / 2, y - s / 2, s, s, 4);
    c.fillStyle = on ? '#FFD45C' : '#fff'; c.fill(); c.strokeStyle = INK; c.lineWidth = 1.8; c.stroke();
    c.fillStyle = INK; c.font = 'bold ' + Math.round(s * 0.62) + 'px "Atkinson Hyperlegible", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(key, x, y + 1);
  }

  // ---------- drawing every frame ----------

  function drawSwitches(c, k, now) {
    var w = S.w, m = w.map;
    m.nodes.forEach(function (n) {
      if (n.type !== 'switch') return;
      // light up the way the switch is set
      n.outs.forEach(function (eid, i) {
        var Ed = m.edges[eid], on = i === n.state;
        trackPath(c, Ed, 0, 0, 1.9);
        c.strokeStyle = on ? '#FFD45C' : 'rgba(29,26,51,.35)'; c.lineWidth = (on ? 0.22 : 0.12) * k; c.stroke();
      });
      var hov = S.hover && S.hover.kind === 'switch' && S.hover.id === n.id;
      var ch = m.edges[n.outs[1]].at(1.2), mid = m.edges[n.outs[0]].at(1.2);
      // the button sits on the far side from the shortcut
      var bx = n.x - (ch[0] - mid[0]) * 0.75, by = n.y - (ch[1] - mid[1]) * 0.75;
      c.beginPath(); c.arc(X(bx), Y(by), 0.36 * k + (hov ? 2 : 0), 0, Math.PI * 2);
      c.fillStyle = hov ? '#FFE9A3' : '#FFD45C'; c.fill(); c.strokeStyle = INK; c.lineWidth = 2; c.stroke();
      // an arrow showing where trains go next
      var tgt = m.edges[n.outs[n.state]].at(1.4), ang = Math.atan2(tgt[1] - n.y, tgt[0] - n.x);
      c.save(); c.translate(X(bx), Y(by)); c.rotate(ang);
      c.strokeStyle = INK; c.lineWidth = Math.max(2, 0.08 * k); c.lineCap = 'round';
      c.beginPath(); c.moveTo(-0.18 * k, 0); c.lineTo(0.18 * k, 0); c.moveTo(0.06 * k, -0.12 * k); c.lineTo(0.18 * k, 0); c.lineTo(0.06 * k, 0.12 * k); c.stroke();
      c.restore();
      keyBadge(c, X(bx) + 0.5 * k, Y(by) - 0.5 * k, n.key, k);
    });
  }

  function crossingGeom(cr) {
    var r = S.w.map.roads[cr.road];
    // road direction and the track direction across it
    return r.horizontal ? { rd: [1, 0], td: [0, 1] } : { rd: [0, 1], td: [1, 0] };
  }

  function drawCrossings(c, k, now) {
    var w = S.w, m = w.map;
    m.crossings.forEach(function (cr) {
      var g = crossingGeom(cr), hw = 0.66, blink = Math.floor(now / 380) % 2;
      // barrier arms on both sides, one per lane, hinged at the road edge
      [-1, 1].forEach(function (sd) {
        var px = cr.x + g.rd[0] * sd * 1.05 + g.td[0] * sd * (hw + 0.12), py = cr.y + g.rd[1] * sd * 1.05 + g.td[1] * sd * (hw + 0.12);
        var down = cr.arm, len = 0.95 * hw * 2 * 0.62;
        // up: the arm points along the road (seen from above it is short); down: across the lane
        var ax = -g.td[0] * sd, ay = -g.td[1] * sd, ux = g.rd[0] * sd, uy = g.rd[1] * sd;
        var dx = ux + (ax - ux) * down, dy = uy + (ay - uy) * down, dl = Math.hypot(dx, dy) || 1;
        // up, the arm stands tall (drawn short and high); down, it lies across the lane at post height
        var vis = len * (0.3 + 0.7 * down), ph = 0.55, armH = ph + (1 - down) * 0.5;
        world(c);
        var top = cylinder(c, px, py, 0.09, ph + 0.2, { k: k, side: '#E8ECF4', top: '#5E6372', bands: [[0.3, 0.45, '#E5483A'], [0.6, 0.75, '#E5483A']] });
        var la = lift(armH), lb = lift(ph);
        var hx = px + lb[0], hy = py + lb[1], ex = px + dx / dl * vis + la[0], ey = py + dy / dl * vis + la[1];
        c.lineCap = 'round';
        c.strokeStyle = 'rgba(29,26,51,.25)'; c.lineWidth = 0.12; c.beginPath(); c.moveTo(px + 0.25, py + 0.18); c.lineTo(px + dx / dl * vis + 0.25 + armH * 0.4, py + dy / dl * vis + 0.18 + armH * 0.3); c.stroke();
        c.strokeStyle = INK; c.lineWidth = 0.2; c.beginPath(); c.moveTo(hx, hy); c.lineTo(ex, ey); c.stroke();
        c.strokeStyle = '#fff'; c.lineWidth = 0.13; c.stroke();
        c.strokeStyle = '#E5483A'; c.setLineDash([0.14, 0.14]); c.stroke(); c.setLineDash([]);
        // two lamps on top of the post, flashing in turn
        var on = cr.arm > 0.02 || cr.down;
        [-1, 1].forEach(function (lmp) {
          var lx = top[0] + g.rd[0] * lmp * 0.1, ly = top[1] + g.rd[1] * lmp * 0.1;
          c.beginPath(); c.arc(lx, ly, 0.07, 0, Math.PI * 2);
          c.fillStyle = on ? (((blink ^ (lmp > 0)) ^ (sd > 0)) ? '#FF3B30' : '#5A1E1E') : '#3A3D48'; c.fill(); c.strokeStyle = INK; c.lineWidth = 1 / k; c.stroke();
          if (on && ((blink ^ (lmp > 0)) ^ (sd > 0))) { c.beginPath(); c.arc(lx, ly, 0.2, 0, Math.PI * 2); c.fillStyle = 'rgba(255,59,48,.25)'; c.fill(); }
        });
        c.restore();
      });
      var hov = S.hover && S.hover.kind === 'crossing' && S.hover.id === cr.id;
      var bx = cr.x - g.rd[0] * 1.55 + g.td[0] * 1.15, by = cr.y - g.rd[1] * 1.55 + g.td[1] * 1.15;
      // the button: a little barrier sign
      c.beginPath(); c.arc(X(bx), Y(by), 0.34 * k + (hov ? 2 : 0), 0, Math.PI * 2);
      c.fillStyle = cr.down ? '#E5483A' : '#fff'; c.fill(); c.strokeStyle = INK; c.lineWidth = 2; c.stroke();
      // a little barrier arm on the button: raised or lowered
      var ang = -1.0 * (1 - cr.arm), pvx = X(bx) - 0.2 * k, pvy = Y(by) + 0.08 * k, al = 0.42 * k;
      c.lineCap = 'butt';
      c.strokeStyle = INK; c.lineWidth = Math.max(4, 0.13 * k);
      c.beginPath(); c.moveTo(pvx, pvy); c.lineTo(pvx + Math.cos(ang) * al, pvy + Math.sin(ang) * al); c.stroke();
      c.strokeStyle = cr.down ? '#fff' : '#E5483A'; c.lineWidth = Math.max(2, 0.08 * k); c.stroke();
      c.lineCap = 'round';
      c.beginPath(); c.arc(pvx, pvy, Math.max(2, 0.06 * k), 0, Math.PI * 2); c.fillStyle = INK; c.fill();
      keyBadge(c, X(bx) - 0.48 * k, Y(by) - 0.48 * k, cr.key, k);
      // a traffic jam warning
      if (cr.waitT > cfg().car.patience * 0.45) {
        var q = Math.min(1, cr.waitT / cfg().car.patience);
        c.fillStyle = q > 0.75 ? '#E5483A' : '#FF9F1C';
        c.font = 'bold ' + Math.round(0.55 * k) + 'px "Atkinson Hyperlegible", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
        c.lineWidth = 3; c.strokeStyle = INK; c.strokeText('!', X(bx) + 0.6 * k, Y(by) + 0.5 * k); c.fillText('!', X(bx) + 0.6 * k, Y(by) + 0.5 * k);
      }
    });
  }

  function drawSignals(c, k, now) {
    var w = S.w;
    if (!cfg().freight) return;
    w.map.stations.forEach(function (st) {
      var Ed = w.map.edges[st.edge], p = Ed.at(st.sig), hx = p[0] - st.nx * 0.85, hy = p[1] - st.ny * 0.85;
      var hov = S.hover && S.hover.kind === 'signal' && S.hover.id === st.id;
      world(c);
      var mt = cylinder(c, hx, hy, 0.06, 0.95, { k: k, side: '#5E6372', lw: 1.2 });
      var head = prism(c, rectPts(mt[0], mt[1], 0.46, 0.46, 0), 0.12, { k: k, top: INK, wall: '#3A3D48', shadow: false });
      var hc = [(head[0][0] + head[2][0]) / 2, (head[0][1] + head[2][1]) / 2];
      if (hov) { c.beginPath(); c.arc(hc[0], hc[1], 0.34, 0, Math.PI * 2); c.strokeStyle = '#FFD45C'; c.lineWidth = 3 / k; c.stroke(); }
      c.beginPath(); c.arc(hc[0], hc[1], 0.15, 0, Math.PI * 2); c.fillStyle = st.red ? '#FF3B30' : '#3BE37A'; c.fill();
      c.beginPath(); c.arc(hc[0], hc[1], 0.32, 0, Math.PI * 2); c.fillStyle = st.red ? 'rgba(255,59,48,.25)' : 'rgba(59,227,122,.22)'; c.fill();
      c.restore();
      keyBadge(c, X(hc[0]) - st.nx * 0.62 * k, Y(hc[1]) - st.ny * 0.62 * k, st.key, k);
    });
  }

  function drawPeople(c, k, now) {
    var w = S.w, m = w.map;
    m.stations.forEach(function (st) {
      var Ed = m.edges[st.edge], n = st.waiting.length, per = Math.max(1, Math.floor((st.s1 - st.s0 - 0.4) / 0.46)), shown = Math.min(n, per * 2);
      for (var i = 0; i < shown; i++) {
        var p = st.waiting[i], row = Math.floor(i / per), col = i % per;
        var at = Ed.at(st.s0 + 0.32 + col * 0.46), off = 0.8 + row * 0.3;
        var left = 1 - (w.t - p.born) / p.patience, lp = lift(0.12);
        var wob = left < 0.2 ? Math.sin(now / 70 + p.id) * 0.04 : 0;
        world(c);
        person3d(c, at[0] + st.nx * off + lp[0] + wob, at[1] + st.ny * off + lp[1], COL[p.color].hex, SKIN[p.look], k, { ring: left > 0.5 ? '#2FBF71' : left > 0.2 ? '#FF9F1C' : '#E5483A' });
        c.restore();
      }
      if (n > shown) {
        var e = Ed.at(st.s1 - 0.1);
        c.font = 'bold ' + Math.round(Math.max(10, 0.38 * k)) + 'px "Atkinson Hyperlegible", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
        c.lineWidth = 3; c.strokeStyle = '#fff'; c.strokeText('+' + (n - shown), X(e[0] + st.nx * 1.45), Y(e[1] + st.ny * 1.45));
        c.fillStyle = INK; c.fillText('+' + (n - shown), X(e[0] + st.nx * 1.45), Y(e[1] + st.ny * 1.45));
      }
    });
  }

  function drawTrains(c, k, now) {
    var w = S.w;
    w.trains.forEach(function (t) {
      var cars = w.carsOf(t), sp = t.spec, mine = t.kind === 'you', hov = S.hover && S.hover.kind === 'train' && S.hover.id === t.id;
      world(c);
      var last = cars.length - 1, col = TRAIN_COL[t.id] || TRAIN_COL[0];
      for (var i = last; i >= 0; i--) {
        var p = cars[i], len = sp.car * 0.97, wid = 0.6, a = p[2];
        var front = i === 0, back = mine && i === last, nose = mine ? 0.55 : 0.3;
        var outline = bulletPts(p[0], p[1], a, len, wid, front ? nose : 0, back ? nose * 0.8 : 0);
        var body = mine ? '#F7F9FC' : (i === 0 ? '#E8577E' : '#4A4560');
        prism(c, outline, mine ? 0.3 : 0.38, { k: k, top: body, wall: body, ink: hov ? '#FFD45C' : INK, lw: hov ? 3 : 1.8 });
        c.save(); c.translate(p[0], p[1]); c.rotate(a);
        var x0 = -len / 2 + (back ? len * nose * 0.8 : 0.06), x1 = len / 2 - (front ? len * nose : 0.06);
        if (mine) {
          // the livery: a stripe down the middle that sweeps into the nose, and window bands down both sides
          c.fillStyle = col;
          c.beginPath(); c.moveTo(x0 - (back ? len * 0.2 : 0), -wid * 0.08); c.lineTo(x1, -wid * 0.08);
          if (front) { c.lineTo(len / 2 - 0.02, 0); } c.lineTo(x1, wid * 0.08); c.lineTo(x0 - (back ? len * 0.2 : 0), wid * 0.08); if (back) c.lineTo(-len / 2 + 0.02, 0); c.closePath(); c.fill();
          [-1, 1].forEach(function (sd) {
            rr(c, x0, sd * wid * 0.33 - wid * 0.07, x1 - x0, wid * 0.14, wid * 0.07); c.fillStyle = '#2B3A55'; c.fill();
          });
          // riders at the windows
          var start2 = (last - i) * 6, span = x1 - x0;
          for (var j = 0; j < 6; j++) {
            var rd = t.riders[start2 + j];
            if (!rd) continue;
            c.beginPath(); c.arc(x0 + span * (0.18 + (j % 3) * 0.32), (j < 3 ? -1 : 1) * wid * 0.33, 0.055, 0, Math.PI * 2);
            c.fillStyle = COL[rd.color].hex; c.fill();
          }
          // a pantograph on the middle car
          if (i === 1) { c.strokeStyle = INK; c.lineWidth = 1.6 / k; c.beginPath(); c.moveTo(-0.18, -0.1); c.lineTo(0, 0.1); c.lineTo(0.18, -0.1); c.moveTo(-0.22, 0.1); c.lineTo(0.22, 0.1); c.stroke(); }
          // the gangway to the next car
          if (i > 0) { c.fillStyle = '#3A3D48'; c.fillRect(len / 2 - 0.02, -wid * 0.28, sp.gap + 0.06, wid * 0.56); }
        } else if (i > 0) {
          c.restore();
          var cc = ['#C8553D', '#2E86AB', '#F6AE2D', '#86BA90'][(i + t.id) % 4];
          prism(c, rectPts(p[0], p[1], len * 0.86, wid * 0.82, a), 0.62, { k: k, top: cc, wall: cc, lw: 1.4 });
          c.save(); c.translate(p[0], p[1]); c.rotate(a);
          c.strokeStyle = 'rgba(29,26,51,.3)'; c.lineWidth = 1 / k;
          for (var q = 1; q < 5; q++) { var qx = -len * 0.43 + len * 0.86 * q / 5; c.beginPath(); c.moveTo(qx, -wid * 0.41); c.lineTo(qx, wid * 0.41); c.stroke(); }
        }
        if (front) {
          // the cockpit window wrapped round the nose, and the head lamps
          var n0 = len / 2 - len * nose * 0.62, n1 = len / 2 - len * nose * 0.22;
          c.beginPath();
          c.moveTo(n0, -noseHalf(n0, len, wid, nose) * 0.78); c.quadraticCurveTo((n0 + n1) / 2 + 0.05, 0, n0, noseHalf(n0, len, wid, nose) * 0.78);
          c.lineTo(n1, noseHalf(n1, len, wid, nose) * 0.6); c.quadraticCurveTo(n1 + 0.04, 0, n1, -noseHalf(n1, len, wid, nose) * 0.6); c.closePath();
          c.fillStyle = mine ? '#2B3A55' : '#5A2236'; c.fill();
          [-1, 1].forEach(function (sd) { c.beginPath(); c.arc(len / 2 - len * nose * 0.12, sd * noseHalf(len / 2 - len * nose * 0.12, len, wid, nose) * 0.55, 0.04, 0, Math.PI * 2); c.fillStyle = '#FFF3B0'; c.fill(); });
          if (!mine) { c.beginPath(); c.arc(-len * 0.15, -wid * 0.42, wid * 0.2, 0, Math.PI * 2); c.fillStyle = '#E8577E'; c.fill(); c.strokeStyle = INK; c.lineWidth = 1.2 / k; c.stroke(); }
        }
        if (back) [-1, 1].forEach(function (sd) { c.beginPath(); c.arc(-len / 2 + len * nose * 0.1, sd * wid * 0.12, 0.035, 0, Math.PI * 2); c.fillStyle = '#FF3B30'; c.fill(); });
        c.restore();
      }
      c.restore();
      var head = cars[0];
      if (mine) {
        // where it will stop if it is braking
        if (t.want === 'stop' && t.v > 0.05) drawStopMark(c, t, k);
        var go = t.want === 'go', tag = go ? 'GO' : t.v > 0.05 ? 'BRAKE' : t.doors ? 'DOORS' : 'STOP';
        var bx = X(head[0]) + 0.75 * k * Math.cos(head[2] - Math.PI / 2), by = Y(head[1]) + 0.75 * k * Math.sin(head[2] - Math.PI / 2);
        c.font = Math.round(Math.max(11, 0.4 * k)) + 'px Staatliches, "Arial Narrow", sans-serif';
        var tw = c.measureText(tag).width + 10, th = Math.max(14, 0.48 * k);
        rr(c, bx - tw / 2, by - th / 2, tw, th, 4);
        c.fillStyle = go ? '#2FBF71' : t.doors ? '#3D86F0' : '#E5483A'; c.fill(); c.strokeStyle = INK; c.lineWidth = 1.8; c.stroke();
        c.fillStyle = '#fff'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(tag, bx, by + 1);
        keyBadge(c, bx + tw / 2 + 0.32 * k, by, t.key, k, S.sel === t.id && w.trains.filter(function (o) { return o.kind === 'you'; }).length > 1);
      } else if (t.holdT > 0.5) {
        var hx = X(head[0]), hy = Y(head[1]) - 0.8 * k, q = Math.min(1, t.holdT / cfg().hold);
        c.beginPath(); c.arc(hx, hy, 0.3 * k, -Math.PI / 2, -Math.PI / 2 + q * Math.PI * 2); c.lineTo(hx, hy); c.closePath();
        c.fillStyle = q > 0.7 ? '#E5483A' : '#FF9F1C'; c.fill();
        c.beginPath(); c.arc(hx, hy, 0.3 * k, 0, Math.PI * 2); c.strokeStyle = INK; c.lineWidth = 2; c.stroke();
      }
    });
  }

  // a high-speed train car seen from above: straight sides, and a long tapering nose at a driving end
  function noseHalf(x, len, wid, nose) {
    var nl = len * nose, xs = len / 2 - nl;
    if (x <= xs) return wid / 2;
    var t2 = Math.min(1, (x - xs) / nl);
    return wid / 2 * Math.pow(1 - Math.pow(t2, 1.7), 0.55);
  }
  function bulletPts(cx, cy, a, len, wid, noseF, noseB) {
    var loc = [], n = 9, i;
    function half(x) {
      var hw = wid / 2;
      if (noseF) hw = Math.min(hw, noseHalf(x, len, wid, noseF));
      if (noseB) hw = Math.min(hw, noseHalf(-x, len, wid, noseB));
      return Math.max(0.015, hw);
    }
    var xb = -len / 2 + (noseB ? len * noseB : 0), xf = len / 2 - (noseF ? len * noseF : 0);
    var xs = [];
    if (noseB) for (i = 0; i <= n; i++) xs.push(-len / 2 + (xb + len / 2) * i / n); else xs.push(-len / 2);
    xs.push(xb, xf);
    if (noseF) for (i = 0; i <= n; i++) xs.push(xf + (len / 2 - xf) * i / n); else xs.push(len / 2);
    xs.forEach(function (x) { loc.push([x, -half(x)]); });
    for (i = xs.length - 1; i >= 0; i--) loc.push([xs[i], half(xs[i])]);
    var co = Math.cos(a), si = Math.sin(a);
    return loc.map(function (q) { return [cx + co * q[0] - si * q[1], cy + si * q[0] + co * q[1]]; });
  }

  function pointAhead(t, d) {
    var res = null;
    S.w.ahead(t.e, t.s, d + 1e-6, function (Ed, a, b, off) { if (off + (b - a) >= d - 1e-6) { res = [Ed, Math.min(Ed.len, a + d - off)]; return true; } });
    return res;
  }
  function drawStopMark(c, t, k) {
    var w = S.w, pa = pointAhead(t, w.brakeDist(t));
    if (!pa) return;
    var Ed = pa[0], s = pa[1], p = Ed.at(s), good = w.map.stations.some(function (st) { return st.edge === Ed.id && s >= st.s0 + 1.7 && s <= st.s1 + 1.3; });
    var nx = -Math.sin(p[2]), ny = Math.cos(p[2]);
    c.strokeStyle = good ? '#2FBF71' : '#fff'; c.lineWidth = Math.max(3, 0.12 * k); c.setLineDash([4, 3]);
    c.beginPath(); c.moveTo(X(p[0] + nx * 0.55), Y(p[1] + ny * 0.55)); c.lineTo(X(p[0] - nx * 0.55), Y(p[1] - ny * 0.55)); c.stroke();
    c.setLineDash([]);
  }

  function drawCars(c, k) {
    var w = S.w;
    w.cars.forEach(function (car) {
      var road = w.map.roads[car.road], pos = w.carPos(car), ang = road.horizontal ? (car.dir > 0 ? 0 : Math.PI) : (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
      var edge = Math.min(car.p, road.len - car.p);
      world(c); c.globalAlpha = Math.max(0, Math.min(1, edge / 1.5));
      car3d(c, pos[0], pos[1], ang, E.CAR.len, 0.46, CAR_COL[car.look], k, { brake: car.v < 0.3 });
      c.restore();
    });
    c.globalAlpha = 1;
  }

  function drawPops(c, now) {
    S.pops = S.pops.filter(function (p) { return now - p.t < 1200; });
    S.pops.forEach(function (p) {
      var q = (now - p.t) / 1200;
      c.globalAlpha = 1 - q;
      c.font = (p.size || 20) + 'px Staatliches, "Arial Narrow", sans-serif';
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.lineWidth = 4; c.strokeStyle = INK; c.strokeText(p.text, X(p.x), Y(p.y) - q * 30);
      c.fillStyle = p.color; c.fillText(p.text, X(p.x), Y(p.y) - q * 30);
      c.globalAlpha = 1;
    });
  }

  function drawCrash(c, k, now) {
    var w = S.w;
    if (!w.crash) return;
    var x = X(w.crash.x), y = Y(w.crash.y), q = Math.min(1, (now - S.crashAt) / 500);
    c.save(); c.translate(x, y); c.rotate(now / 900);
    c.beginPath();
    for (var i = 0; i < 16; i++) { var a = i * Math.PI / 8, r = (i % 2 ? 0.7 : 1.5) * k * (0.4 + 0.6 * q); if (i) c.lineTo(Math.cos(a) * r, Math.sin(a) * r); else c.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
    c.closePath(); c.fillStyle = '#FFD45C'; c.fill(); c.strokeStyle = INK; c.lineWidth = 3; c.stroke();
    c.rotate(-now / 900);
    c.font = Math.round(0.8 * k) + 'px Staatliches, "Arial Narrow", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillStyle = '#E5483A'; c.fillText('CRASH!', 0, 2);
    c.restore();
  }

  function draw(now) {
    if (!S.w || !S.fit) return;
    var dpr = window.devicePixelRatio || 1, k = S.view.k;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(stat, 0, 0);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawSwitches(ctx, k, now);
    drawCars(ctx, k);
    drawTrains(ctx, k, now);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(high, 0, 0);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawCrossings(ctx, k, now);
    drawSignals(ctx, k, now);
    drawPeople(ctx, k, now);
    drawPops(ctx, now);
    drawCrash(ctx, k, now);
  }

  // ---------- panel ----------

  function strikeIcon() {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v10H10l-5 4v-4H4z" fill="none" stroke="' + INK + '" stroke-width="2.4" stroke-linejoin="round"/><path d="M12 7.5v4M12 13.2v.4" stroke="' + INK + '" stroke-width="2.4" stroke-linecap="round"/></svg>';
  }

  function buildPanel() {
    var w = S.w, Lv = L(), T = TALK[S.level];
    $('#bot-name').textContent = Lv.name;
    $('#bot-rank').textContent = T.rank;
    $('#strikes').innerHTML = Array.apply(null, Array(E.STRIKES)).map(function () { return '<span class="strike">' + strikeIcon() + '</span>'; }).join('');
    var trains = $('#trains');
    trains.innerHTML = '';
    w.trains.forEach(function (t) {
      if (t.kind !== 'you') return;
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'train-btn';
      b.dataset.train = t.id;
      b.innerHTML = '<i style="background:' + TRAIN_COL[t.id] + '"></i><span class="tb-name">Train ' + (t.id + 1) + ' <kbd>' + t.key + '</kbd></span><span class="tb-state"></span><span class="tb-load"></span>';
      trains.appendChild(b);
    });
    var best = A.progress(GAME)[S.level];
    $('#best').textContent = best ? 'Your best against ' + Lv.name + ': ' + best.text + '.' : 'No shift against ' + Lv.name + ' yet. Stars at ' + E.STARS.join(', ') + ' passengers.';
    S.text = {};
  }

  function renderHud() {
    var w = S.w;
    setText('#delivered', String(w.delivered));
    setText('#time', mmss(w.t));
    setHtml('#by-color', w.colors.map(function (c) { return '<span class="bc">' + chip(c) + '<b>' + (w.byColor[c] || 0) + '</b></span>'; }).join(''));
    var used = $('#strikes').children;
    for (var i = 0; i < used.length; i++) used[i].classList.toggle('used', i < w.strikes);
    var m = w.mission;
    setHtml('#mission', '<span class="mission-head">Mission ' + m.n + '</span>' + Object.keys(m.need).map(function (c) {
      var got = m.got[c], need = m.need[c];
      return '<div class="mrow' + (got >= need ? ' done' : '') + '">' + chip(c) + '<span>' + COL[c].name + ' shirts to ' + COL[c].name + '</span><b>' + got + '/' + need + '</b><i style="width:' + Math.round(100 * got / need) + '%"></i></div>';
    }).join(''));
    Array.prototype.forEach.call(document.querySelectorAll('.train-btn'), function (b) {
      var t = w.trains[Number(b.dataset.train)];
      var st = t.want === 'go' ? (t.v < 0.05 ? 'Waiting at a red light' : 'Going') : t.v > 0.05 ? 'Braking' : t.doors ? 'Doors open at ' + COL[w.map.stations[t.station].color].name : 'Stopped';
      var stEl = b.querySelector('.tb-state'), ld = b.querySelector('.tb-load');
      if (stEl.textContent !== st) stEl.textContent = st;
      var load = t.riders.length + '/' + t.cap;
      if (ld.textContent !== load) ld.textContent = load;
      b.classList.toggle('go', t.want === 'go');
      b.classList.toggle('sel', S.sel === t.id && w.trains.filter(function (o) { return o.kind === 'you'; }).length > 1);
    });
    A.music.intensity(Math.min(0.95, 0.35 + w.waiting() / 30 + w.strikes * 0.08));
  }

  // ---------- playing ----------

  function newMap() {
    A.closeModal(true);
    var f = fitRect();
    S.fit = f;
    S.w = new E.World(S.level, (Math.random() * 1e9) >>> 0, Math.max(0.4, (f.x1 - f.x0) / Math.max(1, f.y1 - f.y0)));
    S.running = false;
    S.paused = false;
    S.endShown = false;
    S.pops = [];
    S.sel = 0;
    S.horned = {};
    S.clack = {};
    $('#start-card').hidden = false;
    $('#veil').hidden = true;
    $('#banner').hidden = true;
    buildPanel();
    renderHud();
    say(pick(TALK[S.level].start), 'smug');
    A.music.intensity(0.35);
    layout();
  }

  function start() {
    if (A.modalOpen()) return;
    if (S.w.over) { newMap(); return; }
    if (S.running) return;
    S.running = true;
    S.lastFrame = 0;
    $('#start-card').hidden = true;
    banner('The line is open. Mind the gap!', false, 1800);
    horn(false);
  }
  function live() { return S.w && !S.w.over && !A.isBoss() && !A.modalOpen() && !S.paused; }
  function act() {
    if (!live()) return false;
    if (!S.running) start();
    return true;
  }

  function trainCmd(i) {
    if (!act()) return;
    var t = S.w.trains[i];
    if (!t || t.kind !== 'you') return;
    S.sel = i;
    S.w.toggleTrain(i);
    flush();
  }
  function switchCmd(id) { if (act()) { S.w.flipSwitch(id); flush(); } }
  function crossingCmd(id) { if (act()) { S.w.toggleBarrier(id); flush(); } }
  function signalCmd(id) { if (act()) { S.w.toggleSignal(id); flush(); } }
  function flush() { S.w.events.forEach(handle); S.w.events.length = 0; renderHud(); }

  function stationPos(k) { var st = S.w.map.stations[k]; return [st.x + st.nx * 1.0, st.y + st.ny * 1.0]; }

  function handle(ev) {
    var w = S.w, T = TALK[S.level], now = performance.now();
    switch (ev.type) {
      case 'depart': sfx('depart'); break;
      case 'brake': sfx('brake'); break;
      case 'doors-open': sfx('doors'); sfx('stop'); break;
      case 'board': sfx('board'); break;
      case 'deliver': {
        sfx('coin');
        var p = stationPos(ev.station);
        S.pops.push({ text: '+10', x: p[0], y: p[1], t: now, color: COL[ev.color].hex });
        break;
      }
      case 'ready': break;
      case 'switch': sfx('switch'); break;
      case 'switch-busy': sfx('busy'); banner('Wait until the train has passed the switch.', true, 1600); break;
      case 'barrier-down': case 'barrier-up': sfx('motor'); S.bellT[ev.crossing] = 0; break;
      case 'signal': sfx('signal'); break;
      case 'pass': {
        var t = w.trains[ev.train];
        sfx('pass', Math.min(1, t.v / 3) * 0.9 + 0.1);
        break;
      }
      case 'honk': sfx('honk'); break;
      case 'freight': {
        horn(true);
        banner('Here comes Edith\'s freight train! Red lights hold it back.', false, 3200);
        say('Edith Express is on the line! Toot toot!', 'smug');
        break;
      }
      case 'mission': {
        A.jingle('good');
        banner('Mission ' + ev.n + ' done!' + (ev.back ? ' One complaint forgiven.' : ''), false, 2600);
        if (Math.random() < 0.7) say(pick(T.mission), 'annoyed');
        break;
      }
      case 'strike': {
        var msg = ev.why === 'gaveup' ? 'A passenger at ' + COL[w.map.stations[ev.station].color].name + ' gave up and walked home!'
          : ev.why === 'jam' ? 'Traffic jam! The drivers complained about crossing ' + w.map.crossings[ev.crossing].key + '.'
            : 'The freight train waited too long at a red light!';
        if (ev.why === 'gaveup') sfx('gaveup'); else if (ev.why === 'jam') sfx('honk');
        A.jingle('bad');
        banner(msg + ' (' + ev.strikes + ' of ' + E.STRIKES + ')', true, 2600);
        say(pick(ev.why === 'gaveup' ? T.gaveup : T.jam), 'happy');
        if (ev.why === 'late') horn(true);
        break;
      }
      case 'end': {
        if (ev.reason === 'crash') {
          S.crashAt = now;
          sfx('crash');
          banner(ev.crash.kind === 'car' ? 'Crash! A car was on the crossing.' : 'Crash! Two trains met.', true, 4000);
          say(pick(T.crash), 'surprised');
        }
        sc.timeout(endGame, ev.reason === 'crash' ? 1600 : 700);
        break;
      }
    }
  }

  // bells, horns and the clatter of the wheels, from what the railway is doing right now
  function ambientSounds(dt) {
    var w = S.w, total = 0;
    if (!soundLive() || !S.running || w.over) { rumble(0); return; }
    w.trains.forEach(function (t) {
      total += t.v / t.spec.vmax;
      var last = S.clack[t.id] == null ? t.odo : S.clack[t.id];
      if (t.odo - last > 1.45) { S.clack[t.id] = t.odo; if (t.v > 0.4) clack(0.4 + 0.6 * t.v / t.spec.vmax); } else if (S.clack[t.id] == null) S.clack[t.id] = t.odo;
      // a horn before an open crossing
      var nx = w.nextCrossingFor(t);
      if (nx && nx.d < 3.2 && t.v > 1 && !w.map.crossings[nx.c].down && S.horned[t.id] !== nx.c) { S.horned[t.id] = nx.c; horn(t.kind === 'freight'); }
    });
    rumble(Math.min(0.09, 0.035 * total));
    w.map.crossings.forEach(function (cr) {
      var moving = cr.arm > 0 && cr.arm < 1, near = cr.down && w.trains.some(function (t) { var n = w.nextCrossingFor(t); return n && n.c === cr.id && n.d < 7; });
      if (!(moving || near)) return;
      S.bellT[cr.id] = (S.bellT[cr.id] || 0) - dt;
      if (S.bellT[cr.id] <= 0) { S.bellT[cr.id] = 0.5; sfx(Math.floor(w.t * 2) % 2 ? 'bell' : 'bell2', 0.7); }
    });
  }

  function frame(now) {
    sc.raf(frame);
    var w = S.w;
    var dt = S.lastFrame ? Math.min(0.1, (now - S.lastFrame) / 1000) : 0;
    S.lastFrame = now;
    if (w && S.running && !w.over && !(S.paused || A.isBoss() || A.modalOpen() || document.hidden)) {
      S.acc += dt;
      while (S.acc >= E.DT && !w.over) {
        w.step();
        w.events.forEach(handle);
        w.events.length = 0;
        S.acc -= E.DT;
      }
      renderHud();
      ambientSounds(dt);
    } else { S.acc = 0; rumble(0); }
    $('#banner').hidden = now > S.bannerUntil;
    $('#btn-pause').textContent = S.paused ? 'Resume (P)' : 'Pause (P)';
    $('#btn-pause').disabled = !S.running || !w || w.over;
    draw(now);
  }

  function endGame() {
    var w = S.w, Lv = L(), T = TALK[S.level];
    if (S.endShown) return;
    S.endShown = true;
    S.running = false;
    rumble(0);
    var stars = w.stars(), d = w.delivered;
    A.account.submit(GAME, S.level, A.points(S.level, w.points()), d + ' passengers in ' + mmss(w.t));
    A.music.intensity(0.35);
    var rec = A.record(GAME, S.level, { stars: stars, score: d, lowerIsBetter: false, text: d + ' passengers' });
    bar.refresh();
    buildPanel();
    renderHud();
    A.jingle(stars ? 'win' : 'lose');
    if (w.reason !== 'crash') say(pick(T.end), stars ? 'annoyed' : 'happy');
    var next = ORDER[ORDER.indexOf(S.level) + 1], buttons = [{ label: 'New map', kind: 'main', onClick: newMap }];
    if (stars && next) buttons.push({ label: 'Next boss: ' + A.LEVEL_MAP[next].name, kind: 'line', onClick: function () { switchTo(next); } });
    var note = rec.better ? (rec.prev ? 'New best against ' + Lv.name + '!' : 'Your first shift against ' + Lv.name + ' is on the books.') : 'Your best: ' + rec.prev.text + '.';
    var why = w.reason === 'crash' ? (w.crash.kind === 'car' ? 'A train hit a car on a crossing.' : 'Two trains crashed.') : 'Five complaints closed the line.';
    var colors = w.colors.map(function (c) { return '<span class="bc">' + chip(c, 16) + ' ' + COL[c].name + ' <b>' + (w.byColor[c] || 0) + '</b></span>'; }).join('');
    A.modal({
      title: stars === 3 ? 'Railway legend!' : stars ? 'End of the line!' : w.reason === 'crash' ? 'Crash!' : 'The line is closed',
      tone: stars ? 'win' : 'lose',
      html: '<p class="lead">You delivered <strong>' + d + ' passengers</strong> and finished <strong>' + w.missionsDone + ' mission' + (w.missionsDone === 1 ? '' : 's') + '</strong> in a shift of ' + mmss(w.t) + '.</p>' +
        '<p class="lc-colors">' + colors + '</p><p>' + why + '</p>' + A.stars(stars) +
        '<p><strong>' + note + '</strong></p>' +
        (stars < 3 ? '<p class="soft">Stars at ' + E.STARS.join(', ') + ' passengers. Tip: lower a barrier just before a train arrives and lift it as soon as the train has gone.</p>' : ''),
      buttons: buttons,
      link: { label: 'Close and look at the map' }
    });
  }

  function switchTo(id) {
    S.level = id;
    bar.setLevel(id);
    newMap();
  }

  function openHelp() {
    var rows = ORDER.map(function (id) {
      var Lv = A.LEVEL_MAP[id], c = E.LEVELS[id];
      return '<div><dt>' + Lv.name + ', ' + Lv.rank.toLowerCase() + '</dt><dd>' + c.stations + ' stations, ' + c.trains + ' train' + (c.trains > 1 ? 's' : '') + ' to drive' + (c.freight ? ', a freight train and red lights' : '') + '. ' + TALK[id].blurb + '</dd></div>';
    }).join('');
    A.modal({
      title: 'How to play',
      wide: true,
      html: '<p>You run a little railway, and every map is brand new. Passengers wear the color of the station they want. Deliver as many as you can before the line closes.</p>' +
        '<ol><li><strong>Trains:</strong> click a train (or press its key) to go, click again to brake. Trains run one way only, following the arrows. A dashed line shows where a braking train will stop: green means it stops at a platform.</li>' +
        '<li><strong>Stations:</strong> stop at a platform and the doors open. Passengers for that color get off, then waiting people get on (' + E.TRAIN.cap + ' per train). Then send the train on.</li>' +
        '<li><strong>Switches:</strong> click the yellow arrow to send trains along the shortcut or around the long way. You cannot flip one while a train is on it.</li>' +
        '<li><strong>Crossings:</strong> click the round sign to lower or raise the barriers. A train that meets a car on a crossing is a crash, and the shift ends at once. Keep a barrier down too long and the drivers complain.</li>' +
        '<li><strong>Red lights</strong> (Edith only): her freight train never stops at stations. Set a red light behind your stopped train to hold it back, but not for too long.</li>' +
        '<li><strong>Complaints:</strong> a passenger who waits too long, a traffic jam, or a freight train held too long. Five end the shift. Finishing a mission takes one away.</li></ol>' +
        '<h3>Traffic bosses</h3><dl>' + rows + '</dl>' +
        '<h3>Keys</h3><table class="keys"><tr><td><kbd>Q</kbd> <kbd>W</kbd> or <kbd>Space</kbd></td><td>Train 1, train 2 (Space: the last train you used): go or brake</td></tr>' +
        '<tr><td><kbd>1</kbd> to <kbd>6</kbd></td><td>Lower or raise a crossing\'s barriers</td></tr><tr><td><kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd></td><td>Flip a switch</td></tr>' +
        '<tr><td><kbd>Z</kbd> <kbd>X</kbd> <kbd>C</kbd> <kbd>V</kbd></td><td>Red or green light at a station (Edith)</td></tr><tr><td><kbd>H</kbd></td><td>Sound the horn</td></tr>' +
        '<tr><td><kbd>F</kbd></td><td>Full screen</td></tr><tr><td><kbd>Enter</kbd></td><td>Start</td></tr><tr><td><kbd>P</kbd></td><td>Pause</td></tr><tr><td><kbd>N</kbd></td><td>New map</td></tr>' +
        '<tr><td><kbd>M</kbd></td><td>Music on or off</td></tr><tr><td><kbd>B</kbd></td><td>Panic button</td></tr></table>',
      buttons: [{ label: 'All aboard!', kind: 'main' }]
    });
  }

  var bar = A.mountBar({
    el: $('#bar'),
    game: GAME,
    title: 'Level Crossing',
    tagline: 'Drive the trains, mind the barriers, get everyone home.',
    level: S.level,
    levelLabel: 'Boss',
    canSwitch: function () { return S.running && !S.w.over ? 'This shift will be abandoned.' : true; },
    onLevel: function (id) { S.level = id; newMap(); },
    onHelp: openHelp
  });
  sc.add(bar.destroy);

  // ---------- pointer ----------

  function toMap(e) {
    var r = cvs.getBoundingClientRect();
    return [((e.clientX - r.left) - S.view.ox) / S.view.k, ((e.clientY - r.top) - S.view.oy) / S.view.k];
  }
  function hitTest(x, y) {
    var w = S.w, best = null, bd = 1e9;
    function consider(kind, id, d, lim) { if (d < lim && d < bd) { bd = d; best = { kind: kind, id: id }; } }
    w.trains.forEach(function (t) { if (t.kind === 'you') w.carsOf(t).forEach(function (c) { consider('train', t.id, Math.hypot(c[0] - x, c[1] - y) * 0.8, 0.75); }); });
    w.map.nodes.forEach(function (n) {
      if (n.type !== 'switch') return;
      var ch = w.map.edges[n.outs[1]].at(1.2), mid = w.map.edges[n.outs[0]].at(1.2), bx = n.x - (ch[0] - mid[0]) * 0.75, by = n.y - (ch[1] - mid[1]) * 0.75;
      consider('switch', n.id, Math.min(Math.hypot(bx - x, by - y), Math.hypot(n.x - x, n.y - y) + 0.3), 0.85);
    });
    w.map.crossings.forEach(function (cr) {
      var g = crossingGeom(cr), bx = cr.x - g.rd[0] * 1.55 + g.td[0] * 1.15, by = cr.y - g.rd[1] * 1.55 + g.td[1] * 1.15;
      consider('crossing', cr.id, Math.min(Math.hypot(bx - x, by - y), Math.hypot(cr.x - x, cr.y - y) + 0.15), 0.95);
    });
    if (cfg().freight) w.map.stations.forEach(function (st) {
      var p = w.map.edges[st.edge].at(st.sig);
      consider('signal', st.id, Math.hypot(p[0] - st.nx * 0.85 - x, p[1] - st.ny * 0.85 - y), 0.7);
    });
    return best;
  }
  cvs.addEventListener('pointerdown', function (e) {
    if (!S.w || A.isBoss()) return;
    var p = toMap(e), h = hitTest(p[0], p[1]);
    if (!h) return;
    e.preventDefault();
    if (h.kind === 'train') trainCmd(h.id);
    else if (h.kind === 'switch') switchCmd(h.id);
    else if (h.kind === 'crossing') crossingCmd(h.id);
    else if (h.kind === 'signal') signalCmd(h.id);
  });
  cvs.addEventListener('pointermove', function (e) {
    if (!S.w || e.pointerType === 'touch') return;
    var p = toMap(e), h = hitTest(p[0], p[1]);
    S.hover = h;
    cvs.style.cursor = h ? 'pointer' : 'default';
  });
  cvs.addEventListener('pointerleave', function () { S.hover = null; });

  $('#trains').addEventListener('click', function (e) {
    var b = e.target.closest('.train-btn');
    if (b) trainCmd(Number(b.dataset.train));
  });
  $('#btn-start').addEventListener('click', start);
  $('#btn-pause').addEventListener('click', function () {
    if (!(S.running && !S.w.over)) return;
    S.paused = !S.paused;
    $('#veil').hidden = !S.paused;
  });
  $('#btn-new').addEventListener('click', function () {
    if (!(S.running && !S.w.over)) return newMap();
    A.confirm({ title: 'New map?', text: 'This shift will be abandoned and a brand new railway is drawn.', yes: 'New map', no: 'Keep driving', onYes: newMap });
  });
  $('#btn-horn').addEventListener('click', function () { horn(false); });

  // full screen: the whole page, so the top bar and dialogs stay
  var fsBtn = $('#btn-full');
  var canFull = !!(document.fullscreenEnabled || document.webkitFullscreenEnabled);
  fsBtn.hidden = !canFull;
  function fullEl() { return document.fullscreenElement || document.webkitFullscreenElement; }
  function toggleFull() {
    if (!canFull) return;
    var d = document, el = d.documentElement;
    try {
      if (fullEl()) (d.exitFullscreen || d.webkitExitFullscreen).call(d);
      else { var r = (el.requestFullscreen || el.webkitRequestFullscreen).call(el); if (r && r.catch) r.catch(function () { /* refused */ }); }
    } catch (err) { /* not allowed here */ }
  }
  function fsChanged() { fsBtn.textContent = fullEl() ? 'Exit full screen (F)' : 'Full screen (F)'; sc.timeout(layout, 60); }
  fsBtn.addEventListener('click', toggleFull);
  sc.on(document, 'fullscreenchange', fsChanged);
  sc.on(document, 'webkitfullscreenchange', fsChanged);
  sc.add(A.onBoss(function (on) { if (on && fullEl()) toggleFull(); }));
  sc.add(function () { if (fullEl()) { try { (document.exitFullscreen || document.webkitExitFullscreen).call(document); } catch (e) { /* gone */ } } });

  sc.on(document, 'keydown', function (e) {
    if (e.ctrlKey || e.metaKey || e.altKey || A.modalOpen()) return;
    var tag = (e.target && e.target.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    var k = e.key.toLowerCase(), w = S.w;
    if (!w) return;
    if (/^[1-6]$/.test(k)) { var cr = w.map.crossings.find(function (c) { return c.key === k; }); if (cr) { e.preventDefault(); crossingCmd(cr.id); } return; }
    var sw = w.map.nodes.find(function (n) { return n.key && n.key.toLowerCase() === k; });
    if (sw) { e.preventDefault(); switchCmd(sw.id); return; }
    var sg = w.map.stations.find(function (s) { return s.key && s.key.toLowerCase() === k; });
    if (sg) { e.preventDefault(); signalCmd(sg.id); return; }
    var tr = w.trains.find(function (t) { return t.key && t.key.toLowerCase() === k; });
    if (tr) { e.preventDefault(); trainCmd(tr.id); return; }
    if (k === ' ') { if (tag === 'BUTTON') return; e.preventDefault(); trainCmd(S.sel); return; }
    if (k === 'h') { horn(false); return; }
    if (k === 'f') { toggleFull(); return; }
    if (k === 'enter' && tag !== 'BUTTON') { e.preventDefault(); start(); return; }
    if (k === 'p') { $('#btn-pause').click(); return; }
    if (k === 'n') { $('#btn-new').click(); return; }
    if (k === '?') openHelp();
  });

  var rt = null;
  sc.on(window, 'resize', function () { clearTimeout(rt); rt = sc.timeout(layout, 80); });
  if (window.ResizeObserver) {
    var ro = new ResizeObserver(function () { clearTimeout(rt); rt = sc.timeout(layout, 60); });
    ro.observe(stage);
    sc.add(function () { ro.disconnect(); });
  }

  newMap();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { if (sc.alive() && S.w) { drawStatic(); draw(performance.now()); } });
  sc.raf(frame);
  if (A.firstVisit(GAME)) openHelp();

  window.levelCrossing = {
    state: S, start: start, newMap: newMap, train: trainCmd, crossing: crossingCmd, flip: switchCmd, signal: signalCmd,
    // for the dev checks: map coordinates to page coordinates, and a quick way to run the railway forward
    toPage: function (x, y) { var r = cvs.getBoundingClientRect(); return [r.left + X(x), r.top + Y(y)]; },
    // where to click each control on the page
    controls: function () {
      var w = S.w, r = cvs.getBoundingClientRect(), out = { trains: [], switches: [], crossings: [], signals: [] };
      function pg(x, y) { return [r.left + X(x), r.top + Y(y)]; }
      w.trains.forEach(function (t) { if (t.kind === 'you') { var c = w.carsOf(t)[1]; out.trains.push(pg(c[0], c[1])); } });
      w.map.nodes.forEach(function (n) {
        if (n.type !== 'switch') return;
        var ch = w.map.edges[n.outs[1]].at(1.2), mid = w.map.edges[n.outs[0]].at(1.2);
        out.switches.push({ id: n.id, at: pg(n.x - (ch[0] - mid[0]) * 0.75, n.y - (ch[1] - mid[1]) * 0.75) });
      });
      w.map.crossings.forEach(function (cr) { var g = crossingGeom(cr); out.crossings.push(pg(cr.x - g.rd[0] * 1.55 + g.td[0] * 1.15, cr.y - g.rd[1] * 1.55 + g.td[1] * 1.15)); });
      if (cfg().freight) w.map.stations.forEach(function (st) { var p = w.map.edges[st.edge].at(st.sig); out.signals.push(pg(p[0] - st.nx * 0.85, p[1] - st.ny * 0.85)); });
      return out;
    },
    fastForward: function (sec) {
      var w = S.w;
      if (!S.running) start();
      for (var i = 0; i < sec / E.DT && !w.over; i++) { w.step(); w.events.forEach(handle); w.events.length = 0; }
      renderHud();
    }
  };
  sc.add(function () { if (window.levelCrossing && window.levelCrossing.state === S) delete window.levelCrossing; });
  return sc.dispose;
}
