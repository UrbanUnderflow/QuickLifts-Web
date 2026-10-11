const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '../..');
const token = 'a'.repeat(48);
function harness() {
  const rows = {};
  const db = {
    doc(key) { return { async get() { return { exists: !!rows[key], data: () => rows[key] }; } }; },
    collection(name) { return { doc(id) { const key = `${name}/${id}`; return { key, async get() { return { exists: !!rows[key], data: () => rows[key] }; }, async set(value) { rows[key] = value; } }; } }; },
    async runTransaction(callback) { return callback({ get: ref => ref.get(), set: (ref, value) => { rows[ref.key] = value; } }); },
  };
  const admin = { firestore: () => db, auth: () => ({ async verifyIdToken(value) { if (value !== 'valid-admin') throw new Error('invalid'); return { email: 'admin@example.com' }; } }) };
  admin.firestore.FieldValue = { serverTimestamp: () => new Date() };
  const cache = {};
  function load(relative) {
    const file = path.resolve(root, relative);
    if (cache[file]) return cache[file].exports;
    const module = { exports: {} }; cache[file] = module;
    const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true, jsx: ts.JsxEmit.React } }).outputText;
    const localRequire = name => {
      if (name.endsWith('/firebase-admin')) return { __esModule: true, default: admin };
      if (name.startsWith('.')) { const next = path.resolve(path.dirname(file), name); return load(fs.existsSync(next) ? next : `${next}.ts`); }
      return require(name);
    };
    new Function('require', 'module', 'exports', '__dirname', code)(localRequire, module, module.exports, path.dirname(file));
    return module.exports;
  }
  function response() { return { code: 200, headers: {}, body: undefined, setHeader(key, value) { this.headers[key] = value; }, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; }, end(body) { this.body = body; }, set statusCode(code) { this.code = code; } }; }
  return { rows, db, load, response };
}
function protectedShare(h, extra = {}) {
  const access = h.load('src/lib/systemOverviewShareAccess.ts');
  const hashed = access.createPasscodeHash('StrongPassword');
  h.rows[`systemOverviewShareLinks/${token}`] = { sectionId: 'auntedna-snapshot-integration', passcodeProtected: true, passcodeHash: hashed.hash, passcodeSalt: hashed.salt, expiresAt: new Date(Date.now() + 60000).toISOString(), snapshotArtifacts: [{ name: 'README.md', content: 'PRIVATE CANONICAL DOC' }], ...extra };
  return access;
}

test('no-account unlock rejects wrong passcode, then same signed cookie unlocks only allowed document bytes', async () => {
  const h = harness(), access = protectedShare(h);
  const unlock = h.load('src/pages/api/shared/system-overview/[token]/unlock.ts').default;
  let res = h.response();
  await unlock({ method: 'POST', query: { token }, body: { passcode: 'wrong' }, headers: {}, socket: { remoteAddress: 'test-ip' } }, res);
  assert.equal(res.code, 401); assert.equal(res.headers['Set-Cookie'], undefined);
  res = h.response();
  await unlock({ method: 'POST', query: { token }, body: { passcode: 'StrongPassword' }, headers: {}, socket: { remoteAddress: 'test-ip' } }, res);
  assert.equal(res.code, 200); assert.match(res.headers['Set-Cookie'], /HttpOnly/);
  const cookie = decodeURIComponent(res.headers['Set-Cookie'].split(';')[0].split('=')[1]);
  const route = h.load('src/pages/shared/system-overview/[token]/artifacts/[...filename].tsx').getServerSideProps;
  const ctx = cookies => ({ params: { token, filename: ['README.md'] }, req: { cookies }, res: h.response() });
  let request = ctx({}); await route(request); assert.equal(request.res.code, 401); assert.ok(!request.res.body.includes('PRIVATE'));
  request = ctx({ [access.getSystemOverviewShareCookieName(token)]: cookie }); await route(request);
  assert.equal(request.res.code, 200); assert.equal(request.res.body, 'PRIVATE CANONICAL DOC'); assert.equal(request.res.headers['Cache-Control'], 'private, no-store');
  const badFile = { ...request, params: { token, filename: ['..', 'secrets.env'] }, res: h.response() };
  assert.equal((await route(badFile)).notFound, true);
});

