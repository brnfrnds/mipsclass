import { MipsSim } from './mips.js';

export class Editor {
  constructor({ container = document.body } = {}) {
    this.el = document.createElement('div');
    this.el.style.cssText =
      'position:fixed; inset:0; background:#0b0c10; color:#c5c6c7; ' +
      'font-family:"Courier New",Courier,monospace; z-index:50; display:flex; ' +
      'flex-direction:column; padding:12px; box-sizing:border-box;';

    const hint = document.createElement('div');
    hint.textContent = 'MIPS terminal — write assembly, press Run. Screen output appears below.';
    hint.style.cssText = 'font-size:12px; color:#66fcf1; margin-bottom:8px;';
    this.el.appendChild(hint);

    this.ta = document.createElement('textarea');
    this.ta.style.cssText =
      'flex:1; background:#000; color:#0f0; border:1px solid #45a29e; ' +
      'padding:8px; font-size:13px; resize:none; spellcheck:false;';
    this.ta.value =
      '.data\nmsg: .asciiz "Hello from MIPS\\n"\n.text\n.globl main\nmain:\n' +
      '  li $v0, 4\n  la $a0, msg\n  syscall\n  li $v0, 10\n  syscall';
    this.el.appendChild(this.ta);

    const bar = document.createElement('div');
    bar.style.cssText = 'margin-top:8px; display:flex; gap:8px; align-items:center;';
    const run = document.createElement('button');
    run.textContent = 'Run';
    run.style.cssText =
      'padding:8px 16px; background:#1f2833; border:1px solid #66fcf1; ' +
      'color:#66fcf1; font-family:inherit; font-weight:bold; cursor:pointer;';
    const clear = document.createElement('button');
    clear.textContent = 'Clear';
    clear.style.cssText =
      'padding:8px 16px; background:#1f2833; border:1px solid #45a29e; ' +
      'color:#c5c6c7; font-family:inherit; cursor:pointer;';
    bar.appendChild(run);
    bar.appendChild(clear);
    this.el.appendChild(bar);

    this.log = document.createElement('pre');
    this.log.style.cssText =
      'margin-top:8px; flex:0 0 150px; overflow:auto; background:#000; ' +
      'border:1px solid #45a29e; padding:8px; font-size:12px; color:#0f0; white-space:pre-wrap;';
    this.el.appendChild(this.log);

    const close = document.createElement('button');
    close.textContent = 'Close';
    close.style.cssText =
      'margin-top:8px; padding:6px 12px; background:#222; border:1px solid #555; ' +
      'color:#c5c6c7; cursor:pointer;';
    close.onclick = () => this.hide();
    this.el.appendChild(close);

    run.onclick = () => this._run();
    clear.onclick = () => { this.ta.value = ''; this.log.textContent = ''; };

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
  destroy() { this.el.remove(); }
}

export function mountEditor(opts) {
  const ed = new Editor(opts);
  ed.show();
  return ed;
}
