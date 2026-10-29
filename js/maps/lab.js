// THE TEST LAB - a closed research facility in the white-panel test-chamber style.
// A 3x3 block of rooms, 46m across, on two heights (floor 0, mezzanines 4.4):
//   centre     the ATRIUM: a frosted-glass core you can't kick, crossed by two bridges at 4.4
//              (north-south and east-west, meeting over the floor)
//   edges      four test halls, each with a mezzanine on the atrium side and its own way up:
//                N  laser hall   orange kick chimney or step blocks, laser bar + vaults
//                S  pillar hall  stairs, glass pillars to juke around, a laser bar
//                E  glass hall   launch plate, glass partitions (see through, can't kick)
//                W  vault hall   step blocks, vault walls, a laser bar
//   corners    observation rooms (floor + upper room at 4.4) joined to both neighbours on both
//              levels; ways up: NW stairs, NE kick chimney, SE launch plate, SW step blocks
// Frosted cyan glass ('nokick') can't be wall-kicked. Orange walls are kick routes. Red bars:
// slide under (1.2m). Nothing moves up or down, and there is no void anywhere.
defineMap({
  id: 'lab',
  accent: ['#ff8a1f', '#2f8cff'],
  name: 'The Test Lab',
  blurb: 'A white test facility on two levels: glass you can\'t kick, laser bars and launch plates around a central atrium.',
  env: 'indoor',
  sky: '#15171c',
  fog: [55, 120],
  hemi: ['#ffffff', '#a6aebb', 1.5],
  sun: [0.8, 12, 60, 24],
  size: 25,
  spotHeight: 9.7,
  spots: [{ x: 0, z: 0 }, { x: 0, z: -15.5 }, { x: 0, z: 15.5 }, { x: -15.5, z: 0 }, { x: 15.5, z: 0 }],
  menuCam: { path: [[-7, 6.2, 7], [7, 6.2, 7]] },
  spawns: [
    [-5, 0, 4], [5, 0, -1.5], [1.5, 0, 7], [-2, 0, -7],
    [0, 0, -19], [2, 0, 19], [-19, 0, 0], [19, 0, 0],
    [-15.9, 0, -19.5], [15.9, 0, -20], [-12, 0, 19.5], [17, 0, 11],
    [-5, 4.4, -11.5], [6, 4.4, 11.5], [-11.5, 4.4, 6], [11.5, 4.4, -6],
    [-17, 4.4, -11], [17, 4.4, 20.5],
  ],
  seekerSpawn: [-5, 0, 4],

  build(k) {
    const PANEL = '#eceef1', FLOOR = '#a3a9b2', UPPER = '#cdd2d9', CEIL = '#f4f6f8', FRAME = '#2c3038';
    const OR = '#ff8a1f', BL = '#2f8cff', LASER = { emissive: '#ff2a10' }, GLOW = { emissive: '#fff1c8' };
    const GLASS = { tex: 'nokick' }, KICK = { tex: 'kick' };
    const T = 0.5, L1 = 4.4, TOP = 10;
    const A = 8.5, D = 14.5, E = A + D;          // atrium half-width, hall depth, outer half-width

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
    // holes: [{ c, w, y, h, col }]
    const wall = (ax, at, a0, a1, y0, y1, holes) => {
      const br = [a0, a1];
      for (const h of holes) br.push(h.c - h.w / 2, h.c + h.w / 2);
      const pts = [...new Set(br.map((v) => Math.round(v * 1000) / 1000))].sort((p, q) => p - q);
      const put = (b0, b1, c0, c1) => {
        if (b1 - b0 < 0.01 || c1 - c0 < 0.01) return;
        if (ax === 'x') panels(b0, b1, c0, c1, at - T / 2, at + T / 2, PANEL, {}, 6);
        else panels(at - T / 2, at + T / 2, c0, c1, b0, b1, PANEL, {}, 6);
      };
      for (let i = 0; i < pts.length - 1; i++) {
        const b0 = pts[i], b1 = pts[i + 1], m = (b0 + b1) / 2;
        const hs = holes.filter((q) => m > q.c - q.w / 2 && m < q.c + q.w / 2).sort((p, q) => p.y - q.y);
        let y = y0;
        for (const h of hs) { put(b0, b1, y, h.y); y = h.y + h.h; }
        put(b0, b1, y, y1);
      }
      // dark door frames (a little deeper than the wall), one accent bar above
      for (const h of holes) {
        const f = 0.15, Dp = T + 0.1, col = h.col || OR;
        const em = { emissive: col === OR ? '#663000' : '#123a66' };
        if (ax === 'x') {
          k.box(h.c - h.w / 2 + f / 2, h.y, at, f, h.h, Dp, FRAME);
          k.box(h.c + h.w / 2 - f / 2, h.y, at, f, h.h, Dp, FRAME);
          k.box(h.c, h.y + h.h - f, at, h.w - 2 * f, f, Dp, FRAME);
          for (const s of [-1, 1]) k.deco(h.c, h.y + h.h + 0.25, at + s * (T / 2 + 0.03), h.w, 0.3, 0.06, col, em);
        } else {
          k.box(at, h.y, h.c - h.w / 2 + f / 2, Dp, h.h, f, FRAME);
          k.box(at, h.y, h.c + h.w / 2 - f / 2, Dp, h.h, f, FRAME);
          k.box(at, h.y + h.h - f, h.c, Dp, f, h.w - 2 * f, FRAME);
          for (const s of [-1, 1]) k.deco(at + s * (T / 2 + 0.03), h.y + h.h + 0.25, h.c, 0.06, 0.3, h.w, col, em);
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

    // ---------------- shell: floor, ceiling, outer walls ----------------
    panels(-E, E, -0.5, 0, -E, E, FLOOR);
    k.box(0, TOP, 0, 2 * E + 1, 0.5, 2 * E + 1, CEIL, { noShadow: true });
    wall('x', -E - 0.25, -E - 0.5, E + 0.5, 0, TOP, []);
    wall('x', E + 0.25, -E - 0.5, E + 0.5, 0, TOP, []);
    wall('z', -E - 0.25, -E, E, 0, TOP, []);
    wall('z', E + 0.25, -E, E, 0, TOP, []);

    // ---------------- walls between the edge halls and the corner rooms ----------------
    // each has a floor doorway out in the hall and an upper doorway at mezzanine level
    const dFloor = A + 11, dUp = A + 3;
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        // between N / S halls and the corners (lines x = +-A)
        wall('z', sx * A, sz < 0 ? -E : A - 0.25, sz < 0 ? -A + 0.25 : E, 0, TOP, [
          { c: sz * dFloor, w: 4, y: 0, h: 3.2, col: sz < 0 ? OR : BL },
          { c: sz * dUp, w: 3, y: L1, h: 3.2, col: sz < 0 ? OR : BL },
        ]);
        // between W / E halls and the corners (lines z = +-A), stopping at the walls above
        wall('x', sz * A, sx < 0 ? -E : A + 0.25, sx < 0 ? -A - 0.25 : E, 0, TOP, [
          { c: sx * dFloor, w: 4, y: 0, h: 3.2, col: sx < 0 ? BL : OR },
          { c: sx * dUp, w: 3, y: L1, h: 3.2, col: sx < 0 ? BL : OR },
        ]);
      }
    }

    // ---------------- the four edge halls ----------------
    // local frame: u runs along the atrium side (-A..A), v goes outward from the atrium edge (0..D)
    const H = {
      N: { at: (u, v) => [u, -A - v], up: '+z', along: '+x', push: (pu, pv) => ({ x: pu, z: -pv }) },
      S: { at: (u, v) => [u, A + v], up: '-z', along: '+x', push: (pu, pv) => ({ x: pu, z: pv }) },
      W: { at: (u, v) => [-A - v, u], up: '+x', along: '+z', push: (pu, pv) => ({ x: -pv, z: pu }) },
      E: { at: (u, v) => [A + v, u], up: '-x', along: '+z', push: (pu, pv) => ({ x: pv, z: pu }) },
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
    const W2 = A - 0.25;   // the hall's inner half-width (side walls are corner walls)

    // every hall: mezzanine 4.4 (v 0-6) with glass along the atrium side at floor level (three
    // panes, two wide gaps), a glowing edge, and a pale colored floor
    const hallBase = (h, col) => {
      lslab(h, -W2, W2, 0, 6, L1, null, UPPER);
      for (const [u0, u1] of [[-W2, -5.5], [-1.3, 1.3], [5.5, W2]]) lbox(h, u0, u1, -0.15, 0.15, 0, L1 - 0.4, null, GLASS);
      ldeco(h, -W2, W2, -0.05, -0.02, L1 - 0.3, 0.16, col, { emissive: col === OR ? '#663000' : '#123a66' });
      ldeco(h, -W2 + 1, W2 - 1, 7, D - 1, 0, 0.02, col === OR ? '#d9c4ae' : '#b7c3d3');
    };

    // N - laser hall: kick chimney (beside the corner wall) and step blocks up to the mezzanine
    {
      const h = H.N;
      hallBase(h, OR);
      lbox(h, 4.85, 5.45, 6, 9, 0, L1, null, KICK);                // chimney: this wall + a panel on the corner wall
      lbox(h, W2 - 0.2, W2, 6, 9, 0, L1, null, KICK);
      lbox(h, -7.5, -4, 6, 8.5, 0, 2.4, PANEL);                     // step blocks: 1.2 -> 2.4 -> pull up onto 4.4
      lbox(h, -7.5, -4, 8.5, 11, 0, 1.2, PANEL);
      const [lx, lz] = lpos(h, 0.5, 11);
      laser('x', lx, lz, 6);
      for (const u of [-4, 4.5]) lbox(h, u - 1.5, u + 1.5, 12.8, 13.4, 0, 1.0, OR);   // vault walls
    }
    // S - pillar hall: stairs up to the mezzanine, frosted glass pillars to juke around
    {
      const h = H.S;
      hallBase(h, BL);
      const [sx, sz] = lpos(h, -6.5, 6 + 7.7);
      stairs(k, sx, sz, h.up, 3, 0, L1, OR);
      for (const [u, v] of [[-1, 9], [2.5, 8], [4.5, 13.3], [1, 12.5]]) lbox(h, u - 0.7, u + 0.7, v - 0.7, v + 0.7, 0, TOP, null, GLASS);
      const [lx, lz] = lpos(h, -2.5, 11);
      laser('z', lx, lz, 3);
    }
    // E - glass hall: a launch plate up to the mezzanine, glass partitions on the floor
    {
      const h = H.E;
      hallBase(h, OR);
      const [px, pz] = lpos(h, 2.5, 9);
      k.pad(px, 0, pz, 1.6, 1.6, 17, { push: h.push(0, -4.2), color: BL });
      lbox(h, -5, -4.7, 7.5, D, 0, TOP, null, GLASS);                 // partitions: see through, can't pass or kick
      lbox(h, 0, 0.3, 11.5, D, 0, TOP, null, GLASS);
      lbox(h, 5, W2, 12.5, 12.8, 0, TOP, null, GLASS);
      for (const u of [-2.5, 5.5]) lbox(h, u - 1, u + 1, 7, 8.3, 0, 1.0, OR);
    }
    // W - vault hall: step blocks up to the mezzanine, vault walls and a laser bar on the floor
    {
      const h = H.W;
      hallBase(h, BL);
      lbox(h, 3, 6.5, 6, 8.5, 0, 2.4, PANEL);
      lbox(h, 3, 6.5, 8.5, 11, 0, 1.2, PANEL);
      for (const [u, v] of [[-5, 9], [0, 13]]) lbox(h, u - 2, u + 2, v - 0.3, v + 0.3, 0, 1.0, BL);
      const [lx, lz] = lpos(h, -3, 11.5);
      laser('z', lx, lz, 5);
    }

    // ---------------- the atrium ----------------
    k.box(0, 0, 0, 3.5, TOP, 3.5, null, GLASS);                      // the core: frosted glass, unkickable
    k.deco(0, 0.01, 0, 5.5, 0.02, 5.5, BL, { emissive: '#123a66' });
    k.deco(0, 0.02, 0, 4.1, 0.02, 4.1, FLOOR);
    // bridges at 4.4: north-south at x = 4.25, east-west at z = -4.25 (split where they cross)
    slab(k, 4.25, L1, 0, 3.5, 2 * A, UPPER, { t: 0.4 });
    slab(k, (-A + 2.5) / 2, L1, -4.25, A + 2.5, 3.5, UPPER, { t: 0.4 });
    slab(k, (6 + A) / 2, L1, -4.25, A - 6, 3.5, UPPER, { t: 0.4 });
    for (const s of [-1, 1]) k.deco(4.25 + s * 1.78, L1 - 0.3, 0, 0.04, 0.16, 2 * A - 0.4, OR, { emissive: '#663000' });
    // floor: launch plates (onto the bridges), vaults, laser bars, juke posts
    k.pad(-6.5, 0, -7.5, 1.6, 1.6, 18, { push: { x: 0, z: 2.6 }, color: OR });
    k.pad(7.5, 0, 6.5, 1.6, 1.6, 18, { push: { x: -2.6, z: 0 }, color: OR });
    k.box(-6, 0, 1.5, 3, 1.0, 0.6, OR);
    k.box(-0.5, 0, -6.5, 0.6, 1.0, 3, OR);
    laser('x', -2, 6.3, 4.5);
    for (const [x, z] of [[-3.5, -0.5], [1.2, 5]]) k.box(x, 0, z, 1, 3.2, 1, FRAME);

    // ---------------- corner observation rooms ----------------
    const c0 = A + 0.25, cm = (c0 + E) / 2;
    const corner = (sx, sz, hole, col) => {
      const x0 = sx < 0 ? -E : c0, x1 = sx < 0 ? -c0 : E, z0 = sz < 0 ? -E : c0, z1 = sz < 0 ? -c0 : E;
      slabHole(k, x0, x1, z0, z1, L1, hole, UPPER);
      k.deco((x0 + x1) / 2, 0, (z0 + z1) / 2, x1 - x0 - 1.5, 0.02, z1 - z0 - 1.5, col === OR ? '#d9c4ae' : '#b7c3d3');
    };
    // NW: stairs up through the floor
    corner(-1, -1, [-21.8, -13.2, -17.4, -14.4], BL);
    stairs(k, -21, -cm, '+x', 3, 0, L1, BL);
    // NE: kick chimney in a shaft (walls 3m apart), climb out onto the upper room
    corner(1, -1, [14.8, 17.8, -18.5, -13.5], OR);
    k.box(14.5, 0, -16, 0.6, L1 - 0.4, 5, null, KICK);   // walls stop under the floor slab
    k.box(18.1, 0, -16, 0.6, L1 - 0.4, 5, null, KICK);
    // SE: launch plate under a hole
    corner(1, 1, [14, 18, 14, 18], BL);
    k.pad(16, 0, 16.6, 1.6, 1.6, 15.5, { push: { x: 0, z: -3.7 }, color: BL });
    // SW: step blocks under a hole (1.2 -> 2.4 -> pull up onto the upper room)
    corner(-1, 1, [-18.5, -13.5, 13.5, 18.5], OR);
    k.box(-14.5, 0, 15, 2, 2.4, 2, PANEL);
    k.box(-16.5, 0, 15, 2, 1.2, 2, PANEL);
    // a little to juke around in each corner room, both levels
    for (const [x, z] of [[-12, -20], [12, -20], [-20, 12], [20, 12]]) k.box(x, 0, z, 2, 1.2, 2, PANEL);
    for (const [x, z] of [[-20, -11.5], [11.5, -20.5], [20.5, 20], [-11.5, 20.5]]) k.box(x, L1, z, 2, 1.2, 2, PANEL);
    for (const [x, z] of [[-11.8, -11.8], [11.8, 11.8]]) k.box(x, 0, z, 1.2, 4.0, 1.2, null, GLASS);
    // ceiling light strips under the upper rooms
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.deco(sx * cm, L1 - 0.46, sz * cm, 0.4, 0.06, 10, '#fffdf5', GLOW);
  },
});
