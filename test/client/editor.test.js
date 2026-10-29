const { test } = require('node:test');
const assert = require('node:assert');

test('createTypingPulse sends typing true on press and false after idle', async () => {
  const { createTypingPulse } = await import('../../public/js/editor.js');
  const sent = [];
  const pulse = createTypingPulse((m) => sent.push(m), 60);
  pulse();
  pulse(); // rapid keystrokes
  assert.ok(sent.length >= 1, 'a send happened');
  assert.ok(sent.every((m) => m.typing === true), 'presses send typing true');
  await new Promise((r) => setTimeout(r, 150)); // past the idle window
  assert.equal(sent[sent.length - 1].typing, false, 'idle sends typing false');
});

test('createTypingPulse stays true while keystrokes keep coming', async () => {
  const { createTypingPulse } = await import('../../public/js/editor.js');
  const sent = [];
  const pulse = createTypingPulse((m) => sent.push(m), 80);
  pulse();
  await new Promise((r) => setTimeout(r, 50));
  pulse(); // still inside the idle window — no false yet
  await new Promise((r) => setTimeout(r, 40));
  assert.ok(!sent.some((m) => m.typing === false), 'no false while typing continues');
  await new Promise((r) => setTimeout(r, 120));
  assert.equal(sent[sent.length - 1].typing, false, 'false only after real idle');
});
