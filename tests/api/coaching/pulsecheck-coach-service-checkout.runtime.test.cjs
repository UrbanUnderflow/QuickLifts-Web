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
  'netlify/functions/create-pulsecheck-coach-service-payment-intent.js'
);
const SERVICE_LIB_PATH = path.join(
  repoRoot,
  'netlify/functions/lib/pulsecheck-coach-services.js'
);

function stripeFactory({
  chargesEnabled = true,
  customerRecords = {},
} = {}) {
  const created = [];
  const idempotency = [];
  const customersCreated = [];
  const customersRetrieved = [];
  const ephemeralKeysCreated = [];

  const keys = [];
  function Stripe(key) {
    keys.push(key);
    return {
      accounts: {
        async retrieve(accountId) {
          return { id: accountId, charges_enabled: chargesEnabled };
        },
      },
      paymentIntents: {
        async create(params, options) {
          created.push(params);
          idempotency.push(options);
          return {
            id: 'pi_service_1',
            client_secret: 'pi_service_1_secret_test',
            status: 'requires_payment_method',
            payment_method_types: ['card'],
          };
        },
        async retrieve(id) {
          return {
            id,
            client_secret: `${id}_secret_test`,
            status: 'requires_payment_method',
            payment_method_types: ['card'],
          };
        },
      },
      customers: {
        async retrieve(customerId) {
          customersRetrieved.push(customerId);
          if (!customerRecords[customerId]) {
            throw new Error('No such customer');
          }
          return customerRecords[customerId];
        },
        async create(params) {
          customersCreated.push(params);
          return { id: 'cus_service_1' };
        },
      },
      ephemeralKeys: {
        async create(params, options) {
          ephemeralKeysCreated.push({ params, options });
          return { secret: 'ek_service_1_secret_test' };
        },
      },
    };
  }
  Stripe.created = created;
  Stripe.idempotency = idempotency;
  Stripe.customersCreated = customersCreated;
  Stripe.customersRetrieved = customersRetrieved;
  Stripe.ephemeralKeysCreated = ephemeralKeysCreated;
  Stripe.keys = keys;
  return Stripe;
}

function firebaseSeed({
  athleteId = 'mock-user',
  connectedAccount = 'acct_coach_1',
  conversationOverrides = {},
  athleteMembershipOverrides = {},
  coachMembershipOverrides = {},
  teamOverrides = {},
  athleteUserData = null,
} = {}) {
  return createFirestoreAdminMock({
    collections: {
      'coach-athlete-conversations': [
        {
          id: 'conversation_1',
          data: {
            athleteId,
            coachId: 'coach_1',
            athleteName: 'Alex Athlete',
            coachName: 'Coach Calvin',
            organizationId: 'organization_1',
            teamId: 'team_1',
            participantIds: ['coach_1', athleteId],
            ...conversationOverrides,
          },
        },
      ],
      'pulsecheck-organizations': [
        {
          id: 'organization_1',
          data: { status: 'active' },
        },
      ],
      'pulsecheck-teams': [
        {
          id: 'team_1',
          data: {
            organizationId: 'organization_1',
            status: 'active',
            commercialConfig: {
              additionalServicesEnabled: true,
            },
            ...teamOverrides,
          },
        },
      ],
      'pulsecheck-team-memberships': [
        {
          id: `team_1_${athleteId}`,
          data: {
            organizationId: 'organization_1',
            teamId: 'team_1',
            userId: athleteId,
            role: 'athlete',
            status: 'active',
            ...athleteMembershipOverrides,
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
            ...coachMembershipOverrides,
          },
        },
      ],
      users: [
        {
          id: 'coach_1',
          data: connectedAccount
            ? { creator: { stripeAccountId: connectedAccount } }
            : {},
        },
        ...(athleteUserData
          ? [{ id: athleteId, data: athleteUserData }]
          : []),
      ],
      stripeConnect: [],
      'pulsecheck-coach-service-orders': [],
    },
  });
}

function loadHandler(firebase, Stripe) {
  delete require.cache[FUNCTION_PATH];
  delete require.cache[SERVICE_LIB_PATH];
  return withModuleMocks(
    {
      './config/firebase': {
        admin: firebase.admin,
        db: firebase.db,
        headers: {},
        isDevMode: () => false,
        getFirebaseAdminApp: () => ({
          auth: firebase.admin.auth,
          firestore: () => firebase.db,
        }),
      },
      stripe: Stripe,
    },
    () => require(FUNCTION_PATH)
  );
}

function event(body) {
  return {
    httpMethod: 'POST',
    headers: { authorization: 'Bearer valid-token' },
    body: JSON.stringify(body),
  };
}

const env = {
  STRIPE_SECRET_KEY: 'sk_live_test',
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: 'pk_live_test',
};

