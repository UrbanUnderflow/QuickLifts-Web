const test = require('node:test');
const assert = require('node:assert/strict');
const { commitLegacyGeneration, hasProtectedLinearState } = require('../../netlify/functions/utils/legacy-generation-guard');
function fake(initial, atCommit = initial) {
  const calls = [];
  const ref = { get: async () => ({ exists: initial }) };
  const db = {
    collection(path) { assert.equal(path, 'pulsecheck-linear-curriculum/states/items'); return { doc(id) { assert.equal(id, 'athlete'); return ref; } }; },
    runTransaction: async work => work({ get: async target => { assert.equal(target, ref); calls.push('read'); return { exists: atCommit }; }, set: () => calls.push('write') }),
  };
  return { db, calls };
}
test('legacy accounts can materialize only after transactional state read', async () => {
  const { db, calls } = fake(false);
  assert.equal(await commitLegacyGeneration(db, 'athlete', tx => tx.set()), true);
  assert.deepEqual(calls, ['read', 'write']);
});
test('any protected state suppresses every supplied write', async () => {
  const { db, calls } = fake(true);
  assert.equal(await hasProtectedLinearState(db, 'athlete'), true);
  assert.equal(await commitLegacyGeneration(db, 'athlete', () => assert.fail('must not write')), false);
  assert.deepEqual(calls, ['read']);
});
test('enrollment after preflight blocks assignment and revision writes at commit', async () => {
  const { db, calls } = fake(false, true);
  assert.equal(await hasProtectedLinearState(db, 'athlete'), false);
  assert.equal(await commitLegacyGeneration(db, 'athlete', () => assert.fail('must not write')), false);
  assert.deepEqual(calls, ['read']);
});
test('failed protected-state read fails closed', async () => {
  const { db } = fake(false);
  db.runTransaction = work => work({ get: async () => { throw new Error('offline'); } });
  await assert.rejects(commitLegacyGeneration(db, 'athlete', () => assert.fail('must not write')), /offline/);
});
