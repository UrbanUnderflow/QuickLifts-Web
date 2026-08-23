import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculatePulseCheckTeamScorecardSnapshot,
  type PulseCheckTeamScorecardRead,
} from '../../src/utils/pulsecheckTeamScorecard';

const scorecard = (
  coherence: number | null,
  wellbeing: number | null,
  recovery: number | null,
  showingUp: number | null,
  methodologyVersion = '2.2.3',
): PulseCheckTeamScorecardRead => ({
  methodologyVersion,
  coherence: { score: coherence, status: coherence === null ? 'building' : 'available' },
  wellbeing: { score: wellbeing, status: wellbeing === null ? 'insufficient_evidence' : 'available' },
  recovery: { score: recovery, status: recovery === null ? 'insufficient_evidence' : 'available' },
  adherence: { score: showingUp, status: showingUp === null ? 'insufficient_evidence' : 'available' },
});

test('team scorecard averages canonical athlete scorecards without recreating Coherence', () => {
  const result = calculatePulseCheckTeamScorecardSnapshot(
    [scorecard(80, 75, 99, 14), scorecard(76, 78, 72, 84)],
    2,
  );

  assert.equal(result.methodologyVersion, '2.2.3');
  assert.equal(result.coherencePercent, 78);
  assert.equal(result.wellbeingPercent, 77);
  assert.equal(result.recoveryPercent, 86);
  assert.equal(result.showingUpPercent, 49);
  assert.equal(result.scoredAthleteCount, 2);
  assert.equal(result.unavailableAthleteCount, 0);
});

test('team scorecard excludes stale methods and keeps building separate from unavailable', () => {
  const result = calculatePulseCheckTeamScorecardSnapshot(
    [scorecard(null, 75, 70, 50), scorecard(9, 75, 99, 14, '2.2.2')],
    3,
  );

  assert.equal(result.loadedAthleteCount, 1);
  assert.equal(result.scoredAthleteCount, 0);
  assert.equal(result.buildingAthleteCount, 1);
  assert.equal(result.unavailableAthleteCount, 2);
  assert.equal(result.coherencePercent, null);
});
