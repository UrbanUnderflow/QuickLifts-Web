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

const loadModules = async () => {
  installFirebaseEnv();
  const [snapshot, selfReport] = await Promise.all([
    import('../../src/api/firebase/athleteContextSnapshot'),
    import('../../src/api/firebase/athleteSelfReport'),
  ]);
  return { snapshot, selfReport };
};

test('AthleteHealthContextSnapshot — buildEmptyAthleteContextSnapshot returns summaryMode=empty', async () => {
  const { snapshot } = await loadModules();
  const input = snapshot.buildEmptyAthleteContextSnapshot('athlete-123', 'daily', '2026-04-25', {
    startsAt: '2026-04-25T00:00:00Z',
    endsAt: '2026-04-25T23:59:59Z',
  });
  assert.equal(input.athleteUserId, 'athlete-123');
  assert.equal(input.snapshotType, 'daily');
  assert.equal(input.snapshotDate, '2026-04-25');
  assert.equal(input.provenance.summaryMode, 'empty');
  assert.deepEqual(input.provenance.sourcesUsed, []);
  assert.equal(input.freshness.overall, 'missing');
  assert.equal(input.domains.identity.data.athleteUserId, 'athlete-123');
  assert.deepEqual(input.audit?.missingDomains, [
    'training',
    'recovery',
    'activity',
    'nutrition',
    'biometrics',
    'behavioral',
  ]);
});

test('AthleteSelfReport — exposes a non-empty canonical question set', async () => {
  const { selfReport } = await loadModules();
  assert.ok(selfReport.SELF_REPORT_QUESTIONS.length >= 4);
});

test('AthleteSelfReport — omits fields Nora cannot reasonably extract', async () => {
  const { selfReport } = await loadModules();
  const ids = selfReport.SELF_REPORT_QUESTIONS.map((q) => q.id);
  // Things athletes cannot self-report meaningfully
  for (const banned of ['hrv_rmssd_ms', 'resting_heart_rate', 'deep_sleep_minutes']) {
    assert.equal(ids.includes(banned as never), false, `unexpected question id ${banned}`);
  }
});

test('AthleteSelfReport — every check-in always asks baseline behavioral questions', async () => {
  const { selfReport } = await loadModules();
  const picked = selfReport.pickSelfReportQuestionsForCheckin({ hasConnectedWearable: true });
  const everyCheckinIds = picked.filter((q) => q.cadence === 'every_checkin').map((q) => q.id);
  for (const required of ['energy_level', 'soreness_overall', 'stress_level']) {
    assert.ok(everyCheckinIds.includes(required as never), `missing required check-in question ${required}`);
  }
});

test('AthleteSelfReport — skips device-fillable questions when athlete has a wearable', async () => {
  const { selfReport } = await loadModules();
  const withWearable = selfReport.pickSelfReportQuestionsForCheckin({ hasConnectedWearable: true });
  const sleepQs = withWearable.filter((q) => q.id === 'sleep_quality' || q.id === 'sleep_duration_hours');
  assert.equal(sleepQs.length, 0);
});

test('AthleteSelfReport — asks device-fillable questions when there is no connected wearable', async () => {
  const { selfReport } = await loadModules();
  const without = selfReport.pickSelfReportQuestionsForCheckin({ hasConnectedWearable: false });
  const ids = without.map((q) => q.id);
  for (const required of ['sleep_quality', 'sleep_duration_hours', 'hydration_state']) {
    assert.ok(ids.includes(required as never), `missing device-missing question ${required}`);
  }
});

test('AthleteSelfReport — derived signals: sleep quality 5 maps to sleepEfficiencyProxy 1.0', async () => {
  const { selfReport } = await loadModules();
  const derived = selfReport.computeSelfReportDerivedSignals({
    athleteUserId: 'athlete-1',
    observationDate: '2026-04-25',
    trigger: 'nora_checkin',
    hasConnectedWearable: false,
    answers: [
      { questionId: 'sleep_quality', numericValue: 5 },
      { questionId: 'sleep_duration_hours', numericValue: 7.5 },
    ],
  });
  assert.equal(derived.sleepEfficiencyProxy, 1);
  assert.equal(derived.totalSleepMinProxy, 450);
  assert.equal(derived.freshness, 'fresh');
  assert.equal(derived.sourceStatus, 'connected_synced');
});

test('AthleteSelfReport — derived signals clamp out-of-range numeric inputs', async () => {
  const { selfReport } = await loadModules();
  const derived = selfReport.computeSelfReportDerivedSignals({
    athleteUserId: 'athlete-1',
    observationDate: '2026-04-25',
    trigger: 'nora_checkin',
    hasConnectedWearable: false,
    answers: [
      { questionId: 'perceived_rpe_yesterday', numericValue: 99 },
      { questionId: 'soreness_overall', numericValue: -3 },
    ],
  });
  assert.equal(derived.sessionRpe, 10);
  assert.equal(derived.sorenessScore, 1);
});

test('AthleteSelfReport — empty submission returns missing freshness', async () => {
  const { selfReport } = await loadModules();
  const derived = selfReport.computeSelfReportDerivedSignals({
    athleteUserId: 'athlete-1',
    observationDate: '2026-04-25',
    trigger: 'nora_checkin',
    hasConnectedWearable: false,
    answers: [],
  });
  assert.equal(derived.freshness, 'missing');
  assert.equal(derived.sourceStatus, 'connected_waiting_for_data');
});

test('AthleteSelfReport — accepts known enum values and rejects unknown ones', async () => {
  const { selfReport } = await loadModules();
  const ok = selfReport.computeSelfReportDerivedSignals({
    athleteUserId: 'athlete-1',
    observationDate: '2026-04-25',
    trigger: 'nora_checkin',
    hasConnectedWearable: false,
    answers: [
      { questionId: 'hydration_state', enumValue: 'low' },
      { questionId: 'fueling_state', enumValue: 'on_plan' },
    ],
  });
  assert.equal(ok.hydrationLabel, 'low');
  assert.equal(ok.fuelingLabel, 'on_plan');

  const bad = selfReport.computeSelfReportDerivedSignals({
    athleteUserId: 'athlete-1',
    observationDate: '2026-04-25',
    trigger: 'nora_checkin',
    hasConnectedWearable: false,
    answers: [{ questionId: 'hydration_state', enumValue: 'whatever' }],
  });
  assert.equal(bad.hydrationLabel, undefined);
});
