const crypto = require('crypto');
const { initializeFirebaseAdmin } = require('./config/firebase');
const profileSnapshotRuntime = require('../../src/api/firebase/mentaltraining/profileSnapshotRuntime.js');

const COLLECTION = 'vision-pro-trial-sessions';
const USERS_COLLECTION = 'users';
const EXERCISES_COLLECTION = 'sim-modules';
const LEGACY_ASSIGNMENTS_COLLECTION = 'sim-assignments';
const CURRICULUM_ASSIGNMENTS_COLLECTION = 'mental-curriculum-assignments';
const CURRICULUM_DAILY_COMPLETIONS_SUBCOLLECTION = 'daily-completions';
const SIM_SESSIONS_COLLECTION = 'sim-sessions';
const EVENT_LOGS_SUBCOLLECTION = 'event-logs';
const ATHLETE_PROGRESS_COLLECTION = 'athlete-mental-progress';
const MENTAL_CHECKINS_COLLECTION = 'mental-check-ins';
const PROFILE_SNAPSHOTS_SUBCOLLECTION = 'profile-snapshots';
const SIM_SESSIONS_SUBCOLLECTION = 'sessions';
const TEAM_MEMBERSHIPS_COLLECTION = 'pulsecheck-team-memberships';
const PILOTS_COLLECTION = 'pulsecheck-pilots';
const PILOT_COHORTS_COLLECTION = 'pulsecheck-pilot-cohorts';
const ESCALATION_RECORDS_COLLECTION = 'escalation-records';
const PROFILE_VERSION = profileSnapshotRuntime.PROFILE_VERSION;

const TOKEN_TTL_MS = 2 * 60 * 1000;
const CLAIM_TIMEOUT_MS = 10 * 60 * 1000;
const BASELINE_RECENCY_WINDOW_DAYS = 14;
const BASELINE_RECENCY_WINDOW_MS = BASELINE_RECENCY_WINDOW_DAYS * 24 * 60 * 60 * 1000;
const EVENT_LOG_SCHEMA_VERSION = 'vision-pro-football-event-script-v1';
const REQUIRED_EVENT_TYPES = [
  'trial_started',
  'block_started',
  'task_started',
  'disruption_started',
  'disruption_ended',
  'reset_signal',
  'cue_presented',
  'decoy_presented',
  'athlete_response',
  'response_validated',
  'block_ended',
  'trial_ended',
  'pause',
  'resume',
  'trial_aborted',
];
const DEFAULT_VISION_PRO_FAMILIES = ['reset', 'signal-window'];
const FAMILY_CONFIG = {
  reset: {
    family: 'reset',
    label: 'Reset',
    trialName: 'Next Play',
    surfaces: ['phone_web', 'immersive'],
    simIds: ['reset'],
    metricNames: ['Recovery Time', 'recovery_time'],
    lowerIsBetter: true,
    smallGapThreshold: 0.35,
    moderateGapThreshold: 0.75,
  },
  'signal-window': {
    family: 'signal-window',
    label: 'Signal Window',
    trialName: 'Spatial Read',
    surfaces: ['phone_web', 'immersive'],
    simIds: ['signal_window', 'signal-window', 'signalwindow'],
    metricNames: ['Correct Read Under Time Pressure', 'correct_read_under_time_pressure'],
    lowerIsBetter: false,
    smallGapThreshold: 0.08,
    moderateGapThreshold: 0.18,
  },
};

const baseHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

