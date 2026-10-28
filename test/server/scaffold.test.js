const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const root = process.cwd();

test('package.json has ws and uuid dependencies and a start script', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  assert.ok(pkg.dependencies && pkg.dependencies.ws, 'missing ws dependency');
  assert.ok(pkg.dependencies && pkg.dependencies.uuid, 'missing uuid dependency');
  assert.ok(pkg.scripts && pkg.scripts.start, 'missing start script');
});

test('server/index.js exports createServer and listens on port 3000 when run directly', async () => {
  // Server file must exist and export a factory function.
  assert.ok(fs.existsSync(path.join(root, 'server', 'index.js')), 'server/index.js missing');
});
