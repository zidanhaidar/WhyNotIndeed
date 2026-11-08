/*
 * Shared pieces for the full-screen games that grew out of Level Crossing (Cleared to Land, Rush Hour,
 * Harbor Master): the color palette with shapes, the robot's speech bubble, banners, fitting the map beside the
 * panel, browser full screen, looping engine noises, and top-down drawing of trees, houses and roofs.
 * Everything here runs in the browser only, inside a page's mount().
 */

export var INK = '#1D1A33';
export var COL = {
  red: { hex: '#E5483A', name: 'Red', shape: 'circle', shade: ['#F27A6E', '#E5483A', '#B8352A'] },
  blue: { hex: '#3D86F0', name: 'Blue', shape: 'square', shade: ['#78AAF5', '#3D86F0', '#2A63B8'] },
  green: { hex: '#2FBF71', name: 'Green', shape: 'triangle', shade: ['#6BD69A', '#2FBF71', '#1F8E52'] },
  yellow: { hex: '#FFC93C', name: 'Yellow', shape: 'star', shade: ['#FFDB7A', '#FFC93C', '#D9A21F'] }
};

export function mmss(t) { var s = Math.floor(t); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
// a steady random number for a spot, so the same map always looks the same
export function hash(x, y, n) { var v = Math.sin(x * 12.9898 + y * 78.233 + (n || 0) * 37.719) * 43758.5453; return v - Math.floor(v); }

export function chip(color, size) {
  var c = COL[color], s = size || 14, shape;
  if (c.shape === 'circle') shape = '<circle cx="8" cy="8" r="6.2"/>';
  else if (c.shape === 'square') shape = '<rect x="2.2" y="2.2" width="11.6" height="11.6" rx="1.5"/>';
  else if (c.shape === 'triangle') shape = '<path d="M8 1.6 L14.6 14 H1.4 Z"/>';
  else shape = '<path d="M8 1 L9.9 5.9 L15 6.1 L11 9.3 L12.4 14.4 L8 11.5 L3.6 14.4 L5 9.3 L1 6.1 L6.1 5.9 Z"/>';
  return '<svg class="chip" width="' + s + '" height="' + s + '" viewBox="0 0 16 16" aria-hidden="true"><g fill="' + c.hex + '" stroke="' + INK + '" stroke-width="1.6" stroke-linejoin="round">' + shape + '</g></svg>';
}

export function strikeIcon() {
  return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v10H10l-5 4v-4H4z" fill="none" stroke="' + INK + '" stroke-width="2.4" stroke-linejoin="round"/><path d="M12 7.5v4M12 13.2v.4" stroke="' + INK + '" stroke-width="2.4" stroke-linecap="round"/></svg>';
}

export function rr(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

// the station shape for a color, drawn at (x, y) in pixels
export function shape(c, color, x, y, r) {
  var col = COL[color];
  c.fillStyle = col.hex; c.strokeStyle = INK; c.lineWidth = 1.5;
  c.beginPath();
  if (col.shape === 'circle') c.arc(x, y, r, 0, Math.PI * 2);
  else if (col.shape === 'square') c.rect(x - r * 0.85, y - r * 0.85, r * 1.7, r * 1.7);
  else if (col.shape === 'triangle') { c.moveTo(x, y - r); c.lineTo(x + r, y + r * 0.8); c.lineTo(x - r, y + r * 0.8); c.closePath(); }
  else { for (var i = 0; i < 10; i++) { var a = -Math.PI / 2 + i * Math.PI / 5, rad = i % 2 ? r * 0.45 : r * 1.05; if (i) c.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad); else c.moveTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad); } c.closePath(); }
  c.fill(); c.stroke();
}

// a name board with the color's shape, always upright, centred on (x, y) in pixels
export function nameBoard(c, color, label, x, y, k) {
  var col = COL[color], fs = Math.max(10, Math.min(18, 0.46 * k));
  c.font = fs + 'px Staatliches, "Arial Narrow", sans-serif';
  var tw = c.measureText(label).width + fs * 1.7, th = fs * 1.45;
  rr(c, x - tw / 2 + 2, y - th / 2 + 2, tw, th, 5); c.fillStyle = INK; c.fill();
  rr(c, x - tw / 2, y - th / 2, tw, th, 5); c.fillStyle = '#fff'; c.fill();
  c.save(); rr(c, x - tw / 2, y - th / 2, tw, th, 5); c.clip(); c.fillStyle = col.hex; c.fillRect(x - tw / 2, y + th / 2 - 4, tw, 4); c.restore();
  rr(c, x - tw / 2, y - th / 2, tw, th, 5); c.strokeStyle = INK; c.lineWidth = 2; c.stroke();
  shape(c, color, x - tw / 2 + fs * 0.72, y - 1, fs * 0.42);
  c.fillStyle = INK; c.textAlign = 'left'; c.textBaseline = 'middle';
  c.fillText(label, x - tw / 2 + fs * 1.32, y);
}

