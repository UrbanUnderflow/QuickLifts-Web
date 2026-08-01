const Stripe = require('stripe');
const { headers, getFirebaseAdminApp } = require('./config/firebase');
const { getSecretWithEnvFallback } = require('./google-secret-manager-utils');
const {
  assertPaymentIntentCanFulfillOrder,
  assertPaymentIntentMatchesOrder,
  loadValidatedOrderForAthlete,
  markOrderPaid,
  normalizeString,
  verifyFirebaseUser,
} = require('./lib/pulsecheck-coach-services');

const jsonHeaders = {
  ...headers,
  'Content-Type': 'application/json',
  'Cache-Control': 'private, no-store',
};

const stripeClient = async (order = {}) => {
  const orderMode = normalizeString(order.stripeMode).toLowerCase();
  if (orderMode !== 'test' && orderMode !== 'live') {
    const error = new Error('This service order has an invalid Stripe mode.');
    error.statusCode = 409;
    throw error;
  }
  const stripeMode = orderMode;
  const secretName = stripeMode === 'test' ? 'STRIPE_TEST_SECRET_KEY' : 'STRIPE_SECRET_KEY';
  const key = await getSecretWithEnvFallback(secretName).catch((error) => {
    const message = stripeMode === 'test'
      ? 'Stripe test checkout is not configured. Add STRIPE_TEST_SECRET_KEY to Google Secret Manager or use live Stripe mode.'
      : 'Stripe live checkout is not configured. Add STRIPE_SECRET_KEY to Google Secret Manager.';
    const wrapped = new Error(`${message} ${error.message || ''}`.trim());
    wrapped.statusCode = 503;
    throw wrapped;
  });
  if (!key) {
    const error = new Error(
      stripeMode === 'test'
        ? 'Stripe test checkout is not configured. Add STRIPE_TEST_SECRET_KEY to Google Secret Manager or use live Stripe mode.'
        : 'Stripe live checkout is not configured. Add STRIPE_SECRET_KEY to Google Secret Manager.'
    );
    error.statusCode = 503;
    throw error;
  }
  return new Stripe(key, { apiVersion: '2023-10-16' });
};

const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: jsonHeaders, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: jsonHeaders,
      body: JSON.stringify({ message: 'Method Not Allowed' }),
    };
  }

  try {
    const database = getFirebaseAdminApp(event).firestore();
    const { userId } = await verifyFirebaseUser(event);
    const { orderId } = JSON.parse(event.body || '{}');
    const { order } = await loadValidatedOrderForAthlete({
      orderId,
      athleteUserId: userId,
      database,
    });

    const paymentIntentId = normalizeString(order.paymentIntentId);
    if (!paymentIntentId) {
      const error = new Error('This service order has no Stripe payment.');
      error.statusCode = 409;
      throw error;
    }
    const stripe = await stripeClient(order);
    const paymentIntent = await stripe.paymentIntents.retrieve(
      paymentIntentId,
      { expand: ['latest_charge'] }
    );
    if (normalizeString(paymentIntent.status).toLowerCase() !== 'succeeded') {
      const error = new Error('Stripe has not confirmed this payment yet.');
      error.statusCode = 409;
      throw error;
    }
    assertPaymentIntentMatchesOrder(
      paymentIntent,
      order,
      { requireSucceeded: true }
    );
    assertPaymentIntentCanFulfillOrder(paymentIntent);

    await markOrderPaid({
      paymentIntent,
      source: 'athlete-confirmation',
      database,
    });
    return {
      statusCode: 200,
      headers: jsonHeaders,
      body: JSON.stringify({ success: true, orderId, status: 'paid' }),
    };
  } catch (error) {
    const statusCode = Number(error.statusCode) || 500;
    if (statusCode >= 500) {
      console.error('[ConfirmPulseCheckCoachServicePayment] Failed:', error);
    }
    return {
      statusCode,
      headers: jsonHeaders,
      body: JSON.stringify({ message: error.message || 'Payment could not be verified.' }),
    };
  }
};

module.exports = { handler, stripeClient };
