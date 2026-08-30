import type {
  NoraRedTeamModelClient,
  NoraRedTeamResponseRequest,
} from './modelClient';
import type {
  NoraRedTeamRunLimits,
  NoraRedTeamUsage,
} from './types';

export type NoraRedTeamBudgetSnapshot = {
  modelCalls: number;
  retryCount: number;
  usage: NoraRedTeamUsage;
};

export class NoraRedTeamRuntimeError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'NoraRedTeamRuntimeError';
    this.code = code;
  }
}

function emptyUsage(): NoraRedTeamUsage {
  return { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
}

function requestText(request: NoraRedTeamResponseRequest): string {
  return request.input.map((message) => {
    if (typeof message.content === 'string') return message.content;
    return message.content.map((part) => part.text || '').join('\n');
  }).join('\n');
}

function estimateInputTokens(request: NoraRedTeamResponseRequest): number {
  // The red-team corpus is English ASCII. Two characters per token is a
  // deliberately conservative preflight estimate for the hard run budget.
  return Math.max(1, Math.ceil(requestText(request).length / 2));
}

function completionBudget(request: NoraRedTeamResponseRequest): number {
  const requested = Math.max(1, request.max_output_tokens || 1);
  return /^gpt-5/i.test(request.model) ? Math.max(4096, requested) : requested;
}

function responseUsage(
  request: NoraRedTeamResponseRequest,
  response: Awaited<ReturnType<NoraRedTeamModelClient['responses']['create']>>,
): NoraRedTeamUsage {
  const inputTokens = response.usage?.input_tokens || estimateInputTokens(request);
  const outputTokens = response.usage?.output_tokens
    || Math.max(1, Math.ceil(response.output_text.length / 2));
  return {
    inputTokens,
    outputTokens,
    totalTokens: response.usage?.total_tokens || inputTokens + outputTokens,
  };
}

function isRetryableError(error: unknown): boolean {
  if (
    error instanceof NoraRedTeamRuntimeError
    && error.code === 'NORA_RED_TEAM_REQUEST_TIMEOUT'
  ) {
    return true;
  }
  const message = error instanceof Error ? error.message : String(error);
  return /\b(?:408|429|500|502|503|504)\b|fetch failed|network|econnreset|etimedout|request timeout/i.test(message);
}

function throwIfCancelled(signal: AbortSignal): void {
  if (signal.aborted) {
    throw new NoraRedTeamRuntimeError('NORA_RED_TEAM_CANCELLED', 'The red-team run was cancelled.');
  }
}

async function waitForRetry(delayMs: number, signal: AbortSignal): Promise<void> {
  throwIfCancelled(signal);
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, delayMs);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new NoraRedTeamRuntimeError('NORA_RED_TEAM_CANCELLED', 'The red-team run was cancelled.'));
    };
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

export function createBoundedNoraRedTeamModelClient(input: {
  client: NoraRedTeamModelClient;
  signal: AbortSignal;
  limits: NoraRedTeamRunLimits;
  onBudgetUpdate?: (snapshot: NoraRedTeamBudgetSnapshot) => void | Promise<void>;
}): NoraRedTeamModelClient {
  const startedAt = Date.now();
  const state: NoraRedTeamBudgetSnapshot = {
    modelCalls: 0,
    retryCount: 0,
    usage: emptyUsage(),
  };

  const notify = async () => {
    await input.onBudgetUpdate?.({
      modelCalls: state.modelCalls,
      retryCount: state.retryCount,
      usage: { ...state.usage },
    });
  };

  return {
    responses: {
      create: async (request) => {
        let lastError: unknown = null;

        for (let attempt = 0; attempt <= input.limits.maxRetriesPerRequest; attempt += 1) {
          throwIfCancelled(input.signal);
          if (Date.now() - startedAt >= input.limits.maxDurationMs) {
            throw new NoraRedTeamRuntimeError(
              'NORA_RED_TEAM_TIME_LIMIT_EXCEEDED',
              'The red-team run reached its time limit.',
            );
          }
          if (state.modelCalls >= input.limits.maxModelCalls) {
            throw new NoraRedTeamRuntimeError(
              'NORA_RED_TEAM_COST_LIMIT_EXCEEDED',
              'The red-team run reached its model-call limit.',
            );
          }

          const reservedTokens = estimateInputTokens(request) + completionBudget(request);
          if (state.usage.totalTokens + reservedTokens > input.limits.maxTotalTokens) {
            throw new NoraRedTeamRuntimeError(
              'NORA_RED_TEAM_COST_LIMIT_EXCEEDED',
              'The red-team run reached its token budget.',
            );
          }

          state.modelCalls += 1;
          await notify();

          const attemptController = new AbortController();
          let timedOut = false;
          const onParentAbort = () => attemptController.abort();
          input.signal.addEventListener('abort', onParentAbort, { once: true });
          const timeout = setTimeout(() => {
            timedOut = true;
            attemptController.abort();
          }, input.limits.requestTimeoutMs);

          try {
            const response = await input.client.responses.create(request, {
              signal: attemptController.signal,
            });
            const usage = responseUsage(request, response);
            state.usage.inputTokens += usage.inputTokens;
            state.usage.outputTokens += usage.outputTokens;
            state.usage.totalTokens += usage.totalTokens;
            await notify();
            return response;
          } catch (error) {
            if (input.signal.aborted) throwIfCancelled(input.signal);
            lastError = timedOut
              ? new NoraRedTeamRuntimeError(
                  'NORA_RED_TEAM_REQUEST_TIMEOUT',
                  `A model request exceeded ${input.limits.requestTimeoutMs} ms.`,
                )
              : error;
            if (attempt >= input.limits.maxRetriesPerRequest || !isRetryableError(lastError)) {
              throw lastError;
            }
            state.retryCount += 1;
            await notify();
            await waitForRetry(300 * (attempt + 1), input.signal);
          } finally {
            clearTimeout(timeout);
            input.signal.removeEventListener('abort', onParentAbort);
          }
        }

        throw lastError || new NoraRedTeamRuntimeError(
          'NORA_RED_TEAM_RUN_FAILED',
          'The bounded model request did not complete.',
        );
      },
    },
  };
}
