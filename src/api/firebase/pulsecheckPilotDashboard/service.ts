import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import { db } from '../config';
import { auth } from '../config';
import {
  ATHLETE_MENTAL_PROGRESS_COLLECTION,
  ATHLETE_PATTERN_MODELS_SUBCOLLECTION,
  ATHLETE_PHYSIOLOGY_COGNITION_COLLECTION,
  CORRELATION_EVIDENCE_RECORDS_SUBCOLLECTION,
  PULSECHECK_PILOT_METRIC_OPS_COLLECTION,
  PULSECHECK_PILOT_METRIC_ROLLUP_SUMMARY_SUBCOLLECTION,
  PULSECHECK_PILOT_METRIC_ROLLUPS_COLLECTION,
  PULSECHECK_PILOT_MENTAL_PERFORMANCE_SNAPSHOTS_SUBCOLLECTION,
  PULSECHECK_PILOT_OUTCOME_RELEASE_SETTINGS_COLLECTION,
  PROFILE_SNAPSHOTS_SUBCOLLECTION,
  RECOMMENDATION_PROJECTIONS_SUBCOLLECTION,
} from '../mentaltraining/collections';
import { pulseCheckProvisioningService } from '../pulsecheckProvisioning/service';
import { pilotDashboardDemoMode } from './demoMode';
import { mergePulseCheckRequiredConsents } from '../pulsecheckProvisioning/types';
import type {
  PulseCheckPilot,
  PulseCheckPilotCohort,
  PulseCheckPilotEnrollment,
  PulseCheckRequiredConsentDocument,
  PulseCheckTeamMembership,
} from '../pulsecheckProvisioning/types';
import type {
  PilotDashboardAthleteDetail,
  PilotDashboardOutcomeMetricRollup,
  PilotDashboardOutcomeMetrics,
  PilotDashboardOutcomeSurveyDiagnostics,
  PilotDashboardAthleteSummary,
  PilotDashboardCohortSummary,
  PilotDashboardDetail,
  PilotDashboardDirectoryEntry,
  PilotDashboardEngineSummary,
  PilotDashboardHypothesisSummary,
  PilotDashboardRecentEvidence,
  PilotDashboardRecentPattern,
  PilotDashboardRecentProjection,
  PilotResearchReadout,
  PilotResearchReadoutGenerationInput,
  PilotResearchReadoutReviewInput,
  PilotResearchReadoutSection,
  PilotResearchReadoutClaim,
  PilotResearchReadoutCitation,
  PilotResearchReadoutReadinessGateResult,
  PilotDashboardSnapshotHistoryItem,
  PulseCheckPilotHypothesis,
  PilotHypothesisAssistFrame,
  PilotHypothesisAssistGenerationInput,
  PilotHypothesisAssistGenerationResult,
  PulseCheckPilotInviteDefaultConfig,
  PulseCheckPilotInviteDefaultConfigInput,
  PulseCheckPilotInviteConfig,
  PulseCheckPilotInviteConfigInput,
  PulseCheckPilotRequiredConsentInput,
  PulseCheckPilotHypothesisInput,
  PulseCheckPilotMentalPerformanceSnapshotRecordSet,
  PulseCheckPilotOutcomeSurveyResponse,
  PulseCheckPilotOutcomeTrustBatteryPayload,
} from './types';

const PILOT_HYPOTHESES_COLLECTION = 'pulsecheck-pilot-hypotheses';
const PILOT_INVITE_CONFIGS_COLLECTION = 'pulsecheck-pilot-invite-configs';
const TEAM_INVITE_DEFAULTS_COLLECTION = 'pulsecheck-team-invite-defaults';
const ORGANIZATION_INVITE_DEFAULTS_COLLECTION = 'pulsecheck-organization-invite-defaults';
const PILOT_RESEARCH_READOUTS_COLLECTION = 'pulsecheck-pilot-research-readouts';
const PILOT_RESEARCH_READ_MODEL_VERSION = 'pilot-dashboard-v1';

const DEFAULT_PILOT_HYPOTHESES: Array<Pick<PulseCheckPilotHypothesis, 'code' | 'statement' | 'leadingIndicator'> > = [
  {
    code: 'H1',
    statement: 'Athletes with linked physiology and sim evidence will show more personalized guidance over time.',
    leadingIndicator: 'Percentage of athletes reaching Stage 2+ evidence maturity by week 4.',
  },
  {
    code: 'H2',
    statement: 'Stable correlation patterns will emerge for a meaningful share of athletes within the pilot window.',
    leadingIndicator: 'At least 30% of eligible athletes have one stable pattern by week 6.',
  },
  {
    code: 'H3',
    statement: 'Recommendations based on body-state-specific patterns will outperform generic recommendations.',
    leadingIndicator: 'Sim performance delta: sessions following personalized recommendation vs. generic or no recommendation.',
  },
  {
    code: 'H4',
    statement: 'Milestone interpretation will improve when physiological context is included.',
    leadingIndicator: 'Coach satisfaction with trial interpretation when Assessment Context Flag is present vs. absent.',
  },
  {
    code: 'H5',
    statement: 'Coaches will find body-state-aware insights more actionable than profile-only summaries.',
    leadingIndicator: 'Coach dashboard engagement rate for physiology-enriched views vs. baseline views.',
  },
  {
    code: 'H6',
    statement: 'Athletes who follow body-state-specific protocol recommendations will show better downstream sim performance.',
    leadingIndicator: 'Pre/post sim delta when recommended protocol was followed vs. skipped under matched physiological conditions.',
  },
  {
    code: 'H7',
    statement: 'The engine will identify meaningful individual differences in sleep floors and HRV sweet spots rather than converging on population averages.',
    leadingIndicator: 'Variance in discovered personal thresholds across athletes.',
  },
];

const normalizeString = (value?: string | null) => value?.trim() || '';
const normalizeRequiredConsentDocuments = (value: unknown): PulseCheckRequiredConsentDocument[] => {
  if (!Array.isArray(value)) return [];

  const normalized = value.reduce<PulseCheckRequiredConsentDocument[]>((acc, entry, index) => {
    if (!entry || typeof entry !== 'object') return acc;
    const candidate = entry as Record<string, unknown>;
    const title = normalizeString(typeof candidate.title === 'string' ? candidate.title : '');
    const body = normalizeString(typeof candidate.body === 'string' ? candidate.body : '');
    const version = normalizeString(typeof candidate.version === 'string' ? candidate.version : '') || 'v1';
    const id = normalizeString(typeof candidate.id === 'string' ? candidate.id : '') || `consent-${index + 1}`;
    if (!title || !body) return acc;
    acc.push({ id, title, body, version });
    return acc;
  }, []);

  return mergePulseCheckRequiredConsents(normalized);
};
const roundMetric = (value: number) => Number(value.toFixed(1));
const toPercentage = (numerator: number, denominator: number) =>
  denominator > 0 ? roundMetric((numerator / denominator) * 100) : 0;
const toAverage = (total: number, count: number) => (count > 0 ? roundMetric(total / count) : 0);

const toDate = (value: any): Date | null => {
  if (!value) return null;
  if (typeof value === 'number' && Number.isFinite(value)) return new Date(value);
  if (value instanceof Date) return value;
  if (typeof value?.toDate === 'function') return value.toDate();
  return null;
};
const toTimeValue = (value: any) => {
  if (typeof value === 'number') return value;
  return value || null;
};
const toTimeMs = (value: any): number => {
  if (!value) return 0;
  if (typeof value === 'number') return value;
  if (value instanceof Date) return value.getTime();
  if (typeof value?.toDate === 'function') return value.toDate().getTime();
  return 0;
};

const resolvePilotEffectiveStatus = (pilot: PulseCheckPilot): PulseCheckPilot['status'] => {
  if (pilot.status === 'archived' || pilot.status === 'completed' || pilot.status === 'paused') {
    return pilot.status;
  }

  const now = new Date();
  const startAt = toDate(pilot.startAt);
  const endAt = toDate(pilot.endAt);

  if (endAt && endAt.getTime() < now.getTime()) return 'completed';
  if (startAt && startAt.getTime() <= now.getTime()) return 'active';
  if (pilot.status === 'active') return 'active';
  return 'draft';
};

const isActivePilotDashboardScope = (pilot: PulseCheckPilot) => resolvePilotEffectiveStatus(pilot) === 'active';

const isPilotOperationallyActive = (
  pilot: PulseCheckPilot,
  cohorts: PulseCheckPilotCohort[] = [],
  enrollments: PulseCheckPilotEnrollment[] = []
) => {
  if (isActivePilotDashboardScope(pilot)) return true;
  if (enrollments.some((enrollment) => enrollment.status === 'active')) return true;
  if (cohorts.some((cohort) => cohort.status === 'active')) return true;
  return false;
};

