import assert from 'node:assert/strict';
import test from 'node:test';

import {
  pulseCheckScoreDisplayLabel,
  pulseCheckTeamScoreDisplayLabel,
} from '../../src/utils/pulsecheckScorePresentation';

test('score display distinguishes unavailable evidence from onboarding', () => {
  assert.equal(
    pulseCheckScoreDisplayLabel({ score: null, status: 'insufficient_evidence' }),
    'Unavailable',
  );
  assert.equal(
    pulseCheckScoreDisplayLabel({ score: null, status: 'building' }),
    'Building',
  );
  assert.equal(
    pulseCheckScoreDisplayLabel({ score: null, status: 'recalibrating' }),
    'Recalibrating',
  );
  assert.equal(
    pulseCheckScoreDisplayLabel({ score: 81, status: 'available' }),
    '81',
  );
});

test('team display says unavailable when no athlete is scored or onboarding', () => {
  assert.equal(
    pulseCheckTeamScoreDisplayLabel({
      score: null,
      buildingAthleteCount: 0,
    }),
    'Unavailable',
  );
  assert.equal(
    pulseCheckTeamScoreDisplayLabel({
      score: null,
      buildingAthleteCount: 2,
    }),
    'Building',
  );
  assert.equal(
    pulseCheckTeamScoreDisplayLabel({
      score: 76,
      buildingAthleteCount: 0,
    }),
    '76',
  );
});
