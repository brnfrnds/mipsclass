// 3D office: initialise the scene and one terminal per seat.
// The join overlay (index.html) sits on top until the player sits (Task 10).
(function () {
  const canvas = document.getElementById('canvas');
  if (!canvas) return;

  const { scene, camera, renderer } = initScene(canvas);

  const seats = [];
  const layout = [
    { x: -1.6, z: 1.15 },
    { x: -0.55, z: 1.15 },
    { x: 0.55, z: 1.15 },
    { x: 1.6, z: 1.15 },
  ];
  layout.forEach((pos, i) => {
    const seat = addSeat(scene, i, pos.x, pos.z);
    seats.push(seat);
    updateScreen(seat, `SEAT ${i + 1}\nREADY`);
  });

  animate();

  window.__officeSeats = seats;
  window.__officeScene = scene;
  window.__officeCamera = camera;

  /** Paint the shared gadget state summary on every seat's gadget sprite. */
  function refreshGadgetVisuals(model) {
    if (typeof updateGadget !== 'function') return;
    const last = (t) => { const p = String(t == null ? '' : t).split('\n'); return p[p.length - 1]; };
    const summary = `PRT: ${last(model.printer.text)}\nBRD: ${last(model.board.text)}`;
    seats.forEach((s) => updateGadget(s, summary));
  }

  // App wiring (ES modules: net client, gadgets, MIPS editor, remote players).
  Promise.all([
    import('./js/net.js'),
    import('./js/gadgets.js'),
    import('./js/editor.js'),
    import('./js/players.js'),
  ]).then(([net, gadgets, { mountEditor }, players]) => {
    players.initPlayers({ scene, seats });

    // Remote player events (server is the source of truth).
    net.on('playerJoined', (m) => players.add(m.player));
    net.on('playerLeft', (m) => players.remove(m.seatIndex));
    net.on('playerTyping', (m) => players.setTyping(m.seatIndex, m.typing));
    net.on('playerBlownUp', (m) => players.explode(m.seatIndex));

    // Local gadget writes: instant 3D feedback (gadgets.js already reports to the server).
    gadgets.onWrite((key, model) => refreshGadgetVisuals(model));

    // Server broadcasts (own echo + other players): merge and repaint.
    net.on('gadgetState', (m) => {
      gadgets.applyState(m.gadgetState);
      refreshGadgetVisuals(gadgets.getModel());
    });

    mountEditor({ container: document.body });
  }).catch((err) => console.error('app wiring failed:', err));
})();