const toHypothesis = (id: string, data: Record<string, any>): PulseCheckPilotHypothesis => ({
  id,
  pilotId: normalizeString(data.pilotId),
  code: normalizeString(data.code),
  statement: normalizeString(data.statement),
  leadingIndicator: normalizeString(data.leadingIndicator),
  status: (normalizeString(data.status) as PulseCheckPilotHypothesis['status']) || 'not-enough-data',
  confidenceLevel: (normalizeString(data.confidenceLevel) as PulseCheckPilotHypothesis['confidenceLevel']) || 'low',
  keyEvidence: normalizeString(data.keyEvidence),
  notes: normalizeString(data.notes),
  lastReviewedAt: data.lastReviewedAt || null,
  createdAt: data.createdAt || null,
  updatedAt: data.updatedAt || null,
});

const toResearchReadoutCitation = (data: Record<string, any>): PilotResearchReadoutCitation => ({
  blockKey: normalizeString(data.blockKey),
  blockLabel: normalizeString(data.blockLabel),
  hypothesisCodes: Array.isArray(data.hypothesisCodes) ? data.hypothesisCodes.map((entry) => normalizeString(entry)).filter(Boolean) : [],
  limitationKeys: Array.isArray(data.limitationKeys) ? data.limitationKeys.map((entry) => normalizeString(entry)).filter(Boolean) : [],
});

const toResearchReadoutClaim = (data: Record<string, any>): PilotResearchReadoutClaim => ({
  claimKey: normalizeString(data.claimKey),
  claimType: normalizeString(data.claimType) as PilotResearchReadoutClaim['claimType'],
  statement: normalizeString(data.statement),
  denominatorLabel: normalizeString(data.denominatorLabel),
  denominatorValue: Number(data.denominatorValue) || 0,
  evidenceSources: Array.isArray(data.evidenceSources) ? data.evidenceSources.map((entry) => normalizeString(entry)).filter(Boolean) : [],
  confidenceLevel: (normalizeString(data.confidenceLevel) as PilotResearchReadoutClaim['confidenceLevel']) || 'low',
  baselineMode: (normalizeString(data.baselineMode) as PilotResearchReadoutClaim['baselineMode']) || 'no-baseline',
  caveatFlag: Boolean(data.caveatFlag),
});

const toResearchReadoutSection = (data: Record<string, any>): PilotResearchReadoutSection => ({
  sectionKey: normalizeString(data.sectionKey) as PilotResearchReadoutSection['sectionKey'],
  title: normalizeString(data.title),
  readinessStatus: normalizeString(data.readinessStatus) === 'suppressed' ? 'suppressed' : 'ready',
  summary: normalizeString(data.summary),
  citations: Array.isArray(data.citations) ? data.citations.map((entry) => toResearchReadoutCitation(entry as Record<string, any>)) : [],
  claims: Array.isArray(data.claims) ? data.claims.map((entry) => toResearchReadoutClaim(entry as Record<string, any>)) : [],
  suggestedReviewerResolution: normalizeString(data.suggestedReviewerResolution) as PilotResearchReadoutSection['suggestedReviewerResolution'],
  reviewerResolution: normalizeString(data.reviewerResolution) as PilotResearchReadoutSection['reviewerResolution'],
  reviewerNotes: normalizeString(data.reviewerNotes),
});

const toResearchReadinessGate = (data: Record<string, any>): PilotResearchReadoutReadinessGateResult => ({
  gateKey: normalizeString(data.gateKey),
  status: normalizeString(data.status) as PilotResearchReadoutReadinessGateResult['status'],
  summary: normalizeString(data.summary),
});

const toResearchReadout = (id: string, data: Record<string, any>): PilotResearchReadout => ({
  id,
  pilotId: normalizeString(data.pilotId),
  organizationId: normalizeString(data.organizationId),
  teamId: normalizeString(data.teamId),
  cohortId: normalizeString(data.cohortId) || null,
  dateWindowStart: normalizeString(data.dateWindowStart),
  dateWindowEnd: normalizeString(data.dateWindowEnd),
  baselineMode: (normalizeString(data.baselineMode) as PilotResearchReadout['baselineMode']) || 'no-baseline',
  reviewState: (normalizeString(data.reviewState) as PilotResearchReadout['reviewState']) || 'draft',
  modelVersion: normalizeString(data.modelVersion),
  promptVersion: normalizeString(data.promptVersion),
  readModelVersion: normalizeString(data.readModelVersion) || PILOT_RESEARCH_READ_MODEL_VERSION,
  readiness: Array.isArray(data.readiness) ? data.readiness.map((entry) => toResearchReadinessGate(entry as Record<string, any>)) : [],
  sections: Array.isArray(data.sections) ? data.sections.map((entry) => toResearchReadoutSection(entry as Record<string, any>)) : [],
  frozenEvidenceFrame: (data.frozenEvidenceFrame as Record<string, any>) || undefined,
  generatedAt: data.generatedAt || null,
  reviewedAt: data.reviewedAt || null,
  reviewedByUserId: normalizeString(data.reviewedByUserId),
  reviewedByEmail: normalizeString(data.reviewedByEmail),
  createdAt: data.createdAt || null,
  updatedAt: data.updatedAt || null,
});

const sortResearchReadouts = (items: PilotResearchReadout[]) =>
  [...items].sort((left, right) => {
    const generatedDelta = toTimeMs(right.generatedAt) - toTimeMs(left.generatedAt);
    if (generatedDelta !== 0) return generatedDelta;
    return toTimeMs(right.updatedAt) - toTimeMs(left.updatedAt);
  });

const loadCurrentOutcomeRollup = async (pilotId: string): Promise<PilotDashboardOutcomeMetricRollup | null> => {
  const normalizedPilotId = normalizeString(pilotId);
  if (!normalizedPilotId) return null;

  const rollupRef = doc(
    db,
    PULSECHECK_PILOT_METRIC_ROLLUPS_COLLECTION,
    normalizedPilotId,
    PULSECHECK_PILOT_METRIC_ROLLUP_SUMMARY_SUBCOLLECTION,
    'current'
  );
  const rollupSnap = await getDoc(rollupRef);
  if (!rollupSnap.exists()) return null;
  return rollupSnap.data() as PilotDashboardOutcomeMetricRollup;
};

const loadPilotOutcomeReleaseSettings = async (pilotId: string): Promise<Record<string, any> | null> => {
  const normalizedPilotId = normalizeString(pilotId);
  if (!normalizedPilotId) return null;
  const snap = await getDoc(doc(db, PULSECHECK_PILOT_OUTCOME_RELEASE_SETTINGS_COLLECTION, normalizedPilotId));
  if (!snap.exists()) return null;
  return snap.data() as Record<string, any>;
};

const loadPilotOutcomeOpsStatus = async (pilotId: string): Promise<Record<string, any> | null> => {
  const normalizedPilotId = normalizeString(pilotId);
  if (!normalizedPilotId) return null;

  const rootSnap = await getDoc(doc(db, PULSECHECK_PILOT_METRIC_OPS_COLLECTION, normalizedPilotId));
  const scopesSnap = await getDocs(collection(db, PULSECHECK_PILOT_METRIC_OPS_COLLECTION, normalizedPilotId, 'scopes'));

  return {
    root: rootSnap.exists() ? rootSnap.data() : null,
    scopes: scopesSnap.docs.reduce<Record<string, any>>((accumulator, docSnap) => {
      accumulator[docSnap.id] = docSnap.data();
      return accumulator;
    }, {}),
  };
};

const loadPilotMentalPerformanceSnapshotSet = async (
  pilotEnrollmentId: string
): Promise<PulseCheckPilotMentalPerformanceSnapshotRecordSet | undefined> => {
  const normalizedEnrollmentId = normalizeString(pilotEnrollmentId);
  if (!normalizedEnrollmentId) return undefined;

  const [baselineSnap, currentSnap, endpointSnap] = await Promise.all([
    getDoc(doc(db, 'pulsecheck-pilot-enrollments', normalizedEnrollmentId, PULSECHECK_PILOT_MENTAL_PERFORMANCE_SNAPSHOTS_SUBCOLLECTION, 'baseline')),
    getDoc(doc(db, 'pulsecheck-pilot-enrollments', normalizedEnrollmentId, PULSECHECK_PILOT_MENTAL_PERFORMANCE_SNAPSHOTS_SUBCOLLECTION, 'current_latest_valid')),
    getDoc(doc(db, 'pulsecheck-pilot-enrollments', normalizedEnrollmentId, PULSECHECK_PILOT_MENTAL_PERFORMANCE_SNAPSHOTS_SUBCOLLECTION, 'endpoint')),
  ]);

  return {
    baseline: baselineSnap.exists() ? (baselineSnap.data() as any) : null,
    currentLatestValid: currentSnap.exists() ? (currentSnap.data() as any) : null,
    endpoint: endpointSnap.exists() ? (endpointSnap.data() as any) : null,
  };
};

