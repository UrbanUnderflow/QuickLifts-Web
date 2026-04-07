#!/usr/bin/env node
'use strict';

/**
 * Repair PulseCheck general invite links that were incorrectly marked non-active.
 *
 * Usage:
 *   node scripts/repairPulseCheckGeneralInviteStatuses.js
 *   node scripts/repairPulseCheckGeneralInviteStatuses.js --apply
 *   node scripts/repairPulseCheckGeneralInviteStatuses.js --project=dev
 *   node scripts/repairPulseCheckGeneralInviteStatuses.js --project=quicklifts-dd3f1 --team-id=<teamId>
 *   node scripts/repairPulseCheckGeneralInviteStatuses.js --apply --invite-id=<inviteId>
 *
 * Notes:
 * - Dry-run by default. Pass --apply to write.
 * - Repairs only team-access invites where redemptionMode=general and status!=active.
 * - Leaves redemption metadata intact so "last used" and redemptionCount stay visible.
 */

const fs = require('fs');
const path = require('path');
const { initializeApp, applicationDefault, cert, getApps } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

const INVITE_LINKS_COLLECTION = 'pulsecheck-invite-links';
const PROD_PROJECT_ID = 'quicklifts-dd3f1';
const DEV_PROJECT_ID = 'quicklifts-dev-01';

function parseArgs(argv) {
  const args = {
    apply: argv.includes('--apply'),
    dryRun: !argv.includes('--apply'),
    project: 'prod',
    teamId: '',
    inviteId: '',
    limit: 0,
    serviceAccount: '',
  };

  for (const arg of argv) {
    if (arg.startsWith('--project=')) args.project = arg.split('=')[1]?.trim() || args.project;
    if (arg.startsWith('--team-id=')) args.teamId = arg.split('=')[1]?.trim() || '';
    if (arg.startsWith('--invite-id=')) args.inviteId = arg.split('=')[1]?.trim() || '';
    if (arg.startsWith('--limit=')) args.limit = Math.max(0, parseInt(arg.split('=')[1], 10) || 0);
    if (arg.startsWith('--service-account=')) args.serviceAccount = arg.split('=')[1]?.trim() || '';
  }

  return args;
}

function resolveProjectId(project) {
  const normalized = String(project || '').trim().toLowerCase();
  if (!normalized || normalized === 'prod' || normalized === 'production') return PROD_PROJECT_ID;
  if (normalized === 'dev' || normalized === 'development') return DEV_PROJECT_ID;
  return project;
}

function resolveCredential(serviceAccountPath) {
  const explicitPath = String(serviceAccountPath || '').trim();
  if (explicitPath) {
    const resolvedPath = path.resolve(explicitPath);
    return cert(require(resolvedPath));
  }

  const repoKeyPath = path.join(__dirname, '..', 'serviceAccountKey.json');
  if (fs.existsSync(repoKeyPath)) {
    return cert(require(repoKeyPath));
  }

  return applicationDefault();
}

function initFirestore(projectId, serviceAccountPath) {
  const appName = `repair-pulsecheck-general-invites-${projectId}`;
  const existing = getApps().find((app) => app.name === appName);
  const app = existing || initializeApp(
    {
      credential: resolveCredential(serviceAccountPath),
      projectId,
    },
    appName
  );

  return getFirestore(app);
}

function normalizeString(value) {
  return String(value || '').trim();
}

function isRepairCandidate(id, data, filters) {
  if (!data || typeof data !== 'object') return false;
  if (normalizeString(data.inviteType) !== 'team-access') return false;
  if (normalizeString(data.redemptionMode) !== 'general') return false;
  if (normalizeString(data.status) === 'active') return false;
  if (filters.teamId && normalizeString(data.teamId) !== filters.teamId) return false;
  if (filters.inviteId && id !== filters.inviteId) return false;
  return true;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const projectId = resolveProjectId(args.project);
  const db = initFirestore(projectId, args.serviceAccount);

  console.log('Repair PulseCheck general invite statuses');
  console.log(`Project: ${projectId}`);
  console.log(`Mode: ${args.dryRun ? 'dry-run' : 'apply'}`);
  if (args.teamId) console.log(`Team filter: ${args.teamId}`);
  if (args.inviteId) console.log(`Invite filter: ${args.inviteId}`);
  if (args.limit) console.log(`Limit: ${args.limit}`);

  const inviteSnap = await db.collection(INVITE_LINKS_COLLECTION).where('redemptionMode', '==', 'general').get();
  const candidates = inviteSnap.docs
    .filter((docSnap) => isRepairCandidate(docSnap.id, docSnap.data(), args))
    .slice(0, args.limit || undefined);

  console.log(`General invites scanned: ${inviteSnap.size}`);
  console.log(`Repair candidates: ${candidates.length}`);

  if (candidates.length === 0) {
    console.log('No incorrectly redeemed general invite links found.');
    return;
  }

  for (const docSnap of candidates) {
    const data = docSnap.data() || {};
    const labelParts = [
      docSnap.id,
      normalizeString(data.teamId) ? `team=${normalizeString(data.teamId)}` : '',
      normalizeString(data.pilotId) ? `pilot=${normalizeString(data.pilotId)}` : '',
      normalizeString(data.cohortId) ? `cohort=${normalizeString(data.cohortId)}` : 'whole-pilot',
      data.redemptionCount != null ? `count=${Number(data.redemptionCount || 0)}` : '',
      normalizeString(data.redeemedByEmail) ? `last=${normalizeString(data.redeemedByEmail)}` : '',
    ].filter(Boolean);
    console.log(`  - ${labelParts.join(' | ')}`);
  }

  if (args.dryRun) {
    console.log('\nDry run only. Re-run with --apply to write the repairs.');
    return;
  }

  let batch = db.batch();
  let batchCount = 0;
  let updated = 0;

  for (const docSnap of candidates) {
    batch.update(docSnap.ref, {
      status: 'active',
      updatedAt: FieldValue.serverTimestamp(),
    });
    batchCount += 1;

    if (batchCount === 400) {
      await batch.commit();
      updated += batchCount;
      batch = db.batch();
      batchCount = 0;
    }
  }

  if (batchCount > 0) {
    await batch.commit();
    updated += batchCount;
  }

  console.log(`\nUpdated ${updated} general invite link(s) back to active.`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