function json(statusCode, body, extraHeaders = {}) {
  return {
    statusCode,
    headers: {
      ...baseHeaders,
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  };
}

function parseBody(event) {
  if (!event.body) return {};
  try {
    return JSON.parse(event.body);
  } catch (_error) {
    throw new Error('Invalid JSON body');
  }
}

function normalizeCollectionName(value) {
  if (value === CURRICULUM_ASSIGNMENTS_COLLECTION || value === LEGACY_ASSIGNMENTS_COLLECTION) {
    return value;
  }
  throw new Error('Unsupported assignmentCollection');
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function createLaunchToken() {
  const token = crypto.randomBytes(24).toString('base64url');
  const pairingCode = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
  return {
    rawToken: token,
    tokenHash: sha256(token),
    pairingCode,
    pairingCodeHash: sha256(pairingCode),
    expiresAt: Date.now() + TOKEN_TTL_MS,
  };
}

function createDeviceSessionToken() {
  const token = crypto.randomBytes(24).toString('base64url');
  return {
    rawToken: token,
    tokenHash: sha256(token),
  };
}

function getDateString(timestamp = Date.now()) {
  return new Date(timestamp).toISOString().split('T')[0];
}

function getCurrentDayNumber(startDate, currentDate = Date.now()) {
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  const current = new Date(currentDate);
  current.setHours(0, 0, 0, 0);
  const diffTime = current.getTime() - start.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(1, diffDays + 1);
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function stringOrNull(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function numberOrNull(value) {
  return Number.isFinite(value) ? value : null;
}

function toMillis(value) {
  if (Number.isFinite(value)) return value;
  if (value instanceof Date) return value.getTime();
  if (value && typeof value.toDate === 'function') {
    const converted = value.toDate();
    return converted instanceof Date ? converted.getTime() : null;
  }
  return null;
}

function booleanOrNull(value) {
  return typeof value === 'boolean' ? value : null;
}

function arrayOfStrings(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
    .filter(Boolean);
}

function numberMapOrEmpty(value) {
  if (!isPlainObject(value)) {
    return {};
  }

  return Object.entries(value).reduce((acc, [key, entryValue]) => {
    if (Number.isFinite(entryValue)) {
      acc[key] = entryValue;
    }
    return acc;
  }, {});
}

function normalizeVersionMetadata(value) {
  const input = isPlainObject(value) ? value : {};
  return {
    environmentVersion: stringOrNull(input.environmentVersion),
    trialPackageVersion: stringOrNull(input.trialPackageVersion),
    resetTrialVersion: stringOrNull(input.resetTrialVersion),
    noiseGateTrialVersion: stringOrNull(input.noiseGateTrialVersion),
    signalWindowTrialVersion: stringOrNull(input.signalWindowTrialVersion),
    eventScriptVersion: stringOrNull(input.eventScriptVersion),
    metricMappingVersion: stringOrNull(input.metricMappingVersion),
    seedOrScriptId: stringOrNull(input.seedOrScriptId),
  };
}

function normalizeFamilyKey(value) {
  const raw = stringOrNull(value);
  if (!raw) return null;

  const normalized = raw.trim().toLowerCase().replace(/[_\s]+/g, '-');
  if (normalized === 'signalwindow') {
    return 'signal-window';
  }
  return normalized;
}

function getFamilyConfig(value) {
  const familyKey = normalizeFamilyKey(value);
  return familyKey ? FAMILY_CONFIG[familyKey] || null : null;
}

function normalizeCalibrationSummary(value) {
  const input = isPlainObject(value) ? value : {};
  return {
    status: ['pass', 'pass_with_warning', 'fail'].includes(input.status) ? input.status : null,
    reasonCode: stringOrNull(input.reasonCode),
    warnings: arrayOfStrings(input.warnings),
    checkedAt: numberOrNull(input.checkedAt),
    headsetTrackingStable: booleanOrNull(input.headsetTrackingStable),
    responseTimingUsable: booleanOrNull(input.responseTimingUsable),
    audioRouteStable: booleanOrNull(input.audioRouteStable),
    comfortCleared: booleanOrNull(input.comfortCleared),
  };
}

function normalizeBaselineReferences(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(isPlainObject)
    .map((entry) => ({
      family: stringOrNull(entry.family),
      surface: stringOrNull(entry.surface),
      referenceId: stringOrNull(entry.referenceId),
      simSessionId: stringOrNull(entry.simSessionId),
      assignmentId: stringOrNull(entry.assignmentId),
      capturedAt: numberOrNull(entry.capturedAt),
      isRequired: booleanOrNull(entry.isRequired),
      isImmersiveBaseline: booleanOrNull(entry.isImmersiveBaseline),
      withinRecencyWindow: booleanOrNull(entry.withinRecencyWindow),
    }));
}

function normalizeFamilyMetricSummary(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(isPlainObject)
    .map((entry) => ({
      family: stringOrNull(entry.family),
      trialName: stringOrNull(entry.trialName),
      trialVersion: stringOrNull(entry.trialVersion),
      coreMetricName: stringOrNull(entry.coreMetricName),
      coreMetricValue: numberOrNull(entry.coreMetricValue),
      normalizedScore: numberOrNull(entry.normalizedScore),
      supportingMetrics: numberMapOrEmpty(entry.supportingMetrics),
      conditionBreakdown: numberMapOrEmpty(entry.conditionBreakdown),
      validityFlags: arrayOfStrings(entry.validityFlags),
      durationSeconds: numberOrNull(entry.durationSeconds),
      completedBlockCount: numberOrNull(entry.completedBlockCount),
      totalBlockCount: numberOrNull(entry.totalBlockCount),
    }));
}

function normalizeValiditySummary(value) {
  const input = isPlainObject(value) ? value : {};
  return {
    status: ['valid', 'partial', 'invalid', 'aborted'].includes(input.status) ? input.status : null,
    flags: arrayOfStrings(input.flags),
    pauseCount: numberOrNull(input.pauseCount),
    abortClassification: stringOrNull(input.abortClassification),
    failureReasonCode: stringOrNull(input.failureReasonCode),
    calibrationPassed: booleanOrNull(input.calibrationPassed),
    eventLogComplete: booleanOrNull(input.eventLogComplete),
    baselineLinkageComplete: booleanOrNull(input.baselineLinkageComplete),
    environmentStable: booleanOrNull(input.environmentStable),
    comfortStable: booleanOrNull(input.comfortStable),
  };
}

function normalizeTransferGapSummary(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(isPlainObject)
    .map((entry) => ({
      family: stringOrNull(entry.family),
      trialName: stringOrNull(entry.trialName),
      comparisonSurface: stringOrNull(entry.comparisonSurface),
      baselineReferenceId: stringOrNull(entry.baselineReferenceId),
      metricName: stringOrNull(entry.metricName),
      currentValue: numberOrNull(entry.currentValue),
      baselineValue: numberOrNull(entry.baselineValue),
      transferGap: numberOrNull(entry.transferGap),
      interpretation: stringOrNull(entry.interpretation),
      isImmersiveComparison: booleanOrNull(entry.isImmersiveComparison),
    }));
}

function normalizeReportSummary(value) {
  const input = isPlainObject(value) ? value : {};
  const familyCards = Array.isArray(input.familyCards)
    ? input.familyCards
        .filter(isPlainObject)
        .map((entry) => ({
          family: stringOrNull(entry.family),
          label: stringOrNull(entry.label),
          trialName: stringOrNull(entry.trialName),
          metricName: stringOrNull(entry.metricName),
          comparisonSurface: stringOrNull(entry.comparisonSurface),
          currentValue: numberOrNull(entry.currentValue),
          baselineValue: numberOrNull(entry.baselineValue),
          transferGap: numberOrNull(entry.transferGap),
          interpretation: stringOrNull(entry.interpretation),
        }))
    : [];

  return {
    athleteHeadline: stringOrNull(input.athleteHeadline),
    athleteBody: stringOrNull(input.athleteBody),
    coachHeadline: stringOrNull(input.coachHeadline),
    coachBody: stringOrNull(input.coachBody),
    transferReadiness: stringOrNull(input.transferReadiness),
    immersiveBaselineMode: stringOrNull(input.immersiveBaselineMode),
    familyCards,
  };
}

function normalizeEventLogReference(value) {
  const input = isPlainObject(value) ? value : {};
  return {
    rawEventLogUri: stringOrNull(input.rawEventLogUri),
    schemaVersion: stringOrNull(input.schemaVersion) || EVENT_LOG_SCHEMA_VERSION,
    eventCount: numberOrNull(input.eventCount),
    capturedAt: numberOrNull(input.capturedAt),
    requiredEventTypes: arrayOfStrings(input.requiredEventTypes).length
      ? arrayOfStrings(input.requiredEventTypes)
      : [...REQUIRED_EVENT_TYPES],
  };
}

function normalizeRuntimeEvents(value, fallbackSession = {}) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(isPlainObject)
    .map((entry, index) => ({
      eventId: stringOrNull(entry.eventId) || `event_${index + 1}`,
      eventType: stringOrNull(entry.eventType),
      timestamp: numberOrNull(entry.timestamp),
      sessionId: stringOrNull(entry.sessionId) || stringOrNull(fallbackSession.id),
      athleteId: stringOrNull(entry.athleteId) || stringOrNull(fallbackSession.athleteUserId),
      environmentVersion: stringOrNull(entry.environmentVersion),
      trialVersion: stringOrNull(entry.trialVersion),
      trialFamily: stringOrNull(entry.trialFamily),
      trialName: stringOrNull(entry.trialName),
      blockId: stringOrNull(entry.blockId),
      sequenceId: numberOrNull(entry.sequenceId),
      conditionTags: arrayOfStrings(entry.conditionTags),
      spatialOrigin: stringOrNull(entry.spatialOrigin),
      intensity: numberOrNull(entry.intensity),
      durationMs: numberOrNull(entry.durationMs),
      seedOrScriptId: stringOrNull(entry.seedOrScriptId),
      validityFlags: arrayOfStrings(entry.validityFlags),
      payload: isPlainObject(entry.payload) ? entry.payload : {},
    }))
    .filter((entry) => entry.eventType && entry.timestamp);
}

function inferTrackedFamilies({ simId, baselineReferences, familyMetricSummary }) {
  const fromMetrics = Array.isArray(familyMetricSummary)
    ? familyMetricSummary
        .map((entry) => normalizeFamilyKey(entry?.family))
        .filter(Boolean)
    : [];

  const fromReferences = Array.isArray(baselineReferences)
    ? baselineReferences
        .map((entry) => normalizeFamilyKey(entry?.family))
        .filter(Boolean)
    : [];

  const fromSimId =
    simId === 'vision_pro_football_package'
      ? [...DEFAULT_VISION_PRO_FAMILIES]
      : normalizeFamilyKey(simId)
        ? [normalizeFamilyKey(simId)]
        : [];

  return [...new Set([...fromMetrics, ...fromReferences, ...fromSimId])]
    .map((family) => getFamilyConfig(family))
    .filter(Boolean);
}

function derivePilotStatus(pilot) {
  if (!isPlainObject(pilot)) {
    return 'draft';
  }

  const now = Date.now();
  const startAt = toMillis(pilot.startAt);
  const endAt = toMillis(pilot.endAt);

  if (!startAt) return 'draft';
  if (Number.isFinite(endAt) && endAt < now) return 'completed';
  if (startAt <= now) return 'active';
  return 'draft';
}

function normalizeEscalationTier(value) {
  if (Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
  }

  return null;
}

async function loadAthleteIdentity(db, athleteUserId) {
  const athleteSnap = await db.collection(USERS_COLLECTION).doc(athleteUserId).get();
  const athlete = athleteSnap.exists ? athleteSnap.data() || {} : {};

  return {
    athleteDisplayName:
      stringOrNull(athlete.displayName) ||
      stringOrNull(athlete.username) ||
      stringOrNull(athlete.firstName) ||
      'Athlete',
    athleteEmail: stringOrNull(athlete.email),
  };
}

async function resolveVisionProProtocolContext(db, athleteUserId) {
  const [membershipSnap, escalationSnap] = await Promise.all([
    db.collection(TEAM_MEMBERSHIPS_COLLECTION).where('userId', '==', athleteUserId).limit(12).get(),
    db.collection(ESCALATION_RECORDS_COLLECTION).where('userId', '==', athleteUserId).limit(12).get(),
  ]);

  const memberships = membershipSnap.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }))
    .filter((entry) => entry.role === 'athlete')
    .sort((left, right) => {
      const leftPriority = left?.athleteOnboarding?.targetPilotId || left?.athleteOnboarding?.targetCohortId ? 1 : 0;
      const rightPriority = right?.athleteOnboarding?.targetPilotId || right?.athleteOnboarding?.targetCohortId ? 1 : 0;
      if (leftPriority !== rightPriority) return rightPriority - leftPriority;
      return (toMillis(right.updatedAt) || toMillis(right.createdAt) || 0) - (toMillis(left.updatedAt) || toMillis(left.createdAt) || 0);
    });

  const membership = memberships[0] || null;
  const onboarding = isPlainObject(membership?.athleteOnboarding) ? membership.athleteOnboarding : {};
  const pilotId = stringOrNull(onboarding.targetPilotId);
  const cohortId = stringOrNull(onboarding.targetCohortId);

  const [pilotSnap, cohortSnap] = await Promise.all([
    pilotId ? db.collection(PILOTS_COLLECTION).doc(pilotId).get() : Promise.resolve(null),
    cohortId ? db.collection(PILOT_COHORTS_COLLECTION).doc(cohortId).get() : Promise.resolve(null),
  ]);

  const pilot = pilotSnap?.exists ? { id: pilotSnap.id, ...pilotSnap.data() } : null;
  const cohort = cohortSnap?.exists ? { id: cohortSnap.id, ...cohortSnap.data() } : null;

  const activeEscalation = escalationSnap.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }))
    .filter((entry) => entry.status === 'active')
    .map((entry) => ({
      id: entry.id,
      tier: normalizeEscalationTier(entry.tier),
      createdAt: toMillis(entry.createdAt),
    }))
    .filter((entry) => Number.isFinite(entry.tier))
    .sort((left, right) => (right.tier - left.tier) || ((right.createdAt || 0) - (left.createdAt || 0)))[0] || null;

  return {
    membership,
    onboarding,
    enrollmentMode: stringOrNull(onboarding.enrollmentMode) || 'product-only',
    pilot,
    cohort,
    pilotStatus: pilot ? derivePilotStatus(pilot) : null,
    activeEscalation,
  };
}

