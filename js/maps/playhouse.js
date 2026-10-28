// THE PLAYHOUSE - a padded indoor play structure, three levels of 3m hallways (floors at 0 / 4 / 8).
// Built from the ASCII grids below - each character is a 3x3m cell (13 x 13 cells, row 0 = north,
// column 0 = west), so you can redraw it right here. Every odd row/odd column cell is a pillar, so
// there's a junction every 6m and lots of small loops instead of one big ring.
//
//   #  padded wall            .  floor                    v  crawl tunnel (1.2m gap)
//   w  low wall to vault      n  net wall (see-through)   c  soft cube to juke around
//   m  mantle block (1.6m) under a hole: climb on, then pull up to the floor above
//   T  trampoline under a hole                            s  stairs (built below)
//   B  the BALLOON ROOM (two floors tall, full of balloons that dodge you)
//   D  (ground grid) doorway sill: solid up to the floor above, so you can pull yourself up onto it
//   ' ' (space) hole: no floor here - drop down, or come up through it
//   b  rope bridge over a hole (upper floors)
//
// Ways up: two staircases, four orange kick shafts (marked in PH_SHAFTS), mantle blocks, the balloon
// room's trampoline + mantle block, and the big trampoline in the middle well that throws you all
// the way to the top floor. Ceilings are 3.6m+ above every floor - no head bumping.
const PH_L0 = [
  '...#...#BBBBB',
  '.#v#.#.#BBBBB',
  '.....#..BBBBB',
  '##.#w#.#BBBBB',
  '...v...DmBBBT',
  '.###.#.###.#D',
  '......T..w...',
  '##.###.#v#.#.',
  '...n...#...c.',
  '.#.#.###.###.',
  '.w...v.....#m',
  '.###.#.#.#.#.',
  'sss...w...c..',
];
const PH_L1 = [
  '.....#..BBBBB',
  '.#.###.#BBBBB',
  '.n.....#BBBBB',
  '.#.#.#w#BBBBB',
  '.....v..BBBBB',
  '##.#.#.#####.',
  '...w.. ......',
  '.#.#.#.#.# #.',
  '.v..m#.......',
  '.# #.#.#.#.#.',
  '.......v.n.. ',
  '.###.#.#.#w#.',
  '   .....w....',
];
const PH_L2 = [
  '..   ....#...',
  '.#.#.#b#.#.#.',
  '.....n.......',
  '.# #.#.#.#b#.',
  '.w.......n...',
  '##.#.#.#.#.##',
  '.....b b..w..',
  '.#b#.#.#.#.#.',
  '.... ....n...',
  '.#.#.#b# #.#.',
  '.n........ ..',
  '.#.#.#.#b#.#.',
  '....w........',
];
// kick shafts: [row, col, level] = open at that level, hole in the level above, orange walls either side
const PH_SHAFTS = [[9, 2, 0], [7, 10, 0], [3, 2, 1], [9, 8, 1]];

