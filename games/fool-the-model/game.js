/*
 * Fool the Model: change as few pixels as possible so the sorting machine misreads the digit.
 * Models and rounds come from data.json (trained offline on scikit-learn's 8x8 digits).
 */
import D from './data.json';

export function mount() {
  var A = window.Arcade;
  var sc = A.scope();
  var GAME = 'fool-the-model';
  function $(s) { return document.querySelector(s); }

  var LV = {
    pip: {
      rounds: 5, need: 3, hints: Infinity,
      model: 'Plain linear model',
      about: 'A softmax regression with no hidden layer. Any wrong digit counts. Hints are always on.',
      start: ['Pip here! I sort every letter perfectly. Mostly.', 'Another sack of mail! Let\'s go.'],
      fooled: ['That is clearly a {t}. Off it goes!', 'A {t}! Easy. Next!', 'Yep, {t}. I never miss.'],
      close: ['Hmm, that {y} looks a bit like a {t}.', 'Is that a {t}? No. Wait.'],
      still: ['Still a {y}. Nice try.', 'I see a {y}.']
    },
    gridlock: {
      rounds: 5, need: 4, hints: Infinity,
      model: 'Small neural net, 64-32-10',
      about: 'One hidden layer, normal training. You must hit the exact digit on the routing slip. Hints are always on.',
      start: ['Ted the sorter, online. Feed me letters.', 'Two layers of pure reading power.'],
      fooled: ['Classification: {t}. Routing now.', 'Confirmed. That is a {t}.'],
      close: ['Confidence in {y} dropping. Odd.', 'Some {t} features detected. Rechecking.'],
      still: ['Classification: {y}.', 'Clearly a {y}.']
    },
    monolith: {
      rounds: 5, need: 4, hints: 3,
      model: 'Adversarially trained net, 64-48-10',
      about: 'Trained on few-pixel attacks like yours, so small nudges stop working. Exact target digit, and only 3 hints per run.',
      start: ['I was trained on tricks like yours.', 'Every pixel you touch, I have seen before.'],
      fooled: ['A {t}. Somehow. This was not in training.', 'I read a {t}. I am not happy about it.'],
      close: ['You are pushing toward {t}. I can feel it.', 'Interesting. Still a {y}, for now.'],
      still: ['That is a {y}. I was trained for this.', 'Still {y}.']
    },
    edith: {
      rounds: 5, need: 5, hints: 0,
      model: 'Ensemble of three robust nets',
      about: 'Three adversarially trained nets vote together, and they must be at least 70% sure of your digit. No hints, and you must misroute all five letters.',
      start: ['Three brains, one Edith. Try me!', 'I read every letter three times. With love.'],
      fooled: ['Oh no. That really is a {t}.', 'All three of me say {t}. How?!'],
      close: ['Ooh, a little bit {t}-ish. Not enough though!', 'Two of me say {y}. Keep trying!'],
      still: ['That is a {y}, silly.', 'Still a {y}. Want a hint? Just kidding.']
    }
  };

  // ---------- model ----------

  function forwardOne(layers, x) {
    var h = x;
    for (var li = 0; li < layers.length; li++) {
      var L = layers[li], out = new Float64Array(L.b.length);
      for (var o = 0; o < L.b.length; o++) {
        var s = L.b[o], w = L.W[o];
        for (var k = 0; k < h.length; k++) s += w[k] * h[k];
        out[o] = li < layers.length - 1 && s < 0 ? 0 : s;
      }
      h = out;
    }
    return h;
  }

  function softmax(z) {
    var m = -Infinity, i, out = new Float64Array(z.length), sum = 0;
    for (i = 0; i < z.length; i++) if (z[i] > m) m = z[i];
    for (i = 0; i < z.length; i++) { out[i] = Math.exp(z[i] - m); sum += out[i]; }
    for (i = 0; i < z.length; i++) out[i] /= sum;
    return out;
  }

  function predict(level, img) {
    var x = new Float64Array(64);
    for (var i = 0; i < 64; i++) x[i] = img[i] / 16;
    var ms = D.models[level], p = new Float64Array(10);
    ms.forEach(function (m) {
      var q = softmax(forwardOne(m.layers, x));
      for (var j = 0; j < 10; j++) p[j] += q[j] / ms.length;
    });
    return p;
  }

  function argmax(p) { var b = 0; for (var i = 1; i < p.length; i++) if (p[i] > p[b]) b = i; return b; }

  // ---------- state ----------

  var S = {
    level: A.lastLevel(GAME),
    run: [], idx: 0, img: null, orig: null, hist: [],
    tool: 16, results: [], hintsLeft: 0, hintOn: false, heat: null,
    solved: false, over: false, lastLine: '', lastTalk: 0
  };

  function cfg() { return D.levels[S.level]; }
  function lv() { return LV[S.level]; }
  function round() { return S.run[S.idx]; }
  function changed() {
    var n = 0;
    for (var i = 0; i < 64; i++) if (S.img[i] !== S.orig[i]) n++;
    return n;
  }

  function fmt(s, r) { return s.replace(/\{y\}/g, r.y).replace(/\{t\}/g, r.t == null ? 'something else' : r.t); }
  function pick(arr) {
    var c = arr.filter(function (l) { return l !== S.lastLine; });
    if (!c.length) c = arr;
    return c[Math.floor(Math.random() * c.length)];
  }
  function say(text, mood) {
    S.lastLine = text;
    var b = $('#bubble');
    b.textContent = text;
    b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop');
    renderStamp(mood);
  }

  function goal(p) {
    var r = round(), y = r.y;
    if (r.t == null) {
      var best = -1;
      for (var j = 0; j < 10; j++) if (j !== y && p[j] > best) best = p[j];
      return best - p[y];
    }
    var other = -1;
    for (var k = 0; k < 10; k++) if (k !== r.t && p[k] > other) other = p[k];
    return Math.min(p[r.t] - other, p[r.t] - cfg().conf);
  }

  function success(p) {
    var r = round(), a = argmax(p);
    if (r.t == null) return a !== r.y;
    return a === r.t && p[r.t] >= cfg().conf;
  }

  // ---------- run flow ----------

  function shuffle(arr, seed) {
    var a = arr.slice(), s = seed;
    for (var i = a.length - 1; i > 0; i--) {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      var j = s % (i + 1);
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function newRun() {
    A.closeModal(true);
    var pool = D.rounds[S.level];
    S.run = shuffle(pool, (Math.random() * 1e9) | 0).slice(0, lv().rounds);
    S.results = [];
    S.idx = 0;
    S.hintsLeft = lv().hints;
    S.over = false;
    renderOperator();
    startRound();
    say(pick(lv().start), 'smug');
  }

  function startRound() {
    var r = round();
    S.orig = r.img.slice();
    S.img = r.img.slice();
    S.hist = [];
    S.solved = false;
    S.hintOn = lv().hints === Infinity && S.hintOn;
    S.heat = null;
    renderAll();
    $('#btn-next').disabled = true;
    $('#btn-skip').disabled = false;
    setStatus(r.t == null
      ? 'Make the machine read anything except ' + r.y + '. You have ' + cfg().budget + ' pixels.'
      : 'Make the machine read ' + r.t + (cfg().conf ? ' with at least ' + Math.round(cfg().conf * 100) + '% confidence' : '') + '. You have ' + cfg().budget + ' pixels.', '');
  }

  function setStatus(text, kind) {
    var el = $('#status');
    el.textContent = text;
    el.className = 'status' + (kind ? ' ' + kind : '');
  }

  function finishRound(solved) {
    var r = round();
    S.results[S.idx] = { solved: solved, used: solved ? changed() : null, par: r.par };
    $('#btn-skip').disabled = true;
    var last = S.idx >= S.run.length - 1;
    var failsLeft = lv().rounds - lv().need;
    var fails = S.results.filter(function (x) { return x && !x.solved; }).length;
    if (fails > failsLeft) { renderRounds(); return endRun(false); }
    if (last) { renderRounds(); return endRun(true); }
    $('#btn-next').disabled = false;
    $('#btn-next').focus({ preventScroll: true });
    renderRounds();
  }

  function nextRound() {
    if (S.over || S.idx >= S.run.length - 1 || !S.results[S.idx]) return;
    S.idx++;
    startRound();
  }

  function skip() {
    if (S.solved || S.over || S.results[S.idx]) return;
    A.jingle('bad');
    say('Giving up on that one? Fine by me.', 'smug');
    setStatus('Skipped. That letter went to the right place.', 'bad');
    S.solved = false;
    finishRound(false);
  }

  function endRun(passed) {
    S.over = true;
    var solved = S.results.filter(function (x) { return x && x.solved; });
    var used = solved.reduce(function (a, x) { return a + x.used; }, 0);
    var par = solved.reduce(function (a, x) { return a + x.par; }, 0);
    var name = A.LEVEL_MAP[S.level].name;
    // leaderboard: 150 per fooled letter, 10 per pixel saved against twice the attack program, 300 + 100 per star for a win
    var stars = used <= par ? 3 : used <= Math.ceil(par * 1.5) ? 2 : 1;
    var base = 150 * solved.length + 10 * Math.max(0, 2 * par - used) + (passed ? 300 + 100 * stars : 0);
    A.account.submit(GAME, S.level, A.points(S.level, base), solved.length + ' of ' + S.run.length + ' letters, ' + used + ' pixels');
    if (!passed) {
      A.jingle('lose');
      A.modal({
        title: 'Delivered correctly.',
        tone: 'lose',
        html: '<p class="lead">' + name + ' sorted too many letters to the right place. You misrouted ' + solved.length + ' of ' + S.run.length +
          ' and needed ' + lv().need + '.</p><p class="soft">Tip: watch the bins while you paint. Strokes that join two parts of a digit, or break one, move the reading the most.</p>',
        buttons: [{ label: 'New sack of mail', kind: 'main', onClick: newRun }],
        link: { label: 'Close and look at the letter' }
      });
      return;
    }
    var rec = A.record(GAME, S.level, { stars: stars, score: used, lowerIsBetter: true, text: used + ' pixels' });
    bar.refresh();
    A.jingle('win');
    var order = ['pip', 'gridlock', 'monolith', 'edith'];
    var next = order[order.indexOf(S.level) + 1];
    var buttons = [];
    if (next) buttons.push({ label: 'Take on ' + A.LEVEL_MAP[next].name, kind: 'main', onClick: function () { switchTo(next); } });
    buttons.push({ label: 'New sack of mail', kind: next ? 'line' : 'main', onClick: newRun });
    A.modal({
      title: S.level === 'edith' ? 'Edith was fooled.' : 'Misrouted.',
      tone: 'win',
      html: '<p class="lead">You fooled ' + name + ' on ' + solved.length + ' of ' + S.run.length + ' letters using ' + used +
        ' changed pixels. A greedy attack program needed ' + par + ' for the same letters.</p>' + A.stars(stars) +
        '<p><strong>' + (rec.better ? (rec.prev ? 'New best! Down from ' + rec.prev.score + ' pixels.' : 'First win against ' + name + '.') : 'Your best is still ' + rec.prev.score + ' pixels.') + '</strong></p>' +
        (stars < 3 ? '<p class="soft">3 stars means matching or beating the attack program: ' + par + ' pixels or fewer.</p>' : ''),
      buttons: buttons,
      link: { label: 'Close and look at the letter' }
    });
  }

  function switchTo(id) {
    S.level = id;
    bar.setLevel(id);
    newRun();
  }

  // ---------- editing ----------

  function setPixel(i, v) {
    if (S.solved || S.over || S.results[S.idx]) return false;
    var target = v === 'orig' ? S.orig[i] : v;
    if (S.img[i] === target) return false;
    var willChange = target !== S.orig[i];
    var wasChanged = S.img[i] !== S.orig[i];
    if (willChange && !wasChanged && changed() >= cfg().budget) {
      setStatus('Out of pixels. Restore or undo one first.', 'bad');
      var g = $('#grid');
      g.classList.remove('shake'); void g.offsetWidth; g.classList.add('shake');
      A.tone(140, 0.12, 'square', 0.03);
      return false;
    }
    S.hist.push([i, S.img[i]]);
    S.img[i] = target;
    A.tone(target > 8 ? 520 : target > 0 ? 440 : 360, 0.03, 'triangle', 0.02);
    return true;
  }

  function afterEdit() {
    S.heat = null;
    if (S.hintOn && lv().hints !== Infinity) S.hintOn = false;
    var p = predict(S.level, S.img);
    renderGrid();
    renderSide();
    renderBins(p);
    renderHintBtn();
    var r = round();
    if (success(p)) {
      S.solved = true;
      A.jingle('good');
      say(fmt(pick(lv().fooled), { y: r.y, t: argmax(p) }), 'surprised');
      setStatus('Misrouted! It reads ' + argmax(p) + '. You used ' + changed() + ' pixel' + (changed() === 1 ? '' : 's') + ' (the attack program needed ' + r.par + ').', 'good');
      finishRound(true);
      return;
    }
    var now = performance.now();
    if (now - S.lastTalk > 2200) {
      S.lastTalk = now;
      var a = argmax(p);
      var tgt = r.t == null ? (function () { var b = -1, bi = 0; for (var j = 0; j < 10; j++) if (j !== r.y && p[j] > b) { b = p[j]; bi = j; } return bi; })() : r.t;
      if (a === r.y && p[tgt] > 0.25) say(fmt(pick(lv().close), { y: r.y, t: tgt }), 'worried');
      else if (a === r.y) say(fmt(pick(lv().still), { y: r.y, t: tgt }), 'smug');
      else say('That is a ' + a + '. But you wanted ' + tgt + ', right?', 'happy');
    }
    var left = cfg().budget - changed();
    setStatus(left === 0 ? 'No pixels left. Restore or undo to try another stroke.' :
      left + ' pixel' + (left === 1 ? '' : 's') + ' left. ' + (r.t == null ? 'Any digit except ' + r.y + '.' : 'Target: ' + r.t + '.'), '');
  }

  function undo() {
    if (S.solved || S.over || !S.hist.length || S.results[S.idx]) return;
    var h = S.hist.pop();
    S.img[h[0]] = h[1];
    afterEdit();
  }

  function resetLetter() {
    if (S.solved || S.over || S.results[S.idx]) return;
    S.img = S.orig.slice();
    S.hist = [];
    afterEdit();
  }

  // ---------- hints: exact one-step look-ahead ----------

  function computeHeat() {
    var p0 = predict(S.level, S.img), g0 = goal(p0);
    var out = [];
    var full = changed() >= cfg().budget;
    for (var i = 0; i < 64; i++) {
      var best = 0, bestV = null;
      [16, 8, 0, 'orig'].forEach(function (v) {
        var tv = v === 'orig' ? S.orig[i] : v;
        if (tv === S.img[i]) return;
        var newCount = changed() + (tv !== S.orig[i] ? (S.img[i] === S.orig[i] ? 1 : 0) : -1);
        if (full && newCount > changed()) return;
        var old = S.img[i];
        S.img[i] = tv;
        var g = goal(predict(S.level, S.img));
        S.img[i] = old;
        if (g - g0 > best) { best = g - g0; bestV = v; }
      });
      out.push({ i: i, gain: best, v: bestV });
    }
    out.sort(function (a, b) { return b.gain - a.gain; });
    return out.slice(0, 6).filter(function (h) { return h.gain > 0.001; });
  }

  function toggleHint() {
    if (S.solved || S.over || S.results[S.idx]) return;
    var h = lv().hints;
    if (h === 0) { say('Hints? For you? No.', 'smug'); return; }
    if (S.hintOn) { S.hintOn = false; S.heat = null; renderGrid(); renderHintBtn(); return; }
    if (h !== Infinity) {
      if (S.hintsLeft <= 0) { setStatus('No hints left this run.', 'bad'); return; }
      S.hintsLeft--;
    }
    S.hintOn = true;
    renderGrid();
    renderHintBtn();
  }

  // ---------- rendering ----------

  function inkColor(v) {
    // paper to blue-black ink
    var t = v / 16;
    var r = Math.round(251 + (29 - 251) * t), g = Math.round(250 + (38 - 250) * t), b = Math.round(246 + (71 - 246) * t);
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }

  function buildGrid() {
    var g = $('#grid');
    g.innerHTML = '';
    for (var i = 0; i < 64; i++) {
      var c = document.createElement('div');
      c.className = 'px';
      c.dataset.i = i;
      c.setAttribute('role', 'gridcell');
      g.appendChild(c);
    }
    var painting = false;
    function cellAt(e) {
      var el = document.elementFromPoint(e.clientX, e.clientY);
      return el && el.classList.contains('px') ? Number(el.dataset.i) : -1;
    }
    g.addEventListener('pointerdown', function (e) {
      var i = cellAt(e);
      if (i < 0) return;
      e.preventDefault();
      painting = true;
      g.setPointerCapture(e.pointerId);
      if (setPixel(i, S.tool)) afterEdit();
    });
    g.addEventListener('pointermove', function (e) {
      if (!painting) return;
      var i = cellAt(e);
      if (i >= 0 && setPixel(i, S.tool)) afterEdit();
    });
    function stop() { painting = false; }
    g.addEventListener('pointerup', stop);
    g.addEventListener('pointercancel', stop);
  }

  function renderGrid() {
    var live = !S.solved && !S.over && !S.results[S.idx];
    if (S.hintOn && live && !S.heat) S.heat = computeHeat();
    var cells = $('#grid').children;
    var heat = {};
    if (S.hintOn && live && S.heat) S.heat.forEach(function (h, rank) { heat[h.i] = { v: h.v, rank: rank }; });
    for (var i = 0; i < 64; i++) {
      var c = cells[i], v = S.img[i];
      c.style.background = inkColor(v);
      c.classList.toggle('changed', v !== S.orig[i]);
      c.classList.toggle('dark', v >= 9);
      var h = heat[i];
      if (h) {
        var sym = h.v === 0 ? 'erase' : h.v === 'orig' ? 'restore' : h.v === 8 ? 'smudge' : 'ink';
        c.dataset.hint = sym;
        c.setAttribute('data-rank', h.rank + 1);
      } else {
        delete c.dataset.hint;
        c.removeAttribute('data-rank');
      }
      c.setAttribute('aria-label', 'Row ' + (Math.floor(i / 8) + 1) + ', column ' + (i % 8 + 1) + ', ink ' + v + ' of 16' + (v !== S.orig[i] ? ', changed' : '') + (h ? ', hint: ' + c.dataset.hint : ''));
    }
  }

  function drawThumb(canvas, img) {
    var ctx = canvas.getContext('2d');
    var d = ctx.createImageData(8, 8);
    for (var i = 0; i < 64; i++) {
      var t = img[i] / 16;
      d.data[i * 4] = 251 + (29 - 251) * t;
      d.data[i * 4 + 1] = 250 + (38 - 250) * t;
      d.data[i * 4 + 2] = 246 + (71 - 246) * t;
      d.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(d, 0, 0);
  }

  function renderSide() {
    drawThumb($('#thumb-orig'), S.orig);
    drawThumb($('#thumb-now'), S.img);
    var used = changed(), budget = cfg().budget;
    $('#used').textContent = used;
    $('#budget').textContent = budget;
    var cells = $('#budget-cells');
    cells.innerHTML = '';
    for (var i = 0; i < budget; i++) {
      var s = document.createElement('span');
      s.className = i < used ? 'on' : '';
      cells.appendChild(s);
    }
  }

  function renderBins(p) {
    var r = round();
    var a = argmax(p);
    var wrap = $('#bins');
    if (!wrap.children.length) {
      for (var j = 0; j < 10; j++) {
        var b = document.createElement('div');
        b.className = 'bin';
        b.innerHTML = '<span class="bin-slot"><i></i></span><span class="bin-num">' + j + '</span><span class="bin-pct"></span>';
        wrap.appendChild(b);
      }
    }
    for (var k = 0; k < 10; k++) {
      var el = wrap.children[k];
      el.querySelector('i').style.height = Math.max(1.5, p[k] * 100) + '%';
      el.querySelector('.bin-pct').textContent = p[k] >= 0.005 ? Math.round(p[k] * 100) + '%' : '';
      el.classList.toggle('pick', k === a);
      el.classList.toggle('true', k === r.y);
      el.classList.toggle('target', r.t != null && k === r.t);
    }
    var conf = cfg().conf;
    if (conf && r.t != null) {
      wrap.style.setProperty('--conf-frac', String(conf));
      wrap.classList.add('has-conf');
    } else wrap.classList.remove('has-conf');
    $('#read-digit').textContent = a;
    $('#read-conf').textContent = Math.round(p[a] * 100) + '% sure';
    $('.reading').classList.toggle('fooled', success(p));
  }

  function renderRounds() {
    var wrap = $('#rounds');
    wrap.innerHTML = '';
    S.run.forEach(function (r, i) {
      var res = S.results[i];
      var d = document.createElement('span');
      d.className = 'round' + (i === S.idx ? ' now' : '') + (res ? (res.solved ? ' won' : ' lost') : '');
      d.title = 'Letter ' + (i + 1) + (res ? (res.solved ? ': misrouted with ' + res.used + ' pixels' : ': skipped') : '');
      d.textContent = res ? (res.solved ? res.used : '×') : i + 1;
      wrap.appendChild(d);
    });
    var need = document.createElement('span');
    need.className = 'need';
    need.textContent = 'Misroute ' + lv().need + ' of ' + S.run.length + ' to win';
    wrap.appendChild(need);
  }

  function renderHintBtn() {
    var b = $('#btn-hint'), h = lv().hints;
    b.setAttribute('aria-pressed', String(S.hintOn));
    b.disabled = h === 0 || S.solved || S.over || !!S.results[S.idx];
    b.innerHTML = (h === 0 ? 'No hints' : h === Infinity ? (S.hintOn ? 'Hide hint' : 'Hint') : 'Hint (' + S.hintsLeft + ' left)') + ' <kbd>H</kbd>';
  }

  function renderStamp(mood) {
    $('#stamp').innerHTML = '<div class="stamp-in">' + A.face(S.level, mood || 'calm') + '</div>';
  }

  function renderOperator() {
    var L = A.LEVEL_MAP[S.level];
    $('#op-name').textContent = L.name;
    $('#op-model').textContent = lv().model;
    $('#rule').textContent = lv().about;
    $('#budget').textContent = cfg().budget;
    renderStamp('smug');
  }

  function renderAll() {
    var r = round();
    $('#true-digit').textContent = r.y;
    $('#target-digit').textContent = r.t == null ? 'Any but ' + r.y : r.t;
    $('#route-label').textContent = r.t == null ? 'Route it to' : 'Route it to';
    $('.slip-route').classList.toggle('any', r.t == null);
    $('#postmark-round').textContent = 'Letter ' + (S.idx + 1) + ' of ' + S.run.length;
    renderGrid();
    renderSide();
    renderBins(predict(S.level, S.img));
    renderRounds();
    renderHintBtn();
  }

  function setTool(v) {
    S.tool = v;
    Array.prototype.forEach.call(document.querySelectorAll('.tool'), function (b) {
      var tv = b.dataset.tool === 'orig' ? 'orig' : Number(b.dataset.tool);
      b.setAttribute('aria-pressed', String(tv === v));
    });
  }

  // ---------- help ----------

  function openHelp() {
    var rows = ['pip', 'gridlock', 'monolith', 'edith'].map(function (id) {
      var L = A.LEVEL_MAP[id], c = D.levels[id];
      return '<div><dt>' + L.name + ', ' + LV[id].model.toLowerCase() + '</dt><dd>' + LV[id].about + ' ' + c.budget + ' pixels per letter.</dd></div>';
    }).join('');
    A.modal({
      title: 'How to play',
      wide: true,
      html:
        '<p>The sorting machine reads handwritten digits on envelopes. Your job: tamper with the digit so it gets routed to the wrong place, while changing as few pixels as you can.</p>' +
        '<ol><li>Pick a pen: ink, smudge (half ink), erase, or restore a pixel to how it was.</li>' +
        '<li>Click or drag on the 8 by 8 digit. The bins update after every pixel, so you can feel which strokes move the reading.</li>' +
        '<li>Each letter has a pixel budget. Every pixel that differs from the original counts once, no matter how often you repaint it.</li>' +
        '<li>Every letter can be solved within its budget. A greedy attack program already did it, and its pixel count is your par for 3 stars.</li></ol>' +
        '<h3>Levels</h3><dl>' + rows + '</dl>' +
        '<h3>Keys</h3><table class="keys">' +
        '<tr><td><kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd> <kbd>4</kbd></td><td>Ink, smudge, erase, restore</td></tr>' +
        '<tr><td><kbd>Z</kbd></td><td>Undo</td></tr><tr><td><kbd>H</kbd></td><td>Hint, where allowed</td></tr>' +
        '<tr><td><kbd>Enter</kbd></td><td>Next letter</td></tr><tr><td><kbd>B</kbd></td><td>Hide the game behind a spreadsheet</td></tr></table>',
      buttons: [{ label: 'Open the mail', kind: 'main' }]
    });
  }

  // ---------- wiring ----------

  var bar = A.mountBar({
    el: $('#bar'),
    game: GAME,
    title: 'Fool the Model',
    tagline: 'Misroute the mail with as few pixels as possible.',
    level: S.level,
    levelLabel: 'Sorting machine',
    canSwitch: function (id) {
      var busy = !S.over && S.results.length > 0;
      return busy ? 'This sack of mail will be dropped.' : true;
    },
    onLevel: function (id) { S.level = id; newRun(); },
    onHelp: openHelp
  });
  sc.add(bar.destroy);

  buildGrid();
  Array.prototype.forEach.call(document.querySelectorAll('.tool'), function (b) {
    b.addEventListener('click', function () { setTool(b.dataset.tool === 'orig' ? 'orig' : Number(b.dataset.tool)); });
  });
  $('#btn-undo').addEventListener('click', undo);
  $('#btn-reset').addEventListener('click', resetLetter);
  $('#btn-hint').addEventListener('click', toggleHint);
  $('#btn-next').addEventListener('click', nextRound);
  $('#btn-skip').addEventListener('click', skip);

  sc.on(document, 'keydown', function (e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    var k = e.key.toLowerCase();
    if (k === '1') setTool(16);
    else if (k === '2') setTool(8);
    else if (k === '3') setTool(0);
    else if (k === '4') setTool('orig');
    else if (k === 'z') undo();
    else if (k === 'h') toggleHint();
    else if (k === 'enter' && !$('#btn-next').disabled) { e.preventDefault(); nextRound(); }
    else if (k === '?') openHelp();
  });

  newRun();
  if (A.firstVisit(GAME)) openHelp();

  window.foolTheModel = { state: S, predict: predict, newRun: newRun };
  return sc.dispose;
}
