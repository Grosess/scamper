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
    this.movers = [];
    this.balloonSets = [];
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
      // invisible wall: collision only, nothing drawn (keeps people inside a map)
      wall: (x, y, z, w, h, d) => { this.boxes.push({ min: { x: x - w / 2, y, z: z - d / 2 }, max: { x: x + w / 2, y: y + h, z: z + d / 2 }, noKick: true }); },
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
      // moving solid box. Same args as box, plus how it moves (driven by the shared game clock):
      //   { type: 'slide', dx, dy, dz, period, phase }  glides to (x+dx, y+dy, z+dz) and back
      //   { type: 'spin', speed, phase }                 turns around its own center (rad/s)
      // You ride on top of it, and it shoves you when it hits you.
      mover: (x, y, z, w, h, d, color, motion, o = {}) => {
        const g = new THREE.BoxGeometry(w, h, d);
        g.translate(0, h / 2, 0);
        const m = new THREE.Mesh(g, mat(color, o));
        m.receiveShadow = true;
        if (map.outline !== false) m.add(new THREE.LineSegments(new THREE.EdgesGeometry(g, 25), lineMat));
        this.group.add(m);
        const box = { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 }, rot: 0, cx: x, cz: z, hw: w / 2, hd: d / 2 };
        const mv = { x, y, z, w, h, d, rot0: o.rot || 0, motion, box, mesh: m, dx: 0, dy: 0, dz: 0, drot: 0, vx: 0, vz: 0, s: null };
        box.mover = mv;
        this.movers.push(mv);
        this.boxes.push(box);
        this._placeMover(mv, 0, true);
      },
      // a room of floating balloons (radius 0.45-1.45) that drift away from anyone who comes close.
      // They're soft: they never block you, they just get out of the way.
      balloons: (x, y, z, w, h, d, count, colors, o = {}) => {
        let seed = o.seed || 11;
        const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
        // flat color (no shading) with a dark border, like every other outlined thing: the border is
        // a slightly bigger copy drawn inside-out behind each balloon
        const geo = new THREE.SphereGeometry(1, 24, 16);
        const im = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial(), count);
        const rim = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color: map.outlineColor || '#0d0f14', side: THREE.BackSide }), count);
        const set = { x, y, z, w, h, d, list: [], im, rim };
        const c = new THREE.Color();
        for (let i = 0; i < count; i++) {
          const r = 0.45 + Math.pow(rnd(), 1.6) * 1.0;
          const p = { x: x + (rnd() - 0.5) * (w - 2 * r), y: y + r + rnd() * (h - 2 * r), z: z + (rnd() - 0.5) * (d - 2 * r) };
          set.list.push({ r, p, home: Object.assign({}, p), v: { x: 0, y: 0, z: 0 }, ph: rnd() * 6.28 });
          im.setColorAt(i, c.set(colors[i % colors.length]));
        }
        im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        rim.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.group.add(im, rim);
        this.balloonSets.push(set);
        this._drawBalloons(set);
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
    if (map.wrap) {
      this._wrapCopies();
      // draw the tile again all around (copies share geometry + materials, so they're cheap)
      const W = map.wrap, n = map.wrapRings || 1, base = this.group.children.slice();
      for (let i = -n; i <= n; i++) for (let j = -n; j <= n; j++) {
        if (!i && !j) continue;
        for (const o of base) {
          if (o.isInstancedMesh || this.movers.some((mv) => mv.mesh === o)) continue;
          const c = o.clone();
          c.position.x += i * W;
          c.position.z += j * W;
          c.updateMatrix();
          this.group.add(c);
        }
      }
    }
  },

  // --- endless (wrap-around) maps: map.wrap = tile size, the tile spans -W/2..W/2 on x and z ---
  // Walking off one edge brings you in at the other. Collision copies of everything near the
  // edges are added so nothing has a seam, and positions are kept inside the tile.
  _wrapCopies() {
    const W = this.map.wrap, M = 8, lo = -W / 2 - M, hi = W / 2 + M;
    const near = (x0, x1, z0, z1) => x1 > lo && x0 < hi && z1 > lo && z0 < hi;
    const boxes = this.boxes.filter((b) => !b.mover), ramps = this.ramps.slice(), pads = this.pads.slice();
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
      if (!i && !j) continue;
      const dx = i * W, dz = j * W;
      for (const b of boxes) {
        if (!near(b.min.x + dx, b.max.x + dx, b.min.z + dz, b.max.z + dz)) continue;
        const c = Object.assign({}, b, { min: { x: b.min.x + dx, y: b.min.y, z: b.min.z + dz }, max: { x: b.max.x + dx, y: b.max.y, z: b.max.z + dz } });
        if (b.rot) { c.cx = b.cx + dx; c.cz = b.cz + dz; }
        this.boxes.push(c);
      }
      for (const r of ramps) if (near(r.x - r.w / 2 + dx, r.x + r.w / 2 + dx, r.z - r.d / 2 + dz, r.z + r.d / 2 + dz)) this.ramps.push(Object.assign({}, r, { x: r.x + dx, z: r.z + dz }));
      for (const p of pads) if (near(p.x + dx, p.x + dx, p.z + dz, p.z + dz)) this.pads.push(Object.assign({}, p, { x: p.x + dx, z: p.z + dz }));
    }
  },
  // put a position back inside the tile
  wrapPos(v) {
    const W = this.map && this.map.wrap;
    if (!W) return;
    v.x -= W * Math.floor((v.x + W / 2) / W);
    v.z -= W * Math.floor((v.z + W / 2) / W);
  },
  // shift q (any {x, z}) to its copy closest to `to`
  nearestCopy(q, to) {
    const W = this.map && this.map.wrap;
    if (!W) return q;
    q.x += W * Math.round((to.x - q.x) / W);
    q.z += W * Math.round((to.z - q.z) / W);
    return q;
  },

  animate(t, dt) {
    for (const f of this._anim) f(t, dt);
    for (const mv of this.movers) {
      mv.mesh.position.set(mv.s.x, mv.s.y, mv.s.z);
      mv.mesh.rotation.y = mv.s.rot;
    }
    for (const set of this.balloonSets) this._stepBalloons(set, t, dt);
  },

  // --- movers ---
  // where a mover is at time t (seconds on the shared game clock)
  _moverAt(mv, t) {
    const mo = mv.motion, ph = mo.phase || 0;
    if (mo.type === 'spin') return { x: mv.x, y: mv.y, z: mv.z, rot: mv.rot0 + ph + mo.speed * t };
    const u = ((t / mo.period + ph) % 1 + 1) % 1, s = (1 - Math.cos(u * Math.PI * 2)) / 2;
    return { x: mv.x + (mo.dx || 0) * s, y: mv.y + (mo.dy || 0) * s, z: mv.z + (mo.dz || 0) * s, rot: mv.rot0 };
  },
  _placeMover(mv, t, first) {
    const s = this._moverAt(mv, t), b = mv.box;
    if (!first && mv.s) {
      mv.dx = s.x - mv.s.x; mv.dy = s.y - mv.s.y; mv.dz = s.z - mv.s.z; mv.drot = s.rot - mv.s.rot;
    }
    mv.s = s;
    const c = Math.abs(Math.cos(s.rot)), sn = Math.abs(Math.sin(s.rot));
    const ex = c * mv.w / 2 + sn * mv.d / 2, ez = sn * mv.w / 2 + c * mv.d / 2;
    b.min.x = s.x - ex; b.max.x = s.x + ex;
    b.min.z = s.z - ez; b.max.z = s.z + ez;
    b.min.y = s.y; b.max.y = s.y + mv.h;
    b.cx = s.x; b.cz = s.z;
    b.rot = s.rot % (Math.PI * 2);
  },
  // call once per physics step, before the player moves
  updateMovers(t) {
    for (const mv of this.movers) this._placeMover(mv, t, false);
  },
  // carry a player standing on a mover, and shove them if one runs into them
  _moverPush(p, wasGrounded) {
    if (!this.movers.length) return;
    const pos = p.pos, gb = p.groundBox;
    if (gb && gb.mover && wasGrounded) {
      const mv = gb.mover;
      if (mv.drot) {
        const dx = pos.x - mv.s.x, dz = pos.z - mv.s.z, c = Math.cos(mv.drot), s = Math.sin(mv.drot);
        pos.x = mv.s.x + dx * c + dz * s;
        pos.z = mv.s.z - dx * s + dz * c;
        p.yaw += mv.drot;
      }
      pos.x += mv.dx; pos.y += mv.dy; pos.z += mv.dz;
    }
    for (const mv of this.movers) {
      const b = mv.box;
      if (!this.overlapBox(b, pos.x, pos.y, pos.z, p.h)) continue;
      if (pos.y > b.max.y - 0.6) { pos.y = b.max.y; if (p.vel.y < 0) p.vel.y = 0; continue; }   // it came up under you
      // shoved sideways: out of the box, plus the box's own speed at that spot
      if (b.rot) this._pushOut(p, b);
      else {
        const r = CONFIG.move.radius;
        const opts = [[b.min.x - r - pos.x, 'x'], [b.max.x + r - pos.x, 'x'], [b.min.z - r - pos.z, 'z'], [b.max.z + r - pos.z, 'z']];
        opts.sort((a, c) => Math.abs(a[0]) - Math.abs(c[0]));
        pos[opts[0][1]] += opts[0][0] + Math.sign(opts[0][0]) * 0.002;
      }
      const dt = 1 / 120;
      let vx = mv.dx / dt, vz = mv.dz / dt;
      if (mv.drot) { const w = mv.drot / dt; vx += (pos.z - mv.s.z) * w; vz -= (pos.x - mv.s.x) * w; }
      if (Math.abs(p.vel.x) < Math.abs(vx)) p.vel.x = vx;
      if (Math.abs(p.vel.z) < Math.abs(vz)) p.vel.z = vz;
    }
  },
  overlapBox(b, px, py, pz, h) {
    const r = CONFIG.move.radius, E = 1e-4;
    return px + r > b.min.x + E && px - r < b.max.x - E && pz + r > b.min.z + E && pz - r < b.max.z - E &&
      py + h > b.min.y + E && py < b.max.y - E && (!b.rot || this._rotHit(b, px, pz, r - E));
  },

  // --- balloons ---
  // positions of everyone balloons should dodge (feet), set by the game every frame
  actors: [],
  _stepBalloons(set, t, dt) {
    dt = Math.min(dt, 0.05);
    const L = set.list;
    for (let i = 0; i < L.length; i++) {
      const b = L[i], p = b.p, v = b.v;
      const hy = b.home.y + Math.sin(t * 0.6 + b.ph) * 0.35;
      let ax = (b.home.x - p.x) * 0.5 - v.x * 0.9, ay = (hy - p.y) * 0.5 - v.y * 0.9, az = (b.home.z - p.z) * 0.5 - v.z * 0.9;
      for (const q of this.actors) {
        const qy = Math.max(q.y, Math.min(q.y + 1.8, p.y));
        const dx = p.x - q.x, dy = p.y - qy, dz = p.z - q.z, dist = Math.hypot(dx, dy, dz) || 0.01;
        const R = b.r + 2.4;
        if (dist < R) {
          const f = (R - dist) * 16 / dist;
          ax += dx * f; ay += dy * f * 0.6; az += dz * f;
        }
      }
      v.x += ax * dt; v.y += ay * dt; v.z += az * dt;
      const sp = Math.hypot(v.x, v.y, v.z);
      if (sp > 9) { v.x *= 9 / sp; v.y *= 9 / sp; v.z *= 9 / sp; }
      p.x += v.x * dt; p.y += v.y * dt; p.z += v.z * dt;
    }
    // keep them apart and inside the room
    for (let i = 0; i < L.length; i++) {
      const a = L[i];
      for (let j = i + 1; j < L.length; j++) {
        const b = L[j], dx = b.p.x - a.p.x, dy = b.p.y - a.p.y, dz = b.p.z - a.p.z, d = Math.hypot(dx, dy, dz) || 0.01, o = a.r + b.r - d;
        if (o > 0) {
          const k = o / d / 2;
          a.p.x -= dx * k; a.p.y -= dy * k; a.p.z -= dz * k;
          b.p.x += dx * k; b.p.y += dy * k; b.p.z += dz * k;
        }
      }
      const p = a.p, r = a.r;
      for (const [ax, c, half] of [['x', set.x, set.w / 2], ['z', set.z, set.d / 2]]) {
        if (p[ax] < c - half + r) { p[ax] = c - half + r; a.v[ax] = Math.abs(a.v[ax]) * 0.4; }
        if (p[ax] > c + half - r) { p[ax] = c + half - r; a.v[ax] = -Math.abs(a.v[ax]) * 0.4; }
      }
      if (p.y < set.y + r) { p.y = set.y + r; a.v.y = Math.abs(a.v.y) * 0.4; }
      if (p.y > set.y + set.h - r) { p.y = set.y + set.h - r; a.v.y = -Math.abs(a.v.y) * 0.4; }
    }
    this._drawBalloons(set);
  },
  _drawBalloons(set) {
    const m4 = this._m4 || (this._m4 = new THREE.Matrix4());
    set.list.forEach((b, i) => {
      m4.makeScale(b.r, b.r * 1.08, b.r);
      m4.setPosition(b.p.x, b.p.y, b.p.z);
      set.im.setMatrixAt(i, m4);
      const e = b.r * 1.01 + 0.006;
      m4.makeScale(e, e * 1.08, e);
      m4.setPosition(b.p.x, b.p.y, b.p.z);
      set.rim.setMatrixAt(i, m4);
    });
    set.im.instanceMatrix.needsUpdate = true;
    set.rim.instanceMatrix.needsUpdate = true;
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
    if (this.map && this.map.wrap) { const v = { x, z }; this.wrapPos(v); x = v.x; z = v.z; }
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
    this._moverPush(p, wasGrounded);
    p.grounded = false;
    p.groundRamp = null;
    p.groundBox = null;

    this._moveH(p, 'x', v.x * dt, wasGrounded);
    this._moveH(p, 'z', v.z * dt, wasGrounded);

    pos.y += v.y * dt;
    for (let i = 0; i < 3; i++) {
      const b = this.overlap(pos.x, pos.y, pos.z, p.h);
      if (!b) break;
      if (v.y <= 0) { pos.y = b.max.y; p.grounded = true; p.groundBox = b; }
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
    // a ramp that ends against a box (a plank onto a roof...): step up onto the box instead of into it
    if (p.groundRamp) {
      const b = this.overlap(pos.x, pos.y, pos.z, p.h);
      if (b && b.max.y > pos.y && b.max.y - pos.y < 0.5 && !this.overlap(pos.x, b.max.y + 0.001, pos.z, p.h)) {
        pos.y = b.max.y + 0.001;
        p.groundRamp = null;
        p.groundBox = b;
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
      if (b.noKick || !(y + 0.3 < b.max.y && y + p.h - 0.2 > b.min.y)) continue;
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
