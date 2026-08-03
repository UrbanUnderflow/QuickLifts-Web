const { admin, headers } = require('./config/firebase');
const { stripeConfiguration } = require('./create-pulsecheck-coach-service-payment-intent');
const {
  normalizeString,
  validCheckoutId,
  verifyFirebaseUser,
} = require('./lib/pulsecheck-coach-services');
const {
  ATHLETE_APP_CHECKOUT_SOURCE,
  ATHLETE_APP_PAYMENT_TYPE,
  PLATFORM_SHARE_PERCENT,
  loadCoachPricedInviteCheckout,
} = require('./lib/pulsecheck-athlete-app-offers');

const jsonHeaders = {
  ...headers,
  'Content-Type': 'application/json',
  'Cache-Control': 'private, no-store',
};

const isDevFirebaseApp = (authenticatedApp) => (
  normalizeString(authenticatedApp?.name) === 'pulsecheck-dev-admin'
);

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
    } catch (_error) {
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
    const authenticated = await verifyFirebaseUser(event, {
      authErrorMessage: 'Sign in before starting the team subscription.',
    });
    const body = JSON.parse(event.body || '{}');
    if (!validCheckoutId(body.checkoutId)) {
      const error = new Error('A valid checkout id is required.');
      error.statusCode = 400;
      throw error;
    }

    const checkoutId = normalizeString(body.checkoutId);
    const inviteToken = normalizeString(body.inviteToken);
    if (!inviteToken) {
      const error = new Error('A team invite is required.');
      error.statusCode = 400;
      throw error;
    }

    const { stripe, publishableKey, stripeMode } = await stripeConfiguration();
    const database = authenticated.app.firestore();
    const coachOfferDevFirebase = isDevFirebaseApp(authenticated.app);
    const checkout = await loadCoachPricedInviteCheckout({
      database,
      userId: authenticated.userId,
      authenticatedEmail: normalizeString(authenticated.decoded?.email).toLowerCase(),
      authenticatedEmailVerified: authenticated.decoded?.email_verified === true,
      inviteToken,
      requestedTeamId: body.teamId,
      stripeMode,
    });
    const offerId = normalizeString(checkout.offer.offerId || checkout.offer.id || checkout.teamId);
    const offerVersion = Math.max(0, Number(checkout.offer.version) || 0);
    const stripeCustomer = await resolveAthleteStripeCustomer({
      stripe,
      database,
      athleteUserId: authenticated.userId,
      email: checkout.email || normalizeString(authenticated.decoded?.email),
      name:
        normalizeString(checkout.userData?.preferredName)
        || normalizeString(checkout.userData?.displayName)
        || normalizeString(authenticated.decoded?.name)
        || 'Athlete',
      stripeMode,
    });
    const metadata = {
      payment_type: ATHLETE_APP_PAYMENT_TYPE,
      pulsecheckAthleteAppOffer: 'true',
      userId: authenticated.userId,
      userType: 'athlete',
      pulsecheckOrganizationId: checkout.organizationId,
      pulsecheckTeamId: checkout.teamId,
      pulsecheckInviteToken: checkout.inviteToken,
      pulsecheckOfferId: offerId,
      pulsecheckOfferVersion: String(offerVersion),
      pulsecheckNativeCheckoutId: checkoutId,
      pulsecheckRevenueRecipientUserId: checkout.revenueRecipientUserId || '',
      pulsecheckPlatformSharePercent: String(PLATFORM_SHARE_PERCENT),
      pulsecheckStripeFeePolicy: 'coach-pays-actual-stripe-processing-fee',
      pulsecheckFirebaseMode: coachOfferDevFirebase ? 'dev' : 'prod',
      checkoutSource: ATHLETE_APP_CHECKOUT_SOURCE,
      checkoutPlan: 'monthly',
      checkoutAuthVerified: 'true',
    };

    const subscription = await stripe.subscriptions.create({
      customer: stripeCustomer.customerId,
      items: [{ price: checkout.priceId }],
      payment_behavior: 'default_incomplete',
      payment_settings: {
        payment_method_types: ['card'],
        save_default_payment_method: 'on_subscription',
      },
      metadata,
      expand: ['latest_invoice.payment_intent'],
    }, {
      idempotencyKey: `pc-athlete-app-sheet:${stripeMode}:${authenticated.userId}:${checkoutId}`,
    });

    const invoice = subscription.latest_invoice || {};
    const paymentIntent = invoice.payment_intent || {};
    if (!paymentIntent.client_secret) {
      const error = new Error('Stripe could not prepare the subscription payment.');
      error.statusCode = 502;
      throw error;
    }

    await database.collection('pulsecheck-athlete-app-native-checkouts').doc(checkoutId).set({
      checkoutId,
      status: 'payment_pending',
      userId: authenticated.userId,
      organizationId: checkout.organizationId,
      teamId: checkout.teamId,
      inviteToken: checkout.inviteToken,
      offerId,
      offerVersion,
      stripeMode,
      firebaseMode: coachOfferDevFirebase ? 'dev' : 'prod',
      stripePriceId: checkout.priceId,
      stripeCustomerId: stripeCustomer.customerId,
      stripeSubscriptionId: subscription.id,
      stripeInvoiceId: normalizeString(invoice.id),
      stripePaymentIntentId: paymentIntent.id,
      source: ATHLETE_APP_CHECKOUT_SOURCE,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    return {
      statusCode: 200,
      headers: jsonHeaders,
      body: JSON.stringify({
        success: true,
        checkoutId,
        subscriptionId: subscription.id,
        invoiceId: normalizeString(invoice.id),
        paymentIntentId: paymentIntent.id,
        clientSecret: paymentIntent.client_secret,
        publishableKey,
        customerId: stripeCustomer.customerId,
        customerEphemeralKeySecret: stripeCustomer.ephemeralKeySecret,
        paymentMethodTypes: paymentIntent.payment_method_types || ['card'],
        amountCents: Number(paymentIntent.amount) || 0,
        currency: normalizeString(paymentIntent.currency) || 'usd',
        teamId: checkout.teamId,
        inviteToken: checkout.inviteToken,
        stripeMode,
      }),
    };
  } catch (error) {
    const statusCode = Number(error?.statusCode) || 500;
    if (statusCode >= 500) {
      console.error('[CreatePulseCheckAthleteAppSubscriptionIntent] Failed:', error);
    }
    return {
      statusCode,
      headers: jsonHeaders,
      body: JSON.stringify({
        message: error?.message || 'The team subscription payment could not be started.',
        alreadyActive: error?.alreadyActive === true,
      }),
    };
  }
};

module.exports = { handler };
