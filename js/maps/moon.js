// MOON BASE - a lunar base on a slab of rock floating in space. Low gravity: jumps are high and
// long (apex ~2.4m, a running jump clears ~11m) and you fall slowly, so everything is spaced out.
//   the rift      a 10m chasm down the middle, straight into the void. Cross it on the south
//                 catwalk, through the north tube, over the gantry at 10 - or just jump it
//   west          three habitat modules (A north, C middle, B south) joined by tubes. Doors on every
//                 side, side doors in the tubes, and the roofs (5m) make a second path on top
//   the deck      a 10m platform, reached by the orange kick shaft or the crate + storage rack.
//                 The gantry runs from it across the rift to the comm tower
//   comm tower    14m. Up by the gantry balcony, the orange kick shaft on its east face, or the
//                 zig-zag ledges on its south face
//   east          lander (run under it, climb on it from the crate), a cargo stack, the rover,
//                 solar panels to slide under, and a crater whose pad throws you up to the dish
// Heights: hab roofs 5, containers 5.2, lander 6.4, dish 6, deck/gantry 10, tower 14.
defineMap({
  id: 'moon',
  accent: ['#c3a6ff', '#1b1f2e'],
  name: 'Moon Base',
  blurb: 'Low gravity on a rock floating in space. Habitats and tubes, a rift, a gantry, a comm tower.',
  env: 'space',
  sky: '#04050a',
  fog: [90, 240],
  hemi: ['#f2f4ff', '#3a3f55', 2.1],
  sun: [1.3, 30, 60, 20],
  size: 36,
  killY: -14,
  planet: { x: -150, y: 95, z: -230, r: 38, color: '#5b8fd8', land: '#7fc48f' },
  move: {
    gravity: 14,       // a bit over half: floaty, but you still come down in time to keep chasing
    jumpSpeed: 8.2,    // apex ~2.4m, ~1.2s in the air
    wallKickUp: 7.6,   // ~2m per kick
    wallKickForward: 6.5,
    maxFall: 24,
    coyoteTime: 0.14,
  },
  menuCam: { r: 44, y: 26 },
  spawns: [
    [-21, 0, 18], [-22, 0, 1], [-21, 0, -16], [8, 0, 19], [-9, 0, 9], [-6, 0, -20],
    [14, 0, -9], [24, 0, 5.5], [28, 0, -14], [28, 0, 15], [-30, 0, -4], [-30, 0, 26],
    [17, 0, 27], [-21, 5, 9],
  ],
  seekerSpawn: [-9, 10, -2],

  build(k) {
    const ROCK = '#7c808b', ROCK2 = '#686c77', ROCK3 = ROCK, DUST = '#9a9ea8';
    const HAB = '#f6f4ee', LILAC = '#c3a6ff', MINT = '#7ed6c8', PINK = '#ff8fa3', BLUE = '#8fb4ff', YEL = '#ffd166';
    const STEEL = '#59606e', PANEL = '#3c4f8c', DARK = '#2b2f38';

    // ---------- the rock: two halves with the rift between, and a crater hole in the east ----------
    const rock = (x0, x1, z0, z1, top = 0) => k.box((x0 + x1) / 2, -6, (z0 + z1) / 2, x1 - x0, top + 6, z1 - z0, DUST);
    rock(-32, -5, -30, 30);                 // west
    rock(5, 32, -30, 13);                   // east, south of the crater
    rock(5, 13, 13, 30);                    // east, beside the crater
    rock(23, 32, 13, 30);
    rock(13, 23, 23, 30);
    k.box(18, -6, 18, 10, 3, 10, ROCK2);    // crater floor at -3
    // the underside: smaller and smaller chunks, so it reads as a floating rock
    k.deco(-18, -9, 0, 24, 3, 52, ROCK2);
    k.deco(18, -9, -3, 24, 3, 46, ROCK2);
    k.deco(-17, -12, 3, 16, 3, 34, ROCK2);
    k.deco(17, -12, -6, 16, 3, 30, ROCK2);

    // ---------- helpers ----------
    // habitat module: walls 5 high with the roof set between them (ceiling 4.6), so the outside is
    // one clean ledge to pull up onto. doors = [[side, offset along the wall], ...]
    const DW = 2.8, DH = 3.4, WH = 5, T = 0.4;
    const wallRun = (side, cx, cz, len, doors, color, h = WH) => {
      // a straight wall along one side, cut by door openings (offsets from its middle)
      const ax = side === 'x';   // wall runs along x
      const cuts = doors.slice().sort((a, b) => a - b);
      let a = -len / 2;
      const seg = (s0, s1) => {
        if (s1 - s0 < 0.05) return;
        const m = (s0 + s1) / 2, L = s1 - s0;
        if (ax) k.box(cx + m, 0, cz, L, h, T, color); else k.box(cx, 0, cz + m, T, h, L, color);
      };
      for (const c of cuts) {
        seg(a, c - DW / 2);
        if (h - DH > 0.05) { if (ax) k.box(cx + c, DH, cz, DW, h - DH, T, color); else k.box(cx, DH, cz + c, T, h - DH, DW, color); }
        a = c + DW / 2;
      }
      seg(a, len / 2);
    };
    const hab = (cx, cz, w, d, trim, doors, h = WH, wall = HAB) => {
      const D = (s) => doors.filter((x) => x[0] === s).map((x) => x[1]);
      wallRun('z', cx - w / 2 + T / 2, cz, d, D('-x'), wall, h);
      wallRun('z', cx + w / 2 - T / 2, cz, d, D('+x'), wall, h);
      wallRun('x', cx, cz - d / 2 + T / 2, w - 2 * T, D('-z'), wall, h);
      wallRun('x', cx, cz + d / 2 - T / 2, w - 2 * T, D('+z'), wall, h);
      slab(k, cx, h, cz, w - 2 * T, d - 2 * T, trim, { t: 0.4 });
    };
    // tube: walkway with walls and a roof (top 5), side doors at the given offsets
    const tube = (ax, x0, x1, at, sideDoors = [], floor = false) => {
      const len = x1 - x0, mid = (x0 + x1) / 2, off = DW / 2 + 0.2;
      const along = ax === 'x';
      for (const s of [-1, 1]) {
        if (along) wallRun('x', mid, at + s * off, len, sideDoors, HAB);
        else wallRun('z', at + s * off, mid, len, sideDoors, HAB);
      }
      if (along) slab(k, mid, 5, at, len, 2 * off - T, '#d9dce3', { t: 0.4 });
      else slab(k, at, 5, mid, 2 * off - T, len, '#d9dce3', { t: 0.4 });
    };
    const boulder = (x, z, w, h, d, rot = 0, c = ROCK) => k.box(x, 0, z, w, h, d, c, { rot });

    // ---------- west: habitats A (north), C (middle), B (south) ----------
    hab(-21, 18, 12, 9, LILAC, [['+x', 0], ['-z', 0], ['-x', -2], ['+z', -3]]);
    hab(-22, 1, 10, 8, MINT, [['+z', 1], ['-z', 1], ['+x', 0], ['-x', 2]]);
    hab(-21, -16, 12, 9, PINK, [['+z', 0], ['+x', -3], ['-z', -3], ['-x', 2]]);
    tube('z', 5, 13.5, -21, [0]);           // A <-> C, side doors in the middle
    tube('z', -11.5, -3, -21, [0]);         // C <-> B
    // north tube: A -> across the rift -> hab D. Side doors west of the rift.
    tube('x', -15, 5, 18, [-4]);
    k.box(0, -0.4, 18, 10, 0.4, 2 * (DW / 2 + 0.2) + T, '#d9dce3');   // its floor over the rift
    hab(8, 19, 6, 10, BLUE, [['-x', -1], ['+x', 1], ['+z', 0]]);

    // consoles / crates inside the habs to juke around
    k.box(-23.5, 0, 19.5, 2, 1.1, 1, STEEL);
    k.box(-18, 0, -17.5, 1.2, 1.1, 2.2, STEEL);
    k.box(-24, 0, 2, 1.2, 1.1, 1.2, STEEL);
    k.box(9.5, 0, 22, 1.4, 1.1, 1.4, STEEL);

    // ways up to the hab roofs (5): orange kick walls 3m off a hab wall, and crates
    k.box(-22, 0, 25.75, 6, 5, 0.5, YEL, { tex: 'kick' });        // north of A
    k.box(-11.75, 0, -15, 0.5, 5, 5, YEL, { tex: 'kick' });       // east of B
    k.box(8, 0, 10.75, 5, 5, 0.5, YEL, { tex: 'kick' });          // south of D
    k.box(-28.8, 0, 20.5, 2.4, 3, 2.4, YEL);                       // crates (3m: hop on, then onto a roof)
    k.box(-18, 0, -22.1, 2.4, 3, 2.4, PINK);

    // ---------- the deck (10) with its kick shaft, storage rack and gantry ----------
    kickShaft(k, -9, -8, 'z', 4, 0, 10, YEL, 3.0);                 // walls at x -10.75 / -7.25, z -10..-6
    slab(k, -8.5, 10, -3, 5, 6, '#d9dce3', { t: 0.5 });            // deck x -11..-6, z -6..0
    k.box(-11.5, 0, -3, 1, 10, 6, '#d9dce3');                      // its west end is a solid pier
    posts(k, [[-6.3, -0.3]], 0, 9.5, STEEL, 0.4);
    k.box(-13, 0, -1, 2, 6.4, 4, STEEL);                           // storage rack x -14..-12, z -3..1
    k.box(-13, 0, 3, 2.4, 2.6, 2.4, MINT);                         // crate -> rack -> deck
    bridge(k, -6, -4, 5, -4, 10, 2, STEEL);                         // gantry over the rift

    // ---------- comm tower (14) ----------
    k.box(8.8, 0, -4, 3.6, 14, 4, '#d9dce3');                       // core x 7..10.6
    k.box(10.8, 0, -4, 0.4, 12, 4, YEL, { tex: 'kick' });           // its east face (kick side)
    k.box(10.8, 12, -4, 0.4, 2, 4, '#d9dce3');
    k.box(14.25, 0, -4, 0.5, 12, 4, YEL, { tex: 'kick' });          // the other side of the shaft
    slab(k, 6, 10, -4, 2, 4, STEEL, { t: 0.5 });                    // gantry balcony x 5..7
    posts(k, [[5.3, -5.7], [5.3, -2.3]], 0, 9.5, STEEL, 0.3);
    // zig-zag ledges with a gap between them, so you never jump with one right over your head
    for (const [x, y] of [[7.7, 3.6], [10.3, 7.2], [7.7, 10.8]]) slab(k, x, y, -6.6, 1.4, 1.2, LILAC, { t: 0.4 });
    k.deco(9, 14, -4, 0.2, 4, 0.2, '#d9dce3');                      // mast
    k.deco(9, 18, -4, 0.45, 0.45, 0.45, '#ff3b4f', { emissive: '#ff3b4f' });

    // ---------- the south catwalk over the rift ----------
    k.box(0, -0.4, -22, 10, 0.4, 2.4, STEEL);
    posts(k, [[-4.8, -23.1], [-4.8, -20.9], [4.8, -23.1], [4.8, -20.9]], 0, 1.1, STEEL, 0.2);

    // ---------- lander ----------
    k.box(14, 3.2, -17, 6, 3.2, 6, HAB);                      // body x 11..17, z -20..-14: run under it
    for (const [x, z] of [[11.3, -19.7], [16.7, -19.7], [11.3, -14.3], [16.7, -14.3]]) k.box(x, 0, z, 0.5, 3.2, 0.5, STEEL);
    k.box(14, 2.4, -17, 1.6, 0.8, 1.6, DARK);                       // engine bell
    k.box(14, 6.4, -17, 2, 1.2, 2, YEL);                            // hatch on top
    k.box(19, 0, -17, 2.4, 2.6, 2.4, BLUE);                         // crate: hop on, then onto the lander

    // ---------- hangar (roof 6): jump over from the lander or the cargo stack, or off the crate ----------
    hab(26.5, -13, 9, 6, '#ffb37a', [['-x', -1], ['+z', 2], ['-z', -2]], 6, '#d9dce3');
    k.box(20.8, 0, -10.6, 2.4, 3, 2.4, MINT);

    // ---------- cargo stack ----------
    k.box(24, 0, -26, 6, 2.6, 2.4, PINK);
    k.box(24, 0, -22.6, 6, 2.6, 2.4, BLUE);
    k.box(24, 2.6, -24.2, 2.4, 2.6, 6, YEL);                        // laid across both: top 5.2

    // ---------- rover ----------
    k.box(-10, 0.6, -24, 3, 1.4, 4.2, '#d9dce3');
    k.box(-10, 2, -25, 2, 0.8, 1.6, LILAC);
    for (const [x, z] of [[-11.7, -25.4], [-8.3, -25.4], [-11.7, -22.6], [-8.3, -22.6]]) k.box(x, 0, z, 0.4, 1.1, 1.1, DARK);

    // ---------- solar panels: slide under, or run along the top ----------
    for (const z of [-7.8, -3.6, 0.6]) {
      slab(k, 24, 1.55, z, 12, 2.2, PANEL, { t: 0.15 });
      posts(k, [[18.6, z], [24, z], [29.4, z]], 0, 1.4, STEEL, 0.2);
    }

    // ---------- crater: rim rocks, and a pad that throws you up to the dish ----------
    boulder(11.5, 26.5, 1.6, 1.6, 2.4, 0.3, ROCK2);
    boulder(15, 11.6, 3, 1.2, 1.4, -0.2);
    boulder(21.5, 11.4, 2.2, 2, 1.6, 0.5, ROCK3);
    boulder(24.6, 15, 1.4, 1.4, 2.6, 0.15);
    boulder(24.8, 21.5, 1.8, 2.2, 1.8, -0.4, ROCK2);
    boulder(16, 24.6, 2.6, 1.2, 1.4, 0.25, ROCK3);
    k.pad(18, -3, 18, 1.6, 1.6, 17.5, { push: { x: 4.6, z: 3.6 } });
    slab(k, 28, 6, 26, 6, 6, '#d9dce3', { t: 0.5 });                // dish platform x 25..31, z 23..29
    posts(k, [[25.4, 23.4], [30.6, 23.4], [25.4, 28.6], [30.6, 28.6]], 0, 5.5, STEEL, 0.4);
    k.deco(28, 6, 26, 0.5, 2.2, 0.5, '#d9dce3');
    k.deco(28.6, 7.6, 25.4, 3.4, 0.25, 3.4, HAB, { rot: 0.6 });

    // ---------- tall rocks, a shed and a relay mast: break up the long views ----------
    boulder(19, 7.5, 4, 4.5, 2.2, 0.15, ROCK2);
    boulder(28, 6.5, 3, 5.5, 2.4, -0.3, ROCK);
    boulder(-12.5, 10, 3, 4.2, 2.4, 0.25, ROCK2);
    boulder(-27.5, -25, 3.4, 4.8, 2.6, -0.2, ROCK);
    hab(-7.5, -17, 4, 3, '#9be3a8', [['-x', 0], ['+x', 0]], 3, '#d9dce3');   // shed: run through, or hop on (3m)
    k.box(-9, 0, 25, 1.2, 8, 1.2, '#d9dce3');                                   // relay mast
    k.deco(-9, 8, 25, 0.25, 2.5, 0.25, '#d9dce3');
    k.deco(-9, 10.5, 25, 0.4, 0.4, 0.4, '#7ed6c8', { emissive: '#3a8a80' });

    // ---------- rocks around the edges and in the open (cover, low hops) ----------
    for (const [x, z, w, h, d, r, c] of [
      [-30.5, -27, 2.2, 2.4, 2.6, 0.3, ROCK], [-29.5, -12, 1.8, 1.4, 2.6, -0.4, ROCK2], [-30, 16.5, 2.4, 2, 1.8, 0.2, ROCK3],
      [-25, 28.4, 3, 1.6, 2, -0.15, ROCK], [-14, 28.6, 2.2, 2.6, 1.8, 0.4, ROCK2], [-6.2, 27, 1.6, 1.4, 1.6, 0.1, ROCK3],
      [-6.4, 11.5, 1.6, 1.8, 2.4, -0.3, ROCK], [-11.5, 13.2, 1.4, 1.2, 1.4, 0.6, ROCK3],
      [-5.8, -14, 1.5, 1.6, 2.6, 0.2, ROCK2], [-18, -27.8, 2.6, 1.8, 1.6, -0.25, ROCK], [-6.5, -29, 1.8, 1.2, 1.4, 0.5, ROCK3],
      [7, -28.4, 2.2, 2.2, 1.6, 0.35, ROCK], [30.6, -28.6, 1.8, 2.6, 2, -0.2, ROCK2], [30.8, -6, 1.4, 1.6, 2.4, 0.25, ROCK3],
      [30.5, 10, 1.8, 1.2, 1.8, -0.45, ROCK], [5.8, 8.5, 1.6, 2, 1.6, 0.3, ROCK2], [16.5, -10.5, 1.4, 1.2, 1.6, -0.3, ROCK3],
      [5.8, -11.5, 1.2, 1.4, 1.8, 0.15, ROCK],
    ]) boulder(x, z, w, h, d, r, c);

    // --- for chases (kept light): a slide-under pipe arch on the west strip, two low crates ---
    for (const x of [-31.2, -27.6]) k.box(x, 0, 10, 0.4, 1.6, 0.4, STEEL);
    k.box(-29.4, 1.2, 10, 3.2, 0.4, 0.4, YEL);
    k.box(-14, 0, 9, 1.3, 1.1, 1.3, STEEL);
    k.box(-4, 0, 9, 1.3, 1.1, 1.3, STEEL);
  },
});
