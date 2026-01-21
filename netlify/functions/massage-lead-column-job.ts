import { Handler } from '@netlify/functions';

interface RequestBody {
  listId: string;
  sourceColumn?: string; // Legacy support
  sourceColumns?: string[]; // New: support multiple columns
  newColumnName: string;
  prompt: string;
}

type JobStatus = 'queued' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';

const handler: Handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { initializeFirebaseAdmin, admin } = require('./config/firebase');
  initializeFirebaseAdmin({ headers: event.headers || {} });
  const db = admin.firestore();

  let body: RequestBody;
  try {
    body = JSON.parse(event.body || '{}') as RequestBody;
  } catch (e: any) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON', detail: e?.message }) };
  }

  const { listId, sourceColumn, sourceColumns, newColumnName, prompt } = body;
  const columns = sourceColumns || (sourceColumn ? [sourceColumn] : []);

  if (!listId || columns.length === 0 || !newColumnName || !prompt?.trim()) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Missing required fields: listId, sourceColumns (or sourceColumn), newColumnName, prompt' }),
    };
  }

  // Create a job record first so the UI can start polling immediately.
  const jobRef = db.collection('lead-massage-jobs').doc();
  const jobId = jobRef.id;
  const createdAt = new Date();

  await jobRef.set({
    id: jobId,
    status: 'queued' as JobStatus,
    listId,
    sourceColumns: columns,
    newColumnName,
    prompt: prompt.trim(),
    totalLeads: 0,
    processedCount: 0,
    alreadyProcessedCount: 0,
    newlyProcessedCount: 0,
    remainingLeads: 0,
    errorCount: 0,
    errors: [],
    message: 'Job queued',
    debug: {
      phase: 'queued',
      batchNumber: 0,
      totalBatches: 0,
      lastHeartbeatAt: createdAt,
    },
    createdAt,
    updatedAt: createdAt,
  });

  // Kick off worker (background) function and return jobId immediately.
  // NOTE: Netlify background functions don't reliably support "return early and keep running" with an IIFE.
  // We instead use a separate background worker function that reads this jobId and runs to completion.
  const baseUrl =
    process.env.URL ||
    process.env.DEPLOY_PRIME_URL ||
    process.env.DEPLOY_URL;

  if (baseUrl) {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    fetch(`${baseUrl}/.netlify/functions/process-massage-lead-job`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId }),
    }).catch((e) => {
      console.error('[massage-lead-column-job] Failed to trigger worker:', e);
    });
  } else {
    console.warn('[massage-lead-column-job] Missing site URL env var; worker not auto-triggered. Job remains queued.', {
      URL: process.env.URL,
      DEPLOY_PRIME_URL: process.env.DEPLOY_PRIME_URL,
      DEPLOY_URL: process.env.DEPLOY_URL,
    });
  }

  return {
    statusCode: 202,
    headers,
    body: JSON.stringify({ success: true, jobId }),
  };
};

export { handler };

