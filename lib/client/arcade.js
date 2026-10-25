/*
 * WNI shared library: brand, cast, progress, level picker, modal, sound, boss screen.
 * Loaded once per page in the browser (lib/client/boot.js) and installed as window.Arcade.
 */
(function (global) {
  'use strict';

  // ---------- brand ----------
  // WNI = "Why not, indeed?". The logo is drawn from strokes, not font text,
  // so it looks identical offline and online.

  var BRAND = {
    name: 'WNI',
    motto: 'Why not, indeed?',
    ink: '#1D1A33',
    colors: { w: '#FF6B57', n: '#3D86F0', i: '#2FBF71', q: '#FFC93C' }
  };
  var LOGO_PATHS = {
    w: 'M8 10 L18.5 50 L30 25 L41.5 50 L52 10',
    n: 'M66 50 V10 L90 50 V10',
    i: 'M104 10 V50'
  };

  /* o: { compact: no "?" badge (for small sizes), cls: extra class, label: false to hide from screen readers } */
  function logo(o) {
    o = o || {};
    var ink = BRAND.ink, C = BRAND.colors, keys = ['w', 'n', 'i'];
    var all = keys.map(function (k) { return LOGO_PATHS[k]; }).join(' ');
    var w = o.compact ? 118 : 144;
    var s = '<svg class="wni-logo' + (o.cls ? ' ' + o.cls : '') + '" viewBox="0 0 ' + w + ' 64" ' +
      (o.label === false ? 'aria-hidden="true"' : 'role="img" aria-label="WNI, Why not, indeed?"') + '>' +
      '<g fill="none" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="' + all + '" stroke="' + ink + '" stroke-width="17" transform="translate(4 4)"/>' +
      '<path d="' + all + '" stroke="' + ink + '" stroke-width="17"/>' +
      keys.map(function (k) { return '<path d="' + LOGO_PATHS[k] + '" stroke="' + C[k] + '" stroke-width="10"/>'; }).join('') +
      keys.map(function (k) { return '<path d="' + LOGO_PATHS[k] + '" stroke="#fff" stroke-opacity=".38" stroke-width="2.6" transform="translate(-1.8 -1.6)"/>'; }).join('') +
      '</g>';
    if (!o.compact) {
      s += '<g transform="translate(128 15) rotate(14)">' +
        '<circle cx="2.5" cy="2.5" r="11.5" fill="' + ink + '"/>' +
        '<circle r="11.5" fill="' + C.q + '" stroke="' + ink + '" stroke-width="2.6"/>' +
        '<path d="M-3.9 -3.4 a4 4 0 1 1 5.6 3.7 c-1.4 .6 -1.7 1.3 -1.7 2.7" fill="none" stroke="' + ink + '" stroke-width="2.8" stroke-linecap="round"/>' +
        '<circle cx="0" cy="6.6" r="1.8" fill="' + ink + '"/></g>';
    }
    return s + '</svg>';
  }

  // The ids stay 'gridlock' and 'monolith' (saved progress, scores and links use them); the names shown are Ted and Excel.
  var LEVELS = [
    { id: 'pip', name: 'Pip', rank: 'Rookie', color: '#E9B949', dark: '#B58A2E', mult: 1,
      about: 'Eager, sloppy and easy to read. Good for warming up.' },
    { id: 'gridlock', name: 'Ted', rank: 'Pro', color: '#7E97C9', dark: '#4F6696', mult: 2,
      about: 'Methodical and steady. Makes very few mistakes.' },
    { id: 'monolith', name: 'Excel', rank: 'Grandmaster', color: '#8E819E', dark: '#5D5170', mult: 3,
      about: 'Plans around every option you have. Expect a real fight.' },
    { id: 'edith', name: 'Edith', rank: 'Impossible', color: '#E8577E', dark: '#A3304F', mult: 5,
      about: 'Small, cheerful, and has never lost. Winning is possible on paper.' }
  ];
  var LEVEL_MAP = {};
  LEVELS.forEach(function (l) { LEVEL_MAP[l.id] = l; });

  // color/accent: card colors. scoring: how leaderboard points are earned (before the opponent multiplier).
  // endless: the game has no win; a run lasts until you slip, and its stars are score milestones.
  var GAMES = [
    { id: 'bury-the-bot', name: 'Bury the Bot', path: '/bury-the-bot', color: '#1C5A44', accent: '#E2B24C',
      blurb: 'You pick the falling blocks. Make the robot run out of room.',
      scoring: '400 for burying the bot, 20 per unused piece and 100 per star. A loss earns 10 per row of its tallest stack.' },
    { id: 'fool-the-model', name: 'Fool the Model', path: '/fool-the-model', color: '#1B2A47', accent: '#C7372F',
      blurb: 'Smudge a few pixels so the sorting robot reads the wrong number.',
      scoring: '150 per misrouted letter, 10 per pixel you save, and 300 plus 100 per star for clearing the sack.' },
    { id: 'excel-dungeon', name: 'Excel Dungeon', path: '/excel-dungeon', color: '#4B2E83', accent: '#6FD39A',
      blurb: 'A dungeon crawl through a spreadsheet. Bonk the errors, grab the coffee.',
      scoring: 'Every coin, 100 per hero level, 150 per sheet reached, and 600 plus 4 per health point for beating the boss.' },
    { id: 'sock-trap', name: 'Sock Trap', path: '/sock-trap', color: '#1F9C8E', accent: '#FFC93C',
      blurb: 'Socks, chairs and cables. Keep the robot vacuum from cleaning the office.',
      scoring: 'In each of the 5 offices: 20 per percent of floor left dirty, and 200 plus 30 per unused item if you win it. Winning the match (3 offices) adds 500 plus 100 per star.' },
    { id: 'spot-kick', name: 'Spot Kick', path: '/spot-kick', color: '#EF6C2B', accent: '#9BE15D',
      blurb: 'A penalty shootout against a keeper that learns your habits.',
      scoring: '120 per goal you score, 100 per save you make, and 500 for winning the shootout.' },
    { id: 'sneaky-hangman', name: 'Sneaky Hangman', path: '/sneaky-hangman', color: '#B83B7D', accent: '#FFD45C',
      blurb: 'The robot guesses letters. You quietly change your word.',
      scoring: '60 per wrong guess you force, 40 per letter still hidden, and 500 for a win.' },
    { id: 'herd-instinct', name: 'Herd Instinct', path: '/herd-instinct', color: '#4E9F3D', accent: '#FFE27A',
      blurb: 'Be the sheepdog. Get the flock into the pen before the clock runs out.',
      scoring: '100 per sheep in the pen, 5 per second left on the clock, and 500 for a win.' },
    { id: 'coffee-spill', name: 'Coffee Spill', path: '/coffee-spill', color: '#7A4A2C', accent: '#FFC93C',
      blurb: 'Draw walls to steer spilled coffee into mugs, away from the laptop.',
      scoring: '3 per drop in a mug, 500 for a win, 4 per unit of ink left, minus 5 per drop on the laptop.' },
    { id: 'copycat', name: 'Copycat', path: '/copycat', color: '#2D5BE3', accent: '#FF7AC8',
      blurb: 'A dance-off where the robot copies your moves a few beats late. Out-paint it.',
      scoring: '12 per tile you own, 40 each time the robot falls through a trapdoor, and for a win 500 plus 30 per tile of lead.' },
    { id: 'echo', name: 'Echo', path: '/echo', color: '#14173A', accent: '#4FE3D0',
      blurb: 'A pitch-black maze. Ping to hear the walls, but the walls keep moving.',
      scoring: '200 per keycard, and for escaping 500 plus 10 per step and 25 per ping you have left.' },
    { id: 'going-up', name: 'Going Up', path: '/going-up', color: '#0E4D5C', accent: '#E0B13B', endless: true,
      blurb: 'Run the office elevator through an endless day. Never let them take the stairs.',
      scoring: '10 per rider delivered, and 10 more for each quick trip (under 20 seconds from button to floor).' },
    { id: 'cable-spaghetti', name: 'Cable Spaghetti', path: '/cable-spaghetti', color: '#C93A2E', accent: '#FFD45C', endless: true,
      blurb: 'Gadgets keep landing on your desk. Plug them all in without crossing a cable.',
      scoring: '10 per device plugged in, and 5 more for each neat cable (the shortest one possible).' },
    { id: 'dont-click-that', name: 'Don\'t Click That', path: '/dont-click-that', color: '#2B2F7A', accent: '#4FE3B0', endless: true,
      blurb: 'A robot grabbed the mouse and wants the big red button. Drag windows into its way.',
      scoring: '10 per second you hold it off, and 100 per file still on the desktop at every backup (every 30 seconds).' },
    { id: 'badge-check', name: 'Badge Check', path: '/badge-check', color: '#1E4E8C', accent: '#FFD45C', endless: true,
      blurb: 'Guard the turnstile. Let real coworkers in and stop the forged badges.',
      scoring: '10 per correct call, 2 more per call in your current streak (up to 20), and 5 more for a quick call.' },
    { id: 'sudoku', name: 'Sudoku', path: '/sudoku', color: '#A65E00', accent: '#FFE066',
      blurb: 'The classic number puzzle, freshly made. A robot solves the same one beside you.',
      scoring: '8 per square you fill, and for finishing first 500, plus 3 per second ahead of the robot and 100 per unused mistake.' },
    { id: 'minesweeper', name: 'Minesweeper', path: '/minesweeper', color: '#46546B', accent: '#FF5A5F',
      blurb: 'The classic minefield, no guessing needed. A robot sweeps the same field beside you.',
      scoring: '2 per safe square you open, and for clearing first 500 plus 2 per second ahead of the robot.' }
  ];
  var GAME_MAP = {};
  GAMES.forEach(function (g) { GAME_MAP[g.id] = g; });

  // ---------- storage ----------

  var store = {
    get: function (k, d) {
      try { var v = global.localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; }
    },
    set: function (k, v) {
      try { global.localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ }
    }
  };

  // One-time move of saved progress from the old name of level 4 (Bibi) to Edith.
  (function migrate() {
    if (store.get('arcade-migrated-edith', false)) return;
    var all = store.get('arcade-progress', {});
    Object.keys(all).forEach(function (g) {
      if (all[g].bibi && !all[g].edith) all[g].edith = all[g].bibi;
      delete all[g].bibi;
    });
    store.set('arcade-progress', all);
    try {
      for (var i = 0; i < global.localStorage.length; i++) {
        var k = global.localStorage.key(i);
        if (/^arcade-level-/.test(k) && store.get(k, '') === 'bibi') store.set(k, 'edith');
      }
      var mem = store.get('sk-memory-bibi', null);
      if (mem) { store.set('sk-memory-edith', mem); global.localStorage.removeItem('sk-memory-bibi'); }
    } catch (e) { /* storage unavailable */ }
    store.set('arcade-migrated-edith', true);
  })();

  function progress(gameId) {
    return store.get('arcade-progress', {})[gameId] || {};
  }

  // r = { stars: 0-3, score: number, lowerIsBetter: bool, text: 'short summary' }
  function record(gameId, levelId, r) {
    var all = store.get('arcade-progress', {});
    var g = all[gameId] || (all[gameId] = {});
    var prev = g[levelId];
    var better = !prev || r.stars > prev.stars ||
      (r.stars === prev.stars && (r.lowerIsBetter ? r.score < prev.score : r.score > prev.score));
    if (better) {
      g[levelId] = { stars: r.stars, score: r.score, text: r.text || '' };
      store.set('arcade-progress', all);
    }
    return { better: better, prev: prev || null };
  }

  function lastLevel(gameId) {
    var id = store.get('arcade-level-' + gameId, 'pip');
    return LEVEL_MAP[id] ? id : 'pip';
  }
  function saveLevel(gameId, id) { store.set('arcade-level-' + gameId, id); }

  function firstVisit(gameId) {
    var seen = store.get('arcade-seen-' + gameId, false);
    if (!seen) store.set('arcade-seen-' + gameId, true);
    return !seen;
  }

  // ---------- the cast's faces ----------

  var FEATS = {
    smug: '<path d="M45 57 h14 a7 7 0 0 1 -14 0 z" stroke="none"/><path d="M81 57 h14 a7 7 0 0 1 -14 0 z" stroke="none"/><path d="M43 56 h18 M79 56 h18" fill="none"/><path d="M58 82 Q71 85 83 75" fill="none"/>',
    calm: '<circle cx="52" cy="58" r="6" stroke="none"/><circle cx="88" cy="58" r="6" stroke="none"/><path d="M58 79 Q70 87 82 79" fill="none"/>',
    happy: '<path d="M45 61 l7 -7 l7 7 M81 61 l7 -7 l7 7" fill="none"/><path d="M55 76 Q70 92 85 76" fill="none"/>',
    annoyed: '<path d="M44 60 h16 M80 60 h16" fill="none"/><path d="M44 47 l16 6 M96 47 l-16 6" fill="none"/><path d="M60 83 h20" fill="none"/>',
    surprised: '<circle cx="52" cy="58" r="7" fill="none"/><circle cx="88" cy="58" r="7" fill="none"/><circle cx="52" cy="58" r="2" stroke="none"/><circle cx="88" cy="58" r="2" stroke="none"/><circle cx="70" cy="84" r="5" fill="none"/>',
    worried: '<circle cx="52" cy="60" r="5" stroke="none"/><circle cx="88" cy="60" r="5" stroke="none"/><path d="M44 50 l14 -5 M96 50 l-14 -5" fill="none"/><path d="M55 84 q4 -4 7.5 0 t7.5 0 t7.5 0 t7.5 0" fill="none"/><path d="M106 36 q5 8 0 10 q-5 -2 0 -10 z" fill="#9FD3EE" stroke="none"/>',
    panic: '<circle cx="52" cy="57" r="9" fill="none"/><circle cx="88" cy="57" r="9" fill="none"/><circle cx="52" cy="57" r="2.5" stroke="none"/><circle cx="88" cy="57" r="2.5" stroke="none"/><ellipse cx="70" cy="85" rx="6" ry="7" fill="none"/><path d="M106 36 q5 8 0 10 q-5 -2 0 -10 z" fill="#9FD3EE" stroke="none"/><path d="M32 38 q5 8 0 10 q-5 -2 0 -10 z" fill="#9FD3EE" stroke="none"/>',
    dead: '<path d="M45 51 l14 14 M59 51 l-14 14 M81 51 l14 14 M95 51 l-14 14" fill="none"/><path d="M57 85 q6.5 -6 13 0 t13 0" fill="none"/>'
  };

  function face(levelId, mood, cls) {
    var L = LEVEL_MAP[levelId] || LEVELS[0];
    var feats = FEATS[mood] || FEATS.calm;
    var top = levelId === 'edith'
      ? '<path d="M70 10 L55 2 V18 Z M70 10 L85 2 V18 Z" fill="' + L.dark + '"/><circle cx="70" cy="10" r="4.5" fill="' + L.color + '"/>'
      : '<circle cx="70" cy="7" r="5.5" fill="' + L.color + '"/>';
    var cheeks = levelId === 'edith'
      ? '<ellipse cx="38" cy="85" rx="7" ry="4" fill="#FF8FB1" opacity=".5"/><ellipse cx="102" cy="85" rx="7" ry="4" fill="#FF8FB1" opacity=".5"/>'
      : '';
    var head = levelId === 'monolith'
      ? '<rect x="10" y="17" width="120" height="96" rx="10" fill="' + L.color + '"/><rect x="11.5" y="18.5" width="117" height="93" rx="9" fill="none" stroke="rgba(0,0,0,.22)" stroke-width="3"/>'
      : '<rect x="10" y="17" width="120" height="96" rx="24" fill="' + L.color + '"/><rect x="11.5" y="18.5" width="117" height="93" rx="22.5" fill="none" stroke="rgba(0,0,0,.22)" stroke-width="3"/>';
    return '<svg class="' + (cls || 'bot-face') + '" viewBox="0 0 140 120" aria-hidden="true" data-mood="' + mood + '">' +
      '<line x1="70" y1="17" x2="70" y2="8" stroke="' + L.dark + '" stroke-width="4" stroke-linecap="round"/>' + top +
      '<rect x="1" y="50" width="12" height="30" rx="4" fill="' + L.dark + '"/><rect x="127" y="50" width="12" height="30" rx="4" fill="' + L.dark + '"/>' +
      head + '<rect x="24" y="30" width="92" height="70" rx="15" fill="#0F2620"/>' + cheeks +
      '<g stroke="#F4EFE1" fill="#F4EFE1" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">' + feats + '</g></svg>';
  }

  function stars(n, total) {
    total = total || 3;
    var out = '';
    for (var i = 0; i < total; i++) {
      var on = i < n;
      out += '<svg viewBox="0 0 24 24" class="star' + (on ? ' star-on' : '') + '" aria-hidden="true"><path d="M12 2.6l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17l-5.7 3.1 1.2-6.4L2.8 9.3l6.4-.8z" fill="' +
        (on ? '#E2B24C' : 'none') + '" stroke="' + (on ? '#A97E26' : 'currentColor') + '" stroke-opacity="' + (on ? 1 : 0.35) + '" stroke-width="1.6" stroke-linejoin="round"/></svg>';
    }
    return '<span class="stars" role="img" aria-label="' + n + ' of ' + total + ' stars">' + out + '</span>';
  }

  // ---------- sound (off by default everywhere) ----------

  // One AudioContext for the whole page. Sound effects and music (shared/music.js) share it.
  var AC = null, NOISE = null;
  function audio() {
    try {
      AC = AC || new (global.AudioContext || global.webkitAudioContext)();
      if (AC.state === 'suspended' && !bossOn) AC.resume();
    } catch (e) { return null; }
    return AC;
  }
  function noiseBuffer() {
    if (NOISE || !audio()) return NOISE;
    NOISE = AC.createBuffer(1, AC.sampleRate, AC.sampleRate);
    var d = NOISE.getChannelData(0);
    for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return NOISE;
  }
  function soundOn() { return store.get('arcade-sound', false); }
  function setSound(on) { store.set('arcade-sound', !!on); }

  // ---------- WNI's own volume (on top of the device volume) ----------
  // Music and sound effects each go through their own gain node before the speakers. The level (0 to 1) is
  // kept per device; the gain is the level squared, because loudness feels logarithmic.
  var VOLUME = { music: 'arcade-volume-music', sound: 'arcade-volume-sound' }, BUSES = {};
  function volume(kind) {
    var v = Number(store.get(VOLUME[kind], 0.8));
    return isFinite(v) ? Math.max(0, Math.min(1, v)) : 0.8;
  }
  function audioBus(kind) {
    if (!audio()) return null;
    if (!BUSES[kind]) {
      BUSES[kind] = AC.createGain();
      BUSES[kind].gain.value = volume(kind) * volume(kind);
      BUSES[kind].connect(AC.destination);
    }
    return BUSES[kind];
  }
  function setVolume(kind, v) {
    v = Math.max(0, Math.min(1, Number(v) || 0));
    store.set(VOLUME[kind], Math.round(v * 100) / 100);
    if (BUSES[kind] && AC) BUSES[kind].gain.setTargetAtTime(v * v, AC.currentTime, 0.03);
    audioChanged();
  }
  function tone(freq, dur, type, vol, at, slideTo) {
    if (!soundOn() || bossOn || !audio()) return;
    var t = AC.currentTime + (at || 0);
    var o = AC.createOscillator(), g = AC.createGain();
    o.type = type || 'triangle';
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol || 0.05, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(audioBus('sound'));
    o.start(t); o.stop(t + dur + 0.02);
  }
  /* Filtered noise burst for whooshes, splashes and thumps. freq: band center in Hz. */
  function noise(dur, vol, at, freq, q) {
    if (!soundOn() || bossOn || !noiseBuffer()) return;
    var t = AC.currentTime + (at || 0);
    var src = AC.createBufferSource(), f = AC.createBiquadFilter(), g = AC.createGain();
    src.buffer = NOISE;
    f.type = 'bandpass';
    f.frequency.value = freq || 1200;
    f.Q.value = q || 0.9;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol || 0.05, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(audioBus('sound'));
    src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.02);
  }
  function jingle(kind) {
    if (kind === 'win') [392, 494, 587, 784].forEach(function (f, i) { tone(f, 0.16, 'triangle', 0.06, i * 0.09); });
    else if (kind === 'lose') [392, 330, 262].forEach(function (f, i) { tone(f, 0.2, 'triangle', 0.05, i * 0.12); });
    else if (kind === 'good') [523, 659, 784].forEach(function (f, i) { tone(f, 0.1, 'triangle', 0.05, i * 0.06); });
    else if (kind === 'bad') tone(160, 0.2, 'sawtooth', 0.05, 0, 90);
    else tone(600, 0.05, 'triangle', 0.035);
  }

  // ---------- top bar and level picker ----------

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  var ICONS = {
    music: '<path d="M9 17.5V5l10-2v12.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/><circle cx="6.5" cy="17.5" r="2.8" fill="currentColor"/><circle cx="16.5" cy="15.5" r="2.8" fill="currentColor"/>',
    sound: '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
    off: '<path d="M3 3l18 18" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>',
    volume: '<path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><circle cx="9" cy="7" r="2.6" fill="currentColor"/><circle cx="15" cy="12" r="2.6" fill="currentColor"/><circle cx="7" cy="17" r="2.6" fill="currentColor"/>',
    ranks: '<path d="M7 4h10v5a5 5 0 0 1-10 0z" fill="currentColor"/><path d="M7 6H4.5a3 3 0 0 0 3 4M17 6h2.5a3 3 0 0 1-3 4M12 14v3M8 20h8" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
    help: '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M9.6 9.6a2.5 2.5 0 1 1 3.4 2.3c-.7.3-1 .8-1 1.6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><circle cx="12" cy="16.8" r="1.3" fill="currentColor"/>',
    hide: '<rect x="3" y="4" width="18" height="16" rx="2" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M3 9h18M9 9v11M15 9v11" stroke="currentColor" stroke-width="2"/>'
  };
  function icon(name, crossed) {
    return '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">' + ICONS[name] + (crossed ? ICONS.off : '') + '</svg>';
  }

  /*
   * Turns a button into the Volume control: it opens a small panel with a Music and a Sound effects slider that
   * change WNI's own volume only (the device volume stays as it is). Returns a function that removes it all.
   */
  function volumeControl(btn) {
    var panel = null, offs = [];
    btn.setAttribute('aria-haspopup', 'dialog');
    btn.setAttribute('aria-expanded', 'false');
    function row(kind, label) {
      return '<label class="vol-row"><span class="vol-name">' + label + '<small data-off="' + kind + '"></small></span>' +
        '<input type="range" min="0" max="100" step="5" data-kind="' + kind + '" aria-label="' + label + ' volume">' +
        '<b class="vol-val" data-val="' + kind + '"></b></label>';
    }
    function sync() {
      if (!panel) return;
      ['music', 'sound'].forEach(function (k) {
        var pct = Math.round(volume(k) * 100), on = k === 'music' ? !!(global.Arcade.music && global.Arcade.music.on()) : soundOn();
        var input = panel.querySelector('[data-kind="' + k + '"]');
        if (document.activeElement !== input) input.value = pct;
        panel.querySelector('[data-val="' + k + '"]').textContent = pct + '%';
        panel.querySelector('[data-off="' + k + '"]').textContent = on ? '' : ' (off)';
      });
    }
    function place() {
      if (!panel) return;
      var r = btn.getBoundingClientRect(), w = panel.offsetWidth;
      panel.style.top = Math.round(r.bottom + 8) + 'px';
      panel.style.left = Math.round(Math.max(8, Math.min(global.innerWidth - w - 8, r.right - w))) + 'px';
    }
    function close(focusBack) {
      if (!panel) return;
      offs.forEach(function (f) { f(); });
      offs = [];
      panel.remove();
      panel = null;
      btn.setAttribute('aria-expanded', 'false');
      if (focusBack) btn.focus();
    }
    function on(target, type, fn, opt) { target.addEventListener(type, fn, opt); offs.push(function () { target.removeEventListener(type, fn, opt); }); }
    function open() {
      panel = document.createElement('div');
      panel.className = 'arcade-volume';
      panel.setAttribute('role', 'dialog');
      panel.setAttribute('aria-label', 'Volume');
      panel.innerHTML = '<p class="vol-title">Volume</p>' + row('music', 'Music') + row('sound', 'Sound effects') +
        '<p class="vol-note">Only WNI gets louder or quieter. Your device volume stays as it is.</p>';
      document.body.appendChild(panel);
      btn.setAttribute('aria-expanded', 'true');
      sync();
      place();
      var tickT = 0;
      on(panel, 'input', function (e) {
        var k = e.target.dataset.kind;
        if (!k) return;
        setVolume(k, e.target.value / 100);
        // a little tick so you can hear the new level
        if (k === 'sound' && Date.now() - tickT > 120) { tickT = Date.now(); tone(880, 0.06, 'triangle', 0.05); }
      });
      // keys used on the sliders must not also move things in the game behind
      on(panel, 'keydown', function (e) {
        if (e.key === 'Escape') { e.preventDefault(); close(true); }
        e.stopPropagation();
      });
      on(document, 'pointerdown', function (e) { if (!panel.contains(e.target) && !btn.contains(e.target)) close(false); }, true);
      on(global, 'resize', place);
      on(global, 'scroll', place, true);
      offs.push(onAudioChange(sync));
      offs.push(onBoss(function (hidden) { if (hidden) close(false); }));
      panel.querySelector('input').focus();
    }
    function toggle() { if (panel) close(true); else open(); }
    btn.addEventListener('click', toggle);
    return function () { close(false); btn.removeEventListener('click', toggle); };
  }

  /*
   * opts: { el, game, title, tagline, level, onLevel(id), canSwitch(id), onHelp(), levelLabel }
   * canSwitch(id) returns true to switch, false to refuse, or a question string to ask first in a WNI confirm.
   */
  function mountBar(opts) {
    var el = opts.el;
    var hasMusic = !!global.Arcade.music;
    el.classList.add('arcade-bar');
    el.innerHTML =
      '<a class="arcade-back" href="/" title="Back to the WNI lobby"><svg class="chev" viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3L5 8l5 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
      logo({ compact: true, label: false }) + '<span>Lobby</span></a>' +
      '<div class="arcade-title"><h1>' + esc(opts.title) + '</h1>' + (opts.tagline ? '<p>' + esc(opts.tagline) + '</p>' : '') + '</div>' +
      '<div class="lvl-picker" role="radiogroup" aria-label="' + esc(opts.levelLabel || 'Level') + '"></div>' +
      '<div class="arcade-tools">' +
      (hasMusic ? '<button type="button" class="arcade-tool" data-tool="music" title="Background music on or off (M)"></button>' : '') +
      '<button type="button" class="arcade-tool" data-tool="sound" title="Sound effects on or off"></button>' +
      '<button type="button" class="arcade-tool" data-tool="volume" title="Volume for WNI only">' + icon('volume') + '<span>Volume</span></button>' +
      '<a class="arcade-tool" data-tool="ranks" href="/leaderboard?game=' + encodeURIComponent(opts.game) + '" title="Leaderboard for this game">' + icon('ranks') + '<span>Ranks</span></a>' +
      '<button type="button" class="arcade-tool" data-tool="help" title="How to play (?)">' + icon('help') + '<span>How to play</span></button>' +
      '<button type="button" class="arcade-tool" data-tool="hide" title="Hide the game behind a spreadsheet">' + icon('hide') + '<span>Hide (B)</span></button>' +
      '<span class="arcade-account" data-tool="account"></span>' +
      '</div>';
    var picker = el.querySelector('.lvl-picker');
    var current = opts.level;
    var done = progress(opts.game);

    function apply(id) {
      current = id;
      saveLevel(opts.game, id);
      render();
      opts.onLevel(id);
    }
    function render() {
      picker.innerHTML = '';
      LEVELS.forEach(function (L) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'lvl';
        b.dataset.level = L.id;
        b.setAttribute('role', 'radio');
        b.setAttribute('aria-checked', String(L.id === current));
        var won = done[L.id] && done[L.id].stars > 0;
        b.innerHTML = '<span class="lvl-dot" style="background:' + L.color + '"></span><span class="lvl-text"><span class="lvl-name">' + L.name +
          '</span><span class="lvl-rank">' + L.rank + (won ? ', cleared' : '') + '</span></span>';
        b.addEventListener('click', function () {
          if (L.id === current) return;
          var ok = opts.canSwitch ? opts.canSwitch(L.id) : true;
          if (ok === false) return;
          if (typeof ok === 'string') {
            confirm({ title: 'Switch to ' + L.name + '?', text: ok, yes: 'Switch to ' + L.name, no: 'Keep playing', onYes: function () { apply(L.id); } });
            return;
          }
          apply(L.id);
        });
        picker.appendChild(b);
      });
    }
    render();

    var soundBtn = el.querySelector('[data-tool="sound"]');
    var musicBtn = el.querySelector('[data-tool="music"]');
    function renderAudio() {
      soundBtn.innerHTML = icon('sound', !soundOn()) + '<span>Sound ' + (soundOn() ? 'on' : 'off') + '</span>';
      soundBtn.setAttribute('aria-pressed', String(soundOn()));
      soundBtn.setAttribute('aria-label', 'Sound effects ' + (soundOn() ? 'on' : 'off'));
      if (musicBtn) {
        var m = global.Arcade.music.on();
        musicBtn.innerHTML = icon('music', !m) + '<span>Music ' + (m ? 'on' : 'off') + '</span>';
        musicBtn.setAttribute('aria-pressed', String(m));
        musicBtn.setAttribute('aria-label', 'Background music ' + (m ? 'on' : 'off'));
      }
    }
    renderAudio();
    var offAudio = onAudioChange(renderAudio), offChip = null, offVolume = volumeControl(el.querySelector('[data-tool="volume"]'));
    soundBtn.addEventListener('click', function () { setSound(!soundOn()); renderAudio(); jingle('tick'); });
    if (musicBtn) musicBtn.addEventListener('click', function () { global.Arcade.music.toggle(); });
    el.querySelector('[data-tool="help"]').addEventListener('click', function () { if (opts.onHelp) opts.onHelp(); });
    el.querySelector('[data-tool="hide"]').addEventListener('click', toggleBoss);
    if (global.Arcade.account) offChip = global.Arcade.account.chip(el.querySelector('[data-tool="account"]'));
    else el.querySelector('[data-tool="account"]').remove();
    if (hasMusic) global.Arcade.music.play(opts.game);

    return {
      setLevel: function (id) { current = id; saveLevel(opts.game, id); render(); },
      refresh: function () { done = progress(opts.game); render(); },
      destroy: function () { offAudio(); offVolume(); if (offChip) offChip(); }
    };
  }
  var audioListeners = [];
  function audioChanged() { audioListeners.slice().forEach(function (f) { f(); }); }
  // Registers a listener and returns a function that removes it again.
  function listen(list, f) {
    list.push(f);
    return function () { var i = list.indexOf(f); if (i >= 0) list.splice(i, 1); };
  }
  function onAudioChange(f) { return listen(audioListeners, f); }

  /*
   * A scope collects everything a page or game sets up (global listeners, frames, timers,
   * subscriptions) so it can all be undone when React unmounts it.
   */
  function scope() {
    var alive = true, offs = [], lastFrame = 0, timers = new Set();
    offs.push(function () { cancelAnimationFrame(lastFrame); timers.forEach(clearTimeout); timers.clear(); });
    return {
      alive: function () { return alive; },
      on: function (target, type, fn, opt) {
        target.addEventListener(type, fn, opt);
        offs.push(function () { target.removeEventListener(type, fn, opt); });
      },
      raf: function (fn) { if (!alive) return 0; lastFrame = requestAnimationFrame(function (t) { if (alive) fn(t); }); return lastFrame; },
      timeout: function (fn, ms) {
        if (!alive) return 0;
        var id = setTimeout(function () { timers.delete(id); if (alive) fn(); }, ms);
        timers.add(id);
        return id;
      },
      add: function (off) { if (typeof off === 'function') offs.push(off); return off; },
      dispose: function () {
        if (!alive) return;
        alive = false;
        offs.splice(0).reverse().forEach(function (f) { try { f(); } catch (e) { /* already gone */ } });
        closeModal(true);
      }
    };
  }

  // ---------- modal ----------

  var modalEl = null, modalOnClose = null;
  function modal(o) {
    if (!modalEl) {
      modalEl = document.createElement('div');
      modalEl.className = 'arcade-modal';
      modalEl.hidden = true;
      modalEl.innerHTML = '<div class="arcade-sheet" role="dialog" aria-modal="true" tabindex="-1"></div>';
      modalEl.addEventListener('click', function (e) { if (e.target === modalEl && modalEl.dataset.dismiss === '1') closeModal(); });
      document.body.appendChild(modalEl);
    }
    var sheet = modalEl.firstChild;
    sheet.className = 'arcade-sheet' + (o.wide ? ' wide' : '') + (o.tone ? ' tone-' + o.tone : '');
    sheet.innerHTML = (o.title ? '<h2>' + esc(o.title) + '</h2>' : '') + (o.html || '') + '<div class="arcade-sheet-btns"></div>' +
      (o.link ? '<div class="arcade-sheet-link"><button type="button" class="arcade-link"></button></div>' : '');
    var btns = sheet.querySelector('.arcade-sheet-btns');
    var first = null;
    (o.buttons || []).forEach(function (b) {
      var x = document.createElement('button');
      x.type = 'button';
      x.className = 'arcade-btn ' + (b.kind === 'main' ? 'main' : 'line');
      x.textContent = b.label;
      x.addEventListener('click', function () { closeModal(true); if (b.onClick) b.onClick(); });
      btns.appendChild(x);
      if (!first) first = x;
    });
    if (o.link) {
      var l = sheet.querySelector('.arcade-link');
      l.textContent = o.link.label;
      l.addEventListener('click', function () { closeModal(true); if (o.link.onClick) o.link.onClick(); });
    }
    modalEl.dataset.dismiss = o.dismissable === false ? '0' : '1';
    modalOnClose = o.onClose || null;
    modalEl.hidden = false;
    if (first) first.focus({ preventScroll: true }); else sheet.focus({ preventScroll: true });
    sheet.scrollTop = 0;
  }
  function closeModal(silent) {
    if (!modalEl || modalEl.hidden) return;
    modalEl.hidden = true;
    var cb = modalOnClose;
    modalOnClose = null;
    if (cb && !silent) cb();
  }
  function modalOpen() { return !!modalEl && !modalEl.hidden; }

  /*
   * WNI's own confirm dialog (never window.confirm).
   * o: { title, text, html, yes, no, onYes, onNo, danger }
   */
  function confirm(o) {
    modal({
      title: o.title || 'Are you sure?',
      tone: o.danger ? 'lose' : '',
      html: '<div class="arcade-ask">' + face(o.face || 'edith', o.mood || 'surprised', 'arcade-ask-face') +
        '<p>' + (o.html || esc(o.text || '')) + '</p></div>',
      buttons: [
        { label: o.yes || 'Yes', kind: 'main', onClick: o.onYes },
        { label: o.no || 'Cancel', kind: 'line', onClick: o.onNo }
      ],
      onClose: o.onNo
    });
  }

  // ---------- toasts: WNI-styled messages instead of native alerts or console output ----------

  var toastWrap = null;
  /* o: { kind: 'info' | 'good' | 'bad', ms, action: { label, href | onClick } } */
  function toast(text, o) {
    o = o || {};
    if (!document.body) return;
    if (!toastWrap) {
      toastWrap = document.createElement('div');
      toastWrap.className = 'arcade-toasts';
      toastWrap.setAttribute('role', 'status');
      toastWrap.setAttribute('aria-live', 'polite');
      document.body.appendChild(toastWrap);
    }
    var t = document.createElement('div');
    t.className = 'arcade-toast kind-' + (o.kind || 'info');
    var mark = o.kind === 'good' ? '<path d="M6 12.5l4 4 8-9" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>'
      : o.kind === 'bad' ? '<path d="M12 6v7" stroke="#fff" stroke-width="3" stroke-linecap="round"/><circle cx="12" cy="17.5" r="1.8" fill="#fff"/>'
      : '<circle cx="12" cy="7" r="1.8" fill="#1D1A33"/><path d="M12 11v7" stroke="#1D1A33" stroke-width="3" stroke-linecap="round"/>';
    t.innerHTML = '<svg class="arcade-toast-mark" viewBox="0 0 24 24" aria-hidden="true">' + mark + '</svg><span class="arcade-toast-text"></span>';
    t.querySelector('.arcade-toast-text').textContent = text;
    if (o.action) {
      var a = document.createElement(o.action.href ? 'a' : 'button');
      a.className = 'arcade-toast-act';
      a.textContent = o.action.label;
      if (o.action.href) a.href = o.action.href; else a.type = 'button';
      a.addEventListener('click', function () { dismiss(); if (o.action.onClick) o.action.onClick(); });
      t.appendChild(a);
    }
    var x = document.createElement('button');
    x.type = 'button';
    x.className = 'arcade-toast-x';
    x.setAttribute('aria-label', 'Dismiss');
    x.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>';
    x.addEventListener('click', dismiss);
    t.appendChild(x);
    toastWrap.appendChild(t);
    while (toastWrap.children.length > 3) toastWrap.firstChild.remove();
    var timer = setTimeout(dismiss, o.ms || (o.action ? 7000 : 4200));
    function dismiss() {
      clearTimeout(timer);
      if (!t.parentNode) return;
      t.classList.add('out');
      setTimeout(function () { t.remove(); }, 220);
    }
    return dismiss;
  }

  // Unexpected script errors get a friendly WNI note instead of living only in the browser console.
  var errorShown = false;
  global.addEventListener('error', function (e) {
    if (errorShown || !e || !e.message) return;
    errorShown = true;
    toast('Something glitched on our side. If the game looks stuck, reload the page.', { kind: 'bad', ms: 8000 });
  });

  // ---------- boss screen ----------

  var bossEl = null, bossOn = false, realTitle = '';
  function buildBoss() {
    bossEl = document.createElement('div');
    bossEl.className = 'arcade-boss';
    bossEl.hidden = true;
    var depts = ['Engineering', 'Operations', 'Facilities', 'IT infrastructure', 'Training', 'Travel', 'Software licenses', 'Field services', 'Spare parts', 'Contractors', 'Utilities', 'Consulting'];
    var seed = 2027;
    function r() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }
    var html = '<table><tr><th></th>' + 'ABCDEFGHIJ'.split('').map(function (c) { return '<th>' + c + '</th>'; }).join('') + '</tr>';
    var row = 1;
    function line(cells, cls) {
      html += '<tr' + (cls ? ' class="' + cls + '"' : '') + '><th>' + (row++) + '</th>';
      for (var i = 0; i < 10; i++) {
        var v = cells[i] == null ? '' : cells[i];
        var num = typeof v === 'number';
        var sel = row - 1 === 7 && i === 6;
        html += '<td class="' + (num ? 'num' : '') + (sel ? ' sel' : '') + '">' + (num ? v.toLocaleString('en-US') : v) + '</td>';
      }
      html += '</tr>';
    }
    line(['FY27 operating budget, draft 3']);
    line(['Prepared for quarterly review']);
    line([]);
    line(['Cost center', 'Owner', 'Q1', 'Q2', 'Q3', 'Q4', 'Total', 'FY26 actual', 'Variance', 'Notes'], 'head');
    var tq = [0, 0, 0, 0], tt = 0, tp = 0;
    depts.forEach(function (d, i) {
      var q = [0, 1, 2, 3].map(function () { return Math.round((40 + r() * 260) * 20) * 50; });
      var tot = q[0] + q[1] + q[2] + q[3];
      var prev = Math.round(tot * (0.85 + r() * 0.25) / 100) * 100;
      q.forEach(function (v, k) { tq[k] += v; });
      tt += tot; tp += prev;
      line([d, ['AR', 'MK', 'DS', 'JT', 'PL'][i % 5], q[0], q[1], q[2], q[3], tot, prev, (((tot - prev) / prev) * 100).toFixed(1) + '%', i === 3 ? 'Check with finance' : '']);
    });
    line(['Total', '', tq[0], tq[1], tq[2], tq[3], tt, tp, (((tt - tp) / tp) * 100).toFixed(1) + '%', ''], 'total');
    for (var k = 0; k < 20; k++) line([]);
    html += '</table>';
    bossEl.innerHTML =
      '<div class="boss-title">FY27_budget_draft_v3.xlsx</div>' +
      '<div class="boss-menu"><span>File</span><span>Edit</span><span>View</span><span>Insert</span><span>Format</span><span>Data</span><span>Tools</span><span>Help</span></div>' +
      '<div class="boss-formula"><span class="boss-ref">G7</span><span class="boss-fx">fx</span><span>=SUM(C7:F7)</span></div>' +
      '<div class="boss-grid">' + html + '</div>' +
      '<div class="boss-status">Ready</div>';
    bossEl.querySelector('.boss-status').addEventListener('dblclick', toggleBoss);
    document.body.appendChild(bossEl);
  }
  var bossListeners = [];
  function toggleBoss() {
    if (!bossEl) buildBoss();
    bossOn = !bossOn;
    if (bossOn) {
      realTitle = document.title;
      bossEl.hidden = false;
      document.title = 'FY27_budget_draft_v3.xlsx';
    } else {
      bossEl.hidden = true;
      document.title = realTitle;
    }
    // silence everything at once, music included
    if (AC) { try { if (bossOn) AC.suspend(); else AC.resume(); } catch (e) { /* audio unavailable */ } }
    bossListeners.forEach(function (f) { f(bossOn); });
  }
  function onBoss(f) { return listen(bossListeners, f); }
  function isBoss() { return bossOn; }

  // B toggles the boss screen everywhere; while it is up, no other keys reach the game.
  global.addEventListener('keydown', function (e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    var tag = (e.target && e.target.tagName) || '';
    if ((tag === 'INPUT' && e.target.type !== 'range') || tag === 'TEXTAREA' || tag === 'SELECT') return;
    var k = e.key.toLowerCase();
    if (k === 'b') {
      e.preventDefault();
      e.stopImmediatePropagation();
      toggleBoss();
      return;
    }
    if (k === 'm' && !bossOn && !modalOpen() && global.Arcade.music) {
      e.stopImmediatePropagation();
      global.Arcade.music.toggle();
      return;
    }
    if (bossOn) {
      if (k === 'escape') toggleBoss();
      e.stopImmediatePropagation();
      return;
    }
    if (modalOpen()) {
      if (k === 'escape') { e.preventDefault(); closeModal(); }
      if (k !== 'tab' && k !== 'enter' && k !== ' ') e.stopImmediatePropagation();
    }
  }, true);

  // Opens another WNI page in-app (the page and its music keep running); see components/AppLinks.jsx.
  function go(url) {
    if (typeof global.wniNavigate === 'function') global.wniNavigate(url);
    else global.location.href = url;
  }

  global.Arcade = {
    BRAND: BRAND,
    logo: logo,
    LEVELS: LEVELS,
    LEVEL_MAP: LEVEL_MAP,
    GAMES: GAMES,
    GAME_MAP: GAME_MAP,
    store: store,
    progress: progress,
    record: record,
    lastLevel: lastLevel,
    saveLevel: saveLevel,
    firstVisit: firstVisit,
    face: face,
    stars: stars,
    audio: audio,
    noiseBuffer: noiseBuffer,
    tone: tone,
    noise: noise,
    jingle: jingle,
    soundOn: soundOn,
    setSound: function (on) { setSound(on); audioChanged(); },
    volume: volume,
    setVolume: setVolume,
    audioBus: audioBus,
    volumeControl: volumeControl,
    audioChanged: audioChanged,
    onAudioChange: onAudioChange,
    scope: scope,
    icon: icon,
    mountBar: mountBar,
    modal: modal,
    closeModal: closeModal,
    modalOpen: modalOpen,
    confirm: confirm,
    toast: toast,
    toggleBoss: toggleBoss,
    onBoss: onBoss,
    isBoss: isBoss,
    go: go,
    esc: esc
  };
})(window);
