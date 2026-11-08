/*
 * Level Crossing balance check: scripted railway operators on every level, on freshly generated maps.
 *   idle      never touches anything (passengers give up)
 *   careless  never plans: stops at every station, leaves the switches alone, drops a barrier only when a
 *             train is almost there and lifts it straight after, ignores the red lights
 *   planner   sets switches toward the stations worth visiting, stops only where there is something to do,
 *             keeps a safe gap and yields at junctions, lowers barriers just in time and lifts them as soon as
 *             the train has gone, and (Edith) sets a red light behind a train that is standing at a station
 * Rules for an endless game: the planner earns the first star on every level at least half the time, the
 * careless player does clearly worse, the levels get harder in order, and every shift ends.
 * Run: node dev/balance_level_crossing.js [runs]
 */
const LC = require('../games/level-crossing/engine.js');
const RUNS = Number(process.argv[2]) || 24;
const LIMIT = 40 * 60; // seconds; a shift that runs longer than this counts as never ending

function crossingsAhead(w, t, D) {
  const out = {};
  w.ahead(t.e, t.s, D, (E, a, b, off) => {
    E.crossings.forEach((cid) => { const cr = w.map.crossings[cid]; if (cr.s >= a && cr.s <= b && out[cid] == null) out[cid] = off + cr.s - a; });
  });
  return out;
}
function onCrossing(w, cr) { return w.trainOn(cr, 1.35); }

// distance from train t's head to the nearest car of another train ahead on its route
function gapAhead(w, t, D) {
  let best = Infinity;
  const others = w.trains.filter((o) => o !== t).map((o) => w.carsOf(o).map((c) => [c[3], c[4]]).concat([[o.e, o.s]]));
  w.ahead(t.e, t.s, D, (E, a, b, off) => {
    others.forEach((cars) => cars.forEach((c) => { if (c[0] === E.id && c[1] >= a - 0.6 && c[1] <= b) best = Math.min(best, off + c[1] - a - 0.6); }));
    return best < Infinity;
  });
  return best;
}
function nodeAhead(w, t, D, type) {
  let res = null;
  w.ahead(t.e, t.s, D, (E, a, b, off) => {
    if (b >= E.len - 1e-6) { const n = w.map.nodes[E.to]; if (n.type === type) { res = { node: n, d: off + E.len - a, via: E.id }; return true; } }
  });
  return res;
}

function stationValue(w, t, st) {
  const off = t.riders.filter((r) => r.color === st.color).length;
  const room = t.cap - t.riders.length + off;
  const on = Math.min(room, st.waiting.length);
  return off * 2 + on;
}

// value of the stations met along a route starting with edge e0
function routeValue(w, t, e0, D) {
  let v = 0, off = 0, e = e0, s = 0;
  for (let g = 0; g < 12 && off < D; g++) {
    const E = w.map.edges[e];
    E.stations.forEach((k) => { const st = w.map.stations[k]; v += stationValue(w, t, st) / (1 + (off + st.s0) / 12); });
    off += E.len;
    e = w.nextEdge(e);
  }
  return v;
}

