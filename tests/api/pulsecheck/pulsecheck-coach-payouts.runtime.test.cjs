const assert = require('node:assert/strict');
const test = require('node:test');

const {
  buildPayoutSummary,
  calculateRevenueBreakdown,
  payoutMethodLabel,
  serializePayoutRequest,
} = require('../../../netlify/functions/utils/pulsecheck-coach-payouts');

test('newly earned referral revenue starts as available and unpaid', () => {
  const summary = buildPayoutSummary({
    earnedCents: 7875,
    state: {},
  });

  assert.deepEqual(summary, {
    totalEarnedCents: 7875,
    availableCents: 7875,
    requestedCents: 0,
    paidCents: 0,
    status: 'available',
    activeRequest: null,
  });
});

test('an active request reserves the balance without marking it paid', () => {
  const summary = buildPayoutSummary({
    earnedCents: 7875,
    state: {
      paidCents: 0,
      requestedCents: 7875,
      activeRequestId: 'request-1',
    },
    activeRequest: {
      id: 'request-1',
      coachUserId: 'coach-1',
      amountCents: 7875,
      status: 'requested',
      paymentMethod: 'zelle',
      paymentDestination: 'coach@example.com',
      requestedAt: new Date('2026-07-27T14:00:00.000Z'),
    },
  });

  assert.equal(summary.availableCents, 0);
  assert.equal(summary.requestedCents, 7875);
  assert.equal(summary.paidCents, 0);
  assert.equal(summary.status, 'requested');
  assert.equal(summary.activeRequest.id, 'request-1');
  assert.equal(summary.activeRequest.paymentMethodLabel, 'Zelle');
});

test('completed payouts remain paid while later earnings become available', () => {
  const summary = buildPayoutSummary({
    earnedCents: 9625,
    state: {
      paidCents: 7875,
      requestedCents: 0,
      activeRequestId: null,
    },
  });

  assert.equal(summary.totalEarnedCents, 9625);
  assert.equal(summary.paidCents, 7875);
  assert.equal(summary.requestedCents, 0);
  assert.equal(summary.availableCents, 1750);
});

test('payout records serialize timestamps and manual payment methods', () => {
  const request = serializePayoutRequest('request-2', {
    coachUserId: 'coach-1',
    coachName: 'Coach Calvin',
    amountCents: 2500,
    status: 'paid',
    paymentMethod: 'cash_app',
    paymentDestination: '$coachcalvin',
    requestedAt: new Date('2026-07-27T14:00:00.000Z'),
    paidAt: new Date('2026-07-27T15:00:00.000Z'),
  });

  assert.equal(request.paymentMethodLabel, 'Cash App');
  assert.equal(request.requestedAt, '2026-07-27T14:00:00.000Z');
  assert.equal(request.paidAt, '2026-07-27T15:00:00.000Z');
  assert.equal(payoutMethodLabel('apple_pay'), 'Apple Pay');
});

test('Apple subscription payouts deduct commission before the coach share', () => {
  const breakdown = calculateRevenueBreakdown({
    amountCents: 2499,
    platformFeePct: 15,
    sharePct: 35,
  });

  assert.deepEqual(breakdown, {
    grossRevenueCents: 2499,
    platformFeeCents: 375,
    netRevenueCents: 2124,
    coachShareCents: 743,
  });
});

test('Stripe web subscriptions remain separately calculable without an Apple fee', () => {
  const breakdown = calculateRevenueBreakdown({
    amountCents: 2499,
    platformFeePct: 0,
    sharePct: 35,
  });

  assert.deepEqual(breakdown, {
    grossRevenueCents: 2499,
    platformFeeCents: 0,
    netRevenueCents: 2499,
    coachShareCents: 875,
  });
});
