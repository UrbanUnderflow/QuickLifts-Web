const { admin } = require('../config/firebase');
const profileSnapshotRuntime = require('../../../src/api/firebase/mentaltraining/profileSnapshotRuntime.js');

const PILOT_ENROLLMENTS_COLLECTION = 'pulsecheck-pilot-enrollments';
const TEAM_MEMBERSHIPS_COLLECTION = 'pulsecheck-team-memberships';
const ATHLETE_PROGRESS_COLLECTION = 'athlete-mental-progress';
const PILOT_METRIC_EVENTS_COLLECTION = 'pulsecheck-pilot-metric-events';
const PILOT_SURVEY_RESPONSES_COLLECTION = 'pulsecheck-pilot-survey-responses';
const PILOT_METRIC_ROLLUPS_COLLECTION = 'pulsecheck-pilot-metric-rollups';
const PILOT_METRIC_ROLLUP_SUMMARY_SUBCOLLECTION = 'summary';
const PILOT_METRIC_ROLLUP_DAILY_SUBCOLLECTION = 'daily';
const PILOT_MENTAL_PERFORMANCE_SNAPSHOTS_SUBCOLLECTION = 'mental-performance-snapshots';
const PILOT_METRIC_OPS_COLLECTION = 'pulsecheck-pilot-metric-ops';
const PILOT_METRIC_OPS_MIGRATIONS_SUBCOLLECTION = 'migrations';
const PILOTS_COLLECTION = 'pulsecheck-pilots';
const DAILY_ASSIGNMENTS_COLLECTION = 'pulsecheck-daily-assignments';
const ESCALATION_RECORDS_COLLECTION = 'escalation-records';
const PILOT_OPERATIONAL_STATES_COLLECTION = 'pulsecheck-pilot-operational-states';
const PILOT_OPERATIONAL_STATE_ACTIONS_SUBCOLLECTION = 'actions';
const ASSIGNMENT_EVENTS_COLLECTION = 'pulsecheck-assignment-events';
const CHECKINS_ROOT = 'mental-check-ins';
const CHECKINS_SUBCOLLECTION = 'check-ins';
const SURVEY_RECLASSIFICATION_MIGRATION_KEY = 'pilot_outcome_survey_reclassification_v1';
const ESCALATION_RECLASSIFICATION_MIGRATION_KEY = 'pilot_outcome_escalation_reclassification_v1';

const FRESHNESS_WINDOW_DAYS = 14;
const FRESHNESS_WINDOW_MS = FRESHNESS_WINDOW_DAYS * 24 * 60 * 60 * 1000;
const SURVEY_MINIMUM_RESPONSE_THRESHOLD = 5;
const SURVEY_PROMPT_COOLDOWN_DAYS = 14;
const ACTIVATION_DAY_CUTOFF_HOUR = 12;
const ROLLUP_REPAIR_LOOKBACK_DAYS = 30;
const OUTCOME_BACKFILL_LOOKBACK_DAYS = 14;

const TRUST_BATTERY_ITEM_KEYS = [
  'credibility',
  'reliability',
  'honesty_safety',
  'athlete_interest',
  'practical_usefulness',
];

const TRUST_BATTERY_VERSION = 'athlete_trust_battery_v1';
const TRUST_DISPOSITION_BASELINE_VERSION = 'ptt_v1';

const OUTCOME_ROLLUP_RECOMPUTE_MODE = 'hybrid';
const OUTCOME_V1_CARD_ORDER = [
  'enrollment',
  'adherence',
  'escalations',
  'speed_to_care',
  'athlete_trust',
  'athlete_nps',
];

const NO_TASK_ASSIGNMENT_ACTION_TYPES = new Set([
  'defer',
  'rest',
  'rest_day',
  'rest-day',
  'no_task',
  'no-task',
  'off_day',
  'off-day',
  'none',
]);

const NO_TASK_ASSIGNMENT_STATUSES = new Set([
  'deferred',
  'rest',
  'rest_day',
  'rest-day',
  'no_task',
  'no-task',
  'off_day',
  'off-day',
  'none',
]);

const ESCALATION_STATUS_ORDER = ['active', 'resolved', 'declined'];
const ESCALATION_MIGRATION_DEDUPE_WINDOW_MINUTES = 30;
const ESCALATION_MIGRATION_DEDUPE_WINDOW_SECONDS = ESCALATION_MIGRATION_DEDUPE_WINDOW_MINUTES * 60;
const OPERATIONAL_STATUS_NORMAL = 'normal';
const OPERATIONAL_STATUS_PAUSED = 'paused';
const OPERATIONAL_STATUS_WITHDRAWN = 'withdrawn';
const OPERATIONAL_STATE_VERSION = 'operational_state_v1';
const WATCH_LIST_REASON_CODES = new Set([
  'clinical_review_pending',
  'manual_safety_hold',
  'temporary_restriction',
  'care_team_requested_pause',
  'operational_hold',
  'other',
]);

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeNumber(value) {
  const next = Number(value);
  return Number.isFinite(next) ? next : null;
}

function normalizeBoolean(value, fallback = false) {
  if (value === undefined || value === null) return Boolean(fallback);
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'y', 'on'].includes(normalized)) return true;
    if (['false', '0', 'no', 'n', 'off', ''].includes(normalized)) return false;
  }
  return Boolean(value);
}

function normalizeOperationalBaseStatus(value) {
  const normalized = normalizeString(value).toLowerCase();
  if (normalized === OPERATIONAL_STATUS_PAUSED || normalized === OPERATIONAL_STATUS_WITHDRAWN) {
    return normalized;
  }
  return OPERATIONAL_STATUS_NORMAL;
}

function normalizeWatchListReasonCode(value) {
  const normalized = normalizeString(value).toLowerCase().replace(/[\s-]+/g, '_');
  if (!normalized) return 'other';
  return WATCH_LIST_REASON_CODES.has(normalized) ? normalized : 'other';
}

function coerceMillis(value) {
  if (!value) return null;
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value > 1e12 ? value : value * 1000;
  }
  if (typeof value?.toMillis === 'function') return value.toMillis();
  if (typeof value?.toDate === 'function') return value.toDate().getTime();
  if (value instanceof Date) return value.getTime();
  return null;
}

function timestampFromMillis(value) {
  const millis = coerceMillis(value) ?? Date.now();
  return admin.firestore.Timestamp.fromMillis(millis);
}

function stableSerialize(value) {
  if (value === null || value === undefined) return 'null';
  if (typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((entry) => stableSerialize(entry)).join(',')}]`;

  const entries = Object.entries(value).sort(([left], [right]) => left.localeCompare(right));
  return `{${entries.map(([key, nested]) => `${JSON.stringify(key)}:${stableSerialize(nested)}`).join(',')}}`;
}

function hashString(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a_${(hash >>> 0).toString(16)}`;
}

function roundMetric(value) {
  return Math.round(Number(value || 0) * 10) / 10;
}

function clampScore(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, roundMetric(value)));
}

function average(values) {
  if (!Array.isArray(values) || !values.length) return null;
  return roundMetric(values.reduce((sum, value) => sum + Number(value || 0), 0) / values.length);
}

function averageFromNullable(values) {
  const normalized = (Array.isArray(values) ? values : [])
    .map((value) => normalizeNumber(value))
    .filter((value) => value !== null);
  return normalized.length ? average(normalized) : null;
}

function calculatePercentile(values = [], percentile = 0.75) {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((sorted.length * percentile) - 1)));
  return roundMetric(sorted[index]);
}

function sanitizeSurveyComment(comment) {
  if (typeof comment !== 'string') return undefined;
  const trimmed = comment.trim();
  return trimmed ? trimmed.slice(0, 2000) : undefined;
}

function normalizeTrustDispositionBaseline(value) {
  if (!value || typeof value !== 'object') return null;
  const score = normalizeNumber(value.score);
  if (score === null || score < 0 || score > 10) return null;

  return {
    kind: 'ptt',
    version: normalizeString(value.version) || TRUST_DISPOSITION_BASELINE_VERSION,
    score: roundMetric(score),
    capturedAt: coerceMillis(value.capturedAt) || Date.now(),
    source: normalizeString(value.source) || 'ios',
    itemResponses: Array.isArray(value.itemResponses)
      ? value.itemResponses
          .map((entry) => ({
            key: normalizeString(entry?.key),
            score: normalizeNumber(entry?.score),
          }))
          .filter((entry) => entry.key && entry.score !== null)
      : [],
  };
}

function normalizeTimezone(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    Intl.DateTimeFormat('en-US', { timeZone: value.trim() }).format(new Date());
    return value.trim();
  } catch (error) {
    return null;
  }
}

function toUtcDateKey(input) {
  const millis = coerceMillis(input);
  if (!millis) return '';
  return new Date(millis).toISOString().slice(0, 10);
}