function buildVisionProProtocolIssues({
  trackedFamilies = [],
  baselineReferences = [],
  protocolContext,
  comfortCleared = null,
  calibrationStatus = null,
  requireComfortScreen = false,
}) {
  const issues = [];
  const requiredFamilies = trackedFamilies.map((entry) => entry?.family).filter(Boolean);

  if (!protocolContext?.membership) {
    issues.push('This athlete is not currently enrolled in a PulseCheck team.');
  }

  if (protocolContext?.onboarding?.productConsentAccepted !== true) {
    issues.push('Product consent must be complete before a Vision Pro session can be queued.');
  }

  if (protocolContext?.onboarding?.baselinePathStatus !== 'complete') {
    issues.push('The required in-app baseline must be complete before Vision Pro can begin.');
  }

  if (
    protocolContext?.enrollmentMode === 'research' &&
    protocolContext?.onboarding?.researchConsentStatus !== 'accepted'
  ) {
    issues.push('Research-mode Vision Pro sessions require research consent before they can proceed.');
  }

  if (protocolContext?.activeEscalation?.tier >= 2) {
    issues.push(`This athlete has an active Tier ${protocolContext.activeEscalation.tier} escalation hold and cannot start a Vision Pro session.`);
  }

  if (protocolContext?.enrollmentMode !== 'product-only') {
    if (!protocolContext?.pilot) {
      issues.push('This athlete is marked for pilot enrollment, but no pilot is attached to the membership record.');
    } else if (protocolContext.pilotStatus !== 'active') {
      issues.push(`The linked pilot is currently ${protocolContext.pilotStatus}. Vision Pro sessions only run during an active pilot window.`);
    }
  }

  if (protocolContext?.onboarding?.targetCohortId && !protocolContext?.cohort) {
    issues.push('This athlete is marked for cohort enrollment, but the cohort record could not be found.');
  }

  if (protocolContext?.cohort?.status === 'archived') {
    issues.push('The linked cohort is archived and cannot be used for Vision Pro pilot sessions.');
  }

  const baselineByFamily = new Map(
    baselineReferences
      .filter(isPlainObject)
      .map((entry) => [normalizeFamilyKey(entry.family), entry])
      .filter(([family]) => Boolean(family))
  );

  requiredFamilies.forEach((family) => {
    const reference = baselineByFamily.get(family);
    const config = getFamilyConfig(family);
    if (!reference) {
      issues.push(`A recent ${config?.label || family} baseline is required before this Vision Pro package can be queued.`);
      return;
    }
    if (reference.withinRecencyWindow !== true) {
      issues.push(`The ${config?.label || family} baseline is older than ${BASELINE_RECENCY_WINDOW_DAYS} days and must be refreshed before Vision Pro can proceed.`);
    }
  });

  if (requireComfortScreen && comfortCleared !== true) {
    issues.push('The operator comfort check must be completed before the Vision Pro session can start.');
  }

  if (calibrationStatus === 'fail') {
    issues.push('Calibration failed, so measured Vision Pro trials cannot begin.');
  }

  return issues;
}

