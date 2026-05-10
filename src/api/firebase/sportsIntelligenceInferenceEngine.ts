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
import { validateNoraVoiceRubric } from './noraVoiceRubric';

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
  actionType: 'load' | 'protocol' | 'communication' | 'composure' | 'monitor' | 'mental_support';
  recommendationStrength: 'low' | 'medium' | 'high';
  sportModifiers: string[];
  contraindications: string[];
  evidenceRefs: InterpretationEvidenceRef[];
  /** Plain-English internal action for the reviewer (will be translated to coach voice by the generator). */
  reviewerAction: string;
}

/**
 * Circadian / travel disruption inference. Surfaces the athlete's current
 * circadian state by combining three universal HCSR signals (any wearable
 * adapter that provides them): sleep-midpoint shift vs 7-day baseline,
 * daytime autonomic load minutes, and overnight body-temperature deviation.
 *
 * This is one of the inputs the inference engine emits to the coach surface
 * and to Nora's translation service. Athletes never see the raw values —
 * the Athlete Surface Doctrine translates `disruptionBand` to a protocol
 * recommendation (hydrate, sunlight at arrival, lighter intensity, etc.).
 */
export interface CircadianDisruptionInterpretation {
  athleteUserId: string;
  dayKey: string;
  disruptionBand: 'settled' | 'mild_shift' | 'travel_signature' | 'jetlag_significant';
  sleepMidpointShiftMinutes?: number;
  daytimeAutonomicLoadMinutes?: number;
  temperatureDeviationC?: number;
  /** Domains that contributed evidence (subset of: ['sleep_timing', 'autonomic_load', 'temperature']). */
  contributingSignals: Array<'sleep_timing' | 'autonomic_load' | 'temperature'>;
  confidenceTier: DataConfidence;
  evidence: InterpretationEvidenceRef[];
  reviewerNote: string;
}

export interface InferenceResult {
  readiness: AthleteReadinessInterpretation;
  trainingLoad: TrainingLoadInterpretation;
  cognitiveMovement: CognitiveMovementInterpretation;
  circadianDisruption: CircadianDisruptionInterpretation;
  recommendations: SportsRecommendation[];
}

export type SportsCandidateReadType =
  | 'readiness_status'
  | 'recovery_limiter'
  | 'load_spike'
  | 'load_recovery_match'
  | 'intent_mismatch'
  | 'game_day_prep'
  | 'cognitive_movement'
  | 'fueling_context'
  | 'session_confirmation_needed'
  | 'data_quality'
  | 'no_intervention';

export interface SportsFactLedger {
  version: 'sports-intelligence-reasoning-v0.3';
  athleteContext: {
    athleteUserId: string;
    sportId: string;
    sportName: string;
    dayKey: string;
  };
  sourceFreshness: Partial<Record<DomainKey, FreshnessTier>>;
  recoveryFacts: AthleteReadinessInterpretation;
  loadFacts: TrainingLoadInterpretation;
  cognitiveFacts: CognitiveMovementInterpretation;
  circadianFacts: CircadianDisruptionInterpretation;
  recommendations: SportsRecommendation[];
  allowedClaims: string[];
  blockedClaims: string[];
  missingInputs: string[];
  evidenceRefs: InterpretationEvidenceRef[];
  confidenceTier: DataConfidence;
}

export interface SportsCandidateRead {
  id: string;
  type: SportsCandidateReadType;
  fact: string;
  interpretation: string;
  recommendedAction: string;
  confidence: DataConfidence;
  score: number;
  scoreBreakdown: string[];
  guardrails: string[];
}

export interface SportsReasoningTrace {
  ledgerVersion: SportsFactLedger['version'];
  selectedCandidateId: string;
  rejectedCandidateIds: string[];
  rubricResults: string[];
  guardrailResults: string[];
  unsupportedClaims: string[];
  finalStatus: 'approved' | 'repaired' | 'held_for_review' | 'blocked';
}

