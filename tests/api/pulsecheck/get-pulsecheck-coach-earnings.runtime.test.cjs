const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');

const repoRoot = path.resolve(__dirname, '../../..');
const functionPath = path.join(repoRoot, 'netlify/functions/get-pulsecheck-coach-earnings.js');
const configPath = path.join(repoRoot, 'netlify/functions/config/firebase.js');
const coachServicesPath = path.join(
  repoRoot,
  'netlify/functions/lib/pulsecheck-coach-services.js'
);

const snapshot = (id, value) => ({
  id,
  exists: Boolean(value),
  data: () => value,
});

const createDb = ({
  sharePct = 20,
  platform = 'Web',
  subscriptionType = 'Monthly Subscriber',
  stripeSubscriptionId = 'sub_athlete_1',
  rcAppUserId = null,
  planType = 'pulsecheck-monthly',
} = {}) => {
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
        referralRevenueSharePct: sharePct,
        revenueRecipientRole: 'coach',
        revenueRecipientUserId: '',
      },
    },
    'users/athlete-1': {
      displayName: 'Subscribed Athlete',
      email: 'athlete@example.com',
      subscriptionType,
      stripeSubscriptionId,
    },
    'subscriptions/athlete-1': {
      userId: 'athlete-1',
      platform,
      stripeSubscriptionId,
      rcAppUserId,
      plans: [{ type: planType, expiration: 2_000_000_000 }],
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

const loadHandler = ({ db = createDb() } = {}) => {
  delete require.cache[functionPath];
  delete require.cache[configPath];
  delete require.cache[coachServicesPath];

  const firebaseApp = {
    auth: () => ({
      verifyIdToken: async (token) => {
        assert.equal(token, 'coach-token');
        return { uid: 'coach-calvin' };
      },
    }),
    firestore: () => db,
  };

  require.cache[configPath] = {
    id: configPath,
    filename: configPath,
    loaded: true,
    exports: {
      admin: {},
      db,
      getFirebaseAdminApp: () => firebaseApp,
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

test('Apple subscribers use recorded RevenueCat revenue and return every renewal', async () => {
  const previousApiKey = process.env.REVENUECAT_API_KEY_PULSECHECK;
  const previousProjectId = process.env.REVENUECAT_PROJECT_ID_PULSECHECK;
  const originalFetch = global.fetch;
  process.env.REVENUECAT_API_KEY_PULSECHECK = 'rc-secret';
  process.env.REVENUECAT_PROJECT_ID_PULSECHECK = 'rc-project';

  const jsonResponse = (body) => ({
    ok: true,
    status: 200,
    json: async () => body,
    text: async () => JSON.stringify(body),
  });

  global.fetch = async (url, options) => {
    assert.equal(options.headers.Authorization, 'Bearer rc-secret');
    if (url.includes('/customers/revenuecat-athlete/subscriptions')) {
      return jsonResponse({
        items: [{
          id: 'rc-subscription-1',
          customer_id: 'revenuecat-athlete',
          product_id: 'product-monthly',
          gives_access: true,
          status: 'active',
          current_period_ends_at: 2_000_000_000_000,
          total_revenue_in_usd: {
            currency: 'USD',
            gross: 74.97,
          },
        }],
      });
    }
    if (url.includes('/subscriptions/rc-subscription-1/transactions')) {
      return jsonResponse({
        items: [
          {
            id: 'apple-january',
            purchased_at: 1_767_225_600_000,
            product_store_identifier: 'pc_1m',
          },
          {
            id: 'apple-february',
            purchased_at: 1_769_904_000_000,
            product_store_identifier: 'pc_1m',
          },
          {
            id: 'apple-march',
            purchased_at: 1_772_323_200_000,
            product_store_identifier: 'pc_1m',
          },
        ],
      });
    }
    throw new Error(`Unexpected RevenueCat URL: ${url}`);
  };

  try {
    const handler = loadHandler({
      db: createDb({
        sharePct: 35,
        platform: 'ios',
        stripeSubscriptionId: null,
        rcAppUserId: 'revenuecat-athlete',
      }),
    });
    const response = await handler({
      httpMethod: 'GET',
      headers: { authorization: 'Bearer coach-token' },
    });

    assert.equal(response.statusCode, 200);
    const payload = JSON.parse(response.body);
    const member = payload.earnings.members[0];
    assert.equal(member.plan, 'PulseCheck Monthly');
    assert.equal(member.subscriptionAmountCents, 2499);
    assert.equal(member.estimatedMonthlyShareCents, 743);
    assert.equal(member.payments.length, 3);
    assert.equal(member.lifetimePaidCents, 7497);
    assert.equal(member.lifetimeShareCents, 2229);
    assert.deepEqual(
      member.payments.map((payment) => payment.amountPaidCents),
      [2499, 2499, 2499]
    );
  } finally {
    global.fetch = originalFetch;
    if (previousApiKey == null) delete process.env.REVENUECAT_API_KEY_PULSECHECK;
    else process.env.REVENUECAT_API_KEY_PULSECHECK = previousApiKey;
    if (previousProjectId == null) delete process.env.REVENUECAT_PROJECT_ID_PULSECHECK;
    else process.env.REVENUECAT_PROJECT_ID_PULSECHECK = previousProjectId;
  }
});
