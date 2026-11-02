const { test } = require('node:test');
const fs = require('node:fs');
const { initializeTestEnvironment, assertFails } = require('@firebase/rules-unit-testing');
const { collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, setLogLevel } = require('firebase/firestore');
setLogLevel('silent');
const PORT = Number(process.env.SPONSOR_EMULATOR_PORT || 8197);
const COLLECTIONS = ['athleticmind-sponsorship-test', 'athleticmind-sponsorship-live'];

test('sponsorship ledger reject every client role, including platform admin', async (t) => {
  const env = await initializeTestEnvironment({ projectId: 'demo-athleticmind-sponsorship-rules', firestore: { host: '127.0.0.1', port: PORT, rules: fs.readFileSync(process.env.FIRESTORE_RULES_FILE || 'firestore.rules', 'utf8') } });
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

test('concurrent webhook retries update the ledger exactly once', async () => {
  const admin = require('firebase-admin');
  const { record } = require('../../../netlify/functions/lib/athleticmind-sponsorship');
  const app = admin.initializeApp({ projectId: 'demo-athleticmind-sponsorship-transactions' }, 'sponsorship-ledger-test');
  const db = app.firestore();
  db.settings({ host: `127.0.0.1:${PORT}`, ssl: false });
  try {
    const id = `pi_${Date.now()}`;
    const payment = { id, campaign: 'general', gross: 5000, refunded: 0, profile: { name: 'Example', school: 'Example School', schoolKey: 'example school', message: 'Synthetic' } };
    await Promise.all(Array.from({ length: 4 }, () => record(db, `${id}_paid`, payment)));
    await Promise.all([record(db, `${id}_partial`, { ...payment, refunded: 1000 }), record(db, `${id}_full`, { ...payment, refunded: 5000 }), record(db, `${id}_late`, payment)]);
    const totals = (await db.collection('athleticmind-sponsorship-test').doc('totals').get()).data();
    require('node:assert/strict').deepEqual(totals, { gross: 5000, refunded: 5000, payments: 1 });
    const schools = await db.collection('athleticmind-sponsorship-test').doc('board').collection('schools').get();
    require('node:assert/strict').equal(schools.docs[0].data().count, 0);
  } finally { await app.delete(); }
});
