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
  hemi: ['#fff4e2', '#9a8268', 1.3],
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
    const FLOOR = '#ecdcc0', CHECK = '#dcc7a4', WALL = '#f3e6cf', CEIL = '#f8efe0';
    const CAB = '#9cc5a1', TOP = '#f6efe2', DRAWER = '#86b38c', HANDLE = '#5a4632';
    const WOOD = '#c4895a', CHAIR = '#d6a26e', ISLAND = '#f2b880', FRIDGE = '#e6edf2', PANTRY = '#b98b62';
    const KICK = { tex: 'kick' };
    const H = 8.4;                                   // counter height

    ground(k, 60, 50, FLOOR);
    enclose(k, 60, 50, 19, WALL, CEIL);
    // big checkerboard tiles
    for (let x = -28; x <= 28; x += 4) for (let z = -23; z <= 23; z += 4) {
      if (((x + z) / 4) % 2 === 0) k.deco(x, 0, z, 4, 0.02, 4, CHECK);
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
    k.box(3.5, H, -19, 3, 2.4, 3, '#8fb4ff');
    k.deco(3.5, H + 2.4, -19, 1.8, 0.04, 0.5, '#2b3038');
    k.pad(3.5, H + 2.4, -19, 1.4, 1.4, 17.5, { push: { x: 9.5, z: -2.2 }, color: '#ffd166' });
    // plates + a jar on the counter (front half - the upper cabinets hang over the back half)
    k.box(-26, H, -19, 3, 1.2, 3, '#ffffff');
    k.box(-2, H, -19.2, 2, 3, 2, '#ffd166');

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
    const BOOK = ['#c3a6ff', '#8fb4ff', '#9be3a8', '#ff8fa3', '#ffd166', '#a8dcef', '#e7b38a'];
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
    for (const [x, z, c] of [[22, 10, '#ff8fa3'], [-13, 21.5, '#8fb4ff'], [-1, -15.5, '#ffd166']]) {
      k.box(x, 0, z, 2.4, 2.6, 2.4, c);
      k.box(x + 1.45, 0.6, z, 0.5, 1.4, 0.4, c);
    }
    // a cereal box standing up, and one lying on its side (run through it, climb on it)
    k.box(-4, 0, 20, 4.5, 6.5, 1.6, '#ff8fa3');
    k.box(6, 0, 19.95 - 2, 7, 4.4, 0.25, '#ffd166');
    k.box(6, 0, 19.95 + 2, 7, 4.4, 0.25, '#ffd166');
    k.box(6, 4.15, 19.95, 7, 0.25, 3.75, '#ffd166');
    k.box(23, 0, 16, 1.6, 6.5, 4.5, '#8fb4ff');
    // spoon on the floor (vault it)
    k.box(16, 0, 15, 1.2, 0.6, 7, '#c0c8d0');
    // dog bowl
    for (const [x, z, w, d] of [[-20, 17.2, 4, 0.4], [-20, 20.8, 4, 0.4], [-21.8, 19, 0.4, 3.2], [-18.2, 19, 0.4, 3.2]]) k.box(x, 0, z, w, 0.8, d, '#ff6b6b');
    // trash can + step stool in the south-west corner: stool -> can -> west counter
    k.box(-27, 0, 16, 5, 6.4, 5, '#8a95a5');
    k.box(-22.5, 0, 16, 3, 3.2, 3, '#e7b38a');
  },
});
