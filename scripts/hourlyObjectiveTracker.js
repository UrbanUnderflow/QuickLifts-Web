#!/usr/bin/env node
/*
 * Hourly Objective Tracker Automation
 * ----------------------------------
 * Reads active KanBan cards, posts hourly snapshots into the Progress Timeline feed,
 * and issues/clears automated nudges when yellow/red cards miss their idle thresholds.
 */

const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

/**
 * Load .env.local / .env so firebase-admin can authenticate when the script
 * runs outside Next.js.
 */
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
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith('\'') && value.endsWith('\''))) {
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

const isDryRun = process.argv.includes('--dry-run');

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
const FieldValue = admin.firestore.FieldValue;

const STATUS_TO_BEAT = {
  todo: 'hypothesis',
  'in-progress': 'work-in-flight',
  done: 'result',
};

const LANE_DEFAULT_IDLE = {
  signals: 120,
  meanings: 45,
};

const ALERT_COLORS = new Set(['yellow', 'red']);

const AGENT_DIRECTORY = [
  { id: 'nora', displayName: 'Nora', emoji: '⚡️', aliases: ['nora', 'nora⚡️', 'nor⚡️', 'noraoperations'] },
  { id: 'scout', displayName: 'Scout', emoji: '🕵️', aliases: ['scout'] },
  { id: 'solara', displayName: 'Solara', emoji: '❤️‍🔥', aliases: ['solara'] },
  { id: 'sage', displayName: 'Sage', emoji: '🧬', aliases: ['sage'] },
  { id: 'antigravity', displayName: 'Antigravity', emoji: '🌌', aliases: ['antigravity', 'anti'] },
];

function normalizeAssignee(value = '') {
  return value
    .toLowerCase()
    .replace(/[^a-z]/g, '');
}

function resolveAgent(rawAssignee = '') {
  const normalized = normalizeAssignee(rawAssignee);
  return AGENT_DIRECTORY.find((agent) => agent.aliases.includes(normalized));
}

function minutesSince(date) {
  if (!date) return Infinity;
  return Math.floor((Date.now() - date.getTime()) / 60000);
}

function formatHourIso(date = new Date()) {
  const ms = Math.floor(date.getTime() / 3600000) * 3600000;
  return new Date(ms).toISOString();
}

function sanitizeId(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

function formatObjectiveCode(task, status) {
  const base = (task.objectiveCode || task.name || `KANBAN-${task.id.slice(-6)}`).trim().toUpperCase();
  const suffix = status === 'todo' ? 'ACTI' : status === 'in-progress' ? 'ACTII' : 'ACTIII';
  if (/\-ACT(I|II|III)$/.test(base)) return base;
  return `${base}-${suffix}`;
}

function getBeatDetails(task) {
  const status = task.status || 'in-progress';
  let beat = STATUS_TO_BEAT[status] || 'work-in-flight';
  let note = '';

  if (task.color === 'red') {
    beat = 'block';
  }

  switch (status) {
    case 'todo':
      note = task.actOne || task.description || 'Hypothesis not captured yet.';
      break;
    case 'in-progress':
      note = task.actTwo || task.description || 'Work in flight with no details yet.';
      break;
    case 'done':
      note = task.actThree || task.notes || 'Result recorded, awaiting summary.';
      break;
    default:
      note = task.notes || 'No additional context yet.';
  }

  return { beat, note };
}

async function upsertSnapshot({ agent, task, objectiveCode, beat, note, hourIso }) {
  const docId = `${sanitizeId(hourIso)}-${agent.id}-${sanitizeId(objectiveCode)}`;
  const snapshotRef = db.collection('progress-snapshots').doc(docId);
  const snapshotDoc = await snapshotRef.get();

  const payload = {
    hourIso,
    agentId: agent.id,
    agentName: agent.displayName,
    objectiveCode,
    beatCompleted: beat,
    color: task.color || 'blue',
    stateTag: task.lane || 'signals',
    note,
    createdAt: FieldValue.serverTimestamp(),
  };

  if (isDryRun) {
    console.log(`[DRY RUN] Snapshot ${snapshotDoc.exists ? 'updated' : 'created'} for ${objectiveCode} (${agent.displayName})`);
    return !snapshotDoc.exists;
  }

  if (snapshotDoc.exists) {
    await snapshotRef.update({ ...payload, createdAt: snapshotDoc.data().createdAt || FieldValue.serverTimestamp() });
    return false;
  }

  await snapshotRef.set(payload);
  return true;
}

async function fetchPendingNudge(task) {
  const snapshot = await db
    .collection('nudge-log')
    .where('objectiveCode', '==', task.objectiveCodeFormatted)
    .limit(20)
    .get();

  const docs = snapshot.docs.filter((doc) => doc.data().outcome === 'pending');
  return docs.length > 0 ? docs[0] : null;
}

async function createNudge({ agent, task, minutesSinceBeat }) {
  const message = `Idle alert: ${task.name} (${task.objectiveCodeFormatted}) has been ${minutesSinceBeat}m without a work beat (limit ${task.idleThresholdMinutes}m).`;
  const payload = {
    agentId: agent.id,
    agentName: agent.displayName,
    objectiveCode: task.objectiveCodeFormatted,
    color: task.color || 'blue',
    lane: task.lane || 'signals',
    message,
    channel: 'automation',
    outcome: 'pending',
    createdAt: FieldValue.serverTimestamp(),
  };

  if (isDryRun) {
    console.log(`[DRY RUN] Nudge => ${agent.displayName} :: ${message}`);
    return true;
  }

  await db.collection('nudge-log').add(payload);
  console.log(`Nudge issued for ${task.name} (${task.objectiveCodeFormatted}).`);
  return true;
}

async function resolvePendingNudge(pendingDoc) {
  if (!pendingDoc) return false;
  if (isDryRun) {
    console.log(`[DRY RUN] Resolving pending nudge ${pendingDoc.id}`);
    return true;
  }

  await pendingDoc.ref.update({
    outcome: 'acknowledged',
    respondedAt: FieldValue.serverTimestamp(),
  });
  console.log(`Resolved pending nudge ${pendingDoc.id}.`);
  return true;
}

async function run() {
  const snapshot = await db.collection('kanbanTasks').get();
  const now = new Date();
  const hourIso = formatHourIso(now);

  let snapshotCount = 0;
  let newNudges = 0;
  let resolvedNudges = 0;
  let skippedTasks = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const status = data.status || 'todo';
    if (status === 'done') continue; // skip completed objectives

    const agent = resolveAgent(data.assignee);
    if (!agent) {
      skippedTasks += 1;
      console.warn(`Skipping task ${data.name} — unable to resolve agent (${data.assignee || 'unknown'}).`);
      continue;
    }

    const lastBeatDate = data.lastWorkBeatAt?.toDate?.() || data.updatedAt?.toDate?.() || new Date(0);
    const minutes = minutesSince(lastBeatDate);
    const lane = data.lane || 'signals';
    const idleThreshold = data.idleThresholdMinutes || LANE_DEFAULT_IDLE[lane] || 90;
    const color = data.color || 'blue';

    const objectiveCode = formatObjectiveCode({ ...data, id: doc.id }, status);
    data.objectiveCodeFormatted = objectiveCode;

    const { beat, note } = getBeatDetails(data);

    const snapshotCreated = await upsertSnapshot({ agent, task: data, objectiveCode, beat, note, hourIso });
    if (snapshotCreated) {
      snapshotCount += 1;
      console.log(`Snapshot logged for ${agent.displayName} · ${objectiveCode} (${beat})`);
    }

    const pendingNudgeDoc = await fetchPendingNudge(data);
    const needsNudge = ALERT_COLORS.has(color) && minutes >= idleThreshold;

    if (needsNudge && !pendingNudgeDoc) {
      const created = await createNudge({ agent, task: data, minutesSinceBeat: minutes });
      if (created) newNudges += 1;
    }

    if (!needsNudge && pendingNudgeDoc) {
      const resolved = await resolvePendingNudge(pendingNudgeDoc);
      if (resolved) resolvedNudges += 1;
    }
  }

  console.log('Hourly objective tracker complete.');
  console.log(`Snapshots written: ${snapshotCount}`);
  console.log(`Nudges issued: ${newNudges}`);
  console.log(`Nudges resolved: ${resolvedNudges}`);
  if (skippedTasks > 0) {
    console.log(`Tasks skipped (unknown agent): ${skippedTasks}`);
  }
}

run()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('Hourly tracker failed:', error);
    process.exit(1);
  });
