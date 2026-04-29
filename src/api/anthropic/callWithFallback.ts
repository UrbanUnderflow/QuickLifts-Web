// Dual-path helper for Phase B+ migrations.
//
// Use this only for features with `fallbackProvider` set in featureRouting.ts
// (PulseCheck dual-path family). Macra full-cutover endpoints call Anthropic
// directly — no helper needed.
//
// Behavior: try Anthropic first. On any thrown error from `anthropicCall`,
// invoke `openaiCall`, log the fallback to Firestore, and return its result.
// Errors from `openaiCall` propagate (we ran out of fallbacks).
//
// Removal post-pilot: delete this file, swap call sites to `anthropicCall()`.
//
// TODO(netlify-rewrite-when-client-side): Phase B+ Part 2 endpoints all run
// server-side (Netlify functions / Next.js API routes calling the Anthropic
// SDK directly), so no `/api/anthropic/*` rewrite is needed yet. Once a
// client-side caller (browser, iOS) needs to hit the bridge as a proxy, add
// to netlify.toml:
//   [[redirects]]
//     from = "/api/anthropic/*"
//     to   = "/.netlify/functions/anthropic-bridge/:splat"
//     status = 200

import type { FeatureRoutingConfig } from './featureRouting';

const FALLBACK_LOG_COLLECTION = 'pulsecheck-bridge-fallback-log';

export interface FallbackLogEntry {
  featureId: string;
  migrationModeId: string;
  errorReason: string;
  timestamp: number;
  uid?: string;
}

// Optional Firestore admin client. Decoupled so this module can be imported
// from contexts that haven't initialized firebase-admin (tests, browser).
export interface FallbackLogger {
  logFallback(entry: FallbackLogEntry): Promise<void>;
}

export const buildAdminFallbackLogger = (
  firestore: { collection: (name: string) => { add: (doc: any) => Promise<unknown> } },
): FallbackLogger => ({
  async logFallback(entry) {
    try {
      await firestore.collection(FALLBACK_LOG_COLLECTION).add({
        ...entry,
        recordedAt: new Date(entry.timestamp).toISOString(),
      });
    } catch (err) {
      // Never let logging failures shadow the fallback success.
      console.warn('[callWithFallback] Failed to log fallback:', err);
    }
  },
});

export interface CallWithFallbackOptions<TResult> {
  feature: FeatureRoutingConfig;
  anthropicCall: () => Promise<TResult>;
  openaiCall: () => Promise<TResult>;
  logger?: FallbackLogger;
  uid?: string;
}

export interface CallWithFallbackResult<TResult> {
  result: TResult;
  providerUsed: 'anthropic' | 'openai';
  fallbackTriggered: boolean;
  errorReason?: string;
}

const errorReasonOf = (error: unknown): string => {
  if (error instanceof Error) return error.message.slice(0, 500);
  if (typeof error === 'string') return error.slice(0, 500);
  try {
    return JSON.stringify(error).slice(0, 500);
  } catch {
    return 'unknown error';
  }
};

export const callWithFallback = async <TResult>(
  options: CallWithFallbackOptions<TResult>,
): Promise<CallWithFallbackResult<TResult>> => {
  const { feature, anthropicCall, openaiCall, logger, uid } = options;

  if (feature.provider !== 'anthropic') {
    // Caller misconfigured — Anthropic is always the primary path here.
    throw new Error(
      `callWithFallback expects feature.provider === 'anthropic' (got '${feature.provider}')`,
    );
  }

  if (!feature.fallbackProvider) {
    // No fallback configured — call Anthropic and let any error propagate.
    const result = await anthropicCall();
    return { result, providerUsed: 'anthropic', fallbackTriggered: false };
  }

  try {
    const result = await anthropicCall();
    return { result, providerUsed: 'anthropic', fallbackTriggered: false };
  } catch (anthropicError) {
    const errorReason = errorReasonOf(anthropicError);
    console.warn(
      `[callWithFallback] Anthropic path failed for ${feature.featureId}; falling back to ${feature.fallbackProvider}.`,
      { errorReason },
    );

    if (logger) {
      await logger.logFallback({
        featureId: feature.featureId,
        migrationModeId: feature.migrationModeId,
        errorReason,
        timestamp: Date.now(),
        uid,
      });
    }

    const result = await openaiCall();
    return {
      result,
      providerUsed: feature.fallbackProvider,
      fallbackTriggered: true,
      errorReason,
    };
  }
};
