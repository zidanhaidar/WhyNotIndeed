/*
 * Harbor Master balance check: scripted captains on every level, on freshly generated harbors.
 *   idle      never touches the controls (crates wait until they give up)
 *   careless  steers straight at the next dock at full speed and stops when it is close, never looks at the
 *             forecast, the shore or the other boats
 *   planner   picks the dock with the most cargo to swap per distance, follows a route over open water with the
 *             same rudder and telegraph a player has, slows down in time to stop alongside, raises the bridge on
 *             the way and lowers it behind, and stops when the forecast says a boat is in the way
 * Rules for an endless game: the planner earns the first star on every level at least half the time, the
 * careless captain does clearly worse, the levels get harder in order, and every shift ends.
 * Run: node dev/balance_harbor_master.js [runs]
 */
const HM = require('../games/harbor-master/engine.js');
const RUNS = Number(process.argv[2]) || 24;
const LIMIT = 40 * 60;

function angDiff(a, b) { let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; }
function pathLen(p) { let n = 0; for (let i = 1; i < p.length; i++) n += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]); return n; }

function chooseDock(w, st) {
  const s = w.ship, m = w.map;
  let best = null, bs = -1;
  m.docks.forEach((d) => {
    const off = s.cargo.filter((c) => c.color === d.color).length;
    const room = HM.SHIP.cap - s.cargo.length + off;
    let urgent = 0;
    d.crates.forEach((c) => { if (w.t - c.born > c.patience * 0.6) urgent++; });
    const value = off * 2 + Math.min(room, d.crates.length) + urgent * 1.5;
    if (value <= 0 || (s.dock === d.id)) return;
    const path = HM.route(m, s.x, s.y, d.x, d.y, false);
    if (!path) return;
    const sc = value / (pathLen(path) + 6);
    if (sc > bs) { bs = sc; best = { dock: d, path }; }
  });
  if (!best) {
    // nothing to do: wait near the dock with the most crates
    const d = m.docks.slice().sort((a, b) => b.crates.length - a.crates.length)[0];
    if (s.dock === d.id) return null;
    const path = HM.route(m, s.x, s.y, d.x, d.y, false);
    return path ? { dock: d, path } : null;
  }
  return best;
}

function steer(w, rudderWant) {
  const s = w.ship;
  if (s.rudder < rudderWant - 0.06) w.setRudder(1);
  else if (s.rudder > rudderWant + 0.06) w.setRudder(-1);
  else w.setRudder(0);
}
function tele(w, t) { const s = w.ship; while (s.tele < t) w.telegraph(1); while (s.tele > t) w.telegraph(-1); }

// how many seconds the ship can hold this rudder and telegraph before its hull touches land (up to secs)
function clearFor(w, rudder, tele, secs) {
  const s = w.ship, sim = { x: s.x, y: s.y, h: s.h, v: s.v, yaw: s.yaw };
  for (let t = 0; t < secs; t += 0.25) {
    for (let k = 0; k < 8; k++) HM.shipStep(sim, s.spec, tele, rudder, HM.DT);
    if (HM.hullPoints(sim.x, sim.y, sim.h, s.spec).some((p) => w.map.isLand(p[0], p[1]) || w.bridgeBlocks(p[0], p[1]))) return t;
    if (w.boatAt(t + 0.25).some((b) => HM.hullsTouch(sim.x, sim.y, sim.h, s.spec.len + 0.6, s.spec.beam + 0.6, b[0], b[1], b[3], b[2] + 0.3, b[4] + 0.3))) return t;
  }
  return secs;
}

function bridgeCare(w, st) {
  const s = w.ship, b = w.map.bridge;
  if (!b) return;
  const path = st.plan ? st.plan.path : [];
  const through = path.some((q) => Math.abs(q[0] - b.x) < 2.5 && Math.abs(q[1] - b.y) < 2.5);
  const close = Math.hypot(s.x - b.x, s.y - b.y);
  // passed it when it is behind the ship
  const behind = (b.x - s.x) * Math.cos(s.h) + (b.y - s.y) * Math.sin(s.h) < -1.5;
  const coming = through && close < 7 && !behind;
  if (coming && !b.up) w.toggleBridge();
  if (b.up && !coming && close > 3.5) w.toggleBridge();
}

