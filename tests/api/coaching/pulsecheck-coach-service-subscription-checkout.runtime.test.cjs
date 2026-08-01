const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const {
  createFirestoreAdminMock,
  repoRoot,
  withModuleMocks,
  withPatchedEnv,
} = require('../firebase-admin/_runtimeHarness.cjs');

const FUNCTION_PATH = path.join(
  repoRoot,
  'netlify/functions/create-pulsecheck-coach-service-subscription-checkout.js'
);
const SERVICE_LIB_PATH = path.join(
  repoRoot,
  'netlify/functions/lib/pulsecheck-coach-services.js'
);

const env = {
  STRIPE_SECRET_KEY: 'sk_live_test',
  STRIPE_TEST_SECRET_KEY: 'sk_test_test',
  SITE_URL: 'https://fitwithpulse.ai',
  PULSECHECK_STRIPE_MODE: 'live',
  PULSECHECK_RECURRING_COACH_SERVICES_ENABLED: 'true',
};

function firebaseSeed() {
  return createFirestoreAdminMock({
    collections: {
      'coach-athlete-conversations': [
        {
          id: 'conversation_1',
          data: {
            athleteId: 'mock-user',
            coachId: 'coach_1',
            athleteName: 'Alex Athlete',
            coachName: 'Coach Calvin',
            organizationId: 'organization_1',
            teamId: 'team_1',
            participantIds: ['coach_1', 'mock-user'],
          },
        },
        {
          id: 'conversation_2',
          data: {
            athleteId: 'mock-user',
            coachId: 'coach_2',
            athleteName: 'Alex Athlete',
            coachName: 'Coach Casey',
            organizationId: 'organization_1',
            teamId: 'team_1',
            participantIds: ['coach_2', 'mock-user'],
          },
        },
      ],
      'pulsecheck-organizations': [
        { id: 'organization_1', data: { status: 'active' } },
      ],
      'pulsecheck-teams': [
        {
          id: 'team_1',
          data: {
            organizationId: 'organization_1',
            status: 'active',
            commercialConfig: { additionalServicesEnabled: true },
          },
        },
      ],
      'pulsecheck-team-memberships': [
        {
          id: 'team_1_mock-user',
          data: {
            organizationId: 'organization_1',
            teamId: 'team_1',
            userId: 'mock-user',
            role: 'athlete',
            status: 'active',
          },
        },
        {
          id: 'team_1_coach_1',
          data: {
            organizationId: 'organization_1',
            teamId: 'team_1',
            userId: 'coach_1',
            role: 'coach',
            status: 'active',
          },
        },
        {
          id: 'team_1_coach_2',
          data: {
            organizationId: 'organization_1',
            teamId: 'team_1',
            userId: 'coach_2',
            role: 'coach',
            status: 'active',
          },
        },
      ],
      'pulsecheck-coach-services': [
        {
          id: 'one_time_service_1',
          data: {
            coachUserId: 'coach_1',
            organizationId: 'organization_1',
            teamId: 'team_1',
            title: 'Film review',
            description: 'One focused review',
            serviceType: 'one_time',
            priceCents: 2500,
            currency: 'usd',
            status: 'active',
          },
        },
        {
          id: 'subscription_service_1',
          data: {
            coachUserId: 'coach_1',
            organizationId: 'organization_1',
            teamId: 'team_1',
            title: 'Monthly coaching',
            description: 'Ongoing coaching support',
            serviceType: 'subscription',
            priceCents: 5000,
            currency: 'usd',
            status: 'active',
          },
        },
        {
          id: 'subscription_service_2',
          data: {
            coachUserId: 'coach_2',
            organizationId: 'organization_1',
            teamId: 'team_1',
            title: 'Monthly posing',
            serviceType: 'subscription',
            priceCents: 7000,
            currency: 'usd',
            status: 'active',
          },
        },
      ],
      users: [
        { id: 'coach_1', data: {} },
        { id: 'coach_2', data: {} },
      ],
      stripeConnect: [],
      'pulsecheck-coach-service-orders': [],
    },
  });
}

function stripeFactory() {
  const created = [];
  const retrieved = [];
  const keys = [];
  function Stripe(key) {
    keys.push(key);
    return {
      checkout: {
        sessions: {
          async create(params) {
            created.push(params);
            return {
              id: 'cs_service_subscription_1',
              url: 'https://checkout.stripe.com/c/pay/cs_service_subscription_1',
              client_reference_id: params.client_reference_id,
              metadata: params.metadata,
              amount_total: params.line_items[0].price_data.unit_amount,
              currency: params.line_items[0].price_data.currency,
              customer: null,
              livemode: true,
            };
          },
          async retrieve(id) {
            retrieved.push(id);
            const params = created[0];
            return {
              id,
              url: 'https://checkout.stripe.com/c/pay/retrieved-safe-url',
              client_reference_id: params.client_reference_id,
              metadata: params.metadata,
              amount_total: params.line_items[0].price_data.unit_amount,
              currency: params.line_items[0].price_data.currency,
              customer: null,
              livemode: true,
            };
          },
        },
      },
    };
  }
  Stripe.created = created;
  Stripe.retrieved = retrieved;
  Stripe.keys = keys;
  return Stripe;
}