function resolveTimezoneDateParts(timestampMs, timezone) {
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
  const map = parts.reduce((accumulator, part) => {
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
}

function formatDateKeyFromParts(parts) {
  return [
    String(parts.year).padStart(4, '0'),
    String(parts.month).padStart(2, '0'),
    String(parts.day).padStart(2, '0'),
  ].join('-');
}

function shiftUtcDateKey(dateKey, deltaDays) {
  if (!dateKey) return '';
  const [year, month, day] = String(dateKey).split('-').map((segment) => Number(segment));
  const shifted = new Date(Date.UTC(year, month - 1, day + deltaDays));
  return shifted.toISOString().slice(0, 10);
}

function toTimezoneDateKey(timestampMs, timezone) {
  if (!timestampMs) return '';
  return formatDateKeyFromParts(resolveTimezoneDateParts(timestampMs, timezone));
}

function startOfUtcDayMs(dateKey) {
  if (!dateKey) return 0;
  return Date.parse(`${dateKey}T00:00:00.000Z`);
}

function endOfUtcDayMs(dateKey) {
  const start = startOfUtcDayMs(dateKey);
  return start ? start + (24 * 60 * 60 * 1000) - 1 : 0;
}

function listDateKeysBetween(startDateKey, endDateKey) {
  if (!startDateKey || !endDateKey) return [];
  const values = [];
  let cursor = startDateKey;
  while (cursor <= endDateKey) {
    values.push(cursor);
    cursor = shiftUtcDateKey(cursor, 1);
  }
  return values;
}

async function writePilotMetricOpsStatus({
  db,
  pilotId,
  scope,
  status,
  details = {},
}) {
  const normalizedPilotId = normalizeString(pilotId);
  const normalizedScope = normalizeString(scope) || 'unknown';
  if (!db || !normalizedPilotId) return null;

  const nowMs = Date.now();
  const rootRef = db.collection(PILOT_METRIC_OPS_COLLECTION).doc(normalizedPilotId);
  const scopeRef = rootRef.collection('scopes').doc(normalizedScope);
  const payload = {
    pilotId: normalizedPilotId,
    scope: normalizedScope,
    status: normalizeString(status) || 'unknown',
    lastUpdatedAt: timestampFromMillis(nowMs),
    lastUpdatedAtMs: nowMs,
    ...(details && typeof details === 'object' ? details : {}),
  };

  await rootRef.set(
    {
      id: normalizedPilotId,
      pilotId: normalizedPilotId,
      updatedAt: timestampFromMillis(nowMs),
      updatedAtMs: nowMs,
    },
    { merge: true }
  );
  await scopeRef.set(payload, { merge: true });
  return payload;
}

async function recordPilotMetricAlert({
  db,
  pilotId,
  scope,
  severity = 'error',
  message,
  context = {},
}) {
  const normalizedPilotId = normalizeString(pilotId);
  if (!db || !normalizedPilotId) return null;
  const nowMs = Date.now();
  const alertRef = db.collection(PILOT_METRIC_OPS_COLLECTION)
    .doc(normalizedPilotId)
    .collection('alerts')
    .doc();

  const payload = {
    id: alertRef.id,
    pilotId: normalizedPilotId,
    scope: normalizeString(scope) || 'unknown',
    severity: normalizeString(severity) || 'error',
    message: normalizeString(message) || 'Pilot metric alert',
    context: context && typeof context === 'object' ? context : {},
    createdAt: timestampFromMillis(nowMs),
    createdAtMs: nowMs,
  };

  await alertRef.set(payload);
  return payload;
}

function normalizeConsentIds(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => normalizeString(entry))
    .filter((entry, index, values) => entry && values.indexOf(entry) === index);
}

function hasCompletedRequiredConsents(onboarding = {}, enrollment = {}) {
  const membershipConsentIds = normalizeConsentIds(onboarding.completedConsentIds);
  const enrollmentConsentIds = normalizeConsentIds(enrollment.completedConsentIds);
  const completed = new Set([...membershipConsentIds, ...enrollmentConsentIds]);
  const requiredConsentIds = normalizeConsentIds(enrollment.requiredConsentIds);

  if (!requiredConsentIds.length) {
    return true;
  }

  return requiredConsentIds.every((consentId) => completed.has(consentId));
}

function isEnrollmentComplete({ teamMembership, pilotEnrollment }) {
  const onboarding = teamMembership?.athleteOnboarding || {};
  const baselineComplete = normalizeString(onboarding.baselinePathStatus) === 'complete';
  const entryOnboardingComplete = normalizeString(onboarding.entryOnboardingStep) === 'complete';
  const productConsentAccepted = Boolean(onboarding.productConsentAccepted || pilotEnrollment?.productConsentAccepted);

  return entryOnboardingComplete
    && productConsentAccepted
    && hasCompletedRequiredConsents(onboarding, pilotEnrollment || {})
    && baselineComplete;
}

function buildMetricEventDocumentId({
  pilotEnrollmentId,
  pilotId,
  athleteId,
  eventType,
  sourceCollection,
  sourceDocumentId,
  sourceDate,
}) {
  return hashString(
    stableSerialize({
      pilotEnrollmentId: normalizeString(pilotEnrollmentId) || null,
      pilotId: normalizeString(pilotId) || null,
      athleteId: normalizeString(athleteId) || null,
      eventType: normalizeString(eventType),
      sourceCollection: normalizeString(sourceCollection) || null,
      sourceDocumentId: normalizeString(sourceDocumentId) || null,
      sourceDate: normalizeString(sourceDate) || null,
    })
  );
}

async function loadTeamMembershipForAthlete({
  db,
  athleteId,
  preferredTeamMembershipId,
}) {
  try {
    if (preferredTeamMembershipId) {
      const preferredSnap = await db.collection(TEAM_MEMBERSHIPS_COLLECTION).doc(preferredTeamMembershipId).get();
      if (preferredSnap.exists) {
        return {
          id: preferredSnap.id,
          ...(preferredSnap.data() || {}),
        };
      }
    }

    const membershipQuery = db.collection(TEAM_MEMBERSHIPS_COLLECTION);
    if (typeof membershipQuery.where !== 'function') {
      return null;
    }

    const membershipSnap = await membershipQuery
      .where('userId', '==', athleteId)
      .where('role', '==', 'athlete')
      .limit(10)
      .get();

    if (membershipSnap.empty) {
      return null;
    }

    const membershipDocs = membershipSnap.docs.map((docSnap) => ({
      id: docSnap.id,
      ...(docSnap.data() || {}),
    }));

    membershipDocs.sort((left, right) => {
      const rightPilot = normalizeString(right.athleteOnboarding?.targetPilotId);
      const leftPilot = normalizeString(left.athleteOnboarding?.targetPilotId);
      if (rightPilot && !leftPilot) return 1;
      if (leftPilot && !rightPilot) return -1;
      return (coerceMillis(right.updatedAt) || 0) - (coerceMillis(left.updatedAt) || 0);
    });

    return membershipDocs[0] || null;
  } catch (error) {
    return null;
  }
}

async function resolvePilotEnrollmentContext({
  db,
  athleteId,
  preferredPilotEnrollmentId,
  preferredPilotId,
  preferredTeamMembershipId,
  allowMembershipFallback = true,
}) {
  const normalizedAthleteId = normalizeString(athleteId);
  if (!normalizedAthleteId) return null;

  let membership = await loadTeamMembershipForAthlete({
    db,
    athleteId: normalizedAthleteId,
    preferredTeamMembershipId,
  });
  const onboarding = membership?.athleteOnboarding || {};

  const candidateRefs = [];
  if (preferredPilotEnrollmentId) {
    candidateRefs.push(db.collection(PILOT_ENROLLMENTS_COLLECTION).doc(preferredPilotEnrollmentId));
  }

  const onboardingPilotId = normalizeString(onboarding.targetPilotId);
  const resolvedPilotId = normalizeString(preferredPilotId) || onboardingPilotId;
  if (resolvedPilotId) {
    candidateRefs.push(db.collection(PILOT_ENROLLMENTS_COLLECTION).doc(`${resolvedPilotId}_${normalizedAthleteId}`));
  }

  for (const ref of candidateRefs) {
    const snap = await ref.get();
    if (snap.exists) {
      const enrollment = { id: snap.id, ...(snap.data() || {}) };
      if (!membership && enrollment.teamMembershipId) {
        membership = await loadTeamMembershipForAthlete({
          db,
          athleteId: normalizedAthleteId,
          preferredTeamMembershipId: enrollment.teamMembershipId,
        });
      }
      return {
        pilotEnrollmentId: enrollment.id,
        pilotId: normalizeString(enrollment.pilotId),
        organizationId: normalizeString(enrollment.organizationId || membership?.organizationId),
        teamId: normalizeString(enrollment.teamId || membership?.teamId),
        cohortId: normalizeString(enrollment.cohortId || onboarding.targetCohortId) || null,
        athleteId: normalizedAthleteId,
        teamMembershipId: normalizeString(enrollment.teamMembershipId || membership?.id) || null,
        teamMembership: membership,
        pilotEnrollment: enrollment,
      };
    }
  }

  let enrollmentSnap = { docs: [], empty: true };
  try {
    const enrollmentQuery = db.collection(PILOT_ENROLLMENTS_COLLECTION);
    if (typeof enrollmentQuery.where !== 'function') {
      return allowMembershipFallback && membership
        ? {
            pilotEnrollmentId: null,
            pilotId: resolvedPilotId || null,
            organizationId: normalizeString(membership.organizationId),
            teamId: normalizeString(membership.teamId),
            cohortId: normalizeString(onboarding.targetCohortId) || null,
            athleteId: normalizedAthleteId,
            teamMembershipId: membership.id,
            teamMembership: membership,
            pilotEnrollment: null,
          }
        : null;
    }

    enrollmentSnap = await enrollmentQuery
      .where('userId', '==', normalizedAthleteId)
      .limit(20)
      .get();
  } catch (error) {
    enrollmentSnap = { docs: [], empty: true };
  }

  const candidateEnrollments = enrollmentSnap.docs
    .map((docSnap) => ({ id: docSnap.id, ...(docSnap.data() || {}) }))
    .filter((entry) => {
      if (resolvedPilotId && normalizeString(entry.pilotId) !== resolvedPilotId) return false;
      return ['active', 'pending-consent', 'paused', 'completed'].includes(normalizeString(entry.status));
    })
    .sort((left, right) => (coerceMillis(right.updatedAt) || 0) - (coerceMillis(left.updatedAt) || 0));

  if (candidateEnrollments.length) {
    const enrollment = candidateEnrollments[0];
    if (!membership && enrollment.teamMembershipId) {
      membership = await loadTeamMembershipForAthlete({
        db,
        athleteId: normalizedAthleteId,
        preferredTeamMembershipId: enrollment.teamMembershipId,
      });
    }
    return {
      pilotEnrollmentId: enrollment.id,
      pilotId: normalizeString(enrollment.pilotId || resolvedPilotId),
      organizationId: normalizeString(enrollment.organizationId || membership?.organizationId),
      teamId: normalizeString(enrollment.teamId || membership?.teamId),
      cohortId: normalizeString(enrollment.cohortId || onboarding.targetCohortId) || null,
      athleteId: normalizedAthleteId,
      teamMembershipId: normalizeString(enrollment.teamMembershipId || membership?.id) || null,
      teamMembership: membership,
      pilotEnrollment: enrollment,
    };
  }

  if (!allowMembershipFallback || !membership) {
    return null;
  }

  return {
    pilotEnrollmentId: null,
    pilotId: resolvedPilotId || null,
    organizationId: normalizeString(membership.organizationId),
    teamId: normalizeString(membership.teamId),
    cohortId: normalizeString(onboarding.targetCohortId) || null,
    athleteId: normalizedAthleteId,
    teamMembershipId: membership.id,
    teamMembership: membership,
    pilotEnrollment: null,
  };
}

function deriveBaselineProbeProfile(progress = {}) {
  const baselineProbe = progress.baselineProbe || {};
  const focusAccuracy = clampScore((normalizeNumber(baselineProbe.focusAccuracy) ?? 0.5) * 100);
  const decisionAccuracy = clampScore((normalizeNumber(baselineProbe.decisionAccuracy) ?? 0.5) * 100);
  const decisionFalseStarts = Math.max(0, normalizeNumber(baselineProbe.decisionFalseStarts) ?? 0);
  const composureRecoveryMs = Math.max(1500, normalizeNumber(baselineProbe.composureRecoveryMs) ?? 4500);
  const composureRecoveryScore = clampScore(100 - (((composureRecoveryMs - 1500) / 4500) * 100));
  const composureConsistency = clampScore((normalizeNumber(baselineProbe.composureConsistency) ?? 0.5) * 100);

  const skillScores = {
    sustained_attention: focusAccuracy,
    selective_attention: focusAccuracy,
    attentional_shifting: clampScore((focusAccuracy + composureConsistency) / 2),
    error_recovery_speed: composureRecoveryScore,
    emotional_interference_control: clampScore((composureRecoveryScore + composureConsistency) / 2),
    pressure_stability: clampScore((composureRecoveryScore + composureConsistency) / 2),
    response_inhibition: clampScore(decisionAccuracy - (decisionFalseStarts * 8)),
    working_memory_updating: clampScore(decisionAccuracy),
    cue_discrimination: clampScore((focusAccuracy + decisionAccuracy) / 2),
  };

  const pillarScores = {
    focus: clampScore((skillScores.sustained_attention + skillScores.selective_attention + skillScores.attentional_shifting) / 3),
    composure: clampScore((skillScores.error_recovery_speed + skillScores.emotional_interference_control + skillScores.pressure_stability) / 3),
    decision: clampScore((skillScores.response_inhibition + skillScores.working_memory_updating + skillScores.cue_discrimination) / 3),
  };

  const modifierScores = {
    readiness: 50,
    fatigability: clampScore((100 - focusAccuracy) + 40, 0, 100),
    consistency: composureConsistency,
    pressure_sensitivity: clampScore((100 - composureRecoveryScore) + 20, 0, 100),
  };

  const sortedSkillsAsc = Object.entries(skillScores)
    .sort((left, right) => left[1] - right[1])
    .map(([key]) => key);
  const sortedSkillsDesc = [...sortedSkillsAsc].reverse();

  return {
    overallScore: clampScore(
      (
        pillarScores.focus
        + pillarScores.composure
        + pillarScores.decision
        + modifierScores.readiness
        + modifierScores.fatigability
        + modifierScores.consistency
        + modifierScores.pressure_sensitivity
      ) / 7
    ),
    pillarScores,
    skillScores,
    modifierScores,
    pressureSensitivity: {
      evaluative_threat: clampScore(100 - composureConsistency),
      uncertainty: clampScore(100 - decisionAccuracy),
      visual_distraction: clampScore(100 - focusAccuracy),
    },
    strongestSkills: sortedSkillsDesc.slice(0, 3),
    weakestSkills: sortedSkillsAsc.slice(0, 3),
    trendSummary: [
      `Baseline probe established focus at ${Math.round(pillarScores.focus)}.`,
      `Baseline probe established composure at ${Math.round(pillarScores.composure)}.`,
      `Baseline probe established decision at ${Math.round(pillarScores.decision)}.`,
    ],
    updatedAt: coerceMillis(baselineProbe.completedAt) || Date.now(),
  };
}

function resolveProfileForSnapshot(progress = {}, snapshotType) {
  if (snapshotType === 'baseline') {
    if (progress.baselineProbe) {
      return deriveBaselineProbeProfile(progress);
    }
    if (progress.baselineAssessment) {
      return profileSnapshotRuntime.bootstrapTaxonomyProfile(progress.baselineAssessment);
    }
  }

  if (progress.taxonomyProfile) {
    return progress.taxonomyProfile;
  }

  if (progress.baselineProbe) {
    return deriveBaselineProbeProfile(progress);
  }

  return null;
}

function computePillarCompositeScore(profile) {
  if (!profile?.pillarScores) return null;
  const values = ['focus', 'composure', 'decision']
    .map((pillar) => normalizeNumber(profile.pillarScores[pillar]))
    .filter((value) => value !== null);
  return average(values);
}

function clonePlainProfile(profile) {
  if (!profile) return null;
  return {
    overallScore: normalizeNumber(profile.overallScore) ?? null,
    pillarScores: {
      focus: normalizeNumber(profile.pillarScores?.focus) ?? null,
      composure: normalizeNumber(profile.pillarScores?.composure) ?? null,
      decision: normalizeNumber(profile.pillarScores?.decision) ?? null,
    },
    skillScores: { ...(profile.skillScores || {}) },
    modifierScores: { ...(profile.modifierScores || {}) },
    strongestSkills: Array.isArray(profile.strongestSkills) ? [...profile.strongestSkills] : [],
    weakestSkills: Array.isArray(profile.weakestSkills) ? [...profile.weakestSkills] : [],
    trendSummary: Array.isArray(profile.trendSummary) ? [...profile.trendSummary] : [],
    updatedAt: normalizeNumber(profile.updatedAt) ?? Date.now(),
  };
}

function buildDeltaFromBaseline(profile, baselineSnapshot) {
  const baselineProfile = baselineSnapshot?.taxonomyProfile;
  if (!profile?.pillarScores || !baselineProfile?.pillarScores) {
    return null;
  }

  const focus = roundMetric((normalizeNumber(profile.pillarScores.focus) ?? 0) - (normalizeNumber(baselineProfile.pillarScores.focus) ?? 0));
  const composure = roundMetric((normalizeNumber(profile.pillarScores.composure) ?? 0) - (normalizeNumber(baselineProfile.pillarScores.composure) ?? 0));
  const decision = roundMetric((normalizeNumber(profile.pillarScores.decision) ?? 0) - (normalizeNumber(baselineProfile.pillarScores.decision) ?? 0));
  const baselineComposite = normalizeNumber(baselineSnapshot?.pillarCompositeScore) ?? 0;
  const currentComposite = computePillarCompositeScore(profile) ?? 0;

  return {
    focus,
    composure,
    decision,
    pillarComposite: roundMetric(currentComposite - baselineComposite),
  };
}

async function emitPilotMetricEvent({
  db,
  pilotContext,
  eventType,
  actorRole = 'system',
  actorUserId = null,
  athleteId,
  sourceCollection = null,
  sourceDocumentId = null,
  sourceDate = null,
  metricPayload = null,
  createdAt = Date.now(),
}) {
  let context = pilotContext || null;
  if ((!context?.pilotId && !context?.pilotEnrollmentId) && (athleteId || context?.athleteId)) {
    context = await resolvePilotEnrollmentContext({
      db,
      athleteId: athleteId || context?.athleteId,
      preferredPilotEnrollmentId: context?.pilotEnrollmentId,
      preferredPilotId: context?.pilotId,
      preferredTeamMembershipId: context?.teamMembershipId,
      allowMembershipFallback: false,
    });
  }

  if (!context?.pilotId && !context?.pilotEnrollmentId) {
    return null;
  }

  const eventDocId = buildMetricEventDocumentId({
    pilotEnrollmentId: context?.pilotEnrollmentId,
    pilotId: context?.pilotId,
    athleteId: athleteId || context?.athleteId,
    eventType,
    sourceCollection,
    sourceDocumentId,
    sourceDate,
  });

  const eventRef = db.collection(PILOT_METRIC_EVENTS_COLLECTION).doc(eventDocId);
  const payload = {
    id: eventDocId,
    pilotEnrollmentId: context?.pilotEnrollmentId || null,
    pilotId: context?.pilotId || null,
    organizationId: context?.organizationId || null,
    teamId: context?.teamId || null,
    cohortId: context?.cohortId || null,
    athleteId: athleteId || context?.athleteId || null,
    actorUserId: normalizeString(actorUserId) || null,
    actorRole: normalizeString(actorRole) || 'system',
    eventType,
    sourceCollection: normalizeString(sourceCollection) || null,
    sourceDocumentId: normalizeString(sourceDocumentId) || null,
    sourceDate: normalizeString(sourceDate) || null,
    metricPayload: metricPayload && typeof metricPayload === 'object' ? metricPayload : null,
    createdAt: timestampFromMillis(createdAt),
    createdAtMs: coerceMillis(createdAt) || Date.now(),
  };

  await eventRef.set(payload, { merge: true });
  return payload;
}

async function upsertPilotMentalPerformanceSnapshot({
  db,
  athleteId,
  snapshotType,
  preferredPilotEnrollmentId,
  preferredPilotId,
  preferredTeamMembershipId,
  sourceEventId = null,
  endpointFreeze = null,
}) {
  const pilotContext = await resolvePilotEnrollmentContext({
    db,
    athleteId,
    preferredPilotEnrollmentId,
    preferredPilotId,
    preferredTeamMembershipId,
    allowMembershipFallback: false,
  });

  if (!pilotContext?.pilotEnrollmentId) {
    return null;
  }

  const progressSnap = await db.collection(ATHLETE_PROGRESS_COLLECTION).doc(athleteId).get();
  const progress = progressSnap.exists ? (progressSnap.data() || {}) : {};
  const profile = resolveProfileForSnapshot(progress, snapshotType);
  const baselineRef = db
    .collection(PILOT_ENROLLMENTS_COLLECTION)
    .doc(pilotContext.pilotEnrollmentId)
    .collection(PILOT_MENTAL_PERFORMANCE_SNAPSHOTS_SUBCOLLECTION)
    .doc('baseline');
  const baselineSnap = await baselineRef.get();
  const baselineSnapshot = baselineSnap.exists ? (baselineSnap.data() || {}) : null;

  const capturedAt =
    snapshotType === 'baseline'
      ? coerceMillis(progress.baselineProbe?.completedAt || progress.baselineAssessment?.completedAt)
      : coerceMillis(progress.lastProfileSyncAt || progress.updatedAt);
  const computedAt = Date.now();
  const hasBaselineAssessment = Boolean(progress.baselineProbe || progress.baselineAssessment || baselineSnapshot);
  const freshnessWindowDays = snapshotType === 'current_latest_valid' ? FRESHNESS_WINDOW_DAYS : null;
  const hasRecentProfile = Boolean(capturedAt && computedAt - capturedAt <= FRESHNESS_WINDOW_MS);

  let status = 'valid';
  let exclusionReason = null;

  if (!profile || !capturedAt) {
    status = 'missing';
    exclusionReason = snapshotType === 'current_latest_valid' ? 'missing_current' : 'missing_baseline';
  } else if (snapshotType === 'current_latest_valid' && !hasRecentProfile) {
    status = 'stale';
    exclusionReason = 'stale_current';
  }

  const taxonomyProfile = clonePlainProfile(profile);
  const pillarCompositeScore = computePillarCompositeScore(taxonomyProfile);
  const targetDeltaFromBaseline =
    snapshotType === 'baseline'
      ? {
          focus: 0,
          composure: 0,
          decision: 0,
          pillarComposite: 0,
        }
      : buildDeltaFromBaseline(taxonomyProfile, baselineSnapshot);

  const snapshotRef = db
    .collection(PILOT_ENROLLMENTS_COLLECTION)
    .doc(pilotContext.pilotEnrollmentId)
    .collection(PILOT_MENTAL_PERFORMANCE_SNAPSHOTS_SUBCOLLECTION)
    .doc(snapshotType);

  const payload = {
    id: snapshotType,
    pilotEnrollmentId: pilotContext.pilotEnrollmentId,
    pilotId: pilotContext.pilotId,
    organizationId: pilotContext.organizationId,
    teamId: pilotContext.teamId,
    cohortId: pilotContext.cohortId || null,
    athleteId,
    snapshotType,
    status,
    capturedAt: capturedAt || null,
    capturedAtTimestamp: capturedAt ? timestampFromMillis(capturedAt) : null,
    computedAt,
    computedAtTimestamp: timestampFromMillis(computedAt),
    freshnessWindowDays,
    sourceProfileVersion: normalizeString(progress.profileVersion || profileSnapshotRuntime.PROFILE_VERSION) || profileSnapshotRuntime.PROFILE_VERSION,
    sourceWriterVersion: profileSnapshotRuntime.SNAPSHOT_WRITER_VERSION,
    sourceEventId: normalizeString(sourceEventId) || null,
    sourceCanonicalProfileSnapshotKey: null,
    sourceCanonicalProfileSnapshotRevision: null,
    taxonomyProfile,
    pillarCompositeScore,
    targetDeltaFromBaseline: targetDeltaFromBaseline || null,
    validity: {
      hasBaselineAssessment,
      hasRecentProfile,
      excludedFromHeadlineDelta:
        snapshotType === 'baseline'
          ? status !== 'valid'
          : status !== 'valid' || !hasBaselineAssessment || !targetDeltaFromBaseline,
      exclusionReason:
        exclusionReason
        || (snapshotType !== 'baseline' && !hasBaselineAssessment ? 'missing_baseline' : null),
    },
    endpointFreeze: {
      frozen: Boolean(endpointFreeze?.frozen),
      frozenAt: endpointFreeze?.frozenAt || null,
      freezeReason: endpointFreeze?.freezeReason || null,
    },
    updatedAt: timestampFromMillis(computedAt),
    updatedAtMs: computedAt,
  };

  await snapshotRef.set(payload, { merge: true });
  return payload;
}

function normalizeTrustBatteryItem(entry) {
  if (!entry || typeof entry !== 'object') {
    return null;
  }

  const key = normalizeString(entry.key);
  if (!TRUST_BATTERY_ITEM_KEYS.includes(key)) {
    return null;
  }

  const score = normalizeNumber(entry.score);
  if (score === null || score < 0 || score > 10) {
    return {
      key,
      score: null,
      completed: false,
      prompt: normalizeString(entry.prompt) || null,
    };
  }

  return {
    key,
    score: roundMetric(score),
    completed: true,
    prompt: normalizeString(entry.prompt) || null,
  };
}

function normalizeSurveyMetricPayload(rawPayload, surveyKind, comment) {
  if (!rawPayload || typeof rawPayload !== 'object' || Array.isArray(rawPayload)) {
    const fallbackComment = sanitizeSurveyComment(comment);
    return fallbackComment ? { comment: fallbackComment } : null;
  }

  const payload = {};
  const normalizedComment = sanitizeSurveyComment(rawPayload.comment ?? comment);
  if (normalizedComment) {
    payload.comment = normalizedComment;
  }

  if (surveyKind === 'trust') {
    const rawDrivers = rawPayload.drivers;
    if (rawDrivers && typeof rawDrivers === 'object' && !Array.isArray(rawDrivers)) {
      const normalizedDrivers = {
        credibility: rawDrivers.credibility === true,
        reliability: rawDrivers.reliability === true,
        safety: rawDrivers.safety === true,
        relevance: rawDrivers.relevance === true,
        usefulness: rawDrivers.usefulness === true,
      };
      payload.drivers = normalizedDrivers;
      payload.driverCount = Object.values(normalizedDrivers).filter(Boolean).length;
    } else if (normalizeNumber(rawPayload.driverCount) !== null) {
      payload.driverCount = Math.max(0, Math.round(normalizeNumber(rawPayload.driverCount)));
    }
  }

  return Object.keys(payload).length ? payload : null;
}

function buildTrustBatteryPayloadFromMetricPayload(metricPayload) {
  const rawDrivers = metricPayload?.drivers;
  if (!rawDrivers || typeof rawDrivers !== 'object' || Array.isArray(rawDrivers)) {
    return null;
  }

  const driverKeyMap = {
    credibility: 'credibility',
    reliability: 'reliability',
    safety: 'honesty_safety',
    relevance: 'athlete_interest',
    usefulness: 'practical_usefulness',
  };

  const items = Object.entries(driverKeyMap).map(([driverId, legacyKey]) => ({
    key: legacyKey,
    score: rawDrivers[driverId] === true ? 10 : 0,
    completed: true,
    prompt: null,
  }));

  return buildTrustBatteryPayload({
    version: 'athlete_trust_driver_binary_v1',
    items,
  });
}

function buildTrustBatteryPayload(rawBattery) {
  const items = Array.isArray(rawBattery?.items)
    ? rawBattery.items.map((entry) => normalizeTrustBatteryItem(entry)).filter(Boolean)
    : TRUST_BATTERY_ITEM_KEYS.map((key) => ({
        key,
        score: null,
        completed: false,
        prompt: null,
      }));

  const completedItems = items.filter((entry) => entry.completed && entry.score !== null);
  const averageScore = completedItems.length ? average(completedItems.map((entry) => entry.score)) : null;
  const completionStatus =
    completedItems.length === 0
      ? 'empty'
      : completedItems.length === TRUST_BATTERY_ITEM_KEYS.length
        ? 'complete'
        : 'partial';

  return {
    version: normalizeString(rawBattery?.version) || TRUST_BATTERY_VERSION,
    items,
    totalItemCount: TRUST_BATTERY_ITEM_KEYS.length,
    completedItemCount: completedItems.length,
    completionStatus,
    averageScore,
  };
}

function normalizeSurveyKindAlias(value) {
  const normalized = normalizeString(value).toLowerCase().replace(/[\s-]+/g, '_');
  if (!normalized) return null;

  if ([
    'trust',
    'trust_score',
    'athlete_trust',
    'trust_battery',
    'trustbattery',
    'trust_index',
    'trust_diagnostic',
  ].includes(normalized)) {
    return 'trust';
  }

  if ([
    'nps',
    'nps_score',
    'athlete_nps',
    'recommend',
    'recommendation',
    'recommendation_intent',
    'net_promoter_score',
    'netpromoterscore',
  ].includes(normalized)) {
    return 'nps';
  }

  return null;
}

function normalizeRespondentRoleAlias(value) {
  const normalized = normalizeString(value).toLowerCase().replace(/[\s-]+/g, '_');
  if (!normalized) return null;

  if (['athlete', 'player', 'student_athlete', 'studentathlete'].includes(normalized)) {
    return 'athlete';
  }

  if (['coach', 'staff', 'assistant_coach', 'head_coach'].includes(normalized)) {
    return 'coach';
  }

  if (['clinician', 'provider', 'psychologist', 'therapist', 'mental_performance_staff'].includes(normalized)) {
    return 'clinician';
  }

  return null;
}

function normalizeSurveyScoreCandidate(...values) {
  for (const value of values) {
    const normalized = normalizeNumber(value);
    if (normalized !== null && normalized >= 0 && normalized <= 10) {
      return roundMetric(normalized);
    }
  }

  return null;
}

function normalizeSurveySubmittedAtMs(entry) {
  return (
    coerceMillis(entry?.submittedAt)
    || normalizeNumber(entry?.submittedAtMs)
    || coerceMillis(entry?.createdAt)
    || normalizeNumber(entry?.createdAtMs)
    || coerceMillis(entry?.updatedAt)
    || normalizeNumber(entry?.updatedAtMs)
    || null
  );
}

function compactMigrationValue(value) {
  if (value === undefined) return null;
  if (value === null) return null;
  if (Array.isArray(value)) return value.map((entry) => compactMigrationValue(entry));
  if (typeof value !== 'object') return value;

  return Object.entries(value).reduce((accumulator, [key, nested]) => {
    const compacted = compactMigrationValue(nested);
    if (compacted !== undefined) {
      accumulator[key] = compacted;
    }
    return accumulator;
  }, {});
}

function buildSurveyEventCoverage(events = []) {
  return events.reduce((accumulator, entry) => {
    if (normalizeString(entry?.sourceCollection) !== PILOT_SURVEY_RESPONSES_COLLECTION) {
      return accumulator;
    }

    const sourceDocumentId = normalizeString(entry?.sourceDocumentId);
    if (!sourceDocumentId) return accumulator;

    const existing = accumulator.get(sourceDocumentId) || new Set();
    existing.add(normalizeString(entry?.eventType));
    accumulator.set(sourceDocumentId, existing);
    return accumulator;
  }, new Map());
}

function buildSurveyResponsePatchPreview(patch) {
  return Object.entries(compactMigrationValue(patch) || {}).reduce((accumulator, [key, value]) => {
    accumulator[key] = value;
    return accumulator;
  }, {});
}

async function resolveSurveyReclassificationContext(db, entry, pilotId, contextCache) {
  const respondentRole = normalizeRespondentRoleAlias(entry?.respondentRole || entry?.role);
  const athleteId = normalizeString(entry?.athleteId || entry?.userId || entry?.respondentUserId);
  const pilotEnrollmentId = normalizeString(entry?.pilotEnrollmentId);

  if (respondentRole !== 'athlete' && !athleteId && !pilotEnrollmentId) {
    return null;
  }

  const cacheKey = [
    normalizeString(pilotId),
    pilotEnrollmentId || '-',
    athleteId || '-',
  ].join('::');

  if (contextCache.has(cacheKey)) {
    return contextCache.get(cacheKey);
  }

  const context = await resolvePilotEnrollmentContext({
    db,
    athleteId: athleteId || null,
    preferredPilotEnrollmentId: pilotEnrollmentId || null,
    preferredPilotId: normalizeString(pilotId) || null,
    allowMembershipFallback: false,
  });

  contextCache.set(cacheKey, context || null);
  return context || null;
}

async function classifyPilotSurveyResponseForMigration({
  db,
  pilotId,
  entry,
  eventCoverage,
  contextCache,
}) {
  const currentSurveyKind = normalizeSurveyKindAlias(
    entry?.surveyKind || entry?.kind || entry?.type || entry?.metricKind || entry?.questionKind || entry?.promptKind,
  );
  const currentRespondentRole = normalizeRespondentRoleAlias(entry?.respondentRole || entry?.role);
  const targetSurveyKind = normalizeSurveyKindAlias(
    entry?.surveyKind || entry?.kind || entry?.type || entry?.metricKind || entry?.questionKind || entry?.promptKind,
  );
  const targetRespondentRole = normalizeRespondentRoleAlias(
    entry?.respondentRole || entry?.role || (entry?.athleteId ? 'athlete' : null),
  );
  const submittedAtMs = normalizeSurveySubmittedAtMs(entry);
  const targetScore = normalizeSurveyScoreCandidate(
    entry?.score,
    entry?.trustScore,
    entry?.npsScore,
    entry?.rating,
    entry?.value,
  );
  const targetTrustBattery = targetSurveyKind === 'trust'
    ? buildTrustBatteryPayload(entry?.trustBattery || entry?.diagnosticBattery || entry?.battery || {})
    : null;
  const existingEventTypes = eventCoverage.get(normalizeString(entry?.id)) || new Set();
  const context = await resolveSurveyReclassificationContext(db, entry, pilotId, contextCache);
  const resolvedPilotId = normalizeString(entry?.pilotId || context?.pilotId || pilotId);
  const resolvedPilotEnrollmentId = normalizeString(entry?.pilotEnrollmentId || context?.pilotEnrollmentId) || null;
  const resolvedOrganizationId = normalizeString(entry?.organizationId || context?.organizationId);
  const resolvedTeamId = normalizeString(entry?.teamId || context?.teamId);
  const resolvedCohortId = normalizeString(entry?.cohortId || context?.cohortId) || null;
  const resolvedAthleteId = normalizeString(entry?.athleteId || context?.athleteId || entry?.respondentUserId) || null;
  const respondentUserId = normalizeString(entry?.respondentUserId || entry?.userId);
  const source = normalizeString(entry?.source) || 'migration';

  const blockingReasons = [];
  if (!targetSurveyKind) blockingReasons.push('unrecognized_survey_kind');
  if (!targetRespondentRole) blockingReasons.push('unrecognized_respondent_role');
  if (targetScore === null) blockingReasons.push('invalid_score');
  if (!respondentUserId) blockingReasons.push('missing_respondent_user_id');
  if (!resolvedPilotId) blockingReasons.push('missing_pilot_id');
  if (!resolvedOrganizationId) blockingReasons.push('missing_organization_id');
  if (!resolvedTeamId) blockingReasons.push('missing_team_id');
  if (!submittedAtMs) blockingReasons.push('missing_submitted_at');
  if (targetRespondentRole === 'athlete' && !resolvedAthleteId) blockingReasons.push('missing_athlete_id');

  const patch = {};
  if (targetSurveyKind && normalizeString(entry?.surveyKind) !== targetSurveyKind) {
    patch.surveyKind = targetSurveyKind;
  }
  if (targetRespondentRole && normalizeString(entry?.respondentRole) !== targetRespondentRole) {
    patch.respondentRole = targetRespondentRole;
  }
  if (targetScore !== null && normalizeNumber(entry?.score) !== targetScore) {
    patch.score = targetScore;
  }
  if (resolvedPilotId && normalizeString(entry?.pilotId) !== resolvedPilotId) {
    patch.pilotId = resolvedPilotId;
  }
  if (resolvedPilotEnrollmentId !== normalizeString(entry?.pilotEnrollmentId || null)) {
    patch.pilotEnrollmentId = resolvedPilotEnrollmentId;
  }
  if (resolvedOrganizationId && normalizeString(entry?.organizationId) !== resolvedOrganizationId) {
    patch.organizationId = resolvedOrganizationId;
  }
  if (resolvedTeamId && normalizeString(entry?.teamId) !== resolvedTeamId) {
    patch.teamId = resolvedTeamId;
  }
  if (resolvedCohortId !== normalizeString(entry?.cohortId || null)) {
    patch.cohortId = resolvedCohortId;
  }
  if ((targetRespondentRole === 'athlete' ? resolvedAthleteId : null) !== normalizeString(entry?.athleteId || null)) {
    patch.athleteId = targetRespondentRole === 'athlete' ? resolvedAthleteId : null;
  }
  if (respondentUserId && normalizeString(entry?.respondentUserId) !== respondentUserId) {
    patch.respondentUserId = respondentUserId;
  }
  if (source && normalizeString(entry?.source) !== source) {
    patch.source = source;
  }
  if (submittedAtMs && (coerceMillis(entry?.submittedAt) !== submittedAtMs || normalizeNumber(entry?.submittedAtMs) !== submittedAtMs)) {
    patch.submittedAt = timestampFromMillis(submittedAtMs);
    patch.submittedAtMs = submittedAtMs;
  }
  if (targetSurveyKind === 'trust') {
    if (stableSerialize(entry?.trustBattery || null) !== stableSerialize(targetTrustBattery || null)) {
      patch.trustBattery = targetTrustBattery;
    }
  } else if (entry?.trustBattery !== undefined) {
    patch.trustBattery = null;
  }

  const missingEventTypes = [];
  if (!existingEventTypes.has('survey_submitted')) {
    missingEventTypes.push('survey_submitted');
  }
  if (targetSurveyKind === 'trust' && !existingEventTypes.has('trust_submitted')) {
    missingEventTypes.push('trust_submitted');
  }
  if (targetSurveyKind === 'nps' && !existingEventTypes.has('nps_submitted')) {
    missingEventTypes.push('nps_submitted');
  }

  const canApply = blockingReasons.length === 0;
  const needsDocumentUpdate = Object.keys(patch).length > 0;
  const needsEventBackfill = missingEventTypes.length > 0;

  return {
    responseId: normalizeString(entry?.id),
    currentSurveyKind,
    currentRespondentRole,
    targetSurveyKind,
    targetRespondentRole,
    targetScore,
    source,
    submittedAtMs,
    context: {
      pilotId: resolvedPilotId || null,
      pilotEnrollmentId: resolvedPilotEnrollmentId,
      organizationId: resolvedOrganizationId || null,
      teamId: resolvedTeamId || null,
      cohortId: resolvedCohortId,
      athleteId: targetRespondentRole === 'athlete' ? resolvedAthleteId : null,
      respondentUserId: respondentUserId || null,
    },
    needsDocumentUpdate,
    needsEventBackfill,
    missingEventTypes,
    canApply,
    blockingReasons,
    patch,
  };
}

async function collectPilotSurveyReclassificationCandidates({
  db,
  pilotId,
  sampleLimit = 20,
}) {
  const normalizedPilotId = normalizeString(pilotId);
  if (!normalizedPilotId) {
    throw new Error('pilotId is required.');
  }

  const [responses, events] = await Promise.all([
    loadPilotSurveyResponses(db, normalizedPilotId),
    loadPilotMetricEvents(db, normalizedPilotId),
  ]);

  const eventCoverage = buildSurveyEventCoverage(events);
  const contextCache = new Map();
  const candidates = [];

  for (const entry of responses) {
    candidates.push(await classifyPilotSurveyResponseForMigration({
      db,
      pilotId: normalizedPilotId,
      entry,
      eventCoverage,
      contextCache,
    }));
  }

  const alreadyCanonicalCount = candidates.filter((entry) => !entry.needsDocumentUpdate && !entry.needsEventBackfill && entry.canApply).length;
  const blockedCount = candidates.filter((entry) => !entry.canApply).length;
  const needsDocumentUpdateCount = candidates.filter((entry) => entry.canApply && entry.needsDocumentUpdate).length;
  const needsEventBackfillCount = candidates.filter((entry) => entry.canApply && entry.needsEventBackfill).length;
  const applyReady = candidates.filter((entry) => entry.canApply && (entry.needsDocumentUpdate || entry.needsEventBackfill));
  const samples = applyReady
    .concat(candidates.filter((entry) => !entry.canApply))
    .slice(0, Math.max(1, Math.min(50, Number(sampleLimit) || 20)))
    .map((entry) => ({
      responseId: entry.responseId,
      currentSurveyKind: entry.currentSurveyKind,
      targetSurveyKind: entry.targetSurveyKind,
      currentRespondentRole: entry.currentRespondentRole,
      targetRespondentRole: entry.targetRespondentRole,
      canApply: entry.canApply,
      needsDocumentUpdate: entry.needsDocumentUpdate,
      needsEventBackfill: entry.needsEventBackfill,
      missingEventTypes: entry.missingEventTypes,
      blockingReasons: entry.blockingReasons,
      patchPreview: buildSurveyResponsePatchPreview(entry.patch),
    }));

  return {
    pilotId: normalizedPilotId,
    migrationKey: SURVEY_RECLASSIFICATION_MIGRATION_KEY,
    totalSurveyResponseCount: responses.length,
    alreadyCanonicalCount,
    blockedCount,
    needsDocumentUpdateCount,
    needsEventBackfillCount,
    applyReadyCount: applyReady.length,
    samples,
    candidates,
  };
}

async function writePilotMigrationRun({
  db,
  pilotId,
  actorUserId = null,
  mode,
  migrationKey = SURVEY_RECLASSIFICATION_MIGRATION_KEY,
  report,
  reportSummary = null,
  appliedMutationIds = [],
  recompute = null,
}) {
  const rootRef = db.collection(PILOT_METRIC_OPS_COLLECTION).doc(pilotId);
  const runRef = rootRef.collection(PILOT_METRIC_OPS_MIGRATIONS_SUBCOLLECTION).doc();
  const nowMs = Date.now();
  const normalizedReportSummary = reportSummary || {
    totalSurveyResponseCount: report.totalSurveyResponseCount,
    alreadyCanonicalCount: report.alreadyCanonicalCount,
    blockedCount: report.blockedCount,
    needsDocumentUpdateCount: report.needsDocumentUpdateCount,
    needsEventBackfillCount: report.needsEventBackfillCount,
    applyReadyCount: report.applyReadyCount,
    samples: report.samples || [],
  };
  const payload = {
    id: runRef.id,
    migrationKey: normalizeString(migrationKey) || SURVEY_RECLASSIFICATION_MIGRATION_KEY,
    mode: normalizeString(mode) || 'report',
    pilotId,
    actorUserId: normalizeString(actorUserId) || null,
    report: normalizedReportSummary,
    appliedMutationIds,
    recompute: recompute || null,
    createdAt: timestampFromMillis(nowMs),
    createdAtMs: nowMs,
    updatedAt: timestampFromMillis(nowMs),
    updatedAtMs: nowMs,
  };

  await runRef.set(payload, { merge: true });
  return payload;
}

function normalizeEscalationClassificationFamily(value, { entry = null, text = '' } = {}) {
  const normalized = normalizeString(value).toLowerCase();
  if (['critical_safety', 'care_escalation', 'coach_review', 'performance_support', 'none'].includes(normalized)) {
    return normalized;
  }
  const tier = Number(entry?.tier) || 0;
  if (tier >= 3) return 'critical_safety';
  if (tier >= 2) return 'care_escalation';
  if (tier >= 1) return 'coach_review';
  if (BENIGN_PERFORMANCE_SUPPORT_PATTERN.test(text)) return 'performance_support';
  return 'none';
}

function normalizeEscalationDisposition(value, { family = 'none', entry = null } = {}) {
  const normalized = normalizeString(value).toLowerCase();
  if (['none', 'coach_review', 'clinical_handoff'].includes(normalized)) {
    return normalized;
  }
  if (family === 'critical_safety' || family === 'care_escalation') return 'clinical_handoff';
  if (family === 'coach_review') return 'coach_review';
  if ((Number(entry?.tier) || 0) >= 2 || entry?.requiresClinicalHandoff === true || entry?.countsTowardCareKpi === true) {
    return 'clinical_handoff';
  }
  if ((Number(entry?.tier) || 0) >= 1 || entry?.requiresCoachReview === true) {
    return 'coach_review';
  }
  return 'none';
}

function mapEscalationDispositionToTier(disposition, family, entry = {}) {
  const existingTier = Number(entry?.tier) || 0;
  if (family === 'critical_safety') {
    return Math.max(3, existingTier || 3);
  }
  if (disposition === 'clinical_handoff' || family === 'care_escalation') {
    return Math.max(2, Math.min(3, existingTier || 2));
  }
  if (disposition === 'coach_review' || family === 'coach_review') {
    return 1;
  }
  return 0;
}

function mapEscalationDispositionToSeverity(disposition, family) {
  if (family === 'critical_safety') return 'critical';
  if (disposition === 'clinical_handoff') return 'high';
  if (disposition === 'coach_review') return 'moderate';
  return 'none';
}

function buildEscalationMigrationExplanation(entry, { family, disposition, text }) {
  if (family === 'performance_support') {
    return 'Historical record reads as ordinary performance-support language without clear safety or severe-impairment markers.';
  }
  if (family === 'critical_safety') {
    return normalizeString(entry?.explanation || entry?.classificationReason) || 'Historical record includes critical-safety language and stays in the care escalation lane.';
  }
  if (disposition === 'clinical_handoff') {
    return normalizeString(entry?.explanation || entry?.classificationReason) || 'Historical record retains care-escalation posture because it indicates safety/clinical handoff criteria or workflow progression.';
  }
  if (disposition === 'coach_review') {
    return normalizeString(entry?.explanation || entry?.classificationReason) || 'Historical record is preserved for coach/staff review without counting as a care escalation.';
  }
  if (BENIGN_PERFORMANCE_SUPPORT_PATTERN.test(text)) {
    return 'Historical record was normalized into the support-only lane based on benign performance-support language.';
  }
  return normalizeString(entry?.explanation || entry?.classificationReason) || 'Historical record was normalized to the canonical escalation disposition model.';
}

function buildEscalationMigrationPatchPreview(patch = {}) {
  if (!patch || typeof patch !== 'object') return {};
  return {
    tier: patch.tier,
    disposition: patch.disposition,
    classificationFamily: patch.classificationFamily,
    requiresCoachReview: patch.requiresCoachReview,
    requiresClinicalHandoff: patch.requiresClinicalHandoff,
    countsTowardCareKpi: patch.countsTowardCareKpi,
    incidentId: patch.incidentId,
    incidentStatus: patch.incidentStatus,
    mergedIntoIncidentKey: patch.mergedIntoIncidentKey || null,
    supersededByIncidentKey: patch.supersededByIncidentKey || null,
    excludedFromHeadlineMetrics: patch.excludedFromHeadlineMetrics === true,
  };
}

function areEscalationFamiliesAdjacent(leftFamily, rightFamily) {
  const familyOrder = {
    none: 0,
    performance_support: 1,
    coach_review: 2,
    care_escalation: 3,
    critical_safety: 4,
  };
  const left = familyOrder[normalizeString(leftFamily).toLowerCase()];
  const right = familyOrder[normalizeString(rightFamily).toLowerCase()];
  if (left === undefined || right === undefined) return false;
  return Math.abs(left - right) <= 1;
}

function deriveEscalationMigrationTarget(entry = {}) {
  const text = [
    normalizeString(entry.category),
    normalizeString(entry.classificationReason),
    normalizeString(entry.explanation),
    normalizeString(entry.triggerContent),
  ].join(' ').trim();
  const hardRisk = HARD_RISK_ESCALATION_PATTERN.test(text)
    || normalizeString(entry.classificationFamily).toLowerCase() === 'critical_safety'
    || (Number(entry.tier) || 0) >= 3;
  const workflowProgress = hasEscalationWorkflowProgress(entry);
  const benignPerformanceSupport = !hardRisk
    && !workflowProgress
    && (Number(entry.tier) || 0) < 3
    && BENIGN_PERFORMANCE_SUPPORT_PATTERN.test(text);

  let targetFamily;
  let targetDisposition;

  if (benignPerformanceSupport) {
    targetFamily = 'performance_support';
    targetDisposition = 'none';
  } else if (
    hardRisk
    || normalizeString(entry.disposition).toLowerCase() === 'clinical_handoff'
    || entry.requiresClinicalHandoff === true
    || entry.countsTowardCareKpi === true
    || (Number(entry.tier) || 0) >= 2
    || workflowProgress
  ) {
    targetFamily = hardRisk ? 'critical_safety' : 'care_escalation';
    targetDisposition = 'clinical_handoff';
  } else if (
    normalizeString(entry.disposition).toLowerCase() === 'coach_review'
    || entry.requiresCoachReview === true
    || (Number(entry.tier) || 0) >= 1
  ) {
    targetFamily = 'coach_review';
    targetDisposition = 'coach_review';
  } else {
    targetFamily = normalizeEscalationClassificationFamily(entry.classificationFamily, { entry, text });
    targetDisposition = normalizeEscalationDisposition(entry.disposition, { family: targetFamily, entry });
  }

  const targetTier = mapEscalationDispositionToTier(targetDisposition, targetFamily, entry);
  const targetSeverity = mapEscalationDispositionToSeverity(targetDisposition, targetFamily);
  const countsTowardCareKpi = targetDisposition === 'clinical_handoff';
  const explanation = buildEscalationMigrationExplanation(entry, {
    family: targetFamily,
    disposition: targetDisposition,
    text,
  });

  return {
    text,
    hardRisk,
    benignPerformanceSupport,
    workflowProgress,
    targetFamily,
    targetDisposition,
    targetTier,
    targetSeverity,
    requiresCoachReview: targetDisposition === 'coach_review' || targetDisposition === 'clinical_handoff',
    requiresClinicalHandoff: targetDisposition === 'clinical_handoff',
    countsTowardCareKpi,
    explanation,
    groupingEligible: targetDisposition !== 'none' && targetFamily !== 'critical_safety',
  };
}

function buildEscalationMigrationGroups(candidates = []) {
  const sorted = [...candidates].sort((left, right) => {
    const leftMs = coerceMillis(left.entry?.createdAt) || Number(left.entry?.createdAt || 0) * 1000 || 0;
    const rightMs = coerceMillis(right.entry?.createdAt) || Number(right.entry?.createdAt || 0) * 1000 || 0;
    return leftMs - rightMs;
  });
  const groups = [];

  sorted.forEach((candidate) => {
    const createdAtMs = coerceMillis(candidate.entry?.createdAt) || Number(candidate.entry?.createdAt || 0) * 1000 || 0;
    const conversationId = normalizeString(candidate.entry?.conversationId || candidate.target?.incidentConversationId);
    const athleteId = normalizeString(candidate.entry?.userId);
    const family = candidate.target?.targetFamily || 'none';
    const status = normalizeEscalationStatus(candidate.entry);
    const matchingGroup = groups.find((group) => {
      if (group.athleteId !== athleteId) return false;
      if (!areEscalationFamiliesAdjacent(group.family, family)) return false;
      if (conversationId && group.conversationId && conversationId === group.conversationId && group.status === 'active') {
        return true;
      }
      const deltaMs = Math.abs(createdAtMs - group.lastCreatedAtMs);
      return deltaMs <= ESCALATION_MIGRATION_DEDUPE_WINDOW_SECONDS * 1000;
    });

    if (matchingGroup) {
      matchingGroup.entries.push(candidate);
      matchingGroup.lastCreatedAtMs = Math.max(matchingGroup.lastCreatedAtMs, createdAtMs);
      if (status === 'active') {
        matchingGroup.status = 'active';
      }
      return;
    }

    groups.push({
      groupId: candidate.entry.id,
      athleteId,
      family,
      conversationId,
      status,
      lastCreatedAtMs: createdAtMs,
      entries: [candidate],
    });
  });

  return groups;
}

async function collectPilotEscalationReclassificationCandidates({
  db,
  pilotId,
  sampleLimit = 20,
}) {
  const normalizedPilotId = normalizeString(pilotId);
  if (!normalizedPilotId) {
    throw new Error('pilotId is required.');
  }

  const [pilot, enrollments] = await Promise.all([
    loadPilotDocument(db, normalizedPilotId),
    loadPilotEnrollments(db, normalizedPilotId),
  ]);
  const athleteIds = [...new Set(enrollments.map((entry) => normalizeString(entry.userId)).filter(Boolean))];
  const escalations = await loadPilotEscalations(db, athleteIds);
  const pilotStartMs = coerceMillis(pilot?.startAt) || 0;
  const pilotEndMs = coerceMillis(pilot?.endAt) || Date.now();
  const inWindowEscalations = escalations.filter((entry) => {
    const createdAtMs = coerceMillis(entry?.createdAt) || Number(entry?.createdAt || 0) * 1000 || 0;
    if (!createdAtMs) return false;
    if (pilotStartMs && createdAtMs < pilotStartMs) return false;
    if (pilotEndMs && createdAtMs > pilotEndMs) return false;
    return true;
  });

  const baseCandidates = inWindowEscalations.map((entry) => {
    const target = deriveEscalationMigrationTarget(entry);
    return {
      recordId: normalizeString(entry.id),
      entry,
      target,
    };
  });
  const groups = buildEscalationMigrationGroups(baseCandidates);
  const groupMap = new Map();
  groups.forEach((group) => {
    const primary = group.entries[0] || null;
    if (!primary) return;
    group.entries.forEach((candidate, index) => {
      groupMap.set(candidate.recordId, {
        groupId: group.groupId,
        primaryRecordId: primary.recordId,
        groupSize: group.entries.length,
        merged: index > 0,
        groupStatus: group.status,
      });
    });
  });

  const candidates = baseCandidates.map(({ recordId, entry, target }) => {
    const grouping = groupMap.get(recordId) || {
      groupId: recordId,
      primaryRecordId: recordId,
      groupSize: 1,
      merged: false,
      groupStatus: normalizeEscalationStatus(entry),
    };
    const patch = {
      tier: grouping.merged ? Math.min(target.targetTier, 1) : target.targetTier,
      disposition: grouping.merged ? (target.targetDisposition === 'clinical_handoff' ? 'coach_review' : target.targetDisposition) : target.targetDisposition,
      classificationFamily: grouping.merged ? (target.targetDisposition === 'clinical_handoff' ? 'coach_review' : target.targetFamily) : target.targetFamily,
      severity: grouping.merged && target.targetDisposition === 'clinical_handoff' ? 'moderate' : target.targetSeverity,
      requiresCoachReview: target.requiresCoachReview,
      requiresClinicalHandoff: grouping.merged ? false : target.requiresClinicalHandoff,
      countsTowardCareKpi: grouping.merged ? false : target.countsTowardCareKpi,
      explanation: target.explanation,
      dedupeEligible: target.targetDisposition !== 'none',
      excludedFromHeadlineMetrics: grouping.merged || !target.countsTowardCareKpi,
      legacyClassification: true,
      migrationNormalizedAt: timestampFromMillis(Date.now()),
      migrationNormalizedAtMs: Date.now(),
      incidentId: grouping.primaryRecordId,
      incidentStatus: grouping.merged ? 'merged' : grouping.groupStatus,
      incidentRecordCount: grouping.groupSize,
      incident: {
        ...(entry.incident && typeof entry.incident === 'object' ? entry.incident : {}),
        id: grouping.primaryRecordId,
        status: grouping.merged ? 'merged' : grouping.groupStatus,
        recordCount: grouping.groupSize,
        dedupeWindowSeconds: ESCALATION_MIGRATION_DEDUPE_WINDOW_SECONDS,
        conversationId: normalizeString(entry.conversationId),
        family: grouping.merged && target.targetDisposition === 'clinical_handoff' ? 'coach_review' : target.targetFamily,
      },
      supersededByIncidentKey: grouping.merged ? grouping.primaryRecordId : null,
      mergedIntoIncidentKey: grouping.merged ? grouping.primaryRecordId : null,
      sourceTriggerMessageId: normalizeString(entry.messageId || entry.triggerMessageId || entry.dedupeLastTriggerMessageId) || null,
    };

    const needsDocumentUpdate = stableSerialize({
      tier: Number(entry.tier) || 0,
      disposition: normalizeString(entry.disposition) || null,
      classificationFamily: normalizeString(entry.classificationFamily) || null,
      severity: normalizeString(entry.severity) || null,
      requiresCoachReview: entry.requiresCoachReview === true,
      requiresClinicalHandoff: entry.requiresClinicalHandoff === true,
      countsTowardCareKpi: entry.countsTowardCareKpi === true,
      excludedFromHeadlineMetrics: entry.excludedFromHeadlineMetrics === true,
      incidentId: normalizeString(entry.incidentId) || null,
      incidentStatus: normalizeString(entry.incidentStatus) || null,
      supersededByIncidentKey: normalizeString(entry.supersededByIncidentKey) || null,
      mergedIntoIncidentKey: normalizeString(entry.mergedIntoIncidentKey) || null,
      sourceTriggerMessageId: normalizeString(entry.sourceTriggerMessageId) || null,
    }) !== stableSerialize({
      tier: patch.tier,
      disposition: patch.disposition,
      classificationFamily: patch.classificationFamily,
      severity: patch.severity,
      requiresCoachReview: patch.requiresCoachReview,
      requiresClinicalHandoff: patch.requiresClinicalHandoff,
      countsTowardCareKpi: patch.countsTowardCareKpi,
      excludedFromHeadlineMetrics: patch.excludedFromHeadlineMetrics,
      incidentId: patch.incidentId,
      incidentStatus: patch.incidentStatus,
      supersededByIncidentKey: patch.supersededByIncidentKey,
      mergedIntoIncidentKey: patch.mergedIntoIncidentKey,
      sourceTriggerMessageId: patch.sourceTriggerMessageId,
    });

    return {
      recordId,
      canApply: true,
      needsDocumentUpdate,
      blockingReasons: [],
      targetDisposition: patch.disposition,
      targetFamily: patch.classificationFamily,
      grouping,
      patch,
      entry,
    };
  });

  const alreadyCanonicalCount = candidates.filter((entry) => !entry.needsDocumentUpdate).length;
  const blockedCount = candidates.filter((entry) => !entry.canApply).length;
  const needsDocumentUpdateCount = candidates.filter((entry) => entry.canApply && entry.needsDocumentUpdate).length;
  const mergedCount = candidates.filter((entry) => entry.grouping?.merged).length;
  const groupedIncidentCount = groups.filter((group) => group.entries.length > 1).length;
  const applyReady = candidates.filter((entry) => entry.canApply && entry.needsDocumentUpdate);
  const samples = applyReady
    .concat(candidates.filter((entry) => !entry.canApply))
    .slice(0, Math.max(1, Math.min(50, Number(sampleLimit) || 20)))
    .map((entry) => ({
      recordId: entry.recordId,
      currentTier: Number(entry.entry?.tier) || 0,
      targetTier: entry.patch.tier,
      currentDisposition: normalizeString(entry.entry?.disposition) || null,
      targetDisposition: entry.targetDisposition,
      currentClassificationFamily: normalizeString(entry.entry?.classificationFamily) || null,
      targetClassificationFamily: entry.targetFamily,
      mergedIntoIncidentKey: entry.grouping?.merged ? entry.grouping.primaryRecordId : null,
      groupSize: entry.grouping?.groupSize || 1,
      canApply: entry.canApply,
      needsDocumentUpdate: entry.needsDocumentUpdate,
      blockingReasons: entry.blockingReasons,
      patchPreview: buildEscalationMigrationPatchPreview(entry.patch),
    }));

  return {
    pilotId: normalizedPilotId,
    migrationKey: ESCALATION_RECLASSIFICATION_MIGRATION_KEY,
    totalEscalationRecordCount: inWindowEscalations.length,
    alreadyCanonicalCount,
    blockedCount,
    needsDocumentUpdateCount,
    mergedCount,
    groupedIncidentCount,
    applyReadyCount: applyReady.length,
    samples,
    candidates,
  };
}

async function savePilotSurveyResponse({
  db,
  authUserId,
  surveyKind,
  score,
  respondentRole,
  source,
  comment,
  pilotId,
  pilotEnrollmentId,
  cohortId,
  teamId,
  organizationId,
  athleteId,
  diagnosticBattery,
  metricPayload,
}) {
  const normalizedSurveyKind = normalizeString(surveyKind);
  if (!['trust', 'nps'].includes(normalizedSurveyKind)) {
    throw new Error('surveyKind must be trust or nps.');
  }

  const normalizedRole = normalizeString(respondentRole) || 'athlete';
  if (!['athlete', 'coach', 'clinician'].includes(normalizedRole)) {
    throw new Error('respondentRole must be athlete, coach, or clinician.');
  }

  const normalizedScore = normalizeNumber(score);
  if (normalizedScore === null || normalizedScore < 0 || normalizedScore > 10) {
    throw new Error('score must be between 0 and 10.');
  }

  let pilotContext = null;
  if (normalizedRole === 'athlete') {
    pilotContext = await resolvePilotEnrollmentContext({
      db,
      athleteId: athleteId || authUserId,
      preferredPilotEnrollmentId: pilotEnrollmentId,
      preferredPilotId: pilotId,
      allowMembershipFallback: false,
    });
  }

  const submittedAtMs = Date.now();
  const surveyRef = db.collection(PILOT_SURVEY_RESPONSES_COLLECTION).doc();
  const normalizedMetricPayload = normalizeSurveyMetricPayload(metricPayload, normalizedSurveyKind, comment);
  const trustBattery = normalizedSurveyKind === 'trust'
    ? buildTrustBatteryPayload(diagnosticBattery || buildTrustBatteryPayloadFromMetricPayload(normalizedMetricPayload) || {})
    : null;

  const resolvedPilotId = normalizeString(pilotContext?.pilotId || pilotId);
  const resolvedTeamId = normalizeString(pilotContext?.teamId || teamId);
  const resolvedOrganizationId = normalizeString(pilotContext?.organizationId || organizationId);
  const resolvedCohortId = normalizeString(pilotContext?.cohortId || cohortId) || null;
  const resolvedAthleteId = normalizeString(athleteId || pilotContext?.athleteId || authUserId) || null;
  const resolvedPilotEnrollmentId = normalizeString(pilotContext?.pilotEnrollmentId || pilotEnrollmentId) || null;

  if (!resolvedPilotId || !resolvedTeamId || !resolvedOrganizationId) {
    throw new Error('Resolved pilot survey context is incomplete.');
  }

  const payload = {
    id: surveyRef.id,
    pilotId: resolvedPilotId,
    pilotEnrollmentId: resolvedPilotEnrollmentId,
    organizationId: resolvedOrganizationId,
    teamId: resolvedTeamId,
    cohortId: resolvedCohortId,
    respondentUserId: authUserId,
    respondentRole: normalizedRole,
    athleteId: normalizedRole === 'athlete' ? resolvedAthleteId : null,
    surveyKind: normalizedSurveyKind,
    score: roundMetric(normalizedScore),
    comment: sanitizeSurveyComment(comment),
    metricPayload: normalizedMetricPayload,
    source: normalizeString(source) || 'web-admin',
    submittedAt: timestampFromMillis(submittedAtMs),
    submittedAtMs,
    trustBattery,
  };

  await surveyRef.set(payload);

  await emitPilotMetricEvent({
    db,
    pilotContext: {
      ...pilotContext,
      pilotEnrollmentId: resolvedPilotEnrollmentId,
      pilotId: resolvedPilotId,
      organizationId: resolvedOrganizationId,
      teamId: resolvedTeamId,
      cohortId: resolvedCohortId,
      athleteId: resolvedAthleteId,
    },
    eventType: 'survey_submitted',
    actorRole: normalizedRole,
    actorUserId: authUserId,
    athleteId: resolvedAthleteId,
    sourceCollection: PILOT_SURVEY_RESPONSES_COLLECTION,
    sourceDocumentId: surveyRef.id,
    metricPayload: {
      surveyKind: normalizedSurveyKind,
      score: roundMetric(normalizedScore),
    },
    createdAt: submittedAtMs,
  });

  await emitPilotMetricEvent({
    db,
    pilotContext: {
      ...pilotContext,
      pilotEnrollmentId: resolvedPilotEnrollmentId,
      pilotId: resolvedPilotId,
      organizationId: resolvedOrganizationId,
      teamId: resolvedTeamId,
      cohortId: resolvedCohortId,
      athleteId: resolvedAthleteId,
    },
    eventType: normalizedSurveyKind === 'trust' ? 'trust_submitted' : 'nps_submitted',
    actorRole: normalizedRole,
    actorUserId: authUserId,
    athleteId: resolvedAthleteId,
    sourceCollection: PILOT_SURVEY_RESPONSES_COLLECTION,
    sourceDocumentId: surveyRef.id,
    metricPayload: {
      surveyKind: normalizedSurveyKind,
      score: roundMetric(normalizedScore),
      trustBatteryAverage: trustBattery?.averageScore ?? null,
      trustBatteryCompletionStatus: trustBattery?.completionStatus ?? null,
    },
    createdAt: submittedAtMs,
  });

  return payload;
}

async function buildPilotSurveyReclassificationReport({
  db,
  pilotId,
  sampleLimit = 20,
  actorUserId = null,
  persistRun = true,
}) {
  const report = await collectPilotSurveyReclassificationCandidates({
    db,
    pilotId,
    sampleLimit,
  });

  let run = null;
  if (persistRun) {
    run = await writePilotMigrationRun({
      db,
      pilotId: report.pilotId,
      actorUserId,
      mode: 'report',
      report,
      appliedMutationIds: [],
      recompute: null,
    });
  }

  return {
    ...report,
    runId: run?.id || null,
  };
}

async function applyPilotSurveyReclassification({
  db,
  pilotId,
  actorUserId = null,
  sampleLimit = 20,
  recomputeRollups = true,
  recomputeLookbackDays = ROLLUP_REPAIR_LOOKBACK_DAYS,
}) {
  const report = await collectPilotSurveyReclassificationCandidates({
    db,
    pilotId,
    sampleLimit,
  });
  const applyReady = report.candidates.filter((entry) => entry.canApply && (entry.needsDocumentUpdate || entry.needsEventBackfill));
  const appliedAtMs = Date.now();
  const appliedMutationIds = [];

  for (const candidate of applyReady) {
    if (candidate.needsDocumentUpdate) {
      const surveyRef = db.collection(PILOT_SURVEY_RESPONSES_COLLECTION).doc(candidate.responseId);
      await surveyRef.set({
        ...candidate.patch,
        migration: {
          lastAppliedKey: SURVEY_RECLASSIFICATION_MIGRATION_KEY,
          lastAppliedAt: timestampFromMillis(appliedAtMs),
          lastAppliedAtMs: appliedAtMs,
          lastAppliedBy: normalizeString(actorUserId) || null,
        },
        updatedAt: timestampFromMillis(appliedAtMs),
        updatedAtMs: appliedAtMs,
      }, { merge: true });
    }

    if (candidate.needsEventBackfill) {
      const pilotContext = {
        pilotId: candidate.context.pilotId,
        pilotEnrollmentId: candidate.context.pilotEnrollmentId,
        organizationId: candidate.context.organizationId,
        teamId: candidate.context.teamId,
        cohortId: candidate.context.cohortId,
        athleteId: candidate.context.athleteId,
      };

      if (candidate.missingEventTypes.includes('survey_submitted')) {
        await emitPilotMetricEvent({
          db,
          pilotContext,
          eventType: 'survey_submitted',
          actorRole: candidate.targetRespondentRole,
          actorUserId: candidate.context.respondentUserId,
          athleteId: candidate.context.athleteId,
          sourceCollection: PILOT_SURVEY_RESPONSES_COLLECTION,
          sourceDocumentId: candidate.responseId,
          metricPayload: {
            surveyKind: candidate.targetSurveyKind,
            score: candidate.targetScore,
          },
          createdAt: candidate.submittedAtMs,
        });
      }

      if (candidate.targetSurveyKind === 'trust' && candidate.missingEventTypes.includes('trust_submitted')) {
        const surveyDoc = await db.collection(PILOT_SURVEY_RESPONSES_COLLECTION).doc(candidate.responseId).get();
        const surveyData = surveyDoc.exists ? (surveyDoc.data() || {}) : {};
        await emitPilotMetricEvent({
          db,
          pilotContext,
          eventType: 'trust_submitted',
          actorRole: candidate.targetRespondentRole,
          actorUserId: candidate.context.respondentUserId,
          athleteId: candidate.context.athleteId,
          sourceCollection: PILOT_SURVEY_RESPONSES_COLLECTION,
          sourceDocumentId: candidate.responseId,
          metricPayload: {
            surveyKind: 'trust',
            score: candidate.targetScore,
            trustBatteryAverage: normalizeNumber(surveyData?.trustBattery?.averageScore),
            trustBatteryCompletionStatus: normalizeString(surveyData?.trustBattery?.completionStatus) || null,
          },
          createdAt: candidate.submittedAtMs,
        });
      }

      if (candidate.targetSurveyKind === 'nps' && candidate.missingEventTypes.includes('nps_submitted')) {
        await emitPilotMetricEvent({
          db,
          pilotContext,
          eventType: 'nps_submitted',
          actorRole: candidate.targetRespondentRole,
          actorUserId: candidate.context.respondentUserId,
          athleteId: candidate.context.athleteId,
          sourceCollection: PILOT_SURVEY_RESPONSES_COLLECTION,
          sourceDocumentId: candidate.responseId,
          metricPayload: {
            surveyKind: 'nps',
            score: candidate.targetScore,
          },
          createdAt: candidate.submittedAtMs,
        });
      }
    }

    appliedMutationIds.push(candidate.responseId);
  }

  let recompute = null;
  if (recomputeRollups) {
    const lookbackDays = Math.max(1, Math.min(90, Number(recomputeLookbackDays) || ROLLUP_REPAIR_LOOKBACK_DAYS));
    const explicitDateKeys = buildRepairDateKeys(lookbackDays);
    recompute = {
      lookbackDays,
      explicitDateKeys,
      rollups: await recomputePilotMetricRollups({
        db,
        pilotId: report.pilotId,
        explicitDateKeys,
      }),
    };
  }

  const run = await writePilotMigrationRun({
    db,
    pilotId: report.pilotId,
    actorUserId,
    mode: 'apply',
    report,
    appliedMutationIds,
    recompute,
  });

  return {
    pilotId: report.pilotId,
    migrationKey: SURVEY_RECLASSIFICATION_MIGRATION_KEY,
    runId: run.id,
    totalSurveyResponseCount: report.totalSurveyResponseCount,
    blockedCount: report.blockedCount,
    appliedDocumentIds: appliedMutationIds,
    appliedCount: appliedMutationIds.length,
    recompute,
    report: {
      alreadyCanonicalCount: report.alreadyCanonicalCount,
      needsDocumentUpdateCount: report.needsDocumentUpdateCount,
      needsEventBackfillCount: report.needsEventBackfillCount,
      applyReadyCount: report.applyReadyCount,
      samples: report.samples,
    },
  };
}

async function buildPilotEscalationReclassificationReport({
  db,
  pilotId,
  sampleLimit = 20,
  actorUserId = null,
  persistRun = true,
}) {
  const report = await collectPilotEscalationReclassificationCandidates({
    db,
    pilotId,
    sampleLimit,
  });

  let run = null;
  if (persistRun) {
    run = await writePilotMigrationRun({
      db,
      pilotId: report.pilotId,
      actorUserId,
      mode: 'report',
      migrationKey: ESCALATION_RECLASSIFICATION_MIGRATION_KEY,
      report,
      reportSummary: {
        totalEscalationRecordCount: report.totalEscalationRecordCount,
        alreadyCanonicalCount: report.alreadyCanonicalCount,
        blockedCount: report.blockedCount,
        needsDocumentUpdateCount: report.needsDocumentUpdateCount,
        mergedCount: report.mergedCount,
        groupedIncidentCount: report.groupedIncidentCount,
        applyReadyCount: report.applyReadyCount,
        samples: report.samples || [],
      },
      appliedMutationIds: [],
      recompute: null,
    });
  }

  return {
    ...report,
    runId: run?.id || null,
  };
}

async function applyPilotEscalationReclassification({
  db,
  pilotId,
  actorUserId = null,
  sampleLimit = 20,
  recomputeRollups = true,
  recomputeLookbackDays = ROLLUP_REPAIR_LOOKBACK_DAYS,
}) {
  const report = await collectPilotEscalationReclassificationCandidates({
    db,
    pilotId,
    sampleLimit,
  });
  const applyReady = report.candidates.filter((entry) => entry.canApply && entry.needsDocumentUpdate);
  const appliedAtMs = Date.now();
  const appliedMutationIds = [];

  for (const candidate of applyReady) {
    const escalationRef = db.collection(ESCALATION_RECORDS_COLLECTION).doc(candidate.recordId);
    await escalationRef.set({
      ...candidate.patch,
      migration: {
        lastAppliedKey: ESCALATION_RECLASSIFICATION_MIGRATION_KEY,
        lastAppliedAt: timestampFromMillis(appliedAtMs),
        lastAppliedAtMs: appliedAtMs,
        lastAppliedBy: normalizeString(actorUserId) || null,
      },
      updatedAt: timestampFromMillis(appliedAtMs),
      updatedAtMs: appliedAtMs,
    }, { merge: true });
    appliedMutationIds.push(candidate.recordId);
  }

  let recompute = null;
  if (recomputeRollups) {
    const lookbackDays = Math.max(1, Math.min(180, Number(recomputeLookbackDays) || ROLLUP_REPAIR_LOOKBACK_DAYS));
    const explicitDateKeys = buildRepairDateKeys(lookbackDays);
    recompute = {
      lookbackDays,
      explicitDateKeys,
      rollups: await recomputePilotMetricRollups({
        db,
        pilotId: report.pilotId,
        explicitDateKeys,
      }),
    };
  }

  const run = await writePilotMigrationRun({
    db,
    pilotId: report.pilotId,
    actorUserId,
    mode: 'apply',
    migrationKey: ESCALATION_RECLASSIFICATION_MIGRATION_KEY,
    report,
    reportSummary: {
      totalEscalationRecordCount: report.totalEscalationRecordCount,
      alreadyCanonicalCount: report.alreadyCanonicalCount,
      blockedCount: report.blockedCount,
      needsDocumentUpdateCount: report.needsDocumentUpdateCount,
      mergedCount: report.mergedCount,
      groupedIncidentCount: report.groupedIncidentCount,
      applyReadyCount: report.applyReadyCount,
      samples: report.samples || [],
    },
    appliedMutationIds,
    recompute,
  });

  return {
    pilotId: report.pilotId,
    migrationKey: ESCALATION_RECLASSIFICATION_MIGRATION_KEY,
    runId: run.id,
    totalEscalationRecordCount: report.totalEscalationRecordCount,
    blockedCount: report.blockedCount,
    appliedDocumentIds: appliedMutationIds,
    appliedCount: appliedMutationIds.length,
    recompute,
    report: {
      alreadyCanonicalCount: report.alreadyCanonicalCount,
      needsDocumentUpdateCount: report.needsDocumentUpdateCount,
      mergedCount: report.mergedCount,
      groupedIncidentCount: report.groupedIncidentCount,
      applyReadyCount: report.applyReadyCount,
      samples: report.samples,
    },
  };
}

function hasCompletedEnrollmentConsents({ teamMembership, pilotEnrollment }) {
  const onboarding = teamMembership?.athleteOnboarding || {};
  const productConsentAccepted = Boolean(onboarding.productConsentAccepted || pilotEnrollment?.productConsentAccepted);
  return productConsentAccepted && hasCompletedRequiredConsents(onboarding, pilotEnrollment || {});
}

async function queryCollectionByField(db, collectionName, field, value) {
  try {
    const collectionRef = db.collection(collectionName);
    if (typeof collectionRef.where !== 'function') return [];
    const snapshot = await collectionRef.where(field, '==', value).get();
    return snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...(docSnap.data() || {}) }));
  } catch (error) {
    return [];
  }
}

