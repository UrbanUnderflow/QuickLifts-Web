#!/usr/bin/env node

/**
 * Seeds the PulseCheck Adaptive Framing Layer (Phase B).
 *
 * Default mode is a dry diff:
 *   node --import tsx scripts/seed-adaptive-framing-layer.cjs
 *
 * Apply mode writes the seed bundle:
 *   node --import tsx scripts/seed-adaptive-framing-layer.cjs --apply --project=quicklifts-dev-01
 *
 * Mirrors seed-pulsecheck-sports.ts patterns: stripUndefinedDeep + admin-SDK
 * auth via service-account file or applicationDefault().
 */

const fs = require('node:fs');
const path = require('node:path');
const { initializeApp, cert, applicationDefault, getApps } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

const placeholderEnv = {
  NEXT_PUBLIC_FIREBASE_API_KEY: 'seed-script-placeholder',
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: 'seed-script-placeholder.firebaseapp.com',
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'seed-script-placeholder',
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: 'seed-script-placeholder.appspot.com',
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: '000000000000',
  NEXT_PUBLIC_FIREBASE_APP_ID: '1:000000000000:web:seedscript',
};
for (const [key, value] of Object.entries(placeholderEnv)) {
  process.env[key] ||= value;
}

const SEED_REVISION_ID = 'r-2026-04-28-seed-v1';
const AUDIT_COLLECTION = 'pulsecheck-adaptive-framing-seed-audit';

function parseArgs(argv) {
  const args = {
    apply: argv.includes('--apply'),
    project: process.env.GOOGLE_CLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID || 'quicklifts-dev-01',
    serviceAccountPath: path.join(process.cwd(), 'serviceAccountKey.json'),
  };
  for (const arg of argv) {
    if (arg.startsWith('--project=')) {
      args.project = arg.split('=')[1]?.trim() || args.project;
    }
    if (arg.startsWith('--service-account=')) {
      args.serviceAccountPath = path.resolve(arg.split('=')[1]?.trim() || args.serviceAccountPath);
    }
  }
  return args;
}

function buildAdminApp(args) {
  if (getApps().length > 0) return getApps()[0];

  if (fs.existsSync(args.serviceAccountPath)) {
    return initializeApp({
      projectId: args.project,
      credential: cert(JSON.parse(fs.readFileSync(args.serviceAccountPath, 'utf8'))),
    });
  }
  return initializeApp({
    projectId: args.project,
    credential: applicationDefault(),
  });
}

// Audit/metadata fields written by the seeder or Firestore — excluded from
// drift comparison so re-runs show "in sync" once seed payload matches.
const METADATA_KEYS = new Set([
  'createdAt',
  'updatedAt',
  'archivedAt',
  'appliedAt',
  'seededBy',
  'seedRevisionId',
  'seedSource',
]);

function normalizeForCompare(value) {
  if (value === undefined) return null;
  if (value === null || ['string', 'number', 'boolean'].includes(typeof value)) return value;
  // Firestore Timestamp -> stable shape (ignored when key is metadata).
  if (value && typeof value === 'object' && typeof value.toMillis === 'function') {
    return null;
  }
  if (Array.isArray(value)) return value.map(normalizeForCompare);
  if (typeof value === 'object') {
    const result = {};
    for (const key of Object.keys(value).sort()) {
      if (METADATA_KEYS.has(key)) continue;
      const entry = normalizeForCompare(value[key]);
      if (entry !== null) result[key] = entry;
    }
    return result;
  }
  return String(value);
}

const stableStringify = (value) => JSON.stringify(normalizeForCompare(value));
const hasChanged = (left, right) => stableStringify(left) !== stableStringify(right);

function stripUndefinedDeep(value) {
  if (Array.isArray(value)) {
    return value.map(stripUndefinedDeep).filter((entry) => entry !== undefined);
  }
  if (!value || typeof value !== 'object') return value;
  const output = {};
  for (const [key, entry] of Object.entries(value)) {
    if (entry === undefined) continue;
    output[key] = stripUndefinedDeep(entry);
  }
  return output;
}

function summarizeChange(label, current, next) {
  if (!current && next) return `${label}: added`;
  if (current && !next) return `${label}: would remove`;
  return hasChanged(current, next) ? `${label}: changed` : `${label}: unchanged`;
}

async function loadSeed() {
  const seedModulePath = path.join(__dirname, '..', 'src', 'api', 'firebase', 'adaptiveFramingLayer', 'seed.ts');
  const seedUrl = require('node:url').pathToFileURL(seedModulePath).href;
  // Dynamic ESM import — requires `node --import tsx` to transpile the TS module.
  const mod = await import(seedUrl);
  return mod.getAdaptiveFramingLayerSeedBundle();
}

