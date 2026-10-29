// ============================================================
//  CHARACTER - a tall eraser block with stick limbs.
//  Two sharp-edged halves: a body block and a head block hinged at the back edge
//  (it flips open like a mouth when talking). Two sideways rectangle eyes, no mouth.
//  Thin black stick arms + legs with ball hands and little L feet.
//  Faces -z, feet at y = 0, about 1.8m tall.   buildScamp(bodyColor, eyeColor) / animateScamp(...)
// ============================================================
const SCAMP_DARK = 0x16161c;   // stick limbs
const STICK = new THREE.MeshLambertMaterial({ color: SCAMP_DARK });

// sharp box centered on 0,0,0 (kept under this name for the first-person arms)
function roundedBox(w, h, d) {
  return new THREE.BoxGeometry(w, h, d);
}

function buildScamp(color, eyeColor = '#ffffff') {
  const base = new THREE.Color(color);
  const outline = new THREE.LineBasicMaterial({ color: base.clone().lerp(new THREE.Color(0x000000), 0.45) });
  const fur = new THREE.MeshLambertMaterial({ color: base });
  const eyeMat = new THREE.MeshBasicMaterial({ color: eyeColor });
  const mouthMat = new THREE.MeshLambertMaterial({ color: base.clone().lerp(new THREE.Color(0x000000), 0.7) });

  const box = (parent, w, h, d, mat, x, y, z, edges = true) => {
    const g = new THREE.BoxGeometry(w, h, d);
    const m = new THREE.Mesh(g, mat);
    m.position.set(x, y, z);
    m.castShadow = false;   // players get a cheap blob shadow instead (game.js)
    parent.add(m);
    if (edges) { const l = new THREE.LineSegments(new THREE.EdgesGeometry(g), outline); l.position.copy(m.position); parent.add(l); }
    return m;
  };
  const stick = (parent, len, x, y, z) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, len, 8), STICK);
    m.position.set(x, y - len / 2, z);
    parent.add(m);
    return m;
  };
  const ball = (parent, r, x, y, z) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 10), STICK);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  };

  const W = 0.62, D = 0.3, BH = 0.62, HH = 0.56;
  const rig = new THREE.Group();        // whole character (leans for slides)
  const torso = new THREE.Group();      // body + head + arms (bobs, sways, squashes)
  torso.position.y = 0.62;
  rig.add(torso);

  // body half + the dark "inside" seen when the head flips open
  box(torso, W, BH, D, fur, 0, BH / 2, 0);
  box(torso, W - 0.08, 0.02, D - 0.06, mouthMat, 0, BH - 0.009, 0, false);

  // head half, hinged on the back edge of the body
  const head = new THREE.Group();
  head.position.set(0, BH, D / 2);
  torso.add(head);
  box(head, W, HH, D, fur, 0, HH / 2, -D / 2);
  box(head, W - 0.08, 0.02, D - 0.06, mouthMat, 0, 0.009, -D / 2, false);
  const eyes = [];
  for (const s of [-1, 1]) eyes.push(box(head, 0.18, 0.055, 0.02, eyeMat, s * 0.13, HH * 0.6, -D - 0.006, false));

  // stick arms from the sides of the body, ball hands
  const arm = (s) => {
    const g = new THREE.Group();
    g.position.set(s * (W / 2 + 0.01), BH * 0.62, -0.02);
    torso.add(g);
    stick(g, 0.4, 0, 0, 0);
    ball(g, 0.055, 0, -0.42, 0);
    return g;
  };
  // stick legs from the bottom, little L feet pointing forward
  const leg = (s) => {
    const g = new THREE.Group();
    g.position.set(s * 0.14, 0.62, 0);
    rig.add(g);
    stick(g, 0.58, 0, 0, 0);
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.16, 8), STICK);
    foot.rotation.x = Math.PI / 2;
    foot.position.set(0, -0.585, -0.06);
    g.add(foot);
    ball(g, 0.032, 0, -0.585, -0.14);
    return g;
  };
  const arms = [arm(-1), arm(1)], legs = [leg(-1), leg(1)];

  const c = { rig, torso, head, arms, legs, eyes, fur, eyeMat, outline, mats: [fur, eyeMat, mouthMat, outline], phase: 0, blink: 2 + Math.random() * 3, squash: 0, wasAir: false, open: 0,
    base: { body: base.clone(), eye: new THREE.Color(eyeColor), line: outline.color.clone() } };
  addXray(c);
  return c;
}

