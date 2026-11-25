# Office UX & Seat Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let up to 10 players discover rooms in a lobby, sit around a room-sized rectangular table, and look left/right from their seat — with the room opener (not the first sitter) holding operator powers.

**Architecture:** Server keeps in-memory rooms; add an operator token at creation, a `GET /rooms` summary endpoint, and token-based operator checks in the WebSocket layer. Client gains a pure `seatLayout()` module, a rectangular-table builder and camera-yaw API in `scene.js`, a room-driven `buildOffice()` in `main.js`, and a lobby list in the join memo.

**Tech Stack:** Node 18+ (`node:test`, `ws`), vanilla browser JS, Three.js 0.160 global build, no new dependencies.

**Spec:** `docs/superpowers/specs/2026-11-24-office-ux-redesign-design.md`

## Global Constraints

- Seat count is **1–10**; missing/invalid seat count on creation means **4**; UI default is 4.
- The **room opener** is the operator: `POST /rooms` returns a secret `operatorToken`; only the joining player presenting it gets `KILL`/`BUMP` and the operator queue.
- Rooms are memory-only. The only client persistence is the operator token in `sessionStorage`, keyed `mipsOperatorToken:<roomId>`.
- Table is rectangular: two rows facing each other, 5 + 5 at ten seats; odd counts add one seat at the **west short end**; table length scales with seats.
- Look controls are **ArrowLeft / ArrowRight**, held, clamped to **±70°**, eased back to centre on release, and disabled while the terminal editor is open.
- Existing suite must stay green: `npm test` (`node --test`), currently 78 tests.

## Review Focus

1. **Ten seats:** adjacent place-settings must not overlap; seat pitch must exceed the ~1.65-wide place-setting.
2. **Odd seat counts:** exactly one end seat, facing the table, camera aimed at the table centre.
3. **Tiny rooms (1–4 seats):** no crash, minimum table length, no stray end seat for even counts.
4. **Switching rooms:** rebuilding the office removes the old terminals/avatars before creating new ones (no duplicates).
5. **Host identity:** only the token holder is operator; absent/wrong token is not; a refreshed host can re-present the stored token.

---

### Task 1: Server — operator identity at room creation

**Files:**
- Modify: `server/room.js`
- Modify: `server/index.js` (`POST /rooms` handler)
- Test: `test/server/room.test.js`, `test/server/http.test.js`

**Interfaces:**
- Consumes: nothing new.
- Produces:
  - `new Room(seatCount, opts = {})` — `opts.operatorName?: string`, `opts.operatorToken?: string`; fields `room.operatorName`, `room.operatorToken`, `room.operatorId` (starts `null`). `new Room(n)` still works with both operator fields `null`.
  - `POST /rooms` body `{ seatCount?: number, name?: string }` → `{ roomId, seatCount, operatorToken }`; `seatCount` clamped to `1..10` (invalid/missing → `4`); blank name → `"Operator"`.

- [ ] **Step 1: Write the failing room test**

Append to `test/server/room.test.js`:

```js
test('Room stores the opener identity; operatorId starts null', () => {
  const { Room } = require('../../server/room');
  const room = new Room(4, { operatorName: 'Ana', operatorToken: 'tok' });
  assert.equal(room.operatorName, 'Ana');
  assert.equal(room.operatorToken, 'tok');
  assert.equal(room.operatorId, null);
  const plain = new Room(2);
  assert.equal(plain.operatorName, null);
  assert.equal(plain.operatorToken, null);
});
```

- [ ] **Step 2: Write the failing HTTP test**

Append to `test/server/http.test.js`:

```js
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
```

- [ ] **Step 3: Run both files to verify they fail**

Run: `node --test test/server/room.test.js test/server/http.test.js`
Expected: FAIL — `operatorName` undefined; `operatorToken` undefined; clamped count assertions fail.

- [ ] **Step 4: Implement the room fields**

In `server/room.js`, change the constructor signature to `constructor(seatCount, opts = {})` and replace `this.creatorId = null;` with:

```js
this.operatorName = opts.operatorName || null; // the person who opened the room
this.operatorToken = opts.operatorToken || null; // secret that proves it
this.operatorId = null; // set when that person joins
```

- [ ] **Step 5: Implement creation in `server/index.js`**

Replace the body of the `POST /rooms` branch (currently lines ~53–65) with:

