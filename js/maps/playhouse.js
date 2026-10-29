// THE PLAYHOUSE - a soft-play hall: a 3x3 grid of big padded play towers in four bold colors, with
// 3m alleys between them. Every alley is a kick chimney; the orange panels mark the good ones.
//   towers        hollow 10x10 rooms, 4.4 / 8.8 / 13.2 tall, a floor every 4.4. Doors on most sides
//                 of every level, so the ground is a maze of rooms and alleys, and the upper doors
//                 face each other across the alleys - jump door to door.
//                 Inside, a step block under a hole in each floor: hop, pull up, keep climbing.
//   balloon room  the middle cell, two floors tall and open on top, full of balloons that dodge
//                 you. A rope bridge crosses it at 4.4 between two windows.
//   alleys        vault walls, slide bars, and slide-under plugs that break the outer loop
//   trampolines   at two alley crossings: up onto the blue roof (8.8) and the blue lookout (13.2)
// Ceilings are 4.0 over every floor and 3.8 over the 13.2 lookouts - no head bumping.
defineMap({
  id: 'playhouse',
  accent: ['#e5484d', '#2f6fdb'],
  name: 'The Playhouse',
  blurb: 'A soft-play hall of big colored towers and kick alleys, with a room full of balloons in the middle.',
  env: 'indoor',
  sky: '#141824',
  fog: [45, 110],
  hemi: ['#ffffff', '#c4cbe0', 1.5],
  sun: [0.5, 4, 60, 6],
  size: 24,
  spotHeight: 16.7,
  spots: [-13, 0, 13].flatMap((x) => [-13, 0, 13].map((z) => ({ x, z }))),
  menuCam: { path: [[-19.5, 11, -6.5], [19.5, 11, -6.5]] },
  spawns: [
    [-19.5, 0, -19.5], [19.5, 0, 19.5], [-19.5, 0, 0], [19.5, 0, 0], [10, 0, -19.5], [-10, 0, 19.5],
    [3, 0, -6.5], [2, 0, 6.5], [-13, 0, -13], [13, 0, 13], [-13, 0, 0], [13, 0, 0],
    [0, 4.4, -13], [-13, 4.4, 0], [13, 4.4, 13], [0, 8.8, 13],
  ],
  seekerSpawn: [-6.5, 0, -6.5],

  build(k) {
    const LV = 4.4, TOP = 17, T = 10, A = 3, C = [-13, 0, 13], t = 0.6, half = T / 2;
    const RED = '#e5484d', BLUE = '#2f6fdb', YEL = '#f5c331', GREEN = '#2fb36b', CREAM = '#f2efe8', DARK = '#2b3038';
    const KICK = { tex: 'kick' };
    const solid = (x0, x1, y0, y1, z0, z1, c, o) => k.box((x0 + x1) / 2, y0, (z0 + z1) / 2, x1 - x0, y1 - y0, z1 - z0, c, o);
    // a straight wall from A to B with rectangular holes {a, b, y0, y1}
    const PH_segs = (a0, b0, h, holes, put) => {
      const cuts = [a0, b0, ...holes.flatMap((o) => [o.a, o.b])].filter((v) => v >= a0 && v <= b0).sort((p, q) => p - q);
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
    const door = (c, lvl) => ({ a: c - 1.5, b: c + 1.5, y0: lvl * LV, y1: lvl * LV + 3.6 });
    const crawl = (c) => ({ a: c - 1, b: c + 1, y0: 0, y1: 1.2 });
    const win = (c, lvl) => ({ a: c - 1.5, b: c + 1.5, y0: lvl * LV, y1: lvl * LV + 3.6 });

    ground(k, 42, 42, '#d6dbe2');
    enclose(k, 42, 42, TOP, '#3a4260', '#2e3550');

    // ---- a tower: hollow room stack. doors = { n: [levels], e: [...], s: [...], w: [...] } ----
    let holeN = 0;
    const tower = (cx, cz, H, color, doors, crawls = {}) => {
      const x0 = cx - half, x1 = cx + half, z0 = cz - half, z1 = cz + half;
      const holesFor = (side, c) => (doors[side] || []).map((l) => door(c, l)).concat(side in crawls ? [crawl(c + crawls[side])] : []);
      // north/south walls span the full width, east/west walls sit between them
      PH_segs(x0, x1, H, holesFor('n', cx), (a, b, y0, y1) => solid(a, b, y0, y1, z0, z0 + t, color));
      PH_segs(x0, x1, H, holesFor('s', cx), (a, b, y0, y1) => solid(a, b, y0, y1, z1 - t, z1, color));
      PH_segs(z0 + t, z1 - t, H, holesFor('w', cz), (a, b, y0, y1) => solid(x0, x0 + t, y0, y1, a, b, color));
      PH_segs(z0 + t, z1 - t, H, holesFor('e', cz), (a, b, y0, y1) => solid(x1 - t, x1, y0, y1, a, b, color));
      // a floor every 4.4 (the last one is the roof), each with a hole in a corner and a step block
      // under it on the floor below
      const n = Math.round(H / LV);
      for (let l = 1; l <= n; l++) {
        const q = (holeN++) % 4, sx = q % 2 ? 1 : -1, sz = q > 1 ? 1 : -1;
        const hx = cx + sx * 2.6, hz = cz + sz * 2.6;   // the hole is 3.6 wide so you clear its edge when you hop on the block
        slabHole(k, x0 + t, x1 - t, z0 + t, z1 - t, l * LV, [hx - 1.8, hx + 1.8, hz - 1.8, hz + 1.8], l === n ? color : CREAM, { t: 0.4 });
        solid(hx - 1, hx + 1, (l - 1) * LV, (l - 1) * LV + 2.2, hz - 1, hz + 1, CREAM);
      }
    };
    //            x      z     height  color   doors by side (levels)                      crawl holes
    tower(C[0], C[0], 2 * LV, RED,   { e: [0, 1], s: [0, 1], w: [0] }, { n: 0 });
    tower(C[1], C[0], LV,     YEL,   { e: [0], s: [0], w: [0] });
    tower(C[2], C[0], 3 * LV, BLUE,  { w: [0, 1, 2], s: [0, 1, 2], n: [0] });
    tower(C[0], C[1], LV,     GREEN, { n: [0], e: [0], s: [0] }, { w: 0 });
    tower(C[2], C[1], 2 * LV, RED,   { w: [0, 1], n: [0, 1], s: [0] });
    tower(C[0], C[2], 3 * LV, YEL,   { n: [0, 1], e: [0, 1, 2] }, { w: 0 });
    tower(C[1], C[2], 2 * LV, BLUE,  { n: [0], w: [0, 1], e: [0, 1] });
    tower(C[2], C[2], LV,     GREEN, { n: [0], w: [0], s: [0] }, { e: 0 });

    // ---- the balloon room: the middle cell, two floors of walls, open on top ----
    {
      const H = 2 * LV, x0 = -half, x1 = half, z0 = -half, z1 = half, W = '#f2efe8';
      PH_segs(x0, x1, H, [door(0, 0)], (a, b, y0, y1) => solid(a, b, y0, y1, z0, z0 + t, W));
      PH_segs(x0, x1, H, [door(0, 0)], (a, b, y0, y1) => solid(a, b, y0, y1, z1 - t, z1, W));
      PH_segs(z0 + t, z1 - t, H, [door(-2.5, 0), win(0, 1)], (a, b, y0, y1) => solid(x0, x0 + t, y0, y1, a, b, W));
      PH_segs(z0 + t, z1 - t, H, [door(2.5, 0), win(0, 1)], (a, b, y0, y1) => solid(x1 - t, x1, y0, y1, a, b, W));
      slab(k, 0, LV, 0, T - 2 * t, 2.4, DARK, { t: 0.4 });                      // rope bridge, window to window
      solid(1.5, 3.5, 0, 2.2, 2.4, 4.2, CREAM);                                 // step back up to it
      k.balloons(0, 0, 0, T - 2 * t, H, T - 2 * t, 75,
        ['#e5484d', '#2f6fdb', '#f5c331', '#2fb36b', '#ff8a3d', '#8f5bff', '#ffffff'], { seed: 5 });
    }

    // ---- orange kick panels: two-wall chimneys in the alleys (both walls of each) ----
    const pair = (axis, mid, a, b, h) => {
      // axis 'x': the alley runs along z at x = mid; panels on both walls from z = a..b
      if (axis === 'x') { solid(mid - 1.5, mid - 1.3, 0, h, a, b, '', KICK); solid(mid + 1.3, mid + 1.5, 0, h, a, b, '', KICK); }
      else { solid(a, b, 0, h, mid - 1.5, mid - 1.3, '', KICK); solid(a, b, 0, h, mid + 1.3, mid + 1.5, '', KICK); }
    };
    pair('x', -6.5, -17.5, -14.6, LV);      // red NW / yellow N -> the yellow roof
    pair('z', -6.5, 8.2, 11.3, 2 * LV);     // blue NE / red E -> the red roof
    pair('z', 6.5, 8.2, 11.3, LV);          // red E / green SE -> the green roof
    pair('z', -6.5, -17.5, -14.6, LV);      // red NW / green W -> the green roof
    pair('x', -6.5, 14.6, 17.5, 2 * LV);    // yellow SW / blue S -> the blue roof
    pair('x', 6.5, 14.6, 17.5, LV);         // blue S / green SE -> the green roof

    // ---- the alleys: vaults, slide bars, and plugs you slide under (they break the outer loop) ----
    const vaultX = (x, z) => solid(x - 0.3, x + 0.3, 0, 1.0, z - 1.5, z + 1.5, CREAM);
    const vaultZ = (x, z) => solid(x - 1.5, x + 1.5, 0, 1.0, z - 0.3, z + 0.3, CREAM);
    vaultZ(-6.5, 0); vaultZ(6.5, 13); vaultX(0, -6.5); vaultX(-13, 6.5);
    const barX = (x, z) => solid(x - 0.2, x + 0.2, 1.25, 1.6, z - 1.5, z + 1.5, DARK);
    const barZ = (x, z) => solid(x - 1.5, x + 1.5, 1.25, 1.6, z - 0.2, z + 0.2, DARK);
    barZ(6.5, -2); barX(13, -6.5); barX(-2, 6.5); barZ(-6.5, 11);
    // outer alley plugs: solid 1.2..4.4 across the alley - slide under, or run over the top
    const plug = (x0, x1, z0, z1, c) => solid(x0, x1, 1.2, LV, z0, z1, c);
    plug(-21, -18, 4.5, 8.5, GREEN);
    plug(18, 21, -8.5, -4.5, RED);
    plug(-8.5, -4.5, 18, 21, YEL);
    plug(4.5, 8.5, -21, -18, BLUE);

    // ---- trampolines at two alley crossings ----
    k.pad(5.8, 0, -5.8, 1.6, 1.6, 27.5, { look: 'tramp', color: BLUE, push: { x: 2.4, z: -2.4 } });  // -> the blue lookout (13.2)
    k.pad(-6.5, 0, 6.5, 1.6, 1.6, 24, { look: 'tramp', color: RED, push: { x: 1.9, z: 1.9 } });     // -> the blue tower roof (8.8)
  },
});