export function keyBadge(c, x, y, key, k, on) {
  if (!key || k < 12) return;
  var s = Math.max(14, 0.48 * k);
  rr(c, x - s / 2, y - s / 2, s, s, 4);
  c.fillStyle = on ? '#FFD45C' : '#fff'; c.fill(); c.strokeStyle = INK; c.lineWidth = 1.8; c.stroke();
  c.fillStyle = INK; c.font = 'bold ' + Math.round(s * 0.62) + 'px "Atkinson Hyperlegible", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText(key, x, y + 1);
}

// a rounded tag (GO, STOP, ...) in pixels
export function tag(c, text, x, y, k, fill) {
  c.font = Math.round(Math.max(11, 0.4 * k)) + 'px Staatliches, "Arial Narrow", sans-serif';
  var tw = c.measureText(text).width + 10, th = Math.max(14, 0.48 * k);
  rr(c, x - tw / 2, y - th / 2, tw, th, 4);
  c.fillStyle = fill; c.fill(); c.strokeStyle = INK; c.lineWidth = 1.8; c.stroke();
  c.fillStyle = '#fff'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, x, y + 1);
  return tw;
}

// ---------- top-down scenery, drawn in map units after c.scale(k, k) ----------

// a hipped roof seen from above: four slopes in three shades around a ridge, centred on 0, 0
export function hipRoof(c, L, W, light, mid, dark, k) {
  var h = Math.min(W, L) / 2, ink = 2 / k, hl = L / 2, hw = W / 2;
  c.lineJoin = 'round';
  c.fillStyle = light; c.beginPath(); c.moveTo(-hl, -hw); c.lineTo(hl, -hw); c.lineTo(hl - h, 0); c.lineTo(-hl + h, 0); c.closePath(); c.fill();
  c.fillStyle = dark; c.beginPath(); c.moveTo(-hl, hw); c.lineTo(hl, hw); c.lineTo(hl - h, 0); c.lineTo(-hl + h, 0); c.closePath(); c.fill();
  c.fillStyle = mid;
  c.beginPath(); c.moveTo(-hl, -hw); c.lineTo(-hl + h, 0); c.lineTo(-hl, hw); c.closePath(); c.fill();
  c.beginPath(); c.moveTo(hl, -hw); c.lineTo(hl - h, 0); c.lineTo(hl, hw); c.closePath(); c.fill();
  c.strokeStyle = 'rgba(29,26,51,.18)'; c.lineWidth = 1 / k;
  for (var t = 1; t < 3; t++) {
    var q = h * t / 3;
    c.beginPath(); c.moveTo(-hl + q, -hw + q); c.lineTo(hl - q, -hw + q); c.moveTo(-hl + q, hw - q); c.lineTo(hl - q, hw - q); c.stroke();
  }
  c.strokeStyle = INK; c.lineWidth = ink * 0.6;
  c.beginPath(); c.moveTo(-hl, -hw); c.lineTo(-hl + h, 0); c.lineTo(-hl, hw); c.moveTo(hl, -hw); c.lineTo(hl - h, 0); c.lineTo(hl, hw); c.moveTo(-hl + h, 0); c.lineTo(hl - h, 0); c.stroke();
  c.lineWidth = ink; c.beginPath(); c.rect(-hl, -hw, L, W); c.stroke();
}

export var ROOFS = [
  ['#F07A5A', '#D9603B', '#B54A2C'], ['#7FA3D9', '#5B7DB1', '#44628F'],
  ['#B98BC9', '#8E5B9E', '#6E447C'], ['#5CC2B5', '#2E9A8C', '#1F756A']
];

