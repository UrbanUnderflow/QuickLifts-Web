import { Handler } from '@netlify/functions';

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

  const jobId = event.queryStringParameters?.jobId || (() => {
    try {
      const body = JSON.parse(event.body || '{}');
      return body.jobId;
    } catch {
      return null;
    }
  })();

  if (!jobId) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing required param: jobId' }) };
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { initializeFirebaseAdmin, admin } = require('./config/firebase');
    initializeFirebaseAdmin({ headers: event.headers || {} });
    const db = admin.firestore();

    const jobRef = db.collection('lead-massage-jobs').doc(jobId);
    const jobDoc = await jobRef.get();

    if (!jobDoc.exists) {
      return { statusCode: 404, headers, body: JSON.stringify({ error: 'Job not found' }) };
    }

    const jobData = jobDoc.data();
    const currentStatus = jobData?.status;

    // Only allow cancelling if job is still running or queued
    if (currentStatus !== 'running' && currentStatus !== 'queued') {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: `Cannot cancel job with status: ${currentStatus}` }),
      };
    }

    await jobRef.set(
      {
        status: 'cancelled',
        message: 'Job cancelled by user',
        updatedAt: new Date(),
      },
      { merge: true }
    );

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, message: 'Job cancelled successfully' }),
    };
  } catch (e: any) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to cancel job', detail: e?.message || String(e) }),
    };
  }
};

export { handler };
