const admin = require('firebase-admin');

// Initialize Firebase Admin if not already initialized
if (admin.apps.length === 0) {
  try {
    const projectId = process.env.FIREBASE_PROJECT_ID || 'quicklifts-dd3f1';
    const privateKey = process.env.FIREBASE_SECRET_KEY ? process.env.FIREBASE_SECRET_KEY.replace(/\\n/g, '\n') : '';
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL || 'firebase-adminsdk-1qxb0@quicklifts-dd3f1.iam.gserviceaccount.com';

    if (!privateKey) {
      console.warn('[BackfillSubsUserFields] FIREBASE_SECRET_KEY missing, using fallback app init');
      admin.initializeApp({ projectId });
    } else {
      admin.initializeApp({
        credential: admin.credential.cert({ projectId, privateKey, clientEmail })
      });
    }
  } catch (error) {
    console.error('[BackfillSubsUserFields] Firebase initialization error:', error);
  }
}

const db = admin.firestore();

// Fetch user docs for a set of userIds using batched `in` queries (10 IDs at a time)
async function fetchUsersByIds(userIds) {
  const result = new Map();
  const chunkSize = 10;
  for (let i = 0; i < userIds.length; i += chunkSize) {
    const chunk = userIds.slice(i, i + chunkSize);
    const snap = await db.collection('users')
      .where(admin.firestore.FieldPath.documentId(), 'in', chunk)
      .get();
    snap.docs.forEach(d => result.set(d.id, d.data()));
  }
  return result; // Map<userId, userData>
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ message: 'Method Not Allowed' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (_) {
    return { statusCode: 400, body: JSON.stringify({ message: 'Invalid JSON' }) };
  }

  const limit = typeof body.limit === 'number' && body.limit > 0 ? Math.floor(Math.min(body.limit, 2000)) : 1000;
  const dryRun = Boolean(body.dryRun);

  try {
    // Read subscriptions with missing username or userEmail
    const subsSnap = await db.collection('subscriptions').get();
    const subs = [];
    subsSnap.forEach(d => subs.push({ id: d.id, ...(d.data() || {}) }));

    // Candidate userId is the document ID; if a legacy field userId exists, prefer it for consistency
    const candidates = subs.slice(0, limit).map(s => ({ sub: s, candidateUserId: s.userId || s.id }));

    // Gather userIds we can batch fetch first
    const batchableUserIds = Array.from(new Set(candidates.map(c => c.candidateUserId).filter(Boolean)));
    const userMap = await fetchUsersByIds(batchableUserIds);

    // No further heuristics needed per current data model
    async function resolveUserIdByCustomerId() { return null; }

    // Prepare batched updates (max 500 operations per batch)
    let updated = 0;
    let updatedUserId = 0;
    let skipped = 0;
    let notFound = 0;
    let batch = db.batch();
    let ops = 0;

    for (const { sub, candidateUserId } of candidates) {
      let userId = candidateUserId;
      if (!userId && sub.stripeCustomerId) {
        // try resolve from stripe customer id
        try {
          userId = await resolveUserIdByCustomerId(sub.stripeCustomerId);
        } catch (_) {}
      }

      const user = userId ? userMap.get(userId) : undefined;
      if (!user) {
        notFound++;
        continue;
      }
      const nextData = {};
      if (!sub.userId && userId) { nextData.userId = userId; updatedUserId++; }
      if (!sub.username && user.username) nextData.username = user.username;
      if (!sub.userEmail && user.email) nextData.userEmail = user.email;
      if (Object.keys(nextData).length === 0) {
        skipped++;
        continue;
      }
      if (!dryRun) {
        const ref = db.collection('subscriptions').doc(sub.id);
        batch.update(ref, nextData);
        ops++;
        updated++;
        if (ops >= 450) {
          await batch.commit();
          batch = db.batch();
          ops = 0;
        }
      }
    }

    if (!dryRun && ops > 0) {
      await batch.commit();
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        scanned: subs.length,
        processed: candidates.length,
        uniqueUserIds: batchableUserIds.length,
        updated,
        updatedUserId,
        skipped,
        userNotFound: notFound,
        dryRun
      })
    };
  } catch (error) {
    console.error('[BackfillSubsUserFields] Error:', error);
    return { statusCode: 500, body: JSON.stringify({ message: error.message || 'Server error' }) };
  }
};


