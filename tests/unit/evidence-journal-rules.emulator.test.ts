import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails } from '@firebase/rules-unit-testing';
import { collection, collectionGroup, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';

test('private evidence denies all direct client access including coach/admin and collection groups', async () => {
  assert.equal(process.env.FIRESTORE_EMULATOR_HOST, '127.0.0.1:8099', 'Explicit local emulator required');
  const env = await initializeTestEnvironment({ projectId: 'demo-evidence-journal', firestore: { host: '127.0.0.1', port: 8099, rules: readFileSync('firestore.rules', 'utf8') } });
  const root = 'pulsecheck-evidence-journals/owner';
  const path = `${root}/entries/moment`;
  try {
    await env.withSecurityRulesDisabled(async context => {
      await setDoc(doc(context.firestore(), path), { moment: 'Private athlete text', createdAt: 1 });
      await setDoc(doc(context.firestore(), `${path}/events/event`), { event: 'used', createdAt: 2 });
      await setDoc(doc(context.firestore(), `${root}/sources/assignment`), { entryId: 'moment' });
    });
    const contexts = [env.unauthenticatedContext(), env.authenticatedContext('owner'), env.authenticatedContext('other'), env.authenticatedContext('coach', { role: 'coach' }), env.authenticatedContext('admin', { admin: true, role: 'admin' })];
    for (const context of contexts) {
      const db = context.firestore();
      await assertFails(getDoc(doc(db, path)));
      await assertFails(getDocs(collection(db, `${root}/entries`)));
      await assertFails(getDocs(collectionGroup(db, 'entries')));
      await assertFails(getDocs(collectionGroup(db, 'events')));
      await assertFails(setDoc(doc(db, `${root}/entries/new`), { moment: 'new' }));
      await assertFails(updateDoc(doc(db, path), { moment: 'overwrite' }));
      await assertFails(deleteDoc(doc(db, path)));
      await assertFails(getDoc(doc(db, `${path}/events/event`)));
      await assertFails(setDoc(doc(db, `${path}/events/new`), { event: 'used' }));
      await assertFails(getDoc(doc(db, `${root}/sources/assignment`)));
    }
  } finally { await env.cleanup(); }
});
