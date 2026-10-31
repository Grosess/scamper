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
  { name: '', sens: 1, fov: CONFIG.camera.fov, autorun: false, volume: 0.8, invertY: false, showSpeed: true, shake: 1, perfMode: true, showFps: false, thirdPerson: false, unlocked: false, cos: null },
  ['scamper-settings', 'catenaries-settings', 'tagrush-settings'].map(loadJSON).find((o) => Object.keys(o).length) || {});
const DEFAULT_KEYS = JSON.parse(JSON.stringify(CONFIG.keys));
if (settings.keys) for (const a in DEFAULT_KEYS) if (Array.isArray(settings.keys[a])) CONFIG.keys[a] = settings.keys[a].slice(0, 2);
function loadJSON(k) { return Store.get(k) || {}; }   // local storage, or its cookie copy (store.js)
function saveSettings() { Store.set('scamper-settings', settings); Account.dirty(); }

// CPU players (host only): id -> Bot (see bots.js)
const bots = new Map();

// ---------- stats (saved in this browser) ----------
const stats = (() => {
  const KEY = 'scamper-stats';
  const d = Object.assign({ games: 0, wins: 0, tags: 0, exploded: 0, playTime: 0, modes: {}, race: { best: {}, finishes: 0, falls: 0 }, kothBest: 0, pvp: { games: 0, wins: 0 } }, loadJSON(KEY));
  const mode = (m) => (d.modes[m] = Object.assign({ games: 0, wins: 0, tags: 0, pg: 0, pw: 0 }, d.modes[m] || {}));
  const save = () => { Store.set(KEY, d); Account.dirty(); };
  let unsaved = 0;
  return {
    data: d,
    started() {},
    ended(r) {
      if (!r || !r.mode) return;
      if (r.mode === 'gp') {   // the rounds already counted as games; the final only counts as a Grand Prix
        mode('gp').games++;
        if ((r.winners || []).includes(myId)) mode('gp').wins++;
        save();
        return;
      }
      d.games++;
      mode(r.mode).games++;
      const won = (r.winners || []).includes(myId);
      if (won) { d.wins++; mode(r.mode).wins++; }
      // win rate only counts games against other people, not ones with just CPUs
      if ([...players.values()].some((p) => p.id !== myId && !p.cpu)) {
        d.pvp.games++; mode(r.mode).pg++;
        if (won) { d.pvp.wins++; mode(r.mode).pw++; }
      }
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
// layer 1 = players only (drawn again around endless maps), so the lights have to reach it too
for (const l of [hemi, ambient, sun]) l.layers.enable(1);

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
    // flat look: lamps are just looks - no real light pools (they'd shade floors unevenly)
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
  if (bots.size) { Nav.build(); for (const b of bots.values()) { b.route = null; b.pi = 0; } }   // CPUs need the new map's routes (old ones point at old nodes)
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

// bell ropes ring louder the closer you are
World.onBell = (x, y, z) => { const d = Math.hypot(me.pos.x - x, me.pos.y - y, me.pos.z - z); SFX.bell(Math.max(0.15, 1 - d / 40)); };

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
  // a bell: a few inharmonic partials ringing out
  bell: (v) => [[1, 0.5], [2.01, 0.25], [2.76, 0.18], [5.4, 0.08]].forEach(([k, a]) => tone(392 * k, 392 * k * 0.995, 2.4 / Math.sqrt(k), 'sine', 0.12 * a * v)),
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
const skinMat = new THREE.MeshBasicMaterial({ color: SCAMP_DARK });
const sleeveMat = new THREE.MeshBasicMaterial({ color: SCAMP_DARK });
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
  const marker = makeLabel('\u25BC', '#b6f27a', 128);
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
  // Freeze Tag: a block of ice around frozen players
  const ice = new THREE.Mesh(new THREE.BoxGeometry(1.0, 2.1, 0.8), new THREE.MeshBasicMaterial({ color: '#9fe6ff', transparent: true, opacity: 0.38, depthWrite: false }));
  ice.position.y = 1.05;
  ice.add(new THREE.LineSegments(new THREE.EdgesGeometry(ice.geometry), new THREE.LineBasicMaterial({ color: '#e8fbff' })));
  ice.visible = false;
  root.add(label, marker, bomb, ice);
  scene.add(root);
  const blob = new THREE.Mesh(blobGeo, new THREE.MeshBasicMaterial({ color: 0x000000, map: glowTex, transparent: true, opacity: 0.4, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }));
  blob.rotation.x = -Math.PI / 2;
  scene.add(blob);
  return { root, rig: c.rig, scamp: c, bodyMat: c.fur, label, marker, bomb, crown, ice, blob, spd: 0, vy: 0 };
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

// ---------- who you are: an account (its unique name + what it has won) or a guest ----------
// guests all look the same (blue, dark eyes) and get a cute random name - make an account for more
const GUEST = ITEMS.GUEST;
if (!ITEMS.GUEST_NAMES.includes(settings.guestName)) { settings.guestName = ITEMS.GUEST_NAMES[Math.floor(Math.random() * ITEMS.GUEST_NAMES.length)]; saveSettings(); }
const devOn = () => !!(Account.me && Account.me.dev && settings.devMode);   // developer mode: everything unlocked
const myName = () => (Account.me ? Account.me.name : settings.guestName);
function ownedColors() {
  if (!Account.me) return [];
  if (devOn()) return ITEMS.COLORS.map((c) => c.hex);
  return Account.me.inv.colors.map((id) => ITEMS.byId[id]).filter(Boolean).map((c) => c.hex);
}
const ownsCos = () => devOn();   // cosmetics (neon, ghost, glint, rainbow) are developer-only
// keep your look to what you own; body and eyes are never the same color
function fixLook() {
  if (!Account.me) { settings.color = GUEST.body; settings.eye = GUEST.eye; return; }
  const own = ownedColors();
  if (!own.length) return;
  if (!own.includes(settings.color)) settings.color = own[0];
  // body and eyes can't match - except in developer mode
  if (!own.includes(settings.eye) || (settings.eye === settings.color && !devOn())) settings.eye = own.find((h) => h !== settings.color) || own[0];
}
// cosmetics you haven't won are switched off
function limitCos(c, owns) {
  if (!c) return null;
  if (!owns('rainbow')) c.rb = 'off';
  if (!owns('ghost')) c.ghost = false;
  if (!owns('neon')) c.neon = false;
  if (!owns('glint')) c.glint = false;
  return c;
}
const myCos = () => (Account.me ? limitCos(pickCos(Object.assign({}, COS_DEFAULT, settings.cos || {})), ownsCos) : null);
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

// ---------- randomizer: random happenings in the middle of a round (works with every mode) ----------
// move(b) changes the movement numbers (b = this map's normal ones) while the happening lasts
const RANDOM_EVENTS = {
  nograv: { name: 'NO GRAVITY', sub: 'Everyone floats - jump and drift', secs: 13,
    move: (b) => ({ gravity: b.gravity * 0.05, maxFall: 3, jumpSpeed: b.jumpSpeed * 0.45, wallKickUp: b.wallKickUp * 0.35, wallHangGravity: 0 }) },
  // like a mini mushroom: tiny, quick little legs, big floaty jumps, slow falls, fits through anything
  tiny: { name: 'TINY', sub: 'Small, floaty and squeezes through anything', secs: 15, scale: 0.45,
    move: (b) => ({ standHeight: 0.8, crouchHeight: 0.45, radius: 0.18, eyeFromTop: 0.07, stepHeight: 0.22, mantleMaxHeight: 0.9, wallDetect: 0.3,
      walkSpeed: b.walkSpeed * 0.9, runSpeed: b.runSpeed * 0.9, gravity: b.gravity * 0.55, jumpSpeed: b.jumpSpeed * 0.88, maxFall: b.maxFall * 0.35, wallKickUp: b.wallKickUp * 0.8 }) },
  // the lights cut out every 2 seconds: in the dark you only see about a meter ahead, and nobody's outline
  dark: { name: 'LIGHTS OUT', sub: 'The lights keep cutting out', secs: 14 },
  zoom: { name: 'ZOOMIES', sub: 'Everyone is way faster', secs: 13,
    move: (b) => ({ walkSpeed: b.walkSpeed * 1.35, runSpeed: b.runSpeed * 1.35, maxSpeed: b.maxSpeed * 1.3, slideBoostCap: b.slideBoostCap * 1.3 }) },
  ice: { name: 'ICE RINK', sub: 'Every floor is slippery', secs: 13,
    move: (b) => ({ groundAccel: b.groundAccel * 0.3, groundFriction: b.groundFriction * 0.1, overspeedDecay: b.overspeedDecay * 0.15, coastDecay: b.coastDecay * 0.15, speedTurn: b.speedTurn * 0.35, slideFriction: b.slideFriction * 0.3 }) },
  moon: { name: 'MOON SHOES', sub: 'Jump way, way higher', secs: 13,
    move: (b) => ({ jumpSpeed: b.jumpSpeed * 1.65, wallKickUp: b.wallKickUp * 1.35, mantleMaxHeight: b.mantleMaxHeight * 1.5 }) },
  slowmo: { name: 'SLOW MO', sub: 'Everything... slows... down...', secs: 10,
    move: (b) => ({ walkSpeed: b.walkSpeed * 0.5, runSpeed: b.runSpeed * 0.5, maxSpeed: b.maxSpeed * 0.5, crouchSpeed: b.crouchSpeed * 0.6, gravity: b.gravity * 0.3, jumpSpeed: b.jumpSpeed * 0.55, maxFall: b.maxFall * 0.4, slideBoost: b.slideBoost * 0.5 }) },
  flip: { name: 'UPSIDE DOWN', sub: 'Your screen flipped over', secs: 11 },
  mirror: { name: 'MIRROR MODE', sub: 'Left is right, right is left', secs: 12 },
  backwards: { name: 'BACKWARDS', sub: 'Forward goes back, back goes forward', secs: 11 },
  woozy: { name: 'WOOZY', sub: 'Everything is swaying', secs: 12 },
  tornado: { name: 'TORNADO', sub: 'You can\'t stop spinning', secs: 9 },
  disco: { name: 'DISCO', sub: 'Party lights!', secs: 13 },
  pixel: { name: '8-BIT', sub: 'Retro mode', secs: 12 },
  fisheye: { name: 'FISHEYE', sub: 'Super wide view', secs: 12 },
  invisible: { name: 'INVISIBLE', sub: 'Nobody can see anybody - watch the shadows', secs: 12 },
  bigheads: { name: 'BIG HEADS', sub: 'Huge heads for everyone', secs: 13 },
  impostors: { name: 'IMPOSTORS', sub: 'Everyone looks the same. Who\'s who?', secs: 13 },
  xray: { name: 'X-RAY', sub: 'Everyone sees everyone through walls', secs: 12 },
  wind: { name: 'WINDY', sub: 'A gale is blowing everyone sideways', secs: 12 },
  bouncy: { name: 'BOUNCY FLOORS', sub: 'Every landing bounces you back up (hold crouch to stick)', secs: 13 },
  rocket: { name: 'ROCKET JUMP', sub: 'Every jump launches you forward', secs: 12 },
  quake: { name: 'EARTHQUAKE', sub: 'The ground is shaking you around', secs: 10 },
  redlight: { name: 'RED LIGHT, GREEN LIGHT', sub: 'Freeze when the light goes red', secs: 14 },
  swap: { name: 'SWAP!', sub: 'Everyone switched places', secs: 2, once: true },
  shuffle: { name: 'TELEPORT', sub: 'Everyone got thrown somewhere random', secs: 2, once: true },
};
const IMPOSTOR = '#c9ced6';
const activeEvs = () => (isPlaying() && game.rnd ? game.rnd.evs : []);
const hasEv = (k) => isPlaying() && !!game.rnd && game.rnd.evs.includes(k);
const evScale = () => (hasEv('tiny') ? RANDOM_EVENTS.tiny.scale : 1);
// blinking happenings run on the shared clock, so everyone's lights go out together
const isDark = () => hasEv('dark') && Math.floor(worldTime() / 2) % 2 === 0;
const isRedLight = () => hasEv('redlight') && worldTime() % 3.4 > 2.2;
// a direction picked by the host for this happening (wind), the same on every screen
const evAngle = () => ((game.rnd && game.rnd.seed) || 0) * Math.PI * 2;
function applyMove() {
  if (!World.map) return;
  const m = Object.assign({}, DEFAULT_MOVE, World.map.move || {});
  for (const k of activeEvs()) if (RANDOM_EVENTS[k].move) Object.assign(m, RANDOM_EVENTS[k].move(m));
  Object.assign(CONFIG.move, m);
  // growing back to full size under something low: stay crouched until there's room
  for (const p of [me, ...[...bots.values()].map((b) => b.p)]) if (p && !World.canStand(p)) p.crouching = true;
}

// ---------- game state (host is the source of truth) ----------
//   mode   'bomb' | 'duel' | 'koth' | 'race'
//   it     the special player: bomb holder / duel chaser / king
const game = { setup: null, phase: 'lobby', mode: 'bomb', map: '', it: [], scores: {}, tl: 0, rl: 0, fz: 0, im: 0, result: null,
  duel: null, bomb: null, koth: null, race: null, lastTag: null, rnd: null, rndOn: false, gp: null };
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
  // freeze: seekers freeze runners, free runners thaw frozen ones
  if (game.mode === 'freeze') return isIt(a) ? !isIt(b) && !isFrozen(b) : !isFrozen(a) && isFrozen(b);
  return false;
}
// CPUs don't race: during a race they sit out (hidden, standing still, not ranked)
const sitsOut = (id) => isPlaying() && game.mode === 'race' && !!(players.get(id) || {}).cpu;
const racers = () => [...players.keys()].filter((id) => !(players.get(id) || {}).cpu);
const isFrozen = (id) => isPlaying() && game.mode === 'freeze' && !!game.freeze && game.freeze.frozen.includes(id);

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
const seen = { phase: 'lobby', it: [], chase: 0, out: false, ev: null, res: '' };
let exposedUntil = {};
const isExposed = (id) => (exposedUntil[id] || 0) > performance.now();
function applyState(s) {
  const wasIt = seen.it.includes(myId), oldPhase = seen.phase, oldIt = seen.it;
  const oldChase = seen.chase, wasOut = seen.out;
  const ids = new Set(s.roster.map((r) => r.id));
  for (const id of [...players.keys()]) if (!ids.has(id)) removePlayer(id);
  for (const r of s.roster) { if (pendingSkins[r.id] !== undefined) { const q = players.get(r.id) || ensurePlayer(r.id, String(r.name).slice(0, 16), pickColor(r.color), pickEye(r.eye), pickCos(r.cos)); q.skin = pendingSkins[r.id]; delete pendingSkins[r.id]; } const p = ensurePlayer(r.id, String(r.name).slice(0, 16), pickColor(r.color), pickEye(r.eye), pickCos(r.cos)); p.cpu = BOT_SKILL[r.cpu] ? r.cpu : null; }

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
  game.freeze = s.freeze || null;
  const evs = s.rnd && Array.isArray(s.rnd.evs) ? s.rnd.evs.filter((k) => RANDOM_EVENTS[k]) : [];
  game.rnd = evs.length ? { evs, left: +s.rnd.left || 0, seed: +s.rnd.seed || 0 } : null;
  game.rndOn = !!s.rndOn;
  game.gp = s.gp && typeof s.gp === 'object' ? s.gp : null;
  if (s.setup) game.setup = s.setup;
  game.lastTag = s.lastTag ? { from: s.lastTag.from, to: s.lastTag.to, at: performance.now() - s.lastTag.ago * 1000 } : null;
  exposedUntil = {};
  for (const id in s.exposed || {}) exposedUntil[id] = performance.now() + (+s.exposed[id] || 0) * 1000;

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
  } else if (started && game.mode === 'freeze') {
    showBanner(isIt(myId) ? '<div class="big red">SEEKER</div><div>Freeze them all at once. Released in a few seconds...</div>'
      : '<div class="big lime">FREEZE TAG</div><div>Don\'t get frozen - touch frozen teammates to thaw them</div>', 3);
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

  // randomizer happening started / ended
  const ev = activeEvs().join('+') || null;
  if (ev !== seen.ev) {
    seen.ev = ev;
    applyMove();
    evLook();
    if (ev) {
      const es = activeEvs().map((k) => RANDOM_EVENTS[k]);
      SFX.start();
      showBanner(`<div class="sub">${es.length > 1 ? 'DOUBLE TROUBLE' : 'RANDOMIZER'}</div><div class="big gold">${es.map((e) => esc(e.name)).join(' + ')}</div><div>${es.map((e) => esc(e.sub)).join(' · ')}</div>`, 2.4);
    } else if (playing) addFeed('Randomizer: back to normal');
  }

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

  const resKey = game.phase === 'results' && game.result ? `${game.result.title}|${game.result.sub}` : '';
  if (resKey && resKey !== seen.res) {
    SFX.end();
    const r = game.result;
    stats.ended(r);
    showBanner(`<div class="big">${esc(r.title)}</div><div class="sub">${esc(r.sub || '')}</div>` +
      `<ol class="results">${(r.lines || []).map((l) => `<li>${esc(l)}</li>`).join('')}</ol>`);
  }
  if (game.phase === 'lobby' && oldPhase === 'results') $('banner').classList.remove('show');
  seen.res = resKey;

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
const H = { match: null, moved: {}, lastPos: {}, round: 0, rndNext: 0, rndLast: [], exposed: {}, itSince: {}, timeLeft: 0, releaseLeft: 0, resultsLeft: 0, endIn: 0, fuse: 0, immune: 0, raceTime: 0, lastTag: null, snapAcc: 0, stateAcc: 0 };
// random starting colors for new players: bright, readable bodies
// the palette: every body and eye color comes from these soft pastels (eyes can also be white or ink)
const COLORS = ['#ff8fa3', '#ffb3c6', '#ff9b9b', '#ffb37a', '#ffd166', '#ffe599', '#c8e6a0', '#9be3a8', '#7ed6c8',
  '#a8dcef', '#8fb4ff', '#b8c0ff', '#c3a6ff', '#e0b0ff', '#f4a6ff', '#d9c2a7', '#c9ced6', '#f7f3ea'];
const ALL_HEX = ITEMS.COLORS.map((c) => c.hex).concat([GUEST.body, GUEST.eye]);
// any other color snaps to the closest one in the palette
function nearestIn(list, hex) {
  const c = new THREE.Color(hex), q = new THREE.Color();
  let best = list[0], bd = Infinity;
  for (const h of list) { q.set(h); const d = (q.r - c.r) ** 2 + (q.g - c.g) ** 2 + (q.b - c.b) ** 2; if (d < bd) { bd = d; best = h; } }
  return best;
}

const isHex = (c) => typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c);
function pickColor(want) { return isHex(want) ? nearestIn(ALL_HEX, want.toLowerCase()) : COLORS[Math.floor(Math.random() * COLORS.length)]; }
const pickEye = (want) => (isHex(want) ? nearestIn(ALL_HEX, want.toLowerCase()) : '#ffffff');
function cleanName(n) { return String(n || '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, 14) || 'bobo'; }
function uniqueName(n) {
  const taken = new Set([...players.values()].map((p) => p.name));
  if (!taken.has(n)) return n;
  for (let i = 2; ; i++) if (!taken.has(`${n}${i}`)) return `${n}${i}`;
}

function buildState() {
  return {
    t: 'state', phase: game.phase, mode: game.mode, map: game.map, it: game.it.slice(), setup: game.setup,
    duel: game.duel, bomb: game.bomb, koth: game.koth, race: game.race, freeze: game.freeze, gp: game.gp, rndOn: game.rndOn,
    rnd: game.rnd ? { evs: game.rnd.evs, left: r2(game.rnd.left), seed: game.rnd.seed } : null,
    lastTag: H.lastTag ? { from: H.lastTag.from, to: H.lastTag.to, ago: (performance.now() - H.lastTag.time) / 1000 } : null,
    exposed: Object.fromEntries(Object.entries(H.exposed).map(([id, t]) => [id, Math.max(0, (t - performance.now()) / 1000)]).filter(([, s]) => s > 0)),
    scores: game.scores, result: game.result,
    roster: [...players.values()].map((p) => ({ id: p.id, name: p.name, color: p.color, eye: p.eye, cos: p.cos || null, cpu: p.cpu || null })),
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
  else if (bots.has(id)) bots.get(id).p.teleport(pos, y);
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
  const su = getSetup(), mode = modeInfo(su.mode);
  const why = startProblem(mode, players.size);
  if (why) { showBanner(`<div class="big">CAN'T START</div><div>${esc(why)}</div>`, 2.5); return; }
  game.rndOn = !!su.random;
  if (mode.id === 'gp') {
    game.gp = { round: 0, of: su.opts.gp.rounds, pts: {}, last: '', done: false };
    for (const id of players.keys()) game.gp.pts[id] = 0;
    hostGpNext();
    return;
  }
  game.gp = null;
  beginRound(mode.id, su.opts[mode.id]);
}
function beginRound(modeId, o) {
  const mode = modeInfo(modeId), ids = [...players.keys()];
  // the map has to fit the mode (race courses for Race, arenas for the rest)
  if ((World.map.kind === 'race') !== (mode.kind === 'race')) hostSetMap(MAPS.find((m) => (m.kind === 'race') === (mode.kind === 'race')).id);
  game.mode = mode.id;
  game.phase = 'playing';
  game.result = null;
  game.scores = {};
  ids.forEach((id) => (game.scores[id] = { tags: 0 }));
  game.duel = game.bomb = game.koth = game.race = game.freeze = null;
  game.it = [];
  game.rnd = null;
  H.rndNext = devFirst() ? 3 : 6 + Math.random() * 12;   // first happening some time after the release
  H.rndCount = 0;
  H.lastTag = null;
  H.endIn = 0;
  H.immune = 0;
  game.im = 0;
  game.fz = 0;
  shuffle(ids);
  if (mode.id === 'freeze') startFreeze(ids, o);
  else if (mode.id === 'bomb') startBomb(ids, o);
  else if (mode.id === 'duel') startDuel(ids, o);
  else if (mode.id === 'koth') startKoth(ids, o);
  else startRace(ids, o);
  game.tl = H.timeLeft;
  game.rl = H.releaseLeft;
  pushState();
  hostMatchStart();
}
// --- prizes need a real game: the round is registered with the account server when it starts
// (it checks everyone's account itself and times the round), the host counts how far everyone
// really moves, and at the end the server decides who earned a crate. An idle second device or a
// two-second round earns nothing.
function hostMatchStart() {
  H.match = null;
  H.moved = {};
  H.lastPos = {};
  H.act = {};          // per player: seconds spent moving, jumps
  H.together = 0;      // seconds with two or more real players moving at the same time
  H.anyMoving = 0;     // seconds with at least one moving
  const tickets = [...players.values()].filter((p) => !p.cpu).map((p) => (p.id === myId ? Account.me && Account.me.ticket : p.ticket)).filter(Boolean);
  if (tickets.length < 2) return;
  const round = H.round = (H.round || 0) + 1;
  Account.matchStart(tickets).then((id) => { if (H.round === round) H.match = id; });
}
// how people really play this round: distance covered (teleports and respawns don't count), time
// spent moving, jumps, and how often two or more people move at the same time. One person farming
// with two devices can only steer one at a time, so the other just stands there.
function hostTrackMoves(dt) {
  let moving = 0;
  for (const [id, pl] of players) {
    const p = posOf(id);
    if (!p) continue;
    const l = H.lastPos[id], a = H.act[id] || (H.act[id] = { t: 0, jumps: 0, up: false });
    if (l && dt > 0) {
      const d = wrapDist(p, l);
      if (d < 6) {
        H.moved[id] = (H.moved[id] || 0) + d;
        if (Math.hypot(p.x - l.x, p.z - l.z) / dt > 1.5) { a.t += dt; if (!pl.cpu) moving++; }
        const vy = (p.y - l.y) / dt;
        if (vy > 3 && !a.up) { a.jumps++; a.up = true; } else if (vy <= 0) a.up = false;
      }
    }
    H.lastPos[id] = { x: p.x, y: p.y, z: p.z };
  }
  if (moving >= 1) H.anyMoving += dt;
  if (moving >= 2) H.together += dt;
}
function hostMatchEnd(r) {
  const match = H.match;
  H.match = null;
  if (!match) return;
  const acct = (id) => (players.get(id) || {}).name.toLowerCase();
  const play = {};
  for (const id in H.moved) {
    if (!players.has(id) || players.get(id).cpu) continue;
    const a = H.act[id] || { t: 0, jumps: 0 };
    play[acct(id)] = { moved: Math.round(H.moved[id]), active: Math.round(a.t), jumps: a.jumps };
  }
  const together = H.anyMoving > 0 ? Math.round(H.together / H.anyMoving * 100) / 100 : 0;
  Account.matchEnd(match, (r.winners || []).filter((id) => players.has(id)).map(acct), play, together).then((eligible) => {
    if (!eligible.length) return;
    const m = { t: 'prize', match: match.id, names: eligible };
    Net.broadcast(m);
    onPrize(m);
  });
}
// a winner of a real match: open a crate
function onPrize(m) {
  if (Account.me && Array.isArray(m.names) && m.names.includes(Account.me.name.toLowerCase())) setTimeout(() => openCrate(String(m.match)), 1500);
}
// --- Grand Prix: a run of rounds, each a random mode on a random map. Every round hands out
// points by placing; the most points after the last round wins the whole thing ---
const GP_PTS = [10, 7, 5, 4, 3, 2];
const GP_OPTS = { bomb: { len: 90 }, freeze: { len: 120 }, koth: { len: 120 }, race: { len: 240 }, duel: { chase: 30, target: 3 } };
function hostGpNext() {
  const g = game.gp, n = players.size;
  g.round++;
  let pool = ['bomb', 'freeze', 'koth', 'race'].concat(n === 2 ? ['duel'] : []).filter((m) => m !== g.last);
  const m = pool[Math.floor(Math.random() * pool.length)];
  g.last = m;
  const race = m === 'race', maps = MAPS.filter((x) => (x.kind === 'race') === race && x.id !== game.map);
  const pick = maps.length ? maps[Math.floor(Math.random() * maps.length)] : MAPS.find((x) => (x.kind === 'race') === race);
  game.phase = 'lobby';
  hostSetMap(pick.id);
  hostFeed(`Grand Prix round ${g.round}/${g.of}: ${modeInfo(m).name} on ${World.map.name}`);
  beginRound(m, GP_OPTS[m]);
}
// after a Grand Prix round: hand out the points
function gpAward(r) {
  const g = game.gp, rank = (r.ranking || []).filter((id) => players.has(id));
  if (r.teams) for (const id of rank) g.pts[id] = (g.pts[id] || 0) + (r.winners.includes(id) ? 8 : 3);
  else rank.forEach((id, i) => (g.pts[id] = (g.pts[id] || 0) + (i < GP_PTS.length ? GP_PTS[i] : 1)));
  r.sub = `Grand Prix · round ${g.round} of ${g.of}${r.sub ? ' · ' + r.sub : ''}`;
  r.lines = r.lines.concat(['- Grand Prix -'], gpStandings().map((id, i) => `${ord(i + 1)} ${nameOf(id)} - ${g.pts[id] || 0} pts`));
}
const gpStandings = () => [...players.keys()].sort((a, b) => (game.gp.pts[b] || 0) - (game.gp.pts[a] || 0));
function gpFinal() {
  const st = gpStandings(), top = game.gp.pts[st[0]] || 0, w = st.filter((id) => (game.gp.pts[id] || 0) === top);
  return { mode: 'gp', winners: w, ranking: st, title: w.length === 1 ? `${nameOf(w[0])} wins the Grand Prix!` : 'The Grand Prix is a tie!',
    sub: `${game.gp.round} rounds`, lines: st.map((id, i) => `${ord(i + 1)} ${nameOf(id)} - ${game.gp.pts[id] || 0} pts`) };
}

// --- randomizer (host): a happening every so often, never the same one twice in a row ---
function hostRandomTick(dt) {
  if (game.rnd) {
    game.rnd.left -= dt;
    if (game.rnd.left <= 0) { game.rnd = null; H.rndNext = 5 + Math.random() * 14; pushState(); }   // gaps vary: you never know when
    return;
  }
  H.rndNext -= dt;
  if (H.rndNext > 0) return;
  // never the same one twice in a row; now and then two at once
  // (no Teleport in a race: every spawn there is the start line)
  const skip = game.mode === 'race' ? ['shuffle'] : [];
  const pick = (no) => { const pool = Object.keys(RANDOM_EVENTS).filter((k) => !no.includes(k) && !skip.includes(k)); return pool[Math.floor(Math.random() * pool.length)]; };
  // developer setting: a chosen happening always comes first
  const first = H.rndCount++ === 0 ? devFirst() : null;
  if (first) { settings.devFirstEv = ''; saveSettings(); $('devEvent').value = ''; }   // used once, then back to random
  const evs = [first || pick(H.rndLast)];
  if (Math.random() < 0.2 && !RANDOM_EVENTS[evs[0]].once) evs.push(pick(H.rndLast.concat(evs, ['swap', 'shuffle'])));
  H.rndLast = evs;
  game.rnd = { evs, left: Math.max(...evs.map((k) => RANDOM_EVENTS[k].secs)), seed: Math.random() };
  hostFeed(`Randomizer: ${evs.map((k) => RANDOM_EVENTS[k].name).join(' + ')}`);
  if (evs.includes('swap')) hostSwap();
  if (evs.includes('shuffle')) for (const id of players.keys()) if (!isOut(id) && !sitsOut(id)) teleportPlayer(id, randomSpawn());
  pushState();
}
// everyone still in the round trades places with someone else
function hostSwap() {
  const ids = [...players.keys()].filter((id) => !isOut(id) && !sitsOut(id) && posOf(id));
  if (ids.length < 2) return;
  const spots = ids.map((id) => { const p = posOf(id); return [p.x, p.y + 0.05, p.z]; });
  const k = 1 + Math.floor(Math.random() * (ids.length - 1));   // rotate, so nobody stays put
  ids.forEach((id, i) => teleportPlayer(id, spots[(i + k) % ids.length], players.get(id) ? players.get(id).yaw : 0));
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

// --- freeze tag: seekers freeze runners on contact, runners thaw each other; freeze everyone at
//     once to win, or the runners win when time runs out ---
function startFreeze(ids, o) {
  const n = Math.max(1, Math.round(ids.length / 4));
  game.freeze = { frozen: [] };
  H.thawed = {};
  setIt(ids.slice(0, n));
  H.timeLeft = o.len;
  H.releaseLeft = 4;
  spreadOut(ids);
  hostFeed(`Freeze Tag! ${game.it.map(nameOf).join(', ')} ${n > 1 ? 'are seekers' : 'is the seeker'}`);
}
function freezeRunners() { return [...players.keys()].filter((id) => !isIt(id)); }
function hostCheckAllFrozen() {
  const r = freezeRunners();
  if (r.length && r.every((id) => game.freeze.frozen.includes(id))) H.endIn = 2;
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
  if (!isPlaying() || game.mode !== 'race' || game.rl > 0 || !r || r.done[id] !== undefined || sitsOut(id)) return;
  const p = posOf(id), f = World.map.race.finish, s = 2.5;
  if (!p || Math.abs(p.x - f.x) > f.w / 2 + s || Math.abs(p.z - f.z) > f.d / 2 + s || p.y < f.y - s || p.y > f.y + f.h + s) return;
  r.done[id] = Math.round(H.raceTime * 10) / 10;
  r.order.push(id);
  hostFeed(`${nameOf(id)} finished ${ord(r.order.length)} - ${fmtRace(r.done[id])}`);
  if (r.order.length === 1 && racers().length > 1) H.timeLeft = Math.min(H.timeLeft, CONFIG.tag.raceAfterFirst);
  if (racers().every((x) => r.done[x] !== undefined)) H.endIn = 2;
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
// Falling off during a round: seekers come straight back as far from the runners as the map
// allows; runners come back NEAR the seekers (but not on top of them), are held in place for a
// few seconds, and are exposed (outline through walls) for a few more. Duel: the other side also
// scores; King of the Tag: the king drops the crown.
const EXPOSE_SECS = 6;
function farSpawn(from) {
  let best = randomSpawn(), bd = -1;
  for (const sp of World.map.spawns) {
    let d = Infinity;
    for (const q of from) d = Math.min(d, wrapDist({ x: sp[0], y: sp[1], z: sp[2] }, q));
    if (d > bd) { bd = d; best = sp; }
  }
  return best;
}
function nearSpawn(from) {
  let best = randomSpawn(), bd = Infinity;
  for (const sp of World.map.spawns) {
    let d = Infinity;
    for (const q of from) d = Math.min(d, wrapDist({ x: sp[0], y: sp[1], z: sp[2] }, q));
    if (d >= 6 && d < bd) { bd = d; best = sp; }
  }
  return best;
}
// is this player one of the runners right now? (the ones being chased)
function isRunner(id) {
  if (!isPlaying()) return false;
  if (game.mode === 'bomb') return !isIt(id) && !isOut(id);
  if (game.mode === 'duel') return inDuel(id) && !isIt(id);
  if (game.mode === 'koth') return isIt(id);
  if (game.mode === 'freeze') return !isIt(id) && !isFrozen(id);
  return false;
}
// who's chasing the runners
function seekerIds() {
  if (game.mode === 'koth') return [...players.keys()].filter((x) => !isIt(x));
  return game.it.slice();
}
function hostFell(id) {
  if (!isPlaying()) { teleportPlayer(id, randomSpawn()); return; }
  const pos = (ids) => ids.filter((x) => x !== id && players.has(x)).map(posOf).filter(Boolean);
  const runner = isRunner(id);
  if (runner) {
    teleportPlayer(id, nearSpawn(pos(seekerIds())));
    H.exposed[id] = performance.now() + (CONFIG.tag.fallLock + EXPOSE_SECS) * 1000;
  } else teleportPlayer(id, farSpawn(pos([...players.keys()].filter(isRunner))));
  if (game.mode === 'duel') {
    const d = game.duel;
    if (d.ids.includes(id) && H.releaseLeft <= 0) { duelPoint(d.ids.find((i) => i !== id), id === game.it[0] ? 'the chaser fell' : 'fell into the void'); return; }
  } else if (game.mode === 'koth' && runner) {
    hostDropCrown();
    return;
  }
  if (runner) hostFeed(`${nameOf(id)} fell off!`);
  pushState();
}

function hostEndRound(sub) {
  if (!isPlaying()) return;
  game.phase = 'results';
  game.result = computeResult(sub);
  hostMatchEnd(game.result);
  game.rnd = null;
  if (game.gp) gpAward(game.result);
  H.resultsLeft = CONFIG.tag.resultsTime;
  H.endIn = 0;
  pushState();
}

function computeResult(sub) {
  const list = [...players.values()];
  const tags = (id) => (game.scores[id] || { tags: 0 }).tags;
  if (game.mode === 'duel' && game.duel) {
    const d = game.duel, [a, b] = d.ids, w = d.pts[a] >= d.pts[b] ? a : b;
    return { mode: 'duel', winners: [w], ranking: [w, d.ids.find((i) => i !== w)], title: `${d.names[w]} wins the duel!`, sub: sub || `${d.pts[a]} - ${d.pts[b]}`,
      lines: d.ids.map((i) => `${d.names[i]} - ${d.pts[i]} points`) };
  }
  if (game.mode === 'bomb' && game.bomb) {
    const b = game.bomb, order = b.alive.concat(b.out.slice().reverse()).filter((id) => players.has(id));
    const w = b.alive.length === 1 ? b.alive[0] : null;
    return { mode: 'bomb', winners: w ? [w] : [], ranking: order, title: w ? `${nameOf(w)} survives!` : 'Game over', sub: sub || 'Last one standing wins',
      lines: order.map((id, i) => `${ord(i + 1)} ${nameOf(id)} - ${tags(id)} passes`) };
  }
  if (game.mode === 'freeze' && game.freeze) {
    const seekers = list.filter((p) => isIt(p.id)), runners = list.filter((p) => !isIt(p.id));
    const won = runners.length && runners.every((p) => game.freeze.frozen.includes(p.id)) ? 'seekers' : 'runners';
    const w = won === 'seekers' ? seekers : runners;
    return { mode: 'freeze', winners: w.map((p) => p.id), teams: true, ranking: list.map((p) => p.id), title: won === 'seekers' ? 'Seekers win!' : 'Runners win!',
      sub: sub || (won === 'seekers' ? 'Everyone got frozen' : 'Not everyone was frozen'),
      lines: seekers.map((p) => `${p.name} (seeker) - ${tags(p.id)} freezes`).concat(runners.map((p) => `${p.name} - ${tags(p.id)} thaws${game.freeze.frozen.includes(p.id) ? ' (frozen)' : ''}`)) };
  }
  if (game.mode === 'koth' && game.koth) {
    const pts = game.koth.pts;
    list.sort((a, b) => (pts[b.id] || 0) - (pts[a.id] || 0));
    const w = list[0];
    return { mode: 'koth', winners: w ? [w.id] : [], ranking: list.map((p) => p.id), title: w ? `${w.name} rules!` : 'Round over', sub: sub || 'Most time with the crown wins',
      lines: list.map((p) => `${p.name} - ${Math.floor(pts[p.id] || 0)} points, ${tags(p.id)} steals`) };
  }
  if (game.mode === 'race' && game.race) {
    const r = game.race, rest = list.filter((p) => !p.cpu).filter((p) => r.done[p.id] === undefined).sort((a, b) => raceToGo(posOf(a.id)) - raceToGo(posOf(b.id)));
    const lines = r.order.filter((id) => players.has(id)).map((id, i) => `${ord(i + 1)} ${nameOf(id)} - ${fmtRace(r.done[id])}`)
      .concat(rest.map((p) => `${p.name} - ${Math.round(raceToGo(posOf(p.id)))}m to go`));
    const w = r.order[0];
    return { mode: 'race', winners: w ? [w] : [], ranking: r.order.filter((id) => players.has(id)).concat(rest.map((p) => p.id)), title: w ? `${nameOf(w)} wins the race!` : 'Nobody finished', sub: sub || World.map.name, lines };
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
  if (game.mode === 'freeze' && isIt(tagger) && (H.thawed[target] || 0) > now) return;   // just thawed: safe for a moment
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
  if (game.mode === 'freeze') {
    const f = game.freeze;
    if (isIt(tagger)) {
      f.frozen.push(target);
      hostFeed(`${nameOf(tagger)} froze ${nameOf(target)}`);
      hostCheckAllFrozen();
    } else {
      f.frozen = f.frozen.filter((x) => x !== target);
      H.thawed[target] = now + CONFIG.tag.thawProtect * 1000;
      hostFeed(`${nameOf(tagger)} thawed ${nameOf(target)}`);
    }
    H.lastTag = { from: tagger, to: target, time: now };
    pushState();
    Net.broadcast({ t: 'tagev', from: tagger, to: target });
    showTagEvent(tagger, target);
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
    // everyone shows up as a guest until the account server confirms who they are
    const L = lookFor(null, m), name = uniqueName(L.name);
    ensurePlayer(from, name, L.color, L.eye, L.cos);
    if (m.ticket) hostVerify(from, m);
    for (const q of players.values()) if (q.skin) Net.sendTo(from, { t: 'skin', id: q.id, img: q.skin });
    game.scores[from] = { tags: 0 };
    if (isPlaying() && game.mode === 'koth') game.koth.pts[from] = 0;
    if (game.gp) game.gp.pts[from] = game.gp.pts[from] || 0;
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
  } else if (m.t === 'upd') {
    hostUpdatePlayer(from, m);
  } else if (m.t === 'skin') {
    hostSetSkin(from, m.img);
  }
}

// what someone may look like. acct: what the account server says they own (null = a guest)
function lookFor(acct, m) {
  if (!acct || !acct.colors || !acct.colors.length) {
    const g = String(m.name || '').toLowerCase();
    return { name: ITEMS.GUEST_NAMES.includes(g) ? g : ITEMS.GUEST_NAMES[Math.floor(Math.random() * ITEMS.GUEST_NAMES.length)], color: GUEST.body, eye: GUEST.eye, cos: null };
  }
  const own = acct.colors, color = own.includes(m.color) ? m.color : own[0];
  const eye = own.includes(m.eye) && (m.eye !== color || acct.dev) ? m.eye : own.find((h) => h !== color) || own[0];
  return { name: acct.name, color, eye, cos: limitCos(pickCos(m.cos), (k) => acct.cos.includes(k)) };
}
function hostApplyLook(id, m, acct) {
  const p = players.get(id);
  if (!p || p.cpu) return;
  const L = lookFor(acct, m), old = p.name, name = L.name === old ? old : uniqueName(L.name);
  ensurePlayer(id, name, L.color, L.eye, L.cos);
  if (name !== old && !p.joining) hostFeed(`${old} is now ${name}`);
  p.joining = false;
  if (p.skinWant !== undefined) hostSetSkin(id, p.skinWant);
  pushState();
}
// ask the account server what this player's ticket really owns (remembered until their ticket
// changes). If the server can't be reached they stay a guest, and it tries again a few times.
function hostVerify(id, m, tries = 0) {
  const p = players.get(id);
  if (!p) return;
  if (p.ticket === m.ticket && p.acct !== undefined) { hostApplyLook(id, m, p.acct); return; }
  if (!tries) { p.ticket = m.ticket; p.joining = p.acct === undefined; }
  Account.verify(m.ticket).then((v) => {
    const q = players.get(id);
    if (!q || q.ticket !== m.ticket) return;
    if (v === 'offline') { if (tries < 4) setTimeout(() => hostVerify(id, m, tries + 1), 3000 * (tries + 1)); return; }
    q.acct = v;
    hostApplyLook(id, m, v);
  });
}
// someone changed their colors / cosmetics in the middle of a game
function hostUpdatePlayer(id, m) {
  if (id === myId) {   // the host's own look comes from its own account
    ensurePlayer(myId, myName(), settings.color, settings.eye, myCos());
    pushState();
    return;
  }
  if (m.ticket) hostVerify(id, m); else hostApplyLook(id, m, null);
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
    if (game.mode === 'freeze') {
      game.freeze.frozen = game.freeze.frozen.filter((x) => x !== id);
      if (!game.it.length) { const r = freezeRunners().filter((x) => !isFrozen(x)); if (r.length) setIt([r[0]]); }
      if (!freezeRunners().length) { hostEndRound(`${name} left`); return; }
      hostCheckAllFrozen();
    }
    if (game.mode === 'race' && racers().length && racers().every((x) => game.race.done[x] !== undefined)) H.endIn = 1;
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
      hostTrackMoves(dt);
      if (game.rndOn) hostRandomTick(dt);
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
      else if (game.mode === 'freeze') hostEndRound('Time! The runners held out');
      else if (game.mode === 'race') hostEndRound('Time!');
    }
    H.stateAcc += dt;
    if (H.stateAcc >= 1 && isPlaying()) { H.stateAcc = 0; pushState(); }
  } else if (game.phase === 'results') {
    H.resultsLeft -= dt;
    if (H.resultsLeft <= 0) {
      const g = game.gp;
      if (g && !g.done && g.round < g.of && players.size >= 2) { hostGpNext(); return; }
      if (g && !g.done) {   // the series is over: show the overall standings for a bit longer
        g.done = true;
        game.result = gpFinal();
        H.resultsLeft = CONFIG.tag.resultsTime + 3;
        pushState();
        return;
      }
      game.phase = 'lobby'; game.result = null; game.it = []; game.gp = null;
      game.bomb = game.koth = game.race = game.duel = game.freeze = null;
      pushState();
    }
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
    case 'prize': onPrize(m); break;
    case 'skin': { const p = players.get(String(m.id)); if (p) p.skin = cleanImg(m.img); else pendingSkins[m.id] = cleanImg(m.img); break; }
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
      if (game.rnd) game.rnd.left = Math.max(0, game.rnd.left - dt);
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
  } else if (game.mode === 'freeze') {
    const thaw = !isIt(from);
    if (to === myId && !thaw) { flash('rgba(140,220,255,.6)'); SFX.tagged(); showBanner(`<div class="big" style="background:#bfefff">FROZEN</div><div>by ${esc(nameOf(from))} - wait for a teammate</div>`, 2.2); }
    else if (to === myId) { SFX.pass(); showBanner(`<div class="big lime">THAWED!</div><div>${esc(nameOf(from))} saved you</div>`, 1.6); }
    else if (from === myId) { SFX.tag(); showBanner(thaw ? `<div class="big lime">THAWED</div><div>You saved ${esc(nameOf(to))}</div>` : `<div class="big" style="background:#bfefff">FROZE</div><div>${esc(nameOf(to))}</div>`, 1.4); }
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
  me.yaw -= e.movementX * k * (hasEv('mirror') ? -1 : 1);
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
    const x = Object.assign({ games: 0, wins: 0, tags: 0, pg: 0, pw: 0 }, d.modes[m.id] || {});
    return `<tr><td>${m.name}</td><td>${x.games}</td><td>${x.wins}</td><td>${pct(x.pw, x.pg)}</td><td>${x.tags}</td></tr>`;
  }).join('');
  const race = d.modes.race || { games: 0, wins: 0 };
  const best = MAPS.filter((m) => m.kind === 'race').map((m) => `<tr><td>${esc(m.name)}</td><td>${d.race.best[m.id] ? fmtRace(d.race.best[m.id]) : '-'}</td></tr>`).join('');
  $('statsBody').innerHTML = `<div class="tile"><div class="stat-grid">${tile('games', d.games)}${tile('wins', d.wins)}${tile('win rate vs people', pct(d.pvp.wins, d.pvp.games))}` +
    `${tile('tags', d.tags)}${tile('times blown up', d.exploded)}${tile('played', time)}</div></div>` +
    `<div class="tile"><div class="tile-kicker">Tag modes</div><table class="stat-table"><thead><tr><th></th><th>Games</th><th>Wins</th><th>Win rate</th><th>Tags</th></tr></thead><tbody>${modeRows}</tbody></table>` +
    `<p class="note">Win rate only counts games with other people in them (not games against just CPUs). Best King of the Tag score: ${d.kothBest}</p></div>` +
    (!MAPS.some((m) => m.kind === 'race') ? '' : `<div class="tile"><div class="tile-kicker">Racing</div><table class="stat-table"><thead><tr><th>Course</th><th>Best time</th></tr></thead><tbody>${best}</tbody></table>` +
    `<p class="note">${race.games} races · ${race.wins} wins · ${d.race.finishes} finishes · ${d.race.falls} falls</p></div>`);
}

// ---------- menus (main + escape share the Settings / Controls panels) ----------
function showView(root, name) {
  cancelRebind();
  if (name === 'you') renderMeEdit();
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
    const tag = p.id === hostId ? '<span class="tag">Host</span>' : p.cpu ? `<span class="tag cpu">CPU · ${p.cpu}</span>` : '';
    const kick = Net.isHost && p.cpu ? `<button class="cpu-x" data-id="${esc(p.id)}" title="Remove">×</button>` : '';
    return `<li><span class="dot" style="background:${esc(p.color)}"></span>${esc(p.name)}` +
      `${p.id === myId ? ' <span class="you">(you)</span>' : ''}${tag}${kick}</li>`;
  }).join('');
  $('cpuRow').classList.toggle('hidden', !Net.isHost);
  $('visRow').classList.toggle('hidden', !Net.isHost);
  renderVis();
  renderMeEdit();
  $('cpuDiff').querySelectorAll('.pill').forEach((b) => b.classList.toggle('on', b.dataset.v === cpuDiff));
  $('addCpu').disabled = players.size >= CONFIG.tag.maxPlayers;
}

// ---------- image skins (developer mode only) ----------
// A picture you pick is shrunk to a small JPEG and sent straight to the other players (through the
// host) - never to the account server, never saved: it's gone when you refresh.
let mySkinImg = null;
const pendingSkins = {};
const myImg = () => (devOn() ? mySkinImg : null);
const cleanImg = (img) => (typeof img === 'string' && img.length < 80000 && /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(img) ? img : null);
// host: someone set (or cleared) their image skin. Only the developer account may have one.
function hostSetSkin(id, img) {
  const p = players.get(id);
  if (!p || p.cpu) return;
  p.skinWant = cleanImg(img);
  const ok = id === myId ? devOn() : !!(p.acct && p.acct.dev);
  const skin = ok ? p.skinWant : null;
  if (skin === (p.skin || null)) return;
  p.skin = skin;
  Net.broadcast({ t: 'skin', id, img: skin });
}
function sendSkin() {
  if (!inGame) return;
  if (Net.isHost) hostSetSkin(myId, myImg()); else Net.send({ t: 'skin', img: myImg() });
}
// crop the picture to the block's shape (from the middle) and shrink it
function pickSkin(file) {
  if (!file) return;
  const url = URL.createObjectURL(file), img = new Image();
  img.onload = () => {
    const W = 128, H = 244, cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const k = Math.max(W / img.width, H / img.height), w = img.width * k, h = img.height * k;
    cv.getContext('2d').drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
    URL.revokeObjectURL(url);
    mySkinImg = cv.toDataURL('image/jpeg', 0.82);
    renderCos();
    sendSkin();
  };
  img.src = url;
}
$('skinFile').addEventListener('change', (e) => { pickSkin(e.target.files[0]); e.target.value = ''; });
$('skinClear').onclick = () => { mySkinImg = null; renderCos(); sendSkin(); };

// ---------- you: colors + cosmetics, also mid-game (pause menu -> You) ----------
// every color by rarity: the ones you own you can click, the rest are locked "?" tiles
function paletteHTML(part) {
  if (!Account.me) return `<div class="pal-msg">Guests are always blue. ${inGame ? 'Make an account from the main menu' : '<a data-go="account">Create an account</a>'} to get your own colors.</div>`;
  const own = new Set(ownedColors()), cur = part === 'eye' ? settings.eye : settings.color, other = devOn() ? null : part === 'eye' ? settings.color : settings.eye;
  return ITEMS.TIERS.map((t) => {
    const list = ITEMS.COLORS.filter((c) => c.tier === t.id);
    return `<div class="tier-row" style="--tc:${t.color}">${t.name}</div>` + list.map((c) => (own.has(c.hex)
      ? `<button type="button" class="sw t-${t.id}${c.hex === cur ? ' on' : ''}${c.hex === other ? ' taken' : ''}" data-c="${c.hex}" style="background:${c.hex}" title="${c.name}${c.hex === other ? ` (your ${part === 'eye' ? 'body' : 'eyes'} - click to swap)` : ''}"></button>`
      : `<button type="button" class="sw locked" style="--tc:${t.color}" title="${t.name} - win games to unlock"></button>`)).join('');
  }).join('');
}
// a color's name (and rarity) for labels
function colorName(hex) {
  const it = ITEMS.colorByHex[hex];
  return it ? it.name : hex === GUEST.body ? 'Guest Blue' : hex === GUEST.eye ? 'Ink' : '';
}
// hovering a swatch in any color grid: a little popup above the mouse with its name + rarity
const swTip = document.createElement('div');
swTip.className = 'sw-tip hidden';
document.body.appendChild(swTip);
addEventListener('mousemove', (e) => {
  const b = e.target.closest && e.target.closest('.palette .sw');
  if (!b) { swTip.classList.add('hidden'); return; }
  const it = ITEMS.colorByHex[b.dataset.c], t = it && ITEMS.tier(it.tier);
  swTip.innerHTML = it ? `<b>${esc(it.name)}</b><span style="--tc:${t.color}">${t.name}</span>` : '<b>???</b><span>Locked</span>';
  swTip.style.left = `${e.clientX}px`;
  swTip.style.top = `${e.clientY - 14}px`;
  swTip.classList.remove('hidden');
});
function renderMeEdit() {
  $('pNameText').textContent = myName();
  $('youSub').textContent = Account.me ? '' : 'Guests are always blue. Make an account from the main menu to get your own name and colors.';
  $('pBody').innerHTML = paletteHTML('body');
  $('pEye').innerHTML = paletteHTML('eye');
}
function sendMe() {
  if (!inGame) return;
  const m = { t: 'upd', name: myName(), color: settings.color, eye: settings.eye, cos: myCos(), ticket: Account.me ? Account.me.ticket : null };
  if (Net.isHost) hostUpdatePlayer(myId, m); else Net.send(m);
}
// pick a color. Picking the color your other half has swaps body and eyes (they can't match)
function pickSwatch(e, part) {
  const b = e.target.closest('.sw');
  if (e.target.dataset.go) showView($('menu'), e.target.dataset.go);
  if (!b || b.disabled || b.classList.contains('locked')) return false;
  if (b.classList.contains('taken')) setColors(settings.eye, settings.color);
  else if (part === 'eye') setColors(null, b.dataset.c); else setColors(b.dataset.c, null);
  renderMeEdit();
  sendMe();
  return true;
}
$('pBody').onclick = (e) => pickSwatch(e, 'body');
$('pEye').onclick = (e) => pickSwatch(e, 'eye');

// ---------- CPU players (host) ----------
let cpuDiff = 'medium', cpuN = 0;
const CPU_NAMES = ['Pip', 'Nib', 'Zed', 'Moss', 'Kit', 'Dot', 'Rue', 'Bix', 'Tam', 'Fen', 'Jot', 'Lux', 'Vim', 'Oz'];
function addBot(diff) {
  if (!Net.isHost || players.size >= CONFIG.tag.maxPlayers) return;
  const id = `cpu-${++cpuN}`;
  const name = uniqueName(CPU_NAMES[(cpuN - 1) % CPU_NAMES.length]);
  const p = ensurePlayer(id, name, COLORS[Math.floor(Math.random() * COLORS.length)], '#ffffff', null);
  p.cpu = diff;
  if (!bots.size || Nav.mapId !== World.map.id) Nav.build();
  bots.set(id, new Bot(id, diff));
  game.scores[id] = { tags: 0 };
  if (isPlaying() && game.mode === 'koth') game.koth.pts[id] = 0;
  hostFeed(`${name} (CPU, ${diff}) joined`);
  teleportPlayer(id, randomSpawn());
  pushState();
  autoMode();
}
function removeBot(id) {
  if (!bots.has(id)) return;
  bots.delete(id);
  hostOnLeave(id);
}
$('cpuDiff').onclick = (e) => { const b = e.target.closest('.pill'); if (b) { cpuDiff = b.dataset.v; updatePauseUI(); } };
$('addCpu').onclick = () => addBot(cpuDiff);
$('playerList').addEventListener('click', (e) => { const b = e.target.closest('.cpu-x'); if (b) removeBot(b.dataset.id); });

// what each CPU wants right now
const botLast = new Map();
function botGoal(b) {
  const id = b.id;
  const others = [...players.values()].filter((q) => q.id !== id);
  const posOfP = (q) => (q.id === myId ? me.pos : q.tp);
  const velOf = (q) => { const l = botLast.get(q.id); return l ? l.v : null; };
  const nearest = (list) => {
    let best = null, bd = Infinity;
    for (const q of list) { const d = wrapDist(posOfP(q), b.p.pos); if (d < bd) { bd = d; best = q; } }
    return best;
  };
  if (!isPlaying()) return { type: 'wander' };
  if (game.mode === 'bomb' && game.bomb) {
    if (isOut(id)) return { type: 'wander' };
    if (isIt(id)) {
      const t = nearest(others.filter((q) => !isOut(q.id)));
      return t ? { type: 'chase', pos: posOfP(t), vel: velOf(t) } : { type: 'wander' };
    }
    const h = others.find((q) => isIt(q.id));
    return h ? { type: 'flee', from: [posOfP(h)] } : { type: 'wander' };
  }
  if (game.mode === 'duel' && game.duel) {
    if (!inDuel(id)) return { type: 'wander' };
    const o = players.get(game.duel.ids.find((x) => x !== id));
    if (!o) return { type: 'idle' };
    return isIt(id) ? { type: 'chase', pos: posOfP(o), vel: velOf(o) } : { type: 'flee', from: [posOfP(o)] };
  }
  if (game.mode === 'freeze' && game.freeze) {
    if (isFrozen(id)) return { type: 'idle' };
    if (isIt(id)) {
      const t = nearest(others.filter((q) => !isIt(q.id) && !isFrozen(q.id)));
      return t ? { type: 'chase', pos: posOfP(t), vel: velOf(t) } : { type: 'wander' };
    }
    const seekers = others.filter((q) => isIt(q.id)), close = seekers.filter((q) => wrapDist(posOfP(q), b.p.pos) < 11);
    const ice = nearest(others.filter((q) => isFrozen(q.id)));
    if (ice && !close.length) return { type: 'chase', pos: posOfP(ice) };   // go thaw a teammate
    return seekers.length ? { type: 'flee', from: seekers.map(posOfP) } : { type: 'wander' };
  }
  if (game.mode === 'koth' && game.koth) {
    if (isIt(id)) {
      const near = others.map(posOfP).sort((a, c) => wrapDist(a, b.p.pos) - wrapDist(c, b.p.pos)).slice(0, 2);
      return near.length ? { type: 'flee', from: near } : { type: 'wander' };
    }
    if (game.koth.loose) { const c = crownSpot(); return { type: 'go', pos: { x: c[0], y: c[1], z: c[2] } }; }
    const k = others.find((q) => isIt(q.id));
    return k ? { type: 'chase', pos: posOfP(k), vel: velOf(k) } : { type: 'wander' };
  }
  return { type: 'wander' };
}
// before the physics steps: decide, plan and press keys
function botsThink(dt) {
  for (const q of players.values()) {
    const p = q.id === myId ? me.pos : q.tp, l = botLast.get(q.id);
    if (l) { l.v = { x: (p.x - l.x) / Math.max(dt, 1e-3), z: (p.z - l.z) / Math.max(dt, 1e-3) }; l.x = p.x; l.z = p.z; }
    else botLast.set(q.id, { x: p.x, z: p.z, v: { x: 0, z: 0 } });
  }
  const T = CONFIG.tag, go = isPlaying() && game.rl <= 0;
  for (const b of bots.values()) {
    const frozen = (isPlaying() && game.rl > 0 && (inDuel(b.id) || game.mode === 'race' || (game.mode === 'freeze' && isIt(b.id)))) || isFrozen(b.id) || isRedLight() || sitsOut(b.id) || performance.now() < (b.lockUntil || 0);
    if (isFrozen(b.id)) { b.p.vel.x = 0; b.p.vel.z = 0; }
    b.p.speedMul = !go ? 1 : game.mode === 'duel' && isIt(b.id) ? T.duelChaserSpeed
      : game.mode === 'bomb' && isIt(b.id) ? T.bombSpeed : game.mode === 'koth' && !isIt(b.id) ? T.kothSpeed
      : game.mode === 'freeze' && isIt(b.id) ? T.freezeSpeed : 1;
    b.think(botGoal(b), dt);
    b.drive(dt, frozen);
  }
}
// after the physics steps: share where they are, catch falls, tag people
const botTagCd = {};
function botsAfter() {
  const now = performance.now();
  for (const b of bots.values()) {
    World.wrapPos(b.p.pos);
    if (b.p.pos.y < World.map.killY) {
      b.p.teleport(randomSpawn());
      if (isRunner(b.id) && World.map.kind !== 'race') b.lockUntil = now + CONFIG.tag.fallLock * 1000;
      hostFell(b.id);
    }
    const p = players.get(b.id);
    if (!p) continue;
    p.tp.copy(b.p.pos);
    p.yaw = b.p.yaw;
    p.pitch = 0;
    p.mode = b.p.mode();
    if (!isPlaying() || game.rl > 0) continue;
    if (game.mode === 'race') continue;
    const reach = CONFIG.tag.touchRange + (game.mode === 'duel' && isIt(b.id) ? CONFIG.tag.duelReachBonus : 0);
    for (const q of players.values()) {
      if (q.id === b.id || !canTagPair(b.id, q.id)) continue;
      const qp = q.id === myId ? me.pos : q.tp;
      if (wrapDist(qp, b.p.pos) < reach && (botTagCd[b.id] || 0) < now) { botTagCd[b.id] = now + 250; hostTryTag(b.id, q.id); }
    }
  }
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
  { id: 'freeze', name: 'Freeze Tag', kind: 'tag', min: 2, desc: 'Seekers freeze runners by tagging them. Touch a frozen teammate to thaw them. Freeze everyone at once to win - or survive the clock.',
    opts: [{ key: 'len', label: 'Round length', vals: [[120, '2 min'], [180, '3 min'], [240, '4 min']], def: 180 }] },
  { id: 'koth', name: 'King of the Tag', kind: 'tag', min: 2, desc: 'Hold the crown to score a point every second. Run into the king to steal it. Most points wins.',
    opts: [{ key: 'len', label: 'Round length', vals: [[120, '2 min'], [180, '3 min'], [240, '4 min']], def: 180 }] },
  { id: 'race', name: 'Race', kind: 'race', min: 1, desc: 'Race to the finish. Fall off and you go back to the start - no checkpoints. CPUs sit races out.',
    opts: [{ key: 'len', label: 'Time limit', vals: [[240, '4 min'], [360, '6 min'], [480, '8 min']], def: 360 }] },
  { id: 'gp', name: 'Grand Prix', kind: 'gp', min: 2, desc: 'A run of rounds, each a random mode on a random map. Every round gives points for your placing - most points at the end wins.',
    opts: [{ key: 'rounds', label: 'Rounds', vals: [[3, '3'], [5, '5'], [7, '7']], def: 5 }] },
];
const hostSetup = { mode: players.size === 2 ? 'duel' : 'bomb', opts: {}, random: false };
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
  if (hostSetup.mode !== want && hostSetup.mode !== 'race' && hostSetup.mode !== 'gp') { hostSetup.mode = want; setupChanged(); }
}
$('modeCards').onclick = (e) => {
  const c = e.target.closest('.mode-card');
  if (!c || !canEditSetup()) return;
  modePicked = true;
  hostSetup.mode = c.dataset.id;
  // switching between racing and tag swaps to a map of the right kind
  const race = modeInfo(hostSetup.mode).kind === 'race';
  if ((World.map.kind === 'race') !== race && inGame && modeInfo(hostSetup.mode).kind !== 'gp') hostSetMap(MAPS.find((m) => (m.kind === 'race') === race).id);
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
  if (b.dataset.k === 'random') hostSetup.random = b.dataset.v === '1';
  else hostSetup.opts[hostSetup.mode][b.dataset.k] = +b.dataset.v;
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
    c.classList.toggle('bad', !!why);
  });
  const why = startProblem(mode, players.size);
  $('modeDesc').innerHTML = esc(mode.desc) + (why ? `<span class="warn">${esc(why)}</span>` : '');
  const gp = mode.kind === 'gp', maps = gp ? [] : MAPS.filter((m) => (m.kind === 'race') === race);
  const html = maps.map((m) => {
    const [a, b] = m.accent || ['#333', '#555'];
    return `<button class="map-card${m.id === game.map ? ' on' : ''}" data-id="${m.id}"${edit ? '' : ' disabled'}>
      <div class="map-thumb" style="background:linear-gradient(90deg, ${a} 0 50%, ${b} 50% 100%)"></div>
      <div class="map-body"><span class="map-name">${esc(m.name)}</span></div></button>`;
  }).join('');
  if ($('mapCards').dataset.html !== html) { $('mapCards').dataset.html = html; $('mapCards').innerHTML = html; }
  $('mapPickBlurb').textContent = gp ? 'Every round picks a random mode and a random map.' : World.map.blurb;
  const o = su.opts[mode.id] || {};
  // the randomizer is a modifier for every mode (Grand Prix too)
  const rnd = { key: 'random', label: 'Randomizer', vals: [[0, 'Off'], [1, 'On']] }, rv = su.random ? 1 : 0;
  $('modeOpts').innerHTML = mode.opts.concat([rnd]).map((op) => `<div class="pill-row"><span>${op.label}</span><div class="pills">` +
    op.vals.map(([v, l]) => `<button class="pill${(op === rnd ? rv : o[op.key]) === v ? ' on' : ''}" data-k="${op.key}" data-v="${v}"${edit ? '' : ' disabled'}>${l}</button>`).join('') +
    '</div></div>').join('');
  const desc = mode.opts.map((op) => (op.vals.find((v) => v[0] === o[op.key]) || ['', ''])[1]).concat(su.random ? ['Randomizer'] : []).join(' · ');
  $('startSummary').innerHTML = gp ? `<b>Grand Prix</b> · ${esc(desc)} rounds` : `<b>${mode.name}</b> on <b>${esc(World.map.name)}</b> · ${esc(desc)}`;
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
bindToggle('thirdPerson', 'thirdPerson');
bindToggle('devMode', 'devMode', () => onAccount());
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
  if (!(raw > 0 && raw < 0.25) || document.hidden || hasEv('pixel')) return;
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
  if (inGame && World.map.wrap) drawWrapCopies();
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
  const fallHeld = performance.now() < fallLockUntil;   // just fell off: held in place for a moment
  const red = isRedLight();
  const frozen = (playing && game.rl > 0 && (inDuel(myId) || game.mode === 'race' || (game.mode === 'freeze' && isIt(myId)))) || isFrozen(myId) || fallHeld || red;
  if ((fallHeld || red) && me.grounded) { me.vel.x = 0; me.vel.z = 0; }
  if (red !== wasRed) { wasRed = red; if (red) { flash('rgba(255,90,90,.45)'); tone(220, 160, 0.25, 'square', 0.06); } else if (hasEv('redlight')) tone(440, 660, 0.15, 'square', 0.05); }
  if (isFrozen(myId)) { me.vel.x = 0; me.vel.z = 0; }
  const duelChaser = playing && game.mode === 'duel' && isIt(myId);
  // whoever does the chasing runs a little faster
  me.speedMul = !go ? 1 : duelChaser ? T.duelChaserSpeed
    : game.mode === 'bomb' && isIt(myId) ? T.bombSpeed
    : game.mode === 'koth' && !isIt(myId) ? T.kothSpeed
    : game.mode === 'freeze' && isIt(myId) ? T.freezeSpeed : 1;
  const reachBonus = duelChaser ? T.duelReachBonus : 0;
  const inp = locked && !frozen ? readInput() : NO_INPUT;
  if (inp !== NO_INPUT) {
    if (hasEv('mirror')) inp.r = -inp.r;
    if (hasEv('backwards')) inp.f = -inp.f;
  }
  if (hasEv('tornado') && !frozen) me.yaw += dt * 1.9;
  if (frozen) me.jumpBuf = 0;

  acc += dt;
  let n = 0;
  let wt = worldTime() - acc;
  if (bots.size) botsThink(dt);
  while (acc >= STEP && n < 10) {
    wt += STEP;
    World.updateMovers(wt);
    const g0 = me.grounded, v0 = me.vel.y;
    me.step(STEP, inp);
    if (game.rnd) evPhysics(me, g0, v0, inp);
    for (const b of bots.values()) {
      const g = b.p.grounded, v = b.p.vel.y;
      b.p.step(STEP, b.inp);
      if (game.rnd) evPhysics(b.p, g, v, b.inp);
    }
    acc -= STEP;
    n++;
  }
  if (n >= 10) acc = 0;
  World.wrapPos(me.pos);   // endless maps: off one edge, in at the other
  if (bots.size) botsAfter();

  // the void. On a race course: straight back to the start. Elsewhere: a random spawn
  // (and in a duel your opponent scores, in King of the Tag you drop the crown)
  if (me.pos.y < World.map.killY) {
    const sp = randomSpawn();
    me.teleport(sp, faceCenter(sp));
    flash('rgba(0,0,0,.9)');
    SFX.fall();
    // jumping off isn't an escape: you're stuck for a moment when you come back
    if (World.map.kind !== 'race' && isRunner(myId)) fallLockUntil = performance.now() + CONFIG.tag.fallLock * 1000;
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
  if (hasEv('quake')) shake = Math.max(shake, 0.6);
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
  const back = locked && held('lookBack'), tp = settings.thirdPerson;
  arms.forEach((a) => (a.visible = !back && !tp));
  const ghostHands = isOut(myId);
  if (skinMat.transparent !== ghostHands) {
    for (const m of [skinMat, sleeveMat]) { m.transparent = ghostHands; m.opacity = ghostHands ? 0.3 : 1; m.depthWrite = !ghostHands; m.needsUpdate = true; }
  }
  camera.rotation.set(me.pitch + pitchKick + n3 * tr * 0.02, me.yaw + (back ? Math.PI : 0) + n1 * tr * 0.012, (roll + rollKick) * (back ? -1 : 1) + n2 * tr * 0.025);
  if (hasEv('woozy')) {
    const t = performance.now() / 1000;
    camera.rotation.z += Math.sin(t * 1.3) * 0.28;
    camera.rotation.x += Math.sin(t * 0.9) * 0.1;
    camera.rotation.y += Math.sin(t * 0.7) * 0.12;
  }
  if (hasEv('flip')) camera.rotation.z += Math.PI;
  if (tp) placeThirdPerson(dt); else tpDist = 0;
  updateSelfAvatar(dt, tp);
  // randomizer: lights out (only a meter or so of view, pitch black past it)
  const dark = isDark();
  if (dark !== darkOn || (dark && scene.fog !== darkFog)) setDark(dark);
  if (dark) darkFog.far = 1.6 + tpDist;
  else if (hasEv('disco')) {
    const h = (performance.now() / 1000 * 0.45) % 1;
    scene.background.setHSL(h, 0.75, 0.72);
    scene.fog.color.copy(scene.background);
    ambient.color.setHSL((h + 0.5) % 1, 0.9, 0.72);
  }

  const sp = Math.max(0, Math.min(1, (hs - M.walkSpeed) / (18 - M.walkSpeed)));
  fovPunch *= Math.exp(-5 * dt);
  const evFov = (hasEv('fisheye') ? 50 : 0) + (hasEv('woozy') ? Math.sin(performance.now() / 600) * 12 : 0);
  fovNow += (Math.min(160, settings.fov + C.speedFov * sp + fovPunch + evFov) - fovNow) * ease(10);
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
    a.root.scale.setScalar(evScale());
    a.scamp.head.scale.setScalar(hasEv('bigheads') ? 2.4 : 1);
    a.rig.rotation.x += ((p.mode === 1 ? 1.05 : 0) - a.rig.rotation.x) * k;
    a.rig.scale.y += ((p.mode === 2 ? 0.62 : 1) - a.rig.scale.y) * k;
    const it = isIt(p.id) && playing, dist = a.root.position.distanceTo(me.pos), now = performance.now() / 1000;
    // props
    a.bomb.visible = it && game.mode === 'bomb';
    if (a.bomb.visible) animateBomb(a.bomb, now, game.bomb ? game.fz / game.bomb.fuseLen : 1);
    a.crown.visible = it && game.mode === 'koth';
    a.ice.visible = isFrozen(p.id);
    // knocked out in Bomb Tag: gone - nobody else can see them at all
    a.root.visible = !isOut(p.id) && !sitsOut(p.id) && !hasEv('invisible');
    // impostors: everyone the same plain color, no cosmetics, no names
    const imp = hasEv('impostors');
    setScampGhost(a.scamp, !imp && p.cos && p.cos.ghost ? p.cos.ghostOp : 1);
    applyCos(a.scamp, imp ? null : p.cos, now);
    setScampSkin(a.scamp, imp ? null : p.skin || null);
    if (imp) a.scamp.fur.color.set(IMPOSTOR);
    a.label.material.opacity = isOut(p.id) ? 0.4 : 1;
    // see-through outline of whoever matters to you right now
    let xr = null;
    if (playing && game.rl <= 0) {
      if (game.mode === 'duel' && isIt(myId) && inDuel(p.id)) xr = '#b6f27a';
      else if (game.mode === 'koth' && it && !isIt(myId)) xr = '#ffd166';
      else if (game.mode === 'bomb' && !isOut(myId) && !isOut(p.id) && dist < 30) xr = it ? '#ff7b7b' : isIt(myId) ? '#ffffff' : null;
      else if (game.mode === 'freeze' && !isIt(myId) && isFrozen(p.id)) xr = '#7fe3ff';   // frozen teammates to rescue
      if (isExposed(p.id) && canTagPair(myId, p.id)) xr = '#ff7b7b';   // they fell: you can see them anywhere
    }
    if (hasEv('xray') && playing && !xr) xr = '#ffffff';
    if (dark) xr = null;   // lights out: no outlines, no markers, no names
    a.label.visible = !dark && !imp;
    setScampXray(a.scamp, xr);
    a.marker.visible = !!xr && (game.mode !== 'bomb' || it || isExposed(p.id));
    if (a.marker.visible) { a.marker.material.color.set(xr); a.marker.scale.set(0.45, 0.45, 1).multiplyScalar(0.8 + Math.min(1.6, dist / 18)); }
    a.bodyMat.emissive.setHex(it && game.mode === 'bomb' ? 0x3a0806 : 0x000000);
    // how close is the danger (for the red vignette)
    if (go && !isOut(myId) && (canTagPair(myId, p.id) || canTagPair(p.id, myId))) oppDist = Math.min(oppDist, dist);
    if (go && !isOut(myId) && ((game.mode === 'bomb' && it && !isIt(myId)) || (game.mode === 'duel' && it && !isIt(myId) && inDuel(myId))
      || (game.mode === 'koth' && isIt(myId)))) nearestSeeker = Math.min(nearestSeeker, dist);
    // blob shadow on whatever is under them, fading as they get higher
    const rp = a.root.position, fy = World.floorBelow(rp.x, rp.y + 0.3, rp.z), up = rp.y - fy;
    a.blob.visible = fy > -1e8 && up < 6 && !isOut(p.id) && !sitsOut(p.id);   // invisible players still cast a shadow
    if (a.blob.visible) {
      a.blob.position.set(rp.x, fy + 0.02, rp.z);
      a.blob.scale.setScalar((1 + up * 0.12) * evScale());
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
  vmBomb.visible = holding && !settings.thirdPerson;
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
  if (dark) $('pointer').style.display = 'none';
  sbTimer += dt;
  if (sbTimer > 0.25 || boardDirty) { sbTimer = 0; boardDirty = false; renderBoard(); }
}
// ---------- prize crate: it shakes, pops open, and a reel of items spins and slows down on your prize ----------
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const TIER_TOTAL = ITEMS.TIERS.reduce((n, t) => n + t.weight, 0);
const tierChance = (t) => { const p = t.weight / TIER_TOTAL * 100; return p >= 10 ? Math.round(p) : +p.toFixed(1); };
let crateBusy = false;
// starter = one of a new account's two welcome crates (title shows which one).
// preview = the developer panel's test run: plays everything, but nothing is won or saved
async function openCrate(match, starter, preview) {
  if (crateBusy) return;
  crateBusy = true;
  try {
    const toOpen = starter && Account.me ? Account.me.inv.starter : 2;
    const id = preview ? preview : starter ? await Account.openStarter() : await Account.claim(match), prize = id && ITEMS.byId[id];
    if (!prize) return;
    const box = $('prize'), crate = $('crate'), wrap = $('reelWrap'), reel = $('reel'), reveal = $('reveal'), fl = $('prizeFlash');
    const tierOf = (it) => ITEMS.tier(it.tier), t = tierOf(prize), rank = ITEMS.TIERS.indexOf(t);
    const flash = (c) => { fl.style.setProperty('--fc', c); fl.classList.remove('go'); void fl.offsetWidth; fl.classList.add('go'); };
    $('prizeTitle').textContent = preview ? 'PREVIEW CRATE' : starter ? `WELCOME CRATE ${3 - toOpen} OF 2` : 'YOU WON A CRATE';
    box.className = 'prize';
    crate.className = 'crate';
    crate.style.display = '';
    wrap.classList.add('hidden');
    reveal.classList.add('hidden');
    const sparks = (n, colors, spread) => {
      const r0 = crate.getBoundingClientRect(), cx = r0.left + r0.width / 2, cy = r0.top + r0.height / 2;
      for (let i = 0; i < n; i++) {
        const c = document.createElement('i'), a = Math.random() * Math.PI * 2, r = spread * (0.4 + Math.random() * 0.8);
        c.className = 'spark';
        c.style.left = `${cx}px`;
        c.style.top = `${cy}px`;
        c.style.setProperty('--dx', `${Math.cos(a) * r}px`);
        c.style.setProperty('--dy', `${Math.sin(a) * r}px`);
        c.style.background = colors[i % colors.length];
        c.style.animationDuration = `${0.5 + Math.random() * 0.6}s`;
        document.body.appendChild(c);
        setTimeout(() => c.remove(), 1300);
      }
    };
    // 1. the crate drops in turning and lands with a thud and a puff of dust
    $('crateHint').textContent = '';
    await wait(620);
    crate.classList.add('landed');
    tone(110, 50, 0.18, 'sine', 0.12);
    await wait(250);
    // 2. it waits for you: click it (or press Enter) - or it opens by itself after a few seconds
    $('crateHint').textContent = locked ? 'PRESS ENTER TO OPEN' : 'CLICK TO OPEN';
    crate.classList.add('ready');
    await new Promise((go) => {
      const done = () => { clearTimeout(tm); removeEventListener('keydown', key, true); crate.onclick = null; go(); };
      const key = (e) => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); done(); } };
      const tm = setTimeout(done, 5000);
      addEventListener('keydown', key, true);
      crate.onclick = done;
    });
    $('crateHint').textContent = '';
    crate.classList.remove('ready');
    // 3. it charges up: rattles, swells toward you, spins faster, light pours out of the cracks
    crate.classList.add('shake');
    for (let i = 0; i < 14; i++) tone(150 + i * 28, 110 + i * 28, 0.06, 'square', 0.025 + i * 0.004, i * 0.09);
    for (let i = 0; i < 3; i++) setTimeout(() => sparks(6, ['#ffd166', '#fff'], 90), 300 + i * 320);
    await wait(800);
    crate.classList.add('hard');
    await wait(500);
    // 4. a split-second freeze on a white flash... then it blows apart: every side flies outward,
    // a pillar of light, sparks everywhere
    crate.classList.add('freeze');
    flash('#ffffff');
    tone(1800, 1800, 0.12, 'sine', 0.05);
    await wait(170);
    crate.classList.remove('shake', 'hard', 'freeze');
    crate.classList.add('open');
    sparks(40, ['#ffd166', '#ffffff', '#ffb347'], 260);
    tone(90, 40, 0.5, 'sawtooth', 0.07);
    tone(300, 1400, 0.35, 'triangle', 0.09);
    await wait(650);
    crate.style.display = 'none';
    // 3. the line: a flat strip of colors - common ones wide, rare ones thin - races past the marker
    // and slows to a stop on the prize. The marker and the glow take the rarity of what's under it.
    // every slot the same size. Rarities are spread out (never three of one in a row), and the
    // slots right next to the prize are often rare ones - so it creeps past a near miss
    const SW = 96, N = 70, WIN = 60, items = [];
    const ranks = ITEMS.TIERS.map((x) => x.id), rankOf = (it) => ranks.indexOf(it.tier);
    const ofTier = (tid) => { const l = ITEMS.COLORS.filter((c) => c.tier === tid); return l[Math.floor(Math.random() * l.length)]; };
    for (let i = 0; i < N; i++) {
      if (i === WIN) { items.push(prize); continue; }
      let it = ITEMS.roll([], Math.random);
      for (let tries = 0; tries < 6 && i > 1 && items[i - 1].tier === it.tier && items[i - 2].tier === it.tier; tries++) it = ITEMS.roll([], Math.random);
      items.push(it);
    }
    const tease = (minRank) => ofTier(ranks[Math.min(5, minRank + Math.floor(Math.random() * (6 - minRank)))]);
    if (Math.random() < 0.75) items[WIN + 1] = tease(Math.max(3, rankOf(prize) + 1));   // just past the prize: something better
    if (Math.random() < 0.5) items[WIN - 1] = tease(Math.max(2, rankOf(prize)));
    // staged moments, just for drama (the prize itself was already decided by the server). At most
    // one per crate, each only now and then:
    //   myth     a mythic sliver right next to your prize: it creeps just past it, or stops just short
    //   legend   the same with a legendary
    //   fakeout  a legendary right before yours, and it stops just barely past it
    //   stairs   the rarities climb right before yours: uncommon, rare, epic, legendary
    // (the developer panel can force one for previews)
    const roll = Math.random(), pr = rankOf(prize), forced = preview && $('devTrick').value;
    let stage = prize.tier === 'mythic' ? 'none' : roll < 0.04 ? 'myth' : roll < 0.09 ? 'legend' : roll < 0.14 ? 'fakeout' : roll < 0.18 ? 'stairs' : 'none';
    if (forced && forced !== 'random') stage = prize.tier === 'mythic' ? 'none' : forced;
    if (pr >= 4 && (stage === 'legend' || stage === 'stairs' || stage === 'fakeout')) stage = 'myth';
    const keep = new Set([WIN]), put = (i, tier) => { items[i] = ofTier(tier); keep.add(i); };
    const side = Math.random() < 0.5 ? -1 : 1;
    if (stage === 'myth') put(WIN + side, 'mythic');
    if (stage === 'legend') put(WIN + side, 'legendary');
    if (stage === 'fakeout') put(WIN - 1, 'legendary');
    if (stage === 'stairs') ['uncommon', 'rare', 'epic', 'legendary'].forEach((tid, k) => put(WIN - 4 + k, tid));
    const myth = stage === 'myth' || stage === 'legend' ? side : 0;   // which side the near miss is on
    // no two of the same rarity next to each other anywhere on the line (staged slots stay put)
    for (let i = 0; i < N; i++) {
      if (keep.has(i)) continue;
      const bad = (it) => (i > 0 && items[i - 1].tier === it.tier) || (i < N - 1 && items[i + 1].tier === it.tier);
      for (let tries = 0; tries < 40 && bad(items[i]); tries++) items[i] = ITEMS.roll([], Math.random);
      if (bad(items[i])) items[i] = ofTier(ranks.find((r) => (i === 0 || items[i - 1].tier !== r) && (i === N - 1 || items[i + 1].tier !== r)));
    }
    // every rarity the same size - except mythic, a thin sliver
    const wOf = (it) => (it.tier === 'mythic' ? 12 : SW);
    reel.innerHTML = items.map((it) => `<i style="width:${wOf(it)}px;background:${tierOf(it).color}"></i>`).join('');
    const left = [0];
    for (let i = 0; i < N; i++) left.push(left[i] + wOf(items[i]));
    reel.style.transform = 'translateX(0)';
    reel.style.filter = '';
    $('reelInfo').innerHTML = '';
    wrap.classList.remove('hidden');
    wrap.classList.remove('tense');
    const half = wrap.clientWidth / 2;
    // stop just over the edge into the prize, or just short of the next slot - never comfortably in the middle
    const frac = Math.random() < 0.5 ? 0.06 + Math.random() * 0.14 : 0.8 + Math.random() * 0.14;
    const into = prize.tier === 'mythic' ? 0.3 + Math.random() * 0.4 : myth < 0 ? 0.02 + Math.random() * 0.04 : myth > 0 ? 0.94 + Math.random() * 0.04 : frac;
    const fin = stage === 'fakeout' ? 0.03 + Math.random() * 0.05 : into;
    const end = left[WIN] + wOf(prize) * fin - half;
    // the path the line takes is always the same: fast at first, then a long, slow crawl. The
    // tricks above only arrange the slots and where it stops - never how it moves
    const OUT = (u) => 1 - Math.pow(1 - u, 5);
    const keys = [[0, 0], [1, end, OUT]], T = 8200;
    const pathX = (k) => {
      for (let i = 1; i < keys.length; i++) if (k <= keys[i][0]) { const [k0, x0] = keys[i - 1], [k1, x1, e] = keys[i]; return x0 + (x1 - x0) * e((k - k0) / (k1 - k0)); }
      return end;
    };
    const t0 = performance.now();
    let last = -1, tense = false;
    await new Promise((done) => {
      const f = (now) => {
        const k = Math.min(1, (now - t0) / T), raw = pathX(k);
        // like a prize wheel: as it slows, it catches against each edge (a peg) and then clicks
        // over it - inside a slot it eases up to the edge, and jumps on just after crossing it
        let slot = 0;
        while (slot < N - 1 && left[slot + 1] <= raw + half) slot++;
        const sw = left[slot + 1] - left[slot], fr = Math.max(0, Math.min(1, (raw + half - left[slot]) / sw));
        const peg = Math.max(0, Math.min(1, (k - 0.5) / 0.3));
        const x = left[slot] + sw * (fr + ((1 - (1 - fr) * (1 - fr)) - fr) * peg) - half;
        reel.style.transform = `translateX(${-x}px)`;
        if (!tense && k > 0.72) {   // the last stretch: the marker pulses, a low tone climbs
          tense = true;
          wrap.classList.add('tense');
          tone(70, 140, 2.2, 'sawtooth', 0.035);
        }
        let at = last < 0 ? 0 : last;
        while (at < N - 1 && left[at + 1] <= x + half) at++;
        while (at > 0 && left[at] > x + half) at--;   // (it can slide back)
        if (at !== last) {
          last = at;
          // the click of the peg: sharper and louder the slower it goes
          tone(900 + 600 * k, 300, k > 0.72 ? 0.045 : 0.025, 'square', k > 0.72 ? 0.06 : 0.025);
          const tt = tierOf(items[at]);
          $('reelInfo').innerHTML = `<b style="--tc:${tt.color}">${tt.name}</b> ${tierChance(tt)}% chance`;
        }
        if (k < 1) requestAnimationFrame(f); else done();
      };
      requestAnimationFrame(f);
    });
    wrap.classList.remove('tense');
    reel.style.filter = '';
    await wait(350);
    // 4. the reveal: rays, a flash and a big card - bigger and louder the rarer it is
    reel.children[WIN].classList.add('win');
    flash(t.id === 'mythic' ? '#000000' : t.color);
    reveal.className = `reveal ${t.id}`;
    box.classList.add('revealed');
    reveal.style.setProperty('--rc', t.id === 'mythic' ? '#ffffff' : t.color);
    $('rvSw').style.background = prize.hex;
    $('rvTier').textContent = t.name.toUpperCase();
    $('rvName').textContent = prize.name;
    if (rank >= 4) box.classList.add('quake');
    if (t.id === 'mythic') box.classList.add('mythic');
    [523, 659, 784, 1046, 1318, 1568].slice(0, 2 + rank).forEach((fq, i) => tone(fq, fq * 1.01, 0.22, 'triangle', 0.08, i * 0.09));
    if (rank >= 4) tone(110, 55, 0.6, 'sawtooth', 0.06, 0.05);
    for (let i = 0; i < 24 + rank * 22; i++) {
      const c = document.createElement('i'), a = Math.random() * Math.PI * 2, r = 160 + Math.random() * 420;
      c.className = 'confetti';
      c.style.setProperty('--dx', `calc(-50% + ${Math.cos(a) * r}px)`);
      c.style.setProperty('--dy', `calc(-50% + ${Math.sin(a) * r + 120}px)`);
      c.style.setProperty('--rot', `${Math.random() * 900 - 450}deg`);
      c.style.background = Math.random() < 0.5 ? (t.id === 'mythic' ? (Math.random() < 0.5 ? '#000' : '#fff') : t.color) : prize.hex;
      c.style.animationDuration = `${1.2 + Math.random() * 1.2}s`;
      document.body.appendChild(c);
      setTimeout(() => c.remove(), 2600);
    }
    // stays until you press OK (or Enter), or after a while on its own
    await new Promise((done) => {
      const close = () => { clearTimeout(tm); removeEventListener('keydown', key, true); $('rvOk').onclick = null; done(); };
      const key = (e) => { if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); } };
      const tm = setTimeout(close, 12000);
      addEventListener('keydown', key, true);
      $('rvOk').onclick = close;
      $('rvOk').textContent = locked ? 'OK  (Enter)' : 'OK';
    });
    box.classList.add('out');
    await wait(450);
    box.className = 'prize hidden';
  } finally { crateBusy = false; }
}

