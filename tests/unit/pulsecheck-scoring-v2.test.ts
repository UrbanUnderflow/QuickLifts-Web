import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateAutonomicLane,
  calculatePulseCheckScorecardV2,
  pulseCheckMeasurementLaneId,
  type PulseCheckAutonomicMeasurement,
  type PulseCheckScoringDay,
} from '../../src/utils/pulsecheckScoringV2';

const dateKeys = (count: number, end = new Date('2026-08-16T00:00:00.000Z')) =>
  Array.from({ length: count }, (_, index) => {
    const date = new Date(end);
    date.setUTCDate(end.getUTCDate() - (count - 1 - index));
    return date.toISOString().slice(0, 10);
  });

const showingUpDay = (dateKey: string, level: number, completed = true): PulseCheckScoringDay => ({
  dateKey,
  wellbeingLevel: level,
  subjectiveRecoveryLevel: level,
  scheduledCheckIn: true,
  commitment: {
    state: completed ? 'completed' : 'missed',
    commitmentId: `commitment-${dateKey}`,
  },
});

test('scorecard returns four separate scores and keeps a hard wellbeing day out of adherence', () => {
  const days = dateKeys(14).map((dateKey, index) => showingUpDay(dateKey, index === 13 ? 1 : 4));
  const result = calculatePulseCheckScorecardV2({ days, generatedAt: '2026-08-16T12:00:00.000Z' });

  assert.equal(result.methodologyVersion, '2.0.0');
  assert.equal(result.wellbeing.score, 70);
  assert.equal(result.adherence.score, 100);
  assert.equal(result.coherence.score, 100);
  assert.equal(result.recovery.score, 0);
  assert.equal(result.generatedAt, '2026-08-16T12:00:00.000Z');
});

test('missing data lowers evidence coverage and is never converted to zero', () => {
  const days = dateKeys(14).map((dateKey, index): PulseCheckScoringDay => ({
    dateKey,
    scheduledCheckIn: true,
    wellbeingLevel: index === 13 ? 'solid' : null,
  }));
  const result = calculatePulseCheckScorecardV2({ days });

  assert.equal(result.wellbeing.score, null);
  assert.equal(result.wellbeing.status, 'building');
  assert.ok(result.wellbeing.evidenceCoveragePercent > 0);
  assert.equal(result.recovery.score, null);
  assert.equal(result.recovery.status, 'insufficient_evidence');
  assert.ok(result.wellbeing.notes.some((note) => note.includes('not scored as zero')));
});

test('coherence is capped by adherence even when completed commitments are highly congruent', () => {
  const days = dateKeys(14).map((dateKey, index): PulseCheckScoringDay => ({
    dateKey,
    scheduledCheckIn: true,
    wellbeingLevel: index < 3 ? 4 : null,
    commitment: index < 3
      ? { state: 'completed', commitmentId: `commitment-${index}` }
      : { state: 'missed', commitmentId: `commitment-${index}` },
  }));
  const result = calculatePulseCheckScorecardV2({ days });

  assert.equal(result.adherence.score, 21);
  assert.equal(result.coherence.components[1].score, 100);
  assert.equal(result.coherence.score, 21);
});

test('planned rest counts only when it fits the plan and weekly follow-through remains intact', () => {
  const keys = dateKeys(14);
  const inPlan = keys.map((dateKey): PulseCheckScoringDay => ({
    dateKey,
    wellbeingLevel: 4,
    commitment: {
      state: 'planned_rest',
      commitmentId: `rest-${dateKey}`,
      plannedRestWithinPlan: true,
      weeklyFollowThroughMet: true,
    },
  }));
  const overPlan = inPlan.map((day, index) => index === 13
    ? {
      ...day,
      commitment: {
        ...day.commitment!,
        weeklyFollowThroughMet: false,
      },
    }
    : day);

  assert.equal(calculatePulseCheckScorecardV2({ days: inPlan }).adherence.score, 100);
  assert.equal(calculatePulseCheckScorecardV2({ days: overPlan }).adherence.score, 96);
});

