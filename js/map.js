// ============================================================
//  MAP KIT - every map lives in js/maps/<name>.js and calls defineMap().
//
//  Inside build(k) you can use:
//    k.box(x, y, z, width, height, depth, color, opts)   solid block. x/z = center, y = BOTTOM
//         opts.rot = turn it around the vertical axis (radians), collision follows
//    k.deco(...same...)                                   looks like a box, but you walk through it
//    k.ramp(x, z, width, depth, lowY, highY, upDir, color, opts)
//         upDir = which way it goes UP: '+x' '-x' '+z' '-z'
//         opts.slick = true   -> water slide: you always slide on it
//         opts.base  = height of the ramp's bottom (for ramps on top of things)
//    k.pad(x, y, z, width, depth, power, opts)            jump pad on a surface at height y
//         opts.push = {x, z}  -> also launches you sideways (m/s)
//         opts.hidden = true  -> invisible (bouncy floors)
//    k.water(x, y, z, width, depth, color, opacity)       see-through water surface
//    k.balls(x, y, z, width, depth, count, colors)        pile of balls
//    k.net(x, y, z, width, height, depth, color)          see-through net wall
//    k.wall(x, y, z, width, height, depth)                invisible wall (collision only, can't be wall-kicked)
//    k.bellRope(x, y, z, length, color)                   rope hanging from (x, y, z): walk into it and it swings + rings
//  No up/down or sliding platforms please (they feel clunky) - spinning ones (k.mover type 'spin') are fine.
//    k.mover(x, y, z, width, height, depth, color, motion) moving solid box (rides you along, shoves you)
//         motion = { type: 'slide', dx, dy, dz, period, phase }  glides out by (dx,dy,dz) and back
//                  { type: 'spin', speed, phase }                 spins around its center (rad/s)
//    k.balloons(x, y, z, width, height, depth, count, colors)  room of floating balloons that dodge players
//         (x/z = center of the room, y = floor). Soft: never block anyone.
//
//  Box opts: { tex: 'kick' (wall-kick surface: always bright orange-red) | 'net' (see-through)
//              | 'nokick' (frosted cyan glass: can't be wall-kicked or hung on - always the same look),
//              noShadow: true, emissive: '#color', opacity: 0..1 }
//  Everything is flat color - other tex/uv values are left over from old textures and do nothing.
//
//  Helpers below: ground(), enclose(), slab(), posts(), stairs(), tower(), bridge(),
//  kickShaft(), pile(), container().
//
//  Environments (env in defineMap):
//    'void'    black void, steel rafters + spotlights
//    'indoor'  build walls + ceiling with enclose(); ceiling lights
//    'sky'     daylight sky with sea at `sea` height
//    'fog'     just the sky color + fog. fogDensity: 0.05 = real exponential fog
//    'space'   black sky, stars and a planet
//
//  Other defineMap fields:
//    move: { gravity: 13, ... }     override CONFIG.move values on this map (e.g. low gravity)
//    centerSpot: [x, y, z]          where a dropped crown lands (King of the Tag). Default seekerSpawn
//    wrap: 40                       endless map: the 40x40 tile (centered on 0,0) repeats forever -
//                                   walk off an edge and you come in the other side. wrapRings = how
//                                   many copies to draw around it (default 1). Pair it with fog.
//    kind: 'race'                   a race course instead of a tag map, with
//    race: { yaw, finish: { x, y, z, w, h, d }, route: [[x, y, z], ...] }
//         spawns = the start line, finish = the goal box (y = bottom), route = the course's path
//         from start to finish (used for "meters to go" on the leaderboard)
//
//  Handy numbers for designing:
//    - a jump clears ~1.6m; standing height 1.8 -> keep ceilings 3.6m+ above any floor
//    - floors are 4m apart (FLOOR). Jump + mantle reaches ledges ~3.4m up, so a full floor
//      needs stairs, a pad, or a kick shaft to climb
//    - a running jump crosses ~6m gaps, a slide-jump more
//    - kick shafts: two walls 2.6-3m apart, use kickShaft()
//    - a pad with power P launches you about P*P/52 meters up
// ============================================================
const MAPS = [];
const FLOOR = 4;

