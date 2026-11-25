# MIPS Office

A networked browser game set in an 80s office. Everyone sits around a rectangular conference table with a CRT terminal, and does their job the only way an 80s office knows how: by writing MIPS assembly — on a **batch mainframe**. You don't run programs; you **submit jobs** and wait your turn while the machine processes the room's deck queue. Your assembler listing prints onto your paper card line-by-line with teletype clatter. And if you write bad code, your computer explodes and the whole office sees it.

## Requirements

- Node.js 18+ (the built-in test runner; the vendored simulator also runs in Node)
- Any modern browser with WebGL
- Internet on first load (Three.js and the fonts come from CDNs)

## Quick start

```bash
npm install
npm start
```

Then open **http://localhost:3000**. The server listens on port 3000 and serves the game from `public/`.

## Managing the server

| Task | Command |
|---|---|
| Start (foreground) | `npm start` — logs print here; **Ctrl+C** stops it |
| Start (background) | `Start-Process -NoNewWindow node -ArgumentList "server/index.js"` |
| Stop | `npm run stop` — kills whatever is listening on :3000, nothing else |
| Check if running | `Get-NetTCPConnection -LocalPort 3000 -State Listen` |
| Restart | `npm run stop` then `npm start` |

Notes:

- The server holds **all state in memory** — rooms, seats, the job queues, gadget state. Restarting wipes every room and disconnects every player (their tabs drop back to the join screen).
- `npm run stop` is surgical: it stops the process bound to port 3000 only, so other node processes are untouched.
- Different port: `node -e "require('./server/index.js').createServer({ port: 8080 })"` — or edit the default in `server/index.js`.

## Playing

The first screen is an **interoffice memo**.

1. **Open a room.** Enter your name, choose 1–10 seats, and press *Open a room*. You get a room ID you can share.
2. **Join a room.** Click a room in the lobby's *Open rooms* list to bring up its seat grid, or paste a room ID and press *Find my room*. The lobby lists empty rooms too and polls for updates while the memo is open.
3. **Pick a seat.** Free seats are outlined; taken seats are hatched. Click a free one.
4. **Your name** and a **profile picture URL** (optional — the tag falls back to text).
5. **Sit down.** The memo lifts, your camera glides behind your avatar, and you're in the office.

**The room opener is the operator** (the person who runs the machine), even if someone else sits down first. The office uses the room's seat count to size the rectangular table and arrange two facing rows, with a seat at the west end for odd counts.

## The terminal: a line editor

The **Editor** button (top-right HUD) or sitting down opens your terminal: a phosphor-green **character glass** (a real grid: 80 columns × 24 rows by default), a status line, and a command line with a `>` prompt. You don't edit text with a cursor — you **command the machine**:

| Command | What it does |
|---|---|
| `L` | List the whole deck |
| `L 3-7` | List lines 3 to 7 |
| `I 5` | Insert mode before line 5 — type lines, a lone `.` ends |
| `I` | Insert at the end of the deck |
| `I 5 TEXT` | One-shot: insert that line before line 5 |
| `I TEXT` | Append the line to the deck |
| `C 3 TEXT` | Replace line 3 with TEXT |
| `D 3` / `D 3-5` | Delete a line / a range |
| `T` | Show the top of the deck |
| `MODE` | Cycle the glass: 80×24 (VT-80) → 80×25 (PC-80) → 40×25 (C64-40) |
| `SUBMIT` | Send the deck to the mainframe's queue |
| `KILL n` / `BUMP n` | Operator only — kill / prioritize job n |
| `REF` | The reference card |
| `HELP` | The command summary |

- Everything you type is **uppercased** (the teletype had no lowercase) — except `$registers`, which normalize to lowercase (MARS demands it), and `\n`-style **string escapes**, which survive intact.
- The deck obeys the **punch-card limit: 80 columns** — longer lines are refused.
- **Pasting** a multi-line program into the command line reads it into the deck like paper tape (`5 LINES READ FROM TAPE`).
- The glass is a real character grid: text wraps at the column count, the newest line appears at the cursor, and the screen scrolls only when the cursor passes the bottom row. Your 3D CRT mirrors the glass live.
- The editor disables arrow-key look while it's open. Close it to look around from your seat.

## The batch loop: submit, wait, read the paper

There is no Run button. `SUBMIT` sends your deck to the **mainframe queue**:

1. Your terminal locks the job: `JOB #3 — QUEUED, 2 AHEAD` (you can keep editing your deck for your *next* submission — one outstanding job per player; a second SUBMIT is refused until the first clears).
2. The wait: each job takes `1s + 0.2s × lines of assembly`; your wait is every job ahead of yours plus your own.
3. When your slot arrives, the mainframe hum starts and your **listing prints onto your paper card line-by-line at teletype pace** (~15 lines/s, clatter included):
   - **SOURCE** — your lines with error flags (`†`) in the margin — printed open
   - **MACHINE CODE** — the assembled words with addresses — printed folded; click the header to open
   - **SYMBOLS** — labels and their addresses — folded
   - `== ASSEMBLY CLEAN ==` or `== ASSEMBLY HALTED ==`
