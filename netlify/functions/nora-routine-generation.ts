import { Handler } from '@netlify/functions';
import { admin, db, headers as corsHeaders } from './config/firebase';
import { makeIncidentId, safeErrorBody, safeErrorResponse } from './utils/safeErrorResponse';

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

const previewText = (value: string, limit = 1200): string => {
  return value.length <= limit ? value : `${value.slice(0, limit)}...`;
};

const normalizeChatResultForSwift = (result: any): any => {
  if (!result || typeof result !== 'object') return result;
  return {
    ...result,
    system_fingerprint: result.system_fingerprint ?? ''
  };
};

const resolveFunctionOrigins = (event: Parameters<Handler>[0]): string[] => {
  const host = getHeader(event.headers, 'host') || 'fitwithpulse.ai';
  const protocol = getHeader(event.headers, 'x-forwarded-proto') || 'https';
  const requestOrigin = `${protocol}://${host}`.replace(/\/+$/, '');
  const configuredOrigins = [process.env.URL, process.env.DEPLOY_PRIME_URL]
    .map((origin) => origin?.trim().replace(/\/+$/, ''))
    .filter((origin): origin is string => Boolean(origin));

  return Array.from(new Set([requestOrigin, ...configuredOrigins]));
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

const runRoutineGenerationJobInline = async (jobId: string, workerToken: string): Promise<void> => {
  const providerApiKey = resolveOpenAIApiKey();
  const jobRef = admin.firestore().collection(JOB_COLLECTION).doc(jobId);

  try {
    if (!providerApiKey) {
      throw new Error('Missing OpenAI provider key');
    }

    const jobDoc = await jobRef.get();
    if (!jobDoc.exists) {
      throw new Error('Job not found');
    }

    const job = jobDoc.data() || {};
    if (job.workerToken !== workerToken) {
      throw new Error('Forbidden worker token');
    }
    if (job.status === 'succeeded') {
      return;
    }

    await jobRef.update({
      status: 'running',
      startedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${providerApiKey}`
      },
      body: JSON.stringify(job.request)
    });

    const responseText = await response.text();
    const contentType = response.headers.get('content-type') || '';

    if (!response.ok) {
      throw new Error(`OpenAI upstream ${response.status}: ${previewText(responseText)}`);
    }

    if (!contentType.toLowerCase().includes('application/json')) {
      throw new Error(`OpenAI upstream returned non-JSON (${contentType}): ${previewText(responseText)}`);
    }

    const result = normalizeChatResultForSwift(JSON.parse(responseText));
    await jobRef.update({
      status: 'succeeded',
      result,
      completedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
  } catch (error: any) {
    const incidentId = makeIncidentId('NORA');
    await jobRef.update({
      status: 'failed',
      errorMessage: "We couldn't generate that routine right now. Try again in a moment.",
      errorCode: 'NORA_ROUTINE_GENERATION_FAILED',
      incidentId,
      errorDetails: previewText(error?.message || 'Routine generation failed.'),
      failedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }).catch(() => {});
    throw error;
  }
};

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify(safeErrorBody('METHOD_NOT_ALLOWED', 'That request is not supported.'))
    };
  }

  const uid = await verifyAuth(getHeader(event.headers, 'authorization'));
  if (!uid) {
    return {
      statusCode: 401,
      headers: corsHeaders,
      body: JSON.stringify(safeErrorBody('AUTH_REQUIRED', 'Please sign in again.'))
    };
  }

  if (!resolveOpenAIApiKey()) {
    return safeErrorResponse({
      statusCode: 500,
      headers: corsHeaders,
      code: 'NORA_ROUTINE_GENERATION_FAILED',
      message: "We couldn't generate that routine right now. Try again in a moment.",
      source: 'nora-routine-generation.missing-provider-key',
      error: new Error('Missing OpenAI provider key'),
      db,
      context: { uid },
    });
  }

  let requestBody: any;
  try {
    requestBody = clampRoutineRequest(JSON.parse(event.body || '{}'));
  } catch (error: any) {
    return {
      statusCode: error?.statusCode || 400,
      headers: corsHeaders,
      body: JSON.stringify(safeErrorBody(
        error?.statusCode === 403 ? 'REQUEST_NOT_ALLOWED' : 'BAD_REQUEST',
        error?.statusCode === 403 ? 'That request is not allowed.' : 'That request could not be read.'
      ))
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

  const workerHeaders = {
    'Content-Type': 'application/json',
    'x-pulsecheck-internal-worker': workerToken,
    ...(getHeader(event.headers, 'x-pulsecheck-firebase-mode')
      ? { 'x-pulsecheck-firebase-mode': getHeader(event.headers, 'x-pulsecheck-firebase-mode')! }
      : {})
  };
  const workerBody = JSON.stringify({ jobId });
  let workerStarted = false;
  let lastWorkerError: Error | null = null;

  for (const origin of resolveFunctionOrigins(event)) {
    const workerUrl = `${origin}/.netlify/functions/nora-routine-generation-background`;
    try {
      const workerResponse = await fetch(workerUrl, {
        method: 'POST',
        headers: workerHeaders,
        body: workerBody
      });

      if (workerResponse.ok || workerResponse.status === 202) {
        workerStarted = true;
        break;
      }

      const responseText = await workerResponse.text().catch(() => '');
      lastWorkerError = new Error(`HTTP ${workerResponse.status} from ${workerUrl}: ${previewText(responseText)}`);
      console.error('[nora-routine-generation] Background worker start returned an error:', {
        jobId,
        workerUrl,
        message: lastWorkerError.message
      });
    } catch (error: any) {
      lastWorkerError = error instanceof Error ? error : new Error(String(error));
      console.error('[nora-routine-generation] Background worker start threw:', {
        jobId,
        workerUrl,
        message: lastWorkerError.message
      });
    }
  }

  if (!workerStarted) {
    console.error('[nora-routine-generation] Falling back to inline routine generation:', {
      jobId,
      message: lastWorkerError?.message || 'No worker start attempts succeeded.'
    });
    try {
      await runRoutineGenerationJobInline(jobId, workerToken);
    } catch (error: any) {
      console.error('[nora-routine-generation] Inline routine generation failed:', {
        jobId,
        message: error?.message
      });
    }
  }

  return {
    statusCode: 202,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ jobId, status: workerStarted ? 'queued' : 'running' })
  };
};
