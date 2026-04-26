// =============================================================================
// Sports Intelligence Inference Engine — produces canonical interpretations
// from a `AthleteHealthContextSnapshot` plus the athlete's sport
// `reportPolicy`.
//
// This module implements the spec at:
//   src/components/admin/system-overview/PulseCheckSportsIntelligenceAggregationInferenceContractTab.tsx
//
// Inputs:
//   - AthleteHealthContextSnapshot (produced by the snapshot assembler)
//   - PulseCheckSportConfigurationEntry for the athlete's sport (carries
//     reportPolicy + loadModel, the sport-specific coefficients)
//
// Outputs (canonical schemas defined in the spec):
//   - AthleteReadinessInterpretation
//   - TrainingLoadInterpretation
//   - CognitiveMovementInterpretation
//   - SportsRecommendation[]
//
// What this is and isn't, as of v1:
//   - IT IS deterministic, sport-aware, athlete-relative, confidence-tiered.
//   - IT ISN'T producing coach-facing copy directly. The report generator
//     consumes these interpretations and produces coach prose using the
//     sport's `coachLanguageTranslations`.
//   - IT ISN'T a learned model. Thresholds come from the sport's loadModel
//     and from the spec's confidence ladder. Iteration with pilot evidence
//     will tighten these.
// =============================================================================

import type {
  AthleteHealthContextSnapshot,
  DataConfidence,
  DomainKey,
  FreshnessTier,
  RecoveryContext,
  TrainingContext,
  BehavioralContext,
} from './athleteContextSnapshot';
import type {
  PulseCheckSportConfigurationEntry,
  PulseCheckSportLoadModel,
} from './pulsecheckSportConfig';

// ──────────────────────────────────────────────────────────────────────────────
// Output schemas (mirror the spec's canonical names)
// ──────────────────────────────────────────────────────────────────────────────

export type ReadinessBand = 'fresh' | 'on_plan' | 'one_to_watch' | 'concerning';
export type LoadBand = 'low' | 'moderate' | 'high' | 'concerning';

export interface InterpretationEvidenceRef {
  /** Domain the signal came from. */
  domain: DomainKey;
  /** Plain-English label suitable for the reviewer technical pane (NOT for coaches). */
  label: string;
  /** Raw value if applicable; reviewers see this. */
  value?: number | string | boolean;
  /** Source family that produced this evidence (mirrors snapshot provenance). */
  sourceFamily?: string;
}

export interface MissingInputNote {
  domain: DomainKey;
  reason: string;
}

export interface AthleteReadinessInterpretation {
  athleteUserId: string;
  dayKey: string;
  readinessBand: ReadinessBand;
  evidence: InterpretationEvidenceRef[];
  confidenceTier: DataConfidence;
  missingInputs: MissingInputNote[];
  provenanceTrace: string[];
  /** Internal note for the reviewer pane — never coach-visible. */
  reviewerNote: string;
}

export interface TrainingLoadInterpretation {
  athleteUserId: string;
  windowDayKey: string;
  acuteLoad?: number;
  chronicLoad?: number;
  acwr?: number;
  loadBand: LoadBand;
  evidence: InterpretationEvidenceRef[];
  confidenceTier: DataConfidence;
  missingInputs: MissingInputNote[];
  /** Sport-specific recommendation ids drawn from the reportPolicy.coachActions. */
  recommendationIds: string[];
  reviewerNote: string;
}

export interface CognitiveMovementInterpretation {
  athleteUserId: string;
  dayKey: string;
  focusDelta?: number;
  composureDelta?: number;
  decisioningDelta?: number;
  simEvidenceCount?: number;
  confidenceTier: DataConfidence;
  evidence: InterpretationEvidenceRef[];
  reviewerNote: string;
}

export interface SportsRecommendation {
  id: string;
  /** The reportPolicy.coachActions or watchlistSignals id this maps to. */
  policyRefId?: string;
  targetAudience: 'coach' | 'pulse_review';
  actionType: 'load' | 'protocol' | 'communication' | 'composure' | 'monitor';
  recommendationStrength: 'low' | 'medium' | 'high';
  sportModifiers: string[];
  contraindications: string[];
  evidenceRefs: InterpretationEvidenceRef[];
  /** Plain-English internal action for the reviewer (will be translated to coach voice by the generator). */
  reviewerAction: string;
}

