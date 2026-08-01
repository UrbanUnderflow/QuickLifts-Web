#!/usr/bin/env node
'use strict';

/**
 * Backfill modern PulseCheck team scope onto legacy coach-athlete conversations.
 *
 * Usage:
 *   node scripts/backfillPulseCheckConversationScopes.cjs
 *   node scripts/backfillPulseCheckConversationScopes.cjs --project=dev
 *   node scripts/backfillPulseCheckConversationScopes.cjs --conversation-id=<id>
 *   node scripts/backfillPulseCheckConversationScopes.cjs --apply
 *
 * The script is a dry run unless --apply is supplied. It writes only when the
 * athlete and coach have exactly one valid shared active team. Ambiguous and
 * invalid records are reported for manual review.
 */

const fs = require('fs');
const path = require('path');
const {
  applicationDefault,
  cert,
  getApps,
  initializeApp,
} = require('firebase-admin/app');
const {
  FieldValue,
  getFirestore,
} = require('firebase-admin/firestore');

const CONVERSATIONS = 'coach-athlete-conversations';
const MEMBERSHIPS = 'pulsecheck-team-memberships';
const TEAMS = 'pulsecheck-teams';
const ORGANIZATIONS = 'pulsecheck-organizations';
const PROD_PROJECT_ID = 'quicklifts-dd3f1';
const DEV_PROJECT_ID = 'quicklifts-dev-01';

const normalizeString = (value) => (
  typeof value === 'string' ? value.trim() : ''
);

const parseArgs = (argv) => {
  const options = {
    apply: argv.includes('--apply'),
    project: 'prod',
    conversationId: '',
    limit: 0,
    serviceAccount: '',
  };
  for (const argument of argv) {
    if (argument.startsWith('--project=')) {
      options.project = normalizeString(argument.split('=')[1]) || 'prod';
    }
    if (argument.startsWith('--conversation-id=')) {
      options.conversationId = normalizeString(argument.split('=')[1]);
    }
    if (argument.startsWith('--limit=')) {
      options.limit = Math.max(0, Number.parseInt(argument.split('=')[1], 10) || 0);
    }
    if (argument.startsWith('--service-account=')) {
      options.serviceAccount = normalizeString(argument.split('=')[1]);
    }
  }
  return options;
};

const resolveProjectId = (project) => {
  const value = normalizeString(project).toLowerCase();
  if (!value || value === 'prod' || value === 'production') return PROD_PROJECT_ID;
  if (value === 'dev' || value === 'development') return DEV_PROJECT_ID;
  return project;
};

const resolveCredential = (serviceAccountPath) => {
  if (serviceAccountPath) {
    return cert(require(path.resolve(serviceAccountPath)));
  }
  const repositoryKey = path.join(__dirname, '..', 'serviceAccountKey.json');
  if (fs.existsSync(repositoryKey)) {
    return cert(require(repositoryKey));
  }
  return applicationDefault();
};

const initializeDatabase = (projectId, serviceAccountPath) => {
  const appName = `backfill-pulsecheck-conversation-scopes-${projectId}`;
  const existing = getApps().find((candidate) => candidate.name === appName);
  const app = existing || initializeApp({
    credential: resolveCredential(serviceAccountPath),
    projectId,
  }, appName);
  return getFirestore(app);
};

const hasNoRemovalMarker = (data) => (
  data.deletedAt == null
  && data.archivedAt == null
  && data.revokedAt == null
);

const activeMembership = (data) => (
  hasNoRemovalMarker(data)
  && (!normalizeString(data.status) || normalizeString(data.status) === 'active')
);

const activeContainer = (data) => (
  hasNoRemovalMarker(data)
  && normalizeString(data.status) === 'active'
);

const staffCanMessageAthlete = (membership, athleteId) => {
  if (!activeMembership(membership) || normalizeString(membership.role) === 'athlete') {
    return false;
  }
  const role = normalizeString(membership.role).toLowerCase();
  const capabilities = Array.isArray(membership.staffCapabilities)
    ? membership.staffCapabilities.map((value) => normalizeString(value).toLowerCase()).filter(Boolean)
    : [];
  const hasCoachingAccess = role === 'team-admin'
    || capabilities.includes('admin')
    || capabilities.includes('coaching')
    || (capabilities.length === 0 && role === 'coach');
  if (!hasCoachingAccess) return false;

  const visibility = normalizeString(membership.rosterVisibilityScope).toLowerCase();
  if (visibility !== 'assigned') return visibility !== 'none';
  return Array.isArray(membership.allowedAthleteIds)
    && membership.allowedAthleteIds.includes(athleteId);
};

const uniqueParticipantIds = (data) => [
  ...new Set(
    (Array.isArray(data.participantIds) ? data.participantIds : [])
      .map(normalizeString)
      .filter(Boolean)
  ),
].sort();

const expectedParticipantIds = (coachId, athleteId) => [coachId, athleteId].sort();

const buildIndexes = ({
  membershipSnapshot,
  teamSnapshot,
  organizationSnapshot,
}) => {
  const membershipsByUser = new Map();
  const membershipById = new Map();
  membershipSnapshot.docs.forEach((document) => {
    const membership = { id: document.id, ...(document.data() || {}) };
    membershipById.set(document.id, membership);
    const userId = normalizeString(membership.userId);
    if (!membershipsByUser.has(userId)) membershipsByUser.set(userId, []);
    membershipsByUser.get(userId).push(membership);
  });
  return {
    membershipsByUser,
    membershipById,
    teamsById: new Map(teamSnapshot.docs.map((document) => [
      document.id,
      { id: document.id, ...(document.data() || {}) },
    ])),
    organizationsById: new Map(organizationSnapshot.docs.map((document) => [
      document.id,
      { id: document.id, ...(document.data() || {}) },
    ])),
  };
};

