// ROOFTOPS - a 4x4 city block floating in the void. Buildings are 11m square with 3m alleys, so
// every alley is a kick chimney - fall in and you can still kick your way back up.
// Everything works in floors of 4m:
//   roofs          4 to 24 high
//   penthouses     2-floor rooftop structures with stairs inside, linked to neighbours by sky bridges
//   fire escapes   balcony stacks on facades: jump across the alley, then climb them ledge by ledge
//   kick signs     big signs standing on a low roof's edge, 3m from a taller building - kick between
//                  the sign (orange) and the facade to climb. Below the roof the alley continues the
//                  chimney all the way down, so they're also the way back up after a fall
//   planks, pads   plank ramps one floor up across an alley, launch pads for the big height jumps
//   roof clutter   stair bulkheads (3m - pull yourself up), AC units, water towers, a kick perch
//
//   roofs (x across, z down):  A  8   B 12   C  4   D 16
//                              E  4   F 24   G 16   H  8
//                              I 12   J  8   K 20   L 12
//                              M  4   N 16   O  8   P  4
defineMap({
  id: 'rooftops',
  accent: ['#1b2140', '#ffd9a0'],
  name: 'Rooftops',
  blurb: 'City roofs over the void. Kick up the alleys, climb fire escapes, cross sky bridges.',
  fog: [55, 170],
  hemi: ['#d6e0ff', '#4a5070', 1.9],
  sun: [1.1, 25, 60, 15],
  size: 32,
  killY: -6,
  menuCam: { r: 42, y: 33 },
  spotHeight: 40,
  spots: [
    { x: -14, z: -14, color: '#ffd9a0', intensity: 2.6 }, { x: 14, z: -14, color: '#a0c8ff', intensity: 2.6 },
    { x: -14, z: 14, color: '#ffa0d0', intensity: 2.6 }, { x: 14, z: 14, color: '#ffd9a0', intensity: 2.6 },
    { x: 0, z: 0, color: '#ffffff', intensity: 2.6 },
  ],
  spawns: [
    [-9.5, 12, -24.5], [5, 4, -18], [23.5, 16, -17.5], [-18.5, 4, -9], [-4, 24, -4], [9, 16, -10],
    [-19, 12, 9.5], [3.5, 20, 3.5], [-24, 4, 18], [-5.5, 16, 21], [23, 4, 18], [-4.5, 8, 9.5],
    [6, 8, 18.5], [18.5, 12, 5],
  ],
  seekerSpawn: [7, 16, -9],

  build(k) {
    const X = [-21, -7, 7, 21], Z = [-21, -7, 7, 21], B = 11, HB = B / 2;
    const H = [
      [8, 12, 4, 16],    // z = -21   A B C D
      [4, 24, 16, 8],    // z = -7    E F G H
      [12, 8, 20, 12],   // z = 7     I J K L
      [4, 16, 8, 4],     // z = 21    M N O P
    ];
    const FACADE = ['#8a5a44', '#6c7a89', '#a0845c', '#5d6d7e', '#7d5a6a', '#6a7d5d'];
    const ROOF = '#3a3d44', WOOD = '#9c7a4c', STEEL = '#59636e', CONC = '#9aa0a8', DARK = '#2b2f35';
    const NO = { tex: 'none' };
    let seed = 5;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

    // facades that carry a fire escape get no windows (keeps the balconies readable)
    const noWin = new Set(['1,1,-z', '2,1,-z', '2,2,-x', '0,2,-z', '3,2,+z']);

    // --- buildings: body + tar roof + cornice, ribbon windows on the upper floors ---
    let n = 0;
    Z.forEach((z, r) => X.forEach((x, c) => {
      const top = H[r][c];
      k.box(x, -40, z, B, top + 39.7, B, FACADE[n++ % FACADE.length]);
      k.box(x, top - 0.3, z, B, 0.3, B, ROOF);
      k.deco(x, top - 0.6, z, B + 0.3, 0.3, B + 0.3, '#c9c3b8', NO);
      for (const face of ['+x', '-x', '+z', '-z']) {
        if (noWin.has(`${c},${r},${face}`)) continue;
        const ax = face[1] === 'x', sg = face[0] === '+' ? 1 : -1, f = (ax ? x : z) + sg * HB;
        for (let y = top - 2.8; y > Math.max(top - 24, -18); y -= 4) {
          for (let i = 0; i < 3; i++) {
            const along = (ax ? z : x) + (i - 1) * 3.3, lit = rnd();
            const col = lit < 0.42 ? '#ffd27a' : lit < 0.58 ? '#bfe3ff' : '#2a2f3a';
            const em = lit < 0.42 ? '#c98a2a' : lit < 0.58 ? '#4f86b0' : undefined;
            const o = { tex: 'none', outline: false, emissive: em };
            if (ax) k.deco(f, y, along, 0.12, 1.5, 2.9, col, o);
            else k.deco(along, y, f, 2.9, 1.5, 0.12, col, o);
          }
        }
      }
    }));

    // --- the street, far below: roads, sidewalks, streetlights. Fog fades it out. ---
    const GY = -40;
    k.deco(0, GY - 1, 0, 220, 1, 220, '#25282e', NO);
    for (const c of [-28, -14, 0, 14, 28]) {
      k.deco(c, GY, 0, 3, 0.05, 220, '#3a3e46', NO);
      k.deco(0, GY + 0.06, c, 220, 0.05, 3, '#3a3e46', NO);
    }
    for (const x of X) for (const z of Z) k.deco(x, GY - 0.1, z, 12.2, 0.12, 12.2, '#5d6068', NO);
    for (const x of [-14, 0, 14]) for (const z of [-28, -14, 0, 14, 28]) {
      k.deco(x + 1.9, GY, z + 1.9, 0.15, 5, 0.15, DARK, NO);
      k.deco(x + 1.9, GY + 5, z + 1.9, 0.5, 0.25, 0.5, '#ffe9a8', { tex: 'none', emissive: '#ffd27a' });
    }

    // --- penthouses (2 floors each, standing straight on the roof) ---
    const ph = { color: CONC, wall: '#d8d2c4', stair: STEEL, post: STEEL, floor: false };
    tower(k, Object.assign({ x: -21, z: -21, w: 10, d: 8, base: 8, floors: 2, walls: ['+x', '-z'] }, ph));             // A
    tower(k, Object.assign({ x: 21, z: -7, w: 10, d: 8, base: 8, floors: 2, flip: true, walls: ['-x', '+x'] }, ph));   // H
    tower(k, Object.assign({ x: -7, z: 7, w: 10, d: 8, base: 8, floors: 2, walls: ['-x', '+z'] }, ph));                // J
    tower(k, Object.assign({ x: 7, z: 21, w: 10, d: 8, base: 8, floors: 2, flip: true, walls: ['-x'] }, ph));          // O
    tower(k, Object.assign({ x: 21, z: 7, w: 10, d: 8, base: 12, floors: 2, flip: true, walls: ['-z', '-x'] }, ph));   // L

    // --- sky bridges (12, 16 and 20) ---
    bridge(k, -16, -21, -12.5, -21, 12, 2, STEEL);   // A penthouse 12 -> B
    bridge(k, 16, -9, 12.5, -9, 16, 2, STEEL);       // H penthouse roof -> G
    bridge(k, 21, -11, 21, -15.5, 16, 2, STEEL);     // H penthouse roof -> D
    bridge(k, -12, 7, -15.5, 7, 12, 2, STEEL);       // J penthouse 12 -> I
    bridge(k, -7, 11, -7, 15.5, 16, 2, STEEL);       // J penthouse roof -> N
    bridge(k, 2, 18.5, -1.5, 18.5, 16, 2, STEEL);    // O penthouse roof -> N
    bridge(k, 21, 3, 21, -3, 16, 2, STEEL);          // L penthouse 16 -> H penthouse roof
    bridge(k, 16, 4, 12.5, 4, 20, 2, STEEL);         // L penthouse roof -> K

    // --- plank ramps across alleys (one floor up) ---
    k.ramp(15, 21, 5, 1.2, 4, 8, '-x', WOOD, { base: 3.8 });     // P -> O
    k.ramp(-21, -13, 1.2, 5, 4, 8, '-z', WOOD, { base: 3.8 });   // E -> A

    // --- launch pads for the big height jumps ---
    k.pad(10.6, 16, -7, 1.4, 1.4, 22, {});   // G -> the 24 tower F
    k.pad(10, 4, -17.5, 1.4, 1.4, 26, {});     // C -> G
    k.pad(-21, 4, 25.4, 1.4, 1.4, 23, {});    // M -> I

    // --- fire escapes: landings 1.1m deep stepping diagonally up a facade, 2.4m apart at most.
    // None is above another: run to the end of one, bump into the next one's face, jump, pull up.
    // face = which side of building (c, r) they hang on; they climb from `low` to the roof
    const fireEscape = (c, r, face, low) => {
      const top = H[r][c], ax = face[1] === 'x', sg = face[0] === '+' ? 1 : -1;
      const f = (ax ? X[c] : Z[r]) + sg * HB, along = ax ? Z[r] : X[c];
      const steps = Math.ceil((top - low) / 2.4), dy = (top - low) / steps;
      for (let i = 1; i < steps; i++) {
        const y = low + i * dy, a = along + (i - steps / 2) * 2.75;
        // 0.7 thick, so you can't slip under the next landing
        if (ax) k.box(f + sg * 0.55, y - 0.7, a, 1.1, 0.7, 2.6, '#3d434c', NO);
        else k.box(a, y - 0.7, f + sg * 0.55, 2.6, 0.7, 1.1, '#3d434c', NO);
        // a thin rail post under the outer corner (looks only)
        const pa = a - 1.25, py = y - 0.7 - 1.6;
        if (ax) k.deco(f + sg * 1.03, py, pa, 0.06, 1.6, 0.06, '#2a2e35', NO);
        else k.deco(pa, py, f + sg * 1.03, 0.06, 1.6, 0.06, '#2a2e35', NO);
      }
    };
    fireEscape(1, 1, '-z', 12);   // B 12 -> F 24
    fireEscape(2, 1, '-z', 4);    // C 4  -> G 16
    fireEscape(2, 2, '-x', 8);    // J 8  -> K 20
    fireEscape(0, 2, '-z', 4);    // E 4  -> I 12
    fireEscape(3, 2, '+z', 4);    // P 4  -> L 12

    // --- kick signs: stand on a low roof's edge, 3m from the taller facade across the alley ---
    const kickSign = (x, z, alongZ, len, y0, y1, neon, side) => {
      if (alongZ) k.box(x, y0, z, 0.4, y1 - y0, len, DARK, { tex: 'kick' });
      else k.box(x, y0, z, len, y1 - y0, 0.4, DARK, { tex: 'kick' });
      // lit panel on the back of the sign (the side facing the low roof)
      const o = { tex: 'none', emissive: neon, outline: false }, h = Math.min(6, y1 - y0 - 2);
      if (alongZ) k.deco(x + side * 0.24, y0 + 1.2, z, 0.1, h, len - 1, neon, o);
      else k.deco(x, y0 + 1.2, z + side * 0.24, len - 1, h, 0.1, neon, o);
    };
    kickSign(12.3, -21, true, 6, 4, 16, '#ff3d7f', -1);     // C -> D
    kickSign(-15.7, 21, true, 6, 4, 16, '#2ee6ff', -1);     // M -> N
    kickSign(7, 15.7, false, 6, 8, 20, '#b6ff3d', 1);       // O -> K
    kickSign(-15.7, -7, true, 6, 4, 24, '#ffb13d', -1);     // E -> F (the long one)
    kickSign(15.7, -3.4, true, 3.8, 8, 16, '#c77dff', 1);   // H -> G

    // --- the tower's antenna ---
    k.deco(-7, 24, -7, 0.3, 8, 0.3, '#bbbbbb', NO);
    k.deco(-7, 32, -7, 0.5, 0.5, 0.5, '#ff2030', { tex: 'none', emissive: '#ff2030' });

    // --- water towers (D has a pad up onto its tank) ---
    const waterTower = (x, y, z) => {
      posts(k, [[x - 1.5, z - 1.5], [x + 1.5, z - 1.5], [x - 1.5, z + 1.5], [x + 1.5, z + 1.5]], y, y + 3, STEEL);
      k.box(x, y + 3, z, 3.6, 3, 3.6, '#8b5a2b');
      k.deco(x, y + 6, z, 2.8, 0.6, 2.8, '#6b4422', NO);
    };
    waterTower(21, 16, -21);
    k.pad(17.5, 16, -21, 1.4, 1.4, 21, {});
    waterTower(-9.5, 16, 23.5);

    // --- kick perch on K: a sign box and a wall 2.5m apart - kick up, pull onto the box (26) ---
    k.box(7, 20, 6, 3, 6, 2.4, '#d8d2c4');
    k.box(7, 20, 9.9, 3, 6, 0.4, DARK, { tex: 'kick' });
    k.deco(7, 21.2, 4.74, 2.4, 3.6, 0.1, '#ffd27a', { tex: 'none', emissive: '#c98a2a', outline: false });

    // --- stair bulkheads (3m: jump and pull up), AC units, skylights ---
    const bulk = (x, y, z) => {
      k.box(x, y, z, 3, 3, 3, '#a9a39a');
      k.deco(x, y, z + 1.53, 1.1, 2.1, 0.06, '#5a4a3a', NO);   // door
    };
    bulk(-4, 12, -23.5); bulk(4, 4, -23.5); bulk(-24, 4, -9); bulk(9.5, 16, -3.5); bulk(-23, 4, 23.5);
    bulk(-4, 16, 18);    bulk(24, 4, 24);
    for (const [x, y, z] of [[24.5, 16, -24.5], [-10, 24, -10], [-24.5, 12, 3.5], [11, 20, 10.5], [-9, 12, -18],
                             [-10.5, 16, 17]]) {
      k.box(x, y, z, 1.6, 1.2, 2, '#b8c0c8');
    }
    for (const [x, y, z] of [[-3.5, 12, -18], [10, 4, -24], [-3, 16, 24]]) {
      k.box(x, y, z, 2.4, 0.5, 2.4, '#9fd6e8', { tex: 'none', opacity: 0.8 });
    }

    // --- for chases on the open roofs: slide-under pipe runs (bottom 1.15m) and low vents to vault
    // or circle round ---
    const pipe = (x, z, top, len, alongX) => {
      const h = len / 2;
      for (const e of [-1, 1]) k.box(alongX ? x + e * (h + 0.15) : x, top, alongX ? z : z + e * (h + 0.15), 0.3, 1.45, 0.3, STEEL, NO);
      k.box(x, top + 1.15, z, alongX ? len : 0.3, 0.3, alongX ? 0.3 : len, '#c8ccd2', NO);
    };
    const vent = (x, z, top) => k.box(x, top, z, 1.2, 1.0, 1.2, '#b8c0c8');
    pipe(5.5, -20.5, 4, 4.5, true);   vent(9, -21, 4);           // C
    pipe(-22, -4.5, 4, 4, false);      vent(-18, -4, 4);          // E
    pipe(-19.5, 22, 4, 4, false);      vent(-18, 25, 4);          // M
    pipe(18, 19, 4, 4, false);         vent(17, 25, 4);           // P
  },
});