export interface InferenceResult {
  readiness: AthleteReadinessInterpretation;
  trainingLoad: TrainingLoadInterpretation;
  cognitiveMovement: CognitiveMovementInterpretation;
  recommendations: SportsRecommendation[];
}

// ──────────────────────────────────────────────────────────────────────────────
// Confidence + freshness math
// ──────────────────────────────────────────────────────────────────────────────

const CONFIDENCE_RANK: Record<DataConfidence, number> = {
  degraded: 0,
  directional: 1,
  emerging: 2,
  stable: 3,
  high_confidence: 4,
};

// Freshness sets the confidence CEILING (not floor): data that's only
// historical_only can never be `stable`, but fresh data is allowed to
// reach `high_confidence` if the adapter wrote that label.
const FRESHNESS_TO_CONFIDENCE_CEILING: Record<FreshnessTier, DataConfidence> = {
  fresh: 'high_confidence',
  recent: 'stable',
  inferred: 'emerging',
  historical_only: 'emerging',
  stale: 'directional',
  missing: 'degraded',
};

const minConfidence = (a: DataConfidence, b: DataConfidence): DataConfidence =>
  CONFIDENCE_RANK[a] <= CONFIDENCE_RANK[b] ? a : b;

const summarizeDomainConfidence = (
  snapshot: AthleteHealthContextSnapshot,
  domain: DomainKey,
): DataConfidence => {
  const block = (snapshot.domains as Record<string, unknown>)[domain] as
    | { freshness?: FreshnessTier; provenance?: { dataConfidence?: DataConfidence } }
    | undefined;
  if (!block) return 'degraded';
  const freshnessCeiling = FRESHNESS_TO_CONFIDENCE_CEILING[block.freshness || 'missing'];
  const provenanceLabel = block.provenance?.dataConfidence || 'degraded';
  // Final confidence is the lower of (freshness ceiling, what the adapter
  // claimed). Adapter can never exceed what freshness allows.
  return minConfidence(freshnessCeiling, provenanceLabel);
};

// ──────────────────────────────────────────────────────────────────────────────
// Readiness interpretation
// ──────────────────────────────────────────────────────────────────────────────

