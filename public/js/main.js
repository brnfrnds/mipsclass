// 3D office: a rectangular conference table sized for the room's seat count,
// one terminal per seat, and a camera that glides to your seat when you sit down.
(function () {
  const canvas = document.getElementById('canvas');
  if (!canvas) return;

  const { scene, camera, board } = initScene(canvas);

  let layout = [];
  let seats = [];
  let buildOffice = null; // assigned inside the app wiring

  animate();

  window.__officeSeats = seats;
  window.__officeScene = scene;
  window.__officeCamera = camera;

  let mySeatIndex = null; // your seat — set when you sit down; papers are private

  /** Your printout paints only YOUR seat's paper; board text hits the wall board. */
  function refreshGadgetVisuals(model) {
    const printerText = model.printer.text || '';
    const boardText = model.board.text || '';
    if (mySeatIndex !== null) {
      const mySeat = seats.find((s) => s.seatIndex === mySeatIndex);
      if (mySeat) updateGadget(mySeat, printerText);
    }
    if (board && board.paint) board.paint(boardText);
  }

  // ---- Join screen flow ----
  function wireJoinUI(net, players, onRoomLoaded) {
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
      onRoomLoaded(state.seatCount);
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

    net.on('error', (m) => {
      msgEl.textContent = m.error === 'seatTaken'
        ? 'That seat was just taken — pick another.'
        : `Join failed: ${m.error}`;
    });
  }

  // App wiring (ES modules: net, gadgets, editor, staff, reference, sound).
  Promise.all([
    import('./net.js'),
    import('./gadgets.js'),
    import('./editor.js'),
    import('./players.js'),
    import('./reference.js'),
    import('./sound.js'),
  ]).then(([net, gadgets, { mountEditor }, players, { mountReference }, sound]) => {
    net.connect();

    // browsers start the AudioContext suspended until a gesture
    const wake = () => sound.resumeAudio();
    document.addEventListener('click', wake, { once: true });
    document.addEventListener('keydown', wake, { once: true });

    const ref = mountReference({ container: document.body });

    function sitDown(player) {
      // Your camera glides behind your own avatar — the whole table in view.
      const spot = layout[player.seatIndex] || layout[0];
      if (typeof setCameraAnchor === 'function') setCameraAnchor(spot.cam.pos, spot.cam.target);
      mySeatIndex = player.seatIndex;
      document.getElementById('join').classList.add('hidden');
      document.getElementById('hud').classList.remove('hidden');
      document.getElementById('seatNum').textContent = String(player.seatIndex + 1);
      document.getElementById('hudName').textContent = player.name || 'Operator';
    }

    net.on('joined', (m) => {
      sitDown(m.player);
      players.add(m.player, { isSelf: true });
      // everyone who joined before you takes their seat around the table
      (m.state.players || []).forEach((p) => {
        if (p.id !== m.player.id) players.add(p);
      });
      // and the office hardware is in the state the room left it
      if (m.state.gadgetState) {
        gadgets.applyState(m.state.gadgetState);
        refreshGadgetVisuals(gadgets.getModel());
      }
    });
    net.on('playerJoined', (m) => players.add(m.player));
    net.on('playerLeft', (m) => players.remove(m.seatIndex));
    net.on('playerTyping', (m) => players.setTyping(m.seatIndex, m.typing));
    net.on('playerBlownUp', (m) => {
      players.explode(m.seatIndex);
      sound.boom();
    });

    // Local gadget writes: instant 3D feedback (gadgets.js already reports to the server).
    gadgets.onWrite((key, model) => refreshGadgetVisuals(model));

    // Server broadcasts (own echo + other players): merge and repaint.
    net.on('gadgetState', (m) => {
      gadgets.applyState(m.gadgetState);
      refreshGadgetVisuals(gadgets.getModel());
    });

    buildOffice = function (seatCount) {
      seats.forEach((s) => scene.remove(s.group));
      const built = seatLayout(seatCount);
      const dims = buildTable(built.table.length, built.table.depth);
      seats = built.seats.map((spot) => {
        const seat = addSeat(scene, spot.index, spot.x, spot.z);
        seat.group.rotation.y = spot.rot;
        seat.group.position.y = dims.top;
        updateScreen(seat, `TERMINAL ${spot.index + 1}\nREADY_`);
        return seat;
      });
      layout = built.seats;
      window.__officeSeats = seats;
      players.initPlayers({ scene, seats, tableTop: dims.top, table: dims });
    };

    wireJoinUI(net, players, buildOffice);

    // Editor starts hidden; it opens when you sit, and the HUD has toggles.
    const editor = mountEditor({ container: document.body, teletype: true });
    editor.hide();
    editor.onRef = () => ref.toggle();
    net.on('joined', () => editor.show());
    net.on('joined', (m) => { if (m.operator) editor.setOperator(); });
    // when YOUR machine explodes under your fingers: flames on the terminal
    net.on('playerBlownUp', (m) => {
      if (m.seatIndex === mySeatIndex) editor.flashFlames();
    });
    const hudBtn = document.createElement('button');
    hudBtn.className = 'hud-editor-btn';
    hudBtn.textContent = 'Editor';
    hudBtn.onclick = () => editor.show();
    document.getElementById('hud').appendChild(hudBtn);

    // your CRT mirrors your terminal's glass
    editor.onGlass = (rows) => {
      const my = seats.find((s) => s.seatIndex === mySeatIndex);
      if (my) updateScreen(my, rows.join('\n'));
    };

    const refBtn = document.createElement('button');
    refBtn.className = 'hud-editor-btn';
    refBtn.textContent = 'Reference';
    refBtn.style.top = '58px';
    refBtn.onclick = () => ref.toggle();
    document.getElementById('hud').appendChild(refBtn);

    const muteBtn = document.createElement('button');
    muteBtn.className = 'hud-editor-btn';
    muteBtn.textContent = 'Sound: On';
    muteBtn.style.top = '100px';
    muteBtn.onclick = () => {
      const m = !sound.isMuted();
      sound.setMuted(m);
      muteBtn.textContent = m ? 'Sound: Off' : 'Sound: On';
    };
    document.getElementById('hud').appendChild(muteBtn);
  }).catch((err) => console.error('app wiring failed:', err));
})();
