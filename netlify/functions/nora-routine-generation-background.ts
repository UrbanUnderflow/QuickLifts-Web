import { Handler } from '@netlify/functions';
import { admin } from './config/firebase';

const JOB_COLLECTION = 'noraRoutineGenerationJobs';

const resolveOpenAIApiKey = (): string | null => {
  const configuredKey = process.env.OPENAI_API_KEY?.trim() || process.env.OPEN_AI_SECRET_KEY?.trim();
  return configuredKey || null;
};

const previewText = (value: string, limit = 1200): string => {
  return value.length <= limit ? value : `${value.slice(0, limit)}...`;
};

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let body: any;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (_error) {
    return { statusCode: 400, body: 'Invalid JSON' };
  }

  const jobId = body.jobId;
  const workerToken = event.headers['x-pulsecheck-internal-worker'] || event.headers['X-PulseCheck-Internal-Worker'];
  if (!jobId || !workerToken) {
    return { statusCode: 400, body: 'Missing job credentials' };
  }

  const providerApiKey = resolveOpenAIApiKey();
  if (!providerApiKey) {
    return { statusCode: 500, body: 'Missing OpenAI provider key' };
  }

  const jobRef = admin.firestore().collection(JOB_COLLECTION).doc(jobId);

  try {
    const jobDoc = await jobRef.get();
    if (!jobDoc.exists) return { statusCode: 404, body: 'Job not found' };

    const job = jobDoc.data() || {};
    if (job.workerToken !== workerToken) {
      return { statusCode: 403, body: 'Forbidden' };
    }
    if (job.status === 'succeeded') {
      return { statusCode: 200, body: 'Already complete' };
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

    const result = JSON.parse(responseText);
    await jobRef.update({
      status: 'succeeded',
      result,
      completedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return { statusCode: 200, body: 'Routine generation complete' };
  } catch (error: any) {
    console.error('[nora-routine-generation-background] Job failed:', {
      jobId,
      message: error?.message
    });
    await jobRef.update({
      status: 'failed',
      errorMessage: previewText(error?.message || 'Routine generation failed.'),
      failedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }).catch(() => {});
    return { statusCode: 500, body: 'Routine generation failed' };
  }
};
