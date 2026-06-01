const Stripe = require('stripe');
const { admin, db } = require('./config/firebase');
const {
  MACRA_WEB_OFFER_CAMPAIGN_ID,
  ageFromBirthdateMs,
  getMacraBirthdateMs,
  hasActiveRootSubscription,
  hasActiveSubscriptionPlan,
  normalizePlan,
  normalizeString,
  resolveMacraPriceId,
  verifyMacraOfferLinkSignature,
} = require('./utils/macraStripe');
const {
  MACRA_MIXPANEL_EVENTS,
  safeTrackMacraWebOfferEvent,
} = require('./utils/mixpanelAnalytics');

const jsonHeaders = {
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
};

const isLocalhostRequest = (event) => {
  const origin = event.headers.origin || event.headers.referer || event.headers.host || '';
  return origin.includes('localhost') || origin.includes('127.0.0.1');
};

const getBaseUrl = (event) => {
  if (isLocalhostRequest(event)) {
    const origin = normalizeString(event.headers.origin);
    if (origin) return origin;
    const host = normalizeString(event.headers.host);
    if (host) return `http://${host}`;
  }
  return process.env.SITE_URL || process.env.URL || 'https://fitwithpulse.ai';
};

const getStripeInstance = (event, forceTestMode) => {
  const isTestMode = forceTestMode || isLocalhostRequest(event);
  const secretKey = isTestMode
    ? (process.env.STRIPE_TEST_SECRET_KEY || process.env.STRIPE_SECRET_KEY)
    : process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error(isTestMode ? 'STRIPE_TEST_SECRET_KEY is not configured.' : 'STRIPE_SECRET_KEY is not configured.');
  }
  return { stripe: new Stripe(secretKey), isTestMode };
};

const normalizeFirebaseIdToken = (value) => normalizeString(value).replace(/^Bearer\s+/i, '');

const firebaseIdTokenFromRequest = (event, explicitToken) => {
  const authHeader = event.headers.authorization || event.headers.Authorization || '';
  return normalizeFirebaseIdToken(explicitToken || authHeader);
};

const verifyCheckoutFirebaseToken = async ({ firebaseIdToken, requestedUserId }) => {
  const normalizedToken = normalizeFirebaseIdToken(firebaseIdToken);
  const normalizedRequestedUserId = normalizeString(requestedUserId);

  if (!normalizedToken) {
    const error = new Error('Sign in is required before starting this Macra offer checkout.');
    error.statusCode = 401;
    throw error;
  }

  try {
    const decodedToken = await admin.auth().verifyIdToken(normalizedToken);
    const tokenUserId = normalizeString(decodedToken.uid);

    if (!tokenUserId) {
      const error = new Error('Firebase token did not include a user id.');
      error.statusCode = 401;
      throw error;
    }

    if (normalizedRequestedUserId && normalizedRequestedUserId !== tokenUserId) {
      const error = new Error('Signed-in user does not match this Macra offer.');
      error.statusCode = 403;
      throw error;
    }

    return tokenUserId;
  } catch (error) {
    if (!error.statusCode) error.statusCode = 401;
    throw error;
  }
};

const buildSuccessUrl = ({ baseUrl, userId }) => {
  const url = new URL('/subscription-success', baseUrl);
  url.searchParams.set('session_id', '{CHECKOUT_SESSION_ID}');
  url.searchParams.set('userId', userId);
  url.searchParams.set('source', 'macra_web_offer_24h');
  return url.toString().replace(/%7BCHECKOUT_SESSION_ID%7D/g, '{CHECKOUT_SESSION_ID}');
};

const buildAlreadyActiveUrl = ({ baseUrl, userId }) => {
  const url = new URL('/subscription-success', baseUrl);
  url.searchParams.set('userId', userId);
  url.searchParams.set('source', 'macra_web_offer_24h');
  url.searchParams.set('status', 'already_active');
  return url.toString();
};

const buildCancelUrl = ({ baseUrl }) => {
  const url = new URL('/Macra', baseUrl);
  url.searchParams.set('macra_offer', 'cancelled');
  url.searchParams.set('campaign', MACRA_WEB_OFFER_CAMPAIGN_ID);
  return url.toString();
};

