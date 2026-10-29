(function (global) {
  const THREE = global.THREE;
  const document = global.document;

  let scene, camera, renderer;

  // The office palette: beige plastic, teak veneer, brown carpet, and the
  // two phosphors of the age — green terminals, amber bulletin board.
  const PALETTE = {
    night: 0x171310,
    carpet: '#4a4136',
    plaster: 0xD6CCB4,
  };

  // The round conference table. Terminal place-settings sit on it; the
  // radii for terminals, sitters and cameras live in main.js and are
  // derived from these by trigonometry, not guesswork.
  const TABLE = {
    radius: 1.9,
    top: 1.06, // world y of the tabletop surface
  };

  let camTarget = { x: 0, y: 1.0, z: 0 };
  let camGoal = null; // { pos: {x,y,z}, target: {x,y,z} }

  function makeCanvasTexture(w, h, painter, repeatX, repeatY) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    painter(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    if (THREE.RepeatWrapping !== undefined) {
      t.wrapS = THREE.RepeatWrapping;
      t.wrapT = THREE.RepeatWrapping;
      if (repeatX) t.repeat.set(repeatX, repeatY || repeatX);
    }
    return t;
  }

  function paintCarpet(ctx, w, h) {
    ctx.fillStyle = PALETTE.carpet;
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) {
      const tone = 58 + Math.random() * 26;
      ctx.fillStyle = `rgb(${tone | 0},${(tone * 0.88) | 0},${(tone * 0.72) | 0})`;
      ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
  }

  function paintWood(ctx, w, h) {
    ctx.fillStyle = '#7a4f26';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 26; i++) {
      ctx.fillStyle = `rgba(40,24,8,${0.08 + Math.random() * 0.14})`;
      ctx.fillRect(0, Math.random() * h, w, 1 + Math.random() * 2.5);
    }
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = `rgba(255,220,160,${0.03 + Math.random() * 0.05})`;
      ctx.fillRect(Math.random() * w, 0, 1, h);
    }
  }

  function box(w, h, d, material, x, y, z) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    m.position.set(x, y, z);
    return m;
  }

  /** The signature: the office bulletin board, amber phosphor, shared state. */
  function makeWallBoard(x, y, z, w, h) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 176;
    const texture = new THREE.CanvasTexture(canvas);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: texture }));
    mesh.position.set(x, y, z);
    scene.add(mesh);

    function paint(text) {
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#171008';
      ctx.fillRect(0, 0, 512, 176);
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      for (let yy = 0; yy < 176; yy += 4) ctx.fillRect(0, yy, 512, 1);
      ctx.fillStyle = '#FFB000';
      ctx.font = 'bold 22px monospace';
      ctx.fillText('OFFICE BULLETIN — MIPS DIVISION', 16, 30);
      ctx.fillStyle = 'rgba(255,176,0,0.5)';
      ctx.fillRect(16, 42, 480, 2);
      ctx.font = '26px monospace';
      const lines = String(text == null ? '' : text).split('\n').slice(0, 4);
      lines.forEach((line, i) => {
        ctx.fillText(line.slice(0, 36), 16, 78 + i * 30);
      });
      texture.needsUpdate = true;
    }

    paint('');
    return { canvas, texture, paint, mesh };
  }

  function initScene(canvasEl) {
    const width = (canvasEl && canvasEl.clientWidth) || (global.innerWidth || 800);
    const height = (canvasEl && canvasEl.clientHeight) || (global.innerHeight || 600);

    scene = new THREE.Scene();
    scene.background = new THREE.Color(PALETTE.night);
    if (THREE.Fog) scene.fog = new THREE.Fog(PALETTE.night, 11, 26);

    camera = new THREE.PerspectiveCamera(55, width / height, 0.1, 100);
    camera.position.set(0, 3.4, 7.2);
    camera.lookAt(0, 1.0, 0);

    renderer = new THREE.WebGLRenderer({ canvas: canvasEl, antialias: true });
    renderer.setSize(width, height);
    if (renderer.shadowMap) renderer.shadowMap.enabled = true;
    if (THREE.ACESFilmicToneMapping !== undefined) {
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.05;
    }

    // Lighting: one warm fluorescent key, a cool window fill, ambient bounce.
    scene.add(new THREE.HemisphereLight(0xEAD9B0, 0x3A2E1E, 0.9));
    const key = new THREE.DirectionalLight(0xFFE7C0, 1.15);
    key.position.set(3.5, 6.5, 4.5);
    if ('castShadow' in key) key.castShadow = true;
    if (key.shadow && key.shadow.mapSize && key.shadow.mapSize.set) key.shadow.mapSize.set(1024, 1024);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0x8FA3B8, 0.28);
    fill.position.set(-4, 3, -3.5);
    scene.add(fill);

    const room = new THREE.Group();

    // carpet
    const floor = box(
      14, 0.2, 14,
      new THREE.MeshStandardMaterial({ map: makeCanvasTexture(128, 128, paintCarpet, 8, 8), roughness: 1 }),
      0, -0.1, 0
    );
    if ('receiveShadow' in floor) floor.receiveShadow = true;
    room.add(floor);

    // back wall: teak paneling below, plaster above
    const wood = new THREE.MeshStandardMaterial({ map: makeCanvasTexture(256, 128, paintWood, 3, 1), roughness: 0.85 });
    const plaster = new THREE.MeshStandardMaterial({ color: PALETTE.plaster, roughness: 0.95 });
    room.add(box(14, 1.15, 0.2, wood, 0, 0.575, -6.1));
    room.add(box(14, 2.9, 0.2, plaster, 0, 2.55, -6.1));

    // side walls
    room.add(box(0.2, 4, 12, plaster, -7.1, 2, -0.2));
    room.add(box(0.2, 4, 12, plaster, 7.1, 2, -0.2));

    // ceiling + fluorescent panel
    room.add(box(14, 0.2, 12, new THREE.MeshStandardMaterial({ color: 0x2E2820, roughness: 1 }), 0, 4.1, -0.2));
    const tube = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 1.1), new THREE.MeshBasicMaterial({ color: 0xFFF4D8 }));
    tube.position.set(0, 3.99, 0.4);
    if (tube.rotation) tube.rotation.x = Math.PI / 2;
    room.add(tube);

    // window with venetian blinds, warm afternoon glow behind them
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.7), new THREE.MeshBasicMaterial({ color: 0xFFE0A8 }));
    glow.position.set(3.6, 2.3, -5.97);
    room.add(glow);
    const slat = new THREE.MeshStandardMaterial({ color: 0xD8CCAE, roughness: 0.9 });
    for (let i = 0; i < 7; i++) {
      room.add(box(2.5, 0.09, 0.03, slat, 3.6, 1.62 + i * 0.2, -5.9));
    }

    // the signature board on the wall
    const board = makeWallBoard(-3.2, 2.45, -5.97, 5.2, 1.8);

    // the round conference table — everyone gathers around it
    const tableWood = new THREE.MeshStandardMaterial({
      map: makeCanvasTexture(256, 128, paintWood, 2, 2),
      roughness: 0.6,
    });
    const pedestalMat = new THREE.MeshStandardMaterial({ color: 0x4A4038, roughness: 0.7, });
    const top = new THREE.Mesh(new THREE.CylinderGeometry(TABLE.radius, TABLE.radius, 0.08, 44), tableWood);
    top.position.y = TABLE.top - 0.04;
    if ('castShadow' in top) { top.castShadow = true; top.receiveShadow = true; }
    room.add(top);
    const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, TABLE.top - 0.08, 20), pedestalMat);
    pedestal.position.y = (TABLE.top - 0.08) / 2;
    room.add(guarded(pedestal));
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.82, 0.06, 24), pedestalMat);
    base.position.y = 0.03;
    room.add(guarded(base));

    // keep the buffer sized to the window (and follow resizes)
    wireResize(canvasEl);

    scene.add(room);
    return { scene, camera, renderer, board, table: TABLE };
  }

  /** Keep the render buffer and camera framed to the live window size. */
  function wireResize(canvasEl) {
    function onResize() {
      const w = (canvasEl && canvasEl.clientWidth) || (global.innerWidth || 800);
      const h = (canvasEl && canvasEl.clientHeight) || (global.innerHeight || 600);
      camera.aspect = w / h;
      if (camera.updateProjectionMatrix) camera.updateProjectionMatrix();
      renderer.setSize(w, h, false); // buffer only — CSS already stretches the canvas
    }
    if (global.addEventListener) global.addEventListener('resize', onResize);
    onResize(); // sync once at boot
  }

  function guarded(mesh) {
    if ('castShadow' in mesh) mesh.castShadow = true;
    return mesh;
  }

  /**
   * Give the camera a seat: it glides to `pos` and keeps `target` in view.
   * Used when an operator sits down so they see the whole table.
   */
  function setCameraAnchor(pos, target) {
    camGoal = { pos, target };
  }

  function animate() {
    global.requestAnimationFrame(animate);
    if (camGoal) {
      const damp = 0.07;
      if (camera.position.lerp && THREE.Vector3) {
        camera.position.lerp(new THREE.Vector3(camGoal.pos.x, camGoal.pos.y, camGoal.pos.z), damp);
      } else {
        camera.position.set(camGoal.pos.x, camGoal.pos.y, camGoal.pos.z);
      }
      camTarget.x += (camGoal.target.x - camTarget.x) * damp;
      camTarget.y += (camGoal.target.y - camTarget.y) * damp;
      camTarget.z += (camGoal.target.z - camTarget.z) * damp;
      camera.lookAt(camTarget.x, camTarget.y, camTarget.z);
    }
    renderer.render(scene, camera);
  }

  const mod = { initScene, animate, setCameraAnchor };
  if (typeof module === 'object' && module.exports) {
    module.exports = mod;
  } else {
    global.initScene = initScene;
    global.animate = animate;
    global.setCameraAnchor = setCameraAnchor;
  }
})(typeof window !== 'undefined' ? window : global);