const buildHypothesisId = (pilotId: string, code: string) => `${normalizeString(pilotId)}__${normalizeString(code).toLowerCase()}`;

const sortHypotheses = (items: PulseCheckPilotHypothesis[]) =>
  [...items].sort((left, right) => left.code.localeCompare(right.code));

const buildDefaultInviteConfig = (
  pilot: PulseCheckPilot,
  organizationName: string,
  teamName: string
): PulseCheckPilotInviteConfig => ({
  id: pilot.id,
  pilotId: pilot.id,
  organizationId: pilot.organizationId,
  teamId: pilot.teamId,
  welcomeHeadline: `Welcome to ${pilot.name || 'your PulseCheck pilot'}`,
  welcomeBody: `You are joining ${teamName} inside ${organizationName}. This page explains how to get the app set up, what you need to complete, and how to move into the pilot without confusion.`,
  existingAthleteInstructions:
    'Open the Pulse app and sign in with your existing account.\nConfirm the team and pilot show up in your account.\nComplete only any pilot-specific consent or baseline step that appears.',
  newAthleteInstructions:
    'Download the Pulse app on your phone.\nSign in with the invited email and complete athlete onboarding.\nAccept the required consent prompts and finish your baseline setup.',
  wearableRequirements:
    'Connect the wearable or health data source required for this pilot as early as possible. If no wearable is available yet, follow the fallback instructions from staff.',
  baselineExpectations:
    'Complete the baseline path promptly after joining so the pilot can start collecting usable signal and place you into the correct workflow.',
  supportName: '',
  supportEmail: '',
  supportPhone: '',
  iosAppUrl: 'https://apps.apple.com/ca/app/pulse-community-workouts/id6451497729',
  androidAppUrl: 'https://play.google.com/store/apps/details?id=ai.fitwithpulse.pulse',
  createdAt: null,
  updatedAt: null,
});

const normalizePilotRequiredConsentPayload = (requiredConsents: PulseCheckRequiredConsentDocument[]) =>
  normalizeRequiredConsentDocuments(requiredConsents).map((consent) => ({
    id: consent.id,
    title: consent.title,
    body: consent.body,
    version: consent.version,
  }));

const applyInviteConfigFields = <T extends {
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
}>(base: T, data?: Record<string, any> | null): T => ({
  ...base,
  welcomeHeadline: normalizeString(data?.welcomeHeadline) || base.welcomeHeadline,
  welcomeBody: normalizeString(data?.welcomeBody) || base.welcomeBody,
  existingAthleteInstructions: normalizeString(data?.existingAthleteInstructions) || base.existingAthleteInstructions,
  newAthleteInstructions: normalizeString(data?.newAthleteInstructions) || base.newAthleteInstructions,
  wearableRequirements: normalizeString(data?.wearableRequirements) || base.wearableRequirements,
  baselineExpectations: normalizeString(data?.baselineExpectations) || base.baselineExpectations,
  supportName: normalizeString(data?.supportName) || base.supportName,
  supportEmail: normalizeString(data?.supportEmail) || base.supportEmail,
  supportPhone: normalizeString(data?.supportPhone) || base.supportPhone,
  iosAppUrl: normalizeString(data?.iosAppUrl) || base.iosAppUrl,
  androidAppUrl: normalizeString(data?.androidAppUrl) || base.androidAppUrl,
});

const toInviteConfig = (
  id: string,
  data: Record<string, any>,
  pilot: PulseCheckPilot,
  organizationName: string,
  teamName: string
): PulseCheckPilotInviteConfig => {
  const defaults = buildDefaultInviteConfig(pilot, organizationName, teamName);
  return {
    ...applyInviteConfigFields(defaults, data),
    id,
    pilotId: normalizeString(data.pilotId) || defaults.pilotId,
    organizationId: normalizeString(data.organizationId) || defaults.organizationId,
    teamId: normalizeString(data.teamId) || defaults.teamId,
    createdAt: data.createdAt || defaults.createdAt,
    updatedAt: data.updatedAt || defaults.updatedAt,
  };
};

const toInviteDefaultConfig = (
  id: string,
  data: Record<string, any>,
  scopeType: 'organization' | 'team'
): PulseCheckPilotInviteDefaultConfig => ({
  ...applyInviteConfigFields(
    {
      id,
      scopeType,
      organizationId: normalizeString(data.organizationId),
      teamId: normalizeString(data.teamId),
      welcomeHeadline: '',
      welcomeBody: '',
      existingAthleteInstructions: '',
      newAthleteInstructions: '',
      wearableRequirements: '',
      baselineExpectations: '',
      supportName: '',
      supportEmail: '',
      supportPhone: '',
      iosAppUrl: '',
      androidAppUrl: '',
      createdAt: null,
      updatedAt: null,
    },
    data
  ),
  createdAt: data.createdAt || null,
  updatedAt: data.updatedAt || null,
});

const buildAthleteLabel = (teamMembership: PulseCheckTeamMembership | null, enrollment: PulseCheckPilotEnrollment) => {
  const onboardingName = normalizeString(teamMembership?.athleteOnboarding?.entryOnboardingName);
  if (onboardingName) return onboardingName;
  return normalizeString(teamMembership?.email) || normalizeString(enrollment.userId) || 'Pilot athlete';
};

async function loadEngineSummaryForAthlete(athleteId: string): Promise<PilotDashboardEngineSummary> {
  const athleteRef = doc(db, ATHLETE_PHYSIOLOGY_COGNITION_COLLECTION, athleteId);
  const athleteSnap = await getDoc(athleteRef);

  if (!athleteSnap.exists()) {
    return {
      hasEngineRecord: false,
      evidenceRecordCount: 0,
      patternModelCount: 0,
      stablePatternCount: 0,
      highConfidencePatternCount: 0,
      degradedPatternCount: 0,
      recommendationProjectionCount: 0,
      recommendationProjectionCountsByConsumer: {},
    };
  }

  const [evidenceSnap, patternSnap, projectionSnap] = await Promise.all([
    getDocs(collection(db, ATHLETE_PHYSIOLOGY_COGNITION_COLLECTION, athleteId, CORRELATION_EVIDENCE_RECORDS_SUBCOLLECTION)),
    getDocs(collection(db, ATHLETE_PHYSIOLOGY_COGNITION_COLLECTION, athleteId, ATHLETE_PATTERN_MODELS_SUBCOLLECTION)),
    getDocs(collection(db, ATHLETE_PHYSIOLOGY_COGNITION_COLLECTION, athleteId, RECOMMENDATION_PROJECTIONS_SUBCOLLECTION)),
  ]);

  let stablePatternCount = 0;
  let highConfidencePatternCount = 0;
  let degradedPatternCount = 0;
  const recommendationProjectionCountsByConsumer: Record<string, number> = {};
  patternSnap.docs.forEach((docSnap) => {
    const data = docSnap.data() as Record<string, any>;
    const confidenceTier = normalizeString(data.confidenceTier);
    if (confidenceTier === 'stable') stablePatternCount += 1;
    if (confidenceTier === 'high_confidence') {
      stablePatternCount += 1;
      highConfidencePatternCount += 1;
    }
    if (confidenceTier === 'degraded') degradedPatternCount += 1;
  });

  projectionSnap.docs.forEach((docSnap) => {
    const data = docSnap.data() as Record<string, any>;
    const consumer = normalizeString(data.consumer);
    if (!consumer) return;
    recommendationProjectionCountsByConsumer[consumer] = (recommendationProjectionCountsByConsumer[consumer] || 0) + 1;
  });

  const athleteData = athleteSnap.data() as Record<string, any>;

  return {
    hasEngineRecord: true,
    engineVersion: normalizeString(athleteData.engineVersion),
    lastEvidenceAt: toTimeValue(athleteData.lastEvidenceAt),
    lastPatternRefreshAt: toTimeValue(athleteData.lastPatternRefreshAt),
    lastProjectionRefreshAt: toTimeValue(athleteData.lastProjectionRefreshAt),
    lastEngineRefreshAt: toTimeValue(athleteData.lastEngineRefreshAt),
    activePatternKeys: Array.isArray(athleteData.activePatternKeys) ? athleteData.activePatternKeys : [],
    activeProjectionKeys: Array.isArray(athleteData.activeProjectionKeys) ? athleteData.activeProjectionKeys : [],
    evidenceRecordCount: evidenceSnap.size,
    patternModelCount: patternSnap.size,
    stablePatternCount,
    highConfidencePatternCount,
    degradedPatternCount,
    recommendationProjectionCount: projectionSnap.size,
    recommendationProjectionCountsByConsumer,
  };
}

