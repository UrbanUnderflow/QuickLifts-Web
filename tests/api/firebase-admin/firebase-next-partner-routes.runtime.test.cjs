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

function loadDocsModule(relative, cache = {}) {
  const filename = path.resolve(root, relative);
  if (cache[filename]) return cache[filename].exports;
  const module = { exports: {} };
  cache[filename] = module;
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const req = name => {
    if (name.endsWith('/partner-runtime-config')) return { ensurePartnerRuntimeConfig: async () => {} };
    if (name.startsWith('.')) return loadDocsModule(path.resolve(path.dirname(filename), `${name}.ts`), cache);
    return require(name);
  };
  new Function('require', 'module', 'exports', code)(req, module, module.exports);
  return module.exports;
}
const formEvent = (route, body, encoded = false) => ({ ...event(route, body, encoded), headers: { 'content-type': 'application/x-www-form-urlencoded; charset=UTF-8' } });

test('actual docs unlock through bridge accepts native raw/base64 forms and preserves redirects and cookies', async () => {
  const keys = ['DEVELOPER_DOCS_PASSWORD_HASH', 'DEVELOPER_DOCS_PASSWORD_SALT', 'DEVELOPER_DOCS_COOKIE_SECRET'];
  const prior = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  const password = 'Synthetic + & é Password';
  const access = loadDocsModule('src/lib/systemOverviewShareAccess.ts');
  const hashed = access.createPasscodeHash(password);
  Object.assign(process.env, { DEVELOPER_DOCS_PASSWORD_HASH: hashed.hash, DEVELOPER_DOCS_PASSWORD_SALT: hashed.salt, DEVELOPER_DOCS_COOKIE_SECRET: 'synthetic-docs-bridge-cookie-secret-only' });
  const rows = new Map();
  const db = { collection: () => ({ doc: key => ({ key }) }), runTransaction: fn => fn({ get: async ref => ({ data: () => rows.get(ref.key) }), set: (ref, value) => rows.set(ref.key, value) }) };
  try {
    const unlock = loadDocsModule('src/pages/api/developer/docs/[slug]/unlock.ts').createDeveloperDocsUnlockHandler({ db });
    const helper = loadDocsModule('src/lib/developerDocsServer.ts');
    const bridge = loadBridge().createFirebaseNextApiHandler([{ pattern: '/api/developer/docs/[slug]/unlock', loadHandler: async () => ({ default: unlock }) }]);
    for (const slug of ['auntedna', 'athleticmind-snapshots', 'clinical-bridge']) {
      const route = `/api/developer/docs/${slug}/unlock`;
      for (const encoded of [false, true]) {
        const success = await bridge(formEvent(route, new URLSearchParams({ password, next: 'https://untrusted.invalid' }).toString(), encoded));
        assert.equal(success.statusCode, 303);
        assert.equal(success.headers.Location, `/developer/api/${slug}`);
        assert.equal(success.body, '');
        assert.match(success.headers['Set-Cookie'], /HttpOnly/);
        const cookie = success.headers['Set-Cookie'].split(';')[0].split('=')[1];
        assert.equal(helper.developerDocsAuthorized(slug, cookie), true);
        for (const [value, code] of [['wrong', 'incorrect'], ['', 'missing']]) {
          const rejected = await bridge(formEvent(route, new URLSearchParams({ password: value }).toString(), encoded));
          assert.equal(rejected.statusCode, 303);
          assert.equal(rejected.headers.Location, `/developer/api/${slug}?accessError=${code}`);
          assert.equal(rejected.headers['Set-Cookie'], undefined);
        }
      }
    }
  } finally {
    for (const key of keys) if (prior[key] === undefined) delete process.env[key]; else process.env[key] = prior[key];
  }
});

test('native docs form decoding preserves 8192-byte limit before handler loading', async () => {
  for (const encoded of [false, true]) {
    const bridge = loadBridge();
    const route = '/api/developer/docs/auntedna/unlock';
    const atLimit = 'password=' + 'x'.repeat(8192 - 9);
    assert.equal((await bridge.handler(formEvent(route, atLimit, encoded))).statusCode, 200);
    const imports = bridge.imports.length;
    assert.equal((await bridge.handler(formEvent(route, atLimit + 'x', encoded))).statusCode, 413);
    assert.equal(bridge.imports.length, imports);
  }
});

test('native form decoding is restricted to docs unlock routes', async () => {
  for (const route of ['/api/developer/partner/auntedna/login', '/api/admin/partner-api-keys', '/api/developer/access-requests', '/api/evidence-journal', '/api/admin/group-meet']) {
    for (const encoded of [false, true]) {
      const bridge = loadBridge();
      const response = await bridge.handler(formEvent(route, 'password=synthetic%2Bvalue', encoded));
      assert.equal(response.statusCode, 200);
      const payload = JSON.parse(response.body);
      if (route === '/api/admin/group-meet' && encoded) assert.equal(payload.isBuffer, true);
      else assert.equal(payload.body, 'password=synthetic%2Bvalue');
    }
  }
});
