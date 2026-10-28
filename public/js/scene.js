(function (global) {
  const THREE = global.THREE;
  const document = global.document;

  let scene, camera, renderer;

  function initScene(canvasEl) {
    const width = (canvasEl && canvasEl.clientWidth) || (global.innerWidth || 800);
    const height = (canvasEl && canvasEl.clientHeight) || (global.innerHeight || 600);

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a1a);

    camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 100);
    camera.position.set(0, 2.2, 5);
    camera.lookAt(0, 0, 0);

    renderer = new THREE.WebGLRenderer({ canvas: canvasEl, antialias: true });
    renderer.setSize(width, height);

    const room = new THREE.Group();

    // floor
    const floor = new THREE.Mesh(
      new THREE.BoxGeometry(12, 0.2, 12),
      new THREE.MeshStandardMaterial({ color: 0x222222 })
    );
    floor.position.y = -0.1;
    room.add(floor);

    // center table
    const table = new THREE.Mesh(
      new THREE.BoxGeometry(3, 0.6, 1.6),
      new THREE.MeshStandardMaterial({ color: 0x6b3e1e })
    );
    table.position.y = 0.8;
    room.add(table);

    // back wall
    const back = new THREE.Mesh(
      new THREE.BoxGeometry(12, 4, 0.2),
      new THREE.MeshStandardMaterial({ color: 0x2a2a2a })
    );
    back.position.set(0, 1.9, -6.1);
    room.add(back);

    scene.add(room);
    return { scene, camera, renderer };
  }

  function animate() {
    global.requestAnimationFrame(animate);
    renderer.render(scene, camera);
  }

  const mod = { initScene, animate };
  if (typeof module === 'object' && module.exports) {
    module.exports = mod;
  } else {
    global.initScene = initScene;
    global.animate = animate;
  }
})(typeof window !== 'undefined' ? window : global);
