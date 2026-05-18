/**
 * Create Athlete Checkout Session
 * 
 * Creates Stripe checkout sessions for athlete subscriptions.
 * PulseCheck commercial attribution is derived from the org/team invite path.
 */

const Stripe = require('stripe');
const { admin, db, headers } = require('./config/firebase');

// Helper to determine if the request is from localhost
const isLocalhostRequest = (event) => {
  const referer = event.headers.referer || event.headers.origin || '';
  return referer.includes('localhost') || referer.includes('127.0.0.1');
};

// Initialize Stripe with the appropriate key based on environment
const getStripeInstance = (event) => {
  if (isLocalhostRequest(event)) {
    console.log('[AthleteCheckout] Request from localhost, using TEST mode');
    return new Stripe(process.env.STRIPE_TEST_SECRET_KEY || process.env.STRIPE_SECRET_KEY);
  }
  
  console.log('[AthleteCheckout] Request from production, using LIVE mode');
  return new Stripe(process.env.STRIPE_SECRET_KEY);
};

const USERS_COLLECTION = 'users';
const TEAMS_COLLECTION = 'pulsecheck-teams';
const INVITE_LINKS_COLLECTION = 'pulsecheck-invite-links';

const LIVE_ATHLETE_MONTHLY_PRICE_ID = 'price_1PDq26RobSf56MUOucDIKLhd';
const LIVE_ATHLETE_ANNUAL_PRICE_ID = 'price_1PDq3LRobSf56MUOng0UxhCC';
const TEST_ATHLETE_MONTHLY_PRICE_ID = 'price_1RMIUNRobSf56MUOfeB4gIot';
const TEST_ATHLETE_ANNUAL_PRICE_ID = 'price_1RMISFRobSf56MUOpcSoohjP';

const normalizeString = (value) => (typeof value === 'string' ? value.trim() : '');

const normalizeFirebaseIdToken = (value) => {
  const token = normalizeString(value);
  return token.replace(/^Bearer\s+/i, '');
};

const firebaseIdTokenFromRequest = (event, explicitToken) => {
  const authHeader = event.headers.authorization || event.headers.Authorization || '';
  return normalizeFirebaseIdToken(explicitToken || authHeader);
};

const verifyCheckoutFirebaseToken = async ({ firebaseIdToken, requestedUserId }) => {
  const normalizedToken = normalizeFirebaseIdToken(firebaseIdToken);
  const normalizedRequestedUserId = normalizeString(requestedUserId);

  if (!normalizedToken) {
    return {
      userId: normalizedRequestedUserId,
      verified: false,
    };
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
      const error = new Error('Firebase token user does not match requested user.');
      error.statusCode = 403;
      throw error;
    }

    return {
      userId: normalizedRequestedUserId || tokenUserId,
      verified: true,
    };
  } catch (error) {
    if (!error.statusCode) error.statusCode = 401;
    throw error;
  }
};

const normalizeCheckoutPlan = (value) => {
  const normalized = normalizeString(value).toLowerCase();
  if (['monthly', 'month', 'mo'].includes(normalized)) return 'monthly';
  if (['annual', 'yearly', 'year', 'yr'].includes(normalized)) return 'annual';
  return 'annual';
};

const resolveAthletePriceId = ({ priceId, plan, isLocalhost }) => {
  const providedPriceId = normalizeString(priceId);
  if (providedPriceId) return providedPriceId;

  const normalizedPlan = normalizeCheckoutPlan(plan);
  if (normalizedPlan === 'monthly') {
    if (isLocalhost) {
      return process.env.STRIPE_TEST_PRICE_ATHLETE_MONTHLY || TEST_ATHLETE_MONTHLY_PRICE_ID;
    }

    return (
      process.env.STRIPE_PRICE_ATHLETE_MONTHLY ||
      process.env.NEXT_PUBLIC_STRIPE_PRICE_ATHLETE_MONTHLY ||
      LIVE_ATHLETE_MONTHLY_PRICE_ID
    );
  }

  if (isLocalhost) {
    return process.env.STRIPE_TEST_PRICE_ATHLETE_ANNUAL || TEST_ATHLETE_ANNUAL_PRICE_ID;
  }

  return (
    process.env.STRIPE_PRICE_ATHLETE_ANNUAL ||
    process.env.NEXT_PUBLIC_STRIPE_PRICE_ATHLETE_ANNUAL ||
    LIVE_ATHLETE_ANNUAL_PRICE_ID
  );
};

