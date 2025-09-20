const Stripe = require('stripe');
const admin = require('firebase-admin');

// Initialize Firebase Admin if not already initialized
if (admin.apps.length === 0) {
  try {
    const projectId = process.env.FIREBASE_PROJECT_ID || 'quicklifts-dd3f1';
    const privateKey = process.env.FIREBASE_SECRET_KEY ? process.env.FIREBASE_SECRET_KEY.replace(/\\n/g, '\n') : '';
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL || 'firebase-adminsdk-1qxb0@quicklifts-dd3f1.iam.gserviceaccount.com';

    if (!privateKey) {
      console.warn('[SyncStripe] FIREBASE_SECRET_KEY missing, using fallback app init');
      admin.initializeApp({ projectId });
    } else {
      admin.initializeApp({
        credential: admin.credential.cert({ projectId, privateKey, clientEmail })
      });
    }
  } catch (error) {
    console.error('[SyncStripe] Firebase initialization error:', error);
  }
}

const db = admin.firestore();

function isLocalhostRequest(event) {
  const referer = event.headers?.referer || event.headers?.origin || '';
  return referer.includes('localhost') || referer.includes('127.0.0.1');
}

async function getStripeClient(event) {
  const key = isLocalhostRequest(event) ? process.env.STRIPE_TEST_SECRET_KEY : process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('Missing Stripe secret key');
  return new Stripe(key);
}

function mapPriceIdToSubscriptionType(priceId) {
  const LIVE_MONTHLY_PRICE_ID = 'price_1PDq26RobSf56MUOucDIKLhd';
  const LIVE_ANNUAL_PRICE_ID = 'price_1PDq3LRobSf56MUOng0UxhCC';
  const TEST_MONTHLY_PRICE_ID = 'price_1RMIUNRobSf56MUOfeB4gIot';
  const TEST_ANNUAL_PRICE_ID = 'price_1RMISFRobSf56MUOpcSoohjP';
  const map = {
    [LIVE_MONTHLY_PRICE_ID]: 'Monthly Subscriber',
    [LIVE_ANNUAL_PRICE_ID]: 'Annual Subscriber',
    [TEST_MONTHLY_PRICE_ID]: 'Monthly Subscriber',
    [TEST_ANNUAL_PRICE_ID]: 'Annual Subscriber',
  };
  return map[priceId] || undefined;
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

  const { userId, stripeCustomerId: bodyCustomerId } = body;
  if (!userId && !bodyCustomerId) {
    return { statusCode: 400, body: JSON.stringify({ message: 'Provide userId or stripeCustomerId' }) };
  }

  try {
    const stripe = await getStripeClient(event);

    // Resolve stripeCustomerId
    let stripeCustomerId = bodyCustomerId;
    let username = null;
    let userEmail = null;
    if (userId && !stripeCustomerId) {
      const userSnap = await db.collection('users').doc(userId).get();
      if (userSnap.exists) {
        const ud = userSnap.data();
        stripeCustomerId = ud?.stripeCustomerId || null;
        username = ud?.username || null;
        userEmail = ud?.email || null;
      }
    }

    if (!stripeCustomerId) {
      return { statusCode: 200, body: JSON.stringify({ message: 'No stripeCustomerId on user', userId }) };
    }

    // List subscriptions for customer
    const subsRes = await stripe.subscriptions.list({ customer: stripeCustomerId, limit: 100 });
    const subs = subsRes.data || [];
    if (subs.length === 0) {
      return { statusCode: 200, body: JSON.stringify({ message: 'No Stripe subscriptions found', userId, stripeCustomerId }) };
    }

    // Compute latest current_period_end and status
    let latestEnd = null;
    let latestStatus = 'inactive';
    let mappedType;
    for (const s of subs) {
      const end = s.current_period_end ? new Date(s.current_period_end * 1000) : null;
      if (end && (!latestEnd || end > latestEnd)) {
        latestEnd = end;
        latestStatus = s.status || latestStatus;
        mappedType = mapPriceIdToSubscriptionType(s.items?.data?.[0]?.price?.id);
      }
    }

    const subRef = db.collection('subscriptions').doc(userId || subs[0].customer);
    await subRef.set({
      userId: userId || null,
      username,
      userEmail,
      platform: 'web',
      source: 'stripe-sync',
      stripeCustomerId,
      subscriptionType: mappedType,
      status: latestStatus,
      updatedAt: new Date(),
    }, { merge: true });

    if (latestEnd) {
      await subRef.update({
        expirationHistory: admin.firestore.FieldValue.arrayUnion(latestEnd)
      });
    }

    return { statusCode: 200, body: JSON.stringify({ message: 'Synced', latestEnd, latestStatus, mappedType }) };
  } catch (error) {
    console.error('[SyncStripe] Error:', error);
    return { statusCode: 500, body: JSON.stringify({ message: error.message || 'Server error' }) };
  }
};


