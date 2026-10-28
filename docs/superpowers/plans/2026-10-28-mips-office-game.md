# MIPS 80s Office Game Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a browser-based 3D office game where players write MIPS assembly at networked terminals to complete office tasks, with shared gadget status, typing animations, and client-detected blow-ups broadcast over WebSocket.

**Architecture:** Client-side Three.js frontend runs `@specy/mips` locally per player; Node `ws` WebSocket server holds in-memory rooms/seats/gadget state and broadcasts room-scoped JSON events (join, typing, gadget updates, blow-ups, cable messages).

**Tech Stack:** Node.js + `ws` (server), Three.js + vanilla JS (frontend), `@specy/mips` (client-side MIPS sim).

**Spec:** docs/superpowers/specs/2026-10-28-mips-office-game-design.md

## Global Constraints

- Browser-based 3D game using Three.js and vanilla JS (no React, no game engine editor).
- MIPS sim runs client-side via `@specy/mips` only; server never runs MIPS.
- Networking: Node `ws` WebSocket server, JSON messages, one connection per client.
- Server state: in-memory rooms, seats, players, gadget state, cable pairs; no database.
- Client-trusted tasks and blow-up detection.
- Admin creates room with seat count; players join, pick open seat, name, profile picture URL.
- Cable pairs share a configurable memory block (set in server code).
- Gadget status shared object on server, synced to all clients in room.

## Review Focus

- Client joins a full seat → server rejects with `seatTaken`, client shows error.
- Client sends `blowUp` → every other client in the room renders an explosion at that seat within one broadcast cycle.
- Two cabled seats → `cableMessage` from seat A reaches only seat B (not the whole room).
- Gadget write by client A → `gadgetState` broadcast updates the shared object for all clients in the room, including client A's own echo.
- Client types in the editor → `typing: true` sent, others play keyboard-banging animation; `typing: false` when idle.

## File Structure

**Server:**
- Create: `package.json` — Node project, deps `ws`, `uuid` (or nanoid)
- Create: `server/index.js` — HTTP server + `ws` WebSocket server entry point
- Create: `server/room.js` — `Room` class: seats, players, gadget state, cable pairs, shared memory config
- Create: `server/ws.js` — WebSocket connection handling + JSON message routing to room methods

**Frontend (served static):**
- Create: `public/index.html` — shell, loads Three.js + app scripts
- Create: `public/css/style.css` — retro 80s UI overlay (editor, join screen, HUD)
- Create: `public/js/main.js` — game init, render loop, route between join screen and 3D office
- Create: `public/js/net.js` — WebSocket client, send/receive helpers, event emitter
- Create: `public/js/mips.js` — `@specy/mips` wrapper: assemble, run, step, read registers/memory
- Create: `public/js/scene.js` — Three.js scene, camera, renderer, office geometry, terminal seats
- `public/js/terminal.js` — per-seat terminal: CRT screen render, keyboard, gadget sprites
- `public/js/editor.js` — MIPS assembly text editor, run button, local MIPS execution
- `public/js/players.js` — remote player rendering: name, profile picture, typing animation, explosion
- `public/js/gadgets.js` — gadget I/O address map, local gadget writes, `gadgetUpdate` sender

**Tests:**
- Create: `test/server/room.test.js` — Room class: join seat, full seat reject, gadget state, cable pairs
- Create: `test/server/ws.test.js` — message routing: typing, blowUp, cableMessage, gadgetUpdate broadcast scoping

## Task 1: Project scaffold and dependencies

**Files:**
- Create: `package.json`
- Create: `server/index.js` (minimal HTTP + WS listener)
- Create: `public/index.html` (shell loading Three.js from CDN and app scripts)
- Create: `public/css/style.css` (reset + basic layout placeholders)

**Interfaces:**
- Produces: `npm install` succeeds; `node server/index.js` starts a WebSocket server on port 3000 and serves `public/` static files; opening `http://localhost:3000` shows the shell.

- [ ] Step 1: Write `package.json` with `ws` and `uuid` dependencies and a `start` script.
- [ ] Step 2: Write `server/index.js` — create HTTP server, attach `ws` WebSocketServer, serve `public/` static, log connections.
- [ ] Step 3: Write `public/index.html` — `<!DOCTYPE html>`, load Three.js CDN, link `style.css`, load `main.js`, `net.js`, `scene.js`, `terminal.js`, `editor.js`, `players.js`, `gadgets.js`, `mips.js`.
- [ ] Step 4: Write `public/css/style.css` — `html, body { margin: 0; overflow: hidden; }`, `#canvas { width: 100vw; height: 100vh; display: block; }`, overlay panel placeholders.
- [ ] Step 5: Run `npm install` and `npm start`, verify server starts and page loads without console errors.
- [ ] Step 6: Commit.

