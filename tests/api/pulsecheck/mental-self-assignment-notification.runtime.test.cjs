const assert = require('node:assert/strict');
const test = require('node:test');
const admin = require('../../../functions/node_modules/firebase-admin');

if (admin.apps.length === 0) {
  admin.initializeApp({ projectId: 'pulsecheck-self-assignment-test' });
}

const {
  __selfAssignmentTestUtils: {
    activeTeamScopeMatchesSelfAssignment,
    completionMatchesScopedAssignment,
    isActivePulseCheckRecord,
    selfAssignmentMatchesRecommendation,
  },
} = require('../../../functions/mentalCurriculumNotifications');

function scopedAssignment(overrides = {}) {
  return {
    athleteId: 'athlete-1',
    coachId: 'coach-1',
    recommendationId: 'recommendation-1',
    exerciseId: 'focus-reset',
    source: 'athlete_self_assign',
    teamId: 'team-1',
    organizationId: 'organization-1',
    ...overrides,
  };
}

function scopedRecommendation(overrides = {}) {
  return {
    athleteId: 'athlete-1',
    coachId: 'coach-1',
    exerciseId: 'focus-reset',
    status: 'accepted',
    teamId: 'team-1',
    organizationId: 'organization-1',
    ...overrides,
  };
}

function activeScope(overrides = {}) {
  return {
    athleteId: 'athlete-1',
    coachId: 'coach-1',
    teamId: 'team-1',
    organizationId: 'organization-1',
    team: {
      status: 'active',
      organizationId: 'organization-1',
    },
    organization: {
      status: 'active',
    },
    athleteMembership: {
      userId: 'athlete-1',
      teamId: 'team-1',
      organizationId: 'organization-1',
      role: 'athlete',
      status: 'active',
    },
    coachMembership: {
      userId: 'coach-1',
      teamId: 'team-1',
      organizationId: 'organization-1',
      role: 'coach',
      status: 'active',
      staffCapabilities: ['coaching'],
      rosterVisibilityScope: 'team',
    },
    ...overrides,
  };
}

test('self-assignment identity and scope must exactly match its recommendation', () => {
  assert.equal(
    selfAssignmentMatchesRecommendation(
      scopedAssignment(),
      scopedRecommendation()
    ),
    true
  );
  assert.equal(
    selfAssignmentMatchesRecommendation(
      scopedAssignment({ exerciseId: 'another-exercise' }),
      scopedRecommendation()
    ),
    false
  );
  assert.equal(
    selfAssignmentMatchesRecommendation(
      scopedAssignment({ organizationId: 'organization-2' }),
      scopedRecommendation()
    ),
    false
  );
  assert.equal(
    selfAssignmentMatchesRecommendation(
      scopedAssignment(),
      scopedRecommendation({ status: 'dismissed' })
    ),
    false
  );
});

test('legacy unscoped recommendations cannot create self-assignment notifications', () => {
  const assignment = scopedAssignment();
  const recommendation = scopedRecommendation({ status: 'pending' });
  delete assignment.teamId;
  delete assignment.organizationId;
  delete recommendation.teamId;
  delete recommendation.organizationId;

  assert.equal(
    selfAssignmentMatchesRecommendation(assignment, recommendation),
    false
  );

  assignment.teamId = 'team-1';
  assert.equal(
    selfAssignmentMatchesRecommendation(assignment, recommendation),
    false
  );
});

test('active team scope checks every trusted organization and membership field', () => {
  assert.equal(activeTeamScopeMatchesSelfAssignment(activeScope()), true);
  assert.equal(
    activeTeamScopeMatchesSelfAssignment(
      activeScope({
        athleteMembership: {
          ...activeScope().athleteMembership,
          userId: 'athlete-2',
        },
      })
    ),
    false
  );
  assert.equal(
    activeTeamScopeMatchesSelfAssignment(
      activeScope({
        coachMembership: {
          ...activeScope().coachMembership,
          organizationId: 'organization-2',
        },
      })
    ),
    false
  );
  assert.equal(
    activeTeamScopeMatchesSelfAssignment(
      activeScope({
        organization: {
          status: 'inactive',
        },
      })
    ),
    false
  );
  assert.equal(
    activeTeamScopeMatchesSelfAssignment(
      activeScope({
        coachMembership: {
          ...activeScope().coachMembership,
          rosterVisibilityScope: 'assigned',
          allowedAthleteIds: ['athlete-2'],
        },
      })
    ),
    false
  );
});

test('unknown or revoked membership status fails closed', () => {
  assert.equal(isActivePulseCheckRecord({}), true);
  assert.equal(isActivePulseCheckRecord({ status: 'active' }), true);
  assert.equal(isActivePulseCheckRecord({ status: 'mystery-enabled' }), false);
  assert.equal(
    isActivePulseCheckRecord({ status: 'active', revokedAt: Date.now() }),
    false
  );
});

test('session completion notification scope must match its daily assignment and path athlete', () => {
  const completion = {
    userId: 'athlete-1',
    dailyAssignmentId: 'assignment-1',
  };
  const assignment = {
    athleteId: 'athlete-1',
    coachId: 'coach-1',
    teamId: 'team-1',
    organizationId: 'organization-1',
  };

  assert.equal(
    completionMatchesScopedAssignment(completion, assignment, 'athlete-1'),
    true
  );
  assert.equal(
    completionMatchesScopedAssignment(completion, assignment, 'athlete-2'),
    false
  );
  assert.equal(
    completionMatchesScopedAssignment(
      completion,
      { ...assignment, athleteId: 'athlete-2' },
      'athlete-1'
    ),
    false
  );
  assert.equal(
    completionMatchesScopedAssignment(
      { userId: 'athlete-1' },
      assignment,
      'athlete-1'
    ),
    false
  );
});