let finishSentAt = 0, boardDirty = true, beepT = 0, fallLockUntil = 0, wasRed = false;

// randomizer happenings that push bodies around (you, and the CPUs on the host), every physics step
function evPhysics(p, wasGrounded, vyBefore, inp) {
  if (hasEv('wind')) {
    const a = evAngle();
    p.vel.x += Math.cos(a) * 9 * STEP;
    p.vel.z += Math.sin(a) * 9 * STEP;
  }
  // landed hard: bounce back up (unless you hold crouch)
  if (hasEv('bouncy') && !wasGrounded && p.grounded && vyBefore < -4 && !inp.crouch) {
    p.vel.y = Math.min(-vyBefore * 0.85, 22);
    p.grounded = false;
  }
  // just jumped: shoot forward too
  if (hasEv('rocket') && wasGrounded && !p.grounded && p.vel.y > 4 && vyBefore < 1) {
    p.vel.x -= Math.sin(p.yaw) * 9;
    p.vel.z -= Math.cos(p.yaw) * 9;
  }
  // the ground jolts you now and then
  if (hasEv('quake') && p.grounded && Math.random() < STEP * 1.1) {
    p.vel.y = 3.5 + Math.random() * 3;
    p.vel.x += (Math.random() - 0.5) * 7;
    p.vel.z += (Math.random() - 0.5) * 7;
    p.grounded = false;
  }
}
// looks that switch on/off with a happening (the per-frame parts are in updateGame)
function evLook() {
  const m = World.map;
  if (!hasEv('disco') && !darkOn) {
    scene.background.set(m.sky);
    scene.fog.color.set(m.sky);
    ambient.color.set(m.hemi[0]);
  }
  const pr = hasEv('pixel') ? 0.17 : res.now;
  if (renderer.getPixelRatio() !== pr) { renderer.setPixelRatio(pr); renderer.setSize(innerWidth, innerHeight); }
}

