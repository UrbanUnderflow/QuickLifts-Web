const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { repoRoot, withModuleMocks } = require('./_runtimeHarness.cjs');

const functionPath = path.join(
  repoRoot,
  'netlify/functions/resolve-verified-google-signin.js',
);

const loadFunction = ({ googleIdentity, app }) => {
  delete require.cache[functionPath];
  return withModuleMocks(
    {
      'google-auth-library': {
        OAuth2Client: class OAuth2Client {
          async verifyIdToken({ idToken }) {
            assert.equal(idToken, 'google-id-token');
            return { getPayload: () => googleIdentity };
          }
        },
      },
      './config/firebase': {
        headers: {},
        getFirebaseAdminApp: () => app,
      },
    },
    () => require(functionPath),
  );
};

test('verified Google ownership opens the unique account listed in signInEmails', async () => {
  const auth = {
    async getUser(uid) {
      assert.equal(uid, 'kept-uid');
      return { uid };
    },
    async createCustomToken(uid, claims) {
      assert.equal(uid, 'kept-uid');
      assert.deepEqual(claims, { verifiedGoogleEmail: 'coach@example.com' });
      return 'canonical-custom-token';
    },
  };
  const db = {
    collection(name) {
      assert.equal(name, 'users');
      return {
        where(field, operator, email) {
          assert.deepEqual([field, operator, email], [
            'signInEmails',
            'array-contains',
            'coach@example.com',
          ]);
          return {
            limit(value) {
              assert.equal(value, 2);
              return {
                async get() {
                  return {
                    size: 1,
                    docs: [{ id: 'kept-uid' }],
                  };
                },
              };
            },
          };
        },
      };
    },
  };
  const { handler } = loadFunction({
    googleIdentity: {
      email: 'Coach@Example.com',
      email_verified: true,
    },
    app: {
      auth: () => auth,
      firestore: () => db,
    },
  });

  const response = await handler({
    httpMethod: 'POST',
    body: JSON.stringify({ googleIdToken: 'google-id-token' }),
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(JSON.parse(response.body), {
    canonicalUid: 'kept-uid',
    email: 'coach@example.com',
    customToken: 'canonical-custom-token',
  });
});

test('Google ownership requires a verified email', async () => {
  const { handler } = loadFunction({
    googleIdentity: {
      email: 'coach@example.com',
      email_verified: false,
    },
    app: {
      auth: () => ({}),
      firestore: () => ({}),
    },
  });

  const response = await handler({
    httpMethod: 'POST',
    body: JSON.stringify({ googleIdToken: 'google-id-token' }),
  });

  assert.equal(response.statusCode, 403);
});
