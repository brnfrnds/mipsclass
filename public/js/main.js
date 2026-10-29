// 3D office: initialise the scene and one terminal per seat.
// The join overlay (index.html) sits on top until the player sits (Task 10).
(function () {
  const canvas = document.getElementById('canvas');
  if (!canvas) return;

  const { scene, camera, renderer, board } = initScene(canvas);

  const seats = [];
  const layout = [
    { x: -2.2, z: 1.7, rot: 0.3 },
    { x: -0.75, z: 1.25, rot: 0.1 },
    { x: 0.75, z: 1.25, rot: -0.1 },
    { x: 2.2, z: 1.7, rot: -0.3 },
  ];
  layout.forEach((pos, i) => {
    const seat = addSeat(scene, i, pos.x, pos.z);
    if (seat.group.rotation) seat.group.rotation.y = pos.rot;
    seats.push(seat);
    updateScreen(seat, `TERMINAL ${i + 1}\nREADY_`);
  });

  animate();

  window.__officeSeats = seats;
  window.__officeScene = scene;
  window.__officeCamera = camera;

  /** Printer text prints on every seat's paper; board text hits the wall board. */
  function refreshGadgetVisuals(model) {
    const printerText = model.printer.text || '';
    const boardText = model.board.text || '';
    seats.forEach((s) => updateGadget(s, printerText));
    if (board && board.paint) board.paint(boardText);
  }

  // ---- Join screen flow ----
  function wireJoinUI(net, players) {
    const $ = (id) => document.getElementById(id);
    const joinEl = $('join'), hudEl = $('hud'), seatsEl = $('seats'), msgEl = $('msg');
    const roomIdInput = $('roomId');
    let selectedSeat = null;
    let currentRoomId = null;

    function renderSeats(count, takenArr) {
      seatsEl.innerHTML = '';
      selectedSeat = null;
      $('btnSit').disabled = true;
      for (let i = 0; i < count; i++) {
        const cell = document.createElement('div');
        cell.className = 'seat' + (takenArr[i] ? ' taken' : '');
        cell.textContent = String(i + 1);
        if (!takenArr[i]) {
          cell.onclick = () => {
            Array.from(seatsEl.children).forEach((c) => c.classList.remove('selected'));
            cell.classList.add('selected');
            selectedSeat = i;
            $('btnSit').disabled = false;
          };
        }
        seatsEl.appendChild(cell);
      }
    }

    async function loadRoom(id) {
      const res = await fetch(`/rooms/${id}`);
      if (!res.ok) { msgEl.textContent = 'Room not found'; return; }
      const state = await res.json();
      currentRoomId = id;
      roomIdInput.value = id;
      renderSeats(state.seatCount, state.seats);
      msgEl.textContent = '';
    }

    $('btnCreate').onclick = async () => {
      const seatCount = parseInt($('seatCount').value, 10) || 4;
      const res = await fetch('/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seatCount }),
      });
      const { roomId } = await res.json();
      await loadRoom(roomId);
    };

    $('btnJoin').onclick = () => {
      const id = roomIdInput.value.trim();
      if (id) loadRoom(id);
    };

    $('btnSit').onclick = () => {
      if (selectedSeat === null || !currentRoomId) return;
      net.send({
        type: 'joinRoom',
        roomId: currentRoomId,
        seatIndex: selectedSeat,
        name: $('playerName').value || 'Operator',
        profilePictureUrl: $('profilePic').value,
      });
    };

    net.on('joined', (m) => {
      joinEl.classList.add('hidden');
      hudEl.classList.remove('hidden');
      $('seatNum').textContent = String(m.player.seatIndex + 1);
      $('hudName').textContent = m.player.name || 'Operator';
      players.add(m.player); // own sprite too
    });

    net.on('error', (m) => {
      msgEl.textContent = m.error === 'seatTaken'
        ? 'That seat was just taken — pick another.'
        : `Join failed: ${m.error}`;
    });
  }

  // App wiring (ES modules: net client, gadgets, MIPS editor, remote players).
  Promise.all([
    import('./net.js'),
    import('./gadgets.js'),
    import('./editor.js'),
    import('./players.js'),
  ]).then(([net, gadgets, { mountEditor }, players]) => {
    net.connect();

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

    wireJoinUI(net, players);

    // Editor starts hidden; it opens when you sit, and the HUD has a toggle.
    const editor = mountEditor({ container: document.body });
    editor.hide();
    net.on('joined', () => editor.show());
    const hudBtn = document.createElement('button');
    hudBtn.className = 'hud-editor-btn';
    hudBtn.textContent = 'Editor';
    hudBtn.onclick = () => editor.show();
    document.getElementById('hud').appendChild(hudBtn);
  }).catch((err) => console.error('app wiring failed:', err));
})();
