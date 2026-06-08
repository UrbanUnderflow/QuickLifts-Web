// Create a Stripe Checkout Session for a RECURRING (auto-pay) paid
// 1-on-1 coaching room. This is the first Pulse subscription routed to a
// connected account: subscription_data.transfer_data.destination sends
// each invoice to the host's connected account, minus a 3% application
// fee (application_fee_percent). The price (amount + interval) and host
// are resolved server-side from the training doc.

const { admin } = require('./config/firebase');
const Stripe = require('stripe');

const db = admin.firestore();

function isLocalhost(event) {
  const referer = event.headers?.referer || event.headers?.origin || '';
  return referer.includes('localhost') || referer.includes('127.0.0.1');
}

function getStripeClient(event) {
  const key = isLocalhost(event) ? process.env.STRIPE_TEST_SECRET_KEY : process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('Missing Stripe secret key');
  return new Stripe(key, { apiVersion: '2023-10-16' });
}

function siteOrigin(event) {
  const origin = event.headers?.origin || event.headers?.referer || '';
  if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
    return 'http://localhost:8888';
  }
  return process.env.SITE_URL || 'https://fitwithpulse.ai';
}

const VALID_INTERVALS = { week: 'week', month: 'month', year: 'year' };

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      }
    };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { trainingId, buyerId, buyerEmail } = JSON.parse(event.body || '{}');
    if (!trainingId || !buyerId) {
      return { statusCode: 400, headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ error: 'Missing trainingId or buyerId' }) };
    }

    const trainingSnap = await db.collection('one-on-one-trainings').doc(trainingId).get();
    if (!trainingSnap.exists) {
      return { statusCode: 404, headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ error: 'Training not found' }) };
    }
    const training = trainingSnap.data() || {};
    const pricing = training.pricing || {};

    if (pricing.mode !== 'recurring') {
      return { statusCode: 400, headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ error: 'Training is not a recurring paid room' }) };
    }
    const amount = Number(pricing.amountCents || 0);
    if (!amount || amount < 50) {
      return { statusCode: 400, headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ error: 'Invalid price' }) };
    }
    const interval = VALID_INTERVALS[pricing.interval || 'month'] || 'month';
    const currency = (pricing.currency || 'USD').toLowerCase();
    const hostId = training.hostId;
    if (!hostId) {
      return { statusCode: 400, headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ error: 'Training has no host' }) };
    }

    const hostSnap = await db.collection('users').doc(hostId).get();
    const connectedAccountId = hostSnap.exists ? hostSnap.data()?.creator?.stripeAccountId : null;
    if (!connectedAccountId) {
      return { statusCode: 400, headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ error: 'Coach has not connected a Stripe account' }) };
    }

    const stripe = getStripeClient(event);
    const origin = siteOrigin(event);
    const coachName = training.hostInfo?.username || 'your coach';

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      client_reference_id: buyerId,
      customer_email: buyerEmail || undefined,
      success_url: `${origin}/coaching/${trainingId}?status=success`,
      cancel_url: `${origin}/coaching/${trainingId}?status=cancelled`,
      line_items: [
        {
          price_data: {
            currency,
            recurring: { interval },
            product_data: { name: `1-on-1 Coaching with ${coachName}` },
            unit_amount: amount
          },
          quantity: 1
        }
      ],
      subscription_data: {
        // Route every invoice to the coach's connected account, less 3%.
        transfer_data: { destination: connectedAccountId },
        application_fee_percent: 3,
        metadata: {
          platform: 'pulse',
          trainingId,
          buyerId,
          hostId,
          payment_type: 'coaching_subscription'
        }
      },
      metadata: {
        platform: 'pulse',
        trainingId,
        buyerId,
        hostId,
        payment_type: 'coaching_subscription'
      }
    });

    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ success: true, url: session.url })
    };
  } catch (error) {
    console.error('[create-1on1-subscription-checkout] Error:', error);
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: error.message || 'Server error' })
    };
  }
};
