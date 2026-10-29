// The office staff: when a player joins, a low-poly humanoid takes their
// seat around the round table — shirt color by seat, arms that bang on the
// keyboard while they type, a name/photo sprite over their head, and an
// explosion at their terminal when they blow up. The server is the source
// of truth for who is typing, who left, who blew up.
const THREE = globalThis.THREE;

let scene = null;
let seats = [];
let tableTop = 1.06; // seat-group origins sit at this world height
const states = new Map(); // seatIndex -> { humanoid, sprite, armL, armR, keyboard, baseY, typing, bobT }
const explosions = []; // { meshes, velocities, born }
let ticking = false;

const SHIRTS = [0xC17A3F, 0xB4552E, 0x6B7A3F, 0x7A5A6E, 0x4E6E58, 0x8A6D3B];
const SKINS = [0xE8B48C, 0xC68863, 0x8C5A3C, 0x6B4226];

function startTick() {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(tick);
}

function tick() {
  const now = Date.now();
  for (const st of states.values()) {
    if (st.typing) {
      st.bobT += 0.42;
      if (st.armL && st.armL.rotation) st.armL.rotation.x = 1.15 + Math.sin(st.bobT) * 0.16;
      if (st.armR && st.armR.rotation) st.armR.rotation.x = 1.15 + Math.sin(st.bobT + Math.PI) * 0.16;
      if (st.keyboard && st.keyboard.position) st.keyboard.position.y = st.baseY + Math.abs(Math.sin(st.bobT * 2)) * 0.012;
    }
  }
  for (let i = explosions.length - 1; i >= 0; i--) {
    const ex = explosions[i];
    for (const m of ex.meshes) {
      m.position.x += ex.velocities.get(m).x;
      m.position.y += ex.velocities.get(m).y;
      m.position.z += ex.velocities.get(m).z;
      m.material.opacity = Math.max(0, m.material.opacity - 0.02);
    }
    if (now - ex.born > 1400) {
      ex.meshes.forEach((m) => scene.remove(m));
      explosions.splice(i, 1);
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
 * Returns the group plus the two arm pivots so typing can animate them.
 */
function makeHumanoid(seatIndex) {
  const shirt = SHIRTS[seatIndex % SHIRTS.length];
  const skin = SKINS[seatIndex % SKINS.length];
  const g = new THREE.Group();

  // chair
  part(0.5, 0.07, 0.5, 0x3E3A32, 0, 0.46, 0.12, g);
  part(0.5, 0.5, 0.07, 0x3E3A32, 0, 0.74, 0.4, g);
  part(0.07, 0.46, 0.07, 0x2E2A24, -0.2, 0.23, 0.12, g);
  part(0.07, 0.46, 0.07, 0x2E2A24, 0.2, 0.23, 0.12, g);

  // legs: thighs forward, shins down
  part(0.13, 0.13, 0.42, 0x37322B, -0.1, 0.5, -0.14, g);
  part(0.13, 0.13, 0.42, 0x37322B, 0.1, 0.5, -0.14, g);
  part(0.11, 0.46, 0.11, 0x37322B, -0.1, 0.23, -0.3, g);
  part(0.11, 0.46, 0.11, 0x37322B, 0.1, 0.23, -0.3, g);

  // torso, head, hair — seated head height ~1.2
  part(0.4, 0.52, 0.24, shirt, 0, 0.8, 0, g);
  part(0.26, 0.26, 0.26, skin, 0, 1.19, 0, g);
  part(0.28, 0.09, 0.28, 0x2E2016, 0, 1.345, 0, g);

  // arms: pivot at the shoulder, resting reach toward the keyboard
  function arm(side) {
    const pivot = new THREE.Group();
    pivot.position.set(0.25 * side, 1.0, 0);
    part(0.1, 0.44, 0.1, shirt, 0, -0.2, 0, pivot);
    part(0.09, 0.1, 0.09, skin, 0, -0.44, 0, pivot);
    if (pivot.rotation) pivot.rotation.x = 1.15;
    g.add(pivot);
    return pivot;
  }
  const armL = arm(-1);
  const armR = arm(1);

  return { group: g, armL, armR };
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
  sprite.scale.set(1.2, 0.6, 1);

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
  startTick();
}

export function add(player, opts = {}) {
  if (states.has(player.seatIndex)) remove(player.seatIndex); // re-join safety
  const seat = seatAt(player.seatIndex);
  if (!seat || !seat.group) return;
  const humanoid = makeHumanoid(player.seatIndex);
  // sit just outside the table edge, pulled to one side so nobody's own
  // avatar blocks their view across the table; facing the terminal (−z)
  const side = player.seatIndex % 2 === 0 ? 1 : -1;
  humanoid.group.position.set(0.55 * side, -tableTop, 0.95);
  seat.group.add(humanoid.group);

  let sprite = null;
  if (!opts.isSelf) {
    sprite = makeSprite(player);
    sprite.position.set(0.55 * side, 1.45, 0.95); // just above the head, seat's frame
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

/** Particle burst at the seat's terminal; meshes clean up after ~1.4s. */
export function explode(seatIndex) {
  if (!scene) return;
  const seat = seatAt(seatIndex);
  if (!seat) return;
  const meshes = [];
  const velocities = new Map();
  for (let i = 0; i < 30; i++) {
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.06, 0.06),
      new THREE.MeshBasicMaterial({ color: i % 2 ? 0xff5500 : 0xffaa00, transparent: true, opacity: 1 })
    );
    m.position.set(seat.x, tableTop + 0.35, seat.z);
    velocities.set(m, {
      x: (Math.random() - 0.5) * 0.12,
      y: Math.random() * 0.14,
      z: (Math.random() - 0.5) * 0.12,
    });
    scene.add(m);
    meshes.push(m);
  }
  explosions.push({ meshes, velocities, born: Date.now() });
}
