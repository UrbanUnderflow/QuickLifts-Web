import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateAutonomicLane,
  calculatePulseCheckCoherenceScore,
  calculatePulseCheckScorecardV2,
  PULSECHECK_COHERENCE_WEIGHTS,
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

  assert.equal(result.methodologyVersion, '2.2.2');
  assert.equal(result.wellbeing.score, 70);
  assert.equal(result.adherence.score, 100);
  assert.equal(result.recovery.score, 0);
  assert.equal(result.coherence.score, 42);
  assert.equal(result.coherence.status, 'available');
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

test('coherence gives adherence a bounded contribution without a disagreement multiplier', () => {
  const days = dateKeys(14).map((dateKey, index): PulseCheckScoringDay => ({
    dateKey,
    wellbeingLevel: 4,
    subjectiveRecoveryLevel: index === 13 ? 1 : 4,
    scheduledCheckIn: true,
    commitment: { state: 'completed', commitmentId: `c-${dateKey}` },
  }));
  const result = calculatePulseCheckScorecardV2({ days });

  assert.equal(result.adherence.score, 100);
  assert.equal(result.wellbeing.score, 75);
  assert.equal(result.recovery.score, 0);
  assert.equal(result.coherence.score, 44);
  assert.equal(result.coherence.status, 'available');
  assert.ok(result.coherence.notes.some((note) => note.includes('bounded 10% contribution')));
});

test('low adherence influences but cannot collapse an otherwise steady coherence read', () => {
  const days = dateKeys(14).map((dateKey, index): PulseCheckScoringDay => ({
    dateKey,
    wellbeingLevel: 4,
    subjectiveRecoveryLevel: 4,
    scheduledCheckIn: true,
    commitment: { state: index < 2 ? 'completed' : 'missed', commitmentId: `c-${dateKey}` },
  }));
  const result = calculatePulseCheckScorecardV2({ days });

  assert.equal(result.adherence.score, 48);
  assert.equal(result.wellbeing.score, 75);
  assert.equal(result.recovery.score, 75);
  const coherenceScore = result.coherence.score;
  assert.equal(coherenceScore, 72);
  assert.equal(result.coherence.components.find((component) => component.key === 'adherence')?.configuredWeightPercent, 10);
  assert.ok(coherenceScore !== null && 75 - coherenceScore <= 10);
  assert.ok(coherenceScore !== null && coherenceScore >= 1);
  assert.equal(result.coherence.status, 'available');
});

test('coherence exposes the same 14-day evidence behind its Showing up contribution', () => {
  const days = dateKeys(14).map((dateKey, index): PulseCheckScoringDay => ({
    dateKey,
    wellbeingLevel: 4,
    subjectiveRecoveryLevel: 4,
    scheduledCheckIn: true,
    commitment: { state: index < 10 ? 'completed' : 'missed', commitmentId: `c-${dateKey}` },
  }));
  const result = calculatePulseCheckScorecardV2({ days });
  const showingUp = result.coherence.components.find((component) => component.key === 'adherence');

  assert.equal(result.coherence.score, 76);
  assert.equal(showingUp?.score, result.adherence.score);
  assert.equal(showingUp?.configuredWeightPercent, 10);
  assert.equal(showingUp?.dayStates?.length, 14);
  assert.equal(showingUp?.dayStates?.filter((day) => day.state === 'complete').length, 10);
  assert.equal(showingUp?.dayStates?.filter((day) => day.state === 'partial').length, 4);
});

test('published coherence weights reproduce the screenshot case and cap adherence influence at 10 points', () => {
  assert.equal(Object.values(PULSECHECK_COHERENCE_WEIGHTS).reduce((sum, weight) => sum + weight, 0), 100);
  assert.equal(calculatePulseCheckCoherenceScore(75, 99, 14), 80);
  assert.equal(calculatePulseCheckCoherenceScore(75, 99, null), 87);
  assert.equal(calculatePulseCheckCoherenceScore(100, 100, 0), 90);
  assert.equal(calculatePulseCheckCoherenceScore(100, 100, 100), 100);
  assert.equal(calculatePulseCheckCoherenceScore(null, 99, 14), null);
});

test('coherence requires both wellbeing and recovery to compute a current-window value', () => {
  const days = dateKeys(14).map((dateKey): PulseCheckScoringDay => ({
    dateKey,
    scheduledCheckIn: true,
    commitment: { state: 'completed', commitmentId: `c-${dateKey}` },
  }));
  const result = calculatePulseCheckScorecardV2({ days, accountAgeDays: 365 });

  assert.equal(result.wellbeing.score, null);
  assert.equal(result.recovery.score, null);
  assert.equal(result.coherence.score, null);
  assert.equal(result.coherence.status, 'insufficient_evidence');
});

