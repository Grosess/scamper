// ============================================================
//  LOCAL PLAYER - movement: run, jump, slide, wall kick, mantle.
//  pos is at the player's feet. yaw 0 looks toward -z.
// ============================================================
class LocalPlayer {
  constructor() {
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = 0;
    this.h = CONFIG.move.standHeight;
    this.grounded = false;
    this.groundRamp = null;
    this.groundBox = null;
    this.sliding = false;
    this.crouching = false;
    this.coyote = 0;
    this.jumpBuf = 0;
    this.slideCd = 0;
    this.kickCd = 0;
    this.lastKickN = null;
    this.hangN = null;
    this.hangT = 0;
    this.hanging = false;
    this.mantled = false;
    this.wall = null;
    this.speedMul = 1;   // duel chaser bonus
    this.ev = {};   // one-frame events for sounds/camera: jump, kick, slide, land, mantle
  }

  teleport(p, yaw) {
    this.pos.set(p[0], p[1], p[2]);
    this.vel.set(0, 0, 0);
    if (yaw !== undefined) { this.yaw = yaw; this.pitch = 0; }
    this.sliding = false;
  }

  queueJump() { this.jumpBuf = CONFIG.move.jumpBuffer; }
  hspeed() { return Math.hypot(this.vel.x, this.vel.z); }
  mode() { return this.sliding ? 1 : this.crouching ? 2 : 0; }

