const { schedule } = require('@netlify/functions');
const { runScheduledSnapshotBatch } = require('./lib/athleticmind-snapshot-schedule');

exports.handler = schedule('*/15 * * * *', async () => {
  try {
    const result = await runScheduledSnapshotBatch({
      getDb: () => require('./config/firebase').getFirebaseAdminApp({ headers: {} }).firestore(),
    });
    return { statusCode: 200, body: JSON.stringify(result) };
  } catch {
    return { statusCode: 503, body: JSON.stringify({ error: 'snapshot_schedule_unavailable' }) };
  }
});
