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
  { name: '', sens: 1, fov: CONFIG.camera.fov, autorun: false, volume: 0.8, invertY: false, showSpeed: true, shake: 1, perfMode: true, showFps: false, unlocked: false, cos: null },
  ['scamper-settings', 'catenaries-settings', 'tagrush-settings'].map(loadJSON).find((o) => Object.keys(o).length) || {});
const DEFAULT_KEYS = JSON.parse(JSON.stringify(CONFIG.keys));
// P used to be pause - it's look-behind now
if (settings.keys && Array.isArray(settings.keys.pause)) settings.keys.pause = settings.keys.pause.filter((c) => c !== 'KeyP');
if (settings.keys) for (const a in DEFAULT_KEYS) if (Array.isArray(settings.keys[a])) CONFIG.keys[a] = settings.keys[a].slice(0, 2);
function loadJSON(k) { try { return JSON.parse(localStorage.getItem(k)) || {}; } catch (e) { return {}; } }
function saveSettings() { try { localStorage.setItem('scamper-settings', JSON.stringify(settings)); } catch (e) {} }

// ---------- stats (saved in this browser) ----------
const stats = (() => {
  const KEY = 'scamper-stats';
  const d = Object.assign({ games: 0, wins: 0, tags: 0, exploded: 0, playTime: 0, modes: {}, race: { best: {}, finishes: 0, falls: 0 }, kothBest: 0 }, loadJSON(KEY));
  const mode = (m) => (d.modes[m] = d.modes[m] || { games: 0, wins: 0, tags: 0 });
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) {} };
  let unsaved = 0;
  return {
    data: d,
    started() {},
    ended(r) {
      if (!r || !r.mode) return;
      d.games++;
      mode(r.mode).games++;
      if ((r.winners || []).includes(myId)) { d.wins++; mode(r.mode).wins++; }
      if (r.mode === 'koth' && game.koth) d.kothBest = Math.max(d.kothBest, Math.floor(game.koth.pts[myId] || 0));
      save();
    },
    tagged(m) { d.tags++; mode(m).tags++; save(); },
    exploded() { d.exploded++; save(); },
    fell() { d.race.falls++; unsaved += 5; },
    raceFinish(map, t) { d.race.finishes++; if (!d.race.best[map] || t < d.race.best[map]) d.race.best[map] = t; save(); },
    tick(dt) { d.playTime += dt; unsaved += dt; if (unsaved > 30) { unsaved = 0; save(); } },
  };
})();

// ---------- renderer / scene ----------
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
// render resolution: up to 1.5x on sharp screens in Performance mode (2x without). If frames run
// slow it eases down, but never below 1 pixel per screen pixel
const res = { max: 1, min: 1, now: 1, avg: 1 / 60, best: 1 / 60, slow: 0, fast: 0 };
function setResMax() {
  res.max = Math.min(devicePixelRatio, settings.perfMode ? 1.5 : 2);
  res.min = Math.min(res.max, 1);
  res.now = res.max;
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
const fogLin = new THREE.Fog(0xffffff, 50, 150), fogExp = new THREE.FogExp2(0xffffff, 0.05);
scene.fog = fogLin;

const camera = new THREE.PerspectiveCamera(settings.fov, innerWidth / innerHeight, 0.1, 400);
camera.rotation.order = 'YXZ';
scene.add(camera);

const hemi = new THREE.HemisphereLight();
scene.add(hemi);
const ambient = new THREE.AmbientLight(0xffffff, 0);
scene.add(ambient);
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
  if (m.env === 'space') { buildSpace(m); return; }
  if (m.env === 'fog') return;
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
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(760, 760), new THREE.MeshLambertMaterial({ color: '#2f86d6' }));
  sea.rotation.x = -Math.PI / 2;
  sea.position.y = m.sea !== undefined ? m.sea : -3;
  spotGroup.add(sea);
}

// space: stars, and a planet hanging in the black
function buildSpace(m) {
  const n = 1400, pts = new Float32Array(n * 3);
  let seed = 3;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < n; i++) {
    const u = rnd() * 2 - 1, a = rnd() * Math.PI * 2, r = Math.sqrt(1 - u * u);
    pts.set([Math.cos(a) * r * 340, Math.abs(u) * 340 - 20, Math.sin(a) * r * 340], i * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pts, 3));
  spotGroup.add(new THREE.Points(g, new THREE.PointsMaterial({ color: '#ffffff', size: 1.6, sizeAttenuation: false, fog: false })));
  // the planet: flat colors with a dark outline, like everything else
  const p = m.planet || { x: -160, y: 120, z: -220, r: 34, color: '#5b8fd8', land: '#7fc48f' };
  const geo = new THREE.SphereGeometry(p.r, 40, 24);
  const planet = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: p.color, fog: false }));
  planet.position.set(p.x, p.y, p.z);
  const rim = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: '#0d0f14', side: THREE.BackSide, fog: false }));
  rim.scale.setScalar(1.025);
  rim.position.copy(planet.position);
  spotGroup.add(rim, planet);
  for (const [a, b, s] of [[0.4, 0.3, 0.42], [2.2, -0.2, 0.35], [4.1, 0.5, 0.3]]) {
    const land = new THREE.Mesh(new THREE.SphereGeometry(p.r * 1.006, 24, 12, a, s * 3, Math.PI / 2 + b, s * 2.2),
      new THREE.MeshBasicMaterial({ color: p.land, fog: false }));
    land.position.copy(planet.position);
    spotGroup.add(land);
  }
  // a pale ice cap on top
  const cap = new THREE.Mesh(new THREE.SphereGeometry(p.r * 1.004, 24, 6, 0, Math.PI * 2, 0, 0.45), new THREE.MeshBasicMaterial({ color: '#eef3fa', fog: false }));
  cap.position.copy(planet.position);
  spotGroup.add(cap);
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

