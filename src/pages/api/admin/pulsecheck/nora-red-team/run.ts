import { randomUUID } from 'node:crypto';
import type { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdminApp } from '../../../../../lib/firebase-admin';
import { getNoraRedTeamRunLimits } from '../../../../../lib/nora-red-team/execution';
import {
  createFirestoreNoraRedTeamJobStore,
  createMemoryNoraRedTeamJobStore,
  createNoraRedTeamJobRecord,
  type NoraRedTeamJobStore,
  toPublicNoraRedTeamJob,
} from '../../../../../lib/nora-red-team/jobStore';
import {
  abortLocalNoraRedTeamJob,
  executeNoraRedTeamJob,
  hashNoraRedTeamWorkerToken,
} from '../../../../../lib/nora-red-team/jobRunner';
import { NoraRedTeamHistoryStore } from '../../../../../lib/nora-red-team/historyStore';
import { getNoraRedTeamScenario } from '../../../../../lib/nora-red-team/scenarios';
import type {
  NoraRedTeamJobResponse,
  NoraRedTeamRunRequest,
} from '../../../../../lib/nora-red-team/types';
import { requireAdminRequest } from '../../_auth';

type ErrorResponse = {
  error: string;
  code: string;
  detail?: string;
};

type FirebaseContext = { mode: 'prod' | 'dev'; projectId: string };

function isValidSeed(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) > 0 && Number(value) <= 2_147_483_647;
}

function getBridgeOrigin(): string {
  return (process.env.OPENAI_BRIDGE_FALLBACK_ORIGIN || process.env.NEXT_PUBLIC_SITE_URL || 'https://fitwithpulse.ai')
    .replace(/\/+$/, '');
}

function isLocalRequest(req: NextApiRequest): boolean {
  const host = String(req.headers.host || '').toLowerCase();
  return host.includes('localhost') || host.includes('127.0.0.1') || host.startsWith('0.0.0.0');
}

function getBridgeFeatureId(req: NextApiRequest): string {
  const configured = process.env.NORA_RED_TEAM_BRIDGE_FEATURE_ID?.trim();
  if (configured) return configured;
  // Local next dev does not run Netlify redirects, so it calls the deployed
  // bridge directly until the dedicated red-team bridge policy is deployed.
  return isLocalRequest(req) ? 'noraRoutineGeneration' : 'noraRedTeam';
}

function firstHeader(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] || '' : value || '';
}

function getFirebaseContext(req: NextApiRequest): FirebaseContext {
  const productionProjectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim() || 'quicklifts-dd3f1';
  const developmentProjectId = process.env.NEXT_PUBLIC_DEV_FIREBASE_PROJECT_ID?.trim() || 'quicklifts-dev-01';
  const requestedProjectId = firstHeader(req.headers['x-pulsecheck-firebase-project-id']).trim();
  if (requestedProjectId && ![productionProjectId, developmentProjectId].includes(requestedProjectId)) {
    throw new Error('ESCALATION_POLICY_UNAVAILABLE: The requested Firebase project is not allowed.');
  }
  const requestedMode = firstHeader(req.headers['x-pulsecheck-firebase-mode']).toLowerCase();
  const useDevelopment = requestedProjectId === developmentProjectId || requestedMode === 'dev';
  return {
    mode: useDevelopment ? 'dev' : 'prod',
    projectId: requestedProjectId || (useDevelopment ? developmentProjectId : productionProjectId),
  };
}

function getJobStore(req: NextApiRequest, firebase: FirebaseContext): NoraRedTeamJobStore {
  if (isLocalRequest(req)) return createMemoryNoraRedTeamJobStore();
  const app = getFirebaseAdminApp(firebase.mode === 'dev');
  return createFirestoreNoraRedTeamJobStore(app.firestore());
}

function getJobId(req: NextApiRequest): string {
  const queryValue = Array.isArray(req.query.jobId) ? req.query.jobId[0] : req.query.jobId;
  const bodyValue = typeof req.body?.jobId === 'string' ? req.body.jobId : '';
  return String(queryValue || bodyValue || '').trim();
}

