#!/usr/bin/env node

/**
 * Rebuild mission outcome summary fields from agent-outcomes.
 *
 * Usage:
 *   node scripts/replayMissionOutcomeSummary.js --dry-run
 *   node scripts/replayMissionOutcomeSummary.js --mission-id=<missionId>
 *   node scripts/replayMissionOutcomeSummary.js --mission-id=<missionId> --advance-observations
 *
 * Auth:
 * - Prefers ./serviceAccountKey.json at repo root
 * - Falls back to Application Default Credentials
 */

const fs = require('fs');
const path = require('path');
const { initializeApp, applicationDefault, cert, getApps } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const {
  OUTCOME_COLLECTION,
  summarizeMissionOutcomes,
  advanceOutcomeObservation,
} = require('./missionOsV2');

const MISSION_DOC = 'company-config/mission-status';

function parseArgs(argv) {
  const args = {
    dryRun: argv.includes('--dry-run'),
    advanceObservations: argv.includes('--advance-observations'),
    missionId: '',
  };

  for (const arg of argv) {
    if (arg.startsWith('--mission-id=')) args.missionId = arg.split('=')[1]?.trim() || '';
  }

  return args;
}

function initAdminApp() {
  if (getApps().length > 0) return getApps()[0];

  const keyPath = path.join(__dirname, '..', 'serviceAccountKey.json');
  if (fs.existsSync(keyPath)) {
    return initializeApp({
      credential: cert(require(keyPath)),
    }, 'mission-outcome-replay');
  }

  return initializeApp({
    credential: applicationDefault(),
  }, 'mission-outcome-replay');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const db = getFirestore(initAdminApp());
  const missionSnap = await db.doc(MISSION_DOC).get();
  const mission = missionSnap.exists ? (missionSnap.data() || {}) : {};
  const missionId = args.missionId || String(mission?.missionId || '').trim();

  if (!missionId) {
    throw new Error('Missing mission id. Pass --mission-id=<missionId> or set a current mission in company-config/mission-status.');
  }

  const outcomeSnap = await db.collection(OUTCOME_COLLECTION).where('missionId', '==', missionId).get();
  const outcomes = outcomeSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  const now = Date.now();

  let advancedCount = 0;
  if (args.advanceObservations) {
    for (const outcome of outcomes) {
      const patch = advanceOutcomeObservation(outcome, now);
      if (!patch) continue;
      advancedCount += 1;
      if (!args.dryRun) {
        await db.collection(OUTCOME_COLLECTION).doc(outcome.id).set({
          ...patch,
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
      }
      Object.assign(outcome, patch);
    }
  }

  const summary = summarizeMissionOutcomes(outcomes);

  if (args.dryRun) {
    console.log(`🧪 Mission ${missionId} outcome replay`);
    console.log(`   Outcomes: ${outcomes.length}`);
    console.log(`   Advanced observing outcomes: ${advancedCount}`);
    console.log(`   Summary: ${JSON.stringify(summary, null, 2)}`);
    return;
  }

  const patch = {
    missionId,
    updatedAt: FieldValue.serverTimestamp(),
    supervisorHeartbeatAt: FieldValue.serverTimestamp(),
    ...summary,
  };

  await db.doc(MISSION_DOC).set(patch, { merge: true });
  await db.collection('mission-runs').doc(missionId).set(patch, { merge: true });

  console.log(`✅ Mission ${missionId} outcome summary rebuilt.`);
  console.log(`   Outcomes: ${outcomes.length}`);
  console.log(`   Advanced observing outcomes: ${advancedCount}`);
}

main().catch((err) => {
  console.error('❌ Mission outcome replay failed:', err?.message || err);
  process.exit(1);
});
