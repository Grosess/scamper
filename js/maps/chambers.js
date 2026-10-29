// THE CHAMBERS - race through a chain of clean white test chambers. Each room is one test;
// doorways lead from one to the next, climbing as you go. Pits drop into the void (back to start).
//
//   0  start            the line-up room
//   1  pistons          orange and blue pistons punch in from the walls - time your run
//   2  ferries          two lanes over a pit: a slow wide platform, or a fast small one
//   3  faith plates     blue launch plates fling you across the pit, plate to plate
//   4  kick chimney     orange walls up to a door 8m up
//   5  sweepers         a narrow bridge over a pit with two spinning sweeper bars to jump
//   6  lasers           glowing gates: jump the low ones, slide under the high ones, time the moving one
//   7  lift             ride the blue lift up to the next door
//   8  the final test   steps over the pit, a ferry, a last kick chimney onto the finish balcony
//
// Walls are built from 4m panels so their outlines draw the seams.
defineMap({
  id: 'chambers',
  kind: 'race',
  accent: ['#ff9a3c', '#4aa3ff'],
  name: 'The Chambers',
  blurb: 'A chain of white test chambers: pistons, ferries, launch plates, lasers, a lift. Fall in a pit and you start over.',
  env: 'fog',
  sky: '#15171c',
  fog: [90, 220],
  hemi: ['#ffffff', '#a0a8b4', 1.45],
  sun: [0.9, 12, 60, 24],
  size: 95,
  killY: -12,
  menuCam: { path: [[27, 4.5, -5], [46, 4.5, -5]] },
  spawns: [-12, -9, -6, -3].flatMap((x) => [-3, 0, 3].map((z) => [x, 0, z])),
  seekerSpawn: [-7, 0, 0],
  race: {
    yaw: -Math.PI / 2,
    finish: { x: 167.4, y: 28, z: 8.2, w: 4.4, h: 3, d: 3.4 },
    route: [
      [-7, 0, 0], [25, 0, 0], [48, 0, 0], [53, 0, 0], [62, 2, 0], [71, 3, 0], [76, 3, 0],
      [78, 11, 0], [84, 11, 0], [105, 11, 0], [128, 11, 0], [135, 11, 0], [135, 19, 0], [141, 19, 0],
      [146, 19, -7.5], [158, 22.6, -7.5], [162, 22.6, -7], [162, 22.6, 9], [162.5, 28, 9], [167, 28, 8.2],
    ],
  },

  build(k) {
    const PANEL = '#e8ebef', FLOOR = '#9da4ae', CEIL = '#f4f6f8', FRAME = '#30343c';
    const OR = '#ff8a1f', BL = '#2f8cff', LASER = { emissive: '#ff2a10' }, GLOW = { emissive: '#fff1c8' };
    const T = 0.5;

    // fill a box region with panels at most `step` long on each of its long axes (thin axes stay whole)
    const panels = (x0, x1, y0, y1, z0, z1, col, o, step = 4) => {
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
    // one wall, split around its openings. ax = 'x' (wall runs along x) or 'z'; at = its center line.
    // holes: [{ c, w, y, h, frame }] along the wall
    const wall = (ax, at, a0, a1, y0, y1, holes, col = PANEL) => {
      const br = [a0, a1];
      for (let a = a0 + 4; a < a1 - 0.5; a += 4) br.push(a);
      for (const h of holes) br.push(h.c - h.w / 2, h.c + h.w / 2);
      const pts = [...new Set(br.map((v) => Math.round(v * 1000) / 1000))].sort((p, q) => p - q);
      const put = (b0, b1, c0, c1) => {
        if (b1 - b0 < 0.01 || c1 - c0 < 0.01) return;
        if (ax === 'x') panels(b0, b1, c0, c1, at - T / 2, at + T / 2, col, {}, 8);
        else panels(at - T / 2, at + T / 2, c0, c1, b0, b1, col, {}, 8);
      };
      for (let i = 0; i < pts.length - 1; i++) {
        const b0 = pts[i], b1 = pts[i + 1], m = (b0 + b1) / 2;
        const h = holes.find((q) => m > q.c - q.w / 2 && m < q.c + q.w / 2);
        if (!h) { put(b0, b1, y0, y1); continue; }
        put(b0, b1, y0, h.y);
        put(b0, b1, h.y + h.h, y1);
      }
      // dark frames around doorways (a little deeper than the wall, so no faces line up)
      for (const h of holes) {
        if (!h.frame) continue;
        const f = 0.15, D = T + 0.1;
        if (ax === 'x') {
          k.box(h.c - h.w / 2 + f / 2, h.y, at, f, h.h, D, FRAME);
          k.box(h.c + h.w / 2 - f / 2, h.y, at, f, h.h, D, FRAME);
          k.box(h.c, h.y + h.h - f, at, h.w - 2 * f, f, D, FRAME);
        } else {
          k.box(at, h.y, h.c - h.w / 2 + f / 2, D, h.h, f, FRAME);
          k.box(at, h.y, h.c + h.w / 2 - f / 2, D, h.h, f, FRAME);
          k.box(at, h.y + h.h - f, h.c, D, f, h.w - 2 * f, FRAME);
        }
      }
    };
    // a chamber. Interior x0..x1, z0..z1, floor top y, ceiling at y + h. Walls reach `deep` below the
    // floor so pits look like shafts. floor: list of [x0, x1, z0, z1] solid floor pieces (default all).
    // doors: { s: '-x' | '+x', c: z center, y: sill height, w, h, col: accent stripe }
    // slots: extra openings with no frame (for pistons): { s: '+z' | '-z', c: x center, w, y, h }
    const room = (x0, x1, z0, z1, y, h, o = {}) => {
      const deep = o.deep || 0.5, yb = y - deep, yt = y + h;
      const doors = o.doors || [{ s: '-x', c: 0 }, { s: '+x', c: 0 }];
      const hole = (side) => doors.filter((d) => d.s === side).map((d) => ({ c: d.c, w: d.w || 3, y: d.y === undefined ? y : d.y, h: d.h || 3.2, frame: true }))
        .concat((o.slots || []).filter((q) => q.s === side));
      wall('z', x0 - T / 2, z0 - T, z1 + T, yb, yt, hole('-x'));
      wall('z', x1 + T / 2, z0 - T, z1 + T, yb, yt, hole('+x'));
      wall('x', z0 - T / 2, x0, x1, yb, yt, hole('-z'));
      wall('x', z1 + T / 2, x0, x1, yb, yt, hole('+z'));
      k.box((x0 + x1) / 2, yt, (z0 + z1) / 2, x1 - x0 + 2 * T, 0.5, z1 - z0 + 2 * T, CEIL, { noShadow: true });
      // light strips under the ceiling
      for (const s of [-1, 1]) k.deco((x0 + x1) / 2, yt - 0.06, (z0 + z1) / 2 + s * (z1 - z0) / 4, x1 - x0 - 2, 0.06, 0.35, '#fffdf5', GLOW);
      for (const [a0, a1, b0, b1] of o.floor || [[x0, x1, z0, z1]]) panels(a0, a1, y - 0.5, y, b0, b1, FLOOR);
      // accent stripe over every doorway
      for (const d of doors) {
        const dy = (d.y === undefined ? y : d.y) + (d.h || 3.2) + 0.25, xs = d.s === '-x' ? x0 + 0.03 : x1 - 0.03;
        k.deco(xs, dy, d.c, 0.06, 0.3, (d.w || 3) + 1, d.col || (d.s === '-x' ? BL : OR), { emissive: d.s === '-x' ? '#123a66' : '#663000' });
      }
    };

    // ---------------- 0: start ----------------
    room(-14, 0, -6, 6, 0, 6, { doors: [{ s: '+x', c: 0 }] });
    k.deco(-0.6, 0.01, 0, 0.5, 0.02, 8, OR, { tex: 'none' });            // start line

    // ---------------- 1: pistons ----------------
    // slots in the side walls; pistons rest flush with the wall and punch 3.6m in
    const PX = [[6, '+z', OR], [11, '-z', BL], [16, '+z', OR], [21, '-z', BL]];
    room(1, 25, -3, 3, 0, 5, { slots: PX.map(([x, s]) => ({ s, c: x, w: 2.6, y: 0, h: 2.6 })) });
    PX.forEach(([x, s, col], i) => {
      const sg = s === '+z' ? 1 : -1;
      k.mover(x, 0, sg * 5, 2.4, 2.5, 4, col, { type: 'slide', dz: -sg * 3.6, period: 2.4, phase: i * 0.25 });
    });

    // ---------------- 2: ferries over a pit ----------------
    room(26, 48, -6, 6, 0, 7, { deep: 4, floor: [[26, 30, -6, 6], [44, 48, -6, 6]] });
    k.mover(33, -0.5, -3, 4, 0.5, 4, BL, { type: 'slide', dx: 8, period: 6 });          // slow wide lane
    k.mover(31.5, -0.5, 3, 3, 0.5, 3, OR, { type: 'slide', dx: 9, period: 4, phase: 0.5 });   // fast lane
    for (const z of [-3, 3]) k.deco(29.7, 0.01, z, 0.5, 0.02, 3, z < 0 ? BL : OR, { tex: 'none' });

    // ---------------- 3: faith plates ----------------
    room(49, 71, -6, 6, 0, 10, { deep: 4, floor: [[49, 53, -6, 6]], doors: [{ s: '-x', c: 0 }, { s: '+x', c: 0, y: 3 }] });
    k.box(60, -0.5, 0, 6, 2, 6, PANEL);                                    // island (top 1.5)
    k.box(68, -0.5, 0, 6, 3.5, 12, PANEL);                                 // exit shelf (top 3)
    k.pad(51.4, 0, 0, 1.6, 1.6, 15, { push: { x: 6.2, z: 0 }, color: BL });
    k.pad(60.8, 1.5, 0, 1.6, 1.6, 15, { push: { x: 6, z: 0 }, color: BL });

    // ---------------- 4: kick chimney ----------------
    room(72, 84, -6, 6, 3, 12, { doors: [{ s: '-x', c: 0 }, { s: '+x', c: 0, y: 11 }] });
    for (const s of [-1, 1]) k.box(77.5, 3, s * 1.65, 5, 8.5, 0.5, OR, { tex: 'kick' });   // walls 2.8 apart, to 11.5
    k.box(77.5, 3, 0, 5, 1.5, 2.8, PANEL);                                 // a step up into it (4.5): 6.5m of kicking
    k.box(82, 3, 0, 4, 8, 4, PANEL);                                       // exit ledge (top 11)

    // ---------------- 5: sweepers ----------------
    room(85, 105, -7, 7, 11, 6, { deep: 4, floor: [[85, 88, -7, 7], [88, 102, -1.5, 1.5], [89, 93, -2, -1.5], [89, 93, 1.5, 2], [97, 101, -2, -1.5], [97, 101, 1.5, 2], [102, 105, -7, 7]] });
    k.mover(91, 11, 0, 11, 0.6, 0.45, OR, { type: 'spin', speed: 1.5 });
    k.mover(99, 11, 0, 11, 0.6, 0.45, BL, { type: 'spin', speed: -1.8, phase: 1 });

    // ---------------- 6: lasers ----------------
    room(106, 128, -2.5, 2.5, 11, 4.5);
    // a gate of thin glowing bars from y0 to y1 (too close together to squeeze through)
    const beam = (x, y0, y1, gap = 0.32) => { for (let y = y0; y < y1 - 0.05; y += gap) k.box(x, y, 0, 0.12, Math.min(0.09, y1 - y), 5, '#ff3a1c', LASER); };
    beam(110, 11.1, 11.7, 0.25);                                            // jump
    beam(114, 12.25, 15.5);                                                 // slide under
    beam(118, 11.1, 11.7, 0.25);
    beam(121, 12.25, 15.5);
    k.mover(125, 11, 0, 0.2, 0.55, 5, '#ff3a1c', { type: 'slide', dy: 2.6, period: 2.8 }, LASER);   // up and down
    for (const x of [110, 114, 118, 121, 125]) for (const s of [-1, 1]) k.deco(x, 11, s * 2.42, 0.6, 4.5, 0.16, FRAME, { tex: 'none' });

    // ---------------- 7: lift ----------------
    room(129, 141, -6, 6, 11, 14, { doors: [{ s: '-x', c: 0 }, { s: '+x', c: 0, y: 19 }] });
    k.mover(135, 10.5, 0, 3, 0.5, 3, BL, { type: 'slide', dy: 8, period: 7 });
    k.box(139.5, 11, 0, 3, 8, 4, PANEL);                                    // exit ledge (top 19)
    k.deco(135, 11.01, 0, 3.4, 0.02, 3.4, BL, { tex: 'none' });

    // ---------------- 8: the final test ----------------
    room(142, 170, -10, 10, 19, 18, { deep: 6, floor: [[142, 147, -10, 10]], doors: [{ s: '-x', c: 0 }] });
    [[150, 20.2], [154, 21.4]].forEach(([x, top]) => k.box(x, 16, -7.5, 2, top - 16, 3, PANEL));   // steps
    k.box(160.25, 16, -7.3, 5.5, 22.6 - 16, 5.4, PANEL);                    // platform P (top 22.6)
    k.mover(162, 22.1, -2.5, 3, 0.5, 3, OR, { type: 'slide', dz: 8, period: 6 });   // ferry to the chimney
    k.box(162.75, 16, 8.7, 2.8, 22.6 - 16, 2.6, PANEL);                      // chimney floor (top 22.6)
    k.box(161.1, 16, 8.7, 0.5, 28.6 - 16, 2.6, OR, { tex: 'kick' });         // chimney wall, 2.8m from the balcony face
    k.box(164.4, 16, 8, 0.5, 28 - 16, 4, OR, { tex: 'kick' });               // the balcony's kickable face
    k.box(167.3, 16, 8, 5.3, 28 - 16, 4, PANEL);                             // finish balcony (top 28)
    k.box(167.3, 28, 5.8, 5.3, 1, 0.4, FRAME);                               // little rail
    // an observation window high on the far wall
    k.deco(169.96, 30, 0, 0.06, 4, 10, '#2a3a4c', { emissive: '#0a1420' });
  },
});
