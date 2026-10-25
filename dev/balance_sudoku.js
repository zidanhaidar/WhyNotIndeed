/*
 * Sudoku balance check. Run from the wni folder: node dev/balance_sudoku.js
 * Makes many puzzles per robot and checks that every one has exactly one solution, is solvable by logic at the
 * level's difficulty (singles for Pip and Ted; pointing, claiming or naked pairs for Excel and Edith), and that a
 * skilled player can beat every robot. The skilled player model: 6 s per cell found by singles, 25 s per cell after a
 * harder deduction. Levels must get harder in order (the robot's time against that model shrinks), and the rules
 * must hold: a full grid wins, three wrong numbers lose, and the robot finishing first wins it for the robot.
 */
'use strict';
const SU = require('../games/sudoku/engine.js');
const LEVELS = ['pip', 'gridlock', 'monolith', 'edith'];
const N = Number(process.env.N) || 60;
let ok = true;
function check(cond, msg) { if (!cond) { ok = false; console.log('PROBLEM:', msg); } }
function humanTime(g) { return 2 + g.rating.steps.reduce((t, s) => t + (s.hard ? 25 : 6), 0); }

const ratio = {};
for (const lv of LEVELS) {
  const c = SU.LEVELS[lv];
  let unique = 0, rightLevel = 0, inRange = 0, minRatio = Infinity, sumRatio = 0, fin = [], ms = 0;
  for (let i = 0; i < N; i++) {
    const t0 = Date.now(), g = new SU.Game(lv, 2000 + i * 131);
    ms += Date.now() - t0;
    const givens = 81 - g.toFill;
    if (SU.solutions(g.puzzle, 2) === 1) unique++;
    if (g.rating.solved && g.rating.hardest === c.need) rightLevel++;
    if (givens >= c.givens[0] && givens <= c.givens[1]) inRange++;
    const r = g.robotFinish / humanTime(g);
    minRatio = Math.min(minRatio, r);
    sumRatio += r;
    fin.push(g.robotFinish);
  }
  ratio[lv] = sumRatio / N;
  console.log(lv.padEnd(9), 'one solution', unique + '/' + N, '| right difficulty', rightLevel + '/' + N, '| givens in range', inRange + '/' + N,
    '| robot', (Math.min(...fin) / 60).toFixed(1) + '-' + (Math.max(...fin) / 60).toFixed(1) + ' min', '| robot vs skilled player x' + ratio[lv].toFixed(2) + ' (slowest x' + minRatio.toFixed(2) + ')',
    '| ms per puzzle', (ms / N).toFixed(0));
  check(unique === N, lv + ': every puzzle must have exactly one solution');
  check(rightLevel === N, lv + ': every puzzle must be solvable by logic at the level\'s difficulty');
  check(inRange === N, lv + ': givens out of range');
  check(minRatio > 1.05, lv + ': a skilled player must be able to beat the robot on every puzzle');
}
for (let i = 1; i < LEVELS.length; i++) check(ratio[LEVELS[i]] < ratio[LEVELS[i - 1]], 'levels should get harder in order at ' + LEVELS[i]);

// the rules
const win = new SU.Game('pip', 77);
for (let i = 0; i < 81; i++) if (!win.given[i]) win.place(i, win.solution[i]);
check(win.result === 'win' && win.points() > 500, 'filling the grid correctly wins');
const lose = new SU.Game('pip', 78);
const spot = lose.given.indexOf(false), wrong = lose.solution[spot] % 9 + 1;
for (let k = 0; k < 3; k++) lose.place(spot, wrong);
check(lose.result === 'lose' && lose.reason === 'mistakes' && !lose.values[spot], 'three wrong numbers lose, and wrong numbers never stay');
const slow = new SU.Game('edith', 79);
while (!slow.over) slow.step();
check(slow.result === 'lose' && slow.reason === 'robot', 'the robot finishing first wins it for the robot');
console.log(ok ? 'ALL GOOD' : 'PROBLEMS FOUND');
