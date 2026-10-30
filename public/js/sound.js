// The machine room soundscape — synthesized with Web Audio, no asset files.
// Key clacks, teletype clatter, the printer's buzz, a mainframe hum, and the
// explosion boom. Everything degrades to silence in node (no AudioContext).
let ctx = null;
let muted = false;
let humOsc = null;
let humGain = null;

function ac() {
  if (muted) return null;
  if (ctx) return ctx;
  const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!AC) return null;
  try { ctx = new AC(); } catch { ctx = null; }
  return ctx;
}

export function resumeAudio() {
  const c = ac();
  if (c && c.state === 'suspended') c.resume();
}

export function setMuted(m) {
  muted = !!m;
  if (muted) humOff();
}

export function isMuted() { return muted; }

function noiseBurst(duration, freq, gain) {
  const c = ac();
  if (!c) return;
  const len = Math.max(1, Math.floor(c.sampleRate * duration));
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  const filt = c.createBiquadFilter();
  filt.type = 'bandpass';
  filt.frequency.value = freq;
  const g = c.createGain();
  g.gain.value = gain;
  src.connect(filt); filt.connect(g); g.connect(c.destination);
  src.start();
}

/** One key clack. */
export function clack() {
  noiseBurst(0.03, 2600, 0.08);
}

/** One teletype line-print tick. */
export function teletypeTick() {
  noiseBurst(0.025, 1400, 0.06);
}

/** The printer's dot-matrix buzz: a short square-wave rasp. */
export function printerBuzz() {
  const c = ac();
  if (!c) return;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = 'square';
  osc.frequency.value = 120;
  g.gain.value = 0.03;
  osc.connect(g); g.connect(c.destination);
  osc.start();
  osc.stop(c.currentTime + 0.09);
}

/** The mainframe hum: a low drone while jobs are on the machine. */
export function humOn() {
  const c = ac();
  if (!c || humOsc) return;
  humOsc = c.createOscillator();
  humGain = c.createGain();
  humOsc.type = 'sine';
  humOsc.frequency.value = 58;
  humGain.gain.value = 0.025;
  humOsc.connect(humGain); humGain.connect(c.destination);
  humOsc.start();
}

export function humOff() {
  if (humOsc) {
    try { humOsc.stop(); } catch {}
    humOsc = null;
    humGain = null;
  }
}

/** The explosion: a noise burst with a low boom that falls in pitch. */
export function boom() {
  const c = ac();
  if (!c) return;
  noiseBurst(0.5, 180, 0.35);
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(150, c.currentTime);
  osc.frequency.exponentialRampToValueAtTime(30, c.currentTime + 0.6);
  g.gain.setValueAtTime(0.4, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.65);
  osc.connect(g); g.connect(c.destination);
  osc.start();
  osc.stop(c.currentTime + 0.7);
}
