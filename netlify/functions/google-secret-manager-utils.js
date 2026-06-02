const { GoogleAuth, JWT } = require('google-auth-library');
const firebaseCredentialSource = require('../../src/lib/server/firebase/credential-source');

const {
  parseSerializedServiceAccount,
  resolveFirebaseAdminCredential,
} = firebaseCredentialSource;

const SECRET_MANAGER_SCOPE = 'https://www.googleapis.com/auth/cloud-platform';
const SECRET_CACHE = new Map();

function getProjectIdOverride(projectId) {
  return (
    projectId
    || process.env.GOOGLE_SECRET_MANAGER_PROJECT_ID
    || process.env.GOOGLE_CLOUD_PROJECT
    || process.env.GCP_PROJECT
    || null
  );
}

function getRuntimeServiceAccountCredential() {
  const explicit =
    parseSerializedServiceAccount(process.env.GCP_SECRET_MANAGER_SERVICE_ACCOUNT_JSON)
    || parseSerializedServiceAccount(process.env.GCP_SERVICE_ACCOUNT_JSON);

  if (explicit?.clientEmail && explicit.privateKey) {
    return explicit;
  }

  const firebaseCredential = resolveFirebaseAdminCredential({ mode: 'prod' });
  if (!firebaseCredential?.clientEmail || !firebaseCredential.privateKey) {
    return null;
  }

  return {
    projectId: firebaseCredential.projectId || null,
    clientEmail: firebaseCredential.clientEmail,
    privateKey: firebaseCredential.privateKey,
  };
}

async function getExplicitServiceAccountAttempt(projectId) {
  const credential = getRuntimeServiceAccountCredential();
  if (!credential?.clientEmail || !credential.privateKey) {
    return null;
  }

  const client = new JWT({
    email: credential.clientEmail,
    key: credential.privateKey,
    scopes: [SECRET_MANAGER_SCOPE],
  });

  const accessTokenResult = await client.getAccessToken();
  const accessToken =
    typeof accessTokenResult === 'string' ? accessTokenResult : accessTokenResult?.token;

  if (!accessToken) {
    throw new Error('Failed to retrieve Secret Manager access token from explicit credentials.');
  }

  return {
    accessToken,
    projectId: getProjectIdOverride(projectId) || credential.projectId,
    authSource: 'explicit-service-account',
  };
}

async function getApplicationDefaultAttempt(projectId) {
  const auth = new GoogleAuth({ scopes: [SECRET_MANAGER_SCOPE] });
  const client = await auth.getClient();
  const accessTokenResult = await client.getAccessToken();
  const accessToken =
    typeof accessTokenResult === 'string'
      ? accessTokenResult
      : accessTokenResult?.token || accessTokenResult?.res?.data?.access_token;

  if (!accessToken) {
    throw new Error('Failed to retrieve Secret Manager access token from application default credentials.');
  }

  return {
    accessToken,
    projectId: getProjectIdOverride(projectId) || await auth.getProjectId().catch(() => null),
    authSource: 'application-default-credentials',
  };
}

async function getSecretManagerAccessAttempts(projectId) {
  const attempts = [];
  const errors = [];

  try {
    const explicitAttempt = await getExplicitServiceAccountAttempt(projectId);
    if (explicitAttempt) attempts.push(explicitAttempt);
  } catch (error) {
    errors.push(error);
  }

  try {
    attempts.push(await getApplicationDefaultAttempt(projectId));
  } catch (error) {
    errors.push(error);
  }

  if (!attempts.length) {
    throw errors[0] || new Error('Missing GCP runtime credential for Secret Manager access.');
  }

  return attempts;
}

async function getSecretManagerSecret(secretName, options = {}) {
  const normalizedName = String(secretName || '').trim();
  if (!normalizedName) {
    throw new Error('Secret name is required.');
  }

  const projectId = getProjectIdOverride(options.projectId);
  const cacheKey = `${projectId || 'default'}:${normalizedName}`;
  if (SECRET_CACHE.has(cacheKey)) {
    return SECRET_CACHE.get(cacheKey);
  }

  const attempts = await getSecretManagerAccessAttempts(projectId);
  let lastError = null;

  for (const attempt of attempts) {
    const attemptProjectId = projectId || attempt.projectId;
    if (!attemptProjectId) {
      lastError = new Error('Missing Google Cloud project id for Secret Manager access.');
      continue;
    }

    const response = await fetch(
      `https://secretmanager.googleapis.com/v1/projects/${encodeURIComponent(attemptProjectId)}/secrets/${encodeURIComponent(normalizedName)}/versions/latest:access`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${attempt.accessToken}`,
          Accept: 'application/json',
        },
      }
    );

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      lastError = new Error(payload?.error?.message || `Failed to access Secret Manager secret ${normalizedName}.`);
      if ((response.status === 401 || response.status === 403) && attempt.authSource !== 'application-default-credentials') {
        continue;
      }
      break;
    }

    const encoded = payload?.payload?.data;
    if (!encoded) {
      throw new Error(`Secret Manager secret ${normalizedName} returned empty payload.`);
    }

    const value = Buffer.from(encoded, 'base64').toString('utf8');
    SECRET_CACHE.set(cacheKey, value);
    return value;
  }

  throw lastError || new Error(`Failed to access Secret Manager secret ${normalizedName}.`);
}

module.exports = {
  getSecretManagerSecret,
  __test: {
    getRuntimeServiceAccountCredential,
  },
};