const DEFAULT_MOVE = Object.assign({}, CONFIG.move);
function loadMap(id) {
  const m = getMap(id);
  Object.assign(CONFIG.move, DEFAULT_MOVE, m.move || {});   // per-map physics (low gravity...)
  World.load(scene, m);
  if (m.kind === 'race') buildFinish(m);
  buildSpots(m);
  renderer.shadowMap.needsUpdate = true;
  scene.background.set(m.sky);
  // real fog (exponential: it thickens with distance) or the plain distance fade
  scene.fog = m.fogDensity ? fogExp : fogLin;
  scene.fog.color.set(m.sky);
  fogLin.near = m.fog[0];
  fogLin.far = m.fog[1];
  fogExp.density = m.fogDensity || 0.05;
  hemi.color.set(m.hemi[0]);
  hemi.groundColor.set(m.hemi[1]);
  const day = m.env === 'sky';
  // flat look: most of the light is an even fill, the sun and sky only add a little shading
  const lit = m.hemi[2] * (day ? 1.0 : 0.45) + m.sun[0] * (day ? 1.0 : 0.45);
  hemi.intensity = lit * 0.3;
  sun.intensity = m.sun[0] * (day ? 1.0 : 0.45) * 0.35;
  ambient.color.set(m.hemi[0]);
  ambient.intensity = lit * 0.62;
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

// race goal: a glowing gate + floating label over the finish box
function buildFinish(m) {
  const f = m.race.finish;
  const g = new THREE.Mesh(new THREE.BoxGeometry(f.w, f.h, f.d), new THREE.MeshBasicMaterial({ color: '#ffd166', transparent: true, opacity: 0.22, depthWrite: false }));
  g.position.set(f.x, f.y + f.h / 2, f.z);
  World.group.add(g);
  const edge = new THREE.LineSegments(new THREE.EdgesGeometry(g.geometry), new THREE.LineBasicMaterial({ color: '#ffd166' }));
  edge.position.copy(g.position);
  World.group.add(edge);
  const label = makeLabel('FINISH', '#ffd166', 256);
  label.scale.multiplyScalar(2.2);
  label.position.set(f.x, f.y + f.h + 1.2, f.z);
  label.material.fog = false;
  World.group.add(label);
  World._anim.push((t) => { g.material.opacity = 0.16 + 0.1 * Math.sin(t * 3); });
}

// shared clock (seconds) for everything that moves on its own. The host's clock is the truth;
// clients estimate it from snapshots (keeping the latest-arriving estimate, so lag doesn't drift it)
const clock = { off: 0, have: false };
function worldTime() { return performance.now() / 1000 + clock.off; }
function syncClock(hostT) {
  const est = hostT - performance.now() / 1000;
  if (!clock.have || est > clock.off) { clock.off = est; clock.have = true; }
  else clock.off += (est - clock.off) * 0.02;   // slowly follow if it drifts the other way
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
  pass: () => { tone(520, 980, 0.1, 'square', 0.06); tone(980, 1400, 0.08, 'square', 0.04, 0.08); },
  crown: () => [784, 988, 1175, 1568].forEach((f, i) => tone(f, f, i === 3 ? 0.25 : 0.09, 'triangle', 0.08, i * 0.09)),
  finish: () => [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, f, i === 4 ? 0.45 : 0.12, 'square', 0.06, i * 0.1)),
  fall: () => tone(520, 70, 0.55, 'sine', 0.09),
  beep: (v, hi) => tone(hi ? 1560 : 1180, hi ? 1560 : 1180, 0.07, 'square', 0.055 * v),
  // explosion: a burst of noise swept down through a low-pass, a deep thump, then crackle
  boom: (v) => {
    v *= settings.volume;
    if (!actx || v < 0.002) return;
    const t = actx.currentTime;
    const src = actx.createBufferSource(), f = actx.createBiquadFilter(), g = actx.createGain();
    src.buffer = noiseBuffer();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(3200, t);
    f.frequency.exponentialRampToValueAtTime(90, t + 1.8);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.85 * v, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 2.1);
    src.connect(f).connect(g).connect(actx.destination);
    src.start(t);
    src.stop(t + 2.2);
    tone(120, 30, 0.8, 'sine', 0.6 * v / Math.max(settings.volume, 0.001));
    for (let i = 0; i < 7; i++) tone(200 + Math.random() * 500, 60, 0.05, 'sawtooth', 0.05 * v / Math.max(settings.volume, 0.001), 0.25 + Math.random() * 0.9);
  },
};
let noiseBuf = null;
function noiseBuffer() {
  if (!noiseBuf) {
    noiseBuf = actx.createBuffer(1, actx.sampleRate * 2, actx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  return noiseBuf;
}
// the fuse's hiss: looping noise through a band-pass, louder and higher as it burns down
const fuseSnd = { g: null, f: null };
function fuseAudio(level, urgency) {
  if (!actx) return;
  if (!fuseSnd.g) {
    if (level <= 0) return;
    const src = actx.createBufferSource(), f = actx.createBiquadFilter(), g = actx.createGain();
    src.buffer = noiseBuffer();
    src.loop = true;
    f.type = 'bandpass';
    f.Q.value = 1.4;
    g.gain.value = 0;
    src.connect(f).connect(g).connect(actx.destination);
    src.start();
    fuseSnd.g = g;
    fuseSnd.f = f;
  }
  const crackle = 0.5 + Math.random() * 0.5;
  fuseSnd.g.gain.setTargetAtTime(level * 0.1 * settings.volume * crackle, actx.currentTime, 0.02);
  fuseSnd.f.frequency.setTargetAtTime(2400 + urgency * 4000, actx.currentTime, 0.05);
}

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
const sleeveMat = new THREE.MeshLambertMaterial({ color: SCAMP_DARK });
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

const vmBomb = makeBomb(0.3);
vmBomb.position.set(0.17, -0.19, -0.52);
vmBomb.visible = false;
vmCam.add(vmBomb);

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
  label.position.y = 2.75;
  // floating arrow over their head when they're the one to find (duel runner, king...)
  const marker = makeLabel('\u25BC', '#c6ff3d', 128);
  marker.position.y = 3.3;
  marker.material.fog = false;
  marker.material.depthTest = false;
  marker.renderOrder = 31;
  marker.visible = false;
  const bomb = makeBomb(1);
  bomb.position.y = 2.15;
  bomb.visible = false;
  const crown = makeCrown();
  crown.position.set(0, 0.56, -0.15);   // sits on the head, and flips with it when they talk
  crown.visible = false;
  c.head.add(crown);
  root.add(label, marker, bomb);
  scene.add(root);
  const blob = new THREE.Mesh(blobGeo, new THREE.MeshBasicMaterial({ color: 0x000000, map: glowTex, transparent: true, opacity: 0.4, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }));
  blob.rotation.x = -Math.PI / 2;
  scene.add(blob);
  return { root, rig: c.rig, scamp: c, bodyMat: c.fur, label, marker, bomb, crown, blob, spd: 0, vy: 0 };
}

// --- props: the bomb (blinks red faster and faster, fuse burns down) and the crown ---
function makeBomb(scale) {
  const g = new THREE.Group();
  const shell = new THREE.MeshLambertMaterial({ color: '#23262f', emissive: '#000000' });
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.3, 20, 14), shell);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.12, 12), new THREE.MeshLambertMaterial({ color: '#59606e' }));
  cap.position.y = 0.3;
  const fuseG = new THREE.Group();
  fuseG.position.set(0.02, 0.35, 0);
  fuseG.rotation.z = -0.55;
  const fuseGeo = new THREE.CylinderGeometry(0.022, 0.022, 0.26, 6);
  fuseGeo.translate(0, 0.13, 0);
  const fuse = new THREE.Mesh(fuseGeo, new THREE.MeshLambertMaterial({ color: '#c9a36b' }));
  fuseG.add(fuse);
  const spark = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: '#ffb347', blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  spark.scale.setScalar(0.5);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: '#ff3b30', blending: THREE.AdditiveBlending, depthWrite: false, fog: false, opacity: 0 }));
  g.add(ball, cap, fuseG, spark, halo);
  g.scale.setScalar(scale);
  g.userData = { shell, spark, halo, fuse, fuseG, base: scale, x0: 0 };
  return g;
}
// frac = how much fuse is left (1 -> 0)
function animateBomb(b, t, frac) {
  const u = b.userData, urg = 1 - Math.max(0, Math.min(1, frac));
  const rate = 1 + 13 * urg * urg;
  const on = Math.sin(t * rate * Math.PI * 2) > 0;
  u.shell.emissive.set(on ? (frac < 0.25 ? '#ff2a1a' : '#8a1a10') : '#000000');
  u.fuse.scale.y = 0.15 + 0.85 * frac;
  const L = 0.26 * u.fuse.scale.y;
  u.spark.position.set(u.fuseG.position.x + Math.sin(0.55) * L, u.fuseG.position.y + Math.cos(0.55) * L, 0);
  u.spark.scale.setScalar(0.3 + Math.random() * 0.35 + urg * 0.5);
  u.spark.material.color.set(Math.random() < 0.5 ? '#ffd166' : '#ff8a3d');
  u.halo.material.opacity = (on ? 0.75 : 0.25) * urg;
  u.halo.scale.setScalar(1 + urg * 2.2);
  b.scale.setScalar(u.base * (1 + Math.sin(t * rate * Math.PI * 2) * 0.07 * (0.2 + urg)));
  b.rotation.z = frac < 0.2 ? (Math.random() - 0.5) * 0.25 : Math.sin(t * 3) * 0.08;
}
function makeCrown() {
  const g = new THREE.Group();
  const gold = new THREE.MeshLambertMaterial({ color: '#ffd166', emissive: '#5c4100' });
  const bandGeo = new THREE.CylinderGeometry(0.25, 0.23, 0.13, 10);
  const band = new THREE.Mesh(bandGeo, gold);
  band.position.y = 0.065;
  const line = new THREE.LineSegments(new THREE.EdgesGeometry(bandGeo), new THREE.LineBasicMaterial({ color: '#7a5600' }));
  line.position.copy(band.position);
  g.add(band, line);
  for (let i = 0; i < 5; i++) {
    const a = i / 5 * Math.PI * 2, spike = new THREE.Mesh(new THREE.ConeGeometry(0.065, 0.2, 4), gold);
    spike.position.set(Math.cos(a) * 0.2, 0.22, Math.sin(a) * 0.2);
    g.add(spike);
  }
  const gem = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.03), new THREE.MeshLambertMaterial({ color: '#ff5a7a', emissive: '#5a0010' }));
  gem.position.set(0, 0.065, -0.24);
  g.add(gem);
  g.scale.set(1.25, 1, 0.75);
  return g;
}
// the crown when nobody has it: floating in the middle under a light beam
const looseCrown = (() => {
  const g = new THREE.Group();
  const c = makeCrown();
  c.scale.set(2.2, 2, 2.2);
  g.add(c);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 40, 20, 1, true), new THREE.MeshBasicMaterial({ color: '#ffd166', map: beamTex, transparent: true,
    opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
  beam.position.y = 20;
  beam.rotation.x = Math.PI;
  g.add(beam);
  const label = makeLabel('CROWN', '#ffd166', 200);
  label.position.y = 1.4;
  label.material.depthTest = false;
  label.material.fog = false;
  g.add(label);
  g.visible = false;
  scene.add(g);
  g.userData.crown = c;
  return g;
})();

// --- short-lived effects (explosions) ---
const FX_SPHERE = new THREE.SphereGeometry(1, 16, 12), FX_BOX = new THREE.BoxGeometry(0.2, 0.2, 0.2), FX_RING = new THREE.RingGeometry(0.85, 1, 48);
const fxList = [];
function addFx(obj, dur, update) { scene.add(obj); fxList.push({ obj, t: 0, dur, update }); update(obj, 0, 0); }
function stepFx(dt) {
  for (let i = fxList.length - 1; i >= 0; i--) {
    const f = fxList[i];
    f.t += dt;
    if (f.t >= f.dur) { scene.remove(f.obj); f.obj.material.dispose(); fxList.splice(i, 1); } else f.update(f.obj, f.t / f.dur, dt);
  }
}
function onBoom(id, p, out) {
  const at = World.nearestCopy({ x: p[0], z: p[2] }, me.pos);
  const x = at.x, y = p[1], z = at.z, cy = y + 1.4;
  const fire = new THREE.Mesh(FX_SPHERE, new THREE.MeshBasicMaterial({ color: '#fff3b0', transparent: true, depthWrite: false, fog: false }));
  fire.position.set(x, cy, z);
  addFx(fire, 0.6, (o, u) => {
    o.scale.setScalar(0.6 + 5.5 * Math.pow(u, 0.35));
    o.material.opacity = 1 - u * u;
    o.material.color.set(u < 0.25 ? '#fff3b0' : u < 0.55 ? '#ffb347' : '#ff5a36');
  });
  const fy = World.floorBelow(x, y + 0.5, z);
  const ring = new THREE.Mesh(FX_RING, new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(x, (fy > -1e8 ? fy : y) + 0.08, z);
  addFx(ring, 0.75, (o, u) => { o.scale.setScalar(1 + 16 * u); o.material.opacity = 0.9 * (1 - u); });
  for (let i = 0; i < 26; i++) {
    const m = new THREE.Mesh(FX_BOX, new THREE.MeshLambertMaterial({ color: ['#23262f', '#ff8a3d', '#ffd166', '#ff5a36'][i % 4], transparent: true }));
    m.position.set(x, cy, z);
    const a = Math.random() * 6.28, sp = 5 + Math.random() * 9, v = { x: Math.cos(a) * sp, y: 4 + Math.random() * 9, z: Math.sin(a) * sp }, spin = (Math.random() - 0.5) * 20;
    m.scale.setScalar(0.6 + Math.random() * 1.4);
    addFx(m, 1.6, (o, u, dt) => {
      v.y -= 22 * dt;
      o.position.x += v.x * dt; o.position.y += v.y * dt; o.position.z += v.z * dt;
      o.rotation.x += spin * dt; o.rotation.y += spin * dt * 0.7;
      o.material.opacity = u > 0.6 ? 1 - (u - 0.6) / 0.4 : 1;
    });
  }
  for (let i = 0; i < 12; i++) {
    const m = new THREE.Mesh(FX_SPHERE, new THREE.MeshLambertMaterial({ color: i % 2 ? '#8a8f9a' : '#5d626d', transparent: true, depthWrite: false }));
    const ox = (Math.random() - 0.5) * 2.4, oz = (Math.random() - 0.5) * 2.4, s0 = 0.5 + Math.random() * 0.6, rise = 1 + Math.random() * 2;
    m.position.set(x + ox, cy + Math.random(), z + oz);
    addFx(m, 1.8 + Math.random() * 0.7, (o, u, dt) => {
      o.scale.setScalar(s0 + 2.2 * Math.sqrt(u));
      o.position.y += rise * dt; o.position.x += ox * 0.6 * dt; o.position.z += oz * 0.6 * dt;
      o.material.opacity = 0.75 * (1 - u);
    });
  }
  // feel it: shake, punch, flash and sound fall off with distance
  const d = Math.hypot(me.pos.x - x, me.pos.y - y, me.pos.z - z), near = Math.max(0, 1 - d / 35), mine = id === myId;
  shake = Math.max(shake, mine ? 1.4 : 1.25 * near);
  fovPunch += mine ? 22 : 14 * near;
  if (mine || d < 22) flash(mine ? 'rgba(255,240,200,.95)' : `rgba(255,200,120,${(0.6 * near).toFixed(2)})`);
  SFX.boom(mine ? 1 : 0.2 + 0.8 * near);
  if (mine) {
    stats.exploded();
    showBanner(out ? '<div class="big red">BOOM - YOU\'RE OUT</div><div>Spectating - you can still run around</div>'
      : '<div class="big red">BOOM</div><div>You lost a life - one more and you\'re out</div>', 2.6);
  } else showBanner(`<div class="big">BOOM!</div><div>${esc(nameOf(id))} ${out ? 'is out' : 'lost a life'}</div>`, 1.8);
}

function removeAvatar(p) {
  scene.remove(p.avatar.root, p.avatar.blob);
  p.avatar.blob.material.dispose();
  p.avatar.root.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) { if (o.material.map && o.material.map !== glowTex) o.material.map.dispose(); o.material.dispose(); }
  });
  p.avatar = null;
}

const players = new Map();  // id -> { id, name, color, tp (latest position), yaw, pitch, mode, avatar }
let myId = null;

