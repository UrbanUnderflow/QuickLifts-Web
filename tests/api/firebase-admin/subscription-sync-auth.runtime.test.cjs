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

function createAuthenticatedHelpers(firebaseMock, userId = 'user-self') {
  return {
    normalizeString(value) {
      return typeof value === 'string' ? value.trim() : '';
    },
    resolveServerStripeMode() {
      return 'test';
    },
    async verifyFirebaseUser(event) {
      if (event.headers?.authorization !== 'Bearer self-token') {
        const error = new Error('Sign in is required.');
        error.statusCode = 401;
        throw error;
      }
      return {
        userId,
        decoded: {
          uid: userId,
          email: 'self@example.com',
          email_verified: true,
        },
        app: {
          firestore() {
            return firebaseMock.db;
          },
        },
      };
    },
  };
}

function postEvent(body, authenticated = true) {
  return {
    httpMethod: 'POST',
    headers: authenticated ? { authorization: 'Bearer self-token' } : {},
    body: JSON.stringify(body),
  };
}

test('Stripe sync rejects unauthenticated and cross-user requests, ignores customer injection, and syncs the authenticated owner', async () => {
  const futureExpiration = Math.floor(Date.now() / 1000) + 86_400;
  const firebaseMock = createFirestoreAdminMock({
    collections: {
      users: [
        {
          id: 'user-self',
          data: {
            email: 'self@example.com',
            username: 'self',
            stripeCustomerId: 'cus_self',
            stripeSubscriptionId: 'sub_self',
          },
        },
      ],
      subscriptions: [
        {
          id: 'user-self',
          data: {
            userId: 'user-self',
            stripeCustomerId: 'cus_self',
            stripeSubscriptionId: 'sub_self',
            plans: [],
          },
        },
      ],
    },
  });

  const calls = [];
  const subscription = {
    id: 'sub_self',
    customer: 'cus_self',
    status: 'active',
    current_period_end: futureExpiration,
    metadata: { userId: 'user-self', client_reference_id: 'user-self' },
    items: {
      data: [{ price: { id: 'price_1TfOBPIkArZc741WGAWleQke' } }],
    },
  };
  function Stripe(key) {
    calls.push({ type: 'client', key });
    return {
      customers: {
        async retrieve(customerId) {
          calls.push({ type: 'customer.retrieve', customerId });
          return { id: customerId, metadata: { userId: 'user-self' } };
        },
      },
      subscriptions: {
        async retrieve(subscriptionId) {
          calls.push({ type: 'subscription.retrieve', subscriptionId });
          return subscription;
        },
        async list(params) {
          calls.push({ type: 'subscription.list', params });
          return { data: [subscription] };
        },
      },
    };
  }

  await withPatchedEnv(
    {
      PULSECHECK_STRIPE_MODE: 'test',
      STRIPE_TEST_SECRET_KEY: 'sk_test_sync',
    },
    async () => {
      const { handler } = loadJsModule('netlify/functions/sync-stripe-subscription.js', {
        './config/firebase': { admin: firebaseMock.admin },
        './lib/pulsecheck-coach-services': createAuthenticatedHelpers(firebaseMock),
        stripe: Stripe,
      });

      const unauthenticated = await handler(postEvent({ userId: 'user-self' }, false));
      assert.equal(unauthenticated.statusCode, 401);

      const crossUser = await handler(postEvent({ userId: 'user-victim' }));
      assert.equal(crossUser.statusCode, 403);
      assert.equal(calls.length, 0);

      const valid = await handler(postEvent({
        userId: 'user-self',
        stripeCustomerId: 'cus_victim',
      }));
      assert.equal(valid.statusCode, 200);
      assert.equal(JSON.parse(valid.body).message, 'Synced');
    }
  );

  assert.equal(
    calls.some((call) => call.customerId === 'cus_victim' || call.params?.customer === 'cus_victim'),
    false
  );
  assert.deepEqual(
    calls.find((call) => call.type === 'subscription.list')?.params,
    { customer: 'cus_self', limit: 100 }
  );
  const subscriptionDoc = firebaseMock.getDocument('subscriptions/user-self');
  assert.equal(subscriptionDoc.stripeCustomerId, 'cus_self');
  assert.equal(subscriptionDoc.stripeSubscriptionId, 'sub_self');
  assert.equal(subscriptionDoc.plans.length, 1);
  assert.equal(subscriptionDoc.plans[0].type, 'pulsecheck-monthly');
  assert.equal(subscriptionDoc.plans[0].expiration, futureExpiration);
});

