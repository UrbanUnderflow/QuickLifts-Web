import type { Timestamp } from 'firebase/firestore';
import {
  PULSECHECK_PILOT_METRIC_EVENTS_COLLECTION,
  PULSECHECK_PILOT_METRIC_ROLLUP_DAILY_SUBCOLLECTION,
  PULSECHECK_PILOT_METRIC_ROLLUP_SUMMARY_SUBCOLLECTION,
  PULSECHECK_PILOT_METRIC_ROLLUPS_COLLECTION,
  PULSECHECK_PILOT_MENTAL_PERFORMANCE_SNAPSHOTS_SUBCOLLECTION,
  PULSECHECK_PILOT_SURVEY_RESPONSES_COLLECTION,
} from './collections';

export const PULSECHECK_PILOT_METRIC_RECOMPUTE_MODE = 'hybrid' as const;

export const PULSECHECK_PILOT_OUTCOME_DASHBOARD_CARD_ORDER_V1 = [
  'enrollment',
  'adherence',
  'escalations',
  'speedToCare',
  'athleteTrust',
  'athleteNps',
] as const;
export const PULSECHECK_PILOT_OUTCOME_DASHBOARD_CARD_ORDER = PULSECHECK_PILOT_OUTCOME_DASHBOARD_CARD_ORDER_V1;

export const PULSECHECK_PILOT_MENTAL_PERFORMANCE_SNAPSHOT_TYPES = [
  'baseline',
  'current_latest_valid',
  'endpoint',
] as const;

export const PULSECHECK_PILOT_METRIC_ROLLUP_CURRENT_DOC_ID = 'current' as const;
export const PULSECHECK_PILOT_METRIC_ROLLUP_LAST7D_DOC_ID = 'last7d' as const;
export const PULSECHECK_PILOT_METRIC_ROLLUP_LAST30D_DOC_ID = 'last30d' as const;

export const PULSECHECK_PILOT_TRUST_BATTERY_ITEM_KEYS = [
  'credibility',
  'reliability',
  'honesty_safety',
  'athlete_interest',
  'practical_usefulness',
] as const;
export const PULSECHECK_PILOT_TRUST_BATTERY_VERSION = 'athlete_trust_battery_v1' as const;

export const PULSECHECK_PILOT_SURVEY_KINDS = ['trust', 'nps'] as const;
export const PULSECHECK_PILOT_SURVEY_RESPONDENT_ROLES = ['athlete', 'coach', 'clinician'] as const;
export const PULSECHECK_PILOT_METRIC_EVENT_ACTOR_ROLES = ['athlete', 'coach', 'clinician', 'system', 'admin'] as const;
export const PULSECHECK_PILOT_METRIC_EVENT_TYPES = [
  'pilot_enrollment_activated',
  'pilot_enrollment_withdrawn',
  'baseline_completed',
  'daily_checkin_completed',
  'daily_assignment_completed',
  'escalation_created',
  'coach_notified',
  'care_handoff_initiated',
  'care_handoff_completed',
  'survey_submitted',
  'nps_submitted',
  'trust_submitted',
] as const;

export type PulseCheckPilotMetricRecomputeMode = typeof PULSECHECK_PILOT_METRIC_RECOMPUTE_MODE;
export type PulseCheckPilotOutcomeDashboardCardKey = typeof PULSECHECK_PILOT_OUTCOME_DASHBOARD_CARD_ORDER_V1[number];
export type PulseCheckPilotMentalPerformanceSnapshotType = typeof PULSECHECK_PILOT_MENTAL_PERFORMANCE_SNAPSHOT_TYPES[number];
export type PulseCheckPilotTrustBatteryItemKey = typeof PULSECHECK_PILOT_TRUST_BATTERY_ITEM_KEYS[number];
export type PulseCheckPilotSurveyKind = typeof PULSECHECK_PILOT_SURVEY_KINDS[number];
export type PulseCheckPilotSurveyRespondentRole = typeof PULSECHECK_PILOT_SURVEY_RESPONDENT_ROLES[number];
export type PulseCheckPilotMetricEventActorRole = typeof PULSECHECK_PILOT_METRIC_EVENT_ACTOR_ROLES[number];
export type PulseCheckPilotMetricEventType = typeof PULSECHECK_PILOT_METRIC_EVENT_TYPES[number];

export interface PulseCheckPilotMetricEvent {
  id: string;
  pilotId: string;
  pilotEnrollmentId?: string | null;
  organizationId: string;
  teamId: string;
  cohortId?: string | null;
  athleteId?: string | null;
  actorUserId?: string | null;
  actorRole: PulseCheckPilotMetricEventActorRole;
  eventType: PulseCheckPilotMetricEventType;
  sourceCollection?: string | null;
  sourceDocumentId?: string | null;
  sourceDate?: string | null;
  metricPayload?: Record<string, unknown>;
  createdAt: Timestamp | number | null;
}