// ---------- third person (setting) ----------
// The camera sits behind your head along your view. A ray from your head finds the nearest wall
// and the camera stops just short of it (snaps in at once, eases back out), so it never clips.
const tpBack = new THREE.Vector3(), tpPivot = new THREE.Vector3();
let tpDist = 0;
function placeThirdPerson(dt) {
  const want = 3.4 * Math.max(0.55, evScale());
  tpPivot.copy(camera.position);
  tpPivot.y += 0.3 * evScale();
  camera.updateMatrixWorld();
  camera.getWorldDirection(tpBack).negate();
  const d = Math.max(0.1, Math.min(want, camRay(tpPivot, tpBack, want + 0.35) - 0.35));
  tpDist = d < tpDist ? d : tpDist + (d - tpDist) * (1 - Math.exp(-5 * dt));
  camera.position.copy(tpPivot).addScaledVector(tpBack, tpDist);
}
// distance along the ray to the first solid thing (boxes grown by the camera's radius, and ramps)
function camRay(o, d, len) {
  const R = 0.22;
  let best = len;
  const lo = (a, b) => Math.min(a, a + b * len), hi = (a, b) => Math.max(a, a + b * len);
  const sx0 = lo(o.x, d.x), sx1 = hi(o.x, d.x), sy0 = lo(o.y, d.y), sy1 = hi(o.y, d.y), sz0 = lo(o.z, d.z), sz1 = hi(o.z, d.z);
  for (const b of World.boxes) {
    if (b.invisible || sx0 > b.max.x + R || sx1 < b.min.x - R || sy0 > b.max.y + R || sy1 < b.min.y - R || sz0 > b.max.z + R || sz1 < b.min.z - R) continue;
    let ox = o.x, oz = o.z, dx = d.x, dz = d.z, x0 = b.min.x, x1 = b.max.x, z0 = b.min.z, z1 = b.max.z;
    if (b.rot) {
      const c = Math.cos(b.rot), s = Math.sin(b.rot), px = o.x - b.cx, pz = o.z - b.cz;
      ox = px * c - pz * s; oz = px * s + pz * c;
      dx = d.x * c - d.z * s; dz = d.x * s + d.z * c;
      x0 = -b.hw; x1 = b.hw; z0 = -b.hd; z1 = b.hd;
    }
    const t = slabHit([ox, o.y, oz], [dx, d.y, dz], [x0 - R, b.min.y - R, z0 - R], [x1 + R, b.max.y + R, z1 + R]);
    if (t >= 0 && t < best) best = t;
  }
  for (let t = 0.3; t < best; t += 0.2) {
    const x = o.x + d.x * t, y = o.y + d.y * t, z = o.z + d.z * t;
    for (const r of World.ramps) {
      if (Math.abs(x - r.x) < r.w / 2 + R && Math.abs(z - r.z) < r.d / 2 + R && y > (r.base || 0) - R && y < rampHeight(r, x, z) + R) { best = t; break; }
    }
  }
  return best;
}
// ray vs box: where it enters (-1 = misses, or starts inside - then it doesn't block)
function slabHit(o, d, a, b) {
  let t0 = 0, t1 = Infinity, inside = true;
  for (let i = 0; i < 3; i++) {
    if (o[i] < a[i] || o[i] > b[i]) inside = false;
    if (Math.abs(d[i]) < 1e-9) { if (o[i] < a[i] || o[i] > b[i]) return -1; continue; }
    let ta = (a[i] - o[i]) / d[i], tb = (b[i] - o[i]) / d[i];
    if (ta > tb) [ta, tb] = [tb, ta];
    t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
    if (t0 > t1) return -1;
  }
  return inside ? -1 : t0;
}
// your own character, only drawn in third person
let selfAv = null, selfKey = '';
function updateSelfAvatar(dt, tp) {
  const wrap = !!World.map.wrap;   // endless map: your copies on the other tiles, even in first person
  if (!tp && !wrap && !selfAv) return;
  const key = settings.color + settings.eye;
  if (!selfAv || key !== selfKey) {
    if (selfAv) removeAvatar({ avatar: selfAv });
    selfAv = makeAvatar({ name: '', color: settings.color, eye: settings.eye });
    selfAv.label.visible = false;
    selfKey = key;
  }
  const a = selfAv, show = tp && tpDist > 0.75;
  a.root.visible = show;
  a.copyOnly = !show && wrap && !isOut(myId) && !hasEv('invisible');
  a.blob.visible = false;
  if (!show && !a.copyOnly) return;
  const k = 1 - Math.exp(-14 * dt), now = performance.now() / 1000, mode = me.mode(), playing = isPlaying();
  a.root.position.copy(me.pos);
  a.root.rotation.y = me.yaw;
  a.root.scale.setScalar(evScale());
  a.scamp.head.scale.setScalar(hasEv('bigheads') ? 2.4 : 1);
  animateScamp(a.scamp, dt, now, me.hspeed(), mode, !me.grounded && Math.abs(me.vel.y) > 1.5 && mode !== 1, talkT > 0);
  a.rig.rotation.x += ((mode === 1 ? 1.05 : 0) - a.rig.rotation.x) * k;
  a.rig.scale.y += ((mode === 2 ? 0.62 : 1) - a.rig.scale.y) * k;
  const imp = hasEv('impostors'), cos = imp ? null : myCos();
  setScampGhost(a.scamp, isOut(myId) ? 0.3 : cos && cos.ghost ? cos.ghostOp : 1);
  applyCos(a.scamp, cos, now);
  setScampSkin(a.scamp, imp ? null : myImg());
  if (imp) a.scamp.fur.color.set(IMPOSTOR);
  a.bomb.visible = playing && game.mode === 'bomb' && isIt(myId);
  if (a.bomb.visible) animateBomb(a.bomb, now, game.bomb ? game.fz / game.bomb.fuseLen : 1);
  a.crown.visible = playing && game.mode === 'koth' && isIt(myId);
  a.ice.visible = isFrozen(myId);
  const fy = World.floorBelow(me.pos.x, me.pos.y + 0.3, me.pos.z), up = me.pos.y - fy;
  a.blob.visible = fy > -1e8 && up < 6 && show;
  if (a.blob.visible) {
    a.blob.position.set(me.pos.x, fy + 0.02, me.pos.z);
    a.blob.scale.setScalar((1 + up * 0.12) * evScale());
    a.blob.material.opacity = 0.42 * (1 - up / 6);
  }
}

