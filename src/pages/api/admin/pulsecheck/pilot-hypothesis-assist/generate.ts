import type { NextApiRequest, NextApiResponse } from 'next';
import OpenAI from 'openai';
import { requireAdminRequest } from '../../_auth';
import type {
  PilotHypothesisAssistFrame,
  PilotHypothesisAssistGenerationInput,
  PilotHypothesisAssistSuggestion,
} from '../../../../../api/firebase/pulsecheckPilotDashboard/types';

const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const PROMPT_VERSION = 'pilot-hypothesis-assist-v1';

function normalizeString(value?: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function clampConfidence(level?: string): 'low' | 'medium' | 'high' {
  return level === 'high' || level === 'medium' ? level : 'low';
}

function parseJsonSafe(raw: string): any {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function normalizeSuggestion(raw: any, index: number): PilotHypothesisAssistSuggestion | null {
  if (!raw || typeof raw !== 'object') return null;

  const title = normalizeString(raw.title);
  const statement = normalizeString(raw.statement);
  const leadingIndicator = normalizeString(raw.leadingIndicator);
  const whySuggested = normalizeString(raw.whySuggested);
  const caveat = normalizeString(raw.caveat);

  if (!title || !statement || !leadingIndicator || !whySuggested || !caveat) return null;

  return {
    suggestionKey: normalizeString(raw.suggestionKey) || `assist-${index + 1}`,
    title,
    statement,
    leadingIndicator,
    whySuggested,
    confidenceLevel: clampConfidence(normalizeString(raw.confidenceLevel)),
    evidenceSignals: Array.isArray(raw.evidenceSignals)
      ? raw.evidenceSignals.map((value: unknown) => normalizeString(value)).filter(Boolean)
      : [],
    caveat,
  };
}

function statementsLookSimilar(existing: string[], candidate: string) {
  const normalizedCandidate = candidate.toLowerCase();
  return existing.some((statement) => {
    const normalizedExisting = statement.toLowerCase();
    return normalizedExisting === normalizedCandidate || normalizedExisting.includes(normalizedCandidate) || normalizedCandidate.includes(normalizedExisting);
  });
}

function buildFallbackSuggestions(frame: PilotHypothesisAssistFrame): PilotHypothesisAssistSuggestion[] {
  const existingStatements = frame.hypotheses.map((hypothesis) => normalizeString(hypothesis.statement)).filter(Boolean);
  const suggestions: PilotHypothesisAssistSuggestion[] = [];

  const candidateSuggestions: PilotHypothesisAssistSuggestion[] = [
    {
      suggestionKey: 'coverage-to-stability',
      title: 'Coverage Drives Stable Learning',
      statement:
        'Athletes with stronger physiological coverage and deeper evidence accumulation will reach stable body-state patterns earlier in the pilot than athletes with weaker coverage.',
      leadingIndicator:
        'Compare stable-pattern emergence between athletes above vs. below the current median for engine coverage and evidence records.',
      whySuggested:
        `Current engine coverage is ${frame.coverage.engineCoverageRate.toFixed(1)}% and stable-pattern rate is ${frame.coverage.stablePatternRate.toFixed(1)}%, which suggests instrumentation quality may be a major gate on whether the pilot can learn personalized structure.`,
      confidenceLevel: frame.coverage.engineCoverageRate >= 60 ? 'high' : 'medium',
      evidenceSignals: ['engine coverage', 'stable pattern rate', 'average evidence per athlete'],
      caveat:
        'This is still an association-style hypothesis. Coverage quality may be standing in for adherence, pilot duration, or wearable-connect behavior rather than a purely causal mechanism.',
    },
    {
      suggestionKey: 'cohort-differences',
      title: 'Cohort Differences Matter',
      statement:
        'Cohorts within the pilot will differ meaningfully in how quickly stable patterns and recommendation-ready outputs emerge, rather than maturing at the same pace.',
      leadingIndicator:
        'Track stable-pattern rate, engine coverage, and recommendation projections by cohort across the pilot review checkpoints.',
      whySuggested:
        frame.cohortSummaries.length > 1
          ? `This pilot has ${frame.cohortSummaries.length} cohort lanes in scope, which makes it worth testing whether the learning signal is genuinely pilot-wide or concentrated inside one subgroup.`
          : 'This suggestion is weaker when only one cohort is in scope, but it can still help frame later segmentation once more lanes are added.',
      confidenceLevel: frame.cohortSummaries.length > 1 ? 'medium' : 'low',
      evidenceSignals: ['cohort rollups', 'stable pattern rate', 'recommendation projections'],
      caveat:
        'Only treat cohort differences as meaningful if the denominators stay healthy. Small subgroup counts can make ordinary variation look like experimental structure.',
    },
    {
      suggestionKey: 'stable-patterns-to-projections',
      title: 'Stable Patterns Unlock Practical Output',
      statement:
        'Athletes who reach at least one stable pattern will generate more recommendation-ready projections than athletes who remain below the stable-pattern threshold.',
      leadingIndicator:
        'Compare recommendation-projection counts between athletes with at least one stable pattern and athletes with none.',
      whySuggested:
        `The current pilot has ${frame.metrics.totalRecommendationProjections} projections and ${frame.metrics.athletesWithStablePatterns} athletes with stable patterns, which makes it useful to test whether stable learning is actually translating into more operational output.`,
      confidenceLevel: frame.metrics.athletesWithStablePatterns > 0 ? 'medium' : 'low',
      evidenceSignals: ['stable pattern count', 'recommendation projection count', 'pattern model count'],
      caveat:
        'More projections are only helpful if they remain well-grounded and interpretable. Output volume alone should not be treated as experiment success.',
    },
    {
      suggestionKey: 'evidence-depth-threshold',
      title: 'Evidence Depth Threshold',
      statement:
        'There is a practical evidence-depth threshold inside the pilot beyond which stable body-state learning becomes much more likely for an individual athlete.',
      leadingIndicator:
        'Look for a step-up in stable-pattern emergence once athletes pass a defined evidence-record range rather than assuming a smooth linear relationship.',
      whySuggested:
        `Average evidence per active athlete is ${frame.coverage.avgEvidenceRecordsPerActiveAthlete.toFixed(1)}, which makes it worth testing whether the pilot is approaching a real per-athlete learning threshold rather than a simple more-is-better curve.`,
      confidenceLevel: frame.coverage.avgEvidenceRecordsPerActiveAthlete >= 5 ? 'medium' : 'low',
      evidenceSignals: ['average evidence per athlete', 'stable pattern rate', 'athletes with stable patterns'],
      caveat:
        'This should be treated as a threshold-seeking hypothesis, not proof that one exact number is universally meaningful across athletes or pilots.',
    },
  ];

  candidateSuggestions.forEach((suggestion) => {
    if (suggestions.length >= 4) return;
    if (statementsLookSimilar(existingStatements, suggestion.statement)) return;
    if (suggestion.suggestionKey === 'cohort-differences' && frame.cohortSummaries.length < 2) return;
    suggestions.push(suggestion);
  });

  return suggestions.slice(0, 3);
}

function buildPrompt(frame: PilotHypothesisAssistFrame, fallbackSuggestions: PilotHypothesisAssistSuggestion[]) {
  return `You are Nora, an AI research copilot helping a PulseCheck admin decide what this pilot should hypothesize next.

Your job is to suggest 3 to 5 pilot-scoped hypotheses worth testing next, based only on the governed pilot frame below.

Rules:
- Suggest hypotheses, not conclusions.
- Do not restate the existing hypotheses unless you are clearly refining a missing angle.
- Stay pilot-scoped and denominator-aware.
- Prefer ideas that help the team learn something meaningful from the current pilot, not generic sports-science trivia.
- Good suggestions often connect coverage, evidence depth, stable patterns, cohort differences, or recommendation readiness to a testable next question.
- Do not overstate causality.
- Each suggestion must feel like something a strong research partner would propose for review.

Return strict JSON with this shape:
{
  "suggestions": [
    {
      "suggestionKey": string,
      "title": string,
      "statement": string,
      "leadingIndicator": string,
      "whySuggested": string,
      "confidenceLevel": "low" | "medium" | "high",
      "evidenceSignals": string[],
      "caveat": string
    }
  ]
}

Governed pilot frame:
${JSON.stringify(frame, null, 2)}

Fallback factual baseline:
${JSON.stringify(fallbackSuggestions, null, 2)}`;
}

async function generateSuggestionsWithAi(frame: PilotHypothesisAssistFrame, fallbackSuggestions: PilotHypothesisAssistSuggestion[]) {
  const apiKey = process.env.OPENAI_API_KEY || process.env.OPEN_AI_SECRET_KEY;
  if (!apiKey) {
    return {
      modelVersion: 'deterministic-fallback',
      suggestions: fallbackSuggestions,
    };
  }

  try {
    const openai = new OpenAI({ apiKey });
    const response = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      temperature: 0.3,
      max_tokens: 1800,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: 'You generate careful, pilot-scoped research hypothesis suggestions in strict JSON.',
        },
        {
          role: 'user',
          content: buildPrompt(frame, fallbackSuggestions),
        },
      ],
    });

    const raw = response.choices?.[0]?.message?.content?.trim() || '';
    const parsed = parseJsonSafe(raw);
    const normalized = Array.isArray(parsed?.suggestions)
      ? parsed.suggestions.map(normalizeSuggestion).filter(Boolean)
      : [];

    return {
      modelVersion: OPENAI_MODEL,
      suggestions: normalized.length > 0 ? normalized.slice(0, 5) : fallbackSuggestions,
    };
  } catch (error) {
    console.error('[pilot-hypothesis-assist] AI generation failed, using fallback:', error);
    return {
      modelVersion: 'deterministic-fallback',
      suggestions: fallbackSuggestions,
    };
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const adminUser = await requireAdminRequest(req);
  if (!adminUser) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = (req.body || {}) as {
    frame?: PilotHypothesisAssistFrame;
    options?: PilotHypothesisAssistGenerationInput;
  };

  const frame = body.frame;
  const options: PilotHypothesisAssistGenerationInput = body.options || { pilotId: '' };

  if (!frame || !normalizeString(frame.pilotId) || !normalizeString(options.pilotId)) {
    return res.status(400).json({ error: 'A valid pilot-scoped frame is required.' });
  }

  if (normalizeString(frame.pilotId) !== normalizeString(options.pilotId)) {
    return res.status(400).json({ error: 'Pilot frame and hypothesis-assist options are out of sync.' });
  }

  const frozenFrame: PilotHypothesisAssistFrame = {
    ...frame,
    pilotId: normalizeString(frame.pilotId),
    organizationId: normalizeString(frame.organizationId),
    organizationName: normalizeString(frame.organizationName),
    teamId: normalizeString(frame.teamId),
    teamName: normalizeString(frame.teamName),
    pilotName: normalizeString(frame.pilotName),
    pilotStatus: normalizeString(frame.pilotStatus),
    pilotStudyMode: normalizeString(frame.pilotStudyMode),
    cohortId: normalizeString(options.cohortId || frame.cohortId) || undefined,
    cohortName: normalizeString(frame.cohortName) || undefined,
    metrics: frame.metrics,
    coverage: frame.coverage,
    cohortSummaries: Array.isArray(frame.cohortSummaries) ? frame.cohortSummaries : [],
    hypotheses: Array.isArray(frame.hypotheses) ? frame.hypotheses : [],
  };

  const fallbackSuggestions = buildFallbackSuggestions(frozenFrame);
  const generated = await generateSuggestionsWithAi(frozenFrame, fallbackSuggestions);

  return res.status(200).json({
    suggestions: generated.suggestions,
    modelVersion: generated.modelVersion,
    promptVersion: PROMPT_VERSION,
    generatedForPilotId: frozenFrame.pilotId,
    generatedByEmail: adminUser.email,
  });
}
