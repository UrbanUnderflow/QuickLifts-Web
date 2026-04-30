// Phase C — Adaptive Framing Layer translation runtime.
//
// Server-side entry point that turns a structured signal interpretation +
// (domain, state) lookup into athlete-facing language in Nora's voice.
// Anthropic-only with seed fallback. Every production call writes one audit
// row to pulsecheck-nora-translation-log for Phase G.

import Anthropic from '@anthropic-ai/sdk';
import * as admin from 'firebase-admin';
import { NORA_ATHLETE_TRANSLATION } from '../../anthropic/featureRouting';
import { runAthletePhrasingGuardrails } from './guardrails';
import {
  logTranslation,
  TranslationFallbackReason,
  TranslationLogEntry,
  TranslationProviderUsed,
} from './translationLog';
import {
  OFF_LIMITS_CONFIG_COLLECTION,
  OFF_LIMITS_CONFIG_DOCUMENT_ID,
  OffLimitsConfig,
  TRANSLATION_DOMAINS,
  TRANSLATION_TABLE_COLLECTION,
  TranslationDomain,
  TranslationRow,
  ValidationIssue,
  VoiceReviewStatus,
} from './types';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface TranslateForAthleteInput {
  athleteUserId: string;
  signal: Record<string, unknown>;
  domain: TranslationDomain;
  state: string;
  // Loose by design — Phase D (orchestrator) will type this once the real
  // signal shape is stable. Strings keep the prompt simple.
  additionalContext?: Record<string, string>;
  persistLog?: boolean;
}

export interface TranslationResult {
  phrasing: string;
  providerUsed: TranslationProviderUsed;
  fallbackTriggered: boolean;
  fallbackReason?: TranslationFallbackReason;
  guardrailViolations: ValidationIssue[];
  voiceReviewStatus: VoiceReviewStatus;
  translationRowRevision: string;
  // ALWAYS populated on dry-run (persistLog: false) so Phase E's voice-review
  // UI can compare Claude's raw output to the final phrasing. On production
  // calls (persistLog: true), only set when fallbackTriggered is true.
  claudeOutputRaw?: string;
}

// Minimal Anthropic SDK shape we use. Lets tests inject a fake without
// needing the full SDK type tree.
export interface AnthropicLike {
  messages: {
    create: (args: {
      model: string;
      max_tokens: number;
      system: string;
      messages: Array<{ role: 'user' | 'assistant'; content: string }>;
    }) => Promise<{ content: Array<{ type: string; text?: string }> }>;
  };
}

export interface TranslateForAthleteDeps {
  firestore?: admin.firestore.Firestore;
  anthropicClient?: AnthropicLike;
}

// ---------------------------------------------------------------------------
// Firestore loaders (admin SDK — server-side only)
// ---------------------------------------------------------------------------

const buildTranslationRowId = (domain: TranslationDomain, state: string): string =>
  `${domain}-${state}`.toLowerCase().replace(/[^a-z0-9-]+/g, '-');

const normalizeTranslationRow = (id: string, raw: Record<string, unknown> | undefined): TranslationRow | null => {
  if (!raw) return null;
  const domain = raw.domain as TranslationDomain | undefined;
  const state = raw.state as string | undefined;
  if (!domain || !state) return null;
  if (!TRANSLATION_DOMAINS.includes(domain)) return null;

  return {
    id,
    domain,
    state,
    athletePhrasing: typeof raw.athletePhrasing === 'string' ? raw.athletePhrasing : '',
    requiredActionVerbs: Array.isArray(raw.requiredActionVerbs)
      ? raw.requiredActionVerbs.map((v: unknown) => String(v))
      : [],
    forbiddenTokens: Array.isArray(raw.forbiddenTokens)
      ? raw.forbiddenTokens.map((v: unknown) => String(v))
      : [],
    voiceReviewStatus:
      (raw.voiceReviewStatus as VoiceReviewStatus | undefined) ?? 'seed-pending-review',
    revisionId: typeof raw.revisionId === 'string' ? raw.revisionId : '',
    createdBy: typeof raw.createdBy === 'string' ? raw.createdBy : '',
    notes: typeof raw.notes === 'string' ? raw.notes : undefined,
  };
};

const loadTranslationRow = async (
  db: admin.firestore.Firestore,
  domain: TranslationDomain,
  state: string,
): Promise<TranslationRow | null> => {
  const id = buildTranslationRowId(domain, state);
  const snap = await db.collection(TRANSLATION_TABLE_COLLECTION).doc(id).get();
  if (!snap.exists) return null;
  return normalizeTranslationRow(id, snap.data());
};

const loadOffLimitsConfig = async (
  db: admin.firestore.Firestore,
): Promise<OffLimitsConfig | null> => {
  const snap = await db
    .collection(OFF_LIMITS_CONFIG_COLLECTION)
    .doc(OFF_LIMITS_CONFIG_DOCUMENT_ID)
    .get();
  if (!snap.exists) return null;
  const data = snap.data() ?? {};
  return {
    id: OFF_LIMITS_CONFIG_DOCUMENT_ID,
    forbiddenMarkers: Array.isArray(data.forbiddenMarkers) ? data.forbiddenMarkers.map(String) : [],
    forbiddenPhrasePatterns: Array.isArray(data.forbiddenPhrasePatterns)
      ? data.forbiddenPhrasePatterns.map(String)
      : [],
    numericValueRules: Array.isArray(data.numericValueRules) ? data.numericValueRules : [],
    revisionId: typeof data.revisionId === 'string' ? data.revisionId : '',
    updatedBy: typeof data.updatedBy === 'string' ? data.updatedBy : '',
  };
};