defineMap({
  id: 'playhouse',
  accent: ['#ff8fa3', '#7ed6c8'],
  name: 'The Playhouse',
  blurb: 'A three-storey play structure. Crawl tunnels, nets, rope bridges, trampolines and a room full of balloons that dodge you.',
  env: 'indoor',
  sky: '#141824',
  fog: [24, 64],
  hemi: ['#ffffff', '#c4cbe0', 1.8],
  sun: [0.45, 4, 60, 6],
  size: 22,
  spotHeight: 12.1,
  spots: [-12, 0, 12].flatMap((x) => [-12, 0, 12].map((z) => ({ x, z }))),
  menuCam: { path: [[-18, 5.8, 0], [9, 5.8, 0]] },   // drifts along the middle hallway upstairs, over the well
  spawns: [
    [-18, 0, -18], [-6, 0, -12], [-18, 0, 6], [-6, 0, 18], [12, 0, 12], [6, 0, 6], [12, 0, -12],
    [-12, 4, -12], [-18, 4, 0], [0, 4, 18], [18, 4, 6], [12, 4, 0],
    [-6, 8, -6], [18, 8, 18], [18, 8, -12], [-18, 8, 12],
  ],
  seekerSpawn: [-6, 4, 0],

  build(k) {
    const N = 13, S = 3, LV = [0, 4, 8], TOP = 12.4, T = 0.4;
    const X = (c) => (c - (N - 1) / 2) * S, Z = (r) => (r - (N - 1) / 2) * S;
    const W = N * S;
    const G = [PH_L0, PH_L1, PH_L2];
    const at = (l, r, c) => (G[l] && G[l][r] && G[l][r][c]) || '#';
    // wall colors: one pastel per quarter, a different set on each level so you know where you are
    const PAL = [
      ['#8fb4ff', '#ff8fa3', '#7ed6c8', '#ffd166'],
      ['#c3a6ff', '#a8dcef', '#9be3a8', '#ffd166'],
      ['#ff8fa3', '#8fb4ff', '#7ed6c8', '#c3a6ff'],
    ];
    const FLOORS = ['#e3e8ef', '#ece6fb', '#e2f4ef'];
    const wallCol = (l, r, c) => PAL[l][(r < N / 2 ? 0 : 2) + (c < N / 2 ? 0 : 1)];
    const ceil = (l) => (l < 2 ? LV[l + 1] - T : TOP);     // underside of whatever is above level l
    const isHole = (l, r, c) => l > 0 && [' ', 'B', 'b'].includes(at(l, r, c));
    // orange kick walls: the walls either side of each shaft, on its level and the one above
    const kick = new Set();
    for (const [r, c, l] of PH_SHAFTS) {
      for (const [dr, dc] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
        for (const ll of [l, l + 1]) if (at(ll, r + dr, c + dc) === '#') kick.add(`${ll},${r + dr},${c + dc}`);
      }
    }

    ground(k, W, W, FLOORS[0]);
    enclose(k, W, W, TOP, '#eef2f6', '#f6f8fb');

    for (let l = 0; l < 3; l++) {
      const y0 = LV[l], y1 = ceil(l);
      // floor slabs (levels 1 and 2): one per row, broken by holes
      if (l > 0) {
        for (let r = 0; r < N; r++) {
          for (let c = 0; c < N;) {
            const gap = (cc) => isHole(l, r, cc) || (l === 1 && at(0, r, cc) === 'D');
            if (gap(c)) { c++; continue; }
            let e = c;
            while (e + 1 < N && !gap(e + 1)) e++;
            slab(k, (X(c) + X(e)) / 2, y0, Z(r), (e - c + 1) * S, S, FLOORS[l], { t: T });
            c = e + 1;
          }
        }
      }
      // walls: runs of the same wall in a row become one box
      for (let r = 0; r < N; r++) {
        for (let c = 0; c < N;) {
          if (at(l, r, c) !== '#') { c++; continue; }
          const key = (cc) => (kick.has(`${l},${r},${cc}`) ? 'k' : wallCol(l, r, cc));
          let e = c;
          while (e + 1 < N && at(l, r, e + 1) === '#' && key(e + 1) === key(c)) e++;
          const kk = key(c) === 'k';
          k.box((X(c) + X(e)) / 2, y0, Z(r), (e - c + 1) * S, y1 - y0, S, kk ? '#ff6a3d' : key(c), kk ? { tex: 'kick' } : {});
          c = e + 1;
        }
      }
      // everything else, cell by cell
      for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
        const ch = at(l, r, c), x = X(c), z = Z(r), alongZ = r % 2 === 1;   // odd rows link north-south
        if (ch === 'D') k.box(x, 0, z, S, LV[1], S, wallCol(0, r, c));
        else if (ch === 'v') k.box(x, y0 + 1.2, z, S, y1 - y0 - 1.2, S, '#b7bcc6');
        else if (ch === 'w') k.box(x, y0, z, S, 1.0, S, '#f2f4f7');
        else if (ch === 'c') k.box(x, y0, z, 1.4, 1.4, 1.4, '#ff8fa3');
        else if (ch === 'm') k.box(x, y0, z, 1.6, 1.6, 1.6, '#f2f4f7');
        else if (ch === 'n') {
          if (alongZ) k.net(x, y0, z, S, y1 - y0, 0.12, '#2f3138');
          else k.net(x, y0, z, 0.12, y1 - y0, S, '#2f3138');
        } else if (ch === 'b') {
          // rope bridge: a narrow plank over the hole, with rope rails you can fall past
          const bw = 1.2, cl = '#ffb37a';
          if (alongZ) {
            slab(k, x, y0, z, bw, S, cl, { t: 0.3 });
            for (const s of [-1, 1]) {
              k.deco(x + s * 0.75, y0 + 1.0, z, 0.06, 0.06, S, '#ffffff');
              k.deco(x + s * 0.75, y0, z - 1.35, 0.1, 1.06, 0.1, '#ffffff');
              k.deco(x + s * 0.75, y0, z + 1.35, 0.1, 1.06, 0.1, '#ffffff');
            }
          } else {
            slab(k, x, y0, z, S, bw, cl, { t: 0.3 });
            for (const s of [-1, 1]) {
              k.deco(x, y0 + 1.0, z + s * 0.75, S, 0.06, 0.06, '#ffffff');
              k.deco(x - 1.35, y0, z + s * 0.75, 0.1, 1.06, 0.1, '#ffffff');
              k.deco(x + 1.35, y0, z + s * 0.75, 0.1, 1.06, 0.1, '#ffffff');
            }
          }
        }
      }
    }

    // trampolines: the middle well throws you all the way to the top floor; the balloon room's
    // one bounces you out through its upstairs south door
    k.pad(X(6), 0, Z(6), 2.2, 2.2, 22, { look: 'tramp', color: '#ff5fa2' });
    k.pad(X(12), 0, Z(4), 2.2, 2.2, 16.5, { look: 'tramp', color: '#ff5fa2', push: { x: 0, z: 2.6 } });

    // stairs (7m, top end flush with the floor they reach): ground -> 4 along the south-west,
    // 4 -> 8 along the north-west
    stairs(k, X(2) + S / 2 - 7, Z(12), '+x', S, 0, 4, '#c3a6ff');
    stairs(k, X(4) + S / 2 - 7, Z(0), '+x', S, 4, 8, '#c3a6ff');

    // the balloon room (north-east, floors 0-7.6): a cloud of balloons
    const rx0 = X(8) - S / 2, rx1 = X(12) + S / 2, rz0 = Z(0) - S / 2, rz1 = Z(4) + S / 2;
    const BAL = ['#ff8fa3', '#ffd166', '#7ed6c8', '#8fb4ff', '#c3a6ff', '#ffb37a', '#9be3a8', '#ff6b6b', '#a8dcef'];
    k.balloons((rx0 + rx1) / 2, 0, (rz0 + rz1) / 2, rx1 - rx0, LV[1] * 2 - T, rz1 - rz0, 42, BAL, { seed: 5 });
  },
});
