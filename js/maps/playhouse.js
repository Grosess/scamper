// THE PLAYHOUSE - one big indoor play hall with five bold structures you can always see and steer by.
// Three heights everywhere: the floor (0), LOW walkways (4.4) and HIGH walkways (8.8).
//   castle        (pink, west) walls you run along at 4.4, gates and a crawl hole to cut through, a
//                 courtyard trampoline, corner towers at 8.8
//   balloon room  (lilac, north-east) walls up to 8.8 full of balloons that dodge you. A rope bridge
//                 runs straight through it at 4.4; its rim at 8.8 links to the castle
//   climb tower   (blue, east) a spiral of blocks around a column - hop up block by block to 13.2
//   slide hill    (yellow, south-west) a 8.8 hill with two long slides down into the middle
//   the floor     soft blocks, pillars and bars to juke around, trampolines, net walls
// Ways up: step blocks (2.2 each) for mantling, orange kick walls, trampolines, the tower spiral.
// Everything above a floor is at least 3.6m over it - no head bumping.
defineMap({
  id: 'playhouse',
  accent: ['#ff8fa3', '#8fb4ff'],
  name: 'The Playhouse',
  blurb: 'A giant play hall: a castle, a climbing tower, a slide hill and a room full of balloons that dodge you.',
  env: 'indoor',
  sky: '#141824',
  fog: [40, 110],
  hemi: ['#ffffff', '#c4cbe0', 1.55],
  sun: [0.45, 4, 60, 6],
  size: 32,
  spotHeight: 16.7,
  spots: [-18, 0, 18].flatMap((x) => [-14, 6].map((z) => ({ x, z }))),
  menuCam: { r: 19, y: 14 },
  spawns: [
    [-12.5, 0, -2.5], [-26, 0, 8], [-20, 0, 22.5], [2, 0, 21.5], [24, 0, 20], [25, 0, 2],
    [2, 0, -20], [-6, 0, -21], [14, 0, -13], [8, 0, 3], [-3, 0, -6], [4, 0, 12],
    [-16, 4.4, -13.2], [0, 4.4, -9.5], [-9, 8.8, 16], [16, 4.4, 7.3],
  ],
  seekerSpawn: [0, 0, 1],

  build(k) {
    const LOW = 4.4, HIGH = 8.8, TOP = 17;
    const PINK = '#ff7a98', PINK2 = '#ffadc0', LILAC = '#b08cff', LILAC2 = '#d6c6ff', BLUE = '#6f9bff', BLUE2 = '#4f7fe0';
    const YEL = '#ffca3a', YEL2 = '#ffdf85', MINT = '#5fd0be', PEACH = '#ff9f5e', SKY = '#8fd0ee', GREEN = '#7fd98e';
    const BRIDGE = '#fff6e6', KICK = { tex: 'kick' };
    const solid = (x0, x1, y0, y1, z0, z1, c, o) => k.box((x0 + x1) / 2, y0, (z0 + z1) / 2, x1 - x0, y1 - y0, z1 - z0, c, o);
    // a straight wall from A to B (along x or z), 0..h high, with rectangular holes {a, b, y0, y1}
    const segs = (A, B, h, holes, put) => {
      const cuts = [A, B, ...holes.flatMap((o) => [o.a, o.b])].filter((v) => v >= A && v <= B).sort((p, q) => p - q);
      for (let i = 0; i < cuts.length - 1; i++) {
        const a = cuts[i], b = cuts[i + 1], m = (a + b) / 2;
        if (b - a < 0.01) continue;
        let y = 0;
        for (const o of holes.filter((q) => q.a <= m && q.b >= m).sort((p, q) => p.y0 - q.y0)) {
          if (o.y0 > y) put(a, b, y, o.y0);
          y = Math.max(y, o.y1);
        }
        if (y < h) put(a, b, y, h);
      }
    };
    const wallX = (xa, xb, z0, z1, h, holes, c) => segs(xa, xb, h, holes, (a, b, y0, y1) => solid(a, b, y0, y1, z0, z1, c));
    const wallZ = (za, zb, x0, x1, h, holes, c) => segs(za, zb, h, holes, (a, b, y0, y1) => solid(x0, x1, y0, y1, a, b, c));
    const gate = (c) => ({ a: c - 1.5, b: c + 1.5, y0: 0, y1: 3.6 });
    const bridgeX = (x0, x1, z, top, w = 1.8) => slab(k, (x0 + x1) / 2, top, z, x1 - x0, w, BRIDGE, { t: 0.4 });
    const bridgeZ = (z0, z1, x, top, w = 1.8) => slab(k, x, top, (z0 + z1) / 2, w, z1 - z0, BRIDGE, { t: 0.4 });

    ground(k, 56, 48, '#dfe4ec');
    enclose(k, 56, 48, TOP, '#cdd4e0', '#eef1f6');
    // colored floor mats under each structure (so you can tell zones apart from anywhere)
    k.deco(-16, 0.01, -6, 18, 0.02, 18, '#ffd0db');
    k.deco(14, 0.01, -13, 18, 0.02, 16, '#e2d6ff');
    k.deco(16, 0.01, 10, 12, 0.02, 12, '#cfdfff');
    k.deco(-9, 0.01, 16, 12, 0.02, 11, '#ffe9b0');
    k.deco(6, 0.01, 5, 8, 0.02, 8, '#c9f0e8');

    // ---------- castle (pink): x -24..-8, z -14..2. Walls 1.6 thick, top 4.4; corner towers 8.8 ----------
    const CX0 = -24, CX1 = -8, CZ0 = -14, CZ1 = 2, CT = 3.6, CW = 1.6;
    for (const [x0, z0] of [[CX0, CZ0], [CX1 - CT, CZ0], [CX0, CZ1 - CT], [CX1 - CT, CZ1 - CT]]) solid(x0, x0 + CT, 0, HIGH, z0, z0 + CT, PINK2);
    // north + south walls (between the towers), east + west walls; gates in the middle, crawl holes
    wallX(CX0 + CT, CX1 - CT, CZ0, CZ0 + CW, LOW, [gate(-16)], PINK);
    wallX(CX0 + CT, CX1 - CT, CZ1 - CW, CZ1, LOW, [gate(-16)], PINK);
    wallZ(CZ0 + CT, CZ1 - CT, CX0, CX0 + CW, LOW, [gate(-6), { a: -2.7, b: -1.3, y0: 0, y1: 1.2 }], PINK);
    wallZ(CZ0 + CT, CZ1 - CT, CX1 - CW, CX1, LOW, [gate(-6), { a: -10.3, b: -8.9, y0: 0, y1: 1.2 }], PINK);
    // steps up onto the walls (2.2 each: jump + pull up) and up the towers (from the wall walk)
    solid(-20.5, -18.5, 0, 2.2, 2, 4, PEACH);                  // outside, south wall
    solid(-26.4, -24, 0, 2.2, -9.5, -7.5, PEACH);              // outside, west wall
    solid(-14.5, -12.5, 0, 2.2, -12.4, -10.4, PEACH);          // inside the courtyard, north wall
    solid(-19.5, -17.5, 0, 2.2, -1.6, 0.4, PEACH);             // inside, south wall
    solid(-20.4, -18.8, LOW, 6.6, CZ0, CZ0 + CW, PINK2);       // on the walk, next to the NW tower
    solid(CX1 - CW, CX1, LOW, 6.6, -3.2, CZ1 - CT, PINK2);     // next to the SE tower
    // orange kick wall off the east wall: kick from the floor up onto the walk
    solid(-5.2, -4.7, 0, LOW, -4.4, -1.8, YEL, KICK);
    // courtyard trampoline: throws you onto the NW tower
    k.pad(-17, 0, -7, 1.6, 1.6, 22, { look: 'tramp', color: PINK, push: { x: -3.6, z: -3.6 } });

    // ---------- balloon room (lilac): x 6..22, z -20..-6, walls 1.2 thick up to 8.8 ----------
    const BX0 = 6, BX1 = 22, BZ0 = -20, BZ1 = -6, BW = 1.2;
    const win = (c) => ({ a: c - 1.5, b: c + 1.5, y0: LOW, y1: 8.0 });
    wallZ(BZ0, BZ1, BX0, BX0 + BW, HIGH, [win(-9.5), gate(-17)], LILAC);                    // west: window for the bridge
    wallZ(BZ0, BZ1, BX1 - BW, BX1, HIGH, [win(-9.5), gate(-8)], LILAC);                    // east
    wallX(BX0 + BW, BX1 - BW, BZ1 - BW, BZ1, HIGH, [gate(10), gate(19), win(16)], LILAC); // south: two doors + the tower bridge
    wallX(BX0 + BW, BX1 - BW, BZ0, BZ0 + BW, HIGH, [gate(14)], LILAC);                     // north
    k.balloons((BX0 + BX1) / 2, 0, (BZ0 + BZ1) / 2, BX1 - BX0 - 2 * BW, HIGH, BZ1 - BZ0 - 2 * BW, 75,
      ['#ff8fa3', '#ffd166', '#7ed6c8', '#8fb4ff', '#c3a6ff', '#ffb37a', '#9be3a8', '#ff6b6b', '#a8dcef'], { seed: 5 });
    // a block inside to climb back up to the rope bridge
    solid(9, 11, 0, 2.2, -12.8, -10.8, LILAC2);
    // orange kick wall off the east wall: up to the rim
    solid(24.8, 25.3, 0, HIGH, -18, -12, YEL, KICK);

    // ---------- climb tower (blue): a column with a spiral of blocks around it ----------
    const TX = 16, TZ = 10, R = 2.7, Bk = 2.4, STEP = LOW / 3;
    solid(TX - 1.5, TX + 1.5, 0, 13.2, TZ - 1.5, TZ + 1.5, BLUE2);
    // E 1, NE 2, N 3 (4.4, the bridge from the balloon room), NW 4, W 5, SW 6 (8.8, the bridge from
    // the slide hill), S 7, SE 8 - then the column top at 13.2
    [[1, 0], [1, -1], [0, -1], [-1, -1], [-1, 0], [-1, 1], [0, 1], [1, 1]].forEach(([dx, dz], i) => {
      const x = TX + dx * R, z = TZ + dz * R;
      solid(x - Bk / 2, x + Bk / 2, 0, STEP * (i + 1), z - Bk / 2, z + Bk / 2, i % 2 ? BLUE : SKY);
    });

    // ---------- slide hill (yellow): top 8.8 at x -14..-4, z 11.5..20.5 ----------
    solid(-14, -4, 0, HIGH, 11.5, 20.5, YEL);
    solid(-14, -4, 0, LOW, 9.5, 11.5, YEL2);                   // ledge on its north side (4.4)
    solid(-6, -4, LOW, 6.6, 9.5, 11.5, YEL);                   // step from the ledge to the top
    solid(-10, -8, 0, 2.2, 7.5, 9.5, PEACH);                   // step from the floor onto the ledge
    solid(-17.1, -16.6, 0, HIGH, 13, 19, YEL, KICK);           // orange kick wall off its west face
    // two long slides down to the east, with a narrow alley between them
    k.ramp(3, 14.9, 14, 2.4, 0, HIGH, '-x', MINT, { slick: true });
    k.ramp(3, 19.1, 14, 2.4, 0, HIGH, '-x', GREEN, { slick: true });

    // ---------- play deck (mint) in the middle: 4.4 up on four posts, run under it ----------
    slab(k, 6, LOW, 5, 6, 6, MINT, { t: 0.4 });              // x 3..9, z 2..8
    posts(k, [[3.2, 2.2], [8.8, 2.2], [3.2, 7.8], [8.8, 7.8]], 0, LOW - 0.4, '#3b8f82', 0.4);
    solid(9, 11, 0, 2.2, 4, 6, PEACH);                       // step up onto it
    bridgeZ(-8.6, 2, 4, LOW, 1.6);                           // north to the low bridge (a T junction)
    bridgeX(9, TX - R - Bk / 2, 7.3, LOW, 1.6);              // east to the tower's N block

    // ---------- walkways ----------
    bridgeX(CX1, BX0, -9.5, LOW);               // castle east wall -> balloon room west window
    bridgeX(BX0 + BW, BX1 - BW, -9.5, LOW, 1.6); // rope bridge through the balloon room
    bridgeX(CX1 - CT + 3.6, BX0, -12.9, HIGH, 1.6);   // castle NE tower -> balloon room rim (above the low one)
    bridgeZ(CZ1, 9.5, -13.5, LOW);              // castle south wall -> slide hill ledge
    bridgeZ(CZ1, 11.5, -9.8, HIGH, 1.6);        // castle SE tower -> slide hill top
    bridgeZ(BZ1, TZ - R - Bk / 2, TX, LOW);     // balloon room south wall -> tower block N (4.4)
    bridgeX(-4, TX - R - Bk / 2, TZ + R, HIGH); // slide hill top -> tower block SW (8.8)

    // ---------- the floor: soft blocks, pillars, bars, nets, trampolines ----------
    const soft = (x, z, w, h, d, c) => k.box(x, 0, z, w, h, d, c);
    soft(-1, -3, 1.6, 1.0, 1.6, MINT);
    soft(3, -1, 1.2, 3.0, 1.2, PEACH);
    soft(-4, 2, 1.2, 3.0, 1.2, SKY);
    soft(5, 6, 2, 1.0, 1, PINK2);
    soft(-1, 9, 1.4, 1.4, 1.4, LILAC2);
    soft(10, 0, 1.2, 3.0, 1.2, YEL2);
    soft(-27, 4, 1.6, 1.0, 1.6, MINT);
    soft(-20, 9, 1.2, 3.0, 1.2, LILAC);
    soft(-1, -17, 1.6, 1.0, 3, PEACH);
    soft(-12, -19, 1.2, 3.0, 1.2, SKY);
    soft(24, -3, 1.4, 1.4, 1.4, PINK2);
    soft(13, 21, 1.2, 3.0, 1.2, BLUE);
    soft(22, 16, 1.6, 1.0, 1.6, MINT);
    // slide-under bars between pillars (bottom 1.25)
    for (const [x, z, alongX] of [[12, -3, true], [-16, 21, true], [3, -20, false]]) {
      const L = 4;
      if (alongX) { soft(x - L / 2 - 0.3, z, 0.6, 3.0, 0.6, BLUE2); soft(x + L / 2 + 0.3, z, 0.6, 3.0, 0.6, BLUE2); k.box(x, 1.25, z, L, 0.3, 0.3, '#2b3038'); }
      else { soft(x, z - L / 2 - 0.3, 0.6, 3.0, 0.6, BLUE2); soft(x, z + L / 2 + 0.3, 0.6, 3.0, 0.6, BLUE2); k.box(x, 1.25, z, 0.3, 0.3, L, '#2b3038'); }
    }
    k.net(-6, 0, -9, 6, 3, 0.1, '#3b4250');
    k.net(19, 0, 1, 0.1, 3, 6, '#3b4250');
    // trampoline in the middle: up onto the slide hill
    k.pad(-1, 0, 5, 1.6, 1.6, 22, { look: 'tramp', color: YEL, push: { x: -6, z: 7.5 } });
  },
});
