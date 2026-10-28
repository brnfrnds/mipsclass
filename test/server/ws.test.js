const { test } = require('node:test');
const assert = require('node:assert');
const { Room } = require('../../server/room');
const { handleMessage, drop } = require('../../server/ws');

function makeRooms() {
  const rooms = new Map();
  rooms.set('r1', new Room(4));
  return rooms;
}

function fakeWs() {
  const sent = [];
  const ws = { sent, readyState: 1, send: (m) => sent.push(JSON.parse(m)) };
  return ws;
}

function join(ws, rooms, roomId, seatIndex, name) {
  handleMessage(ws, rooms, { type: 'joinRoom', roomId, seatIndex, name });
  ws.sent.length = 0; // clear the joined echo
}

test('typing from one client is broadcast to the other client in the same room', () => {
  const rooms = makeRooms();
  const a = fakeWs();
  const b = fakeWs();
  join(a, rooms, 'r1', 0, 'Ada');
  join(b, rooms, 'r1', 1, 'Bob');
  a.sent.length = 0; b.sent.length = 0; // clear join-phase playerJoined broadcasts
  handleMessage(a, rooms, { type: 'typing', typing: true });
  assert.equal(b.sent.length, 1);
  assert.equal(b.sent[0].type, 'playerTyping');
  assert.equal(b.sent[0].seatIndex, 0);
  assert.equal(b.sent[0].typing, true);
  assert.equal(a.sent.length, 0);
});

test('typing false stops the peer animation', () => {
  const rooms = makeRooms();
  const a = fakeWs();
  const b = fakeWs();
  join(a, rooms, 'r1', 0, 'Ada');
  join(b, rooms, 'r1', 1, 'Bob');
  handleMessage(a, rooms, { type: 'typing', typing: false });
  assert.equal(b.sent.length, 1);
  assert.equal(b.sent[0].type, 'playerTyping');
  assert.equal(b.sent[0].typing, false);
});

test('blowUp broadcast includes seat index and reaches the peer', () => {
  const rooms = makeRooms();
  const a = fakeWs();
  const b = fakeWs();
  join(a, rooms, 'r1', 0, 'Ada');
  join(b, rooms, 'r1', 1, 'Bob');
  handleMessage(a, rooms, { type: 'blowUp' });
  assert.equal(b.sent.length, 1);
  assert.equal(b.sent[0].type, 'playerBlownUp');
  assert.equal(b.sent[0].seatIndex, 0);
});

test('cableMessage from seat A reaches only cabled seat B', () => {
  const rooms = makeRooms();
  const room = rooms.get('r1');
  room.cablePairs.push({ seatA: 0, seatB: 1, sharedMemory: { base: 0x1000, size: 256 } });
  const a = fakeWs();
  const b = fakeWs();
  const c = fakeWs();
  join(a, rooms, 'r1', 0, 'Ada');
  join(b, rooms, 'r1', 1, 'Bob');
  join(c, rooms, 'r1', 2, 'Cal');
  a.sent.length = 0; b.sent.length = 0; c.sent.length = 0; // clear join-phase broadcasts
  handleMessage(a, rooms, { type: 'cableMessage', payload: 'ping' });
  assert.equal(b.sent.length, 1);
  assert.equal(b.sent[0].type, 'cableMessage');
  assert.equal(b.sent[0].from, 0);
  assert.equal(b.sent[0].payload, 'ping');
  assert.equal(c.sent.length, 0);
});

test('gadgetUpdate updates room gadgetState and broadcasts to all in room', () => {
  const rooms = makeRooms();
  const room = rooms.get('r1');
  const a = fakeWs();
  const b = fakeWs();
  join(a, rooms, 'r1', 0, 'Ada');
  join(b, rooms, 'r1', 1, 'Bob');
  handleMessage(a, rooms, { type: 'gadgetUpdate', gadget: { printer: { text: 'HELLO' } } });
  assert.equal(room.gadgetState.printer.text, 'HELLO');
  assert.equal(b.sent.length, 1);
  assert.equal(b.sent[0].type, 'gadgetState');
  assert.equal(b.sent[0].gadgetState.printer.text, 'HELLO');
});

test('joinRoom broadcasts playerJoined to the other members of the room', () => {
  const rooms = makeRooms();
  const a = fakeWs();
  const b = fakeWs();
  join(a, rooms, 'r1', 0, 'Ada');
  join(b, rooms, 'r1', 1, 'Bob');
  const pj = a.sent.filter((m) => m.type === 'playerJoined');
  assert.equal(pj.length, 1, 'seated member should hear about the new player');
  assert.equal(pj[0].player.name, 'Bob');
  assert.equal(pj[0].player.seatIndex, 1);
});

test('drop frees the seat and broadcasts playerLeft to the remaining members', () => {
  const rooms = makeRooms();
  const a = fakeWs();
  const b = fakeWs();
  join(a, rooms, 'r1', 0, 'Ada');
  join(b, rooms, 'r1', 1, 'Bob');
  a.sent.length = 0;
  drop(a);
  assert.equal(rooms.get('r1').getState().seats[0], null, 'seat should be free again');
  const pl = b.sent.filter((m) => m.type === 'playerLeft');
  assert.equal(pl.length, 1, 'remaining member should hear about the departure');
  assert.equal(pl[0].seatIndex, 0);
});
