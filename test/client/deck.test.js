const { test } = require('node:test');
const assert = require('node:assert');

test('parseCommand uppercases, trims, and splits a command', async () => {
  const { parseCommand } = await import('../../public/js/editor.js');
  assert.deepEqual(parseCommand('  l 3-7  '), { cmd: 'L', args: ['3-7'] });
  assert.deepEqual(parseCommand('i 5 hello world'), { cmd: 'I', args: ['5', 'HELLO WORLD'] });
  assert.deepEqual(parseCommand('submit'), { cmd: 'SUBMIT', args: [] });
  assert.deepEqual(parseCommand('   '), null, 'blank input is not a command');
});

test('upperLine preserves escape sequences (newlines survive uppercasing)', async () => {
  const { upperLine } = await import('../../public/js/editor.js');
  assert.equal(upperLine('.asciiz "hi\\nworld"'), '.ASCIIZ "HI\\nWORLD"', 'the \\n escape survives');
  assert.equal(upperLine('.asciiz "a\\tb\\nc"'), '.ASCIIZ "A\\tB\\nC"', 'tab and newline escapes survive');
  assert.equal(upperLine('li $t0, 4'), 'LI $t0, 4');
  assert.equal(upperLine('ADD $t1, $t2, $t3'), 'ADD $t1, $t2, $t3');
  assert.equal(upperLine('plain text'), 'PLAIN TEXT');
});

test('the deck stores newline escapes intact (a multi-line printout works)', async () => {
  const { Deck } = await import('../../public/js/editor.js');
  const d = new Deck();
  d.append('.data');
  d.append('msg: .asciiz "LINE ONE\\nLINE TWO"');
  d.append('.text');
  const stored = d.line(2);
  assert.ok(stored.includes('\\n'), 'the escape is in the stored card');
  assert.ok(!stored.includes('\\N'), 'never uppercased to \\N');
});

test('parseCommand keeps argument text intact apart from casing', async () => {
  const { parseCommand } = await import('../../public/js/editor.js');
  assert.deepEqual(parseCommand('c 2 add $t0, $t1, $t2  '), { cmd: 'C', args: ['2', 'ADD $t0, $t1, $t2'] });
});

test('Deck starts empty and appends with A', async () => {
  const { Deck } = await import('../../public/js/editor.js');
  const d = new Deck();
  assert.equal(d.count(), 0);
  d.append('LDX 1');
  d.append('STX 2');
  assert.equal(d.count(), 2);
  assert.equal(d.line(1), 'LDX 1');
  assert.equal(d.line(2), 'STX 2');
});

test('I inserts before a line; I at count+1 appends', async () => {
  const { Deck } = await import('../../public/js/editor.js');
  const d = new Deck();
  d.append('A1'); d.append('A2');
  d.insertBefore(1, 'FIRST');
  assert.equal(d.line(1), 'FIRST');
  d.insertBefore(3, 'LAST');
  assert.equal(d.line(3), 'LAST');
  assert.throws(() => d.insertBefore(9, 'NOPE'), /out of range/i);
});

test('C replaces a line; D deletes a line and a range; ranges are 1-based inclusive', async () => {
  const { Deck } = await import('../../public/js/editor.js');
  const d = new Deck();
  ['ONE', 'TWO', 'THREE', 'FOUR'].forEach((l) => d.append(l));
  d.change(2, 'TWO!');
  assert.equal(d.line(2), 'TWO!');
  d.deleteRange(3, 3);
  assert.equal(d.count(), 3);
  assert.equal(d.line(3), 'FOUR');
  d.deleteRange(1, 2);
  assert.equal(d.count(), 1);
  assert.throws(() => d.deleteRange(5, 6), /out of range/i);
});

test('T returns the top ten lines; L range returns a slice with numbers', async () => {
  const { Deck } = await import('../../public/js/editor.js');
  const d = new Deck();
  for (let i = 1; i <= 14; i++) d.append('LINE ' + i);
  const top = d.top();
  assert.equal(top.length, 10);
  assert.equal(top[0], '     1  LINE 1');
  const range = d.format(3, 4);
  assert.deepEqual(range, ['     3  LINE 3', '     4  LINE 4']);
  assert.throws(() => d.format(20, 30), /out of range/i);
});
