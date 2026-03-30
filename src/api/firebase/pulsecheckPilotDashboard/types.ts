import type { Timestamp } from 'firebase/firestore';
import type {
  CorrelationConfidenceTier,
  CorrelationConsumer,
  CorrelationFreshnessTier,
  CorrelationPatternFamily,
  CorrelationRecommendationEligibility,
  CorrelationTargetDomain,
} from '../mentaltraining/correlationEngineTypes';
import type {
  PulseCheckOrganization,
  PulseCheckPilot,
  PulseCheckPilotCohort,
  PulseCheckPilotEnrollment,
  PulseCheckRequiredConsentDocument,
  PulseCheckTeam,
  PulseCheckTeamMembership,
} from '../pulsecheckProvisioning/types';
import type {
  PulseCheckPilotMentalPerformanceSnapshot,
  PulseCheckPilotMentalPerformanceSnapshotSet,
  PulseCheckPilotMetricRollupWindow,
  PulseCheckPilotOutcomeDashboardCardKey,
  PulseCheckPilotOutcomeMetricRollup,
  PulseCheckPilotOutcomeMetrics,
  PulseCheckPilotSurveyResponse,
  PulseCheckPilotSurveyKind,
  PulseCheckPilotTrustBatteryPayload,
  PulseCheckPilotTrustBatteryItemKey,
  PulseCheckPilotMetricEvent,
  PulseCheckPilotMetricEventType,
  PulseCheckPilotMetricEventActorRole,
  PulseCheckPilotMetricRecomputeMode,
  PulseCheckPilotHypothesisEvaluationDiagnostics,
  PulseCheckPilotOutcomeSurveyDiagnostics,
} from '../mentaltraining/pulsecheckPilotOutcomeMetrics';

export type PilotDashboardOutcomeCardKey = PulseCheckPilotOutcomeDashboardCardKey;
export type PilotDashboardOutcomeMetrics = PulseCheckPilotOutcomeMetrics;
export type PilotDashboardOutcomeMetricRollup = PulseCheckPilotOutcomeMetricRollup;
export type PilotDashboardOutcomeMetricRollupWindow = PulseCheckPilotMetricRollupWindow;
export type PulseCheckPilotOutcomeMetricRecomputeMode = PulseCheckPilotMetricRecomputeMode;
export type PilotDashboardOutcomeSurveyDiagnostics = PulseCheckPilotOutcomeSurveyDiagnostics;
export type PilotDashboardHypothesisEvaluation = PulseCheckPilotHypothesisEvaluationDiagnostics;
export type PulseCheckPilotOutcomeTrustBatteryPayload = PulseCheckPilotTrustBatteryPayload;
export type PulseCheckPilotOutcomeTrustBatteryItemKey = PulseCheckPilotTrustBatteryItemKey;
export type PulseCheckPilotOutcomeSurveyKind = PulseCheckPilotSurveyKind;
export type PulseCheckPilotOutcomeSurveyResponse = PulseCheckPilotSurveyResponse;
export type PulseCheckPilotOutcomeMetricEvent = PulseCheckPilotMetricEvent;
export type PulseCheckPilotOutcomeMetricEventType = PulseCheckPilotMetricEventType;
export type PulseCheckPilotOutcomeMetricEventActorRole = PulseCheckPilotMetricEventActorRole;
export type PulseCheckPilotMentalPerformanceSnapshotRecord = PulseCheckPilotMentalPerformanceSnapshot;
export type PulseCheckPilotMentalPerformanceSnapshotRecordSet = PulseCheckPilotMentalPerformanceSnapshotSet;

export type PilotHypothesisStatus = 'not-enough-data' | 'promising' | 'mixed' | 'not-supported';
export type PilotHypothesisConfidenceLevel = 'low' | 'medium' | 'high';
export type PilotDashboardTimeValue = number | Timestamp | null;
export type PilotResearchReadoutReviewState = 'draft' | 'reviewed' | 'approved' | 'superseded';
export type PilotResearchReadoutSectionResolution = 'accepted' | 'revised' | 'rejected' | 'carry-forward';
export type PilotResearchReadoutClaimType = 'observed' | 'inferred' | 'speculative';
export type PilotResearchReadoutBaselineMode =
  | 'within-athlete'
  | 'cross-cohort'
  | 'pre-pilot-baseline'
  | 'no-baseline';

export interface PilotResearchReadoutReadinessGateResult {
  gateKey: string;
  status: 'passed' | 'failed' | 'suppressed';
  summary: string;
}

export interface PilotResearchReadoutCitation {
  blockKey: string;
  blockLabel: string;
  hypothesisCodes: string[];
  limitationKeys: string[];
}

