// THE SKATEPARK - a walled skatepark by the sea, built for speed. No void: walls all round
// (invisible above them). Same layout as before, ~15% tighter, and kept plain: concrete plus a
// few bold colors, like Rooftops and the Container Yard.
//   center   THE FUNBOX: a block (deck at 4) with launch ramps north and south, a slide tunnel
//            straight through it at ground level, and a crown block on top (8) - kick up its
//            orange chimney on the north or hop the step on the south
//   east     the blue tower: a long deck at 4 with a block on top at 8 (step or orange chimney),
//            bridged to the funbox and to the two east corner platforms at 4
//   west     the coral tower, the same idea mirrored
//   corners  four 4m platforms, each a different way up: stairs (SE), bank ramp (SW),
//            crate step (NE), orange kick chimney (NW)
//   ground   rails to vault, ledges, planters, slide bars across the side lanes, containers,
//            two shade roofs (5.2, reached from the containers next to them)
// Every floor has 3.6m+ above it. Levels: ground 0, decks 4, tops 8.
defineMap({
  id: 'skatepark',
  accent: ['#3fb8a0', '#4f86e8'],
  name: 'The Skatepark',
  blurb: 'A walled skatepark by the sea. Launch ramps, a slide tunnel through the funbox, decks and towers to run.',
  env: 'sky',
  sky: '#a9d6ff',
  sea: -3,
  fog: [90, 300],
  hemi: ['#eaf4ff', '#5a6470', 0.95],
  sun: [1.0, 30, 55, 20],
  size: 28,
  menuCam: { r: 26, y: 15 },
  spawns: [
    [-7, 0, -8.5], [7, 0, 8.5], [-8.5, 0, 8.5], [8.5, 0, -8.5], [0, 0, -12.6], [0, 0, 12.6],
    [-21.5, 0, -5], [21.5, 0, 5], [-11, 0, 0], [11, 0, 0],
    [-3.8, 4, -4.3], [0, 4, 4.7], [15.3, 4, -5], [-15.3, 4, 5], [19.4, 4, -19.4], [-19.4, 4, 19.4],
  ],
  seekerSpawn: [0, 4, 4.7],

  build(k) {
    const ASPHALT = '#4a4f5a', CONC = '#c9c4ba', CONC2 = '#a9a398';
    const TEAL = '#1f7a6c', CORAL = '#b8463c', BLUE = '#2f55a8', BUTTER = '#d9a62e', KICK = { tex: 'kick' };
    const H = 4, T = 8, WH = 7, HW = 24.5;   // deck, top, wall heights; wall center line

    // ---- ground and walls (7m) with an invisible wall above ----
    ground(k, 51, 51, ASPHALT);
    for (const s of [-1, 1]) {
      k.box(0, 0, s * HW, 51, WH, 2, CONC);
      k.box(s * HW, 0, 0, 2, WH, 47, CONC);
      k.wall(0, WH, s * HW, 51, 40, 2);
      k.wall(s * HW, WH, 0, 2, 40, 47);
    }

    // ---- THE FUNBOX (center) ----
    k.box(0, 0, -4.05, 10.2, H, 5.1, CONC2);            // north half
    k.box(0, 0, 4.05, 10.2, H, 5.1, CONC2);             // south half
    k.box(0, 1.2, 0, 10.2, H - 1.2, 3, CONC2);          // roof of the slide tunnel (1.2m high)
    k.ramp(0, -9.6, 6, 6, 0, H, '+z', TEAL);            // launch ramps north + south
    k.ramp(0, 9.6, 6, 6, 0, H, '-z', TEAL);
    // crown block on top (8): orange kick wall 3m off its north face, a step on the south
    k.box(0, H, 0, 4.5, T - H, 4.5, CORAL);
    k.box(0, H, -5.5, 4.5, T - H + 0.5, 0.5, '#ff6a3d', KICK);
    k.box(0, H, 3.25, 3, 1.2, 2, CONC);
    // side steps up onto the funbox from the ground (1.2, then pull up to 4)
    k.box(6.4, 0, 3.8, 2.6, 1.2, 3.4, CONC);
    k.box(-6.4, 0, -3.8, 2.6, 1.2, 3.4, CONC);

    // ---- side towers (east blue, west coral): deck at 4, block on top to 8 ----
    for (const s of [-1, 1]) {
      const x = s * 16.15, col = s > 0 ? BLUE : CORAL;
      k.box(x, 0, 0, 6.8, H, 11.9, col);
      k.box(x, H, s * -1.7, 6.8, T - H, 5.1, CONC);              // the 8m block toward one end
      k.box(x, H, s * 4.1, 6.8, T - H + 0.5, 0.5, '#ff6a3d', KICK);   // kick wall 3m off the block
      k.box(x + s * 2.1, H, s * -5.1, 2.6, 1.2, 1.7, CONC2);     // step (5.2) at the other end
      k.ramp(x - s * 1.95, 8.95, 3, 6, 0, H, '-z', TEAL);       // ramps up at both deck ends
      k.ramp(x - s * 1.95, -8.95, 3, 6, 0, H, '+z', TEAL);
      bridge(k, s * 5.1, s * -4.7, s * 12.75, s * -4.7, H, 3, CONC);   // funbox <-> tower at 4
    }

    // ---- corner platforms (4m), each a different way up, bridged to the tower decks ----
    const corner = (sx, sz, col) => {
      k.box(sx * 19.4, 0, sz * 19.4, 8, H, 8, col);
      bridge(k, sx * 17.9, sz * 5.95, sx * 17.9, sz * 15.4, H, 3, CONC);
    };
    corner(1, 1, BUTTER);     // SE: stairs
    corner(-1, 1, TEAL);      // SW: bank ramp
    corner(1, -1, TEAL);      // NE: crate step
    corner(-1, -1, BUTTER);   // NW: kick chimney
    stairs(k, 8.4, 19.4, '+x', 3, 0, H, CONC2);
    k.ramp(-12.4, 19.4, 6, 4, 0, H, '-x', TEAL);
    k.box(13.9, 0, -19.4, 3, 1.2, 4, CONC2);
    k.box(-12.15, 0, -19.4, 0.5, H + 0.5, 6, '#ff6a3d', KICK);  // 3m off the NW platform's face

    // ---- ground: rails (vault), ledges, planters, slide bars, containers, shade roofs ----
    for (const [x, z, alongX] of [[-7.65, -12.75, true], [7.65, 12.75, true], [-11.6, 7.65, false], [11.6, -7.65, false]]) {
      k.box(x, 0, z, alongX ? 5 : 0.4, 1.0, alongX ? 0.4 : 5, CORAL);
    }
    for (const s of [-1, 1]) {
      k.box(0, 0, s * 20.5, 8.5, 1.2, 2, CONC2);                 // long ledges by the north/south walls
      k.box(s * 21.55, 1.25, 0, 3.9, 0.35, 0.4, '#3d4350');        // slide bars across the side lanes
    }
    for (const [x, z] of [[-21.3, -9.4], [21.3, 9.4], [21.3, -9.4], [-21.3, 9.4]]) k.box(x, 0, z, 2.6, 1.2, 2.6, TEAL);   // planters
    for (const [x, z, alongX, col] of [[8.5, -14.45, true, CORAL], [-8.5, 14.45, true, BLUE], [9.4, 8.5, false, BLUE], [-9.4, -8.5, false, CORAL]]) {
      k.box(x, 0, z, alongX ? 6 : 2.4, 2.6, alongX ? 2.4 : 6, col);
    }
    // shade roofs in front of the ledges: top 5.2, 4.8 clear underneath; hop on from the containers
    for (const s of [-1, 1]) {
      slab(k, 0, 5.2, s * 16.2, 10, 3.4, BUTTER, { t: 0.4 });
      posts(k, [[-4.8, s * 14.7], [4.8, s * 14.7], [-4.8, s * 17.7], [4.8, s * 17.7]], 0, 4.8, '#3d4350', 0.35);
    }
  },
});
