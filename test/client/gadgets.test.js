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

test('gadget write accumulates printer text and emits gadgetUpdate', async () => {
  const net = await import('../../public/js/net.js');
  net.setSocket(fake);
  const { GADGET_IO, write, getModel, reset } = await import('../../public/js/gadgets.js');
  reset();
  const where = write(GADGET_IO.PRINTER_BASE, 72); // 'H'
  assert.equal(where, 'printer');
  write(GADGET_IO.PRINTER_BASE + 1, 73); // 'I'
  assert.equal(getModel().printer.text, 'HI');
  const upd = fake.sent.filter((s) => s.type === 'gadgetUpdate');
  assert.ok(upd.length >= 2);
  assert.equal(upd[upd.length - 1].gadget.printer.text, 'HI');
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

test('MIPS store to printer MMIO range triggers gadget write via memory observer', async () => {
  const net = await import('../../public/js/net.js');
  net.setSocket(fake);
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
  const upd = fake.sent.filter((s) => s.type === 'gadgetUpdate');
  assert.ok(upd.length >= 1, 'gadgetUpdate should be sent');
  assert.equal(upd[upd.length - 1].gadget.printer.text, 'HI');
});

test('applyState merges a server gadgetState broadcast into the local model', async () => {
  const { applyState, getModel, reset } = await import('../../public/js/gadgets.js');
  reset();
  applyState({ printer: { text: 'FROM SERVER' }, board: { text: 'BOARD!' } });
  const m = getModel();
  assert.equal(m.printer.text, 'FROM SERVER');
  assert.equal(m.board.text, 'BOARD!');
  assert.equal(m.printer.online, true, 'sibling keys preserved');
});
