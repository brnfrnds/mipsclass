const { test } = require('node:test');
const assert = require('node:assert');

// --- Minimal Three.js + DOM stubs so the client 3D modules load in node ---
function noop() {}
const canvasStub = {
  clientWidth: 800,
  clientHeight: 600,
  getContext: () => ({
    fillStyle: '', fillRect: noop, font: '', fillText: noop,
    measureText: () => ({ width: 0 }),
  }),
};
global.THREE = {
  Scene: function () { this.children = []; this.background = null; this.add = (o) => this.children.push(o); },
  PerspectiveCamera: function () { this.position = { set: noop }; this.lookAt = noop; this.aspect = 1; this.updateProjectionMatrix = noop; },
  WebGLRenderer: function () { this.setSize = (w, h) => { this.lastSize = { w, h }; }; this.render = noop; this.domElement = canvasStub; },
  BoxGeometry: function () {}, PlaneGeometry: function () {},
  CylinderGeometry: function () {},
  MeshStandardMaterial: function () {}, MeshBasicMaterial: function () {},
  SpriteMaterial: function () {},
  Sprite: function (m) { this.material = m; this.position = { set: noop }; },
  Mesh: function (g, m) { this.geometry = g; this.material = m; this.position = { set: noop }; },
  Color: function () {},
  CanvasTexture: function (c) { this.image = c; this.needsUpdate = false; this.repeat = { set: noop }; },
  Group: function () { this.children = []; this.position = { set: noop }; this.add = (o) => this.children.push(o); },
  Fog: function () {},
  HemisphereLight: function () { this.position = { set: noop }; },
  DirectionalLight: function () { this.position = { set: noop }; this.castShadow = false; this.shadow = { mapSize: { set: noop } }; },
  RepeatWrapping: 1000,
  ACESFilmicToneMapping: 4,
};
global.document = { createElement: () => canvasStub };
global.window = undefined;
global.innerWidth = 800;
global.innerHeight = 600;
// capture resize listeners so tests can fire the event
let resizeHandler = null;
global.addEventListener = (type, fn) => { if (type === 'resize') resizeHandler = fn; };
global.requestAnimationFrame = (f) => setTimeout(f, 0);

const sceneMod = require('../../public/js/scene.js');
const terminalMod = require('../../public/js/terminal.js');

test('initScene registers a resize handler; firing it resizes camera and renderer', () => {
  const canvas = { clientWidth: 800, clientHeight: 600, getContext: canvasStub.getContext };
  const { camera, renderer } = sceneMod.initScene(canvas);
  assert.equal(typeof resizeHandler, 'function', 'resize handler registered');

  // the window (and so the canvas) grows
  canvas.clientWidth = 1200;
  canvas.clientHeight = 500;
  resizeHandler();

  assert.equal(camera.aspect, 1200 / 500, 'camera aspect follows the window');
  assert.deepEqual(renderer.lastSize, { w: 1200, h: 500 }, 'render buffer follows the window');
});

test('initScene creates scene, camera, renderer and adds room geometry', () => {
  const { scene, camera, renderer } = sceneMod.initScene(canvasStub);
  assert.ok(scene, 'scene');
  assert.ok(camera, 'camera');
  assert.ok(renderer, 'renderer');
  assert.ok(scene.children.length >= 1, 'room geometry added to scene');
});

test('initScene returns the wall board, which paints shared board text', () => {
  const { board } = sceneMod.initScene(canvasStub);
  assert.ok(board, 'board object');
  assert.equal(typeof board.paint, 'function', 'board.paint');
  board.texture.needsUpdate = false;
  board.paint('MEETING AT NOON');
  assert.equal(board.texture.needsUpdate, true, 'board texture flagged for redraw');
});

test('addSeat returns a seat with screen mesh positioned at x,z and added to scene', () => {
  const scene = new global.THREE.Scene();
  const seat = terminalMod.addSeat(scene, 0, -1.6, 1.15);
  assert.ok(seat, 'seat');
  assert.ok(seat.screen, 'screen mesh');
  assert.ok(seat.texture, 'canvas texture');
  assert.ok(seat.screenCanvas, 'screen canvas');
  assert.strictEqual(seat.seatIndex, 0);
  assert.strictEqual(seat.x, -1.6);
  assert.strictEqual(seat.z, 1.15);
  assert.ok(scene.children.length >= 1, 'seat group added to scene');
});

test('updateScreen marks texture needsUpdate after drawing text', () => {
  const scene = new global.THREE.Scene();
  const seat = terminalMod.addSeat(scene, 0, 0, 0);
  seat.texture.needsUpdate = false;
  terminalMod.updateScreen(seat, 'SEAT 1\nREADY');
  assert.strictEqual(seat.texture.needsUpdate, true, 'texture flagged for redraw');
});
