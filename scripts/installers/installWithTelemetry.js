#!/usr/bin/env node
/*
 * installWithTelemetry.js
 * -----------------------
 * Wraps a long-running install command (mas/softwareupdate/etc.) and streams
 * progress telemetry into the agent-presence document so the Virtual Office UI
 * can show live status.
 *
 * Usage:
 *   node scripts/installers/installWithTelemetry.js --agent nora \
 *        --command "~/bin/mas install 497799835"
 *
 * Notes:
 * - Requires the bundled Firebase Admin service account (same as agentRunner).
 * - Updates agent-presence/<agentId>.installProgress with command/phase/output.
 */

const { spawn } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');
const admin = require('firebase-admin');
const { resolveAdminCredential } = require('../lib/resolveAdminCredential');

if (!admin.apps.length) {
  admin.initializeApp({ credential: resolveAdminCredential() });
}
const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

function parseArgs(argv) {
  const parsed = { agent: 'nora', command: '' };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if ((arg === '--agent' || arg === '-a') && argv[i + 1]) {
      parsed.agent = argv[i + 1];
      i += 1;
    } else if ((arg === '--command' || arg === '-c') && argv[i + 1]) {
      parsed.command = argv[i + 1];
      i += 1;
    } else if (!arg.startsWith('--') && !parsed.command) {
      parsed.command = arg;
    }
  }
  return parsed;
}

const args = parseArgs(process.argv.slice(2));

if (!args.command) {
  console.error('Usage: node installWithTelemetry.js --agent nora --command "~/bin/mas install 497799835"');
  process.exit(1);
}

const defaultAskpass = path.join(os.homedir(), '.openclaw/bin/openclaw-askpass');
const askpassPath = process.env.SUDO_ASKPASS || defaultAskpass;
process.env.SUDO_ASKPASS = askpassPath;
if (!fs.existsSync(askpassPath)) {
  console.warn(`[telemetry] Warning: askpass helper not found at ${askpassPath}. sudo may still prompt for a password.`);
}

const agentId = args.agent;
const command = args.command;
const logBuffer = [];
let latestPercent = 0;
let latestMessage = 'Starting…';
let latestPhase = 'running';
let pushTimer = null;
const startedAt = new Date();

const docRef = db.collection('agent-presence').doc(agentId);

async function pushUpdate() {
  pushTimer = null;
  const payload = {
    command,
    phase: latestPhase,
    percent: Math.max(0, Math.min(100, latestPercent)),
    message: latestMessage,
    logSnippet: logBuffer.slice(-12),
    startedAt,
  };
  await docRef.set({
    installProgress: payload,
    lastUpdate: FieldValue.serverTimestamp(),
  }, { merge: true });
}

function scheduleUpdate() {
  if (pushTimer) return;
  pushTimer = setTimeout(() => {
    pushUpdate().catch(err => console.error('[telemetry] failed to update presence', err));
  }, 400);
}

function appendLog(line) {
  if (!line) return;
  const lines = line.split('\n').map(l => l.trim()).filter(Boolean);
  lines.forEach((l) => {
    logBuffer.push(l);
    if (logBuffer.length > 40) logBuffer.shift();
    const match = l.match(/(\d{1,3})%/);
    if (match) {
      const pct = parseInt(match[1], 10);
      if (!Number.isNaN(pct)) {
        latestPercent = Math.max(latestPercent, Math.min(100, pct));
      }
    }
    latestMessage = l;
  });
  scheduleUpdate();
}

async function finalize(phase, message, error) {
  latestPhase = phase;
  latestMessage = message;
  if (phase === 'completed') latestPercent = 100;
  await docRef.set({
    installProgress: {
      command,
      phase,
      percent: latestPercent,
      message,
      logSnippet: logBuffer.slice(-12),
      startedAt,
      completedAt: FieldValue.serverTimestamp(),
      error: error || '',
    },
    lastUpdate: FieldValue.serverTimestamp(),
  }, { merge: true });
}

async function run() {
  console.log(`[telemetry] Running install command for ${agentId}: ${command}`);
  await docRef.set({
    installProgress: {
      command,
      phase: 'running',
      percent: 0,
      message: 'Starting…',
      logSnippet: [],
      startedAt,
    },
    lastUpdate: FieldValue.serverTimestamp(),
  }, { merge: true });

  const child = spawn(command, { shell: true, env: { ...process.env, SUDO_ASKPASS: askpassPath } });

  child.stdout.on('data', (chunk) => {
    const text = chunk.toString();
    process.stdout.write(text);
    appendLog(text);
  });

  child.stderr.on('data', (chunk) => {
    const text = chunk.toString();
    process.stderr.write(text);
    appendLog(text);
  });

  child.on('error', async (err) => {
    console.error('[telemetry] Failed to start command', err.message);
    await finalize('failed', 'Failed to start command', err.message);
    process.exit(1);
  });

  child.on('close', async (code) => {
    if (pushTimer) {
      clearTimeout(pushTimer);
      pushTimer = null;
      await pushUpdate().catch(() => { /* ignore */ });
    }
    if (code === 0) {
      await finalize('completed', 'Install finished');
      process.exit(0);
    } else {
      const msg = `Install command exited with code ${code}`;
      await finalize('failed', msg, logBuffer.slice(-6).join('\n'));
      process.exit(code || 1);
    }
  });
}

run().catch(async (err) => {
  console.error('[telemetry] Unexpected error', err);
  await finalize('failed', 'Unexpected error', err.message || 'error');
  process.exit(1);
});
