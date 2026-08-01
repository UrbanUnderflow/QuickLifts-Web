const assert = require('node:assert/strict');
const test = require('node:test');

const {
  planConversationUpdate,
} = require('../../../scripts/backfillPulseCheckConversationScopes.cjs');
const {
  migrationPlan,
} = require('../../../scripts/backfillPulseCheckPayoutStateScopes.cjs');
const {
  payoutStateId,
} = require('../../../netlify/functions/utils/pulsecheck-coach-payouts');

const conversationDocument = (data) => ({
  id: 'conversation-1',
  data: () => data,
});

const scopeIndexes = (teamIds = ['team-1']) => {
  const athleteMemberships = teamIds.map((teamId) => ({
    id: `${teamId}_athlete-1`,
    userId: 'athlete-1',
    teamId,
    organizationId: `org-${teamId}`,
    role: 'athlete',
    status: 'active',
  }));
  const membershipsByUser = new Map([
    ['athlete-1', athleteMemberships],
  ]);
  const membershipById = new Map();
  const teamsById = new Map();
  const organizationsById = new Map();
  athleteMemberships.forEach((athleteMembership) => {
    membershipById.set(athleteMembership.id, athleteMembership);
    membershipById.set(`${athleteMembership.teamId}_coach-1`, {
      id: `${athleteMembership.teamId}_coach-1`,
      userId: 'coach-1',
      teamId: athleteMembership.teamId,
      organizationId: athleteMembership.organizationId,
      role: 'coach',
      status: 'active',
    });
    teamsById.set(athleteMembership.teamId, {
      id: athleteMembership.teamId,
      organizationId: athleteMembership.organizationId,
      status: 'active',
    });
    organizationsById.set(athleteMembership.organizationId, {
      id: athleteMembership.organizationId,
      status: 'active',
    });
  });
  return {
    membershipsByUser,
    membershipById,
    teamsById,
    organizationsById,
  };
};

test('conversation backfill writes only one exact shared active scope', () => {
  const plan = planConversationUpdate(
    conversationDocument({
      coachId: 'coach-1',
      athleteId: 'athlete-1',
    }),
    scopeIndexes()
  );

  assert.equal(plan.status, 'update');
  assert.equal(plan.update.teamId, 'team-1');
  assert.equal(plan.update.organizationId, 'org-team-1');
  assert.deepEqual(plan.update.participantIds, ['athlete-1', 'coach-1']);
});

test('conversation backfill leaves multi-team matches for manual review', () => {
  const plan = planConversationUpdate(
    conversationDocument({
      coachId: 'coach-1',
      athleteId: 'athlete-1',
    }),
    scopeIndexes(['team-1', 'team-2'])
  );

  assert.equal(plan.status, 'ambiguous-scope');
  assert.equal(plan.candidates.length, 2);
  assert.equal(plan.update, undefined);
});

test('payout state IDs and legacy migration stay team isolated', () => {
  assert.equal(
    payoutStateId('coach-1', 'team-1'),
    'coach-1__team-1'
  );
  assert.equal(
    payoutStateId('coach-1', 'team-2'),
    'coach-1__team-2'
  );

  const plan = migrationPlan({
    stateId: 'coach-1',
    state: {
      coachUserId: 'coach-1',
      teamIds: ['team-2'],
      paidCents: 1_000,
    },
    requests: [],
    destinationExists: () => false,
  });
  assert.equal(plan.status, 'migrate');
  assert.equal(plan.destinationId, 'coach-1__team-2');
});

test('payout migration does not guess when legacy evidence names multiple teams', () => {
  const plan = migrationPlan({
    stateId: 'coach-1',
    state: {
      coachUserId: 'coach-1',
      teamIds: ['team-1'],
      paidCents: 1_000,
    },
    requests: [{
      coachUserId: 'coach-1',
      teamId: 'team-2',
    }],
    destinationExists: () => false,
  });

  assert.equal(plan.status, 'ambiguous-team');
  assert.deepEqual(plan.teamIds, ['team-1', 'team-2']);
});