## Task 2: Room model and seat management (server)

**Files:**
- Create: `server/room.js`
- Modify: `server/index.js:1-40` — import Room, create room map, handle WS `connection` + `message` + `close`

**Interfaces:**
- Consumes: none (new module)
- Produces:
  - `class Room { constructor(seatCount); join(seatIndex, player) → {ok, error}; leave(playerId); getState() }`
  - `player = { id, seatIndex, name, profilePictureUrl, status: 'active'|'blownUp'|'typing' }`
  - `gadgetState = { printer: {text: ''}, board: {text: ''}, controller: {} }`
  - `cablePairs = [{ seatA, seatB, sharedMemory: {base, size} }]`

- [ ] Step 1: Write failing test `test/server/room.test.js` — `Room.join` assigns seat, returns player object; joining an occupied seat returns `{error: 'seatTaken'}`.
- [ ] Step 2: Run test — FAIL (`Room` not defined).
- [ ] Step 3: Implement `Room` class in `server/room.js`: constructor takes seatCount, `seats` array, `players` map, `join(seatIndex, player)` validates seat free and within range, `leave(playerId)`, `getState()` returns `{seats, players, gadgetState, cablePairs}`.
- [ ] Step 4: Run test — PASS.
- [ ] Step 5: Wire `Room` into `server/index.js`: `rooms = new Map()`, admin HTTP endpoint `POST /rooms` with body `{seatCount}` returns `{roomId}`, WS `connection` handler joins/leaves rooms based on messages.
- [ ] Step 6: Run `node server/index.js`, verify `POST /rooms` returns a roomId and WS connections work.
- [ ] Step 7: Commit.

## Task 3: WS message routing — typing, gadget, blow-up, cable

**Files:**
- Create: `server/ws.js`
- Modify: `server/index.js` — delegate WS messages to `ws.js` handlers

**Interfaces:**
- Consumes: `Room` instance from task 2
- Produces:
  - `handleMessage(ws, room, parsed)` — routes on `type`: `joinRoom`, `typing`, `gadgetUpdate`, `taskComplete`, `blowUp`, `cableMessage`
  - `broadcast(room, message, excludeWs)` — sends JSON to all WS in room except optional
  - `send(ws, message)` — sends JSON to one WS

- [ ] Step 1: Write failing test `test/server/ws.test.js` — `typing` message from one client is broadcast to others in same room with `typing: true/false`; `blowUp` broadcast includes seat index; `cableMessage` from seat A delivered only to cabled seat B; `gadgetUpdate` updates room gadgetState and broadcasts to all in room.
- [ ] Step 2: Run test — FAIL.
- [ ] Step 3: Implement `server/ws.js`: parse incoming JSON, route by `type`, call room methods, broadcast scoped messages. `joinRoom` validates seat via `Room.join`; `typing` updates player status and broadcasts `{type:'playerTyping', seatIndex, typing}`; `gadgetUpdate` merges into `room.gadgetState` and broadcasts `{type:'gadgetState', gadgetState}`; `blowUp` sets player status blownUp and broadcasts `{type:'playerBlownUp', seatIndex}`; `cableMessage` finds cabled peer and sends only to that WS.
- [ ] Step 4: Run test — PASS.
- [ ] Step 5: Modify `server/index.js` to import and use `ws.js` handlers on `connection`/`message`/`close`.
- [ ] Step 6: Run server, open two WS clients, verify typing and blow-up reach only room peers.
- [ ] Step 7: Commit.

## Task 4: Shared gadget state object

**Files:**
- Modify: `server/room.js` — initialize `gadgetState` with printer/board/controller
- Modify: `server/ws.js` — `gadgetUpdate` handler deep-merges into `gadgetState`

**Interfaces:**
- Consumes: `Room.gadgetState` (task 2), `gadgetUpdate` routing (task 3)
- Produces: `gadgetState = { printer: {text: '', online: true}, board: {text: '', online: true}, controller: {buttons: {}} }` persisted per room, broadcast on every `gadgetUpdate`.

- [ ] Step 1: Write failing test — after `gadgetUpdate {printer: {text: 'HELLO'}}`, `room.getState().gadgetState.printer.text === 'HELLO'` and broadcast message contains updated state.
- [ ] Step 2: Run test — FAIL.
- [ ] Step 3: Modify `server/room.js` to initialize `gadgetState` in constructor; add `setGadget(key, value)` merging into state.
- [ ] Step 4: Run test — PASS.
- [ ] Step 5: Modify `server/ws.js` `gadgetUpdate` handler to call `room.setGadget` and broadcast full `gadgetState`.
- [ ] Step 6: Run server, verify gadget updates persist per room and broadcast to all.
- [ ] Step 7: Commit.

