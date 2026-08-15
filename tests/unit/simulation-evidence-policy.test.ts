import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const profileRuntime = require('../../src/api/firebase/mentaltraining/profileSnapshotRuntime.js');

const installFirebaseEnv = () => {
  const required = {
    NEXT_PUBLIC_FIREBASE_API_KEY: 'test-api-key',
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: 'test.firebaseapp.com',
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'quicklifts-test',
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: 'quicklifts-test.appspot.com',
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: '123456789',
    NEXT_PUBLIC_FIREBASE_APP_ID: '1:123456789:web:test',
  };
  for (const [key, value] of Object.entries(required)) process.env[key] ||= value;
};

const validSessions = [
  {
    coreMetricName: 'distractor_cost',
    coreMetricValue: 0.08,
    supportingMetrics: { reference_accuracy: 0.92, distraction_accuracy: 0.84, scored_reference_rounds: 8, scored_distraction_rounds: 8 },
  },
  {
    coreMetricName: 'post_disruption_reengagement_cost_ms',
    coreMetricValue: 190,
    supportingMetrics: { estimate_available: 1, matched_pair_count: 6 },
  },
  {
    coreMetricName: 'stop_success_rate',
    coreMetricValue: 0.52,
    supportingMetrics: { valid_go_trials: 48, valid_stop_trials: 16 },
  },
  {
    coreMetricName: 'decision_accuracy',
    coreMetricValue: 0.88,
    supportingMetrics: { wrong_choice_rate: 0.08, timeout_rate: 0.04, scored_trial_count: 24 },
  },
  {
    coreMetricName: 'switch_rt_cost_ms',
    coreMetricValue: 84,
    supportingMetrics: { switch_rt_available: 1, valid_repeat_rt_count: 24, valid_switch_rt_count: 24 },
  },
  {
    coreMetricName: 'correct_rt_slope_ms_per_min',
    coreMetricValue: 2.7,
    supportingMetrics: { slope_estimate_available: 1, valid_response_count: 36 },
  },
].map((session, index) => ({
  id: `session-${index}`,
  userId: 'athlete-1',
  simId: `sim-${index}`,
  simName: `Simulation ${index}`,
  durationSeconds: 180,
  normalizedScore: 80,
  targetSkills: [],
  pressureTypes: [],
  sessionType: 'training_rep',
  durationMode: 'standard_rep',
  createdAt: 1_700_000_000_000 + index,
  ...session,
}));

test('simulation sessions remain task evidence and do not alter broad profile scores', () => {
  const baseline = {
    focusRating: 3,
    confidenceRating: 4,
    resilienceRating: 2,
    arousalControlRating: 3,
    biggestChallenge: 'focus_during_competition',
    currentPracticeFrequency: 'weekly',
    pressureResponse: 'anxious_push_through',
  };
  const withoutSimulations = profileRuntime.deriveTaxonomyProfile({ baselineAssessment: baseline });
  const withSimulations = profileRuntime.deriveTaxonomyProfile({
    baselineAssessment: baseline,
    simSessions: validSessions,
  });

  assert.deepEqual(withSimulations.skillScores, withoutSimulations.skillScores);
  assert.deepEqual(withSimulations.pillarScores, withoutSimulations.pillarScores);
  assert.deepEqual(withSimulations.modifierScores, withoutSimulations.modifierScores);
  assert.deepEqual(withSimulations.pressureSensitivity, withoutSimulations.pressureSensitivity);
  assert.equal(withSimulations.overallScore, withoutSimulations.overallScore);
  assert.equal(withSimulations.taskEvidence.usableSessionCount, 6);
  assert.equal(withSimulations.taskEvidence.sportTransferStatus, 'requires_validation');
  assert.deepEqual(
    new Set(withSimulations.taskEvidence.metricNames),
    new Set(validSessions.map((session) => session.coreMetricName)),
  );
});

test('legacy and underpowered simulation metrics are excluded from task evidence', () => {
  const excluded = [
    { ...validSessions[0], coreMetricName: 'decision_latency' },
    { ...validSessions[0], supportingMetrics: { reference_accuracy: 0.92, distraction_accuracy: 0.84, scored_reference_rounds: 4, scored_distraction_rounds: 4 } },
    { ...validSessions[1], supportingMetrics: { estimate_available: 1, matched_pair_count: 5 } },
    { ...validSessions[1], supportingMetrics: { matched_pair_count: 6 } },
    { ...validSessions[2], supportingMetrics: { valid_go_trials: 48, valid_stop_trials: 0 } },
    { ...validSessions[2], supportingMetrics: { valid_go_trials: 47, valid_stop_trials: 16 } },
    { ...validSessions[3], coreMetricValue: 1.2 },
    { ...validSessions[3], supportingMetrics: { scored_trial_count: 23 } },
    { ...validSessions[4], supportingMetrics: { switch_rt_available: 1, valid_repeat_rt_count: 7, valid_switch_rt_count: 8 } },
    { ...validSessions[4], supportingMetrics: { valid_repeat_rt_count: 8, valid_switch_rt_count: 8 } },
    { ...validSessions[5], supportingMetrics: { slope_estimate_available: 1, valid_response_count: 23 } },
    { ...validSessions[5], supportingMetrics: { valid_response_count: 24 } },
  ];
  const summary = profileRuntime.summarizeTaskEvidence(excluded);

  assert.equal(summary.usableSessionCount, 0);
  assert.equal(summary.excludedSessionCount, excluded.length);
  assert.deepEqual(summary.observations, []);
});

test('correlation evidence accepts only quality-gated canonical task estimates', async () => {
  installFirebaseEnv();
  const evidence = await import('../../src/api/firebase/mentaltraining/correlationEvidenceService');

  for (const session of validSessions) {
    assert.equal(evidence.hasUsableCanonicalTaskEstimate(session as any), true);
    assert.equal(evidence.deriveCompletionQuality(session as any), 'high');
  }

  assert.equal(
    evidence.deriveCompletionQuality({ ...validSessions[0], coreMetricName: 'decision_latency' } as any),
    'excluded',
  );
});

test('Sport Intelligence leaves broad cognitive movement unset', async () => {
  installFirebaseEnv();
  const intelligence = await import('../../src/api/firebase/sportsIntelligenceInferenceEngine');
  const result = intelligence.buildCognitiveMovementInterpretation({
    athleteUserId: 'athlete-1',
    snapshotDate: '2026-08-15',
    domains: {
      behavioral: {
        data: { subjectiveReadiness: 82 },
        freshness: 'fresh',
        provenance: { dataConfidence: 'high_confidence' },
      },
    },
  } as any, { name: 'Track & Field' } as any);

  assert.equal(result.focusDelta, undefined);
  assert.equal(result.composureDelta, undefined);
  assert.equal(result.decisioningDelta, undefined);
  assert.equal(result.simEvidenceCount, 0);
  assert.equal(result.confidenceTier, 'directional');
  assert.match(result.reviewerNote, /task-specific/i);
  assert.match(result.reviewerNote, /validated representative evidence/i);
});
