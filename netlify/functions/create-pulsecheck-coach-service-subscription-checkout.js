const Stripe = require('stripe');
const { admin, headers, isDevMode, getFirebaseAdminApp } = require('./config/firebase');
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

const stripeConfiguration = (event) => {
  const development = isDevMode(event);
  const secretKey = development
    ? process.env.STRIPE_TEST_SECRET_KEY
    : process.env.STRIPE_SECRET_KEY;

  if (!secretKey) {
    const error = new Error('Stripe checkout is not configured for this environment.');
    error.statusCode = 503;
    throw error;
  }
  return new Stripe(secretKey, { apiVersion: '2023-10-16' });
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

    const connectedAccountId = await resolveCoachStripeAccount(conversation.coachUserId, database);
    if (!connectedAccountId) {
      const error = new Error('Your coach needs to finish Stripe setup before accepting service subscriptions.');
      error.statusCode = 409;
      throw error;
    }

    const stripe = stripeConfiguration(event);
    const account = await stripe.accounts.retrieve(connectedAccountId);
    if (!account.charges_enabled) {
      const error = new Error('Your coach’s Stripe account is not ready to accept subscription payments.');
      error.statusCode = 409;
      throw error;
    }

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
    const applicationFeePercent =
      pricing.totalAmountCents > 0
        ? Math.round((pricing.processingFeeCents / pricing.totalAmountCents) * 10000) / 100
        : 0;
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
        transfer_data: { destination: connectedAccountId },
        application_fee_percent: applicationFeePercent,
        metadata: {
          platform: 'pulsecheck',
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
      connectedAccountId,
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