function isValidJobId(jobId: string): boolean {
  return /^nrt-job-[a-f0-9-]{36}$/i.test(jobId);
}

function deploymentOrigin(req: NextApiRequest): string {
  const configured = process.env.URL || process.env.DEPLOY_PRIME_URL || process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) return configured.replace(/\/+$/, '');
  const protocol = firstHeader(req.headers['x-forwarded-proto']) || 'https';
  return `${protocol}://${firstHeader(req.headers.host)}`.replace(/\/+$/, '');
}

async function dispatchBackgroundWorker(input: {
  req: NextApiRequest;
  authorization: string;
  workerToken: string;
  jobId: string;
  firebase: FirebaseContext;
}): Promise<void> {
  const response = await fetch(`${deploymentOrigin(input.req)}/.netlify/functions/nora-red-team-run-background`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: input.authorization,
      'x-pulsecheck-internal-worker': input.workerToken,
      'x-pulsecheck-firebase-mode': input.firebase.mode,
      'x-pulsecheck-firebase-project-id': input.firebase.projectId,
    },
    body: JSON.stringify({ jobId: input.jobId }),
  });
  if (!response.ok && response.status !== 202) {
    throw new Error(`Background worker returned HTTP ${response.status}.`);
  }
}

export const config = {
  api: {
    bodyParser: { sizeLimit: '16kb' },
    responseLimit: '2mb',
  },
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<NoraRedTeamJobResponse | ErrorResponse>,
) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Allow', 'POST, GET, DELETE');

  if (!['POST', 'GET', 'DELETE'].includes(req.method || '')) {
    return res.status(405).json({ error: 'Method not allowed.', code: 'METHOD_NOT_ALLOWED' });
  }

  const adminIdentity = await requireAdminRequest(req);
  if (!adminIdentity) {
    return res.status(401).json({ error: 'Admin authorization is required.', code: 'ADMIN_AUTH_REQUIRED' });
  }
  const authorization = typeof req.headers.authorization === 'string' ? req.headers.authorization : '';
  if (!authorization.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Admin authorization is required.', code: 'ADMIN_AUTH_REQUIRED' });
  }

  try {
    const firebase = getFirebaseContext(req);
    const store = getJobStore(req, firebase);

    if (req.method === 'GET') {
      const jobId = getJobId(req);
      if (!isValidJobId(jobId)) {
        return res.status(400).json({ error: 'Choose a valid red-team job.', code: 'INVALID_JOB' });
      }
      const job = await store.get(jobId);
      if (!job || job.ownerEmail !== adminIdentity.email.trim().toLowerCase()) {
        return res.status(404).json({ error: 'The red-team job was not found.', code: 'JOB_NOT_FOUND' });
      }
      if (new Date(job.expiresAt).getTime() <= Date.now()) {
        await store.remove(jobId);
        return res.status(410).json({ error: 'The temporary red-team job expired.', code: 'JOB_EXPIRED' });
      }
      return res.status(200).json({ job: toPublicNoraRedTeamJob(job) });
    }

    if (req.method === 'DELETE') {
      const jobId = getJobId(req);
      if (!isValidJobId(jobId)) {
        return res.status(400).json({ error: 'Choose a valid red-team job.', code: 'INVALID_JOB' });
      }
      const job = await store.get(jobId);
      if (!job || job.ownerEmail !== adminIdentity.email.trim().toLowerCase()) {
        return res.status(404).json({ error: 'The red-team job was not found.', code: 'JOB_NOT_FOUND' });
      }
      if (['completed', 'failed', 'cancelled'].includes(job.status)) {
        return res.status(409).json({ error: `The run is already ${job.status}.`, code: 'JOB_NOT_CANCELLABLE' });
      }
      const cancelledAt = new Date().toISOString();
      const status = job.status === 'queued' ? 'cancelled' as const : 'cancelling' as const;
      await store.update(jobId, {
        status,
        cancelRequested: true,
        completedAt: status === 'cancelled' ? cancelledAt : null,
        progress: {
          ...job.progress,
          stage: status === 'cancelled' ? 'cancelled' : 'cancelling',
          message: status === 'cancelled'
            ? 'The queued run was cancelled. No result was saved.'
            : 'Cancellation requested. Stopping the active model request.',
          updatedAt: cancelledAt,
        },
      });
      abortLocalNoraRedTeamJob(jobId);
      const updated = await store.get(jobId);
      return res.status(202).json({ job: toPublicNoraRedTeamJob(updated || job) });
    }

    const body = (req.body || {}) as Partial<NoraRedTeamRunRequest>;
    const scenario = typeof body.scenarioId === 'string'
      ? getNoraRedTeamScenario(body.scenarioId)
      : null;
    if (!scenario) {
      return res.status(400).json({ error: 'Choose a valid red-team scenario.', code: 'INVALID_SCENARIO' });
    }
    if (!isValidSeed(body.randomSeed)) {
      return res.status(400).json({ error: 'Choose a valid positive random seed.', code: 'INVALID_RANDOM_SEED' });
    }
    const target = body.target || 'policy_sandbox';
    if (!['policy_sandbox', 'staging_chat'].includes(target)) {
      return res.status(400).json({ error: 'Choose a valid red-team target.', code: 'INVALID_TARGET' });
    }
    if (target === 'staging_chat' && firebase.mode !== 'dev') {
      return res.status(409).json({
        error: 'Staging chat runs require the development database.',
        code: 'STAGING_REQUIRES_DEVELOPMENT',
      });
    }

    const targetModel = process.env.NORA_RED_TEAM_TARGET_MODEL?.trim() || 'gpt-4o-mini';
    const agentModel = process.env.NORA_RED_TEAM_AGENT_MODEL?.trim() || 'gpt-4o-mini';
    const build = process.env.COMMIT_REF?.trim()
      || process.env.NEXT_PUBLIC_COMMIT_SHA?.trim()
      || process.env.VERCEL_GIT_COMMIT_SHA?.trim()
      || 'local';
    const jobId = `nrt-job-${randomUUID()}`;
    const workerToken = randomUUID();
    const job = createNoraRedTeamJobRecord({
      jobId,
      scenarioId: scenario.id,
      randomSeed: body.randomSeed,
      target,
      ownerEmail: adminIdentity.email,
      workerTokenHash: hashNoraRedTeamWorkerToken(workerToken),
      firebaseMode: firebase.mode,
      firebaseProjectId: firebase.projectId,
      targetModel,
      agentModel,
      build,
      limits: getNoraRedTeamRunLimits(),
      storage: store.kind,
    });
    await store.create(job);

    if (isLocalRequest(req)) {
      void executeNoraRedTeamJob({
        store,
        jobId,
        authorization,
        bridgeOrigin: getBridgeOrigin(),
        featureId: getBridgeFeatureId(req),
        historyStore: new NoraRedTeamHistoryStore(
          getFirebaseAdminApp(firebase.mode === 'dev').firestore(),
        ),
      });
    } else {
      try {
        await dispatchBackgroundWorker({ req, authorization, workerToken, jobId, firebase });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await store.update(jobId, {
          status: 'failed',
          completedAt: new Date().toISOString(),
          error: {
            code: 'RED_TEAM_WORKER_UNAVAILABLE',
            message: 'The background runner could not be started. No model request was made.',
            detail: message.slice(0, 180),
          },
        });
        return res.status(503).json({
          error: 'The background runner could not be started.',
          code: 'RED_TEAM_WORKER_UNAVAILABLE',
          detail: message.slice(0, 180),
        });
      }
    }

    return res.status(202).json({ job: toPublicNoraRedTeamJob(job) });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const isEscalationPolicyFailure = /ESCALATION_(?:POLICY|CLASSIFICATION)_UNAVAILABLE/i.test(message);
    console.error('[nora-red-team] Job request failed', { error: message.slice(0, 240) });
    return res.status(isEscalationPolicyFailure ? 503 : 500).json({
      error: isEscalationPolicyFailure
        ? 'The production escalation safety check is unavailable.'
        : 'The red-team job request could not be completed.',
      code: isEscalationPolicyFailure ? 'ESCALATION_POLICY_UNAVAILABLE' : 'RED_TEAM_JOB_FAILED',
      detail: message.slice(0, 180),
    });
  }
}
