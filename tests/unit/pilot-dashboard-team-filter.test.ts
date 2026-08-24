import test from 'node:test';
import assert from 'node:assert/strict';
import { filterBySelectedTeamIds } from '../../src/utils/pilotDashboardTeamFilter';

interface TestAthlete {
  id: string;
  teamIds: string[];
}

const athletes: TestAthlete[] = [
  { id: 'team-a-only', teamIds: ['team-a'] },
  { id: 'team-b-only', teamIds: ['team-b'] },
  { id: 'both-teams', teamIds: ['team-a', 'team-b'] },
  { id: 'another-team', teamIds: ['team-c'] },
];

test('an empty team selection shows every athlete', () => {
  const result = filterBySelectedTeamIds(athletes, [], (athlete) => athlete.teamIds);

  assert.deepEqual(result.map((athlete) => athlete.id), [
    'team-a-only',
    'team-b-only',
    'both-teams',
    'another-team',
  ]);
});

test('multiple selected teams use OR semantics without duplicating a multi-team athlete', () => {
  const result = filterBySelectedTeamIds(
    athletes,
    ['team-a', 'team-b'],
    (athlete) => athlete.teamIds
  );

  assert.deepEqual(result.map((athlete) => athlete.id), [
    'team-a-only',
    'team-b-only',
    'both-teams',
  ]);
  assert.equal(result.filter((athlete) => athlete.id === 'both-teams').length, 1);
});
