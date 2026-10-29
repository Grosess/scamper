// ============================================================
//  SCAMPER - tuning
//  Change numbers here to change how the game feels.
//  Units are meters and seconds.
// ============================================================
const CONFIG = {
  version: 6,   // bump when a change makes old and new players unable to play together
  move: {
    walkSpeed: 6,
    runSpeed: 10,          // hold Shift (no stamina, run forever)
    crouchSpeed: 3.5,
    groundAccel: 14,       // higher = snappier starts/stops
    groundFriction: 10,
    overspeedDecay: 1.8,   // how fast extra speed (from slides/kicks) fades on the ground
    coastDecay: 3.5,       // let go of the keys at high speed: how fast you coast down to running speed
    speedTurn: 5,          // how sharply you can turn on the ground while above running speed
    airAccel: 20,          // extra air acceleration when you're slow
    airTurn: 3.4,          // how fast (radians/sec) you can swing your momentum in the air
    airBrake: 9,           // speed lost per second when holding back in the air
    gravity: 26,
    maxFall: 45,
    jumpSpeed: 9,
    coyoteTime: 0.1,       // can still jump this long after running off a ledge
    jumpBuffer: 0.14,      // pressing jump slightly before landing still counts
    stepHeight: 0.45,      // auto step-up onto small ledges

    slideMinSpeed: 6.5,    // need at least this speed to start a slide
    slideBoost: 4.5,       // speed added when a slide starts
    slideBoostCooldown: 0.9,
    slideBoostCap: 13,     // no slide boost above this speed (stops slide-hop speed stacking)
    slideFriction: 5,      // speed lost per second while sliding on flat ground
    slideTurn: 2.6,        // how fast you can steer a slide (radians/sec)
    slideStopSpeed: 4,
    slopeSlideAccel: 1.0,  // how hard ramps pull you downhill while sliding
    maxSpeed: 24,

    wallKickUp: 8.8,
    wallKickOut: 6.5,      // push away from the wall
    wallKickForward: 7.5,  // push toward where you're looking
    wallKickKeep: 0.35,    // how much sideways speed you keep through a kick
    wallKickCooldown: 0.15,
    wallDetect: 0.4,       // how close a wall must be to kick it
    wallHangTime: 0.28,    // tiny hang when you hit a wall in the air
    wallHangGravity: 0.12,

    mantleMaxHeight: 1.8,  // pull yourself up ledges up to this height above your feet

    radius: 0.35,
    standHeight: 1.8,
    crouchHeight: 0.95,
    eyeFromTop: 0.14,
  },

  camera: {
    fov: 90,
    speedFov: 14,          // extra FOV at high speed
    bob: 0.06,
    slideRoll: 0.06,
    shake: 1.0,            // camera shake strength (0 = off)
    wallRoll: 0.09,
  },

  tag: {
    touchRange: 1.3,       // run into someone to tag them (contact only)
    lagSlack: 1.8,         // host accepts tags this much farther apart, for lag (same for everyone)
    bombSpeed: 1.1,        // Bomb Tag: whoever holds the bomb runs this much faster
    bombPassDelay: 0.6,    // ...and can't pass it on for this long after getting it
    noPassBack: 1.0,       // seconds before you can pass the bomb straight back
    kothSpeed: 1.06,       // King of the Tag: everyone chasing the king runs this much faster
    crownProtect: 2.0,     // the new king can't be robbed for this long
    duelRelease: 3,        // both duelists are frozen this long before each chase
    duelChaserSpeed: 1.12, // the duel chaser runs this much faster...
    duelReachBonus: 0.4,   // ...and tags from this much farther away
    duelSpawnSpread: 0.6,  // 0 = chase starts close, 1 = as far apart as the map allows
    raceAfterFirst: 60,    // Race: after the first finish, everyone else has this long
    resultsTime: 9,
    maxPlayers: 12,
  },

  // Key codes: https://developer.mozilla.org/docs/Web/API/KeyboardEvent/code
  keys: {
    forward: ['KeyW', 'ArrowUp'],
    back: ['KeyS', 'ArrowDown'],
    left: ['KeyA', 'ArrowLeft'],
    right: ['KeyD', 'ArrowRight'],
    jump: ['Space'],
    run: ['ShiftLeft', 'ShiftRight'],
    slide: ['KeyC', 'Mouse2'],      // Mouse2 = right mouse button
    scoreboard: ['Tab'],
    pause: ['KeyP'],        // Esc always pauses too
    lookBack: ['KeyR'],     // hold to look behind you
    taunt: ['KeyF'],
  },

  net: {
    prefix: 'scamper-v1-',  // lobby namespace. Changing it splits players into separate "universes" - leave it
    sendRate: 20,
    // To use your own PeerJS server instead of the free public one, fill this in:
    // peerServer: { host: 'your-server.com', port: 443, path: '/', secure: true },
    peerServer: null,
    // How browsers find a route to each other (STUN works on most home networks).
    iceServers: [
      { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'] },
      { urls: 'stun:stun.cloudflare.com:3478' },
    ],
    // A TURN relay passes traffic along when two networks can't connect directly (common on
    // phones, school and work wifi). There's no reliable free public one any more - make a free
    // account at a TURN provider (e.g. metered.ca) and paste its details here, e.g.:
    // turn: { urls: ['turn:global.relay.metered.ca:80', 'turn:global.relay.metered.ca:443?transport=tcp'], username: '...', credential: '...' },
    turn: null,
  },
};
