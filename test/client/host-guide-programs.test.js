// Integration tests for the paste-ready decks in docs/HOSTING.md. The guide is
// the source of truth: this test extracts every fenced block tagged
// ```mips <job-id> and runs it on the real vendored simulator. If a job card
// drifts, the host finds out in `npm test`, not at the front of the room.
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const GUIDE = path.join(__dirname, '..', '..', 'docs', 'HOSTING.md');

const EXPECTED = {
  hello: {
    lines: 10,
    screen: 'HELLO, MACHINE ROOM',
  },
  'pay-86-01': {
    lines: 40,
    screen: 'ADA 480\nBOB 525\nCY 420\n',
  },
  'pay-86-01-overtime': {
    lines: 51,
    screen: 'ADA 480\nBOB 525\nCY 430\n',
  },
  'pay-86-01-fast': {
    lines: 37,
    screen: 'ADA 480\nBOB 525\nCY 420\n',
  },
  'inv-86-02': {
    lines: 50,
    screen: 'PAPER OK\nTONER REORDER\nSTAPLES OK\nCOFFEE REORDER\nDISKS REORDER\n',
  },
  'inv-86-02-add': {
    lines: 51,
    screen:
      'PAPER OK\nTONER REORDER\nSTAPLES OK\nCOFFEE REORDER\nDISKS REORDER\nRIBBON REORDER\n',
  },
  'bil-86-03': {
    lines: 62,
    screen: 'SUBTOTAL 11000\nTAX 880\nTOTAL 11880\n',
  },
  'bil-86-03-money': {
    lines: 83,
    screen: 'SUBTOTAL $110.00\nTAX $8.80\nTOTAL $118.80\n',
  },
  'adm-86-04': {
    lines: 30,
    screen:
      'ATTN: ADA\nYOUR TERMINAL IS READY.\n\n' +
      'ATTN: BOB\nYOUR TERMINAL IS READY.\n\n' +
      'ATTN: CY\nYOUR TERMINAL IS READY.\n\n',
  },
  'adm-86-04-blank': {
    lines: 39,
    screen:
      'ATTN: ADA\nYOUR TERMINAL IS READY.\n\n' +
      'ATTN: BOB\nYOUR TERMINAL IS READY.\n\n' +
      'ATTN: CY\nYOUR TERMINAL IS READY.\n\n' +
      'ATTN: OCCUPANT\nYOUR TERMINAL IS READY.\n\n',
  },
  'adm-86-04-sentinel': {
    lines: 27,
    screen:
      'ATTN: ADA\nYOUR TERMINAL IS READY.\n\n' +
      'ATTN: BOB\nYOUR TERMINAL IS READY.\n\n' +
      'ATTN: CY\nYOUR TERMINAL IS READY.\n\n',
  },
  'ops-86-05': {
    lines: 8,
    throws: /address out of range 0x00008000/,
  },
  'ops-86-05-fixed': {
    lines: 12,
    screen: '',
    printer: 'A',
  },
  'ops-86-06': {
    lines: 17,
    screen: '',
    board: 'SHIFT 2: ALL TERMINALS ONLINE',
  },
  'ops-86-06-two': {
    lines: 17,
    screen: '',
    board: 'SHIFT 2: ALL TERMINALS ONLINE\nPAYROLL DUE 17:00',
  },
};

function readBlocks() {
  const md = fs.readFileSync(GUIDE, 'utf8');
  const blocks = new Map();
  for (const match of md.matchAll(/```mips ([a-z0-9-]+)\r?\n([\s\S]*?)```/g)) {
    blocks.set(match[1], match[2].replace(/\s+$/, ''));
  }
  return blocks;
}

test('host guide job cards run on the real sim', async () => {
  const { MipsSim } = await import('../../public/js/mips.js');
  const { getModel, reset } = await import('../../public/js/gadgets.js');

  const blocks = readBlocks();
  assert.deepEqual(
    [...blocks.keys()].sort(),
    Object.keys(EXPECTED).sort(),
    'every mips <job-id> block in docs/HOSTING.md has an expectation'
  );

  for (const [id, spec] of Object.entries(EXPECTED)) {
    const src = blocks.get(id);
    assert.ok(src, `${id}: code block present in docs/HOSTING.md`);
    assert.equal(
      src.split('\n').filter((line) => line.trim()).length,
      spec.lines,
      `${id}: line count matches the line budget`
    );

    reset();
    const sim = new MipsSim(src);
    sim.assemble();
    assert.ok(sim.assembleOk(), `${id}: assembles cleanly (${sim.assembleReport()})`);

    let result;
    try {
      const res = await sim.run();
      result = {
        reason: res.reason,
        screen: sim._screen,
        printer: getModel().printer.text,
        board: getModel().board.text,
      };
    } catch (err) {
      result = { error: err };
    }

    if (spec.throws) {
      assert.ok(result.error, `${id}: expected a runtime error`);
      assert.equal(result.error.name, 'RuntimeError', `${id}: runtime error type`);
      assert.match(result.error.message, spec.throws, `${id}: runtime error message`);
      continue;
    }

    assert.equal(result.reason, 'NORMAL_TERMINATION', `${id}: exits cleanly`);
    if (spec.screen !== undefined) {
      assert.equal(result.screen, spec.screen, `${id}: screen output`);
    }
    if (spec.printer !== undefined) {
      assert.equal(result.printer, spec.printer, `${id}: printer output`);
    }
    if (spec.board !== undefined) {
      assert.equal(result.board, spec.board, `${id}: board output`);
    }
  }
});
