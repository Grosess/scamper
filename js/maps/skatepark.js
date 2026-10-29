// THE SKATEPARK - a walled seaside skatepark at sunset, built for speed. No void: tall walls all
// round (invisible above them), so the only way down is a ramp, a drop or a slide.
//   center   THE FUNBOX: a 12x12 block (deck at 4) with launch ramps north and south, a slide
//            tunnel straight through it at ground level, and a 5x5 crown block on top (8) - kick
//            up its orange chimney on the west or hop the step on the east
//   east     the blue tower: a long deck at 4 with a block on top at 8, bridged to the funbox at
//            4 and 8, and to the two east corner platforms at 4
//   west     the lilac tower, the same idea mirrored (bridges on the other side)
//   corners  four 4m platforms, each a different way up: stairs (SE), bank ramp (SW),
//            crate step (NE), orange kick chimney (NW)
//   ground   rails to vault, ledges, planters, slide bars across the side lanes, lamp posts
// Every floor has 3.6m+ above it. Levels: ground 0, decks 4, tops 8.
defineMap({
  id: 'skatepark',
  accent: ['#ffb37a', '#7ed6c8'],
  name: 'The Skatepark',
  blurb: 'A walled seaside skatepark at sunset. Launch ramps, a slide tunnel through the funbox, bridges at two heights.',
  env: 'sky',
  sky: '#ffd8c2',
  fog: [70, 220],
  sea: -3,
  hemi: ['#fff1e3', '#6c6f86', 0.62],
  sun: [0.62, -30, 40, 25],
  size: 32,
  menuCam: { r: 30, y: 17 },
  spawns: [
    [-8, 0, -10], [8, 0, 10], [-10, 0, 10], [10, 0, -10], [0, 0, -18], [0, 0, 18],
    [-25.5, 0, -6], [25.5, 0, 6], [-13, 0, 0], [13, 0, 0],
    [-4.5, 4, -5], [0, 4, 5.5], [18, 4, -6], [-18, 4, 6], [23, 4, -23], [-23, 4, 23],
  ],
  seekerSpawn: [0, 4, 5.5],

  build(k) {
    const GROUND = '#3f4656', LINE = '#ffd166', CONC = '#c9b29a', CONC2 = '#a8927c', CONC3 = '#8d7b6a';
    const COPE = '#ffd166', MINT = '#3fb8a0', PINK = '#ff5f7e', BLUE = '#4f86e8', LILAC = '#8f6fe0';
    const WALL = '#e3a483', PEACH = '#ff9e5e', KICK = { tex: 'kick' };
    const H = 4, T = 8;   // deck and top heights

    // ---- ground + walls (14m, too tall to mantle) + invisible wall above them ----
    ground(k, 60, 60, GROUND);
    for (const s of [-1, 1]) {
      k.box(0, 0, s * 29, 60, 14, 2, WALL);
      k.box(s * 29, 0, 0, 2, 14, 56, WALL);
      k.wall(0, 14, s * 29, 60, 40, 2);
      k.wall(s * 29, 14, 0, 2, 40, 56);
    }
    // big flat "murals" on the walls (thin panels proud of the wall face)
    const MURAL = [['#ff5f7e', '#ffd166'], ['#3fb8a0', '#4f86e8'], ['#8f6fe0', '#ff5f7e'], ['#ffd166', '#3fb8a0']];
    [-14, 0, 14].forEach((c, i) => {
      for (const s of [-1, 1]) {
        const [a, b] = MURAL[(i + (s > 0 ? 1 : 0)) % 4];
        k.deco(c, 5, s * 27.96, 9, 6, 0.08, a, { emissive: '#2a1a14' });
        k.deco(c + 1.5, 7, s * 27.9, 4, 2.5, 0.08, b, { emissive: '#2a1a14' });
        k.deco(s * 27.96, 5, c, 0.08, 6, 9, b, { emissive: '#2a1a14' });
        k.deco(s * 27.9, 6.2, c - 1.5, 0.08, 2.5, 4, a, { emissive: '#2a1a14' });
      }
    });
    // painted lines on the ground
    for (const s of [-1, 1]) {
      k.deco(0, 0, s * 14, 30, 0.02, 0.25, LINE);
      k.deco(s * 12, 0, 0, 0.25, 0.02, 16, LINE);
    }

    // ---- THE FUNBOX (center) ----
    const coping = (x, y, z, w, d) => k.deco(x, y - 0.12, z, w, 0.16, d, COPE);
    k.box(0, 0, -4.5, 12, H, 6, CONC);                 // north half
    k.box(0, 0, 4.5, 12, H, 6, CONC);                  // south half
    k.box(0, 1.2, 0, 12, H - 1.2, 3, CONC2);           // roof of the slide tunnel (1.2m high)
    k.deco(0, 0.01, 0, 12, 0.02, 3, '#3d4350');        // tunnel floor stripe
    for (const s of [-1, 1]) k.deco(s * 6.02, 1.2, 0, 0.04, 0.25, 3, COPE, { emissive: '#7a5a00' });   // tunnel lips glow
    for (const s of [-1, 1]) coping(0, H, s * 7.5, 12.04, 0.25);
    // launch ramps north + south (3.0 wide lanes either side of a center rail)
    k.ramp(0, -11, 7, 7, 0, H, '+z', MINT);
    k.ramp(0, 11, 7, 7, 0, H, '-z', MINT);
    // crown block on top (8): kick chimney on the north side, step on the south side
    k.box(0, H, 0, 5, T - H, 5, PEACH);
    coping(0, T, 0, 5.04, 5.04);
    k.box(0, H, -5.5, 5, T - H + 0.5, 0.5, '#ff6a3d', KICK);   // orange wall 2.75m off the block's north face
    k.box(0, H, 3.5, 3, 1.2, 2, CONC3);                          // step on the south side (5.2)
    // side steps up onto the funbox from the ground (1.2, then pull up to 4)
    k.box(7.5, 0, 4.5, 3, 1.2, 4, CONC3);
    k.box(-7.5, 0, -4.5, 3, 1.2, 4, CONC3);

    // ---- side towers (east blue, west lilac): deck at 4 (14 long), block on top to 8 ----
    for (const s of [-1, 1]) {
      const x = s * 19, col = s > 0 ? BLUE : LILAC;
      k.box(x, 0, 0, 8, H, 14, col);
      coping(x, H, 0, 8.04, 14.04);
      k.box(x, H, s * -2, 8, T - H, 6, CONC);           // the 8m block sits toward one end
      coping(x, T, s * -2, 8.04, 6.04);
      // deck -> top: an orange kick chimney on one side of the block, a step on the other
      k.box(x, H, s * -2 + s * 6.25, 8, T - H + 0.5, 0.5, '#ff6a3d', KICK);   // 3m off the block's face
      k.box(x + s * 2.5, H, s * -2 - s * 4, 3, 1.2, 2, CONC3);                  // step (5.2) on the other end
      // ground -> deck: ramps at both ends of the deck
      k.ramp(x - s * 2, 10.5, 4, 7, 0, H, '-z', MINT);
      k.ramp(x - s * 2, -10.5, 4, 7, 0, H, '+z', MINT);
      // bridges: funbox deck <-> tower deck at 4 (off-center), funbox top <-> tower top at 8
      bridge(k, s * 6, s * -5.5, s * 15, s * -5.5, H, 3, CONC2);
      bridge(k, s * 2.5, 0, s * 15, 0, T, 3, CONC2);
      // lamp glow strips along the tower base
      k.deco(x - s * 4.02, 1.8, 0, 0.04, 0.3, 10, col, { emissive: col });
    }

    // ---- corner platforms (4m), each a different way up, bridged to the tower decks ----
    const corner = (sx, sz, col) => {
      k.box(sx * 23, 0, sz * 23, 10, H, 10, col);
      coping(sx * 23, H, sz * 23, 10.04, 10.04);
      bridge(k, sx * 21.5, sz * 7, sx * 21.5, sz * 18, H, 3, CONC2);
    };
    corner(1, 1, '#f2c14e');     // SE: stairs
    corner(-1, 1, '#ef7f94');    // SW: bank ramp
    corner(1, -1, '#5fc4a8');    // NE: crate step
    corner(-1, -1, '#9d86e6');   // NW: kick chimney
    stairs(k, 11, 23, '+x', 3, 0, H, CONC3);
    k.ramp(-14.5, 23, 7, 5, 0, H, '-x', MINT);
    k.box(16.5, 0, -23, 3, 1.2, 4, '#c7a77a');
    k.box(-14.75, 0, -23, 0.5, H + 0.5, 6, '#ff6a3d', KICK);   // 3m off the NW platform's face

    // ---- ground: rails (vault), ledges, planters, slide bars, benches ----
    for (const [x, z] of [[-9, -15], [9, 15], [-15, 9], [15, -9]]) k.box(x, 0, z, x === -9 || x === 9 ? 6 : 0.4, 1.0, x === -9 || x === 9 ? 0.4 : 6, PINK);
    for (const s of [-1, 1]) {
      k.box(0, 0, s * 23.5, 10, 1.2, 2, CONC3);                // long ledges by the north/south walls
      coping(0, 1.2, s * 23.5, 10.04, 2.04);
      k.box(s * 25.5, 1.25, 0, 5, 0.35, 0.4, '#3d4350');       // slide bars across the side lanes
    }
    for (const [x, z] of [[-8, -20], [8, 20], [-25, -11], [25, 11]]) {
      k.box(x, 0, z, 3, 1.2, 3, '#7a9a6a');                    // planters
      k.box(x, 1.2, z, 2.2, 0.8, 2.2, '#9cc28a', { noShadow: true });
    }
    for (const [x, z, w, d] of [[-13, 5, 4, 1], [13, -5, 4, 1], [5, -19, 1, 4], [-5, 19, 1, 4]]) k.box(x, 0, z, w, 0.6, d, '#c9a27e');   // benches
    // shipping containers (2.6: jump + pull up) - cover that breaks up the open ground
    for (const [x, z, alongX, col] of [[10, -17, true, '#d9534f'], [-10, 17, true, '#2f6fb5'], [11, 10, false, '#2f8f6a'], [-11, -10, false, '#e08a2c']]) {
      k.box(x, 0, z, alongX ? 6 : 2.4, 2.6, alongX ? 2.4 : 6, col);
      for (const e of [-1, 1]) {   // darker door ends
        if (alongX) k.deco(x + e * 3.01, 0.15, z, 0.04, 2.3, 2.1, '#1f2433', { opacity: 0.35 });
        else k.deco(x, 0.15, z + e * 3.01, 2.1, 2.3, 0.04, '#1f2433', { opacity: 0.35 });
      }
    }
    // shade roofs in front of the north + south ledges (top 4): jump off the ledge and pull up,
    // or hop across from a container
    for (const s of [-1, 1]) {
      slab(k, 0, H, s * 19, 12, 4, '#f2ece2', { t: 0.4 });
      posts(k, [[-5.8, s * 17.2], [5.8, s * 17.2], [-5.8, s * 20.8], [5.8, s * 20.8]], 0, H - 0.4, '#3d4350', 0.35);
      k.deco(0, H - 0.4, s * 16.98, 12, 0.3, 0.04, PINK, { emissive: '#5a1020' });
    }

    // lamp posts with warm heads
    for (const [x, z] of [[-13, -13], [13, 13], [-13, 13], [13, -13], [0, -26], [0, 26], [-26, 13], [26, -13]]) {
      k.box(x, 0, z, 0.4, 6, 0.4, '#3d4350');
      k.deco(x, 6, z, 1.0, 0.35, 1.0, '#fff1c9', { emissive: '#ffcf7a' });
    }
  },
});
