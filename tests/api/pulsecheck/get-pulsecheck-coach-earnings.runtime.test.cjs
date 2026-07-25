const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');

const repoRoot = path.resolve(__dirname, '../../..');
const functionPath = path.join(repoRoot, 'netlify/functions/get-pulsecheck-coach-earnings.js');
const configPath = path.join(repoRoot, 'netlify/functions/config/firebase.js');

const snapshot = (id, value) => ({
  id,
  exists: Boolean(value),
  data: () => value,
});

const createDb = () => {
  const memberships = [
    {
      id: 'staff-1',
      userId: 'coach-calvin',
      teamId: 'building-bodies',
      organizationId: 'org-1',
      role: 'coach',
    },
    {
      id: 'athlete-1-membership',
      userId: 'athlete-1',
      teamId: 'building-bodies',
      organizationId: 'org-1',
      role: 'athlete',
      email: 'athlete@example.com',
    },
  ];
  const documents = {
    'pulsecheck-teams/building-bodies': {
      legacyCoachId: 'coach-calvin',
      commercialConfig: {
        referralKickbackEnabled: true,
        referralRevenueSharePct: 20,
        revenueRecipientRole: 'coach',
        revenueRecipientUserId: '',
      },
    },
    'users/athlete-1': {
      displayName: 'Subscribed Athlete',
      email: 'athlete@example.com',
      subscriptionType: 'Monthly Subscriber',
      stripeSubscriptionId: 'sub_athlete_1',
    },
    'subscriptions/athlete-1': {
      userId: 'athlete-1',
      platform: 'Web',
      stripeSubscriptionId: 'sub_athlete_1',
      plans: [{ type: 'pulsecheck-monthly', expiration: 2_000_000_000 }],
    },
  };

  return {
    collection(collectionName) {
      return {
        where(field, operator, value) {
          assert.equal(operator, '==');
          return {
            async get() {
              const rows = collectionName === 'pulsecheck-team-memberships'
                ? memberships.filter((entry) => entry[field] === value)
                : [];
              return { docs: rows.map((entry) => snapshot(entry.id, entry)) };
            },
          };
        },
        doc(id) {
          return {
            async get() {
              return snapshot(id, documents[`${collectionName}/${id}`]);
            },
          };
        },
      };
    },
  };
};

const loadHandler = () => {
  delete require.cache[functionPath];
  delete require.cache[configPath];

  require.cache[configPath] = {
    id: configPath,
    filename: configPath,
    loaded: true,
    exports: {
      admin: {
        auth: () => ({
          verifyIdToken: async (token) => {
            assert.equal(token, 'coach-token');
            return { uid: 'coach-calvin' };
          },
        }),
      },
      db: createDb(),
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
    },
  };

  const originalLoad = Module._load;
  Module._load = function patchedLoad(request, parent, isMain) {
    if (request === 'stripe') {
      return function StripeMock() {
        return {
          subscriptions: {
            retrieve: async (subscriptionId) => {
              assert.equal(subscriptionId, 'sub_athlete_1');
              return {
                id: subscriptionId,
                status: 'active',
                current_period_end: 2_000_000_000,
                items: {
                  data: [{
                    price: {
                      id: 'price_monthly',
                      unit_amount: 1299,
                      recurring: { interval: 'month' },
                    },
                  }],
                },
              };
            },
          },
          invoices: {
            list: async ({ subscription, status }) => {
              assert.equal(subscription, 'sub_athlete_1');
              assert.equal(status, 'paid');
              return {
                has_more: false,
                data: [
                  {
                    id: 'in_june',
                    status: 'paid',
                    amount_paid: 1299,
                    currency: 'usd',
                    created: 1_780_000_000,
                    status_transitions: { paid_at: 1_780_000_000 },
                    lines: {
                      data: [{
                        amount: 1299,
                        price: { recurring: { interval: 'month' } },
                      }],
                    },
                  },
                  {
                    id: 'in_july',
                    status: 'paid',
                    amount_paid: 1299,
                    currency: 'usd',
                    created: 1_782_678_400,
                    status_transitions: { paid_at: 1_782_678_400 },
                    lines: {
                      data: [{
                        amount: 1299,
                        price: { recurring: { interval: 'month' } },
                      }],
                    },
                  },
                ],
              };
            },
          },
        };
      };
    }

    return originalLoad.call(this, request, parent, isMain);
  };

  try {
    return require(functionPath).handler;
  } finally {
    Module._load = originalLoad;
  }
};

test('coach earnings returns roster members and 20 percent of every paid invoice', async () => {
  const previousStripeSecret = process.env.STRIPE_SECRET_KEY;
  process.env.STRIPE_SECRET_KEY = 'sk_test_mock';

  try {
    const handler = loadHandler();
    const response = await handler({
      httpMethod: 'GET',
      headers: { authorization: 'Bearer coach-token' },
    });

    assert.equal(response.statusCode, 200);
    const payload = JSON.parse(response.body);
    assert.equal(payload.earnings.teamMemberCount, 1);
    assert.equal(payload.earnings.subscribedMemberCount, 1);
    assert.equal(payload.earnings.sharePct, 20);
    assert.equal(payload.earnings.estimatedMonthlyShareCents, 260);
    assert.equal(payload.earnings.lifetimeShareCents, 520);
    assert.equal(payload.earnings.members[0].name, 'Subscribed Athlete');
    assert.equal(payload.earnings.members[0].payments.length, 2);
    assert.deepEqual(
      payload.earnings.members[0].payments.map((payment) => payment.coachShareCents),
      [260, 260]
    );
  } finally {
    if (previousStripeSecret == null) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = previousStripeSecret;
  }
});

test('coach earnings requires a signed-in Firebase user', async () => {
  const handler = loadHandler();
  const response = await handler({ httpMethod: 'GET', headers: {} });
  assert.equal(response.statusCode, 401);
});
