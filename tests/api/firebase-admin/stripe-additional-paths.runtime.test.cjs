const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const {
  createFirestoreAdminMock,
  repoRoot,
  withModuleMocks,
  withPatchedEnv,
} = require('./_runtimeHarness.cjs');

function loadJsModule(moduleRelativePath, mocks) {
  const modulePath = path.join(repoRoot, moduleRelativePath);
  delete require.cache[modulePath];
  return withModuleMocks(mocks, () => require(modulePath));
}

function createStripeFactory(createClient) {
  function Stripe(key) {
    return createClient(key);
  }

  return Stripe;
}

test('verify-subscription-simple updates the subscription record for a paid checkout session', async () => {
  const firebaseMock = createFirestoreAdminMock({
    collections: {
      users: [
        {
          id: 'user-simple',
          data: {
            email: 'simple@example.com',
            username: 'simple-user',
          },
        },
      ],
      subscriptions: [
        {
          id: 'user-simple',
          data: {
            plans: [],
          },
        },
      ],
    },
  });

  const Stripe = createStripeFactory(() => ({
    checkout: {
      sessions: {
        async retrieve() {
          return {
            status: 'complete',
            payment_status: 'paid',
            client_reference_id: 'user-simple',
            customer: 'cus_simple',
            line_items: {
              data: [{ price: { id: 'price_1PDq3LRobSf56MUOng0UxhCC' } }],
            },
            subscription: {
              id: 'sub_simple',
              status: 'active',
              metadata: { userId: 'user-simple' },
              current_period_end: 1735000000,
              items: {
                data: [{ price: { id: 'price_1PDq3LRobSf56MUOng0UxhCC' } }],
              },
            },
          };
        },
      },
    },
  }));

  await withPatchedEnv(
    {
      STRIPE_SECRET_KEY: 'sk_live_123',
      STRIPE_TEST_SECRET_KEY: 'sk_test_123',
    },
    async () => {
      const { handler } = loadJsModule('netlify/functions/verify-subscription-simple.js', {
        './config/firebase': { admin: firebaseMock.admin },
        stripe: Stripe,
      });

      const response = await handler({
        httpMethod: 'POST',
        headers: { origin: 'https://fitwithpulse.ai' },
        body: JSON.stringify({
          sessionId: 'cs_simple',
          userId: 'user-simple',
        }),
      });

      assert.equal(response.statusCode, 200);

      const userDoc = firebaseMock.getDocument('users/user-simple');
      assert.equal(userDoc.subscriptionType, 'Annual Subscriber');
      assert.equal(userDoc.stripeCustomerId, 'cus_simple');

      const subscriptionDoc = firebaseMock.getDocument('subscriptions/user-simple');
      assert.equal(subscriptionDoc.stripeSubscriptionId, 'sub_simple');
      assert.equal(subscriptionDoc.plans[0].type, 'pulsecheck-annual');
    }
  );
});

test('create-deposit-payment-intent creates a customer if needed and returns a payment intent client secret', async () => {
  const firebaseMock = createFirestoreAdminMock({
    collections: {
      users: [
        {
          id: 'host-1',
          data: {
            email: 'host@example.com',
            username: 'host-user',
          },
        },
      ],
      challenges: [
        {
          id: 'challenge-2',
          data: {
            title: 'Summer Round',
          },
        },
      ],
    },
  });

  const stripeCalls = [];
  const Stripe = createStripeFactory(() => ({
    customers: {
      async create(payload) {
        stripeCalls.push({ type: 'customer', payload });
        return { id: 'cus_new' };
      },
    },
    paymentIntents: {
      async create(payload) {
        stripeCalls.push({ type: 'paymentIntent', payload });
        return {
          id: 'pi_new',
          client_secret: 'pi_new_secret',
        };
      },
    },
  }));

  await withPatchedEnv(
    {
      STRIPE_SECRET_KEY: 'sk_live_123',
    },
    async () => {
      const { handler } = loadJsModule('netlify/functions/create-deposit-payment-intent.js', {
        './config/firebase': { admin: firebaseMock.admin },
        stripe: Stripe,
      });

      const response = await handler({
        httpMethod: 'POST',
        body: JSON.stringify({
          assignmentId: 'prize-2',
          challengeId: 'challenge-2',
          prizeAmount: 10000,
          depositedBy: 'host-1',
          depositorName: 'Host User',
          depositorEmail: 'host@example.com',
        }),
      });

      assert.equal(response.statusCode, 200);
      const body = JSON.parse(response.body);
      assert.equal(body.success, true);
      assert.equal(body.clientSecret, 'pi_new_secret');
      assert.equal(body.amountToDeposit, 10000);

      const userDoc = firebaseMock.getDocument('users/host-1');
      assert.equal(userDoc.stripeCustomerId, 'cus_new');

      assert.equal(stripeCalls[0].type, 'customer');
      assert.equal(stripeCalls[1].type, 'paymentIntent');
      assert.equal(stripeCalls[1].payload.amount, 10400);
      assert.equal(stripeCalls[1].payload.metadata.challengeId, 'challenge-2');
    }
  );
});

