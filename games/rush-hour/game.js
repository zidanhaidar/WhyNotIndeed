/*
 * Rush Hour: the full-screen city. Draws the streets, blocks, cars and walkers from above, turns clicks, taps and
 * keys into traffic light and green man commands, plays the street sounds and runs the panel.
 * mount() runs after window.Arcade is ready (components/PageShell.jsx) and returns a cleanup function.
 */
import E from './engine.js';
import { INK, COL, chip, strikeIcon, rr, nameBoard, keyBadge, hipRoof, flatRoof, ROOFS, tree, hash, mmss, makeKit, building, prism, cylinder, tree3d, car3d, rectPts, lift } from '../shared/yard.js';

export function mount() {
  var A = window.Arcade;
  var sc = A.scope();
  var GAME = 'rush-hour';
  var ORDER = ['pip', 'gridlock', 'monolith', 'edith'];
  var BODY = ['#F2F2F2', '#5B6BD9', '#E07A5F', '#81B29A', '#3D405B', '#F4D35E', '#B5838D', '#6D9DC5'];
  var SHIRT = ['#E5483A', '#3D86F0', '#2FBF71', '#FFC93C', '#8E5BD9', '#F28C28'];
  var SKIN = ['#F2C9A0', '#D9A066', '#A86B3C', '#7A4A2A', '#F6D7B8', '#C68B59'];
  var TINTS = ['#E3E5EB', '#F2E2C9', '#D6E4F0', '#E8D3DC', '#DCE9D5', '#F0D9C4'];
  var S = {
    level: A.lastLevel(GAME), w: null, running: false, paused: false, acc: 0, lastFrame: 0, lastLine: '', bannerUntil: 0,
    pops: [], text: {}, endShown: false, view: { k: 20, ox: 0, oy: 0 }, fit: null, hover: null, crashAt: 0, tickT: 0, sirenT: 0
  };
  var K = makeKit(A, sc, S), $ = K.$;

  var TALK = {
    pip: {
      blurb: 'Sends cars from anywhere, now and then. Walkers are patient and drivers are friendly.',
      rank: 'Rookie traffic boss',
      start: ['Beep beep! Rush hour is starting!', 'Hi! I am sending some cars. And some people. Hello people!', 'Vroom vroom! Do not forget the walkers!'],
      strike: ['Oh no, somebody is grumpy!', 'Honk honk! That was a sad honk.'],
      mission: ['Mission done! Everyone got home!', 'Yay! The town is happy!'],
      crash: ['Oh no! Somebody call an ambulance!', 'Eek! Watch out for walkers!'],
      end: ['That was fun! Same time tomorrow?']
    },
    gridlock: {
      blurb: 'Sends cars in convoys of three that line up at one entrance and roll in nose to tail.',
      rank: 'Pro traffic boss',
      start: ['Convoys of three. As planned.', 'Keep the lights tidy, please.', 'Traffic will arrive in neat lines.'],
      strike: ['Complaint received.', 'The queue is getting long.'],
      mission: ['Mission complete. On schedule.', 'Tidy work.'],
      crash: ['Accident recorded.', 'That was not in the plan.'],
      end: ['Shift over. Roads closed.']
    },
    monolith: {
      blurb: 'Sends cars to the entrances that face a red light, so queues build where you are not looking. Ambulances too.',
      rank: 'Grandmaster traffic boss',
      start: ['I send them where your lights are red.', 'Ambulances today. Keep them moving.', 'The queues will find you.'],
      strike: ['Another complaint.', 'The town grows impatient.'],
      mission: ['Mission done. Impressive.', 'The town approves.'],
      crash: ['Timing is everything.', 'The street always wins.'],
      end: ['The city has spoken.']
    },
    edith: {
      blurb: 'Aims the traffic at your red lights like Excel, sends ambulances often, and her walkers are the least patient in town.',
      rank: 'Impossible traffic boss',
      start: ['Hi! My ambulances never wait. Hee hee.', 'Rush hour, Edith style! Good luck!', 'Every red light gets a queue. You are welcome!'],
      strike: ['Aww, somebody is cross. Not my problem!', 'Oopsie! Was that your queue?'],
      mission: ['Fine, you finished a mission. Whatever.', 'Lucky!'],
      crash: ['Edith says: look both ways!', 'Oopsie! That was not a green man!'],
      end: ['Edith always beats the traffic.']
    }
  };
  function L() { return A.LEVEL_MAP[S.level]; }
  function cfg() { return E.LEVELS[S.level]; }

  // ---------- sounds ----------

  var traffic = K.loop('lowpass', 170, 0.8);
  function sfx(kind) {
    switch (kind) {
      case 'light': A.tone(1400, 0.025, 'square', 0.018); A.tone(700, 0.05, 'triangle', 0.022, 0.03); break;
      case 'walk-on': A.tone(880, 0.08, 'sine', 0.03); A.tone(1175, 0.12, 'sine', 0.03, 0.09); break;
      case 'walk-off': A.tone(660, 0.1, 'sine', 0.025); break;
      case 'tick': A.tone(1250, 0.018, 'square', 0.016); A.noise(0.02, 0.012, 0, 3000, 2); break;
      case 'locator': A.tone(950, 0.02, 'square', 0.008); break;
      case 'honk': [0, 0.22].forEach(function (d) { A.tone(392, 0.15, 'square', 0.02, d); A.tone(494, 0.15, 'square', 0.015, d); }); break;
      case 'home': A.tone(1046, 0.05, 'triangle', 0.016); break;
      case 'crossed': A.tone(988, 0.06, 'square', 0.018); A.tone(1318, 0.1, 'square', 0.018, 0.05); break;
      case 'jaywalk': A.tone(2200, 0.25, 'sine', 0.03, 0, 2600); A.tone(2600, 0.3, 'sine', 0.03, 0.28, 2200); break;
      case 'siren': A.tone(700, 0.45, 'sawtooth', 0.011, 0, 1250); A.tone(1250, 0.45, 'sawtooth', 0.011, 0.45, 700); break;
      case 'queue': [0, 0.15, 0.3].forEach(function (d, i) { A.tone(330 + i * 40, 0.13, 'square', 0.02, d); }); break;
      case 'crash': A.noise(0.6, 0.08, 0, 2800, 3); A.tone(1800, 0.5, 'sine', 0.02, 0, 900); A.noise(0.9, 0.12, 0.35, 260, 0.6); A.tone(70, 0.6, 'sine', 0.12, 0.35, 40); break;
    }
  }

  // ---------- view ----------

  var cvs = $('#map'), ctx = cvs.getContext('2d'), stat = document.createElement('canvas'), sctx = stat.getContext('2d'), high = document.createElement('canvas'), hctx = high.getContext('2d');
  var panel = $('#panel'), stage = $('#stage');
  function layout() {
    var f = K.fitRect(stage, panel), dpr = window.devicePixelRatio || 1;
    S.fit = f;
    cvs.width = Math.max(1, Math.round(f.w * dpr)); cvs.height = Math.max(1, Math.round(f.h * dpr));
    cvs.style.width = f.w + 'px'; cvs.style.height = f.h + 'px';
    stat.width = high.width = cvs.width; stat.height = high.height = cvs.height;
    if (S.w) {
      var m = S.w.map, k = Math.min((f.x1 - f.x0) / m.W, (f.y1 - f.y0) / m.H);
      S.view = { k: k, ox: f.x0 + ((f.x1 - f.x0) - m.W * k) / 2, oy: f.y0 + ((f.y1 - f.y0) - m.H * k) / 2 };
      drawStatic();
    }
    draw(performance.now());
  }
  function X(u) { return S.view.ox + u * S.view.k; }
  function Y(u) { return S.view.oy + u * S.view.k; }
  function world(c) { c.save(); c.translate(S.view.ox, S.view.oy); c.scale(S.view.k, S.view.k); }

  function drawStatic() {
    var c = sctx, w = S.w, m = w.map, k = S.view.k, dpr = window.devicePixelRatio || 1, f = S.fit, px = 1 / k, R = E.ROAD;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.fillStyle = '#9CCB6B'; c.fillRect(0, 0, f.w, f.h);
    var ex0 = -S.view.ox / k, ey0 = -S.view.oy / k, ex1 = (f.w - S.view.ox) / k, ey1 = (f.h - S.view.oy) / k; // the whole canvas in map units
    world(c);
    // pavements under everything that is a street
    c.fillStyle = '#E4E0D6';
    m.xs.forEach(function (x) { c.fillRect(x - R - 0.55, ey0, (R + 0.55) * 2, ey1 - ey0); });
    m.ys.forEach(function (y) { c.fillRect(ex0, y - R - 0.55, ex1 - ex0, (R + 0.55) * 2); });
    // kerb lines
    c.strokeStyle = 'rgba(29,26,51,.35)'; c.lineWidth = 1.2 * px;
    m.xs.forEach(function (x) { [-1, 1].forEach(function (sd) { c.beginPath(); c.moveTo(x + sd * (R + 0.55), ey0); c.lineTo(x + sd * (R + 0.55), ey1); c.stroke(); }); });
    m.ys.forEach(function (y) { [-1, 1].forEach(function (sd) { c.beginPath(); c.moveTo(ex0, y + sd * (R + 0.55)); c.lineTo(ex1, y + sd * (R + 0.55)); c.stroke(); }); });
    // blocks: the ground now (lawns, paths, car park tarmac), everything standing up later on the raised layer
    var raised = [];
    m.lots.forEach(function (b) {
      var bx0 = Math.max(b.x0, ex0 - 1), by0 = Math.max(b.y0, ey0 - 1), bx1 = Math.min(b.x1, ex1 + 1), by1 = Math.min(b.y1, ey1 + 1);
      if (b.kind === 'park') {
        rr(c, bx0, by0, bx1 - bx0, by1 - by0, 0.3); c.fillStyle = '#A9DB7A'; c.fill(); c.strokeStyle = INK; c.lineWidth = 1.6 * px; c.stroke();
        var cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
        c.strokeStyle = '#E8D9B5'; c.lineWidth = 0.32; c.lineCap = 'round';
        c.beginPath(); c.moveTo(bx0, cy - 0.6); c.quadraticCurveTo(cx - 1, cy - 1.6, cx, cy); c.quadraticCurveTo(cx + 1, cy + 1.6, bx1, cy + 0.6); c.stroke();
        // the fountain: a raised stone rim round the water
        raised.push({ y: cy + 0.85, fn: function (hc) {
          var top = cylinder(hc, cx, cy, 0.9, 0.18, { k: k, side: '#CFC8B8', top: '#D9D4C7' });
          hc.beginPath(); hc.arc(top[0], top[1], 0.66, 0, Math.PI * 2); hc.fillStyle = '#7FC8E8'; hc.fill(); hc.strokeStyle = INK; hc.lineWidth = 1.2 * px; hc.stroke();
        } });
        b.items.forEach(function (t) { if (Math.hypot(t.x - cx, t.y - cy) > 1.4) raised.push({ y: t.y + t.r * 0.5, fn: function (hc) { tree3d(hc, t.x, t.y, t.r, t.kind, t.hue, k); } }); });
      } else if (b.kind === 'parking') {
        rr(c, bx0, by0, bx1 - bx0, by1 - by0, 0.15); c.fillStyle = '#7A808E'; c.fill(); c.strokeStyle = INK; c.lineWidth = 1.6 * px; c.stroke();
        c.strokeStyle = 'rgba(255,255,255,.8)'; c.lineWidth = 1.4 * px;
        for (var ry = by0 + 0.4; ry < by1 - 1.2; ry += 2.0) {
          for (var rx = bx0 + 0.3; rx < bx1 - 0.3; rx += 0.6) {
            c.beginPath(); c.moveTo(rx, ry); c.lineTo(rx, ry + 1.0); c.stroke();
            if (hash(rx, ry, 4) < 0.55 && rx + 0.6 < bx1 - 0.3) (function (px2, py2, col2) {
              raised.push({ y: py2 + 0.9, fn: function (hc) { car3d(hc, px2 + 0.3, py2 + 0.5, -Math.PI / 2, 0.78, 0.42, col2, k); } });
            })(rx, ry, BODY[Math.floor(hash(rx, ry, 5) * BODY.length)]);
          }
        }
      } else {
        b.items.forEach(function (it) {
          var x0 = Math.max(it.x0, ex0 - 1), y0 = Math.max(it.y0, ey0 - 1), x1 = Math.min(it.x1, ex1 + 1), y1 = Math.min(it.y1, ey1 + 1);
          if (x1 - x0 < 0.6 || y1 - y0 < 0.6) return;
          var L = x1 - x0, Wd = y1 - y0, cx2 = (x0 + x1) / 2, cy2 = (y0 + y1) / 2;
          if (it.type === 'house' && Math.min(L, Wd) < 3.4) {
            // a house in a garden
            rr(c, x0, y0, L, Wd, 0.12); c.fillStyle = '#A9DB7A'; c.fill();
            var hl = L * 0.72, hw = Wd * 0.62, r2 = ROOFS[it.hue % ROOFS.length];
            raised.push({ y: cy2 + hw / 2, fn: function (hc) {
              building(hc, cx2 - hl / 2, cy2 - hw / 2, cx2 + hl / 2, cy2 + hw / 2, 0.7, { k: k, wall: ['#F4E9D8', '#F2DCC8', '#E8E4D8', '#F6E3C9'][it.hue % 4], kind: 'hip', roof: r2, window: '#9CC9D3', floors: 1, door: true });
            } });
          } else {
            // an office block: taller where the block is bigger
            var hgt = 0.9 + hash(cx2, cy2, 7) * Math.min(1.7, Math.min(L, Wd) * 0.7);
            raised.push({ y: y1, fn: function (hc) {
              building(hc, x0, y0, x1, y1, hgt, { k: k, wall: TINTS[it.hue % TINTS.length], tint: TINTS[(it.hue + 2) % TINTS.length], window: hash(cx2, cy2, 8) < 0.5 ? '#9CC9D3' : '#7FA3C9', door: true });
            } });
          }
        });
      }
    });
    // the roads
    c.fillStyle = INK;
    m.xs.forEach(function (x) { c.fillRect(x - R - 0.04, ey0, (R + 0.04) * 2, ey1 - ey0); });
    m.ys.forEach(function (y) { c.fillRect(ex0, y - R - 0.04, ex1 - ex0, (R + 0.04) * 2); });
    c.fillStyle = '#4F5462';
    m.xs.forEach(function (x) { c.fillRect(x - R, ey0, R * 2, ey1 - ey0); });
    m.ys.forEach(function (y) { c.fillRect(ex0, y - R, ex1 - ex0, R * 2); });
    // centre lines, broken at junctions
    c.strokeStyle = '#FFD45C'; c.lineWidth = 1.6 * px;
    function centre(x0, y0, x1, y1) { [-0.05, 0.05].forEach(function (o) { c.beginPath(); if (x0 === x1) { c.moveTo(x0 + o, y0); c.lineTo(x1 + o, y1); } else { c.moveTo(x0, y0 + o); c.lineTo(x1, y1 + o); } c.stroke(); }); }
    m.xs.forEach(function (x) { var cuts = [ey0 - 1].concat(m.ys).concat([ey1 + 1]); for (var i = 0; i < cuts.length - 1; i++) centre(x, cuts[i] + (i ? 1.5 : 0), x, cuts[i + 1] - (i < cuts.length - 2 ? 1.5 : 0)); });
    m.ys.forEach(function (y) { var cuts = [ex0 - 1].concat(m.xs).concat([ex1 + 1]); for (var i = 0; i < cuts.length - 1; i++) centre(cuts[i] + (i ? 1.5 : 0), y, cuts[i + 1] - (i < cuts.length - 2 ? 1.5 : 0), y); });
    // stop lines at every junction
    c.strokeStyle = '#fff'; c.lineWidth = 2.4 * px;
    m.junctions.forEach(function (jn) {
      var s = E.STOP - 0.45;
      c.beginPath();
      c.moveTo(jn.x - R, jn.y - s - 0.4); c.lineTo(jn.x, jn.y - s - 0.4);
      c.moveTo(jn.x, jn.y + s + 0.4); c.lineTo(jn.x + R, jn.y + s + 0.4);
      c.moveTo(jn.x + s + 0.4, jn.y - R); c.lineTo(jn.x + s + 0.4, jn.y);
      c.moveTo(jn.x - s - 0.4, jn.y); c.lineTo(jn.x - s - 0.4, jn.y + R);
      c.stroke();
    });
    // zebra crossings
    m.zebras.forEach(function (z) {
      c.fillStyle = '#fff';
      for (var t = -R + 0.08; t < R - 0.1; t += 0.24) {
        if (z.vertical) c.fillRect(z.x + t, z.y - 0.45, 0.13, 0.9); else c.fillRect(z.x - 0.45, z.y + t, 0.9, 0.13);
      }
    });
    // the colors of the four sides of town, and a sign at every street end
    var band = 0.35;
    c.globalAlpha = 0.85;
    c.fillStyle = COL[m.sides.top].hex; c.fillRect(0, 0, m.W, band);
    c.fillStyle = COL[m.sides.bottom].hex; c.fillRect(0, m.H - band, m.W, band);
    c.fillStyle = COL[m.sides.left].hex; c.fillRect(0, 0, band, m.H);
    c.fillStyle = COL[m.sides.right].hex; c.fillRect(m.W - band, 0, band, m.H);
    c.globalAlpha = 1;
    c.restore();
    // the raised layer: buildings, trees and parked cars from the back to the front, then the signs
    var h2 = hctx;
    h2.setTransform(dpr, 0, 0, dpr, 0, 0);
    h2.clearRect(0, 0, f.w, f.h);
    h2.lineCap = 'round'; h2.lineJoin = 'round';
    world(h2);
    raised.sort(function (a2, b2) { return a2.y - b2.y; });
    raised.forEach(function (it) { it.fn(h2); });
    h2.restore();
    w.ends.forEach(function (en) {
      var inward = en.dir, sx = en.x + inward[0] * 2.6, sy = en.y + inward[1] * 2.6, r = [-inward[1], inward[0]];
      sx += r[0] * -(R + 1.6); sy += r[1] * -(R + 1.6);
      nameBoard(h2, m.sides[en.side], 'TO ' + COL[m.sides[en.side]].name.toUpperCase(), X(sx), Y(sy), k * 0.9);
    });
  }

  // ---------- moving things ----------

  function lampColor(lt) { return lt === 'green' ? '#3BE37A' : lt === 'amber' ? '#FFB020' : '#FF3B30'; }

  function drawLights(c, now) {
    var w = S.w, m = w.map, k = S.view.k, R = E.ROAD;
    m.junctions.forEach(function (jn) {
      // a signal head on the near right corner of every approach
      [['n', 'ns', -1, -1], ['s', 'ns', 1, 1], ['e', 'ew', 1, -1], ['w', 'ew', -1, 1]].forEach(function (a) {
        var lt = w.light(jn, a[1]), hx, hy;
        if (a[0] === 'n') { hx = jn.x - R - 0.3; hy = jn.y - R - 0.3; }
        else if (a[0] === 's') { hx = jn.x + R + 0.3; hy = jn.y + R + 0.3; }
        else if (a[0] === 'e') { hx = jn.x + R + 0.3; hy = jn.y - R - 0.3; }
        else { hx = jn.x - R - 0.3; hy = jn.y + R + 0.3; }
        // a pole with a three-lamp head on top
        world(c);
        var tp = cylinder(c, hx, hy, 0.05, 0.85, { k: k, side: '#5E6372', lw: 1.1 });
        var head = prism(c, rectPts(tp[0], tp[1], 0.3, 0.3, 0), 0.1, { k: k, top: INK, wall: '#3A3D48', shadow: false, lw: 1.2 });
        var hc = [(head[0][0] + head[2][0]) / 2, (head[0][1] + head[2][1]) / 2];
        c.beginPath(); c.arc(hc[0], hc[1], 0.1, 0, Math.PI * 2); c.fillStyle = lampColor(lt); c.fill();
        if (lt !== 'red') { c.beginPath(); c.arc(hc[0], hc[1], 0.24, 0, Math.PI * 2); c.fillStyle = lt === 'green' ? 'rgba(59,227,122,.25)' : 'rgba(255,176,32,.25)'; c.fill(); }
        c.restore();
      });
      // the button in the middle: which way has green
      var hov = S.hover && S.hover.kind === 'junction' && S.hover.id === jn.id, r = 0.42 * k + (hov ? 2 : 0);
      c.beginPath(); c.arc(X(jn.x), Y(jn.y), r, 0, Math.PI * 2); c.fillStyle = hov ? '#FFF1C4' : '#fff'; c.fill(); c.strokeStyle = INK; c.lineWidth = 2; c.stroke();
      var col = jn.phase === 'green' ? '#2FBF71' : jn.phase === 'amber' ? '#FFB020' : '#E5483A';
      c.save(); c.translate(X(jn.x), Y(jn.y)); if (jn.axis === 'ew') c.rotate(Math.PI / 2);
      c.strokeStyle = col; c.lineWidth = Math.max(2.5, 0.09 * k); c.lineCap = 'round';
      c.beginPath(); c.moveTo(0, -0.26 * k); c.lineTo(0, 0.26 * k); c.moveTo(-0.1 * k, -0.15 * k); c.lineTo(0, -0.26 * k); c.lineTo(0.1 * k, -0.15 * k); c.moveTo(-0.1 * k, 0.15 * k); c.lineTo(0, 0.26 * k); c.lineTo(0.1 * k, 0.15 * k); c.stroke();
      c.restore();
      if (jn.next) { c.beginPath(); c.arc(X(jn.x), Y(jn.y), r + 3, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ((now / 600) % 1)); c.strokeStyle = '#FFB020'; c.lineWidth = 2.5; c.stroke(); }
      keyBadge(c, X(jn.x) + 0.55 * k, Y(jn.y) - 0.55 * k, jn.key, k);
    });
    // green man signals at the zebras
    m.zebras.forEach(function (z) {
      var hx = z.vertical ? z.x + E.ROAD + 0.75 : z.x + 0.8, hy = z.vertical ? z.y - 0.8 : z.y - E.ROAD - 0.75, hov = S.hover && S.hover.kind === 'zebra' && S.hover.id === z.id;
      rr(c, X(hx) - 0.3 * k, Y(hy) - 0.3 * k, 0.6 * k, 0.6 * k, 0.12 * k); c.fillStyle = INK; c.fill();
      if (hov) { c.strokeStyle = '#FFD45C'; c.lineWidth = 3; c.stroke(); }
      c.save(); c.translate(X(hx), Y(hy)); c.scale(k, k);
      if (z.go) {
        // a walking man
        c.strokeStyle = '#3BE37A'; c.fillStyle = '#3BE37A'; c.lineWidth = 0.06; c.lineCap = 'round';
        c.beginPath(); c.arc(0.02, -0.17, 0.06, 0, Math.PI * 2); c.fill();
        c.beginPath(); c.moveTo(0, -0.1); c.lineTo(-0.02, 0.06); c.lineTo(-0.1, 0.2); c.moveTo(-0.02, 0.06); c.lineTo(0.08, 0.2); c.moveTo(-0.1, -0.02); c.lineTo(0, -0.07); c.lineTo(0.1, 0.0); c.stroke();
      } else {
        // a red hand (amber while it waits to turn green)
        c.fillStyle = z.walk ? '#FFB020' : '#FF3B30';
        rr(c, -0.1, -0.08, 0.2, 0.22, 0.05); c.fill();
        for (var f = 0; f < 4; f++) { rr(c, -0.1 + f * 0.052, -0.2, 0.04, 0.14, 0.02); c.fill(); }
      }
      c.restore();
      keyBadge(c, X(hx) + 0.52 * k, Y(hy) + 0.52 * k, z.key, k);
    });
  }

  function drawCar(c, car, now) {
    var k = S.view.k, amb = car.kind === 'amb';
    world(c);
    if (amb) { var fl = Math.floor(now / 160) % 2; c.beginPath(); c.arc(car.x, car.y, 0.75, 0, Math.PI * 2); c.fillStyle = fl ? 'rgba(61,134,240,.15)' : 'rgba(255,59,48,.15)'; c.fill(); }
    car3d(c, car.x, car.y, car.h, E.CAR.len, E.CAR.wid, amb ? '#FBFBFD' : BODY[car.look % BODY.length], k, {
      brake: car.braking || car.v < 0.05, signal: car.turnSig, blink: Math.floor(now / 330) % 2, dot: amb ? null : COL[car.color].hex, amb: amb, flash: Math.floor(now / 160) % 2
    });
    c.restore();
    // getting cross at a red light
    if (car.kind === 'car' && car.wait > cfg().carWait * 0.5) {
      var q = Math.min(1, car.wait / cfg().carWait), bx = X(car.x), by = Y(car.y) - 0.6 * k;
      c.beginPath(); c.arc(bx, by, 0.2 * k, -Math.PI / 2, -Math.PI / 2 + q * Math.PI * 2); c.lineTo(bx, by); c.closePath(); c.fillStyle = q > 0.75 ? '#E5483A' : '#FF9F1C'; c.fill();
      c.beginPath(); c.arc(bx, by, 0.2 * k, 0, Math.PI * 2); c.strokeStyle = INK; c.lineWidth = 1.5; c.stroke();
    }
  }

  function drawWalker(c, wk, now) {
    var w = S.w, k = S.view.k, p = w.walkerPos(wk), z = w.map.zebras[wk.zebra];
    var moving = wk.state !== 'wait', sgn = wk.side ? 1 : -1;
    var face = z.vertical ? (sgn > 0 ? 0 : Math.PI) : (sgn > 0 ? Math.PI / 2 : -Math.PI / 2);
    if (!moving) face += Math.PI;
    var swing = moving ? Math.sin(now / (wk.run ? 70 : 110) + wk.id) * 0.09 : 0;
    var alpha = wk.state === 'leave' ? Math.max(0, 1 - wk.t / 1.6) : 1;
    var lf = lift(0.18);
    c.save(); c.globalAlpha = alpha * 0.25; c.beginPath(); c.ellipse(X(p[0] + 0.06), Y(p[1] + 0.05), 0.12 * k, 0.09 * k, 0, 0, Math.PI * 2); c.fillStyle = INK; c.fill(); c.restore();
    c.save(); c.globalAlpha = alpha; c.translate(X(p[0] + lf[0]), Y(p[1] + lf[1])); c.rotate(face); c.scale(k * 1.25, k * 1.25);
    var px = 1 / k;
    // legs, down to the ground
    c.strokeStyle = INK; c.lineWidth = 2 * px; c.beginPath(); c.moveTo(0, 0); c.lineTo(-lf[0] / 1.25 * 0.6, -lf[1] / 1.25 * 0.6); c.stroke();
    // arms, shoulders, head
    c.fillStyle = SKIN[wk.look];
    c.beginPath(); c.arc(swing, -0.15, 0.045, 0, Math.PI * 2); c.arc(-swing, 0.15, 0.045, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(0, 0, 0.1, 0.16, 0, 0, Math.PI * 2); c.fillStyle = SHIRT[wk.shirt]; c.fill(); c.strokeStyle = INK; c.lineWidth = 1.2 * px; c.stroke();
    c.beginPath(); c.arc(0.01, 0, 0.075, 0, Math.PI * 2); c.fillStyle = SKIN[wk.look]; c.fill(); c.stroke();
    c.beginPath(); c.arc(-0.02, 0, 0.06, Math.PI * 0.5, Math.PI * 1.5); c.fillStyle = '#3B2A20'; c.fill();
    c.restore();
    if (wk.state === 'wait') {
      var left = 1 - (w.t - wk.born) / wk.patience;
      if (left < 0.5) {
        var bx = X(p[0]), by = Y(p[1]) - 0.32 * k;
        c.beginPath(); c.arc(bx, by, 0.12 * k, 0, Math.PI * 2); c.fillStyle = left > 0.2 ? '#FF9F1C' : '#E5483A'; c.fill(); c.strokeStyle = INK; c.lineWidth = 1.2; c.stroke();
        c.fillStyle = '#fff'; c.font = 'bold ' + Math.round(0.18 * k) + 'px "Atkinson Hyperlegible", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('!', bx, by + 1);
      }
    } else if (wk.jay && wk.state === 'cross') {
      c.font = Math.round(0.42 * k) + 'px Staatliches, "Arial Narrow", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.lineWidth = 3; c.strokeStyle = INK; c.strokeText('!', X(p[0]), Y(p[1]) - 0.4 * k); c.fillStyle = '#FFD45C'; c.fillText('!', X(p[0]), Y(p[1]) - 0.4 * k);
    }
  }

  function drawQueues(c) {
    var w = S.w, k = S.view.k;
    w.ends.forEach(function (en) {
      if (!en.queue) return;
      var r = [-en.dir[1], en.dir[0]], x = en.x + en.dir[0] * 2.2 + r[0] * E.LANE, y = en.y + en.dir[1] * 2.2 + r[1] * E.LANE;
      var q = en.queue / E.QUEUE, txt = '+' + en.queue;
      c.font = Math.round(Math.max(11, 0.42 * k)) + 'px Staatliches, "Arial Narrow", sans-serif';
      var tw = c.measureText(txt).width + 12, th = Math.max(16, 0.5 * k);
      rr(c, X(x) - tw / 2, Y(y) - th / 2, tw, th, th / 2); c.fillStyle = q > 0.7 ? '#E5483A' : q > 0.4 ? '#FF9F1C' : '#fff'; c.fill(); c.strokeStyle = INK; c.lineWidth = 2; c.stroke();
      c.fillStyle = q > 0.4 ? '#fff' : INK; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(txt, X(x), Y(y) + 1);
    });
  }

  function drawFountain(c, now) {
    var w = S.w, k = S.view.k;
    w.map.lots.forEach(function (b) {
      if (b.kind !== 'park') return;
      var lw = lift(0.18), cx = (b.x0 + b.x1) / 2 + lw[0], cy = (b.y0 + b.y1) / 2 + lw[1];
      for (var i = 0; i < 2; i++) {
        var q = ((now / 1400) + i / 2) % 1;
        c.beginPath(); c.arc(X(cx), Y(cy), (0.12 + q * 0.5) * k, 0, Math.PI * 2); c.strokeStyle = 'rgba(255,255,255,' + (0.8 * (1 - q)) + ')'; c.lineWidth = 2; c.stroke();
      }
      // the jet: drops rising and falling back
      var top = lift(0.9);
      for (var d = 0; d < 8; d++) {
        var ph = ((now / 900) + d / 8) % 1, ang = d * Math.PI / 4, up = Math.sin(ph * Math.PI);
        var dx = cx + Math.cos(ang) * 0.4 * ph + top[0] * up, dy = cy + Math.sin(ang) * 0.4 * ph + top[1] * up;
        c.beginPath(); c.arc(X(dx), Y(dy), 0.05 * k, 0, Math.PI * 2); c.fillStyle = 'rgba(255,255,255,.85)'; c.fill();
      }
      c.beginPath(); c.moveTo(X(cx), Y(cy)); c.lineTo(X(cx + top[0]), Y(cy + top[1])); c.strokeStyle = 'rgba(255,255,255,.8)'; c.lineWidth = 0.08 * k; c.stroke();
    });
  }

  function drawPops(c, now) {
    S.pops = S.pops.filter(function (p) { return now - p.t < 1100; });
    S.pops.forEach(function (p) {
      var q = (now - p.t) / 1100;
      c.globalAlpha = 1 - q;
      c.font = '18px Staatliches, "Arial Narrow", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.lineWidth = 4; c.strokeStyle = INK; c.strokeText(p.text, X(p.x), Y(p.y) - q * 26);
      c.fillStyle = p.color; c.fillText(p.text, X(p.x), Y(p.y) - q * 26);
      c.globalAlpha = 1;
    });
  }
  function drawCrash(c, now) {
    var w = S.w;
    if (!w.crash) return;
    var k = S.view.k, x = X(w.crash.x), y = Y(w.crash.y), q = Math.min(1, (now - S.crashAt) / 500);
    c.save(); c.translate(x, y); c.rotate(now / 900);
    c.beginPath();
    for (var i = 0; i < 16; i++) { var a = i * Math.PI / 8, r = (i % 2 ? 0.6 : 1.3) * k * (0.4 + 0.6 * q); if (i) c.lineTo(Math.cos(a) * r, Math.sin(a) * r); else c.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
    c.closePath(); c.fillStyle = '#FFD45C'; c.fill(); c.strokeStyle = INK; c.lineWidth = 3; c.stroke();
    c.rotate(-now / 900);
    c.font = Math.round(0.6 * k) + 'px Staatliches, "Arial Narrow", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillStyle = '#E5483A'; c.fillText('OUCH!', 0, 2);
    c.restore();
  }

  function draw(now) {
    if (!S.w || !S.fit) return;
    var dpr = window.devicePixelRatio || 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(stat, 0, 0);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    S.w.walkers.forEach(function (wk) { if (wk.state === 'wait' || wk.state === 'leave') drawWalker(ctx, wk, now); });
    S.w.cars.slice().sort(function (a, b) { return a.y - b.y; }).forEach(function (car) { drawCar(ctx, car, now); });
    S.w.walkers.forEach(function (wk) { if (wk.state === 'cross') drawWalker(ctx, wk, now); });
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(high, 0, 0);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawFountain(ctx, now);
    drawLights(ctx, now);
    drawQueues(ctx);
    drawPops(ctx, now);
    drawCrash(ctx, now);
  }

  // ---------- panel ----------

  function buildPanel() {
    var Lv = L(), T = TALK[S.level];
    $('#bot-name').textContent = Lv.name;
    $('#bot-rank').textContent = T.rank;
    $('#strikes').innerHTML = Array.apply(null, Array(E.STRIKES)).map(function () { return '<span class="strike">' + strikeIcon() + '</span>'; }).join('');
    var best = A.progress(GAME)[S.level];
    $('#best').textContent = best ? 'Your best against ' + Lv.name + ': ' + best.text + '.' : 'No shift against ' + Lv.name + ' yet. Stars at ' + E.STARS.join(', ') + ' trips.';
    S.text = {};
  }
  var WALKER = '<svg class="chip" width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8.5" cy="3" r="2" fill="#1D1A33"/><path d="M8 5.5 7.5 10 5 15M7.5 10l3.5 5M4.5 8l3.5-2 3.5 2" fill="none" stroke="#1D1A33" stroke-width="1.8" stroke-linecap="round"/></svg>';
  function renderHud() {
    var w = S.w;
    K.setText('#delivered', String(w.trips()));
    K.setText('#time', mmss(w.t));
    K.setHtml('#by-color', w.colors.map(function (c) { return '<span class="bc">' + chip(c) + '<b>' + (w.byColor[c] || 0) + '</b></span>'; }).join('') + '<span class="bc">' + WALKER + '<b>' + w.walked + '</b></span>');
    var used = $('#strikes').children;
    for (var i = 0; i < used.length; i++) used[i].classList.toggle('used', i < w.strikes);
    var m = w.mission;
    K.setHtml('#mission', '<span class="mission-head">Mission ' + m.n + '</span>' + Object.keys(m.need).map(function (c) {
      var got = m.got[c], need = m.need[c], label = c === 'walk' ? 'Walkers across' : 'Cars to the ' + COL[c].name + ' side';
      return '<div class="mrow' + (got >= need ? ' done' : '') + '">' + (c === 'walk' ? WALKER : chip(c)) + '<span>' + label + '</span><b>' + got + '/' + need + '</b><i style="width:' + Math.round(100 * got / need) + '%"></i></div>';
    }).join(''));
    var waiting = w.walkers.filter(function (x) { return x.state === 'wait'; }).length, queue = w.ends.reduce(function (n, e) { return n + (e.queue || 0); }, 0);
    K.setText('#q-cars', String(w.cars.length));
    K.setText('#q-walk', String(waiting));
    K.setText('#q-out', String(queue));
    A.music.intensity(Math.min(0.95, 0.35 + w.cars.length / 60 + waiting / 30 + w.strikes * 0.08));
  }

  // ---------- playing ----------

  function newMap() {
    A.closeModal(true);
    var f = K.fitRect(stage, panel);
    S.fit = f;
    S.w = new E.World(S.level, (Math.random() * 1e9) >>> 0, Math.max(0.4, (f.x1 - f.x0) / Math.max(1, f.y1 - f.y0)));
    S.running = false; S.paused = false; S.endShown = false; S.pops = [];
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
    K.banner('Rush hour has begun!', false, 1800);
    sfx('honk');
  }
  function live() { return S.w && !S.w.over && !A.isBoss() && !A.modalOpen() && !S.paused; }
  function cmd(fn) { if (!live()) return; if (!S.running) start(); fn(); S.w.events.forEach(handle); S.w.events.length = 0; renderHud(); }

  function handle(ev) {
    var w = S.w, T = TALK[S.level], now = performance.now();
    switch (ev.type) {
      case 'light': sfx('light'); break;
      case 'walk-on': sfx('walk-on'); break;
      case 'walk-off': sfx('walk-off'); break;
      case 'green-man': S.tickT = 0; break;
      case 'honk': sfx('honk'); break;
      case 'home': { sfx('home'); break; }
      case 'crossed': {
        sfx('crossed');
        var z = w.map.zebras[ev.zebra];
        S.pops.push({ text: '+1', x: z.x, y: z.y, t: now, color: '#2FBF71' });
        break;
      }
      case 'jaywalk': sfx('jaywalk'); break;
      case 'ambulance': sfx('siren'); K.banner('An ambulance! Keep its lights green.', false, 2400); break;
      case 'mission':
        A.jingle('good');
        K.banner('Mission ' + ev.n + ' done!' + (ev.back ? ' One complaint forgiven.' : ''), false, 2600);
        if (Math.random() < 0.7) K.say(K.pick(T.mission), 'annoyed');
        break;
      case 'strike': {
        var msg = ev.why === 'walker' ? 'A walker got fed up and is crossing anyway!'
          : ev.why === 'car' ? 'A driver waited too long at a red light!'
            : ev.why === 'queue' ? 'The queue to get into town is too long!'
              : 'The ambulance was stuck at a red light!';
        if (ev.why === 'queue') sfx('queue');
        A.jingle('bad');
        K.banner(msg + ' (' + ev.strikes + ' of ' + E.STRIKES + ')', true, 2600);
        K.say(K.pick(T.strike), 'happy');
        break;
      }
      case 'end':
        if (ev.reason === 'crash') { S.crashAt = now; sfx('crash'); K.banner('Ouch! A car hit somebody on a crossing.', true, 4000); K.say(K.pick(T.crash), 'surprised'); }
        sc.timeout(endGame, ev.reason === 'crash' ? 1600 : 700);
        break;
    }
  }

  // the hum of traffic, the ticking crossings and the siren
  function ambient(dt) {
    var w = S.w;
    if (!A.soundOn() || A.isBoss() || !S.running || w.over) { traffic.set(0); return; }
    var moving = w.cars.reduce(function (n, c) { return n + c.v; }, 0);
    traffic.set(Math.min(0.08, 0.003 * moving + 0.004 * w.cars.length));
    S.tickT -= dt;
    var anyGo = w.map.zebras.some(function (z) { return z.go; });
    if (S.tickT <= 0) { if (anyGo) { S.tickT = 0.13; sfx('tick'); } else { S.tickT = 1.1; sfx('locator'); } }
    S.sirenT -= dt;
    if (w.cars.some(function (c) { return c.kind === 'amb'; }) && S.sirenT <= 0) { S.sirenT = 0.9; sfx('siren'); }
  }

  function loop(now) {
    sc.raf(loop);
    var w = S.w, dt = S.lastFrame ? Math.min(0.1, (now - S.lastFrame) / 1000) : 0;
    S.lastFrame = now;
    if (w && S.running && !w.over && !(S.paused || A.isBoss() || A.modalOpen() || document.hidden)) {
      S.acc += dt;
      while (S.acc >= E.DT && !w.over) { w.step(); w.events.forEach(handle); w.events.length = 0; S.acc -= E.DT; }
      renderHud(); ambient(dt);
    } else { S.acc = 0; traffic.set(0); }
    $('#banner').hidden = now > S.bannerUntil;
    $('#btn-pause').textContent = S.paused ? 'Resume (P)' : 'Pause (P)';
    $('#btn-pause').disabled = !S.running || !w || w.over;
    draw(now);
  }

  function endGame() {
    var w = S.w, Lv = L(), T = TALK[S.level];
    if (S.endShown) return;
    S.endShown = true; S.running = false; traffic.set(0);
    var stars = w.stars(), d = w.trips();
    A.account.submit(GAME, S.level, A.points(S.level, w.points()), d + ' trips in ' + mmss(w.t));
    A.music.intensity(0.35);
    var rec = A.record(GAME, S.level, { stars: stars, score: d, lowerIsBetter: false, text: d + ' trips' });
    bar.refresh(); buildPanel(); renderHud();
    A.jingle(stars ? 'win' : 'lose');
    if (w.reason !== 'crash') K.say(K.pick(T.end), stars ? 'annoyed' : 'happy');
    var next = ORDER[ORDER.indexOf(S.level) + 1], buttons = [{ label: 'New town', kind: 'main', onClick: newMap }];
    if (stars && next) buttons.push({ label: 'Next boss: ' + A.LEVEL_MAP[next].name, kind: 'line', onClick: function () { S.level = next; bar.setLevel(next); newMap(); } });
    var note = rec.better ? (rec.prev ? 'New best against ' + Lv.name + '!' : 'Your first shift against ' + Lv.name + ' is on the books.') : 'Your best: ' + rec.prev.text + '.';
    var why = w.reason === 'crash' ? 'A car hit a walker on a crossing.' : 'Five complaints ended the shift.';
    var colors = w.colors.map(function (c) { return '<span class="bc">' + chip(c, 16) + ' ' + COL[c].name + ' <b>' + (w.byColor[c] || 0) + '</b></span>'; }).join('');
    A.modal({
      title: stars === 3 ? 'Traffic legend!' : stars ? 'Rush hour survived!' : w.reason === 'crash' ? 'Ouch!' : 'Gridlock!',
      tone: stars ? 'win' : 'lose',
      html: '<p class="lead">You got <strong>' + w.carsHome + ' cars</strong> home and helped <strong>' + w.walked + ' walkers</strong> across (' + d + ' trips), and finished ' + w.missionsDone + ' mission' + (w.missionsDone === 1 ? '' : 's') + ' in a shift of ' + mmss(w.t) + '.</p>' +
        '<p class="lc-colors">' + colors + '</p><p>' + why + '</p>' + A.stars(stars) + '<p><strong>' + note + '</strong></p>' +
        (stars < 3 ? '<p class="soft">Stars at ' + E.STARS.join(', ') + ' trips. Tip: give green to the longer queue, and press the green man before walkers lose patience.</p>' : ''),
      buttons: buttons,
      link: { label: 'Close and look at the town' }
    });
  }

  function openHelp() {
    var rows = ORDER.map(function (id) {
      var Lv = A.LEVEL_MAP[id], c = E.LEVELS[id];
      return '<div><dt>' + Lv.name + ', ' + Lv.rank.toLowerCase() + '</dt><dd>' + c.zebras + ' zebra crossings. ' + TALK[id].blurb + '</dd></div>';
    }).join('');
    A.modal({
      title: 'How to play',
      wide: true,
      html: '<p>It is rush hour in a brand new town. Cars come in at the edges, each heading for the side of town shown on its roof. Walkers wait at the zebra crossings. You run the lights.</p>' +
        '<ol><li><strong>Junctions:</strong> click the round button in a junction (or press its number) to switch which way has green. The lights go amber and red for a moment first, so the junction can clear.</li>' +
        '<li><strong>Zebra crossings:</strong> click the crossing\'s signal (or press Q, W, E or R) to ask for the green man. It shows once no car is about to drive over the crossing. Click again to let the cars go.</li>' +
        '<li><strong>Walkers</strong> who wait too long get fed up and cross anyway. A car that cannot stop in time hits them, and the shift ends at once.</li>' +
        '<li><strong>Complaints:</strong> a fed-up walker, a driver kept at a red light too long, a long queue waiting to get into town (the numbers at the edges), or an ambulance held at a red light. Five end the shift. Finishing a mission takes one away.</li></ol>' +
        '<h3>Traffic bosses</h3><dl>' + rows + '</dl>' +
        '<h3>Keys</h3><table class="keys"><tr><td><kbd>1</kbd> to <kbd>6</kbd></td><td>Switch a junction\'s lights</td></tr><tr><td><kbd>Q</kbd> <kbd>W</kbd> <kbd>E</kbd> <kbd>R</kbd></td><td>Green man at a zebra crossing</td></tr>' +
        '<tr><td><kbd>F</kbd></td><td>Full screen</td></tr><tr><td><kbd>Enter</kbd></td><td>Start</td></tr><tr><td><kbd>P</kbd></td><td>Pause</td></tr><tr><td><kbd>N</kbd></td><td>New town</td></tr>' +
        '<tr><td><kbd>M</kbd></td><td>Music on or off</td></tr><tr><td><kbd>B</kbd></td><td>Panic button</td></tr></table>',
      buttons: [{ label: 'Let\'s roll!', kind: 'main' }]
    });
  }

  var bar = A.mountBar({
    el: $('#bar'), game: GAME, title: 'Rush Hour', tagline: 'Run the lights. Get the cars home and the walkers across.',
    level: S.level, levelLabel: 'Boss',
    canSwitch: function () { return S.running && !S.w.over ? 'This shift will be abandoned.' : true; },
    onLevel: function (id) { S.level = id; newMap(); },
    onHelp: openHelp
  });
  sc.add(bar.destroy);

  // ---------- pointer and keys ----------

  function toMap(e) { var r = cvs.getBoundingClientRect(); return [((e.clientX - r.left) - S.view.ox) / S.view.k, ((e.clientY - r.top) - S.view.oy) / S.view.k]; }
  function zebraButton(z) { return z.vertical ? [z.x + E.ROAD + 0.75, z.y - 0.8] : [z.x + 0.8, z.y - E.ROAD - 0.75]; }
  function hitTest(x, y) {
    var w = S.w, best = null, bd = 1e9;
    w.map.junctions.forEach(function (jn) { var d = Math.hypot(jn.x - x, jn.y - y); if (d < 0.9 && d < bd) { bd = d; best = { kind: 'junction', id: jn.id }; } });
    w.map.zebras.forEach(function (z) {
      var b = zebraButton(z), d = Math.min(Math.hypot(b[0] - x, b[1] - y), Math.hypot(z.x - x, z.y - y) + 0.2);
      if (d < 0.75 && d < bd) { bd = d; best = { kind: 'zebra', id: z.id }; }
    });
    return best;
  }
  cvs.addEventListener('pointerdown', function (e) {
    if (!S.w || A.isBoss()) return;
    var p = toMap(e), h = hitTest(p[0], p[1]);
    if (!h) return;
    e.preventDefault();
    if (h.kind === 'junction') cmd(function () { S.w.switchLight(h.id); });
    else cmd(function () { S.w.toggleWalk(h.id); });
  });
  cvs.addEventListener('pointermove', function (e) {
    if (!S.w || e.pointerType === 'touch') return;
    var p = toMap(e); S.hover = hitTest(p[0], p[1]);
    cvs.style.cursor = S.hover ? 'pointer' : 'default';
  });
  cvs.addEventListener('pointerleave', function () { S.hover = null; });

  $('#btn-start').addEventListener('click', start);
  $('#btn-pause').addEventListener('click', function () { if (!(S.running && !S.w.over)) return; S.paused = !S.paused; $('#veil').hidden = !S.paused; });
  $('#btn-new').addEventListener('click', function () {
    if (!(S.running && !S.w.over)) return newMap();
    A.confirm({ title: 'New town?', text: 'This shift will be abandoned and a brand new town is drawn.', yes: 'New town', no: 'Keep going', onYes: newMap });
  });
  var toggleFull = K.fullscreen($('#btn-full'), layout);

  sc.on(document, 'keydown', function (e) {
    if (e.ctrlKey || e.metaKey || e.altKey || A.modalOpen()) return;
    var tg = (e.target && e.target.tagName) || '';
    if (tg === 'INPUT' || tg === 'TEXTAREA' || !S.w) return;
    var k = e.key.toLowerCase(), w = S.w;
    var jn = w.map.junctions.find(function (j) { return j.key === k; });
    if (jn) { e.preventDefault(); cmd(function () { w.switchLight(jn.id); }); return; }
    var z = w.map.zebras.find(function (q) { return q.key.toLowerCase() === k; });
    if (z) { e.preventDefault(); cmd(function () { w.toggleWalk(z.id); }); return; }
    if (k === 'f') toggleFull();
    else if (k === 'enter' && tg !== 'BUTTON') { e.preventDefault(); start(); }
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

  window.rushHour = {
    state: S, start: start, newMap: newMap,
    toPage: function (x, y) { var r = cvs.getBoundingClientRect(); return [r.left + X(x), r.top + Y(y)]; },
    zebraButton: zebraButton,
    fastForward: function (sec) { var w = S.w; if (!S.running) start(); for (var i = 0; i < sec / E.DT && !w.over; i++) { w.step(); w.events.forEach(handle); w.events.length = 0; } renderHud(); }
  };
  sc.add(function () { if (window.rushHour && window.rushHour.state === S) delete window.rushHour; });
  return sc.dispose;
}
