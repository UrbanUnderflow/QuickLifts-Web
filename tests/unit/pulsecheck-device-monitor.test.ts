import test from 'node:test';
import assert from 'node:assert/strict';

const installFirebaseEnv = () => {
  const required = {
    NEXT_PUBLIC_FIREBASE_API_KEY: 'test-api-key',
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: 'test.firebaseapp.com',
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'quicklifts-test',
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: 'quicklifts-test.appspot.com',
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: '123456789',
    NEXT_PUBLIC_FIREBASE_APP_ID: '1:123456789:web:test',
  };
  for (const [key, value] of Object.entries(required)) {
    process.env[key] ||= value;
  }
};

const loadMonitor = async () => {
  installFirebaseEnv();
  return import('../../src/api/firebase/pulsecheckDeviceMonitor');
};

const dateKey = (date: Date) =>
  `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;

test('device monitor counts only measured records and preserves the metric provider', async () => {
  const { deriveAthleteDeviceStatus } = await loadMonitor();
  const start = new Date('2026-08-09T00:00:00Z');
  const windowStart = Math.round(start.getTime() / 1000);
  const windowDateKeys = Array.from({ length: 14 }, (_, index) => {
    const day = new Date(start);
    day.setUTCDate(day.getUTCDate() + index);
    return dateKey(day);
  });

  const whoopRecords = windowDateKeys.slice(0, 10).map((day, index) => ({
    id: `whoop-${day}`,
    athleteUserId: 'athlete-1',
    sourceFamily: 'whoop',
    sourceType: index === 0 ? 'whoop_training' : 'whoop_activity',
    recordType: 'summary_input',
    domain: index === 0 ? 'training' : 'activity',
    observedAt: windowStart + index * 86_400 + 43_200,
    ingestedAt: windowStart + index * 86_400 + 43_300,
    timezone: 'UTC',
    status: 'active',
    dedupeKey: `athlete-1|whoop|activity|${day}`,
    payloadVersion: '1.0',
    payload: index === 0 ? { totalDurationMinutes: 41 } : { activeMinutes: 41 },
    sourceMetadata: {},
    provenance: { mode: 'direct', rawDay: day },
  }));
  const metadataOnlyRecords = ['fitbit', 'polar'].map((sourceFamily) => ({
    ...whoopRecords[0],
    id: `${sourceFamily}-metadata`,
    sourceFamily,
    sourceType: `${sourceFamily}_activity`,
    dedupeKey: `athlete-1|${sourceFamily}|activity|${windowDateKeys[13]}`,
    observedAt: windowStart + 13 * 86_400 + 43_200,
    payload: { steps: 0, cardioLoad: -1, lastSyncTimestamp: windowStart + 13 * 86_400 },
    provenance: { mode: 'direct', rawDay: windowDateKeys[13] },
  }));
  const genericGoogleRecord = {
    ...whoopRecords[0],
    id: 'google-health-measured',
    sourceFamily: 'google_health',
    sourceType: 'google_health_activity',
    dedupeKey: `athlete-1|google_health|activity|${windowDateKeys[10]}`,
    observedAt: windowStart + 10 * 86_400 + 43_200,
    payload: {
      steps: 3_822,
      fieldSources: { steps: 'google_health' },
      fieldSourceLabels: { steps: 'Google Health' },
    },
    provenance: { mode: 'direct', rawDay: windowDateKeys[10] },
  };
  const now = windowStart + 14 * 86_400 - 1;

  const result = deriveAthleteDeviceStatus({
    membership: { userId: 'athlete-1', email: 'athlete@example.com' } as any,
    user: undefined,
    records: [...whoopRecords, ...metadataOnlyRecords, genericGoogleRecord] as any,
    sourceStatuses: [
      { sourceFamily: 'fitbit', lifecycleState: 'connected_synced', lastSuccessfulSyncAt: now },
      { sourceFamily: 'polar', lifecycleState: 'connected_synced', lastSuccessfulSyncAt: now },
    ],
    now,
    windowStart,
    windowDays: 14,
    windowDateKeys,
  });

  const whoop = result.devices.find((device) => device.sourceFamily === 'whoop');
  const googleHealth = result.devices.find((device) => device.sourceFamily === 'google_health');
  const fitbit = result.devices.find((device) => device.sourceFamily === 'fitbit');
  const polar = result.devices.find((device) => device.sourceFamily === 'polar');

  assert.equal(whoop?.wearDaysCovered, 10);
  assert.equal(googleHealth?.wearDaysCovered, 1);
  assert.equal(googleHealth?.label, 'Google Health');
  assert.equal(fitbit?.wearDaysCovered, 0);
  assert.equal(polar?.wearDaysCovered, 0);
  assert.equal(result.wearDaysCovered, 11);
  assert.equal(result.devices.some((device) => device.label === 'Fitbit Air'), false);
});

test('coach evidence hydrates WHOOP and HealthKit coverage without connection-only sources', async () => {
  const {
    deriveAthleteDeviceStatus,
    deriveAthleteDeviceStatusFromEvidence,
    mergeAthleteDeviceStatusEvidence,
  } = await loadMonitor();
  const start = new Date('2026-08-09T00:00:00Z');
  const windowStart = Math.round(start.getTime() / 1000);
  const windowDateKeys = Array.from({ length: 14 }, (_, index) => {
    const day = new Date(start);
    day.setUTCDate(day.getUTCDate() + index);
    return dateKey(day);
  });
  const records = [
    ...windowDateKeys.slice(4).map((day, index) => ({
      id: `whoop-${day}`,
      athleteUserId: 'athlete-1',
      sourceFamily: 'whoop',
      sourceType: 'whoop_recovery',
      recordType: 'summary_input',
      domain: 'recovery',
      observedAt: windowStart + (index + 4) * 86_400 + 43_200,
      ingestedAt: windowStart + (index + 4) * 86_400 + 43_300,
      timezone: 'UTC',
      status: 'active',
      dedupeKey: `athlete-1|whoop|recovery|${day}`,
      payloadVersion: '1.0',
      payload: {
        sleepDuration: 7.5,
        fieldSources: { sleepDuration: 'whoop' },
      },
      sourceMetadata: {},
      provenance: { mode: 'direct', rawDay: day },
    })),
    ...windowDateKeys.slice(-2).map((day, index) => ({
      id: `healthkit-${day}`,
      athleteUserId: 'athlete-1',
      sourceFamily: 'healthkit',
      sourceType: 'healthkit_activity',
      recordType: 'summary_input',
      domain: 'activity',
      observedAt: windowStart + (index + 12) * 86_400 + 50_000,
      ingestedAt: windowStart + (index + 12) * 86_400 + 50_100,
      timezone: 'UTC',
      status: 'active',
      dedupeKey: `athlete-1|healthkit|activity|${day}`,
      payloadVersion: '1.0',
      payload: {
        steps: 5_000,
        fieldSources: { steps: 'healthkit' },
      },
      sourceMetadata: {},
      provenance: { mode: 'direct', rawDay: day },
    })),
  ];

  const result = deriveAthleteDeviceStatusFromEvidence({
    records: records as any,
    windowDays: 14,
    windowDateKeys,
    windowStart,
    computedAt: windowStart + 14 * 86_400 - 1,
    evidenceState: 'available',
  }, {
    id: 'athlete-1',
    displayName: 'Athlete One',
    email: 'athlete@example.com',
  });

  assert.equal(result.wearDaysCovered, 10);
  assert.equal(result.wearCoveragePct, 71);
  assert.equal(result.devices.find((device) => device.sourceFamily === 'whoop')?.wearCoveragePct, 71);
  assert.equal(result.devices.find((device) => device.sourceFamily === 'healthkit')?.wearCoveragePct, 14);
  assert.deepEqual(result.devices.map((device) => device.sourceFamily).sort(), ['healthkit', 'whoop']);

  const connectionContext = deriveAthleteDeviceStatus({
    membership: { userId: 'athlete-1', email: 'athlete@example.com' } as any,
    user: undefined,
    records: [],
    sourceStatuses: [{
      sourceFamily: 'whoop',
      lifecycleState: 'connected_synced',
      lastSuccessfulSyncAt: windowStart + 14 * 86_400 - 1,
    }],
    now: windowStart + 14 * 86_400 - 1,
    windowStart,
    windowDays: 14,
    windowDateKeys,
  });
  const merged = mergeAthleteDeviceStatusEvidence(result, connectionContext);

  assert.equal(merged.wearCoveragePct, 71);
  assert.equal(merged.connectionStatus, 'synced');
  assert.equal(
    merged.devices.find((device) => device.sourceFamily === 'whoop')?.connectionStatus,
    'stale',
  );
});