test('complete-payment records a completed payment when the challenge and owner exist', async () => {
  const firebaseMock = createFirestoreAdminMock({
    collections: {
      challenges: [
        {
          id: 'challenge-3',
          data: {
            ownerId: 'owner-1',
            title: 'Weekend Round',
          },
        },
      ],
      users: [
        {
          id: 'owner-1',
          data: {
            creator: {
              stripeAccountId: 'acct_owner_1',
            },
          },
        },
      ],
    },
  });

  const { handler } = loadJsModule('netlify/functions/complete-payment.js', {
    './config/firebase': { db: firebaseMock.db },
    './utils/date-helpers': {
      toUnixTimestamp(value) {
        return Math.floor(new Date(value).getTime() / 1000);
      },
      fromUnixTimestamp(value) {
        return new Date(value * 1000).toISOString();
      },
    },
  });

  const response = await handler({
    httpMethod: 'POST',
    body: JSON.stringify({
      challengeId: 'challenge-3',
      paymentId: 'pay_123',
      ownerId: 'owner-1',
      amount: 2500,
      buyerEmail: 'buyer@example.com',
    }),
  });

  assert.equal(response.statusCode, 200);
  const paymentDoc = firebaseMock.getDocument('payments/pay_123');
  assert.equal(paymentDoc.challengeId, 'challenge-3');
  assert.equal(paymentDoc.ownerId, 'owner-1');
  assert.equal(paymentDoc.amount, 2500);
  assert.equal(paymentDoc.ownerStripeAccountId, 'acct_owner_1');
});

test('stripe-coach-webhook creates the coach record and upgrades the user role', async () => {
  const firebaseMock = createFirestoreAdminMock({
    collections: {
      users: [
        {
          id: 'coach-user',
          data: {
            role: 'member',
          },
        },
      ],
    },
  });

  const Stripe = createStripeFactory(() => ({
    webhooks: {
      constructEvent() {
        return {
          type: 'customer.subscription.created',
          data: {
            object: {
              id: 'sub_coach',
              customer: 'cus_coach',
              status: 'active',
              metadata: {
                userType: 'coach',
                userId: 'coach-user',
                referralCode: 'COACH123',
              },
            },
          },
        };
      },
    },
    subscriptions: {
      async retrieve() {
        throw new Error('subscriptions.retrieve should not run for direct subscription.created');
      },
    },
  }));

  await withPatchedEnv(
    {
      STRIPE_SECRET_KEY: 'sk_live_123',
      STRIPE_WEBHOOK_SECRET_COACH: 'whsec_coach_123',
    },
    async () => {
      const { handler } = loadJsModule('netlify/functions/stripe-coach-webhook.js', {
        './config/firebase': { admin: firebaseMock.admin },
        stripe: Stripe,
      });

      const response = await handler({
        httpMethod: 'POST',
        headers: { 'stripe-signature': 'sig_coach' },
        body: JSON.stringify({ id: 'evt_coach' }),
      });

      assert.equal(response.statusCode, 200);
      const coachDoc = firebaseMock.getDocument('coaches/coach-user');
      assert.equal(coachDoc.userId, 'coach-user');
      assert.equal(coachDoc.referralCode, 'COACH123');
      assert.equal(coachDoc.subscriptionStatus, 'active');

      const userDoc = firebaseMock.getDocument('users/coach-user');
      assert.equal(userDoc.role, 'coach');
    }
  );
});

test('create-test-payment writes a completed test payment record', async () => {
  const firebaseMock = createFirestoreAdminMock();

  const { handler } = loadJsModule('netlify/functions/create-test-payment.js', {
    './config/firebase': { admin: firebaseMock.admin },
  });

  const response = await handler({
    httpMethod: 'POST',
    body: JSON.stringify({
      trainerId: 'trainer-1',
      amount: 2999,
      challengeId: 'challenge-test',
    }),
  });

  assert.equal(response.statusCode, 200);
  const body = JSON.parse(response.body);
  assert.equal(body.success, true);

  const paymentDoc = firebaseMock.getDocument(`payments/${body.paymentId}`);
  assert.equal(paymentDoc.trainerId, 'trainer-1');
  assert.equal(paymentDoc.challengeId, 'challenge-test');
  assert.equal(paymentDoc.status, 'completed');
});

