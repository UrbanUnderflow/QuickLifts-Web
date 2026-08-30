import { createHash } from 'node:crypto';
import {
  NoraRedTeamRuntimeError,
  type NoraRedTeamBudgetSnapshot,
} from './boundedModelClient';
import { executeNoraRedTeamRun } from './execution';
import type {
  NoraRedTeamExecutionProgress,
} from './execution';
import type {
  NoraRedTeamJobError,
  NoraRedTeamJobProgress,
} from './types';
import type {
  NoraRedTeamJobStore,
} from './jobStore';
import type { NoraRedTeamHistoryStore } from './historyStore';
import { getNoraRedTeamScenario } from './scenarios';

const controllerGlobal = globalThis as typeof globalThis & {
  __noraRedTeamJobControllers?: Map<string, AbortController>;
};

function jobControllers(): Map<string, AbortController> {
  if (!controllerGlobal.__noraRedTeamJobControllers) {
    controllerGlobal.__noraRedTeamJobControllers = new Map();
  }
  return controllerGlobal.__noraRedTeamJobControllers;
}

export function hashNoraRedTeamWorkerToken(workerToken: string): string {
  return createHash('sha256').update(workerToken).digest('hex');
}

function safeJobError(error: unknown, timedOut: boolean): NoraRedTeamJobError {
  const rawMessage = error instanceof Error ? error.message : String(error);
  const runtimeCode = error instanceof NoraRedTeamRuntimeError ? error.code : '';
  if (timedOut || runtimeCode === 'NORA_RED_TEAM_TIME_LIMIT_EXCEEDED') {
    return {
      code: 'NORA_RED_TEAM_TIME_LIMIT_EXCEEDED',
      message: 'The run reached its time limit and was stopped. No result was saved.',
    };
  }
  if (runtimeCode === 'NORA_RED_TEAM_COST_LIMIT_EXCEEDED') {
    return {
      code: runtimeCode,
      message: 'The run reached its cost limit and was stopped. No result was saved.',
    };
  }
  if (runtimeCode === 'NORA_RED_TEAM_REQUEST_TIMEOUT') {
    return {
      code: runtimeCode,
      message: 'A model request timed out after the bounded retry. No result was saved.',
    };
  }
  if (/ESCALATION_(?:POLICY|CLASSIFICATION)_UNAVAILABLE/i.test(rawMessage)) {
    return {
      code: 'ESCALATION_POLICY_UNAVAILABLE',
      message: 'The production escalation safety check is unavailable. No result was saved.',
      detail: rawMessage.slice(0, 180),
    };
  }
  if (/STAGING_REQUIRES_DEVELOPMENT/i.test(rawMessage)) {
    return {
      code: 'STAGING_REQUIRES_DEVELOPMENT',
      message: 'Staging chat runs require the development database. No production data was touched.',
    };
  }
  if (/STAGING_AUTH/i.test(rawMessage)) {
    return {
      code: 'STAGING_AUTH_UNAVAILABLE',
      message: 'The signed synthetic staging account could not be created. No scenario result was saved.',
      detail: rawMessage.slice(0, 180),
    };
  }
  if (/STAGING_ENDPOINT_OUTDATED/i.test(rawMessage)) {
    return {
      code: 'STAGING_ENDPOINT_OUTDATED',
      message: 'The staging chat endpoint does not yet expose the synthetic no-contact lock. No result was saved.',
    };
  }
  if (/STAGING_CHAT_FAILED/i.test(rawMessage)) {
    return {
      code: 'STAGING_CHAT_FAILED',
      message: 'The real staging chat endpoint could not complete the scenario. No result was saved.',
      detail: rawMessage.slice(0, 180),
    };
  }
  if (/bridge|fetch failed|openai/i.test(rawMessage)) {
    return {
      code: 'AI_BRIDGE_UNAVAILABLE',
      message: 'The OpenAI bridge could not complete the red-team run. No result was saved.',
      detail: rawMessage.slice(0, 180),
    };
  }
  return {
    code: 'RED_TEAM_RUN_FAILED',
    message: 'The red-team run could not be completed. No result was saved.',
    detail: rawMessage.slice(0, 180),
  };
}

function progressWithBudget(
  progress: NoraRedTeamJobProgress,
  snapshot: NoraRedTeamBudgetSnapshot,
): NoraRedTeamJobProgress {
  return {
    ...progress,
    modelCalls: snapshot.modelCalls,
    retryCount: snapshot.retryCount,
    usage: { ...snapshot.usage },
    updatedAt: new Date().toISOString(),
  };
}

export function abortLocalNoraRedTeamJob(jobId: string): boolean {
  const controller = jobControllers().get(jobId);
  if (!controller) return false;
  controller.abort();
  return true;
}

