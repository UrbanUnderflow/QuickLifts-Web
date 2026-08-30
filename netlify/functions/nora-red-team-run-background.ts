import { timingSafeEqual } from 'node:crypto';
import type { Handler } from '@netlify/functions';
import { getFirebaseAdminApp } from '../../src/lib/firebase-admin';
import { createFirestoreNoraRedTeamJobStore } from '../../src/lib/nora-red-team/jobStore';
import { NoraRedTeamHistoryStore } from '../../src/lib/nora-red-team/historyStore';
import {
  executeNoraRedTeamJob,
  hashNoraRedTeamWorkerToken,
} from '../../src/lib/nora-red-team/jobRunner';

function headerValue(headers: Record<string, string | undefined>, name: string): string {
  return headers[name] || headers[name.toLowerCase()] || '';
}

function secureHashMatch(left: string, right: string): boolean {
  if (!left || !right || left.length !== right.length) return false;
  return timingSafeEqual(Buffer.from(left), Buffer.from(right));
}

function bridgeOrigin(): string {
  return (process.env.OPENAI_BRIDGE_FALLBACK_ORIGIN
    || process.env.URL
    || process.env.NEXT_PUBLIC_SITE_URL
    || 'https://fitwithpulse.ai').replace(/\/+$/, '');
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed.' }) };
  }

  const authorization = headerValue(event.headers, 'authorization');
  const workerToken = headerValue(event.headers, 'x-pulsecheck-internal-worker');
  const firebaseMode = headerValue(event.headers, 'x-pulsecheck-firebase-mode') === 'dev' ? 'dev' : 'prod';
  const body = JSON.parse(event.body || '{}') as { jobId?: string };
  const jobId = String(body.jobId || '');
  if (!/^nrt-job-[a-f0-9-]{36}$/i.test(jobId) || !authorization.startsWith('Bearer ') || !workerToken) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid worker request.' }) };
  }

  const app = getFirebaseAdminApp(firebaseMode === 'dev');
  const store = createFirestoreNoraRedTeamJobStore(app.firestore());
  const job = await store.get(jobId);
  if (!job || !secureHashMatch(job.workerTokenHash, hashNoraRedTeamWorkerToken(workerToken))) {
    return { statusCode: 403, body: JSON.stringify({ error: 'Worker authorization failed.' }) };
  }
  if (job.firebaseMode !== firebaseMode) {
    return { statusCode: 409, body: JSON.stringify({ error: 'Worker Firebase mode mismatch.' }) };
  }

  await executeNoraRedTeamJob({
    store,
    jobId,
    authorization,
    bridgeOrigin: bridgeOrigin(),
    featureId: process.env.NORA_RED_TEAM_BRIDGE_FEATURE_ID?.trim() || 'noraRedTeam',
    historyStore: new NoraRedTeamHistoryStore(app.firestore()),
  });

  return { statusCode: 200, body: JSON.stringify({ ok: true, jobId }) };
};
