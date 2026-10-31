// CLOUD SPIRE - race. A square spiral of floating platforms winding three laps up around a
// tall white spire, alone in an empty sky. Every side of every lap is a different obstacle,
// and they get harder as you climb. Fall off and you're back at the start line.
//
// SPINNING PLATFORMS: the yellow turntables, the rotating bridge, the carousel and the propeller
// turn while you stand on them - and they turn your view with them. Re-aim before you jump off.
//
//   lap 1 (0 -> 12)    stepping stones - three plus-shaped turntables - sweeper bridge -
//                      slide gate + kick chimney.  Jump pad up to lap 2
//   lap 2 (16 -> 28)   the rotating bridge (cross when it lines up, or ride it around) -
//                      spinning stairs - spinner stones (or the gappy outside rail) -
//                      tall kick chimney.  Kick up the orange corner to lap 3
//   lap 3 (32 -> 44)   small stones + the carousel - piston alley - the propeller - the great chimney
//   finale             sweeper bridge to the cannon pad, which fires you onto the spire top (52)
//
// Laps sit right on top of each other 16m apart, so you see the racers ahead above you.
// Each side runs between two corner blocks; positions below are in side-local coordinates:
// a = meters along the side from its start corner, v = sideways (+ = outward).
defineMap({
  id: 'climb',
  kind: 'race',
  accent: ['#7ed6c8', '#c3a6ff'],
  name: 'Cloud Spire',
  blurb: 'Three laps up a spiral of floating obstacles in an empty sky. Spinning platforms turn you around. Fall and you start over.',
  env: 'fog',
  sky: '#a9d6ff',
  fog: [150, 420],
  hemi: ['#eef6ff', '#8090a8', 1.9],
  sun: [1.2, 60, 110, 40],
  size: 34,
  killY: -18,
  menuCam: { r: 62, y: 42 },
  spawns: [-26, -23.3, -20.7, -18].flatMap((x) => [18.5, 22, 25.5].map((z) => [x, 0, z])),
  seekerSpawn: [-22, 0, 22],
  race: {
    yaw: -Math.PI / 2,
    finish: { x: 0, y: 52, z: 0, w: 4, h: 3, d: 4 },
    route: [
      [-22, 0, 22], [22, 3, 22], [22, 6, -22], [-22, 9, -22], [-22, 13.5, 8], [-22, 12, 22],
      [-16, 16, 22], [22, 19, 22], [22, 22, -22], [-22, 25, -22], [-22, 31, 0], [-22, 28, 22],
      [-16, 32, 22], [22, 35, 22], [22, 38, -22], [-22, 41, -22], [-22, 47.5, -3], [-22, 47.5, 14], [-22, 44, 22],
      [0, 44, 22], [0, 52, 0],
    ],
  },

  build(k) {
    const R = 22;
    const WHITE = '#f2f4f7', PINK = '#ff8fa3', GOLD = '#ffb37a';
    const LAP = ['#7ed6c8', '#8fb4ff', '#c3a6ff'];
    const KICK = { tex: 'kick' };
    // the four sides of the square, walked counter-clockwise (seen from above)
    const F = [
      { c: [-R, R], u: [1, 0], n: [0, 1] },     // south, heading +x
      { c: [R, R], u: [0, -1], n: [1, 0] },     // east, heading -z
      { c: [R, -R], u: [-1, 0], n: [0, -1] },   // north, heading -x
      { c: [-R, -R], u: [0, 1], n: [-1, 0] },   // west, heading +z
    ];
    const at = (s, a, v) => [F[s].c[0] + F[s].u[0] * a + F[s].n[0] * v, F[s].c[1] + F[s].u[1] * a + F[s].n[1] * v];
    const ax = (s) => F[s].u[0] !== 0;
    // block from a0 to a1 along side s, `wid` wide centered on v, top at `top`, `t` thick
    const span = (s, a0, a1, v, wid, top, t, col, o) => {
      const [x, z] = at(s, (a0 + a1) / 2, v), L = a1 - a0;
      k.box(x, top - t, z, ax(s) ? L : wid, t, ax(s) ? wid : L, col, o);
    };
    // moving block centered at (a, v), bottom y. Slides are given along/sideways (da, dv, dy)
    const mov = (s, a, v, len, wid, y, h, col, mo) => {
      const [x, z] = at(s, a, v), m = Object.assign({}, mo);
      if (mo.type === 'slide') {
        m.dx = F[s].u[0] * (mo.da || 0) + F[s].n[0] * (mo.dv || 0);
        m.dz = F[s].u[1] * (mo.da || 0) + F[s].n[1] * (mo.dv || 0);
      }
      k.mover(x, y, z, ax(s) ? len : wid, h, ax(s) ? wid : len, col, m);
    };
    const spinner = (s, a, top, len, speed, phase = 0) => mov(s, a, 0, 0.45, len, top, 0.6, PINK, { type: 'spin', speed, phase });
    // a whole platform that spins (top at `top`): a plain square, a plus, or an octagon (two
    // squares turned 45 degrees apart). Standing on it turns you - and your view - with it.
    const SPIN = '#ffd166';
    const turntable = (s, a, top, shape, size, speed, phase = 0, wid = 2.4) => {
      const [x, z] = at(s, a, 0), t = 0.6;
      if (shape === 'plus') {
        k.mover(x, top - t, z, size, t, wid, SPIN, { type: 'spin', speed, phase });
        k.mover(x, top - t, z, size, t, wid, SPIN, { type: 'spin', speed, phase: phase + Math.PI / 2 });
      } else {
        k.mover(x, top - t, z, size, t, size, SPIN, { type: 'spin', speed, phase });
        if (shape === 'oct') k.mover(x, top - t, z, size, t, size, SPIN, { type: 'spin', speed, phase: phase + Math.PI / 4 });
      }
      k.deco(x, top - t - 2.4, z, 0.5, 2.4 - 0.05, 0.5, '#59606e', { tex: 'none' });   // the axle under it
    };
    // a long bar that spins flat - a bridge when it lines up with the side, a ride when it doesn't
    const bar = (s, a, top, len, wid, speed, col = SPIN) => {
      const [x, z] = at(s, a, 0);
      k.mover(x, top - 0.6, z, len, 0.6, wid, col, { type: 'spin', speed, phase: ax(s) ? 0 : Math.PI / 2 });
      k.deco(x, top - 3, z, 0.6, 2.35, 0.6, '#59606e', { tex: 'none' });
    };
    // corner block (6x6, 3 thick) at the START corner of side s
    const corner = (s, top, col = WHITE) => span(s, -3, 3, 0, 6, top, 3, col);

    // --- the spire, with a colored band at each lap ---
    k.box(0, -34, 0, 10, 86, 10, WHITE);
    LAP.forEach((c, i) => k.deco(0, 16 * i + 6, 0, 10.3, 1.2, 10.3, c, { tex: 'none' }));
    k.deco(0, 49, 0, 10.3, 1.2, 10.3, GOLD, { tex: 'none' });
    // clouds
    for (const [x, y, z, w, d] of [[-48, 6, -30, 14, 8], [44, 14, 30, 18, 9], [52, 30, -40, 12, 10], [-46, 38, 36, 16, 8],
                                   [10, -10, 52, 20, 10], [-20, 58, -52, 16, 9], [36, 50, 46, 12, 7]]) {
      k.deco(x, y, z, w, 1.6, d, '#ffffff', { tex: 'none', noShadow: true });
      k.deco(x + 2, y + 1.6, z - 1, w * 0.55, 1.4, d * 0.6, '#ffffff', { tex: 'none', noShadow: true });
    }

    // ================= LAP 1 (mint) =================
    const C1 = LAP[0];
    k.box(-R, -3, R, 12, 3, 12, WHITE);                                   // start platform (top 0)
    k.deco(-R + 6.02, -0.4, R, 0.06, 0.4, 12, GOLD, { tex: 'none' });     // start line strip
    // south: stepping stones 0 -> 3
    for (let i = 0; i < 7; i++) span(0, 8.1 + i * 4.7, 10.7 + i * 4.7, [0, 0.8, -0.8][i % 3], 2.6, 3 * (i + 1) / 8, 1, C1);
    corner(1, 3);
    // east: three plus-shaped turntables, each spinning a little faster, alternating direction
    span(1, 3, 9, 0, 3, 3, 1, C1);
    turntable(1, 14, 3, 'plus', 7, 0.5);
    turntable(1, 22, 3, 'plus', 7, -0.6, 0.4);
    turntable(1, 30, 3, 'plus', 7, 0.7, 0.9);
    span(1, 35, 41, 0, 3, 3, 1, C1);
    corner(2, 6);
    // north: sweeper bridge, then steps up to 9
    span(2, 3, 33, 0, 3, 6, 1, C1);
    spinner(2, 12, 6, 6.5, 1.5);
    spinner(2, 24, 6, 6.5, -1.9, 0.8);
    span(2, 33, 37, 0, 3, 7.2, 2.2, C1);
    span(2, 37, 41, 0, 3, 8.4, 3.4, C1);
    corner(3, 9);
    // west: slide gate, kick chimney up to a 13.5 ledge, drop to the corner at 12
    span(3, 3, 30, 0, 3, 9, 1, C1);
    span(3, 9.5, 10.5, 0, 3, 13, 2.95, PINK);                             // gate: bottom at 10.05 - slide under
    span(3, 22, 30, 1.65, 0.5, 14.5, 5.5, C1, KICK);
    span(3, 22, 30, -1.65, 0.5, 14.5, 5.5, C1, KICK);
    span(3, 30, 38, 0, 3, 13.5, 4.5, C1);
    corner(0, 12);                                                        // lap 1 ends above the start
    k.pad(-21.5, 12, R, 1.4, 1.4, 16, {});          // up to lap 2

    // ================= LAP 2 (blue) =================
    const C2 = LAP[1];
    span(0, 3, 9, 0, 6, 16, 2, C2);                                       // lap 2 start (top 16)
    // south: the rotating bridge. When it lines up you can sprint straight across; otherwise hop
    // on as its end swings past and ride it round to the far ledge
    bar(0, 18, 16.5, 14, 2.6, 0.55);
    span(0, 27, 34, 0, 3, 17, 1, C2);
    span(0, 34, 37.5, 0, 3, 18, 2, C2);
    span(0, 37.5, 41, 0, 3, 18.8, 2.8, C2);
    corner(1, 19);
    // east: spinning stairs - four square turntables climbing to 22, alternating direction
    span(1, 3, 8, 0, 3, 19, 1, C2);
    [[12, 19.6, 0.7], [19, 20.2, -0.8], [26, 20.8, 0.9], [33, 21.4, -1.0]].forEach(([a, top, sp], i) => turntable(1, a, top, 'square', 4.5, sp, i));
    span(1, 37, 41, 0, 3, 22, 1, C2);
    corner(2, 22);
    // north: spinner stones 22 -> 25, or the gappy rail along the outside
    for (let i = 0; i < 7; i++) {
      const a = 5.6 + i * 5.2, top = 22.4 + i * 0.4;
      span(2, a - 1.5, a + 1.5, 0, 3, top, 1, C2);
      if (i % 2) spinner(2, a, top, 4, [2.2, -2.6, 3.0][(i - 1) / 2], i * 0.7);
      span(2, a - 1.6, a + 1.6, 2.7, 0.6, top, 0.5, GOLD);                // rail piece
    }
    corner(3, 25);
    // west: tall kick chimney up to a 31 ledge, then down to the corner at 28
    span(3, 3, 12, 0, 3, 25, 1, C2);
    span(3, 12, 18, 1.65, 0.5, 31.5, 6.5, C2, KICK);
    span(3, 12, 18, -1.65, 0.5, 31.5, 6.5, C2, KICK);
    span(3, 18, 27, 0, 3, 31, 6, C2);
    span(3, 28.5, 37.5, 0, 3, 29.5, 1, C2);
    corner(0, 28);
    // up to lap 3: kick between the orange wall and the orange end of the lap 3 start
    k.box(-23.65, 28, R, 0.5, 6, 6, C2, KICK);

    // ================= LAP 3 (lilac) =================
    const C3 = LAP[2];
    k.box(-19.8, 28, R, 1.6, 4, 6, C3, KICK);                             // its kickable end (x -20.6..-19)
    span(0, 3, 9, 0, 6, 32, 2, C3);                                       // lap 3 start (top 32)
    // south: small stones, then the carousel - a big fast octagon. Land, turn back around, jump off
    [32.5, 33, 33.5].forEach((top, i) => span(0, 10.2 + i * 4.4, 12.2 + i * 4.4, 0, 2, top, 1, C3));
    turntable(0, 27, 33.5, 'oct', 7.4, 1.0);
    span(0, 32.5, 41, 0, 3, 34, 1, C3);
    corner(1, 35);
    // east: piston alley - blocks sweep across a 2m bridge, then steps to 38
    span(1, 3, 36, 0, 2, 35, 1, C3);
    [10, 17, 24, 31].forEach((a, i) => {
      mov(1, a, -5, 2, 2, 35, 1.6, GOLD, { type: 'slide', dv: 10, period: 3.6, phase: i * 0.25 });
      span(1, a - 1.2, a + 1.2, -6.4, 0.8, 37.5, 4, WHITE);              // piston housings
      span(1, a - 1.2, a + 1.2, 6.4, 0.8, 37.5, 4, WHITE);
    });
    span(1, 36, 38.5, 0, 3, 36.2, 2.2, C3);
    span(1, 38.5, 41, 0, 3, 37.4, 3.4, C3);
    corner(2, 38);
    // north: the propeller - a fast spinning bar across the gap. Time the jump on and off
    span(2, 3, 14, 0, 3, 38, 1, C3);
    bar(2, 21, 38, 12, 3, 0.65, GOLD);
    span(2, 28.5, 34, 0, 3, 38.4, 1, C3);
    span(2, 34, 37.5, 0, 3, 39.4, 2, C3);
    span(2, 37.5, 41, 0, 3, 40.2, 2.8, C3);
    corner(3, 41);
    // west: the great chimney up to 47.5, a balance beam, drop to the corner at 44
    span(3, 3, 10, 0, 3, 41, 1, C3);
    span(3, 10, 16, 1.65, 0.5, 48.5, 7.5, C3, KICK);
    span(3, 10, 16, -1.65, 0.5, 48.5, 7.5, C3, KICK);
    span(3, 16, 22, 0, 3, 47.5, 6.5, C3);
    span(3, 22, 36, 0, 1, 47.5, 1, C3);
    span(3, 36, 38, 0, 3, 46, 1, C3);
    corner(0, 44, GOLD);

    // ================= FINALE =================
    k.box(-11, 43, R, 16, 1, 3, GOLD);                                    // sweeper bridge x -19..-3
    mov(0, 8, 0, 0.45, 6, 44, 0.6, PINK, { type: 'spin', speed: 2.5 });
    mov(0, 14, 0, 0.45, 6, 44, 0.6, PINK, { type: 'spin', speed: -3, phase: 1 });
    k.box(0, 43, R, 6, 1, 6, GOLD);                                       // cannon platform
    k.pad(0, 44, 20.5, 1.6, 1.6, 22, { color: '#ff6bd6' });
    // parapet around the far sides of the spire top, so the cannon can't fling you off
    k.box(0, 52, -5.4, 10.8, 1, 0.8, GOLD);
    k.box(-5.4, 52, 0.4, 0.8, 1, 9.2, GOLD);
    k.box(5.4, 52, 0.4, 0.8, 1, 9.2, GOLD);
  },
});