// a flat-roofed block: parapet, rooftop units, centred on 0, 0
export function flatRoof(c, L, W, k, tint) {
  c.beginPath(); c.rect(-L / 2 + 0.12, -W / 2 + 0.12, L, W); c.fillStyle = 'rgba(29,26,51,.35)'; c.fill();
  c.beginPath(); c.rect(-L / 2, -W / 2, L, W); c.fillStyle = tint || '#E3E5EB'; c.fill(); c.strokeStyle = INK; c.lineWidth = 2 / k; c.stroke();
  c.beginPath(); c.rect(-L / 2 + 0.1, -W / 2 + 0.1, L - 0.2, W - 0.2); c.strokeStyle = 'rgba(29,26,51,.22)'; c.lineWidth = 1.4 / k; c.stroke();
  var ax = -L / 2 + 0.25 + hash(L, W, 1) * Math.max(0.1, L - 0.9), ay = -W / 2 + 0.25 + hash(W, L, 2) * Math.max(0.1, W - 0.8);
  rr(c, ax, ay, 0.42, 0.3, 0.05); c.fillStyle = '#C3C8D2'; c.fill(); c.strokeStyle = INK; c.lineWidth = 1.3 / k; c.stroke();
  c.beginPath(); c.arc(ax + 0.21, ay + 0.15, 0.1, 0, Math.PI * 2); c.fillStyle = '#8E95A3'; c.fill();
}

// a leafy tree, a pine or a flowering bush at (x, y) map units, radius r
export function tree(c, x, y, r, kind, hue, k) {
  var hv = hash(x, y, 3);
  c.save(); c.translate(x, y); c.rotate(hv * Math.PI * 2);
  if (kind === 'pine') {
    [[1, '#2F7D4A'], [0.68, '#3C9A57'], [0.36, '#55B56C']].forEach(function (layer, li) {
      c.beginPath();
      for (var i = 0; i < 24; i++) { var a = i * Math.PI / 12, rad = (i % 2 ? 0.8 : 1) * r * layer[0]; if (i) c.lineTo(Math.cos(a) * rad, Math.sin(a) * rad); else c.moveTo(Math.cos(a) * rad, Math.sin(a) * rad); }
      c.closePath();
      if (li === 0) { c.save(); c.translate(0.1, 0.1); c.fillStyle = 'rgba(29,26,51,.3)'; c.fill(); c.restore(); }
      c.fillStyle = layer[1]; c.fill();
      if (li === 0) { c.strokeStyle = INK; c.lineWidth = 2 / k; c.stroke(); }
    });
    c.restore();
    return;
  }
  var bush = kind === 'bush', blobs = bush ? [[-0.35, 0.1, 0.6], [0.32, 0.12, 0.58], [0, -0.28, 0.6]] : [[-0.32, 0.12, 0.62], [0.34, 0.16, 0.58], [0.02, -0.3, 0.64], [0.05, 0.38, 0.5]];
  var greens = bush ? ['#3E9B4F', '#57B865'] : [['#2E8B57', '#45A86D'], ['#3FA34D', '#5CBF68'], ['#2F7D4A', '#46985F'], ['#4CAF50', '#6CC86F']][hue % 4];
  function cloud() { c.beginPath(); blobs.forEach(function (b) { c.moveTo(b[0] * r + b[2] * r, b[1] * r); c.arc(b[0] * r, b[1] * r, b[2] * r, 0, Math.PI * 2); }); }
  c.save(); c.translate(0.1, 0.12); cloud(); c.fillStyle = 'rgba(29,26,51,.28)'; c.fill(); c.restore();
  cloud(); c.strokeStyle = INK; c.lineWidth = 4 / k; c.stroke();
  cloud(); c.fillStyle = greens[0]; c.fill();
  c.beginPath(); blobs.forEach(function (b) { c.moveTo(b[0] * r - 0.15 * r + b[2] * r * 0.55, b[1] * r - 0.15 * r); c.arc(b[0] * r - 0.15 * r, b[1] * r - 0.15 * r, b[2] * r * 0.55, 0, Math.PI * 2); });
  c.fillStyle = greens[1]; c.fill();
  if (bush) {
    [[-0.3, -0.05, '#FF8FB1'], [0.25, 0.25, '#FFE066'], [0.05, -0.35, '#fff'], [0.4, -0.1, '#FF8FB1']].forEach(function (f) {
      c.beginPath(); c.arc(f[0] * r, f[1] * r, 0.07, 0, Math.PI * 2); c.fillStyle = f[2]; c.fill();
    });
  } else {
    c.beginPath(); c.arc(-0.3 * r, -0.35 * r, 0.16 * r, 0, Math.PI * 2); c.fillStyle = 'rgba(255,255,255,.25)'; c.fill();
  }
  c.restore();
}

// ---------- page helpers ----------