test('confirm-test-payment confirms the Stripe payment intent and funds the prize assignment', async () => {
  const firebaseMock = createFirestoreAdminMock({
    collections: {
      'challenge-prizes': [
        {
          id: 'prize-test',
          data: {
            challengeId: 'challenge-confirm',
            fundingStatus: 'pending',
          },
        },
      ],
    },
  });

  const Stripe = createStripeFactory(() => ({
    paymentMethods: {
      async create() {
        return { id: 'pm_test_123' };
      },
    },
    paymentIntents: {
      async confirm(paymentIntentId) {
        return {
          id: paymentIntentId,
          status: 'succeeded',
          amount: 7500,
          currency: 'usd',
          latest_charge: 'ch_confirmed',
          metadata: {
            challengeId: 'challenge-confirm',
            challengeTitle: 'Confirm Round',
            depositedBy: 'host-confirm',
            depositorName: 'Host Confirm',
            depositorEmail: 'host-confirm@example.com',
          },
        };
      },
    },
  }));

  await withPatchedEnv(
    {
      STRIPE_SECRET_KEY: 'sk_live_123',
    },
    async () => {
      const { handler } = loadJsModule('netlify/functions/confirm-test-payment.js', {
        './config/firebase': { admin: firebaseMock.admin },
        stripe: Stripe,
      });

      const response = await handler({
        httpMethod: 'POST',
        body: JSON.stringify({
          paymentIntentId: 'pi_test_123',
        }),
      });

      assert.equal(response.statusCode, 200);
      const body = JSON.parse(response.body);
      assert.equal(body.success, true);

      const prizeDoc = firebaseMock.getDocument('challenge-prizes/prize-test');
      assert.equal(prizeDoc.fundingStatus, 'funded');
      assert.equal(prizeDoc.depositedAmount, 7500);

      assert.equal(firebaseMock.writes.adds.length, 1);
      assert.match(firebaseMock.writes.adds[0].path, /^prize-escrow\/auto-/);
    }
  );
});

test('initiate-unified-payout creates a payout and logs the payout record for a funded creator account', async () => {
  const firebaseMock = createFirestoreAdminMock({
    collections: {
      users: [
        {
          id: 'payout-user',
          data: {
            creator: { stripeAccountId: 'acct_payout_1' },
          },
        },
      ],
    },
  });

  const payoutCalls = [];
  const Stripe = createStripeFactory(() => ({
    accounts: {
      async retrieve() {
        return {
          settings: {
            payouts: {
              schedule: {
                interval: 'manual',
              },
            },
          },
        };
      },
    },
    payouts: {
      async list() {
        return { data: [] };
      },
      async create(payload, options) {
        payoutCalls.push({ payload, options });
        return {
          id: 'po_123',
          status: 'paid',
          arrival_date: 1736000000,
        };
      },
    },
  }));

  await withPatchedEnv(
    {
      STRIPE_SECRET_KEY: 'sk_live_123',
    },
    async () => {
      const unifiedEarningsPath = path.join(repoRoot, 'netlify/functions/get-unified-earnings.js');
      delete require.cache[unifiedEarningsPath];
      require.cache[unifiedEarningsPath] = {
        id: unifiedEarningsPath,
        filename: unifiedEarningsPath,
        loaded: true,
        exports: {
          handler: async () => ({
            statusCode: 200,
            body: JSON.stringify({
              success: true,
              earnings: {
                totalBalance: 250,
                creatorEarnings: { availableBalance: 250 },
                prizeWinnings: { availableBalance: 0 },
              },
            }),
          }),
        },
      };

      const { handler } = loadJsModule('netlify/functions/initiate-unified-payout.js', {
        './config/firebase': {
          db: firebaseMock.db,
          headers: {
            'Access-Control-Allow-Origin': '*',
          },
        },
        stripe: Stripe,
      });

      try {
        const response = await handler({
          httpMethod: 'POST',
          body: JSON.stringify({
            userId: 'payout-user',
            amount: 150,
          }),
        });

        assert.equal(response.statusCode, 200);
        assert.equal(payoutCalls.length, 1);
        assert.equal(payoutCalls[0].payload.amount, 15000);
        assert.equal(payoutCalls[0].options.stripeAccount, 'acct_payout_1');

        assert.equal(firebaseMock.writes.sets.length, 1);
        assert.match(firebaseMock.writes.sets[0].path, /^payoutRecords\/unified_payout_/);
      } finally {
        delete require.cache[unifiedEarningsPath];
      }
    }
  );
});