const normalizeAppReturnUrl = (value) => {
  const candidate = normalizeString(value);
  if (!candidate) return '';

  try {
    const parsed = new URL(candidate);
    const host = parsed.hostname.toLowerCase();
    const allowedFirstPartyHost =
      host === 'fitwithpulse.ai' ||
      host === 'www.fitwithpulse.ai' ||
      host === 'localhost' ||
      host === '127.0.0.1';
    const allowedFirstPartyAppProtocol =
      parsed.protocol === 'macra:' ||
      parsed.protocol === 'pulseritual:';
    if (allowedFirstPartyAppProtocol || allowedFirstPartyHost) {
      return parsed.toString();
    }
  } catch {
    return '';
  }

  return '';
};

const buildReturnUrl = (baseReturnUrl, params = {}) => {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value) !== '') {
      searchParams.set(key, String(value));
    }
  });

  try {
    const url = new URL(baseReturnUrl);
    searchParams.forEach((value, key) => {
      url.searchParams.set(key, value);
    });
    return url
      .toString()
      .replace(/%7BCHECKOUT_SESSION_ID%7D/g, '{CHECKOUT_SESSION_ID}');
  } catch {
    const separator = baseReturnUrl.includes('?') ? '&' : '?';
    return `${baseReturnUrl}${separator}${searchParams.toString()}`
      .replace(/%7BCHECKOUT_SESSION_ID%7D/g, '{CHECKOUT_SESSION_ID}');
  }
};

const subscriptionSuccessUrl = ({ baseUrl, userId, appReturnUrl, source }) => {
  const params = {
    session_id: '{CHECKOUT_SESSION_ID}',
    userId,
    source,
  };
  if (appReturnUrl) params.appReturnUrl = appReturnUrl;
  return buildReturnUrl(`${baseUrl}/subscription-success`, params);
};

const subscriptionCancelUrl = ({ baseUrl, fallback, appCancelUrl, userId, source }) => {
  if (!appCancelUrl) return fallback;
  return buildReturnUrl(`${baseUrl}/subscription-success`, {
    cancelled: '1',
    userId,
    source,
    appReturnUrl: appCancelUrl,
  });
};

const normalizeBoolean = (value) => {
  if (typeof value === 'boolean') return value;
  const normalized = normalizeString(String(value || '')).toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes';
};

const normalizeRevenueSharePct = (value) => {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(String(value ?? ''));
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.min(100, Math.round(parsed * 100) / 100));
};

const normalizeCommercialConfig = (value) => {
  const candidate = value && typeof value === 'object' ? value : {};
  return {
    commercialModel: normalizeString(candidate.commercialModel) === 'team-plan' ? 'team-plan' : 'athlete-pay',
    teamPlanStatus: normalizeString(candidate.teamPlanStatus) === 'active' ? 'active' : 'inactive',
    referralKickbackEnabled: normalizeBoolean(candidate.referralKickbackEnabled),
    referralRevenueSharePct: normalizeRevenueSharePct(candidate.referralRevenueSharePct),
    revenueRecipientRole:
      normalizeString(candidate.revenueRecipientRole) === 'coach'
        ? 'coach'
        : normalizeString(candidate.revenueRecipientRole) === 'organization-owner'
          ? 'organization-owner'
          : 'team-admin',
    revenueRecipientUserId: normalizeString(candidate.revenueRecipientUserId),
    billingOwnerUserId: normalizeString(candidate.billingOwnerUserId),
    billingCustomerId: normalizeString(candidate.billingCustomerId),
  };
};

const buildCommercialSnapshot = ({ organizationId, teamId, inviteToken, commercialConfig }) => {
  const normalizedConfig = normalizeCommercialConfig(commercialConfig);
  return {
    ...normalizedConfig,
    sourceOrganizationId: normalizeString(organizationId),
    sourceTeamId: normalizeString(teamId),
    inviteToken: normalizeString(inviteToken),
    teamPlanBypassesPaywall:
      normalizedConfig.commercialModel === 'team-plan' && normalizedConfig.teamPlanStatus === 'active',
  };
};

