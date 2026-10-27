// ============================================================
//  WORLD - loads a map, builds its meshes, handles collision
//  and level features (jump pads, speed strips, water slides).
// ============================================================
const KICK_COLOR = '#ff6a3d';   // every wall-kick surface

const World = {
  map: null,
  boxes: [],
  ramps: [],
  pads: [],
  group: null,
  _anim: [],

  load(scene, map) {
    if (this.group) {
      scene.remove(this.group);
      this.group.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); }
      });
    }
    this.map = map;
    this.boxes = [];
    this.ramps = [];
    this.pads = [];
    this._anim = [];
    this.group = new THREE.Group();
    scene.add(this.group);

    const mats = {};
    const mat = (color, o = {}) => {
      // flat colors only - no textures. `tex` just picks a role:
      //   'kick' = wall-kick surface, always the same bright orange-red so you can spot kick routes
      //   'net'  = see-through wall
      const tex = o.tex || 'grid', kick = tex === 'kick', net = tex === 'net';
      if (kick) color = KICK_COLOR;
      const key = [color, kick ? 'k' : net ? 'n' : '', o.emissive || '', o.opacity || 1, o.ghost ? 'g' : ''].join('|');
      if (!mats[key]) {
        const opacity = net ? 0.35 : o.opacity || 1;
        mats[key] = new THREE.MeshLambertMaterial({
          color,
          emissive: o.emissive || (kick ? '#3a1000' : 0x000000),
          transparent: opacity < 1, opacity, depthWrite: opacity >= 1,
          side: net ? THREE.DoubleSide : THREE.FrontSide,
          polygonOffset: true, polygonOffsetFactor: o.ghost ? -2 : 1, polygonOffsetUnits: o.ghost ? -2 : 1,
        });
      }
      return mats[key];
    };
    // cartoon outlines on every solid piece
    const lineMat = new THREE.LineBasicMaterial({ color: map.outlineColor || '#0d0f14', transparent: true, opacity: 0.7 });
    // static pieces are collected per material and merged into one mesh each after the map is
    // built (a few dozen draw calls instead of hundreds), all outlines into one line mesh
    const buckets = new Map(), edges = [];
    const mesh = (geo, material, o = {}) => {
      const key = material.uuid + (o.noShadow ? '|n' : '');
      if (!buckets.has(key)) buckets.set(key, { material, shadow: !o.noShadow, geos: [] });
      buckets.get(key).geos.push(geo);
      if (map.outline !== false && o.outline !== false) edges.push(new THREE.EdgesGeometry(geo, 25));
    };

    const kit = {
      // solid box: x/z = center, y = bottom
      // opts.rot = turn it around the vertical axis (radians) - collision follows
      box: (x, y, z, w, h, d, color, o = {}) => {
        const rot = o.rot || 0;
        if (!o.ghost) {
          if (rot) {
            const ex = Math.abs(Math.cos(rot)) * w / 2 + Math.abs(Math.sin(rot)) * d / 2;
            const ez = Math.abs(Math.sin(rot)) * w / 2 + Math.abs(Math.cos(rot)) * d / 2;
            this.boxes.push({ min: { x: x - ex, y, z: z - ez }, max: { x: x + ex, y: y + h, z: z + ez }, rot, cx: x, cz: z, hw: w / 2, hd: d / 2 });
          } else {
            this.boxes.push({ min: { x: x - w / 2, y, z: z - d / 2 }, max: { x: x + w / 2, y: y + h, z: z + d / 2 } });
          }
        }
        const g = new THREE.BoxGeometry(w, h, d);
        g.translate(x, y + h / 2, z);
        if (rot) {
            g.translate(-x, -(y + h / 2), -z);
          g.rotateY(rot);
          g.translate(x, y + h / 2, z);
        }
        mesh(g, mat(color, o), o);
      },
      // see-through net wall (solid, you can't pass it)
      net: (x, y, z, w, h, d, color = '#222222') => kit.box(x, y, z, w, h, d, color, { tex: 'net', uv: 0.6, noShadow: true, outline: false }),
      // decoration only (no collision)
      deco: (x, y, z, w, h, d, color, o = {}) => kit.box(x, y, z, w, h, d, color, Object.assign({ ghost: true }, o)),
      // ramp going UP toward dir ('+x', '-x', '+z', '-z'). slick: true = water slide (you always slide)
      ramp: (x, z, w, d, y0, y1, dir, color, o = {}) => {
        const r = { x, z, w, d, y0, y1, dir, slick: !!o.slick, base: o.base || 0 };
        this.ramps.push(r);
        if (o.hidden) return;
        const g = new THREE.BoxGeometry(w, 1, d);
        const pos = g.attributes.position;
        for (let i = 0; i < pos.count; i++) {
          const px = pos.getX(i) + x, pz = pos.getZ(i) + z;
          pos.setXYZ(i, px, pos.getY(i) > 0 ? rampHeight(r, px, pz) : r.base, pz);
        }
        g.computeVertexNormals();
        mesh(g, mat(color, { tex: o.tex || (o.slick ? 'stripes' : undefined) }), o);
      },
      // jump pad sitting on a surface at height y. push = {x, z} sets your sideways speed too
      pad: (x, y, z, w, d, power, o = {}) => {
        this.pads.push({ x, y, z, w, d, power, push: o.push || null });
        if (o.hidden) return;
        const col = o.color || '#39ff88';
        if (o.look === 'tramp') {
          // trampoline: a flat colored mat
          const g = new THREE.BoxGeometry(w, 0.06, d);
          g.translate(x, y + 0.03, z);
          mesh(g, new THREE.MeshLambertMaterial({ color: col, emissive: col, emissiveIntensity: 0.25, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), { noShadow: true, outline: false });
          return;
        }
        // jump pad: dark frame with a softly pulsing glowing top
        const frame = new THREE.BoxGeometry(w + 0.3, 0.1, d + 0.3);
        frame.translate(x, y + 0.05, z);
        mesh(frame, mat('#2b3038', { tex: 'none' }), { noShadow: true });
        const top = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshLambertMaterial({
          color: col, emissive: col, emissiveIntensity: 0.6,
          polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
        top.rotation.x = -Math.PI / 2;
        top.position.set(x, y + 0.105, z);
        this.group.add(top);
        this._anim.push((t) => {
          top.material.emissiveIntensity = 0.45 + 0.3 * (0.5 + 0.5 * Math.sin(t * 4 + x * 0.7 + z * 0.3));
        });
      },
      // see-through water surface (decoration)
      water: (x, y, z, w, d, color = '#4fc3e8', opacity = 0.6) => {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d),
          new THREE.MeshLambertMaterial({ color, transparent: true, opacity, depthWrite: false }));
        m.rotation.x = -Math.PI / 2;
        m.position.set(x, y, z);
        m.renderOrder = 1;      // water first among see-through things
        this.group.add(m);
      },
      // a pile of colorful balls (decoration, e.g. a ball pit)
      balls: (x, y, z, w, d, count, colors) => {
        const im = new THREE.InstancedMesh(new THREE.SphereGeometry(0.16, 8, 6), new THREE.MeshLambertMaterial(), count);
        const m4 = new THREE.Matrix4(), c = new THREE.Color();
        let seed = 7;
        const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
        for (let i = 0; i < count; i++) {
          m4.makeTranslation(x + (rnd() - 0.5) * w, y + rnd() * 0.5, z + (rnd() - 0.5) * d);
          im.setMatrixAt(i, m4);
          im.setColorAt(i, c.set(colors[i % colors.length]));
        }
        this.group.add(im);
      },
    };

    map.build(kit);

    for (const { material, shadow, geos } of buckets.values()) {
      const m = new THREE.Mesh(mergeGeometries(geos), material);
      m.castShadow = shadow;
      m.receiveShadow = true;
      m.matrixAutoUpdate = false;
      this.group.add(m);
    }
    if (edges.length) {
      const l = new THREE.LineSegments(mergeGeometries(edges), lineMat);
      l.matrixAutoUpdate = false;
      this.group.add(l);
    }
  },

  animate(t, dt) {
    for (const f of this._anim) f(t, dt);
  },

  // first box the player's body overlaps, or null
  overlap(px, py, pz, h) {
    const r = CONFIG.move.radius, E = 1e-4;
    for (const b of this.boxes) {
      if (px + r > b.min.x + E && px - r < b.max.x - E &&
          pz + r > b.min.z + E && pz - r < b.max.z - E &&
          py + h > b.min.y + E && py < b.max.y - E) {
        if (!b.rot || this._rotHit(b, px, pz, r - E)) return b;
      }
    }
    return null;
  },

  // rotated box: player as a circle in the box's own frame
  _local(b, px, pz) {
    const c = Math.cos(b.rot), s = Math.sin(b.rot), dx = px - b.cx, dz = pz - b.cz;
    const lx = dx * c - dz * s, lz = dx * s + dz * c;
    return { lx, lz, qx: clamp(lx, -b.hw, b.hw), qz: clamp(lz, -b.hd, b.hd), c, s };
  },
  _rotHit(b, px, pz, r) {
    const L = this._local(b, px, pz);
    return (L.lx - L.qx) ** 2 + (L.lz - L.qz) ** 2 < r * r;
  },
  // push the player out of a rotated box, sideways
  _pushOut(p, b) {
    const r = CONFIG.move.radius, L = this._local(b, p.pos.x, p.pos.z);
    let nx, nz, push;
    if (L.lx === L.qx && L.lz === L.qz) {
      const px = b.hw - Math.abs(L.lx), pz = b.hd - Math.abs(L.lz);
      if (px < pz) { nx = Math.sign(L.lx) || 1; nz = 0; push = px + r; } else { nx = 0; nz = Math.sign(L.lz) || 1; push = pz + r; }
    } else {
      const dx = L.lx - L.qx, dz = L.lz - L.qz, d = Math.hypot(dx, dz);
      nx = dx / d; nz = dz / d; push = r - d;
    }
    push += 0.002;
    // local -> world (inverse rotation)
    const wx = nx * L.c + nz * L.s, wz = -nx * L.s + nz * L.c;
    p.pos.x += wx * push;
    p.pos.z += wz * push;
    const vn = p.vel.x * wx + p.vel.z * wz;
    if (vn < 0) { p.vel.x -= wx * vn; p.vel.z -= wz * vn; }
  },

  // height of the highest surface under (x, z) at or below y (-Infinity over the void)
  floorBelow(x, y, z) {
    let best = -Infinity;
    for (const b of this.boxes) {
      const t = b.max.y;
      if (t > y || t <= best || x < b.min.x || x > b.max.x || z < b.min.z || z > b.max.z) continue;
      if (!b.rot || this._rotHit(b, x, z, 0.01)) best = t;
    }
    for (const r of this.ramps) {
      if (!inFootprint(r, x, z, 0)) continue;
      const t = rampHeight(r, x, z);
      if (t <= y && t > best) best = t;
    }
    return best;
  },

  // free space above the player's head (for capping jumps under low ceilings)
  ceilingGap(p) {
    const r = CONFIG.move.radius, top = p.pos.y + p.h;
    let gap = Infinity;
    for (const b of this.boxes) {
      if (b.min.y < top - 0.05 || b.min.y - top > 4) continue;
      if (p.pos.x + r > b.min.x && p.pos.x - r < b.max.x && p.pos.z + r > b.min.z && p.pos.z - r < b.max.z &&
          (!b.rot || this._rotHit(b, p.pos.x, p.pos.z, r))) gap = Math.min(gap, b.min.y - top);
    }
    for (const rp of this.ramps) {
      if (rp.base > top - 0.05 && inFootprint(rp, p.pos.x, p.pos.z, r)) gap = Math.min(gap, rp.base - top);
    }
    return gap;
  },

  canStand(p) {
    return !this.overlap(p.pos.x, p.pos.y, p.pos.z, CONFIG.move.standHeight);
  },

  move(p, dt) {
    const v = p.vel, pos = p.pos;
    const wasGrounded = p.grounded;
    p.grounded = false;
    p.groundRamp = null;

    this._moveH(p, 'x', v.x * dt, wasGrounded);
    this._moveH(p, 'z', v.z * dt, wasGrounded);

    pos.y += v.y * dt;
    for (let i = 0; i < 3; i++) {
      const b = this.overlap(pos.x, pos.y, pos.z, p.h);
      if (!b) break;
      if (v.y <= 0) { pos.y = b.max.y; p.grounded = true; }
      else pos.y = b.min.y - p.h - 0.001;
      v.y = 0;
    }

    for (const r of this.ramps) {
      if (!inFootprint(r, pos.x, pos.z, 0)) continue;
      const s = rampHeight(r, pos.x, pos.z);
      const snap = (wasGrounded && v.y <= 0) ? 0.4 : 0.02;
      if (pos.y <= s + snap && pos.y >= s - 0.7) {
        pos.y = s;
        if (v.y < 0) v.y = 0;
        p.grounded = true;
        p.groundRamp = r;
      }
    }
  },

  _moveH(p, ax, d, wasGrounded) {
    if (d === 0) return;
    const M = CONFIG.move, pos = p.pos;
    const before = pos[ax];
    pos[ax] += d;
    for (let i = 0; i < 3; i++) {
      const b = this.overlap(pos.x, pos.y, pos.z, p.h);
      if (!b) break;
      const rise = b.max.y - pos.y;
      if (wasGrounded && rise > 0 && rise <= M.stepHeight && !this.overlap(pos.x, b.max.y + 0.001, pos.z, p.h)) {
        pos.y = b.max.y + 0.001;
        continue;
      }
      if (b.rot) { this._pushOut(p, b); continue; }
      pos[ax] = d > 0 ? b.min[ax] - M.radius - 0.001 : b.max[ax] + M.radius + 0.001;
      p.vel[ax] = 0;
    }
    // ramp sides act like walls when you're well below the surface.
    // Only block moving INTO a ramp - if you're already overlapping one, let you walk out.
    for (const r of this.ramps) {
      if (!this._underRamp(r, pos.x, pos.z, pos.y, p.h)) continue;
      const prev = { x: pos.x, z: pos.z };
      prev[ax] = before;
      if (this._underRamp(r, prev.x, prev.z, pos.y, p.h)) continue;
      const half = ax === 'x' ? r.w / 2 : r.d / 2;
      pos[ax] = d > 0 ? r[ax] - half - M.radius - 0.001 : r[ax] + half + M.radius + 0.001;
      p.vel[ax] = 0;
      break;
    }
  },

  // is a body at (x, y, z) inside the solid part of ramp r?
  _underRamp(r, x, z, y, h) {
    if (!inFootprint(r, x, z, CONFIG.move.radius) || y + h <= r.base) return false;
    const cx = clamp(x, r.x - r.w / 2, r.x + r.w / 2);
    const cz = clamp(z, r.z - r.d / 2, r.z + r.d / 2);
    return y < rampHeight(r, cx, cz) - 0.5;
  },

  // nearest wall within kicking distance while airborne: { n: {x,z}, box }
  probeWall(p) {
    const r = CONFIG.move.radius, D = CONFIG.move.wallDetect;
    const { x, y, z } = p.pos;
    let best = null, bd = Infinity;
    const test = (g, nx, nz, b) => {
      if (g > -0.05 && g < D && g < bd) { bd = g; best = { n: { x: nx, z: nz }, box: b }; }
    };
    for (const b of this.boxes) {
      if (!(y + 0.3 < b.max.y && y + p.h - 0.2 > b.min.y)) continue;
      if (b.rot) {
        const L = this._local(b, x, z), dx = L.lx - L.qx, dz = L.lz - L.qz, dist = Math.hypot(dx, dz);
        if (dist > 1e-4) {
          const nx = dx / dist, nz = dz / dist;
          test(dist - r, nx * L.c + nz * L.s, -nx * L.s + nz * L.c, b);
        }
        continue;
      }
      if (z + r > b.min.z && z - r < b.max.z) {
        test((x - r) - b.max.x, 1, 0, b);
        test(b.min.x - (x + r), -1, 0, b);
      }
      if (x + r > b.min.x && x - r < b.max.x) {
        test((z - r) - b.max.z, 0, 1, b);
        test(b.min.z - (z + r), 0, -1, b);
      }
    }
    return best;
  },

  ledgeClear(p, wall) {
    const r = CONFIG.move.radius;
    const x = p.pos.x - wall.n.x * (r + 0.3);
    const z = p.pos.z - wall.n.z * (r + 0.3);
    return !this.overlap(x, wall.box.max.y + 0.02, z, CONFIG.move.crouchHeight);
  },

  rampDownhill(r) {
    const len = r.dir[1] === 'x' ? r.w : r.d;
    const slope = (r.y1 - r.y0) / len;
    const sin = slope / Math.sqrt(1 + slope * slope);
    const sign = r.dir[0] === '+' ? -1 : 1;
    return r.dir[1] === 'x' ? { x: sign, z: 0, sin } : { x: 0, z: sign, sin };
  },

  padAt(p) {
    for (const s of this.pads) {
      if (Math.abs(p.pos.x - s.x) < s.w / 2 && Math.abs(p.pos.z - s.z) < s.d / 2 &&
          p.pos.y >= s.y - 0.05 && p.pos.y <= s.y + 0.25 && p.vel.y <= 0.5) return s;
    }
    return null;
  },
};