4. If it assembled: **the program runs** — and its output prints below a dashed divider on the same card.
5. The terminal returns to `READY` and you can submit again.

**Bad code is dangerous.** An assembly error or a runtime crash (bad address, bad syscall) makes your computer **explode**: your CRT and your avatar hop on a smooth parabola while debris flies ballistic arcs, bounces on the tabletop and rains onto the carpet (time-based physics — identical at any frame rate), and if your terminal was open, **flames flash across the glass** while it shakes. Everyone in the room sees your computer explode across the table; you get the flames under your fingers.

## The office gadgets (memory-mapped I/O)

Office hardware is memory-mapped into the top of the simulator's static-data window. Programs "use" a gadget by storing into its range.

| Gadget | Address | Visibility | Write semantics |
|---|---|---|---|
| Office printer | `0x10030000` | **Private** — only your screen | `sb` — one ASCII byte per store |
| Display board | `0x10031000` | **Shared** — the wall board, everyone's | `sb` — one ASCII byte per store |
| Game controller | `0x10032000` | **Shared** — the state everyone sees | `sw` — raw words |

- Your **printouts** render as a paper card — always on top, live-updating, **Tear off** to dismiss (the next byte re-pins it).
- The **display board** is the wall bulletin: any player's program changes what the whole office reads.
- The printer card shows your job's listing *and* its output (the listing above a dashed divider, then the program's own printout).

A caution: the gadget addresses live in the simulator's static-data window (the heap starts at `0x10040000`); your own `.data` starts at `0x10010000` — don't overwrite your own strings.

## The reference card

The **Reference** HUD button (or `REF` in the terminal) opens the green card: the operator's cheat sheet, always on top, draggable by its header, foldable, with a filter box.

- **MACHINE** — the gadget map above
- **EDITOR COMMANDS** — the machine documents itself
- **INSTRUCTIONS** — **623 instructions generated from the simulator itself** (grouped: MEMORY / BRANCH-JUMP / ARITHMETIC-LOGIC / SYSTEM), each with its example; pseudo-instructions badged `(PSEUDO)`
- **SYSCALLS** — 1 print int, 4 print string, 10 exit, 11 print char
- **REGISTERS** — the 32, with scratch/saved conventions
- **ASCII** — a hand-encoding table (A–Z, 0–9, punctuation as decimal) for `sb` bytes

There is no autocomplete in the editor — the card is where you look things up. That's the era.

## Sound

All synthesized with Web Audio (no asset files): key clacks while you type, teletype clatter while listings print, the printer's dot-matrix buzz per character, a low mainframe hum while a job is on the machine, and a boom for explosions. The **Sound: On/Off** HUD toggle mutes everything.

## Multiplayer

- Looking around: hold **Left Arrow** or **Right Arrow** while seated to look that way, then release to face forward.
- Presence: who joined which seat, who left (a disconnect frees the seat and kills their queued job)
- Typing: other players see your avatar bang the keyboard
- Explosions: office-wide, seat-targeted
- The display board: shared office state
- Printouts: **private** to each player
- Cable pairs (see below) and the controller state: shared

### Cabling two computers

Cable pairs are configured in server code, per room. In `server/index.js`, in the `POST /rooms` handler after the room is created:

```js
rooms.set(roomId, new Room(count, { operatorName, operatorToken }));
// cable seat 0 to seat 1, sharing a 256-byte block at 0x1000:
rooms.get(roomId).addCablePair(0, 1, { base: 0x1000, size: 256 });
```

Once cabled, a `cableMessage` from one seat is relayed to the other seat only — never the rest of the room.

## Architecture

```
Browser (per player)                        Server (Node, in-memory)
┌─────────────────────────────┐             ┌──────────────────────────┐
│ Three.js office             │             │ rooms: Map<id, Room>     │
│  ├ room layout + humanoids  │             │  ├ seats, players        │
│  ├ terminal glass (80×24)   │  WebSocket  │  ├ gadgetState (shared)  │
│  ├ line editor + deck       │◄───────────►│  ├ job queues (simulated)│
│  ├ vendored MARS sim        │  JSON events│  ├ cablePairs            │
│  ├ paper card (printouts)   │             │  └ creator = operator    │
│  ├ reference card           │             └──────────────────────────┘
│  └ Web Audio soundscape     │
└─────────────────────────────┘
```

- The MIPS simulator runs **only in your browser**; the server schedules the queue but never assembles or executes anything.
- Everything is **client-trusted**.
- Rooms live in memory. Restarting the server clears them.

