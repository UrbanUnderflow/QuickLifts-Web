const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { GoogleAuth, JWT } = require('google-auth-library');

const outputPath = path.resolve(
  process.cwd(),
  process.env.LOCAL_SETUP_BUNDLE_OUTPUT || '.setup/local-machine-setup.bundle.enc.json'
);
const secretManagerScope = 'https://www.googleapis.com/auth/cloud-platform';

const envFiles = [
  path.resolve(process.cwd(), '.env.local'),
  path.resolve(process.cwd(), '.playwright/bootstrap.env'),
];

const envKeysToExport = [
  'NEXT_PUBLIC_DEV_FIREBASE_API_KEY',
  'NEXT_PUBLIC_DEV_FIREBASE_AUTH_DOMAIN',
  'NEXT_PUBLIC_DEV_FIREBASE_PROJECT_ID',
  'NEXT_PUBLIC_DEV_FIREBASE_STORAGE_BUCKET',
  'NEXT_PUBLIC_DEV_FIREBASE_MESSAGING_SENDER_ID',
  'NEXT_PUBLIC_DEV_FIREBASE_APP_ID',
  'NEXT_PUBLIC_FIREBASE_API_KEY',
  'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
  'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
  'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
  'NEXT_PUBLIC_FIREBASE_APP_ID',
  'FIREBASE_SERVICE_ACCOUNT',
  'FIREBASE_PROJECT_ID',
  'FIREBASE_CLIENT_EMAIL',
  'FIREBASE_SECRET_KEY',
  'FIREBASE_PRIVATE_KEY',
  'FIREBASE_PRIVATE_KEY_1',
  'FIREBASE_PRIVATE_KEY_2',
  'FIREBASE_PRIVATE_KEY_3',
  'FIREBASE_PRIVATE_KEY_4',
  'DEV_FIREBASE_PROJECT_ID',
  'DEV_FIREBASE_CLIENT_EMAIL',
  'DEV_FIREBASE_SECRET_KEY',
  'GOOGLE_SECRET_MANAGER_PROJECT_ID',
  'PLAYWRIGHT_BOOTSTRAP_SECRET_NAME',
  'PLAYWRIGHT_BOOTSTRAP_JSON',
  'PLAYWRIGHT_PULSECHECK_ORG_ID',
  'PLAYWRIGHT_PULSECHECK_TEAM_ID',
  'PLAYWRIGHT_E2E_NAMESPACE',
  'PLAYWRIGHT_BASE_URL',
  'GCP_SECRET_MANAGER_SERVICE_ACCOUNT_JSON',
  'NEXT_PUBLIC_OPENAI_API_KEY',
  'OURA_CLIENT_ID',
  'OURA_CLIENT_SECRET',
  'OURA_REDIRECT_URI',
  'OURA_SCOPES',
  'STRIPE_SECRET_KEY',
  'STRIPE_TEST_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'STRIPE_WEBHOOK_SECRET_COACH',
  'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
  'NEXT_PUBLIC_TEST_STRIPE_PUBLISHABLE_KEY',
  'STRIPE_PRICE_ATHLETE_MONTHLY',
  'STRIPE_PRICE_ATHLETE_ANNUAL',
  'STRIPE_PRICE_COACH_MONTHLY',
  'STRIPE_PRICE_COACH_ANNUAL',
  'STRIPE_PRODUCT_ATHLETE',
  'STRIPE_PRODUCT_COACH',
  'SITE_URL',
];

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function parseEnvValue(rawValue) {
  let value = rawValue.trim();

  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }

  return value.replace(/\\n/g, '\n');
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return false;
  }

  const content = fs.readFileSync(filePath, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const normalized = line.startsWith('export ') ? line.slice(7).trim() : line;
    const separatorIndex = normalized.indexOf('=');
    if (separatorIndex <= 0) continue;

    const key = normalized.slice(0, separatorIndex).trim();
    const value = parseEnvValue(normalized.slice(separatorIndex + 1));

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }

  return true;
}