async function loadRecentAthleteSimSessions(db, athleteUserId, limit = 50) {
  const snap = await db
    .collection(SIM_SESSIONS_COLLECTION)
    .doc(athleteUserId)
    .collection(SIM_SESSIONS_SUBCOLLECTION)
    .orderBy('createdAt', 'desc')
    .limit(limit)
    .get();

  return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

async function loadPriorImmersiveBaselineSession(db, athleteUserId, currentSessionId = null) {
  const snap = await db
    .collection(COLLECTION)
    .where('athleteUserId', '==', athleteUserId)
    .limit(25)
    .get();

  const sessions = snap.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }))
    .filter((entry) => entry.id !== currentSessionId)
    .filter((entry) => entry.status === 'completed')
    .filter((entry) => entry.isImmersiveBaseline === true)
    .filter((entry) => entry.sessionOutcome === 'valid' || entry.validitySummary?.status === 'valid')
    .sort((left, right) => (right.completedAt || right.createdAt || 0) - (left.completedAt || left.createdAt || 0));

  return sessions[0] || null;
}

function extractFamilyMetricEntry(source, familyConfig) {
  if (!familyConfig || !Array.isArray(source?.familyMetricSummary)) {
    return null;
  }

  return (
    source.familyMetricSummary.find(
      (entry) => normalizeFamilyKey(entry?.family) === familyConfig.family
    ) || null
  );
}

function extractMetricValueForFamily(source, familyConfig) {
  const familyEntry = extractFamilyMetricEntry(source, familyConfig);
  if (Number.isFinite(familyEntry?.coreMetricValue)) {
    return familyEntry.coreMetricValue;
  }

  const metricName = stringOrNull(source?.coreMetricName);
  const simId = normalizeFamilyKey(source?.simId);
  if (
    metricName &&
    familyConfig.metricNames.includes(metricName)
  ) {
    return numberOrNull(source?.coreMetricValue);
  }

  if (simId && familyConfig.simIds.includes(simId)) {
    return numberOrNull(source?.coreMetricValue);
  }

  return null;
}

function buildSimSessionReference(simSession, familyConfig) {
  const metricValue = extractMetricValueForFamily(simSession, familyConfig);
  if (!Number.isFinite(metricValue)) {
    return null;
  }

  return {
    family: familyConfig.family,
    surface: 'phone_web',
    referenceId: simSession.id,
    simSessionId: simSession.id,
    assignmentId: stringOrNull(simSession.assignmentId),
    capturedAt: numberOrNull(simSession.createdAt),
    isRequired: true,
    isImmersiveBaseline: false,
    withinRecencyWindow:
      Number.isFinite(simSession.createdAt)
        ? Date.now() - simSession.createdAt <= BASELINE_RECENCY_WINDOW_MS
        : null,
    metricValue,
  };
}

function buildImmersiveBaselineReference(session, familyConfig) {
  const metricEntry = extractFamilyMetricEntry(session, familyConfig);
  if (!Number.isFinite(metricEntry?.coreMetricValue)) {
    return null;
  }

  const capturedAt = numberOrNull(session.completedAt || session.createdAt);
  return {
    family: familyConfig.family,
    surface: 'immersive',
    referenceId: session.id,
    simSessionId: stringOrNull(session?.resultSummary?.simSessionId),
    assignmentId: stringOrNull(session.assignmentId),
    capturedAt,
    isRequired: false,
    isImmersiveBaseline: true,
    withinRecencyWindow:
      Number.isFinite(capturedAt) ? Date.now() - capturedAt <= BASELINE_RECENCY_WINDOW_MS : null,
    metricValue: metricEntry.coreMetricValue,
  };
}

function mergeBaselineReferences(existingReferences, resolvedReferences) {
  const merged = new Map();

  existingReferences.forEach((entry) => {
    const key = `${normalizeFamilyKey(entry.family) || 'unknown'}:${entry.surface || 'unknown'}`;
    merged.set(key, { ...entry });
  });

  resolvedReferences.forEach((entry) => {
    const key = `${normalizeFamilyKey(entry.family) || 'unknown'}:${entry.surface || 'unknown'}`;
    const previous = merged.get(key) || {};
    merged.set(key, {
      ...previous,
      ...entry,
      referenceId: entry.referenceId || previous.referenceId || null,
      simSessionId: entry.simSessionId || previous.simSessionId || null,
      assignmentId: entry.assignmentId || previous.assignmentId || null,
      capturedAt: entry.capturedAt ?? previous.capturedAt ?? null,
      isRequired: entry.isRequired ?? previous.isRequired ?? null,
      isImmersiveBaseline: entry.isImmersiveBaseline ?? previous.isImmersiveBaseline ?? null,
      withinRecencyWindow: entry.withinRecencyWindow ?? previous.withinRecencyWindow ?? null,
      metricValue: entry.metricValue ?? previous.metricValue ?? null,
    });
  });

  return Array.from(merged.values());
}

async function resolveVisionProBaselineContext(
  db,
  athleteUserId,
  {
    simId,
    baselineReferences = [],
    familyMetricSummary = [],
    currentSessionId = null,
  } = {}
) {
  const trackedFamilies = inferTrackedFamilies({ simId, baselineReferences, familyMetricSummary });
  const [recentSimSessions, priorImmersiveBaselineSession] = await Promise.all([
    loadRecentAthleteSimSessions(db, athleteUserId),
    loadPriorImmersiveBaselineSession(db, athleteUserId, currentSessionId),
  ]);

  const resolvedReferences = [];
  const metricSourceMap = new Map();

  trackedFamilies.forEach((familyConfig) => {
    const latestSimSession = recentSimSessions.find((entry) => buildSimSessionReference(entry, familyConfig));
    const latestSimReference = latestSimSession
      ? buildSimSessionReference(latestSimSession, familyConfig)
      : null;
    if (latestSimReference) {
      resolvedReferences.push(latestSimReference);
      metricSourceMap.set(`${familyConfig.family}:phone_web`, latestSimReference.metricValue);
    }

    const immersiveReference = priorImmersiveBaselineSession
      ? buildImmersiveBaselineReference(priorImmersiveBaselineSession, familyConfig)
      : null;
    if (immersiveReference) {
      resolvedReferences.push(immersiveReference);
      metricSourceMap.set(`${familyConfig.family}:immersive`, immersiveReference.metricValue);
    }
  });

  const mergedReferences = mergeBaselineReferences(
    normalizeBaselineReferences(baselineReferences),
    resolvedReferences
  ).map(({ metricValue, ...entry }) => entry);

  return {
    baselineReferences: mergedReferences,
    baselineMetricSourceMap: metricSourceMap,
    priorImmersiveBaselineSession,
  };
}

