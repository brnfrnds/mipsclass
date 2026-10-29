import { makeMipsFromFiles, registerHandlers, StopReason } from './lib/mips-core.mjs';
import { GADGET_IO, write as gadgetWrite } from './gadgets.js';

const STOP_REASON_NAME = {
  [-1]: 'NONE',
  0: 'BREAKPOINT',
  1: 'EXCEPTION',
  3: 'NORMAL_TERMINATION',
  4: 'CLIFF_TERMINATION',
  5: 'PAUSE',
  6: 'STOP',
};

// Memory-write observers live on the shared simulator memory and survive
// assemble()/initialize(), so the gadget observers are registered exactly once
// per page — on the first MipsSim instance — and apply to every later one.
let gadgetObserversRegistered = false;

// IO handlers are ALSO shared per page: registering them on every instance
// stacks them (print output doubles per run). Register once, routing to
// whichever sim ran last.
let activeSim = null;
let handlersRegistered = false;

export class MipsSim {
  constructor(source, entryFile = 'main.asm') {
    this.entryFile = entryFile;
    this.source = source || '';
    this.mips = makeMipsFromFiles({ [this.entryFile]: this.source }, this.entryFile);
    this.onScreenOutput = null;
    this._screen = '';
    this._lastAssemble = null;

    activeSim = this;
    if (!handlersRegistered) {
      registerHandlers(this.mips, {
        printString: (text) => {
          if (!activeSim) return;
          activeSim._screen += text;
          if (activeSim.onScreenOutput) activeSim.onScreenOutput(text);
        },
        stdOut: (bytes) => {
          if (!activeSim) return;
          const text = new TextDecoder().decode(new Uint8Array(bytes));
          activeSim._screen += text;
          if (activeSim.onScreenOutput) activeSim.onScreenOutput(text);
        },
      });
      handlersRegistered = true;
    }

    if (!gadgetObserversRegistered) {
      // NOTE: the sim word-rounds an observer's end, so a range ending
      // exactly at the next gadget's base would swallow its first word
      // (bytes double-fire). Keep a one-word margin below the neighbor.
      for (const base of [GADGET_IO.PRINTER_BASE, GADGET_IO.BOARD_BASE, GADGET_IO.CONTROLLER_BASE]) {
        this.mips.addMemoryWriteObserver(
          base,
          base + GADGET_IO.GADGET_RANGE - 16,
          (address, length, value) => gadgetWrite(address, value)
        );
      }
      gadgetObserversRegistered = true;
    }
  }

  setSource(source) {
    this.source = source || '';
    this.mips = makeMipsFromFiles({ [this.entryFile]: this.source }, this.entryFile);
    this._screen = '';
    this._lastAssemble = null;
  }

  assemble() {
    this._lastAssemble = this.mips.assemble();
    return this._lastAssemble;
  }

  assembleOk() {
    return Boolean(this._lastAssemble) && !this._lastAssemble.hasErrors;
  }

  assembleErrors() {
    return this._lastAssemble ? this._lastAssemble.errors : [];
  }

  assembleReport() {
    return this._lastAssemble ? this._lastAssemble.report : '';
  }

  async run(steps) {
    // Reset execution state (PC, registers, exited flag) so every run starts fresh at main.
    this.mips.initialize(true);
    this._screen = '';
    if (Number.isInteger(steps) && steps >= 0) {
      for (let i = 0; i < steps; i++) await this.mips.step();
      return { stopped: true, reason: 'STEPS' };
    }
    const reason = await this.mips.simulate();
    return { stopped: true, reason: STOP_REASON_NAME[reason] ?? String(reason) };
  }

  readRegister(name) {
    return this.mips.getRegisterValue(name);
  }

  setRegister(name, value) {
    this.mips.setRegisterValue(name, value);
  }

  readMemory(addr) {
    const b = this.mips.readMemoryBytes(addr, 4);
    return ((b[0] << 24) | (b[1] << 16) | (b[2] << 8) | b[3]) >>> 0;
  }

  readMemoryBytes(addr, length) {
    return this.mips.readMemoryBytes(addr, length);
  }

  getScreenOutput() {
    return this._screen;
  }

  clearScreen() {
    this._screen = '';
  }
}