async function buildAthleteSummary(
  enrollment: PulseCheckPilotEnrollment,
  cohortMap: Map<string, PulseCheckPilotCohort>,
  teamMembershipMap: Map<string, PulseCheckTeamMembership>
): Promise<PilotDashboardAthleteSummary> {
  const teamMembership = teamMembershipMap.get(enrollment.userId) || null;
  const cohort = normalizeString(enrollment.cohortId) ? cohortMap.get(normalizeString(enrollment.cohortId)) || null : null;
  const engineSummary = await loadEngineSummaryForAthlete(enrollment.userId);

  return {
    athleteId: enrollment.userId,
    displayName: buildAthleteLabel(teamMembership, enrollment),
    email: normalizeString(teamMembership?.email),
    pilotEnrollment: enrollment,
    teamMembership,
    cohort,
    engineSummary,
  };
}

async function listPilotHypotheses(pilotId: string): Promise<PulseCheckPilotHypothesis[]> {
  const snapshot = await getDocs(
    query(collection(db, PILOT_HYPOTHESES_COLLECTION), where('pilotId', '==', normalizeString(pilotId)))
  );
  return sortHypotheses(snapshot.docs.map((docSnap) => toHypothesis(docSnap.id, docSnap.data() as Record<string, any>)));
}

function buildHypothesisSummary(hypotheses: PulseCheckPilotHypothesis[]): PilotDashboardHypothesisSummary {
  return {
    notEnoughDataCount: hypotheses.filter((hypothesis) => hypothesis.status === 'not-enough-data').length,
    promisingCount: hypotheses.filter((hypothesis) => hypothesis.status === 'promising').length,
    mixedCount: hypotheses.filter((hypothesis) => hypothesis.status === 'mixed').length,
    notSupportedCount: hypotheses.filter((hypothesis) => hypothesis.status === 'not-supported').length,
    highConfidenceCount: hypotheses.filter((hypothesis) => hypothesis.confidenceLevel === 'high').length,
  };
}

function buildCohortSummaries(
  pilotCohorts: PulseCheckPilotCohort[],
  athletes: PilotDashboardAthleteSummary[]
): PilotDashboardCohortSummary[] {
  const summaries: PilotDashboardCohortSummary[] = pilotCohorts.map((cohort) => {
    const cohortAthletes = athletes.filter((athlete) => athlete.pilotEnrollment.cohortId === cohort.id);
    return {
      cohortId: cohort.id,
      cohortName: cohort.name || 'Unnamed cohort',
      cohortStatus: cohort.status,
      activeAthleteCount: cohortAthletes.length,
      athletesWithEngineRecord: cohortAthletes.filter((athlete) => athlete.engineSummary.hasEngineRecord).length,
      athletesWithStablePatterns: cohortAthletes.filter((athlete) => athlete.engineSummary.stablePatternCount > 0).length,
      totalEvidenceRecords: cohortAthletes.reduce((sum, athlete) => sum + athlete.engineSummary.evidenceRecordCount, 0),
      totalPatternModels: cohortAthletes.reduce((sum, athlete) => sum + athlete.engineSummary.patternModelCount, 0),
      totalRecommendationProjections: cohortAthletes.reduce(
        (sum, athlete) => sum + athlete.engineSummary.recommendationProjectionCount,
        0
      ),
    };
  });

  const unassignedAthletes = athletes.filter((athlete) => !normalizeString(athlete.pilotEnrollment.cohortId));
  if (unassignedAthletes.length > 0) {
    summaries.push({
      cohortId: 'unassigned',
      cohortName: 'Unassigned',
      cohortStatus: 'active',
      activeAthleteCount: unassignedAthletes.length,
      athletesWithEngineRecord: unassignedAthletes.filter((athlete) => athlete.engineSummary.hasEngineRecord).length,
      athletesWithStablePatterns: unassignedAthletes.filter((athlete) => athlete.engineSummary.stablePatternCount > 0).length,
      totalEvidenceRecords: unassignedAthletes.reduce((sum, athlete) => sum + athlete.engineSummary.evidenceRecordCount, 0),
      totalPatternModels: unassignedAthletes.reduce((sum, athlete) => sum + athlete.engineSummary.patternModelCount, 0),
      totalRecommendationProjections: unassignedAthletes.reduce(
        (sum, athlete) => sum + athlete.engineSummary.recommendationProjectionCount,
        0
      ),
    });
  }

  return summaries.sort((left, right) => left.cohortName.localeCompare(right.cohortName));
}

async function loadDirectoryEngineMetrics(activeEnrollments: PulseCheckPilotEnrollment[]) {
  const summaries = await Promise.all(activeEnrollments.map((enrollment) => loadEngineSummaryForAthlete(enrollment.userId)));
  const athletesWithEngineRecord = summaries.filter((summary) => summary.hasEngineRecord).length;
  const athletesWithStablePatterns = summaries.filter((summary) => summary.stablePatternCount > 0).length;
  const totalEvidenceRecords = summaries.reduce((sum, summary) => sum + summary.evidenceRecordCount, 0);
  const totalRecommendationProjections = summaries.reduce((sum, summary) => sum + summary.recommendationProjectionCount, 0);

  return {
    engineCoverageRate: toPercentage(athletesWithEngineRecord, activeEnrollments.length),
    stablePatternRate: toPercentage(athletesWithStablePatterns, activeEnrollments.length),
    avgEvidenceRecordsPerActiveAthlete: toAverage(totalEvidenceRecords, activeEnrollments.length),
    avgRecommendationProjectionsPerActiveAthlete: toAverage(totalRecommendationProjections, activeEnrollments.length),
  };
}

function buildRecentPatternItems(patternDocs: Array<Record<string, any>>): PilotDashboardRecentPattern[] {
  return patternDocs
    .sort((left, right) => toTimeMs(right.updatedAt) - toTimeMs(left.updatedAt))
    .slice(0, 5)
    .map((data) => ({
      patternKey: normalizeString(data.patternKey),
      patternFamily: data.patternFamily,
      targetDomain: data.targetDomain,
      confidenceTier: data.confidenceTier,
      confidenceScore: typeof data.confidenceScore === 'number' ? data.confidenceScore : 0,
      freshnessTier: data.freshnessTier,
      recommendationEligibility: data.recommendationEligibility,
      athleteSummary: normalizeString(data.athleteSummary),
      coachSummary: normalizeString(data.coachSummary),
      observedRelationship: normalizeString(data.observedRelationship),
      lastValidatedAt: toTimeValue(data.lastValidatedAt),
      updatedAt: toTimeValue(data.updatedAt),
    }));
}

function buildRecentProjectionItems(projectionDocs: Array<Record<string, any>>): PilotDashboardRecentProjection[] {
  return projectionDocs
    .sort((left, right) => toTimeMs(right.generatedAt || right.updatedAt) - toTimeMs(left.generatedAt || left.updatedAt))
    .slice(0, 5)
    .map((data) => ({
      projectionKey: normalizeString(data.projectionKey),
      consumer: data.consumer,
      projectionDate: normalizeString(data.projectionDate),
      generatedAt: toTimeValue(data.generatedAt || data.updatedAt),
      warningLevel: data.warningLevel || 'none',
      confidenceTier: data.confidenceTier,
      confidenceDisplay: normalizeString(data.confidenceDisplay),
      summaryTitle: normalizeString(data.summaryTitle),
      summaryBody: normalizeString(data.summaryBody),
      sourceSummary: normalizeString(data.sourceSummary),
    }));
}

function buildRecentEvidenceItems(evidenceDocs: Array<Record<string, any>>): PilotDashboardRecentEvidence[] {
  return evidenceDocs
    .sort((left, right) => toTimeMs(right.createdAt || right.updatedAt) - toTimeMs(left.createdAt || left.updatedAt))
    .slice(0, 5)
    .map((data) => ({
      evidenceId: normalizeString(data.evidenceId),
      athleteLocalDate: normalizeString(data.athleteLocalDate),
      sourceFamily: normalizeString(data.physiology?.sourceFamily),
      freshness: normalizeString(data.physiology?.freshness),
      dataConfidence: data.quality?.dataConfidence || 'directional',
      alignmentType: normalizeString(data.alignment?.alignmentType),
      sessionTimestamp: toTimeValue(data.simOutcome?.sessionTimestamp),
      skillDomain: normalizeString(data.simOutcome?.skillDomain) || null,
      pillarDomain: normalizeString(data.simOutcome?.pillarDomain) || null,
      coreMetricName: normalizeString(data.simOutcome?.coreMetricName) || null,
    }));
}