async function buildDiff(db, bundle) {
  const offLimitsSnap = await db.collection('pulsecheck-off-limits-config').doc('current').get();
  const framingSnap = await db.collection('pulsecheck-adaptive-framing-scale').doc('current').get();
  const translationSnap = await db.collection('pulsecheck-translation-table').get();
  const conversationSnap = await db.collection('pulsecheck-conversation-tree').get();

  const currentTranslation = new Map();
  translationSnap.forEach((d) => currentTranslation.set(d.id, d.data()));
  const currentConversation = new Map();
  conversationSnap.forEach((d) => currentConversation.set(d.id, d.data()));

  const diff = {
    offLimitsConfig: summarizeChange(
      'pulsecheck-off-limits-config/current',
      offLimitsSnap.exists ? offLimitsSnap.data() : null,
      bundle.offLimitsConfig,
    ),
    framingScale: summarizeChange(
      'pulsecheck-adaptive-framing-scale/current',
      framingSnap.exists ? framingSnap.data() : null,
      bundle.framingScale,
    ),
    translationRows: bundle.translationRows.map((row) => {
      const current = currentTranslation.get(row.id);
      return summarizeChange(`pulsecheck-translation-table/${row.id}`, current, row);
    }),
    conversationBranches: bundle.conversationBranches.map((branch) => {
      const current = currentConversation.get(branch.id);
      return summarizeChange(`pulsecheck-conversation-tree/${branch.id}`, current, branch);
    }),
  };

  return diff;
}

function printDiff(diff) {
  const lines = [diff.offLimitsConfig, diff.framingScale, ...diff.translationRows, ...diff.conversationBranches];
  const changed = lines.filter((line) => !line.endsWith('unchanged'));

  if (changed.length === 0) {
    console.log('Adaptive Framing Layer is in sync with seed.');
    return;
  }
  console.log(`Adaptive Framing Layer drift (${changed.length} change${changed.length === 1 ? '' : 's'}):`);
  for (const line of changed) console.log(`  • ${line}`);
}

async function applyBundle(db, args, bundle) {
  const batch = db.batch();
  const writeMetadata = {
    appliedAt: FieldValue.serverTimestamp(),
    seededBy: 'system-seed',
    seedRevisionId: SEED_REVISION_ID,
    seedSource: 'scripts/seed-adaptive-framing-layer.cjs',
  };

  batch.set(
    db.collection('pulsecheck-off-limits-config').doc('current'),
    stripUndefinedDeep({
      ...bundle.offLimitsConfig,
      updatedAt: FieldValue.serverTimestamp(),
      ...writeMetadata,
    }),
    { merge: true },
  );

  batch.set(
    db.collection('pulsecheck-adaptive-framing-scale').doc('current'),
    stripUndefinedDeep({
      ...bundle.framingScale,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      ...writeMetadata,
    }),
    { merge: true },
  );

  for (const row of bundle.translationRows) {
    batch.set(
      db.collection('pulsecheck-translation-table').doc(row.id),
      stripUndefinedDeep({
        ...row,
        archivedAt: row.archivedAt ?? null,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        ...writeMetadata,
      }),
      { merge: true },
    );
  }

  for (const branch of bundle.conversationBranches) {
    batch.set(
      db.collection('pulsecheck-conversation-tree').doc(branch.id),
      stripUndefinedDeep({
        ...branch,
        archivedAt: branch.archivedAt ?? null,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        ...writeMetadata,
      }),
      { merge: true },
    );
  }

  await batch.commit();

  await db.collection(AUDIT_COLLECTION).add({
    project: args.project,
    seedRevisionId: SEED_REVISION_ID,
    translationRowCount: bundle.translationRows.length,
    conversationBranchCount: bundle.conversationBranches.length,
    framingSignalCount: bundle.framingScale.signals.length,
    forbiddenMarkerCount: bundle.offLimitsConfig.forbiddenMarkers.length,
    createdAt: FieldValue.serverTimestamp(),
    source: 'scripts/seed-adaptive-framing-layer.cjs',
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const bundle = await loadSeed();
  const app = buildAdminApp(args);
  const db = getFirestore(app);

  const diff = await buildDiff(db, bundle);
  printDiff(diff);

  if (!args.apply) {
    console.log('\nDiff mode only. Re-run with --apply --project=<projectId> to write seed.');
    return;
  }

  await applyBundle(db, args, bundle);
  console.log(
    `\nApplied Adaptive Framing Layer seed: ${bundle.translationRows.length} translation rows, ` +
      `${bundle.conversationBranches.length} conversation branches, ` +
      `${bundle.framingScale.signals.length} framing signals, ` +
      `${bundle.offLimitsConfig.forbiddenMarkers.length} forbidden markers.`,
  );
  console.log(`Project: ${args.project}`);
}

main().catch((error) => {
  console.error('[seed-adaptive-framing-layer] Failed:', error);
  process.exitCode = 1;
});
