import type { NextApiRequest, NextApiResponse } from 'next';
import OpenAI from 'openai';
import admin from '../../../../../lib/firebase-admin';
import { requireAdminRequest } from '../../_auth';

const COLLECTION = 'pulsecheck-pilot-research-readouts';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const PROMPT_VERSION = 'pilot-research-readout-v2';
const READ_MODEL_VERSION = 'pilot-dashboard-v1';
const SECTION_ORDER: Array<'pilot-summary' | 'hypothesis-mapper' | 'findings-interpreter' | 'research-notes' | 'limitations'> = [
  'pilot-summary',
  'hypothesis-mapper',
  'findings-interpreter',
  'research-notes',
  'limitations',
];

type ClaimType = 'observed' | 'inferred' | 'speculative';
type BaselineMode = 'within-athlete' | 'cross-cohort' | 'pre-pilot-baseline' | 'no-baseline';
type ReviewState = 'draft' | 'reviewed' | 'approved' | 'superseded';
type ConfidenceLevel = 'low' | 'medium' | 'high';

interface ReadinessGateResult {
  gateKey: string;
  status: 'passed' | 'failed' | 'suppressed';
  summary: string;
}

interface ResearchReadoutFrame {
  pilotId: string;
  organizationId: string;
  organizationName: string;
  teamId: string;
  teamName: string;
  pilotName: string;
  pilotStatus: string;
  pilotStudyMode: string;
  cohortId?: string;
  cohortName?: string;
  dateWindowStart: string;
  dateWindowEnd: string;
  baselineMode: BaselineMode;
  metrics: {
    activeAthleteCount: number;
    totalEnrollmentCount: number;
    cohortCount: number;
    athletesWithEngineRecord: number;
    athletesWithStablePatterns: number;
    totalEvidenceRecords: number;
    totalPatternModels: number;
    totalRecommendationProjections: number;
    hypothesisCount: number;
  };
  coverage: {
    engineCoverageRate: number;
    stablePatternRate: number;
    avgEvidenceRecordsPerActiveAthlete: number;
    avgPatternModelsPerActiveAthlete: number;
    avgRecommendationProjectionsPerActiveAthlete: number;
  };
  cohortSummaries: Array<{
    cohortId: string;
    cohortName: string;
    cohortStatus: string;
    activeAthleteCount: number;
    athletesWithEngineRecord: number;
    athletesWithStablePatterns: number;
    totalEvidenceRecords: number;
    totalPatternModels: number;
    totalRecommendationProjections: number;
  }>;
  hypotheses: Array<{
    code: string;
    statement: string;
    leadingIndicator: string;
    status: string;
    confidenceLevel: ConfidenceLevel;
    keyEvidence?: string;
    notes?: string;
  }>;
}