export async function executeNoraRedTeamJob(input: {
  store: NoraRedTeamJobStore;
  jobId: string;
  authorization: string;
  bridgeOrigin: string;
  featureId: string;
  historyStore?: NoraRedTeamHistoryStore;
}): Promise<void> {
  const startedAt = new Date().toISOString();
  const job = await input.store.claim(input.jobId, startedAt);
  if (!job) return;
  const scenario = getNoraRedTeamScenario(job.scenarioId);
  if (!scenario) {
    await input.store.update(job.jobId, {
      status: 'failed',
      completedAt: new Date().toISOString(),
      error: { code: 'INVALID_SCENARIO', message: 'The queued red-team scenario no longer exists.' },
    });
    return;
  }

  const controller = new AbortController();
  jobControllers().set(job.jobId, controller);
  let timedOut = false;
  let cancellationRequested = false;
  let checkingCancellation = false;
  let progress: NoraRedTeamJobProgress = {
    ...job.progress,
    stage: 'loading_policy',
    percent: 2,
    message: 'Starting the bounded red-team worker.',
    updatedAt: startedAt,
  };
  await input.store.update(job.jobId, { progress });

  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, job.limits.maxDurationMs);
  const cancellationMonitor = setInterval(async () => {
    if (checkingCancellation || controller.signal.aborted) return;
    checkingCancellation = true;
    try {
      const latest = await input.store.get(job.jobId);
      if (latest?.cancelRequested || latest?.status === 'cancelling' || latest?.status === 'cancelled') {
        cancellationRequested = true;
        controller.abort();
      }
    } catch (error) {
      console.warn('[nora-red-team] Cancellation status check failed.', {
        jobId: job.jobId,
        error: error instanceof Error ? error.message.slice(0, 160) : String(error).slice(0, 160),
      });
    } finally {
      checkingCancellation = false;
    }
  }, 750);

  const updateProgress = async (next: NoraRedTeamExecutionProgress) => {
    progress = {
      ...progress,
      stage: next.stage,
      percent: Math.max(progress.percent, Math.min(99, Math.round(next.percent))),
      message: next.message,
      usage: { ...next.usage },
      updatedAt: new Date().toISOString(),
    };
    await input.store.update(job.jobId, { progress });
  };
  const updateBudget = async (snapshot: NoraRedTeamBudgetSnapshot) => {
    progress = progressWithBudget(progress, snapshot);
    await input.store.update(job.jobId, { progress });
  };

  try {
    const run = await executeNoraRedTeamRun({
      authorization: input.authorization,
      bridgeOrigin: input.bridgeOrigin,
      featureId: input.featureId,
      firebaseMode: job.firebaseMode,
      firebaseProjectId: job.firebaseProjectId,
      scenario,
      randomSeed: job.randomSeed,
      targetModel: job.targetModel,
      agentModel: job.agentModel,
      build: job.build,
      target: job.target,
      limits: job.limits,
      signal: controller.signal,
      onProgress: updateProgress,
      onBudgetUpdate: updateBudget,
    });
    if (cancellationRequested || controller.signal.aborted) {
      throw new NoraRedTeamRuntimeError('NORA_RED_TEAM_CANCELLED', 'The red-team run was cancelled.');
    }
    const completedAt = new Date().toISOString();
    const persistedRun = {
      ...run,
      evidencePolicy: {
        ...run.evidencePolicy,
        applicationPersistence: Boolean(input.historyStore) || input.store.kind === 'temporary_firestore',
        persistenceScope: input.historyStore
          ? 'protected_history' as const
          : input.store.kind === 'temporary_firestore'
            ? 'temporary_job_state' as const
            : 'none' as const,
        retentionEndsAt: input.historyStore ? null : input.store.kind === 'temporary_firestore' ? job.expiresAt : null,
      },
    };
    if (input.historyStore) {
      await input.historyStore.saveCompletedRun({
        run: persistedRun,
        ownerEmail: job.ownerEmail,
        firebaseMode: job.firebaseMode,
      });
    }
    await input.store.update(job.jobId, {
      status: 'completed',
      completedAt,
      run: persistedRun,
      workerTokenHash: '',
      progress: {
        ...progress,
        stage: 'completed',
        percent: 100,
        message: 'The red-team run completed.',
        usage: { ...run.usage },
        updatedAt: completedAt,
      },
    });
  } catch (error) {
    const latest = await input.store.get(job.jobId);
    const wasCancelled = cancellationRequested
      || latest?.cancelRequested
      || (controller.signal.aborted && !timedOut);
    const completedAt = new Date().toISOString();
    if (wasCancelled) {
      await input.store.update(job.jobId, {
        status: 'cancelled',
        completedAt,
        run: null,
        error: null,
        workerTokenHash: '',
        progress: {
          ...progress,
          stage: 'cancelled',
          message: 'The red-team run was cancelled. No result was saved.',
          updatedAt: completedAt,
        },
      });
    } else {
      const safeError = safeJobError(error, timedOut);
      await input.store.update(job.jobId, {
        status: 'failed',
        completedAt,
        run: null,
        error: safeError,
        workerTokenHash: '',
        progress: {
          ...progress,
          stage: 'failed',
          message: safeError.message,
          updatedAt: completedAt,
        },
      });
    }
  } finally {
    clearTimeout(timeout);
    clearInterval(cancellationMonitor);
    jobControllers().delete(job.jobId);
  }
}
