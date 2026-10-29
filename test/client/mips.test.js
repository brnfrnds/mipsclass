const { test } = require('node:test');
const assert = require('node:assert');

test('MipsSim assembles li $a0, 42 and run() sets $a0 to 42', async () => {
  const { MipsSim } = await import('../../public/js/mips.js');
  const sim = new MipsSim('li $a0, 42');
  const asm = sim.assemble();
  assert.ok(sim.assembleOk(), 'assembly should succeed: ' + sim.assembleReport());
  assert.equal(sim.assembleErrors().length, 0, 'no assembly errors');
  await sim.run();
  assert.equal(sim.readRegister('$a0'), 42, '\$a0 should be 42 after li $a0, 42');
});

test('MipsSim reports assembly errors for invalid source', async () => {
  const { MipsSim } = await import('../../public/js/mips.js');
  const sim = new MipsSim('this is definitely not valid mips assembly');
  sim.assemble();
  assert.ok(!sim.assembleOk(), 'invalid source should not assemble');
  assert.ok(sim.assembleErrors().length > 0, 'should report at least one error');
});

test('MipsSim reads back a register value set by the program', async () => {
  const { MipsSim } = await import('../../public/js/mips.js');
  const sim = new MipsSim('li $t0, 42');
  sim.assemble();
  assert.ok(sim.assembleOk());
  await sim.run();
  assert.equal(sim.readRegister('$t0'), 42);
});

test('MipsSim rejects with a typed RuntimeError on a crash (bad address)', async () => {
  const { MipsSim } = await import('../../public/js/mips.js');
  const sim = new MipsSim('li $t0, 0x8000\nsb $t1, 0($t0)');
  sim.assemble();
  assert.ok(sim.assembleOk(), 'assembles fine — the crash is at runtime');
  await assert.rejects(() => sim.run(), (err) => err.name === 'RuntimeError');
});

test('MipsSim print syscalls feed onScreenOutput and getScreenOutput', async () => {
  const { MipsSim } = await import('../../public/js/mips.js');
  const source =
    '.data\nmsg: .asciiz "HELLO SCREEN\\n"\n.text\n.globl main\nmain:\n' +
    '  li $v0, 4\n  la $a0, msg\n  syscall\n  li $v0, 10\n  syscall\n';
  const sim = new MipsSim(source);
  const got = [];
  sim.onScreenOutput = (t) => got.push(t);
  sim.assemble();
  assert.ok(sim.assembleOk());
  await sim.run();
  assert.equal(sim.getScreenOutput(), 'HELLO SCREEN\n');
  assert.deepEqual(got, ['HELLO SCREEN\n']);
});