export interface ValidatedSportsIntelligencePayload {
  insightId: string;
  athleteId: string;
  dayKey: string;
  audience: 'athlete' | 'coach' | 'reviewer';
  layerVersion: SportsFactLedger['version'];
  ledger: SportsFactLedger;
  candidates: SportsCandidateRead[];
  selectedCandidate: SportsCandidateRead;
  copy: {
    headline: string;
    fact: string;
    interpretation: string;
    action: string;
    confidenceNote?: string;
  };
  validation: SportsReasoningTrace;
  provenance: {
    evidenceRefs: string[];
    generatedAt: number;
    sourceSnapshotIds: string[];
  };
}

export interface SportsReasoningLayerInput extends InferenceEngineInput {
  audience?: ValidatedSportsIntelligencePayload['audience'];
  inference?: InferenceResult;
  generatedAt?: number;
  sourceSnapshotIds?: string[];
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
      reviewerAction: 'Flag as a mind-body support pattern: ask the athlete what cue helps them stay patient when the week feels heavy.',
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
      reviewerAction: 'Surface as one-to-watch in the weekly note with a focus cue, not a workout change.',
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
      reviewerAction: 'Five-minute check-in before the next team touchpoint; ask what helps them stay composed when energy is lower.',
    });
  }

  // Cognitive movement recommendations (held as monitor until Correlation Engine wires sim data)
  if (cognitive.confidenceTier !== 'degraded' && cognitive.confidenceTier !== 'directional') {
    // No-op for v1; Correlation Engine will add specific cognitive movement actions later.
  }

  return recs;
};

// ──────────────────────────────────────────────────────────────────────────────
// Circadian / travel disruption builder.
//
// Worst-of confidence across present signals; absent signals don't
// degrade confidence (they just reduce evidence count). Bands:
//
//   |shift|   |autonomicLoad|   |tempDev|       → band
//   < 30min   < 90min           < 0.2°C/0.36°F  → settled
//   30–60     90–180            0.2–0.3         → mild_shift
//   60–180    180–360           0.3–0.5         → travel_signature
//   > 180     > 360             > 0.5           → jetlag_significant
//
// Worst-of across the contributing signals wins (one strong tell escalates
// the band; the others can't pull it back down).
// ──────────────────────────────────────────────────────────────────────────────

const CELSIUS_PER_FAHRENHEIT = 5 / 9;

const classifyShiftBand = (
  shiftMin: number | undefined,
): 'settled' | 'mild_shift' | 'travel_signature' | 'jetlag_significant' | undefined => {
  if (shiftMin === undefined) return undefined;
  const abs = Math.abs(shiftMin);
  if (abs < 30) return 'settled';
  if (abs < 60) return 'mild_shift';
  if (abs < 180) return 'travel_signature';
  return 'jetlag_significant';
};

const classifyAutonomicBand = (
  loadMin: number | undefined,
): 'settled' | 'mild_shift' | 'travel_signature' | 'jetlag_significant' | undefined => {
  if (loadMin === undefined) return undefined;
  if (loadMin < 90) return 'settled';
  if (loadMin < 180) return 'mild_shift';
  if (loadMin < 360) return 'travel_signature';
  return 'jetlag_significant';
};

const classifyTemperatureBand = (
  tempDevC: number | undefined,
): 'settled' | 'mild_shift' | 'travel_signature' | 'jetlag_significant' | undefined => {
  if (tempDevC === undefined) return undefined;
  const abs = Math.abs(tempDevC);
  if (abs < 0.2) return 'settled';
  if (abs < 0.3) return 'mild_shift';
  if (abs < 0.5) return 'travel_signature';
  return 'jetlag_significant';
};

const BAND_RANK: Record<'settled' | 'mild_shift' | 'travel_signature' | 'jetlag_significant', number> = {
  settled: 0,
  mild_shift: 1,
  travel_signature: 2,
  jetlag_significant: 3,
};

