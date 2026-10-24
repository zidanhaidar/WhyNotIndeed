/*
 * Cable Spaghetti: the desk, drawing cables square by square, the scissors, the robot IT team and the end screen.
 * mount() runs after window.Arcade is ready (components/PageShell.jsx) and returns a cleanup function.
 */
import E from './engine.js';

export function mount() {
  var A = window.Arcade;
  var sc = A.scope();
  var GAME = 'cable-spaghetti';
  var ORDER = ['pip', 'gridlock', 'monolith', 'edith'];
  var CS = 56;
  var NOODLE = { power: ['#F5C542', '#F2B33D', '#F7D35E'], usb: ['#6CBF4A', '#58AE3C', '#86CF63'] };
  var KIND = { power: 'power', usb: 'USB' };
  var KEYS = { arrowup: [0, -1], w: [0, -1], arrowdown: [0, 1], s: [0, 1], arrowleft: [-1, 0], a: [-1, 0], arrowright: [1, 0], d: [1, 0] };

  function $(s) { return document.querySelector(s); }

  var S = { level: A.lastLevel(GAME), d: null, active: null, path: [], drag: false, cut: false, landed: null, news: '', lastLine: '', endShown: false };

  var TALK = {
    pip: {
      blurb: 'Drops each new device anywhere on the desk. Sometimes right next to a socket, sometimes not.',
      rank: 'Rookie IT robot',
      start: ['Hello! I brought gadgets!', 'Where does this go? Anywhere is fine!', 'Plug and play! Mostly play.'],
      drop: ['Catch!', 'One more for the desk!', 'Here is a thing! It needs a cable, I think.'],
      hop: [], end: ['The desk is full? Hooray, a pile!']
    },
    gridlock: {
      blurb: 'Fills the desk row by row from the far corner, always at least two squares from a free socket.',
      rank: 'Pro IT robot',
      start: ['Devices will be delivered in rows.', 'Row by row. From the far corner.', 'A tidy desk is an ordered desk.'],
      drop: ['Next device, next square.', 'Delivered according to plan.'],
      hop: [], end: ['Desk capacity reached. As predicted.']
    },
    monolith: {
      blurb: 'Drops each device right next to your busiest cables, at least two squares from a free socket.',
      rank: 'Grandmaster IT robot',
      start: ['I put things where your cables are thickest.', 'A crowded desk is an interesting desk.', 'Let us see how neat you really are.'],
      drop: ['Right beside your busiest cables.', 'This square looked lonely.'],
      hop: [], end: ['Spaghetti, as foretold.']
    },
    edith: {
      blurb: 'Drops devices on the square that cuts off the most free desk, three squares from a socket, and moves the strips she brings until you use them.',
      rank: 'Impossible IT robot',
      start: ['Hi! I put gadgets exactly where you do not want them. Hee hee.', 'Edith IT support, at your service!', 'My spare strips like to move around.'],
      drop: ['Right in the middle! Is that a problem?', 'Oopsie, was that your shortcut?', 'This spot was free. Was.'],
      hop: ['Whoops, my strip moved!', 'Wheee, new spot for my strip!'], end: ['Edith wins! Your desk is lasagna now.']
    }
  };

  // device art, drawn around (0, 0) inside a 44 x 44 tile
  var ICON = {
    lamp: '<path d="M-10 14 h20" stroke="#1D1A33" stroke-width="4" stroke-linecap="round"/><path d="M0 14 L-4 -2 L6 -8" fill="none" stroke="#1D1A33" stroke-width="3"/><path d="M2 -15 L15 -4 L4 2 Z" fill="#FFD45C" stroke="#1D1A33" stroke-width="2.5" stroke-linejoin="round"/>',
    monitor: '<rect x="-15" y="-13" width="30" height="20" rx="3" fill="#3D86F0" stroke="#1D1A33" stroke-width="2.5"/><path d="M-11 -9 h8" stroke="#fff" stroke-width="2" opacity=".7"/><path d="M0 7 v6 M-7 14 h14" stroke="#1D1A33" stroke-width="3" stroke-linecap="round"/>',
    printer: '<rect x="-15" y="-4" width="30" height="14" rx="3" fill="#E6EBF5" stroke="#1D1A33" stroke-width="2.5"/><rect x="-9" y="-14" width="18" height="11" fill="#fff" stroke="#1D1A33" stroke-width="2"/><rect x="-9" y="6" width="18" height="9" fill="#fff" stroke="#1D1A33" stroke-width="2"/><circle cx="10" cy="1" r="2" fill="#2FBF71"/>',
    fan: '<circle r="14" fill="#E6EBF5" stroke="#1D1A33" stroke-width="2.5"/><path d="M0 0 C-4 -10 6 -12 4 -2 Z M0 0 C10 -2 10 8 2 4 Z M0 0 C-2 10 -12 6 -6 0 Z" fill="#7E97C9" stroke="#1D1A33" stroke-width="1.5"/><circle r="2.5" fill="#1D1A33"/>',
    kettle: '<path d="M-12 12 h24 l-3 -16 a9 9 0 0 0 -18 0 z" fill="#FF6B57" stroke="#1D1A33" stroke-width="2.5" stroke-linejoin="round"/><path d="M-9 -8 h18" stroke="#1D1A33" stroke-width="3" stroke-linecap="round"/><path d="M11 -2 q8 0 6 8" fill="none" stroke="#1D1A33" stroke-width="2.5"/><path d="M-12 0 l-6 -6" stroke="#1D1A33" stroke-width="3" stroke-linecap="round"/>',
    radio: '<rect x="-15" y="-8" width="30" height="20" rx="4" fill="#B83B7D" stroke="#1D1A33" stroke-width="2.5"/><circle cx="-6" cy="2" r="5.5" fill="#1D1A33"/><path d="M4 -2 h7 M4 3 h7" stroke="#fff" stroke-width="2"/><path d="M8 -8 L14 -16" stroke="#1D1A33" stroke-width="2.5" stroke-linecap="round"/>',
    mouse: '<path d="M0 -14 a10 12 0 0 1 10 12 v6 a10 10 0 0 1 -20 0 v-6 a10 12 0 0 1 10 -12 z" fill="#E6EBF5" stroke="#1D1A33" stroke-width="2.5"/><path d="M0 -14 v9 M-9 -4 h18" stroke="#1D1A33" stroke-width="2"/>',
    webcam: '<circle cy="-3" r="11" fill="#2B2440" stroke="#1D1A33" stroke-width="2.5"/><circle cy="-3" r="5" fill="#3D86F0" stroke="#fff" stroke-width="1.5"/><path d="M-8 14 h16 M0 8 v6" stroke="#1D1A33" stroke-width="3" stroke-linecap="round"/>',
    phone: '<rect x="-8" y="-15" width="16" height="30" rx="4" fill="#1D1A33"/><rect x="-6" y="-11" width="12" height="20" rx="1.5" fill="#4FE3D0"/><circle cy="12" r="1.5" fill="#fff"/>',
    headset: '<path d="M-12 4 v-4 a12 12 0 0 1 24 0 v4" fill="none" stroke="#1D1A33" stroke-width="3.5"/><rect x="-16" y="0" width="9" height="13" rx="3" fill="#EF6C2B" stroke="#1D1A33" stroke-width="2.5"/><rect x="7" y="0" width="9" height="13" rx="3" fill="#EF6C2B" stroke="#1D1A33" stroke-width="2.5"/>',
    'USB stick': '<rect x="-6" y="-14" width="12" height="22" rx="3" fill="#7E97C9" stroke="#1D1A33" stroke-width="2.5"/><rect x="-4" y="8" width="8" height="7" fill="#C9CED8" stroke="#1D1A33" stroke-width="2"/>'
  };

  function pick(arr) {
    if (!arr || !arr.length) return '';
    var c = arr.filter(function (l) { return l !== S.lastLine; });
    c = c.length ? c : arr;
    return c[Math.floor(Math.random() * c.length)];
  }
  function L() { return A.LEVEL_MAP[S.level]; }
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
  function cue(text, bad) {
    var c = $('#cue');
    c.textContent = text;
    c.className = 'cue' + (bad ? ' bad' : '');
    c.hidden = false;
    sc.timeout(function () { c.hidden = true; }, 1100);
  }

  function sfx(kind) {
    switch (kind) {
      case 'step': A.tone(520 + 30 * (S.path.length % 8), 0.04, 'triangle', 0.03); break;
      case 'plug': A.tone(300, 0.05, 'square', 0.04); A.tone(900, 0.08, 'triangle', 0.04, 0.05); break;
      case 'neat': A.tone(784, 0.08, 'triangle', 0.04); A.tone(1046, 0.14, 'triangle', 0.04, 0.08); break;
      case 'drop': A.tone(200, 0.12, 'sine', 0.05, 0, 120); break;
      case 'snip': A.noise(0.05, 0.05, 0, 3000); A.tone(1600, 0.03, 'square', 0.02, 0.02); break;
      case 'leave': A.tone(700, 0.15, 'sine', 0.03, 0, 1100); break;
      case 'strip': A.tone(440, 0.08, 'triangle', 0.04); A.tone(660, 0.12, 'triangle', 0.04, 0.09); break;
      case 'nope': A.tone(160, 0.08, 'square', 0.03); break;
    }
  }

  // ---------- the desk ----------

  var svg = $('#desk');

  function ctr(i) { return [E.cx(i) * CS + CS / 2, E.cy(i) * CS + CS / 2]; }
  function activeDev() {
    var d = S.d, dev = S.active != null && d.devices[S.active];
    if (dev && !dev.plugged) return dev;
    var list = d.unplugged();
    dev = list[list.length - 1] || null;
    S.active = dev ? dev.id : null;
    return dev;
  }
  function noodle(dev) { var c = NOODLE[dev.kind]; return c[dev.id % c.length]; }
  function line(points) { return points.map(function (p, k) { return (k ? 'L' : 'M') + p[0] + ' ' + p[1]; }).join(' '); }

  function cableSvg(cells, color, preview) {
    var pts = cells.map(ctr), d = line(pts);
    if (preview) {
      return '<path d="' + d + '" fill="none" stroke="#1D1A33" stroke-width="14" stroke-linecap="round" stroke-linejoin="round" opacity=".55"/>' +
        '<path d="' + d + '" fill="none" stroke="' + color + '" stroke-width="9" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="10 7"/>';
    }
    return '<path d="' + d + '" fill="none" stroke="#1D1A33" stroke-width="15" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<path d="' + d + '" fill="none" stroke="' + color + '" stroke-width="9.5" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<path d="' + d + '" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" opacity=".45" transform="translate(-1.5 -1.5)"/>';
  }

  function stripSvg(s) {
    var d = S.d, xs = s.cells.map(E.cx), ys = s.cells.map(E.cy);
    var x0 = Math.min.apply(null, xs) * CS + 5, y0 = Math.min.apply(null, ys) * CS + 5;
    var x1 = (Math.max.apply(null, xs) + 1) * CS - 5, y1 = (Math.max.apply(null, ys) + 1) * CS - 5;
    var power = s.kind === 'power', spare = s.robot && S.d.cfg.hop && s.cells.every(function (i) { return d.cells[i].dev == null; });
    var out = '<rect x="' + x0 + '" y="' + y0 + '" width="' + (x1 - x0) + '" height="' + (y1 - y0) + '" rx="14" fill="' + (power ? '#FFF8EC' : '#3A3A44') + '" stroke="' +
      (spare ? L().color : '#1D1A33') + '" stroke-width="3"' + (spare ? ' stroke-dasharray="8 5"' : '') + '/>';
    s.cells.forEach(function (i) {
      var c = ctr(i), cell = d.cells[i];
      if (power) {
        out += '<circle cx="' + c[0] + '" cy="' + c[1] + '" r="14" fill="#F1E6D0" stroke="#1D1A33" stroke-width="2"/>' +
          '<rect x="' + (c[0] - 6) + '" y="' + (c[1] - 6) + '" width="3.5" height="10" rx="1.5" fill="#1D1A33"/><rect x="' + (c[0] + 2.5) + '" y="' + (c[1] - 6) + '" width="3.5" height="10" rx="1.5" fill="#1D1A33"/>';
      } else {
        out += '<rect x="' + (c[0] - 11) + '" y="' + (c[1] - 7) + '" width="22" height="14" rx="3" fill="#1D1A33" stroke="#9AA3AD" stroke-width="2"/><rect x="' + (c[0] - 7) + '" y="' + (c[1] - 3) + '" width="14" height="4" fill="#C9CED8"/>';
      }
      if (cell.dev != null) {
        var dev = d.devices[cell.dev];
        out += '<rect x="' + (c[0] - 12) + '" y="' + (c[1] - 12) + '" width="24" height="24" rx="6" fill="' + (dev ? noodle(dev) : '#ccc') + '" stroke="#1D1A33" stroke-width="2.5"/>';
      }
    });
    if (spare) out += '<text x="' + ((x0 + x1) / 2) + '" y="' + (y0 - 1) + '" font-size="11" text-anchor="middle" fill="#fff" stroke="#1D1A33" stroke-width="3" paint-order="stroke">spare</text>';
    return out;
  }

  function deviceSvg(dev) {
    var c = ctr(dev.cell), unplugged = !dev.plugged, border = dev.kind === 'power' ? '#F2B33D' : '#58AE3C';
    var out = '<g transform="translate(' + c[0] + ' ' + c[1] + ')"><g class="' + (S.landed === dev.id ? 'landed' : '') + '">';
    if (unplugged) out += '<circle r="27" fill="none" stroke="#FFD45C" stroke-width="4" stroke-dasharray="7 5" class="active-ring"/>';
    out += '<rect x="-22" y="-22" width="44" height="44" rx="11" fill="#fff" stroke="#1D1A33" stroke-width="3"/>' +
      '<rect x="-18.5" y="-18.5" width="37" height="37" rx="8" fill="none" stroke="' + border + '" stroke-width="2.5"/>' + ICON[dev.name];
    if (dev.visit != null) {
      out += '<circle cx="17" cy="-17" r="9" fill="#C93A2E" stroke="#1D1A33" stroke-width="2"/><text x="17" y="-13" font-size="11.5" text-anchor="middle" fill="#fff">' + dev.visit + '</text>';
    }
    return out + '</g></g>';
  }

  function render() {
    var d = S.d, W = d.W, H = d.H, out = '';
    svg.setAttribute('viewBox', '0 0 ' + W * CS + ' ' + H * CS);
    out += '<rect width="' + W * CS + '" height="' + H * CS + '" rx="10" fill="#C98B4E"/>';
    for (var gy = 1; gy < H * 4; gy++) {
      var yy = gy * CS / 4 + ((gy * 37) % 9) - 4;
      out += '<path d="M0 ' + yy + ' C' + (W * CS * 0.3) + ' ' + (yy + 6) + ' ' + (W * CS * 0.6) + ' ' + (yy - 6) + ' ' + W * CS + ' ' + (yy + 2) + '" stroke="#B87A40" stroke-width="1.6" fill="none" opacity=".55"/>';
    }
    for (var y = 0; y <= H; y++) for (var x = 0; x <= W; x++) out += '<circle cx="' + x * CS + '" cy="' + y * CS + '" r="1.8" fill="#8C5A2B" opacity=".6"/>';
    var dev = activeDev();
    d.strips.forEach(function (s) { out += stripSvg(s); });
    // sockets the cable you are drawing can go to
    if (dev && !S.cut) {
      d.strips.forEach(function (s) {
        if (s.kind !== dev.kind) return;
        s.cells.forEach(function (i) {
          if (d.cells[i].dev != null) return;
          var c = ctr(i);
          out += '<circle cx="' + c[0] + '" cy="' + c[1] + '" r="20" fill="none" stroke="#FFD45C" stroke-width="5" class="target"/>';
        });
      });
    }
    Object.keys(d.devices).forEach(function (k) {
      var v = d.devices[k];
      if (v.plugged) out += cableSvg([v.cell].concat(v.wires, [v.outlet]), noodle(v));
    });
    out += '<g id="preview"></g>';
    Object.keys(d.devices).forEach(function (k) { out += deviceSvg(d.devices[k]); });
    svg.innerHTML = out;
    S.landed = null;
    svg.classList.toggle('cutting', S.cut);
    renderPreview();
  }

  function renderPreview() {
    var g = svg.querySelector('#preview'), dev = activeDev();
    if (!g) return;
    g.innerHTML = dev && S.path.length > 1 ? cableSvg(S.path, noodle(dev), true) : '';
  }

  function renderPanel() {
    var d = S.d, Lv = L(), dev = activeDev();
    $('#bot-name').textContent = Lv.name;
    $('#bot-rank').textContent = TALK[S.level].rank;
    $('#plugged').textContent = d.plugged;
    $('#neat').textContent = d.neat;
    $('#sock-power').textContent = d.freeSockets('power');
    $('#sock-usb').textContent = d.freeSockets('usb');
    $('#scissors').textContent = d.scissors;
    $('#btn-cut').setAttribute('aria-pressed', String(S.cut));
    $('#btn-cut').disabled = d.over || (!S.cut && d.scissors <= 0);
    $('#btn-undo').disabled = d.over || S.path.length < 2;
    $('#btn-stop').disabled = d.over;
    var now;
    if (d.over) now = d.reason + ' Press New desk to start again.';
    else if (S.cut) now = 'Scissors out: click any cable to snip it. That device then needs a new cable. Press C to put them away.';
    else if (dev) {
      now = 'Plug in the <b>' + A.esc(dev.name) + '</b>: drag from it to a free ' + KIND[dev.kind] + ' socket' + (dev.kind === 'power' ? ' (yellow cable).' : ' (green cable).') +
        (dev.visit != null ? ' It goes home after ' + dev.visit + ' more device' + (dev.visit === 1 ? '' : 's') + '.' : ' It is staying for good.');
    } else now = '';
    if (S.news) now = A.esc(S.news) + ' ' + now;
    $('#now').innerHTML = now;
    var best = A.progress(GAME)[S.level];
    $('#best').textContent = best ? 'Your best against ' + Lv.name + ': ' + best.text + '.' : 'No desk against ' + Lv.name + ' yet. Stars at ' + E.STARS.join(', ') + ' devices.';
    var full = 0, cells = d.W * d.H;
    for (var i = 0; i < E.MAX_W * E.MAX_H; i++) if (d.active(i) && d.cells[i]) full++;
    A.music.intensity(Math.min(0.95, 0.35 + 0.7 * full / cells));
  }

  function renderTips() {
    var tips = [
      'Drag from the new device, square by square, to a free socket of its kind. Cables never cross.',
      'Yellow cables go to power strips, green ones to USB hubs.',
      'The shortest possible cable counts as neat and scores extra. Keep open desk for later devices.',
      'Devices with a red number go home after that many more devices and free their cable.',
      'Snip a cable with the scissors to re-route it. You get one more pair every 12 devices.'
    ];
    $('#tips').innerHTML = tips.map(function (t) { return '<li>' + A.esc(t) + '</li>'; }).join('');
  }

  function renderAll() { render(); renderPanel(); }

  // ---------- drawing a cable ----------

  function busy() { return !S.d || S.d.over || A.isBoss() || A.modalOpen(); }

  function canStep(c, dev) {
    var d = S.d;
    return c >= 0 && S.path.indexOf(c) < 0 && (d.free(c) || d.freeOutlet(c, dev.kind));
  }

  // Walks the cable end one square at a time towards `target`; stepping back undoes. Plugs in at a socket.
  function towards(target) {
    var d = S.d, dev = activeDev(), moved = false;
    if (!dev || target < 0) return false;
    if (!S.path.length) S.path = [dev.cell];
    for (var guard = 0; guard < 40; guard++) {
      var end = S.path[S.path.length - 1];
      if (end === target) break;
      var at = S.path.indexOf(target);
      if (at >= 0) { S.path = S.path.slice(0, at + 1); moved = true; break; }
      var ex = E.cx(end), ey = E.cy(end), tx = E.cx(target), ty = E.cy(target), opts = [];
      if (tx !== ex) opts.push(E.idx(ex + Math.sign(tx - ex), ey));
      if (ty !== ey) opts.push(E.idx(ex, ey + Math.sign(ty - ey)));
      if (Math.abs(ty - ey) > Math.abs(tx - ex)) opts.reverse();
      var next = opts.filter(function (c) { return canStep(c, dev); })[0];
      if (next == null) break;
      S.path.push(next);
      moved = true;
      sfx('step');
      if (d.freeOutlet(next, dev.kind)) { finish(); return true; }
    }
    if (moved) { renderPreview(); renderPanel(); }
    return moved;
  }

  function finish() {
    var d = S.d, dev = activeDev();
    S.drag = false;
    S.news = '';
    if (!dev || !d.plug(dev.id, S.path)) { sfx('nope'); S.path = []; renderAll(); return; }
    S.path = [];
    S.active = null;
    handleEvents();
    renderAll();
  }

  function cutAt(c) {
    var d = S.d, cell = d.cells[c], id = null;
    if (cell && (cell.t === 'wire' || cell.t === 'dev')) id = cell.id;
    else if (cell && cell.t === 'out') id = cell.dev;
    if (id == null || !d.devices[id] || !d.devices[id].plugged) { sfx('nope'); return; }
    S.path = [];
    d.cut(id);
    S.cut = false;
    S.active = id;
    S.news = '';
    handleEvents();
    renderAll();
  }

  function handleEvents() {
    var d = S.d, T = TALK[S.level], msg = null, news = [];
    d.events.forEach(function (ev) {
      if (ev.type === 'plug') { sfx(ev.neat ? 'neat' : 'plug'); if (ev.neat) msg = msg || 'Neat!'; }
      else if (ev.type === 'cut') sfx('snip');
      else if (ev.type === 'leave') { sfx('leave'); news.push('The ' + ev.name + ' went home.'); }
      else if (ev.type === 'strip') { sfx('strip'); msg = ev.kind === 'power' ? 'New power strip!' : 'New USB hub!'; }
      else if (ev.type === 'grow') { msg = msg && msg !== 'Neat!' ? msg : 'The desk got bigger!'; }
      else if (ev.type === 'scissors') news.push('You found another pair of scissors.');
      else if (ev.type === 'rescue') { sfx('strip'); msg = 'More desk!'; news.push('The desk was full, so IT brought an extra section and a new ' + (ev.kind === 'power' ? 'power strip.' : 'USB hub.')); }
      else if (ev.type === 'hop') { say(pick(T.hop), 'happy'); }
      else if (ev.type === 'arrive') {
        S.landed = ev.id;
        sfx('drop');
        if (Math.random() < 0.3) say(pick(T.drop), 'smug');
      } else if (ev.type === 'end') { sc.timeout(endGame, 700); }
    });
    d.events.length = 0;
    if (msg) cue(msg);
    S.news = news.join(' ');
  }

  // ---------- the shift ----------

  function newDesk() {
    A.closeModal(true);
    S.d = new E.Desk(S.level, (Math.random() * 1e9) >>> 0);
    S.d.events.length = 0;
    S.active = null;
    S.path = [];
    S.cut = false;
    S.news = '';
    S.endShown = false;
    renderAll();
    renderTips();
    say(pick(TALK[S.level].start), 'smug');
  }

  function endGame() {
    var d = S.d, Lv = L(), T = TALK[S.level];
    if (S.endShown) return;
    S.endShown = true;
    var stars = d.stars(), n = d.plugged;
    A.account.submit(GAME, S.level, A.points(S.level, d.points()), n + ' devices, ' + d.neat + ' neat');
    var rec = A.record(GAME, S.level, { stars: stars, score: n, lowerIsBetter: false, text: n + ' devices' });
    bar.refresh();
    renderAll();
    A.jingle(stars ? 'win' : 'lose');
    say(pick(T.end), stars ? 'annoyed' : 'happy');
    var next = ORDER[ORDER.indexOf(S.level) + 1], buttons = [{ label: 'New desk', kind: 'main', onClick: newDesk }];
    if (stars && next) buttons.push({ label: 'Next robot: ' + A.LEVEL_MAP[next].name, kind: 'line', onClick: function () { switchTo(next); } });
    var note = rec.better ? (rec.prev ? 'New best against ' + Lv.name + '!' : 'Your first desk against ' + Lv.name + ' is on the books.') : 'Your best: ' + rec.prev.text + '.';
    A.modal({
      title: stars === 3 ? 'Cable maestro!' : stars ? 'What a tidy desk!' : 'Total spaghetti!',
      tone: stars ? 'win' : 'lose',
      html: '<p class="lead">You plugged in <strong>' + n + ' devices</strong>, ' + d.neat + ' of them with a neat cable, on a desk of ' + d.W + ' by ' + d.H + ' squares.</p>' +
        '<p>' + A.esc(d.reason) + '</p>' + A.stars(stars) + '<p><strong>' + note + '</strong></p>' +
        (stars < 3 ? '<p class="soft">Stars at ' + E.STARS.join(', ') + ' devices. Tip: short cables leave room for later, and cables along the edge keep the middle of the desk open.</p>' : ''),
      buttons: buttons,
      link: { label: 'Close and look at the desk' }
    });
  }

  function switchTo(id) {
    S.level = id;
    bar.setLevel(id);
    newDesk();
  }

  function openHelp() {
    var rows = ORDER.map(function (id) {
      var Lv = A.LEVEL_MAP[id];
      return '<div><dt>' + Lv.name + ', ' + Lv.rank.toLowerCase() + '</dt><dd>' + TALK[id].blurb + '</dd></div>';
    }).join('');
    A.modal({
      title: 'How to play',
      wide: true,
      html: '<p>The robot IT team keeps bringing gadgets to your desk, and every one needs a cable. The desk never stops filling: plug in as many devices as you can before one has nowhere to go.</p>' +
        '<ol><li>A new device lands with a dashed ring. Drag from it, square by square, to a glowing free socket: power strips for yellow cables, USB hubs for green ones.</li>' +
        '<li>Cables can never cross or share a square, and they cannot pass over devices or strips.</li>' +
        '<li>The shortest possible cable is a neat cable and scores extra.</li>' +
        '<li>Some devices go home after a while (the red number) and free their cable. New strips arrive and the desk grows.</li>' +
        '<li>Out of room? Snip a cable with the scissors and route it again.</li></ol>' +
        '<h3>Robots</h3><dl>' + rows + '</dl>' +
        '<h3>Keys</h3><table class="keys"><tr><td><kbd>&uarr;</kbd> <kbd>&darr;</kbd> <kbd>&larr;</kbd> <kbd>&rarr;</kbd> or <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd></td><td>Lay the cable one square</td></tr>' +
        '<tr><td><kbd>Backspace</kbd></td><td>Undo a square</td></tr><tr><td><kbd>Esc</kbd></td><td>Start the cable over</td></tr>' +
        '<tr><td><kbd>C</kbd></td><td>Scissors</td></tr><tr><td><kbd>N</kbd></td><td>New desk</td></tr>' +
        '<tr><td><kbd>M</kbd></td><td>Music on or off</td></tr><tr><td><kbd>B</kbd></td><td>Panic button</td></tr></table>',
      buttons: [{ label: 'Untangle it', kind: 'main' }]
    });
  }

  var bar = A.mountBar({
    el: $('#bar'),
    game: GAME,
    title: 'Cable Spaghetti',
    tagline: 'Plug everything in. Never cross the cables.',
    level: S.level,
    levelLabel: 'Robot',
    canSwitch: function () { return S.d && !S.d.over && S.d.plugged > 2 ? 'This desk will be cleared.' : true; },
    onLevel: function (id) { S.level = id; newDesk(); },
    onHelp: openHelp
  });
  sc.add(bar.destroy);

  // ---------- input ----------

  function cellAt(e) {
    var ctm = svg.getScreenCTM();
    if (!ctm) return -1;
    var pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    var p = pt.matrixTransform(ctm.inverse()), x = Math.floor(p.x / CS), y = Math.floor(p.y / CS);
    return x >= 0 && y >= 0 && x < S.d.W && y < S.d.H ? E.idx(x, y) : -1;
  }

  svg.addEventListener('pointerdown', function (e) {
    if (busy() || e.button > 0) return;
    var c = cellAt(e), d = S.d;
    if (c < 0) return;
    if (S.cut) { cutAt(c); return; }
    var cell = d.cells[c];
    if (cell && cell.t === 'dev' && !d.devices[cell.id].plugged && S.active !== cell.id) {
      S.active = cell.id;
      S.path = [c];
      render();
      renderPanel();
    }
    var dev = activeDev();
    if (!dev) return;
    if (!S.path.length) S.path = [dev.cell];
    var at = S.path.indexOf(c);
    if (at >= 0) S.path = S.path.slice(0, at + 1);
    else if (!towards(c)) return;
    if (!S.d.over && activeDev()) {
      S.drag = true;
      try { svg.setPointerCapture(e.pointerId); } catch (err) { /* pointer already gone */ }
    }
    e.preventDefault();
    renderPreview();
    renderPanel();
  });
  svg.addEventListener('pointermove', function (e) {
    if (!S.drag || busy()) return;
    towards(cellAt(e));
  });
  function release() { S.drag = false; }
  svg.addEventListener('pointerup', release);
  svg.addEventListener('pointercancel', release);

  function undoStep() {
    if (S.path.length > 1) { S.path.pop(); renderPreview(); renderPanel(); }
  }
  function toggleCut() {
    var d = S.d;
    if (busy()) return;
    if (!S.cut && (d.scissors <= 0 || !Object.keys(d.devices).some(function (k) { return d.devices[k].plugged; }))) { sfx('nope'); return; }
    S.cut = !S.cut;
    S.path = [];
    renderAll();
  }

  $('#btn-cut').addEventListener('click', toggleCut);
  $('#btn-undo').addEventListener('click', undoStep);
  $('#btn-stop').addEventListener('click', function () {
    if (busy()) return;
    A.confirm({ title: 'Call it a day?', text: 'Your desk ends here and the devices you plugged in count for the leaderboard.', yes: 'Call it a day', no: 'Keep plugging', onYes: function () {
      S.d.giveUp();
      handleEvents();
      renderAll();
    } });
  });
  $('#btn-new').addEventListener('click', function () {
    if (!(S.d && !S.d.over && S.d.plugged > 2)) return newDesk();
    A.confirm({ title: 'New desk?', text: 'This desk will be cleared and the robot starts over.', yes: 'New desk', no: 'Keep plugging', onYes: newDesk });
  });

  sc.on(document, 'keydown', function (e) {
    if (e.ctrlKey || e.metaKey || e.altKey || A.modalOpen()) return;
    var k = e.key.toLowerCase();
    if (KEYS[k]) {
      e.preventDefault();
      if (busy() || S.cut) return;
      var dev = activeDev();
      if (!dev) return;
      if (!S.path.length) S.path = [dev.cell];
      var end = S.path[S.path.length - 1], nx = E.cx(end) + KEYS[k][0], ny = E.cy(end) + KEYS[k][1];
      if (nx < 0 || ny < 0 || nx >= S.d.W || ny >= S.d.H) { sfx('nope'); return; }
      if (!towards(E.idx(nx, ny))) sfx('nope');
      return;
    }
    if (k === 'backspace') { e.preventDefault(); undoStep(); return; }
    if (k === 'escape') { S.path = []; renderPreview(); renderPanel(); return; }
    if (k === 'c') { toggleCut(); return; }
    if (k === 'n') { $('#btn-new').click(); return; }
    if (k === '?') openHelp();
  });

  newDesk();
  if (A.firstVisit(GAME)) openHelp();

  window.cableSpaghetti = { state: S, towards: towards, newDesk: newDesk, cutAt: cutAt };
  return sc.dispose;
}
