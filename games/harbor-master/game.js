/*
 * Harbor Master: the full-screen harbor. Draws the water, coasts, docks and boats from above, turns the helm
 * buttons and keys into rudder and engine telegraph commands, shows the forecast of where the ship will be,
 * plays the harbor sounds and runs the panel. On a tall screen the wide harbor is drawn turned on its side.
 * mount() runs after window.Arcade is ready (components/PageShell.jsx) and returns a cleanup function.
 */
import E from './engine.js';
import { INK, COL, chip, strikeIcon, rr, nameBoard, keyBadge, tag, hipRoof, flatRoof, ROOFS, tree, hash, mmss, makeKit, building, prism, cylinder, tree3d, car3d, rectPts, lift, setLift, turnedLight } from '../shared/yard.js';

export function mount() {
  var A = window.Arcade;
  var sc = A.scope();
  var GAME = 'harbor-master';
  var ORDER = ['pip', 'gridlock', 'monolith', 'edith'];
  var TELE = ['Full astern', 'Half astern', 'Stop', 'Half ahead', 'Full ahead'];
  var S = {
    level: A.lastLevel(GAME), w: null, running: false, paused: false, acc: 0, lastFrame: 0, lastLine: '', bannerUntil: 0,
    pops: [], wake: [], text: {}, endShown: false, view: { k: 20, ox: 0, oy: 0, rot: false }, fit: null, hover: null, crashAt: 0,
    chugT: 0, gullT: 4, bellT: 0, keys: {}, swapAnim: 0
  };
  var K = makeKit(A, sc, S), $ = K.$;

  var TALK = {
    pip: {
      blurb: 'Two little sailboats drift about the harbor. No bridge, plenty of room.',
      rank: 'Rookie harbor boss',
      start: ['Ahoy! Mind my sailboats, they are new.', 'Hi! The crates are piling up. Off you go!', 'Splish splash! Ships do not stop quickly, you know.'],
      strike: ['Oh no, somebody is grumpy!', 'Oopsie. That one was not happy.'],
      mission: ['Mission done! The harbor cheers!', 'Yay! All the crates got home!'],
      crash: ['Oh no! Is everyone dry?', 'Eek! That was a big splash.'],
      end: ['That was fun! Same tide tomorrow?']
    },
    gridlock: {
      blurb: 'Adds a ferry on a fixed line and a drawbridge. Raise it to pass, but the drivers hate to wait.',
      rank: 'Pro harbor boss',
      start: ['The ferry runs on time. Plan around it.', 'Bridge traffic is heavy today.', 'Steady as she goes.'],
      strike: ['Complaint received. Filed.', 'That was not on the timetable.'],
      mission: ['Mission complete. On schedule.', 'Tidy seamanship.'],
      crash: ['Collision recorded.', 'That was not in the plan.'],
      end: ['Shift over. Harbor closed.']
    },
    monolith: {
      blurb: 'A ferry, two trawlers that wander the harbor, and the drawbridge. Busier docks, less patient crates.',
      rank: 'Grandmaster harbor boss',
      start: ['The trawlers go where they please.', 'Busy docks today. Choose your route well.', 'Watch your forecast.'],
      strike: ['Another unhappy customer.', 'The schedule slips.'],
      mission: ['Mission done. Impressive.', 'The harbor approves.'],
      crash: ['Momentum is a cruel master.', 'The sea always wins.'],
      end: ['The tide has turned.']
    },
    edith: {
      blurb: 'Gives you the big ship that turns slowly, and sends her pink speedboat to cut across wherever you are heading.',
      rank: 'Impossible harbor boss',
      start: ['Hi! My speedboat goes wherever you go. Hee hee.', 'Big ship today! It turns like a fridge.', 'Edith on the water! Better watch that forecast!'],
      strike: ['Aww, somebody is cross. Not my problem!', 'Oopsie! Was that yours?'],
      mission: ['Fine, you finished a mission. Whatever.', 'Lucky!'],
      crash: ['Edith never brakes!', 'Oopsie! Was that your ship?'],
      end: ['Edith always rules the waves.']
    }
  };
  function L() { return A.LEVEL_MAP[S.level]; }
  function cfg() { return E.LEVELS[S.level]; }

  // ---------- sounds ----------

  var engine = K.loop('lowpass', 110, 0.9), sea = K.loop('lowpass', 520, 0.6);
  function sfx(kind) {
    switch (kind) {
      case 'telegraph': A.tone(1568, 0.25, 'triangle', 0.03); A.tone(1568, 0.25, 'triangle', 0.03, 0.18); A.tone(3135, 0.12, 'sine', 0.006, 0); break;
      case 'creak': A.tone(130, 0.35, 'sawtooth', 0.008, 0, 95); A.noise(0.3, 0.008, 0, 700, 3); break;
      case 'horn': A.tone(110, 1.3, 'sawtooth', 0.03); A.tone(165, 1.3, 'sawtooth', 0.02); A.tone(220, 1.3, 'square', 0.006); break;
      case 'dock': A.tone(1318, 0.5, 'triangle', 0.03); A.tone(1318, 0.5, 'triangle', 0.02, 0.4); A.noise(0.6, 0.02, 0.1, 400, 1); break;
      case 'crane': A.tone(220, 0.4, 'sawtooth', 0.008, 0, 330); A.noise(0.12, 0.03, 0.38, 600, 2); break;
      case 'coin': A.tone(988, 0.06, 'square', 0.02); A.tone(1318, 0.12, 'square', 0.02, 0.05); break;
      case 'bump': A.noise(0.35, 0.07, 0, 180, 0.8); A.tone(70, 0.4, 'sine', 0.08, 0, 50); A.tone(160, 0.5, 'sawtooth', 0.01, 0.1, 110); break;
      case 'crunch': A.noise(0.7, 0.11, 0, 220, 0.6); A.noise(0.4, 0.05, 0.05, 2200, 2); A.tone(60, 0.7, 'sine', 0.12, 0, 35); break;
      case 'touch': A.noise(0.2, 0.04, 0, 300, 1); break;
      case 'bridge': A.tone(1760, 0.2, 'triangle', 0.02); A.tone(140, 2.0, 'sawtooth', 0.008, 0, 120); break;
      case 'bell': A.tone(1760, 0.18, 'triangle', 0.018); break;
      case 'honk': [0, 0.22].forEach(function (d) { A.tone(392, 0.15, 'square', 0.02, d); A.tone(494, 0.15, 'square', 0.015, d); }); break;
      case 'gull': A.tone(1900, 0.18, 'sine', 0.012, 0, 1300); A.tone(2000, 0.22, 'sine', 0.01, 0.22, 1200); break;
      case 'ferry': A.tone(147, 0.9, 'sawtooth', 0.015); A.tone(220, 0.9, 'sawtooth', 0.01); break;
      case 'speed': A.noise(1.2, 0.03, 0, 1800, 2); A.tone(900, 0.8, 'sawtooth', 0.006, 0, 700); break;
      case 'crash':
        A.noise(1.4, 0.14, 0, 240, 0.5); A.noise(0.7, 0.09, 0, 2600, 1); A.tone(70, 0.9, 'sine', 0.14, 0, 35);
        A.noise(1.6, 0.05, 0.3, 900, 0.5); break; // and a splash
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
      var m = S.w.map, rot = (f.x1 - f.x0) / Math.max(1, f.y1 - f.y0) < 0.9;
      var mw = rot ? m.H : m.W, mh = rot ? m.W : m.H, k = Math.min((f.x1 - f.x0) / mw, (f.y1 - f.y0) / mh);
      S.view = { k: k, ox: f.x0 + ((f.x1 - f.x0) - mw * k) / 2, oy: f.y0 + ((f.y1 - f.y0) - mh * k) / 2, rot: rot };
      if (rot) { var tl = turnedLight(); setLift(tl[0], tl[1]); } else setLift();
      drawStatic();
    }
    draw(performance.now());
  }
  // map point to the screen (the harbor is turned a quarter on tall screens)
  function SX(x, y) { var v = S.view; return v.rot ? v.ox + (S.w.map.H - y) * v.k : v.ox + x * v.k; }
  function SY(x, y) { var v = S.view; return v.rot ? v.oy + x * v.k : v.oy + y * v.k; }
  function world(c) {
    var v = S.view;
    c.save(); c.translate(v.ox, v.oy); c.scale(v.k, v.k);
    if (v.rot) { c.translate(S.w.map.H, 0); c.rotate(Math.PI / 2); }
  }
  function polyPath(c, pts) { c.beginPath(); pts.forEach(function (p, i) { if (i) c.lineTo(p[0], p[1]); else c.moveTo(p[0], p[1]); }); c.closePath(); }

  function drawStatic() {
    var c = sctx, w = S.w, m = w.map, k = S.view.k, dpr = window.devicePixelRatio || 1, f = S.fit, px = 1 / k;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.fillStyle = '#3FA7D6'; c.fillRect(0, 0, f.w, f.h);
    world(c);
    var big = 60;
    // deeper water in the middle
    var g = c.createRadialGradient(m.W / 2, m.H / 2, 2, m.W / 2, m.H / 2, Math.max(m.W, m.H) * 0.6);
    g.addColorStop(0, '#2E8FC4'); g.addColorStop(1, '#45AEDB');
    c.fillStyle = g; c.fillRect(-big, -big, m.W + 2 * big, m.H + 2 * big);
    // shallows, sand and grass on every coast, island and rock
    m.polys.forEach(function (P) {
      polyPath(c, P.pts);
      if (P.kind !== 'causeway') { c.strokeStyle = 'rgba(160,225,240,.75)'; c.lineWidth = 1.3; c.lineJoin = 'round'; c.stroke(); }
    });
    m.polys.forEach(function (P) {
      polyPath(c, P.pts);
      if (P.kind === 'rock') { c.fillStyle = '#8E95A3'; c.fill(); c.strokeStyle = INK; c.lineWidth = 2 * px; c.stroke(); return; }
      if (P.kind === 'causeway') return;
      c.strokeStyle = '#F2DFA8'; c.lineWidth = 0.55; c.stroke();
      c.fillStyle = '#8CCB5E'; c.fill();
      c.strokeStyle = INK; c.lineWidth = 2 * px; c.stroke();
    });
    // the causeway with its road
    var b = m.bridge;
    if (b) {
      [[-3, b.y - b.gap], [b.y + b.gap, m.H + 3]].forEach(function (seg) {
        c.fillStyle = '#B9BEC8'; c.fillRect(b.x - b.hw, seg[0], b.hw * 2, seg[1] - seg[0]);
        c.strokeStyle = INK; c.lineWidth = 2 * px; c.strokeRect(b.x - b.hw, seg[0], b.hw * 2, seg[1] - seg[0]);
        c.fillStyle = '#5E6372'; c.fillRect(b.x - 0.55, seg[0], 1.1, seg[1] - seg[0]);
        c.strokeStyle = '#FFE08A'; c.lineWidth = 1.4 * px; c.setLineDash([0.35, 0.3]); c.beginPath(); c.moveTo(b.x, seg[0]); c.lineTo(b.x, seg[1]); c.stroke(); c.setLineDash([]);
      });
    }
    // rocks get a few dark spots
    m.polys.forEach(function (P) { if (P.kind === 'rock') { c.beginPath(); c.arc(P.cx - P.r * 0.25, P.cy - P.r * 0.2, P.r * 0.25, 0, Math.PI * 2); c.fillStyle = 'rgba(29,26,51,.25)'; c.fill(); } });
    // everything standing up, from the back to the front: quays, warehouses, houses, trees, the lighthouse
    var raised = [], L1 = lift(1);
    function depth(x, y) { return -(L1[0] * x + L1[1] * y); }
    m.docks.forEach(function (d) {
      var dir = d.side ? -1 : 1, y0 = d.base - dir * 0.8, y1 = d.y - dir * 0.95, top = Math.min(y0, y1), h = Math.abs(y1 - y0);
      raised.push({ z: depth(d.x, top + h), fn: function () {
        var tp = prism(c, [[d.x - 1.6, top], [d.x + 1.6, top], [d.x + 1.6, top + h], [d.x - 1.6, top + h]], 0.18, { k: k, top: '#D5D8DF', wall: '#9AA0AD' });
        var Lq = lift(0.18);
        c.fillStyle = COL[d.color].hex; c.fillRect(d.x - 1.6 + Lq[0], y1 - (dir > 0 ? 0.18 : 0) + Lq[1], 3.2, 0.18);
        c.strokeStyle = 'rgba(29,26,51,.35)'; c.lineWidth = 1.4 * px;
        [-0.9, 0.9].forEach(function (tx) { c.beginPath(); c.moveTo(d.x + tx + Lq[0], top + 0.1 + Lq[1]); c.lineTo(d.x + tx + Lq[0], top + h - 0.1 + Lq[1]); c.stroke(); });
        [-1.3, -0.4, 0.5, 1.3].forEach(function (bx) { cylinder(c, d.x + bx + Lq[0], y1 - dir * 0.3 + Lq[1], 0.07, 0.12, { k: k, side: '#3A3D48', shadow: false, lw: 1 }); });
        void tp;
      } });
      var wx = d.x + 2.6, wy = d.base + dir * 0.9;
      raised.push({ z: depth(wx, wy + 0.65), fn: function () { building(c, wx - 0.9, wy - 0.65, wx + 0.9, wy + 0.65, 0.85, { k: k, wall: '#E9D8C4', tint: '#D8C3A8', window: '#9CC9D3', floors: 1, door: true }); } });
    });
    m.scenery.forEach(function (o) {
      if (o.kind === 'house') {
        var hw = hash(o.x, o.y) < 0.5, ex = hw ? 0.55 : 0.4, ey = hw ? 0.4 : 0.55, rf = ROOFS[o.hue % ROOFS.length];
        raised.push({ z: depth(o.x, o.y), fn: function () { building(c, o.x - ex, o.y - ey, o.x + ex, o.y + ey, 0.5, { k: k, wall: ['#F4E9D8', '#F2DCC8', '#E8E4D8', '#F6E3C9'][o.hue % 4], kind: 'hip', roof: rf, window: '#9CC9D3', floors: 1, door: true }); } });
      } else raised.push({ z: depth(o.x, o.y), fn: function () { tree3d(c, o.x, o.y, o.r, o.kind, o.hue, k); } });
    });
    var isl = m.polys.find(function (P) { return P.kind === 'island'; });
    if (isl) raised.push({ z: depth(isl.cx, isl.cy), fn: function () {
      // the lighthouse: a striped tower with a lantern on top
      // seen from above: white and red rings round the lantern, with a long shadow
      var tp = cylinder(c, isl.cx, isl.cy, 0.45, 2.3, { k: k, side: '#F7FAFF', top: '#FFFFFF', bands: [[0.15, 0.32, '#E5483A'], [0.5, 0.67, '#E5483A'], [0.85, 1, '#E5483A']] });
      [[0.33, '#E5483A'], [0.21, '#FFFFFF'], [0.12, '#FFD45C']].forEach(function (r2) { c.beginPath(); c.arc(tp[0], tp[1], r2[0], 0, Math.PI * 2); c.fillStyle = r2[1]; c.fill(); c.strokeStyle = INK; c.lineWidth = 1.4 / k; c.stroke(); });
      var ln = tp;
      void ln;
    } });
    raised.sort(function (a2, b2) { return a2.z - b2.z; });
    raised.forEach(function (it) { it.fn(); });
    c.restore();
    // names on the docks, upright
    m.docks.forEach(function (d) {
      var dir = d.side ? -1 : 1;
      nameBoard(c, d.color, COL[d.color].name.toUpperCase(), SX(d.x - 2.5, d.base + dir * 0.3), SY(d.x - 2.5, d.base + dir * 0.3), k);
    });
  }

  // ---------- moving things ----------

  function drawWaves(c, now) {
    var m = S.w.map, t = now / 1000;
    world(c);
    c.strokeStyle = 'rgba(255,255,255,.28)'; c.lineWidth = 0.05; c.lineCap = 'round';
    for (var i = 0; i < 46; i++) {
      var x = (hash(i, 1, 2) * (m.W + 4) + t * 0.25) % (m.W + 4) - 2, y = hash(i, 3, 4) * m.H;
      if (m.isLand(x, y)) continue;
      var bob = Math.sin(t * 1.5 + i) * 0.08;
      c.beginPath(); c.moveTo(x - 0.35, y + bob); c.quadraticCurveTo(x, y - 0.18 + bob, x + 0.35, y + bob); c.stroke();
    }
    c.restore();
  }

  function shipHull(c, len, beam) {
    c.beginPath();
    c.moveTo(len / 2, 0);
    c.quadraticCurveTo(len * 0.36, -beam / 2, len * 0.16, -beam / 2);
    c.lineTo(-len / 2 + 0.06, -beam / 2);
    c.quadraticCurveTo(-len / 2, -beam / 2, -len / 2, -beam / 2 + 0.06);
    c.lineTo(-len / 2, beam / 2 - 0.06);
    c.quadraticCurveTo(-len / 2, beam / 2, -len / 2 + 0.06, beam / 2);
    c.lineTo(len * 0.16, beam / 2);
    c.quadraticCurveTo(len * 0.36, beam / 2, len / 2, 0);
    c.closePath();
  }

  // a hull outline in map units: pointed bow, square stern
  function hullPts(x, y, h, len, beam) {
    var loc = [[len / 2, 0], [len * 0.38, -beam * 0.36], [len * 0.2, -beam / 2], [-len / 2, -beam / 2], [-len / 2, beam / 2], [len * 0.2, beam / 2], [len * 0.38, beam * 0.36]];
    var c0 = Math.cos(h), s0 = Math.sin(h);
    return loc.map(function (p) { return [x + c0 * p[0] - s0 * p[1], y + s0 * p[0] + c0 * p[1]]; });
  }
  function at(x, y, h, lx, ly) { var c0 = Math.cos(h), s0 = Math.sin(h); return [x + c0 * lx - s0 * ly, y + s0 * lx + c0 * ly]; }
  function onTop(c, x, y, h, raise, fn) { var L = lift(raise); c.save(); c.translate(x + L[0], y + L[1]); c.rotate(h); fn(); c.restore(); }

  function drawShip(c, now) {
    var w = S.w, s = w.ship, len = s.spec.len, beam = s.spec.beam, k = S.view.k, px = 1 / k, hh = 0.22;
    world(c);
    prism(c, hullPts(s.x, s.y, s.h, len, beam), hh, { k: k, top: '#C8553D', wall: '#C8553D', shadowAlpha: 0.22 });
    // the deck inside the red hull
    var deckIn = hullPts(s.x, s.y, s.h, len * 0.9, beam * 0.74); c.beginPath(); deckIn.forEach(function (q, i) { if (i) c.lineTo(q[0], q[1]); else c.moveTo(q[0], q[1]); }); c.closePath(); c.fillStyle = '#E9E2D3'; c.fill();
    onTop(c, s.x, s.y, s.h, hh, function () {
      c.strokeStyle = '#C8553D'; c.lineWidth = 3 * px;
      c.beginPath(); c.moveTo(len * 0.42, 0); c.lineTo(len * 0.3, 0); c.stroke();
    });
    // the cargo: up to six crates standing on the deck
    for (var i = 0; i < 6; i++) {
      var cr = s.cargo[i];
      if (!cr) continue;
      var cp = at(s.x, s.y, s.h, len * 0.22 - (i % 3) * len * 0.17, (i < 3 ? -1 : 1) * beam * 0.19), Ld = lift(hh);
      prism(c, rectPts(cp[0] + Ld[0], cp[1] + Ld[1], len * 0.15, beam * 0.32, s.h), 0.17, { k: k, top: COL[cr.color].hex, wall: COL[cr.color].hex, shadow: false, lw: 1.2 });
    }
    // the bridge house at the stern, and its funnel on top
    var bp = at(s.x, s.y, s.h, -len * 0.37, 0), Lb = lift(hh);
    var bt = prism(c, rectPts(bp[0] + Lb[0], bp[1] + Lb[1], len * 0.2, beam * 0.72, s.h), 0.36, { k: k, top: '#FFFFFF', wall: '#E8ECF4', shadow: false, lw: 1.4 });
    onTop(c, bp[0], bp[1], s.h, hh + 0.36, function () { c.fillStyle = '#9CC9D3'; c.fillRect(len * 0.07, -beam * 0.3, len * 0.025, beam * 0.6); });
    var fp = at(s.x, s.y, s.h, -len * 0.42, 0), Lf = lift(hh + 0.36);
    cylinder(c, fp[0] + Lf[0], fp[1] + Lf[1], beam * 0.13, 0.22, { k: k, side: '#E5483A', top: '#3A3D48', shadow: false, lw: 1.2 });
    // the rudder angle at the stern, at the waterline
    var sp = at(s.x, s.y, s.h, -len / 2, 0), rp = at(s.x, s.y, s.h, -len / 2 - Math.cos(s.rudder * 0.6) * 0.2, -Math.sin(s.rudder * 0.6) * 0.2);
    c.strokeStyle = INK; c.lineWidth = 3 * px; c.beginPath(); c.moveTo(sp[0], sp[1]); c.lineTo(rp[0], rp[1]); c.stroke();
    void bt;
    c.restore();
  }

  function drawBoat(c, b, now) {
    var k = S.view.k, px = 1 / k;
    world(c);
    if (b.kind === 'sail') {
      prism(c, hullPts(b.x, b.y, b.h, b.len, b.beam), 0.12, { k: k, top: '#F7FAFF', wall: '#E8ECF4', shadowAlpha: 0.2 });
      // the sail stands up from the mast and swells with the wind
      // the sail from above, swelling with the wind, with its shadow on the water
      var lean = Math.sin(now / 900 + b.id) * 0.15;
      [[0.32, 0.22, 'rgba(20,40,70,.22)'], [0, 0, ['#FFC93C', '#E5483A', '#3D86F0'][b.look % 3]]].forEach(function (sl) {
        var m0 = at(b.x, b.y, b.h, b.len * 0.15, 0), m1 = at(b.x, b.y, b.h, -b.len * 0.35, 0.05), mc = at(b.x, b.y, b.h, -b.len * 0.1, b.beam * (0.9 + lean));
        c.beginPath(); c.moveTo(m0[0] + sl[0], m0[1] + sl[1]); c.lineTo(m1[0] + sl[0], m1[1] + sl[1]); c.quadraticCurveTo(mc[0] + sl[0], mc[1] + sl[1], m0[0] + sl[0], m0[1] + sl[1]);
        c.fillStyle = sl[2]; c.fill();
        if (!sl[0]) { c.strokeStyle = INK; c.lineWidth = 1.5 * px; c.stroke(); }
      });
    } else if (b.kind === 'ferry') {
      prism(c, rectPts(b.x, b.y, b.len, b.beam, b.h), 0.22, { k: k, top: '#F7FAFF', wall: '#3D86F0', shadowAlpha: 0.22 });
      onTop(c, b.x, b.y, b.h, 0.22, function () { c.fillStyle = '#3D86F0'; c.fillRect(-b.len / 2 + 0.06, -b.beam / 2 + 0.03, b.len - 0.12, 0.07); c.fillRect(-b.len / 2 + 0.06, b.beam / 2 - 0.1, b.len - 0.12, 0.07); });
      // cars on the car deck, and the passenger cabin up top
      for (var i = 0; i < 4; i++) {
        var cp = at(b.x, b.y, b.h, -b.len * 0.36 + i * b.len * 0.2 + b.len * 0.07, b.beam * 0.18), L1 = lift(0.22);
        car3d(c, cp[0] + L1[0], cp[1] + L1[1], b.h, b.len * 0.15, 0.2, ['#E07A5F', '#5B6BD9', '#81B29A', '#F4D35E'][i], k);
      }
      var cb = at(b.x, b.y, b.h, 0, -b.beam * 0.2), L2 = lift(0.22);
      prism(c, rectPts(cb[0] + L2[0], cb[1] + L2[1], b.len * 0.55, b.beam * 0.32, b.h), 0.2, { k: k, top: '#FFFFFF', wall: '#9CC9D3', shadow: false, lw: 1.3 });
    } else if (b.kind === 'fish') {
      prism(c, hullPts(b.x, b.y, b.h, b.len, b.beam), 0.16, { k: k, top: '#2F7D4A', wall: '#2F7D4A', shadowAlpha: 0.2 });
      var fd = hullPts(b.x, b.y, b.h, b.len * 0.86, b.beam * 0.7); c.beginPath(); fd.forEach(function (q, i) { if (i) c.lineTo(q[0], q[1]); else c.moveTo(q[0], q[1]); }); c.closePath(); c.fillStyle = '#C9B99A'; c.fill();
      var wh = at(b.x, b.y, b.h, b.len * 0.12, 0), L3 = lift(0.16);
      prism(c, rectPts(wh[0] + L3[0], wh[1] + L3[1], b.len * 0.25, b.beam * 0.6, b.h), 0.26, { k: k, top: '#FFFFFF', wall: '#E8ECF4', shadow: false, lw: 1.3 });
      // the net boom at the stern
      var nb = at(b.x, b.y, b.h, -b.len * 0.3, 0), Lm = lift(0.7);
      c.beginPath(); c.moveTo(nb[0] + L3[0], nb[1] + L3[1]); c.lineTo(nb[0] + Lm[0], nb[1] + Lm[1]); c.strokeStyle = INK; c.lineWidth = 2 * px; c.stroke();
      c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 1 * px;
      [-1, 1].forEach(function (sd) { var ne = at(b.x, b.y, b.h, -b.len * 0.5, sd * b.beam * 0.4); c.beginPath(); c.moveTo(nb[0] + Lm[0], nb[1] + Lm[1]); c.lineTo(ne[0], ne[1]); c.stroke(); });
    } else {
      prism(c, hullPts(b.x, b.y, b.h, b.len, b.beam), 0.14, { k: k, top: '#FFD1E2', wall: '#E8577E', shadowAlpha: 0.2 });
      onTop(c, b.x, b.y, b.h, 0.14, function () {
        c.beginPath(); c.arc(-b.len * 0.05, 0, b.beam * 0.28, 0, Math.PI * 2); c.fillStyle = '#9CC9D3'; c.fill(); c.strokeStyle = INK; c.lineWidth = 1.2 * px; c.stroke();
        c.beginPath(); c.arc(-b.len * 0.3, -b.beam * 0.4, b.beam * 0.28, 0, Math.PI * 2); c.fillStyle = '#E8577E'; c.fill(); c.stroke();
      });
    }
    c.restore();
  }

  function drawWake(c, now) {
    var w = S.w;
    S.wake = S.wake.filter(function (p) { return now - p.t < p.life; });
    world(c);
    S.wake.forEach(function (p) {
      var q = (now - p.t) / p.life;
      c.beginPath(); c.arc(p.x + p.dx * q, p.y + p.dy * q, p.r * (1 + q * 1.5), 0, Math.PI * 2);
      c.fillStyle = 'rgba(255,255,255,' + (0.6 * (1 - q)) + ')'; c.fill();
    });
    c.restore();
    void w;
  }
  function emitWake(now, dt) {
    var w = S.w, s = w.ship;
    function puff(x, y, h, v, len, beam) {
      if (Math.abs(v) < 0.15) return;
      var bx = x - Math.cos(h) * len / 2 * Math.sign(v), by = y - Math.sin(h) * len / 2 * Math.sign(v);
      [-1, 1].forEach(function (sd) {
        var nx = -Math.sin(h) * sd, ny = Math.cos(h) * sd;
        S.wake.push({ x: bx + nx * beam * 0.4, y: by + ny * beam * 0.4, dx: nx * 0.45, dy: ny * 0.45, r: 0.07 + Math.abs(v) * 0.03, t: now, life: 1600 });
      });
    }
    S.wakeT = (S.wakeT || 0) - dt;
    if (S.wakeT > 0) return;
    S.wakeT = 0.12;
    puff(s.x, s.y, s.h, s.v, s.spec.len, s.spec.beam);
    w.boats.forEach(function (b) { puff(b.x, b.y, b.h, b.v, b.len, b.beam); });
  }

  // where your ship is heading: a dotted line with ghost hulls, red from the first trouble
  function drawForecast(c) {
    var w = S.w, s = w.ship, f = w.forecast(E.FORECAST, 0.25), k = S.view.k, px = 1 / k;
    var hitT = f.hit ? f.hit.t : Infinity;
    world(c);
    c.lineWidth = 3 * px; c.setLineDash([0.18, 0.16]);
    var prev = [s.x, s.y];
    f.pts.forEach(function (p) {
      c.beginPath(); c.moveTo(prev[0], prev[1]); c.lineTo(p.x, p.y);
      c.strokeStyle = p.t >= hitT ? 'rgba(229,72,58,.95)' : 'rgba(255,255,255,.9)'; c.stroke();
      prev = [p.x, p.y];
    });
    c.setLineDash([]);
    f.pts.forEach(function (p) {
      if (Math.abs(p.t % 2) > 0.01) return;
      c.save(); c.translate(p.x, p.y); c.rotate(p.h);
      shipHull(c, s.spec.len, s.spec.beam);
      c.strokeStyle = p.t >= hitT ? 'rgba(229,72,58,.85)' : 'rgba(255,255,255,.55)'; c.lineWidth = 1.6 * px; c.stroke();
      c.restore();
    });
    // the robot boats' next few seconds, faintly
    w.boats.forEach(function (b) {
      if (b.v < 0.05) return;
      c.strokeStyle = 'rgba(29,26,51,.35)'; c.lineWidth = 2 * px; c.setLineDash([0.12, 0.14]);
      c.beginPath(); c.moveTo(b.x, b.y); c.lineTo(b.x + Math.cos(b.h) * b.v * 3, b.y + Math.sin(b.h) * b.v * 3); c.stroke(); c.setLineDash([]);
    });
    c.restore();
    if (f.hit) {
      var hp = f.pts.find(function (p) { return p.t >= hitT; });
      if (hp) {
        var x = SX(hp.x, hp.y), y = SY(hp.x, hp.y);
        c.beginPath(); c.arc(x, y, 0.32 * k, 0, Math.PI * 2); c.fillStyle = '#E5483A'; c.fill(); c.strokeStyle = INK; c.lineWidth = 2; c.stroke();
        c.fillStyle = '#fff'; c.font = 'bold ' + Math.round(0.45 * k) + 'px "Atkinson Hyperlegible", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('!', x, y + 1);
      }
    }
    return f;
  }

  function drawBridge(c, now) {
    var w = S.w, b = w.map.bridge, k = S.view.k, px = 1 / k;
    if (!b) return;
    world(c);
    // a tower at each end of the gap, then two leaves that swing up from their hinges
    var deckH = 0.25, up = b.arm * b.gap * 0.95, run = b.gap * (1 - 0.8 * b.arm);
    [-1, 1].forEach(function (sd) {
      var hy = b.y + sd * b.gap;
      building(c, b.x + b.hw - 0.05, hy + (sd > 0 ? 0.05 : -0.75), b.x + b.hw + 0.65, hy + (sd > 0 ? 0.75 : -0.05), 0.9, { k: k, wall: '#C9CED8', tint: '#AEB4C2', window: '#9CC9D3', floors: 2, units: false });
    });
    [-1, 1].forEach(function (sd) {
      var hinge = b.y + sd * b.gap, end = hinge - sd * run, Lh = lift(deckH), Le = lift(deckH + up);
      var deck = [[b.x - b.hw + Lh[0], hinge + Lh[1]], [b.x + b.hw + Lh[0], hinge + Lh[1]], [b.x + b.hw + Le[0], end + Le[1]], [b.x - b.hw + Le[0], end + Le[1]]];
      // its shadow on the water
      c.beginPath(); c.moveTo(b.x - b.hw + 0.1, hinge); c.lineTo(b.x + b.hw + 0.1, hinge); c.lineTo(b.x + b.hw + 0.1 + up * 0.4, end + 0.1); c.lineTo(b.x - b.hw + 0.1 + up * 0.4, end + 0.1); c.closePath(); c.fillStyle = 'rgba(20,40,70,.3)'; c.fill();
      // the leaf's side, then its deck with the road
      c.beginPath(); c.moveTo(b.x + b.hw, hinge); c.lineTo(b.x + b.hw + Lh[0], hinge + Lh[1]); c.lineTo(b.x + b.hw + Le[0], end + Le[1]); c.lineTo(b.x + b.hw + Le[0] - Lh[0], end + Le[1] - Lh[1]); c.closePath(); c.fillStyle = '#7D8494'; c.fill(); c.strokeStyle = INK; c.lineWidth = 1.4 * px; c.stroke();
      c.beginPath(); deck.forEach(function (q, i) { if (i) c.lineTo(q[0], q[1]); else c.moveTo(q[0], q[1]); }); c.closePath(); c.fillStyle = '#9AA0AD'; c.fill(); c.strokeStyle = INK; c.lineWidth = 2 * px; c.stroke();
      c.beginPath(); c.moveTo(b.x - 0.55 + Lh[0], hinge + Lh[1]); c.lineTo(b.x + 0.55 + Lh[0], hinge + Lh[1]); c.lineTo(b.x + 0.55 + Le[0], end + Le[1]); c.lineTo(b.x - 0.55 + Le[0], end + Le[1]); c.closePath(); c.fillStyle = '#5E6372'; c.fill();
      // the striped tip, flashing while the bridge moves or stands open
      c.strokeStyle = (Math.floor(now / 300) % 2 && (b.arm > 0 || b.up)) ? '#FF3B30' : '#fff'; c.lineWidth = 0.12;
      c.beginPath(); c.moveTo(b.x - b.hw + Le[0], end + Le[1]); c.lineTo(b.x + b.hw + Le[0], end + Le[1]); c.stroke();
    });
    // cars on the road, up on the deck
    w.cars.forEach(function (car) {
      var Lc = lift(0.25);
      car3d(c, b.x - car.dir * 0.27 + Lc[0], car.y + Lc[1], car.dir > 0 ? Math.PI / 2 : -Math.PI / 2, 0.8, 0.4, ['#F2F2F2', '#5B6BD9', '#E07A5F', '#81B29A', '#3D405B', '#F4D35E'][car.look], k);
    });
    c.restore();
    // the bridge button and its waiting drivers
    var bx = SX(b.x + b.hw + 0.9, b.y), by = SY(b.x + b.hw + 0.9, b.y), hov = S.hover && S.hover.kind === 'bridge';
    c.beginPath(); c.arc(bx, by, 0.4 * k + (hov ? 2 : 0), 0, Math.PI * 2); c.fillStyle = b.up ? '#E5483A' : '#fff'; c.fill(); c.strokeStyle = INK; c.lineWidth = 2; c.stroke();
    c.save(); c.translate(bx, by); c.strokeStyle = b.up ? '#fff' : INK; c.lineWidth = Math.max(2, 0.08 * k); c.lineCap = 'round';
    c.beginPath(); c.moveTo(-0.22 * k, 0.12 * k); c.lineTo(0, -0.14 * k); c.lineTo(0.22 * k, 0.12 * k); if (!b.up) { c.moveTo(-0.22 * k, 0); c.lineTo(0.22 * k, 0); } c.stroke(); c.restore();
    keyBadge(c, bx + 0.55 * k, by - 0.5 * k, 'R', k);
    if (b.waitT > cfg().bridgeWait * 0.4) {
      var q = Math.min(1, b.waitT / cfg().bridgeWait), wx = bx, wy = by + 0.75 * k;
      c.beginPath(); c.arc(wx, wy, 0.22 * k, -Math.PI / 2, -Math.PI / 2 + q * Math.PI * 2); c.lineTo(wx, wy); c.closePath(); c.fillStyle = q > 0.75 ? '#E5483A' : '#FF9F1C'; c.fill();
      c.beginPath(); c.arc(wx, wy, 0.22 * k, 0, Math.PI * 2); c.strokeStyle = INK; c.lineWidth = 1.5; c.stroke();
    }
  }

  function drawDocks(c, now) {
    var w = S.w, m = w.map, k = S.view.k, s = w.ship;
    world(c);
    m.docks.forEach(function (d) {
      var dir = d.side ? -1 : 1, px = 1 / k;
      // crates waiting on the quay, stacked two deep
      d.crates.forEach(function (cr, i) {
        var col = i % 4, row = Math.floor(i / 4), x = d.x - 1.45 + col * 0.42, y = d.base + dir * (0.35 + row * 0.44);
        var left = 1 - (w.t - cr.born) / cr.patience, wob = left < 0.2 ? Math.sin(now / 80 + i) * 0.03 : 0, Lq = lift(0.18);
        var bx2 = x + 0.18 + wob + Lq[0], by2 = y + Lq[1];
        prism(c, rectPts(bx2, by2, 0.36, 0.36, 0), 0.3, { k: k, top: COL[cr.color].hex, wall: COL[cr.color].hex, ink: left < 0.25 ? '#E5483A' : INK, lw: left < 0.25 ? 2.5 : 1.3, shadowAlpha: 0.2 });
      });
      // the crane: a gantry over the quay, swinging out while the ship is alongside
      var swing = s.dock === d.id ? 0.5 + 0.5 * Math.sin(now / 400) : 0;
      var cy = d.y - dir * (1.4 - swing * 0.5);
      // the crane: two legs on the quay, a yellow boom up high reaching out over the water, and its hook
      var Lg = lift(0.18), legY = d.base + dir * 0.6, craneH = 1.25;
      [0.6, 1.4].forEach(function (lx) { cylinder(c, d.x + lx + Lg[0], legY + Lg[1], 0.07, craneH, { k: k, side: '#FFC93C', lw: 1.2 }); });
      var Lt = lift(0.18 + craneH), reach = legY + dir * (1.4 + swing * 0.6);
      prism(c, [[d.x + 0.5 + Lt[0], legY - dir * 0.2 + Lt[1]], [d.x + 1.5 + Lt[0], legY - dir * 0.2 + Lt[1]], [d.x + 1.5 + Lt[0], reach + Lt[1]], [d.x + 0.5 + Lt[0], reach + Lt[1]]].map(function (q) { return q; }), 0.14, { k: k, top: '#FFC93C', wall: '#E0A82E', shadow: false, lw: 1.4 });
      var hookTop = [d.x + 1.0 + Lt[0], reach - dir * 0.15 + Lt[1]], hookLow = [d.x + 1.0 + Lg[0] * 1.6, reach - dir * 0.15 + Lg[1] * 1.6];
      c.beginPath(); c.moveTo(hookTop[0], hookTop[1]); c.lineTo(hookLow[0], hookLow[1]); c.strokeStyle = INK; c.lineWidth = 2 * px; c.stroke();
      c.beginPath(); c.arc(hookLow[0], hookLow[1], 0.08, 0, Math.PI * 2); c.fillStyle = INK; c.fill();
      void cy;
      // the berth: where to stop alongside
      c.beginPath(); c.arc(d.x, d.y, E.BERTH, 0, Math.PI * 2);
      c.strokeStyle = s.dock === d.id ? 'rgba(47,191,113,.9)' : 'rgba(255,255,255,.5)'; c.lineWidth = 2 * px; c.setLineDash([0.2, 0.18]); c.stroke(); c.setLineDash([]);
    });
    c.restore();
    // the lighthouse beam sweeps round
    var isl = m.polys.find(function (P) { return P.kind === 'island'; });
    if (isl) {
      var lt = lift(2.2), a = now / 1100, x = SX(isl.cx + lt[0], isl.cy + lt[1]), y = SY(isl.cx + lt[0], isl.cy + lt[1]);
      c.beginPath(); c.moveTo(x, y); c.arc(x, y, 3 * k, a, a + 0.35); c.closePath(); c.fillStyle = 'rgba(255,240,170,.16)'; c.fill();
    }
  }

  function drawPops(c, now) {
    S.pops = S.pops.filter(function (p) { return now - p.t < 1200; });
    S.pops.forEach(function (p) {
      var q = (now - p.t) / 1200, x = SX(p.x, p.y), y = SY(p.x, p.y) - q * 30;
      c.globalAlpha = 1 - q;
      c.font = '20px Staatliches, "Arial Narrow", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.lineWidth = 4; c.strokeStyle = INK; c.strokeText(p.text, x, y);
      c.fillStyle = p.color; c.fillText(p.text, x, y);
      c.globalAlpha = 1;
    });
  }
  function drawCrash(c, now) {
    var w = S.w;
    if (!w.crash) return;
    var k = S.view.k, x = SX(w.crash.x, w.crash.y), y = SY(w.crash.x, w.crash.y), q = Math.min(1, (now - S.crashAt) / 500);
    c.save(); c.translate(x, y); c.rotate(now / 900);
    c.beginPath();
    for (var i = 0; i < 16; i++) { var a = i * Math.PI / 8, r = (i % 2 ? 0.8 : 1.7) * k * (0.4 + 0.6 * q); if (i) c.lineTo(Math.cos(a) * r, Math.sin(a) * r); else c.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
    c.closePath(); c.fillStyle = '#FFD45C'; c.fill(); c.strokeStyle = INK; c.lineWidth = 3; c.stroke();
    c.rotate(-now / 900);
    c.font = Math.round(0.75 * k) + 'px Staatliches, "Arial Narrow", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillStyle = '#E5483A'; c.fillText('CRASH!', 0, 2);
    c.restore();
  }

  function draw(now) {
    if (!S.w || !S.fit) return;
    var dpr = window.devicePixelRatio || 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(stat, 0, 0);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawWaves(ctx, now);
    drawWake(ctx, now);
    drawDocks(ctx, now);
    drawBridge(ctx, now);
    if (!S.w.over) S.lastForecast = drawForecast(ctx);
    S.w.boats.forEach(function (b) { drawBoat(ctx, b, now); });
    drawShip(ctx, now);
    var s = S.w.ship, k = S.view.k;
    if (S.w.cfg.boats.indexOf('speed') >= 0) {
      var sp = S.w.boats.find(function (b) { return b.kind === 'speed'; });
      if (sp) tag(ctx, 'EDITH', SX(sp.x, sp.y), SY(sp.x, sp.y) - 0.7 * k, k, '#E8577E');
    }
    if (s.bumpT > 1.8) tag(ctx, 'BUMP!', SX(s.x, s.y), SY(s.x, s.y) - 0.9 * k, k, '#FF9F1C');
    drawPops(ctx, now);
    drawCrash(ctx, now);
  }

  // ---------- panel ----------

  function buildPanel() {
    var Lv = L(), T = TALK[S.level];
    $('#bot-name').textContent = Lv.name;
    $('#bot-rank').textContent = T.rank;
    $('#strikes').innerHTML = Array.apply(null, Array(E.STRIKES)).map(function () { return '<span class="strike">' + strikeIcon() + '</span>'; }).join('');
    $('#btn-bridge').hidden = !cfg().bridge;
    var best = A.progress(GAME)[S.level];
    $('#best').textContent = best ? 'Your best against ' + Lv.name + ': ' + best.text + '.' : 'No shift against ' + Lv.name + ' yet. Stars at ' + E.STARS.join(', ') + ' crates.';
    S.text = {};
  }
  function renderHud() {
    var w = S.w, s = w.ship;
    K.setText('#delivered', String(w.delivered));
    K.setText('#time', mmss(w.t));
    K.setHtml('#by-color', w.colors.map(function (c) { return '<span class="bc">' + chip(c) + '<b>' + (w.byColor[c] || 0) + '</b></span>'; }).join(''));
    var used = $('#strikes').children;
    for (var i = 0; i < used.length; i++) used[i].classList.toggle('used', i < w.strikes);
    var m = w.mission;
    K.setHtml('#mission', '<span class="mission-head">Mission ' + m.n + '</span>' + Object.keys(m.need).map(function (c) {
      var got = m.got[c], need = m.need[c];
      return '<div class="mrow' + (got >= need ? ' done' : '') + '">' + chip(c) + '<span>' + COL[c].name + ' crates to the ' + COL[c].name + ' dock</span><b>' + got + '/' + need + '</b><i style="width:' + Math.round(100 * got / need) + '%"></i></div>';
    }).join(''));
    // the helm: rudder needle and engine telegraph
    $('#rudder-needle').style.transform = 'rotate(' + (s.rudder * 35) + 'deg)';
    K.setText('#rudder-text', Math.abs(s.rudder) < 0.05 ? 'Rudder centred' : (s.rudder < 0 ? 'Port ' : 'Starboard ') + Math.round(Math.abs(s.rudder) * 35) + '°');
    Array.prototype.forEach.call(document.querySelectorAll('.tele i'), function (el, k) { el.classList.toggle('on', k === s.tele); });
    K.setText('#tele-text', TELE[s.tele] + ' · ' + Math.abs(s.v).toFixed(1) + ' knots');
    K.setHtml('#cargo', s.cargo.length ? s.cargo.map(function (c) { return chip(c.color); }).join('') + '<span>' + s.cargo.length + '/' + E.SHIP.cap + '</span>' : '<span>Empty hold</span>');
    if (cfg().bridge) K.setText('#btn-bridge', w.map.bridge.up ? 'Lower the bridge (R)' : 'Raise the bridge (R)');
    A.music.intensity(Math.min(0.95, 0.35 + w.waiting() / 25 + w.strikes * 0.08));
  }

  // ---------- playing ----------

  function newMap() {
    A.closeModal(true);
    var f = K.fitRect(stage, panel), asp = (f.x1 - f.x0) / Math.max(1, f.y1 - f.y0);
    S.fit = f;
    S.w = new E.World(S.level, (Math.random() * 1e9) >>> 0, asp < 0.9 ? 1 / asp : asp);
    S.running = false; S.paused = false; S.endShown = false; S.pops = []; S.wake = []; S.keys = {};
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
    K.banner('Cast off! Watch your forecast.', false, 1800);
    sfx('horn');
  }
  function live() { return S.w && !S.w.over && !A.isBoss() && !A.modalOpen() && !S.paused; }
  function cmd(fn) { if (!live()) return; if (!S.running) start(); fn(); S.w.events.forEach(handle); S.w.events.length = 0; renderHud(); }

  function handle(ev) {
    var w = S.w, T = TALK[S.level], now = performance.now();
    switch (ev.type) {
      case 'telegraph': sfx('telegraph'); break;
      case 'rudder': sfx('creak'); break;
      case 'dock': sfx('dock'); break;
      case 'load': sfx('crane'); break;
      case 'deliver': {
        sfx('coin'); sfx('crane');
        var d = w.map.docks[ev.dock];
        S.pops.push({ text: '+1', x: d.x, y: d.y, t: now, color: COL[ev.color].hex });
        break;
      }
      case 'bump': sfx(ev.hard ? 'crunch' : 'bump'); break;
      case 'touch': sfx('touch'); break;
      case 'bridge-up': case 'bridge-down': sfx('bridge'); break;
      case 'honk': sfx('honk'); break;
      case 'mission':
        A.jingle('good');
        K.banner('Mission ' + ev.n + ' done!' + (ev.back ? ' One complaint forgiven.' : ''), false, 2600);
        if (Math.random() < 0.7) K.say(K.pick(T.mission), 'annoyed');
        break;
      case 'strike': {
        var msg = ev.why === 'crate' ? 'A ' + COL[ev.color].name.toLowerCase() + ' crate waited too long and went by road!'
          : ev.why === 'bridge' ? 'The drivers waited too long at the bridge!'
            : ev.why === 'full' ? 'The ' + COL[w.map.docks[ev.dock].color].name + ' dock is full and turned a crate away!'
            : 'Crunch! The ship hit the shore hard.';
        A.jingle('bad');
        K.banner(msg + ' (' + ev.strikes + ' of ' + E.STRIKES + ')', true, 2600);
        K.say(K.pick(T.strike), 'happy');
        break;
      }
      case 'end':
        if (ev.reason === 'crash') { S.crashAt = now; sfx('crash'); K.banner(ev.crash.kind === 'bridge' ? 'Crash! The bridge was down.' : 'Crash! You rammed a boat.', true, 4000); K.say(K.pick(T.crash), 'surprised'); }
        sc.timeout(endGame, ev.reason === 'crash' ? 1600 : 700);
        break;
    }
  }

  // engine chugging with the telegraph, the sea, gulls, bridge bells, boats nearby
  function ambient(dt) {
    var w = S.w, s = w.ship;
    if (!A.soundOn() || A.isBoss() || !S.running || w.over) { engine.set(0); sea.set(0); return; }
    var rpm = Math.abs(s.tele - 2);
    engine.set(0.02 + 0.02 * rpm + 0.012 * Math.abs(s.v), 90 + 30 * rpm);
    sea.set(0.012);
    S.chugT -= dt;
    if (S.chugT <= 0) { S.chugT = rpm ? 0.5 - rpm * 0.12 : 0.9; A.noise(0.09, 0.012 + 0.008 * rpm, 0, 160, 1.2); }
    S.gullT -= dt;
    if (S.gullT <= 0) { S.gullT = 6 + Math.random() * 10; sfx('gull'); }
    var b = w.map.bridge;
    if (b && b.arm > 0 && b.arm < 1) { S.bellT -= dt; if (S.bellT <= 0) { S.bellT = 0.5; sfx('bell'); } }
    w.boats.forEach(function (bt) {
      var d = Math.hypot(bt.x - s.x, bt.y - s.y);
      bt.hornT = (bt.hornT || 0) - dt;
      if (d < 3.4 && bt.hornT <= 0) { bt.hornT = 6; sfx(bt.kind === 'speed' ? 'speed' : bt.kind === 'ferry' ? 'ferry' : 'touch'); }
    });
  }

  function loop(now) {
    sc.raf(loop);
    var w = S.w, dt = S.lastFrame ? Math.min(0.1, (now - S.lastFrame) / 1000) : 0;
    S.lastFrame = now;
    if (w && S.running && !w.over && !(S.paused || A.isBoss() || A.modalOpen() || document.hidden)) {
      // held rudder keys and buttons
      var dir = (S.keys.port ? -1 : 0) + (S.keys.star ? 1 : 0);
      if (dir !== w.ship.rudderIn) { w.setRudder(dir); if (dir) sfx('creak'); }
      S.acc += dt;
      while (S.acc >= E.DT && !w.over) { w.step(); w.events.forEach(handle); w.events.length = 0; S.acc -= E.DT; }
      renderHud(); ambient(dt); emitWake(now, dt);
    } else { S.acc = 0; engine.set(0); sea.set(0); }
    $('#banner').hidden = now > S.bannerUntil;
    $('#btn-pause').textContent = S.paused ? 'Resume (P)' : 'Pause (P)';
    $('#btn-pause').disabled = !S.running || !w || w.over;
    draw(now);
  }

  function endGame() {
    var w = S.w, Lv = L(), T = TALK[S.level];
    if (S.endShown) return;
    S.endShown = true; S.running = false; engine.set(0); sea.set(0);
    var stars = w.stars(), d = w.delivered;
    A.account.submit(GAME, S.level, A.points(S.level, w.points()), d + ' crates in ' + mmss(w.t));
    A.music.intensity(0.35);
    var rec = A.record(GAME, S.level, { stars: stars, score: d, lowerIsBetter: false, text: d + ' crates' });
    bar.refresh(); buildPanel(); renderHud();
    A.jingle(stars ? 'win' : 'lose');
    if (w.reason !== 'crash') K.say(K.pick(T.end), stars ? 'annoyed' : 'happy');
    var next = ORDER[ORDER.indexOf(S.level) + 1], buttons = [{ label: 'New harbor', kind: 'main', onClick: newMap }];
    if (stars && next) buttons.push({ label: 'Next boss: ' + A.LEVEL_MAP[next].name, kind: 'line', onClick: function () { S.level = next; bar.setLevel(next); newMap(); } });
    var note = rec.better ? (rec.prev ? 'New best against ' + Lv.name + '!' : 'Your first shift against ' + Lv.name + ' is on the books.') : 'Your best: ' + rec.prev.text + '.';
    var why = w.reason === 'crash' ? (w.crash.kind === 'bridge' ? 'The ship hit the lowered bridge.' : 'The ship rammed a boat.') : 'Five complaints closed the harbor.';
    var colors = w.colors.map(function (c) { return '<span class="bc">' + chip(c, 16) + ' ' + COL[c].name + ' <b>' + (w.byColor[c] || 0) + '</b></span>'; }).join('');
    A.modal({
      title: stars === 3 ? 'Harbor legend!' : stars ? 'Safe in port!' : w.reason === 'crash' ? 'Crash!' : 'The harbor is closed',
      tone: stars ? 'win' : 'lose',
      html: '<p class="lead">You delivered <strong>' + d + ' crate' + (d === 1 ? '' : 's') + '</strong> and finished ' + w.missionsDone + ' mission' + (w.missionsDone === 1 ? '' : 's') + ' in a shift of ' + mmss(w.t) + '.</p>' +
        '<p class="lc-colors">' + colors + '</p><p>' + why + '</p>' + A.stars(stars) + '<p><strong>' + note + '</strong></p>' +
        (stars < 3 ? '<p class="soft">Stars at ' + E.STARS.join(', ') + ' crates. Tip: slow down early. The ship keeps going long after you stop the engine, and the forecast shows where it will end up.</p>' : ''),
      buttons: buttons,
      link: { label: 'Close and look at the harbor' }
    });
  }

  function openHelp() {
    var rows = ORDER.map(function (id) {
      var Lv = A.LEVEL_MAP[id], c = E.LEVELS[id];
      return '<div><dt>' + Lv.name + ', ' + Lv.rank.toLowerCase() + '</dt><dd>' + c.docks + ' docks' + (c.bridge ? ', a drawbridge' : '') + (c.big ? ', the big ship' : '') + '. ' + TALK[id].blurb + '</dd></div>';
    }).join('');
    A.modal({
      title: 'How to play',
      wide: true,
      html: '<p>You are the captain of a little cargo ship in a brand new harbor. Colored crates wait on the docks for a ship to take them to the dock of their color.</p>' +
        '<ol><li><strong>Steering:</strong> hold port or starboard (A and D, or the arrow keys) to swing the rudder; it stays where you leave it. C centres it. The ship turns gradually, and only when it is moving (a small thruster turns it slowly when it is nearly still).</li>' +
        '<li><strong>Engine:</strong> W and S move the engine telegraph through full astern, half astern, stop, half ahead and full ahead. Space stops the engine. The ship speeds up and slows down gradually, so stop early.</li>' +
        '<li><strong>Forecast:</strong> the dotted line and ghost hulls show where the ship will be over the next eight seconds with the controls as they are. It turns red where trouble starts.</li>' +
        '<li><strong>Docks:</strong> come to a stop inside a dock\'s dashed circle. The crane unloads crates for that dock, then loads waiting crates (six at most).</li>' +
        '<li><strong>Bridge:</strong> raise it (R, or the round button) to pass, then lower it again. Drivers complain if they wait too long, and hitting a lowered bridge is a crash.</li>' +
        '<li><strong>Complaints:</strong> a crate left waiting too long, drivers kept at the bridge, or hitting the shore hard. Five close the harbor. Ramming a boat ends the shift at once; a gentle touch is only a nudge. Finishing a mission takes a complaint away.</li></ol>' +
        '<h3>Harbor bosses</h3><dl>' + rows + '</dl>' +
        '<h3>Keys</h3><table class="keys"><tr><td><kbd>A</kbd> <kbd>D</kbd> or <kbd>←</kbd> <kbd>→</kbd></td><td>Rudder to port or starboard (hold)</td></tr><tr><td><kbd>C</kbd></td><td>Centre the rudder</td></tr>' +
        '<tr><td><kbd>W</kbd> <kbd>S</kbd> or <kbd>↑</kbd> <kbd>↓</kbd></td><td>Engine telegraph ahead or astern</td></tr><tr><td><kbd>Space</kbd></td><td>Stop the engine</td></tr>' +
        '<tr><td><kbd>R</kbd></td><td>Raise or lower the bridge</td></tr><tr><td><kbd>H</kbd></td><td>Ship\'s horn</td></tr><tr><td><kbd>F</kbd></td><td>Full screen</td></tr><tr><td><kbd>Enter</kbd></td><td>Start</td></tr><tr><td><kbd>P</kbd></td><td>Pause</td></tr><tr><td><kbd>N</kbd></td><td>New harbor</td></tr>' +
        '<tr><td><kbd>M</kbd></td><td>Music on or off</td></tr><tr><td><kbd>B</kbd></td><td>Panic button</td></tr></table>',
      buttons: [{ label: 'Anchors aweigh!', kind: 'main' }]
    });
  }

  sc.add(function () { setLift(); });

  var bar = A.mountBar({
    el: $('#bar'), game: GAME, title: 'Harbor Master', tagline: 'Steer a slow ship through a busy harbor. Trust the forecast.',
    level: S.level, levelLabel: 'Boss',
    canSwitch: function () { return S.running && !S.w.over ? 'This shift will be abandoned.' : true; },
    onLevel: function (id) { S.level = id; newMap(); },
    onHelp: openHelp
  });
  sc.add(bar.destroy);

  // ---------- helm, pointer and keys ----------

  function hold(id, key) {
    var el = $(id);
    function on(e) { e.preventDefault(); if (!live()) return; if (!S.running) start(); S.keys[key] = true; }
    function off() { S.keys[key] = false; }
    el.addEventListener('pointerdown', on);
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (t) { el.addEventListener(t, off); });
  }
  hold('#btn-port', 'port');
  hold('#btn-star', 'star');
  $('#btn-center').addEventListener('click', function () { cmd(function () { S.w.centerRudder(); }); });
  $('#btn-ahead').addEventListener('click', function () { cmd(function () { S.w.telegraph(1); }); });
  $('#btn-astern').addEventListener('click', function () { cmd(function () { S.w.telegraph(-1); }); });
  $('#btn-stop').addEventListener('click', function () { cmd(function () { S.w.stopEngine(); }); });
  $('#btn-bridge').addEventListener('click', function () { cmd(function () { S.w.toggleBridge(); }); });
  $('#btn-horn').addEventListener('click', function () { sfx('horn'); });
  Array.prototype.forEach.call(document.querySelectorAll('.tele i'), function (el, k) {
    el.addEventListener('click', function () { cmd(function () { S.w.telegraph(k - S.w.ship.tele); }); });
  });

  function toMap(e) {
    var r = cvs.getBoundingClientRect(), v = S.view, sx = (e.clientX - r.left - v.ox) / v.k, sy = (e.clientY - r.top - v.oy) / v.k;
    return v.rot ? [sy, S.w.map.H - sx] : [sx, sy];
  }
  function hitTest(x, y) {
    var b = S.w.map.bridge;
    if (b && Math.hypot(x - (b.x + b.hw + 0.9), y - b.y) < 0.7) return { kind: 'bridge' };
    return null;
  }
  cvs.addEventListener('pointerdown', function (e) {
    if (!S.w || A.isBoss()) return;
    var p = toMap(e), h = hitTest(p[0], p[1]);
    if (h) { e.preventDefault(); cmd(function () { S.w.toggleBridge(); }); }
  });
  cvs.addEventListener('pointermove', function (e) {
    if (!S.w || e.pointerType === 'touch') return;
    var p = toMap(e); S.hover = hitTest(p[0], p[1]);
    cvs.style.cursor = S.hover ? 'pointer' : 'default';
  });
  $('#btn-start').addEventListener('click', start);
  $('#btn-pause').addEventListener('click', function () { if (!(S.running && !S.w.over)) return; S.paused = !S.paused; $('#veil').hidden = !S.paused; });
  $('#btn-new').addEventListener('click', function () {
    if (!(S.running && !S.w.over)) return newMap();
    A.confirm({ title: 'New harbor?', text: 'This shift will be abandoned and a brand new harbor is drawn.', yes: 'New harbor', no: 'Keep sailing', onYes: newMap });
  });
  var toggleFull = K.fullscreen($('#btn-full'), layout);

  sc.on(document, 'keydown', function (e) {
    if (e.ctrlKey || e.metaKey || e.altKey || A.modalOpen()) return;
    var tg = (e.target && e.target.tagName) || '';
    if (tg === 'INPUT' || tg === 'TEXTAREA' || !S.w) return;
    var k = e.key.toLowerCase();
    if (k === 'a' || k === 'arrowleft') { e.preventDefault(); if (live()) { if (!S.running) start(); S.keys.port = true; } return; }
    if (k === 'd' || k === 'arrowright') { e.preventDefault(); if (live()) { if (!S.running) start(); S.keys.star = true; } return; }
    if (e.repeat) return;
    if (k === 'w' || k === 'arrowup') { e.preventDefault(); cmd(function () { S.w.telegraph(1); }); }
    else if (k === 's' || k === 'arrowdown') { e.preventDefault(); cmd(function () { S.w.telegraph(-1); }); }
    else if (k === ' ') { if (tg === 'BUTTON') return; e.preventDefault(); cmd(function () { S.w.stopEngine(); }); }
    else if (k === 'c') cmd(function () { S.w.centerRudder(); });
    else if (k === 'r') cmd(function () { S.w.toggleBridge(); });
    else if (k === 'h') sfx('horn');
    else if (k === 'f') toggleFull();
    else if (k === 'enter' && tg !== 'BUTTON') { e.preventDefault(); start(); }
    else if (k === 'p') $('#btn-pause').click();
    else if (k === 'n') $('#btn-new').click();
    else if (k === '?') openHelp();
  });
  sc.on(document, 'keyup', function (e) {
    var k = e.key.toLowerCase();
    if (k === 'a' || k === 'arrowleft') S.keys.port = false;
    if (k === 'd' || k === 'arrowright') S.keys.star = false;
  });
  sc.on(window, 'blur', function () { S.keys = {}; });

  var rt = null;
  sc.on(window, 'resize', function () { clearTimeout(rt); rt = sc.timeout(layout, 80); });
  if (window.ResizeObserver) { var ro = new ResizeObserver(function () { clearTimeout(rt); rt = sc.timeout(layout, 60); }); ro.observe(stage); sc.add(function () { ro.disconnect(); }); }

  newMap();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { if (sc.alive() && S.w) { drawStatic(); draw(performance.now()); } });
  sc.raf(loop);
  if (A.firstVisit(GAME)) openHelp();

  window.harborMaster = {
    state: S, start: start, newMap: newMap,
    toPage: function (x, y) { var r = cvs.getBoundingClientRect(); return [r.left + SX(x, y), r.top + SY(x, y)]; },
    fastForward: function (sec) { var w = S.w; if (!S.running) start(); for (var i = 0; i < sec / E.DT && !w.over; i++) { w.step(); w.events.forEach(handle); w.events.length = 0; } renderHud(); }
  };
  sc.add(function () { if (window.harborMaster && window.harborMaster.state === S) delete window.harborMaster; });
  return sc.dispose;
}
