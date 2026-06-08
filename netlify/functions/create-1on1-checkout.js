// Create a Stripe Checkout Session for a ONE-TIME paid 1-on-1 coaching
// room. Funds route to the host trainer's connected account via a
// destination charge (transfer_data + 3% application fee), mirroring the
// paid-Round flow in create-payment-intent.js / create-round-checkout.js.
//
// The price, host, and connected account are all resolved server-side
// from the `one-on-one-trainings/{trainingId}` doc — the client never
// supplies the amount.

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

    // Load the training doc — source of truth for price + host.
    const trainingSnap = await db.collection('one-on-one-trainings').doc(trainingId).get();
    if (!trainingSnap.exists) {
      return { statusCode: 404, headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ error: 'Training not found' }) };
    }
    const training = trainingSnap.data() || {};
    const pricing = training.pricing || {};

    if (pricing.mode !== 'oneTime') {
      return { statusCode: 400, headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ error: 'Training is not a one-time paid room' }) };
    }
    const amount = Number(pricing.amountCents || 0);
    if (!amount || amount < 50) {
      return { statusCode: 400, headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ error: 'Invalid price' }) };
    }
    const currency = (pricing.currency || 'USD').toLowerCase();
    const hostId = training.hostId;
    if (!hostId) {
      return { statusCode: 400, headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ error: 'Training has no host' }) };
    }

    // Resolve the host's connected Stripe account.
    const hostSnap = await db.collection('users').doc(hostId).get();
    const connectedAccountId = hostSnap.exists ? hostSnap.data()?.creator?.stripeAccountId : null;
    if (!connectedAccountId) {
      return { statusCode: 400, headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ error: 'Coach has not connected a Stripe account' }) };
    }

    const stripe = getStripeClient(event);
    const platformFee = Math.round(amount * 0.03);
    const origin = siteOrigin(event);
    const coachName = training.hostInfo?.username || 'your coach';

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      client_reference_id: buyerId,
      customer_email: buyerEmail || undefined,
      success_url: `${origin}/coaching/${trainingId}?status=success`,
      cancel_url: `${origin}/coaching/${trainingId}?status=cancelled`,
      line_items: [
        {
          price_data: {
            currency,
            product_data: { name: `1-on-1 Coaching with ${coachName}` },
            unit_amount: amount
          },
          quantity: 1
        }
      ],
      payment_intent_data: {
        transfer_data: { destination: connectedAccountId },
        application_fee_amount: platformFee,
        metadata: {
          platform: 'pulse',
          trainingId,
          buyerId,
          hostId,
          payment_type: 'coaching_purchase',
          tax_classification: 'service_income'
        }
      },
      metadata: {
        platform: 'pulse',
        trainingId,
        buyerId,
        hostId,
        payment_type: 'coaching_purchase'
      }
    });

    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ success: true, url: session.url })
    };
  } catch (error) {
    console.error('[create-1on1-checkout] Error:', error);
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: error.message || 'Server error' })
    };
  }
};
