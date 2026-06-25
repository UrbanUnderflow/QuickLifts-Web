#!/usr/bin/env node
'use strict';

/**
 * Defers stale non-Macra open agent tasks without deleting them.
 *
 * Dry run:
 *   node scripts/deferNonMacraAgentTasks.js
 *
 * Apply:
 *   node scripts/deferNonMacraAgentTasks.js --commit
 */

const { initializeApp, getApps } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { resolveAdminCredential } = require('./lib/resolveAdminCredential');

const COMMIT = process.argv.includes('--commit') || process.argv.includes('--apply');
const TASKS_COLLECTION = 'agent-tasks';
const MACRA_SOURCE = 'macra-mission-seed-2026-06-25';
const MACRA_MISSION_ID = 'macra-growth-os-2026-06-25';
const REASON = 'Deferred during 2026-06-25 Macra mission reset so agents focus on Macra operating tasks.';
const OPEN_STATUSES = ['todo', 'in-progress'];

function isMacraTask(task) {
  return (
    task.source === MACRA_SOURCE ||
    task.missionId === MACRA_MISSION_ID ||
    task.project === 'Macra' ||
    String(task.name || '').toLowerCase().includes('macra')
  );
}

async function loadOpenTasks(db) {
  const snap = await db.collection(TASKS_COLLECTION)
    .where('status', 'in', OPEN_STATUSES)
    .get();
  return snap.docs.map((doc) => ({ id: doc.id, ref: doc.ref, data: doc.data() || {} }));
}

async function main() {
  const app = getApps().length
    ? getApps()[0]
    : initializeApp({ credential: resolveAdminCredential() }, 'defer-non-macra-agent-tasks');
  const db = getFirestore(app);

  const rows = await loadOpenTasks(db);
  const stale = rows.filter((row) => !isMacraTask(row.data));
  const keep = rows.filter((row) => isMacraTask(row.data));

  const byStatus = stale.reduce((acc, row) => {
    const status = row.data.status || 'unknown';
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {});

  console.log(`${COMMIT ? 'Applying' : 'Dry run'} non-Macra task deferral...`);
  console.log(`Open tasks scanned: ${rows.length}`);
  console.log(`Keeping Macra tasks: ${keep.length}`);
  console.log(`Deferring non-Macra tasks: ${stale.length}`, byStatus);

  const preview = stale.slice(0, 20).map((row) => ({
    id: row.id,
    assignee: row.data.assignee,
    status: row.data.status,
    source: row.data.source || '',
    missionId: row.data.missionId || '',
    name: row.data.name,
  }));
  console.log(JSON.stringify({ preview }, null, 2));

  if (!COMMIT) {
    console.log('No writes made. Re-run with --commit to apply.');
    return;
  }

  let updated = 0;
  for (const row of stale) {
    await row.ref.set({
      status: 'needs-review',
      runnerBlocked: true,
      deferredByMacraMissionReset: true,
      deferredAt: FieldValue.serverTimestamp(),
      deferredReason: REASON,
      previousStatusBeforeMacraDeferral: row.data.status || '',
      previousMissionIdBeforeMacraDeferral: row.data.missionId || '',
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    updated += 1;
  }

  console.log(`Deferred ${updated} non-Macra open tasks.`);
}

main().catch((error) => {
  console.error('Failed to defer non-Macra agent tasks:', error);
  process.exit(1);
});
