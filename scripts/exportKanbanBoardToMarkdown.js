#!/usr/bin/env node

/**
 * Export Firestore `kanbanTasks` into a markdown board file at
 * project/kanban/board.md so file-based workflows can operate on
 * the same source-of-truth as the admin UI.
 */

const fs = require('fs');
const path = require('path');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const SERVICE_ACCOUNT_PATH = path.join(__dirname, '..', 'serviceAccountKey.json');

const app = initializeApp({
  credential: cert(require(SERVICE_ACCOUNT_PATH)),
}, 'export-kanban-board-md');

const db = getFirestore(app);

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function formatDate(d) {
  if (!d) return 'N/A';
  const iso = d.toISOString();
  return iso.split('T')[0];
}

async function fetchKanbanTasks() {
  const snap = await db.collection('kanbanTasks').get();
  const tasks = [];
  snap.forEach(doc => {
    const data = doc.data();
    tasks.push({ id: doc.id, ...data });
  });
  return tasks;
}

function taskToMarkdown(task) {
  const updatedAt = task.updatedAt && task.updatedAt.toDate ? task.updatedAt.toDate() : (task.updatedAt || task.createdAt || new Date());
  const createdAt = task.createdAt && task.createdAt.toDate ? task.createdAt.toDate() : (task.createdAt || new Date());

  const status = task.status || 'todo';
  const project = task.project || '';
  const theme = task.theme || '';
  const assignee = task.assignee || '';
  const lane = task.lane || '';
  const color = task.color || '';
  const objectiveCode = task.objectiveCode || '';
  const notes = (task.notes || '').replace(/\r?\n/g, '\n');

  // We keep this simple and line-oriented so downstream steps
  // can grep for STATUS: / UPDATED_AT: etc.
  return [
    `### ${task.name || '(untitled task)'} [${task.id}]`,
    '',
    `STATUS: ${status}`,
    `PROJECT: ${project}`,
    `THEME: ${theme}`,
    `ASSIGNEE: ${assignee}`,
    `LANE: ${lane}`,
    `COLOR: ${color}`,
    `OBJECTIVE_CODE: ${objectiveCode}`,
    `CREATED_AT: ${formatDate(createdAt)}`,
    `UPDATED_AT: ${formatDate(updatedAt)}`,
    notes ? `NOTES: ${notes}` : 'NOTES: ',
    '',
  ].join('\n');
}

async function main() {
  console.log('🔄 Exporting Firestore kanbanTasks → project/kanban/board.md ...');

  const tasks = await fetchKanbanTasks();
  console.log(`Found ${tasks.length} tasks.`);

  // Simple sort: newest updated first, to keep board readable.
  tasks.sort((a, b) => {
    const ad = a.updatedAt && a.updatedAt.toDate ? a.updatedAt.toDate() : (a.updatedAt || a.createdAt || new Date(0));
    const bd = b.updatedAt && b.updatedAt.toDate ? b.updatedAt.toDate() : (b.updatedAt || b.createdAt || new Date(0));
    return bd.getTime() - ad.getTime();
  });

  const lines = [
    '# Kanban Board (Exported from Firestore kanbanTasks)',
    '',
    `Exported At: ${new Date().toISOString()}`,
    '',
  ];

  for (const task of tasks) {
    lines.push(taskToMarkdown(task));
  }

  const boardDir = path.join(__dirname, '..', 'project', 'kanban');
  ensureDir(boardDir);
  const boardPath = path.join(boardDir, 'board.md');

  fs.writeFileSync(boardPath, lines.join('\n'), 'utf8');
  console.log(`✅ Wrote markdown board to ${boardPath}`);
}

main().catch(err => {
  console.error('❌ Error exporting kanban board to markdown:', err);
  process.exit(1);
});
