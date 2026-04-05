#!/usr/bin/env node

const path = require('path');
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const serviceAccount = require(path.join(__dirname, '..', 'serviceAccountKey.json'));

if (!getApps().length) {
  initializeApp({ credential: cert(serviceAccount) });
}

const db = getFirestore(getApps()[0]);

const ORGANIZATION_ID = 'revival-strength-functional-bodybuilding';
const TEAM_ID = 'revival-strength-functional-bodybuilding--persist';
const RESERVED_USER_ID = 'pending-admin:marcus-filly';
const EXPECTED = {
  organization: {
    displayName: 'Revival Strength / Functional Bodybuilding',
    status: 'provisioning',
    implementationPath: 'pulsecheck-hierarchy',
    legacySignupPathUsed: false,
    canaryTarget: true,
    firstPlannedTeamName: 'Persist',
    defaultClinicianBridgeMode: 'optional',
  },
  team: {
    displayName: 'Persist',
    teamType: 'brand-athlete-group',
    defaultInvitePolicy: 'admin-staff-and-coaches',
    routingDefaultsMode: 'organization-default-optional',
    organizationId: ORGANIZATION_ID,
    status: 'provisioning',
  },
  organizationMembership: {
    organizationId: ORGANIZATION_ID,
    userId: RESERVED_USER_ID,
    role: 'org-admin',
    state: 'reserved-pending-activation',
  },
  teamMembership: {
    organizationId: ORGANIZATION_ID,
    teamId: TEAM_ID,
    userId: RESERVED_USER_ID,
    role: 'team-admin',
    permissionSetId: 'pulsecheck-team-admin-v1',
    onboardingStatus: 'pending-profile',
    state: 'reserved-pending-activation',
  },
};

function check(name, condition, details, failures) {
  if (!condition) {
    failures.push({ name, details });
  }
}