function normalizeString(value?: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function clampConfidence(level?: string): ConfidenceLevel {
  return level === 'high' || level === 'medium' ? level : 'low';
}

function parseJsonSafe(raw: string): any {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function buildReadiness(frame: ResearchReadoutFrame): ReadinessGateResult[] {
  const gates: ReadinessGateResult[] = [];
  const isPilotReady = frame.pilotStatus === 'active' || frame.pilotStatus === 'completed';
  gates.push({
    gateKey: 'pilot-status',
    status: isPilotReady ? 'passed' : 'failed',
    summary: isPilotReady
      ? `Pilot status ${frame.pilotStatus} is eligible for readout generation.`
      : `Pilot status ${frame.pilotStatus || 'unknown'} is not eligible for official readout generation.`,
  });

  gates.push({
    gateKey: 'sample-size',
    status: frame.metrics.activeAthleteCount >= 3 ? 'passed' : 'failed',
    summary:
      frame.metrics.activeAthleteCount >= 3
        ? `${frame.metrics.activeAthleteCount} active pilot athletes are available in the selected frame.`
        : `Only ${frame.metrics.activeAthleteCount} active pilot athletes are available; sample is too small for stronger interpretation.`,
  });

  gates.push({
    gateKey: 'telemetry-completeness',
    status: frame.coverage.engineCoverageRate >= 25 ? 'passed' : 'failed',
    summary:
      frame.coverage.engineCoverageRate >= 25
        ? `Engine coverage is ${frame.coverage.engineCoverageRate.toFixed(1)}% in the selected frame.`
        : `Engine coverage is only ${frame.coverage.engineCoverageRate.toFixed(1)}%; telemetry is too uneven for stronger interpretation.`,
  });

  gates.push({
    gateKey: 'freshness-telemetry',
    status: 'suppressed',
    summary: 'Stale-data and recompute-risk telemetry are not yet fully materialized in the governed V1 read model, so freshness-sensitive claims should remain cautious.',
  });

  gates.push({
    gateKey: 'denominator-availability',
    status: frame.metrics.activeAthleteCount > 0 ? 'passed' : 'failed',
    summary:
      frame.metrics.activeAthleteCount > 0
        ? 'Pilot-scoped denominators are available for the selected frame.'
        : 'No active pilot-athlete denominator is available for the selected frame.',
  });

  return gates;
}

function limitationKeysFromReadiness(readiness: ReadinessGateResult[]): string[] {
  return readiness.filter((gate) => gate.status !== 'passed').map((gate) => gate.gateKey);
}

function buildFallbackSections(frame: ResearchReadoutFrame, readiness: ReadinessGateResult[]) {
  const limitationKeys = limitationKeysFromReadiness(readiness);
  const denominator = frame.metrics.activeAthleteCount;
  const cohortLabel = frame.cohortName || 'whole pilot';
  const promisingCount = frame.hypotheses.filter((item) => item.status === 'promising').length;
  const mixedCount = frame.hypotheses.filter((item) => item.status === 'mixed').length;
  const notSupportedCount = frame.hypotheses.filter((item) => item.status === 'not-supported').length;
  const notEnoughDataCount = frame.hypotheses.filter((item) => item.status === 'not-enough-data').length;
  const primarySuppression = readiness.find((gate) => gate.status === 'failed');

  return [
    {
      sectionKey: 'pilot-summary',
      title: 'Pilot Summary',
      readinessStatus: primarySuppression ? 'suppressed' : 'ready',
      summary: primarySuppression
        ? `Insufficient evidence for interpretation: ${primarySuppression.summary}`
        : `${frame.pilotName} currently includes ${frame.metrics.activeAthleteCount} active athletes in the selected ${cohortLabel} frame. Within that frozen window, ${frame.metrics.athletesWithStablePatterns} athletes reached at least one stable pattern and ${frame.metrics.totalRecommendationProjections} recommendation projections were persisted. The pilot appears to be producing usable learning for part of the population, but interpretation should stay bounded by the current evidence coverage.`,
      citations: [
        {
          blockKey: 'overview-metrics',
          blockLabel: 'Pilot Overview Metrics',
          hypothesisCodes: [],
          limitationKeys,
        },
      ],
      claims: primarySuppression
        ? []
        : [
            {
              claimKey: 'pilot-athlete-count',
              claimType: 'observed' as ClaimType,
              statement: `${frame.metrics.activeAthleteCount} active pilot athletes were included in the frozen evidence frame for ${cohortLabel}.`,
              denominatorLabel: 'active pilot athletes',
              denominatorValue: denominator,
              evidenceSources: ['pilot overview metrics', 'pilot enrollment scope'],
              confidenceLevel: 'high' as ConfidenceLevel,
              baselineMode: frame.baselineMode,
              caveatFlag: false,
            },
            {
              claimKey: 'stable-pattern-coverage',
              claimType: 'observed' as ClaimType,
              statement: `${frame.metrics.athletesWithStablePatterns} of ${denominator} active athletes reached at least one stable pattern in the frozen frame.`,
              denominatorLabel: 'active pilot athletes',
              denominatorValue: denominator,
              evidenceSources: ['stable pattern rate', 'pattern model counts'],
              confidenceLevel: denominator >= 8 ? 'medium' : 'low',
              baselineMode: frame.baselineMode,
              caveatFlag: denominator < 8,
            },
          ],
      suggestedReviewerResolution: 'accepted',
    },
    {
      sectionKey: 'hypothesis-mapper',
      title: 'Hypothesis Mapper',
      readinessStatus: frame.hypotheses.length > 0 ? 'ready' : 'suppressed',
      summary:
        frame.hypotheses.length > 0
          ? `${promisingCount} hypotheses are currently marked promising, ${mixedCount} are mixed, ${notSupportedCount} are not supported, and ${notEnoughDataCount} remain in not-enough-data posture. The useful question for review is not which hypothesis is “winning,” but which ones now have enough pilot evidence to move from intuition into disciplined interpretation.`
          : 'Insufficient evidence for interpretation: no active pilot hypotheses are available in the selected frame.',
      citations: [
        {
          blockKey: 'hypothesis-governance',
          blockLabel: 'Pilot Hypotheses',
          hypothesisCodes: frame.hypotheses.map((hypothesis) => hypothesis.code),
          limitationKeys,
        },
      ],
      claims:
        frame.hypotheses.length > 0
          ? [
              {
                claimKey: 'hypothesis-promising-count',
                claimType: 'observed' as ClaimType,
                statement: `${promisingCount} of ${frame.hypotheses.length} pilot hypotheses are currently marked promising in the governed dashboard state.`,
                denominatorLabel: 'pilot hypotheses',
                denominatorValue: frame.hypotheses.length,
                evidenceSources: ['hypothesis status summary', 'manual hypothesis records'],
                confidenceLevel: 'medium' as ConfidenceLevel,
                baselineMode: 'no-baseline' as BaselineMode,
                caveatFlag: true,
              },
            ]
          : [],
      suggestedReviewerResolution: 'accepted',
    },
    {
      sectionKey: 'findings-interpreter',
      title: 'Findings Interpreter',
      readinessStatus: denominator > 0 ? 'ready' : 'suppressed',
      summary:
        denominator > 0
          ? `The strongest V1 question in this frozen frame is whether the pilot is producing enough stable structure to justify personalized interpretation. Engine coverage is ${frame.coverage.engineCoverageRate.toFixed(1)}% and stable-pattern coverage is ${frame.coverage.stablePatternRate.toFixed(1)}%, which suggests the pilot is learning for part of the enrolled population, but that learning likely remains uneven across cohorts and should not yet be generalized too broadly.`
          : 'Insufficient evidence for interpretation: no active pilot-athlete denominator is available.',
      citations: [
        {
          blockKey: 'findings-layer',
          blockLabel: 'Pilot Findings',
          hypothesisCodes: frame.hypotheses.map((hypothesis) => hypothesis.code),
          limitationKeys,
        },
      ],
      claims:
        denominator > 0
          ? [
              {
                claimKey: 'engine-coverage-claim',
                claimType: 'observed' as ClaimType,
                statement: `Engine coverage is ${frame.coverage.engineCoverageRate.toFixed(1)}% in the frozen ${cohortLabel} frame.`,
                denominatorLabel: 'active pilot athletes',
                denominatorValue: denominator,
                evidenceSources: ['engine coverage', 'athletes with engine record'],
                confidenceLevel: 'medium' as ConfidenceLevel,
                baselineMode: frame.baselineMode,
                caveatFlag: frame.coverage.engineCoverageRate < 50,
              },
              {
                claimKey: 'personalization-readiness',
                claimType: 'inferred' as ClaimType,
                statement: 'The current signal pattern is consistent with partial personalization readiness, but the pilot still lacks enough governed outcome-validation and adoption evidence to support stronger claims about usefulness or effect.',
                denominatorLabel: 'active pilot athletes',
                denominatorValue: denominator,
                evidenceSources: ['stable pattern rate', 'recommendation projection counts', 'readiness gates'],
                confidenceLevel: denominator >= 10 ? 'medium' : 'low',
                baselineMode: frame.baselineMode,
                caveatFlag: true,
              },
            ]
          : [],
      suggestedReviewerResolution: 'accepted',
    },
    {
      sectionKey: 'research-notes',
      title: 'Research Notes',
      readinessStatus: 'ready',
      summary:
        frame.metrics.athletesWithStablePatterns > 0
          ? 'A cautious publishable-finding candidate for follow-up is whether a meaningful share of pilot athletes develop stable body-state patterns inside the pilot window. That is a candidate observation, not a conclusion: it still requires replication, stronger denominator discipline, and later linkage to validation or behavior outcomes.'
          : 'The current frame does not yet support a publishable-finding candidate beyond instrumentation readiness and evidence sufficiency observations.',
      citations: [
        {
          blockKey: 'research-notes',
          blockLabel: 'Research Notes',
          hypothesisCodes: ['H1', 'H2'],
          limitationKeys,
        },
      ],
      claims: [
        {
          claimKey: 'publishable-candidate',
          claimType: 'speculative' as ClaimType,
          statement: 'Stable-pattern emergence inside the pilot may become a publishable candidate finding if the same signal replicates across later frames and can later be linked to stronger validation or behavior outcomes.',
          denominatorLabel: 'active pilot athletes',
          denominatorValue: denominator,
          evidenceSources: ['stable pattern rate', 'hypothesis governance'],
          confidenceLevel: 'low' as ConfidenceLevel,
          baselineMode: frame.baselineMode,
          caveatFlag: true,
        },
      ],
      suggestedReviewerResolution: 'carry-forward',
    },
    {
      sectionKey: 'limitations',
      title: 'Limitations',
      readinessStatus: 'ready',
      summary: 'Interpretation remains limited by V1 telemetry coverage, the absence of mature adoption and outcome-validation joins, and the fact that freshness-risk posture is only partially materialized in the current read model.',
      citations: [
        {
          blockKey: 'limitations',
          blockLabel: 'Readiness And Limitations',
          hypothesisCodes: [],
          limitationKeys,
        },
      ],
      claims: [
        {
          claimKey: 'limitations-claim',
          claimType: 'observed' as ClaimType,
          statement: 'Outcome validation and adoption telemetry are not yet available as governed V1 inputs for this readout.',
          denominatorLabel: 'governed readout sections',
          denominatorValue: 5,
          evidenceSources: ['readiness gates', 'pilot dashboard V1 scope'],
          confidenceLevel: 'high' as ConfidenceLevel,
          baselineMode: 'no-baseline' as BaselineMode,
          caveatFlag: true,
        },
      ],
      suggestedReviewerResolution: 'accepted',
    },
  ];
}

function buildPrompt(frame: ResearchReadoutFrame, readiness: ReadinessGateResult[], fallbackSections: any[]) {
  return `You are a cautious pilot research copilot for PulseCheck.

Write like a strong PhD-level researcher sitting beside an admin: clear, calm, rigorous, helpful, and never theatrical. Your job is to help the reviewer understand what happened in this pilot, what is trustworthy, what still needs caution, and what might be worth following up on.

Use ONLY the governed pilot frame provided below. Do not invent data. Do not overstate causality. Do not collapse engine health, evidence quality, findings, adoption, and hypothesis governance into one blended success narrative.

Research posture rules:
- Every claim must be tagged as "observed", "inferred", or "speculative".
- Use causal language only if the evidence frame truly supports it. Otherwise prefer language like "was associated with", "showed a pattern consistent with", or "requires replication".
- If a section is not supported, set readinessStatus to "suppressed" and say why plainly.
- Keep every section pilot-scoped and denominator-aware.
- Hypothesis suggestions do not replace human review.
- The Pilot Summary should read like a concise executive research brief, not telemetry narration.
- The Hypothesis Mapper should help a reviewer see which hypotheses gained support, which remain mixed, and which are still too early.
- The Findings Interpreter should explain what the pattern means for this pilot, not just restate counts.
- The Research Notes section should propose only cautious publishable candidates, framed as candidates with caveats and replication needs.
- The Limitations section should be explicit and direct; uncertainty should feel useful, not apologetic.

Return valid JSON with this exact top-level shape:
{
  "sections": [
    {
      "sectionKey": "pilot-summary" | "hypothesis-mapper" | "findings-interpreter" | "research-notes" | "limitations",
      "title": string,
      "readinessStatus": "ready" | "suppressed",
      "summary": string,
      "citations": [
        {
          "blockKey": string,
          "blockLabel": string,
          "hypothesisCodes": string[],
          "limitationKeys": string[]
        }
      ],
      "claims": [
        {
          "claimKey": string,
          "claimType": "observed" | "inferred" | "speculative",
          "statement": string,
          "denominatorLabel": string,
          "denominatorValue": number,
          "evidenceSources": string[],
          "confidenceLevel": "low" | "medium" | "high",
          "baselineMode": "within-athlete" | "cross-cohort" | "pre-pilot-baseline" | "no-baseline",
          "caveatFlag": boolean
        }
      ],
      "suggestedReviewerResolution": "accepted" | "revised" | "rejected" | "carry-forward"
    }
  ]
}

Governed pilot frame:
${JSON.stringify(frame, null, 2)}

Readiness results:
${JSON.stringify(readiness, null, 2)}

Fallback structure and factual baseline:
${JSON.stringify(fallbackSections, null, 2)}`;
}

function normalizeGeneratedSections(rawSections: any, fallbackSections: any[]) {
  const candidateSections = Array.isArray(rawSections) ? rawSections : fallbackSections;
  const sectionMap = new Map(
    candidateSections
      .filter((section) => section && typeof section === 'object' && normalizeString(section.sectionKey))
      .map((section) => [normalizeString(section.sectionKey), section])
  );

  return SECTION_ORDER.map((sectionKey) => sectionMap.get(sectionKey) || fallbackSections.find((entry) => entry.sectionKey === sectionKey)).filter(Boolean);
}

async function generateSectionsWithAi(frame: ResearchReadoutFrame, readiness: ReadinessGateResult[], fallbackSections: any[]) {
  const apiKey = process.env.OPENAI_API_KEY || process.env.OPEN_AI_SECRET_KEY;
  if (!apiKey) {
    return {
      modelVersion: 'deterministic-fallback',
      sections: fallbackSections,
    };
  }

  try {
    const openai = new OpenAI({ apiKey });
    const response = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      temperature: 0.2,
      max_tokens: 3500,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: 'You generate cautious, evidence-bounded pilot research summaries in strict JSON.',
        },
        {
          role: 'user',
          content: buildPrompt(frame, readiness, fallbackSections),
        },
      ],
    });

    const raw = response.choices?.[0]?.message?.content?.trim() || '';
    const parsed = parseJsonSafe(raw);
    const sections = normalizeGeneratedSections(parsed?.sections, fallbackSections);
    return {
      modelVersion: OPENAI_MODEL,
      sections,
    };
  } catch (error) {
    console.error('[pilot-research-readout] AI generation failed, using fallback:', error);
    return {
      modelVersion: 'deterministic-fallback',
      sections: normalizeGeneratedSections(fallbackSections, fallbackSections),
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
    frame?: ResearchReadoutFrame;
    options?: {
      pilotId?: string;
      cohortId?: string;
      dateWindowStart?: string;
      dateWindowEnd?: string;
      baselineMode?: BaselineMode;
    };
  };

  const frame = body.frame;
  const options = body.options || {};

  if (!frame || !normalizeString(frame.pilotId) || !normalizeString(options.pilotId)) {
    return res.status(400).json({ error: 'A valid pilot-scoped frozen frame is required.' });
  }

  if (normalizeString(frame.pilotId) !== normalizeString(options.pilotId)) {
    return res.status(400).json({ error: 'Pilot frame and generation options are out of sync.' });
  }

  if (!normalizeString(options.dateWindowStart) || !normalizeString(options.dateWindowEnd)) {
    return res.status(400).json({ error: 'A valid date window is required.' });
  }

  const frozenFrame: ResearchReadoutFrame = {
    ...frame,
    pilotId: normalizeString(frame.pilotId),
    organizationId: normalizeString(frame.organizationId),
    teamId: normalizeString(frame.teamId),
    organizationName: normalizeString(frame.organizationName),
    teamName: normalizeString(frame.teamName),
    pilotName: normalizeString(frame.pilotName),
    cohortId: normalizeString(options.cohortId || frame.cohortId) || undefined,
    cohortName: normalizeString(frame.cohortName),
    dateWindowStart: normalizeString(options.dateWindowStart),
    dateWindowEnd: normalizeString(options.dateWindowEnd),
    baselineMode: (normalizeString(options.baselineMode || frame.baselineMode) as BaselineMode) || 'no-baseline',
  };

  const readiness = buildReadiness(frozenFrame);
  const fallbackSections = buildFallbackSections(frozenFrame, readiness);
  const generated = await generateSectionsWithAi(frozenFrame, readiness, fallbackSections);

  try {
    const db = admin.firestore();
    const readoutRef = db.collection(COLLECTION).doc();
    await readoutRef.set({
      pilotId: frozenFrame.pilotId,
      organizationId: frozenFrame.organizationId,
      teamId: frozenFrame.teamId,
      cohortId: frozenFrame.cohortId || null,
      dateWindowStart: frozenFrame.dateWindowStart,
      dateWindowEnd: frozenFrame.dateWindowEnd,
      baselineMode: frozenFrame.baselineMode,
      reviewState: 'draft' as ReviewState,
      modelVersion: generated.modelVersion,
      promptVersion: PROMPT_VERSION,
      readModelVersion: READ_MODEL_VERSION,
      readiness,
      sections: generated.sections,
      frozenEvidenceFrame: frozenFrame,
      generatedAt: admin.firestore.FieldValue.serverTimestamp(),
      reviewedAt: null,
      reviewedByUserId: null,
      reviewedByEmail: null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdByEmail: adminUser.email,
    });

    return res.status(200).json({
      readoutId: readoutRef.id,
      modelVersion: generated.modelVersion,
    });
  } catch (error: any) {
    console.error('[pilot-research-readout] Failed to save readout:', error);
    return res.status(500).json({ error: error?.message || 'Failed to generate pilot research readout.' });
  }
}
