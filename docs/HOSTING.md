# The Operator's Handbook

**MIPS DIVISION · OPERATOR'S HANDBOOK · REV. C · 1986**

> **INTEROFFICE MEMO**
>
> **TO:** Shift Operator<br>
> **FROM:** Data Processing<br>
> **RE:** Night Shift Coverage<br>
> **DATE:** 14 NOV 1986
>
> You have the console. The room has the terminals. The mainframe has the queue.
>
> This handbook tells you how to run a 30-, 60-, or 90-minute shift without teaching assembly. The job cards are paste-ready; the players change the data and one or two lines. The machine does the rest.
>
> Read the checklist. Open the room. Keep the coffee hot.
>
> Data Processing

## Contents

- [What this is](#what-this-is)
- [What you need](#what-you-need)
- [Before the shift](#before-the-shift)
- [Opening the office](#opening-the-office)
- [The terminal in five minutes](#the-terminal-in-five-minutes)
- [The batch loop](#the-batch-loop)
- [The operator's console](#the-operators-console)
- [The office gadgets](#the-office-gadgets)
- [The job board](#the-job-board)
  - [PAY-86-01: Payroll Run](#pay-86-01-payroll-run)
  - [INV-86-02: Inventory Reorder](#inv-86-02-inventory-reorder)
  - [BIL-86-03: Invoice](#bil-86-03-invoice)
  - [ADM-86-04: Mail Merge](#adm-86-04-mail-merge)
  - [OPS-86-05: Crash Report](#ops-86-05-crash-report)
  - [OPS-86-06: Wall Board](#ops-86-06-wall-board)
- [The operator's queue drill](#the-operators-queue-drill)
- [The reference race](#the-reference-race)
- [Run sheets](#run-sheets)
- [Player briefing](#player-briefing)
- [Operator's maintenance](#operators-maintenance)
- [Glossary](#glossary)
- [Shift log](#shift-log)
- [Appendix A: Operator's answer key](#appendix-a-operators-answer-key)

## What this is

MIPS Office is a networked browser game. Everyone sits at a CRT, writes MIPS assembly in a line editor, submits a deck to a shared queue, and waits for the listing to print on paper. Bad code explodes the terminal.

The game has no task system. This handbook is the task system. It gives you six job cards, a queue drill, a reference race, and three run sheets. The test suite runs every job card against the game's simulator. The host reads the cards and runs the operator console. The players do the work.

The game's feature reference is the [README](../README.md). This handbook assumes you can start the server and read a job card; it does not repeat the architecture.

The players need modern programming instincts, not MIPS knowledge. They will read a spec, change a data table, fix an off-by-one, and watch a line printer. The assembly is the office equipment, not the lesson.

## What you need

- Node.js 18+ and a machine that can run the server.
- A modern browser with WebGL for each player.
- Internet on first load (Three.js and the fonts come from CDNs).
- A room with 1–10 players, each at a browser and a seat.
- A second screen or printed copies of the job cards.
- A timer.
- Sound. The mainframe hum and the explosion are part of the shift.

## Before the shift

```bash
npm install
npm start
```

Open `http://localhost:3000` on the host machine. Players on the same network open `http://<host-ip>:3000`; find the host IP with `hostname -I` on Linux or `ipconfig` on Windows. The server listens on all interfaces. This is a LAN party, not a production deployment.

Checklist:

- [ ] The server is running. Keep its terminal open.
- [ ] The host browser is open at `http://localhost:3000`.
- [ ] Sound is on. Tell the room the first crash is loud.
- [ ] The job cards are open on a second screen or printed.
- [ ] The player briefing is printed. It is at the end of this handbook.
- [ ] The run sheet is chosen. The 30-minute core is the default.
- [ ] The shift log is ready. Paper is fine.
- [ ] Coffee.

The server holds every room in memory. A restart wipes the rooms, the queues, and the gadget state. Do not restart mid-shift.

## Opening the office

1. **Open a room.** Enter your name, choose 1–10 seats, and press **Open a room**. You get a room ID.
2. **Share the room ID.** Players can click the room in the lobby's **Open rooms** list or paste the ID and press **Find my room**.
3. **Pick a seat.** Free seats are outlined; taken seats are hatched. Click a free seat, enter a name, and optionally a profile picture URL. Press **Sit down**.
4. **Sit first.** The room opener is the operator even if someone else sits first. The operator token lives in this tab's `sessionStorage`. If you refresh, rejoin from the lobby in the same tab; another tab or browser will not be the operator.
5. **Look around.** Hold **Left Arrow** or **Right Arrow** while seated to look that way. Release to face forward. The editor disables look while it is open.

The table sizes to the seat count: two facing rows, with a seat at the west end for odd counts. Your name tag floats over your avatar; your own tag is hidden. Other players see it. The profile picture falls back to text if the URL fails.

> **OPERATOR'S NOTE.** The room is the session. If a player disconnects, their seat frees and their queued job dies. If the server dies, the room is gone. Keep the server terminal visible and the coffee away from it.

## The terminal in five minutes

The **Editor** button in the top-right HUD, or sitting down, opens your terminal: a phosphor-green character glass, a status line, and a `>` prompt. You do not edit with a cursor. You command the machine.

| Command | What it does |
|---|---|
| `L` | List the whole deck |
| `L 3-7` | List lines 3 to 7 |
| `I 5` | Insert mode before line 5; a lone `.` ends |
| `I` | Insert at the end |
| `I 5 TEXT` | Insert one line before line 5 |
| `C 3 TEXT` | Replace line 3 |
| `D 3` / `D 3-5` | Delete a line or range |
| `T` | Show the top of the deck |
| `SUBMIT` | Send the deck to the queue |
| `KILL n` / `BUMP n` | Operator only: kill or prioritize job n |
| `REF` | Open the reference card |
| `HELP` | Command summary |

Rules of the glass:

- Everything you type is uppercased. The teletype had no lowercase. `$registers` normalize to lowercase; `\n`-style string escapes survive.
- The deck obeys the **80-column card**. A longer line is refused.
- Pasting a multi-line program reads it into the deck like paper tape: `5 LINES READ FROM TAPE`.
- Blank lines are dropped on paste. Comments are not. Every line you keep costs queue time.
- The glass is a real 80×24 grid. The 3D CRT mirrors it live.
- The editor disables arrow-key look. Close it to look around.

**The first drill.** Paste this into the terminal, then type `SUBMIT`:

```mips hello
.data
msg: .asciiz "HELLO, MACHINE ROOM"
.text
.globl main
main:
  la   $a0, msg
  li   $v0, 4
  syscall
  li   $v0, 10
  syscall
```

It is ten lines. The queue is three seconds. The listing prints; the program prints `HELLO, MACHINE ROOM` below the dashed divider. That is the whole loop. The rest of the shift is bigger decks.

> **1986 FILE: THE LINE EDITOR.** The machine had no cursor because the terminal was a teletype. You typed a command, the machine typed back. The line editor is slower than your editor. That is the point. The constraint is the lesson.

## The batch loop

`SUBMIT` sends the deck to the **mainframe queue**:

1. Your terminal locks the job: `JOB #3 — QUEUED, 2 AHEAD`. You can edit the next deck while you wait. You cannot submit a second job until the first clears.
2. Every job costs `1s + 0.2s × lines`. Your wait is every job ahead of yours plus your own. The server ticks the queue every 250ms.
3. When your slot arrives, the mainframe hum starts and your **listing** prints onto your paper card at teletype pace:
   - **SOURCE**: your lines, with `†` in the margin for errors, printed open.
   - **MACHINE CODE**: the assembled words, printed folded. Click the header to open.
   - **SYMBOLS**: labels and addresses, folded.
   - `== ASSEMBLY CLEAN ==` or `== ASSEMBLY HALTED ==`.
4. A clean listing runs. The program's output prints below a dashed divider on the same card.
5. The terminal returns to `READY`. Submit again.

A halted listing or a runtime crash **explodes your terminal**. The CRT and avatar hop on a parabola; debris bounces across the table; flames flash across the glass. Everyone sees it. You get the flames under your fingers.

> **QUEUE MATH.** A 40-line payroll deck is 9 seconds. Six of them are 54 seconds. The room waits. The line count is the cost. The "make it fast" challenges in the job cards are not busywork; they buy the room time.

> **1986 FILE: THE QUEUE.** The mainframe ran one job at a time. A fifty-line deck held the machine for eleven seconds. Six programmers in a room could feel that. The queue was not a progress bar; it was a line of people.

## The operator's console

The room opener is the operator. Your editor prints the queue when it changes:

```
--- THE QUEUE (OPERATOR) ---
  #3  RUNNING  40 LINES
  #4  QUEUED   62 LINES
  #5  QUEUED   17 LINES
```

`KILL n` cancels job n. The owner sees `JOB CANCELLED BY OPERATOR`. `BUMP n` moves job n to the front. The queue is FIFO until you say otherwise.

Use the powers once or twice, and explain the fiction. The operator was a person with a badge and a queue. The machine did not care; the operator did. A host who kills every job is a bad operator. A host who bumps the payroll job at 4:55 is a hero.

> **1986 FILE: THE OPERATOR.** You brought your deck to a window. A person took it. The operator decided whose job ran first. The queue was a social contract with a badge.

## The office gadgets

Office hardware is memory-mapped into the simulator's static-data window. A program uses a gadget by storing into its address.

| Gadget | Address | Visibility | Write |
|---|---|---|---|
| Office printer | `0x10030000` | Private; your paper only | `sb`: one ASCII byte per store |
| Display board | `0x10031000` | Shared; the wall board | `sb`: one ASCII byte per store |
| Game controller | `0x10032000` | Shared state | `sw`: raw words |

- The **printer** paints your desk paper. The paper card shows the listing and the program's output. **Tear off** dismisses it; the next byte re-pins it.
- The **display board** is the wall bulletin. It holds 4 lines of 36 characters. The board clears when a job starts; the last job to run owns it.
- The **controller** is writable but not readable, and it has no display. Do not build a job around it.
- Your `.data` starts at `0x10010000`; the gadgets sit at `0x10030000`; the heap starts at `0x10040000`. Do not overwrite your own strings.
- The **reference card** has the machine map, the editor commands, 623 instructions, the four syscalls, the registers, and the ASCII table. There is no autocomplete. That is the era.

> **1986 FILE: MEMORY-MAPPED I/O.** The printer and the board were not files or APIs; they were addresses. You stored a byte, and the hardware did something. The game keeps that: `sb` to `0x10030000` prints a character.

## The job board

The game does not score your work. The operator does. Each job card has:

- a **memo** with the business spec;
- a **starter deck** that assembles and runs;
- the **expected output** on the paper card;
- three challenges: **make it run**, **make it right**, **make it fast**;
- **host notes** for the live shift;
- a pointer to the **answer key** in Appendix A.

The players paste the starter deck, submit it, read the listing, and compare the output. The "make it right" change is the realistic part: overtime, a new stock item, dollars and cents, a blank name, a bad address, a shared message. The "make it fast" challenge is the batch part: fewer lines, less queue, more room time.

`npm test` runs every starter deck against the simulator. If a player changes a line and breaks it, the listing tells them where. The reference card tells them what the instruction does. You do not need to teach assembly; point at the card.

### Line budget

| Deck | Lines | Queue |
|---|---:|---:|
| `hello` | 10 | 3.0s |
| `pay-86-01` | 40 | 9.0s |
| `pay-86-01-overtime` | 51 | 11.2s |
| `pay-86-01-fast` | 37 | 8.4s |
| `inv-86-02` | 50 | 11.0s |
| `inv-86-02-add` | 51 | 11.2s |
| `bil-86-03` | 62 | 13.4s |
| `bil-86-03-money` | 83 | 17.6s |
| `adm-86-04` | 30 | 7.0s |
| `adm-86-04-blank` | 39 | 8.8s |
| `adm-86-04-sentinel` | 27 | 6.4s |
| `ops-86-05` | 8 | 2.6s |
| `ops-86-05-fixed` | 12 | 3.4s |
| `ops-86-06` | 17 | 4.4s |
| `ops-86-06-two` | 17 | 4.4s |

The line count is the non-empty deck. Blank lines are dropped on paste; comments count. The queue adds up to 250ms of tick.

---

## PAY-86-01: Payroll Run

> **MEMO**
>
> **TO:** Payroll<br>
> **FROM:** Data Processing<br>
> **RE:** Week 46 gross pay
>
> The payroll tape has three employees. Compute gross pay for each: hours × rate. Print one line per employee: name, a space, gross. The night shift will audit the report.

**Starter deck** (paste into the terminal):

```mips pay-86-01
.data
name0:   .asciiz "ADA"
name1:   .asciiz "BOB"
name2:   .asciiz "CY"
names:   .word name0, name1, name2
hours:   .word 40, 35, 42
rates:   .word 12, 15, 10
count:   .word 3
.text
.globl main
main:
  la   $s0, names
  la   $s1, hours
  la   $s2, rates
  lw   $s3, count
loop:
  beqz $s3, done
  lw   $a0, 0($s0)
  li   $v0, 4
  syscall
  li   $a0, 32
  li   $v0, 11
  syscall
  lw   $t0, 0($s1)
  lw   $t1, 0($s2)
  mul  $t2, $t0, $t1
  move $a0, $t2
  li   $v0, 1
  syscall
  li   $a0, 10
  li   $v0, 11
  syscall
  addi $s0, $s0, 4
  addi $s1, $s1, 4
  addi $s2, $s2, 4
  addi $s3, $s3, -1
  j    loop
done:
  li   $v0, 10
  syscall
```

**Expected output:**

```
ADA 480
BOB 525
CY 420
```

**Make it run.** Paste, `SUBMIT`, wait. The listing should say `== ASSEMBLY CLEAN ==`; the output prints below the divider. If the listing halts, read the `†` line, fix it with `C` or `D`, and submit again.

**Make it right.** The night shift approved overtime: hours over 40 are paid at 1.5×. CY worked 42 hours. Replace the `mul $t2, $t0, $t1` line with this block, and keep the `move $a0, $t2` line after it:

```mips
  li   $t3, 40
  ble  $t0, $t3, base
  sub  $t4, $t0, $t3
  mul  $t4, $t4, $t1
  mul  $t4, $t4, 3
  srl  $t4, $t4, 1
  mul  $t2, $t3, $t1
  add  $t2, $t2, $t4
  j    print
base:
  mul  $t2, $t0, $t1
print:
```

The block is a branch: hours at or below 40 take the base path; hours above 40 take the overtime path. The expected output changes one line:

```
ADA 480
BOB 525
CY 430
```

The full overtime deck is in [Appendix A](#appendix-a-operators-answer-key).

**Make it fast.** The starter is 40 lines, 9.0 seconds. Cut three lines without changing the output:

- Delete `.globl main`. The simulator finds `main` without it.
- Delete the `count:` data line and replace `lw $s3, count` with `li $s3, 3`.
- Replace the `mul $t2, $t0, $t1` and `move $a0, $t2` pair with `mul $a0, $t0, $t1`.

That is 37 lines, 8.4 seconds. The full fast deck is in Appendix A. If the player already did the overtime block, cut the first two only; the overtime block owns the multiply.

**Host notes.**

- Starter: 40 lines, 9.0s. Overtime: 51 lines, 11.2s. Fast: 37 lines, 8.4s.
- The common mistake is the branch direction. `ble` branches to the base path when hours are at or below 40. A `bgt` there pays overtime to everyone under 40.
- The `mul` pseudo takes three registers. The starter writes `$t2` then moves it; the fast cut writes `$a0` directly.
- Expected overtime: ADA 480, BOB 525, CY 430. If CY is 420, the branch never ran. If CY is 630, the player paid overtime on all 42 hours.
- The report is private. The player reads it on the card. Do not broadcast it.

> **1986 FILE: THE PAYROLL RUN.** Payroll was a batch job. You wrote the deck, submitted it, and waited for the listing. The pay stubs came off a line printer in the morning. The machine did not know it was payday; it knew the line count.

---

## INV-86-02: Inventory Reorder

> **MEMO**
>
> **TO:** Stockroom<br>
> **FROM:** Data Processing<br>
> **RE:** Week 46 reorder list
>
> The stockroom tape has five items. Print each item and its status. An item at or below its reorder threshold is `REORDER`; anything else is `OK`. The stockroom clerk reads this on paper.

**Starter deck:**

```mips inv-86-02
.data
item0:  .asciiz "PAPER"
item1:  .asciiz "TONER"
item2:  .asciiz "STAPLES"
item3:  .asciiz "COFFEE"
item4:  .asciiz "DISKS"
items:  .word item0, item1, item2, item3, item4
stock:  .word 12, 2, 40, 5, 1
reorder: .word 10, 5, 20, 5, 3
count:  .word 5
yes:    .asciiz "REORDER"
no:     .asciiz "OK"
.text
.globl main
main:
  la   $s0, items
  la   $s1, stock
  la   $s2, reorder
  lw   $s3, count
loop:
  beqz $s3, done
  lw   $a0, 0($s0)
  li   $v0, 4
  syscall
  li   $a0, 32
  li   $v0, 11
  syscall
  lw   $t0, 0($s1)
  lw   $t1, 0($s2)
  bgt  $t0, $t1, ok
  la   $a0, yes
  li   $v0, 4
  syscall
  j    next
ok:
  la   $a0, no
  li   $v0, 4
  syscall
next:
  li   $a0, 10
  li   $v0, 11
  syscall
  addi $s0, $s0, 4
  addi $s1, $s1, 4
  addi $s2, $s2, 4
  addi $s3, $s3, -1
  j    loop
done:
  li   $v0, 10
  syscall
```

**Expected output:**

```
PAPER OK
TONER REORDER
STAPLES OK
COFFEE REORDER
DISKS REORDER
```

**Make it run.** Paste, submit, read. The branch is `bgt`: stock greater than the threshold goes to `OK`; everything else falls into `REORDER`. That makes the threshold inclusive, which is what the stockroom asked for.

**Make it right.** The stockroom added a sixth item: `RIBBON`, zero on hand, reorder at two. Add it to the tape:

- a `item5: .asciiz "RIBBON"` line;
- `item5` at the end of the `items` table;
- `0` at the end of `stock`;
- `2` at the end of `reorder`;
- `6` in `count`.

The output gains one line:

```
RIBBON REORDER
```

The full six-item deck is in Appendix A. If the room is quick, change `COFFEE`'s reorder threshold from 5 to 4 instead; `COFFEE REORDER` becomes `COFFEE OK`.

**Make it fast.** The starter is 50 lines, 11.0 seconds. Cut two lines:

- Delete `.globl main`.
- Delete the `count:` data line and replace `lw $s3, count` with `li $s3, 5`.

That is 48 lines, 10.6 seconds. The six-item deck is 51 lines, 11.2 seconds; the same two cuts bring it to 49 lines, 10.8 seconds. The hard cut is the data layout: replace the three parallel arrays with one table of three-word records and one pointer. That saves two `addi` lines but costs a rewrite. Offer it as a bonus, not a requirement.

**Host notes.**

- Starter: 50 lines, 11.0s. Six items: 51 lines, 11.2s.
- The `reorder:` data label and the `REORDER` string are different things. A player who renames one and not the other gets an assembly error. The listing's symbol table shows both.
- The arrays are parallel: names, stock, thresholds. The loop advances all three pointers by 4. A player who forgets one `addi` gets shifted data, not a crash.
- The expected six-item output adds `RIBBON REORDER` at the end.
- The report is private. The stockroom clerk reads it on the card.

> **1986 FILE: THE STOCKROOM REPORT.** The stockroom ran on paper. The report came off a line printer, went on a clipboard, and someone walked the aisles with a pencil. The machine's job was to put the right words in the right column.

---

## BIL-86-03: Invoice

> **MEMO**
>
> **TO:** Billing<br>
> **FROM:** Data Processing<br>
> **RE:** Invoice 8841
>
> Bill the customer for three line items. Prices are in cents; the machine has no decimal point. Print the subtotal, the 8% tax, and the total. The night shift left three item names in the deck; they are dead weight.

**Starter deck:**

```mips bil-86-03
.data
item0: .asciiz "DISKS"
item1: .asciiz "TONER"
item2: .asciiz "PAPER"
qty:   .word 2, 1, 10
price: .word 450, 8900, 120
count: .word 3
sub:   .asciiz "SUBTOTAL "
tax:   .asciiz "TAX "
tot:   .asciiz "TOTAL "
.text
.globl main
main:
  la   $s0, qty
  la   $s1, price
  lw   $s2, count
  li   $s3, 0
loop:
  beqz $s2, taxcalc
  lw   $t0, 0($s0)
  lw   $t1, 0($s1)
  mul  $t2, $t0, $t1
  add  $s3, $s3, $t2
  addi $s0, $s0, 4
  addi $s1, $s1, 4
  addi $s2, $s2, -1
  j    loop
taxcalc:
  la   $a0, sub
  li   $v0, 4
  syscall
  move $a0, $s3
  li   $v0, 1
  syscall
  li   $a0, 10
  li   $v0, 11
  syscall
  mul  $t3, $s3, 8
  li   $t4, 100
  div  $t3, $t4
  mflo $t3
  la   $a0, tax
  li   $v0, 4
  syscall
  move $a0, $t3
  li   $v0, 1
  syscall
  li   $a0, 10
  li   $v0, 11
  syscall
  add  $s4, $s3, $t3
  la   $a0, tot
  li   $v0, 4
  syscall
  move $a0, $s4
  li   $v0, 1
  syscall
  li   $a0, 10
  li   $v0, 11
  syscall
  li   $v0, 10
  syscall
```

**Expected output:**

```
SUBTOTAL 11000
TAX 880
TOTAL 11880
```

**Make it run.** Paste, submit, read. The amounts are cents: 11,000 cents is $110.00. The tax is `subtotal × 8 ÷ 100`, truncated to whole cents. The dead `item0`–`item2` labels do not affect the output.

**Make it right.** Billing needs dollars and cents, not raw cents. Print `$110.00`, `$8.80`, `$118.80`.

Add this routine after the main exit:

```mips
print_money:
  move $s5, $a0
  li   $a0, 36
  li   $v0, 11
  syscall
  li   $t4, 100
  div  $s5, $t4
  mflo $a0
  li   $v0, 1
  syscall
  li   $a0, 46
  li   $v0, 11
  syscall
  mfhi $t5
  li   $t4, 10
  bge  $t5, $t4, cents
  li   $a0, 48
  li   $v0, 11
  syscall
cents:
  move $a0, $t5
  li   $v0, 1
  syscall
  jr   $ra
```

Then replace each three-line print sequence with a call:

```mips
  move $a0, $s3
  li   $v0, 1
  syscall
```

becomes:

```mips
  move $a0, $s3
  jal  print_money
```

Do the same for `$t3` (tax) and `$s4` (total). The routine prints the `$`, the dollars, the `.`, a leading zero when the cents are under 10, and the cents. The expected output:

```
SUBTOTAL $110.00
TAX $8.80
TOTAL $118.80
```

The full formatted deck is in Appendix A. This is the stretch job; skip it if the room is behind.

**Make it fast.** The starter is 62 lines, 13.4 seconds. The three `item0`–`item2` labels are dead. Delete them. Then cut the usual two: `.globl main`, and the `count` variable with `li $s2, 3`. That is five lines, one second. The formatted deck is 83 lines, 17.6 seconds; the same five cuts bring it to 78 lines, 16.6 seconds.

**Host notes.**

- Starter: 62 lines, 13.4s. Formatted: 83 lines, 17.6s.
- The integer cents are deliberate. The machine does integer math; the business keeps money in cents. The formatting is a display problem, not a floating-point problem.
- `div` writes the quotient to `LO` and the remainder to `HI`. `mflo` reads the dollars; `mfhi` reads the cents. A player who reads them in the wrong order prints nonsense.
- The leading-zero branch is the only edge case that matters: 8 cents must print as `.08`, not `.8`.
- The formatted invoice is the longest job in the handbook. Submit it early, or use the fast cuts. The operator can bump it if the room is waiting on the totals.

> **1986 FILE: THE INVOICE.** The invoice was a report, not a screen. The line printer had a tractor feed and a box of forms. The machine printed the numbers; a person separated the copies. Integer cents kept the totals honest.

---

## ADM-86-04: Mail Merge

> **MEMO**
>
> **TO:** Administration<br>
> **FROM:** Data Processing<br>
> **RE:** Terminal assignment notices
>
> Print a notice for each name on the mailing list. The notice is two lines: `ATTN: <name>` and `YOUR TERMINAL IS READY.` Leave a blank line between notices. The list has three names. The fourth slot is empty; the clerk wants it handled as `OCCUPANT`, not as a blank.

**Starter deck:**

```mips adm-86-04
.data
n0:  .asciiz "ADA"
n1:  .asciiz "BOB"
n2:  .asciiz "CY"
names: .word n0, n1, n2
count: .word 3
head: .asciiz "ATTN: "
body: .asciiz "\nYOUR TERMINAL IS READY.\n\n"
.text
.globl main
main:
  la   $s0, names
  lw   $s1, count
loop:
  beqz $s1, done
  la   $a0, head
  li   $v0, 4
  syscall
  lw   $a0, 0($s0)
  li   $v0, 4
  syscall
  la   $a0, body
  li   $v0, 4
  syscall
  addi $s0, $s0, 4
  addi $s1, $s1, -1
  j    loop
done:
  li   $v0, 10
  syscall
```

**Expected output:**

```
ATTN: ADA
YOUR TERMINAL IS READY.

ATTN: BOB
YOUR TERMINAL IS READY.

ATTN: CY
YOUR TERMINAL IS READY.

```

**Make it run.** Paste, submit, read. The `body` string carries the newlines. The `\n` escapes survive the editor's uppercase pass; the simulator turns them into bytes 10.

**Make it right.** Add a fourth name that is an empty string, set `count` to 4, and replace the `lw $a0, 0($s0)` line with this block:

```mips
  lw   $t0, 0($s0)
  lb   $t1, 0($t0)
  bnez $t1, have_name
  la   $a0, occupant
  j    print_name
have_name:
  move $a0, $t0
print_name:
```

Add `n3: .asciiz ""`, append `n3` to the `names` table, and add `occupant: .asciiz "OCCUPANT"` to the data. The block loads the name pointer, reads its first byte, and branches to the normal path when the byte is not zero. An empty string starts with zero, so it prints `OCCUPANT`. The output gains:

```
ATTN: OCCUPANT
YOUR TERMINAL IS READY.

```

The full deck is in Appendix A.

**Make it fast.** The starter is 30 lines, 7.0 seconds. The classic batch trick is a sentinel: end the `names` table with a zero word and drop `count` entirely. The loop loads the pointer, exits on zero, and never decrements a counter. The sentinel deck is 27 lines, 6.4 seconds. It is in Appendix A. It prints the same three notices. To add the blank name, put `n3` before the zero sentinel and use the blank-name block; the sentinel exits on the zero after it.

**Host notes.**

- Starter: 30 lines, 7.0s. Blank-name deck: 39 lines, 8.8s. Sentinel: 27 lines, 6.4s.
- The name table is a table of pointers, not characters. The `lw` gets the address of the string; the `li $v0, 4` prints from that address until the zero byte.
- The blank-name check reads one byte with `lb`. A player who uses `lw` reads four bytes and compares a word; it can work, but the listing is easier to explain with `lb`.
- The `\n` in the data is two characters in the source and one byte in memory. The editor preserves it; the simulator interprets it. A player who types an actual line break inside the string gets an assembly error.
- The fourth name is the data-validation lesson. Modern code would check for null or empty; the 80s deck checks the first byte.

> **1986 FILE: THE MAIL MERGE.** The mailing list lived on a tape. The merge program read names, printed letters, and changed the paper. A blank name was not a metaphor; it was a slot someone forgot to fill. The clerk wanted `OCCUPANT` because a letter addressed to nobody looked worse than a letter addressed to the occupant.

---

## OPS-86-05: Crash Report

> **MEMO**
>
> **TO:** Operations<br>
> **FROM:** Night Shift<br>
> **RE:** Terminal 4, 03:12
>
> The night shift left a job that writes to `0x8000`. The terminal went down. The listing is on the card. Find the bad store, fix the address, and send one letter `A` to the printer as proof. The room will hear the explosion. That is expected.

**Starter deck:**

```mips ops-86-05
.text
.globl main
main:
  li   $t0, 0x8000
  li   $t1, 65
  sb   $t1, 0($t0)
  li   $v0, 10
  syscall
```

**Expected failure:**

```
RUN ERROR: RuntimeError: Runtime exception at 0x00400008:
address out of range 0x00008000
```

The terminal explodes. The listing prints first, so the evidence survives the bang: the source line `li $t0, 0x8000` and the runtime address `0x00008000` are both on the card.

**Make it right.** `0x8000` is not your memory. Your `.data` starts at `0x10010000`; the printer is at `0x10030000`. The shortest fix changes one line:

```mips
  li   $t0, 0x10030000
```

Now the `sb` writes byte 65 (`A`) to the printer. The deck stays eight lines, 2.6 seconds. The printer card shows `A`.

The safer habit is a legal buffer plus the printer. The full deck in Appendix A writes `A` to a four-byte `.data` buffer, then writes the same byte to the printer. Both writes are legal; the printer makes the result visible. Accept either fix.

**Host notes.**

- The crash is a demo, not a punishment. Warn the room before you submit it. The explosion is loud, the avatar hops, and the glass flashes.
- The listing shows the source line and the runtime address. The error is an address, not an instruction. The player fixes the `li`, not the `sb`.
- The reference card's machine map has the printer, the board, and the controller. The symbol table on the listing has the `.data` labels. Both are legal addresses.
- If a player writes to `0x10030000` with `sw` instead of `sb`, the printer takes the low byte and drops the rest. The listing stays clean, the card may look odd. Point at the reference card: the printer takes bytes.
- The fixed deck is 12 lines, 3.4 seconds. The one-line printer fix is 8 lines, 2.6 seconds. The queue difference is small; the lesson is the address.

> **1986 FILE: THE EXPLOSION.** The machine had no memory protection worth the name. A bad address could take a terminal down, and the room saw it. The failure was public because the hardware was public. The game keeps the explosion because a private stack trace is a modern comfort the era did not have.

---

## OPS-86-06: Wall Board

> **MEMO**
>
> **TO:** Operations<br>
> **FROM:** Shift Supervisor<br>
> **RE:** Office bulletin
>
> Post the shift status on the display board. The board is shared; the last job to run owns it. It holds four lines of 36 characters. The printer is private; the board is the office. Make the room read it.

**Starter deck:**

```mips ops-86-06
.data
msg: .asciiz "SHIFT 2: ALL TERMINALS ONLINE"
.text
.globl main
main:
  li   $t0, 0x10031000
  la   $t1, msg
loop:
  lb   $t2, 0($t1)
  beqz $t2, done
  sb   $t2, 0($t0)
  addi $t0, $t0, 1
  addi $t1, $t1, 1
  j    loop
done:
  li   $v0, 10
  syscall
```

**Expected board:**

```
SHIFT 2: ALL TERMINALS ONLINE
```

**Make it run.** Paste, submit, read. The program loads the board address, walks the string byte by byte, and stores each byte until the zero terminator. The wall board changes; the player's printer stays empty. The board is shared, so everyone sees it.

**Make it right.** The supervisor wants two lines: the status and the payroll deadline. Change the string to:

```mips
msg: .asciiz "SHIFT 2: ALL TERMINALS ONLINE\nPAYROLL DUE 17:00"
```

The board splits on the newline byte and shows:

```
SHIFT 2: ALL TERMINALS ONLINE
PAYROLL DUE 17:00
```

The full deck is in Appendix A. Each line must fit 36 characters; the board truncates the rest. Four lines maximum. A third line is a flex.

**Make it fast.** This is the race job. The board clears when a job starts. The last job to finish owns the wall. Submit after the other team, or ask the operator to `BUMP` your job. The deck is 17 lines, 4.4 seconds. The line count matters less than the order.

**Host notes.**

- The board is shared. The printer is private. A player who writes the status to `0x10030000` sees it on their own paper and nowhere else.
- The board clears at the start of every job, not at the end. The last job's message is the one that stays. The operator can change the order with `BUMP`.
- The board's canvas shows four lines of 36 characters. The string can be longer; the board truncates. A newline byte is 10; the `\n` escape produces it.
- The race works best with two teams and one operator. Team A submits; Team B submits after; the operator bumps one; the room watches the board. The last message is the office's official position.
- The board is a great place for the shift's running joke. Let the players change the message; the 36-character limit makes it funnier.

> **1986 FILE: THE BULLETIN BOARD.** The office bulletin was a corkboard by the coffee machine. A new memo covered the old one. The last person to pin something won the wall. The display board is that corkboard with a memory and a queue.

---

## The operator's queue drill

The queue is the social layer. The job cards teach the terminal; this drill teaches the room that the machine is shared.

**Setup.** Ask four or five players to submit a deck. The payroll, the wall board, and any starter work. The operator's editor prints:

```
--- THE QUEUE (OPERATOR) ---
  #1  RUNNING  40 LINES
  #2  QUEUED   17 LINES
  #3  QUEUED   62 LINES
  #4  QUEUED   50 LINES
```

**The deadline job.** Pick the payroll as the 5:00 deadline. Type `BUMP 4` (or whatever its number is). The queue reorders; the payroll runs next. Say: "Payroll has a deadline. The board can wait. The operator decides."

**The runaway job.** Pick the longest deck as the runaway. Type `KILL 3` (or whatever its number is). The owner sees `JOB CANCELLED BY OPERATOR`. Say: "The night shift budgeted eleven seconds for this job. The operator has a room full of people. The job is cancelled."

Pick a volunteer for the kill and tell them it is a demo. They can resubmit immediately. If the room is tender, kill a deck you submitted yourself.

**The negotiation.** Let the room re-submit and argue. The queue is FIFO unless the operator intervenes. The operator's job is to keep the shift moving, not to be fair to every deck. The room learns the line count is a budget.

**Queue math.** A 40-line job is 9 seconds; a 62-line job is 13.4; a 17-line job is 4.4. The queue is the sum. The operator can buy time with `BUMP` and cancel a job with `KILL`.

> **OPERATOR'S NOTE.** Use the powers once or twice, and explain why. An operator who kills every job teaches the room that the queue is arbitrary. An operator who never touches it teaches the room that the queue is a force of nature. The truth is in between: the queue is a person with a console.

> **1986 FILE: THE OPERATOR'S WINDOW.** You did not submit a job from your desk. You carried the deck to a window. The operator took it, stamped it, and put it in a tray. The operator knew whose job was urgent because the operator knew the people. The console is that window.

## The reference race

The reference card is the manual. The race teaches the room to open it. Everyone types `REF` or clicks the **Reference** HUD button. The host reads a question; the first hand up answers. No touching another terminal.

| # | Question | Answer |
|---|---|---|
| 1 | Which syscall prints a string? | `4` |
| 2 | Which syscall prints an integer? | `1` |
| 3 | Which syscall exits? | `10` |
| 4 | Which syscall prints a character? | `11` |
| 5 | What is the printer's address? | `0x10030000` |
| 6 | What is the display board's address? | `0x10031000` |
| 7 | Which instruction stores a byte? | `sb` |
| 8 | Which instruction loads a word? | `lw` |
| 9 | What is the ASCII decimal for `A`? | `65` |
| 10 | Which editor command lists lines 3–7? | `L 3-7` |
| 11 | Which editor command replaces line 3? | `C 3 TEXT` |
| 12 | What is the maximum line width? | 80 columns |

Tie-breaker: the ASCII decimal for `Z` (90), or the address of the controller (`0x10032000`). The controller is writable but not displayed; the answer is still on the card.

> **1986 FILE: THE REFERENCE CARD.** The manual was a laminated card or a binder by the terminal. There was no autocomplete, no search, and no Stack Overflow. The card was the documentation. Knowing where to look was the skill.

## Run sheets

### The 30-minute core

The default shift. It fits a lunch break and leaves the room wanting the rest.

| Min | Beat | Job | What happens |
|---:|---|---|---|
| 0–3 | Clock in | n/a | Open the room, seats, sound, look controls. |
| 3–5 | Terminal drill | `hello` | Paste, submit, read the listing. |
| 5–15 | Payroll | `pay-86-01` | Starter, then overtime if the room is quick. |
| 15–20 | Wall board | `ops-86-06` | Two-line message; the last job wins. |
| 20–26 | Crash report | `ops-86-05` | Predict, explode, read the listing, fix the address. |
| 26–30 | Debrief | n/a | Read the cards; fill the shift log. |

### The 60-minute standard

Adds the reference race and the operator's queue drill.

| Min | Beat | Job | What happens |
|---:|---|---|---|
| 0–5 | Clock in | n/a | Room, seats, sound, look. |
| 5–10 | Terminal drill + reference race | `hello` | Five questions while the first jobs run. |
| 10–25 | Payroll | `pay-86-01` | Starter, overtime, fast cuts. |
| 25–35 | Wall board | `ops-86-06` | Two lines, two teams, one operator. |
| 35–45 | Crash report | `ops-86-05` | Explode, fix, print the `A`. |
| 45–55 | Operator's queue | n/a | `BUMP` the deadline job; `KILL` the runaway. |
| 55–60 | Debrief | n/a | Cards, log, board. |

### The 90-minute full shift

All six job cards. The invoice is the stretch; drop it or the mail merge if the room is slow.

| Min | Beat | Job |
|---:|---|---|
| 0–5 | Clock in | n/a |
| 5–10 | Terminal drill | `hello` |
| 10–25 | Payroll | `pay-86-01` |
| 25–40 | Inventory | `inv-86-02` |
| 40–55 | Invoice | `bil-86-03` |
| 55–65 | Mail merge | `adm-86-04` |
| 65–75 | Wall board | `ops-86-06` |
| 75–85 | Crash + operator's queue | `ops-86-05` |
| 85–90 | Debrief | n/a |

### The host script

**Opening.** "Welcome to MIPS Division. It's 1986. You each have a terminal, a reference card, and a job board. The mainframe is shared. You do not need to know assembly. You need to read the job card and change the lines it tells you to change. The machine will tell you if you're wrong."

**Before the first submit.** "The terminal is a line editor. There is no cursor. You paste the deck like paper tape. `SUBMIT` sends it to the queue. One job at a time. The listing prints on paper. The paper is the truth."

**Before the crash.** "This next job is from the night shift. It writes to an address that isn't ours. The terminal will explode. That is normal. The listing is the evidence. We will fix it."

**Before the board.** "The board is shared. The last job to run owns it. If you want the last word, submit after the other team. The operator can bump. The board is the office."

**Debrief.** "What did the listing tell you? What did the queue cost? What did the board say at the end? The machine was slow; the room was the debugger."

### Fallbacks

| If this happens | Do this |
|---|---|
| The room is fast | Add the inventory, the invoice, or the mail merge. Run the reference race. |
| The room is slow | Drop the "make it right" tier. Use the starters. The operator bumps the deadline job. |
| A player is stuck | Point at the `†` line and the reference card. Pair them with a neighbor. The answer key is in Appendix A. |
| A job hangs the terminal | The sim is client-side; a tight infinite loop can freeze the tab. Avoid infinite loops. If a tab freezes, close it, rejoin, and resubmit. The operator can kill the queued job. |
| A job crashes | The listing or the runtime error is on the card. Read the address. Fix the line. Resubmit. |
| The server dies | Open a new room. The old room is gone; the players rejoin. The new opener is the operator. The shift log is paper. |
| A player disconnects | The seat frees and the job dies. They rejoin and sit again. |
| The queue is long | Shorten decks; drop comments; use `BUMP`; run the reference race while the machine works. |
| The board is blank | The last job cleared it. Submit the board job again. The board clears at every job start. |
| The printer is blank | The program did not run, or it wrote to the wrong address. Check the listing and the machine map. |
| The explosion is too loud | Toggle **Sound: Off** in the HUD. Warn the room before the next crash. |
| The invoice formatting is too hard | Skip it. Accept the cents output. The job still teaches integer money. |
| The operator token is lost | Open a new room from the host tab. Rejoin as the operator. |

---

## Player briefing

**MIPS DIVISION · NIGHT SHIFT BRIEFING · 1986**

You are a programmer in an 80s office. The machine is a batch mainframe. You have one terminal, one reference card, and one job at a time. You do not need to know MIPS assembly. You need to read the job card and change the lines it tells you to change.

**Your terminal.** The **Editor** button opens it. `L` lists the deck, `I` inserts, `C 3 TEXT` changes a line, `D 3` deletes, `T` shows the top, `SUBMIT` sends the deck, `REF` opens the reference card, `HELP` lists the commands. Paste a multi-line deck like paper tape. The machine uppercases everything; 80 columns; no cursor.

**The queue.** One outstanding job per player. Every job costs 1 second plus 0.2 seconds per line. Your wait is every job ahead plus your own. The operator can kill or bump jobs. The queue is shared.

**The card.** When your slot arrives, the listing prints on paper: source, machine code, symbols, and `== ASSEMBLY CLEAN ==` or `== ASSEMBLY HALTED ==`. A clean listing runs; the output prints below the divider. A halted listing or a runtime crash explodes your terminal.

**The gadgets.** The printer is `0x10030000`, private to your paper. The display board is `0x10031000`, shared with the room. Both take `sb`, one ASCII byte per store. The board holds four lines of 36 characters; the last job to run owns it.

**The job board.** PAY-86-01 payroll. INV-86-02 inventory. BIL-86-03 invoice. ADM-86-04 mail merge. OPS-86-05 crash report. OPS-86-06 wall board. The operator hands out the deck for each job; copy it into your terminal.

**The rules.** Sit at a free seat. The room opener is the operator. The operator's decision is final. The board is shared; the printer is private. The explosion is normal. Do not run in the machine room. The coffee is for the operator.

**The goal.** Finish the shift with a clean listing and a report the host can read. The host checks the output; the machine does not score.

**If you get stuck.** Type `REF`. The reference card has the instructions, the syscalls, the registers, and the ASCII table. Ask the operator. Ask a neighbor. The room is the debugger.

---

## Operator's maintenance

### The room and the server

The server holds every room in memory. A restart wipes the rooms, the queues, and the gadget state. Keep the server terminal open and visible. If the server dies mid-shift, open a new room; the players rejoin; the new opener is the operator. The shift log is paper for this reason.

The server listens on all interfaces at port 3000. The host uses `http://localhost:3000`; the players use `http://<host-ip>:3000`. The first load needs internet for Three.js and the fonts; after that the browser cache helps. If a player sees a blank office, check the browser console and the WebGL support.

### The operator token

The room opener is the operator. The browser keeps the operator token in that tab's `sessionStorage`. Refreshing the same tab and rejoining from the lobby keeps the token. Another tab or another browser is not the operator. If you lose the token, open a new room; the new room's opener is the operator.

### The terminal

- A line longer than 80 columns is refused. The machine keeps the old line.
- Everything is uppercased except `$registers` and `\n`-style escapes. A label written `loop` becomes `LOOP`; the simulator does not care.
- Blank lines are dropped on paste. Comments are lines and count toward the queue.
- `L` lists the deck. `C 3 TEXT` replaces line 3. `D 3-5` deletes a range. `I 5` inserts before line 5; a lone `.` ends.
- The editor disables arrow-key look. Close it to look around. The 3D CRT mirrors the glass.

### The queue

- One outstanding job per player. A second `SUBMIT` is refused until the first clears.
- The queue ticks every 250ms. The ETA is approximate; the tick adds up to a quarter second.
- The operator sees the queue in the editor and uses `KILL n` / `BUMP n`. The server validates the operator's token.
- A disconnect kills the player's queued job and frees the seat.
- The simulator runs in the browser. An infinite loop can freeze the tab. Avoid infinite loops in the job cards; if a tab freezes, close it, rejoin, and resubmit.

### The gadgets

- The printer is private. The board is shared. A player who writes the status to the printer sees it on their own paper and nowhere else.
- The board holds four lines of 36 characters. It clears at the start of every job; the last job to run owns it.
- The controller is writable but not readable and has no display. Do not build a job around it.
- Cable pairs are half-wired: messages relay, incoming messages are not displayed, and the shared memory block is not synced. Do not rely on them for the session.

### The explosion

An assembly error or a runtime crash explodes the terminal. The listing prints before the bang, so the evidence is on the card. Read the `†` line or the runtime address, fix the line, resubmit. The explosion is office-wide and seat-targeted; the room sees it. Warn the room before the first one.

### Known limitations

- The game does not score jobs. The operator reads the cards.
- The queue is simulated; the client runs the code. The room is trusted.
- The controller can be written, not read. It has no display.
- Cable pairs relay but do not display or sync.
- The operator token is per-tab `sessionStorage`.
- Rooms and queues live in memory; a restart wipes them.
- Every failure is the full explosion; there are no severity tiers.
- The office is loud; the sound toggle is in the HUD.

## Glossary

| Term | Meaning |
|---|---|
| Batch | One job at a time: submit, wait, read the listing. |
| Deck | The lines of source; the punch-card stack. |
| Job | One submitted deck in the queue. |
| Listing | The printed source, machine code, symbols, and error flags. |
| Operator | The person who runs the queue; the room opener. |
| Queue | The FIFO of jobs; the line count sets the ETA. |
| Line printer | The paper output; the teletype pace. |
| Card | The 80-column line; the deck. |
| Mainframe | The shared machine; here, the queue and the browser sim. |
| Memory-mapped I/O | The gadgets as addresses; `sb` writes bytes. |
| Sentinel | A zero word that ends a list. |
| Subroutine | A `jal` block that returns with `jr $ra`. |
| Explosion | The public failure; the terminal goes down. |
| Reference card | The manual; type `REF`. |
| ETA | The estimated wait; the queue position. |

## Shift log

| Time | Job | Lines | Queue | Result | Operator action |
|---:|---|---:|---:|---|---|
| | | | | | |
| | | | | | |
| | | | | | |
| | | | | | |
| | | | | | |
| | | | | | |
| | | | | | |
| | | | | | |

> **END OF SHIFT.** Tear off the printouts. Sign the log. The next shift is at 8. The machine does not care; the operator does.

---

## Appendix A: Operator's answer key

The full decks for the "make it right" and "make it fast" tiers. Copy the block; the starter is in the job card. `npm test` runs every deck here.

### A.1 `pay-86-01-overtime`

```mips pay-86-01-overtime
.data
name0:   .asciiz "ADA"
name1:   .asciiz "BOB"
name2:   .asciiz "CY"
names:   .word name0, name1, name2
hours:   .word 40, 35, 42
rates:   .word 12, 15, 10
count:   .word 3
.text
.globl main
main:
  la   $s0, names
  la   $s1, hours
  la   $s2, rates
  lw   $s3, count
loop:
  beqz $s3, done
  lw   $a0, 0($s0)
  li   $v0, 4
  syscall
  li   $a0, 32
  li   $v0, 11
  syscall
  lw   $t0, 0($s1)
  lw   $t1, 0($s2)
  li   $t3, 40
  ble  $t0, $t3, base
  sub  $t4, $t0, $t3
  mul  $t4, $t4, $t1
  mul  $t4, $t4, 3
  srl  $t4, $t4, 1
  mul  $t2, $t3, $t1
  add  $t2, $t2, $t4
  j    print
base:
  mul  $t2, $t0, $t1
print:
  move $a0, $t2
  li   $v0, 1
  syscall
  li   $a0, 10
  li   $v0, 11
  syscall
  addi $s0, $s0, 4
  addi $s1, $s1, 4
  addi $s2, $s2, 4
  addi $s3, $s3, -1
  j    loop
done:
  li   $v0, 10
  syscall
```

```
ADA 480
BOB 525
CY 430
```

### A.2 `pay-86-01-fast`

```mips pay-86-01-fast
.data
name0: .asciiz "ADA"
name1: .asciiz "BOB"
name2: .asciiz "CY"
names: .word name0, name1, name2
hours: .word 40, 35, 42
rates: .word 12, 15, 10
.text
main:
  la   $s0, names
  la   $s1, hours
  la   $s2, rates
  li   $s3, 3
loop:
  beqz $s3, done
  lw   $a0, 0($s0)
  li   $v0, 4
  syscall
  li   $a0, 32
  li   $v0, 11
  syscall
  lw   $t0, 0($s1)
  lw   $t1, 0($s2)
  mul  $a0, $t0, $t1
  li   $v0, 1
  syscall
  li   $a0, 10
  li   $v0, 11
  syscall
  addi $s0, $s0, 4
  addi $s1, $s1, 4
  addi $s2, $s2, 4
  addi $s3, $s3, -1
  j    loop
done:
  li   $v0, 10
  syscall
```

```
ADA 480
BOB 525
CY 420
```

### A.3 `inv-86-02-add`

```mips inv-86-02-add
.data
item0:  .asciiz "PAPER"
item1:  .asciiz "TONER"
item2:  .asciiz "STAPLES"
item3:  .asciiz "COFFEE"
item4:  .asciiz "DISKS"
item5:  .asciiz "RIBBON"
items:  .word item0, item1, item2, item3, item4, item5
stock:  .word 12, 2, 40, 5, 1, 0
reorder: .word 10, 5, 20, 5, 3, 2
count:  .word 6
yes:    .asciiz "REORDER"
no:     .asciiz "OK"
.text
.globl main
main:
  la   $s0, items
  la   $s1, stock
  la   $s2, reorder
  lw   $s3, count
loop:
  beqz $s3, done
  lw   $a0, 0($s0)
  li   $v0, 4
  syscall
  li   $a0, 32
  li   $v0, 11
  syscall
  lw   $t0, 0($s1)
  lw   $t1, 0($s2)
  bgt  $t0, $t1, ok
  la   $a0, yes
  li   $v0, 4
  syscall
  j    next
ok:
  la   $a0, no
  li   $v0, 4
  syscall
next:
  li   $a0, 10
  li   $v0, 11
  syscall
  addi $s0, $s0, 4
  addi $s1, $s1, 4
  addi $s2, $s2, 4
  addi $s3, $s3, -1
  j    loop
done:
  li   $v0, 10
  syscall
```

```
PAPER OK
TONER REORDER
STAPLES OK
COFFEE REORDER
DISKS REORDER
RIBBON REORDER
```

### A.4 `bil-86-03-money`

```mips bil-86-03-money
.data
item0: .asciiz "DISKS"
item1: .asciiz "TONER"
item2: .asciiz "PAPER"
qty:   .word 2, 1, 10
price: .word 450, 8900, 120
count: .word 3
sub:   .asciiz "SUBTOTAL "
tax:   .asciiz "TAX "
tot:   .asciiz "TOTAL "
.text
.globl main
main:
  la   $s0, qty
  la   $s1, price
  lw   $s2, count
  li   $s3, 0
loop:
  beqz $s2, taxcalc
  lw   $t0, 0($s0)
  lw   $t1, 0($s1)
  mul  $t2, $t0, $t1
  add  $s3, $s3, $t2
  addi $s0, $s0, 4
  addi $s1, $s1, 4
  addi $s2, $s2, -1
  j    loop
taxcalc:
  la   $a0, sub
  li   $v0, 4
  syscall
  move $a0, $s3
  jal  print_money
  li   $a0, 10
  li   $v0, 11
  syscall
  mul  $t3, $s3, 8
  li   $t4, 100
  div  $t3, $t4
  mflo $t3
  la   $a0, tax
  li   $v0, 4
  syscall
  move $a0, $t3
  jal  print_money
  li   $a0, 10
  li   $v0, 11
  syscall
  add  $s4, $s3, $t3
  la   $a0, tot
  li   $v0, 4
  syscall
  move $a0, $s4
  jal  print_money
  li   $a0, 10
  li   $v0, 11
  syscall
  li   $v0, 10
  syscall
print_money:
  move $s5, $a0
  li   $a0, 36
  li   $v0, 11
  syscall
  li   $t4, 100
  div  $s5, $t4
  mflo $a0
  li   $v0, 1
  syscall
  li   $a0, 46
  li   $v0, 11
  syscall
  mfhi $t5
  li   $t4, 10
  bge  $t5, $t4, cents
  li   $a0, 48
  li   $v0, 11
  syscall
cents:
  move $a0, $t5
  li   $v0, 1
  syscall
  jr   $ra
```

```
SUBTOTAL $110.00
TAX $8.80
TOTAL $118.80
```

### A.5 `adm-86-04-blank`

```mips adm-86-04-blank
.data
n0:  .asciiz "ADA"
n1:  .asciiz "BOB"
n2:  .asciiz "CY"
n3:  .asciiz ""
names: .word n0, n1, n2, n3
count: .word 4
head: .asciiz "ATTN: "
occupant: .asciiz "OCCUPANT"
body: .asciiz "\nYOUR TERMINAL IS READY.\n\n"
.text
.globl main
main:
  la   $s0, names
  lw   $s1, count
loop:
  beqz $s1, done
  la   $a0, head
  li   $v0, 4
  syscall
  lw   $t0, 0($s0)
  lb   $t1, 0($t0)
  bnez $t1, have_name
  la   $a0, occupant
  j    print_name
have_name:
  move $a0, $t0
print_name:
  li   $v0, 4
  syscall
  la   $a0, body
  li   $v0, 4
  syscall
  addi $s0, $s0, 4
  addi $s1, $s1, -1
  j    loop
done:
  li   $v0, 10
  syscall
```

```
ATTN: ADA
YOUR TERMINAL IS READY.

ATTN: BOB
YOUR TERMINAL IS READY.

ATTN: CY
YOUR TERMINAL IS READY.

ATTN: OCCUPANT
YOUR TERMINAL IS READY.

```

### A.6 `adm-86-04-sentinel`

```mips adm-86-04-sentinel
.data
n0:  .asciiz "ADA"
n1:  .asciiz "BOB"
n2:  .asciiz "CY"
names: .word n0, n1, n2, 0
head: .asciiz "ATTN: "
body: .asciiz "\nYOUR TERMINAL IS READY.\n\n"
.text
main:
  la   $s0, names
loop:
  lw   $t0, 0($s0)
  beqz $t0, done
  la   $a0, head
  li   $v0, 4
  syscall
  move $a0, $t0
  li   $v0, 4
  syscall
  la   $a0, body
  li   $v0, 4
  syscall
  addi $s0, $s0, 4
  j    loop
done:
  li   $v0, 10
  syscall
```

```
ATTN: ADA
YOUR TERMINAL IS READY.

ATTN: BOB
YOUR TERMINAL IS READY.

ATTN: CY
YOUR TERMINAL IS READY.

```

### A.7 `ops-86-05-fixed`

```mips ops-86-05-fixed
.data
buf: .space 4
.text
.globl main
main:
  la   $t0, buf
  li   $t1, 65
  sb   $t1, 0($t0)
  li   $t0, 0x10030000
  sb   $t1, 0($t0)
  li   $v0, 10
  syscall
```

The printer shows `A`. The write to `buf` is the legal-memory habit; the write to the printer is the visible proof.

### A.8 `ops-86-06-two`

```mips ops-86-06-two
.data
msg: .asciiz "SHIFT 2: ALL TERMINALS ONLINE\nPAYROLL DUE 17:00"
.text
.globl main
main:
  li   $t0, 0x10031000
  la   $t1, msg
loop:
  lb   $t2, 0($t1)
  beqz $t2, done
  sb   $t2, 0($t0)
  addi $t0, $t0, 1
  addi $t1, $t1, 1
  j    loop
done:
  li   $v0, 10
  syscall
```

```
SHIFT 2: ALL TERMINALS ONLINE
PAYROLL DUE 17:00
```

---

*MIPS Division, Data Processing. Rev. C. 1986. This copy is issued to the shift operator. Do not remove it from the machine room.*
