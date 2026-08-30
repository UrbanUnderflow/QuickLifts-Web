import type * as FirebaseAdmin from 'firebase-admin';
import { executeNoraRedTeamRun, getNoraRedTeamRunLimits } from './execution';
import { NoraRedTeamHistoryStore } from './historyStore';
import { NORA_RED_TEAM_SCENARIOS } from './scenarios';
import { createSyntheticFirebaseIdToken } from './syntheticFirebaseAuth';
import {
  NoraRedTeamSuiteStore,
  type NoraRedTeamSuiteStoreRecord,
} from './suiteStore';
import type {
  NoraRedTeamRegressionCase,
  NoraRedTeamScenario,
} from './types';

export const NORA_RED_TEAM_SCHEDULED_OWNER = 'nora-red-team-scheduled@redteam.invalid';
export const NORA_RED_TEAM_SCHEDULED_UID = 'nora-red-team-scheduled-runner';
const SUITE_MAX_DURATION_MS = 13 * 60 * 1000;

export type NoraRedTeamSuiteScenario = {
  key: string;
  scenario: NoraRedTeamScenario;
};

export function buildNoraRedTeamSuiteScenarios(
  regressions: NoraRedTeamRegressionCase[],
): NoraRedTeamSuiteScenario[] {
  const canonical = NORA_RED_TEAM_SCENARIOS.map((scenario) => ({
    key: `catalog:${scenario.id}`,
    scenario,
  }));
  const promoted = regressions
    .filter((regression) => regression.enabled)
    .map((regression) => {
      const suffix = regression.sourceRunId.replace(/[^a-z0-9]/gi, '').slice(-10) || 'promoted';
      return {
        key: `regression:${regression.scenarioId}:${regression.sourceRunId}`,
        scenario: {
          ...regression.scenario,
          id: `${regression.scenario.id}-regression-${suffix}`,
          title: `${regression.scenario.title} (promoted regression)`,
        },
      };
    });
  return [...canonical, ...promoted];
}

function seedForScenario(startedAt: string, index: number): number {
  const date = Number(startedAt.slice(0, 10).replace(/-/g, '')) || 20_260_101;
  return Math.min(2_147_483_647, (date * 100) + index + 1);
}

function safeError(error: unknown): string {
  return (error instanceof Error ? error.message : String(error)).replace(/Bearer\s+\S+/gi, 'Bearer [redacted]').slice(0, 240);
}