export interface PulseCheckPilotTrustBatteryItemResponse {
  key: PulseCheckPilotTrustBatteryItemKey;
  score: number | null;
  completed: boolean;
  prompt?: string | null;
}

export interface PulseCheckPilotTrustBatteryPayload {
  version: typeof PULSECHECK_PILOT_TRUST_BATTERY_VERSION;
  items: PulseCheckPilotTrustBatteryItemResponse[];
  averageScore?: number | null;
  totalItemCount?: number | null;
  completedItemCount?: number | null;
  completionStatus?: 'empty' | 'partial' | 'complete';
}

export interface PulseCheckPilotSurveyResponse {
  id: string;
  pilotId: string;
  pilotEnrollmentId?: string | null;
  organizationId: string;
  teamId: string;
  cohortId?: string | null;
  respondentUserId: string;
  respondentRole: PulseCheckPilotSurveyRespondentRole;
  surveyKind: PulseCheckPilotSurveyKind;
  score: number;
  comment?: string;
  source: 'ios' | 'android' | 'web-admin';
  submittedAt: Timestamp | number | null;
  trustBattery?: PulseCheckPilotTrustBatteryPayload | null;
}

export interface PulseCheckPilotMentalPerformanceSnapshotProfile {
  overallScore: number;
  pillarScores: Record<'focus' | 'composure' | 'decision', number>;
  skillScores: Record<string, number>;
  modifierScores: Record<string, number>;
  strongestSkills: string[];
  weakestSkills: string[];
  trendSummary: string[];
  updatedAt: number;
}

export interface PulseCheckPilotMentalPerformanceDelta {
  focus: number;
  composure: number;
  decision: number;
  pillarComposite: number;
}

export interface PulseCheckPilotMentalPerformanceSnapshotValidity {
  hasBaselineAssessment: boolean;
  hasRecentProfile: boolean;
  excludedFromHeadlineDelta: boolean;
  exclusionReason?: 'missing_baseline' | 'stale_current' | 'missing_current' | null;
}

export interface PulseCheckPilotMentalPerformanceSnapshotEndpointFreeze {
  frozen: boolean;
  frozenAt?: Timestamp | number | null;
  freezeReason?: 'pilot_end_date' | 'athlete_completion' | 'manual_override' | null;
}

export interface PulseCheckPilotMentalPerformanceSnapshot {
  id: PulseCheckPilotMentalPerformanceSnapshotType;
  pilotEnrollmentId: string;
  pilotId: string;
  organizationId: string;
  teamId: string;
  cohortId?: string | null;
  athleteId: string;
  snapshotType: PulseCheckPilotMentalPerformanceSnapshotType;
  status: 'valid' | 'stale' | 'missing';
  capturedAt: Timestamp | number | null;
  computedAt: Timestamp | number | null;
  freshnessWindowDays?: number | null;
  sourceProfileVersion: string;
  sourceWriterVersion: string;
  sourceEventId?: string | null;
  sourceCanonicalProfileSnapshotKey?: string | null;
  sourceCanonicalProfileSnapshotRevision?: number | null;
  taxonomyProfile: PulseCheckPilotMentalPerformanceSnapshotProfile;
  pillarCompositeScore: number;
  targetDeltaFromBaseline?: PulseCheckPilotMentalPerformanceDelta | null;
  validity: PulseCheckPilotMentalPerformanceSnapshotValidity;
  endpointFreeze: PulseCheckPilotMentalPerformanceSnapshotEndpointFreeze;
}

export interface PulseCheckPilotMentalPerformanceSnapshotSet {
  baseline?: PulseCheckPilotMentalPerformanceSnapshot | null;
  currentLatestValid?: PulseCheckPilotMentalPerformanceSnapshot | null;
  endpoint?: PulseCheckPilotMentalPerformanceSnapshot | null;
}

export type PulseCheckPilotMetricRollupWindow = 'current' | 'last7d' | 'last30d' | 'daily';

export interface PulseCheckPilotOutcomeMetrics {
  enrollmentRate: number;
  consentCompletionRate: number;
  baselineCompletionRate: number;
  adherenceRate: number;
  dailyCheckInRate: number;
  assignmentCompletionRate: number;
  mentalPerformanceDelta: number;
  escalationsTotal: number;
  escalationsTier1: number;
  escalationsTier2: number;
  escalationsTier3: number;
  medianMinutesToCare: number | null;
  athleteNps: number | null;
  coachNps: number | null;
  clinicianNps: number | null;
  athleteTrust: number | null;
  coachTrust: number | null;
  clinicianTrust: number | null;
}

