// THE TEST LAB - a closed research facility in the white-panel test-chamber style.
// A 3x3 block of rooms, 56m across, on three heights (floor 0, mezzanines 4.4, balconies 8.8):
//   centre     the ATRIUM: a frosted-glass core you can't kick, crossed by bridges at 4.4 and 8.8
//              (one pair north-south, one east-west, offset so they cross over each other)
//   edges      four test halls, each with a mezzanine (4.4) and a balcony (8.8) on the atrium side:
//                N  laser hall   kick chimney + step blocks up, stairs on the mezzanine
//                S  lift hall    stairs up, a lift on the mezzanine, glass pillars to juke
//                E  glass hall   launch plate up, glass partitions, a kick chimney on the mezzanine
//                W  vault hall   floor lift up, vault walls + laser bars, launch plate on the mezzanine
//   corners    observation rooms (floor + upper room at 4.4), joined to both neighbours on both
//              levels; each has its own way up: NW stairs, NE kick chimney, SE plate, SW lift
// Frosted cyan glass ('nokick') can't be wall-kicked: it lets you see a chase but not shortcut it.
// Orange walls are kick routes. Glowing red bars: slide under (1.2m). Nothing hangs over a floor
// lower than 4m, and there is no void anywhere.
defineMap({
  id: 'lab',
  accent: ['#ff8a1f', '#2f8cff'],
  name: 'The Test Lab',
  blurb: 'A white test facility on three levels: glass you can\'t kick, laser bars, lifts and launch plates around a central atrium.',
  env: 'indoor',
  sky: '#15171c',
  fog: [60, 140],
  hemi: ['#ffffff', '#a6aebb', 1.5],
  sun: [0.8, 12, 60, 24],
  size: 30,
  spotHeight: 13.7,
  spots: [{ x: 0, z: 0 }, { x: 0, z: -19 }, { x: 0, z: 19 }, { x: -19, z: 0 }, { x: 19, z: 0 }],
  menuCam: { path: [[-8.5, 6.6, -5], [8.5, 6.6, -5]] },
  spawns: [
    [-6, 0, 5], [6, 0, -1], [2, 0, 9], [-2, 0, -8],
    [0, 0, -22], [2, 0, 22.5], [-22, 0, 0], [22, 0, 0],
    [-19, 0, -24], [19, 0, -24], [-19, 0, 24], [24, 0, 19],
    [-6, 4.4, -13], [6, 4.4, 13], [-13, 4.4, 6], [13, 4.4, 6],
    [-20, 4.4, -13], [13, 8.8, 2],
  ],
  seekerSpawn: [-6, 0, 5],

  build(k) {
    const PANEL = '#e8ebef', FLOOR = '#9da4ae', UPPER = '#c3c9d2', CEIL = '#f4f6f8', FRAME = '#30343c';
    const OR = '#ff8a1f', BL = '#2f8cff', LASER = { emissive: '#ff2a10' }, GLOW = { emissive: '#fff1c8' };
    const GLASS = { tex: 'nokick' }, KICK = { tex: 'kick' };
    const T = 0.5, L1 = 4.4, L2 = 8.8, TOP = 14;

    // fill a region with panels at most `step` long on each axis, so the outlines draw seams
    const panels = (x0, x1, y0, y1, z0, z1, col, o = {}, step = 8) => {
      const cuts = (a, b) => {
        const L = b - a;
        if (L < 1.01) return [[a, b]];
        const n = Math.max(1, Math.round(L / step)), out = [];
        for (let i = 0; i < n; i++) out.push([a + L * i / n, a + L * (i + 1) / n]);
        return out;
      };
      for (const [a0, a1] of cuts(x0, x1)) for (const [b0, b1] of cuts(y0, y1)) for (const [c0, c1] of cuts(z0, z1)) {
        k.box((a0 + a1) / 2, b0, (c0 + c1) / 2, a1 - a0, b1 - b0, c1 - c0, col, o);
      }
    };
    // a wall along ax ('x' or 'z') on line `at`, from a0 to a1, split around its doorways
    // holes: [{ c, w, y, h, frame, col }]
    const wall = (ax, at, a0, a1, y0, y1, holes) => {
      const br = [a0, a1];
      for (const h of holes) br.push(h.c - h.w / 2, h.c + h.w / 2);
      const pts = [...new Set(br.map((v) => Math.round(v * 1000) / 1000))].sort((p, q) => p - q);
      const put = (b0, b1, c0, c1) => {
        if (b1 - b0 < 0.01 || c1 - c0 < 0.01) return;
        if (ax === 'x') panels(b0, b1, c0, c1, at - T / 2, at + T / 2, PANEL, {}, 7);
        else panels(at - T / 2, at + T / 2, c0, c1, b0, b1, PANEL, {}, 7);
      };
      for (let i = 0; i < pts.length - 1; i++) {
        const b0 = pts[i], b1 = pts[i + 1], m = (b0 + b1) / 2;
        const hs = holes.filter((q) => m > q.c - q.w / 2 && m < q.c + q.w / 2).sort((p, q) => p.y - q.y);
        let y = y0;
        for (const h of hs) { put(b0, b1, y, h.y); y = h.y + h.h; }
        put(b0, b1, y, y1);
      }
      // dark door frames (a little deeper than the wall) with an accent stripe above
      for (const h of holes) {
        const f = 0.15, D = T + 0.1, col = h.col || OR;
        const em = { emissive: col === OR ? '#663000' : '#123a66' };
        if (ax === 'x') {
          k.box(h.c - h.w / 2 + f / 2, h.y, at, f, h.h, D, FRAME);
          k.box(h.c + h.w / 2 - f / 2, h.y, at, f, h.h, D, FRAME);
          k.box(h.c, h.y + h.h - f, at, h.w - 2 * f, f, D, FRAME);
          for (const s of [-1, 1]) k.deco(h.c, h.y + h.h + 0.25, at + s * (T / 2 + 0.03), h.w + 1, 0.3, 0.06, col, em);
        } else {
          k.box(at, h.y, h.c - h.w / 2 + f / 2, D, h.h, f, FRAME);
          k.box(at, h.y, h.c + h.w / 2 - f / 2, D, h.h, f, FRAME);
          k.box(at, h.y + h.h - f, h.c, D, f, h.w - 2 * f, FRAME);
          for (const s of [-1, 1]) k.deco(at + s * (T / 2 + 0.03), h.y + h.h + 0.25, h.c, 0.06, 0.3, h.w + 1, col, em);
        }
      }
    };
    // a laser bar to slide under (bottom 1.2) between two dark posts; along 'x' or 'z'
    const laser = (ax, x, z, len) => {
      if (ax === 'x') {
        k.box(x, 1.2, z, len - 0.5, 0.18, 0.14, '#ff3a1c', LASER);
        for (const s of [-1, 1]) k.box(x + s * (len / 2 - 0.125), 0, z, 0.25, 1.6, 0.3, FRAME);
      } else {
        k.box(x, 1.2, z, 0.14, 0.18, len - 0.5, '#ff3a1c', LASER);
        for (const s of [-1, 1]) k.box(x, 0, z + s * (len / 2 - 0.125), 0.3, 1.6, 0.25, FRAME);
      }
    };

    // ---------------- shell: floor, ceiling, outer walls, light strips ----------------
    panels(-28, 28, -0.5, 0, -28, 28, FLOOR);
    k.box(0, TOP, 0, 57, 0.5, 57, CEIL, { noShadow: true });
    wall('x', -28.25, -28.5, 28.5, 0, TOP, []);
    wall('x', 28.25, -28.5, 28.5, 0, TOP, []);
    wall('z', -28.25, -28, 28, 0, TOP, []);
    wall('z', 28.25, -28, 28, 0, TOP, []);
    for (const z of [-19, 19]) for (const s of [-1, 1]) k.deco(0, TOP - 0.06, z + s * 4, 50, 0.06, 0.4, '#fffdf5', GLOW);
    for (const x of [-19, 19]) for (const s of [-1, 1]) k.deco(x + s * 4, TOP - 0.06, 0, 0.4, 0.06, 30, '#fffdf5', GLOW);

    // ---------------- walls between the edge halls and the corner rooms ----------------
    // each has a floor doorway out in the hall (v 9-13) and an upper doorway at mezzanine level
    // (v 2.5-5.5, under the balcony)
    for (const sx of [-1, 1]) {
      // between N / S halls and the corners (lines x = +-10)
      for (const sz of [-1, 1]) {
        wall('z', sx * 10, sz < 0 ? -28 : 9.75, sz < 0 ? -9.75 : 28, 0, TOP, [
          { c: sz * 21, w: 4, y: 0, h: 3.2, col: sz < 0 ? OR : BL },
          { c: sz * 14, w: 3, y: L1, h: 3.2, col: sz < 0 ? OR : BL },
        ]);
        // between W / E halls and the corners (lines z = +-10), stopping at the walls above
        wall('x', sz * 10, sx < 0 ? -28 : 10.25, sx < 0 ? -10.25 : 28, 0, TOP, [
          { c: sx * 21, w: 4, y: 0, h: 3.2, col: sx < 0 ? BL : OR },
          { c: sx * 14, w: 3, y: L1, h: 3.2, col: sx < 0 ? BL : OR },
        ]);
      }
    }

    // ---------------- the four edge halls ----------------
    // local frame: u runs along the atrium side (-10..10), v goes outward from the atrium edge (0..18)
    const H = {
      N: { at: (u, v) => [u, -10 - v], up: '+z', along: '+x', push: (pu, pv) => ({ x: pu, z: -pv }) },
      S: { at: (u, v) => [u, 10 + v], up: '-z', along: '+x', push: (pu, pv) => ({ x: pu, z: pv }) },
      W: { at: (u, v) => [-10 - v, u], up: '+x', along: '+z', push: (pu, pv) => ({ x: -pv, z: pu }) },
      E: { at: (u, v) => [10 + v, u], up: '-x', along: '+z', push: (pu, pv) => ({ x: pv, z: pu }) },
    };
    const rect = (h, u0, u1, v0, v1) => {
      const [xa, za] = h.at(u0, v0), [xb, zb] = h.at(u1, v1);
      return [Math.min(xa, xb), Math.max(xa, xb), Math.min(za, zb), Math.max(za, zb)];
    };
    const lbox = (h, u0, u1, v0, v1, y, ht, col, o) => {
      const [x0, x1, z0, z1] = rect(h, u0, u1, v0, v1);
      k.box((x0 + x1) / 2, y, (z0 + z1) / 2, x1 - x0, ht, z1 - z0, col, o);
    };
    const ldeco = (h, u0, u1, v0, v1, y, ht, col, o) => {
      const [x0, x1, z0, z1] = rect(h, u0, u1, v0, v1);
      k.deco((x0 + x1) / 2, y, (z0 + z1) / 2, x1 - x0, ht, z1 - z0, col, o);
    };
    const lslab = (h, u0, u1, v0, v1, top, hole, col) => {
      const [x0, x1, z0, z1] = rect(h, u0, u1, v0, v1);
      slabHole(k, x0, x1, z0, z1, top, hole ? rect(h, ...hole) : null, col);
    };
    const lpos = (h, u, v) => h.at(u, v);

    // what every hall has: mezzanine 4.4 (v 0-7), balcony 8.8 (v 0-4), glass along the atrium side
    // (floor level: three panes with two wide gaps; mezzanine level: one long pane away from the bridge)
    const hallBase = (h, bridgeU, mezzHole, balcHole) => {
      lslab(h, -9.75, 9.75, 0, 7, L1, mezzHole, UPPER);
      lslab(h, -9.75, 9.75, 0, 4, L2, balcHole, UPPER);
      for (const [u0, u1] of [[-9.75, -6.5], [-1.5, 1.5], [6.5, 9.75]]) lbox(h, u0, u1, -0.15, 0.15, 0, L1 - 0.4, null, GLASS);
      if (bridgeU > 0) lbox(h, -9.75, -2.5, -0.15, 0.15, L1, L2 - L1 - 0.4, null, GLASS);
      else lbox(h, 2.5, 9.75, -0.15, 0.15, L1, L2 - L1 - 0.4, null, GLASS);
      // glowing accent edges on the mezzanine and balcony fronts
      ldeco(h, -9.75, 9.75, -0.05, -0.02, L1 - 0.3, 0.16, OR, { emissive: '#663000' });
      ldeco(h, -9.75, 9.75, -0.05, -0.02, L2 - 0.3, 0.16, BL, { emissive: '#123a66' });
      // ceiling light strips under the mezzanine
      for (const u of [-5, 5]) ldeco(h, u - 0.2, u + 0.2, 1, 6, L1 - 0.46, 0.06, '#fffdf5', GLOW);
    };

    // N - laser hall: kick chimney (with the corner wall) and step blocks up to the mezzanine,
    // laser bars and vaults on the floor, stairs on the mezzanine up to the balcony
    {
      const h = H.N;
      hallBase(h, 5, null, null);
      lbox(h, 6.3, 6.9, 7, 12, 0, L1, null, KICK);                 // chimney: this wall + the panel on the corner wall
      lbox(h, 9.55, 9.75, 7, 12, 0, L1, null, KICK);
      lbox(h, -9, -5, 7, 10, 0, 2.4, PANEL);                       // step blocks: 1.2 -> 2.4 -> pull up onto 4.4
      lbox(h, -9, -5, 10, 13, 0, 1.2, PANEL);
      const [lx, lz] = lpos(h, 0, 13);
      laser('x', lx, lz, 7);
      for (const u of [-5, 5]) lbox(h, u - 1.5, u + 1.5, 15.2, 16, 0, 1.0, OR);   // vault walls
      lbox(h, -1, 1, 16.5, 18, 0, 1.0, PANEL);
      const [sx, sz] = lpos(h, -4.4, 5.5);
      stairs(k, sx, sz, h.along, 3, L1, L2, BL);
    }
    // S - lift hall: stairs up to the mezzanine, a lift from the mezzanine to the balcony,
    // frosted glass pillars to juke around
    {
      const h = H.S;
      hallBase(h, 5, [3, 6.2, 4, 7], null);
      const [sx, sz] = lpos(h, -7.5, 7 + 7.7);
      stairs(k, sx, sz, h.up, 3, 0, L1, OR);
      const [mx, mz] = lpos(h, 4.6, 5.5);
      k.mover(mx, L1 - 0.4, mz, 3, 0.4, 2.8, BL, { type: 'slide', dy: L2 - L1, period: 7 });
      for (const [u, v] of [[-1, 11], [3, 9.5], [6.5, 13], [1.5, 15.5], [-4, 15]]) lbox(h, u - 0.7, u + 0.7, v - 0.7, v + 0.7, 0, TOP, null, GLASS);
      const [lx, lz] = lpos(h, 6, 10);
      laser('z', lx, lz, 4);
    }
    // E - glass hall: a launch plate up to the mezzanine, glass partitions on the floor,
    // a kick chimney from the mezzanine to the balcony
    {
      const h = H.E;
      hallBase(h, -5, null, null);
      const [px, pz] = lpos(h, 3, 11);
      k.pad(px, 0, pz, 1.6, 1.6, 17, { push: h.push(0, -4.2), color: BL });
      lbox(h, -6, -5.7, 9, 17, 0, TOP, null, GLASS);                // partitions: see through, can't pass or kick
      lbox(h, 0, 0.3, 13, 18, 0, TOP, null, GLASS);
      lbox(h, 6, 9.75, 15, 15.3, 0, TOP, null, GLASS);
      lbox(h, -9.75, -9.55, 4, 7, L1, L2 - L1, null, KICK);         // mezzanine chimney up to the balcony
      lbox(h, -6.9, -6.3, 4, 7, L1, L2 - L1, null, KICK);
      for (const u of [-3, 6]) lbox(h, u - 1, u + 1, 8.5, 10, 0, 1.0, OR);
    }
    // W - vault hall: a floor lift up to the mezzanine, vault walls and laser bars on the floor,
    // a launch plate on the mezzanine up to the balcony
    {
      const h = H.W;
      hallBase(h, -5, null, null);
      const [mx, mz] = lpos(h, -0.5, 8.7);
      k.mover(mx, 0, mz, 3, 0.4, 3, OR, { type: 'slide', dy: L1 - 0.4, period: 6 });
      for (const [u, v] of [[-6, 11], [5, 12.5], [-2, 16]]) lbox(h, u - 2, u + 2, v - 0.3, v + 0.3, 0, 1.0, BL);
      const [lx, lz] = lpos(h, 6, 9);
      laser('z', lx, lz, 5);
      const [l2x, l2z] = lpos(h, -6, 14.5);
      laser('z', l2x, l2z, 6);
      const [px, pz] = lpos(h, 5.5, 5.6);
      k.pad(px, L1, pz, 1.4, 1.4, 16.5, { push: h.push(0, -2.8), color: OR });
    }

    // ---------------- the atrium ----------------
    k.box(0, 0, 0, 4, TOP, 4, null, GLASS);                          // the core: frosted glass, unkickable
    k.deco(0, 0.01, 0, 6, 0.02, 6, BL, { emissive: '#123a66' });
    k.deco(0, 0.02, 0, 4.6, 0.02, 4.6, FLOOR);
    // bridges: 4.4 north-south at x = 5 and east-west at z = -5; 8.8 north-south at x = -5 and
    // east-west at z = 5 (each pair crosses at a shared square)
    const bridgeNS = (x, top, col) => slab(k, x, top, 0, 3.5, 20, col, { t: 0.4 });
    const bridgeEW = (z, top, cx, col) => {
      slab(k, (-10 + cx - 1.75) / 2, top, z, cx - 1.75 + 10, 3.5, col, { t: 0.4 });
      slab(k, (cx + 1.75 + 10) / 2, top, z, 10 - cx - 1.75, 3.5, col, { t: 0.4 });
    };
    bridgeNS(5, L1, UPPER);
    bridgeEW(-5, L1, 5, UPPER);
    bridgeNS(-5, L2, UPPER);
    bridgeEW(5, L2, -5, UPPER);
    for (const s of [-1, 1]) {
      k.deco(5 + s * 1.78, L1 - 0.3, 0, 0.04, 0.16, 20, OR, { emissive: '#663000' });
      k.deco(-5 + s * 1.78, L2 - 0.3, 0, 0.04, 0.16, 20, BL, { emissive: '#123a66' });
    }
    // floor: launch plates (onto the 4.4 bridges), vaults, a laser bar, juke posts
    k.pad(-8, 0, -9, 1.6, 1.6, 18, { push: { x: 0, z: 2.6 }, color: OR });
    k.pad(9, 0, 8, 1.6, 1.6, 18, { push: { x: -2.6, z: 0 }, color: OR });
    k.box(-7.5, 0, 2, 3, 1.0, 0.6, OR);
    k.box(7.5, 0, -1.5, 0.6, 1.0, 3, OR);
    laser('x', -2, 7.6, 4.5);
    laser('z', 7.7, 2.2, 3.2);
    for (const [x, z] of [[-4, -1.5], [3, 3.5]]) k.box(x, 0, z, 1, 3.2, 1, FRAME);

    // ---------------- corner observation rooms ----------------
    // floor room + upper room (4.4) with a hole for the way up
    const corner = (sx, sz, hole) => {
      const x0 = sx < 0 ? -28 : 10.25, x1 = sx < 0 ? -10.25 : 28, z0 = sz < 0 ? -28 : 10.25, z1 = sz < 0 ? -10.25 : 28;
      slabHole(k, x0, x1, z0, z1, L1, hole, UPPER);
      // big window into the void-less night outside: a glowing panel on the outer wall
      k.deco(sx * 27.97, L1 + 2, (z0 + z1) / 2, 0.06, 3, 8, '#2a3a4c', { emissive: '#0a1420' });
      for (const s of [-1, 1]) k.deco((x0 + x1) / 2 + s * 4, L1 - 0.46, (z0 + z1) / 2, 0.4, 0.06, 12, '#fffdf5', GLOW);
    };
    // NW: stairs up through the floor
    corner(-1, -1, [-24.8, -16.2, -20.8, -17.2]);
    stairs(k, -24, -19, '+x', 3, 0, L1, BL);
    // NE: kick chimney in a shaft (walls 3m apart), climb out onto the upper room
    corner(1, -1, [17, 21.3, -21.5, -16.5]);
    k.box(17.3, 0, -19, 0.6, L1, 5, null, KICK);
    k.box(21, 0, -19, 0.6, L1, 5, null, KICK);
    // SE: launch plate under a hole
    corner(1, 1, [17.5, 21.5, 17.5, 21.5]);
    k.pad(19.5, 0, 19.5, 1.6, 1.6, 15.5, { push: { x: 0, z: -3.4 }, color: BL });
    // SW: lift through the floor
    corner(-1, 1, [-21.1, -17.9, 17.9, 21.1]);
    k.mover(-19.5, 0, 19.5, 3, 0.4, 3, OR, { type: 'slide', dy: L1 - 0.4, period: 6, phase: 0.5 });
    // a little to juke around in each corner room, both levels
    for (const [x, z] of [[-14, -24], [14, -24], [-24, 14], [24, 14]]) k.box(x, 0, z, 2, 1.2, 2, PANEL);
    for (const [x, z] of [[-24, -13.5], [13.5, -24.5], [24.5, 24], [-14, 24.5]]) k.box(x, L1, z, 2, 1.2, 2, PANEL);
    for (const [x, z] of [[-14, -14], [14, 14]]) k.box(x, 0, z, 1.2, 4.0, 1.2, null, GLASS);

    // ---------------- colour coding: every zone has its accent ----------------
    // a glowing band along the outer walls at waist height, a tinted floor, a light sign
    const band = (col) => ({ emissive: col === OR ? '#4a2400' : '#0c2c55' });
    const zone = (x0, x1, z0, z1, col, tint, levels) => {
      const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
      for (const y of levels) {
        if (Math.abs(x0) > 27 || Math.abs(x1) > 27) { const xs = Math.abs(x0) > 27 ? x0 + 0.04 : x1 - 0.04; k.deco(xs, y + 1.0, cz, 0.06, 0.22, z1 - z0 - 0.6, col, band(col)); }
        if (Math.abs(z0) > 27 || Math.abs(z1) > 27) { const zs = Math.abs(z0) > 27 ? z0 + 0.04 : z1 - 0.04; k.deco(cx, y + 1.0, zs, x1 - x0 - 0.6, 0.22, 0.06, col, band(col)); }
      }
      k.deco(cx, 0, cz, x1 - x0 - 1.5, 0.02, z1 - z0 - 1.5, tint);
    };
    zone(-9.75, 9.75, -28, -17.5, OR, '#c9c1b8', [0]);          // N hall
    zone(-9.75, 9.75, 17.5, 28, BL, '#b8c0cc', [0]);            // S hall
    zone(17.5, 28, -9.75, 9.75, OR, '#c9c1b8', [0]);            // E hall
    zone(-28, -17.5, -9.75, 9.75, BL, '#b8c0cc', [0]);          // W hall
    zone(-28, -10.25, -28, -10.25, BL, '#b8c0cc', [0, L1]);     // corners
    zone(10.25, 28, -28, -10.25, OR, '#c9c1b8', [0, L1]);
    zone(10.25, 28, 10.25, 28, BL, '#b8c0cc', [0, L1]);
    zone(-28, -10.25, 10.25, 28, OR, '#c9c1b8', [0, L1]);
    // light signs on the corner walls, beside the floor doorways
    for (const [x, z, alongX, col] of [[-27.94, -24, false, BL], [27.94, -24, false, OR], [27.94, 24, false, BL], [-27.94, 24, false, OR]]) {
      k.deco(x, 2.2, z, alongX ? 2.4 : 0.06, 0.7, alongX ? 0.06 : 2.4, col, { emissive: col === OR ? '#7a3a00' : '#164a80' });
    }
  },
});
