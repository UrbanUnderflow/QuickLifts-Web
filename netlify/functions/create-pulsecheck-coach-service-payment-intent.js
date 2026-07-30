const Stripe = require('stripe');
const { admin, headers, getFirebaseAdminApp } = require('./config/firebase');
const { getSecretWithEnvFallback } = require('./google-secret-manager-utils');
const {
  loadService,
  loadConversationForAthlete,
  normalizeString,
  orderRef,
  resolveCoachStripeAccount,
  servicePricingBreakdown,
  verifyFirebaseUser,
} = require('./lib/pulsecheck-coach-services');

const jsonHeaders = {
  ...headers,
  'Content-Type': 'application/json',
  'Cache-Control': 'private, no-store',
};

const STRIPE_PUBLISHABLE_KEY_LIVE =
  'pk_live_51Sd8YLIkArZc741WXCIF0xMlq4OUccnkkSsoJ3MqY9Wiu0xsAqRZeHdxijRnOa050a2k8WwqtVi6EsyhPZ6lfS5w00l9L49dzX';
const STRIPE_PUBLISHABLE_KEY_TEST =
  'pk_test_51Sd8YLIkArZc741WNSWroMed1dRRfjfA2bQBniDTFsiEiVKtbxGU5IhpR5u2HimyiR9OHqgvxgHFFrMjqxFl7YUC00WpY2G0dn';

const stripeTestMode = (event) => {
  const explicitMode =
    event.headers?.['x-pulsecheck-stripe-mode']
    || event.headers?.['X-PulseCheck-Stripe-Mode'];
  const normalizedMode = normalizeString(explicitMode).toLowerCase();
  if (normalizedMode === 'test') return true;
  if (normalizedMode === 'live') return false;

  const referer = event.headers?.referer || event.headers?.origin || '';
  return referer.includes('localhost') || referer.includes('127.0.0.1');
};

const stripeConfiguration = async (event) => {
  const testMode = stripeTestMode(event);
  const secretName = testMode ? 'STRIPE_TEST_SECRET_KEY' : 'STRIPE_SECRET_KEY';
  const secretKey = await getSecretWithEnvFallback(secretName).catch((error) => {
    const message = testMode
      ? 'Stripe test checkout is not configured. Add STRIPE_TEST_SECRET_KEY to Google Secret Manager or use live Stripe mode.'
      : 'Stripe live checkout is not configured. Add STRIPE_SECRET_KEY to Google Secret Manager.';
    const wrapped = new Error(`${message} ${error.message || ''}`.trim());
    wrapped.statusCode = 503;
    throw wrapped;
  });
  const publishableKey = testMode
    ? process.env.NEXT_PUBLIC_TEST_STRIPE_PUBLISHABLE_KEY
      || process.env.STRIPE_TEST_PUBLISHABLE_KEY
      || STRIPE_PUBLISHABLE_KEY_TEST
    : process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
      || process.env.STRIPE_PUBLISHABLE_KEY
      || STRIPE_PUBLISHABLE_KEY_LIVE;

  if (!secretKey) {
    const error = new Error(
      testMode
        ? 'Stripe test checkout is not configured. Add STRIPE_TEST_SECRET_KEY to Google Secret Manager or use live Stripe mode.'
        : 'Stripe live checkout is not configured. Add STRIPE_SECRET_KEY to Google Secret Manager.'
    );
    error.statusCode = 503;
    throw error;
  }
  return {
    stripe: new Stripe(secretKey, { apiVersion: '2023-10-16' }),
    publishableKey,
    stripeMode: testMode ? 'test' : 'live',
  };
};

