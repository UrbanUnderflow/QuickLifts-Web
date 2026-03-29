const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const {
  createFirestoreAdminMock,
  createFetchResponse,
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

test('get-dashboard-link returns a Stripe login link for a creator account', async () => {
  const firebaseMock = createFirestoreAdminMock({
    collections: {
      users: [
        {
          id: 'user-1',
          data: {
            creator: { stripeAccountId: 'acct_123' },
          },
        },
      ],
    },
  });

  const stripeCalls = [];
  const Stripe = createStripeFactory((key) => ({
    accounts: {
      async createLoginLink(accountId) {
        stripeCalls.push({ key, accountId });
        return { url: `https://dashboard.stripe.com/${accountId}` };
      },
    },
  }));

  await withPatchedEnv(
    {
      STRIPE_SECRET_KEY: 'sk_live_123',
      NODE_ENV: 'test',
    },
    async () => {
      const { handler } = loadJsModule('netlify/functions/get-dashboard-link.js', {
        './config/firebase': { admin: firebaseMock.admin },
        stripe: Stripe,
      });

      const response = await handler({
        httpMethod: 'GET',
        queryStringParameters: { userId: 'user-1' },
      });

      assert.equal(response.statusCode, 200);
      assert.equal(stripeCalls.length, 1);
      assert.deepEqual(stripeCalls[0], { key: 'sk_live_123', accountId: 'acct_123' });

      const body = JSON.parse(response.body);
      assert.equal(body.success, true);
      assert.equal(body.url, 'https://dashboard.stripe.com/acct_123');
    }
  );
});

test('create-account-update-link falls back to onboarding when account_update is not allowed', async () => {
  const firebaseMock = createFirestoreAdminMock({
    collections: {
      users: [
        {
          id: 'user-2',
          data: {
            username: 'tre',
            winner: { stripeAccountId: 'acct_winner_123' },
          },
        },
      ],
    },
  });

  const createdLinks = [];
  const Stripe = createStripeFactory(() => ({
    accounts: {
      async retrieve(accountId) {
        return {
          id: accountId,
          details_submitted: true,
          requirements: { currently_due: [], disabled_reason: null },
        };
      },
    },
    accountLinks: {
      async create(payload) {
        createdLinks.push(payload);
        if (payload.type === 'account_update') {
          throw new Error('You cannot create `account_update` type Account Links');
        }
        return {
          url: 'https://connect.stripe.com/onboarding/acct_winner_123',
          expires_at: 1730000000,
        };
      },
    },
  }));

  await withPatchedEnv(
    {
      STRIPE_SECRET_KEY: 'sk_live_123',
      SITE_URL: 'https://fitwithpulse.ai',
    },
    async () => {
      const { handler } = loadJsModule('netlify/functions/create-account-update-link.js', {
        './config/firebase': { db: firebaseMock.db },
        stripe: Stripe,
      });

      const response = await handler({
        httpMethod: 'GET',
        queryStringParameters: {
          userId: 'user-2',
          accountType: 'winner',
        },
      });

      assert.equal(response.statusCode, 200);
      assert.equal(createdLinks.length, 2);
      assert.equal(createdLinks[0].type, 'account_update');
      assert.equal(createdLinks[1].type, 'account_onboarding');

      const userDoc = firebaseMock.getDocument('users/user-2');
      assert.equal(userDoc.creator.stripeAccountId, 'acct_winner_123');
      assert.equal(userDoc.winner.onboardingLink, 'https://connect.stripe.com/onboarding/acct_winner_123');
      assert.equal(userDoc.winner.onboardingExpirationDate, 1730000000);
      assert.equal(userDoc.winner.onboardingStatus, 'complete');
      assert.equal(userDoc.winner.accountRestricted, false);
    }
  );
});

test('complete-stripe-onboarding marks the creator onboarding flow complete when a Stripe account is already linked', async () => {
  const firebaseMock = createFirestoreAdminMock({
    collections: {
      users: [
        {
          id: 'user-3',
          data: {
            email: 'creator@example.com',
            creator: {
              stripeAccountId: 'acct_existing',
            },
          },
        },
      ],
    },
  });

  await withPatchedEnv(
    {
      STRIPE_SECRET_KEY: 'sk_live_123',
    },
    async () => {
      const { handler } = loadJsModule('netlify/functions/complete-stripe-onboarding.js', {
        './config/firebase': { db: firebaseMock.db, admin: firebaseMock.admin },
        '../../src/lib/server/firebase/credential-source': {
          resolveFirebaseAdminCredential() {
            return { source: 'prod:service-account-json' };
          },
        },
        stripe: createStripeFactory(() => ({
          accounts: {
            async list() {
              throw new Error('accounts.list should not run when stripeAccountId already exists');
            },
          },
        })),
      });

      const response = await handler({
        httpMethod: 'GET',
        queryStringParameters: { userId: 'user-3' },
      });

      assert.equal(response.statusCode, 200);
      const body = JSON.parse(response.body);
      assert.equal(body.success, true);
      assert.equal(body.hasStripeAccount, true);

      const userDoc = firebaseMock.getDocument('users/user-3');
      assert.equal(userDoc.creator.stripeAccountId, 'acct_existing');
      assert.equal(userDoc.creator.onboardingStatus, 'complete');
      assert.ok(userDoc.creator.onboardingCompletedAt);
    }
  );
});

test('create-round-checkout builds a subscription checkout for inactive members and a payment checkout for active ones', async () => {
  const firebaseMock = createFirestoreAdminMock({
    collections: {
      users: [
        {
          id: 'inactive-user',
          data: {
            stripeCustomerId: 'cus_inactive',
          },
        },
        {
          id: 'active-user',
          data: {
            stripeCustomerId: 'cus_active',
          },
        },
      ],
      subscriptions: [
        {
          id: 'inactive-user',
          data: {
            expirationHistory: [1],
          },
        },
        {
          id: 'active-user',
          data: {
            expirationHistory: [Math.floor(Date.now() / 1000) + 86400],
          },
        },
      ],
    },
  });

  const sessionCalls = [];
  const Stripe = createStripeFactory((key) => ({
    checkout: {
      sessions: {
        async create(payload) {
          sessionCalls.push({ key, payload });
          return { url: `https://checkout.stripe.com/${sessionCalls.length}` };
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
      const { handler } = loadJsModule('netlify/functions/create-round-checkout.js', {
        './config/firebase': { admin: firebaseMock.admin },
        stripe: Stripe,
      });

      const inactiveResponse = await handler({
        httpMethod: 'POST',
        headers: { origin: 'https://fitwithpulse.ai' },
        body: JSON.stringify({
          userId: 'inactive-user',
          roundId: 'round-1',
          roundAmount: 12.5,
          roundName: 'Friday Round',
        }),
      });

      const activeResponse = await handler({
        httpMethod: 'POST',
        headers: { origin: 'https://fitwithpulse.ai' },
        body: JSON.stringify({
          userId: 'active-user',
          roundId: 'round-2',
          roundAmount: 9.99,
          roundName: 'Saturday Round',
        }),
      });

      assert.equal(inactiveResponse.statusCode, 200);
      assert.equal(activeResponse.statusCode, 200);
      assert.equal(sessionCalls.length, 2);

      assert.equal(sessionCalls[0].payload.mode, 'subscription');
      assert.equal(sessionCalls[0].payload.customer, 'cus_inactive');
      assert.equal(sessionCalls[0].payload.line_items[0].price, 'price_1PDq26RobSf56MUOucDIKLhd');
      assert.equal(sessionCalls[0].payload.line_items[1].price_data.unit_amount, 1250);

      assert.equal(sessionCalls[1].payload.mode, 'payment');
      assert.equal(sessionCalls[1].payload.customer, 'cus_active');
      assert.match(sessionCalls[1].payload.line_items[0].price_data.product_data.description, /Active/);
    }
  );
});

test('stripe-webhook records a subscription-created event into user and subscription documents', async () => {
  const firebaseMock = createFirestoreAdminMock({
    collections: {
      users: [
        {
          id: 'user-4',
          data: {
            email: 'subscriber@example.com',
            username: 'subby',
          },
        },
      ],
      subscriptions: [
        {
          id: 'user-4',
          data: {
            plans: [],
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
              id: 'sub_456',
              status: 'active',
              customer: 'cus_456',
              metadata: { userId: 'user-4' },
              current_period_end: 1730000000,
              items: {
                data: [{ price: { id: 'price_1PDq26RobSf56MUOucDIKLhd' } }],
              },
            },
          },
        };
      },
    },
    checkout: {
      sessions: {
        async listLineItems() {
          return { data: [] };
        },
      },
    },
    subscriptions: {
      async retrieve() {
        throw new Error('subscriptions.retrieve should not run for subscription.created');
      },
    },
  }));

  await withPatchedEnv(
    {
      STRIPE_SECRET_KEY: 'sk_live_123',
      STRIPE_WEBHOOK_SECRET: 'whsec_123',
    },
    async () => {
      const { handler } = loadJsModule('netlify/functions/stripe-webhook.js', {
        './config/firebase': { admin: firebaseMock.admin },
        stripe: Stripe,
      });

      const response = await handler({
        httpMethod: 'POST',
        headers: { 'stripe-signature': 'sig_123' },
        body: JSON.stringify({ id: 'evt_123' }),
      });

      assert.equal(response.statusCode, 200);

      const userDoc = firebaseMock.getDocument('users/user-4');
      assert.equal(userDoc.subscriptionType, 'Monthly Subscriber');
      assert.equal(userDoc.stripeCustomerId, 'cus_456');
      assert.equal(userDoc.stripeSubscriptionId, 'sub_456');

      const subscriptionDoc = firebaseMock.getDocument('subscriptions/user-4');
      assert.equal(subscriptionDoc.stripeSubscriptionId, 'sub_456');
      assert.equal(subscriptionDoc.platform, 'web');
      assert.equal(subscriptionDoc.plans[0].type, 'pulsecheck-monthly');
    }
  );
});

test('stripe-deposit-webhook records a prize deposit and updates challenge funding state', async () => {
  const firebaseMock = createFirestoreAdminMock({
    collections: {
      challenges: [
        {
          id: 'challenge-1',
          data: {
            fundingStatus: 'pending',
          },
        },
      ],
      'challenge-prizes': [
        {
          id: 'prize-1',
          data: {
            challengeId: 'challenge-1',
            fundingStatus: 'pending',
          },
        },
      ],
    },
  });

  const Stripe = createStripeFactory(() => ({
    webhooks: {
      constructEvent() {
        return {
          type: 'payment_intent.succeeded',
          data: {
            object: {
              id: 'pi_123',
              amount: 15000,
              currency: 'usd',
              latest_charge: 'ch_123',
              payment_method: 'pm_123',
              metadata: {
                type: 'prize_deposit',
                challengeId: 'challenge-1',
                challengeTitle: 'Big Round',
                depositedBy: 'host-1',
                depositorName: 'Host',
                depositorEmail: 'host@example.com',
                fullPrizeAmount: '15000',
                amountToDeposit: '15000',
                platformFee: '450',
                totalChargeAmount: '15450',
                prizeAssignmentId: 'prize-1',
              },
            },
          },
        };
      },
    },
  }));

  await withPatchedEnv(
    {
      STRIPE_SECRET_KEY: 'sk_live_123',
      STRIPE_WEBHOOK_SECRET: 'whsec_123',
    },
    async () => {
      const { handler } = loadJsModule('netlify/functions/stripe-deposit-webhook.js', {
        './config/firebase': { admin: firebaseMock.admin },
        stripe: Stripe,
      });

      const response = await handler({
        httpMethod: 'POST',
        headers: { 'stripe-signature': 'sig_123' },
        body: JSON.stringify({ id: 'evt_123' }),
      });

      assert.equal(response.statusCode, 200);
      const prizeDoc = firebaseMock.getDocument('challenge-prizes/prize-1');
      assert.equal(prizeDoc.fundingStatus, 'funded');
      assert.equal(prizeDoc.depositedAmount, 15000);

      const challengeDoc = firebaseMock.getDocument('challenges/challenge-1');
      assert.equal(challengeDoc.fundingStatus, 'funded');
      assert.equal(challengeDoc.fundingDetails.prizeAmount, 15000);
      assert.equal(challengeDoc.fundingDetails.totalAmountCharged, 15450);

      assert.equal(firebaseMock.writes.adds.length, 1);
      assert.match(firebaseMock.writes.adds[0].path, /^prize-escrow\/auto-/);
    }
  );
});