function normalizePrivateKey(value) {
  if (!value) return null;

  let normalized = String(value).trim();
  if (
    (normalized.startsWith('"') && normalized.endsWith('"')) ||
    (normalized.startsWith("'") && normalized.endsWith("'"))
  ) {
    normalized = normalized.slice(1, -1);
  }

  normalized = normalized.replace(/\\\\n/g, '\n').replace(/\\n/g, '\n');
  return normalized || null;
}

function parseSerializedServiceAccount(raw) {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    return {
      projectId: parsed.project_id || parsed.projectId || null,
      clientEmail: parsed.client_email || parsed.clientEmail || null,
      privateKey: normalizePrivateKey(parsed.private_key || parsed.privateKey || null),
    };
  } catch (_error) {
    return null;
  }
}

function getInlineFirebasePrivateKey() {
  const direct = normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY || process.env.FIREBASE_SECRET_KEY);
  if (direct) return direct;

  if (process.env.FIREBASE_PRIVATE_KEY_1) {
    return normalizePrivateKey(
      [
        process.env.FIREBASE_PRIVATE_KEY_1 || '',
        process.env.FIREBASE_PRIVATE_KEY_2 || '',
        process.env.FIREBASE_PRIVATE_KEY_3 || '',
        process.env.FIREBASE_PRIVATE_KEY_4 || '',
      ].join('')
    );
  }

  return null;
}

function getRuntimeServiceAccountCredential() {
  const explicit =
    parseSerializedServiceAccount(process.env.GCP_SECRET_MANAGER_SERVICE_ACCOUNT_JSON) ||
    parseSerializedServiceAccount(process.env.GCP_SERVICE_ACCOUNT_JSON) ||
    parseSerializedServiceAccount(process.env.FIREBASE_SERVICE_ACCOUNT);

  if (explicit?.clientEmail && explicit.privateKey) {
    return explicit;
  }

  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL || null;
  const privateKey = getInlineFirebasePrivateKey();
  const projectId =
    process.env.GOOGLE_SECRET_MANAGER_PROJECT_ID ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.GCP_PROJECT ||
    process.env.FIREBASE_PROJECT_ID ||
    process.env.DEV_FIREBASE_PROJECT_ID ||
    null;

  if (!clientEmail || !privateKey) {
    return null;
  }

  return {
    projectId,
    clientEmail,
    privateKey,
  };
}

async function getSecretManagerAuth() {
  const explicitCredential = getRuntimeServiceAccountCredential();

  if (explicitCredential?.clientEmail && explicitCredential.privateKey) {
    const client = new JWT({
      email: explicitCredential.clientEmail,
      key: explicitCredential.privateKey,
      scopes: [secretManagerScope],
    });

    const accessTokenResult = await client.getAccessToken();
    const accessToken =
      typeof accessTokenResult === 'string' ? accessTokenResult : accessTokenResult?.token;

    if (!accessToken) {
      throw new Error('Failed to retrieve Secret Manager access token from explicit service-account credentials.');
    }

    return {
      accessToken,
      projectId:
        process.env.GOOGLE_SECRET_MANAGER_PROJECT_ID ||
        process.env.GOOGLE_CLOUD_PROJECT ||
        process.env.GCP_PROJECT ||
        explicitCredential.projectId,
    };
  }

  const auth = new GoogleAuth({ scopes: [secretManagerScope] });
  const client = await auth.getClient();
  const accessTokenResult = await client.getAccessToken();
  const accessToken =
    typeof accessTokenResult === 'string'
      ? accessTokenResult
      : accessTokenResult?.token || accessTokenResult?.res?.data?.access_token;
  const projectId =
    process.env.GOOGLE_SECRET_MANAGER_PROJECT_ID ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.GCP_PROJECT ||
    await auth.getProjectId().catch(() => null);

  if (!accessToken) {
    throw new Error('Failed to retrieve Secret Manager access token from application default credentials.');
  }

  return { accessToken, projectId };
}