```js
const body = await readBody(req);
const { seatCount, name } = JSON.parse(body.toString() || '{}');
const raw = Number.isInteger(seatCount) && seatCount > 0 ? seatCount : 4;
const count = Math.min(10, Math.max(1, raw));
const operatorName = typeof name === 'string' && name.trim() ? name.trim().slice(0, 40) : 'Operator';
const operatorToken = uuidv4();
const roomId = uuidv4();
rooms.set(roomId, new Room(count, { operatorName, operatorToken }));
json(res, 200, { roomId, seatCount: count, operatorToken });
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `node --test test/server/room.test.js test/server/http.test.js`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add server/room.js server/index.js test/server/room.test.js test/server/http.test.js
git commit -m "feat: capture room opener identity and clamp seat count"
```

---

### Task 2: Server — lobby listing endpoint

**Files:**
- Modify: `server/room.js`
- Modify: `server/index.js`
- Test: `test/server/room.test.js`, `test/server/http.test.js`

**Interfaces:**
- Consumes: `Room` fields from Task 1.
- Produces:
  - `room.summary(roomId)` → `{ roomId, seatCount, occupied, operator }`, where `occupied = this.players.size` and `operator = this.operatorName`.
  - `GET /rooms` → `200` JSON array of summaries, **newest room first**. Must be handled before `GET /rooms/:id`.

- [ ] **Step 1: Write the failing room summary test**

Append to `test/server/room.test.js`:

```js
test('Room.summary reports seats, occupancy and the opener name', () => {
  const { Room } = require('../../server/room');
  const room = new Room(4, { operatorName: 'Ana', operatorToken: 'tok' });
  room.join(0, { id: 'p1', name: 'Bob' });
  assert.deepEqual(room.summary('r1'), {
    roomId: 'r1', seatCount: 4, occupied: 1, operator: 'Ana',
  });
});
```

- [ ] **Step 2: Write the failing lobby endpoint test**

Append to `test/server/http.test.js`:

```js
test('GET /rooms lists open rooms newest first with occupancy', async () => {
  const server = await start();
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    const post = (body) => fetch(`${base}/rooms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then((r) => r.json());

    const a = await post({ seatCount: 8, name: 'Ana' });
    const b = await post({ seatCount: 4 });

    const list = await (await fetch(`${base}/rooms`)).json();
    assert.ok(Array.isArray(list), 'an array of room summaries');
    const foundA = list.find((r) => r.roomId === a.roomId);
    const foundB = list.find((r) => r.roomId === b.roomId);
    assert.ok(foundA && foundB, 'both rooms listed');
    assert.deepEqual(foundA, { roomId: a.roomId, seatCount: 8, occupied: 0, operator: 'Ana' });
    assert.equal(foundB.operator, 'Operator', 'blank name falls back to Operator');
    assert.equal(list[0].roomId, b.roomId, 'newest room first');
  } finally {
    server.close();
  }
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `node --test test/server/room.test.js test/server/http.test.js`
Expected: FAIL — `room.summary is not a function`; `GET /rooms` returns 404.

- [ ] **Step 4: Implement `Room.summary`**

Add to the `Room` class in `server/room.js`:

```js
summary(roomId) {
  return {
    roomId,
    seatCount: this.seatCount,
    occupied: this.players.size,
    operator: this.operatorName,
  };
}
```

- [ ] **Step 5: Implement `GET /rooms`**

In `server/index.js`, insert this branch **before** the `GET /rooms/` branch:

```js
// Lobby: every open room, newest first
if (req.method === 'GET' && reqUrl.pathname === '/rooms') {
  const list = Array.from(rooms.entries()).reverse().map(([id, room]) => room.summary(id));
  json(res, 200, list);
  return;
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `node --test test/server/room.test.js test/server/http.test.js`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add server/room.js server/index.js test/server/room.test.js test/server/http.test.js
git commit -m "feat: add GET /rooms lobby listing"
```

---

### Task 3: Server — operator by token in the WebSocket layer

**Files:**
- Modify: `server/ws.js`
- Test: `test/server/ws.test.js`

**Interfaces:**
- Consumes: `room.operatorToken`, `room.operatorId` from Task 1.
- Produces:
  - `joinRoom` accepts optional `operatorToken`; matching token sets `room.operatorId = player.id` and `joined.operator = true`.
  - `killJob` / `bumpJob` allowed only when `room.operatorId === info.playerId`.
  - `operatorQueue` sent only to `room.operatorId`.
  - Disconnecting the operator clears `room.operatorId`.

- [ ] **Step 1: Update the test fixture and write the failing operator tests**

In `test/server/ws.test.js`, change `makeRooms` to give the room an opener:

```js
function makeRooms() {
  const rooms = new Map();
  rooms.set('r1', new Room(4, { operatorName: 'Ana', operatorToken: 'tok' }));
  return rooms;
}
```

Append:

