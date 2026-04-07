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
import { auth, getFirebaseModeRequestHeaders } from '../config';
import {
  ATHLETE_MENTAL_PROGRESS_COLLECTION,
  ATHLETE_PATTERN_MODELS_SUBCOLLECTION,
  ATHLETE_PHYSIOLOGY_COGNITION_COLLECTION,
  CORRELATION_EVIDENCE_RECORDS_SUBCOLLECTION,
  PULSECHECK_ASSIGNMENT_EVENTS_COLLECTION,
  PULSECHECK_DAILY_ASSIGNMENTS_COLLECTION,
  PULSECHECK_PILOT_METRIC_OPS_COLLECTION,
  PULSECHECK_PILOT_METRIC_ROLLUP_SUMMARY_SUBCOLLECTION,
  PULSECHECK_PILOT_METRIC_ROLLUPS_COLLECTION,
  PULSECHECK_PILOT_MENTAL_PERFORMANCE_SNAPSHOTS_SUBCOLLECTION,
  PULSECHECK_PILOT_OUTCOME_RELEASE_SETTINGS_COLLECTION,
  PROFILE_SNAPSHOTS_SUBCOLLECTION,
  RECOMMENDATION_PROJECTIONS_SUBCOLLECTION,
  SIM_CHECKINS_ROOT,
} from '../mentaltraining/collections';
import { resolvePulseCheckFunctionUrl } from '../mentaltraining/pulseCheckFunctionsUrl';
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
  PilotDashboardAthleteProfileSummary,
  PilotDashboardAthleteAdherenceDay,
  PilotDashboardAthleteAdherenceSummary,
  PilotDashboardAthleteEscalationDetail,
  PilotDashboardOutcomeMetricRollup,
  PilotDashboardOutcomeMetrics,
  PilotDashboardOutcomeOperationalDiagnostics,
  PilotDashboardOutcomeSurveyDiagnostics,
  PilotDashboardAthleteSummary,
  PilotDashboardRosterAthleteSummary,
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
  PilotDashboardOperationalStatus,
  PilotDashboardOperationalWatchListLifecycleStatus,
  PilotDashboardOperationalWatchListReasonCode,
  PilotDashboardOperationalWatchListRestrictionFlags,
  PilotDashboardOperationalWatchListSource,
  PilotDashboardOperationalWatchListState,
  PilotDashboardOperationalWatchListSummary,
  PilotDashboardTimeValue,
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
const ESCALATION_RECORDS_COLLECTION = 'escalation-records';
const PILOT_OPERATIONAL_STATE_COLLECTION = 'pulsecheck-pilot-operational-states';
const CHECKINS_SUBCOLLECTION = 'check-ins';
const ADHERENCE_ACTIVATION_DAY_CUTOFF_HOUR = 12;
const NO_TASK_ASSIGNMENT_ACTION_TYPES = new Set(['defer', 'rest', 'rest_day', 'rest-day', 'no_task', 'no-task', 'off_day', 'off-day', 'none']);
const NO_TASK_ASSIGNMENT_STATUSES = new Set(['deferred', 'rest', 'rest_day', 'rest-day', 'no_task', 'no-task', 'off_day', 'off-day', 'none']);

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
const coerceTimestampMs = (value: any): number => {
  if (!value) return 0;
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value > 1e12 ? value : value * 1000;
  }
  if (value instanceof Date) return value.getTime();
  if (typeof value?.toMillis === 'function') return value.toMillis();
  if (typeof value?.toDate === 'function') return value.toDate().getTime();
  return 0;
};

const toDate = (value: any): Date | null => {
  if (!value) return null;
  if (typeof value === 'number' && Number.isFinite(value)) return new Date(coerceTimestampMs(value));
  if (value instanceof Date) return value;
  if (typeof value?.toDate === 'function') return value.toDate();
  return null;
};
const toTimeValue = (value: any) => {
  if (typeof value === 'number') return coerceTimestampMs(value);
  return value || null;
};
const toTimeMs = (value: any): number => {
  return coerceTimestampMs(value);
};

const normalizeTimezone = (value: any) => {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    Intl.DateTimeFormat('en-US', { timeZone: value.trim() }).format(new Date());
    return value.trim();
  } catch (_error) {
    return null;
  }
};

const toUtcDateKey = (value: any) => {
  const millis = coerceTimestampMs(value);
  return millis ? new Date(millis).toISOString().slice(0, 10) : '';
};

const resolveTimezoneDateParts = (timestampMs: number, timezone: string) => {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: normalizeTimezone(timezone) || 'UTC',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const parts = formatter.formatToParts(new Date(timestampMs));
  const map = parts.reduce<Record<string, string>>((accumulator, part) => {
    accumulator[part.type] = part.value;
    return accumulator;
  }, {});

  return {
    year: Number(map.year || 0),
    month: Number(map.month || 1),
    day: Number(map.day || 1),
    hour: Number(map.hour || 0),
    minute: Number(map.minute || 0),
    second: Number(map.second || 0),
  };
};

const formatDateKeyFromParts = (parts: { year: number; month: number; day: number }) =>
  [String(parts.year).padStart(4, '0'), String(parts.month).padStart(2, '0'), String(parts.day).padStart(2, '0')].join('-');

const toTimezoneDateKey = (timestampMs: number, timezone: string) =>
  timestampMs ? formatDateKeyFromParts(resolveTimezoneDateParts(timestampMs, timezone)) : '';

const shiftUtcDateKey = (dateKey: string, deltaDays: number) => {
  if (!dateKey) return '';
  const [year, month, day] = String(dateKey).split('-').map((segment) => Number(segment));
  return new Date(Date.UTC(year, month - 1, day + deltaDays)).toISOString().slice(0, 10);
};

const listDateKeysBetween = (startDateKey: string, endDateKey: string) => {
  if (!startDateKey || !endDateKey || startDateKey > endDateKey) return [] as string[];
  const values: string[] = [];
  let cursor = startDateKey;
  while (cursor <= endDateKey) {
    values.push(cursor);
    cursor = shiftUtcDateKey(cursor, 1);
  }
  return values;
};

const resolvePilotEffectiveStatus = (pilot: PulseCheckPilot): PulseCheckPilot['status'] => {
  if (pilot.status === 'archived' || pilot.status === 'completed' || pilot.status === 'paused') {
    return pilot.status;
  }

  const now = new Date();
  const endAt = toDate(pilot.endAt);

  if (endAt && endAt.getTime() < now.getTime()) return 'completed';
  return 'active';
};

const isActivePilotDashboardScope = (pilot: PulseCheckPilot) => resolvePilotEffectiveStatus(pilot) === 'active';

const isPilotMetricWindowOpen = (pilot: PulseCheckPilot) => {
  if (resolvePilotEffectiveStatus(pilot) !== 'active') return false;

  const now = new Date();
  const startAt = toDate(pilot.startAt);
  const endAt = toDate(pilot.endAt);

  if (startAt && startAt.getTime() > now.getTime()) return false;
  if (endAt && endAt.getTime() < now.getTime()) return false;
  return true;
};

const resolveCohortEffectiveStatus = (cohort: PulseCheckPilotCohort): PulseCheckPilotCohort['status'] =>
  cohort.status === 'paused' || cohort.status === 'archived' ? cohort.status : 'active';