async function loadPilotDocument(db, pilotId) {
  if (!pilotId) return null;
  try {
    const pilotSnap = await db.collection(PILOTS_COLLECTION).doc(pilotId).get();
    return pilotSnap.exists ? { id: pilotSnap.id, ...(pilotSnap.data() || {}) } : null;
  } catch (error) {
    return null;
  }
}

async function loadPilotEnrollments(db, pilotId) {
  return queryCollectionByField(db, PILOT_ENROLLMENTS_COLLECTION, 'pilotId', pilotId);
}

async function loadPilotMetricEvents(db, pilotId) {
  const events = await queryCollectionByField(db, PILOT_METRIC_EVENTS_COLLECTION, 'pilotId', pilotId);
  return events.sort((left, right) => (coerceMillis(left.createdAt) || left.createdAtMs || 0) - (coerceMillis(right.createdAt) || right.createdAtMs || 0));
}

async function loadPilotSurveyResponses(db, pilotId) {
  const responses = await queryCollectionByField(db, PILOT_SURVEY_RESPONSES_COLLECTION, 'pilotId', pilotId);
  return responses.sort((left, right) => (coerceMillis(left.submittedAt) || left.submittedAtMs || 0) - (coerceMillis(right.submittedAt) || right.submittedAtMs || 0));
}

