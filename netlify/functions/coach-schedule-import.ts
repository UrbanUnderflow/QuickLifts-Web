import type { Handler } from '@netlify/functions';
import {
  requirePulseCheckScheduleAccess,
} from '../../src/lib/server/pulsecheckScheduleAccess';
import { admin, db, headers as corsHeaders } from './config/firebase';
import {
  buildScheduleExtractionRequest,
  normalizeScheduleImportSource,
  type ScheduleImportSource,
} from './utils/coachScheduleImportContract';
import {
  makeIncidentId,
  safeErrorBody,
  safeErrorResponse,
} from './utils/safeErrorResponse';

const {
  verifyFirebaseUser,
} = require('./lib/pulsecheck-coach-services');

const JOB_COLLECTION = 'coachScheduleImportJobs';

const getHeader = (
  headers: Record<string, string | undefined> | undefined,
  headerName: string
): string | undefined => {
  if (!headers) return undefined;
  const directMatch = headers[headerName];
  if (directMatch) return directMatch;
  const normalized = headerName.toLowerCase();
  const matchedKey = Object.keys(headers).find(
    (key) => key.toLowerCase() === normalized
  );
  return matchedKey ? headers[matchedKey] : undefined;
};

const resolveOpenAIApiKey = (): string | null => {
  const configuredKey =
    process.env.OPENAI_API_KEY?.trim()
    || process.env.OPEN_AI_SECRET_KEY?.trim();
  return configuredKey || null;
};

const previewText = (value: string, limit = 1_200): string =>
  value.length <= limit ? value : `${value.slice(0, limit)}...`;

const normalizeTrustedOrigin = (value: string | undefined): string | null => {
  const rawValue = value?.trim();
  if (!rawValue) return null;
  try {
    const parsed = new URL(rawValue);
    const isLocal =
      parsed.hostname === 'localhost'
      || parsed.hostname === '127.0.0.1';
    if (
      (parsed.protocol !== 'https:' && !(isLocal && parsed.protocol === 'http:'))
      || parsed.username
      || parsed.password
      || (
        !isLocal
        && parsed.hostname !== 'fitwithpulse.ai'
        && parsed.hostname !== 'www.fitwithpulse.ai'
        && !parsed.hostname.endsWith('.netlify.app')
      )
    ) {
      return null;
    }
    parsed.pathname = '';
    parsed.search = '';
    parsed.hash = '';
    return parsed.toString().replace(/\/+$/, '');
  } catch {
    return null;
  }
};

const resolveFunctionOrigins = (
  event: Parameters<Handler>[0]
): string[] => {
  const configuredOrigins = [
    process.env.DEPLOY_PRIME_URL,
    process.env.URL,
    'https://fitwithpulse.ai',
  ]
    .map(normalizeTrustedOrigin)
    .filter((origin): origin is string => Boolean(origin));

  if (process.env.NODE_ENV !== 'production') {
    const host = getHeader(event.headers, 'host') || '';
    if (
      /^localhost(?::\d+)?$/i.test(host)
      || /^127\.0\.0\.1(?::\d+)?$/.test(host)
    ) {
      const localOrigin = normalizeTrustedOrigin(`http://${host}`);
      if (localOrigin) configuredOrigins.unshift(localOrigin);
    }
  }

  return Array.from(new Set(configuredOrigins));
};

