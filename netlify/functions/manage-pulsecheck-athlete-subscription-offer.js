const Stripe = require('stripe');
const { headers } = require('./config/firebase');
const {
  resolveServerStripeMode,
  verifyFirebaseUser,
} = require('./lib/pulsecheck-coach-services');
const {
  ATHLETE_APP_PAYMENT_TYPE,
  OFFERS_COLLECTION,
  PLATFORM_SHARE_PERCENT,
  authorizeOfferManager,
  normalizeOfferPriceCents,
  normalizeString,
  publicOffer,
  requestError,
  stripeModeRecord,
} = require('./lib/pulsecheck-athlete-app-offers');

const jsonHeaders = {
  ...headers,
  'Content-Type': 'application/json',
  'Cache-Control': 'private, no-store',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-PulseCheck-Firebase-Mode, X-Force-Dev-Firebase, X-PulseCheck-Dev-Firebase',
};

const json = (statusCode, body) => ({
  statusCode,
  headers: jsonHeaders,
  body: JSON.stringify(body),
});

const stripeClientForMode = (mode) => {
  const key = normalizeString(
    mode === 'test'
      ? process.env.STRIPE_TEST_SECRET_KEY
      : process.env.STRIPE_SECRET_KEY
  );
  if (!key) throw requestError('Stripe subscription pricing is not configured.', 503);
  return new Stripe(key);
};

const archivePrice = async (stripe, priceId) => {
  if (!priceId) return;
  try {
    await stripe.prices.update(priceId, { active: false });
  } catch (error) {
    console.warn('[AthleteAppOffer] Previous Stripe price could not be archived:', error?.message || error);
  }
};