// ---------- randomizer: lights out ----------
const darkFog = new THREE.Fog(0x000000, 0.3, 1.6);
let darkOn = false;
function setDark(on) {
  darkOn = on;
  const m = World.map;
  scene.fog = on ? darkFog : m.fogDensity ? fogExp : fogLin;
  scene.background.set(on ? '#000000' : m.sky);
  if (!on) { scene.fog.color.set(m.sky); ambient.color.set(m.hemi[0]); }
  if (on) tone(160, 70, 0.12, 'square', 0.05);
  else tone(90, 220, 0.1, 'square', 0.04);
}

// ---------- endless maps: players are drawn again on every copy of the tile around you ----------
const onLayer1 = (o) => o.layers.enable(1);
function drawWrapCopies() {
  const W = World.map.wrap, list = [];
  for (const p of players.values()) if (p.avatar && p.avatar.root.visible) list.push(p.avatar);
  const selfCopy = selfAv && selfAv.copyOnly;   // first person: you're drawn on the other tiles only
  if (selfAv && (selfAv.root.visible || selfCopy)) list.push(selfAv);
  if (!list.length) return;
  if (selfCopy) selfAv.root.visible = true;
  for (const a of list) { a.root.traverse(onLayer1); a.blob.layers.enable(1); }
  const bg = scene.background;
  scene.background = null;   // a color background would wipe the frame
  camera.layers.set(1);
  renderer.autoClear = false;
  const n = World.map.wrapRings || 1, cx = camera.position.x, cz = camera.position.z;
  for (let i = -n; i <= n; i++) for (let j = -n; j <= n; j++) {
    if (!i && !j) continue;
    const dx = i * W, dz = j * W;
    if (!list.some((a) => Math.hypot(a.root.position.x + dx - cx, a.root.position.z + dz - cz) < 90)) continue;
    for (const a of list) { a.root.position.x += dx; a.root.position.z += dz; a.blob.position.x += dx; a.blob.position.z += dz; }
    renderer.render(scene, camera);
    for (const a of list) { a.root.position.x -= dx; a.root.position.z -= dz; a.blob.position.x -= dx; a.blob.position.z -= dz; }
  }
  renderer.autoClear = true;
  camera.layers.set(0);
  scene.background = bg;
  if (selfCopy) selfAv.root.visible = false;
}

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

