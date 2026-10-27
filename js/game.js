// ============================================================
//  GAME - rendering, input, HUD, and the tag rules (run by the host).
// ============================================================
(() => {
'use strict';
const $ = (id) => document.getElementById(id);
const M = CONFIG.move;
const STEP = 1 / 120;
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const r2 = (x) => Math.round(x * 100) / 100;

if (typeof THREE === 'undefined' || typeof Peer === 'undefined') {
  $('menuStatus').textContent = 'Could not load the game libraries. Check your internet connection and refresh.';
  return;
}

// ---------- settings ----------
const settings = Object.assign(
  { name: '', sens: 1, fov: CONFIG.camera.fov, autorun: false, volume: 0.8, invertY: false, showSpeed: true, shake: 1, perf: false },
  ['scamper-settings', 'catenaries-settings', 'tagrush-settings'].map(loadJSON).find((o) => Object.keys(o).length) || {});
const DEFAULT_KEYS = JSON.parse(JSON.stringify(CONFIG.keys));
if (settings.keys) for (const a in DEFAULT_KEYS) if (Array.isArray(settings.keys[a])) CONFIG.keys[a] = settings.keys[a].slice(0, 2);
function loadJSON(k) { try { return JSON.parse(localStorage.getItem(k)) || {}; } catch (e) { return {}; } }
function saveSettings() { try { localStorage.setItem('scamper-settings', JSON.stringify(settings)); } catch (e) {} }

// ---------- renderer / scene ----------
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
// render resolution: starts at up to 1.5x on sharp screens and drops on its own when frames run slow
const res = { max: 1, now: 1, avg: 1 / 60, best: 1 / 60, slow: 0, fast: 0 };
function setResMax() {
  res.max = Math.min(devicePixelRatio, settings.perf ? 1 : 1.5);
  res.now = Math.min(res.now, res.max) || res.max;
  renderer.setPixelRatio(res.now);
}
setResMax();
renderer.setSize(innerWidth, innerHeight);
// the world never moves, so its shadows are drawn once per map (players get a blob shadow instead)
renderer.shadowMap.enabled = true;
renderer.shadowMap.autoUpdate = false;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color();
scene.fog = new THREE.Fog(0xffffff, 50, 150);

const camera = new THREE.PerspectiveCamera(settings.fov, innerWidth / innerHeight, 0.1, 400);
camera.rotation.order = 'YXZ';
scene.add(camera);

const hemi = new THREE.HemisphereLight();
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, 0.8);
sun.position.set(30, 60, 20);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -50, right: 50, top: 50, bottom: -50, near: 1, far: 150 });
sun.shadow.camera.updateProjectionMatrix();
sun.shadow.bias = -0.0005;
scene.add(sun);

// spotlights hanging from steel rafters over the void
const spotGroup = new THREE.Group();
scene.add(spotGroup);
const glowTex = (() => {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.25, 'rgba(255,255,255,0.5)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
})();
const beamTex = (() => {
  // bright at the lamp, fading out toward the floor
  const c = document.createElement('canvas');
  c.width = 4; c.height = 128;
  const g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 128);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.6, 'rgba(255,255,255,0.35)');
  gr.addColorStop(1, 'rgba(255,255,255,0.05)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 4, 128);
  return new THREE.CanvasTexture(c);
})();
const steelMat = new THREE.MeshLambertMaterial({ color: '#3a404a', emissive: '#15181d' });

function buildSpots(m) {
  for (const o of spotGroup.children.slice()) {
    spotGroup.remove(o);
    if (o.geometry) o.geometry.dispose();
    if (o.material && o.material !== steelMat) o.material.dispose();
  }
  const h = m.spotHeight || 36;
  const list = m.spots || [-1, 0, 1].flatMap((i) => [-1, 0, 1].map((j) => ({ x: i * m.size * 0.55, z: j * m.size * 0.55 })));
  const spacing = m.spots ? m.size * 0.7 : m.size * 0.55;
  if (m.env === 'sky') { buildSky(m); return; }
  const indoor = m.env === 'indoor';
  for (const s of list) {
    const y = s.y || h, ang = s.angle || Math.atan(spacing * 0.85 / y), color = s.color || m.spotColor || '#fff2dc';
    const L = new THREE.SpotLight(color, s.intensity || (indoor ? 1.5 : 1.9), y * 2.2, indoor ? Math.min(1.2, ang * 1.6) : ang, 0.7, 1);
    L.position.set(s.x, y, s.z);
    L.target.position.set(s.x, 0, s.z);
    spotGroup.add(L, L.target);
    if (indoor) {
      // flush ceiling light panel instead of a hanging lamp
      const panel = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), new THREE.MeshBasicMaterial({ color: '#fffaf0', fog: false }));
      panel.rotation.x = Math.PI / 2;
      panel.position.set(s.x, y + 0.25, s.z);
      spotGroup.add(panel);
      continue;
    }
    const beam = new THREE.Mesh(
      new THREE.ConeGeometry(Math.tan(ang) * y, y, 32, 1, true),
      new THREE.MeshBasicMaterial({ color, map: beamTex, transparent: true, opacity: 0.07, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
    beam.position.set(s.x, y / 2, s.z);
    spotGroup.add(beam);
    const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 1.1, 1.2, 16, 1, true), steelMat);
    lamp.position.set(s.x, y + 0.6, s.z);
    const lens = new THREE.Mesh(new THREE.CircleGeometry(1.0, 20), new THREE.MeshBasicMaterial({ color, fog: false }));
    lens.rotation.x = Math.PI / 2;
    lens.position.set(s.x, y + 0.02, s.z);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    glow.scale.set(7, 7, 1);
    glow.position.set(s.x, y - 0.3, s.z);
    spotGroup.add(lamp, lens, glow);
  }
  if (!indoor) buildRafters(m, h + 1.3);
}

// daylight: gradient sky dome + ocean
function buildSky(m) {
  const geo = new THREE.SphereGeometry(380, 32, 16);
  const cols = [], top = new THREE.Color('#3f8fe8'), mid = new THREE.Color('#a9d6ff'), low = new THREE.Color('#e8f4ff');
  const pos = geo.attributes.position, c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const t = pos.getY(i) / 380;
    if (t > 0.08) c.copy(mid).lerp(top, Math.min(1, (t - 0.08) / 0.6)); else c.copy(low).lerp(mid, Math.max(0, (t + 0.1) / 0.18));
    cols.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  spotGroup.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false, toneMapped: false })));
  const tex = makeTexture('water');
  tex.repeat.set(90, 90);
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(760, 760), new THREE.MeshLambertMaterial({ color: '#2577c8', map: tex }));
  sea.rotation.x = -Math.PI / 2;
  sea.position.y = m.sea !== undefined ? m.sea : -3;
  spotGroup.add(sea);
  World._anim.push((t, dt) => { tex.offset.x += dt * 0.02; tex.offset.y += dt * 0.012; });
}

// steel trusses across the top - one instanced mesh, so it costs a single draw call
function buildRafters(m, y) {
  const hx = (m.rafters && m.rafters[0]) || m.size * 1.1, hz = (m.rafters && m.rafters[1]) || m.size * 1.1;
  const parts = [];   // [x, y, z, sx, sy, sz, rx, rz]
  const H = 1.4, step = 2.8, diag = Math.hypot(step, H), ang = Math.atan2(H, step);
  // truss running along x at z = c: two chords, verticals, alternating diagonals
  for (let c = -hz; c <= hz + 0.01; c += 12) {
    parts.push([0, y, c, 2 * hx, 0.3, 0.3, 0, 0], [0, y + H, c, 2 * hx, 0.3, 0.3, 0, 0]);
    const n = Math.round((2 * hx) / step);
    for (let i = 0; i < n; i++) {
      const a = -hx + (i + 0.5) * step;
      parts.push([a - step / 2, y + H / 2, c, 0.18, H, 0.18, 0, 0]);
      parts.push([a, y + H / 2, c, diag, 0.14, 0.14, 0, i % 2 ? ang : -ang]);
    }
  }
  // cross beams along z resting on the trusses
  for (let x = -hx; x <= hx + 0.01; x += 12) parts.push([x, y + H + 0.45, 0, 0.35, 0.6, 2 * hz, 0, 0]);
  const im = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), steelMat, parts.length);
  const o = new THREE.Object3D();
  parts.forEach(([px, py, pz, sx, sy, sz, rx, rz], i) => {
    o.position.set(px, py, pz);
    o.rotation.set(rx, 0, rz);
    o.scale.set(sx, sy, sz);
    o.updateMatrix();
    im.setMatrixAt(i, o.matrix);
  });
  spotGroup.add(im);
}

function loadMap(id) {
  const m = getMap(id);
  World.load(scene, m);
  buildSpots(m);
  renderer.shadowMap.needsUpdate = true;
  scene.background.set(m.sky);
  scene.fog.color.set(m.sky);
  scene.fog.near = m.fog[0];
  scene.fog.far = m.fog[1];
  hemi.color.set(m.hemi[0]);
  hemi.groundColor.set(m.hemi[1]);
  const day = m.env === 'sky';
  hemi.intensity = m.hemi[2] * (day ? 1.0 : 0.45);
  sun.intensity = m.sun[0] * (day ? 1.0 : 0.45);
  if (day) sun.position.set(m.sun[1], m.sun[2], m.sun[3]);
  else sun.position.set(m.sun[1] * 0.25, 60, m.sun[3] * 0.25);   // shadows fall straight down, like the lights
  const sc = sun.shadow.camera;
  sc.left = sc.bottom = -m.size;
  sc.right = sc.top = m.size;
  sc.far = 200;
  sc.updateProjectionMatrix();
  game.map = m.id;
  const sel = document.getElementById('mapSel');
  if (sel) { sel.value = m.id; document.getElementById('mapBlurb').textContent = m.blurb; }
}

addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = vmCam.aspect = innerWidth / innerHeight;
  vmCam.updateProjectionMatrix();
  camera.updateProjectionMatrix();
});

