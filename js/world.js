// ============================================================
//  WORLD - loads a map, builds its meshes, handles collision
//  and level features (jump pads, speed strips, water slides).
// ============================================================
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
      const tex = o.tex || 'grid';
      const key = [color, tex, o.emissive || '', o.opacity || 1, o.ghost ? 'g' : ''].join('|');
      if (!mats[key]) {
        const net = tex === 'net';
        mats[key] = new THREE.MeshLambertMaterial({
          color: tex === 'patch' ? '#ffffff' : color,   // patch textures carry their own colors
          map: tex === 'none' ? null : makeTexture(tex),
          emissive: o.emissive || 0x000000,
          transparent: net || (o.opacity || 1) < 1, opacity: o.opacity || 1,
          alphaTest: net ? 0.5 : 0, side: net ? THREE.DoubleSide : THREE.FrontSide,
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
        if (o.uv !== 'box') worldUV(g, o.uv);   // 'box' = stretch the texture once over each face
        if (rot) {
          // texture is laid out before turning, so it turns with the box
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
        worldUV(g, o.uv);
        mesh(g, mat(color, { tex: o.tex || (o.slick ? 'stripes' : undefined) }), o);
      },
      // jump pad sitting on a surface at height y. push = {x, z} sets your sideways speed too
      pad: (x, y, z, w, d, power, o = {}) => {
        this.pads.push({ x, y, z, w, d, power, push: o.push || null });
        if (o.hidden) return;
        const col = o.color || '#39ff88';
        if (o.look === 'tramp') {
          // trampoline: dark springy mat with a colored safety border
          const tex = makeTexture('trampmat');
          const g = new THREE.BoxGeometry(w, 0.06, d);
          g.translate(x, y + 0.03, z);
          mesh(g, new THREE.MeshLambertMaterial({ color: col, map: tex, emissive: col, emissiveMap: tex, emissiveIntensity: 0.25, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), { noShadow: true, outline: false });
          return;
        }
        // jump pad: steel frame, glowing disc with arrows, faint light column
        const frame = new THREE.BoxGeometry(w + 0.3, 0.1, d + 0.3);
        frame.translate(x, y + 0.05, z);
        mesh(frame, mat('#2b3038', { tex: 'grid', uv: 1 }), { noShadow: true });
        const tex = makeTexture('jumppad');
        // solid (not see-through), so it never swaps in front of / behind water as you move
        const top = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshLambertMaterial({
          color: col, map: tex, emissive: col, emissiveMap: tex, emissiveIntensity: 0.6,
          polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
        top.rotation.x = -Math.PI / 2;
        top.position.set(x, y + 0.105, z);
        this.group.add(top);
        const r = Math.min(w, d) * 0.42;
        const beam = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.8, r, 2.4, 20, 1, true),
          new THREE.MeshBasicMaterial({ color: col, map: makeTexture('fadeup'), transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
        beam.position.set(x, y + 1.3, z);
        beam.renderOrder = 3;   // always after water, so the order can't flicker
        this.group.add(beam);
        this._anim.push((t) => {
          const k = 0.5 + 0.5 * Math.sin(t * 4 + x * 0.7 + z * 0.3);
          top.material.emissiveIntensity = 0.45 + 0.35 * k;
          beam.material.opacity = 0.18 + 0.22 * k;
        });
      },
      // see-through water surface (decoration)
      water: (x, y, z, w, d, color = '#4fc3e8', opacity = 0.6) => {
        const tex = makeTexture('water');
        tex.repeat.set(w / 6, d / 6);
        const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d),
          new THREE.MeshLambertMaterial({ color, map: tex, transparent: true, opacity }));
        m.rotation.x = -Math.PI / 2;
        m.position.set(x, y, z);
        m.renderOrder = 1;      // water first among see-through things
        this.group.add(m);
        this._anim.push((t, dt) => { tex.offset.x += dt * 0.03; tex.offset.y += dt * 0.02; });
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

// texture coordinates from world position so patterns are the same size everywhere
function worldUV(geo, scale = 0.25) {
  const p = geo.attributes.position, n = geo.attributes.normal, uv = geo.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    let u, v;
    if (ay >= ax && ay >= az) { u = p.getX(i); v = p.getZ(i); }
    else if (ax >= az) { u = p.getZ(i); v = p.getY(i); }
    else { u = p.getX(i); v = p.getY(i); }
    uv.setXY(i, u * scale, v * scale);
  }
  uv.needsUpdate = true;
}

// Procedural textures. Each one is white/grey so the box color tints it.
function makeTexture(kind) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, 128, 128);
  const dark = (a) => `rgba(0,0,0,${a})`;
  switch (kind) {
    case 'ribs':      // corrugated metal (shipping containers)
      for (let x = 0; x < 128; x += 16) {
        g.fillStyle = dark(0.16); g.fillRect(x, 0, 6, 128);
        g.fillStyle = 'rgba(255,255,255,0.5)'; g.fillRect(x + 7, 0, 2, 128);
      }
      break;
    case 'doors':     // shipping container end: two doors, lock bars, hinge strip
      g.fillStyle = dark(0.12); g.fillRect(0, 0, 128, 10); g.fillRect(0, 118, 128, 10);
      g.fillStyle = dark(0.35); g.fillRect(62, 0, 4, 128);
      for (const x of [22, 44, 84, 106]) { g.fillStyle = dark(0.3); g.fillRect(x, 6, 5, 116); g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(x + 5, 6, 1, 116); }
      g.fillStyle = dark(0.4); for (const x of [18, 40, 80, 102]) g.fillRect(x, 58, 12, 8);
      break;
    case 'jumppad': { // dark ring, bright disc, three up-chevrons
      g.fillStyle = '#3a3a3a'; g.fillRect(0, 0, 128, 128);
      const gr = g.createRadialGradient(64, 64, 6, 64, 64, 56);
      gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.75, '#dddddd'); gr.addColorStop(1, '#888888');
      g.fillStyle = gr; g.beginPath(); g.arc(64, 64, 54, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#1a1a1a'; g.lineWidth = 5; g.beginPath(); g.arc(64, 64, 56, 0, Math.PI * 2); g.stroke();
      g.strokeStyle = '#555555'; g.lineWidth = 9; g.lineCap = 'round'; g.lineJoin = 'round';
      for (const y of [44, 64, 84]) { g.beginPath(); g.moveTo(42, y + 10); g.lineTo(64, y - 8); g.lineTo(86, y + 10); g.stroke(); }
      break;
    }
    case 'trampmat':  // woven dark mat + colored border
      g.fillStyle = '#ffffff'; g.fillRect(0, 0, 128, 128);
      g.fillStyle = '#1b1d26'; g.fillRect(10, 10, 108, 108);
      g.strokeStyle = 'rgba(255,255,255,0.07)'; g.lineWidth = 1;
      for (let i = 10; i < 118; i += 6) { g.beginPath(); g.moveTo(i, 10); g.lineTo(i, 118); g.moveTo(10, i); g.lineTo(118, i); g.stroke(); }
      g.fillStyle = '#ffffff'; for (let i = 18; i < 118; i += 16) for (const e of [4, 124]) { g.fillRect(i, e - 1, 6, 2); g.fillRect(e - 1, i, 2, 6); }
      break;
    case 'fadeup':    // vertical fade for light columns (bright at the bottom)
      g.clearRect(0, 0, 128, 128);
      { const gr = g.createLinearGradient(0, 128, 0, 0); gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); }
      break;
    case 'road':      // asphalt with a dashed center line (runs along u)
      g.fillStyle = '#5c5c5c'; g.fillRect(0, 0, 128, 128);
      g.fillStyle = 'rgba(255,255,255,0.05)'; for (let i = 0; i < 60; i++) g.fillRect((i * 37) % 128, (i * 61) % 128, 2, 2);
      g.fillStyle = '#e0c040'; g.fillRect(0, 62, 64, 4);
      break;
    case 'windows':   // building facade: rows of windows, some lit
      g.fillStyle = '#5a5a5a'; g.fillRect(0, 0, 128, 128);
      for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) {
        g.fillStyle = (x + y) % 2 ? '#ffe9a8' : '#2a2f3a';
        g.fillRect(10 + x * 64, 12 + y * 64, 44, 40);
      }
      break;
    case 'patch': {   // big multicolor panels (play place)
      const P = ['#2f7be0', '#e2383b', '#43c54a', '#b75de0', '#ffc23c', '#ff8a1f'];
      for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
        g.fillStyle = P[(x * 7 + y * 3 + ((x * y) % 4)) % P.length];
        g.fillRect(x * 32, y * 32, 32, 32);
      }
      g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 2;
      for (let i = 0; i <= 128; i += 32) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 128); g.moveTo(0, i); g.lineTo(128, i); g.stroke(); }
      break;
    }
    case 'net':       // diamond mesh, transparent between the strands
      g.clearRect(0, 0, 128, 128);
      g.strokeStyle = '#ffffff'; g.lineWidth = 5;
      for (let i = -128; i <= 128; i += 32) {
        g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 128, 128); g.stroke();
        g.beginPath(); g.moveTo(i + 128, 0); g.lineTo(i, 128); g.stroke();
      }
      break;
    case 'kick':      // wall-kick surfaces: bold diagonal stripes so you know you can kick them
      g.fillStyle = dark(0.28);
      for (let i = -128; i < 256; i += 32) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 16, 0); g.lineTo(i + 16 - 128, 128); g.lineTo(i - 128, 128); g.fill(); }
      break;
    case 'tiles':     // small square bathroom tiles
      g.fillStyle = dark(0.16);
      for (let i = 0; i <= 128; i += 32) { g.fillRect(i - 1, 0, 2, 128); g.fillRect(0, i - 1, 128, 2); }
      break;
    case 'planks':    // wooden deck
      for (let y = 0; y < 128; y += 21) {
        g.fillStyle = dark(0.2); g.fillRect(0, y, 128, 2);
        g.fillStyle = dark(0.07); g.fillRect(((y * 7) % 100), y + 2, 2, 19);
      }
      break;
    case 'foam':      // padded mats
      g.fillStyle = dark(0.12);
      g.fillRect(0, 0, 128, 3); g.fillRect(0, 0, 3, 128);
      g.fillStyle = 'rgba(255,255,255,0.35)';
      g.beginPath(); g.arc(64, 64, 6, 0, Math.PI * 2); g.fill();
      break;
    case 'stripes':   // water slide
      g.fillStyle = dark(0.12);
      for (let x = 0; x < 128; x += 32) g.fillRect(x, 0, 14, 128);
      break;
    case 'rings':     // jump pad
      g.fillStyle = '#9a9a9a'; g.fillRect(0, 0, 128, 128);
      g.strokeStyle = '#ffffff'; g.lineWidth = 8;
      for (const r of [16, 36, 56]) { g.beginPath(); g.arc(64, 64, r, 0, Math.PI * 2); g.stroke(); }
      break;
    case 'chevron':   // speed strip arrows (point toward +u)
      g.clearRect(0, 0, 128, 128);
      g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(0, 0, 128, 128);
      g.fillStyle = '#ffffff';
      g.beginPath(); g.moveTo(20, 10); g.lineTo(70, 64); g.lineTo(20, 118); g.lineTo(50, 118); g.lineTo(100, 64); g.lineTo(50, 10); g.fill();
      break;
    case 'water':
      g.fillStyle = 'rgba(255,255,255,0.0)';
      g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 3;
      for (let i = 0; i < 6; i++) {
        g.beginPath();
        const y = 10 + i * 21;
        g.moveTo(0, y); g.bezierCurveTo(32, y - 8, 64, y + 8, 128, y);
        g.stroke();
      }
      g.globalCompositeOperation = 'destination-over'; g.fillStyle = '#d8e6ee'; g.fillRect(0, 0, 128, 128);
      break;
    default:          // grid
      g.fillStyle = dark(0.07);
      g.fillRect(0, 0, 64, 64);
      g.fillRect(64, 64, 64, 64);
      g.strokeStyle = dark(0.22);
      g.lineWidth = 3;
      g.strokeRect(1.5, 1.5, 125, 125);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}
