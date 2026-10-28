const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const { WebSocketServer } = require('ws');
const { Room } = require('./room');
const { v4: uuidv4 } = require('uuid');

const publicDir = path.join(__dirname, '..', 'public');
const realPublic = path.resolve(publicDir);

const rooms = new Map(); // roomId -> Room
const wsRooms = new Map(); // ws -> { roomId, seatIndex }

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
  const port = opts.port || 3000;
  const server = http.createServer(async (req, res) => {
    const reqUrl = url.parse(req.url);

    // Admin endpoint: create a room
    if (req.method === 'POST' && reqUrl.pathname === '/rooms') {
      try {
        const body = await readBody(req);
        const { seatCount } = JSON.parse(body.toString() || '{}');
        const count = Number.isInteger(seatCount) && seatCount > 0 ? seatCount : 4;
        const roomId = uuidv4();
        rooms.set(roomId, new Room(count));
        json(res, 200, { roomId, seatCount: count });
      } catch (e) {
        json(res, 400, { error: 'bad request' });
      }
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
      if (parsed.type === 'joinRoom') {
        const { roomId, seatIndex, name, profilePictureUrl } = parsed;
        const room = rooms.get(roomId);
        if (!room) {
          ws.send(JSON.stringify({ type: 'error', error: 'unknownRoom' }));
          return;
        }
        const player = { id: uuidv4(), name, profilePictureUrl };
        const res = room.join(seatIndex, player);
        if (res.error) {
          ws.send(JSON.stringify({ type: 'error', error: res.error }));
          return;
        }
        wsRooms.set(ws, { roomId, seatIndex: res.player.seatIndex, playerId: res.player.id });
        ws.send(JSON.stringify({ type: 'joined', player: res.player, state: room.getState() }));
      }
    });
    ws.on('close', () => {
      const info = wsRooms.get(ws);
      if (info) {
        const room = rooms.get(info.roomId);
        if (room) room.leave(info.playerId);
        wsRooms.delete(ws);
      }
    });
  });

  server.listen(port, () => {
    console.log(`mips-office-game server listening on :${port}`);
  });

  return server;
}

if (process.argv[1] === path.resolve(__filename)) {
  createServer();
}

module.exports = { createServer };