// See-through silhouette: every part of the character gets a twin that's only drawn where something
// is in FRONT of it (depthFunc Greater), so you see their real outline through walls, and nothing
// extra when they're in plain view. setScampXray(c, color) turns it on, setScampXray(c, null) off.
function addXray(c) {
  const fill = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.32, depthWrite: false, depthFunc: THREE.GreaterDepth, fog: false });
  const line = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95, depthWrite: false, depthFunc: THREE.GreaterDepth, fog: false });
  const meshes = [];
  c.rig.traverse((o) => { if (o.isMesh) meshes.push(o); });
  c.xray = [];
  for (const m of meshes) {
    const f = new THREE.Mesh(m.geometry, fill);
    const l = new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry, 40), line);
    f.renderOrder = l.renderOrder = 30;
    f.visible = l.visible = false;
    m.add(f, l);
    c.xray.push(f, l);
  }
  c.xrayFill = fill;
  c.xrayLine = line;
  c.xrayOn = null;
}
function setScampXray(c, color) {
  if (c.xrayOn === color) return;
  c.xrayOn = color;
  for (const o of c.xray) o.visible = !!color;
  if (color) { c.xrayFill.color.set(color); c.xrayLine.color.set(color); }
}

// see-through: op = opacity (1 = solid). Knocked-out players in Bomb Tag, and the ghost skin
function setScampGhost(c, op) {
  if (c.ghost === op) return;
  c.ghost = op;
  const on = op < 1;
  if (!c.stickGhost) c.stickGhost = new THREE.MeshLambertMaterial({ color: SCAMP_DARK, transparent: true, depthWrite: false });
  c.stickGhost.opacity = op;
  c.rig.traverse((o) => {
    if (o.isMesh && c.xray.indexOf(o) < 0) {
      if (o.material === STICK || o.material === c.stickGhost) o.material = on ? c.stickGhost : STICK;
    }
  });
  for (const m of c.mats) { m.transparent = on; m.opacity = op; m.depthWrite = !on; m.needsUpdate = true; }
}

// speed = ground speed (m/s), mode 0 stand / 1 slide / 2 crouch, talking = flap the head open
function animateScamp(c, dt, t, speed, mode, airborne, talking) {
  dt = Math.max(0, Math.min(dt, 0.1));
  const k = 1 - Math.exp(-16 * dt);
  const amt = Math.min(speed / 8, 1);
  c.phase += dt * Math.min(speed, 14) * 1.5;
  const sw = Math.sin(c.phase) * amt;

  // stick limbs swing big (they're light)
  let l0 = sw * 0.85, l1 = -sw * 0.85, a0 = -sw * 1.0, a1 = sw * 1.0, az = 0.12;
  if (airborne) { l0 = 0.55; l1 = -0.4; a0 = a1 = -2.6; az = 0.45; }
  if (mode === 1) { l0 = l1 = 0.5; a0 = a1 = -0.3; az = 0.9; }
  if (mode === 2) { l0 = l1 = -0.5; az = 0.3; }
  c.legs[0].rotation.x += (l0 - c.legs[0].rotation.x) * k;
  c.legs[1].rotation.x += (l1 - c.legs[1].rotation.x) * k;
  c.arms[0].rotation.x += (a0 - c.arms[0].rotation.x) * k;
  c.arms[1].rotation.x += (a1 - c.arms[1].rotation.x) * k;
  c.arms[0].rotation.z += (-az - c.arms[0].rotation.z) * k;
  c.arms[1].rotation.z += (az - c.arms[1].rotation.z) * k;

  // squash on landing, stretch in the air, bob + waddle while running, breathe when idle
  if (c.wasAir && !airborne) c.squash = 1;
  c.wasAir = airborne;
  c.squash = Math.max(0, c.squash - dt * 5);
  const sq = Math.sin(c.squash * Math.PI) * 0.16;
  const sy = 1 + (airborne ? 0.07 : 0) - sq + Math.sin(t * 2.2) * 0.012 * (1 - amt);
  c.torso.scale.set(1 / Math.sqrt(sy), sy, 1 / Math.sqrt(sy));
  c.torso.position.y = 0.62 + Math.abs(Math.sin(c.phase)) * 0.08 * amt - sq * 0.22;
  c.torso.rotation.z = Math.sin(c.phase) * 0.07 * amt;
  c.torso.rotation.x = -0.06 * amt;   // leans into the run
  c.torso.rotation.y = Math.sin(c.phase) * 0.06 * amt;

  // head: flaps open when talking, a little nod otherwise
  const flap = talking ? Math.abs(Math.sin(t * 17)) * 0.55 + 0.05 : 0;
  const nod = -Math.sin(c.phase * 2) * 0.035 * amt + (airborne ? 0.07 : 0);
  c.open += (flap + nod - c.open) * (talking ? 0.6 : k);
  c.head.rotation.x = Math.max(-0.06, c.open);

  // blink
  c.blink -= dt;
  const shut = c.blink < 0.12;
  if (c.blink < 0) c.blink = 2 + Math.random() * 3.5;
  for (const e of c.eyes) e.scale.y = shut ? 0.15 : 1;
}