const buildCircadianDisruptionInterpretation = (
  snapshot: AthleteHealthContextSnapshot,
  _sport: PulseCheckSportConfigurationEntry,
): CircadianDisruptionInterpretation => {
  const recovery = snapshot.domains.recovery?.data as Record<string, unknown> | undefined;
  const dayKey = snapshot.snapshotDate;
  const athleteUserId = snapshot.domains.identity.data.athleteUserId;

  const shiftMin =
    typeof recovery?.sleepMidpointShiftMinutes === 'number' && Number.isFinite(recovery.sleepMidpointShiftMinutes)
      ? (recovery.sleepMidpointShiftMinutes as number)
      : undefined;
  const autonomicLoad =
    typeof recovery?.daytimeAutonomicLoadMinutes === 'number' && Number.isFinite(recovery.daytimeAutonomicLoadMinutes)
      ? (recovery.daytimeAutonomicLoadMinutes as number)
      : undefined;
  // Oura ships temperatureDeviation in Celsius; iOS HealthKit ships in Celsius.
  // If a future adapter ships Fahrenheit, normalize at the adapter boundary.
  const tempDevRaw = recovery?.temperatureDeviation;
  const tempDevC =
    typeof tempDevRaw === 'number' && Number.isFinite(tempDevRaw) ? (tempDevRaw as number) : undefined;

  const shiftBand = classifyShiftBand(shiftMin);
  const autonomicBand = classifyAutonomicBand(autonomicLoad);
  const tempBand = classifyTemperatureBand(tempDevC);

  const presentBands = [shiftBand, autonomicBand, tempBand].filter(
    (b): b is 'settled' | 'mild_shift' | 'travel_signature' | 'jetlag_significant' => Boolean(b),
  );

  const contributingSignals: Array<'sleep_timing' | 'autonomic_load' | 'temperature'> = [];
  if (shiftBand) contributingSignals.push('sleep_timing');
  if (autonomicBand) contributingSignals.push('autonomic_load');
  if (tempBand) contributingSignals.push('temperature');

  // Worst-of band determines the result.
  let disruptionBand: 'settled' | 'mild_shift' | 'travel_signature' | 'jetlag_significant' = 'settled';
  for (const band of presentBands) {
    if (BAND_RANK[band] > BAND_RANK[disruptionBand]) disruptionBand = band;
  }

  // Confidence: floor + freshness ceiling, only across present signals.
  const recoveryFreshness = snapshot.domains.recovery?.freshness;
  const recoveryConfidence = snapshot.domains.recovery?.provenance.dataConfidence;
  const baseConfidence: DataConfidence =
    presentBands.length === 0
      ? 'degraded'
      : presentBands.length === 1
        ? 'directional'
        : presentBands.length === 2
          ? 'emerging'
          : recoveryConfidence || 'stable';

  const freshnessCeiling: DataConfidence =
    recoveryFreshness === 'fresh'
      ? 'high_confidence'
      : recoveryFreshness === 'recent'
        ? 'stable'
        : recoveryFreshness === 'historical_only'
          ? 'emerging'
          : 'directional';

  const confidenceTier: DataConfidence =
    CONFIDENCE_RANK[baseConfidence] <= CONFIDENCE_RANK[freshnessCeiling] ? baseConfidence : freshnessCeiling;

  const recoverySourceFamily = snapshot.domains.recovery?.provenance.primarySource;
  const evidence: InterpretationEvidenceRef[] = [];
  if (shiftMin !== undefined) {
    evidence.push({
      domain: 'recovery',
      label: 'Sleep-midpoint shift vs 7-day baseline',
      value: `${shiftMin >= 0 ? '+' : ''}${shiftMin} min`,
      sourceFamily: recoverySourceFamily,
    });
  }
  if (autonomicLoad !== undefined) {
    evidence.push({
      domain: 'recovery',
      label: 'Daytime autonomic-load minutes',
      value: `${Math.round(autonomicLoad)} min`,
      sourceFamily: recoverySourceFamily,
    });
  }
  if (tempDevC !== undefined) {
    evidence.push({
      domain: 'recovery',
      label: 'Body temperature deviation (overnight)',
      value: `${tempDevC >= 0 ? '+' : ''}${tempDevC.toFixed(2)} °C`,
      sourceFamily: recoverySourceFamily,
    });
  }

  const reviewerNote =
    presentBands.length === 0
      ? 'No circadian/travel signals available in this snapshot. Inference suppressed; Athlete Surface should not display a circadian protocol.'
      : disruptionBand === 'settled'
        ? 'Circadian state is settled. No travel-related load signature detected.'
        : disruptionBand === 'mild_shift'
          ? 'Mild circadian shift visible — could be local late-night, mild travel, or normal day-to-day variation.'
          : disruptionBand === 'travel_signature'
            ? 'Travel-style load signature visible. Multiple markers suggest sympathetic activation + circadian disruption.'
            : 'Significant jetlag/travel disruption signature. Worst-case band on at least one input.';

  return {
    athleteUserId,
    dayKey,
    disruptionBand,
    sleepMidpointShiftMinutes: shiftMin,
    daytimeAutonomicLoadMinutes: autonomicLoad,
    temperatureDeviationC: tempDevC,
    contributingSignals,
    confidenceTier,
    evidence,
    reviewerNote,
  };
};