async function loadPilotDailyAssignments(db, pilotId) {
  const byPilot = await queryCollectionByField(db, DAILY_ASSIGNMENTS_COLLECTION, 'pilotId', pilotId);
  if (byPilot.length) return byPilot;
  return [];
}

async function loadPilotEscalations(db, athleteIds) {
  if (!Array.isArray(athleteIds) || !athleteIds.length) return [];
  try {
    const collectionRef = db.collection(ESCALATION_RECORDS_COLLECTION);
    if (typeof collectionRef.get !== 'function') return [];
    const snapshot = await collectionRef.get();
    return snapshot.docs
      .map((docSnap) => ({ id: docSnap.id, ...(docSnap.data() || {}) }))
      .filter((entry) => athleteIds.includes(normalizeString(entry.userId)));
  } catch (error) {
    return [];
  }
}

function normalizeLinkedIncidentIds(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((entry) => normalizeString(entry)).filter(Boolean))];
}

function normalizeOperationalRestrictionFlags(value = {}, { baseStatus = OPERATIONAL_STATUS_NORMAL, watchListActive = false } = {}) {
  const normalizedBaseStatus = normalizeOperationalBaseStatus(baseStatus);
  const activeDefault = normalizedBaseStatus !== OPERATIONAL_STATUS_NORMAL || watchListActive;
  const source = value && typeof value === 'object' ? value : {};

  return {
    suppressSurveys: normalizeBoolean(source.suppressSurveys, activeDefault),
    suppressAssignments: normalizeBoolean(source.suppressAssignments, activeDefault),
    suppressNudges: normalizeBoolean(source.suppressNudges, activeDefault),
    excludeFromAdherence: normalizeBoolean(source.excludeFromAdherence, activeDefault),
    manualHold: normalizeBoolean(source.manualHold, false),
  };
}

function resolveOperationalRestrictionFlags({
  baseStatus = OPERATIONAL_STATUS_NORMAL,
  watchListActive = false,
  restrictionFlags = {},
}) {
  const normalizedBaseStatus = normalizeOperationalBaseStatus(baseStatus);
  const storedFlags = normalizeOperationalRestrictionFlags(restrictionFlags, {
    baseStatus: normalizedBaseStatus,
    watchListActive,
  });
  const baseRestricted = normalizedBaseStatus !== OPERATIONAL_STATUS_NORMAL;

  return {
    suppressSurveys: baseRestricted || (watchListActive && storedFlags.suppressSurveys),
    suppressAssignments: baseRestricted || (watchListActive && storedFlags.suppressAssignments),
    suppressNudges: baseRestricted || (watchListActive && storedFlags.suppressNudges),
    excludeFromAdherence: baseRestricted || (watchListActive && storedFlags.excludeFromAdherence),
    manualHold: baseRestricted ? false : (watchListActive && storedFlags.manualHold),
  };
}

function buildDefaultOperationalStateFromEnrollment(enrollment = {}, membership = null) {
  const baseStatus = normalizeOperationalBaseStatus(enrollment?.status);
  const teamMembership = membership || null;
  const nowMs = Date.now();
  return {
    id: normalizeString(enrollment?.id) || null,
    pilotEnrollmentId: normalizeString(enrollment?.id) || null,
    pilotId: normalizeString(enrollment?.pilotId) || null,
    athleteId: normalizeString(enrollment?.userId) || null,
    organizationId: normalizeString(enrollment?.organizationId || teamMembership?.organizationId) || null,
    teamId: normalizeString(enrollment?.teamId || teamMembership?.teamId) || null,
    cohortId: normalizeString(enrollment?.cohortId) || null,
    baseStatus,
    watchListActive: false,
    watchListRequested: false,
    watchListApplied: false,
    watchListRequestedAt: null,
    watchListAppliedAt: null,
    watchListClearedAt: null,
    watchListReasonCode: null,
    watchListReason: null,
    watchListSource: null,
    watchListReviewDueAt: null,
    requestedRestrictionFlags: null,
    restrictionFlags: normalizeOperationalRestrictionFlags({}, {
      baseStatus,
      watchListActive: false,
    }),
    effectiveRestrictionFlags: resolveOperationalRestrictionFlags({
      baseStatus,
      watchListActive: false,
      restrictionFlags: {},
    }),
    linkedIncidentIds: [],
    lastAction: null,
    stateVersion: OPERATIONAL_STATE_VERSION,
    createdAt: timestampFromMillis(nowMs),
    createdAtMs: nowMs,
    updatedAt: timestampFromMillis(nowMs),
    updatedAtMs: nowMs,
  };
}

function normalizePilotOperationalState(rawState = null, fallback = {}) {
  const enrollment = fallback.pilotEnrollment || {};
  const membership = fallback.teamMembership || null;
  const baseStatus = normalizeOperationalBaseStatus(
    rawState?.baseStatus
    || rawState?.status
    || fallback.baseStatus
    || enrollment?.status
  );
  const watchListActive = normalizeBoolean(rawState?.watchListActive, false);
  const requestedRestrictionFlags = rawState?.requestedRestrictionFlags
    ? normalizeOperationalRestrictionFlags(rawState.requestedRestrictionFlags, {
        baseStatus,
        watchListActive: false,
      })
    : null;
  const restrictionFlags = normalizeOperationalRestrictionFlags(
    rawState?.restrictionFlags || rawState?.watchListRestrictionFlags || {},
    {
      baseStatus,
      watchListActive,
    }
  );
  const effectiveRestrictionFlags = resolveOperationalRestrictionFlags({
    baseStatus,
    watchListActive,
    restrictionFlags,
  });
  const current = {
    ...buildDefaultOperationalStateFromEnrollment(enrollment, membership),
    ...(rawState && typeof rawState === 'object' ? rawState : {}),
  };
  const nowMs = coerceMillis(rawState?.updatedAt) || rawState?.updatedAtMs || Date.now();

  return {
    ...current,
    id: normalizeString(rawState?.id || current.id || fallback.pilotEnrollmentId) || null,
    pilotEnrollmentId: normalizeString(rawState?.pilotEnrollmentId || fallback.pilotEnrollmentId || current.pilotEnrollmentId) || null,
    pilotId: normalizeString(rawState?.pilotId || fallback.pilotId || current.pilotId) || null,
    athleteId: normalizeString(rawState?.athleteId || fallback.athleteId || current.athleteId) || null,
    organizationId: normalizeString(rawState?.organizationId || fallback.organizationId || current.organizationId) || null,
    teamId: normalizeString(rawState?.teamId || fallback.teamId || current.teamId) || null,
    cohortId: normalizeString(rawState?.cohortId || fallback.cohortId || current.cohortId) || null,
    baseStatus,
    watchListActive: normalizeBoolean(rawState?.watchListActive, false),
    watchListRequested: normalizeBoolean(rawState?.watchListRequested, false),
    watchListApplied: normalizeBoolean(rawState?.watchListApplied, false),
    watchListRequestedAt: coerceMillis(rawState?.watchListRequestedAt) || null,
    watchListAppliedAt: coerceMillis(rawState?.watchListAppliedAt) || null,
    watchListClearedAt: coerceMillis(rawState?.watchListClearedAt) || null,
    watchListReasonCode: rawState?.watchListReasonCode ? normalizeWatchListReasonCode(rawState.watchListReasonCode) : null,
    watchListReason: normalizeString(rawState?.watchListReason) || null,
    watchListSource: normalizeString(rawState?.watchListSource) || null,
    watchListReviewDueAt: coerceMillis(rawState?.watchListReviewDueAt) || null,
    requestedRestrictionFlags,
    restrictionFlags,
    effectiveRestrictionFlags,
    linkedIncidentIds: normalizeLinkedIncidentIds(rawState?.linkedIncidentIds),
    lastAction: rawState?.lastAction && typeof rawState.lastAction === 'object'
      ? {
          ...rawState.lastAction,
          action: normalizeString(rawState.lastAction.action) || null,
          actorUserId: normalizeString(rawState.lastAction.actorUserId) || null,
          actorRole: normalizeString(rawState.lastAction.actorRole) || null,
          reasonCode: rawState.lastAction.reasonCode ? normalizeWatchListReasonCode(rawState.lastAction.reasonCode) : null,
          reason: normalizeString(rawState.lastAction.reason) || null,
          at: coerceMillis(rawState.lastAction.at) || null,
          atMs: coerceMillis(rawState.lastAction.at) || rawState.lastAction.atMs || null,
        }
      : null,
    stateVersion: normalizeString(rawState?.stateVersion) || OPERATIONAL_STATE_VERSION,
    createdAt: rawState?.createdAt || timestampFromMillis(rawState?.createdAtMs || nowMs),
    createdAtMs: coerceMillis(rawState?.createdAt) || rawState?.createdAtMs || nowMs,
    updatedAt: rawState?.updatedAt || timestampFromMillis(nowMs),
    updatedAtMs: nowMs,
  };
}

async function loadPilotOperationalState(db, pilotEnrollmentId, fallback = {}) {
  const normalizedPilotEnrollmentId = normalizeString(pilotEnrollmentId);
  if (!normalizedPilotEnrollmentId) return null;

  try {
    const stateSnap = await db.collection(PILOT_OPERATIONAL_STATES_COLLECTION).doc(normalizedPilotEnrollmentId).get();
    const rawState = stateSnap.exists ? { id: stateSnap.id, ...(stateSnap.data() || {}) } : null;
    if (!rawState) {
      return fallback.pilotEnrollment ? buildDefaultOperationalStateFromEnrollment(fallback.pilotEnrollment, fallback.teamMembership || null) : null;
    }
    return normalizePilotOperationalState(rawState, {
      ...fallback,
      pilotEnrollmentId: normalizedPilotEnrollmentId,
    });
  } catch (error) {
    return fallback.pilotEnrollment ? buildDefaultOperationalStateFromEnrollment(fallback.pilotEnrollment, fallback.teamMembership || null) : null;
  }
}

async function loadPilotOperationalStates(db, enrollments = [], membershipMap = new Map()) {
  const states = await Promise.all(
    (Array.isArray(enrollments) ? enrollments : []).map(async (enrollment) => {
      const pilotEnrollmentId = normalizeString(enrollment?.id);
      if (!pilotEnrollmentId) return null;
      const teamMembership = membershipMap.get(normalizeString(enrollment.teamMembershipId)) || null;
      return loadPilotOperationalState(db, pilotEnrollmentId, {
        pilotEnrollment: enrollment,
        teamMembership,
      });
    })
  );

  return states.filter(Boolean);
}

function buildOperationalStateSummary(states = []) {
  const normalizedStates = Array.isArray(states) ? states.filter(Boolean) : [];
  return normalizedStates.reduce((accumulator, state) => {
    accumulator.total += 1;
    if (state.watchListActive) accumulator.watchListActive += 1;
    if (state.baseStatus === OPERATIONAL_STATUS_PAUSED) accumulator.paused += 1;
    if (state.baseStatus === OPERATIONAL_STATUS_WITHDRAWN) accumulator.withdrawn += 1;
    if (state.effectiveRestrictionFlags?.suppressSurveys) accumulator.suppressSurveys += 1;
    if (state.effectiveRestrictionFlags?.suppressAssignments) accumulator.suppressAssignments += 1;
    if (state.effectiveRestrictionFlags?.suppressNudges) accumulator.suppressNudges += 1;
    if (state.effectiveRestrictionFlags?.excludeFromAdherence) accumulator.excludeFromAdherence += 1;
    return accumulator;
  }, {
    total: 0,
    watchListActive: 0,
    paused: 0,
    withdrawn: 0,
    suppressSurveys: 0,
    suppressAssignments: 0,
    suppressNudges: 0,
    excludeFromAdherence: 0,
  });
}

function isOperationalRestrictedDay({
  operationalState,
  dateKey,
  timezone,
  checkIns,
  assignmentCompletions,
}) {
  const state = operationalState || null;
  if (!state?.effectiveRestrictionFlags?.excludeFromAdherence) return false;

  const appliedAtMs = coerceMillis(state.watchListAppliedAt) || coerceMillis(state.updatedAt) || state.updatedAtMs || null;
  if (!appliedAtMs) return false;

  const appliedDateKey = toTimezoneDateKey(appliedAtMs, timezone);
  const clearedAtMs = coerceMillis(state.watchListClearedAt);
  const clearedDateKey = clearedAtMs ? toTimezoneDateKey(clearedAtMs, timezone) : null;
  if (appliedDateKey && dateKey < appliedDateKey) return false;
  if (clearedDateKey && dateKey > clearedDateKey) return false;
  return true;
}

async function writePilotOperationalStateChange({
  db,
  athleteId,
  preferredPilotEnrollmentId = null,
  preferredPilotId = null,
  preferredTeamMembershipId = null,
  actorUserId = null,
  actorRole = 'staff',
  action,
  reasonCode = null,
  reason = null,
  watchListSource = null,
  requestedRestrictionFlags = null,
  restrictionFlags = null,
  watchListReviewDueAt = null,
  linkedIncidentIds = [],
  baseStatus = null,
  createdAt = Date.now(),
}) {
  const normalizedAction = normalizeString(action).toLowerCase();
  if (!['request', 'apply', 'clear'].includes(normalizedAction)) {
    throw new Error('action must be request, apply, or clear.');
  }

  const context = await resolvePilotEnrollmentContext({
    db,
    athleteId,
    preferredPilotEnrollmentId,
    preferredPilotId,
    preferredTeamMembershipId,
    allowMembershipFallback: false,
  });

  if (!context?.pilotEnrollmentId) {
    throw new Error('Unable to resolve a pilot enrollment for the watch list change.');
  }

  const normalizedBaseStatus = normalizeOperationalBaseStatus(baseStatus || context?.pilotEnrollment?.status);
  const existingState = await loadPilotOperationalState(db, context.pilotEnrollmentId, {
    pilotEnrollment: context.pilotEnrollment,
    teamMembership: context.teamMembership,
  });
  const existingWatchListActive = Boolean(existingState?.watchListActive);
  const nextRequestedRestrictionFlags = requestedRestrictionFlags
    ? normalizeOperationalRestrictionFlags(requestedRestrictionFlags, {
        baseStatus: normalizedBaseStatus,
        watchListActive: false,
      })
    : null;
  const nextRestrictionFlags = restrictionFlags
    ? normalizeOperationalRestrictionFlags(restrictionFlags, {
        baseStatus: normalizedBaseStatus,
        watchListActive: normalizedAction === 'apply',
      })
    : null;
  const nowMs = coerceMillis(createdAt) || Date.now();
  const nextState = {
    ...existingState,
    id: context.pilotEnrollmentId,
    pilotEnrollmentId: context.pilotEnrollmentId,
    pilotId: context.pilotId,
    athleteId: context.athleteId,
    organizationId: context.organizationId,
    teamId: context.teamId,
    cohortId: context.cohortId,
    baseStatus: normalizedBaseStatus,
    updatedAt: timestampFromMillis(nowMs),
    updatedAtMs: nowMs,
    lastAction: {
      action: normalizedAction,
      at: timestampFromMillis(nowMs),
      atMs: nowMs,
      actorUserId: normalizeString(actorUserId) || null,
      actorRole: normalizeString(actorRole) || 'staff',
      reasonCode: reasonCode ? normalizeWatchListReasonCode(reasonCode) : null,
      reason: normalizeString(reason) || null,
    },
    stateVersion: OPERATIONAL_STATE_VERSION,
  };

  if (normalizedAction === 'request') {
    nextState.watchListRequested = true;
    nextState.watchListApplied = false;
    nextState.watchListActive = false;
    nextState.watchListRequestedAt = nowMs;
    nextState.watchListAppliedAt = null;
    nextState.watchListClearedAt = null;
    nextState.watchListReasonCode = reasonCode ? normalizeWatchListReasonCode(reasonCode) : null;
    nextState.watchListReason = normalizeString(reason) || null;
    nextState.watchListSource = normalizeString(watchListSource) || normalizeString(actorRole) || 'staff';
    nextState.watchListReviewDueAt = coerceMillis(watchListReviewDueAt) || null;
    nextState.requestedRestrictionFlags = nextRequestedRestrictionFlags;
    nextState.restrictionFlags = normalizeOperationalRestrictionFlags({}, {
      baseStatus: normalizedBaseStatus,
      watchListActive: false,
    });
    nextState.effectiveRestrictionFlags = resolveOperationalRestrictionFlags({
      baseStatus: normalizedBaseStatus,
      watchListActive: false,
      restrictionFlags: nextState.restrictionFlags,
    });
    nextState.linkedIncidentIds = normalizeLinkedIncidentIds(linkedIncidentIds);
  } else if (normalizedAction === 'apply') {
    nextState.watchListRequested = false;
    nextState.watchListApplied = true;
    nextState.watchListActive = true;
    nextState.watchListRequestedAt = existingState?.watchListRequestedAt || null;
    nextState.watchListAppliedAt = nowMs;
    nextState.watchListClearedAt = null;
    nextState.watchListReasonCode = reasonCode
      ? normalizeWatchListReasonCode(reasonCode)
      : normalizeWatchListReasonCode(existingState?.watchListReasonCode);
    nextState.watchListReason = normalizeString(reason) || normalizeString(existingState?.watchListReason) || null;
    nextState.watchListSource = normalizeString(watchListSource) || normalizeString(actorRole) || 'staff';
    nextState.watchListReviewDueAt = coerceMillis(watchListReviewDueAt) || coerceMillis(existingState?.watchListReviewDueAt) || null;
    nextState.requestedRestrictionFlags = nextRequestedRestrictionFlags || existingState?.requestedRestrictionFlags || null;
    nextState.restrictionFlags = nextRestrictionFlags || normalizeOperationalRestrictionFlags(existingState?.requestedRestrictionFlags || existingState?.restrictionFlags || {}, {
      baseStatus: normalizedBaseStatus,
      watchListActive: true,
    });
    nextState.effectiveRestrictionFlags = resolveOperationalRestrictionFlags({
      baseStatus: normalizedBaseStatus,
      watchListActive: true,
      restrictionFlags: nextState.restrictionFlags,
    });
    nextState.linkedIncidentIds = normalizeLinkedIncidentIds(linkedIncidentIds.length ? linkedIncidentIds : existingState?.linkedIncidentIds);
  } else {
    nextState.watchListRequested = false;
    nextState.watchListApplied = false;
    nextState.watchListActive = false;
    nextState.watchListRequestedAt = null;
    nextState.watchListAppliedAt = null;
    nextState.watchListClearedAt = nowMs;
    nextState.watchListReasonCode = null;
    nextState.watchListReason = null;
    nextState.watchListSource = normalizeString(watchListSource) || normalizeString(actorRole) || 'staff';
    nextState.watchListReviewDueAt = null;
    nextState.requestedRestrictionFlags = null;
    nextState.restrictionFlags = normalizeOperationalRestrictionFlags({}, {
      baseStatus: normalizedBaseStatus,
      watchListActive: false,
    });
    nextState.effectiveRestrictionFlags = resolveOperationalRestrictionFlags({
      baseStatus: normalizedBaseStatus,
      watchListActive: false,
      restrictionFlags: nextState.restrictionFlags,
    });
    nextState.linkedIncidentIds = normalizeLinkedIncidentIds(linkedIncidentIds.length ? linkedIncidentIds : existingState?.linkedIncidentIds);
  }

  const docRef = db.collection(PILOT_OPERATIONAL_STATES_COLLECTION).doc(context.pilotEnrollmentId);
  await docRef.set(nextState, { merge: true });
  await docRef.collection(PILOT_OPERATIONAL_STATE_ACTIONS_SUBCOLLECTION).doc().set({
    id: `${normalizedAction}_${nowMs}`,
    action: normalizedAction,
    pilotEnrollmentId: context.pilotEnrollmentId,
    pilotId: context.pilotId,
    athleteId: context.athleteId,
    organizationId: context.organizationId,
    teamId: context.teamId,
    cohortId: context.cohortId,
    actorUserId: normalizeString(actorUserId) || null,
    actorRole: normalizeString(actorRole) || 'staff',
    reasonCode: reasonCode ? normalizeWatchListReasonCode(reasonCode) : null,
    reason: normalizeString(reason) || null,
    baseStatus: normalizedBaseStatus,
    watchListActiveBefore: existingWatchListActive,
    watchListActiveAfter: Boolean(nextState.watchListActive),
    requestedRestrictionFlags: nextRequestedRestrictionFlags,
    restrictionFlags: nextState.restrictionFlags,
    linkedIncidentIds: nextState.linkedIncidentIds,
    watchListSource: nextState.watchListSource,
    watchListReviewDueAt: nextState.watchListReviewDueAt,
    createdAt: timestampFromMillis(nowMs),
    createdAtMs: nowMs,
  }, { merge: true });

  return nextState;
}

