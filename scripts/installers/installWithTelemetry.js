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
const admin = require('firebase-admin');

const SERVICE_ACCOUNT = {
  type: "service_account",
  project_id: "quicklifts-dd3f1",
  private_key_id: "abbd015806ef3b43d93101522f12d029e736f447",
  private_key: "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDEZkOP1Kz/jfQc\nLrN2SKLVdRNCZHGHN+wcfqQXknnD47Y6GBA35O1573Ipk5FaRNvxysB/YP/Z9dLP\nOO/xk8yRA+FFI32kzQlBIpVHDVN/upfXRWS/38+1kktPD3EjwEFRB8HvYVopCm1k\nCaFOZZfrrHM2IEdboKDt3ByLoNNPLZhivcurhBm4PENNEVlyMiqqWBwTu0sFGkZ8\nLHQ4JGtaPe5VomlpVlokKmdQzEwVTWexSeQkbdXnYkd1m/sfT3mjP6RLBlXlJ4f/\nOp36QofqPxNRV7TJ/YkrL2nOLo6gq6XWS3ciVINUS9cuPlEIg+5OrR4eQUYhay3N\n5dakXn+ZAgMBAAECggEAJv+de9KB1a8E4ZG+bgbnWpaIT/8s8eo/Vrso70tVJXoy\nhZ+gnNC2/Sb4VtwoGTIiMIWPqtuCgm/HQAGw15n/HW6VTUrKWK6kH0x0MuspAOx2\n2Ta81kLldksJ7DWHRE+ZSLNPJa8BnbOl3B7zamNPAuu35vAK611eh0zVWD6Dpy1v\n7933i/pOMpvDY0ieoT0pl0GJcCVOBTS2f8z1+huepW5++G0TrTCZdq9ixCF68xEc\nyGTr1Dz/Qdv4gIO2SNk3TfKmw/HaL3tQM1izdMsJVs+nPxzmHj3tLnppyQJJFwcF\nZ1njhg6eSHPOINU/wu2KL2B+pXiROBLQr1JnvJsCZwKBgQDsYNrmbDhShYeU+OSs\nSaQx0POBeZFtlsMIbJomTSDr73Gn4ZXJaXfNoqvIuJel5SCTytK36Y+84/S3xeuy\nmXGMpfqBmEilMU5D4VOmSH/HFH6+35m1LWFw3aWSVGuUSIEQoWTKjWB9zQVwFd5w\nEw6HsuNm1IJvsEfZpzXpcydBMwKBgQDUs9cLfY93MbkT5M/WL9jbPp846HZxvzeW\nGiBR7gMAPMre32DPDKQKqnRVAvXJPhd8mKjC3T4gRm+NBWKLQjIUO0RQoVG39HN/\n9yGBTyLMccJf5d9MZe5OIwkVhbN5ekPucNhqHJQEIVz0duZ7UhFgfgLSroy/04vA\ndjgGeGxUAwKBgD+9Pkm0FNvrtcut8bujf+sO9RqMtXJfnOfAoTCCy8XTI0qpwcI1\n9mA05S2S2RGa31X68yc0i9Xbgjmr3Qqj5cKPXyVi8vPYf8o+EFheZFZCaIr/sGry\nebv9iJAUw42Qn3zkiFE2HjbN+hFnVDvUZ66fxkIMO7/yQO2n8RmqO4ORAoGAFbqV\nglf+WvfaZ1zdmoziw2r/Swn8Z5xYKl5a5OPCrLiJJQF+20f4ThqhrbmSsE9GiPTz\ncIy3dwabCLX/HijSAt0XGoGQXpF7Zxww8QvLi0UnzTIngJ99G8BagjdZYVSLMgWX\nJifrOwzJeTPYUcrNeaUF1s38FPCgezXYfVi6AE8CgYEAv+9EP3q6zY51CMtXKb04\n1yLrnZze20aUMmAQ0KE1nH9ZRk7GgT+Bbmq1Nw6Ro3xItPffX42S5w8jDhiZJK/j\neVGloaXM9MHG2uTPWSVlUJ2ew2LcYpq42PbJUuS06teFFPohMCOs7urTc0Vdya5u\ngTynFJmBFslLO3UKNPAshn0=\n-----END PRIVATE KEY-----\n",
  client_email: "firebase-adminsdk-1qxb0@quicklifts-dd3f1.iam.gserviceaccount.com",
  client_id: "111494077667496751062",
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
  auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
  client_x509_cert_url: "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-1qxb0%40quicklifts-dd3f1.iam.gserviceaccount.com",
  universe_domain: "googleapis.com"
};

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(SERVICE_ACCOUNT) });
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

  const child = spawn(command, { shell: true, env: process.env });

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
