import { makeMipsFromFiles, registerHandlers, StopReason } from './lib/mips-core.mjs';

const STOP_REASON_NAME = {
  [-1]: 'NONE',
  0: 'BREAKPOINT',
  1: 'EXCEPTION',
  3: 'NORMAL_TERMINATION',
  4: 'CLIFF_TERMINATION',
  5: 'PAUSE',
  6: 'STOP',
};

export class MipsSim {
  constructor(source, entryFile = 'main.asm') {
    this.entryFile = entryFile;
    this.source = source || '';
    this.mips = makeMipsFromFiles({ [this.entryFile]: this.source }, this.entryFile);
    this.onScreenOutput = null;
    this._screen = '';
    this._lastAssemble = null;

    registerHandlers(this.mips, {
      printString: (text) => {
        this._screen += text;
        if (this.onScreenOutput) this.onScreenOutput(text);
      },
      stdOut: (bytes) => {
        const text = new TextDecoder().decode(new Uint8Array(bytes));
        this._screen += text;
        if (this.onScreenOutput) this.onScreenOutput(text);
      },
    });
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