function determineTransferGapInterpretation(familyConfig, transferGap) {
  if (!familyConfig || !Number.isFinite(transferGap)) {
    return 'awaiting_baseline';
  }

  const absoluteGap = Math.abs(transferGap);
  if (absoluteGap <= familyConfig.smallGapThreshold) {
    return 'small_gap';
  }
  if (absoluteGap <= familyConfig.moderateGapThreshold) {
    return 'moderate_gap';
  }
  return 'large_gap';
}

function buildTransferGapSummaryFromSources(familyMetricSummary, baselineReferences, baselineMetricSourceMap) {
  return familyMetricSummary.flatMap((metricEntry) => {
    const familyConfig = getFamilyConfig(metricEntry?.family);
    if (!familyConfig || !Number.isFinite(metricEntry?.coreMetricValue)) {
      return [];
    }

    return baselineReferences
      .filter((reference) => normalizeFamilyKey(reference.family) === familyConfig.family)
      .map((reference) => {
        const sourceKey = `${familyConfig.family}:${reference.surface || 'phone_web'}`;
        const baselineValue = baselineMetricSourceMap.get(sourceKey) ?? null;
        const transferGap =
          Number.isFinite(baselineValue) && Number.isFinite(metricEntry.coreMetricValue)
            ? Number((metricEntry.coreMetricValue - baselineValue).toFixed(3))
            : null;

        return {
          family: familyConfig.family,
          trialName: metricEntry.trialName || familyConfig.trialName,
          comparisonSurface: reference.surface,
          baselineReferenceId: reference.referenceId,
          metricName: metricEntry.coreMetricName,
          currentValue: metricEntry.coreMetricValue,
          baselineValue,
          transferGap,
          interpretation: determineTransferGapInterpretation(familyConfig, transferGap),
          isImmersiveComparison: reference.isImmersiveBaseline ?? false,
        };
      });
  });
}

function determineImmersiveBaselineFlag({ requestedFlag, priorImmersiveBaselineSession, sessionOutcome }) {
  if (sessionOutcome !== 'valid') {
    return false;
  }
  if (typeof requestedFlag === 'boolean') {
    return requestedFlag || !priorImmersiveBaselineSession;
  }
  return !priorImmersiveBaselineSession;
}

function buildVisionProReportSummary({
  familyMetricSummary = [],
  transferGapSummary = [],
  isImmersiveBaseline = false,
}) {
  const phoneWebComparisons = transferGapSummary.filter(
    (entry) => entry && entry.isImmersiveComparison !== true && typeof entry.interpretation === 'string'
  );
  const severityRank = { small_gap: 0, moderate_gap: 1, large_gap: 2, awaiting_baseline: 3 };
  const strongestSeverity = phoneWebComparisons.reduce((current, entry) => {
    const next = severityRank[entry.interpretation] ?? 3;
    return Math.max(current, next);
  }, phoneWebComparisons.length ? 0 : 3);

  const transferReadiness =
    strongestSeverity === 0 ? 'strong_transfer'
      : strongestSeverity === 1 ? 'emerging_transfer'
      : strongestSeverity === 2 ? 'needs_transfer_work'
      : 'awaiting_baseline';

  const familyCards = familyMetricSummary.map((entry) => {
    const match = transferGapSummary.find(
      (gap) =>
        normalizeFamilyKey(gap?.family) === normalizeFamilyKey(entry?.family) &&
        gap?.isImmersiveComparison !== true
    );
    const familyConfig = getFamilyConfig(entry?.family);
    return {
      family: familyConfig?.family || stringOrNull(entry?.family),
      label: familyConfig?.label || stringOrNull(entry?.family),
      trialName: entry?.trialName || familyConfig?.trialName || null,
      metricName: entry?.coreMetricName || null,
      comparisonSurface: match?.comparisonSurface || null,
      currentValue: numberOrNull(entry?.coreMetricValue),
      baselineValue: numberOrNull(match?.baselineValue),
      transferGap: numberOrNull(match?.transferGap),
      interpretation: stringOrNull(match?.interpretation) || 'awaiting_baseline',
    };
  });

  const athleteHeadline =
    transferReadiness === 'strong_transfer' ? 'Your immersive rep matched your training baseline well.'
      : transferReadiness === 'emerging_transfer' ? 'You carried part of the work over, with a few gaps under immersion.'
      : transferReadiness === 'needs_transfer_work' ? 'The immersive rep exposed a real transfer gap to work on next.'
      : 'This session sets the first immersive reference point.';

  const athleteBody =
    transferReadiness === 'awaiting_baseline'
      ? 'We now have a clean immersive data point. The next step is pairing it with a matching daily-training baseline so transfer can be judged fairly.'
      : 'PulseCheck compares what you do in structured training with what happens when the environment gets more realistic. Smaller gaps mean the skill is traveling well.'
    ;

  const coachHeadline =
    transferReadiness === 'strong_transfer' ? 'Transfer looks stable across the first immersive package.'
      : transferReadiness === 'emerging_transfer' ? 'Transfer is emerging, but immersion still exposes some instability.'
      : transferReadiness === 'needs_transfer_work' ? 'Immersion exposed a meaningful transfer gap.'
      : 'Immersive baseline captured; transfer comparison will activate after phone/web coverage is linked.';

  const coachBody =
    isImmersiveBaseline
      ? 'This valid session has been designated as the athlete’s immersive baseline. Future Vision Pro reps can now be compared within-surface as well as against phone/web baselines.'
      : 'Coach view should read this session as a transfer check: compare family-level gaps, then decide whether the athlete needs more daily reps or more realistic stress exposure.';

  return {
    athleteHeadline,
    athleteBody,
    coachHeadline,
    coachBody,
    transferReadiness,
    immersiveBaselineMode: isImmersiveBaseline ? 'captured' : 'comparison_mode',
    familyCards,
  };
}

async function persistEventLog(sessionRef, eventLogInput, fallbackSession = {}) {
  const input = isPlainObject(eventLogInput) ? eventLogInput : {};
  const normalizedReference = normalizeEventLogReference(input);
  const events = normalizeRuntimeEvents(input.events, fallbackSession);

  if (!events.length) {
    return normalizedReference;
  }

  const logId = stringOrNull(input.logId) || 'runtime-v1';
  const logRef = sessionRef.collection(EVENT_LOGS_SUBCOLLECTION).doc(logId);
  const capturedAt = normalizedReference.capturedAt || Date.now();

  await logRef.set({
    schemaVersion: normalizedReference.schemaVersion,
    requiredEventTypes: normalizedReference.requiredEventTypes,
    eventCount: events.length,
    capturedAt,
    rawEventLogUri: normalizedReference.rawEventLogUri,
    events,
    updatedAt: Date.now(),
  });

  return {
    rawEventLogUri: logRef.path,
    schemaVersion: normalizedReference.schemaVersion,
    eventCount: events.length,
    capturedAt,
    requiredEventTypes: normalizedReference.requiredEventTypes,
  };
}

