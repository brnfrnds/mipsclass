# MIPS Office

A networked browser game set in an 80s office. Everyone sits at a CRT terminal and does their job the only way an 80s office knows how: by writing MIPS assembly. Print a document, update the display board, drive the game controller — all by storing bytes into memory-mapped office gadgets. If your program crashes hard enough, your computer explodes and the whole office sees it.

## Requirements

- Node.js 18+ (uses the built-in test runner and `fetch`)
- Any modern browser with WebGL
- Internet on first load (Three.js comes from a CDN)

## Quick start

```bash
npm install
npm start
```

Then open **http://localhost:3000**. The server listens on port 3000 and serves the game from `public/`.

## Playing

The first screen is the join panel.

1. **Create a room (admin).** Enter a seat count and press *Create Room*. You get a room ID — share it with the other players (copy it into the Room ID field on their screens, or just send them the text).
2. **Join a room.** Paste the room ID, press *Join Room*, and the seat grid appears.
3. **Pick a seat.** Free seats are dark; taken seats are red. Click a free one.
4. **Enter your name** and a **profile picture URL** (optional — the name tag falls back to text-only if the image doesn't load).
5. Press **Sit at Seat**. The overlay lifts and you're in the office, standing at your terminal.

While in the room you can see the other players at their seats: their name tags and profile pictures float above their desks, and their keyboards bang while they type.

## Programming your terminal

Press **Run**'s neighbor — the editor overlay covers the screen with a monospace textarea. It speaks the MARS assembly dialect (`.data`/`.text`, labels, pseudo-instructions, syscalls), assembled and executed locally in your browser by the MARS simulator.

A program that prints to your terminal's output log:

```asm
        .data
msg:    .asciiz "Hello from MIPS\n"
        .text
        .globl main
main:
        li   $v0, 4        # syscall 4: print string
        la   $a0, msg
        syscall
        li   $v0, 10       # syscall 10: exit
        syscall
```

Press **Run** to assemble and execute. Assembly errors and runtime errors are reported in the log below the editor. **Clear** empties the editor and the log.

### The office gadget memory map

Office hardware is memory-mapped into the top of the simulator's static-data window. Store bytes (`sb`) into a gadget's range and the bytes are appended to that gadget's text — which every player in the room sees on their gadget panel, because every write is broadcast.

| Gadget          | Base address  | Size    | Write semantics                        |
|-----------------|---------------|---------|----------------------------------------|
| Office printer  | `0x10030000`  | 0x1000  | Each byte is appended as an ASCII char |
| Display board   | `0x10031000`  | 0x1000  | Each byte is appended as an ASCII char |
| Game controller | `0x10032000`  | 0x1000  | Writes are recorded to shared state    |

Printing `HI!` to the office printer:

```asm
        .text
        .globl main
main:
        li   $t0, 0x10030000   # printer buffer
        li   $t1, 72           # 'H'
        sb   $t1, 0($t0)
        li   $t1, 73           # 'I'
        sb   $t1, 1($t0)
        li   $t1, 33           # '!'
        sb   $t1, 2($t0)
        li   $v0, 10
        syscall
```

Useful addresses for building these constants: `li $t0, 0x10030000` assembles fine directly. Updating the display board is the same program with `0x10031000`.

A word of caution: these addresses are inside the simulator's static-data window (the heap starts at `0x10040000`), but they are far above where the assembler places your own `.data` (which starts at `0x10010000`). Don't overwrite your own strings.

### Blowing up

Runtime faults — bad addresses, unimplemented syscalls, arithmetic disasters — reject the run with a typed error and show up in your log as `RUN ERROR: …`. The office-wide explosion broadcast is wired on the server; see *Known limitations* below for the client trigger.

## Multiplayer: what's shared

The server keeps one shared state object per room and broadcasts changes to everyone:

- **Gadget state** — printer text, board text, controller writes. Everyone sees the same office hardware.
- **Presence** — who joined which seat, who left.
- **Typing** — the keyboard-banging animation on another player's desk.
- **Blow-ups** — an explosion at a player's seat, visible to the whole room.
- **Cable messages** — two computers can be cabled together and exchange messages relayed through the server.

## Cabling two computers together

Cable pairs are configured in server code, per room. In `server/index.js`, in the `POST /rooms` handler after the room is created:

```js
rooms.set(roomId, new Room(count));
// cable seat 0 to seat 1, sharing a 256-byte block at 0x1000:
rooms.get(roomId).addCablePair(0, 1, { base: 0x1000, size: 256 });
```

Once cabled, a `cableMessage` from one seat is relayed by the server to the other seat only — never to the rest of the room.

## Architecture

```
Browser (per player)                       Server (Node, in-memory)
┌──────────────────────────┐               ┌─────────────────────────┐
│ Three.js office scene    │               │ rooms: Map<id, Room>    │
│  ├ terminal seats, CRTs  │   WebSocket   │  ├ seats, players       │
│  ├ gadget sprites        │◄─────────────►│  ├ gadgetState (shared) │
│  ├ editor (MARS asm)     │  JSON events  │  ├ cablePairs           │
│  └ @specy/mips simulator │               │  └ relays broadcasts    │
└──────────────────────────┘               └─────────────────────────┘
```

- The MIPS simulator runs **only in your browser**; the server never assembles or executes anything.
- Tasks are **client-trusted** — the server relays what clients report.
- Rooms live in memory. Restarting the server clears them.

### File map

| Path | Role |
|---|---|
| `server/index.js` | HTTP server, static files, `POST /rooms`, `GET /rooms/:id`, WS wiring |
| `server/room.js` | `Room` — seats, players, gadget state, cable pairs |
| `server/ws.js` | WS message routing, room-scoped broadcast |
| `public/js/scene.js` | Three.js scene, office geometry, render loop |
| `public/js/terminal.js` | Per-seat desk, CRT (canvas texture), keyboard, gadget sprite |
| `public/js/main.js` | Boot, join screen flow, event wiring |
| `public/js/editor.js` | MIPS editor overlay, run/log |
| `public/js/mips.js` | `MipsSim` wrapper around the vendored simulator |
| `public/js/gadgets.js` | Gadget memory map, local model, gadgetUpdate sender |
| `public/js/net.js` | WebSocket client with typed event emitter |
| `public/js/players.js` | Name/pic sprites, typing bob, explosion particles |
| `public/js/lib/mips-core.mjs` | Vendored `@specy/mips` ESM build (do not edit) |

### WebSocket protocol

Messages are JSON with a `type` field.

| Type | Direction | Meaning |
|---|---|---|
| `joinRoom` | client → server | `{roomId, seatIndex, name, profilePictureUrl}` |
| `joined` | server → client | Your seat + full room state |
| `playerJoined` | server → room | A new player took a seat |
| `playerLeft` | server → room | Someone disconnected; seat is free again |
| `typing` | client → server | `{typing: true/false}` while editing |
| `playerTyping` | server → room | Relayed typing state for a seat |
| `gadgetUpdate` | client → server | Gadget bytes written by a MIPS program |
| `gadgetState` | server → room | Full shared gadget state after an update |
| `playerBlownUp` | client → server, server → room | A terminal exploded |
| `taskComplete` | client → server | Client-trusted task completion |
| `cableMessage` | client → server, server → cabled peer | Relayed cable chat |
| `error` | server → client | `seatTaken`, `unknownRoom`, `notCabled`, … |

## Development

```bash
npm test        # runs the whole suite (32 tests) via node --test
```

- Server tests: `test/server/` — room model, WS routing (with fake sockets), HTTP endpoints (real server on a random port).
- Client tests: `test/client/` — Three.js stubbed with a minimal fake; `MipsSim` runs the real vendored simulator in Node.
- The game was built task-by-task with test-first development; the design spec and implementation plan live under `docs/superpowers/`.

## Known limitations

- **Typing broadcast is display-only.** The server relays typing and desks animate, but the editor doesn't send `typing` events yet — so nobody knows you're the one typing.
- **Blow-ups need a trigger.** The server routes `playerBlownUp` and clients render explosions, but no client code detects a crashed run and sends it yet.
- **Cables are half-wired.** Pairs and the shared-memory block are configurable server-side and messages relay correctly, but the receiving client doesn't display incoming `cableMessage` yet, and the shared memory block isn't actually synced between the two machines.
- **Your output shows in the editor's log**, not on the 3D CRT — live screen mirroring is on the roadmap.
- **The controller can be written, not read.** MIPS programs can't yet poll button state.
- Rooms are in-memory and client-trusted; this is a game, not a bank.
