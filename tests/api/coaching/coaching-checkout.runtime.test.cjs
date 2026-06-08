// Runtime integration tests for the paid 1-on-1 coaching checkout
// Netlify functions. Unlike the pure-logic unit tests
// (tests/unit/coaching-pricing.test.cjs), these load the ACTUAL handler
// modules with mocked `./config/firebase` (seeded Firestore) and `stripe`
// (captured Checkout sessions), then assert the end-to-end behavior — the
// Stripe Connect params (destination charge / application fee), the
// training/host lookups, and the HTTP responses.

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const {
  createFirestoreAdminMock,
  repoRoot,
  withModuleMocks,
  withPatchedEnv,
} = require('../firebase-admin/_runtimeHarness.cjs');

const ONE_TIME_FN = 'netlify/functions/create-1on1-checkout.js';
const SUB_FN = 'netlify/functions/create-1on1-subscription-checkout.js';

// Loads a JS function module with `./config/firebase` + `stripe` stubbed.
function loadFunction(moduleRelativePath, { firebase, stripeFactory }) {
  const modulePath = path.join(repoRoot, moduleRelativePath);
  delete require.cache[modulePath];
  return withModuleMocks(
    {
      './config/firebase': { admin: firebase.admin, db: firebase.db, headers: {} },
      stripe: stripeFactory,
    },
    () => require(modulePath)
  );
}

// Stripe stub: records every checkout.sessions.create call and returns a
// deterministic session.
function makeStripeFactory() {
  const created = [];
  function Stripe() {
    return {
      checkout: {
        sessions: {
          async create(params) {
            created.push(params);
            return { id: 'cs_test_1', url: 'https://checkout.stripe.com/c/pay/cs_test_1' };
          },
        },
      },
    };
  }
  Stripe.created = created;
  return Stripe;
}

function makeEvent(body, { method = 'POST' } = {}) {
  return {
    httpMethod: method,
    headers: { origin: 'https://fitwithpulse.ai' }, // non-localhost ⇒ live key path
    body: body == null ? undefined : JSON.stringify(body),
  };
}

function seedFirebase({ training, hostStripeAccount = 'acct_host_1' } = {}) {
  const collections = {
    'one-on-one-trainings': training ? [{ id: training.id, data: training }] : [],
    users: [
      {
        id: 'host_1',
        data: hostStripeAccount ? { creator: { stripeAccountId: hostStripeAccount } } : {},
      },
    ],
  };
  return createFirestoreAdminMock({ collections });
}

const oneTimeTraining = {
  id: 't_one',
  hostId: 'host_1',
  hostInfo: { username: 'coachjoe' },
  status: 'pending',
  pricing: { mode: 'oneTime', amountCents: 9900, currency: 'USD' },
};

const recurringTraining = {
  id: 't_rec',
  hostId: 'host_1',
  hostInfo: { username: 'coachjoe' },
  status: 'pending',
  pricing: { mode: 'recurring', amountCents: 2500, currency: 'USD', interval: 'week' },
};

const baseEnv = { STRIPE_SECRET_KEY: 'sk_test_x', SITE_URL: 'https://fitwithpulse.ai' };

// ---------------------------------------------------------------------
// create-1on1-checkout.js (one-time, destination charge)
// ---------------------------------------------------------------------

test('one-time checkout builds a destination charge with a 3% application fee', async () => {
  const firebase = seedFirebase({ training: oneTimeTraining });
  const stripeFactory = makeStripeFactory();

  await withPatchedEnv(baseEnv, async () => {
    const fn = loadFunction(ONE_TIME_FN, { firebase, stripeFactory });
    const res = await fn.handler(makeEvent({ trainingId: 't_one', buyerId: 'buyer_1' }));

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.success, true);
    assert.match(body.url, /checkout\.stripe\.com/);

    assert.equal(stripeFactory.created.length, 1);
    const params = stripeFactory.created[0];
    assert.equal(params.mode, 'payment');

    const line = params.line_items[0];
    assert.equal(line.price_data.unit_amount, 9900);
    assert.equal(line.price_data.currency, 'usd');
    assert.match(line.price_data.product_data.name, /coachjoe/);

    // The money-routing assertions — this is the whole point of the test.
    assert.equal(params.payment_intent_data.transfer_data.destination, 'acct_host_1');
    assert.equal(params.payment_intent_data.application_fee_amount, 297); // 3% of 9900
    assert.equal(params.payment_intent_data.metadata.trainingId, 't_one');
    assert.equal(params.payment_intent_data.metadata.buyerId, 'buyer_1');
    assert.equal(params.payment_intent_data.metadata.hostId, 'host_1');

    assert.equal(params.metadata.trainingId, 't_one');
    assert.match(params.success_url, /\/coaching\/t_one\?status=success$/);
    assert.match(params.cancel_url, /status=cancelled$/);
  });
});

test('one-time checkout 404s when the training does not exist', async () => {
  const firebase = seedFirebase({ training: null });
  const stripeFactory = makeStripeFactory();
  await withPatchedEnv(baseEnv, async () => {
    const fn = loadFunction(ONE_TIME_FN, { firebase, stripeFactory });
    const res = await fn.handler(makeEvent({ trainingId: 'missing', buyerId: 'b' }));
    assert.equal(res.statusCode, 404);
    assert.equal(stripeFactory.created.length, 0);
  });
});

