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
  ['/api/developer/partner/auntedna/login', '/api/developer/partner/auntedna/[action]', '../../src/pages/api/developer/partner/auntedna/[action].ts'],
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

test('portal bridge preserves cookie arrays and suppresses arbitrary exception details', async () => {
  const bridge = loadBridge();
  const ok = bridge.createFirebaseNextApiHandler([{pattern:'/api/developer/partner/auntedna/[action]',loadHandler:async()=>({default:async(req,res)=>{res.setHeader('Set-Cookie',['portal=synthetic','docs=synthetic']);res.status(200).json({success:true});}})}]);
  const response = await ok(event('/api/developer/partner/auntedna/login','{}'));
  assert.equal(JSON.stringify(response.multiValueHeaders['Set-Cookie']), JSON.stringify(['portal=synthetic','docs=synthetic']));
  const fail = bridge.createFirebaseNextApiHandler([{pattern:'/api/developer/partner/auntedna/[action]',loadHandler:async()=>{throw new Error('PRIVATE_SECRET_ERROR');}}]);
  const error = await fail(event('/api/developer/partner/auntedna/secret','{}'));
  assert.equal(error.statusCode,503);
  assert.match(error.headers['Cache-Control'],/no-store/);
  assert.equal(error.body.includes('PRIVATE_SECRET_ERROR'),false);
});

for (const route of ['/api/evidence-journal', '/api/evidence-journal/sharing', '/api/evidence-journal/event']) {
  test(`journal bridge handles UTF-8 content, decoded limits and sanitized failures: ${route}`, async () => {
    const bridge = loadBridge();
    assert.equal(bridge.__test.resolveRoutePattern(route), route);
    const body = {moment: '🟢'.repeat(8000)};
    const valid = await bridge.handler(event(route, JSON.stringify(body), true));
    assert.equal(valid.statusCode, 200);
    assert.deepEqual(JSON.parse(valid.body).body, body);
    assert.equal((await bridge.handler(event(route, JSON.stringify({moment: 'x'.repeat(65536)}), true))).statusCode, 413);
    assert.equal((await bridge.handler(event(route, '{bad', true))).statusCode, 400);
    const fail = bridge.createFirebaseNextApiHandler([{pattern:route,loadHandler:async()=>{throw Error('PRIVATE_JOURNAL_TEXT');}}]);
    const failed = await fail(event(route, '{}'));
    assert.equal(failed.statusCode, 503);
    assert.equal(failed.body.includes('PRIVATE_JOURNAL_TEXT'), false);
    assert.match(failed.headers['Cache-Control'], /no-store/);
    const toml = fs.readFileSync(path.join(root, 'netlify.toml'), 'utf8');
    assert.ok(toml.includes(`from = "${route}"\n  to = "/.netlify/functions/firebase-next-api?originalPath=${route}"\n  status = 200\n  force = true`));
  });
}
