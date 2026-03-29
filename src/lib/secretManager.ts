import { JWT } from 'google-auth-library';
import firebaseCredentialSource from './server/firebase/credential-source';

type ServiceAccountCredential = {
  projectId: string | null;
  clientEmail: string | null;
  privateKey: string | null;
};

const {
  normalizePrivateKey,
  parseSerializedServiceAccount,
  resolveFirebaseAdminCredential,
} = firebaseCredentialSource as {
  normalizePrivateKey: (value?: string) => string | null;
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
  const credential = getRuntimeServiceAccountCredential();
  if (!credential?.clientEmail || !credential.privateKey) {
    throw new Error(
      'Missing GCP runtime credential for Secret Manager access. Expected Firebase or GCP service-account env vars.'
    );
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
    throw new Error('Failed to retrieve Secret Manager access token.');
  }

  return {
    accessToken,
    projectId:
      process.env.GOOGLE_SECRET_MANAGER_PROJECT_ID ||
      process.env.GOOGLE_CLOUD_PROJECT ||
      process.env.GCP_PROJECT ||
      credential.projectId,
  };
}

export async function getSecretManagerSecret(secretName: string): Promise<string> {
  const normalizedName = secretName.trim();
  if (!normalizedName) {
    throw new Error('Secret name is required.');
  }

  if (SECRET_CACHE.has(normalizedName)) {
    return SECRET_CACHE.get(normalizedName) as string;
  }

  const { accessToken, projectId } = await getSecretManagerAccessToken();
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

  const payload = (await response.json().catch(() => ({}))) as {
    payload?: { data?: string };
    error?: { message?: string };
  };

  if (!response.ok) {
    throw new Error(payload.error?.message || `Failed to access Secret Manager secret ${normalizedName}.`);
  }

  const encoded = payload.payload?.data;
  if (!encoded) {
    throw new Error(`Secret Manager secret ${normalizedName} returned empty payload.`);
  }

  const value = Buffer.from(encoded, 'base64').toString('utf8');
  SECRET_CACHE.set(normalizedName, value);
  return value;
}
