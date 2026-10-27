const { test } = require('node:test');
const assert = require('node:assert/strict');
const { normalizeAuthPhone } = require('../../../src/lib/pulsecheck/authPhone');
const { normalizeSignInPolicy, assertOrganizationSignIn } = require('../../../src/lib/pulsecheck/signInPolicy');
const { resolvePublicSignInPolicy, assertMemberSignIn } = require('../../../src/lib/server/auth/program-sign-in');
const organization = { status: 'active', signInPolicy: { mode: 'institution-phone', emailDomains: ['school.edu'] } };
const phone = { uid: 'kept-uid', firebase: { sign_in_provider: 'phone' } };
test('ten national digits, formatting and optional +1 produce one US/Canada identity', () => {
  for (const input of ['2025550123', '(202) 555-0123', '1 202 555 0123', '+1 (202) 555-0123']) assert.equal(normalizeAuthPhone(input), '+12025550123');
  assert.equal(normalizeAuthPhone('4165550123'), '+14165550123');
  for (const input of ['+44 7700 900123', '+52 5555555555', '1235550123', '2021550123', '2025550123 ext 2', '120255501234', '+12025550123<script>']) assert.throws(() => normalizeAuthPhone(input));
});
test('configuration validates domains, normalizes case, and preserves legacy standard mode', () => {
  assert.deepEqual(normalizeSignInPolicy(undefined), { mode: 'standard', emailDomains: [] });
  assert.deepEqual(normalizeSignInPolicy({ mode: 'institution-phone', emailDomains: [' @School.EDU ', 'school.edu'] }), organization.signInPolicy);
  for (const input of [{ mode: 'other', emailDomains: [] }, { mode: 'institution-phone', emailDomains: [] }, { mode: 'institution-phone', emailDomains: ['school.edu.evil/'] }]) assert.throws(() => normalizeSignInPolicy(input));
});
test('institutional enrollment requires a verified phone and matching reference email', () => {
  for (const provider of ['google.com', 'apple.com', 'password', 'custom']) assert.throws(() => assertOrganizationSignIn(organization, { firebase: { sign_in_provider: provider } }, 'a@school.edu'), e => e.code === 'program/phone-required');
  assert.doesNotThrow(() => assertOrganizationSignIn(organization, phone, 'a@school.edu'));
  assert.doesNotThrow(() => assertOrganizationSignIn(organization, { firebase: { sign_in_provider: 'custom' }, pulse_phone_auth: true }, 'a@school.edu'));
  for (const email of ['a@personal.example', 'a@school.edu.evil', 'a@sub.school.edu', '']) assert.throws(() => assertOrganizationSignIn(organization, phone, email), e => e.code === 'program/institution-email-required');
  assert.doesNotThrow(() => assertOrganizationSignIn({}, { firebase: { sign_in_provider: 'google.com' } }, 'personal@example.test'));
});
function database(orgs, membership = true) {
  return { collection: name => ({
    doc: id => ({ get: async () => ({ data: () => name === 'users' ? { institutionalEmail: 'a@school.edu', completedBaseline: true } : orgs[id] }) }),
    where: (field, op, value) => ({
      get: async () => ({ docs: membership ? [{ data: () => ({ userId: 'kept-uid', organizationId: 'program', status: 'active' }) }] : [] }),
      limit: () => ({ get: async () => ({ docs: Object.values(orgs).filter(row => row.signInPolicy?.emailDomains.includes(value)).map(row => ({ data: () => row })) }) }),
    }),
  }) };
}
test('public policy uses admin configuration without leaking people or granting membership', async () => {
  const db = database({ program: organization });
  assert.deepEqual(await resolvePublicSignInPolicy(db, { email: 'a@school.edu' }), { mode: 'standard', emailDomains: [] });
  assert.deepEqual(await resolvePublicSignInPolicy(db, { organizationId: 'program' }), organization.signInPolicy);
  assert.deepEqual(await resolvePublicSignInPolicy(db, { email: 'unknown@personal.example' }), { mode: 'standard', emailDomains: [] });
});
test('existing members may return with any linked authentication provider', async () => {
  const db = database({ program: organization, other: { status: 'active' } });
  assert.equal((await resolvePublicSignInPolicy(db, { organizationId: 'other' })).mode, 'standard');
  for (const provider of ['google.com', 'apple.com', 'password', 'phone']) assert.equal((await assertMemberSignIn(db, { ...phone, firebase: { sign_in_provider: provider } })).completedBaseline, true);
  assert.equal((await assertMemberSignIn(db, phone)).completedBaseline, true);
});

test('policy endpoint distinguishes malformed input and invalid identity without granting a session', async () => {
  const { withModuleMocks } = require('../firebase-admin/_runtimeHarness.cjs');
  const path = require('node:path');
  const file = path.resolve('netlify/functions/program-sign-in-policy.js'); delete require.cache[file];
  const api = withModuleMocks({ './config/firebase': { headers: {}, getFirebaseAdminApp: () => ({ auth: () => ({ verifyIdToken: async () => { throw Error('synthetic invalid token'); } }), firestore: () => database({ program: organization }) }) } }, () => require(file));
  const malformed = await api.handler({ httpMethod: 'POST', headers: {}, body: '{' }); assert.equal(malformed.statusCode, 400);
  const invalid = await api.handler({ httpMethod: 'POST', headers: { authorization: 'Bearer invalid-test-token' }, body: '{}' }); assert.equal(invalid.statusCode, 401); assert.match(invalid.headers['Cache-Control'], /no-store/);
  const publicPolicy = await api.handler({ httpMethod: 'POST', headers: {}, body: JSON.stringify({ email: 'a@school.edu', uid: 'forged-user', pulse_phone_auth: true }) });
  assert.equal(publicPolicy.statusCode, 200); assert.deepEqual(JSON.parse(publicPolicy.body), { mode: 'standard', emailDomains: [] });
});

test('platform sign-in does not impose organizational registration policy on existing profiles', async () => {
  const base = database({ program: organization });
  const db = { collection: name => name === 'admin' ? { doc: email => ({ get: async () => ({ exists: email === 'admin@example.test' }) }) } : base.collection(name) };
  const identity = { ...phone, firebase: { sign_in_provider: 'google.com' }, email: 'admin@example.test', email_verified: true };
  assert.equal((await assertMemberSignIn(db, identity)).completedBaseline, true);
  assert.equal((await assertMemberSignIn(db, { ...identity, email_verified: false })).completedBaseline, true);
  assert.equal((await assertMemberSignIn(db, { ...identity, email: 'coach@school.edu' })).completedBaseline, true);
});
