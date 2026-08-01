const Stripe = require('stripe');
const { admin, headers, getFirebaseAdminApp } = require('./config/firebase');
const { getSecretWithEnvFallback } = require('./google-secret-manager-utils');
const {
  assertOrderMatchesConversation,
  assertSubscriptionSessionMatchesOrder,
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
  if (process.env.PULSECHECK_RECURRING_COACH_SERVICES_ENABLED !== 'true') {
    return {
      statusCode: 409,
      headers: jsonHeaders,
      body: JSON.stringify({
        message:
          'Recurring coach services are unavailable during this release. Choose a one-time service.',
      }),
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
    if (!service || service.serviceType !== 'subscription') {
      const error = new Error('This subscription service is unavailable.');
      error.statusCode = 400;
      throw error;
    }

    const { stripe, stripeMode } = await stripeConfiguration();
    const connectedAccountId = await resolveCoachStripeAccount(conversation.coachUserId, database);

    const checkoutId = normalizeString(body.checkoutId);
    const ref = orderRef(checkoutId, database);
    const pricing = servicePricingBreakdown(service.amountCents);
    const origin = siteOrigin();
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
      stripeMode,
      status: 'subscription_checkout_creating',
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
        || normalizeString(existingOrder.serviceType) !== 'subscription'
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
      assertSubscriptionSessionMatchesOrder(existingSession, existingOrder);
      if (!normalizeString(existingSession.url)) {
        const error = new Error('This subscription checkout has expired.');
        error.statusCode = 409;
        throw error;
      }
      return {
        statusCode: 200,
        headers: jsonHeaders,
        body: JSON.stringify({
          success: true,
          orderId: checkoutId,
          url: existingSession.url,
          amountCents: Number(existingOrder.amountCents),
          coachPriceCents: Number(existingOrder.coachPriceCents),
          processingFeeCents: Number(existingOrder.processingFeeCents),
          currency: normalizeString(existingOrder.currency),
        }),
      };
    }

    const paymentMetadata = {
      platform: 'pulsecheck',
      stripe_mode: stripeMode,
      settlement_mode: 'manual_platform_payout',
      payment_type: 'pulsecheck_coach_service_subscription',
      order_id: checkoutId,
      conversation_id: conversation.id,
      organization_id: conversation.scope.organizationId,
      team_id: conversation.scope.teamId,
      service_id: service.id,
      service_title: service.title,
      coach_user_id: conversation.coachUserId,
      athlete_user_id: athleteUserId,
      amount_cents: String(pricing.totalAmountCents),
      coach_price_cents: String(pricing.coachPriceCents),
      processing_fee_cents: String(pricing.processingFeeCents),
      platform_fee_cents: String(pricing.platformFeeCents),
    };
    let session;
    try {
      session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        client_reference_id: athleteUserId,
        customer_email: normalizeString(decoded.email) || undefined,
        success_url: `${origin}/PulseCheck/service-purchase/success?orderId=${encodeURIComponent(checkoutId)}`,
        cancel_url: `${origin}/coach/dashboard?serviceCheckout=cancelled`,
        line_items: [
          {
            price_data: {
              currency: service.currency,
              recurring: { interval: 'month' },
              product_data: {
                name: service.title,
                description: service.description || undefined,
              },
              unit_amount: pricing.totalAmountCents,
            },
            quantity: 1,
          },
        ],
        subscription_data: {
          metadata: paymentMetadata,
        },
        metadata: paymentMetadata,
      }, {
        idempotencyKey: `pulsecheck-coach-service-subscription:${athleteUserId}:${checkoutId}`,
      });
    } catch (error) {
      await ref.set({
        status: 'subscription_checkout_failed',
        failureMessage: normalizeString(error.message),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
      throw error;
    }

    const stripeCustomerId =
      typeof session.customer === 'string'
        ? normalizeString(session.customer)
        : normalizeString(session.customer?.id);
    const finalOrder = sealOrder({
      ...reservation,
      stripeSessionId: session.id,
      stripeSessionUrl: session.url,
      stripeCustomerId: stripeCustomerId || null,
      status: 'subscription_checkout_created',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    await database.runTransaction(async (transaction) => {
      const reservedSnap = await transaction.get(ref);
      const reservedOrder = reservedSnap.exists ? reservedSnap.data() || {} : {};
      if (
        !reservedSnap.exists
        || normalizeString(reservedOrder.status) !== 'subscription_checkout_creating'
        || normalizeString(reservedOrder.orderId) !== checkoutId
        || normalizeString(reservedOrder.athleteUserId) !== athleteUserId
        || normalizeString(reservedOrder.conversationId) !== conversation.id
        || verifyOrderIntegrity(reservedOrder)
      ) {
        const error = new Error(
          'This checkout id changed while subscription checkout was being created.'
        );
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
        orderId: checkoutId,
        url: session.url,
        amountCents: pricing.totalAmountCents,
        coachPriceCents: pricing.coachPriceCents,
        processingFeeCents: pricing.processingFeeCents,
        currency: service.currency,
      }),
    };
  } catch (error) {
    const statusCode = Number(error.statusCode) || 500;
    if (statusCode >= 500) {
      console.error('[CreatePulseCheckCoachServiceSubscriptionCheckout] Failed:', error);
    }
    return {
      statusCode,
      headers: jsonHeaders,
      body: JSON.stringify({ message: error.message || 'Subscription checkout could not be started.' }),
    };
  }
};

module.exports = { handler };
