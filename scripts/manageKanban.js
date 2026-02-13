const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

function loadLocalEnv() {
  const envFiles = ['.env.local', '.env'];
  for (const file of envFiles) {
    const envPath = path.join(__dirname, '..', file);
    if (!fs.existsSync(envPath)) continue;

    const lines = fs.readFileSync(envPath, 'utf-8').split(/\r?\n/);
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;

      const sanitized = line.startsWith('export ') ? line.replace(/^export\s+/, '') : line;
      const [key, ...rest] = sanitized.split('=');
      if (!key || rest.length === 0) continue;

      let value = rest.join('=').trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }

      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  }
}

loadLocalEnv();

function getEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

const serviceAccount = {
  project_id: getEnv('FIREBASE_PROJECT_ID'),
  client_email: getEnv('FIREBASE_CLIENT_EMAIL'),
  private_key: getEnv('FIREBASE_SECRET_KEY').replace(/\\n/g, '\n'),
};

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      project_id: serviceAccount.project_id,
      client_email: serviceAccount.client_email,
      private_key: serviceAccount.private_key,
    }),
  });
}

const db = admin.firestore();
const now = admin.firestore.Timestamp.now();

const makeSubtask = (title) => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  title,
  completed: false,
  createdAt: now,
});

const tasks = [
  {
    name: 'Stand up Research Intel Feed pipeline',
    description: 'Design the living intel feed the new researcher will own: real-time drops, urgent flags, daily skim summaries, and a weekly digest tied to Tremaine’s “why now” questions.',
    project: 'Strategic Ops',
    theme: 'Insights',
    assignee: 'Nora ⚡️',
    status: 'todo',
    notes: 'Outcome from Feb 11 roundtable; scoped in docs/kanban-task-plan-2026-02-11.md. Need structure before researcher onboarding.',
    subtasks: [
      'Define feed taxonomy (source, why-now signal, urgency, owner, status)',
      'Draft urgent-vs-weekly escalation rules + notification path',
      'Create weekly digest template + cadence notes for Tremaine/leadership',
      'Document handoff checklist for incoming researcher + Kanban lane plugs',
    ].map(makeSubtask),
  },
  {
    name: 'Build Pulse systems overview',
    description: 'Create a single source of truth covering every repo, environments, release branches, and responsible owners. Include Firestore collections + tooling references for onboarding.',
    project: 'Strategic Ops',
    theme: 'Foundations',
    assignee: 'Nora ⚡️',
    status: 'in-progress',
    notes: 'Draft doc created (Feb 11). Next: Loom walkthrough + add release checklist appendix.',
    subtasks: [
      'Map Android/iOS/Web/PulseCheck repos',
      'Document environments + release steps',
      'Publish overview & share in admin board',
    ].map(makeSubtask),
  },
  {
    name: 'Repository digests + open threads',
    description: 'Summarize each codebase with current features, known gaps, and blockers so Tremaine can see priorities at a glance.',
    project: 'Strategic Ops',
    theme: 'Insights',
    assignee: 'Nora ⚡️',
    status: 'todo',
    notes: 'Deliverable: founder brief + board-ready backlog with next steps.',
    subtasks: [
      'Pulse-Android findings',
      'QuickLifts iOS + PulseCheck findings',
      'QuickLifts-Web creator tooling findings',
    ].map(makeSubtask),
  },
  {
    name: 'ChatGPT history ingestion',
    description: 'Parse Tremaine’s exported ChatGPT history into a structured knowledge base once the export is shared. Blocked until files arrive.',
    project: 'Knowledge Base',
    theme: 'Research',
    assignee: 'Nora ⚡️',
    status: 'todo',
    notes: 'Blocked waiting on export link. Once shared, parse + slot into overview.',
    subtasks: [
      'Receive export from Tremaine',
      'Tag insights + decisions',
      'Publish searchable notes',
    ].map(makeSubtask),
  },
];

async function upsertTask(task) {
  const snapshot = await db
    .collection('kanbanTasks')
    .where('name', '==', task.name)
    .limit(1)
    .get();

  const payload = {
    name: task.name,
    description: task.description,
    project: task.project,
    theme: task.theme,
    assignee: task.assignee,
    status: task.status,
    subtasks: task.subtasks,
    updatedAt: now,
  };

  if (snapshot.empty) {
    await db.collection('kanbanTasks').add({
      ...payload,
      createdAt: now,
    });
    console.log(`Created task: ${task.name}`);
  } else {
    await snapshot.docs[0].ref.update(payload);
    console.log(`Updated existing task: ${task.name}`);
  }
}

(async () => {
  try {
    for (const task of tasks) {
      await upsertTask(task);
    }
    console.log('Kanban tasks synced.');
    process.exit(0);
  } catch (error) {
    console.error('Error syncing Kanban tasks:', error);
    process.exit(1);
  }
})();
