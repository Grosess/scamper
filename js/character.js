// ============================================================
//  CHARACTER - "Scamp", an upright raccoon. Smooth one-piece shapes (lathed torso,
//  capsule limbs, one tapered tail), cel-shaded with an ink outline.
//  Faces -z, feet at y = 0, about 1.9m tall.
// ============================================================
const SCAMP_DARK = 0x2a2530;

const SCAMP_TOON = (() => {
  // 3-step light ramp for the cel look
  const t = new THREE.DataTexture(new Uint8Array([95, 95, 95, 180, 180, 180, 255, 255, 255]), 3, 1, THREE.RGBFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.needsUpdate = true;
  return t;
})();
const SCAMP_INK = new THREE.MeshBasicMaterial({ color: 0x14121a, side: THREE.BackSide });

// smooth capsule standing on y = 0..len (radius r), built as one lathed surface
function capsuleGeo(r, len, seg = 14) {
  const pts = [];
  for (let i = 0; i <= 6; i++) { const a = -Math.PI / 2 + (i / 6) * (Math.PI / 2); pts.push(new THREE.Vector2(Math.cos(a) * r, r + Math.sin(a) * r)); }
  for (let i = 0; i <= 6; i++) { const a = (i / 6) * (Math.PI / 2); pts.push(new THREE.Vector2(Math.cos(a) * r, len - r + Math.sin(a) * r)); }
  pts[0].x = pts[pts.length - 1].x = 0.0001;
  return new THREE.LatheGeometry(pts, seg);
}

// tube along points with a radius per point and per-vertex colors (for the ringed tail)
function taperTube(points, radii, colors, seg = 12) {
  const curve = new THREE.CatmullRomCurve3(points);
  const steps = 40, frames = curve.computeFrenetFrames(steps, false);
  const pos = [], col = [], idx = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps, p = curve.getPointAt(t), f = t * (radii.length - 1);
    const r = radii[Math.floor(f)] + (radii[Math.min(radii.length - 1, Math.ceil(f))] - radii[Math.floor(f)]) * (f % 1);
    const c = colors(t), N = frames.normals[i], B = frames.binormals[i];
    for (let j = 0; j <= seg; j++) {
      const a = (j / seg) * Math.PI * 2, cx = Math.cos(a) * r, sy = Math.sin(a) * r;
      pos.push(p.x + N.x * cx + B.x * sy, p.y + N.y * cx + B.y * sy, p.z + N.z * cx + B.z * sy);
      col.push(c.r, c.g, c.b);
    }
  }
  for (let i = 0; i < steps; i++) for (let j = 0; j < seg; j++) {
    const a = i * (seg + 1) + j, b = a + seg + 1;
    idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// ink outline: a copy of the surface pushed out along its normals, drawn inside-out
function inkShell(geo, t = 0.022) {
  const g = geo.clone();
  if (!g.attributes.normal) g.computeVertexNormals();
  const p = g.attributes.position, n = g.attributes.normal;
  for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) + n.getX(i) * t, p.getY(i) + n.getY(i) * t, p.getZ(i) + n.getZ(i) * t);
  return new THREE.Mesh(g, SCAMP_INK);
}

