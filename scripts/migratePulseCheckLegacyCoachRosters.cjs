#!/usr/bin/env node
'use strict';

/**
 * Trusted migration for legacy `coachAthletes` links.
 *
 * This command is a dry run unless every apply gate is present:
 *
 *   node scripts/migratePulseCheckLegacyCoachRosters.cjs --project=dev
 *   node scripts/migratePulseCheckLegacyCoachRosters.cjs \
 *     --project=quicklifts-dev-01 \
 *     --confirm-project=quicklifts-dev-01 \
 *     --coach-id=<firebaseUid> \
 *     --apply
 *
 * A coach with one exact active coaching membership reuses that team. A coach
 * with no active team receives deterministic legacy-coach org/team ids. A
 * coach with multiple eligible teams is skipped unless `--coach-id` and
 * `--team-id` identify one exact target.
 */

const { getApps, initializeApp } = require('firebase-admin/app');
const { FieldValue, getFirestore } = require('firebase-admin/firestore');
const {
  DEFAULT_PROJECT_ID,
  resolveAdminCredential,
} = require('./lib/resolveAdminCredential');

const DEV_PROJECT_ID = 'quicklifts-dev-01';
const SAFE_ID = /^[A-Za-z0-9_-]{1,256}$/;
const MIGRATION_VERSION = 3;
const MAX_TRANSACTION_WRITES = 450;
const COACHING_ROLES = new Set([
  'team-admin',
  'coach',
  'performance-staff',
  'support-staff',
  'clinician',
]);

const normalizeString = (value) =>
  typeof value === 'string' ? value.trim() : '';

const normalizeEmail = (value) => normalizeString(value).toLowerCase();

const normalizeStatus = (value) => normalizeString(value).toLowerCase();

const isSafeId = (value) => SAFE_ID.test(normalizeString(value));

const isExactActiveRecord = (data) =>
  Boolean(data)
  && normalizeStatus(data.status) === 'active'
  && !data.revokedAt
  && !data.archivedAt
  && !data.deletedAt;

const isExactActiveContainer = (data) => isExactActiveRecord(data);

const hasCoachingCapability = (membership) => {
  const role = normalizeStatus(membership?.role);
  const capabilities = Array.isArray(membership?.staffCapabilities)
    ? membership.staffCapabilities.map(normalizeStatus).filter(Boolean)
    : [];
  return role === 'team-admin'
    || capabilities.includes('admin')
    || capabilities.includes('coaching')
    || (role === 'coach' && capabilities.length === 0);
};

const canCoachWholeTeam = (membership) => {
  const visibility = normalizeStatus(membership?.rosterVisibilityScope);
  return !visibility || visibility === 'team';
};

const validateExactTeamMembership = ({
  documentId,
  data,
  teamId,
  organizationId,
  userId,
  requiredRole,
}) => {
  if (
    documentId !== `${teamId}_${userId}`
    || !isExactActiveRecord(data)
    || normalizeString(data.userId) !== userId
    || normalizeString(data.teamId) !== teamId
    || normalizeString(data.organizationId) !== organizationId
  ) {
    return false;
  }

  const role = normalizeStatus(data.role);
  if (requiredRole === 'athlete') {
    return role === 'athlete';
  }
  return COACHING_ROLES.has(role)
    && hasCoachingCapability(data)
    && canCoachWholeTeam(data);
};

const validateExactOrganizationMembership = ({
  documentId,
  data,
  organizationId,
  userId,
}) =>
  documentId === `${organizationId}_${userId}`
  && isExactActiveRecord(data)
  && normalizeString(data.userId) === userId
  && normalizeString(data.organizationId) === organizationId
  && normalizeStatus(data.role) !== 'athlete';

const classifyLegacyRosterLink = (documentId, data) => {
  const coachId = normalizeString(data?.coachId);
  const athleteId = normalizeString(data?.athleteUserId || data?.athleteId);
  if (!isSafeId(documentId) || !isSafeId(coachId) || !isSafeId(athleteId)) {
    return { active: false, reason: 'invalid_identity' };
  }
  if (data.disconnectedAt || normalizeStatus(data.status) === 'disconnected') {
    return { active: false, reason: 'disconnected' };
  }
  if (normalizeStatus(data.pulseCheckMigrationStatus) === 'migrated') {
    return { active: false, reason: 'already_migrated' };
  }
  const status = normalizeStatus(data.status);
  if (status && status !== 'active') {
    return { active: false, reason: 'unknown_status' };
  }
  return { active: true, coachId, athleteId };
};

