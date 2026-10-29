const { test } = require('node:test');
const assert = require('node:assert');

// Shared fake socket + real net module (ESM singleton shared with gadgets.js/mips.js).
const fake = {
  readyState: 1,
  sent: [],
  send: (s) => fake.sent.push(JSON.parse(s)),
  onmessage: null,
  onopen: null,
  onclose: null,
  onerror: null,
};

test('net.js exposes send/on and routes incoming JSON by type', async () => {
  const net = await import('../../public/js/net.js');
  net.setSocket(fake);
  const got = [];
  net.on('gadgetState', (m) => got.push(m));
  net.send({ type: 'typing', typing: true });
  assert.equal(fake.sent.length, 1);
  assert.equal(fake.sent[0].type, 'typing');
  fake.onmessage({ data: JSON.stringify({ type: 'gadgetState', gadgetState: { printer: { text: 'X' } } }) });
  assert.equal(got.length, 1);
  assert.equal(got[0].gadgetState.printer.text, 'X');
});

test('printer writes stay PRIVATE: model updates locally, nothing is sent', async () => {
  const net = await import('../../public/js/net.js');
  net.setSocket(fake);
  fake.sent.length = 0;
  const { GADGET_IO, write, getModel, reset } = await import('../../public/js/gadgets.js');
  reset();
  assert.equal(write(GADGET_IO.PRINTER_BASE, 72), 'printer'); // 'H'
  write(GADGET_IO.PRINTER_BASE + 1, 73); // 'I'
  assert.equal(getModel().printer.text, 'HI');
  assert.equal(fake.sent.filter((m) => m.type === 'gadgetUpdate').length, 0, 'printer is private — no broadcast');
});

test('board and controller writes land on their own gadgets', async () => {
  const { GADGET_IO, write, getModel, reset } = await import('../../public/js/gadgets.js');
  reset();
  assert.equal(write(GADGET_IO.BOARD_BASE, 65), 'board'); // 'A'
  assert.equal(write(GADGET_IO.CONTROLLER_BASE, 1), 'controller');
  const m = getModel();
  assert.equal(m.board.text, 'A');
  assert.equal(m.printer.text, '');
  assert.ok('w0' in m.controller);
});

test('MIPS store to printer MMIO range updates the local printout without broadcasting', async () => {
  const net = await import('../../public/js/net.js');
  net.setSocket(fake);
  fake.sent.length = 0;
  const { MipsSim } = await import('../../public/js/mips.js');
  const { GADGET_IO, getModel, reset } = await import('../../public/js/gadgets.js');
  reset();
  const src =
    `li $t0, ${GADGET_IO.PRINTER_BASE}\n` +
    'li $t1, 72\nsb $t1, 0($t0)\n' + // 'H'
    'li $t1, 73\nsb $t1, 1($t0)';   // 'I'
  const sim = new MipsSim(src);
  sim.assemble();
  assert.ok(sim.assembleOk());
  await sim.run();
  assert.equal(getModel().printer.text, 'HI');
  assert.equal(fake.sent.filter((m) => m.type === 'gadgetUpdate').length, 0, 'printouts stay private');
});

test('resetAndSync clears the local printout but only broadcasts the shared gadgets', async () => {
  const net = await import('../../public/js/net.js');
  net.setSocket(fake);
  fake.sent.length = 0;
  const { GADGET_IO, write, getModel, resetAndSync } = await import('../../public/js/gadgets.js');
  write(GADGET_IO.PRINTER_BASE, 65); // 'A'
  write(GADGET_IO.BOARD_BASE, 66);   // 'B'
  resetAndSync();
  const m = getModel();
  assert.equal(m.printer.text, '', 'local printout cleared');
  assert.equal(m.board.text, '', 'shared board cleared');
  const upd = fake.sent.filter((x) => x.type === 'gadgetUpdate');
  assert.equal(upd.length, 2, 'the board write + the shared clear (printer never sends)');
  assert.deepEqual(upd[1].gadget, { board: { text: '' }, controller: {} }, 'only shared gadgets in the clear');
});

test('applyState merges shared gadget broadcasts; the printer stays private', async () => {
  const net = await import('../../public/js/net.js');
  net.setSocket(fake);
  fake.sent.length = 0;
  const { GADGET_IO, write, applyState, getModel, reset } = await import('../../public/js/gadgets.js');
  reset();
  write(GADGET_IO.PRINTER_BASE, 65); // local printout 'A' — must survive the broadcast
  applyState({ printer: { text: 'FROM SERVER' }, board: { text: 'BOARD!' } });
  const m = getModel();
  assert.equal(m.board.text, 'BOARD!', 'shared board merges');
  assert.equal(m.board.online, true, 'sibling keys preserved');
  assert.equal(m.printer.text, 'A', 'printer ignores server state — it is private');
});
