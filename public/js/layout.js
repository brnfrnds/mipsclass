(function (global) {
  // Geometry of the rectangular conference table. The long axis runs
  // west–east (x); operators sit in two rows along the long sides, plus one
  // optional seat at the west end for odd counts.
  const TABLE_TOP = 1.06;
  const TABLE_DEPTH = 3.2;
  const SEAT_PITCH = 2.0;
  const SEAT_INSET = 0.8;
  const TABLE_END_MARGIN = 1.0;
  const END_ZONE = 2.2; // room reserved west of the side rows for the end seat
  const CAMERA_BACK = 2.3;
  const CAMERA_HEIGHT = 2.9;
  const TARGET_HEIGHT = 0.95;
  const MIN_LENGTH = 3.6;

  /**
   * Lay out `seatCount` seats around a rectangular table.
   * Seat order is index order: south row, then north row, then the west end
   * seat (odd counts only). South seats face north (rot 0), north seats face
   * south (rot π), and the end seat faces east (rot -π/2).
   */
  function seatLayout(seatCount) {
    const perSide = Math.floor(seatCount / 2);
    const hasEnd = seatCount % 2 === 1;
    const sideSpan = Math.max(0, perSide - 1) * SEAT_PITCH;
    const length = Math.max(
      MIN_LENGTH,
      sideSpan + 2 * TABLE_END_MARGIN + (hasEnd ? END_ZONE : 0)
    );
    const depth = TABLE_DEPTH;
    // Shift the side rows east so the west end seat clears the corner seat.
    const xShift = hasEnd ? END_ZONE / 2 : 0;

    const sideZ = depth / 2 - SEAT_INSET;
    const seats = [];

    // South row, facing north across the table.
    for (let i = 0; i < perSide; i++) {
      const x = (i - (perSide - 1) / 2) * SEAT_PITCH + xShift;
      const z = sideZ;
      seats.push({
        index: seats.length,
        x,
        z,
        rot: 0,
        cam: {
          pos: { x, y: CAMERA_HEIGHT, z: z + CAMERA_BACK },
          target: { x, y: TARGET_HEIGHT, z: -sideZ },
        },
      });
    }

    // North row, facing south across the table.
    for (let i = 0; i < perSide; i++) {
      const x = (i - (perSide - 1) / 2) * SEAT_PITCH + xShift;
      const z = -sideZ;
      seats.push({
        index: seats.length,
        x,
        z,
        rot: Math.PI,
        cam: {
          pos: { x, y: CAMERA_HEIGHT, z: z - CAMERA_BACK },
          target: { x, y: TARGET_HEIGHT, z: sideZ },
        },
      });
    }

    // West end seat, facing east down the table.
    if (hasEnd) {
      const x = -(length / 2 - SEAT_INSET);
      seats.push({
        index: seats.length,
        x,
        z: 0,
        rot: -Math.PI / 2,
        cam: {
          pos: { x: x - CAMERA_BACK, y: CAMERA_HEIGHT, z: 0 },
          target: { x: 0, y: TARGET_HEIGHT, z: 0 },
        },
      });
    }

    return { table: { length, depth, top: TABLE_TOP }, seats };
  }

  const mod = {
    seatLayout, TABLE_TOP, TABLE_DEPTH, SEAT_PITCH, SEAT_INSET,
    TABLE_END_MARGIN, END_ZONE, CAMERA_BACK, CAMERA_HEIGHT, TARGET_HEIGHT, MIN_LENGTH,
  };
  if (typeof module === 'object' && module.exports) module.exports = mod;
  else global.seatLayout = seatLayout;
})(typeof window !== 'undefined' ? window : global);
