'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  buildDeterministicTarget,
  classifyLegacyRosterLink,
  parseArgs,
  selectValidatedTarget,
  validateApplyGates,
  validateDeterministicContainer,
  validateExactOrganizationMembership,
  validateExactTeamMembership,
} = require('../../../scripts/migratePulseCheckLegacyCoachRosters.cjs');

const activeCoachMembership = (overrides = {}) => ({
  userId: 'coach-1',
  teamId: 'team-1',
  organizationId: 'organization-1',
  role: 'coach',
  staffCapabilities: ['coaching'],
  rosterVisibilityScope: 'team',
  status: 'active',
  ...overrides,
});

test('apply is gated by an explicit project and exact confirmation', () => {
  const dryRun = parseArgs([]);
  assert.equal(dryRun.apply, false);
  assert.equal(validateApplyGates(dryRun), null);

  const missingProject = parseArgs(['--apply']);
  assert.match(validateApplyGates(missingProject), /explicit --project/);

  const missingConfirmation = parseArgs(['--project=dev', '--apply']);
  assert.equal(missingConfirmation.projectId, 'quicklifts-dev-01');
  assert.match(validateApplyGates(missingConfirmation), /--confirm-project=quicklifts-dev-01/);

  const allowed = parseArgs([
    '--project=dev',
    '--confirm-project=quicklifts-dev-01',
    '--apply',
  ]);
  assert.equal(validateApplyGates(allowed), null);
});

test('a team override is accepted only with one exact coach filter', () => {
  const broadOverride = parseArgs([
    '--project=dev',
    '--confirm-project=quicklifts-dev-01',
    '--team-id=team-1',
    '--apply',
  ]);
  assert.match(validateApplyGates(broadOverride), /requires one exact --coach-id/);
});

test('legacy roster link classification rejects disconnected, migrated, and unknown states', () => {
  const active = classifyLegacyRosterLink('link-1', {
    coachId: 'coach-1',
    athleteUserId: 'athlete-1',
    status: 'active',
  });
  assert.deepEqual(active, {
    active: true,
    coachId: 'coach-1',
    athleteId: 'athlete-1',
  });

  assert.equal(
    classifyLegacyRosterLink('link-2', {
      coachId: 'coach-1',
      athleteUserId: 'athlete-1',
      disconnectedAt: 123,
    }).reason,
    'disconnected'
  );
  assert.equal(
    classifyLegacyRosterLink('link-3', {
      coachId: 'coach-1',
      athleteUserId: 'athlete-1',
      pulseCheckMigrationStatus: 'migrated',
    }).reason,
    'already_migrated'
  );
  assert.equal(
    classifyLegacyRosterLink('link-4', {
      coachId: 'coach-1',
      athleteUserId: 'athlete-1',
      status: 'pending',
    }).reason,
    'unknown_status'
  );
});

test('team memberships must match deterministic id, identity, scope, role, and active state', () => {
  assert.equal(
    validateExactTeamMembership({
      documentId: 'team-1_coach-1',
      data: activeCoachMembership(),
      teamId: 'team-1',
      organizationId: 'organization-1',
      userId: 'coach-1',
      requiredRole: 'coach',
    }),
    true
  );
  assert.equal(
    validateExactTeamMembership({
      documentId: 'random-doc',
      data: activeCoachMembership(),
      teamId: 'team-1',
      organizationId: 'organization-1',
      userId: 'coach-1',
      requiredRole: 'coach',
    }),
    false
  );
  assert.equal(
    validateExactTeamMembership({
      documentId: 'team-1_coach-1',
      data: activeCoachMembership({ organizationId: 'organization-2' }),
      teamId: 'team-1',
      organizationId: 'organization-1',
      userId: 'coach-1',
      requiredRole: 'coach',
    }),
    false
  );
  assert.equal(
    validateExactTeamMembership({
      documentId: 'team-1_coach-1',
      data: activeCoachMembership({
        rosterVisibilityScope: 'assigned',
        allowedAthleteIds: ['athlete-1'],
      }),
      teamId: 'team-1',
      organizationId: 'organization-1',
      userId: 'coach-1',
      requiredRole: 'coach',
    }),
    false
  );
  assert.equal(
    validateExactTeamMembership({
      documentId: 'team-1_athlete-1',
      data: {
        userId: 'athlete-1',
        teamId: 'team-1',
        organizationId: 'organization-1',
        role: 'athlete',
        status: 'active',
      },
      teamId: 'team-1',
      organizationId: 'organization-1',
      userId: 'athlete-1',
      requiredRole: 'athlete',
    }),
    true
  );
});

test('organization memberships use exact deterministic identity and active state', () => {
  const membership = {
    organizationId: 'organization-1',
    userId: 'coach-1',
    role: 'implementation-observer',
    status: 'active',
  };
  assert.equal(
    validateExactOrganizationMembership({
      documentId: 'organization-1_coach-1',
      data: membership,
      organizationId: 'organization-1',
      userId: 'coach-1',
    }),
    true
  );
  assert.equal(
    validateExactOrganizationMembership({
      documentId: 'organization-1_coach-1',
      data: { ...membership, revokedAt: 123 },
      organizationId: 'organization-1',
      userId: 'coach-1',
    }),
    false
  );
});

test('target selection fails closed for ambiguous teams and honors an exact override', () => {
  const validTargets = [
    { teamId: 'team-1', organizationId: 'organization-1' },
    { teamId: 'team-2', organizationId: 'organization-2' },
  ];
  assert.equal(
    selectValidatedTarget({
      coachId: 'coach-1',
      validTargets,
      requestedTeamId: '',
    }).reason,
    'multiple_active_coaching_teams'
  );
  assert.deepEqual(
    selectValidatedTarget({
      coachId: 'coach-1',
      validTargets,
      requestedTeamId: 'team-2',
    }),
    { ok: true, target: validTargets[1], mode: 'existing' }
  );
  assert.equal(
    selectValidatedTarget({
      coachId: 'coach-1',
      validTargets,
      requestedTeamId: 'team-3',
    }).ok,
    false
  );
});

test('zero eligible teams resolves to stable ids and rejects occupied deterministic ids', () => {
  assert.deepEqual(buildDeterministicTarget('coach-1'), {
    organizationId: 'legacy-coach-org-coach-1',
    teamId: 'legacy-coach-team-coach-1',
  });
  const selected = selectValidatedTarget({
    coachId: 'coach-1',
    validTargets: [],
    requestedTeamId: '',
  });
  assert.equal(selected.ok, true);
  assert.equal(selected.mode, 'deterministic');

  assert.match(
    validateDeterministicContainer({
      coachId: 'coach-1',
      organizationId: 'legacy-coach-org-coach-1',
      teamId: 'legacy-coach-team-coach-1',
      organization: {
        status: 'active',
        legacySource: 'legacy-coach-roster',
        legacyCoachId: 'another-coach',
      },
      team: null,
    }),
    /occupied/
  );
});