// ---------- sound ----------
let actx = null;
function audio() {
  if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} }
  if (actx && actx.state === 'suspended') actx.resume();
}
function tone(f0, f1, dur, type = 'square', vol = 0.08, delay = 0) {
  vol *= settings.volume;
  if (!actx || vol < 0.0005) return;
  const t = actx.currentTime + delay;
  const o = actx.createOscillator(), g = actx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(actx.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}
const SFX = {
  jump: () => tone(300, 520, 0.09, 'square', 0.035),
  kick: () => tone(220, 780, 0.12, 'triangle', 0.09),
  slide: () => tone(160, 70, 0.25, 'sawtooth', 0.03),
  land: () => tone(130, 55, 0.09, 'sine', 0.12),
  mantle: () => tone(260, 420, 0.1, 'triangle', 0.06),
  tag: () => { tone(880, 1320, 0.08, 'square', 0.06); tone(1320, 1760, 0.1, 'square', 0.05, 0.07); },
  tagged: () => tone(420, 90, 0.45, 'sawtooth', 0.08),
  go: () => { tone(660, 660, 0.1, 'square', 0.06); tone(990, 990, 0.18, 'square', 0.06, 0.12); },
  start: () => { tone(440, 440, 0.12, 'square', 0.05); tone(554, 554, 0.12, 'square', 0.05, 0.13); tone(659, 659, 0.2, 'square', 0.05, 0.26); },
  pad: () => tone(200, 900, 0.22, 'sine', 0.1),
  beat: () => { tone(70, 45, 0.14, 'sine', 0.22); tone(70, 45, 0.12, 'sine', 0.15, 0.16); },
  tick: () => tone(1050, 1050, 0.05, 'square', 0.035),
  count: () => tone(560, 560, 0.1, 'square', 0.06),
  end: () => { tone(659, 659, 0.15, 'triangle', 0.08); tone(523, 523, 0.15, 'triangle', 0.08, 0.16); tone(392, 392, 0.35, 'triangle', 0.08, 0.32); },
};

// ---------- first-person arms ----------
// first-person arms live in their own little scene, drawn after the world with a fresh depth
// buffer - so nothing (outlines, water, glass, beams) can ever show through your hands
document.querySelector('#pointer span').id = 'pointerLabel';
const vmScene = new THREE.Scene();
const vmCam = new THREE.PerspectiveCamera(82, innerWidth / innerHeight, 0.01, 10);
vmScene.add(vmCam, new THREE.HemisphereLight(0xffffff, 0x667788, 0.95));
const vmSun = new THREE.DirectionalLight(0xffffff, 0.55);
vmSun.position.set(0.4, 1, 0.3);
vmScene.add(vmSun);
const skinMat = new THREE.MeshLambertMaterial({ color: SCAMP_DARK });
const sleeveMat = new THREE.MeshLambertMaterial({ color: 0x4dabff });
const arms = [-1, 1].map((side) => {
  const g = new THREE.Group();
  // stick arm + ball hand, like the character
  const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.3, 8), sleeveMat);
  sleeve.rotation.x = Math.PI / 2;
  sleeve.position.z = 0.03;
  const hand = new THREE.Mesh(new THREE.SphereGeometry(0.042, 12, 10), skinMat);
  hand.position.z = -0.13;
  sleeve.renderOrder = hand.renderOrder = 10;
  g.add(sleeve, hand);
  g.userData.side = side;
  g.visible = false;
  vmCam.add(g);
  return g;
});

// ---------- other players ----------
function makeLabel(text, color, w = 256) {
  const c = document.createElement('canvas');
  c.width = w; c.height = 64;
  const g = c.getContext('2d');
  g.font = '800 34px Rubik, system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineWidth = 7;
  g.strokeStyle = 'rgba(0,0,0,0.75)';
  g.strokeText(text, w / 2, 34);
  g.fillStyle = color;
  g.fillText(text, w / 2, 34);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false, transparent: true }));
  s.scale.set(1.8 * w / 256, 0.45, 1);
  s.renderOrder = 5;
  return s;
}

const blobGeo = new THREE.PlaneGeometry(1.3, 1.3);
function makeAvatar(p) {
  const root = new THREE.Group();
  const c = buildScamp(p.color, p.eye);
  root.add(c.rig);

  const label = makeLabel(p.name, '#ffffff');
  label.position.y = 2.3;
  const itMark = makeLabel('IT', '#ff3344', 128);
  itMark.position.y = 2.7;
  itMark.visible = false;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.06, 8, 28), new THREE.MeshBasicMaterial({ color: 0xff3344 }));
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.05;
  ring.visible = false;
  // see-through silhouette + marker (shown to a duel chaser so the evader is never lost)
  const xray = new THREE.Group();
  const xmat = new THREE.MeshBasicMaterial({ color: 0xc6ff3d, transparent: true, opacity: 0.35, depthTest: false, depthWrite: false, fog: false });
  const xbody = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 1.25, 12), xmat);
  xbody.position.y = 0.85;
  const xhead = new THREE.Mesh(new THREE.SphereGeometry(0.36, 12, 8), xmat);
  xhead.position.y = 1.6;
  const marker = makeLabel('\u25BC', '#c6ff3d', 128);
  marker.position.y = 3.1;
  marker.material.fog = false;
  xbody.renderOrder = xhead.renderOrder = 20;
  xray.add(xbody, xhead, marker);
  xray.visible = false;
  root.add(label, itMark, ring, xray);
  scene.add(root);
  const blob = new THREE.Mesh(blobGeo, new THREE.MeshBasicMaterial({ color: 0x000000, map: glowTex, transparent: true, opacity: 0.4, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }));
  blob.rotation.x = -Math.PI / 2;
  scene.add(blob);
  return { root, rig: c.rig, scamp: c, bodyMat: c.fur, itMark, ring, xray, blob, spd: 0, vy: 0 };
}

function removeAvatar(p) {
  scene.remove(p.avatar.root, p.avatar.blob);
  p.avatar.blob.material.dispose();
  p.avatar.root.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); }
  });
  p.avatar = null;
}

const players = new Map();  // id -> { id, name, color, tp (latest position), yaw, pitch, mode, avatar }
let myId = null;

function ensurePlayer(id, name, color, eye = '#ffffff') {
  let p = players.get(id);
  if (!p) {
    p = { id, name, color, eye, talk: false, tp: new THREE.Vector3(0, -100, 0), yaw: 0, pitch: 0, mode: 0, snapNext: true, avatar: null };
    players.set(id, p);
    if (id !== myId) p.avatar = makeAvatar(p);
  } else if (p.name !== name || p.color !== color || p.eye !== eye) {
    p.name = name;
    p.color = color;
    p.eye = eye;
    if (p.avatar) { removeAvatar(p); p.avatar = makeAvatar(p); p.snapNext = true; }
  }
  return p;
}

function removePlayer(id) {
  const p = players.get(id);
  if (!p) return;
  if (p.avatar) removeAvatar(p);
  players.delete(id);
}

function setPose(p, s) {
  if (!Array.isArray(s) || s.length < 6) return;
  const dx = s[0] - p.tp.x, dy = s[1] - p.tp.y, dz = s[2] - p.tp.z;
  if (dx * dx + dy * dy + dz * dz > 36) p.snapNext = true;
  p.tp.set(+s[0] || 0, +s[1] || 0, +s[2] || 0);
  p.yaw = +s[3] || 0;
  p.pitch = +s[4] || 0;
  p.mode = s[5] | 0;
  p.talk = !!s[6];
}

const nameOf = (id) => (players.get(id) || { name: '???' }).name;

// ---------- game state (host is the source of truth) ----------
const game = { setup: null, phase: 'lobby', mode: 'classic', map: 'lobby', it: [], scores: {}, round: 120, tl: 0, rl: 0, result: null, duel: null };
loadMap(settings.lastMap || 'lobby');
const isIt = (id) => game.it.includes(id);
const me = new LocalPlayer();
let inGame = false;