export interface PulseCheckPilotOutcomeSurveySummary {
  responseCount: number;
  minimumSampleMet: boolean;
  averageScore: number | null;
  medianScore: number | null;
  lowScoreShare: number | null;
  highScoreShare: number | null;
  headlineValue: number | null;
  trustBatteryAverage?: number | null;
}

export interface PulseCheckPilotOutcomeSurveyDiagnostics {
  minimumResponseThreshold: number;
  athleteTrust: PulseCheckPilotOutcomeSurveySummary;
  coachTrust: PulseCheckPilotOutcomeSurveySummary;
  clinicianTrust: PulseCheckPilotOutcomeSurveySummary;
  athleteNps: PulseCheckPilotOutcomeSurveySummary;
  coachNps: PulseCheckPilotOutcomeSurveySummary;
  clinicianNps: PulseCheckPilotOutcomeSurveySummary;
}

export interface PulseCheckPilotHypothesisComparisonGroup {
  athleteCount: number;
  adherenceRate: number | null;
  mentalPerformanceDelta: number | null;
  athleteTrust: number | null;
  athleteNps: number | null;
}

export interface PulseCheckPilotHypothesisComparisonDelta {
  adherenceRate: number;
  mentalPerformanceDelta: number;
  athleteTrust: number;
}

export interface PulseCheckPilotHypothesisComparisonSlice {
  hypothesisCode: 'H3' | 'H5' | 'H6';
  comparisonLabel: string;
  delta: PulseCheckPilotHypothesisComparisonDelta;
}

export interface PulseCheckPilotHypothesisEvaluationDiagnostics {
  usesRollupWindow: 'current';
  h3: PulseCheckPilotHypothesisComparisonSlice & {
    stateAware: PulseCheckPilotHypothesisComparisonGroup;
    fallbackOrNone: PulseCheckPilotHypothesisComparisonGroup;
  };
  h5: PulseCheckPilotHypothesisComparisonSlice & {
    bodyStateAwareExposure: PulseCheckPilotHypothesisComparisonGroup;
    profileOnlyOrNone: PulseCheckPilotHypothesisComparisonGroup;
    coachTrust: number | null;
    coachNps: number | null;
    coachResponseCount: number;
  };
  h6: PulseCheckPilotHypothesisComparisonSlice & {
    completedProtocol: PulseCheckPilotHypothesisComparisonGroup;
    incompleteOrSkippedProtocol: PulseCheckPilotHypothesisComparisonGroup;
  };
}

export interface PulseCheckPilotOutcomeMetricRollup {
  pilotId: string;
  pilotEnrollmentId?: string | null;
  organizationId: string;
  teamId: string;
  cohortId?: string | null;
  window: PulseCheckPilotMetricRollupWindow;
  dateKey?: string | null;
  windowStartDate?: string | null;
  windowEndDate?: string | null;
  metrics: PulseCheckPilotOutcomeMetrics;
  diagnostics?: Record<string, unknown>;
  outcomeByCohort?: Record<string, PulseCheckPilotOutcomeMetrics>;
  computedAt: Timestamp | number | null;
  sourceEventIds?: string[];
  sourceSurveyResponseIds?: string[];
  sourceSnapshotIds?: string[];
}

export {
  PULSECHECK_PILOT_METRIC_EVENTS_COLLECTION,
  PULSECHECK_PILOT_METRIC_ROLLUP_DAILY_SUBCOLLECTION,
  PULSECHECK_PILOT_METRIC_ROLLUP_SUMMARY_SUBCOLLECTION,
  PULSECHECK_PILOT_METRIC_ROLLUPS_COLLECTION,
  PULSECHECK_PILOT_MENTAL_PERFORMANCE_SNAPSHOTS_SUBCOLLECTION,
  PULSECHECK_PILOT_SURVEY_RESPONSES_COLLECTION,
};

export const PULSECHECK_PILOT_MENTAL_PERFORMANCE_SNAPSHOT_PATH_TEMPLATE =
  `pulsecheck-pilot-enrollments/{pilotEnrollmentId}/${PULSECHECK_PILOT_MENTAL_PERFORMANCE_SNAPSHOTS_SUBCOLLECTION}/{snapshotType}` as const;

export const PULSECHECK_PILOT_METRIC_ROLLUP_SUMMARY_PATH_TEMPLATE =
  `pulsecheck-pilot-metric-rollups/{pilotId}/${PULSECHECK_PILOT_METRIC_ROLLUP_SUMMARY_SUBCOLLECTION}/{window}` as const;

export const PULSECHECK_PILOT_METRIC_ROLLUP_DAILY_PATH_TEMPLATE =
  `pulsecheck-pilot-metric-rollups/{pilotId}/${PULSECHECK_PILOT_METRIC_ROLLUP_DAILY_SUBCOLLECTION}/{yyyy-mm-dd}` as const;
