import test from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizePulseCheckAthleteAge,
  resolvePulseCheckAthleteInviteTrack,
} from '../../src/utils/pulsecheckAthleteTrack';

test('age-based athlete routing assigns junior below 18 and pro at 18', () => {
  const junior = resolvePulseCheckAthleteInviteTrack({
    athleteAge: '17',
    selection: 'age-based',
    teamYouthTrack: 'pro',
  });
  const pro = resolvePulseCheckAthleteInviteTrack({
    athleteAge: 18,
    selection: 'age-based',
    teamYouthTrack: 'junior',
  });

  assert.equal(junior.trackOverride, 'junior');
  assert.equal(junior.effectiveTrack, 'junior');
  assert.equal(junior.source, 'age');
  assert.equal(pro.trackOverride, 'pro');
  assert.equal(pro.effectiveTrack, 'pro');
  assert.equal(pro.source, 'age');
});

test('team-default athlete routing preserves the configured team track', () => {
  const result = resolvePulseCheckAthleteInviteTrack({
    athleteAge: 16,
    selection: 'team-default',
    teamYouthTrack: 'rookie',
  });

  assert.equal(result.trackOverride, null);
  assert.equal(result.effectiveTrack, 'rookie');
  assert.equal(result.source, 'team-default');
});

test('an explicit athlete track wins over age and team defaults', () => {
  const result = resolvePulseCheckAthleteInviteTrack({
    athleteAge: 15,
    selection: 'pro',
    teamYouthTrack: 'junior',
  });

  assert.equal(result.trackOverride, 'pro');
  assert.equal(result.effectiveTrack, 'pro');
  assert.equal(result.source, 'athlete-override');
});

test('athlete age accepts whole numbers from 1 through 120', () => {
  assert.equal(normalizePulseCheckAthleteAge('1'), 1);
  assert.equal(normalizePulseCheckAthleteAge(120), 120);
  assert.equal(normalizePulseCheckAthleteAge('17.5'), null);
  assert.equal(normalizePulseCheckAthleteAge(0), null);
  assert.equal(normalizePulseCheckAthleteAge(121), null);
});
