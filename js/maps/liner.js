// THE LINER - a huge ship on the open ocean (floors every 4m):
//   superstructure   4 floors of cabins at the stern (walls with doorways, stairs inside), roof 16
//   bridge house     3 floors amidships, linked to the superstructure at 8 and 12
//   funnels          two funnels 3m apart with striped inner faces = a kick chimney up to 22m
//   foredeck         stacked cargo container piles (5.2 / 7.8 / 10.4) with an alley between
//   lifeboats        bouncy lifeboats hanging over the side launch you onto the cargo
//   crow's nest      18m up the bow mast; launch pad on top of the tallest cargo pile
// Go over the rail and you're in the sea.
defineMap({
  id: 'liner',
  accent: ['#2577c8', '#c0392b'],
  name: 'The Liner',
  blurb: 'A ship on the open ocean. Cabin decks, a funnel chimney, cargo piles and a crow\'s nest.',
  env: 'sky',
  sky: '#a9d6ff',
  fog: [100, 320],
  sea: -6,
  killY: -8,
  hemi: ['#e6f4ff', '#4a6a86', 0.9],
  sun: [0.9, 40, 70, 30],
  size: 56,
  menuCam: { r: 50, y: 28 },
  spawns: [
    [-42, 0, 9], [-10, 0, 8], [20, 0, -8], [40, 0, 8], [26, 0, 0], [-26, 4, 4],
    [0, 8, 3], [-26, 16, 4], [56, 2.4, 0], [-10, 0, -8],
  ],
  seekerSpawn: [0, 12, 3],

  build(k) {
    const WOOD = '#b98a5a', WHITE = '#f2f4f7', RAIL = '#ffffff', HULL = '#1d2a44', GREY = '#cfd6df';
    const PL = { tex: 'planks', uv: 0.35 };

    // --- hull + deck ---
    k.box(0, -1, 0, 96, 1, 24, WOOD, PL);
    k.box(51, -1, 0, 6, 1, 18, WOOD, PL);
    k.box(57, -1, 0, 6, 3.4, 10, WOOD, PL);   // forecastle (top 2.4)
    k.deco(0, -9, 0, 96, 8, 24.2, HULL);
    k.deco(51, -9, 0, 6, 8, 18.2, HULL);
    k.deco(57, -9, 0, 6, 8, 10.2, HULL);
    k.deco(0, -9.6, 0, 96.4, 1, 24.6, '#b3262b', { tex: 'none' });

    // railings
    k.box(0, 0, -11.85, 96, 1.1, 0.3, RAIL);
    k.box(0, 0, 11.85, 96, 1.1, 0.3, RAIL);
    k.box(-47.85, 0, 0, 0.3, 1.1, 24, RAIL);
    for (const s of [-1, 1]) {
      k.box(48, 0, s * 10.5, 0.3, 1.1, 3, RAIL);
      k.box(51, 0, s * 8.85, 6, 1.1, 0.3, RAIL);
      k.box(54, 0, s * 7, 0.3, 1.1, 4, RAIL);
      k.box(57, 2.4, s * 4.85, 6, 1.1, 0.3, RAIL);
    }
    k.box(59.85, 2.4, 0, 0.3, 1.1, 10, RAIL);

    // --- superstructure + bridge house ---
    const cabins = { color: WHITE, wall: WHITE, stair: GREY, post: GREY, tex: 'grid', uv: 0.5 };
    tower(k, Object.assign({ x: -26, z: 0, w: 20, d: 16, floors: 4, walls: ['+x', '-x', '+z', '-z'] }, cabins));
    tower(k, Object.assign({ x: 0, z: 0, w: 10, d: 12, floors: 3, walls: ['+x', '-x'] }, cabins));
    for (const top of [8, 12]) bridge(k, -16, 0, -5, 0, top, 2, GREY, { tex: 'grid' });
    for (const s of [-1, 1]) k.deco(-26, 1.2, s * 8.07, 18, 0.8, 0.05, '#2b6cb0', { tex: 'none' });

    // --- funnels: kick between them all the way up ---
    for (const x of [10, 16]) {
      k.box(x, 0, 0, 3, 22, 3, '#c0392b', { tex: 'kick', uv: 0.5 });
      k.deco(x, 22, 0, 3.1, 1, 3.1, '#111111', { tex: 'none' });
    }

    // --- cargo on the foredeck ---
    pile(k, 26, -5, 3, { seed: 1 });
    pile(k, 26, 5, 2, { start: 1, seed: 2 });
    pile(k, 35, 0, 4, { seed: 3, hollow: [0] });

    // --- bouncy lifeboats ---
    for (const s of [-1, 1]) {
      k.box(26, 1.5, s * 13.2, 5, 0.9, 2.4, '#ff7a1a');
      k.pad(26, 2.4, s * 13.2, 4.2, 2, 18, { color: '#ffffff', push: { x: 0, z: -s * 8 } });
      for (const x of [-30, -20]) {
        k.box(x, 1.5, s * 13.2, 5, 0.9, 2.4, '#ff7a1a');
        k.pad(x, 2.4, s * 13.2, 4.2, 2, 14, { color: '#ffffff', push: { x: 0, z: -s * 4 } });
      }
    }

    // --- stern pool ---
    k.box(-43, 0, -5.5, 6, 0.8, 1, '#7fd0e6');
    k.box(-43, 0, 5.5, 6, 0.8, 1, '#7fd0e6');
    k.box(-45.5, 0, 0, 1, 0.8, 10, '#7fd0e6');
    k.box(-40.5, 0, 0, 1, 0.8, 10, '#7fd0e6');
    k.water(-43, 0.6, 0, 4, 10, '#4fc3e8', 0.6);
    k.pad(-43, 0, 0, 2, 2, 15, { color: '#7fe3ff' });

    // --- mast + crow's nest ---
    k.box(44, 0, 0, 0.6, 20, 0.6, '#dddddd');
    slab(k, 44, 18, 0, 4, 4, '#8b5a2b', Object.assign({ t: 0.4 }, PL));
    k.pad(36.6, 10.4, 0, 1.2, 1.2, 22, { push: { x: 7, z: 0 } });
  },
});