## Task 5: Cable pairs and shared memory config

**Files:**
- Modify: `server/room.js` — `addCablePair(seatA, seatB, sharedMemory)`, `getCablePeer(seatIndex)`
- Modify: `server/ws.js` — `cableMessage` handler uses `getCablePeer`

**Interfaces:**
- Consumes: `cablePairs` array on Room (task 2)
- Produces: `room.addCablePair(a, b, {base, size})`, `room.getCablePeer(seatIndex)` returns opposite seat or null; server code configures cable pairs (e.g., seat 0↔seat 1 share memory `{base: 0x1000, size: 256}`).

- [ ] Step 1: Write failing test — `addCablePair(0, 1, {base: 0x1000, size: 256})`; `getCablePeer(0) === 1`, `getCablePeer(1) === 0`, `getCablePeer(2) === null`.
- [ ] Step 2: Run test — FAIL.
- [ ] Step 3: Implement `addCablePair` and `getCablePeer` in `server/room.js`; store sharedMemory config on the pair.
- [ ] Step 4: Run test — PASS.
- [ ] Step 5: Modify `server/ws.js` `cableMessage` handler to forward `{type:'cableMessage', from, payload}` only to the cabled peer WS.
- [ ] Step 6: Run server, two cabled clients exchange a message, third client in room does not receive it.
- [ ] Step 7: Commit.

## Task 6: Three.js office scene and terminal seats

**Files:**
- Create: `public/js/scene.js`
- Create: `public/js/terminal.js`

**Interfaces:**
- Consumes: `main.js` (task 1 shell) provides canvas and Three.js
- Produces:
  - `initScene(canvas)` — Three.js scene, camera, renderer, office room geometry (walls, floor, table)
  - `addSeat(scene, index, x, z)` — terminal at a seat: desk, CRT screen (plane), keyboard, gadget sprites; returns seat object with `screen` mesh
  - `updateScreen(seat, text)` — draws text onto the CRT screen (texture canvas or text sprite)

- [ ] Step 1: Write `public/js/scene.js` — scene/camera/renderer, office geometry (simple boxes for walls/floor/table), animation loop calling `renderer.render`.
- [ ] Step 2: Write `public/js/terminal.js` — `addSeat` builds desk/CRT/keyboard from boxes; CRT screen uses a `CanvasTexture` so text can be drawn; `updateScreen` clears and draws text lines on the canvas texture.
- [ ] Step 3: Modify `public/js/main.js` — call `initScene`, add seats for a fixed number (e.g., 4), start render loop.
- [ ] Step 4: Open `http://localhost:3000`, verify 3D office with 4 terminal seats renders and rotates.
- [ ] Step 5: Commit.

## Task 7: MIPS sim integration and editor (client)

**Files:**
- Create: `public/js/mips.js`
- Create: `public/js/editor.js`

**Interfaces:**
- Consumes: `@specy/mips` (loaded via CDN or npm bundle)
- Produces:
  - `MipsSim` class: `assemble(source) → machineCode`, `load(code)`, `run(steps)`, `readRegister(name)`, `readMemory(addr)`, `onScreenOutput(text)` callback
  - `Editor` class: textarea for MIPS assembly, "Run" button, calls `MipsSim` on run, displays local output

- [ ] Step 1: Write failing test (browser/jsdom or manual check) — `MipsSim.assemble('li $a0, 42')` produces machine code; `run()` sets `$a0` to 42. (If no test runner for browser, verify manually in console.)
- [ ] Step 2: Implement `public/js/mips.js` — import/instantiate `@specy/mips`, wrap assemble/load/run/step, expose register and memory reads, `onScreenOutput` callback for syscall print output.
- [ ] Step 3: Write `public/js/editor.js` — fullscreen/monospace textarea, syntax hint, Run button; on run, assemble + run local MIPS, show output in a local log.
- [ ] Step 4: Modify `public/js/main.js` — mount editor overlay over the 3D scene; local player edits and runs MIPS at their seat.
- [ ] Step 5: Open page, write a simple MIPS program that prints text, run it, verify output appears locally.
- [ ] Step 6: Commit.

## Task 8: Local gadget I/O → gadgetUpdate messages

**Files:**
- Modify: `public/js/gadgets.js` (create)
- Modify: `public/js/mips.js` — memory-write hook for gadget addresses
- Modify: `public/js/net.js` — send `gadgetUpdate`

