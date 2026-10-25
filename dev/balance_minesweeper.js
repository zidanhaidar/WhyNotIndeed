/*
 * Minesweeper balance check. Run from the wni folder: node dev/balance_minesweeper.js
 * Lays many fields per robot from random first clicks and checks that the first click always opens an area, that
 * logic alone clears every field (no guessing), and that a skilled player can beat every robot. The skilled player
 * model: 1 s per square opened by logic, 0.4 s per flag. Levels must get harder in order (the robot's time against
 * that model shrinks), Pip should blow itself up now and then (not always), and the rules must hold: clearing wins,
 * a mine loses, chording opens the rest of a satisfied number.
 */
'use strict';
const MS = require('../games/minesweeper/engine.js');
const LEVELS = ['pip', 'gridlock', 'monolith', 'edith'];
const N = Number(process.env.N) || 100;
let ok = true;
function check(cond, msg) { if (!cond) { ok = false; console.log('PROBLEM:', msg); } }
function humanTime(field, first) {
  const s = new MS.Sweep(field);
  let t = 2;
  s.open(first);
  for (let m = s.deduce(); m; m = s.deduce()) { t += m.cells.length * (m.type === 'flag' ? 0.4 : 1); s.apply(m); }
  return t;
}

const ratio = {};
for (const lv of LEVELS) {
  let opensArea = 0, logic = 0, booms = 0, sumRatio = 0, minRatio = Infinity, par = [];
  for (let i = 0; i < N; i++) {
    const g = new MS.Game(lv, 600 + i * 71), first = Math.floor(new MS.Rng(9 + i).next() * g.n);
    g.start(first);
    if (g.field.count[first] === 0 && !g.field.mine[first]) opensArea++;
    const s = new MS.Sweep(g.field);
    s.open(first);
    for (let m = s.deduce(); m; m = s.deduce()) s.apply(m);
    if (s.done()) logic++;
    if (g.robot.boom != null) booms++;
    const r = g.robot.par / humanTime(g.field, first);
    sumRatio += r;
    minRatio = Math.min(minRatio, r);
    par.push(g.robot.par);
  }
  ratio[lv] = sumRatio / N;
  console.log(lv.padEnd(9), 'first click opens an area', opensArea + '/' + N, '| no guessing', logic + '/' + N, '| robot',
    (Math.min(...par) / 60).toFixed(1) + '-' + (Math.max(...par) / 60).toFixed(1) + ' min', '| robot vs skilled player x' + ratio[lv].toFixed(2) + ' (slowest x' + minRatio.toFixed(2) + ')',
    '| robot blew up', (100 * booms / N).toFixed(0) + '%');
  check(opensArea === N, lv + ': the first click must always open an area');
  check(logic === N, lv + ': every field must be clearable by logic alone');
  check(minRatio > 1.2, lv + ': a skilled player must be able to beat the robot on every field');
  if (lv === 'pip') check(booms > 0.05 * N && booms < 0.35 * N, 'Pip should blow itself up now and then, not always');
  else check(booms === 0, lv + ' never clicks carelessly');
}
for (let i = 1; i < LEVELS.length; i++) check(ratio[LEVELS[i]] < ratio[LEVELS[i - 1]], 'levels should get harder in order at ' + LEVELS[i]);

// the rules
const g = new MS.Game('gridlock', 5);
g.open(70);
for (let i = 0; i < g.n && !g.over; i++) if (!g.field.mine[i]) g.open(i);
check(g.result === 'win' && g.points() > 500, 'opening every safe square wins');
const b = new MS.Game('gridlock', 6);
b.open(70);
b.open(b.field.mine.indexOf(1));
check(b.result === 'lose' && b.reason === 'mine', 'opening a mine loses');
const ch = new MS.Game('monolith', 7);
ch.open(120);
let chorded = false;
for (let i = 0; i < ch.n && !chorded; i++) {
  if (ch.state(i) !== 1 || !ch.number(i)) continue;
  const nb = ch.nb(i), mines = nb.filter((c) => ch.isMine(c)), closedSafe = nb.filter((c) => !ch.isMine(c) && ch.state(c) === 0);
  if (!closedSafe.length) continue;
  mines.forEach((c) => { if (ch.state(c) === 0) ch.toggleFlag(c); });
  ch.chord(i);
  chorded = closedSafe.every((c) => ch.state(c) === 1) && !ch.over;
}
check(chorded, 'chording a satisfied number opens its other neighbours');
console.log(ok ? 'ALL GOOD' : 'PROBLEMS FOUND');