export function makeKit(A, sc, S) {
  function $(s) { return document.querySelector(s); }
  var kit = {
    $: $,
    setText: function (id, v) { if (S.text[id] !== v) { S.text[id] = v; $(id).textContent = v; } },
    setHtml: function (id, v) { if (S.text[id] !== v) { S.text[id] = v; $(id).innerHTML = v; } },
    pick: function (arr) {
      if (!arr || !arr.length) return '';
      var c = arr.filter(function (l) { return l !== S.lastLine; });
      c = c.length ? c : arr;
      return c[Math.floor(Math.random() * c.length)];
    },
    setFace: function (mood) {
      var f = $('#face');
      if (f.dataset.mood !== mood || f.dataset.level !== S.level) {
        f.innerHTML = A.face(S.level, mood);
        f.dataset.mood = mood;
        f.dataset.level = S.level;
      }
    },
    say: function (text, mood) {
      if (!text) return;
      S.lastLine = text;
      var b = $('#bubble');
      b.textContent = text;
      b.classList.remove('pop');
      void b.offsetWidth;
      b.classList.add('pop');
      if (mood) kit.setFace(mood);
    },
    banner: function (text, bad, ms) {
      var el = $('#banner');
      el.textContent = text;
      el.className = 'banner' + (bad ? ' bad' : '');
      el.hidden = false;
      S.bannerUntil = performance.now() + (ms || 2400);
    },
    // the space for the map: the whole stage, minus the panel when it floats over it
    fitRect: function (stage, panel) {
      var w = stage.clientWidth, h = stage.clientHeight;
      var beside = getComputedStyle(panel).position === 'absolute';
      var x0 = beside ? panel.offsetLeft + panel.offsetWidth + 12 : 8;
      return { w: w, h: h, x0: x0, y0: 8, x1: w - 8, y1: h - 8 };
    },
    // browser full screen for the whole page (top bar and dialogs included); F toggles it
    fullscreen: function (btn, onChange) {
      var can = !!(document.fullscreenEnabled || document.webkitFullscreenEnabled);
      btn.hidden = !can;
      function el() { return document.fullscreenElement || document.webkitFullscreenElement; }
      function toggle() {
        if (!can) return;
        var d = document, root = d.documentElement;
        try {
          if (el()) (d.exitFullscreen || d.webkitExitFullscreen).call(d);
          else { var r = (root.requestFullscreen || root.webkitRequestFullscreen).call(root); if (r && r.catch) r.catch(function () { /* refused */ }); }
        } catch (err) { /* not allowed here */ }
      }
      function changed() { btn.textContent = el() ? 'Exit full screen (F)' : 'Full screen (F)'; if (onChange) sc.timeout(onChange, 60); }
      btn.addEventListener('click', toggle);
      sc.on(document, 'fullscreenchange', changed);
      sc.on(document, 'webkitfullscreenchange', changed);
      sc.add(A.onBoss(function (on) { if (on && el()) toggle(); }));
      sc.add(function () { if (el()) { try { (document.exitFullscreen || document.webkitExitFullscreen).call(document); } catch (e) { /* gone */ } } });
      return toggle;
    },
    // a looping filtered noise on the sound bus (engines, wind, water); set(level) fades it, 0 is silent
    loop: function (type, freq, q) {
      var node = null;
      sc.add(function () { if (node) { try { node.src.stop(); node.src.disconnect(); node.g.disconnect(); } catch (e) { /* stopped */ } node = null; } });
      return {
        set: function (level, f) {
          if (!A.soundOn() || A.isBoss()) level = 0;
          if (!node && level > 0) {
            var ctx = A.audio(), bus = A.audioBus('sound'), buf = A.noiseBuffer();
            if (!ctx || !bus || !buf) return;
            var src = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain();
            src.buffer = buf; src.loop = true;
            fl.type = type; fl.frequency.value = freq; fl.Q.value = q || 0.8;
            g.gain.value = 0.0001;
            src.connect(fl); fl.connect(g); g.connect(bus);
            src.start();
            node = { src: src, g: g, f: fl, ctx: ctx };
          }
          if (node) {
            node.g.gain.setTargetAtTime(Math.max(0.0001, level), node.ctx.currentTime, 0.15);
            if (f) node.f.frequency.setTargetAtTime(f, node.ctx.currentTime, 0.2);
          }
        }
      };
    }
  };
  return kit;
}

// ---------- 2.5D: flat drawings from straight above, with shadows that show how tall things are ----------
// Everything is drawn flat from above, as before; what gives it depth is its shadow, falling down and to the right
// and longer the taller the thing is (SHADOW map units per unit of height). LIFT can raise tops for a side view,
// but it is zero: no walls are drawn. Draw the ground first, then raised things from the back to the front.
// All of these work in map units (after c.scale).