async function requestPilotWatchList(payload) {
  return writePilotOperationalStateChange({
    ...payload,
    action: 'request',
  });
}

async function applyPilotWatchList(payload) {
  return writePilotOperationalStateChange({
    ...payload,
    action: 'apply',
  });
}

async function clearPilotWatchList(payload) {
  return writePilotOperationalStateChange({
    ...payload,
    action: 'clear',
  });
}

function buildPilotOperationalRestrictionSummary(entry = {}) {
  const restriction = normalizePilotOperationalState(entry, {});
  return {
    ...restriction,
    active: restriction.watchListActive
      || restriction.effectiveRestrictionFlags?.suppressSurveys
      || restriction.effectiveRestrictionFlags?.suppressAssignments
      || restriction.effectiveRestrictionFlags?.suppressNudges
      || restriction.effectiveRestrictionFlags?.excludeFromAdherence
      || restriction.effectiveRestrictionFlags?.manualHold
      || ['paused', 'withdrawn'].includes(restriction.baseStatus),
  };
}

async function loadPilotOperationalRestrictions(db, pilotEnrollmentIds = []) {
  if (!Array.isArray(pilotEnrollmentIds) || !pilotEnrollmentIds.length) return new Map();

  const uniquePilotEnrollmentIds = [...new Set(pilotEnrollmentIds.map(normalizeString).filter(Boolean))];
  const entries = await Promise.all(uniquePilotEnrollmentIds.map(async (pilotEnrollmentId) => {
    try {
      const snapshot = await db.collection(PILOT_OPERATIONAL_STATES_COLLECTION).doc(pilotEnrollmentId).get();
      if (!snapshot.exists) return null;
      return [pilotEnrollmentId, buildPilotOperationalRestrictionSummary({
        id: snapshot.id,
        ...(snapshot.data() || {}),
      })];
    } catch (error) {
      return null;
    }
  }));

  return new Map(entries.filter(Boolean));
}

function isSurveyPromptSuppressedByOperationalRestriction(restriction = null) {
  if (!restriction) return false;
  return restriction.effectiveRestrictionFlags?.suppressSurveys === true
    || restriction.effectiveRestrictionFlags?.manualHold === true
    || ['paused', 'withdrawn'].includes(normalizeOperationalBaseStatus(restriction.baseStatus));
}

function isAdherenceExcludedByOperationalRestriction(restriction = null) {
  if (!restriction) return false;
  return restriction.effectiveRestrictionFlags?.excludeFromAdherence === true
    || restriction.effectiveRestrictionFlags?.manualHold === true;
}

async function evaluateCoachWorkflowContinuity({
  db,
  athleteId,
  pilotContext = null,
  preferredPilotEnrollmentId = null,
  preferredPilotId = null,
  preferredTeamMembershipId = null,
  sampleLimit = 10,
}) {
  let resolvedContext = pilotContext || null;
  const normalizedAthleteId = normalizeString(athleteId || resolvedContext?.athleteId);

  if ((!resolvedContext?.pilotId || !resolvedContext?.athleteId) && normalizedAthleteId) {
    resolvedContext = await resolvePilotEnrollmentContext({
      db,
      athleteId: normalizedAthleteId,
      preferredPilotEnrollmentId,
      preferredPilotId,
      preferredTeamMembershipId,
      allowMembershipFallback: false,
    });
  }

  if (!resolvedContext?.pilotId || !resolvedContext?.athleteId) {
    return null;
  }

  const escalations = await loadPilotEscalations(db, [resolvedContext.athleteId]);
  return {
    pilotId: normalizeString(resolvedContext.pilotId),
    pilotEnrollmentId: normalizeString(resolvedContext.pilotEnrollmentId) || null,
    athleteId: normalizeString(resolvedContext.athleteId),
    ...(buildCoachWorkflowContinuityReport(escalations, { sampleLimit }) || {}),
  };
}

function buildBackfillMetadata({
  source = 'manual_seed',
  lookbackDays = OUTCOME_BACKFILL_LOOKBACK_DAYS,
  seededAtMs = Date.now(),
  actorRole = 'system',
  actorUserId = null,
}) {
  return {
    source: normalizeString(source) || 'manual_seed',
    lookbackDays: Math.max(1, Math.floor(Number(lookbackDays) || OUTCOME_BACKFILL_LOOKBACK_DAYS)),
    seededAt: timestampFromMillis(seededAtMs),
    seededAtMs,
    actorRole: normalizeString(actorRole) || 'system',
    actorUserId: normalizeString(actorUserId) || null,
  };
}

function resolveBackfillWindowBounds({
  pilot = null,
  pilotEnrollment = null,
  lookbackDays = OUTCOME_BACKFILL_LOOKBACK_DAYS,
}) {
  const normalizedLookbackDays = Math.max(1, Math.floor(Number(lookbackDays) || OUTCOME_BACKFILL_LOOKBACK_DAYS));
  const pilotStartAt = coerceMillis(pilot?.startAt);
  const pilotEndAt = coerceMillis(pilot?.endAt);
  const enrollmentCompletedAt = coerceMillis(pilotEnrollment?.completedAt);
  const endAnchorMs = pilotEndAt && pilotEndAt < Date.now()
    ? pilotEndAt
    : (enrollmentCompletedAt && enrollmentCompletedAt < Date.now() ? enrollmentCompletedAt : Date.now());
  const endDateKey = toUtcDateKey(endAnchorMs);
  const pilotStartDateKey = pilotStartAt && pilotStartAt <= endAnchorMs ? toUtcDateKey(pilotStartAt) : '';
  const fallbackStartDateKey = shiftUtcDateKey(endDateKey, -(normalizedLookbackDays - 1));
  const startDateKey = pilotStartDateKey || fallbackStartDateKey;
  const effectiveLookbackDays = Math.max(
    1,
    Math.round((endOfUtcDayMs(endDateKey) - startOfUtcDayMs(startDateKey)) / (24 * 60 * 60 * 1000)) + 1
  );
  return {
    lookbackDays: effectiveLookbackDays,
    startDateKey,
    endDateKey,
    startMs: startOfUtcDayMs(startDateKey),
    endMs: endOfUtcDayMs(endDateKey),
  };
}

async function loadAthleteHistoricalCheckIns({
  db,
  athleteId,
  startDateKey,
  endDateKey,
}) {
  const normalizedAthleteId = normalizeString(athleteId);
  if (!db || !normalizedAthleteId || !startDateKey || !endDateKey) return [];

  try {
    const snapshot = await db
      .collection(CHECKINS_ROOT)
      .doc(normalizedAthleteId)
      .collection(CHECKINS_SUBCOLLECTION)
      .get();

    return snapshot.docs
      .map((docSnap) => ({ id: docSnap.id, ...(docSnap.data() || {}) }))
      .filter((entry) => {
        const sourceDate = normalizeString(entry.date || entry.sourceDate);
        return sourceDate && sourceDate >= startDateKey && sourceDate <= endDateKey;
      })
      .sort((left, right) => {
        const leftCreatedAt = coerceMillis(left.createdAt) || 0;
        const rightCreatedAt = coerceMillis(right.createdAt) || 0;
        return leftCreatedAt - rightCreatedAt;
      });
  } catch (error) {
    return [];
  }
}

async function loadAthleteHistoricalAssignments({
  db,
  athleteId,
  startDateKey,
  endDateKey,
}) {
  const normalizedAthleteId = normalizeString(athleteId);
  if (!db || !normalizedAthleteId || !startDateKey || !endDateKey) return [];

  const assignments = await queryCollectionByField(db, DAILY_ASSIGNMENTS_COLLECTION, 'athleteId', normalizedAthleteId);
  return assignments
    .filter((entry) => {
      const sourceDate = normalizeString(entry.sourceDate);
      return sourceDate && sourceDate >= startDateKey && sourceDate <= endDateKey;
    })
    .sort((left, right) => {
      const sourceDateOrder = normalizeString(left.sourceDate).localeCompare(normalizeString(right.sourceDate));
      if (sourceDateOrder !== 0) return sourceDateOrder;
      return (coerceMillis(left.updatedAt) || 0) - (coerceMillis(right.updatedAt) || 0);
    });
}

async function loadAthleteHistoricalAssignmentEvents({
  db,
  athleteId,
  startDateKey,
  endDateKey,
}) {
  const normalizedAthleteId = normalizeString(athleteId);
  if (!db || !normalizedAthleteId || !startDateKey || !endDateKey) return [];

  const events = await queryCollectionByField(db, ASSIGNMENT_EVENTS_COLLECTION, 'athleteId', normalizedAthleteId);
  return events
    .filter((entry) => normalizeString(entry.eventType) === 'completed')
    .filter((entry) => {
      const sourceDate = normalizeString(entry.sourceDate);
      return sourceDate && sourceDate >= startDateKey && sourceDate <= endDateKey;
    })
    .sort((left, right) => {
      const leftCreatedAt = coerceMillis(left.createdAt) || 0;
      const rightCreatedAt = coerceMillis(right.createdAt) || 0;
      return leftCreatedAt - rightCreatedAt;
    });
}

async function stampAssignmentPilotContext({
  db,
  assignment,
  pilotContext,
  backfillMetadata,
}) {
  const assignmentId = normalizeString(assignment?.id);
  if (!db || !assignmentId || !pilotContext?.pilotId) return null;

  const payload = {
    pilotId: normalizeString(pilotContext.pilotId),
    pilotEnrollmentId: normalizeString(pilotContext.pilotEnrollmentId) || null,
    organizationId: normalizeString(pilotContext.organizationId) || null,
    teamId: normalizeString(pilotContext.teamId) || null,
    cohortId: normalizeString(pilotContext.cohortId) || null,
    teamMembershipId: normalizeString(pilotContext.teamMembershipId) || null,
    outcomeBackfill: {
      ...(assignment?.outcomeBackfill && typeof assignment.outcomeBackfill === 'object' ? assignment.outcomeBackfill : {}),
      ...backfillMetadata,
    },
    updatedAt: timestampFromMillis(backfillMetadata.seededAtMs),
  };

  await db.collection(DAILY_ASSIGNMENTS_COLLECTION).doc(assignmentId).set(payload, { merge: true });
  return {
    ...assignment,
    ...payload,
  };
}

async function markEnrollmentOutcomeBackfill({
  db,
  pilotContext,
  startDateKey,
  endDateKey,
  backfillMetadata,
}) {
  const pilotEnrollmentId = normalizeString(pilotContext?.pilotEnrollmentId);
  if (!db || !pilotEnrollmentId || !startDateKey || !endDateKey) return null;

  const nextStartMs = startOfUtcDayMs(startDateKey);
  const existingStartMs = coerceMillis(pilotContext.pilotEnrollment?.outcomeBackfillStartAt);
  const effectiveStartMs = existingStartMs ? Math.min(existingStartMs, nextStartMs) : nextStartMs;

  const payload = {
    outcomeBackfillStartAt: timestampFromMillis(effectiveStartMs),
    outcomeBackfillStartAtMs: effectiveStartMs,
    outcomeBackfillEndAt: timestampFromMillis(endOfUtcDayMs(endDateKey)),
    outcomeBackfillEndAtMs: endOfUtcDayMs(endDateKey),
    outcomeBackfillCompletedAt: timestampFromMillis(backfillMetadata.seededAtMs),
    outcomeBackfillCompletedAtMs: backfillMetadata.seededAtMs,
    outcomeBackfillSource: backfillMetadata.source,
    outcomeBackfillLookbackDays: backfillMetadata.lookbackDays,
    updatedAt: timestampFromMillis(backfillMetadata.seededAtMs),
  };

  await db.collection(PILOT_ENROLLMENTS_COLLECTION).doc(pilotEnrollmentId).set(payload, { merge: true });
  pilotContext.pilotEnrollment = {
    ...(pilotContext.pilotEnrollment || {}),
    ...payload,
  };
  return payload;
}

async function backfillPilotAthleteOutcomeHistory({
  db,
  athleteId,
  preferredPilotEnrollmentId = null,
  preferredPilotId = null,
  preferredTeamMembershipId = null,
  lookbackDays = OUTCOME_BACKFILL_LOOKBACK_DAYS,
  actorRole = 'system',
  actorUserId = null,
  source = 'manual_seed',
  stampAssignments = true,
  recompute = true,
}) {
  const pilotContext = await resolvePilotEnrollmentContext({
    db,
    athleteId,
    preferredPilotEnrollmentId,
    preferredPilotId,
    preferredTeamMembershipId,
    allowMembershipFallback: false,
  });

  if (!pilotContext?.pilotId || !pilotContext?.pilotEnrollmentId || !pilotContext?.athleteId) {
    throw new Error('Pilot athlete backfill requires an active pilot enrollment context.');
  }

  const pilot = await loadPilotDocument(db, pilotContext.pilotId);
  const windowBounds = resolveBackfillWindowBounds({
    pilot,
    pilotEnrollment: pilotContext.pilotEnrollment,
    lookbackDays,
  });
  const backfillMetadata = buildBackfillMetadata({
    source,
    lookbackDays: windowBounds.lookbackDays,
    seededAtMs: Date.now(),
    actorRole,
    actorUserId,
  });
  const explicitDateKeys = new Set();
  const materializedDateKeys = listDateKeysBetween(windowBounds.startDateKey, windowBounds.endDateKey);
  const touchedAssignmentIds = new Set();

  const [checkIns, assignments, assignmentEvents] = await Promise.all([
    loadAthleteHistoricalCheckIns({
      db,
      athleteId: pilotContext.athleteId,
      startDateKey: windowBounds.startDateKey,
      endDateKey: windowBounds.endDateKey,
    }),
    loadAthleteHistoricalAssignments({
      db,
      athleteId: pilotContext.athleteId,
      startDateKey: windowBounds.startDateKey,
      endDateKey: windowBounds.endDateKey,
    }),
    loadAthleteHistoricalAssignmentEvents({
      db,
      athleteId: pilotContext.athleteId,
      startDateKey: windowBounds.startDateKey,
      endDateKey: windowBounds.endDateKey,
    }),
  ]);

  await markEnrollmentOutcomeBackfill({
    db,
    pilotContext,
    startDateKey: windowBounds.startDateKey,
    endDateKey: windowBounds.endDateKey,
    backfillMetadata,
  });

  for (const checkIn of checkIns) {
    const sourceDate = normalizeString(checkIn.date || checkIn.sourceDate);
    if (!sourceDate) continue;
    explicitDateKeys.add(sourceDate);
    await emitPilotMetricEvent({
      db,
      pilotContext,
      eventType: 'daily_checkin_completed',
      actorRole: 'athlete',
      actorUserId: normalizeString(pilotContext.athleteId),
      athleteId: normalizeString(pilotContext.athleteId),
      sourceCollection: CHECKINS_ROOT,
      sourceDocumentId: normalizeString(checkIn.id),
      sourceDate,
      metricPayload: {
        readinessScore: normalizeNumber(checkIn.readinessScore),
      },
      createdAt: coerceMillis(checkIn.createdAt) || startOfUtcDayMs(sourceDate),
    });
  }

  const completedAssignmentIds = new Set();
  for (const assignmentEvent of assignmentEvents) {
    const assignmentId = normalizeString(assignmentEvent.assignmentId);
    const sourceDate = normalizeString(assignmentEvent.sourceDate);
    if (!sourceDate) continue;
    explicitDateKeys.add(sourceDate);
    if (assignmentId) completedAssignmentIds.add(assignmentId);
    await emitPilotMetricEvent({
      db,
      pilotContext,
      eventType: 'daily_assignment_completed',
      actorRole: normalizeString(assignmentEvent.actorType) || 'athlete',
      actorUserId: normalizeString(assignmentEvent.actorUserId) || normalizeString(pilotContext.athleteId),
      athleteId: normalizeString(pilotContext.athleteId),
      sourceCollection: ASSIGNMENT_EVENTS_COLLECTION,
      sourceDocumentId: normalizeString(assignmentEvent.id),
      sourceDate,
      metricPayload: {
        assignmentId: assignmentId || null,
        actionType: normalizeString(assignmentEvent.metadata?.nextAssignmentSummary?.actionType)
          || normalizeString(assignmentEvent.metadata?.previousAssignmentSummary?.actionType)
          || null,
      },
      createdAt: coerceMillis(assignmentEvent.createdAt) || startOfUtcDayMs(sourceDate),
    });
  }

  for (const assignment of assignments) {
    const sourceDate = normalizeString(assignment.sourceDate);
    const assignmentId = normalizeString(assignment.id);
    if (!sourceDate || !assignmentId) continue;
    explicitDateKeys.add(sourceDate);
    touchedAssignmentIds.add(assignmentId);

    if (stampAssignments) {
      await stampAssignmentPilotContext({
        db,
        assignment,
        pilotContext,
        backfillMetadata,
      });
    }

    const completed = normalizeString(assignment.status) === 'completed';
    if (!completed || completedAssignmentIds.has(assignmentId)) {
      continue;
    }

    await emitPilotMetricEvent({
      db,
      pilotContext,
      eventType: 'daily_assignment_completed',
      actorRole: 'system',
      actorUserId: normalizeString(actorUserId) || normalizeString(pilotContext.athleteId),
      athleteId: normalizeString(pilotContext.athleteId),
      sourceCollection: DAILY_ASSIGNMENTS_COLLECTION,
      sourceDocumentId: assignmentId,
      sourceDate,
      metricPayload: {
        assignmentId,
        actionType: normalizeString(assignment.actionType) || null,
        executionPattern: normalizeString(assignment.executionPattern) || null,
      },
      createdAt: coerceMillis(assignment.updatedAt) || coerceMillis(assignment.createdAt) || endOfUtcDayMs(sourceDate),
    });
  }

  await upsertPilotMentalPerformanceSnapshot({
    db,
    athleteId: normalizeString(pilotContext.athleteId),
    snapshotType: 'current_latest_valid',
    preferredPilotEnrollmentId: normalizeString(pilotContext.pilotEnrollmentId),
    preferredPilotId: normalizeString(pilotContext.pilotId),
    preferredTeamMembershipId: normalizeString(pilotContext.teamMembershipId),
    sourceEventId: `pilot_outcome_backfill:${normalizeString(pilotContext.pilotEnrollmentId)}:${windowBounds.startDateKey}:${windowBounds.endDateKey}`,
  });

  const explicitDateKeyList = [...explicitDateKeys].sort();
  const recomputeDateKeys = [...new Set([...materializedDateKeys, ...explicitDateKeyList])].sort();
  let rollups = null;
  if (recompute) {
    rollups = await recomputePilotMetricRollups({
      db,
      pilotId: normalizeString(pilotContext.pilotId),
      explicitDateKeys: recomputeDateKeys,
    });
  }

  return {
    success: true,
    pilotId: normalizeString(pilotContext.pilotId),
    pilotEnrollmentId: normalizeString(pilotContext.pilotEnrollmentId),
    athleteId: normalizeString(pilotContext.athleteId),
    lookbackDays: windowBounds.lookbackDays,
    startDateKey: windowBounds.startDateKey,
    endDateKey: windowBounds.endDateKey,
    backfilledCheckInCount: checkIns.length,
    backfilledAssignmentCount: touchedAssignmentIds.size,
    backfilledAssignmentCompletionEventCount: completedAssignmentIds.size,
    explicitDateKeys: explicitDateKeyList,
    materializedDateKeys,
    rollups,
  };
}

async function loadTeamMembershipMap(db, enrollments = []) {
  const membershipMap = new Map();
  await Promise.all(
    enrollments.map(async (enrollment) => {
      const membershipId = normalizeString(enrollment.teamMembershipId);
      if (!membershipId || membershipMap.has(membershipId)) return;
      try {
        const membershipSnap = await db.collection(TEAM_MEMBERSHIPS_COLLECTION).doc(membershipId).get();
        if (membershipSnap.exists) {
          membershipMap.set(membershipId, { id: membershipSnap.id, ...(membershipSnap.data() || {}) });
        }
      } catch (error) {
        // Ignore missing membership reads and let callers fall back to enrollment-only context.
      }
    })
  );
  return membershipMap;
}

async function loadSnapshotSetForEnrollment(db, enrollment) {
  const pilotEnrollmentId = normalizeString(enrollment?.id);
  if (!pilotEnrollmentId) {
    return { baseline: null, current_latest_valid: null, endpoint: null };
  }

  const result = {
    baseline: null,
    current_latest_valid: null,
    endpoint: null,
  };

  await Promise.all(
    ['baseline', 'current_latest_valid', 'endpoint'].map(async (snapshotType) => {
      try {
        const snapshot = await db
          .collection(PILOT_ENROLLMENTS_COLLECTION)
          .doc(pilotEnrollmentId)
          .collection(PILOT_MENTAL_PERFORMANCE_SNAPSHOTS_SUBCOLLECTION)
          .doc(snapshotType)
          .get();

        if (snapshot.exists) {
          result[snapshotType] = { id: snapshot.id, ...(snapshot.data() || {}) };
        }
      } catch (error) {
        result[snapshotType] = null;
      }
    })
  );

  return result;
}

function resolveEndpointFreezeTarget({ pilot, enrollment }) {
  const enrollmentStatus = normalizeString(enrollment?.status).toLowerCase();
  const enrollmentCompletedAt = coerceMillis(enrollment?.completedAt) || coerceMillis(enrollment?.updatedAt);
  if (['completed', 'complete'].includes(enrollmentStatus)) {
    return {
      freezeReason: 'athlete_completion',
      frozenAt: enrollmentCompletedAt || Date.now(),
    };
  }

  const pilotEndAt = coerceMillis(pilot?.endAt);
  if (pilotEndAt && pilotEndAt <= Date.now()) {
    return {
      freezeReason: 'pilot_end_date',
      frozenAt: pilotEndAt,
    };
  }

  return null;
}