const buildReadinessInterpretation = (
  snapshot: AthleteHealthContextSnapshot,
  sport: PulseCheckSportConfigurationEntry,
): AthleteReadinessInterpretation => {
  const recovery = snapshot.domains.recovery?.data as RecoveryContext | undefined;
  const behavioral = snapshot.domains.behavioral?.data as BehavioralContext | undefined;

  const evidence: InterpretationEvidenceRef[] = [];
  const missingInputs: MissingInputNote[] = [];
  const provenanceTrace: string[] = [];

  if (!snapshot.domains.recovery) {
    missingInputs.push({ domain: 'recovery', reason: 'No recovery data for this window.' });
  } else {
    const primary = snapshot.domains.recovery.provenance.primarySource;
    if (primary) provenanceTrace.push(`recovery <- ${primary}`);
  }

  if (!snapshot.domains.behavioral) {
    missingInputs.push({ domain: 'behavioral', reason: 'No behavioral / sentiment data for this window.' });
  }

  // Score readiness — take the lowest signal (worst-of). A concerning
  // recovery score shouldn't be hidden behind an okay sleep efficiency.
  // Each signal contributes a 0-100 view; the band reflects the lowest.
  const signalScores: number[] = [];
  let inputCount = 0;

  if (recovery?.readinessScore !== undefined) {
    signalScores.push(recovery.readinessScore);
    inputCount += 1;
    evidence.push({
      domain: 'recovery',
      label: 'readinessScore (vendor-harmonized 0-100)',
      value: recovery.readinessScore,
      sourceFamily: snapshot.domains.recovery?.provenance.primarySource,
    });
  } else if (recovery?.recoveryScore !== undefined) {
    signalScores.push(recovery.recoveryScore);
    inputCount += 1;
    evidence.push({
      domain: 'recovery',
      label: 'recoveryScore (vendor-harmonized 0-100)',
      value: recovery.recoveryScore,
      sourceFamily: snapshot.domains.recovery?.provenance.primarySource,
    });
  }

  if (recovery?.sleepEfficiency !== undefined) {
    signalScores.push(recovery.sleepEfficiency * 100);
    inputCount += 1;
    evidence.push({
      domain: 'recovery',
      label: 'sleepEfficiency (0-1)',
      value: Number(recovery.sleepEfficiency.toFixed(2)),
      sourceFamily: snapshot.domains.recovery?.provenance.primarySource,
    });
  }

  const readinessScore = signalScores.length > 0 ? Math.min(...signalScores) : 70;

  if (behavioral?.subjectiveReadiness !== undefined) {
    evidence.push({
      domain: 'behavioral',
      label: 'subjectiveReadiness (1-5 or 0-100 proxy)',
      value: behavioral.subjectiveReadiness,
      sourceFamily: snapshot.domains.behavioral?.provenance.primarySource,
    });
  }

  if (behavioral?.sentimentRollingAvg !== undefined) {
    evidence.push({
      domain: 'behavioral',
      label: 'sentimentRollingAvg',
      value: Number(behavioral.sentimentRollingAvg.toFixed(2)),
    });
  }

  // Map score → band.
  let band: ReadinessBand;
  if (readinessScore >= 80) band = 'fresh';
  else if (readinessScore >= 60) band = 'on_plan';
  else if (readinessScore >= 40) band = 'one_to_watch';
  else band = 'concerning';

  // If we had no actual inputs, downgrade band toward 'one_to_watch' regardless of default.
  if (inputCount === 0) band = 'one_to_watch';

  // Confidence reflects only domains we actually consumed inputs from. A
  // missing behavioral block doesn't drag down a readiness derived from a
  // present recovery block — it just means the read is recovery-driven.
  const usedConfidences: DataConfidence[] = [];
  if (snapshot.domains.recovery) {
    usedConfidences.push(summarizeDomainConfidence(snapshot, 'recovery'));
  }
  if (behavioral?.subjectiveReadiness !== undefined || behavioral?.sentimentRollingAvg !== undefined) {
    usedConfidences.push(summarizeDomainConfidence(snapshot, 'behavioral'));
  }
  const confidenceTier =
    inputCount === 0 || usedConfidences.length === 0
      ? ('degraded' as DataConfidence)
      : usedConfidences.reduce((acc, next) => minConfidence(acc, next), usedConfidences[0]);

  const reviewerNote = buildReadinessReviewerNote({
    band,
    score: readinessScore,
    inputCount,
    confidenceTier,
    sportName: sport.name,
  });

  return {
    athleteUserId: snapshot.athleteUserId,
    dayKey: snapshot.snapshotDate,
    readinessBand: band,
    evidence,
    confidenceTier,
    missingInputs,
    provenanceTrace,
    reviewerNote,
  };
};

const buildReadinessReviewerNote = (input: {
  band: ReadinessBand;
  score: number;
  inputCount: number;
  confidenceTier: DataConfidence;
  sportName: string;
}): string => {
  if (input.inputCount === 0) {
    return `No recovery / behavioral inputs for ${input.sportName} athlete on this day. Reviewer should flag for self-report.`;
  }
  return `Readiness band "${input.band}" from composite score ${input.score.toFixed(0)} across ${input.inputCount} input(s). Confidence: ${input.confidenceTier}.`;
};

// ──────────────────────────────────────────────────────────────────────────────
// Training load interpretation
// ──────────────────────────────────────────────────────────────────────────────

