import type {
  PressureType,
  ProfileSnapshotMilestone,
  TaxonomyModifier,
  TaxonomyPillar,
  TaxonomySkill,
} from './taxonomy';

export type CorrelationConfidenceTier =
  | 'directional'
  | 'emerging'
  | 'stable'
  | 'high_confidence'
  | 'degraded';

export type CorrelationFreshnessTier = 'fresh' | 'aging' | 'stale' | 'expired';

export type CorrelationRecommendationEligibility =
  | 'not_eligible'
  | 'monitor_only'
  | 'athlete_safe'
  | 'coach_ready'
  | 'runtime_ready';

export type CorrelationSourceFamily =
  | 'oura'
  | 'healthkit'
  | 'apple_watch'
  | 'garmin'
  | 'whoop'
  | 'fitwithpulse'
  | 'pulsecheck'
  | 'manual';

export type CorrelationConsumer =
  | 'profile'
  | 'nora'
  | 'coach'
  | 'protocol_planner'
  | 'ops'
  | 'research';

export type CorrelationPatternFamily =
  | 'sleep_duration_to_decision_quality'
  | 'sleep_duration_to_focus_stability'
  | 'deep_sleep_to_reset_speed'
  | 'hrv_to_focus_stability'
  | 'hrv_to_composure'
  | 'recovery_posture_to_consistency'
  | 'sleep_timing_to_best_performance_window'
  | 'protocol_responsiveness_by_body_state';

export type CorrelationAlignmentType =
  | 'same_day'
  | 'overnight_to_next_session'
  | 'windowed_backfill'
  | 'manual_alignment';

export type CorrelationTargetDomain =
  | TaxonomyPillar
  | TaxonomySkill
  | TaxonomyModifier
  | 'decision_quality'
  | 'focus_stability'
  | 'reset_speed'
  | 'consistency'
  | 'pressure_response'
  | 'best_training_window'
  | 'volatility'
  | 'composure';

export type AssessmentContextStatus = 'advantaged' | 'normal' | 'compromised' | 'unknown';

export type AssessmentFlagMilestone = Extract<
  ProfileSnapshotMilestone,
  'baseline' | 'midpoint' | 'endpoint' | 'retention' | 'manual_staff_checkpoint'
>;

export interface CorrelationObservationTimes {
  physiologyObservedAt?: number | null;
  physiologyPublishedAt?: number | null;
  simObservedAt?: number | null;
  joinedAt?: number | null;
}

export interface CorrelationEngineTraceMetadata {
  traceId: string;
  operation: 'evidence_write' | 'pattern_recompute' | 'projection_generate' | 'assessment_flag_write';
  actorType: 'system' | 'ops' | 'research' | 'manual' | 'backfill';
  actorId?: string | null;
  trigger: 'event_driven' | 'scheduled_job' | 'manual_recompute' | 'backfill' | 'correction';
  requestId?: string | null;
  sourceRevisionIds?: string[];
  createdAt: number;
}

export interface CorrelationThresholdWindow {
  min?: number | null;
  max?: number | null;
  unit: string;
  label?: string;
}

export interface CorrelationEvidencePhysiologyBlock {
  sourceFamily: CorrelationSourceFamily;
  sourceType: string;
  sleep?: Record<string, number | string | boolean | null>;
  recovery?: Record<string, number | string | boolean | null>;
  activityLoad?: Record<string, number | string | boolean | null>;
  stressPosture?: Record<string, number | string | boolean | null>;
  freshness: CorrelationFreshnessTier;
  observationTimes?: CorrelationObservationTimes;
}

export interface CorrelationEvidenceSimBlock {
  simSessionId: string;
  simFamily?: string | null;
  simVariant?: string | null;
  coreMetricName?: string | null;
  skillDomain?: TaxonomySkill | null;
  pillarDomain?: TaxonomyPillar | null;
  scores: Record<string, number | string | null>;
  completionQuality?: 'high' | 'medium' | 'low' | 'excluded';
  sessionTimestamp: number;
}

export interface CorrelationEvidenceAlignmentBlock {
  alignmentType: CorrelationAlignmentType;
  timeDeltaMinutes: number;
  windowRule: string;
  sameDayValidity: boolean;
  joinedBy: 'engine' | 'backfill' | 'manual';
}

export interface CorrelationEvidenceQualityBlock {
  dataConfidence: CorrelationConfidenceTier;
  varietyTags: string[];
  missingSignals: string[];
  qualityFlags: string[];
  exclusionReason?: string | null;
}

export interface CorrelationEvidenceLineageBlock {
  healthSnapshotRevision?: string | null;
  sourceRecordRefs: string[];
  trialOrAssignmentRefs: string[];
  writeReason: 'initial_join' | 'backfill' | 'correction' | 'recompute';
}