async function verifyAuth(admin, event) {
  const authHeader = event.headers?.authorization || event.headers?.Authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Missing Authorization header');
  }

  const idToken = authHeader.slice('Bearer '.length);
  return admin.auth().verifyIdToken(idToken);
}

async function getSessionDoc(db, sessionId) {
  const sessionRef = db.collection(COLLECTION).doc(sessionId);
  const sessionSnap = await sessionRef.get();
  if (!sessionSnap.exists) {
    throw new Error('Vision Pro session not found');
  }

  return {
    ref: sessionRef,
    snap: sessionSnap,
    data: sessionSnap.data(),
  };
}

async function loadAssignmentContext(db, assignmentCollection, assignmentId) {
  const normalizedCollection = normalizeCollectionName(assignmentCollection);
  const assignmentRef = db.collection(normalizedCollection).doc(assignmentId);
  const assignmentSnap = await assignmentRef.get();

  if (!assignmentSnap.exists) {
    throw new Error('Assignment not found');
  }

  const assignment = assignmentSnap.data();
  const athleteUserId =
    normalizedCollection === CURRICULUM_ASSIGNMENTS_COLLECTION
      ? assignment.athleteId
      : assignment.athleteUserId;
  const coachId =
    normalizedCollection === CURRICULUM_ASSIGNMENTS_COLLECTION
      ? assignment.coachId
      : assignment.assignedBy;
  const exerciseId = assignment.exerciseId;

  let exercise = assignment.exercise || null;
  if (!exercise && exerciseId) {
    const exerciseSnap = await db.collection(EXERCISES_COLLECTION).doc(exerciseId).get();
    if (exerciseSnap.exists) {
      exercise = exerciseSnap.data();
    }
  }

  return {
    assignmentRef,
    assignment,
    athleteUserId,
    coachId,
    exerciseId,
    exercise,
    simId: assignment.simSpecId || exercise?.simSpecId || exerciseId || 'vision_pro_trial',
    simName: exercise?.name || assignment.exerciseName || assignment.exercise?.name || 'Vision Pro Trial',
  };
}

async function cleanupSessionState(sessionRef, sessionData) {
  const now = Date.now();
  const updates = {};

  if (
    sessionData.status === 'queued' &&
    typeof sessionData.tokenExpiresAt === 'number' &&
    sessionData.tokenExpiresAt <= now
  ) {
    updates.status = 'expired';
    updates.expiredAt = now;
  }

  if (
    sessionData.status === 'claimed' &&
    typeof sessionData.claimedAt === 'number' &&
    sessionData.claimedAt + CLAIM_TIMEOUT_MS <= now &&
    !sessionData.startedAt
  ) {
    updates.status = 'abandoned';
    updates.abandonedAt = now;
    updates.abandonReason = 'claim_timeout';
  }

  if (Object.keys(updates).length === 0) {
    return { ...sessionData };
  }

  updates.launchTokenHash = null;
  updates.launchCodeHash = null;
  updates.tokenExpiresAt = null;
  updates.deviceSessionTokenHash = null;
  updates.updatedAt = now;
  await sessionRef.update(updates);
  return { ...sessionData, ...updates };
}

function sanitizeSession(sessionId, sessionData) {
  return {
    id: sessionId,
    assignmentId: sessionData.assignmentId,
    assignmentCollection: sessionData.assignmentCollection,
    athleteUserId: sessionData.athleteUserId,
    athleteDisplayName: sessionData.athleteDisplayName || null,
    athleteEmail: sessionData.athleteEmail || null,
    simId: sessionData.simId,
    simName: sessionData.simName,
    organizationId: sessionData.organizationId || null,
    teamId: sessionData.teamId || null,
    teamName: sessionData.teamName || null,
    pilotId: sessionData.pilotId || null,
    pilotName: sessionData.pilotName || null,
    cohortId: sessionData.cohortId || null,
    cohortName: sessionData.cohortName || null,
    status: sessionData.status,
    reservedDeviceId: sessionData.reservedDeviceId || null,
    claimedDeviceId: sessionData.claimedDeviceId || null,
    claimedDeviceName: sessionData.claimedDeviceName || null,
    claimedAt: sessionData.claimedAt || null,
    startedAt: sessionData.startedAt || null,
    completedAt: sessionData.completedAt || null,
    abandonedAt: sessionData.abandonedAt || null,
    trialType: sessionData.trialType || null,
    profileSnapshotMilestone: sessionData.profileSnapshotMilestone || null,
    tokenExpiresAt: sessionData.tokenExpiresAt || null,
    resultSummary: sessionData.resultSummary || null,
    versionMetadata: normalizeVersionMetadata(sessionData.versionMetadata),
    calibrationSummary: normalizeCalibrationSummary(sessionData.calibrationSummary),
    baselineReferences: normalizeBaselineReferences(sessionData.baselineReferences),
    familyMetricSummary: normalizeFamilyMetricSummary(sessionData.familyMetricSummary),
    validitySummary: normalizeValiditySummary(sessionData.validitySummary),
    transferGapSummary: normalizeTransferGapSummary(sessionData.transferGapSummary),
    eventLog: normalizeEventLogReference(sessionData.eventLog),
    reportSummary: normalizeReportSummary(sessionData.reportSummary),
    protocolContext: isPlainObject(sessionData.protocolContext)
      ? {
          baselineWindowDays: numberOrNull(sessionData.protocolContext.baselineWindowDays),
          requiredFamilies: arrayOfStrings(sessionData.protocolContext.requiredFamilies),
          enrollmentMode: stringOrNull(sessionData.protocolContext.enrollmentMode),
          comfortScreenRequired: booleanOrNull(sessionData.protocolContext.comfortScreenRequired),
          activeEscalationTier: numberOrNull(sessionData.protocolContext.activeEscalationTier),
          activeEscalationRecordId: stringOrNull(sessionData.protocolContext.activeEscalationRecordId),
          queueValidatedAt: numberOrNull(sessionData.protocolContext.queueValidatedAt),
          startValidatedAt: numberOrNull(sessionData.protocolContext.startValidatedAt),
        }
      : null,
    operatorReconciliation: isPlainObject(sessionData.operatorReconciliation)
      ? {
          status: ['pending', 'reviewed', 'needs_follow_up'].includes(sessionData.operatorReconciliation.status)
            ? sessionData.operatorReconciliation.status
            : null,
          reviewedAt: numberOrNull(sessionData.operatorReconciliation.reviewedAt),
          reviewedByUserId: stringOrNull(sessionData.operatorReconciliation.reviewedByUserId),
          reviewedByName: stringOrNull(sessionData.operatorReconciliation.reviewedByName),
          note: stringOrNull(sessionData.operatorReconciliation.note),
          checklist: isPlainObject(sessionData.operatorReconciliation.checklist)
            ? {
                versionTrailVerified: booleanOrNull(sessionData.operatorReconciliation.checklist.versionTrailVerified),
                calibrationVerified: booleanOrNull(sessionData.operatorReconciliation.checklist.calibrationVerified),
                baselineLinkageVerified: booleanOrNull(sessionData.operatorReconciliation.checklist.baselineLinkageVerified),
                validityVerified: booleanOrNull(sessionData.operatorReconciliation.checklist.validityVerified),
                eventLogVerified: booleanOrNull(sessionData.operatorReconciliation.checklist.eventLogVerified),
                incidentDispositionVerified: booleanOrNull(sessionData.operatorReconciliation.checklist.incidentDispositionVerified),
              }
            : null,
        }
      : null,
    sessionOutcome: stringOrNull(sessionData.sessionOutcome),
    isImmersiveBaseline:
      typeof sessionData.isImmersiveBaseline === 'boolean' ? sessionData.isImmersiveBaseline : null,
    immersiveBaselineReferenceId: stringOrNull(sessionData.immersiveBaselineReferenceId),
    abandonReason: stringOrNull(sessionData.abandonReason),
    createdByUserId: sessionData.createdByUserId || null,
    createdAt: sessionData.createdAt || null,
    updatedAt: sessionData.updatedAt || null,
  };
}

