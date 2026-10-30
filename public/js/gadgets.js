// Office gadgets, memory-mapped into the top of the MARS static-data window
// (0x10030000.., below the heap at 0x10040000). Memory-write observers do not
// fire on the MMIO region (0xffff0000+), so gadgets live here. A MIPS program
// "uses" a gadget by storing BYTES (sb) into its range.
//
// The PRINTER is private: its output lands on the operator's own paper card
// on screen and is never broadcast. The display BOARD and CONTROLLER are
// office-shared: every write is reported to the server as a gadgetUpdate so
// every client sees the same wall board.
import { send } from './net.js';
import * as sound from './sound.js';

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

// --- the paper card: your private printout, always on top, dismissible ---
let cardEl = null;
let cardTextEl = null;
let cardDismissed = false;
let cardOutEl = null; // the program's output lines (after the listing)
const cardFolds = { SOURCE: true, MACHINE: false, SYMBOLS: false };

function ensureCard() {
  if (cardEl || typeof document === 'undefined') return; // node tests: no DOM
  cardEl = document.createElement('div');
  cardEl.className = 'printer-card';

  const head = document.createElement('div');
  head.className = 'printer-card-head';
  const title = document.createElement('span');
  title.className = 'printer-card-title';
  title.textContent = 'PRINTOUT — OFFICE PRINTER';
  const tear = document.createElement('button');
  tear.className = 'printer-card-tear';
  tear.textContent = 'Tear off';
  tear.onclick = () => dismissCard();
  head.appendChild(title);
  head.appendChild(tear);
  cardEl.appendChild(head);

  cardTextEl = document.createElement('pre');
  cardTextEl.className = 'printer-card-paper';
  cardEl.appendChild(cardTextEl);

  document.body.appendChild(cardEl);
}

function renderCard() {
  if (cardDismissed) return;
  ensureCard();
  if (!cardEl) return; // node tests: no DOM
  cardEl.style.display = 'flex';
}

function dismissCard() {
  cardDismissed = true;
  if (cardEl) cardEl.style.display = 'none';
}

/**
 * The job's printout: the assembler listing printed onto the paper card
 * line-by-line (teletype pace), sections foldable on the paper itself.
 */
export function cardListing(lines, paced = true, onDone = null) {
  if (typeof document === 'undefined') return; // node tests: no DOM
  ensureCard();
  cardDismissed = false;
  renderCard();
  cardTextEl.textContent = '';
  let section = null;
  lines.forEach((line, i) => {
    if (line.startsWith('=== ')) section = line.replace(/===|\(/g, '').trim().split(' ')[0];
    const sec = section;
    const emit = () => {
      sound.teletypeTick();
      const isHead = line.startsWith('=== ');
      const div = document.createElement('div');
      if (isHead) {
        div.className = 'pc-fold-head';
        div.dataset.section = sec;
        div.textContent = (cardFolds[sec] ? '[−] ' : '[+] ') + line;
        div.onclick = () => toggleCardFold(sec);
      } else {
        div.className = 'pc-line pc-sec-' + sec + (cardFolds[sec] ? '' : ' pc-folded');
        div.textContent = line;
      }
      cardTextEl.appendChild(div);
      cardTextEl.scrollTop = cardTextEl.scrollHeight;
    };
    if (paced) setTimeout(emit, i * 66);
    else emit();
  });
  if (onDone) paced ? setTimeout(onDone, lines.length * 66) : onDone();
}

function toggleCardFold(section) {
  cardFolds[section] = !cardFolds[section];
  if (!cardTextEl) return;
  cardTextEl.querySelectorAll('.pc-fold-head[data-section="' + section + '"]').forEach((h) => {
    h.textContent = (cardFolds[section] ? '[−] ' : '[+] ') + '=== ' + section + ' ===';
  });
  cardTextEl.querySelectorAll('.pc-sec-' + section).forEach((el) => {
    el.classList.toggle('pc-folded', !cardFolds[section]);
  });
}

/** The program's own output as it prints (chars stream onto the card). */
export function cardOutput(text) {
  if (typeof document === 'undefined' || !cardTextEl) return;
  cardDismissed = false;
  renderCard();
  if (!cardOutEl || !cardOutEl.isConnected) {
    cardOutEl = document.createElement('div');
    cardOutEl.className = 'pc-output';
    cardTextEl.appendChild(cardOutEl);
  }
  cardOutEl.textContent += text;
  cardTextEl.scrollTop = cardTextEl.scrollHeight;
}

function sendGadgetUpdate(gadget) {
  send({ type: 'gadgetUpdate', gadget });
}

export function write(address, value) {
  const ch = String.fromCharCode(value & 0xFF);
  if (address >= GADGET_IO.PRINTER_BASE && address < GADGET_IO.PRINTER_BASE + GADGET_IO.GADGET_RANGE) {
    model.printer.text += ch;
    cardDismissed = false; // fresh ink un-dismisses the card
    renderCard();
    sound.printerBuzz();
    fireWrite('printer');
    return 'printer';
  }
  if (address >= GADGET_IO.BOARD_BASE && address < GADGET_IO.BOARD_BASE + GADGET_IO.GADGET_RANGE) {
    model.board.text += ch;
    sendGadgetUpdate({ board: { text: model.board.text } });
    fireWrite('board');
    return 'board';
  }
  if (address >= GADGET_IO.CONTROLLER_BASE && address < GADGET_IO.CONTROLLER_BASE + GADGET_IO.GADGET_RANGE) {
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
  if (state.board) model.board = { ...model.board, ...state.board };
  if (state.controller) model.controller = { ...model.controller, ...state.controller };
  // note: printer state is private and never synced
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

/** Fresh print job: clear the local printout + card, clear the shared gadgets. */
export function resetAndSync() {
  reset();
  cardDismissed = false;
  renderCard(); // show the fresh (empty) sheet
  send({
    type: 'gadgetUpdate',
    gadget: {
      board: { text: '' },
      controller: {},
    },
  });
}