export interface CorrelationEvidenceRecord {
  evidenceId: string;
  athleteId: string;
  athleteLocalDate: string;
  sourceWindowStart: number;
  sourceWindowEnd: number;
  engineVersion: string;
  physiology: CorrelationEvidencePhysiologyBlock;
  simOutcome: CorrelationEvidenceSimBlock;
  alignment: CorrelationEvidenceAlignmentBlock;
  quality: CorrelationEvidenceQualityBlock;
  lineage: CorrelationEvidenceLineageBlock;
  trace: CorrelationEngineTraceMetadata;
  createdAt: number;
  updatedAt: number;
}

export interface AthletePatternModel {
  patternKey: string;
  athleteId: string;
  patternFamily: CorrelationPatternFamily;
  targetDomain: CorrelationTargetDomain;
  createdAt: number;
  lastValidatedAt: number;
  engineVersion: string;
  sampleSizeDays: number;
  sampleSizeSims: number;
  stateDiversityScore: number;
  recentContradictionRate: number;
  coverageWindowDays: number;
  observedRelationship: string;
  directionality: 'positive' | 'negative' | 'mixed' | 'contextual';
  sweetSpotRange?: CorrelationThresholdWindow | null;
  minimumFloor?: CorrelationThresholdWindow | null;
  instabilityBand?: CorrelationThresholdWindow | null;
  bestTrainingWindow?: string | null;
  confidenceTier: CorrelationConfidenceTier;
  confidenceScore: number;
  freshnessTier: CorrelationFreshnessTier;
  recommendationEligibility: CorrelationRecommendationEligibility;
  degradedReason?: string | null;
  affectedDomains: CorrelationTargetDomain[];
  supportedConsumers: CorrelationConsumer[];
  protocolLinks: string[];
  riskFlags: string[];
  athleteSummary: string;
  coachSummary: string;
  explanationTemplateIds: string[];
  lastProjectionAt?: number | null;
  revision: number;
  trace: CorrelationEngineTraceMetadata;
  updatedAt: number;
}

export interface AthletePatternModelRevision extends AthletePatternModel {
  revisionId: string;
  supersededAt: number;
  supersededByRevision: number;
  archivedAt: number;
  changeReason: 'threshold_change' | 'confidence_change' | 'backfill' | 'correction' | 'manual_override';
  previousThresholds?: Partial<Pick<AthletePatternModel, 'sweetSpotRange' | 'minimumFloor' | 'instabilityBand' | 'bestTrainingWindow'>>;
}

export interface RecommendationProjection {
  projectionKey: string;
  athleteId: string;
  consumer: CorrelationConsumer;
  projectionDate: string;
  generatedAt: number;
  expiresAt?: number | null;
  currentPhysiologyBand: string;
  currentStateSignalRefs: string[];
  currentSnapshotRevision?: string | null;
  projectionReason: string;
  summaryTitle: string;
  summaryBody: string;
  recommendedMode?: string | null;
  suggestedProtocolIds: string[];
  timingWindow?: string | null;
  warningLevel: 'none' | 'watch' | 'caution' | 'protect';
  supportingPatternKeys: string[];
  confidenceTier: CorrelationConfidenceTier;
  confidenceDisplay: string;
  evidenceSnippet?: string | null;
  sourceSummary: string;
  templateId?: string | null;
  templateVersion?: string | null;
  copyValidated: boolean;
  medicalClaimCheck: 'passed' | 'rejected' | 'not_required';
  staleAt?: number | null;
  trace: CorrelationEngineTraceMetadata;
  createdAt: number;
  updatedAt: number;
}

export interface AssessmentContextFlag {
  status: AssessmentContextStatus;
  confidenceTier: CorrelationConfidenceTier;
  confidenceScore: number;
  supportingPatternKeys: string[];
  supportingSignals: string[];
  deviationSummary: string;
  captureWindowStart: number;
  captureWindowEnd: number;
  sourceSnapshotRevision?: string | null;
  observationTimes?: CorrelationObservationTimes;
  athleteSafeSummary: string;
  coachDetailSummary: string;
  milestoneType: AssessmentFlagMilestone;
  engineVersion: string;
  generatedAt: number;
}

export interface AthletePhysiologyCognitionEngineRoot {
  athleteId: string;
  engineVersion: string;
  activePatternKeys: string[];
  activeProjectionKeys: string[];
  lastEvidenceAt?: number | null;
  lastPatternRefreshAt?: number | null;
  lastProjectionRefreshAt?: number | null;
  lastEngineRefreshAt?: number | null;
  createdAt: number;
  updatedAt: number;
}