// join geometries that share the same attributes into one (indexed) geometry
function mergeGeometries(geos) {
  const names = Object.keys(geos[0].attributes);
  let verts = 0;
  for (const g of geos) verts += g.attributes.position.count;
  const out = new THREE.BufferGeometry(), arrays = {};
  for (const n of names) arrays[n] = new Float32Array(verts * geos[0].attributes[n].itemSize);
  const indexed = geos[0].index !== null;
  let icount = 0;
  if (indexed) for (const g of geos) icount += g.index.count;
  const index = indexed ? (verts > 65535 ? new Uint32Array(icount) : new Uint16Array(icount)) : null;
  let vo = 0, io = 0;
  for (const g of geos) {
    for (const n of names) {
      const a = g.attributes[n];
      arrays[n].set(a.array, vo * a.itemSize);
    }
    if (indexed) {
      const src = g.index.array;
      for (let i = 0; i < src.length; i++) index[io + i] = src[i] + vo;
      io += src.length;
    }
    vo += g.attributes.position.count;
    g.dispose();
  }
  for (const n of names) out.setAttribute(n, new THREE.BufferAttribute(arrays[n], geos[0].attributes[n].itemSize));
  if (index) out.setIndex(new THREE.BufferAttribute(index, 1));
  out.computeBoundingSphere();
  return out;
}

function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

function inFootprint(r, x, z, pad) {
  return Math.abs(x - r.x) < r.w / 2 + pad && Math.abs(z - r.z) < r.d / 2 + pad;
}

function rampHeight(r, x, z) {
  let t;
  switch (r.dir) {
    case '+x': t = (x - (r.x - r.w / 2)) / r.w; break;
    case '-x': t = ((r.x + r.w / 2) - x) / r.w; break;
    case '+z': t = (z - (r.z - r.d / 2)) / r.d; break;
    default:   t = ((r.z + r.d / 2) - z) / r.d; break;
  }
  return r.y0 + (r.y1 - r.y0) * clamp(t, 0, 1);
}