test('expired, revoked, wrong-section and tampered cookie shares never return artifact', () => {
  const h = harness(), access = protectedShare(h), helper = h.load('src/lib/systemOverviewSnapshotArtifacts.ts');
  const share = h.rows[`systemOverviewShareLinks/${token}`], cookie = access.createSystemOverviewShareAccessCookieValue(token);
  for (const changed of [{ ...share, revokedAt: new Date() }, { ...share, expiresAt: new Date(0).toISOString() }, { ...share, sectionId: 'other' }]) assert.equal(helper.authorizeSnapshotArtifact(changed, token, 'README.md', cookie).status, 404);
  assert.equal(helper.authorizeSnapshotArtifact(share, token, 'README.md', `${cookie}tampered`).status, 401);
  assert.equal(access.verifySystemOverviewShareAccessCookieValue(token, '1.bad'), false);
});

test('persistent unlock limit rejects the eleventh attempt without a cookie', async () => {
  const h = harness(); protectedShare(h);
  const unlock = h.load('src/pages/api/shared/system-overview/[token]/unlock.ts').default;
  let res;
  for (let attempt = 0; attempt < 11; attempt += 1) { res = h.response(); await unlock({ method: 'POST', query: { token }, body: { passcode: 'wrong' }, headers: {}, socket: { remoteAddress: 'test-ip' } }, res); }
  assert.equal(res.code, 429); assert.equal(res.headers['Set-Cookie'], undefined); assert.equal(res.headers['Retry-After'], '900');
});

test('admin artifact API requires verified token plus admin record and rejects traversal', async () => {
  const h = harness(), handler = h.load('src/pages/api/admin/system-overview/snapshot-artifacts.ts').default;
  let res = h.response(); await handler({ method: 'GET', query: {}, headers: {} }, res); assert.equal(res.code, 401);
  res = h.response(); await handler({ method: 'GET', query: {}, headers: { authorization: 'Bearer valid-admin' } }, res); assert.equal(res.code, 401);
  h.rows['admin/admin@example.com'] = {};
  res = h.response(); await handler({ method: 'GET', query: {}, headers: { authorization: 'Bearer valid-admin' } }, res); assert.equal(res.code, 200); assert.equal(res.body.artifacts.length, 6);
  res = h.response(); await handler({ method: 'GET', query: { file: '../../.env' }, headers: { authorization: 'Bearer valid-admin' } }, res); assert.equal(res.code, 404);
});

test('snapshot sharing requires a password, captures canonical protected downloads, and expires', async () => {
  const h = harness(); h.rows['admin/admin@example.com'] = {};
  const handler = h.load('src/pages/api/admin/system-overview/share-links/index.ts').default;
  const req = { method: 'POST', headers: { authorization: 'Bearer valid-admin', host: 'localhost' }, body: { sectionId: 'auntedna-snapshot-integration', systemId: 'pulsecheck', sectionLabel: 'Docs', snapshotText: 'CLIENT_TEXT', snapshotHtml: 'CLIENT_HTML' } };
  let res = h.response(); await handler(req, res); assert.equal(res.code, 400);
  res = h.response(); await handler({ ...req, body: { ...req.body, passcode: 'StrongPassword' } }, res); assert.equal(res.code, 200);
  const share = h.rows[`systemOverviewShareLinks/${res.body.link.token}`];
  assert.equal(share.snapshotArtifacts.length, 6); assert.ok(!share.snapshotHtml.includes('CLIENT_HTML')); assert.ok(!share.snapshotText.includes('CLIENT_TEXT')); assert.ok(share.expiresAt); assert.match(share.snapshotHtml, /\/artifacts\/snapshot.schema.json/);
});

test('production cookies cannot use the known development fallback', () => {
  const previous = { node: process.env.NODE_ENV, cookie: process.env.SYSTEM_OVERVIEW_SHARE_COOKIE_SECRET, auth: process.env.NEXTAUTH_SECRET };
  try {
    process.env.NODE_ENV = 'production'; delete process.env.SYSTEM_OVERVIEW_SHARE_COOKIE_SECRET; delete process.env.NEXTAUTH_SECRET;
    const access = harness().load('src/lib/systemOverviewShareAccess.ts');
    assert.throws(() => access.createSystemOverviewShareAccessCookieValue(token), /not configured/);
  } finally {
    for (const [key, value] of [['NODE_ENV', previous.node], ['SYSTEM_OVERVIEW_SHARE_COOKIE_SECRET', previous.cookie], ['NEXTAUTH_SECRET', previous.auth]]) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  }
});
