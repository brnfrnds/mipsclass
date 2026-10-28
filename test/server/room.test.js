const { test } = require('node:test');
const assert = require('node:assert');

test('Room.join assigns a free seat and returns the player object', () => {
  const { Room } = require('../../server/room');
  const room = new Room(4);
  const res = room.join(0, { id: 'p1', name: 'Ada', profilePictureUrl: 'https://ex.io/a.png' });
  assert.equal(res.ok, true);
  assert.equal(res.player.seatIndex, 0);
  assert.equal(res.player.name, 'Ada');
  assert.equal(room.getState().seats[0], 'p1');
  assert.equal(room.getState().players.get('p1').name, 'Ada');
});

test('Room.join on an occupied seat returns {error: seatTaken}', () => {
  const { Room } = require('../../server/room');
  const room = new Room(2);
  room.join(1, { id: 'p1', name: 'Ada' });
  const res = room.join(1, { id: 'p2', name: 'Bob' });
  assert.equal(res.ok, undefined);
  assert.equal(res.error, 'seatTaken');
  assert.equal(room.getState().seats[1], 'p1');
});

test('Room.join out of range seat returns error', () => {
  const { Room } = require('../../server/room');
  const room = new Room(2);
  const res = room.join(5, { id: 'p1', name: 'Ada' });
  assert.equal(res.error, 'outOfRange');
});

test('Room.leave frees the seat and removes the player', () => {
  const { Room } = require('../../server/room');
  const room = new Room(2);
  room.join(0, { id: 'p1', name: 'Ada' });
  room.leave('p1');
  assert.equal(room.getState().seats[0], null);
  assert.equal(room.getState().players.size, 0);
});

test('Room.getState returns gadgetState and cablePairs', () => {
  const { Room } = require('../../server/room');
  const room = new Room(2);
  const state = room.getState();
  assert.equal(state.gadgetState.printer.text, '');
  assert.equal(state.gadgetState.board.text, '');
  assert.deepEqual(state.cablePairs, []);
});

test('Room.setGadget merges into gadgetState without clobbering sibling keys', () => {
  const { Room } = require('../../server/room');
  const room = new Room(2);
  room.setGadget('printer', { text: 'HELLO' });
  const state = room.getState();
  assert.equal(state.gadgetState.printer.text, 'HELLO');
  assert.equal(state.gadgetState.printer.online, true);
  assert.equal(state.gadgetState.board.text, '');
});

test('Room.addCablePair and getCablePeer', () => {
  const { Room } = require('../../server/room');
  const room = new Room(4);
  room.addCablePair(0, 1, { base: 0x1000, size: 256 });
  assert.equal(room.getCablePeer(0), 1);
  assert.equal(room.getCablePeer(1), 0);
  assert.equal(room.getCablePeer(2), null);
  assert.deepEqual(room.cablePairs[0].sharedMemory, { base: 0x1000, size: 256 });
});
