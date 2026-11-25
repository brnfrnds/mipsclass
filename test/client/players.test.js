const { test } = require('node:test');
const assert = require('node:assert');

// --- THREE + DOM stubs (extended for sprites/particles/humanoids) ---
function noop() {}
function makeCanvas() {
  return {
    width: 0, height: 0,
    getContext: () => ({
      fillStyle: '', font: '', textAlign: '',
      fillRect: noop, fillText: noop, drawImage: noop,
      measureText: () => ({ width: 0 }),
    }),
  };
}
global.THREE = {
  Scene: function () { this.children = []; this.background = null; this.add = (o) => this.children.push(o); this.remove = (o) => { const i = this.children.indexOf(o); if (i >= 0) this.children.splice(i, 1); }; },
  PerspectiveCamera: function () { this.position = { set: noop }; this.lookAt = noop; },
  WebGLRenderer: function () { this.setSize = noop; this.render = noop; },
  BoxGeometry: function () {}, PlaneGeometry: function () {},
  CylinderGeometry: function () {},
  MeshStandardMaterial: function () {}, MeshBasicMaterial: function () {},
  SpriteMaterial: function () {},
  Sprite: function (m) { this.material = m; this.position = { set: noop }; this.scale = { set: noop }; },
  Mesh: function (g, m) {
    this.geometry = g; this.material = m;
    this.position = { set: noop, x: 0, y: 0, z: 0 };
    this.rotation = { x: 0, y: 0, z: 0 };
  },
  Color: function () {},
  CanvasTexture: function (c) { this.image = c; this.needsUpdate = false; this.repeat = { set: noop }; },
  Group: function () {
    this.children = [];
    this.position = { set: noop, x: 0, y: 0, z: 0 };
    this.rotation = { x: 0, y: 0, z: 0 };
    this.add = (o) => this.children.push(o);
    this.remove = (o) => { const i = this.children.indexOf(o); if (i >= 0) this.children.splice(i, 1); };
  },
  Fog: function () {},
  HemisphereLight: function () { this.position = { set: noop }; },
  DirectionalLight: function () { this.position = { set: noop }; this.castShadow = false; this.shadow = { mapSize: { set: noop } }; },
  RepeatWrapping: 1000,
  ACESFilmicToneMapping: 4,
};
global.document = { createElement: makeCanvas };
global.window = undefined;
// NO RAF pump: explosion physics is stepped manually in tests (deterministic).
global.requestAnimationFrame = () => {};

function makeScene() { return new global.THREE.Scene(); }
function makeSeat(index) {
  return {
    seatIndex: index,
    x: Math.cos((index * Math.PI) / 2) * 1.38,
    z: Math.sin((index * Math.PI) / 2) * 1.38,
    group: new global.THREE.Group(),
    keyboard: new global.THREE.Mesh(),
    crt: new global.THREE.Mesh(),
  };
}

test('add seats a humanoid (and sprite for remotes) in the seat group; remove clears them', async () => {
  const players = await import('../../public/js/players.js');
  const scene = makeScene();
  const seat = makeSeat(0);
  players.initPlayers({ scene, seats: [seat], tableTop: 1.06, tableRadius: 1.9 });

  const base = seat.group.children.length;
  players.add({ seatIndex: 0, name: 'Ada', profilePictureUrl: '' }, { isSelf: true });
  assert.ok(seat.group.children.length > base, 'humanoid added to the seat group');

  players.add({ seatIndex: 0, name: 'Ada', profilePictureUrl: '' }, { isSelf: false });
  assert.ok(seat.group.children.length > base + 1, 'sprite added too for remotes');

  players.remove(0);
  assert.equal(seat.group.children.length, base, 'humanoid and sprite removed');
});

test('setTyping toggles and resets the typing state', async () => {
  const players = await import('../../public/js/players.js');
  const scene = makeScene();
  const seat = makeSeat(1);
  players.initPlayers({ scene, seats: [seat], tableTop: 1.06, tableRadius: 1.9 });
  players.add({ seatIndex: 1, name: 'Bob', profilePictureUrl: '' }, { isSelf: true });
  players.setTyping(1, true);
  assert.equal(players.isTyping(1), true);
  players.setTyping(1, false);
  assert.equal(players.isTyping(1), false);
});

