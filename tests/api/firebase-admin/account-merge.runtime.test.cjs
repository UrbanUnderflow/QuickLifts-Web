const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { repoRoot, withModuleMocks } = require('./_runtimeHarness.cjs');

const {
  canonicalizeData,
  mergeDataCanonicalWins,
  KEYED_DOCUMENT_COLLECTIONS,
  REFERENCE_FIELDS_BY_COLLECTION,
  SCALAR_USER_FIELDS,
  USER_REFERENCE_COLLECTIONS,
} = require('../../../netlify/functions/lib/account-merge');

test('canonicalizeData rewrites scalar and array UID references', () => {
  const result = canonicalizeData({
    id: 'source',
    userId: 'source',
    athleteId: 'source',
    participantIds: ['canonical', 'source', 'source'],
    label: 'keep me',
  }, 'source', 'canonical');

  assert.equal(result.id, 'canonical');
  assert.equal(result.userId, 'canonical');
  assert.equal(result.athleteId, 'canonical');
  assert.deepEqual(result.participantIds, ['canonical']);
  assert.equal(result.label, 'keep me');
});

test('mergeDataCanonicalWins preserves canonical conflicts and source-only history', () => {
  const result = mergeDataCanonicalWins({
    email: 'apple@privaterelay.appleid.com',
    sourceOnly: true,
    userId: 'source',
    mergedAccountUids: ['older-source'],
  }, {
    email: 'person@example.com',
    canonicalOnly: true,
    userId: 'canonical',
    mergedAccountUids: ['older-canonical'],
  }, 'source', 'canonical');

  assert.equal(result.email, 'person@example.com');
  assert.equal(result.userId, 'canonical');
  assert.equal(result.sourceOnly, true);
  assert.equal(result.canonicalOnly, true);
  assert.deepEqual(
    new Set(result.mergedAccountUids),
    new Set(['older-source', 'older-canonical', 'source']),
  );
});

test('canonicalizeData rewrites nested commercial revenue recipients', () => {
  const result = canonicalizeData({
    commercialConfig: {
      revenueRecipientUserId: 'source',
      billingOwnerUserId: 'source',
      coachReferralRecipientUserId: 'source',
      referralRevenueSharePct: 20,
    },
    coachUserId: 'source',
    revenueRecipientUserId: 'source',
    billingOwnerUserId: 'source',
    coachReferralRecipientUserId: 'source',
  }, 'source', 'canonical');

  assert.deepEqual(result.commercialConfig, {
    revenueRecipientUserId: 'canonical',
    billingOwnerUserId: 'canonical',
    coachReferralRecipientUserId: 'canonical',
    referralRevenueSharePct: 20,
  });
  assert.equal(result.coachUserId, 'canonical');
  assert.equal(result.revenueRecipientUserId, 'canonical');
  assert.equal(result.billingOwnerUserId, 'canonical');
  assert.equal(result.coachReferralRecipientUserId, 'canonical');
});

test('merge registry includes the critical identity-owned records', () => {
  for (const collection of [
    'users',
    'subscriptions',
    'athlete-mental-progress',
    'pulsecheck-user-revenue-summaries',
  ]) {
    assert.ok(KEYED_DOCUMENT_COLLECTIONS.includes(collection));
  }
  for (const collection of [
    'pulsecheck-team-memberships',
    'pulsecheck-organization-memberships',
    'pulsecheck-revenue-events',
    'pulsecheck-team-revenue-summaries',
    'pulsecheck-coach-service-orders',
    'pulsecheck-assessment-purchases',
    'pulsecheck-referral-attributions',
    'transactions',
    'coach-athlete-conversations',
    'fitWithPulse-workoutSessions',
  ]) {
    assert.ok(USER_REFERENCE_COLLECTIONS.includes(collection));
  }
  for (const field of [
    'coachUserId',
    'purchaserUserId',
    'revenueRecipientUserId',
    'billingOwnerUserId',
    'coachReferralRecipientUserId',
    'commercialConfig.revenueRecipientUserId',
    'commercialConfig.billingOwnerUserId',
    'commercialConfig.coachReferralRecipientUserId',
  ]) {
    assert.ok(SCALAR_USER_FIELDS.includes(field));
  }
  assert.deepEqual(
    new Set(REFERENCE_FIELDS_BY_COLLECTION['pulsecheck-revenue-events']),
    new Set(['subscriberUserId', 'revenueRecipientUserId', 'billingOwnerUserId', 'coachReferralRecipientUserId']),
  );
  assert.deepEqual(
    new Set(REFERENCE_FIELDS_BY_COLLECTION['pulsecheck-coach-service-orders']),
    new Set(['coachUserId', 'athleteUserId']),
  );
  assert.deepEqual(
    new Set(REFERENCE_FIELDS_BY_COLLECTION['pulsecheck-assessment-purchases']),
    new Set(['purchaserUserId', 'coachUserId', 'revenueRecipientUserId']),
  );
  assert.deepEqual(
    new Set(REFERENCE_FIELDS_BY_COLLECTION['pulsecheck-referral-attributions']),
    new Set(['purchaserUserId', 'coachId']),
  );
});

