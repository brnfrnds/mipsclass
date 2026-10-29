(function (global) {
  const THREE = global.THREE;
  const document = global.document;

  function addSeat(scene, index, x, z) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);

    const beige = new THREE.MeshStandardMaterial({ color: 0xD6CCB4, roughness: 0.7 });
    const beigeDark = new THREE.MeshStandardMaterial({ color: 0xC2B79D, roughness: 0.75 });
    const carbon = new THREE.MeshStandardMaterial({ color: 0x201C18, roughness: 0.6 });
    const paperMat = new THREE.MeshStandardMaterial({ color: 0xF2ECDC, roughness: 0.9 });

    function guarded(mesh) {
      if ('castShadow' in mesh) mesh.castShadow = true;
      return mesh;
    }

    // --- desk: wood top on beige steel legs ---
    const woodTop = new THREE.Mesh(
      new THREE.BoxGeometry(1.9, 0.07, 0.95),
      new THREE.MeshStandardMaterial({ color: 0x8A5A2B, roughness: 0.7 })
    );
    woodTop.position.set(0, 0.75, 0.12);
    group.add(guarded(woodTop));
    group.add(guarded((() => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.75, 0.85), beigeDark);
      m.position.set(-0.88, 0.375, 0.1);
      return m;
    })()));
    group.add(guarded((() => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.75, 0.85), beigeDark);
      m.position.set(0.88, 0.375, 0.1);
      return m;
    })()));

    // --- CRT terminal: beige casing, dark bezel, recessed phosphor screen ---
    const screenCanvas = document.createElement('canvas');
    screenCanvas.width = 320;
    screenCanvas.height = 240;
    const texture = new THREE.CanvasTexture(screenCanvas);
    const screen = new THREE.Mesh(
      new THREE.PlaneGeometry(0.74, 0.56),
      new THREE.MeshBasicMaterial({ map: texture })
    );

    const crt = new THREE.Group();
    crt.add(guarded((() => {
      const body = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.8, 0.62), beige);
      body.position.set(0, 0.4, 0);
      return body;
    })()));
    crt.add(guarded((() => {
      const bezel = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.66, 0.05), carbon);
      bezel.position.set(0, 0.42, 0.3);
      return bezel;
    })()));
    screen.position.set(0, 0.42, 0.335);
    crt.add(screen);
    const led = new THREE.Mesh(
      new THREE.BoxGeometry(0.035, 0.035, 0.02),
      new THREE.MeshBasicMaterial({ color: 0x35FF6E })
    );
    led.position.set(0.4, 0.13, 0.315);
    crt.add(led);
    // vents on the top shell
    for (let i = 0; i < 4; i++) {
      const vent = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.01, 0.02), carbon);
      vent.position.set(0, 0.805, 0.12 + i * 0.09);
      crt.add(vent);
    }
    crt.position.set(0, 0.785, 0.12);
    group.add(crt);

    // --- keyboard: beige slab, dark key rows, space bar ---
    const keyboard = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.05, 0.42), beigeDark);
    keyboard.position.set(0, 0.795, 0.72);
    group.add(guarded(keyboard));
    const keyRow = new THREE.MeshStandardMaterial({ color: 0x2E2A24, roughness: 0.55 });
    for (let r = 0; r < 3; r++) {
      const row = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.025, 0.07), keyRow);
      row.position.set(0, 0.825, 0.6 + r * 0.11);
      group.add(row);
    }
    const space = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.025, 0.07), keyRow);
    space.position.set(0, 0.825, 0.93);
    group.add(space);

    // --- gadget: a dot-matrix printer printing onto a real paper sheet ---
    const gadgetCanvas = document.createElement('canvas');
    gadgetCanvas.width = 256;
    gadgetCanvas.height = 320;
    const gadgetTexture = new THREE.CanvasTexture(gadgetCanvas);
    const gadget = new THREE.Mesh(
      new THREE.BoxGeometry(0.52, 0.3, 0.42),
      beige
    );
    gadget.position.set(0.72, 0.94, 0.22);
    group.add(guarded(gadget));
    const slot = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.02, 0.04), carbon);
    slot.position.set(0.72, 1.09, 0.22);
    group.add(slot);
    const paper = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.34), new THREE.MeshBasicMaterial({ map: gadgetTexture }));
    paper.position.set(0.72, 1.26, 0.02);
    group.add(paper);

    // --- desk props: coffee mug, loose papers ---
    if (THREE.CylinderGeometry) {
      const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.045, 0.1, 12), new THREE.MeshStandardMaterial({ color: 0xB4552E, roughness: 0.6 }));
      mug.position.set(-0.62, 0.84, 0.32);
      group.add(guarded(mug));
    }
    const sheet1 = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.3), paperMat);
    sheet1.position.set(-0.55, 0.79, -0.05);
    if (sheet1.rotation) sheet1.rotation.x = -Math.PI / 2;
    group.add(sheet1);
    const sheet2 = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.3), paperMat);
    sheet2.position.set(-0.48, 0.795, -0.02);
    if (sheet2.rotation) { sheet2.rotation.x = -Math.PI / 2; sheet2.rotation.z = 0.3; }
    group.add(sheet2);

    scene.add(group);

    paintPaper(gadgetCanvas, gadgetTexture, '');

    return {
      group,
      screen,
      texture,
      screenCanvas,
      keyboard,
      gadget,
      gadgetTexture,
      gadgetCanvas,
      seatIndex: index,
      x,
      z,
    };
  }

  function paintScanlines(ctx, w, h) {
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    for (let y = 0; y < h; y += 4) ctx.fillRect(0, y, w, 1);
  }

  /** Phosphor CRT: near-black tube, green text with a soft double-print glow. */
  function updateScreen(seat, text) {
    const ctx = seat.screenCanvas.getContext('2d');
    ctx.fillStyle = '#04140A';
    ctx.fillRect(0, 0, seat.screenCanvas.width, seat.screenCanvas.height);
    paintScanlines(ctx, seat.screenCanvas.width, seat.screenCanvas.height);
    ctx.font = '18px monospace';
    const lines = String(text == null ? '' : text).split('\n');
    lines.forEach((line, i) => {
      ctx.fillStyle = 'rgba(53,255,110,0.35)';
      ctx.fillText(line, 13, 28 + i * 22);
      ctx.fillStyle = '#35FF6E';
      ctx.fillText(line, 12, 26 + i * 22);
    });
    seat.texture.needsUpdate = true;
  }

  /** Printer paper: ruled sheet, dot-matrix dark ink lines. */
  function paintPaper(canvas, texture, text) {
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#F5F0E2';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'rgba(120,110,90,0.35)';
    for (let y = 30; y < canvas.height; y += 22) ctx.fillRect(10, y, canvas.width - 20, 1);
    ctx.fillStyle = 'rgba(38,34,30,0.85)';
    ctx.font = '14px monospace';
    const lines = String(text == null ? '' : text).split('\n').slice(-12);
    lines.forEach((line, i) => {
      ctx.fillText(line.slice(0, 28), 12, 26 + i * 22);
    });
    texture.needsUpdate = true;
  }

  /** A seat's printer prints its shared printer-buffer text onto the paper. */
  function updateGadget(seat, text) {
    paintPaper(seat.gadgetCanvas, seat.gadgetTexture, text);
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
