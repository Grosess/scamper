// FUN ZONE - a giant indoor play structure (floors every 4m). Clean pastel padding, orange poles.
// 3 x 3 grid of play towers: corners 2 floors (roof 8), edges 3 (roof 12), center 4 (roof 16).
//   tube bridges  padded walls on both sides: columns at 4, rows at 8, center cross at 12
//   outer walls   the outside faces of the structure are padded, with doorways
//   kick shafts   striped shafts up the outside of each corner tower to its roof (8)
//   slides        tube slides off every outer tower
//   courtyards    four trampolines (two big ones); padded partitions break up the lanes
defineMap({
  id: 'playplace',
  accent: ['#ff7b93', '#ffd166'],
  name: 'Fun Zone',
  blurb: 'A giant indoor play structure. Nine towers, tube bridges, kick shafts, slides, trampolines.',
  env: 'indoor',
  sky: '#141833',
  fog: [22, 70],
  hemi: ['#ffffff', '#5a6aa8', 1.2],
  sun: [0.55, 8, 60, 6],
  size: 36,
  spotHeight: 21.4,
  spots: [-22, 0, 22].flatMap((x) => [-22, 0, 22].map((z) => ({ x, z }))),
  menuCam: { r: 26, y: 14 },
  spawns: [
    [8, 0, 3], [-8, 0, -3], [3, 0, -8], [-3, 0, 8], [28, 0, 8], [-28, 0, -8],
    [8, 0, 28], [-8, 0, -28], [-16, 4, -12], [16, 8, 12], [0, 8, 2],
  ],
  seekerSpawn: [0, 16, 2],

  build(k) {
    const PAD = { tex: 'foam', uv: 0.5 };
    const W = '#f4f7fb', POLE = '#ff8a1f', KICK = '#ffc23c';
    const PASTEL = ['#ff7b93', '#ffd166', '#4ecdc4', '#7aa2ff', '#c08cff', '#ff9f43', '#5fd38d', '#ff7b93', '#7aa2ff'];
    ground(k, 72, 72, '#33407a', PAD);
    enclose(k, 72, 72, 22, '#dfe9ff', '#eef4ff');

    const G = [-16, 0, 16];
    const FLOORS = [[2, 3, 2], [3, 4, 3], [2, 3, 2]];   // [row z][col x]
    G.forEach((z, r) => G.forEach((x, c) => {
      const col = PASTEL[r * 3 + c];
      const look = Object.assign({ color: W, wall: col, stair: col, post: POLE }, PAD);
      const walls = [];
      if (x !== 0) walls.push(x > 0 ? '+x' : '-x');
      if (z !== 0) walls.push(z > 0 ? '+z' : '-z');
      tower(k, Object.assign({ x, z, w: 10, d: 10, floors: FLOORS[r][c], flip: z > 0, walls }, look));
    }));

    // tube bridge: padded walls on both sides (you can't see through them)
    const tube = (ax, az, bx, bz, top, width) => {
      bridge(k, ax, az, bx, bz, top, width, '#9fd6e8', PAD);
      for (const s of [-1, 1]) {
        if (ax === bx) k.box(ax + s * (width / 2 - 0.08), top, (az + bz) / 2, 0.16, 2.2, Math.abs(bz - az), '#ffffff', PAD);
        else k.box((ax + bx) / 2, top, az + s * (width / 2 - 0.08), Math.abs(bx - ax), 2.2, 0.16, '#ffffff', PAD);
      }
    };
    const rowZ = (z) => (z > 0 ? z - 2 : z + 2);   // keeps row bridges clear of the stairwells
    for (const z of G) {
      tube(-11, rowZ(z), -5, rowZ(z), 8, 2);
      tube(5, rowZ(z), 11, rowZ(z), 8, 2);
    }
    for (const x of G) {
      tube(x + 4.2, -11, x + 4.2, -5, 4, 1.6);
      tube(x + 4.2, 5, x + 4.2, 11, 4, 1.6);
    }
    tube(-11, 2, -5, 2, 12, 2);
    tube(5, 2, 11, 2, 12, 2);
    tube(4.2, -11, 4.2, -5, 12, 1.6);
    tube(4.2, 5, 4.2, 11, 12, 1.6);
    // crown frame on top of the center tower
    posts(k, [[-4.8, -4.8], [4.8, -4.8], [-4.8, 4.8], [4.8, 4.8]], 16, 18.4, POLE, 0.3);
    k.deco(0, 18.4, 0, 10.4, 0.3, 10.4, '#e2383b', { tex: 'none' });

    // --- kick shafts up the outside of each corner tower to its roof ---
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) kickShaft(k, sx * 16, sz * 22.5, 'z', 3, 0, 8, KICK);

    // --- tube slides off the outer towers ---
    let si = 0;
    const slide = (x, z, w, d, top, dir) => k.ramp(x, z, w, d, 0, top, dir, PASTEL[si++ % PASTEL.length], { slick: true, tex: 'stripes', uv: 0.25 });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) slide(sx * 27, sz * 16, 12, 3, 8, sx > 0 ? '-x' : '+x');
    for (const s of [-1, 1]) {
      slide(s * 27, 2.5, 12, 3, 12, s > 0 ? '-x' : '+x');
      slide(3.6, s * 27, 3, 12, 12, s > 0 ? '-z' : '+z');
    }

    // --- courtyards between the towers ---
    // trampolines: padded frame + springy mat
    const tramp = (cx, cz, power, mat) => {
      for (const s of [-1, 1]) {
        k.box(cx, 0, cz + s * 2.75, 6, 0.6, 0.5, '#ff7b93', PAD);
        k.box(cx + s * 2.75, 0, cz, 0.5, 0.6, 5, '#ff7b93', PAD);
      }
      k.box(cx, 0, cz, 5, 0.3, 5, '#2a2f4a', { tex: 'none' });
      k.pad(cx, 0.3, cz, 5, 5, power, { color: mat, look: 'tramp' });
    };
    tramp(8, 8, 13, '#4ecdc4');
    tramp(-8, -8, 13, '#4ecdc4');
    tramp(-8, 8, 17, '#ff6bd6');
    tramp(8, -8, 17, '#ff6bd6');

    // padded partitions + soft blocks in the lanes (break up long sightlines)
    for (const [x, z, w, d] of [[8, -3, 4, 0.4], [-8, 3, 4, 0.4], [3, 8, 0.4, 4], [-3, -8, 0.4, 4]]) k.box(x, 0, z, w, 2.6, d, '#7aa2ff', PAD);
    for (const [x, z] of [[8, 1.5], [-8, -1.5], [-1.5, 8], [1.5, -8]]) k.box(x, 0, z, 2, 1.5, 2, '#ffd166', PAD);
    for (const [x, z, h] of [[28, -28, 3], [-28, 28, 3.2], [28, 28, 2], [-28, -28, 2.5]]) k.box(x, 0, z, 3, h, 3, '#c08cff', PAD);
  },
});
