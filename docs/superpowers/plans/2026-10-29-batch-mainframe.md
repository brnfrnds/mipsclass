# Batch Mainframe Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace instant-run with batch computing: a line editor, a simulated job queue with job-size waits, teletype-printed foldable listings, operator powers for the room creator, a sim-generated reference card, and synthesized sound.

**Architecture:** The server holds a per-room FIFO job queue (line counts, computed ETAs) and pushes owner-only position/running/done messages; clients hold their decks, run their own vendored sim when told, and print listings teletype-style onto the paper card. The creator additionally receives the full queue and may kill/bump jobs.

**Tech Stack:** Node `ws`, vanilla JS ES modules, vendored `@specy/mips` (also runs in Node), Web Audio synthesis.

**Spec:** docs/superpowers/specs/2026-10-29-batch-mainframe-design.md

## Global Constraints

- Batch only: the instant Run button is removed; every execution is a submitted job.
- Queue is simulated server-side; execution stays client-side (client-trusted).
- Wait = jobs ahead + own; each job = `1000 + 200 × lineCount` ms.
- Own queue position only, except the room creator (operator) who sees all and may kill/bump.
- One outstanding job per player; free scratch editing while queued; SUBMIT refused while one is outstanding.
- Uppercase enforced in the editor; pseudo-instructions allowed.
- Listing folds by section: SOURCE open, MACHINE CODE + SYMBOLS collapsed; prints ~15 lines/s.
- All sound is synthesized (Web Audio), no asset files; HUD mute toggle.
- Printer stays private (paper cards); board stays shared.

## Review Focus

- A player submits; their editor still works (scratch edits) and SUBMIT is refused until the job finishes.
- A second player's job queued first → the first player's ETA reflects the wait (position ≥ 2).
- The operator kills a queued job → the owner's terminal prints JOB CANCELLED; the queue re-times.
- The listing prints line-by-line (~15/s), sections foldable, SOURCE open, others collapsed.
- A joiner mid-queue sees the current queue state correctly (no stale positions).

---
