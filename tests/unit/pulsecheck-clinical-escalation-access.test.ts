import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildClinicalEscalationQueueQueryScopes,
  buildClinicalEscalationTeamScope,
  canAccessClinicalEscalationRecord,
  hasClinicalEscalationMembershipAccess,
  mergeClinicalEscalationTeamScopes,
} from '../../src/api/firebase/pulsecheckClinicalEscalationAccess';
import type {
  PulseCheckTeamMembership,
  PulseCheckTeamMembershipRole,
} from '../../src/api/firebase/pulsecheckProvisioning/types';

const membership = (
  userId: string,
  role: PulseCheckTeamMembershipRole,
  overrides: Partial<PulseCheckTeamMembership> = {},
): PulseCheckTeamMembership => ({
  id: `team-1_${userId}`,
  organizationId: 'org-1',
  teamId: 'team-1',
  userId,
  role,
  status: 'active',
  rosterVisibilityScope: role === 'athlete' ? 'none' : 'team',
  ...overrides,
});

test('clinical membership access mirrors active rule capabilities and roster scopes', () => {
  assert.equal(hasClinicalEscalationMembershipAccess(membership('legacy-clinician', 'clinician')), true);
  assert.equal(hasClinicalEscalationMembershipAccess(membership(
    'trainer',
    'performance-staff',
    { staffCapabilities: ['athletic_trainer'] },
  )), true);
  assert.equal(hasClinicalEscalationMembershipAccess(membership(
    'cross-role-trainer',
    'coach',
    { staffCapabilities: ['athletic_trainer'] },
  )), true);
  assert.equal(hasClinicalEscalationMembershipAccess(membership('team-admin', 'team-admin')), true);

  assert.equal(hasClinicalEscalationMembershipAccess(membership(
    'inactive-clinician',
    'clinician',
    { status: 'inactive' },
  )), false);
  assert.equal(hasClinicalEscalationMembershipAccess(membership(
    'revoked-clinician',
    'clinician',
    { revokedAt: {} as PulseCheckTeamMembership['revokedAt'] },
  )), false);
  assert.equal(hasClinicalEscalationMembershipAccess(membership(
    'manager',
    'support-staff',
    { staffCapabilities: ['administrative'], rosterVisibilityScope: 'none' },
  )), false);
  assert.equal(hasClinicalEscalationMembershipAccess(membership(
    'athlete',
    'athlete',
    { staffCapabilities: ['athletic_trainer'] },
  )), false);
  assert.equal(hasClinicalEscalationMembershipAccess(membership(
    'no-roster',
    'clinician',
    { rosterVisibilityScope: 'none' },
  )), false);
});

test('team scope includes only active athlete memberships on the authorized team', () => {
  const scope = buildClinicalEscalationTeamScope(
    membership('clinician', 'clinician'),
    [
      membership('athlete-b', 'athlete'),
      membership('athlete-a', 'athlete'),
      membership('inactive-athlete', 'athlete', { status: 'inactive' }),
      membership('other-team-athlete', 'athlete', { teamId: 'team-2' }),
      membership('coach', 'coach'),
    ],
  );

  assert.deepEqual(scope, {
    teamId: 'team-1',
    athleteUserIds: ['athlete-a', 'athlete-b'],
  });
});

test('assigned scope intersects the grant with the active team roster', () => {
  const scope = buildClinicalEscalationTeamScope(
    membership('clinician', 'clinician', {
      rosterVisibilityScope: 'assigned',
      allowedAthleteIds: ['athlete-b', 'inactive-athlete', 'not-on-team'],
    }),
    [
      membership('athlete-a', 'athlete'),
      membership('athlete-b', 'athlete'),
      membership('inactive-athlete', 'athlete', { status: 'inactive' }),
    ],
  );

  assert.deepEqual(scope, {
    teamId: 'team-1',
    athleteUserIds: ['athlete-b'],
  });
});

test('queue query plan is global for admins and exact team-athlete pairs for clinical staff', () => {
  const scopes = mergeClinicalEscalationTeamScopes([
    { teamId: 'team-2', athleteUserIds: ['athlete-c'] },
    { teamId: 'team-1', athleteUserIds: ['athlete-b'] },
    { teamId: 'team-1', athleteUserIds: ['athlete-a', 'athlete-b'] },
  ]);

  assert.deepEqual(buildClinicalEscalationQueueQueryScopes(true, scopes), [
    { kind: 'admin' },
  ]);
  assert.deepEqual(buildClinicalEscalationQueueQueryScopes(false, scopes), [
    { kind: 'clinical-team', teamId: 'team-1', athleteUserId: 'athlete-a' },
    { kind: 'clinical-team', teamId: 'team-1', athleteUserId: 'athlete-b' },
    { kind: 'clinical-team', teamId: 'team-2', athleteUserId: 'athlete-c' },
  ]);
});

test('deep-link access requires both the authorized team and athlete', () => {
  const scopes = [{ teamId: 'team-1', athleteUserIds: ['athlete-a'] }];

  assert.equal(canAccessClinicalEscalationRecord(scopes, {
    teamId: 'team-1',
    athleteUserId: 'athlete-a',
  }), true);
  assert.equal(canAccessClinicalEscalationRecord(scopes, {
    teamId: 'team-1',
    athleteUserId: 'athlete-b',
  }), false);
  assert.equal(canAccessClinicalEscalationRecord(scopes, {
    teamId: 'team-2',
    athleteUserId: 'athlete-a',
  }), false);
});