// --- 2-player helpers: where's the other player, countdowns ---
let shake = 0, nearFlag = false, closeCallAt = 0, lastCount = 0, lastTick = 0;
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
  let target = null, label = '', color = '#b6f27a';
  if (playing && game.rl <= 0 && !isOut(myId)) {
    if (game.mode === 'duel' && inDuel(myId)) {
      const o = players.get(game.duel.ids.find((i) => i !== myId));
      if (o && o.avatar) { target = o.avatar.root.position; label = isIt(myId) ? 'RUNNER' : 'CHASER'; color = isIt(myId) ? '#b6f27a' : '#ff7b7b'; }
    } else if (game.mode === 'koth' && !isIt(myId)) {
      const k = game.it.length ? players.get(game.it[0]) : null;
      if (k && k.avatar) { target = k.avatar.root.position; label = 'KING'; color = '#ffd166'; }
      else if (game.koth && game.koth.loose) { const c = crownSpot(); projV2.set(c[0], c[1], c[2]); target = projV2; label = 'CROWN'; color = '#ffd166'; }
    } else if (game.mode === 'freeze' && !isFrozen(myId)) {
      let best = Infinity;
      for (const p of players.values()) {
        if (p.id === myId || !p.avatar || (isIt(myId) ? isIt(p.id) || isFrozen(p.id) : !isFrozen(p.id))) continue;
        const d = p.avatar.root.position.distanceTo(me.pos);
        if (d < best) { best = d; target = p.avatar.root.position; }
      }
      label = isIt(myId) ? 'NEAREST' : 'FROZEN'; color = isIt(myId) ? '#ffffff' : '#7fe3ff';
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
  }
  if (ptr.style.display !== (show ? 'block' : 'none')) ptr.style.display = show ? 'block' : 'none';

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
    } else if (mode === 'freeze' && game.freeze) {
      const r = [...players.keys()].filter((id) => !isIt(id));
      phase = `FREEZE TAG · ${r.filter((id) => game.freeze.frozen.includes(id)).length}/${r.length} FROZEN`;
      timer = game.rl > 0 ? `Seekers in ${Math.ceil(game.rl)}` : fmtTime(game.tl);
      urgent = go && game.tl <= 10;
    } else if (mode === 'koth') {
      timer = game.rl > 0 ? `Crown in ${Math.ceil(game.rl)}` : fmtTime(game.tl);
      urgent = go && game.tl <= 10;
    } else if (mode === 'race') {
      timer = game.rl > 0 ? `Start in ${Math.ceil(game.rl)}` : game.race && game.race.order.length ? `Ends in ${fmtTime(game.tl)}` : fmtTime(game.tl);
      urgent = go && game.tl <= 15;
    }
  } else if (game.phase === 'results') { phase = 'ROUND OVER'; timer = ''; }
  if (playing && game.gp) phase = `GP ${game.gp.round}/${game.gp.of} · ${phase}`;
  if (activeEvs().length) phase += ` · ${activeEvs().map((k) => RANDOM_EVENTS[k].name).join(' + ')} ${Math.ceil(game.rnd.left)}s`;
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
    else if (mode === 'freeze') { roleText = isFrozen(myId) ? 'FROZEN' : isIt(myId) ? 'SEEKER' : 'RUN'; roleCls = isFrozen(myId) ? 'out' : isIt(myId) ? 'it' : 'runner'; }
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
  if (playing && mode === 'freeze' && go && !isIt(myId)) hint = isFrozen(myId) ? 'Frozen - a teammate can thaw you by touching you' : game.freeze && game.freeze.frozen.length ? 'Touch frozen teammates to thaw them' : '';
  if (isExposed(myId)) hint = `EXPOSED - they can see you for ${((exposedUntil[myId] - now) / 1000).toFixed(1)}s`;
  if (hasEv('redlight')) hint = isRedLight() ? 'RED LIGHT - FREEZE!' : 'GREEN LIGHT - GO GO GO';
  if (now < tagHintUntil) hint = tagHint;
  if (frozen && !isFrozen(myId) && !isRedLight()) hint = mode === 'race' ? 'On your marks…' : 'Get ready…';
  // held after a fall: a bar that empties as you wait
  const held = now < fallLockUntil;
  $('fallHold').classList.toggle('hidden', !held);
  if (held) {
    if (hint === 'Get ready…') hint = '';
    $('fallBar').style.transform = `scaleX(${((fallLockUntil - now) / (CONFIG.tag.fallLock * 1000)).toFixed(3)})`;
  }
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
  if (mode === 'freeze' && game.freeze) {
    const tg = (id) => String((game.scores[id] || { tags: 0 }).tags);
    const seek = list.filter((p) => isIt(p.id)), run = list.filter((p) => !isIt(p.id));
    run.sort((a, b) => game.freeze.frozen.includes(a.id) - game.freeze.frozen.includes(b.id));
    const f = run.filter((p) => game.freeze.frozen.includes(p.id)).length;
    return { title: `FREEZE TAG · ${f}/${run.length} FROZEN`, rows: seek.map((p) => row(p, tg(p.id), 'SEEKER', 'hot'))
      .concat(run.map((p) => row(p, tg(p.id), game.freeze.frozen.includes(p.id) ? 'FROZEN' : '', game.freeze.frozen.includes(p.id) ? 'icy' : ''))) };
  }
  if (mode === 'koth' && game.koth) {
    const pts = game.koth.pts;
    list.sort((a, b) => (pts[b.id] || 0) - (pts[a.id] || 0));
    return { title: 'KING OF THE TAG', rows: list.map((p) => row(p, String(Math.floor(pts[p.id] || 0)), isIt(p.id) ? 'KING' : '', isIt(p.id) ? 'gold' : '')) };
  }
  if (mode === 'race' && game.race) {
    const r = game.race;
    const done = r.order.map((id) => players.get(id)).filter(Boolean);
    const rest = list.filter((p) => !p.cpu && r.done[p.id] === undefined).map((p) => ({ p, togo: raceToGo(p.id === myId ? me.pos : p.avatar ? p.avatar.root.position : p.tp) }))
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
// the name box shows who you are (your account name, or your guest name)
function renderName() {
  $('name').value = myName();
  $('name').classList.toggle('skel', Account.loading);
  $('nameHint').innerHTML = Account.me ? (devOn() ? 'Developer mode is on' : '') : 'Guest name. <a data-go="account">Create an account</a> to pick your own.';
}
document.addEventListener('account-loading', () => $('name').classList.toggle('skel', Account.loading));
$('nameHint').onclick = $('qMsg').onclick = (e) => { if (e.target.dataset.go) { e.preventDefault(); showView($('menu'), e.target.dataset.go); } };

// character preview + fur color on the main menu
// first time here: a random body color (eyes that stand out on it), kept from then on
fixLook();
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
      // keep the camera's shape matched to the box (it crops around the middle, never stretches)
      if (canvas.width !== Math.round(w * r.getPixelRatio()) || canvas.height !== Math.round(h * r.getPixelRatio())) { r.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); }
      t += dt;
      if (!dragging) spin += (Math.sin(t * 0.6) * 0.6 - spin) * Math.min(1, dt * 1.5);
      c.rig.rotation.y = spin;
      chat -= dt;
      if (chat < -4 - Math.random() * 3) chat = 0.9;
      animateScamp(c, dt, t, 0, 0, false, chat > 0);
      const cos = myCos();
      setScampGhost(c, cos && cos.ghost ? cos.ghostOp : 1);
      applyCos(c, cos, t);
      setScampSkin(c, myImg());
      r.render(sc, cam);
    },
  };
})();
function renderPreview(dt) { preview.render(dt); }
// body + eye colors: one split bar - left half body, right half eyes. Click a half for the color picker.
// label text flips dark/light so it's readable on any color
const inkFor = (hex) => { const c = new THREE.Color(hex); return (0.299 * c.r + 0.587 * c.g + 0.114 * c.b) > 0.6 ? '#1f2433' : '#ffffff'; };
let palFor = '';   // which half the swatch palette is open for: 'body' | 'eye' | ''
const markColors = () => {
  for (const [id, c, label] of [['bodySwatch', settings.color, 'Body'], ['eyeSwatch', settings.eye, 'Eyes']]) {
    $(id).style.background = c;
    $(id).style.color = inkFor(c);
    $(id).innerHTML = `<span>${label}</span><em class="cname">${esc(colorName(c))}</em>`;
  }
  $('bodySwatch').classList.toggle('open', palFor === 'body');
  $('eyeSwatch').classList.toggle('open', palFor === 'eye');
  const pal = $('palette');
  pal.classList.toggle('hidden', !palFor);
  pal.innerHTML = palFor ? paletteHTML(palFor) : '';
};
const setColors = (body, eye) => {
  if (body) { settings.color = body; settings.colorPicked = true; }
  if (eye) settings.eye = eye;
  saveSettings();
  preview.set();
  markColors();
};
$('bodySwatch').onclick = () => { palFor = palFor === 'body' ? '' : 'body'; markColors(); };
$('eyeSwatch').onclick = () => { palFor = palFor === 'eye' ? '' : 'eye'; markColors(); };
$('palette').onclick = (e) => pickSwatch(e, palFor);
markColors();