// ──────────────────────────────────────────────────────────────────────────────
// Sports Intelligence Reasoning Layer v0.3
// ──────────────────────────────────────────────────────────────────────────────

const SPORTS_REASONING_VERSION: SportsFactLedger['version'] = 'sports-intelligence-reasoning-v0.3';

const SPORTS_REASONING_DOMAIN_KEYS: DomainKey[] = [
  'identity',
  'training',
  'recovery',
  'activity',
  'nutrition',
  'biometrics',
  'behavioral',
  'summary',
];

const UNSUPPORTED_SPORTS_CLAIM_PATTERNS: Array<{ pattern: RegExp; message: string }> = [
  {
    pattern: /\bcns\b.*\bhot\b|\bcns is hot\b/i,
    message: 'unsupported physiology claim: CNS state cannot be inferred from the available ledger',
  },
  {
    pattern: /\bpull session\b|\byesterday'?s pull\b/i,
    message: 'unsupported session claim: the ledger does not name a pull session',
  },
  {
    pattern: /\brespiratory rate suggests\b/i,
    message: 'unsupported respiratory-rate causality without a baseline and trend',
  },
  {
    pattern: /\bautonomic balance is excellent\b|\bparasympathetic tone\b/i,
    message: 'unsupported autonomic interpretation beyond the available facts',
  },
  {
    pattern: /\ball systems green\b|\bno limits\b/i,
    message: 'overconfident clearance language is not allowed',
  },
  {
    pattern: /\baerobic system is loaded\b/i,
    message: 'unsupported system-level training claim',
  },
];

const uniqueStrings = (items: Array<string | undefined | null>): string[] =>
  Array.from(new Set(items.map((item) => String(item || '').trim()).filter(Boolean)));

const formatBand = (value: string): string => value.replace(/_/g, ' ');

const confidenceWeight = (tier: DataConfidence): number => CONFIDENCE_RANK[tier] ?? 0;

const evidenceLabel = (ref: InterpretationEvidenceRef): string => {
  const value = ref.value === undefined ? '' : `: ${String(ref.value)}`;
  const source = ref.sourceFamily ? ` (${ref.sourceFamily})` : '';
  return `${ref.domain} / ${ref.label}${value}${source}`;
};

const evidenceShortValue = (
  refs: InterpretationEvidenceRef[],
  matcher: RegExp,
): string | undefined => {
  const match = refs.find((ref) => matcher.test(ref.label));
  if (!match || match.value === undefined) return undefined;
  return String(match.value);
};

