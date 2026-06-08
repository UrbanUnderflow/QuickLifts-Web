// Unit tests for the pure paid-1-on-1 coaching logic in
// netlify/functions/lib/coaching.js. Pure functions only — no Stripe /
// Firestore IO — so this runs under `node --test` with no harness.

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  PLATFORM_FEE_PERCENT,
  platformFeeCents,
  normalizeInterval,
  priceLabel,
  validatePaidTraining,
  isCoachingSession,
  isCoachingSubscription,
  subscriptionPaymentStatus,
  coachingCheckoutResult,
} = require('../../netlify/functions/lib/coaching');

// --- platformFeeCents -------------------------------------------------

test('platform fee is 3 percent rounded', () => {
  assert.equal(PLATFORM_FEE_PERCENT, 3);
  assert.equal(platformFeeCents(9900), 297);   // $99 → $2.97
  assert.equal(platformFeeCents(10000), 300);  // $100 → $3.00
  assert.equal(platformFeeCents(2500), 75);    // $25 → $0.75
  assert.equal(platformFeeCents(199), 6);      // rounds 5.97 → 6
  assert.equal(platformFeeCents(0), 0);
  assert.equal(platformFeeCents(undefined), 0);
});

// --- normalizeInterval ------------------------------------------------

test('normalizeInterval passes valid intervals and defaults to month', () => {
  assert.equal(normalizeInterval('week'), 'week');
  assert.equal(normalizeInterval('month'), 'month');
  assert.equal(normalizeInterval('year'), 'year');
  assert.equal(normalizeInterval('fortnight'), 'month');
  assert.equal(normalizeInterval(undefined), 'month');
  assert.equal(normalizeInterval(null), 'month');
});

// --- priceLabel -------------------------------------------------------

test('priceLabel formats one-time and recurring prices', () => {
  assert.equal(priceLabel({ mode: 'oneTime', amountCents: 9900 }), '$99 one-time');
  assert.equal(priceLabel({ mode: 'oneTime', amountCents: 2999 }), '$29.99 one-time');
  assert.equal(priceLabel({ mode: 'recurring', amountCents: 9900, interval: 'month' }), '$99/mo');
  assert.equal(priceLabel({ mode: 'recurring', amountCents: 2500, interval: 'week' }), '$25/wk');
  assert.equal(priceLabel({ mode: 'recurring', amountCents: 90000, interval: 'year' }), '$900/yr');
  // recurring with missing interval defaults to /mo suffix
  assert.equal(priceLabel({ mode: 'recurring', amountCents: 5000 }), '$50/mo');
});

test('priceLabel returns null for free / empty pricing', () => {
  assert.equal(priceLabel(null), null);
  assert.equal(priceLabel(undefined), null);
  assert.equal(priceLabel({ mode: 'oneTime', amountCents: 0 }), null);
  assert.equal(priceLabel({}), null);
});

// --- validatePaidTraining --------------------------------------------

const oneTimeTraining = {
  hostId: 'host_1',
  hostInfo: { username: 'coachjoe' },
  pricing: { mode: 'oneTime', amountCents: 9900, currency: 'USD' },
};
const recurringTraining = {
  hostId: 'host_1',
  hostInfo: { username: 'coachjoe' },
  pricing: { mode: 'recurring', amountCents: 9900, currency: 'usd', interval: 'week' },
};

test('validatePaidTraining accepts a valid one-time room', () => {
  const r = validatePaidTraining(oneTimeTraining, 'oneTime');
  assert.equal(r.ok, true);
  assert.equal(r.amountCents, 9900);
  assert.equal(r.currency, 'usd'); // lowercased
  assert.equal(r.interval, null);
  assert.equal(r.hostId, 'host_1');
  assert.equal(r.coachName, 'coachjoe');
});

test('validatePaidTraining accepts a valid recurring room and normalizes interval', () => {
  const r = validatePaidTraining(recurringTraining, 'recurring');
  assert.equal(r.ok, true);
  assert.equal(r.interval, 'week');
  assert.equal(r.currency, 'usd');
});

test('validatePaidTraining rejects mode mismatch', () => {
  assert.equal(validatePaidTraining(oneTimeTraining, 'recurring').ok, false);
  assert.equal(validatePaidTraining(recurringTraining, 'oneTime').ok, false);
  assert.match(validatePaidTraining(oneTimeTraining, 'recurring').error, /recurring/);
});

test('validatePaidTraining rejects below-minimum and missing amounts', () => {
  const cheap = { hostId: 'h', pricing: { mode: 'oneTime', amountCents: 25 } };
  assert.equal(validatePaidTraining(cheap, 'oneTime').ok, false);
  assert.match(validatePaidTraining(cheap, 'oneTime').error, /price/i);

  const noAmount = { hostId: 'h', pricing: { mode: 'oneTime' } };
  assert.equal(validatePaidTraining(noAmount, 'oneTime').ok, false);
});

test('validatePaidTraining rejects missing host and missing training', () => {
  const noHost = { pricing: { mode: 'oneTime', amountCents: 9900 } };
  const r = validatePaidTraining(noHost, 'oneTime');
  assert.equal(r.ok, false);
  assert.match(r.error, /host/);

  assert.equal(validatePaidTraining(null, 'oneTime').ok, false);
  assert.equal(validatePaidTraining(undefined, 'oneTime').ok, false);
});

test('validatePaidTraining falls back to a generic coach name', () => {
  const noName = { hostId: 'h', pricing: { mode: 'oneTime', amountCents: 9900 } };
  assert.equal(validatePaidTraining(noName, 'oneTime').coachName, 'your coach');
});

// --- session / subscription identification ----------------------------