export async function executeScheduledNoraRedTeamSuite(input: {
  app: FirebaseAdmin.app.App;
  suiteId: string;
  bridgeOrigin: string;
  featureId: string;
  firebaseProjectId: string;
  firebaseApiKey: string;
  targetModel: string;
  agentModel: string;
  build: string;
}): Promise<void> {
  const firestore = input.app.firestore();
  const suiteStore = new NoraRedTeamSuiteStore(firestore);
  const startedAt = new Date().toISOString();
  const suite = await suiteStore.claim(input.suiteId, startedAt);
  if (!suite) return;

  const historyStore = new NoraRedTeamHistoryStore(firestore);
  const errors: string[] = [];
  let completedScenarioIds: string[] = [];
  let passed = 0;
  let failed = 0;
  let review = 0;

  try {
    const regressions = await historyStore.listEnabledRegressions();
    const scenarios = buildNoraRedTeamSuiteScenarios(regressions);
    if (scenarios.map(({ key }) => key).join('|') !== suite.scenarioIds.join('|')) {
      throw new Error('SUITE_CATALOG_CHANGED: Scheduled scenario inputs changed after the suite was queued.');
    }

    const idToken = await createSyntheticFirebaseIdToken({
      app: input.app,
      uid: NORA_RED_TEAM_SCHEDULED_UID,
      email: NORA_RED_TEAM_SCHEDULED_OWNER,
      apiKey: input.firebaseApiKey,
      claims: {
        noraRedTeamSynthetic: true,
        noraRedTeamScheduled: true,
        role: 'internal_red_team_runner',
      },
    });
    const authorization = `Bearer ${idToken}`;
    const suiteDeadline = Date.now() + SUITE_MAX_DURATION_MS;

    for (let index = 0; index < scenarios.length; index += 1) {
      const entry = scenarios[index];
      if (Date.now() >= suiteDeadline) {
        errors.push('The scheduled suite reached its 13-minute time limit.');
        break;
      }

      const controller = new AbortController();
      const limits = getNoraRedTeamRunLimits();
      const remainingMs = Math.max(1_000, suiteDeadline - Date.now());
      const scenarioTimeout = setTimeout(
        () => controller.abort(),
        Math.min(limits.maxDurationMs, remainingMs),
      );
      try {
        const run = await executeNoraRedTeamRun({
          authorization,
          bridgeOrigin: input.bridgeOrigin,
          featureId: input.featureId,
          firebaseMode: 'prod',
          firebaseProjectId: input.firebaseProjectId,
          scenario: entry.scenario,
          randomSeed: seedForScenario(startedAt, index),
          targetModel: input.targetModel,
          agentModel: input.agentModel,
          build: input.build,
          target: 'policy_sandbox',
          limits,
          signal: controller.signal,
        });
        const persistedRun = {
          ...run,
          evidencePolicy: {
            ...run.evidencePolicy,
            applicationPersistence: true,
            persistenceScope: 'protected_history' as const,
            retentionEndsAt: null,
          },
        };
        await historyStore.saveCompletedRun({
          run: persistedRun,
          ownerEmail: NORA_RED_TEAM_SCHEDULED_OWNER,
          firebaseMode: 'prod',
        });
        if (run.verdict === 'pass') passed += 1;
        else if (run.verdict === 'fail') failed += 1;
        else review += 1;
      } catch (error) {
        failed += 1;
        errors.push(`${entry.key}: ${safeError(error)}`);
      } finally {
        clearTimeout(scenarioTimeout);
      }

      completedScenarioIds = [...completedScenarioIds, entry.key];
      await suiteStore.update(input.suiteId, {
        completedScenarioIds,
        passed,
        failed,
        review,
        error: errors.length ? errors.join(' | ').slice(0, 1_500) : null,
      });
    }

    const completedAt = new Date().toISOString();
    const openCriticalBlockers = await historyStore.countOpenCriticalBlockers();
    const allCompleted = completedScenarioIds.length === suite.scenarioIds.length;
    await suiteStore.update(input.suiteId, {
      status: allCompleted ? 'completed' : 'failed',
      completedAt,
      completedScenarioIds,
      passed,
      failed,
      review,
      openCriticalBlockers,
      workerTokenHash: '',
      error: errors.length ? errors.join(' | ').slice(0, 1_500) : null,
    });
  } catch (error) {
    await suiteStore.update(input.suiteId, {
      status: 'failed',
      completedAt: new Date().toISOString(),
      completedScenarioIds,
      passed,
      failed,
      review,
      workerTokenHash: '',
      error: safeError(error),
    });
  }
}

export function createNoraRedTeamSuiteRecord(input: {
  suiteId: string;
  scenarioIds: string[];
  workerTokenHash: string;
  build: string;
  scheduled: boolean;
  now?: Date;
}): NoraRedTeamSuiteStoreRecord {
  const createdAt = (input.now || new Date()).toISOString();
  return {
    suiteId: input.suiteId,
    version: '0.4.0',
    contractVersion: '2026.08.20',
    status: 'queued',
    scheduled: input.scheduled,
    startedAt: null,
    completedAt: null,
    createdAt,
    scenarioIds: [...input.scenarioIds],
    completedScenarioIds: [],
    passed: 0,
    failed: 0,
    review: 0,
    openCriticalBlockers: 0,
    build: input.build,
    error: null,
    workerTokenHash: input.workerTokenHash,
  };
}