```js
test('operator is the token holder, even when a student sits first', () => {
  const rooms = makeRooms();
  const student = fakeWs();
  const host = fakeWs();

  handleMessage(student, rooms, { type: 'joinRoom', roomId: 'r1', seatIndex: 0, name: 'Bob' });
  handleMessage(host, rooms, { type: 'joinRoom', roomId: 'r1', seatIndex: 1, name: 'Ana', operatorToken: 'tok' });

  const studentJoined = student.sent.find((m) => m.type === 'joined');
  const hostJoined = host.sent.find((m) => m.type === 'joined');
  assert.equal(studentJoined.operator, false);
  assert.equal(hostJoined.operator, true);
  assert.ok(host.sent.some((m) => m.type === 'operatorQueue'), 'the operator gets the queue');
  assert.equal(rooms.get('r1').operatorId, hostJoined.player.id);
});

test('a wrong token is not the operator; kill/bump are refused', () => {
  const rooms = makeRooms();
  const impostor = fakeWs();
  handleMessage(impostor, rooms, { type: 'joinRoom', roomId: 'r1', seatIndex: 0, name: 'Mallory', operatorToken: 'nope' });
  const joined = impostor.sent.find((m) => m.type === 'joined');
  assert.equal(joined.operator, false);

  impostor.sent.length = 0;
  handleMessage(impostor, rooms, { type: 'killJob', jobId: 1 });
  assert.ok(impostor.sent.some((m) => m.type === 'error' && m.error === 'notOperator'));
});

test('the operator can kill a job and loses the role on disconnect', () => {
  const rooms = makeRooms();
  const host = fakeWs();
  handleMessage(host, rooms, { type: 'joinRoom', roomId: 'r1', seatIndex: 0, name: 'Ana', operatorToken: 'tok' });
  host.sent.length = 0;
  handleMessage(host, rooms, { type: 'killJob', jobId: 1 });
  assert.equal(host.sent.some((m) => m.type === 'error' && m.error === 'notOperator'), false);

  drop(host);
  assert.equal(rooms.get('r1').operatorId, null);
});
```

- [ ] **Step 2: Run the file to verify it fails**

Run: `node --test test/server/ws.test.js`
Expected: FAIL — `joined.operator` is `true` for the first sitter (old rule) and the queue assertion fails.

- [ ] **Step 3: Implement token-based operator in `server/ws.js`**

In the `joinRoom` branch, replace the `isFirst` block with:

```js
const isOperator = Boolean(
  parsed.operatorToken && room.operatorToken && parsed.operatorToken === room.operatorToken
);
if (isOperator) room.operatorId = res.player.id;
```

and use `isOperator` in the `joined` message and the trailing `if (isOperator) sendOperatorQueue(room);`.

In the `killJob` / `bumpJob` case, change the guard to:

```js
if (!room.operatorId || room.operatorId !== info.playerId) {
  send(ws, { type: 'error', error: 'notOperator' });
  return;
}
```

In `sendOperatorQueue`, change the guard and lookup to `room.operatorId`.

In `drop`, after `room.leave(info.playerId);` add:

```js
if (room.operatorId === info.playerId) room.operatorId = null;
```

- [ ] **Step 4: Run the whole server test set**

Run: `node --test test/server`
Expected: PASS (all server tests, old and new).

- [ ] **Step 5: Commit**

```bash
git add server/ws.js test/server/ws.test.js
git commit -m "feat: operator is the room opener via token"
```

---

### Task 4: Client — pure seat layout module