### File map

| Path | Role |
|---|---|
| `server/index.js` | HTTP server, static files, `POST /rooms`, `GET /rooms`, `GET /rooms/:id`, WS wiring, the 250ms mainframe clock |
| `server/room.js` | `Room` — seats, players, gadget state, cable pairs, the job queue, the creator |
| `server/queue.js` | `JobQueue` — the simulated FIFO: submit/position/tick/kill/bump/drop, ETAs |
| `server/ws.js` | WS message routing, room-scoped broadcast, owner-only job messages, operator queue |
| `server/stop.ps1` | `npm run stop` — stop the process on :3000 |
| `public/js/main.js` | Boot, join flow, event wiring, the CRT glass mirror |
| `public/js/layout.js` | Pure seat and camera layout for the rectangular table |
| `public/js/editor.js` | The terminal: line editor, deck, command parser, queue lifecycle, the listing builder, the Screen glass, flame flash |
| `public/js/gadgets.js` | The gadget I/O map, the private printout card (listing + output, folds), the shared board |
| `public/js/mips.js` | `MipsSim` — the wrapper over the vendored simulator |
| `public/js/players.js` | Humanoids, name/pic sprites, typing arms, the explosion physics |
| `public/js/reference.js` | The green card — generated from the sim's instruction set |
| `public/js/sound.js` | The Web Audio soundscape |
| `public/js/net.js` | The WebSocket client with a typed event emitter |
| `public/js/lib/mips-core.mjs` | Vendored `@specy/mips` ESM build (do not edit) |

### WebSocket protocol

- `POST /rooms` takes JSON `{ seatCount, name }` and returns `{ roomId, seatCount, operatorToken }`.
- `GET /rooms` returns an array of lobby summaries `{ roomId, seatCount, occupied, operator }`, newest first, including empty rooms. `occupied` is the number of seated players and `operator` is the opener's name.

Messages are JSON with a `type` field.

| Type | Direction | Meaning |
|---|---|---|
| `joinRoom` | client → server | `{ roomId, seatIndex, name, profilePictureUrl, operatorToken }` (`operatorToken` is optional) |
| `joined` | server → client | Your player and the full room state (players as an array); `joined.operator` is `true` when your token matches the opener's token |
| `playerJoined` / `playerLeft` | server → room | Presence |
| `typing` / `playerTyping` | client → server / server → room | The keyboard-banging broadcast |
| `submitJob` | client → server | `{lineCount}` — the deck enters the queue |
| `jobQueued` / `jobPosition` | server → owner | `{jobId, position, etaMs}` |
| `jobRunning` | server → owner | Your slot arrived — run your held deck |
| `jobDone` | server → owner | The slot is over — the terminal returns to READY |
| `jobKilled` | server → owner | The operator killed your job |
| `killJob` / `bumpJob` | creator → server | Operator powers (validated server-side) |
| `operatorQueue` | server → creator | The full queue snapshot |
| `gadgetUpdate` / `gadgetState` | client → server / server → room | Shared gadget writes (board, controller) |
| `blowUp` / `playerBlownUp` | client → server / server → room | A terminal exploded |
| `cableMessage` | client → server, server → cabled peer | Relayed cable chat |
| `error` | server → client | `seatTaken`, `unknownRoom`, `notCabled`, `notOperator`, … |

## Development

```bash
npm test        # 78 tests via node --test
```

- Server tests: the room model, the queue (ETAs, kill/bump, retiming), WS routing (fake sockets), the HTTP endpoints (a real server on a random port)
- Client tests: the editor commands/deck (real sim integration), the Screen grid, the gadget programs from the field guide, the explosion physics (deterministic, time-stepped), the reference card, the typing pulse — Three.js stubbed minimally

The design docs live under `docs/superpowers/` (the batch mainframe spec: `specs/2026-10-29-batch-mainframe-design.md`).

## Known limitations

- **The queue is simulated** — jobs execute client-side when the server says their slot arrived; nothing is validated server-side yet. (The vendored sim runs in Node, so a true mainframe is a possible future.)
- **Cable talk is half-wired** — pairs relay, but incoming messages aren't displayed and the shared memory block isn't synced between machines.
- **The controller can be written, not read** — MIPS programs can't poll button state yet.
- **No task system yet** — the batch loop is the sandbox; objectives would slot naturally onto it (a submitted job's listing output could be checked against a spec).
- **Every failure is the full explosion** — no severity tiers yet.
- **No persistent operator login** — the opener is the operator, identified by the token returned at room creation. The browser keeps it only in that tab's `sessionStorage`, so joining from another browser or tab won't make you the operator. After refreshing the same tab, find the room in the lobby and sit down to rejoin as operator. Rooms die on a server restart.
- The office was loud; this one is only as loud as your mute button allows.
