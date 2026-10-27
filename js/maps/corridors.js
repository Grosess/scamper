// THE CORRIDORS - two floors of looping 3m-wide hallways (an office maze). Built from the ASCII
// grids below - each character is a 3x3m cell, so you can redraw the map right here.
//
//   ground floor (G)                upper floor (U)
//   #  wall                         #  wall
//   .  corridor                     .  corridor (floor on top of the ground floor)
//   v  vent - 3m crawl tunnel       w  low wall to vault
//   w  low wall to vault            o  shaft: hole down to the ground floor. The corridor under it
//   c  crate to juke around            has striped walls - wall-kick up through it, or drop down
//                                   S  stairwell hole (stairs below)
//
// Ground floor ceiling is 3.6m up, upper floor ceiling 4.4m up - nothing to bump your head on.
const CORRIDOR_G = [
  '#############',
  '#..c..#.....#',
  '#.###.#.###.#',
  '#.#.......#.#',
  '#.#.##w##.#.#',
  '#...#...#...#',
  '###.v.#.v.###',
  '#...#...#...#',
  '#.#.##w##.#.#',
  '#.#.......#.#',
  '#.###.#.###.#',
  '#.....#..c..#',
  '#############',
];
const CORRIDOR_U = [
  '#############',
  '#...........#',
  '#.##.###.##S#',
  '#o#.......#S#',
  '#.#.#.#.#.#S#',
  '#.....#.....#',
  '#.##w.#.w##.#',
  '#.....#.....#',
  '#S#.#.#.#.#.#',
  '#S#.......#o#',
  '#S##.###.##.#',
  '#...........#',
  '#############',
];

defineMap({
  id: 'corridors',
  accent: ['#c3a6ff', '#a8dcef'],
  name: 'The Corridors',
  blurb: 'Two floors of looping 3m hallways. Vents to slide through, kick shafts between floors, stairwells.',
  env: 'indoor',
  sky: '#141824',
  fog: [22, 60],
  hemi: ['#ffffff', '#7a86a3', 1.25],
  sun: [0.45, 4, 60, 6],
  size: 22,
  spotHeight: 8,
  spots: [-12, 0, 12].flatMap((x) => [-12, 0, 12].map((z) => ({ x, z }))),
  menuCam: { path: [[-15, 5.8, 15], [9, 5.8, 15]] },   // drifts down the long south corridor upstairs
  spawns: [
    [-15, 0, -15], [15, 0, 15], [-15, 0, 15], [15, 0, -15], [-3, 0, 0], [3, 0, 0],
    [0, 0, -9], [0, 0, 9], [-6, 4, -15], [6, 4, 15], [-15, 4, 0], [15, 4, 0],
  ],
  seekerSpawn: [-3, 0, 0],

  build(k) {
    const N = 13, S = 3, F1 = 4, TOP = 8.4;
    const X = (c) => (c - (N - 1) / 2) * S, Z = (r) => (r - (N - 1) / 2) * S;
    const W = N * S;
    const T = { tex: 'tiles', uv: 0.5 };
    const REGION = ['#8fb4ff', '#ff8fa3', '#7ed6c8', '#ffd166'];   // wall colors by quarter
    const col = (r, c) => REGION[(r < N / 2 ? 0 : 2) + (c < N / 2 ? 0 : 1)];
    const g = (r, c) => (CORRIDOR_G[r] || '')[c] || '#';
    const u = (r, c) => (CORRIDOR_U[r] || '')[c] || '#';
    const nearShaft = (r, c) => [[0, 1], [0, -1], [1, 0], [-1, 0]].some(([dr, dc]) => u(r + dr, c + dc) === 'o');

    ground(k, W, W, '#e3e8ef', T);
    enclose(k, W, W, TOP, '#eef2f6', '#f6f8fb');

    const hole = (r, c) => u(r, c) === 'o' || u(r, c) === 'S';
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      const x = X(c), z = Z(r), G = g(r, c), U = u(r, c);
      const kick = nearShaft(r, c);
      const wall = { tex: kick ? 'kick' : 'grid', uv: 0.5 };
      // ground floor (walls stop under the upper floor slab)
      if (G === '#') k.box(x, 0, z, S, F1 - 0.4, S, kick ? '#8fb4ff' : col(r, c), wall);
      else if (G === 'v') k.box(x, 1.2, z, S, F1 - 1.6, S, '#b7bcc6', { tex: 'grid', uv: 0.5 });   // crawl under
      else if (G === 'w') k.box(x, 0, z, S, 1.0, S, '#f2f4f7', { tex: 'foam' });
      else if (G === 'c') k.box(x, 0, z, 1.4, 1.2, 1.4, '#c7a77a', { tex: 'planks' });
      // upper floor
      if (U === '#') k.box(x, F1, z, S, TOP - F1, S, kick ? '#8fb4ff' : col(r, c), wall);
      else if (U === 'w') k.box(x, F1, z, S, 1.0, S, '#f2f4f7', { tex: 'foam' });
    }
    // the upper floor: one slab per row, broken only by the shaft and stairwell holes
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N;) {
        if (hole(r, c)) { c++; continue; }
        let e = c;
        while (e + 1 < N && !hole(r, e + 1)) e++;
        slab(k, (X(c) + X(e)) / 2, F1, Z(r), (e - c + 1) * S, S, '#e3e8ef', Object.assign({ t: 0.4 }, T));
        c = e + 1;
      }
    }

    // stairwells (under the S holes), 7m long, topping out where the hole meets the upper floor:
    // the west one climbs north, the east one climbs south
    const RUN = 7;
    stairs(k, X(1), Z(8) - S / 2 + RUN, '-z', S, 0, F1, '#c3a6ff', T);
    stairs(k, X(11), Z(4) + S / 2 - RUN, '+z', S, 0, F1, '#c3a6ff', T);
  },
});
