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
  const set = new Set();
  const el = {
    tag, value: '', spellcheck: false, dataset: {}, children: [],
    style: {},
    get className() { return [...set].join(' '); },
    set className(v) { set.clear(); String(v).split(/\s+/).filter(Boolean).forEach((c) => set.add(c)); },
    get textContent() { return el.children.length ? el.children.map((c) => c.textContent).join('') : (el._text || ''); },
    set textContent(v) { el._text = v; el.children = []; },
    appendChild(c) { el.children.push(c); return c; },
    addEventListener: noop, removeEventListener: noop, remove: noop, focus: noop,
    click() { if (el.onclick) el.onclick(); },
    classList: {
      add(...cs) { cs.forEach((c) => String(c).split(/\s+/).filter(Boolean).forEach((x) => set.add(x))); },
      remove(c) { set.delete(c); },
      contains(c) { return set.has(c); },
      toggle(c, force) { const on = force === undefined ? !set.has(c) : !!force; if (on) set.add(c); else set.delete(c); return on; },
    },
    querySelectorAll(sel) {
      const parts = sel.split('.').filter(Boolean).map((p) => {
        const m = p.match(/^([^\[]+)\[data-section="([^"]+)"\]$/);
        return m ? { cls: m[1], section: m[2] } : { cls: p };
      });
      const out = [];
      const walk = (n) => {
        for (const c of n.children || []) {
          if (parts.every((p) => c.classList.contains(p.cls) && (p.section === undefined || c.dataset.section === p.section))) {
            out.push(c);
          }
          walk(c);
        }
      };
      walk(el);
      return out;
    },
  };
  return el;
}
global.document = { createElement: (t) => (t === 'canvas' ? makeCanvas() : makeEl(t)), addEventListener: noop, removeEventListener: noop, body: makeEl('body') };

// shared fake socket — the editor's netSend goes through the real net module
const fake = {
  readyState: 1, sent: [],
  send: (s) => fake.sent.push(JSON.parse(s)),
};

test('an assembly error also blows up the computer (blowUp sent office-wide)', async () => {
  const net = await import('../../public/js/net.js');
  net.setSocket(fake);
  fake.sent.length = 0;
  const { Editor } = await import('../../public/js/editor.js');
  const ed = new Editor({ container: makeEl('div'), teletype: false });
  ed._enter('D 1-8');
  ed._enter('I 1 THIS IS DEFINITELY NOT VALID MIPS');
  ed._enter('SUBMIT');
  ed.onMessage({ type: 'jobRunning', jobId: 1 }); // the queue calls the deck
  const blowups = fake.sent.filter((m) => m.type === 'blowUp');
  assert.equal(blowups.length, 1, 'asm error sends exactly one blowUp');
});

test('a clean program sends no blowUp', async () => {
  const net = await import('../../public/js/net.js');
  net.setSocket(fake);
  fake.sent.length = 0;
  const { Editor } = await import('../../public/js/editor.js');
  const ed = new Editor({ container: makeEl('div'), teletype: false });
  ed._enter('SUBMIT');
  ed.onMessage({ type: 'jobRunning', jobId: 1 });
  await new Promise((r) => setTimeout(r, 400)); // let the run settle
  assert.equal(fake.sent.filter((m) => m.type === 'blowUp').length, 0, 'no crash on valid code');
});

test('the editor queues through the mainframe: SUBMIT holds until jobRunning, then prints', async () => {
  const net = await import('../../public/js/net.js');
  net.setSocket(fake);
  fake.sent.length = 0;
  const { Editor } = await import('../../public/js/editor.js');
  const ed = new Editor({ container: makeEl('div'), teletype: false });
  ed._enter('SUBMIT');

  const submits = fake.sent.filter((m) => m.type === 'submitJob');
  assert.equal(submits.length, 1, 'SUBMIT sends a submitJob message');
  assert.ok(submits[0].lineCount > 0, 'with a line count');
  assert.equal(ed.statusEl.textContent.includes('QUEUED'), true, 'status shows the queue');

  ed._enter('SUBMIT');
  assert.equal(fake.sent.filter((m) => m.type === 'submitJob').length, 1, 'one outstanding job');

  ed.onMessage({ type: 'jobRunning', jobId: 1 });
  assert.ok(document.body.textContent.includes('=== SOURCE ==='), 'listing printed onto the paper card');
  ed.onMessage({ type: 'jobDone', jobId: 1 });
  assert.ok(ed.statusEl.textContent.startsWith('READY'), 'ready after the job clears');
});

test('listing sections print onto the paper card with fold headers; folds open', async () => {
  const net = await import('../../public/js/net.js');
  net.setSocket(fake);
  const { Editor } = await import('../../public/js/editor.js');
  const ed = new Editor({ container: makeEl('div'), teletype: false });
  ed._enter('SUBMIT');
  ed.onMessage({ type: 'jobRunning', jobId: 1 });
  const text = document.body.textContent;
  assert.ok(text.includes('=== SOURCE ==='), 'source header');
  assert.ok(text.includes('=== MACHINE CODE'), 'machine section');
  assert.ok(text.includes('=== SYMBOLS'), 'symbols section');
  assert.ok(text.includes('== ASSEMBLY CLEAN =='), 'clean verdict (template assembles)');

  const machineLines = document.body.querySelectorAll('.pc-line.pc-sec-MACHINE');
  assert.ok(machineLines.length > 0, 'machine lines exist');
  assert.ok(machineLines.every((f) => f.classList.contains('pc-folded')), 'machine lines start folded');
  const sourceLines = document.body.querySelectorAll('.pc-line.pc-sec-SOURCE');
  assert.ok(sourceLines.length > 0 && sourceLines.every((f) => !f.classList.contains('pc-folded')), 'source lines start open');

  const machineHeader = [...document.body.querySelectorAll('.pc-fold-head[data-section="MACHINE"]')][0];
  machineHeader.click();
  assert.ok(machineLines.every((f) => !f.classList.contains('pc-folded')), 'fold opens on click');
});

test('a killed job prints JOB CANCELLED and frees the editor', async () => {
  const net = await import('../../public/js/net.js');
  net.setSocket(fake);
  fake.sent.length = 0;
  const { Editor } = await import('../../public/js/editor.js');
  const ed = new Editor({ container: makeEl('div'), teletype: false });
  ed._enter('SUBMIT');
  ed.onMessage({ type: 'jobKilled', jobId: 1 });
  assert.ok(ed.out.textContent.includes('JOB CANCELLED'), 'cancellation printed');
  assert.ok(ed.statusEl.textContent.startsWith('READY'), 'editor freed');
  ed._enter('SUBMIT'); // can submit again
  assert.equal(fake.sent.filter((m) => m.type === 'submitJob').length, 2);
});

test('plain terminal traffic is always visible on the glass (the boot banner and L output)', async () => {
  const net = await import('../../public/js/net.js');
  net.setSocket(fake);
  const { Editor } = await import('../../public/js/editor.js');
  const ed = new Editor({ container: makeEl('div'), teletype: false });
  assert.ok(ed.out.textContent.includes('MIPSDOS LINE EDITOR'), 'boot banner visible');
  assert.ok(ed.out.textContent.includes('DECK LOADED'), 'banner second line visible');
  ed._enter('L');
  assert.ok(ed.out.textContent.includes('LI $v0, 4'), 'the L listing printed on the glass (registers keep their case)');
  const rows = ed.out.querySelectorAll('.terminal-row');
  assert.equal(rows.length, 24, 'the glass is exactly 24 rows');
  assert.ok(rows.every((d) => !d.classList.contains('folded')), 'glass rows are never folded');
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