// cosmetics (see applyCos in character.js) - cleaned up, since they come over the network
const COS_DEFAULT = { rb: 'off', rbStyle: 'wave', ghost: false, ghostOp: 0.45, neon: false, glint: false, glintColor: '#8f5bff' };
function pickCos(c) {
  if (!c || typeof c !== 'object') return null;
  return {
    rb: ['off', 'body', 'eyes', 'both'].includes(c.rb) ? c.rb : 'off',
    rbStyle: c.rbStyle === 'pulse' ? 'pulse' : 'wave',
    ghost: !!c.ghost,
    ghostOp: Math.max(0.2, Math.min(0.9, +c.ghostOp || 0.45)),
    neon: !!c.neon,
    glint: !!c.glint,
    glintColor: isHex(c.glintColor) ? c.glintColor : '#8f5bff',
  };
}
const myCos = () => (settings.unlocked ? pickCos(Object.assign({}, COS_DEFAULT, settings.cos || {})) : null);
function ensurePlayer(id, name, color, eye = '#ffffff', cos = null) {
  let p = players.get(id);
  if (p) p.cos = cos;
  if (!p) {
    p = { id, name, color, eye, cos, talk: false, tp: new THREE.Vector3(0, -100, 0), yaw: 0, pitch: 0, mode: 0, snapNext: true, avatar: null };
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
//   mode   'bomb' | 'duel' | 'koth' | 'race'
//   it     the special player: bomb holder / duel chaser / king
const game = { setup: null, phase: 'lobby', mode: 'bomb', map: '', it: [], scores: {}, tl: 0, rl: 0, fz: 0, im: 0, result: null,
  duel: null, bomb: null, koth: null, race: null, lastTag: null };
loadMap(settings.lastMap || MAPS[0].id);
const isIt = (id) => game.it.includes(id);
const me = new LocalPlayer();
let inGame = false;
const isPlaying = () => game.phase === 'playing';
const isOut = (id) => isPlaying() && game.mode === 'bomb' && !!game.bomb && !game.bomb.alive.includes(id);
const inDuel = (id) => game.mode === 'duel' && !!game.duel && game.duel.ids.includes(id);
// may `a` tag `b` right now?
function canTagPair(a, b) {
  if (!isPlaying() || game.rl > 0 || a === b) return false;
  if (game.mode === 'bomb') return isIt(a) && !isIt(b) && !isOut(a) && !isOut(b);
  if (game.mode === 'duel') return isIt(a) && inDuel(b);
  if (game.mode === 'koth') return !isIt(a) && isIt(b) && game.im <= 0;
  return false;
}

function randomSpawn() { const sp = World.map.spawns; return sp[Math.floor(Math.random() * sp.length)]; }
function faceCenter(p) { return World.map.kind === 'race' ? World.map.race.yaw : Math.atan2(p[0], p[2]); }
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
const modeInfo = (id) => MODES.find((m) => m.id === id) || MODES[0];
const modeName = () => modeInfo(game.mode).name.toUpperCase();
const fmtTime = (s) => { s = Math.max(0, Math.ceil(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const fmtRace = (s) => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}`;
const ord = (n) => n + (['th', 'st', 'nd', 'rd'][(n % 100 - 20) % 10] || ['th', 'st', 'nd', 'rd'][n % 100] || 'th');

// what the last applied state looked like (the host edits `game` before applying, so compare to this)
const seen = { phase: 'lobby', it: [], chase: 0, out: false };
let gotState = false;
function applyState(s) {
  gotState = true;
  const wasIt = seen.it.includes(myId), oldPhase = seen.phase, oldIt = seen.it;
  const oldChase = seen.chase, wasOut = seen.out;
  const ids = new Set(s.roster.map((r) => r.id));
  for (const id of [...players.keys()]) if (!ids.has(id)) removePlayer(id);
  for (const r of s.roster) ensurePlayer(r.id, String(r.name).slice(0, 16), pickColor(r.color), pickEye(r.eye), pickCos(r.cos));

  if (s.map && (!World.map || s.map !== World.map.id)) loadMap(s.map);
  game.phase = s.phase;
  game.mode = MODES.some((m) => m.id === s.mode) ? s.mode : 'bomb';
  game.it = Array.isArray(s.it) ? s.it.slice() : [];
  game.scores = s.scores || {};
  game.result = s.result;
  game.duel = s.duel || null;
  game.bomb = s.bomb || null;
  game.koth = s.koth || null;
  game.race = s.race || null;
  if (s.setup) game.setup = s.setup;
  game.lastTag = s.lastTag ? { from: s.lastTag.from, to: s.lastTag.to, at: performance.now() - s.lastTag.ago * 1000 } : null;

  const playing = isPlaying(), started = playing && oldPhase !== 'playing';
  if (started) { SFX.start(); stats.started(game.mode); }

  if (playing && game.mode === 'duel' && game.duel && game.duel.chase !== oldChase) {
    const d = game.duel, [a, b] = d.ids;
    const score = `${esc(d.names[a])} ${d.pts[a]} - ${d.pts[b]} ${esc(d.names[b])} · first to ${d.target}`;
    const role = !inDuel(myId) ? '<div class="big">SPECTATING</div>'
      : isIt(myId) ? '<div class="big red">YOU CHASE</div>' : '<div class="big lime">YOU RUN</div>';
    showBanner(`${d.last ? `<div class="sub">${esc(d.last)}</div>` : ''}${role}<div>Chase ${d.chase} · ${score}</div>`, 3);
    if (d.chase > 1) SFX.start();
  } else if (started && game.mode === 'bomb') {
    showBanner(isOut(myId) ? '<div class="big">SPECTATING</div><div>You joined mid-game - next game you\'re in</div>'
      : '<div class="big red">BOMB TAG</div><div>Someone gets the bomb in a few seconds. Run into people to pass it on!</div>', 3);
  } else if (started && game.mode === 'koth') {
    showBanner('<div class="big gold">KING OF THE TAG</div><div>The crown goes to someone in a few seconds. Steal it and hold it!</div>', 3);
  } else if (started && game.mode === 'race') {
    showBanner(`<div class="big">RACE</div><div>${esc(World.map.name)} · fall and you go back to the start</div>`, 3);
  }

  // bomb / crown changed hands
  if (playing && game.mode === 'bomb' && !wasIt && isIt(myId)) {
    tagReadyAt = performance.now() + CONFIG.tag.bombPassDelay * 1000;
    flash('rgba(255,60,40,.55)');
    SFX.tagged();
    if (!game.lastTag || game.lastTag.to !== myId || performance.now() - game.lastTag.at > 1500) {
      showBanner('<div class="big red">YOU HAVE THE BOMB</div><div>Run into someone to pass it!</div>', 2.2);
    }
  }
  if (playing && game.mode === 'bomb' && oldIt.length === 0 && game.it.length && game.it[0] !== myId) {
    addFeed(`${nameOf(game.it[0])} has the bomb!`);
  }
  if (playing && game.mode === 'koth' && !wasIt && isIt(myId) && (!game.lastTag || game.lastTag.to !== myId)) {
    SFX.crown();
    showBanner('<div class="big gold">YOU\'RE THE KING</div><div>Hold the crown - every second is a point</div>', 2);
  }
  if (!wasOut && isOut(myId) && !started) showBanner('<div class="big">YOU\'RE OUT</div><div>Spectating - you can still run around</div>', 2.5);

  // my race finish got confirmed
  if (playing && game.mode === 'race' && game.race && game.race.done[myId] !== undefined && !raceDone) {
    raceDone = true;
    const place = game.race.order.indexOf(myId) + 1;
    SFX.finish();
    flash('rgba(255,209,102,.5)');
    showBanner(`<div class="big gold">${ord(place).toUpperCase()}!</div><div>${fmtRace(game.race.done[myId])}</div>`, 3.5);
    stats.raceFinish(World.map.id, game.race.done[myId], place);
  }
  if (!playing || game.mode !== 'race') raceDone = false;

  if (game.phase === 'results' && oldPhase !== 'results' && game.result) {
    SFX.end();
    const r = game.result;
    stats.ended(r);
    showBanner(`<div class="big">${esc(r.title)}</div><div class="sub">${esc(r.sub || '')}</div>` +
      `<ol class="results">${(r.lines || []).map((l) => `<li>${esc(l)}</li>`).join('')}</ol>`);
  }
  if (game.phase === 'lobby' && oldPhase === 'results') $('banner').classList.remove('show');

  seen.phase = game.phase;
  seen.it = game.it.slice();
  seen.chase = game.duel ? game.duel.chase : 0;
  seen.out = isOut(myId);
  updatePauseUI();
  boardDirty = true;
}
let raceDone = false;

function applySnap(m) {
  if (!m.p || typeof m.p !== 'object') return;
  for (const id in m.p) {
    if (id === myId) continue;
    const p = players.get(id);
    if (p) setPose(p, m.p[id]);
  }
  game.tl = +m.tl || 0;
  game.rl = +m.rl || 0;
  game.fz = +m.fz || 0;
  game.im = +m.im || 0;
  if (game.koth && m.kp && typeof m.kp === 'object') for (const id in m.kp) game.koth.pts[id] = +m.kp[id] || 0;
  if (Number.isFinite(+m.wt)) syncClock(+m.wt);
}

// ---------- host: rules ----------
const H = { itSince: {}, timeLeft: 0, releaseLeft: 0, resultsLeft: 0, endIn: 0, fuse: 0, immune: 0, raceTime: 0, lastTag: null, snapAcc: 0, stateAcc: 0 };
// random starting colors for new players: bright, readable bodies
const COLORS = ['#ff8fa3', '#ffd166', '#7ed6c8', '#8fb4ff', '#c3a6ff', '#ffb37a', '#9be3a8', '#ff6b6b', '#a8dcef', '#f4a6ff', '#2f3138', '#5b6cff', '#3ec98b', '#ff9f43'];

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
    t: 'state', phase: game.phase, mode: game.mode, map: game.map, it: game.it.slice(), setup: game.setup,
    duel: game.duel, bomb: game.bomb, koth: game.koth, race: game.race,
    lastTag: H.lastTag ? { from: H.lastTag.from, to: H.lastTag.to, ago: (performance.now() - H.lastTag.time) / 1000 } : null,
    scores: game.scores, result: game.result,
    roster: [...players.values()].map((p) => ({ id: p.id, name: p.name, color: p.color, eye: p.eye, cos: p.cos || null })),
  };
}
function pushState() {
  const s = buildState();
  Net.broadcast(s);
  applyState(s);
}
function hostFeed(text) {
  addFeed(text);
  Net.broadcast({ t: 'feed', text });
}
function setIt(ids) {
  const now = performance.now();
  for (const id of ids) if (!game.it.includes(id)) H.itSince[id] = now;
  game.it = ids.slice();
}

function teleportPlayer(id, pos, yaw) {
  const p = players.get(id);
  const y = yaw === undefined ? faceCenter(pos) : yaw;
  if (p) { p.tp.set(pos[0], pos[1], pos[2]); p.snapNext = true; }
  if (id === myId) me.teleport(pos, y);
  else Net.sendTo(id, { t: 'tp', p: pos, y });
}
// everyone to a different spawn
function spreadOut(ids) {
  const sp = shuffle(World.map.spawns.slice());
  ids.forEach((id, i) => teleportPlayer(id, sp[i % sp.length]));
}

function hostSetMap(id) {
  if (isPlaying() || id === game.map) return;
  loadMap(id);
  settings.lastMap = id;
  saveSettings();
  pushState();
  hostFeed(`Map: ${World.map.name}`);
  spreadOut([...players.keys()]);
}

function hostStartRound() {
  if (isPlaying()) return;
  const su = getSetup(), mode = modeInfo(su.mode), o = su.opts[mode.id];
  const ids = [...players.keys()];
  const why = startProblem(mode, ids.length);
  if (why) { showBanner(`<div class="big">CAN'T START</div><div>${esc(why)}</div>`, 2.5); return; }
  // the map has to fit the mode (race courses for Race, arenas for the rest)
  if ((World.map.kind === 'race') !== (mode.kind === 'race')) hostSetMap(MAPS.find((m) => (m.kind === 'race') === (mode.kind === 'race')).id);
  game.mode = mode.id;
  game.phase = 'playing';
  game.result = null;
  game.scores = {};
  ids.forEach((id) => (game.scores[id] = { tags: 0 }));
  game.duel = game.bomb = game.koth = game.race = null;
  game.it = [];
  H.lastTag = null;
  H.endIn = 0;
  H.immune = 0;
  game.im = 0;
  game.fz = 0;
  shuffle(ids);
  if (mode.id === 'bomb') startBomb(ids, o);
  else if (mode.id === 'duel') startDuel(ids, o);
  else if (mode.id === 'koth') startKoth(ids, o);
  else startRace(ids, o);
  game.tl = H.timeLeft;
  game.rl = H.releaseLeft;
  pushState();
}
function startProblem(mode, n) {
  if (mode.max && n !== mode.max) return `${mode.name} needs exactly ${mode.max} players (${n} here).`;
  if (n < mode.min) return `${mode.name} needs ${mode.min}+ players. Share your code first.`;
  return '';
}

// --- bomb tag: one bomb at a time, the fuse runs down, whoever holds it when it blows is out ---
function startBomb(ids, o) {
  const lives = ids.length === 2 ? 2 : 1;          // 1v1: best of three bombs
  const blasts = (ids.length - 1) * lives + (lives > 1 ? 0.5 : 0);
  const fuse = Math.round(Math.max(18, Math.min(45, o.len / blasts)));
  game.bomb = { alive: ids.slice(), out: [], lives: {}, maxLives: lives, fuseLen: fuse };
  ids.forEach((id) => (game.bomb.lives[id] = lives));
  H.timeLeft = 0;
  H.releaseLeft = 4;
  H.fuse = 0;
  spreadOut(ids);
  hostFeed(`Bomb Tag! ${fuse}s fuse`);
}
function hostDropBomb() {
  const b = game.bomb, pick = b.alive[Math.floor(Math.random() * b.alive.length)];
  setIt([pick]);
  H.fuse = b.fuseLen;
  game.fz = H.fuse;
  H.lastTag = null;
  pushState();
}
function hostExplode() {
  const b = game.bomb, id = game.it[0], p = posOf(id);
  const pos = p ? [r2(p.x), r2(p.y), r2(p.z)] : [0, 0, 0];
  b.lives[id] = Math.max(0, (b.lives[id] || 1) - 1);
  const out = b.lives[id] <= 0;
  if (out) { b.alive = b.alive.filter((x) => x !== id); b.out.push(id); }
  game.it = [];
  H.fuse = 0;
  game.fz = 0;
  Net.broadcast({ t: 'boom', id, p: pos, out });
  onBoom(id, pos, out);
  hostFeed(out ? `${nameOf(id)} blew up - out!` : `${nameOf(id)} blew up - ${b.lives[id]} life left`);
  if (b.alive.length <= 1) H.endIn = 2.5;
  else H.releaseLeft = 3.5;
  pushState();
}

// --- duel: 1v1, take turns chasing; tag = chaser scores, survive = runner scores ---
function startDuel(ids, o) {
  const names = {}, pts = {};
  ids.forEach((id) => { names[id] = nameOf(id); pts[id] = 0; });
  game.duel = { ids, names, pts, target: o.target, chaseLen: o.chase, chase: 0, last: '' };
  hostFeed(`Duel! First to ${o.target}`);
  hostStartChase();
}
function hostStartChase() {
  const d = game.duel;
  d.chase++;
  const chaser = d.ids[(d.chase - 1) % 2], runner = d.ids[d.chase % 2];   // roles swap every chase
  setIt([chaser]);
  H.timeLeft = d.chaseLen;
  H.releaseLeft = CONFIG.tag.duelRelease;
  game.tl = H.timeLeft;
  game.rl = H.releaseLeft;
  const sp = World.map.spawns, a = sp[Math.floor(Math.random() * sp.length)];
  const byDist = sp.filter((s) => s !== a).sort((p, q) => dist2(p, a) - dist2(q, a));
  const b = byDist[Math.min(byDist.length - 1, Math.round((byDist.length - 1) * CONFIG.tag.duelSpawnSpread))];
  teleportPlayer(chaser, a);
  teleportPlayer(runner, b);
  pushState();
}
const dist2 = (p, q) => (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2;
function duelPoint(winner, why) {
  const d = game.duel;
  d.pts[winner]++;
  d.last = `${d.names[winner]} +1 (${why})`;
  hostFeed(d.last);
  if (d.pts[winner] >= d.target) { hostEndRound(); return; }
  hostStartChase();
}

// --- king of the tag: hold the crown for points, run into the king to steal it ---
function startKoth(ids, o) {
  game.koth = { pts: {}, loose: false };
  ids.forEach((id) => (game.koth.pts[id] = 0));
  H.timeLeft = o.len;
  H.releaseLeft = 3;
  spreadOut(ids);
}
function hostCrown(id, why) {
  setIt([id]);
  game.koth.loose = false;
  H.immune = CONFIG.tag.crownProtect;
  game.im = H.immune;
  if (why) hostFeed(why);
  pushState();
}
function hostDropCrown() {
  game.it = [];
  game.koth.loose = true;
  H.immune = 0;
  game.im = 0;
  hostFeed('The crown dropped in the middle!');
  pushState();
}
const crownSpot = () => World.map.centerSpot || World.map.seekerSpawn;

// --- race: everyone from the start line to the finish, falls send you back to the start ---
function startRace(ids, o) {
  game.race = { done: {}, order: [] };
  H.timeLeft = o.len;
  H.releaseLeft = 3.5;
  H.raceTime = 0;
  const sp = World.map.spawns;
  ids.forEach((id, i) => teleportPlayer(id, sp[i % sp.length], World.map.race.yaw));
}
function hostFinish(id) {
  const r = game.race;
  if (!isPlaying() || game.mode !== 'race' || game.rl > 0 || !r || r.done[id] !== undefined) return;
  const p = posOf(id), f = World.map.race.finish, s = 2.5;
  if (!p || Math.abs(p.x - f.x) > f.w / 2 + s || Math.abs(p.z - f.z) > f.d / 2 + s || p.y < f.y - s || p.y > f.y + f.h + s) return;
  r.done[id] = Math.round(H.raceTime * 10) / 10;
  r.order.push(id);
  hostFeed(`${nameOf(id)} finished ${ord(r.order.length)} - ${fmtRace(r.done[id])}`);
  if (r.order.length === 1 && players.size > 1) H.timeLeft = Math.min(H.timeLeft, CONFIG.tag.raceAfterFirst);
  if ([...players.keys()].every((x) => r.done[x] !== undefined)) H.endIn = 2;
  pushState();
}
// meters left along the course for someone at p
function raceToGo(p) {
  const R = World.map.race && World.map.race.route;
  if (!R || !p) return 0;
  if (!R.len) {
    R.len = [0];
    for (let i = 1; i < R.length; i++) R.len.push(R.len[i - 1] + Math.hypot(R[i][0] - R[i - 1][0], R[i][1] - R[i - 1][1], R[i][2] - R[i - 1][2]));
  }
  let best = Infinity, at = 0;
  for (let i = 1; i < R.length; i++) {
    const a = R[i - 1], b = R[i], ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], L2 = ab[0] ** 2 + ab[1] ** 2 + ab[2] ** 2 || 1;
    const t = Math.max(0, Math.min(1, ((p.x - a[0]) * ab[0] + (p.y - a[1]) * ab[1] + (p.z - a[2]) * ab[2]) / L2));
    const d = Math.hypot(a[0] + ab[0] * t - p.x, a[1] + ab[1] * t - p.y, a[2] + ab[2] * t - p.z);
    if (d < best) { best = d; at = R.len[i - 1] + Math.sqrt(L2) * t; }
  }
  return Math.max(0, R.len[R.len.length - 1] - at);
}

// someone fell into the void
function hostFell(id) {
  if (!isPlaying()) return;
  if (game.mode === 'duel') {
    const d = game.duel;
    if (!d.ids.includes(id) || H.releaseLeft > 0) return;
    duelPoint(d.ids.find((i) => i !== id), id === game.it[0] ? 'the chaser fell' : 'fell into the void');
  } else if (game.mode === 'koth' && isIt(id)) hostDropCrown();
}

function hostEndRound(sub) {
  if (!isPlaying()) return;
  game.phase = 'results';
  game.result = computeResult(sub);
  H.resultsLeft = CONFIG.tag.resultsTime;
  H.endIn = 0;
  pushState();
}

function computeResult(sub) {
  const list = [...players.values()];
  const tags = (id) => (game.scores[id] || { tags: 0 }).tags;
  if (game.mode === 'duel' && game.duel) {
    const d = game.duel, [a, b] = d.ids, w = d.pts[a] >= d.pts[b] ? a : b;
    return { mode: 'duel', winners: [w], title: `${d.names[w]} wins the duel!`, sub: sub || `${d.pts[a]} - ${d.pts[b]}`,
      lines: d.ids.map((i) => `${d.names[i]} - ${d.pts[i]} points`) };
  }
  if (game.mode === 'bomb' && game.bomb) {
    const b = game.bomb, order = b.alive.concat(b.out.slice().reverse()).filter((id) => players.has(id));
    const w = b.alive.length === 1 ? b.alive[0] : null;
    return { mode: 'bomb', winners: w ? [w] : [], title: w ? `${nameOf(w)} survives!` : 'Game over', sub: sub || 'Last one standing wins',
      lines: order.map((id, i) => `${ord(i + 1)} ${nameOf(id)} - ${tags(id)} passes`) };
  }
  if (game.mode === 'koth' && game.koth) {
    const pts = game.koth.pts;
    list.sort((a, b) => (pts[b.id] || 0) - (pts[a.id] || 0));
    const w = list[0];
    return { mode: 'koth', winners: w ? [w.id] : [], title: w ? `${w.name} rules!` : 'Round over', sub: sub || 'Most time with the crown wins',
      lines: list.map((p) => `${p.name} - ${Math.floor(pts[p.id] || 0)} points, ${tags(p.id)} steals`) };
  }
  if (game.mode === 'race' && game.race) {
    const r = game.race, rest = list.filter((p) => r.done[p.id] === undefined).sort((a, b) => raceToGo(posOf(a.id)) - raceToGo(posOf(b.id)));
    const lines = r.order.filter((id) => players.has(id)).map((id, i) => `${ord(i + 1)} ${nameOf(id)} - ${fmtRace(r.done[id])}`)
      .concat(rest.map((p) => `${p.name} - ${Math.round(raceToGo(posOf(p.id)))}m to go`));
    const w = r.order[0];
    return { mode: 'race', winners: w ? [w] : [], title: w ? `${nameOf(w)} wins the race!` : 'Nobody finished', sub: sub || World.map.name, lines };
  }
  return { mode: game.mode, winners: [], title: 'Round over', sub: sub || '', lines: [] };
}

// distance the short way round (endless maps wrap at the edges)
const wrapTmp = new THREE.Vector3();
function wrapDist(a, b) {
  const W = World.map.wrap;
  let dx = a.x - b.x, dz = a.z - b.z;
  if (W) { dx -= W * Math.round(dx / W); dz -= W * Math.round(dz / W); }
  return Math.hypot(dx, a.y - b.y, dz);
}

function posOf(id) {
  if (id === myId) return me.pos;
  const p = players.get(id);
  return p ? p.tp : null;
}

function hostTryTag(tagger, target) {
  if (!isPlaying() || H.releaseLeft > 0 || !players.has(target) || !canTagPair(tagger, target)) return;
  const now = performance.now();
  if (game.mode === 'bomb' && now - (H.itSince[tagger] || 0) < CONFIG.tag.bombPassDelay * 1000 - 150) return;
  if (game.mode === 'koth' && H.immune > 0) return;
  // same allowance for every player, host included: contact range + room for lag
  const a = posOf(tagger), b = posOf(target);
  const reach = CONFIG.tag.touchRange + (game.mode === 'duel' ? CONFIG.tag.duelReachBonus : 0) + CONFIG.tag.lagSlack;
  if (!a || !b || wrapDist(a, b) > reach) return;
  if (game.scores[tagger]) game.scores[tagger].tags++;
  if (game.mode === 'duel') {
    Net.broadcast({ t: 'tagev', from: tagger, to: target });
    showTagEvent(tagger, target);
    duelPoint(tagger, 'tag');
    return;
  }
  if (game.mode === 'bomb') {
    const lt = H.lastTag;
    if (lt && lt.from === target && lt.to === tagger && now - lt.time < CONFIG.tag.noPassBack * 1000) return;
    setIt([target]);
    H.lastTag = { from: tagger, to: target, time: now };
    hostFeed(`${nameOf(tagger)} passed the bomb to ${nameOf(target)}`);
  } else {
    H.lastTag = { from: target, to: tagger, time: now };
    hostCrown(tagger, `${nameOf(tagger)} stole the crown!`);
  }
  pushState();
  Net.broadcast({ t: 'tagev', from: tagger, to: target });
  showTagEvent(tagger, target);
}

function hostHandle(from, m) {
  if (m.t === 'hello') {
    if (players.has(from)) { Net.sendTo(from, buildState()); return; }
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
    ensurePlayer(from, name, pickColor(m.color), pickEye(m.eye), pickCos(m.cos));
    game.scores[from] = { tags: 0 };
    if (isPlaying() && game.mode === 'koth') game.koth.pts[from] = 0;
    hostFeed(`${name} joined`);
    pushState();
    autoMode();
    teleportPlayer(from, randomSpawn(), World.map.kind === 'race' ? World.map.race.yaw : undefined);
  } else if (m.t === 'me') {
    const p = players.get(from);
    if (p) setPose(p, m.s);
  } else if (m.t === 'tag') {
    hostTryTag(from, String(m.id));
  } else if (m.t === 'fell') {
    hostFell(from);
  } else if (m.t === 'finish') {
    hostFinish(from);
  }
}

function hostOnLeave(id) {
  if (!players.has(id)) return;
  const name = nameOf(id), wasIt = isIt(id);
  removePlayer(id);
  delete game.scores[id];
  game.it = game.it.filter((x) => x !== id);
  hostFeed(`${name} left`);
  setTimeout(autoMode, 0);
  if (isPlaying()) {
    if (game.mode === 'duel' && game.duel.ids.includes(id)) { hostEndRound(`${name} left the duel`); return; }
    if (game.mode === 'bomb') {
      const b = game.bomb;
      b.alive = b.alive.filter((x) => x !== id);
      if (b.alive.length <= 1) { hostEndRound(`${name} left`); return; }
      if (wasIt && H.releaseLeft <= 0) {   // the bomb jumps to someone else, same fuse
        const pick = b.alive[Math.floor(Math.random() * b.alive.length)];
        setIt([pick]);
        hostFeed(`The bomb jumped to ${nameOf(pick)}!`);
      }
    }
    if (game.mode === 'koth' && wasIt) { hostDropCrown(); return; }
    if (game.mode === 'race' && players.size && [...players.keys()].every((x) => game.race.done[x] !== undefined)) H.endIn = 1;
    if (players.size < 1) { hostEndRound('Everyone left'); return; }
  }
  pushState();
}

function hostTick(dt) {
  const mine = players.get(myId);
  if (mine) { mine.tp.copy(me.pos); mine.yaw = me.yaw; mine.pitch = me.pitch; mine.mode = me.mode(); mine.talk = talkT > 0; }

  if (isPlaying()) {
    if (H.endIn > 0) {
      H.endIn -= dt;
      if (H.endIn <= 0) hostEndRound();
    } else if (H.releaseLeft > 0) {
      H.releaseLeft -= dt;
      if (H.releaseLeft <= 0) {
        H.releaseLeft = 0;
        if (game.mode === 'bomb') hostDropBomb();
        else if (game.mode === 'koth') { const ids = [...players.keys()]; hostCrown(ids[Math.floor(Math.random() * ids.length)], null); }
      }
    } else {
      H.timeLeft -= dt;
      if (game.mode === 'race') H.raceTime += dt;
      if (game.mode === 'bomb' && game.it.length) {
        H.fuse -= dt;
        if (H.fuse <= 0) hostExplode();
      }
      if (game.mode === 'koth') {
        H.immune = Math.max(0, H.immune - dt);
        if (game.it.length) game.koth.pts[game.it[0]] = (game.koth.pts[game.it[0]] || 0) + dt;
        else if (game.koth.loose) {
          // loose crown: first one to reach the middle grabs it
          const c = crownSpot();
          for (const id of players.keys()) {
            const p = posOf(id);
            if (p && wrapDist(p, { x: c[0], y: c[1] + 0.3, z: c[2] }) < 1.8) { hostCrown(id, `${nameOf(id)} grabbed the crown!`); break; }
          }
        }
      }
    }
    game.tl = Math.max(0, H.timeLeft);
    game.rl = H.releaseLeft;
    game.fz = Math.max(0, H.fuse);
    game.im = H.immune;
    if (H.timeLeft <= 0 && H.releaseLeft <= 0 && H.endIn <= 0 && isPlaying()) {
      if (game.mode === 'duel') duelPoint(game.duel.ids.find((i) => i !== game.it[0]), 'survived');
      else if (game.mode === 'koth') hostEndRound('Time!');
      else if (game.mode === 'race') hostEndRound('Time!');
    }
    H.stateAcc += dt;
    if (H.stateAcc >= 1 && isPlaying()) { H.stateAcc = 0; pushState(); }
  } else if (game.phase === 'results') {
    H.resultsLeft -= dt;
    if (H.resultsLeft <= 0) { game.phase = 'lobby'; game.result = null; game.it = []; game.bomb = game.koth = game.race = game.duel = null; pushState(); }
  }

  H.snapAcc += dt;
  if (H.snapAcc >= 1 / CONFIG.net.sendRate - 0.005) {
    H.snapAcc = 0;
    const p = {};
    for (const pl of players.values()) p[pl.id] = [r2(pl.tp.x), r2(pl.tp.y), r2(pl.tp.z), r2(pl.yaw), r2(pl.pitch), pl.mode, pl.talk ? 1 : 0];
    const snap = { t: 'snap', p, tl: r2(game.tl), rl: r2(game.rl), wt: Math.round(worldTime() * 1000) / 1000 };
    if (game.mode === 'bomb' && isPlaying()) snap.fz = r2(game.fz);
    if (game.mode === 'koth' && isPlaying()) {
      snap.im = r2(game.im);
      snap.kp = {};
      for (const id in game.koth.pts) snap.kp[id] = Math.round(game.koth.pts[id] * 10) / 10;
    }
    Net.broadcast(snap);
  }
}

// ---------- client ----------
function clientHandle(m) {
  switch (m.t) {
    case 'state': applyState(m); break;
    case 'snap': applySnap(m); break;
    case 'tp': if (Array.isArray(m.p)) me.teleport(m.p, Number.isFinite(+m.y) ? +m.y : faceCenter(m.p)); break;
    case 'feed': addFeed(String(m.text).slice(0, 120)); break;
    case 'tagev': showTagEvent(String(m.from), String(m.to)); break;
    case 'boom': if (Array.isArray(m.p)) onBoom(String(m.id), m.p.map(Number), !!m.out); break;
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
  if (isPlaying()) {
    if (game.rl > 0) game.rl = Math.max(0, game.rl - dt);
    else {
      game.tl = Math.max(0, game.tl - dt);
      if (game.mode === 'bomb' && game.it.length) game.fz = Math.max(0, game.fz - dt);
      if (game.mode === 'koth') {
        game.im = Math.max(0, game.im - dt);
        if (game.it.length && game.koth) game.koth.pts[game.it[0]] = (game.koth.pts[game.it[0]] || 0) + dt;
      }
    }
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
// the joiner's connection finished opening on our side: if they already said hello, send them
// everything again (anything sent before this point was dropped)
Net.onOpen = (id) => {
  if (!Net.isHost || !players.has(id)) return;
  Net.sendTo(id, buildState());
  const p = players.get(id);
  Net.sendTo(id, { t: 'tp', p: [p.tp.x, p.tp.y, p.tp.z] });
};
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
  // bomb: no instant pass-backs - say so instead of silently failing
  const lt = game.lastTag;
  if (game.mode === 'bomb' && lt && lt.from === id && lt.to === myId) {
    const left = CONFIG.tag.noPassBack - (now - lt.at) / 1000;
    if (left > 0) { tagHint = `Can't pass straight back to ${nameOf(id)} for ${left.toFixed(1)}s`; tagHintUntil = now + 400; return; }
  }
  if (Net.isHost) hostTryTag(myId, id);
  else Net.send({ t: 'tag', id });
}

// big readable message for whoever was involved in a tag
let talkT = 0;
function taunt(secs = 1.1) {
  talkT = Math.max(talkT, secs);
  for (let i = 0; i < 5; i++) tone(260 + Math.random() * 260, 180 + Math.random() * 200, 0.07, 'square', 0.035, i * 0.11);
}
function showTagEvent(from, to) {
  if (from === myId) talkT = Math.max(talkT, 0.8);
  if (from === myId || to === myId) shake = Math.max(shake, 0.5);
  nearFlag = false;
  if (from === myId) { stats.tagged(game.mode); tagAnim = 1; }
  if (game.mode === 'duel') {
    if (to === myId) { flash('rgba(255,40,60,.55)'); SFX.tagged(); showBanner(`<div class="big red">CAUGHT</div><div>by ${esc(nameOf(from))}</div>`, 1.8); }
    else if (from === myId) { SFX.tag(); showBanner(`<div class="big lime">GOT 'EM!</div><div>You tagged ${esc(nameOf(to))}</div>`, 1.8); }
  } else if (game.mode === 'bomb') {
    if (from === myId) { SFX.pass(); showBanner(`<div class="big lime">PASSED!</div><div>${esc(nameOf(to))} has the bomb - get away!</div>`, 1.6); }
    else if (to === myId) showBanner(`<div class="big red">YOU HAVE THE BOMB</div><div>from ${esc(nameOf(from))} - pass it on!</div>`, 2);
  } else if (game.mode === 'koth') {
    if (from === myId) { SFX.crown(); showBanner('<div class="big gold">CROWN STOLEN!</div><div>Now hold it</div>', 1.6); }
    else if (to === myId) { flash('rgba(255,209,102,.45)'); SFX.tagged(); showBanner(`<div class="big red">CROWN LOST</div><div>${esc(nameOf(from))} took it - get it back!</div>`, 2); }
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
// Some browsers/mice occasionally report one huge bogus jump while the pointer is locked, which
// snaps your view. Drop a single event that's wildly bigger than how you've been moving.
let mouseAvg = 0;
addEventListener('mousemove', (e) => {
  if (!locked) return;
  const mag = Math.hypot(e.movementX, e.movementY);
  if (mag > 250 && mag > mouseAvg * 10 + 40) { mouseAvg *= 0.5; return; }
  mouseAvg += (Math.min(mag, 400) - mouseAvg) * 0.2;
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
  // raw mouse input where the browser supports it (no OS acceleration, fewer jumps)
  const plain = () => { try { const r = renderer.domElement.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch (e) {} };
  try {
    const r = renderer.domElement.requestPointerLock({ unadjustedMovement: true });
    if (r && r.catch) r.catch(plain);
  } catch (e) { plain(); }
  mouseAvg = 0;
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

// ---------- stats page ----------
function renderStats() {
  const d = stats.data, pct = (w, g) => (g ? Math.round(w / g * 100) + '%' : '-');
  const mins = Math.floor(d.playTime / 60), time = mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`;
  const tile = (k, v) => `<div class="stat"><b>${esc(String(v))}</b><span>${esc(k)}</span></div>`;
  const modeRows = MODES.filter((m) => m.id !== 'race').map((m) => {
    const x = d.modes[m.id] || { games: 0, wins: 0, tags: 0 };
    return `<tr><td>${m.name}</td><td>${x.games}</td><td>${x.wins}</td><td>${pct(x.wins, x.games)}</td><td>${x.tags}</td></tr>`;
  }).join('');
  const race = d.modes.race || { games: 0, wins: 0 };
  const best = MAPS.filter((m) => m.kind === 'race').map((m) => `<tr><td>${esc(m.name)}</td><td>${d.race.best[m.id] ? fmtRace(d.race.best[m.id]) : '-'}</td></tr>`).join('');
  $('statsBody').innerHTML = `<div class="tile"><div class="stat-grid">${tile('games', d.games)}${tile('wins', d.wins)}${tile('win rate', pct(d.wins, d.games))}` +
    `${tile('tags', d.tags)}${tile('times blown up', d.exploded)}${tile('played', time)}</div></div>` +
    `<div class="tile"><div class="tile-kicker">Tag modes</div><table class="stat-table"><thead><tr><th></th><th>Games</th><th>Wins</th><th>Win rate</th><th>Tags</th></tr></thead><tbody>${modeRows}</tbody></table>` +
    `<p class="note">Best King of the Tag score: ${d.kothBest}</p></div>` +
    `<div class="tile"><div class="tile-kicker">Racing</div><table class="stat-table"><thead><tr><th>Course</th><th>Best time</th></tr></thead><tbody>${best}</tbody></table>` +
    `<p class="note">${race.games} races · ${race.wins} wins · ${d.race.finishes} finishes · ${d.race.falls} falls</p></div>`;
}

// ---------- menus (main + escape share the Settings / Controls panels) ----------
function showView(root, name) {
  cancelRebind();
  if (name === 'stats') renderStats();
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
  const playing = isPlaying();
  const hostId = Net.isHost ? myId : CONFIG.net.prefix + Net.code;
  $('pauseCode').innerHTML = (Net.code || '----').split('').map((ch) => `<i>${esc(ch)}</i>`).join('');
  $('lobbySub').textContent = playing ? `${modeInfo(game.mode).name} in progress`
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
  const why = startProblem(modeInfo(getSetup().mode), players.size);
  $('startBtn').disabled = !!why;
  $('startBtn').textContent = why || 'Start round';
  $('playerCount').textContent = `Players · ${players.size} / ${CONFIG.tag.maxPlayers}`;
  $('playerList').innerHTML = [...players.values()].map((p) => {
    const tag = p.id === hostId ? '<span class="tag">Host</span>' : '';
    return `<li><span class="dot" style="background:${esc(p.color)}"></span>${esc(p.name)}` +
      `${p.id === myId ? ' <span class="you">(you)</span>' : ''}${tag}</li>`;
  }).join('');
}

$('resumeBtn').onclick = lock;
$('startBtn').onclick = () => { hostStartRound(); lock(); };
$('endBtn').onclick = () => hostEndRound('Ended by host');
// --- round setup: pick a mode, then a map that fits it, then the mode's options ---
const MODES = [
  { id: 'bomb', name: 'Bomb Tag', kind: 'tag', min: 2, desc: 'Run into people to pass the bomb. When the fuse runs out, whoever holds it is out. Last one standing wins.',
    opts: [{ key: 'len', label: 'Game length', vals: [[90, 'Short'], [150, 'Normal'], [210, 'Long']], def: 150 }] },
  { id: 'duel', name: 'Duel', kind: 'tag', min: 2, max: 2, desc: '1v1, taking turns to chase. Catch them before the timer ends to score, or survive to score. First to the target wins.',
    opts: [{ key: 'chase', label: 'Each chase', vals: [[30, '30 sec'], [45, '45 sec'], [60, '1 min']], def: 45 },
           { key: 'target', label: 'First to', vals: [[3, '3'], [5, '5'], [7, '7']], def: 5 }] },
  { id: 'koth', name: 'King of the Tag', kind: 'tag', min: 2, desc: 'Hold the crown to score a point every second. Run into the king to steal it. Most points wins.',
    opts: [{ key: 'len', label: 'Round length', vals: [[120, '2 min'], [180, '3 min'], [240, '4 min']], def: 180 }] },
  { id: 'race', name: 'Race', kind: 'race', min: 1, desc: 'Race to the finish. Fall off and you go back to the start - no checkpoints.',
    opts: [{ key: 'len', label: 'Time limit', vals: [[240, '4 min'], [360, '6 min'], [480, '8 min']], def: 360 }] },
];
const hostSetup = { mode: players.size === 2 ? 'duel' : 'bomb', opts: {} };
for (const m of MODES) { hostSetup.opts[m.id] = {}; for (const o of m.opts) hostSetup.opts[m.id][o.key] = o.def; }
const getSetup = () => (!Net.isHost && game.setup && game.setup.opts ? game.setup : hostSetup);
const canEditSetup = () => Net.isHost && !isPlaying();
function setupChanged() {
  game.setup = JSON.parse(JSON.stringify(hostSetup));
  if (Net.isHost && inGame) pushState(); else updatePauseUI();
}
$('modeCards').innerHTML = MODES.map((m) => `<button class="mode-card" data-id="${m.id}"><b>${m.name}</b><span>${m.desc}</span><span class="warn"></span></button>`).join('');
let modePicked = false;
function autoMode() {
  if (!Net.isHost || modePicked || isPlaying()) return;
  const want = players.size === 2 ? 'duel' : 'bomb';
  if (hostSetup.mode !== want && hostSetup.mode !== 'race') { hostSetup.mode = want; setupChanged(); }
}
$('modeCards').onclick = (e) => {
  const c = e.target.closest('.mode-card');
  if (!c || !canEditSetup()) return;
  modePicked = true;
  hostSetup.mode = c.dataset.id;
  // switching between racing and tag swaps to a map of the right kind
  const race = modeInfo(hostSetup.mode).kind === 'race';
  if ((World.map.kind === 'race') !== race && inGame) hostSetMap(MAPS.find((m) => (m.kind === 'race') === race).id);
  setupChanged();
};
$('mapCards').onclick = (e) => {
  const c = e.target.closest('.map-card');
  if (!c || !canEditSetup()) return;
  $('mapSel').value = c.dataset.id;
  $('mapSel').onchange();
};
$('modeOpts').onclick = (e) => {
  const b = e.target.closest('.pill');
  if (!b || !canEditSetup()) return;
  hostSetup.opts[hostSetup.mode][b.dataset.k] = +b.dataset.v;
  setupChanged();
};

function renderSetup() {
  const su = getSetup(), mode = modeInfo(su.mode), edit = canEditSetup(), race = mode.kind === 'race';
  document.querySelector('.setup').classList.toggle('locked', !edit);
  document.querySelectorAll('.mode-card').forEach((c) => {
    c.classList.toggle('on', c.dataset.id === mode.id);
    c.disabled = !edit;
    const m = modeInfo(c.dataset.id), why = startProblem(m, players.size);
    c.querySelector('.warn').textContent = why && players.size > 0 ? why.split('.')[0] : '';
  });
  const maps = MAPS.filter((m) => (m.kind === 'race') === race);
  const html = maps.map((m) => {
    const [a, b] = m.accent || ['#333', '#555'];
    return `<button class="map-card${m.id === game.map ? ' on' : ''}" data-id="${m.id}"${edit ? '' : ' disabled'}>
      <div class="map-thumb" style="background:linear-gradient(90deg, ${a} 0 50%, ${b} 50% 100%)"></div>
      <div class="map-body"><span class="map-name">${esc(m.name)}</span></div></button>`;
  }).join('');
  if ($('mapCards').dataset.html !== html) { $('mapCards').dataset.html = html; $('mapCards').innerHTML = html; }
  $('mapPickBlurb').textContent = World.map.blurb;
  const o = su.opts[mode.id] || {};
  $('modeOpts').innerHTML = mode.opts.map((op) => `<div class="pill-row"><span>${op.label}</span><div class="pills">` +
    op.vals.map(([v, l]) => `<button class="pill${o[op.key] === v ? ' on' : ''}" data-k="${op.key}" data-v="${v}"${edit ? '' : ' disabled'}>${l}</button>`).join('') +
    '</div></div>').join('');
  const desc = mode.opts.map((op) => (op.vals.find((v) => v[0] === o[op.key]) || ['', ''])[1]).join(' · ');
  $('startSummary').innerHTML = `<b>${mode.name}</b> on <b>${esc(World.map.name)}</b> · ${esc(desc)}`;
}
$('mapSel').innerHTML = MAPS.map((m) => `<option value="${m.id}">${esc(m.name)}</option>`).join('');
$('mapSel').onchange = () => {
  if (Net.isHost && inGame) hostSetMap($('mapSel').value);
  else $('mapBlurb').textContent = getMap($('mapSel').value).blurb;
};
$('mapList').innerHTML = MAPS.map((m) => `<li><b>${esc(m.name)}</b>${m.kind === 'race' ? ' (race)' : ''} - ${esc(m.blurb)}</li>`).join('');
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
// performance mode (on by default): no shadows
function applyPerf() {
  setResMax();
  renderer.setSize(innerWidth, innerHeight);
  if (sun.castShadow === !settings.perfMode) return;
  sun.castShadow = !settings.perfMode;
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
bindToggle('perf', 'perfMode', applyPerf);
bindToggle('showFps', 'showFps', () => $('fps').classList.toggle('hidden', !settings.showFps));
$('fps').classList.toggle('hidden', !settings.showFps);
applySpeedVis();

// key bindings
const BIND_LABELS = {
  forward: 'Move forward', back: 'Move back', left: 'Move left', right: 'Move right',
  jump: 'Jump / wall kick', run: 'Run', slide: 'Slide / crouch', scoreboard: 'Scoreboard', pause: 'Pause menu (Esc works too)', lookBack: 'Look behind (hold)', taunt: 'Taunt (talk)',
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

// Tab: the same leaderboard, big, in the middle of the screen
function renderScoreboard() {
  const sb = $('scoreboard');
  if (sb.classList.contains('hidden')) return;
  const { title, rows } = boardRows();
  sb.innerHTML = `<h3>${esc(title)} <span>code ${esc(Net.code)}</span></h3><table><tbody>` + rows.map((r, i) =>
    `<tr class="${r.cls}${r.p.id === myId ? ' is-me' : ''}"><td>${i + 1}</td><td><span class="dot" style="background:${esc(r.p.color)}"></span>${esc(r.p.name)}${r.p.id === myId ? ' (you)' : ''}</td>` +
    `<td>${esc(r.tag)}</td><td>${esc(r.val)}</td><td>${(game.scores[r.p.id] || { tags: 0 }).tags} tags</td></tr>`).join('') + '</tbody></table>';
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
  if (res.slow > 1) next = Math.max(res.min, res.now - 0.15);
  else if (res.fast > 6) next = Math.min(res.max, res.now + 0.1);
  if (next !== res.now) {
    res.now = next;
    res.slow = res.fast = 0;
    renderer.setPixelRatio(next);
    renderer.setSize(innerWidth, innerHeight);
  }
}

// frame rate readout (Settings → Show frame rate), refreshed twice a second
let fpsFrames = 0, fpsSince = 0;
function countFps(now) {
  fpsFrames++;
  if (now - fpsSince < 500) return;
  if (settings.showFps && fpsSince) setText('fps', `${Math.round(fpsFrames * 1000 / (now - fpsSince))} FPS`);
  fpsFrames = 0;
  fpsSince = now;
}

function frame(now) {
  requestAnimationFrame(frame);
  const raw = (now - last) / 1000;
  const dt = Math.max(0, Math.min(raw, 0.05));   // first frame can be negative
  last = now;
  autoRes(raw);
  countFps(now);
  World.actors = inGame ? [me.pos, ...[...players.values()].filter((p) => p.avatar && p.id !== myId).map((p) => p.avatar.root.position)] : [];
  if (!inGame) World.updateMovers(worldTime());
  if (inGame) { updateGame(dt); stats.tick(dt); }
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
  World.animate(now / 1000, dt);   // after the physics step, so movers are drawn where they collide
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
  const playing = isPlaying(), go = playing && game.rl <= 0, T = CONFIG.tag;
  // frozen: both duelists before each chase, and everyone on the start line of a race
  const frozen = playing && game.rl > 0 && (inDuel(myId) || game.mode === 'race');
  const duelChaser = playing && game.mode === 'duel' && isIt(myId);
  // whoever does the chasing runs a little faster
  me.speedMul = !go ? 1 : duelChaser ? T.duelChaserSpeed
    : game.mode === 'bomb' && isIt(myId) ? T.bombSpeed
    : game.mode === 'koth' && !isIt(myId) ? T.kothSpeed : 1;
  const reachBonus = duelChaser ? T.duelReachBonus : 0;
  const inp = locked && !frozen ? readInput() : NO_INPUT;
  if (frozen) me.jumpBuf = 0;

  acc += dt;
  let n = 0;
  let wt = worldTime() - acc;
  while (acc >= STEP && n < 10) { wt += STEP; World.updateMovers(wt); me.step(STEP, inp); acc -= STEP; n++; }
  if (n >= 10) acc = 0;
  World.wrapPos(me.pos);   // endless maps: off one edge, in at the other

  // the void. On a race course: straight back to the start. Elsewhere: a random spawn
  // (and in a duel your opponent scores, in King of the Tag you drop the crown)
  if (me.pos.y < World.map.killY) {
    const sp = randomSpawn();
    me.teleport(sp, faceCenter(sp));
    flash('rgba(0,0,0,.9)');
    SFX.fall();
    if (World.map.kind === 'race') {
      if (playing && game.mode === 'race') { stats.fell(); if (!raceDone) showBanner('<div class="big red">BACK TO THE START</div>', 1.2); }
    } else if (playing) { if (Net.isHost) hostFell(myId); else Net.send({ t: 'fell' }); }
  }
  // crossed the finish line
  if (go && game.mode === 'race' && !raceDone && game.race && performance.now() > finishSentAt + 500) {
    const f = World.map.race.finish;
    if (Math.abs(me.pos.x - f.x) < f.w / 2 && Math.abs(me.pos.z - f.z) < f.d / 2 && me.pos.y > f.y - 0.5 && me.pos.y < f.y + f.h) {
      finishSentAt = performance.now();
      if (Net.isHost) hostFinish(myId); else Net.send({ t: 'finish' });
    }
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

  // countdown finished
  if (playing && prevRl > 0 && game.rl <= 0) {
    SFX.go();
    if (game.mode === 'duel') showBanner(isIt(myId) ? '<div class="big red">GO!</div><div>Catch them</div>' : inDuel(myId) ? '<div class="big lime">GO!</div><div>Run!</div>' : '<div class="big">GO!</div>', 1.4);
    else if (game.mode === 'race') showBanner('<div class="big lime">GO!</div>', 1.2);
  }
  prevRl = playing ? game.rl : 0;

  // bump-to-tag, against where you SEE them
  if (go && game.mode !== 'race') {
    for (const p of players.values()) {
      if (p.id === myId || !p.avatar || !canTagPair(myId, p.id)) continue;
      const q = p.avatar.root.position;
      const d = Math.hypot(q.x - me.pos.x, (q.y - me.pos.y) * 0.8, q.z - me.pos.z);
      if (d < T.touchRange + reachBonus) tryTag(p.id);
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
  // hold look-behind: the camera turns around, you keep running the way you were going
  const back = locked && held('lookBack');
  arms.forEach((a) => (a.visible = !back));
  camera.rotation.set(me.pitch + pitchKick + n3 * tr * 0.02, me.yaw + (back ? Math.PI : 0) + n1 * tr * 0.012, (roll + rollKick) * (back ? -1 : 1) + n2 * tr * 0.025);

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
  let nearestSeeker = Infinity, oppDist = Infinity;
  for (const p of players.values()) {
    const a = p.avatar;
    if (!a) continue;
    const px = a.root.position.x, py = a.root.position.y, pz = a.root.position.z;
    // endless maps: chase their copy nearest to where we last drew them (no lerping across the
    // whole tile when they wrap), then draw them at the copy nearest to me
    wrapTmp.copy(p.tp);
    World.nearestCopy(wrapTmp, a.root.position);
    if (p.snapNext) { a.root.position.copy(p.tp); p.snapNext = false; }
    else a.root.position.lerp(wrapTmp, k);
    World.nearestCopy(a.root.position, me.pos);
    const sp = Math.min(30, Math.hypot(a.root.position.x - px, a.root.position.z - pz) / dt);
    a.spd += (sp - a.spd) * ease(8);
    a.vy += (Math.max(-30, Math.min(30, (a.root.position.y - py) / dt)) - a.vy) * ease(8);
    animateScamp(a.scamp, dt, performance.now() / 1000, a.spd, p.mode, Math.abs(a.vy) > 1.5 && p.mode !== 1, p.talk);
    a.root.rotation.y = lerpAngle(a.root.rotation.y, p.yaw, k);
    a.rig.rotation.x += ((p.mode === 1 ? 1.05 : 0) - a.rig.rotation.x) * k;
    a.rig.scale.y += ((p.mode === 2 ? 0.62 : 1) - a.rig.scale.y) * k;
    const it = isIt(p.id) && playing, dist = a.root.position.distanceTo(me.pos), now = performance.now() / 1000;
    // props
    a.bomb.visible = it && game.mode === 'bomb';
    if (a.bomb.visible) animateBomb(a.bomb, now, game.bomb ? game.fz / game.bomb.fuseLen : 1);
    a.crown.visible = it && game.mode === 'koth';
    setScampGhost(a.scamp, isOut(p.id) ? 0.25 : p.cos && p.cos.ghost ? p.cos.ghostOp : 1);
    applyCos(a.scamp, p.cos, now);
    a.label.material.opacity = isOut(p.id) ? 0.4 : 1;
    // see-through outline of whoever matters to you right now
    let xr = null;
    if (playing && game.rl <= 0) {
      if (game.mode === 'duel' && isIt(myId) && inDuel(p.id)) xr = '#c6ff3d';
      else if (game.mode === 'koth' && it && !isIt(myId)) xr = '#ffd166';
      else if (game.mode === 'bomb' && !isOut(myId) && !isOut(p.id) && dist < 30) xr = it ? '#ff4d3d' : isIt(myId) ? '#ffffff' : null;
    }
    setScampXray(a.scamp, xr);
    a.marker.visible = !!xr && (game.mode !== 'bomb' || it);
    if (a.marker.visible) { a.marker.material.color.set(xr); a.marker.scale.set(0.45, 0.45, 1).multiplyScalar(0.8 + Math.min(1.6, dist / 18)); }
    a.bodyMat.emissive.setHex(it && game.mode === 'bomb' ? 0x3a0806 : 0x000000);
    // how close is the danger (for the heartbeat + red vignette)
    if (go && !isOut(myId) && (canTagPair(myId, p.id) || canTagPair(p.id, myId))) oppDist = Math.min(oppDist, dist);
    if (go && !isOut(myId) && ((game.mode === 'bomb' && it && !isIt(myId)) || (game.mode === 'duel' && it && !isIt(myId) && inDuel(myId))
      || (game.mode === 'koth' && isIt(myId)))) nearestSeeker = Math.min(nearestSeeker, dist);
    // blob shadow on whatever is under them, fading as they get higher
    const rp = a.root.position, fy = World.floorBelow(rp.x, rp.y + 0.3, rp.z), up = rp.y - fy;
    a.blob.visible = fy > -1e8 && up < 6;
    if (a.blob.visible) {
      a.blob.position.set(rp.x, fy + 0.02, rp.z);
      a.blob.scale.setScalar(1 + up * 0.12);
      a.blob.material.opacity = 0.42 * (1 - up / 6);
    }
  }

  // the loose crown, my own bomb, and the bomb's sounds
  looseCrown.visible = playing && game.mode === 'koth' && !!game.koth && game.koth.loose;
  if (looseCrown.visible) {
    const c = crownSpot(), t = performance.now() / 1000;
    looseCrown.position.set(c[0], c[1] + 1.2 + Math.sin(t * 2) * 0.15, c[2]);
    World.nearestCopy(looseCrown.position, me.pos);
    looseCrown.userData.crown.rotation.y = t * 1.5;
  }
  const holding = playing && game.mode === 'bomb' && isIt(myId);
  vmBomb.visible = holding;
  const fuseFrac = game.bomb && game.it.length ? game.fz / game.bomb.fuseLen : 1;
  if (holding) {
    animateBomb(vmBomb, performance.now() / 1000, fuseFrac);
    if (game.fz < 5) shake = Math.max(shake, 0.25 + (5 - game.fz) * 0.05);
  }
  bombAudio(dt, fuseFrac);
  stepFx(dt);

  autoTaunt(dt, oppDist);
  talkT = Math.max(0, talkT - dt);
  updateHud(hs, frozen, nearestSeeker);
  twoPlayerFx(dt, nearestSeeker);
  sbTimer += dt;
  if (sbTimer > 0.25 || boardDirty) { sbTimer = 0; boardDirty = false; renderBoard(); }
}
let finishSentAt = 0, boardDirty = true, beepT = 0;

// you chatter by yourself after a near miss, and now and then during a close chase
let chaseT = 0, autoTauntAt = 0, nearMiss = false;
function autoTaunt(dt, d) {
  const now = performance.now();
  if (d < 2.4) nearMiss = true;
  else if (nearMiss && d > 4.5) {
    nearMiss = false;
    if (now - autoTauntAt > 2000) { autoTauntAt = now; taunt(1.0); }
  }
  chaseT = d < 7 ? chaseT + dt : 0;
  if (chaseT > 1.5 && now - autoTauntAt > 3500 + Math.random() * 4000) { autoTauntAt = now; taunt(0.8); }
}

// fuse hiss + beeps: loud for whoever holds it, quieter the farther you are; beeps speed up at the end
function bombAudio(dt, frac) {
  const live = isPlaying() && game.mode === 'bomb' && game.it.length > 0 && game.rl <= 0;
  if (!live) { fuseAudio(0, 0); beepT = 0; return; }
  const mine = isIt(myId), h = players.get(game.it[0]);
  const d = mine ? 0 : h && h.avatar ? h.avatar.root.position.distanceTo(me.pos) : 99;
  const level = mine ? 1 : Math.max(0, 1 - d / 24) * 0.6;
  fuseAudio(level, 1 - frac);
  beepT -= dt;
  if (beepT <= 0) {
    const fz = game.fz;
    beepT = fz > 10 ? 1 : 0.09 + 0.91 * (fz / 10);
    if (level > 0.02 || fz < 10) SFX.beep(Math.max(level, fz < 10 ? 0.25 : 0), fz < 5);
    if (mine && fz < 10) SFX.beat();
  }
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
  const playing = isPlaying(), now = performance.now();
  // 3-2-1 before every chase / bomb / race
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
  // tick through the last 5 seconds of a timed round
  const tl = Math.ceil(game.tl);
  if (playing && game.mode !== 'bomb' && game.rl <= 0 && tl <= 5 && tl > 0 && tl !== lastTick) { lastTick = tl; SFX.tick(); }
  if (!playing) lastTick = 0;

  // edge arrow to whoever you're after: duel opponent, the king (or the dropped crown),
  // or - holding the bomb - the closest player
  const ptr = $('pointer');
  let target = null, label = '', color = '#c6ff3d';
  if (playing && game.rl <= 0 && !isOut(myId)) {
    if (game.mode === 'duel' && inDuel(myId)) {
      const o = players.get(game.duel.ids.find((i) => i !== myId));
      if (o && o.avatar) { target = o.avatar.root.position; label = isIt(myId) ? 'RUNNER' : 'CHASER'; color = isIt(myId) ? '#c6ff3d' : '#ff3344'; }
    } else if (game.mode === 'koth' && !isIt(myId)) {
      const k = game.it.length ? players.get(game.it[0]) : null;
      if (k && k.avatar) { target = k.avatar.root.position; label = 'KING'; color = '#ffd166'; }
      else if (game.koth && game.koth.loose) { const c = crownSpot(); projV2.set(c[0], c[1], c[2]); target = projV2; label = 'CROWN'; color = '#ffd166'; }
    } else if (game.mode === 'bomb' && isIt(myId)) {
      let best = Infinity;
      for (const p of players.values()) {
        if (p.id === myId || !p.avatar || isOut(p.id)) continue;
        const d = p.avatar.root.position.distanceTo(me.pos);
        if (d < best) { best = d; target = p.avatar.root.position; }
      }
      label = 'NEAREST'; color = '#ffffff';
    }
  }
  let show = false;
  if (target) {
    const d = target.distanceTo(me.pos);
    projV.set(target.x, target.y + 1.9, target.z).project(camera);
    const behind = projV.z > 1;
    const x = behind ? -projV.x : projV.x, y = behind ? -projV.y : projV.y;
    const offScreen = behind || Math.abs(x) > 0.92 || Math.abs(y) > 0.88;
    if (offScreen || d > 8) {
      let px, py, rot;
      if (offScreen) {
        const a = Math.atan2(y, x);
        px = (Math.cos(a) * 0.86 + 1) / 2 * innerWidth;
        py = (1 - Math.sin(a) * 0.78) / 2 * innerHeight;
        rot = 90 - a * 180 / Math.PI;
      } else {
        px = (x + 1) / 2 * innerWidth;
        py = (1 - y) / 2 * innerHeight - 26;
        rot = 180;
      }
      ptr.style.color = color;
      ptr.style.left = px + 'px';
      ptr.style.top = py + 'px';
      ptr.firstChild.style.transform = `rotate(${rot}deg)`;
      setText('pointerLabel', `${label} ${Math.round(d)}m`);
      show = true;
    }
    // close calls in a duel
    if (game.mode === 'duel') {
      if (d < 2.2) nearFlag = true;
      else if (nearFlag && d > 4.5) {
        nearFlag = false;
        if (now - closeCallAt > 4000) {
          closeCallAt = now;
          showBanner(isIt(myId) ? '<div class="big" style="color:#ff6bd6">SO CLOSE!</div>' : '<div class="big lime">CLOSE CALL!</div>', 1.1);
        }
      }
    }
  }
  if (ptr.style.display !== (show ? 'block' : 'none')) ptr.style.display = show ? 'block' : 'none';

  // heartbeat when the danger is closing in
  if (playing && game.rl <= 0 && nearestSeeker < 16) {
    beatT -= dt;
    if (beatT <= 0) { SFX.beat(); beatT = 0.32 + 0.9 * (nearestSeeker / 16); }
  } else beatT = 0;
}
const projV2 = new THREE.Vector3();

function lerpAngle(a, b, t) {
  const d = ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
  return a + d * t;
}

function updateHud(hs, frozen, nearestSeeker) {
  const playing = isPlaying(), go = playing && game.rl <= 0, mode = game.mode;
  setText('speed', `${me.vel.length().toFixed(1)} m/s`);   // total speed, falling and rising included
  setText('codeText', Net.code);

  let phase = 'WARMUP', timer = `${players.size} player${players.size === 1 ? '' : 's'}`, urgent = false;
  if (playing) {
    phase = modeName();
    if (mode === 'duel' && game.duel) {
      const d = game.duel;
      phase = `DUEL · CHASE ${d.chase} · ${d.pts[d.ids[0]]}-${d.pts[d.ids[1]]} · FIRST TO ${d.target}`;
      timer = game.rl > 0 ? `Go in ${Math.ceil(game.rl)}` : fmtTime(game.tl);
      urgent = go && game.tl <= 10;
    } else if (mode === 'bomb' && game.bomb) {
      phase = `BOMB TAG · ${game.bomb.alive.length} LEFT`;
      timer = game.rl > 0 ? `Bomb drops in ${Math.ceil(game.rl)}` : game.it.length ? `${nameOf(game.it[0])} has it` : '';
    } else if (mode === 'koth') {
      timer = game.rl > 0 ? `Crown in ${Math.ceil(game.rl)}` : fmtTime(game.tl);
      urgent = go && game.tl <= 10;
    } else if (mode === 'race') {
      timer = game.rl > 0 ? `Start in ${Math.ceil(game.rl)}` : game.race && game.race.order.length ? `Ends in ${fmtTime(game.tl)}` : fmtTime(game.tl);
      urgent = go && game.tl <= 15;
    }
  } else if (game.phase === 'results') { phase = 'ROUND OVER'; timer = ''; }
  setText('phaseText', phase);
  setText('timerText', timer);
  $('timerText').classList.toggle('urgent', urgent);

  // the big fuse timer (Bomb Tag): everyone sees it, it shakes and goes red near the end
  const fz = $('fuse'), live = playing && mode === 'bomb' && game.it.length > 0 && go;
  fz.classList.toggle('hidden', !live);
  if (live) {
    const frac = game.bomb ? game.fz / game.bomb.fuseLen : 1;
    setText('fuseNum', game.fz < 10 ? game.fz.toFixed(1) : String(Math.ceil(game.fz)));
    $('fuseBar').style.transform = `scaleX(${Math.max(0, frac).toFixed(3)})`;
    fz.className = (game.fz < 5 ? 'crit' : game.fz < 10 ? 'warn' : '') + (isIt(myId) ? ' mine' : '');
  }

  const role = $('roleBadge');
  let roleText = '', roleCls = 'runner';
  if (playing) {
    if (mode === 'duel') { if (inDuel(myId)) { roleText = isIt(myId) ? 'CHASER' : 'RUNNER'; roleCls = isIt(myId) ? 'it' : 'runner'; } }
    else if (mode === 'bomb') { roleText = isOut(myId) ? 'OUT' : isIt(myId) ? 'YOU HAVE THE BOMB' : 'RUN'; roleCls = isOut(myId) ? 'out' : isIt(myId) ? 'it' : 'runner'; }
    else if (mode === 'koth') { roleText = isIt(myId) ? `KING · ${Math.floor(game.koth.pts[myId] || 0)}` : 'STEAL THE CROWN'; roleCls = isIt(myId) ? 'king' : 'it'; }
    else if (mode === 'race' && raceDone) { roleText = `FINISHED ${ord(game.race.order.indexOf(myId) + 1).toUpperCase()}`; roleCls = 'king'; }
  }
  setText('roleBadge', roleText);
  role.className = roleText ? roleCls : 'hidden';

  let hint = '';
  const now = performance.now();
  if (playing && mode === 'koth' && go && !isIt(myId) && game.im > 0 && game.it.length) hint = `Crown protected for ${game.im.toFixed(1)}s`;
  if (playing && mode === 'koth' && go && game.koth && game.koth.loose) hint = 'The crown is loose in the middle - grab it!';
  if (playing && mode === 'bomb' && isIt(myId) && go && now < tagReadyAt) hint = 'Get ready to pass it…';
  if (playing && mode === 'race' && go && !raceDone) hint = `${Math.round(raceToGo(me.pos))}m to go`;
  if (playing && mode === 'bomb' && isOut(myId)) hint = 'You\'re out - spectating';
  if (now < tagHintUntil) hint = tagHint;
  if (frozen) hint = mode === 'race' ? 'On your marks…' : 'Get ready…';
  else if (game.phase === 'lobby') {
    hint = Net.isHost
      ? (players.size < 2 ? `Warmup - tell friends the code ${Net.code}` : 'Warmup - press ENTER (or P → Start round) to play')
      : 'Warmup - waiting for the host to start';
  }
  setText('hint', hint);

  // edges: red pulse while you hold the bomb (faster as it burns), red glow as danger closes in
  const v = $('vignette'), hot = playing && go && mode === 'bomb' && isIt(myId);
  if (v.classList.contains('it') !== hot) v.classList.toggle('it', hot);
  if (hot) v.style.setProperty('--pulse', `${(0.15 + 0.85 * (game.bomb ? game.fz / game.bomb.fuseLen : 1)).toFixed(2)}s`);
  const danger = (playing && go && !hot ? Math.max(0, 1 - nearestSeeker / 14) : 0).toFixed(2);
  if (danger !== v.dataset.d) { v.dataset.d = danger; v.style.setProperty('--danger', danger); }
}

// --- leaderboard on the right side: always up, mode-specific ---
function boardRows() {
  const list = [...players.values()], rows = [];
  const mode = game.mode, playing = isPlaying() || game.phase === 'results';
  const row = (p, val, tag, cls) => ({ p, val, tag, cls });
  if (!playing) return { title: 'WARMUP', rows: list.map((p) => row(p, '', '', '')) };
  if (mode === 'bomb' && game.bomb) {
    const b = game.bomb;
    for (const id of b.alive) { const p = players.get(id); if (p) rows.push(row(p, b.maxLives > 1 ? '\u25A0'.repeat(b.lives[id] || 0) : '', isIt(id) ? 'BOMB' : '', isIt(id) ? 'hot' : '')); }
    b.out.slice().reverse().forEach((id) => { const p = players.get(id); if (p) rows.push(row(p, 'out', '', 'dead')); });
    for (const p of list) if (!b.alive.includes(p.id) && !b.out.includes(p.id)) rows.push(row(p, 'next game', '', 'dead'));
    return { title: `BOMB TAG · ${b.alive.length} LEFT`, rows };
  }
  if (mode === 'duel' && game.duel) {
    const d = game.duel;
    for (const id of d.ids) { const p = players.get(id); if (p) rows.push(row(p, String(d.pts[id]), isIt(id) ? 'CHASER' : 'RUNNER', isIt(id) ? 'hot' : '')); }
    for (const p of list) if (!d.ids.includes(p.id)) rows.push(row(p, 'watching', '', 'dead'));
    return { title: `DUEL · FIRST TO ${d.target}`, rows };
  }
  if (mode === 'koth' && game.koth) {
    const pts = game.koth.pts;
    list.sort((a, b) => (pts[b.id] || 0) - (pts[a.id] || 0));
    return { title: 'KING OF THE TAG', rows: list.map((p) => row(p, String(Math.floor(pts[p.id] || 0)), isIt(p.id) ? 'KING' : '', isIt(p.id) ? 'gold' : '')) };
  }
  if (mode === 'race' && game.race) {
    const r = game.race;
    const done = r.order.map((id) => players.get(id)).filter(Boolean);
    const rest = list.filter((p) => r.done[p.id] === undefined).map((p) => ({ p, togo: raceToGo(p.id === myId ? me.pos : p.avatar ? p.avatar.root.position : p.tp) }))
      .sort((a, b) => a.togo - b.togo);
    return { title: 'RACE', rows: done.map((p, i) => row(p, fmtRace(r.done[p.id]), ord(i + 1).toUpperCase(), i === 0 ? 'gold' : ''))
      .concat(rest.map((o) => row(o.p, `${Math.round(o.togo)}m`, '', ''))) };
  }
  return { title: modeName(), rows: list.map((p) => row(p, '', '', '')) };
}
let lastBoard = '';
function renderBoard() {
  const { title, rows } = boardRows();
  const html = `<div class="board-title">${esc(title)}</div>` + rows.map((r, i) =>
    `<div class="board-row ${r.cls}${r.p.id === myId ? ' me' : ''}"><span class="rank">${i + 1}</span><span class="dot" style="background:${esc(r.p.color)}"></span>` +
    `<span class="nm">${esc(r.p.name)}</span>${r.tag ? `<span class="btag">${esc(r.tag)}</span>` : ''}<span class="val">${esc(r.val)}</span></div>`).join('');
  if (html !== lastBoard) { lastBoard = html; $('board').innerHTML = html; }
}

// ---------- menu ----------
const ADJ = ['Swift', 'Sly', 'Zippy', 'Turbo', 'Sneaky', 'Bouncy', 'Rapid', 'Slick', 'Wild', 'Lucky'];
const NOUN = ['Fox', 'Gecko', 'Otter', 'Hare', 'Ferret', 'Lynx', 'Newt', 'Moth', 'Weasel', 'Frog'];
// default name is bobo (old auto-generated names like "RapidFox" get replaced too)
const autoName = (n) => ADJ.some((a) => n.startsWith(a)) && NOUN.some((w) => n.endsWith(w));
$('name').value = !settings.name || autoName(settings.name) ? 'bobo' : settings.name;

// character preview + fur color on the main menu
// first time here: a random body color (eyes that stand out on it), kept from then on
if (!settings.colorPicked || !isHex(settings.color)) {
  settings.color = COLORS[Math.floor(Math.random() * COLORS.length)];
  const c = new THREE.Color(settings.color);
  settings.eye = 0.299 * c.r + 0.587 * c.g + 0.114 * c.b > 0.6 ? '#1f2433' : '#ffffff';
  settings.colorPicked = true;
  saveSettings();
}
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
      const cos = myCos();
      setScampGhost(c, cos && cos.ghost ? cos.ghostOp : 1);
      applyCos(c, cos, t);
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

// --- the secret code: only its SHA-256 is stored here, so the code itself isn't in the source ---
const SECRET = '36b7c813e30a3c4aae7a1a04ff35c32125eb0836f1fed7b5b77df06e8f229d7a';
async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((x) => x.toString(16).padStart(2, '0')).join('');
}
// the box is invisible and gives no feedback: type the code into it and the Cosmetics panel appears
$('secretCode').addEventListener('input', async (e) => {
  const v = e.target.value.trim();
  if (v.length > 40) e.target.value = '';
  if (!v || !window.crypto || !crypto.subtle) return;
  if (await sha256(v) !== SECRET) return;
  e.target.value = '';
  settings.unlocked = true;
  saveSettings();
  renderCos();
});
function renderCos() {
  $('cosPanel').classList.toggle('hidden', !settings.unlocked);
  const c = Object.assign({}, COS_DEFAULT, settings.cos || {});
  $('cosPanel').querySelectorAll('.pills[data-k]').forEach((g) => g.querySelectorAll('.pill').forEach((b) => b.classList.toggle('on', b.dataset.v === String(c[g.dataset.k]))));
  $('ghostOp').value = Math.round(c.ghostOp * 100);
  $('ghostOpVal').textContent = `${Math.round(c.ghostOp * 100)}%`;
  $('ghostOpRow').classList.toggle('hidden', !c.ghost);
  $('rbStyleRow').classList.toggle('hidden', c.rb === 'off');
  $('glintColor').value = c.glintColor;
  $('glintColor').classList.toggle('hidden', !c.glint);
}
const setCos = (k, v) => { settings.cos = Object.assign({}, COS_DEFAULT, settings.cos || {}, { [k]: v }); saveSettings(); renderCos(); };
$('cosPanel').addEventListener('click', (e) => {
  const b = e.target.closest('.pill'), g = b && b.closest('.pills[data-k]');
  if (!g) return;
  const k = g.dataset.k, v = b.dataset.v;
  setCos(k, k === 'ghost' || k === 'neon' || k === 'glint' ? v === 'true' : v);
});
$('ghostOp').addEventListener('input', (e) => setCos('ghostOp', Math.max(0.2, +e.target.value / 100)));
$('glintColor').addEventListener('input', (e) => setCos('glintColor', e.target.value));
renderCos();

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
    ensurePlayer(myId, name, pickColor(settings.color), pickEye(settings.eye), myCos());
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
    const hello = { t: 'hello', v: CONFIG.version, name, color: settings.color, eye: settings.eye, cos: myCos() };
    Net.send(hello);
    // say hello again until the host answers (a hello sent too early can get lost)
    let tries = 0;
    const again = setInterval(() => { if (gotState || ++tries > 10 || !inGame) clearInterval(again); else Net.send(hello); }, 1000);
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
// for automated tests: ?debug exposes the internals
if (/[?&]debug\b/.test(location.search)) window.__dbg = { game, H, me, players, hostSetup, setupChanged, hostStartRound, CONFIG, World, raceToGo };

requestAnimationFrame(frame);
})();