test('one-time checkout 400s on mode mismatch (recurring training)', async () => {
  const firebase = seedFirebase({ training: recurringTraining });
  const stripeFactory = makeStripeFactory();
  await withPatchedEnv(baseEnv, async () => {
    const fn = loadFunction(ONE_TIME_FN, { firebase, stripeFactory });
    const res = await fn.handler(makeEvent({ trainingId: 't_rec', buyerId: 'b' }));
    assert.equal(res.statusCode, 400);
    assert.match(JSON.parse(res.body).error, /one-time/);
    assert.equal(stripeFactory.created.length, 0);
  });
});

test('one-time checkout 400s when the coach has no connected Stripe account', async () => {
  const firebase = seedFirebase({ training: oneTimeTraining, hostStripeAccount: null });
  const stripeFactory = makeStripeFactory();
  await withPatchedEnv(baseEnv, async () => {
    const fn = loadFunction(ONE_TIME_FN, { firebase, stripeFactory });
    const res = await fn.handler(makeEvent({ trainingId: 't_one', buyerId: 'b' }));
    assert.equal(res.statusCode, 400);
    assert.match(JSON.parse(res.body).error, /Stripe account/);
    assert.equal(stripeFactory.created.length, 0);
  });
});

test('one-time checkout 400s when trainingId/buyerId are missing', async () => {
  const firebase = seedFirebase({ training: oneTimeTraining });
  const stripeFactory = makeStripeFactory();
  await withPatchedEnv(baseEnv, async () => {
    const fn = loadFunction(ONE_TIME_FN, { firebase, stripeFactory });
    const res = await fn.handler(makeEvent({ buyerId: 'b' }));
    assert.equal(res.statusCode, 400);
  });
});

test('one-time checkout returns 200 for CORS preflight and 405 for GET', async () => {
  const firebase = seedFirebase({ training: oneTimeTraining });
  const stripeFactory = makeStripeFactory();
  await withPatchedEnv(baseEnv, async () => {
    const fn = loadFunction(ONE_TIME_FN, { firebase, stripeFactory });
    assert.equal((await fn.handler(makeEvent(null, { method: 'OPTIONS' }))).statusCode, 200);
    assert.equal((await fn.handler(makeEvent(null, { method: 'GET' }))).statusCode, 405);
  });
});

// ---------------------------------------------------------------------
// create-1on1-subscription-checkout.js (recurring, connected-account sub)
// ---------------------------------------------------------------------

test('recurring checkout builds a subscription routed to the connected account', async () => {
  const firebase = seedFirebase({ training: recurringTraining });
  const stripeFactory = makeStripeFactory();

  await withPatchedEnv(baseEnv, async () => {
    const fn = loadFunction(SUB_FN, { firebase, stripeFactory });
    const res = await fn.handler(makeEvent({ trainingId: 't_rec', buyerId: 'buyer_2' }));

    assert.equal(res.statusCode, 200);
    assert.equal(stripeFactory.created.length, 1);
    const params = stripeFactory.created[0];

    assert.equal(params.mode, 'subscription');
    const line = params.line_items[0];
    assert.equal(line.price_data.unit_amount, 2500);
    assert.equal(line.price_data.recurring.interval, 'week');

    // Connected-account subscription routing + 3% platform fee.
    assert.equal(params.subscription_data.transfer_data.destination, 'acct_host_1');
    assert.equal(params.subscription_data.application_fee_percent, 3);
    assert.equal(params.subscription_data.metadata.trainingId, 't_rec');
    assert.equal(params.subscription_data.metadata.payment_type, 'coaching_subscription');
    assert.equal(params.metadata.buyerId, 'buyer_2');
  });
});

test('recurring checkout 400s on mode mismatch (one-time training)', async () => {
  const firebase = seedFirebase({ training: oneTimeTraining });
  const stripeFactory = makeStripeFactory();
  await withPatchedEnv(baseEnv, async () => {
    const fn = loadFunction(SUB_FN, { firebase, stripeFactory });
    const res = await fn.handler(makeEvent({ trainingId: 't_one', buyerId: 'b' }));
    assert.equal(res.statusCode, 400);
    assert.match(JSON.parse(res.body).error, /recurring/);
    assert.equal(stripeFactory.created.length, 0);
  });
});

test('recurring checkout normalizes an unknown interval to month', async () => {
  const weird = { ...recurringTraining, id: 't_weird', pricing: { mode: 'recurring', amountCents: 5000, currency: 'USD', interval: 'fortnight' } };
  const firebase = seedFirebase({ training: weird });
  const stripeFactory = makeStripeFactory();
  await withPatchedEnv(baseEnv, async () => {
    const fn = loadFunction(SUB_FN, { firebase, stripeFactory });
    const res = await fn.handler(makeEvent({ trainingId: 't_weird', buyerId: 'b' }));
    assert.equal(res.statusCode, 200);
    assert.equal(stripeFactory.created[0].line_items[0].price_data.recurring.interval, 'month');
  });
});