function defineMap(def) {
  MAPS.push(Object.assign({
    env: 'void',
    sky: '#000000',             // background + fog color
    fog: [45, 130],
    hemi: ['#dff2ff', '#46505e', 0.75],
    sun: [0.8, 30, 60, 20],     // intensity, direction x/y/z
    size: 50,                   // half-size of the area that gets shadows
    killY: -15,                 // fall below this and the void gets you
    menuCam: { r: 40, y: 22 },  // orbit camera behind the main menu
    kind: 'tag',
  }, def));
}

function getMap(id) {
  return MAPS.find((m) => m.id === id) || MAPS[0];
}

// floating floor (top at y = 0) centered on x/z, with a darker edge band underneath
function ground(k, w, d, color, o = {}, x = 0, z = 0) {
  k.box(x, -1.2, z, w, 1.2, d, color, o);
  k.deco(x, -1.7, z, w - 0.4, 0.4, d - 0.4, '#111318', { tex: 'none' });
}

// four walls + a ceiling around a w x d floor centered on 0,0
function enclose(k, w, d, h, wall, ceiling, o = {}) {
  const t = 1, look = { tex: o.tex || 'tiles', uv: o.uv || 0.5 };
  k.box(0, 0, -d / 2 - t / 2, w + 2 * t, h, t, wall, look);
  k.box(0, 0, d / 2 + t / 2, w + 2 * t, h, t, wall, look);
  k.box(-w / 2 - t / 2, 0, 0, t, h, d, wall, look);
  k.box(w / 2 + t / 2, 0, 0, t, h, d, wall, look);
  k.box(0, h, 0, w + 2 * t, 0.6, d + 2 * t, ceiling, Object.assign({ noShadow: true }, look));
}

// thin floor slab whose TOP is at height `top`
function slab(k, x, top, z, w, d, color, o = {}) {
  k.box(x, top - (o.t || 0.5), z, w, o.t || 0.5, d, color, o);
}

// support posts from y0 up to y1 at each [x, z]
function posts(k, list, y0, y1, color, size = 0.4) {
  for (const [x, z] of list) k.box(x, y0, z, size, y1 - y0, size, color, { tex: 'none' });
}

// staircase. (x, z) = center of the bottom edge, dir = direction it climbs.
// The steps are just looks - you walk up a smooth hidden ramp, so it never feels bumpy. The ramp
// runs along the step noses (starting one step before the stairs), so feet never sink into a step.
function stairs(k, x, z, dir, width, y0, y1, color, o = {}) {
  const n = Math.ceil((y1 - y0) / 0.4), run = o.run || 0.7, sg = dir[0] === '+' ? 1 : -1, L = n * run;
  const vis = Object.assign({}, o, { ghost: true });
  for (let i = 0; i < n; i++) {
    const top = y0 + (y1 - y0) * (i + 1) / n, off = (i + 0.5) * run * sg;
    if (dir[1] === 'x') k.box(x + off, y0, z, run, top - y0, width - 0.04, color, vis);
    else k.box(x, y0, z + off, width - 0.04, top - y0, run, color, vis);
  }
  const mid = sg * (n - 2) * run / 2, top = sg * (n - 0.5) * run, H = { hidden: true, base: y0 };
  if (dir[1] === 'x') {
    k.ramp(x + mid, z, L, width, y0, y1, dir, color, H);
    k.ramp(x + top, z, run, width, y1, y1, dir, color, H);
  } else {
    k.ramp(x, z + mid, width, L, y0, y1, dir, color, H);
    k.ramp(x, z + top, width, run, y1, y1, dir, color, H);
  }
}

// slab (top at `top`) covering x0..x1 / z0..z1 with an optional rectangular hole [hx0, hx1, hz0, hz1]
function slabHole(k, x0, x1, z0, z1, top, hole, color, o = {}) {
  const t = o.t || 0.4;
  const put = (a0, a1, b0, b1) => {
    if (a1 - a0 > 0.01 && b1 - b0 > 0.01) k.box((a0 + a1) / 2, top - t, (b0 + b1) / 2, a1 - a0, t, b1 - b0, color, o);
  };
  if (!hole) return put(x0, x1, z0, z1);
  const [hx0, hx1, hz0, hz1] = hole;
  put(x0, hx0, z0, z1);
  put(hx1, x1, z0, z1);
  put(hx0, hx1, z0, hz0);
  put(hx0, hx1, hz1, z1);
}

