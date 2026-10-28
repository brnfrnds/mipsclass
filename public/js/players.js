// Remote players: a name + profile-picture sprite above each seat, a
// keyboard-banging animation while that player types, and an explosion when
// their MIPS program blows up. Everything here is cosmetic — the server is
// the source of truth for who is typing, who left, who blew up.
const THREE = globalThis.THREE;

let scene = null;
let seats = [];
const states = new Map(); // seatIndex -> { typing, bobT, sprite, keyboard, baseY, picLoaded }
const explosions = []; // { meshes, velocities, born }
let ticking = false;

function startTick() {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(tick);
}

function tick() {
  const now = Date.now();
  for (const st of states.values()) {
    if (st.typing && st.keyboard) {
      st.bobT += 0.35;
      st.keyboard.position.y = st.baseY + Math.abs(Math.sin(st.bobT)) * 0.035;
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

/** Billboard sprite with the player's name and (if it loads) profile picture. */
function makeSprite(player) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, 256, 128);
  ctx.fillStyle = '#66fcf1';
  ctx.font = 'bold 28px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(String(player.name || '???').slice(0, 12), 128, 44);

  const texture = new THREE.CanvasTexture(c);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture }));
  sprite.scale.set(1.4, 0.7, 1);

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
  startTick();
}

export function add(player) {
  if (!scene) return;
  const seat = seatAt(player.seatIndex);
  if (!seat) return;
  const sprite = makeSprite(player);
  sprite.position.set(seat.x, 1.9, seat.z);
  scene.add(sprite);
  states.set(player.seatIndex, {
    typing: false,
    bobT: 0,
    sprite,
    keyboard: seat.keyboard || null,
    baseY: seat.keyboard ? seat.keyboard.position.y : 0,
  });
}

export function remove(seatIndex) {
  const st = states.get(seatIndex);
  if (st && st.sprite && scene) scene.remove(st.sprite);
  states.delete(seatIndex);
}

export function setTyping(seatIndex, typing) {
  const st = states.get(seatIndex);
  if (!st) return;
  st.typing = !!typing;
  if (!st.typing && st.keyboard) st.keyboard.position.y = st.baseY;
}

export function isTyping(seatIndex) {
  const st = states.get(seatIndex);
  return Boolean(st && st.typing);
}

/** Particle burst at the seat; meshes clean themselves up after ~1.4s. */
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
    m.position.set(seat.x, 1.1, seat.z);
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
