const Stripe = require('stripe');
const admin = require('firebase-admin');

if (admin.apps.length === 0) {
  try {
    const projectId = process.env.FIREBASE_PROJECT_ID || 'quicklifts-dd3f1';
    const privateKey = process.env.FIREBASE_SECRET_KEY ? process.env.FIREBASE_SECRET_KEY.replace(/\\n/g, '\n') : '';
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL || 'firebase-adminsdk-1qxb0@quicklifts-dd3f1.iam.gserviceaccount.com';

    if (!privateKey) {
      console.warn('[MigrateExpHistory] FIREBASE_SECRET_KEY missing, using fallback app init');
      admin.initializeApp({ projectId });
    } else {
      admin.initializeApp({
        credential: admin.credential.cert({ projectId, privateKey, clientEmail })
      });
    }
  } catch (error) {
    console.error('[MigrateExpHistory] Firebase initialization error:', error);
  }
}

const db = admin.firestore();

async function getStripeClient(event) {
  const isLocal = (event.headers.referer || event.headers.origin || '').includes('localhost');
  const key = isLocal ? process.env.STRIPE_TEST_SECRET_KEY : process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('Missing STRIPE secret key');
  return new Stripe(key);
}

async function listAllCustomerSubscriptions(stripe, customerId) {
  const subs = [];
  let startingAfter = undefined;
  while (true) {
    const res = await stripe.subscriptions.list({ customer: customerId, limit: 100, starting_after: startingAfter });
    subs.push(...res.data);
    if (!res.has_more) break;
    startingAfter = res.data[res.data.length - 1].id;
  }
  return subs;
}

async function migrateForUser(stripe, userId) {
  // get stripeCustomerId from users
  const userSnap = await db.collection('users').doc(userId).get();
  if (!userSnap.exists) return { userId, migrated: 0 };
  const userData = userSnap.data() || {};
  const customerId = userData.stripeCustomerId;
  if (!customerId) return { userId, migrated: 0 };

  const subscriptions = await listAllCustomerSubscriptions(stripe, customerId);
  let migrated = 0;
  for (const sub of subscriptions) {
    // Store under userId to standardize
    const docId = userId;
    const subRef = db.collection('subscriptions').doc(docId);
    await subRef.set({
      userId,
      userEmail: userData.email || null,
      username: userData.username || null,
      platform: 'web',
      stripeSubscriptionId: docId,
      stripeCustomerId: customerId,
      source: 'stripe-migration',
      updatedAt: new Date(),
    }, { merge: true });

    // collect historical period ends from invoices
    const invoices = await stripe.invoices.list({ subscription: sub.id, limit: 100 });
    const expirations = [];
    for (const inv of invoices.data) {
      const end = inv.lines?.data?.[0]?.period?.end;
      if (end) expirations.push(new Date(end * 1000));
    }
    // also include current_period_end
    if (sub.current_period_end) expirations.push(new Date(sub.current_period_end * 1000));

    if (expirations.length > 0) {
      await subRef.update({
        expirationHistory: admin.firestore.FieldValue.arrayUnion(...expirations)
      });
      migrated += expirations.length;
    }
  }
  return { userId, migrated };
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

  const { userId } = body; // optional; if missing, migrate all users with stripeCustomerId

  try {
    const stripe = await getStripeClient(event);
    if (userId) {
      const result = await migrateForUser(stripe, userId);
      return { statusCode: 200, body: JSON.stringify({ result }) };
    }

    // migrate all users with stripeCustomerId (paged)
    const results = [];
    const usersRef = db.collection('users');
    const snap = await usersRef.get();
    let count = 0;
    for (const doc of snap.docs) {
      const customerId = doc.data().stripeCustomerId;
      if (!customerId) continue;
      const r = await migrateForUser(stripe, doc.id);
      results.push(r);
      count++;
      // Avoid exceeding execution time; limit to first 100 users per run
      if (count >= 100) break;
    }
    return { statusCode: 200, body: JSON.stringify({ migratedUsers: results.length, results }) };
  } catch (error) {
    console.error('[MigrateExpHistory] Error:', error);
    return { statusCode: 500, body: JSON.stringify({ message: error.message || 'Server error' }) };
  }
};