**Files:**
- Create: `public/js/layout.js`
- Modify: `public/index.html` (script tag)
- Test: `test/client/layout.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `seatLayout(seatCount)` → `{ table: { length, depth, top }, seats: [{ index, x, z, rot, cam: { pos: {x,y,z}, target: {x,y,z} } }] }`.
  - Constants: `TABLE_TOP = 1.06`, `TABLE_DEPTH = 3.2`, `SEAT_PITCH = 2.0`, `SEAT_INSET = 0.8`, `TABLE_END_MARGIN = 1.0`, `END_ZONE = 2.2`, `CAMERA_BACK = 2.3`, `CAMERA_HEIGHT = 2.9`, `TARGET_HEIGHT = 0.95`, `MIN_LENGTH = 3.6`.
  - Formula: `perSide = floor(N/2)`, `hasEnd = N % 2 === 1`; `sideSpan = max(0, perSide - 1) * SEAT_PITCH`; `length = max(MIN_LENGTH, sideSpan + 2 * TABLE_END_MARGIN + (hasEnd ? END_ZONE : 0))`; the side rows shift east by `xShift = hasEnd ? END_ZONE / 2 : 0` so the end seat clears the corner side seat.
  - Side rows: `x = (i - (perSide - 1) / 2) * SEAT_PITCH + xShift`; south `z = +depth/2 - SEAT_INSET, rot = 0`; north `z = -(depth/2 - SEAT_INSET), rot = π`.
  - End seat: `index = 2 * perSide, x = -(length/2 - SEAT_INSET), z = 0, rot = -π/2`; its camera targets `(0, TARGET_HEIGHT, 0)`.
  - Side cameras sit `CAMERA_BACK` outward and target the opposite seat origin.
  - Loaded as a classic script exposing `window.seatLayout`, and as a CommonJS module for tests (same pattern as `scene.js`).

- [ ] **Step 1: Write the failing layout tests**

Create `test/client/layout.test.js`:

```js
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test test/client/layout.test.js`
Expected: FAIL — cannot find module `public/js/layout.js`.

- [ ] **Step 3: Implement `public/js/layout.js`**

Use the same UMD wrapper as `scene.js` (`(function (global) { … })(typeof window !== 'undefined' ? window : global);`), define the constants above, implement `seatLayout`, and export:

```js
const mod = {
  seatLayout, TABLE_TOP, TABLE_DEPTH, SEAT_PITCH, SEAT_INSET,
  TABLE_END_MARGIN, END_ZONE, CAMERA_BACK, CAMERA_HEIGHT, TARGET_HEIGHT, MIN_LENGTH,
};
if (typeof module === 'object' && module.exports) module.exports = mod;
else global.seatLayout = seatLayout;
```

Return seat entries in index order: south row first, then north row, then the optional end seat. Round no values — the tests compare exact constants.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test test/client/layout.test.js`
Expected: PASS.

- [ ] **Step 5: Load the module in the page**

In `public/index.html`, add `<script src="/js/layout.js"></script>` between `terminal.js` and `main.js`.

- [ ] **Step 6: Commit**

```bash
git add public/js/layout.js public/index.html test/client/layout.test.js
git commit -m "feat: pure rectangular seat layout math"
```

---

### Task 5: Client — rectangular table builder and camera yaw

**Files:**
- Modify: `public/js/scene.js`
- Test: `test/client/scene.test.js`

**Interfaces:**
- Consumes: `THREE` global.
- Produces:
  - `initScene(canvasEl)` → `{ scene, camera, renderer, board, table }`, where `table = { top: 1.06 }`; **no table geometry at init**.
  - `buildTable(length, depth)` → `{ length, depth, top: 1.06 }`; removes the previous table group, adds a box top (thickness 0.08, centre `y = top - 0.04`), two pedestals at `x = ±length/4`, two bases at the same x, and returns the dimensions.
  - `setLookOffset(yaw)` clamps to `[-LOOK_MAX, LOOK_MAX]` (`Infinity` → `LOOK_MAX`); `getLookOffset()` returns the clamped target; `LOOK_MAX = 70 * Math.PI / 180`.
  - `rotateYaw(dx, dz, yaw)` → `{ x: dx*cos + dz*sin, z: -dx*sin + dz*cos }`.
  - `animate()` applies `lookCurrent` (eased toward the target by `0.18` per frame) to the camera-to-target direction after the seat glide.

- [ ] **Step 1: Extend the test stubs and write failing tests**

In `test/client/scene.test.js`, add `remove` to the `Scene` stub (and a `Vector3` is **not** needed — the stub camera has no `position.lerp`):

```js
Scene: function () { this.children = []; this.background = null; this.add = (o) => this.children.push(o); this.remove = (o) => { const i = this.children.indexOf(o); if (i >= 0) this.children.splice(i, 1); }; },
```

Append:

```js
test('buildTable builds a rectangular table and replaces the previous one', () => {
  const { scene } = sceneMod.initScene(canvasStub);
  const before = scene.children.length;
  const dims = sceneMod.buildTable(10, 3.2);
  assert.deepEqual(dims, { length: 10, depth: 3.2, top: 1.06 });
  assert.ok(scene.children.length > before, 'table geometry added');

  const mid = scene.children.length;
  sceneMod.buildTable(4, 3.2);
  assert.ok(scene.children.length <= mid, 'previous table removed before rebuilding');
});

test('rotateYaw turns a direction around the vertical axis', () => {
  const r = sceneMod.rotateYaw(0, -1, Math.PI / 2);
  assert.ok(Math.abs(r.x + 1) < 1e-9, 'facing -z, a +90° turn looks -x');
  assert.ok(Math.abs(r.z) < 1e-9);
});

test('setLookOffset clamps to ±70° and getLookOffset reports the target', () => {
  sceneMod.setLookOffset(Infinity);
  assert.equal(sceneMod.getLookOffset(), sceneMod.LOOK_MAX);
  sceneMod.setLookOffset(-Infinity);
  assert.equal(sceneMod.getLookOffset(), -sceneMod.LOOK_MAX);
  sceneMod.setLookOffset(0);
  assert.equal(sceneMod.getLookOffset(), 0);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test test/client/scene.test.js`
