const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function fixture({ linked = true, signedIn = true } = {}) {
  const calls = [];
  const owner = { uid: 'athlete-a', phoneNumber: linked ? '+12025550123' : null,
    providerData: linked ? [{ providerId: 'phone' }] : [],
    reload: async () => calls.push('reload'), getIdToken: async refresh => { calls.push(['token', refresh]); return 'token'; } };
  const auth = { currentUser: signedIn ? owner : null, app: { options: {} } };
  const unexpected = () => { throw Error('Unexpected account mutation'); };
  class PhoneAuthProvider {
    async verifyPhoneNumber(phone) { calls.push(['send', phone]); return 'verification'; }
    static credential(id, code) { return { id, code }; }
  }
  const mocks = {
    'firebase/app': { initializeApp: unexpected, deleteApp: unexpected },
    'firebase/auth': { PhoneAuthProvider,
      RecaptchaVerifier: class { clear() { calls.push('clear'); } },
      reauthenticateWithCredential: async (user, credential) => { calls.push(['reauth', user.uid, credential]); return { user }; },
      linkWithCredential: unexpected, signInWithCredential: unexpected, updateCurrentUser: unexpected,
      setPersistence: unexpected, signOut: unexpected },
    'firebase/firestore': {},
    '../config': { auth },
    '../../../utils/legalAcceptance': {},
    '../../../utils/authSessionCleanup': { clearStalePulseAuthKeys: unexpected },
    '../../../lib/pulsecheck/authPhone': { normalizeAuthPhone: value => value },
  };
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/api/firebase/auth/phone.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText, { module, exports: module.exports, require: name => mocks[name], Error });
  return { ...module.exports, auth, owner, calls };
}

test('phone verification refreshes the same account without signing in or linking another account', async () => {
  const f = fixture();
  const attempt = await f.createPhoneAuthAttempt({}, 'verify');
  assert.deepEqual(f.calls, []);
  await attempt.send('+12025550123');
  assert.equal(await attempt.confirm('123456'), f.owner);
  assert.equal(f.auth.currentUser, f.owner);
  assert.deepEqual(f.calls.map(call => Array.isArray(call) ? call[0] : call), ['send', 'reauth', 'reload', 'token']);
  assert.deepEqual(f.calls.at(-1), ['token', true]);
});

test('verification requires a signed-in account with a linked phone', async () => {
  for (const options of [{ signedIn: false }, { linked: false }]) {
    const f = fixture(options);
    await assert.rejects(f.createPhoneAuthAttempt({}, 'verify'), /Sign in again|Connect your phone/);
    assert.deepEqual(f.calls, []);
  }
});

test('different phone and account changes are rejected before sending or accepting a code', async () => {
  const f = fixture();
  const attempt = await f.createPhoneAuthAttempt({}, 'verify');
  await assert.rejects(attempt.send('+12025550999'), /connected to your signed-in account/);
  assert.deepEqual(f.calls, []);
  await attempt.send('+12025550123');
  f.auth.currentUser = { ...f.owner, uid: 'athlete-b' };
  await assert.rejects(attempt.confirm('123456'), /account changed/);
  await assert.rejects(attempt.send('+12025550123'), /account changed/);
  assert.equal(f.calls.length, 1);
});

test('changed linked phone or disposed attempt cannot confirm or send', async () => {
  const f = fixture();
  const attempt = await f.createPhoneAuthAttempt({}, 'verify');
  await attempt.send('+12025550123');
  f.owner.phoneNumber = '+12025550999';
  await assert.rejects(attempt.confirm('123456'), /phone changed/);
  await attempt.dispose();
  await assert.rejects(attempt.confirm('123456'), /Request a new code/);
  await assert.rejects(attempt.send('+12025550123'), /Request a new code/);
  assert.deepEqual(f.calls.map(call => Array.isArray(call) ? call[0] : call), ['send', 'clear']);
});