async function writeCanonicalProfileSnapshot(db, input, progressMerge = {}) {
  const validation = profileSnapshotRuntime.validateProfileExplanation(input.noraExplanation);
  if (!validation.valid) {
    throw new Error(validation.reason);
  }

  const progressRef = db.collection(ATHLETE_PROGRESS_COLLECTION).doc(input.athleteId);
  const snapshotKey = profileSnapshotRuntime.buildProfileSnapshotKey(input);
  const snapshotRef = progressRef.collection(PROFILE_SNAPSHOTS_SUBCOLLECTION).doc(snapshotKey);
  const now = Date.now();
  const incomingFingerprint = profileSnapshotRuntime.buildSnapshotFingerprint(input, input.noraExplanation);

  return db.runTransaction(async (transaction) => {
    const [progressSnap, existingSnap] = await Promise.all([
      transaction.get(progressRef),
      transaction.get(snapshotRef),
    ]);
    const existingData = existingSnap.exists ? existingSnap.data() : null;
    const existingProgressData = progressSnap.exists ? progressSnap.data() : {};
    const existingSnapshotIds =
      existingProgressData?.currentCanonicalSnapshotIds &&
      typeof existingProgressData.currentCanonicalSnapshotIds === 'object' &&
      !Array.isArray(existingProgressData.currentCanonicalSnapshotIds)
        ? existingProgressData.currentCanonicalSnapshotIds
        : {};

    if (existingData && existingData.payloadFingerprint === incomingFingerprint) {
      if (Object.keys(progressMerge).length > 0) {
        transaction.set(progressRef, progressMerge, { merge: true });
      }
      return { mode: 'noop', snapshot: existingData };
    }

    const nextRevision = (existingData?.revision ?? 0) + 1;
    const nextSnapshot = profileSnapshotRuntime.buildCanonicalSnapshot(input, now, nextRevision);

    if (existingData) {
      const revisionRef = snapshotRef.collection('revisions').doc(`r${String(existingData.revision).padStart(4, '0')}`);
      transaction.set(revisionRef, {
        ...existingData,
        supersededAt: now,
        supersededByRevision: nextRevision,
        archivedAt: now,
      });
    }

    transaction.set(snapshotRef, nextSnapshot);
    transaction.set(
      progressRef,
      {
        ...progressMerge,
        lastProfileSnapshotAt: now,
        lastCanonicalSnapshotKey: snapshotKey,
        lastCanonicalSnapshotMilestone: input.milestoneType,
        profileVersion: input.profileVersion,
        currentCanonicalSnapshotIds: {
          ...existingSnapshotIds,
          [snapshotKey]: snapshotKey,
        },
      },
      { merge: true }
    );

    return {
      mode: existingData ? 'updated' : 'created',
      snapshot: nextSnapshot,
    };
  });
}

async function syncTrialProfileSnapshot(db, athleteUserId, session) {
  const milestoneType = profileSnapshotRuntime.resolveMilestoneFromSession(session);
  if (!milestoneType) {
    return null;
  }

  const progressRef = db.collection(ATHLETE_PROGRESS_COLLECTION).doc(athleteUserId);
  const now = Date.now();
  const progressSnap = await progressRef.get();
  const existingProgress = progressSnap.exists
    ? progressSnap.data()
    : profileSnapshotRuntime.buildInitialAthleteProgress(athleteUserId, now);

  if (!progressSnap.exists) {
    await progressRef.set(existingProgress, { merge: true });
  }

  const [checkInsSnap, simSessionsSnap] = await Promise.all([
    db.collection(MENTAL_CHECKINS_COLLECTION)
      .doc(athleteUserId)
      .collection('check-ins')
      .orderBy('createdAt', 'desc')
      .limit(20)
      .get(),
    db.collection(SIM_SESSIONS_COLLECTION)
      .doc(athleteUserId)
      .collection('sessions')
      .orderBy('createdAt', 'desc')
      .limit(30)
      .get(),
  ]);

  const checkIns = checkInsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  const simSessions = simSessionsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  const taxonomyProfile = profileSnapshotRuntime.deriveTaxonomyProfile({
    baselineAssessment: existingProgress.baselineAssessment,
    checkIns,
    simSessions,
  });
  const activeProgram = profileSnapshotRuntime.prescribeNextSession({ profile: taxonomyProfile });
  const updatedProgress = {
    ...existingProgress,
    taxonomyProfile,
    activeProgram,
    lastProfileSyncAt: now,
    profileVersion: PROFILE_VERSION,
    updatedAt: now,
  };

  return writeCanonicalProfileSnapshot(
    db,
    profileSnapshotRuntime.buildProfileSnapshotWriteInput({
      athleteId: athleteUserId,
      progress: updatedProgress,
      milestoneType,
      capturedAt: session.createdAt || now,
      sourceEventId: session.id ? `sim_session:${session.id}` : undefined,
    }),
    {
      taxonomyProfile,
      activeProgram,
      lastProfileSyncAt: now,
      profileVersion: PROFILE_VERSION,
      updatedAt: now,
    }
  );
}

async function sendVisionProQueuedNotification(admin, db, {
  athleteUserId,
  sessionId,
  assignmentId,
  assignmentCollection,
  simId,
  simName,
  coachDisplayName,
}) {
  const userSnap = await db.collection(USERS_COLLECTION).doc(athleteUserId).get();
  if (!userSnap.exists) {
    return;
  }

  const userData = userSnap.data() || {};
  const fcmToken = userData.fcmToken;
  if (!fcmToken) {
    return;
  }

  const title = 'Vision Pro trial ready';
  const body = `${coachDisplayName || 'Your coach'} queued ${simName}. Open Pulse Check to pair the headset.`;

  await admin.messaging().send({
    token: fcmToken,
    notification: { title, body },
    data: {
      type: 'VISION_PRO_TRIAL_READY',
      sessionId,
      assignmentId,
      assignmentCollection,
      athleteUserId,
      simId,
      simName,
      coachDisplayName: coachDisplayName || 'Coach',
      queuedAt: String(Date.now()),
    },
    apns: {
      payload: {
        aps: {
          alert: { title, body },
          sound: 'default',
          badge: 1,
        },
      },
    },
    android: {
      priority: 'high',
      notification: {
        sound: 'default',
      },
    },
  });
}