const resolvePulseCheckAttribution = async ({ userId, organizationId, teamId, inviteToken }) => {
  let userData = null;
  let resolvedOrganizationId = normalizeString(organizationId);
  let resolvedTeamId = normalizeString(teamId);
  let resolvedInviteToken = normalizeString(inviteToken);
  let commercialSnapshot = null;

  try {
    const userDoc = await db.collection(USERS_COLLECTION).doc(userId).get();
    userData = userDoc.exists ? userDoc.data() || {} : null;
  } catch (error) {
    console.warn('[AthleteCheckout] Failed to load user for PulseCheck attribution:', error);
  }

  if (!resolvedInviteToken) {
    resolvedInviteToken =
      normalizeString(userData?.pulseCheckTeamCommercialAccess?.inviteToken) ||
      normalizeString(userData?.onboardInvite?.token);
  }
  if (!resolvedTeamId) {
    resolvedTeamId =
      normalizeString(userData?.pulseCheckTeamCommercialAccess?.sourceTeamId) ||
      normalizeString(userData?.onboardInvite?.teamId);
  }
  if (!resolvedOrganizationId) {
    resolvedOrganizationId =
      normalizeString(userData?.pulseCheckTeamCommercialAccess?.sourceOrganizationId) ||
      normalizeString(userData?.onboardInvite?.organizationId);
  }

  if (userData?.pulseCheckTeamCommercialAccess) {
    commercialSnapshot = buildCommercialSnapshot({
      organizationId: resolvedOrganizationId || userData.pulseCheckTeamCommercialAccess.sourceOrganizationId,
      teamId: resolvedTeamId || userData.pulseCheckTeamCommercialAccess.sourceTeamId,
      inviteToken: resolvedInviteToken || userData.pulseCheckTeamCommercialAccess.inviteToken,
      commercialConfig: userData.pulseCheckTeamCommercialAccess,
    });
  }

  if (resolvedInviteToken) {
    try {
      const inviteDoc = await db.collection(INVITE_LINKS_COLLECTION).doc(resolvedInviteToken).get();
      const inviteData = inviteDoc.exists ? inviteDoc.data() || {} : null;
      if (inviteData) {
        resolvedOrganizationId = resolvedOrganizationId || normalizeString(inviteData.organizationId);
        resolvedTeamId = resolvedTeamId || normalizeString(inviteData.teamId);
        if (inviteData.commercialSnapshot) {
          commercialSnapshot = buildCommercialSnapshot({
            organizationId: resolvedOrganizationId,
            teamId: resolvedTeamId,
            inviteToken: resolvedInviteToken,
            commercialConfig: inviteData.commercialSnapshot,
          });
        }
      }
    } catch (error) {
      console.warn('[AthleteCheckout] Failed to load invite for PulseCheck attribution:', error);
    }
  }

  if (resolvedTeamId) {
    try {
      const teamDoc = await db.collection(TEAMS_COLLECTION).doc(resolvedTeamId).get();
      const teamData = teamDoc.exists ? teamDoc.data() || {} : null;
      if (teamData) {
        resolvedOrganizationId = resolvedOrganizationId || normalizeString(teamData.organizationId);
        if (!commercialSnapshot) {
          commercialSnapshot = buildCommercialSnapshot({
            organizationId: resolvedOrganizationId,
            teamId: resolvedTeamId,
            inviteToken: resolvedInviteToken,
            commercialConfig: teamData.commercialConfig,
          });
        }
      }
    } catch (error) {
      console.warn('[AthleteCheckout] Failed to load team for PulseCheck attribution:', error);
    }
  }

  return {
    userData,
    organizationId: resolvedOrganizationId,
    teamId: resolvedTeamId,
    inviteToken: resolvedInviteToken,
    commercialSnapshot,
  };
};

