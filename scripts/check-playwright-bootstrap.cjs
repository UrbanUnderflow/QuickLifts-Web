const fs = require('fs');
const path = require('path');
const { GoogleAuth, JWT } = require('google-auth-library');

const secretManagerScope = 'https://www.googleapis.com/auth/cloud-platform';
const envFiles = [
  path.resolve(process.cwd(), '.env.local'),
  path.resolve(process.cwd(), '.playwright/bootstrap.env'),
];

function printHeader(title) {
  console.log('');
  console.log(title);
  console.log('='.repeat(title.length));
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
      authSource: 'explicit service-account env',
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

  return {
    accessToken,
    projectId,
    authSource: 'application default credentials',
  };
}

async function getSecretManagerSecret(secretName) {
  const normalizedName = String(secretName || '').trim();
  if (!normalizedName) {
    throw new Error('Secret name is required.');
  }

  const { accessToken, projectId, authSource } = await getSecretManagerAuth();
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

  return {
    value: Buffer.from(encoded, 'base64').toString('utf8'),
    projectId,
    authSource,
  };
}

function parseBootstrapConfig(raw) {
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(`Failed to parse Playwright bootstrap JSON: ${error.message}`);
  }

  const adminEmail = (parsed.adminEmail || parsed.email || '').trim().toLowerCase();
  const adminUid = (parsed.adminUid || parsed.uid || '').trim();
  const nextPath = (parsed.nextPath || parsed.path || '/admin/systemOverview#variant-registry').trim();

  if (!adminEmail && !adminUid) {
    throw new Error('Bootstrap JSON must include `adminEmail` or `adminUid`.');
  }

  return {
    adminEmail: adminEmail || null,
    adminUid: adminUid || null,
    nextPath: nextPath || '/admin/systemOverview#variant-registry',
    organizationId: (parsed.pulseCheckOrganizationId || parsed.organizationId || '').trim() || null,
    teamId: (parsed.pulseCheckTeamId || parsed.teamId || '').trim() || null,
    namespace: (parsed.playwrightNamespace || parsed.namespace || '').trim() || null,
  };
}

function reportStatus(label, ok, detail) {
  const marker = ok ? '[ok]' : '[fail]';
  console.log(`${marker} ${label}${detail ? `: ${detail}` : ''}`);
}

async function main() {
  printHeader('Playwright Bootstrap Check');

  const loadedFiles = envFiles.filter(loadEnvFile);
  reportStatus('Loaded env files', true, loadedFiles.length ? loadedFiles.join(', ') : 'none');

  printHeader('Dev Firebase Public Env');
  const requiredDevVars = [
    'NEXT_PUBLIC_DEV_FIREBASE_API_KEY',
    'NEXT_PUBLIC_DEV_FIREBASE_AUTH_DOMAIN',
    'NEXT_PUBLIC_DEV_FIREBASE_PROJECT_ID',
    'NEXT_PUBLIC_DEV_FIREBASE_STORAGE_BUCKET',
    'NEXT_PUBLIC_DEV_FIREBASE_MESSAGING_SENDER_ID',
    'NEXT_PUBLIC_DEV_FIREBASE_APP_ID',
  ];

  const failures = [];
  for (const key of requiredDevVars) {
    const ok = Boolean(process.env[key]);
    reportStatus(key, ok, ok ? 'present' : 'missing');
    if (!ok) failures.push(`${key} is missing`);
  }

  printHeader('Playwright Bootstrap Source');
  const bootstrapSecretName = process.env.PLAYWRIGHT_BOOTSTRAP_SECRET_NAME || '';
  const bootstrapJson = process.env.PLAYWRIGHT_BOOTSTRAP_JSON || '';

  let bootstrapConfig = null;
  if (bootstrapJson) {
    try {
      bootstrapConfig = parseBootstrapConfig(bootstrapJson);
      reportStatus('PLAYWRIGHT_BOOTSTRAP_JSON', true, 'present and parseable');
    } catch (error) {
      reportStatus('PLAYWRIGHT_BOOTSTRAP_JSON', false, error.message);
      failures.push(error.message);
    }
  } else if (bootstrapSecretName) {
    try {
      const secretResult = await getSecretManagerSecret(bootstrapSecretName);
      bootstrapConfig = parseBootstrapConfig(secretResult.value);
      reportStatus('PLAYWRIGHT_BOOTSTRAP_SECRET_NAME', true, bootstrapSecretName);
      reportStatus('Secret Manager access', true, `${secretResult.projectId} via ${secretResult.authSource}`);
    } catch (error) {
      reportStatus('Secret Manager access', false, error.message);
      failures.push(error.message);
    }
  } else {
    reportStatus('Bootstrap source', false, 'Set PLAYWRIGHT_BOOTSTRAP_SECRET_NAME or PLAYWRIGHT_BOOTSTRAP_JSON');
    failures.push('No Playwright bootstrap source configured.');
  }

  if (bootstrapConfig) {
    reportStatus(
      'Bootstrap payload',
      true,
      `admin=${bootstrapConfig.adminEmail || bootstrapConfig.adminUid}; next=${bootstrapConfig.nextPath}`
    );
    if (bootstrapConfig.organizationId && bootstrapConfig.teamId) {
      reportStatus('PulseCheck target ids', true, `${bootstrapConfig.organizationId} / ${bootstrapConfig.teamId}`);
    } else {
      reportStatus('PulseCheck target ids', true, 'not included in bootstrap payload');
    }
  }

  printHeader('Firebase Admin Token Mint');
  if (bootstrapConfig) {
    try {
      const { getFirebaseAdminApp } = require('../netlify/functions/config/firebase');
      const request = {
        headers: {
          origin: 'http://localhost:3000',
          referer: 'http://localhost:3000',
          'x-force-dev-firebase': 'true',
        },
      };
      const adminApp = getFirebaseAdminApp(request);
      const adminAuth = adminApp.auth();
      const userRecord = bootstrapConfig.adminUid
        ? await adminAuth.getUser(bootstrapConfig.adminUid)
        : await adminAuth.getUserByEmail(bootstrapConfig.adminEmail);

      await adminAuth.createCustomToken(userRecord.uid, {
        playwrightBootstrapCheck: true,
      });

      reportStatus('Bootstrap admin lookup', true, `${userRecord.uid} (${userRecord.email || 'no email'})`);
      reportStatus('Firebase custom token mint', true, 'working');
    } catch (error) {
      reportStatus('Firebase custom token mint', false, error.message);
      failures.push(`Firebase Admin token mint failed: ${error.message}`);
    }
  } else {
    reportStatus('Firebase custom token mint', false, 'skipped because bootstrap payload is unavailable');
  }

  printHeader('Helpful Next Commands');
  console.log('npm run test:e2e:install');
  console.log('npm run test:e2e:auth');
  console.log('source .playwright/bootstrap.env');
  console.log('npm run test:e2e:smoke -- tests/e2e/pulsecheck-onboarding-workspace.spec.ts');

  if (failures.length) {
    printHeader('Result');
    console.log('Bootstrap check failed.');
    for (const failure of failures) {
      console.log(`- ${failure}`);
    }
    process.exit(1);
  }

  printHeader('Result');
  console.log('Bootstrap check passed.');
}

main().catch((error) => {
  console.error('');
  console.error('[fatal] Playwright bootstrap check crashed:', error);
  process.exit(1);
});