const buildDeterministicTarget = (coachId) => ({
  organizationId: `legacy-coach-org-${coachId}`,
  teamId: `legacy-coach-team-${coachId}`,
});

const selectValidatedTarget = ({
  coachId,
  validTargets,
  requestedTeamId,
}) => {
  if (requestedTeamId) {
    const target = validTargets.find((entry) => entry.teamId === requestedTeamId);
    return target
      ? { ok: true, target, mode: 'existing' }
      : { ok: false, reason: 'requested_team_is_not_an_exact_active_coaching_membership' };
  }
  if (validTargets.length === 1) {
    return { ok: true, target: validTargets[0], mode: 'existing' };
  }
  if (validTargets.length > 1) {
    return { ok: false, reason: 'multiple_active_coaching_teams' };
  }
  return {
    ok: true,
    target: buildDeterministicTarget(coachId),
    mode: 'deterministic',
  };
};

const parseArgs = (argv) => {
  const valueFor = (name) =>
    argv.find((value) => value.startsWith(`${name}=`))?.slice(name.length + 1);
  const rawProject = normalizeString(valueFor('--project'));
  const projectAlias = rawProject.toLowerCase();
  const projectId =
    projectAlias === 'dev'
      ? DEV_PROJECT_ID
      : projectAlias === 'prod'
        ? DEFAULT_PROJECT_ID
        : rawProject || DEFAULT_PROJECT_ID;
  return {
    apply: argv.includes('--apply'),
    projectExplicit: Boolean(rawProject),
    projectId,
    confirmProjectId: normalizeString(valueFor('--confirm-project')),
    coachId: normalizeString(valueFor('--coach-id')),
    teamId: normalizeString(valueFor('--team-id')),
  };
};

const validateApplyGates = (args) => {
  if (!args.apply) return null;
  if (!args.projectExplicit) {
    return 'Apply requires an explicit --project=<projectId> gate.';
  }
  if (args.confirmProjectId !== args.projectId) {
    return `Apply requires --confirm-project=${args.projectId}.`;
  }
  if (args.teamId && !args.coachId) {
    return '--team-id requires one exact --coach-id.';
  }
  return null;
};

const getDisplayName = (coachId, coach, user) =>
  normalizeString(user.displayName)
  || normalizeString(user.username)
  || normalizeString(coach.username)
  || normalizeEmail(user.email || coach.email)
  || coachId;

async function loadValidExistingTargets(database, coachId) {
  const snapshot = await database
    .collection('pulsecheck-team-memberships')
    .where('userId', '==', coachId)
    .get();
  const validTargets = [];
  const integrityErrors = [];

  for (const membershipDocument of snapshot.docs) {
    const membership = membershipDocument.data() || {};
    const teamId = normalizeString(membership.teamId);
    const organizationId = normalizeString(membership.organizationId);
    const mayBeActiveCoachingMembership =
      normalizeStatus(membership.status) === 'active'
      && normalizeStatus(membership.role) !== 'athlete';

    if (!mayBeActiveCoachingMembership) continue;
    if (!isSafeId(teamId) || !isSafeId(organizationId)) {
      integrityErrors.push(`${membershipDocument.id}: unsafe team or organization id`);
      continue;
    }

    const [teamSnapshot, organizationSnapshot] = await Promise.all([
      database.collection('pulsecheck-teams').doc(teamId).get(),
      database.collection('pulsecheck-organizations').doc(organizationId).get(),
    ]);
    const team = teamSnapshot.exists ? teamSnapshot.data() || {} : null;
    const organization = organizationSnapshot.exists
      ? organizationSnapshot.data() || {}
      : null;
    const validMembership = validateExactTeamMembership({
      documentId: membershipDocument.id,
      data: membership,
      teamId,
      organizationId,
      userId: coachId,
      requiredRole: 'coach',
    });
    if (
      !validMembership
      || !isExactActiveContainer(team)
      || normalizeString(team.organizationId) !== organizationId
      || !isExactActiveContainer(organization)
    ) {
      integrityErrors.push(`${membershipDocument.id}: active coaching scope failed exact validation`);
      continue;
    }
    validTargets.push({
      organizationId,
      teamId,
      membershipId: membershipDocument.id,
      membership,
      team,
      organization,
    });
  }

  return { validTargets, integrityErrors };
}

