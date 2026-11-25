const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const { WebSocketServer } = require('ws');
const { Room } = require('./room');
const { handleMessage, drop, tickQueues } = require('./ws');
const { v4: uuidv4 } = require('uuid');

const publicDir = path.join(__dirname, '..', 'public');
const realPublic = path.resolve(publicDir);

const rooms = new Map(); // roomId -> Room

function mimeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const map = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.mjs': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
  };
  return map[ext] || 'application/octet-stream';
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function json(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) });
  res.end(body);
}

function createServer(opts = {}) {
  const port = opts.port !== undefined ? opts.port : 3000;
  const server = http.createServer(async (req, res) => {
    const reqUrl = url.parse(req.url);

    // Admin endpoint: create a room
    if (req.method === 'POST' && reqUrl.pathname === '/rooms') {
      try {
        const body = await readBody(req);
        const { seatCount, name } = JSON.parse(body.toString() || '{}');
        const raw = Number.isInteger(seatCount) && seatCount > 0 ? seatCount : 4;
        const count = Math.min(10, Math.max(1, raw));
        const operatorName = typeof name === 'string' && name.trim() ? name.trim().slice(0, 40) : 'Operator';
        const operatorToken = uuidv4();
        const roomId = uuidv4();
        rooms.set(roomId, new Room(count, { operatorName, operatorToken }));
        json(res, 200, { roomId, seatCount: count, operatorToken });
      } catch (e) {
        json(res, 400, { error: 'bad request' });
      }
      return;
    }

    // Room state for the join screen's seat grid
    if (req.method === 'GET' && reqUrl.pathname.startsWith('/rooms/')) {
      const roomId = reqUrl.pathname.slice('/rooms/'.length);
      const room = rooms.get(roomId);
      if (!room) {
        json(res, 404, { error: 'unknownRoom' });
        return;
      }
      const state = room.getState();
      json(res, 200, {
        roomId,
        seatCount: room.seatCount,
        seats: state.seats,
        players: Array.from(state.players.values()),
        gadgetState: state.gadgetState,
        cablePairs: state.cablePairs,
      });
      return;
    }

    // Static file serving
    let filePath = path.join(publicDir, reqUrl.pathname === '/' ? '/index.html' : reqUrl.pathname);
    const resolved = path.resolve(filePath);
    if (resolved !== realPublic && !resolved.startsWith(realPublic + path.sep)) {
      res.writeHead(403, { 'Content-Type': 'text/plain' });
      res.end('forbidden');
      return;
    }
    fs.readFile(resolved, (err, data) => {
      if (err) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('not found');
        return;
      }
      res.writeHead(200, { 'Content-Type': mimeFor(resolved) });
      res.end(data);
    });
  });

  const wss = new WebSocketServer({ server });
  wss.on('connection', (ws) => {
    ws.on('message', (msg) => {
      let parsed;
      try {
        parsed = JSON.parse(msg.toString());
      } catch (e) {
        return;
      }
      handleMessage(ws, rooms, parsed);
    });
    ws.on('close', () => drop(ws));
  });

  // the mainframe clock: advance every room's queue twice a second
  const clock = setInterval(() => tickQueues(rooms), 250);
  clock.unref?.();

  server.listen(port, () => {
    console.log(`mips-office-game server listening on :${port}`);
  });

  return server;
}

if (process.argv[1] === path.resolve(__filename)) {
  createServer();
}

module.exports = { createServer };
