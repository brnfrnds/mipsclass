// The office staff: when a player joins, a low-poly humanoid takes their
// seat around the rectangular table — shirt color by seat, arms that bang on the
// keyboard while they type, a name/photo sprite over their head, and an
// explosion when their MIPS program blows up: the terminal and the operator
// hop on a smooth parabola while debris flies ballistic arcs and bounces.
// The server is the source of truth for who is typing, who left, who blew up.
const THREE = globalThis.THREE;

let scene = null;
let seats = [];
let tableTop = 1.06; // seat-group origins sit at this world height
let tableDims = { length: 3.8, depth: 3.2 };
const states = new Map(); // seatIndex -> { humanoid, sprite, armL, armR, keyboard, baseY, typing, bobT }
const explosions = [];
let ticking = false;

// Explosion tuning — all animation is time-based (dt from timestamps), so it
// plays identically at any frame rate.
const PARTICLE_TTL = 2200;   // ms — slower, lingers
const GRAVITY = 3.2;         // u/s² — floaty game debris, not real physics
const JUMP_MS = 520;         // ms — the hop up and back down
const RESTITUTION = 0.35;    // bounce energy kept on landing
const FLOOR_MARGIN = 16;     // (bytes) observer-range margin, kept for reference

const SHIRTS = [0xC17A3F, 0xB4552E, 0x6B7A3F, 0x7A5A6E, 0x4E6E58, 0x8A6D3B];
const SKINS = [0xE8B48C, 0xC68863, 0x8C5A3C, 0x6B4226];

function startTick() {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(tick);
}

function tick() {
  const now = Date.now();
  for (let i = explosions.length - 1; i >= 0; i--) {
    const ex = explosions[i];
    if (stepExplosion(ex, now)) {
      ex.meshes.forEach((m) => scene.remove(m));
      explosions.splice(i, 1);
    }
  }
  for (const st of states.values()) {
    if (st.typing) {
      st.bobT += 0.15; // slow, watchable cycle
      if (st.armL && st.armL.rotation) st.armL.rotation.x = 1.15 + Math.sin(st.bobT) * 0.5; // wild swings
      if (st.armR && st.armR.rotation) st.armR.rotation.x = 1.15 + Math.sin(st.bobT + Math.PI) * 0.5;
      if (st.keyboard && st.keyboard.position) st.keyboard.position.y = st.baseY + Math.abs(Math.sin(st.bobT * 2)) * 0.012;
    }
  }
  requestAnimationFrame(tick);
}

function seatAt(index) {
  return seats.find((s) => s.seatIndex === index) || null;
}

function part(w, h, d, color, x, y, z, parent) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color, roughness: 0.8 }));
  m.position.set(x, y, z);
  if ('castShadow' in m) m.castShadow = true;
  if (parent) parent.add(m);
  return m;
}

/**
 * A seated humanoid facing −z (toward their terminal and the table center).
 * The body lives in its own sub-group so an explosion can hop it without
 * lifting the chair. Returns the group, the body, and the two arm pivots.
 */
