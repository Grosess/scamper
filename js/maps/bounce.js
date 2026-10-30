// BOUNCE HOUSE - a long indoor trampoline park with a Z-shaped hall: the west half is wider to the
// north, the east half wider to the south, with angled corners where they meet.
//   runway       a long line of red mats down the middle of the hall - bounce end to end
//   west         a sunken foam pit (stepped foam blocks to climb out, a green tramp up to the
//                west terrace) and terraces stepping up the north wall: 2.2 -> 4.4 -> 6.6
//   east         terraces up the north wall (2.2 -> 4.4 -> 6.6), an 8.8 end balcony with an
//                orange kick chimney up to it, and a long bridge back along the south wall
//   middle       a bridge (4.4) across the runway from the west terraces to the south deck (4.4)
// Loops: around the runway on the floor, and a figure-eight over the decks and bridges.
// Ceiling 15 - the strongest launch tops out well below it.
defineMap({
  id: 'bounce',
  accent: ['#e2463c', '#3b6fd4'],
  name: 'Bounce House',
  blurb: 'A long trampoline park: a bounce runway, a foam pit, terraces stepping up both ends, launch pads.',
  env: 'indoor',
  sky: '#1f2742',
  fog: [45, 120],
  hemi: ['#ffffff', '#8a93aa', 1.3],
  sun: [0.5, 4, 60, 6],
  size: 40,
  spotHeight: 14.6,
  spots: [-28, -14, 0, 14, 28].flatMap((x) => [-6, 6].map((z) => ({ x, z }))),
  menuCam: { path: [[-28, 8, 2], [26, 8, 2]] },
  spawns: [
    [-22, 0, -7], [-20, 0, 7], [-12, 0, -6], [-2, 0, -8], [2, 0, 8], [8, 0, -6], [16, 0, 7.5], [20, 0, -5],
    [26, 0, 8], [-24, 6.6, -13.5], [-12, 4.4, -13.5], [0, 2.2, -13.5], [2, 4.4, 13.5], [31.5, 6.6, -9],
    [36, 8.8, 6], [-22, 0, 9],
  ],
  seekerSpawn: [0, 0, -6],

  build(k) {
    const FLOOR = '#cfd5dd', WALL = '#2a3557', CEIL = '#1f2742', DECK = '#3b6fd4', DECK2 = '#5b8be0', BLOCK = '#f0b928',
      MAT = '#e2463c', LAUNCH = '#2f9e6a', CREAM = '#e9e4d8';
    const D = { tex: 'none' }, Q = Math.PI / 4;

    // ---- floor, with the foam pit sunk into the west end (pit x -36..-26, z -9..5, floor -2.5) ----
    k.box(-37, -3.7, 0, 2, 3.7, 32, FLOOR, D);
    k.box(-31, -3.7, -12.5, 10, 3.7, 7, FLOOR, D);
    k.box(-31, -3.7, 10.5, 10, 3.7, 11, FLOOR, D);
    k.box(6, -3.7, 0, 64, 3.7, 32, FLOOR, D);
    k.box(-31, -3.7, -2, 10, 1.2, 14, BLOCK, D);
    enclose(k, 76, 32, 15, WALL, CEIL, D);

    // ---- the Z-shaped footprint: solid strips fill the NE and SW, angled where they meet ----
    k.box(24, 0, -13.5, 28, 15, 5, WALL, D);              // NE strip   x 10..38, z -16..-11
    k.box(-24, 0, 13.5, 28, 15, 5, WALL, D);              // SW strip   x -38..-10, z 11..16
    k.box(10, 0, -11, 3, 15, 3, WALL, { tex: 'none', rot: Q });
    k.box(-10, 0, 11, 3, 15, 3, WALL, { tex: 'none', rot: Q });
    for (const [x, z, s] of [[-38, -16, 9], [38, 16, 6], [38, -11, 6], [-38, 11, 6]]) k.box(x, 0, z, s, 15, s, WALL, { tex: 'none', rot: Q });

    // ---- the runway: red mats down the middle (gap under the bridge at x -6) ----
    for (let x = -24; x <= 28; x += 2.8) {
      if (x > -8.6 && x < -3.4) continue;
      k.pad(x, 0, 0, 2.4, 3, 12, { look: 'tramp', color: MAT });
    }

    // ---- west: terraces up the north wall, the foam pit ----
    k.box(-26, 0, -13.5, 16, 6.6, 5, DECK, D);            // 6.6  x -34..-18
    k.box(-11, 0, -13.5, 14, 4.4, 5, DECK2, D);           // 4.4  x -18..-4
    k.box(-1, 0, -13.5, 6, 2.2, 5, DECK, D);              // 2.2  x -4..2
    // foam blocks: stepped way out of the pit, set at angles
    for (const [x, z, r] of [[-27.4, -5, 0.4], [-27.6, 1.8, -0.3], [-33.5, 3.6, 0.7]]) k.box(x, -2.5, z, 2, 1.25, 2, BLOCK, { tex: 'none', rot: r });
    k.pad(-31, -2.5, -6.5, 2, 2, 22.4, { look: 'tramp', color: LAUNCH, push: { x: 0, z: -6 } });   // pit -> 6.6 terrace
    k.pad(-31, -2.5, -1, 2, 2, 13, { look: 'tramp', color: MAT });                                  // just for fun

    // ---- middle: bridge over the runway (4.4) from the west terraces to the south deck (4.4) ----
    slab(k, -6, 4.4, 0, 3, 22, DECK2, { t: 0.4, tex: 'none' });          // x -7.5..-4.5, z -11..11
    slab(k, 2.25, 4.4, 13.5, 19.5, 5, DECK2, { t: 0.4, tex: 'none' });   // south deck x -7.5..12, z 11..16
    posts(k, [[-6, -5], [-6, 5], [0, 11.4], [10, 11.4]], 0, 4.0, CREAM, 0.5);
    k.pad(4, 0, 7.5, 1.6, 1.6, 17, { color: LAUNCH, push: { x: 0, z: 5 } });       // floor -> south deck
    k.box(-2, 0, 7.8, 2, 1.2, 2, BLOCK, D);                                        // steps up to the deck
    k.box(-2, 0, 9.9, 2, 2.4, 2, BLOCK, D);

    // ---- east: terraces up the north side, the end balcony + chimney, the south bridge ----
    k.box(21, 0, -9, 6, 2.2, 4, DECK, D);                 // 2.2  x 18..24, z -11..-7
    k.box(26.5, 0, -9, 5, 4.4, 4, DECK2, D);              // 4.4  x 24..29
    k.box(31.75, 0, -9, 5.5, 6.6, 4, DECK, D);            // 6.6  x 29..34.5
    k.box(36.25, 0, 2.5, 3.5, 8.8, 27, DECK2, D);         // end balcony 8.8, x 34.5..38
    k.box(34.25, 0, 3, 0.5, 8.8, 4, '', { tex: 'kick' }); // kick chimney: two orange walls 3m apart
    k.box(30.75, 0, 3, 0.5, 8.8, 4, '', { tex: 'kick' });
    slab(k, 23.25, 8.8, 14.5, 22.5, 3, DECK, { t: 0.4, tex: 'none' });   // south bridge x 12..34.5, z 13..16
    posts(k, [[17, 14.5], [24, 14.5], [31, 14.5]], 0, 8.4, CREAM, 0.5);
    // banked ramps against the south wall under the bridge (slide down them for speed)
    k.ramp(20.5, 11.5, 3, 4, 0, 2.4, '+z', CREAM, D);
    k.ramp(27.5, 11.5, 3, 4, 0, 2.4, '+z', CREAM, D);
    k.pad(30.8, 0, 9, 1.6, 1.6, 23, { color: LAUNCH, push: { x: 3.8, z: 0 } });   // floor -> end balcony

    // ---- floor: vaults and slide bars between the runway and the walls ----
    k.box(-18, 0, -6, 4, 1, 0.6, CREAM, D);
    k.box(12, 0, 5.5, 4, 1, 0.6, CREAM, D);
    k.box(14, 1.25, -5, 0.35, 0.35, 4, MAT, D);
    posts(k, [[14, -7.2], [14, -2.8]], 0, 1.6, CREAM, 0.4);
    k.box(-16, 1.25, 6, 0.35, 0.35, 4, MAT, D);
    posts(k, [[-16, 3.8], [-16, 8.2]], 0, 1.6, CREAM, 0.4);
  },
});
