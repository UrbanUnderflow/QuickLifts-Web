'use strict';

/**
 * Shared Firebase Admin credential resolver for standalone scripts.
 *
 * NO PRIVATE KEY IS EVER HARDCODED HERE. Provide credentials via one of the
 * following sources (checked in priority order):
 *
 *   1. ./serviceAccountKey.json at the repo root (gitignored)
 *   2. FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON env — full service-account JSON
 *      string (raw or base64-encoded)
 *   3. GOOGLE_APPLICATION_CREDENTIALS env — path to a key file (ADC)
 *   4. FIREBASE_ADMIN_PRIVATE_KEY (+ optional FIREBASE_ADMIN_CLIENT_EMAIL /
 *      FIREBASE_ADMIN_PROJECT_ID) — legacy private-key-only env. The client
 *      email and project id are non-secret identifiers and default to the
 *      production service account below.
 *   5. Google Secret Manager — last resort. If `gcloud` is installed and
 *      authenticated, the full service-account JSON is fetched from the secret
 *      named by FIREBASE_ADMIN_SECRET_NAME (default
 *      "FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON") in project
 *      FIREBASE_ADMIN_SECRET_PROJECT (default "quicklifts-dd3f1"). This lets
 *      the Admin SDK work with NO key on disk — auth comes from the developer's
 *      own `gcloud auth application-default login` identity. Set
 *      FIREBASE_ADMIN_SKIP_SECRET_MANAGER=1 to disable.
 *
 * If none are present the process exits with a clear error instead of falling
 * back to an embedded key.
 *
 * Usage:
 *   const { resolveAdminCredential } = require('./lib/resolveAdminCredential');
 *   const { initializeApp } = require('firebase-admin/app');
 *   const app = initializeApp({ credential: resolveAdminCredential() }, 'my-script');
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { cert, applicationDefault } = require('firebase-admin/app');

const DEFAULT_SECRET_NAME = 'FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON';

// Non-secret identifiers for the production service account. Rotating the key
// does NOT change these, so it is safe to keep them as defaults.
const DEFAULT_PROJECT_ID = 'quicklifts-dd3f1';
const DEFAULT_CLIENT_EMAIL =
  'firebase-adminsdk-1qxb0@quicklifts-dd3f1.iam.gserviceaccount.com';

function normalizePrivateKey(value) {
  if (!value || typeof value !== 'string') return null;
  let normalized = value.trim();
  if (
    (normalized.startsWith('"') && normalized.endsWith('"')) ||
    (normalized.startsWith("'") && normalized.endsWith("'"))
  ) {
    normalized = normalized.slice(1, -1);
  }
  normalized = normalized.replace(/\\\\n/g, '\n').replace(/\\n/g, '\n');
  return normalized || null;
}

function tryServiceAccountFile() {
  // Repo root is one level up from scripts/.
  const keyPath = path.join(__dirname, '..', '..', 'serviceAccountKey.json');
  if (!fs.existsSync(keyPath)) return null;
  return { credential: cert(require(keyPath)), source: 'serviceAccountKey.json' };
}

function tryServiceAccountJsonEnv() {
  const raw = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;

  const candidates = [raw];
  try {
    candidates.push(Buffer.from(raw, 'base64').toString('utf8'));
  } catch (_err) {
    // ignore invalid base64 and fall through to the raw value
  }

  for (const candidate of candidates) {
    let parsed;
    try {
      parsed = JSON.parse(candidate);
    } catch (_err) {
      continue;
    }
    const privateKey = normalizePrivateKey(parsed.private_key || parsed.privateKey);
    const clientEmail = parsed.client_email || parsed.clientEmail;
    const projectId = parsed.project_id || parsed.projectId || DEFAULT_PROJECT_ID;
    if (privateKey && clientEmail) {
      return {
        credential: cert({ projectId, clientEmail, privateKey }),
        source: 'FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON',
      };
    }
  }
  return null;
}

function tryApplicationDefault() {
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) return null;
  return { credential: applicationDefault(), source: 'GOOGLE_APPLICATION_CREDENTIALS' };
}

function tryLegacyPrivateKeyEnv() {
  const privateKey = normalizePrivateKey(process.env.FIREBASE_ADMIN_PRIVATE_KEY);
  if (!privateKey) return null;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL || DEFAULT_CLIENT_EMAIL;
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || DEFAULT_PROJECT_ID;
  return {
    credential: cert({ projectId, clientEmail, privateKey }),
    source: 'FIREBASE_ADMIN_PRIVATE_KEY',
  };
}

function tryGoogleSecretManager() {
  if (process.env.FIREBASE_ADMIN_SKIP_SECRET_MANAGER === '1') return null;

  const secretName = process.env.FIREBASE_ADMIN_SECRET_NAME || DEFAULT_SECRET_NAME;
  const project = process.env.FIREBASE_ADMIN_SECRET_PROJECT || DEFAULT_PROJECT_ID;

  let json;
  try {
    json = execFileSync(
      'gcloud',
      [
        'secrets',
        'versions',
        'access',
        'latest',
        `--secret=${secretName}`,
        `--project=${project}`,
      ],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    );
  } catch (_err) {
    // gcloud missing, not authenticated, or no access — fall through to error.
    return null;
  }

  let parsed;
  try {
    parsed = JSON.parse(json);
  } catch (_err) {
    return null;
  }

  const privateKey = normalizePrivateKey(parsed.private_key || parsed.privateKey);
  const clientEmail = parsed.client_email || parsed.clientEmail;
  const projectId = parsed.project_id || parsed.projectId || project;
  if (!privateKey || !clientEmail) return null;

  return {
    credential: cert({ projectId, clientEmail, privateKey }),
    source: `Secret Manager (${secretName})`,
  };
}

/**
 * Resolve a Firebase Admin credential from an external source.
 * @param {{ quiet?: boolean }} [opts]
 * @returns {import('firebase-admin/app').Credential}
 */
function resolveAdminCredential(opts = {}) {
  const resolved =
    tryServiceAccountFile() ||
    tryServiceAccountJsonEnv() ||
    tryApplicationDefault() ||
    tryLegacyPrivateKeyEnv() ||
    tryGoogleSecretManager();

  if (!resolved) {
    console.error(
      '❌ No Firebase Admin credentials found. Provide one of:\n' +
        '   - serviceAccountKey.json at the repo root (gitignored), or\n' +
        '   - FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON (full service-account JSON), or\n' +
        '   - GOOGLE_APPLICATION_CREDENTIALS (path to a key file), or\n' +
        '   - FIREBASE_ADMIN_PRIVATE_KEY (private key only), or\n' +
        '   - an authenticated `gcloud` (Secret Manager: FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON\n' +
        '     in quicklifts-dd3f1) — run `gcloud auth application-default login`.\n' +
        '   See .agent/workflows/firebase-admin.md.',
    );
    process.exit(1);
  }

  if (!opts.quiet) {
    console.log(`🔑 Firebase Admin credential source: ${resolved.source}`);
  }
  return resolved.credential;
}

module.exports = { resolveAdminCredential, DEFAULT_PROJECT_ID, DEFAULT_CLIENT_EMAIL };
