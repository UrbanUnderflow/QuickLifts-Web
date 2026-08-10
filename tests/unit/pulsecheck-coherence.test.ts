import test from 'node:test';
import assert from 'node:assert/strict';

import {
  calculatePulseCheckCoherence,
  calculatePulseCheckTeamCoherence,
  type PulseCheckCoherenceDay,
} from '../../src/utils/pulsecheckCoherence';

test('coherence matches the PulseCheck 14-day formula', () => {
  const days: PulseCheckCoherenceDay[] = [
    {
      dateKey: '2026-07-20',
      morningLevel: 'low',
      completedTraining: true,
      eligibleTaskCount: 1,
      completedTaskCount: 1,
    },
    {
      dateKey: '2026-07-21',
      morningLevel: 'solid',
      completedTraining: true,
      eligibleTaskCount: 1,
      completedTaskCount: 1,
    },
    {
      dateKey: '2026-07-22',
      eveningLevel: 'locked_in',
      eligibleTaskCount: 1,
      completedTaskCount: 0,
    },
  ];

  const result = calculatePulseCheckCoherence(days);

  assert.equal(result.consistencyPercent, 100);
  assert.equal(result.followThroughPercent, 67);
  assert.equal(result.feelingGoodPercent, 67);
  assert.equal(result.coherencePercent, 78);
});

test('evening check-in is the feeling summary for the day', () => {
  const days: PulseCheckCoherenceDay[] = [
    { dateKey: '2026-07-20', morningLevel: 'solid', eveningLevel: 'low' },
    { dateKey: '2026-07-21', morningLevel: 'solid' },
    { dateKey: '2026-07-22', morningLevel: 'solid' },
  ];

  const result = calculatePulseCheckCoherence(days);

  assert.equal(result.feelingGoodPercent, 67);
});

test('coherence stays in building state until enough evidence exists', () => {
  const result = calculatePulseCheckCoherence([
    {
      dateKey: '2026-07-22',
      morningLevel: 'solid',
      completedTraining: true,
      eligibleTaskCount: 1,
      completedTaskCount: 1,
    },
  ]);

  assert.equal(result.coherencePercent, null);
  assert.equal(result.isStillForming, true);
});

test('coherence treats silence as a low-activity pattern after the first window', () => {
  const result = calculatePulseCheckCoherence(
    Array.from({ length: 14 }, (_, index) => ({
      dateKey: `2026-07-${String(index + 1).padStart(2, '0')}`,
    })),
    14,
    { activatedAt: '2026-06-15' }
  );

  assert.equal(result.isStillForming, false);
  assert.equal(result.observedDays, 14);
  assert.equal(result.consistencyPercent, 0);
  assert.equal(result.coherencePercent, 0);
});

test('coherence counts missing days in the window after onboarding', () => {
  const result = calculatePulseCheckCoherence(
    Array.from({ length: 14 }, (_, index) => {
      const day: PulseCheckCoherenceDay = {
        dateKey: `2026-07-${String(index + 1).padStart(2, '0')}`,
        eligibleTaskCount: 1,
      };
      if (index === 13) {
        day.morningLevel = 'solid';
        day.completedTraining = true;
        day.completedTaskCount = 1;
      }
      return day;
    }),
    14,
    { activatedAt: '2026-06-15' }
  );

  assert.equal(result.isStillForming, false);
  assert.equal(result.observedDays, 14);
  assert.equal(result.showingUpDays, 1);
  assert.equal(result.consistencyPercent, 7);
  assert.equal(result.followThroughPercent, 7);
  assert.equal(result.feelingGoodPercent, 100);
  assert.equal(result.coherencePercent, 38);
});

test('team coherence averages established athlete scores and tracks building athletes', () => {
  const established = calculatePulseCheckCoherence([
    { dateKey: '2026-07-20', morningLevel: 'solid', completedTraining: true },
    { dateKey: '2026-07-21', morningLevel: 'solid', completedTraining: true },
    { dateKey: '2026-07-22', morningLevel: 'solid', completedTraining: true },
  ]);
  const building = calculatePulseCheckCoherence([
    { dateKey: '2026-07-22', morningLevel: 'solid' },
  ]);

  const team = calculatePulseCheckTeamCoherence([established, building]);

  assert.equal(team.athleteCount, 2);
  assert.equal(team.scoredAthleteCount, 1);
  assert.equal(team.buildingAthleteCount, 1);
  assert.equal(team.coherencePercent, 100);
});
