// ============================================================
//  CPU PLAYERS - run on the host only.
//  Nav: when a map loads, it's scanned into a graph of every spot you can stand on (1m grid)
//       and how to get between them: walk, crawl, drop, hop up, mantle, jump a gap, jump pad.
//  Bot: plans routes through that graph and drives a normal LocalPlayer with fake key presses,
//       so CPUs move with exactly the same physics as people.
//  Difficulty: easy   - slow to react, turns lazily, no mantles / gap jumps / pads
//              medium - mantles + pads, thinks twice a second
//              hard   - every move, rethinks 5x a second, leads its target, slides to close in,
//                       and flees toward spots it can reach before the chaser can
// ============================================================
const NAV_WALK = 0, NAV_CRAWL = 1, NAV_DROP = 2, NAV_JUMP = 3, NAV_MANTLE = 4, NAV_GAP = 5, NAV_PAD = 6, NAV_KICK = 7;
// moves: walk crawl drop jump mantle gap pad kick. Everyone sprints all the time.
const BOT_SKILL = {
//   hop: 0 never, 1 when chasing/fleeing, 2 always (run, jump, slide on landing, jump out - the fastest way to move)
//   smart: how much fleeing values escape routes and height
  easy:   { think: 0.6, turn: 8, moves: [1, 1, 1, 1, 1, 0, 1, 0], wobble: 0.25, lead: 0.1, slide: 0, charge: 4, hop: 0, smart: 0.3, look: 40 },
  medium: { think: 0.3, turn: 16, moves: [1, 1, 1, 1, 1, 1, 1, 1], wobble: 0.08, lead: 0.4, slide: 1, charge: 7, hop: 1, smart: 0.7, look: 60 },
  hard:   { think: 0.12, turn: 60, moves: [1, 1, 1, 1, 1, 1, 1, 1], wobble: 0, lead: 0.75, slide: 2, charge: 10, hop: 2, smart: 1, look: 90 },
};