const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: jsonHeaders, body: '' };
  if (event.httpMethod !== 'POST') return json(405, { success: false, message: 'Method Not Allowed' });

  try {
    const authenticated = await verifyFirebaseUser(event, {
      authErrorMessage: 'Sign in is required to manage athlete subscription pricing.',
    });
    const database = authenticated.app.firestore();
    const body = JSON.parse(event.body || '{}');
    const teamId = normalizeString(body.teamId);
    if (typeof body.enabled !== 'boolean') {
      throw requestError('Choose whether athlete subscriptions are active.');
    }
    const enabled = body.enabled;
    const authorization = await authorizeOfferManager({
      database,
      userId: authenticated.userId,
      decoded: authenticated.decoded,
      teamId,
    });
    const offerRef = database.collection(OFFERS_COLLECTION).doc(teamId);
    const existingSnapshot = await offerRef.get();
    const existing = existingSnapshot.exists
      ? { id: existingSnapshot.id, ...(existingSnapshot.data() || {}) }
      : null;
    const monthlyPriceCents = enabled
      ? normalizeOfferPriceCents(body.monthlyPriceCents)
      : Math.max(0, Math.round(Number(existing?.monthlyPriceCents) || 0));
    const stripeMode = resolveServerStripeMode();
    let stripe = null;
    if (enabled) {
      stripe = stripeClientForMode(stripeMode);
    } else {
      try {
        stripe = stripeClientForMode(stripeMode);
      } catch (error) {
        console.warn('[AthleteAppOffer] Stripe is unavailable while pausing sales; local access is still being disabled:', error?.message || error);
      }
    }
    const currentMode = stripeModeRecord(existing, stripeMode);
    const existingVersion = Math.max(0, Math.round(Number(existing?.version) || 0));
    const configurationChanged = !existing
      || existing.enabled !== enabled
      || Number(existing.monthlyPriceCents) !== monthlyPriceCents
      || normalizeString(existing.currency) !== 'usd'
      || normalizeString(existing.interval) !== 'month';
    const version = configurationChanged ? existingVersion + 1 : existingVersion || 1;
    let productId = normalizeString(currentMode.productId);
    let priceId = normalizeString(currentMode.priceId);
    let priceActive = currentMode.active === true;
    const priceNeedsCreation = enabled && (
      !priceId
      || !productId
      || !priceActive
      || Number(currentMode.unitAmount) !== monthlyPriceCents
    );

    if (priceNeedsCreation) {
      if (!productId) {
        const product = await stripe.products.create({
          name: `${normalizeString(authorization.team.displayName) || 'PulseCheck team'} athlete subscription`,
          description: 'Monthly PulseCheck app access through a coach team invite.',
          metadata: {
            payment_type: ATHLETE_APP_PAYMENT_TYPE,
            pulsecheckTeamId: teamId,
            pulsecheckOrganizationId: authorization.organizationId,
          },
        }, {
          idempotencyKey: `pc-athlete-app-product:${stripeMode}:${teamId}`,
        });
        productId = normalizeString(product.id);
      }
      const price = await stripe.prices.create({
        product: productId,
        unit_amount: monthlyPriceCents,
        currency: 'usd',
        recurring: { interval: 'month', interval_count: 1 },
        metadata: {
          payment_type: ATHLETE_APP_PAYMENT_TYPE,
          pulsecheckTeamId: teamId,
          pulsecheckOrganizationId: authorization.organizationId,
          pulsecheckOfferVersion: String(version),
        },
      }, {
        idempotencyKey: `pc-athlete-app-price:${stripeMode}:${teamId}:${version}:${monthlyPriceCents}`,
      });
      priceId = normalizeString(price.id);
      priceActive = true;
    }

    const revenueRecipientUserId = normalizeString(
      existing?.revenueRecipientUserId
      || (existing
        ? authorization.team?.commercialConfig?.athleteAppSubscriptionRevenueRecipientUserId
        : '')
      || authorization.team?.commercialConfig?.revenueRecipientUserId
      || (enabled ? authenticated.userId : '')
    );
    const previousPriceId = normalizeString(currentMode.priceId);
    const nextStripeByMode = {
      ...(existing?.stripeByMode || {}),
      [stripeMode]: {
        productId: productId || null,
        priceId: priceId || null,
        unitAmount: monthlyPriceCents,
        currency: 'usd',
        interval: 'month',
        active: enabled && priceActive,
        updatedAt: new Date(),
      },
    };
    const now = new Date();
    const offerRecord = {
      offerId: teamId,
      organizationId: authorization.organizationId,
      teamId,
      enabled,
      status: enabled ? 'active' : 'inactive',
      monthlyPriceCents,
      currency: 'usd',
      interval: 'month',
      intervalCount: 1,
      version,
      platformSharePercent: PLATFORM_SHARE_PERCENT,
      feePolicy: 'coach-pays-actual-stripe-processing-fee',
      revenueRecipientUserId,
      stripeByMode: nextStripeByMode,
      updatedByUserId: authenticated.userId,
      updatedAt: now,
      createdAt: existing?.createdAt || now,
    };
    const commercialConfig = {
      ...(authorization.team.commercialConfig || {}),
      athleteAppSubscriptionEnabled: enabled,
      athleteAppSubscriptionMonthlyPriceCents: monthlyPriceCents,
      athleteAppSubscriptionCurrency: 'usd',
      athleteAppSubscriptionOfferVersion: version,
      athleteAppSubscriptionRevenueRecipientUserId: revenueRecipientUserId,
    };
    const batch = database.batch();
    batch.set(offerRef, offerRecord, { merge: true });
    batch.set(database.collection('pulsecheck-teams').doc(teamId), {
      commercialConfig,
      updatedAt: now,
    }, { merge: true });
    await batch.commit();

    if (stripe && previousPriceId && (previousPriceId !== priceId || !enabled)) {
      await archivePrice(stripe, previousPriceId);
    }

    return json(200, {
      success: true,
      offer: publicOffer({ id: teamId, ...offerRecord }),
      commercialConfig: {
        athleteAppSubscriptionEnabled: enabled,
        athleteAppSubscriptionMonthlyPriceCents: monthlyPriceCents,
        athleteAppSubscriptionCurrency: 'usd',
        athleteAppSubscriptionOfferVersion: version,
        athleteAppSubscriptionRevenueRecipientUserId: revenueRecipientUserId,
      },
    });
  } catch (error) {
    const statusCode = Number(error?.statusCode) || (error instanceof SyntaxError ? 400 : 500);
    if (statusCode >= 500) console.error('[AthleteAppOffer] Failed to manage offer:', error);
    return json(statusCode, {
      success: false,
      message: error?.message || 'Athlete subscription pricing could not be saved.',
    });
  }
};

module.exports = { handler };
