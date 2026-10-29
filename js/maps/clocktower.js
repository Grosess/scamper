// THE CLOCKTOWER - inside a giant clock. A 12x12 shaft runs up the middle and is crossed at every
// height: the big gear set into the floor, a balance beam at 5, a turning gear-arm bridge at 10,
// bridges at 15. Around it, 3x3 cells of 12m. Galleries at 5, 10 and 15 skip cells, so tall open
// atriums sit next to stacked rooms and every floor has holes to drop through.
//
//            L1 (5)        L2 (10)       L3 (15, bell deck)
//   floored  N S W NE SW   N E W NW SE   S W NE SE  (+ bridges across the shaft)
//
// Ways up (none of them the only one):
//   0 -> 5    crates by the shaft, stairs in E, step blocks in SE, kick chimney in NW
//   5 -> 10   stairs in S, the NE gear on its axle, kick chimney in SW
//   10 -> 15  stairs in NW, stairs in E, kick chimney in N, the tall SW chimney (5 -> 15)
// Nothing moves up and down: only gears turn (and turn your view while you ride them).
// Run into a bell rope on the bell deck and the bell rings. Ceilings are 4.5m+ over every floor.
defineMap({
  id: 'clocktower',
  accent: ['#f1c40f', '#a8322d'],
  name: 'The Clocktower',
  blurb: 'Inside a giant clock. Ride the turning gears, kick up the chimneys, ring the bells on the bell deck.',
  env: 'indoor',
  sky: '#1d1712',
  fog: [45, 110],
  hemi: ['#fff3e0', '#6b5440', 1.35],
  sun: [0.5, 4, 60, 6],
  size: 22,
  spotHeight: 23.4,
  spots: [-12, 0, 12].flatMap((x) => [-12, 0, 12].map((z) => ({ x, z, color: '#ffe2b0' }))),
  menuCam: { r: 4.5, y: 6.5 },
  spawns: [
    [-15, 0, -15], [11, 0, 0], [14, 0, 15], [0, 0, -16], [-12, 0, 4], [0, 0, 13], [-15, 0, 15], [12, 0, -12],
    [3, 5, -9], [-12, 5, 3], [16, 5, -16], [-15, 5, 15],
    [9, 10, -3], [-16, 10, -16], [13, 10, 14], [-14, 10, -3],
    [13, 15, 13], [-12, 15, -3],
  ],
  seekerSpawn: [0, 0, 7.5],

  build(k) {
    // the Container Yard / Rooftops palette: a few bold flat colors
    const BRICK = '#8a5a44', CEIL = '#2b2f35', FLOOR0 = '#3a3d44', STEEL = '#59636e', DARK = '#2b2f35';
    const NAVY = '#23408e', GREEN = '#2f7d4f', RED = '#a8322d', GREY = '#b9bcc1', CREAM = '#d8d2c4';
    const GOLD = '#f1c40f', BRASS = '#d9a033', FACE = '#f4ecd8';
    const L = [0, 5, 10, 15], C = 12;   // floor heights, cell size

    ground(k, 36, 36, FLOOR0);
    enclose(k, 36, 36, 24, BRICK, CEIL);

    // ---------- galleries: one 12x12 slab per floored cell, one color per level ----------
    const cells = {
      1: ['N', 'S', 'W', 'NE', 'SW'],
      2: ['N', 'E', 'W', 'NW', 'SE'],
      3: ['S', 'W', 'NE', 'SE'],
    };
    const at = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0], NE: [1, -1], NW: [-1, -1], SE: [1, 1], SW: [-1, 1] };
    const level = [null, NAVY, GREEN, RED];
    for (const lv of [1, 2, 3]) for (const c of cells[lv]) slab(k, at[c][0] * C, L[lv], at[c][1] * C, C, C, level[lv], { t: 0.5 });

    // pillars at the shaft corners, floor to the first gallery
    posts(k, [[-6, -6], [6, -6], [-6, 6], [6, 6]], 0, 4.5, STEEL, 0.8);

    // ---------- gears: two squares a quarter-turn apart (an 8-point star) plus a hub ----------
    // the second square starts 0.02 higher so the two never share a face
    const gear = (x, y, z, s, h, speed) => {
      const m = { type: 'spin', speed };
      k.mover(x, y, z, s, h, s, GOLD, m);
      k.mover(x, y + 0.02, z, s, h, s, BRASS, { type: 'spin', speed, phase: Math.PI / 4 });
      k.mover(x, y + h + 0.02, z, s * 0.25, 0.3, s * 0.25, DARK, m);
    };

    // ---------- the shaft ----------
    // the big gear set into the floor: low enough to run straight onto (and it turns you)
    gear(0, 0, 0, 6, 0.28, 0.3);
    // a wall closes the W room off from the shaft, so the crates beside it lead up onto the W gallery
    k.box(-6.2, 0, 0, 0.4, 4.5, 11.2, CREAM);
    k.box(-5.25, 0, 0.2, 1.4, 2.4, 1.4, GREY);
    k.box(-5.25, 0, 2.2, 1.4, 1.2, 1.4, GREY);
    // balance beam at 5, north to south, over the floor gear
    slab(k, 0, 5, 0, 1.6, 12, STEEL, { t: 0.3 });
    // at 10: a gear arm that turns slowly - when it lines up it bridges the W and E galleries
    k.mover(0, 9.6, 0, 11.6, 0.4, 2.6, GOLD, { type: 'spin', speed: 0.22 });
    k.mover(0, 10, 0, 2.2, 0.3, 2.2, DARK, { type: 'spin', speed: 0.22 });
    // bridges at 15: W deck along the north side of the shaft, a corner onto the NE deck, then
    // south over the E gallery to the SE deck
    slab(k, 0, 15, -5.5, 12, 3, STEEL, { t: 0.4 });
    slab(k, 7.5, 15, 0, 3, 12, STEEL, { t: 0.4 });

    // ---------- the NE gear, turning on its axle: from the gallery at 5 up toward 10 ----------
    k.box(12, 5, -12, 0.8, 1.88, 0.8, DARK);
    gear(12, 6.9, -12, 5, 0.9, -0.3);

    // ---------- turning works under the roof (out of reach) ----------
    gear(-12, 21.6, -12, 6, 0.9, 0.25);
    gear(12, 21.6, 1, 7, 0.9, -0.18);
    gear(-11, 21.6, 12, 5, 0.9, 0.3);
    gear(13, 21.6, 13, 4, 0.9, -0.4);

    // ---------- stairs ----------
    stairs(k, 15, 3.1, '-z', 3, 0, 5, GREY);                       // E ground -> NE gallery (5)
    stairs(k, -3.1, 15, '+x', 3, 5, 10, GREY);                     // S gallery (5) -> SE gallery (10)
    stairs(k, -12, -15.1, '+z', 3, 10, 15, GREY);                  // NW gallery (10) -> W bell deck (15)
    stairs(k, 15, 3.1, '-z', 3, 10, 15, GREY);                     // E gallery (10) -> NE bell deck (15)

    // ---------- SE: step blocks up onto the S gallery (5) ----------
    k.box(9.6, 0, 12, 1.6, 1.2, 2.4, GREY);
    k.box(7.6, 0, 12, 2.4, 2.4, 2.4, STEEL);

    // ---------- kick chimneys (orange) ----------
    kickShaft(k, -8.5, -12, 'x', 5, 0, 5, BRASS);                  // NW ground -> N gallery (5)
    kickShaft(k, -12, 8.5, 'z', 5, 5, 10, BRASS);                  // SW (5) -> W gallery (10)
    kickShaft(k, -8.5, 14.5, 'x', 5, 5, 15, BRASS);                // SW (5) -> S bell deck (15), the tall one
    kickShaft(k, 4.5, -12, 'x', 3, 10, 15, BRASS);                 // N (10) -> NE bell deck (15)

    // ---------- clock faces: a big glowing square, two hands and a hub ----------
    const clock = (side, y, s, hourUp) => {
      const ax = side[1] === 'x', sg = side[0] === '+' ? 1 : -1;
      const part = (along, up, depth, a, b, col, o = {}) => {
        const w = sg * (18 - depth - 0.02), yb = y + up - b / 2;   // `depth` = how far it stands off the wall
        if (ax) k.deco(w, yb, along, 0.04, b, a, col, o); else k.deco(along, yb, w, a, b, 0.04, col, o);
      };
      part(0, 0, 0.04, s, s, FACE, { emissive: '#7a6230' });
      part(0, (hourUp ? 1 : -1) * s * 0.15, 0.1, 0.5, s * 0.3, DARK);   // hour hand: straight up or down
      part(s * 0.2, 0, 0.16, s * 0.4, 0.36, DARK);                       // minute hand: sideways
      part(0, 0, 0.22, 0.7, 0.7, RED);
    };
    clock('+x', 15, 8, true);
    clock('-z', 15, 8, false);
    clock('+z', 10, 7.6, true);
    clock('-x', 19.6, 7.2, false);

    // ---------- bells over the bell deck, each with a rope you can run into ----------
    const bell = (x, z) => {
      k.box(x, 18.8, z, 3.2, 0.6, 3.2, BRASS);
      k.box(x, 19.4, z, 2.6, 2.4, 2.6, GOLD);
      k.box(x, 21.8, z, 1.4, 0.8, 1.4, BRASS);
      k.box(x, 22.6, z, 0.5, 1.4, 0.5, DARK);
      k.bellRope(x + 0.9, 18.78, z + 0.9, 2.65, RED);
    };
    bell(0, 12);
    bell(-12, 1);
    bell(13, -13);

    // ---------- clockwork: vaults, slide-unders, blocks to juke around ----------
    // ground
    k.box(2, 0, -14, 5, 1, 2, GOLD);                               // N: gear housing to vault
    k.box(0, 1.25, -9, 12, 0.35, 0.35, DARK);                      // N: drive axle - slide under or hop it
    k.box(10, 0, -10, 1.6, 1.2, 1.6, GREY);
    k.box(15.5, 0, -15.5, 2.4, 1.2, 2.4, GREY);
    k.box(9, 0, -2, 1.4, 1.2, 1.4, GREY);
    k.box(14.5, 0, 8.5, 2.4, 2.6, 2.4, STEEL);                     // SE: spare counterweight
    k.box(0, 1.25, 9, 12, 0.35, 0.35, DARK);                       // S: axle
    k.box(3.5, 0, 15, 1.6, 1.2, 1.6, GREY);
    k.box(-9, 0, 12, 0.4, 4.5, 4, CREAM);                          // SW: a little room
    k.box(-14, 0, 9, 4, 4.5, 0.4, CREAM);
    k.box(-12, 0, -1, 3, 1, 3, GOLD);                              // W: machine
    k.box(-15, 0, -8, 1.6, 1.2, 1.6, GREY);
    // gallery 5
    k.box(2, 5, -14, 2.5, 1, 2.5, GOLD);
    k.box(16, 5, -10, 1.6, 1.2, 1.6, GREY);
    k.box(-3, 5, 9, 1.4, 1.2, 1.4, GREY);
    k.box(-12, 5, -2, 6, 4.5, 0.4, CREAM);                         // W: partition, run around either end
    k.box(-16, 5, 8, 1.6, 1.2, 1.6, GREY);
    // gallery 10
    k.box(-4, 10, -15, 1.4, 1.2, 1.4, GREY);
    k.box(9, 10, 3, 1.6, 1.2, 1.6, GREY);
    k.box(-12, 10, 2.5, 0.4, 4.5, 6, CREAM);                       // W: partition
    k.box(-16, 10, -12, 1.6, 1.2, 1.6, GREY);
    k.box(13, 10, 10, 2.5, 1, 2.5, GOLD);
    k.box(10, 11.25, 15, 0.35, 0.35, 6, DARK);                     // SE: axle to slide under
    // bell deck
    k.box(-3, 15, 15, 1.6, 1.2, 1.6, GREY);
    k.box(15.5, 15, 15.5, 1.6, 1.2, 1.6, GREY);
  },
});
