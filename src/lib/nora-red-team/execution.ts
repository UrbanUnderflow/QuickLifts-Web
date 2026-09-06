import { assessNoraUsefulness } from './usefulness';
import { scenarioFingerprint } from './catalogIdentity';
import {
  createBoundedNoraRedTeamModelClient,
  type NoraRedTeamBudgetSnapshot,
} from './boundedModelClient';
import { createNoraRedTeamBridgeClient } from './modelClient';
import { runNoraRedTeamScenario } from './orchestrator';
import {
  createProductionEscalationClassifier,
  loadActiveProductionEscalationConditions,
} from './productionEscalation';
import { runNoraStagingScenario } from './stagingRunner';
import type {
  NoraRedTeamJobStage,
  NoraRedTeamRun,
  NoraRedTeamRunLimits,
  NoraRedTeamScenario,
  NoraRedTeamTarget,
  NoraRedTeamUsage,
} from './types';

export type NoraRedTeamExecutionProgress = {
  stage: NoraRedTeamJobStage;
  percent: number;
  message: string;
  usage: NoraRedTeamUsage;
};

function boundedEnvironmentNumber(
  name: string,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  const parsed = Number(process.env[name]);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(minimum, Math.min(maximum, Math.round(parsed)));
}

export function getNoraRedTeamRunLimits(): NoraRedTeamRunLimits {
  return {
    maxDurationMs: boundedEnvironmentNumber('NORA_RED_TEAM_MAX_DURATION_MS', 120_000, 30_000, 600_000),
    requestTimeoutMs: boundedEnvironmentNumber('NORA_RED_TEAM_REQUEST_TIMEOUT_MS', 30_000, 5_000, 90_000),
    maxModelCalls: boundedEnvironmentNumber('NORA_RED_TEAM_MAX_MODEL_CALLS', 22, 4, 30),
    maxRetriesPerRequest: boundedEnvironmentNumber('NORA_RED_TEAM_MAX_RETRIES', 1, 0, 2),
    maxTotalTokens: boundedEnvironmentNumber('NORA_RED_TEAM_MAX_TOTAL_TOKENS', 50_000, 10_000, 200_000),
  };
}

export async function executeNoraRedTeamRun(input: {
  authorization: string;
  bridgeOrigin: string;
  featureId: string;
  firebaseMode: 'prod' | 'dev';
  firebaseProjectId: string;
  scenario: NoraRedTeamScenario;
  randomSeed: number;
  targetModel: string;
  agentModel: string;
  build: string;
  target: NoraRedTeamTarget;
  limits: NoraRedTeamRunLimits;
  signal: AbortSignal;
  onProgress?: (progress: NoraRedTeamExecutionProgress) => void | Promise<void>;
  onBudgetUpdate?: (snapshot: NoraRedTeamBudgetSnapshot) => void | Promise<void>;
}): Promise<NoraRedTeamRun> {
  const baseClient = createNoraRedTeamBridgeClient({
    authorization: input.authorization,
    bridgeOrigin: input.bridgeOrigin,
    featureId: input.featureId,
    firebaseMode: input.firebaseMode,
  });
  const openai = createBoundedNoraRedTeamModelClient({
    client: baseClient,
    signal: input.signal,
    limits: input.limits,
    onBudgetUpdate: input.onBudgetUpdate,
  });
  if (input.target === 'staging_chat') {
    if (input.firebaseMode !== 'dev') {
      throw new Error('STAGING_REQUIRES_DEVELOPMENT: Staging chat runs require the development database.');
    }
    const run = await runNoraStagingScenario({
      scenario: input.scenario,
      randomSeed: input.randomSeed,
      build: input.build,
      targetModel: input.targetModel,
      signal: input.signal,
      onProgress: input.onProgress,
    });
    return assessNoraUsefulness(openai, input.agentModel, { ...run, agentModel: input.agentModel, scenarioSnapshot: input.scenario, scenarioFingerprint: scenarioFingerprint(input.scenario) }, input.scenario, input.signal);
  }

  await input.onProgress?.({
    stage: 'loading_policy',
    percent: 4,
    message: 'Loading the active production escalation policy.',
    usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
  });

  const escalationConditions = await loadActiveProductionEscalationConditions({
    authorization: input.authorization,
    projectId: input.firebaseProjectId,
    signal: input.signal,
  });
  const classifyEscalation = createProductionEscalationClassifier({
    openai,
    conditions: escalationConditions,
    model: 'gpt-4o-mini',
  });

  const run = await runNoraRedTeamScenario({
    openai,
    classifyEscalation,
    scenario: input.scenario,
    randomSeed: input.randomSeed,
    targetModel: input.targetModel,
    agentModel: input.agentModel,
    build: input.build,
    signal: input.signal,
    onProgress: input.onProgress,
  });
  return assessNoraUsefulness(openai, input.agentModel, { ...run, agentModel: input.agentModel, scenarioSnapshot: input.scenario, scenarioFingerprint: scenarioFingerprint(input.scenario) }, input.scenario, input.signal);
}
