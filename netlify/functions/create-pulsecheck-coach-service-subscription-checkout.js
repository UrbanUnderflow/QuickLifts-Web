const Stripe = require('stripe');
const { admin, headers, getFirebaseAdminApp } = require('./config/firebase');
const { getSecretWithEnvFallback } = require('./google-secret-manager-utils');
const {
  loadConversationForAthlete,
  loadService,
  normalizeString,
  orderRef,
  resolveCoachStripeAccount,
  servicePricingBreakdown,
  verifyFirebaseUser,
} = require('./lib/pulsecheck-coach-services');
const { validCheckoutId } = require('./create-pulsecheck-coach-service-payment-intent');

const jsonHeaders = {
  ...headers,
  'Content-Type': 'application/json',
  'Cache-Control': 'private, no-store',
};

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

const siteOrigin = (event) => {
  const origin = event.headers?.origin || event.headers?.referer || '';
  if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
    return 'http://localhost:3000';
  }
  return process.env.SITE_URL || 'https://fitwithpulse.ai';
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

    const { stripe, stripeMode } = await stripeConfiguration(event);
    const connectedAccountId = await resolveCoachStripeAccount(conversation.coachUserId, database);

    const checkoutId = normalizeString(body.checkoutId);
    const ref = orderRef(checkoutId, database);
    const existingSnap = await ref.get();
    if (existingSnap.exists) {
      const existing = existingSnap.data() || {};
      if (normalizeString(existing.stripeSessionUrl)) {
        return {
          statusCode: 200,
          headers: jsonHeaders,
          body: JSON.stringify({
            success: true,
            orderId: checkoutId,
            url: existing.stripeSessionUrl,
            amountCents: existing.amountCents,
            coachPriceCents: existing.coachPriceCents,
            processingFeeCents: existing.processingFeeCents,
            currency: existing.currency || service.currency,
          }),
        };
      }
    }

    const pricing = servicePricingBreakdown(service.amountCents);
    const origin = siteOrigin(event);

    const session = await stripe.checkout.sessions.create({
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
        metadata: {
          platform: 'pulsecheck',
          stripe_mode: stripeMode,
          settlement_mode: 'manual_platform_payout',
          payment_type: 'pulsecheck_coach_service_subscription',
          order_id: checkoutId,
          conversation_id: conversation.id,
          service_id: service.id,
          coach_user_id: conversation.coachUserId,
          athlete_user_id: athleteUserId,
        },
      },
      metadata: {
        platform: 'pulsecheck',
        stripe_mode: stripeMode,
        payment_type: 'pulsecheck_coach_service_subscription',
        order_id: checkoutId,
        conversation_id: conversation.id,
        service_id: service.id,
        service_title: service.title,
        coach_user_id: conversation.coachUserId,
        athlete_user_id: athleteUserId,
      },
    }, {
      idempotencyKey: `pulsecheck-coach-service-subscription:${athleteUserId}:${checkoutId}`,
    });

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
      serviceDescription: service.description || '',
      serviceType: service.serviceType,
      amountCents: pricing.totalAmountCents,
      coachPriceCents: pricing.coachPriceCents,
      processingFeeCents: pricing.processingFeeCents,
      platformFeeCents: pricing.platformFeeCents,
      estimatedStripeFeeCents: pricing.estimatedStripeFeeCents,
      coachNetCents: pricing.coachNetCents,
      currency: service.currency,
      stripeSessionId: session.id,
      stripeSessionUrl: session.url,
      stripeMode,
      status: 'subscription_checkout_created',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: false });

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