function buildSnapshotHistoryItems(snapshotDocs: Array<Record<string, any>>): PilotDashboardSnapshotHistoryItem[] {
  return snapshotDocs
    .sort((left, right) => toTimeMs(right.capturedAt) - toTimeMs(left.capturedAt))
    .slice(0, 6)
    .map((data) => ({
      snapshotKey: normalizeString(data.snapshotKey),
      milestoneType: normalizeString(data.milestoneType),
      capturedAt: toTimeValue(data.capturedAt),
      currentEmphasis: normalizeString(data.profilePayload?.currentEmphasis),
      nextMilestone: normalizeString(data.profilePayload?.nextMilestone),
      trendSummary: normalizeString(data.profilePayload?.trendSummary),
      assessmentContextStatus:
        normalizeString(data.profilePayload?.stateContextAtCapture?.assessmentContextFlag?.status) || 'unknown',
      athleteSafeSummary: normalizeString(data.profilePayload?.stateContextAtCapture?.assessmentContextFlag?.athleteSafeSummary),
      coachDetailSummary: normalizeString(data.profilePayload?.stateContextAtCapture?.assessmentContextFlag?.coachDetailSummary),
    }));
}

async function getPilotInviteConfig(
  pilot: PulseCheckPilot,
  organizationName: string,
  teamName: string
): Promise<PulseCheckPilotInviteConfig> {
  const configRef = doc(db, PILOT_INVITE_CONFIGS_COLLECTION, pilot.id);
  const configSnap = await getDoc(configRef);
  if (!configSnap.exists()) {
    return buildDefaultInviteConfig(pilot, organizationName, teamName);
  }

  return toInviteConfig(configSnap.id, configSnap.data() as Record<string, any>, pilot, organizationName, teamName);
}

async function getTeamInviteDefault(teamId: string): Promise<PulseCheckPilotInviteDefaultConfig | null> {
  const normalizedTeamId = normalizeString(teamId);
  if (!normalizedTeamId) return null;
  const defaultRef = doc(db, TEAM_INVITE_DEFAULTS_COLLECTION, normalizedTeamId);
  const defaultSnap = await getDoc(defaultRef);
  if (!defaultSnap.exists()) return null;
  return toInviteDefaultConfig(defaultSnap.id, defaultSnap.data() as Record<string, any>, 'team');
}

async function getOrganizationInviteDefault(organizationId: string): Promise<PulseCheckPilotInviteDefaultConfig | null> {
  const normalizedOrganizationId = normalizeString(organizationId);
  if (!normalizedOrganizationId) return null;
  const defaultRef = doc(db, ORGANIZATION_INVITE_DEFAULTS_COLLECTION, normalizedOrganizationId);
  const defaultSnap = await getDoc(defaultRef);
  if (!defaultSnap.exists()) return null;
  return toInviteDefaultConfig(defaultSnap.id, defaultSnap.data() as Record<string, any>, 'organization');
}

function resolveInviteConfigWithInheritance(
  base: PulseCheckPilotInviteConfig,
  organizationDefault: PulseCheckPilotInviteDefaultConfig | null,
  teamDefault: PulseCheckPilotInviteDefaultConfig | null,
  pilotConfig: PulseCheckPilotInviteConfig
): PulseCheckPilotInviteConfig {
  return applyInviteConfigFields(
    applyInviteConfigFields(
      applyInviteConfigFields(base, organizationDefault as unknown as Record<string, any> | null),
      teamDefault as unknown as Record<string, any> | null
    ),
    pilotConfig as unknown as Record<string, any>
  );
}

async function loadAthleteTimelineItems(athleteId: string) {
  const [evidenceSnap, patternSnap, projectionSnap] = await Promise.all([
    getDocs(collection(db, ATHLETE_PHYSIOLOGY_COGNITION_COLLECTION, athleteId, CORRELATION_EVIDENCE_RECORDS_SUBCOLLECTION)),
    getDocs(collection(db, ATHLETE_PHYSIOLOGY_COGNITION_COLLECTION, athleteId, ATHLETE_PATTERN_MODELS_SUBCOLLECTION)),
    getDocs(collection(db, ATHLETE_PHYSIOLOGY_COGNITION_COLLECTION, athleteId, RECOMMENDATION_PROJECTIONS_SUBCOLLECTION)),
  ]);

  return {
    recentEvidence: buildRecentEvidenceItems(evidenceSnap.docs.map((docSnap) => docSnap.data() as Record<string, any>)),
    recentPatterns: buildRecentPatternItems(patternSnap.docs.map((docSnap) => docSnap.data() as Record<string, any>)),
    recentProjections: buildRecentProjectionItems(projectionSnap.docs.map((docSnap) => docSnap.data() as Record<string, any>)),
  };
}