function makeHumanoid(seatIndex) {
  const shirt = SHIRTS[seatIndex % SHIRTS.length];
  const skin = SKINS[seatIndex % SKINS.length];
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);

  // chair (raised posture — the operator sits up where the table can see them)
  part(0.5, 0.07, 0.5, 0x3E3A32, 0, 0.74, 0.12, g);
  part(0.5, 0.5, 0.07, 0x3E3A32, 0, 1.02, 0.4, g);
  part(0.07, 0.74, 0.07, 0x2E2A24, -0.2, 0.37, 0.12, g);
  part(0.07, 0.74, 0.07, 0x2E2A24, 0.2, 0.37, 0.12, g);

  // legs: thighs forward, shins down (longer — feet stay on the floor)
  part(0.13, 0.13, 0.42, 0x37322B, -0.1, 0.78, -0.14, body);
  part(0.13, 0.13, 0.42, 0x37322B, 0.1, 0.78, -0.14, body);
  part(0.11, 0.74, 0.11, 0x37322B, -0.1, 0.37, -0.3, body);
  part(0.11, 0.74, 0.11, 0x37322B, 0.1, 0.37, -0.3, body);

  // torso, head, hair — seated head height ~1.43
  part(0.4, 0.52, 0.24, shirt, 0, 1.04, 0, body);
  part(0.26, 0.26, 0.26, skin, 0, 1.43, 0, body);
  part(0.28, 0.09, 0.28, 0x2E2016, 0, 1.585, 0, body);

  // arms: pivot at the shoulder, resting reach toward the keyboard
  function arm(side) {
    const pivot = new THREE.Group();
    pivot.position.set(0.25 * side, 1.24, 0);
    part(0.1, 0.44, 0.1, shirt, 0, -0.2, 0, pivot);
    part(0.09, 0.1, 0.09, skin, 0, -0.44, 0, pivot);
    if (pivot.rotation) pivot.rotation.x = 1.15;
    body.add(pivot);
    return pivot;
  }
  const armL = arm(-1);
  const armR = arm(1);

  return { group: g, body, armL, armR };
}

/** Billboard sprite with the player's name and (if it loads) profile picture. */
function makeSprite(player) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const ctx = c.getContext('2d');
  ctx.fillStyle = 'rgba(16, 14, 10, 0.78)';
  ctx.fillRect(24, 8, 208, 112);
  ctx.fillStyle = '#66fcf1';
  ctx.font = 'bold 28px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(String(player.name || '???').slice(0, 12), 128, 44);

  const texture = new THREE.CanvasTexture(c);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true }));
  sprite.scale.set(1.0, 0.5, 1);

  const url = player.profilePictureUrl;
  if (url && typeof Image !== 'undefined') {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      ctx.drawImage(img, 78, 56, 100, 64);
      texture.needsUpdate = true;
    };
    img.onerror = () => {}; // keep the name-only tag
    img.src = url;
  }
  return sprite;
}

export function initPlayers(opts) {
  scene = opts.scene;
  seats = opts.seats || [];
  tableTop = opts.tableTop !== undefined ? opts.tableTop : 1.06;
  tableDims = opts.table || (opts.tableRadius !== undefined
    ? { length: opts.tableRadius * 2, depth: opts.tableRadius * 2 }
    : { length: 3.8, depth: 3.2 });
  startTick();
}

export function debrisFloor(x, z, tableTop, dims) {
  const d = dims && dims.length && dims.depth ? dims : { length: 3.8, depth: 3.2 };
  const onTable = Math.abs(x) <= d.length / 2 && Math.abs(z) <= d.depth / 2;
  return onTable ? tableTop : 0.03;
}

export function add(player, opts = {}) {
  if (states.has(player.seatIndex)) remove(player.seatIndex); // re-join safety
  const seat = seatAt(player.seatIndex);
  if (!seat || !seat.group) return;
  const humanoid = makeHumanoid(player.seatIndex);
  // sit centered behind the keyboard, facing the terminal (−z)
  humanoid.group.position.set(0, -tableTop, 0.95);
  seat.group.add(humanoid.group);

  let sprite = null;
  if (!opts.isSelf) {
    sprite = makeSprite(player);
    sprite.position.set(0, 1.66, 0.95); // just above the head, seat's frame
    seat.group.add(sprite);
  }

  states.set(player.seatIndex, {
    humanoid,
    sprite,
    armL: humanoid.armL,
    armR: humanoid.armR,
    keyboard: seat.keyboard || null,
    baseY: seat.keyboard && seat.keyboard.position ? seat.keyboard.position.y : 0,
    typing: false,
    bobT: Math.random() * 6,
  });
}

export function remove(seatIndex) {
  const st = states.get(seatIndex);
  if (st && seatAt(seatIndex)) {
    const seat = seatAt(seatIndex);
    if (st.humanoid && st.humanoid.group) seat.group.remove(st.humanoid.group);
    if (st.sprite) seat.group.remove(st.sprite);
  }
  states.delete(seatIndex);
}

