#!/usr/bin/env node
'use strict';

const { initializeApp, getApps } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { resolveAdminCredential } = require('./lib/resolveAdminCredential');

function parseArgs(argv) {
  return {
    apply: argv.includes('--apply'),
    maxAgeMinutes: Number(argv.find((arg) => arg.startsWith('--max-age-minutes='))?.split('=')[1] || 60),
  };
}

function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value.toDate === 'function') return value.toDate();
  if (typeof value.seconds === 'number') return new Date(value.seconds * 1000);
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function isMacraTask(row) {
  const text = [
    row.project,
    row.product,
    row.missionId,
    row.taskTemplateId,
    row.name,
    row.description,
  ].join(' ').toLowerCase();
  return text.includes('macra') || text.includes('macra-growth-ops');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const app = getApps()[0] || initializeApp({ credential: resolveAdminCredential() }, `repair-macra-ops-${Date.now()}`);
  const db = getFirestore(app);
  const cutoffMs = Date.now() - args.maxAgeMinutes * 60_000;

  const snap = await db.collection('agent-tasks').limit(500).get();
  const candidates = snap.docs
    .map((doc) => ({ id: doc.id, ref: doc.ref, ...(doc.data() || {}) }))
    .filter(isMacraTask)
    .filter((row) => ['in-progress', 'working'].includes(String(row.status || '').toLowerCase()))
    .filter((row) => {
      const updatedAt = toDate(row.updatedAt || row.createdAt);
      return !updatedAt || updatedAt.getTime() < cutoffMs || row.runnerBlocked === true;
    });

  console.log(`Mode: ${args.apply ? 'APPLY' : 'DRY-RUN'}`);
  console.log(`Stale active Macra tasks: ${candidates.length}`);
  candidates.forEach((row) => {
    console.log(`- ${row.id} | ${row.assignee || 'unassigned'} | ${row.status || 'unknown'} | ${row.name || 'Untitled task'}`);
  });

  if (!args.apply || candidates.length === 0) return;

  const batch = db.batch();
  candidates.forEach((row) => {
    batch.update(row.ref, {
      status: 'needs-review',
      runnerBlocked: true,
      runnerFailureMessage: row.runnerFailureMessage || 'Moved out of active work by Macra ops repair because the task was stale.',
      repairedBy: 'scripts/repairMacraAgentOpsState.js',
      repairedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  });
  await batch.commit();
  console.log(`Repaired ${candidates.length} task(s).`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