// the Cosmetics panel only lists what you've won (or everything in developer mode)
const COS_ITEM = { rb: 'rainbow', ghost: 'ghost', neon: 'neon', glint: 'glint' };
function renderCos() {
  $('cosPanel').classList.toggle('hidden', !Object.values(COS_ITEM).some(ownsCos));
  $('skinRow').classList.toggle('hidden', !devOn());
  $('skinClear').classList.toggle('on', !mySkinImg);
  $('cosPanel').querySelectorAll('.pills[data-k]').forEach((g) => { if (COS_ITEM[g.dataset.k]) g.closest('.cos-row').classList.toggle('hidden', !ownsCos(COS_ITEM[g.dataset.k])); });
  const c = Object.assign({}, COS_DEFAULT, settings.cos || {});
  $('cosPanel').querySelectorAll('.pills[data-k]').forEach((g) => g.querySelectorAll('.pill').forEach((b) => b.classList.toggle('on', b.dataset.v === String(c[g.dataset.k]))));
  $('ghostOp').value = Math.round(c.ghostOp * 100);
  $('ghostOpVal').textContent = `${Math.round(c.ghostOp * 100)}%`;
  $('ghostOpRow').classList.toggle('hidden', !c.ghost || !ownsCos('ghost'));
  $('rbStyleRow').classList.toggle('hidden', c.rb === 'off' || !ownsCos('rainbow'));
  $('glintColor').value = c.glintColor;
  $('glintColor').classList.toggle('hidden', !c.glint);
}
const setCos = (k, v) => { settings.cos = Object.assign({}, COS_DEFAULT, settings.cos || {}, { [k]: v }); saveSettings(); renderCos(); sendMe(); };
$('cosPanel').addEventListener('click', (e) => {
  const b = e.target.closest('.pill'), g = b && b.closest('.pills[data-k]');
  if (!g) return;
  const k = g.dataset.k, v = b.dataset.v;
  setCos(k, k === 'ghost' || k === 'neon' || k === 'glint' ? v === 'true' : v);
});
$('ghostOp').addEventListener('input', (e) => setCos('ghostOp', Math.max(0.2, +e.target.value / 100)));
$('glintColor').addEventListener('input', (e) => setCos('glintColor', e.target.value));
renderCos();