var LIFT0 = [0, 0], SHADOW0 = [0.55, 0.4], LIFT = LIFT0, SHADOW = SHADOW0;
export function isFlat() { return !LIFT[0] && !LIFT[1]; }
// A game that turns its map on screen passes the turned vectors, so the light still comes from the same side.
export function setLift(lift, shadow) { LIFT = lift || LIFT0; SHADOW = shadow || SHADOW0; }
// the light as seen on a map that is drawn turned a quarter clockwise (map x down the screen, map y leftwards)
export function turnedLight() { return [[LIFT0[1], -LIFT0[0]], [SHADOW0[1], -SHADOW0[0]]]; }
export function lift(h) { return [LIFT[0] * h, LIFT[1] * h]; }
// where the shadow of something h tall falls, relative to it (map units)
export function shadowAt(h) { return [SHADOW[0] * h, SHADOW[1] * h]; }

function shade(hex, f) {
  var n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  function ch(v) { return Math.max(0, Math.min(255, Math.round(f < 0 ? v * (1 + f) : v + (255 - v) * f))); }
  return 'rgb(' + ch(r) + ',' + ch(g) + ',' + ch(b) + ')';
}
export { shade };

function path(c, pts) { c.beginPath(); pts.forEach(function (p, i) { if (i) c.lineTo(p[0], p[1]); else c.moveTo(p[0], p[1]); }); c.closePath(); }

// the shadow of a raised outline: the outline swept toward the shadow direction
export function shadowOf(c, pts, h, alpha) {
  var sx = SHADOW[0] * h, sy = SHADOW[1] * h;
  c.fillStyle = 'rgba(29,26,51,' + (alpha == null ? 0.32 : alpha) + ')';
  for (var i = 0; i < pts.length; i++) {
    var a = pts[i], b = pts[(i + 1) % pts.length];
    path(c, [a, b, [b[0] + sx, b[1] + sy], [a[0] + sx, a[1] + sy]]); c.fill();
  }
  path(c, pts.map(function (p) { return [p[0] + sx, p[1] + sy]; })); c.fill();
}

/*
 * A prism: a convex outline (clockwise or not) raised to height h. Walls that face the viewer are drawn, lit by
 * how much they face south (lighter) or east (darker). o: { top, wall, ink, k, shadow (false to skip), lw }.
 * Returns the lifted outline (the top), for drawing details on it.
 */
export function prism(c, pts, h, o) {
  var k = o.k || 30, L = lift(h), top = pts.map(function (p) { return [p[0] + L[0], p[1] + L[1]]; });
  if (o.shadow !== false) shadowOf(c, pts, h, o.shadowAlpha);
  // which way round is the outline?
  var area = 0;
  for (var i = 0; i < pts.length; i++) { var p = pts[i], q = pts[(i + 1) % pts.length]; area += p[0] * q[1] - q[0] * p[1]; }
  var sgn = area > 0 ? 1 : -1;
  for (i = 0; i < pts.length; i++) {
    var a = pts[i], b = pts[(i + 1) % pts.length], ex = b[0] - a[0], ey = b[1] - a[1], len = Math.hypot(ex, ey) || 1;
    var nx = sgn * ey / len, ny = -sgn * ex / len; // outward normal
    if (nx * -LIFT[0] + ny * -LIFT[1] <= 0.001) continue; // faces away from us
    var south = Math.max(0, ny), east = Math.max(0, nx);
    var f = 0.08 * south - 0.22 * east - 0.05;
    path(c, [a, b, [b[0] + L[0], b[1] + L[1]], [a[0] + L[0], a[1] + L[1]]]);
    c.fillStyle = shade(o.wall, f); c.fill();
    c.strokeStyle = o.ink || INK; c.lineWidth = (o.lw || 1.6) / k; c.stroke();
  }
  path(c, top); c.fillStyle = o.top; c.fill();
  c.strokeStyle = o.ink || INK; c.lineWidth = (o.lw || 2) / k; c.stroke();
  return top;
}

// a rectangle as an outline, optionally turned by angle a about (cx, cy)
export function rectPts(cx, cy, L, W, a) {
  var c = Math.cos(a || 0), s = Math.sin(a || 0), out = [];
  [[L / 2, W / 2], [-L / 2, W / 2], [-L / 2, -W / 2], [L / 2, -W / 2]].forEach(function (p) { out.push([cx + c * p[0] - s * p[1], cy + s * p[0] + c * p[1]]); });
  return out;
}