**Interfaces:**
- Consumes: `net.js` WS client (task 1/3), `mips.js` (task 7)
- Produces: `GADGET_IO = { PRINTER_BASE: 0x8000, BOARD_BASE: 0x8100, CONTROLLER_BASE: 0x8200 }`; `gadgets.write(address, value)` updates local gadget model and sends `gadgetUpdate` via WS; `gadgets.applyState(state)` merges server broadcast into local model.

- [ ] Step 1: Create `public/js/gadgets.js` — define I/O address map, `write(address, value)` updates `{printer, board, controller}` model, `sendGadgetUpdate()` sends `{type:'gadgetUpdate', gadget: {...}}` via `net.js`.
- [ ] Step 2: Modify `public/js/mips.js` — on memory write, if address in gadget range, call `gadgets.write(address, value)`.
- [ ] Step 3: Modify `public/js/net.js` — expose `send(message)` and `on(messageType, callback)`.
- [ ] Step 4: Modify `public/js/scene.js` / `terminal.js` — when gadget state changes, update 3D sprites (e.g., printer shows last line, board shows text).
- [ ] Step 5: Run page, local MIPS writes to printer address, verify `gadgetUpdate` sent and board/printer visuals update locally.
- [ ] Step 6: Commit.

## Task 9: Remote players — typing, blow-up, profile pictures

**Files:**
- Create: `public/js/players.js`
- Modify: `public/js/net.js` — handle `playerJoined`, `playerLeft`, `playerTyping`, `playerBlownUp`, `playerList`
- Modify: `public/js/terminal.js` — show typing animation and explosion on remote seats

**Interfaces:**
- Consumes: `net.js` WS events, `terminal.js` seat objects
- Produces: `players.add(player)` — renders name tag + profile picture (img from URL) above seat; `players.setTyping(seatIndex, bool)` — plays/stops keyboard-banging animation on that seat; `players.explode(seatIndex)` — plays explosion particle effect on that seat; `players.remove(seatIndex)`.

- [ ] Step 1: Write `public/js/players.js` — billboard sprite for name + profile picture above each seat; typing animation (keyboard mesh bobbing); explosion (simple particle burst or emissive flash).
- [ ] Step 2: Modify `public/js/net.js` — subscribe to WS message types, emit typed events (`playerJoined`, `playerTyping`, `playerBlownUp`, `gadgetState`, `cableMessage`).
- [ ] Step 3: Modify `public/js/main.js` — on `joinRoom` response, send `{type:'joinRoom', roomId, seatIndex, name, profilePictureUrl}`; on `playerJoined`, call `players.add`; on `playerTyping`, call `players.setTyping`; on `playerBlownUp`, call `players.explode` and set seat status.
- [ ] Step 4: Open two browser windows to same room, seat at different terminals, type in one, verify other shows typing animation; trigger blow-up in one, verify other shows explosion.
- [ ] Step 5: Commit.

## Task 10: Join screen — room creation, seat selection, name, profile picture

**Files:**
- Create: `public/js/main.js` join-screen flow (modify existing)
- Modify: `public/css/style.css` — join screen overlay styles
- Modify: `server/index.js` — `POST /rooms` endpoint (task 2) already exists; ensure it returns `{roomId}`

**Interfaces:**
- Consumes: `POST /rooms` (task 2), WS join (task 3)
- Produces: Join screen HTML overlay: "Create Room" (seat count input → `POST /rooms`), "Join Room" (roomId input), seat grid (clickable, shows free/taken), name input, profile picture URL input, "Sit" button.

- [ ] Step 1: Modify `public/index.html` — add join-screen overlay DOM (hidden by default).
- [ ] Step 2: Modify `public/css/style.css` — style join screen (retro 80s: dark background, neon borders, monospace font).
- [ ] Step 3: Modify `public/js/main.js` — show join screen at start; "Create Room" POSTs to `/rooms`, gets roomId; seat grid fetches room state or shows seatCount seats; clicking free seat + name + pic → WS join; hide overlay, show 3D office.
- [ ] Step 4: Open page, create room with 4 seats, join as two players at different seats with names and profile URLs, verify both appear in 3D office at their seats with pictures.
- [ ] Step 5: Commit.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-10-28-mips-office-game.md`.

Please review the plan. Does it capture what you want?

Which execution approach would you prefer?

- **Subagent-driven** — A fresh subagent implements each task and a fresh reviewer checks it before the next one starts, then a whole-branch review at the end. Most thorough; costs a fresh context per task and per review.
- **Native** — I implement every task myself in this session, then one fresh reviewer checks the whole branch. Cheapest and fastest; no independent review until the end.

For this plan I recommend **Native**, because the tasks have well-defined interfaces and there are only ten of them, so a shipped mistake is cheap to catch in a single end-to-end review.
