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

  // IMPORTANT: Do NOT try to trigger the worker from inside this function.
  // Netlify function-to-function HTTP calls can fail depending on runtime/network settings.
  // The admin UI will trigger the background worker using the returned jobId.
  await jobRef.set(
    {
      message: 'Job queued (waiting for worker trigger)',
      debug: {
        ...(await jobRef.get().then((d) => d.data()?.debug || {})),
        trigger: {
          mode: 'client',
          note: 'Client should call /.netlify/functions/process-massage-lead-job with { jobId }',
          attemptedAt: new Date(),
        },
      },
      updatedAt: new Date(),
    },
    { merge: true }
  );

  return {
    statusCode: 202,
    headers,
    body: JSON.stringify({ success: true, jobId }),
  };
};

export { handler };

