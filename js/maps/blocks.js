// THE BLOCKS - a tight 3x3 grid of 5x5 blocks with 3m alleys, floating in the void.
// Chases flow between the street and the rooftops:
//   blocks    most are 3m tall (jump + pull up from the street); three are 5.6m (pull up from a
//             neighbouring rooftop across the alley)
//   alleys    3m wide = every alley is a wall-kick chimney. Each alley segment has one obstacle:
//             a vault barrier, a slide bar (gap under it) or a step crate
//   street    a ring around the grid with two ramps and two corner pads up onto the roofs.
//             The edge drops into the void.
defineMap({
  id: 'blocks',
  accent: ['#ff8fa3', '#7ed6c8'],
  name: 'The Blocks',
  blurb: 'A tight grid of blocks and 3m alleys. Kick up any alley, vault, slide, and run the rooftops.',
  fog: [35, 110],
  hemi: ['#ffffff', '#5a6478', 1.4],
  sun: [0.7, 8, 60, 10],
  size: 18,
  spotHeight: 22,
  spots: [-8, 0, 8].flatMap((x) => [-8, 8].map((z) => ({ x, z }))).concat([{ x: 0, z: 0 }]),
  menuCam: { r: 22, y: 15 },
  spawns: [
    [12.25, 0, 0], [-12.25, 0, 0], [0, 0, 12.25], [0, 0, -12.25], [4, 0, 4], [-4, 0, -4],
    [-8, 3, -8], [8, 3, 8], [-8, 3, 0], [0, 3, 8],
  ],
  seekerSpawn: [0, 3, 0],

  build(k) {
    const C = [-8, 0, 8];
    const H = [[3, 5.6, 3], [3, 3, 5.6], [5.6, 3, 3]];      // [row z][col x]
    const COL = ['#ff8fa3', '#8fb4ff', '#ffd166', '#7ed6c8', '#c3a6ff', '#ffb37a', '#9be3a8', '#a8dcef', '#ff8fa3'];
    const STREET = '#d6dce6', F = { tex: 'foam' };
    ground(k, 28, 28, STREET, { tex: 'tiles', uv: 0.5 });
    for (const [x, z, w, d] of [[0, -13.9, 28, 0.2], [0, 13.9, 28, 0.2], [-13.9, 0, 0.2, 28], [13.9, 0, 0.2, 28]]) k.deco(x, 0.02, z, w, 0.03, d, '#ff6b6b', { tex: 'none' });

    // --- the blocks ---
    C.forEach((z, r) => C.forEach((x, c) => k.box(x, 0, z, 5, H[r][c], 5, COL[r * 3 + c], F)));

    // --- one obstacle per alley segment ---
    const vault = (x, z, alongZ) => k.box(x, 0, z, alongZ ? 3 : 0.6, 1.0, alongZ ? 0.6 : 3, '#f2f4f7', F);
    const bar = (x, z, alongZ) => k.box(x, 1.25, z, alongZ ? 3 : 0.35, 0.35, alongZ ? 0.35 : 3, '#1f2433', { tex: 'none' });
    const crate = (x, z) => k.box(x, 0, z, 1.4, 1.4, 1.4, '#b7bcc6', { tex: 'planks' });
    // alleys running north-south (between columns, x = +-4)
    vault(-4, -8, true); bar(4, -8, true);
    crate(-4, 0);                       // (4, 0) left open: a clean kick chimney
    bar(-4, 8, true); vault(4, 8, true);
    // alleys running east-west (between rows, z = +-4)
    bar(-8, -4, false); vault(0, -4, false);          // (8, -4) open
    crate(0, 4); bar(8, 4, false);                     // (-8, 4) open

    // --- street ramps + corner pads up onto the roofs ---
    k.ramp(-12.25, -8, 3.5, 5, 0, 3, '+x', '#c3a6ff', F);       // onto (-8,-8) from the west
    k.ramp(12.25, 8, 3.5, 5, 0, 3, '-x', '#c3a6ff', F);         // onto (8,8) from the east
    k.pad(12.25, 0, -12.25, 1.4, 1.4, 15, { push: { x: -2.4, z: 2.4 } });   // onto (8,-8)
    k.pad(-12.25, 0, 12.25, 1.4, 1.4, 19, { push: { x: 2.4, z: -2.4 } });  // onto the tall (-8,8)
  },
});