/*
 * A building on an axis-aligned footprint, with windows on its visible walls and a roof:
 * o: { k, wall, roof: [light, mid, dark], kind: 'flat' | 'hip', window: color, floors, door: true, tint (flat roof) }
 */
export function building(c, x0, y0, x1, y1, h, o) {
  var k = o.k, L = lift(h), pts = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
  shadowOf(c, pts, h);
  // walls: the front (south, or north when the light is turned) and the visible side (none when drawn flat)
  var fy = LIFT[1] < 0 ? y1 : y0, sxE = LIFT[0] < 0 ? x1 : x0;
  if (isFlat()) o = Object.assign({}, o, { window: null, noWalls: true });
  var front = [[x0, fy], [x1, fy], [x1 + L[0], fy + L[1]], [x0 + L[0], fy + L[1]]];
  var side = [[sxE, y0], [sxE, y1], [sxE + L[0], y1 + L[1]], [sxE + L[0], y0 + L[1]]];
  if (!o.noWalls) [[front, 0.04], [side, -0.2]].forEach(function (fw) {
    path(c, fw[0]); c.fillStyle = shade(o.wall, fw[1]); c.fill(); c.strokeStyle = INK; c.lineWidth = 1.6 / k; c.stroke();
  });
  // windows in rows on the front wall, one row per floor, and a door in the middle
  var floors = o.floors || Math.max(1, Math.round(h / 0.45)), fw2 = x1 - x0;
  if (o.window && fw2 > 0.5) {
    var cols = Math.max(1, Math.floor(fw2 / 0.42));
    for (var f = 0; f < floors; f++) {
      for (var i = 0; i < cols; i++) {
        var u0 = (i + 0.25) / cols, u1 = (i + 0.75) / cols, v0 = (f + 0.3) / floors, v1 = (f + 0.75) / floors;
        if (o.door && f === 0 && i === Math.floor(cols / 2)) {
          var vd = 0.8 / floors;
          path(c, [[x0 + fw2 * u0, fy], [x0 + fw2 * u1, fy], [x0 + fw2 * u1 + L[0] * vd, fy + L[1] * vd], [x0 + fw2 * u0 + L[0] * vd, fy + L[1] * vd]]);
          c.fillStyle = '#7A5534'; c.fill();
          continue;
        }
        path(c, [[x0 + fw2 * u0 + L[0] * v0, fy + L[1] * v0], [x0 + fw2 * u1 + L[0] * v0, fy + L[1] * v0], [x0 + fw2 * u1 + L[0] * v1, fy + L[1] * v1], [x0 + fw2 * u0 + L[0] * v1, fy + L[1] * v1]]);
        c.fillStyle = o.window; c.fill();
      }
    }
    var dep = y1 - y0, rows = Math.max(1, Math.floor(dep / 0.5));
    for (f = 0; f < floors; f++) for (i = 0; i < rows; i++) {
      var a0 = (i + 0.3) / rows, a1 = (i + 0.7) / rows, w0 = (f + 0.3) / floors, w1 = (f + 0.75) / floors;
      path(c, [[sxE + L[0] * w0, y0 + dep * a0 + L[1] * w0], [sxE + L[0] * w0, y0 + dep * a1 + L[1] * w0], [sxE + L[0] * w1, y0 + dep * a1 + L[1] * w1], [sxE + L[0] * w1, y0 + dep * a0 + L[1] * w1]]);
      c.fillStyle = shade(o.window, -0.25); c.fill();
    }
  }
  // the roof
  c.save(); c.translate((x0 + x1) / 2 + L[0], (y0 + y1) / 2 + L[1]);
  if (o.kind === 'hip') {
    var r = o.roof;
    // eaves overhang a little
    hipRoof(c, (x1 - x0) + 0.12, (y1 - y0) + 0.12, r[0], r[1], r[2], k);
  } else {
    c.beginPath(); c.rect(-(x1 - x0) / 2, -(y1 - y0) / 2, x1 - x0, y1 - y0); c.fillStyle = o.tint || '#E3E5EB'; c.fill(); c.strokeStyle = INK; c.lineWidth = 2 / k; c.stroke();
    c.beginPath(); c.rect(-(x1 - x0) / 2 + 0.08, -(y1 - y0) / 2 + 0.08, x1 - x0 - 0.16, y1 - y0 - 0.16); c.strokeStyle = 'rgba(29,26,51,.2)'; c.lineWidth = 1.3 / k; c.stroke();
    if (o.units !== false && x1 - x0 > 0.9 && y1 - y0 > 0.7) {
      // rooftop units with their own little height
      var ux = -(x1 - x0) / 2 + 0.2 + hash(x0, y0, 1) * Math.max(0.05, x1 - x0 - 0.8), uy = -(y1 - y0) / 2 + 0.2 + hash(y0, x0, 2) * Math.max(0.05, y1 - y0 - 0.65);
      c.save(); c.translate(-((x0 + x1) / 2 + L[0]), -((y0 + y1) / 2 + L[1]));
      var bx = (x0 + x1) / 2 + L[0] + ux, by = (y0 + y1) / 2 + L[1] + uy;
      var top2 = prism(c, [[bx, by], [bx + 0.4, by], [bx + 0.4, by + 0.28], [bx, by + 0.28]], 0.16, { k: k, top: '#C9CED8', wall: '#AEB4C2', shadowAlpha: 0.18 });
      c.beginPath(); c.arc((top2[0][0] + top2[2][0]) / 2, (top2[0][1] + top2[2][1]) / 2, 0.09, 0, Math.PI * 2); c.fillStyle = '#8E95A3'; c.fill();
      c.restore();
    }
  }
  c.restore();
}

