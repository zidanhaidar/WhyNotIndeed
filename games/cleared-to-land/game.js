/*
 * Cleared to Land: the full-screen airport. Draws the airfield and the planes from above (planes in the air cast a
 * shadow that grows with height), turns clicks, taps and keys into landing, go-around, push-back and take-off
 * commands, plays the airport sounds and runs the panel.
 * mount() runs after window.Arcade is ready (components/PageShell.jsx) and returns a cleanup function.
 */
import E from './engine.js';
import { INK, COL, chip, strikeIcon, rr, nameBoard, keyBadge, tag, flatRoof, tree, hash, mmss, makeKit, building, prism, cylinder, tree3d, car3d, rectPts, lift, shadowAt } from '../shared/yard.js';

export function mount() {
  var A = window.Arcade;
  var sc = A.scope();
  var GAME = 'cleared-to-land';
  var ORDER = ['pip', 'gridlock', 'monolith', 'edith'];
  var S = {
    level: A.lastLevel(GAME), w: null, running: false, paused: false, acc: 0, lastFrame: 0, lastLine: '', bannerUntil: 0,
    pops: [], puffs: [], text: {}, endShown: false, view: { k: 20, ox: 0, oy: 0 }, fit: null, hover: null, crashAt: 0, alarmT: 0, beepT: {}
  };
  var K = makeKit(A, sc, S), $ = K.$;

  var TALK = {
    pip: {
      blurb: 'Sends planes in whenever it likes, with plenty of fuel in their tanks.',
      rank: 'Rookie sky boss',
      start: ['Hi! I am sending some planes. They are very shiny.', 'Ding dong! Welcome to the airport!', 'Planes go up, planes come down. Easy!'],
      strike: ['Oh no, somebody is grumpy!', 'Oopsie. That one was not happy.'],
      mission: ['Mission done! The passengers clapped!', 'Yay! Everyone landed!'],
      crash: ['Oh no! Two planes on the runway!', 'Eek! That looked expensive.'],
      end: ['That was fun! Same time tomorrow?']
    },
    gridlock: {
      blurb: 'Sends planes in tidy waves of three, a few seconds apart. Calm spells, then a crowd in the sky.',
      rank: 'Pro sky boss',
      start: ['Arrivals in waves of three. As scheduled.', 'Runway in use. Keep it tidy.', 'The schedule says: busy.'],
      strike: ['Complaint received. Filed.', 'That was not on the timetable.'],
      mission: ['Mission complete. On schedule.', 'Tidy work.'],
      crash: ['Runway collision recorded.', 'That was not in the plan.'],
      end: ['Shift over. Runway closed.']
    },
    monolith: {
      blurb: 'Sends planes low on fuel exactly when your runway is busy, so somebody always wants to land right now.',
      rank: 'Grandmaster sky boss',
      start: ['I send them when you are busiest.', 'Low fuel, busy runway. Your move.', 'The sky is full. Choose wisely.'],
      strike: ['Another unhappy passenger.', 'The schedule slips.'],
      mission: ['Mission done. Impressive.', 'The passengers approve.'],
      crash: ['Timing is everything.', 'One runway, two planes.'],
      end: ['The sky has spoken.']
    },
    edith: {
      blurb: 'Times the low-fuel planes like Excel, and flies her own pink jet in for a touch and go whenever she likes. Only a red runway light keeps her circling, and she hates to circle.',
      rank: 'Impossible sky boss',
      start: ['Hi! My jet does not wait for anybody. Hee hee.', 'Edith Air is coming through! Better keep that runway clear!', 'Low fuel and a busy runway. You are welcome!'],
      strike: ['Aww, somebody is cross. Not my problem!', 'Oopsie! Was that yours?'],
      mission: ['Fine, you finished a mission. Whatever.', 'Lucky!'],
      crash: ['Edith Air never waits!', 'Oopsie! Was that your plane?'],
      end: ['Edith Air always lands first.']
    }
  };
  function L() { return A.LEVEL_MAP[S.level]; }
  function cfg() { return E.LEVELS[S.level]; }

  // ---------- sounds ----------

  var roar = K.loop('lowpass', 420, 0.7), hum = K.loop('bandpass', 1400, 1.5);
  function radio() { A.noise(0.08, 0.025, 0, 2600, 1.2); A.tone(880, 0.09, 'sine', 0.035, 0.08); A.tone(1320, 0.14, 'sine', 0.03, 0.17); }
  function sfx(kind) {
    switch (kind) {
      case 'cleared': radio(); break;
      case 'goaround': A.tone(660, 0.12, 'square', 0.03); A.tone(660, 0.12, 'square', 0.03, 0.2); A.noise(1.6, 0.05, 0.1, 500, 0.7); break;
      case 'touchdown': A.tone(1700, 0.1, 'sine', 0.02, 0, 1150); A.tone(1500, 0.09, 'sine', 0.016, 0.12, 1000); A.noise(0.3, 0.03, 0, 3000, 1); A.noise(1.3, 0.05, 0.25, 700, 0.6); break;
      case 'gate': A.tone(988, 0.3, 'sine', 0.04); A.tone(784, 0.45, 'sine', 0.04, 0.28); break;
      case 'coin': A.tone(988, 0.06, 'square', 0.02); A.tone(1318, 0.12, 'square', 0.02, 0.05); break;
      case 'ready': A.tone(1046, 0.14, 'sine', 0.03); break;
      case 'pushback': [0, 0.5, 1.0].forEach(function (d) { A.tone(1040, 0.22, 'square', 0.014, d); }); break;
      case 'takeoff': A.noise(3.2, 0.07, 0, 380, 0.6); A.noise(2.4, 0.03, 0.3, 1600, 0.8); A.tone(90, 3, 'sawtooth', 0.025, 0, 170); radio(); break;
      case 'liftoff': A.noise(1.6, 0.04, 0, 900, 0.7); break;
      case 'arrive': A.noise(1.6, 0.018, 0, 1200, 0.9); break;
      case 'lowfuel': A.tone(1200, 0.08, 'triangle', 0.03); A.tone(900, 0.12, 'triangle', 0.03, 0.12); break;
      case 'alarm': A.tone(740, 0.14, 'square', 0.028); A.tone(988, 0.14, 'square', 0.028, 0.16); break;
      case 'light': A.tone(1200, 0.03, 'square', 0.02); A.tone(600, 0.06, 'triangle', 0.025, 0.03); break;
      case 'jet': A.noise(2.2, 0.05, 0, 1400, 0.8); A.tone(1568, 0.12, 'triangle', 0.025, 0.2); A.tone(2093, 0.18, 'triangle', 0.025, 0.34); break;
      case 'crash':
        A.noise(1.4, 0.14, 0, 260, 0.5); A.noise(0.7, 0.09, 0, 2600, 1); A.noise(0.4, 0.06, 0.2, 5200, 2);
        A.tone(80, 0.9, 'sine', 0.14, 0, 38); A.tone(1250, 0.6, 'square', 0.02, 0.05, 900); break;
    }
  }

  // ---------- view ----------

  var cvs = $('#map'), ctx = cvs.getContext('2d'), stat = document.createElement('canvas'), sctx = stat.getContext('2d');
  var panel = $('#panel'), stage = $('#stage');

  function layout() {
    var f = K.fitRect(stage, panel), dpr = window.devicePixelRatio || 1;
    S.fit = f;
    cvs.width = Math.max(1, Math.round(f.w * dpr)); cvs.height = Math.max(1, Math.round(f.h * dpr));
    cvs.style.width = f.w + 'px'; cvs.style.height = f.h + 'px';
    stat.width = cvs.width; stat.height = cvs.height;
    if (S.w) {
      var m = S.w.map, k = Math.min((f.x1 - f.x0) / m.W, (f.y1 - f.y0) / m.H);
      S.view = { k: k, ox: f.x0 + ((f.x1 - f.x0) - m.W * k) / 2, oy: f.y0 + ((f.y1 - f.y0) - m.H * k) / 2 };
      drawStatic();
    }
    draw(performance.now());
  }
  function X(u) { return S.view.ox + u * S.view.k; }
  function Y(u) { return S.view.oy + u * S.view.k; }
  // draw in map units, along the runway: a runs along it, b across
  function frame(c, a, b, rot) {
    var m = S.w.map, p = m.P(a, b), k = S.view.k;
    c.save(); c.translate(X(p[0]), Y(p[1]));
    c.transform(m.u[0] * k, m.u[1] * k, m.v[0] * k, m.v[1] * k, 0, 0);
    if (rot) c.rotate(rot);
  }
  function quad(c, a0, b0, a1, b1) { c.beginPath(); c.rect(Math.min(a0, a1), Math.min(b0, b1), Math.abs(a1 - a0), Math.abs(b1 - b0)); }

  function drawStatic() {
    var c = sctx, w = S.w, m = w.map, k = S.view.k, dpr = window.devicePixelRatio || 1, f = S.fit, px = 1 / k;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.fillStyle = '#9CCB6B'; c.fillRect(0, 0, f.w, f.h);
    // mown stripes along the runway, and meadow patches
    frame(c, 0, 0);
    var big = Math.max(m.W, m.H);
    for (var sb = -big; sb < big; sb += 2) { c.fillStyle = (sb / 2) % 2 ? 'rgba(255,255,255,.06)' : 'rgba(40,110,50,.06)'; c.fillRect(-big, sb, big * 2, 1); }
    c.restore();
    for (var pi = 0; pi < 22; pi++) {
      c.beginPath(); c.ellipse(hash(pi, m.W, 5) * f.w, hash(pi, m.H, 6) * f.h, (1.4 + hash(pi, 1, 7) * 2) * k * 1.5, (1.4 + hash(pi, 1, 7) * 2) * k, hash(pi, 2, 8) * Math.PI, 0, Math.PI * 2);
      c.fillStyle = pi % 3 ? 'rgba(180, 225, 120, .3)' : 'rgba(60, 140, 60, .12)'; c.fill();
    }
    var lo = m.Lr / 2, sd = m.side, d = m.dir;
    // a service road and the car park behind the terminal
    var aa = Math.abs(m.aE - m.aH) / 2 + 2.6, roadB = m.bB + sd * 1.2;
    frame(c, 0, 0);
    quad(c, -big, roadB - 0.5, big, roadB + 0.5); c.fillStyle = '#5E6372'; c.fill();
    c.strokeStyle = '#FFE08A'; c.lineWidth = 1.5 * px; c.setLineDash([0.4, 0.35]); c.beginPath(); c.moveTo(-big, roadB); c.lineTo(big, roadB); c.stroke(); c.setLineDash([]);
    var pkB = m.bB + sd * 0.15;
    quad(c, -aa + 1, pkB, aa - 1, pkB + sd * 0.55); c.fillStyle = '#7A808E'; c.fill();
    c.restore();
    var raised = [];
    for (var ca = -aa + 1.2; ca < aa - 1.3; ca += 0.42) {
      var hv = hash(ca, m.W, 9);
      if (hv < 0.3) continue;
      (function (pp, col2) { raised.push({ y: pp[1] + 0.3, fn: function () { car3d(c, pp[0], pp[1], Math.atan2(m.v[1], m.v[0]), 0.44, 0.28, col2, k); } }); })(m.P(ca + 0.2, pkB + sd * 0.27), ['#F2F2F2', '#5B6BD9', '#E07A5F', '#81B29A', '#3D405B', '#F4D35E'][Math.floor(hv * 6)]);
    }

    // the apron
    frame(c, 0, 0);
    var apA0 = Math.min(m.aE, m.aH) - 1.2, apA1 = Math.max(m.aE, m.aH) + 1.2;
    quad(c, apA0, m.bT + sd * 0.3, apA1, m.bF); c.fillStyle = '#CDD1D9'; c.fill(); c.strokeStyle = INK; c.lineWidth = 2 * px; c.stroke();
    c.strokeStyle = 'rgba(29,26,51,.08)'; c.lineWidth = 1 * px;
    for (var ga = apA0; ga < apA1; ga += 1) { c.beginPath(); c.moveTo(ga, m.bT + sd * 0.3); c.lineTo(ga, m.bF); c.stroke(); }
    // the taxiway, exits and the line-up
    function strip(pts, wd) { c.beginPath(); pts.forEach(function (q, i) { if (i) c.lineTo(q[0], q[1]); else c.moveTo(q[0], q[1]); }); c.lineWidth = wd; c.lineCap = 'round'; c.lineJoin = 'round'; c.stroke(); }
    var tw = [[m.aL, m.bR], [m.aL, m.bT], [m.aE, m.bT], [m.aE, m.bR]];
    c.strokeStyle = INK; strip(tw, 1.0 + 4 * px);
    c.strokeStyle = '#6B7080'; strip(tw, 1.0);
    c.restore();

    // the runway
    frame(c, 0, m.bR);
    quad(c, -lo, -0.78, lo, 0.78); c.fillStyle = INK; c.fill();
    quad(c, -lo + 0.06, -0.72, lo - 0.06, 0.72); c.fillStyle = '#474C59'; c.fill();
    c.strokeStyle = '#fff'; c.lineWidth = 2 * px;
    c.beginPath(); c.moveTo(-lo + 0.2, -0.62); c.lineTo(lo - 0.2, -0.62); c.moveTo(-lo + 0.2, 0.62); c.lineTo(lo - 0.2, 0.62); c.stroke();
    c.setLineDash([0.7, 0.55]); c.lineWidth = 2.6 * px;
    c.beginPath(); c.moveTo(-lo + 3, 0); c.lineTo(lo - 3, 0); c.stroke(); c.setLineDash([]);
    [-1, 1].forEach(function (e) {
      // piano keys at each end
      for (var kk = 0; kk < 6; kk++) { var bb = -0.55 + kk * 0.2 + (kk >= 3 ? 0.1 : 0); c.fillStyle = '#fff'; c.fillRect(e * (lo - 0.95) - 0.35, bb, 0.7, 0.12); }
      // touchdown zone bars
      c.fillRect(e * (lo - 3.6) - 0.6, -0.42, 1.2, 0.14); c.fillRect(e * (lo - 3.6) - 0.6, 0.28, 1.2, 0.14);
    });
    c.restore();
    // runway numbers, the way pilots would read them on their way in
    var hdg = function (vx, vy) { var deg = (Math.atan2(vx, -vy) * 180 / Math.PI + 360) % 360, n = Math.round(deg / 10) || 36; return (n < 10 ? '0' : '') + n; };
    [[-1, hdg(m.u[0], m.u[1])], [1, hdg(-m.u[0], -m.u[1])]].forEach(function (pair) {
      var p = m.P(pair[0] * (lo - 2.0), m.bR), ang = Math.atan2(pair[0] > 0 ? -m.u[1] : m.u[1], pair[0] > 0 ? -m.u[0] : m.u[0]) + Math.PI / 2;
      c.save(); c.translate(X(p[0]), Y(p[1])); c.rotate(ang);
      c.font = Math.round(0.85 * k) + 'px Staatliches, "Arial Narrow", sans-serif'; c.fillStyle = '#fff'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(pair[1], 0, 0); c.restore();
    });

    // taxiway lines and the holding point
    frame(c, 0, 0);
    c.strokeStyle = '#FFD45C'; c.lineWidth = 2 * px; c.lineCap = 'round';
    c.beginPath(); c.moveTo(m.aL, m.bR + sd * 0.8); c.lineTo(m.aL, m.bT); c.lineTo(m.aE, m.bT); c.lineTo(m.aE, m.bR + sd * 0.8); c.stroke();
    m.stands.forEach(function (st) { c.beginPath(); c.moveTo(st.a, m.bT); c.lineTo(st.a, m.bS + sd * 0.2); c.stroke(); });
    c.lineWidth = 2.4 * px;
    [0, 0.12].forEach(function (o) { c.beginPath(); c.moveTo(m.aH - d * (0.6 + o), m.bT - 0.5); c.lineTo(m.aH - d * (0.6 + o), m.bT + 0.5); c.stroke(); });
    c.setLineDash([0.12, 0.1]);
    [0.26, 0.38].forEach(function (o) { c.beginPath(); c.moveTo(m.aH - d * (0.6 + o), m.bT - 0.5); c.lineTo(m.aH - d * (0.6 + o), m.bT + 0.5); c.stroke(); });
    c.setLineDash([]);
    // stands: a colored bar where the nose stops
    m.stands.forEach(function (st) {
      quad(c, st.a - 0.55, m.bS + sd * 0.55, st.a + 0.55, m.bS + sd * 0.7); c.fillStyle = COL[st.color].hex; c.fill(); c.strokeStyle = INK; c.lineWidth = 1.2 * px; c.stroke();
    });
    c.restore();

    // the buildings stand up: terminal with a glass front, jet bridges, the control tower, a hangar, and trees
    var t0 = Math.min(m.aE, m.aH) - 0.6, t1 = Math.max(m.aE, m.aH) + 0.6, tb = (m.bF + m.bB) / 2;
    function box(a0, b0, a1, b1) { var p = m.P(a0, b0), q = m.P(a1, b1); return [Math.min(p[0], q[0]), Math.min(p[1], q[1]), Math.max(p[0], q[0]), Math.max(p[1], q[1])]; }
    var tbx = box(t0, m.bF, t1, m.bB);
    raised.push({ y: tbx[3], fn: function () { building(c, tbx[0], tbx[1], tbx[2], tbx[3], 0.85, { k: k, wall: '#E9EBF0', tint: '#DCE1EA', window: '#7FC8E8', floors: 2, units: true }); } });
    m.stands.forEach(function (st) {
      var jb = box(st.a + 0.31, m.bF, st.a + 0.53, m.bF - sd * 0.72);
      raised.push({ y: jb[3] + 0.01, fn: function () {
        var top = prism(c, [[jb[0], jb[1]], [jb[2], jb[1]], [jb[2], jb[3]], [jb[0], jb[3]]], 0.35, { k: k, top: '#C4C9D3', wall: '#AEB4C2' });
        // the colored hood at the plane end
        var e = m.P(st.a + 0.42, m.bF - sd * 0.66), Lh = lift(0.35);
        c.beginPath(); c.arc(e[0] + Lh[0], e[1] + Lh[1], 0.12, 0, Math.PI * 2); c.fillStyle = COL[st.color].hex; c.fill(); c.strokeStyle = INK; c.lineWidth = 1.2 / k; c.stroke();
        void top;
      } });
    });
    var tw0 = m.P(t1 + 1.4 * Math.sign(t1 || 1), tb), hgx = box(t0 - 3.3, tb - 0.9, t0 - 1.1, tb + 0.9);
    raised.push({ y: tw0[1] + 0.4, fn: function () {
      var top = cylinder(c, tw0[0], tw0[1], 0.36, 2.1, { k: k, side: '#E9EBF0', bands: [[0.45, 0.5, '#C9CED8'], [0.75, 0.8, '#C9CED8']] });
      // the glass cab, its roof and an antenna
      c.save(); c.translate(top[0] - tw0[0], top[1] - tw0[1]);
      var cab = cylinder(c, tw0[0], tw0[1], 0.68, 0.38, { k: k, side: '#7FD0E6', top: '#7FD0E6', shadow: false });
      c.beginPath(); c.arc(cab[0], cab[1], 0.34, 0, Math.PI * 2); c.fillStyle = '#5E6372'; c.fill(); c.strokeStyle = INK; c.lineWidth = 1.4 / k; c.stroke();
      c.restore();
      c.beginPath(); c.moveTo(cab[0] + (top[0] - tw0[0]), cab[1] + (top[1] - tw0[1])); var an = lift(0.5); c.lineTo(cab[0] + (top[0] - tw0[0]) + an[0], cab[1] + (top[1] - tw0[1]) + an[1]); c.strokeStyle = INK; c.lineWidth = 2 / k; c.stroke();
    } });
    raised.push({ y: hgx[3], fn: function () {
      building(c, hgx[0], hgx[1], hgx[2], hgx[3], 1.05, { k: k, wall: '#8FA3B8', tint: '#A9BACB', units: false });
      var Lr = lift(1.05);
      c.strokeStyle = 'rgba(29,26,51,.3)'; c.lineWidth = 1 / k;
      for (var hr = hgx[1] + 0.2; hr < hgx[3]; hr += 0.25) { c.beginPath(); c.moveTo(hgx[0] + Lr[0], hr + Lr[1]); c.lineTo(hgx[2] + Lr[0], hr + Lr[1]); c.stroke(); }
    } });
    m.decor.forEach(function (dd) { raised.push({ y: dd.y + dd.r * 0.5, fn: function () { tree3d(c, dd.x, dd.y, dd.r, dd.kind, dd.hue, k); } }); });
    c.save(); c.translate(S.view.ox, S.view.oy); c.scale(k, k);
    raised.sort(function (a2, b2) { return a2.y - b2.y; });
    raised.forEach(function (it) { it.fn(); });
    c.restore();
    // a sign for each gate color, on the terminal roof
    var groups = {}, Lt = lift(0.85);
    m.stands.forEach(function (st) { (groups[st.color] = groups[st.color] || []).push(st.a); });
    Object.keys(groups).forEach(function (col) {
      var ga2 = (groups[col][0] + groups[col][1]) / 2, p = m.P(ga2, tb);
      nameBoard(c, col, COL[col].name.toUpperCase(), X(p[0] + Lt[0]), Y(p[1] + Lt[1]), k);
    });
  }

  // ---------- planes ----------

  // a plane from straight above, in the same flat style as everything else; shadow: just the silhouette
  function planeShape(c, p, scale, shadow) {
    var L = p.spec.len * scale, Wd = p.spec.span * scale * (1 - Math.abs(p.bank || 0) * (p.alt > 0.3 ? 0.18 : 0));
    var jet = p.kind === 'jet', body = jet ? '#FF9EC2' : '#FBFBFD', tail = jet ? '#E8577E' : (COL[p.color] || COL.red).hex;
    var lw = 1.6 / S.view.k, fw = L * 0.068;
    c.lineJoin = 'round';
    function wings() { c.beginPath(); c.moveTo(L * 0.14, -fw); c.lineTo(-L * 0.1, -Wd / 2); c.lineTo(-L * 0.22, -Wd / 2); c.lineTo(-L * 0.12, -fw); c.lineTo(-L * 0.12, fw); c.lineTo(-L * 0.22, Wd / 2); c.lineTo(-L * 0.1, Wd / 2); c.lineTo(L * 0.14, fw); c.closePath(); }
    function tailplane() { c.beginPath(); c.moveTo(-L * 0.34, -fw * 0.6); c.lineTo(-L * 0.45, -Wd * 0.21); c.lineTo(-L * 0.5, -Wd * 0.21); c.lineTo(-L * 0.46, 0); c.lineTo(-L * 0.5, Wd * 0.21); c.lineTo(-L * 0.45, Wd * 0.21); c.lineTo(-L * 0.34, fw * 0.6); c.closePath(); }
    function fuselage() { c.beginPath(); c.moveTo(L / 2, 0); c.quadraticCurveTo(L / 2, -fw, L * 0.36, -fw); c.lineTo(-L * 0.4, -fw); c.quadraticCurveTo(-L / 2, -fw * 0.6, -L / 2, 0); c.quadraticCurveTo(-L / 2, fw * 0.6, -L * 0.4, fw); c.lineTo(L * 0.36, fw); c.quadraticCurveTo(L / 2, fw, L / 2, 0); c.closePath(); }
    if (shadow) {
      c.fillStyle = 'rgba(29,26,51,.32)';
      wings(); c.fill(); tailplane(); c.fill(); fuselage(); c.fill();
      return;
    }
    // wings with tips in the tail color
    wings(); c.fillStyle = '#E6E8EF'; c.fill(); c.strokeStyle = INK; c.lineWidth = lw; c.stroke();
    [-1, 1].forEach(function (sd) {
      c.beginPath(); c.moveTo(-L * 0.1, sd * Wd / 2); c.lineTo(-L * 0.22, sd * Wd / 2); c.lineTo(-L * 0.2, sd * Wd * 0.42); c.lineTo(-L * 0.075, sd * Wd * 0.42); c.closePath();
      c.fillStyle = tail; c.fill(); c.stroke();
    });
    // engines under the wings (jets have them at the back)
    if (!jet) [-1, 1].forEach(function (sd) {
      rr(c, -L * 0.02, sd * Wd * 0.2 - L * 0.04, L * 0.15, L * 0.08, L * 0.035); c.fillStyle = '#AEB4C2'; c.fill(); c.stroke();
      c.beginPath(); c.arc(L * 0.12, sd * Wd * 0.2, L * 0.025, 0, Math.PI * 2); c.fillStyle = '#3A3D48'; c.fill();
    });
    else [-1, 1].forEach(function (sd) { rr(c, -L * 0.36, sd * fw * 1.6 - L * 0.035, L * 0.14, L * 0.07, L * 0.03); c.fillStyle = '#E8577E'; c.fill(); c.stroke(); });
    tailplane(); c.fillStyle = tail; c.fill(); c.stroke();
    // the body: rounded nose, a row of cabin windows, the tail fin along the top, the cockpit
    fuselage(); c.fillStyle = body; c.fill(); c.stroke();
    c.fillStyle = 'rgba(29,26,51,.1)'; c.fillRect(-L * 0.38, fw * 0.25, L * 0.72, fw * 0.6);
    c.fillStyle = '#2B3A55';
    for (var x = -L * 0.3; x < L * 0.3; x += L * 0.075) { c.beginPath(); c.arc(x, -fw * 0.45, L * 0.012, 0, Math.PI * 2); c.arc(x, fw * 0.45, L * 0.012, 0, Math.PI * 2); c.fill(); }
    rr(c, -L * 0.5, -fw * 0.28, L * 0.2, fw * 0.56, fw * 0.25); c.fillStyle = tail; c.fill(); c.strokeStyle = INK; c.lineWidth = lw * 0.8; c.stroke();
    c.beginPath(); c.moveTo(L * 0.4, -fw * 0.7); c.quadraticCurveTo(L * 0.47, 0, L * 0.4, fw * 0.7); c.lineTo(L * 0.36, fw * 0.6); c.quadraticCurveTo(L * 0.41, 0, L * 0.36, -fw * 0.6); c.closePath();
    c.fillStyle = '#2B3A55'; c.fill();
    if (jet) { c.beginPath(); c.arc(L * 0.05, -fw * 1.4, fw * 0.9, 0, Math.PI * 2); c.fillStyle = '#E8577E'; c.fill(); c.strokeStyle = INK; c.lineWidth = lw * 0.8; c.stroke(); }
  }

  function navLights(c, p, now, scale) {
    var L = p.spec.len * scale, Wd = p.spec.span * scale, blink = Math.floor(now / 500 + p.id) % 3 === 0;
    c.beginPath(); c.arc(-L * 0.2, -Wd / 2, 0.06, 0, Math.PI * 2); c.fillStyle = '#FF3B30'; c.fill();
    c.beginPath(); c.arc(-L * 0.2, Wd / 2, 0.06, 0, Math.PI * 2); c.fillStyle = '#3BE37A'; c.fill();
    if (blink) { c.beginPath(); c.arc(-L * 0.5, 0, 0.1, 0, Math.PI * 2); c.fillStyle = 'rgba(255,255,255,.95)'; c.fill(); }
  }

  function drawPlane(c, p, now) {
    var k = S.view.k, alt = p.alt || 0, scale = 1 + 0.3 * alt, hov = S.hover && S.hover.id === p.id;
    // the shadow falls the same way as every other shadow, further away the higher the plane flies
    var sh = shadowAt(0.2 + alt * 2.6);
    c.save(); c.translate(X(p.x + sh[0]), Y(p.y + sh[1])); c.rotate(p.h); c.scale(k, k);
    c.globalAlpha = Math.max(0.45, 1 - alt * 0.35);
    planeShape(c, p, 1, true); c.restore();
    c.save(); c.translate(X(p.x), Y(p.y)); c.rotate(p.h); c.scale(k, k);
    if (hov) { c.beginPath(); c.arc(0, 0, p.spec.len * scale * 0.62, 0, Math.PI * 2); c.fillStyle = 'rgba(255,212,92,.35)'; c.fill(); }
    planeShape(c, p, scale, false);
    if (alt > 0.05 || p.state === 'lineup' || p.state === 'rollout') navLights(c, p, now, scale);
    // a landing light on final
    if (p.state === 'approach' && p.final) { c.beginPath(); c.moveTo(p.spec.len * scale * 0.5, 0); c.lineTo(p.spec.len * scale * 1.6, -0.25); c.lineTo(p.spec.len * scale * 1.6, 0.25); c.closePath(); c.fillStyle = 'rgba(255,245,190,.35)'; c.fill(); }
    c.restore();
  }

  function fuelRing(c, p) {
    var k = S.view.k, q = Math.max(0, p.fuel / p.fuelMax), r = (p.spec.len * (1 + 0.32 * p.alt) * 0.62 + 0.15) * k, x = X(p.x), y = Y(p.y);
    c.beginPath(); c.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * q);
    c.strokeStyle = q > 0.5 ? '#2FBF71' : q > 0.25 ? '#FF9F1C' : '#E5483A'; c.lineWidth = Math.max(2.5, 0.09 * k); c.stroke();
  }
  function waitRing(c, p, t, max) {
    var k = S.view.k, q = Math.min(1, t / max), x = X(p.x), y = Y(p.y) - p.spec.len * 0.75 * k;
    c.beginPath(); c.arc(x, y, 0.22 * k, -Math.PI / 2, -Math.PI / 2 + q * Math.PI * 2); c.lineTo(x, y); c.closePath();
    c.fillStyle = q > 0.7 ? '#E5483A' : '#FF9F1C'; c.fill();
    c.beginPath(); c.arc(x, y, 0.22 * k, 0, Math.PI * 2); c.strokeStyle = INK; c.lineWidth = 1.6; c.stroke();
  }

  function drawPlanes(c, now) {
    var w = S.w, k = S.view.k, m = w.map;
    // ground first, then the sky
    var list = w.planes.slice().sort(function (a, b) { return a.alt - b.alt; });
    list.forEach(function (p) { drawPlane(c, p, now); });
    list.forEach(function (p) {
      var x = X(p.x), y = Y(p.y) - (p.spec.len * (1 + 0.32 * p.alt) * 0.5 + 0.45) * k;
      if (p.kind === 'jet') { if (p.state === 'hold' && p.holdT > 0.5) waitRing(c, p, p.holdT, cfg().jetHold); tag(c, 'EDITH', x, y, k, '#E8577E'); return; }
      if (p.state === 'hold' || p.state === 'inbound') { fuelRing(c, p); tag(c, p.label + (p.fuel < 20 ? ' FUEL!' : ''), x, y, k, p.fuel < 20 ? '#E5483A' : '#3D4A66'); }
      else if (p.state === 'approach') tag(c, p.final ? 'FINAL' : 'CLEARED', x, y, k, '#2FBF71');
      else if (p.state === 'ready' || p.state === 'push-wait') { tag(c, p.state === 'ready' ? 'READY' : 'PUSHING', x, y, k, '#3D86F0'); waitRing(c, p, p.readyT, cfg().patience); }
      else if (p.state === 'holdshort') { tag(c, 'TAKE OFF?', x, y, k, '#F28C28'); waitRing(c, p, p.waitT, cfg().patience); }
    });
    // the way a cleared plane will fly in
    w.planes.forEach(function (p) {
      if (p.state !== 'approach' || !p.path) return;
      c.strokeStyle = 'rgba(255,255,255,.75)'; c.lineWidth = 2; c.setLineDash([6, 6]);
      c.beginPath(); c.moveTo(X(p.x), Y(p.y));
      var steps = 24;
      for (var i = 1; i <= steps; i++) { var q = p.path.at(p.s + (p.path.len - p.s) * i / steps); c.lineTo(X(q[0]), Y(q[1])); }
      c.stroke(); c.setLineDash([]);
    });
    void m;
  }

  function drawSky(c, now) {
    var w = S.w, m = w.map, k = S.view.k;
    // holding patterns
    m.holds.forEach(function (h, i) {
      c.beginPath(); c.arc(X(h.x), Y(h.y), h.r * k, 0, Math.PI * 2);
      c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 2; c.setLineDash([5, 7]); c.lineDashOffset = -now / 60; c.stroke(); c.setLineDash([]); c.lineDashOffset = 0;
      c.beginPath(); c.moveTo(X(h.x), Y(h.y) - 0.25 * k); c.lineTo(X(h.x) + 0.22 * k, Y(h.y) + 0.15 * k); c.lineTo(X(h.x) - 0.22 * k, Y(h.y) + 0.15 * k); c.closePath();
      c.fillStyle = 'rgba(255,255,255,.7)'; c.fill();
      void i;
    });
  }

  function drawLights(c, now) {
    var w = S.w, m = w.map, k = S.view.k, d = m.dir;
    // approach lights before the landing end, with a running strobe pointing at the runway
    var start = -d * m.Lr / 2, n = 7, run = Math.floor(now / 90) % (n + 4);
    for (var i = 0; i < n; i++) {
      var p = m.P(start - d * (0.8 + i * 0.7), m.bR), lit = n - 1 - i === run;
      c.beginPath(); c.arc(X(p[0]), Y(p[1]), (lit ? 0.16 : 0.08) * k, 0, Math.PI * 2);
      c.fillStyle = lit ? '#FFFFFF' : 'rgba(255,240,170,.9)'; c.fill();
      if (lit) { c.beginPath(); c.arc(X(p[0]), Y(p[1]), 0.35 * k, 0, Math.PI * 2); c.fillStyle = 'rgba(255,255,255,.3)'; c.fill(); }
    }
    // the runway light (Edith): a big lamp at the landing end
    if (cfg().jet) {
      var lp = m.P(-d * (m.Lr / 2 - 0.4), m.bR - m.side * 1.5), hov = S.hover && S.hover.kind === 'light';
      rr(c, X(lp[0]) - 0.32 * k, Y(lp[1]) - 0.32 * k, 0.64 * k, 0.64 * k, 0.12 * k); c.fillStyle = INK; c.fill();
      if (hov) { c.strokeStyle = '#FFD45C'; c.lineWidth = 3; c.stroke(); }
      c.beginPath(); c.arc(X(lp[0]), Y(lp[1]), 0.21 * k, 0, Math.PI * 2); c.fillStyle = w.runwayRed ? '#FF3B30' : '#3BE37A'; c.fill();
      keyBadge(c, X(lp[0]) + 0.62 * k, Y(lp[1]), 'R', k);
    }
    // the windsock: blows toward the far end, so planes land into the wind
    var ws = m.P(d * (m.Lr / 2 - 1.2), m.bR - m.side * 1.7), wob = Math.sin(now / 300) * 0.15;
    var ang = Math.atan2(m.u[1] * d, m.u[0] * d) + wob, wsh = shadowAt(0.9);
    c.save(); c.translate(X(ws[0] + wsh[0]), Y(ws[1] + wsh[1])); c.rotate(ang);
    c.beginPath(); c.moveTo(0, -0.12 * k); c.lineTo(k, -0.04 * k); c.lineTo(k, 0.04 * k); c.lineTo(0, 0.12 * k); c.closePath(); c.fillStyle = 'rgba(29,26,51,.25)'; c.fill();
    c.restore();
    c.save(); c.translate(X(ws[0]), Y(ws[1])); c.rotate(ang);
    c.beginPath(); c.arc(0, 0, 0.09 * k, 0, Math.PI * 2); c.fillStyle = INK; c.fill();
    for (var s2 = 0; s2 < 4; s2++) {
      c.beginPath(); c.moveTo(s2 * 0.25 * k, -(0.16 - s2 * 0.025) * k); c.lineTo((s2 + 1) * 0.25 * k, -(0.16 - (s2 + 1) * 0.025) * k); c.lineTo((s2 + 1) * 0.25 * k, (0.16 - (s2 + 1) * 0.025) * k); c.lineTo(s2 * 0.25 * k, (0.16 - s2 * 0.025) * k); c.closePath();
      c.fillStyle = s2 % 2 ? '#fff' : '#FF6B2C'; c.fill(); c.strokeStyle = INK; c.lineWidth = 1.2; c.stroke();
    }
    c.restore();
    // the tower's beacon sweeps round
    var t0 = Math.max(m.aE, m.aH) + 0.6, tw0 = m.P(t0 + 1.4 * Math.sign(t0 || 1), (m.bF + m.bB) / 2), ba = now / 700, tl2 = lift(2.5);
    tw0 = [tw0[0] + tl2[0], tw0[1] + tl2[1]];
    c.beginPath(); c.moveTo(X(tw0[0]), Y(tw0[1])); c.arc(X(tw0[0]), Y(tw0[1]), 1.6 * k, ba, ba + 0.5); c.closePath(); c.fillStyle = 'rgba(255,240,170,.18)'; c.fill();
  }

  function drawPuffs(c, now) {
    S.puffs = S.puffs.filter(function (p) { return now - p.t < p.life; });
    S.puffs.forEach(function (p) {
      var q = (now - p.t) / p.life;
      c.beginPath(); c.arc(X(p.x), Y(p.y), (p.r + q * p.grow) * S.view.k, 0, Math.PI * 2);
      c.fillStyle = 'rgba(' + p.rgb + ',' + (p.a * (1 - q)) + ')'; c.fill();
    });
  }
  function drawPops(c, now) {
    S.pops = S.pops.filter(function (p) { return now - p.t < 1300; });
    S.pops.forEach(function (p) {
      var q = (now - p.t) / 1300;
      c.globalAlpha = 1 - q;
      c.font = '20px Staatliches, "Arial Narrow", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.lineWidth = 4; c.strokeStyle = INK; c.strokeText(p.text, X(p.x), Y(p.y) - q * 30);
      c.fillStyle = p.color; c.fillText(p.text, X(p.x), Y(p.y) - q * 30);
      c.globalAlpha = 1;
    });
  }
  function drawCrash(c, now) {
    var w = S.w;
    if (!w.crash) return;
    var k = S.view.k, x = X(w.crash.x), y = Y(w.crash.y), q = Math.min(1, (now - S.crashAt) / 500);
    c.save(); c.translate(x, y); c.rotate(now / 900);
    c.beginPath();
    for (var i = 0; i < 16; i++) { var a = i * Math.PI / 8, r = (i % 2 ? 0.8 : 1.7) * k * (0.4 + 0.6 * q); if (i) c.lineTo(Math.cos(a) * r, Math.sin(a) * r); else c.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
    c.closePath(); c.fillStyle = '#FFD45C'; c.fill(); c.strokeStyle = INK; c.lineWidth = 3; c.stroke();
    c.rotate(-now / 900);
    c.font = Math.round(0.8 * k) + 'px Staatliches, "Arial Narrow", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillStyle = '#E5483A'; c.fillText('CRASH!', 0, 2);
    c.restore();
  }

  function draw(now) {
    if (!S.w || !S.fit) return;
    var dpr = window.devicePixelRatio || 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(stat, 0, 0);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawLights(ctx, now);
    drawSky(ctx, now);
    drawPuffs(ctx, now);
    drawPlanes(ctx, now);
    drawPops(ctx, now);
    drawCrash(ctx, now);
  }

  // contrails behind climbing and high planes, smoke from the tyres
  function emit(now, dt) {
    var w = S.w;
    w.planes.forEach(function (p) {
      p.puffT = (p.puffT || 0) - dt;
      if (p.puffT > 0) return;
      if (p.state === 'climb' || (p.alt > 0.9 && p.state !== 'hold')) {
        p.puffT = 0.12;
        var bx = p.x - Math.cos(p.h) * p.spec.len * 0.55, by = p.y - Math.sin(p.h) * p.spec.len * 0.55;
        S.puffs.push({ x: bx, y: by, r: 0.08, grow: 0.25, a: 0.55, rgb: '255,255,255', t: now, life: 1400 });
      } else if (p.state === 'hold') {
        p.puffT = 0.25;
        S.puffs.push({ x: p.x - Math.cos(p.h) * p.spec.len * 0.55, y: p.y - Math.sin(p.h) * p.spec.len * 0.55, r: 0.05, grow: 0.15, a: 0.35, rgb: '255,255,255', t: now, life: 900 });
      }
    });
  }

  // ---------- panel ----------

  function buildPanel() {
    var Lv = L(), T = TALK[S.level];
    $('#bot-name').textContent = Lv.name;
    $('#bot-rank').textContent = T.rank;
    $('#strikes').innerHTML = Array.apply(null, Array(E.STRIKES)).map(function () { return '<span class="strike">' + strikeIcon() + '</span>'; }).join('');
    $('#btn-light').hidden = !cfg().jet;
    var best = A.progress(GAME)[S.level];
    $('#best').textContent = best ? 'Your best against ' + Lv.name + ': ' + best.text + '.' : 'No shift against ' + Lv.name + ' yet. Stars at ' + E.STARS.join(', ') + ' passengers.';
    S.text = {};
  }

  function renderHud() {
    var w = S.w;
    K.setText('#delivered', String(w.delivered));
    K.setText('#time', mmss(w.t));
    K.setHtml('#by-color', w.colors.map(function (c) { return '<span class="bc">' + chip(c) + '<b>' + (w.byColor[c] || 0) + '</b></span>'; }).join(''));
    var used = $('#strikes').children;
    for (var i = 0; i < used.length; i++) used[i].classList.toggle('used', i < w.strikes);
    var m = w.mission;
    K.setHtml('#mission', '<span class="mission-head">Mission ' + m.n + '</span>' + Object.keys(m.need).map(function (c) {
      var got = m.got[c], need = m.need[c];
      return '<div class="mrow' + (got >= need ? ' done' : '') + '">' + chip(c) + '<span>' + COL[c].name + ' planes to ' + COL[c].name + ' gates</span><b>' + got + '/' + need + '</b><i style="width:' + Math.round(100 * got / need) + '%"></i></div>';
    }).join(''));
    var ps = w.planes, hold = ps.filter(function (p) { return p.kind === 'plane' && (p.state === 'hold' || p.state === 'inbound'); });
    var low = hold.reduce(function (a, p) { return !a || p.fuel < a.fuel ? p : a; }, null);
    var ready = ps.filter(function (p) { return p.state === 'ready'; }).length, line = ps.filter(function (p) { return p.state === 'holdshort'; }).length;
    var fin = ps.some(function (p) { return p.state === 'approach' && p.kind === 'plane'; });
    K.setText('#q-hold', hold.length + (low ? ' (' + low.label + ': ' + Math.max(0, Math.ceil(low.fuel)) + 's of fuel)' : ''));
    K.setText('#q-ready', String(ready));
    K.setText('#q-line', String(line));
    $('#btn-land').disabled = !hold.length;
    $('#btn-ga').disabled = !fin;
    $('#btn-push').disabled = !ready;
    $('#btn-to').disabled = !line;
    if (cfg().jet) K.setText('#btn-light', w.runwayRed ? 'Runway light: red (R)' : 'Runway light: green (R)');
    A.music.intensity(Math.min(0.95, 0.35 + hold.length / 10 + w.strikes * 0.08));
  }

  // ---------- playing ----------

  function newMap() {
    A.closeModal(true);
    var f = K.fitRect(stage, panel);
    S.fit = f;
    S.w = new E.World(S.level, (Math.random() * 1e9) >>> 0, Math.max(0.4, (f.x1 - f.x0) / Math.max(1, f.y1 - f.y0)));
    S.running = false; S.paused = false; S.endShown = false; S.pops = []; S.puffs = [];
    $('#start-card').hidden = false; $('#veil').hidden = true; $('#banner').hidden = true;
    buildPanel(); renderHud();
    K.say(K.pick(TALK[S.level].start), 'smug');
    A.music.intensity(0.35);
    layout();
  }
  function start() {
    if (A.modalOpen()) return;
    if (S.w.over) { newMap(); return; }
    if (S.running) return;
    S.running = true; S.lastFrame = 0;
    $('#start-card').hidden = true;
    K.banner('The tower is open. Bring them in!', false, 1800);
    radio();
  }
  function live() { return S.w && !S.w.over && !A.isBoss() && !A.modalOpen() && !S.paused; }
  function act() { if (!live()) return false; if (!S.running) start(); return true; }
  function flush() { S.w.events.forEach(handle); S.w.events.length = 0; renderHud(); }
  function cmd(fn) { if (act()) { fn(); flush(); } }

  function landNext() { cmd(function () { var w = S.w, c = w.planes.filter(function (p) { return p.kind === 'plane' && (p.state === 'hold' || p.state === 'inbound'); }).sort(function (a, b) { return a.fuel - b.fuel; })[0]; if (c) w.clearToLand(c.id); }); }
  function goAround() { cmd(function () { var w = S.w, c = w.planes.filter(function (p) { return p.state === 'approach' && p.kind === 'plane'; }).sort(function (a, b) { return (a.path.len - a.s) - (b.path.len - b.s); })[0]; if (c) w.goAround(c.id); }); }
  function pushNext() { cmd(function () { var w = S.w, c = w.planes.filter(function (p) { return p.state === 'ready'; }).sort(function (a, b) { return b.readyT - a.readyT; })[0]; if (c) w.pushBack(c.id); }); }
  function takeOffNext() { cmd(function () { var w = S.w, c = w.planes.filter(function (p) { return p.state === 'holdshort'; }).sort(function (a, b) { return b.waitT - a.waitT; })[0]; if (c) w.takeOff(c.id); }); }
  function light() { cmd(function () { S.w.toggleRunway(); }); }

  function handle(ev) {
    var w = S.w, T = TALK[S.level], now = performance.now(), p = ev.plane != null ? w.plane(ev.plane) : null;
    switch (ev.type) {
      case 'cleared': sfx('cleared'); break;
      case 'goaround': sfx('goaround'); K.banner('Going around!', false, 1400); break;
      case 'touchdown':
        sfx('touchdown');
        if (p) for (var i = 0; i < 6; i++) S.puffs.push({ x: p.x + (Math.random() - 0.5) * 0.5, y: p.y + (Math.random() - 0.5) * 0.5, r: 0.12, grow: 0.5, a: 0.6, rgb: '230,230,235', t: now + i * 30, life: 1100 });
        break;
      case 'gate': sfx('gate'); break;
      case 'deliver': {
        sfx('coin');
        if (p) S.pops.push({ text: '+' + ev.pax, x: p.x, y: p.y, t: now, color: COL[ev.color].hex });
        break;
      }
      case 'ready': sfx('ready'); break;
      case 'pushback': sfx('pushback'); break;
      case 'holdshort': sfx('ready'); break;
      case 'takeoff': sfx('takeoff'); break;
      case 'liftoff': sfx('liftoff'); break;
      case 'arrive': sfx('arrive'); break;
      case 'runway-light': sfx('light'); break;
      case 'jet': sfx('jet'); K.banner('Edith Air is on its way in! A red runway light keeps it circling.', false, 3000); K.say('Edith Air, coming through! Toot toot!', 'smug'); break;
      case 'mission':
        A.jingle('good');
        K.banner('Mission ' + ev.n + ' done!' + (ev.back ? ' One complaint forgiven.' : ''), false, 2600);
        if (Math.random() < 0.7) K.say(K.pick(T.mission), 'annoyed');
        break;
      case 'strike': {
        var msg = ev.why === 'divert' ? 'A plane ran low on fuel and flew to another airport!'
          : ev.why === 'gate' ? 'A plane waited too long at its gate!'
            : ev.why === 'holdshort' ? 'A plane waited too long to take off!'
              : 'Edith\'s jet circled too long!';
        A.jingle('bad');
        K.banner(msg + ' (' + ev.strikes + ' of ' + E.STRIKES + ')', true, 2600);
        K.say(K.pick(T.strike), 'happy');
        break;
      }
      case 'end':
        if (ev.reason === 'crash') { S.crashAt = now; sfx('crash'); K.banner('Crash! Two planes met on the runway.', true, 4000); K.say(K.pick(T.crash), 'surprised'); }
        sc.timeout(endGame, ev.reason === 'crash' ? 1600 : 700);
        break;
    }
  }

  // engine noise, low-fuel beeps and the runway alarm
  function ambient(dt) {
    var w = S.w;
    if (!A.soundOn() || A.isBoss() || !S.running || w.over) { roar.set(0); hum.set(0); return; }
    var loud = 0, air = 0;
    w.planes.forEach(function (p) {
      if (p.state === 'lineup' || p.state === 'climb' || (p.state === 'rollout' && p.v > 2)) loud += p.v / 4;
      if (p.alt > 0.3) air++;
      if (p.kind === 'plane' && p.state === 'hold' && p.fuel < 20) {
        S.beepT[p.id] = (S.beepT[p.id] || 0) - dt;
        if (S.beepT[p.id] <= 0) { S.beepT[p.id] = 4; sfx('lowfuel'); }
      }
    });
    roar.set(Math.min(0.12, 0.05 * loud + 0.006 * air));
    hum.set(Math.min(0.02, 0.004 * air), 1200 + 200 * Math.sin(w.t));
    // the runway is not clear for a plane about to land
    var danger = w.planes.some(function (p) {
      return p.state === 'approach' && p.final && (p.path.len - p.s) / 3 < 5 && w.planes.some(function (o) { return o !== p && (w.onRunway(o) || o.state === 'lineup'); });
    });
    S.alarmT -= dt;
    if (danger && S.alarmT <= 0) { S.alarmT = 0.7; sfx('alarm'); }
  }

  function loop(now) {
    sc.raf(loop);
    var w = S.w, dt = S.lastFrame ? Math.min(0.1, (now - S.lastFrame) / 1000) : 0;
    S.lastFrame = now;
    if (w && S.running && !w.over && !(S.paused || A.isBoss() || A.modalOpen() || document.hidden)) {
      S.acc += dt;
      while (S.acc >= E.DT && !w.over) { w.step(); w.events.forEach(handle); w.events.length = 0; S.acc -= E.DT; }
      renderHud(); ambient(dt); emit(now, dt);
    } else { S.acc = 0; roar.set(0); hum.set(0); }
    $('#banner').hidden = now > S.bannerUntil;
    $('#btn-pause').textContent = S.paused ? 'Resume (P)' : 'Pause (P)';
    $('#btn-pause').disabled = !S.running || !w || w.over;
    draw(now);
  }

  function endGame() {
    var w = S.w, Lv = L(), T = TALK[S.level];
    if (S.endShown) return;
    S.endShown = true; S.running = false;
    roar.set(0); hum.set(0);
    var stars = w.stars(), d = w.delivered;
    A.account.submit(GAME, S.level, A.points(S.level, w.points()), d + ' passengers in ' + mmss(w.t));
    A.music.intensity(0.35);
    var rec = A.record(GAME, S.level, { stars: stars, score: d, lowerIsBetter: false, text: d + ' passengers' });
    bar.refresh(); buildPanel(); renderHud();
    A.jingle(stars ? 'win' : 'lose');
    if (w.reason !== 'crash') K.say(K.pick(T.end), stars ? 'annoyed' : 'happy');
    var next = ORDER[ORDER.indexOf(S.level) + 1], buttons = [{ label: 'New airport', kind: 'main', onClick: newMap }];
    if (stars && next) buttons.push({ label: 'Next boss: ' + A.LEVEL_MAP[next].name, kind: 'line', onClick: function () { S.level = next; bar.setLevel(next); newMap(); } });
    var note = rec.better ? (rec.prev ? 'New best against ' + Lv.name + '!' : 'Your first shift against ' + Lv.name + ' is on the books.') : 'Your best: ' + rec.prev.text + '.';
    var why = w.reason === 'crash' ? 'Two planes met on the runway.' : 'Five complaints closed the airport.';
    var colors = w.colors.map(function (c) { return '<span class="bc">' + chip(c, 16) + ' ' + COL[c].name + ' <b>' + (w.byColor[c] || 0) + '</b></span>'; }).join('');
    A.modal({
      title: stars === 3 ? 'Air traffic legend!' : stars ? 'Wheels down!' : w.reason === 'crash' ? 'Crash!' : 'The airport is closed',
      tone: stars ? 'win' : 'lose',
      html: '<p class="lead">You landed <strong>' + w.landed + ' plane' + (w.landed === 1 ? '' : 's') + '</strong> with <strong>' + d + ' passengers</strong>, sent off ' + w.departed + ' and finished ' + w.missionsDone + ' mission' + (w.missionsDone === 1 ? '' : 's') + ' in a shift of ' + mmss(w.t) + '.</p>' +
        '<p class="lc-colors">' + colors + '</p><p>' + why + '</p>' + A.stars(stars) + '<p><strong>' + note + '</strong></p>' +
        (stars < 3 ? '<p class="soft">Stars at ' + E.STARS.join(', ') + ' passengers. Tip: clear the next plane as soon as the one before it touches down, and slip departures in between.</p>' : ''),
      buttons: buttons,
      link: { label: 'Close and look at the airport' }
    });
  }

  function openHelp() {
    var rows = ORDER.map(function (id) {
      var Lv = A.LEVEL_MAP[id], c = E.LEVELS[id];
      return '<div><dt>' + Lv.name + ', ' + Lv.rank.toLowerCase() + '</dt><dd>' + c.colors + ' gate colors. ' + TALK[id].blurb + '</dd></div>';
    }).join('');
    A.modal({
      title: 'How to play',
      wide: true,
      html: '<p>You are the control tower of a little airport, and every shift draws a new one. Each plane has a tail in its gate\'s color. Land them, park them, and send them off again.</p>' +
        '<ol><li><strong>Landing:</strong> planes circle in the dashed holding patterns. Click one (or press L for the one with the least fuel) to clear it to land. A ring shows its fuel: let it run out and it flies off to another airport.</li>' +
        '<li><strong>One at a time:</strong> two planes on the runway at once is a crash and ends the shift. Clear the next plane once the one before has touched down. Click a plane on final (or press G) to send it around.</li>' +
        '<li><strong>Gates:</strong> a landed plane taxis to a gate of its color and its passengers get off. Then it boards and shows READY.</li>' +
        '<li><strong>Take-off:</strong> click a ready plane (or press D) to push it back. It taxis to the holding point by the runway. Click it there (or press T) to take off, when nobody is about to land.</li>' +
        '<li><strong>Edith\'s jet</strong> flies in for a touch and go whenever she likes. Set the runway light red (R) to keep her circling while you use the runway, but not for too long.</li>' +
        '<li><strong>Complaints:</strong> a plane that diverts, or a plane kept waiting at its gate or at the runway. Five close the airport. Finishing a mission takes one away.</li></ol>' +
        '<h3>Sky bosses</h3><dl>' + rows + '</dl>' +
        '<h3>Keys</h3><table class="keys"><tr><td><kbd>L</kbd></td><td>Clear the plane with the least fuel to land</td></tr><tr><td><kbd>G</kbd></td><td>Go around</td></tr>' +
        '<tr><td><kbd>D</kbd></td><td>Push back the plane that has waited longest</td></tr><tr><td><kbd>T</kbd></td><td>Take off</td></tr><tr><td><kbd>R</kbd></td><td>Runway light (Edith)</td></tr>' +
        '<tr><td><kbd>F</kbd></td><td>Full screen</td></tr><tr><td><kbd>Enter</kbd></td><td>Start</td></tr><tr><td><kbd>P</kbd></td><td>Pause</td></tr><tr><td><kbd>N</kbd></td><td>New airport</td></tr>' +
        '<tr><td><kbd>M</kbd></td><td>Music on or off</td></tr><tr><td><kbd>B</kbd></td><td>Panic button</td></tr></table>',
      buttons: [{ label: 'Cleared for take-off!', kind: 'main' }]
    });
  }

  var bar = A.mountBar({
    el: $('#bar'), game: GAME, title: 'Cleared to Land', tagline: 'Land them, park them, send them off. One runway, no bumping.',
    level: S.level, levelLabel: 'Boss',
    canSwitch: function () { return S.running && !S.w.over ? 'This shift will be abandoned.' : true; },
    onLevel: function (id) { S.level = id; newMap(); },
    onHelp: openHelp
  });
  sc.add(bar.destroy);

  // ---------- pointer and keys ----------

  function toMap(e) { var r = cvs.getBoundingClientRect(); return [((e.clientX - r.left) - S.view.ox) / S.view.k, ((e.clientY - r.top) - S.view.oy) / S.view.k]; }
  function lightPos() { var m = S.w.map; return m.P(-m.dir * (m.Lr / 2 - 0.4), m.bR - m.side * 1.5); }
  function hitTest(x, y) {
    var w = S.w, best = null, bd = 1e9;
    w.planes.forEach(function (p) {
      var can = (p.kind === 'plane' && (p.state === 'hold' || p.state === 'inbound' || p.state === 'approach' || p.state === 'ready' || p.state === 'holdshort'));
      if (!can) return;
      var d = Math.hypot(p.x - x, p.y - y), lim = p.spec.len * (1 + 0.32 * p.alt) * 0.7 + 0.35;
      if (d < lim && d < bd) { bd = d; best = { kind: 'plane', id: p.id }; }
    });
    if (cfg().jet) { var lp = lightPos(); if (Math.hypot(lp[0] - x, lp[1] - y) < 0.6 && !best) best = { kind: 'light', id: -1 }; }
    return best;
  }
  cvs.addEventListener('pointerdown', function (e) {
    if (!S.w || A.isBoss()) return;
    var p = toMap(e), h = hitTest(p[0], p[1]);
    if (!h) return;
    e.preventDefault();
    if (h.kind === 'plane') cmd(function () { S.w.command(h.id); });
    else light();
  });
  cvs.addEventListener('pointermove', function (e) {
    if (!S.w || e.pointerType === 'touch') return;
    var p = toMap(e); S.hover = hitTest(p[0], p[1]);
    cvs.style.cursor = S.hover ? 'pointer' : 'default';
  });
  cvs.addEventListener('pointerleave', function () { S.hover = null; });

  $('#btn-land').addEventListener('click', landNext);
  $('#btn-ga').addEventListener('click', goAround);
  $('#btn-push').addEventListener('click', pushNext);
  $('#btn-to').addEventListener('click', takeOffNext);
  $('#btn-light').addEventListener('click', light);
  $('#btn-start').addEventListener('click', start);
  $('#btn-pause').addEventListener('click', function () { if (!(S.running && !S.w.over)) return; S.paused = !S.paused; $('#veil').hidden = !S.paused; });
  $('#btn-new').addEventListener('click', function () {
    if (!(S.running && !S.w.over)) return newMap();
    A.confirm({ title: 'New airport?', text: 'This shift will be abandoned and a brand new airport is drawn.', yes: 'New airport', no: 'Keep working', onYes: newMap });
  });
  var toggleFull = K.fullscreen($('#btn-full'), layout);

  sc.on(document, 'keydown', function (e) {
    if (e.ctrlKey || e.metaKey || e.altKey || A.modalOpen()) return;
    var tag2 = (e.target && e.target.tagName) || '';
    if (tag2 === 'INPUT' || tag2 === 'TEXTAREA' || !S.w) return;
    var k = e.key.toLowerCase();
    if (k === 'l') landNext();
    else if (k === 'g') goAround();
    else if (k === 'd') pushNext();
    else if (k === 't') takeOffNext();
    else if (k === 'r') light();
    else if (k === 'f') toggleFull();
    else if (k === 'enter' && tag2 !== 'BUTTON') { e.preventDefault(); start(); }
    else if (k === 'p') $('#btn-pause').click();
    else if (k === 'n') $('#btn-new').click();
    else if (k === '?') openHelp();
  });

  var rt = null;
  sc.on(window, 'resize', function () { clearTimeout(rt); rt = sc.timeout(layout, 80); });
  if (window.ResizeObserver) { var ro = new ResizeObserver(function () { clearTimeout(rt); rt = sc.timeout(layout, 60); }); ro.observe(stage); sc.add(function () { ro.disconnect(); }); }

  newMap();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { if (sc.alive() && S.w) { drawStatic(); draw(performance.now()); } });
  sc.raf(loop);
  if (A.firstVisit(GAME)) openHelp();

  window.clearedToLand = {
    state: S, start: start, newMap: newMap, land: landNext, goAround: goAround, push: pushNext, takeOff: takeOffNext, light: light,
    toPage: function (x, y) { var r = cvs.getBoundingClientRect(); return [r.left + X(x), r.top + Y(y)]; },
    fastForward: function (sec) { var w = S.w; if (!S.running) start(); for (var i = 0; i < sec / E.DT && !w.over; i++) { w.step(); w.events.forEach(handle); w.events.length = 0; } renderHud(); }
  };
  sc.add(function () { if (window.clearedToLand && window.clearedToLand.state === S) delete window.clearedToLand; });
  return sc.dispose;
}
