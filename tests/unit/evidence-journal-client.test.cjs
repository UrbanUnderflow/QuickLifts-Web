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
test('journal sharing sends a saved entry revision and explicit disclosure without raw writing', async () => {
  const auth = {currentUser: {uid: 'athlete-a', getIdToken: async () => 'token-a'}};
  let sent;
  const api = client(auth, async (url, init) => {sent = {url, init}; return {ok: true, json: async () => ({sharing: {status: 'shared'}})};});
  await api.updateJournalSharing('athlete-a', {action: 'share', entryId: 'entry-id', entryRevision: 'saved-revision', teamId: 'am-team', disclosureVersion: 'athleticmind-journal-sharing-v1', accepted: true});
  assert.equal(sent.url, '/api/evidence-journal/sharing');
  const payload = JSON.parse(sent.init.body);
  assert.equal(payload.entryRevision, 'saved-revision'); assert.equal(payload.accepted, true); assert.equal(payload.moment, undefined);
});
test('entry editing preserves the captured revision and source fields for conflict checks', async () => {
  const auth = {currentUser: {uid: 'athlete-a', getIdToken: async () => 'token-a'}};
  let sent;
  const api = client(auth, async (url, init) => {sent = {url, init}; return {ok: true, json: async () => ({entry: {id: 'entry-id'}})};});
  await api.editEvidence('athlete-a', {id: 'entry-id', type: 'workout', moment: 'old', effortRating: 6}, 'revision-at-edit-open', 'updated', 'action');
  assert.equal(sent.init.method, 'PATCH'); const payload = JSON.parse(sent.init.body);
  assert.equal(payload.entryRevision, 'revision-at-edit-open'); assert.equal(payload.effortRating, 6); assert.equal(payload.type, 'workout');
});
test('journal sharing is not submitted for an account that changed during token retrieval', async () => {
  const auth = {currentUser: {uid: 'athlete-a', getIdToken: async () => {auth.currentUser = {uid: 'athlete-b'}; return 'token-a';}}};
  let calls = 0; const api = client(auth, async () => {calls++;});
  await assert.rejects(api.updateJournalSharing('athlete-a', {action: 'analyze', entryId: 'entry-id'}), /account changed/);
  assert.equal(calls, 0);
});
