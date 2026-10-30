const { test } = require('node:test');
const assert = require('node:assert');

// --- minimal DOM stubs (the terminal renders into stub elements) ---
function noop() {}
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
    querySelectorAll(sel) { return []; },
  };
  return el;
}
global.document = { createElement: (t) => (t === 'canvas' ? makeCanvas() : makeEl(t)), addEventListener: noop, removeEventListener: noop, body: makeEl('body') };
global.window = undefined;
global.requestAnimationFrame = () => {};

test('Screen renders 80x24: short lines fill one row, no scroll', async () => {
  const { Screen } = await import('../../public/js/editor.js');
  const s = new Screen(80, 24);
  s.writeLine('READY');
  assert.equal(s.rows.length, 24);
  assert.equal(s.rows[0], 'READY' + ' '.repeat(75));
  assert.equal(s.rows[1], ' '.repeat(80), 'the rest of the screen is blank cells');
});

test('Screen wraps long lines across rows at the column count', async () => {
  const { Screen } = await import('../../public/js/editor.js');
  const s = new Screen(40, 25); // the C64 mode
  s.writeLine('X'.repeat(95)); // wraps into 3 rows on a 40-col screen
  assert.equal(s.rows[0], 'X'.repeat(40));
  assert.equal(s.rows[1], 'X'.repeat(40));
  assert.equal(s.rows[2], 'X'.repeat(15) + ' '.repeat(25));
});

test('Screen scrolls: writing past the last row pushes the top away', async () => {
  const { Screen } = await import('../../public/js/editor.js');
  const s = new Screen(80, 24);
  for (let i = 1; i <= 30; i++) s.writeLine('LINE ' + i);
  assert.equal(s.rows.length, 24, 'only 24 rows on the glass');
  assert.equal(s.rows[0].trimEnd(), 'LINE 7', 'the first six scrolled away');
  assert.equal(s.rows[23].trimEnd(), 'LINE 30', 'the newest line is on the bottom row');
});

test('MODE presets: 80x24 VT, 80x25 IBM, 40x25 C64', async () => {
  const { SCREEN_MODES } = await import('../../public/js/editor.js');
  assert.deepEqual(SCREEN_MODES.map((m) => [m.cols, m.rows, m.tag]), [
    [80, 24, 'VT-80'],
    [80, 25, 'PC-80'],
    [40, 25, 'C64-40'],
  ]);
});

test('the editor cycles display modes with MODE and keeps the content', async () => {
  const net = await import('../../public/js/net.js');
  net.setSocket({ readyState: 1, sent: [], send: () => {} });
  const { Editor } = await import('../../public/js/editor.js');
  const ed = new Editor({ container: makeEl('div'), teletype: false });
  const before = ed.screen.rows[0];
  ed._enter('MODE'); // 80x24 -> 80x25
  assert.deepEqual([ed.screen.cols, ed.screen.rows.length], [80, 25]);
  assert.ok(ed.screen.rows[0].includes(before.trim()), 'content survives the mode change');
  ed._enter('MODE'); ed._enter('MODE'); // two more: three total wraps back to 80x24
  assert.deepEqual([ed.screen.cols, ed.screen.rows.length], [80, 24]);
  assert.ok(ed.statusEl.textContent.includes('VT-80'), 'the status shows the mode tag');
});

test('fitFontSize scales the cell so the glass fills the window', async () => {
  const { fitFontSize } = await import('../../public/js/editor.js');
  // a tall window: the height dominates and the cell grows big (fills the glass)
  assert.equal(fitFontSize(24, 800, 80, 1296), 28); // 800/24/1.15 = 28.98 → 28
  // a narrow window: the width caps it (80 cols must fit the window)
  assert.equal(fitFontSize(24, 900, 80, 400), 9); // 400/(80*0.55) = 9.09 → 9
  // a short window: the height shrinks the cell
  assert.equal(fitFontSize(24, 345, 80, 1296), 12); // 345/24/1.15 = 12.5 → 12
  // a tiny window: never below the readable floor
  assert.equal(fitFontSize(24, 120, 80, 1296), 9);
  // the 25-row mode fits a hair smaller than the 24-row mode at the same height
  assert.ok(fitFontSize(25, 345, 80, 1296) <= fitFontSize(24, 345, 80, 1296));
});

test('the glass box resizes in character units with the mode', async () => {
  const net = await import('../../public/js/net.js');
  net.setSocket({ readyState: 1, sent: [], send: () => {} });
  const { Editor } = await import('../../public/js/editor.js');
  const ed = new Editor({ container: makeEl('div'), teletype: false });
  ed._enter('MODE'); // 80x25
  assert.ok(ed.out.style.width.includes('80ch'), '80-column glass: ' + ed.out.style.width);
  ed._enter('MODE'); // now at C64-40 (two modes total)
  assert.ok(ed.out.style.width.includes('40ch'), 'the C64 glass is visibly narrower: ' + ed.out.style.width);
  assert.ok(ed.out.style.height.includes('25'), '25 rows tall');
});

test('the deck rejects lines longer than 80 columns (punch-card width)', async () => {
  const { Deck } = await import('../../public/js/editor.js');
  const d = new Deck();
  d.append('X'.repeat(80));
  assert.equal(d.count(), 1, '80 columns fit on a card');
  assert.throws(() => d.append('X'.repeat(81)), /80 columns/i);
});
