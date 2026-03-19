import type { NextApiRequest, NextApiResponse } from 'next';
import OpenAI from 'openai';
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
        content: [
          {
            type: 'input_text',
            text:
              'You are Nora, evaluating one protocol-practice answer. ' +
              'Score the answer against the provided rubric on a 1-5 scale. ' +
              'Be specific to the athlete response; never use canned praise. ' +
              'Your feedback must sound like a coach talking to an athlete, not a scientist. ' +
              'Keep noraFeedback to 1-2 direct sentences, simple enough for a smart high-schooler. ' +
              'Strengths and misses should be short card-ready lines. ' +
              'Only trigger an adaptive follow-up if the answer is genuinely weak and a listed follow-up matches that weakness.',
          },
        ],
      },
      {
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: JSON.stringify({
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
              scoringNotes: {
                rubricScale: '1 = weak / generic, 3 = usable but inconsistent, 5 = highly usable under pressure',
                coachabilityMeans: 'did the athlete apply the coaching and make the answer more usable under pressure',
                followUpRule: 'use follow-up only if a targeted dimension is 1-2 and there is a matching follow-up available',
              },
            }, null, 2),
          },
        ],
      },
    ],
  });

  return parseJsonSafe<{
    scores: PulseCheckProtocolPracticeDimensionScores;
    strengths: string[];
    misses: string[];
    noraFeedback: string;
    shouldUseAdaptiveFollowUp: boolean;
    followUpPromptId: string | null;
  }>(response.output_text);
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
        content: [
          {
            type: 'input_text',
            text:
              'You are Nora, evaluating the full protocol-practice conversation. ' +
              'Return structured scoring plus a final summary that sounds specific to this athlete, not generic. ' +
              'The summary must be direct, plain-language, and coach-like. ' +
              'Do not repeat the same phrasing used in common canned evaluations. ' +
              'Base scores on how usable the athlete language sounds under pressure, not just whether they echoed the prompt.',
          },
        ],
      },
      {
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: JSON.stringify({
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
              })),
              scoringNotes: {
                rubricScale: '1 = weak / generic, 3 = usable but inconsistent, 5 = highly usable under pressure',
                coachabilityTrend: 'improving if later answers clearly get more usable; steady if similar; needs_support if they stay generic or drift',
                outputStyle: 'strengths and improvementAreas should be short card-ready lines',
              },
            }, null, 2),
          },
        ],
      },
    ],
  });

  return parseJsonSafe<{
    overallScore: number;
    dimensionScores: PulseCheckProtocolPracticeDimensionScores;
    strengths: string[];
    improvementAreas: string[];
    evaluationSummary: string;
    nextRepFocus: string;
    coachabilityTrend: PulseCheckProtocolPracticeScorecard['coachabilityTrend'];
  }>(response.output_text);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.OPENAI_API_KEY || process.env.OPEN_AI_SECRET_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'OpenAI API key not configured' });
  }

  const payload = (req.body || {}) as EvaluationRequest;
  const spec = typeof payload.specId === 'string' ? getSpecById(payload.specId) : null;
  if (!spec) {
    return res.status(404).json({ error: 'Protocol practice spec not found' });
  }

  const model = sanitizeModelName(process.env.PULSECHECK_PROTOCOL_EVALUATION_MODEL);
  const openai = new OpenAI({ apiKey });
  const startedAt = Date.now();

  try {
    if (payload.action === 'turn') {
      const turnSpec = spec.turns.find((candidate) => candidate.id === payload.turnSpecId);
      if (!turnSpec) {
        return res.status(404).json({ error: 'Protocol practice turn spec not found' });
      }

      const aiResult = await evaluateTurnWithAI(
        openai,
        model,
        spec,
        turnSpec,
        payload.input,
        Array.isArray(payload.priorTurns) ? payload.priorTurns : []
      );

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
        evaluationModel: model,
        evaluationLatencyMs: Date.now() - startedAt,
        submittedAt: Date.now(),
      };

      return res.status(200).json({
        success: true,
        model,
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

    const aiResult = await evaluateSessionWithAI(openai, model, spec, submittedTurns);
    if (!aiResult) {
      return res.status(500).json({ error: 'Invalid AI session evaluation response' });
    }

    const scorecard: PulseCheckProtocolPracticeScorecard = {
      overallScore: Number(Math.min(5, Math.max(1, aiResult.overallScore)).toFixed(1)),
      dimensionScores: {
        signalAwareness: Number(clampScore(aiResult.dimensionScores.signalAwareness).toFixed(1)),
        techniqueFidelity: Number(clampScore(aiResult.dimensionScores.techniqueFidelity).toFixed(1)),
        languageQuality: Number(clampScore(aiResult.dimensionScores.languageQuality).toFixed(1)),
        shiftQuality: Number(clampScore(aiResult.dimensionScores.shiftQuality).toFixed(1)),
        coachability: Number(clampScore(aiResult.dimensionScores.coachability).toFixed(1)),
      },
      strengths: toStringArray(aiResult.strengths, ['You stayed engaged through the rep.']),
      improvementAreas: toStringArray(aiResult.improvementAreas, ['Keep making the language more specific to the moment.']),
      evaluationSummary: (aiResult.evaluationSummary || `${spec.evaluationLead} Keep sharpening the next rep.`).trim(),
      nextRepFocus: (aiResult.nextRepFocus || spec.nextRepFocus).trim(),
      coachabilityTrend: aiResult.coachabilityTrend || 'steady',
      voiceSignalsSummary: summarizeVoiceSignals(submittedTurns),
      evaluationSource: 'ai',
      evaluationModel: model,
      evaluationLatencyMs: Date.now() - startedAt,
    };

    return res.status(200).json({
      success: true,
      model,
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