const buildTrainingLoadInterpretation = (
  snapshot: AthleteHealthContextSnapshot,
  sport: PulseCheckSportConfigurationEntry,
): TrainingLoadInterpretation => {
  const training = snapshot.domains.training?.data as TrainingContext | undefined;
  const loadModel = sport.reportPolicy?.loadModel;
  const evidence: InterpretationEvidenceRef[] = [];
  const missingInputs: MissingInputNote[] = [];
  const recommendationIds: string[] = [];

  if (!snapshot.domains.training) {
    missingInputs.push({ domain: 'training', reason: 'No training data for this window.' });
  }

  const acuteLoad = training?.acuteLoad7dAU;
  const chronicLoad = training?.chronicLoad28dAU;
  let acwr = training?.acwr;
  if (acwr === undefined && acuteLoad !== undefined && chronicLoad !== undefined && chronicLoad > 0) {
    acwr = acuteLoad / chronicLoad;
  }

  if (acwr !== undefined) {
    evidence.push({
      domain: 'training',
      label: 'acwr (acute/chronic load ratio)',
      value: Number(acwr.toFixed(2)),
    });
  }
  if (training?.microcycleLoadDelta !== undefined) {
    evidence.push({
      domain: 'training',
      label: 'microcycleLoadDelta',
      value: Number(training.microcycleLoadDelta.toFixed(2)),
    });
  }
  if (training?.recentSessionRpe !== undefined) {
    evidence.push({
      domain: 'training',
      label: 'recentSessionRpe',
      value: training.recentSessionRpe,
    });
  }

  // Map ACWR + microcycle delta to band, using sport-specific ceilings when present.
  const ceiling = loadModel?.acwrCeiling ?? 1.5;
  const thresholds = loadModel?.thresholds ?? { low: 0.30, moderate: 0.60, high: 0.85, concerning: 1.05 };

  let band: LoadBand = 'moderate';
  if (acwr === undefined) {
    band = training === undefined ? 'low' : 'moderate';
  } else if (acwr >= ceiling) {
    band = 'concerning';
  } else if (acwr >= thresholds.high) {
    band = 'high';
  } else if (acwr >= thresholds.moderate) {
    band = 'moderate';
  } else {
    band = 'low';
  }

  // Micro-cycle delta amplifies the band (sustained +25% w/ degraded recovery → push toward concerning).
  if (training?.microcycleLoadDelta !== undefined && training.microcycleLoadDelta >= 0.25) {
    if (band === 'high') band = 'concerning';
    else if (band === 'moderate') band = 'high';
  }

  // Pull recommendation ids from the sport's reportPolicy when band is high or concerning.
  if (band === 'high' || band === 'concerning') {
    const coachActions = sport.reportPolicy?.coachActions || [];
    for (const action of coachActions.slice(0, 3)) {
      recommendationIds.push(action.id);
    }
  }

  const trainingConfidence = summarizeDomainConfidence(snapshot, 'training');

  const reviewerNote = (() => {
    if (training === undefined) {
      return `No training-domain data; load band defaults to "low" with degraded confidence. Sport: ${sport.name}.`;
    }
    return `Load band "${band}" from ACWR ${acwr?.toFixed(2) || 'n/a'} (sport ceiling ${ceiling.toFixed(2)}). Confidence: ${trainingConfidence}.`;
  })();

  return {
    athleteUserId: snapshot.athleteUserId,
    windowDayKey: snapshot.snapshotDate,
    acuteLoad,
    chronicLoad,
    acwr,
    loadBand: band,
    evidence,
    confidenceTier: trainingConfidence,
    missingInputs,
    recommendationIds,
    reviewerNote,
  };
};

// ──────────────────────────────────────────────────────────────────────────────
// Cognitive movement interpretation (Focus / Composure / Decisioning deltas)
// ──────────────────────────────────────────────────────────────────────────────

const buildCognitiveMovementInterpretation = (
  snapshot: AthleteHealthContextSnapshot,
  sport: PulseCheckSportConfigurationEntry,
): CognitiveMovementInterpretation => {
  const evidence: InterpretationEvidenceRef[] = [];

  // Cognitive movement comes from the Correlation Engine, which writes
  // into the snapshot's behavioral domain (or a future `cognitive` block).
  // For v1 we read from behavioral.subjectiveReadiness as a coarse proxy
  // until the Correlation Engine writes cognitive deltas directly.
  const behavioral = snapshot.domains.behavioral?.data as BehavioralContext | undefined;

  let confidenceTier = summarizeDomainConfidence(snapshot, 'behavioral');
  // Cognitive movement requires sim evidence; without it we hold to directional.
  if (CONFIDENCE_RANK[confidenceTier] > CONFIDENCE_RANK.directional) {
    confidenceTier = 'directional';
  }

  if (behavioral?.subjectiveReadiness !== undefined) {
    evidence.push({
      domain: 'behavioral',
      label: 'subjectiveReadiness (cognitive proxy until sim data is wired)',
      value: behavioral.subjectiveReadiness,
    });
  }

  const reviewerNote =
    `Cognitive movement v1 uses behavioral proxies; awaiting Correlation Engine sim deltas. Sport: ${sport.name}.`;

  return {
    athleteUserId: snapshot.athleteUserId,
    dayKey: snapshot.snapshotDate,
    focusDelta: undefined,
    composureDelta: undefined,
    decisioningDelta: undefined,
    simEvidenceCount: undefined,
    confidenceTier,
    evidence,
    reviewerNote,
  };
};