const buildSportsFactLedger = (
  input: InferenceEngineInput,
  inference: InferenceResult,
): SportsFactLedger => {
  const domainBlocks = input.snapshot.domains as Partial<Record<DomainKey, { freshness?: FreshnessTier }>>;
  const sourceFreshness: Partial<Record<DomainKey, FreshnessTier>> = {};
  for (const domain of SPORTS_REASONING_DOMAIN_KEYS) {
    const freshness = domainBlocks[domain]?.freshness || input.snapshot.freshness.perDomain[domain];
    if (freshness) sourceFreshness[domain] = freshness;
  }

  const evidenceRefs = [
    ...inference.readiness.evidence,
    ...inference.trainingLoad.evidence,
    ...inference.cognitiveMovement.evidence,
    ...inference.circadianDisruption.evidence,
    ...inference.recommendations.flatMap((rec) => rec.evidenceRefs),
  ];

  const missingInputs = uniqueStrings([
    ...inference.readiness.missingInputs.map((m) => `${m.domain}: ${m.reason}`),
    ...inference.trainingLoad.missingInputs.map((m) => `${m.domain}: ${m.reason}`),
    ...(input.snapshot.audit?.missingDomains || []).map((domain) => `${domain}: marked missing by snapshot audit.`),
  ]);

  const confidenceInputs = [
    inference.readiness.confidenceTier,
    inference.trainingLoad.confidenceTier,
    ...(inference.cognitiveMovement.evidence.length > 0 ? [inference.cognitiveMovement.confidenceTier] : []),
    ...(inference.circadianDisruption.evidence.length > 0 ? [inference.circadianDisruption.confidenceTier] : []),
  ];
  const confidenceTier = confidenceInputs.reduce((acc, next) => minConfidence(acc, next), 'high_confidence' as DataConfidence);

  return {
    version: SPORTS_REASONING_VERSION,
    athleteContext: {
      athleteUserId: input.snapshot.athleteUserId,
      sportId: input.sport.id,
      sportName: input.sport.name,
      dayKey: input.snapshot.snapshotDate,
    },
    sourceFreshness,
    recoveryFacts: inference.readiness,
    loadFacts: inference.trainingLoad,
    cognitiveFacts: inference.cognitiveMovement,
    circadianFacts: inference.circadianDisruption,
    recommendations: inference.recommendations,
    allowedClaims: uniqueStrings([
      `Readiness band is ${formatBand(inference.readiness.readinessBand)}.`,
      `Training load band is ${formatBand(inference.trainingLoad.loadBand)}.`,
      `Circadian disruption band is ${formatBand(inference.circadianDisruption.disruptionBand)}.`,
      inference.trainingLoad.acwr !== undefined
        ? `ACWR is ${Number(inference.trainingLoad.acwr.toFixed(2))}.`
        : undefined,
      evidenceShortValue(inference.readiness.evidence, /readinessScore|recoveryScore/i)
        ? `Recovery/readiness score is ${evidenceShortValue(inference.readiness.evidence, /readinessScore|recoveryScore/i)}.`
        : undefined,
      evidenceShortValue(inference.readiness.evidence, /sleepEfficiency/i)
        ? `Sleep efficiency is ${evidenceShortValue(inference.readiness.evidence, /sleepEfficiency/i)}.`
        : undefined,
    ]),
    blockedClaims: [
      'Do not infer CNS state from HRV, sleep, or readiness alone.',
      'Do not name a workout/session unless the ledger names it.',
      'Do not make respiratory-rate causal claims without baseline and trend.',
      'Do not clear intensity with "all systems green" language.',
      'Do not use clinical diagnosis or treatment language.',
    ],
    missingInputs,
    evidenceRefs,
    confidenceTier,
  };
};

const makeCandidate = (
  ledger: SportsFactLedger,
  type: SportsCandidateReadType,
  fact: string,
  interpretation: string,
  recommendedAction: string,
  confidence: DataConfidence,
  baseScore: number,
  scoreBreakdown: string[],
  guardrails: string[] = [],
): SportsCandidateRead => {
  const score = baseScore + confidenceWeight(confidence) * 4 - guardrails.length * 8;
  return {
    id: `${ledger.athleteContext.athleteUserId}_${ledger.athleteContext.dayKey}_${type}`,
    type,
    fact,
    interpretation,
    recommendedAction,
    confidence,
    score,
    scoreBreakdown: [
      ...scoreBreakdown,
      `confidence weight: ${confidence}`,
      guardrails.length ? `guardrail penalty: ${guardrails.length}` : 'guardrail penalty: none',
    ],
    guardrails,
  };
};

