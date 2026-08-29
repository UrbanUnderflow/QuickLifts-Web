import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAdminRequest } from '../../_auth';
import { createNoraRedTeamBridgeClient } from '../../../../../lib/nora-red-team/modelClient';
import { runNoraRedTeamScenario } from '../../../../../lib/nora-red-team/orchestrator';
import {
  createProductionEscalationClassifier,
  loadActiveProductionEscalationConditions,
} from '../../../../../lib/nora-red-team/productionEscalation';
import { getNoraRedTeamScenario } from '../../../../../lib/nora-red-team/scenarios';
import type {
  NoraRedTeamRunRequest,
  NoraRedTeamRunResponse,
} from '../../../../../lib/nora-red-team/types';

type ErrorResponse = {
  error: string;
  code: string;
  detail?: string;
};

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
  // bridge directly. Use an already-deployed high-token policy until this
  // branch's noraRedTeam bridge policy is live.
  return isLocalRequest(req) ? 'noraRoutineGeneration' : 'noraRedTeam';
}

function firstHeader(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] || '' : value || '';
}

function getFirebaseContext(req: NextApiRequest): { mode: 'prod' | 'dev'; projectId: string } {
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

export const config = {
  api: {
    bodyParser: { sizeLimit: '16kb' },
    responseLimit: '2mb',
  },
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<NoraRedTeamRunResponse | ErrorResponse>,
) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed.', code: 'METHOD_NOT_ALLOWED' });
  }

  const adminIdentity = await requireAdminRequest(req);
  if (!adminIdentity) {
    return res.status(401).json({ error: 'Admin authorization is required.', code: 'ADMIN_AUTH_REQUIRED' });
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

  const authorization = typeof req.headers.authorization === 'string' ? req.headers.authorization : '';
  if (!authorization.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Admin authorization is required for the AI bridge.',
      code: 'ADMIN_AUTH_REQUIRED',
    });
  }

  const targetModel = process.env.NORA_RED_TEAM_TARGET_MODEL?.trim() || 'gpt-4o-mini';
  const agentModel = process.env.NORA_RED_TEAM_AGENT_MODEL?.trim() || 'gpt-4o-mini';
  const build = process.env.COMMIT_REF?.trim()
    || process.env.NEXT_PUBLIC_COMMIT_SHA?.trim()
    || process.env.VERCEL_GIT_COMMIT_SHA?.trim()
    || 'local';

  try {
    const firebase = getFirebaseContext(req);
    const openai = createNoraRedTeamBridgeClient({
      authorization,
      bridgeOrigin: getBridgeOrigin(),
      featureId: getBridgeFeatureId(req),
      firebaseMode: firebase.mode,
    });
    const escalationConditions = await loadActiveProductionEscalationConditions({
      authorization,
      projectId: firebase.projectId,
    });
    const classifyEscalation = createProductionEscalationClassifier({
      openai,
      conditions: escalationConditions,
      model: 'gpt-4o-mini',
    });
    const run = await runNoraRedTeamScenario({
      openai,
      classifyEscalation,
      scenario,
      randomSeed: body.randomSeed,
      targetModel,
      agentModel,
      build,
    });
    return res.status(200).json({ run });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const isBridgeFailure = /bridge/i.test(message);
    const isEscalationPolicyFailure = /ESCALATION_(?:POLICY|CLASSIFICATION)_UNAVAILABLE/i.test(message);
    console.error('[nora-red-team] Run failed', {
      scenarioId: scenario.id,
      error: message.slice(0, 240),
    });
    return res.status(isEscalationPolicyFailure ? 503 : 502).json({
      error: isEscalationPolicyFailure
        ? 'The production escalation safety check is unavailable. No result was saved.'
        : isBridgeFailure
        ? 'The OpenAI bridge could not complete the red-team run. No result was saved.'
        : 'The red-team run could not be completed. No result was saved.',
      code: isEscalationPolicyFailure
        ? 'ESCALATION_POLICY_UNAVAILABLE'
        : isBridgeFailure ? 'AI_BRIDGE_UNAVAILABLE' : 'RED_TEAM_RUN_FAILED',
      detail: message.slice(0, 180),
    });
  }
}