function randomSpawn() { const sp = World.map.spawns; return sp[Math.floor(Math.random() * sp.length)]; }
function faceCenter(p) { return Math.atan2(p[0], p[2]); }
function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// ---------- HUD helpers ----------
let bannerTimer = 0;
function showBanner(html, secs) {
  const b = $('banner');
  b.innerHTML = html;
  b.classList.add('show');
  clearTimeout(bannerTimer);
  if (secs) bannerTimer = setTimeout(() => b.classList.remove('show'), secs * 1000);
}
function addFeed(text) {
  const f = $('feed'), d = document.createElement('div');
  d.className = 'feed-item';
  d.textContent = text;
  f.prepend(d);
  while (f.children.length > 6) f.lastChild.remove();
  setTimeout(() => d.remove(), 6000);
}
function flash(color) {
  const f = $('flash');
  f.style.background = color;
  f.classList.remove('go');
  void f.offsetWidth;
  f.classList.add('go');
}
const textCache = {};
function setText(id, t) { if (textCache[id] !== t) { textCache[id] = t; $(id).textContent = t; } }
function showMsg(title, text) {
  $('msgTitle').textContent = title;
  $('msgText').textContent = text;
  $('msg').classList.remove('hidden');
  $('pause').classList.add('hidden');
}
const modeName = () => ({ infection: 'INFECTION', duel: 'DUEL' }[game.mode] || 'CLASSIC TAG');
const inDuel = (id) => game.mode === 'duel' && game.duel && game.duel.ids.includes(id);
const fmtTime = (s) => { s = Math.max(0, Math.ceil(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

function applyState(s) {
  const wasIt = isIt(myId), oldPhase = game.phase, oldItCount = game.it.length;
  const oldChase = game.duel ? game.duel.chase : 0;
  const ids = new Set(s.roster.map((r) => r.id));
  for (const id of [...players.keys()]) if (!ids.has(id)) removePlayer(id);
  for (const r of s.roster) ensurePlayer(r.id, String(r.name).slice(0, 16), pickColor(r.color), pickEye(r.eye));

  if (s.map && (!World.map || s.map !== World.map.id)) loadMap(s.map);
  game.phase = s.phase;
  game.mode = s.mode;
  game.it = Array.isArray(s.it) ? s.it.slice() : [];
  game.scores = s.scores || {};
  game.round = s.round;
  game.result = s.result;
  game.duel = s.duel || null;
  if (s.setup) game.setup = s.setup;
  game.lastTag = s.lastTag ? { from: s.lastTag.from, to: s.lastTag.to, at: performance.now() - s.lastTag.ago * 1000 } : null;

  const mine = players.get(myId);
  if (mine) { sleeveMat.color.set(SCAMP_DARK); skinMat.color.set(SCAMP_DARK); }

  const playing = game.phase === 'playing';
  if (playing && game.mode === 'duel' && game.duel) {
    if (game.duel.chase !== oldChase) {
      const d = game.duel, [a, b] = d.ids;
      const score = `${esc(d.names[a])} ${d.pts[a]} - ${d.pts[b]} ${esc(d.names[b])} · first to ${d.target}`;
      const role = !inDuel(myId) ? '<div class="big">SPECTATING</div>'
        : isIt(myId) ? '<div class="big red">CHASE</div>' : '<div class="big lime">EVADE</div>';
      showBanner(`${d.last ? `<div class="sub">${esc(d.last)}</div>` : ''}${role}<div>Chase ${d.chase} · ${score}</div>`, 3);
      SFX.start();
    }
  } else if (playing && oldPhase !== 'playing') {
    SFX.start();
    if (isIt(myId)) showBanner(`<div class="big red">${game.mode === 'infection' ? 'SEEKER' : "YOU'RE IT"}</div><div>You're released in ${CONFIG.tag.releaseDelay} seconds…</div>`, 3);
    else showBanner(`<div class="big lime">RUN!</div><div>${esc(game.it.map(nameOf).join(', '))} ${game.it.length > 1 ? 'are' : 'is'} IT</div>`, 3);
  } else if (playing && !wasIt && isIt(myId)) {
    tagReadyAt = Math.max(tagReadyAt, performance.now() + CONFIG.tag.tagDelay * 1000);
    flash('rgba(255,40,60,.55)');
    SFX.tagged();
    showBanner(`<div class="big red">${game.mode === 'infection' ? 'CAUGHT' : "YOU'RE IT"}</div><div>Go tag someone!</div>`, 2.2);
  }

  if (game.phase === 'results' && oldPhase !== 'results' && game.result) {
    SFX.end();
    const r = game.result;
    showBanner(`<div class="big">${esc(r.title)}</div><div class="sub">${esc(r.sub || '')}</div>` +
      `<ol class="results">${(r.lines || []).map((l) => `<li>${esc(l)}</li>`).join('')}</ol>`);
  }
  if (game.phase === 'lobby' && oldPhase === 'results') $('banner').classList.remove('show');

  updatePauseUI();
  renderScoreboard();
}

function applySnap(m) {
  if (!m.p || typeof m.p !== 'object') return;
  for (const id in m.p) {
    if (id === myId) continue;
    const p = players.get(id);
    if (p) setPose(p, m.p[id]);
  }
  game.tl = +m.tl || 0;
  game.rl = +m.rl || 0;
}

// ---------- host: rules ----------
const H = { itSince: {}, prevIt: [], timeLeft: 0, releaseLeft: 0, resultsLeft: 0, lastTag: null, snapAcc: 0, stateAcc: 0 };
const COLORS = ['#2f3138', '#f4f1ea', '#ff8fa3', '#ffd166', '#7ed6c8', '#8fb4ff', '#c3a6ff', '#ffb37a', '#9be3a8', '#ff6b6b', '#a8dcef', '#b7bcc6'];

const isHex = (c) => typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c);
function pickColor(want) { return isHex(want) ? want.toLowerCase() : COLORS[Math.floor(Math.random() * COLORS.length)]; }
const pickEye = (want) => (isHex(want) ? want.toLowerCase() : '#ffffff');
function cleanName(n) { return String(n || '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, 14) || 'bobo'; }
function uniqueName(n) {
  const taken = new Set([...players.values()].map((p) => p.name));
  if (!taken.has(n)) return n;
  for (let i = 2; ; i++) if (!taken.has(`${n}${i}`)) return `${n}${i}`;
}

function buildState() {
  return {
    t: 'state', phase: game.phase, mode: game.mode, map: game.map, it: game.it.slice(), duel: game.duel, setup: game.setup,
    lastTag: H.lastTag ? { from: H.lastTag.from, to: H.lastTag.to, ago: (performance.now() - H.lastTag.time) / 1000 } : null, scores: game.scores,
    round: game.round, result: game.result,
    roster: [...players.values()].map((p) => ({ id: p.id, name: p.name, color: p.color, eye: p.eye })),
  };
}
function pushState() {
  const now = performance.now();
  for (const id of game.it) if (!H.prevIt.includes(id)) H.itSince[id] = now;
  H.prevIt = game.it.slice();
  const s = buildState();
  Net.broadcast(s);
  applyState(s);
}
function hostFeed(text) {
  addFeed(text);
  Net.broadcast({ t: 'feed', text });
}

function teleportPlayer(id, pos) {
  const p = players.get(id);
  if (p) { p.tp.set(pos[0], pos[1], pos[2]); p.snapNext = true; }
  if (id === myId) me.teleport(pos, faceCenter(pos));
  else Net.sendTo(id, { t: 'tp', p: pos });
}

function hostSetMap(id) {
  if (game.phase === 'playing' || id === game.map) return;
  loadMap(id);
  settings.lastMap = id;
  saveSettings();
  pushState();
  hostFeed(`Map: ${World.map.name}`);
  const spawns = shuffle(World.map.spawns.slice());
  [...players.keys()].forEach((id, i) => teleportPlayer(id, spawns[i % spawns.length]));
}

function hostStartRound() {
  if (game.phase === 'playing') return;
  hostSetMap($('mapSel').value);
  const ids = [...players.keys()];
  if (ids.length < 2) {
    showBanner('<div class="big">NEED 2+ PLAYERS</div><div>Share your code with friends first.</div>', 2.5);
    return;
  }
  const mode = $('modeSel').value;
  if (mode === 'duel' && ids.length !== 2) {
    showBanner('<div class="big">DUEL IS 1V1</div><div>Duel needs exactly 2 players in the lobby.</div>', 2.5);
    return;
  }
  game.mode = mode;
  game.round = +$('lenSel').value;
  game.phase = 'playing';
  game.result = null;
  game.scores = {};
  ids.forEach((id) => (game.scores[id] = { it: 0, tags: 0 }));
  shuffle(ids);
  if (game.mode === 'duel') {
    const names = {}, pts = {};
    ids.forEach((id) => { names[id] = nameOf(id); pts[id] = 0; });
    game.duel = { ids, names, pts, target: +$('targetSel').value, chaseLen: +$('chaseSel').value, chase: 0, last: '' };
    game.it = [ids[0]];
    hostFeed(`Duel! First to ${game.duel.target}`);
    hostStartChase();
    return;
  }
  game.duel = null;
  const seekers = game.mode === 'infection' ? Math.max(1, Math.floor(ids.length / 6)) : 1;
  game.it = ids.slice(0, seekers);
  H.timeLeft = game.round;
  H.releaseLeft = CONFIG.tag.releaseDelay;
  H.lastTag = null;
  game.tl = H.timeLeft;
  game.rl = H.releaseLeft;

  const spawns = shuffle(World.map.spawns.slice());
  let si = 0;
  for (const id of ids) teleportPlayer(id, isIt(id) ? World.map.seekerSpawn : spawns[si++ % spawns.length]);
  pushState();
  hostFeed(`${game.it.map(nameOf).join(', ')} ${game.it.length > 1 ? 'are' : 'is'} IT`);
}

// --- duel: one chaser, one evader, short timed chases, first to N points ---
function hostStartChase() {
  const d = game.duel;
  d.chase++;
  H.timeLeft = d.chaseLen;
  H.releaseLeft = CONFIG.tag.duelRelease;
  game.tl = H.timeLeft;
  game.rl = H.releaseLeft;
  const chaser = game.it[0], evader = d.ids.find((i) => i !== chaser);
  // put them far apart
  const sp = World.map.spawns, a = sp[Math.floor(Math.random() * sp.length)];
  const byDist = sp.filter((s) => s !== a).sort((p, q) => dist2(p, a) - dist2(q, a));
  const b = byDist[Math.min(byDist.length - 1, Math.round((byDist.length - 1) * CONFIG.tag.duelSpawnSpread))];
  teleportPlayer(chaser, a);
  teleportPlayer(evader, b);
  pushState();
}
const dist2 = (p, q) => (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2;

// winner of a chase scores; whoever won the chase evades in the next one
function duelPoint(winner, why) {
  const d = game.duel;
  const chaser = game.it[0], evader = d.ids.find((i) => i !== chaser);
  d.pts[winner]++;
  d.last = `${d.names[winner]} +1 (${why})`;
  hostFeed(d.last);
  if (d.pts[winner] >= d.target) { hostEndRound(); return; }
  if (winner === chaser) game.it = [evader];
  hostStartChase();
}

// someone fell into the void
function hostFell(id) {
  if (game.phase !== 'playing') return;
  if (game.mode === 'duel') {
    const d = game.duel;
    if (!d.ids.includes(id) || H.releaseLeft > 0) return;
    duelPoint(d.ids.find((i) => i !== id), id === game.it[0] ? 'chaser fell into the void' : 'fell into the void');
    return;
  }
  if (isIt(id)) return;
  if (game.mode === 'classic') { game.it = [id]; H.lastTag = null; } else game.it.push(id);
  hostFeed(`${nameOf(id)} fell into the void`);
  pushState();
  if (game.mode === 'infection' && [...players.keys()].every(isIt)) hostEndRound('Everyone got caught');
}

function hostEndRound(sub) {
  if (game.phase !== 'playing') return;
  game.phase = 'results';
  game.result = computeResult(sub);
  H.resultsLeft = CONFIG.tag.resultsTime;
  pushState();
}

function computeResult(sub) {
  const list = [...players.values()];
  const sc = (id) => game.scores[id] || { it: 0, tags: 0 };
  if (game.mode === 'duel' && game.duel) {
    const d = game.duel, [a, b] = d.ids, w = d.pts[a] >= d.pts[b] ? a : b;
    return {
      title: `${d.names[w]} wins the duel!`,
      sub: sub || `${d.pts[a]} - ${d.pts[b]}`,
      lines: d.ids.map((i) => `${d.names[i]} - ${d.pts[i]} points`),
    };
  }
  if (game.mode === 'classic') {
    list.sort((a, b) => sc(a.id).it - sc(b.id).it);
    return {
      title: list.length ? `${list[0].name} wins!` : 'Round over',
      sub: sub || 'Least time as IT wins',
      lines: list.map((p) => `${p.name} - ${sc(p.id).it.toFixed(1)}s as IT, ${sc(p.id).tags} tags`),
    };
  }
  const runners = list.filter((p) => !isIt(p.id));
  if (runners.length) {
    return { title: 'Runners win!', sub: sub || `${runners.length} survived`, lines: runners.map((p) => `${p.name} survived`) };
  }
  list.sort((a, b) => sc(b.id).tags - sc(a.id).tags);
  return { title: 'Seekers win!', sub: sub || 'Everyone got caught', lines: list.map((p) => `${p.name} - ${sc(p.id).tags} tags`) };
}

function posOf(id) {
  if (id === myId) return me.pos;
  const p = players.get(id);
  return p ? p.tp : null;
}

function hostTryTag(tagger, target) {
  if (game.phase !== 'playing' || H.releaseLeft > 0) return;
  if (!players.has(target) || !isIt(tagger) || isIt(target)) return;
  const now = performance.now();
  if (now - (H.itSince[tagger] || 0) < CONFIG.tag.tagDelay * 1000 - 150) return;
  // same allowance for every player, host included: contact range + room for lag
  const a = posOf(tagger), b = posOf(target);
  const reach = CONFIG.tag.touchRange + (game.mode === 'duel' ? CONFIG.tag.duelReachBonus : 0) + CONFIG.tag.lagSlack;
  if (!a || !b || a.distanceTo(b) > reach) return;
  if (game.mode === 'duel') {
    if (!inDuel(target)) return;
    if (game.scores[tagger]) game.scores[tagger].tags++;
    duelPoint(tagger, 'tag');
    Net.broadcast({ t: 'tagev', from: tagger, to: target });
    showTagEvent(tagger, target);
    return;
  }
  if (game.mode === 'classic') {
    const lt = H.lastTag;
    if (lt && lt.from === target && lt.to === tagger && now - lt.time < CONFIG.tag.noTagBack * 1000) return;
    game.it = [target];
  } else {
    game.it.push(target);
  }
  H.lastTag = { from: tagger, to: target, time: now };
  if (game.scores[tagger]) game.scores[tagger].tags++;
  hostFeed(`${nameOf(tagger)} tagged ${nameOf(target)}`);
  pushState();
  Net.broadcast({ t: 'tagev', from: tagger, to: target });
  showTagEvent(tagger, target);
  if (game.mode === 'infection' && [...players.keys()].every(isIt)) hostEndRound('Everyone got caught');
}

function hostHandle(from, m) {
  if (m.t === 'hello') {
    if (players.has(from)) return;
    if (m.v !== CONFIG.version) {
      // different versions can't play together - tell them exactly what to do
      Net.sendTo(from, { t: 'oldver', v: CONFIG.version });
      setTimeout(() => Net.kick(from), 400);
      return;
    }
    if (players.size >= CONFIG.tag.maxPlayers) {
      Net.sendTo(from, { t: 'full' });
      setTimeout(() => Net.kick(from), 300);
      return;
    }
    const name = uniqueName(cleanName(m.name));
    ensurePlayer(from, name, pickColor(m.color), pickEye(m.eye));
    game.scores[from] = { it: 0, tags: 0 };
    if (game.phase === 'playing' && game.mode === 'infection') game.it.push(from);
    hostFeed(`${name} joined`);
    pushState();
    autoMode();
    teleportPlayer(from, randomSpawn());
  } else if (m.t === 'me') {
    const p = players.get(from);
    if (p) setPose(p, m.s);
  } else if (m.t === 'tag') {
    hostTryTag(from, String(m.id));
  } else if (m.t === 'fell') {
    hostFell(from);
  }
}

function hostOnLeave(id) {
  if (!players.has(id)) return;
  const name = nameOf(id);
  removePlayer(id);
  delete game.scores[id];
  game.it = game.it.filter((x) => x !== id);
  hostFeed(`${name} left`);
  setTimeout(autoMode, 0);
  if (game.phase === 'playing') {
    if (game.mode === 'duel' && game.duel.ids.includes(id)) { hostEndRound(`${name} left the duel`); return; }
    if (players.size < 2) { hostEndRound('Not enough players left'); return; }
    if (game.it.length === 0) {
      const ids = [...players.keys()];
      const pick = ids[Math.floor(Math.random() * ids.length)];
      game.it = [pick];
      hostFeed(`${nameOf(pick)} is now IT`);
    }
  }
  pushState();
}

function hostTick(dt) {
  const mine = players.get(myId);
  if (mine) { mine.tp.copy(me.pos); mine.yaw = me.yaw; mine.pitch = me.pitch; mine.mode = me.mode(); mine.talk = talkT > 0; }

  if (game.phase === 'playing') {
    if (H.releaseLeft > 0) {
      H.releaseLeft -= dt;
      if (H.releaseLeft <= 0) { H.releaseLeft = 0; if (game.mode !== 'duel') hostFeed('Seekers released!'); }
    } else {
      H.timeLeft -= dt;
      if (game.mode === 'classic') for (const id of game.it) if (game.scores[id]) game.scores[id].it += dt;
    }
    game.tl = Math.max(0, H.timeLeft);
    game.rl = H.releaseLeft;
    if (H.timeLeft <= 0) {
      if (game.mode === 'duel') duelPoint(game.duel.ids.find((i) => i !== game.it[0]), 'survived');
      else hostEndRound(game.mode === 'classic' ? 'Least time as IT wins' : null);
    }
    H.stateAcc += dt;
    if (H.stateAcc >= 1 && game.phase === 'playing') { H.stateAcc = 0; pushState(); }
  } else if (game.phase === 'results') {
    H.resultsLeft -= dt;
    if (H.resultsLeft <= 0) { game.phase = 'lobby'; game.result = null; game.it = []; pushState(); }
  }

  H.snapAcc += dt;
  if (H.snapAcc >= 1 / CONFIG.net.sendRate - 0.005) {
    H.snapAcc = 0;
    const p = {};
    for (const pl of players.values()) p[pl.id] = [r2(pl.tp.x), r2(pl.tp.y), r2(pl.tp.z), r2(pl.yaw), r2(pl.pitch), pl.mode, pl.talk ? 1 : 0];
    Net.broadcast({ t: 'snap', p, tl: r2(game.tl), rl: r2(game.rl) });
  }
}

// ---------- client ----------
function clientHandle(m) {
  switch (m.t) {
    case 'state': applyState(m); break;
    case 'snap': applySnap(m); break;
    case 'tp': if (Array.isArray(m.p)) me.teleport(m.p, faceCenter(m.p)); break;
    case 'feed': addFeed(String(m.text).slice(0, 120)); break;
    case 'tagev': showTagEvent(String(m.from), String(m.to)); break;
    case 'full': inGame = false; showMsg('Lobby full', 'That game already has the maximum number of players.'); break;
    case 'oldver': {
      inGame = false;
      const theyNewer = (+m.v || 0) > CONFIG.version;
      showMsg('Different versions', theyNewer
        ? 'The host has a newer version of Scamper. Refresh this page (Cmd/Ctrl+Shift+R), then join again.'
        : 'The host has an older version of Scamper. Ask them to refresh their page, then host again.');
      break;
    }
  }
}

let netAcc = 0;
function clientTick(dt) {
  if (game.phase === 'playing') {
    if (game.rl > 0) game.rl = Math.max(0, game.rl - dt);
    else game.tl = Math.max(0, game.tl - dt);
  }
  netAcc += dt;
  if (netAcc >= 1 / CONFIG.net.sendRate - 0.005) {
    netAcc = 0;
    Net.send({ t: 'me', s: [r2(me.pos.x), r2(me.pos.y), r2(me.pos.z), r2(me.yaw), r2(me.pitch), me.mode(), talkT > 0 ? 1 : 0] });
  }
}

Net.onMessage = (from, m) => {
  if (!m || typeof m !== 'object') return;
  if (Net.isHost) hostHandle(from, m);
  else if (from === 'host') clientHandle(m);
};
Net.onLeave = (id) => { if (Net.isHost) hostOnLeave(id); };
Net.onLost = () => {
  if (!inGame) return;
  inGame = false;
  if (document.exitPointerLock) document.exitPointerLock();
  showMsg('Disconnected', 'The host closed the game or the connection dropped.');
};

let lastNet = performance.now();
setInterval(() => {
  const now = performance.now(), dt = Math.min((now - lastNet) / 1000, 1.5);
  lastNet = now;
  if (!inGame) return;
  if (Net.isHost) hostTick(dt); else clientTick(dt);
}, 50);

// ---------- tagging (local side) ----------
const tagCooldown = {};
// Tagging is contact only. Everyone (host included) checks contact against the smoothed
// positions they see on screen, and the host accepts any tag within the same lag allowance.
let tagReadyAt = 0, tagHint = '', tagHintUntil = 0;
function tryTag(id) {
  const now = performance.now();
  if ((tagCooldown[id] || 0) > now) return;
  tagCooldown[id] = now + 250;
  if (now < tagReadyAt) return;
  // classic: no instant tag-backs - tell the player instead of silently failing
  const lt = game.lastTag;
  if (game.mode === 'classic' && lt && lt.from === id && lt.to === myId) {
    const left = CONFIG.tag.noTagBack - (now - lt.at) / 1000;
    if (left > 0) { tagHint = `No tag-backs on ${nameOf(id)} for ${left.toFixed(1)}s`; tagHintUntil = now + 400; return; }
  }
  if (Net.isHost) hostTryTag(myId, id);
  else Net.send({ t: 'tag', id });
}
const canTag = () => game.phase === 'playing' && game.rl <= 0 && isIt(myId);

// big readable message for whoever was involved in a tag
let talkT = 0;
function taunt(secs = 1.1) {
  talkT = Math.max(talkT, secs);
  for (let i = 0; i < 5; i++) tone(260 + Math.random() * 260, 180 + Math.random() * 200, 0.07, 'square', 0.035, i * 0.11);
}
function showTagEvent(from, to) {
  if (from === myId) talkT = Math.max(talkT, 0.8);
  if (from === myId || to === myId) shake = 0.5;
  nearFlag = false;
  if (to === myId) {
    flash('rgba(255,40,60,.55)');
    SFX.tagged();
    tagReadyAt = performance.now() + CONFIG.tag.tagDelay * 1000;
    const what = game.mode === 'duel' ? 'CAUGHT' : game.mode === 'infection' ? 'INFECTED' : "YOU'RE IT";
    showBanner(`<div class="big red">${what}</div><div>Tagged by ${esc(nameOf(from))}${game.mode === 'duel' ? '' : ` - you can tag in ${CONFIG.tag.tagDelay}s`}</div>`, 2.4);
  } else if (from === myId) {
    SFX.tag();
    tagAnim = 1;
    showBanner(`<div class="big lime">TAGGED!</div><div>You got ${esc(nameOf(to))}${game.mode === 'classic' ? ' - now run' : ''}</div>`, 1.8);
  }
}

// ---------- input ----------
const keys = new Set();
let locked = false;
const bound = (action, code) => CONFIG.keys[action].includes(code);
const held = (action) => CONFIG.keys[action].some((c) => keys.has(c));
const isTyping = () => ['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement && document.activeElement.tagName);

let rebinding = null;  // { action, slot } while waiting for a key in the Controls menu

addEventListener('keydown', (e) => {
  if (rebinding) { e.preventDefault(); finishRebind(e.code); return; }
  if (!inGame || isTyping()) return;
  if (bound('pause', e.code) && !e.repeat) {
    if (locked) document.exitPointerLock(); else lock();
    return;
  }
  if (bound('scoreboard', e.code)) { e.preventDefault(); $('scoreboard').classList.remove('hidden'); renderScoreboard(); }
  if (!locked) return;
  if (e.code === 'Space' || e.code === 'Tab') e.preventDefault();
  keys.add(e.code);
  if (bound('jump', e.code) && !e.repeat) me.queueJump();
  if (bound('taunt', e.code) && !e.repeat) taunt();
  if (e.code === 'Enter' && Net.isHost && game.phase === 'lobby') hostStartRound();
});
addEventListener('keyup', (e) => {
  keys.delete(e.code);
  if (bound('scoreboard', e.code)) $('scoreboard').classList.add('hidden');
});
addEventListener('blur', () => { keys.clear(); $('scoreboard').classList.add('hidden'); });
addEventListener('mousedown', (e) => {
  if (rebinding) {
    e.preventDefault();
    if (e.button === 0) cancelRebind(); else finishRebind('Mouse' + e.button);
    return;
  }
  if (!locked) return;
  if (e.button === 0) return;
  const code = 'Mouse' + e.button;
  keys.add(code);
  if (bound('jump', code)) me.queueJump();
});
addEventListener('mouseup', (e) => keys.delete('Mouse' + e.button));
addEventListener('contextmenu', (e) => { if (inGame || rebinding) e.preventDefault(); });
addEventListener('mousemove', (e) => {
  if (!locked) return;
  const k = 0.0022 * settings.sens;
  me.yaw -= e.movementX * k;
  me.pitch = Math.max(-1.55, Math.min(1.55, me.pitch - e.movementY * k * (settings.invertY ? -1 : 1)));
});

function readInput() {
  return {
    f: (held('forward') ? 1 : 0) - (held('back') ? 1 : 0),
    r: (held('right') ? 1 : 0) - (held('left') ? 1 : 0),
    run: held('run') || settings.autorun,
    crouch: held('slide'),
  };
}
const NO_INPUT = { f: 0, r: 0, run: false, crouch: false };

function lock() {
  audio();
  try {
    const r = renderer.domElement.requestPointerLock();
    if (r && r.catch) r.catch(() => {});
  } catch (e) {}
}
document.addEventListener('pointerlockchange', () => {
  locked = document.pointerLockElement === renderer.domElement;
  if (!locked) keys.clear();
  if (!inGame) return;
  if (locked) {
    $('pause').classList.add('hidden');
    $('hud').classList.remove('hidden');
    $('pauseTitle').textContent = 'PAUSED';
    $('resumeBtn').textContent = 'Resume';
    cancelRebind();
  } else {
    openPause();
  }
});
renderer.domElement.addEventListener('click', () => { if (inGame && !locked) lock(); });

// ---------- menus (main + escape share the Settings / Controls panels) ----------
function showView(root, name) {
  cancelRebind();
  root.querySelectorAll('.nav-btn[data-view]').forEach((b) => b.classList.toggle('active', b.dataset.view === name));
  root.querySelectorAll('.view').forEach((v) => v.classList.toggle('hidden', v.dataset.view !== name));
  const slot = root.querySelector(`.view[data-view="${name}"] .slot`);
  if (slot) slot.appendChild($(slot.dataset.panel + 'Panel'));
  if (name === 'controls') renderBinds();
}
for (const root of [$('menu'), $('pause')]) {
  root.querySelectorAll('.nav-btn[data-view]').forEach((b) => (b.onclick = () => showView(root, b.dataset.view)));
}
function openPause() {
  $('pause').classList.remove('hidden');
  $('hud').classList.add('hidden');
  showView($('pause'), 'lobby');
  updatePauseUI();
}

function updatePauseUI() {
  const playing = game.phase === 'playing';
  const hostId = Net.isHost ? myId : CONFIG.net.prefix + Net.code;
  $('pauseCode').innerHTML = (Net.code || '----').split('').map((ch) => `<i>${esc(ch)}</i>`).join('');
  $('lobbySub').textContent = playing ? `${modeName()} in progress`
    : game.phase === 'results' ? 'Round over - back to warmup in a few seconds'
    : 'Warmup - free roam until the host starts a round';
  $('hostControls').classList.toggle('hidden', !Net.isHost);
  $('clientNote').classList.toggle('hidden', Net.isHost);
  $('clientNote').textContent = playing ? 'Round in progress.' : 'Waiting for the host to start the round.';
  $('mapSel').value = game.map;
  renderSetup();
  $('startBtn').classList.toggle('hidden', playing);
  $('startSummary').classList.toggle('hidden', playing);
  $('endBtn').classList.toggle('hidden', !playing);
  const duelPick = $('modeSel').value === 'duel', needs = duelPick ? players.size !== 2 : players.size < 2;
  $('startBtn').disabled = needs;
  $('startBtn').textContent = !needs ? 'Start round' : duelPick ? 'Duel needs exactly 2 players' : 'Need 2+ players to start';
  $('playerCount').textContent = `Players · ${players.size} / ${CONFIG.tag.maxPlayers}`;
  $('playerList').innerHTML = [...players.values()].map((p) => {
    const it = playing && isIt(p.id);
    const tag = it ? `<span class="tag it">${{ infection: 'Seeker', duel: 'Chaser' }[game.mode] || 'IT'}</span>`
      : p.id === hostId ? '<span class="tag">Host</span>' : '';
    return `<li><span class="dot" style="background:${esc(p.color)}"></span>${esc(p.name)}` +
      `${p.id === myId ? ' <span class="you">(you)</span>' : ''}${tag}</li>`;
  }).join('');
}

$('resumeBtn').onclick = lock;
$('startBtn').onclick = () => { hostStartRound(); lock(); };
$('endBtn').onclick = () => hostEndRound('Ended by host');
// --- round setup cards (they drive the hidden selects) ---
const MODES = [
  { id: 'classic', name: 'Classic tag', desc: 'One player is IT. Tag someone to pass it on. Least time as IT wins.' },
  { id: 'infection', name: 'Infection', desc: 'Tagged players become seekers. Survive the timer to win.' },
  { id: 'duel', name: 'Duel', desc: '1v1 timed chases. Tag or survive to score. First to the target wins.' },
];
const canEditSetup = () => Net.isHost && game.phase !== 'playing';
function setupChanged() {
  game.setup = { mode: $('modeSel').value, round: +$('lenSel').value, chase: +$('chaseSel').value, target: +$('targetSel').value };
  if (Net.isHost && inGame) pushState(); else updatePauseUI();
}
const pillSet = (el, sel) => {
  el.innerHTML = [...$(sel).options].map((o) => `<button class="pill" data-v="${o.value}">${o.textContent}</button>`).join('');
  el.onclick = (e) => {
    const b = e.target.closest('.pill');
    if (!b || !canEditSetup()) return;
    $(sel).value = b.dataset.v;
    setupChanged();
  };
};
$('mapCards').innerHTML = MAPS.map((m) => {
  const [a, b] = m.accent || ['#333', '#555'];
  return `<button class="map-card" data-id="${m.id}">
    <div class="map-thumb" style="background:linear-gradient(90deg, ${a} 0 50%, ${b} 50% 100%)"></div>
    <div class="map-body"><span class="map-name">${esc(m.name)}</span></div>
  </button>`;
}).join('');
$('mapCards').onclick = (e) => {
  const c = e.target.closest('.map-card');
  if (!c || !canEditSetup()) return;
  $('mapSel').value = c.dataset.id;
  $('mapSel').onchange();
};
$('modeCards').innerHTML = MODES.map((m) => `<button class="mode-card" data-id="${m.id}"><b>${m.name}</b><span>${m.desc}</span><span class="warn"></span></button>`).join('');
let modePicked = false;
function autoMode() {
  if (!Net.isHost || modePicked || game.phase === 'playing') return;
  const want = players.size === 2 ? 'duel' : 'classic';
  if ($('modeSel').value !== want) { $('modeSel').value = want; setupChanged(); }
}
$('modeCards').onclick = (e) => {
  const c = e.target.closest('.mode-card');
  if (!c || !canEditSetup()) return;
  modePicked = true;
  $('modeSel').value = c.dataset.id;
  setupChanged();
};
pillSet($('lenPills'), 'lenSel');
pillSet($('chasePills'), 'chaseSel');
pillSet($('targetPills'), 'targetSel');

function renderSetup() {
  // non-hosts mirror whatever the host picked
  if (!Net.isHost && game.setup) {
    $('modeSel').value = game.setup.mode;
    $('lenSel').value = game.setup.round;
    $('chaseSel').value = game.setup.chase;
    $('targetSel').value = game.setup.target;
  }
  const edit = canEditSetup(), mode = $('modeSel').value, duel = mode === 'duel';
  document.querySelector('.setup').classList.toggle('locked', !edit);
  document.querySelectorAll('.map-card').forEach((c) => { c.classList.toggle('on', c.dataset.id === game.map); c.disabled = !edit; });
  $('mapPickBlurb').textContent = World.map.blurb;
  document.querySelectorAll('.mode-card').forEach((c) => {
    c.classList.toggle('on', c.dataset.id === mode);
    c.disabled = !edit;
    c.querySelector('.warn').textContent = c.dataset.id === 'duel' && players.size !== 2 ? `Needs exactly 2 players (${players.size} here)`
      : c.dataset.id === 'infection' && players.size === 2 ? 'With 2 players this ends at the first tag - try Duel' : '';
  });
  for (const [el, sel] of [['lenPills', 'lenSel'], ['chasePills', 'chaseSel'], ['targetPills', 'targetSel']]) {
    $(el).querySelectorAll('.pill').forEach((p) => { p.classList.toggle('on', p.dataset.v === $(sel).value); p.disabled = !edit; });
  }
  $('lenPills').classList.toggle('hidden', duel);
  $('duelPills').classList.toggle('hidden', !duel);
  $('lenLabel').textContent = duel ? 'Chase rules' : 'Round length';
  const mName = MODES.find((m) => m.id === mode).name;
  $('startSummary').innerHTML = duel
    ? `<b>${mName}</b> on <b>${esc(World.map.name)}</b> · ${$('chaseSel').selectedOptions[0].textContent} chases · first to ${$('targetSel').value}`
    : `<b>${mName}</b> on <b>${esc(World.map.name)}</b> · ${$('lenSel').selectedOptions[0].textContent}`;
}
$('mapSel').innerHTML = MAPS.map((m) => `<option value="${m.id}">${esc(m.name)}</option>`).join('');
$('mapSel').onchange = () => {
  if (Net.isHost && inGame) hostSetMap($('mapSel').value);
  else $('mapBlurb').textContent = getMap($('mapSel').value).blurb;
};
$('mapList').innerHTML = MAPS.map((m) => `<li><b>${esc(m.name)}</b> - ${esc(m.blurb)}</li>`).join('');
$('leaveBtn').onclick = () => { Net.destroy(); location.reload(); };
const copyText = (btn, text, label) => {
  const done = () => { btn.textContent = 'Copied!'; setTimeout(() => (btn.textContent = label), 1200); };
  if (navigator.clipboard) navigator.clipboard.writeText(text).then(done, () => {});
};
$('copyBtn').onclick = () => copyText($('copyBtn'), Net.code, 'Copy code');
$('inviteBtn').onclick = () => copyText($('inviteBtn'), `${location.origin}${location.pathname}?code=${Net.code}`, 'Copy invite link');

// settings
function bindRange(id, key, fmt) {
  const el = $(id), show = () => ($(id + 'Val').textContent = fmt(settings[key]));
  el.value = settings[key];
  show();
  el.oninput = () => { settings[key] = +el.value; show(); saveSettings(); };
}
function bindToggle(id, key, after) {
  const el = $(id);
  el.checked = !!settings[key];
  el.onchange = () => { settings[key] = el.checked; saveSettings(); if (after) after(); };
}
// performance mode: lower resolution cap, no shadows
function applyPerf() {
  setResMax();
  renderer.setSize(innerWidth, innerHeight);
  if (sun.castShadow === !settings.perf) return;
  sun.castShadow = !settings.perf;
  scene.traverse((o) => { if (o.material) o.material.needsUpdate = true; });
  renderer.shadowMap.needsUpdate = true;
}
applyPerf();
const applySpeedVis = () => $('speed').classList.toggle('hidden', !settings.showSpeed);
bindRange('sens', 'sens', (v) => v.toFixed(2));
bindRange('fov', 'fov', (v) => `${v}°`);
bindRange('vol', 'volume', (v) => `${Math.round(v * 100)}%`);
bindRange('shakeAmt', 'shake', (v) => (v === 0 ? 'off' : `${Math.round(v * 100)}%`));
bindToggle('autorun', 'autorun');
bindToggle('invertY', 'invertY');
bindToggle('showSpeed', 'showSpeed', applySpeedVis);
bindToggle('perf', 'perf', applyPerf);
applySpeedVis();

// key bindings
const BIND_LABELS = {
  forward: 'Move forward', back: 'Move back', left: 'Move left', right: 'Move right',
  jump: 'Jump / wall kick', run: 'Run', slide: 'Slide / crouch', scoreboard: 'Scoreboard', pause: 'Pause menu', taunt: 'Taunt (talk)',
};
const KEY_NAMES = {
  Space: 'Space', ShiftLeft: 'L Shift', ShiftRight: 'R Shift', ControlLeft: 'L Ctrl', ControlRight: 'R Ctrl',
  AltLeft: 'L Alt', AltRight: 'R Alt', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',
  Mouse1: 'Middle mouse', Mouse2: 'Right mouse', Mouse3: 'Mouse 4', Mouse4: 'Mouse 5',
  CapsLock: 'Caps Lock', Backquote: '`', Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']',
  Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/', Backslash: '\\',
};
function keyName(c) {
  if (!c) return 'None';
  if (KEY_NAMES[c]) return KEY_NAMES[c];
  if (c.startsWith('Key')) return c.slice(3);
  if (c.startsWith('Digit')) return c.slice(5);
  if (c.startsWith('Numpad')) return 'Num ' + c.slice(6);
  return c;
}
function renderBinds() {
  $('bindRows').innerHTML = Object.keys(BIND_LABELS).map((a) => {
    const k = CONFIG.keys[a];
    const btn = (i) => {
      const listening = rebinding && rebinding.action === a && rebinding.slot === i;
      return `<button class="bind${!k[i] ? ' empty' : ''}${listening ? ' listening' : ''}" data-action="${a}" data-slot="${i}">` +
        `${listening ? 'Press a key' : esc(keyName(k[i]))}</button>`;
    };
    return `<tr><td>${BIND_LABELS[a]}</td><td>${btn(0)}${btn(1)}</td></tr>`;
  }).join('');
}
$('bindRows').addEventListener('click', (e) => {
  const b = e.target.closest('.bind');
  if (!b) return;
  rebinding = { action: b.dataset.action, slot: +b.dataset.slot };
  renderBinds();
});
function cancelRebind() {
  if (!rebinding) return;
  rebinding = null;
  renderBinds();
}
function finishRebind(code) {
  const { action, slot } = rebinding;
  rebinding = null;
  if (code !== 'Escape') {
    const list = CONFIG.keys[action].slice();
    if (code === 'Backspace' || code === 'Delete') list.splice(slot, 1);
    else {
      for (const a in CONFIG.keys) if (a !== action) CONFIG.keys[a] = CONFIG.keys[a].filter((c) => c !== code);
      list[Math.min(slot, list.length)] = code;
    }
    CONFIG.keys[action] = [...new Set(list.filter(Boolean))].slice(0, 2);
    settings.keys = JSON.parse(JSON.stringify(CONFIG.keys));
    saveSettings();
  }
  renderBinds();
}
$('resetBinds').onclick = () => {
  for (const a in DEFAULT_KEYS) CONFIG.keys[a] = DEFAULT_KEYS[a].slice();
  delete settings.keys;
  saveSettings();
  cancelRebind();
  renderBinds();
};

function renderScoreboard() {
  const sb = $('scoreboard');
  if (sb.classList.contains('hidden')) return;
  const classic = game.mode === 'classic', duel = game.mode === 'duel' && game.duel;
  const rows = [...players.values()].map((p) => {
    const s = game.scores[p.id] || { it: 0, tags: 0 };
    const it = isIt(p.id) && game.phase !== 'lobby';
    const role = game.phase === 'lobby' ? '-'
      : duel ? (!inDuel(p.id) ? 'Spectator' : it ? 'Chaser' : 'Evader')
      : it ? (classic ? 'IT' : 'Seeker') : 'Runner';
    return `<tr class="${it ? 'is-it' : ''}${p.id === myId ? ' is-me' : ''}">
      <td><span class="dot" style="background:${esc(p.color)}"></span>${esc(p.name)}${p.id === myId ? ' (you)' : ''}</td>
      <td>${role}</td><td>${classic ? s.it.toFixed(1) + 's' : duel ? (game.duel.pts[p.id] ?? '-') : '-'}</td><td>${s.tags}</td></tr>`;
  }).join('');
  sb.innerHTML = `<h3>${modeName()} <span>code ${esc(Net.code)}</span></h3>
    <table><thead><tr><th>Player</th><th>Role</th><th>${duel ? 'Points' : 'Time as IT'}</th><th>Tags</th></tr></thead><tbody>${rows}</tbody></table>`;
}

// ---------- main loop ----------
let last = performance.now(), acc = 0, prevRl = 0;
let fovNow = settings.fov, eyeH = M.standHeight - M.eyeFromTop, roll = 0, landOff = 0;
let camFoot = 0, fovPunch = 0, pitchKick = 0, rollKick = 0, carve = 0, prevYaw = 0, stepSide = 1, bob = 0, bobW = 0, kickAnim = 0, kickSide = 1, tagAnim = 0, menuT = 0, sbTimer = 0;

// watch frame times: drop the resolution when frames take clearly longer than the screen's refresh,
// creep back up when there's room. res.best tracks the screen's refresh interval.
function autoRes(raw) {
  if (!(raw > 0 && raw < 0.25) || document.hidden) return;
  res.avg += (raw - res.avg) * 0.05;
  res.best = Math.min(res.best * 1.0005, Math.max(1 / 240, res.avg));
  if (res.avg > res.best * 1.25) { res.slow += raw; res.fast = 0; }
  else if (res.avg < res.best * 1.08) { res.fast += raw; res.slow = 0; }
  else { res.slow = res.fast = 0; }
  let next = res.now;
  if (res.slow > 1) next = Math.max(0.6, res.now - 0.15);
  else if (res.fast > 6) next = Math.min(res.max, res.now + 0.1);
  if (next !== res.now) {
    res.now = next;
    res.slow = res.fast = 0;
    renderer.setPixelRatio(next);
    renderer.setSize(innerWidth, innerHeight);
  }
}

function frame(now) {
  requestAnimationFrame(frame);
  const raw = (now - last) / 1000;
  const dt = Math.max(0, Math.min(raw, 0.05));   // first frame can be negative
  last = now;
  autoRes(raw);
  World.animate(now / 1000, dt);
  if (inGame) updateGame(dt);
  else {
    const mc = World.map.menuCam;
    menuT += dt * 0.07;
    if (mc.path) {   // drift slowly back and forth between two points, looking toward the second
      const [a, b] = mc.path, f = (1 - Math.cos(menuT * 2)) / 2;
      camera.position.set(a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f);
      camera.lookAt(b[0] * 2 - a[0], b[1] - 0.3, b[2] * 2 - a[2]);
    } else {
      camera.position.set(Math.cos(menuT) * mc.r, mc.y, Math.sin(menuT) * mc.r);
      camera.lookAt(0, Math.min(2, mc.y - 1), 0);
    }
  }
  renderPreview(dt);
  renderer.render(scene, camera);
  if (inGame) {
    vmCam.rotation.z = camera.rotation.z;
    renderer.autoClear = false;
    renderer.clearDepth();
    renderer.render(vmScene, vmCam);
    renderer.autoClear = true;
  }
}

function updateGame(dt) {
  const frozen = game.phase === 'playing' && game.rl > 0 && (isIt(myId) || inDuel(myId));
  const duelChaser = game.phase === 'playing' && game.mode === 'duel' && isIt(myId);
  const seeking = game.phase === 'playing' && game.rl <= 0 && isIt(myId);
  me.speedMul = duelChaser ? (game.rl <= 0 ? CONFIG.tag.duelChaserSpeed : 1) : seeking ? CONFIG.tag.seekerSpeed : 1;
  const reachBonus = duelChaser ? CONFIG.tag.duelReachBonus : 0;
  const inp = locked && !frozen ? readInput() : NO_INPUT;
  if (frozen) me.jumpBuf = 0;

  acc += dt;
  let n = 0;
  while (acc >= STEP && n < 10) { me.step(STEP, inp); acc -= STEP; n++; }
  if (n >= 10) acc = 0;

  // the void: during a round you come back as a seeker
  if (me.pos.y < World.map.killY) {
    const playing = game.phase === 'playing';
    const sp = playing && game.mode !== 'duel' ? World.map.seekerSpawn : randomSpawn();
    me.teleport(sp, faceCenter(sp));
    flash('rgba(0,0,0,.9)');
    if (playing) { if (Net.isHost) hostFell(myId); else Net.send({ t: 'fell' }); }
  }

  // movement events -> sound + camera
  const ev = me.ev;
  me.ev = {};
  if (ev.jump) { SFX.jump(); fovPunch += 2.5; pitchKick -= 0.025; }
  if (ev.slide) { SFX.slide(); fovPunch += 7; shake = Math.max(shake, 0.35); landOff -= 0.12; }
  if (ev.mantle) { SFX.mantle(); pitchKick += 0.06; shake = Math.max(shake, 0.2); }
  if (ev.pad) { SFX.pad(); fovPunch += 12; shake = Math.max(shake, 0.6); pitchKick += 0.05; }
  if (ev.kick) {
    SFX.kick();
    kickAnim = 1;
    const s = ev.kick.x * Math.cos(me.yaw) - ev.kick.z * Math.sin(me.yaw);
    kickSide = s < 0 ? 1 : -1;
    rollKick += kickSide * 0.11;
    fovPunch += 6;
    shake = Math.max(shake, 0.4);
  }
  if (ev.land > 6) {
    SFX.land();
    landOff -= Math.min(ev.land * 0.014, 0.38);
    shake = Math.max(shake, Math.min(0.9, (ev.land - 6) / 22));
    pitchKick -= Math.min(0.07, ev.land * 0.003);
  }

  // release countdown finished
  if (game.phase === 'playing' && prevRl > 0 && game.rl <= 0) {
    SFX.go();
    showBanner(isIt(myId) ? '<div class="big red">GO!</div><div>Tag them</div>'
      : inDuel(myId) ? '<div class="big lime">GO!</div><div>Run!</div>'
      : '<div class="big">SEEKERS RELEASED</div>', 1.4);
  }
  prevRl = game.phase === 'playing' ? game.rl : 0;

  // bump-to-tag, against where you SEE them
  if (canTag()) {
    for (const p of players.values()) {
      if (p.id === myId || isIt(p.id) || !p.avatar) continue;
      const q = p.avatar.root.position;
      const d = Math.hypot(q.x - me.pos.x, (q.y - me.pos.y) * 0.8, q.z - me.pos.z);
      if (d < CONFIG.tag.touchRange + reachBonus) tryTag(p.id);
    }
  }

  // camera
  const hs = me.hspeed();
  const C = CONFIG.camera;
  const ease = (k) => 1 - Math.exp(-k * dt);
  eyeH += ((me.h - M.eyeFromTop) - eyeH) * ease(14);
  const onFoot = me.grounded && !me.sliding;
  if (onFoot && hs > 0.5) bob += dt * hs * 1.25;
  bobW += ((onFoot ? Math.min(hs / M.runSpeed, 1.2) : 0) - bobW) * ease(10);
  landOff += (0 - landOff) * ease(9);
  const footY = me.pos.y;
  if (me.grounded && Math.abs(footY - camFoot) < 0.9) camFoot += (footY - camFoot) * ease(16); else camFoot = footY;
  // sliding rumbles harder the faster you go
  if (me.sliding && me.grounded) shake = Math.max(shake, Math.min(0.45, hs / 45));
  shake = Math.max(0, shake - dt * 1.4);
  const tr = shake * shake * C.shake * settings.shake, tt = performance.now() / 1000;
  const n1 = Math.sin(tt * 47.3) * 0.6 + Math.sin(tt * 23.1) * 0.4, n2 = Math.sin(tt * 39.7 + 1.3) * 0.6 + Math.sin(tt * 17.9) * 0.4, n3 = Math.sin(tt * 31.1 + 2.1);
  camera.position.set(me.pos.x + n1 * tr * 0.12, camFoot + eyeH + Math.sin(bob * 2) * C.bob * bobW + landOff + n2 * tr * 0.12, me.pos.z);

  // lean: strafe tilt, slide carve (lean into the turn), wall hang, kick-off roll
  const turn = me.yaw - prevYaw;
  prevYaw = me.yaw;
  carve += ((me.sliding ? Math.max(-0.12, Math.min(0.12, turn / Math.max(dt, 1e-4) * 0.03)) : 0) - carve) * ease(6);
  let rollT = (me.sliding ? C.slideRoll : 0) - inp.r * 0.02 + carve;
  if (me.hanging && me.wall) rollT -= (me.wall.n.x * Math.cos(me.yaw) - me.wall.n.z * Math.sin(me.yaw)) * C.wallRoll;
  roll += (rollT - roll) * ease(8);
  rollKick *= Math.exp(-6 * dt);
  pitchKick *= Math.exp(-7 * dt);
  camera.rotation.set(me.pitch + pitchKick + n3 * tr * 0.02, me.yaw + n1 * tr * 0.012, roll + rollKick + n2 * tr * 0.025);

  const sp = Math.max(0, Math.min(1, (hs - M.walkSpeed) / (18 - M.walkSpeed)));
  fovPunch *= Math.exp(-5 * dt);
  fovNow += (settings.fov + C.speedFov * sp + fovPunch - fovNow) * ease(10);
  setSpeedlines(Math.max(0, Math.min(0.85, (hs - 12) / 10)).toFixed(2));
  motionAudio(hs, onFoot);
  if (Math.abs(camera.fov - fovNow) > 0.01) { camera.fov = fovNow; camera.updateProjectionMatrix(); }

  // arms
  kickAnim = Math.max(0, kickAnim - dt * 4);
  tagAnim = Math.max(0, tagAnim - dt * 5);
  const sw = Math.sin(bob) * bobW;
  for (const a of arms) {
    const s = a.userData.side;
    let x = s * 0.22, y = -0.24, z = -0.58, rx = 0;
    z += sw * s * 0.07;
    y -= Math.abs(Math.sin(bob)) * 0.02 * bobW;
    if (me.sliding) { y -= 0.06; x += s * 0.06; rx = 0.35; }
    if (!me.grounded) y += 0.04 * Math.max(-1, Math.min(1, me.vel.y / 10));
    if (kickAnim > 0 && s === kickSide) { x += s * 0.08 * kickAnim; z -= 0.18 * kickAnim; }
    if (s === 1 && tagAnim > 0) { const t = Math.sin(tagAnim * Math.PI); z -= 0.3 * t; x -= 0.1 * t; }
    a.position.set(x, y, z);
    a.rotation.set(rx, 0, 0);
  }

  // other players
  const k = ease(14);
  let nearestSeeker = Infinity;
  for (const p of players.values()) {
    const a = p.avatar;
    if (!a) continue;
    const px = a.root.position.x, py = a.root.position.y, pz = a.root.position.z;
    if (p.snapNext) { a.root.position.copy(p.tp); p.snapNext = false; }
    else a.root.position.lerp(p.tp, k);
    const sp = Math.min(30, Math.hypot(a.root.position.x - px, a.root.position.z - pz) / dt);
    a.spd += (sp - a.spd) * ease(8);
    a.vy += (Math.max(-30, Math.min(30, (a.root.position.y - py) / dt)) - a.vy) * ease(8);
    animateScamp(a.scamp, dt, performance.now() / 1000, a.spd, p.mode, Math.abs(a.vy) > 1.5 && p.mode !== 1, p.talk);
    a.root.rotation.y = lerpAngle(a.root.rotation.y, p.yaw, k);
    a.rig.rotation.x += ((p.mode === 1 ? 1.05 : 0) - a.rig.rotation.x) * k;
    a.rig.scale.y += ((p.mode === 2 ? 0.62 : 1) - a.rig.scale.y) * k;
    const it = isIt(p.id) && game.phase !== 'lobby';
    a.itMark.visible = a.ring.visible = it;
    a.xray.visible = game.phase === 'playing' && game.mode === 'duel' && isIt(myId) && inDuel(p.id) && !it;
    if (a.xray.visible) a.xray.children[2].scale.setScalar(0.5 + Math.min(1.2, a.root.position.distanceTo(me.pos) / 25));
    a.bodyMat.emissive.setHex(it ? 0x661018 : 0x000000);
    if (it) nearestSeeker = Math.min(nearestSeeker, a.root.position.distanceTo(me.pos));
    // blob shadow on whatever is under them, fading as they get higher
    const rp = a.root.position, fy = World.floorBelow(rp.x, rp.y + 0.3, rp.z), up = rp.y - fy;
    a.blob.visible = fy > -1e8 && up < 6;
    if (a.blob.visible) {
      a.blob.position.set(rp.x, fy + 0.02, rp.z);
      a.blob.scale.setScalar(1 + up * 0.12);
      a.blob.material.opacity = 0.42 * (1 - up / 6);
    }
  }

  talkT = Math.max(0, talkT - dt);
  updateHud(hs, frozen, nearestSeeker);
  twoPlayerFx(dt, nearestSeeker);
  sbTimer += dt;
  if (sbTimer > 0.5) { sbTimer = 0; renderScoreboard(); }
}

// --- motion audio: footsteps, wind and slide scrape (all built from one noise buffer) ---
let windGain = null, scrapeGain = null, lastStep = 0;
function startMotionAudio() {
  if (!actx || windGain) return;
  const len = actx.sampleRate * 2, buf = actx.createBuffer(1, len, actx.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const loop = (type, freq, q) => {
    const src = actx.createBufferSource(); src.buffer = buf; src.loop = true;
    const f = actx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = actx.createGain(); g.gain.value = 0;
    src.connect(f).connect(g).connect(actx.destination); src.start();
    return g;
  };
  windGain = loop('lowpass', 600, 0.7);
  scrapeGain = loop('bandpass', 1800, 1.2);
}
function motionAudio(hs, onFoot) {
  if (!actx) return;
  startMotionAudio();
  const v = settings.volume, t = actx.currentTime;
  windGain.gain.setTargetAtTime(Math.max(0, Math.min(0.12, (hs - 7) / 120)) * v, t, 0.15);
  scrapeGain.gain.setTargetAtTime((me.sliding && me.grounded ? Math.min(0.09, hs / 200) : 0) * v, t, 0.05);
  // a footstep every time the stride swings through
  const stride = Math.floor(bob / Math.PI);
  if (onFoot && hs > 2 && stride !== lastStep) { stepSide = -stepSide; tone(stepSide > 0 ? 150 : 135, 60, 0.06, 'triangle', 0.05 + hs / 400); }
  lastStep = stride;
}

let speedOp = '';
function setSpeedlines(op) {
  if (op === speedOp) return;
  speedOp = op;
  const el = $('speedlines');
  el.style.opacity = op;
  el.classList.toggle('on', op !== '0.00');
}

// --- 2-player helpers: where's the other player, heartbeat, countdowns, close calls ---
let shake = 0, nearFlag = false, closeCallAt = 0, beatT = 0, lastCount = 0, lastTick = 0;
const projV = new THREE.Vector3();
function twoPlayerFx(dt, nearestSeeker) {
  const playing = game.phase === 'playing', now = performance.now(), amIt = playing && isIt(myId);
  // 3-2-1 before every chase / round
  const n = playing && game.rl > 0 ? Math.ceil(game.rl) : 0;
  if (n !== lastCount) {
    lastCount = n;
    if (n > 0 && n <= 3) {
      const el = $('countdown');
      el.textContent = n;
      el.classList.remove('go'); void el.offsetWidth; el.classList.add('go');
      SFX.count();
    }
  }
  // tick through the last 5 seconds
  const tl = Math.ceil(game.tl);
  if (playing && game.rl <= 0 && tl <= 5 && tl > 0 && tl !== lastTick) { lastTick = tl; SFX.tick(); }
  if (!playing) lastTick = 0;

  // edge arrow to the other player whenever they're off-screen (any mode, 2 players)
  const ptr = $('pointer');
  const other = players.size === 2 && playing ? [...players.values()].find((p) => p.id !== myId) : null;
  let show = false;
  if (other && other.avatar) {
    const pos = other.avatar.root.position, d = pos.distanceTo(me.pos);
    projV.set(pos.x, pos.y + 1.9, pos.z).project(camera);
    const behind = projV.z > 1;
    let x = behind ? -projV.x : projV.x, y = behind ? -projV.y : projV.y;
    const theirIt = isIt(other.id);
    const offScreen = behind || Math.abs(x) > 0.92 || Math.abs(y) > 0.88;
    if (offScreen || d > 8) {
      let px, py, rot;
      if (offScreen) {
        // pinned to the screen edge, pointing toward them
        const a = Math.atan2(y, x);
        px = (Math.cos(a) * 0.86 + 1) / 2 * innerWidth;
        py = (1 - Math.sin(a) * 0.78) / 2 * innerHeight;
        rot = 90 - a * 180 / Math.PI;
      } else {
        // floating over their head (handy when they're behind something)
        px = (x + 1) / 2 * innerWidth;
        py = (1 - y) / 2 * innerHeight - 26;
        rot = 180;
      }
      ptr.style.color = theirIt ? '#ff3344' : '#c6ff3d';
      ptr.style.left = px + 'px';
      ptr.style.top = py + 'px';
      ptr.firstChild.style.transform = `rotate(${rot}deg)`;
      setText('pointerLabel', `${theirIt ? (game.mode === 'duel' ? 'CHASER' : 'IT') : (game.mode === 'duel' ? 'EVADER' : 'RUNNER')} ${Math.round(d)}m`);
      show = true;
    }
    // close calls
    if (game.rl <= 0) {
      if (d < 2.2) nearFlag = true;
      else if (nearFlag && d > 4.5) {
        nearFlag = false;
        if (now - closeCallAt > 4000 && (amIt || isIt(other.id))) {
          closeCallAt = now;
          showBanner(amIt ? '<div class="big" style="color:#ff6bd6">SO CLOSE!</div>' : '<div class="big lime">CLOSE CALL!</div>', 1.1);
        }
      }
    }
  }
  ptr.style.display = show ? 'block' : 'none';

  // heartbeat when a seeker is closing in on you
  if (playing && !amIt && game.rl <= 0 && nearestSeeker < 16) {
    beatT -= dt;
    if (beatT <= 0) { SFX.beat(); beatT = 0.32 + 0.9 * (nearestSeeker / 16); }
  } else beatT = 0;
}

function lerpAngle(a, b, t) {
  const d = ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
  return a + d * t;
}

function updateHud(hs, frozen, nearestSeeker) {
  const playing = game.phase === 'playing';
  const amIt = playing && isIt(myId);
  setText('speed', `${hs.toFixed(1)} m/s`);
  setText('codeText', Net.code);

  if (game.phase === 'lobby') {
    setText('phaseText', 'WARMUP');
    setText('timerText', `${players.size} player${players.size === 1 ? '' : 's'}`);
  } else if (playing) {
    const d = game.duel;
    setText('phaseText', game.mode === 'duel' && d
      ? `DUEL · CHASE ${d.chase} · ${d.pts[d.ids[0]]}-${d.pts[d.ids[1]]} · FIRST TO ${d.target}` : modeName());
    setText('timerText', game.rl > 0 ? `Release in ${Math.ceil(game.rl)}` : fmtTime(game.tl));
    $('timerText').classList.toggle('urgent', game.rl <= 0 && game.tl <= 10);
  } else {
    $('timerText').classList.remove('urgent');
    setText('phaseText', 'ROUND OVER');
    setText('timerText', '');
  }

  const role = $('roleBadge');
  const spectating = playing && game.mode === 'duel' && !inDuel(myId);
  const roleText = !playing || spectating ? ''
    : game.mode === 'duel' ? (amIt ? 'CHASER' : 'EVADER')
    : amIt ? (game.mode === 'infection' ? 'SEEKER' : "YOU'RE IT") : 'RUNNER';
  setText('roleBadge', roleText);
  role.className = !roleText ? 'hidden' : amIt ? 'it' : 'runner';

  let hint = '';
  if (playing && game.mode === 'duel' && amIt) {
    const ev = players.get(game.duel.ids.find((i) => i !== myId));
    if (ev && ev.avatar) hint = `Evader ${Math.round(ev.avatar.root.position.distanceTo(me.pos))}m away - follow the green outline`;
  }
  if (playing && amIt && game.rl <= 0 && performance.now() < tagReadyAt) hint = `Tag cooldown ${((tagReadyAt - performance.now()) / 1000).toFixed(1)}s`;
  if (performance.now() < tagHintUntil) hint = tagHint;
  if (frozen) hint = 'Wait for the release…';
  else if (game.phase === 'lobby') {
    hint = Net.isHost
      ? (players.size < 2 ? `Warmup - tell friends the code ${Net.code}` : 'Warmup - press ENTER (or ESC → Start round) to play')
      : 'Warmup - waiting for the host to start';
  }
  setText('hint', hint);

  const v = $('vignette');
  if (v.classList.contains('it') !== amIt) v.classList.toggle('it', amIt);
  const danger = (!amIt && playing && game.rl <= 0 ? Math.max(0, 1 - nearestSeeker / 14) : 0).toFixed(2);
  if (danger !== v.dataset.d) { v.dataset.d = danger; v.style.setProperty('--danger', danger); }
}

// ---------- menu ----------
const ADJ = ['Swift', 'Sly', 'Zippy', 'Turbo', 'Sneaky', 'Bouncy', 'Rapid', 'Slick', 'Wild', 'Lucky'];
const NOUN = ['Fox', 'Gecko', 'Otter', 'Hare', 'Ferret', 'Lynx', 'Newt', 'Moth', 'Weasel', 'Frog'];
// default name is bobo (old auto-generated names like "RapidFox" get replaced too)
const autoName = (n) => ADJ.some((a) => n.startsWith(a)) && NOUN.some((w) => n.endsWith(w));
$('name').value = !settings.name || autoName(settings.name) ? 'bobo' : settings.name;

// character preview + fur color on the main menu
if (!settings.colorPicked || !isHex(settings.color)) settings.color = COLORS[0];   // black by default
if (!isHex(settings.eye)) settings.eye = '#ffffff';
const preview = (() => {
  const canvas = $('preview');
  const r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  r.setPixelRatio(Math.min(devicePixelRatio, 2));
  const sc = new THREE.Scene();
  sc.add(new THREE.HemisphereLight(0xffffff, 0x445566, 1.0));
  const d = new THREE.DirectionalLight(0xffffff, 0.6);
  d.position.set(2, 4, -3);
  sc.add(d);
  const cam = new THREE.PerspectiveCamera(32, 1, 0.1, 20);
  cam.position.set(0, 1.25, -4.4);
  cam.lookAt(0, 1.0, 0);
  let c = null, t = 0, spin = 0, dragging = false, lastX = 0;
  canvas.addEventListener('pointerdown', (e) => { dragging = true; lastX = e.clientX; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', (e) => { if (dragging) { spin += (e.clientX - lastX) * 0.012; lastX = e.clientX; } });
  canvas.addEventListener('pointerup', () => { dragging = false; });
  let chat = 2;
  const set = () => {
    if (c) sc.remove(c.rig);
    c = buildScamp(settings.color, settings.eye);
    sc.add(c.rig);
    chat = 0.6;
  };
  set();
  return {
    set,
    render(dt) {
      if (inGame || !canvas.offsetParent) return;
      const w = canvas.clientWidth, h = canvas.clientHeight;
      if (canvas.width !== Math.round(w * r.getPixelRatio())) { r.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); }
      t += dt;
      if (!dragging) spin += (Math.sin(t * 0.6) * 0.6 - spin) * Math.min(1, dt * 1.5);
      c.rig.rotation.y = spin;
      chat -= dt;
      if (chat < -4 - Math.random() * 3) chat = 0.9;
      animateScamp(c, dt, t, 0, 0, false, chat > 0);
      r.render(sc, cam);
    },
  };
})();
function renderPreview(dt) { preview.render(dt); }
// body + eye colors: one split bar - left half body, right half eyes. Click a half for the color picker.
// label text flips dark/light so it's readable on any color
const inkFor = (hex) => { const c = new THREE.Color(hex); return (0.299 * c.r + 0.587 * c.g + 0.114 * c.b) > 0.6 ? '#1f2433' : '#ffffff'; };
const markColors = () => {
  $('bodyColor').value = settings.color;
  $('eyeColor').value = settings.eye;
  for (const [id, c] of [['bodySwatch', settings.color], ['eyeSwatch', settings.eye]]) {
    $(id).style.background = c;
    $(id).style.color = inkFor(c);
  }
};
const setColors = (body, eye) => {
  if (body) { settings.color = body; settings.colorPicked = true; }
  if (eye) settings.eye = eye;
  saveSettings();
  preview.set();
  markColors();
};
$('bodyColor').addEventListener('input', (e) => setColors(e.target.value, null));
$('eyeColor').addEventListener('input', (e) => setColors(null, e.target.value));
markColors();

function getName() {
  const n = cleanName($('name').value);
  settings.name = n;
  saveSettings();
  return n;
}
function setStatus(t, bad) {
  $('menuStatus').textContent = t;
  $('menuStatus').className = bad ? 'bad' : '';
}
function menuBusy(b) {
  ['hostBtn', 'joinBtn', 'name'].forEach((id) => ($(id).disabled = b));
  codeBoxes.forEach((c) => (c.disabled = b));
}

function enterGame() {
  inGame = true;
  $('menu').classList.add('hidden');
  $('hud').classList.remove('hidden');
  $('pauseTitle').textContent = 'READY';
  $('resumeBtn').textContent = 'Click to play';
  openPause();
  arms.forEach((a) => (a.visible = true));
  updatePauseUI();
}

$('hostBtn').onclick = () => {
  audio();
  const name = getName();
  setStatus('Creating game…');
  menuBusy(true);
  Net.host((err) => {
    if (err) { setStatus(err, true); menuBusy(false); return; }
    myId = Net.id;
    ensurePlayer(myId, name, pickColor(settings.color), pickEye(settings.eye));
    game.scores[myId] = { it: 0, tags: 0 };
    const sp = randomSpawn();
    me.teleport(sp, faceCenter(sp));
    enterGame();
    pushState();
  });
};

function join() {
  audio();
  const code = $('codeInput').value.toUpperCase().replace(/[^A-Z]/g, '');
  if (code.length !== 4) { setStatus('Codes are 4 letters.', true); return; }
  const name = getName();
  setStatus(`Joining ${code}…`);
  menuBusy(true);
  Net.join(code, (err) => {
    if (err) {
      setStatus(err, true);
      menuBusy(false);
      syncCode();
      void $('codeBoxes').offsetWidth;
      $('codeBoxes').classList.add('bad');
      return;
    }
    myId = Net.id;
    const sp = randomSpawn();
    me.teleport(sp, faceCenter(sp));
    enterGame();
    Net.send({ t: 'hello', v: CONFIG.version, name, color: settings.color, eye: settings.eye });
  });
}
$('joinBtn').onclick = join;
// four letter boxes: type to advance, backspace to go back, paste fills them all
const codeBoxes = [...document.querySelectorAll('#codeBoxes input')];
const syncCode = () => {
  const code = codeBoxes.map((c) => c.value).join('');
  $('codeInput').value = code;
  codeBoxes.forEach((c) => c.classList.toggle('filled', !!c.value));
  $('codeBoxes').classList.remove('bad');
  const ready = code.length === 4;
  $('joinBtn').classList.toggle('ready', ready);
  if (!codeBoxes[0].disabled) $('joinBtn').disabled = !ready;
  $('joinBtn').textContent = ready ? `Join ${code}` : 'Enter 4 letters';
};
codeBoxes.forEach((c) => (c.placeholder = '_'));
$('pasteBtn').onclick = () => {
  if (navigator.clipboard && navigator.clipboard.readText) navigator.clipboard.readText().then((t) => fillCode(t), () => codeBoxes[0].focus());
  else codeBoxes[0].focus();
};
const fillCode = (text, from = 0) => {
  const letters = text.toUpperCase().replace(/[^A-Z]/g, '').split('');
  let i = from;
  for (const l of letters) { if (i > 3) break; codeBoxes[i++].value = l; }
  syncCode();
  codeBoxes[Math.min(i, 3)].focus();
};
codeBoxes.forEach((box, i) => {
  box.addEventListener('input', () => {
    const v = box.value.toUpperCase().replace(/[^A-Z]/g, '');
    box.value = v.slice(-1);
    syncCode();
    if (v && i < 3) codeBoxes[i + 1].focus();
  });
  box.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') join();
    else if (e.key === 'Backspace' && !box.value && i > 0) { codeBoxes[i - 1].value = ''; codeBoxes[i - 1].focus(); syncCode(); e.preventDefault(); }
    else if (e.key === 'ArrowLeft' && i > 0) codeBoxes[i - 1].focus();
    else if (e.key === 'ArrowRight' && i < 3) codeBoxes[i + 1].focus();
  });
  box.addEventListener('paste', (e) => { e.preventDefault(); fillCode((e.clipboardData || window.clipboardData).getData('text'), i); });
  box.addEventListener('focus', () => box.select());
});
const urlCode = new URLSearchParams(location.search).get('code');
if (urlCode) fillCode(urlCode); else syncCode();


addEventListener('beforeunload', () => Net.destroy());

requestAnimationFrame(frame);
})();
