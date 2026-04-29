import type { NextApiRequest, NextApiResponse } from 'next';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import admin from '../../../lib/firebase-admin';
import { PULSECHECK_PROTOCOL_PRACTICE_EVAL } from '../../../api/anthropic/featureRouting';
import {
  buildAdminFallbackLogger,
  callWithFallback,
} from '../../../api/anthropic/callWithFallback';
import type {
  PulseCheckProtocolPracticeDimensionScores,
  PulseCheckProtocolPracticeScorecard,
  PulseCheckProtocolPracticeTurn,
  PulseCheckProtocolPracticeVoiceSignals,
} from '../../../api/firebase/mentaltraining/types';
import {
  protocolPracticeConversationService,
  type ProtocolPracticeAdaptiveFollowUp,
  type ProtocolPracticeSpec,
  type ProtocolPracticeTurnSpec,
} from '../../../api/firebase/mentaltraining/protocolPracticeConversationService';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '1mb',
    },
  },
};

const DEFAULT_MODEL = 'gpt-5-nano';

type TurnInput = {
  responseText: string;
  modality: 'text' | 'voice';
  usedAdaptiveFollowUp?: boolean;
  followUpPromptId?: string;
  followUpPromptText?: string;
  transcriptReviewed?: boolean;
  voiceSignals?: PulseCheckProtocolPracticeVoiceSignals;
};

type TurnEvaluationRequest = {
  action: 'turn';
  specId: string;
  turnSpecId: string;
  input: TurnInput;
  priorTurns?: PulseCheckProtocolPracticeTurn[];
};

type SessionEvaluationRequest = {
  action: 'session';
  specId: string;
  turns?: PulseCheckProtocolPracticeTurn[];
};

type EvaluationRequest = TurnEvaluationRequest | SessionEvaluationRequest;

function sanitizeModelName(raw: string | undefined) {
  const candidate = (raw || DEFAULT_MODEL).trim();
  if (!candidate) return DEFAULT_MODEL;
  return candidate.replace(/^openai\//i, '');
}

function parseJsonSafe<T>(value: string | null | undefined): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function clampScore(value: unknown) {
  if (typeof value !== 'number' || Number.isNaN(value)) return 3;
  return Math.min(5, Math.max(1, Math.round(value)));
}

function toStringArray(value: unknown, fallback: string[]) {
  if (!Array.isArray(value)) return fallback;
  const items = value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean);
  return items.length ? items.slice(0, 3) : fallback;
}