const handler = async (event) => {
  console.log(`[AthleteCheckout] Received ${event.httpMethod} request.`);

  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  // Initialize Stripe with the appropriate key based on origin
  const stripe = getStripeInstance(event);

  // Support server-side redirect flow for better mobile behavior
  if (event.httpMethod === 'GET') {
    const qp = event.queryStringParameters || {};
    let userId = normalizeString(qp.userId);
    const email = normalizeString(qp.email);
    const organizationId = normalizeString(qp.organizationId);
    const teamId = normalizeString(qp.teamId);
    const inviteToken = normalizeString(qp.inviteToken);
    const plan = normalizeCheckoutPlan(qp.plan);
    const source = normalizeString(qp.source);
    const appReturnUrl = normalizeAppReturnUrl(qp.appReturnUrl);
    const appCancelUrl = normalizeAppReturnUrl(qp.appCancelUrl);
    const firebaseIdToken = firebaseIdTokenFromRequest(event, qp.firebaseIdToken || qp.authToken);
    const debug = qp.debug === '1' || qp.debug === 'true';
    const isLocalhost = isLocalhostRequest(event);
    const priceId = resolveAthletePriceId({
      priceId: qp.priceId,
      plan,
      isLocalhost,
    });
    let checkoutAuthVerified = false;

    try {
      const authResult = await verifyCheckoutFirebaseToken({
        firebaseIdToken,
        requestedUserId: userId,
      });
      userId = authResult.userId;
      checkoutAuthVerified = authResult.verified;
    } catch (authError) {
      console.warn('[AthleteCheckout][GET] Invalid checkout auth token:', authError);
      return {
        statusCode: authError.statusCode || 401,
        headers,
        body: JSON.stringify({
          message: 'Unable to verify signed-in app user.',
          ...(debug ? { error: authError?.message, code: authError?.code } : {})
        })
      };
    }

    if (!priceId || !userId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ message: 'Missing required parameters: userId and a resolvable priceId or plan' })
      };
    }

    try {
      const siteUrl = process.env.SITE_URL || 'https://fitwithpulse.ai';
      const baseUrl = isLocalhost ? (event.headers.origin || 'http://localhost:8888') : siteUrl;
      const attribution = await resolvePulseCheckAttribution({
        userId,
        organizationId,
        teamId,
        inviteToken,
      });

      if (attribution.commercialSnapshot?.teamPlanBypassesPaywall) {
        const coveredLocation = appReturnUrl
          ? buildReturnUrl(appReturnUrl, {
              status: 'success',
              userId,
              source,
              coveredByTeamPlan: '1',
            })
          : attribution.organizationId && attribution.teamId
            ? `${baseUrl}/PulseCheck/team-workspace?organizationId=${encodeURIComponent(attribution.organizationId)}&teamId=${encodeURIComponent(attribution.teamId)}&teamPlan=1`
            : `${baseUrl}/PulseCheck?web=1`;

        return {
          statusCode: 302,
          headers: {
            ...headers,
            Location: coveredLocation,
            'Cache-Control': 'no-store',
          },
          body: '',
        };
      }

      const metadata = {
        userId,
        userType: 'athlete',
        pulsecheckOrganizationId: attribution.organizationId || '',
        pulsecheckTeamId: attribution.teamId || '',
        pulsecheckInviteToken: attribution.inviteToken || '',
        pulsecheckCommercialModel: attribution.commercialSnapshot?.commercialModel || '',
        pulsecheckTeamPlanStatus: attribution.commercialSnapshot?.teamPlanStatus || '',
        pulsecheckTeamPlanBypassesPaywall: attribution.commercialSnapshot?.teamPlanBypassesPaywall ? 'true' : 'false',
        pulsecheckReferralKickbackEnabled: attribution.commercialSnapshot?.referralKickbackEnabled ? 'true' : 'false',
        pulsecheckReferralRevenueSharePct: String(attribution.commercialSnapshot?.referralRevenueSharePct || 0),
        pulsecheckRevenueRecipientUserId: attribution.commercialSnapshot?.revenueRecipientUserId || '',
        pulsecheckRevenueRecipientRole: attribution.commercialSnapshot?.revenueRecipientRole || '',
        checkoutSource: source || '',
        checkoutPlan: plan || '',
        appReturnUrlProvided: appReturnUrl ? 'true' : 'false',
        checkoutAuthVerified: checkoutAuthVerified ? 'true' : 'false',
      };

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [ { price: priceId, quantity: 1 } ],
        mode: 'subscription',
        client_reference_id: userId,
        ...(email ? { customer_email: email } : {}),
        success_url: subscriptionSuccessUrl({
          baseUrl,
          userId,
          appReturnUrl,
          source,
        }),
        cancel_url: subscriptionCancelUrl({
          baseUrl,
          fallback: `${baseUrl}/subscribe`,
          appCancelUrl,
          userId,
          source,
        }),
        metadata,
        subscription_data: {
          metadata,
        }
      });

      return {
        statusCode: 302,
        headers: {
          ...headers,
          Location: session.url,
          'Cache-Control': 'no-store'
        },
        body: ''
      };
    } catch (err) {
      console.error('[AthleteCheckout][GET] Error creating session:', err);
      return { 
        statusCode: 500, 
        headers, 
        body: JSON.stringify({ 
          message: 'Failed to create athlete checkout session.',
          ...(debug ? { error: err?.message, code: err?.code } : {})
        }) 
      };
    }
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ message: 'Method Not Allowed' }),
    };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch (e) {
    console.error("[AthleteCheckout] Error parsing request body:", e);
    return { 
      statusCode: 400, 
      headers,
      body: JSON.stringify({ message: 'Invalid request body.' }) 
    };
  }

  const { 
    priceId, 
    userId: bodyUserId,
    email, // Optional: prefill Checkout email
    organizationId,
    teamId,
    inviteToken,
    plan,
    source,
    appReturnUrl,
    appCancelUrl,
    firebaseIdToken: bodyFirebaseIdToken,
    authToken,
  } = body || {};
  let userId = normalizeString(bodyUserId);
  const isLocalhost = isLocalhostRequest(event);
  const resolvedPriceId = resolveAthletePriceId({
    priceId,
    plan,
    isLocalhost,
  });
  const normalizedPlan = normalizeCheckoutPlan(plan);
  const normalizedSource = normalizeString(source);
  const normalizedAppReturnUrl = normalizeAppReturnUrl(appReturnUrl);
  const normalizedAppCancelUrl = normalizeAppReturnUrl(appCancelUrl);
  const firebaseIdToken = firebaseIdTokenFromRequest(event, bodyFirebaseIdToken || authToken);
  let checkoutAuthVerified = false;

  try {
    const authResult = await verifyCheckoutFirebaseToken({
      firebaseIdToken,
      requestedUserId: userId,
    });
    userId = authResult.userId;
    checkoutAuthVerified = authResult.verified;
  } catch (authError) {
    console.warn('[AthleteCheckout] Invalid checkout auth token:', authError);
    return {
      statusCode: authError.statusCode || 401,
      headers,
      body: JSON.stringify({
        message: 'Unable to verify signed-in app user.',
        error: authError?.message,
      }),
    };
  }

  if (!resolvedPriceId || !userId) {
    console.warn('[AthleteCheckout] Missing parameters:', { 
      priceId: !!resolvedPriceId,
      userId: !!userId 
    });
    return { 
      statusCode: 400, 
      headers,
      body: JSON.stringify({ 
        message: 'Missing required parameters: userId and a resolvable priceId or plan',
        debug: { priceId: resolvedPriceId, userId }
      }) 
    };
  }

  // Validate that this is an athlete price ID
  // Accept both legacy Pulse (athlete) and PulseCheck price envs (if set).
  // NOTE: We do not hard fail if priceId is not in this list; client provides the exact Stripe Price ID.
  const validAthletePrices = [
    process.env.STRIPE_TEST_PRICE_ATHLETE_MONTHLY,
    process.env.STRIPE_TEST_PRICE_ATHLETE_ANNUAL,
    process.env.STRIPE_PRICE_ATHLETE_MONTHLY,
    process.env.STRIPE_PRICE_ATHLETE_ANNUAL,
    process.env.STRIPE_PRICE_PULSECHECK_WEEKLY,
    process.env.STRIPE_PRICE_PULSECHECK_MONTHLY,
    process.env.STRIPE_PRICE_PULSECHECK_ANNUAL
  ].filter(Boolean);

  if (validAthletePrices.length > 0 && !validAthletePrices.includes(resolvedPriceId)) {
    console.warn('[AthleteCheckout] PriceId not in known env list; proceeding anyway for flexibility:', resolvedPriceId);
  }

  const siteUrl = process.env.SITE_URL || 'https://fitwithpulse.ai';

  console.log(`[AthleteCheckout] Creating athlete session for user: ${userId}, price: ${resolvedPriceId}`);

  try {
    // Check if athlete is linked to a coach (which would change the flow)
    const userDoc = await db.collection('users').doc(userId).get();
    
    if (!userDoc.exists) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ 
          message: 'User not found' 
        })
      };
    }

    const attribution = await resolvePulseCheckAttribution({
      userId,
      organizationId,
      teamId,
      inviteToken,
    });
    if (attribution.commercialSnapshot?.teamPlanBypassesPaywall) {
      return {
        statusCode: 409,
        headers,
        body: JSON.stringify({
          message: 'This athlete is covered by an active team plan and does not need a separate checkout session.',
          coveredByTeamPlan: true,
          organizationId: attribution.organizationId,
          teamId: attribution.teamId,
          url: normalizedAppReturnUrl
            ? buildReturnUrl(normalizedAppReturnUrl, {
                status: 'success',
                userId,
                source: normalizedSource,
                coveredByTeamPlan: '1',
              })
            : null,
        }),
      };
    }

    // Determine the base URL for success and cancel redirects
    const baseUrl = isLocalhost ? 
      (event.headers.origin || 'http://localhost:8888') : 
      siteUrl;
    
    console.log(`[AthleteCheckout] Using baseUrl: ${baseUrl}, isLocalhost: ${isLocalhost}`);
    
    // Create metadata for the session
    const metadata = {
      userId: userId,
      userType: 'athlete',
      createdAt: Date.now().toString(),
      pulsecheckOrganizationId: attribution.organizationId || '',
      pulsecheckTeamId: attribution.teamId || '',
      pulsecheckInviteToken: attribution.inviteToken || '',
      pulsecheckCommercialModel: attribution.commercialSnapshot?.commercialModel || '',
      pulsecheckTeamPlanStatus: attribution.commercialSnapshot?.teamPlanStatus || '',
      pulsecheckTeamPlanBypassesPaywall: attribution.commercialSnapshot?.teamPlanBypassesPaywall ? 'true' : 'false',
      pulsecheckReferralKickbackEnabled: attribution.commercialSnapshot?.referralKickbackEnabled ? 'true' : 'false',
      pulsecheckReferralRevenueSharePct: String(attribution.commercialSnapshot?.referralRevenueSharePct || 0),
      pulsecheckRevenueRecipientUserId: attribution.commercialSnapshot?.revenueRecipientUserId || '',
      pulsecheckRevenueRecipientRole: attribution.commercialSnapshot?.revenueRecipientRole || '',
      checkoutSource: normalizedSource || '',
      checkoutPlan: normalizedPlan || '',
      appReturnUrlProvided: normalizedAppReturnUrl ? 'true' : 'false',
      checkoutAuthVerified: checkoutAuthVerified ? 'true' : 'false',
    };

    if (attribution.teamId) {
      metadata.teamAttributionSource = 'pulsecheck-team-invite';
    }

    // Create a Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: resolvedPriceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      client_reference_id: userId,
      ...(email ? { customer_email: email } : {}),
      success_url: subscriptionSuccessUrl({
        baseUrl,
        userId,
        appReturnUrl: normalizedAppReturnUrl,
        source: normalizedSource,
      }),
      cancel_url: subscriptionCancelUrl({
        baseUrl,
        fallback: `${baseUrl}/subscribe`,
        appCancelUrl: normalizedAppCancelUrl,
        userId,
        source: normalizedSource,
      }),
      metadata: metadata,
      subscription_data: {
        metadata
      }
    });

    console.log(`[AthleteCheckout] Athlete session created successfully: ${session.id}`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        sessionId: session.id,
        url: session.url 
      }),
    };

  } catch (error) {
    console.error('[AthleteCheckout] Error creating Stripe session:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        message: error.message || 'Failed to create athlete checkout session.' 
      }),
    };
  }
};

module.exports = { handler };
