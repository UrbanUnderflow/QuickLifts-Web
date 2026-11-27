const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const guards = require('../../../netlify/functions/lib/account-closure-guard');
const storage = require('../../../netlify/functions/utils/noraStoragePolicy');

const functions = path.resolve(__dirname, '../../../netlify/functions');
const chatSource = fs.readFileSync(path.join(functions, 'pulsecheck-chat.js'), 'utf8');
const authSource = chatSource.slice(chatSource.indexOf('function getRequestHeader('), chatSource.indexOf('// Escalation Tier enum values'));
const verifyPulseCheckCaller = new Function('assertAccountOpen', `${authSource};return verifyPulseCheckCaller;`)(guards.assertAccountOpen);

// Execute the production endpoint and storage policy with in-memory Firestore and
// a deterministic classifier transport. No Firebase account or provider is used.
function fixture() {
  const records = new Map();
  let writes = 0;
  const snapshot = key => ({ exists: records.has(key), id: key.split('/').at(-1), data: () => records.get(key) });
  const reference = key => ({
    id: key.split('/').at(-1),
    get: async () => snapshot(key),
    set: async value => { writes += 1; records.set(key, structuredClone(value)); },
  });
  const query = (name, conditions = []) => ({
    doc: id => reference(`${name}/${id || 'generated'}`),
    where: (field, operator, value) => {
      assert.equal(operator, '==');
      return query(name, [...conditions, [field, value]]);
    },
    get: async () => ({ docs: [...records.keys()]
      .filter(key => key.startsWith(`${name}/`) && conditions.every(([field, value]) => records.get(key)[field] === value))
      .map(snapshot) }),
  });
  const db = {
    collection: name => query(name),
    runTransaction: async body => body({ get: ref => ref.get(), set: (ref, value) => ref.set(value) }),
  };
  const app = { firestore: () => db, auth: () => ({ verifyIdToken: async token => ({ uid: token }) }) };
  const dependencies = {
    './config/firebase': { getFirebaseAdminApp: () => app, headers: {} },
    './pulsecheck-chat': { runtimeHelpers: { verifyPulseCheckCaller } },
    './lib/account-closure-guard': guards,
    './utils/noraStoragePolicy': {
      ...storage,
      assessNoraStorage: value => storage.assessNoraStorage(value, {
        apiKey: 'synthetic-only',
        fetchImpl: async () => ({ ok: true, json: async () => ({ choices: [{ message: { content: '{"decision":"ordinary"}' } }] }) }),
      }),
    },
  };
  const exports = {};
  new Function('require', 'exports', fs.readFileSync(path.join(functions, 'nora-save-conversation.js'), 'utf8'))(key => {
    assert.ok(key in dependencies, `Unexpected dependency: ${key}`);
    return dependencies[key];
  }, exports);
  return {
    records, db, get writes() { return writes; },
    save: (input, userId = 'athlete-A') => exports.handler({
      httpMethod: 'POST', headers: { authorization: `Bearer ${userId}` }, body: JSON.stringify(input),
    }),
    // Same owner + session-key predicates used by native latest-session restoration.
    restore: async (sessionKey, userId = 'athlete-A') => (await db.collection('conversations')
      .where('userId', '==', userId).where('sessionKey', '==', sessionKey).get()).docs.map(doc => doc.data()),
  };
}

const messages = [{ id: 'message-1', content: 'I want a focus cue for serving.', isFromUser: true, timestamp: 100 }];

test('native session keys survive protected save and owner-scoped history readback', async () => {
  for (const sessionKey of [
    '2026-11-26', 'morning-checkin-2026-11-26-ready',
    'protocol-reflection-athlete_A_2026-11-26_protocol_slot0_123-2026-11-26',
    'protocol-reflection-plan:fixture.v1-2026-11-26',
  ]) {
    const f = fixture();
    assert.equal((await f.save({ id: 'saved-chat', sessionKey: ` ${sessionKey} `, messages })).statusCode, 200);
    const [restored] = await f.restore(sessionKey);
    assert.equal(restored.id, 'saved-chat');
    assert.equal(restored.sessionKey, sessionKey);
    assert.equal(restored.messages[0].content, messages[0].content);
    assert.deepEqual(await f.restore(sessionKey, 'athlete-B'), []);
  }
});

test('an older client transcript replacement preserves a valid stored session key', async () => {
  const f = fixture();
  await f.save({ id: 'saved-chat', sessionKey: '2026-11-26', messages });
  for (const legacyFields of [{}, { sessionKey: null }]) {
    const updated = [{ ...messages[0], content: 'I used my focus cue.' }];
    assert.equal((await f.save({ id: 'saved-chat', messages: updated, ...legacyFields })).statusCode, 200);
    const [restored] = await f.restore('2026-11-26');
    assert.equal(restored.messages[0].content, updated[0].content);
  }
});

test('malformed supplied session keys fail without replacing the saved conversation', async () => {
  const f = fixture();
  await f.save({ id: 'saved-chat', sessionKey: '2026-11-26', messages });
  const original = structuredClone(f.records.get('conversations/saved-chat'));
  for (const sessionKey of ['', ' ', 'private sentence', 'bad/key', 'bad\nkey', 'x'.repeat(257), 42, {}, []]) {
    assert.equal((await f.save({ id: 'saved-chat', sessionKey, messages: [] })).statusCode, 400);
    assert.deepEqual(f.records.get('conversations/saved-chat'), original);
  }
  assert.equal(f.writes, 1);
});

test('missing keys remain compatible and invalid historical keys are not carried forward', async () => {
  const f = fixture();
  assert.equal((await f.save({ id: 'old-client', messages })).statusCode, 200);
  assert.equal('sessionKey' in f.records.get('conversations/old-client'), false);
  f.records.set('conversations/old-client', { userId: 'athlete-A', sessionKey: 'not an identifier' });
  assert.equal((await f.save({ id: 'old-client', messages })).statusCode, 200);
  assert.equal('sessionKey' in f.records.get('conversations/old-client'), false);
});

test('history metadata does not bypass transcript redaction or cross-account writes', async () => {
  const f = fixture();
  const restricted = [{ ...messages[0], content: 'My medication details are private.' }];
  assert.equal((await f.save({ id: 'saved-chat', sessionKey: '2026-11-26', messages: restricted })).statusCode, 200);
  const [restored] = await f.restore('2026-11-26');
  assert.equal(restored.storagePolicy.restricted, true);
  assert.equal(restored.messages[0].content, storage.WITHHELD);
  assert.deepEqual(restored.messages[0].chatActions, []);
  assert.equal((await f.save({ id: 'saved-chat', sessionKey: '2026-11-27', messages }, 'athlete-B')).statusCode, 403);
  assert.equal(f.writes, 1);
  assert.equal(f.records.get('conversations/saved-chat').sessionKey, '2026-11-26');
});
