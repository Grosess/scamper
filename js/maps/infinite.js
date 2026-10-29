// THE LOOP - an endless map. The 40x40 tile repeats forever in every direction: run off one edge
// and you come in at the other, and towers march off into the pastel haze. One tile has:
//   towers      two 8m towers (lilac + blue) on one diagonal, each ringed by four 4m balconies
//   blocks      two 4m blocks (pink + mint) on the other diagonal
//   bridges     every block edge has a 4m bridge to a tower balcony - half of them cross the seam
//               into the next tile, so the bridges form an endless grid of loops up high
//   ground      juke posts, slide bars, crate steps and a hut on the seams; orange kick walls,
//               crate steps and pads take you up to the blocks; corner steps take you up the towers
// Nothing low hangs over a floor: every bridge has 3.6m under it.
const INF_W = 40;

defineMap({
  id: 'infinite',
  accent: ['#c3a6ff', '#ff8fa3'],
  name: 'The Loop',
  blurb: 'An endless map: run off one edge and you come back from the other. Towers and bridges forever.',
  env: 'fog',
  sky: '#efe3f1',
  fog: [10, 50],
  fogDensity: 0.042,
  hemi: ['#ffffff', '#b9a9c9', 1.6],
  sun: [0.9, 20, 50, 30],
  size: 40,
  wrap: INF_W,
  menuCam: { path: [[-18, 5.5, 0.5], [18, 5.5, 0.5]] },
  spawns: [
    [0, 0, 6], [0, 0, -6], [6, 0, 0], [-6, 0, 0],
    [17, 0, -2], [-17, 0, 2], [2, 0, 17], [-2, 0, -17],
    [16, 0, 13], [-16, 0, -13],
    [10, 4, -10], [-10, 4, 10], [-10, 8, -10], [10, 8, 10],
  ],
  seekerSpawn: [0, 0, 0],

  build(k) {
    const LILAC = '#c3a6ff', BLUE = '#8fb4ff', PINK = '#ff8fa3', MINT = '#7ed6c8', YEL = '#ffd166';
    const WHITE = '#f6f3f8', BAL = { [LILAC]: '#d9c9ff', [BLUE]: '#b3cbff' }, CRATE = '#e0c49a';
    const KICK = { tex: 'kick' };

    ground(k, INF_W, INF_W, '#ebe1ef', { outline: false });   // no outline, so the tiles meet without a seam line

    // ---- towers (8m) with a balcony (4m) on every side and two corner steps (6m) ----
    const tower = (tx, tz, col) => {
      k.box(tx, 0, tz, 6, 8, 6, col);
      const b = BAL[col];
      k.box(tx + 4.5, 0, tz, 3, 4, 4, b);
      k.box(tx - 4.5, 0, tz, 3, 4, 4, b);
      k.box(tx, 0, tz + 4.5, 4, 4, 3, b);
      k.box(tx, 0, tz - 4.5, 4, 4, 3, b);
      // 6m steps tucked against the tower in two opposite corners: balcony (4) -> step (6) -> top (8)
      k.box(tx + 4, 0, tz + 3, 2, 6, 2, col);
      k.box(tx - 4, 0, tz - 3, 2, 6, 2, col);
    };
    tower(-10, -10, LILAC);
    tower(10, 10, BLUE);

    // ---- blocks (4m) on the other diagonal ----
    k.box(10, 0, -10, 8, 4, 8, PINK);
    k.box(-10, 0, 10, 8, 4, 8, MINT);

    // ---- bridges at 4m: every block edge to a tower balcony (some run across the seam) ----
    const B = (ax, az, bx, bz) => bridge(k, ax, az, bx, bz, 4, 2.5, WHITE);
    B(-4, -10, 6, -10);     // pink -> lilac (+x balcony)
    B(10, -6, 10, 4);       // pink -> blue (-z balcony)
    B(14, -10, 24, -10);    // pink -> lilac in the next tile east
    B(10, -24, 10, -14);    // pink -> blue in the next tile north
    B(-6, 10, 4, 10);       // mint -> blue (-x balcony)
    B(-10, -4, -10, 6);     // mint -> lilac (+z balcony)
    B(-24, 10, -14, 10);    // mint -> blue in the next tile west
    B(-10, 14, -10, 24);    // mint -> lilac in the next tile south

    // ---- ways up onto the blocks ----
    // orange kick walls 3m off a block face
    k.box(7, 0, -17.25, 3, 4, 0.5, '#ff6a3d', KICK);     // pink, south face
    k.box(-7, 0, 17.25, 3, 4, 0.5, '#ff6a3d', KICK);     // mint, north face
    // crate steps (1.4 -> 2.8 -> pull up onto 4)
    k.box(15.2, 0, -4.9, 2.4, 1.4, 2.4, CRATE);
    k.box(15.2, 0, -7.3, 2.4, 2.8, 2.4, CRATE);
    k.box(-15.2, 0, 4.9, 2.4, 1.4, 2.4, CRATE);
    k.box(-15.2, 0, 7.3, 2.4, 2.8, 2.4, CRATE);
    // pads by the towers: straight up onto the tower top
    k.pad(-3.5, 0, -16.5, 1.4, 1.4, 21.5, { push: { x: -5, z: 5 } });
    k.pad(3.5, 0, 16.5, 1.4, 1.4, 21.5, { push: { x: 5, z: -5 } });

    // ---- the middle: four juke posts and a slide table ----
    for (const [x, z] of [[2.6, 2.6], [-2.6, 2.6], [2.6, -2.6], [-2.6, -2.6]]) k.box(x, 0, z, 1.2, 3.2, 1.2, YEL);
    slab(k, 0, 1.6, 4.6, 3, 1.6, WHITE, { t: 0.4 });                  // slide under (1.2) or hop on
    posts(k, [[-1.3, 3.95], [1.3, 3.95], [-1.3, 5.25], [1.3, 5.25]], 0, 1.2, '#b9a9c9', 0.25);
    k.box(-4.6, 0, -0.5, 0.6, 1, 3, WHITE);                           // vault wall

    // ---- on the seams (each one is shared with the next tile) ----
    // east/west seam: a slide bar between two posts, and staggered vault walls
    k.box(20, 1.2, 0, 0.4, 0.4, 5, '#5b4e6e');
    posts(k, [[20, -2.7], [20, 2.7]], 0, 1.6, '#5b4e6e', 0.4);
    k.box(17.5, 0, 5.5, 3, 1, 0.6, WHITE);
    k.box(22.5, 0, -5.5, 3, 1, 0.6, WHITE);
    // north/south seam: a crate stack to climb and circle
    k.box(0, 0, 20, 3, 1.4, 3, CRATE);
    k.box(2, 0, 22.6, 2.2, 2.8, 2.2, CRATE);
    k.box(-2.4, 0, 17.6, 1.4, 1, 1.4, CRATE);
    // the corner: a little hut with a doorway straight through it
    k.box(20, 0, 18.2, 5, 3.8, 1.2, LILAC);
    k.box(20, 0, 21.8, 5, 3.8, 1.2, LILAC);
    k.box(20, 3.8, 20, 5, 0.4, 5, PINK);
    k.box(18, 0, 20, 1, 1.6, 2.4, MINT);                              // low window sill to vault in

    // ---- staggered posts so no straight line stays empty for long ----
    for (const [x, z] of [[5, 13], [-5, -13], [13, 5], [-13, -5], [15, 1.5], [-15, -1.5], [1.5, -15], [-1.5, 15]]) {
      k.box(x, 0, z, 1, 2.6, 1, YEL);
    }
    // lamp posts with a soft glow
    for (const [x, z] of [[6, 6], [-6, -6]]) {
      k.box(x, 0, z, 0.3, 4.6, 0.3, '#5b4e6e');
      k.deco(x, 4.6, z, 0.7, 0.4, 0.7, '#fff3c4', { emissive: '#ffd27a' });
    }
  },
});