// ---------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------

const buildSystemPrompt = (row: TranslationRow): string =>
  [
    "You are Nora, a warm but direct performance coach speaking 1:1 with an athlete.",
    "",
    "=== VOICE ===",
    "First-person to the athlete. Action-led, calm, present-tense. Coach-adjacent: warm but not saccharine, never pathologizing.",
    "",
    "=== ABSOLUTE CONSTRAINTS ===",
    "1. Output 1–3 sentences. No more, no less.",
    "2. NEVER include numeric values paired with units like ms, bpm, °F, °C, or %.",
    "3. NEVER mention these markers by name: hrv, sleepScore, readiness, recovery, rhr, tempDev, daytimeStress, acwr, compositeScores.",
    "4. NEVER use negative-priming language: 'your X is low/poor/bad', 'your numbers look...', 'you've been...'. Athletes do not see scores; they receive guidance.",
    "5. Lead with an action verb. Required verbs to surface (use at least one): " +
      (row.requiredActionVerbs.length > 0 ? row.requiredActionVerbs.join(', ') : '(none specified)') +
      ".",
    "6. No emoji. No markdown. No headers. Plain prose only.",
    "",
    "=== REFERENCE VOICE (the seed phrasing for this state — match its tone) ===",
    `\"${row.athletePhrasing}\"`,
    "",
    "Generate a fresh paraphrase appropriate to the supplied signal context. Your response is exactly the athlete-facing line — nothing else, no preamble, no quotation marks.",
  ].join('\n');

const buildUserMessage = (
  domain: TranslationDomain,
  state: string,
  signal: Record<string, unknown>,
  additionalContext?: Record<string, string>,
): string => {
  const lines: string[] = [
    `Domain: ${domain}`,
    `State: ${state}`,
    `Signal context (structured, do not echo numbers verbatim — translate the band into guidance):`,
    JSON.stringify(signal),
  ];
  if (additionalContext && Object.keys(additionalContext).length > 0) {
    lines.push('Additional context:');
    for (const [key, value] of Object.entries(additionalContext)) {
      lines.push(`  ${key}: ${value}`);
    }
  }
  lines.push('Write the athlete-facing line now.');
  return lines.join('\n');
};

// ---------------------------------------------------------------------------
// Anthropic
// ---------------------------------------------------------------------------

const resolveAnthropicClient = (deps?: TranslateForAthleteDeps): AnthropicLike => {
  if (deps?.anthropicClient) return deps.anthropicClient;
  // Real SDK reads ANTHROPIC_API_KEY from env.
  return new Anthropic() as unknown as AnthropicLike;
};

const callClaude = async (
  client: AnthropicLike,
  systemPrompt: string,
  userMessage: string,
): Promise<string> => {
  const response = await client.messages.create({
    model: NORA_ATHLETE_TRANSLATION.model,
    max_tokens: NORA_ATHLETE_TRANSLATION.maxTokens,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  });

  const text = (response.content || [])
    .filter((block) => block.type === 'text' && typeof block.text === 'string')
    .map((block) => block.text as string)
    .join('')
    .trim();

  if (!text) throw new Error('Anthropic returned no text content');
  return text;
};

// ---------------------------------------------------------------------------
// Public entry
// ---------------------------------------------------------------------------

const resolveFirestore = (deps?: TranslateForAthleteDeps): admin.firestore.Firestore | null => {
  if (deps?.firestore) return deps.firestore;
  try {
    return admin.firestore();
  } catch {
    return null;
  }
};

