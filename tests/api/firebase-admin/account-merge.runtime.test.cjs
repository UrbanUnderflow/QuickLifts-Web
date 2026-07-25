const test = require('node:test');
const assert = require('node:assert/strict');

const {
  canonicalizeData,
  mergeDataCanonicalWins,
  KEYED_DOCUMENT_COLLECTIONS,
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
      referralRevenueSharePct: 20,
    },
  }, 'source', 'canonical');

  assert.deepEqual(result.commercialConfig, {
    revenueRecipientUserId: 'canonical',
    referralRevenueSharePct: 20,
  });
});

test('merge registry includes the critical identity-owned records', () => {
  for (const collection of ['users', 'subscriptions', 'athlete-mental-progress']) {
    assert.ok(KEYED_DOCUMENT_COLLECTIONS.includes(collection));
  }
  for (const collection of [
    'pulsecheck-team-memberships',
    'pulsecheck-organization-memberships',
    'coach-athlete-conversations',
    'fitWithPulse-workoutSessions',
  ]) {
    assert.ok(USER_REFERENCE_COLLECTIONS.includes(collection));
  }
});