const isPilotOperationallyActive = (
  pilot: PulseCheckPilot,
  cohorts: PulseCheckPilotCohort[] = [],
  enrollments: PulseCheckPilotEnrollment[] = []
) => {
  if (isActivePilotDashboardScope(pilot)) return true;
  if (enrollments.some((enrollment) => enrollment.status === 'active')) return true;
  if (cohorts.some((cohort) => resolveCohortEffectiveStatus(cohort) === 'active')) return true;
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

const loadPilotEscalationOperationalDiagnostics = async ({
  pilot,
  activeEnrollments,
  existingDiagnostics,
}: {
  pilot: PulseCheckPilot;
  activeEnrollments: PulseCheckPilotEnrollment[];
  existingDiagnostics?: Record<string, any> | null;
}) => {
  if (!activeEnrollments.length) {
    return buildEscalationOperationalDiagnostics([], existingDiagnostics);
  }

  const uniqueAthleteIds = [...new Set(activeEnrollments.map((enrollment) => normalizeString(enrollment.userId)).filter(Boolean))];
  const enrollmentByAthleteId = activeEnrollments.reduce<Record<string, PulseCheckPilotEnrollment>>((accumulator, enrollment) => {
    accumulator[normalizeString(enrollment.userId)] = enrollment;
    return accumulator;
  }, {});

  const escalationSnapshots = await Promise.all(
    uniqueAthleteIds.map((athleteId) =>
      getDocs(query(collection(db, ESCALATION_RECORDS_COLLECTION), where('userId', '==', athleteId)))
    )
  );

  const escalations = escalationSnapshots.flatMap((snapshot, index) => {
    const athleteId = uniqueAthleteIds[index];
    const enrollment = enrollmentByAthleteId[athleteId];
    const windowStart = coerceTimestampMs(pilot.startAt)
      || coerceTimestampMs((enrollment as any)?.outcomeBackfillStartAt)
      || coerceTimestampMs(enrollment?.createdAt);

    return snapshot.docs
      .map<Record<string, any>>((docSnap) => ({ id: docSnap.id, ...(docSnap.data() as Record<string, any>) }))
      .filter((entry) => {
        const createdAtMs = coerceTimestampMs(entry.createdAt);
        return !windowStart || !createdAtMs || createdAtMs >= windowStart;
      });
  });

  return buildEscalationOperationalDiagnostics(escalations, existingDiagnostics);
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

const loadPilotOperationalWatchListStates = async (pilotId: string): Promise<PilotDashboardOperationalWatchListState[]> => {
  const normalizedPilotId = normalizeString(pilotId);
  if (!normalizedPilotId) return [];

  const snapshot = await getDocs(
    query(collection(db, PILOT_OPERATIONAL_STATE_COLLECTION), where('pilotId', '==', normalizedPilotId))
  );
  return snapshot.docs.map((docSnap) => normalizeOperationalWatchListState(docSnap.id, docSnap.data() as Record<string, any>));
};

const loadAthleteOperationalWatchListState = async (
  pilotEnrollmentId: string
): Promise<PilotDashboardOperationalWatchListState | null> => {
  const normalizedEnrollmentId = normalizeString(pilotEnrollmentId);
  if (!normalizedEnrollmentId) return null;

  const snap = await getDoc(doc(db, PILOT_OPERATIONAL_STATE_COLLECTION, normalizedEnrollmentId));
  if (!snap.exists()) return null;
  return normalizeOperationalWatchListState(snap.id, snap.data() as Record<string, any>);
};

const persistOperationalWatchListState = async (
  action: OperationalWatchListMutationAction,
  input: OperationalWatchListMutationInput
): Promise<void> => {
  const normalizedPilotId = normalizeString(input.pilotId);
  const normalizedPilotEnrollmentId = normalizeString(input.pilotEnrollmentId);
  const normalizedAthleteId = normalizeString(input.athleteId);
  if (!normalizedPilotId || !normalizedPilotEnrollmentId || !normalizedAthleteId) {
    throw new Error('pilotId, pilotEnrollmentId, and athleteId are required.');
  }

  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('Authenticated admin session required.');
  }
  const idToken = await currentUser.getIdToken();
  const endpointName =
    action === 'request'
      ? 'request-pilot-watch-list'
      : action === 'apply'
        ? 'apply-pilot-watch-list'
        : 'clear-pilot-watch-list';
  const response = await fetch(resolvePulseCheckFunctionUrl(`/.netlify/functions/${endpointName}`), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
      ...getFirebaseModeRequestHeaders(),
    },
    body: JSON.stringify({
      pilotId: normalizedPilotId,
      pilotEnrollmentId: normalizedPilotEnrollmentId,
      athleteId: normalizedAthleteId,
      reasonCode: normalizeOperationalWatchListReasonCode(input.reasonCode || 'other'),
      reason: normalizeString(input.reasonText),
      watchListSource: normalizeOperationalWatchListSource(input.source || 'clinician'),
      watchListReviewDueAt: input.reviewDueAt,
      linkedIncidentIds: Array.isArray(input.linkedIncidentIds)
        ? input.linkedIncidentIds.map((entry) => normalizeString(entry)).filter(Boolean)
        : [],
      ...(action === 'request'
        ? { requestedRestrictionFlags: buildDefaultOperationalWatchListFlags(input.restrictionFlags || null) }
        : action === 'apply'
          ? { restrictionFlags: buildDefaultOperationalWatchListFlags(input.restrictionFlags || null) }
          : {}),
    }),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.error || 'Failed to update operational watch list.');
  }
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

const resolveAthleteTimezoneForAdherence = (
  teamMembership: PulseCheckTeamMembership | null,
  assignments: Array<Record<string, any>>
) => {
  const onboardingTimezone =
    normalizeTimezone((teamMembership as any)?.athleteOnboarding?.timezone)
    || normalizeTimezone((teamMembership as any)?.timezone);
  if (onboardingTimezone) return onboardingTimezone;

  const assignmentTimezone = [...assignments]
    .map((assignment) => normalizeTimezone(assignment.timezone))
    .find(Boolean);
  return assignmentTimezone || 'UTC';
};

const normalizeEscalationStatus = (entry: Record<string, any>): 'active' | 'resolved' | 'declined' => {
  const status = normalizeString(entry.status).toLowerCase();
  if (['declined', 'dismissed', 'cancelled', 'canceled'].includes(status)) return 'declined';
  if (['resolved', 'closed', 'completed'].includes(status) || coerceTimestampMs(entry.resolvedAt) || coerceTimestampMs(entry.handoffCompletedAt)) {
    return 'resolved';
  }
  return 'active';
};

