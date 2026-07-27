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
