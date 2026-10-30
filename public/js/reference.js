// The Green Card: the operator's reference sheet. The instruction sections
// are GENERATED from the vendored simulator's own instruction set, so the
// card can never drift from what the machine really assembles. Machine room
// sections (gadget map, editor commands, syscalls, registers, ASCII) are
// hand-authored. Foldable by section, filterable, always on top.
import { MIPS } from './lib/mips-core.mjs';

const GADGET_ROWS = [
  ['PRINTER (PRIVATE)', '0x10030000', 'SB — ONE ASCII BYTE PER STORE'],
  ['DISPLAY BOARD (SHARED)', '0x10031000', 'SB — ONE ASCII BYTE PER STORE'],
  ['CONTROLLER (SHARED)', '0x10032000', 'SW — RAW WORDS'],
];

const EDITOR_ROWS = [
  ['L', 'LIST THE WHOLE DECK'],
  ['L 3-7', 'LIST LINES 3 TO 7'],
  ['I 5', 'INSERT BEFORE LINE 5 — TYPE LINES, "." ENDS'],
  ['C 3 TEXT', 'REPLACE LINE 3 WITH TEXT'],
  ['D 3 / D 3-5', 'DELETE A LINE / A RANGE'],
  ['T', 'SHOW THE TOP OF THE DECK'],
  ['SUBMIT', 'SEND THE DECK TO THE MAINFRAME'],
  ['KILL N / BUMP N', 'OPERATOR ONLY — THE QUEUE'],
  ['REF', 'THIS CARD'],
];

const SYSCALL_ROWS = [
  ['1', 'PRINT INT ($A0)'],
  ['4', 'PRINT STRING ($A0 = ADDRESS)'],
  ['10', 'EXIT'],
  ['11', 'PRINT CHAR ($A0 = ASCII)'],
  ['5', 'READ INT (RETURNS IN $V0) — NOT WIRED TO THE OFFICE YET'],
];

const REGISTERS = [
  ['$ZERO', 'ALWAYS 0'], ['$V0-$V1', 'VALUES / SYSCALLS'], ['$A0-$A3', 'ARGUMENTS'],
  ['$T0-$T9', 'SCRATCH (NOT SAVED)'], ['$S0-$S7', 'SAVED'], ['$GP $SP $FP', 'STACK / GLOBALS'],
  ['$RA', 'RETURN ADDRESS'], ['$AT', 'ASSEMBLER TEMP — DO NOT USE'],
];

const ASCII_ROWS = [
  ['SPACE 32', '! 33', '" 34', '# 35', '$ 36', '% 37', '& 38', "' 39"],
  ['( 40', ') 41', '* 42', '+ 43', ', 44', '- 45', '. 46', '/ 47'],
  ['0-9 48-57', ': 58', '; 59', '< 60', '= 61', '> 62', '? 63'],
  ['A-Z 65-90', '[ 91', '] 93', '! 33'],
];

function groupOf(instr) {
  const n = instr.name.toLowerCase();
  if (['lw', 'sw', 'lb', 'sb', 'lh', 'sh', 'la', 'li'].includes(n)) return 'MEMORY';
  if (['beq', 'bne', 'j', 'jr', 'jal', 'blez', 'bgtz', 'bltz', 'bgez', 'ble', 'bgt', 'blt', 'bge', 'beqz', 'bnez'].includes(n)) return 'BRANCH/JUMP';
  if (['syscall', 'nop', 'break'].includes(n)) return 'SYSTEM';
  return 'ARITHMETIC/LOGIC';
}

export function buildReferenceData() {
  let set = [];
  try { set = MIPS.getInstructionSet() || []; } catch { set = []; }
  const groups = { MEMORY: [], 'BRANCH/JUMP': [], 'ARITHMETIC/LOGIC': [], SYSTEM: [] };
  const seen = new Set();
  for (const ins of set) {
    if (seen.has(ins.name)) continue;
    seen.add(ins.name);
    groups[groupOf(ins)].push(ins);
  }
  return {
    machine: GADGET_ROWS,
    editor: EDITOR_ROWS,
    instructions: groups,
    syscalls: SYSCALL_ROWS,
    registers: REGISTERS,
    ascii: ASCII_ROWS,
  };
}

