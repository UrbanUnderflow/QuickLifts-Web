const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const source = fs.readFileSync('src/pages/api/pipelists/stage-migration.ts', 'utf8');
function harness({ user = { uid: 'owner', email: 'tremaine.grant@gmail.com' }, permitted = true } = {}) {
  const calls = { imports: 0, auth: 0, store: 0, migration: [] };
  const module = { exports: {} };
  class MigrationError extends Error { constructor(status, message) { super(message); this.status = status; } }
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, { module, exports: module.exports, require: name => {
    if (name.endsWith('pipelistsRuntime')) return { guardPipeListsApiRequest: (_req, res) => { if (!permitted) res.status(503).json({ success: false }); return permitted; } };
    if (name.endsWith('pipelistsUniversityMigration')) return { UniversityMigrationError: MigrationError, universityStageMigration: async (db, uid, input) => { calls.migration.push({ db, uid, input }); return { changed: true, applied: false }; } };
    if (name.endsWith('getSimpBudgetServiceAccount')) { calls.imports++; return { getSimpBudgetAuth: async () => ({ verifyIdToken: async () => { calls.auth++; return user; } }), getSimpBudgetFirestore: async () => { calls.store++; return 'synthetic-database'; } }; }
    throw Error(`Unexpected dependency: ${name}`);
  } });
  return { calls, async request({ method = 'POST', token = 'synthetic-token', body = { action: 'preview', listId: 'synthetic-list' } } = {}) {
    const result = {}; const res = { setHeader() {}, status(status) { result.status = status; return res; }, json(value) { result.body = value; return res; } };
    await module.exports.default({ method, headers: token ? { authorization: `Bearer ${token}` } : {}, body }, res); return result;
  } };
}
test('nonproduction and unsupported migration requests do not import identity or stores', async () => {
  const blocked = harness({ permitted: false }); assert.equal((await blocked.request()).status, 503); assert.equal(blocked.calls.imports, 0);
  const method = harness(); assert.equal((await method.request({ method: 'GET' })).status, 405); assert.equal(method.calls.imports, 0);
});
test('missing, invalid, business editor and outsider identities cannot read or migrate stored lists', async () => {
  const missing = harness(); assert.equal((await missing.request({ token: '' })).status, 401); assert.equal(missing.calls.imports, 0);
  for (const user of [null, { uid: 'editor', email: 'editor@example.test' }, { uid: 'outsider', email: 'outsider@example.test' }]) {
    const h = harness({ user }); assert.equal((await h.request()).status, user ? 403 : 401); assert.equal(h.calls.store, 0); assert.equal(h.calls.migration.length, 0);
  }
});
test('existing owner preview forwards only verified uid and explicit request to the versioned transaction', async () => {
  const h = harness(); assert.equal((await h.request({ body: { action: 'preview', listId: 'synthetic-list', ownerUid: 'forged' } })).status, 200);
  assert.equal(h.calls.migration[0].uid, 'owner'); assert.equal(h.calls.migration[0].input.action, 'preview');
});