// an upright cylinder (towers, tanks, posts, trunks)
export function cylinder(c, x, y, r, h, o) {
  var k = o.k, L = lift(h), tx = x + L[0], ty = y + L[1];
  if (o.shadow !== false) { c.beginPath(); c.moveTo(x, y); c.lineTo(x + SHADOW[0] * h, y + SHADOW[1] * h); c.lineWidth = r * 2; c.lineCap = 'round'; c.strokeStyle = 'rgba(29,26,51,.25)'; c.stroke(); }
  // the side: the hull of the base and top circles (nothing to show when drawn flat)
  if (!isFlat()) drawSide();
  function drawSide() {
  var ang = Math.atan2(L[1], L[0]), px = Math.cos(ang + Math.PI / 2) * r, py = Math.sin(ang + Math.PI / 2) * r;
  c.beginPath();
  c.moveTo(x + px, y + py); c.lineTo(tx + px, ty + py); c.lineTo(tx - px, ty - py); c.lineTo(x - px, y - py);
  c.arc(x, y, r, ang - Math.PI / 2, ang + Math.PI / 2, true);
  c.closePath();
  var g = c.createLinearGradient(x - px, y - py, x + px, y + py);
  g.addColorStop(0, shade(o.side, 0.2)); g.addColorStop(1, shade(o.side, -0.25));
  c.fillStyle = g; c.fill(); c.strokeStyle = INK; c.lineWidth = (o.lw || 1.6) / k; c.stroke();
  if (o.bands) o.bands.forEach(function (bd) {
    var a0 = bd[0], a1 = bd[1];
    c.beginPath();
    c.moveTo(x + L[0] * a0 + px, y + L[1] * a0 + py); c.lineTo(x + L[0] * a1 + px, y + L[1] * a1 + py);
    c.lineTo(x + L[0] * a1 - px, y + L[1] * a1 - py); c.lineTo(x + L[0] * a0 - px, y + L[1] * a0 - py); c.closePath();
    c.fillStyle = bd[2]; c.fill();
  });
  }
  c.beginPath(); c.arc(tx, ty, r, 0, Math.PI * 2); c.fillStyle = o.top || shade(o.side, 0.15); c.fill(); c.strokeStyle = INK; c.lineWidth = (o.lw || 1.6) / k; c.stroke();
  return [tx, ty];
}

// a tree standing up: shadow on the grass, a trunk, then the crown lifted to the top of the trunk
export function tree3d(c, x, y, r, kind, hue, k) {
  var h = kind === 'bush' ? 0.15 : r * (kind === 'pine' ? 1.1 : 0.85);
  c.beginPath(); c.ellipse(x + SHADOW[0] * (h + r * 0.6), y + SHADOW[1] * (h + r * 0.6), r * 0.95, r * 0.75, 0.4, 0, Math.PI * 2);
  c.fillStyle = 'rgba(29,26,51,.22)'; c.fill();
  if (kind !== 'bush') cylinder(c, x, y, Math.max(0.06, r * 0.13), h, { k: k, side: '#7A5534', shadow: false, lw: 1.2 });
  var L = lift(h);
  tree(c, x + L[0], y + L[1], r, kind, hue, k);
}