export const pulseCheckPilotDashboardService = {
  isDemoModeEnabled(): boolean {
    return pilotDashboardDemoMode.isEnabled();
  },

  setDemoModeEnabled(enabled: boolean) {
    pilotDashboardDemoMode.setEnabled(enabled);
  },

  resetDemoModeData(): PilotDashboardDetail {
    return pilotDashboardDemoMode.reset();
  },

  getDemoPilotId(): string {
    return pilotDashboardDemoMode.getPilotId();
  },

  listDemoInviteLinks() {
    return pilotDashboardDemoMode.listInviteLinks();
  },

  createDemoInviteLink(input: {
    pilotId: string;
    pilotName: string;
    cohortId?: string;
    cohortName?: string;
    createdByUserId?: string;
    createdByEmail?: string;
  }) {
    return pilotDashboardDemoMode.createInviteLink(input);
  },

  revokeDemoInviteLink(inviteId: string) {
    return pilotDashboardDemoMode.revokeInviteLink(inviteId);
  },

  deleteDemoInviteLink(inviteId: string) {
    return pilotDashboardDemoMode.deleteInviteLink(inviteId);
  },

  assignDemoAthleteToCohort(input: {
    athleteId: string;
    cohortId?: string;
    actorUserId?: string;
    actorEmail?: string;
  }) {
    return pilotDashboardDemoMode.assignAthleteToCohort(input);
  },

  async listPilotHypotheses(pilotId: string): Promise<PulseCheckPilotHypothesis[]> {
    if (pilotDashboardDemoMode.isEnabled()) {
      return pilotDashboardDemoMode.getPilotDashboardDetail(pilotId)?.hypotheses || [];
    }
    return listPilotHypotheses(pilotId);
  },

  async seedDefaultHypotheses(pilotId: string): Promise<void> {
    if (pilotDashboardDemoMode.isEnabled()) {
      pilotDashboardDemoMode.seedDefaultHypotheses(DEFAULT_PILOT_HYPOTHESES);
      return;
    }
    const existing = await listPilotHypotheses(pilotId);
    if (existing.length > 0) return;

    await Promise.all(
      DEFAULT_PILOT_HYPOTHESES.map((hypothesis) =>
        setDoc(doc(db, PILOT_HYPOTHESES_COLLECTION, buildHypothesisId(pilotId, hypothesis.code)), {
          pilotId: normalizeString(pilotId),
          code: hypothesis.code,
          statement: hypothesis.statement,
          leadingIndicator: hypothesis.leadingIndicator,
          status: 'not-enough-data',
          confidenceLevel: 'low',
          keyEvidence: '',
          notes: '',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          lastReviewedAt: null,
        })
      )
    );
  },

  async saveHypothesis(input: PulseCheckPilotHypothesisInput): Promise<string> {
    if (pilotDashboardDemoMode.isEnabled()) {
      return pilotDashboardDemoMode.saveHypothesis(input);
    }
    const id = normalizeString(input.id) || buildHypothesisId(input.pilotId, input.code);
    const hypothesisRef = doc(db, PILOT_HYPOTHESES_COLLECTION, id);
    const existingSnap = await getDoc(hypothesisRef);
    await setDoc(
      hypothesisRef,
      {
        pilotId: normalizeString(input.pilotId),
        code: normalizeString(input.code),
        statement: normalizeString(input.statement),
        leadingIndicator: normalizeString(input.leadingIndicator),
        status: input.status,
        confidenceLevel: input.confidenceLevel,
        keyEvidence: normalizeString(input.keyEvidence),
        notes: normalizeString(input.notes),
        updatedAt: serverTimestamp(),
        lastReviewedAt: serverTimestamp(),
        ...(existingSnap.exists() ? {} : { createdAt: serverTimestamp() }),
      },
      { merge: true }
    );
    return id;
  },

  async generatePilotHypothesisAssist(input: {
    frame: PilotHypothesisAssistFrame;
    options: PilotHypothesisAssistGenerationInput;
  }): Promise<PilotHypothesisAssistGenerationResult> {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error('Authenticated admin session required.');
    }

    const idToken = await currentUser.getIdToken();
    const response = await fetch('/api/admin/pulsecheck/pilot-hypothesis-assist/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
        'x-admin-email': currentUser.email || '',
      },
      body: JSON.stringify(input),
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(payload?.error || 'Failed to generate pilot hypothesis suggestions.');
    }

    return {
      suggestions: Array.isArray(payload?.suggestions) ? payload.suggestions : [],
      modelVersion: normalizeString(payload?.modelVersion) || 'unknown',
      promptVersion: normalizeString(payload?.promptVersion) || 'pilot-hypothesis-assist-v1',
    };
  },

  async saveInviteConfig(input: PulseCheckPilotInviteConfigInput): Promise<string> {
    if (pilotDashboardDemoMode.isEnabled()) {
      return pilotDashboardDemoMode.saveInviteConfig(input);
    }
    const configRef = doc(db, PILOT_INVITE_CONFIGS_COLLECTION, normalizeString(input.pilotId));
    const existingSnap = await getDoc(configRef);
    await setDoc(
      configRef,
      {
        pilotId: normalizeString(input.pilotId),
        organizationId: normalizeString(input.organizationId),
        teamId: normalizeString(input.teamId),
        welcomeHeadline: normalizeString(input.welcomeHeadline),
        welcomeBody: normalizeString(input.welcomeBody),
        existingAthleteInstructions: normalizeString(input.existingAthleteInstructions),
        newAthleteInstructions: normalizeString(input.newAthleteInstructions),
        wearableRequirements: normalizeString(input.wearableRequirements),
        baselineExpectations: normalizeString(input.baselineExpectations),
        supportName: normalizeString(input.supportName),
        supportEmail: normalizeString(input.supportEmail),
        supportPhone: normalizeString(input.supportPhone),
        iosAppUrl: normalizeString(input.iosAppUrl),
        androidAppUrl: normalizeString(input.androidAppUrl),
        updatedAt: serverTimestamp(),
        ...(existingSnap.exists() ? {} : { createdAt: serverTimestamp() }),
      },
      { merge: true }
    );

    return configRef.id;
  },

  async savePilotRequiredConsents(input: PulseCheckPilotRequiredConsentInput): Promise<void> {
    if (pilotDashboardDemoMode.isEnabled()) {
      return;
    }

    const pilotRef = doc(db, 'pulsecheck-pilots', normalizeString(input.pilotId));
    await setDoc(
      pilotRef,
      {
        requiredConsents: normalizePilotRequiredConsentPayload(input.requiredConsents),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  },

  async saveInviteDefault(input: PulseCheckPilotInviteDefaultConfigInput): Promise<string> {
    if (pilotDashboardDemoMode.isEnabled()) {
      return pilotDashboardDemoMode.saveInviteDefault(input);
    }
    const scopeId = input.scopeType === 'team' ? normalizeString(input.teamId) : normalizeString(input.organizationId);
    const collectionName = input.scopeType === 'team' ? TEAM_INVITE_DEFAULTS_COLLECTION : ORGANIZATION_INVITE_DEFAULTS_COLLECTION;
    const configRef = doc(db, collectionName, scopeId);
    const existingSnap = await getDoc(configRef);

    await setDoc(
      configRef,
      {
        scopeType: input.scopeType,
        organizationId: normalizeString(input.organizationId),
        teamId: normalizeString(input.teamId),
        welcomeHeadline: normalizeString(input.welcomeHeadline),
        welcomeBody: normalizeString(input.welcomeBody),
        existingAthleteInstructions: normalizeString(input.existingAthleteInstructions),
        newAthleteInstructions: normalizeString(input.newAthleteInstructions),
        wearableRequirements: normalizeString(input.wearableRequirements),
        baselineExpectations: normalizeString(input.baselineExpectations),
        supportName: normalizeString(input.supportName),
        supportEmail: normalizeString(input.supportEmail),
        supportPhone: normalizeString(input.supportPhone),
        iosAppUrl: normalizeString(input.iosAppUrl),
        androidAppUrl: normalizeString(input.androidAppUrl),
        updatedAt: serverTimestamp(),
        ...(existingSnap.exists() ? {} : { createdAt: serverTimestamp() }),
      },
      { merge: true }
    );

    return configRef.id;
  },

  async resetInviteConfigOverride(pilotId: string): Promise<void> {
    if (pilotDashboardDemoMode.isEnabled()) {
      pilotDashboardDemoMode.resetInviteConfigOverride();
      return;
    }
    const normalizedPilotId = normalizeString(pilotId);
    if (!normalizedPilotId) {
      throw new Error('Pilot id is required to reset invite config override.');
    }

    await deleteDoc(doc(db, PILOT_INVITE_CONFIGS_COLLECTION, normalizedPilotId));
  },

  async listPilotResearchReadouts(pilotId: string): Promise<PilotResearchReadout[]> {
    if (pilotDashboardDemoMode.isEnabled()) {
      return pilotDashboardDemoMode.getPilotDashboardDetail(pilotId)?.researchReadouts || [];
    }
    const normalizedPilotId = normalizeString(pilotId);
    if (!normalizedPilotId) return [];
    const readoutSnap = await getDocs(query(collection(db, PILOT_RESEARCH_READOUTS_COLLECTION), where('pilotId', '==', normalizedPilotId)));
    return sortResearchReadouts(
      readoutSnap.docs.map((docSnap) => toResearchReadout(docSnap.id, docSnap.data() as Record<string, any>))
    );
  },

  async generatePilotResearchReadout(input: {
    frame: Record<string, any>;
    options: PilotResearchReadoutGenerationInput;
  }): Promise<{ readoutId: string }> {
    if (pilotDashboardDemoMode.isEnabled()) {
      return pilotDashboardDemoMode.generatePilotResearchReadout(input);
    }
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error('Authenticated admin session required.');
    }

    const idToken = await currentUser.getIdToken();
    const response = await fetch('/api/admin/pulsecheck/pilot-research-readout/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
        'x-admin-email': currentUser.email || '',
      },
      body: JSON.stringify(input),
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(payload?.error || 'Failed to generate pilot research readout.');
    }

    return {
      readoutId: normalizeString(payload?.readoutId),
    };
  },

  async updatePilotResearchReadoutReview(input: PilotResearchReadoutReviewInput): Promise<void> {
    if (pilotDashboardDemoMode.isEnabled()) {
      pilotDashboardDemoMode.updatePilotResearchReadoutReview(input, auth.currentUser?.email || '');
      return;
    }
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error('Authenticated admin session required.');
    }

    const idToken = await currentUser.getIdToken();
    const response = await fetch('/api/admin/pulsecheck/pilot-research-readout/review', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
        'x-admin-email': currentUser.email || '',
      },
      body: JSON.stringify(input),
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(payload?.error || 'Failed to update pilot research readout review.');
    }
  },

  async recordPilotSurveyResponse(input: {
    pilotId: string;
    pilotEnrollmentId?: string;
    cohortId?: string;
    teamId: string;
    organizationId: string;
    athleteId?: string;
    respondentRole: 'athlete' | 'coach' | 'clinician';
    surveyKind: 'trust' | 'nps';
    score: number;
    comment?: string;
    trustBattery?: PulseCheckPilotOutcomeTrustBatteryPayload | null;
    source?: 'ios' | 'android' | 'web-admin';
  }): Promise<PulseCheckPilotOutcomeSurveyResponse> {
    if (pilotDashboardDemoMode.isEnabled()) {
      return {
        id: `demo-survey-${Date.now()}`,
        pilotId: input.pilotId,
        pilotEnrollmentId: input.pilotEnrollmentId || null,
        organizationId: input.organizationId,
        teamId: input.teamId,
        cohortId: input.cohortId || null,
        respondentUserId: auth.currentUser?.uid || 'demo-user',
        respondentRole: input.respondentRole,
        surveyKind: input.surveyKind,
        score: input.score,
        comment: input.comment,
        source: input.source || 'web-admin',
        submittedAt: Date.now(),
        trustBattery: (input.trustBattery as any) || null,
      };
    }

    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error('Authenticated admin session required.');
    }

    const idToken = await currentUser.getIdToken();
    const response = await fetch('/.netlify/functions/record-pilot-survey-response', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        ...input,
        source: input.source || 'web-admin',
      }),
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(payload?.error || 'Failed to record pilot survey response.');
    }

    return payload?.response as PulseCheckPilotOutcomeSurveyResponse;
  },

  async saveOutcomeReleaseSettings(input: {
    pilotId: string;
    outcomesEnabled: boolean;
    rolloutStage?: 'disabled' | 'staged' | 'live';
    rolloutNotes?: string;
  }): Promise<void> {
    const currentUser = auth.currentUser;
    const normalizedPilotId = normalizeString(input.pilotId);
    if (!normalizedPilotId) {
      throw new Error('pilotId is required.');
    }

    await setDoc(
      doc(db, PULSECHECK_PILOT_OUTCOME_RELEASE_SETTINGS_COLLECTION, normalizedPilotId),
      {
        pilotId: normalizedPilotId,
        outcomesEnabled: Boolean(input.outcomesEnabled),
        rolloutStage: normalizeString(input.rolloutStage) || (input.outcomesEnabled ? 'live' : 'disabled'),
        rolloutNotes: normalizeString(input.rolloutNotes),
        updatedAt: serverTimestamp(),
        updatedByUserId: currentUser?.uid || null,
        updatedByEmail: currentUser?.email || null,
      },
      { merge: true }
    );
  },

  async triggerPilotOutcomeRollupRecompute(input: {
    pilotId: string;
    lookbackDays?: number;
  }): Promise<Record<string, any>> {
    if (pilotDashboardDemoMode.isEnabled()) {
      return {
        success: true,
        demoMode: true,
      };
    }

    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error('Authenticated admin session required.');
    }

    const idToken = await currentUser.getIdToken();
    const response = await fetch('/.netlify/functions/recompute-pilot-outcome-rollups', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        pilotId: input.pilotId,
        lookbackDays: input.lookbackDays || 30,
      }),
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(payload?.error || 'Failed to recompute pilot outcome rollups.');
    }

    return payload || { success: true };
  },

  async listActivePilotDirectory(): Promise<PilotDashboardDirectoryEntry[]> {
    if (pilotDashboardDemoMode.isEnabled()) {
      return pilotDashboardDemoMode.listActivePilotDirectory();
    }
    const [organizations, teams, pilots, cohorts, enrollments, hypotheses] = await Promise.all([
      pulseCheckProvisioningService.listOrganizations(),
      pulseCheckProvisioningService.listTeams(),
      pulseCheckProvisioningService.listPilots(),
      pulseCheckProvisioningService.listPilotCohorts(),
      pulseCheckProvisioningService.listPilotEnrollments(),
      getDocs(collection(db, PILOT_HYPOTHESES_COLLECTION)),
    ]);

    const organizationMap = new Map(organizations.map((organization) => [organization.id, organization]));
    const teamMap = new Map(teams.map((team) => [team.id, team]));
    const cohortsByPilot = new Map<string, PulseCheckPilotCohort[]>();
    const enrollmentsByPilot = new Map<string, PulseCheckPilotEnrollment[]>();
    const hypothesesByPilot = new Map<string, PulseCheckPilotHypothesis[]>();

    cohorts.forEach((cohort) => {
      const current = cohortsByPilot.get(cohort.pilotId) || [];
      current.push(cohort);
      cohortsByPilot.set(cohort.pilotId, current);
    });

    enrollments.forEach((enrollment) => {
      const current = enrollmentsByPilot.get(enrollment.pilotId) || [];
      current.push(enrollment);
      enrollmentsByPilot.set(enrollment.pilotId, current);
    });

    hypotheses.docs.forEach((docSnap) => {
      const hypothesis = toHypothesis(docSnap.id, docSnap.data() as Record<string, any>);
      const current = hypothesesByPilot.get(hypothesis.pilotId) || [];
      current.push(hypothesis);
      hypothesesByPilot.set(hypothesis.pilotId, current);
    });

    const metadataActivePilotCount = pilots.filter((pilot) => isActivePilotDashboardScope(pilot)).length;
    const baseEntries = pilots
      .map((pilot) => {
        const pilotCohorts = cohortsByPilot.get(pilot.id) || [];
        const pilotEnrollments = enrollmentsByPilot.get(pilot.id) || [];
        if (!isPilotOperationallyActive(pilot, pilotCohorts, pilotEnrollments)) return null;

        const organization = organizationMap.get(pilot.organizationId);
        const team = teamMap.get(pilot.teamId);
        if (!organization || !team) return null;

        const pilotHypotheses = hypothesesByPilot.get(pilot.id) || [];
        const activeEnrollments = pilotEnrollments.filter((enrollment) => enrollment.status === 'active');
        const hypothesisSummary = buildHypothesisSummary(pilotHypotheses);

        return {
          organization,
          team,
          pilot,
          cohorts: pilotCohorts,
          totalEnrollmentCount: pilotEnrollments.length,
          activeEnrollmentCount: activeEnrollments.length,
          activeCohortCount: pilotCohorts.filter((cohort) => cohort.status === 'active').length,
          hypothesisCount: pilotHypotheses.length,
          unsupportedHypothesisCount: pilotHypotheses.filter((hypothesis) => hypothesis.status === 'not-supported').length,
          promisingHypothesisCount: hypothesisSummary.promisingCount,
          highConfidenceHypothesisCount: hypothesisSummary.highConfidenceCount,
          engineCoverageRate: 0,
          stablePatternRate: 0,
          avgEvidenceRecordsPerActiveAthlete: 0,
          avgRecommendationProjectionsPerActiveAthlete: 0,
          _activeEnrollments: activeEnrollments,
        };
      })
      .filter(Boolean) as Array<PilotDashboardDirectoryEntry & { _activeEnrollments: PulseCheckPilotEnrollment[] }>;

    if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
      console.info('[PilotDashboard] Directory source counts', {
        organizations: organizations.length,
        teams: teams.length,
        pilots: pilots.length,
        metadataActivePilots: metadataActivePilotCount,
        operationallyActivePilots: pilots.filter((pilot) =>
          isPilotOperationallyActive(pilot, cohortsByPilot.get(pilot.id) || [], enrollmentsByPilot.get(pilot.id) || [])
        ).length,
        entriesAfterJoin: baseEntries.length,
      });
    }

    const enrichedEntries = await Promise.all(
      baseEntries.map(async (entry) => {
        const [directoryMetrics, outcomeRollup, outcomeReleaseSettings] = await Promise.all([
          loadDirectoryEngineMetrics(entry._activeEnrollments),
          loadCurrentOutcomeRollup(entry.pilot.id),
          loadPilotOutcomeReleaseSettings(entry.pilot.id),
        ]);
        const outcomesEnabled = outcomeReleaseSettings?.outcomesEnabled !== false;
        return {
          ...entry,
          ...directoryMetrics,
          outcomeMetrics: outcomesEnabled ? outcomeRollup?.metrics : undefined,
          outcomeDiagnostics: outcomesEnabled ? ((outcomeRollup?.diagnostics?.surveys as PilotDashboardOutcomeSurveyDiagnostics) || undefined) : undefined,
          hypothesisEvaluation: outcomesEnabled ? ((outcomeRollup?.diagnostics?.hypothesisEvaluation as any) || undefined) : undefined,
        };
      })
    );

    return enrichedEntries
      .map(({ _activeEnrollments, ...entry }) => entry)
      .sort(
        (left, right) =>
          left.organization.displayName.localeCompare(right.organization.displayName) ||
          left.team.displayName.localeCompare(right.team.displayName) ||
          left.pilot.name.localeCompare(right.pilot.name)
      );
  },

  async getPilotDashboardDetail(pilotId: string): Promise<PilotDashboardDetail | null> {
    if (pilotDashboardDemoMode.isEnabled()) {
      return pilotDashboardDemoMode.getPilotDashboardDetail(pilotId);
    }
    const pilot = await pulseCheckProvisioningService.getPilot(pilotId);
    if (!pilot) return null;

    const [organization, team, cohorts, enrollments, teamMemberships, hypotheses] = await Promise.all([
      pulseCheckProvisioningService.getOrganization(pilot.organizationId),
      pulseCheckProvisioningService.getTeam(pilot.teamId),
      pulseCheckProvisioningService.listPilotCohorts(),
      pulseCheckProvisioningService.listPilotEnrollmentsByPilot(pilot.id),
      pulseCheckProvisioningService.listTeamMemberships(pilot.teamId),
      listPilotHypotheses(pilot.id),
    ]);

    if (!organization || !team) return null;

    const pilotCohorts = cohorts.filter((cohort) => cohort.pilotId === pilot.id);
    if (!isPilotOperationallyActive(pilot, pilotCohorts, enrollments)) return null;
    const cohortMap = new Map(pilotCohorts.map((cohort) => [cohort.id, cohort]));
    const teamMembershipMap = new Map(teamMemberships.map((membership) => [membership.userId, membership]));
    const activeEnrollments = enrollments.filter((enrollment) => enrollment.status === 'active');
    const athletes = await Promise.all(
      activeEnrollments.map((enrollment) => buildAthleteSummary(enrollment, cohortMap, teamMembershipMap))
    );
    const totalEvidenceRecords = athletes.reduce((sum, athlete) => sum + athlete.engineSummary.evidenceRecordCount, 0);
    const totalPatternModels = athletes.reduce((sum, athlete) => sum + athlete.engineSummary.patternModelCount, 0);
    const totalRecommendationProjections = athletes.reduce(
      (sum, athlete) => sum + athlete.engineSummary.recommendationProjectionCount,
      0
    );
    const athletesWithEngineRecord = athletes.filter((athlete) => athlete.engineSummary.hasEngineRecord).length;
    const athletesWithStablePatterns = athletes.filter((athlete) => athlete.engineSummary.stablePatternCount > 0).length;

    const metrics = {
      totalEnrollmentCount: enrollments.length,
      activeAthleteCount: activeEnrollments.length,
      cohortCount: pilotCohorts.length,
      athletesWithEngineRecord,
      athletesWithStablePatterns,
      totalEvidenceRecords,
      totalPatternModels,
      totalRecommendationProjections,
      unsupportedHypotheses: hypotheses.filter((hypothesis) => hypothesis.status === 'not-supported').length,
      hypothesisCount: hypotheses.length,
    };
    const coverage = {
      engineCoverageRate: toPercentage(athletesWithEngineRecord, activeEnrollments.length),
      stablePatternRate: toPercentage(athletesWithStablePatterns, activeEnrollments.length),
      avgEvidenceRecordsPerActiveAthlete: toAverage(totalEvidenceRecords, activeEnrollments.length),
      avgPatternModelsPerActiveAthlete: toAverage(totalPatternModels, activeEnrollments.length),
      avgRecommendationProjectionsPerActiveAthlete: toAverage(totalRecommendationProjections, activeEnrollments.length),
    };
    const cohortSummaries = buildCohortSummaries(pilotCohorts, athletes);
    const hypothesisSummary = buildHypothesisSummary(hypotheses);
    const [organizationInviteConfigDefault, teamInviteConfigDefault, pilotInviteConfig, readouts, outcomeRollup, outcomeReleaseSettings, outcomeOpsStatus] = await Promise.all([
      getOrganizationInviteDefault(pilot.organizationId),
      getTeamInviteDefault(pilot.teamId),
      getPilotInviteConfig(pilot, organization.displayName, team.displayName),
      this.listPilotResearchReadouts(pilot.id),
      loadCurrentOutcomeRollup(pilot.id),
      loadPilotOutcomeReleaseSettings(pilot.id),
      loadPilotOutcomeOpsStatus(pilot.id),
    ]);
    const pilotConfigRef = doc(db, PILOT_INVITE_CONFIGS_COLLECTION, pilot.id);
    const pilotConfigSnap = await getDoc(pilotConfigRef);
    const inviteConfig = resolveInviteConfigWithInheritance(
      buildDefaultInviteConfig(pilot, organization.displayName, team.displayName),
      organizationInviteConfigDefault,
      teamInviteConfigDefault,
      pilotInviteConfig
    );

    const outcomesEnabled = outcomeReleaseSettings?.outcomesEnabled !== false;

    return {
      organization,
      team,
      pilot,
      cohorts: pilotCohorts,
      athletes: athletes.sort((left, right) => left.displayName.localeCompare(right.displayName)),
      hypotheses,
      metrics,
      coverage,
      cohortSummaries,
      hypothesisSummary,
      inviteConfig,
      hasPilotInviteConfigOverride: pilotConfigSnap.exists(),
      teamInviteConfigDefault,
      organizationInviteConfigDefault,
      outcomeMetrics: outcomesEnabled ? outcomeRollup?.metrics : undefined,
      outcomeMetricsByCohort: outcomesEnabled ? ((outcomeRollup?.outcomeByCohort as Record<string, PilotDashboardOutcomeMetrics>) || undefined) : undefined,
      outcomeDiagnostics: outcomesEnabled ? ((outcomeRollup?.diagnostics?.surveys as PilotDashboardOutcomeSurveyDiagnostics) || undefined) : undefined,
      outcomeDiagnosticsByCohort:
        outcomesEnabled ? ((outcomeRollup?.diagnostics?.surveysByCohort as Record<string, PilotDashboardOutcomeSurveyDiagnostics>) || undefined) : undefined,
      outcomeOperationalDiagnostics: outcomesEnabled ? ((outcomeRollup?.diagnostics as Record<string, any>) || undefined) : undefined,
      outcomeRecommendationTypeSlices: outcomesEnabled ? ((outcomeRollup?.diagnostics?.recommendationTypeSlices as Record<string, any>) || undefined) : undefined,
      outcomeRecommendationTypeSlicesByCohort:
        outcomesEnabled ? ((outcomeRollup?.diagnostics?.recommendationTypeSlicesByCohort as Record<string, Record<string, any>>) || undefined) : undefined,
      outcomeTrustDispositionBaseline: outcomesEnabled ? ((outcomeRollup?.diagnostics?.trustDispositionBaseline as Record<string, any>) || undefined) : undefined,
      outcomeReleaseSettings: outcomeReleaseSettings || undefined,
      outcomeOpsStatus: outcomeOpsStatus || undefined,
      hypothesisEvaluation: outcomesEnabled ? ((outcomeRollup?.diagnostics?.hypothesisEvaluation as any) || undefined) : undefined,
      hypothesisEvaluationByCohort: outcomesEnabled ? ((outcomeRollup?.diagnostics?.hypothesisEvaluationByCohort as any) || undefined) : undefined,
      latestResearchReadout: readouts[0] || null,
      researchReadouts: readouts,
    };
  },

  async getPilotAthleteDetail(pilotId: string, athleteId: string): Promise<PilotDashboardAthleteDetail | null> {
    if (pilotDashboardDemoMode.isEnabled()) {
      return pilotDashboardDemoMode.getPilotAthleteDetail(pilotId, athleteId);
    }
    const pilot = await pulseCheckProvisioningService.getPilot(pilotId);
    if (!pilot) return null;

    const [organization, team, enrollment, cohorts, teamMemberships, engineSummary] = await Promise.all([
      pulseCheckProvisioningService.getOrganization(pilot.organizationId),
      pulseCheckProvisioningService.getTeam(pilot.teamId),
      pulseCheckProvisioningService.getPilotEnrollment(pilotId, athleteId),
      pulseCheckProvisioningService.listPilotCohorts(),
      pulseCheckProvisioningService.listTeamMemberships(pilot.teamId),
      loadEngineSummaryForAthlete(athleteId),
    ]);

    const pilotCohorts = cohorts.filter((entry) => entry.pilotId === pilotId);
    if (!isPilotOperationallyActive(pilot, pilotCohorts, enrollment ? [enrollment] : [])) return null;
    if (!organization || !team || !enrollment || enrollment.status !== 'active') return null;

    const teamMembership = teamMemberships.find((membership) => membership.userId === athleteId) || null;
    const cohort = pilotCohorts.find((entry) => entry.id === enrollment.cohortId) || null;
    const timelineItems = await loadAthleteTimelineItems(athleteId);
    const snapshotQuery = query(
      collection(db, ATHLETE_MENTAL_PROGRESS_COLLECTION, athleteId, PROFILE_SNAPSHOTS_SUBCOLLECTION),
      where('pilotEnrollmentId', '==', enrollment.id)
    );
    const snapshotSnap = await getDocs(snapshotQuery);
    const snapshots = snapshotSnap.docs.map((docSnap) => docSnap.data() as Record<string, any>);
    const latestSnapshot = [...snapshots].sort((left, right) => {
      const leftTime = toDate(left.capturedAt)?.getTime() || 0;
      const rightTime = toDate(right.capturedAt)?.getTime() || 0;
      return rightTime - leftTime;
    })[0];
    const latestAssessmentContextFlagStatus =
      normalizeString(latestSnapshot?.profilePayload?.stateContextAtCapture?.assessmentContextFlag?.status) || 'unknown';

    const mentalPerformanceSnapshots = await loadPilotMentalPerformanceSnapshotSet(enrollment.id);

    return {
      organization,
      team,
      pilot,
      cohort,
      pilotEnrollment: enrollment,
      teamMembership,
      displayName: buildAthleteLabel(teamMembership, enrollment),
      email: normalizeString(teamMembership?.email),
      engineSummary,
      profileSnapshotCount: snapshots.length,
      latestAssessmentContextFlagStatus,
      latestAssessmentCapturedAt: toTimeValue(latestSnapshot?.capturedAt),
      mentalPerformanceSnapshots,
      recentPatterns: timelineItems.recentPatterns,
      recentProjections: timelineItems.recentProjections,
      recentEvidence: timelineItems.recentEvidence,
      snapshotHistory: buildSnapshotHistoryItems(snapshots),
    };
  },
};
