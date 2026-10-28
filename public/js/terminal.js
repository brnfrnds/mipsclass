(function (global) {
  const THREE = global.THREE;
  const document = global.document;

  function addSeat(scene, index, x, z) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);

    // desk surface
    const desk = new THREE.Mesh(
      new THREE.BoxGeometry(1.1, 0.05, 0.7),
      new THREE.MeshStandardMaterial({ color: 0x1a1a1a })
    );
    desk.position.y = 0.72;
    group.add(desk);

    // CRT screen: plane with a CanvasTexture so text can be drawn live
    const screenCanvas = document.createElement('canvas');
    screenCanvas.width = 320;
    screenCanvas.height = 240;
    const texture = new THREE.CanvasTexture(screenCanvas);
    const screen = new THREE.Mesh(
      new THREE.PlaneGeometry(1.2, 0.9),
      new THREE.MeshBasicMaterial({ map: texture })
    );
    screen.position.set(0, 1.05, 0.32);
    group.add(screen);

    // keyboard
    const keyboard = new THREE.Mesh(
      new THREE.BoxGeometry(1, 0.04, 0.5),
      new THREE.MeshStandardMaterial({ color: 0x222222 })
    );
    keyboard.position.set(0, 0.735, -0.08);
    group.add(keyboard);

    // gadget sprite (printer / display board) to the right of the screen,
    // with its own canvas texture so shared gadget state can be shown on it
    const gadgetCanvas = document.createElement('canvas');
    gadgetCanvas.width = 256;
    gadgetCanvas.height = 128;
    const gadgetTexture = new THREE.CanvasTexture(gadgetCanvas);
    const gadget = new THREE.Mesh(
      new THREE.BoxGeometry(0.45, 0.45, 0.3),
      new THREE.MeshBasicMaterial({ map: gadgetTexture })
    );
    gadget.position.set(0.72, 0.9, 0.05);
    group.add(gadget);

    scene.add(group);

    return {
      group,
      screen,
      texture,
      screenCanvas,
      gadget,
      gadgetTexture,
      gadgetCanvas,
      seatIndex: index,
      x,
      z,
    };
  }

  function updateScreen(seat, text) {
    const ctx = seat.screenCanvas.getContext('2d');
    ctx.fillStyle = '#050505';
    ctx.fillRect(0, 0, seat.screenCanvas.width, seat.screenCanvas.height);
    ctx.fillStyle = '#0a0';
    ctx.font = '18px monospace';
    const lines = String(text == null ? '' : text).split('\n');
    lines.forEach((line, i) => {
      ctx.fillText(line, 12, 26 + i * 22);
    });
    seat.texture.needsUpdate = true;
  }

  /** Draw a gadget summary (e.g. printer + board state) on a seat's gadget sprite. */
  function updateGadget(seat, text) {
    const ctx = seat.gadgetCanvas.getContext('2d');
    ctx.fillStyle = '#101010';
    ctx.fillRect(0, 0, seat.gadgetCanvas.width, seat.gadgetCanvas.height);
    ctx.fillStyle = '#fc0';
    ctx.font = '16px monospace';
    const lines = String(text == null ? '' : text).split('\n');
    lines.forEach((line, i) => {
      ctx.fillText(line, 8, 22 + i * 20);
    });
    seat.gadgetTexture.needsUpdate = true;
  }

  const mod = { addSeat, updateScreen, updateGadget };
  if (typeof module === 'object' && module.exports) {
    module.exports = mod;
  } else {
    global.addSeat = addSeat;
    global.updateScreen = updateScreen;
    global.updateGadget = updateGadget;
  }
})(typeof window !== 'undefined' ? window : global);