function buildScamp(color) {
  const toon = (c) => new THREE.MeshToonMaterial({ color: c, gradientMap: SCAMP_TOON });
  const base = new THREE.Color(color);
  const lightC = base.clone().lerp(new THREE.Color(0xffffff), 0.62), darkC = new THREE.Color(SCAMP_DARK);
  const fur = toon(base), light = toon(lightC), dark = toon(darkC);
  const white = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const black = new THREE.MeshBasicMaterial({ color: 0x111111 });
  const pink = toon('#ff8fa3');
  const decal = (m) => { const c = m.clone(); c.polygonOffset = true; c.polygonOffsetFactor = -2; c.polygonOffsetUnits = -2; return c; };

  const add = (parent, geo, mat, x = 0, y = 0, z = 0, ink = true) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    parent.add(m);
    if (ink) { const o = inkShell(geo); o.position.copy(m.position); parent.add(o); }
    return m;
  };

  const rig = new THREE.Group();

  // --- torso: one lathed surface, hips -> waist -> chest -> shoulders -> neck ---
  const prof = [[0.001, 0.8], [0.19, 0.82], [0.25, 0.92], [0.24, 1.04], [0.22, 1.14], [0.24, 1.27], [0.27, 1.37], [0.22, 1.45], [0.12, 1.5], [0.09, 1.56], [0.001, 1.6]]
    .map(([r, y]) => new THREE.Vector2(r, y));
  const torsoGeo = new THREE.LatheGeometry(prof, 24);
  torsoGeo.scale(1, 1, 0.78);
  add(rig, torsoGeo, fur);
  // light belly patch: the front of the same shape, painted on
  const bellyGeo = new THREE.LatheGeometry(prof.slice(1, 8).map((v) => new THREE.Vector2(v.x + 0.004, v.y)), 16, Math.PI * 1.25, Math.PI * 0.5);
  bellyGeo.scale(1, 1, 0.78);
  add(rig, bellyGeo, decal(light), 0, 0, 0, false);

  // --- head ---
  const head = new THREE.Group();
  head.position.set(0, 1.74, 0);
  rig.add(head);
  const skull = new THREE.SphereGeometry(0.25, 24, 18);
  skull.scale(1.05, 0.95, 1);
  add(head, skull, fur);
  const snout = new THREE.SphereGeometry(0.11, 16, 12);
  snout.scale(1.1, 0.8, 1.15);
  add(head, snout, light, 0, -0.07, -0.2);
  add(head, new THREE.SphereGeometry(0.045, 12, 10), black, 0, -0.03, -0.33, false);   // nose
  add(head, new THREE.SphereGeometry(0.014, 8, 6), white, -0.014, -0.012, -0.37, false); // nose shine
  // bandit mask: a band painted across the face
  const maskGeo = new THREE.SphereGeometry(0.254, 24, 8, -Math.PI / 2 - 1.15, 2.3, 1.18, 0.42);
  maskGeo.scale(1.05, 0.95, 1);
  add(head, maskGeo, decal(dark), 0, 0, 0, false);
  const browGeo = new THREE.SphereGeometry(0.256, 24, 4, -Math.PI / 2 - 0.75, 1.5, 1.0, 0.13);
  browGeo.scale(1.05, 0.95, 1);
  add(head, browGeo, decal(white), 0, 0, 0, false);
  const eyes = [];
  for (const s of [-1, 1]) {
    const eye = new THREE.Group();
    eye.position.set(s * 0.1, 0.035, -0.225);
    head.add(eye);
    const ew = new THREE.SphereGeometry(0.05, 12, 10); ew.scale(1, 1.1, 0.5);
    add(eye, ew, white, 0, 0, 0, false);
    const pu = new THREE.SphereGeometry(0.03, 10, 8); pu.scale(1, 1.1, 0.5);
    add(eye, pu, black, s * -0.006, -0.004, -0.018, false);
    add(eye, new THREE.SphereGeometry(0.01, 6, 5), white, s * -0.016, 0.014, -0.034, false);
    eyes.push(eye);
    // ears
    const ear = new THREE.Group();
    ear.position.set(s * 0.16, 0.2, 0.03);
    ear.rotation.z = -s * 0.35;
    head.add(ear);
    const eg = new THREE.ConeGeometry(0.085, 0.18, 14); eg.scale(1, 1, 0.55);
    add(ear, eg, fur, 0, 0.07, 0);
    const ig = new THREE.ConeGeometry(0.05, 0.11, 12); ig.scale(1, 1, 0.3);
    add(ear, ig, pink, 0, 0.055, -0.035, false);
    ear.userData.side = s;
    eyes.push(ear);
  }

  // --- limbs: one capsule each, hanging from hip / shoulder pivots ---
  const limb = (x, y, len, r, handMat, isArm) => {
    const g = new THREE.Group();
    g.position.set(x, y, 0);
    rig.add(g);
    const cap = capsuleGeo(r, len);
    cap.translate(0, -len, 0);
    add(g, cap, fur);
    if (isArm) {
      const hand = capsuleGeo(r * 1.25, r * 3.2);
      hand.translate(0, -len - r * 2.2, 0);
      add(g, hand, handMat);
    } else {
      const foot = capsuleGeo(r * 1.05, 0.3);
      foot.rotateX(-Math.PI / 2);
      foot.translate(0, -len + r * 1.05, 0.06);
      add(g, foot, handMat);
    }
    return g;
  };
  const legs = [limb(-0.12, 0.86, 0.8, 0.1, dark, false), limb(0.12, 0.86, 0.8, 0.1, dark, false)];
  const arms = [limb(-0.3, 1.39, 0.6, 0.07, dark, true), limb(0.3, 1.39, 0.6, 0.07, dark, true)];

  // --- tail: one tapered tube with painted rings, curling back and up ---
  const tail = new THREE.Group();
  tail.position.set(0, 0.86, 0.14);
  rig.add(tail);
  const tailGeo = taperTube(
    [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -0.08, 0.28), new THREE.Vector3(0, 0, 0.56), new THREE.Vector3(0, 0.22, 0.76), new THREE.Vector3(0, 0.5, 0.82)],
    [0.07, 0.13, 0.15, 0.13, 0.06],
    (t) => (t > 0.9 || Math.floor(t * 7) % 2 ? darkC : base));
  add(tail, tailGeo, new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: SCAMP_TOON }));

  return { rig, head, legs, arms, tail, eyes, fur, phase: 0, blink: 2 + Math.random() * 3 };
}

