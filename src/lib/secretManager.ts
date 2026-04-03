import { GoogleAuth, JWT } from 'google-auth-library';
import firebaseCredentialSource from './server/firebase/credential-source';

type ServiceAccountCredential = {
  projectId: string | null;
  clientEmail: string | null;
  privateKey: string | null;
};

const {
  parseSerializedServiceAccount,
  resolveFirebaseAdminCredential,
} = firebaseCredentialSource as {
  parseSerializedServiceAccount: (raw?: string) => ServiceAccountCredential | null;
  resolveFirebaseAdminCredential: (options?: Record<string, unknown>) => ServiceAccountCredential & { source: string; mode: string };
};

const SECRET_CACHE = new Map<string, string>();
const SECRET_MANAGER_SCOPE = 'https://www.googleapis.com/auth/cloud-platform';

function getRuntimeServiceAccountCredential(): ServiceAccountCredential | null {
  const explicit =
    parseSerializedServiceAccount(process.env.GCP_SECRET_MANAGER_SERVICE_ACCOUNT_JSON) ||
    parseSerializedServiceAccount(process.env.GCP_SERVICE_ACCOUNT_JSON);

  if (explicit?.clientEmail && explicit.privateKey) {
    return explicit;
  }

  const firebaseCredential = resolveFirebaseAdminCredential({ mode: 'prod' });
  if (!firebaseCredential?.clientEmail || !firebaseCredential.privateKey) {
    return null;
  }

  return {
    projectId:
      process.env.GOOGLE_SECRET_MANAGER_PROJECT_ID ||
      process.env.GOOGLE_CLOUD_PROJECT ||
      process.env.GCP_PROJECT ||
      firebaseCredential.projectId ||
      null,
    clientEmail: firebaseCredential.clientEmail,
    privateKey: firebaseCredential.privateKey,
  };
}

async function getSecretManagerAccessToken() {
  const projectIdOverride =
    process.env.GOOGLE_SECRET_MANAGER_PROJECT_ID ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.GCP_PROJECT ||
    null;

  const explicitCredential = getRuntimeServiceAccountCredential();
  const errors: string[] = [];

  if (explicitCredential?.clientEmail && explicitCredential.privateKey) {
    try {
      const client = new JWT({
        email: explicitCredential.clientEmail,
        key: explicitCredential.privateKey,
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
        projectId: projectIdOverride || explicitCredential.projectId,
        authSource: 'explicit-service-account',
      };
    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'Unknown explicit credential error');
    }
  }

  try {
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

    const projectId = projectIdOverride || (await auth.getProjectId().catch(() => null));

    return {
      accessToken,
      projectId,
      authSource: 'application-default-credentials',
    };
  } catch (error) {
    errors.push(error instanceof Error ? error.message : 'Unknown ADC error');
  }

  throw new Error(
    errors[0] ||
      'Missing GCP runtime credential for Secret Manager access. Expected Firebase or GCP service-account env vars, or working ADC on the machine.'
  );
}

export async function getSecretManagerSecret(secretName: string): Promise<string> {
  const normalizedName = secretName.trim();
  if (!normalizedName) {
    throw new Error('Secret name is required.');
  }

  if (SECRET_CACHE.has(normalizedName)) {
    return SECRET_CACHE.get(normalizedName) as string;
  }

  const attempts = [await getSecretManagerAccessToken()];

  if (attempts[0].authSource !== 'application-default-credentials') {
    try {
      const auth = new GoogleAuth({ scopes: [SECRET_MANAGER_SCOPE] });
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

      if (accessToken) {
        attempts.push({
          accessToken,
          projectId,
          authSource: 'application-default-credentials',
        });
      }
    } catch {
      // Ignore ADC fallback setup errors here; primary attempt errors will surface below if needed.
    }
  }

  let lastError: Error | null = null;

  for (const attempt of attempts) {
    if (!attempt.projectId) {
      lastError = new Error('Missing Google Cloud project id for Secret Manager access.');
      continue;
    }

    const response = await fetch(
      `https://secretmanager.googleapis.com/v1/projects/${encodeURIComponent(attempt.projectId)}/secrets/${encodeURIComponent(normalizedName)}/versions/latest:access`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${attempt.accessToken}`,
          Accept: 'application/json',
        },
      }
    );

    const payload = (await response.json().catch(() => ({}))) as {
      payload?: { data?: string };
      error?: { message?: string };
    };

    if (!response.ok) {
      lastError = new Error(payload.error?.message || `Failed to access Secret Manager secret ${normalizedName}.`);
      const isPermissionIssue = response.status === 401 || response.status === 403;
      if (isPermissionIssue && attempt.authSource !== 'application-default-credentials') {
        continue;
      }
      break;
    }

    const encoded = payload.payload?.data;
    if (!encoded) {
      throw new Error(`Secret Manager secret ${normalizedName} returned empty payload.`);
    }

    const value = Buffer.from(encoded, 'base64').toString('utf8');
    SECRET_CACHE.set(normalizedName, value);
    return value;
  }

  throw lastError || new Error(`Failed to access Secret Manager secret ${normalizedName}.`);
}