// --- cosmetics (unlocked with a secret code; everyone in the lobby sees them) ---
//   cos = { rb: 'off'|'body'|'eyes'|'both', rbStyle: 'wave'|'pulse', ghost: bool, ghostOp: 0.2-0.9, neon: bool }
// rainbow 'pulse' cycles the whole color; 'wave' runs bands of color up across the block, like an
// enchanted item's shimmer. ghost = see-through. neon = glowing outlines that cycle through colors.
const _hsl = new THREE.Color();
function scampParts(c, mat) {
  const key = mat === c.fur ? '_body' : '_eyes';
  if (c[key]) return c[key];
  const list = [];
  c.rig.traverse((o) => {
    if (!o.isMesh || o.material !== mat) return;
    // a rough "height on the body" per vertex, so the wave climbs up the whole character
    let oy = 0, ox = 0;
    for (let q = o; q && q !== c.rig; q = q.parent) { oy += q.position.y; ox += q.position.x; }
    const pos = o.geometry.attributes.position, phase = new Float32Array(pos.count);
    for (let i = 0; i < pos.count; i++) phase[i] = (pos.getY(i) + oy) * 1.6 + (pos.getX(i) + ox) * 0.9;
    if (!o.geometry.attributes.color) o.geometry.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(pos.count * 3).fill(1), 3));
    list.push({ geo: o.geometry, phase });
  });
  return (c[key] = list);
}
function paintScamp(c, mat, baseColor, style, t) {
  const wave = style === 'wave';
  if (mat.vertexColors !== wave) { mat.vertexColors = wave; mat.needsUpdate = true; }
  if (!style) { mat.color.copy(baseColor); return; }
  if (!wave) { mat.color.setHSL((t * 0.15) % 1, 0.75, 0.62); return; }
  mat.color.set(0xffffff);
  for (const { geo, phase } of scampParts(c, mat)) {
    const col = geo.attributes.color;
    for (let i = 0; i < phase.length; i++) {
      _hsl.setHSL((((t * 0.45 - phase[i] * 0.35) % 1) + 1) % 1, 0.8, 0.62);
      col.setXYZ(i, _hsl.r, _hsl.g, _hsl.b);
    }
    col.needsUpdate = true;
  }
}
// glint: a streaky shimmer tilted 45 degrees that slides diagonally (toward the bottom left) over
// the whole character, in the player's chosen color. It uses assets/glint.png; a drawn stand-in is
// used until it loads (or if it can't, e.g. opening the game straight from a file).
const GLINT_TEX = (() => {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 64;
  const g = cv.getContext('2d');
  let seed = 21;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let x = 0; x < 64; x++) {
    // vertical streaks: noisy brightness with two soft bright bands
    const band = Math.max(Math.exp(-(((x - 19) / 5) ** 2)), Math.exp(-(((x - 44) / 4) ** 2)));
    const v = Math.min(255, Math.round(70 + rnd() * 70 + band * 140));
    g.fillStyle = `rgb(${v},${v},${v})`;
    g.fillRect(x, 0, 1, 64);
  }
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.center.set(0.5, 0.5);
  t.rotation = -Math.PI / 4;
  const img = new Image();
  img.onload = () => { t.image = img; t.needsUpdate = true; };
  if (location.protocol !== 'file:') img.src = 'assets/glint.png';
  return t;
})();
function setGlint(c, color) {
  if (!c.glint) {
    if (!color) return;
    c.glintMat = new THREE.MeshBasicMaterial({ map: GLINT_TEX, color, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending,
      depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
    c.glint = [];
    const meshes = [];
    c.rig.traverse((o) => { if (o.isMesh && c.xray.indexOf(o) < 0 && o.material !== c.eyeMat) meshes.push(o); });
    for (const m of meshes) { const g = new THREE.Mesh(m.geometry, c.glintMat); g.renderOrder = 2; m.add(g); c.glint.push(g); }
  }
  for (const g of c.glint) g.visible = !!color;
  if (color) c.glintMat.color.set(color);
}

function applyCos(c, cos, t) {
  setGlint(c, cos && cos.glint ? cos.glintColor : null);
  if (cos && cos.glint) GLINT_TEX.offset.x = -((performance.now() / 1000 * 0.35) % 1);   // one shared clock, all glints in step
  const rb = cos && cos.rb !== 'off' ? cos.rb : null, style = cos && cos.rbStyle === 'pulse' ? 'pulse' : 'wave';
  paintScamp(c, c.fur, c.base.body, rb === 'body' || rb === 'both' ? style : null, t);
  paintScamp(c, c.eyeMat, c.base.eye, rb === 'eyes' || rb === 'both' ? style : null, t + 0.3);
  if (cos && cos.neon) {
    c.outline.color.setHSL((t * 0.3) % 1, 1, 0.6);
    c.fur.emissive.setHSL((t * 0.3) % 1, 1, 0.12);
    c.neonOn = true;
  } else if (c.neonOn) {
    c.outline.color.copy(c.base.line);
    c.fur.emissive.set(0x000000);
    c.neonOn = false;
  }
}
