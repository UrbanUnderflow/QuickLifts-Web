// =============================================================================
// serverBridge — single chokepoint for all server-side Anthropic traffic.
//
// Doctrine:
//   - Every Anthropic call from server-side code goes through `callAnthropic`.
//   - The HTTP bridge (`netlify/functions/anthropic-bridge.ts`) is a thin
//     transport layer over this Core: parse auth + JSON, then delegate.
//   - Server-side callers (Macra endpoints, Phase C translateForAthlete,
//     Phase D reply classifier) call `callAnthropic` directly — no HTTP
//     round-trip back to the bridge.
//
// What the Core enforces (consistent across both transports):
//   1. Feature must be registered in `featureRouting.ts`
//   2. Feature provider must be `'anthropic'`
//   3. Model must match feature `modelPattern` (env-cap regex)
//   4. `max_tokens` is capped at min(feature.maxTokens, env-cap, 16000)
//   5. Audit log written to `pulsecheck-anthropic-audit-log` for every
//      success + failure (Phase G can read this for cost attribution)
//
// What the Core does NOT do (caller responsibilities):
//   - Firebase auth (transport layer; server callers are pre-trusted)
//   - Network egress allow-listing (env config)
//   - Provider failover — that's `callWithFallback` for dual-path features
//     (Core stays single-provider; fallback wraps it)
//
// Migration semantics:
//   - Pass-through for tool-use, system, messages, model overrides
//   - Returns the raw SDK Message so callers can inspect tool_use blocks,
//     usage tokens, stop_reason — no shape lossy conversion
// =============================================================================

import Anthropic from '@anthropic-ai/sdk';
import {
  ANTHROPIC_FEATURE_LIMITS,
  FeatureRoutingConfig,
  getFeatureRouting,
} from './featureRouting';

const AUDIT_LOG_COLLECTION = 'pulsecheck-anthropic-audit-log';
const GLOBAL_MAX_TOKENS_FALLBACK = 16000;

// ──────────────────────────────────────────────────────────────────────────────
// Public types
// ──────────────────────────────────────────────────────────────────────────────

/** Minimal Anthropic SDK shape we depend on. Lets tests inject a fake
 *  client without dragging the full SDK type tree. The real SDK satisfies
 *  this trivially. */
export interface AnthropicLike {
  messages: {
    create: (
      args: Anthropic.Messages.MessageCreateParamsNonStreaming,
    ) => Promise<Anthropic.Messages.Message>;
  };
}

export interface AuditLogger {
  recordCall(entry: AnthropicAuditEntry): Promise<void>;
}

export interface AnthropicAuditEntry {
  featureId: string;
  /** Feature config snapshot at call time (model + maxTokens). */
  model: string;
  resolvedMaxTokens: number;
  /** Whether the call succeeded at the SDK level. */
  success: boolean;
  /** Anthropic's stop_reason or 'error' on failure. */
  stopReason?: string;
  /** Top-level error class — `error.name` from the SDK if it threw. */
  errorCode?: string;
  /** Truncated error message; never logs sensitive data from prompt. */
  errorReasonExcerpt?: string;
  /** Token usage from the SDK response. */
  inputTokens?: number;
  outputTokens?: number;
  /** Caller context — e.g. uid, conversationId, athleteId. */
  callerContext?: Record<string, unknown>;
  timestamp: number;
}

export interface CallAnthropicInput {
  featureId: string;
  system: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  /** Override the feature's default token cap. Capped at feature.maxTokens. */
  maxTokens?: number;
  /** Override the feature's default model. Must match feature modelPattern. */
  model?: string;
  /** Forced tool-use config for structured outputs (Macra meal plan, etc).
   *  Passed through to the SDK unchanged. */
  tools?: Anthropic.Messages.MessageCreateParams['tools'];
  toolChoice?: Anthropic.Messages.MessageCreateParams['tool_choice'];
  /** Audit metadata captured in `callerContext` on the audit log. */
  callerContext?: Record<string, unknown>;
}

export interface CallAnthropicResult {
  /** Raw SDK response — callers can inspect content blocks, usage, etc. */
  raw: Anthropic.Messages.Message;
  /** Convenience: concatenated text from all `text` content blocks. */
  text: string;
  /** Convenience: input field of the matching forced tool_use block, if any. */
  toolUseInput?: unknown;
  /** Feature config the call was validated against. */
  feature: FeatureRoutingConfig;
}