function loadHandler(firebase, Stripe) {
  delete require.cache[FUNCTION_PATH];
  delete require.cache[SERVICE_LIB_PATH];
  const firebaseModule = {
    admin: firebase.admin,
    db: firebase.db,
    headers: {},
    getFirebaseAdminApp: () => ({
      auth: firebase.admin.auth,
      firestore: () => firebase.db,
    }),
  };
  return withModuleMocks(
    {
      './config/firebase': firebaseModule,
      '../config/firebase': firebaseModule,
      stripe: Stripe,
    },
    () => require(FUNCTION_PATH)
  );
}

function loadServiceLibrary(firebase) {
  delete require.cache[SERVICE_LIB_PATH];
  const firebaseModule = {
    admin: firebase.admin,
    db: firebase.db,
    headers: {},
    getFirebaseAdminApp: () => ({
      auth: firebase.admin.auth,
      firestore: () => firebase.db,
    }),
  };
  return withModuleMocks(
    {
      '../config/firebase': firebaseModule,
    },
    () => require(SERVICE_LIB_PATH)
  );
}

function event(body, headers = {}) {
  return {
    httpMethod: 'POST',
    headers: {
      authorization: 'Bearer valid-token',
      ...headers,
    },
    body: JSON.stringify(body),
  };
}

test('subscription checkout seals server-derived team scope and ignores caller Stripe mode', async () => {
  const firebase = firebaseSeed();
  const Stripe = stripeFactory();
  await withPatchedEnv(env, async () => {
    const fn = loadHandler(firebase, Stripe);
    const response = await fn.handler(event({
      conversationId: 'conversation_1',
      serviceId: 'subscription_service_1',
      checkoutId: 'subscription_checkout_0001',
    }, {
      'x-pulsecheck-stripe-mode': 'test',
      origin: 'http://localhost:3000',
    }));

    assert.equal(response.statusCode, 200);
    assert.equal(Stripe.keys[0], 'sk_live_test');
    assert.equal(
      Stripe.created[0].success_url,
      'https://fitwithpulse.ai/PulseCheck/service-purchase/success?orderId=subscription_checkout_0001'
    );
    const order = firebase.getDocument(
      'pulsecheck-coach-service-orders/subscription_checkout_0001'
    );
    assert.equal(order.organizationId, 'organization_1');
    assert.equal(order.teamId, 'team_1');
    assert.deepEqual(order.participantIds, ['coach_1', 'mock-user']);
    assert.equal(order.stripeMode, 'live');
    assert.equal(order.serverOrderVersion, 1);
    assert.match(order.orderIntegritySeal, /^[A-Za-z0-9_-]+$/);
  });
});

test('existing subscription checkout id cannot be reused for another conversation', async () => {
  const firebase = firebaseSeed();
  const Stripe = stripeFactory();
  await withPatchedEnv(env, async () => {
    const fn = loadHandler(firebase, Stripe);
    const first = await fn.handler(event({
      conversationId: 'conversation_1',
      serviceId: 'subscription_service_1',
      checkoutId: 'subscription_checkout_0002',
    }));
    assert.equal(first.statusCode, 200);

    const second = await fn.handler(event({
      conversationId: 'conversation_2',
      serviceId: 'subscription_service_2',
      checkoutId: 'subscription_checkout_0002',
    }));
    assert.equal(second.statusCode, 409);
    assert.equal(Stripe.created.length, 1);
  });
});

test('idempotent subscription retry retrieves Stripe and never trusts the stored URL', async () => {
  const firebase = firebaseSeed();
  const Stripe = stripeFactory();
  await withPatchedEnv(env, async () => {
    const fn = loadHandler(firebase, Stripe);
    const request = event({
      conversationId: 'conversation_1',
      serviceId: 'subscription_service_1',
      checkoutId: 'subscription_checkout_0003',
    });
    assert.equal((await fn.handler(request)).statusCode, 200);

    await firebase.db
      .collection('pulsecheck-coach-service-orders')
      .doc('subscription_checkout_0003')
      .set({ stripeSessionUrl: 'https://attacker.example/checkout' }, { merge: true });
    const retry = await fn.handler(request);

    assert.equal(retry.statusCode, 200);
    assert.equal(
      JSON.parse(retry.body).url,
      'https://checkout.stripe.com/c/pay/retrieved-safe-url'
    );
    assert.deepEqual(Stripe.retrieved, ['cs_service_subscription_1']);
  });
});

test('recurring coach service checkout is disabled by default for this release', async () => {
  const firebase = firebaseSeed();
  const Stripe = stripeFactory();
  await withPatchedEnv({
    ...env,
    PULSECHECK_RECURRING_COACH_SERVICES_ENABLED: null,
  }, async () => {
    const fn = loadHandler(firebase, Stripe);
    const response = await fn.handler(event({
      conversationId: 'conversation_1',
      serviceId: 'subscription_service_1',
      checkoutId: 'subscription_checkout_0004',
    }));

    assert.equal(response.statusCode, 409);
    assert.match(JSON.parse(response.body).message, /unavailable during this release/i);
    assert.equal(Stripe.created.length, 0);
  });
});

test('athlete catalog hides legacy subscriptions while recurring sales are paused', async () => {
  const firebase = firebaseSeed();
  await withPatchedEnv({
    ...env,
    PULSECHECK_RECURRING_COACH_SERVICES_ENABLED: '',
  }, async () => {
    const serviceLibrary = loadServiceLibrary(firebase);
    const services = await serviceLibrary.listServicesForConversation({
      conversation: {
        coachUserId: 'coach_1',
        scope: {
          organizationId: 'organization_1',
          teamId: 'team_1',
        },
      },
      database: firebase.db,
    });

    assert.deepEqual(services.map((service) => service.id), [
      'one_time_service_1',
    ]);
  });
});
