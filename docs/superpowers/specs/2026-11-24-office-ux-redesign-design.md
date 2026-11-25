# Office UX & Seat Redesign — Design Doc

**Date:** 2026-11-24
**Status:** Approved by the user in conversation ("looks good"); builder check complete — operator identity and camera target resolved.

## Intent

Make MIPS Office pleasant to host and to join in a real classroom: a teacher should be able to open a room and have students find it without pasting a UUID, and up to ten students should sit comfortably around one table. Players should also be able to turn their head and see the neighbours beside them, not just the table dead ahead.

Three changes:

1. **A rectangular conference table** that adapts to the room's seat count (up to 10), driven by the room you actually picked — no more hardcoded 4-seat office.
2. **A lobby browser** in the join memo: a live list of open rooms with occupancy, click to join.
3. **Look left/right** on the arrow keys when the terminal editor is closed.

## Goals

- The host opens a room once and players discover it in the lobby; no UUID sharing required.
- Players see how full each room is before committing, then see the actual room's seating while picking a seat.
- Ten players fit around one rectangular table with no overlapping terminals, and every seat has a clear view across it.
- Looking left/right helps you see seat neighbours without moving your camera from behind your avatar.

## Non-goals (not this round)

- Full session persistence / reconnect after refresh (rooms stay in memory; only the operator token is kept in `sessionStorage`).
- Passwords, private rooms, invites, or short share codes (the lobby removes most of the need).
- An operator HUD panel with kill/bump buttons (the terminal `KILL`/`BUMP` commands remain).
- Server-side execution, task objectives/scoring (unchanged from the batch-mainframe design).
- More than 10 seats. The layout math stays general, but the cap this round is 10.

## Anti-goals (failure even if it works)

- Cramming ten terminals around the old circular table until they overlap.
- A lobby that lists rooms but doesn't show which have free seats or who is hosting.
- Look controls that jerk the camera, fight the terminal input, or persist while you're typing.

## Decisions (from the conversation)

| Question | Decision |
|---|---|
| Max players | **10** (seat-count input 1–10, default 4; server clamps to 1–10) |
| Table shape | **Rectangular**, two long rows facing each other; length scales with seat count |
| Odd seat counts | Spare seat at a **short end** of the table |
| Scene timing | Office **built after the room is fetched** (rebuild if another room is picked); no table shown until then |
| Lobby | **Live list of open rooms**: room no., seated/total, opener's name; click to load its seat grid; manual room-number entry still works |
| Operator identity | **Whoever opened the room** — captured at room creation, not the first sitter; that person keeps `KILL`/`BUMP` even if a student sits first |
| Operator after leaving | Lobby keeps naming the opener (a room property); powers stay with the connected opener, so no one has them while they're away |
| Look keys | **← / →**, hold to turn up to about ±70°, ease back on release; disabled while the editor is open; only after sitting |
| Camera during look | Camera **stays behind the avatar**; only the look direction yaws (turning your head) |

## Current state (as found)

- **Server** (`server/index.js`): `POST /rooms` already accepts any positive integer seat count (`:57`); `GET /rooms/:id` returns `seatCount`, `seats`, `players`, gadgets. No room listing endpoint.
- **Operator** (`server/ws.js`): the first sitter becomes operator (`:39-40`); `KILL`/`BUMP` check `room.creatorId` (`:106`); the operator queue goes to that player (`:171-174`). `POST /rooms` carries no identity, so today the opener is anonymous.
- **Join memo** (`public/index.html`): room-number input, seat-count input (`min=1 max=16`), name, photo URL, seat grid; actions *Open a room* / *Find my room* / *Sit down*.
- **Scene** (`public/js/scene.js`): builds the round table at load (`TABLE.radius = 1.9`, cylinder at `:179`); camera fixed at boot and eased to a seat anchor via `setCameraAnchor` (`:219`, `animate` `:223`).
- **Office** (`public/js/main.js`): hardcodes `SEATS = 4` (`:12`), builds four place-settings on a circle, `layout` drives both seats and camera anchors.
- **Seat group** (`public/js/terminal.js`): `addSeat(scene, index, x, z)` builds a place-setting whose local **+z points outward** (toward the sitter); origin sits on the tabletop surface.
- **Avatars** (`public/js/players.js`): humanoid at local `(0, -tableTop, 0.95)`, i.e. outside the keyboard in the seat's frame; debris floor test uses `Math.hypot(x, z) > tableRadius` (`:280`).

## Design

### 1. Room capacity and the lobby browser

**Server**

- `POST /rooms`: clamp `seatCount` to **1–10** (invalid/missing → 4).
- New `GET /rooms` (exact path, checked **before** `GET /rooms/:id`) returns an array, newest first:

  ```json
  [{ "roomId": "…", "seatCount": 8, "occupied": 3, "operator": "Ana" }]
  ```

  `occupied` = seated player count; `operator` = the name given when the room was opened (always present, even before anyone sits).

#### Operator identity — whoever opened the room

- `POST /rooms` takes `{ seatCount, name }` and returns `{ roomId, seatCount, operatorToken }`. The room stores `operatorName` and `operatorToken`; the **token** is the identity, the name is only the label.
- `joinRoom` carries `operatorToken`. The player whose token matches becomes `operatorId`: `joined.operator` is true for them, `KILL`/`BUMP` validate against `operatorId`, and the operator queue goes to it — so the opener keeps the machine even if a student sits first.
- The memo's create flow sends the operator-name field with the request and keeps the token in `sessionStorage` keyed by room id, so a host who refreshes can rejoin as operator (their seat and the room's state are not restored — rooms stay memory-only).
- Edge case: an opener who never sits has no `operatorId`, so no one can kill/bump until they do. The create flow already lands them on the seat grid; accepted.