// speed = ground speed (m/s), mode 0 stand / 1 slide / 2 crouch
function animateScamp(c, dt, t, speed, mode, airborne) {
  dt = Math.max(0, Math.min(dt, 0.1));
  const amt = Math.min(speed / 8, 1);
  c.phase += dt * Math.min(speed, 14) * 1.5;
  const sw = Math.sin(c.phase) * 0.8 * amt;
  let l0 = sw, l1 = -sw, a0 = -sw * 0.9, a1 = sw * 0.9, az = 0.08;
  if (airborne) { l0 = 0.6; l1 = -0.25; a0 = a1 = -2.2; az = 0.35; }
  if (mode === 1) { l0 = l1 = 0.2; a0 = a1 = -0.5; az = 0.6; }
  const k = 1 - Math.exp(-18 * dt);
  c.legs[0].rotation.x += (l0 - c.legs[0].rotation.x) * k;
  c.legs[1].rotation.x += (l1 - c.legs[1].rotation.x) * k;
  c.arms[0].rotation.x += (a0 - c.arms[0].rotation.x) * k;
  c.arms[1].rotation.x += (a1 - c.arms[1].rotation.x) * k;
  c.arms[0].rotation.z += (-az - c.arms[0].rotation.z) * k;
  c.arms[1].rotation.z += (az - c.arms[1].rotation.z) * k;
  c.tail.rotation.y = Math.sin(t * 2.6) * 0.3 * (1 - amt * 0.7);
  c.tail.rotation.x += ((-0.05 - amt * 0.4) - c.tail.rotation.x) * k;
  c.head.rotation.z = Math.sin(c.phase) * 0.05 * amt;
  // blink + ear twitch
  c.blink -= dt;
  const shut = c.blink < 0.12;
  if (c.blink < 0) c.blink = 2 + Math.random() * 3.5;
  for (const e of c.eyes) {
    if (e.userData.side) e.rotation.x = Math.max(0, Math.sin(t * 9 + e.userData.side)) * (Math.sin(t * 0.7) > 0.93 ? 0.4 : 0);
    else e.scale.y = shut ? 0.12 : 1;
  }
}
