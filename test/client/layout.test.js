const { test } = require('node:test');
const assert = require('node:assert');
const { seatLayout } = require('../../public/js/layout.js');

test('10 seats: 5 per side facing each other, no overlap, table long enough', () => {
  const { seats, table } = seatLayout(10);
  assert.equal(seats.length, 10);
  const south = seats.filter((s) => s.z > 0);
  const north = seats.filter((s) => s.z < 0);
  assert.equal(south.length, 5);
  assert.equal(north.length, 5);
  south.forEach((s) => assert.equal(s.rot, 0));
  north.forEach((s) => assert.equal(s.rot, Math.PI));
  assert.equal(table.length, 10); // (5-1)*2.0 + 2*1.0
  assert.equal(table.depth, 3.2);
  const xs = south.map((s) => s.x).sort((a, b) => a - b);
  for (let i = 1; i < xs.length; i++) assert.ok(xs[i] - xs[i - 1] >= 1.9, 'place-settings do not overlap');
  for (const s of seats) {
    assert.ok(Math.abs(s.x) + 1.0 <= table.length / 2 + 1e-9, `seat ${s.index} within the table length`);
    assert.ok(Math.abs(s.z) <= table.depth / 2, `seat ${s.index} within the table depth`);
  }
});

test('9 seats: 4 per side plus one west end seat clear of the corner seat', () => {
  const { seats, table } = seatLayout(9);
  assert.equal(seats.length, 9);
  assert.equal(seats.filter((s) => s.z > 0).length, 4);
  assert.equal(seats.filter((s) => s.z < 0).length, 4);
  const end = seats.find((s) => s.z === 0);
  assert.ok(end, 'one end seat');
  assert.equal(end.rot, -Math.PI / 2);
  assert.ok(end.x < 0, 'west end');
  assert.deepEqual(end.cam.target, { x: 0, y: 0.95, z: 0 });
  assert.equal(table.length, 10.2); // (4-1)*2.0 + 2*1.0 + 2.2 end zone
  const nearest = Math.min(...seats.filter((s) => s.z !== 0).map((s) => Math.abs(s.x - end.x)));
  assert.ok(nearest >= 1.9, 'end seat clears the corner side seat');
});

test('1-4 seats: minimum table, no end seat for even counts, unique indices', () => {
  assert.equal(seatLayout(1).seats.length, 1);
  assert.equal(seatLayout(2).seats.length, 2);
  assert.equal(seatLayout(4).seats.length, 4);
  assert.equal(seatLayout(2).table.length, 3.6, 'two seats fit the minimum table');
  assert.equal(seatLayout(1).table.length, 4.2, 'one seat still reserves the end zone');
  assert.equal(seatLayout(4).table.length, 4.0);
  assert.ok(seatLayout(4).seats.every((s) => s.z !== 0), 'no end seat when even');
  const indices = seatLayout(10).seats.map((s) => s.index);
  assert.deepEqual(indices, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
});

test('side cameras sit behind the sitter and look across at the opposite seat', () => {
  const { seats } = seatLayout(10);
  const south = seats.find((s) => s.z > 0 && s.x === 0);
  const north = seats.find((s) => s.z < 0 && s.x === 0);
  assert.ok(south.cam.pos.z > south.z, 'camera is outward of the seat');
  assert.equal(south.cam.target.x, north.x);
  assert.equal(south.cam.target.z, north.z);
  assert.equal(south.cam.pos.y, 2.9);
  assert.equal(south.cam.target.y, 0.95);
});
