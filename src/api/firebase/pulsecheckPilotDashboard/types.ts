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
  PulseCheckTeam,
  PulseCheckTeamMembership,
} from '../pulsecheckProvisioning/types';

export type PilotHypothesisStatus = 'not-enough-data' | 'promising' | 'mixed' | 'not-supported';
export type PilotHypothesisConfidenceLevel = 'low' | 'medium' | 'high';
export type PilotDashboardTimeValue = number | Timestamp | null;

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
  recentPatterns: PilotDashboardRecentPattern[];
  recentProjections: PilotDashboardRecentProjection[];
  recentEvidence: PilotDashboardRecentEvidence[];
  snapshotHistory: PilotDashboardSnapshotHistoryItem[];
}
