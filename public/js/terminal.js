(function (global) {
  const THREE = global.THREE;
  const document = global.document;

  // Heights are relative to the tabletop surface, which the seat group's
  // origin sits on (main.js places the group and picks the world spot).
  const DESK = 0; // group origin = tabletop surface

  function addSeat(scene, index, x, z) {
    const group = new THREE.Group();
    group.position.set(x, DESK, z);

    const beige = new THREE.MeshStandardMaterial({ color: 0xD6CCB4, roughness: 0.7 });
    const beigeDark = new THREE.MeshStandardMaterial({ color: 0xC2B79D, roughness: 0.75 });
    const carbon = new THREE.MeshStandardMaterial({ color: 0x201C18, roughness: 0.6 });

    function guarded(mesh) {
      if ('castShadow' in mesh) mesh.castShadow = true;
      return mesh;
    }
    function at(mesh, x, y, z) { mesh.position.set(x, y, z); return mesh; }

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
    crt.add(guarded(at(new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.8, 0.62), beige), 0, 0.4, 0)));
    crt.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.66, 0.05), carbon), 0, 0.42, 0.3));
    screen.position.set(0, 0.42, 0.335);
    crt.add(screen);
    crt.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.035, 0.02), new THREE.MeshBasicMaterial({ color: 0x35FF6E })), 0.4, 0.13, 0.315));
    for (let i = 0; i < 4; i++) {
      crt.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.01, 0.02), carbon), 0, 0.805, 0.12 + i * 0.09));
    }
    crt.position.set(0, 0, -0.18); // casing base rests on the tabletop
    group.add(crt);

    // --- keyboard in front of the sitter, on the table ---
    const keyboard = at(new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.05, 0.42), beigeDark), 0, 0.025, 0.52);
    group.add(guarded(keyboard));
    const keyRow = new THREE.MeshStandardMaterial({ color: 0x2E2A24, roughness: 0.55 });
    for (let r = 0; r < 3; r++) {
      group.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.025, 0.07), keyRow), 0, 0.055, 0.4 + r * 0.11));
    }
    group.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.025, 0.07), keyRow), 0, 0.055, 0.73));

    // --- gadget: a dot-matrix printer printing onto a real paper sheet ---
    const gadgetCanvas = document.createElement('canvas');
    gadgetCanvas.width = 256;
    gadgetCanvas.height = 320;
    const gadgetTexture = new THREE.CanvasTexture(gadgetCanvas);
    const gadget = guarded(at(new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.3, 0.42), beige), 0.72, 0.15, 0.1));
    group.add(gadget);
    group.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.02, 0.04), carbon), 0.72, 0.3, 0.1));
    const paper = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.34), new THREE.MeshBasicMaterial({ map: gadgetTexture }));
    paper.position.set(0.72, 0.47, -0.08);
    group.add(paper);

    // --- desk props: coffee mug, loose papers ---
    if (THREE.CylinderGeometry) {
      const mug = guarded(at(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.045, 0.1, 12), new THREE.MeshStandardMaterial({ color: 0xB4552E, roughness: 0.6 })), -0.62, 0.05, 0.42));
      group.add(mug);
    }
    const paperMat = new THREE.MeshStandardMaterial({ color: 0xF2ECDC, roughness: 0.9 });
    const sheet1 = at(new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.3), paperMat), -0.55, 0.005, -0.1);
    if (sheet1.rotation) sheet1.rotation.x = -Math.PI / 2;
    group.add(sheet1);
    const sheet2 = at(new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.3), paperMat), -0.48, 0.012, -0.06);
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
