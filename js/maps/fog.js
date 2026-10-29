// FOG - one suburban street at dusk, swallowed by thick drifting fog. Hedges ring the block, with
// an invisible wall on top so nobody can leave. Three ways around, and they cross everywhere:
//   street      parked cars and a van to hop, streetlights, trees whose crowns you can stand on
//   yards       front yards, then backyards split by vaultable fences (1m) and privacy fences (2m)
//   roofs       gable roofs (eaves 3.8, ridges 5.8) you run straight over, a garage roof (3.0),
//               a two-storey corner house (7.6) with a water tank and a back balcony
// Getting up:  orange side alleys are wall-kick chimneys to the eaves; bins, AC units, sheds and
//              the garage are steps; trampolines bounce you onto roofs; a treehouse rope bridge runs
//              to the balcony. The park has a kick tower, a fort, a lookout deck, a merry-go-round.
// Ceilings: nothing low hangs over a floor - overhangs and canopies are 3.8m+ up.
defineMap({
  id: 'fog',
  accent: ['#8f98a8', '#ffd88a'],
  name: 'Fog',
  blurb: 'A suburban street lost in fog. Run the roofs, hop the fences, kick up the side alleys.',
  env: 'fog',
  sky: '#7f889a',
  fog: [7, 40],
  fogDensity: 0.055,       // real (exponential) fog, thicker with distance
  hemi: ['#e2e8f5', '#5a6070', 2.5],
  sun: [1.3, 20, 50, 30],
  size: 26,
  menuCam: { path: [[-20, 2.6, 0.6], [15, 2.6, 0.6]] },
  spawns: [
    [-14, 0, 0], [14, 0, 0], [-4, 0, 1.5], [3, 0, -1.5],
    [-17.5, 0, -18], [-11.5, 0, -20], [4, 0, -16.5], [21.5, 0, -21],
    [-17, 0, 17], [-10.5, 0, 16.5], [0, 0, 10], [8.5, 0, 16.5], [21.5, 0, 18.5],
    [6.5, 5.8, -11], [-9, 5.8, 11], [18.5, 7.6, -11],
  ],
  seekerSpawn: [0, 0, 0],

  build(k) {
    // palette: a handful of bold colors
    const GRASS = '#6b7d5c', ROAD = '#474b54', CURB = '#a9a59c', HEDGE = '#4a5f44';
    const FENCE = '#e6e0d4', WOOD = '#9c7653', TRUNK = '#5e4a3a', LEAF = '#5a7550', TRIM = '#e6e0d4';
    const SAND = '#d8bf8f', SAGE = '#8fa8a4', BRICK = '#b8644a', SLATE = '#4c5260', RUST = '#7a463c', RED = '#b5524b', BLUE = '#3f5a7a';
    const LIT = { emissive: '#9a6a20' }, KICK = { tex: 'kick' };
    const E = 3.8, R = 2.0, O = 0.3;   // eave height, roof rise, eave overhang

    // ---- ground, street, sidewalks, hedge ring with an invisible wall above it ----
    ground(k, 49, 49, GRASS);
    for (const s of [-1, 1]) {
      k.box(0, 0, s * 24, 47, 3, 1, HEDGE);                 // back hedges
      k.box(s * 24, 0, 0, 1, 3, 49, HEDGE);                 // side hedges (they close off the street too)
      k.wall(0, 3, s * 24, 49, 40, 1);
      k.wall(s * 24, 3, 0, 1, 40, 49);
    }
    k.deco(0, 0, 0, 47, 0.02, 6, ROAD);
    for (const s of [-1, 1]) k.box(0, 0, s * 3.75, 47, 0.15, 1.5, CURB);
    // road closed at both ends
    for (const s of [-1, 1]) for (const z of [-1.5, 1.5]) {
      k.box(s * 22.4, 0, z, 0.4, 1.0, 2.2, FENCE);
    }

    // ---- houses ----
    // ridge 'x' = roof slopes to the front and back (gables face the alleys); ridge 'z' = slopes
    // left and right. ov = overhang per side [west, east, north, south] (only on eave sides, and
    // never over an alley or a back wall - an overhang above you would cap your jumps there).
    let wi = 0;
    const win = (x, y, z, alongX, lit) => {
      const o = lit ? LIT : {};
      if (alongX) k.deco(x, y, z, 1.2, 1.3, 0.08, lit ? '#ffd88a' : '#3b4250', o);
      else k.deco(x, y, z, 0.08, 1.3, 1.2, lit ? '#ffd88a' : '#3b4250', o);
    };
    const house = (x0, x1, z0, z1, body, roof, ridge, ov, door, frontNorth) => {
      const w = x1 - x0, d = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
      k.box(cx, 0, cz, w, E, d, body);
      const [ow, oe, on, os] = ov;
      // the two halves overlap a hair at the ridge, so there's no seam to slip through
      const q = 0.02;
      // (the second half is 1cm narrower along the ridge so the two gable ends never share a face)
      if (ridge === 'x') {
        k.ramp(cx, (z0 - on + cz + q) / 2, w, cz + q - z0 + on, E, E + R, '+z', roof, { base: E });
        k.ramp(cx, (cz - q + z1 + os) / 2, w - 0.01, z1 + os - cz + q, E, E + R, '-z', roof, { base: E });
      } else {
        k.ramp((x0 - ow + cx + q) / 2, cz, cx + q - x0 + ow, d, E, E + R, '+x', roof, { base: E });
        k.ramp((cx - q + x1 + oe) / 2, cz, x1 + oe - cx + q, d - 0.01, E, E + R, '-x', roof, { base: E });
      }
      // front: door + porch step + two windows; back: two windows
      const fz = frontNorth ? z0 : z1, fs = frontNorth ? -1 : 1, bz = frontNorth ? z1 : z0;
      k.deco(cx, 0.3, fz + fs * 0.04, 1.1, 2.2, 0.08, door);
      k.box(cx, 0, fz + fs * 0.6, 1.8, 0.3, 1.2, TRIM);
      for (const wx of [x0 + 1.8, x1 - 1.8]) win(wx, 1.1, fz + fs * 0.04, true, (wi++ % 3) !== 1);
      void bz;
      // picket fence with a gap for the walkway
      const fzl = frontNorth ? 4.575 : -4.575;
      for (const [a, b] of [[x0 + 0.4, cx - 0.9], [cx + 0.9, x1 - 0.4]]) k.box((a + b) / 2, 0, fzl, b - a, 0.9, 0.15, FENCE);
    };

    // north row (fronts face the street at z = -7)
    house(-23.5, -15.5, -15, -7, SAND, SLATE, 'z', [O, 0, 0, 0], RED, false);
    house(-12.5, -4.5, -15, -7, SAGE, RUST, 'x', [0, 0, 0, O], BLUE, false);
    house(2.5, 10.5, -15, -7, BRICK, SLATE, 'x', [0, 0, 0, O], BLUE, false);
    // south row (fronts face the street at z = 7)
    house(-23.5, -16, 7, 15, BRICK, SLATE, 'x', [0, 0, O, 0], BLUE, true);
    house(-13, -5, 7, 15, SAND, RUST, 'z', [0, O, 0, 0], RED, true);
    house(5, 13, 7, 15, SAGE, SLATE, 'x', [0, 0, O, 0], RED, true);
    house(16, 23.5, 7, 15, SAND, RUST, 'z', [0, O, 0, 0], BLUE, true);
    // chimneys on the ridges (a little vault while you run the roofline)
    k.box(-10, E, -11, 0.8, R + 0.9, 0.8, RUST);
    k.box(-9, E, 9.2, 0.8, R + 0.9, 0.8, RUST);
    k.box(11, E, 11, 0.8, R + 0.9, 0.8, RUST);

    // two-storey corner house (flat roof 7.6, parapet on the street + hedge sides, water tank)
    const T = 7.6;
    k.box(18.5, 0, -11, 10, T, 8, BRICK);
    k.box(18.5, T, -7.15, 10, 0.6, 0.3, SAND);
    k.box(23.35, T, -11.15, 0.3, 0.6, 7.7, SAND);
    k.box(20.5, T, -12, 2.2, 2.0, 2.2, WOOD);
    k.deco(18.5, 0.3, -6.96, 1.1, 2.2, 0.08, BLUE);
    k.box(18.5, 0, -6.4, 1.8, 0.3, 1.2, TRIM);
    for (const wx of [15.5, 21.5]) { win(wx, 1.1, -6.96, true, true); win(wx, 4.6, -6.96, true, wx > 20); }
    win(18.5, 4.6, -6.96, true, false);
    for (const [a, b] of [[13.9, 17.6], [19.4, 23.1]]) k.box((a + b) / 2, 0, -4.575, b - a, 0.9, 0.15, FENCE);
    // back balcony at 4.4 (rail on part of the back + the east side)
    slab(k, 17.5, 4.4, -17.4, 5, 4.8, FENCE, { t: 0.3 });
    posts(k, [[15.2, -19.6], [19.8, -19.6]], 0, 4.1, FENCE, 0.3);
    k.box(18.75, 4.4, -19.74, 2.5, 1.0, 0.12, FENCE);
    k.box(19.94, 4.4, -17.34, 0.12, 1.0, 4.68, FENCE);
    k.deco(17, 4.4, -15.04, 1.1, 2.2, 0.08, BLUE);
    k.box(16, 0, -20.8, 1.2, 1.2, 1.2, WOOD);                 // crates: steps up to the balcony
    k.box(16, 1.2, -21.0, 0.8, 0.6, 0.8, WOOD);

    // ---- garage between the north houses + its driveway ----
    k.box(-2.5, 0, -11.5, 4, 3.0, 7, CURB);
    k.deco(-2.5, 0, -7.96, 3.2, 2.4, 0.08, FENCE);

    // ---- orange kick alleys (2.6m between the panels) ----
    const panel = (x, z, h, d) => k.box(x, 0, z, 0.2, h, d, '#e86a3d', KICK);
    panel(-15.4, -11, E, 6.8); panel(-12.6, -11, E, 6.8);         // north-west alley
    panel(-0.4, -11.5, 3.0, 6.4); panel(2.4, -11, E, 6.8);         // garage side path
    panel(-15.9, 11, E, 6.8); panel(-13.1, 11, E, 6.8);            // south-west alley
    panel(13.1, 11, E, 6.8); panel(15.9, 11, E, 6.8);              // south-east alley
    // north-east alley: plain walls (still kickable), bins + a gate to vault
    k.box(10.85, 0, -8.2, 0.7, 1.1, 0.7, SLATE);
    k.box(10.85, 0, -9.1, 0.7, 1.1, 0.7, SLATE);
    k.box(12, 0, -12.5, 3, 1.0, 0.15, FENCE);

    // ---- steps up onto the houses: bins and AC units against the walls ----
    for (const [x, z, w, d] of [[-16.1, -15.4, 1, 0.8], [-6.5, -15.4, 1, 0.8], [-18, 15.4, 1, 0.8], [8, 15.4, 1, 0.8],
                                [16.6, 15.4, 1, 0.8]]) {
      k.box(x, 0, z, w, 1.1, d, CURB);
    }

    // ---- backyard fences (1m pickets to vault, 2m privacy fences to climb) ----
    const fenceZ = (x, z0, z1, h, c) => k.box(x, 0, (z0 + z1) / 2, 0.15, h, z1 - z0, c);
    fenceZ(-14, -23.5, -15, 1.0, FENCE);
    fenceZ(-4.5, -23.5, -15, 2.0, WOOD);
    fenceZ(1, -23.5, -15, 1.0, FENCE);
    fenceZ(12, -23.5, -21, 2.0, WOOD); fenceZ(12, -19.6, -15, 2.0, WOOD);   // gate gap
    fenceZ(-14.5, 15, 23.5, 1.0, FENCE);
    fenceZ(14.5, 15, 23.5, 1.0, FENCE);
    k.box(-5, 0, 19.25, 0.8, 1.2, 8.5, HEDGE);                 // park edges
    fenceZ(5, 15, 23.5, 2.0, WOOD);

    // ---- north yards ----
    k.box(-20, 0, -20, 2.4, 2.6, 2.4, WOOD);                     // shed
    k.box(-16.5, 0, -21.5, 1, 0.4, 3, TRUNK);                    // garden bed
    k.pad(-8.5, 0, -18.5, 1.6, 1.6, 16, { look: 'tramp', color: BLUE, push: { x: 0, z: 4.5 } });
    k.box(-1.8, 0, -20, 1.8, 0.75, 0.9, WOOD);                    // picnic table + benches
    k.box(-1.8, 0, -21, 1.8, 0.45, 0.35, WOOD);
    k.box(-1.8, 0, -19, 1.8, 0.45, 0.35, WOOD);
    // treehouse: trunk, platform at 4.4, shed to climb, rope bridge to the balcony, canopy on top
    k.box(6.2, 0, -19, 0.9, 4.1, 0.9, TRUNK);
    slab(k, 6.2, 4.4, -19, 4.4, 4, WOOD, { t: 0.3 });
    k.box(4.1, 4.4, -19, 0.15, 1.0, 3.9, TRUNK);
    k.box(5.3375, 4.4, -20.9, 2.325, 1.0, 0.15, TRUNK);       // leaves the shed side open
    k.box(6.2, 4.4, -19, 0.6, 3.6, 0.6, TRUNK);
    k.box(6.2, 8.0, -19, 3.6, 1.8, 3.2, LEAF);
    k.box(10.2, 0, -21.4, 2.4, 2.6, 2.4, SAGE);                    // shed
    slab(k, 11.7, 4.4, -19, 6.6, 1.2, WOOD, { t: 0.3 });          // rope bridge

    // ---- south yards ----
    k.box(-20.2, 0, 20.2, 2.4, 2.6, 2.4, SAGE);                    // shed
    k.box(-17, 0, 21, 1, 0.4, 3, TRUNK);
    k.box(-9.5, 0, 19.5, 5, 0.9, 5, FENCE);                        // raised pool
    k.water(-9.5, 0.92, 19.5, 4.4, 4.4, '#6fa8c8', 0.85);
    k.box(9.25, 0, 21, 4.5, 3.0, 5, CURB);                         // detached garage
    k.deco(9.25, 0, 18.46, 3.4, 2.4, 0.08, FENCE);
    k.pad(17.2, 0, 18.6, 1.6, 1.6, 16, { look: 'tramp', color: RED, push: { x: 0, z: -4.5 } });
    k.box(22.4, 0, 21.5, 1.2, 1.0, 1.4, BRICK);                    // doghouse

    // ---- the park (between the south houses): fort + slide, lookout deck, kick tower, tree ----
    k.deco(0, 0, 14.5, 9.2, 0.02, 15, SAND);
    k.box(-3.4, 0, 18.75, 2.4, 2.6, 2.5, BLUE);
    k.ramp(-3.4, 15.75, 1.0, 3.5, 0, 2.6, '+z', RED);
    slab(k, 0, 4.4, 18.75, 3, 3.5, FENCE, { t: 0.3 });
    posts(k, [[-1.35, 17.15], [1.35, 17.15], [-1.35, 20.35], [1.35, 20.35]], 0, 4.1, FENCE, 0.3);
    k.box(0, 4.4, 20.44, 3, 1.0, 0.12, FENCE);
    k.box(-1.7, 0, 14.9, 0.3, 4.4, 4.2, '#e86a3d', KICK);
    k.box(1.7, 0, 14.9, 0.3, 4.4, 4.2, '#e86a3d', KICK);
    k.box(3.4, 0, 14.5, 0.7, 5.2, 0.7, TRUNK);
    k.box(3.6, 5.2, 14.5, 2.7, 2.2, 4, LEAF);
    posts(k, [[-3.9, 9.5], [-0.9, 9.5]], 0, 2.6, SLATE, 0.2);  // swing frame
    k.box(-2.4, 2.6, 9.5, 3.2, 0.15, 0.2, SLATE);
    k.mover(2.6, 0, 9.8, 2.4, 0.35, 2.4, SAND, { type: 'spin', speed: 1.1 });   // merry-go-round

    // ---- street: parked cars, a van, trees you can climb, streetlights, mailboxes ----
    const car = (x, z, c) => {
      k.box(x, 0, z, 4.2, 1.0, 1.9, c);
      k.box(x - 0.2, 1.0, z, 2.4, 0.6, 1.7, FENCE);
    };
    car(-19, -1.9, BLUE); car(-8, -1.9, RED); car(6.5, -1.9, SAGE);
    car(-10, 1.9, SAND); car(9, 1.9, BRICK);
    k.box(19, 0, 1.9, 5, 2.4, 2.1, FENCE);                         // van
    const tree = (x, z) => { k.box(x, 0, z, 0.4, E, 0.4, TRUNK); k.box(x, E, z, 2.6, 1.2, 2.6, LEAF); };
    tree(-14, -5.3); tree(14.5, 5.3);
    const lamp = (x, z, s) => {
      k.box(x, 0, z, 0.18, 4.6, 0.18, '#3d434d');
      k.deco(x, 4.6, z - s * 0.5, 0.12, 0.12, 1.0, '#3d434d');
      k.deco(x, 4.42, z - s * 0.9, 0.4, 0.18, 0.5, '#fff1c4', { emissive: '#e8c87a' });
    };
    lamp(-17, -3.9, -1); lamp(4.5, -3.9, -1); lamp(18, -3.9, -1);
    lamp(-19, 3.9, 1); lamp(-2.5, 3.9, 1); lamp(11, 3.9, 1);
    for (const [x, z] of [[-20.7, -4.3], [-7.6, -4.3], [5.6, -4.3], [-18.8, 4.3], [-8.1, 4.3], [10.1, 4.3]]) {
      k.box(x, 0, z, 0.12, 1.0, 0.12, SLATE);
      k.box(x, 1.0, z, 0.4, 0.3, 0.55, BLUE);
    }
    k.box(-0.9, 0.15, -4.0, 0.3, 0.6, 0.3, RED);                  // hydrant

    // --- for chases: flatbed trailers parked in the street (deck bottom 1.2m - slide under, or
    // climb on top), and low garden walls to vault in the back yards ---
    for (const [x, z] of [[18, -1.5], [-18.2, 1.5]]) {
      k.box(x, 1.2, z, 4.4, 0.3, 1.9, CURB);
      k.box(x, 1.5, z - 0.8, 4.4, 0.6, 0.3, SLATE);
      k.box(x, 1.5, z + 0.8, 4.4, 0.6, 0.3, SLATE);
      for (const ex of [-1, 1]) for (const ez of [-1, 1]) k.box(x + ex * 2.05, 0, z + ez * 0.8, 0.3, 1.2, 0.3, '#2b2f35', { tex: 'none' });
    }
    k.box(18, 0, -18.5, 3.2, 1.0, 0.5, FENCE);
    k.box(-20, 0, 17, 0.5, 1.0, 3.0, FENCE);
  },
});