const candidateScopes = ({
  coachId,
  athleteId,
  indexes,
}) => {
  const athleteMemberships = indexes.membershipsByUser.get(athleteId) || [];
  const scopes = [];
  for (const athleteMembership of athleteMemberships) {
    const teamId = normalizeString(athleteMembership.teamId);
    const organizationId = normalizeString(athleteMembership.organizationId);
    if (
      !teamId
      || !organizationId
      || normalizeString(athleteMembership.role) !== 'athlete'
      || athleteMembership.id !== `${teamId}_${athleteId}`
      || !activeMembership(athleteMembership)
    ) {
      continue;
    }

    const team = indexes.teamsById.get(teamId);
    const organization = indexes.organizationsById.get(organizationId);
    const coachMembership = indexes.membershipById.get(`${teamId}_${coachId}`);
    if (
      !team
      || !organization
      || !coachMembership
      || !activeContainer(team)
      || !activeContainer(organization)
      || normalizeString(team.organizationId) !== organizationId
      || normalizeString(coachMembership.teamId) !== teamId
      || normalizeString(coachMembership.organizationId) !== organizationId
      || normalizeString(coachMembership.userId) !== coachId
      || !staffCanMessageAthlete(coachMembership, athleteId)
    ) {
      continue;
    }
    scopes.push({ organizationId, teamId });
  }

  return [
    ...new Map(
      scopes.map((scope) => [`${scope.organizationId}/${scope.teamId}`, scope])
    ).values(),
  ];
};

const planConversationUpdate = (document, indexes) => {
  const data = document.data() || {};
  const coachId = normalizeString(data.coachId);
  const athleteId = normalizeString(data.athleteId);
  if (!coachId || !athleteId || coachId === athleteId) {
    return { status: 'invalid-participants' };
  }

  const currentOrganizationId = normalizeString(data.organizationId);
  const currentTeamId = normalizeString(data.teamId);
  const candidates = candidateScopes({ coachId, athleteId, indexes });
  const exactCandidate = candidates.find((scope) => (
    scope.organizationId === currentOrganizationId
    && scope.teamId === currentTeamId
  ));
  const hasStoredScope = Boolean(currentOrganizationId && currentTeamId);
  if (hasStoredScope && !exactCandidate) {
    return {
      status: 'invalid-existing-scope',
      candidates,
    };
  }
  if (!hasStoredScope && candidates.length !== 1) {
    return {
      status: candidates.length === 0 ? 'no-valid-scope' : 'ambiguous-scope',
      candidates,
    };
  }

  const scope = exactCandidate || candidates[0];
  const expected = expectedParticipantIds(coachId, athleteId);
  const participantsMatch = uniqueParticipantIds(data).join('|') === expected.join('|');
  if (
    currentOrganizationId === scope.organizationId
    && currentTeamId === scope.teamId
    && participantsMatch
  ) {
    return { status: 'already-valid', scope };
  }
  return {
    status: 'update',
    scope,
    update: {
      organizationId: scope.organizationId,
      teamId: scope.teamId,
      participantIds: expected,
      updatedAt: FieldValue.serverTimestamp(),
      scopeBackfilledAt: FieldValue.serverTimestamp(),
      scopeBackfillVersion: 1,
    },
  };
};

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const projectId = resolveProjectId(options.project);
  const database = initializeDatabase(projectId, options.serviceAccount);
  const [conversationSnapshot, membershipSnapshot, teamSnapshot, organizationSnapshot] = await Promise.all([
    options.conversationId
      ? database.collection(CONVERSATIONS).where('__name__', '==', options.conversationId).get()
      : database.collection(CONVERSATIONS).get(),
    database.collection(MEMBERSHIPS).get(),
    database.collection(TEAMS).get(),
    database.collection(ORGANIZATIONS).get(),
  ]);
  const indexes = buildIndexes({
    membershipSnapshot,
    teamSnapshot,
    organizationSnapshot,
  });
  const documents = conversationSnapshot.docs.slice(0, options.limit || undefined);
  const counts = {};
  const planned = [];

  console.log('Backfill PulseCheck conversation scopes');
  console.log(`Project: ${projectId}`);
  console.log(`Mode: ${options.apply ? 'apply' : 'dry-run'}`);
  console.log(`Conversations scanned: ${documents.length}`);

  for (const document of documents) {
    const plan = planConversationUpdate(document, indexes);
    counts[plan.status] = (counts[plan.status] || 0) + 1;
    if (plan.status === 'update') planned.push({ document, plan });
    if (!['already-valid', 'update'].includes(plan.status)) {
      const candidates = (plan.candidates || [])
        .map((scope) => `${scope.organizationId}/${scope.teamId}`)
        .join(', ');
      console.log(`  - ${document.id}: ${plan.status}${candidates ? ` (${candidates})` : ''}`);
    }
  }

  Object.keys(counts).sort().forEach((status) => {
    console.log(`${status}: ${counts[status]}`);
  });
  console.log(`Safe updates: ${planned.length}`);

  if (!options.apply) {
    console.log('Dry run only. Re-run with --apply after reviewing skipped records.');
    return;
  }

  let batch = database.batch();
  let pending = 0;
  let updated = 0;
  for (const { document, plan } of planned) {
    batch.update(document.ref, plan.update);
    pending += 1;
    if (pending === 400) {
      await batch.commit();
      updated += pending;
      pending = 0;
      batch = database.batch();
    }
  }
  if (pending > 0) {
    await batch.commit();
    updated += pending;
  }
  console.log(`Updated conversations: ${updated}`);
}

module.exports = {
  activeContainer,
  activeMembership,
  candidateScopes,
  planConversationUpdate,
  staffCanMessageAthlete,
};

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