test('isCoachingSession only true when trainingId metadata present', () => {
  assert.equal(isCoachingSession({ metadata: { trainingId: 't1' } }), true);
  assert.equal(isCoachingSession({ metadata: { challengeId: 'c1' } }), false);
  assert.equal(isCoachingSession({ metadata: {} }), false);
  assert.equal(isCoachingSession({}), false);
  assert.equal(isCoachingSession(null), false);
});

test('isCoachingSubscription requires trainingId + coaching payment_type', () => {
  assert.equal(isCoachingSubscription({ metadata: { trainingId: 't1', payment_type: 'coaching_subscription' } }), true);
  assert.equal(isCoachingSubscription({ metadata: { trainingId: 't1', payment_type: 'other' } }), false);
  assert.equal(isCoachingSubscription({ metadata: { payment_type: 'coaching_subscription' } }), false);
  assert.equal(isCoachingSubscription(null), false);
});

// --- subscriptionPaymentStatus ---------------------------------------

test('subscriptionPaymentStatus maps Stripe statuses to room paymentStatus', () => {
  assert.equal(subscriptionPaymentStatus('active'), 'active');
  assert.equal(subscriptionPaymentStatus('trialing'), 'active');
  assert.equal(subscriptionPaymentStatus('past_due'), 'pastDue');
  assert.equal(subscriptionPaymentStatus('unpaid'), 'pastDue');
  assert.equal(subscriptionPaymentStatus('canceled'), 'canceled');
  assert.equal(subscriptionPaymentStatus('incomplete_expired'), 'canceled');
  assert.equal(subscriptionPaymentStatus('paused'), 'canceled');
  assert.equal(subscriptionPaymentStatus('anything-unknown'), 'canceled');
});

// --- coachingCheckoutResult ------------------------------------------

const fixedDate = new Date('2026-06-08T00:00:00Z');

test('coachingCheckoutResult builds one-time update + transaction', () => {
  const session = {
    id: 'cs_1',
    mode: 'payment',
    amount_total: 9900,
    currency: 'usd',
    payment_intent: 'pi_1',
    client_reference_id: 'buyer_1',
    metadata: { trainingId: 't1', buyerId: 'buyer_1', hostId: 'host_1', payment_type: 'coaching_purchase' },
  };
  const r = coachingCheckoutResult(session, { nowSeconds: 1000, nowDate: fixedDate });
  assert.equal(r.trainingId, 't1');
  assert.equal(r.isSubscription, false);
  assert.deepEqual(r.update, {
    status: 'active',
    paymentStatus: 'paid',
    acceptedAt: 1000,
    updatedAt: fixedDate,
    memberId: 'buyer_1',
    participantIds: ['host_1', 'buyer_1'],
  });
  assert.equal(r.transaction.type, 'coaching_purchase');
  assert.equal(r.transaction.amount, 99);
  assert.equal(r.transaction.ownerId, 'host_1');
  assert.equal(r.transaction.buyerId, 'buyer_1');
  assert.equal(r.transaction.paymentIntentId, 'pi_1');
  assert.equal(r.transaction.subscriptionId, null);
  assert.equal(r.transaction.status, 'completed');
});

test('coachingCheckoutResult builds subscription update with stripeSubscriptionId', () => {
  const session = {
    id: 'cs_2',
    mode: 'subscription',
    amount_total: 2500,
    currency: 'usd',
    subscription: 'sub_1',
    client_reference_id: 'buyer_2',
    metadata: { trainingId: 't2', buyerId: 'buyer_2', hostId: 'host_2', payment_type: 'coaching_subscription' },
  };
  const r = coachingCheckoutResult(session, { nowSeconds: 2000, nowDate: fixedDate });
  assert.equal(r.isSubscription, true);
  assert.equal(r.update.paymentStatus, 'active');
  assert.equal(r.update.stripeSubscriptionId, 'sub_1');
  assert.equal(r.update.memberId, 'buyer_2');
  assert.deepEqual(r.update.participantIds, ['host_2', 'buyer_2']);
  assert.equal(r.transaction.type, 'coaching_subscription');
  assert.equal(r.transaction.subscriptionId, 'sub_1');
  assert.equal(r.transaction.amount, 25);
});

test('coachingCheckoutResult treats subscription mode even without payment_type', () => {
  const session = { id: 'cs_3', mode: 'subscription', amount_total: 1000, subscription: 'sub_x', metadata: { trainingId: 't3' } };
  const r = coachingCheckoutResult(session, { nowSeconds: 1, nowDate: fixedDate });
  assert.equal(r.isSubscription, true);
  assert.equal(r.update.paymentStatus, 'active');
});

test('coachingCheckoutResult falls back to client_reference_id for buyer', () => {
  const session = { id: 'cs_4', mode: 'payment', amount_total: 9900, client_reference_id: 'ref_buyer', metadata: { trainingId: 't4', hostId: 'h4' } };
  const r = coachingCheckoutResult(session, { nowSeconds: 1, nowDate: fixedDate });
  assert.equal(r.update.memberId, 'ref_buyer');
  assert.deepEqual(r.update.participantIds, ['h4', 'ref_buyer']);
});

test('coachingCheckoutResult returns null when not a coaching session', () => {
  assert.equal(coachingCheckoutResult({ metadata: {} }), null);
  assert.equal(coachingCheckoutResult({ metadata: { challengeId: 'c1' } }), null);
});

test('coachingCheckoutResult omits participantIds when host missing', () => {
  const session = { id: 'cs_5', mode: 'payment', amount_total: 9900, metadata: { trainingId: 't5', buyerId: 'b5' } };
  const r = coachingCheckoutResult(session, { nowSeconds: 1, nowDate: fixedDate });
  assert.equal(r.update.memberId, 'b5');
  assert.equal(r.update.participantIds, undefined);
});