export class ReferenceCard {
  constructor({ container = document.body } = {}) {
    this.open = {}; // the fold state per section title (undefined = open)
    this.data = buildReferenceData();
    this.el = document.createElement('div');
    this.el.className = 'ref-card';

    const head = document.createElement('div');
    head.className = 'ref-head';
    const title = document.createElement('span');
    title.className = 'ref-title';
    title.textContent = 'REFERENCE CARD — MIPS DIVISION';
    const close = document.createElement('button');
    close.className = 'ref-close';
    close.textContent = '✕';
    close.onclick = () => this.hide();
    head.appendChild(title);
    head.appendChild(close);
    this.el.appendChild(head);

    this.filter = document.createElement('input');
    this.filter.className = 'ref-filter';
    this.filter.placeholder = 'FILTER (E.G. SB)';
    this.filter.addEventListener('input', () => this.render());
    this.el.appendChild(this.filter);

    this.body = document.createElement('div');
    this.body.className = 'ref-body';
    this.el.appendChild(this.body);

    // draggable by the header
    let drag = null;
    head.addEventListener('mousedown', (e) => {
      const r = this.el.getBoundingClientRect();
      drag = { dx: e.clientX - r.left, dy: e.clientY - r.top };
    });
    document.addEventListener('mousemove', (e) => {
      if (!drag) return;
      this.el.style.left = (e.clientX - drag.dx) + 'px';
      this.el.style.top = (e.clientY - drag.dy) + 'px';
      this.el.style.right = 'auto';
    });
    document.addEventListener('mouseup', () => { drag = null; });

    container.appendChild(this.el);
    this.render();
  }

  render() {
    const f = (this.filter.value || '').toUpperCase();
    const match = (s) => !f || String(s).toUpperCase().includes(f);
    this.body.textContent = '';

    // a foldable section: the header toggles open/closed and re-renders.
    // The toggle reads the CURRENT state at click time (a stale header's
    // handler must still flip it, not re-apply a stale render's value).
    const section = (title, rows, forceOpen) => {
      const open = forceOpen || this.open[title] !== false;
      const h = document.createElement('div');
      h.className = 'ref-fold-head';
      h.textContent = (open ? '[−] ' : '[+] ') + title;
      h.onclick = () => {
        const now = this.open[title] !== false;
        this.open[title] = !now;
        this.render();
      };
      this.body.appendChild(h);
      const wrap = document.createElement('div');
      wrap.className = 'ref-section' + (open ? '' : ' ref-folded');
      for (const r of rows) {
        const line = document.createElement('div');
        line.className = 'ref-row';
        line.textContent = r.length === 2 ? r[0].padEnd(14) + '  ' + r[1] : r.join('  ');
        wrap.appendChild(line);
      }
      this.body.appendChild(wrap);
    };

    section('MACHINE — OFFICE GADGETS', this.data.machine.map((r) => [r[0], r[1] + ' ' + r[2]]));
    section('EDITOR COMMANDS', this.data.editor);

    for (const [group, instrs] of Object.entries(this.data.instructions)) {
      const filtered = instrs.filter((i) => match(i.name) || match(i.example) || match(i.description));
      if (f && filtered.length === 0) continue;
      section('INSTRUCTIONS — ' + group + ' (' + instrs.length + ')',
        filtered.slice(0, f ? 200 : 40).map((i) => [i.name.toUpperCase(), i.example, i.isPseudo ? '(PSEUDO)' : '']),
        !!f); // a filter opens matching sections
    }

    section('SYSCALLS ($V0 = SERVICE)', this.data.syscalls);
    section('REGISTERS', this.data.registers.map((r) => [r[0], r[1]]));
    section('ASCII (FOR SB HAND-ENCODING)', this.data.ascii);
  }

  toggle() {
    if (this.el.style.display === 'flex') this.hide();
    else this.show();
  }
  show() { this.el.style.display = 'flex'; }
  hide() { this.el.style.display = 'none'; }
}

export function mountReference(opts) {
  const card = new ReferenceCard(opts);
  card.hide();
  return card;
}
