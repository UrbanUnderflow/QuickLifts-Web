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

function stripeFactory({ chargesEnabled = true } = {}) {
  const created = [];
  const idempotency = [];
  const customersCreated = [];
  const ephemeralKeysCreated = [];

  function Stripe() {
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
            payment_method_types: params.payment_method_types,
          };
        },
        async retrieve(id) {
          return {
            id,
            client_secret: `${id}_secret_test`,
            status: 'requires_payment_method',
            payment_method_types: ['card', 'link'],
          };
        },
      },
      customers: {
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
  Stripe.ephemeralKeysCreated = ephemeralKeysCreated;
  return Stripe;
}

function firebaseSeed({ athleteId = 'mock-user', connectedAccount = 'acct_coach_1' } = {}) {
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

test('service checkout fixes the price server-side and requests card plus Link', async () => {
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
    assert.deepEqual(body.paymentMethodTypes, ['card', 'link']);

    assert.equal(Stripe.created.length, 1);
    const paymentIntent = Stripe.created[0];
    assert.equal(paymentIntent.amount, 5335);
    assert.equal(paymentIntent.currency, 'usd');
    assert.equal(paymentIntent.customer, 'cus_service_1');
    assert.deepEqual(paymentIntent.payment_method_types, ['card', 'link']);
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
