const { test } = require('node:test');
const assert = require('node:assert/strict');
const { completePhoneProfile } = require('../../../src/lib/server/auth/phone-profile');
const now = Date.parse('2026-10-26T12:00:00Z');
function setup({ existing = null, owner = null, matches = [], identity = {}, user = {} } = {}) {
  let saved = existing;
  let creates = 0;
  const ref = { get: async () => ({ exists: !!saved, data: () => saved }) };
  const db = {
    collection: () => ({ doc: () => ref, where: () => ({ get: async () => ({ docs: [] }), limit: () => ({ get: async () => ({ docs: matches.map(id => ({ id })) }) }) }) }),
    runTransaction: async fn => fn({ get: ref.get, create: (_, data) => { creates++; saved = data; } }),
  };
  const auth = {
    verifyIdToken: async (token, revoked) => { assert.equal(token, 'verified-token'); assert.equal(revoked, true); return { uid: 'phone-owner', auth_time: now / 1000, phone_number: '+12025550123', firebase: { sign_in_provider: 'phone' }, ...identity }; },
    getUser: async uid => { assert.equal(uid, 'phone-owner'); return { uid, phoneNumber: '+12025550123', disabled: false, providerData: [{ providerId: 'phone' }], ...user }; },
    getUserByEmail: async () => { if (owner) return { uid: owner }; throw Object.assign(new Error(), { code: 'auth/user-not-found' }); },
  };
  const body = { institutionalEmail: ' Athlete@School.edu ', acceptTerms: true, termsVersion: '2026-04-08', privacyVersion: '2026-04-08', platform: 'ios' };
  return { run: changes => completePhoneProfile({ auth, db, bearer: 'verified-token', body: { ...body, ...changes }, now }), saved: () => saved, creates: () => creates };
}
test('SMS creates one account; institutional email is reference data, never a credential or role', async () => {
  const fixture = setup(); assert.deepEqual(await fixture.run(), { uid: 'phone-owner', created: true });
  const saved = fixture.saved(); assert.equal(saved.email, 'athlete@school.edu'); assert.equal(saved.institutionalEmailVerified, false);
  assert.equal(saved.phoneNumber, '+12025550123'); assert.deepEqual(saved.authProviders, ['phone']);
  for (const field of ['password', 'signInEmails', 'emailVerified', 'role', 'teamId', 'healthConsent', 'researchConsent', 'baseline']) assert.equal(saved[field], undefined);
  assert.equal(saved.legalAcceptance.acceptanceMethod, 'phone_sms_signup');
});
test('existing phone account retains reference email, roles, consent and completed answers', async () => {
  const existing = { email: 'kept@school.edu', role: 'coach', completedBaseline: { score: 7 }, healthConsent: false };
  const fixture = setup({ existing }); assert.deepEqual(await fixture.run({ institutionalEmail: 'changed@school.edu', acceptTerms: false }), { uid: 'phone-owner', created: false });
  assert.deepEqual(fixture.saved(), existing); assert.equal(fixture.creates(), 0);
});
test('retries return same UID without rewriting profile', async () => { const f = setup(); await f.run(); await f.run(); assert.equal(f.creates(), 1); });
for (const [name, options] of [
  ['email/password identity', { identity: { firebase: { sign_in_provider: 'password' } } }],
  ['custom-token identity', { identity: { firebase: { sign_in_provider: 'custom' } } }],
  ['expired verification', { identity: { auth_time: now / 1000 - 601 } }],
  ['future verification', { identity: { auth_time: now / 1000 + 120 } }],
  ['missing auth time', { identity: { auth_time: undefined } }],
  ['phone mismatch', { user: { phoneNumber: '+12025550124' } }],
  ['disabled user', { user: { disabled: true } }],
  ['removed phone provider', { user: { providerData: [{ providerId: 'password' }] } }],
]) test(`rejects ${name}`, async () => { const f = setup(options); await assert.rejects(f.run(), e => e.status === 401); assert.equal(f.creates(), 0); });
for (const value of ['', 'not-an-email', 'a@b', 'a@school.edu\nother@school.edu']) test(`rejects malformed email ${JSON.stringify(value)}`, async () => { await assert.rejects(setup().run({ institutionalEmail: value }), e => e.status === 400); });
for (const change of [{ acceptTerms: false }, { termsVersion: 'old' }, { privacyVersion: 'old' }]) test(`new accounts require current explicit legal acceptance ${JSON.stringify(change)}`, async () => { await assert.rejects(setup().run(change), e => e.reason === 'phone-auth/legal-required'); });
test('an email match never transfers account ownership', async () => { const f = setup({ owner: 'existing-email-owner' }); await assert.rejects(f.run(), e => e.status === 409); assert.equal(f.creates(), 0); });
test('reference email on another phone account prevents duplicate enrollment', async () => { const f = setup({ matches: ['other-phone-owner'] }); await assert.rejects(f.run(), e => e.status === 409); assert.equal(f.creates(), 0); });
test('Firebase UID, phone and roles cannot be supplied in body', async () => { const f = setup(); await f.run({ uid: 'victim', phoneNumber: '+12025550199', role: 'admin' }); assert.equal(f.saved().id, 'phone-owner'); assert.equal(f.saved().role, undefined); });
