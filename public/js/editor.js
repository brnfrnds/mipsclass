import { MipsSim } from './mips.js';

export class Editor {
  constructor({ container = document.body } = {}) {
    this.el = document.createElement('div');
    this.el.className = 'editor';

    const header = document.createElement('div');
    header.className = 'editor-header';
    const title = document.createElement('span');
    title.className = 'editor-title';
    title.textContent = 'MIPSDOS 2.11 — OPERATOR TERMINAL';
    const hint = document.createElement('span');
    hint.className = 'editor-hint';
    hint.textContent = 'write assembly, press RUN — output lands on the log below';
    header.appendChild(title);
    header.appendChild(hint);
    this.el.appendChild(header);

    this.ta = document.createElement('textarea');
    this.ta.className = 'editor-code';
    this.ta.spellcheck = false;
    this.ta.value =
      '.data\nmsg: .asciiz "Hello from MIPS\\n"\n.text\n.globl main\nmain:\n' +
      '  li $v0, 4\n  la $a0, msg\n  syscall\n  li $v0, 10\n  syscall';
    this.el.appendChild(this.ta);

    const bar = document.createElement('div');
    bar.className = 'editor-toolbar';
    const run = document.createElement('button');
    run.textContent = 'RUN';
    const clear = document.createElement('button');
    clear.textContent = 'CLEAR';
    bar.appendChild(run);
    bar.appendChild(clear);
    this.el.appendChild(bar);

    this.log = document.createElement('pre');
    this.log.className = 'editor-log';
    this.el.appendChild(this.log);

    const close = document.createElement('button');
    close.className = 'editor-close';
    close.textContent = 'BACK TO OFFICE [ESC]';
    close.onclick = () => this.hide();
    this.el.appendChild(close);

    run.onclick = () => this._run();
    clear.onclick = () => { this.ta.value = ''; this.log.textContent = ''; };

    this._esc = (e) => { if (e.key === 'Escape') this.hide(); };
    document.addEventListener('keydown', this._esc);

    container.appendChild(this.el);
  }

  _run() {
    const sim = new MipsSim(this.ta.value);
    sim.onScreenOutput = (text) => { this.log.textContent += text; };
    sim.assemble();
    if (!sim.assembleOk()) {
      this.log.textContent +=
        '\nASM ERRORS:\n' + sim.assembleErrors().map((e) => e.message).join('\n') + '\n';
      return;
    }
    sim.run().then(
      (res) => { this.log.textContent += `\n[stopped: ${res.reason}]\n`; },
      (err) => { this.log.textContent += '\nRUN ERROR: ' + (err && err.message ? err.message : String(err)) + '\n'; }
    );
  }

  show() { this.el.style.display = 'flex'; }
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