export interface CallAnthropicDeps {
  client?: AnthropicLike;
  auditLogger?: AuditLogger | null;
}

// ──────────────────────────────────────────────────────────────────────────────
// Errors thrown by the Core. The HTTP transport translates these into
// status codes; server callers can catch + handle as Errors.
// ──────────────────────────────────────────────────────────────────────────────

export class ServerBridgeFeatureNotRegisteredError extends Error {
  readonly featureId: string;
  constructor(featureId: string) {
    super(`feature '${featureId}' is not registered in featureRouting`);
    this.name = 'ServerBridgeFeatureNotRegisteredError';
    this.featureId = featureId;
  }
}

export class ServerBridgeProviderMismatchError extends Error {
  constructor(featureId: string, provider: string) {
    super(`feature '${featureId}' provider is '${provider}' (Core supports anthropic only)`);
    this.name = 'ServerBridgeProviderMismatchError';
  }
}

export class ServerBridgeForbiddenModelError extends Error {
  readonly attemptedModel: string;
  constructor(featureId: string, attemptedModel: string) {
    super(`model '${attemptedModel}' rejected by feature '${featureId}' modelPattern`);
    this.name = 'ServerBridgeForbiddenModelError';
    this.attemptedModel = attemptedModel;
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Validation helpers
// ──────────────────────────────────────────────────────────────────────────────

const resolveEnvMaxTokensCap = (): number => {
  const raw = process.env.ANTHROPIC_MAX_TOKENS;
  if (!raw) return GLOBAL_MAX_TOKENS_FALLBACK;
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : GLOBAL_MAX_TOKENS_FALLBACK;
};

/**
 * Resolve the effective max_tokens given (a) caller's requested cap,
 * (b) feature config cap, (c) global env cap. The minimum wins.
 */
export const resolveEffectiveMaxTokens = (
  feature: FeatureRoutingConfig,
  callerRequested?: number,
): number => {
  const envCap = resolveEnvMaxTokensCap();
  const featureCap = feature.maxTokens;
  const callerCap =
    typeof callerRequested === 'number' && Number.isFinite(callerRequested) && callerRequested > 0
      ? callerRequested
      : featureCap;
  return Math.min(callerCap, featureCap, envCap);
};

/**
 * Validate the request envelope against the registered feature config.
 * Throws on misuse so server-side callers fail loudly during tests +
 * during a deploy preview rather than silently sending forbidden models.
 */
export const validateCallRequest = (
  input: CallAnthropicInput,
): { feature: FeatureRoutingConfig; resolvedModel: string; resolvedMaxTokens: number } => {
  const feature = getFeatureRouting(input.featureId);
  if (!feature) throw new ServerBridgeFeatureNotRegisteredError(input.featureId);
  if (feature.provider !== 'anthropic') {
    throw new ServerBridgeProviderMismatchError(input.featureId, feature.provider);
  }
  const resolvedModel = input.model || feature.model;
  const limits =
    ANTHROPIC_FEATURE_LIMITS[input.featureId] || ANTHROPIC_FEATURE_LIMITS['default'];
  if (!limits.modelPattern.test(resolvedModel)) {
    throw new ServerBridgeForbiddenModelError(input.featureId, resolvedModel);
  }
  const resolvedMaxTokens = resolveEffectiveMaxTokens(feature, input.maxTokens);
  return { feature, resolvedModel, resolvedMaxTokens };
};

// ──────────────────────────────────────────────────────────────────────────────
// Core call
// ──────────────────────────────────────────────────────────────────────────────

const resolveClient = (deps?: CallAnthropicDeps): AnthropicLike => {
  if (deps?.client) return deps.client;
  // The real SDK reads ANTHROPIC_API_KEY from env. The audit-log path
  // never logs the key.
  return new Anthropic() as unknown as AnthropicLike;
};

const errorReasonExcerpt = (error: unknown): string => {
  if (error instanceof Error) return error.message.slice(0, 500);
  if (typeof error === 'string') return error.slice(0, 500);
  try {
    return JSON.stringify(error).slice(0, 500);
  } catch {
    return 'unknown error';
  }
};

const errorCodeOf = (error: unknown): string => {
  if (error instanceof Error) return error.name;
  return 'UnknownError';
};

const concatTextBlocks = (msg: Anthropic.Messages.Message): string => {
  return (msg.content || [])
    .filter((block): block is Anthropic.Messages.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('')
    .trim();
};

const findToolUseInput = (
  msg: Anthropic.Messages.Message,
  toolName?: string,
): unknown | undefined => {
  if (!toolName) return undefined;
  const block = (msg.content || []).find(
    (b): b is Anthropic.Messages.ToolUseBlock => b.type === 'tool_use' && b.name === toolName,
  );
  return block?.input;
};

/**
 * Single-provider Anthropic call gated by feature config + audit-logged.
 * This is the function the HTTP bridge delegates to AND the function
 * server-side callers (Macra, Phase C, Phase D) call directly.
 */
export const callAnthropic = async (
  input: CallAnthropicInput,
  deps: CallAnthropicDeps = {},
): Promise<CallAnthropicResult> => {
  const { feature, resolvedModel, resolvedMaxTokens } = validateCallRequest(input);
  const client = resolveClient(deps);
  const startedAt = Date.now();

  // Build the SDK request envelope. Caller-provided tool_choice + tools
  // pass through unchanged so Macra forced-tool flows keep working.
  const params: Anthropic.Messages.MessageCreateParamsNonStreaming = {
    model: resolvedModel,
    max_tokens: resolvedMaxTokens,
    system: input.system,
    messages: input.messages,
    ...(input.tools ? { tools: input.tools } : {}),
    ...(input.toolChoice ? { tool_choice: input.toolChoice } : {}),
  };

  let raw: Anthropic.Messages.Message;
  try {
    raw = await client.messages.create(params);
  } catch (err) {
    if (deps.auditLogger) {
      await deps.auditLogger
        .recordCall({
          featureId: input.featureId,
          model: resolvedModel,
          resolvedMaxTokens,
          success: false,
          errorCode: errorCodeOf(err),
          errorReasonExcerpt: errorReasonExcerpt(err),
          callerContext: input.callerContext,
          timestamp: startedAt,
        })
        .catch(() => {
          /* never let audit failures shadow upstream errors */
        });
    }
    throw err;
  }

  // Resolve forced tool input if the caller asked for one specifically.
  // (toolChoice.type === 'tool' carries a `name` field per the SDK.)
  const forcedToolName =
    input.toolChoice && (input.toolChoice as { type?: string; name?: string }).type === 'tool'
      ? (input.toolChoice as { name?: string }).name
      : undefined;
  const toolUseInput = findToolUseInput(raw, forcedToolName);

  if (deps.auditLogger) {
    await deps.auditLogger
      .recordCall({
        featureId: input.featureId,
        model: resolvedModel,
        resolvedMaxTokens,
        success: true,
        stopReason: raw.stop_reason || undefined,
        inputTokens: raw.usage?.input_tokens,
        outputTokens: raw.usage?.output_tokens,
        callerContext: input.callerContext,
        timestamp: startedAt,
      })
      .catch(() => {
        /* swallow */
      });
  }

  return {
    raw,
    text: concatTextBlocks(raw),
    toolUseInput,
    feature,
  };
};

// ──────────────────────────────────────────────────────────────────────────────
// Default audit logger backed by Firestore admin SDK. Server-side callers
// pass an instance of this; tests can pass a stub or `null` to skip logging.
// ──────────────────────────────────────────────────────────────────────────────

export interface FirestoreLikeAdmin {
  collection: (name: string) => {
    add: (doc: Record<string, unknown>) => Promise<unknown>;
  };
}

export const buildAdminAuditLogger = (firestore: FirestoreLikeAdmin): AuditLogger => ({
  async recordCall(entry) {
    try {
      await firestore.collection(AUDIT_LOG_COLLECTION).add({
        ...entry,
        recordedAt: new Date(entry.timestamp).toISOString(),
      });
    } catch (err) {
      console.warn('[serverBridge] Failed to write audit log:', err);
    }
  },
});

export const SERVER_BRIDGE_AUDIT_LOG_COLLECTION = AUDIT_LOG_COLLECTION;
