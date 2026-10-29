// Integration tests: the exact MIPS programs an operator pastes into the
// editor to test the office gadgets. Each is verified against the real
// vendored simulator, so a regression here breaks the documented workflows.
const { test } = require('node:test');
const assert = require('node:assert');

test('gadget programs from the field guide run on the real sim', async () => {
  const { MipsSim } = await import('../../public/js/mips.js');
  const { GADGET_IO, getModel, reset } = await import('../../public/js/gadgets.js');

  async function runProgram(name, src, expect) {
    reset();
    const sim = new MipsSim(src);
    sim.assemble();
    assert.ok(sim.assembleOk(), `${name}: assembles (${sim.assembleReport()})`);
    const res = await sim.run();
    assert.equal(res.reason, 'NORMAL_TERMINATION', `${name}: exits cleanly`);
    expect();
    return res;
  }

  // 1. printer, byte by byte
  await runProgram('printer HI!', `.text
.globl main
main:
  li   $t0, ${GADGET_IO.PRINTER_BASE}
  li   $t1, 72
  sb   $t1, 0($t0)
  li   $t1, 73
  sb   $t1, 1($t0)
  li   $t1, 33
  sb   $t1, 2($t0)
  li   $v0, 10
  syscall`, () => assert.equal(getModel().printer.text, 'HI!'));

  // 2. printer, string loop from .data
  await runProgram('printer loop', `.data
msg: .asciiz "COFFEE BREAK AT 3"
.text
.globl main
main:
  li   $t0, ${GADGET_IO.PRINTER_BASE}
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
  syscall`, () => assert.equal(getModel().printer.text, 'COFFEE BREAK AT 3'));

  // 3. display board
  await runProgram('board loop', `.data
msg: .asciiz "MEETING"
.text
.globl main
main:
  li   $t0, ${GADGET_IO.BOARD_BASE}
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
  syscall`, () => assert.equal(getModel().board.text, 'MEETING'));

  // 4. printer and board in one pass
  await runProgram('both at once', `.data
msg: .asciiz "STANDUP 9AM"
.text
.globl main
main:
  li   $t0, ${GADGET_IO.PRINTER_BASE}
  li   $t1, ${GADGET_IO.BOARD_BASE}
  la   $t2, msg
loop:
  lb   $t3, 0($t2)
  beqz $t3, done
  sb   $t3, 0($t0)
  sb   $t3, 0($t1)
  addi $t0, $t0, 1
  addi $t1, $t1, 1
  addi $t2, $t2, 1
  j    loop
done:
  li   $v0, 10
  syscall`, () => {
    assert.equal(getModel().printer.text, 'STANDUP 9AM');
    assert.equal(getModel().board.text, 'STANDUP 9AM');
  });

  // 5. controller word writes
  await runProgram('controller sw', `.text
.globl main
main:
  li   $t0, ${GADGET_IO.CONTROLLER_BASE}
  li   $t1, 1
  sw   $t1, 0($t0)
  li   $t1, 2
  sw   $t1, 4($t0)
  li   $v0, 10
  syscall`, () => {
    assert.equal(getModel().controller.w0, 1);
    assert.equal(getModel().controller.w4, 2);
  });
});

test('the two crash programs from the field guide fail as documented', async () => {
  const { MipsSim } = await import('../../public/js/mips.js');

  // 6. runtime crash — bad address rejects with a typed RuntimeError
  const crash = new MipsSim('.text\n.globl main\nmain:\n  li   $t0, 0x8000\n  sb   $t1, 0($t0)');
  crash.assemble();
  assert.ok(crash.assembleOk());
  await assert.rejects(() => crash.run(), (err) => err.name === 'RuntimeError');

  // 7. asm error — bad syntax fails assembly
  const badAsm = new MipsSim('.text\nfr0bnicate everything');
  badAsm.assemble();
  assert.ok(!badAsm.assembleOk());
  assert.ok(badAsm.assembleErrors().length > 0);
});
