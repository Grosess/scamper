// BOUNCE HOUSE - an indoor trampoline park. Plenty of plain floor; the trampolines are extras:
//   center court   a 4x4 grid of red mats (playful ~3m hops), walkable strips between them
//   launch pads    green pads throw you onto the decks (east deck 4.4, north balcony 8.8)
//   foam pit       sunken pit on the west with yellow tramps up onto the west ledge (4.4)
//   decks          west ledge -> south deck -> east deck at 4.4, a tower + north balcony at 8.8
//   kick routes    two orange two-wall chimneys from the floor up to the balcony (8.8)
//   ninja line     stepping pillars up to the south deck; vaults and slide bars on the floor
// Ceiling 14 - the strongest pad tops out well under it.
defineMap({
  id: 'bounce',
  accent: ['#e2463c', '#3b6fd4'],
  name: 'Bounce House',
  blurb: 'An indoor trampoline park. Bounce court, launch pads to the decks, a foam pit, kick chimneys.',
  env: 'indoor',
  sky: '#1f2742',
  fog: [40, 110],
  hemi: ['#ffffff', '#8a93aa', 1.3],
  sun: [0.5, 4, 60, 6],
  size: 28,
  spotHeight: 13.6,
  spots: [-16, 0, 16].flatMap((x) => [-12, 0, 12].map((z) => ({ x, z }))),
  menuCam: { r: 18, y: 11 },
  spawns: [
    [0, 0, -8.5], [0, 0, 8.5], [-8, 0, -9], [8, 0, -9], [-8, 0, 9], [8, 0, 9],
    [18, 0, 0], [-4, 0, 19], [12, 0, -15], [-20, 0, -15],
    [20, 4.4, 2], [-23, 4.4, 0], [0, 4.4, 19.5], [21, 8.8, -12], [0, 8.8, -19.5], [-14, -2.5, 2],
  ],
  seekerSpawn: [0, 0, -8.5],

  build(k) {
    const FLOOR = '#cfd5dd', WALL = '#2a3557', CEIL = '#1f2742', DECK = '#3b6fd4', BLOCK = '#f0b928',
      MAT = '#e2463c', LAUNCH = '#2f9e6a', PAD = '#e9e4d8', POST = '#e9e4d8';
    const D = { tex: 'none' };

    // ---- floor (with the foam pit cut out of the west side), walls, ceiling ----
    k.box(0, -3.7, -17, 50, 3.7, 10, FLOOR, D);          // north band
    k.box(0, -3.7, 17, 50, 3.7, 10, FLOOR, D);           // south band
    k.box(-23, -3.7, 0, 4, 3.7, 24, FLOOR, D);           // west strip (under the ledge)
    k.box(6.5, -3.7, 0, 37, 3.7, 24, FLOOR, D);          // middle + east
    k.box(-16.5, -3.7, 0, 9, 1.2, 24, BLOCK, D);         // foam pit floor (top -2.5)
    enclose(k, 50, 44, 14, WALL, CEIL, D);

    // ---- center court: 4x4 red mats, walkable strips between ----
    for (const x of [-3.9, -1.3, 1.3, 3.9]) for (const z of [-3.9, -1.3, 1.3, 3.9]) k.pad(x, 0, z, 2, 2, 13, { look: 'tramp', color: MAT });
    // vaults either side of the court
    k.box(-10.5, 0, 0, 0.6, 1, 4, PAD, D);
    k.box(10.5, 0, 0, 0.6, 1, 2, PAD, D);

    // ---- east deck (4.4) on posts, tower (8.8) at its north end ----
    slab(k, 19, 4.4, 7.5, 10, 29, DECK, { t: 0.4, tex: 'none' });
    posts(k, [[14.5, -6.5], [23.5, -6.5], [14.5, 7.5], [23.5, 7.5], [14.5, 21.5], [23.5, 21.5]], 0, 4.0, POST, 0.5);
    k.box(21, 0, -12, 6, 8.8, 10, BLOCK, D);              // tower x 18..24, z -17..-7
    k.pad(11, 0, -4, 1.6, 1.6, 17, { color: LAUNCH, push: { x: 5.5, z: 0 } });   // court -> east deck
    k.pad(11, 0, 4, 1.6, 1.6, 17, { color: LAUNCH, push: { x: 5.5, z: 0 } });
    k.pad(20, 4.4, -5.8, 1.6, 1.6, 16.5, { color: LAUNCH, push: { x: 0, z: -2 } });   // deck -> tower
    k.box(12.5, 0, 7, 2, 1.2, 2, BLOCK, D);               // step blocks up onto the deck
    k.box(12.5, 0, 9.5, 2, 2.4, 2, BLOCK, D);

    // ---- north balcony (8.8) and the two kick chimneys up to it ----
    slab(k, -2.5, 8.8, -19.5, 41, 5, DECK, { t: 0.4, tex: 'none' });   // x -23..18, z -22..-17
    posts(k, [[-14, -17.4], [0, -17.4], [9, -17.4]], 0, 8.4, POST, 0.5);
    k.box(15, 0, -14.5, 0.5, 8.8, 5, '', { tex: 'kick' });        // east chimney: this wall + the tower's west face
    k.box(-15, 0, -14.5, 0.5, 8.8, 5, '', { tex: 'kick' });       // west chimney: two orange walls
    k.box(-18.5, 0, -14.5, 0.5, 8.8, 5, '', { tex: 'kick' });
    k.pad(0, 0, -13, 1.6, 1.6, 22, { color: LAUNCH, push: { x: 0, z: -4.5 } });   // floor -> balcony
    // floor clutter in the north lane: vaults and a slide bar
    k.box(-7, 0, -11, 4, 1, 0.6, PAD, D);
    k.box(7, 0, -11, 4, 1, 0.6, PAD, D);
    k.box(0, 1.25, -9.6, 4, 0.35, 0.35, MAT, D);
    posts(k, [[-2.2, -9.6], [2.2, -9.6]], 0, 1.6, POST, 0.4);

    // ---- foam pit (west, floor -2.5), its tramps and the west ledge (4.4) ----
    for (const z of [-5, 5]) k.pad(-17, -2.5, z, 1.8, 1.8, 21, { look: 'tramp', color: LAUNCH, push: { x: -4.5, z: 0 } });
    for (const [x, z] of [[-13.5, -8], [-13.5, 8], [-16, 0]]) k.box(x, -2.5, z, 2, 1.25, 2, BLOCK, D);   // foam blocks: way out
    k.box(-23, 0, 0, 4, 4.4, 24, DECK, D);                 // west ledge x -25..-21
    k.box(-23, 0, -14, 3, 2.2, 3, BLOCK, D);              // step up onto the ledge from the north
    slab(k, -23, 4.4, 14.5, 4, 5, DECK, { t: 0.4, tex: 'none' });   // ledge -> south deck

    // ---- south deck (4.4) and the ninja line up to it ----
    slab(k, -5.5, 4.4, 19.5, 39, 5, DECK, { t: 0.4, tex: 'none' });   // x -25..14, z 17..22
    posts(k, [[-14, 17.4], [-5, 17.4], [5, 17.4]], 0, 4.0, POST, 0.5);
    k.box(-7, 0, 12, 2.5, 1.2, 2.5, BLOCK, D);
    k.box(-3.5, 0, 12, 2.5, 2.4, 2.5, BLOCK, D);
    k.box(-3.5, 0, 15.75, 2.5, 2.4, 2.5, BLOCK, D);
    k.pad(6, 0, 12.5, 1.6, 1.6, 17, { color: LAUNCH, push: { x: 0, z: 4.5 } });   // floor -> south deck
    k.box(10, 1.25, 10, 0.35, 0.35, 4, MAT, D);           // slide bar between court and deck stairs
    posts(k, [[10, 7.8], [10, 12.2]], 0, 1.6, POST, 0.4);
  },
});
