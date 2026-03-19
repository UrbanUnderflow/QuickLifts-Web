import { JWT } from 'google-auth-library';

type ServiceAccountCredential = {
  projectId: string | null;
  clientEmail: string | null;
  privateKey: string | null;
};

const SECRET_CACHE = new Map<string, string>();
const SECRET_MANAGER_SCOPE = 'https://www.googleapis.com/auth/cloud-platform';

function normalizePrivateKey(value?: string): string | null {
  if (!value) return null;

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

function parseSerializedServiceAccount(raw?: string): ServiceAccountCredential | null {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as {
      project_id?: string;
      projectId?: string;
      client_email?: string;
      clientEmail?: string;
      private_key?: string;
      privateKey?: string;
    };

    return {
      projectId: parsed.project_id || parsed.projectId || null,
      clientEmail: parsed.client_email || parsed.clientEmail || null,
      privateKey: normalizePrivateKey(parsed.private_key || parsed.privateKey || undefined),
    };
  } catch (_error) {
    return null;
  }
}

function getInlineFirebasePrivateKey(): string | null {
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

function getRuntimeServiceAccountCredential(): ServiceAccountCredential | null {
  const explicit =
    parseSerializedServiceAccount(process.env.GCP_SECRET_MANAGER_SERVICE_ACCOUNT_JSON) ||
    parseSerializedServiceAccount(process.env.GCP_SERVICE_ACCOUNT_JSON);

  if (explicit?.clientEmail && explicit.privateKey) {
    return explicit;
  }

  const firebaseSerialized = parseSerializedServiceAccount(process.env.FIREBASE_SERVICE_ACCOUNT);
  if (firebaseSerialized?.clientEmail && firebaseSerialized.privateKey) {
    return firebaseSerialized;
  }

  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL || null;
  const privateKey = getInlineFirebasePrivateKey();
  const projectId =
    process.env.GOOGLE_SECRET_MANAGER_PROJECT_ID ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.GCP_PROJECT ||
    process.env.FIREBASE_PROJECT_ID ||
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

