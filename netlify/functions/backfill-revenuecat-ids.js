const admin = require('firebase-admin');
const { parse } = require('csv-parse/sync');

if (admin.apps.length === 0) {
  try {
    const projectId = process.env.FIREBASE_PROJECT_ID || 'quicklifts-dd3f1';
    const privateKey = process.env.FIREBASE_SECRET_KEY ? process.env.FIREBASE_SECRET_KEY.replace(/\\n/g, '\n') : '';
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL || 'firebase-adminsdk-1qxb0@quicklifts-dd3f1.iam.gserviceaccount.com';
    if (!privateKey) {
      admin.initializeApp({ projectId });
    } else {
      admin.initializeApp({ credential: admin.credential.cert({ projectId, privateKey, clientEmail }) });
    }
  } catch (e) {
    console.error('[BackfillRC] Firebase init error', e);
  }
}

const db = admin.firestore();

async function syncUser(userId) {
  try {
    await fetch('/.netlify/functions/sync-revenuecat-subscription', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId }) });
    await fetch('/.netlify/functions/migrate-expiration-history', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId }) });
  } catch (_) {}
}

function normalizeEntries(body) {
  if (Array.isArray(body?.entries)) return body.entries;
  if (typeof body?.csv === 'string' && body.csv.trim()) {
    const records = parse(body.csv, { columns: true, skip_empty_lines: true, trim: true });
    return records.map(r => ({
      userId: r.userId || r.uid || r.firebase_uid || r.id,
      rcAppUserId: r.rcAppUserId || r.appUserId || r.revenuecat_id || r.rc_id,
      email: r.email || r.rcEmail,
      username: r.username || r.handle
    })).filter(x => x.userId && x.rcAppUserId);
  }
  if (Array.isArray(body)) return body;
  return [];
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
  let body = {};
  try { body = JSON.parse(event.body || '{}'); } catch { return { statusCode: 400, body: 'Invalid JSON' }; }

  const entries = normalizeEntries(body);
  if (!entries.length) return { statusCode: 400, body: 'Provide entries[] or csv with headers: userId,rcAppUserId,(email),(username)' };

  const results = [];
  for (const e of entries) {
    try {
      const userRef = db.collection('users').doc(e.userId);
      await userRef.set({
        revenuecat: {
          appUserId: e.rcAppUserId,
          aliases: admin.firestore.FieldValue.arrayUnion(e.rcAppUserId),
          email: e.email || null,
          lastSyncedAt: admin.firestore.FieldValue.serverTimestamp()
        }
      }, { merge: true });

      const subRef = db.collection('subscriptions').doc(e.userId);
      await subRef.set({ userId: e.userId, platform: 'ios', source: 'revenuecat', rcAppUserId: e.rcAppUserId, rcAliases: admin.firestore.FieldValue.arrayUnion(e.rcAppUserId), updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });

      await syncUser(e.userId);
      results.push({ userId: e.userId, ok: true });
    } catch (err) {
      console.error('[BackfillRC] error', e.userId, err?.message);
      results.push({ userId: e.userId, ok: false, error: err?.message });
    }
  }

  return { statusCode: 200, body: JSON.stringify({ success: true, processed: results.length, results }) };
};
