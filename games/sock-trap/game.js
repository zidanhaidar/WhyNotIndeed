/*
 * Sock Trap: board drawing, placing items, the live run, and the end screens. A match is five freshly
 * generated offices; win three to win the match.
 * mount() runs after window.Arcade is ready (components/PageShell.jsx) and returns a cleanup function.
 */
import E from './engine.js';

export function mount() {
  var A = window.Arcade;
  var sc = A.scope();
  var GAME = 'sock-trap';
  var W = E.W, H = E.H, CS = 40;
  var NS = 'http://www.w3.org/2000/svg';
  var ORDER = ['pip', 'gridlock', 'monolith', 'edith'];
  var SPEEDS = { normal: 150, fast: 60 };
  var ROUNDS = 5, NEED = 3;

  function $(s) { return document.querySelector(s); }

  var S = {
    level: A.lastLevel(GAME),
    game: null,
    tool: 'chair',
    speed: A.store.get('st-speed', 'normal'),
    paused: false,
    hover: null,
    acc: 0,
    lastFrame: 0,
    lastLine: '',
    moodUntil: 0,
    mood: null,
    match: null // { results: [{ pct, won, base }] } for the offices played so far
  };
  if (!SPEEDS[S.speed]) S.speed = 'normal';

  var TOOLS = [
    { id: 'chair', name: 'Chair', key: '1' },
    { id: 'cable', name: 'Cable', key: '2' },
    { id: 'sock', name: 'Sock', key: '3' },
    { id: 'remove', name: 'Pick up', key: '4' }
  ];

  var TALK = {
    pip: {
      blurb: 'Rookie vacuum. Rolls until it bumps into something, then sniffs around for crumbs.',
      start: ['Vroom! I am going to clean SO much.', 'Crumbs! I can smell crumbs!', 'Is it okay if I just go everywhere?'],
      bump: ['Oof!', 'Who put that there?', 'Ow, my bumper.', 'A wall! Again!'],
      jam: ['Mmmf! A sock!', 'Is this... a sock? It tastes like a sock.', 'Help, I ate laundry.'],
      tangle: ['Cable! Cable! I am all tangled!', 'Why is the floor spaghetti?'],
      spot: [], toss: ['Hey, where did that come from?', 'Was that a sock? Ooh, a sock!'],
      done: 'All clean! Everything I could reach, anyway.', win: ['Battery... so... sleepy...', 'I missed a spot. I missed lots of spots.'],
      lose: ['Spotless! Well, mostly. Okay, a bit.', 'I cleaned it! Do I get a sticker?']
    },
    gridlock: {
      blurb: 'Cleans in tidy stripes. Remembers every chair and cable it bumps into.',
      start: ['Cleaning in straight lines. As one should.', 'Row by row. No surprises.', 'Stripes are the only correct pattern.'],
      bump: ['Obstacle logged.', 'Adding that to my map.', 'Noted. Rerouting.', 'That was not in the plan.'],
      jam: ['Foreign object in the brush.', 'A sock. In my stripes.', 'Unacceptable. Removing sock.'],
      tangle: ['Cable detected. Too late.', 'Untangling. Slowly.'],
      spot: [], toss: ['Another sock. How rude.', 'I saw that.'],
      done: 'Every stripe I can reach is done.', win: ['My stripes. My beautiful stripes.', 'Battery empty. Pattern unfinished.'],
      lose: ['Clean stripes, edge to edge.', 'As expected. Tidy.']
    },
    monolith: {
      blurb: 'Knows the office by heart and always heads for the nearest dusty spot. Spots socks right in front of it.',
      start: ['I have the floor plan memorized.', 'Your chairs will not surprise me for long.', 'Calculating the shortest route to every crumb.'],
      bump: ['Noted.', 'A new chair. Map updated.', 'Recalculating.'],
      jam: ['Clever. A sock I did not see coming.', 'That one was hidden well.'],
      tangle: ['A cable. I will not fall for that twice.', 'Tangled. Logged. Moving on.'],
      spot: ['I see your sock.', 'A sock ahead. Going around.'], toss: ['Throwing socks now? Desperate.', 'A late sock. Interesting.'],
      done: 'Every reachable crumb is gone.', win: ['My battery ran out before my plan did.', 'Impossible. My route was perfect.'],
      lose: ['As planned.', 'Your traps cost me a few seconds. That is all.']
    },
    edith: {
      blurb: 'Knows the office, sees your traps three tiles away and plans around them. Only socks it cannot avoid will stop it.',
      start: ['Hi! I can see everything you put down. Everything!', 'Edith vacuums. Edith never misses.', 'Ooh, decorations? I love decorations. I will go around them.'],
      bump: ['Teehee, bonk.', 'Oops! That one was sneaky.'],
      jam: ['A sock?! Nobody told Edith about this sock!', 'Mmmph! Rude!'],
      tangle: ['Hey! I saw you put that there!', 'Tangled? Me? Never. Okay, once.'],
      spot: ['I see you, little sock!', 'A cable over there? No thank you.', 'Nice try! I spotted it.', 'Chair at two o\'clock. Going around!'],
      toss: ['A flying sock! Edith saw that too.', 'You can throw them all day.'],
      done: 'All done! Edith always finishes.', win: ['Edith... needs... a charger...', 'Wait. Why is it still dirty?'],
      lose: ['Squeaky clean! Like always.', 'Was that your best trap? It was cute!']
    }
  };

  // ---------- small helpers ----------

  function pick(arr) {
    if (!arr || !arr.length) return '';
    var c = arr.filter(function (l) { return l !== S.lastLine; });
    return (c.length ? c : arr)[Math.floor(Math.random() * (c.length ? c.length : arr.length))];
  }
  function cfg() { return E.LEVELS[S.level]; }
  function el(tag, attrs, parent) {
    var n = document.createElementNS(NS, tag);
    Object.keys(attrs || {}).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    if (parent) parent.appendChild(n);
    return n;
  }
  function svgFrag(markup, parent) {
    var g = el('g', {}, parent);
    g.innerHTML = markup;
    return g;
  }

  function say(text, mood, ms) {
    if (!text) return;
    S.lastLine = text;
    var b = $('#bubble');
    b.textContent = text;
    b.classList.remove('pop');
    void b.offsetWidth;
    b.classList.add('pop');
    if (mood) { S.mood = mood; S.moodUntil = performance.now() + (ms || 1400); renderFace(); }
  }

  function sfx(kind) {
    switch (kind) {
      case 'place': A.tone(520, 0.06, 'triangle', 0.05); A.tone(780, 0.05, 'triangle', 0.03, 0.04); break;
      case 'remove': A.tone(380, 0.06, 'triangle', 0.04); break;
      case 'nope': A.tone(150, 0.12, 'square', 0.03); break;
      case 'move': A.noise(0.08, 0.012, 0, 420, 0.6); break;
      case 'bump': A.tone(110, 0.09, 'square', 0.05); A.noise(0.06, 0.04, 0, 300); break;
      case 'jam': A.noise(0.35, 0.05, 0, 900, 0.7); A.tone(420, 0.35, 'sawtooth', 0.03, 0, 120); break;
      case 'tangle': A.tone(240, 0.4, 'sawtooth', 0.035, 0, 70); A.noise(0.25, 0.04, 0.05, 1600); break;
      case 'toss': A.noise(0.18, 0.04, 0, 2400, 1.2); break;
      case 'start': A.tone(330, 0.08, 'square', 0.03); A.tone(494, 0.08, 'square', 0.03, 0.08); A.tone(659, 0.14, 'square', 0.03, 0.16); break;
    }
  }

  // ---------- art ----------

  function cellRng(c) { return E.rng(c * 2654435761 + 97); }

  function dirtArt(c) {
    var r = cellRng(c), out = '';
    var n = 2 + Math.floor(r() * 3);
    for (var i = 0; i < n; i++) {
      var x = 6 + r() * 28, y = 6 + r() * 28;
      out += '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="' + (1.4 + r() * 1.8).toFixed(1) + '" fill="' + ['#7A5230', '#5C3D22', '#8C6A44'][i % 3] + '"/>';
    }
    var k = r();
    if (k < 0.18) out += '<path d="M10 26 q4 -8 10 -4 q6 -6 10 2 q2 6 -6 6 h-10 q-6 0 -4 -4 z" fill="#B7B0A2" stroke="#1D1A33" stroke-width="1.5" opacity=".9"/>';
    else if (k < 0.3) out += '<circle cx="20" cy="20" r="8" fill="none" stroke="#6B4423" stroke-width="2.4" opacity=".7"/>';
    else if (k < 0.38) out += '<rect x="9" y="12" width="14" height="10" rx="1.5" fill="#fff" stroke="#1D1A33" stroke-width="1.3" transform="rotate(' + Math.round(r() * 40 - 20) + ' 16 17)"/>';
    return out;
  }

  var FURN = {
    wall: function () { return '<rect x="0" y="0" width="40" height="40" fill="#3A3355"/><rect x="0" y="0" width="40" height="7" fill="#544A78"/>'; },
    desk: function (x, y) {
      var mon = (x + y) % 2 === 0;
      return '<rect x="2" y="3" width="36" height="34" rx="5" fill="#E2A65C" stroke="#1D1A33" stroke-width="2.5"/><rect x="5" y="6" width="30" height="4" rx="2" fill="#F2C88C"/>' +
        (mon ? '<rect x="10" y="12" width="20" height="13" rx="2" fill="#1D1A33"/><rect x="12" y="14" width="16" height="9" fill="#62B6F0"/><rect x="12" y="28" width="16" height="5" rx="1.5" fill="#fff" stroke="#1D1A33" stroke-width="1.5"/>'
          : '<circle cx="14" cy="22" r="5" fill="#fff" stroke="#1D1A33" stroke-width="2"/><path d="M23 16 h9 v12 h-9 z" fill="#FF6B57" stroke="#1D1A33" stroke-width="1.8"/>');
    },
    plant: function () {
      return '<circle cx="20" cy="22" r="13" fill="#B2643A" stroke="#1D1A33" stroke-width="2.5"/>' +
        '<g fill="#3CB371" stroke="#1D1A33" stroke-width="2"><ellipse cx="13" cy="15" rx="7" ry="10" transform="rotate(-30 13 15)"/><ellipse cx="27" cy="15" rx="7" ry="10" transform="rotate(30 27 15)"/><ellipse cx="20" cy="12" rx="6" ry="11"/></g>';
    },
    counter: function (x) {
      return '<rect x="0" y="2" width="40" height="36" fill="#C9D3DC" stroke="#1D1A33" stroke-width="2.5"/><rect x="0" y="5" width="40" height="3" fill="#E9EEF2"/>' +
        (x % 2 ? '<rect x="9" y="12" width="22" height="18" rx="6" fill="#9AA6B2" stroke="#1D1A33" stroke-width="2"/><circle cx="20" cy="21" r="2" fill="#1D1A33"/>' : '<rect x="8" y="12" width="12" height="14" rx="2" fill="#E8504A" stroke="#1D1A33" stroke-width="2"/><circle cx="29" cy="20" r="5" fill="#fff" stroke="#1D1A33" stroke-width="2"/>');
    },
    shelf: function () {
      var cols = ['#E8504A', '#3D86F0', '#FFC93C', '#2FBF71', '#B07CC6'], s = '<rect x="2" y="2" width="36" height="36" rx="3" fill="#8B5A2B" stroke="#1D1A33" stroke-width="2.5"/>';
      for (var i = 0; i < 5; i++) s += '<rect x="' + (6 + i * 6) + '" y="7" width="5" height="26" fill="' + cols[i] + '" stroke="#1D1A33" stroke-width="1.2"/>';
      return s;
    },
    sofa: function () {
      return '<rect x="1" y="4" width="38" height="32" rx="9" fill="#8E6BBF" stroke="#1D1A33" stroke-width="2.5"/><rect x="5" y="12" width="30" height="20" rx="6" fill="#A98BD6" stroke="#1D1A33" stroke-width="2"/>';
    }
  };

  function itemArt(type) {
    if (type === 'chair') {
      return '<circle cx="20" cy="21" r="14" fill="#1D1A33" opacity=".25"/>' +
        '<g stroke="#1D1A33" stroke-width="2.5"><circle cx="20" cy="20" r="13" fill="#3D86F0"/><rect x="8" y="4" width="24" height="9" rx="4" fill="#2A6AD0"/></g>' +
        '<circle cx="20" cy="22" r="7" fill="#5B9BF5"/><g fill="#1D1A33"><circle cx="6" cy="31" r="2.5"/><circle cx="34" cy="31" r="2.5"/><circle cx="20" cy="36" r="2.5"/></g>';
    }
    if (type === 'cable') {
      var d = 'M2 22 C8 10 14 32 20 20 S30 8 38 20';
      return '<path d="' + d + '" fill="none" stroke="#1D1A33" stroke-width="8" stroke-linecap="round"/><path d="' + d + '" fill="none" stroke="#FFC93C" stroke-width="4" stroke-linecap="round"/>' +
        '<rect x="30" y="14" width="9" height="12" rx="2" fill="#fff" stroke="#1D1A33" stroke-width="2"/>';
    }
    if (type === 'sock') {
      return '<g transform="rotate(-20 20 20)"><path d="M14 4 h12 v17 a8 8 0 0 1 -8 8 h-9 a6 6 0 0 1 0 -12 h5 z" fill="#fff" stroke="#1D1A33" stroke-width="2.5" stroke-linejoin="round"/>' +
        '<path d="M14 8.5 h12 M14 13 h12" stroke="#FF6B57" stroke-width="3"/></g>';
    }
    return '<path d="M10 10 l20 20 M30 10 l-20 20" stroke="#1D1A33" stroke-width="4" stroke-linecap="round"/>';
  }

  function toolIcon(id) {
    return '<svg viewBox="0 0 40 40" aria-hidden="true">' + (id === 'remove'
      ? '<path d="M8 30 c0 -10 6 -16 12 -16 s12 6 12 16" fill="#FFE27A" stroke="#1D1A33" stroke-width="2.5"/><path d="M14 14 v-6 M20 13 v-8 M26 14 v-6" stroke="#1D1A33" stroke-width="3" stroke-linecap="round"/>'
      : itemArt(id)) + '</svg>';
  }

  // ---------- board ----------

  var svg = $('#board');
  var layers = {}, dirtEls = [], shineEls = [], robotEl = null;

  function buildBoard() {
    var g = S.game;
    svg.setAttribute('viewBox', '0 0 ' + (W * CS) + ' ' + (H * CS));
    svg.innerHTML = '<defs><pattern id="carpet" width="80" height="80" patternUnits="userSpaceOnUse">' +
      '<rect width="80" height="80" fill="#6FB9A9"/><rect width="40" height="40" fill="#79C2B2"/><rect x="40" y="40" width="40" height="40" fill="#79C2B2"/></pattern>' +
      '<pattern id="tracks" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(90)"><rect width="10" height="10" fill="#A6E3D6"/><rect width="5" height="10" fill="#B6EBDF"/></pattern></defs>';
    ['floor', 'shine', 'dirt', 'furn', 'dock', 'path', 'items', 'robot', 'fx', 'ghost', 'hit'].forEach(function (k) { layers[k] = el('g', { class: 'layer-' + k }, svg); });
    el('rect', { x: 0, y: 0, width: W * CS, height: H * CS, fill: 'url(#carpet)' }, layers.floor);
    dirtEls = [];
    shineEls = [];
    for (var y = 0; y < H; y++) {
      for (var x = 0; x < W; x++) {
        var c = E.idx(x, y), t = g.tiles[c];
        if (t === 'floor') {
          shineEls[c] = el('rect', { x: x * CS, y: y * CS, width: CS, height: CS, fill: 'url(#tracks)', class: 'shine' }, layers.shine);
          var d = svgFrag(dirtArt(c), layers.dirt);
          d.setAttribute('transform', 'translate(' + x * CS + ' ' + y * CS + ')');
          d.setAttribute('class', 'dirt');
          dirtEls[c] = d;
        } else {
          var f = svgFrag(FURN[t](x, y), layers.furn);
          f.setAttribute('transform', 'translate(' + x * CS + ' ' + y * CS + ')');
        }
      }
    }
    var dk = svgFrag('<rect x="4" y="4" width="32" height="32" rx="8" fill="#1D1A33"/><rect x="7" y="7" width="26" height="26" rx="6" fill="#2FBF71"/>' +
      '<path d="M22 9 l-8 12 h6 l-2 10 l8 -12 h-6 z" fill="#FFE27A" stroke="#1D1A33" stroke-width="1.5" stroke-linejoin="round"/>', layers.dock);
    dk.setAttribute('transform', 'translate(' + g.dock.x * CS + ' ' + g.dock.y * CS + ')');
    el('rect', { x: 0, y: 0, width: W * CS, height: H * CS, fill: 'transparent', class: 'cell' }, layers.hit);
    buildRobot();
    renderBoard(true);
  }

  function buildRobot() {
    var L = A.LEVEL_MAP[S.level];
    robotEl = el('g', { class: 'robot' }, layers.robot);
    robotEl.innerHTML = '<g class="robot-body"><ellipse cx="2" cy="4" rx="18" ry="17" fill="#1D1A33" opacity=".3"/>' +
      '<circle r="18" fill="#F2F2F7" stroke="#1D1A33" stroke-width="2.6"/><circle r="13.5" fill="' + L.color + '" stroke="#1D1A33" stroke-width="1.6"/>' +
      '<g class="bumper"><path d="M-14 -11 a18 18 0 0 1 28 0" fill="none" stroke="#1D1A33" stroke-width="4" stroke-linecap="round"/></g>' +
      '<g class="robot-face"></g></g>' +
      '<g class="stuck-mark" transform="translate(12 -22)"><circle r="9" fill="#FFC93C" stroke="#1D1A33" stroke-width="2"/><text y="5" text-anchor="middle" font-size="14" font-weight="700" fill="#1D1A33">!</text></g>';
    renderRobotFace();
  }

  function renderRobotFace() {
    if (!robotEl) return;
    var holder = robotEl.querySelector('.robot-face');
    var m = currentMood();
    if (holder.dataset.mood === m) return;
    holder.dataset.mood = m;
    holder.innerHTML = A.face(S.level, m).replace('<svg ', '<svg x="-11" y="-9.4" width="22" height="18.8" ');
  }

  function renderBoard(instant) {
    var g = S.game;
    for (var c = 0; c < W * H; c++) {
      if (!dirtEls[c]) continue;
      dirtEls[c].classList.toggle('gone', !!g.clean[c]);
      shineEls[c].classList.toggle('on', !!g.clean[c]);
    }
    renderItems();
    placeRobot(instant);
    renderPath();
  }

  function renderItems() {
    var g = S.game, layer = layers.items;
    var keep = {};
    Object.keys(g.items).forEach(function (c) { keep[c] = g.items[c]; });
    Array.prototype.slice.call(layer.children).forEach(function (n) {
      if (keep[n.dataset.c] !== n.dataset.type) n.remove();
      else delete keep[n.dataset.c];
    });
    Object.keys(keep).forEach(function (c) {
      var x = c % W, y = (c / W) | 0;
      var n = svgFrag(itemArt(keep[c]), layer);
      n.dataset.c = c;
      n.dataset.type = keep[c];
      n.setAttribute('transform', 'translate(' + x * CS + ' ' + y * CS + ')');
      n.firstChild && n.firstChild.setAttribute('class', 'item-pop');
    });
  }

  function placeRobot(instant) {
    var r = S.game.robot;
    robotEl.style.setProperty('--step', (instant ? 0 : SPEEDS[S.speed]) + 'ms');
    robotEl.style.transform = 'translate(' + (r.x * CS + CS / 2) + 'px, ' + (r.y * CS + CS / 2) + 'px)';
    robotEl.querySelector('.bumper').setAttribute('transform', 'rotate(' + [90, 180, 270, 0][r.dir] + ')');
    robotEl.classList.toggle('jammed', r.stuck > 0);
  }

  function renderPath() {
    var g = S.game;
    layers.path.innerHTML = '';
    if (g.phase !== 'run' || !g.path || !g.path.length || g.robot.stuck) return;
    var pts = [[g.robot.x, g.robot.y]].concat(g.path.slice(0, 14).map(function (c) { return [c % W, (c / W) | 0]; }));
    el('polyline', { class: 'robot-path', points: pts.map(function (p) { return (p[0] * CS + CS / 2) + ',' + (p[1] * CS + CS / 2); }).join(' ') }, layers.path);
    var last = pts[pts.length - 1];
    el('circle', { cx: last[0] * CS + CS / 2, cy: last[1] * CS + CS / 2, r: 5, fill: '#fff', stroke: '#1D1A33', 'stroke-width': 2 }, layers.path);
  }

  function ring(x, y) {
    var c = el('circle', { cx: x * CS + CS / 2, cy: y * CS + CS / 2, r: 8, class: 'spot-ring' }, layers.fx);
    sc.timeout(function () { c.remove(); }, 950);
  }

  // ---------- hover and clicks ----------

  function cellAt(e) {
    var pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    var p = pt.matrixTransform(svg.getScreenCTM().inverse());
    var x = Math.floor(p.x / CS), y = Math.floor(p.y / CS);
    return x >= 0 && y >= 0 && x < W && y < H ? { x: x, y: y } : null;
  }

  function actionAt(cell) {
    var g = S.game, c = E.idx(cell.x, cell.y), it = g.items[c];
    if (g.phase === 'setup') {
      if (it) return { kind: 'remove', ok: true, tip: 'Pick up the ' + it };
      if (S.tool === 'remove') return { kind: 'none', ok: false, tip: 'Nothing to pick up here' };
      var why = g.canPlace(cell.x, cell.y, S.tool);
      return { kind: 'place', ok: !why, tip: why || 'Put a ' + S.tool + ' here' };
    }
    if (g.phase === 'run') {
      if (g.left.sock <= 0) return { kind: 'none', ok: false, tip: 'No socks left to toss' };
      var w = g.canPlace(cell.x, cell.y, 'sock');
      return { kind: 'toss', ok: !w, tip: w || 'Toss a sock here (' + g.left.sock + ' left)' };
    }
    return { kind: 'none', ok: false, tip: '' };
  }

  function renderGhost() {
    layers.ghost.innerHTML = '';
    var tip = $('#hover-tip');
    if (!S.hover || S.game.phase === 'over') { tip.hidden = true; return; }
    var a = actionAt(S.hover);
    if (a.kind === 'place' || a.kind === 'toss') {
      var gh = svgFrag(itemArt(a.kind === 'toss' ? 'sock' : S.tool), layers.ghost);
      gh.setAttribute('transform', 'translate(' + S.hover.x * CS + ' ' + S.hover.y * CS + ')');
      gh.setAttribute('class', 'ghost' + (a.ok ? '' : ' bad'));
    }
    el('rect', { x: S.hover.x * CS + 1.5, y: S.hover.y * CS + 1.5, width: CS - 3, height: CS - 3, rx: 6, fill: 'none', stroke: a.ok ? '#fff' : '#FF6B57', 'stroke-width': 3, 'stroke-dasharray': a.ok ? '' : '5 4', class: 'ghost' }, layers.ghost);
    if (!a.tip) { tip.hidden = true; return; }
    var box = svg.getBoundingClientRect(), frame = svg.parentNode.getBoundingClientRect();
    var sx = box.width / (W * CS);
    tip.textContent = a.tip;
    tip.style.left = (box.left - frame.left + (S.hover.x + 0.5) * CS * sx) + 'px';
    tip.style.top = (box.top - frame.top + S.hover.y * CS * sx) + 'px';
    tip.hidden = false;
  }

  var lastPointer = 'mouse';
  svg.addEventListener('pointermove', function (e) {
    lastPointer = e.pointerType;
    if (e.pointerType === 'touch') return;
    var c = cellAt(e);
    if (!c && !S.hover) return;
    if (c && S.hover && c.x === S.hover.x && c.y === S.hover.y) return;
    S.hover = c;
    renderGhost();
  });
  svg.addEventListener('pointerleave', function () { S.hover = null; renderGhost(); });
  svg.addEventListener('click', function (e) {
    var c = cellAt(e);
    if (!c || A.isBoss()) return;
    var a = actionAt(c), g = S.game;
    if (a.kind === 'remove') { g.remove(c.x, c.y); sfx('remove'); }
    else if (a.kind === 'place') {
      if (!a.ok) { sfx('nope'); flashTip(c, a.tip); return; }
      g.place(c.x, c.y, S.tool);
      sfx('place');
      if (g.left[S.tool] === 0) {
        var nextTool = ['chair', 'cable', 'sock'].filter(function (t) { return g.left[t] > 0; })[0];
        if (nextTool) S.tool = nextTool;
      }
    } else if (a.kind === 'toss') {
      if (!a.ok) { sfx('nope'); flashTip(c, a.tip); return; }
      g.place(c.x, c.y, 'sock');
      sfx('toss');
      flushEvents();
    } else if (a.tip) { sfx('nope'); flashTip(c, a.tip); return; }
    S.hover = lastPointer === 'touch' ? null : c;
    renderAll();
  });

  var tipTimer = null;
  function flashTip(c, text) {
    S.hover = c;
    renderGhost();
    $('#hover-tip').textContent = text;
    clearTimeout(tipTimer);
    if (lastPointer === 'touch') tipTimer = sc.timeout(function () { S.hover = null; renderGhost(); }, 1600);
  }

  // ---------- panel ----------

  function currentMood() {
    var g = S.game;
    if (!g) return 'calm';
    if (g.phase === 'over') return g.result === 'win' ? 'dead' : 'happy';
    if (S.mood && performance.now() < S.moodUntil) return S.mood;
    if (g.robot.stuck) return g.robot.stuckBy === 'cable' ? 'panic' : 'surprised';
    if (g.phase === 'run' && g.battery < cfg().battery * 0.25) return 'worried';
    return g.phase === 'run' ? 'smug' : 'calm';
  }

  function renderFace() {
    var m = currentMood(), f = $('#face');
    if (f.dataset.mood !== m || f.dataset.level !== S.level) {
      f.innerHTML = A.face(S.level, m);
      f.dataset.mood = m;
      f.dataset.level = S.level;
    }
    renderRobotFace();
  }

  function renderTray() {
    var g = S.game, tray = $('#tray');
    if (!tray.children.length) {
      TOOLS.forEach(function (t) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'tool';
        b.dataset.tool = t.id;
        b.innerHTML = '<span class="k">' + t.key + '</span>' + toolIcon(t.id) + '<span>' + t.name + '</span>' + (t.id !== 'remove' ? '<span class="n"></span>' : '');
        b.addEventListener('click', function () { setTool(t.id); });
        tray.appendChild(b);
      });
    }
    Array.prototype.forEach.call(tray.children, function (b) {
      var id = b.dataset.tool, n = b.querySelector('.n');
      if (n) n.textContent = g.left[id];
      b.classList.toggle('empty', n && g.left[id] === 0);
      var usable = g.phase === 'setup' ? true : g.phase === 'run' && id === 'sock';
      b.disabled = !usable;
      b.setAttribute('aria-pressed', String(g.phase === 'run' ? id === 'sock' : S.tool === id));
      b.setAttribute('aria-label', (id === 'remove' ? 'Pick up items' : t(id) + ', ' + g.left[id] + ' left') + ', key ' + b.querySelector('.k').textContent);
    });
    function t(id) { return id.charAt(0).toUpperCase() + id.slice(1); }
  }

  function renderPanel() {
    var g = S.game, c = cfg(), L = A.LEVEL_MAP[S.level];
    $('#bot-name').textContent = L.name;
    $('#bot-rank').textContent = L.rank + ' vacuum';
    var t = g.tally(), pct = Math.round(t.pct);
    $('#dirty-num').textContent = pct + '%';
    $('#dirty-fill').style.width = t.pct + '%';
    $('#dirty-goal').style.left = c.target + '%';
    var note = $('#dirty-note');
    if (g.phase === 'setup') {
      note.textContent = 'Keep at least ' + c.target + '% of the floor dirty until its battery dies. It can reach ' + Math.round(g.reach() * 100) + '% of the floor right now.';
      note.className = 'meter-note';
    } else {
      var winning = t.pct >= c.target;
      note.textContent = winning ? 'Above the line: you are winning.' : 'Below the line: it is winning.';
      note.className = 'meter-note ' + (winning ? 'good' : 'bad');
    }
    var bp = Math.max(0, g.battery / c.battery);
    $('#bat-num').textContent = Math.round(bp * 100) + '%';
    $('#bat-fill').style.width = bp * 100 + '%';
    $('.meter-bar.bat').classList.toggle('low', bp < 0.25);
    $('#bat-note').textContent = g.phase === 'setup' ? 'Enough for ' + c.battery + ' moves. Every bump, sock and cable costs it time.' :
      g.robot.stuck ? (g.robot.stuckBy === 'cable' ? 'Tangled in a cable!' : 'Chewing on a sock!') : g.phase === 'over' ? (g.endReason === 'done' ? 'It finished and went home.' : 'Out of juice.') : 'Cleaning...';

    var go = $('#btn-go'), more = S.match.results.length < ROUNDS;
    go.disabled = g.phase === 'run';
    go.innerHTML = g.phase === 'setup' ? 'Let it loose! <kbd>Enter</kbd>' : g.phase === 'run' ? 'Cleaning... toss socks!'
      : more ? 'Next office <kbd>Enter</kbd>' : 'New match <kbd>Enter</kbd>';
    renderRounds();
    $('#btn-reset').disabled = g.phase !== 'setup' || !Object.keys(g.items).length;
    $('#btn-pause').disabled = g.phase !== 'run';
    $('#btn-pause').textContent = S.paused ? 'Resume (P)' : 'Pause (P)';
    $('#btn-speed').textContent = 'Speed: ' + S.speed + ' (F)';
    var hint = g.phase === 'setup'
      ? (lastPointer === 'touch' ? 'Tap' : 'Click') + ' the floor to place the selected item. Chairs block, cables tangle, socks jam. ' + (L.name) + ' starts on the green dock.'
      : g.phase === 'run' ? 'Tap the floor to toss a sock in its way. Socks left: ' + g.left.sock + '.'
      : S.match.results.length < ROUNDS ? 'On to the next office: it will be a brand new floor plan.' : 'Match over. Press New match or pick another vacuum.';
    $('#floor-hint').textContent = hint;
    var best = A.progress(GAME)[S.level];
    $('#best').textContent = best ? 'Your best against ' + L.name + ': ' + best.text + '.' : L.name + ' has never been stopped. Yet.';
    renderTray();
    renderFace();
  }

  // Five pips for the match: won, lost, the office being played, and the ones still to come.
  function roundPips(cls) {
    var res = S.match.results, out = '';
    for (var i = 0; i < ROUNDS; i++) {
      var r = res[i], state = r ? (r.won ? 'won' : 'lost') : i === res.length && S.game.phase !== 'over' ? 'now' : 'next';
      out += '<span class="rnd ' + state + '" title="Office ' + (i + 1) + (r ? ': ' + r.pct + '% dirty, ' + (r.won ? 'won' : 'lost') : '') + '">' +
        (r ? (r.won ? '&#10003;' : '&#10007;') : i + 1) + '</span>';
    }
    return '<span class="' + (cls || 'rnd-pips') + '">' + out + '</span>';
  }
  function renderRounds() {
    var res = S.match.results, wins = res.filter(function (r) { return r.won; }).length, n = Math.min(ROUNDS, res.length + (S.game.phase === 'over' ? 0 : 1));
    $('#rounds').innerHTML = '<span class="rounds-label">Office ' + n + ' of ' + ROUNDS + '<small>' + wins + ' won. Win ' + NEED + ' to take the match.</small></span>' + roundPips();
  }

  function renderAll() {
    renderBoard();
    renderPanel();
    renderGhost();
  }

  function setTool(id) {
    var g = S.game;
    if (g.phase !== 'setup') return;
    S.tool = id;
    A.jingle('tick');
    renderPanel();
    renderGhost();
  }

  // ---------- the run ----------

  // A new match: five offices against this vacuum, starting with the first.
  function newGame() {
    S.match = { results: [] };
    newRound();
  }

  // The next office of the match, with a freshly generated floor plan.
  function newRound() {
    A.closeModal(true);
    S.game = new E.Game(S.level, (Math.random() * 1e9) >>> 0);
    S.paused = false;
    S.mood = null;
    S.tool = 'chair';
    S.acc = 0;
    layers = {};
    buildBoard();
    renderPanel();
    say(pick(TALK[S.level].start));
    $('#bot-name').textContent = A.LEVEL_MAP[S.level].name;
    A.music.intensity(0.4);
  }

  function start() {
    var g = S.game;
    if (A.isBoss() || A.modalOpen()) return;
    if (g.phase === 'over') { if (S.match.results.length < ROUNDS) newRound(); else newGame(); return; }
    if (g.phase !== 'setup') return;
    g.start();
    S.acc = 0;
    S.lastFrame = 0;
    sfx('start');
    S.hover = null;
    flushEvents();
    renderAll();
    A.music.intensity(0.7);
  }

  function flushEvents() {
    var g = S.game, T = TALK[S.level], moved = 0;
    g.events.forEach(function (ev) {
      if (ev.type === 'move') { if (ev.fresh && (moved++ % 2 === 0)) sfx('move'); }
      else if (ev.type === 'bump') {
        sfx('bump');
        faceAnim();
        if (Math.random() < 0.5) say(pick(T.bump), 'annoyed', 900);
      } else if (ev.type === 'jam') { sfx('jam'); say(pick(T.jam), 'surprised', 1500); ring(ev.x, ev.y); }
      else if (ev.type === 'tangle') { sfx('tangle'); say(pick(T.tangle), 'panic', 1800); ring(ev.x, ev.y); }
      else if (ev.type === 'spot') { ring(ev.x, ev.y); if (Math.random() < 0.6) say(pick(T.spot), 'smug', 1200); }
      else if (ev.type === 'toss') { if (Math.random() < 0.5) say(pick(T.toss), 'surprised', 900); }
      else if (ev.type === 'free') { A.tone(660, 0.06, 'triangle', 0.03); }
      else if (ev.type === 'end') sc.timeout(endGame, 450);
    });
    g.events.length = 0;
  }

  function faceAnim() {
    var f = $('#face');
    f.classList.remove('bump');
    void f.offsetWidth;
    f.classList.add('bump');
  }

  function frame(now) {
    sc.raf(frame);
    var g = S.game;
    if (!g || g.phase !== 'run') { S.lastFrame = now; return; }
    var halted = S.paused || A.isBoss() || A.modalOpen() || document.hidden;
    var dt = S.lastFrame ? Math.min(250, now - S.lastFrame) : 0;
    S.lastFrame = now;
    if (halted) return;
    S.acc += dt;
    var stepMs = SPEEDS[S.speed], stepped = false;
    while (S.acc >= stepMs && g.phase === 'run') {
      g.step();
      S.acc -= stepMs;
      stepped = true;
      flushEvents();
    }
    if (stepped) { renderBoard(); renderPanel(); if (S.hover) renderGhost(); }
  }

  // One office is over: note it, then either move on to the next office or settle the match.
  function endGame() {
    var g = S.game, c = cfg(), L = A.LEVEL_MAP[S.level], T = TALK[S.level];
    var t = g.tally(), pct = Math.round(t.pct), won = g.result === 'win', left = g.itemsLeft();
    S.match.results.push({ pct: pct, won: won, base: 20 * pct + (won ? 200 + 30 * left : 0) });
    renderAll();
    A.music.intensity(0.4);
    var res = S.match.results, n = res.length;
    if (n >= ROUNDS) { endMatch(); return; }
    var wins = res.filter(function (r) { return r.won; }).length;
    A.jingle(won ? 'win' : 'lose');
    say(pick(won ? T.win : T.lose));
    var why = g.endReason === 'done' ? L.name + ' cleaned everything it could reach and went home, leaving ' : L.name + '\'s battery died with ';
    A.modal({
      title: 'Office ' + n + ' of ' + ROUNDS + (won ? ': still dirty!' : ': squeaky clean.'),
      tone: won ? 'win' : 'lose',
      html: '<p class="lead">' + why + '<strong>' + pct + '% of the floor</strong> still dirty. You needed ' + c.target + '%.</p>' + roundPips('round-row') +
        '<p><strong>' + wins + ' won, ' + (n - wins) + ' lost.</strong> ' + (wins >= NEED ? 'The match is yours already, but every office still adds points.'
          : n - wins > ROUNDS - NEED ? 'The match is lost, but every office still adds points.' : 'Win ' + NEED + ' of ' + ROUNDS + ' offices to take the match.') + '</p>' +
        '<p class="soft">The next office has a brand new floor plan.</p>',
      buttons: [{ label: 'Next office (' + (n + 1) + ' of ' + ROUNDS + ')', kind: 'main', onClick: newRound }],
      link: { label: 'Close and look at the floor' }
    });
  }

  // All five offices played: score the match.
  function endMatch() {
    var c = cfg(), L = A.LEVEL_MAP[S.level], T = TALK[S.level], res = S.match.results;
    var wins = res.filter(function (r) { return r.won; }).length, won = wins >= NEED;
    var stars = wins >= 5 ? 3 : wins >= 4 ? 2 : wins >= NEED ? 1 : 0;
    var total = res.reduce(function (a, r) { return a + r.base; }, 0) + (won ? 500 + 100 * stars : 0);
    var avg = Math.round(res.reduce(function (a, r) { return a + r.pct; }, 0) / res.length);
    A.account.submit(GAME, S.level, A.points(S.level, total), wins + ' of ' + ROUNDS + ' offices won, ' + avg + '% dirty on average');
    if (won) {
      var rec = A.record(GAME, S.level, { stars: stars, score: total, lowerIsBetter: false, text: 'won ' + wins + ' of ' + ROUNDS + ' offices' });
      bar.refresh();
      A.jingle('win');
      say(pick(T.win));
      var next = ORDER[ORDER.indexOf(S.level) + 1], buttons = [];
      if (next) buttons.push({ label: 'Next vacuum: ' + A.LEVEL_MAP[next].name, kind: 'main', onClick: function () { switchTo(next); } });
      buttons.push({ label: 'New match', kind: next ? 'line' : 'main', onClick: newGame });
      A.modal({
        title: S.level === 'edith' ? 'Edith gave up!' : 'Match won!',
        tone: 'win',
        html: '<p class="lead">You kept <strong>' + wins + ' of ' + ROUNDS + ' offices</strong> dirty enough against ' + L.name + ', with ' + avg + '% of the floor dirty on average.</p>' +
          roundPips('round-row') + A.stars(stars) +
          '<p><strong>' + (rec.better ? (rec.prev ? 'New best for this vacuum!' : 'First match won against ' + L.name + '.') : 'Your best: ' + rec.prev.text + '.') + '</strong></p>' +
          (stars < 3 ? '<p class="soft">Stars: 3 offices won for one, 4 for two, all 5 for three.</p>' : ''),
        buttons: buttons,
        link: { label: 'Close and look at the floor' }
      });
    } else {
      A.jingle('lose');
      say(pick(T.lose));
      A.modal({
        title: 'Squeaky clean.',
        tone: 'lose',
        html: '<p class="lead">' + L.name + ' cleaned well enough in <strong>' + (ROUNDS - wins) + ' of ' + ROUNDS + ' offices</strong>. You needed ' + c.target + '% dirty in at least ' + NEED + '.</p>' +
          roundPips('round-row') +
          '<p class="soft">Tips: block doorways with chairs so whole rooms stay dirty. Socks work best in narrow gaps the robot has to cross. ' +
          (cfg().sense ? L.name + ' spots items before it reaches them, so hide socks where there is no way around.' : 'Cables cost it a long time the first time it hits one.') + '</p>',
        buttons: [{ label: 'New match', kind: 'main', onClick: newGame }],
        link: { label: 'Close and look at the floor' }
      });
    }
  }

  function switchTo(id) {
    S.level = id;
    bar.setLevel(id);
    newGame();
  }

  function busy() {
    var g = S.game, m = S.match;
    var midMatch = m && m.results.length > 0 && m.results.length < ROUNDS;
    return g && (midMatch || g.phase === 'run' || (g.phase === 'setup' && Object.keys(g.items).length > 0));
  }

  // ---------- help ----------

  function openHelp() {
    var rows = ORDER.map(function (id) {
      var L = A.LEVEL_MAP[id], c = E.LEVELS[id];
      return '<div><dt>' + L.name + ', ' + L.rank.toLowerCase() + '</dt><dd>' + TALK[id].blurb + ' Keep ' + c.target + '% dirty. You get ' +
        c.items.chair + ' chairs, ' + c.items.cable + ' cables and ' + c.items.sock + ' socks.</dd></div>';
    }).join('');
    var ic = function (t) { return '<svg viewBox="0 0 40 40">' + itemArt(t) + '</svg>'; };
    A.modal({
      title: 'How to play',
      wide: true,
      html:
        '<p>A robot vacuum wants to clean the whole office. You want it to fail. Place your items on the floor, then let it loose and watch it run its battery down.</p>' +
        '<p>A match is <b>' + ROUNDS + ' offices</b>, each with a brand new floor plan. Keep enough of the floor dirty in at least ' + NEED + ' of them to win the match.</p>' +
        '<ul class="legend">' +
        '<li>' + ic('chair') + '<span><b>Chair.</b> Blocks a tile. Block doorways to keep whole rooms dirty.</span></li>' +
        '<li>' + ic('cable') + '<span><b>Cable.</b> Tangles the robot for a long time. Smart robots remember it and treat it like a wall afterwards.</span></li>' +
        '<li>' + ic('sock') + '<span><b>Sock.</b> The robot slurps it up and jams for a while. You can also toss socks while it runs.</span></li></ul>' +
        '<p>You win if enough of the floor is still dirty when the battery dies (or when the robot runs out of places it can reach). You cannot wall it in completely: it must be able to reach at least ' + Math.round(E.MIN_REACH * 100) + '% of the floor.</p>' +
        '<p class="soft">The dotted line shows where the smarter robots are heading next.</p>' +
        '<h3>Vacuums</h3><dl>' + rows + '</dl>' +
        '<h3>Keys</h3><table class="keys"><tr><td><kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd> <kbd>4</kbd></td><td>Chair, cable, sock, pick up</td></tr>' +
        '<tr><td><kbd>Enter</kbd></td><td>Let the robot loose</td></tr><tr><td><kbd>P</kbd> <kbd>F</kbd></td><td>Pause, change speed</td></tr>' +
        '<tr><td><kbd>R</kbd> <kbd>N</kbd></td><td>Clear your items, new match</td></tr><tr><td><kbd>M</kbd></td><td>Music on or off</td></tr><tr><td><kbd>B</kbd></td><td>Panic button</td></tr></table>',
      buttons: [{ label: 'Hide the socks', kind: 'main' }]
    });
  }

  // ---------- wiring ----------

  var bar = A.mountBar({
    el: $('#bar'),
    game: GAME,
    title: 'Sock Trap',
    tagline: 'Keep the robot vacuum from cleaning the office.',
    level: S.level,
    levelLabel: 'Vacuum',
    canSwitch: function (id) { return busy() ? 'Your match against ' + A.LEVEL_MAP[S.level].name + ' will be abandoned.' : true; },
    onLevel: function (id) { S.level = id; newGame(); },
    onHelp: openHelp
  });
  sc.add(bar.destroy);

  $('#btn-go').addEventListener('click', start);
  $('#btn-pause').addEventListener('click', function () { if (S.game.phase === 'run') { S.paused = !S.paused; renderPanel(); } });
  $('#btn-speed').addEventListener('click', function () {
    S.speed = S.speed === 'normal' ? 'fast' : 'normal';
    A.store.set('st-speed', S.speed);
    renderPanel();
  });
  $('#btn-reset').addEventListener('click', function () {
    var g = S.game;
    if (g.phase !== 'setup') return;
    Object.keys(g.items).forEach(function (c) { g.remove(c % W, (c / W) | 0); });
    sfx('remove');
    renderAll();
  });

  sc.on(document, 'keydown', function (e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    var k = e.key.toLowerCase();
    lastPointer = 'keyboard';
    var tool = TOOLS.filter(function (t) { return t.key === k; })[0];
    if (tool) { setTool(tool.id); return; }
    if (k === 'enter' && !(e.target && e.target.tagName === 'BUTTON')) { e.preventDefault(); start(); return; }
    if (k === 'p') { $('#btn-pause').click(); return; }
    if (k === 'f') { $('#btn-speed').click(); return; }
    if (k === 'r') { $('#btn-reset').click(); return; }
    if (k === 'n') {
      if (!busy()) return newGame();
      A.confirm({ title: 'New match?', text: 'This match is abandoned and you start again from office 1, with a new floor plan.', yes: 'New match', no: 'Keep going', onYes: newGame });
      return;
    }
    if (k === '?') openHelp();
  });

  newGame();
  sc.raf(frame);
  if (A.firstVisit(GAME)) openHelp();

  window.sockTrap = {
    state: S, start: start, newGame: newGame, newRound: newRound,
    // for the dev checks: plays the current office to its end at once
    fastForward: function () {
      var g = S.game;
      if (g.phase === 'setup') start();
      while (g.phase === 'run') g.step();
      flushEvents();
    }
  };
  return sc.dispose;
}
