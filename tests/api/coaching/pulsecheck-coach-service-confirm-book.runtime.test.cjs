const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const {
  createFirestoreAdminMock,
  repoRoot,
  withModuleMocks,
  withPatchedEnv,
} = require('../firebase-admin/_runtimeHarness.cjs');

const CONFIRM_PATH = path.join(
  repoRoot,
  'netlify/functions/confirm-pulsecheck-coach-service-payment.js'
);
const BOOK_PATH = path.join(
  repoRoot,
  'netlify/functions/book-pulsecheck-coach-service.js'
);
const SERVICE_LIB_PATH = path.join(
  repoRoot,
  'netlify/functions/lib/pulsecheck-coach-services.js'
);

const ORDER_ID = 'service_order_0001';
const SIGNING_ENV = {
  STRIPE_SECRET_KEY: 'sk_live_test',
  PULSECHECK_STRIPE_MODE: 'live',
};

function firebaseModule(firebase, userId = 'mock-user') {
  return {
    admin: firebase.admin,
    db: firebase.db,
    headers: {},
    isDevMode: () => false,
    getFirebaseAdminApp: () => ({
      auth: () => ({
        async verifyIdToken() {
          return { uid: userId };
        },
      }),
      firestore: () => firebase.db,
    }),
  };
}

function loadServiceLib(firebase) {
  delete require.cache[SERVICE_LIB_PATH];
  return withModuleMocks(
    {
      '../config/firebase': firebaseModule(firebase),
      '/config/firebase': firebaseModule(firebase),
    },
    () => require(SERVICE_LIB_PATH)
  );
}

async function firebaseSeed({
  status = 'payment_pending',
  paymentAuthorized = status === 'paid' || status === 'booked',
  orderOverrides = {},
  conversationOverrides = {},
  athleteMembershipOverrides = {},
  coachMembershipOverrides = {},
} = {}) {
  const firebase = createFirestoreAdminMock({
    collections: {
      'pulsecheck-coach-service-orders': [],
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
            ...conversationOverrides,
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
    },
  });

  await withPatchedEnv(SIGNING_ENV, async () => {
    const { sealOrder } = loadServiceLib(firebase);
    const order = sealOrder({
      orderId: ORDER_ID,
      athleteUserId: 'mock-user',
      coachUserId: 'coach_1',
      conversationId: 'conversation_1',
      organizationId: 'organization_1',
      teamId: 'team_1',
      participantIds: ['coach_1', 'mock-user'],
      paymentIntentId: 'pi_service_1',
      stripeMode: 'live',
      stripeCustomerId: 'cus_service_1',
      connectedAccountId: 'acct_coach_1',
      settlementMode: 'manual_platform_payout',
      serviceId: 'one-on-one-video',
      serviceTitle: 'One-on-one video',
      serviceType: 'one_time',
      amountCents: 5335,
      coachPriceCents: 5000,
      processingFeeCents: 335,
      platformFeeCents: 150,
      estimatedStripeFeeCents: 185,
      coachNetCents: 5000,
      currency: 'usd',
      paymentAuthorized,
      status,
      ...orderOverrides,
    });
    await firebase.db
      .collection('pulsecheck-coach-service-orders')
      .doc(ORDER_ID)
      .set(order);
  });
  return firebase;
}

function event(body) {
  return {
    httpMethod: 'POST',
    headers: { authorization: 'Bearer valid-token' },
    body: JSON.stringify(body),
  };
}

const paymentIntent = (overrides = {}) => ({
  id: 'pi_service_1',
  status: 'succeeded',
  amount: 5335,
  amount_received: 5335,
  currency: 'usd',
  livemode: true,
  payment_method_types: ['card'],
  latest_charge: {
    id: 'ch_service_1',
    status: 'succeeded',
    paid: true,
    refunded: false,
    amount_refunded: 0,
    disputed: false,
  },
  metadata: {
    payment_type: 'pulsecheck_coach_service',
    order_id: ORDER_ID,
    conversation_id: 'conversation_1',
    organization_id: 'organization_1',
    team_id: 'team_1',
    service_id: 'one-on-one-video',
    athlete_user_id: 'mock-user',
    coach_user_id: 'coach_1',
    stripe_mode: 'live',
    amount_cents: '5335',
    coach_price_cents: '5000',
    processing_fee_cents: '335',
    platform_fee_cents: '150',
  },
  ...overrides,
});

function stripeFactory(intent = paymentIntent()) {
  const retrieveCalls = [];
  function Stripe() {
    return {
      paymentIntents: {
        async retrieve(id, options) {
          retrieveCalls.push({ id, options });
          return { ...intent, id };
        },
      },
    };
  }
  Stripe.retrieveCalls = retrieveCalls;
  return Stripe;
}

test('payment confirmation retrieves Stripe state before marking an order paid', async () => {
  const firebase = await firebaseSeed();
  const Stripe = stripeFactory();

  delete require.cache[CONFIRM_PATH];
  delete require.cache[SERVICE_LIB_PATH];
  await withPatchedEnv(SIGNING_ENV, async () => {
    const fn = withModuleMocks(
      {
        './config/firebase': firebaseModule(firebase),
        stripe: Stripe,
      },
      () => require(CONFIRM_PATH)
    );
    const response = await fn.handler(event({ orderId: ORDER_ID }));

    assert.equal(response.statusCode, 200);
    const order = firebase.getDocument(
      `pulsecheck-coach-service-orders/${ORDER_ID}`
    );
    assert.equal(order.status, 'paid');
    assert.equal(order.paymentAuthorized, true);
    assert.equal(order.paymentStatus, 'succeeded');
    assert.equal(order.paymentVerificationSource, 'athlete-confirmation');
    assert.deepEqual(Stripe.retrieveCalls, [{
      id: 'pi_service_1',
      options: { expand: ['latest_charge'] },
    }]);
    const { verifyOrderIntegrity } = loadServiceLib(firebase);
    assert.equal(verifyOrderIntegrity(order), true);
  });
});