test('explode makes the CRT jump on a smooth parabola and land back', async () => {
  const players = await import('../../public/js/players.js');
  const scene = makeScene();
  const seat = makeSeat(0);
  players.initPlayers({ scene, seats: [seat], tableTop: 1.06, tableRadius: 1.9 });
  players.add({ seatIndex: 0, name: 'Ada', profilePictureUrl: '' }, { isSelf: true });

  players.explode(0);
  const ex = players.lastExplosion();
  const baseY = seat.crt.position.y;

  players.stepExplosion(ex, ex.born + 260); // mid-jump (half of the 520ms hop)
  const midY = seat.crt.position.y;
  assert.ok(midY > baseY + 0.15, `CRT is airborne mid-jump (y ${midY} vs base ${baseY})`);

  players.stepExplosion(ex, ex.born + 700); // landed
  assert.equal(seat.crt.position.y, baseY, 'CRT lands back exactly');
});

test('debris follows time-based ballistics: two 100ms steps equal four 50ms steps', async () => {
  const players = await import('../../public/js/players.js');
  const scene = makeScene();
  players.initPlayers({ scene, seats: [makeSeat(0)], tableTop: 1.06, tableRadius: 1.9 });
  players.add({ seatIndex: 0, name: 'Ada', profilePictureUrl: '' }, { isSelf: true });

  // same controlled velocity in two explosions
  players.explode(0);
  const a = players.lastExplosion();
  const pa = a.meshes[0];
  Object.assign(a.velocities.get(pa), { x: 1, y: 2, z: 0 });
  players.stepExplosion(a, a.born + 50);
  players.stepExplosion(a, a.born + 100);

  players.explode(0);
  const b = players.lastExplosion();
  const pb = b.meshes[0];
  Object.assign(b.velocities.get(pb), { x: 1, y: 2, z: 0 });
  players.stepExplosion(b, b.born + 25);
  players.stepExplosion(b, b.born + 50);
  players.stepExplosion(b, b.born + 75);
  players.stepExplosion(b, b.born + 100);

  // same trajectory within integration error
  assert.ok(Math.abs(pa.position.x - pb.position.x) < 0.01, 'x matches');
  assert.ok(Math.abs(pa.position.y - pb.position.y) < 0.01, 'y matches (gravity integrated)');
  assert.ok(Math.abs(pa.position.z - pb.position.z) < 0.01, 'z matches');
});

test('debris fades with time and the explosion reports dead past its TTL', async () => {
  const players = await import('../../public/js/players.js');
  const scene = makeScene();
  players.initPlayers({ scene, seats: [makeSeat(0)], tableTop: 1.06, tableRadius: 1.9 });
  players.add({ seatIndex: 0, name: 'Ada', profilePictureUrl: '' }, { isSelf: true });

  players.explode(0);
  const ex = players.lastExplosion();
  players.stepExplosion(ex, ex.born + 1100); // halfway through the 2.2s TTL
  assert.ok(ex.meshes[0].material.opacity > 0.4 && ex.meshes[0].material.opacity < 0.6, 'half-faded at half-life');
  players.stepExplosion(ex, ex.born + 1200);
  assert.equal(players.lastExplosion(), ex, 'still alive before TTL');
  const dead = players.stepExplosion(ex, ex.born + 2400); // past the TTL
  assert.equal(dead, true, 'reported dead past TTL');
  assert.equal(ex.meshes[0].material.opacity, 0, 'faded fully');
});

test('debrisFloor uses the rectangular tabletop, not a circle', async () => {
  const players = await import('../../public/js/players.js');
  const dims = { length: 10, depth: 3.2 };
  assert.equal(players.debrisFloor(0, 0, 1.06, dims), 1.06, 'centre is tabletop');
  assert.equal(players.debrisFloor(4.9, 1.5, 1.06, dims), 1.06, 'near the corner is tabletop');
  assert.equal(players.debrisFloor(5.1, 0, 1.06, dims), 0.03, 'past the long edge is carpet');
  assert.equal(players.debrisFloor(0, 1.7, 1.06, dims), 0.03, 'past the short edge is carpet');
});

