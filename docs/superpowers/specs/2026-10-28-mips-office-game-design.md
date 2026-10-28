# MIPS 80s Office Game — Design Doc

**Date:** 2026-10-28  
**Status:** Draft — awaiting approval

## Intent and why

A browser-based 3D game where each player is a person sitting at a MIPS terminal in an 80s office. Players write MIPS assembly (run locally via `@specy/mips`) to complete office tasks — printing, updating display boards, using a game controller. The network layer is purely social: players see each other's terminals, typing animations, and explosions. Client-trusted — if a client's MIPS program crashes or misbehaves, that client broadcasts its own "blown up" state so everyone in the room sees it.

## Goals

- 3D office environment (Three.js) with one computer terminal per seat.
- Admin creates a room, chooses seat count; players join, pick an open seat, choose a name and profile picture URL.
- Each client runs its own MIPS sim locally; screen output renders on the in-game CRT.
- Tasks (printing, display board, game controller, etc.) are MIPS programs that write to memory-mapped I/O; task completion is client-trusted and reported to the server.
- Typing animation ("banging keyboard") broadcast to other clients when the local player is typing at their terminal.
- "Blow up" state (client-detected MIPS crash / illegal op / runaway loop) broadcast to all clients in the room; blown-up clients show an explosion visual.
- Gadget status (printer state, display board text, controller state) kept as a shared object on the server and synced to all clients in the room.
- Two computers can be "cabled" together; cabled pairs share a configurable memory block (set in server code), so MIPS programs on either side can read/write the shared region.
- Cable talk: server-relayed messages between cabled computers.

## Non-goals

- Cheat-proof or server-validated task completion.
- Voice chat.
- Persistent accounts or rooms across server restarts (rooms live in server memory).
- Player movement avatars — seats are fixed; players "sit" at a terminal.

## Anti-goals (failure even if it works)

- A single-player experience where other players are invisible.
- Server running MIPS sims (each client runs its own).
- A complex game engine with editors/asset pipelines.

## Constraints

- Frontend: Three.js (3D), vanilla JS, browser-based.
- Networking: WebSocket server (Node + `ws`), one connection per client, JSON messages.
- MIPS sim: `@specy/mips`, runs client-side only.
- Server state: in-memory rooms, seats, players, gadget status, cable pairs. No database.
- Client-trusted tasks and blow-up detection.

## Parts (as decided)

### Networking
- Node `ws` WebSocket server.
- Client connects on join; sends `joinRoom` with `{ roomId, seatIndex, name, profilePictureUrl }`.
- Server assigns the seat if free, broadcasts `playerJoined` / `playerList` to all in room.
- Client sends `typing` (true/false) while entering assembly; server relays `typing` to other clients in the same room.
- Client sends `taskComplete` / `gadgetUpdate`; server updates shared gadget state object for the room and broadcasts `gadgetState` to all clients in room.
- Client sends `blowUp` when its MIPS sim crashes / detects illegal op / runaway loop; server broadcasts `playerBlownUp` with the client's seat so everyone sees the explosion.
- Cable pairs: server tracks which seats are cabled. Client sends `cableMessage` to server; server relays to the cabled peer only.
- Shared memory block: configured in server code per cable pair (e.g., `{ base: 0x1000, size: 256 }`). The two clients' MIPS sims agree on the same block; writes by one are visible to the other (simulated by syncing that memory range over the server or by convention — detail left to builder).

### Frontend (Three.js)
- 3D office room with a table in the center.
- One terminal per seat: CRT screen, keyboard, and "gadgets" (printer, display board, game controller) on or near the table.
- Each player's terminal renders their own MIPS screen output on the CRT.
- Other players shown at their seats: name, profile picture, typing animation (keyboard banging), blow-up explosion when applicable.
- Local player writes/edits MIPS assembly in an editor; runs it in `@specy/mips` locally.
- When local MIPS program writes to gadget I/O addresses, client sends `gadgetUpdate` so others see the changed status.
- Cable connection drawn as a line between the two cabled terminals.

### Backend (Node + `ws`)
- `rooms` map: roomId → `{ seats: [{ index, player: null or {id, name, profilePictureUrl, status: 'active'|'blownUp'|'typing'}]}, gadgetState: {}, cablePairs: [{seatA, seatB, sharedMemory: {base, size}}] }`.
- Admin endpoint to create a room with a seat count → returns roomId.
- WebSocket message handlers: joinRoom, typing, gadgetUpdate, taskComplete, blowUp, cableMessage, leave/disconnect.
- Broadcast room-scoped messages only.

### Tasks (first set, client-trusted)
1. Printing — MIPS writes text to a printer buffer I/O range; server records `printer.text`.
2. Display board — MIPS writes text to a board I/O range; server records `board.text`.
3. Game controller — MIPS reads controller input state from I/O range.
- More tasks can be added by defining new I/O address ranges and server gadget state keys.

## What's left to the builder

- Exact MIPS I/O address map (which addresses map to printer, board, controller).
- How shared memory between cabled computers is kept in sync over the network (or left as a client-side convention).
- Blow-up detection criteria (illegal opcode, infinite loop timeout, etc.).
- 3D asset sourcing (CRT, keyboard, desk models — can be simple boxes/primitives to start).
- Room creation UI (admin) and join UI (seat, name, profile picture).
- MIPS editor UI and local `@specy/mips` integration.

## Approaches considered and rejected

- **Server-run MIPS sims:** rejected — you want clients to run their own sims; networking is social only.
- **WebRTC for cable talk:** rejected — server-relayed is simpler and NAT-friendly.
- **Database-persisted rooms:** rejected — in-memory is fine for the scope.
- **React / Phaser / Babylon.js:** rejected — Three.js + vanilla JS is the lightest path to a 3D browser game.

---

Please review. If anything is wrong or missing, tell me and I'll revise. Once you approve, the next step is the plan (invoke `superpowers:writing-plans`), then implementation.
