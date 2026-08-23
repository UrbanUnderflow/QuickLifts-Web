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
    viewerUserId: 'coach-1',
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

test('self-view includes compatible native completions and Nora turns without double-counting assignments', () => {
  const details = buildWorkspaceReadinessDailyDetails({
    athleteUserId: 'coach-athlete',
    coachId: 'coach-athlete',
    viewerUserId: 'coach-athlete',
    scope,
    dateKeys: ['2026-08-20', '2026-08-21'],
    checkIns: [{
      id: 'coach-athlete_2026-08-21',
      data: {
        athleteUserId: 'coach-athlete',
        date: '2026-08-21',
        level: 'solid',
      },
    }],
    assignments: [{
      id: 'daily-1',
      data: {
        athleteId: 'coach-athlete',
        coachId: 'coach-athlete',
        teamId: scope.teamId,
        organizationId: scope.organizationId,
        sourceDate: '2026-08-20',
        status: 'completed',
      },
    }],
    completions: [
      {
        id: 'linked-completion',
        source: 'sim-completion',
        data: {
          dailyAssignmentId: 'daily-1',
          completedAt: '2026-08-20T15:00:00.000Z',
          status: 'completed',
        },
      },
      {
        id: 'standalone-completion',
        source: 'exercise-completion',
        data: {
          completedAt: '2026-08-21T15:00:00.000Z',
          status: 'completed',
          durationSeconds: 240,
        },
      },
    ],
    conversations: [{
      id: 'nora-1',
      data: {
        athleteUserId: 'coach-athlete',
        turns: [
          {
            role: 'athlete-reply',
            text: 'I feel strong and ready',
            createdAt: '2026-08-21T16:00:00.000Z',
          },
          {
            role: 'assistant',
            text: 'Thanks for sharing',
            createdAt: '2026-08-21T16:01:00.000Z',
          },
        ],
      },
    }],
  });

  assert.equal(details[0].moduleCompletedCount, 1, 'linked completion does not duplicate the completed assignment');
  assert.equal(details[1].checkInCompleted, true);
  assert.equal(details[1].moduleCompletedCount, 1);
  assert.equal(details[1].moduleDurationSeconds, 240);
  assert.equal(details[1].noraChatCount, 1);
  assert.equal(details[1].noraMessageCount, 1);
  assert.ok((details[1].noraSentimentScore || 0) > 0);
});

test('unscoped completion and Nora evidence stay hidden for a different athlete', () => {
  const details = buildWorkspaceReadinessDailyDetails({
    athleteUserId: 'athlete-1',
    coachId: 'coach-1',
    viewerUserId: 'coach-1',
    scope,
    dateKeys: ['2026-08-21'],
    checkIns: [],
    assignments: [],
    completions: [{
      id: 'unscoped-completion',
      data: { status: 'completed', completedAt: '2026-08-21T15:00:00.000Z' },
    }],
    conversations: [{
      id: 'unscoped-nora',
      data: {
        athleteUserId: 'athlete-1',
        turns: [{ role: 'athlete-reply', text: 'private', createdAt: '2026-08-21T15:00:00.000Z' }],
      },
    }],
  });

  assert.equal(details[0].moduleCompletedCount, 0);
  assert.equal(details[0].noraMessageCount, 0);
});

test('verified roster reads include compatible legacy evidence but reject conflicting workspaces', () => {
  const details = buildWorkspaceReadinessDailyDetails({
    athleteUserId: 'athlete-1',
    coachId: 'coach-1',
    viewerUserId: 'coach-1',
    scope,
    dateKeys: ['2026-08-21'],
    allowUnscopedRosterEvidence: true,
    checkIns: [
      {
        id: 'legacy-check-in',
        data: {
          athleteUserId: 'athlete-1',
          date: '2026-08-21',
          level: 'solid',
        },
      },
      {
        id: 'wrong-workspace-check-in',
        data: {
          athleteUserId: 'athlete-1',
          teamId: 'team-swim',
          organizationId: scope.organizationId,
          date: '2026-08-21',
          eveningCheckIn: { level: 'drained' },
        },
      },
    ],
    assignments: [],
    completions: [
      {
        id: 'legacy-completion',
        source: 'exercise-completion',
        data: {
          status: 'completed',
          completedAt: '2026-08-21T15:00:00.000Z',
          durationSeconds: 180,
        },
      },
      {
        id: 'wrong-workspace-completion',
        source: 'exercise-completion',
        data: {
          teamId: scope.teamId,
          organizationId: 'org-other',
          status: 'completed',
          completedAt: '2026-08-21T16:00:00.000Z',
        },
      },
    ],
    conversations: [
      {
        id: 'legacy-nora',
        data: {
          athleteUserId: 'athlete-1',
          turns: [{
            role: 'athlete-reply',
            text: 'I feel focused and ready',
            createdAt: '2026-08-21T17:00:00.000Z',
          }],
        },
      },
      {
        id: 'wrong-workspace-nora',
        data: {
          athleteUserId: 'athlete-1',
          teamId: scope.teamId,
          organizationId: 'org-other',
          turns: [{
            role: 'athlete-reply',
            text: 'This belongs elsewhere',
            createdAt: '2026-08-21T18:00:00.000Z',
          }],
        },
      },
    ],
  });

  assert.equal(details[0].checkInCompleted, true);
  assert.equal(details[0].coherenceMorningLevel, 'solid');
  assert.equal(details[0].coherenceEveningLevel, null);
  assert.equal(details[0].moduleCompletedCount, 1);
  assert.equal(details[0].moduleDurationSeconds, 180);
  assert.equal(details[0].noraChatCount, 1);
  assert.equal(details[0].noraMessageCount, 1);
});
