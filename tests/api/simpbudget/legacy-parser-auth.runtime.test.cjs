const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
function load(path, mocks) {
  const exports = {};
  new Function('require', 'exports', ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText)(name => {
    if (!(name in mocks)) throw Error(`Unexpected dependency ${name}`);
    return mocks[name];
  }, exports);
  return exports;
}
test('legacy Netlify parser rejects missing/revoked tokens and non-admins before provider calls', async () => {
  let verified = 0, isAdmin = false, revoked = false;
  const app = load('netlify/functions/founder-budget-parse-expenses.ts', {
    openai: class { constructor() { throw Error('Provider must not be called'); } },
    './utils/resolveOpenAIApiKey': { resolveOpenAIApiKey: () => null },
    './config/firebase': { getFirebaseAdminApp: () => ({}), admin: {
      auth: () => ({ verifyIdToken: async (_, checkRevoked) => { verified++; assert.equal(checkRevoked, true); if (revoked) throw Error('revoked'); return { email: 'synthetic@example.test' }; } }),
      firestore: () => ({ collection: () => ({ doc: () => ({ get: async () => ({ exists: isAdmin }) }) }) }),
    } },
  });
  const invoke = headers => app.handler({ httpMethod: 'POST', headers, body: '{}' });
  assert.equal((await invoke({})).statusCode, 401); assert.equal(verified, 0);
  assert.equal((await invoke({ authorization: 'Bearer test' })).statusCode, 403);
  revoked = true; assert.equal((await invoke({ authorization: 'Bearer test' })).statusCode, 401);
  revoked = false; isAdmin = true; assert.equal((await invoke({ authorization: 'Bearer test' })).statusCode, 400);
});
test('legacy Next parser gates processing on admin authorization', async () => {
  let allowed = false;
  const app = load('src/pages/api/admin/founder-budget/parse-expenses.ts', {
    openai: class { constructor() { throw Error('Provider must not be called'); } },
    '../_auth': { requireAdminRequest: async () => allowed },
  });
  const res = { setHeader() {}, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
  await app.default({ method: 'POST', headers: {}, body: {} }, res); assert.equal(res.code, 401);
  allowed = true;
  await app.default({ method: 'POST', headers: {}, body: {} }, res); assert.equal(res.code, 400);
});