test('an established coherence read carries forward when the latest window is too thin', () => {
  const days = dateKeys(14).map((dateKey): PulseCheckScoringDay => ({
    dateKey,
    scheduledCheckIn: true,
  }));
  const result = calculatePulseCheckScorecardV2({
    days,
    accountAgeDays: 420,
    establishedCoherenceScore: 76,
  });

  assert.equal(result.coherence.score, 76);
  assert.equal(result.coherence.status, 'available');
  assert.equal(result.coherence.windowDays, 14);
  assert.ok(result.coherence.notes.some((note) => note.includes('carried forward')));
});

test('compatible historical evidence seeds a mature account before a canonical scorecard exists', () => {
  const keys = dateKeys(28);
  const days = keys.map((dateKey, index): PulseCheckScoringDay => index < 14
    ? showingUpDay(dateKey, 4)
    : { dateKey, scheduledCheckIn: true });
  const result = calculatePulseCheckScorecardV2({ days, accountAgeDays: 365 });

  assert.equal(result.coherence.score, 78);
  assert.equal(result.coherence.status, 'available');
  assert.ok(result.coherence.notes.some((note) => note.includes('carried forward')));
});

test('a legacy zero scorecard cannot block compatible historical evidence from seeding Coherence', () => {
  const keys = dateKeys(28);
  const days = keys.map((dateKey, index): PulseCheckScoringDay => index < 14
    ? showingUpDay(dateKey, 4)
    : { dateKey, scheduledCheckIn: true });
  const result = calculatePulseCheckScorecardV2({
    days,
    accountAgeDays: 365,
    establishedCoherenceScore: 0,
  });

  assert.equal(result.coherence.score, 78);
  assert.equal(result.coherence.status, 'available');
});

test('a sufficiently evidenced latest window replaces the established coherence read', () => {
  const days = dateKeys(14).map((dateKey, index): PulseCheckScoringDay => ({
    dateKey,
    scheduledCheckIn: true,
    wellbeingLevel: 4,
    subjectiveRecoveryLevel: 4,
    commitment: {
      state: index < 7 ? 'completed' : 'missed',
      commitmentId: `commitment-${dateKey}`,
    },
  }));
  const result = calculatePulseCheckScorecardV2({
    days,
    accountAgeDays: 365,
    establishedCoherenceScore: 76,
  });

  assert.equal(result.coherence.score, 75);
  assert.notEqual(result.coherence.score, 76);
});

test('a mature account without defensible coherence evidence is unavailable, not building or zero', () => {
  const days = dateKeys(14).map((dateKey): PulseCheckScoringDay => ({
    dateKey,
    scheduledCheckIn: true,
  }));
  const result = calculatePulseCheckScorecardV2({ days, accountAgeDays: 365 });

  assert.equal(result.coherence.score, null);
  assert.equal(result.coherence.status, 'insufficient_evidence');
});

test('coherence uses Building only during the first three account days', () => {
  const days = dateKeys(14).map((dateKey): PulseCheckScoringDay => showingUpDay(dateKey, 4));
  const onboarding = calculatePulseCheckScorecardV2({ days, accountAgeDays: 2 });
  const established = calculatePulseCheckScorecardV2({ days, accountAgeDays: 3 });

  assert.equal(onboarding.coherence.score, null);
  assert.equal(onboarding.coherence.status, 'building');
  assert.equal(established.coherence.score, 78);
  assert.equal(established.coherence.status, 'available');
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
  assert.equal(result.adherence.components[0].dayStates?.at(-1)?.state, 'pending');
});

test('an open current day is pending in the 14-day grid instead of being marked missed early', () => {
  const days = dateKeys(14).map((dateKey, index): PulseCheckScoringDay => ({
    dateKey,
    wellbeingLevel: index === 13 ? null : 4,
    subjectiveRecoveryLevel: 4,
    scheduledCheckIn: true,
  }));
  const result = calculatePulseCheckScorecardV2({ days });

  assert.equal(result.adherence.score, 100);
  assert.equal(result.adherence.components[0].detail, '13 of 13 scorable scheduled check-ins completed.');
  assert.equal(result.adherence.components[0].dayStates?.at(-1)?.state, 'pending');
  assert.equal(result.adherence.components[0].dayStates?.filter((day) => day.state === 'missed').length, 0);
});