// ──────────────────────────────────────────────────────────────────────────────
// Recommendation builder
// ──────────────────────────────────────────────────────────────────────────────

const buildRecommendations = (
  readiness: AthleteReadinessInterpretation,
  trainingLoad: TrainingLoadInterpretation,
  cognitive: CognitiveMovementInterpretation,
  sport: PulseCheckSportConfigurationEntry,
): SportsRecommendation[] => {
  const recs: SportsRecommendation[] = [];

  // Load-band recommendations
  if (trainingLoad.loadBand === 'concerning') {
    recs.push({
      id: `rec_load_pullback_${trainingLoad.windowDayKey}`,
      policyRefId: trainingLoad.recommendationIds[0],
      targetAudience: trainingLoad.confidenceTier === 'high_confidence' ? 'coach' : 'pulse_review',
      actionType: 'load',
      recommendationStrength: trainingLoad.confidenceTier === 'high_confidence' ? 'high' : 'medium',
      sportModifiers: [sport.id],
      contraindications: [],
      evidenceRefs: trainingLoad.evidence,
      reviewerAction: 'Pull a rep from the next high-intensity block and verbalize-only the install.',
    });
  } else if (trainingLoad.loadBand === 'high') {
    recs.push({
      id: `rec_load_monitor_${trainingLoad.windowDayKey}`,
      policyRefId: trainingLoad.recommendationIds[0],
      targetAudience: 'pulse_review',
      actionType: 'monitor',
      recommendationStrength: 'medium',
      sportModifiers: [sport.id],
      contraindications: [],
      evidenceRefs: trainingLoad.evidence,
      reviewerAction: 'Hold today; surface as one-to-watch on the weekly note.',
    });
  }

  // Readiness-band recommendations
  if (readiness.readinessBand === 'concerning') {
    recs.push({
      id: `rec_readiness_check_${readiness.dayKey}`,
      targetAudience: 'pulse_review',
      actionType: 'communication',
      recommendationStrength: 'medium',
      sportModifiers: [sport.id],
      contraindications: ['Clinical-threshold signals route through escalation, not here.'],
      evidenceRefs: readiness.evidence,
      reviewerAction: 'Five-minute check-in before next session; coach-voice frame as role/feel, not metric.',
    });
  }

  // Cognitive movement recommendations (held as monitor until Correlation Engine wires sim data)
  if (cognitive.confidenceTier !== 'degraded' && cognitive.confidenceTier !== 'directional') {
    // No-op for v1; Correlation Engine will add specific cognitive movement actions later.
  }

  return recs;
};

// ──────────────────────────────────────────────────────────────────────────────
// Public entry
// ──────────────────────────────────────────────────────────────────────────────

export interface InferenceEngineInput {
  snapshot: AthleteHealthContextSnapshot;
  sport: PulseCheckSportConfigurationEntry;
}

export const runSportsIntelligenceInference = (input: InferenceEngineInput): InferenceResult => {
  const readiness = buildReadinessInterpretation(input.snapshot, input.sport);
  const trainingLoad = buildTrainingLoadInterpretation(input.snapshot, input.sport);
  const cognitiveMovement = buildCognitiveMovementInterpretation(input.snapshot, input.sport);
  const recommendations = buildRecommendations(readiness, trainingLoad, cognitiveMovement, input.sport);
  return { readiness, trainingLoad, cognitiveMovement, recommendations };
};

export const sportsIntelligenceInferenceEngine = {
  run: runSportsIntelligenceInference,
};

// Re-export the load model type so callers don't need a second import.
export type { PulseCheckSportLoadModel };
