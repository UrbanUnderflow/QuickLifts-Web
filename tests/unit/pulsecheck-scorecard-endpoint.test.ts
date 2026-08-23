import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { __internal } from '../../netlify/functions/get-pulsecheck-scorecard';
import { calculatePulseCheckScorecardV2 } from '../../src/utils/pulsecheckScoringV2';

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

test('daily input joins check-in, sleep, and autonomic evidence by date', () => {
  const days = __internal.buildScoringDays({
    dateKeys: ['2026-08-15', '2026-08-16'],
    checkIns: [{
      id: 'athlete_2026-08-16',
      data: { dayKey: '2026-08-16', level: 'solid', subjectiveRecoveryLevel: 'okay' },
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
  assert.equal(days[1].sleep?.durationHours, 8);
  assert.equal(days[1].autonomicMeasurements?.[0].method, 'rmssd');
});

test('scorecard endpoint never loads module assignments into Showing Up', () => {
  const source = readFileSync(
    new URL('../../netlify/functions/get-pulsecheck-scorecard.ts', import.meta.url),
    'utf8',
  );

  assert.doesNotMatch(source, /pulsecheck-daily-assignments/);
  assert.match(source, /checkInDocuments: checkIns\.length/);
});

test('pre-activation days stay visible in the 14-day grid without counting as missed Showing Up', () => {
  const dateKeys = Array.from({ length: 14 }, (_, index) => `2026-08-${String(index + 1).padStart(2, '0')}`);
  const builtDays = __internal.buildScoringDays({
    dateKeys,
    checkIns: [],
    healthSnapshots: [],
    eligibleFromDateKey: '2026-08-13',
  });
  const days = builtDays.map((day) => day.scheduledCheckIn
    ? {
      ...day,
      wellbeingLevel: 4,
      subjectiveRecoveryLevel: 4,
    }
    : day);
  const scorecard = calculatePulseCheckScorecardV2({ days, accountAgeDays: 1 });
  const dayStates = scorecard.adherence.components[0].dayStates || [];

  assert.equal(builtDays.filter((day) => day.scheduledCheckIn === false).length, 12);
  assert.equal(builtDays.filter((day) => day.scheduledCheckIn).length, 2);
  assert.equal(scorecard.adherence.status, 'building');
  assert.equal(scorecard.adherence.score, null);
  assert.equal(dayStates.length, 14);
  assert.equal(dayStates.filter((day) => day.state === 'excused').length, 12);
  assert.equal(dayStates.filter((day) => day.state === 'complete').length, 2);
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

test('legacy scorecards are not reused as established Coherence under the current method', () => {
  assert.equal(__internal.establishedCoherenceScoreFromDocument({
    methodologyVersion: '2.2.0',
    coherence: { score: 9 },
  }), null);
  assert.equal(__internal.establishedCoherenceScoreFromDocument({
    methodologyVersion: '2.2.1',
    coherence: { score: 73 },
  }), null);
  assert.equal(__internal.establishedCoherenceScoreFromDocument({
    methodologyVersion: '2.2.2',
    coherence: { score: 80 },
  }), null);
  assert.equal(__internal.establishedCoherenceScoreFromDocument({
    methodologyVersion: '2.2.3',
    coherence: { score: 83 },
  }), 83);
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

test('fresh same-day scorecards can be reused without rebuilding sixty days of evidence', () => {
  const nowMillis = Date.parse('2026-08-21T18:00:00.000Z');
  const cached = __internal.reusableCachedScorecard({
    methodologyVersion: '2.2.3',
    throughDateKey: '2026-08-21',
    computedAt: new Date(nowMillis - 5 * 60 * 1000),
    wellbeing: {},
    recovery: {},
    adherence: {
      components: [{
        dayStates: [{
          checkInLabel: 'Completed',
          reason: 'The scheduled check-in was completed.',
        }],
      }],
    },
    coherence: {},
    autonomic: {},
    sourceTransitions: [],
    limitations: [],
    coachContext: { mixedRecoverySignals: false },
  }, '2026-08-21', nowMillis, true);

  assert.ok(cached);
});

test('coach scorecards are rebuilt when cache context is stale or incomplete', () => {
  const nowMillis = Date.parse('2026-08-21T18:00:00.000Z');
  const base = {
    methodologyVersion: '2.2.3',
    throughDateKey: '2026-08-21',
    wellbeing: {},
    recovery: {},
    adherence: {
      components: [{
        dayStates: [{
          checkInLabel: 'Completed',
          reason: 'The scheduled check-in was completed.',
        }],
      }],
    },
    coherence: {},
    autonomic: {},
    sourceTransitions: [],
    limitations: [],
  };

  assert.equal(__internal.reusableCachedScorecard({
    ...base,
    computedAt: new Date(nowMillis - 16 * 60 * 1000),
    coachContext: {},
  }, '2026-08-21', nowMillis, true), null);
  assert.equal(__internal.reusableCachedScorecard({
    ...base,
    computedAt: new Date(nowMillis - 5 * 60 * 1000),
  }, '2026-08-21', nowMillis, true), null);
  assert.equal(__internal.reusableCachedScorecard({
    ...base,
    adherence: { components: [{ dayStates: [{ label: 'Legacy cached day' }] }] },
    computedAt: new Date(nowMillis - 5 * 60 * 1000),
    coachContext: {},
  }, '2026-08-21', nowMillis, true), null);
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

test('scorecard cache payloads remove undefined nested fields before Firestore writes', () => {
  assert.deepEqual(__internal.withoutUndefined({
    coherence: {
      components: [
        { key: 'wellbeing', dayStates: undefined },
        { key: 'showing_up', dayStates: [{ dateKey: '2026-08-22', label: undefined }] },
      ],
    },
  }), {
    coherence: {
      components: [
        { key: 'wellbeing' },
        { key: 'showing_up', dayStates: [{ dateKey: '2026-08-22' }] },
      ],
    },
  });
});

test('coach device evidence includes only measured fields and stamps their actual provider', () => {
  const dates = new Set(['2026-08-22']);
  const measured = __internal.projectMeasuredSourceRecord({
    id: 'athlete_whoop_recovery_2026-08-22',
    data: {
      athleteUserId: 'athlete',
      sourceFamily: 'whoop',
      domain: 'recovery',
      status: 'active',
      observedAt: 1_787_457_600,
      ingestedAt: 1_787_457_700,
      payload: {
        sleepDuration: 7.5,
        heartRateVariability: 61,
        heartRateVariabilityMethod: 'rmssd',
      },
      provenance: { rawDay: '2026-08-22' },
    },
  }, dates);
  const metadataOnly = __internal.projectMeasuredSourceRecord({
    id: 'athlete_polar_recovery_2026-08-22',
    data: {
      athleteUserId: 'athlete',
      sourceFamily: 'polar',
      domain: 'recovery',
      status: 'active',
      payload: { heartRateVariabilityMethod: 'rmssd' },
      provenance: { rawDay: '2026-08-22' },
    },
  }, dates);

  assert.equal(metadataOnly, null);
  assert.equal(measured?.sourceFamily, 'whoop');
  assert.deepEqual((measured?.payload as any).fieldSources, {
    sleepDuration: 'whoop',
    heartRateVariability: 'whoop',
  });
  assert.equal((measured?.payload as any).heartRateVariabilityMethod, undefined);
});

test('generic Google wearable records are not labeled Fitbit without verified device metadata', () => {
  const record = {
    id: 'athlete_fitbit_activity_2026-08-22',
    data: {
      athleteUserId: 'athlete',
      sourceFamily: 'fitbit',
      domain: 'activity',
      status: 'active',
      payload: { steps: 4_200, dataSourceFamily: 'google-wearables' },
      provenance: { rawDay: '2026-08-22' },
    },
  };

  assert.equal(__internal.qualifiedSourceFamily(record), 'google_health');
  assert.equal(
    __internal.projectMeasuredSourceRecord(record, new Set(['2026-08-22']))?.sourceFamily,
    'google_health',
  );
});

test('coach device evidence accepts canonical Health Connect source records', () => {
  const measured = __internal.projectMeasuredSourceRecord({
    id: 'athlete_healthconnect_recovery_2026-08-23',
    data: {
      athleteUserId: 'athlete',
      sourceFamily: 'healthconnect',
      domain: 'recovery',
      status: 'active',
      dedupeKey: 'athlete|health_connect|recovery|2026-08-23',
      observedAt: 1_787_544_000,
      payload: {
        heartRateVariability: 57,
        heartRateResting: 49,
        fieldSources: {
          heartRateVariability: 'healthconnect',
          heartRateResting: 'healthconnect',
        },
        fieldSourceLabels: {
          heartRateVariability: 'Health Connect',
          heartRateResting: 'Health Connect',
        },
      },
    },
  }, new Set(['2026-08-23']));

  assert.equal(measured?.sourceFamily, 'healthconnect');
  assert.equal((measured?.payload as any).heartRateVariability, 57);
  assert.equal((measured?.payload as any).fieldSourceLabels.heartRateVariability, 'Health Connect');
});