const markCheckoutFailure = async ({ userRef, reason, details }) => {
  if (!userRef || !reason) return;

  try {
    await userRef.set(
      {
        macraEmailSequenceState: {
          webOffer24hCheckoutFailedAt: admin.firestore.FieldValue.serverTimestamp(),
          webOffer24hCheckoutFailureReason: reason,
          ...(details ? { webOffer24hCheckoutFailureDetails: String(details).slice(0, 500) } : {}),
          webOffer24hStatus: `checkout_failed:${reason}`,
          webOffer24hLastUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
      },
      { merge: true }
    );
  } catch (error) {
    console.warn('[create-macra-web-offer-checkout] Failed to record checkout failure:', error?.message || error);
  }
};

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: jsonHeaders,
      body: JSON.stringify({ success: false, error: 'Method not allowed' }),
    };
  }

  const qp = event.queryStringParameters || {};
  const userId = normalizeString(qp.uid || qp.userId);
  const campaignId = normalizeString(qp.campaign || qp.campaignId);
  const plan = normalizePlan(qp.plan || 'monthly');
  const expiresAt = Number(qp.expires || qp.expiresAt || 0);
  const signature = normalizeString(qp.sig || qp.signature);
  const forceTestMode = qp.test === '1' || qp.test === 'true';
  const requireAuth = qp.requireAuth === '1' || qp.requireAuth === 'true';

  if (!userId || campaignId !== MACRA_WEB_OFFER_CAMPAIGN_ID || !expiresAt || !signature) {
    return {
      statusCode: 400,
      headers: jsonHeaders,
      body: JSON.stringify({ success: false, error: 'Invalid offer link.' }),
    };
  }

  if (Date.now() > expiresAt) {
    return {
      statusCode: 410,
      headers: jsonHeaders,
      body: JSON.stringify({ success: false, error: 'This offer link has expired.' }),
    };
  }

  let validSignature = false;
  try {
    validSignature = verifyMacraOfferLinkSignature({ userId, campaignId, plan, expiresAt, signature });
  } catch (error) {
    console.error('[create-macra-web-offer-checkout] Signature check failed:', error);
  }

  if (!validSignature) {
    return {
      statusCode: 403,
      headers: jsonHeaders,
      body: JSON.stringify({ success: false, error: 'Invalid offer link signature.' }),
    };
  }

  try {
    let authVerified = false;
    if (requireAuth) {
      await verifyCheckoutFirebaseToken({
        firebaseIdToken: firebaseIdTokenFromRequest(event, qp.firebaseIdToken || qp.authToken),
        requestedUserId: userId,
      });
      authVerified = true;
    }

    const userRef = db.collection('users').doc(userId);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
      return {
        statusCode: 404,
        headers: jsonHeaders,
        body: JSON.stringify({ success: false, error: 'User not found.' }),
      };
    }

    const userData = userSnap.data() || {};
    const nowMs = Date.now();
    const email = normalizeString(userData.email);

    await userRef.set(
      {
        macraEmailSequenceState: {
          webOffer24hClickedAt: admin.firestore.FieldValue.serverTimestamp(),
          webOffer24hStatus: 'clicked',
          webOffer24hLastUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
          webOffer24hPlan: plan,
          webOffer24hAuthRequired: requireAuth,
          ...(authVerified ? { webOffer24hAuthenticatedAt: admin.firestore.FieldValue.serverTimestamp() } : {}),
        },
      },
      { merge: true }
    );

    if (!email) {
      await markCheckoutFailure({ userRef, reason: 'missing_email' });
      return {
        statusCode: 400,
        headers: jsonHeaders,
        body: JSON.stringify({ success: false, error: 'User email is required for checkout.' }),
      };
    }

    const birthdateMs = await getMacraBirthdateMs({ db, userId, userData });
    const age = ageFromBirthdateMs(birthdateMs, nowMs);
    if (age === null || age < 18) {
      await userRef.set(
        {
          macraEmailSequenceState: {
            webOffer24hBlockedAt: admin.firestore.FieldValue.serverTimestamp(),
            webOffer24hBlockReason: age === null ? 'missing_birthdate' : 'under_18',
            webOffer24hEligibilityAge: age,
            webOffer24hStatus: age === null ? 'blocked:missing_birthdate' : 'blocked:under_18',
            webOffer24hLastUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
        },
        { merge: true }
      );
      return {
        statusCode: 403,
        headers: jsonHeaders,
        body: JSON.stringify({ success: false, error: 'This offer is only available to adults.' }),
      };
    }

    const baseUrl = getBaseUrl(event);

    if (hasActiveRootSubscription(userData, nowMs) || (await hasActiveSubscriptionPlan({ db, userId, nowMs }))) {
      await userRef.set(
        {
          macraEmailSequenceState: {
            webOffer24hBlockedAt: admin.firestore.FieldValue.serverTimestamp(),
            webOffer24hBlockReason: 'already_subscribed_or_trialing',
            webOffer24hStatus: 'blocked:already_subscribed_or_trialing',
            webOffer24hLastUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
        },
        { merge: true }
      );
      return {
        statusCode: 302,
        headers: {
          Location: buildAlreadyActiveUrl({ baseUrl, userId }),
          'Cache-Control': 'no-store',
        },
        body: '',
      };
    }

    const { stripe, isTestMode } = getStripeInstance(event, forceTestMode);
    const priceId = resolveMacraPriceId({ plan, isTestMode });
    if (!priceId) {
      await markCheckoutFailure({
        userRef,
        reason: isTestMode ? 'missing_test_price' : 'missing_live_price',
      });
      return {
        statusCode: 500,
        headers: jsonHeaders,
        body: JSON.stringify({
          success: false,
          error: isTestMode
            ? 'Macra test Stripe price is not configured.'
            : 'Macra live Stripe price is not configured.',
        }),
      };
    }

    const metadata = {
      userId,
      userType: 'macra',
      product: 'macra',
      checkoutSource: 'macra_retarget_email',
      checkoutPlan: plan,
      campaignId: MACRA_WEB_OFFER_CAMPAIGN_ID,
      offerId: MACRA_WEB_OFFER_CAMPAIGN_ID,
      webOffer: 'true',
      checkoutAuthVerified: authVerified ? 'true' : 'false',
    };

    const stripeCustomerId = normalizeString(userData.stripeCustomerId);
    const checkoutParams = {
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      client_reference_id: userId,
      ...(stripeCustomerId ? { customer: stripeCustomerId } : { customer_email: email }),
      allow_promotion_codes: true,
      success_url: buildSuccessUrl({ baseUrl, userId }),
      cancel_url: buildCancelUrl({ baseUrl }),
      metadata,
      subscription_data: {
        trial_period_days: 30,
        metadata,
      },
    };

    let session;
    try {
      session = await stripe.checkout.sessions.create(checkoutParams);
    } catch (stripeError) {
      if (!stripeCustomerId || stripeError?.code !== 'resource_missing') {
        await markCheckoutFailure({
          userRef,
          reason: stripeError?.code || 'stripe_session_create_failed',
          details: stripeError?.message || stripeError,
        });
        throw stripeError;
      }
      console.warn('[create-macra-web-offer-checkout] Stored customer could not be used; retrying with email:', stripeCustomerId);
      const retryParams = { ...checkoutParams };
      delete retryParams.customer;
      retryParams.customer_email = email;
      try {
        session = await stripe.checkout.sessions.create(retryParams);
      } catch (retryError) {
        await markCheckoutFailure({
          userRef,
          reason: retryError?.code || 'stripe_session_retry_failed',
          details: retryError?.message || retryError,
        });
        throw retryError;
      }
    }

    await userRef.set(
      {
        macraEmailSequenceState: {
          webOffer24hCheckoutStartedAt: admin.firestore.FieldValue.serverTimestamp(),
          webOffer24hCheckoutSessionId: session.id,
          webOffer24hStripePriceId: priceId,
          webOffer24hStatus: 'checkout_started',
          webOffer24hLastUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
          webOffer24hPlan: plan,
        },
      },
      { merge: true }
    );

    await safeTrackMacraWebOfferEvent({
      eventName: MACRA_MIXPANEL_EVENTS.checkoutStarted,
      userId,
      email,
      insertId: `macra-web-offer:checkout-started:${session.id}`,
      properties: {
        plan,
        trial_days: 30,
        stripe_checkout_session_id: session.id,
        stripe_price_id: priceId,
        stripe_customer_id: typeof session.customer === 'string' ? session.customer : session.customer?.id,
        auth_required: requireAuth,
        auth_verified: authVerified,
        checkout_auth_verified: authVerified,
        is_test_mode: isTestMode,
      },
    });

    return {
      statusCode: 302,
      headers: {
        Location: session.url,
        'Cache-Control': 'no-store',
      },
      body: '',
    };
  } catch (error) {
    console.error('[create-macra-web-offer-checkout] Error:', error);
    return {
      statusCode: error?.statusCode || 500,
      headers: jsonHeaders,
      body: JSON.stringify({ success: false, error: error?.message || 'Internal error' }),
    };
  }
};