const Nav = {
  nodes: [],        // { x, y, z, low, pad, e: [{ to, t, c }] }
  grid: new Map(),  // cell key -> node indices
  mapId: null,

  key(ix, iz) { return ix * 4099 + iz; },
  cellOf(x, z) { return [Math.round(x), Math.round(z)]; },

  build() {
    const t0 = performance.now(), M = CONFIG.move, W = World;
    this.nodes = [];
    this.grid = new Map();
    this.mapId = W.map.id;
    const solid = W.boxes.filter((b) => !b.mover);   // invisible walls count too: they block
    // bucket the boxes on a 4m grid so collision tests only look at nearby ones
    const B = 4, buckets = new Map(), bk = (ix, iz) => ix * 4099 + iz;
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const b of solid) {
      x0 = Math.min(x0, b.min.x); x1 = Math.max(x1, b.max.x); z0 = Math.min(z0, b.min.z); z1 = Math.max(z1, b.max.z);
      for (let ix = Math.floor(b.min.x / B); ix <= Math.floor(b.max.x / B); ix++) {
        for (let iz = Math.floor(b.min.z / B); iz <= Math.floor(b.max.z / B); iz++) {
          const k = bk(ix, iz);
          if (!buckets.has(k)) buckets.set(k, []);
          buckets.get(k).push(b);
        }
      }
    }
    for (const r of W.ramps) { x0 = Math.min(x0, r.x - r.w / 2); x1 = Math.max(x1, r.x + r.w / 2); z0 = Math.min(z0, r.z - r.d / 2); z1 = Math.max(z1, r.z + r.d / 2); }
    x0 = Math.max(x0, -90); x1 = Math.min(x1, 90); z0 = Math.max(z0, -90); z1 = Math.min(z1, 90);
    const R = M.radius, E = 1e-4;
    const near = (x, z) => {
      const out = [], seen = new Set();
      for (const [dx, dz] of [[-R, -R], [R, -R], [-R, R], [R, R]]) {
        const k = bk(Math.floor((x + dx) / B), Math.floor((z + dz) / B));
        if (!seen.has(k)) { seen.add(k); const l = buckets.get(k); if (l) out.push(l); }
      }
      return out;
    };
    const overlap = (x, y, z, h) => {
      for (const list of near(x, z)) for (const b of list) {
        if (x + R > b.min.x + E && x - R < b.max.x - E && z + R > b.min.z + E && z - R < b.max.z - E && y + h > b.min.y + E && y < b.max.y - E) {
          if (!b.rot || W._rotHit(b, x, z, R - E)) return true;
        }
      }
      // inside the solid part under a ramp (stairs, slides...)
      for (const r of W.ramps) {
        if (y + h <= r.base || !inFootprint(r, x, z, 0)) continue;
        if (y < rampHeight(r, x, z) - 0.15) return true;
      }
      return false;
    };
    const onRamp = (x, y, z) => W.ramps.some((r) => inFootprint(r, x, z, 0) && Math.abs(rampHeight(r, x, z) - y) < 0.05);
    this.overlap = overlap;

    // 1. nodes: every surface height at every grid point where a body fits
    const killY = W.map.killY;
    for (let x = Math.ceil(x0); x <= x1; x++) {
      for (let z = Math.ceil(z0); z <= z1; z++) {
        const ys = [];
        const l = buckets.get(bk(Math.floor(x / B), Math.floor(z / B))) || [];
        for (const b of l) {
          if (x >= b.min.x && x <= b.max.x && z >= b.min.z && z <= b.max.z && (!b.rot || W._rotHit(b, x, z, 0.01))) ys.push(b.max.y);
        }
        for (const r of W.ramps) if (inFootprint(r, x, z, 0)) ys.push(rampHeight(r, x, z));
        ys.sort((a, b) => a - b);
        let last = -Infinity;
        for (const y of ys) {
          if (y - last < 0.05 || y < killY + 1) continue;
          last = y;
          let low = false;
          if (overlap(x, y + 0.02, z, M.standHeight)) { if (overlap(x, y + 0.02, z, M.crouchHeight)) continue; low = true; }
          // a margin around pads, so routes only go onto a pad when they mean to launch
          const pad = W.pads.some((p) => Math.abs(x - p.x) < p.w / 2 + 0.6 && Math.abs(z - p.z) < p.d / 2 + 0.6 && Math.abs(y - p.y) < 0.3);
          const i = this.nodes.length;
          this.nodes.push({ x, y, z, low, pad, ramp: onRamp(x, y, z), e: [] });
          const k = this.key(x, z);
          if (!this.grid.has(k)) this.grid.set(k, []);
          this.grid.get(k).push(i);
        }
      }
    }

    // 2. edges
    const at = (x, z) => this.grid.get(this.key(x, z)) || [];
    const clear = (a, b, y, h) => {
      for (const t of [0.25, 0.5, 0.75]) if (overlap(a.x + (b.x - a.x) * t, y, a.z + (b.z - a.z) * t, h)) return false;
      return true;
    };
    const hasFloorNear = (x, z, y) => at(x, z).some((j) => this.nodes[j].y >= y - 1.0 && this.nodes[j].y <= y + 0.6);
    this.nodes.forEach((n, i) => {
      if (n.pad) return;   // stepping on a pad launches you: its only way out is the launch
      for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
        if (!dx && !dz) continue;
        for (const j of at(n.x + dx, n.z + dz)) {
          const m = this.nodes[j], dy = m.y - n.y, d = Math.hypot(dx, dz);
          const h = n.low || m.low ? M.crouchHeight : M.standHeight;
          // walking: small steps, or along a slope (but a slope can't walk you up onto a box edge)
          const hi = dy > 0 ? m : n;
          if (Math.abs(dy) <= (hi.ramp ? 0.85 * d : 0.45)) {
            if (clear(n, m, Math.max(n.y, m.y) + 0.02, h)) n.e.push({ to: j, t: n.low || m.low ? NAV_CRAWL : NAV_WALK, c: d * (n.low || m.low ? 1.3 : 1) });
          } else if (dy < 0 && dy > -12) {
            // the whole fall has to be open, not just the step off the edge
            if (clear(n, m, n.y + 0.02, h) && !overlap(m.x, m.y + 0.02, m.z, n.y - m.y + h)) n.e.push({ to: j, t: NAV_DROP, c: d + 0.3 - dy * 0.05 });
          } else if (dy > 0 && dy <= 1.3) {
            if (!n.low && !overlap(n.x, n.y + 0.02, n.z, M.standHeight + dy + 0.2) && clear(n, m, m.y + 0.05, M.standHeight)) n.e.push({ to: j, t: NAV_JUMP, c: d + 1.2 });
          } else if (dy > 1.3 && dy <= M.mantleMaxHeight + 1.35) {
            if (!n.low && !overlap(n.x, n.y + 0.02, n.z, M.standHeight + 1.6) && !overlap(m.x, m.y + 0.02, m.z, M.crouchHeight)) n.e.push({ to: j, t: NAV_MANTLE, c: d + 3 });
          }
        }
      }
      // running jumps across gaps, along the 8 directions
      if (n.low) return;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const maxK = dx && dz ? 3 : 4;
        if (hasFloorNear(n.x + dx, n.z + dz, n.y)) continue;   // not at an edge in this direction
        for (let k = 2; k <= maxK; k++) {
          const cx = n.x + dx * k, cz = n.z + dz * k;
          const land = at(cx, cz).find((j) => { const dy = this.nodes[j].y - n.y; return dy <= 0.5 && dy >= -5 && !this.nodes[j].low; });
          if (land === undefined) { if (hasFloorNear(cx, cz, n.y)) break; continue; }
          const m = this.nodes[land];
          let ok = !overlap(m.x, m.y + 0.02, m.z, Math.max(0, n.y - m.y) + M.standHeight);
          for (let s = 1; s < k && ok; s++) if (overlap(n.x + dx * s, Math.max(n.y, m.y) + 0.4, n.z + dz * s, M.standHeight)) ok = false;
          if (ok) n.e.push({ to: land, t: NAV_GAP, c: Math.hypot(dx, dz) * k + 2 });
          break;
        }
      }
    });
    // two-wall kick chimneys: a floor spot between two walls 2.3-3.6m apart that rise well above
    // it -> edges to the spots you can climb out onto at the top
    const wallDist = (n, dx, dz, maxD) => {
      for (let t = 0.4; t <= maxD; t += 0.2) if (overlap(n.x + dx * (t - R), n.y + 1.0, n.z + dz * (t - R), 0.6)) return t;
      return -1;
    };
    const wallTop = (x, z, y0) => { let y = y0; while (y < y0 + 16 && overlap(x, y, z, 0.8)) y += 0.8; return y; };
    this.nodes.forEach((n) => {
      if (n.low || n.pad || overlap(n.x, n.y + 0.02, n.z, 3.2)) return;   // needs open air above
      for (const [dx, dz] of [[1, 0], [0, 1]]) {
        const a = wallDist(n, dx, dz, 2.4), b = wallDist(n, -dx, -dz, 2.4);
        if (a < 0 || b < 0 || a + b < 2.3 || a + b > 3.6) continue;
        // the lower wall's top, but never above whatever roof is over the chimney itself
        let top = Math.min(wallTop(n.x + dx * (a + 0.15), n.z + dz * (a + 0.15), n.y + 1.0), wallTop(n.x - dx * (b + 0.15), n.z - dz * (b + 0.15), n.y + 1.0));
        if (top - n.y < 2.4) continue;
        let ceil = n.y + 3.2;
        while (ceil < top + M.standHeight && !overlap(n.x, ceil, n.z, 0.4)) ceil += 0.4;
        top = Math.min(top, ceil - M.standHeight);
        if (top - n.y < 2.4) continue;
        for (let ox = -3; ox <= 3; ox++) for (let oz = -3; oz <= 3; oz++) {
          for (const j of at(n.x + ox, n.z + oz)) {
            const m = this.nodes[j];
            if (m.low || m.y < n.y + 2.2 || m.y > top + 0.6) continue;
            n.e.push({ to: j, t: NAV_KICK, c: 3 + (m.y - n.y) * 0.5 + Math.hypot(ox, oz) * 0.5, k: [dx, dz] });
          }
        }
      }
    });
    // escape value: how many different spots you can reach in two moves from each spot
    for (const n of this.nodes) {
      const seen = new Set();
      for (const e of n.e) { seen.add(e.to); for (const e2 of this.nodes[e.to].e) seen.add(e2.to); }
      n.open = seen.size;
    }
    // jump pads: simulate one launch to see where it lands
    for (const pd of W.pads) {
      const src = this.nodes.findIndex((n) => n.pad && Math.abs(n.x - pd.x) <= pd.w / 2 + 0.6 && Math.abs(n.z - pd.z) <= pd.d / 2 + 0.6);
      if (src < 0) continue;
      const p = new LocalPlayer();
      p.teleport([pd.x, pd.y + 0.05, pd.z]);
      const idle = { f: 0, r: 0, run: false, crouch: false };
      for (let s = 0; s < 360; s++) { p.step(1 / 120, idle); if (s > 30 && p.grounded) break; }
      const to = this.nearest(p.pos, 2);
      for (const n of this.nodes) if (n.pad && Math.abs(n.x - pd.x) <= pd.w / 2 + 0.6 && Math.abs(n.z - pd.z) <= pd.d / 2 + 0.6 && to >= 0) n.e.push({ to, t: NAV_PAD, c: 3, pad: [pd.x, pd.z] });
    }
    this.ms = Math.round(performance.now() - t0);
  },

  // closest node to a position (searches nearby cells), -1 if none within `reach` cells
  nearest(pos, reach = 3) {
    const [cx, cz] = this.cellOf(pos.x, pos.z);
    let best = -1, bd = Infinity;
    for (let dx = -reach; dx <= reach; dx++) for (let dz = -reach; dz <= reach; dz++) {
      for (const j of this.grid.get(this.key(cx + dx, cz + dz)) || []) {
        const n = this.nodes[j], dy = n.y - pos.y;
        const d = Math.hypot(n.x - pos.x, n.z - pos.z) + (dy > 0.6 ? dy * 3 : -dy * 0.7);
        if (d < bd) { bd = d; best = j; }
      }
    }
    return best;
  },

  // Dijkstra from one or more start nodes (all with cost 0), using only `moves`. Stops at maxCost.
  search(starts, moves, maxCost = Infinity, ban = null) {
    const N = this.nodes.length, dist = new Float64Array(N).fill(Infinity), prev = new Int32Array(N).fill(-1), via = new Int8Array(N).fill(-1);
    const heap = [];
    const push = (i, d) => { heap.push([d, i]); let k = heap.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (heap[p][0] <= heap[k][0]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let s = k; if (l < heap.length && heap[l][0] < heap[s][0]) s = l; if (r < heap.length && heap[r][0] < heap[s][0]) s = r; if (s === k) break; [heap[s], heap[k]] = [heap[k], heap[s]]; k = s; } } return top; };
    for (const s of starts) if (s >= 0) { dist[s] = 0; push(s, 0); }
    while (heap.length) {
      const [d, i] = pop();
      if (d > dist[i] || d > maxCost) continue;
      for (const e of this.nodes[i].e) {
        if (!moves[e.t] || (ban && ban.has(i * 65536 + e.to))) continue;
        const nd = d + e.c;
        if (nd < dist[e.to]) { dist[e.to] = nd; prev[e.to] = i; via[e.to] = e.t; push(e.to, nd); }
      }
    }
    return { dist, prev, via };
  },
  // node path (and the move used to reach each node) from a search result
  trace(res, goal) {
    const path = [], types = [];
    for (let i = goal; i >= 0; i = res.prev[i]) { path.push(i); types.push(res.via[i]); }
    return { path: path.reverse(), types: types.reverse() };
  },
  // test-run a hop or mantle once with the real physics (the result is remembered on the edge)
  check(n, m) {
    const tp = this._tp || (this._tp = new LocalPlayer()), idle = { f: 0, r: 0, run: false, crouch: false }, go = { f: 1, r: 0, run: true, crouch: false };
    const dx = m.x - n.x, dz = m.z - n.z;
    tp.teleport([n.x - dx * 0.4, n.y + 0.02, n.z - dz * 0.4], Math.atan2(-dx, -dz));
    for (let s = 0; s < 6; s++) tp.step(1 / 120, idle);
    let jumped = false;
    for (let s = 0; s < 170; s++) {
      if (!jumped && Math.hypot(m.x - tp.pos.x, m.z - tp.pos.z) < 1.4) { tp.queueJump(); jumped = true; }
      if (!tp.grounded && tp.wall) tp.yaw = Math.atan2(tp.wall.n.x, tp.wall.n.z);
      tp.step(1 / 120, go);
      if (tp.grounded && Math.abs(tp.pos.y - m.y) < 0.3 && Math.hypot(m.x - tp.pos.x, m.z - tp.pos.z) < 1.1) return true;
      if (tp.pos.y < Math.min(n.y, m.y) - 1.5) return false;
    }
    return false;
  },
  // the edge used between two consecutive path nodes (for kick directions)
  edge(from, to, t) { return this.nodes[from].e.find((e) => e.to === to && e.t === t); },
  // is the straight line between two points clear at body height? (for charging straight at someone)
  lineClear(a, b) {
    const d = Math.hypot(b.x - a.x, b.z - a.z), n = Math.ceil(d / 0.8);
    for (let i = 1; i < n; i++) {
      const t = i / n;
      if (this.overlap(a.x + (b.x - a.x) * t, Math.max(a.y, b.y) + 0.3, a.z + (b.z - a.z) * t, 1.4)) return false;
    }
    return true;
  },
};

