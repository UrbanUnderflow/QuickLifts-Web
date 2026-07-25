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
          };
        },
        async retrieve(id) {
          return {
            id,
            client_secret: `${id}_secret_test`,
            status: 'requires_payment_method',
          };
        },
      },
    };
  }
  Stripe.created = created;
  Stripe.idempotency = idempotency;
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

test('service checkout fixes the price server-side and routes a 3% destination charge', async () => {
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
    assert.equal(body.amountCents, 5000);
    assert.equal(body.publishableKey, 'pk_live_test');

    assert.equal(Stripe.created.length, 1);
    const paymentIntent = Stripe.created[0];
    assert.equal(paymentIntent.amount, 5000);
    assert.equal(paymentIntent.currency, 'usd');
    assert.deepEqual(paymentIntent.payment_method_types, ['card']);
    assert.equal(paymentIntent.application_fee_amount, 150);
    assert.equal(paymentIntent.transfer_data.destination, 'acct_coach_1');
    assert.equal(paymentIntent.metadata.payment_type, 'pulsecheck_coach_service');
    assert.equal(paymentIntent.metadata.service_id, 'one-on-one-video');
    assert.equal(paymentIntent.metadata.athlete_user_id, 'mock-user');
    assert.equal(paymentIntent.metadata.coach_user_id, 'coach_1');
    assert.match(Stripe.idempotency[0].idempotencyKey, /checkout_service_0001/);

    const savedOrder = firebase.getDocument(
      'pulsecheck-coach-service-orders/checkout_service_0001'
    );
    assert.equal(savedOrder.amountCents, 5000);
    assert.equal(savedOrder.platformFeeCents, 150);
    assert.equal(savedOrder.coachNetCents, 4850);
    assert.equal(savedOrder.paymentIntentId, 'pi_service_1');
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

test('service checkout requires a coach Stripe account ready for charges', async () => {
  const firebase = firebaseSeed();
  const Stripe = stripeFactory({ chargesEnabled: false });

  await withPatchedEnv(env, async () => {
    const fn = loadHandler(firebase, Stripe);
    const response = await fn.handler(event({
      conversationId: 'conversation_1',
      serviceId: 'video-posing-session',
      checkoutId: 'checkout_service_0003',
    }));

    assert.equal(response.statusCode, 409);
    assert.match(JSON.parse(response.body).message, /not ready/i);
    assert.equal(Stripe.created.length, 0);
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
