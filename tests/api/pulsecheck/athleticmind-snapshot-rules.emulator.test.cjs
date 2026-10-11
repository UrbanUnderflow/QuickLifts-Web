const { test } = require('node:test');
const fs = require('node:fs');
const { initializeTestEnvironment, assertFails } = require('@firebase/rules-unit-testing');
const { collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, setLogLevel } = require('firebase/firestore');
setLogLevel('silent');
const COLLECTIONS = ['athleticmind-snapshot-pulls', 'athleticmind-snapshots', 'athleticmind-snapshot-deliveries', 'athleticmind-snapshot-watermarks', 'athleticmind-snapshot-scheduler', 'systemOverviewShareLinks', 'systemOverviewShareUnlockAttempts', 'developerDocsUnlockAttempts', 'partner-api-access-requests', 'partner-api-keys', 'partner-api-key-audit', 'partner-api-key-rate-limits'];

test('snapshot and protected-share server collections reject every client role, including platform admin', async (t) => {
  const env = await initializeTestEnvironment({ projectId: 'demo-athleticmind-snapshot-rules', firestore: { host: '127.0.0.1', port: 8188, rules: fs.readFileSync('firestore.rules', 'utf8') } });
  try {
    await env.withSecurityRulesDisabled(async context => {
      const db = context.firestore();
      await setDoc(doc(db, 'admin', 'admin@synthetic.example'), { email: 'admin@synthetic.example', role: 'admin' });
      for (const name of COLLECTIONS) {
        await setDoc(doc(db, name, 'existing'), { synthetic: true, secret: 'synthetic-fixture' });
        await setDoc(doc(db, name, 'existing', 'nested', 'existing'), { synthetic: true });
      }
    });
    for (const [role, context] of [['anonymous', env.unauthenticatedContext()], ['athlete', env.authenticatedContext('athlete', { email: 'athlete@synthetic.example' })], ['admin', env.authenticatedContext('admin', { email: 'admin@synthetic.example' })]]) {
      const db = context.firestore();
      for (const name of COLLECTIONS) await t.test(`${role}: ${name}`, async () => {
        const existing = doc(db, name, 'existing');
        await assertFails(getDoc(existing));
        await assertFails(getDocs(collection(db, name)));
        await assertFails(setDoc(doc(db, name, `new-${role}`), { synthetic: true }));
        await assertFails(setDoc(existing, { synthetic: true }));
        await assertFails(updateDoc(existing, { secret: 'changed' }));
        await assertFails(deleteDoc(existing));
        await assertFails(getDoc(doc(db, name, 'existing', 'nested', 'existing')));
        await assertFails(setDoc(doc(db, name, 'existing', 'nested', `new-${role}`), { synthetic: true }));
      });
    }
  } finally { await env.cleanup(); }
});
