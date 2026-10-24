/*
 * Spot Kick: the stadium scene, aiming, the power meter, diving, and the end screen.
 * mount() runs after window.Arcade is ready (components/PageShell.jsx) and returns a cleanup function.
 */
import E from './engine.js';

export function mount() {
  var A = window.Arcade;
  var sc = A.scope();
  var GAME = 'spot-kick';
  var ORDER = ['pip', 'gridlock', 'monolith', 'edith'];
  var KEYS = ['q', 'w', 'e', 'a', 's', 'd'];
  var GX = 160, GY = 110, GW = 480, GH = 220;  // goal mouth in scene units

  function $(s) { return document.querySelector(s); }

  var S = {
    level: A.lastLevel(GAME),
    match: null,
    phase: 'idle',        // aim, power, flight, dive, over
    zone: null,
    power: 0,
    meterT: 0,
    diveLeft: 0,
    lastFrame: 0,
    lastLine: '',
    token: 0
  };

  var TALK = {
    pip: {
      blurb: 'A rookie keeper. Mostly guesses, sometimes copies your last kick.',
      start: ['I am going to save ALL of them. Probably some of them.', 'My gloves are on. One of them, anyway.', 'Penalties! My favorite! Wait, which way do I jump?'],
      taunt: ['I have a feeling about this one.', 'I am going left. Or right. Definitely one of those.', 'Kick it at me, please.'],
      saved: ['I got it! I actually got it!', 'Whoa! Did you see that?'], conceded: ['Aw, beans.', 'I jumped the wrong way. Again.', 'That was a good one.'],
      missed: ['Over the bar! I did that. With my mind.', 'Ha! The post is on my team.'],
      botGoal: ['GOAL! Did I do that?', 'In! I am a striker now.'], botSaved: ['Hey! You were supposed to go the other way!', 'Nice hands!'], botMiss: ['Oops. My foot slipped.', 'The goal moved!'],
      win: ['You won! Can I have a rematch? Please?'], lose: ['I won? I WON! Wait until Ted hears.']
    },
    gridlock: {
      blurb: 'Counts where you shoot. Dives to your favorite spot.',
      start: ['I keep a tally of every kick.', 'Shoot where you like. I am counting.', 'Statistics win shootouts.'],
      taunt: ['Your favorite spot is showing.', 'The numbers say you will go there again.', 'I have seen this kick before.'],
      saved: ['Predictable.', 'Exactly where the tally said.'], conceded: ['Statistical outlier.', 'Updating the tally.'],
      missed: ['Wide. As the numbers suggested.', 'Off target. Noted.'],
      botGoal: ['Your least favorite corner. Goal.', 'Tally says you never dive there.'], botSaved: ['Unexpected.', 'Recount needed.'], botMiss: ['Calculation error.'],
      win: ['You beat the tally. Impressive.'], lose: ['The tally wins again.']
    },
    monolith: {
      blurb: 'Watches what you do after each kick. If you have a rhythm, it finds it.',
      start: ['I watch what comes after what.', 'Every kick tells me about the next one.', 'I remember how you played last time.'],
      taunt: ['After that kick, you usually go one way.', 'I know what comes next.', 'You have a rhythm. I can hear it.'],
      saved: ['As I expected.', 'Your next move was obvious.'], conceded: ['You broke your own pattern.', 'Interesting choice.'],
      missed: ['Pressure does strange things.', 'Off target.'],
      botGoal: ['You dive like you did last time.', 'Exactly where you were not.'], botSaved: ['You read me. Rare.', 'Hm. Noted.'], botMiss: ['Wide. It happens.'],
      win: ['You were unpredictable. That is the only way.'], lose: ['Patterns always show.']
    },
    edith: {
      blurb: 'Runs eight different mind readers at once and listens to whichever one is reading you best. Remembers your last match.',
      start: ['Hi! I already know where you are going to kick.', 'Edith remembers you! Same tricks as last time?', 'Let\'s play! I have eight little brains for this.'],
      taunt: ['Ooh, I know this one.', 'You are going to go there, aren\'t you?', 'Edith sees everything.', 'Go on. I dare you.'],
      saved: ['Gotcha!', 'Too easy! Hee hee.', 'Edith saw that coming a mile away.'], conceded: ['Wait, what? Do that again.', 'Okay. That was sneaky.'],
      missed: ['Aww, the crossbar says hi!', 'So close! Not really.'],
      botGoal: ['Top bins! Hee hee.', 'You dived exactly where I hoped!'], botSaved: ['Hey! No fair reading Edith!', 'Okay, you are good.'], botMiss: ['Edith never misses. Except that once.'],
      win: ['Edith lost?! Nobody told Edith that could happen.'], lose: ['That was fun! Edith wins. Again!']
    }
  };
  var READ_NOTES = {
    pip: 'Mostly guessing, copies your last kick now and then.',
    gridlock: 'Watching your favorite spot.',
    monolith: 'Watching what you do after each kick.',
    edith: 'Listening to its best mind reader: '
  };

  function pick(arr) {
    var c = arr.filter(function (l) { return l !== S.lastLine; });
    c = c.length ? c : arr;
    return c[Math.floor(Math.random() * c.length)];
  }
  function cfg() { return E.LEVELS[S.level]; }
  function L() { return A.LEVEL_MAP[S.level]; }

  function say(text, mood) {
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
      case 'whistle': A.tone(2300, 0.12, 'sine', 0.04); A.tone(2300, 0.28, 'sine', 0.04, 0.16); break;
      case 'kick': A.noise(0.09, 0.09, 0, 180, 0.6); A.tone(110, 0.1, 'sine', 0.12, 0, 60); break;
      case 'cheer': A.noise(1.1, 0.06, 0.05, 900, 0.4); A.noise(0.9, 0.04, 0.15, 1800, 0.5); A.jingle('good'); break;
      case 'aww': A.tone(420, 0.5, 'triangle', 0.035, 0, 230); A.noise(0.6, 0.03, 0, 500, 0.4); break;
      case 'post': A.tone(1250, 0.35, 'triangle', 0.05); A.tone(1870, 0.25, 'sine', 0.025); break;
      case 'tick': A.tone(880, 0.03, 'square', 0.015); break;
      case 'pick': A.tone(620, 0.05, 'triangle', 0.04); break;
    }
  }

  // ---------- scene ----------

  var scene = $('#scene');
  var NS = 'http://www.w3.org/2000/svg';

  function crowd() {
    var r = E.rng(42), s = '', cols = ['#FFD9C2', '#FFE27A', '#fff', '#9BE15D', '#7EC8F5', '#FF6B57', '#B07CC6'];
    for (var row = 0; row < 5; row++) {
      var y = 18 + row * 16;
      s += '<rect x="0" y="' + (y + 4) + '" width="800" height="12" fill="' + (row % 2 ? '#3B365F' : '#454070') + '"/>';
      for (var x = 6 + (row % 2) * 7; x < 800; x += 14) s += '<circle cx="' + x + '" cy="' + y + '" r="5.2" fill="' + cols[Math.floor(r() * cols.length)] + '" class="fan"/>';
    }
    return s;
  }

  function buildScene() {
    var s = '<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2C2A4A"/><stop offset="1" stop-color="#5B3F6E"/></linearGradient>' +
      '<pattern id="netp" width="16" height="16" patternUnits="userSpaceOnUse"><path d="M0 0 L16 16 M16 0 L0 16" stroke="#fff" stroke-width="1.2" opacity=".5"/></pattern></defs>' +
      '<rect width="800" height="480" fill="url(#sky)"/>' + crowd() +
      '<g fill="#FFE27A" opacity=".85"><circle cx="40" cy="8" r="9"/><circle cx="760" cy="8" r="9"/></g>' +
      '<rect x="0" y="100" width="800" height="16" fill="#1D1A33"/><rect x="0" y="104" width="800" height="8" fill="#FF6B57"/>' +
      '<g font-family="Bangers, Impact, sans-serif" font-size="13" fill="#fff" letter-spacing="2"><text x="40" y="112">WHY NOT, INDEED?</text><text x="620" y="112">WNI CUP</text></g>';
    for (var i = 0; i < 9; i++) s += '<rect x="0" y="' + (116 + i * 41) + '" width="800" height="41" fill="' + (i % 2 ? '#5FB548' : '#6DC454') + '"/>';
    s += '<path d="M60 476 L150 330 H650 L740 476" fill="none" stroke="#fff" stroke-width="4" opacity=".85"/>' +
      '<path d="M210 330 L190 380 H610 L590 330" fill="none" stroke="#fff" stroke-width="4" opacity=".85"/>' +
      '<ellipse cx="400" cy="446" rx="9" ry="4" fill="#fff"/>';
    // goal: back net, mouth, posts
    s += '<g class="net-wobble" id="net"><path d="M' + GX + ' ' + GY + ' L' + (GX + 30) + ' ' + (GY - 26) + ' H' + (GX + GW - 30) + ' L' + (GX + GW) + ' ' + GY + ' V' + (GY + GH) + ' H' + GX + ' Z" fill="url(#netp)"/>' +
      '<rect x="' + GX + '" y="' + GY + '" width="' + GW + '" height="' + GH + '" fill="url(#netp)" opacity=".7"/></g>' +
      '<path d="M' + GX + ' ' + (GY + GH) + ' V' + GY + ' H' + (GX + GW) + ' V' + (GY + GH) + '" fill="none" stroke="#1D1A33" stroke-width="14" stroke-linejoin="round"/>' +
      '<path d="M' + GX + ' ' + (GY + GH) + ' V' + GY + ' H' + (GX + GW) + ' V' + (GY + GH) + '" fill="none" stroke="#fff" stroke-width="8" stroke-linejoin="round"/>';
    s += '<g id="guess" class="guess-mark"><circle r="38" fill="none" stroke="#FFE27A" stroke-width="5" stroke-dasharray="9 7"/><text y="-46" text-anchor="middle" font-family="Bangers, Impact, sans-serif" font-size="20" fill="#FFE27A" letter-spacing="1">GUESS</text></g>';
    s += '<g id="keeper" class="keeper"></g>';
    s += '<g id="zones"></g>';
    s += '<g id="ball" class="ball"><ellipse cx="0" cy="14" rx="15" ry="4" fill="#000" opacity=".25"/><g class="ball-spin"><circle r="16" fill="#fff" stroke="#1D1A33" stroke-width="3"/>' +
      '<path d="M0 -7 l6.6 4.8 -2.5 7.8 h-8.2 l-2.5 -7.8 z" fill="#1D1A33"/><path d="M0 -7 V-15 M6.6 -2.2 L14 -5 M4.1 5.6 L9 12 M-4.1 5.6 L-9 12 M-6.6 -2.2 L-14 -5" stroke="#1D1A33" stroke-width="2"/></g></g>';
    scene.innerHTML = s;
    var zones = $('#zones');
    E.ZONES.forEach(function (z) {
      var g = document.createElementNS(NS, 'g');
      g.setAttribute('class', 'zone');
      g.dataset.z = z;
      var x = GX + E.col(z) * (GW / 3), y = GY + E.row(z) * (GH / 2);
      g.innerHTML = '<rect x="' + (x + 4) + '" y="' + (y + 4) + '" width="' + (GW / 3 - 8) + '" height="' + (GH / 2 - 8) + '" rx="12"/>' +
        '<text class="zk" x="' + (x + GW / 6) + '" y="' + (y + GH / 4 + 10) + '" text-anchor="middle">' + KEYS[z].toUpperCase() + '</text>';
      g.addEventListener('click', function () { choose(z); });
      zones.appendChild(g);
    });
  }

  function keeperArt(mine) {
    var Lv = L();
    var shirt = mine ? '#3D86F0' : Lv.color, dark = mine ? '#2A6AD0' : Lv.dark;
    var head = mine
      ? '<circle cx="0" cy="-118" r="22" fill="#FFD9B8" stroke="#1D1A33" stroke-width="3"/><path d="M-22 -122 a22 22 0 0 1 44 0 q-10 -8 -22 -6 q-12 -2 -22 6z" fill="#5C3310" stroke="#1D1A33" stroke-width="2.5"/>' +
        '<circle cx="-8" cy="-116" r="2.6" fill="#1D1A33"/><circle cx="8" cy="-116" r="2.6" fill="#1D1A33"/><path d="M-8 -106 q8 7 16 0" fill="none" stroke="#1D1A33" stroke-width="2.6" stroke-linecap="round"/>'
      : A.face(S.level, 'calm').replace('<svg ', '<svg x="-30" y="-146" width="60" height="51.4" ');
    return '<ellipse cx="0" cy="4" rx="34" ry="7" fill="#000" opacity=".22"/>' +
      '<g stroke="#1D1A33" stroke-width="3" stroke-linejoin="round" stroke-linecap="round">' +
      '<path d="M-14 -34 L-20 0 M14 -34 L20 0" stroke="' + dark + '" stroke-width="12"/><path d="M-14 -34 L-20 0 M14 -34 L20 0" fill="none"/>' +
      '<path d="M-26 -4 h14 v6 h-16 z M12 -4 h14 l2 6 h-16 z" fill="#1D1A33"/>' +
      '<path d="M-30 -88 q30 -12 60 0 l-6 56 h-48 z" fill="' + shirt + '"/>' +
      '<path d="M-28 -84 L-52 -110 M28 -84 L52 -110" stroke="' + dark + '" stroke-width="12"/>' +
      '<circle cx="-54" cy="-114" r="11" fill="#FFE27A"/><circle cx="54" cy="-114" r="11" fill="#FFE27A"/>' +
      '<text x="0" y="-52" text-anchor="middle" font-family="Bangers, Impact, sans-serif" font-size="24" fill="#fff" stroke="none">' + (mine ? 'YOU' : '1') + '</text></g>' + head;
  }

  var HOME = { keeper: [400, 330], ball: [400, 440] };
  function place(id, x, y, rot, scale) {
    var n = document.getElementById(id);
    n.style.transform = 'translate(' + x + 'px, ' + y + 'px) rotate(' + (rot || 0) + 'deg) scale(' + (scale || 1) + ')';
  }
  function zoneCenter(z) { return [GX + (E.col(z) + 0.5) * (GW / 3), GY + (E.row(z) + 0.5) * (GH / 2)]; }

  function resetScene(keeperMine) {
    var k = $('#keeper');
    k.style.transition = 'none';
    $('#ball').style.transition = 'none';
    k.innerHTML = keeperArt(keeperMine);
    place('keeper', HOME.keeper[0], HOME.keeper[1]);
    place('ball', HOME.ball[0], HOME.ball[1]);
    $('#ball').classList.remove('fly');
    $('#guess').classList.remove('on');
    $('#banner').hidden = true;
    zonesClass('picked', null);
    void k.getBoundingClientRect();
    k.style.transition = '';
    $('#ball').style.transition = '';
  }

  function diveTo(z) {
    if (z == null) { place('keeper', 400, 330, 0, 1); return; }
    var c = E.col(z), r = E.row(z);
    var dx = (c - 1) * 165, dy = r === 0 ? -70 : 0, rot = (c - 1) * (r === 0 ? 62 : 80);
    if (c === 1) { dy = r === 0 ? -80 : 6; rot = 0; }
    place('keeper', 400 + dx, 330 + dy, rot, c === 1 && r === 1 ? 0.92 : 1);
  }

  function zonesClass(cls, z) {
    Array.prototype.forEach.call(document.querySelectorAll('.zone'), function (g) { g.classList.toggle(cls, Number(g.dataset.z) === z); });
  }

  function banner(text, kind) {
    var b = $('#banner');
    b.textContent = text;
    b.className = 'banner ' + (kind || '');
    b.hidden = false;
  }
  function prompt(html) { $('#prompt').innerHTML = html; }

  // ---------- panel ----------

  function renderBoard() {
    var m = S.match;
    ['you', 'bot'].forEach(function (who) {
      var ks = m.kicks.filter(function (k) { return k.who === who; });
      var n = Math.max(5, ks.length + (m.turn === who && !m.over ? 1 : 0));
      var dots = '';
      for (var i = 0; i < n; i++) {
        var k = ks[i];
        var cls = k ? (k.result === 'goal' ? 'goal' : 'miss') : (i === ks.length && m.turn === who && !m.over ? 'next' : '');
        dots += '<i class="dot ' + cls + '"></i>';
      }
      $('#dots-' + who).innerHTML = dots;
      $('#score-' + who).textContent = m.score[who];
    });
    var you = m.taken('you');
    $('#board-note').textContent = m.over ? (m.winner === 'you' ? 'You win the shootout!' : L().name + ' wins the shootout.') :
      you >= 5 && m.taken('bot') >= 5 ? 'Sudden death! First to miss while the other scores loses.' : 'Five kicks each. Then sudden death.';
    $('#bot-short').textContent = L().name;
  }

  function renderRead() {
    var m = S.match, d = m.keeper.distribution(), top = Math.max.apply(null, d);
    var pct = Math.round(Math.max(0, (top - 1 / 6) / (5 / 6)) * 100);
    if (m.keeper.history.length === 0) pct = 0;
    $('#read-num').textContent = pct + '%';
    $('#read-fill').style.width = pct + '%';
    var note = READ_NOTES[S.level];
    if (S.level === 'edith') note += (E.PREDICTORS[m.keeper.lastUsed] || { name: 'warming up' }).name + '.';
    if (m.keeper.history.length === 0) note = 'It has not seen you kick yet.' + (m.keeper.priorLen ? ' But it remembers your last match.' : '');
    $('#read-note').textContent = note;
  }

  function renderSide() {
    var Lv = L();
    $('#bot-name').textContent = Lv.name;
    $('#bot-rank').textContent = Lv.rank + ' keeper';
    renderBoard();
    renderRead();
    var best = A.progress(GAME)[S.level];
    $('#best').textContent = best ? 'Your best against ' + Lv.name + ': ' + best.text + '.' : Lv.name + ' has not lost a shootout to you yet.';
  }

  // ---------- flow ----------

  function newMatch() {
    A.closeModal(true);
    S.token++;
    var mem = A.store.get('sk-memory-' + S.level, null);
    S.match = new E.Match(S.level, (Math.random() * 1e9) >>> 0, mem);
    setFace('smug');
    say(pick(TALK[S.level].start), 'smug');
    sfx('whistle');
    yourKick();
  }

  function yourKick() {
    var m = S.match;
    S.phase = 'aim';
    S.zone = null;
    resetScene(false);
    $('.stage').className = 'stage aiming';
    $('#meter').classList.add('idle');
    prompt('Your kick: pick a spot in the goal.');
    renderSide();
    if (m.kicks.length && Math.random() < 0.5) say(pick(TALK[S.level].taunt), 'smug');
    A.music.intensity(0.7);
  }

  function choose(z) {
    if (A.isBoss() || A.modalOpen()) return;
    if (S.phase === 'aim' || S.phase === 'power') {
      S.zone = z;
      S.phase = 'power';
      S.meterT = 0;
      zonesClass('picked', z);
      $('#meter').classList.remove('idle');
      prompt('Aiming <b>' + E.ZONE_NAMES[z] + '</b>. Stop the needle in the green: tap again, or press Space.');
      sfx('pick');
      return;
    }
    if (S.phase === 'dive') return dive(z);
  }

  function meterValue(t) {
    var p = (t * cfg().meter * 0.9) % 2;
    return p > 1 ? 2 - p : p;
  }

  function strike() {
    if (S.phase !== 'power' || A.isBoss() || A.modalOpen()) return;
    var m = S.match, power = meterValue(S.meterT), token = S.token;
    S.phase = 'flight';
    S.power = power;
    $('.stage').className = 'stage locked';
    var k = m.shoot(S.zone, power);
    sfx('kick');
    prompt('');
    var c = zoneCenter(k.zone), tx = c[0] + (Math.random() - 0.5) * 50, ty = c[1] + (Math.random() - 0.5) * 34;
    if (k.result === 'miss') {
      if (k.why === 'over') ty = GY - 40 - Math.random() * 30;
      else tx = E.col(k.zone) === 0 ? GX - 4 : GX + GW + 4;
    }
    var ball = $('#ball');
    ball.classList.add('fly');
    place('ball', tx, ty, 0, 0.62);
    sc.timeout(function () { if (token === S.token) diveTo(k.dive); }, 90);
    sc.timeout(function () {
      if (token !== S.token) return;
      var gm = $('#guess'), gc = zoneCenter(k.dive);
      gm.setAttribute('transform', 'translate(' + gc[0] + ' ' + gc[1] + ')');
      gm.classList.add('on');
      var T = TALK[S.level];
      if (k.result === 'goal') {
        banner('GOAL!', '');
        sfx('cheer');
        netHit();
        say(pick(T.conceded), 'annoyed');
      } else if (k.result === 'save') {
        banner('SAVED!', 'save');
        sfx('aww');
        place('ball', c[0] + (E.col(k.zone) - 1) * 60, 380, 0, 0.8);
        say(pick(T.saved), 'happy');
        cheerFace();
      } else {
        banner(k.why === 'over' ? 'OVER!' : 'POST!', 'miss');
        sfx(k.why === 'post' ? 'post' : 'aww');
        if (k.why === 'post') place('ball', tx + (E.col(k.zone) === 0 ? -70 : 70), 360, 0, 0.7);
        say(pick(T.missed), 'happy');
      }
      renderSide();
    }, 560);
    later(1900, token, next);
  }

  function netHit() {
    var n = $('#net');
    n.classList.remove('hit');
    void n.getBoundingClientRect();
    n.classList.add('hit');
  }
  function cheerFace() {
    var f = $('#face');
    f.classList.remove('cheer');
    void f.offsetWidth;
    f.classList.add('cheer');
  }

  // Waits that pause with the panic button, a modal, or a hidden tab.
  function later(ms, token, fn) {
    var left = ms, last = performance.now();
    (function tick(now) {
      if (token !== S.token) return;
      var dt = now - last;
      last = now;
      if (!(A.isBoss() || A.modalOpen() || document.hidden)) left -= dt;
      if (left <= 0) fn(); else sc.raf(tick);
    })(last);
  }

  function next() {
    var m = S.match;
    if (m.over) return endMatch();
    if (m.turn === 'you') yourKick(); else botKick();
  }

  function botKick() {
    var m = S.match;
    S.phase = 'dive';
    S.aim = m.aim();
    S.diveLeft = cfg().diveSecs;
    resetScene(true);
    $('.stage').className = 'stage aiming';
    $('#meter').classList.add('idle');
    renderSide();
    setFace('smug');
    say(L().name + ' steps up to the spot...', 'smug');
    A.music.intensity(0.8);
  }

  function dive(z) {
    if (S.phase !== 'dive') return;
    var m = S.match, token = S.token;
    S.phase = 'flight';
    $('.stage').className = 'stage locked';
    zonesClass('picked', z);
    var k = m.keep(z);
    sfx('kick');
    prompt('');
    diveTo(z == null ? null : z);
    var c = zoneCenter(k.zone), tx = c[0] + (Math.random() - 0.5) * 50, ty = c[1] + (Math.random() - 0.5) * 34;
    if (k.result === 'miss') { if (E.row(k.zone) === 0) ty = GY - 50; else tx = E.col(k.zone) === 2 ? GX + GW + 8 : GX - 8; }
    $('#ball').classList.add('fly');
    place('ball', tx, ty, 0, 0.62);
    sc.timeout(function () {
      if (token !== S.token) return;
      var T = TALK[S.level];
      if (k.result === 'goal') { banner('GOAL!', ''); sfx('aww'); netHit(); say(pick(T.botGoal), 'happy'); cheerFace(); }
      else if (k.result === 'save') { banner('YOU SAVED IT!', 'save'); sfx('cheer'); place('ball', c[0] + (E.col(k.zone) - 1) * 60, 380, 0, 0.8); say(pick(T.botSaved), 'surprised'); }
      else { banner('MISSED!', 'miss'); sfx('post'); say(pick(T.botMiss), 'annoyed'); }
      renderSide();
    }, 520);
    later(1900, token, next);
  }

  function frame(now) {
    sc.raf(frame);
    var dt = S.lastFrame ? Math.min(0.1, (now - S.lastFrame) / 1000) : 0;
    S.lastFrame = now;
    if (A.isBoss() || A.modalOpen() || document.hidden) return;
    if (S.phase === 'power') {
      S.meterT += dt;
      $('#needle').style.left = (meterValue(S.meterT) * 100) + '%';
    }
    if (S.phase === 'dive') {
      var before = Math.ceil(S.diveLeft);
      S.diveLeft -= dt;
      if (Math.ceil(S.diveLeft) !== before && S.diveLeft > 0) sfx('tick');
      prompt(L().name + ' is about to shoot. Pick where to dive! <b>' + Math.max(0, S.diveLeft).toFixed(1) + 's</b>');
      if (S.diveLeft <= 0) dive(null);
    }
  }

  function endMatch() {
    var m = S.match, Lv = L(), won = m.winner === 'you';
    S.phase = 'over';
    $('.stage').className = 'stage locked';
    prompt('');
    A.store.set('sk-memory-' + S.level, m.memory());
    var saves = m.kicks.filter(function (k) { return k.who === 'bot' && k.result === 'save'; }).length;
    var diff = m.score.you - m.score.bot;
    var stars = !won ? 0 : diff >= 3 ? 3 : diff >= 2 ? 2 : 1;
    var base = 120 * m.score.you + 100 * saves + (won ? 500 : 0);
    A.account.submit(GAME, S.level, A.points(S.level, base), (won ? 'Won ' : 'Lost ') + m.score.you + ' to ' + m.score.bot);
    renderSide();
    A.music.intensity(0.5);
    var T = TALK[S.level];
    var hunch = E.PREDICTORS[m.keeper.lastUsed];
    if (won) {
      var rec = A.record(GAME, S.level, { stars: stars, score: diff, lowerIsBetter: false, text: 'won ' + m.score.you + ' to ' + m.score.bot });
      bar.refresh();
      A.jingle('win');
      say(pick(T.win), 'dead');
      var nxt = ORDER[ORDER.indexOf(S.level) + 1], buttons = [];
      if (nxt) buttons.push({ label: 'Next keeper: ' + A.LEVEL_MAP[nxt].name, kind: 'main', onClick: function () { switchTo(nxt); } });
      buttons.push({ label: 'Rematch', kind: nxt ? 'line' : 'main', onClick: newMatch });
      A.modal({
        title: S.level === 'edith' ? 'You beat Edith!' : 'Shootout won!',
        tone: 'win',
        html: '<p class="lead">You won <strong>' + m.score.you + ' to ' + m.score.bot + '</strong> and saved ' + saves + ' of ' + Lv.name + '\'s kicks.</p>' + A.stars(stars) +
          '<p><strong>' + (rec.better ? (rec.prev ? 'New best margin against ' + Lv.name + '!' : 'First shootout won against ' + Lv.name + '.') : 'Your best: ' + rec.prev.text + '.') + '</strong></p>' +
          (stars < 3 ? '<p class="soft">3 stars means winning by 3 goals or more.</p>' : ''),
        buttons: buttons
      });
    } else {
      A.jingle('lose');
      say(pick(T.lose), 'happy');
      A.modal({
        title: Lv.name + ' wins it.',
        tone: 'lose',
        html: '<p class="lead">' + Lv.name + ' won <strong>' + m.score.bot + ' to ' + m.score.you + '</strong>.' + (hunch && S.level !== 'pip' ? ' By the end it was reading you with its "' + hunch.name + '" trick.' : '') + '</p>' +
          '<p class="soft">Tips: do not fall into a rhythm. Mix high and low, left and right, and do not answer a kick with its mirror. Stop the needle in the green so even a good guess may not be enough.</p>',
        buttons: [{ label: 'Rematch', kind: 'main', onClick: newMatch }],
        link: { label: 'Close and look at the pitch' }
      });
    }
  }

  function switchTo(id) {
    S.level = id;
    bar.setLevel(id);
    newMatch();
  }

  function openHelp() {
    var rows = ORDER.map(function (id) {
      var Lv = A.LEVEL_MAP[id];
      return '<div><dt>' + Lv.name + ', ' + Lv.rank.toLowerCase() + '</dt><dd>' + TALK[id].blurb + '</dd></div>';
    }).join('');
    A.modal({
      title: 'How to play',
      wide: true,
      html: '<p>A penalty shootout against a robot that learns your habits. You take turns: you shoot, then it shoots and you keep goal.</p>' +
        '<ol><li><b>Shooting:</b> pick one of six spots in the goal, then stop the power needle. Green is the sweet spot. Too hard and a high shot flies over the bar.</li>' +
        '<li><b>Keeping:</b> when the robot steps up, pick where to dive before the timer runs out.</li>' +
        '<li>Five kicks each. If it is tied, sudden death decides it.</li></ol>' +
        '<p>The robot watches everything you do. If you favor a corner, repeat a pattern or always switch sides, it will notice and dive there. Being unpredictable is the whole game.</p>' +
        '<h3>Keepers</h3><dl>' + rows + '</dl>' +
        '<h3>Keys</h3><table class="keys"><tr><td><kbd>Q</kbd> <kbd>W</kbd> <kbd>E</kbd></td><td>Top left, top middle, top right</td></tr>' +
        '<tr><td><kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd></td><td>Low left, low middle, low right</td></tr>' +
        '<tr><td><kbd>Space</kbd></td><td>Strike (stop the power needle)</td></tr><tr><td><kbd>N</kbd></td><td>New shootout</td></tr>' +
        '<tr><td><kbd>M</kbd></td><td>Music on or off</td></tr><tr><td><kbd>B</kbd></td><td>Panic button</td></tr></table>',
      buttons: [{ label: 'Lace up', kind: 'main' }]
    });
  }

  var bar = A.mountBar({
    el: $('#bar'),
    game: GAME,
    title: 'Spot Kick',
    tagline: 'A shootout against a keeper that learns your habits.',
    level: S.level,
    levelLabel: 'Keeper',
    canSwitch: function () { return S.match && !S.match.over && S.match.kicks.length ? 'This shootout will be abandoned.' : true; },
    onLevel: function (id) { S.level = id; newMatch(); },
    onHelp: openHelp
  });
  sc.add(bar.destroy);

  $('#btn-new').addEventListener('click', function () {
    if (!(S.match && !S.match.over && S.match.kicks.length)) return newMatch();
    A.confirm({ title: 'New shootout?', text: 'This one will be abandoned and the score goes back to 0 to 0.', yes: 'New shootout', no: 'Keep playing', onYes: newMatch });
  });
  $('#meter').addEventListener('click', strike);
  scene.addEventListener('click', function (e) { if (S.phase === 'power' && !e.target.closest('.zone')) strike(); });

  sc.on(document, 'keydown', function (e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    var k = e.key.toLowerCase(), z = KEYS.indexOf(k);
    if (z >= 0) {
      if (S.phase === 'power' && S.zone === z) { strike(); return; }
      choose(z);
      return;
    }
    if (k === ' ' || k === 'enter') {
      if (e.target && e.target.tagName === 'BUTTON' && k === 'enter') return;
      if (S.phase === 'power') { e.preventDefault(); strike(); }
      return;
    }
    if (k === 'n') { $('#btn-new').click(); return; }
    if (k === '?') openHelp();
  });

  buildScene();
  newMatch();
  sc.raf(frame);
  if (A.firstVisit(GAME)) openHelp();

  window.spotKick = { state: S, choose: choose, strike: strike, dive: dive, newMatch: newMatch };
  return sc.dispose;
}
