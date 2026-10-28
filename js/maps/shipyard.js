// CONTAINER YARD - a port terminal of container piles on a dock, sea all around.
//   piles      4 x 4 grid of brick-stacked piles, 1 to 7 layers (2.6m each, up to 18.2m).
//              Each layer overhangs the one below, so you climb them ledge by ledge.
//   alleys     3-4m between piles - wall-kick up them
//   bridges    hollow containers laid across alleys between piles of the same height:
//              run through them at pile-top level, or along their roofs
//   skewed     containers dumped at angles on the dock and on top of piles (real collision)
//   leaners    containers tipped against the edge piles as ramps
//   crane      gantry beam 21m up; the pad on the tallest pile launches you onto it. Its trolley
//              and hanging spreader are solid - the spreader is a perch over the middle alley
//   kick towers orange access shafts at both ends of the crane: kick up from the dock to the beam
defineMap({
  id: 'shipyard',
  accent: ['#a8322d', '#23408e'],
  name: 'Container Yard',
  blurb: 'A port terminal by the sea. Container piles up to 18m, container bridges, skewed stacks, a crane.',
  env: 'sky',
  sky: '#a9d6ff',
  fog: [90, 300],
  hemi: ['#eaf4ff', '#5a6470', 0.9],
  sun: [1.0, 30, 55, 20],
  size: 30,
  sea: -2,
  killY: -4,
  menuCam: { r: 34, y: 24 },
  spawns: [
    [-9, 0, -9], [0, 0, 0], [9, 0, 9], [-9, 0, 9], [9, 0, -9], [0, 0, -9], [0, 0, 9],
    [-9, 0, 0], [9, 0, 0], [-21, 0, -6], [21, 0, 4], [-13.5, 7.8, -4.5], [-13.5, 10.4, 4.5],
  ],
  seekerSpawn: [4.5, 18.2, 6],

  build(k) {
    const RED = '#a8322d', BLUE = '#23408e', GREY = '#b9bcc1', GREEN = '#2f7d4f', R = { tex: 'ribs', uv: 0.35 };
    ground(k, 52, 52, '#646a73');
    for (const [x, z, w, d] of [[0, -25.8, 52, 0.4], [0, 25.8, 52, 0.4], [-25.8, 0, 0.4, 52], [25.8, 0, 0.4, 52]]) {
      k.deco(x, 0, z, w, 0.03, d, '#ffd23f', { tex: 'none' });
    }
    for (let v = -22; v <= 22; v += 11) for (const s of [-1, 1]) {
      k.box(v, 0, s * 25.2, 0.5, 0.7, 0.5, '#2b2f35', { tex: 'none' });
      if (v !== 0) k.box(s * 25.2, 0, v, 0.5, 0.7, 0.5, '#2b2f35', { tex: 'none' });   // (the kick towers stand at v = 0)
    }

    // --- the piles: LAYERS[row][col], row = z, col = x ---
    const P = [-13.5, -4.5, 4.5, 13.5];
    const LAYERS = [
      [2, 2, 4, 1],
      [3, 6, 6, 4],
      [4, 6, 7, 2],
      [1, 4, 4, 2],
    ];
    const HOLLOW = { '0,1': [0], '1,0': [0, 2], '1,2': [1], '2,3': [0], '3,2': [0, 3], '2,0': [2], '0,2': [0], '3,1': [1] };
    LAYERS.forEach((row, r) => row.forEach((n, c) => {
      pile(k, P[c], P[r], n, {
        start: (r + c) % 2, seed: r * 3 + c, hollow: HOLLOW[`${r},${c}`] || [],
        colors: (r + c) % 3 === 2 ? [GREY, RED] : [RED, BLUE],
      });
    }));

    // --- container bridges between equal-height piles (hollow: run through or over) ---
    container(k, -9.3, 5.2, -13.5, 'x', 6, true, GREEN);     // (-13.5,-13.5) <-> (-4.5,-13.5) at 5.2
    container(k, -0.3, 15.6, -4.5, 'x', 6, true, GREY);      // (-4.5,-4.5)  <-> (4.5,-4.5)   at 15.6
    container(k, -4.5, 15.6, 0.3, 'z', 6, true, GREEN);      // (-4.5,-4.5)  <-> (-4.5,4.5)   at 15.6
    container(k, -0.3, 10.4, 13.5, 'x', 6, true, BLUE);      // (-4.5,13.5)  <-> (4.5,13.5)   at 10.4

    // --- skewed containers ---
    container(k, 4.5, 10.4, -13.5, 'x', 6, false, BLUE, 0.5);    // dumped askew on top of a pile
    container(k, -13.5, 2.6, 13.5, 'z', 6, false, RED, -0.35);
    container(k, 13.5, 5.2, 4.5, 'x', 6, true, GREY, 0.3);
    container(k, -21, 0, 8, 'z', 6, false, BLUE, 0.4);           // on the dock
    container(k, 21.5, 0, -12, 'z', 6, true, RED, -0.45);
    container(k, 11, 0, 21.5, 'x', 6, false, GREY, 0.2);
    container(k, 11, 2.6, 21.3, 'x', 6, false, RED, -0.15);
    container(k, -10, 0, -21.5, 'x', 6, false, GREEN, -0.3);

    // --- leaners against the edge piles ---
    k.ramp(-19, -13.5, 5, 2.4, 0, 2.6, '+x', BLUE, R);
    k.ramp(19, -4.5, 5, 2.4, 0, 2.6, '-x', RED, R);
    k.ramp(-4.5, 18.4, 2.4, 5, 0, 2.6, '-z', RED, R);
    k.ramp(13.5, -19, 2.4, 5, 0, 2.6, '+z', BLUE, R);

    // --- gantry crane over the middle alley (z = 0) ---
    const Y = '#f1c40f';
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.box(sx * 21, 0, sz * 2.2, 1.2, 21, 1.2, Y, { tex: 'none' });
    k.box(0, 21, 0, 43.2, 0.8, 3, Y, { tex: 'grid' });
    // trolley, cable and spreader - all solid, hung over the east end (clear of the pad's flight)
    k.box(13.5, 19.4, 0, 3, 1.6, 2.6, '#c0392b');
    k.box(13.5, 12, 0, 0.14, 7.4, 0.14, '#222222', { tex: 'none' });
    k.box(13.5, 11.4, 0, 4.4, 0.6, 2.6, '#c0392b');
    k.pad(4.5, 18.2, 3, 1.2, 1.2, 15, { push: { x: 0, z: -2.5 } });
    // kick towers just past each end of the beam: wall-kick up from the dock, step onto the beam
    for (const s of [-1, 1]) kickShaft(k, s * 23.5, 0, 'x', 3, 0, 21.8, Y);
  },
});
