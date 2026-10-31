// THE VOLCANO - race. A blocky volcano rising out of a sea of lava. Climb three laps around it
// (counter-clockwise, seen from above) to the crater at the top. Touch the lava and you're back
// on the beach - there are no checkpoints.
//
//   lap 1 (0 -> 10)    stepping stones over the lava (two of them bob up and down) - mantle up a
//                      ledge - orange kick chimney up the east cliff
//   lap 2 (10 -> 20)   on the mountain's shoulder: a rope bridge over a chasm - a lava tube you
//                      have to slide through - rising basalt columns - a geyser that blasts you
//                      up to the next shoulder
//   lap 3 (20 -> 31)   two rotating rock platforms (they turn you with them) - a ferry rock
//                      across the north chasm - the final kick chimney up to the crater rim
//   finish             drop into the crater
//
// The mountain is built in rings: an inner core (+-5, up to the crater at 30), the lap 3
// shoulder (+-5..9, top 20) and the lap 2 shoulder (+-9..13, top 10). Gaps in the shoulders are
// chasms straight down to the lava. Lap 1 runs on ledges outside, +-13..19. Each shoulder has an
// overhanging lip, so the only ways up are the chimneys and the geyser.
defineMap({
  id: 'volcano',
  kind: 'race',
  accent: ['#ff5a1f', '#3a3536'],
  name: 'The Volcano',
  blurb: 'Climb a volcano out of a lava sea: bobbing stones, chimneys, a lava tube, spinning rocks, a geyser. Touch lava, start over.',
  env: 'fog',
  sky: '#2a0f0b',
  fog: [50, 160],
  hemi: ['#ffc9a8', '#5a2414', 1.1],
  sun: [0.8, 30, 60, 20],
  size: 30,
  killY: -1.3,
  menuCam: { r: 46, y: 30 },
  spawns: [-25.5, -23, -20.5, -18].flatMap((x) => [16, 19, 22].map((z) => [x, 0, z])),
  seekerSpawn: [-21.5, 0, 19],
  race: {
    yaw: -Math.PI / 2,
    finish: { x: 0, y: 30, z: 0, w: 4, h: 3, d: 4 },
    route: [
      [-21, 0, 15], [-11.5, 0.4, 15], [10.7, 2.8, 15], [16, 3, 15], [15, 5, 8.5], [14.8, 5, 3],
      [14.8, 10, 2], [15, 10, -3], [11, 10, -11], [1, 10, -11], [-5, 10, -11], [-11, 10, -11],
      [-11, 10, -6], [-11, 10, 2], [-11, 10, 11], [-8, 10, 11], [-1, 10, 11], [6, 10, 11],
      [6, 20, 7], [7.5, 20, 7], [7.5, 20, 2.5], [7.5, 20, -2.5], [7.5, 20, -7], [3.5, 20, -7],
      [-6.5, 20, -7], [-7, 20, -3], [-7, 31, -3], [0, 30, 0],
    ],
  },

  build(k) {
    const ROCK = '#3b3332', DARK = '#2c2627', ASH = '#4d4441', BASALT = '#232226', SAND = '#2a2324';
    const LAVA = '#c9300a', GLOW = { emissive: '#e84a0c' }, KICK = { tex: 'kick' };
    // a block given by its x/z range and y range
    const blk = (x0, x1, z0, z1, y0, y1, col, o) => k.box((x0 + x1) / 2, y0, (z0 + z1) / 2, x1 - x0, y1 - y0, z1 - z0, col, o);

    // --- the lava sea, glowing, with dark crust floating on it ---
    k.deco(0, -1.4, 0, 300, 0.4, 300, LAVA, GLOW);
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 46; i++) {
      const a = rnd() * Math.PI * 2, r = 24 + rnd() * 60, w = 2 + rnd() * 6, d = 1.5 + rnd() * 5;
      k.deco(Math.cos(a) * r, -1.02 + i * 0.0005, Math.sin(a) * r, w, 0.06, d, '#3a1a12', { tex: 'none' });
    }

    // --- the mountain ---
    blk(-5, 5, -5, 5, -6, 30, DARK);                         // core, up to the crater
    // lap 3 shoulder (top 20), with chasms where the spinners and the ferry are
    blk(3, 9, 5, 9, -6, 20, ROCK);                           // S: geyser landing
    blk(5, 9, -9, -5, -6, 20, ROCK);                         // NE corner (after the spinners)
    blk(-9, -4, -9, -5, -6, 20, ROCK);                       // NW corner (after the ferry)
    blk(-9, -5, -5, -1, -6, 20, ROCK);                       // W: foot of the final chimney
    // lap 2 shoulder (top 10)
    blk(9, 13, -13, -1, -6, 10, ASH);                        // E (where lap 1's chimney comes out)
    blk(1, 9, -13, -9, -6, 10, ASH);                         // N, east of the rope bridge
    blk(-13, -5, -13, -9, -6, 10, ASH);                      // N, west of the bridge
    blk(-13, -9, -9, 13, -6, 10, ASH);                       // W, under the lava tube, round to the SW corner
    blk(-9, -8, 9, 13, -6, 10, ASH);                         // S, edge before the basalt columns
    blk(-1, 13, 9, 13, -6, 10, ASH);                         // S, geyser ledge, round to the SE corner
    // Overhanging lips along the top edge of every shoulder (1.5m out): you can't wall-kick from
    // one lap straight up onto the next - only up the orange chimneys and the geyser.
    const lip = (x0, x1, z0, z1, top, col) => blk(x0, x1, z0, z1, top - 0.8, top, col);
    for (const [x0, x1, z0, z1] of [[13, 14.5, -14.5, -6], [1, 13, -14.5, -13], [-14.5, -5, -14.5, -13], [-14.5, -13, -13, 14.5],
      [-13, -8, 13, 14.5], [-1, 14.5, 13, 14.5], [13, 14.5, 9, 13]]) lip(x0, x1, z0, z1, 10, ASH);
    for (const [x0, x1, z0, z1] of [[3, 10.5, 9, 10.5], [9, 10.5, 5, 9], [9, 10.5, -10.5, -5], [5, 9, -10.5, -9], [-9, -4, -10.5, -9],
      [-10.5, -9, -10.5, -1]]) lip(x0, x1, z0, z1, 20, ROCK);
    for (const [x0, x1, z0, z1] of [[5, 6.5, -6.5, 6.5], [-6.5, 5, 5, 6.5], [-6.5, 5, -6.5, -5], [-6.5, -5, -1, 5]]) lip(x0, x1, z0, z1, 30, DARK);

    // --- the beach (start) ---
    blk(-27, -15, 13, 25, -6, 0, SAND);
    for (const [x, z, s, h] of [[-26, 24, 1.2, 0.6], [-16, 24.2, 0.9, 0.4], [-26.3, 13.6, 0.8, 0.5]]) k.box(x, 0, z, s, h, s, BASALT);

    // ===== LAP 1 =====
    // stepping stones east along the south cliff, gently rising; two of them bob up and down
    const SX = [-11.5, -7.8, -4.1, -0.4, 3.3, 7, 10.7];
    SX.forEach((x, i) => {
      const top = 0.4 + i * 0.4;
      if (i === 2 || i === 4) k.mover(x, top - 6, 15, 2.2, 6, 2.2, BASALT, { type: 'slide', dy: 1.0, period: 3.2, phase: i * 0.21 });
      else k.box(x, -6, 15, 2.2, top + 6, 2.2, BASALT);
    });
    blk(13, 19, 13, 19, -6, 3, ROCK);                        // SE corner rock
    blk(13, 17, 0, 11, -6, 5, ROCK);                         // ledge: jump + pull up (2m)
    // kick chimney up the east cliff: two orange walls 2.8 apart, out onto the shoulder at 10
    blk(13, 13.4, 0, 5, 5, 11.5, '#ff6a3d', KICK);
    blk(16.2, 16.7, 0, 5, 5, 11.5, '#ff6a3d', KICK);
    blk(13, 17, -6, 0, -6, 10, ROCK);                        // top of the chimney

    // ===== LAP 2 =====
    // rope bridge over the north chasm
    k.box(-2, 9.75, -11, 6, 0.25, 0.9, '#8a6a48');
    for (const x of [-5, 1]) for (const z of [-11.6, -10.4]) k.deco(x, 10, z, 0.18, 1.2, 0.18, '#6b5443', { tex: 'none' });
    for (const z of [-11.6, -10.4]) k.deco(-2, 11.05, z, 6, 0.06, 0.06, '#c9a36b', { tex: 'none' });
    // lava tube: a rock overhang on the west shoulder, 1.2m clear - slide or crouch through
    blk(-13, -9, -6, 2, 11.2, 13.5, BASALT);
    k.deco(-11, 11.15, -6.02, 4, 0.05, 0.03, LAVA, GLOW);    // glowing lip at each mouth
    k.deco(-11, 11.15, 2.02, 4, 0.05, 0.03, LAVA, GLOW);
    // basalt columns rising and falling across the south chasm
    k.mover(-6, -3, 11, 2, 12, 2, BASALT, { type: 'slide', dy: 2, period: 3.4, phase: 0 });
    k.mover(-3, -3, 11, 2, 12, 2, BASALT, { type: 'slide', dy: 2, period: 3.4, phase: 0.5 });
    // geyser: blasts you up onto the lap 3 shoulder
    k.pad(6, 10, 12, 1.6, 1.6, 30, { color: '#ff8a3d' });

    // ===== LAP 3 =====
    // two rotating rock platforms across the east chasm (they turn you as they spin)
    k.mover(7.5, 19, 2.5, 3.2, 1, 3.2, BASALT, { type: 'spin', speed: 0.7, phase: 0 });
    k.mover(7.5, 19, -2.5, 3.2, 1, 3.2, BASALT, { type: 'spin', speed: -0.7, phase: 0.6 });
    // ferry rock across the north chasm
    k.mover(3.5, 19, -7, 2.6, 1, 2.6, ASH, { type: 'slide', dx: -6, period: 6, phase: 0 });
    // final kick chimney: orange wall on the core + one 2.8 out, up to the crater rim (31.2)
    blk(-5.4, -5, -4.5, -1, 20, 31.2, '#ff6a3d', KICK);
    blk(-8.6, -8.2, -4.5, -1, 20, 30, '#ff6a3d', KICK);

    // ===== the crater =====
    blk(-5, 5, -5, -3.8, 30, 31.2, ROCK);
    blk(-5, 5, 3.8, 5, 30, 31.2, ROCK);
    blk(-5, -3.8, -3.8, 3.8, 30, 31.2, ROCK);
    blk(3.8, 5, -3.8, 3.8, 30, 31.2, ROCK);
    for (const [x, z] of [[-2.6, -2.6], [2.6, 2.6], [2.6, -2.6], [-2.6, 2.6]]) k.deco(x, 30, z, 0.7, 0.04, 0.7, LAVA, GLOW);

    // --- looks: glowing cracks in the rock, lava falls down the chasms, smoke vents ---
    for (const [x, y, z, w, h, d] of [
      [0, 2, 13.03, 6, 0.12, 0.04], [-9, 5, 13.03, 0.12, 3, 0.04], [19.03, 1, 16, 0.04, 0.12, 4],
      [13.03, 7, -9, 0.04, 0.12, 5], [-13.03, 4, 5, 0.04, 2.5, 0.12], [-13.03, 7, -3, 0.04, 0.12, 6],
      [9.03, 15, 7, 0.04, 0.12, 3], [-9.03, 14, -7, 0.04, 2, 0.12], [0, 25, 5.03, 3, 0.12, 0.04], [5.03, 24, 0, 0.04, 0.12, 4],
    ]) k.deco(x, y, z, w, h, d, LAVA, GLOW);
    // lava falls: glowing sheets down the inner faces of the chasms
    k.deco(5.04, -1, 1.5, 0.06, 20, 4, LAVA, GLOW);           // east chasm
    k.deco(0.5, -1, -5.04, 3, 20, 0.06, LAVA, GLOW);          // north chasm
    k.deco(-3, -1, 5.04, 3, 20, 0.06, LAVA, GLOW);            // south chasm
    // scattered lava rocks on the sea
    for (const [x, z, s, h] of [[-34, -8, 3, 1.4], [30, 28, 4, 2], [32, -26, 2.6, 1.2], [-30, -30, 3.4, 1.8], [8, 34, 2.8, 1.1], [-8, -36, 3, 1.5]]) {
      k.box(x, -2, z, s, h + 2, s, BASALT);
    }
  },
});