const validateDeterministicContainer = ({
  coachId,
  organizationId,
  teamId,
  organization,
  team,
}) => {
  if (organization) {
    if (
      !isExactActiveContainer(organization)
      || normalizeString(organization.legacySource) !== 'legacy-coach-roster'
      || normalizeString(organization.legacyCoachId) !== coachId
    ) {
      return 'deterministic organization id is occupied by another or inactive record';
    }
  }
  if (team) {
    if (
      !isExactActiveContainer(team)
      || normalizeString(team.organizationId) !== organizationId
      || normalizeString(team.legacySource) !== 'legacy-coach-roster'
      || normalizeString(team.legacyCoachId) !== coachId
    ) {
      return 'deterministic team id is occupied by another, inactive, or cross-org record';
    }
  }
  if (!isSafeId(organizationId) || !isSafeId(teamId)) {
    return 'deterministic target ids exceed the accepted id contract';
  }
  return null;
};

async function buildCoachPlan(database, coachId, linkDocuments, requestedTeamId) {
  const [coachSnapshot, coachUserSnapshot, existingTargetResult] = await Promise.all([
    database.collection('coaches').doc(coachId).get(),
    database.collection('users').doc(coachId).get(),
    loadValidExistingTargets(database, coachId),
  ]);
  if (!coachSnapshot.exists || !coachUserSnapshot.exists) {
    return { ok: false, reason: 'coach profile or user document is missing' };
  }

  const coach = coachSnapshot.data() || {};
  const coachUser = coachUserSnapshot.data() || {};
  if (
    (normalizeString(coach.userId) && normalizeString(coach.userId) !== coachId)
    || (normalizeStatus(coach.status) && normalizeStatus(coach.status) !== 'active')
    || coach.deletedAt
    || coach.revokedAt
  ) {
    return { ok: false, reason: 'coach profile identity or active state is invalid' };
  }
  if (existingTargetResult.integrityErrors.length > 0) {
    return {
      ok: false,
      reason: `malformed active membership: ${existingTargetResult.integrityErrors.join('; ')}`,
    };
  }

  const selection = selectValidatedTarget({
    coachId,
    validTargets: existingTargetResult.validTargets,
    requestedTeamId,
  });
  if (!selection.ok) return selection;

  const organizationId = selection.target.organizationId;
  const teamId = selection.target.teamId;
  let organization = selection.target.organization || null;
  let team = selection.target.team || null;

  if (selection.mode === 'deterministic') {
    const [organizationSnapshot, teamSnapshot] = await Promise.all([
      database.collection('pulsecheck-organizations').doc(organizationId).get(),
      database.collection('pulsecheck-teams').doc(teamId).get(),
    ]);
    organization = organizationSnapshot.exists ? organizationSnapshot.data() || {} : null;
    team = teamSnapshot.exists ? teamSnapshot.data() || {} : null;
    const collision = validateDeterministicContainer({
      coachId,
      organizationId,
      teamId,
      organization,
      team,
    });
    if (collision) return { ok: false, reason: collision };
  }

  const coachOrganizationMembershipId = `${organizationId}_${coachId}`;
  const coachTeamMembershipId = `${teamId}_${coachId}`;
  const [coachOrganizationMembershipSnapshot, coachTeamMembershipSnapshot] =
    await Promise.all([
      database
        .collection('pulsecheck-organization-memberships')
        .doc(coachOrganizationMembershipId)
        .get(),
      database
        .collection('pulsecheck-team-memberships')
        .doc(coachTeamMembershipId)
        .get(),
    ]);
  if (
    coachOrganizationMembershipSnapshot.exists
    && !validateExactOrganizationMembership({
      documentId: coachOrganizationMembershipId,
      data: coachOrganizationMembershipSnapshot.data() || {},
      organizationId,
      userId: coachId,
    })
  ) {
    return { ok: false, reason: 'coach organization membership conflicts with the target' };
  }
  if (
    coachTeamMembershipSnapshot.exists
    && !validateExactTeamMembership({
      documentId: coachTeamMembershipId,
      data: coachTeamMembershipSnapshot.data() || {},
      organizationId,
      teamId,
      userId: coachId,
      requiredRole: 'coach',
    })
  ) {
    return { ok: false, reason: 'coach team membership conflicts with the target' };
  }
  if (selection.mode === 'existing' && !coachTeamMembershipSnapshot.exists) {
    return { ok: false, reason: 'selected existing team membership disappeared' };
  }

  const linksByAthlete = new Map();
  for (const document of linkDocuments) {
    const classification = classifyLegacyRosterLink(document.id, document.data() || {});
    if (!classification.active || classification.coachId !== coachId) {
      return { ok: false, reason: `legacy link ${document.id} changed during planning` };
    }
    const current = linksByAthlete.get(classification.athleteId) || [];
    current.push(document);
    linksByAthlete.set(classification.athleteId, current);
  }

  const athletes = [];
  for (const [athleteId, athleteLinks] of linksByAthlete.entries()) {
    const membershipId = `${teamId}_${athleteId}`;
    const [athleteUserSnapshot, membershipSnapshot] = await Promise.all([
      database.collection('users').doc(athleteId).get(),
      database.collection('pulsecheck-team-memberships').doc(membershipId).get(),
    ]);
    if (!athleteUserSnapshot.exists) {
      return { ok: false, reason: `athlete user ${athleteId} is missing` };
    }
    if (
      membershipSnapshot.exists
      && !validateExactTeamMembership({
        documentId: membershipId,
        data: membershipSnapshot.data() || {},
        organizationId,
        teamId,
        userId: athleteId,
        requiredRole: 'athlete',
      })
    ) {
      return {
        ok: false,
        reason: `athlete membership ${membershipId} conflicts with the exact target scope`,
      };
    }
    athletes.push({
      athleteId,
      athleteUser: athleteUserSnapshot.data() || {},
      membershipId,
      membershipExists: membershipSnapshot.exists,
      links: athleteLinks,
    });
  }

  const plannedWrites =
    (organization ? 0 : 1)
    + (team ? 0 : 1)
    + (coachOrganizationMembershipSnapshot.exists ? 0 : 1)
    + (coachTeamMembershipSnapshot.exists ? 0 : 1)
    + athletes.filter((athlete) => !athlete.membershipExists).length
    + linkDocuments.length
    + 1;
  if (plannedWrites > MAX_TRANSACTION_WRITES) {
    return {
      ok: false,
      reason: `plan needs ${plannedWrites} writes, above the ${MAX_TRANSACTION_WRITES} transaction gate`,
    };
  }

  return {
    ok: true,
    coachId,
    coach,
    coachUser,
    coachDisplayName: getDisplayName(coachId, coach, coachUser),
    organizationId,
    teamId,
    organization,
    team,
    targetMode: selection.mode,
    coachOrganizationMembershipExists: coachOrganizationMembershipSnapshot.exists,
    coachTeamMembershipExists: coachTeamMembershipSnapshot.exists,
    athletes,
    linkDocuments,
    plannedWrites,
  };
}

