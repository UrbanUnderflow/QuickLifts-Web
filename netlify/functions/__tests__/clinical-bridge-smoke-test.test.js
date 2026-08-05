const test = require('node:test');
const assert = require('node:assert/strict');

const firebaseConfigPath = require.resolve('../config/firebase');
require.cache[firebaseConfigPath] = {
  id: firebaseConfigPath,
  filename: firebaseConfigPath,
  loaded: true,
  exports: {
    admin: { firestore: { FieldValue: { serverTimestamp: () => 'server-time' } } },
    db: {},
    headers: {},
    initializeFirebaseAdmin: () => ({}),
  },
};

const {
  buildSyntheticAthlete,
  buildSyntheticEscalation,
  buildWriteBlockedResult,
  canRunSyntheticWrites,
  normalizeClassificationTier,
} = require('../clinical-bridge-smoke-test').__test;

test('synthetic write safety permits test keys and blocks missing or live keys', () => {
  assert.deepEqual(
    canRunSyntheticWrites({ credentialMode: 'test' }),
    { allowed: true, reason: 'test_key' },
  );
  assert.deepEqual(
    canRunSyntheticWrites({ credentialMode: 'missing' }),
    { allowed: false, reason: 'test_key_missing' },
  );
  assert.deepEqual(
    canRunSyntheticWrites({ credentialMode: 'live' }),
    { allowed: false, reason: 'live_key_blocked' },
  );
});

test('synthetic escalation contains the idempotency key and draft routing and consent envelope', () => {
  const athlete = buildSyntheticAthlete({
    externalId: 'clinical-test-athlete-1',
    organizationId: 'clinical-test-org',
    teamId: 'clinical-test-team',
  });
  const escalation = buildSyntheticEscalation({
    escalationRecordId: 'clinical-test-escalation-1',
    tier: 2,
  }, athlete);

  assert.equal(escalation.escalationRecordId, 'clinical-test-escalation-1');
  assert.equal(escalation.routingContext.organizationId, 'clinical-test-org');
  assert.equal(escalation.routingContext.teamId, 'clinical-test-team');
  assert.equal(escalation.consentState.status, 'pending');
  assert.equal(escalation.stateSnapshot.synthetic, true);
  assert.deepEqual(escalation.relevantMentalNotes, []);
});

test('write guard reports a blocked live-key test instead of simulated success', () => {
  const result = buildWriteBlockedResult(
    'escalation-create',
    { allowed: false, reason: 'live_key_blocked' },
    true,
  );
  assert.equal(result.ok, false);
  assert.equal(result.success, false);
  assert.equal(result.skipped, true);
  assert.equal(result.error.code, 'LIVE_CLINICAL_WRITE_TEST_BLOCKED');
});

test('a missing or invalid real classifier result stays unavailable instead of becoming Tier 0', () => {
  assert.equal(normalizeClassificationTier(null), null);
  assert.equal(normalizeClassificationTier({}), null);
  assert.equal(normalizeClassificationTier({ tier: null }), null);
  assert.equal(normalizeClassificationTier({ tier: 'not-a-tier' }), null);
  assert.equal(normalizeClassificationTier({ tier: 0 }), 0);
  assert.equal(normalizeClassificationTier({ tier: 3 }), 3);
});
