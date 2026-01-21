import { Handler } from '@netlify/functions';

const handler: Handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const jobId = event.queryStringParameters?.jobId;
  if (!jobId) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing required query param: jobId' }) };
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { initializeFirebaseAdmin, admin } = require('./config/firebase');
    initializeFirebaseAdmin({ headers: event.headers || {} });
    const db = admin.firestore();

    const jobDoc = await db.collection('lead-massage-jobs').doc(jobId).get();
    if (!jobDoc.exists) {
      return { statusCode: 404, headers, body: JSON.stringify({ error: 'Job not found' }) };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, job: { id: jobDoc.id, ...jobDoc.data() } }),
    };
  } catch (e: any) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to fetch job', detail: e?.message || String(e) }),
    };
  }
};

export { handler };