async function main() {
  const organizationRef = db.collection('pulsecheck-organizations').doc(ORGANIZATION_ID);
  const teamRef = db.collection('pulsecheck-teams').doc(TEAM_ID);
  const organizationMembershipRef = db
    .collection('pulsecheck-organization-memberships')
    .doc(`${ORGANIZATION_ID}_${RESERVED_USER_ID}`);
  const teamMembershipRef = db
    .collection('pulsecheck-team-memberships')
    .doc(`${TEAM_ID}_${RESERVED_USER_ID}`);

  const [organizationSnap, teamSnap, organizationMembershipSnap, teamMembershipSnap] = await Promise.all([
    organizationRef.get(),
    teamRef.get(),
    organizationMembershipRef.get(),
    teamMembershipRef.get(),
  ]);

  const failures = [];

  check('organization exists', organizationSnap.exists, { id: ORGANIZATION_ID }, failures);
  check('team exists', teamSnap.exists, { id: TEAM_ID }, failures);
  check('organization membership exists', organizationMembershipSnap.exists, { id: organizationMembershipRef.id }, failures);
  check('team membership exists', teamMembershipSnap.exists, { id: teamMembershipRef.id }, failures);

  const organization = organizationSnap.data() || {};
  const team = teamSnap.data() || {};
  const organizationMembership = organizationMembershipSnap.data() || {};
  const teamMembership = teamMembershipSnap.data() || {};

  check('organization displayName', organization.displayName === EXPECTED.organization.displayName, { actual: organization.displayName }, failures);
  check('organization status', organization.status === EXPECTED.organization.status, { actual: organization.status }, failures);
  check(
    'organization implementation path',
    organization.implementationMetadata?.provisioningPath === EXPECTED.organization.implementationPath,
    { actual: organization.implementationMetadata?.provisioningPath },
    failures
  );
  check(
    'organization legacySignupPathUsed',
    organization.implementationMetadata?.legacySignupPathUsed === EXPECTED.organization.legacySignupPathUsed,
    { actual: organization.implementationMetadata?.legacySignupPathUsed },
    failures
  );
  check(
    'organization canaryTarget',
    organization.implementationMetadata?.canaryTarget === EXPECTED.organization.canaryTarget,
    { actual: organization.implementationMetadata?.canaryTarget },
    failures
  );
  check(
    'organization firstPlannedTeamName',
    organization.implementationMetadata?.firstPlannedTeamName === EXPECTED.organization.firstPlannedTeamName,
    { actual: organization.implementationMetadata?.firstPlannedTeamName },
    failures
  );
  check(
    'organization defaultClinicianBridgeMode',
    organization.defaultClinicianBridgeMode === EXPECTED.organization.defaultClinicianBridgeMode,
    { actual: organization.defaultClinicianBridgeMode },
    failures
  );

  check('team displayName', team.displayName === EXPECTED.team.displayName, { actual: team.displayName }, failures);
  check('team teamType', team.teamType === EXPECTED.team.teamType, { actual: team.teamType }, failures);
  check(
    'team defaultInvitePolicy',
    team.defaultInvitePolicy === EXPECTED.team.defaultInvitePolicy,
    { actual: team.defaultInvitePolicy },
    failures
  );
  check('team organizationId', team.organizationId === EXPECTED.team.organizationId, { actual: team.organizationId }, failures);
  check('team status', team.status === EXPECTED.team.status, { actual: team.status }, failures);
  check(
    'team routingDefaultsMode',
    team.implementationMetadata?.routingDefaultsMode === EXPECTED.team.routingDefaultsMode,
    { actual: team.implementationMetadata?.routingDefaultsMode },
    failures
  );
  check(
    'team implementation path',
    team.implementationMetadata?.provisioningPath === EXPECTED.organization.implementationPath,
    { actual: team.implementationMetadata?.provisioningPath },
    failures
  );

  check(
    'organization membership organizationId',
    organizationMembership.organizationId === EXPECTED.organizationMembership.organizationId,
    { actual: organizationMembership.organizationId },
    failures
  );
  check(
    'organization membership userId',
    organizationMembership.userId === EXPECTED.organizationMembership.userId,
    { actual: organizationMembership.userId },
    failures
  );
  check(
    'organization membership role',
    organizationMembership.role === EXPECTED.organizationMembership.role,
    { actual: organizationMembership.role },
    failures
  );
  check(
    'organization membership handoff state',
    organizationMembership.handoffMetadata?.state === EXPECTED.organizationMembership.state,
    { actual: organizationMembership.handoffMetadata?.state },
    failures
  );

  check(
    'team membership organizationId',
    teamMembership.organizationId === EXPECTED.teamMembership.organizationId,
    { actual: teamMembership.organizationId },
    failures
  );
  check('team membership teamId', teamMembership.teamId === EXPECTED.teamMembership.teamId, { actual: teamMembership.teamId }, failures);
  check('team membership userId', teamMembership.userId === EXPECTED.teamMembership.userId, { actual: teamMembership.userId }, failures);
  check('team membership role', teamMembership.role === EXPECTED.teamMembership.role, { actual: teamMembership.role }, failures);
  check(
    'team membership permissionSetId',
    teamMembership.permissionSetId === EXPECTED.teamMembership.permissionSetId,
    { actual: teamMembership.permissionSetId },
    failures
  );
  check(
    'team membership onboardingStatus',
    teamMembership.onboardingStatus === EXPECTED.teamMembership.onboardingStatus,
    { actual: teamMembership.onboardingStatus },
    failures
  );
  check(
    'team membership handoff state',
    teamMembership.handoffMetadata?.state === EXPECTED.teamMembership.state,
    { actual: teamMembership.handoffMetadata?.state },
    failures
  );

  const summary = {
    ok: failures.length === 0,
    checkedAt: new Date().toISOString(),
    organizationId: ORGANIZATION_ID,
    teamId: TEAM_ID,
    reservedUserId: RESERVED_USER_ID,
    failures,
    snapshots: {
      organization,
      team,
      organizationMembership,
      teamMembership,
    },
  };

  console.log(JSON.stringify(summary, null, 2));

  if (failures.length > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
