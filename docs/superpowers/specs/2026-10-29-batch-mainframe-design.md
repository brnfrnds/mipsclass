# The Batch Mainframe — Design Doc

**Date:** 2026-10-29
**Status:** Approved (user answered the full questionnaire)
**Supersedes sections of:** 2026-10-28-mips-office-game-design.md (editor + run model)

## Intent

Make programming feel like 1970s batch computing: no instant run. You write assembly in a **line editor** by typing commands, `SUBMIT` the deck, wait your turn in a **simulated job queue**, and your assembler **listing prints line-by-line** onto your paper card — errors flagged, machine code folded away. The room's creator is the **operator** and can kill or bump jobs. A synthesized **soundscape** sells the machine room. A **reference card** (generated from the sim's own instruction set) is where you look things up.

## Decisions (from the questionnaire)

| Question | Decision |
|---|---|
| Where jobs execute | **Simulated queue** — the server schedules and delays; clients still run their own sim locally |
| Editor form | **Line editor** — commands typed into the machine: `L`, `L 3-7`, `I 5` (+ insert mode, `.` exits), `C 3 text`, `D 3` / `D 3-5`, `T`, `SUBMIT`, `REF` |
| Old workflow | **Batch only** — the instant Run button is removed |
| Tasks/scoring | **Later** — no objectives this round |
| Wait time | **Job-size based**: `runMs = 1000 + 200 × lineCount`; wait = every job ahead + yours |
| Queue visibility | **Own position only** — `JOB #7 — QUEUED, 2 AHEAD` |
| Listing | **Full listing, foldable by section**: SOURCE (open, error flags in margin), MACHINE CODE (collapsed), SYMBOLS (collapsed); prints **line-by-line** (~15 lines/s) |
| Dialect | **Uppercase enforced; pseudo-instructions allowed**; no fixed-column rules |
| Working while queued | **One outstanding job per player, free scratch editing**; SUBMIT refused while one is outstanding |
| Operator | **Room creator is the operator**: sees the real queue, can `KILL n` / `BUMP n`; killed jobs print `JOB CANCELLED` at the owner's terminal |
| Sound | **Synthesized (Web Audio, no assets)**: key clacks, teletype clatter, printer buzz, mainframe hum, explosion boom; HUD mute toggle |
| Reference sheet | **Generated from `getInstructionSet()`** + hand-authored sections; HUD `REFERENCE` button and `REF` command |

## Non-goals

- Server-side execution (the queue is simulated; clients run their own sims)
- Task objectives/scoring, session persistence, auth/validation (unchanged)

## Constraints carried forward

- In-memory state, client-trusted, Three.js + vanilla JS + `ws`; the vendored sim also runs in Node (proven) — available for future true-mainframe work
- The office printer stays **private** (paper cards); the display board stays **shared** (wall board)

## Parts left to the builder

- Exact command parser grammar and error messages (uppercase, friendly)
- Listing print pacing details and fold interactions
- Sound synthesis parameters (all Web Audio oscillators/noise, no files)
- Queue tick interval (≈250 ms)