async function syncEndpointFreezeSnapshots({
  db,
  pilot,
  enrollments = [],
  snapshotSets = [],
}) {
  return Promise.all(
    enrollments.map(async (enrollment, index) => {
      const existingSnapshotSet = snapshotSets[index] || { baseline: null, current_latest_valid: null, endpoint: null };
      const endpointFreezeTarget = resolveEndpointFreezeTarget({ pilot, enrollment });
      if (!endpointFreezeTarget) {
        return existingSnapshotSet;
      }

      const existingEndpoint = existingSnapshotSet.endpoint;
      if (existingEndpoint?.endpointFreeze?.frozen) {
        return existingSnapshotSet;
      }

      const endpointSnapshot = await upsertPilotMentalPerformanceSnapshot({
        db,
        athleteId: normalizeString(enrollment.userId),
        snapshotType: 'endpoint',
        preferredPilotEnrollmentId: normalizeString(enrollment.id),
        preferredPilotId: normalizeString(enrollment.pilotId),
        preferredTeamMembershipId: normalizeString(enrollment.teamMembershipId),
        sourceEventId: `endpoint_freeze:${normalizeString(enrollment.id)}:${endpointFreezeTarget.freezeReason}`,
        endpointFreeze: {
          frozen: true,
          frozenAt: endpointFreezeTarget.frozenAt,
          freezeReason: endpointFreezeTarget.freezeReason,
        },
      });

      return {
        ...existingSnapshotSet,
        endpoint: endpointSnapshot,
      };
    })
  );
}

function resolveAthleteTimezone({ athleteId, assignmentsByAthlete }) {
  const candidateAssignments = assignmentsByAthlete.get(athleteId) || [];
  const withTimezone = [...candidateAssignments]
    .filter((assignment) => normalizeTimezone(assignment.timezone))
    .sort((left, right) => (coerceMillis(right.updatedAt) || 0) - (coerceMillis(left.updatedAt) || 0));

  return normalizeTimezone(withTimezone[0]?.timezone) || 'UTC';
}

function buildAssignmentsByAthlete(assignments = []) {
  return assignments.reduce((accumulator, assignment) => {
    const athleteId = normalizeString(assignment.athleteId);
    if (!athleteId) return accumulator;
    const current = accumulator.get(athleteId) || [];
    current.push(assignment);
    accumulator.set(athleteId, current);
    return accumulator;
  }, new Map());
}

function groupDailyAssignmentState(assignments = []) {
  const map = new Map();
  assignments.forEach((assignment) => {
    const athleteId = normalizeString(assignment.athleteId);
    const sourceDate = normalizeString(assignment.sourceDate);
    if (!athleteId || !sourceDate) return;
    const key = `${athleteId}::${sourceDate}`;
    const existing = map.get(key);
    if (!existing || (coerceMillis(assignment.updatedAt) || 0) >= (coerceMillis(existing.updatedAt) || 0)) {
      map.set(key, assignment);
    }
  });
  return map;
}

function groupDailyEvents(events = []) {
  const checkIns = new Map();
  const assignmentCompletions = new Map();
  const activationEvents = new Map();
  const withdrawalEvents = new Map();

  events.forEach((event) => {
    const athleteId = normalizeString(event.athleteId);
    const sourceDate = normalizeString(event.sourceDate) || toUtcDateKey(event.createdAt || event.createdAtMs);
    const eventTime = coerceMillis(event.createdAt) || event.createdAtMs || 0;
    if (athleteId && sourceDate && event.eventType === 'daily_checkin_completed') {
      checkIns.set(`${athleteId}::${sourceDate}`, event);
    }
    if (athleteId && sourceDate && event.eventType === 'daily_assignment_completed') {
      assignmentCompletions.set(`${athleteId}::${sourceDate}`, event);
    }

    const enrollmentId = normalizeString(event.pilotEnrollmentId);
    if (!enrollmentId || !eventTime) return;

    if (event.eventType === 'pilot_enrollment_activated') {
      const current = activationEvents.get(enrollmentId) || [];
      current.push(eventTime);
      activationEvents.set(enrollmentId, current);
    }
    if (event.eventType === 'pilot_enrollment_withdrawn') {
      const current = withdrawalEvents.get(enrollmentId) || [];
      current.push(eventTime);
      withdrawalEvents.set(enrollmentId, current);
    }
  });

  return {
    checkIns,
    assignmentCompletions,
    activationEvents,
    withdrawalEvents,
  };
}

function resolvePilotCurrentWindowStart(pilot, enrollments = [], events = []) {
  const candidateValues = [
    coerceMillis(pilot?.startAt),
    ...enrollments.map((entry) => coerceMillis(entry.createdAt)).filter(Boolean),
    ...enrollments.map((entry) => coerceMillis(entry.outcomeBackfillStartAt)).filter(Boolean),
    ...events
      .filter((entry) => entry.eventType === 'pilot_enrollment_activated')
      .map((entry) => coerceMillis(entry.createdAt) || entry.createdAtMs)
      .filter(Boolean),
  ].filter(Boolean);

  if (!candidateValues.length) {
    return toUtcDateKey(Date.now());
  }

  return toUtcDateKey(Math.min(...candidateValues));
}

function buildEnrollmentIntervals({
  enrollment,
  activationEvents,
  withdrawalEvents,
  timezone,
  checkIns,
  assignmentCompletions,
}) {
  const enrollmentId = normalizeString(enrollment?.id);
  const athleteId = normalizeString(enrollment?.userId);
  const activations = [...(activationEvents.get(enrollmentId) || [])].sort((left, right) => left - right);
  const withdrawals = [...(withdrawalEvents.get(enrollmentId) || [])].sort((left, right) => left - right);
  const backfillStartMs = coerceMillis(enrollment?.outcomeBackfillStartAt);
  if (!activations.length && normalizeString(enrollment?.status) === 'active') {
    activations.push(coerceMillis(enrollment.createdAt) || coerceMillis(enrollment.updatedAt) || Date.now());
  }

  return activations.map((activationMs, index) => {
    const effectiveActivationMs =
      index === 0 && backfillStartMs
        ? Math.min(activationMs, backfillStartMs)
        : activationMs;
    const activityDateKey = toTimezoneDateKey(effectiveActivationMs, timezone);
    const hasSameDayActivity =
      checkIns.has(`${athleteId}::${activityDateKey}`) || assignmentCompletions.has(`${athleteId}::${activityDateKey}`);
    const activationLocalHour = resolveTimezoneDateParts(effectiveActivationMs, timezone).hour;
    const intervalStartDate = activationLocalHour >= ACTIVATION_DAY_CUTOFF_HOUR && !hasSameDayActivity
      ? shiftUtcDateKey(activityDateKey, 1)
      : activityDateKey;

    const nextWithdrawal = withdrawals.find((value) => value > activationMs)
      || (normalizeString(enrollment?.status) === 'withdrawn' ? (coerceMillis(enrollment.updatedAt) || null) : null);
    const withdrawalDateKey = nextWithdrawal ? toTimezoneDateKey(nextWithdrawal, timezone) : null;
    const withdrawalHasSameDayActivity = withdrawalDateKey
      ? (checkIns.has(`${athleteId}::${withdrawalDateKey}`) || assignmentCompletions.has(`${athleteId}::${withdrawalDateKey}`))
      : false;
    const intervalEndDate = withdrawalDateKey
      ? (withdrawalHasSameDayActivity ? withdrawalDateKey : shiftUtcDateKey(withdrawalDateKey, -1))
      : null;

    return {
      startDate: intervalStartDate,
      endDate: intervalEndDate,
      index,
    };
  });
}

function isManualPauseDay({ teamMembership, pilotEnrollment, dateKey }) {
  const windows = []
    .concat(Array.isArray(teamMembership?.athleteOnboarding?.manualPauseWindows) ? teamMembership.athleteOnboarding.manualPauseWindows : [])
    .concat(Array.isArray(pilotEnrollment?.manualPauseWindows) ? pilotEnrollment.manualPauseWindows : []);

  return windows.some((window) => {
    const startDate = normalizeString(window?.startDate);
    const endDate = normalizeString(window?.endDate) || startDate;
    return startDate && dateKey >= startDate && dateKey <= endDate;
  });
}

function isEnrollmentPausedDay({
  pilotEnrollment,
  dateKey,
  timezone,
  checkIns,
  assignmentCompletions,
}) {
  if (normalizeString(pilotEnrollment?.status) !== 'paused') {
    return false;
  }

  const pausedAtMs = coerceMillis(pilotEnrollment?.updatedAt) || coerceMillis(pilotEnrollment?.pausedAt);
  if (!pausedAtMs) {
    return true;
  }

  const athleteId = normalizeString(pilotEnrollment?.userId);
  const pausedDateKey = toTimezoneDateKey(pausedAtMs, timezone);
  if (!pausedDateKey || dateKey < pausedDateKey) {
    return false;
  }

  const hasSameDayActivity = Boolean(
    athleteId
    && pausedDateKey === dateKey
    && (checkIns.has(`${athleteId}::${dateKey}`) || assignmentCompletions.has(`${athleteId}::${dateKey}`))
  );

  return !(pausedDateKey === dateKey && hasSameDayActivity);
}

