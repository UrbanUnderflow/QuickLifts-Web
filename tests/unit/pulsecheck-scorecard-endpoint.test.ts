import test from 'node:test';
import assert from 'node:assert/strict';
import { __internal } from '../../netlify/functions/get-pulsecheck-scorecard';

test('health snapshot parser identifies Apple HRV as SDNN and keeps the full-day lane', () => {
  const parsed = __internal.healthDayFromSnapshot({
    id: 'athlete_daily_2026-08-16',
    data: {
      snapshotDateKey: '2026-08-16',
      freshness: { perDomain: { recovery: 'fresh' } },
      provenance: { domainWinners: { recovery: 'healthkit' } },
      domains: {
        recovery: {
          freshness: 'fresh',
          provenance: { primarySource: 'healthkit' },
          data: {
            heartRateVariability: 55,
            heartRateResting: 47,
            sleepDuration: 7.5,
            sleepEfficiency: 91,
          },
        },
      },
    },
  });

  assert.ok(parsed);
  assert.equal(parsed.autonomicMeasurements[0].method, 'sdnn');
  assert.equal(parsed.autonomicMeasurements[0].measurementWindow, 'full_day');
  assert.equal(parsed.autonomicMeasurements[1].method, 'resting_heart_rate');
  assert.equal(parsed.sleep?.durationHours, 7.5);
});

test('health snapshot parser respects explicit vendor method metadata', () => {
  const parsed = __internal.healthDayFromSnapshot({
    id: 'athlete_daily_2026-08-16',
    data: {
      snapshotDate: '2026-08-16',
      domains: {
        recovery: {
          freshness: 'recent',
          provenance: { primarySource: 'whoop' },
          data: {
            heartRateVariability: 71,
            heartRateVariabilityMethod: 'rmssd',
            heartRateVariabilityMeasurementWindow: 'sleep',
            heartRateVariabilityAlgorithmVersion: 'whoop-api-v2',
          },
        },
      },
    },
  });

  assert.ok(parsed);
  assert.equal(parsed.autonomicMeasurements[0].method, 'rmssd');
  assert.equal(parsed.autonomicMeasurements[0].measurementWindow, 'sleep');
  assert.equal(parsed.autonomicMeasurements[0].algorithmVersion, 'whoop-api-v2');
});

test('assignment parser never invents verification for work completed elsewhere', () => {
  const commitment = __internal.commitmentFromAssignment({
    id: 'assignment-1',
    status: 'assigned',
    completionClaim: 'already_completed_elsewhere',
  });

  assert.equal(commitment?.state, 'accepted');
});

test('explicit planned rest carries plan and weekly follow-through evidence', () => {
  const commitment = __internal.commitmentFromAssignment({
    id: 'assignment-rest',
    commitmentOutcomeState: 'planned_rest',
    plannedRestWithinPlan: true,
    weeklyFollowThroughMet: false,
  });

  assert.deepEqual(commitment, {
    state: 'planned_rest',
    commitmentId: 'assignment-rest',
    replacementForCommitmentId: null,
    plannedRestWithinPlan: true,
    weeklyFollowThroughMet: false,
  });
});

test('daily input joins wellbeing, recovery, commitment, sleep, and autonomic evidence by date', () => {
  const days = __internal.buildScoringDays({
    dateKeys: ['2026-08-15', '2026-08-16'],
    checkIns: [{
      id: 'athlete_2026-08-16',
      data: { dayKey: '2026-08-16', level: 'solid', subjectiveRecoveryLevel: 'okay' },
    }],
    assignments: [{
      id: 'assignment-1',
      data: { athleteId: 'athlete', sourceDate: '2026-08-16', status: 'completed' },
    }],
    healthSnapshots: [{
      id: 'athlete_daily_2026-08-16',
      data: {
        snapshotDateKey: '2026-08-16',
        domains: {
          recovery: {
            provenance: { primarySource: 'oura' },
            data: { sleepDuration: 8, heartRateVariability: 65 },
          },
        },
      },
    }],
  });

  assert.equal(days.length, 2);
  assert.equal(days[1].wellbeingLevel, 'solid');
  assert.equal(days[1].subjectiveRecoveryLevel, 'okay');
  assert.equal(days[1].commitment?.state, 'completed');
  assert.equal(days[1].sleep?.durationHours, 8);
  assert.equal(days[1].autonomicMeasurements?.[0].method, 'rmssd');
});

test('athlete response removes source-lane identifiers and raw physiological values', () => {
  const scorecard = {
    autonomic: {
      hrv: { laneId: 'whoop|rmssd|sleep', currentValue: 62, score: 55 },
      restingHeartRate: { laneId: 'whoop|rhr|sleep', currentValue: 51, score: 48 },
    },
  } as any;
  const safe = __internal.athleteSafeScorecard(scorecard);

  assert.equal(safe.autonomic.hrv.laneId, null);
  assert.equal(safe.autonomic.hrv.currentValue, null);
  assert.equal(safe.autonomic.hrv.score, 55);
  assert.equal(scorecard.autonomic.hrv.currentValue, 62);
});

test('coach context reports a mixed signal without prescribing physical training', () => {
  const scorecard = {
    autonomic: {
      hrv: { score: 30 },
      restingHeartRate: { score: 70 },
    },
    sourceTransitions: [],
  } as any;
  const coachContext = __internal.buildCoachContext(scorecard, [{
    dateKey: '2026-08-16',
    subjectiveRecoveryLevel: 5,
  }]);

  assert.equal(coachContext.mixedRecoverySignals, true);
  assert.match(coachContext.mixedSignalSummary || '', /informational/i);
  assert.doesNotMatch(coachContext.mixedSignalSummary || '', /reduce|rest today|change training/i);
  assert.match(coachContext.physicalTrainingBoundary, /Coaches and sports medicine staff/);
});

test('staff capability fallback mirrors team role policy', () => {
  assert.equal(__internal.membershipHasCapability({ role: 'coach' }, 'coaching'), true);
  assert.equal(__internal.membershipHasCapability({ role: 'clinician' }, 'athletic_trainer'), true);
  assert.equal(__internal.membershipHasCapability({ role: 'athlete' }, 'coaching'), false);
  assert.equal(__internal.membershipHasCapability({
    role: 'support-staff',
    staffCapabilities: ['administrative'],
  }, 'coaching'), false);
});

test('account age is measured in calendar days for the Coherence onboarding state', () => {
  assert.equal(__internal.dayDifferenceFromKeys('2026-08-17', '2026-08-17'), 0);
  assert.equal(__internal.dayDifferenceFromKeys('2026-08-19', '2026-08-17'), 2);
  assert.equal(__internal.dayDifferenceFromKeys('2026-08-20', '2026-08-17'), 3);
});