export function setTyping(seatIndex, typing) {
  const st = states.get(seatIndex);
  if (!st) return;
  st.typing = !!typing;
  if (!st.typing) {
    if (st.armL && st.armL.rotation) st.armL.rotation.x = 1.15;
    if (st.armR && st.armR.rotation) st.armR.rotation.x = 1.15;
    if (st.keyboard && st.keyboard.position) st.keyboard.position.y = st.baseY;
  }
}

export function isTyping(seatIndex) {
  const st = states.get(seatIndex);
  return Boolean(st && st.typing);
}

/**
 * The terminal explodes: debris erupts in an upward-biased dome around the
 * computer, the CRT and the operator hop, everything settles smoothly.
 * All motion is time-based — stepExplosion integrates real elapsed time.
 */
export function explode(seatIndex) {
  if (!scene) return;
  const seat = seatAt(seatIndex);
  if (!seat) return;
  const born = Date.now();
  const meshes = [];
  const velocities = new Map();

  for (let i = 0; i < 34; i++) {
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(0.07, 0.07, 0.07),
      new THREE.MeshBasicMaterial({ color: i % 2 ? 0xff5500 : 0xffaa00, transparent: true, opacity: 1 })
    );
    // spawn in a disc around the computer, launch on an upward-biased dome
    const angle = Math.random() * Math.PI * 2;
    const ring = Math.random() * 0.32;
    m.position.set(
      seat.x + Math.cos(angle) * ring,
      tableTop + 0.42,
      seat.z + Math.sin(angle) * ring
    );
    const speed = 1.1 + Math.random() * 1.1;                  // slow, heavy debris
    const elev = (0.35 + Math.random() * 0.5) * Math.PI / 2;  // 30°–75° up
    velocities.set(m, {
      x: Math.cos(angle) * Math.cos(elev) * speed,
      y: Math.sin(elev) * speed,
      z: Math.sin(angle) * Math.cos(elev) * speed,
    });
    scene.add(m);
    meshes.push(m);
  }

  // the hop: the CRT and the operator's body (not the chair) leap together
  const jumpers = [];
  if (seat.crt) jumpers.push({ obj: seat.crt, baseY: seat.crt.position.y, height: 0.3 });
  const st = states.get(seatIndex);
  if (st && st.humanoid && st.humanoid.body) {
    jumpers.push({ obj: st.humanoid.body, baseY: st.humanoid.body.position.y, height: 0.26 });
  }

  explosions.push({ meshes, velocities, jumpers, born, lastStep: born, floorY: tableTop });
}

export function lastExplosion() {
  return explosions[explosions.length - 1] || null;
}

/**
 * Advance one explosion by real elapsed time. Returns true once the burst
 * is over (past its TTL) and the caller may remove the debris.
 */
export function stepExplosion(ex, now) {
  const dt = Math.min((now - ex.lastStep) / 1000, 0.05); // clamp long frames
  ex.lastStep = now;

  // the hop: y = base + h·4t(1−t) — a parabola with zero velocity at both ends
  const jt = (now - ex.born) / JUMP_MS;
  const lift = jt <= 1 ? 4 * jt * (1 - jt) : 0;
  for (const j of ex.jumpers) {
    j.obj.position.y = j.baseY + j.height * lift;
  }

  // debris: semi-implicit Euler ballistics
  for (const m of ex.meshes) {
    const v = ex.velocities.get(m);
    v.y -= GRAVITY * dt;
    m.position.x += v.x * dt;
    m.position.y += v.y * dt;
    m.position.z += v.z * dt;

    // bounce on the tabletop — or on the carpet once past the table's rim
    const floorY = debrisFloor(m.position.x, m.position.z, ex.floorY, tableDims);
    if (m.position.y < floorY && v.y < 0) {
      m.position.y = floorY;
      v.y = -v.y * RESTITUTION;
      v.x *= 0.8;
      v.z *= 0.8;
    }

    m.material.opacity = Math.max(0, 1 - (now - ex.born) / PARTICLE_TTL);
  }

  return now - ex.born > PARTICLE_TTL;
}
