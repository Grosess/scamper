// THE COURT - a compact 22x22 parkour court (World Chase Tag style). Everything is close,
// everything is passable, so chases are all jukes and skill:
//   center      a 2.4m block (jump + pull up), an A-frame on the north side, a table on the
//               south side you slide under or hop onto
//   ring        four low vault walls and four juke pillars around the center
//   corners     four 4m towers, each with a different way up:
//               NE kick chimney (striped) - NW ramp - SE step blocks - SW jump pad
// Floors and ceilings never trap your head: the hall is 12m tall.
defineMap({
  id: 'court',
  accent: ['#8fb4ff', '#ffd166'],
  name: 'The Court',
  blurb: 'A small parkour court. Vaults, an A-frame, a slide table, juke pillars and four climbable towers.',
  env: 'indoor',
  sky: '#141824',
  fog: [40, 90],
  hemi: ['#ffffff', '#7a88a6', 1.25],
  sun: [0.5, 4, 60, 6],
  size: 18,
  spotHeight: 11.4,
  spots: [-7, 7].flatMap((x) => [-7, 7].map((z) => ({ x, z }))).concat([{ x: 0, z: 0 }]),
  menuCam: { r: 13, y: 8 },
  spawns: [
    [6, 0, 3], [-6, 0, -3], [6, 0, -3], [-6, 0, 3], [0, 0, 10.5], [0, 0, -10.5], [10.5, 0, 0], [-10.5, 0, 0],
  ],
  seekerSpawn: [0, 2.4, 0],

  build(k) {
    const WHITE = '#f2f4f7', BLUE = '#8fb4ff', PINK = '#ff8fa3', YEL = '#ffd166', MINT = '#7ed6c8', LILAC = '#c3a6ff';
    const F = { tex: 'foam' };
    ground(k, 30, 30, '#e3e8ef', { tex: 'tiles', uv: 0.5 });
    enclose(k, 30, 30, 12, '#eef2f6', '#f6f8fb');
    k.deco(0, 0.02, 0, 22, 0.02, 22, BLUE, { tex: 'foam', uv: 0.5 });
    for (const [x, z, w, d] of [[0, -11, 22, 0.15], [0, 11, 22, 0.15], [-11, 0, 0.15, 22], [11, 0, 0.15, 22]]) k.deco(x, 0.05, z, w, 0.02, d, WHITE, { tex: 'none' });

    // --- center: block, A-frame (north), slide table (south) ---
    k.box(0, 0, 0, 3, 2.4, 3, WHITE, F);
    k.ramp(0, -6.5, 2.4, 3, 0, 2, '+z', MINT, F);
    k.ramp(0, -3.5, 2.4, 3, 0, 2, '-z', MINT, F);
    slab(k, 0, 1.6, 6, 3, 4, YEL, Object.assign({ t: 0.4 }, F));            // underside at 1.2: slide under
    posts(k, [[-1.35, 4.15], [1.35, 4.15], [-1.35, 7.85], [1.35, 7.85]], 0, 1.2, WHITE, 0.3);

    // --- ring: vault walls + juke pillars ---
    for (const s of [-1, 1]) {
      k.box(s * 4.5, 0, 0, 0.6, 1.0, 3, PINK, F);                           // vault walls east/west
      k.box(s * 3.5, 0, s * -9, 3, 1.0, 0.6, PINK, F);                      // vault walls by the A-frame / table
    }
    posts(k, [[5, 5], [-5, 5], [5, -5], [-5, -5]], 0, 3.5, LILAC, 0.8);

    // --- corner towers (top 4), four different ways up ---
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.box(sx * 8, 0, sz * 8, 3, 4, 3, WHITE, F);
    // NE: kick chimney between the tower and a striped wall 2.7m away
    k.box(3.6, 0, -8, 0.4, 4, 3, BLUE, { tex: 'kick', uv: 0.5 });
    // NW: ramp up the west face
    k.ramp(-8, -4.25, 3, 4.5, 0, 4, '-z', MINT, F);
    // SE: step blocks (1.2 -> 2.4 -> pull up onto 4)
    k.box(8, 0, 5.3, 2, 1.2, 2.4, YEL, F);
    k.box(5.4, 0, 8, 1.6, 2.4, 2, YEL, F);
    // SW: jump pad
    k.pad(-4.9, 0, 8, 1.4, 1.4, 16, { push: { x: -2.6, z: 0 } });

    // benches around the court edge (cover + low hops)
    for (const [x, z, w, d] of [[0, 13, 6, 0.8], [0, -13, 6, 0.8], [13, 0, 0.8, 6], [-13, 0, 0.8, 6]]) k.box(x, 0, z, w, 0.6, d, '#d6dce6', F);
  },
});