function captain(w, careless, st) {
  bridgeCare(w, st);
  const s = w.ship, m = w.map;
  // at a dock: wait until the cranes are done
  if (s.dock >= 0) {
    const d = m.docks[s.dock];
    st.dwell = (st.dwell || 0) + HM.DT * 2;
    const unload = s.cargo.some((c) => c.color === d.color);
    const more = unload || (d.crates.length && s.cargo.length < HM.SHIP.cap && st.dwell < 6);
    if (more) { tele(w, 2); steer(w, 0); return; }
  } else st.dwell = 0;
  if (!st.plan || st.plan.dock.id === s.dock || (st.t++ % 40 === 0 && !careless)) {
    const p = chooseDock(w, st);
    if (!p) { tele(w, s.dock >= 0 ? 2 : 1); return; }
    st.plan = careless ? { dock: p.dock, path: [[s.x, s.y], [p.dock.x, p.dock.y]] } : p;
  }
  // stuck (not docked, barely moved for a while): try escape moves the forecast says are clear, and hold one
  if (!careless) {
    if (st.escape > 0) { st.escape -= HM.DT * 2; return; }
    st.track = st.track || { x: s.x, y: s.y, t: w.t };
    if (Math.hypot(s.x - st.track.x, s.y - st.track.y) > 0.8 || s.dock >= 0) st.track = { x: s.x, y: s.y, t: w.t };
    else if (w.t - st.track.t > 5) {
      const moves = [[0, 0], [1, 0], [-1, 0], [1, 1], [-1, 1], [1, 3], [-1, 3], [0, 3]];
      const mv = moves.find((mm) => clearFor(w, mm[0], mm[1], 2.5) >= 2.5) || [0, 1];
      s.rudder = mv[0]; w.setRudder(0); tele(w, mv[1]);
      st.escape = 2.5; st.plan = null; st.track = { x: s.x, y: s.y, t: w.t };
      return;
    }
  }
  // just bumped: back off, then find a new way
  if (s.bumpT > 1.2 && !careless) { tele(w, 1); steer(w, 0); st.plan = null; return; }
  const path = st.plan.path, d = st.plan.dock;
  // the point a little ahead on the route
  let near = 0, nd = 1e9;
  for (let i = 0; i < path.length; i++) { const q = path[i], dd = Math.hypot(q[0] - s.x, q[1] - s.y); if (dd < nd) { nd = dd; near = i; } }
  let look = path[Math.min(path.length - 1, near + 1)];
  for (let i = near + 1; i < path.length; i++) { look = path[i]; if (Math.hypot(path[i][0] - s.x, path[i][1] - s.y) > 2.4) break; }
  const remaining = Math.hypot(d.x - s.x, d.y - s.y);
  const want = Math.atan2(look[1] - s.y, look[0] - s.x), err = angDiff(s.h, want);
  let rud = Math.max(-1, Math.min(1, 2.2 * err - 1.6 * s.yaw));
  // facing the wrong way: stop and swing round with the bow thruster
  if (!careless && Math.abs(err) > 1.6) {
    const pref = err > 0 ? 1 : -1, ok = (r) => clearFor(w, r, 2, 2.5) >= 2.5;
    if (ok(pref)) { steer(w, pref); tele(w, 2); return; }
    if (ok(-pref)) { steer(w, -pref); tele(w, 2); return; }
    // no room to swing: back off a little
    steer(w, 0); tele(w, clearFor(w, 0, 1, 2) >= 2 ? 1 : 2); return;
  }
  const stopDist = s.v * s.v / (2 * HM.SHIP.acc * 1.15);
  let t = 4;
  if (careless) t = remaining < 2 ? 2 : 4;
  else {
    if (Math.abs(err) > 0.7 || remaining < 6) t = 3;
    if (remaining < stopDist + 0.6) t = s.v > 0.15 ? 2 : (remaining > 0.6 ? 3 : 2);
    if (remaining < 0.6 && s.v > 0.05) t = 1;
  }
  // check the forecast: if this rudder and engine setting runs into anything soon, take the clear setting
  // nearest to it (slower first, then astern), or the one that stays clear longest
  if (!careless) {
    const need = Math.min(4.5, 1.6 + Math.abs(s.v) * 1.8);
    if (clearFor(w, rud, t, need) < need) {
      const rudders = [-1, -0.5, 0, 0.5, 1].sort((a, b) => Math.abs(a - rud) - Math.abs(b - rud));
      const teles = [t, 3, 1, 0, 2].filter((x, i, a) => x <= Math.max(t, 2) && a.indexOf(x) === i); // astern before a dead stop, to get out of tight spots
      let pick = null, longest = -1, fallback = null;
      for (const tl of teles) {
        for (const r of rudders) {
          const c = clearFor(w, r, tl, need);
          if (c >= need) { pick = [r, tl]; break; }
          if (c > longest) { longest = c; fallback = [r, tl]; }
        }
        if (pick) break;
      }
      const ch = pick || fallback;
      rud = ch[0]; t = ch[1];
    }
  }
  steer(w, rud);
  tele(w, t);
}

function play(level, seed, who) {
  const w = new HM.World(level, seed, 1.6), st = { t: 0 };
  let i = 0;
  while (!w.over && w.t < LIMIT) {
    if (who !== 'idle' && i % 2 === 0) captain(w, who === 'careless', st);
    w.step(); w.events.length = 0; i++;
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
      if (w.delivered >= HM.STARS[0]) star++;
      if (!w.over) endless++;
      const why = w.reason === 'crash' ? 'crash-' + w.crash.kind : w.reason || 'running';
      reasons[why] = (reasons[why] || 0) + 1;
    }
    res[who][level] = { avg: sum / RUNS, star: star / RUNS };
    console.log(who.padEnd(8), level.padEnd(9), 'crates avg', (sum / RUNS).toFixed(1).padStart(6), 'best', String(best).padStart(4), 'first star', (100 * star / RUNS).toFixed(0).padStart(3) + '%',
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
