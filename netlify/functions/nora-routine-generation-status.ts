import { Handler } from '@netlify/functions';
import { admin, headers as corsHeaders } from './config/firebase';

const JOB_COLLECTION = 'noraRoutineGenerationJobs';

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
    console.error('[nora-routine-generation-status] Auth verification failed:', error);
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

  const jobId = event.queryStringParameters?.jobId;
  if (!jobId) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Missing jobId' })
    };
  }

  const jobDoc = await admin.firestore().collection(JOB_COLLECTION).doc(jobId).get();
  if (!jobDoc.exists) {
    return {
      statusCode: 404,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Job not found' })
    };
  }

  const job = jobDoc.data() || {};
  if (job.ownerId !== uid) {
    return {
      statusCode: 403,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Forbidden' })
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
      errorMessage: job.status === 'failed' ? job.errorMessage || 'Routine generation failed.' : null
    })
  };
};
