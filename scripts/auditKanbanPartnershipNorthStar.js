#!/usr/bin/env node

/**
 * Audit kanbanTasks for blocked / stale work and seed follow-up tasks
 * aligned to the "Partnership-Led Community Growth" North Star.
 *
 * This uses the Firebase Admin SDK via the local serviceAccountKey.json
 * per .agent/workflows/firebase-admin.md.
 *
 * It does **not** try to be a generic kanban manager; it focuses on:
 *   1) Listing stale in-progress tasks (status === 'in-progress' and
 *      updatedAt older than STALE_DAYS).
 *   2) Listing any tasks whose notes contain 'BLOCKED:' as ad-hoc
 *      blocked items (until we formalize a blocked flag).
 *   3) Ensuring we have a small set of North-Star-aligned tasks in
 *      the kanban for the partnership engine, under project
 *      'Partnership-Led Community Growth'.
 */

const path = require('path');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');

const SERVICE_ACCOUNT_PATH = path.join(__dirname, '..', 'serviceAccountKey.json');

const app = initializeApp({
  credential: cert(require(SERVICE_ACCOUNT_PATH)),
}, 'audit-kanban-partnership-north-star');

const db = getFirestore(app);

const STALE_DAYS = 14;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function cutoffDate() {
  return new Date(Date.now() - STALE_DAYS * MS_PER_DAY);
}

async function fetchAllKanbanTasks() {
  const snap = await db.collection('kanbanTasks').get();
  const tasks = [];
  snap.forEach(doc => {
    const data = doc.data();
    tasks.push({ id: doc.id, ...data });
  });
  return tasks;
}

function isBlockedLike(task) {
  if (!task || typeof task.notes !== 'string') return false;
  return task.notes.toUpperCase().includes('BLOCKED:');
}

function isStaleInProgress(task, cutoff) {
  if (!task || task.status !== 'in-progress') return false;
  const updatedAt = task.updatedAt && task.updatedAt.toDate ? task.updatedAt.toDate() : (task.updatedAt || task.createdAt || new Date());
  return updatedAt < cutoff;
}

function buildNorthStarTasks() {
  // These are **planning tasks**, not production code work items.
  // They anchor the kanban to the Partnership-Led Community Growth
  // North Star and should be safe to create multiple times — we
  // will de-duplicate by `name`.
  return [
    {
      name: 'Partnership engine: verify partner onboarding pipeline end-to-end',
      description: 'Walk a test partner from invite → first round across API (/api/partners/onboard), Firestore (partners collection), and dashboard (web/app/partners/dashboard.tsx). Capture gaps that block time-to-first-round < 14 days.',
      project: 'Partnership-Led Community Growth',
      theme: 'Partnerships',
      assignee: 'Nora ⚡️',
      status: 'todo',
      lane: 'signals',
      color: 'yellow',
      objectiveCode: 'NS-PARTNERSHIP-PIPELINE',
      actOne: 'Seed test partners for brand, gym, runClub in Firestore',
      actTwo: 'Drive each to first round and log time-to-first-round',
      actThree: 'File follow-up tasks for any structural gaps found',
      notes: 'Anchored to North Star key objective #5 (repeatable partnership playbook) and time-to-active < 14 days.',
      idleThresholdMinutes: 120,
    },
    {
      name: 'Partnership metrics: wire time-to-first-round into kanban & metrics',
      description: 'Ensure time-to-first-round per partner type is visible from the admin dashboard and connect it to a kanban lane so partnership work is prioritized by unblock potential.',
      project: 'Partnership-Led Community Growth',
      theme: 'Metrics',
      assignee: 'Nora ⚡️',
      status: 'todo',
      lane: 'meanings',
      color: 'green',
      objectiveCode: 'NS-PARTNERSHIP-METRICS',
      actOne: 'Confirm time-to-first-round computation in partners dashboard',
      actTwo: 'Define metric targets per lane (brand, gym, runClub)',
      actThree: 'Expose metric summaries in Virtual Office / projectManagement',
      notes: 'Supports Objectives #2, #3, and #5 by making time-to-first-round a first-class metric for kanban decisions.',
      idleThresholdMinutes: 240,
    },
    {
      name: 'Virtual Office: surface Partnership-Led Community Growth lane',
      description: 'Create or tune a kanban lane specifically for partnership work and ensure the Virtual Office projectManagement view calls it out as the Partnership North Star lane.',
      project: 'Partnership-Led Community Growth',
      theme: 'Virtual Office',
      assignee: 'Nora ⚡️',
      status: 'todo',
      lane: 'meanings',
      color: 'blue',
      objectiveCode: 'NS-PARTNERSHIP-LANE',
      actOne: 'Define what qualifies as a Partnership North Star ticket',
      actTwo: 'Ensure existing tasks are tagged correctly or cloned into lane',
      actThree: 'Verify Virtual Office panel surfaces this lane distinctly',
      notes: 'Aligns kanban visualization with the Partnership-Led Community Growth North Star used in Virtual Office.',
      idleThresholdMinutes: 240,
    },
  ];
}