  step(dt, inp) {
    const M = CONFIG.move, v = this.vel;
    this.slideCd -= dt;
    this.kickCd -= dt;
    this.jumpBuf -= dt;

    const sy = Math.sin(this.yaw), cy = Math.cos(this.yaw);
    const fx = -sy, fz = -cy;  // forward
    const rx = cy, rz = -sy;   // right
    let wx = fx * inp.f + rx * inp.r, wz = fz * inp.f + rz * inp.r;
    const wl = Math.hypot(wx, wz);
    if (wl > 0) { wx /= wl; wz /= wl; }
    let hs = Math.hypot(v.x, v.z);

    // --- crouch / slide ---
    const onSlick = this.grounded && this.groundRamp && this.groundRamp.slick;
    if (inp.crouch) {
      if (this.grounded && !this.sliding && hs > M.slideMinSpeed) this.startSlide(hs);
      if (!this.sliding) this.crouching = true;
    } else if ((this.sliding || this.crouching) && !onSlick && World.canStand(this)) {
      this.sliding = false;
      this.crouching = false;
    }
    if (onSlick && !this.sliding) this.startSlide(hs);
    this.h = (this.sliding || this.crouching) ? M.crouchHeight : M.standHeight;

    // --- horizontal movement ---
    if (this.grounded && this.sliding) {
      if (this.groundRamp) {
        const d = World.rampDownhill(this.groundRamp);
        const a = M.gravity * d.sin * M.slopeSlideAccel;
        v.x += d.x * a * dt;
        v.z += d.z * a * dt;
      }
      const slick = this.groundRamp && this.groundRamp.slick;
      hs = Math.hypot(v.x, v.z);
      const ns = Math.min(Math.max(0, hs - (slick ? 0 : M.slideFriction) * dt), M.maxSpeed);
      if (hs > 0.01) {
        v.x *= ns / hs;
        v.z *= ns / hs;
        if (wl > 0) turnToward(v, wx, wz, M.slideTurn * dt);
      }
      if (slick && wl > 0 && ns < 4) { v.x += wx * 10 * dt; v.z += wz * 10 * dt; }
      if (ns < M.slideStopSpeed && !slick) { this.sliding = false; this.crouching = true; }
    } else if (this.grounded) {
      // crouch-walking is slow only when you choose it: squeezed under something low, you keep full speed
      const slow = this.crouching && World.canStand(this);
      const target = (slow ? M.crouchSpeed : (inp.run ? M.runSpeed : M.walkSpeed)) * this.speedMul;
      if (wl > 0) {
        const along = hs > 0.01 ? (v.x * wx + v.z * wz) / hs : 0;
        if (hs > target + 0.5 && along > 0.3) {
          // keep momentum from slides/kicks, let it fade slowly, steer toward input
          const ns = target + (hs - target) * Math.exp(-M.overspeedDecay * dt);
          const t = 1 - Math.exp(-M.speedTurn * dt);
          const dx = v.x / hs + (wx - v.x / hs) * t, dz = v.z / hs + (wz - v.z / hs) * t;
          const l = Math.hypot(dx, dz) || 1;
          v.x = dx / l * ns;
          v.z = dz / l * ns;
        } else {
          const t = 1 - Math.exp(-M.groundAccel * dt);
          v.x += (wx * target - v.x) * t;
          v.z += (wz * target - v.z) * t;
        }
      } else if (hs > M.runSpeed) {
        // let go at high speed: coast down to running speed first
        const ns = M.runSpeed + (hs - M.runSpeed) * Math.exp(-M.coastDecay * dt);
        v.x *= ns / hs;
        v.z *= ns / hs;
      } else {
        const f = Math.exp(-M.groundFriction * dt);
        v.x *= f;
        v.z *= f;
      }
    } else if (wl > 0) {
      // air control: swing your momentum toward where you steer, brake if you pull back
      if (hs > 1) {
        const along = (v.x * wx + v.z * wz) / hs;
        if (along < -0.5) {
          const k = Math.max(0, hs - M.airBrake * dt) / hs;
          v.x *= k; v.z *= k;
        } else if (this.kickCd <= 0) {
          const fwdness = inp.f > 0 ? 1 : 0.5;
          turnToward(v, wx, wz, M.airTurn * fwdness * dt);
        }
        hs = Math.hypot(v.x, v.z);
      }
      // then a little acceleration that never adds speed beyond what you already had
      const cap = Math.max(hs, (inp.run ? M.runSpeed : M.walkSpeed) * this.speedMul);
      v.x += wx * M.airAccel * dt;
      v.z += wz * M.airAccel * dt;
      const ns = Math.hypot(v.x, v.z);
      if (ns > cap) { v.x *= cap / ns; v.z *= cap / ns; }
    }

    // --- walls: hang + mantle ---
    this.airTime = this.grounded ? 0 : (this.airTime || 0) + dt;
    this.wall = this.grounded ? null : World.probeWall(this);
    this.hanging = false;
    if (this.wall) {
      const n = this.wall.n;
      const pushInto = wl > 0 ? -(wx * n.x + wz * n.z) : 0;
      const moveInto = hs > 0.5 ? -(v.x * n.x + v.z * n.z) / hs : 0;
      if (!this.hangN || this.hangN.x * n.x + this.hangN.z * n.z < 0.5) { this.hangN = n; this.hangT = 0; }
      // the little hang only happens when you actually go at the wall, not when you brush past it
      if (v.y < 0 && this.hangT < M.wallHangTime && this.airTime > 0.12 && (pushInto > 0.3 || moveInto > 0.3)) {
        this.hangT += dt;
        this.hanging = true;
      }

      // mantle: pushing AND looking at a ledge, near the top of your jump (or falling)
      const lookInto = -(fx * n.x + fz * n.z);
      if (!this.mantled && wl > 0 && v.y < 3) {
        const rel = this.wall.box.max.y - this.pos.y;
        if (pushInto > 0.6 && lookInto > 0.4 && rel > 0.5 && rel < M.mantleMaxHeight && World.ledgeClear(this, this.wall)) {
          v.y = Math.sqrt(2 * M.gravity * (rel + 0.25));
          v.x -= n.x * 2;
          v.z -= n.z * 2;
          this.mantled = true;
          this.ev.mantle = true;
        }
      }
    }

    // --- gravity ---
    let g = M.gravity;
    if (this.hanging) { g *= M.wallHangGravity; v.y *= Math.exp(-10 * dt); }
    v.y = Math.max(v.y - g * dt, -M.maxFall);

    // --- jump / wall kick ---
    if (this.jumpBuf > 0) {
      if (this.grounded || this.coyote > 0) {
        v.y = capJump(this, M.jumpSpeed);
        this.grounded = false;
        this.coyote = 0;
        this.jumpBuf = 0;
        if (this.sliding) { this.sliding = false; this.crouching = inp.crouch; }
        this.ev.jump = true;
      } else if (this.wall && this.kickCd <= 0) {   // any wall, even the same one again
        this.kick(this.wall.n, fx, fz);
      }
    }

    // --- collide ---
    const wasGrounded = this.grounded, vyBefore = v.y;
    World.move(this, dt);
    if (this.grounded) {
      if (!wasGrounded) {
        this.ev.land = Math.max(this.ev.land || 0, -vyBefore);
        this.lastKickN = null;
        this.mantled = false;
        this.hangN = null;
        this.hangT = 0;
      }
      this.coyote = M.coyoteTime;
    } else {
      this.coyote -= dt;
    }

    // --- level features ---
    const pad = World.padAt(this);
    if (pad) {
      v.y = pad.power;
      if (pad.push) { v.x = pad.push.x; v.z = pad.push.z; }
      this.grounded = false;
      this.coyote = 0;
      this.lastKickN = null;
      this.mantled = false;
      this.ev.pad = true;
    }
  }