const generateSportsCandidateReads = (ledger: SportsFactLedger): SportsCandidateRead[] => {
  const readiness = ledger.recoveryFacts;
  const load = ledger.loadFacts;
  const circadian = ledger.circadianFacts;
  const candidates: SportsCandidateRead[] = [];
  const readinessScore = evidenceShortValue(readiness.evidence, /readinessScore|recoveryScore/i);
  const sleepEfficiency = evidenceShortValue(readiness.evidence, /sleepEfficiency/i);
  const acwr = load.acwr !== undefined ? Number(load.acwr.toFixed(2)) : undefined;
  const thinData = ledger.confidenceTier === 'degraded' || ledger.missingInputs.length >= 3;
  const trainingContextMissing =
    load.missingInputs.length > 0
    || ledger.sourceFreshness.training === 'missing'
    || ledger.sourceFreshness.training === 'stale';

  if (thinData) {
    candidates.push(makeCandidate(
      ledger,
      'data_quality',
      `The ${ledger.athleteContext.sportName} data is missing key pieces: ${ledger.missingInputs.slice(0, 2).join(' ') || 'key data is missing.'}`,
      'That makes this a light body-state read, not a full pattern.',
      'Use the reliable mental rep today: complete the Nora session and name one cue for staying focused.',
      ledger.confidenceTier === 'degraded' ? 'degraded' : 'directional',
      84,
      ['thin-data gate activated'],
      ['hold high-confidence claims'],
    ));
  }

  if (trainingContextMissing) {
    const metricText = readinessScore ? ` Readiness score is ${readinessScore}.` : '';
    candidates.push(makeCandidate(
      ledger,
      'session_confirmation_needed',
      `Recent activity context is incomplete for ${ledger.athleteContext.sportName}.${metricText}`,
      'I should not judge workload from an incomplete activity picture.',
      'Treat this as a mindset check: complete the Nora session and notice where focus feels easy or harder today.',
      load.confidenceTier,
      readiness.readinessBand === 'on_plan' ? 88 : 72,
      ['training freshness/session-context gate activated'],
      ['no invented session names'],
    ));
  }

  if (readiness.readinessBand === 'concerning' || readiness.readinessBand === 'one_to_watch') {
    const metricText = readinessScore ? ` with score ${readinessScore}` : '';
    candidates.push(makeCandidate(
      ledger,
      'recovery_limiter',
      `Readiness is ${formatBand(readiness.readinessBand)}${metricText}.`,
      'That does not make today a bad day; it makes today a composure opportunity.',
      'Pick one cue before pressure shows up: calm, patient, or next play. Use it when the body feels flat.',
      readiness.confidenceTier,
      readiness.readinessBand === 'concerning' ? 88 : 78,
      [`readiness band: ${readiness.readinessBand}`],
      readiness.evidence.length === 0 ? ['missing readiness evidence'] : [],
    ));
  }

  if (load.loadBand === 'concerning' || load.loadBand === 'high') {
    candidates.push(makeCandidate(
      ledger,
      'load_spike',
      `Training load is ${formatBand(load.loadBand)}${acwr !== undefined ? ` with ACWR ${acwr}` : ''}.`,
      'Heavy weeks can make focus, patience, and emotional control harder.',
      'Use this as a mental rep: choose one reset cue before the day starts and use it the first time frustration shows up.',
      load.confidenceTier,
      load.loadBand === 'concerning' ? 86 : 74,
      [`load band: ${load.loadBand}`],
      load.evidence.length === 0 ? ['missing load evidence'] : [],
    ));
  }

  if (
    (readiness.readinessBand === 'fresh' || readiness.readinessBand === 'on_plan')
    && (load.loadBand === 'moderate' || load.loadBand === 'low')
    && !thinData
  ) {
    const sleepText = sleepEfficiency ? ` Sleep efficiency is ${sleepEfficiency}.` : '';
    candidates.push(makeCandidate(
      ledger,
      'readiness_status',
      `Readiness is ${formatBand(readiness.readinessBand)} and load is ${formatBand(load.loadBand)}.${sleepText}`,
      'The athlete is creating a cleaner environment for focus, learning, and composure.',
      'Reward the pattern: complete the Nora session, protect the same routine tonight, and rate your focus after the first five minutes of work.',
      minConfidence(readiness.confidenceTier, load.confidenceTier),
      trainingContextMissing ? 54 : 76,
      ['readiness/load match gate activated'],
      trainingContextMissing ? ['session context missing'] : [],
    ));
  }

  if (
    circadian.disruptionBand === 'travel_signature'
    || circadian.disruptionBand === 'jetlag_significant'
  ) {
    candidates.push(makeCandidate(
      ledger,
      'recovery_limiter',
      `Circadian disruption is ${formatBand(circadian.disruptionBand)}.`,
      'Sleep timing can make attention and patience feel more expensive.',
      'Make the mental setup simple: get light early, hydrate, and use one 6-second exhale before your first class, lift, or practice task.',
      circadian.confidenceTier,
      circadian.disruptionBand === 'jetlag_significant' ? 82 : 70,
      [`circadian band: ${circadian.disruptionBand}`],
      circadian.evidence.length < 2 ? ['limited circadian evidence'] : [],
    ));
  }

  if (
    ledger.recommendations.length === 0
    && !thinData
    && candidates.length === 0
  ) {
    candidates.push(makeCandidate(
      ledger,
      'no_intervention',
      `Readiness is ${formatBand(readiness.readinessBand)} and load is ${formatBand(load.loadBand)}.`,
      'Nothing extreme is showing up, and average days still build identity.',
      'Complete the mental rep, keep the routine clean, and let consistency do its quiet work.',
      ledger.confidenceTier,
      62,
      ['no threshold crossed'],
    ));
  }

  return candidates.sort((a, b) => b.score - a.score);
};

