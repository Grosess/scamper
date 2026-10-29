// THE SKATEPARK - a walled seaside skatepark at sunset, built for speed. No void: walls all round
// (invisible above them), so the only way down is a ramp, a drop or a slide. The walls are low
// enough to see the boardwalk, the palms and the sea beyond.
//   center   THE FUNBOX: a 12x12 block (deck at 4) with launch ramps north and south, a slide
//            tunnel straight through it at ground level, and a 5x5 crown block on top (8) - kick
//            up its orange chimney on the north or hop the step on the south
//   east     the blue tower: a long deck at 4 with a block on top at 8 (step or orange chimney),
//            bridged to the funbox and to the two east corner platforms at 4
//   west     the lilac tower, the same idea mirrored
//   corners  four 4m platforms, each a different way up: stairs (SE), bank ramp (SW),
//            crate step (NE), orange kick chimney (NW)
//   ground   rails to vault, ledges, planters, slide bars across the side lanes, containers
// Every floor has 3.6m+ above it. Levels: ground 0, decks 4, tops 8.
defineMap({
  id: 'skatepark',
  accent: ['#ff9e5e', '#3fb8a0'],
  name: 'The Skatepark',
  blurb: 'A seaside skatepark at sunset. Launch ramps, a slide tunnel through the funbox, decks and towers to run.',
  env: 'fog',
  sky: '#ffb995',
  fog: [80, 330],
  hemi: ['#ffe9d6', '#6d5f7d', 1.55],
  sun: [0.9, -30, 40, 25],
  size: 32,
  menuCam: { r: 30, y: 15 },
  spawns: [
    [-8, 0, -10], [8, 0, 10], [-10, 0, 10], [10, 0, -10], [0, 0, -18], [0, 0, 18],
    [-25.5, 0, -6], [25.5, 0, 6], [-13, 0, 0], [13, 0, 0],
    [-4.5, 4, -5], [0, 4, 5.5], [18, 4, -6], [-18, 4, 6], [23, 4, -23], [-23, 4, 23],
  ],
  seekerSpawn: [0, 4, 5.5],

  build(k) {
    // one sunset palette: warm painted concrete, sea teal, coral, sky blue, lilac, butter
    const ASPHALT = '#4a4d5e', CONC = '#d8bfa6', CONC2 = '#bfa48c', CONC3 = '#a68d78';
    const STEEL = '#e9edf2', MINT = '#3fb8a0', CORAL = '#ff6f7d', BLUE = '#4f86e8', LILAC = '#8f6fe0';
    const BUTTER = '#ffd166', WALL = '#f0b796', WALLTOP = '#ffe3cf', PEACH = '#ff9e5e', KICK = { tex: 'kick' };
    const H = 4, T = 8, WH = 7;   // deck, top and wall heights

    // ---- ground, walls (7m) with an invisible wall above ----
    ground(k, 60, 60, ASPHALT);
    for (const s of [-1, 1]) {
      k.box(0, 0, s * 29, 60, WH, 2, WALL);
      k.box(s * 29, 0, 0, 2, WH, 56, WALL);
      k.wall(0, WH, s * 29, 60, 40, 2);
      k.wall(s * 29, WH, 0, 2, 40, 56);
      // a cap along the wall tops
      k.deco(0, WH, s * 29, 60.2, 0.25, 2.2, WALLTOP);
      k.deco(s * 29, WH, 0, 2.2, 0.25, 55.8, WALLTOP);
    }

    // ---- murals: bold stripes and blocks on the inner wall faces (thin panels, two depths) ----
    const IN = 27.96, IN2 = 27.9, IN3 = 27.84;
    const mural = (c, s, alongX, cols) => {
      const panel = (o, y, w, h, col, d) => alongX ? k.deco(c + o, y, s * d, w, h, 0.08, col) : k.deco(s * d, y, c + o, 0.08, h, w, col);
      panel(0, 0.6, 10, 5, cols[0], IN);                                   // background
      for (let i = 0; i < 3; i++) panel(-3 + i * 3, 1.0 + i * 0.6, 1.4, 3.8 - i * 0.6, cols[1 + (i % 2)], IN2);   // bold bars
      panel(2.8, 4.1, 3.2, 1.0, cols[3], IN3);                             // a sunset bar, in front
    };
    const SETS = [[LILAC, BUTTER, CORAL, '#ffffff'], [MINT, BUTTER, BLUE, CORAL], [CORAL, BUTTER, LILAC, MINT], [BLUE, MINT, BUTTER, CORAL]];
    [-14, 0, 14].forEach((c, i) => {
      for (const s of [-1, 1]) {
        mural(c, s, true, SETS[(i + (s > 0 ? 1 : 0)) % 4]);
        mural(c, s, false, SETS[(i + (s > 0 ? 3 : 2)) % 4]);
      }
    });

    // ---- painted ground: color zones, lane lines, a big target on the open floor ----
    for (const s of [-1, 1]) {
      k.deco(0, 0, s * 14, 30, 0.02, 0.25, BUTTER);                        // lane lines
      k.deco(s * 12, 0, 0, 0.25, 0.02, 16, BUTTER);
      k.deco(s * 22, 0, 0, 10, 0.012, 22, s > 0 ? '#3f5f9e' : '#5f4f9e');   // under the towers
    }
    for (const [x, z, col] of [[-16, -16, '#5d4a6e'], [16, 16, '#4a5f6e'], [16, -16, '#4a6e62'], [-16, 16, '#6e4a55']]) k.deco(x, 0, z, 8, 0.012, 8, col);
    for (const [r, col] of [[3.2, CORAL], [2.2, BUTTER], [1.2, '#ffffff']]) k.deco(0, 0, -17.5, r * 2, 0.012 + r * 0.004, r * 2, col);   // target in front of the north ramp
    for (const [r, col] of [[3.2, MINT], [2.2, BUTTER], [1.2, '#ffffff']]) k.deco(0, 0, 17.5, r * 2, 0.012 + r * 0.004, r * 2, col);

    // ---- THE FUNBOX (center) ----
    const coping = (x, y, z, w, d) => k.deco(x, y - 0.12, z, w, 0.16, d, STEEL);
    k.box(0, 0, -4.5, 12, H, 6, CONC);                 // north half
    k.box(0, 0, 4.5, 12, H, 6, CONC);                  // south half
    k.box(0, 1.2, 0, 12, H - 1.2, 3, CONC2);           // roof of the slide tunnel (1.2m high)
    k.deco(0, 0.01, 0, 12, 0.02, 3, '#2f3240');        // tunnel floor stripe
    for (const s of [-1, 1]) k.deco(s * 6.02, 1.2, 0, 0.04, 0.25, 3, BUTTER, { emissive: '#7a5a00' });   // tunnel lips glow
    for (const s of [-1, 1]) coping(0, H, s * 7.5, 12.04, 0.25);
    // color blocking on the funbox sides
    for (const s of [-1, 1]) {
      k.deco(s * 6.03, 0.6, s * -4.5, 0.04, 2.6, 4.6, CORAL);
      k.deco(s * 6.03, 0.6, s * 4.5, 0.04, 2.6, 4.6, MINT);
    }
    // launch ramps north + south
    k.ramp(0, -11, 7, 7, 0, H, '+z', MINT);
    k.ramp(0, 11, 7, 7, 0, H, '-z', MINT);
    // crown block on top (8): kick chimney on the north side, step on the south side
    k.box(0, H, 0, 5, T - H, 5, PEACH);
    coping(0, T, 0, 5.04, 5.04);
    k.box(0, H, -5.5, 5, T - H + 0.5, 0.5, '#ff6a3d', KICK);   // orange wall 2.75m off the block's north face
    k.box(0, H, 3.5, 3, 1.2, 2, CONC3);                          // step on the south side (5.2)
    k.deco(0, H + 1.2, 3.5, 3.04, 0.12, 2.04, STEEL);
    // side steps up onto the funbox from the ground (1.2, then pull up to 4)
    k.box(7.5, 0, 4.5, 3, 1.2, 4, CONC3);
    k.box(-7.5, 0, -4.5, 3, 1.2, 4, CONC3);
    for (const s of [-1, 1]) k.deco(s * 7.5, 1.08, s * 4.5, 3.04, 0.16, 4.04, STEEL);

    // ---- side towers (east blue, west lilac): deck at 4 (14 long), block on top to 8 ----
    for (const s of [-1, 1]) {
      const x = s * 19, col = s > 0 ? BLUE : LILAC;
      k.box(x, 0, 0, 8, H, 14, col);
      coping(x, H, 0, 8.04, 14.04);
      k.box(x, H, s * -2, 8, T - H, 6, CONC);           // the 8m block sits toward one end
      coping(x, T, s * -2, 8.04, 6.04);
      k.deco(x - s * 4.03, H + 1, s * -2, 0.04, 2, 6.04 - 0.1, col);        // tower color band on the block
      // deck -> top: an orange kick chimney on one side of the block, a step on the other
      k.box(x, H, s * -2 + s * 6.25, 8, T - H + 0.5, 0.5, '#ff6a3d', KICK);   // 3m off the block's face
      k.box(x + s * 2.5, H, s * -2 - s * 4, 3, 1.2, 2, CONC3);                  // step (5.2) on the other end
      // ground -> deck: ramps at both ends of the deck
      k.ramp(x - s * 2, 10.5, 4, 7, 0, H, '-z', MINT);
      k.ramp(x - s * 2, -10.5, 4, 7, 0, H, '+z', MINT);
      // bridge: funbox deck <-> tower deck at 4 (off-center)
      bridge(k, s * 6, s * -5.5, s * 15, s * -5.5, H, 3, CONC2);
      k.deco((s * 6 + s * 15) / 2, H - 0.42, s * -5.5 + 1.52, 9, 0.12, 0.04, STEEL, {});
      // glow strip along the tower base
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

    // ---- ground: rails (vault), ledges, planters, slide bars, benches, containers ----
    for (const [x, z] of [[-9, -15], [9, 15], [-15, 9], [15, -9]]) k.box(x, 0, z, x === -9 || x === 9 ? 6 : 0.4, 1.0, x === -9 || x === 9 ? 0.4 : 6, CORAL);
    for (const s of [-1, 1]) {
      k.box(0, 0, s * 23.5, 10, 1.2, 2, CONC3);                // long ledges by the north/south walls
      coping(0, 1.2, s * 23.5, 10.04, 2.04);
      k.box(s * 25.5, 1.25, 0, 5, 0.35, 0.4, '#3d4350');       // slide bars across the side lanes
      for (const z of [-0.08, 0.08]) k.deco(s * 25.5, 1.27, z * 2.6, 5.04, 0.08, 0.06, BUTTER, { emissive: '#6a4a00' });
    }
    for (const [x, z] of [[-8, -20], [8, 20], [-25, -11], [25, 11]]) {
      k.box(x, 0, z, 3, 1.2, 3, '#7a9a6a');                    // planters with little palms
      k.box(x, 1.2, z, 2.2, 0.8, 2.2, '#9cc28a', { noShadow: true });
      k.deco(x, 2.0, z, 0.25, 1.6, 0.25, '#8a6a4a');
      k.deco(x, 3.5, z, 1.8, 0.2, 0.5, '#5aa86a');
      k.deco(x, 3.45, z, 0.5, 0.2, 1.8, '#4f9a5f');
    }
    for (const [x, z, w, d] of [[-13, 5, 4, 1], [13, -5, 4, 1], [5, -19, 1, 4], [-5, 19, 1, 4]]) {
      k.box(x, 0, z, w, 0.6, d, '#c9a27e');                    // benches
      k.deco(x, 0.6, z, w - 0.2, 0.06, d - 0.2, '#e2bf98');
    }
    for (const [x, z, alongX, col] of [[10, -17, true, '#d9534f'], [-10, 17, true, '#2f6fb5'], [11, 10, false, '#2f8f6a'], [-11, -10, false, '#e08a2c']]) {
      k.box(x, 0, z, alongX ? 6 : 2.4, 2.6, alongX ? 2.4 : 6, col);
      for (const e of [-1, 1]) {   // darker door ends with a white stripe
        if (alongX) { k.deco(x + e * 3.01, 0.15, z, 0.04, 2.3, 2.1, '#1f2433', { opacity: 0.35 }); k.deco(x + e * 3.04, 1.1, z, 0.04, 0.3, 2.1, '#ffffff'); }
        else { k.deco(x, 0.15, z + e * 3.01, 2.1, 2.3, 0.04, '#1f2433', { opacity: 0.35 }); k.deco(x, 1.1, z + e * 3.04, 2.1, 0.3, 0.04, '#ffffff'); }
      }
    }
    // shade roofs in front of the north + south ledges (top 4)
    for (const s of [-1, 1]) {
      slab(k, 0, H, s * 19, 12, 4, '#f2ece2', { t: 0.4 });
      posts(k, [[-5.8, s * 17.2], [5.8, s * 17.2], [-5.8, s * 20.8], [5.8, s * 20.8]], 0, H - 0.4, '#3d4350', 0.35);
      k.deco(0, H - 0.4, s * 16.98, 12, 0.3, 0.04, CORAL, { emissive: '#5a1020' });
      for (let i = -2; i <= 2; i++) k.deco(i * 2.4, H, s * 19, 1.2, 0.05, 4.02, i % 2 ? CORAL : '#ffffff');   // striped awning top
    }
    // little things: trash cans, skateboards lying around (no collision)
    for (const [x, z] of [[-26, -26], [26, 26], [26, -26.2], [-26, 26.2], [-4, -24.8], [4, 24.8]]) {
      k.deco(x, 0, z, 0.9, 1.1, 0.9, '#3f7f6a');
      k.deco(x, 1.1, z, 1.0, 0.12, 1.0, '#2f5f50');
    }
    for (const [x, z, a, col] of [[-6, -13, 0, CORAL], [7, 13.5, 0, BLUE], [-21, 12, 1, BUTTER], [20, -13, 1, MINT], [3, -21.3, 0, LILAC]]) {
      const w = a ? 0.32 : 1.1, d = a ? 1.1 : 0.32;
      k.deco(x, 0.12, z, w, 0.05, d, col);
      for (const e of [-0.38, 0.38]) k.deco(x + (a ? 0 : e), 0.02, z + (a ? e : 0), a ? 0.3 : 0.1, 0.1, a ? 0.1 : 0.3, '#2f3240');
    }

    // ---- string lights: four garlands hung wall to wall, sagging in the middle ----
    const BULBS = ['#ffd27a', '#ff9e7a', '#fff1c9'];
    const garland = (x0, z0, x1, z1) => {
      const n = 26;
      for (let i = 0; i <= n; i++) {
        const t = i / n, y = 6.7 - Math.sin(t * Math.PI) * 1.0;
        const c = BULBS[i % 3];
        k.deco(x0 + (x1 - x0) * t, y, z0 + (z1 - z0) * t, 0.22, 0.26, 0.22, c, { emissive: c });
      }
    };
    garland(-27.8, -15, 27.8, -15);
    garland(-27.8, 15, 27.8, 15);
    garland(-12, -27.8, -12, 27.8);
    garland(12, -27.8, 12, 27.8);

    // ---- outside: boardwalk, railing, palms, beach, sea and the setting sun ----
    k.deco(0, -2.6, 0, 700, 0.2, 700, '#5b8fbf');                                  // the sea
    for (const s of [-1, 1]) {
      k.deco(0, -0.3, s * 33, 72, 0.3, 6, '#b48a62');                              // boardwalk
      k.deco(s * 33, -0.3, 0, 6, 0.3, 60, '#b48a62');
      for (let i = -11; i <= 11; i++) {
        k.deco(i * 3, 0.01, s * 33, 0.06, 0.02, 6, '#8f6a4a');                     // plank seams
        if (Math.abs(i) <= 9) k.deco(s * 33, 0.01, i * 3, 6, 0.02, 0.06, '#8f6a4a');
      }
      k.deco(0, 1.0, s * 35.9, 72, 0.12, 0.12, '#fff1e3');                         // railing
      k.deco(s * 35.9, 1.0, 0, 0.12, 0.12, 60, '#fff1e3');
      for (let i = -12; i <= 12; i += 2) {
        k.deco(i * 3, -0.3, s * 35.9, 0.12, 1.3, 0.12, '#fff1e3');
        if (Math.abs(i) <= 9) k.deco(s * 35.9, -0.3, i * 3, 0.12, 1.3, 0.12, '#fff1e3');
      }
      k.deco(0, -1.4, s * 44, 110, 1.0, 10, '#f2d3a0');                            // sand
      k.deco(s * 44, -1.4, 0, 10, 1.0, 78, '#f2d3a0');
    }
    // blocky palms along the boardwalk
    const palm = (x, z, h, lean) => {
      for (let i = 0; i < 4; i++) k.deco(x + lean * i * 0.35, i * h / 4 - 0.3, z, 0.5 - i * 0.05, h / 4 + 0.05, 0.5 - i * 0.05, i % 2 ? '#9a7450' : '#8a6644');
      const tx = x + lean * 1.4, ty = h - 0.3;
      k.deco(tx, ty, z, 4.2, 0.35, 0.9, '#3f9a5c');
      k.deco(tx, ty - 0.05, z, 0.9, 0.35, 4.2, '#4aa868');
      k.deco(tx, ty + 0.25, z, 2.6, 0.3, 2.6, '#57b874');
    };
    [[-24, -37.5, 9, 1], [-8, -38, 11, -1], [10, -37.5, 10, 1], [26, -38, 8.5, -1], [-20, 38, 10, -1], [2, 37.5, 9, 1], [20, 38, 11, -1],
      [-37.5, -18, 10, 1], [-38, 6, 9, -1], [-37.5, 22, 11, 1], [38, -22, 9, -1], [37.5, -2, 11, 1], [38, 18, 10, -1]].forEach(([x, z, h, l]) => palm(x, z, h, l));
    // the sun going down over the sea, with a glow band
    k.deco(-40, 10, -150, 34, 34, 2, '#ffd27a', { emissive: '#ffb347' });
    k.deco(-40, 15, -152, 60, 6, 2, '#ffc79a', { emissive: '#ff9e6a' });
  },
});
