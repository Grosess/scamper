// ROOFTOPS - a 4x4 city block floating in the void. Alleys are 4m wide and drop into the void.
// Everything works in floors of 4m:
//   roofs        4 to 24 high
//   penthouses   2-floor rooftop structures with walls, doorways and stairs inside
//   sky bridges  link penthouse floors/roofs to neighboring roofs at 12, 16 and 20
//   billboards   hang over two alleys - jump in under one and kick between it and the tall
//                building's wall to climb (orange)
//   planks       steep plank ramps one floor up across two alleys
//   pads         launch you up the big height jumps (onto the 24 tower, the water tower...)
defineMap({
  id: 'rooftops',
  accent: ['#1b2140', '#ffd9a0'],
  name: 'Rooftops',
  blurb: 'City roofs over the void. Penthouses, sky bridges, billboards - every alley is a drop.',
  fog: [55, 170],
  hemi: ['#d6e0ff', '#4a5070', 1.9],
  sun: [1.1, 25, 60, 15],
  size: 32,
  killY: -6,
  menuCam: { r: 40, y: 32 },
  spotHeight: 40,
  spots: [
    { x: -14, z: -14, color: '#ffd9a0', intensity: 2.6 }, { x: 14, z: -14, color: '#a0c8ff', intensity: 2.6 },
    { x: -14, z: 14, color: '#ffa0d0', intensity: 2.6 }, { x: 14, z: 14, color: '#ffd9a0', intensity: 2.6 },
    { x: 0, z: 0, color: '#ffffff', intensity: 2.6 },
  ],
  spawns: [
    [-7, 12, -21], [7, 4, -23], [21, 16, -24.5], [-21, 4, -10], [9, 16, -10.5],
    [21, 8, -9.5], [-21, 12, 7], [-7, 8, 9.5], [7, 20, 7], [21, 12, 4.5],
    [-21, 4, 23], [-7, 16, 21], [7, 8, 18.5], [21, 4, 21], [-21, 8, -18.5],
  ],
  seekerSpawn: [-7, 24, -7],

  build(k) {
    const X = [-21, -7, 7, 21], Z = [-21, -7, 7, 21];
    const H = [
      [8, 12, 4, 16],    // z = -21
      [4, 24, 16, 8],    // z = -7
      [12, 8, 20, 12],   // z = 7
      [4, 16, 8, 4],     // z = 21
    ];
    const FACADE = ['#8a5a44', '#6c7a89', '#a0845c', '#5d6d7e', '#7d5a6a', '#6a7d5d'];
    const ROOF = '#3a3d44', WOOD = '#9c7a4c', STEEL = '#59636e', CONC = '#9aa0a8';
    let n = 0;

    // buildings: windowed body + tar roof + cornice just below the roof edge
    Z.forEach((z, r) => X.forEach((x, c) => {
      const top = H[r][c];
      k.box(x, -40, z, 10, top + 39.7, 10, FACADE[n++ % FACADE.length], { tex: 'windows', uv: 0.25 });
      k.box(x, top - 0.3, z, 10, 0.3, 10, ROOF);
      k.deco(x, top - 0.6, z, 10.3, 0.3, 10.3, '#c9c3b8', { tex: 'none' });
    }));

    // --- the street, far below: roads, sidewalks, lane lines, streetlights. Fog fades it to black. ---
    const GY = -40;
    k.deco(0, GY - 1, 0, 220, 1, 220, '#3c4048', { tex: 'grid', uv: 0.1 });
    for (const c of [-28, -14, 0, 14, 28]) {
      k.deco(c, GY, 0, 4, 0.05, 220, '#55595f', { tex: 'road', uv: 0.25 });
      k.deco(0, GY, c, 220, 0.05, 4, '#55595f', { tex: 'road', uv: 0.25 });
    }
    for (const x of X) for (const z of Z) k.deco(x, GY, z, 11.2, 0.2, 11.2, '#8c8f96', { tex: 'tiles', uv: 0.5 });
    for (const x of [-14, 0, 14]) for (const z of [-28, -14, 0, 14, 28]) {
      k.deco(x + 1.6, GY, z + 1.6, 0.15, 5, 0.15, '#2b2f35', { tex: 'none' });
      k.deco(x + 1.6, GY + 5, z + 1.6, 0.5, 0.25, 0.5, '#ffe9a8', { tex: 'none', emissive: '#ffd27a' });
    }

    // --- penthouses (2 floors each, standing straight on the roof) ---
    const ph = { color: CONC, wall: '#d8d2c4', stair: STEEL, post: STEEL, tex: 'grid', uv: 0.5, floor: false };
    tower(k, Object.assign({ x: -21, z: -21, w: 10, d: 8, base: 8, floors: 2, walls: ['+x', '-z'] }, ph));
    tower(k, Object.assign({ x: 21, z: -7, w: 10, d: 8, base: 8, floors: 2, flip: true, walls: ['-x', '+x'] }, ph));
    tower(k, Object.assign({ x: -7, z: 7, w: 10, d: 8, base: 8, floors: 2, walls: ['-x', '+z'] }, ph));
    tower(k, Object.assign({ x: 7, z: 21, w: 10, d: 8, base: 8, floors: 2, flip: true, walls: ['-x'] }, ph));
    tower(k, Object.assign({ x: 21, z: 7, w: 10, d: 8, base: 12, floors: 2, flip: true, walls: ['-z', '-x'] }, ph));

    // --- sky bridges ---
    bridge(k, -16, -21, -12, -21, 12, 2, STEEL, { tex: 'grid' });   // NW penthouse -> (-7,-21)
    bridge(k, 16, -9, 12, -9, 16, 2, STEEL, { tex: 'grid' });       // E penthouse roof -> (7,-7)
    bridge(k, 21, -11, 21, -16, 16, 2, STEEL, { tex: 'grid' });     // E penthouse roof -> (21,-21)
    bridge(k, -12, 7, -16, 7, 12, 2, STEEL, { tex: 'grid' });       // center-west penthouse -> (-21,7)
    bridge(k, -7, 11, -7, 16, 16, 2, STEEL, { tex: 'grid' });       // center-west penthouse roof -> (-7,21)
    bridge(k, 2, 18.5, -2, 18.5, 16, 2, STEEL, { tex: 'grid' });    // south penthouse roof -> (-7,21)
    bridge(k, 21, 3, 21, -3, 16, 2, STEEL, { tex: 'grid' });        // east tower -> E penthouse roof
    bridge(k, 16, 4, 12, 4, 20, 2, STEEL, { tex: 'grid' });         // east tower roof -> (7,7)

    // --- plank ramps across alleys (one floor up) ---
    k.ramp(14, 21, 4, 1.2, 4, 8, '-x', WOOD, { base: 3.8, tex: 'planks' });
    k.ramp(-21, -14, 1.2, 4, 4, 8, '-z', WOOD, { base: 3.8, tex: 'planks' });

    // --- launch pads for the big height jumps ---
    k.pad(3.5, 16, -7, 1.4, 1.4, 22, { push: { x: -5.5, z: 0 } });   // (7,-7) -> the 24 tower
    k.pad(7, 4, -17.5, 1.4, 1.4, 26, { push: { x: 0, z: 6 } });       // (7,-21) -> (7,-7)
    k.pad(-21, 4, 17.5, 1.4, 1.4, 22, { push: { x: 0, z: -6 } });     // (-21,21) -> (-21,7)

    // --- the tower's antenna ---
    k.deco(-7, 24, -7, 0.3, 8, 0.3, '#bbbbbb', { tex: 'none' });
    k.deco(-7, 32, -7, 0.5, 0.5, 0.5, '#ff2030', { tex: 'none', emissive: '#ff2030' });

    // --- water tower on (21,-21) ---
    posts(k, [[19.5, -22.5], [22.5, -22.5], [19.5, -19.5], [22.5, -19.5]], 16, 19, STEEL);
    k.box(21, 19, -21, 3.6, 3, 3.6, '#8b5a2b', { tex: 'planks' });
    k.pad(17.5, 16, -21, 1.4, 1.4, 21, { push: { x: 2.5, z: 0 } });

    // --- billboards over alleys: jump in under one, kick between it and the tall wall ---
    k.box(13, 7.6, -21, 0.4, 9.4, 8, '#1a1a1a', { tex: 'kick', uv: 0.5 });
    k.deco(12.74, 8.4, -21, 0.03, 7.6, 7, '#ff3d7f', { tex: 'grid', emissive: '#a3204f' });
    posts(k, [[13, -24.5], [13, -17.5]], 17, 18, STEEL, 0.2);
    k.box(-15, 7.6, 21, 0.4, 9.4, 8, '#1a1a1a', { tex: 'kick', uv: 0.5 });
    k.deco(-15.26, 8.4, 21, 0.03, 7.6, 7, '#2ee6ff', { tex: 'grid', emissive: '#1a8aa0' });
    posts(k, [[-15, 17.5], [-15, 24.5]], 17, 18, STEEL, 0.2);

    // --- rooftop clutter: AC units + skylights ---
    for (const [x, y, z] of [[-4, 12, -24], [10, 4, -24.5], [-24, 12, 10], [10, 20, 10], [-4, 16, 24], [24, 4, 24],
                             [-18, 4, -9.5], [10, 16, -4]]) {
      k.box(x, y, z, 1.6, 1.2, 2, '#b8c0c8');
    }
    for (const [x, y, z] of [[-10, 12, -18], [4, 4, -19], [-24, 4, 24]]) {
      k.box(x, y, z, 2.4, 0.5, 2.4, '#9fd6e8', { tex: 'none', opacity: 0.8 });
    }
  },
});
