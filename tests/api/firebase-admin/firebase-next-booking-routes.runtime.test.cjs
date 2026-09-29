const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '../../..');
const source = fs.readFileSync(path.join(root, 'netlify/functions/firebase-next-api.ts'), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
function loadBridge() {
  const exports = {};
  const imports = [];
  vm.runInNewContext(compiled, { exports, Buffer, URL, URLSearchParams, console,
    require(modulePath) {
      imports.push(modulePath);
      return { default: async (req, res) => {
        res.setHeader('Cache-Control', 'no-store');
        return res.status(200).json({ modulePath, method: req.method, query: req.query, body: req.body });
      } };
    },
  });
  return { ...exports, imports };
}
const cases = [
  ['/api/admin/group-meet/booking', '/api/admin/group-meet/booking', '../../src/pages/api/admin/group-meet/booking.ts', 'PUT', {}],
  ['/api/group-meet/book/tremaine', '/api/group-meet/book/[slug]', '../../src/pages/api/group-meet/book/[slug].ts', 'POST', { slug: 'tremaine' }],
  ['/api/group-meet/booking/private-token', '/api/group-meet/booking/[token]', '../../src/pages/api/group-meet/booking/[token].ts', 'GET', { token: 'private-token' }],
];
for (const [url, pattern, modulePath, method, params] of cases) {
  test(`deployed bridge routes ${url} to the booking handler`, async () => {
    const bridge = loadBridge();
    assert.equal(bridge.__test.resolveRoutePattern(url), pattern);
    const result = await bridge.handler({
      httpMethod: method, path: '/.netlify/functions/firebase-next-api',
      headers: { 'content-type': 'application/json', host: 'fitwithpulse.ai' },
      queryStringParameters: { originalPath: url, duration: '30' },
      multiValueQueryStringParameters: {}, body: method === 'GET' ? null : JSON.stringify({ enabled: true }),
      isBase64Encoded: false,
    });
    assert.equal(result.statusCode, 200);
    const payload = JSON.parse(result.body);
    assert.equal(payload.modulePath, modulePath);
    assert.equal(payload.method, method);
    assert.equal(payload.query.duration, '30');
    for (const [key, value] of Object.entries(params)) assert.equal(payload.query[key], value);
    assert.deepEqual(bridge.imports, [modulePath]);
    assert.equal(result.headers['Cache-Control'], 'no-store');
  });
}

test('booking registration preserves existing group request and invite routes', () => {
  const bridge = loadBridge();
  assert.equal(bridge.__test.resolveRoutePattern('/api/admin/group-meet/request-123'), '/api/admin/group-meet/[requestId]');
  assert.equal(bridge.__test.resolveRoutePattern('/api/group-meet/guest-token'), '/api/group-meet/[token]');
});

test('Netlify wildcard redirects already cover all three booking endpoints', () => {
  const config = fs.readFileSync(path.join(root, 'netlify.toml'), 'utf8');
  for (const prefix of ['/api/admin/group-meet', '/api/group-meet']) {
    assert.ok(config.includes(`from = "${prefix}/*"`));
    assert.ok(config.includes(`to = "/.netlify/functions/firebase-next-api?originalPath=${prefix}/:splat"`));
  }
});
