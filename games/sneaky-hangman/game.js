/*
 * Sneaky Hangman: balloons, tiles, your answers and the end screen.
 * mount() runs after window.Arcade is ready (components/PageShell.jsx) and returns a cleanup function.
 */
import E from './engine.js';

export function mount() {
  var A = window.Arcade;
  var sc = A.scope();
  var GAME = 'sneaky-hangman';
  var ORDER = ['pip', 'gridlock', 'monolith', 'edith'];
  var COLORS = ['#FFD45C', '#3D86F0', '#2FBF71', '#FF6B57', '#B07CC6', '#F09A4A'];

  function $(s) { return document.querySelector(s); }

  var S = { level: A.lastLevel(GAME), round: null, held: null, busy: false, token: 0, lastLine: '', peek: false };

  var TALK = {
    pip: {
      blurb: 'Guesses letters in plain alphabet-popularity order, and sometimes skips ahead for fun.',
      start: ['I love word games! I am great at them. I think.', 'Let me guess. Is it a word?', 'E! No wait, I have not started yet.'],
      think: ['Hmmm. Vowels are nice.', 'E is always a good idea.', 'My gut says...'],
      hit: ['I knew it! I totally knew it.', 'Yes! Pip is a genius.', 'Ooh, ooh, there it is!'],
      miss: ['Huh. Weird word.', 'No? Okay. Hmm.', 'That letter is overrated anyway.'],
      win: ['Bloop. I am in the jelly now.', 'How is that a word?!'], lose: ['I got it! Was it hard? It felt hard.']
    },
    gridlock: {
      blurb: 'Counts which letter shows up in the most words that still fit, and guesses that.',
      start: ['I have a list. I count the list.', 'Six letters. Plenty of data.', 'Every guess is a tally.'],
      think: ['Counting...', 'The tally says...', 'Most likely letter coming up.'],
      hit: ['As counted.', 'The tally was right.', 'Expected.'],
      miss: ['Statistically unlucky.', 'The tally needs a recount.', 'Improbable.'],
      win: ['The tally... failed me.', 'Splash. Noted.'], lose: ['The numbers never lie.']
    },
    monolith: {
      blurb: 'Picks the letter that splits the remaining words most evenly. Every answer teaches it something.',
      start: ['Every answer you give narrows it down.', 'I play for information, not for luck.', 'Five letters. I have time.'],
      think: ['Which letter tells me the most?', 'Considering every split.', 'Calculating.'],
      hit: ['Informative.', 'That narrows it down nicely.', 'Good. Fewer words now.'],
      miss: ['Even a miss tells me something.', 'Useful. Annoying, but useful.'],
      win: ['You kept more words alive than I expected.', 'Well hidden.'], lose: ['Information always wins.']
    },
    edith: {
      blurb: 'Knows you are cheating, so it picks the letter that leaves you the fewest words even when you answer as sneakily as possible.',
      start: ['Hi! I know you are going to cheat. That is okay! Edith too.', 'Change your word as much as you like. Edith is ready.', 'Let\'s play! Edith already likes my chances.'],
      think: ['Let me squeeze you a little...', 'Which letter hurts you most? Hmm.', 'Edith has a plan.'],
      hit: ['Gotcha! Fewer places to hide now.', 'Hee hee. Only {n} words left, I bet.', 'Squeeze, squeeze.'],
      miss: ['Ooh, sneaky. Still {n} words, huh?', 'That was the sneaky answer. Edith expected it.'],
      win: ['Edith... is in the jelly?! Not cute. Okay, a bit cute.', 'You out-sneaked Edith!'], lose: ['Found you! Edith always finds you.']
    }
  };

  function pick(arr) {
    var c = arr.filter(function (l) { return l !== S.lastLine; });
    c = c.length ? c : arr;
    return c[Math.floor(Math.random() * c.length)];
  }
  function L() { return A.LEVEL_MAP[S.level]; }
  function cfg() { return E.LEVELS[S.level]; }
  function up(s) { return String(s).toUpperCase(); }

  function say(text, mood) {
    text = text.replace('{n}', S.round ? S.round.cands.length : '');
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
    var h = document.querySelector('#hanger .face-holder');
    if (h && h.dataset.mood !== mood) {
      h.dataset.mood = mood;
      h.innerHTML = A.face(S.level, mood).replace('<svg ', '<svg x="-55" y="-47" width="110" height="94.3" ');
    }
  }

  function sfx(kind) {
    switch (kind) {
      case 'think': A.tone(520, 0.05, 'sine', 0.025); A.tone(620, 0.05, 'sine', 0.025, 0.08); break;
      case 'card': A.tone(700, 0.06, 'triangle', 0.04); break;
      case 'hit': A.tone(660, 0.08, 'triangle', 0.05); A.tone(880, 0.1, 'triangle', 0.04, 0.07); break;
      case 'pop': A.noise(0.12, 0.09, 0, 2600, 0.7); A.tone(900, 0.08, 'square', 0.03, 0, 300); break;
      case 'swap': A.tone(300, 0.08, 'sine', 0.04, 0, 600); break;
      case 'splash': A.noise(0.6, 0.08, 0, 600, 0.5); A.tone(200, 0.5, 'sine', 0.06, 0, 70); break;
    }
  }

  // Waits that pause for the panic button, a modal or a hidden tab.
  function later(ms, fn) {
    var token = S.token, left = ms, last = performance.now();
    (function tick(now) {
      if (token !== S.token) return;
      var dt = now - last;
      last = now;
      if (!(A.isBoss() || A.modalOpen() || document.hidden)) left -= dt;
      if (left <= 0) fn(); else sc.raf(tick);
    })(last);
  }

  // ---------- stage ----------

  function balloonSpots(n) {
    var spots = [], outer = Math.ceil(n / 2), inner = n - outer;
    function arc(count, radius, lift) {
      for (var i = 0; i < count; i++) {
        var a = count === 1 ? 0 : -1.05 + 2.1 * i / (count - 1);
        spots.push([Math.sin(a) * radius, -70 - Math.cos(a) * radius - lift]);
      }
    }
    if (n <= 5) arc(n, 110, 0);
    else { arc(outer, 132, 0); arc(inner, 84, -6); }
    return spots;
  }

  function buildStage() {
    var r = S.round, n = cfg().lives, spots = balloonSpots(n), rng = E.rng(9), s = '';
    for (var i = 0; i < 26; i++) s += '<circle cx="' + (rng() * 420).toFixed(0) + '" cy="' + (rng() * 300).toFixed(0) + '" r="' + (1 + rng() * 1.8).toFixed(1) + '" fill="#FFD45C" opacity="' + (0.4 + rng() * 0.5).toFixed(2) + '"/>';
    s += '<circle cx="360" cy="54" r="26" fill="#FFF3C4" opacity=".9"/><circle cx="350" cy="48" r="22" fill="#4A2766" opacity=".9"/>';
    // jelly pool
    s += '<g class="jelly" id="jelly"><path d="M10 400 V366 q20 -22 45 -8 q22 -20 48 -4 q24 -18 50 -2 q26 -18 54 -2 q24 -16 52 -2 q26 -18 50 0 q22 -16 46 -2 q20 -10 65 2 V400 Z" fill="#2FBF71" stroke="#1D1A33" stroke-width="3"/>' +
      '<path d="M40 376 q20 -8 40 0 M150 372 q16 -6 32 0 M290 374 q18 -8 36 0" stroke="#A8F0C8" stroke-width="5" stroke-linecap="round" fill="none"/></g>';
    var hanger = '<g id="hanger" class="hanger"><g class="strings">';
    spots.forEach(function (p, i) { hanger += '<path data-i="' + i + '" d="M' + p[0].toFixed(1) + ' ' + (p[1] + 24).toFixed(1) + ' Q' + (p[0] * 0.4).toFixed(1) + ' -40 0 -46" fill="none" stroke="#1D1A33" stroke-width="2"/>'; });
    hanger += '</g>';
    spots.forEach(function (p, i) {
      var c = COLORS[i % COLORS.length];
      hanger += '<g class="balloon" data-i="' + i + '" transform="translate(' + p[0].toFixed(1) + ' ' + p[1].toFixed(1) + ')"><g>' +
        '<ellipse rx="19" ry="23" fill="' + c + '" stroke="#1D1A33" stroke-width="3"/><path d="M-4 22 l4 6 l4 -6 z" fill="' + c + '" stroke="#1D1A33" stroke-width="2" stroke-linejoin="round"/>' +
        '<ellipse cx="-7" cy="-9" rx="4" ry="7" fill="#fff" opacity=".55"/></g></g>';
    });
    hanger += '<g class="face-holder"></g></g>';
    $('#stage').innerHTML = s + hanger + '<g id="fx"></g>';
    setFace('smug');
    placeHanger(false);
  }

  function placeHanger(mode) {
    var r = S.round, n = cfg().lives, popped = n - r.lives;
    var h = $('#hanger');
    h.classList.remove('fall', 'rise');
    var y = 196 + 70 * (popped / n), rot = 0;
    if (mode === 'fall') { h.classList.add('fall'); y = 390; rot = 18; }
    if (mode === 'rise') { h.classList.add('rise'); y = -260; }
    h.style.transform = 'translate(210px, ' + y + 'px) rotate(' + rot + 'deg)';
  }

  function popBalloon() {
    var r = S.round, idx = cfg().lives - r.lives - 1;
    var b = document.querySelector('.balloon[data-i="' + idx + '"]'), st = document.querySelector('.strings path[data-i="' + idx + '"]');
    if (!b) return;
    b.classList.add('popped');
    if (st) st.style.opacity = 0;
    sfx('pop');
    var box = b.getBoundingClientRect(), svg = $('#stage').getBoundingClientRect(), k = 420 / svg.width;
    var cx = (box.left + box.width / 2 - svg.left) * k, cy = (box.top + box.height / 2 - svg.top) * k;
    var fx = $('#fx'), out = '';
    for (var i = 0; i < 6; i++) {
      var a = i * Math.PI / 3;
      out += '<circle class="puff" cx="' + (cx + Math.cos(a) * 14).toFixed(1) + '" cy="' + (cy + Math.sin(a) * 14).toFixed(1) + '" r="4" fill="#fff" style="transform-origin:' + cx.toFixed(1) + 'px ' + cy.toFixed(1) + 'px"/>';
    }
    fx.innerHTML = out;
  }

  // ---------- word, options, secret ----------

  function renderTiles(flip, call) {
    var r = S.round, el = $('#tiles');
    el.innerHTML = '';
    var word = call || null;
    r.pattern.forEach(function (c, i) {
      var t = document.createElement('div');
      var ch = c || (word ? word.charAt(i) : '');
      t.className = 'tile' + (ch ? '' : ' blank') + (flip && flip.indexOf(i) >= 0 ? ' flip' : '') + (word && !c ? ' call' : '');
      t.textContent = ch ? up(ch) : '';
      el.appendChild(t);
    });
    var miss = r.wrong.map(function (l) { return '<b>' + up(l) + '</b>'; }).join('');
    $('#missed').innerHTML = r.wrong.length ? 'Missed: ' + miss : 'No misses yet. Make it guess wrong ' + cfg().lives + ' times.';
  }

  function patternWith(letter, positions) {
    return S.round.pattern.map(function (c, i) {
      if (positions.indexOf(i) >= 0) return '<i>' + up(letter) + '</i>';
      return c ? up(c) : '_';
    }).join(' ');
  }

  function renderOptions() {
    var r = S.round, el = $('#opts');
    if (!r) return;
    el.innerHTML = '';
    if (!r.pending || r.over) {
      el.innerHTML = '<p class="wait">' + (r.over ? 'Round over.' : L().name + ' is thinking of a letter...') + '</p>';
      $('#ask').textContent = 'How do you answer?';
      return;
    }
    var letter = r.pending.letter;
    $('#ask').textContent = 'Is there ' + (/[aeiou]/.test(letter) ? 'an ' : 'a ') + up(letter) + '? You decide.';
    r.options().forEach(function (o, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'opt' + (o.key === '' ? ' miss' : '');
      var has = o.sample.indexOf(S.held) >= 0 || (S.held && E.partition([S.held], letter)[o.key]);
      var like = has ? S.held : o.sample[0];
      b.innerHTML = '<span class="k">' + (i < 9 ? i + 1 : '') + '</span><span><span class="pat">' +
        (o.key === '' ? '<span class="none">No ' + up(letter) + '</span>' : patternWith(letter, o.positions)) + '</span>' +
        '<span class="meta">like ' + up(like) + (has ? ', your current word' : '') + '</span></span>' +
        '<span class="cnt">' + o.count + ' word' + (o.count === 1 ? '' : 's') + '</span>';
      b.setAttribute('aria-label', (o.key === '' ? 'No ' + letter : 'Show ' + letter + ' at position ' + o.positions.map(function (p) { return p + 1; }).join(' and ')) + '. ' + o.count + ' words still fit.');
      b.addEventListener('click', function () { answer(o.key); });
      el.appendChild(b);
    });
  }

  function renderSecret(swapped) {
    var r = S.round;
    if (!r) return;
    var w = $('#secret-word');
    w.textContent = up(S.held || '');
    if (swapped) { w.classList.remove('swap'); void w.offsetWidth; w.classList.add('swap'); }
    var others = r.cands.length - 1;
    $('#secret-note').textContent = swapped ? 'Your old word no longer fit, so you quietly switched. ' + others + ' other word' + (others === 1 ? '' : 's') + ' still fit.' :
      others > 0 ? 'Plus ' + others + ' other word' + (others === 1 ? '' : 's') + ' you could switch to. Keep that number high.' : 'Only this word is left. Uh oh.';
    var peek = $('#peek');
    peek.hidden = !S.peek;
    $('#btn-peek').textContent = S.peek ? 'Hide other words' : 'See other words';
    if (S.peek) {
      peek.innerHTML = '';
      r.cands.slice(0, 60).forEach(function (cw) {
        var b = document.createElement('button');
        b.type = 'button';
        b.textContent = cw;
        b.setAttribute('aria-pressed', String(cw === S.held));
        b.addEventListener('click', function () { S.held = cw; sfx('swap'); renderSecret(); renderOptions(); });
        peek.appendChild(b);
      });
      if (r.cands.length > 60) peek.insertAdjacentHTML('beforeend', '<span class="secret-note">and ' + (r.cands.length - 60) + ' more</span>');
    }
  }

  function renderSide() {
    var Lv = L(), c = cfg();
    $('#bot-name').textContent = Lv.name;
    $('#bot-rank').textContent = Lv.rank + ' guesser, ' + c.len + ' letters';
    var best = A.progress(GAME)[S.level];
    $('#best').textContent = best ? 'Your best against ' + Lv.name + ': ' + best.text + '.' : Lv.name + ' has never fallen in the jelly. Yet.';
  }

  // ---------- flow ----------

  // Words come from the WNI words API, which pulls common English words from an online word service.
  var wordLists = {};
  function loadWords(len) {
    if (wordLists[len]) return Promise.resolve(wordLists[len]);
    return A.account.words(len).then(function (r) {
      if (!r.ok || !r.data.words || r.data.words.length < 50) throw new Error((r.data && r.data.error) || 'No words came back.');
      wordLists[len] = r.data;
      return r.data;
    });
  }

  function newRound() {
    A.closeModal(true);
    S.token++;
    var token = S.token, len = cfg().len;
    S.round = null;
    S.busy = true;
    $('#opts').innerHTML = '<p class="wait">Fetching fresh ' + len + '-letter words...</p>';
    $('#source').textContent = '';
    loadWords(len).then(function (list) {
      if (token !== S.token || !sc.alive()) return;
      var byLength = {};
      byLength[len] = list.words.join(' ');
      S.source = list;
      startRound(byLength);
    }, function () {
      if (token !== S.token || !sc.alive()) return;
      $('#opts').innerHTML = '<p class="wait">The word list did not arrive. <button type="button" class="link" id="btn-retry">Try again</button></p>';
      $('#btn-retry').addEventListener('click', newRound);
      A.toast('Could not fetch the word list. Check your connection and try again.', { kind: 'bad' });
    });
  }

  function startRound(byLength) {
    S.round = new E.Round(S.level, byLength, (Math.random() * 1e9) >>> 0);
    var r = S.round;
    var src = S.source;
    $('#source').textContent = src.source === 'fallback'
      ? 'Using the backup word list: the online word service did not answer.'
      : r.all.length + ' of today\'s ' + src.words.length + ' online words are in play (from ' + src.provider + ').';
    S.held = r.cands[Math.floor(Math.random() * r.cands.length)];
    S.peek = false;
    buildStage();
    renderTiles();
    renderSecret();
    renderSide();
    say(pick(TALK[S.level].start), 'smug');
    A.music.intensity(0.5);
    think(1100);
  }

  function think(ms) {
    var r = S.round, card = $('#guess-card');
    S.busy = true;
    card.classList.add('thinking');
    card.classList.remove('new');
    card.innerHTML = '<span>?</span>';
    renderOptions();
    if (r.guessed.length && Math.random() < 0.35) say(pick(TALK[S.level].think), 'calm');
    sfx('think');
    later(ms || 750, function () {
      var m = r.botMove();
      card.classList.remove('thinking');
      if (m && m.word) return endRound();
      card.innerHTML = '<span>' + up(m.letter) + '</span>';
      void card.offsetWidth;
      card.classList.add('new');
      sfx('card');
      S.busy = false;
      renderOptions();
      var first = document.querySelector('.opt');
      if (first && !matchMedia('(pointer: coarse)').matches) first.focus({ preventScroll: true });
    });
  }

  function answer(key) {
    var r = S.round;
    if (S.busy || r.over || !r.pending || A.isBoss() || A.modalOpen()) return;
    var res = r.answer(key);
    if (!res) return;
    S.busy = true;
    var swapped = false;
    if (r.cands.indexOf(S.held) < 0) {
      S.held = r.cands[Math.floor(Math.random() * r.cands.length)];
      swapped = true;
      sfx('swap');
    }
    var T = TALK[S.level];
    if (res.hit) { sfx('hit'); say(pick(T.hit), 'happy'); }
    else { popBalloon(); say(pick(T.miss), r.lives <= 2 ? 'worried' : 'annoyed'); }
    renderTiles(res.hit ? res.positions : null);
    renderSecret(swapped);
    placeHanger(false);
    A.music.intensity(r.lives <= 2 ? 0.8 : 0.5);
    renderOptions();
    if (r.over) later(700, endRound);
    else think();
  }

  function endRound() {
    var r = S.round, c = cfg(), Lv = L(), T = TALK[S.level];
    var won = r.winner === 'you', hidden = r.hidden();
    S.busy = true;
    renderOptions();
    var stars = !won ? 0 : hidden >= Math.ceil(c.len * 0.6) ? 3 : hidden >= Math.ceil(c.len * 0.3) ? 2 : 1;
    var base = 60 * r.wrong.length + 40 * hidden + (won ? 500 : 0);
    A.account.submit(GAME, S.level, A.points(S.level, base), won ? 'Dropped it with ' + hidden + ' letters hidden' : 'Word found after ' + r.wrong.length + ' misses');
    A.music.intensity(0.4);
    if (won) {
      placeHanger('fall');
      sc.timeout(function () { sfx('splash'); var j = $('#jelly'); j.classList.remove('splash'); void j.getBoundingClientRect(); j.classList.add('splash'); }, 650);
      setFace('dead');
      say(pick(T.win), 'dead');
      var rec = A.record(GAME, S.level, { stars: stars, score: hidden, lowerIsBetter: false, text: hidden + ' of ' + c.len + ' letters still hidden' });
      bar.refresh();
      A.jingle('win');
      var next = ORDER[ORDER.indexOf(S.level) + 1], buttons = [];
      if (next) buttons.push({ label: 'Next guesser: ' + A.LEVEL_MAP[next].name, kind: 'main', onClick: function () { switchTo(next); } });
      buttons.push({ label: 'New word', kind: next ? 'line' : 'main', onClick: newRound });
      later(1200, function () {
        A.modal({
          title: S.level === 'edith' ? 'Edith hit the jelly!' : 'Splash!',
          tone: 'win',
          html: '<p class="lead">' + Lv.name + ' ran out of balloons with <strong>' + hidden + ' of ' + c.len + ' letters</strong> still hidden. Your word was</p>' +
            '<p class="word-reveal">' + up(S.held) + '</p><p class="soft">...or any of ' + (r.cands.length - 1) + ' other words. It never stood a chance.</p>' + A.stars(stars) +
            '<p><strong>' + (rec.better ? (rec.prev ? 'New best against ' + Lv.name + '!' : 'First win against ' + Lv.name + '.') : 'Your best: ' + rec.prev.text + '.') + '</strong></p>' +
            (stars < 3 ? '<p class="soft">3 stars means keeping at least ' + Math.ceil(c.len * 0.6) + ' letters hidden.</p>' : ''),
          buttons: buttons
        });
      });
    } else {
      renderTiles(null, r.called);
      placeHanger('rise');
      setFace('happy');
      say(pick(T.lose), 'happy');
      A.jingle('lose');
      later(1000, function () {
        A.modal({
          title: 'Found it!',
          tone: 'lose',
          html: '<p class="lead">' + Lv.name + ' worked out your word with ' + r.lives + ' balloon' + (r.lives === 1 ? '' : 's') + ' to spare:</p><p class="word-reveal">' + up(r.called) + '</p>' +
            '<p class="soft">Tips: the biggest group is not always best. Saying "no" pops a balloon, so a slightly smaller "no" group often beats a bigger "yes". Keep lots of words alive near the end so it cannot pin you down.</p>',
          buttons: [{ label: 'Try a new word', kind: 'main', onClick: newRound }],
          link: { label: 'Close and look at the word' }
        });
      });
    }
  }

  function switchTo(id) {
    S.level = id;
    bar.setLevel(id);
    newRound();
  }

  function openHelp() {
    var rows = ORDER.map(function (id) {
      var Lv = A.LEVEL_MAP[id], c = E.LEVELS[id];
      return '<div><dt>' + Lv.name + ', ' + Lv.rank.toLowerCase() + '</dt><dd>' + TALK[id].blurb + ' ' + c.len + '-letter words, ' + c.lives + ' balloons.</dd></div>';
    }).join('');
    A.modal({
      title: 'How to play',
      wide: true,
      html: '<p>Hangman, but you keep the word and the robot does the guessing. It hangs from balloons, and every wrong guess pops one. Pop them all and it drops into the jelly.</p>' +
        '<ol><li>The robot guesses a letter.</li><li>You choose how to answer: "no", or where the letter goes. Every choice shows how many words would still fit.</li>' +
        '<li>Here is the sneaky part: your secret word can change at any time, as long as it still fits everything you have shown. The game switches it for you.</li>' +
        '<li>If the robot ever pins your word down to just one, it wins.</li></ol>' +
        '<h3>Guessers</h3><dl>' + rows + '</dl>' +
        '<h3>Keys</h3><table class="keys"><tr><td><kbd>1</kbd> to <kbd>9</kbd></td><td>Pick an answer from the list</td></tr>' +
        '<tr><td><kbd>N</kbd></td><td>New word</td></tr><tr><td><kbd>M</kbd></td><td>Music on or off</td></tr><tr><td><kbd>B</kbd></td><td>Panic button</td></tr></table>',
      buttons: [{ label: 'Be sneaky', kind: 'main' }]
    });
  }

  var bar = A.mountBar({
    el: $('#bar'),
    game: GAME,
    title: 'Sneaky Hangman',
    tagline: 'It guesses letters. You quietly change your word.',
    level: S.level,
    levelLabel: 'Guesser',
    canSwitch: function () { return S.round && !S.round.over && S.round.guessed.length ? 'This word will be thrown away.' : true; },
    onLevel: function (id) { S.level = id; newRound(); },
    onHelp: openHelp
  });
  sc.add(bar.destroy);

  $('#btn-new').addEventListener('click', function () {
    if (!(S.round && !S.round.over && S.round.guessed.length)) return newRound();
    A.confirm({ title: 'New word?', text: 'This round will be thrown away and the balloons come back.', yes: 'New word', no: 'Keep going', onYes: newRound });
  });
  $('#btn-peek').addEventListener('click', function () { S.peek = !S.peek; renderSecret(); });

  sc.on(document, 'keydown', function (e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    var k = e.key.toLowerCase();
    if (/^[1-9]$/.test(k)) {
      var r = S.round, opts = r && r.pending ? r.options() : [];
      var o = opts[Number(k) - 1];
      if (o) answer(o.key);
      return;
    }
    if (k === 'n') { $('#btn-new').click(); return; }
    if (k === '?') openHelp();
  });

  newRound();
  if (A.firstVisit(GAME)) openHelp();

  window.sneakyHangman = { state: S, answer: answer, newRound: newRound };
  return sc.dispose;
}