// a car in 2.5D: a low body with a cabin on top, windows, lamps; o: { brake, signal (-1, 0, 1), blink, dot (roof color), amb, flash }
export function car3d(c, x, y, a, len, wid, body, k, o) {
  o = o || {};
  var bodyH = 0.16, cabH = 0.15, cs = Math.cos(a), sn = Math.sin(a);
  var top = prism(c, rectPts(x, y, len, wid, a), bodyH, { k: k, top: body, wall: shade(body, -0.1), shadowAlpha: 0.3 });
  var L1 = lift(bodyH);
  // the cabin, a little behind the middle
  var cx = x - cs * len * 0.06 + L1[0], cy = y - sn * len * 0.06 + L1[1];
  var cab = prism(c, rectPts(cx, cy, len * 0.52, wid * 0.82, a), cabH, { k: k, top: o.amb ? '#FBFBFD' : shade(body, 0.12), wall: '#9CC9D3', shadow: false, lw: 1.3 });
  var L2 = lift(cabH);
  c.save(); c.translate(cx + L2[0], cy + L2[1]); c.rotate(a);
  if (isFlat()) {
    // seen from straight above: a windscreen at the front of the cabin and a rear window
    rr(c, len * 0.12, -wid * 0.36, len * 0.12, wid * 0.72, 0.03); c.fillStyle = 'rgba(156,201,211,.95)'; c.fill();
    rr(c, -len * 0.24, -wid * 0.32, len * 0.08, wid * 0.64, 0.03); c.fillStyle = 'rgba(29,26,51,.25)'; c.fill();
  }
  if (o.amb) {
    c.fillStyle = '#E5483A'; c.fillRect(-len * 0.2, -0.035, len * 0.4, 0.07);
    c.fillStyle = o.flash ? '#3D86F0' : '#FF3B30'; c.fillRect(-0.04, -wid * 0.36, 0.08, wid * 0.32);
    c.fillStyle = o.flash ? '#FF3B30' : '#3D86F0'; c.fillRect(-0.04, 0.04, 0.08, wid * 0.32);
  } else if (o.dot) {
    c.beginPath(); c.arc(0, 0, wid * 0.2, 0, Math.PI * 2); c.fillStyle = o.dot; c.fill(); c.strokeStyle = INK; c.lineWidth = 1.2 / k; c.stroke();
  }
  c.restore();
  // lamps on the body's top edge
  c.save(); c.translate(x + L1[0], y + L1[1]); c.rotate(a);
  c.fillStyle = '#FFF3B0'; c.fillRect(len / 2 - 0.06, -wid / 2 + 0.04, 0.06, 0.09); c.fillRect(len / 2 - 0.06, wid / 2 - 0.13, 0.06, 0.09);
  c.fillStyle = o.brake ? '#FF2D2D' : '#8E2B2B'; c.fillRect(-len / 2, -wid / 2 + 0.04, 0.06, 0.1); c.fillRect(-len / 2, wid / 2 - 0.14, 0.06, 0.1);
  if (o.brake) { c.beginPath(); c.arc(-len / 2, 0, 0.3, Math.PI / 2, Math.PI * 1.5); c.fillStyle = 'rgba(255,45,45,.2)'; c.fill(); }
  if (o.signal && o.blink) { var sy = o.signal > 0 ? wid / 2 : -wid / 2; c.beginPath(); c.arc(len / 2 - 0.08, sy, 0.08, 0, Math.PI * 2); c.arc(-len / 2 + 0.08, sy, 0.08, 0, Math.PI * 2); c.fillStyle = '#FFB020'; c.fill(); }
  c.restore();
  void top; void cab;
}

// a little person standing: a shirt-colored body and a head on top, seen from above at an angle
export function person3d(c, x, y, shirt, skin, k, o) {
  o = o || {};
  var top = cylinder(c, x, y, 0.1, 0.22, { k: k, side: shirt, top: shade(shirt, 0.15), shadow: true, lw: 1.1 });
  var L = lift(0.06), hx = top[0] + L[0], hy = top[1] + L[1];
  c.beginPath(); c.arc(hx, hy, 0.075, 0, Math.PI * 2); c.fillStyle = skin; c.fill(); c.strokeStyle = o.ring || INK; c.lineWidth = (o.ring ? 2 : 1.1) / k; c.stroke();
  c.beginPath(); c.arc(hx - 0.02, hy - 0.02, 0.05, Math.PI, Math.PI * 1.8); c.strokeStyle = '#3B2A20'; c.lineWidth = 2 / k; c.stroke();
}
