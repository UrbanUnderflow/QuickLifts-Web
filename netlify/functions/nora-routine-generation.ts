import { Handler } from '@netlify/functions';
import { admin, headers as corsHeaders } from './config/firebase';

const JOB_COLLECTION = 'noraRoutineGenerationJobs';
const ROUTINE_MAX_TOKENS = 8000;
const ROUTINE_MODEL_PATTERN = /gpt-5-mini|gpt-5|gpt-4o|gpt-4/i;

const getHeader = (headers: Record<string, string | undefined> | undefined, headerName: string): string | undefined => {
  if (!headers) return undefined;
  const directMatch = headers[headerName];
  if (directMatch) return directMatch;
  const normalized = headerName.toLowerCase();
  const matchedKey = Object.keys(headers).find((key) => key.toLowerCase() === normalized);
  return matchedKey ? headers[matchedKey] : undefined;
};

const verifyAuth = async (authHeader: string | undefined): Promise<string | null> => {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  try {
    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    return decodedToken.uid;
  } catch (error) {
    console.error('[nora-routine-generation] Auth verification failed:', error);
    return null;
  }
};

const resolveOpenAIApiKey = (): string | null => {
  const configuredKey = process.env.OPENAI_API_KEY?.trim() || process.env.OPEN_AI_SECRET_KEY?.trim();
  return configuredKey || null;
};

const resolveFunctionOrigin = (event: Parameters<Handler>[0]): string => {
  const configuredOrigin = process.env.URL || process.env.DEPLOY_PRIME_URL;
  if (configuredOrigin) return configuredOrigin.replace(/\/+$/, '');

  const host = getHeader(event.headers, 'host') || 'fitwithpulse.ai';
  const protocol = getHeader(event.headers, 'x-forwarded-proto') || 'https';
  return `${protocol}://${host}`.replace(/\/+$/, '');
};

const clampRoutineRequest = (body: any): any => {
  const request = { ...body };

  if (request.model && !ROUTINE_MODEL_PATTERN.test(request.model)) {
    const error = new Error('Forbidden model');
    (error as any).statusCode = 403;
    throw error;
  }

  if (typeof request.max_output_tokens === 'number') {
    request.max_output_tokens = Math.min(request.max_output_tokens, ROUTINE_MAX_TOKENS);
  } else if (typeof request.max_completion_tokens === 'number') {
    request.max_completion_tokens = Math.min(request.max_completion_tokens, ROUTINE_MAX_TOKENS);
  } else if (!request.max_tokens || request.max_tokens > ROUTINE_MAX_TOKENS) {
    request.max_tokens = ROUTINE_MAX_TOKENS;
  }

  return JSON.parse(JSON.stringify(request));
};

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  const uid = await verifyAuth(getHeader(event.headers, 'authorization'));
  if (!uid) {
    return {
      statusCode: 401,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Unauthorized: Missing or invalid Firebase token' })
    };
  }

  if (!resolveOpenAIApiKey()) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'OpenAI routine generation is misconfigured: missing provider key' })
    };
  }

  let requestBody: any;
  try {
    requestBody = clampRoutineRequest(JSON.parse(event.body || '{}'));
  } catch (error: any) {
    return {
      statusCode: error?.statusCode || 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: error?.message || 'Bad Request: Invalid JSON payload' })
    };
  }

  const jobId = crypto.randomUUID();
  const workerToken = crypto.randomUUID();
  const now = admin.firestore.FieldValue.serverTimestamp();
  const jobRef = admin.firestore().collection(JOB_COLLECTION).doc(jobId);

  await jobRef.set({
    ownerId: uid,
    status: 'queued',
    request: requestBody,
    workerToken,
    createdAt: now,
    updatedAt: now,
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
    model: requestBody.model || null
  });

  const workerUrl = `${resolveFunctionOrigin(event)}/.netlify/functions/nora-routine-generation-background`;
  try {
    await fetch(workerUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-pulsecheck-internal-worker': workerToken,
        ...(getHeader(event.headers, 'x-pulsecheck-firebase-mode')
          ? { 'x-pulsecheck-firebase-mode': getHeader(event.headers, 'x-pulsecheck-firebase-mode')! }
          : {})
      },
      body: JSON.stringify({ jobId })
    });
  } catch (error: any) {
    console.error('[nora-routine-generation] Failed to start background worker:', error);
    await jobRef.update({
      status: 'failed',
      errorMessage: 'Routine generation worker failed to start.',
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    return {
      statusCode: 502,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Routine generation worker failed to start' })
    };
  }

  return {
    statusCode: 202,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ jobId, status: 'queued' })
  };
};
