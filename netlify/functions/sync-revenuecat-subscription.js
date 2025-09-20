const admin = require('firebase-admin');

// Initialize Firebase Admin if not already initialized
if (admin.apps.length === 0) {
  try {
    const projectId = process.env.FIREBASE_PROJECT_ID || 'quicklifts-dd3f1';
    const privateKey = process.env.FIREBASE_SECRET_KEY ? process.env.FIREBASE_SECRET_KEY.replace(/\\n/g, '\n') : '';
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL || 'firebase-adminsdk-1qxb0@quicklifts-dd3f1.iam.gserviceaccount.com';

    if (!privateKey) {
      console.warn('[SyncRevenueCat] FIREBASE_SECRET_KEY missing, using fallback app init');
      admin.initializeApp({ projectId });
    } else {
      admin.initializeApp({
        credential: admin.credential.cert({ projectId, privateKey, clientEmail })
      });
    }
  } catch (error) {
    console.error('[SyncRevenueCat] Firebase initialization error:', error);
  }
}

const db = admin.firestore();

async function fetchRevenueCatSubscriber(userId) {
  const apiKey = process.env.REVENUECAT_API_KEY;
  if (!apiKey) throw new Error('Missing REVENUECAT_API_KEY');

  const res = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(userId)}`, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Accept': 'application/json'
    }
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`RevenueCat error ${res.status}: ${text}`);
  }
  return await res.json();
}

function parseLatestExpiration(rcJson) {
  let latest = null;
  try {
    const entitlements = rcJson?.subscriber?.entitlements || {};
    for (const key of Object.keys(entitlements)) {
      const exp = entitlements[key]?.expires_date; // RFC3339 string
      if (exp) {
        const d = new Date(exp);
        if (!isNaN(d)) {
          if (!latest || d > latest) latest = d;
        }
      }
    }
    // Fallback: scan subscriptions map
    const subs = rcJson?.subscriber?.subscriptions || {};
    for (const key of Object.keys(subs)) {
      const exp = subs[key]?.expires_date;
      if (exp) {
        const d = new Date(exp);
        if (!isNaN(d)) {
          if (!latest || d > latest) latest = d;
        }
      }
    }
  } catch (e) {
    console.warn('[SyncRevenueCat] parseLatestExpiration error:', e);
  }
  return latest;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ message: 'Method Not Allowed' }) };
  }
  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ message: 'Invalid JSON' }) };
  }

  const { userId } = body;
  if (!userId) {
    return { statusCode: 400, body: JSON.stringify({ message: 'Missing userId' }) };
  }

  try {
    const rc = await fetchRevenueCatSubscriber(userId);
    const latestExpiration = parseLatestExpiration(rc);
    if (!latestExpiration) {
      return { statusCode: 200, body: JSON.stringify({ message: 'No expiration found' }) };
    }

    // Upsert iOS subscription doc for this user and append expirationHistory
    // Use userId as the subscription document ID
    const subRef = db.collection('subscriptions').doc(userId);
    // Read user for denormalized fields
    let userEmail = null;
    let username = null;
    try {
      const userSnap = await db.collection('users').doc(userId).get();
      if (userSnap.exists) {
        const ud = userSnap.data();
        userEmail = ud?.email || null;
        username = ud?.username || null;
      }
    } catch (_) {}
    await subRef.set({
      userId,
      userEmail,
      username,
      platform: 'ios',
      source: 'revenuecat',
      updatedAt: new Date(),
    }, { merge: true });

    await subRef.update({
      expirationHistory: admin.firestore.FieldValue.arrayUnion(latestExpiration)
    });

    return { statusCode: 200, body: JSON.stringify({ message: 'Synced', latestExpiration }) };
  } catch (error) {
    console.error('[SyncRevenueCat] Error:', error);
    return { statusCode: 500, body: JSON.stringify({ message: error.message || 'Server error' }) };
  }
};