const candidateText = (candidate: SportsCandidateRead): string =>
  `${candidate.fact} ${candidate.interpretation} ${candidate.recommendedAction}`;

const scanUnsupportedSportsClaims = (text: string): string[] =>
  uniqueStrings(
    UNSUPPORTED_SPORTS_CLAIM_PATTERNS
      .filter((entry) => entry.pattern.test(text))
      .map((entry) => entry.message),
  );

const evaluateSportsGuardrails = (
  candidate: SportsCandidateRead,
  ledger: SportsFactLedger,
): string[] => {
  const issues: string[] = [];

  if (
    confidenceWeight(candidate.confidence) >= confidenceWeight('stable')
    && candidate.guardrails.some((entry) => /limited|missing|thin|hold/i.test(entry))
  ) {
    issues.push('candidate claims stable confidence while its own guardrail marks evidence as limited');
  }

  if (
    ledger.missingInputs.length >= 3
    && !['data_quality', 'session_confirmation_needed'].includes(candidate.type)
  ) {
    issues.push('missing-input gate requires a data-quality or session-confirmation read first');
  }

  if (
    candidate.type !== 'data_quality'
    && candidate.type !== 'session_confirmation_needed'
    && candidate.type !== 'no_intervention'
    && candidate.confidence === 'degraded'
  ) {
    issues.push('degraded confidence cannot drive a prescriptive athlete or coach read');
  }

  return uniqueStrings(issues);
};

const validateSportsCandidate = (
  candidate: SportsCandidateRead,
  ledger: SportsFactLedger,
): Pick<SportsReasoningTrace, 'rubricResults' | 'guardrailResults' | 'unsupportedClaims'> => {
  const text = candidateText(candidate);
  const rubricResults = validateNoraVoiceRubric(text).map((result) => result.message);
  const unsupportedClaims = scanUnsupportedSportsClaims(text);
  const guardrailResults = evaluateSportsGuardrails(candidate, ledger);

  return {
    rubricResults,
    guardrailResults,
    unsupportedClaims,
  };
};

const buildFallbackCandidate = (ledger: SportsFactLedger): SportsCandidateRead =>
  makeCandidate(
    ledger,
    'data_quality',
    `The ${ledger.athleteContext.sportName} read needs more evidence before a strong recommendation.`,
    'The safest supported insight is that the body-state picture is incomplete.',
    'Ask for a quick self-report or wearable sync, then keep the guidance focused on the mental rep.',
    'degraded',
    92,
    ['fallback candidate used after validation blocked stronger reads'],
    ['hold for reviewer if data remains missing'],
  );

