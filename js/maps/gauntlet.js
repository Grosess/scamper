// THE GAUNTLET - race. A course that winds out, down, up and back over itself across a hazy
// violet void. Each stretch is its own room of obstacles. Fall off and you start over.
//
//   spinner plaza     four ankle-high sweeper bars on an open plaza - hop and weave
//   the plunge        a steep ramp down into a low tunnel (slide through it)
//   kick tower        orange chimney up, two mantles, a second chimney - and turn around on top
//   the high road     back over the plaza 10m up: crossing ferries, slide gates, a bar-swept beam
//   the descent       stepping stones down the far side
//   the lifts         two lifts up to the beam maze (or kick 14m straight up the orange shaft)
//   beam maze         narrow beams and spinner junctions 18m up
//   the leaps         three 5m+ gaps
//   the summit        mantle, then a last orange chimney up to the goal
defineMap({
  id: 'gauntlet',
  kind: 'race',
  accent: ['#c3a6ff', '#ff8fa3'],
  name: 'The Gauntlet',
  blurb: 'A winding obstacle course over a violet void - down a tunnel, up a kick tower, back over itself. Fall and you start over.',
  env: 'fog',
  sky: '#c4b1e3',
  fog: [70, 210],
  hemi: ['#ffffff', '#6d5f8f', 2.0],
  sun: [1.7, 25, 60, 15],
  size: 44,
  killY: -16,
  menuCam: { r: 58, y: 34 },
  spawns: [-4.5, -1.5, 1.5, 4.5].flatMap((x) => [37.5, 40.5, 43.5].map((z) => [x, 0, z])),
  seekerSpawn: [0, 0, 40],
  race: {
    yaw: 0,
    finish: { x: 7, y: 26, z: -37, w: 4, h: 3, d: 4 },
    route: [
      [0, 0, 40], [0, 0, 13], [0, -6, 5], [0, -6, -14], [0, 0, -20], [0, 2.6, -26], [0, 5.2, -31], [0, 10, -25],
      [0, 10, -16], [0, 10, 30], [0, 10, 33], [-24, 4, 33], [-24, 11, 24.5], [-24, 18, 15.5],
      [-24, 18, 0.5], [-22, 18.6, -5.5], [-21.5, 18.6, -11.5], [-23, 19.2, -17], [-24, 19.2, -23],
      [-13.5, 18.4, -23], [-4, 17.6, -23], [7, 16.8, -23], [7, 19.4, -30], [7, 26, -37],
    ],
  },

  build(k) {
    const MINT = '#5fc7b6', BLUE = '#7aa2f0', LILAC = '#ad8cf0', PINK = '#ff7a93', YEL = '#ffcb4d';
    const PEACH = '#ffa265', SKY = '#8fcde6', WHITE = '#f2f4f7', GOLD = '#f2b630', SLATE = '#8d96b8';
    const KICK = { tex: 'kick' };
    // solid block by its extents (x0..x1, z0..z1), top at `top`, `t` thick
    const blk = (x0, x1, z0, z1, top, t, col, o) => k.box((x0 + x1) / 2, top - t, (z0 + z1) / 2, x1 - x0, t, z1 - z0, col, o);
    const spin = (x, z, y, len, speed, phase = 0, col = PINK) => k.mover(x, y, z, 0.45, 0.55, len, col, { type: 'spin', speed, phase });

    // --- start island + walkway ---
    blk(-7, 7, 34, 46, 0, 2, WHITE);
    k.deco(0, -0.3, 34.03, 14, 0.3, 0.06, GOLD, { tex: 'none' });
    blk(-1.5, 1.5, 27, 34, 0, 1, MINT);

    // --- spinner plaza: four sweepers in a 2x2 grid ---
    blk(-7, 7, 13, 27, 0, 1, MINT);
    // each bar reaches to 0.3m from the center line, so there's no safe lane - you hop them
    for (const [x, z, sp] of [[-3.5, 23.5, 1.8], [3.5, 23.5, -2.2], [-3.5, 16.5, -1.6], [3.5, 16.5, 2.0]]) spin(x, z, 0, 6.4, sp, x + z);
    k.box(0, 0, 20, 1.2, 0.9, 1.2, WHITE);                                // center block (vault it)

    // --- the plunge: steep ramp down, low tunnel ---
    k.ramp(0, 9, 3, 8, -6, 0, '+z', SLATE, { base: -7 });
    blk(-2.5, 2.5, -12, 5, -6, 1, SLATE);
    blk(-2.5, 2.5, -10, 3, -3.6, 1.2, BLUE);                              // tunnel roof: 1.2m clearance
    blk(-2.5, -1.5, -10, 3, -4.8, 1.2, BLUE);
    blk(1.5, 2.5, -10, 3, -4.8, 1.2, BLUE);

    // --- kick tower ---
    blk(-4, 4, -16, -12, -6, 1, LILAC);                                   // base
    blk(-1.9, -1.4, -16, -12, 0.5, 6.5, LILAC, KICK);                     // chimney 1 (-6 -> 0)
    blk(1.4, 1.9, -16, -12, 0.5, 6.5, LILAC, KICK);
    blk(-2, 2, -24, -16, 0, 6, LILAC);                                    // L1 (top 0)
    blk(-2, 2, -27, -24, 2.6, 3.6, LILAC);                                // mantle steps
    blk(-2, 2, -34, -27, 5.2, 3, LILAC);
    blk(-1.9, -1.4, -34, -28, 10.5, 5.3, LILAC, KICK);                    // chimney 2 (5.2 -> 10), exit back south
    blk(1.4, 1.9, -34, -28, 10.5, 5.3, LILAC, KICK);
    blk(-3, 3, -28, -18, 10, 1, YEL);                                     // tower top (10)

    // --- the high road back over the plaza ---
    k.mover(-5, 9.4, -16, 3, 0.6, 3, PEACH, { type: 'slide', dx: 10, period: 4 });
    k.mover(-5, 9.4, -11.5, 3, 0.6, 3, PEACH, { type: 'slide', dx: 10, period: 4, phase: 0.5 });
    blk(-1.5, 1.5, -9.5, 6, 10, 1, YEL);
    blk(-1.5, 1.5, -4.3, -3.7, 13, 1.95, PINK);                           // slide gates (bottom 11.05)
    blk(-1.5, 1.5, 1.2, 1.8, 13, 1.95, PINK);
    blk(-0.5, 0.5, 6, 30, 10, 0.6, YEL);                                  // the beam, 10m over the plaza
    spin(0, 14, 10, 4, 1.6);
    spin(0, 22, 10, 4, -2.0, 1);
    blk(-3, 3, 30, 36, 10, 1, YEL);

    // --- the descent: stepping stones west ---
    [[-7, -4.5, 9], [-11.5, -9, 7.8], [-16, -13.5, 6.6], [-20.5, -18, 5.4]].forEach(([x0, x1, top]) => blk(x0, x1, 31.75, 34.25, top, 1, PEACH));
    blk(-27, -21, 30, 36, 4, 1, PEACH);                                   // landing (4)

    // --- the lifts (or the shortcut shaft) ---
    k.mover(-24, 3.4, 28.5, 3, 0.6, 3, YEL, { type: 'slide', dy: 7, period: 7 });
    blk(-25.5, -22.5, 22.5, 26.5, 11, 1, SKY);
    k.mover(-24, 10.4, 20.5, 3, 0.6, 3, YEL, { type: 'slide', dy: 7, period: 7, phase: 0.5 });
    blk(-27.6, -21, 12.5, 18.5, 18, 14, SKY);                             // beam-maze start tower (18)
    blk(-28.1, -27.6, 12.5, 18.5, 18, 14, SKY, KICK);                     // its orange west face
    blk(-31.4, -30.9, 12.5, 18.5, 19, 15, SKY, KICK);                     // shortcut shaft wall
    blk(-30.9, -28.1, 12.5, 18.5, 4, 1, PEACH);                           // shaft floor
    blk(-30.9, -27, 18.5, 33, 4, 1, PEACH);                               // walkway from the landing

    // --- beam maze, 18m up ---
    blk(-24.6, -23.4, 3.5, 12.5, 18, 0.6, SKY);
    blk(-25.5, -22.5, -1, 2, 18, 1, BLUE);
    spin(-24, 0.5, 18, 2.6, 2.2);
    blk(-22.6, -21.4, -9, -2.5, 18.6, 0.6, SKY);
    blk(-23, -20, -13, -10, 18.6, 1, BLUE);
    spin(-21.5, -11.5, 18.6, 2.6, -2.6, 0.5);
    blk(-23.6, -22.4, -19.5, -14, 19.2, 0.6, SKY);
    blk(-27, -21, -26, -20, 19.2, 1, BLUE);

    // --- the leaps (east) ---
    blk(-15.5, -11.5, -25, -21, 18.4, 1, PEACH);
    blk(-6, -2, -25, -21, 17.6, 1, PEACH);
    blk(3, 11, -27, -19, 16.8, 1, GOLD);

    // --- the summit: mantle, chimney, goal ---
    blk(3, 11, -34, -27, 19.4, 3.6, GOLD);
    blk(4.9, 5.6, -34, -30, 26.5, 7.1, GOLD, KICK);
    blk(8.4, 9.1, -34, -30, 26.5, 7.1, GOLD, KICK);
    blk(3, 11, -40, -34, 26, 3, GOLD);
    k.box(7, 26, -39.7, 8, 1, 0.6, WHITE);                                // backstop behind the goal

    // haze pillars far out, for depth
    for (const [x, z, h, c] of [[-70, -40, 40, LILAC], [66, -52, 55, PINK], [72, 28, 35, SKY], [-66, 52, 50, BLUE], [14, 80, 30, MINT], [-14, -84, 45, PEACH]]) {
      k.box(x, -30, z, 4, h, 4, c, { noShadow: true });
    }
  },
});
