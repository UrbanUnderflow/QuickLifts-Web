const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '../../..');
const compiled = ts.transpileModule(fs.readFileSync(path.join(root, 'netlify/functions/firebase-next-api.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
function loadBridge() {
  const exports = {}, imports = [];
  vm.runInNewContext(compiled, { exports, Buffer, URL, URLSearchParams, console, require(modulePath) {
    imports.push(modulePath);
    return { default: async (req, res) => {
      res.setHeader('Set-Cookie', 'synthetic-cookie=value; HttpOnly');
      return res.status(200).json({ modulePath, body: req.body, slug: req.query.slug, authorization: req.headers.authorization, isBuffer: Buffer.isBuffer(req.body) });
    } };
  } });
  return { ...exports, imports };
}
const routes = [
  ['/api/admin/partner-api-keys', '/api/admin/partner-api-keys', '../../src/pages/api/admin/partner-api-keys/index.ts'],
  ['/api/developer/access-requests', '/api/developer/access-requests', '../../src/pages/api/developer/access-requests.ts'],
  ['/api/developer/docs/clinical-bridge/unlock', '/api/developer/docs/[slug]/unlock', '../../src/pages/api/developer/docs/[slug]/unlock.ts'],
];
const event = (route, body, encoded = false) => ({ httpMethod: 'POST', path: '/.netlify/functions/firebase-next-api', headers: { 'content-type': 'application/json', authorization: 'Bearer synthetic-token' }, queryStringParameters: { originalPath: route }, body: encoded ? Buffer.from(body).toString('base64') : body, isBase64Encoded: encoded });
for (const [route, pattern, modulePath] of routes) {
  test(`partner bridge routes and decodes JSON: ${route}`, async () => {
    const bridge = loadBridge();
    assert.equal(bridge.__test.resolveRoutePattern(route), pattern);
    for (const encoded of [false, true]) {
      const result = await bridge.handler(event(route, '{"synthetic":"fixture"}', encoded));
      assert.equal(result.statusCode, 200);
      const payload = JSON.parse(result.body);
      assert.equal(payload.modulePath, modulePath);
      assert.deepEqual(payload.body, { synthetic: 'fixture' });
      assert.equal(payload.authorization, 'Bearer synthetic-token');
      if (route.includes('/docs/')) assert.equal(payload.slug, 'clinical-bridge');
      assert.equal(result.headers['Set-Cookie'], 'synthetic-cookie=value; HttpOnly');
    }
  });
  test(`partner bridge bounds raw decoded bytes before handler loading: ${route}`, async () => {
    const bridge = loadBridge();
    for (const encoded of [false, true]) assert.equal((await bridge.handler(event(route, JSON.stringify({ body: 'é'.repeat(4096) }), encoded))).statusCode, 413);
    assert.equal((await bridge.handler(event(route, '{broken', true))).statusCode, 400);
    assert.equal(bridge.imports.length, 0);
  });
}
test('existing bridge routes retain binary-body behavior and previous size handling', async () => {
  const bridge = loadBridge();
  const result = await bridge.handler(event('/api/admin/group-meet', JSON.stringify({ body: 'x'.repeat(9000) }), true));
  assert.equal(result.statusCode, 200);
  assert.equal(JSON.parse(result.body).isBuffer, true);
});
test('Netlify redirects preserve each new public API path through the bridge', () => {
  const toml = fs.readFileSync(path.join(root, 'netlify.toml'), 'utf8');
  for (const route of ['/api/admin/partner-api-keys', '/api/developer/access-requests', '/api/developer/docs/:slug/unlock']) {
    assert.ok(toml.includes(`from = "${route}"\n  to = "/.netlify/functions/firebase-next-api?originalPath=${route}"\n  status = 200\n  force = true`));
  }
});