const selectValidatedCandidate = (
  ledger: SportsFactLedger,
  candidates: SportsCandidateRead[],
): {
  selectedCandidate: SportsCandidateRead;
  rejectedCandidateIds: string[];
  validation: Pick<SportsReasoningTrace, 'rubricResults' | 'guardrailResults' | 'unsupportedClaims'>;
  finalStatus: SportsReasoningTrace['finalStatus'];
} => {
  const usableCandidates = candidates.length > 0 ? candidates : [buildFallbackCandidate(ledger)];
  const rejectedCandidateIds: string[] = [];

  for (const candidate of usableCandidates) {
    const validation = validateSportsCandidate(candidate, ledger);
    const issueCount =
      validation.rubricResults.length + validation.guardrailResults.length + validation.unsupportedClaims.length;
    if (issueCount === 0) {
      return {
        selectedCandidate: candidate,
        rejectedCandidateIds,
        validation,
        finalStatus: rejectedCandidateIds.length > 0 ? 'repaired' : 'approved',
      };
    }
    rejectedCandidateIds.push(candidate.id);
  }

  const fallback = buildFallbackCandidate(ledger);
  const fallbackValidation = validateSportsCandidate(fallback, ledger);
  return {
    selectedCandidate: fallback,
    rejectedCandidateIds,
    validation: fallbackValidation,
    finalStatus:
      fallbackValidation.rubricResults.length
        + fallbackValidation.guardrailResults.length
        + fallbackValidation.unsupportedClaims.length
        > 0
        ? 'held_for_review'
        : 'repaired',
  };
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
  const circadianDisruption = buildCircadianDisruptionInterpretation(input.snapshot, input.sport);
  const recommendations = buildRecommendations(readiness, trainingLoad, cognitiveMovement, input.sport);
  return { readiness, trainingLoad, cognitiveMovement, circadianDisruption, recommendations };
};

export const runSportsIntelligenceReasoningLayer = (
  input: SportsReasoningLayerInput,
): ValidatedSportsIntelligencePayload => {
  const inference = input.inference || runSportsIntelligenceInference(input);
  const ledger = buildSportsFactLedger(input, inference);
  const candidates = generateSportsCandidateReads(ledger);
  const selection = selectValidatedCandidate(ledger, candidates);
  const selectedCandidate = selection.selectedCandidate;
  const generatedAt = input.generatedAt || Date.now();

  return {
    insightId: `${ledger.athleteContext.athleteUserId}_${ledger.athleteContext.dayKey}_${selectedCandidate.type}`,
    athleteId: ledger.athleteContext.athleteUserId,
    dayKey: ledger.athleteContext.dayKey,
    audience: input.audience || 'reviewer',
    layerVersion: ledger.version,
    ledger,
    candidates,
    selectedCandidate,
    copy: {
      headline: formatBand(selectedCandidate.type),
      fact: selectedCandidate.fact,
      interpretation: selectedCandidate.interpretation,
      action: selectedCandidate.recommendedAction,
      confidenceNote:
        selectedCandidate.confidence === 'stable' || selectedCandidate.confidence === 'high_confidence'
          ? undefined
          : `Confidence: ${selectedCandidate.confidence}.`,
    },
    validation: {
      ledgerVersion: ledger.version,
      selectedCandidateId: selectedCandidate.id,
      rejectedCandidateIds: selection.rejectedCandidateIds,
      rubricResults: selection.validation.rubricResults,
      guardrailResults: selection.validation.guardrailResults,
      unsupportedClaims: selection.validation.unsupportedClaims,
      finalStatus: selection.finalStatus,
    },
    provenance: {
      evidenceRefs: uniqueStrings(ledger.evidenceRefs.map(evidenceLabel)),
      generatedAt,
      sourceSnapshotIds: input.sourceSnapshotIds || [input.snapshot.snapshotId],
    },
  };
};

export const sportsIntelligenceInferenceEngine = {
  run: runSportsIntelligenceInference,
  reason: runSportsIntelligenceReasoningLayer,
};

// Re-export the load model type so callers don't need a second import.
export type { PulseCheckSportLoadModel };
