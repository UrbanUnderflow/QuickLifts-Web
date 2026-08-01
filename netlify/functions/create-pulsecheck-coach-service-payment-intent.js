const Stripe = require('stripe');
const { admin, headers, getFirebaseAdminApp } = require('./config/firebase');
const { getSecretWithEnvFallback } = require('./google-secret-manager-utils');
const {
  assertOrderMatchesConversation,
  assertPaymentIntentMatchesOrder,
  loadService,
  loadConversationForAthlete,
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

const STRIPE_PUBLISHABLE_KEY_LIVE =
  'pk_live_51Sd8YLIkArZc741WXCIF0xMlq4OUccnkkSsoJ3MqY9Wiu0xsAqRZeHdxijRnOa050a2k8WwqtVi6EsyhPZ6lfS5w00l9L49dzX';
const STRIPE_PUBLISHABLE_KEY_TEST =
  'pk_test_51Sd8YLIkArZc741WNSWroMed1dRRfjfA2bQBniDTFsiEiVKtbxGU5IhpR5u2HimyiR9OHqgvxgHFFrMjqxFl7YUC00WpY2G0dn';

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

async function resolveAthleteStripeCustomer({
  stripe,
  database,
  athleteUserId,
  email,
  name,
  stripeMode,
  preferredCustomerId,
}) {
  const userRef = database.collection('users').doc(athleteUserId);
  const userSnap = await userRef.get();
  const userData = userSnap.exists ? userSnap.data() || {} : {};
  const candidateCustomerIds = [
    normalizeString(preferredCustomerId),
    normalizeString(userData.stripeCustomerIds?.[stripeMode]),
  ].filter((value, index, values) => value && values.indexOf(value) === index);
  let customerId = '';

  for (const candidateCustomerId of candidateCustomerIds) {
    try {
      const customer = await stripe.customers.retrieve(candidateCustomerId);
      const metadata = customer?.metadata || {};
      const liveModeMatches = typeof customer?.livemode !== 'boolean'
        || customer.livemode === (stripeMode === 'live');
      if (
        customer?.deleted !== true
        && normalizeString(customer?.id) === candidateCustomerId
        && normalizeString(metadata.platform) === 'pulsecheck'
        && normalizeString(metadata.pulsecheck_user_id) === athleteUserId
        && normalizeString(metadata.stripe_mode) === stripeMode
        && liveModeMatches
      ) {
        customerId = candidateCustomerId;
        break;
      }
    } catch (error) {
      // Missing or cross-mode customer IDs are replaced with a canonical customer.
    }
  }

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: normalizeString(email) || undefined,
      name: normalizeString(name) || undefined,
      metadata: {
        platform: 'pulsecheck',
        pulsecheck_user_id: athleteUserId,
        stripe_mode: stripeMode,
      },
    });
    customerId = customer.id;
  }

  if (normalizeString(userData.stripeCustomerIds?.[stripeMode]) !== customerId) {
    await userRef.set({
      stripeCustomerIds: {
        [stripeMode]: customerId,
      },
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
  }

  const ephemeralKey = await stripe.ephemeralKeys.create(
    { customer: customerId },
    { apiVersion: '2020-08-27' }
  );

  return {
    customerId,
    ephemeralKeySecret: ephemeralKey.secret,
  };
}

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
    const { stripe, publishableKey, stripeMode } = await stripeConfiguration();
    const connectedAccountId = await resolveCoachStripeAccount(
      conversation.coachUserId,
      database
    );
    const pricing = servicePricingBreakdown(service.amountCents);
    const ref = orderRef(checkoutId, database);
    let existingOrder = null;
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
      status: 'payment_creating',
      stripeMode,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
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
      const existingPaymentIntentId = normalizeString(
        existingOrder.paymentIntentId
      );
      if (!existingPaymentIntentId) {
        const error = new Error('This checkout id is already in use.');
        error.statusCode = 409;
        throw error;
      }
      const paymentIntent = await stripe.paymentIntents.retrieve(
        existingPaymentIntentId
      );
      assertPaymentIntentMatchesOrder(paymentIntent, existingOrder);
      const stripeCustomer = await resolveAthleteStripeCustomer({
        stripe,
        database,
        athleteUserId,
        email: normalizeString(decoded.email),
        name:
          normalizeString(conversation.data.athleteName)
          || normalizeString(decoded.name)
          || 'Athlete',
        stripeMode,
        preferredCustomerId: existingOrder.stripeCustomerId,
      });
      return {
        statusCode: 200,
        headers: jsonHeaders,
        body: JSON.stringify({
          success: true,
          orderId: checkoutId,
          paymentIntentId: paymentIntent.id,
          clientSecret: paymentIntent.client_secret,
          publishableKey,
          customerId: stripeCustomer.customerId,
          customerEphemeralKeySecret: stripeCustomer.ephemeralKeySecret,
          paymentMethodTypes: paymentIntent.payment_method_types || [],
          amountCents: Number(existingOrder.amountCents),
          coachPriceCents: Number(existingOrder.coachPriceCents),
          processingFeeCents: Number(existingOrder.processingFeeCents),
          currency: normalizeString(existingOrder.currency),
          stripeMode,
        }),
      };
    }

    const stripeCustomer = await resolveAthleteStripeCustomer({
      stripe,
      database,
      athleteUserId,
      email: normalizeString(decoded.email),
      name:
        normalizeString(conversation.data.athleteName)
        || normalizeString(decoded.name)
        || 'Athlete',
      stripeMode,
    });

    let paymentIntent;
    try {
      paymentIntent = await stripe.paymentIntents.create({
        amount: pricing.totalAmountCents,
        currency: service.currency,
        customer: stripeCustomer.customerId,
        automatic_payment_methods: {
          enabled: true,
        },
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

    const finalOrder = sealOrder({
      ...reservation,
      status: 'payment_pending',
      paymentIntentId: paymentIntent.id,
      paymentStatus: paymentIntent.status,
      stripeCustomerId: stripeCustomer.customerId,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    await database.runTransaction(async (transaction) => {
      const reservedSnap = await transaction.get(ref);
      const reservedOrder = reservedSnap.exists ? reservedSnap.data() || {} : {};
      if (
        !reservedSnap.exists
        || normalizeString(reservedOrder.status) !== 'payment_creating'
        || normalizeString(reservedOrder.orderId) !== checkoutId
        || normalizeString(reservedOrder.athleteUserId) !== athleteUserId
        || normalizeString(reservedOrder.conversationId) !== conversation.id
        || verifyOrderIntegrity(reservedOrder)
      ) {
        const error = new Error('This checkout id changed while payment was being created.');
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
        paymentIntentId: paymentIntent.id,
        clientSecret: paymentIntent.client_secret,
        publishableKey,
        customerId: stripeCustomer.customerId,
        customerEphemeralKeySecret: stripeCustomer.ephemeralKeySecret,
        paymentMethodTypes: paymentIntent.payment_method_types || [],
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
