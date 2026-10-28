// WebSocket client. One connection per page; typed events fan out to listeners.
let ws = null;

const listeners = {}; // type -> [fn]

function emit(type, msg) {
  (listeners[type] || []).forEach((fn) => {
    try { fn(msg); } catch (e) { console.error('net listener error:', e); }
  });
}

function wire(socket) {
  socket.onmessage = (e) => {
    let msg;
    try { msg = JSON.parse(e.data); } catch { return; }
    if (msg && msg.type) emit(msg.type, msg);
  };
  return socket;
}

export function connect(url) {
  const target = url || `ws://${location.host}`;
  ws = wire(new WebSocket(target));
  ws.onopen = () => emit('_open', {});
  ws.onclose = () => emit('_close', {});
  ws.onerror = () => emit('_error', {});
  return ws;
}

export function send(message) {
  if (ws && ws.readyState === 1) ws.send(JSON.stringify(message));
}

export function on(type, fn) {
  (listeners[type] = listeners[type] || []).push(fn);
}

export function isConnected() {
  return Boolean(ws) && ws.readyState === 1;
}

/** Test seam: inject a socket-like object (or null to detach). */
export function setSocket(socket) {
  ws = socket ? wire(socket) : null;
}