const HARD_RISK_ESCALATION_PATTERN = /\b(suicid|self[- ]?harm|hurt myself|kill myself|end my life|overdose|unsafe|can't stay safe|cannot stay safe|want to die|die tonight|abuse|assault|violence|psychosis|hallucinat|manic|panic attack|can't function|cannot function)\b/i;
const BENIGN_PERFORMANCE_SUPPORT_PATTERN = /\b(competition|compete|competing|on stage|performance|pre[- ]?competition|nervous|anxious|anxiety|excited|regulate|regulation|focus|attention|sleep|bed|go to sleep|late|mind|what'?s on my mind|talk about|emotional regulation|stress)\b/i;
const LOSS_OF_FUNCTION_PATTERN = /\b(can't walk|cannot walk|can't move|cannot move|can't feel|cannot feel|can't use my (?:arm|leg|hand|foot)|cannot use my (?:arm|leg|hand|foot)|can't lift my (?:arm|leg|hand|foot)|cannot lift my (?:arm|leg|hand|foot)|can't grip|cannot grip|can't hold|cannot hold|arm won't work|leg won't work|hand won't work|foot won't work|went numb|loss of function|lost function|sudden weakness|weakness on one side|numbness|numb|paralysis|dropping things|stroke[- ]?like)\b/i;

function hasEscalationWorkflowProgress(escalation = {}) {
  return Boolean(
    coerceMillis(escalation.coachNotifiedAt)
    || coerceMillis(escalation.handoffInitiatedAt)
    || coerceMillis(escalation.handoffAcceptedAt)
    || coerceMillis(escalation.firstClinicianResponseAt)
    || coerceMillis(escalation.handoffCompletedAt)
    || coerceMillis(escalation.resolvedAt)
    || normalizeString(escalation.consentStatus) === 'accepted'
  );
}

function isBenignPerformanceSupportEscalation(escalation = {}) {
  const tier = Number(escalation.tier) || 0;
  if (tier <= 0 || tier >= 3) return false;
  if (hasEscalationWorkflowProgress(escalation)) return false;
  const combinedText = `${normalizeString(escalation.category)} ${normalizeString(escalation.classificationReason)} ${normalizeString(escalation.triggerContent)}`.trim();
  if (!combinedText) return false;
  if (HARD_RISK_ESCALATION_PATTERN.test(combinedText)) return false;
  return BENIGN_PERFORMANCE_SUPPORT_PATTERN.test(combinedText);
}

function hasLossOfFunctionConcern(text = '', recentMessages = []) {
  const combinedText = [text]
    .concat((Array.isArray(recentMessages) ? recentMessages : []).slice(-5).map((entry) => entry?.content || ''))
    .join(' ')
    .trim();
  return Boolean(combinedText) && LOSS_OF_FUNCTION_PATTERN.test(combinedText);
}

function isTrueCareEscalationClassification(classification = {}, text = '', recentMessages = []) {
  if (!classification || typeof classification !== 'object') return false;
  if (classification.requiresClinicalHandoff === true) return true;

  const family = normalizeString(classification.classificationFamily);
  if (family === 'care_escalation' || family === 'critical_safety') return true;

  const tier = Number(classification.tier) || 0;
  if (tier >= 2) return true;

  return hasLossOfFunctionConcern(text, recentMessages);
}

function isEscalationHoldDay(escalations = [], dateKey) {
  return escalations.some((escalation) => {
    if (isBenignPerformanceSupportEscalation(escalation)) return false;
    const createdDate = toUtcDateKey((coerceMillis(escalation.createdAt) || 0) * (coerceMillis(escalation.createdAt) ? 1 : 1000));
    const resolvedDate = toUtcDateKey(
      (coerceMillis(escalation.resolvedAt) || coerceMillis(escalation.handoffCompletedAt) || Date.now()) * ((coerceMillis(escalation.resolvedAt) || coerceMillis(escalation.handoffCompletedAt)) ? 1 : 1000)
    );
    return normalizeString(escalation.status) === 'active' && createdDate && dateKey >= createdDate && dateKey <= resolvedDate;
  });
}

function isNoTaskRestDay(assignment) {
  if (!assignment || typeof assignment !== 'object') return false;
  return NO_TASK_ASSIGNMENT_ACTION_TYPES.has(normalizeString(assignment.actionType))
    || NO_TASK_ASSIGNMENT_STATUSES.has(normalizeString(assignment.status));
}

function calculateMedian(values = []) {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const midpoint = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return roundMetric((sorted[midpoint - 1] + sorted[midpoint]) / 2);
  }
  return roundMetric(sorted[midpoint]);
}

function calculateNps(scores = []) {
  if (!scores.length) return null;
  const promoters = scores.filter((score) => score >= 9).length;
  const detractors = scores.filter((score) => score <= 6).length;
  return roundMetric(((promoters / scores.length) * 100) - ((detractors / scores.length) * 100));
}

function normalizeEscalationStatus(entry = {}) {
  const status = normalizeString(entry.status).toLowerCase();
  if (['declined', 'dismissed', 'cancelled', 'canceled'].includes(status)) {
    return 'declined';
  }
  if (['resolved', 'closed', 'completed'].includes(status) || coerceMillis(entry.resolvedAt) || coerceMillis(entry.handoffCompletedAt)) {
    return 'resolved';
  }
  return 'active';
}

function countsTowardCareEscalationHeadline(entry = {}) {
  if (isBenignPerformanceSupportEscalation(entry)) return false;
  if (entry.countsTowardCareKpi === true || entry.requiresClinicalHandoff === true) return true;
  const disposition = normalizeString(entry.disposition).toLowerCase();
  if (disposition === 'clinical_handoff') return true;
  return (Number(entry.tier) || 0) >= 2;
}

function computeElapsedMinutes(entry, startField, endField) {
  const startMs = coerceMillis(entry?.[startField]) || (typeof entry?.[startField] === 'number' ? Number(entry[startField]) * 1000 : 0);
  const endMs = coerceMillis(entry?.[endField]) || (typeof entry?.[endField] === 'number' ? Number(entry[endField]) * 1000 : 0);
  if (!startMs || !endMs || endMs < startMs) return null;
  return (endMs - startMs) / (60 * 1000);
}

function summarizeDurationMetric(values = []) {
  const normalized = values.filter((value) => value !== null && Number.isFinite(value));
  return {
    sampleCount: normalized.length,
    medianMinutes: calculateMedian(normalized),
    p75Minutes: calculatePercentile(normalized, 0.75),
  };
}

function calculateSurveySummary(responses = [], surveyKind) {
  const scores = responses.map((entry) => normalizeNumber(entry.score)).filter((value) => value !== null);
  const sortedScores = [...scores].sort((left, right) => left - right);
  const medianScore = calculateMedian(sortedScores);
  const averageScore = average(scores);
  const lowScoreShare = scores.length ? roundMetric((scores.filter((value) => value <= 6).length / scores.length) * 100) : null;
  const highScoreShare = scores.length ? roundMetric((scores.filter((value) => value >= 9).length / scores.length) * 100) : null;
  const trustBatteryScores = responses
    .map((entry) => normalizeNumber(entry.trustBattery?.averageScore))
    .filter((value) => value !== null);

  return {
    responseCount: responses.length,
    minimumSampleMet: responses.length >= SURVEY_MINIMUM_RESPONSE_THRESHOLD,
    averageScore,
    medianScore,
    lowScoreShare,
    highScoreShare,
    headlineValue:
      responses.length >= SURVEY_MINIMUM_RESPONSE_THRESHOLD
        ? (surveyKind === 'nps' ? calculateNps(scores) : averageScore)
        : null,
    trustBatteryAverage: surveyKind === 'trust' ? average(trustBatteryScores) : null,
  };
}

function selectLatestResponsesByRespondent(responses = [], surveyKind, respondentRole, windowStartMs, windowEndMs) {
  const responseMap = new Map();
  responses
    .filter((entry) => normalizeString(entry.surveyKind) === surveyKind && normalizeString(entry.respondentRole) === respondentRole)
    .filter((entry) => {
      const submittedAtMs = coerceMillis(entry.submittedAt) || entry.submittedAtMs || 0;
      return submittedAtMs >= windowStartMs && submittedAtMs <= windowEndMs;
    })
    .forEach((entry) => {
      const respondentUserId = normalizeString(entry.respondentUserId);
      if (!respondentUserId) return;
      const current = responseMap.get(respondentUserId);
      const nextMs = coerceMillis(entry.submittedAt) || entry.submittedAtMs || 0;
      const currentMs = current ? (coerceMillis(current.submittedAt) || current.submittedAtMs || 0) : 0;
      if (!current || nextMs >= currentMs) {
        responseMap.set(respondentUserId, entry);
      }
    });
  return [...responseMap.values()];
}

function buildSurveyDiagnostics(responses = [], windowStartMs, windowEndMs) {
  const athleteTrust = calculateSurveySummary(selectLatestResponsesByRespondent(responses, 'trust', 'athlete', windowStartMs, windowEndMs), 'trust');
  const coachTrust = calculateSurveySummary(selectLatestResponsesByRespondent(responses, 'trust', 'coach', windowStartMs, windowEndMs), 'trust');
  const clinicianTrust = calculateSurveySummary(selectLatestResponsesByRespondent(responses, 'trust', 'clinician', windowStartMs, windowEndMs), 'trust');
  const athleteNps = calculateSurveySummary(selectLatestResponsesByRespondent(responses, 'nps', 'athlete', windowStartMs, windowEndMs), 'nps');
  const coachNps = calculateSurveySummary(selectLatestResponsesByRespondent(responses, 'nps', 'coach', windowStartMs, windowEndMs), 'nps');
  const clinicianNps = calculateSurveySummary(selectLatestResponsesByRespondent(responses, 'nps', 'clinician', windowStartMs, windowEndMs), 'nps');

  return {
    minimumResponseThreshold: SURVEY_MINIMUM_RESPONSE_THRESHOLD,
    athleteTrust,
    coachTrust,
    clinicianTrust,
    athleteNps,
    coachNps,
    clinicianNps,
  };
}

function buildTrustDispositionBaselineSummary(enrollments = [], membershipMap = new Map()) {
  const scores = enrollments
    .map((enrollment) => {
      const enrollmentCovariate = enrollment?.optionalBaselineCovariates?.trustDispositionBaseline;
      if (enrollmentCovariate) return normalizeNumber(enrollmentCovariate.score);
      const membership = membershipMap.get(normalizeString(enrollment.teamMembershipId));
      return normalizeNumber(membership?.athleteOnboarding?.optionalBaselineCovariates?.trustDispositionBaseline?.score);
    })
    .filter((value) => value !== null);

  return {
    kind: 'ptt',
    version: TRUST_DISPOSITION_BASELINE_VERSION,
    responseCount: scores.length,
    averageScore: average(scores),
  };
}

function resolveWindowBounds(window, pilot, currentWindowStartDate, explicitDateKey) {
  const todayDateKey = toUtcDateKey(Date.now());
  if (window === 'daily' && explicitDateKey) {
    return {
      dateKey: explicitDateKey,
      startDateKey: explicitDateKey,
      endDateKey: explicitDateKey,
      startMs: startOfUtcDayMs(explicitDateKey),
      endMs: endOfUtcDayMs(explicitDateKey),
    };
  }

  if (window === 'last7d') {
    const startDateKey = shiftUtcDateKey(todayDateKey, -6);
    return {
      dateKey: null,
      startDateKey,
      endDateKey: todayDateKey,
      startMs: startOfUtcDayMs(startDateKey),
      endMs: endOfUtcDayMs(todayDateKey),
    };
  }

  if (window === 'last30d') {
    const startDateKey = shiftUtcDateKey(todayDateKey, -29);
    return {
      dateKey: null,
      startDateKey,
      endDateKey: todayDateKey,
      startMs: startOfUtcDayMs(startDateKey),
      endMs: endOfUtcDayMs(todayDateKey),
    };
  }

  const endDateKey = toUtcDateKey(coerceMillis(pilot?.endAt) || Date.now()) || todayDateKey;
  return {
    dateKey: null,
    startDateKey: currentWindowStartDate,
    endDateKey: normalizeString(pilot?.status) === 'completed' ? endDateKey : todayDateKey,
    startMs: startOfUtcDayMs(currentWindowStartDate),
    endMs: endOfUtcDayMs(normalizeString(pilot?.status) === 'completed' ? endDateKey : todayDateKey),
  };
}

function computeMentalPerformanceSummary(snapshotSets = [], windowStartMs, windowEndMs, useWindowFilter) {
  const eligibleCurrentSnapshots = snapshotSets
    .map((entry) => entry.current_latest_valid)
    .filter(Boolean)
    .filter((snapshot) => !snapshot.validity?.excludedFromHeadlineDelta)
    .filter((snapshot) => {
      if (!useWindowFilter) return true;
      const capturedAtMs = coerceMillis(snapshot.capturedAt) || snapshot.capturedAtMs || 0;
      return capturedAtMs >= windowStartMs && capturedAtMs <= windowEndMs;
    });

  const deltas = eligibleCurrentSnapshots
    .map((snapshot) => snapshot.targetDeltaFromBaseline)
    .filter(Boolean);

  return {
    headlineDelta: average(deltas.map((delta) => normalizeNumber(delta.pillarComposite)).filter((value) => value !== null)) || 0,
    focusDelta: average(deltas.map((delta) => normalizeNumber(delta.focus)).filter((value) => value !== null)) || 0,
    composureDelta: average(deltas.map((delta) => normalizeNumber(delta.composure)).filter((value) => value !== null)) || 0,
    decisionDelta: average(deltas.map((delta) => normalizeNumber(delta.decision)).filter((value) => value !== null)) || 0,
    improvedAthleteCount: deltas.filter((delta) => (normalizeNumber(delta.pillarComposite) || 0) > 0).length,
    improvedByFiveCount: deltas.filter((delta) => (normalizeNumber(delta.pillarComposite) || 0) >= 5).length,
    eligibleAthleteCount: deltas.length,
  };
}

function computeEscalationSummary(escalations = [], athleteIds = [], windowStartMs, windowEndMs) {
  const filtered = escalations.filter((entry) => {
    if (isBenignPerformanceSupportEscalation(entry)) return false;
    const createdAtMs = coerceMillis(entry.createdAt);
    const normalizedCreatedAtMs =
      createdAtMs
      || (typeof entry.createdAt === 'number' && Number.isFinite(entry.createdAt) ? entry.createdAt * 1000 : 0)
      || 0;
    return normalizedCreatedAtMs >= windowStartMs && normalizedCreatedAtMs <= windowEndMs;
  });
  const headlineEligible = filtered.filter((entry) => countsTowardCareEscalationHeadline(entry));
  const coachReviewOnly = filtered.filter((entry) => !countsTowardCareEscalationHeadline(entry));

  const timeToCareMinutes = headlineEligible
    .map((entry) => computeElapsedMinutes(entry, 'createdAt', 'handoffInitiatedAt'))
    .filter((value) => value !== null);

  const statusCounts = ESCALATION_STATUS_ORDER.reduce((accumulator, status) => {
    accumulator[status] = headlineEligible.filter((entry) => normalizeEscalationStatus(entry) === status).length;
    return accumulator;
  }, {});

  const tierByStatus = [1, 2, 3].reduce((accumulator, tier) => {
    const tierEntries = headlineEligible.filter((entry) => Number(entry.tier) === tier);
    accumulator[`tier${tier}`] = {
      total: tierEntries.length,
      active: tierEntries.filter((entry) => normalizeEscalationStatus(entry) === 'active').length,
      resolved: tierEntries.filter((entry) => normalizeEscalationStatus(entry) === 'resolved').length,
      declined: tierEntries.filter((entry) => normalizeEscalationStatus(entry) === 'declined').length,
    };
    return accumulator;
  }, {});

  const supportingSpeedToCare = {
    coachNotification: summarizeDurationMetric(headlineEligible.map((entry) => computeElapsedMinutes(entry, 'createdAt', 'coachNotifiedAt'))),
    consentAccepted: summarizeDurationMetric(headlineEligible.map((entry) => computeElapsedMinutes(entry, 'createdAt', 'consentTimestamp'))),
    handoffInitiated: summarizeDurationMetric(headlineEligible.map((entry) => computeElapsedMinutes(entry, 'createdAt', 'handoffInitiatedAt'))),
    handoffAccepted: summarizeDurationMetric(headlineEligible.map((entry) => computeElapsedMinutes(entry, 'createdAt', 'handoffAcceptedAt'))),
    firstClinicianResponse: summarizeDurationMetric(headlineEligible.map((entry) => computeElapsedMinutes(entry, 'createdAt', 'firstClinicianResponseAt'))),
    careCompleted: summarizeDurationMetric(headlineEligible.map((entry) => computeElapsedMinutes(entry, 'createdAt', 'handoffCompletedAt'))),
  };

  return {
    total: headlineEligible.length,
    tier1: headlineEligible.filter((entry) => Number(entry.tier) === 1).length,
    tier2: headlineEligible.filter((entry) => Number(entry.tier) === 2).length,
    tier3: headlineEligible.filter((entry) => Number(entry.tier) === 3).length,
    coachReviewOnlyTotal: coachReviewOnly.length,
    allOperationalEscalationsTotal: filtered.length,
    statusCounts,
    tierByStatus,
    medianMinutesToCare: calculateMedian(timeToCareMinutes),
    supportingSpeedToCare,
    ratePer100ActiveAthletes: athleteIds.length ? roundMetric((headlineEligible.length / athleteIds.length) * 100) : 0,
    workflowContinuity: buildCoachWorkflowContinuityReport(filtered),
  };
}

function buildCoachWorkflowContinuityReport(escalations = [], { sampleLimit = 10 } = {}) {
  const normalizedSampleLimit = Math.max(1, Math.min(20, Number(sampleLimit) || 10));
  const filtered = (Array.isArray(escalations) ? escalations : []).filter((entry) => !isBenignPerformanceSupportEscalation(entry));

  const statusCounts = ESCALATION_STATUS_ORDER.reduce((accumulator, status) => {
    accumulator[status] = 0;
    return accumulator;
  }, {});
  const dispositionCounts = {
    coach_review: 0,
    clinical_handoff: 0,
    other: 0,
  };

  const evaluated = filtered.map((entry) => {
    const disposition = normalizeString(entry.disposition).toLowerCase();
    const status = normalizeEscalationStatus(entry);
    const requiresCoachReview = entry.requiresCoachReview !== false;
    const hasCoachSignal = disposition === 'coach_review'
      || Boolean(coerceMillis(entry.coachNotifiedAt))
      || normalizeString(entry.classificationFamily).toLowerCase() === 'coach_review';
    const visibleToCoach = status === 'active' && requiresCoachReview && hasCoachSignal;
    const actionableToCoach = visibleToCoach;
    const visibilityReason = !requiresCoachReview
      ? 'not_required'
      : hasCoachSignal
        ? (disposition === 'coach_review'
          ? 'coach_review_disposition'
          : coerceMillis(entry.coachNotifiedAt)
            ? 'coach_notified'
            : 'coach_classification')
        : 'missing_coach_signal';

    if (statusCounts[status] !== undefined) {
      statusCounts[status] += 1;
    }
    if (dispositionCounts[disposition] !== undefined) {
      dispositionCounts[disposition] += 1;
    } else {
      dispositionCounts.other += 1;
    }

    return {
      id: normalizeString(entry.id) || null,
      tier: Number(entry.tier) || null,
      disposition: disposition || 'other',
      status,
      requiresCoachReview,
      hasCoachSignal,
      visibleToCoach,
      actionableToCoach,
      visibilityReason,
      coachNotifiedAt: coerceMillis(entry.coachNotifiedAt) || null,
      handoffInitiatedAt: coerceMillis(entry.handoffInitiatedAt) || null,
      handoffCompletedAt: coerceMillis(entry.handoffCompletedAt) || null,
      resolvedAt: coerceMillis(entry.resolvedAt) || null,
      classificationFamily: normalizeString(entry.classificationFamily) || null,
    };
  });

  const eligible = evaluated.filter((entry) => entry.status === 'active' && entry.requiresCoachReview);
  const visible = eligible.filter((entry) => entry.visibleToCoach);
  const actionable = visible.filter((entry) => entry.actionableToCoach);
  const visibilityGapTotal = Math.max(0, eligible.length - visible.length);

  return {
    totalEscalations: filtered.length,
    activeEscalations: statusCounts.active,
    coachWorkflowEligibleTotal: eligible.length,
    coachWorkflowVisibleTotal: visible.length,
    coachWorkflowActionableTotal: actionable.length,
    coachWorkflowVisibilityGapTotal: visibilityGapTotal,
    visibilityRate: eligible.length ? roundMetric((visible.length / eligible.length) * 100) : null,
    actionableRate: eligible.length ? roundMetric((actionable.length / eligible.length) * 100) : null,
    manualReviewRequired: visibilityGapTotal > 0,
    continuityStatus: visibilityGapTotal > 0 ? 'needs_manual_review' : 'healthy',
    statusCounts,
    dispositionCounts,
    samples: evaluated.filter((entry) => entry.status === 'active' && entry.requiresCoachReview).slice(0, normalizedSampleLimit),
  };
}

function computeAdherenceSummary({
  enrollments,
  membershipMap,
  assignmentsByAthlete,
  dailyAssignmentState,
  checkIns,
  assignmentCompletions,
  activationEvents,
  withdrawalEvents,
  operationalRestrictionsByEnrollmentId,
  windowStartDate,
  windowEndDate,
}) {
  let expectedAthleteDays = 0;
  let completedCheckInDays = 0;
  let completedAssignmentDays = 0;
  let adheredDays = 0;
  let activeAthleteCount = 0;
  const byAthlete = {};

  enrollments.forEach((enrollment) => {
    const athleteId = normalizeString(enrollment.userId);
    if (!athleteId) return;
    const teamMembership = membershipMap.get(normalizeString(enrollment.teamMembershipId)) || null;
    const timezone = resolveAthleteTimezone({ athleteId, assignmentsByAthlete });
    const intervals = buildEnrollmentIntervals({
      enrollment,
      activationEvents,
      withdrawalEvents,
      timezone,
      checkIns,
      assignmentCompletions,
    });
    const operationalRestriction = operationalRestrictionsByEnrollmentId?.get(normalizeString(enrollment.id)) || null;
    let athleteExpectedDays = 0;

    intervals.forEach((interval) => {
      const intervalStart = interval.startDate && interval.startDate > windowStartDate ? interval.startDate : windowStartDate;
      const intervalEndBase = interval.endDate && interval.endDate < windowEndDate ? interval.endDate : windowEndDate;
      if (!intervalStart || !intervalEndBase || intervalStart > intervalEndBase) return;

      listDateKeysBetween(intervalStart, intervalEndBase).forEach((dateKey) => {
        if (isManualPauseDay({ teamMembership, pilotEnrollment: enrollment, dateKey })) return;
        if (isEnrollmentPausedDay({
          pilotEnrollment: enrollment,
          dateKey,
          timezone,
          checkIns,
          assignmentCompletions,
        })) return;
        if (isOperationalRestrictedDay({
          operationalState: operationalRestriction,
          dateKey,
          timezone,
          checkIns,
          assignmentCompletions,
        })) return;

        const assignment = dailyAssignmentState.get(`${athleteId}::${dateKey}`);
        if (isNoTaskRestDay(assignment)) {
          return;
        }

        expectedAthleteDays += 1;
        athleteExpectedDays += 1;
        if (!byAthlete[athleteId]) {
          byAthlete[athleteId] = {
            expectedAthleteDays: 0,
            completedCheckInDays: 0,
            completedAssignmentDays: 0,
            adheredDays: 0,
          };
        }
        byAthlete[athleteId].expectedAthleteDays += 1;

        const hasCheckIn = checkIns.has(`${athleteId}::${dateKey}`);
        const hasAssignmentCompletion =
          assignmentCompletions.has(`${athleteId}::${dateKey}`)
          || normalizeString(assignment?.status) === 'completed';

        if (hasCheckIn) {
          completedCheckInDays += 1;
          byAthlete[athleteId].completedCheckInDays += 1;
        }
        if (hasAssignmentCompletion) {
          completedAssignmentDays += 1;
          byAthlete[athleteId].completedAssignmentDays += 1;
        }
        if (hasCheckIn && hasAssignmentCompletion) {
          adheredDays += 1;
          byAthlete[athleteId].adheredDays += 1;
        }
      });
    });

    if (athleteExpectedDays > 0) {
      activeAthleteCount += 1;
    }
  });

  return {
    expectedAthleteDays,
    completedCheckInDays,
    completedAssignmentDays,
    adheredDays,
    activeAthleteCount,
    adherenceRate: expectedAthleteDays ? roundMetric((adheredDays / expectedAthleteDays) * 100) : 0,
    dailyCheckInRate: expectedAthleteDays ? roundMetric((completedCheckInDays / expectedAthleteDays) * 100) : 0,
    assignmentCompletionRate: expectedAthleteDays ? roundMetric((completedAssignmentDays / expectedAthleteDays) * 100) : 0,
    byAthlete,
  };
}

function buildLatestAthleteSurveyScoreMap(responses = [], surveyKind, windowStartMs, windowEndMs) {
  const selected = selectLatestResponsesByRespondent(responses, surveyKind, 'athlete', windowStartMs, windowEndMs);
  return selected.reduce((accumulator, response) => {
    const athleteId = normalizeString(response.athleteId || response.respondentUserId);
    const score = normalizeNumber(response.score);
    if (!athleteId || score === null) return accumulator;
    accumulator[athleteId] = score;
    return accumulator;
  }, {});
}

function buildAthleteSnapshotSummary(enrollments = [], snapshotSets = []) {
  return enrollments.reduce((accumulator, enrollment, index) => {
    const athleteId = normalizeString(enrollment.userId);
    const currentSnapshot = snapshotSets[index]?.current_latest_valid || null;
    if (!athleteId || !currentSnapshot || currentSnapshot.validity?.excludedFromHeadlineDelta) {
      return accumulator;
    }

    accumulator[athleteId] = {
      mentalPerformanceDelta: normalizeNumber(currentSnapshot.targetDeltaFromBaseline?.pillarComposite),
      focusDelta: normalizeNumber(currentSnapshot.targetDeltaFromBaseline?.focus),
      composureDelta: normalizeNumber(currentSnapshot.targetDeltaFromBaseline?.composure),
      decisionDelta: normalizeNumber(currentSnapshot.targetDeltaFromBaseline?.decision),
    };
    return accumulator;
  }, {});
}

function buildAssignmentExposureByAthlete(assignments = []) {
  return assignments.reduce((accumulator, assignment) => {
    const athleteId = normalizeString(assignment.athleteId);
    if (!athleteId) return accumulator;

    if (!accumulator[athleteId]) {
      accumulator[athleteId] = {
        totalAssignedCount: 0,
        stateAwareAssignmentCount: 0,
        fallbackAssignmentCount: 0,
        protocolAssignedCount: 0,
        protocolCompletedCount: 0,
        protocolIncompleteCount: 0,
        simAssignedCount: 0,
        lighterSimAssignedCount: 0,
      };
    }

    const exposure = accumulator[athleteId];
    const actionType = normalizeString(assignment.actionType);
    const status = normalizeString(assignment.status);
    const isDeferred = actionType === 'defer' || status === 'deferred';
    if (isDeferred) {
      return accumulator;
    }

    exposure.totalAssignedCount += 1;
    if (assignment.sourceStateSnapshotId) {
      exposure.stateAwareAssignmentCount += 1;
    } else {
      exposure.fallbackAssignmentCount += 1;
    }

    if (actionType === 'protocol') {
      exposure.protocolAssignedCount += 1;
      if (status === 'completed') {
        exposure.protocolCompletedCount += 1;
      } else {
        exposure.protocolIncompleteCount += 1;
      }
    }

    if (actionType === 'sim') exposure.simAssignedCount += 1;
    if (actionType === 'lighter_sim') exposure.lighterSimAssignedCount += 1;
    return accumulator;
  }, {});
}

function buildAthleteGroupOutcomeSummary({
  athleteIds = [],
  adherenceByAthlete = {},
  snapshotSummaryByAthlete = {},
  trustByAthlete = {},
  npsByAthlete = {},
}) {
  const normalizedAthleteIds = athleteIds.map((entry) => normalizeString(entry)).filter(Boolean);
  const adherenceNumerator = normalizedAthleteIds.reduce((sum, athleteId) => sum + (adherenceByAthlete[athleteId]?.adheredDays || 0), 0);
  const adherenceDenominator = normalizedAthleteIds.reduce((sum, athleteId) => sum + (adherenceByAthlete[athleteId]?.expectedAthleteDays || 0), 0);

  return {
    athleteCount: normalizedAthleteIds.length,
    adherenceRate: adherenceDenominator ? roundMetric((adherenceNumerator / adherenceDenominator) * 100) : null,
    mentalPerformanceDelta: averageFromNullable(
      normalizedAthleteIds.map((athleteId) => snapshotSummaryByAthlete[athleteId]?.mentalPerformanceDelta)
    ),
    athleteTrust: averageFromNullable(normalizedAthleteIds.map((athleteId) => trustByAthlete[athleteId])),
    athleteNps: averageFromNullable(normalizedAthleteIds.map((athleteId) => npsByAthlete[athleteId])),
  };
}

function buildOutcomeHypothesisEvaluation({
  enrollments = [],
  adherenceSummary,
  surveyDiagnostics,
  responses = [],
  assignments = [],
  snapshotSets = [],
  windowStartMs,
  windowEndMs,
}) {
  const athleteIds = enrollments.map((entry) => normalizeString(entry.userId)).filter(Boolean);
  const assignmentExposureByAthlete = buildAssignmentExposureByAthlete(assignments);
  const snapshotSummaryByAthlete = buildAthleteSnapshotSummary(enrollments, snapshotSets);
  const adherenceByAthlete = adherenceSummary?.byAthlete || {};
  const trustByAthlete = buildLatestAthleteSurveyScoreMap(responses, 'trust', windowStartMs, windowEndMs);
  const npsByAthlete = buildLatestAthleteSurveyScoreMap(responses, 'nps', windowStartMs, windowEndMs);

  const stateAwareAthleteIds = athleteIds.filter((athleteId) => (assignmentExposureByAthlete[athleteId]?.stateAwareAssignmentCount || 0) > 0);
  const fallbackAthleteIds = athleteIds.filter((athleteId) => (assignmentExposureByAthlete[athleteId]?.stateAwareAssignmentCount || 0) === 0);
  const protocolCompletedAthleteIds = athleteIds.filter((athleteId) => (assignmentExposureByAthlete[athleteId]?.protocolCompletedCount || 0) > 0);
  const protocolIncompleteAthleteIds = athleteIds.filter((athleteId) => {
    const exposure = assignmentExposureByAthlete[athleteId];
    return (exposure?.protocolAssignedCount || 0) > 0 && (exposure?.protocolCompletedCount || 0) === 0;
  });

  const h3StateAware = buildAthleteGroupOutcomeSummary({
    athleteIds: stateAwareAthleteIds,
    adherenceByAthlete,
    snapshotSummaryByAthlete,
    trustByAthlete,
    npsByAthlete,
  });
  const h3Fallback = buildAthleteGroupOutcomeSummary({
    athleteIds: fallbackAthleteIds,
    adherenceByAthlete,
    snapshotSummaryByAthlete,
    trustByAthlete,
    npsByAthlete,
  });
  const h6Completed = buildAthleteGroupOutcomeSummary({
    athleteIds: protocolCompletedAthleteIds,
    adherenceByAthlete,
    snapshotSummaryByAthlete,
    trustByAthlete,
    npsByAthlete,
  });
  const h6Incomplete = buildAthleteGroupOutcomeSummary({
    athleteIds: protocolIncompleteAthleteIds,
    adherenceByAthlete,
    snapshotSummaryByAthlete,
    trustByAthlete,
    npsByAthlete,
  });

  return {
    usesRollupWindow: 'current',
    h3: {
      hypothesisCode: 'H3',
      comparisonLabel: 'State-aware recommendation exposure vs fallback or no recommendation exposure',
      stateAware: h3StateAware,
      fallbackOrNone: h3Fallback,
      delta: {
        adherenceRate: roundMetric((h3StateAware.adherenceRate || 0) - (h3Fallback.adherenceRate || 0)),
        mentalPerformanceDelta: roundMetric((h3StateAware.mentalPerformanceDelta || 0) - (h3Fallback.mentalPerformanceDelta || 0)),
        athleteTrust: roundMetric((h3StateAware.athleteTrust || 0) - (h3Fallback.athleteTrust || 0)),
      },
    },
    h5: {
      hypothesisCode: 'H5',
      comparisonLabel: 'Body-state-aware workflow exposure proxy vs profile-only or no state-aware exposure',
      bodyStateAwareExposure: h3StateAware,
      profileOnlyOrNone: h3Fallback,
      coachTrust: surveyDiagnostics?.coachTrust?.headlineValue ?? null,
      coachNps: surveyDiagnostics?.coachNps?.headlineValue ?? null,
      coachResponseCount: surveyDiagnostics?.coachTrust?.responseCount ?? 0,
      delta: {
        adherenceRate: roundMetric((h3StateAware.adherenceRate || 0) - (h3Fallback.adherenceRate || 0)),
        athleteTrust: roundMetric((h3StateAware.athleteTrust || 0) - (h3Fallback.athleteTrust || 0)),
      },
    },
    h6: {
      hypothesisCode: 'H6',
      comparisonLabel: 'Completed protocol recommendation vs assigned but incomplete protocol recommendation',
      completedProtocol: h6Completed,
      incompleteOrSkippedProtocol: h6Incomplete,
      delta: {
        adherenceRate: roundMetric((h6Completed.adherenceRate || 0) - (h6Incomplete.adherenceRate || 0)),
        mentalPerformanceDelta: roundMetric((h6Completed.mentalPerformanceDelta || 0) - (h6Incomplete.mentalPerformanceDelta || 0)),
        athleteTrust: roundMetric((h6Completed.athleteTrust || 0) - (h6Incomplete.athleteTrust || 0)),
      },
    },
  };
}

function buildRecommendationTypeSlices({
  enrollments = [],
  adherenceSummary,
  responses = [],
  assignments = [],
  snapshotSets = [],
  windowStartMs,
  windowEndMs,
}) {
  const athleteIds = enrollments.map((entry) => normalizeString(entry.userId)).filter(Boolean);
  const assignmentExposureByAthlete = buildAssignmentExposureByAthlete(assignments);
  const snapshotSummaryByAthlete = buildAthleteSnapshotSummary(enrollments, snapshotSets);
  const adherenceByAthlete = adherenceSummary?.byAthlete || {};
  const trustByAthlete = buildLatestAthleteSurveyScoreMap(responses, 'trust', windowStartMs, windowEndMs);
  const npsByAthlete = buildLatestAthleteSurveyScoreMap(responses, 'nps', windowStartMs, windowEndMs);

  const groups = {
    stateAware: athleteIds.filter((athleteId) => (assignmentExposureByAthlete[athleteId]?.stateAwareAssignmentCount || 0) > 0),
    fallbackOrNone: athleteIds.filter((athleteId) => (assignmentExposureByAthlete[athleteId]?.stateAwareAssignmentCount || 0) === 0),
    completedProtocol: athleteIds.filter((athleteId) => (assignmentExposureByAthlete[athleteId]?.protocolCompletedCount || 0) > 0),
    incompleteOrSkippedProtocol: athleteIds.filter((athleteId) => {
      const exposure = assignmentExposureByAthlete[athleteId];
      return (exposure?.protocolAssignedCount || 0) > 0 && (exposure?.protocolCompletedCount || 0) === 0;
    }),
  };

  const summaries = Object.entries(groups).reduce((accumulator, [groupKey, groupAthleteIds]) => {
    accumulator[groupKey] = buildAthleteGroupOutcomeSummary({
      athleteIds: groupAthleteIds,
      adherenceByAthlete,
      snapshotSummaryByAthlete,
      trustByAthlete,
      npsByAthlete,
    });
    return accumulator;
  }, {});

  return {
    stateAwareVsFallback: {
      stateAware: summaries.stateAware,
      fallbackOrNone: summaries.fallbackOrNone,
      delta: {
        adherenceRate: roundMetric((summaries.stateAware.adherenceRate || 0) - (summaries.fallbackOrNone.adherenceRate || 0)),
        athleteTrust: roundMetric((summaries.stateAware.athleteTrust || 0) - (summaries.fallbackOrNone.athleteTrust || 0)),
      },
    },
    protocolCompletion: {
      completedProtocol: summaries.completedProtocol,
      incompleteOrSkippedProtocol: summaries.incompleteOrSkippedProtocol,
      delta: {
        adherenceRate: roundMetric((summaries.completedProtocol.adherenceRate || 0) - (summaries.incompleteOrSkippedProtocol.adherenceRate || 0)),
        athleteTrust: roundMetric((summaries.completedProtocol.athleteTrust || 0) - (summaries.incompleteOrSkippedProtocol.athleteTrust || 0)),
      },
    },
  };
}

function buildOutcomeMetrics({
  enrollmentSummary,
  adherenceSummary,
  mentalPerformanceSummary,
  escalationSummary,
  surveyDiagnostics,
}) {
  return {
    enrollmentRate: enrollmentSummary.enrollmentRate,
    consentCompletionRate: enrollmentSummary.consentCompletionRate,
    baselineCompletionRate: enrollmentSummary.baselineCompletionRate,
    adherenceRate: adherenceSummary.adherenceRate,
    dailyCheckInRate: adherenceSummary.dailyCheckInRate,
    assignmentCompletionRate: adherenceSummary.assignmentCompletionRate,
    mentalPerformanceDelta: mentalPerformanceSummary.headlineDelta,
    escalationsTotal: escalationSummary.total,
    escalationsTier1: escalationSummary.tier1,
    escalationsTier2: escalationSummary.tier2,
    escalationsTier3: escalationSummary.tier3,
    medianMinutesToCare: escalationSummary.medianMinutesToCare,
    athleteNps: surveyDiagnostics.athleteNps.headlineValue,
    coachNps: surveyDiagnostics.coachNps.headlineValue,
    clinicianNps: surveyDiagnostics.clinicianNps.headlineValue,
    athleteTrust: surveyDiagnostics.athleteTrust.headlineValue,
    coachTrust: surveyDiagnostics.coachTrust.headlineValue,
    clinicianTrust: surveyDiagnostics.clinicianTrust.headlineValue,
  };
}

function buildEnrollmentSummary(enrollments = [], membershipMap = new Map()) {
  const totalEnrollmentCount = enrollments.length;
  const baselineCompleteCount = enrollments.filter((entry) => {
    const teamMembership = membershipMap.get(normalizeString(entry.teamMembershipId));
    return normalizeString(teamMembership?.athleteOnboarding?.baselinePathStatus) === 'complete';
  }).length;
  const consentCompletionCount = enrollments.filter((entry) => {
    const teamMembership = membershipMap.get(normalizeString(entry.teamMembershipId));
    return hasCompletedEnrollmentConsents({ teamMembership, pilotEnrollment: entry });
  }).length;
  const enrollmentCompleteCount = enrollments.filter((entry) => {
    const teamMembership = membershipMap.get(normalizeString(entry.teamMembershipId));
    return isEnrollmentComplete({ teamMembership, pilotEnrollment: entry });
  }).length;

  return {
    totalEnrollmentCount,
    consentCompletionCount,
    baselineCompleteCount,
    enrollmentCompleteCount,
    enrollmentRate: totalEnrollmentCount ? roundMetric((enrollmentCompleteCount / totalEnrollmentCount) * 100) : 0,
    consentCompletionRate: totalEnrollmentCount ? roundMetric((consentCompletionCount / totalEnrollmentCount) * 100) : 0,
    baselineCompletionRate: totalEnrollmentCount ? roundMetric((baselineCompleteCount / totalEnrollmentCount) * 100) : 0,
  };
}

async function computePilotOutcomeRollup({
  db,
  pilotId,
  window,
  explicitDateKey = null,
  pilot = null,
  enrollments = null,
  membershipMap = null,
  events = null,
  responses = null,
  assignments = null,
  escalations = null,
  snapshotSets = null,
}) {
  const resolvedPilot = pilot || await loadPilotDocument(db, pilotId);
  const resolvedEnrollments = enrollments || await loadPilotEnrollments(db, pilotId);
  const resolvedMembershipMap = membershipMap || await loadTeamMembershipMap(db, resolvedEnrollments);
  const resolvedEvents = events || await loadPilotMetricEvents(db, pilotId);
  const resolvedResponses = responses || await loadPilotSurveyResponses(db, pilotId);
  const resolvedAssignments = assignments || await loadPilotDailyAssignments(db, pilotId);
  const athleteIds = resolvedEnrollments.map((entry) => normalizeString(entry.userId)).filter(Boolean);
  const resolvedEscalations = escalations || await loadPilotEscalations(db, athleteIds);
  const initialSnapshotSets = snapshotSets || await Promise.all(resolvedEnrollments.map((entry) => loadSnapshotSetForEnrollment(db, entry)));
  const resolvedOperationalStates = await loadPilotOperationalStates(db, resolvedEnrollments, resolvedMembershipMap);
  const operationalRestrictionsByEnrollmentId = new Map(
    resolvedOperationalStates.map((state) => [normalizeString(state.pilotEnrollmentId || state.id), state])
  );
  const resolvedSnapshotSets = await syncEndpointFreezeSnapshots({
    db,
    pilot: resolvedPilot,
    enrollments: resolvedEnrollments,
    snapshotSets: initialSnapshotSets,
  });
  const snapshotSetByEnrollmentId = new Map(
    resolvedEnrollments.map((entry, index) => [normalizeString(entry.id), resolvedSnapshotSets[index] || null])
  );
  const currentWindowStartDate = resolvePilotCurrentWindowStart(resolvedPilot, resolvedEnrollments, resolvedEvents);
  const bounds = resolveWindowBounds(window, resolvedPilot, currentWindowStartDate, explicitDateKey);
  const assignmentsByAthlete = buildAssignmentsByAthlete(resolvedAssignments);
  const dailyAssignmentState = groupDailyAssignmentState(resolvedAssignments);
  const { checkIns, assignmentCompletions, activationEvents, withdrawalEvents } = groupDailyEvents(resolvedEvents);

  const enrollmentSummary = buildEnrollmentSummary(resolvedEnrollments, resolvedMembershipMap);
  const adherenceSummary = computeAdherenceSummary({
    enrollments: resolvedEnrollments,
    membershipMap: resolvedMembershipMap,
    assignmentsByAthlete,
    dailyAssignmentState,
    checkIns,
    assignmentCompletions,
    activationEvents,
    withdrawalEvents,
    operationalRestrictionsByEnrollmentId,
    windowStartDate: bounds.startDateKey,
    windowEndDate: bounds.endDateKey,
  });
  const mentalPerformanceSummary = computeMentalPerformanceSummary(
    resolvedSnapshotSets,
    bounds.startMs,
    bounds.endMs,
    window !== 'current'
  );
  const escalationSummary = computeEscalationSummary(resolvedEscalations, athleteIds, bounds.startMs, bounds.endMs);
  const surveyDiagnostics = buildSurveyDiagnostics(resolvedResponses, bounds.startMs, bounds.endMs);
  const trustDispositionBaseline = buildTrustDispositionBaselineSummary(resolvedEnrollments, resolvedMembershipMap);
  const hypothesisEvaluation = buildOutcomeHypothesisEvaluation({
    enrollments: resolvedEnrollments,
    adherenceSummary,
    surveyDiagnostics,
    responses: resolvedResponses,
    assignments: resolvedAssignments,
    snapshotSets: resolvedSnapshotSets,
    windowStartMs: bounds.startMs,
    windowEndMs: bounds.endMs,
  });
  const recommendationTypeSlices = buildRecommendationTypeSlices({
    enrollments: resolvedEnrollments,
    adherenceSummary,
    responses: resolvedResponses,
    assignments: resolvedAssignments,
    snapshotSets: resolvedSnapshotSets,
    windowStartMs: bounds.startMs,
    windowEndMs: bounds.endMs,
  });
  const outcomeByCohort = {};
  const surveyDiagnosticsByCohort = {};
  const hypothesisEvaluationByCohort = {};
  const recommendationTypeSlicesByCohort = {};

  [...new Set(resolvedEnrollments.map((entry) => normalizeString(entry.cohortId)).filter(Boolean))].forEach((cohortId) => {
    const cohortEnrollments = resolvedEnrollments.filter((entry) => normalizeString(entry.cohortId) === cohortId);
    const cohortAthleteIds = cohortEnrollments.map((entry) => normalizeString(entry.userId)).filter(Boolean);
    const cohortResponses = resolvedResponses.filter((entry) => {
      const responseCohortId = normalizeString(entry.cohortId);
      if (responseCohortId) return responseCohortId === cohortId;
      return cohortAthleteIds.includes(normalizeString(entry.athleteId));
    });
    const cohortEscalations = resolvedEscalations.filter((entry) => cohortAthleteIds.includes(normalizeString(entry.userId)));
    const cohortSnapshots = cohortEnrollments
      .map((entry) => snapshotSetByEnrollmentId.get(normalizeString(entry.id)))
      .filter(Boolean);
    const cohortAdherenceSummary = computeAdherenceSummary({
      enrollments: cohortEnrollments,
      membershipMap: resolvedMembershipMap,
      assignmentsByAthlete,
      dailyAssignmentState,
      checkIns,
      assignmentCompletions,
      activationEvents,
      withdrawalEvents,
      operationalRestrictionsByEnrollmentId,
      windowStartDate: bounds.startDateKey,
      windowEndDate: bounds.endDateKey,
    });
    const cohortMentalPerformanceSummary = computeMentalPerformanceSummary(
      cohortSnapshots,
      bounds.startMs,
      bounds.endMs,
      window !== 'current'
    );
    const cohortEscalationSummary = computeEscalationSummary(cohortEscalations, cohortAthleteIds, bounds.startMs, bounds.endMs);
    const cohortSurveyDiagnostics = buildSurveyDiagnostics(cohortResponses, bounds.startMs, bounds.endMs);
    const cohortHypothesisEvaluation = buildOutcomeHypothesisEvaluation({
      enrollments: cohortEnrollments,
      adherenceSummary: cohortAdherenceSummary,
      surveyDiagnostics: cohortSurveyDiagnostics,
      responses: cohortResponses,
      assignments: resolvedAssignments.filter((assignment) => cohortAthleteIds.includes(normalizeString(assignment.athleteId))),
      snapshotSets: cohortSnapshots,
      windowStartMs: bounds.startMs,
      windowEndMs: bounds.endMs,
    });
    const cohortRecommendationTypeSlices = buildRecommendationTypeSlices({
      enrollments: cohortEnrollments,
      adherenceSummary: cohortAdherenceSummary,
      responses: cohortResponses,
      assignments: resolvedAssignments.filter((assignment) => cohortAthleteIds.includes(normalizeString(assignment.athleteId))),
      snapshotSets: cohortSnapshots,
      windowStartMs: bounds.startMs,
      windowEndMs: bounds.endMs,
    });

    outcomeByCohort[cohortId] = buildOutcomeMetrics({
      enrollmentSummary: buildEnrollmentSummary(cohortEnrollments, resolvedMembershipMap),
      adherenceSummary: cohortAdherenceSummary,
      mentalPerformanceSummary: cohortMentalPerformanceSummary,
      escalationSummary: cohortEscalationSummary,
      surveyDiagnostics: cohortSurveyDiagnostics,
    });
    surveyDiagnosticsByCohort[cohortId] = cohortSurveyDiagnostics;
    hypothesisEvaluationByCohort[cohortId] = cohortHypothesisEvaluation;
    recommendationTypeSlicesByCohort[cohortId] = cohortRecommendationTypeSlices;
  });

  return {
    pilotId,
    organizationId: normalizeString(resolvedPilot?.organizationId || resolvedEnrollments[0]?.organizationId),
    teamId: normalizeString(resolvedPilot?.teamId || resolvedEnrollments[0]?.teamId),
    cohortId: null,
    window,
    dateKey: bounds.dateKey,
    windowStartDate: bounds.startDateKey,
    windowEndDate: bounds.endDateKey,
    metrics: buildOutcomeMetrics({
      enrollmentSummary,
      adherenceSummary,
      mentalPerformanceSummary,
      escalationSummary,
      surveyDiagnostics,
    }),
    diagnostics: {
      enrollment: enrollmentSummary,
      adherence: {
        expectedAthleteDays: adherenceSummary.expectedAthleteDays,
        completedCheckInDays: adherenceSummary.completedCheckInDays,
        completedAssignmentDays: adherenceSummary.completedAssignmentDays,
        adheredDays: adherenceSummary.adheredDays,
        activeAthleteCount: adherenceSummary.activeAthleteCount,
      },
      operational: buildOperationalStateSummary(resolvedOperationalStates),
      mentalPerformance: mentalPerformanceSummary,
      escalations: escalationSummary,
      surveys: surveyDiagnostics,
      trustDispositionBaseline,
      surveysByCohort: surveyDiagnosticsByCohort,
      hypothesisEvaluation,
      hypothesisEvaluationByCohort,
      recommendationTypeSlices,
      recommendationTypeSlicesByCohort,
    },
    outcomeByCohort,
    computedAt: timestampFromMillis(Date.now()),
    computedAtMs: Date.now(),
  };
}

async function writePilotOutcomeRollup(db, rollup) {
  const pilotId = normalizeString(rollup?.pilotId);
  if (!pilotId) return null;

  const rootRef = db.collection(PILOT_METRIC_ROLLUPS_COLLECTION).doc(pilotId);
  await rootRef.set(
    {
      id: pilotId,
      pilotId,
      organizationId: rollup.organizationId || null,
      teamId: rollup.teamId || null,
      updatedAt: rollup.computedAt,
      updatedAtMs: rollup.computedAtMs || Date.now(),
    },
    { merge: true }
  );

  if (rollup.window === 'daily' && rollup.dateKey) {
    const docRef = rootRef.collection(PILOT_METRIC_ROLLUP_DAILY_SUBCOLLECTION).doc(rollup.dateKey);
    await docRef.set(rollup, { merge: true });
    return rollup;
  }

  const docRef = rootRef.collection(PILOT_METRIC_ROLLUP_SUMMARY_SUBCOLLECTION).doc(rollup.window);
  await docRef.set(rollup, { merge: true });
  return rollup;
}

async function recomputePilotMetricRollups({
  db,
  pilotId,
  explicitDateKeys = [],
}) {
  const normalizedPilotId = normalizeString(pilotId);
  if (!normalizedPilotId) return null;
  const startedAtMs = Date.now();
  await writePilotMetricOpsStatus({
    db,
    pilotId: normalizedPilotId,
    scope: 'rollup_recompute',
    status: 'running',
    details: {
      startedAt: timestampFromMillis(startedAtMs),
      startedAtMs,
      explicitDateKeys: [...new Set((explicitDateKeys || []).map((entry) => normalizeString(entry)).filter(Boolean))],
    },
  });

  try {
    const pilot = await loadPilotDocument(db, normalizedPilotId);
    const enrollments = await loadPilotEnrollments(db, normalizedPilotId);
    const membershipMap = await loadTeamMembershipMap(db, enrollments);
    const events = await loadPilotMetricEvents(db, normalizedPilotId);
    const responses = await loadPilotSurveyResponses(db, normalizedPilotId);
    const assignments = await loadPilotDailyAssignments(db, normalizedPilotId);
    const athleteIds = enrollments.map((entry) => normalizeString(entry.userId)).filter(Boolean);
    const escalations = await loadPilotEscalations(db, athleteIds);
    const snapshotSets = await Promise.all(enrollments.map((entry) => loadSnapshotSetForEnrollment(db, entry)));

    const payload = {
      db,
      pilotId: normalizedPilotId,
      pilot,
      enrollments,
      membershipMap,
      events,
      responses,
      assignments,
      escalations,
      snapshotSets,
    };

    const written = {
      current: await writePilotOutcomeRollup(db, await computePilotOutcomeRollup({ ...payload, window: 'current' })),
      last7d: await writePilotOutcomeRollup(db, await computePilotOutcomeRollup({ ...payload, window: 'last7d' })),
      last30d: await writePilotOutcomeRollup(db, await computePilotOutcomeRollup({ ...payload, window: 'last30d' })),
      daily: [],
    };

    const dateKeys = [...new Set((explicitDateKeys || []).map((entry) => normalizeString(entry)).filter(Boolean))];
    for (const dateKey of dateKeys) {
      const dailyRollup = await computePilotOutcomeRollup({ ...payload, window: 'daily', explicitDateKey: dateKey });
      await writePilotOutcomeRollup(db, dailyRollup);
      written.daily.push(dailyRollup);
    }

    await writePilotMetricOpsStatus({
      db,
      pilotId: normalizedPilotId,
      scope: 'rollup_recompute',
      status: 'succeeded',
      details: {
        lastSuccessAt: timestampFromMillis(Date.now()),
        lastSuccessAtMs: Date.now(),
        durationMs: Date.now() - startedAtMs,
        repairedDailyCount: written.daily.length,
      },
    });

    return written;
  } catch (error) {
    await writePilotMetricOpsStatus({
      db,
      pilotId: normalizedPilotId,
      scope: 'rollup_recompute',
      status: 'failed',
      details: {
        lastFailureAt: timestampFromMillis(Date.now()),
        lastFailureAtMs: Date.now(),
        durationMs: Date.now() - startedAtMs,
        lastError: normalizeString(error?.message || String(error)) || 'Unknown rollup recompute failure',
      },
    });
    await recordPilotMetricAlert({
      db,
      pilotId: normalizedPilotId,
      scope: 'rollup_recompute',
      severity: 'error',
      message: error?.message || 'Pilot rollup recompute failed.',
      context: {
        explicitDateKeys,
      },
    });
    throw error;
  }
}

function buildRepairDateKeys(lookbackDays = ROLLUP_REPAIR_LOOKBACK_DAYS) {
  const normalizedLookbackDays = Math.max(1, Math.floor(Number(lookbackDays) || ROLLUP_REPAIR_LOOKBACK_DAYS));
  const todayDateKey = toUtcDateKey(Date.now());
  return Array.from({ length: normalizedLookbackDays }, (_, index) =>
    shiftUtcDateKey(todayDateKey, -(normalizedLookbackDays - index - 1))
  );
}

async function loadRepairCandidatePilots({
  db,
  pilotIds = null,
  maxPilots = 50,
  lookbackDays = ROLLUP_REPAIR_LOOKBACK_DAYS,
}) {
  const normalizedPilotIds = Array.isArray(pilotIds)
    ? pilotIds.map((entry) => normalizeString(entry)).filter(Boolean)
    : [];
  if (normalizedPilotIds.length) {
    const pilots = await Promise.all(
      normalizedPilotIds.map(async (pilotId) => {
        const pilot = await loadPilotDocument(db, pilotId);
        return pilot ? { id: pilot.id, ...(pilot || {}) } : null;
      })
    );
    return pilots.filter(Boolean);
  }

  try {
    const snapshot = await db.collection(PILOTS_COLLECTION).limit(Math.max(1, Number(maxPilots) || 50)).get();
    const cutoffMs = Date.now() - ((Math.max(1, Number(lookbackDays) || ROLLUP_REPAIR_LOOKBACK_DAYS) + 7) * 24 * 60 * 60 * 1000);

    return snapshot.docs
      .map((docSnap) => ({ id: docSnap.id, ...(docSnap.data() || {}) }))
      .filter((pilot) => {
        const status = normalizeString(pilot.status);
        if (status === 'active' || status === 'paused') {
          return true;
        }

        const endAtMs = coerceMillis(pilot.endAt) || coerceMillis(pilot.updatedAt) || coerceMillis(pilot.startAt) || 0;
        return status === 'completed' && endAtMs >= cutoffMs;
      })
      .sort((left, right) => {
        const leftUpdatedAt = coerceMillis(left.updatedAt) || coerceMillis(left.endAt) || coerceMillis(left.startAt) || 0;
        const rightUpdatedAt = coerceMillis(right.updatedAt) || coerceMillis(right.endAt) || coerceMillis(right.startAt) || 0;
        return rightUpdatedAt - leftUpdatedAt;
      });
  } catch (error) {
    return [];
  }
}

async function repairRecentPilotMetricRollups({
  db,
  pilotIds = null,
  lookbackDays = ROLLUP_REPAIR_LOOKBACK_DAYS,
  maxPilots = 50,
}) {
  const startedAtMs = Date.now();
  const pilots = await loadRepairCandidatePilots({
    db,
    pilotIds,
    lookbackDays,
    maxPilots,
  });
  const explicitDateKeys = buildRepairDateKeys(lookbackDays);
  const repairedPilots = [];

  for (const pilot of pilots) {
    const pilotId = normalizeString(pilot?.id || pilot?.pilotId);
    if (!pilotId) continue;

    try {
      const rollups = await recomputePilotMetricRollups({
        db,
        pilotId,
        explicitDateKeys,
      });

      repairedPilots.push({
        pilotId,
        repairedDailyDateKeys: explicitDateKeys,
        rollups,
      });
    } catch (error) {
      await recordPilotMetricAlert({
        db,
        pilotId,
        scope: 'rollup_repair',
        severity: 'error',
        message: error?.message || 'Pilot rollup repair failed.',
        context: {
          lookbackDays,
          explicitDateKeys,
        },
      });
    }
  }

  return {
    repairedPilotCount: repairedPilots.length,
    repairedDailyDateKeys: explicitDateKeys,
    repairedPilots,
    durationMs: Date.now() - startedAtMs,
  };
}

function findMostRecentSurveyResponse(responses = [], surveyKind) {
  return [...responses]
    .filter((entry) => normalizeString(entry.surveyKind) === surveyKind)
    .sort((left, right) => (coerceMillis(right.submittedAt) || right.submittedAtMs || 0) - (coerceMillis(left.submittedAt) || left.submittedAtMs || 0))[0] || null;
}

function buildCompletedSessionEventKey(entry = {}) {
  const assignmentId = normalizeString(entry.metricPayload?.assignmentId)
    || normalizeString(entry.assignmentId)
    || normalizeString(entry.sourceAssignmentId);
  if (assignmentId) {
    return `assignment:${assignmentId}`;
  }

  const sourceCollection = normalizeString(entry.sourceCollection) || 'pilot_metric_event';
  const sourceDocumentId = normalizeString(entry.sourceDocumentId) || normalizeString(entry.id) || 'unknown';
  const sourceDate = normalizeString(entry.sourceDate) || 'undated';
  return `${sourceCollection}:${sourceDocumentId}:${sourceDate}`;
}

async function getAthletePilotSurveyPromptState({
  db,
  athleteId,
  preferredPilotEnrollmentId = null,
  preferredPilotId = null,
}) {
  const context = await resolvePilotEnrollmentContext({
    db,
    athleteId,
    preferredPilotEnrollmentId,
    preferredPilotId,
    allowMembershipFallback: false,
  });

  if (!context?.pilotId || !context?.pilotEnrollmentId) {
    return {
      athleteId: normalizeString(athleteId),
      pilotId: normalizeString(preferredPilotId) || null,
      pilotEnrollmentId: normalizeString(preferredPilotEnrollmentId) || null,
      pendingPrompts: [],
      suppressionReason: 'missing_pilot_context',
    };
  }

  const [pilot, responses, events, escalations, snapshots, operationalRestriction] = await Promise.all([
    loadPilotDocument(db, context.pilotId),
    loadPilotSurveyResponses(db, context.pilotId),
    loadPilotMetricEvents(db, context.pilotId),
    loadPilotEscalations(db, [context.athleteId]),
    loadSnapshotSetForEnrollment(db, { id: context.pilotEnrollmentId }),
    loadPilotOperationalState(db, context.pilotEnrollmentId, {
      pilotEnrollment: context.pilotEnrollment,
      teamMembership: context.teamMembership,
    }),
  ]);

  const teamMembership = context.teamMembership || null;
  const pilotEnrollment = context.pilotEnrollment || null;
  const enrollmentComplete = isEnrollmentComplete({ teamMembership, pilotEnrollment });
  const activeEscalation = escalations.some((entry) => (
    normalizeEscalationStatus(entry) === 'active'
    && entry.excludedFromHeadlineMetrics !== true
    && countsTowardCareEscalationHeadline(entry)
  ));
  const surveySuppressedByOperationalRestriction = isSurveyPromptSuppressedByOperationalRestriction(operationalRestriction);
  const operationalRestrictionSummary = operationalRestriction || null;
  const athleteResponses = responses.filter((entry) => normalizeString(entry.respondentUserId) === normalizeString(context.athleteId));
  const nowMs = Date.now();
  const pilotStartMs = coerceMillis(pilot?.startAt);
  const pilotEndMs = coerceMillis(pilot?.endAt);
  const effectiveSurveyWindowStartMs =
    pilotStartMs
    || coerceMillis(pilotEnrollment?.outcomeBackfillStartAt)
    || coerceMillis(pilotEnrollment?.createdAt)
    || nowMs;
  const effectiveSurveyWindowEndMs =
    pilotEndMs && pilotEndMs < nowMs ? pilotEndMs : nowMs;
  const historicalAssignments = await loadAthleteHistoricalAssignments({
    db,
    athleteId: context.athleteId,
    startDateKey: toUtcDateKey(effectiveSurveyWindowStartMs),
    endDateKey: toUtcDateKey(effectiveSurveyWindowEndMs),
  });
  const completedSessionKeys = new Set(
    events
      .filter((entry) => (
        normalizeString(entry.athleteId) === normalizeString(context.athleteId)
        && entry.eventType === 'daily_assignment_completed'
      ))
      .map((entry) => buildCompletedSessionEventKey(entry)),
  );
  historicalAssignments
    .filter((assignment) => normalizeString(assignment.status) === 'completed')
    .forEach((assignment) => {
      const assignmentId = normalizeString(assignment.id);
      if (assignmentId) {
        completedSessionKeys.add(`assignment:${assignmentId}`);
        return;
      }

      const sourceDate = normalizeString(assignment.sourceDate) || 'undated';
      const actionType = normalizeString(assignment.actionType) || 'assignment';
      completedSessionKeys.add(`historical_assignment:${sourceDate}:${actionType}`);
    });
  const completedSessions = completedSessionKeys.size;
  const trustResponses = athleteResponses.filter((entry) => normalizeString(entry.surveyKind) === 'trust');
  const npsResponses = athleteResponses.filter((entry) => normalizeString(entry.surveyKind) === 'nps');
  const lastTrustResponse = findMostRecentSurveyResponse(trustResponses, 'trust');
  const lastNpsResponse = findMostRecentSurveyResponse(npsResponses, 'nps');
  const trustCoolingDown = Boolean(lastTrustResponse) && ((Date.now() - (coerceMillis(lastTrustResponse.submittedAt) || lastTrustResponse.submittedAtMs || 0)) < (SURVEY_PROMPT_COOLDOWN_DAYS * 24 * 60 * 60 * 1000));
  const npsCoolingDown = Boolean(lastNpsResponse) && ((Date.now() - (coerceMillis(lastNpsResponse.submittedAt) || lastNpsResponse.submittedAtMs || 0)) < (SURVEY_PROMPT_COOLDOWN_DAYS * 24 * 60 * 60 * 1000));

  if (!enrollmentComplete) {
    return {
      athleteId: context.athleteId,
      pilotId: context.pilotId,
      pilotEnrollmentId: context.pilotEnrollmentId,
      pendingPrompts: [],
      suppressionReason: 'enrollment_incomplete',
      completedSessions,
      activeEscalation,
      operationalRestriction: operationalRestrictionSummary,
    };
  }

  if (surveySuppressedByOperationalRestriction) {
    return {
      athleteId: context.athleteId,
      pilotId: context.pilotId,
      pilotEnrollmentId: context.pilotEnrollmentId,
      pendingPrompts: [],
      suppressionReason: 'operational_restriction',
      completedSessions,
      activeEscalation,
      operationalRestriction: operationalRestrictionSummary,
    };
  }

  const progressRatio =
    pilotStartMs && pilotEndMs && pilotEndMs > pilotStartMs
      ? Math.max(0, Math.min(1, (nowMs - pilotStartMs) / (pilotEndMs - pilotStartMs)))
      : null;
  const endpointFrozen = Boolean(snapshots.endpoint?.endpointFreeze?.frozen);
  const endpointEligible = endpointFrozen || Boolean(pilotEndMs && nowMs >= pilotEndMs);
  const midpointEligible = progressRatio !== null && progressRatio >= 0.5 && !endpointEligible;

  const pendingPrompts = [];
  if (completedSessions >= 3 && !lastTrustResponse && !trustCoolingDown) {
    pendingPrompts.push({
      surveyKind: 'trust',
      promptReason: 'completed_session_threshold',
      promptStage: 'initial',
    });
  }
  if (midpointEligible && !trustCoolingDown) {
    pendingPrompts.push({
      surveyKind: 'trust',
      promptReason: 'pilot_midpoint',
      promptStage: 'midpoint',
    });
  }
  if (midpointEligible && !npsCoolingDown) {
    pendingPrompts.push({
      surveyKind: 'nps',
      promptReason: 'pilot_midpoint',
      promptStage: 'midpoint',
    });
  }
  if (endpointEligible && !trustCoolingDown) {
    pendingPrompts.push({
      surveyKind: 'trust',
      promptReason: 'pilot_endpoint',
      promptStage: 'endpoint',
    });
  }
  if (endpointEligible && !npsCoolingDown) {
    pendingPrompts.push({
      surveyKind: 'nps',
      promptReason: 'pilot_endpoint',
      promptStage: 'endpoint',
    });
  }

  return {
    athleteId: context.athleteId,
    pilotId: context.pilotId,
    pilotEnrollmentId: context.pilotEnrollmentId,
    pendingPrompts,
    suppressionReason: null,
    completedSessions,
    activeEscalation,
    operationalRestriction: operationalRestrictionSummary,
    progressRatio,
    endpointEligible,
    midpointEligible,
    promptCooldownDays: SURVEY_PROMPT_COOLDOWN_DAYS,
  };
}

module.exports = {
  OUTCOME_ROLLUP_RECOMPUTE_MODE,
  OUTCOME_V1_CARD_ORDER,
  OUTCOME_BACKFILL_LOOKBACK_DAYS,
  FRESHNESS_WINDOW_DAYS,
  SURVEY_MINIMUM_RESPONSE_THRESHOLD,
  SURVEY_PROMPT_COOLDOWN_DAYS,
  ROLLUP_REPAIR_LOOKBACK_DAYS,
  PILOT_METRIC_EVENTS_COLLECTION,
  PILOT_METRIC_ROLLUPS_COLLECTION,
  PILOT_METRIC_ROLLUP_SUMMARY_SUBCOLLECTION,
  PILOT_METRIC_ROLLUP_DAILY_SUBCOLLECTION,
  PILOT_SURVEY_RESPONSES_COLLECTION,
  PILOT_MENTAL_PERFORMANCE_SNAPSHOTS_SUBCOLLECTION,
  PILOT_OPERATIONAL_STATES_COLLECTION,
  PILOT_OPERATIONAL_STATE_ACTIONS_SUBCOLLECTION,
  SURVEY_RECLASSIFICATION_MIGRATION_KEY,
  ESCALATION_RECLASSIFICATION_MIGRATION_KEY,
  TRUST_BATTERY_ITEM_KEYS,
  TRUST_BATTERY_VERSION,
  buildTrustBatteryPayload,
  buildPilotSurveyReclassificationReport,
  buildPilotEscalationReclassificationReport,
  buildOutcomeHypothesisEvaluation,
  buildCoachWorkflowContinuityReport,
  computeEscalationSummary,
  computePilotOutcomeRollup,
  emitPilotMetricEvent,
  evaluateCoachWorkflowContinuity,
  buildDefaultOperationalStateFromEnrollment,
  buildOperationalStateSummary,
  getAthletePilotSurveyPromptState,
  hasLossOfFunctionConcern,
  isEnrollmentComplete,
  hasCompletedEnrollmentConsents,
  isTrueCareEscalationClassification,
  isSurveyPromptSuppressedByOperationalRestriction,
  isAdherenceExcludedByOperationalRestriction,
  buildRepairDateKeys,
  backfillPilotAthleteOutcomeHistory,
  recomputePilotMetricRollups,
  repairRecentPilotMetricRollups,
  recordPilotMetricAlert,
  loadPilotOperationalState,
  loadPilotOperationalStates,
  resolvePilotEnrollmentContext,
  applyPilotSurveyReclassification,
  applyPilotEscalationReclassification,
  requestPilotWatchList,
  applyPilotWatchList,
  clearPilotWatchList,
  writePilotOperationalStateChange,
  savePilotSurveyResponse,
  upsertPilotMentalPerformanceSnapshot,
  deriveBaselineProbeProfile,
  normalizeTrustDispositionBaseline,
  writePilotMetricOpsStatus,
};
