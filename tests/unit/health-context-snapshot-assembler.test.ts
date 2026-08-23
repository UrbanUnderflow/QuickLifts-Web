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

const loadAssembler = async () => {
  installFirebaseEnv();
  return import('../../src/api/firebase/healthContextSnapshotAssembler');
};

const buildRecord = (overrides: Record<string, any>) => ({
  id: 'rec-1',
  athleteUserId: 'athlete-1',
  sourceFamily: 'oura',
  sourceType: 'pulsecheck_oura_recovery',
  recordType: 'summary_input',
  domain: 'recovery',
  observedAt: Math.round(new Date('2026-04-25T20:00:00Z').getTime() / 1000),
  observedWindowStart: Math.round(new Date('2026-04-25T00:00:00Z').getTime() / 1000),
  observedWindowEnd: Math.round(new Date('2026-04-25T23:59:59Z').getTime() / 1000),
  ingestedAt: Math.round(new Date('2026-04-25T20:30:00Z').getTime() / 1000),
  timezone: 'America/New_York',
  status: 'active',
  dedupeKey: 'athlete-1|oura|recovery|2026-04-25',
  payloadVersion: '1.0',
  payload: { sleepEfficiency: 0.92, totalSleepMin: 460 },
  sourceMetadata: { syncOrigin: 'pulsecheck_oura_refresh', writer: 'oura-sync.js' },
  provenance: { mode: 'direct', sourceSystem: 'oura_cloud_api', confidenceLabel: 'stable' },
  ...overrides,
});

const baseInput = {
  athleteUserId: 'athlete-1',
  snapshotDate: '2026-04-25',
  snapshotType: 'daily' as const,
  sourceWindow: {
    startsAt: '2026-04-25T00:00:00Z',
    endsAt: '2026-04-25T23:59:59Z',
    timezone: 'America/New_York',
  },
  persist: false,
};

test('assembler — empty input produces empty snapshot with summaryMode=empty', async () => {
  const mod = await loadAssembler();
  const result = await mod.assembleAthleteContextSnapshot({ ...baseInput, records: [] });
  assert.equal(result.snapshot.provenance.summaryMode, 'empty');
  assert.deepEqual(result.snapshot.provenance.sourcesUsed, []);
  assert.equal(result.persisted, false);
  assert.ok(result.omittedDomains.includes('recovery'));
});

test('assembler — single Oura record builds recovery domain block with stable confidence', async () => {
  const mod = await loadAssembler();
  const result = await mod.assembleAthleteContextSnapshot({
    ...baseInput,
    records: [buildRecord({})],
  });
  assert.ok(result.snapshot.domains.recovery, 'recovery block must be present');
  assert.equal(result.snapshot.domains.recovery!.provenance.primarySource, 'oura');
  assert.equal(result.snapshot.domains.recovery!.provenance.dataConfidence, 'stable');
  assert.equal(result.snapshot.domains.recovery!.freshness, 'fresh');
  assert.deepEqual(result.snapshot.provenance.sourcesUsed, ['oura']);
  assert.equal(result.snapshot.provenance.summaryMode, 'direct');
});

test('assembler — Oura + self-report on same domain → Oura wins per precedence', async () => {
  const mod = await loadAssembler();
  const ouraRecord = buildRecord({});
  const selfReportRecord = buildRecord({
    id: 'rec-2',
    sourceFamily: 'pulsecheck_self_report',
    sourceType: 'pulsecheck_self_report_recovery',
    payload: { sleepEfficiencyProxy: 0.7 },
    provenance: { mode: 'self_reported', sourceSystem: 'pulsecheck_self_report', confidenceLabel: 'emerging' },
    dedupeKey: 'athlete-1|pulsecheck_self_report|recovery|2026-04-25',
  });
  const result = await mod.assembleAthleteContextSnapshot({
    ...baseInput,
    records: [selfReportRecord, ouraRecord],
  });
  assert.equal(result.snapshot.domains.recovery!.provenance.primarySource, 'oura');
  assert.equal(result.snapshot.provenance.domainWinners.recovery, 'oura');
  assert.equal(result.snapshot.domains.recovery!.data.sleepEfficiency, 0.92);
});

