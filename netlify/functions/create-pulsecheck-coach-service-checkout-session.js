const Stripe = require('stripe');
const { admin, headers, getFirebaseAdminApp } = require('./config/firebase');
const { getSecretWithEnvFallback } = require('./google-secret-manager-utils');
const {
  assertCheckoutSessionMatchesOrder,
  assertOrderMatchesConversation,
  loadConversationForAthlete,
  loadService,
  normalizeString,
  orderRef,
  orderScopeFields,
  resolveCoachStripeAccount,
  resolveServerStripeMode,
  sealOrder,
  servicePricingBreakdown,
  validCheckoutId,
  verifyOrderIntegrity,
  verifyFirebaseUser,
} = require('./lib/pulsecheck-coach-services');

const jsonHeaders = {
  ...headers,
  'Content-Type': 'application/json',
  'Cache-Control': 'private, no-store',
};

const stripeConfiguration = async () => {
  const testMode = resolveServerStripeMode() === 'test';
  const secretName = testMode ? 'STRIPE_TEST_SECRET_KEY' : 'STRIPE_SECRET_KEY';
  const secretKey = await getSecretWithEnvFallback(secretName).catch((error) => {
    const message = testMode
      ? 'Stripe test checkout is not configured. Add STRIPE_TEST_SECRET_KEY to Google Secret Manager or use live Stripe mode.'
      : 'Stripe live checkout is not configured. Add STRIPE_SECRET_KEY to Google Secret Manager.';
    const wrapped = new Error(`${message} ${error.message || ''}`.trim());
    wrapped.statusCode = 503;
    throw wrapped;
  });

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
    stripeMode: testMode ? 'test' : 'live',
  };
};