class Bot {
  constructor(id, diff) {
    this.id = id;
    this.diff = BOT_SKILL[diff] ? diff : 'medium';
    this.skill = BOT_SKILL[this.diff];
    this.p = new LocalPlayer();
    this.inp = { f: 0, r: 0, run: true, crouch: false };
    this.route = null;      // { path, types }
    this.pi = 0;
    this.thinkT = Math.random() * 0.3;
    this.stuckT = 0;
    this.lastProgress = Infinity;
    this.wobble = 0;
    this.slideT = 0;
    this.goalKey = '';
    this.bans = new Map();   // moves that got us stuck: edge key -> until when
  }

  // goal: { type: 'chase', pos, vel } | { type: 'flee', from: [pos...] } | { type: 'go', pos } | { type: 'wander' } | { type: 'idle' }
  think(goal, dt) {
    this.thinkT -= dt;
    this.goal = goal;
    if (this.thinkT > 0 && this.route && this.pi < this.route.path.length) return;
    if (!this.p.grounded && this.route && this.pi < this.route.path.length && this.thinkT > -1.5) return;   // finish the jump / climb first
    this.thinkT = this.skill.think * (0.8 + Math.random() * 0.4);
    if (!Nav.nodes.length || goal.type === 'idle') { this.route = null; return; }
    const here = Nav.nearest(this.p.pos);
    if (here < 0) { this.route = null; return; }
    const moves = this.skill.moves;
    const now = performance.now(), ban = new Set();
    for (const [k, t] of this.bans) { if (t < now) this.bans.delete(k); else ban.add(k); }
    if (goal.type === 'chase' || goal.type === 'go') {
      const tp = goal.pos, lead = goal.vel ? this.skill.lead : 0;
      const aim = { x: tp.x + (goal.vel ? goal.vel.x * lead : 0), y: tp.y, z: tp.z + (goal.vel ? goal.vel.z * lead : 0) };
      let to = Nav.nearest(aim, 4);
      if (to < 0) to = Nav.nearest(tp, 6);
      if (to < 0) { this.route = null; return; }
      const res = Nav.search([here], moves, 400, ban);
      if (res.dist[to] === Infinity) {
        // can't get there: go to the reachable spot closest to it
        let best = -1, bd = Infinity;
        const goalN = Nav.nodes[to];
        for (let i = 0; i < Nav.nodes.length; i++) {
          if (res.dist[i] === Infinity) continue;
          const n = Nav.nodes[i], d = Math.hypot(n.x - goalN.x, (n.y - goalN.y) * 1.5, n.z - goalN.z);
          if (d < bd) { bd = d; best = i; }
        }
        to = best;
      }
      if (to >= 0) this.setRoute(Nav.trace(res, to));
    } else if (goal.type === 'flee') {
      // the chaser's travel time to everywhere vs. ours: run to a spot we reach well before them,
      // as far from them as possible (hard bots look further and value spots with many exits)
      // Pick a spot we reach well before them, far from them, with lots of ways out (no corners),
      // high up while they're far away (then drop off when they come), and keep moving: never
      // settle on the spot we're already on.
      const threats = goal.from.map((q) => Nav.nearest(q, 4)).filter((i) => i >= 0);
      const theirs = Nav.search(threats, BOT_SKILL.hard.moves, 150), mine = Nav.search([here], moves, this.skill.look, ban);
      const sk = this.skill, myN = Nav.nodes[here];
      const hereT = theirs.dist[here] === Infinity ? 150 : theirs.dist[here];
      const closeIn = hereT < 14;   // they're on us: getting away beats getting high
      let best = -1, bs = -Infinity;
      for (let i = 0; i < Nav.nodes.length; i++) {
        const m = mine.dist[i];
        if (m === Infinity || m < 4) continue;
        const n = Nav.nodes[i], t = theirs.dist[i] === Infinity ? 150 : theirs.dist[i];
        if (m > t * 0.8) continue;   // they'd get there first
        let s = t - m * 0.55;
        s += Math.min(n.open, 40) * 0.25 * sk.smart;                      // escape routes
        if (!closeIn) s += Math.max(0, n.y - myN.y) * 0.9 * sk.smart;     // height while it's safe
        else s += Math.max(0, myN.y - n.y) * 0.4 * sk.smart;              // drop away when they're close
        s += Math.random() * 3;
        if (s > bs) { bs = s; best = i; }
      }
      // nowhere clearly better: just keep moving away
      if (best < 0) {
        for (let i = 0; i < Nav.nodes.length; i++) {
          const m = mine.dist[i], t = theirs.dist[i] === Infinity ? 150 : theirs.dist[i];
          if (m === Infinity || m < 4) continue;
          const sc = t - m * 0.3 + Math.random() * 2;
          if (sc > bs) { bs = sc; best = i; }
        }
      }
      if (best >= 0) this.setRoute(Nav.trace(mine, best));
    } else {
      // wander: somewhere reachable, not too far
      const res = Nav.search([here], moves, 30, ban);
      const opts = [];
      for (let i = 0; i < Nav.nodes.length; i++) if (res.dist[i] > 8 && res.dist[i] < 30) opts.push(i);
      if (opts.length) this.setRoute(Nav.trace(res, opts[Math.floor(Math.random() * opts.length)]));
    }
  }
  // is the path ahead a clear, flat, straight-ish run with headroom (safe to bunny hop)?
  hopRun() { return this.straightAhead() >= 7; }
  // how many meters of clear, flat, straight running are ahead on the route (with headroom)
  straightAhead() {
    const R = this.route, p = this.p;
    if (!R) return 0;
    let len = 0;
    for (let k = 1; k <= 10 && this.pi + k < R.path.length; k++) {
      const end = Nav.nodes[R.path[this.pi + k]], t = R.types[this.pi + k];
      if ((t !== NAV_WALK && t !== NAV_DROP) || end.low || Math.abs(end.y - p.pos.y) > 0.5) break;
      const ex = end.x - p.pos.x, ez = end.z - p.pos.z, el = Math.hypot(ex, ez);
      let ok = true;
      for (let j = 0; j <= k && ok; j++) {
        const n = Nav.nodes[R.path[this.pi + j]];
        if (el > 0.1 && Math.abs((n.x - p.pos.x) * ez - (n.z - p.pos.z) * ex) / el > 1.0) ok = false;
      }
      if (!ok) break;
      const steps = Math.ceil(el / 0.7);
      for (let i = 1; i <= steps && ok; i++) if (Nav.overlap(p.pos.x + ex * i / steps, p.pos.y + 0.3, p.pos.z + ez * i / steps, CONFIG.move.standHeight + 1.5)) ok = false;
      if (!ok) break;
      len = el;
    }
    return len;
  }
  // steer at the furthest waypoint ahead we can run straight to (smooth, fast lines)
  aimAhead() {
    const R = this.route, p = this.p;
    let best = this.pi;
    for (let k = 1; k <= 5 && this.pi + k < R.path.length; k++) {
      const t = R.types[this.pi + k];
      if (t !== NAV_WALK && t !== NAV_CRAWL) break;
      const n = Nav.nodes[R.path[this.pi + k]];
      if (Math.abs(n.y - p.pos.y) > 0.5 || !Nav.lineClear(p.pos, n)) break;
      best = this.pi + k;
    }
    return Nav.nodes[R.path[best]];
  }
  setRoute(r) {
    // make sure every hop / mantle on the way really works (checked once, then remembered)
    for (let k = 1; k < r.path.length; k++) {
      const t = r.types[k];
      if (t !== NAV_MANTLE && t !== NAV_JUMP) continue;
      const a = r.path[k - 1], b = r.path[k], e = Nav.edge(a, b, t);
      if (!e) continue;
      if (e.ok === undefined) e.ok = Nav.check(Nav.nodes[a], Nav.nodes[b]);
      if (!e.ok) {
        Nav.nodes[a].e = Nav.nodes[a].e.filter((x) => x !== e);
        this.route = null;
        this.thinkT = 0;
        return;
      }
    }
    this.route = r;
    this.pi = Math.min(1, r.path.length - 1);
    this.stuckT = 0;
    this.lastProgress = Infinity;
  }

