/*
 * WNI soundtracks: window.Arcade.music.
 * Every game has its own looping tune, played by a tiny WebAudio sequencer (no audio files, works offline).
 * Music is off by default, like sound. The Music button (or M) toggles it, the panic button silences it,
 * and it pauses while the tab is hidden.
 * Links between pages keep this page alive (components/AppLinks.jsx), so the music never restarts: pages
 * that share a tune keep it going, a new tune fades in over the old one, and every tune carries on from
 * the bar it was on.
 */
(function (global) {
  'use strict';
  var A = global.Arcade;
  var KEY = 'arcade-music';

  // ---------- note and chord helpers ----------

  var PC = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
  var QUAL = {
    '': [0, 4, 7], m: [0, 3, 7], '7': [0, 4, 7, 10], m7: [0, 3, 7, 10], maj7: [0, 4, 7, 11], '6': [0, 4, 7, 9],
    m6: [0, 3, 7, 9], sus4: [0, 5, 7], sus2: [0, 2, 7], dim: [0, 3, 6], add9: [0, 4, 7, 14], m9: [0, 3, 7, 10, 14], '9': [0, 4, 7, 10, 14]
  };
  function midiOf(name) {
    var m = /^([A-G][#b]?)(-?\d)$/.exec(name);
    return m ? PC[m[1]] + (Number(m[2]) + 1) * 12 : null;
  }
  function chordOf(name) {
    var m = /^([A-G][#b]?)(.*)$/.exec(name);
    return { root: PC[m[1]], iv: QUAL[m[2]] || QUAL[''] };
  }
  function hz(midi) { return 440 * Math.pow(2, (midi - 69) / 12); }
  function toks(s) { return s.trim().split(/\s+/); }

  // ---------- instruments ----------

  var V = {
    pluck: { wave: 'sawtooth', cut: 1700, fenv: 3, a: 0.004, d: 0.16, s: 0, r: 0.08, vol: 0.05 },
    bell: { wave: 'sine', harm: [[2.76, 0.28], [5.4, 0.08]], a: 0.002, d: 0.55, s: 0, r: 0.3, vol: 0.07 },
    keys: { wave: 'sine', harm: [[2, 0.22], [3, 0.06]], a: 0.006, d: 0.7, s: 0.28, r: 0.25, vol: 0.05 },
    pad: { wave: 'sawtooth', detune: 9, cut: 1100, a: 0.25, d: 0.4, s: 0.8, r: 0.6, vol: 0.022 },
    chip: { wave: 'square', a: 0.002, d: 0.06, s: 0.65, r: 0.03, vol: 0.035 },
    chipSoft: { wave: 'square', cut: 2400, a: 0.002, d: 0.05, s: 0.4, r: 0.02, vol: 0.016 },
    brass: { wave: 'sawtooth', cut: 1500, fenv: 2, a: 0.03, d: 0.18, s: 0.75, r: 0.1, vol: 0.04 },
    flute: { wave: 'sine', harm: [[2, 0.08]], vib: 9, a: 0.045, d: 0.2, s: 0.85, r: 0.09, vol: 0.07 },
    whistle: { wave: 'sine', harm: [[2, 0.05]], vib: 14, a: 0.03, d: 0.1, s: 0.9, r: 0.06, vol: 0.06 },
    clarinet: { wave: 'square', cut: 1400, vib: 6, a: 0.03, d: 0.1, s: 0.8, r: 0.07, vol: 0.035 },
    muted: { wave: 'triangle', cut: 1500, a: 0.01, d: 0.3, s: 0.35, r: 0.15, vol: 0.06 },
    marimba: { wave: 'sine', harm: [[4, 0.18]], a: 0.002, d: 0.28, s: 0, r: 0.1, vol: 0.06 },
    pizz: { wave: 'triangle', cut: 2200, a: 0.002, d: 0.13, s: 0, r: 0.05, vol: 0.07 },
    clav: { wave: 'square', cut: 2600, fenv: 1.6, a: 0.002, d: 0.09, s: 0.15, r: 0.03, vol: 0.022 },
    strum: { wave: 'triangle', cut: 2400, a: 0.003, d: 0.22, s: 0.1, r: 0.1, vol: 0.028 },
    bassSine: { wave: 'sine', harm: [[2, 0.3]], a: 0.005, d: 0.2, s: 0.7, r: 0.06, vol: 0.13 },
    bassSaw: { wave: 'sawtooth', cut: 520, fenv: 2.4, a: 0.004, d: 0.15, s: 0.55, r: 0.06, vol: 0.07 },
    bassTri: { wave: 'triangle', a: 0.004, d: 0.1, s: 0.8, r: 0.04, vol: 0.12 },
    bassPluck: { wave: 'triangle', cut: 900, a: 0.003, d: 0.2, s: 0.2, r: 0.06, vol: 0.14 },
    slap: { wave: 'square', cut: 700, fenv: 3, a: 0.003, d: 0.12, s: 0.35, r: 0.05, vol: 0.06 }
  };

  // ---------- the tunes ----------
  // Every melody, chord pattern and drum pattern below was written for WNI. Nothing is sampled or copied.
  // Each bar of a melody is a string of steps: a note name, '.' for rest, '-' to hold the note before.
  // Bass and comp patterns repeat every bar. Bass symbols: R root, T third, F fifth, S seventh, O octave,
  // W a walking step into the next chord, or a number of semitones above the root.
  // Drums: X accent, x hit, o ghost. form: capital letter = section with melody, lowercase = groove only.

  var THEMES = {
    lobby: {
      bpm: 112, spb: 2, form: 'aABAB',
      A: { chords: ['C', 'Am', 'F', 'G'], lead: ['E5 . G5 . C6 - B5 A5', 'G5 - E5 . A5 . G5 E5', 'F5 . A5 . C6 - A5 F5', 'G5 - - . D5 E5 F5 D5'] },
      B: { chords: ['F', 'G', 'Em', 'Am'], lead: ['A5 . A5 G5 F5 . C5 .', 'B4 . D5 . G5 - F5 E5', 'E5 . G5 . B5 - A5 G5', 'A5 - - - . . . .'] },
      bass: { v: 'bassPluck', oct: 36, p: 'R . R F R . F .' },
      comp: { v: 'strum', oct: 60, p: '. x . x . x . x' },
      lead: { v: 'bell' },
      drums: { k: 'x . . . x . . .', c: '. . x . . . x .', r: 'x o x o x o x o' }
    },
    'bury-the-bot': {
      bpm: 96, spb: 2, swing: 0.3, form: 'aABAB',
      A: { chords: ['Dm7', 'G7', 'Cmaj7', 'A7'], lead: ['A4 . C5 D5 F5 . E5 .', 'D5 . B4 . G4 - - .', 'E5 . G5 . B5 - A5 G5', 'C#5 - E5 . G5 - F5 E5'] },
      B: { chords: ['Fmaj7', 'Bb7', 'Em7', 'A7'], lead: ['A5 . . G5 F5 . E5 .', 'D5 . F5 . Ab5 - G5 F5', 'E5 . . D5 B4 . G4 .', 'A4 . C#5 . E5 . G5 .'] },
      bass: { v: 'bassTri', oct: 36, p: 'R . T . F . W .' },
      comp: { v: 'keys', oct: 57, p: 'x . . x . . . .' },
      lead: { v: 'bell' },
      drums: { k: 'x . . . . . . .', r: 'x . x x x . x x', b: '. . x . . . x .' }
    },
    'fool-the-model': {
      bpm: 104, spb: 2, form: 'aABAB',
      A: { chords: ['Am', 'E7', 'Am', 'E7'], lead: ['A4 . C5 . E5 . C5 .', 'B4 . G#4 . E4 . . .', 'A4 . C5 . E5 . A5 .', 'G#5 - E5 . B4 - - .'] },
      B: { chords: ['F', 'G', 'E7', 'Am'], lead: ['A5 . G5 F5 E5 . C5 .', 'D5 . B4 . G4 - - .', 'G#4 . B4 . D5 . E5 .', 'A4 - - - . . . .'] },
      bass: { v: 'bassPluck', oct: 36, p: 'R . F . R . F .' },
      comp: { v: 'pizz', oct: 60, p: '. x . x . x . x' },
      lead: { v: 'clarinet' },
      drums: { b: 'x . x . x . x .', k: 'x . . . x . . .', r: 'o o o o o o o o' }
    },
    'excel-dungeon': {
      bpm: 132, spb: 4, form: 'aABAB',
      A: { chords: ['Cm', 'Ab', 'Bb', 'G'], lead: [
        'C5 . . G4 . . C5 . D5 . Eb5 . D5 . C5 .', 'Eb5 . . C5 . . Ab4 . C5 . Eb5 . F5 . Eb5 .',
        'D5 . . Bb4 . . F4 . Bb4 . D5 . F5 . D5 .', 'B4 . . D5 . . G5 . - . F5 . D5 . B4 .'] },
      B: { chords: ['Fm', 'Ab', 'Bb', 'G'], lead: [
        'F5 . Ab5 . C6 . Ab5 . F5 . C5 . F5 . Ab5 .', 'G5 . Eb5 . C5 . Eb5 . Ab5 . G5 . F5 . Eb5 .',
        'F5 . D5 . Bb4 . D5 . F5 . Bb5 . A5 . F5 .', 'G5 - - - B4 - - - D5 - - - G5 - - -'] },
      bass: { v: 'bassTri', oct: 36, p: 'R . R . O . R . R . R . O . F .' },
      arp: { v: 'chipSoft', oct: 60, p: '0 1 2 3 2 1 0 1 2 3 2 1 0 1 2 1' },
      lead: { v: 'chip' },
      drums: { k: 'x . . . x . . . x . . . x . . .', s: '. . . . x . . . . . . . x . . x', h: '. . x . . . x . . . x . . . x .' }
    },
    'sock-trap': {
      bpm: 96, spb: 4, form: 'aABAB',
      A: { chords: ['Gmaj7', 'Em7', 'Am7', 'D7'], lead: [
        'B5 . . . A5 . G5 . . . D5 . . . E5 .', 'G5 . . . . . E5 . D5 . B4 . . . . .',
        'C5 . . . E5 . G5 . . . B5 . A5 . G5 .', 'F#5 . . . . . A5 . . . D5 . . . . .'] },
      B: { chords: ['Cmaj7', 'Bm7', 'Am7', 'D7'], lead: [
        'E5 . . . G5 . B5 . . . A5 . G5 . E5 .', 'D5 . . . F#5 . A5 . . . . . F#5 . . .',
        'E5 . . . C5 . A4 . . . C5 . E5 . G5 .', 'F#5 . . . . . . . D5 . . . . . . .'] },
      bass: { v: 'bassSine', oct: 36, p: 'R . . . . . F . R . . . . . F .' },
      comp: { v: 'strum', oct: 57, p: 'x . . x . . x . . . x . . x . .' },
      lead: { v: 'flute' },
      drums: { r: 'x o o x x o o x x o o x x o o x', b: '. . . x . . x . . . x . . x . .', k: 'x . . . . . . . x . . . . . . .' }
    },
    'spot-kick': {
      bpm: 124, spb: 2, form: 'aABAB', ambience: 'crowd',
      A: { chords: ['D', 'Bm', 'G', 'A'], lead: ['A4 . D5 . F#5 . A5 .', 'B5 - A5 . F#5 . D5 .', 'G5 . B5 . D6 - B5 .', 'A5 - - - E5 - - -'] },
      B: { chords: ['G', 'A', 'D', 'D'], lead: ['B5 . B5 . A5 . G5 .', 'A5 . A5 . G5 . F#5 .', 'F#5 . A5 . D6 - - -', '. . . . D5 . D5 .'] },
      bass: { v: 'bassSaw', oct: 36, p: 'R . R . R . F .' },
      comp: { v: 'pad', oct: 57, p: 'x - - - x - - -' },
      lead: { v: 'brass' },
      drums: { k: 'x . . . x . . .', s: '. . X . . . X .', c: '. . x . . . x .', h: 'x x x x x x x x', cHi: 'x x . x x . . .', fill: '. . X . X x X X' }
    },
    'sneaky-hangman': {
      bpm: 92, spb: 2, form: 'aABAB',
      A: { chords: ['Em', 'Em', 'C7', 'B7'], lead: ['E5 . . G5 . . B5 .', 'Bb5 . . A5 . . G5 .', 'E5 . G5 . Bb5 . A5 .', 'F#5 . D#5 . B4 . . .'] },
      B: { chords: ['Am', 'Em', 'F7', 'B7'], lead: ['A4 . C5 . E5 . . .', 'G5 . E5 . B4 . . .', 'F5 . A5 . C6 - A5 .', 'B5 . . . F#5 . D#5 .'] },
      bass: { v: 'bassPluck', oct: 36, p: '0 . 3 . 5 . 6 .' },
      comp: { v: 'keys', oct: 57, p: '. x . . . x . .' },
      lead: { v: 'bell' },
      drums: { c: '. . x . . . x .', b: 'x . . . x . . .', r: 'o . o o o . o o', k: 'x . . . . . . .' }
    },
    'herd-instinct': {
      bpm: 84, spb: 3, form: 'aABAB', ambience: 'wind',
      A: { chords: ['G', 'C', 'D', 'G'], lead: [
        'D5 . G5 B5 . A5 G5 . B5 D6 . B5', 'C6 . E5 E5 . G5 C6 . E6 D6 . C6',
        'B5 . A5 F#5 . A5 D6 . A5 F#5 . D5', 'G5 . . D5 . G5 B5 - - . . .'] },
      B: { chords: ['Em', 'C', 'D', 'D'], lead: [
        'E5 . G5 B5 . G5 E6 . B5 G5 . E5', 'E5 . G5 C6 . G5 E5 . G5 C6 . E6',
        'D6 . C6 B5 . A5 G5 . A5 B5 . C6', 'A5 - - F#5 - - D5 - - . . .'] },
      bass: { v: 'bassSine', oct: 36, p: 'R . . F . . R . . F . .' },
      comp: { v: 'strum', oct: 55, p: 'x . x x . x x . x x . x' },
      lead: { v: 'whistle' },
      drums: { t: 'x . . x . . x . . x . .', r: '. . o . . o . . o . . o' }
    },
    'coffee-spill': {
      bpm: 76, spb: 2, swing: 0.25, form: 'aABAB', ambience: 'vinyl',
      A: { chords: ['Fmaj7', 'Em7', 'Dm7', 'Cmaj7'], lead: ['E5 . . C5 A4 . . .', 'G5 . . E5 D5 . B4 .', 'F5 . . D5 A4 . C5 .', 'E5 - - - . . . .'] },
      B: { chords: ['Bbmaj7', 'Am7', 'Gm7', 'C7'], lead: ['D5 . F5 . A5 . . .', 'G5 . E5 . C5 . . .', 'Bb4 . D5 . F5 . A5 .', 'G5 - E5 - . . . .'] },
      bass: { v: 'bassSine', oct: 36, p: 'R . . . F . R .' },
      comp: { v: 'keys', oct: 57, p: 'x . . . . x . .' },
      lead: { v: 'muted' },
      drums: { k: 'x . . . . x . .', s: '. . o . . . o .', h: 'x o x o x o x o' }
    }
  };
  THEMES.copycat = {
    bpm: 118, spb: 4, form: 'aABAB',
    A: { chords: ['Am7', 'D9', 'Am7', 'D9'], lead: [
      'A5 . . A5 . . C6 . . . A5 . G5 . E5 .', 'F#5 . . . E5 . D5 . . . E5 . F#5 . A5 .',
      'A5 . . A5 . . C6 . D6 . C6 . A5 . G5 .', 'E5 - - - . . F#5 . A5 - - - . . . .'] },
    B: { chords: ['Fmaj7', 'Em7', 'Dm7', 'E7'], lead: [
      'C6 . A5 . F5 . A5 . C6 . E6 . C6 . A5 .', 'B5 . G5 . E5 . G5 . B5 . D6 . B5 . G5 .',
      'A5 . F5 . D5 . F5 . A5 . C6 . A5 . F5 .', 'G#5 - - - B5 - - - E6 - - - . . . .'] },
    bass: { v: 'bassPluck', oct: 33, p: 'R . O . R . O . R . O . R . O .' },
    comp: { v: 'clav', oct: 57, p: '. . x . . . x . . . x . . . x .' },
    lead: { v: 'pluck' },
    drums: { k: 'x . . . x . . . x . . . x . . .', c: '. . . . x . . . . . . . x . . .', h: '. . x . . . x . . . x . . . x .', hHi: 'o x o x o x o x o x o x o x o x', fill: '. . . . x . x . x . x . x x x x' }
  };
  THEMES.echo = {
    bpm: 70, spb: 2, form: 'aABAB', ambience: 'cave',
    A: { chords: ['Dm', 'Bb', 'Gm', 'A'], lead: ['D5 . . . A5 . . .', 'F5 . . . D5 . . .', 'G5 . . . Bb5 . . .', 'A5 - - - E5 . . .'] },
    B: { chords: ['Bb', 'F', 'Gm', 'A'], lead: ['D6 . . . Bb5 . . .', 'C6 . . . A5 . . .', 'Bb5 . . . G5 . . .', 'E5 - - - A4 . . .'] },
    bass: { v: 'bassSine', oct: 33, p: 'R - - - - - - -' },
    comp: { v: 'pad', oct: 57, p: 'x - - - - - - -' },
    lead: { v: 'bell' },
    drums: { b: 'x . . . . . . .', t: '. . . . x . . .' }
  };
  // Going Up: bossa nova lift music, naturally.
  THEMES['going-up'] = {
    bpm: 112, spb: 2, form: 'aABAB',
    A: { chords: ['Fmaj7', 'D7', 'Gm7', 'C7'], lead: ['C6 - - A5 - G5 A5 -', 'F#5 - - A5 - C6 - -', 'Bb5 - - G5 - F5 D5 -', 'E5 - - G5 - Bb5 - -'] },
    B: { chords: ['Bbmaj7', 'Bbm6', 'Gm7', 'C7'], lead: ['D6 - - C6 - A5 F5 -', 'Db6 - - Bb5 - G5 F5 -', 'D6 - Bb5 - A5 - G5 -', 'E5 - - - G5 - - -'] },
    bass: { v: 'bassSine', oct: 36, p: 'R . . F F . . .' },
    comp: { v: 'keys', oct: 57, p: 'x . . x . . x .' },
    lead: { v: 'flute' },
    drums: { k: 'x . . x x . . .', r: '. . x . . x . .', h: 'x o x o x o x o', hHi: 'o x o x o x o x' }
  };
  // Cable Spaghetti: a spaghetti western, with a whistled tune, a galloping beat and desert wind.
  THEMES['cable-spaghetti'] = {
    bpm: 100, spb: 4, form: 'aABAB', ambience: 'wind',
    A: { chords: ['Am', 'Am', 'G', 'Am'], lead: [
      'A4 - - - - - - - E5 - - - - - - -', 'A5 - - - - - - - G5 - - - E5 - - -',
      'D5 - - - - - - - B4 - - - G4 - - -', 'A4 - - - - - - - - - - - . . . .'] },
    B: { chords: ['F', 'G', 'E7', 'Am'], lead: [
      'C5 - - - A4 - - - F5 - - - E5 - - -', 'D5 - - - B4 - - - G5 - - - F5 - - -',
      'G#5 - - - - - - - E5 - - - D5 - - -', 'A5 - - - - - - - - - - - . . . .'] },
    bass: { v: 'bassPluck', oct: 33, p: 'R . . . F . . . R . . . F . . .' },
    comp: { v: 'strum', oct: 57, p: 'x . . . x . . . x . . . x . . .' },
    lead: { v: 'whistle' },
    drums: { k: 'x . . . . . . . x . . . . . . .', r: 'x . x x x . x x x . x x x . x x', t: '. . . . . . . . . . . . x . x .' }
  };
  // Don't Click That: a nervous little chiptune for an old office computer.
  THEMES['dont-click-that'] = {
    bpm: 138, spb: 4, form: 'aABAB',
    A: { chords: ['Em', 'C', 'D', 'B7'], lead: [
      'E5 . G5 . B5 . G5 . E5 . . . D5 . E5 .', 'C5 . E5 . G5 . E5 . C6 . . . B5 . G5 .',
      'D5 . F#5 . A5 . F#5 . D6 . . . C6 . A5 .', 'B4 . D#5 . F#5 . A5 . B5 - - - . . . .'] },
    B: { chords: ['Am', 'Em', 'C', 'B7'], lead: [
      'A5 . . . G5 . E5 . C5 . E5 . A5 . . .', 'G5 . . . E5 . B4 . G4 . B4 . E5 . . .',
      'C6 . . . B5 . G5 . E5 . G5 . C6 . E6 .', 'D#6 - - - B5 - - - F#5 - - - D#5 . . .'] },
    bass: { v: 'bassTri', oct: 36, p: 'R . R . O . R . R . R . O . F .' },
    arp: { v: 'chipSoft', oct: 60, p: '0 2 1 2 0 2 1 2 0 2 1 2 0 2 1 2' },
    lead: { v: 'chip' },
    drums: { k: 'x . . . x . . . x . . . x . . .', s: '. . . . x . . . . . . . x . . .', h: 'x . x . x . x . x . x . x . x .', hHi: '. x . x . x . x . x . x . x . x' }
  };
  // Badge Check: a cool night-shift tune for the security desk, with a walking bass.
  THEMES['badge-check'] = {
    bpm: 96, spb: 2, swing: 0.3, form: 'aABAB',
    A: { chords: ['Dm7', 'Gm7', 'Dm7', 'A7'], lead: ['A4 . . C5 D5 . F5 .', 'G5 - - F5 D5 . Bb4 .', 'A4 . C5 . F5 . E5 D5', 'C#5 - - - E5 . . .'] },
    B: { chords: ['Bbmaj7', 'Am7', 'Gm7', 'A7'], lead: ['D5 . F5 . A5 - - .', 'G5 . E5 . C5 . . .', 'Bb4 . D5 . F5 . G5 .', 'E5 - C#5 - A4 . . .'] },
    bass: { v: 'bassPluck', oct: 36, p: 'R . T . F . W .' },
    comp: { v: 'keys', oct: 57, p: '. x . . . x . .' },
    lead: { v: 'muted' },
    drums: { r: 'x . x x x . x x', k: 'x . . . x . . .', b: '. . x . . . x .' }
  };
  THEMES.leaderboard = THEMES.lobby;
  THEMES.account = THEMES.lobby;
  Object.keys(THEMES).forEach(function (k) { if (!THEMES[k].key) THEMES[k].key = k; });

  // Expand a theme's form into a flat list of bars, each with its chord, the next chord and its notes.
  function compile(T) {
    if (T.bars) return T;
    var beats = 4;
    T.div = T.spb * beats;
    var bars = [];
    T.form.split('').forEach(function (sec) {
      var S = T[sec.toUpperCase()], withLead = sec === sec.toUpperCase();
      S.chords.forEach(function (c, i) { bars.push({ chord: chordOf(c), lead: withLead ? parseLine(S.lead[i], T.div) : null }); });
    });
    bars.forEach(function (b, i) { b.next = bars[(i + 1) % bars.length].chord; });
    T.bars = bars;
    ['bass', 'comp', 'arp'].forEach(function (k) { if (T[k]) T[k].steps = toks(T[k].p); });
    T.drumSteps = {};
    Object.keys(T.drums || {}).forEach(function (k) { T.drumSteps[k] = toks(T.drums[k]); });
    return T;
  }
  function parseLine(line, div) {
    var t = toks(line), out = [];
    for (var s = 0; s < t.length && s < div; s++) {
      var m = midiOf(t[s]);
      if (m == null) continue;
      var len = 1;
      while (t[s + len] === '-') len++;
      out.push({ s: s, midi: m, len: len });
    }
    return out;
  }

  // ---------- audio graph ----------
  // Each tune plays on its own bus (a gain node, `out`) into one shared compressor, so a page's tune can
  // fade in while the last one fades out.

  var ctx = null, master = null, out = null, playing = false, wantId = null, theme = null;
  var step = 0, nextTime = 0, timer = null, intensity = 0.5, amb = null;

  function on() { return A.store.get(KEY, false); }

  function graph() {
    ctx = A.audio();
    if (!ctx) return false;
    if (!master) {
      master = ctx.createDynamicsCompressor();
      master.threshold.value = -18;
      master.ratio.value = 3;
      // through WNI's music volume (the Volume panel), then the speakers
      master.connect(A.audioBus('music') || ctx.destination);
    }
    return true;
  }

  // The bar each tune was on, kept for the browser session so even a full reload carries on.
  var SPOT = 'arcade-music-spot';
  var spots = (function () {
    try { return JSON.parse(global.sessionStorage.getItem(SPOT)) || {}; } catch (e) { return {}; }
  })();
  function remember() {
    spots[theme.key] = Math.floor(Math.max(0, step - 1) / theme.div) % theme.bars.length;
    try { global.sessionStorage.setItem(SPOT, JSON.stringify(spots)); } catch (e) { /* storage blocked */ }
  }

  function voice(spec, midi, t, dur, vel) {
    var g = ctx.createGain(), dest = g, peak = spec.vol * (vel || 1);
    if (spec.cut) {
      var f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.Q.value = 0.8;
      f.frequency.setValueAtTime(spec.cut * (spec.fenv || 1), t);
      f.frequency.exponentialRampToValueAtTime(spec.cut, t + spec.a + spec.d);
      f.connect(g);
      dest = f;
    }
    var freq = hz(midi), oscs = [];
    function osc(type, fr, gain, det) {
      var o = ctx.createOscillator(), og = ctx.createGain();
      o.type = type;
      o.frequency.value = fr;
      if (det) o.detune.value = det;
      og.gain.value = gain;
      o.connect(og);
      og.connect(dest);
      oscs.push(o);
      return o;
    }
    var main = osc(spec.wave, freq, 1);
    if (spec.detune) osc(spec.wave, freq, 0.7, spec.detune);
    (spec.harm || []).forEach(function (h) { osc('sine', freq * h[0], h[1]); });
    if (spec.vib) {
      var lfo = ctx.createOscillator(), lg = ctx.createGain();
      lfo.frequency.value = 5.4;
      lg.gain.value = freq * (Math.pow(2, spec.vib / 1200) - 1);
      lfo.connect(lg);
      lg.connect(main.frequency);
      oscs.push(lfo);
    }
    var end = t + Math.max(dur, spec.a + 0.01);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + spec.a);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak * spec.s), t + spec.a + spec.d);
    g.gain.setValueAtTime(Math.max(0.0001, spec.s ? peak * spec.s : 0.0001), Math.max(end, t + spec.a + spec.d));
    g.gain.exponentialRampToValueAtTime(0.0001, Math.max(end, t + spec.a + spec.d) + spec.r);
    g.connect(out);
    oscs.forEach(function (o) { o.start(t); o.stop(Math.max(end, t + spec.a + spec.d) + spec.r + 0.05); });
  }

  function hit(kind, t, v) {
    var buf = A.noiseBuffer();
    function burst(freq, type, dur, vol, at, q) {
      var s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      s.buffer = buf;
      f.type = type;
      f.frequency.value = freq;
      if (q) f.Q.value = q;
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(vol, at + 0.003);
      g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
      s.connect(f); f.connect(g); g.connect(out);
      s.start(at, Math.random() * 0.8); s.stop(at + dur + 0.02);
    }
    function thump(f0, f1, dur, vol, type) {
      var o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(f0, t);
      o.frequency.exponentialRampToValueAtTime(f1, t + dur * 0.5);
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(out);
      o.start(t); o.stop(t + dur + 0.02);
    }
    if (!buf) return;
    if (kind === 'k') thump(140, 46, 0.3, 0.32 * v);
    else if (kind === 's') { burst(1800, 'highpass', 0.15, 0.09 * v, t); thump(200, 150, 0.08, 0.06 * v, 'triangle'); }
    else if (kind === 'h' || kind === 'hHi') burst(8000, 'highpass', 0.035, 0.03 * v, t);
    else if (kind === 'c' || kind === 'cHi') { [0, 0.011, 0.022].forEach(function (d) { burst(1400, 'bandpass', 0.12, 0.08 * v, t + d, 1.4); }); }
    else if (kind === 'r') burst(5200, 'bandpass', 0.05, 0.03 * v, t, 1.2);
    else if (kind === 'b') thump(880, 820, 0.06, 0.07 * v, 'sine');
    else if (kind === 't') thump(120, 80, 0.22, 0.2 * v);
  }

  // Starts a looping background noise on the current bus and returns its stop handle.
  function ambience(kind) {
    if (!kind) return null;
    var s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
    s.buffer = A.noiseBuffer();
    s.loop = true;
    var cfg = { crowd: ['bandpass', 750, 0.5, 0.05, 0.13], wind: ['lowpass', 420, 0.7, 0.05, 0.07], vinyl: ['highpass', 3500, 0.5, 0.006, 0.3], cave: ['lowpass', 220, 0.8, 0.06, 0.05] }[kind];
    f.type = cfg[0];
    f.frequency.value = cfg[1];
    f.Q.value = cfg[2];
    g.gain.value = cfg[3];
    lfo.frequency.value = cfg[4];
    lg.gain.value = cfg[3] * 0.45;
    lfo.connect(lg); lg.connect(g.gain);
    s.connect(f); f.connect(g); g.connect(out);
    s.start(); lfo.start();
    return { stop: function () { try { s.stop(); lfo.stop(); } catch (e) { /* already stopped */ } } };
  }

  // ---------- sequencer ----------

  function stepDur() { return 60 / theme.bpm / theme.spb; }

  function schedule(i, t) {
    var T = theme, div = T.div, s = i % div, barNo = Math.floor(i / div), bar = T.bars[barNo % T.bars.length];
    var sd = stepDur();
    if (T.swing && s % 2 === 1) t += T.swing * sd;
    var ch = bar.chord;

    if (T.bass) {
      var tk = T.bass.steps[s % T.bass.steps.length];
      if (tk !== '.' && tk !== '-') {
        var root = T.bass.oct + ((ch.root - T.bass.oct % 12) + 12) % 12;
        var iv = ch.iv;
        var semi = tk === 'R' ? 0 : tk === 'T' ? iv[1] : tk === 'F' ? 7 : tk === 'S' ? (iv[3] != null && iv[3] < 12 ? iv[3] : 12) : tk === 'O' ? 12
          : tk === 'W' ? ((bar.next.root - ch.root + 12) % 12 || 12) - 1 : Number(tk) || 0;
        var len = 1;
        while (T.bass.steps[s + len] === '-') len++;
        voice(V[T.bass.v], root + semi, t, sd * len * 0.92, 1);
      }
    }
    var voicing = null;
    function chordNotes(base) {
      var r = base + ((ch.root - base % 12) + 12) % 12;
      return ch.iv.filter(function (x) { return x < 12; }).map(function (x) { return r + x; });
    }
    if (T.comp) {
      var c = T.comp.steps[s % T.comp.steps.length];
      if (c === 'x' || c === 'X') {
        var n = 1;
        while (T.comp.steps[s + n] === '-') n++;
        voicing = chordNotes(T.comp.oct);
        voicing.forEach(function (m) { voice(V[T.comp.v], m, t, sd * n * 0.9, c === 'X' ? 1.2 : 0.9); });
      }
    }
    if (T.arp) {
      var a = T.arp.steps[s % T.arp.steps.length];
      if (a !== '.') {
        var notes = chordNotes(T.arp.oct), k = Number(a);
        voice(V[T.arp.v], notes[k % notes.length] + 12 * Math.floor(k / notes.length), t, sd * 0.9, 1);
      }
    }
    if (bar.lead) {
      bar.lead.forEach(function (nt) { if (nt.s === s) voice(V[T.lead.v], nt.midi, t, sd * nt.len * 0.95, 1); });
    }
    var fillBar = barNo % 8 === 7;
    Object.keys(T.drumSteps).forEach(function (k) {
      if (k === 'fill') return;
      if (/Hi$/.test(k) && intensity < 0.6) return;
      var steps = k === 's' && fillBar && T.drumSteps.fill ? T.drumSteps.fill : T.drumSteps[k];
      var d = steps[s % steps.length];
      if (d === 'X') hit(k, t, 1.25);
      else if (d === 'x') hit(k, t, 1);
      else if (d === 'o') hit(k, t, 0.5);
    });
    if (T.ambience === 'vinyl' && Math.random() < 0.18) hit('r', t + Math.random() * sd, 0.25);
  }

  function pump() {
    if (!playing || !ctx) return;
    if (nextTime < ctx.currentTime) nextTime = ctx.currentTime + 0.05;
    while (nextTime < ctx.currentTime + 0.14) {
      schedule(step, nextTime);
      nextTime += stepDur();
      step++;
    }
  }

  // Starts tune T on a fresh bus at the bar it was last on, fading in over `fade` seconds.
  function begin(T, fade) {
    var now = ctx.currentTime;
    theme = T;
    out = ctx.createGain();
    out.gain.setValueAtTime(0.0001, now);
    out.gain.exponentialRampToValueAtTime(0.9, now + fade);
    out.connect(master);
    amb = ambience(T.ambience);
    step = (spots[T.key] || 0) * T.div;
    nextTime = now + 0.08;
    playing = true;
    timer = setInterval(pump, 25);
    pump();
  }

  // Fades the current tune out over `fade` seconds and remembers where it was.
  function release(fade) {
    if (!playing) return;
    remember();
    playing = false;
    clearInterval(timer);
    timer = null;
    var bus = out, a = amb, now = ctx.currentTime;
    out = null;
    amb = null;
    bus.gain.cancelScheduledValues(now);
    bus.gain.setValueAtTime(Math.max(0.0001, bus.gain.value), now);
    bus.gain.exponentialRampToValueAtTime(0.0001, now + fade);
    setTimeout(function () { if (a) a.stop(); bus.disconnect(); }, (fade + 0.4) * 1000);
  }

  function start() {
    if (playing || !wantId || !on() || A.isBoss() || document.hidden) return;
    if (!graph()) return;
    if (ctx.state !== 'running') {
      // browsers only allow audio after a click or key press
      ctx.resume().then(function () { if (ctx.state === 'running') start(); }, function () {});
      return;
    }
    begin(compile(THEMES[wantId] || THEMES.lobby), 1.2);
  }

  function stop(fast) { release(fast ? 0.05 : 0.35); }

  // Every page asks for its tune when it opens. The same tune keeps playing untouched; another one
  // crossfades in, starting from wherever it was left.
  function play(id) {
    wantId = id;
    var T = compile(THEMES[id] || THEMES.lobby);
    if (!playing) { start(); return; }
    if (T === theme) return;
    release(0.8);
    intensity = 0.5;
    begin(T, 0.8);
  }

  function set(v) {
    A.store.set(KEY, !!v);
    if (v) start(); else stop();
    A.audioChanged();
  }

  // The first click or key press on a page unlocks audio, so music that was left on starts then.
  function unlock() { if (on() && !playing) start(); }
  global.addEventListener('pointerdown', unlock, true);
  global.addEventListener('keydown', unlock, true);
  document.addEventListener('visibilitychange', function () { if (document.hidden) stop(true); else start(); });
  global.addEventListener('pagehide', function () { if (playing) remember(); });
  A.onBoss(function (hidden) { if (hidden) stop(true); else start(); });

  A.music = {
    THEMES: THEMES,
    on: on,
    set: set,
    toggle: function () { set(!on()); },
    play: play,
    stop: stop,
    intensity: function (x) { intensity = Math.max(0, Math.min(1, x)); },
    playing: function () { return playing; },
    // which tune is playing and how far it has got (steps since it last started), for the dev checks
    now: function () { return playing ? { tune: theme.key, step: step } : null; }
  };
})(window);
