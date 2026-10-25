// THE POOLROOMS - a tiled bathhouse sealed in a tiled box (floors every 4m):
//   corners     four 3-floor bath houses (walls + doorways, stairs inside, roofs at 12)
//   4           balcony ring linking the bath houses' first floors, on pillars
//   8           north + south galleries linking the second floors
//   12          east + west roof bridges
//   center      pool with a 3-tier fountain (3.2 / 6.4 / 9.6), bounce pads in the water
//   cabanas     four poolside huts; their roofs are level with the balcony
//   kick shafts striped shafts in front of the balconies (north/south up to 8, east/west up to 12)
//   slides      balcony -> pool (north/south), fountain -> balcony (east/west sky slides)
defineMap({
  id: 'poolrooms',
  accent: ['#2e8fb3', '#8fd0e6'],
  name: 'The Poolrooms',
  blurb: 'A sealed tiled bathhouse. Bath houses, galleries on three levels, a fountain tower and slides.',
  env: 'indoor',
  sky: '#dfeaec',
  fog: [45, 120],
  hemi: ['#ffffff', '#cfe6ea', 1.15],
  sun: [0.45, 6, 60, 10],
  size: 32,
  spotHeight: 17.4,
  spots: [-18, 0, 18].flatMap((x) => [-18, 0, 18].map((z) => ({ x, z }))),
  menuCam: { r: 20, y: 11 },
  spawns: [
    [15, 0, -3], [-15, 0, 3], [6, 0, -15], [-6, 0, 15], [5, 0, 15], [-5, 0, -15],
    [0, 4, -22], [0, 4, 22], [22, 12, 0], [-10, 8, -21], [22, 4, 20], [-22, 4, -20],
  ],
  seekerSpawn: [0, 9.6, 0],

  build(k) {
    const TILE = '#e9f0f1', TRIM = '#9fd6e8', T = { tex: 'tiles', uv: 0.5 };
    const look = { color: TILE, wall: TILE, stair: TRIM, post: TRIM, tex: 'tiles', uv: 0.5 };
    ground(k, 60, 60, TILE, T);
    enclose(k, 60, 60, 18, '#f1f6f6', '#f6f9f9');

    // --- bath houses in the corners ---
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      tower(k, Object.assign({
        x: sx * 22, z: sz * 22, w: 12, d: 12, floors: 3, flip: sz > 0,
        walls: [sx > 0 ? '+x' : '-x', sz > 0 ? '+z' : '-z'],
      }, look));
    }

    for (const s of [-1, 1]) {
      // balcony ring at 4 on pillars
      bridge(k, -16, s * 22, 16, s * 22, 4, 4, TILE, T);
      bridge(k, s * 22, -16, s * 22, 16, 4, 4, TILE, T);
      for (const v of [-12, -5, 5, 12]) {
        posts(k, [[v, s * 20.4], [v, s * 23.6]], 0, 3.6, TILE, 0.7);
        posts(k, [[s * 20.4, v], [s * 23.6, v]], 0, 3.6, TILE, 0.7);
      }
      // galleries at 8 (north/south) and roof bridges at 12 (east/west)
      bridge(k, -16, s * 21, 16, s * 21, 8, 3, TRIM, T);
      bridge(k, s * 22, -16, s * 22, 16, 12, 2, TRIM, T);
      // parapets on the outer edge of the balcony
      k.box(0, 4, s * 23.85, 32, 0.8, 0.3, TRIM, T);
      k.box(s * 23.85, 4, 0, 0.3, 0.8, 31.4, TRIM, T);
      // kick shafts: ground -> balcony (4) -> gallery (8), and ground -> balcony -> roof bridges (12)
      kickShaft(k, -8, s * 18.5, 'z', 3, 0, 8, TRIM);
      kickShaft(k, 8, s * 18.5, 'z', 3, 0, 8, TRIM);
      kickShaft(k, s * 18.5, -13.5, 'x', 3, 0, 12, TRIM);
      kickShaft(k, s * 18.5, 13.5, 'x', 3, 0, 12, TRIM);
    }

    // --- poolside cabanas (1 floor, roof at 4 lines up with the balcony) ---
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      tower(k, Object.assign({ x: sx * 15, z: sz * 8, w: 10, d: 6, floors: 1, flip: sz > 0, walls: [sz > 0 ? '+z' : '-z'] }, look));
    }

    // --- central pool + fountain ---
    const R = 10, t = 1.5;
    k.box(0, 0, -R + t / 2, 2 * R, 1.2, t, TRIM, T);
    k.box(0, 0, R - t / 2, 2 * R, 1.2, t, TRIM, T);
    k.box(-R + t / 2, 0, 0, t, 1.2, 2 * R - 2 * t - 0.02, TRIM, T);
    k.box(R - t / 2, 0, 0, t, 1.2, 2 * R - 2 * t - 0.02, TRIM, T);
    k.water(0, 0.9, 0, 2 * (R - t), 2 * (R - t), '#5fc8e6', 0.55);
    k.box(0, 0, 0, 7, 3.2, 7, TILE, T);
    k.box(0, 3.2, 0, 4.4, 3.2, 4.4, TRIM, T);
    k.box(0, 6.4, 0, 2.2, 3.2, 2.2, TILE, T);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      k.pad(sx * 6, 0, sz * 6, 1.6, 1.6, 15, { push: { x: -sx * 3.5, z: -sz * 3.5 }, color: '#7fe3ff' });
    }

    // --- slides ---
    k.ramp(0, -15, 4, 10, 1.2, 4, '-z', '#5fc8e6', { slick: true });
    k.ramp(0, 15, 4, 10, 1.2, 4, '+z', '#ff8fb1', { slick: true });
    k.ramp(11.1, 0, 17.8, 2.4, 4, 6.4, '-x', '#ff8fb1', { slick: true, base: 3.6 });
    k.ramp(-11.1, 0, 17.8, 2.4, 4, 6.4, '+x', '#5fc8e6', { slick: true, base: 3.6 });
  },
});