  // fake key presses for this frame
  drive(dt, frozen) {
    const p = this.p, inp = this.inp, sk = this.skill;
    inp.f = 0; inp.r = 0; inp.run = true; inp.crouch = false;
    if (frozen || !this.goal || this.goal.type === 'idle') { this.moveLog = null; return inp; }
    // really stuck (barely moved in 2.5s while trying to)? ban the move we keep failing and go elsewhere
    const now = performance.now();
    if (!this.moveLog || now - this.moveLog.t > 2500) {
      if (this.moveLog && Math.hypot(p.pos.x - this.moveLog.x, p.pos.y - this.moveLog.y, p.pos.z - this.moveLog.z) < 1.2 && this.route && this.pi < this.route.path.length) {
        const R = this.route;
        if (this.pi > 0) this.bans.set(R.path[this.pi - 1] * 65536 + R.path[this.pi], now + 20000);
        for (let k = 1; k < 4 && this.pi + k < R.path.length; k++) if (R.types[this.pi + k] === NAV_MANTLE || R.types[this.pi + k] === NAV_KICK) this.bans.set(R.path[this.pi + k - 1] * 65536 + R.path[this.pi + k], now + 20000);
        this.route = null;
        this.thinkT = 0;
      }
      this.moveLog = { t: now, x: p.pos.x, y: p.pos.y, z: p.pos.z };
    }
    let tx, tz, ty, type = NAV_WALK, next = null;
    const g = this.goal;
    // the one we're chasing is close, level and in the open: charge straight at them
    const gd = g.type === 'chase' ? Math.hypot(g.pos.x - p.pos.x, g.pos.z - p.pos.z) : Infinity;
    this.losT = (this.losT || 0) - dt;
    if (gd < sk.charge && this.losT <= 0) { this.los = Math.abs(g.pos.y - p.pos.y) < 1.2 && Nav.lineClear(p.pos, g.pos); this.losT = 0.15; }
    if (gd < 2.5 && Math.abs(g.pos.y - p.pos.y) < 1.4 || (gd < sk.charge && this.los)) {
      const lead = g.vel ? sk.lead * Math.min(gd / 8, 1) : 0;
      tx = g.pos.x + (g.vel ? g.vel.x * lead : 0); tz = g.pos.z + (g.vel ? g.vel.z * lead : 0); ty = g.pos.y;
    } else if (this.route) {
      const R = this.route;
      // advance along the path
      while (this.pi < R.path.length) {
        const n = Nav.nodes[R.path[this.pi]];
        const dh = Math.hypot(n.x - p.pos.x, n.z - p.pos.z);
        if (dh < (R.types[this.pi] === NAV_GAP ? 0.9 : 0.6) && Math.abs(n.y - p.pos.y) < 1.1) this.pi++;
        else break;
      }
      if (this.pi >= R.path.length) { this.route = null; this.thinkT = 0; return inp; }
      // too long on one waypoint: skip it if we're basically there, otherwise give up on that move
      if (this.wpI !== this.pi) { this.wpI = this.pi; this.wpT = 0; }
      this.wpT += dt;
      if (this.wpT > 3) {
        const w = Nav.nodes[R.path[this.pi]];
        if (Math.hypot(w.x - p.pos.x, w.z - p.pos.z) < 1.2 && Math.abs(w.y - p.pos.y) < 0.6) { this.pi++; this.wpT = 0; if (this.pi >= R.path.length) { this.route = null; return inp; } }
        else { if (this.pi > 0) this.bans.set(R.path[this.pi - 1] * 65536 + R.path[this.pi], performance.now() + 15000); this.route = null; this.thinkT = 0; return inp; }
      }
      next = Nav.nodes[R.path[this.pi]];
      type = R.types[this.pi];
      tx = next.x; tz = next.z; ty = next.y;
      if ((type === NAV_WALK || type === NAV_CRAWL) && p.grounded) { const a = this.aimAhead(); tx = a.x; tz = a.z; }
      // kick chimney: face a wall, jump, then keep kicking off whichever wall we touch toward
      // the other one until we're high enough to pull out onto the exit
      if (type === NAV_KICK && p.pos.y < next.y - 0.9) {
        const from = Nav.nodes[R.path[this.pi - 1]], e = from && Nav.edge(R.path[this.pi - 1], R.path[this.pi], NAV_KICK);
        if (from && e) {
          if (p.grounded) {
            const fx = from.x - p.pos.x, fz = from.z - p.pos.z;
            if (Math.hypot(fx, fz) > 0.7) { p.yaw = Math.atan2(-fx, -fz); inp.f = 1; return inp; }
            p.yaw = Math.atan2(-e.k[0], -e.k[1]);
            inp.f = 1;
            p.queueJump();
          } else if (p.wall) {
            p.yaw = Math.atan2(-p.wall.n.x, -p.wall.n.z);
            inp.f = 1;
            if (p.kickCd <= 0 && p.vel.y < 3) p.queueJump();
          } else inp.f = 1;
          this.stuckT = 0;
          return inp;
        }
      }
    } else return inp;

    // face the target (lazy turning for weaker bots, plus a little wobble)
    const dx = tx - p.pos.x, dz = tz - p.pos.z, dist = Math.hypot(dx, dz);
    this.wobble += (Math.random() - 0.5) * sk.wobble * dt * 6;
    this.wobble *= Math.exp(-dt * 2);
    const want = Math.atan2(-dx, -dz) + this.wobble;
    let d = ((want - p.yaw + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
    p.yaw += Math.max(-sk.turn * dt, Math.min(sk.turn * dt, d));
    d = Math.abs(((want - p.yaw + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI);
    inp.f = d < 1.6 ? 1 : 0;
    if (dist < 0.25 && type !== NAV_MANTLE) inp.f = 0;

    // in the air on a drop or gap: steer onto the landing and brake right over it
    if ((type === NAV_DROP || type === NAV_GAP) && !p.grounded && next) {
      const ahead = (p.vel.x * dx + p.vel.z * dz) / Math.max(dist, 0.1);
      if (dist < 0.6 || (ahead > 0 && dist / Math.max(ahead, 0.1) < 0.12)) inp.f = -1;
    }
    if (type === NAV_DROP && next && this.pi > 0) {
      const from = Nav.nodes[this.route.path[this.pi - 1]];
      // big drop: come to a near stop at the edge, then step off, so we land where we meant to
      if (from && from.y - next.y > 1.2 && p.grounded) { inp.run = false; if (dist < 2.2 && p.hspeed() > 2.5) inp.f = 0; }
    }
    // a pad: walk to its middle, then let it carry us (the landing was worked out without steering)
    if (type === NAV_PAD) {
      const e = Nav.edge(this.route.path[this.pi - 1], this.route.path[this.pi], NAV_PAD);
      if (!p.grounded) inp.f = 0;
      else if (e && e.pad) { p.yaw = Math.atan2(-(e.pad[0] - p.pos.x), -(e.pad[1] - p.pos.z)); inp.f = 1; inp.run = false; }
    }
    // mantles and hops: square up to the wall once we're touching it
    if ((type === NAV_MANTLE || type === NAV_JUMP) && !p.grounded && p.wall) { p.yaw = Math.atan2(p.wall.n.x, p.wall.n.z); inp.f = 1; }
    // moves
    if (next && (next.low || type === NAV_CRAWL || (Nav.nearest(p.pos, 1) >= 0 && Nav.nodes[Nav.nearest(p.pos, 1)].low))) inp.crouch = true;
    if (p.grounded && d < 0.5) {
      if ((type === NAV_JUMP || type === NAV_MANTLE) && dist < 1.4) p.queueJump();
      if (type === NAV_GAP) {
        const from = Nav.nodes[this.route.path[this.pi - 1]];
        const L = from ? Math.hypot(next.x - from.x, next.z - from.z) : 2;
        // need a running start: if we're slow, back up along the run-up first
        if (p.hspeed() < 6.5 && L > 2.5 && from && Math.hypot(from.x - p.pos.x, from.z - p.pos.z) < 1.2) { p.yaw += Math.PI; inp.f = 1; this.backT = 0.35; }
        else if (dist < L - 0.35) p.queueJump();
      }
    }
    // slides: for the speed boost on straight runs (and hard ones hop out of them to keep it)
    this.slideT -= dt;
    const ahead = this.route ? this.straightAhead() : 0;
    const straight = ahead >= 5 && !(this.hop && ahead >= 7);
    if (sk.slide && p.grounded && !p.sliding && this.slideT <= 0 && p.hspeed() > 8.5 && d < 0.3 && (straight || (g.type === 'chase' && gd > 2.5 && gd < 7))) {
      inp.crouch = true;
      this.slideT = 1.4;
    } else if (p.sliding && this.slideT > 0.8) inp.crouch = true;
    else if (p.sliding && sk.slide > 1 && p.grounded && this.slideT > 0.5 && this.slideT < 0.8) p.queueJump();

    // bunny hop: on a clear flat run, jump, crouch as we land (slide boost), jump out of the slide,
    // repeat - faster than running
    const hopping = sk.hop === 2 || (sk.hop === 1 && (g.type === 'chase' || g.type === 'flee'));
    if (hopping && next && this.route && this.hopRun()) {
      if (p.grounded && !p.sliding && p.hspeed() > 8.5 && d < 0.3) { p.queueJump(); this.hop = 1; this.hopSlide = 0; }
      else if (!p.grounded && this.hop && p.vel.y < 1) inp.crouch = true;                  // land crouched -> slide
      else if (p.grounded && p.sliding && this.hop) {
        inp.crouch = true;
        this.hopSlide += dt;
        if (this.hopSlide > 0.1) { p.queueJump(); this.hopSlide = 0; }                         // and jump straight out of it
      }
    } else if (p.grounded && !p.sliding) this.hop = 0;
    // stuck? hop, then rethink
    const prog = dist;
    if (prog < this.lastProgress - 0.15) { this.lastProgress = prog; this.stuckT = 0; }
    else this.stuckT += dt;
    if (this.stuckT > 0.7 && p.grounded) p.queueJump();
    if (this.stuckT > 1.6) {
      if (this.route && this.pi > 0) this.bans.set(this.route.path[this.pi - 1] * 65536 + this.route.path[this.pi], performance.now() + 12000);
      this.route = null; this.thinkT = 0; this.stuckT = 0; this.lastProgress = Infinity;
    }
    return inp;
  }
}
