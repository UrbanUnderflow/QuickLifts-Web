import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildWorkspaceReadinessDailyDetails,
} from '../../src/api/firebase/coach/readinessWorkspace';
import {
  normalizePulseCheckWorkspaceScope,
  pulseCheckRecordMatchesWorkspace,
} from '../../src/api/firebase/pulsecheckWorkspaceScope';

const scope = {
  teamId: 'team-track',
  organizationId: 'org-pulse',
};

test('workspace scope requires and matches both tenancy identifiers', () => {
  assert.deepEqual(
    normalizePulseCheckWorkspaceScope({
      teamId: ' team-track ',
      organizationId: ' org-pulse ',
    }),
    scope
  );
  assert.equal(
    normalizePulseCheckWorkspaceScope({ teamId: 'team-track' }),
    null
  );
  assert.equal(
    pulseCheckRecordMatchesWorkspace(
      { teamId: 'team-track', organizationId: 'org-pulse' },
      scope
    ),
    true
  );
  assert.equal(
    pulseCheckRecordMatchesWorkspace(
      { teamId: 'team-track' },
      scope
    ),
    false
  );
});

test('coach readiness uses only exact workspace check-ins and assignments', () => {
  const details = buildWorkspaceReadinessDailyDetails({
    athleteUserId: 'athlete-1',
    coachId: 'coach-1',
    scope,
    dateKeys: ['2026-07-29', '2026-07-30', '2026-07-31'],
    checkIns: [
      {
        id: 'athlete-1_2026-07-29',
        data: {
          athleteUserId: 'athlete-1',
          teamId: 'team-track',
          organizationId: 'org-pulse',
          level: 'solid',
          eveningCheckIn: { level: 'locked_in' },
        },
      },
      {
        id: 'athlete-1_2026-07-30',
        data: {
          athleteUserId: 'athlete-1',
          teamId: 'team-track',
          organizationId: 'another-org',
          level: 'solid',
        },
      },
      {
        id: 'athlete-1_2026-07-31',
        data: {
          athleteUserId: 'athlete-1',
          teamId: 'team-track',
          level: 'solid',
        },
      },
    ],
    assignments: [
      {
        id: 'assignment-rev-1',
        data: {
          athleteId: 'athlete-1',
          coachId: 'coach-1',
          teamId: 'team-track',
          organizationId: 'org-pulse',
          sourceDate: '2026-07-29',
          lineageId: 'lineage-a',
          revision: 1,
          status: 'completed',
        },
      },
      {
        id: 'assignment-rev-2',
        data: {
          athleteId: 'athlete-1',
          coachId: 'coach-1',
          teamId: 'team-track',
          organizationId: 'org-pulse',
          sourceDate: '2026-07-29',
          lineageId: 'lineage-a',
          revision: 2,
          status: 'assigned',
        },
      },
      {
        id: 'assignment-completed',
        data: {
          athleteId: 'athlete-1',
          coachId: 'coach-1',
          teamId: 'team-track',
          organizationId: 'org-pulse',
          sourceDate: '2026-07-30',
          status: 'assigned',
          completedAt: 1_785_500_000,
        },
      },
      {
        id: 'wrong-coach',
        data: {
          athleteId: 'athlete-1',
          coachId: 'coach-2',
          teamId: 'team-track',
          organizationId: 'org-pulse',
          sourceDate: '2026-07-30',
          status: 'completed',
        },
      },
      {
        id: 'legacy-unscoped',
        data: {
          athleteId: 'athlete-1',
          coachId: 'coach-1',
          sourceDate: '2026-07-31',
          status: 'completed',
        },
      },
      {
        id: 'check-in-action',
        data: {
          athleteId: 'athlete-1',
          coachId: 'coach-1',
          teamId: 'team-track',
          organizationId: 'org-pulse',
          sourceDate: '2026-07-31',
          actionType: 'check-in',
          status: 'completed',
        },
      },
    ],
  });

  assert.equal(details[0].checkInCompleted, true);
  assert.equal(details[0].coherenceMorningLevel, 'solid');
  assert.equal(details[0].coherenceEveningLevel, 'locked_in');
  assert.equal(details[0].moduleAssignedCount, 1);
  assert.equal(details[0].moduleCompletedCount, 0, 'latest revision wins');

  assert.equal(details[1].checkInCompleted, false);
  assert.equal(details[1].moduleAssignedCount, 1);
  assert.equal(details[1].moduleCompletedCount, 1);
  assert.equal(details[1].coherenceCompletedTraining, true);

  assert.equal(details[2].checkInCompleted, false);
  assert.equal(details[2].moduleAssignedCount, 0);
  assert.equal(details[2].moduleCompletedCount, 0);
});
