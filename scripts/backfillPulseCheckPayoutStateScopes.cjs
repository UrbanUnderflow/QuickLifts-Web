#!/usr/bin/env node
'use strict';

/**
 * Move legacy coach-global payout state into a coach/team state document.
 *
 * Dry run:
 *   node scripts/backfillPulseCheckPayoutStateScopes.cjs
 * Apply reviewed one-team migrations:
 *   node scripts/backfillPulseCheckPayoutStateScopes.cjs --apply
 *
 * A state is migrated only when every available state/request hint resolves to
 * one team and the destination state does not already exist.
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
const {
  PAYOUT_REQUESTS_COLLECTION,
  PAYOUT_STATES_COLLECTION,
  payoutStateId,
} = require('../netlify/functions/utils/pulsecheck-coach-payouts');

const PROD_PROJECT_ID = 'quicklifts-dd3f1';
const DEV_PROJECT_ID = 'quicklifts-dev-01';
const normalizeString = (value) => (
  typeof value === 'string' ? value.trim() : ''
);

const parseArgs = (argv) => {
  const options = {
    apply: argv.includes('--apply'),
    project: 'prod',
    coachUserId: '',
    limit: 0,
    serviceAccount: '',
  };
  argv.forEach((argument) => {
    if (argument.startsWith('--project=')) {
      options.project = normalizeString(argument.split('=')[1]) || 'prod';
    }
    if (argument.startsWith('--coach-user-id=')) {
      options.coachUserId = normalizeString(argument.split('=')[1]);
    }
    if (argument.startsWith('--limit=')) {
      options.limit = Math.max(0, Number.parseInt(argument.split('=')[1], 10) || 0);
    }
    if (argument.startsWith('--service-account=')) {
      options.serviceAccount = normalizeString(argument.split('=')[1]);
    }
  });
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
  const appName = `backfill-pulsecheck-payout-states-${projectId}`;
  const existing = getApps().find((candidate) => candidate.name === appName);
  const app = existing || initializeApp({
    credential: resolveCredential(serviceAccountPath),
    projectId,
  }, appName);
  return getFirestore(app);
};

const migrationPlan = ({
  stateId,
  state,
  requests,
  destinationExists,
}) => {
  if (stateId.includes('__') || normalizeString(state.migratedToStateId)) {
    return { status: 'already-scoped' };
  }
  const coachUserId = normalizeString(state.coachUserId) || stateId;
  if (!coachUserId || coachUserId !== stateId) {
    return { status: 'invalid-coach-state' };
  }
  const matchingRequests = requests.filter((request) => (
    normalizeString(request.coachUserId) === coachUserId
  ));
  const teamHints = [
    normalizeString(state.teamId),
    ...(Array.isArray(state.teamIds) ? state.teamIds.map(normalizeString) : []),
    ...matchingRequests.map((request) => normalizeString(request.teamId)),
  ].filter(Boolean);
  const teamIds = [...new Set(teamHints)];
  if (teamIds.length === 0) return { status: 'no-team-evidence' };
  if (teamIds.length > 1) return { status: 'ambiguous-team', teamIds };

  const teamId = teamIds[0];
  const destinationId = payoutStateId(coachUserId, teamId);
  if (!destinationId) return { status: 'invalid-team' };
  if (destinationExists(destinationId)) {
    return { status: 'destination-exists', destinationId, teamIds };
  }
  const organizations = [
    normalizeString(state.organizationId),
    ...matchingRequests
      .filter((request) => normalizeString(request.teamId) === teamId)
      .map((request) => normalizeString(request.organizationId)),
  ].filter(Boolean);
  const organizationIds = [...new Set(organizations)];
  if (organizationIds.length > 1) {
    return { status: 'ambiguous-organization', teamIds, organizationIds };
  }

  return {
    status: 'migrate',
    coachUserId,
    teamId,
    organizationId: organizationIds[0] || null,
    destinationId,
  };
};

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const projectId = resolveProjectId(options.project);
  const database = initializeDatabase(projectId, options.serviceAccount);
  const [stateSnapshot, requestSnapshot] = await Promise.all([
    database.collection(PAYOUT_STATES_COLLECTION).get(),
    database.collection(PAYOUT_REQUESTS_COLLECTION).get(),
  ]);
  const statesById = new Map(stateSnapshot.docs.map((document) => [
    document.id,
    { id: document.id, ...(document.data() || {}) },
  ]));
  const requests = requestSnapshot.docs.map((document) => ({
    id: document.id,
    ...(document.data() || {}),
  }));
  const legacyDocuments = stateSnapshot.docs
    .filter((document) => !document.id.includes('__'))
    .filter((document) => (
      !options.coachUserId || document.id === options.coachUserId
    ))
    .slice(0, options.limit || undefined);
  const planned = [];
  const counts = {};

  console.log('Backfill PulseCheck payout state scopes');
  console.log(`Project: ${projectId}`);
  console.log(`Mode: ${options.apply ? 'apply' : 'dry-run'}`);
  console.log(`Legacy states scanned: ${legacyDocuments.length}`);

  legacyDocuments.forEach((document) => {
    const state = document.data() || {};
    const plan = migrationPlan({
      stateId: document.id,
      state,
      requests,
      destinationExists: (id) => statesById.has(id),
    });
    counts[plan.status] = (counts[plan.status] || 0) + 1;
    if (plan.status === 'migrate') planned.push({ document, state, plan });
    console.log(
      `  - ${document.id}: ${plan.status}`
      + (plan.teamIds?.length ? ` (${plan.teamIds.join(', ')})` : '')
      + (plan.teamId ? ` (${plan.teamId})` : '')
    );
  });
  Object.keys(counts).sort().forEach((status) => {
    console.log(`${status}: ${counts[status]}`);
  });
  console.log(`Safe migrations: ${planned.length}`);

  if (!options.apply) {
    console.log('Dry run only. Re-run with --apply after reviewing skipped states.');
    return;
  }

  for (const { document, state, plan } of planned) {
    const destinationRef = database
      .collection(PAYOUT_STATES_COLLECTION)
      .doc(plan.destinationId);
    await database.runTransaction(async (transaction) => {
      const [sourceSnapshot, destinationSnapshot] = await Promise.all([
        transaction.get(document.ref),
        transaction.get(destinationRef),
      ]);
      if (!sourceSnapshot.exists || destinationSnapshot.exists) {
        throw new Error(`Payout state changed during migration: ${document.id}`);
      }
      transaction.create(destinationRef, {
        ...state,
        coachUserId: plan.coachUserId,
        teamId: plan.teamId,
        organizationId: plan.organizationId,
        migratedFromStateId: document.id,
        migratedAt: FieldValue.serverTimestamp(),
        migrationVersion: 1,
      });
      transaction.update(document.ref, {
        migratedToStateId: plan.destinationId,
        migratedAt: FieldValue.serverTimestamp(),
        migrationVersion: 1,
      });
    });
  }
  console.log(`Migrated payout states: ${planned.length}`);
}

module.exports = { migrationPlan };

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