const siteOrigin = () => (
  resolveServerStripeMode() === 'test'
    && normalizeString(process.env.PULSECHECK_SERVICE_CHECKOUT_ORIGIN)
    ? normalizeString(process.env.PULSECHECK_SERVICE_CHECKOUT_ORIGIN)
    : normalizeString(process.env.SITE_URL) || 'https://fitwithpulse.ai'
);

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

    const { stripe, stripeMode } = await stripeConfiguration();
    const connectedAccountId = await resolveCoachStripeAccount(
      conversation.coachUserId,
      database
    );
    const pricing = servicePricingBreakdown(service.amountCents);
    const origin = siteOrigin();
    const ref = orderRef(checkoutId, database);
    const reservation = {
      orderId: checkoutId,
      ...orderScopeFields(conversation),
      athleteEmail: normalizeString(decoded.email),
      athleteName:
        normalizeString(conversation.data.athleteName)
        || normalizeString(decoded.name)
        || 'Athlete',
      coachName: normalizeString(conversation.data.coachName) || 'Coach',
      connectedAccountId: connectedAccountId || null,
      settlementMode: 'manual_platform_payout',
      serviceId: service.id,
      serviceTitle: service.title,
      serviceDescription: service.description || '',
      serviceType: service.serviceType,
      amountCents: pricing.totalAmountCents,
      coachPriceCents: pricing.coachPriceCents,
      processingFeeCents: pricing.processingFeeCents,
      platformFeeCents: pricing.platformFeeCents,
      estimatedStripeFeeCents: pricing.estimatedStripeFeeCents,
      coachNetCents: pricing.coachNetCents,
      currency: service.currency,
      status: 'checkout_creating',
      stripeMode,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    let existingOrder = null;
    await database.runTransaction(async (transaction) => {
      const existingSnap = await transaction.get(ref);
      if (existingSnap.exists) {
        existingOrder = existingSnap.data() || {};
        return;
      }
      transaction.set(ref, reservation, { merge: false });
    });

    if (existingOrder) {
      if (!verifyOrderIntegrity(existingOrder)) {
        const error = new Error('This checkout id is already in use.');
        error.statusCode = 409;
        throw error;
      }
      assertOrderMatchesConversation(existingOrder, conversation);
      if (
        normalizeString(existingOrder.serviceId) !== service.id
        || normalizeString(existingOrder.serviceType) !== service.serviceType
        || normalizeString(existingOrder.stripeMode) !== stripeMode
        || normalizeString(existingOrder.currency) !== service.currency
        || Number(existingOrder.coachPriceCents) !== pricing.coachPriceCents
        || Number(existingOrder.amountCents) !== pricing.totalAmountCents
      ) {
        const error = new Error('This checkout id is already in use.');
        error.statusCode = 409;
        throw error;
      }
      const existingSessionId = normalizeString(existingOrder.stripeSessionId);
      if (!existingSessionId) {
        const error = new Error('This checkout id is already in use.');
        error.statusCode = 409;
        throw error;
      }
      const existingSession = await stripe.checkout.sessions.retrieve(
        existingSessionId
      );
      assertCheckoutSessionMatchesOrder(existingSession, existingOrder);
      if (!normalizeString(existingSession.url)) {
        const error = new Error('This checkout has expired. Start the service purchase again.');
        error.statusCode = 409;
        throw error;
      }
      return {
        statusCode: 200,
        headers: jsonHeaders,
        body: JSON.stringify({
          success: true,
          reused: true,
          orderId: checkoutId,
          sessionId: existingSession.id,
          url: existingSession.url,
          amountCents: Number(existingOrder.amountCents),
          coachPriceCents: Number(existingOrder.coachPriceCents),
          processingFeeCents: Number(existingOrder.processingFeeCents),
          currency: normalizeString(existingOrder.currency),
          stripeMode,
        }),
      };
    }

    const paymentMetadata = {
      platform: 'pulsecheck',
      stripe_mode: stripeMode,
      settlement_mode: 'manual_platform_payout',
      payment_type: 'pulsecheck_coach_service',
      tax_classification: 'service_income',
      order_id: checkoutId,
      conversation_id: conversation.id,
      organization_id: conversation.scope.organizationId,
      team_id: conversation.scope.teamId,
      service_id: service.id,
      service_title: service.title,
      athlete_user_id: athleteUserId,
      coach_user_id: conversation.coachUserId,
      amount_cents: String(pricing.totalAmountCents),
      coach_price_cents: String(pricing.coachPriceCents),
      processing_fee_cents: String(pricing.processingFeeCents),
      platform_fee_cents: String(pricing.platformFeeCents),
    };

    let session;
    try {
      session = await stripe.checkout.sessions.create({
        mode: 'payment',
        client_reference_id: athleteUserId,
        customer_email: normalizeString(decoded.email) || undefined,
        success_url: `${origin}/PulseCheck/service-purchase/success?orderId=${encodeURIComponent(checkoutId)}&native=1`,
        cancel_url: `${origin}/PulseCheck/service-purchase/cancelled?orderId=${encodeURIComponent(checkoutId)}&native=1`,
        metadata: paymentMetadata,
        payment_intent_data: {
          metadata: paymentMetadata,
        },
        line_items: [
          {
            price_data: {
              currency: service.currency,
              product_data: {
                name: service.title,
                description: service.description || undefined,
              },
              unit_amount: pricing.totalAmountCents,
            },
            quantity: 1,
          },
        ],
        expand: ['payment_intent'],
      }, {
        idempotencyKey: `pulsecheck-coach-service-checkout-session:${athleteUserId}:${checkoutId}`,
      });
    } catch (error) {
      await ref.set({
        status: 'checkout_failed',
        failureMessage: normalizeString(error.message),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
      throw error;
    }

    const paymentIntentId =
      typeof session.payment_intent === 'string'
        ? normalizeString(session.payment_intent)
        : normalizeString(session.payment_intent?.id);
    const stripeCustomerId =
      typeof session.customer === 'string'
        ? normalizeString(session.customer)
        : normalizeString(session.customer?.id);
    const finalOrder = sealOrder({
      ...reservation,
      stripeSessionId: session.id,
      stripeSessionUrl: session.url,
      stripeCustomerId: stripeCustomerId || null,
      paymentIntentId: paymentIntentId || '',
      status: 'checkout_created',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    await database.runTransaction(async (transaction) => {
      const reservedSnap = await transaction.get(ref);
      const reservedOrder = reservedSnap.exists ? reservedSnap.data() || {} : {};
      if (
        !reservedSnap.exists
        || normalizeString(reservedOrder.status) !== 'checkout_creating'
        || normalizeString(reservedOrder.orderId) !== checkoutId
        || normalizeString(reservedOrder.athleteUserId) !== athleteUserId
        || normalizeString(reservedOrder.conversationId) !== conversation.id
        || verifyOrderIntegrity(reservedOrder)
      ) {
        const error = new Error('This checkout id changed while checkout was being created.');
        error.statusCode = 409;
        throw error;
      }
      transaction.set(ref, finalOrder, { merge: false });
    });

    return {
      statusCode: 200,
      headers: jsonHeaders,
      body: JSON.stringify({
        success: true,
        reused: false,
        orderId: checkoutId,
        sessionId: session.id,
        url: session.url,
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
      console.error('[CreatePulseCheckCoachServiceCheckoutSession] Failed:', error);
    }
    return {
      statusCode,
      headers: jsonHeaders,
      body: JSON.stringify({ message: error.message || 'Checkout could not be started.' }),
    };
  }
};

module.exports = { handler };
