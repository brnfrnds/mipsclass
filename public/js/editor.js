import { MipsSim } from './mips.js';
import { resetAndSync } from './gadgets.js';
import { send as netSend } from './net.js';

// ---------------------------------------------------------------------------
// Command parsing: everything is uppercased (the teletype had no lowercase),
// arguments are split but their text is preserved (only recased).
// ---------------------------------------------------------------------------
export function parseCommand(line) {
  const trimmed = String(line).trim();
  if (!trimmed) return null;
  const upper = trimmed.toUpperCase();
  const sp = upper.indexOf(' ');
  if (sp === -1) return { cmd: upper, args: [] };
  return { cmd: upper.slice(0, sp), args: splitArgs(upper.slice(sp + 1)) };
}

function splitArgs(rest) {
  // first token, then the remainder as one argument (code text keeps its spaces)
  const firstSpace = rest.indexOf(' ');
  if (firstSpace === -1) return [rest];
  return [rest.slice(0, firstSpace), rest.slice(firstSpace + 1)];
}

// ---------------------------------------------------------------------------
// The deck: the program as an array of lines (one line = one card).
// Line numbers are 1-based.
// ---------------------------------------------------------------------------
export class Deck {
  constructor() { this.lines = []; }

  count() { return this.lines.length; }
  line(n) { this._check(n); return this.lines[n - 1]; }

  append(text) { this.lines.push(String(text).toUpperCase()); }

  insertBefore(n, text) {
    if (!Number.isInteger(n) || n < 1 || n > this.lines.length + 1) {
      throw new Error(`LINE ${n} OUT OF RANGE`);
    }
    this.lines.splice(n - 1, 0, String(text).toUpperCase());
  }

  change(n, text) {
    this._check(n);
    this.lines[n - 1] = String(text).toUpperCase();
  }

  deleteRange(a, b) {
    if (!Number.isInteger(a) || !Number.isInteger(b) || a < 1 || b < a || b > this.lines.length) {
      throw new Error(`RANGE ${a}-${b} OUT OF RANGE`);
    }
    this.lines.splice(a - 1, b - a + 1);
  }

  _check(n) {
    if (!Number.isInteger(n) || n < 1 || n > this.lines.length) {
      throw new Error(`LINE ${n} OUT OF RANGE`);
    }
  }

  format(a, b) {
    this._check(a);
    const end = Math.min(b ?? a, this.lines.length);
    if (end < a) throw new Error(`RANGE ${a}-${b} OUT OF RANGE`);
    const out = [];
    for (let n = a; n <= end; n++) {
      out.push(String(n).padStart(6) + '  ' + this.lines[n - 1]);
    }
    return out;
  }

  top() { return this.format(1, Math.min(10, this.lines.length)); }

  all() { return this.lines.slice(); }
}

// ---------------------------------------------------------------------------
// The assembler listing: source with error flags, machine code, symbols.
// ---------------------------------------------------------------------------
export function buildListing(sim, deckLines) {
  const errorsByLine = new Map();
  for (const e of sim.assembleErrors()) {
    if (e.sourceLine) errorsByLine.set(e.sourceLine, e.message);
  }

  const source = deckLines.map((text, i) => ({
    n: i + 1,
    text,
    flag: errorsByLine.has(i + 1) ? ' †' : '',
  }));

  const machine = [];
  deckLines.forEach((_, i) => {
    let stmts = [];
    try { stmts = sim.statementsAt(i + 1) || []; } catch { stmts = []; }
    for (const st of stmts) {
      machine.push({
        addr: (st.address >>> 0).toString(16).padStart(8, '0').toUpperCase(),
        code: st.machineStatement,
        line: i + 1,
      });
    }
  });

  const symbols = [];
  const seen = new Set();
  deckLines.forEach((text, i) => {
    const m = text.match(/^\s*([A-Z_][A-Z0-9_]*):/);
    if (!m) return;
    const name = m[1];
    if (seen.has(name)) return;
    seen.add(name);
    const addr = sim.addressOfLabel(name);
    if (addr > 0) symbols.push({ name, addr: (addr >>> 0).toString(16).padStart(8, '0').toUpperCase() });
  });

  return { source, machine, symbols, hasErrors: sim.assembleErrors().length > 0 };
}

