const { test } = require('node:test');
const assert = require('node:assert');

// --- THREE + DOM stubs (extended for sprites/particles) ---
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
  MeshStandardMaterial: function () {}, MeshBasicMaterial: function () {},
  SpriteMaterial: function () {},
  Sprite: function (m) { this.material = m; this.position = { set: noop }; this.scale = { set: noop }; },
  Mesh: function (g, m) { this.geometry = g; this.material = m; this.position = { set: noop, y: 0 }; },
  Color: function () {},
  CanvasTexture: function (c) { this.image = c; this.needsUpdate = false; },
  Group: function () { this.children = []; this.position = { set: noop }; this.add = (o) => this.children.push(o); },
};
global.document = { createElement: makeCanvas };
global.window = undefined;
// RAF pump that stops after 400 ticks (~2s at 5ms) so the test process can exit.
let rafCount = 0;
global.requestAnimationFrame = (f) => { if (rafCount++ < 400) setTimeout(f, 5); };

function makeScene() { return new global.THREE.Scene(); }

test('add places a sprite in the scene and remove takes it out', async () => {
  const players = await import('../../public/js/players.js');
  const scene = makeScene();
  const seats = [{ seatIndex: 0, x: -1.6, z: 1.15, keyboard: null }];
  players.initPlayers({ scene, seats });
  const before = scene.children.length;
  players.add({ seatIndex: 0, name: 'Ada', profilePictureUrl: '' });
  assert.equal(scene.children.length, before + 1, 'sprite added');
  players.remove(0);
  assert.equal(scene.children.length, before, 'sprite removed');
});

test('setTyping toggles the typing state', async () => {
  const players = await import('../../public/js/players.js');
  const scene = makeScene();
  players.initPlayers({ scene, seats: [{ seatIndex: 1, x: 0, z: 1.15, keyboard: null }] });
  players.add({ seatIndex: 1, name: 'Bob', profilePictureUrl: '' });
  players.setTyping(1, true);
  assert.equal(players.isTyping(1), true);
  players.setTyping(1, false);
  assert.equal(players.isTyping(1), false);
});

test('explode spawns particles and cleans them up after the burst', async () => {
  const players = await import('../../public/js/players.js');
  const scene = makeScene();
  players.initPlayers({ scene, seats: [{ seatIndex: 2, x: 0.55, z: 1.15, keyboard: null }] });
  players.add({ seatIndex: 2, name: 'Cal', profilePictureUrl: '' });
  const before = scene.children.length;
  players.explode(2);
  assert.equal(scene.children.length, before + 30, '30 particles spawned');
  // let the RAF pump run past the 1.4s particle TTL
  await new Promise((r) => setTimeout(r, 2100));
  assert.equal(scene.children.length, before, 'particles cleaned up');
});
