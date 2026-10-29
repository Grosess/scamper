// THE KITCHEN - you're tiny, the kitchen is not. Everything works in big kitchen heights:
//   floor 0       chair seats 3.2 (slide under them), sugar cubes, mugs, shakers, a dog bowl,
//                 a cereal box lying on its side (run through it), cookbooks
//   table 6.4     in the middle, chairs all round (seat -> table is a pull-up), a lamp above it
//   counters 8.4  the north counter (sink to drop into, toaster), the west counter (stove, an oven
//                 to hide in) and the island (tunnel through it, drawers to climb, a cutting-board
//                 ramp). A rolling pin bridges the north counter and the island
//   shelf 11.6    the spice shelf along the east wall, reached by the cookbook staircase
//   tops 15       upper cabinets, range hood, fridge and pantry - the high road. The toaster pops
//                 you onto the fridge, and the fridge/pantry gap is a kick chimney all the way up
// Kick routes (orange): the gap between the counter and the fridge (floor -> counter), the gap
// between the fridge and the pantry (floor -> 15), and the panel beside the west chair.
// Big jump: fridge top -> island (12m out, 6.6m down - slide-jump it).
defineMap({
  id: 'kitchen',
  accent: ['#9cc5a1', '#f2b880'],
  name: 'The Kitchen',
  blurb: "You're tiny. Climb drawers onto the counters, run the rolling pin, ride the toaster up to the fridge.",
  env: 'indoor',
  sky: '#2a2018',
  fog: [45, 120],
  hemi: ['#fff1d6', '#a07c58', 1.35],
  sun: [0.5, 4, 60, 6],
  size: 32,
  spotHeight: 18.6,
  spots: [-18, 0, 18].flatMap((x) => [-12, 12].map((z) => ({ x, z }))),
  menuCam: { r: 18, y: 13 },
  spawns: [
    [-12, 0, -12], [-3, 0, -12], [15, 0, -13.5], [24, 0, -6], [24, 0, 8], [16, 0, 10],
    [-9, 0, 20], [1, 0, 15.5], [-18, 0, -6], [-17, 0, 20], [10, 8.4, -4], [-24, 8.4, -20],
    [-12, 6.4, 4], [28.5, 11.6, 0], [14, 15, -22], [8, 0, -11],
  ],
  seekerSpawn: [8, 8.4, 3.5],

  build(k) {
    // palette: cream walls, sage cabinets, terracotta + butter-yellow tile, warm wood, copper accents
    const FLOOR = '#f3e5c8', CHECK = '#cc8a5e', WALL = '#f7ecd6', CEIL = '#fbf4e6';
    const CAB = '#a7c4a0', TOP = '#fbf7ee', DRAWER = '#94b58e', HANDLE = '#c27843';
    const WOOD = '#c08552', CHAIR = '#d9a36c', ISLAND = '#e3966b', FRIDGE = '#eef3f5', PANTRY = '#c08a5b';
    const KICK = { tex: 'kick' };
    const H = 8.4;                                   // counter height

    ground(k, 60, 50, FLOOR);
    enclose(k, 60, 50, 19, WALL, CEIL);
    // big checkerboard tiles
    for (let i = 0; i < 15; i++) for (let j = 0; j < 13; j++) {
      if ((i + j) % 2 === 0) k.deco(-28 + i * 4, 0, -24 + j * 4, 4, 0.02, 4, CHECK);
    }

    // a counter block from the floor to the top, with a thin countertop on it
    const counter = (x0, x1, z0, z1, color = CAB) => k.box((x0 + x1) / 2, 0, (z0 + z1) / 2, x1 - x0, H, z1 - z0, color);
    const top = (x0, x1, z0, z1) => k.deco((x0 + x1) / 2, H, (z0 + z1) / 2, x1 - x0, 0.06, z1 - z0, TOP);
    // drawers pulled out as a staircase (2.8 then 5.6, then pull up onto the counter)
    const drawers = (x0, z0, dir, along) => {
      // along 'x': drawers run along x from x0, sticking out from the face at z0 toward dir (+1/-1)
      for (let i = 0; i < 2; i++) {
        const h = 2.8 * (i + 1), a = x0 + i * 2.5 + 1.25;
        if (along === 'x') {
          k.box(a, 0, z0 + dir * 0.8, 2.5, h, 1.6, DRAWER);
          k.deco(a, h - 0.55, z0 + dir * 1.62, 1.2, 0.18, 0.04, HANDLE);
        } else {
          k.box(z0 + dir * 0.8, 0, a, 1.6, h, 2.5, DRAWER);
          k.deco(z0 + dir * 1.62, h - 0.55, a, 0.04, 0.18, 1.2, HANDLE);
        }
      }
    };

    // ---- north counter (z -25..-17): sink, open cabinet nook, toaster ----
    counter(-30, -16, -25, -17);
    top(-30, -16, -25, -17);
    // sink: a 6x6 basin 3m deep you can drop into and pull yourself out of
    k.box(-13, 0, -24.5, 6, H, 1, CAB); top(-16, -10, -25, -24);
    k.box(-13, 0, -17.5, 6, H, 1, CAB); top(-16, -10, -18, -17);
    k.box(-13, 0, -21, 6, 5.4, 6, '#c9d3dc');
    k.box(-13, 8.4, -24.6, 0.8, 3.2, 0.8, '#c0c8d0');                 // faucet
    k.box(-13, 10.8, -23, 0.8, 0.8, 2.4, '#c0c8d0');
    counter(-10, -6, -25, -17);
    top(-10, -6, -25, -17);
    // open cabinet: a nook at floor level
    k.box(-3, 0, -23, 6, H, 4, CAB);
    k.box(-3, 3.8, -19, 6, H - 3.8, 4, CAB);
    k.deco(-3, 0.02, -21.05, 6, 3.78, 0.04, '#6f927a');
    top(-6, 0, -25, -17);
    k.box(-6.15, 0.3, -15, 0.3, 3.2, 3.6, '#b4d6b8');                  // its door, swung open
    counter(0, 8, -25, -17);
    top(0, 8, -25, -17);
    drawers(-22, -17, 1, 'x');
    // toaster on the front of the counter: its slot throws you up onto the fridge
    k.box(3.5, H, -19, 3, 2.4, 3, '#7fb8c4');
    k.deco(3.5, H + 2.4, -19, 1.8, 0.04, 0.5, '#2b3038');
    k.pad(3.5, H + 2.4, -19, 1.4, 1.4, 17.5, { push: { x: 9.5, z: -2.2 }, color: '#ffd166' });
    // plates + a jar on the counter (front half - the upper cabinets hang over the back half)
    k.box(-26, H, -19, 3, 1.2, 3, '#ffffff');
    k.box(-2, H, -19.2, 2, 3, 2, '#f5cf6b');

    // ---- west counter (x -30..-22): stove on top, oven underneath ----
    counter(-30, -22, -17, -8);
    k.box(-29, 0, -4, 2, H, 8, CAB);
    k.box(-25, 3.8, -4, 6, H - 3.8, 8, '#e6e0d8');                      // oven front
    k.deco(-28.03, 0.02, -4, 0.04, 3.76, 7.9, '#3b3330');               // inside of the oven
    k.box(-20.5, 0, -4, 3, 0.35, 7.6, '#d9d2c8');                       // oven door, folded down
    counter(-30, -22, 0, 12);
    top(-30, -22, -17, 12);
    for (const [x, z] of [[-27.5, -6], [-27.5, -2], [-24.5, -6], [-24.5, -2]]) k.deco(x, H + 0.06, z, 2.2, 0.04, 2.2, '#3b3330');
    for (const z of [-7, -5, -3, -1]) k.deco(-21.7, 6.4, z, 0.6, 0.6, 0.6, '#3b3330');   // knobs
    drawers(-15, -22, 1, 'z');
    // kick panel beside the west chair: kick between it and the chair back up onto the counter
    k.box(-21.9, 0, 7, 0.2, H, 6, '#ff6a3d', KICK);

    // ---- upper cabinets + range hood: the high road at 15 ----
    k.box(-12, 12.4, -23, 36, 2.6, 4, CAB);                              // north, x -30..6
    k.box(-28, 12.4, -14.5, 4, 2.6, 13, CAB);                            // west, z -21..-8
    k.box(-27, 12.4, -4, 6, 2.6, 8, '#c9d3dc');                          // range hood
    k.box(-28, 12.4, 5, 4, 2.6, 10, CAB);                                // west, z 0..10

    // ---- fridge + pantry, and the two kick chimneys ----
    k.box(14, 0, -21.5, 6, 15, 7, FRIDGE);
    k.deco(16.4, 5, -17.96, 0.4, 5, 0.08, '#9aa4ae');                   // handles
    k.deco(16.4, 10.4, -17.96, 0.4, 3, 0.08, '#9aa4ae');
    k.deco(14, 9.6, -17.97, 6, 0.08, 0.06, '#c4ccd4');                  // door line
    k.box(8.1, 0, -21, 0.2, H, 8, '#ff6a3d', KICK);                      // counter end
    k.box(10.9, 0, -21.5, 0.2, 15, 7, '#ff6a3d', KICK);                  // fridge, west side
    k.box(17.1, 0, -21.5, 0.2, 15, 7, '#ff6a3d', KICK);                  // fridge, east side
    k.box(25, 0, -21.5, 10, 15, 7, PANTRY);
    k.box(19.9, 0, -21.5, 0.2, 15, 7, '#ff6a3d', KICK);                  // pantry, west side
    k.deco(25, 7.5, -17.97, 0.08, 15, 0.06, '#8a6542');

    // ---- the island: tunnel through the middle, drawers, cutting-board ramp ----
    k.box(8, 0, -3.75, 12, H, 4.5, ISLAND);
    k.box(8, 0, 3.75, 12, H, 4.5, ISLAND);
    k.box(8, 3.8, 0, 12, H - 3.8, 3, ISLAND);
    top(2, 14, -6, 6);
    drawers(3, 6, 1, 'x');
    k.ramp(19, 4.5, 10, 2.6, 0, H, '-x', '#b5835a');                    // cutting board
    k.box(11, H, 4, 2, 1, 3, '#ffffff');                                 // butter dish
    k.box(5, H, -3, 1, 3, 1, '#4a3d33');                                 // pepper grinder

    // ---- the rolling pin: a beam from the north counter to the island at counter height ----
    k.box(5, H - 1.2, -11.5, 1.2, 1.2, 11, '#e0b07a');

    // ---- table (6.4) and chairs (seat 3.2, slide under the seat) ----
    k.box(-8, 5.9, 7, 14, 0.5, 10, WOOD);
    for (const [x, z] of [[-14.5, 2.5], [-1.5, 2.5], [-14.5, 11.5], [-1.5, 11.5]]) k.box(x, 0, z, 1, 5.9, 1, WOOD);
    const chair = (x, z, back) => {
      k.box(x, 1.25, z, 3.5, 1.95, 3.5, CHAIR);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.box(x + sx * 1.5, 0, z + sz * 1.5, 0.5, 1.25, 0.5, CHAIR);
      if (back === '-z') k.box(x, 3.2, z - 2, 3.5, 5.4, 0.5, CHAIR);
      if (back === '+z') k.box(x, 3.2, z + 2, 3.5, 5.4, 0.5, CHAIR);
      if (back === '-x') k.box(x - 2, 3.2, z, 0.5, 5.4, 3.5, CHAIR);
    };
    chair(-11.5, 0, '-z'); chair(-4.5, 0, '-z');
    chair(-11.5, 14, '+z'); chair(-4.5, 14, '+z');
    chair(-17, 7, '-x');
    k.box(-3, 6.4, 9.5, 1.6, 2, 1.6, '#ff8fa3');                         // a cup on the table
    k.ramp(0.5, 4, 3.02, 1.4, 6.4, 8.4, '+x', '#c9ccd1', { base: 6.0 });   // a spoon resting from the table up onto the island
    k.deco(-12, 6.4, 9.5, 2.6, 0.12, 2.6, '#ffffff');                    // plates
    k.deco(-3.5, 6.4, 4, 2.6, 0.12, 2.6, '#ffffff');
    k.pad(-12, 6.4, 6, 1.4, 1.4, 18.5, { push: { x: 4, z: 1 }, color: '#ffd166' });   // up onto the lamp
    // the lamp over the table
    k.box(-8, 10.4, 7, 3, 1.4, 3, '#ffd166', { emissive: '#6a5000' });
    k.deco(-8, 11.8, 7, 0.12, 7.2, 0.12, '#4a3d33');

    // ---- east wall: spice shelf (11.6) and the cookbook staircase up to it ----
    k.box(28.5, 11.2, 3.5, 3, 0.4, 43, '#c98f5e');                       // z -18..25
    k.box(28.5, 11.6, -16.5, 2.4, 2.4, 2.4, '#ff8fa3');                  // jar: step up onto the pantry
    k.box(28.5, 11.6, -4, 2, 3, 2, '#9be3a8');
    k.box(28.5, 11.6, 6, 2, 2.4, 2, '#ffd166');
    const BOOK = ['#b5655a', '#7fa7c9', '#a7c4a0', '#e3966b', '#f5cf6b', '#8f7bb3', '#d9a36c'];
    for (let i = 0; i < 7; i++) k.box(11.4 + i * 2.4, 0, 23.5, 2.4, 1.6 * (i + 1), 3, BOOK[i]);

    // ---- floor clutter: things to juke around, slide under, hop on ----
    const CUBE = '#fbfbf7';
    for (const [x, z, n] of [[-2, -9, 1], [-0.4, -7.6, 2], [-19, -12, 1], [20.5, 1.5, 1], [19.5, 20, 2], [-8, -4.6, 1], [-25, 22, 1], [13, 12.5, 1], [5, 15.2, 2]]) {
      for (let i = 0; i < n; i++) k.box(x, i * 1.2, z, 1.2, 1.2, 1.2, CUBE);
    }
    // a fallen spatula you slide under, resting on two sugar-cube stacks
    for (const x of [17.4, 22.6]) k.box(x, 0, -6, 1.2, 2.4, 1.2, CUBE);
    k.box(20, 1.25, -6, 4, 0.4, 1.2, '#5a4632');
    // salt + pepper
    k.box(17, 0, -11, 1.4, 3.4, 1.4, '#ffffff');
    k.box(22, 0, -12, 1.4, 3.4, 1.4, '#3b3330');
    // mugs
    for (const [x, z, c] of [[22, 10, '#e3966b'], [-13, 21.5, '#7fa7c9'], [-1, -15.5, '#f5cf6b']]) {
      k.box(x, 0, z, 2.4, 2.6, 2.4, c);
      k.box(x + 1.45, 0.6, z, 0.5, 1.4, 0.4, c);
    }
    // a cereal box standing up, and one lying on its side (run through it, climb on it)
    k.box(-4, 0, 20, 4.5, 6.5, 1.6, '#e8705a');
    k.box(6, 0, 19.95 - 2, 7, 4.4, 0.25, '#f5cf6b');
    k.box(6, 0, 19.95 + 2, 7, 4.4, 0.25, '#f5cf6b');
    k.box(6, 4.15, 19.95, 7, 0.25, 3.75, '#f5cf6b');
    k.box(23, 0, 16, 1.6, 6.5, 4.5, '#7fa7c9');
    // spoon on the floor (vault it)
    k.box(16, 0, 15, 1.2, 0.6, 7, '#c0c8d0');
    // dog bowl
    for (const [x, z, w, d] of [[-20, 17.2, 4, 0.4], [-20, 20.8, 4, 0.4], [-21.8, 19, 0.4, 3.2], [-18.2, 19, 0.4, 3.2]]) k.box(x, 0, z, w, 0.8, d, '#b5655a');
    // trash can + step stool in the south-west corner: stool -> can -> west counter
    k.box(-27, 0, 16, 5, 6.4, 5, '#9aa6a0');
    k.box(-22.5, 0, 16, 3, 3.2, 3, '#d9a36c');

    KIT_decor(k, { CAB, TOP, HANDLE, WOOD, ISLAND, H });
  },
});