const runScheduleImportJobInline = async (
  jobId: string,
  workerToken: string,
  database: any
): Promise<void> => {
  const providerApiKey = resolveOpenAIApiKey();
  const jobRef = database.collection(JOB_COLLECTION).doc(jobId);

  try {
    if (!providerApiKey) throw new Error('Missing OpenAI provider key');

    const jobDoc = await jobRef.get();
    if (!jobDoc.exists) throw new Error('Job not found');

    const job = jobDoc.data() || {};
    if (job.workerToken !== workerToken) {
      throw new Error('Forbidden worker token');
    }
    if (job.status === 'succeeded') return;

    const source = normalizeScheduleImportSource(
      job.source || {}
    ) as ScheduleImportSource;
    const request = buildScheduleExtractionRequest(source);

    await jobRef.update({
      status: 'running',
      startedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    const response = await fetch(
      'https://api.openai.com/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${providerApiKey}`,
        },
        body: JSON.stringify(request),
      }
    );
    const responseText = await response.text();
    const contentType = response.headers.get('content-type') || '';

    if (!response.ok) {
      throw new Error(
        `OpenAI upstream ${response.status}: ${previewText(responseText)}`
      );
    }
    if (!contentType.toLowerCase().includes('application/json')) {
      throw new Error(
        `OpenAI upstream returned non-JSON (${contentType}): ${
          previewText(responseText)
        }`
      );
    }

    const result = JSON.parse(responseText);
    await jobRef.update({
      status: 'succeeded',
      result,
      completedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (error: any) {
    const incidentId = makeIncidentId('SCHED');
    await jobRef.update({
      status: 'failed',
      errorMessage:
        "Nora couldn't read that schedule right now. Try again in a moment.",
      errorCode: 'COACH_SCHEDULE_IMPORT_FAILED',
      incidentId,
      errorDetails: previewText(
        error?.message || 'Schedule import failed.'
      ),
      failedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
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
      body: JSON.stringify(
        safeErrorBody(
          'METHOD_NOT_ALLOWED',
          'That request is not supported.'
        )
      ),
    };
  }

  let authenticated: any;
  try {
    authenticated = await verifyFirebaseUser(event, {
      authErrorMessage: 'Sign in is required to import a team schedule.',
    });
  } catch (error: any) {
    return {
      statusCode: Number(error?.statusCode) || 401,
      headers: corsHeaders,
      body: JSON.stringify(
        safeErrorBody('AUTH_REQUIRED', 'Please sign in again.')
      ),
    };
  }

  let source: ScheduleImportSource;
  let access: Awaited<ReturnType<typeof requirePulseCheckScheduleAccess>>;
  try {
    const parsedBody = JSON.parse(event.body || '{}');
    if (!parsedBody || Array.isArray(parsedBody)) {
      throw Object.assign(new Error('The request body must be an object.'), {
        statusCode: 400,
      });
    }
    source = normalizeScheduleImportSource(parsedBody);
    access = await requirePulseCheckScheduleAccess({
      database: authenticated.app.firestore(),
      userId: authenticated.userId,
      teamId: source.teamId,
      organizationId: source.organizationId,
    });
  } catch (error: any) {
    const statusCode = Number(error?.statusCode) || 400;
    return {
      statusCode,
      headers: corsHeaders,
      body: JSON.stringify(
        safeErrorBody(
          statusCode === 403
            ? 'REQUEST_NOT_ALLOWED'
            : statusCode === 404
              ? 'NOT_FOUND'
              : 'BAD_REQUEST',
          error?.message || 'That request could not be read.'
        )
      ),
    };
  }

  if (!resolveOpenAIApiKey()) {
    return safeErrorResponse({
      statusCode: 500,
      headers: corsHeaders,
      code: 'COACH_SCHEDULE_IMPORT_FAILED',
      message:
        "Nora couldn't read that schedule right now. Try again in a moment.",
      source: 'coach-schedule-import.missing-provider-key',
      error: new Error('Missing OpenAI provider key'),
      db,
      context: {
        uid: authenticated.userId,
        teamId: source.teamId,
        organizationId: source.organizationId,
      },
    });
  }

  const jobId = crypto.randomUUID();
  const workerToken = crypto.randomUUID();
  const now = admin.firestore.FieldValue.serverTimestamp();
  const jobRef = authenticated.app
    .firestore()
    .collection(JOB_COLLECTION)
    .doc(jobId);
  await jobRef.set({
    ownerId: authenticated.userId,
    organizationId: source.organizationId,
    teamId: source.teamId,
    issuedByMembershipId: access.membershipId,
    status: 'queued',
    source,
    workerToken,
    createdAt: now,
    updatedAt: now,
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
    model: buildScheduleExtractionRequest(source).model,
    contractVersion: 1,
  });

  const workerHeaders = {
    'Content-Type': 'application/json',
    'x-pulsecheck-internal-worker': workerToken,
    ...(getHeader(event.headers, 'x-pulsecheck-firebase-mode')
      ? {
          'x-pulsecheck-firebase-mode': getHeader(
            event.headers,
            'x-pulsecheck-firebase-mode'
          )!,
        }
      : {}),
  };
  const workerBody = JSON.stringify({ jobId });
  let workerStarted = false;
  let lastWorkerError: Error | null = null;

  for (const origin of resolveFunctionOrigins(event)) {
    const workerUrl =
      `${origin}/.netlify/functions/coach-schedule-import-background`;
    try {
      const workerResponse = await fetch(workerUrl, {
        method: 'POST',
        headers: workerHeaders,
        body: workerBody,
      });
      if (workerResponse.ok || workerResponse.status === 202) {
        workerStarted = true;
        break;
      }

      const responseText = await workerResponse.text().catch(() => '');
      lastWorkerError = new Error(
        `HTTP ${workerResponse.status} from worker: ${
          previewText(responseText)
        }`
      );
      console.error(
        '[coach-schedule-import] Background worker returned an error:',
        { jobId, message: lastWorkerError.message }
      );
    } catch (error: any) {
      lastWorkerError =
        error instanceof Error ? error : new Error(String(error));
      console.error(
        '[coach-schedule-import] Background worker start failed:',
        { jobId, message: lastWorkerError.message }
      );
    }
  }

  if (!workerStarted) {
    console.error(
      '[coach-schedule-import] Falling back to inline schedule import:',
      {
        jobId,
        message:
          lastWorkerError?.message
          || 'No worker start attempts succeeded.',
      }
    );
    try {
      await runScheduleImportJobInline(
        jobId,
        workerToken,
        authenticated.app.firestore()
      );
    } catch (error: any) {
      console.error('[coach-schedule-import] Inline import failed:', {
        jobId,
        message: error?.message,
      });
    }
  }

  return {
    statusCode: 202,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      jobId,
      status: workerStarted ? 'queued' : 'running',
    }),
  };
};
