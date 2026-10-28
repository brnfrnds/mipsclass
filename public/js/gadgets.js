// Office gadgets, memory-mapped into the top of the MARS static-data window
// (0x10030000.., below the heap at 0x10040000). Memory-write observers do not
// fire on the MMIO region (0xffff0000+), so gadgets live here. A MIPS program
// "uses" a gadget by storing BYTES (sb) into its range: printer/board ranges
// append ASCII characters to their text; the controller range records raw
// writes. Every write is reported to the server as a gadgetUpdate so every
// client sees the gadget state.
import { send } from './net.js';

export const GADGET_IO = {
  PRINTER_BASE: 0x10030000,
  GADGET_RANGE: 0x1000,
  BOARD_BASE: 0x10031000,
  CONTROLLER_BASE: 0x10032000,
};

const model = {
  printer: { text: '', online: true },
  board: { text: '', online: true },
  controller: {},
};

const writeListeners = []; // (gadgetKey) => void, fired on LOCAL writes

function inRange(addr, base, size = GADGET_IO.GADGET_RANGE) {
  return addr >= base && addr < base + size;
}

function sendGadgetUpdate(gadget) {
  send({ type: 'gadgetUpdate', gadget });
}

export function write(address, value) {
  const ch = String.fromCharCode(value & 0xFF);
  if (inRange(address, GADGET_IO.PRINTER_BASE)) {
    model.printer.text += ch;
    sendGadgetUpdate({ printer: { text: model.printer.text } });
    fireWrite('printer');
    return 'printer';
  }
  if (inRange(address, GADGET_IO.BOARD_BASE)) {
    model.board.text += ch;
    sendGadgetUpdate({ board: { text: model.board.text } });
    fireWrite('board');
    return 'board';
  }
  if (inRange(address, GADGET_IO.CONTROLLER_BASE)) {
    model.controller['w' + (address - GADGET_IO.CONTROLLER_BASE)] = value;
    sendGadgetUpdate({ controller: { ...model.controller } });
    fireWrite('controller');
    return 'controller';
  }
  return null;
}

function fireWrite(key) {
  writeListeners.forEach((fn) => {
    try { fn(key, getModel()); } catch (e) { console.error('gadget listener error:', e); }
  });
}

export function onWrite(fn) {
  writeListeners.push(fn);
}

/** Merge a server gadgetState broadcast into the local model. */
export function applyState(state) {
  if (!state) return;
  if (state.printer) model.printer = { ...model.printer, ...state.printer };
  if (state.board) model.board = { ...model.board, ...state.board };
  if (state.controller) model.controller = { ...model.controller, ...state.controller };
}

export function getModel() {
  return {
    printer: { ...model.printer },
    board: { ...model.board },
    controller: { ...model.controller },
  };
}

export function reset() {
  model.printer.text = '';
  model.board.text = '';
  model.controller = {};
}