test('service checkout fixes the price server-side and enables dynamic payment methods', async () => {
  const firebase = firebaseSeed();
  const Stripe = stripeFactory();

  await withPatchedEnv(env, async () => {
    const fn = loadHandler(firebase, Stripe);
    const response = await fn.handler(event({
      conversationId: 'conversation_1',
      serviceId: 'one-on-one-video',
      checkoutId: 'checkout_service_0001',
      amountCents: 1,
    }));

    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.body);
    assert.equal(body.amountCents, 5335);
    assert.equal(body.coachPriceCents, 5000);
    assert.equal(body.processingFeeCents, 335);
    assert.equal(body.publishableKey, 'pk_live_test');
    assert.equal(body.customerId, 'cus_service_1');
    assert.equal(body.customerEphemeralKeySecret, 'ek_service_1_secret_test');
    assert.deepEqual(body.paymentMethodTypes, ['card']);
    assert.deepEqual(Stripe.ephemeralKeysCreated, [{
      params: { customer: 'cus_service_1' },
      options: { apiVersion: '2020-08-27' },
    }]);

    assert.equal(Stripe.created.length, 1);
    const paymentIntent = Stripe.created[0];
    assert.equal(paymentIntent.amount, 5335);
    assert.equal(paymentIntent.currency, 'usd');
    assert.equal(paymentIntent.customer, 'cus_service_1');
    assert.deepEqual(paymentIntent.automatic_payment_methods, { enabled: true });
    assert.equal(paymentIntent.payment_method_types, undefined);
    assert.equal(paymentIntent.application_fee_amount, undefined);
    assert.equal(paymentIntent.transfer_data, undefined);
    assert.equal(paymentIntent.metadata.payment_type, 'pulsecheck_coach_service');
    assert.equal(paymentIntent.metadata.service_id, 'one-on-one-video');
    assert.equal(paymentIntent.metadata.athlete_user_id, 'mock-user');
    assert.equal(paymentIntent.metadata.coach_user_id, 'coach_1');
    assert.match(Stripe.idempotency[0].idempotencyKey, /checkout_service_0001/);

    const savedOrder = firebase.getDocument(
      'pulsecheck-coach-service-orders/checkout_service_0001'
    );
    assert.equal(savedOrder.amountCents, 5335);
    assert.equal(savedOrder.coachPriceCents, 5000);
    assert.equal(savedOrder.processingFeeCents, 335);
    assert.equal(savedOrder.platformFeeCents, 150);
    assert.equal(savedOrder.coachNetCents, 5000);
    assert.equal(savedOrder.paymentIntentId, 'pi_service_1');
    assert.equal(savedOrder.stripeCustomerId, 'cus_service_1');
    assert.equal(savedOrder.organizationId, 'organization_1');
    assert.equal(savedOrder.teamId, 'team_1');
    assert.deepEqual(savedOrder.participantIds, ['coach_1', 'mock-user']);
    assert.equal(savedOrder.serverOrderVersion, 1);
    assert.match(savedOrder.orderIntegritySeal, /^[A-Za-z0-9_-]+$/);

    const savedAthlete = firebase.getDocument('users/mock-user');
    assert.equal(savedAthlete.stripeCustomerIds.live, 'cus_service_1');
    assert.equal(Stripe.customersCreated.length, 1);
    assert.equal(Stripe.ephemeralKeysCreated[0].params.customer, 'cus_service_1');
  });
});

test('service checkout rejects a user outside the coach conversation', async () => {
  const firebase = firebaseSeed({ athleteId: 'another-athlete' });
  const Stripe = stripeFactory();

  await withPatchedEnv(env, async () => {
    const fn = loadHandler(firebase, Stripe);
    const response = await fn.handler(event({
      conversationId: 'conversation_1',
      serviceId: 'video-posing-session',
      checkoutId: 'checkout_service_0002',
    }));

    assert.equal(response.statusCode, 403);
    assert.equal(Stripe.created.length, 0);
  });
});

test('service checkout can create a manual-payout order when coach charges are disabled', async () => {
  const firebase = firebaseSeed();
  const Stripe = stripeFactory({ chargesEnabled: false });

  await withPatchedEnv(env, async () => {
    const fn = loadHandler(firebase, Stripe);
    const response = await fn.handler(event({
      conversationId: 'conversation_1',
      serviceId: 'video-posing-session',
      checkoutId: 'checkout_service_0003',
    }));

    assert.equal(response.statusCode, 200);
    assert.equal(Stripe.created.length, 1);
    assert.equal(Stripe.created[0].metadata.settlement_mode, 'manual_platform_payout');
  });
});

test('service checkout rejects service ids outside the server catalog', async () => {
  const firebase = firebaseSeed();
  const Stripe = stripeFactory();

  await withPatchedEnv(env, async () => {
    const fn = loadHandler(firebase, Stripe);
    const response = await fn.handler(event({
      conversationId: 'conversation_1',
      serviceId: 'client-invented-service',
      checkoutId: 'checkout_service_0004',
    }));

    assert.equal(response.statusCode, 400);
    assert.equal(Stripe.created.length, 0);
  });
});

