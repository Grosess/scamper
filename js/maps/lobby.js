// HOTEL LOBBY - a four-storey hotel atrium (floors every 4m, nothing to bump your head on):
//   ground       reception desk, fountain, lounges, escalators (north), grand staircase (south)
//   galleries    ring around all four walls at 4 / 8 / 12, hotel-room doors along the walls
//   stairs       gallery 4 -> 8 (NE + SW corners), gallery 8 -> 12 (east + west galleries)
//   bridges      across the atrium at 8 (two) and 12 (one)
//   kick routes  elevator shafts on the east + west, column pairs in front of the north + south
//                galleries - all orange. Kick up and step off at the floor you want.
defineMap({
  id: 'lobby',
  accent: ['#1f5fe0', '#ff3d55'],
  name: 'Hotel Lobby',
  blurb: 'A four-storey hotel atrium. Galleries, escalators, sky bridges and orange elevator shafts to kick up.',
  env: 'indoor',
  sky: '#0c0e14',
  fog: [60, 140],
  hemi: ['#ffffff', '#6a7a99', 1.25],
  sun: [0.5, 6, 60, 10],
  size: 30,
  spotHeight: 16.4,
  spots: [-18, 0, 18].flatMap((x) => [-11, 0, 11].map((z) => ({ x, z }))),
  menuCam: { r: 16, y: 10 },
  spawns: [
    [-12, 0, -6], [12, 0, -6], [-12, 0, 8], [12, 0, 8], [0, 0, 12], [-18, 0, 0], [18, 0, 0],
    [-10, 4, 19], [10, 4, -19], [-25, 8, -10], [25, 8, 10], [8, 12, 19],
  ],
  seekerSpawn: [0, 12, 0],

  build(k) {
    const TILE = '#e9f0f1', BLUE = '#1f5fe0', RED = '#ff3d55', YEL = '#ffd23f', NAVY = '#1b2a55';
    const T = { tex: 'tiles', uv: 0.5 }, F = { tex: 'foam' };
    const W = 56, D = 44, H = 17;
    ground(k, W, D, TILE, T);
    enclose(k, W, D, H, TILE, '#f4f8f8');
    // blue wainscot band + carpet runner from the entrance
    for (const z of [-21.93, 21.93]) k.deco(0, 0.04, z, W - 0.2, 1.2, 0.04, NAVY, { tex: 'none' });
    for (const x of [-27.93, 27.93]) k.deco(x, 0.04, 0, 0.04, 1.2, D - 0.2, NAVY, { tex: 'none' });
    k.deco(0, 0.03, -1, 4, 0.02, 40, BLUE, { tex: 'foam', uv: 0.5 });

    // --- galleries at 4 / 8 / 12 ---
    const holes = {
      8: { N: [15, 22, 17.75, 20.25], S: [-22, -15, -20.25, -17.75] },
      12: { E: [23.75, 26.25, -8, -1], W: [-26.25, -23.75, 1, 8] },
    };
    for (const y of [4, 8, 12]) {
      const h = holes[y] || {};
      slabHole(k, -28, 28, 16, 22, y, h.N || null, TILE, T);
      slabHole(k, -28, 28, -22, -16, y, h.S || null, TILE, T);
      slabHole(k, 22, 28, -16, 16, y, h.E || null, TILE, T);
      slabHole(k, -28, -22, -16, 16, y, h.W || null, TILE, T);
    }
    // stairs between gallery floors
    stairs(k, 22, 19, '-x', 2.5, 4, 8, BLUE, F);
    stairs(k, -22, -19, '+x', 2.5, 4, 8, BLUE, F);
    stairs(k, 25, -8, '+z', 2.5, 8, 12, BLUE, F);
    stairs(k, -25, 8, '-z', 2.5, 8, 12, BLUE, F);

    // railings along the atrium edges, with gaps where things arrive
    const rail = (axis, at, a, b, y, gaps) => {
      let cur = a;
      for (const [g0, g1] of gaps.concat([[b, b]]).sort((p, q) => p[0] - q[0])) {
        if (g0 > cur + 0.05) {
          if (axis === 'x') k.box((cur + g0) / 2, y, at, g0 - cur, 1, 0.15, YEL, { tex: 'none' });
          else k.box(at, y, (cur + g0) / 2, 0.15, 1, g0 - cur, YEL, { tex: 'none' });
        }
        cur = Math.max(cur, g1);
      }
    };
    for (const y of [4, 8, 12]) {
      const ns = [[-18.6, -13.4], [13.4, 18.6]];
      if (y === 4) ns.push([-9, -7], [7, 9]);
      if (y === 8) ns.push([-11.3, -8.7], [8.7, 11.3]);
      if (y === 12) ns.push([-1.3, 1.3]);
      rail('x', 16.08, -22, 22, y, y === 4 ? ns : ns);
      rail('x', -16.08, -22, 22, y, y === 4 ? ns.concat([[-3, 3]]) : ns);
      rail('z', 22.08, -16, 16, y, [[-1.6, 1.6]]);
      rail('z', -22.08, -16, 16, y, [[-1.6, 1.6]]);
    }

    // --- getting up from the ground ---
    k.ramp(-8, 11, 1.8, 10, 0, 4, '+z', '#b9c2cf', { tex: 'stripes' });   // escalators
    k.ramp(8, 11, 1.8, 10, 0, 4, '+z', '#b9c2cf', { tex: 'stripes' });
    for (const x of [-9.05, -6.95, 6.95, 9.05]) k.deco(x, 0, 11, 0.1, 1.1, 10, '#9fd6e8', { tex: 'none', opacity: 0.5 });
    stairs(k, 0, -6, '-z', 6, 0, 4, RED, Object.assign({ run: 1.0 }, F));   // grand staircase

    // --- kick routes (orange) ---
    for (const s of [-1, 1]) {
      kickShaft(k, s * 20.6, 0, 'x', 3, 0, 12, RED);            // elevator shafts against E/W galleries
      kickShaft(k, -16, s * 15, 'z', 2, 0, 12, RED);            // column pairs in front of N/S galleries
      kickShaft(k, 16, s * 15, 'z', 2, 0, 12, RED);
      for (const y of [0, 4, 8]) k.deco(s * 27.9, y + 0.1, 0, 0.04, 2.6, 2.4, '#b8bec8', { tex: 'grid', uv: 0.5 });   // elevator doors
    }

    // --- bridges across the atrium ---
    for (const [x, y] of [[-10, 8], [10, 8], [0, 12]]) {
      bridge(k, x, -16, x, 16, y, 2.5, BLUE, F);
      for (const s of [-1, 1]) k.box(x + s * 1.18, y, 0, 0.15, 1, 32, YEL, { tex: 'none' });
    }

    // --- ground floor ---
    k.box(0, 0, 9.5, 8, 1.1, 1, '#f4f8f8', T);                 // reception desk
    for (const s of [-1, 1]) k.box(s * 3.5, 0, 7.75, 1, 1.1, 2.5, '#f4f8f8', T);
    k.deco(0, 1.13, 9.5, 8.2, 0.06, 1.2, BLUE, { tex: 'none' });
    // fountain
    k.box(0, 0, -2, 6, 0.8, 0.6, TILE, T);
    k.box(0, 0, -4.7, 6, 0.8, 0.6, TILE, T);
    k.box(-2.7, 0, -3.35, 0.6, 0.8, 2.1, TILE, T);
    k.box(2.7, 0, -3.35, 0.6, 0.8, 2.1, TILE, T);
    k.water(0, 0.6, -3.35, 4.8, 2.1, '#5fc8e6', 0.6);
    k.box(0, 0, -3.35, 1, 2.2, 1, '#9fd6e8', T);
    // lounges: sofas + planters
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      k.box(sx * 13, 0, sz * 3, 4, 0.8, 1, RED, F);
      k.box(sx * 13, 0, sz * 3 + sz * 0.6, 4, 1.4, 0.3, RED, F);
      k.box(sx * 19.5, 0, sz * 12.5, 1.4, 1.2, 1.4, '#e8eef0', T);
      k.deco(sx * 19.5, 1.2, sz * 12.5, 1.2, 0.9, 1.2, '#43c54a', { tex: 'none' });
    }
    // luggage carts
    for (const [x, z] of [[-5, -10], [6, -11], [-20, -6]]) k.box(x, 0, z, 1.2, 1.3, 2, YEL, { tex: 'none' });
    // atrium columns
    posts(k, [[-4, 16.4], [4, 16.4], [-4, -16.4], [4, -16.4], [22.4, 8], [22.4, -8], [-22.4, 8], [-22.4, -8]], 0, 12, '#f4f8f8', 0.8);

    // --- hotel room doors on the gallery walls ---
    for (const y of [4, 8, 12]) for (let x = -24; x <= 24; x += 6) {
      for (const s of [-1, 1]) k.deco(x, y + 0.06, s * 21.88, 1.4, 2.4, 0.04, ['#a0522d', '#2b6cb0', '#7d5a6a'][(x / 6 + y) & 1 ? 1 : 0], { tex: 'grid', uv: 0.5 });
    }

    // chandelier (decoration, nothing to hit)
    k.deco(0, 14.2, 0, 6, 0.3, 6, '#ffe9a8', { tex: 'none', emissive: '#a08a40' });
    k.deco(0, 14.5, 0, 0.1, 2.5, 0.1, '#888888', { tex: 'none' });
    // sign
    k.deco(0, 5.5, -21.88, 12, 2, 0.06, '#1b2a55', { tex: 'none', emissive: '#1d3fbf' });
  },
});
