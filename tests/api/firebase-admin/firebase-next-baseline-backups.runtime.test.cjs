const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '../../..');
const route = '/api/admin/pulsecheck/baseline-backups';
const compiled = ts.transpileModule(fs.readFileSync(path.join(root, 'netlify/functions/firebase-next-api.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
function bridge(fail = false) {
  const exports = {}, imports = [];
  vm.runInNewContext(compiled, { exports, Buffer, URL, URLSearchParams, console, require(modulePath) {
    imports.push(modulePath);
    if (fail) throw Error('PRIVATE_BACKUP_PROVIDER_BODY');
    return { default: async (req, res) => res.status(200).json({
      modulePath, method: req.method, body: req.body, cursor: req.query.cursor,
      authorization: req.headers.authorization, mode: req.headers['x-pulsecheck-firebase-mode'],
    }) };
  } });
  return { ...exports, imports };
}
function event(method, body, encoded = false) {
  return { httpMethod: method, path: '/.netlify/functions/firebase-next-api',
    headers: { 'content-type': 'application/json', authorization: 'Bearer synthetic-admin', 'x-pulsecheck-firebase-mode': 'dev' },
    queryStringParameters: { originalPath: route, cursor: 'synthetic-cursor' },
    body: body === undefined ? null : encoded ? Buffer.from(body).toString('base64') : body,
    isBase64Encoded: encoded };
}
test('backup administration reaches its protected handler with identity, query and decoded action intact', async () => {
  const api = bridge();
  assert.equal(api.__test.resolveRoutePattern(route), route);
  for (const encoded of [false, true]) {
    const response = await api.handler(event('POST', JSON.stringify({ action: 'retry', backupId: 'synthetic-backup' }), encoded));
    assert.equal(response.statusCode, 200);
    const data = JSON.parse(response.body);
    assert.equal(data.modulePath, '../../src/pages/api/admin/pulsecheck/baseline-backups.ts');
    assert.deepEqual(data.body, { action: 'retry', backupId: 'synthetic-backup' });
    assert.equal(data.authorization, 'Bearer synthetic-admin');
    assert.equal(data.mode, 'dev');
    assert.equal(data.cursor, 'synthetic-cursor');
  }
  const response = await api.handler(event('GET'));
  assert.equal(response.statusCode, 200);
  assert.equal(JSON.parse(response.body).method, 'GET');
});
test('backup bridge rejects oversized decoded UTF-8 and malformed JSON before loading the handler', async () => {
  const api = bridge();
  for (const encoded of [false, true]) {
    assert.equal((await api.handler(event('POST', JSON.stringify({ value: 'é'.repeat(1024) }), encoded))).statusCode, 413);
    assert.equal((await api.handler(event('POST', '{broken', encoded))).statusCode, 400);
  }
  assert.equal(api.imports.length, 0);
});
test('backup bridge hides arbitrary exception details and prevents error caching', async () => {
  const response = await bridge(true).handler(event('GET'));
  assert.equal(response.statusCode, 503);
  assert.match(response.headers['Cache-Control'], /no-store/);
  assert.deepEqual(JSON.parse(response.body), { error: 'backup_route_unavailable' });
  assert.equal(response.body.includes('PRIVATE_BACKUP_PROVIDER_BODY'), false);
});
test('hosted backup API redirect preserves the exact path', () => {
  const toml = fs.readFileSync(path.join(root, 'netlify.toml'), 'utf8');
  assert.ok(toml.includes(`from = "${route}"\n  to = "/.netlify/functions/firebase-next-api?originalPath=${route}"\n  status = 200\n  force = true`));
});