Expected: FAIL — `buildTable`, `rotateYaw`, `setLookOffset` are undefined.

- [ ] **Step 3: Remove the round table from `initScene`**

Delete the `TABLE` radius/cylinder block (top, pedestal, base) from `initScene`; keep a `const TABLE_TOP = 1.06;` and return `table: { top: TABLE_TOP }`. Keep the wood/pedestal materials available to `buildTable` by creating them inside it.

- [ ] **Step 4: Implement `buildTable`**

Add a module-level `let tableGroup = null;` and:

```js
function buildTable(length, depth) {
  if (tableGroup) { scene.remove(tableGroup); tableGroup = null; }
  tableGroup = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ map: makeCanvasTexture(256, 128, paintWood, 2, 2), roughness: 0.6 });
  const pedestalMat = new THREE.MeshStandardMaterial({ color: 0x4A4038, roughness: 0.7 });
  const top = new THREE.Mesh(new THREE.BoxGeometry(length, 0.08, depth), wood);
  top.position.set(0, TABLE_TOP - 0.04, 0);
  if ('castShadow' in top) { top.castShadow = true; top.receiveShadow = true; }
  tableGroup.add(top);
  for (const x of [-length / 4, length / 4]) {
    const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.32, TABLE_TOP - 0.08, 20), pedestalMat);
    pedestal.position.set(x, (TABLE_TOP - 0.08) / 2, 0);
    tableGroup.add(guarded(pedestal));
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.7, 0.06, 24), pedestalMat);
    base.position.set(x, 0.03, 0);
    tableGroup.add(guarded(base));
  }
  scene.add(tableGroup);
  return { length, depth, top: TABLE_TOP };
}
```

- [ ] **Step 5: Implement the look API and apply it in `animate`**

Add:

```js
const LOOK_MAX = 70 * Math.PI / 180;
let lookTarget = 0;
let lookCurrent = 0;

function setLookOffset(yaw) {
  lookTarget = Math.max(-LOOK_MAX, Math.min(LOOK_MAX, yaw || 0));
}
function getLookOffset() { return lookTarget; }
function rotateYaw(dx, dz, yaw) {
  return { x: dx * Math.cos(yaw) + dz * Math.sin(yaw), z: -dx * Math.sin(yaw) + dz * Math.cos(yaw) };
}
```

In `animate`, inside the `if (camGoal)` block, replace the final `camera.lookAt(camTarget.x, camTarget.y, camTarget.z);` with:

```js
lookCurrent += (lookTarget - lookCurrent) * 0.18;
const dir = rotateYaw(camTarget.x - camera.position.x, camTarget.z - camera.position.z, lookCurrent);
camera.lookAt(camera.position.x + dir.x, camTarget.y, camera.position.z + dir.z);
```

