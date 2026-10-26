// Real Firebase Auth + Firestore emulators only; no SMS, email, or production accounts.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const admin = require('firebase-admin');
// Firebase's Node export intentionally omits phone auth. Bundle its browser
// implementation so these tests exercise the same credential/session code as web.
const Module = require('node:module');
const driver = new Module(__filename);
driver._compile(require('esbuild').buildSync({ stdin: { contents: `export { initializeApp, deleteApp } from 'firebase/app';export { getAuth, connectAuthEmulator, PhoneAuthProvider, signInWithCredential, updateCurrentUser, signOut, createUserWithEmailAndPassword, linkWithCredential, deleteUser, signInWithCustomToken, reauthenticateWithCredential } from 'firebase/auth';`, resolveDir: process.cwd() }, bundle: true, platform: 'browser', format: 'cjs', write: false }).outputFiles[0].text, __filename + '.driver');
const { initializeApp, deleteApp, getAuth, connectAuthEmulator, PhoneAuthProvider, signInWithCredential, updateCurrentUser, signOut, createUserWithEmailAndPassword, linkWithCredential, deleteUser, signInWithCustomToken, reauthenticateWithCredential } = driver.exports;
const { completePhoneProfile } = require('../../../src/lib/server/auth/phone-profile');
const projectId = 'demo-phone-auth';
before(async () => {
  for (const url of [`http://127.0.0.1:9099/emulator/v1/projects/${projectId}/accounts`, `http://127.0.0.1:8087/emulator/v1/projects/${projectId}/databases/(default)/documents`]) {
    const response = await fetch(url, { method: 'DELETE' }); assert.equal(response.ok, true);
  }
});
if (process.env.FIREBASE_AUTH_EMULATOR_HOST !== '127.0.0.1:9099' || process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8087') throw new Error('Start isolated demo-phone-auth emulators on 9099/8087.');
const server = admin.initializeApp({ projectId }, 'phone-auth-emulator');
const db = server.firestore(), auth = server.auth();
const apps = [];
function client(name) { const app = initializeApp({ projectId, apiKey: 'fake-api-key', authDomain: `${projectId}.firebaseapp.com` }, name); apps.push(app); const instance = getAuth(app); connectAuthEmulator(instance, 'http://127.0.0.1:9099', { disableWarnings: true }); return instance; }
async function credential(phoneNumber) {
  const r = await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:sendVerificationCode?key=fake-api-key', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phoneNumber }) });
  const { sessionInfo } = await r.json(); assert.ok(sessionInfo);
  const codes = await (await fetch(`http://127.0.0.1:9099/emulator/v1/projects/${projectId}/verificationCodes`)).json();
  const code = codes.verificationCodes.find(c => c.sessionInfo === sessionInfo).code;
  return PhoneAuthProvider.credential(sessionInfo, code);
}
const body = email => ({ institutionalEmail: email, acceptTerms: true, termsVersion: '2026-04-08', privacyVersion: '2026-04-08', platform: 'web' });
async function complete(user, email) { return completePhoneProfile({ auth, db, bearer: await user.getIdToken(), body: body(email) }); }
after(async () => { await Promise.all(apps.map(deleteApp)); await server.delete(); });

test('new phone signup stores reference email, transfers same UID, and refreshes after secondary signout', async () => {
  const primary = client('signup-primary'), secondary = client('signup-secondary');
  const result = await signInWithCredential(secondary, await credential('+12025550101'));
  const answer = await complete(result.user, 'athlete@institution.example');
  assert.equal(answer.created, true); assert.equal(primary.currentUser, null);
  await updateCurrentUser(primary, result.user); await signOut(secondary);
  assert.equal(primary.currentUser.uid, result.user.uid); await primary.currentUser.getIdToken(true);
  const profile = (await db.collection('users').doc(result.user.uid).get()).data();
  assert.equal(profile.institutionalEmail, 'athlete@institution.example'); assert.equal(profile.institutionalEmailVerified, false);
  assert.equal((await auth.getUser(result.user.uid)).email, undefined);
  assert.deepEqual(await complete(primary.currentUser, 'changed@institution.example'), { uid: result.user.uid, created: false });
  assert.equal((await db.collection('users').doc(result.user.uid).get()).data().email, 'athlete@institution.example');
});

test('connecting phone and subsequent SMS login retain existing coach UID and completed baseline', async () => {
  const primary = client('coach-primary'), secondary = client('coach-secondary');
  const original = (await createUserWithEmailAndPassword(primary, 'coach-' + Date.now() + '@institution.example', 'Synthetic-test-only-123')).user;
  await db.collection('users').doc(original.uid).set({ email: original.email, role: 'coach', completedBaseline: { revision: 'kept', answers: [1, 2, 3] } });
  await linkWithCredential(original, await credential('+12025550102'));
  await signOut(primary);
  const verified = (await signInWithCredential(secondary, await credential('+12025550102'))).user;
  assert.equal(verified.uid, original.uid);
  await complete(verified, 'coach-' + Date.now() + '@institution.example'); await updateCurrentUser(primary, verified); await signOut(secondary);
  assert.equal(primary.currentUser.uid, original.uid);
  const profile = (await db.collection('users').doc(original.uid).get()).data();
  assert.equal(profile.role, 'coach'); assert.deepEqual(profile.completedBaseline, { revision: 'kept', answers: [1, 2, 3] });
});

test('unlinked phone cannot claim an existing institutional email; cleanup permits later verified linking', async () => {
  const primary = client('kept-primary'), secondary = client('blocked-secondary');
  const owner = (await createUserWithEmailAndPassword(primary, 'kept-' + Date.now() + '@institution.example', 'Synthetic-test-only-123')).user;
  await db.collection('users').doc(owner.uid).set({ email: owner.email, completedBaseline: true });
  const phoneCredential = await credential('+12025550103');
  const temporary = (await signInWithCredential(secondary, phoneCredential)).user;
  await assert.rejects(complete(temporary, owner.email), e => e.status === 409);
  assert.equal((await db.collection('users').doc(temporary.uid).get()).exists, false);
  assert.equal(primary.currentUser.uid, owner.uid);
  await deleteUser(temporary);
  // Codes are single-use. The normal Settings flow always sends a fresh code.
  await linkWithCredential(owner, await credential('+12025550103'));
  assert.equal((await auth.getUser(owner.uid)).phoneNumber, '+12025550103');
  assert.equal((await db.collection('users').doc(owner.uid).get()).data().completedBaseline, true);
});

test('iOS token handoff establishes an independent primary session that can reauthenticate by SMS', async () => {
  const primary = client('ios-primary'), secondary = client('ios-secondary');
  const verified = (await signInWithCredential(secondary, await credential('+12025550104'))).user;
  await complete(verified, 'ios-athlete@institution.example');
  const customToken = await auth.createCustomToken(verified.uid);
  const result = await signInWithCustomToken(primary, customToken);
  await signOut(secondary);
  assert.equal(result.user.uid, verified.uid);
  assert.equal(primary.currentUser.phoneNumber, '+12025550104');
  await reauthenticateWithCredential(primary.currentUser, await credential('+12025550104'));
  const token = await auth.verifyIdToken(await primary.currentUser.getIdToken(true));
  assert.equal(token.uid, verified.uid);
  assert.equal(token.firebase.sign_in_provider, 'phone');
});
