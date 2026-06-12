import { Handler } from '@netlify/functions';
import { admin, db, headers as corsHeaders } from './config/firebase';

// ---------------------------------------------------------------------------
// delete-account
//
// In-app account deletion (App Review 5.1.1(v)). The caller proves identity
// with their Firebase ID token; deletion is performed server-side because
// security rules (correctly) forbid clients from deleting user docs.
//
// This deletes the SHARED Pulse account:
//   1. users/{uid} doc + ALL subcollections (recursive)
//   2. FWP top-level data keyed by userId (workout sessions)
//   3. the Firebase Auth user
//
// Irreversible. The client is responsible for honest warning copy.
// ---------------------------------------------------------------------------

const USER_KEYED_COLLECTIONS = ['fitWithPulse-workoutSessions'];

const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: corsHeaders, body: '' };
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ error: 'POST only' }) };
  }

  const authHeader = event.headers.authorization || event.headers.Authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token) {
    return { statusCode: 401, headers: corsHeaders, body: JSON.stringify({ error: 'Missing token' }) };
  }

  let uid: string;
  try {
    uid = (await admin.auth().verifyIdToken(token)).uid;
  } catch {
    return { statusCode: 401, headers: corsHeaders, body: JSON.stringify({ error: 'Invalid token' }) };
  }

  try {
    // 1. User doc + every subcollection (follows, weight, movePrefs, rotation…).
    await db.recursiveDelete(db.collection('users').doc(uid));

    // 2. Top-level docs keyed by userId.
    for (const collection of USER_KEYED_COLLECTIONS) {
      const snapshot = await db.collection(collection).where('userId', '==', uid).get();
      const batchSize = 400;
      const docs = snapshot.docs;
      for (let i = 0; i < docs.length; i += batchSize) {
        const batch = db.batch();
        docs.slice(i, i + batchSize).forEach((doc) => batch.delete(doc.ref));
        await batch.commit();
      }
    }

    // 3. The auth user — last, so a partial failure leaves a retryable account.
    await admin.auth().deleteUser(uid);

    console.log(`[delete-account] deleted account ${uid}`);
    return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ deleted: true }) };
  } catch (error) {
    console.error(`[delete-account] failed for ${uid}:`, error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Deletion failed — contact support@fitwithpulse.ai' }),
    };
  }
};

export { handler };