test('Stripe sync refuses a server-linked subscription whose Stripe ownership metadata points to another user', async () => {
  const firebaseMock = createFirestoreAdminMock({
    collections: {
      users: [{ id: 'user-self', data: { stripeSubscriptionId: 'sub_wrong' } }],
      subscriptions: [
        {
          id: 'user-self',
          data: { userId: 'user-self', stripeSubscriptionId: 'sub_wrong', plans: [] },
        },
      ],
    },
  });
  function Stripe() {
    return {
      customers: {
        async retrieve() {
          throw new Error('customer retrieval must not run after subscription ownership fails');
        },
      },
      subscriptions: {
        async retrieve() {
          return {
            id: 'sub_wrong',
            customer: 'cus_victim',
            status: 'active',
            current_period_end: Math.floor(Date.now() / 1000) + 86_400,
            metadata: { userId: 'user-victim' },
            items: { data: [{ price: { id: 'price_1TfOBPIkArZc741WGAWleQke' } }] },
          };
        },
        async list() {
          throw new Error('customer listing should not run without a bound customer');
        },
      },
    };
  }

  await withPatchedEnv(
    { PULSECHECK_STRIPE_MODE: 'test', STRIPE_TEST_SECRET_KEY: 'sk_test_sync' },
    async () => {
      const { handler } = loadJsModule('netlify/functions/sync-stripe-subscription.js', {
        './config/firebase': { admin: firebaseMock.admin },
        './lib/pulsecheck-coach-services': createAuthenticatedHelpers(firebaseMock),
        stripe: Stripe,
      });
      const response = await handler(postEvent({ userId: 'user-self' }));
      assert.equal(response.statusCode, 200);
      assert.equal(
        JSON.parse(response.body).message,
        'No active server-linked Stripe subscription found'
      );
    }
  );

  assert.deepEqual(firebaseMock.getDocument('subscriptions/user-self').plans, []);
});

test('Stripe sync requires provider ownership metadata when a customer id exists only on the client-readable user profile', async () => {
  const firebaseMock = createFirestoreAdminMock({
    collections: {
      users: [{ id: 'user-self', data: { stripeCustomerId: 'cus_unverified' } }],
    },
  });
  function Stripe() {
    return {
      customers: {
        async retrieve(customerId) {
          return { id: customerId, metadata: {} };
        },
      },
      subscriptions: {
        async retrieve() {
          throw new Error('subscription retrieval should not run without a bound subscription id');
        },
        async list() {
          return {
            data: [{
              id: 'sub_unverified',
              customer: 'cus_unverified',
              status: 'active',
              current_period_end: Math.floor(Date.now() / 1000) + 86_400,
              metadata: {},
              items: { data: [{ price: { id: 'price_1TfOBPIkArZc741WGAWleQke' } }] },
            }],
          };
        },
      },
    };
  }

  await withPatchedEnv(
    { PULSECHECK_STRIPE_MODE: 'test', STRIPE_TEST_SECRET_KEY: 'sk_test_sync' },
    async () => {
      const { handler } = loadJsModule('netlify/functions/sync-stripe-subscription.js', {
        './config/firebase': { admin: firebaseMock.admin },
        './lib/pulsecheck-coach-services': createAuthenticatedHelpers(firebaseMock),
        stripe: Stripe,
      });
      const response = await handler(postEvent({ userId: 'user-self' }));
      assert.equal(response.statusCode, 200);
      assert.equal(
        JSON.parse(response.body).message,
        'No active server-linked Stripe subscription found'
      );
    }
  );

  assert.equal(firebaseMock.getDocument('subscriptions/user-self'), undefined);
});

