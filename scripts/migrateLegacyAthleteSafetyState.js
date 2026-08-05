#!/usr/bin/env node
'use strict';

/**
 * Move legacy clinical/crisis fields from publicly readable users/{uid} docs
 * into private pulsecheck-athlete-safety-state/{uid} docs, then remove only
 * the named legacy fields from the root user doc.
 *
 * Dry-run is the default:
 *   node scripts/migrateLegacyAthleteSafetyState.js
 *   node scripts/migrateLegacyAthleteSafetyState.js --user-id=<uid>
 *   node scripts/migrateLegacyAthleteSafetyState.js --limit=250
 *
 * Apply only after reviewing the dry-run output:
 *   node scripts/migrateLegacyAthleteSafetyState.js --apply --limit=250
 *
 * No document deletes are performed. Each applied migration atomically merges
 * an allow-listed private safety record and deletes only LEGACY_USER_FIELDS.
 */

const fs = require('fs');
const path = require('path');
const { applicationDefault, cert, getApps, initializeApp } = require('firebase-admin/app');
const { FieldValue, getFirestore } = require('firebase-admin/firestore');

const PROD_PROJECT_ID = 'quicklifts-dd3f1';
const USERS_COLLECTION = 'users';
const SAFETY_STATE_COLLECTION = 'pulsecheck-athlete-safety-state';
const DEFAULT_LIMIT = 250;
const MAX_LIMIT = 1000;
const LEGACY_USER_FIELDS = Object.freeze([
  'clinicalCareState',
  'crisisWallActive',
  'crisisWallActivatedAt',
  'crisisWallActiveEscalationId',
  'crisisWallClearReason',
  'crisisWallClearedAt',
  'crisisWallClearedByUserId',
  'crisisWallReason',
]);
const DIRECT_SAFETY_FIELDS = Object.freeze(LEGACY_USER_FIELDS.filter((field) => field !== 'clinicalCareState'));

function parseArgs(argv) {
  const args = {
    apply: argv.includes('--apply'),
    projectId: PROD_PROJECT_ID,
    serviceAccount: '',
    userId: '',
    limit: DEFAULT_LIMIT,
  };
  for (const arg of argv) {
    if (arg.startsWith('--project=')) args.projectId = arg.slice('--project='.length).trim() || PROD_PROJECT_ID;
    if (arg.startsWith('--service-account=')) args.serviceAccount = arg.slice('--service-account='.length).trim();
    if (arg.startsWith('--user-id=')) args.userId = arg.slice('--user-id='.length).trim();
    if (arg.startsWith('--limit=')) {
      const parsed = Number.parseInt(arg.slice('--limit='.length), 10);
      if (Number.isFinite(parsed)) args.limit = Math.min(MAX_LIMIT, Math.max(1, parsed));
    }
  }
  return args;
}

function resolveCredential(serviceAccountPath) {
  const explicitPath = String(serviceAccountPath || '').trim();
  if (explicitPath) return cert(require(path.resolve(explicitPath)));

  const repoKeyPath = path.join(__dirname, '..', 'serviceAccountKey.json');
  if (fs.existsSync(repoKeyPath)) return cert(require(repoKeyPath));

  const serviceAccountJson = String(process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON || '').trim();
  if (serviceAccountJson) return cert(JSON.parse(serviceAccountJson));
  return applicationDefault();
}

function initFirestore(projectId, serviceAccountPath) {
  const appName = `migrate-athlete-safety-state-${projectId}`;
  const existing = getApps().find((app) => app.name === appName);
  const app = existing || initializeApp({
    credential: resolveCredential(serviceAccountPath),
    projectId,
  }, appName);
  return getFirestore(app);
}

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object || {}, key);
}

