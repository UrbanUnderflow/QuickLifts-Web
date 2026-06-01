const { schedule } = require('@netlify/functions');
const { initializeFirebaseAdmin, admin } = require('./config/firebase');
const { CONNECTIONS_COLLECTION } = require('./google-health-utils');
const {
  dateKeyInTimeZone,
  resolveTimeZone,
  shiftDateKey,
  syncGoogleHealthSnapshotForConnection,
} = require('./google-health-sync');

const DEFAULT_LOCAL_HOUR = 3;
const DEFAULT_LIMIT = 100;

function localHourInTimeZone(date, timezone) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: '2-digit',
    hour12: false,
  });
  const hour = Number(formatter.formatToParts(date).find((part) => part.type === 'hour')?.value);
  return Number.isFinite(hour) ? hour : null;
}

async function runScheduledGoogleHealthSync(now = new Date()) {
  const db = admin.firestore();
  const targetLocalHour = Number(process.env.GOOGLE_HEALTH_EOD_SYNC_LOCAL_HOUR || DEFAULT_LOCAL_HOUR);
  const limit = Number(process.env.GOOGLE_HEALTH_EOD_SYNC_LIMIT || DEFAULT_LIMIT);
  const snapshot = await db.collection(CONNECTIONS_COLLECTION)
    .where('provider', '==', 'google_health')
    .where('status', '==', 'connected')
    .limit(Number.isFinite(limit) && limit > 0 ? limit : DEFAULT_LIMIT)
    .get();

  const results = [];
  for (const doc of snapshot.docs) {
    const connection = doc.data() || {};
    const userId = connection.userId || doc.id.replace(/_google_health$/, '');
    const timezone = resolveTimeZone(connection.lastSyncTimezone || connection.timezone || 'UTC');
    const localHour = localHourInTimeZone(now, timezone);
    if (localHour !== targetLocalHour) {
      results.push({ userId, status: 'skipped_time', timezone, localHour });
      continue;
    }

    const todayKey = dateKeyInTimeZone(now, timezone);
    const snapshotDateKey = shiftDateKey(todayKey, -1);
    if (connection.lastEndOfDaySnapshotDateKey === snapshotDateKey) {
      results.push({ userId, status: 'skipped_duplicate', snapshotDateKey, timezone });
      continue;
    }

    try {
      const connectionRef = db.collection(CONNECTIONS_COLLECTION).doc(doc.id);
      const result = await syncGoogleHealthSnapshotForConnection({
        userId,
        timezone,
        requestedDateKey: snapshotDateKey,
        connectionRef,
        connection,
      });
      await connectionRef.set({
        lastEndOfDaySnapshotDateKey: snapshotDateKey,
        lastEndOfDaySyncAt: admin.firestore.FieldValue.serverTimestamp(),
        lastEndOfDaySyncStatus: result.status,
        lastEndOfDaySyncError: '',
      }, { merge: true });
      results.push({ userId, status: result.status, snapshotDateKey, timezone });
    } catch (error) {
      await db.collection(CONNECTIONS_COLLECTION).doc(doc.id).set({
        lastEndOfDaySyncAt: admin.firestore.FieldValue.serverTimestamp(),
        lastEndOfDaySyncStatus: 'error',
        lastEndOfDaySyncError: error?.message || 'Google Health end-of-day sync failed',
      }, { merge: true });
      results.push({ userId, status: 'error', snapshotDateKey, timezone, error: error?.message || String(error) });
      console.warn('[scheduled-google-health-sync] user sync failed', userId, error);
    }
  }

  return {
    processed: results.length,
    synced: results.filter((result) => result.status === 'synced').length,
    waiting: results.filter((result) => result.status === 'waiting_for_data').length,
    skipped: results.filter((result) => String(result.status).startsWith('skipped')).length,
    errors: results.filter((result) => result.status === 'error').length,
    results,
  };
}

exports.handler = schedule('35 * * * *', async (event) => {
  try {
    initializeFirebaseAdmin(event);
    const summary = await runScheduledGoogleHealthSync();
    console.log('[scheduled-google-health-sync] complete', JSON.stringify(summary));
    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, ...summary }),
    };
  } catch (error) {
    console.error('[scheduled-google-health-sync] fatal', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ ok: false, error: error?.message || 'Google Health end-of-day sync failed' }),
    };
  }
});

exports.__test = {
  localHourInTimeZone,
  runScheduledGoogleHealthSync,
};