test('merged secondary sign-in receives a custom token for the kept account', async () => {
  const functionPath = path.join(repoRoot, 'netlify/functions/merge-accounts.js');
  delete require.cache[functionPath];

  const authCalls = [];
  const auth = {
    async verifyIdToken(token) {
      authCalls.push({ method: 'verifyIdToken', token });
      return { uid: 'secondary-uid', email: 'secondary@example.com' };
    },
    async getUser(uid) {
      authCalls.push({ method: 'getUser', uid });
      return { uid, email: 'kept@example.com' };
    },
    async createCustomToken(uid, claims) {
      authCalls.push({ method: 'createCustomToken', uid, claims });
      return 'custom-token-for-kept-account';
    },
  };
  const db = {
    collection(collectionName) {
      assert.equal(collectionName, 'account-aliases');
      return {
        doc(uid) {
          assert.equal(uid, 'secondary-uid');
          return {
            async get() {
              return {
                exists: true,
                data: () => ({
                  canonicalUid: 'kept-uid',
                  status: 'data-merged',
                }),
              };
            },
          };
        },
      };
    },
  };

  const { handler } = withModuleMocks(
    {
      './config/firebase': {
        headers: {},
        getFirebaseAdminApp: () => ({
          auth: () => auth,
          firestore: () => db,
        }),
      },
      './lib/account-merge': {
        buildMergePreview: async () => ({}),
        executeMerge: async () => ({}),
        rollbackMerge: async () => ({}),
      },
    },
    () => require(functionPath),
  );

  const response = await handler({
    httpMethod: 'POST',
    headers: { authorization: 'Bearer secondary-id-token' },
    body: JSON.stringify({ action: 'resolve-current-alias' }),
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(JSON.parse(response.body), {
    alias: true,
    canonicalUid: 'kept-uid',
    canonicalEmail: 'kept@example.com',
    customToken: 'custom-token-for-kept-account',
    status: 'data-merged',
  });
  assert.deepEqual(authCalls.at(-1), {
    method: 'createCustomToken',
    uid: 'kept-uid',
    claims: { accountAliasSourceUid: 'secondary-uid' },
  });
});

test('verified Google email resolves to the kept account through signInEmails', async () => {
  const functionPath = path.join(repoRoot, 'netlify/functions/merge-accounts.js');
  delete require.cache[functionPath];

  let aliasData = null;
  const aliasRef = {
    async get() {
      return {
        exists: Boolean(aliasData),
        data: () => aliasData,
      };
    },
    async set(data) {
      aliasData = { ...(aliasData || {}), ...data };
    },
  };
  const auth = {
    async verifyIdToken() {
      return {
        uid: 'new-google-uid',
        email: 'coach@example.com',
        email_verified: true,
        firebase: { sign_in_provider: 'google.com' },
      };
    },
    async getUser(uid) {
      assert.equal(uid, 'kept-uid');
      return { uid, email: 'relay@privaterelay.appleid.com' };
    },
    async createCustomToken(uid, claims) {
      assert.equal(uid, 'kept-uid');
      assert.deepEqual(claims, { accountAliasSourceUid: 'new-google-uid' });
      return 'verified-google-custom-token';
    },
  };
  const db = {
    collection(collectionName) {
      if (collectionName === 'account-aliases') {
        return {
          doc(uid) {
            assert.equal(uid, 'new-google-uid');
            return aliasRef;
          },
        };
      }
      assert.equal(collectionName, 'users');
      return {
        where(field, operator, email) {
          assert.deepEqual([field, operator, email], [
            'signInEmails',
            'array-contains',
            'coach@example.com',
          ]);
          return {
            limit(limit) {
              assert.equal(limit, 2);
              return {
                async get() {
                  return { docs: [{ id: 'kept-uid' }] };
                },
              };
            },
          };
        },
      };
    },
  };

  const { handler } = withModuleMocks(
    {
      './config/firebase': {
        headers: {},
        getFirebaseAdminApp: () => ({
          auth: () => auth,
          firestore: () => db,
        }),
      },
    },
    () => require(functionPath),
  );

  const response = await handler({
    httpMethod: 'POST',
    headers: { authorization: 'Bearer verified-google-token' },
    body: JSON.stringify({ action: 'resolve-current-alias' }),
  });
  const payload = JSON.parse(response.body);

  assert.equal(response.statusCode, 200);
  assert.equal(payload.alias, true);
  assert.equal(payload.canonicalUid, 'kept-uid');
  assert.equal(payload.customToken, 'verified-google-custom-token');
  assert.equal(aliasData.canonicalUid, 'kept-uid');
  assert.equal(aliasData.status, 'verified-email-alias');
  assert.equal(aliasData.verifiedEmail, 'coach@example.com');
});