function buildPrivateSafetyState(userId, userData, teamId = '') {
  const privateState = { athleteUserId: userId };
  if (teamId) privateState.teamId = teamId;

  for (const field of DIRECT_SAFETY_FIELDS) {
    if (hasOwn(userData, field)) privateState[field] = userData[field];
  }

  const careState = userData?.clinicalCareState;
  if (careState && typeof careState === 'object' && !Array.isArray(careState)) {
    const watchList = [
      careState.watchListActive,
      careState.watchList,
      careState.watchlistActive,
      careState.watchlist,
    ].find((value) => typeof value === 'boolean');
    if (typeof watchList === 'boolean') privateState.watchListActive = watchList;
    if (typeof careState.appState === 'string' && careState.appState.trim()) {
      privateState.appState = careState.appState.trim();
    }
    if (typeof careState.returnToTrainingStatus === 'string' && careState.returnToTrainingStatus.trim()) {
      privateState.returnToTrainingStatus = careState.returnToTrainingStatus.trim();
    }
  }

  return privateState;
}

function buildLegacyFieldDeletion() {
  return Object.fromEntries(LEGACY_USER_FIELDS.map((field) => [field, FieldValue.delete()]));
}

async function findCandidateDocs(db, args) {
  if (args.userId) {
    const snapshot = await db.collection(USERS_COLLECTION).doc(args.userId).get();
    if (!snapshot.exists) return [];
    const data = snapshot.data() || {};
    return LEGACY_USER_FIELDS.some((field) => hasOwn(data, field)) ? [snapshot] : [];
  }

  const candidates = new Map();
  for (const field of LEGACY_USER_FIELDS) {
    if (candidates.size >= args.limit) break;
    const snapshot = await db
      .collection(USERS_COLLECTION)
      .orderBy(field)
      .limit(args.limit)
      .get();
    for (const doc of snapshot.docs) {
      candidates.set(doc.id, doc);
      if (candidates.size >= args.limit) break;
    }
  }
  return Array.from(candidates.values()).slice(0, args.limit);
}

async function resolveUnambiguousTeamId(db, userId) {
  const snapshot = await db
    .collection('pulsecheck-team-memberships')
    .where('userId', '==', userId)
    .where('role', '==', 'athlete')
    .where('status', '==', 'active')
    .limit(2)
    .get();
  if (snapshot.size !== 1) return '';
  return String(snapshot.docs[0].data()?.teamId || '').trim();
}

async function migrateCandidate(db, userDoc, apply) {
  const userData = userDoc.data() || {};
  const presentFields = LEGACY_USER_FIELDS.filter((field) => hasOwn(userData, field));
  const teamId = await resolveUnambiguousTeamId(db, userDoc.id).catch(() => '');
  const privateState = buildPrivateSafetyState(userDoc.id, userData, teamId);

  if (apply) {
    const batch = db.batch();
    batch.set(
      db.collection(SAFETY_STATE_COLLECTION).doc(userDoc.id),
      {
        ...privateState,
        legacyRootSafetyStateMigratedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    batch.update(userDoc.ref, buildLegacyFieldDeletion());
    await batch.commit();
  }

  return {
    userId: userDoc.id,
    presentFields,
    privateFields: Object.keys(privateState).sort(),
    teamId: teamId || null,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const db = initFirestore(args.projectId, args.serviceAccount);
  console.log('Legacy athlete safety-state migration');
  console.log(`Project: ${args.projectId}`);
  console.log(`Mode: ${args.apply ? 'APPLY' : 'DRY RUN'}`);
  console.log(`Maximum user documents: ${args.limit}`);
  if (args.userId) console.log(`User filter: ${args.userId}`);

  const candidates = await findCandidateDocs(db, args);
  const results = [];
  for (const candidate of candidates) {
    const result = await migrateCandidate(db, candidate, args.apply);
    results.push(result);
    console.log(JSON.stringify(result));
  }

  console.log(`Candidates: ${results.length}`);
  console.log(`Applied: ${args.apply ? results.length : 0}`);
  if (!args.apply) {
    console.log('Dry run only. Re-run with --apply after reviewing every candidate.');
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error('Legacy athlete safety-state migration failed:', error);
    process.exitCode = 1;
  });
}

module.exports = {
  LEGACY_USER_FIELDS,
  buildPrivateSafetyState,
  parseArgs,
};