test('assembler — Polar + Oura on recovery domain → Polar wins sleep/recovery precedence', async () => {
  const mod = await loadAssembler();
  const ouraRecord = buildRecord({
    id: 'rec-oura-recovery',
    payload: { sleepDuration: 4, sleepEfficiency: 0.86 },
  });
  const polarRecord = buildRecord({
    id: 'rec-polar-recovery',
    sourceFamily: 'polar',
    sourceType: 'polar_ble_recovery',
    payload: { sleepDuration: 7.53, sleepEfficiency: 0.93 },
    sourceMetadata: { syncOrigin: 'pulsecheck_polar_ble_sleep', writer: 'PolarBleService.swift' },
    provenance: { mode: 'direct', sourceSystem: 'polar_ble', confidenceLabel: 'stable' },
    dedupeKey: 'athlete-1|polar|recovery|2026-04-25',
  });

  const result = await mod.assembleAthleteContextSnapshot({
    ...baseInput,
    records: [ouraRecord, polarRecord],
  });

  assert.equal(result.snapshot.domains.recovery!.provenance.primarySource, 'polar');
  assert.equal(result.snapshot.provenance.domainWinners.recovery, 'polar');
  assert.equal(result.snapshot.domains.recovery!.data.sleepDuration, 7.53);
  assert.equal(result.snapshot.domains.recovery!.data.sleepEfficiency, 0.93);
});

test('assembler — valid WHOOP sleep beats a short Oura fragment for sleep fields', async () => {
  const mod = await loadAssembler();
  const ouraRecord = buildRecord({
    id: 'rec-oura-recovery',
    payload: { sleepDuration: 35 / 60, sleepEfficiency: 68, respiratoryRate: 16 },
  });
  const whoopRecord = buildRecord({
    id: 'rec-whoop-recovery',
    sourceFamily: 'whoop',
    sourceType: 'pulsecheck_whoop_recovery',
    payload: { sleepDuration: 6.2, sleepEfficiency: 86 },
    sourceMetadata: { syncOrigin: 'pulsecheck_whoop_refresh', writer: 'whoop-sync.js' },
    provenance: { mode: 'direct', sourceSystem: 'whoop_api', confidenceLabel: 'stable' },
    dedupeKey: 'athlete-1|whoop|recovery|2026-04-25',
  });

  const result = await mod.assembleAthleteContextSnapshot({
    ...baseInput,
    records: [ouraRecord, whoopRecord],
  });

  const recovery = result.snapshot.domains.recovery!.data as Record<string, any>;
  assert.equal(recovery.sleepDuration, 6.2);
  assert.equal(recovery.sleepEfficiency, 86);
  assert.equal(recovery.respiratoryRate, 16);
  assert.equal(recovery.fieldSources.sleepDuration, 'whoop');
  assert.equal(recovery.fieldSources.sleepEfficiency, 'whoop');
  assert.equal(recovery.fieldSources.respiratoryRate, 'oura');
  assert.equal(result.snapshot.provenance.domainWinners.recovery, 'whoop');
});

test('assembler ignores metadata-only providers when selecting winners and sources used', async () => {
  const mod = await loadAssembler();
  const fitbitMetadata = buildRecord({
    id: 'rec-fitbit-empty',
    sourceFamily: 'fitbit',
    sourceType: 'fitbit_activity',
    domain: 'activity',
    payload: { steps: 0, lastSyncTimestamp: 1_777_000_000 },
    dedupeKey: 'athlete-1|fitbit|activity|2026-04-25',
  });
  const polarMetadata = buildRecord({
    id: 'rec-polar-empty',
    sourceFamily: 'polar',
    sourceType: 'polar_activity',
    domain: 'activity',
    payload: { cardioLoad: -1, cardioLoadStatus: 'not_available' },
    dedupeKey: 'athlete-1|polar|activity|2026-04-25',
  });
  const whoopMeasured = buildRecord({
    id: 'rec-whoop-activity',
    sourceFamily: 'whoop',
    sourceType: 'whoop_activity',
    domain: 'activity',
    payload: { activeMinutes: 41, activeCalories: 610 },
    dedupeKey: 'athlete-1|whoop|activity|2026-04-25',
  });

  const result = await mod.assembleAthleteContextSnapshot({
    ...baseInput,
    records: [fitbitMetadata, polarMetadata, whoopMeasured],
  });

  const activity = result.snapshot.domains.activity!.data as Record<string, any>;
  assert.equal(result.snapshot.provenance.domainWinners.activity, 'whoop');
  assert.deepEqual(result.snapshot.provenance.sourcesUsed, ['whoop']);
  assert.equal(activity.fieldSources.activeMinutes, 'whoop');
  assert.equal(activity.fieldSources.activeCalories, 'whoop');
});

test('assembler preserves generic Google Health instead of translating it to Fitbit', async () => {
  const mod = await loadAssembler();
  const googleMeasured = buildRecord({
    id: 'rec-google-health-activity',
    sourceFamily: 'google_health',
    sourceType: 'google_health_activity',
    domain: 'activity',
    payload: { steps: 3_822 },
    dedupeKey: 'athlete-1|google_health|activity|2026-04-25',
  });

  const result = await mod.assembleAthleteContextSnapshot({
    ...baseInput,
    records: [googleMeasured],
  });

  const activity = result.snapshot.domains.activity!.data as Record<string, any>;
  assert.equal(result.snapshot.provenance.domainWinners.activity, 'google_health');
  assert.equal(activity.fieldSources.steps, 'google_health');
  assert.deepEqual(result.snapshot.provenance.sourcesUsed, ['google_health']);
});