  startSlide(hs) {
    const M = CONFIG.move;
    this.sliding = true;
    this.crouching = false;
    if (this.slideCd <= 0 && hs > 0.01 && hs < M.slideBoostCap) {
      const ns = Math.max(hs, Math.min(hs + M.slideBoost, M.maxSpeed));
      this.vel.x *= ns / hs;
      this.vel.z *= ns / hs;
      this.slideCd = M.slideBoostCooldown;
    }
    this.ev.slide = true;
  }

  // n = wall normal (points away from the wall), (fx, fz) = look direction
  kick(n, fx, fz) {
    const M = CONFIG.move, v = this.vel;
    let lx = fx, lz = fz;
    const into = lx * n.x + lz * n.z;
    if (into < 0) { lx -= n.x * into; lz -= n.z * into; }
    const ll = Math.hypot(lx, lz);
    if (ll < 0.2) { lx = n.x; lz = n.z; } else { lx /= ll; lz /= ll; }

    const vn = v.x * n.x + v.z * n.z;
    const tx = v.x - n.x * vn, tz = v.z - n.z * vn;
    v.x = n.x * M.wallKickOut + lx * M.wallKickForward + tx * M.wallKickKeep;
    v.z = n.z * M.wallKickOut + lz * M.wallKickForward + tz * M.wallKickKeep;
    const hs = Math.hypot(v.x, v.z);
    if (hs > M.maxSpeed) { v.x *= M.maxSpeed / hs; v.z *= M.maxSpeed / hs; }
    v.y = capJump(this, M.wallKickUp);

    this.lastKickN = n;
    this.kickCd = M.wallKickCooldown;
    this.hangT = M.wallHangTime;
    this.jumpBuf = 0;
    this.ev.kick = n;
  }
}

// rotate horizontal velocity toward (wx, wz) by at most maxAngle radians, keeping its speed
function turnToward(v, wx, wz, maxAngle) {
  const hs = Math.hypot(v.x, v.z);
  if (hs < 0.01) return;
  const cx = v.x / hs, cz = v.z / hs;
  const ang = Math.atan2(cx * wz - cz * wx, cx * wx + cz * wz);
  const t = Math.max(-maxAngle, Math.min(maxAngle, ang));
  const c = Math.cos(t), s = Math.sin(t);
  v.x = (cx * c - cz * s) * hs;
  v.z = (cx * s + cz * c) * hs;
}

// never bonk your head: if there's a ceiling close above, jump only as high as fits
function capJump(p, speed) {
  const gap = World.ceilingGap(p) - 0.05, g = CONFIG.move.gravity;
  if (gap >= speed * speed / (2 * g)) return speed;
  return Math.sqrt(2 * g * Math.max(0, gap));
}
