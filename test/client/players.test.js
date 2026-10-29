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
// RAF pump that stops after 400 ticks (~2s at 5ms) so the test process can exit.
let rafCount = 0;
global.requestAnimationFrame = (f) => { if (rafCount++ < 400) setTimeout(f, 5); };

function makeScene() { return new global.THREE.Scene(); }
function makeSeat(index) {
  return {
    seatIndex: index,
    x: Math.cos((index * Math.PI) / 2) * 1.38,
    z: Math.sin((index * Math.PI) / 2) * 1.38,
    group: new global.THREE.Group(),
    keyboard: new global.THREE.Mesh(),
  };
}

test('add seats a humanoid (and sprite for remotes) in the seat group; remove clears them', async () => {
  const players = await import('../../public/js/players.js');
  const scene = makeScene();
  const seat = makeSeat(0);
  players.initPlayers({ scene, seats: [seat], tableTop: 1.06 });

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
  players.initPlayers({ scene, seats: [seat], tableTop: 1.06 });
  players.add({ seatIndex: 1, name: 'Bob', profilePictureUrl: '' }, { isSelf: true });
  players.setTyping(1, true);
  assert.equal(players.isTyping(1), true);
  players.setTyping(1, false);
  assert.equal(players.isTyping(1), false);
});

test('explode spawns particles in the scene and cleans them up after the burst', async () => {
  const players = await import('../../public/js/players.js');
  const scene = makeScene();
  const seat = makeSeat(2);
  players.initPlayers({ scene, seats: [seat], tableTop: 1.06 });
  players.add({ seatIndex: 2, name: 'Cal', profilePictureUrl: '' }, { isSelf: true });
  const before = scene.children.length;
  players.explode(2);
  assert.equal(scene.children.length, before + 30, '30 particles spawned');
  // let the RAF pump run past the 1.4s particle TTL
  await new Promise((r) => setTimeout(r, 2100));
  assert.equal(scene.children.length, before, 'particles cleaned up');
});
