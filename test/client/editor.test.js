const { test } = require('node:test');
const assert = require('node:assert');

// --- minimal DOM stubs so the Editor can run in node ---
function noop() {}
function makeCanvas() {
  return {
    width: 0, height: 0,
    getContext: () => ({ fillStyle: '', fillRect: noop, font: '', fillText: noop }),
  };
}
function makeEl(tag) {
  return {
    tag, className: '', value: '', textContent: '', spellcheck: false,
    style: {}, children: [],
    appendChild(c) { this.children.push(c); return c; },
    addEventListener: noop, removeEventListener: noop, remove: noop,
  };
}
global.document = { createElement: (t) => (t === 'canvas' ? makeCanvas() : makeEl(t)), addEventListener: noop, removeEventListener: noop, body: makeEl('body') };

// shared fake socket — the editor's netSend goes through the real net module
const fake = {
  readyState: 1, sent: [],
  send: (s) => fake.sent.push(JSON.parse(s)),
};

function findButton(el, label) {
  for (const c of el.children) {
    if (c.tag === 'button' && c.textContent === label) return c;
    const nested = findButton(c, label);
    if (nested) return nested;
  }
  return null;
}

test('an assembly error also blows up the computer (blowUp sent office-wide)', async () => {
  const net = await import('../../public/js/net.js');
  net.setSocket(fake);
  fake.sent.length = 0;
  const { Editor } = await import('../../public/js/editor.js');
  const ed = new Editor({ container: makeEl('div') });
  ed._enter('D 1-6');
  ed._enter('I 1 THIS IS DEFINITELY NOT VALID MIPS');
  ed._enter('SUBMIT');
  const blowups = fake.sent.filter((m) => m.type === 'blowUp');
  assert.equal(blowups.length, 1, 'asm error sends exactly one blowUp');
});

test('a clean program sends no blowUp', async () => {
  const net = await import('../../public/js/net.js');
  net.setSocket(fake);
  fake.sent.length = 0;
  const { Editor } = await import('../../public/js/editor.js');
  const ed = new Editor({ container: makeEl('div') });
  ed._enter('SUBMIT'); // the hello-world template is clean
  await new Promise((r) => setTimeout(r, 400)); // let the run settle
  assert.equal(fake.sent.filter((m) => m.type === 'blowUp').length, 0, 'no crash on valid code');
});

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
