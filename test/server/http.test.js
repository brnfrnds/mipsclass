const { test } = require('node:test');
const assert = require('node:assert');
const { createServer } = require('../../server/index.js');

async function start() {
  const server = createServer({ port: 0 });
  if (!server.listening) await new Promise((r) => server.once('listening', r));
  return server;
}

test('POST /rooms creates a room and GET /rooms/:id returns its seat state', async () => {
  const server = await start();
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    const res = await fetch(`${base}/rooms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ seatCount: 4 }),
    });
    assert.equal(res.status, 200);
    const { roomId, seatCount } = await res.json();
    assert.ok(roomId, 'roomId returned');
    assert.equal(seatCount, 4);

    const res2 = await fetch(`${base}/rooms/${roomId}`);
    assert.equal(res2.status, 200);
    const state = await res2.json();
    assert.equal(state.seatCount, 4);
    assert.deepEqual(state.seats, [null, null, null, null]);

    const res3 = await fetch(`${base}/rooms/does-not-exist`);
    assert.equal(res3.status, 404, 'unknown room is a 404');
  } finally {
    server.close();
  }
});
