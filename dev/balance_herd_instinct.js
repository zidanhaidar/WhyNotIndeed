/*
 * Herd Instinct balance check. Run from the wni folder: node dev/balance_herd_instinct.js
 * A scripted sheepdog (the classic "collect the stragglers, then drive the flock from behind" method)
 * plays every level many times. Every level, Edith included, must be winnable by it,
 * and a dog that just runs at the flock should do much worse.
 */
'use strict';
const HI = require('../games/herd-instinct/engine.js');
const LEVELS = ['pip', 'gridlock', 'monolith', 'edith'];
const N = Number(process.env.N) || 30;
let ok = true;

function len(x, y) { return Math.sqrt(x * x + y * y); }

// Where the flock should go next: around the pond if it is in the way, then to the gate, then into the pen.
function goal(w, gx, gy) {
  const P = HI.PEN, outside = { x: P.x - 70, y: HI.GATE.y }, inside = { x: P.x + P.w * 0.6, y: HI.GATE.y };
  let T = len(gx - outside.x, gy - outside.y) < 70 || gx > P.x - 60 ? inside : outside;
  const pond = w.obstacles.find((o) => o.kind === 'pond');
  if (pond && gx < pond.x + pond.r) {
    const vx = T.x - gx, vy = T.y - gy, L = len(vx, vy) || 1;
    const t = Math.max(0, Math.min(1, ((pond.x - gx) * vx + (pond.y - gy) * vy) / (L * L)));
    const px = gx + vx * t, py = gy + vy * t;
    if (len(px - pond.x, py - pond.y) < pond.r + 60) T = { x: pond.x + 10, y: gy < pond.y ? pond.y - pond.r - 95 : pond.y + pond.r + 95 };
  }
  return T;
}

function shepherd(w) {
  const free = w.sheep.filter((s) => !s.penned && !s.lost);
  if (!free.length) return {};
  const dog = w.dog;
  if (w.wolf && w.wolf.active && free.some((s) => len(s.x - w.wolf.x, s.y - w.wolf.y) < 260)) return { tx: w.wolf.x, ty: w.wolf.y };
  let gx = 0, gy = 0;
  free.forEach((s) => { gx += s.x; gy += s.y; });
  gx /= free.length; gy /= free.length;
  let far = free[0], fd = 0;
  free.forEach((s) => { const d = len(s.x - gx, s.y - gy); if (d > fd) { fd = d; far = s; } });
  const T = goal(w, gx, gy);
  let px, py;
  const spread = 26 * Math.sqrt(free.length);
  if (fd > spread) {
    const d = len(far.x - gx, far.y - gy) || 1;
    px = far.x + (far.x - gx) / d * 30; py = far.y + (far.y - gy) / d * 30;
  } else {
    const d = len(gx - T.x, gy - T.y) || 1;
    const back = 30 + 14 * Math.sqrt(free.length);
    px = gx + (gx - T.x) / d * back; py = gy + (gy - T.y) / d * back;
  }
  const nearest = Math.min(...free.map((s) => len(s.x - dog.x, s.y - dog.y)));
  const toP = len(px - dog.x, py - dog.y);
  // near the flock it trots, staying under the speed that makes Edith's sheep bolt
  return { tx: px, ty: py, walk: nearest < 90 && toP < 120, max: nearest < 170 ? 150 : 0 };
}

function charger(w) {
  const free = w.sheep.filter((s) => !s.penned && !s.lost);
  if (!free.length) return {};
  let gx = 0, gy = 0;
  free.forEach((s) => { gx += s.x; gy += s.y; });
  return { tx: gx / free.length, ty: gy / free.length };
}

function play(lv, seed, brain) {
  const w = new HI.World(lv, seed);
  while (!w.over) { w.step(brain(w)); w.events.length = 0; }
  const c = w.counts();
  return { win: w.result === 'win', penned: c.penned, lost: c.lost, t: w.t };
}

for (const lv of LEVELS) {
  const cfg = HI.LEVELS[lv];
  const res = {};
  for (const [name, brain] of [['shepherd', shepherd], ['charger', charger]]) {
    let wins = 0, pen = 0, lost = 0, time = 0;
    for (let i = 0; i < N; i++) {
      const r = play(lv, 100 + i * 7, brain);
      if (r.win) { wins++; time += r.t; }
      pen += r.penned; lost += r.lost;
    }
    res[name] = wins / N;
    console.log(lv.padEnd(9), name.padEnd(9), 'wins', (100 * wins / N).toFixed(0).padStart(3) + '%', '| penned', (pen / N).toFixed(1), 'of need', cfg.need,
      '| lost to wolf', (lost / N).toFixed(1), wins ? '| avg win time ' + (time / wins).toFixed(0) + 's of ' + cfg.time : '');
  }
  if (!(res.shepherd > 0.1)) { ok = false; console.log('PROBLEM: the scripted shepherd cannot reliably beat', lv); }
  if (!(res.charger < res.shepherd)) { ok = false; console.log('PROBLEM: charging at the flock should not beat proper herding on', lv); }
}
console.log(ok ? 'ALL GOOD' : 'PROBLEMS FOUND');