test('service checkout fails closed when the conversation has no explicit team scope', async () => {
  const firebase = firebaseSeed({
    conversationOverrides: {
      organizationId: '',
      teamId: '',
      participantIds: [],
    },
  });
  const Stripe = stripeFactory();

  await withPatchedEnv(env, async () => {
    const fn = loadHandler(firebase, Stripe);
    const response = await fn.handler(event({
      conversationId: 'conversation_1',
      serviceId: 'one-on-one-video',
      checkoutId: 'checkout_service_0005',
    }));

    assert.equal(response.statusCode, 409);
    assert.equal(Stripe.created.length, 0);
  });
});

test('service checkout rejects revoked athlete or coach team access', async () => {
  for (const firebase of [
    firebaseSeed({ athleteMembershipOverrides: { status: 'revoked' } }),
    firebaseSeed({ coachMembershipOverrides: { revokedAt: 'server-timestamp' } }),
  ]) {
    const Stripe = stripeFactory();
    await withPatchedEnv(env, async () => {
      const fn = loadHandler(firebase, Stripe);
      const response = await fn.handler(event({
        conversationId: 'conversation_1',
        serviceId: 'one-on-one-video',
        checkoutId: 'checkout_service_0006',
      }));
      assert.equal(response.statusCode, 403);
      assert.equal(Stripe.created.length, 0);
    });
  }
});

test('caller headers cannot force Stripe test mode', async () => {
  const firebase = firebaseSeed();
  const Stripe = stripeFactory();

  await withPatchedEnv({
    ...env,
    STRIPE_TEST_SECRET_KEY: 'sk_test_should_not_be_used',
    PULSECHECK_STRIPE_MODE: null,
    CONTEXT: 'production',
    NETLIFY_DEV: null,
  }, async () => {
    const fn = loadHandler(firebase, Stripe);
    const request = event({
      conversationId: 'conversation_1',
      serviceId: 'one-on-one-video',
      checkoutId: 'checkout_service_0007',
    });
    request.headers['x-pulsecheck-stripe-mode'] = 'test';
    request.headers.origin = 'http://localhost:3000';
    const response = await fn.handler(request);

    assert.equal(response.statusCode, 200);
    assert.equal(JSON.parse(response.body).stripeMode, 'live');
    assert.equal(Stripe.keys[0], 'sk_live_test');
  });
});

test('service checkout replaces a stored Stripe customer owned by another user', async () => {
  const firebase = firebaseSeed({
    athleteUserData: {
      stripeCustomerIds: { live: 'cus_wrong_owner' },
    },
  });
  const Stripe = stripeFactory({
    customerRecords: {
      cus_wrong_owner: {
        id: 'cus_wrong_owner',
        livemode: true,
        metadata: {
          platform: 'pulsecheck',
          pulsecheck_user_id: 'another-user',
          stripe_mode: 'live',
        },
      },
    },
  });

  await withPatchedEnv(env, async () => {
    const fn = loadHandler(firebase, Stripe);
    const response = await fn.handler(event({
      conversationId: 'conversation_1',
      serviceId: 'one-on-one-video',
      checkoutId: 'checkout_service_0008',
    }));

    assert.equal(response.statusCode, 200);
    assert.deepEqual(Stripe.customersRetrieved, ['cus_wrong_owner']);
    assert.equal(JSON.parse(response.body).customerId, 'cus_service_1');
    assert.equal(Stripe.ephemeralKeysCreated[0].params.customer, 'cus_service_1');
    assert.equal(
      firebase.getDocument('users/mock-user').stripeCustomerIds.live,
      'cus_service_1'
    );
  });
});

test('service checkout replaces a stored Stripe customer from another mode', async () => {
  const firebase = firebaseSeed({
    athleteUserData: {
      stripeCustomerIds: { live: 'cus_wrong_mode' },
    },
  });
  const Stripe = stripeFactory({
    customerRecords: {
      cus_wrong_mode: {
        id: 'cus_wrong_mode',
        livemode: false,
        metadata: {
          platform: 'pulsecheck',
          pulsecheck_user_id: 'mock-user',
          stripe_mode: 'test',
        },
      },
    },
  });

  await withPatchedEnv(env, async () => {
    const fn = loadHandler(firebase, Stripe);
    const response = await fn.handler(event({
      conversationId: 'conversation_1',
      serviceId: 'one-on-one-video',
      checkoutId: 'checkout_service_0009',
    }));

    assert.equal(response.statusCode, 200);
    assert.deepEqual(Stripe.customersRetrieved, ['cus_wrong_mode']);
    assert.equal(JSON.parse(response.body).customerId, 'cus_service_1');
    assert.equal(Stripe.ephemeralKeysCreated[0].params.customer, 'cus_service_1');
  });
});
