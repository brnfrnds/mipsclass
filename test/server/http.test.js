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

test('POST /rooms clamps seats to 1-10 and returns an operator token', async () => {
  const server = await start();
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    const post = (body) => fetch(`${base}/rooms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then((r) => r.json());

    const big = await post({ seatCount: 50, name: 'Ana' });
    assert.equal(big.seatCount, 10, 'over-cap seat count clamps to 10');
    assert.equal(typeof big.operatorToken, 'string');
    assert.ok(big.operatorToken.length > 0);

    const none = await post({});
    assert.equal(none.seatCount, 4, 'missing seat count defaults to 4');

    const zero = await post({ seatCount: 0 });
    assert.equal(zero.seatCount, 4, 'invalid seat count defaults to 4');
  } finally {
    server.close();
  }
});