// Open multi-floor structure (min 10 x 6) with switchback stairs up the inside.
//   x, z       center        w, d     size (x, z)
//   floors     floors above `base`, each `fh` tall (default 4). The roof is walkable.
//   floor      false = don't build a slab at `base` (when it already stands on a roof)
//   flip       stairs run along the +z side instead of -z
//   walls      sides to wall in, e.g. ['+x', '-z']. Each floor gets a doorway in the middle of each wall
//   color / wall / stair / post / tex / uv    looks
function tower(k, o) {
  const { x, z, w, d, floors, base = 0, fh = FLOOR, color = '#cccccc', flip = false } = o;
  const look = { tex: o.tex, uv: o.uv };
  const x0 = x - w / 2, x1 = x + w / 2, z0 = z - d / 2, z1 = z + d / 2;
  const run = 0.7, L = Math.ceil(fh / 0.4) * run;
  const sA = flip ? [z1 - 2, z1] : [z0, z0 + 2], sB = flip ? [z1 - 4, z1 - 2] : [z0 + 2, z0 + 4];
  const xs = x0 + 1.3, xe = xs + L;
  if (base > 0 && o.floor !== false) slabHole(k, x0, x1, z0, z1, base, null, color, look);
  for (let i = 0; i < floors; i++) {
    const y0 = base + i * fh, y1 = y0 + fh, even = i % 2 === 0, s = even ? sA : sB;
    stairs(k, even ? xs : xe, (s[0] + s[1]) / 2, even ? '+x' : '-x', 2, y0, y1, o.stair || color, Object.assign({ run }, look));
    slabHole(k, x0, x1, z0, z1, y1, [xs, xe, s[0], s[1]], color, look);
    for (const side of o.walls || []) {
      const t = 0.3, gap = 1.3, top = y1 - 0.4, ax = side[1] === 'x', sg = side[0] === '+' ? 1 : -1;
      const c = ax ? z : x, half = ax ? d / 2 : w / 2, pos = ax ? (sg > 0 ? x1 - t / 2 : x0 + t / 2) : (sg > 0 ? z1 - t / 2 : z0 + t / 2);
      const seg = (a, b) => ax ? k.box(pos, y0, (a + b) / 2, t, top - y0, b - a, o.wall || color, look)
                               : k.box((a + b) / 2, y0, pos, b - a, top - y0, t, o.wall || color, look);
      const trim = ax ? 0.32 : 0.02;   // x-side walls stop at the z-side walls' inner faces
      seg(c - half + trim, c - gap);
      seg(c + gap, c + half - trim);
      if (ax) k.box(pos, y0 + 2.6, c, t, top - y0 - 2.6, 2 * gap, o.wall || color, look);
      else k.box(c, y0 + 2.6, pos, 2 * gap, top - y0 - 2.6, t, o.wall || color, look);
    }
  }
  const pc = o.post || '#888888', top = base + floors * fh - 0.4;
  posts(k, [[x0 + 0.2, z0 + 0.2], [x1 - 0.2, z0 + 0.2], [x0 + 0.2, z1 - 0.2], [x1 - 0.2, z1 - 0.2]], base, top, pc, 0.35);
}

// straight walkway between two points that share an x or a z
function bridge(k, ax, az, bx, bz, top, width, color, o = {}) {
  if (ax === bx) slab(k, ax, top, (az + bz) / 2, width, Math.abs(bz - az), color, Object.assign({ t: 0.4 }, o));
  else slab(k, (ax + bx) / 2, top, az, Math.abs(bx - ax), width, color, Object.assign({ t: 0.4 }, o));
}