function planner(w, careless) {
  const keepDown = {};
  const you = w.trains.filter((t) => t.kind === 'you');
  // trains
  you.forEach((t) => {
    // the switch ahead
    if (!careless) {
      const sw = nodeAhead(w, t, 14, 'switch');
      if (sw && !w.switchBusy(sw.node.id)) {
        const nearer = you.some((o) => o !== t && (() => { const x = nodeAhead(w, o, 14, 'switch'); return x && x.node === sw.node && x.d < sw.d; })());
        if (!nearer) {
          const v0 = routeValue(w, t, sw.node.outs[0], 45), v1 = routeValue(w, t, sw.node.outs[1], 45);
          const want = v1 > v0 + 0.01 ? 1 : v0 > v1 + 0.01 ? 0 : 1;
          if (sw.node.state !== want) w.flipSwitch(sw.node.id);
        }
      }
    }
    // standing at a station: leave once the doors are done (or nothing more to do)
    if (t.v < 0.01 && t.station >= 0) {
      const st = w.map.stations[t.station];
      const more = t.riders.some((r) => r.color === st.color) || (st.waiting.length && t.riders.length < t.cap);
      if (t.served || !more) t.wantLeave = true;
      // a crossing just ahead goes down before the train pulls out
      if (t.wantLeave && !careless) {
        const ah = crossingsAhead(w, t, 4.5);
        Object.keys(ah).forEach((cid) => { const cr = w.map.crossings[cid]; keepDown[cid] = true; if (!cr.down) w.setBarrier(cr.id, true); if (cr.arm < 1) t.wantLeave = false; });
      }
    }
    let stop = false;
    // a station worth stopping at
    let target = null;
    w.ahead(t.e, t.s, w.brakeDist(t) + 6, (E, a, b, off) => {
      for (const k of E.stations) {
        const st = w.map.stations[k], h = st.s0 + 3.9;
        if (h >= a && h <= b && k !== t.station && (careless || stationValue(w, t, st) > 0)) { target = { d: off + h - a, k }; return true; }
      }
    });
    // once the brakes go on for a station, they stay on until the train stands there
    if (target && target.d <= w.brakeDist(t) + t.v * LC.DT * 2 + 0.02) t.stopFor = target.k;
    if (t.stopFor != null && t.v > 0.01) stop = true;
    if (t.v < 0.01 && t.station >= 0 && !t.wantLeave) stop = true;
    if (t.wantLeave || (t.v < 0.01 && t.station < 0)) t.stopFor = null;
    // keep a safe gap
    const gap = gapAhead(w, t, w.brakeDist(t) + 4);
    if (gap < w.brakeDist(t) + (careless ? 0.6 : 1.4)) stop = true;
    // give way at a junction to a train that gets there first, and always to the freight
    if (!careless) {
      const mg = nodeAhead(w, t, 9, 'merge');
      if (mg) {
        w.trains.forEach((o) => {
          if (o === t) return;
          const om = nodeAhead(w, o, 9, 'merge');
          if (!om || om.node !== mg.node || om.via === mg.via) return;
          const tt = mg.d / Math.max(0.8, t.v), to = om.d / Math.max(0.8, o.v);
          if ((o.kind === 'freight' || to < tt) && mg.d < w.brakeDist(t) + 2.2) stop = true;
        });
      }
    }
    const want = stop ? 'stop' : 'go';
    if (want === 'go') t.wantLeave = false;
    if (t.want !== want) w.setWant(t.id, want);
  });

  // barriers
  const eta = {};
  w.trains.forEach((t) => {
    const ah = crossingsAhead(w, t, 14);
    Object.keys(ah).forEach((cid) => {
      const moving = t.kind === 'freight' || t.want === 'go';
      const sp = moving ? Math.max(t.v, 1.2) : t.v;
      if (sp < 0.05) return;
      const e = ah[cid] / sp;
      eta[cid] = Math.min(eta[cid] == null ? Infinity : eta[cid], e);
    });
  });
  w.map.crossings.forEach((cr) => {
    const e = eta[cr.id] == null ? Infinity : eta[cr.id];
    const busy = onCrossing(w, cr) || keepDown[cr.id];
    const lowerAt = careless ? 1.15 : 2.4, liftAt = careless ? 1.3 : 3.0;
    if (!cr.down && (e < lowerAt || busy)) w.setBarrier(cr.id, true);
    else if (cr.down && e > liftAt && !busy) w.setBarrier(cr.id, false);
  });

  // red lights (Edith): hold the freight behind a train standing at (or pulling into) a station
  if (w.cfg.freight && !careless) {
    const fr = w.trains.find((t) => t.kind === 'freight');
    w.map.stations.forEach((st) => {
      let protect = false;
      you.forEach((t) => {
        // is any part of t within 10 units past this signal?
        const cars = w.carsOf(t);
        w.ahead(st.edge, st.sig, 10, (E, a, b) => { if (cars.some((c) => c[3] === E.id && c[4] >= a && c[4] <= b)) protect = true; });
      });
      // only worth it while the freight is behind and closing in
      let near = false;
      if (fr) w.ahead(fr.e, fr.s, 16, (E, a, b) => { if (E.id === st.edge && st.sig >= a && st.sig <= b) near = true; });
      const red = protect && near;
      if (st.red !== red) w.setSignal(st.id, red);
    });
  }
}

function play(level, seed, who) {
  const w = new LC.World(level, seed, 1.5);
  let i = 0;
  while (!w.over && w.t < LIMIT) {
    if (who !== 'idle' && i % 2 === 0) planner(w, who === 'careless');
    w.step();
    w.events.length = 0;
    i++;
  }
  return w;
}

const order = ['pip', 'gridlock', 'monolith', 'edith'];
const res = {};
let problems = 0;
for (const who of ['idle', 'careless', 'planner']) {
  res[who] = {};
  for (const level of order) {
    let sum = 0, star = 0, endless = 0, reasons = {}, time = 0, best = 0;
    for (let r = 0; r < RUNS; r++) {
      const w = play(level, 1000 + r * 7717, who);
      sum += w.delivered; time += w.t; best = Math.max(best, w.delivered);
      if (w.delivered >= LC.STARS[0]) star++;
      if (!w.over) endless++;
      const why = w.reason === 'crash' ? 'crash-' + w.crash.kind : w.reason || 'running';
      reasons[why] = (reasons[why] || 0) + 1;
    }
    res[who][level] = { avg: sum / RUNS, star: star / RUNS };
    console.log(who.padEnd(8), level.padEnd(9), 'delivered avg', (sum / RUNS).toFixed(1).padStart(6), 'best', String(best).padStart(4), 'first star', (100 * star / RUNS).toFixed(0).padStart(3) + '%',
      'shift', (time / RUNS / 60).toFixed(1) + ' min', JSON.stringify(reasons));
    if (endless) { console.log('  PROBLEM: ' + endless + ' shifts never ended'); problems++; }
  }
}
order.forEach((lv, i) => {
  if (res.planner[lv].star < 0.5) { console.log('PROBLEM: planner first star on ' + lv + ' only ' + (100 * res.planner[lv].star).toFixed(0) + '%'); problems++; }
  if (res.careless[lv].avg > res.planner[lv].avg * 0.75) { console.log('PROBLEM: careless is too close to the planner on ' + lv); problems++; }
  if (i && res.planner[lv].avg > res.planner[order[i - 1]].avg * 1.05) { console.log('PROBLEM: ' + lv + ' is not harder than ' + order[i - 1]); problems++; }
});
console.log(problems ? problems + ' PROBLEMS' : 'ALL GOOD');