async function ensureNorthStarTasks(tasks) {
  const existingByName = new Map();
  for (const t of tasks) {
    if (t && typeof t.name === 'string') {
      existingByName.set(t.name, t);
    }
  }

  const seeds = buildNorthStarTasks();
  const toCreate = seeds.filter(seed => !existingByName.has(seed.name));

  if (!toCreate.length) {
    console.log('\n✅ North Star partnership tasks already present in kanbanTasks.');
    return;
  }

  const now = new Date();
  for (const seed of toCreate) {
    const doc = db.collection('kanbanTasks').doc();
    const payload = {
      ...seed,
      id: doc.id,
      lastWorkBeatAt: now,
      subtasks: [],
      createdAt: now,
      updatedAt: now,
    };
    await doc.set(payload);
    console.log(`   ➕ Created North Star task: ${seed.name}`);
  }
}

async function main() {
  console.log('🔍 Auditing kanbanTasks for Partnership-Led Community Growth...');

  const cutoff = cutoffDate();
  const tasks = await fetchAllKanbanTasks();

  const blocked = tasks.filter(isBlockedLike);
  const stale = tasks.filter(t => isStaleInProgress(t, cutoff));

  console.log(`\n📊 Totals: ${tasks.length} tasks, ${blocked.length} blocked-like, ${stale.length} stale in-progress (>${STALE_DAYS} days).`);

  if (blocked.length) {
    console.log('\n🚧 Blocked-like tasks (notes contain "BLOCKED:")');
    for (const t of blocked) {
      console.log(` - [${t.id}] ${t.name} — assignee: ${t.assignee || 'n/a'}`);
    }
  } else {
    console.log('\n✅ No blocked-like tasks (based on notes containing "BLOCKED:").');
  }

  if (stale.length) {
    console.log(`\n⏳ Stale in-progress tasks (updatedAt older than ${STALE_DAYS} days)`);
    for (const t of stale) {
      const updatedAt = t.updatedAt && t.updatedAt.toDate ? t.updatedAt.toDate() : (t.updatedAt || t.createdAt || new Date());
      console.log(` - [${t.id}] ${t.name} — assignee: ${t.assignee || 'n/a'}, updatedAt: ${updatedAt.toISOString()}`);
    }
  } else {
    console.log(`\n✅ No stale in-progress tasks older than ${STALE_DAYS} days.`);
  }

  console.log('\n🧭 Ensuring Partnership North Star tasks exist...');
  await ensureNorthStarTasks(tasks);

  console.log('\n✅ Kanban audit for Partnership North Star completed.');
}

main().catch(err => {
  console.error('❌ Error during kanban audit:', err);
  process.exit(1);
});
