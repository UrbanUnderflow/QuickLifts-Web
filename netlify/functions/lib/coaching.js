// Pure, dependency-free business logic for paid 1-on-1 coaching rooms.
// Kept free of Stripe/Firestore IO so it can be unit-tested directly
// (tests/unit/coaching-pricing.test.cjs). The Netlify functions and the
// Stripe webhook import these helpers so the tested logic is the logic
// that ships.

const PLATFORM_FEE_PERCENT = 3;

const VALID_INTERVALS = { week: 'week', month: 'month', year: 'year' };

// Stripe minimum chargeable amount (50 cents).
const MIN_AMOUNT_CENTS = 50;

/** Platform fee in cents for a one-time charge (3%, rounded). */
function platformFeeCents(amountCents) {
  return Math.round(Number(amountCents || 0) * (PLATFORM_FEE_PERCENT / 100));
}

/** Normalize an interval to a Stripe-valid value, defaulting to month. */
function normalizeInterval(interval) {
  return VALID_INTERVALS[interval] || 'month';
}

/** Human price label for display: "$99 one-time" / "$99/mo" / "$25/wk". */
function priceLabel(pricing) {
  if (!pricing || !pricing.amountCents) return null;
  const dollars = Number(pricing.amountCents) / 100;
  const amountStr = Number.isInteger(dollars) ? `$${dollars}` : `$${dollars.toFixed(2)}`;
  if (pricing.mode === 'recurring') {
    const suffix = pricing.interval === 'week' ? 'wk' : pricing.interval === 'year' ? 'yr' : 'mo';
    return `${amountStr}/${suffix}`;
  }
  return `${amountStr} one-time`;
}

/**
 * Validates a training doc for a paid checkout of the expected mode and
 * returns the normalized billing inputs. Pure — no IO. Returns
 * { ok: false, error } or { ok: true, amountCents, currency, interval,
 * hostId, coachName }.
 */
function validatePaidTraining(training, expectedMode) {
  if (!training) return { ok: false, error: 'Training not found' };
  const pricing = training.pricing || {};

  if (pricing.mode !== expectedMode) {
    return {
      ok: false,
      error: expectedMode === 'recurring'
        ? 'Training is not a recurring paid room'
        : 'Training is not a one-time paid room'
    };
  }

  const amountCents = Number(pricing.amountCents || 0);
  if (!amountCents || amountCents < MIN_AMOUNT_CENTS) {
    return { ok: false, error: 'Invalid price' };
  }

  const hostId = training.hostId;
  if (!hostId) return { ok: false, error: 'Training has no host' };

  return {
    ok: true,
    amountCents,
    currency: (pricing.currency || 'USD').toLowerCase(),
    interval: expectedMode === 'recurring' ? normalizeInterval(pricing.interval) : null,
    hostId,
    coachName: (training.hostInfo && training.hostInfo.username) || 'your coach'
  };
}

/** True if a Stripe Checkout session is a coaching purchase/subscription. */
function isCoachingSession(session) {
  return Boolean(session && session.metadata && session.metadata.trainingId);
}

/** True if a Stripe subscription belongs to a coaching room. */
function isCoachingSubscription(subscription) {
  return Boolean(
    subscription &&
    subscription.metadata &&
    subscription.metadata.trainingId &&
    subscription.metadata.payment_type === 'coaching_subscription'
  );
}

/** Map a Stripe subscription status to our training paymentStatus. */
function subscriptionPaymentStatus(stripeStatus) {
  switch (stripeStatus) {
    case 'active':
    case 'trialing':
      return 'active';
    case 'past_due':
    case 'unpaid':
      return 'pastDue';
    default: // canceled, incomplete_expired, incomplete, paused
      return 'canceled';
  }
}

/**
 * Given a completed Checkout session, compute the Firestore update for
 * the training doc and the transaction record to write. Pure — the
 * caller performs the actual writes. `nowSeconds`/`nowDate` are injected
 * for deterministic tests.
 */
function coachingCheckoutResult(session, { nowSeconds, nowDate } = {}) {
  const metadata = (session && session.metadata) || {};
  const trainingId = metadata.trainingId;
  if (!trainingId) return null;

  const buyerId = metadata.buyerId || session.client_reference_id || null;
  const hostId = metadata.hostId || '';
  const isSubscription =
    session.mode === 'subscription' || metadata.payment_type === 'coaching_subscription';

  const update = {
    status: 'active',
    paymentStatus: isSubscription ? 'active' : 'paid',
    acceptedAt: typeof nowSeconds === 'number' ? nowSeconds : Date.now() / 1000,
    updatedAt: nowDate || new Date()
  };
  if (buyerId) {
    update.memberId = buyerId;
    if (hostId) update.participantIds = [hostId, buyerId];
  }
  if (session.subscription) update.stripeSubscriptionId = session.subscription;

  const transaction = {
    type: isSubscription ? 'coaching_subscription' : 'coaching_purchase',
    trainingId,
    ownerId: hostId,
    buyerId: buyerId,
    amount: (session.amount_total || 0) / 100,
    currency: session.currency || 'usd',
    sessionId: session.id,
    paymentIntentId: session.payment_intent || null,
    subscriptionId: session.subscription || null,
    status: 'completed',
    createdAt: nowDate || new Date()
  };

  return { trainingId, isSubscription, update, transaction };
}

module.exports = {
  PLATFORM_FEE_PERCENT,
  VALID_INTERVALS,
  MIN_AMOUNT_CENTS,
  platformFeeCents,
  normalizeInterval,
  priceLabel,
  validatePaidTraining,
  isCoachingSession,
  isCoachingSubscription,
  subscriptionPaymentStatus,
  coachingCheckoutResult
};