**Client (memo)**

- A *Lobby* section listing open rooms: room number, `occupied/seatCount`, operator name. Empty rooms are listed too (that's how a freshly opened room is found).
- Clicking a row calls the existing `loadRoom(id)`: fills the room-number field and renders the seat grid, exactly as *Find my room* does today.
- Poll `GET /rooms` every ~3 s **only while the join overlay is visible**; stop when seated. Also refresh immediately after *Open a room*.
- *Open a room* keeps its current behaviour: create, then load the new room (host lands on its seat grid).
- Manual room-number entry and *Find my room* stay, for direct joins.

### 2. Rectangular table and up to ten seats

**Layout (pure math, worth a unit test)**

- For seat count `N`: `perSide = floor(N / 2)`; the south row takes `perSide`, the north row the next `perSide`; if `N` is odd, one extra seat sits at a **short end**, centred on the table.
  - Example: 10 → 5 + 5; 9 → 4 + 4 + 1 end seat; 4 → 2 + 2.
- Seats along a row are evenly spaced by a **pitch** wide enough for a place-setting. A place-setting is roughly 1.9–2.0 units wide (CRT 1.0 + printer offset to `x ≈ 0.98`), so the pitch and table length must accommodate that, or the place-setting needs tightening. Table **length scales** with the number of seats per side; depth is fixed, sized to fit two facing place-settings (~2.0).
- Each seat group keeps the place-setting's existing convention: local **+z points outward**. Rotation by side: south row `0`, north row `π`, end seats `±π/2`.
- The seat group's origin must be placed **inside the table edge by roughly the keyboard's outward offset (~0.7)** so the keyboard rests on the tabletop (`local z ≈ +0.52`) and the sitter lands outside it (`local z = +0.95`). This reproduces today's relationship on the round table, where the group sits at radius 1.1 and the humanoid at 2.05.

**Scene lifecycle**

- Extract a `buildOffice(seatCount)` in `main.js` (or a small module) that: removes any previous table + seat groups, builds the rectangular table, creates `seatCount` seat groups from the layout, and produces the `layout`/camera anchors.
- Call it after a successful `loadRoom`, so the office always matches the room you picked. Call again on a different room (clean up old groups first; restoring vended geometry is optional).
- Before any room is chosen, the office shows **no table**; the memo covers the scene.
- `players.initPlayers` is re-run with the new `seats` and table dimensions on rebuild.

**Camera anchors**

- Each side seat gets a camera anchor behind the sitter, further out along the seat's outward direction (~1.0 beyond the avatar), and looks **straight across at the seat directly opposite** — same position along the table, on the far side — at table height (~0.95). Camera height stays ~2.9.
- The odd-count end seat has no opposite, so it looks at the **table centre**.
- The formula stays linear per side — no guessed coordinates. With two facing rows this puts the player opposite squarely in view; the look controls cover the neighbours.

**Avatars and debris**

- `players.js` humanoid placement is already in the seat's local frame, so it follows the new edges unchanged.
- Replace the circular floor test with a **rectangular table-footprint test** (half-extents + margin) and pass the table size instead of `tableRadius`.

### 3. Look left/right

- Global key handling (only while seated): **← held** pans the look target left, **→** right, up to about **±70°**; on release the view eases back to centre. `preventDefault()` so arrows don't scroll.
- The camera **position stays** at the seat anchor; only the look direction yaws around the vertical axis each frame (damped, same feel as the seat glide).
- **Disabled while the terminal editor is open** (user's requirement) and re-centred when it opens; also ignore events whose target is a form field.
- Expose this as a small camera API on `scene.js` (e.g. `setLookOffset(yaw)` / `getLookOffset()`), so the yaw math stays testable and `main.js` only feeds input.

## Files expected to change

| File | Change |
|---|---|
| `server/index.js` | `GET /rooms` listing; clamp seat count 1–10; accept name + issue operator token |
| `server/room.js` | Store `operatorName` / `operatorToken` / `operatorId` |
| `server/ws.js` | Operator by token instead of first joiner; queue routing to `operatorId` |
| `public/index.html` | Lobby list section; seat-count `max=10` |
| `public/css/style.css` | Lobby row styling |
| `public/js/main.js` | Build office from room state; lobby fetch/render/poll; look-key input; editor-open gating |
| `public/js/scene.js` | Rectangular table builder; camera look-offset support |
| `public/js/players.js` | Rectangular footprint for debris landing; table size input |
| `public/js/terminal.js` | Likely unchanged — `addSeat` already takes position + outward rotation |
| `test/server/http.test.js` | `GET /rooms` listing; seat-count clamp; creation returns a token |
| `test/server/ws.test.js` | Opener-by-token is operator; a first-sitting student is not |
| `test/client/…` | Seat layout math (counts/odd/within bounds); camera yaw offset |

## What's left to the builder

- Exact seat pitch and table dimensions versus the place-setting footprint (possibly tightening the printer's side offset).
- Whether a rebuild disposes geometry/textures or just detaches the groups (memory is not a practical concern at this scale).
- Look speed, damping constant, and the exact yaw cap within "about ±70°".
- Lobby refresh interval and row copy/styling.
- Room-list ordering and whether to hide rooms when the server restarts (rooms are memory-only; empty rooms vanish with the server).
