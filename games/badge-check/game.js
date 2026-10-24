/*
 * Badge Check: the visitor and their badge, the directory and floor chart, your calls, and the end of a shift.
 * mount() runs after window.Arcade is ready (components/PageShell.jsx) and returns a cleanup function.
 */
import E from './engine.js';

export function mount() {
  var A = window.Arcade;
  var sc = A.scope();
  var GAME = 'badge-check';
  var ORDER = ['pip', 'gridlock', 'monolith', 'edith'];
  var SKIN = ['#F6D7B8', '#F2C9A0', '#D9A066', '#C68B59', '#A86B3C', '#7A4A2A'];
  var HAIR = ['#1D1A33', '#6B4226', '#E2B24C', '#C1502E', '#B8B8C4', '#3D86F0'];
  var SHIRT = ['#3D86F0', '#2FBF71', '#B83B7D', '#EF6C2B', '#7E97C9', '#1F9C8E'];
  var WALK = 600; // ms the next visitor needs to step up; their timer starts after that

  function $(s) { return document.querySelector(s); }
  // today on the player's own clock (their computer's timezone)
  function localToday() { var n = new Date(); return { year: n.getFullYear(), month: n.getMonth(), day: n.getDate() }; }

  var S = { level: A.lastLevel(GAME), sh: null, running: false, paused: false, acc: 0, lastFrame: 0, walkUntil: 0, lastLine: '', endShown: false, mistakes: [], cueUntil: 0 };

  var TALK = {
    pip: {
      blurb: 'Makes badges with crayons: wrong photos, dates from months ago, the wrong stamp, floors that do not exist. Picks at random.',
      rank: 'Rookie forger',
      start: ['I made some badges! They are very real.', 'Hello! Nothing suspicious here!', 'Is today a good day for badges?'],
      fooled: ['It worked! Hee hee!', 'Wow, that one got in!'], caught: ['Aww, you noticed!', 'Was it the crayon?'],
      wrong: ['Ha! That one was real!'], end: ['That was fun! Same time tomorrow?']
    },
    gridlock: {
      blurb: 'Neat forgeries, always in the same order: photo, date, stamp, floor, name, and round again.',
      rank: 'Pro forger',
      start: ['Forgeries prepared. Alphabetical by flaw.', 'One fake, then the next. Like clockwork.', 'Every badge is a little bit different.'],
      fooled: ['Accepted. As planned.', 'Another one through.'], caught: ['Noted. Next one.', 'Detected. Moving on.'],
      wrong: ['That was a real employee. Interesting.'], end: ['Shift over. Paperwork complete.']
    },
    monolith: {
      blurb: 'Sneaky forgeries (a one-letter typo, last week\'s date, a near-miss stamp) and it learns which details slip past you.',
      rank: 'Grandmaster forger',
      start: ['I watch what you check. And what you do not.', 'Details are where people stop looking.', 'Every mistake teaches me something.'],
      fooled: ['So you skip that detail. Good to know.', 'Your blind spot is showing.'], caught: ['Hm. You check that. Noted.', 'A sharp eye. For now.'],
      wrong: ['You stopped a real one. Nervous?'], end: ['I learned a lot today.']
    },
    edith: {
      blurb: 'The sneakiest forgeries, people who are not on staff at all, and she learns fast. Decide in a hurry and she switches to the details that take longest to check.',
      rank: 'Impossible forger',
      start: ['Hi! I made the badges myself. Aren\'t they pretty?', 'Edith knows which details you skip. Hee hee.', 'Faster, faster! The queue is waiting!'],
      fooled: ['Hee hee, that one was mine!', 'In they go! Oopsie!', 'You did not even check the name, did you?'], caught: ['Rats! Lucky guess!', 'Okay, okay, good catch.'],
      wrong: ['That was a real coworker! Hee hee!'], end: ['Edith wins! The office is full of strangers now!']
    }
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
  function cue(html, bad, ms) {
    var c = $('#cue');
    c.innerHTML = html;
    c.className = 'cue' + (bad ? ' bad' : '');
    c.hidden = false;
    S.cueUntil = performance.now() + (ms || 1400);
  }

  function sfx(kind) {
    switch (kind) {
      case 'beep': A.tone(880, 0.08, 'square', 0.03); A.tone(1175, 0.12, 'square', 0.03, 0.08); break;
      case 'buzz': A.tone(140, 0.25, 'sawtooth', 0.045); break;
      case 'caught': A.tone(660, 0.07, 'triangle', 0.04); A.tone(880, 0.07, 'triangle', 0.04, 0.07); A.tone(1320, 0.12, 'triangle', 0.04, 0.14); break;
      case 'step': A.tone(300, 0.05, 'triangle', 0.025); A.tone(260, 0.05, 'triangle', 0.025, 0.12); break;
      case 'tick': A.tone(1200, 0.02, 'square', 0.015); break;
    }
  }

  // ---------- art ----------

  // A person, drawn from their look. The same drawing (small) is the badge photo.
  function personSvg(look) {
    var skin = SKIN[look.skin], hair = HAIR[look.hairColor], shirt = SHIRT[look.shirt], s = '';
    s += '<svg viewBox="0 0 200 220" aria-hidden="true">';
    if (look.hair === 1) s += '<path d="M44 96 Q40 40 100 34 Q160 40 156 96 L160 170 Q130 182 100 182 Q70 182 40 170 Z" fill="' + hair + '" stroke="#1D1A33" stroke-width="4"/>';
    s += '<path d="M18 222 Q22 168 100 164 Q178 168 182 222 Z" fill="' + shirt + '" stroke="#1D1A33" stroke-width="4"/>';
    s += '<path d="M86 150 v22 q14 10 28 0 v-22" fill="' + skin + '" stroke="#1D1A33" stroke-width="4"/>';
    s += '<ellipse cx="48" cy="104" rx="9" ry="13" fill="' + skin + '" stroke="#1D1A33" stroke-width="4"/><ellipse cx="152" cy="104" rx="9" ry="13" fill="' + skin + '" stroke="#1D1A33" stroke-width="4"/>';
    s += '<ellipse cx="100" cy="102" rx="52" ry="60" fill="' + skin + '" stroke="#1D1A33" stroke-width="4"/>';
    if (look.hair === 0) s += '<path d="M48 92 Q50 40 100 40 Q150 40 152 92 Q140 66 100 64 Q60 66 48 92 Z" fill="' + hair + '" stroke="#1D1A33" stroke-width="4" stroke-linejoin="round"/>';
    if (look.hair === 1) s += '<path d="M50 90 Q56 46 100 44 Q144 46 150 90 Q126 70 100 72 Q74 70 50 90 Z" fill="' + hair + '" stroke="#1D1A33" stroke-width="4" stroke-linejoin="round"/>';
    if (look.hair === 2) s += '<circle cx="100" cy="34" r="20" fill="' + hair + '" stroke="#1D1A33" stroke-width="4"/><path d="M50 88 Q54 46 100 46 Q146 46 150 88 Q128 64 100 64 Q72 64 50 88 Z" fill="' + hair + '" stroke="#1D1A33" stroke-width="4" stroke-linejoin="round"/>';
    if (look.hair === 3) {
      [[58, 66], [74, 50], [94, 44], [114, 44], [132, 52], [146, 68], [52, 86], [150, 88]].forEach(function (c) { s += '<circle cx="' + c[0] + '" cy="' + c[1] + '" r="16" fill="' + hair + '" stroke="#1D1A33" stroke-width="4"/>'; });
      s += '<path d="M60 70 Q100 56 140 70" fill="none" stroke="' + hair + '" stroke-width="16"/>';
    }
    // face
    s += '<circle cx="80" cy="104" r="6" fill="#1D1A33"/><circle cx="120" cy="104" r="6" fill="#1D1A33"/>';
    s += '<path d="M72 90 q8 -6 16 0 M112 90 q8 -6 16 0" fill="none" stroke="#1D1A33" stroke-width="4" stroke-linecap="round"/>';
    s += '<path d="M100 110 q-6 14 4 16" fill="none" stroke="#1D1A33" stroke-width="3.5" stroke-linecap="round"/>';
    s += '<path d="M84 136 q16 12 32 0" fill="none" stroke="#1D1A33" stroke-width="4" stroke-linecap="round"/>';
    if (look.glasses) s += '<rect x="62" y="92" width="34" height="26" rx="9" fill="rgba(255,255,255,.25)" stroke="#1D1A33" stroke-width="4"/><rect x="104" y="92" width="34" height="26" rx="9" fill="rgba(255,255,255,.25)" stroke="#1D1A33" stroke-width="4"/><path d="M96 104 h8" stroke="#1D1A33" stroke-width="4"/>';
    return s + '</svg>';
  }

  function stampSvg(st) {
    var c = E.STAMP_COLORS[st.color], body;
    if (st.shape === 'star') body = '<path d="M30 6 l7 15 16 2 -12 11 3 16 -14 -8 -14 8 3 -16 -12 -11 16 -2 z" />';
    else if (st.shape === 'circle') body = '<circle cx="30" cy="30" r="22"/>';
    else if (st.shape === 'diamond') body = '<path d="M30 6 L54 30 L30 54 L6 30 Z"/>';
    else body = '<path d="M30 52 C10 38 4 26 10 16 C16 6 28 8 30 18 C32 8 44 6 50 16 C56 26 50 38 30 52 Z"/>';
    return '<svg viewBox="0 0 60 60" aria-hidden="true"><g fill="' + c + '" stroke="#1D1A33" stroke-width="3" stroke-linejoin="round" opacity=".92">' + body + '</g></svg>';
  }
  function stampName(st) { return st.color + ' ' + st.shape; }

  // ---------- rendering ----------

  function renderVisitor(enter) {
    var sh = S.sh, v = sh.visitor, b = v && v.badge;
    var person = $('#person'), badge = $('#badge');
    if (!v) { person.innerHTML = ''; badge.innerHTML = ''; return; }
    person.innerHTML = personSvg(v.person.look);
    badge.innerHTML =
      '<div class="badge-top"><span>WNI TOWER</span><span>STAFF</span></div>' +
      '<div class="badge-body"><div class="badge-photo">' + personSvg(b.photo) + '</div><div class="badge-fields">' +
      '<span><span class="field-label">Name</span><span class="field-value">' + A.esc(b.first + ' ' + b.last) + '</span></span>' +
      '<span><span class="field-label">Department</span><span class="field-value">' + A.esc(b.dept) + '</span></span>' +
      '<span><span class="field-label">Floor</span><span class="field-value">' + b.floor + '</span></span>' +
      '<span><span class="field-label">Valid until</span><span class="field-value">' + E.dateText(b.expires) + '</span></span>' +
      '</div></div><div class="badge-stamp" title="Stamp">' + stampSvg(b.stamp) + '</div>';
    if (enter) {
      [person, badge].forEach(function (el) { el.classList.remove('enter'); void el.offsetWidth; el.classList.add('enter'); });
      sfx('step');
    }
    var waiting = Math.min(6, 2 + Math.floor(sh.served / 6));
    $('#queue').innerHTML = new Array(waiting + 1).join('<span></span>');
  }

  function renderDesk() {
    var sh = S.sh;
    $('#today-day').textContent = 'Today (' + sh.weekday() + ')';
    $('#today').textContent = sh.dateText();
    $('#stamp').innerHTML = stampSvg(sh.stamp) + '<span>' + stampName(sh.stamp) + '</span>';
    // floors as chips, lowest floor first; the directory alphabetical by last name, down two columns
    $('#floors').innerHTML = E.DEPTS.slice().sort(function (a, b) { return sh.floors[a] - sh.floors[b]; })
      .map(function (d) { return '<span class="floor" title="' + d + ' is on floor ' + sh.floors[d] + '"><b>' + sh.floors[d] + '</b><span>' + d + '</span></span>'; }).join('');
    $('#directory').innerHTML = sh.staff.slice().sort(function (a, b) { return a.last.localeCompare(b.last); })
      .map(function (s) { return '<div class="person-row"><b>' + A.esc(s.first + ' ' + s.last) + '</b><span>' + s.dept + '</span></div>'; }).join('');
  }

  function renderPanel() {
    var sh = S.sh, Lv = L();
    $('#bot-name').textContent = Lv.name;
    $('#bot-rank').textContent = TALK[S.level].rank;
    $('#correct').textContent = sh.correct;
    $('#strikes').innerHTML = [0, 1, 2].map(function (i) { return '<span class="strike' + (i < sh.strikes ? ' used' : '') + '">' + (i < sh.strikes ? '&#10007;' : '') + '</span>'; }).join('');
    $('#streak').textContent = sh.streak >= 2 ? sh.streak + ' in a row' : '';
    var best = A.progress(GAME)[S.level];
    $('#best').textContent = best ? 'Your best against ' + Lv.name + ': ' + best.text + '.' : 'No shift against ' + Lv.name + ' yet. Stars at ' + E.STARS.join(', ') + ' correct calls.';
    var busy = !S.running || !sh.visitor || sh.over;
    $('#btn-stop').disabled = busy;
    $('#btn-let').disabled = busy;
  }

  function renderTimer() {
    var v = S.sh.visitor, i = $('#timer-fill');
    if (!v) { i.style.width = '0%'; return; }
    var k = Math.max(0, v.left / v.timer);
    i.style.width = (100 * k) + '%';
    i.classList.toggle('low', k < 0.3);
  }

  // ---------- the shift ----------

  function newShift() {
    A.closeModal(true);
    S.sh = new E.Shift(S.level, (Math.random() * 1e9) >>> 0, localToday());
    S.sh.events.length = 0;
    S.running = false;
    S.paused = false;
    S.endShown = false;
    S.mistakes = [];
    $('#start-card').hidden = false;
    $('#cue').hidden = true;
    renderDesk();
    renderVisitor(false);
    renderPanel();
    renderTimer();
    say(pick(TALK[S.level].start), 'smug');
    A.music.intensity(0.4);
  }

  function start() {
    if (A.modalOpen()) return;
    if (S.sh.over) { newShift(); return; }
    if (S.running) return;
    S.running = true;
    S.lastFrame = 0;
    S.walkUntil = performance.now() + WALK;
    $('#start-card').hidden = true;
    renderVisitor(true);
    renderPanel();
  }

  function call(letIn) {
    var sh = S.sh;
    if (!S.running || !sh || sh.over || !sh.visitor || A.isBoss() || A.modalOpen() || S.paused) return;
    if (performance.now() < S.walkUntil) return;
    var v = sh.visitor;
    sh.decide(letIn);
    flush(v);
  }

  // Shows what happened to visitor v, then brings in the next one.
  function flush(v) {
    var sh = S.sh, T = TALK[S.level];
    sh.events.forEach(function (ev) {
      if (ev.type !== 'judged') return;
      var why = sh.explain(v);
      if (ev.correct) {
        sfx(ev.fake ? 'caught' : 'beep');
        cue(ev.fake ? 'Caught a fake!<small>' + A.esc(why) + '</small>' : 'Welcome in!' + (ev.gained > 10 ? '<small>+' + ev.gained + ' points</small>' : ''), false, ev.fake ? 2000 : 900);
        if (ev.fake && Math.random() < 0.6) say(pick(T.caught), 'annoyed');
      } else {
        sfx('buzz');
        var head = ev.timeout ? 'Too slow! The queue pushed past.' : ev.fake ? 'That was a fake!' : 'That was a real coworker!';
        var detail = ev.fake ? why : ev.timeout ? 'Their badge was fine.' : 'Everything on the badge checked out.';
        cue(head + '<small>' + A.esc(detail) + '</small>', true, 2600);
        S.mistakes.push(head + ' ' + detail);
        say(pick(ev.fake ? T.fooled : T.wrong), 'happy');
      }
    });
    var ended = sh.events.some(function (ev) { return ev.type === 'end'; });
    sh.events.length = 0;
    renderPanel();
    if (ended) { renderTimer(); sc.timeout(endGame, 1300); return; }
    S.walkUntil = performance.now() + WALK + 500;
    sc.timeout(function () { if (S.sh === sh && !sh.over) renderVisitor(true); }, 450);
    A.music.intensity(Math.min(0.95, 0.45 + sh.served / 60));
  }

  // Midnight on the player's clock: the shift moves to the new date, and badges are checked against it.
  function checkDate(now) {
    if (now < (S.dateCheck || 0)) return;
    S.dateCheck = now + 1000;
    var sh = S.sh;
    if (!sh || sh.over || !sh.setToday(localToday())) return;
    sh.events.length = 0;
    renderDesk();
    cue('Midnight! A new day.<small>Badges are now checked against ' + A.esc(sh.dateText()) + '.</small>', false, 2600);
  }

  function frame(now) {
    sc.raf(frame);
    checkDate(now);
    var sh = S.sh, dt = S.lastFrame ? Math.min(0.1, (now - S.lastFrame) / 1000) : 0;
    S.lastFrame = now;
    if (sh && S.running && !sh.over && now >= S.walkUntil && !(S.paused || A.isBoss() || A.modalOpen() || document.hidden)) {
      S.acc += dt;
      var v = sh.visitor;
      while (S.acc >= E.DT && !sh.over && sh.visitor === v) { sh.step(); S.acc -= E.DT; }
      if (sh.visitor !== v || sh.over) { S.acc = 0; flush(v); }
      renderTimer();
    } else S.acc = 0;
    $('#cue').hidden = now > S.cueUntil;
    $('#btn-pause').textContent = S.paused ? 'Resume (P)' : 'Pause (P)';
    $('#btn-pause').disabled = !S.running || !sh || sh.over;
  }

  function endGame() {
    var sh = S.sh, Lv = L(), T = TALK[S.level];
    if (S.endShown) return;
    S.endShown = true;
    S.running = false;
    var stars = sh.stars();
    A.account.submit(GAME, S.level, A.points(S.level, sh.points()), sh.correct + ' correct calls of ' + sh.served);
    var rec = A.record(GAME, S.level, { stars: stars, score: sh.correct, lowerIsBetter: false, text: sh.correct + ' correct calls' });
    bar.refresh();
    renderPanel();
    A.music.intensity(0.4);
    A.jingle(stars ? 'win' : 'lose');
    say(pick(T.end), 'happy');
    var next = ORDER[ORDER.indexOf(S.level) + 1], buttons = [{ label: 'New shift', kind: 'main', onClick: newShift }];
    if (stars && next) buttons.push({ label: 'Next forger: ' + A.LEVEL_MAP[next].name, kind: 'line', onClick: function () { switchTo(next); } });
    A.modal({
      title: stars === 3 ? 'Head of security!' : stars ? 'Good shift!' : 'Shift over',
      tone: stars ? 'win' : 'lose',
      html: '<p class="lead">You made <strong>' + sh.correct + ' correct calls</strong> out of ' + sh.served + ' visitors before three mistakes.</p>' +
        '<ul>' + S.mistakes.map(function (m) { return '<li>' + A.esc(m) + '</li>'; }).join('') + '</ul>' + A.stars(stars) +
        '<p><strong>' + (rec.better ? (rec.prev ? 'New best against ' + Lv.name + '!' : 'Your first shift against ' + Lv.name + ' is on the books.') : 'Your best: ' + rec.prev.text + '.') + '</strong></p>' +
        (stars < 3 ? '<p class="soft">Stars at ' + E.STARS.join(', ') + ' correct calls. Tip: ' + Lv.name + ' ' + (S.level === 'pip' || S.level === 'gridlock' ? 'fakes the photo, the date, the stamp and the floor most.' : 'repeats whatever got past you, so check that detail first next time.') + '</p>' : ''),
      buttons: buttons,
      link: { label: 'Close and look at the desk' }
    });
  }

  function switchTo(id) {
    S.level = id;
    bar.setLevel(id);
    newShift();
  }

  function openHelp() {
    var rows = ORDER.map(function (id) {
      var Lv = A.LEVEL_MAP[id];
      return '<div><dt>' + Lv.name + ', ' + Lv.rank.toLowerCase() + '</dt><dd>' + TALK[id].blurb + '</dd></div>';
    }).join('');
    A.modal({
      title: 'How to play',
      wide: true,
      html: '<p>You guard the turnstile. Coworkers keep coming, and a robot forger slips fake badges into the queue. The shift never ends on its own: three mistakes and you are done.</p>' +
        '<p>A real badge gets all five right:</p>' +
        '<ol><li><b>Photo:</b> the person in front of you.</li><li><b>Name:</b> in the staff directory, spelled exactly the same.</li>' +
        '<li><b>Floor:</b> the floor of that department in the floor chart.</li><li><b>Valid until:</b> today\'s date or later, year included. Today is the date on your computer; a badge still counts on its last day.</li>' +
        '<li><b>Stamp:</b> this week\'s stamp, same color and shape.</li></ol>' +
        '<p>Let real coworkers in, stop the fakes. Turning away a real coworker, letting a fake in, or running out of time is a mistake. The timer gets shorter as the queue grows, and right calls in a row earn a bonus.</p>' +
        '<h3>Forgers</h3><dl>' + rows + '</dl>' +
        '<h3>Keys</h3><table class="keys"><tr><td><kbd>&larr;</kbd> or <kbd>S</kbd></td><td>Stop</td></tr><tr><td><kbd>&rarr;</kbd> or <kbd>L</kbd></td><td>Let in</td></tr>' +
        '<tr><td><kbd>Enter</kbd></td><td>Start the shift</td></tr><tr><td><kbd>P</kbd></td><td>Pause</td></tr><tr><td><kbd>N</kbd></td><td>New shift</td></tr>' +
        '<tr><td><kbd>M</kbd></td><td>Music on or off</td></tr><tr><td><kbd>B</kbd></td><td>Panic button</td></tr></table>',
      buttons: [{ label: 'Badges, please', kind: 'main' }]
    });
  }

  var bar = A.mountBar({
    el: $('#bar'),
    game: GAME,
    title: 'Badge Check',
    tagline: 'Let the real ones in. Stop the fakes.',
    level: S.level,
    levelLabel: 'Forger',
    canSwitch: function () { return S.running && !S.sh.over ? 'This shift will be abandoned.' : true; },
    onLevel: function (id) { S.level = id; newShift(); },
    onHelp: openHelp
  });
  sc.add(bar.destroy);

  $('#btn-start').addEventListener('click', start);
  $('#btn-stop').addEventListener('click', function () { call(false); });
  $('#btn-let').addEventListener('click', function () { call(true); });
  $('#btn-pause').addEventListener('click', function () {
    if (!S.running || S.sh.over) return;
    S.paused = !S.paused;
    // a paused visitor hides behind the desk, so pausing is not a free look
    $('#badge').style.visibility = S.paused ? 'hidden' : '';
    if (S.paused) cue('Paused', false, 1e9); else { cue('Back to work!', false, 700); S.walkUntil = performance.now() + 300; }
  });
  $('#btn-new').addEventListener('click', function () {
    if (!(S.running && !S.sh.over)) return newShift();
    A.confirm({ title: 'New shift?', text: 'This shift will be abandoned and a new staff list comes in.', yes: 'New shift', no: 'Keep checking', onYes: newShift });
  });

  sc.on(document, 'keydown', function (e) {
    if (e.ctrlKey || e.metaKey || e.altKey || A.modalOpen()) return;
    var k = e.key.toLowerCase();
    if (k === 'arrowleft' || k === 's') { e.preventDefault(); call(false); return; }
    if (k === 'arrowright' || k === 'l') { e.preventDefault(); call(true); return; }
    if (k === 'enter' && !(e.target && e.target.tagName === 'BUTTON')) { e.preventDefault(); start(); return; }
    if (k === 'p') { $('#btn-pause').click(); return; }
    if (k === 'n') { $('#btn-new').click(); return; }
    if (k === '?') openHelp();
  });

  newShift();
  sc.raf(frame);
  if (A.firstVisit(GAME)) openHelp();

  window.badgeCheck = { state: S, start: start, call: call, newShift: newShift };
  return sc.dispose;
}
