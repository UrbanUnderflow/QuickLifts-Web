import { getSecretManagerSecret } from './secretManager';

const DEFAULT_RECALLAI_SECRET_NAME = 'RECALLAI_API_KEY';
const DEFAULT_RECALLAI_REGION = 'us-east-1';

let recallApiKeyPromise: Promise<string> | null = null;

export function getRecallAiBaseUrl() {
  return (
    process.env.RECALLAI_BASE_URL?.trim().replace(/\/$/, '') ||
    `https://${process.env.RECALLAI_REGION?.trim() || DEFAULT_RECALLAI_REGION}.recall.ai`
  );
}

export async function getRecallAiApiKey() {
  if (recallApiKeyPromise) return recallApiKeyPromise;

  recallApiKeyPromise = (async () => {
    const inlineValue = process.env.RECALLAI_API_KEY?.trim() || process.env.RECALL_API_KEY?.trim();
    if (inlineValue) return inlineValue;

    const secretName = process.env.RECALLAI_API_KEY_SECRET_NAME?.trim() || DEFAULT_RECALLAI_SECRET_NAME;
    const secretValue = (await getSecretManagerSecret(secretName)).trim();
    if (!secretValue) {
      throw new Error(`Secret Manager secret ${secretName} returned empty payload.`);
    }

    return secretValue;
  })().catch((error) => {
    recallApiKeyPromise = null;
    throw error;
  });

  return recallApiKeyPromise;
}