export interface PilotResearchReadoutClaim {
  claimKey: string;
  claimType: PilotResearchReadoutClaimType;
  statement: string;
  denominatorLabel: string;
  denominatorValue: number;
  evidenceSources: string[];
  confidenceLevel: PilotHypothesisConfidenceLevel;
  baselineMode: PilotResearchReadoutBaselineMode;
  caveatFlag: boolean;
}

export interface PilotResearchReadoutSection {
  sectionKey: 'pilot-summary' | 'hypothesis-mapper' | 'findings-interpreter' | 'research-notes' | 'limitations';
  title: string;
  readinessStatus: 'ready' | 'suppressed';
  summary: string;
  citations: PilotResearchReadoutCitation[];
  claims: PilotResearchReadoutClaim[];
  suggestedReviewerResolution?: PilotResearchReadoutSectionResolution;
  reviewerResolution?: PilotResearchReadoutSectionResolution;
  reviewerNotes?: string;
}

export interface PilotResearchReadout {
  id: string;
  pilotId: string;
  organizationId: string;
  teamId: string;
  cohortId?: string | null;
  dateWindowStart: string;
  dateWindowEnd: string;
  baselineMode: PilotResearchReadoutBaselineMode;
  reviewState: PilotResearchReadoutReviewState;
  modelVersion: string;
  promptVersion: string;
  readModelVersion: string;
  readiness: PilotResearchReadoutReadinessGateResult[];
  sections: PilotResearchReadoutSection[];
  frozenEvidenceFrame?: Record<string, any>;
  generatedAt?: Timestamp | null;
  reviewedAt?: Timestamp | null;
  reviewedByUserId?: string;
  reviewedByEmail?: string;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface PilotResearchReadoutGenerationInput {
  pilotId: string;
  cohortId?: string;
  dateWindowStart: string;
  dateWindowEnd: string;
  baselineMode: PilotResearchReadoutBaselineMode;
}

export interface PilotResearchReadoutReviewInput {
  readoutId: string;
  reviewState: PilotResearchReadoutReviewState;
  sections: Array<{
    sectionKey: PilotResearchReadoutSection['sectionKey'];
    reviewerResolution?: PilotResearchReadoutSectionResolution;
    reviewerNotes?: string;
  }>;
}

export interface PulseCheckPilotHypothesis {
  id: string;
  pilotId: string;
  code: string;
  statement: string;
  leadingIndicator: string;
  status: PilotHypothesisStatus;
  confidenceLevel: PilotHypothesisConfidenceLevel;
  keyEvidence?: string;
  notes?: string;
  lastReviewedAt?: Timestamp | null;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface PulseCheckPilotHypothesisInput {
  id?: string;
  pilotId: string;
  code: string;
  statement: string;
  leadingIndicator: string;
  status: PilotHypothesisStatus;
  confidenceLevel: PilotHypothesisConfidenceLevel;
  keyEvidence?: string;
  notes?: string;
}

export interface PilotHypothesisAssistSuggestion {
  suggestionKey: string;
  title: string;
  statement: string;
  leadingIndicator: string;
  whySuggested: string;
  confidenceLevel: PilotHypothesisConfidenceLevel;
  evidenceSignals: string[];
  caveat: string;
}

export interface PilotHypothesisAssistFrame {
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
  outcomes?: {
    enrollmentRate: number;
    adherenceRate: number;
    mentalPerformanceDelta: number;
    athleteTrust: number | null;
    athleteNps: number | null;
    coachTrust: number | null;
    coachNps: number | null;
    clinicianTrust: number | null;
    clinicianNps: number | null;
  };
  outcomeSurveyDiagnostics?: PilotDashboardOutcomeSurveyDiagnostics;
  hypothesisEvaluation?: PilotDashboardHypothesisEvaluation;
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
    status: PilotHypothesisStatus;
    confidenceLevel: PilotHypothesisConfidenceLevel;
    keyEvidence?: string;
    notes?: string;
  }>;
}

export interface PilotHypothesisAssistGenerationInput {
  pilotId: string;
  cohortId?: string;
}

export interface PilotHypothesisAssistGenerationResult {
  suggestions: PilotHypothesisAssistSuggestion[];
  modelVersion: string;
  promptVersion: string;
}

export interface PulseCheckPilotInviteConfig {
  id: string;
  pilotId: string;
  organizationId: string;
  teamId: string;
  welcomeHeadline: string;
  welcomeBody: string;
  existingAthleteInstructions: string;
  newAthleteInstructions: string;
  wearableRequirements: string;
  baselineExpectations: string;
  supportName: string;
  supportEmail: string;
  supportPhone: string;
  iosAppUrl: string;
  androidAppUrl: string;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface PulseCheckPilotInviteConfigInput {
  pilotId: string;
  organizationId: string;
  teamId: string;
  welcomeHeadline: string;
  welcomeBody: string;
  existingAthleteInstructions: string;
  newAthleteInstructions: string;
  wearableRequirements: string;
  baselineExpectations: string;
  supportName: string;
  supportEmail: string;
  supportPhone: string;
  iosAppUrl: string;
  androidAppUrl: string;
}

export interface PulseCheckPilotRequiredConsentInput {
  pilotId: string;
  requiredConsents: PulseCheckRequiredConsentDocument[];
}

export type PulseCheckPilotInviteDefaultScope = 'organization' | 'team';

export interface PulseCheckPilotInviteDefaultConfig {
  id: string;
  scopeType: PulseCheckPilotInviteDefaultScope;
  organizationId: string;
  teamId: string;
  welcomeHeadline: string;
  welcomeBody: string;
  existingAthleteInstructions: string;
  newAthleteInstructions: string;
  wearableRequirements: string;
  baselineExpectations: string;
  supportName: string;
  supportEmail: string;
  supportPhone: string;
  iosAppUrl: string;
  androidAppUrl: string;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface PulseCheckPilotInviteDefaultConfigInput {
  scopeType: PulseCheckPilotInviteDefaultScope;
  organizationId: string;
  teamId: string;
  welcomeHeadline: string;
  welcomeBody: string;
  existingAthleteInstructions: string;
  newAthleteInstructions: string;
  wearableRequirements: string;
  baselineExpectations: string;
  supportName: string;
  supportEmail: string;
  supportPhone: string;
  iosAppUrl: string;
  androidAppUrl: string;
}

export interface PilotDashboardEngineSummary {
  hasEngineRecord: boolean;
  engineVersion?: string;
  lastEvidenceAt?: PilotDashboardTimeValue;
  lastPatternRefreshAt?: PilotDashboardTimeValue;
  lastProjectionRefreshAt?: PilotDashboardTimeValue;
  lastEngineRefreshAt?: PilotDashboardTimeValue;
  activePatternKeys?: string[];
  activeProjectionKeys?: string[];
  evidenceRecordCount: number;
  patternModelCount: number;
  stablePatternCount: number;
  highConfidencePatternCount: number;
  degradedPatternCount: number;
  recommendationProjectionCount: number;
  recommendationProjectionCountsByConsumer?: Record<string, number>;
}

export interface PilotDashboardAthleteSummary {
  athleteId: string;
  displayName: string;
  email: string;
  pilotEnrollment: PulseCheckPilotEnrollment;
  teamMembership: PulseCheckTeamMembership | null;
  cohort: PulseCheckPilotCohort | null;
  engineSummary: PilotDashboardEngineSummary;
}

export interface PilotDashboardDirectoryEntry {
  organization: PulseCheckOrganization;
  team: PulseCheckTeam;
  pilot: PulseCheckPilot;
  cohorts: PulseCheckPilotCohort[];
  totalEnrollmentCount: number;
  activeEnrollmentCount: number;
  activeCohortCount: number;
  hypothesisCount: number;
  unsupportedHypothesisCount: number;
  promisingHypothesisCount: number;
  highConfidenceHypothesisCount: number;
  engineCoverageRate: number;
  stablePatternRate: number;
  avgEvidenceRecordsPerActiveAthlete: number;
  avgRecommendationProjectionsPerActiveAthlete: number;
  outcomeMetrics?: PilotDashboardOutcomeMetrics;
  outcomeDiagnostics?: PilotDashboardOutcomeSurveyDiagnostics;
  hypothesisEvaluation?: PilotDashboardHypothesisEvaluation;
}

export interface PilotDashboardMetrics {
  totalEnrollmentCount: number;
  activeAthleteCount: number;
  cohortCount: number;
  athletesWithEngineRecord: number;
  athletesWithStablePatterns: number;
  totalEvidenceRecords: number;
  totalPatternModels: number;
  totalRecommendationProjections: number;
  unsupportedHypotheses: number;
  hypothesisCount: number;
}

export interface PilotDashboardCoverageMetrics {
  engineCoverageRate: number;
  stablePatternRate: number;
  avgEvidenceRecordsPerActiveAthlete: number;
  avgPatternModelsPerActiveAthlete: number;
  avgRecommendationProjectionsPerActiveAthlete: number;
}

export interface PilotDashboardCohortSummary {
  cohortId: string;
  cohortName: string;
  cohortStatus: string;
  activeAthleteCount: number;
  athletesWithEngineRecord: number;
  athletesWithStablePatterns: number;
  totalEvidenceRecords: number;
  totalPatternModels: number;
  totalRecommendationProjections: number;
}

export interface PilotDashboardHypothesisSummary {
  notEnoughDataCount: number;
  promisingCount: number;
  mixedCount: number;
  notSupportedCount: number;
  highConfidenceCount: number;
}

export interface PilotDashboardRecentPattern {
  patternKey: string;
  patternFamily: CorrelationPatternFamily;
  targetDomain: CorrelationTargetDomain;
  confidenceTier: CorrelationConfidenceTier;
  confidenceScore: number;
  freshnessTier: CorrelationFreshnessTier;
  recommendationEligibility: CorrelationRecommendationEligibility;
  athleteSummary: string;
  coachSummary: string;
  observedRelationship: string;
  lastValidatedAt: PilotDashboardTimeValue;
  updatedAt: PilotDashboardTimeValue;
}

export interface PilotDashboardRecentProjection {
  projectionKey: string;
  consumer: CorrelationConsumer;
  projectionDate: string;
  generatedAt: PilotDashboardTimeValue;
  warningLevel: 'none' | 'watch' | 'caution' | 'protect';
  confidenceTier: CorrelationConfidenceTier;
  confidenceDisplay: string;
  summaryTitle: string;
  summaryBody: string;
  sourceSummary: string;
}

export interface PilotDashboardRecentEvidence {
  evidenceId: string;
  athleteLocalDate: string;
  sourceFamily: string;
  freshness: string;
  dataConfidence: CorrelationConfidenceTier;
  alignmentType: string;
  sessionTimestamp: PilotDashboardTimeValue;
  skillDomain?: string | null;
  pillarDomain?: string | null;
  coreMetricName?: string | null;
}

export interface PilotDashboardSnapshotHistoryItem {
  snapshotKey: string;
  milestoneType: string;
  capturedAt: PilotDashboardTimeValue;
  currentEmphasis?: string;
  nextMilestone?: string;
  trendSummary?: string;
  assessmentContextStatus: string;
  athleteSafeSummary?: string;
  coachDetailSummary?: string;
}

export interface PilotDashboardDetail {
  organization: PulseCheckOrganization;
  team: PulseCheckTeam;
  pilot: PulseCheckPilot;
  cohorts: PulseCheckPilotCohort[];
  athletes: PilotDashboardAthleteSummary[];
  hypotheses: PulseCheckPilotHypothesis[];
  metrics: PilotDashboardMetrics;
  coverage: PilotDashboardCoverageMetrics;
  cohortSummaries: PilotDashboardCohortSummary[];
  hypothesisSummary: PilotDashboardHypothesisSummary;
  inviteConfig: PulseCheckPilotInviteConfig;
  hasPilotInviteConfigOverride: boolean;
  teamInviteConfigDefault: PulseCheckPilotInviteDefaultConfig | null;
  organizationInviteConfigDefault: PulseCheckPilotInviteDefaultConfig | null;
  outcomeMetrics?: PilotDashboardOutcomeMetrics;
  outcomeMetricsByCohort?: Record<string, PilotDashboardOutcomeMetrics>;
  outcomeDiagnostics?: PilotDashboardOutcomeSurveyDiagnostics;
  outcomeDiagnosticsByCohort?: Record<string, PilotDashboardOutcomeSurveyDiagnostics>;
  outcomeOperationalDiagnostics?: Record<string, any>;
  outcomeRecommendationTypeSlices?: Record<string, any>;
  outcomeRecommendationTypeSlicesByCohort?: Record<string, Record<string, any>>;
  outcomeTrustDispositionBaseline?: Record<string, any>;
  outcomeReleaseSettings?: Record<string, any>;
  outcomeOpsStatus?: Record<string, any>;
  hypothesisEvaluation?: PilotDashboardHypothesisEvaluation;
  hypothesisEvaluationByCohort?: Record<string, PilotDashboardHypothesisEvaluation>;
  latestResearchReadout?: PilotResearchReadout | null;
  researchReadouts: PilotResearchReadout[];
}

export interface PilotDashboardAthleteDetail {
  organization: PulseCheckOrganization;
  team: PulseCheckTeam;
  pilot: PulseCheckPilot;
  cohort: PulseCheckPilotCohort | null;
  pilotEnrollment: PulseCheckPilotEnrollment;
  teamMembership: PulseCheckTeamMembership | null;
  displayName: string;
  email: string;
  engineSummary: PilotDashboardEngineSummary;
  profileSnapshotCount: number;
  latestAssessmentContextFlagStatus: string;
  latestAssessmentCapturedAt?: PilotDashboardTimeValue;
  mentalPerformanceSnapshots?: PulseCheckPilotMentalPerformanceSnapshotSet;
  recentPatterns: PilotDashboardRecentPattern[];
  recentProjections: PilotDashboardRecentProjection[];
  recentEvidence: PilotDashboardRecentEvidence[];
  snapshotHistory: PilotDashboardSnapshotHistoryItem[];
}