// ---------- developer debug panel (Settings, developer mode only) ----------
$('devCrate').innerHTML = ['random'].concat(ITEMS.TIERS.map((t) => t.id)).map((k) => `<button class="pill" type="button" data-t="${k}">${k === 'random' ? 'Random' : ITEMS.tier(k).name}</button>`).join('');
$('devCrate').onclick = (e) => {
  const b = e.target.closest('.pill');
  if (!b || !devOn()) return;
  const list = ITEMS.COLORS.filter((c) => b.dataset.t === 'random' || c.tier === b.dataset.t);
  const pick = b.dataset.t === 'random' ? ITEMS.roll([], Math.random) : list[Math.floor(Math.random() * list.length)];
  openCrate(null, false, pick.id);   // preview: nothing is won
};
// which happening comes first when you host with the Randomizer on (a setting, kept)
$('devEvent').innerHTML = '<option value="">Random (normal)</option>' + Object.keys(RANDOM_EVENTS).map((k) => `<option value="${k}">${RANDOM_EVENTS[k].name}</option>`).join('');
$('devEvent').value = RANDOM_EVENTS[settings.devFirstEv] ? settings.devFirstEv : '';
$('devEvent').onchange = () => { settings.devFirstEv = $('devEvent').value; saveSettings(); };
const devFirst = () => (devOn() && RANDOM_EVENTS[settings.devFirstEv] ? settings.devFirstEv : null);
const renderDev = () => $('devPanel').classList.toggle('hidden', !devOn());

