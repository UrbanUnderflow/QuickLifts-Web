const test = require('node:test');
const assert = require('node:assert/strict');

const firebaseConfigPath = require.resolve('../config/firebase');
require.cache[firebaseConfigPath] = {
  id: firebaseConfigPath,
  filename: firebaseConfigPath,
  loaded: true,
  exports: {
    initializeFirebaseAdmin: () => ({}),
    admin: {},
  },
};

const ouraUtilsPath = require.resolve('../oura-utils');
require.cache[ouraUtilsPath] = {
  id: ouraUtilsPath,
  filename: ouraUtilsPath,
  loaded: true,
  exports: {
    CONNECTIONS_COLLECTION: 'pulsecheck-oura-connections',
    RESPONSE_HEADERS: {},
    buildOuraErrorResponse: () => ({ statusCode: 500, headers: {}, body: '{}' }),
    buildConnectionDocId: (userId) => userId,
    createError: (statusCode, message) => Object.assign(new Error(message), { statusCode }),
    getOauthCredentials: () => ({ clientId: 'test', clientSecret: 'test' }),
    verifyAuth: async () => ({ uid: 'user_test' }),
  },
};

const {
  chooseBestSleepRecord,
  chooseLatestRecord,
  buildSnapshotDateKeysForOuraProjection,
  buildSnapshotArtifacts,
  isUsableSleepRecord,
  sleepRecordTypePriority,
} = require('../oura-sync').__test;

test('chooseBestSleepRecord prefers the main overnight sleep for the requested day', () => {
  const selected = chooseBestSleepRecord(
    [
      {
        id: 'sleep_short',
        day: '2026-03-22',
        type: 'sleep',
        total_sleep_duration: 32 * 60,
        time_in_bed: 40 * 60,
        bedtime_end: '2026-03-22T09:32:00-04:00',
      },
      {
        id: 'sleep_rest',
        day: '2026-03-22',
        type: 'rest',
        total_sleep_duration: 90 * 60,
        bedtime_end: '2026-03-22T08:00:00-04:00',
      },
      {
        id: 'sleep_main',
        day: '2026-03-22',
        type: 'long_sleep',
        total_sleep_duration: (5 * 60 + 51) * 60,
        time_in_bed: (6 * 60 + 13) * 60,
        bedtime_end: '2026-03-22T07:11:00-04:00',
      },
    ],
    '2026-03-22'
  );

  assert.equal(selected?.id, 'sleep_main');
});

test('chooseBestSleepRecord falls back to the latest valid sleep when the preferred day is absent', () => {
  const selected = chooseBestSleepRecord(
    [
      {
        id: 'sleep_old',
        day: '2026-03-20',
        type: 'long_sleep',
        total_sleep_duration: 7 * 3600,
        bedtime_end: '2026-03-20T06:45:00-04:00',
      },
      {
        id: 'sleep_recent',
        day: '2026-03-21',
        type: 'long_sleep',
        total_sleep_duration: 6.5 * 3600,
        bedtime_end: '2026-03-21T06:50:00-04:00',
      },
    ],
    '2026-03-22'
  );

  assert.equal(selected?.id, 'sleep_recent');
});

test('buildSnapshotDateKeysForOuraProjection does not project stale sleep onto the requested day', () => {
  assert.deepEqual(
    buildSnapshotDateKeysForOuraProjection('2026-05-04', '2026-05-02'),
    ['2026-05-02']
  );
  assert.deepEqual(
    buildSnapshotDateKeysForOuraProjection('2026-05-04', '2026-05-04'),
    ['2026-05-04']
  );
});

test('buildSnapshotArtifacts preserves Polar-owned recovery when Oura sync runs later', () => {
  const artifacts = buildSnapshotArtifacts({
    userId: 'user_test',
    dateKey: '2026-05-04',
    timezone: 'America/New_York',
    syncAt: 1_777_870_800,
    requestedDateKey: '2026-05-04',
    observedDateKey: '2026-05-04',
    sourceStatusDoc: {
      id: 'user_test_oura',
      sourceFamily: 'oura',
      lifecycleState: 'connected_synced',
    },
    sourceRecordDocs: [{ id: 'user_test_oura_recovery_2026-05-04' }],
    sleepPayload: { sleepDuration: 4, sleepEfficiency: 0.86 },
    readinessPayload: { readinessScore: 82 },
    stressPayload: { recoveryHighMinutes: 12 },
    existingSnapshot: {
      provenance: {
        sourcesUsed: ['polar'],
        sourceRecordIds: ['user_test_polar_recovery_2026-05-04'],
        domainWinners: { recovery: 'polar' },
      },
      domains: {
        recovery: { sleepDuration: 7.53, sleepEfficiency: 0.93 },
        summary: { dataSourcesUsed: ['polar'] },
      },
      freshness: { recovery: 'fresh', overall: 'fresh' },
    },
  });

  assert.equal(artifacts.snapshot.provenance.domainWinners.recovery, 'polar');
  assert.equal(artifacts.snapshot.domains.recovery.sleepDuration, 7.53);
  assert.equal(artifacts.snapshot.domains.recovery.sleepEfficiency, 0.93);
  assert.equal(artifacts.snapshot.domains.summary.readinessScore, 82);
  assert.deepEqual(artifacts.snapshot.provenance.sourcesUsed.sort(), ['oura', 'polar']);
});

test('chooseLatestRecord breaks same-day ties with timestamp instead of array order', () => {
  const selected = chooseLatestRecord(
    [
      {
        id: 'readiness_early',
        day: '2026-03-22',
        timestamp: '2026-03-22T06:00:00-04:00',
      },
      {
        id: 'readiness_late',
        day: '2026-03-22',
        timestamp: '2026-03-22T08:00:00-04:00',
      },
    ],
    { timestampKeys: ['timestamp'] }
  );

  assert.equal(selected?.id, 'readiness_late');
});

test('sleep helpers classify unusable and primary sleep types correctly', () => {
  assert.equal(isUsableSleepRecord({ type: 'deleted' }), false);
  assert.equal(isUsableSleepRecord({ type: 'rest' }), false);
  assert.equal(isUsableSleepRecord({ type: 'sleep' }), true);
  assert.equal(sleepRecordTypePriority({ type: 'long_sleep' }), 3);
  assert.equal(sleepRecordTypePriority({ type: 'sleep' }), 2);
  assert.equal(sleepRecordTypePriority({ type: 'late_nap' }), 1);
});

test('mapStressPayload drops the zeroed stub Oura emits for unworn days', () => {
  const { mapStressPayload } = require('../oura-sync').__test;

  // Unworn ring: zeroed durations, no summary — must read as "no data".
  assert.deepEqual(mapStressPayload({ stress_high: 0, recovery_high: 0, day_summary: null }), {});
  assert.deepEqual(mapStressPayload({}), {});

  // Worn days keep their signal.
  assert.deepEqual(mapStressPayload({ stress_high: 45, recovery_high: 0, day_summary: null }), {
    daytimeAutonomicLoadMinutes: 45,
    recoveryHighMinutes: 0,
  });
  assert.equal(mapStressPayload({ stress_high: 0, recovery_high: 0, day_summary: 'restored' }).daySummary, 'restored');
});
