const admin = require('firebase-admin');
const Stripe = require('stripe');

// Initialize Firebase Admin if not already initialized
if (admin.apps.length === 0) {
  try {
    const projectId = process.env.FIREBASE_PROJECT_ID || 'quicklifts-dd3f1';
    const privateKey = process.env.FIREBASE_SECRET_KEY ? process.env.FIREBASE_SECRET_KEY.replace(/\\n/g, '\n') : '';
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL || 'firebase-adminsdk-1qxb0@quicklifts-dd3f1.iam.gserviceaccount.com';

    if (!privateKey) {
      console.warn('[CreateRoundCheckout] FIREBASE_SECRET_KEY missing, using fallback app init');
      admin.initializeApp({ projectId });
    } else {
      admin.initializeApp({
        credential: admin.credential.cert({ projectId, privateKey, clientEmail })
      });
    }
  } catch (error) {
    console.error('[CreateRoundCheckout] Firebase initialization error:', error);
  }
}

const db = admin.firestore();

function isLocalhost(event) {
  const referer = event.headers?.referer || event.headers?.origin || '';
  return referer.includes('localhost') || referer.includes('127.0.0.1');
}

function getStripeClient(event) {
  const key = isLocalhost(event) ? process.env.STRIPE_TEST_SECRET_KEY : process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('Missing Stripe secret key');
  return new Stripe(key);
}

// Shared monthly price IDs (keep in sync with subscribe.tsx)
const LIVE_MONTHLY_PRICE_ID = 'price_1PDq26RobSf56MUOucDIKLhd';
const TEST_MONTHLY_PRICE_ID = 'price_1RMIUNRobSf56MUOfeB4gIot';

function getMonthlyPriceId(event) {
  return isLocalhost(event) ? TEST_MONTHLY_PRICE_ID : LIVE_MONTHLY_PRICE_ID;
}

function latestExpirationFromDoc(doc) {
  const values = [];
  const expirationHistory = doc?.expirationHistory || [];
  if (Array.isArray(expirationHistory)) {
    for (const v of expirationHistory) {
      const num = typeof v === 'string' ? parseFloat(v) : v;
      if (typeof num === 'number') values.push(num < 10000000000 ? num * 1000 : num);
    }
  }
  if (doc?.trialEndDate != null) {
    const n = typeof doc.trialEndDate === 'string' ? parseFloat(doc.trialEndDate) : doc.trialEndDate;
    if (typeof n === 'number') values.push(n < 10000000000 ? n * 1000 : n);
  }
  if (values.length === 0) return null;
  return new Date(Math.max(...values));
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

  const { userId, roundId, coachId, roundPriceId, roundAmount, roundName, successUrl, cancelUrl } = body;
  if (!userId || !roundId || (!roundPriceId && !roundAmount)) {
    return { statusCode: 400, body: JSON.stringify({ message: 'Missing required parameters' }) };
  }

  try {
    const stripe = getStripeClient(event);

    // Resolve or create Stripe customer
    let stripeCustomerId = null;
    try {
      const userSnap = await db.collection('users').doc(userId).get();
      if (userSnap.exists) {
        const data = userSnap.data() || {};
        stripeCustomerId = data.stripeCustomerId || null;
      }
    } catch (_) {}

    // Determine subscription status from subscriptions/{userId}
    let isActive = false;
    try {
      const subSnap = await db.collection('subscriptions').doc(userId).get();
      if (subSnap.exists) {
        const subData = subSnap.data() || {};
        const latest = latestExpirationFromDoc(subData);
        if (latest && latest > new Date()) isActive = true;
      }
    } catch (_) {}

    // Prepare line items for the round fee
    // We prefer price_data so we can attach a description when subscription is active
    const makeRoundLine = (opts = {}) => ({
      price_data: {
        currency: 'usd',
        product_data: {
          name: roundName || 'Round Access',
          ...(opts.description ? { description: opts.description } : {})
        },
        unit_amount: roundPriceId ? undefined : Math.round(Number(roundAmount) * 100)
      },
      ...(roundPriceId ? { price: roundPriceId } : {}),
      quantity: 1
    });

    // If active, we still want to show subscription status on the page, but no charge.
    // Stripe does not allow $0 line items, so we use custom_text to display it.
    if (isActive) {
      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        customer: stripeCustomerId || undefined,
        client_reference_id: userId,
        success_url: successUrl || 'https://fitwithpulse.ai/subscription-success',
        cancel_url: cancelUrl || 'https://fitwithpulse.ai/subscription-error',
        metadata: { userId, roundId, coachId: coachId || '' },
        line_items: [
          makeRoundLine({ description: 'Pulse Subscription: Active (no additional charge)' })
        ],
        allow_promotion_codes: true
      });

      return { statusCode: 200, body: JSON.stringify({ url: session.url }) };
    }

    // If inactive/unknown, create a subscription checkout that includes monthly subscription
    const monthlyPriceId = getMonthlyPriceId(event);

    // For mode=subscription, include the recurring item + a one-time fee item if supported.
    // Stripe supports both recurring and one-time prices together in subscription mode.
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: stripeCustomerId || undefined,
      client_reference_id: userId,
      success_url: successUrl || 'https://fitwithpulse.ai/subscription-success',
      cancel_url: cancelUrl || 'https://fitwithpulse.ai/subscription-error',
      metadata: { userId, roundId, coachId: coachId || '' },
      line_items: [
        { price: monthlyPriceId, quantity: 1 },
        makeRoundLine()
      ],
      allow_promotion_codes: true,
      subscription_data: {
        metadata: { userId, roundId }
      },
      custom_text: {
        submit: {
          message: 'Includes Round Access (one-time) + Pulse Subscription (monthly)'
        }
      }
    });

    return { statusCode: 200, body: JSON.stringify({ url: session.url }) };
  } catch (error) {
    console.error('[CreateRoundCheckout] Error:', error);
    return { statusCode: 500, body: JSON.stringify({ message: error.message || 'Server error' }) };
  }
};


