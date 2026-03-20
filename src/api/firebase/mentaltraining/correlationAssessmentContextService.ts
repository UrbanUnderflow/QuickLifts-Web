import { getDocs, limit, orderBy, query } from 'firebase/firestore';
import { correlationEngineService } from './correlationEngineService';
import { stateSnapshotService } from './stateSnapshotService';
import type {
  AssessmentContextFlag,
  AssessmentFlagMilestone,
  AthletePatternModel,
  CorrelationConfidenceTier,
} from './correlationEngineTypes';
import type { PulseCheckStateSnapshot } from './types';

const ENGINE_VERSION = 'correlation_engine_v0_1';
const CAPTURE_WINDOW_HALF_SPAN_MS = 12 * 60 * 60 * 1000;
const SNAPSHOT_STALE_WINDOW_MS = 72 * 60 * 60 * 1000;

function confidenceRank(tier: CorrelationConfidenceTier): number {
  switch (tier) {
    case 'high_confidence':
      return 5;
    case 'stable':
      return 4;
    case 'emerging':
      return 3;
    case 'directional':
      return 2;
    case 'degraded':
    default:
      return 1;
  }
}

function sortPatterns(patterns: AthletePatternModel[]): AthletePatternModel[] {
  return [...patterns].sort((left, right) => {
    const confidenceDelta = confidenceRank(right.confidenceTier) - confidenceRank(left.confidenceTier);
    if (confidenceDelta !== 0) return confidenceDelta;
    return (right.confidenceScore || 0) - (left.confidenceScore || 0);
  });
}

function isEvidenceReady(pattern: AthletePatternModel): boolean {
  return pattern.recommendationEligibility !== 'not_eligible'
    && confidenceRank(pattern.confidenceTier) >= confidenceRank('emerging');
}

function buildSupportingSignals(
  snapshot: PulseCheckStateSnapshot,
  patterns: AthletePatternModel[]
): string[] {
  return [
    `overall_readiness:${snapshot.overallReadiness}`,
    `focus_readiness:${Math.round(snapshot.stateDimensions.focusReadiness)}`,
    `cognitive_fatigue:${Math.round(snapshot.stateDimensions.cognitiveFatigue)}`,
    `emotional_load:${Math.round(snapshot.stateDimensions.emotionalLoad)}`,
    `state_confidence:${snapshot.confidence}`,
    ...snapshot.sourcesUsed.slice(0, 4).map((source) => `source:${source}`),
    ...patterns.slice(0, 3).map((pattern) => `pattern:${pattern.patternFamily}`),
  ];
}

function deriveAssessmentStatus(
  snapshot: PulseCheckStateSnapshot,
  patterns: AthletePatternModel[]
): AssessmentContextFlag['status'] {
  const topPattern = patterns[0];
  const hasReadyPattern = patterns.some(isEvidenceReady);
  const snapshotLooksStale = Date.now() - snapshot.updatedAt > SNAPSHOT_STALE_WINDOW_MS;

  if (!hasReadyPattern || snapshot.confidence === 'low' || snapshotLooksStale) {
    return 'unknown';
  }

  if (
    snapshot.overallReadiness === 'red'
    || snapshot.stateDimensions.cognitiveFatigue >= 70
    || snapshot.stateDimensions.emotionalLoad >= 70
    || topPattern?.directionality === 'negative'
  ) {
    return 'compromised';
  }

  if (
    confidenceRank(topPattern?.confidenceTier ?? 'degraded') >= confidenceRank('stable')
    && snapshot.overallReadiness === 'green'
    && snapshot.stateDimensions.focusReadiness >= 65
    && snapshot.stateDimensions.cognitiveFatigue <= 45
  ) {
    return 'advantaged';
  }

  return 'normal';
}

function deriveConfidenceTier(
  snapshot: PulseCheckStateSnapshot,
  patterns: AthletePatternModel[],
  status: AssessmentContextFlag['status']
): CorrelationConfidenceTier {
  const topPattern = patterns[0];
  if (!topPattern || snapshot.confidence === 'low' || status === 'unknown') return 'degraded';
  if (topPattern.confidenceTier === 'high_confidence' && snapshot.confidence === 'high') return 'high_confidence';
  if (confidenceRank(topPattern.confidenceTier) >= confidenceRank('stable')) return 'stable';
  if (confidenceRank(topPattern.confidenceTier) >= confidenceRank('emerging')) return 'emerging';
  return 'directional';
}

function deriveConfidenceScore(
  snapshot: PulseCheckStateSnapshot,
  patterns: AthletePatternModel[],
  confidenceTier: CorrelationConfidenceTier
): number {
  const topPattern = patterns[0];
  const base = topPattern?.confidenceScore ?? 0.2;
  const snapshotBonus = snapshot.confidence === 'high' ? 0.08 : snapshot.confidence === 'medium' ? 0.03 : -0.08;
  const capped = Math.max(0.05, Math.min(0.99, base + snapshotBonus));

  if (confidenceTier === 'degraded') return Math.min(capped, 0.39);
  if (confidenceTier === 'directional') return Math.min(Math.max(capped, 0.4), 0.54);
  if (confidenceTier === 'emerging') return Math.min(Math.max(capped, 0.55), 0.69);
  if (confidenceTier === 'stable') return Math.min(Math.max(capped, 0.7), 0.84);
  return Math.max(capped, 0.85);
}

function buildDeviationSummary(
  status: AssessmentContextFlag['status'],
  patterns: AthletePatternModel[]
): string {
  const topPattern = patterns[0];
  if (status === 'advantaged') {
    return 'This checkpoint landed inside a body-state window that usually supports stronger cognitive work for you.';
  }
  if (status === 'compromised') {
    return 'This checkpoint landed in a lower-recovery window than your sharper days usually show.';
  }
  if (status === 'normal') {
    return 'This checkpoint landed inside a normal body-state range relative to your recent physiology-cognition patterns.';
  }
  return topPattern
    ? 'Nora can see a possible pattern here, but there is not enough clean evidence yet to grade this checkpoint with confidence.'
    : 'Nora does not have enough linked physiology and sim evidence yet to grade this checkpoint window.';
}

