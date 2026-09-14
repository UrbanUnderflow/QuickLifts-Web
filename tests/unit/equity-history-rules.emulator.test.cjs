const fs = require('node:fs');
const path = require('node:path');
const {before, beforeEach, after, test} = require('node:test');
const {initializeTestEnvironment, assertFails, assertSucceeds} = require('@firebase/rules-unit-testing');
const {doc, setDoc, updateDoc, deleteDoc, deleteField, getDoc} = require('firebase/firestore');

let env;
const signedPlan = {
  documentType: 'eip', title: 'Original EIP', prompt: 'Original instructions',
  content: 'Signed original plan', status: 'completed', autoSigned: true,
  autoSignedAt: '2026-08-06', revisionHistory: [{prompt: 'Original revision'}],
  signingRequestIds: ['signed-request'], versionNumber: 1,
};
const admin = () => env.authenticatedContext('admin-user', {email: 'admin@example.test'}).firestore();
before(async () => {
  if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error('Local Firestore emulator required');
  env = await initializeTestEnvironment({
    projectId: 'demo-equity-history',
    firestore: {rules: fs.readFileSync(path.resolve('firestore.rules'), 'utf8')},
  });
});
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async context => {
    await setDoc(doc(context.firestore(), 'admin', 'admin@example.test'), {role: 'admin'});
    await setDoc(doc(context.firestore(), 'equity-documents', 'original'), signedPlan);
  });
});
after(async () => { if (env) await env.cleanup(); });

test('even an admin cannot overwrite, reclassify, delete, or erase EIP version history', async () => {
  const ref = doc(admin(), 'equity-documents', 'original');
  for (const change of [
    {content: 'Replacement'}, {title: 'Replacement'}, {prompt: 'Replacement'},
    {documentType: 'other'}, {revisionHistory: []}, {versionNumber: 2},
    {sourceDocumentId: 'different'}, {originalDocumentId: 'different'},
    {autoSignedAt: '2026-09-14'},
  ]) await assertFails(updateDoc(ref, change));
  await assertFails(deleteDoc(ref));
  await assertFails(setDoc(ref, {...signedPlan, content: 'Replacement'}));
  await assertSucceeds(getDoc(ref));
});

test('a new unsigned version can be created while its completed text stays immutable', async () => {
  const ref = doc(admin(), 'equity-documents', 'v2');
  await assertSucceeds(setDoc(ref, {
    documentType: 'eip', title: 'Proposed amended EIP', content: 'New proposed terms',
    approvalStatus: 'draft', status: 'completed', versionNumber: 2,
    sourceDocumentId: 'original', originalDocumentId: 'original',
  }));
  await assertFails(updateDoc(ref, {content: 'Further edits require v3'}));
  await assertFails(deleteDoc(ref));
});

test('new EIPs cannot be created as automatically signed or already approved', async () => {
  for (const fields of [
    {}, {approvalStatus: 'approved'}, {approvalStatus: 'draft', autoSigned: true},
    {approvalStatus: 'draft', autoSignedAt: '2026-09-14'},
  ]) await assertFails(setDoc(doc(admin(), 'equity-documents', 'bad'), {documentType: 'eip', ...fields}));
});

test('a generating empty draft can be completed once but not reset to overwrite content', async () => {
  const ref = doc(admin(), 'equity-documents', 'new');
  await assertSucceeds(setDoc(ref, {
    documentType: 'eip', title: 'Draft', content: '',
    approvalStatus: 'draft', status: 'generating',
  }));
  await assertSucceeds(updateDoc(ref, {status: 'completed', title: 'New EIP', content: 'Generated unsigned plan'}));
  await assertSucceeds(updateDoc(ref, {status: 'generating'}));
  await assertFails(updateDoc(ref, {status: 'completed', content: 'Overwrite'}));
});

test('signature workflow metadata remains writable without changing plan text', async () => {
  const ref = doc(admin(), 'equity-documents', 'draft');
  await assertSucceeds(setDoc(ref, {documentType: 'eip', content: 'Draft', status: 'completed', approvalStatus: 'draft'}));
  await assertSucceeds(updateDoc(ref, {
    signingRequestId: 'request-1', signingRequestIds: ['request-1'],
    requiresSignature: true, needsResendSignature: false, updatedAt: 'now',
  }));
  await assertSucceeds(updateDoc(ref, {approvalStatus: 'approved', approvedBy: 'actual-approver', approvedAt: 'later'}));
});

test('approved and legacy auto-executed plans preserve all signature and approval evidence', async () => {
  await env.withSecurityRulesDisabled(async context => {
    await setDoc(doc(context.firestore(), 'equity-documents', 'approved'), {
      documentType: 'eip', content: 'Approved plan', status: 'completed',
      approvalStatus: 'approved', approvedAt: '2026-09-14', approvedBy: 'director',
      signingRequestId: 'signed-request', signingRequestIds: ['signed-request'],
    });
    await setDoc(doc(context.firestore(), 'equity-documents', 'legacy-date-only'), {
      documentType: 'eip', content: 'Legacy approved plan', status: 'completed',
      autoSignedAt: '2026-08-06', signingRequestIds: ['signed-request'],
    });
  });
  for (const id of ['original', 'approved', 'legacy-date-only']) {
    const ref = doc(admin(), 'equity-documents', id);
    for (const change of [
      {signingRequestId: 'replacement'}, {signingRequestIds: []},
      {signingRequestIds: deleteField()}, {approvalStatus: 'draft'},
      {approvalStatus: deleteField()}, {approvedAt: 'replacement'},
      {approvedAt: deleteField()}, {approvedBy: 'replacement'},
      {approvedBy: deleteField()}, {status: 'generating'}, {updatedAt: 'replacement'},
    ]) await assertFails(updateDoc(ref, change));
    await assertFails(deleteDoc(ref));
    await assertSucceeds(getDoc(ref));
  }
});

test('other equity documents retain existing admin behavior and non-admins remain denied', async () => {
  const ref = doc(admin(), 'equity-documents', 'other');
  await assertSucceeds(setDoc(ref, {documentType: 'warrant', content: 'Terms'}));
  await assertSucceeds(updateDoc(ref, {content: 'Updated'}));
  await assertSucceeds(deleteDoc(ref));
  const outsider = env.authenticatedContext('outsider', {email: 'outsider@example.test'}).firestore();
  await assertFails(getDoc(doc(outsider, 'equity-documents', 'original')));
  await assertFails(setDoc(doc(outsider, 'equity-documents', 'new'), {documentType: 'eip', approvalStatus: 'draft'}));
});