test('Apple SDNN and RMSSD measurements always form different lanes', () => {
  const apple: PulseCheckAutonomicMeasurement = {
    dateKey: '2026-08-16',
    metric: 'hrv',
    value: 54,
    sourceFamily: 'healthkit',
    deviceId: 'apple-watch',
    method: 'sdnn',
    measurementWindow: 'full_day',
  };
  const whoop: PulseCheckAutonomicMeasurement = {
    ...apple,
    value: 62,
    sourceFamily: 'whoop',
    deviceId: 'whoop-5',
    method: 'rmssd',
    measurementWindow: 'sleep',
  };

  assert.notEqual(pulseCheckMeasurementLaneId(apple), pulseCheckMeasurementLaneId(whoop));
});

test('a source switch recalibrates instead of blending old and new raw HRV', () => {
  const keys = dateKeys(22);
  const measurements: PulseCheckAutonomicMeasurement[] = keys.map((dateKey, index) => ({
    dateKey,
    metric: 'hrv',
    value: 50 + (index % 3),
    sourceFamily: index < 20 ? 'healthkit' : 'whoop',
    deviceId: index < 20 ? 'apple-watch' : 'whoop-5',
    method: index < 20 ? 'sdnn' : 'rmssd',
    measurementWindow: index < 20 ? 'full_day' : 'sleep',
  }));
  const result = calculateAutonomicLane(measurements, 'hrv', keys[keys.length - 1]);

  assert.equal(result.status, 'recalibrating');
  assert.equal(result.score, null);
  assert.equal(result.baselineCount, 1);
  assert.equal(result.sourceTransition, true);
  assert.equal(result.sourceFamily, 'whoop');
});

test('same-lane autonomic history produces a source-normalized score', () => {
  const keys = dateKeys(20);
  const measurements: PulseCheckAutonomicMeasurement[] = keys.map((dateKey, index) => ({
    dateKey,
    metric: 'resting_heart_rate',
    value: index === keys.length - 1 ? 57 : 50 + (index % 3),
    sourceFamily: 'whoop',
    deviceId: 'whoop-5',
    method: 'resting_heart_rate',
    measurementWindow: 'sleep',
  }));
  const result = calculateAutonomicLane(measurements, 'resting_heart_rate', keys[keys.length - 1]);

  assert.equal(result.status, 'available');
  assert.ok((result.score ?? 100) < 50);
  assert.equal(result.baselineCount, 19);
});

test('previous recovery trend keeps the earlier same-lane baseline history', () => {
  const start = new Date('2026-06-15T00:00:00.000Z');
  const days = Array.from({ length: 60 }, (_, index): PulseCheckScoringDay => {
    const dateKey = new Date(start.getTime() + index * 86_400_000).toISOString().slice(0, 10);
    return {
      ...showingUpDay(dateKey, 4),
      autonomicMeasurements: [
        {
          dateKey,
          metric: 'hrv',
          value: index < 46 ? 55 : 52,
          sourceFamily: 'whoop',
          deviceId: 'whoop-5',
          method: 'rmssd',
          measurementWindow: 'sleep',
        },
      ],
    };
  });
  const result = calculatePulseCheckScorecardV2({ days, generatedAt: '2026-08-14T12:00:00.000Z' });

  assert.equal(result.recovery.status, 'available');
  assert.notEqual(result.recovery.trendDelta, null);
});

test('replacement acceptance is pending today and becomes missed only after the day closes', () => {
  const keys = dateKeys(14);
  const days = keys.map((dateKey, index): PulseCheckScoringDay => ({
    dateKey,
    wellbeingLevel: 4,
    commitment: {
      state: index === 13 ? 'replacement_accepted' : 'completed',
      commitmentId: `replacement-${index}`,
      replacementForCommitmentId: index === 13 ? 'original' : null,
    },
  }));
  const result = calculatePulseCheckScorecardV2({ days });

  assert.equal(result.adherence.components[1].detail, '13 of 13 scorable commitments followed through.');
  assert.equal(result.adherence.score, 100);
});
