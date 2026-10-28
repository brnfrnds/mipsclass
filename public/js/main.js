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

  // Expose for later tasks (net/players/gadgets/editor wiring).
  window.__officeSeats = seats;
  window.__officeScene = scene;
  window.__officeCamera = camera;
})();