// ---- looks only: everything below is decoration (k.deco = no collision), so the layout and
// every jump/kick/slide stay exactly the same. Decos sit a hair proud of the faces they dress and
// never share a plane with each other (no z-fighting).
function KIT_decor(k, P) {
  const d = k.deco, H = P.H;
  const DOOR = '#bcd3b5', DOOR2 = '#efb08e', COPPER = P.HANDLE, CREAM = '#fbf7ee', GROUT = '#efe0b8';
  const TILE = '#f5d98e', GLASS = '#ffd98a', GLOW = { emissive: '#b8842a' }, DARK = '#3b3330', CHROME = '#c9d1d8';
  const TERRA = '#d0805a', LEAF = '#7fa66f', WOODDK = '#a66f45';

  // cabinet doors with copper handles. face: 'z-'/'z+'/'x-'/'x+' = which way the face points
  const doors = (a0, a1, y0, y1, face, at, color = DOOR) => {
    const n = Math.max(1, Math.round((a1 - a0) / 2.6)), w = (a1 - a0) / n, sg = face[1] === '+' ? 1 : -1;
    for (let i = 0; i < n; i++) {
      const c = a0 + w * (i + 0.5), hx = c + (i % 2 ? -1 : 1) * (w / 2 - 0.45);
      if (face[0] === 'z') {
        d(c, y0, at + sg * 0.02, w - 0.3, y1 - y0, 0.04, color);
        d(hx, (y0 + y1) / 2 - 0.5, at + sg * 0.07, 0.18, 1.0, 0.06, COPPER);
      } else {
        d(at + sg * 0.02, y0, c, 0.04, y1 - y0, w - 0.3, color);
        d(at + sg * 0.07, (y0 + y1) / 2 - 0.5, hx, 0.06, 1.0, 0.18, COPPER);
      }
    }
  };
  // north counter fronts (z = -17), skipping the pulled-out drawers (x -22..-17) and the nook
  doors(-30, -22, 0.6, 7.6, 'z+', -17);
  doors(-16, -10, 0.6, 7.6, 'z+', -17);
  doors(-10, -6, 0.6, 7.6, 'z+', -17);
  doors(-6, 0, 4.4, 7.6, 'z+', -17);
  doors(0, 8, 0.6, 7.6, 'z+', -17);
  // west counter fronts (x = -22)
  doors(-17, -15, 0.6, 7.6, 'x+', -22);
  doors(-10, -8, 0.6, 7.6, 'x+', -22);
  doors(0, 3.8, 0.6, 7.6, 'x+', -22);
  // island: terracotta doors on its north, west and east faces
  doors(2, 14, 0.6, 7.6, 'z-', -6, DOOR2);
  doors(-6, -1.5, 0.6, 7.6, 'x-', 2, DOOR2);
  doors(1.5, 6, 0.6, 7.6, 'x-', 2, DOOR2);
  doors(-6, -1.5, 0.6, 7.6, 'x+', 14, DOOR2);
  // upper cabinets
  doors(-30, 6, 12.7, 14.7, 'z+', -21);
  doors(-21, -8, 12.7, 14.7, 'x+', -26);
  doors(0, 10, 12.7, 14.7, 'x+', -26);
  // copper trim along the front edge of the counter tops
  for (const [x0, x1] of [[-30, -16], [-16, -10], [-10, 8]]) d((x0 + x1) / 2, H - 0.14, -16.94, x1 - x0, 0.23, 0.08, COPPER);
  d(-21.94, H - 0.14, -2.5, 0.08, 0.23, 29, COPPER);

  // backsplash: butter-yellow tile between the counters and the upper cabinets, with grout lines
  d(-12, H + 0.06, -24.97, 36, 12.4 - H - 0.06, 0.04, TILE);
  for (let x = -29.2; x < 6; x += 0.8) d(x, H + 0.06, -24.935, 0.05, 12.4 - H - 0.06, 0.03, GROUT);
  for (let y = H + 0.86; y < 12.4; y += 0.8) d(-12, y, -24.935, 36, 0.05, 0.03, GROUT);
  d(-29.97, H + 0.06, -2.5, 0.04, 12.4 - H - 0.06, 29, TILE);
  for (let z = -16.2; z < 12; z += 0.8) d(-29.935, H + 0.06, z, 0.03, 12.4 - H - 0.06, 0.05, GROUT);
  for (let y = H + 0.86; y < 12.4; y += 0.8) d(-29.935, y, -2.5, 0.03, 0.05, 29, GROUT);

  // stove: burner rings and copper knobs with a white dial mark; a lit oven window
  for (const [x, z] of [[-27.5, -6], [-27.5, -2], [-24.5, -6], [-24.5, -2]]) {
    d(x, H + 0.1, z, 1.6, 0.03, 1.6, '#6b605a');
    d(x, H + 0.13, z, 0.7, 0.02, 0.7, DARK);
  }
  for (const z of [-7, -5, -3, -1]) d(-21.35, 6.65, z, 0.04, 0.1, 0.36, CREAM);
  d(-21.97, 4.4, -4, 0.04, 1.6, 6.2, '#5a3626', { emissive: '#6a2c08' });
  d(-21.93, 4.55, -4, 0.04, 1.3, 5.9, '#7a4a30', { emissive: '#8a3c10' });
  d(-21.91, 6.1, -4, 0.06, 0.12, 6.6, CHROME);                     // oven door bar
  d(-27, 12.3, -4, 6.2, 0.12, 8.2, COPPER);                        // range hood trim

  // toaster: chrome stripe and lever, sink chrome rim
  d(3.5, H + 0.9, -19, 3.06, 0.3, 3.06, CHROME);
  d(5.08, H + 1.6, -19, 0.16, 0.25, 0.5, DARK);
  d(-13, H + 0.06, -21, 6.0, 0.03, 0.4, CHROME);

  // fridge magnets + pantry doors with knobs
  for (const [x, y, c] of [[12.2, 11.6, '#e8705a'], [13.4, 12.4, '#f5cf6b'], [12.8, 7.6, '#7fa7c9'], [15.2, 8.2, '#a7c4a0'], [12.0, 6.6, '#8f7bb3']]) {
    d(x, y, -17.97, 0.6, 0.6, 0.06, c);
  }
  d(13.2, 13.4, -17.965, 1.4, 1.0, 0.05, CREAM);                    // a drawing on the fridge
  for (const x0 of [20.4, 25.2]) {
    d(x0 + 2.2, 0.8, -17.97, 4.4, 13.4, 0.04, '#cf9a6a');
    d(x0 + (x0 < 25 ? 3.9 : 0.5), 7.2, -17.91, 0.4, 0.4, 0.06, COPPER);
  }

  // big sunny window on the east wall, above the spice shelf, with curtains
  d(29.96, 13.6, -5, 0.08, 4.4, 12, CREAM);
  d(29.9, 13.9, -5, 0.04, 3.8, 11.4, GLASS, GLOW);
  d(29.86, 13.9, -5, 0.02, 3.8, 0.18, CREAM);
  d(29.86, 15.7, -5, 0.02, 0.18, 11.4, CREAM);
  for (const z of [-11.7, 1.7]) d(29.7, 13.2, z, 0.3, 5.2, 1.6, TERRA);
  d(29.6, 18.4, -5, 0.2, 0.2, 15, WOODDK);                          // curtain rail
  // a second window high on the north wall, above the upper cabinets
  d(-14, 15.6, -24.96, 18, 2.8, 0.08, CREAM);
  d(-14, 15.85, -24.9, 17.4, 2.3, 0.04, GLASS, GLOW);
  for (const x of [-20, -14, -8]) d(x, 15.85, -24.86, 0.18, 2.3, 0.02, CREAM);

  // plants in terracotta pots on the far end of the spice shelf
  for (const z of [19, 23]) {
    d(28.7, 11.6, z, 1.3, 1.2, 1.3, TERRA);
    d(28.7, 12.8, z, 1.9, 1.4, 1.9, LEAF);
    d(28.7, 14.2, z, 1.1, 0.8, 1.1, '#93b97f');
  }
  // jars: lid bands and labels
  for (const [z, w, h] of [[-16.5, 2.4, 2.4], [-4, 2, 3], [6, 2, 2.4]]) {
    d(28.5, 11.6 + h - 0.45, z, w + 0.08, 0.4, w + 0.08, COPPER);
    d(28.5, 11.6 + h * 0.3, z, w + 0.06, h * 0.3, w + 0.06, CREAM);
  }

  // wall clock on the south wall
  d(-10, 13, 24.97, 3.4, 3.4, 0.06, COPPER);
  d(-10, 13.2, 24.93, 3.0, 3.0, 0.04, CREAM);
  d(-10, 14.7, 24.89, 0.14, 1.2, 0.04, DARK);
  d(-9.5, 14.62, 24.87, 1.0, 0.14, 0.02, DARK);

  // hanging utensil rail on the west wall (copper bar, ladles + spatulas)
  d(-29.6, 11.7, 6, 0.12, 0.12, 8, COPPER);
  for (let i = 0; i < 5; i++) {
    const z = 2.8 + i * 1.6;
    d(-29.55, 9.8, z, 0.08, 1.9, 0.12, CHROME);
    d(-29.55, 9.5, z, 0.1, 0.4, i % 2 ? 0.5 : 0.7, i % 2 ? WOODDK : CHROME);
  }

  // plates: rims on the counter stack and the plates on the table
  for (const y of [H + 0.35, H + 0.75]) d(-26, y, -19, 3.06, 0.08, 3.06, '#bcd3e0');
  for (const [x, z] of [[-12, 9.5], [-3.5, 4]]) d(x, 6.52, z, 1.8, 0.02, 1.8, '#dce8f0');

  // table: wood grain strips; a runner cloth down the middle
  for (let z = 2.75; z < 12; z += 1.5) d(-8, 6.4, z, 13.6, 0.015, 0.12, WOODDK);
  d(-8, 6.41, 7, 4, 0.02, 9.8, CREAM);
  // lamp: a glowing bulb under the shade
  d(-8, 10.25, 7, 2.2, 0.15, 2.2, '#fff2b0', { emissive: '#a08030' });

  // rug under the table: terracotta with a cream border inside
  d(-8, 0.025, 7, 20, 0.03, 15, TERRA);
  d(-8, 0.055, 7, 18, 0.01, 13, '#e9b48c');

  // cereal boxes: big labels; mugs: stripes; books: spine bands
  d(-4, 1.2, 19.17, 3.4, 3.2, 0.06, CREAM);
  d(-4, 2.2, 19.12, 2.2, 1.2, 0.04, '#f5cf6b');
  for (const z of [17.795, 22.105]) {
    d(6, 0.8, z, 5.4, 2.6, 0.06, '#e8705a');
    d(6, 1.6, z + (z < 20 ? -0.04 : 0.04), 3.0, 1.0, 0.04, CREAM);
  }
  d(22.17, 1.4, 16, 0.06, 3.4, 3.4, CREAM);
  for (const [x, z] of [[22, 10], [-13, 21.5], [-1, -15.5]]) d(x, 1.5, z, 2.46, 0.35, 2.46, CREAM);
  for (let i = 0; i < 7; i++) d(11.4 + i * 2.4, 1.6 * (i + 1) - 0.7, 23.5, 2.42, 0.3, 3.04, i % 2 ? CREAM : '#f5cf6b');

  // sage wainscot with a copper rail on the open walls
  d(0, 0.6, 24.96, 60, 3.4, 0.04, '#b9cfb2');
  d(0, 4.0, 24.94, 60, 0.18, 0.08, COPPER);
  d(29.96, 0.6, 3.5, 0.04, 3.4, 43, '#b9cfb2');
  d(29.94, 4.0, 3.5, 0.08, 0.18, 43, COPPER);
  d(-29.96, 0.6, 18.5, 0.04, 3.4, 13, '#b9cfb2');
  d(-29.94, 4.0, 18.5, 0.08, 0.18, 13, COPPER);
  // baseboards along the open walls
  d(0, 0, 24.95, 60, 0.6, 0.1, TERRA);
  d(29.95, 0, 3.5, 0.1, 0.6, 43, TERRA);
  d(-29.95, 0, 18.5, 0.1, 0.6, 13, TERRA);
}