async function recordCurriculumCompletion(db, assignmentId, durationSeconds, postMood) {
  const assignmentRef = db.collection(CURRICULUM_ASSIGNMENTS_COLLECTION).doc(assignmentId);
  const assignmentSnap = await assignmentRef.get();
  if (!assignmentSnap.exists) {
    throw new Error('Curriculum assignment not found');
  }

  const assignment = assignmentSnap.data();
  const now = Date.now();
  const dateString = getDateString(now);
  const dailyRef = assignmentRef.collection(CURRICULUM_DAILY_COMPLETIONS_SUBCOLLECTION).doc(dateString);
  const dailySnap = await dailyRef.get();
  const completionRecord = {
    completedAt: now,
    durationSeconds,
    postMood: typeof postMood === 'number' ? postMood : null,
  };

  if (dailySnap.exists) {
    const existing = dailySnap.data();
    const completions = Array.isArray(existing.completions) ? existing.completions : [];
    const updatedCompletions = [...completions, completionRecord];
    const targetCount = Number.isFinite(existing.targetCount) ? existing.targetCount : assignment.frequency || 1;

    await dailyRef.update({
      completionCount: updatedCompletions.length,
      completed: updatedCompletions.length >= targetCount,
      completions: updatedCompletions,
      updatedAt: now,
    });
  } else {
    const targetCount = assignment.frequency || 1;
    await dailyRef.set({
      date: dateString,
      completed: 1 >= targetCount,
      completionCount: 1,
      targetCount,
      completions: [completionRecord],
      createdAt: now,
      updatedAt: now,
    });
  }

  const dailySnapshots = await assignmentRef
    .collection(CURRICULUM_DAILY_COMPLETIONS_SUBCOLLECTION)
    .get();
  const completedDays = dailySnapshots.docs
    .map((doc) => doc.data())
    .filter((data) => data.completed)
    .length;
  const targetDays = assignment.targetDays || assignment.durationDays || 14;
  const completionRate = targetDays > 0
    ? Math.round((completedDays / targetDays) * 100)
    : 0;

  await assignmentRef.update({
    completedDays,
    currentDayNumber: getCurrentDayNumber(assignment.startDate || now, now),
    completionRate,
    updatedAt: now,
  });
}

async function recordLegacyAssignmentCompletion(db, assignmentId) {
  await db.collection(LEGACY_ASSIGNMENTS_COLLECTION).doc(assignmentId).update({
    status: 'completed',
    completedAt: Date.now() / 1000,
    updatedAt: Date.now() / 1000,
  });
}

async function writeSimSession(db, athleteUserId, payload) {
  const sessionRef = db.collection(SIM_SESSIONS_COLLECTION)
    .doc(athleteUserId)
    .collection('sessions');
  const docRef = await sessionRef.add(payload);
  return docRef.id;
}

function buildResultSummary(resultPayload) {
  const firstFamilyMetric = Array.isArray(resultPayload.familyMetricSummary)
    ? resultPayload.familyMetricSummary.find((entry) => isPlainObject(entry))
    : null;

  return {
    normalizedScore: resultPayload.normalizedScore ?? firstFamilyMetric?.normalizedScore ?? null,
    coreMetricName: resultPayload.coreMetricName || firstFamilyMetric?.coreMetricName || null,
    coreMetricValue: resultPayload.coreMetricValue ?? firstFamilyMetric?.coreMetricValue ?? null,
    durationSeconds: resultPayload.durationSeconds ?? null,
    completedAt: Date.now(),
  };
}

async function withVisionProContext(event) {
  const admin = initializeFirebaseAdmin({ headers: event.headers || {} });
  const db = admin.firestore();
  return { admin, db };
}

async function cleanupExpiredVisionProSessions(db) {
  const now = Date.now();
  const queuedSnap = await db.collection(COLLECTION)
    .where('status', '==', 'queued')
    .where('tokenExpiresAt', '<=', now)
    .get();

  const claimedSnap = await db.collection(COLLECTION)
    .where('status', '==', 'claimed')
    .where('claimedAt', '<=', now - CLAIM_TIMEOUT_MS)
    .get();

  const updates = [];

  queuedSnap.forEach((doc) => {
    updates.push(doc.ref.update({
      status: 'expired',
      expiredAt: now,
      launchTokenHash: null,
      launchCodeHash: null,
      tokenExpiresAt: null,
      updatedAt: now,
    }));
  });

  claimedSnap.forEach((doc) => {
    updates.push(doc.ref.update({
      status: 'abandoned',
      abandonedAt: now,
      abandonReason: 'claim_timeout',
      launchTokenHash: null,
      launchCodeHash: null,
      tokenExpiresAt: null,
      deviceSessionTokenHash: null,
      updatedAt: now,
    }));
  });

  await Promise.all(updates);

  return {
    expiredQueuedSessions: queuedSnap.size,
    abandonedClaimedSessions: claimedSnap.size,
  };
}

module.exports = {
  BASELINE_RECENCY_WINDOW_DAYS,
  CLAIM_TIMEOUT_MS,
  COLLECTION,
  CURRICULUM_ASSIGNMENTS_COLLECTION,
  EVENT_LOG_SCHEMA_VERSION,
  EVENT_LOGS_SUBCOLLECTION,
  LEGACY_ASSIGNMENTS_COLLECTION,
  REQUIRED_EVENT_TYPES,
  baseHeaders,
  buildResultSummary,
  buildTransferGapSummaryFromSources,
  buildVisionProProtocolIssues,
  buildVisionProReportSummary,
  cleanupExpiredVisionProSessions,
  cleanupSessionState,
  createDeviceSessionToken,
  createLaunchToken,
  determineImmersiveBaselineFlag,
  getSessionDoc,
  json,
  loadAssignmentContext,
  loadAthleteIdentity,
  normalizeCollectionName,
  parseBody,
  persistEventLog,
  recordCurriculumCompletion,
  recordLegacyAssignmentCompletion,
  normalizeBaselineReferences,
  normalizeCalibrationSummary,
  normalizeEventLogReference,
  normalizeFamilyMetricSummary,
  normalizeReportSummary,
  normalizeTransferGapSummary,
  normalizeValiditySummary,
  normalizeVersionMetadata,
  resolveVisionProBaselineContext,
  resolveVisionProProtocolContext,
  sanitizeSession,
  sendVisionProQueuedNotification,
  sha256,
  syncTrialProfileSnapshot,
  verifyAuth,
  withVisionProContext,
  writeSimSession,
};
