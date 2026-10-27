const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { verifyEmailLinkSession } = require('../../../src/lib/server/auth/email-link-session');
const { withModuleMocks } = require('../firebase-admin/_runtimeHarness.cjs');
const now = Date.parse('2026-10-27T12:00:00Z');

function fixture({ identity = {}, user = {}, profile = true, closure = false, revoked = false } = {}) {
  const reads = [];
  const auth = {
    verifyIdToken: async (token, checkRevoked) => {
      assert.equal(token, 'verified-token'); assert.equal(checkRevoked, true);
      if (revoked) throw Error('revoked synthetic token');
      return { uid: 'existing-owner', email: 'Owner@School.edu', email_verified: true, auth_time: now / 1000, firebase: { sign_in_provider: 'password' }, ...identity };
    },
    getUser: async uid => { assert.equal(uid, 'existing-owner'); return { uid, email: 'owner@school.edu', emailVerified: true, disabled: false, providerData: [{ providerId: 'password' }], ...user }; },
  };
  const db = { collection: name => ({ doc: uid => ({ get: async () => {
    assert.equal(uid, 'existing-owner'); assert.ok(['users', 'account-closure-jobs'].includes(name)); reads.push(name);
    return { exists: name === 'users' ? profile : closure };
  } }) }) };
  return { auth, db, reads, run: () => verifyEmailLinkSession({ auth, db, bearer: 'verified-token', now }) };
}

test('fresh verified email credential transfers the same existing UID with read-only account checks', async () => {
  const f = fixture(); assert.deepEqual(await f.run(), { uid: 'existing-owner' });
  assert.deepEqual(f.reads.sort(), ['account-closure-jobs', 'users']);
});
for (const provider of ['phone', 'custom', 'google.com', 'apple.com', 'anonymous']) {
  test(`rejects ${provider} identity before account lookup`, async () => {
    const f = fixture({ identity: { firebase: { sign_in_provider: provider } } });
    await assert.rejects(f.run(), error => error.status === 401); assert.deepEqual(f.reads, []);
  });
}
for (const [name, options] of [
  ['revoked token', { revoked: true }],
  ['unverified identity', { identity: { email_verified: false } }],
  ['missing email', { identity: { email: undefined } }],
  ['missing UID', { identity: { uid: undefined } }],
  ['invalid UID path', { identity: { uid: 'other/path' } }],
  ['expired identity', { identity: { auth_time: now / 1000 - 601 } }],
  ['future identity', { identity: { auth_time: now / 1000 + 61 } }],
  ['missing auth time', { identity: { auth_time: undefined } }],
  ['disabled user', { user: { disabled: true } }],
  ['unverified auth record', { user: { emailVerified: false } }],
  ['email mismatch', { user: { email: 'someoneelse@school.edu' } }],
  ['removed email provider', { user: { providerData: [{ providerId: 'phone' }] } }],
]) test(`rejects ${name}`, async () => { const f = fixture(options); await assert.rejects(f.run()); assert.deepEqual(f.reads, []); });

test('existing Firebase identity without an app profile cannot create a session or profile', async () => {
  await assert.rejects(fixture({ profile: false }).run(), error => error.status === 403 && error.reason === 'email-link-auth/existing-account-required');
});
test('an account closure marker blocks transfer even while its app profile exists', async () => {
  await assert.rejects(fixture({ closure: true }).run(), error => error.status === 403 && error.reason === 'email-link-auth/account-closing');
});

test('endpoint signs only the verified UID in its selected Firebase project with no caller claims', async () => {
  const file = path.resolve('netlify/functions/complete-email-link-auth.js'); delete require.cache[file];
  let signed = 0;
  const app = { auth: () => ({}), firestore: () => ({}) };
  const api = withModuleMocks({
    './config/firebase': { headers: {}, getFirebaseAdminApp: () => app, isDevMode: event => event.headers['x-pulsecheck-firebase-mode'] === 'dev' },
    '../../src/lib/server/auth/email-link-session': { verifyEmailLinkSession: async ({ bearer }) => { assert.equal(bearer, 'verified-token'); return { uid: 'existing-owner' }; } },
    '../../src/lib/server/firebase/custom-token': { createCustomTokenForApp: async (...args) => { assert.equal(args.length, 3); assert.deepEqual(args, [app, 'existing-owner', 'dev']); signed++; return 'synthetic-custom-token'; } },
  }, () => require(file));
  const response = await api.handler({ httpMethod: 'POST', headers: { authorization: 'Bearer verified-token', 'x-pulsecheck-firebase-mode': 'dev' }, body: JSON.stringify({ uid: 'victim', email: 'victim@school.edu', role: 'admin', claims: { admin: true } }) });
  assert.equal(response.statusCode, 200); assert.match(response.headers['Cache-Control'], /no-store/);
  assert.deepEqual(JSON.parse(response.body), { uid: 'existing-owner', customToken: 'synthetic-custom-token' }); assert.equal(signed, 1);
  assert.equal((await api.handler({ httpMethod: 'POST', headers: {} })).statusCode, 401);
  assert.equal((await api.handler({ httpMethod: 'GET', headers: {} })).statusCode, 405);
  assert.equal((await api.handler({ httpMethod: 'OPTIONS', headers: {} })).statusCode, 200);
  assert.equal(signed, 1);
});
test('endpoint redacts unexpected verification failures and issues no token', async () => {
  const file = path.resolve('netlify/functions/complete-email-link-auth.js'); delete require.cache[file];
  const api = withModuleMocks({
    './config/firebase': { headers: {}, getFirebaseAdminApp: () => ({ auth: () => ({}), firestore: () => ({}) }), isDevMode: () => false },
    '../../src/lib/server/auth/email-link-session': { verifyEmailLinkSession: async () => { throw Error('sensitive identity detail'); } },
    '../../src/lib/server/firebase/custom-token': { createCustomTokenForApp: async () => { throw Error('must not sign'); } },
  }, () => require(file));
  const response = await api.handler({ httpMethod: 'POST', headers: { authorization: 'Bearer invalid' } });
  assert.equal(response.statusCode, 401); assert.doesNotMatch(response.body, /sensitive identity detail/); assert.match(response.body, /verification-failed/);
});
