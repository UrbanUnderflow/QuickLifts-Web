import type { NextApiRequest, NextApiResponse } from 'next';
import OpenAI from 'openai';
import { requireAdminRequest } from '../../_auth';
import { runNoraRedTeamScenario } from '../../../../../lib/nora-red-team/orchestrator';
import { getNoraRedTeamScenario } from '../../../../../lib/nora-red-team/scenarios';
import type {
  NoraRedTeamRunRequest,
  NoraRedTeamRunResponse,
} from '../../../../../lib/nora-red-team/types';

type ErrorResponse = {
  error: string;
  code: string;
};

function isValidSeed(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) > 0 && Number(value) <= 2_147_483_647;
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

  const apiKey = process.env.OPENAI_API_KEY?.trim() || process.env.OPEN_AI_SECRET_KEY?.trim();
  if (!apiKey) {
    return res.status(503).json({
      error: 'The AI provider is not configured for this environment.',
      code: 'AI_PROVIDER_NOT_CONFIGURED',
    });
  }

  const targetModel = process.env.NORA_RED_TEAM_TARGET_MODEL?.trim() || 'gpt-4o-mini';
  const agentModel = process.env.NORA_RED_TEAM_AGENT_MODEL?.trim() || 'gpt-5-mini';
  const build = process.env.COMMIT_REF?.trim()
    || process.env.NEXT_PUBLIC_COMMIT_SHA?.trim()
    || process.env.VERCEL_GIT_COMMIT_SHA?.trim()
    || 'local';

  try {
    const openai = new OpenAI({ apiKey });
    const run = await runNoraRedTeamScenario({
      openai,
      scenario,
      randomSeed: body.randomSeed,
      targetModel,
      agentModel,
      build,
    });
    return res.status(200).json({ run });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[nora-red-team] Run failed', {
      scenarioId: scenario.id,
      error: message.slice(0, 240),
    });
    return res.status(502).json({
      error: 'The red-team run could not be completed. No result was saved.',
      code: 'RED_TEAM_RUN_FAILED',
    });
  }
}