test('RevenueCat sync rejects unauthenticated and cross-user requests and grants only the authenticated active entitlement', async () => {
  const futureExpiration = new Date(Date.now() + 86_400_000).toISOString();
  const firebaseMock = createFirestoreAdminMock({
    collections: {
      users: [
        {
          id: 'user-self',
          data: { email: 'self@example.com', username: 'self' },
        },
      ],
      subscriptions: [
        {
          id: 'user-self',
          data: { userId: 'user-self', plans: [] },
        },
      ],
    },
  });
  const fetchCalls = [];
  const previousFetch = global.fetch;
  global.fetch = async (url, options) => {
    fetchCalls.push({ url, options });
    return {
      ok: true,
      status: 200,
      async json() {
        return {
          customer: {
            id: 'user-self',
            attributes: { email: { value: 'self@example.com' } },
            entitlements: {
              pulsecheck: {
                is_active: true,
                expires_date: futureExpiration,
                product_identifier: 'pc_1m',
              },
            },
          },
        };
      },
      async text() {
        return '';
      },
    };
  };

  try {
    await withPatchedEnv(
      { REVENUECAT_API_KEY_PULSECHECK: 'rc_secret' },
      async () => {
        const { handler } = loadJsModule('netlify/functions/sync-revenuecat-subscription.js', {
          './config/firebase': { admin: firebaseMock.admin },
          './lib/pulsecheck-coach-services': createAuthenticatedHelpers(firebaseMock),
        });

        const unauthenticated = await handler(postEvent({ userId: 'user-self' }, false));
        assert.equal(unauthenticated.statusCode, 401);

        const crossUser = await handler(postEvent({ userId: 'user-victim' }));
        assert.equal(crossUser.statusCode, 403);
        assert.equal(fetchCalls.length, 0);

        const valid = await handler(postEvent({ userId: 'user-self' }));
        assert.equal(valid.statusCode, 200);
        assert.equal(JSON.parse(valid.body).message, 'Synced');
      }
    );
  } finally {
    global.fetch = previousFetch;
  }

  assert.equal(fetchCalls.length, 1);
  assert.match(fetchCalls[0].url, /customers\/user-self$/);
  assert.equal(fetchCalls[0].options.headers.Authorization, 'Bearer rc_secret');
  const subscriptionDoc = firebaseMock.getDocument('subscriptions/user-self');
  assert.equal(subscriptionDoc.plans.length, 1);
  assert.equal(subscriptionDoc.plans[0].type, 'pulsecheck-monthly');
  assert.ok(subscriptionDoc.plans[0].expiration > Math.floor(Date.now() / 1000));
});

test('RevenueCat sync does not grant a future entitlement marked inactive', async () => {
  const firebaseMock = createFirestoreAdminMock({
    collections: {
      users: [{ id: 'user-self', data: { email: 'self@example.com' } }],
      subscriptions: [
        { id: 'user-self', data: { userId: 'user-self', plans: [] } },
      ],
    },
  });
  const previousFetch = global.fetch;
  global.fetch = async () => ({
    ok: true,
    status: 200,
    async json() {
      return {
        customer: {
          id: 'user-self',
          entitlements: {
            expired: {
              is_active: false,
              expires_date: new Date(Date.now() + 86_400_000).toISOString(),
              product_identifier: 'pc_1m',
            },
          },
        },
      };
    },
    async text() {
      return '';
    },
  });

  try {
    await withPatchedEnv(
      { REVENUECAT_API_KEY_PULSECHECK: 'rc_secret' },
      async () => {
        const { handler } = loadJsModule('netlify/functions/sync-revenuecat-subscription.js', {
          './config/firebase': { admin: firebaseMock.admin },
          './lib/pulsecheck-coach-services': createAuthenticatedHelpers(firebaseMock),
        });
        const response = await handler(postEvent({ userId: 'user-self' }));
        assert.equal(response.statusCode, 200);
        assert.equal(
          JSON.parse(response.body).message,
          'No active server-linked RevenueCat entitlement found'
        );
      }
    );
  } finally {
    global.fetch = previousFetch;
  }

  assert.deepEqual(firebaseMock.getDocument('subscriptions/user-self').plans, []);
});
