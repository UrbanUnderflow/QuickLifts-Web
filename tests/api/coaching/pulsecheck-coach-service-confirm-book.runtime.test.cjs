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

function firebaseSeed({ status = 'payment_pending' } = {}) {
  return createFirestoreAdminMock({
    collections: {
      'pulsecheck-coach-service-orders': [
        {
          id: 'service_order_1',
          data: {
            athleteUserId: 'mock-user',
            coachUserId: 'coach_1',
            conversationId: 'conversation_1',
            paymentIntentId: 'pi_service_1',
            serviceId: 'one-on-one-video',
            serviceTitle: 'One-on-one video',
            amountCents: 5000,
            platformFeeCents: 150,
            coachNetCents: 4850,
            currency: 'usd',
            status,
          },
        },
      ],
      'coach-athlete-conversations': [
        {
          id: 'conversation_1',
          data: {
            athleteId: 'mock-user',
            coachId: 'coach_1',
            athleteName: 'Alex Athlete',
            coachName: 'Coach Calvin',
          },
        },
      ],
    },
  });
}

function firebaseModule(firebase) {
  return {
    admin: firebase.admin,
    db: firebase.db,
    headers: {},
    isDevMode: () => false,
    getFirebaseAdminApp: () => ({
      auth: firebase.admin.auth,
      firestore: () => firebase.db,
    }),
  };
}

function event(body) {
  return {
    httpMethod: 'POST',
    headers: { authorization: 'Bearer valid-token' },
    body: JSON.stringify(body),
  };
}

test('payment confirmation retrieves Stripe state before marking an order paid', async () => {
  const firebase = firebaseSeed();
  function Stripe() {
    return {
      paymentIntents: {
        async retrieve(id) {
          return {
            id,
            status: 'succeeded',
            payment_method_types: ['card'],
            metadata: {
              payment_type: 'pulsecheck_coach_service',
              order_id: 'service_order_1',
              athlete_user_id: 'mock-user',
            },
          };
        },
      },
    };
  }

  delete require.cache[CONFIRM_PATH];
  delete require.cache[SERVICE_LIB_PATH];
  await withPatchedEnv({ STRIPE_SECRET_KEY: 'sk_live_test' }, async () => {
    const fn = withModuleMocks(
      {
        './config/firebase': firebaseModule(firebase),
        stripe: Stripe,
      },
      () => require(CONFIRM_PATH)
    );
    const response = await fn.handler(event({ orderId: 'service_order_1' }));

    assert.equal(response.statusCode, 200);
    const order = firebase.getDocument(
      'pulsecheck-coach-service-orders/service_order_1'
    );
    assert.equal(order.status, 'paid');
    assert.equal(order.paymentStatus, 'succeeded');
    assert.equal(order.paymentVerificationSource, 'athlete-confirmation');
  });
});

test('booking requires a paid order and writes the shared pinned booking', async () => {
  const firebase = firebaseSeed({ status: 'paid' });
  delete require.cache[BOOK_PATH];
  delete require.cache[SERVICE_LIB_PATH];
  const fn = withModuleMocks(
    {
      './config/firebase': firebaseModule(firebase),
    },
    () => require(BOOK_PATH)
  );
  const scheduledAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const response = await fn.handler(event({
    orderId: 'service_order_1',
    scheduledAt: scheduledAt.toISOString(),
  }));

  assert.equal(response.statusCode, 200);
  const order = firebase.getDocument(
    'pulsecheck-coach-service-orders/service_order_1'
  );
  const conversation = firebase.getDocument(
    'coach-athlete-conversations/conversation_1'
  );
  assert.equal(order.status, 'booked');
  assert.equal(conversation.activeBooking.orderId, 'service_order_1');
  assert.equal(conversation.activeBooking.paymentIntentId, 'pi_service_1');
  assert.equal(conversation.activeBooking.serviceTitle, 'One-on-one video');
  assert.equal(conversation.activeBooking.price, 50);
});

test('booking rejects an order that Stripe has not confirmed', async () => {
  const firebase = firebaseSeed({ status: 'payment_pending' });
  delete require.cache[BOOK_PATH];
  delete require.cache[SERVICE_LIB_PATH];
  const fn = withModuleMocks(
    {
      './config/firebase': firebaseModule(firebase),
    },
    () => require(BOOK_PATH)
  );
  const response = await fn.handler(event({
    orderId: 'service_order_1',
    scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  }));

  assert.equal(response.statusCode, 409);
  assert.match(JSON.parse(response.body).message, /payment/i);
  const conversation = firebase.getDocument(
    'coach-athlete-conversations/conversation_1'
  );
  assert.equal(conversation.activeBooking, undefined);
});
