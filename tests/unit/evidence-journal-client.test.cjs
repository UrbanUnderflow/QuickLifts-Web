const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function client(auth, fetch) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync('src/api/firebase/evidenceJournalClient.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  vm.runInNewContext(code, { exports, require: () => ({ auth, getFirebaseModeRequestHeaders: () => ({ 'X-Firebase-Mode': 'test' }) }), fetch, crypto: { randomUUID: () => 'event-uuid' } });
  return exports;
}
test('does not send private writing if account changes while token resolves', async () => {
  const auth = { currentUser: { uid: 'athlete-a', getIdToken: async () => { auth.currentUser = { uid: 'athlete-b' }; return 'token-a'; } } };
  let requests = 0;
  const api = client(auth, async () => { requests++; });
  await assert.rejects(api.saveEvidence('athlete-a', { entryId: 'id', moment: 'private' }), /account changed/);
  assert.equal(requests, 0);
});
test('rejects a prior account response after switching accounts', async () => {
  const auth = { currentUser: { uid: 'athlete-a', getIdToken: async () => 'token-a' } };
  const api = client(auth, async () => { auth.currentUser = { uid: 'athlete-b' }; return { ok: true, json: async () => ({ entries: [{ moment: 'private' }] }) }; });
  await assert.rejects(api.evidenceRequest('athlete-a'), /account changed/);
});
test('revisit event sends only content-free identifiers and event type', async () => {
  const auth = { currentUser: { uid: 'athlete-a', getIdToken: async () => 'token-a' } };
  let request;
  const api = client(auth, async (url, init) => { request = { url, init }; return { ok: true, json: async () => ({ recorded: true }) }; });
  await api.recordEvidenceEvent('athlete-a', 'entry-id', 'revisited');
  assert.equal(request.url, '/api/evidence-journal/event');
  assert.deepEqual(JSON.parse(request.init.body), { entryId: 'entry-id', eventId: 'event-uuid', event: 'revisited' });
  assert.equal(request.init.headers.Authorization, 'Bearer token-a');
  assert.equal(request.init.headers['X-Firebase-Mode'], 'test');
});
test('an uncertain event retry preserves the exact supplied event id and payload', async () => {
  const auth = { currentUser: { uid: 'athlete-a', getIdToken: async () => 'token-a' } };
  const requests = [];
  const api = client(auth, async (_url, init) => {
    requests.push(init.body);
    if (requests.length === 1) throw new Error('connection interrupted after server write');
    return { ok: true, json: async () => ({ recorded: true }) };
  });
  await assert.rejects(api.recordEvidenceEvent('athlete-a', 'entry-id', 'used', 'stable-use-id'), /connection interrupted/);
  await api.recordEvidenceEvent('athlete-a', 'entry-id', 'used', 'stable-use-id');
  assert.equal(requests[0], requests[1]);
  assert.equal(JSON.parse(requests[1]).eventId, 'stable-use-id');
});
