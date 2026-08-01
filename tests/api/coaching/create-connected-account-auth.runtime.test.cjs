const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');

const {
  createFirestoreAdminMock,
  repoRoot,
  withModuleMocks,
  withPatchedEnv,
} = require('../firebase-admin/_runtimeHarness.cjs');

const FUNCTION_PATH = path.join(
  repoRoot,
  'netlify/functions/create-connected-account.js'
);

const loadRuntime = ({
  database,
  verifyResult,
  verifyError,
}) => {
  delete require.cache[FUNCTION_PATH];
  const stripeCalls = [];
  function Stripe() {
    return {
      accounts: {
        async create(params) {
          stripeCalls.push(params);
          return { id: 'acct_created' };
        },
      },
    };
  }
  const runtime = withModuleMocks({
    stripe: Stripe,
    './lib/pulsecheck-coach-services': {
      async verifyFirebaseUser() {
        if (verifyError) throw verifyError;
        return verifyResult;
      },
    },
  }, () => require(FUNCTION_PATH));
  return { ...runtime, stripeCalls };
};

const postEvent = (userId = 'coach-1') => ({
  httpMethod: 'POST',
  headers: { authorization: 'Bearer token' },
  body: JSON.stringify({ userId }),
});

test('Stripe Connect onboarding rejects anonymous callers', async () => {
  const error = new Error('Sign in is required to connect payments.');
  error.statusCode = 401;
  const runtime = loadRuntime({ verifyError: error });
  const response = await runtime.handler(postEvent());

  assert.equal(response.statusCode, 401);
  assert.equal(runtime.stripeCalls.length, 0);
});

test('Stripe Connect onboarding rejects a caller-selected user id', async () => {
  const firebase = createFirestoreAdminMock();
  const runtime = loadRuntime({
    database: firebase.db,
    verifyResult: {
      userId: 'coach-1',
      decoded: { email: 'coach@example.com' },
      app: { firestore: () => firebase.db },
    },
  });
  const response = await runtime.handler(postEvent('coach-2'));

  assert.equal(response.statusCode, 403);
  assert.equal(runtime.stripeCalls.length, 0);
});

test('Stripe Connect onboarding rejects revoked team-only seller access', async () => {
  const firebase = createFirestoreAdminMock({
    collections: {
      users: [{
        id: 'coach-1',
        data: {
          id: 'coach-1',
          email: 'coach@example.com',
        },
      }],
      coaches: [],
      subscriptions: [],
      'pulsecheck-team-memberships': [{
        id: 'team-1_coach-1',
        data: {
          userId: 'coach-1',
          teamId: 'team-1',
          organizationId: 'org-1',
          role: 'coach',
          status: 'revoked',
        },
      }],
      'pulsecheck-teams': [{
        id: 'team-1',
        data: {
          organizationId: 'org-1',
          status: 'active',
          commercialConfig: {
            additionalServicesEnabled: true,
            revenueRecipientUserId: 'coach-1',
          },
        },
      }],
      'pulsecheck-organizations': [{
        id: 'org-1',
        data: { status: 'active' },
      }],
    },
  });
  const runtime = loadRuntime({
    database: firebase.db,
    verifyResult: {
      userId: 'coach-1',
      decoded: { email: 'coach@example.com' },
      app: { firestore: () => firebase.db },
    },
  });

  await withPatchedEnv({ STRIPE_SECRET_KEY: 'sk_live_test' }, async () => {
    const response = await runtime.handler(postEvent());
    assert.equal(response.statusCode, 403);
  });
  assert.equal(runtime.stripeCalls.length, 0);
});
