const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const {
  compileTypeScriptRuntime,
  createFetchResponse,
  createFirestoreAdminMock,
  loadCompiledModule,
  repoRoot,
  withModuleMocks,
  withPatchedEnv,
} = require('./_runtimeHarness.cjs');

const compiledNetlifyRuntime = compileTypeScriptRuntime({
  cacheKey: 'firebase-admin-netlify-runtime',
  entryPaths: [
    path.join(repoRoot, 'netlify/functions/send-signing-request.ts'),
  ],
});

function loadSendSigningRequest(firebaseMock) {
  return loadCompiledModule({
    compiled: compiledNetlifyRuntime,
    fileName: 'send-signing-request.js',
    mocks: {
      './config/firebase': firebaseMock,
      '/config/firebase': firebaseMock,
    },
  });
}

function loadVerifySubscription({ firebaseMock, stripeFactory }) {
  const modulePath = path.join(repoRoot, 'netlify/functions/verify-subscription.js');
  delete require.cache[modulePath];

  return withModuleMocks(
    {
      './config/firebase': firebaseMock,
      '/config/firebase': firebaseMock,
      stripe: stripeFactory,
    },
    () => require(modulePath)
  );
}

test('send-signing-request sends Brevo email and marks the signing request as sent', async () => {
  const firebaseMock = createFirestoreAdminMock({
    collections: {
      signingRequests: [
        {
          id: 'doc-42',
          data: {
            status: 'draft',
          },
        },
      ],
    },
  });

  await withPatchedEnv(
    {
      BREVO_MARKETING_KEY: 'brevo-key',
      BREVO_SENDER_EMAIL: 'ops@fitwithpulse.ai',
      CUSTOM_BASE_URL: 'https://fitwithpulse.ai',
    },
    async () => {
      const fetchCalls = [];
      const originalFetch = global.fetch;
      global.fetch = async (url, options) => {
        fetchCalls.push({ url, options });
        return createFetchResponse({ json: { messageId: 'brevo-123' } });
      };

      try {
        const { handler } = loadSendSigningRequest({
          ...firebaseMock,
          headers: {},
        });

        const response = await handler({
          httpMethod: 'POST',
          body: JSON.stringify({
            documentId: 'doc-42',
            documentName: 'Service Agreement',
            documentType: 'agreement',
            recipientName: 'Jordan',
            recipientEmail: 'jordan@example.com',
            companyName: 'Pulse Intelligence Labs',
          }),
        });

        assert.equal(response.statusCode, 200);
        assert.equal(fetchCalls.length, 1);
        assert.equal(fetchCalls[0].url, 'https://api.brevo.com/v3/smtp/email');
        assert.equal(fetchCalls[0].options.headers['api-key'], 'brevo-key');

        const payload = JSON.parse(fetchCalls[0].options.body);
        assert.equal(payload.to[0].email, 'jordan@example.com');
        assert.match(payload.htmlContent, /https:\/\/fitwithpulse\.ai\/sign\/doc-42/);

        const updatedRequest = firebaseMock.getDocument('signingRequests/doc-42');
        assert.equal(updatedRequest.status, 'sent');
        assert.ok(updatedRequest.sentAt);
      } finally {
        global.fetch = originalFetch;
      }
    }
  );
});

test('send-signing-request rejects non-POST methods before touching Brevo or Firestore', async () => {
  const firebaseMock = createFirestoreAdminMock();

  await withPatchedEnv(
    {
      BREVO_MARKETING_KEY: 'brevo-key',
      BREVO_SENDER_EMAIL: 'ops@fitwithpulse.ai',
      CUSTOM_BASE_URL: 'https://fitwithpulse.ai',
    },
    async () => {
      const originalFetch = global.fetch;
      let fetchCalled = false;
      global.fetch = async () => {
        fetchCalled = true;
        throw new Error('fetch should not be called for GET');
      };

      const { handler } = loadSendSigningRequest({
        ...firebaseMock,
        headers: {},
      });

      try {
        const response = await handler({
          httpMethod: 'GET',
          body: null,
        });

        assert.equal(response.statusCode, 405);
        assert.equal(response.body, 'Method Not Allowed');
        assert.equal(fetchCalled, false);
        assert.deepEqual(firebaseMock.writes.updates, []);
      } finally {
        global.fetch = originalFetch;
      }
    }
  );
});

test('verify-subscription updates the user and subscription records from Stripe checkout state', async () => {
  const firebaseMock = createFirestoreAdminMock({
    collections: {
      users: [
        {
          id: 'user-1',
          data: {
            email: 'athlete@example.com',
            username: 'athlete-one',
          },
        },
      ],
      subscriptions: [
        {
          id: 'user-1',
          data: {
            plans: [],
          },
        },
      ],
    },
  });

  const stripeCalls = [];
  class MockStripe {
    constructor(secretKey) {
      this.secretKey = secretKey;
      this.checkout = {
        sessions: {
          retrieve: async (sessionId, options) => {
            stripeCalls.push({ secretKey, sessionId, options });
            return {
              status: 'complete',
              payment_status: 'paid',
              client_reference_id: 'user-1',
              customer: 'cus_123',
              metadata: {},
              line_items: {
                data: [
                  {
                    price: {
                      id: 'price_1PDq26RobSf56MUOucDIKLhd',
                    },
                  },
                ],
              },
              subscription: {
                id: 'sub_123',
                status: 'active',
                metadata: {},
                current_period_end: 1730000000,
                items: {
                  data: [
                    {
                      price: {
                        id: 'price_1PDq26RobSf56MUOucDIKLhd',
                      },
                    },
                  ],
                },
              },
            };
          },
        },
      };
    }
  }

  await withPatchedEnv(
    {
      STRIPE_SECRET_KEY: 'live-secret',
      STRIPE_TEST_SECRET_KEY: 'test-secret',
      SITE_URL: 'https://fitwithpulse.ai',
    },
    async () => {
      const originalFetch = global.fetch;
      global.fetch = async () => createFetchResponse({ json: { ok: true } });

      try {
        const { handler } = loadVerifySubscription({
          firebaseMock,
          stripeFactory: MockStripe,
        });

        const response = await handler({
          httpMethod: 'POST',
          headers: {
            origin: 'https://fitwithpulse.ai',
          },
          body: JSON.stringify({
            sessionId: 'cs_live_123',
            userId: 'user-1',
          }),
        });

        assert.equal(response.statusCode, 200);
        assert.equal(stripeCalls.length, 1);
        assert.equal(stripeCalls[0].secretKey, 'live-secret');

        const userDoc = firebaseMock.getDocument('users/user-1');
        assert.equal(userDoc.subscriptionType, 'Monthly Subscriber');
        assert.equal(userDoc.subscriptionPlatform, 'Web');
        assert.equal(userDoc.stripeCustomerId, 'cus_123');
        assert.equal(userDoc.stripeSubscriptionId, 'sub_123');

        const subscriptionDoc = firebaseMock.getDocument('subscriptions/user-1');
        assert.equal(subscriptionDoc.userId, 'user-1');
        assert.equal(subscriptionDoc.platform, 'Web');
        assert.equal(subscriptionDoc.stripeSubscriptionId, 'sub_123');
        assert.ok(Array.isArray(subscriptionDoc.plans));
        assert.equal(subscriptionDoc.plans[0].type, 'pulsecheck-monthly');
      } finally {
        global.fetch = originalFetch;
      }
    }
  );
});