async function getSecretManagerSecret(secretName) {
  const normalizedName = String(secretName || '').trim();
  if (!normalizedName) {
    throw new Error('Secret name is required.');
  }

  const { accessToken, projectId } = await getSecretManagerAuth();
  if (!projectId) {
    throw new Error('Missing Google Cloud project id for Secret Manager access.');
  }

  const response = await fetch(
    `https://secretmanager.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/secrets/${encodeURIComponent(normalizedName)}/versions/latest:access`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    }
  );

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error?.message || `Failed to access Secret Manager secret ${normalizedName}.`);
  }

  const encoded = payload?.payload?.data;
  if (!encoded) {
    throw new Error(`Secret Manager secret ${normalizedName} returned an empty payload.`);
  }

  return Buffer.from(encoded, 'base64').toString('utf8');
}

function requirePassphrase() {
  const passphrase = process.env.SETUP_BUNDLE_PASSPHRASE || process.env.LOCAL_SETUP_BUNDLE_PASSPHRASE;
  if (!passphrase) {
    throw new Error('Set SETUP_BUNDLE_PASSPHRASE before exporting the encrypted setup bundle.');
  }
  return passphrase;
}

function encryptPayload(payload, passphrase) {
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const key = crypto.scryptSync(passphrase, salt, 32);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const plaintext = Buffer.from(JSON.stringify(payload, null, 2), 'utf8');
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    version: 1,
    algorithm: 'aes-256-gcm',
    kdf: 'scrypt',
    salt: salt.toString('base64'),
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
    ciphertext: ciphertext.toString('base64'),
  };
}

async function resolveBootstrapJson() {
  if (process.env.PLAYWRIGHT_BOOTSTRAP_JSON) {
    return {
      source: 'PLAYWRIGHT_BOOTSTRAP_JSON',
      value: process.env.PLAYWRIGHT_BOOTSTRAP_JSON,
    };
  }

  if (process.env.PLAYWRIGHT_BOOTSTRAP_SECRET_NAME) {
    return {
      source: `Secret Manager (${process.env.PLAYWRIGHT_BOOTSTRAP_SECRET_NAME})`,
      value: await getSecretManagerSecret(process.env.PLAYWRIGHT_BOOTSTRAP_SECRET_NAME),
    };
  }

  throw new Error(
    'Cannot resolve Playwright bootstrap payload. Set PLAYWRIGHT_BOOTSTRAP_JSON or PLAYWRIGHT_BOOTSTRAP_SECRET_NAME before exporting.'
  );
}

function gatherEnvForBundle(bootstrapJson) {
  const env = {};

  for (const key of envKeysToExport) {
    if (process.env[key]) {
      env[key] = process.env[key];
    }
  }

  env.PLAYWRIGHT_BOOTSTRAP_JSON = bootstrapJson;
  delete env.PLAYWRIGHT_BOOTSTRAP_SECRET_NAME;

  return env;
}

function gatherCredentialFiles() {
  const files = {};
  const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;

  if (credentialsPath && fs.existsSync(credentialsPath)) {
    files.googleApplicationCredentials = fs.readFileSync(credentialsPath, 'utf8');
  }

  return files;
}

async function main() {
  const loadedFiles = envFiles.filter(loadEnvFile);
  const passphrase = requirePassphrase();
  const bootstrap = await resolveBootstrapJson();
  const env = gatherEnvForBundle(bootstrap.value);
  const files = gatherCredentialFiles();

  const payload = {
    version: 1,
    createdAt: new Date().toISOString(),
    sourceMachine: os.hostname(),
    loadedEnvFiles: loadedFiles,
    bootstrapSource: bootstrap.source,
    env,
    files,
  };

  ensureDir(outputPath);
  fs.writeFileSync(outputPath, JSON.stringify(encryptPayload(payload, passphrase), null, 2), 'utf8');

  console.log('');
  console.log('Encrypted local setup bundle created.');
  console.log(`Output: ${outputPath}`);
  console.log('Share this file securely with the new machine, then run the import script there.');
  console.log('');
}

main().catch((error) => {
  console.error('');
  console.error('Failed to export local machine setup bundle:', error.message || error);
  process.exit(1);
});
