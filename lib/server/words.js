/*
 * Online words for Sneaky Hangman. Pulls common English words of one length from the Datamuse word API
 * (https://www.datamuse.com/api/), keeps the most frequent ones and drops names and rude words.
 * Plain CommonJS so the API route and the dev balance script can both use it.
 */
'use strict';

// Note: Datamuse says an API key will be required from 1 February 2027 (free use without a key until then).
// Until a key is added here, requests will fail after that date and the cache, then the backup list, take over.
const PROVIDER = 'Datamuse';
const LETTERS = 'abcdefghijklmnopqrstuvwxyz'.split('');
const KEEP = 1600;

const BLOCK = new Set(`
anal anus arse arses ass asses bastard bitch bitches bloody blowjob bollock boner boob boobs breast breasts bugger butt butts clit cock cocks
condom crap cunt cunts damn dick dicks dildo dyke fag fags faggot fart fuck fucked fucker fucking fucks gay gays hell hooker horny jerk kill
killed killer killing kills nazi nazis negro nigga nigger nipple nipples nude nudes nudity orgasm penis piss pissed poop porn porno prick pube
pubes pussy queer racist rape raped rapes rapist retard sex sexy sexual shit shits slut sluts sperm suck sucks semen testes tits titty twat
vagina wank whore whores murder murders suicide drugs cocaine heroin bomb bombs terror gun guns rifle corpse dead death dies dying hitler
slave slaves lust erotic stripper strip naked bra bras panties thong hump humping lesbian homo virgin vomit puke beer vodka whisky whiskey
drunk booze liquor casino gamble bets jesus christ allah satan devil demon demons bible church muslim islam jewish christian
`.split(/\s+/).filter(Boolean));
const BLOCK_PARTS = ['fuck', 'shit', 'cunt', 'dick', 'cock', 'porn', 'sex', 'nigg', 'rape', 'slut', 'whore', 'bitch', 'penis', 'vagin', 'anal', 'erotic'];

function blocked(w) {
  return BLOCK.has(w) || BLOCK_PARTS.some((p) => w.includes(p));
}

function freqOf(tags) {
  const t = (tags || []).find((x) => x.startsWith('f:'));
  return t ? parseFloat(t.slice(2)) : 0;
}

// Fetches and cleans one word list. Resolves to a sorted array of lowercase words.
async function fetchOnline(len, opts = {}) {
  const timeoutMs = opts.timeoutMs || 8000;
  const pattern = '?'.repeat(len - 1);
  const lists = await Promise.all(LETTERS.map(async (c) => {
    const url = 'https://api.datamuse.com/words?sp=' + c + pattern + '&md=fp&max=1000';
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(PROVIDER + ' answered ' + res.status);
    return res.json();
  }));
  const best = new Map();
  for (const list of lists) {
    for (const item of list) {
      const w = String(item.word || '');
      if (w.length !== len || !/^[a-z]+$/.test(w)) continue;
      if ((item.tags || []).includes('prop')) continue;
      const f = freqOf(item.tags);
      if (!(f > 0) || blocked(w)) continue;
      if (!best.has(w) || best.get(w) < f) best.set(w, f);
    }
  }
  const words = [...best.entries()].sort((a, b) => b[1] - a[1]).slice(0, KEEP).map((e) => e[0]).sort();
  if (words.length < 300) throw new Error(PROVIDER + ' returned too few ' + len + '-letter words');
  return words;
}

function fallback(len) {
  const all = require('./fallback-words.js');
  return (all[len] || '').split(' ').filter(Boolean);
}

module.exports = { PROVIDER, KEEP, fetchOnline, fallback, blocked };
