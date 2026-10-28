const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const { WebSocketServer } = require('ws');

const publicDir = path.join(__dirname, '..', 'public');
const realPublic = path.resolve(publicDir);

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

function createServer(opts = {}) {
  const port = opts.port || 3000;
  const server = http.createServer((req, res) => {
    const reqUrl = url.parse(req.url);
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
      console.log('ws message:', msg.toString());
    });
  });

  server.listen(port, () => {
    console.log(`mips-office-game server listening on :${port}`);
  });

  return server;
}

// Only start listening when this file is run directly (e.g. `npm start`),
// so tests can require it without opening a port.
if (process.argv[1] === path.resolve(__filename)) {
  createServer();
}

module.exports = { createServer };
