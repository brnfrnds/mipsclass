const { test } = require('node:test');
const assert = require('node:assert');

// --- minimal DOM stubs ---
function noop() {}
function makeCanvas() { return { width: 0, height: 0, getContext: () => ({ fillStyle: '', fillRect: noop, font: '', fillText: noop }) }; }
function makeEl(tag) {
  const set = new Set();
  const el = {
    tag, value: '', spellcheck: false, dataset: {}, children: [], style: {},
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
          if (parts.every((p) => c.classList.contains(p.cls) && (p.section === undefined || c.dataset.section === p.section))) out.push(c);
          walk(c);
        }
      };
      walk(el);
      return out;
    },
    getBoundingClientRect() { return { left: 0, top: 0, width: 100, height: 40 }; },
  };
  return el;
}
global.document = { createElement: (t) => (t === 'canvas' ? makeCanvas() : makeEl(t)), addEventListener: noop, removeEventListener: noop, body: makeEl('body') };
global.window = undefined;

test('reference card sections fold on click and remember their state', async () => {
  const { mountReference } = await import('../../public/js/reference.js');
  const container = makeEl('div');
  const card = mountReference({ container });
  card.show();

  const syscallsHead = [...container.querySelectorAll('.ref-fold-head')].find((h) => h.textContent.includes('SYSCALLS'));
  assert.ok(syscallsHead, 'the SYSCALLS fold header exists');
  assert.ok(syscallsHead.textContent.includes('[−]'), 'sections start open');

  syscallsHead.click(); // fold it
  const afterFold = [...container.querySelectorAll('.ref-fold-head')].find((h) => h.textContent.includes('SYSCALLS'));
  assert.ok(afterFold.textContent.includes('[+]'), 'folded after the click');
  const foldedSections = [...container.querySelectorAll('.ref-section.ref-folded')];
  assert.equal(foldedSections.length, 1, 'exactly one section folded');

  syscallsHead.click(); // unfold
  const afterOpen = [...container.querySelectorAll('.ref-fold-head')].find((h) => h.textContent.includes('SYSCALLS'));
  assert.ok(afterOpen.textContent.includes('[−]'), 'open again');
  assert.equal([...container.querySelectorAll('.ref-section.ref-folded')].length, 0, 'nothing folded');
});

test('the generated instruction sections exist (from the sim itself)', async () => {
  const { mountReference } = await import('../../public/js/reference.js');
  const container = makeEl('div');
  const card = mountReference({ container });
  card.show();
  const text = container.textContent;
  assert.ok(text.includes('INSTRUCTIONS — MEMORY'), 'the memory group generated');
  assert.ok(text.includes('INSTRUCTIONS — BRANCH/JUMP'), 'the branch group generated');
  assert.ok(text.includes('ARITHMETIC/LOGIC'), 'the arithmetic group generated');
});