test('assembler — self-report-only on recovery domain caps confidence at emerging', async () => {
  const mod = await loadAssembler();
  const selfReportRecord = buildRecord({
    sourceFamily: 'pulsecheck_self_report',
    sourceType: 'pulsecheck_self_report_recovery',
    payload: { sleepEfficiencyProxy: 0.6 },
    provenance: { mode: 'self_reported', sourceSystem: 'pulsecheck_self_report', confidenceLabel: 'high_confidence' },
  });
  const result = await mod.assembleAthleteContextSnapshot({
    ...baseInput,
    records: [selfReportRecord],
  });
  assert.equal(result.snapshot.domains.recovery!.provenance.dataConfidence, 'emerging');
});

test('assembler — multiple domains across two sources produces summaryMode=merged_direct', async () => {
  const mod = await loadAssembler();
  const ouraRecovery = buildRecord({});
  const appleActivity = buildRecord({
    id: 'rec-activity-apple',
    sourceFamily: 'apple_health',
    sourceType: 'apple_health_activity',
    domain: 'activity',
    payload: { steps: 12000, exerciseMinutes: 38 },
    provenance: { mode: 'direct', sourceSystem: 'healthkit', confidenceLabel: 'stable' },
    dedupeKey: 'athlete-1|apple_health|activity|2026-04-25',
  });
  const result = await mod.assembleAthleteContextSnapshot({
    ...baseInput,
    records: [ouraRecovery, appleActivity],
  });
  assert.deepEqual(result.snapshot.provenance.sourcesUsed.sort(), ['health_kit', 'oura']);
  assert.equal(result.snapshot.provenance.summaryMode, 'merged_direct');
  assert.equal(result.snapshot.provenance.domainWinners.activity, 'health_kit');
});

test('assembler — gap-fills payload fields from contributing source when winner has nothing for that field', async () => {
  const mod = await loadAssembler();
  const ouraRecovery = buildRecord({
    payload: { sleepEfficiency: 0.9 }, // no totalSleepMin
  });
  const selfReportRecovery = buildRecord({
    id: 'rec-self-recovery',
    sourceFamily: 'pulsecheck_self_report',
    sourceType: 'pulsecheck_self_report_recovery',
    payload: { totalSleepMinProxy: 480, sorenessScore: 2 },
    provenance: { mode: 'self_reported', sourceSystem: 'pulsecheck_self_report', confidenceLabel: 'emerging' },
    dedupeKey: 'athlete-1|pulsecheck_self_report|recovery|2026-04-25',
  });
  const result = await mod.assembleAthleteContextSnapshot({
    ...baseInput,
    records: [ouraRecovery, selfReportRecovery],
  });
  const recovery = result.snapshot.domains.recovery!.data as Record<string, unknown>;
  assert.equal(recovery.sleepEfficiency, 0.9);
  assert.equal(recovery.totalSleepMinProxy, 480);
  assert.equal(recovery.sorenessScore, 2);
  assert.ok(result.mergeNotes.some((note) => note.includes('totalSleepMinProxy')));
});

test('assembler — stale records age into recent or historical_only freshness tiers', async () => {
  const mod = await loadAssembler();
  const tenDaysAgo = Math.round(new Date('2026-04-15T20:00:00Z').getTime() / 1000);
  const recoveryRec = buildRecord({ observedAt: tenDaysAgo });
  const result = await mod.assembleAthleteContextSnapshot({
    ...baseInput,
    records: [recoveryRec],
  });
  assert.equal(result.snapshot.domains.recovery!.freshness, 'historical_only');
});

test('assembler — superseded records are ignored', async () => {
  const mod = await loadAssembler();
  const recoveryRec = buildRecord({ status: 'superseded' });
  const result = await mod.assembleAthleteContextSnapshot({
    ...baseInput,
    records: [recoveryRec],
  });
  assert.equal(result.snapshot.domains.recovery, undefined);
  assert.ok(result.omittedDomains.includes('recovery'));
});

test('assembler — identity context flows through from input', async () => {
  const mod = await loadAssembler();
  const result = await mod.assembleAthleteContextSnapshot({
    ...baseInput,
    records: [],
    identity: {
      teamIds: ['team-1'],
      organizationIds: ['org-1'],
      timezone: 'America/Chicago',
      athleteSport: 'basketball',
      athleteSportName: 'Basketball',
    },
  });
  assert.equal(result.snapshot.domains.identity.data.athleteSport, 'basketball');
  assert.deepEqual(result.snapshot.domains.identity.data.teamIds, ['team-1']);
});