Add `buildTable`, `setLookOffset`, `getLookOffset`, `rotateYaw`, `LOOK_MAX` to `mod` and to the global exports.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `node --test test/client/scene.test.js`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add public/js/scene.js test/client/scene.test.js
git commit -m "feat: rectangular table builder and camera look yaw"
```

---

### Task 6: Client — rectangular debris footprint

**Files:**
- Modify: `public/js/players.js`
- Test: `test/client/players.test.js`

**Interfaces:**
- Consumes: `initPlayers(opts)` now also accepts `opts.table = { length, depth }`.
- Produces:
  - `debrisFloor(x, z, tableTop, dims)` → `tableTop` when `|x| <= length/2` and `|z| <= depth/2`, else `0.03`. `dims` missing/empty falls back to a 1.9 half-extent square.
  - `initPlayers` stores the table half-extents; `stepExplosion` uses `debrisFloor` for landing.

- [ ] **Step 1: Write the failing floor test**

Append to `test/client/players.test.js`:

```js
test('debrisFloor uses the rectangular tabletop, not a circle', async () => {
  const players = await import('../../public/js/players.js');
  const dims = { length: 10, depth: 3.2 };
  assert.equal(players.debrisFloor(0, 0, 1.06, dims), 1.06, 'centre is tabletop');
  assert.equal(players.debrisFloor(4.9, 1.5, 1.06, dims), 1.06, 'near the corner is tabletop');
  assert.equal(players.debrisFloor(5.1, 0, 1.06, dims), 0.03, 'past the long edge is carpet');
  assert.equal(players.debrisFloor(0, 1.7, 1.06, dims), 0.03, 'past the short edge is carpet');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test test/client/players.test.js`
Expected: FAIL — `debrisFloor` is not exported.

- [ ] **Step 3: Implement the footprint**

In `public/js/players.js`, replace `let tableRadius = 1.9;` with:

```js
let tableDims = { length: 3.8, depth: 3.2 };
```

In `initPlayers`, replace the `tableRadius` assignment with:

```js
tableDims = opts.table || (opts.tableRadius !== undefined
  ? { length: opts.tableRadius * 2, depth: opts.tableRadius * 2 }
  : tableDims);
```

Add:

```js
export function debrisFloor(x, z, tableTop, dims) {
  const d = dims && dims.length && dims.depth ? dims : { length: 3.8, depth: 3.2 };
  const onTable = Math.abs(x) <= d.length / 2 && Math.abs(z) <= d.depth / 2;
  return onTable ? tableTop : 0.03;
}
```

In `stepExplosion`, replace the `Math.hypot(...)` line with:

```js
const floorY = debrisFloor(m.position.x, m.position.z, ex.floorY, tableDims);
```

- [ ] **Step 4: Run the whole client test set**

Run: `node --test test/client`
Expected: PASS, including the existing tests that still pass `tableRadius`.

- [ ] **Step 5: Commit**

```bash
git add public/js/players.js test/client/players.test.js
git commit -m "feat: rectangular tabletop for debris landing"
```

---

### Task 7: Client — build the office from the room state

**Files:**
- Modify: `public/js/main.js`
- Modify: `public/index.html` (script order only — `layout.js` added in Task 4)
- Test: existing suite + manual verification (no DOM test harness in this repo)

**Interfaces:**
- Consumes: `seatLayout` (Task 4), `buildTable` (Task 5), `players.initPlayers({ table })` (Task 6).
- Produces:
  - `buildOffice(seatCount)` in `main.js`: removes previous seat groups, builds the table for the layout dimensions, creates `seatCount` seats at `spot.x/spot.z`, sets `seat.group.rotation.y = spot.rot` and `seat.group.position.y = table.top`, paints `TERMINAL n / READY_`, stores `layout`/`seats`, and re-runs `players.initPlayers`.
  - `wireJoinUI(net, players, buildOffice)` — `loadRoom` calls `buildOffice(state.seatCount)` before `renderSeats`.

- [ ] **Step 1: Rewrite the layout setup in `main.js`**

Replace the hardcoded `SEATS = 4` block and the `layout`/`seats` construction with:

```js
let layout = [];
let seats = [];
let buildOffice = null; // assigned inside the app wiring
```

Delete the boot-time `players.initPlayers(...)` call; `buildOffice` owns it now.

- [ ] **Step 2: Implement `buildOffice` and pass it to the join UI**

Inside the `Promise.all([...]).then(...)` block, before `wireJoinUI`:

```js
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
```

Change the call to `wireJoinUI(net, players, buildOffice)` and change the signature to `function wireJoinUI(net, players, onRoomLoaded)`.

- [ ] **Step 3: Build the office on room load**

In `wireJoinUI`'s `loadRoom`, after the room state is parsed and before `renderSeats`:

```js
onRoomLoaded(state.seatCount);
```

- [ ] **Step 4: Run the full suite**

Run: `npm test`
Expected: PASS — all existing tests plus Tasks 1–6 tests.

- [ ] **Step 5: Manual smoke check**

Run `npm start`, open `http://localhost:3000`, open a 10-seat room, and confirm:

- The table is rectangular, with five terminals on each long side facing each other.
- Seat numbers 1–10 are selectable; terminals do not overlap.
- Pick another room with 4 seats: the office rebuilds to a 2 + 2 table (no leftover ten-seat terminals).

- [ ] **Step 6: Commit**

```bash
git add public/js/main.js public/index.html
git commit -m "feat: build the office from the room's seat count"
```

---

### Task 8: Client — lobby browser

**Files:**
- Modify: `public/index.html`
- Modify: `public/css/style.css`
- Modify: `public/js/main.js`
- Test: manual verification (server side covered by Task 2)

**Interfaces:**
- Consumes: `GET /rooms` from Task 2; `POST /rooms` token from Task 1; `joinRoom` token field from Task 3.
- Produces:
  - Lobby markup: `<div class="lobby"><h2 class="lobby-head">Open rooms</h2><div id="lobbyList" class="lobby-list"></div></div>` inside the memo.
  - `refreshLobby()` in `wireJoinUI`: fetches `/rooms`, renders one `.lobby-row` button per room; empty list shows `.lobby-empty` "No rooms open — open one above."
  - Row content: `ROOM <first 8 chars of roomId, uppercased>`, `occupied/seatCount`, `operator` (fallback `OPERATOR`). Click → `loadRoom(roomId)`.
  - Poll every `3000` ms while `#join` is not `.hidden`; stop when seated.
  - `POST /rooms` sends `{ seatCount, name }`; store `sessionStorage.setItem('mipsOperatorToken:' + roomId, operatorToken)`.
  - `joinRoom` includes `operatorToken: sessionStorage.getItem('mipsOperatorToken:' + currentRoomId) || undefined`.

- [ ] **Step 1: Add the lobby markup and seat cap**

In `public/index.html`:

- Change the seat-count input to `max="10"`.
- After the seat-count field and before the seat grid, add the lobby block above.

- [ ] **Step 2: Style the lobby**

Append to `public/css/style.css` (use the existing `--ink`, `--paper`, `--paper-dim`, `--stamp` variables):

```css
.lobby { margin: 0 0 16px; }
.lobby-head { font-size: 11px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; margin: 0 0 6px; }
.lobby-list { display: flex; flex-direction: column; gap: 4px; max-height: 132px; overflow-y: auto; }
.lobby-row { display: flex; gap: 10px; align-items: baseline; width: 100%; padding: 6px 4px; background: transparent; border: none; border-bottom: 1px dashed var(--ink-soft); color: var(--ink); font-family: inherit; font-size: 13px; text-align: left; cursor: pointer; }
.lobby-row:hover { background: var(--paper-dim); }
.lobby-occupancy { margin-left: auto; font-weight: 700; }
.lobby-empty { font-size: 12.5px; color: var(--ink-soft); padding: 4px 0; }
```

- [ ] **Step 3: Fetch, render and poll in `main.js`**

At module scope (next to `buildOffice`), declare `let stopLobbyPolling = null;`. Inside `wireJoinUI`, add:

```js
let lobbyTimer = null;

async function refreshLobby() {
  const list = document.getElementById('lobbyList');
  if (!list) return;
  let rooms = [];
  try {
    const res = await fetch('/rooms');
    if (res.ok) rooms = await res.json();
  } catch { /* server down: leave the list empty */ }
  list.innerHTML = '';
  if (!rooms.length) {
    const empty = document.createElement('div');
    empty.className = 'lobby-empty';
    empty.textContent = 'No rooms open — open one above.';
    list.appendChild(empty);
    return;
  }
  rooms.forEach((room) => {
    const row = document.createElement('button');
    row.className = 'lobby-row';
    const id = document.createElement('span');
    id.className = 'lobby-room';
    id.textContent = `ROOM ${room.roomId.slice(0, 8).toUpperCase()}`;
    const host = document.createElement('span');
    host.className = 'lobby-host';
    host.textContent = room.operator || 'OPERATOR'; // textContent: names are user input
    const occ = document.createElement('span');
    occ.className = 'lobby-occupancy';
    occ.textContent = `${room.occupied}/${room.seatCount}`;
    row.append(id, host, occ);
    row.onclick = () => loadRoom(room.roomId);
    list.appendChild(row);
  });
}

stopLobbyPolling = () => {
  if (lobbyTimer) { clearInterval(lobbyTimer); lobbyTimer = null; }
};

lobbyTimer = setInterval(() => {
  if (!document.getElementById('join').classList.contains('hidden')) refreshLobby();
}, 3000);
refreshLobby();
```

In `sitDown`, add `if (stopLobbyPolling) stopLobbyPolling();` so polling stops once seated.

- [ ] **Step 4: Send the opener identity and token**

In `btnCreate.onclick`, change the body to:

```js
const seatCount = parseInt($('seatCount').value, 10) || 4;
const name = $('playerName').value || 'Operator';
const res = await fetch('/rooms', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ seatCount, name }),
});
const { roomId, operatorToken } = await res.json();
sessionStorage.setItem('mipsOperatorToken:' + roomId, operatorToken);
await loadRoom(roomId);
```

In `btnSit.onclick`, add to the `joinRoom` message:

```js
operatorToken: sessionStorage.getItem('mipsOperatorToken:' + currentRoomId) || undefined,
```

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Manual lobby check**

With `npm start` and two browser tabs:

- Tab A: name "Ana", seat count 8, *Open a room* → the room appears in tab B's lobby within ~3 s as `ROOM … | ANA | 0/8`.
- Click the row in tab B → its seat grid shows 8 seats.
- Sit in tab A → tab B's row shows `1/8`.
- In tab A's devtools, `sessionStorage.getItem('mipsOperatorToken:<roomId>')` is a non-empty token.
- A room opened with a blank name shows `OPERATOR`.

- [ ] **Step 7: Commit**

```bash
git add public/index.html public/css/style.css public/js/main.js
git commit -m "feat: lobby browser with opener token"
```

---

### Task 9: Client — look left/right controls

**Files:**
- Modify: `public/js/editor.js`
- Modify: `public/js/main.js`
- Test: manual verification (scene math covered by Task 5)

**Interfaces:**
- Consumes: `setLookOffset` / `getLookOffset` from Task 5.
- Produces:
  - `Editor.isOpen()` → `this.el.style.display !== 'none'`.
  - `Editor.onShow` optional callback, invoked at the end of `show()`.
  - `main.js` key handling: ArrowLeft → `setLookOffset(Infinity)`; ArrowRight → `setLookOffset(-Infinity)`; keyup → `setLookOffset(0)`. Ignored when not seated, when `editor.isOpen()`, or when the event target is an `INPUT`/`TEXTAREA`.
  - `editor.onShow = () => setLookOffset(0)` so opening the terminal re-centres the view.

- [ ] **Step 1: Add the editor hooks**

In `public/js/editor.js`, add to the `Editor` class:

```js
isOpen() { return this.el.style.display !== 'none'; }
show() { this.el.style.display = 'flex'; this.cmd.focus(); if (this.onShow) this.onShow(); }
```

(Replace the existing `show()`; leave `hide()` as is.)

- [ ] **Step 2: Wire the keys in `main.js`**

After the editor is mounted and `sitDown` exists, add:

```js
editor.onShow = () => setLookOffset(0);

function lookAllowed(e) {
  if (mySeatIndex === null) return false;
  if (editor.isOpen()) return false;
  const tag = e.target && e.target.tagName;
  return tag !== 'INPUT' && tag !== 'TEXTAREA';
}

document.addEventListener('keydown', (e) => {
  if (!lookAllowed(e)) return;
  if (e.key === 'ArrowLeft') { e.preventDefault(); setLookOffset(Infinity); }
  if (e.key === 'ArrowRight') { e.preventDefault(); setLookOffset(-Infinity); }
});
document.addEventListener('keyup', (e) => {
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') setLookOffset(0);
});
```

`setLookOffset` is the global from `scene.js`; no import needed.

- [ ] **Step 3: Run the full suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 4: Manual look check**

With `npm start`, sit at a seat, then:

- Hold **←**: the view turns left and stops at ~70°; release → eases back to centre.
- Hold **→**: turns right symmetrically.
- Press **Editor** (or `Escape` back to the office): arrows do nothing while the editor is open; they work again after closing it.
- Before sitting, arrows in the name/URL fields move the text cursor, not the camera.

- [ ] **Step 5: Commit**

```bash
git add public/js/editor.js public/js/main.js
git commit -m "feat: arrow-key look controls while seated"
```

---

### Task 10: Docs — README refresh

**Files:**
- Modify: `README.md`

**Interfaces:** none.

- [ ] **Step 1: Update the README**

- *Playing*: max 10 seats; the lobby browser (open rooms list, click to join); the opener (not the first sitter) is the operator.
- *Multiplayer / terminal*: arrow-key look controls, disabled while the editor is open.
- *WebSocket protocol*: `POST /rooms` body `{ seatCount, name }` → `{ roomId, seatCount, operatorToken }`; `GET /rooms` lobby summaries; `joinRoom` carries `operatorToken`; `joined.operator` marks the opener.
- *File map*: add `public/js/layout.js` (pure seat/camera layout).
- *Known limitations*: replace "The first joiner of a room becomes its operator" with the opener rule; note the token lives in `sessionStorage` only.

- [ ] **Step 2: Verify the docs against the code**

Run: `grep -n "first joiner\|seatCount\|operator" README.md`
Expected: no stale "first joiner becomes operator" claim; the protocol section matches `server/index.js` and `server/ws.js`.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: lobby, rectangular table, operator and look controls"
```

---

## Self-Review Notes

- **Spec coverage:** capacity/lobby (Tasks 1–2, 8), operator identity (Tasks 1, 3, 8), rectangular table (Tasks 4–5, 7), debris footprint (Task 6), look controls (Tasks 5, 9), docs (Task 10). No spec requirement is left unowned.
- **Review Focus:** ten seats and odd counts are pinned by Task 4 tests; tiny rooms by Task 4; room switching by the Task 7 manual step; host identity by Task 3 tests and Task 8's manual token check.
- **Type consistency:** `seatLayout` → `{ table:{length,depth,top}, seats:[{index,x,z,rot,cam}] }` feeds `buildTable(length, depth)` → `{length,depth,top}`, which feeds `players.initPlayers({ table })` → `debrisFloor(..., dims)`. `room.summary(roomId)` is the only lobby shape.