const validCheckoutId = (value) => /^[A-Za-z0-9_-]{16,80}$/.test(normalizeString(value));

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
    const { userId: athleteUserId, decoded } = await verifyFirebaseUser(event);
    const body = JSON.parse(event.body || '{}');
    if (!validCheckoutId(body.checkoutId)) {
      const error = new Error('A valid checkout id is required.');
      error.statusCode = 400;
      throw error;
    }

    const checkoutId = normalizeString(body.checkoutId);
    const conversation = await loadConversationForAthlete({
      conversationId: body.conversationId,
      athleteUserId,
      database,
    });
    const service = await loadService({
      serviceId: body.serviceId,
      conversation,
      database,
    });
    if (!service) {
      const error = new Error('This coach service is unavailable.');
      error.statusCode = 400;
      throw error;
    }
    if (service.serviceType === 'subscription') {
      const error = new Error('This service is an ongoing subscription and must be purchased through subscription checkout.');
      error.statusCode = 400;
      throw error;
    }
    const { stripe, publishableKey, stripeMode } = await stripeConfiguration(event);
    const connectedAccountId = await resolveCoachStripeAccount(
      conversation.coachUserId,
      database
    );

    const ref = orderRef(checkoutId, database);
    const existingSnap = await ref.get();
    if (existingSnap.exists) {
      const existing = existingSnap.data() || {};
      if (
        normalizeString(existing.athleteUserId) !== athleteUserId
        || normalizeString(existing.conversationId) !== conversation.id
        || normalizeString(existing.serviceId) !== service.id
      ) {
        const error = new Error('This checkout id is already in use.');
        error.statusCode = 409;
        throw error;
      }
      if (normalizeString(existing.paymentIntentId)) {
        const paymentIntent = await stripe.paymentIntents.retrieve(existing.paymentIntentId);
        return {
          statusCode: 200,
          headers: jsonHeaders,
          body: JSON.stringify({
            success: true,
            orderId: checkoutId,
            paymentIntentId: paymentIntent.id,
            clientSecret: paymentIntent.client_secret,
            publishableKey,
            amountCents: existing.totalAmountCents || existing.amountCents || service.amountCents,
            coachPriceCents: existing.coachPriceCents || existing.amountCents || service.amountCents,
            processingFeeCents: existing.processingFeeCents || 0,
            currency: service.currency,
          }),
        };
      }
    }

    const pricing = servicePricingBreakdown(service.amountCents);
    await ref.set({
      orderId: checkoutId,
      conversationId: conversation.id,
      athleteUserId,
      athleteEmail: normalizeString(decoded.email),
      athleteName:
        normalizeString(conversation.data.athleteName)
        || normalizeString(decoded.name)
        || 'Athlete',
      coachUserId: conversation.coachUserId,
      coachName: normalizeString(conversation.data.coachName) || 'Coach',
      connectedAccountId: connectedAccountId || null,
      settlementMode: 'manual_platform_payout',
      serviceId: service.id,
      serviceTitle: service.title,
      serviceType: service.serviceType,
      amountCents: pricing.totalAmountCents,
      coachPriceCents: pricing.coachPriceCents,
      processingFeeCents: pricing.processingFeeCents,
      platformFeeCents: pricing.platformFeeCents,
      estimatedStripeFeeCents: pricing.estimatedStripeFeeCents,
      coachNetCents: pricing.coachNetCents,
      currency: service.currency,
      status: 'payment_pending',
      stripeMode,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: false });

    let paymentIntent;
    try {
      paymentIntent = await stripe.paymentIntents.create({
        amount: pricing.totalAmountCents,
        currency: service.currency,
        payment_method_types: ['card'],
        receipt_email: normalizeString(decoded.email) || undefined,
        description: `${service.title} with ${normalizeString(conversation.data.coachName) || 'coach'}`,
        metadata: {
          platform: 'pulsecheck',
          stripe_mode: stripeMode,
          settlement_mode: 'manual_platform_payout',
          payment_type: 'pulsecheck_coach_service',
          tax_classification: 'service_income',
          order_id: checkoutId,
          conversation_id: conversation.id,
          service_id: service.id,
          service_title: service.title,
          athlete_user_id: athleteUserId,
          coach_user_id: conversation.coachUserId,
          amount_cents: String(pricing.totalAmountCents),
          coach_price_cents: String(pricing.coachPriceCents),
          processing_fee_cents: String(pricing.processingFeeCents),
          platform_fee_cents: String(pricing.platformFeeCents),
        },
      }, {
        idempotencyKey: `pulsecheck-coach-service:${athleteUserId}:${checkoutId}`,
      });
    } catch (error) {
      await ref.set({
        status: 'payment_setup_failed',
        failureMessage: normalizeString(error.message),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
      throw error;
    }

    await ref.set({
      paymentIntentId: paymentIntent.id,
      paymentStatus: paymentIntent.status,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    return {
      statusCode: 200,
      headers: jsonHeaders,
      body: JSON.stringify({
        success: true,
        orderId: checkoutId,
        paymentIntentId: paymentIntent.id,
        clientSecret: paymentIntent.client_secret,
        publishableKey,
        amountCents: pricing.totalAmountCents,
        coachPriceCents: pricing.coachPriceCents,
        processingFeeCents: pricing.processingFeeCents,
        currency: service.currency,
        stripeMode,
      }),
    };
  } catch (error) {
    const statusCode = Number(error.statusCode) || 500;
    if (statusCode >= 500) {
      console.error('[CreatePulseCheckCoachServicePaymentIntent] Failed:', error);
    }
    return {
      statusCode,
      headers: jsonHeaders,
      body: JSON.stringify({ message: error.message || 'Checkout could not be started.' }),
    };
  }
};

module.exports = { handler, stripeConfiguration, validCheckoutId };