// ---------------------------------------------------------------------------
// Typing pulse (broadcast to the office while the operator types)
// ---------------------------------------------------------------------------
export function createTypingPulse(send, idleMs = 1200) {
  let timer = null;
  return function press() {
    send({ type: 'typing', typing: true });
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => send({ type: 'typing', typing: false }), idleMs);
  };
}

// ---------------------------------------------------------------------------
// The terminal: a command line and an output pane. This IS the machine.
// ---------------------------------------------------------------------------
export class Editor {
  constructor({ container = document.body } = {}) {
    this.el = document.createElement('div');
    this.el.className = 'editor terminal';

    const header = document.createElement('div');
    header.className = 'editor-header';
    const title = document.createElement('span');
    title.className = 'editor-title';
    title.textContent = 'MIPSDOS 2.11 — LINE EDITOR / BATCH TERMINAL';
    const hint = document.createElement('span');
    hint.className = 'editor-hint';
    hint.textContent = 'L LIST · I 5 INSERT · C 3 CHANGE · D 3-5 DELETE · T TOP · SUBMIT · REF';
    header.appendChild(title);
    header.appendChild(hint);
    this.el.appendChild(header);

    // the output pane: the teletype paper (scrolling)
    this.out = document.createElement('div');
    this.out.className = 'terminal-out';
    this.el.appendChild(this.out);

    // the status line: queue position etc.
    this.statusEl = document.createElement('div');
    this.statusEl.className = 'terminal-status';
    this.statusEl.textContent = 'READY';
    this.el.appendChild(this.statusEl);

    // the command line
    this.cmd = document.createElement('input');
    this.cmd.className = 'terminal-cmd';
    this.cmd.spellcheck = false;
    this.cmd.autocomplete = 'off';
    this.el.appendChild(this.cmd);

    const close = document.createElement('button');
    close.className = 'editor-close';
    close.textContent = 'BACK TO OFFICE [ESC]';
    close.onclick = () => this.hide();
    this.el.appendChild(close);

    this.deck = new Deck();
    ['  LI $V0, 4', '  LA $A0, HELLO', '  SYSCALL', '  LI $V0, 10', '  SYSCALL', 'HELLO: .ASCIIZ "HELLO WORLD"'].forEach((l) => this.deck.append(l));
    this.inserting = null; // null, or the line number inserting before
    this.outstanding = null; // the queued job (phase ②)

    const pulse = createTypingPulse(netSend);
    this.cmd.addEventListener('input', () => pulse());
    this.cmd.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      const raw = this.cmd.value;
      this.cmd.value = '';
      this._enter(raw);
    });

    this._esc = (e) => { if (e.key === 'Escape') this.hide(); };
    document.addEventListener('keydown', this._esc);

    container.appendChild(this.el);

    this.print(['MIPSDOS LINE EDITOR — DECK LOADED: HELLO WORLD TEMPLATE', 'TYPE L TO LIST THE DECK. TYPE HELP FOR COMMANDS.']);
  }

  _enter(raw) {
    const echo = '> ' + raw.toUpperCase();
    if (this.inserting !== null) {
      this.print([echo]);
      if (raw.trim() === '.') {
        this.print(['.INSERT MODE OFF']);
        this.inserting = null;
        this._status();
        return;
      }
      if (raw.trim()) {
        try {
          this.deck.insertBefore(this.inserting, raw);
          this.inserting++;
          this._status();
        } catch (err) {
          this.print([String(err.message).toUpperCase()]);
        }
      }
      return;
    }

    this.print([echo]);
    const parsed = parseCommand(raw);
    if (!parsed) return;
    const { cmd, args } = parsed;
    try {
      switch (cmd) {
        case 'L':
          if (args.length === 0) this.print(this.deck.format(1, this.deck.count()));
          else {
            const range = args[0].split('-').map((x) => parseInt(x, 10));
            this.print(this.deck.format(range[0], range[1] ?? range[0]));
          }
          break;
        case 'I': {
          const n = parseInt(args[0], 10);
          if (args[1] !== undefined) { // one-shot: I 5 TEXT
            this.deck.insertBefore(n, args[1]);
            this.print([`LINE ${n} INSERTED`]);
          } else {
            this.inserting = n;
            this.print([`.INSERT MODE — TYPE LINES BEFORE ${n}; A LINE '.' ENDS`]);
            this._status();
          }
          break;
        }
        case 'C':
          if (args[1] === undefined) throw new Error('C REQUIRES TEXT');
          this.deck.change(parseInt(args[0], 10), args[1]);
          this.print([`LINE ${args[0]} CHANGED`]);
          break;
        case 'D': {
          const range = args[0].split('-').map((x) => parseInt(x, 10));
          this.deck.deleteRange(range[0], range[1] ?? range[0]);
          this.print([`DELETED ${range[0]}${range[1] && range[1] !== range[0] ? '-' + range[1] : ''}`]);
          break;
        }
        case 'T':
          this.print(this.deck.top());
          break;
        case 'SUBMIT':
          this._submit();
          break;
        case 'REF':
          if (typeof this.onRef === 'function') this.onRef();
          else this.print(['REFERENCE CARD — NOT AVAILABLE YET']);
          break;
        case 'HELP':
          this.print(['L [A-B] LIST · I N INSERT BEFORE N · C N TEXT · D N / D A-B DELETE', 'T TOP 10 · SUBMIT SEND THE DECK · REF REFERENCE CARD']);
          break;
        default:
          this.print(['WHAT?']);
      }
    } catch (err) {
      this.print([String(err.message).toUpperCase()]);
    }
  }

  _status() {
    if (this.outstanding) {
      this.statusEl.textContent = this.outstanding;
    } else if (this.inserting !== null) {
      this.statusEl.textContent = `.INSERT MODE — BEFORE LINE ${this.inserting}; '.' ENDS`;
    } else {
      this.statusEl.textContent = 'READY';
    }
  }

  _submit() {
    if (this.outstanding) {
      this.print(['ALREADY ONE JOB OUTSTANDING — WAIT FOR THE LISTING']);
      return;
    }
    if (this.deck.count() === 0) {
      this.print(['THE DECK IS EMPTY']);
      return;
    }
    // Phase ① transition: submit runs instantly. The queue takes over in ②.
    resetAndSync();
    const deckLines = this.deck.all();
    const sim = new MipsSim(deckLines.join('\n'));
    sim.assemble();
    this._printListing(sim, deckLines);
  }

  /** Print the assembler listing into the terminal pane. */
  _printListing(sim, deckLines) {
    const listing = buildListing(sim, deckLines);
    const lines = [];
    lines.push('=== SOURCE ===');
    for (const l of listing.source) lines.push(String(l.n).padStart(6) + '  ' + l.text + l.flag);
    lines.push('=== MACHINE CODE (' + listing.machine.length + ') ===');
    for (const m of listing.machine) lines.push('  ' + m.addr + '  ' + m.code);
    lines.push('=== SYMBOLS (' + listing.symbols.length + ') ===');
    for (const s of listing.symbols) lines.push('  ' + s.name.padEnd(12) + s.addr);
    lines.push(listing.hasErrors ? '== ASSEMBLY HALTED ==' : '== ASSEMBLY CLEAN ==');
    this.print(lines);

    if (listing.hasErrors) {
      netSend({ type: 'blowUp' });
      return;
    }
    sim.run().then(
      (res) => this.print(['[STOPPED: ' + res.reason + ']']),
      (err) => {
        this.print(['RUN ERROR: ' + (err && err.message ? err.message : String(err))]);
        if (err && err.name === 'RuntimeError') netSend({ type: 'blowUp' });
      }
    );
  }

  print(lines) {
    for (const line of lines) {
      const div = document.createElement('div');
      div.className = 'terminal-line';
      div.textContent = line;
      this.out.appendChild(div);
    }
    this.out.scrollTop = this.out.scrollHeight;
  }

  setStatus(text) {
    this.outstanding = text;
    this._status();
  }

  show() { this.el.style.display = 'flex'; this.cmd.focus(); }
  hide() { this.el.style.display = 'none'; }
  destroy() {
    document.removeEventListener('keydown', this._esc);
    this.el.remove();
  }
}

export function mountEditor(opts) {
  const ed = new Editor(opts);
  ed.show();
  return ed;
}
