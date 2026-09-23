const fs = require('node:fs');
const path = require('node:path');
const { before, beforeEach, after, test } = require('node:test');
const { initializeTestEnvironment, assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const { doc, collection, setDoc, updateDoc, deleteDoc, getDoc, getDocs, Timestamp } = require('firebase/firestore');
let env;
const client = (email, verified = true) => email ? env.authenticatedContext(email, {email, email_verified: verified}).firestore() : env.unauthenticatedContext().firestore();
const ref = (email, id = 'pending', verified = true) => doc(client(email, verified), 'signingRequests', id);
const pending = { equityDocumentId: 'plan', documentType: 'eip', recipientEmail: 'signer@example.test', status: 'pending', documentContent: 'Agreed text' };
const proof = { typedName: 'Signer', signatureFont: 'serif', verificationMethod: 'firebase-auth', verifiedEmail: 'signer@example.test', verifiedUid: 'signer', timestamp: Timestamp.now() };
before(async () => {
  if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error('Local Firestore emulator required');
  env = await initializeTestEnvironment({projectId: 'demo-equity-signatures', firestore: {rules: fs.readFileSync(path.resolve('firestore.rules'), 'utf8')}});
});
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, 'admin', 'admin@example.test'), {role: 'admin'});
    await setDoc(doc(db, 'signingRequests', 'pending'), pending);
    await setDoc(doc(db, 'signingRequests', 'signed'), {...pending, status: 'signed', signatureData: proof, signedAt: Timestamp.now()});
    await setDoc(doc(db, 'signingRequests', 'legacy'), {status: 'pending', documentType: 'services', recipientEmail: 'signer@example.test'});
    await setDoc(doc(db, 'signingRequests', 'invalid'), {...pending, invalidatedAt: Timestamp.now()});
    await setDoc(doc(db, 'signingRequests', 'missing-link'), {documentType: 'eip', status: 'pending', recipientEmail: 'signer@example.test'});
  });
});
after(async () => { if (env) await env.cleanup(); });
test('equity reads require admin or verified recipient; list is admin only', async () => {
  for (const id of ['pending', 'missing-link']) {
    await assertFails(getDoc(ref(null, id)));
    await assertFails(getDoc(ref('outsider@example.test', id)));
    await assertFails(getDoc(ref('signer@example.test', id, false)));
    await assertSucceeds(getDoc(ref('signer@example.test', id)));
    await assertSucceeds(getDoc(ref('admin@example.test', id)));
  }
  await assertFails(getDocs(collection(client(), 'signingRequests')));
  await assertFails(getDocs(collection(client('signer@example.test'), 'signingRequests')));
  await assertSucceeds(getDocs(collection(client('admin@example.test'), 'signingRequests')));
});
test('only verified recipient can mark an active equity request viewed', async () => {
  await assertFails(updateDoc(ref(null), {status: 'viewed'}));
  await assertFails(updateDoc(ref('signer@example.test', 'pending', false), {status: 'viewed'}));
  await assertFails(updateDoc(ref('signer@example.test', 'invalid'), {status: 'viewed'}));
  await assertSucceeds(updateDoc(ref('signer@example.test'), {status: 'viewed', viewedAt: Timestamp.now()}));
});
test('no client can forge an equity signature or trusted verification evidence', async () => {
  for (const email of [null, 'signer@example.test', 'admin@example.test']) {
    await assertFails(updateDoc(ref(email), {status: 'signed', signedAt: Timestamp.now(), signatureData: proof}));
    await assertFails(updateDoc(ref(email), {signatureData: proof}));
    await assertFails(updateDoc(ref(email), {status: 'signed'}));
  }
  await assertFails(setDoc(ref('admin@example.test', 'forged'), {...pending, status: 'signed', signatureData: proof}));
  await assertFails(setDoc(ref('admin@example.test', 'proof'), {...pending, verifiedUid: 'forged'}));
  await assertSucceeds(setDoc(ref('admin@example.test', 'new'), pending));
  await assertSucceeds(updateDoc(ref('admin@example.test', 'new'), {recipientEmail: 'replacement@example.test'}));
});
test('signed equity evidence and identity stay immutable while invalidation is permitted', async () => {
  const signed = ref('admin@example.test', 'signed');
  for (const changes of [{status: 'pending'}, {documentContent: 'Other text'}, {recipientEmail: 'other@example.test'}, {equityDocumentId: 'other'}, {signatureData: {typedName: 'Other'}}, {documentType: 'services'}]) await assertFails(updateDoc(signed, changes));
  await assertFails(deleteDoc(signed));
  await assertSucceeds(updateDoc(signed, {invalidatedAt: Timestamp.now(), invalidatedReason: 'Replaced', updatedAt: Timestamp.now()}));
  const data = (await getDoc(signed)).data();
  require('node:assert/strict').equal(data.signatureData.verifiedUid, 'signer');
  require('node:assert/strict').equal(data.status, 'signed');
});
test('legacy public signing remains usable but cannot be relabeled or gain verified proof', async () => {
  await assertSucceeds(getDoc(ref(null, 'legacy')));
  await assertSucceeds(updateDoc(ref(null, 'legacy'), {status: 'viewed'}));
  await assertFails(updateDoc(ref('admin@example.test', 'legacy'), {equityDocumentId: 'plan'}));
  await assertFails(updateDoc(ref('admin@example.test', 'legacy'), {documentType: 'eip'}));
  await assertFails(updateDoc(ref(null, 'legacy'), {status: 'signed', signatureData: proof}));
  await assertSucceeds(updateDoc(ref(null, 'legacy'), {status: 'signed', signatureData: {typedName: 'Signer', signatureFont: 'serif'}}));
});