export const translateForAthlete = async (
  input: TranslateForAthleteInput,
  deps?: TranslateForAthleteDeps,
): Promise<TranslationResult | null> => {
  const persistLog = input.persistLog !== false; // default true
  const db = resolveFirestore(deps);

  if (!db) {
    // No Firestore — we cannot load the translation row. Best-effort log via
    // the helper (which will warn-and-swallow), and return null so the caller
    // can decide what to do.
    if (persistLog) {
      void logTranslation(
        {
          athleteUserId: input.athleteUserId,
          signal: input.signal,
          domain: input.domain,
          state: input.state,
          providerUsed: 'fallback-seed',
          fallbackTriggered: true,
          fallbackReason: 'row-missing',
          guardrailViolations: [],
          finalPhrasing: '',
          errorMessage: 'No Firestore instance available',
        },
        deps,
      );
    }
    return null;
  }

  // Load row + off-limits in parallel.
  const [row, offLimits] = await Promise.all([
    loadTranslationRow(db, input.domain, input.state),
    loadOffLimitsConfig(db),
  ]);

  if (!row) {
    if (persistLog) {
      void logTranslation(
        {
          athleteUserId: input.athleteUserId,
          signal: input.signal,
          domain: input.domain,
          state: input.state,
          providerUsed: 'fallback-seed',
          fallbackTriggered: true,
          fallbackReason: 'row-missing',
          guardrailViolations: [],
          finalPhrasing: '',
          errorMessage: `No translation row for (${input.domain}, ${input.state})`,
          additionalContext: input.additionalContext,
        },
        deps,
      );
    }
    return null;
  }

  // Guardrails need numericValueRules + forbiddenPhrasePatterns. If off-limits
  // is missing, fall back to empty-rule sets — guardrails still enforce the
  // hardcoded numeric+unit and negative-priming checks.
  const guardrailOffLimits = offLimits ?? {
    numericValueRules: [],
    forbiddenPhrasePatterns: [],
  };

  const seedPhrasing = row.athletePhrasing;

  // 1) Try Claude.
  const client = resolveAnthropicClient(deps);
  const systemPrompt = buildSystemPrompt(row);
  const userMessage = buildUserMessage(input.domain, input.state, input.signal, input.additionalContext);

  let claudeOutputRaw: string | undefined;
  let anthropicError: Error | undefined;

  try {
    claudeOutputRaw = await callClaude(client, systemPrompt, userMessage);
  } catch (err) {
    anthropicError = err instanceof Error ? err : new Error(String(err));
  }

  // 2) Decide.
  if (anthropicError || !claudeOutputRaw) {
    const result: TranslationResult = {
      phrasing: seedPhrasing,
      providerUsed: 'fallback-seed',
      fallbackTriggered: true,
      fallbackReason: 'anthropic-error',
      guardrailViolations: [],
      voiceReviewStatus: row.voiceReviewStatus,
      translationRowRevision: row.revisionId,
      claudeOutputRaw, // may be undefined; preview path always shows it when present
    };

    if (persistLog) {
      void logTranslation(
        {
          athleteUserId: input.athleteUserId,
          signal: input.signal,
          domain: input.domain,
          state: input.state,
          providerUsed: 'fallback-seed',
          fallbackTriggered: true,
          fallbackReason: 'anthropic-error',
          guardrailViolations: [],
          finalPhrasing: seedPhrasing,
          claudeOutputRaw,
          seedPhrasing,
          voiceReviewStatus: row.voiceReviewStatus,
          translationRowRevision: row.revisionId,
          modelUsed: NORA_ATHLETE_TRANSLATION.model,
          errorMessage: anthropicError?.message,
          additionalContext: input.additionalContext,
        },
        deps,
      );
    }

    return result;
  }

  const guardrails = runAthletePhrasingGuardrails(claudeOutputRaw, row, guardrailOffLimits);

  if (!guardrails.ok) {
    const result: TranslationResult = {
      phrasing: seedPhrasing,
      providerUsed: 'fallback-seed',
      fallbackTriggered: true,
      fallbackReason: 'guardrail-violation',
      guardrailViolations: guardrails.violations,
      voiceReviewStatus: row.voiceReviewStatus,
      translationRowRevision: row.revisionId,
      claudeOutputRaw,
    };

    if (persistLog) {
      void logTranslation(
        {
          athleteUserId: input.athleteUserId,
          signal: input.signal,
          domain: input.domain,
          state: input.state,
          providerUsed: 'fallback-seed',
          fallbackTriggered: true,
          fallbackReason: 'guardrail-violation',
          guardrailViolations: guardrails.violations,
          finalPhrasing: seedPhrasing,
          claudeOutputRaw,
          seedPhrasing,
          voiceReviewStatus: row.voiceReviewStatus,
          translationRowRevision: row.revisionId,
          modelUsed: NORA_ATHLETE_TRANSLATION.model,
          additionalContext: input.additionalContext,
        },
        deps,
      );
    }

    return result;
  }

  // Happy path.
  const result: TranslationResult = {
    phrasing: claudeOutputRaw,
    providerUsed: 'anthropic',
    fallbackTriggered: false,
    guardrailViolations: [],
    voiceReviewStatus: row.voiceReviewStatus,
    translationRowRevision: row.revisionId,
    // Always include raw output on dry-run for Phase E preview UI; omit on
    // production calls to keep the response shape lean.
    claudeOutputRaw: persistLog ? undefined : claudeOutputRaw,
  };

  if (persistLog) {
    void logTranslation(
      {
        athleteUserId: input.athleteUserId,
        signal: input.signal,
        domain: input.domain,
        state: input.state,
        providerUsed: 'anthropic',
        fallbackTriggered: false,
        guardrailViolations: [],
        finalPhrasing: claudeOutputRaw,
        // claudeOutputRaw matches finalPhrasing on happy path; storing both
        // costs nothing and keeps the schema consistent for Phase G queries.
        claudeOutputRaw,
        seedPhrasing,
        voiceReviewStatus: row.voiceReviewStatus,
        translationRowRevision: row.revisionId,
        modelUsed: NORA_ATHLETE_TRANSLATION.model,
        additionalContext: input.additionalContext,
      },
      deps,
    );
  }

  return result;
};