// a new account opens its two welcome crates, one after the other
let starterRunning = false;
async function openStarters() {
  if (starterRunning) return;
  starterRunning = true;
  try {
    while (Account.me && Account.me.inv.starter > 0) {
      while (crateBusy) await wait(500);
      const before = Account.me.inv.starter;
      await openCrate(null, true);
      if (!Account.me || Account.me.inv.starter >= before) break;   // couldn't open (offline): try again next time
      await wait(600);
    }
  } finally { starterRunning = false; }
}
// your account loaded / changed (logged in or out, won something, developer mode)
function onAccount() {
  if (Account.me && Account.me.inv.starter > 0) setTimeout(openStarters, 400);
  fixLook();
  saveSettings();
  preview.set();
  markColors();
  renderCos();
  renderName();
  renderMeEdit();
  $('devModeRow').classList.toggle('hidden', !(Account.me && Account.me.dev));
  renderDev();
  sendMe();
  sendSkin();
}
Account.onChange(onAccount);
renderName();
renderDev();
if (Account.me && Account.me.inv.starter > 0) setTimeout(openStarters, 1500);
$('devModeRow').classList.toggle('hidden', !(Account.me && Account.me.dev));

function getName() { return myName(); }
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

// Host game -> pick Public or Private (fixed for that lobby), then host
$('hostBtn').onclick = () => { $('hostBtn').classList.add('hidden'); $('hostChoice').classList.remove('hidden'); };
$('hostChoice').onclick = (e) => {
  const b = e.target.closest('[data-v]');
  if (!b) return;
  lobbyPublic = b.dataset.v === 'public';
  $('hostChoice').classList.add('hidden');
  $('hostBtn').classList.remove('hidden');
  hostGame();
};
function hostGame() {
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
    sendSkin();
    lobbyBeat();
  });
}

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
    Net.send({ t: 'hello', v: CONFIG.version, name, color: settings.color, eye: settings.eye, cos: myCos(), ticket: Account.me ? Account.me.ticket : null });
    if (myImg()) Net.send({ t: 'skin', img: myImg() });
  });
}
$('joinBtn').onclick = join;

// ---------- public / private lobbies ----------
// A public game checks in with the server every 30s (host, mode, map, players) and shows up on
// everyone's "Public games" list; it drops off about a minute after it stops. Private games are
// only joinable with the code, like before.
const lobbyKey = [...crypto.getRandomValues(new Uint8Array(12))].map((x) => x.toString(16).padStart(2, '0')).join('');
let listedCode = '', lobbyPublic = false;   // picked when you host; can't change after
function renderVis() {
  $('visRow').innerHTML = lobbyPublic ? '<span class="vis-tag pub">Public lobby</span> anyone can find it' : '<span class="vis-tag">Private lobby</span> join with the code';
}
function lobbyBeat() {
  const listed = inGame && Net.isHost && lobbyPublic && Net.code;
  if (!listed) { if (listedCode) { Account.lobbyDown(listedCode, lobbyKey); listedCode = ''; } return; }
  listedCode = Net.code;
  Account.lobbyUp({ code: Net.code, key: lobbyKey, host: myName(), mode: modeInfo(isPlaying() ? game.mode : getSetup().mode).name, map: World.map.name,
    n: [...players.values()].filter((p) => !p.cpu).length, playing: isPlaying() });
}
setInterval(lobbyBeat, 30000);
addEventListener('pagehide', () => { if (listedCode) Account.lobbyDown(listedCode, lobbyKey, true); });
renderVis();
// the list on the Play page: refreshed every 20s while you're looking at it
async function loadPublic() {
  const ul = $('pubList');
  if (!ul.children.length) ul.innerHTML = '<li class="pub-empty skel">loading games</li>';
  const list = await Account.lobbies();
  if (list === null) { ul.innerHTML = '<li class="pub-empty">Couldn\'t load the list.</li>'; return; }
  ul.innerHTML = list.length ? list.map((l) => `<li><span class="pub-who"><b>${esc(l.host)}</b>'s game</span><span class="pub-what">${esc(l.mode)} · ${esc(l.map)}${l.playing ? ' · playing' : ''}</span><span class="pub-n">${l.n}/${l.max}</span><button class="pill" type="button" data-code="${esc(l.code)}">Join</button></li>`).join('')
    : '<li class="pub-empty">No public games right now. Host one!</li>';
}
$('pubList').onclick = (e) => {
  const b = e.target.closest('[data-code]');
  if (!b) return;
  fillCode(b.dataset.code);
  join();
};
$('pubRefresh').onclick = loadPublic;
setInterval(() => { if (!inGame && document.visibilityState === 'visible' && !$('menu').classList.contains('hidden')) loadPublic(); }, 20000);
setTimeout(loadPublic, 600);
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
if (/[?&]debug\b/.test(location.search)) window.__dbg = { game, H, me, players, hostSetup, setupChanged, hostStartRound, CONFIG, World, raceToGo, settings, addBot, pushState, hostEndRound, bots, camera, scene, openCrate };

requestAnimationFrame(frame);
})();