// Two parallel walls `gap` apart that you climb by wall-kicking back and forth.
// The walls run along `axis` ('x' or 'z') for `len`, centered on x/z, from y0 to y1.
// Striped so you can spot them. Put the top (y1) level with the floor you want to reach.
function kickShaft(k, x, z, axis, len, y0, y1, color, gap = 2.8) {
  const t = 0.5, off = gap / 2 + t / 2, K = { tex: 'kick', uv: 0.5 };
  if (axis === 'x') {
    k.box(x, y0, z - off, len, y1 - y0, t, color, K);
    k.box(x, y0, z + off, len, y1 - y0, t, color, K);
  } else {
    k.box(x - off, y0, z, t, y1 - y0, len, color, K);
    k.box(x + off, y0, z, t, y1 - y0, len, color, K);
  }
}

// brick-stacked shipping containers: each layer is two 6m boxes side by side, alternating direction.
// Climb it layer by layer (each layer overhangs the one below on two sides).
// hollow = list of layer numbers whose containers are open tunnels
function pile(k, x, z, layers, o = {}) {
  const C = 2.6, W = 2.4, colors = o.colors || ['#a8322d', '#23408e'];
  for (let l = 0; l < layers; l++) {
    const alongX = (l + (o.start || 0)) % 2 === 0;
    for (const s of [-1, 1]) {
      const cx = alongX ? x : x + s * W / 2, cz = alongX ? z + s * W / 2 : z;
      container(k, cx, l * C, cz, alongX ? 'x' : 'z', 6, (o.hollow || []).includes(l), colors[(l + (s > 0 ? 1 : 0) + (o.seed || 0)) % colors.length]);
    }
  }
}

// darken a '#rrggbb' color (k < 1) or lighten it (k > 1)
function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16), c = (v) => Math.max(0, Math.min(255, Math.round(v * k)));
  return '#' + [n >> 16, (n >> 8) & 255, n & 255].map((v) => c(v).toString(16).padStart(2, '0')).join('');
}

// one shipping container. bottom at y. hollow ones are open at both ends (run through them).
// rot = extra turn (radians) for skewed containers
function container(k, x, y, z, orient, L, hollow, color, rot = 0) {
  const C = 2.6, W = 2.4, T = 0.15, R = { tex: 'ribs', uv: 0.35, rot }, along = orient === 'x';
  const sx = along ? L : W, sz = along ? W : L;
  // offset a point (lx, lz) from the container center by the skew rotation
  const at = (lx, lz) => [x + lx * Math.cos(rot) + lz * Math.sin(rot), z - lx * Math.sin(rot) + lz * Math.cos(rot)];
  const part = (lx, ly, lz, w, h, d, c, o) => { const [px, pz] = at(lx, lz); return (o.ghost ? k.deco : k.box)(px, y + ly, pz, w, h, d, c, Object.assign({ rot }, o)); };
  if (!hollow) {
    part(0, 0, 0, sx, C, sz, color, R);
    // door panels on the ends: a slightly darker skin, only 2cm proud of the end
    const dc = shade(color, 0.78);
    for (const e of [-1, 1]) {
      if (along) part(e * (L / 2 + 0.01), 0.06, 0, 0.02, C - 0.12, W - 0.1, dc, { ghost: true });
      else part(0, 0.06, e * (L / 2 + 0.01), W - 0.1, C - 0.12, 0.02, dc, { ghost: true });
    }
    return;
  }
  part(0, 0, 0, sx, T, sz, color, R);
  part(0, C - T, 0, sx, T, sz, color, R);
  const DK = '#121620', LO = { ghost: true, tex: 'ribs', outline: false }, off = W / 2 - T - 0.05;
  if (along) {
    part(0, 0, -W / 2 + T / 2, L, C, T, color, R);
    part(0, 0, W / 2 - T / 2, L, C, T, color, R);
    part(0, T + 0.03, -off, L - 0.06, C - 2 * T - 0.06, 0.02, DK, LO);
    part(0, T + 0.03, off, L - 0.06, C - 2 * T - 0.06, 0.02, DK, LO);
  } else {
    part(-W / 2 + T / 2, 0, 0, T, C, L, color, R);
    part(W / 2 - T / 2, 0, 0, T, C, L, color, R);
    part(-off, T + 0.03, 0, 0.02, C - 2 * T - 0.06, L - 0.06, DK, LO);
    part(off, T + 0.03, 0, 0.02, C - 2 * T - 0.06, L - 0.06, DK, LO);
  }
}
