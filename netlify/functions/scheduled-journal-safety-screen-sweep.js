const { schedule } = require('@netlify/functions');
const { initializeFirebaseAdmin, admin } = require('./config/firebase');
const { screenJournalEntry } = require('./journal-safety-screen');

// Finishes journal screenings that did not complete during the save, for example when the classifier was down
// or the save request timed out. screenJournalEntry claims each entry, so an overlapping run never screens twice.
exports.handler = schedule('*/5 * * * *', async (event) => {
  initializeFirebaseAdmin(event);
  const db = admin.firestore();
  const snapshot = await db.collectionGroup('screenings').where('status', 'in', ['pending', 'running']).limit(50).get();
  const results = [];
  for (const doc of snapshot.docs) {
    const userId = doc.ref.parent.parent?.id;
    if (!userId || doc.ref.parent.parent.parent.id !== 'pulsecheck-evidence-journals') continue;
    const result = await screenJournalEntry({ db, userId, entryId: doc.id, messaging: admin.messaging() });
    results.push({ status: result?.status || 'unknown' });
  }
  console.log('[journal-safety-screen-sweep]', JSON.stringify({ checked: snapshot.size, results }));
  return { statusCode: 200, body: JSON.stringify({ checked: snapshot.size }) };
});