function buildAthleteSafeSummary(status: AssessmentContextFlag['status']): string {
  switch (status) {
    case 'advantaged':
      return 'You looked to be in one of your stronger body-state windows when this checkpoint was captured.';
    case 'compromised':
      return 'You looked to be in a tougher body-state window when this checkpoint was captured.';
    case 'normal':
      return 'This checkpoint looks like it was captured in a normal body-state window for you.';
    case 'unknown':
    default:
      return 'Nora needs more linked body-state data before it can grade this checkpoint window confidently.';
  }
}

function buildCoachDetailSummary(
  snapshot: PulseCheckStateSnapshot,
  patterns: AthletePatternModel[],
  status: AssessmentContextFlag['status']
): string {
  const topPattern = patterns[0];
  const patternFragment = topPattern
    ? `${topPattern.patternFamily} (${topPattern.confidenceTier}, ${topPattern.sampleSizeDays} linked days / ${topPattern.sampleSizeSims} sims)`
    : 'no eligible personal pattern model';
  return [
    `Assessment posture: ${status}.`,
    `Snapshot readiness=${snapshot.overallReadiness}, focus=${Math.round(snapshot.stateDimensions.focusReadiness)}, fatigue=${Math.round(snapshot.stateDimensions.cognitiveFatigue)}, emotionalLoad=${Math.round(snapshot.stateDimensions.emotionalLoad)}.`,
    `Primary support: ${patternFragment}.`,
  ].join(' ');
}

function buildUnknownFlag(
  milestoneType: AssessmentFlagMilestone,
  capturedAt: number,
  options?: {
    snapshot?: PulseCheckStateSnapshot | null;
    patterns?: AthletePatternModel[];
  }
): AssessmentContextFlag {
  const snapshot = options?.snapshot ?? null;
  const patterns = options?.patterns ?? [];
  return {
    status: 'unknown',
    confidenceTier: 'degraded',
    confidenceScore: 0.2,
    supportingPatternKeys: patterns.slice(0, 3).map((pattern) => pattern.patternKey),
    supportingSignals: snapshot ? buildSupportingSignals(snapshot, patterns) : [],
    deviationSummary: buildDeviationSummary('unknown', patterns),
    captureWindowStart: capturedAt - CAPTURE_WINDOW_HALF_SPAN_MS,
    captureWindowEnd: capturedAt + CAPTURE_WINDOW_HALF_SPAN_MS,
    sourceSnapshotRevision: snapshot?.id ?? null,
    observationTimes: snapshot
      ? {
          physiologyObservedAt: snapshot.updatedAt,
          joinedAt: Date.now(),
        }
      : undefined,
    athleteSafeSummary: buildAthleteSafeSummary('unknown'),
    coachDetailSummary: snapshot
      ? buildCoachDetailSummary(snapshot, patterns, 'unknown')
      : 'Assessment posture: unknown. No aligned state snapshot was available for this milestone capture.',
    milestoneType,
    engineVersion: ENGINE_VERSION,
    generatedAt: Date.now(),
  };
}

export const correlationAssessmentContextService = {
  buildUnknownFlag,

  async buildForMilestone(input: {
    athleteId: string;
    milestoneType: AssessmentFlagMilestone;
    capturedAt: number;
  }): Promise<AssessmentContextFlag> {
    const snapshot = await stateSnapshotService.getClosestForAthleteAtOrBefore(input.athleteId, input.capturedAt);
    const patternSnap = await getDocs(
      query(
        correlationEngineService.patternCollectionRef(input.athleteId),
        orderBy('updatedAt', 'desc'),
        limit(24)
      )
    );
    const patterns = sortPatterns(
      patternSnap.docs.map((entry) => entry.data() as AthletePatternModel)
    ).filter(isEvidenceReady);

    if (!snapshot) {
      return buildUnknownFlag(input.milestoneType, input.capturedAt, { patterns });
    }

    const prioritizedPatterns = sortPatterns(
      patterns.filter((pattern, index, list) => list.findIndex((candidate) => candidate.patternKey === pattern.patternKey) === index)
    );

    const status = deriveAssessmentStatus(snapshot, prioritizedPatterns);
    const confidenceTier = deriveConfidenceTier(snapshot, prioritizedPatterns, status);
    const confidenceScore = deriveConfidenceScore(snapshot, prioritizedPatterns, confidenceTier);

    return {
      status,
      confidenceTier,
      confidenceScore,
      supportingPatternKeys: prioritizedPatterns.slice(0, 3).map((pattern) => pattern.patternKey),
      supportingSignals: buildSupportingSignals(snapshot, prioritizedPatterns),
      deviationSummary: buildDeviationSummary(status, prioritizedPatterns),
      captureWindowStart: input.capturedAt - CAPTURE_WINDOW_HALF_SPAN_MS,
      captureWindowEnd: input.capturedAt + CAPTURE_WINDOW_HALF_SPAN_MS,
      sourceSnapshotRevision: snapshot.id,
      observationTimes: {
        physiologyObservedAt: snapshot.updatedAt,
        joinedAt: Date.now(),
      },
      athleteSafeSummary: buildAthleteSafeSummary(status),
      coachDetailSummary: buildCoachDetailSummary(snapshot, prioritizedPatterns, status),
      milestoneType: input.milestoneType,
      engineVersion: ENGINE_VERSION,
      generatedAt: Date.now(),
    };
  },
};