function buildTurnId(turnSpec: ProtocolPracticeTurnSpec) {
  return `${turnSpec.id}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function summarizeVoiceSignals(turns: PulseCheckProtocolPracticeTurn[]) {
  const voiceTurns = turns.filter((turn) => turn.voiceSignals?.confidenceQualified);
  if (!voiceTurns.length) return undefined;

  const averageConfidence = voiceTurns.reduce((total, turn) => total + (turn.voiceSignals?.transcriptConfidence || 0), 0) / voiceTurns.length;
  const averageWpm = voiceTurns.reduce((total, turn) => total + (turn.voiceSignals?.wordsPerMinute || 0), 0) / voiceTurns.length;

  return `Voice capture looked usable across ${voiceTurns.length} turn${voiceTurns.length === 1 ? '' : 's'} with ${(averageConfidence * 100).toFixed(0)}% average transcript confidence and ${Math.round(averageWpm)} WPM pacing.`;
}

function getSpecById(specId: string) {
  const normalized = specId.trim();
  return protocolPracticeConversationService
    .listSpecs()
    .find((candidate) =>
      candidate.id === normalized
      || candidate.protocolVariantId === normalized
      || candidate.legacyExerciseId === normalized
    ) || null;
}

function buildTurnSchema() {
  return {
    type: 'object',
    additionalProperties: false,
    properties: {
      scores: {
        type: 'object',
        additionalProperties: false,
        properties: {
          signalAwareness: { type: 'number' },
          techniqueFidelity: { type: 'number' },
          languageQuality: { type: 'number' },
          shiftQuality: { type: 'number' },
          coachability: { type: 'number' },
        },
        required: ['signalAwareness', 'techniqueFidelity', 'languageQuality', 'shiftQuality', 'coachability'],
      },
      strengths: {
        type: 'array',
        items: { type: 'string' },
      },
      misses: {
        type: 'array',
        items: { type: 'string' },
      },
      noraFeedback: { type: 'string' },
      shouldUseAdaptiveFollowUp: { type: 'boolean' },
      followUpPromptId: {
        anyOf: [{ type: 'string' }, { type: 'null' }],
      },
    },
    required: ['scores', 'strengths', 'misses', 'noraFeedback', 'shouldUseAdaptiveFollowUp', 'followUpPromptId'],
  } as const;
}

function buildSessionSchema() {
  return {
    type: 'object',
    additionalProperties: false,
    properties: {
      overallScore: { type: 'number' },
      dimensionScores: {
        type: 'object',
        additionalProperties: false,
        properties: {
          signalAwareness: { type: 'number' },
          techniqueFidelity: { type: 'number' },
          languageQuality: { type: 'number' },
          shiftQuality: { type: 'number' },
          coachability: { type: 'number' },
        },
        required: ['signalAwareness', 'techniqueFidelity', 'languageQuality', 'shiftQuality', 'coachability'],
      },
      strengths: {
        type: 'array',
        items: { type: 'string' },
      },
      improvementAreas: {
        type: 'array',
        items: { type: 'string' },
      },
      evaluationSummary: { type: 'string' },
      nextRepFocus: { type: 'string' },
      coachabilityTrend: {
        type: 'string',
        enum: ['improving', 'steady', 'needs_support'],
      },
    },
    required: [
      'overallScore',
      'dimensionScores',
      'strengths',
      'improvementAreas',
      'evaluationSummary',
      'nextRepFocus',
      'coachabilityTrend',
    ],
  } as const;
}

// ---------------------------------------------------------------------------
// Shared prompt + payload builders (used by both Anthropic primary + OpenAI fallback)
// ---------------------------------------------------------------------------

const TURN_SYSTEM_PROMPT =
  'You are Nora, evaluating one protocol-practice answer. ' +
  'Score the answer against the provided rubric on a 1-5 scale. ' +
  'Be specific to the athlete response; never use canned praise. ' +
  'Your feedback must sound like a coach talking to an athlete, not a scientist. ' +
  'Keep noraFeedback to 1-2 direct sentences, simple enough for a smart high-schooler. ' +
  'Strengths and misses should be short card-ready lines. ' +
  'Only trigger an adaptive follow-up if the answer is genuinely weak and a listed follow-up matches that weakness. ' +
  'Avoid repetitive openings such as "Good.", "Nice.", "That sounded more usable.", or other generic praise-first patterns. ' +
  'Lead with the actual coaching point from this answer. ' +
  'Do not reuse the same sentence structure as the most recent Nora feedback unless the athlete made the exact same mistake again.';

const SESSION_SYSTEM_PROMPT =
  'You are Nora, evaluating the full protocol-practice conversation. ' +
  'Return structured scoring plus a final summary that sounds specific to this athlete, not generic. ' +
  'The summary must be direct, plain-language, and coach-like. ' +
  'Do not repeat the same phrasing used in common canned evaluations. ' +
  'Base scores on how usable the athlete language sounds under pressure, not just whether they echoed the prompt. ' +
  'Avoid generic wrap-up lines like "keep sharpening" or "more competition-ready" unless the transcript clearly earns that phrasing. ' +
  'Make the final summary sound like a specific read on this rep, not a template reused from earlier feedback.';

function buildTurnUserPayload(
  spec: ProtocolPracticeSpec,
  turnSpec: ProtocolPracticeTurnSpec,
  input: TurnInput,
  priorTurns: PulseCheckProtocolPracticeTurn[],
) {
  const recentFeedback = priorTurns
    .map((turn) => turn.noraFeedback)
    .filter(Boolean)
    .slice(-2);
  return JSON.stringify(
    {
      specTitle: spec.title,
      rubricLabels: spec.rubricLabels,
      practiceIntro: spec.practiceIntro,
      evaluationLead: spec.evaluationLead,
      currentPrompt: {
        id: turnSpec.id,
        label: turnSpec.label,
        promptText: turnSpec.promptText,
        targetedDimensions: turnSpec.targetedDimensions,
        adaptiveFollowUps: (turnSpec.adaptiveFollowUps || []).map((followUp) => ({
          id: followUp.id,
          targetDimension: followUp.targetDimension,
          promptText: followUp.promptText,
        })),
      },
      athleteResponse: input,
      priorTurns: priorTurns.slice(-3).map((turn) => ({
        promptLabel: turn.promptLabel,
        promptText: turn.promptText,
        responseText: turn.responseText,
        noraFeedback: turn.noraFeedback,
        scores: turn.scores,
      })),
      recentFeedbackToAvoidRepeating: recentFeedback,
      scoringNotes: {
        rubricScale: '1 = weak / generic, 3 = usable but inconsistent, 5 = highly usable under pressure',
        coachabilityMeans:
          'did the athlete apply the coaching and make the answer more usable under pressure',
        followUpRule:
          'use follow-up only if a targeted dimension is 1-2 and there is a matching follow-up available',
      },
    },
    null,
    2,
  );
}

type TurnEvalResult = {
  scores: PulseCheckProtocolPracticeDimensionScores;
  strengths: string[];
  misses: string[];
  noraFeedback: string;
  shouldUseAdaptiveFollowUp: boolean;
  followUpPromptId: string | null;
};

type SessionEvalResult = {
  overallScore: number;
  dimensionScores: PulseCheckProtocolPracticeDimensionScores;
  scores?: PulseCheckProtocolPracticeDimensionScores;
  strengths: string[];
  improvementAreas: string[];
  misses?: string[];
  evaluationSummary: string;
  nextRepFocus: string;
  coachabilityTrend: PulseCheckProtocolPracticeScorecard['coachabilityTrend'];
};

// ---------------------------------------------------------------------------
// Anthropic primary path (Sonnet 4.6, forced tool-use for structured output)
// ---------------------------------------------------------------------------

async function evaluateTurnWithAnthropic(
  spec: ProtocolPracticeSpec,
  turnSpec: ProtocolPracticeTurnSpec,
  input: TurnInput,
  priorTurns: PulseCheckProtocolPracticeTurn[],
): Promise<TurnEvalResult> {
  const client = new Anthropic();
  const response = await client.messages.create({
    model: PULSECHECK_PROTOCOL_PRACTICE_EVAL.model,
    max_tokens: PULSECHECK_PROTOCOL_PRACTICE_EVAL.maxTokens,
    system: TURN_SYSTEM_PROMPT,
    tools: [
      {
        name: 'submit_turn_evaluation',
        description: 'Submit the structured turn evaluation.',
        // Schema is shared with OpenAI's strict json_schema (readonly via `as const`);
        // Anthropic SDK expects mutable JSON Schema. Cast is safe — wire format identical.
        input_schema: buildTurnSchema() as unknown as Anthropic.Tool.InputSchema,
      },
    ],
    tool_choice: { type: 'tool', name: 'submit_turn_evaluation' },
    messages: [{ role: 'user', content: buildTurnUserPayload(spec, turnSpec, input, priorTurns) }],
  });
  const toolUse = response.content.find(
    (block): block is Anthropic.ToolUseBlock =>
      block.type === 'tool_use' && block.name === 'submit_turn_evaluation',
  );
  if (!toolUse) throw new Error('Anthropic response missing forced tool_use block (turn)');
  return toolUse.input as TurnEvalResult;
}

// ---------------------------------------------------------------------------
// OpenAI fallback path (kept verbatim — Responses API + json_schema strict)
// ---------------------------------------------------------------------------

async function evaluateTurnWithAI(
  openai: OpenAI,
  model: string,
  spec: ProtocolPracticeSpec,
  turnSpec: ProtocolPracticeTurnSpec,
  input: TurnInput,
  priorTurns: PulseCheckProtocolPracticeTurn[]
) {
  const response = await openai.responses.create({
    model,
    temperature: 0.3,
    max_output_tokens: 1200,
    text: {
      format: {
        type: 'json_schema',
        name: 'protocol_practice_turn_evaluation',
        strict: true,
        schema: buildTurnSchema(),
      },
    },
    input: [
      {
        role: 'system',
        content: [{ type: 'input_text', text: TURN_SYSTEM_PROMPT }],
      },
      {
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: buildTurnUserPayload(spec, turnSpec, input, priorTurns),
          },
        ],
      },
    ],
  });

  return parseJsonSafe<TurnEvalResult>(response.output_text);
}

function buildSessionUserPayload(
  spec: ProtocolPracticeSpec,
  turns: PulseCheckProtocolPracticeTurn[],
) {
  const recentTurnFeedback = turns
    .map((turn) => turn.noraFeedback)
    .filter(Boolean)
    .slice(-3);
  return JSON.stringify(
    {
      specTitle: spec.title,
      evaluationLead: spec.evaluationLead,
      nextRepFocusDefault: spec.nextRepFocus,
      rubricLabels: spec.rubricLabels,
      turns: turns.map((turn) => ({
        promptLabel: turn.promptLabel,
        promptText: turn.promptText,
        responseText: turn.responseText,
        modality: turn.modality,
        voiceSignals: turn.voiceSignals,
        noraFeedback: turn.noraFeedback,
      })),
      recentFeedbackToAvoidRepeating: recentTurnFeedback,
      scoringNotes: {
        rubricScale: '1 = weak / generic, 3 = usable but inconsistent, 5 = highly usable under pressure',
        coachabilityTrend:
          'improving if later answers clearly get more usable; steady if similar; needs_support if they stay generic or drift',
        outputStyle: 'strengths and improvementAreas should be short card-ready lines',
      },
    },
    null,
    2,
  );
}

async function evaluateSessionWithAnthropic(
  spec: ProtocolPracticeSpec,
  turns: PulseCheckProtocolPracticeTurn[],
): Promise<SessionEvalResult> {
  const client = new Anthropic();
  const response = await client.messages.create({
    model: PULSECHECK_PROTOCOL_PRACTICE_EVAL.model,
    max_tokens: PULSECHECK_PROTOCOL_PRACTICE_EVAL.maxTokens,
    system: SESSION_SYSTEM_PROMPT,
    tools: [
      {
        name: 'submit_session_evaluation',
        description: 'Submit the structured session evaluation.',
        input_schema: buildSessionSchema() as unknown as Anthropic.Tool.InputSchema,
      },
    ],
    tool_choice: { type: 'tool', name: 'submit_session_evaluation' },
    messages: [{ role: 'user', content: buildSessionUserPayload(spec, turns) }],
  });
  const toolUse = response.content.find(
    (block): block is Anthropic.ToolUseBlock =>
      block.type === 'tool_use' && block.name === 'submit_session_evaluation',
  );
  if (!toolUse) throw new Error('Anthropic response missing forced tool_use block (session)');
  return toolUse.input as SessionEvalResult;
}

async function evaluateSessionWithAI(
  openai: OpenAI,
  model: string,
  spec: ProtocolPracticeSpec,
  turns: PulseCheckProtocolPracticeTurn[]
) {
  const response = await openai.responses.create({
    model,
    temperature: 0.35,
    max_output_tokens: 1400,
    text: {
      format: {
        type: 'json_schema',
        name: 'protocol_practice_session_evaluation',
        strict: true,
        schema: buildSessionSchema(),
      },
    },
    input: [
      {
        role: 'system',
        content: [{ type: 'input_text', text: SESSION_SYSTEM_PROMPT }],
      },
      {
        role: 'user',
        content: [{ type: 'input_text', text: buildSessionUserPayload(spec, turns) }],
      },
    ],
  });

  return parseJsonSafe<SessionEvalResult>(response.output_text);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const openaiApiKey = process.env.OPENAI_API_KEY || process.env.OPEN_AI_SECRET_KEY;
  if (!process.env.ANTHROPIC_API_KEY && !openaiApiKey) {
    return res.status(500).json({ error: 'No provider key configured (need ANTHROPIC_API_KEY or OPENAI_API_KEY)' });
  }

  const payload = (req.body || {}) as EvaluationRequest;
  const spec = typeof payload.specId === 'string' ? getSpecById(payload.specId) : null;
  if (!spec) {
    return res.status(404).json({ error: 'Protocol practice spec not found' });
  }

  const fallbackModel = sanitizeModelName(process.env.PULSECHECK_PROTOCOL_EVALUATION_MODEL);
  const openai = openaiApiKey ? new OpenAI({ apiKey: openaiApiKey }) : null;
  const logger = buildAdminFallbackLogger(admin.firestore());
  const startedAt = Date.now();

  try {
    if (payload.action === 'turn') {
      const turnSpec = spec.turns.find((candidate) => candidate.id === payload.turnSpecId);
      if (!turnSpec) {
        return res.status(404).json({ error: 'Protocol practice turn spec not found' });
      }

      const priorTurns = Array.isArray(payload.priorTurns) ? payload.priorTurns : [];
      const fallbackResult = await callWithFallback<TurnEvalResult | null>({
        feature: PULSECHECK_PROTOCOL_PRACTICE_EVAL,
        anthropicCall: () => evaluateTurnWithAnthropic(spec, turnSpec, payload.input, priorTurns),
        openaiCall: async () => {
          if (!openai) throw new Error('OpenAI fallback unavailable: no API key configured');
          return evaluateTurnWithAI(openai, fallbackModel, spec, turnSpec, payload.input, priorTurns);
        },
        logger,
      });
      const aiResult = fallbackResult.result;
      const evaluationModel = fallbackResult.providerUsed === 'anthropic'
        ? PULSECHECK_PROTOCOL_PRACTICE_EVAL.model
        : fallbackModel;

      if (!aiResult) {
        return res.status(500).json({ error: 'Invalid AI evaluation response' });
      }

      const followUpPrompt = !payload.input.usedAdaptiveFollowUp && aiResult.shouldUseAdaptiveFollowUp && aiResult.followUpPromptId
        ? (turnSpec.adaptiveFollowUps || []).find((followUp) => followUp.id === aiResult.followUpPromptId) || undefined
        : undefined;

      const turn: PulseCheckProtocolPracticeTurn = {
        id: buildTurnId(turnSpec),
        promptId: turnSpec.id,
        promptLabel: turnSpec.label,
        promptText: turnSpec.promptText,
        responseText: payload.input.responseText.trim(),
        modality: payload.input.modality,
        followUpPromptId: payload.input.followUpPromptId,
        followUpPromptText: payload.input.followUpPromptText,
        usedAdaptiveFollowUp: payload.input.usedAdaptiveFollowUp,
        transcriptReviewed: payload.input.transcriptReviewed,
        voiceSignals: payload.input.voiceSignals,
        scores: {
          signalAwareness: clampScore(aiResult.scores.signalAwareness),
          techniqueFidelity: clampScore(aiResult.scores.techniqueFidelity),
          languageQuality: clampScore(aiResult.scores.languageQuality),
          shiftQuality: clampScore(aiResult.scores.shiftQuality),
          coachability: clampScore(aiResult.scores.coachability),
        },
        strengths: toStringArray(aiResult.strengths, ['You stayed engaged and answered directly.']),
        misses: toStringArray(aiResult.misses, ['Make the next answer more specific to the moment.']),
        noraFeedback: (aiResult.noraFeedback || 'Stay with it and make the next rep more usable under pressure.').trim(),
        evaluationSource: 'ai',
        evaluationModel,
        evaluationLatencyMs: Date.now() - startedAt,
        submittedAt: Date.now(),
      };

      return res.status(200).json({
        success: true,
        model: evaluationModel,
        providerUsed: fallbackResult.providerUsed,
        fallbackTriggered: fallbackResult.fallbackTriggered,
        latencyMs: turn.evaluationLatencyMs,
        evaluation: {
          turn,
          shouldUseAdaptiveFollowUp: Boolean(followUpPrompt),
          followUpPrompt,
        },
      });
    }

    const submittedTurns = Array.isArray(payload.turns) ? payload.turns : [];
    if (!submittedTurns.length) {
      return res.status(400).json({ error: 'At least one submitted turn is required for session evaluation' });
    }

    const sessionFallbackResult = await callWithFallback<SessionEvalResult | null>({
      feature: PULSECHECK_PROTOCOL_PRACTICE_EVAL,
      anthropicCall: () => evaluateSessionWithAnthropic(spec, submittedTurns),
      openaiCall: async () => {
        if (!openai) throw new Error('OpenAI fallback unavailable: no API key configured');
        return evaluateSessionWithAI(openai, fallbackModel, spec, submittedTurns);
      },
      logger,
    });
    const aiResult = sessionFallbackResult.result;
    const sessionEvaluationModel = sessionFallbackResult.providerUsed === 'anthropic'
      ? PULSECHECK_PROTOCOL_PRACTICE_EVAL.model
      : fallbackModel;
    if (!aiResult) {
      return res.status(500).json({ error: 'Invalid AI session evaluation response' });
    }

    const dimensionScores = aiResult.dimensionScores || aiResult.scores;
    if (!dimensionScores) {
      return res.status(500).json({ error: 'AI session evaluation is missing dimension scores' });
    }

    const scorecard: PulseCheckProtocolPracticeScorecard = {
      overallScore: Number(Math.min(5, Math.max(1, aiResult.overallScore)).toFixed(1)),
      dimensionScores: {
        signalAwareness: Number(clampScore(dimensionScores.signalAwareness).toFixed(1)),
        techniqueFidelity: Number(clampScore(dimensionScores.techniqueFidelity).toFixed(1)),
        languageQuality: Number(clampScore(dimensionScores.languageQuality).toFixed(1)),
        shiftQuality: Number(clampScore(dimensionScores.shiftQuality).toFixed(1)),
        coachability: Number(clampScore(dimensionScores.coachability).toFixed(1)),
      },
      strengths: toStringArray(aiResult.strengths, ['You stayed engaged through the rep.']),
      improvementAreas: toStringArray(aiResult.improvementAreas || aiResult.misses, ['Keep making the language more specific to the moment.']),
      evaluationSummary: (aiResult.evaluationSummary || `${spec.evaluationLead} Keep sharpening the next rep.`).trim(),
      nextRepFocus: (aiResult.nextRepFocus || spec.nextRepFocus).trim(),
      coachabilityTrend: aiResult.coachabilityTrend || 'steady',
      voiceSignalsSummary: summarizeVoiceSignals(submittedTurns),
      evaluationSource: 'ai',
      evaluationModel: sessionEvaluationModel,
      evaluationLatencyMs: Date.now() - startedAt,
    };

    return res.status(200).json({
      success: true,
      model: sessionEvaluationModel,
      providerUsed: sessionFallbackResult.providerUsed,
      fallbackTriggered: sessionFallbackResult.fallbackTriggered,
      latencyMs: scorecard.evaluationLatencyMs,
      scorecard,
    });
  } catch (error: any) {
    console.error('[evaluate-protocol-practice] Evaluation failed:', error);
    return res.status(500).json({
      error: error?.message || 'Failed to evaluate protocol practice',
    });
  }
}