async function applyCoachPlan(database, plan) {
  const now = FieldValue.serverTimestamp();
  await database.runTransaction(async (transaction) => {
    const organizationReference = database
      .collection('pulsecheck-organizations')
      .doc(plan.organizationId);
    const teamReference = database
      .collection('pulsecheck-teams')
      .doc(plan.teamId);
    const coachOrganizationMembershipReference = database
      .collection('pulsecheck-organization-memberships')
      .doc(`${plan.organizationId}_${plan.coachId}`);
    const coachTeamMembershipReference = database
      .collection('pulsecheck-team-memberships')
      .doc(`${plan.teamId}_${plan.coachId}`);
    const migrationReference = database
      .collection('pulsecheck-legacy-roster-migrations')
      .doc(plan.coachId);
    const readReferences = [
      organizationReference,
      teamReference,
      coachOrganizationMembershipReference,
      coachTeamMembershipReference,
      migrationReference,
      ...plan.athletes.map((athlete) =>
        database.collection('users').doc(athlete.athleteId)),
      ...plan.athletes.map((athlete) =>
        database.collection('pulsecheck-team-memberships').doc(athlete.membershipId)),
      ...plan.linkDocuments.map((document) => document.ref),
    ];
    const snapshots = await Promise.all(
      readReferences.map((reference) => transaction.get(reference))
    );
    const snapshotByPath = new Map(
      snapshots.map((snapshot) => [snapshot.ref.path, snapshot])
    );
    const organizationSnapshot = snapshotByPath.get(organizationReference.path);
    const teamSnapshot = snapshotByPath.get(teamReference.path);
    const coachOrganizationMembershipSnapshot = snapshotByPath.get(
      coachOrganizationMembershipReference.path
    );
    const coachTeamMembershipSnapshot = snapshotByPath.get(
      coachTeamMembershipReference.path
    );

    const containerConflict = validateDeterministicContainer({
      coachId: plan.coachId,
      organizationId: plan.organizationId,
      teamId: plan.teamId,
      organization:
        plan.targetMode === 'deterministic' && organizationSnapshot.exists
          ? organizationSnapshot.data() || {}
          : null,
      team:
        plan.targetMode === 'deterministic' && teamSnapshot.exists
          ? teamSnapshot.data() || {}
          : null,
    });
    if (plan.targetMode === 'deterministic' && containerConflict) {
      throw new Error(containerConflict);
    }
    if (plan.targetMode === 'existing') {
      const organization = organizationSnapshot.exists
        ? organizationSnapshot.data() || {}
        : null;
      const team = teamSnapshot.exists ? teamSnapshot.data() || {} : null;
      if (
        !isExactActiveContainer(organization)
        || !isExactActiveContainer(team)
        || normalizeString(team.organizationId) !== plan.organizationId
      ) {
        throw new Error('existing target team or organization changed before apply');
      }
    }
    if (
      coachOrganizationMembershipSnapshot.exists
      && !validateExactOrganizationMembership({
        documentId: coachOrganizationMembershipReference.id,
        data: coachOrganizationMembershipSnapshot.data() || {},
        organizationId: plan.organizationId,
        userId: plan.coachId,
      })
    ) {
      throw new Error('coach organization membership changed before apply');
    }
    if (
      coachTeamMembershipSnapshot.exists
      && !validateExactTeamMembership({
        documentId: coachTeamMembershipReference.id,
        data: coachTeamMembershipSnapshot.data() || {},
        organizationId: plan.organizationId,
        teamId: plan.teamId,
        userId: plan.coachId,
        requiredRole: 'coach',
      })
    ) {
      throw new Error('coach team membership changed before apply');
    }
    if (plan.targetMode === 'existing' && !coachTeamMembershipSnapshot.exists) {
      throw new Error('selected existing team membership disappeared before apply');
    }

    for (const athlete of plan.athletes) {
      const athleteUserReference = database.collection('users').doc(athlete.athleteId);
      const athleteUserSnapshot = snapshotByPath.get(athleteUserReference.path);
      const membershipReference = database
        .collection('pulsecheck-team-memberships')
        .doc(athlete.membershipId);
      const membershipSnapshot = snapshotByPath.get(membershipReference.path);
      if (!athleteUserSnapshot.exists) {
        throw new Error(`athlete user ${athlete.athleteId} disappeared before apply`);
      }
      if (
        membershipSnapshot.exists
        && !validateExactTeamMembership({
          documentId: membershipReference.id,
          data: membershipSnapshot.data() || {},
          organizationId: plan.organizationId,
          teamId: plan.teamId,
          userId: athlete.athleteId,
          requiredRole: 'athlete',
        })
      ) {
        throw new Error(`athlete membership ${membershipReference.id} changed before apply`);
      }
      for (const link of athlete.links) {
        const linkSnapshot = snapshotByPath.get(link.ref.path);
        const classification = classifyLegacyRosterLink(
          linkSnapshot.id,
          linkSnapshot.data() || {}
        );
        if (
          !linkSnapshot.exists
          || !classification.active
          || classification.coachId !== plan.coachId
          || classification.athleteId !== athlete.athleteId
        ) {
          throw new Error(`legacy link ${link.id} changed before apply`);
        }
      }
    }

    const coachEmail = normalizeEmail(plan.coachUser.email || plan.coach.email);
    if (!organizationSnapshot.exists) {
      transaction.create(organizationReference, {
        displayName: `${plan.coachDisplayName} Coaching`,
        legalName: `${plan.coachDisplayName} Coaching`,
        organizationType: 'other',
        status: 'active',
        legacySource: 'legacy-coach-roster',
        legacyCoachId: plan.coachId,
        primaryCustomerAdminName: plan.coachDisplayName,
        primaryCustomerAdminEmail: coachEmail,
        defaultStudyPosture: 'operational',
        defaultClinicianBridgeMode: 'none',
        createdAt: now,
        updatedAt: now,
      });
    }
    if (!teamSnapshot.exists) {
      transaction.create(teamReference, {
        organizationId: plan.organizationId,
        displayName: `${plan.coachDisplayName} Legacy Roster`,
        teamType: 'other',
        sportOrProgram: 'Legacy coach roster',
        status: 'active',
        legacySource: 'legacy-coach-roster',
        legacyCoachId: plan.coachId,
        defaultAdminName: plan.coachDisplayName,
        defaultAdminEmail: coachEmail,
        defaultAdminUserIds: [plan.coachId],
        defaultInvitePolicy: 'admin-staff-and-coaches',
        createdAt: now,
        updatedAt: now,
      });
    }
    if (!coachOrganizationMembershipSnapshot.exists) {
      transaction.create(coachOrganizationMembershipReference, {
        organizationId: plan.organizationId,
        userId: plan.coachId,
        email: coachEmail,
        role: plan.targetMode === 'deterministic'
          ? 'org-admin'
          : 'implementation-observer',
        status: 'active',
        grantedAt: now,
        createdAt: now,
        updatedAt: now,
      });
    }
    if (!coachTeamMembershipSnapshot.exists) {
      transaction.create(coachTeamMembershipReference, {
        organizationId: plan.organizationId,
        teamId: plan.teamId,
        userId: plan.coachId,
        email: coachEmail,
        role: 'team-admin',
        title: 'Legacy Roster Coach',
        permissionSetId: 'pulsecheck-team-admin-v1',
        rosterVisibilityScope: 'team',
        allowedAthleteIds: [],
        onboardingStatus: 'pending-profile',
        status: 'active',
        createdAt: now,
        updatedAt: now,
      });
    }

    for (const athlete of plan.athletes) {
      const membershipReference = database
        .collection('pulsecheck-team-memberships')
        .doc(athlete.membershipId);
      const membershipSnapshot = snapshotByPath.get(membershipReference.path);
      if (!membershipSnapshot.exists) {
        transaction.create(membershipReference, {
          organizationId: plan.organizationId,
          teamId: plan.teamId,
          userId: athlete.athleteId,
          email: normalizeEmail(athlete.athleteUser.email),
          role: 'athlete',
          permissionSetId: 'pulsecheck-athlete-v1',
          rosterVisibilityScope: 'none',
          allowedAthleteIds: [],
          legacySource: 'coach-athletes',
          legacyCoachId: plan.coachId,
          legacyConnectionIds: athlete.links.map((link) => link.id).sort(),
          onboardingStatus: 'pending-consent',
          athleteOnboarding: {
            onboardingStatus: 'pending-consent',
            productConsentAccepted: false,
            researchConsentStatus: 'not-required',
            requiredConsents: [],
            completedConsentIds: [],
            completedConsentVersions: {},
            baselineCompleted: false,
            eligibleForResearchDataset: false,
          },
          status: 'active',
          createdAt: now,
          updatedAt: now,
        });
      }
      for (const link of athlete.links) {
        transaction.set(link.ref, {
          pulseCheckMigrationId: plan.coachId,
          pulseCheckMigrationVersion: MIGRATION_VERSION,
          pulseCheckMigrationStatus: 'migrated',
          pulseCheckMigratedOrganizationId: plan.organizationId,
          pulseCheckMigratedTeamId: plan.teamId,
          pulseCheckMigratedAt: now,
          updatedAt: now,
        }, { merge: true });
      }
    }

    transaction.set(migrationReference, {
      migrationId: plan.coachId,
      migrationVersion: MIGRATION_VERSION,
      status: 'completed',
      source: 'coach-athletes',
      executionMode: 'trusted-firebase-admin',
      coachId: plan.coachId,
      coachDisplayName: plan.coachDisplayName,
      organizationId: plan.organizationId,
      organizationName:
        normalizeString(plan.organization?.displayName)
        || `${plan.coachDisplayName} Coaching`,
      teamId: plan.teamId,
      teamName:
        normalizeString(plan.team?.displayName)
        || `${plan.coachDisplayName} Legacy Roster`,
      createdOrganization: !organizationSnapshot.exists,
      createdTeam: !teamSnapshot.exists,
      migratedAthleteCount: plan.athletes.filter(
        (athlete) => !athlete.membershipExists
      ).length,
      alreadyPresentAthleteCount: plan.athletes.filter(
        (athlete) => athlete.membershipExists
      ).length,
      retiredLegacyConnectionCount: plan.linkDocuments.length,
      unresolvedLegacyConnectionCount: 0,
      athleteUserIds: plan.athletes.map((athlete) => athlete.athleteId).sort(),
      legacyConnectionIds: plan.linkDocuments.map((link) => link.id).sort(),
      completedAt: now,
      updatedAt: now,
    }, { merge: true });
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!isSafeId(args.projectId)) {
    throw new Error('Project id must use the safe document-id character contract.');
  }
  if (args.coachId && !isSafeId(args.coachId)) {
    throw new Error('Coach id must be a safe Firebase uid.');
  }
  if (args.teamId && !isSafeId(args.teamId)) {
    throw new Error('Team id must be a safe Firestore document id.');
  }
  const gateError = validateApplyGates(args);
  if (gateError) throw new Error(gateError);

  const appName = `migrate-pulsecheck-legacy-rosters-${args.projectId}`;
  const app = getApps().find((candidate) => candidate.name === appName)
    || initializeApp({
      credential: resolveAdminCredential(),
      projectId: args.projectId,
    }, appName);
  const database = getFirestore(app);
  const snapshot = await database.collection('coachAthletes').get();
  const linksByCoach = new Map();
  const ignoredReasons = new Map();

  for (const document of snapshot.docs) {
    const classification = classifyLegacyRosterLink(
      document.id,
      document.data() || {}
    );
    if (!classification.active) {
      ignoredReasons.set(
        classification.reason,
        (ignoredReasons.get(classification.reason) || 0) + 1
      );
      continue;
    }
    if (args.coachId && classification.coachId !== args.coachId) continue;
    const current = linksByCoach.get(classification.coachId) || [];
    current.push(document);
    linksByCoach.set(classification.coachId, current);
  }

  console.log('PulseCheck trusted legacy roster migration');
  console.log(`Project: ${args.projectId}`);
  console.log(`Mode: ${args.apply ? 'apply' : 'dry-run'}`);
  console.log(`Coach filter: ${args.coachId || 'all'}`);
  console.log(`Team override: ${args.teamId || 'automatic exact target'}`);
  console.log(`Candidate coaches: ${linksByCoach.size}`);
  if (ignoredReasons.size > 0) {
    console.log(`Ignored links: ${JSON.stringify(Object.fromEntries(ignoredReasons))}`);
  }

  let planned = 0;
  let applied = 0;
  let skipped = 0;
  for (const coachId of [...linksByCoach.keys()].sort()) {
    const plan = await buildCoachPlan(
      database,
      coachId,
      linksByCoach.get(coachId),
      args.teamId
    );
    if (!plan.ok) {
      skipped += 1;
      console.log(`SKIP ${coachId}: ${plan.reason}`);
      continue;
    }
    planned += 1;
    console.log(
      `PLAN ${coachId}: ${plan.athletes.length} athletes, `
      + `${plan.linkDocuments.length} links, ${plan.targetMode} `
      + `${plan.organizationId}/${plan.teamId}, ${plan.plannedWrites} writes`
    );
    if (!args.apply) continue;
    await applyCoachPlan(database, plan);
    applied += 1;
    console.log(`APPLIED ${coachId}`);
  }

  console.log(`Planned: ${planned}`);
  console.log(`Skipped: ${skipped}`);
  console.log(args.apply
    ? `Applied: ${applied}`
    : `Dry run only. Apply with --project=${args.projectId} --confirm-project=${args.projectId} --apply.`);
}

module.exports = {
  buildDeterministicTarget,
  classifyLegacyRosterLink,
  hasCoachingCapability,
  isExactActiveContainer,
  parseArgs,
  selectValidatedTarget,
  validateApplyGates,
  validateDeterministicContainer,
  validateExactOrganizationMembership,
  validateExactTeamMembership,
};

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
