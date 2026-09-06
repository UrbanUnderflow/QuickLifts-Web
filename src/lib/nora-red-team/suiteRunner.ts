import { NORA_EVERYDAY_SCENARIOS } from './everydayScenarios';
import { NORA_OPERATIONAL_SCENARIOS } from './operationalScenarios';
import { NoraScenarioLibrary } from './library';
import { NORA_RED_TEAM_VERSION, NORA_RED_TEAM_CONTRACT_VERSION } from './types';
import type * as FirebaseAdmin from 'firebase-admin';
import { executeNoraRedTeamRun, getNoraRedTeamRunLimits } from './execution';
import { NoraRedTeamHistoryStore } from './historyStore';
import { NORA_RED_TEAM_SCENARIOS } from './scenarios';
import { createSyntheticFirebaseIdToken } from './syntheticFirebaseAuth';
import {
  NoraRedTeamSuiteStore,
  type NoraRedTeamSuiteStoreRecord,
} from './suiteStore';
import type { NoraRedTeamRegressionCase, NoraRedTeamScenario } from './types';

export const NORA_RED_TEAM_SCHEDULED_OWNER =
  'nora-red-team-scheduled@redteam.invalid';
export const NORA_RED_TEAM_SCHEDULED_UID = 'nora-red-team-scheduled-runner';
const SUITE_MAX_DURATION_MS = 13 * 60 * 1000;

export function resolveNoraRedTeamScheduledBuild(
  input: {
    commitRef?: string;
    deployId?: string;
    publicCommitSha?: string;
  },
  now: Date = new Date(),
): string {
  const deployedBuild =
    input.commitRef?.trim() ||
    input.deployId?.trim() ||
    input.publicCommitSha?.trim();
  if (deployedBuild) return deployedBuild;

  // Netlify's build metadata is not guaranteed to be present in a scheduled
  // function runtime. A minute bucket permits deliberate same-day reruns while
  // keeping duplicate invocations of the same scheduled event idempotent.
  return `run${now.toISOString().slice(11, 16).replace(':', '')}`;
}

function scheduledBuildIdentity(build: string): string {
  return (
    build
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .slice(0, 10) || 'scheduled'
  );
}

export function createNoraRedTeamScheduledSuiteId(
  now: Date,
  build: string,
): string {
  return `nrt-suite-${now.toISOString().slice(0, 10).replace(/-/g, '')}-${scheduledBuildIdentity(build)}`;
}

export type NoraRedTeamSuiteScenario = {
  key: string;
  scenario: NoraRedTeamScenario;
};

export function buildNoraRedTeamSuiteScenarios(
  regressions: NoraRedTeamRegressionCase[],
  approved: NoraRedTeamScenario[] = [],
): NoraRedTeamSuiteScenario[] {
  const canonical = [
    ...NORA_RED_TEAM_SCENARIOS,
    ...NORA_EVERYDAY_SCENARIOS, ...NORA_OPERATIONAL_SCENARIOS,
    ...approved,
  ].map((scenario) => ({
    key: `catalog:${scenario.id}`,
    scenario,
  }));
  const promoted = regressions
    .filter((regression) => regression.enabled)
    .map((regression) => {
      const suffix =
        regression.sourceRunId.replace(/[^a-z0-9]/gi, '').slice(-10) ||
        'promoted';
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
  return Math.min(2_147_483_647, date * 100 + index + 1);
}

function safeError(error: unknown): string {
  return (error instanceof Error ? error.message : String(error))
    .replace(/Bearer\s+\S+/gi, 'Bearer [redacted]')
    .slice(0, 240);
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
  const runIds: string[] = [];
  let persistQueue: Promise<void> = Promise.resolve();

  try {
    const regressions = await historyStore.listEnabledRegressions();
    const scenarios =
      suite.scenarios ||
      buildNoraRedTeamSuiteScenarios(
        regressions,
        await new NoraScenarioLibrary(firestore).approved(),
      );
    if (
      scenarios.map(({ key }) => key).join('|') !== suite.scenarioIds.join('|')
    ) {
      throw new Error(
        'SUITE_CATALOG_CHANGED: Scheduled scenario inputs changed after the suite was queued.',
      );
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

    const runOne = async (index: number) => {
      const entry = scenarios[index];
      if (Date.now() >= suiteDeadline) {
        errors.push('The scheduled suite reached its 13-minute time limit.');
        return;
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
          firebaseMode: suite.firebaseMode || 'prod',
          firebaseProjectId: input.firebaseProjectId,
          scenario: entry.scenario,
          randomSeed: seedForScenario(startedAt, index),
          targetModel: suite.targetModel || input.targetModel,
          agentModel: suite.agentModel || input.agentModel,
          build: suite.build || input.build,
          target: suite.target || 'policy_sandbox',
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
          firebaseMode: suite.firebaseMode || 'prod',
        });
        if (run.verdict === 'fail') failed += 1;
        else if (run.humanReviewRequired || run.verdict === 'review')
          review += 1;
        else if (run.verdict === 'pass') passed += 1;
        else review += 1;
        runIds.push(run.runId);
      } catch (error) {
        failed += 1;
        errors.push(`${entry.key}: ${safeError(error)}`);
      } finally {
        clearTimeout(scenarioTimeout);
      }

      completedScenarioIds = [...completedScenarioIds, entry.key];
      persistQueue = persistQueue.then(() =>
        suiteStore.update(input.suiteId, {
          completedScenarioIds: [...completedScenarioIds],
          runIds: [...runIds],
          passed,
          failed,
          review,
          error: errors.length ? errors.join(' | ').slice(0, 1_500) : null,
        }),
      );
      await persistQueue;
    };
    let nextIndex = 0;
    await Promise.all(
      Array.from({ length: 3 }, async () => {
        while (nextIndex < scenarios.length) {
          const index = nextIndex++;
          await runOne(index);
        }
      }),
    );

    const completedAt = new Date().toISOString();
    const openCriticalBlockers = await historyStore.countOpenCriticalBlockers();
    const allCompleted =
      completedScenarioIds.length === suite.scenarioIds.length;
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
    version: NORA_RED_TEAM_VERSION,
    contractVersion: NORA_RED_TEAM_CONTRACT_VERSION,
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