test('booking requires a paid order and writes the shared pinned booking', async () => {
  const firebase = await firebaseSeed({ status: 'paid' });
  const Stripe = stripeFactory();
  delete require.cache[BOOK_PATH];
  delete require.cache[SERVICE_LIB_PATH];
  await withPatchedEnv(SIGNING_ENV, async () => {
    const fn = withModuleMocks(
      {
        './config/firebase': firebaseModule(firebase),
        stripe: Stripe,
      },
      () => require(BOOK_PATH)
    );
    const scheduledAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const response = await fn.handler(event({
      orderId: ORDER_ID,
      scheduledAt: scheduledAt.toISOString(),
    }));

    assert.equal(response.statusCode, 200);
    const order = firebase.getDocument(
      `pulsecheck-coach-service-orders/${ORDER_ID}`
    );
    const conversation = firebase.getDocument(
      'coach-athlete-conversations/conversation_1'
    );
    assert.equal(order.status, 'booked');
    assert.equal(order.bookingScheduleISO, scheduledAt.toISOString());
    assert.equal(conversation.activeBooking.orderId, ORDER_ID);
    assert.equal(conversation.activeBooking.paymentIntentId, 'pi_service_1');
    assert.equal(conversation.activeBooking.teamId, 'team_1');
    assert.equal(conversation.activeBooking.organizationId, 'organization_1');
    assert.equal(conversation.activeBooking.serviceTitle, 'One-on-one video');
    assert.equal(conversation.activeBooking.price, 50);
    const { verifyOrderIntegrity } = loadServiceLib(firebase);
    assert.equal(verifyOrderIntegrity(order), true);
  });
});

test('booking rejects an order that Stripe has not confirmed', async () => {
  const firebase = await firebaseSeed({ status: 'payment_pending' });
  const Stripe = stripeFactory(paymentIntent({
    status: 'requires_payment_method',
    latest_charge: null,
  }));
  delete require.cache[BOOK_PATH];
  delete require.cache[SERVICE_LIB_PATH];
  await withPatchedEnv(SIGNING_ENV, async () => {
    const fn = withModuleMocks(
      {
        './config/firebase': firebaseModule(firebase),
        stripe: Stripe,
      },
      () => require(BOOK_PATH)
    );
    const response = await fn.handler(event({
      orderId: ORDER_ID,
      scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    }));

    assert.equal(response.statusCode, 409);
    assert.match(JSON.parse(response.body).message, /stripe|payment/i);
    const conversation = firebase.getDocument(
      'coach-athlete-conversations/conversation_1'
    );
    assert.equal(conversation.activeBooking, undefined);
  });
});

test('a forged paid order cannot create a booking', async () => {
  const firebase = await firebaseSeed({ status: 'paid' });
  await firebase.db
    .collection('pulsecheck-coach-service-orders')
    .doc(ORDER_ID)
    .set({
      ...(firebase.getDocument(`pulsecheck-coach-service-orders/${ORDER_ID}`) || {}),
      amountCents: 1,
      coachNetCents: 999999,
    });
  const Stripe = stripeFactory();

  delete require.cache[BOOK_PATH];
  delete require.cache[SERVICE_LIB_PATH];
  await withPatchedEnv(SIGNING_ENV, async () => {
    const fn = withModuleMocks(
      {
        './config/firebase': firebaseModule(firebase),
        stripe: Stripe,
      },
      () => require(BOOK_PATH)
    );
    const response = await fn.handler(event({
      orderId: ORDER_ID,
      scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    }));
    assert.equal(response.statusCode, 409);
    assert.match(JSON.parse(response.body).message, /verified/i);
    assert.equal(
      firebase.getDocument('coach-athlete-conversations/conversation_1').activeBooking,
      undefined
    );
  });
});

test('booking rechecks active team memberships after payment', async () => {
  const firebase = await firebaseSeed({
    status: 'paid',
    coachMembershipOverrides: { status: 'revoked' },
  });
  const Stripe = stripeFactory();

  delete require.cache[BOOK_PATH];
  delete require.cache[SERVICE_LIB_PATH];
  await withPatchedEnv(SIGNING_ENV, async () => {
    const fn = withModuleMocks(
      {
        './config/firebase': firebaseModule(firebase),
        stripe: Stripe,
      },
      () => require(BOOK_PATH)
    );
    const response = await fn.handler(event({
      orderId: ORDER_ID,
      scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    }));
    assert.equal(response.statusCode, 403);
    assert.equal(Stripe.retrieveCalls.length, 0);
  });
});

test('refunded Stripe charges cannot be booked even if the order says paid', async () => {
  const firebase = await firebaseSeed({ status: 'paid' });
  const Stripe = stripeFactory(paymentIntent({
    latest_charge: {
      id: 'ch_service_1',
      status: 'succeeded',
      paid: true,
      refunded: true,
      amount_refunded: 5335,
      disputed: false,
    },
  }));

  delete require.cache[BOOK_PATH];
  delete require.cache[SERVICE_LIB_PATH];
  await withPatchedEnv(SIGNING_ENV, async () => {
    const fn = withModuleMocks(
      {
        './config/firebase': firebaseModule(firebase),
        stripe: Stripe,
      },
      () => require(BOOK_PATH)
    );
    const response = await fn.handler(event({
      orderId: ORDER_ID,
      scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    }));
    assert.equal(response.statusCode, 409);
    assert.match(JSON.parse(response.body).message, /stripe|payment/i);
  });
});
