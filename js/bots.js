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
const NAV_WALK = 0, NAV_CRAWL = 1, NAV_DROP = 2, NAV_JUMP = 3, NAV_MANTLE = 4, NAV_GAP = 5, NAV_PAD = 6;
const BOT_SKILL = {
  easy:   { think: 1.0, turn: 5, moves: [1, 1, 1, 1, 0, 0, 0], wobble: 0.35, lead: 0, slide: false },
  medium: { think: 0.5, turn: 10, moves: [1, 1, 1, 1, 1, 0, 1], wobble: 0.12, lead: 0.25, slide: false },
  hard:   { think: 0.2, turn: 40, moves: [1, 1, 1, 1, 1, 1, 1], wobble: 0, lead: 0.55, slide: true },
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
          const pad = W.pads.some((p) => Math.abs(x - p.x) < p.w / 2 + 0.1 && Math.abs(z - p.z) < p.d / 2 + 0.1 && Math.abs(y - p.y) < 0.3);
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
          if (Math.abs(dy) <= (n.ramp || m.ramp ? 0.85 * d : 0.45)) {
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
        const maxK = dx && dz ? 4 : 5;
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
    // jump pads: simulate one launch to see where it lands
    for (const pd of W.pads) {
      const src = this.nodes.findIndex((n) => n.pad && Math.abs(n.x - pd.x) <= pd.w / 2 + 0.1 && Math.abs(n.z - pd.z) <= pd.d / 2 + 0.1);
      if (src < 0) continue;
      const p = new LocalPlayer();
      p.teleport([pd.x, pd.y + 0.05, pd.z]);
      const idle = { f: 0, r: 0, run: false, crouch: false };
      for (let s = 0; s < 360; s++) { p.step(1 / 120, idle); if (s > 30 && p.grounded) break; }
      const to = this.nearest(p.pos, 2);
      for (const n of this.nodes) if (n.pad && Math.abs(n.x - pd.x) <= pd.w / 2 + 0.1 && Math.abs(n.z - pd.z) <= pd.d / 2 + 0.1 && to >= 0) n.e.push({ to, t: NAV_PAD, c: 3 });
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
  search(starts, moves, maxCost = Infinity) {
    const N = this.nodes.length, dist = new Float64Array(N).fill(Infinity), prev = new Int32Array(N).fill(-1), via = new Int8Array(N).fill(-1);
    const heap = [];
    const push = (i, d) => { heap.push([d, i]); let k = heap.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (heap[p][0] <= heap[k][0]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let s = k; if (l < heap.length && heap[l][0] < heap[s][0]) s = l; if (r < heap.length && heap[r][0] < heap[s][0]) s = r; if (s === k) break; [heap[s], heap[k]] = [heap[k], heap[s]]; k = s; } } return top; };
    for (const s of starts) if (s >= 0) { dist[s] = 0; push(s, 0); }
    while (heap.length) {
      const [d, i] = pop();
      if (d > dist[i] || d > maxCost) continue;
      for (const e of this.nodes[i].e) {
        if (!moves[e.t]) continue;
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
  }

  // goal: { type: 'chase', pos, vel } | { type: 'flee', from: [pos...] } | { type: 'go', pos } | { type: 'wander' } | { type: 'idle' }
  think(goal, dt) {
    this.thinkT -= dt;
    this.goal = goal;
    if (this.thinkT > 0 && this.route && this.pi < this.route.path.length) return;
    this.thinkT = this.skill.think * (0.8 + Math.random() * 0.4);
    if (!Nav.nodes.length || goal.type === 'idle') { this.route = null; return; }
    const here = Nav.nearest(this.p.pos);
    if (here < 0) { this.route = null; return; }
    const moves = this.skill.moves;
    if (goal.type === 'chase' || goal.type === 'go') {
      const tp = goal.pos, lead = goal.vel ? this.skill.lead : 0;
      const aim = { x: tp.x + (goal.vel ? goal.vel.x * lead : 0), y: tp.y, z: tp.z + (goal.vel ? goal.vel.z * lead : 0) };
      let to = Nav.nearest(aim, 4);
      if (to < 0) to = Nav.nearest(tp, 6);
      if (to < 0) { this.route = null; return; }
      const res = Nav.search([here], moves, 400);
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
      const threats = goal.from.map((q) => Nav.nearest(q, 4)).filter((i) => i >= 0);
      const theirs = Nav.search(threats, BOT_SKILL.hard.moves, 120), mine = Nav.search([here], moves, this.diff === 'hard' ? 70 : 40);
      let best = -1, bs = -Infinity;
      for (let i = 0; i < Nav.nodes.length; i++) {
        const m = mine.dist[i];
        if (m === Infinity || i === here) continue;
        const t = theirs.dist[i] === Infinity ? 140 : theirs.dist[i];
        if (m > t * 0.85) continue;   // they'd get there first
        let s = t - m * 0.6 + Math.random() * 2;
        if (this.diff === 'hard') s += Nav.nodes[i].e.length * 0.4;
        if (s > bs) { bs = s; best = i; }
      }
      if (best >= 0) this.setRoute(Nav.trace(mine, best));
    } else {
      // wander: somewhere reachable, not too far
      const res = Nav.search([here], moves, 30);
      const opts = [];
      for (let i = 0; i < Nav.nodes.length; i++) if (res.dist[i] > 8 && res.dist[i] < 30) opts.push(i);
      if (opts.length) this.setRoute(Nav.trace(res, opts[Math.floor(Math.random() * opts.length)]));
    }
  }
  setRoute(r) {
    this.route = r;
    this.pi = Math.min(1, r.path.length - 1);
    this.stuckT = 0;
    this.lastProgress = Infinity;
  }

  // fake key presses for this frame
  drive(dt, frozen) {
    const p = this.p, inp = this.inp, sk = this.skill;
    inp.f = 0; inp.r = 0; inp.run = true; inp.crouch = false;
    if (frozen || !this.goal || this.goal.type === 'idle') return inp;
    let tx, tz, ty, type = NAV_WALK, next = null;
    const g = this.goal;
    // close to the one we're chasing and roughly level: go straight at them
    if (g.type === 'chase' && Math.hypot(g.pos.x - p.pos.x, g.pos.z - p.pos.z) < 3.2 && Math.abs(g.pos.y - p.pos.y) < 1.2) {
      tx = g.pos.x; tz = g.pos.z; ty = g.pos.y;
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
      next = Nav.nodes[R.path[this.pi]];
      type = R.types[this.pi];
      tx = next.x; tz = next.z; ty = next.y;
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

    // moves
    if (next && (next.low || type === NAV_CRAWL || (Nav.nearest(p.pos, 1) >= 0 && Nav.nodes[Nav.nearest(p.pos, 1)].low))) inp.crouch = true;
    if (p.grounded && d < 0.5) {
      if ((type === NAV_JUMP || type === NAV_MANTLE) && dist < 1.4) p.queueJump();
      if (type === NAV_GAP) {
        const from = Nav.nodes[this.route.path[this.pi - 1]];
        const L = from ? Math.hypot(next.x - from.x, next.z - from.z) : 2;
        if (dist < L - 0.35) p.queueJump();
      }
    }
    // hard bots slide to close the last few meters (and keep their speed)
    this.slideT -= dt;
    if (sk.slide && g.type === 'chase' && p.grounded && !p.sliding && this.slideT <= 0 && p.hspeed() > 8.5 && dist > 2.5 && dist < 7 && Math.abs(ty - p.pos.y) < 0.5) {
      inp.crouch = true;
      this.slideT = 1.6;
    } else if (p.sliding && this.slideT > 1.0) inp.crouch = true;

    // stuck? hop, then rethink
    const prog = dist;
    if (prog < this.lastProgress - 0.15) { this.lastProgress = prog; this.stuckT = 0; }
    else this.stuckT += dt;
    if (this.stuckT > 0.7 && p.grounded) p.queueJump();
    if (this.stuckT > 1.6) { this.route = null; this.thinkT = 0; this.stuckT = 0; this.lastProgress = Infinity; }
    return inp;
  }
}
