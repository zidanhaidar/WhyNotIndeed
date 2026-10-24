/*
 * Sneaky Hangman balance check. Run from the wni folder: node dev/balance_sneaky_hangman.js
 * Plays every level with scripted hosts (you) and prints how often the host wins:
 *   honest   keeps one random word the whole time, like normal hangman (should lose a lot)
 *   greedy   always answers with the biggest group of words
 *   lookahead tries each answer and plays the robot's next few guesses in its head (the strongest host here)
 * Every level must be winnable by at least one host.
 * Uses today's online word lists (the same source the game uses); OFFLINE=1 uses the backup list instead.
 */
'use strict';
const SH = require('../games/sneaky-hangman/engine.js');
const wordSource = require('../lib/server/words.js');
const LEVELS = ['pip', 'gridlock', 'monolith', 'edith'];
const N = Number(process.env.N) || 100;
let ok = true;

const HOSTS = {
  honest: (round, r, state) => {
    if (!state.word) state.word = round.cands[Math.floor(r() * round.cands.length)];
    return round.options().find((o) => o.sample.length && SH.partition([state.word], round.pending.letter)[o.key]).key;
  },
  greedy: (round) => round.options()[0].key,
  lookahead: (round) => {
    // value of an answer: how many more misses the robot is forced into by greedy answers afterwards
    const opts = round.options().slice(0, 4);
    let best = opts[0].key, bestV = -Infinity;
    for (const o of opts) {
      const sim = Object.create(Object.getPrototypeOf(round));
      Object.assign(sim, round, { cands: round.cands, pattern: round.pattern.slice(), guessed: round.guessed.slice(), wrong: round.wrong.slice(), history: [], rand: SH.rng(5) });
      sim.answer(o.key);
      let steps = 0;
      while (!sim.over && steps < 10) { sim.botMove(); if (sim.over) break; sim.answer(sim.options()[0].key); steps++; }
      const v = (sim.winner === 'you' ? 100 : 0) + sim.wrong.length * 10 + (sim.over ? 0 : Math.log(sim.cands.length + 1));
      if (v > bestV) { bestV = v; best = o.key; }
    }
    return best;
  }
};

async function loadWords() {
  const out = {};
  for (const len of [...new Set(LEVELS.map((l) => SH.LEVELS[l].len))]) {
    out[len] = (process.env.OFFLINE ? wordSource.fallback(len) : await wordSource.fetchOnline(len)).join(' ');
  }
  return out;
}

loadWords().then((WORDS) => {
console.log('words: ' + Object.keys(WORDS).map((k) => WORDS[k].split(' ').length + ' ' + k + '-letter').join(', ') + (process.env.OFFLINE ? ' (backup list)' : ' (online, ' + wordSource.PROVIDER + ')'));
console.log('host win rate per level (' + N + ' rounds each)');
const res = {};
for (const lv of LEVELS) {
  const cfg = SH.LEVELS[lv];
  res[lv] = {};
  const line = [];
  for (const [name, host] of Object.entries(HOSTS)) {
    let wins = 0, misses = 0;
    for (let i = 0; i < N; i++) {
      const round = new SH.Round(lv, WORDS, 1000 + i), r = SH.rng(77 + i), state = {};
      while (!round.over) {
        const m = round.botMove();
        if (round.over || !m) break;
        round.answer(host(round, r, state));
      }
      if (round.winner === 'you') wins++;
      misses += round.wrong.length;
    }
    res[lv][name] = wins / N;
    line.push(name + ' ' + (100 * wins / N).toFixed(0) + '% (avg misses ' + (misses / N).toFixed(1) + ')');
  }
  console.log(lv.padEnd(9), (cfg.len + ' letters, ' + cfg.lives + ' lives').padEnd(20), line.join('  |  '));
}
for (const lv of LEVELS) {
  const best = Math.max(...Object.values(res[lv]));
  if (!(best > 0)) { ok = false; console.log('PROBLEM: no host beat', lv); }
  if (res[lv].honest > 0.35) { ok = false; console.log('PROBLEM: an honest player beats', lv, 'too often'); }
}
if (!(res.pip.greedy >= 0.8)) { ok = false; console.log('PROBLEM: Pip should be easy for a sneaky player'); }
console.log(ok ? 'ALL GOOD' : 'PROBLEMS FOUND');
});