const HARD_RISK_ESCALATION_PATTERN = /\b(suicid|self[- ]?harm|hurt myself|kill myself|end my life|overdose|unsafe|can't stay safe|cannot stay safe|want to die|die tonight|abuse|assault|violence|psychosis|hallucinat|manic|panic attack|can't function|cannot function)\b/i;
const BENIGN_PERFORMANCE_SUPPORT_PATTERN = /\b(competition|compete|competing|on stage|performance|pre[- ]?competition|nervous|anxious|anxiety|excited|regulate|regulation|focus|attention|sleep|bed|go to sleep|late|mind|what'?s on my mind|talk about|emotional regulation|stress)\b/i;

const hasEscalationWorkflowProgress = (entry: Record<string, any>) =>
  Boolean(
    coerceTimestampMs(entry.coachNotifiedAt)
    || coerceTimestampMs(entry.handoffInitiatedAt)
    || coerceTimestampMs(entry.handoffAcceptedAt)
    || coerceTimestampMs(entry.firstClinicianResponseAt)
    || coerceTimestampMs(entry.handoffCompletedAt)
    || coerceTimestampMs(entry.resolvedAt)
    || normalizeString(entry.consentStatus) === 'accepted'
  );

const isBenignPerformanceSupportEscalation = (entry: Record<string, any>) => {
  const tier = Number(entry.tier) || 0;
  if (tier <= 0 || tier >= 3) return false;
  if (hasEscalationWorkflowProgress(entry)) return false;

  const combinedText = `${normalizeString(entry.category)} ${normalizeString(entry.classificationReason)} ${normalizeString(entry.triggerContent)}`.trim();
  if (!combinedText) return false;
  if (HARD_RISK_ESCALATION_PATTERN.test(combinedText)) return false;
  return BENIGN_PERFORMANCE_SUPPORT_PATTERN.test(combinedText);
};

const normalizeBoolean = (value: any) => {
  if (typeof value === 'boolean') return value;
  const normalized = normalizeString(typeof value === 'string' ? value : String(value || '')).toLowerCase();
  if (!normalized) return false;
  return ['true', '1', 'yes', 'y'].includes(normalized);
};

const DEFAULT_OPERATIONAL_WATCH_LIST_FLAGS: PilotDashboardOperationalWatchListRestrictionFlags = {
  suppressSurveys: false,
  suppressAssignments: false,
  suppressNudges: false,
  excludeFromAdherence: false,
  manualHold: false,
};

const normalizeOperationalStatus = (value: any): PilotDashboardOperationalStatus =>
  ['paused', 'withdrawn'].includes(normalizeString(value)) ? (normalizeString(value) as PilotDashboardOperationalStatus) : 'normal';

const normalizeOperationalWatchListLifecycleStatus = (
  value: any
): PilotDashboardOperationalWatchListLifecycleStatus => {
  const normalized = normalizeString(value);
  if (normalized === 'requested' || normalized === 'active' || normalized === 'cleared') return normalized;
  return 'none';
};

const normalizeOperationalWatchListReasonCode = (value: any): PilotDashboardOperationalWatchListReasonCode | string =>
  normalizeString(value) || 'other';

const normalizeOperationalWatchListSource = (value: any): PilotDashboardOperationalWatchListSource | null => {
  const normalized = normalizeString(value);
  if (normalized === 'clinician' || normalized === 'staff' || normalized === 'system') return normalized;
  return null;
};

const normalizeOperationalWatchListFlags = (value: any): PilotDashboardOperationalWatchListRestrictionFlags => ({
  suppressSurveys: normalizeBoolean(value?.suppressSurveys),
  suppressAssignments: normalizeBoolean(value?.suppressAssignments),
  suppressNudges: normalizeBoolean(value?.suppressNudges),
  excludeFromAdherence: normalizeBoolean(value?.excludeFromAdherence),
  manualHold: normalizeBoolean(value?.manualHold),
});

const buildDefaultOperationalWatchListFlags = (
  overrides?: Partial<PilotDashboardOperationalWatchListRestrictionFlags> | null
): PilotDashboardOperationalWatchListRestrictionFlags => ({
  ...DEFAULT_OPERATIONAL_WATCH_LIST_FLAGS,
  ...(overrides || {}),
});

const normalizeOperationalWatchListState = (id: string, data: Record<string, any>): PilotDashboardOperationalWatchListState => ({
  id,
  pilotId: normalizeString(data.pilotId),
  pilotEnrollmentId: normalizeString(data.pilotEnrollmentId),
  athleteId: normalizeString(data.athleteId),
  status: normalizeOperationalStatus(data.status),
  lifecycleStatus: normalizeOperationalWatchListLifecycleStatus(data.lifecycleStatus),
  watchListActive: normalizeBoolean(data.watchListActive),
  watchListRequested: normalizeBoolean(data.watchListRequested),
  reasonCode: normalizeOperationalWatchListReasonCode(data.reasonCode),
  reasonText: normalizeString(data.reasonText),
  source: normalizeOperationalWatchListSource(data.source),
  reviewDueAt: toTimeValue(data.reviewDueAt),
  requestedAt: toTimeValue(data.requestedAt),
  requestedByUserId: normalizeString(data.requestedByUserId) || null,
  requestedByEmail: normalizeString(data.requestedByEmail) || null,
  appliedAt: toTimeValue(data.appliedAt),
  appliedByUserId: normalizeString(data.appliedByUserId) || null,
  appliedByEmail: normalizeString(data.appliedByEmail) || null,
  clearedAt: toTimeValue(data.clearedAt),
  clearedByUserId: normalizeString(data.clearedByUserId) || null,
  clearedByEmail: normalizeString(data.clearedByEmail) || null,
  linkedIncidentIds: Array.isArray(data.linkedIncidentIds) ? data.linkedIncidentIds.map((entry) => normalizeString(entry)).filter(Boolean) : [],
  restrictionFlags: normalizeOperationalWatchListFlags(data.restrictionFlags),
  createdAt: toTimeValue(data.createdAt),
  updatedAt: toTimeValue(data.updatedAt),
});

const buildOperationalWatchListSummary = (
  states: PilotDashboardOperationalWatchListState[]
): PilotDashboardOperationalWatchListSummary => ({
  stateCount: states.length,
  requestedCount: states.filter((state) => state.lifecycleStatus === 'requested' || (state.watchListRequested && !state.watchListActive)).length,
  activeCount: states.filter((state) => state.watchListActive).length,
  pausedCount: states.filter((state) => state.status === 'paused').length,
  withdrawnCount: states.filter((state) => state.status === 'withdrawn').length,
  suppressSurveysCount: states.filter((state) => state.restrictionFlags.suppressSurveys).length,
  suppressAssignmentsCount: states.filter((state) => state.restrictionFlags.suppressAssignments).length,
  suppressNudgesCount: states.filter((state) => state.restrictionFlags.suppressNudges).length,
  excludeFromAdherenceCount: states.filter((state) => state.restrictionFlags.excludeFromAdherence).length,
  manualHoldCount: states.filter((state) => state.restrictionFlags.manualHold).length,
});

type OperationalWatchListMutationAction = 'request' | 'apply' | 'clear';

interface OperationalWatchListMutationInput {
  pilotId: string;
  pilotEnrollmentId: string;
  athleteId: string;
  reasonCode?: PilotDashboardOperationalWatchListReasonCode | string;
  reasonText?: string;
  source?: PilotDashboardOperationalWatchListSource;
  reviewDueAt?: PilotDashboardTimeValue;
  restrictionFlags?: Partial<PilotDashboardOperationalWatchListRestrictionFlags> | null;
  linkedIncidentIds?: string[];
}

const normalizeOperationalWatchListMutationForDemo = (
  input: OperationalWatchListMutationInput
): {
  pilotId: string;
  pilotEnrollmentId: string;
  athleteId: string;
  reasonCode?: string;
  reasonText?: string;
  source?: PilotDashboardOperationalWatchListSource;
  reviewDueAt?: number | null;
  restrictionFlags?: Partial<PilotDashboardOperationalWatchListRestrictionFlags> | null;
  linkedIncidentIds?: string[];
} => ({
  ...input,
  reviewDueAt: input.reviewDueAt ? coerceTimestampMs(input.reviewDueAt) : null,
});

const isCoachReviewEscalation = (entry: Record<string, any>) => {
  if (isBenignPerformanceSupportEscalation(entry)) return false;
  if (normalizeBoolean(entry.supportFlag)) return false;
  if (normalizeBoolean(entry.coachReviewFlag)) return true;

  const disposition = normalizeString(entry.disposition).toLowerCase();
  const family = normalizeString(entry.classificationFamily).toLowerCase();
  if (disposition === 'coach_review' || family === 'coach_review') return true;

  const tier = Number(entry.tier) || 0;
  return tier === 1 && disposition !== 'clinical_handoff' && family !== 'care_escalation' && family !== 'critical_safety';
};

const isSupportFlagEscalation = (entry: Record<string, any>) =>
  normalizeBoolean(entry.supportFlag) || isBenignPerformanceSupportEscalation(entry);

const isOpenCareEscalation = (entry: Record<string, any>) => {
  if (normalizeEscalationStatus(entry) !== 'active' || isSupportFlagEscalation(entry)) return false;

  const disposition = normalizeString(entry.disposition).toLowerCase();
  const family = normalizeString(entry.classificationFamily).toLowerCase();
  if (disposition === 'clinical_handoff') return true;
  if (family === 'care_escalation' || family === 'critical_safety') return true;
  if (entry.requiresClinicalHandoff === true || entry.countsTowardCareKpi === true) return true;

  return (Number(entry.tier) || 0) >= 2;
};

const resolveEscalationDispositionLabel = (entry: Record<string, any>) => {
  const status = normalizeEscalationStatus(entry);
  const consentStatus = normalizeString(entry.consentStatus).toLowerCase();
  const hasCareProgress = Boolean(
    coerceTimestampMs(entry.handoffInitiatedAt)
    || coerceTimestampMs(entry.handoffAcceptedAt)
    || coerceTimestampMs(entry.firstClinicianResponseAt)
    || coerceTimestampMs(entry.handoffCompletedAt)
  );

  if (status === 'declined' || consentStatus === 'declined') return 'Declined care';
  if (coerceTimestampMs(entry.handoffCompletedAt)) return 'Care completed';
  if (status === 'resolved' && hasCareProgress) return 'Care completed';
  if (status === 'resolved') return 'Resolved';
  if (hasCareProgress) return 'In care';
  if (isSupportFlagEscalation(entry)) return 'Support flag';
  if (isCoachReviewEscalation(entry)) return 'Coach review';
  if (consentStatus === 'pending' && (Number(entry.tier) || 0) >= 2) return 'Consent pending';
  return 'Open care';
};

const resolveEscalationIncidentKey = (entry: Record<string, any>) =>
  normalizeString(entry.groupedIncidentKey)
  || normalizeString(entry.groupedIncidentId)
  || normalizeString(entry.incidentGroupId)
  || normalizeString(entry.incidentId)
  || normalizeString(entry.caseId)
  || normalizeString(entry.conversationId)
  || normalizeString(entry.id);

const resolveGroupedIncidentDispositionLabel = (entries: Array<Record<string, any>>) => {
  if (entries.some((entry) => isOpenCareEscalation(entry))) return 'Open care';
  if (entries.some((entry) => isCoachReviewEscalation(entry) && normalizeEscalationStatus(entry) === 'active')) return 'Coach review';
  if (entries.some((entry) => isSupportFlagEscalation(entry) && normalizeEscalationStatus(entry) === 'active')) return 'Support flag';
  if (entries.every((entry) => normalizeEscalationStatus(entry) === 'declined')) return 'Declined care';
  if (entries.some((entry) => resolveEscalationDispositionLabel(entry) === 'Care completed')) return 'Care completed';
  if (entries.some((entry) => normalizeEscalationStatus(entry) === 'resolved')) return 'Resolved';
  return resolveEscalationDispositionLabel(entries[0] || {});
};

const buildEscalationOperationalDiagnostics = (
  escalations: Array<Record<string, any>>,
  existingDiagnostics?: Record<string, any> | null
) => {
  const groupedIncidentKeys = new Set<string>();
  let coachReviewFlags = 0;
  let supportFlags = 0;
  let openCareEscalations = 0;

  escalations.forEach((entry) => {
    groupedIncidentKeys.add(resolveEscalationIncidentKey(entry));
    if (isCoachReviewEscalation(entry)) coachReviewFlags += 1;
    if (isSupportFlagEscalation(entry)) supportFlags += 1;
    if (isOpenCareEscalation(entry)) openCareEscalations += 1;
  });

  const legacyRecordCount = escalations.length;
  const normalizedIncidentCount = groupedIncidentKeys.size;
  const recordsCollapsedByGrouping = Math.max(0, legacyRecordCount - normalizedIncidentCount);
  const comparisonStatus: 'no-escalations' | 'parity' | 'grouped' =
    legacyRecordCount === 0
      ? 'no-escalations'
      : recordsCollapsedByGrouping > 0
        ? 'grouped'
        : 'parity';
  const existingMigrationStatusLabel =
    normalizeString(existingDiagnostics?.migrationContext?.statusLabel)
    || normalizeString(existingDiagnostics?.migrationStatus?.statusLabel)
    || normalizeString(existingDiagnostics?.migrationStatusLabel);
  const existingMigrationSourceLabel =
    normalizeString(existingDiagnostics?.migrationContext?.sourceLabel)
    || normalizeString(existingDiagnostics?.migrationStatus?.sourceLabel)
    || normalizeString(existingDiagnostics?.migrationSourceLabel);
  const migrationContext =
    comparisonStatus === 'no-escalations' && !existingMigrationStatusLabel
      ? undefined
      : {
          statusLabel:
            existingMigrationStatusLabel
            || (comparisonStatus === 'grouped'
              ? 'Legacy raw-record counts are being normalized into grouped incidents.'
              : 'Legacy raw-record counts and normalized incident counts currently match.'),
          sourceLabel: existingMigrationSourceLabel || 'Live dashboard grouping',
        };

  return {
    ...(existingDiagnostics || {}),
    statusCounts: existingDiagnostics?.statusCounts || {
      active: escalations.filter((entry) => normalizeEscalationStatus(entry) === 'active').length,
      resolved: escalations.filter((entry) => normalizeEscalationStatus(entry) === 'resolved').length,
      declined: escalations.filter((entry) => normalizeEscalationStatus(entry) === 'declined').length,
    },
    secondaryCounts: {
      coachReviewFlags,
      supportFlags,
      groupedIncidents: groupedIncidentKeys.size,
      openCareEscalations,
    },
    comparison: {
      legacyRecordCount,
      normalizedIncidentCount,
      recordsCollapsedByGrouping,
      status: comparisonStatus,
    },
    migrationContext,
  };
};

const isNoTaskRestDay = (assignment: Record<string, any> | null | undefined) => {
  if (!assignment) return false;
  return NO_TASK_ASSIGNMENT_ACTION_TYPES.has(normalizeString(assignment.actionType))
    || NO_TASK_ASSIGNMENT_STATUSES.has(normalizeString(assignment.status));
};

const isManualPauseDay = (
  teamMembership: PulseCheckTeamMembership | null,
  pilotEnrollment: PulseCheckPilotEnrollment,
  dateKey: string
) => {
  const membershipPauseWindows = Array.isArray((teamMembership as any)?.athleteOnboarding?.manualPauseWindows)
    ? ((teamMembership as any).athleteOnboarding.manualPauseWindows as Array<Record<string, any>>)
    : [];
  const enrollmentPauseWindows = Array.isArray((pilotEnrollment as any)?.manualPauseWindows)
    ? ((pilotEnrollment as any).manualPauseWindows as Array<Record<string, any>>)
    : [];

  return [...membershipPauseWindows, ...enrollmentPauseWindows].some((window) => {
    const startDate = normalizeString(window?.startDate);
    const endDate = normalizeString(window?.endDate) || startDate;
    return startDate && dateKey >= startDate && dateKey <= endDate;
  });
};

const isEnrollmentPausedDay = (
  pilotEnrollment: PulseCheckPilotEnrollment,
  dateKey: string,
  timezone: string,
  hasSameDayActivity: boolean
) => {
  if (normalizeString(pilotEnrollment.status) !== 'paused') return false;
  const pausedAtMs = coerceTimestampMs((pilotEnrollment as any).pausedAt) || coerceTimestampMs(pilotEnrollment.updatedAt);
  if (!pausedAtMs) return true;
  const pausedDateKey = toTimezoneDateKey(pausedAtMs, timezone);
  if (!pausedDateKey || dateKey < pausedDateKey) return false;
  return !(pausedDateKey === dateKey && hasSameDayActivity);
};

const isEscalationHoldDay = (escalations: Array<Record<string, any>>, dateKey: string) =>
  escalations.some((escalation) => {
    if (isBenignPerformanceSupportEscalation(escalation)) return false;
    if (normalizeEscalationStatus(escalation) !== 'active') return false;
    const createdDateKey = toUtcDateKey(escalation.createdAt);
    const resolvedDateKey = toUtcDateKey(escalation.resolvedAt || escalation.handoffCompletedAt || Date.now());
    return Boolean(createdDateKey && resolvedDateKey && dateKey >= createdDateKey && dateKey <= resolvedDateKey);
  });

const isOperationalWatchListHoldDay = (
  watchList: PilotDashboardOperationalWatchListState | null | undefined,
  dateKey: string
) => {
  if (!watchList?.watchListActive) return false;
  const flags = watchList.restrictionFlags || DEFAULT_OPERATIONAL_WATCH_LIST_FLAGS;
  if (!flags.excludeFromAdherence && !flags.manualHold) return false;

  const startDateKey = toUtcDateKey(watchList.appliedAt || watchList.requestedAt || watchList.createdAt);
  if (!startDateKey) return false;
  return dateKey >= startDateKey;
};

const buildAthleteAdherenceDetail = ({
  pilot,
  pilotEnrollment,
  teamMembership,
  assignments,
  assignmentEvents,
  checkIns,
  escalations,
  operationalWatchList,
}: {
  pilot: PulseCheckPilot;
  pilotEnrollment: PulseCheckPilotEnrollment;
  teamMembership: PulseCheckTeamMembership | null;
  assignments: Array<Record<string, any>>;
  assignmentEvents: Array<Record<string, any>>;
  checkIns: Array<Record<string, any>>;
  escalations: Array<Record<string, any>>;
  operationalWatchList?: PilotDashboardOperationalWatchListState | null;
}): {
  adherenceSummary: PilotDashboardAthleteAdherenceSummary;
  adherenceDays: PilotDashboardAthleteAdherenceDay[];
} => {
  const athleteId = normalizeString(pilotEnrollment.userId);
  const timezone = resolveAthleteTimezoneForAdherence(teamMembership, assignments);
  const assignmentByDate = assignments.reduce<Map<string, Record<string, any>>>((accumulator, assignment) => {
    const sourceDate = normalizeString(assignment.sourceDate);
    if (!sourceDate) return accumulator;
    const existing = accumulator.get(sourceDate);
    if (!existing || toTimeMs(assignment.updatedAt) >= toTimeMs(existing.updatedAt)) {
      accumulator.set(sourceDate, assignment);
    }
    return accumulator;
  }, new Map());

  const assignmentCompletionByDate = assignmentEvents.reduce<Map<string, Record<string, any>>>((accumulator, event) => {
    if (normalizeString(event.eventType) !== 'completed') return accumulator;
    const sourceDate = normalizeString(event.sourceDate);
    if (!sourceDate) return accumulator;
    const existing = accumulator.get(sourceDate);
    if (!existing || toTimeMs(event.createdAt) >= toTimeMs(existing.createdAt)) {
      accumulator.set(sourceDate, event);
    }
    return accumulator;
  }, new Map());

  const checkInsByDate = checkIns.reduce<Map<string, Array<Record<string, any>>>>((accumulator, checkIn) => {
    const sourceDate = normalizeString(checkIn.date) || toTimezoneDateKey(toTimeMs(checkIn.createdAt), timezone);
    if (!sourceDate) return accumulator;
    const current = accumulator.get(sourceDate) || [];
    current.push(checkIn);
    accumulator.set(sourceDate, current);
    return accumulator;
  }, new Map());

  const pilotTimelineStartMs =
    coerceTimestampMs(pilot.startAt)
    || coerceTimestampMs((pilotEnrollment as any).outcomeBackfillStartAt)
    || coerceTimestampMs(pilotEnrollment.createdAt)
    || Date.now();
  const athleteInclusionStartMs =
    coerceTimestampMs((pilotEnrollment as any).outcomeBackfillStartAt)
    || coerceTimestampMs(pilotEnrollment.createdAt)
    || pilotTimelineStartMs;
  const athleteInclusionDateKeyRaw = toTimezoneDateKey(athleteInclusionStartMs, timezone);
  const athleteInclusionHasSameDayActivity = Boolean(
    checkInsByDate.get(athleteInclusionDateKeyRaw)?.length
    || assignmentCompletionByDate.has(athleteInclusionDateKeyRaw)
    || normalizeString(assignmentByDate.get(athleteInclusionDateKeyRaw)?.status) === 'completed'
  );
  const athleteInclusionLocalHour = resolveTimezoneDateParts(athleteInclusionStartMs, timezone).hour;
  const athleteInclusionDateKey =
    athleteInclusionLocalHour >= ADHERENCE_ACTIVATION_DAY_CUTOFF_HOUR && !athleteInclusionHasSameDayActivity
      ? shiftUtcDateKey(athleteInclusionDateKeyRaw, 1)
      : athleteInclusionDateKeyRaw;

  const seededStartMs = pilotTimelineStartMs;
  const seededEndMs =
    normalizeString(pilotEnrollment.status) === 'withdrawn'
      ? (coerceTimestampMs(pilotEnrollment.updatedAt) || Date.now())
      : (isPilotOperationallyActive(pilot, [], [pilotEnrollment])
        ? Date.now()
        : (resolvePilotEffectiveStatus(pilot) === 'completed'
        ? (coerceTimestampMs(pilot.endAt) || Date.now())
        : Date.now()));

  const startDateKey = toTimezoneDateKey(seededStartMs, timezone);

  const rawEndDateKey = toTimezoneDateKey(seededEndMs, timezone);
  const endHasSameDayActivity = Boolean(
    checkInsByDate.get(rawEndDateKey)?.length
    || assignmentCompletionByDate.has(rawEndDateKey)
    || normalizeString(assignmentByDate.get(rawEndDateKey)?.status) === 'completed'
  );
  const endDateKey =
    normalizeString(pilotEnrollment.status) === 'withdrawn' && rawEndDateKey
      ? (endHasSameDayActivity ? rawEndDateKey : shiftUtcDateKey(rawEndDateKey, -1))
      : rawEndDateKey;

  const days = listDateKeysBetween(startDateKey, endDateKey).map((dateKey) => {
    const assignment = assignmentByDate.get(dateKey) || null;
    const completionEvent = assignmentCompletionByDate.get(dateKey) || null;
    const checkInsForDate = checkInsByDate.get(dateKey) || [];
    const hasCheckIn = checkInsForDate.length > 0;
    const hasAssignmentCompletion = Boolean(completionEvent) || normalizeString(assignment?.status) === 'completed';
    const hasSameDayActivity = hasCheckIn || hasAssignmentCompletion;

    let exclusionReason: PilotDashboardAthleteAdherenceDay['exclusionReason'] = null;
    const withdrawnAtMs = normalizeString(pilotEnrollment.status) === 'withdrawn' ? (coerceTimestampMs(pilotEnrollment.updatedAt) || 0) : 0;
    const withdrawnDateKey = withdrawnAtMs ? toTimezoneDateKey(withdrawnAtMs, timezone) : '';
    const withdrawnHasSameDayActivity = withdrawnDateKey
      ? Boolean(
          checkInsByDate.get(withdrawnDateKey)?.length
          || assignmentCompletionByDate.has(withdrawnDateKey)
          || normalizeString(assignmentByDate.get(withdrawnDateKey)?.status) === 'completed'
        )
      : false;
    const withdrawnBoundaryDateKey =
      withdrawnDateKey
      && !withdrawnHasSameDayActivity
        ? shiftUtcDateKey(withdrawnDateKey, -1)
        : withdrawnDateKey;

    if (dateKey < athleteInclusionDateKey) {
      exclusionReason = 'not_enrolled_yet';
    } else if (withdrawnBoundaryDateKey && dateKey > withdrawnBoundaryDateKey) {
      exclusionReason = 'withdrawn';
    } else if (isManualPauseDay(teamMembership, pilotEnrollment, dateKey)) {
      exclusionReason = 'manual_pause';
    } else if (isEnrollmentPausedDay(pilotEnrollment, dateKey, timezone, hasSameDayActivity)) {
      exclusionReason = 'paused';
    } else if (isOperationalWatchListHoldDay(operationalWatchList, dateKey)) {
      exclusionReason = operationalWatchList?.restrictionFlags?.manualHold ? 'manual_hold' : 'watch_list_hold';
    } else if (isNoTaskRestDay(assignment)) {
      exclusionReason = 'no_task_rest_day';
    }

    const expected = !exclusionReason;
    return {
      dateKey,
      timezone,
      expected,
      status: !expected ? 'excluded' : hasCheckIn && hasAssignmentCompletion ? 'green' : 'red',
      checkInCompleted: hasCheckIn,
      assignmentCompleted: hasAssignmentCompletion,
      checkInCount: checkInsForDate.length,
      assignmentId: normalizeString(assignment?.id) || null,
      assignmentStatus: normalizeString(assignment?.status) || null,
      assignmentActionType: normalizeString(assignment?.actionType) || null,
      exclusionReason,
      checkInRecordedAt: hasCheckIn ? toTimeValue(checkInsForDate[checkInsForDate.length - 1]?.createdAt) : null,
      assignmentCompletedAt: hasAssignmentCompletion ? toTimeValue(completionEvent?.createdAt || assignment?.updatedAt) : null,
    } as PilotDashboardAthleteAdherenceDay;
  });

  const expectedAthleteDays = days.filter((entry) => entry.expected).length;
  const completedCheckInDays = days.filter((entry) => entry.expected && entry.checkInCompleted).length;
  const completedAssignmentDays = days.filter((entry) => entry.expected && entry.assignmentCompleted).length;
  const adheredDays = days.filter((entry) => entry.expected && entry.status === 'green').length;

  return {
    adherenceSummary: {
      expectedAthleteDays,
      completedCheckInDays,
      completedAssignmentDays,
      adheredDays,
      adherenceRate: expectedAthleteDays ? roundMetric((adheredDays / expectedAthleteDays) * 100) : 0,
      dailyCheckInRate: expectedAthleteDays ? roundMetric((completedCheckInDays / expectedAthleteDays) * 100) : 0,
      assignmentCompletionRate: expectedAthleteDays ? roundMetric((completedAssignmentDays / expectedAthleteDays) * 100) : 0,
    },
    adherenceDays: days.sort((left, right) => right.dateKey.localeCompare(left.dateKey)),
  };
};

const loadAthleteOutcomeDetail = async ({
  pilot,
  athleteId,
  pilotEnrollment,
  teamMembership,
  operationalWatchList,
}: {
  pilot: PulseCheckPilot;
  athleteId: string;
  pilotEnrollment: PulseCheckPilotEnrollment;
  teamMembership: PulseCheckTeamMembership | null;
  operationalWatchList?: PilotDashboardOperationalWatchListState | null;
}): Promise<{
  adherenceSummary: PilotDashboardAthleteAdherenceSummary;
  adherenceDays: PilotDashboardAthleteAdherenceDay[];
  escalations: PilotDashboardAthleteEscalationDetail[];
}> => {
  const [checkInSnap, assignmentSnap, assignmentEventSnap, escalationSnap] = await Promise.all([
    getDocs(collection(db, SIM_CHECKINS_ROOT, athleteId, CHECKINS_SUBCOLLECTION)),
    getDocs(query(collection(db, PULSECHECK_DAILY_ASSIGNMENTS_COLLECTION), where('athleteId', '==', athleteId))),
    getDocs(query(collection(db, PULSECHECK_ASSIGNMENT_EVENTS_COLLECTION), where('athleteId', '==', athleteId))),
    getDocs(query(collection(db, ESCALATION_RECORDS_COLLECTION), where('userId', '==', athleteId))),
  ]);

  const assignments = assignmentSnap.docs
    .map<Record<string, any>>((docSnap) => ({ id: docSnap.id, ...(docSnap.data() as Record<string, any>) }))
    .filter((assignment) => {
      const assignmentPilotId = normalizeString(assignment.pilotId);
      const assignmentEnrollmentId = normalizeString(assignment.pilotEnrollmentId);
      return !assignmentPilotId || assignmentPilotId === pilot.id || assignmentEnrollmentId === pilotEnrollment.id;
    });

  const assignmentEvents = assignmentEventSnap.docs
    .map<Record<string, any>>((docSnap) => ({ id: docSnap.id, ...(docSnap.data() as Record<string, any>) }))
    .filter((event) => {
      const eventAt = toTimeMs(event.createdAt);
      const windowStart = coerceTimestampMs(pilot.startAt) || coerceTimestampMs((pilotEnrollment as any).outcomeBackfillStartAt) || coerceTimestampMs(pilotEnrollment.createdAt);
      return !windowStart || eventAt >= windowStart;
    });

  const allEscalations = escalationSnap.docs
    .map<Record<string, any>>((docSnap) => ({ id: docSnap.id, ...(docSnap.data() as Record<string, any>) }))
    .filter((entry) => {
      const createdAtMs = coerceTimestampMs(entry.createdAt);
      const windowStart = coerceTimestampMs(pilot.startAt) || coerceTimestampMs((pilotEnrollment as any).outcomeBackfillStartAt) || coerceTimestampMs(pilotEnrollment.createdAt);
      return !windowStart || !createdAtMs || createdAtMs >= windowStart;
    });

  const rawEscalations = allEscalations.filter((entry) => !isBenignPerformanceSupportEscalation(entry));

  const adherenceDetail = buildAthleteAdherenceDetail({
    pilot,
    pilotEnrollment,
    teamMembership,
    assignments,
    assignmentEvents,
    checkIns: checkInSnap.docs.map((docSnap) => ({ id: docSnap.id, ...(docSnap.data() as Record<string, any>) })),
    escalations: rawEscalations,
    operationalWatchList: operationalWatchList || null,
  });

  const incidentGroups = [...allEscalations]
    .sort((left, right) => toTimeMs(right.createdAt) - toTimeMs(left.createdAt))
    .reduce<Map<string, Array<Record<string, any>>>>((accumulator, entry) => {
      const incidentKey = resolveEscalationIncidentKey(entry);
      const existing = accumulator.get(incidentKey) || [];
      existing.push(entry);
      accumulator.set(incidentKey, existing);
      return accumulator;
    }, new Map());

  const incidentLabelMap = new Map<string, string>();
  const incidentDispositionMap = new Map<string, string>();
  const incidentRecordCountMap = new Map<string, number>();

  [...incidentGroups.entries()]
    .sort((left, right) => toTimeMs(right[1][0]?.createdAt) - toTimeMs(left[1][0]?.createdAt))
    .forEach(([incidentKey, incidentEntries], index) => {
      incidentLabelMap.set(incidentKey, `Incident ${index + 1}`);
      incidentDispositionMap.set(incidentKey, resolveGroupedIncidentDispositionLabel(incidentEntries));
      incidentRecordCountMap.set(incidentKey, incidentEntries.length);
    });

  const escalations = allEscalations
    .map((entry) => {
      const incidentKey = resolveEscalationIncidentKey(entry);
      return {
        id: normalizeString(entry.id),
        conversationId: normalizeString(entry.conversationId) || null,
        tier: Number(entry.tier) || 0,
        category: normalizeString(entry.category) || 'general',
        status: normalizeEscalationStatus(entry),
        dispositionLabel: resolveEscalationDispositionLabel(entry),
        groupedIncidentKey: incidentKey,
        groupedIncidentLabel: incidentLabelMap.get(incidentKey) || 'Incident',
        groupedIncidentDispositionLabel: incidentDispositionMap.get(incidentKey) || resolveEscalationDispositionLabel(entry),
        groupedIncidentRecordCount: incidentRecordCountMap.get(incidentKey) || 1,
        coachReviewFlag: isCoachReviewEscalation(entry),
        supportFlag: isSupportFlagEscalation(entry),
        openCareEscalation: isOpenCareEscalation(entry),
        consentStatus: normalizeString(entry.consentStatus) || null,
        handoffStatus: normalizeString(entry.handoffStatus) || null,
        classificationReason: normalizeString(entry.classificationReason) || null,
        triggerContent: normalizeString(entry.triggerContent) || null,
        createdAt: toTimeValue(entry.createdAt),
        coachNotifiedAt: toTimeValue(entry.coachNotifiedAt),
        consentTimestamp: toTimeValue(entry.consentTimestamp),
        handoffInitiatedAt: toTimeValue(entry.handoffInitiatedAt),
        handoffAcceptedAt: toTimeValue(entry.handoffAcceptedAt),
        firstClinicianResponseAt: toTimeValue(entry.firstClinicianResponseAt),
        handoffCompletedAt: toTimeValue(entry.handoffCompletedAt),
        resolvedAt: toTimeValue(entry.resolvedAt),
      } satisfies PilotDashboardAthleteEscalationDetail;
    })
    .sort((left, right) => toTimeMs(right.createdAt) - toTimeMs(left.createdAt));

  return {
    adherenceSummary: adherenceDetail.adherenceSummary,
    adherenceDays: adherenceDetail.adherenceDays,
    escalations,
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

const buildAthleteLabel = (
  teamMembership: PulseCheckTeamMembership | null,
  athleteId: string,
  enrollment?: PulseCheckPilotEnrollment | null,
  userProfile?: PilotDashboardAthleteProfileSummary | null
) => {
  const onboardingName = normalizeString(teamMembership?.athleteOnboarding?.entryOnboardingName);
  if (onboardingName) return onboardingName;
  const profileDisplayName = normalizeString(userProfile?.displayName);
  if (profileDisplayName) return profileDisplayName;
  const username = normalizeString(userProfile?.username);
  if (username) return username;
  return normalizeString(teamMembership?.email) || normalizeString(enrollment?.userId) || normalizeString(athleteId) || 'Pilot athlete';
};

async function loadAthleteProfileSummary(
  athleteId: string,
  teamMembership: PulseCheckTeamMembership | null,
  teamSportOrProgram = ''
): Promise<{ profile: PilotDashboardAthleteProfileSummary; canReceivePulseCheckPush: boolean }> {
  const fallbackEmail = normalizeString(teamMembership?.email);
  const fallbackDisplayName = normalizeString(teamMembership?.athleteOnboarding?.entryOnboardingName);
  const fallbackTitle = normalizeString(teamMembership?.title);
  const summary: PilotDashboardAthleteProfileSummary = {
    displayName: '',
    onboardingName: fallbackDisplayName,
    username: '',
    email: fallbackEmail,
    profileImageUrl: '',
    bio: '',
    membershipTitle: fallbackTitle,
    teamSportOrProgram: normalizeString(teamSportOrProgram),
    accountCreatedAt: null,
  };
  const fallbackResult = { profile: summary, canReceivePulseCheckPush: false };

  try {
    const userSnap = await getDoc(doc(db, 'users', athleteId));
    if (!userSnap.exists()) {
      return fallbackResult;
    }

    const userData = userSnap.data() as Record<string, any>;
    const pulseCheckFcmToken = normalizeString(userData.pulseCheckFcmToken);
    const pushTokenSourceApp = normalizeString(userData.pushTokenSourceApp).toLowerCase();

    return {
      profile: {
        ...summary,
        displayName: normalizeString(userData.displayName),
        username: normalizeString(userData.username),
        email: normalizeString(userData.email) || summary.email,
        profileImageUrl: normalizeString(userData.profileImage?.profileImageURL),
        bio: normalizeString(userData.bio),
        accountCreatedAt: toTimeValue(userData.createdAt),
      },
      canReceivePulseCheckPush: Boolean(pulseCheckFcmToken && pushTokenSourceApp === 'pulsecheck'),
    };
  } catch (error) {
    console.warn('[pulsecheckPilotDashboard] Failed to load athlete profile summary:', athleteId, error);
    return fallbackResult;
  }
}

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

const buildEmptyEngineSummary = (): PilotDashboardEngineSummary => ({
  hasEngineRecord: false,
  evidenceRecordCount: 0,
  patternModelCount: 0,
  stablePatternCount: 0,
  highConfidencePatternCount: 0,
  degradedPatternCount: 0,
  recommendationProjectionCount: 0,
  recommendationProjectionCountsByConsumer: {},
});

async function buildAthleteSummary(
  pilot: PulseCheckPilot,
  enrollment: PulseCheckPilotEnrollment,
  cohortMap: Map<string, PulseCheckPilotCohort>,
  teamMembershipMap: Map<string, PulseCheckTeamMembership>,
  operationalWatchList?: PilotDashboardOperationalWatchListState | null
): Promise<PilotDashboardAthleteSummary> {
  const teamMembership = teamMembershipMap.get(enrollment.userId) || null;
  const cohort = normalizeString(enrollment.cohortId) ? cohortMap.get(normalizeString(enrollment.cohortId)) || null : null;
  const engineSummary = isPilotMetricWindowOpen(pilot)
    ? await loadEngineSummaryForAthlete(enrollment.userId)
    : buildEmptyEngineSummary();

  return {
    athleteId: enrollment.userId,
    displayName: buildAthleteLabel(teamMembership, enrollment.userId, enrollment),
    email: normalizeString(teamMembership?.email),
    pilotEnrollment: enrollment,
    teamMembership,
    cohort,
    engineSummary,
    operationalWatchList: operationalWatchList || null,
  };
}

async function buildRosterAthleteSummary(
  pilot: PulseCheckPilot,
  athleteId: string,
  teamMembership: PulseCheckTeamMembership | null,
  enrollment: PulseCheckPilotEnrollment | null,
  cohortMap: Map<string, PulseCheckPilotCohort>,
  operationalWatchList?: PilotDashboardOperationalWatchListState | null
): Promise<PilotDashboardRosterAthleteSummary> {
  const isEnrolled = Boolean(enrollment && enrollment.status !== 'withdrawn');
  const cohort = isEnrolled && normalizeString(enrollment?.cohortId)
    ? cohortMap.get(normalizeString(enrollment?.cohortId)) || null
    : null;
  const athleteProfileContext = await loadAthleteProfileSummary(athleteId, teamMembership);
  const athleteProfile = athleteProfileContext.profile;
  const userEmail = athleteProfile.email;
  const canReceivePulseCheckPush = athleteProfileContext.canReceivePulseCheckPush;

  const engineSummary = isPilotMetricWindowOpen(pilot) && enrollment?.status === 'active'
    ? await loadEngineSummaryForAthlete(athleteId)
    : buildEmptyEngineSummary();

  return {
    athleteId,
    displayName: buildAthleteLabel(teamMembership, athleteId, enrollment, athleteProfile),
    email: normalizeString(teamMembership?.email) || userEmail,
    isEnrolled,
    canReceivePulseCheckPush,
    pilotEnrollment: isEnrolled ? enrollment : null,
    teamMembership,
    cohort,
    engineSummary,
    operationalWatchList: isEnrolled ? (operationalWatchList || null) : null,
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
      cohortStatus: resolveCohortEffectiveStatus(cohort),
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

async function loadDirectoryEngineMetrics(pilot: PulseCheckPilot, activeEnrollments: PulseCheckPilotEnrollment[]) {
  if (!isPilotMetricWindowOpen(pilot)) {
    return {
      engineCoverageRate: 0,
      stablePatternRate: 0,
      avgEvidenceRecordsPerActiveAthlete: 0,
      avgRecommendationProjectionsPerActiveAthlete: 0,
    };
  }

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
    redemptionMode?: 'single-use' | 'general';
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
    const response = await fetch(resolvePulseCheckFunctionUrl('/.netlify/functions/record-pilot-survey-response'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
        ...getFirebaseModeRequestHeaders(),
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

  async requestPilotOperationalWatchList(input: OperationalWatchListMutationInput): Promise<void> {
    if (pilotDashboardDemoMode.isEnabled()) {
      pilotDashboardDemoMode.requestPilotOperationalWatchList(normalizeOperationalWatchListMutationForDemo(input));
      return;
    }
    await persistOperationalWatchListState('request', input);
  },

  async applyPilotOperationalWatchList(input: OperationalWatchListMutationInput): Promise<void> {
    if (pilotDashboardDemoMode.isEnabled()) {
      pilotDashboardDemoMode.applyPilotOperationalWatchList(normalizeOperationalWatchListMutationForDemo(input));
      return;
    }
    await persistOperationalWatchListState('apply', input);
  },

  async clearPilotOperationalWatchList(input: OperationalWatchListMutationInput): Promise<void> {
    if (pilotDashboardDemoMode.isEnabled()) {
      pilotDashboardDemoMode.clearPilotOperationalWatchList(normalizeOperationalWatchListMutationForDemo(input));
      return;
    }
    await persistOperationalWatchListState('clear', input);
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
    const response = await fetch(resolvePulseCheckFunctionUrl('/.netlify/functions/recompute-pilot-outcome-rollups'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
        ...getFirebaseModeRequestHeaders(),
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
          pilot: {
            ...pilot,
            status: resolvePilotEffectiveStatus(pilot),
          },
          cohorts: pilotCohorts,
          totalEnrollmentCount: pilotEnrollments.length,
          activeEnrollmentCount: activeEnrollments.length,
          activeCohortCount: pilotCohorts.filter((cohort) => resolveCohortEffectiveStatus(cohort) === 'active').length,
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
        const [directoryMetrics, outcomeRollup, outcomeReleaseSettings, operationalWatchListStates] = await Promise.all([
          loadDirectoryEngineMetrics(entry.pilot, entry._activeEnrollments),
          loadCurrentOutcomeRollup(entry.pilot.id),
          loadPilotOutcomeReleaseSettings(entry.pilot.id),
          loadPilotOperationalWatchListStates(entry.pilot.id),
        ]);
        const outcomesEnabled = outcomeReleaseSettings?.outcomesEnabled !== false;
        return {
          ...entry,
          ...directoryMetrics,
          outcomeMetrics: outcomesEnabled ? outcomeRollup?.metrics : undefined,
          outcomeDiagnostics: outcomesEnabled ? ((outcomeRollup?.diagnostics?.surveys as PilotDashboardOutcomeSurveyDiagnostics) || undefined) : undefined,
          hypothesisEvaluation: outcomesEnabled ? ((outcomeRollup?.diagnostics?.hypothesisEvaluation as any) || undefined) : undefined,
          operationalWatchListSummary: buildOperationalWatchListSummary(operationalWatchListStates),
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

    const [organization, team, cohorts, enrollments, teamMemberships, hypotheses, operationalWatchListStates] = await Promise.all([
      pulseCheckProvisioningService.getOrganization(pilot.organizationId),
      pulseCheckProvisioningService.getTeam(pilot.teamId),
      pulseCheckProvisioningService.listPilotCohorts(),
      pulseCheckProvisioningService.listPilotEnrollmentsByPilot(pilot.id),
      pulseCheckProvisioningService.listTeamMemberships(pilot.teamId),
      listPilotHypotheses(pilot.id),
      loadPilotOperationalWatchListStates(pilot.id),
    ]);

    if (!organization || !team) return null;

    const pilotCohorts = cohorts.filter((cohort) => cohort.pilotId === pilot.id);
    if (!isPilotOperationallyActive(pilot, pilotCohorts, enrollments)) return null;
    const cohortMap = new Map(pilotCohorts.map((cohort) => [cohort.id, cohort]));
    const teamMembershipMap = new Map(teamMemberships.map((membership) => [membership.userId, membership]));
    const operationalWatchListByEnrollmentId = new Map(
      operationalWatchListStates.map((state) => [state.pilotEnrollmentId, state])
    );
    const activeEnrollments = enrollments.filter((enrollment) => enrollment.status === 'active');
    const pilotEnrollmentByAthleteId = new Map(enrollments.map((enrollment) => [enrollment.userId, enrollment]));
    const teamAthleteMemberships = teamMemberships.filter((membership) => membership.role === 'athlete');
    const rosterAthleteIds = Array.from(
      new Set([
        ...teamAthleteMemberships.map((membership) => membership.userId),
        ...enrollments.map((enrollment) => enrollment.userId),
      ])
    );
    const effectivePilot = {
      ...pilot,
      status: resolvePilotEffectiveStatus(pilot),
    };
    const athletes = await Promise.all(
      activeEnrollments.map((enrollment) =>
        buildAthleteSummary(effectivePilot, enrollment, cohortMap, teamMembershipMap, operationalWatchListByEnrollmentId.get(enrollment.id) || null)
      )
    );
    const rosterAthletes = await Promise.all(
      rosterAthleteIds.map((athleteId) =>
        buildRosterAthleteSummary(
          effectivePilot,
          athleteId,
          teamMembershipMap.get(athleteId) || null,
          pilotEnrollmentByAthleteId.get(athleteId) || null,
          cohortMap,
          (() => {
            const enrollment = pilotEnrollmentByAthleteId.get(athleteId);
            return enrollment ? operationalWatchListByEnrollmentId.get(enrollment.id) || null : null;
          })()
        )
      )
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
    const operationalWatchListSummary = buildOperationalWatchListSummary(operationalWatchListStates);
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
    const mergedOutcomeOperationalDiagnostics: PilotDashboardOutcomeOperationalDiagnostics | undefined = outcomesEnabled
      ? {
          ...((outcomeRollup?.diagnostics as Record<string, any>) || {}),
          escalations: await loadPilotEscalationOperationalDiagnostics({
            pilot,
            activeEnrollments,
            existingDiagnostics: (outcomeRollup?.diagnostics as Record<string, any> | undefined)?.escalations || null,
          }),
        }
      : undefined;

    return {
      organization,
      team,
      pilot: effectivePilot,
      cohorts: pilotCohorts,
      athletes: athletes.sort((left, right) => left.displayName.localeCompare(right.displayName)),
      rosterAthletes: rosterAthletes.sort(
        (left, right) =>
          Number(right.isEnrolled) - Number(left.isEnrolled) ||
          left.displayName.localeCompare(right.displayName)
      ),
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
      outcomeOperationalDiagnostics: mergedOutcomeOperationalDiagnostics,
      outcomeRecommendationTypeSlices: outcomesEnabled ? ((outcomeRollup?.diagnostics?.recommendationTypeSlices as Record<string, any>) || undefined) : undefined,
      outcomeRecommendationTypeSlicesByCohort:
        outcomesEnabled ? ((outcomeRollup?.diagnostics?.recommendationTypeSlicesByCohort as Record<string, Record<string, any>>) || undefined) : undefined,
      outcomeTrustDispositionBaseline: outcomesEnabled ? ((outcomeRollup?.diagnostics?.trustDispositionBaseline as Record<string, any>) || undefined) : undefined,
      outcomeReleaseSettings: outcomeReleaseSettings || undefined,
      outcomeOpsStatus: outcomeOpsStatus || undefined,
      operationalWatchListSummary,
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

    const [organization, team, enrollment, cohorts, teamMemberships, engineSummary, operationalWatchList] = await Promise.all([
      pulseCheckProvisioningService.getOrganization(pilot.organizationId),
      pulseCheckProvisioningService.getTeam(pilot.teamId),
      pulseCheckProvisioningService.getPilotEnrollment(pilotId, athleteId),
      pulseCheckProvisioningService.listPilotCohorts(),
      pulseCheckProvisioningService.listTeamMemberships(pilot.teamId),
      isPilotMetricWindowOpen(pilot) ? loadEngineSummaryForAthlete(athleteId) : Promise.resolve(buildEmptyEngineSummary()),
      loadAthleteOperationalWatchListState(athleteId),
    ]);

    const pilotCohorts = cohorts.filter((entry) => entry.pilotId === pilotId);
    if (!isPilotOperationallyActive(pilot, pilotCohorts, enrollment ? [enrollment] : [])) return null;
    if (!organization || !team || !enrollment || enrollment.status !== 'active') return null;
    const effectivePilot = {
      ...pilot,
      status: resolvePilotEffectiveStatus(pilot),
    };

    const teamMembership = teamMemberships.find((membership) => membership.userId === athleteId) || null;
    const athleteProfile = (await loadAthleteProfileSummary(athleteId, teamMembership, team.sportOrProgram)).profile;
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
    const outcomeDetail = await loadAthleteOutcomeDetail({
      pilot: effectivePilot,
      athleteId,
      pilotEnrollment: enrollment,
      teamMembership,
      operationalWatchList,
    });

    return {
      organization,
      team,
      pilot: effectivePilot,
      cohort,
      pilotEnrollment: enrollment,
      teamMembership,
      operationalWatchList,
      displayName: buildAthleteLabel(teamMembership, athleteId, enrollment, athleteProfile),
      email: normalizeString(teamMembership?.email) || athleteProfile.email,
      profile: athleteProfile,
      engineSummary,
      profileSnapshotCount: snapshots.length,
      latestAssessmentContextFlagStatus,
      latestAssessmentCapturedAt: toTimeValue(latestSnapshot?.capturedAt),
      mentalPerformanceSnapshots,
      adherenceSummary: outcomeDetail.adherenceSummary,
      adherenceDays: outcomeDetail.adherenceDays,
      escalations: outcomeDetail.escalations,
      recentPatterns: timelineItems.recentPatterns,
      recentProjections: timelineItems.recentProjections,
      recentEvidence: timelineItems.recentEvidence,
      snapshotHistory: buildSnapshotHistoryItems(snapshots),
    };
  },
};
