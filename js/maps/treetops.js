// TREETOPS - a treehouse village in giant trees, high above a misty forest floor. Fall and you're gone.
//   the great tree   the landmark in the middle: a big deck at 0 around its trunk, a ring balcony at 8,
//                    and the crown at 20 on top. Up to the ring: the orange kick chimney on the west
//                    side, the mushroom bounce pad, or the long plank from the north treehouse.
//                    Up to the crown: the orange kick wall on the ring's north side
//   north            a treehouse at 4 (doors on all four sides, a loop around its trunk inside) with a
//                    walkable roof at 8, bridged to the ring
//   east             a hut at 0 (roof at 4, step up from the crate), a bucket lift to the lookout at 12
//   south            the high deck at 8: ride the sliding cable car from the ring, or hop the stepping
//                    stones up from the big deck
//   west             a deck at 4 with an orange kick chimney up to the platform at 12
//   corners          four small trees (4 / 8) tie it all together with rope bridges and planks
// Heights: 0, 4, 8, 12, 20. Every ceiling is 3.6m+ above the floor under it.
defineMap({
  id: 'treetops',
  accent: ['#7fae6e', '#c9a77c'],
  name: 'Treetops',
  blurb: 'A treehouse village in giant trees over a misty forest. Rope bridges, a cable car, a bucket lift and a long way down.',
  env: 'fog',
  sky: '#a9d3c4',
  fog: [40, 140],
  fogDensity: 0.016,
  hemi: ['#f4fff6', '#6f8a7a', 1.7],
  sun: [1.1, 25, 60, 15],
  size: 36,
  killY: -12,
  menuCam: { r: 46, y: 22 },
  spawns: [
    [7, 0, -3], [-6, 0, 6], [-1, 0, -7.5], [22, 0, 5], [5, 4, -24], [-29, 4, 7], [-20, 4, -3],
    [3.5, 8, 27], [13.5, 4, -13.5], [13.5, 8, 13.5], [-13.5, 4, 13.5], [-13.5, 8, -15],
    [-21, 12, -3], [26.3, 12, 2.3], [4.5, 8, -1],
  ],
  seekerSpawn: [0, 8, 4.5],

  build(k) {
    const BARK = '#6e5038', BARK2 = '#5e4430', WOOD = '#e2bd8c', PLANK = '#c8955e', ROPE = '#f3e3bd';
    const LEAF = '#79c26a', LEAF2 = '#9ad47f', LEAF3 = '#5e9a55', HUT = '#fbf1dc', ROOF = '#e0705a';
    const CAP = '#ff8fa3', STEM = '#f4ecdc', LILAC = '#c3a6ff', MINT = '#7ed6c8', K = { tex: 'kick' };
    const trunk = (x, z, s, top, c = BARK) => k.box(x, -40, z, s, top + 40, s, c);
    const deck = (x0, x1, z0, z1, top, c = WOOD, t = 0.5) => slab(k, (x0 + x1) / 2, top, (z0 + z1) / 2, x1 - x0, z1 - z0, c, { t });
    const leaf = (x, y, z, w, h, d, c = LEAF) => k.box(x, y, z, w, h, d, c);
    // hut: walls with a 2m doorway in the middle of every side, roof slab on top
    const hut = (cx, cz, w, d, y0, roofPad = 0) => {
      const h = 3.6, t = 0.3, x0 = cx - w / 2, x1 = cx + w / 2, z0 = cz - d / 2, z1 = cz + d / 2;
      for (const z of [z0 + t / 2, z1 - t / 2]) {
        k.box((x0 + cx - 1) / 2, y0, z, cx - 1 - x0, h, t, HUT);
        k.box((cx + 1 + x1) / 2, y0, z, x1 - cx - 1, h, t, HUT);
        k.box(cx, y0 + 2.4, z, 2, h - 2.4, t, HUT);
      }
      for (const x of [x0 + t / 2, x1 - t / 2]) {
        k.box(x, y0, (z0 + t + cz - 1) / 2, t, h, cz - 1 - z0 - t, HUT);
        k.box(x, y0, (cz + 1 + z1 - t) / 2, t, h, z1 - t - cz - 1, HUT);
        k.box(x, y0 + 2.4, cz, t, h - 2.4, 2, HUT);
      }
      deck(x0 - roofPad, x1 + roofPad, z0 - roofPad, z1 + roofPad, y0 + 4, ROOF, 0.4);
    };

    // ---------- the forest floor far below, and the giant trees all around, fading into the mist ----------
    k.deco(0, -41, 0, 260, 1, 260, '#4f6b55');
    for (let i = 0; i < 14; i++) {
      const a = i / 14 * Math.PI * 2 + 0.3, r = 52 + (i % 3) * 12, x = Math.cos(a) * r, z = Math.sin(a) * r, h = 22 + (i % 4) * 6, s = 5 + (i % 3);
      k.deco(x, -40, z, s, h + 40, s, i % 2 ? BARK : BARK2);
      k.deco(x, h, z, s * 3.2, 5, s * 3.2, i % 2 ? LEAF3 : LEAF);
      k.deco(x + s * 0.4, h + 5, z - s * 0.3, s * 2, 3, s * 2, LEAF2);
    }
    // the great tree's canopy, high over the crown (just looks)
    k.deco(0, 25, 0, 22, 4, 22, LEAF);
    k.deco(2, 29, -1, 14, 3, 14, LEAF2);
    k.deco(-9, 24, 8, 8, 3, 8, LEAF3);
    k.deco(9, 23.5, -8, 7, 3, 7, LEAF3);
    for (const [x, z, s, h] of [[-50, -30, 9, 14], [44, -46, 12, 18], [-38, 52, 10, 12], [56, 30, 8, 16], [-70, 8, 14, 20], [10, -70, 11, 14], [20, 66, 9, 18]]) {
      k.deco(x, -40, z, 2.5, h, 2.5, BARK2);
      k.deco(x, -40 + h, z, s, s * 0.5, s, LEAF3);
    }

    // ---------- the great tree ----------
    trunk(0, 0, 6, 20);
    deck(-9, 9, -9, 9, 0);
    // ring balcony at 8 around the trunk
    deck(-6, 6, -6, -3, 8, PLANK);
    deck(-6, 6, 3, 6, 8, PLANK);
    deck(-6, -3, -3, 3, 8, PLANK);
    deck(3, 6, -3, 3, 8, PLANK);
    // north: orange kick wall, 2.8m off the trunk, from the ring up to the crown
    k.box(0, 8, -6.05, 4, 12, 0.5, '#ff6a3d', K);
    // the crown at 20: the trunk top plus leaf shelves east, south and west
    leaf(4.5, 18.8, 0, 3, 1.2, 4, LEAF2);
    leaf(0, 18.8, 4.5, 4, 1.2, 3, LEAF2);
    leaf(-4.5, 18.8, 0, 3, 1.2, 4, LEAF2);
    leaf(0, 20, 0, 2.2, 1.1, 2.2, LEAF);                    // a little bush to circle on top
    // west: orange kick chimney from the big deck up to the ring
    k.box(-6.75, 0, 0, 0.5, 8, 4, '#ff6a3d', K);
    k.box(-9.75, -3, 0, 0.5, 11, 4, '#ff6a3d', K);
    // mushroom bounce pad (south-east corner of the deck) -> the ring
    k.pad(8, 0, 8, 1.6, 1.6, 24, { push: { x: -2.6, z: -2.6 }, look: 'tramp', color: CAP });
    // things on the big deck to juke around
    leaf(-6.5, 0, -6.5, 2, 1.0, 2, LEAF);                   // bush to vault
    k.box(6.2, 0, -6.2, 1.4, 1.4, 1.4, PLANK);              // crate
    leaf(-3.5, 0, 7.2, 1.6, 0.9, 1.6, LEAF2);
    for (const [x, z] of [[-7.8, 4.2], [4.6, -7.9]]) { k.box(x, 0, z, 0.35, 0.8, 0.35, STEM); k.box(x, 0.8, z, 1.2, 0.35, 1.2, CAP); }

    // ---------- north: treehouse at 4, roof at 8 ----------
    trunk(0, -24, 3, 12);
    leaf(0, 12, -24, 4, 2, 4, LEAF);
    deck(-6, 6, -29, -19, 4);
    hut(0, -24, 7, 7, 4, 1);
    k.ramp(3, -14, 2, 10, 0, 4, '-z', PLANK, { base: 3.6 });            // big deck -> treehouse
    k.ramp(-4.5, -12.5, 2, 13, 4, 8, '+z', PLANK, { base: 3.6 });       // treehouse deck -> the ring
    deck(2.7, 4.3, -19.5, -6, 8, ROPE, 0.3);                           // ring -> treehouse roof

    // ---------- west: deck at 4, kick chimney to the platform at 12 ----------
    trunk(-24, 0, 3, 16);
    leaf(-24, 16, 0, 4.5, 2, 4.5, LEAF);
    deck(-30, -18, -6, 9, 4);
    k.ramp(-13.5, 3, 9, 2, 0, 4, '-x', PLANK, { base: 3.6 });           // big deck -> west deck
    deck(-28, -20, -4, 4, 12, PLANK);
    k.box(-24, 4, 4.35, 6, 8, 0.5, '#ff6a3d', K);
    k.box(-24, 4, 7.65, 6, 8, 0.5, '#ff6a3d', K);
    k.box(-28.6, 4, -4.6, 1.4, 1.2, 1.4, PLANK);
    leaf(-19.6, 4, 8, 2, 1, 2, LEAF2);

    // ---------- south: high deck at 8, stepping stones and the cable car ----------
    trunk(0, 24, 3, 12);
    leaf(0, 12, 24, 4.5, 2, 4.5, LEAF);
    deck(-5, 5, 19, 29, 8);
    // stepping stones (mushroom tops on stalks): hop, hop, pull up, pull up
    for (const [x, z, top, c] of [[3, 11.5, 1.2, CAP], [-2.7, 13, 2.4, LILAC], [-2.7, 16.7, 5, MINT]]) {
      k.box(x, top - 0.6, z, 2.2, 0.6, 2.2, c);
      k.box(x, top - 4, z, 0.6, 3.4, 0.6, STEM);
    }
    k.mover(0, 7.6, 7.5, 3, 0.4, 3, LILAC, { type: 'slide', dz: 10, period: 8 });   // cable car: ring <-> south deck
    k.deco(0, 11, 13, 0.08, 0.08, 18, ROPE);

    // ---------- east: hut at 0 (roof 4), bucket lift to the lookout at 12 ----------
    trunk(24, 0, 3, 16);
    leaf(24, 16, 0, 4.5, 2, 4.5, LEAF);
    deck(18, 27.8, -6, 6, 0);
    hut(23.5, 0, 7, 7, 0, 0.5);
    deck(9, 18, -0.8, 0.8, 0, ROPE, 0.3);                               // rope bridge from the big deck
    k.box(19.2, 0, 5.1, 1.6, 1.2, 1.6, PLANK);                          // crate: step up to the roof
    deck(21, 27, -3, 3, 12, PLANK);
    k.mover(29, -0.4, 0, 2.4, 0.4, 2.4, CAP, { type: 'slide', dy: 12, period: 10 });  // bucket lift
    k.box(30.4, 12, 0, 0.3, 3, 0.3, STEM);

    // ---------- corner trees ----------
    // north-east (4): thin rope bridge to the treehouse deck, plank down to the east deck
    trunk(16, -16, 2.5, 8);
    leaf(16, 8, -16, 3.5, 1.6, 3.5, LEAF2);
    deck(12, 20, -20, -12, 4);
    deck(6, 12, -20, -19, 4, ROPE, 0.25);
    k.ramp(19, -9, 2, 6, 0, 4, '-z', PLANK, { base: 3.6 });
    // south-east (8): rope bridge to the south deck; a kick chimney up from the east side
    trunk(16, 16, 2.5, 12);
    leaf(16, 12, 16, 3.5, 1.6, 3.5, LEAF2);
    deck(12, 20, 12, 20, 8);
    deck(5, 12, 19, 20, 8, ROPE, 0.25);
    deck(21, 23, 6, 13, 0, ROPE, 0.3);                                  // walkway from the east deck
    deck(20.6, 23.4, 13, 19, 0, WOOD, 0.4);
    k.box(20.35, 0, 16, 0.5, 8, 6, '#ff6a3d', K);
    k.box(23.65, 0, 16, 0.5, 8, 6, '#ff6a3d', K);
    // south-west (4): bridge to the west deck, plank up to the south deck
    trunk(-16, 16, 2.5, 8);
    leaf(-16, 8, 16, 3.5, 1.6, 3.5, LEAF2);
    deck(-20, -12, 12, 20, 4);
    deck(-20, -18, 9, 12, 4, ROPE, 0.3);
    k.ramp(-8.5, 19.5, 7, 1, 4, 8, '+x', PLANK, { base: 3.7 });
    // north-west (8): bridge to the treehouse roof, plank down to the west deck
    trunk(-16, -16, 2.5, 12);
    leaf(-16, 12, -16, 3.5, 1.6, 3.5, LEAF2);
    deck(-20, -12, -21, -13, 8);
    deck(-12, -4.5, -21, -19.5, 8, ROPE, 0.3);
    k.ramp(-19, -9.5, 2, 7, 4, 8, '-z', PLANK, { base: 3.7 });

    // hanging vines and lanterns (decoration)
    for (const [x, y, z, h] of [[-8.5, 4, -8.5, 4], [8.5, 3, -8.5, 5], [-11, 2, 14, 6], [11, 1, -14, 7], [-28, 8, 8.5, 4]]) k.deco(x, y, z, 0.1, h, 0.1, LEAF3);
    for (const [x, y, z] of [[5.6, 10.5, 5.6], [-5.6, 10.5, -5.6], [5.6, 10.5, -5.6], [-5.6, 10.5, 5.6]]) {
      k.deco(x, y + 0.7, z, 0.05, 1, 0.05, '#3b3226');
      k.deco(x, y, z, 0.4, 0.6, 0.4, '#ffd88a', { emissive: '#9a6a20' });
    }
  },
});
