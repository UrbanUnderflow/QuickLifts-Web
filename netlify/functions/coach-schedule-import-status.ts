import { Handler } from '@netlify/functions';
import { admin, headers as corsHeaders } from './config/firebase';
import { safeErrorBody } from './utils/safeErrorResponse';

/**
 * Coach Schedule Import — status poller
 * ------------------------------------------------------------------
 * The Schedule tab polls this after kicking off an import to pick up the
 * extracted events once the background worker finishes. Mirrors
 * `nora-routine-generation-status.ts`. Ownership is enforced here (only the
 * coach who created the job can read it).
 */

const JOB_COLLECTION = 'coachScheduleImportJobs';

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
    console.error('[coach-schedule-import-status] Auth verification failed:', error);
    return null;
  }
};

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  if (event.httpMethod !== 'GET') {
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

  const jobId = event.queryStringParameters?.jobId;
  if (!jobId) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify(safeErrorBody('BAD_REQUEST', 'That request could not be read.'))
    };
  }

  const jobDoc = await admin.firestore().collection(JOB_COLLECTION).doc(jobId).get();
  if (!jobDoc.exists) {
    return {
      statusCode: 404,
      headers: corsHeaders,
      body: JSON.stringify(safeErrorBody('NOT_FOUND', 'That request could not be found.'))
    };
  }

  const job = jobDoc.data() || {};
  if (job.ownerId !== uid) {
    return {
      statusCode: 403,
      headers: corsHeaders,
      body: JSON.stringify(safeErrorBody('REQUEST_NOT_ALLOWED', 'That request is not allowed.'))
    };
  }

  return {
    statusCode: 200,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      jobId,
      status: job.status || 'queued',
      result: job.status === 'succeeded' ? job.result : null,
      errorMessage: job.status === 'failed'
        ? `${job.errorMessage || "Nora couldn't read that schedule right now. Try again in a moment."} Code: ${job.incidentId || job.errorCode || 'COACH_SCHEDULE_IMPORT_FAILED'}.`
        : null
    })
  };
};
