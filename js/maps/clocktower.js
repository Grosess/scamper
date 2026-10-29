// THE CLOCKTOWER - inside a giant clock. A 12x12 shaft runs up the middle and is crossed at every
// height: the big spinning gear on the floor, a balance beam at 5, the pendulum at 10, beams at 15.
// Around it, 3x3 cells of 12m. Galleries at 5, 10 and 15 skip cells, so tall open atriums sit next
// to stacked rooms and every floor has holes to drop through.
//
//            L1 (5)        L2 (10)       L3 (15, bell deck)
//   floored  N S W NE SW   N E W NW SE   S W NE SE  (+ beams across the shaft)
//
// Ways up (none of them the only one):
//   0 -> 5    crates by the shaft, stairs in E, lift in SE, kick chimney in NW
//   5 -> 10   stairs in S, spinning gear in NE, kick chimney in SW
//   10 -> 15  stairs in NW, lift in E, kick chimney in N, spinning gear in the shaft (up onto the
//             beam), the tall SW chimney (5 -> 15)
// Rideable gears spin slowly and turn your view with them. Ceilings are 4.5m+ over every floor.
defineMap({
  id: 'clocktower',
  accent: ['#d6a84a', '#5a3b26'],
  name: 'The Clocktower',
  blurb: 'Inside a giant clock. Ride the spinning gears and the pendulum, kick up the chimneys, run the bell deck.',
  env: 'indoor',
  sky: '#1d1712',
  fog: [45, 110],
  hemi: ['#fff3e0', '#6b5440', 1.35],
  sun: [0.5, 4, 60, 6],
  size: 22,
  spotHeight: 23.4,
  spots: [-12, 0, 12].flatMap((x) => [-12, 0, 12].map((z) => ({ x, z, color: '#ffe2b0' }))),
  menuCam: { r: 4.5, y: 7 },
  spawns: [
    [-15, 0, -15], [11, 0, 0], [14, 0, 15], [0, 0, -16], [-12, 0, 4], [0, 0, 13], [-15, 0, 15], [12, 0, -12],
    [3, 5, -9], [-12, 5, 3], [16, 5, -16], [-15, 5, 15],
    [16.5, 10, 0], [-16, 10, -16], [13, 10, 14], [-14, 10, -3],
    [13, 15, 13], [-12, 15, -3],
  ],
  seekerSpawn: [0, 0, 5],

  build(k) {
    const STONE = '#d9ccb6', CEIL = '#4a3a2c', FLOOR0 = '#8a7563';
    const WOOD1 = '#b98559', WOOD2 = '#a8744c', WOOD3 = '#c4925f', BEAM = '#7a5236';
    const BRASS = '#d9a033', BRASS2 = '#b07a22', IRON = '#4b4f58', DARK = '#3a2c22', CRATE = '#c9a274';
    const L = [0, 5, 10, 15], C = 12;   // floor heights, cell size

    ground(k, 36, 36, FLOOR0);
    enclose(k, 36, 36, 24, STONE, CEIL);

    // ---------- galleries: one 12x12 slab per floored cell ----------
    const cells = {
      1: ['N', 'S', 'W', 'NE', 'SW'],
      2: ['N', 'E', 'W', 'NW', 'SE'],
      3: ['S', 'W', 'NE', 'SE'],
    };
    const at = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0], NE: [1, -1], NW: [-1, -1], SE: [1, 1], SW: [-1, 1] };
    const wood = [null, WOOD1, WOOD2, WOOD3];
    for (const lv of [1, 2, 3]) for (const c of cells[lv]) slab(k, at[c][0] * C, L[lv], at[c][1] * C, C, C, wood[lv], { t: 0.5 });

    // timber pilasters up the walls where the cells meet
    for (const v of [-6, 6]) {
      k.box(v, 0, -17.8, 0.6, 24, 0.4, BEAM);
      k.box(v, 0, 17.8, 0.6, 24, 0.4, BEAM);
      k.box(-17.8, 0, v, 0.4, 24, 0.6, BEAM);
      k.box(17.8, 0, v, 0.4, 24, 0.6, BEAM);
    }
    // pillars at the shaft corners, floor to the first gallery
    posts(k, [[-6, -6], [6, -6], [-6, 6], [6, 6]], 0, 4.5, DARK, 0.8);

    // ---------- the shaft ----------
    // a gear: two squares a quarter-turn apart (an 8-point star) plus a hub, all spinning together
    const gear = (x, y, z, s, speed, c1, c2) => {
      const m = { type: 'spin', speed };
      k.mover(x, y, z, s, 0.9, s, c1, m);
      k.mover(x, y, z, s, 0.95, s, c2, { type: 'spin', speed, phase: Math.PI / 4 });
      k.mover(x, y + 0.95, z, s * 0.25, 0.3, s * 0.25, DARK, m);
    };
    gear(0, 0, 0, 6, 0.35, BRASS, BRASS2);                         // floor gear (top 0.95)
    // a wall closes the W room off from the shaft, so the crates beside it lead up onto the W gallery
    k.box(-6.2, 0, 0, 0.4, 4.5, 11.2, STONE);
    // crates by the west edge of the shaft: climb them, pull up onto the W gallery
    k.box(-5.25, 0, 0.2, 1.4, 2.4, 1.4, CRATE);
    k.box(-5.25, 0, 2.2, 1.4, 1.2, 1.4, CRATE);
    // balance beam at 5, north to south, over the gear
    slab(k, 0, 5, 0, 1.2, 12, BEAM, { t: 0.3 });
    // the pendulum: bob at 10 swings across the shaft between the W and E galleries
    const swing = { type: 'slide', dx: 8.9, period: 7 };
    k.mover(-4.45, 9.4, 0, 3, 0.6, 3, BRASS, swing);
    k.mover(-4.45, 10, 0, 0.4, 13.8, 0.4, DARK, swing);
    // beams at 15: W gallery -> east along z=-5 -> the N-S beam at x=5.2 (S gallery to the NE corner)
    slab(k, -0.6, 15, -5, 10.8, 0.8, BEAM, { t: 0.3 });
    slab(k, 5.2, 15, 0, 0.8, 12, BEAM, { t: 0.3 });

    // ---------- more gears to ride ----------
    gear(12, 6.9, -12, 5, -0.3, BRASS2, BRASS);                    // NE, top 7.85: from 5 up toward 10
    gear(0, 11.55, -3.2, 3.8, 0.4, BRASS, BRASS2);                 // in the shaft, top 12.5: N gallery (10) -> beam (15)

    // ---------- lifts: counterweights that ride up and down ----------
    k.mover(8, -0.8, 12, 2.6, 1, 2.6, IRON, { type: 'slide', dy: 4.8, period: 9 });             // SE: 0 -> 5
    k.mover(12, 9.2, 4.3, 2.6, 1, 2.6, IRON, { type: 'slide', dy: 4.8, period: 9, phase: 0.5 }); // E: 10 -> 15
    k.deco(8, 5, 12, 0.2, 4.5, 0.2, DARK);                         // chains
    k.deco(12, 15, 4.3, 0.2, 9, 0.2, DARK);

    // ---------- stairs ----------
    stairs(k, 15, 3.1, '-z', 3, 0, 5, WOOD2);                      // E ground -> NE gallery (5)
    stairs(k, -3.1, 15, '+x', 3, 5, 10, WOOD3);                    // S gallery (5) -> SE gallery (10)
    stairs(k, -12, -15.1, '+z', 3, 10, 15, WOOD1);                 // NW gallery (10) -> W bell deck (15)

    // ---------- kick chimneys (orange) ----------
    kickShaft(k, -8.5, -12, 'x', 5, 0, 5, BRASS);                  // NW ground -> N gallery (5)
    kickShaft(k, -12, 8.5, 'z', 5, 5, 10, BRASS);                  // SW (5) -> W gallery (10)
    kickShaft(k, -8.5, 14.5, 'x', 5, 5, 15, BRASS);                // SW (5) -> S bell deck (15), the tall one
    kickShaft(k, 4.5, -12, 'x', 3, 10, 15, BRASS);                 // N (10) -> NE bell deck (15)

    // ---------- clock faces: glowing windows high on each wall ----------
    const clock = (side, c, y, s) => {
      const ax = side[1] === 'x', sg = side[0] === '+' ? 1 : -1;
      // a = width along the wall, b = height, dd = thickness, depth = how far it stands off the wall
      const part = (along, up, depth, a, b, dd, col, o = {}) => {
        const w = sg * (18 - depth), yb = y + up - b / 2;
        if (ax) k.deco(w, yb, c + along, dd, b, a, col, o); else k.deco(c + along, yb, w, a, b, dd, col, o);
      };
      part(0, 0, 0.05, s, s, 0.04, '#fff1c9', { emissive: '#b8892f' });
      part(0, s / 2 + 0.15, 0.1, s + 0.6, 0.3, 0.08, DARK);
      part(0, -s / 2 - 0.15, 0.1, s + 0.6, 0.3, 0.08, DARK);
      part(s / 2 + 0.15, 0, 0.1, 0.3, s, 0.08, DARK);
      part(-s / 2 - 0.15, 0, 0.1, 0.3, s, 0.08, DARK);
      for (let i = 0; i < 12; i++) {
        const a = i * Math.PI / 6, r = s * 0.4, big = i % 3 === 0 ? 0.6 : 0.3;
        part(Math.sin(a) * r, Math.cos(a) * r, 0.12, big * 0.5, big, 0.06, DARK);
      }
      part(0, s * 0.125, 0.14, 0.26, s * 0.25, 0.06, DARK);       // hour hand (12)
      part(s * 0.18 * (ax ? sg : -sg), 0, 0.16, s * 0.36, 0.18, 0.06, DARK);   // minute hand (3, on the right as you face it)
      part(0, 0, 0.18, 0.5, 0.5, 0.06, BRASS);
    };
    clock('+x', 0, 15, 8);
    clock('-z', 0, 15, 8);
    clock('+z', 0, 10, 7.6);
    clock('-x', 0, 19.6, 7.2);

    // ---------- bells over the bell deck ----------
    const bell = (x, z) => {
      k.box(x, 18.8, z, 3.2, 0.6, 3.2, BRASS2);
      k.box(x, 19.4, z, 2.6, 2.4, 2.6, BRASS);
      k.box(x, 21.8, z, 1.6, 0.8, 1.6, BRASS2);
      k.box(x, 22.6, z, 0.5, 1.4, 0.5, DARK);
      k.deco(x, 18.2, z, 0.4, 0.6, 0.4, DARK);
    };
    bell(0, 12);
    bell(-12, 1);
    bell(13, -13);

    // ---------- clockwork and clutter: vaults, slide-unders, things to juke around ----------
    // ground
    k.box(2, 0, -14, 5, 1, 2, BRASS2);                             // N: gear housing to vault
    k.box(0, 1.25, -9, 12, 0.35, 0.35, IRON);                      // N: drive axle - slide under or hop it
    k.box(10, 0, -10, 1.6, 1.4, 1.6, CRATE);
    k.box(15.5, 0, -15.5, 2, 1.2, 2, CRATE);
    k.box(9, 0, -2, 1.4, 1.2, 1.4, CRATE);
    k.box(14.5, 0, 8.5, 2, 2.4, 2, IRON);                          // SE: spare counterweight
    k.box(0, 1.25, 9, 12, 0.35, 0.35, IRON);                       // S: axle
    k.box(3.5, 0, 15, 1.6, 1.4, 1.6, CRATE);
    k.box(-9, 0, 12, 0.4, 4.5, 4, STONE);                          // SW: a little room
    k.box(-14, 0, 9, 4, 4.5, 0.4, STONE);
    k.box(-12, 0, -1, 3, 1, 3, BRASS2);                            // W: machine
    k.box(-15, 0, -8, 1.6, 1.6, 1.6, CRATE);
    // gallery 5
    k.box(2, 5, -14, 2.5, 1, 2.5, BRASS2);
    k.box(16, 5, -10, 1.6, 1.2, 1.6, CRATE);
    k.box(-3, 5, 9, 1.4, 1.2, 1.4, CRATE);
    k.box(-12, 5, -2, 6, 4.5, 0.4, STONE);                         // W: partition, run around either end
    k.box(-16, 5, 8, 1.4, 1.4, 1.4, CRATE);
    // gallery 10
    k.box(-4, 10, -15, 1.4, 1.2, 1.4, CRATE);
    k.box(15, 10, -3, 1.6, 1.4, 1.6, CRATE);
    k.box(-12, 10, 2.5, 0.4, 4.5, 6, STONE);                       // W: partition
    k.box(-16, 10, -12, 1.4, 1.4, 1.4, CRATE);
    k.box(13, 10, 10, 2.5, 1, 2.5, BRASS2);
    k.box(10, 11.25, 15, 0.35, 0.35, 6, IRON);                     // SE: axle to slide under
    // bell deck
    k.box(-3, 15, 15, 1.6, 1.2, 1.6, CRATE);
    k.box(15.5, 15, 15.5, 1.6, 1.6, 1.6, CRATE);
  },
});
