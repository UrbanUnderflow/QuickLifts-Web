const Stripe = require('stripe');
const { admin, headers, isDevMode, getFirebaseAdminApp } = require('./config/firebase');
const {
  getService,
  loadConversationForAthlete,
  normalizeString,
  orderRef,
  platformFeeCents,
  resolveCoachStripeAccount,
  verifyFirebaseUser,
} = require('./lib/pulsecheck-coach-services');

const jsonHeaders = {
  ...headers,
  'Content-Type': 'application/json',
  'Cache-Control': 'private, no-store',
};

const stripeConfiguration = (event) => {
  const development = isDevMode(event);
  const secretKey = development
    ? process.env.STRIPE_TEST_SECRET_KEY
    : process.env.STRIPE_SECRET_KEY;
  const publishableKey = development
    ? process.env.NEXT_PUBLIC_TEST_STRIPE_PUBLISHABLE_KEY
      || process.env.STRIPE_TEST_PUBLISHABLE_KEY
    : process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
      || process.env.STRIPE_PUBLISHABLE_KEY;

  if (!secretKey || !publishableKey) {
    const error = new Error('Stripe checkout is not configured for this environment.');
    error.statusCode = 503;
    throw error;
  }
  return {
    stripe: new Stripe(secretKey, { apiVersion: '2023-10-16' }),
    publishableKey,
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
    const service = getService(body.serviceId);
    if (!service) {
      const error = new Error('This coach service is unavailable.');
      error.statusCode = 400;
      throw error;
    }
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
    const connectedAccountId = await resolveCoachStripeAccount(
      conversation.coachUserId,
      database
    );
    if (!connectedAccountId) {
      const error = new Error('Your coach needs to finish Stripe setup before accepting service payments.');
      error.statusCode = 409;
      throw error;
    }

    const { stripe, publishableKey } = stripeConfiguration(event);
    const account = await stripe.accounts.retrieve(connectedAccountId);
    if (!account.charges_enabled) {
      const error = new Error('Your coach’s Stripe account is not ready to accept payments.');
      error.statusCode = 409;
      throw error;
    }

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
            amountCents: service.amountCents,
            currency: service.currency,
          }),
        };
      }
    }

    const platformFee = platformFeeCents(service.amountCents);
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
      connectedAccountId,
      serviceId: service.id,
      serviceTitle: service.title,
      amountCents: service.amountCents,
      platformFeeCents: platformFee,
      coachNetCents: service.amountCents - platformFee,
      currency: service.currency,
      status: 'payment_pending',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: false });

    let paymentIntent;
    try {
      paymentIntent = await stripe.paymentIntents.create({
        amount: service.amountCents,
        currency: service.currency,
        payment_method_types: ['card'],
        application_fee_amount: platformFee,
        transfer_data: { destination: connectedAccountId },
        receipt_email: normalizeString(decoded.email) || undefined,
        description: `${service.title} with ${normalizeString(conversation.data.coachName) || 'coach'}`,
        metadata: {
          platform: 'pulsecheck',
          payment_type: 'pulsecheck_coach_service',
          tax_classification: 'service_income',
          order_id: checkoutId,
          conversation_id: conversation.id,
          service_id: service.id,
          service_title: service.title,
          athlete_user_id: athleteUserId,
          coach_user_id: conversation.coachUserId,
          amount_cents: String(service.amountCents),
          platform_fee_cents: String(platformFee),
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
        amountCents: service.amountCents,
        currency: service.currency,
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
