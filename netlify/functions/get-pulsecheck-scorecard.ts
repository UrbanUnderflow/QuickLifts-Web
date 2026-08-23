import type { Handler } from '@netlify/functions';
import * as admin from 'firebase-admin';
import { getFirestore, initAdmin } from './utils/getServiceAccount';
import {
  calculatePulseCheckScorecardV2,
  PULSECHECK_SCORING_VERSION,
  type PulseCheckAutonomicMeasurement,
  type PulseCheckScoringDay,
  type PulseCheckSleepSignal,
  type PulseCheckWhoFiveObservation,
} from '../../src/utils/pulsecheckScoringV2';

const RESPONSE_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SCORECARD_COLLECTION = 'pulsecheck-scorecards';
const CHECKIN_COLLECTION = 'pulsecheck-morning-checkins';
const HEALTH_COLLECTION = 'health-context-snapshots';
const HEALTH_SOURCE_RECORD_COLLECTION = 'health-context-source-records';
const WELLBEING_COLLECTION = 'pulsecheck-wellbeing-assessments';
const SCORE_INPUT_DAYS = 60;
const DEVICE_EVIDENCE_DAYS = 14;
const SCORECARD_CACHE_TTL_MS = 15 * 60 * 1000;

const { measuredFieldNames } = require('./lib/health-context-measurements') as {
  measuredFieldNames: (domain: string, payload: Record<string, unknown>) => string[];
};

type FirestoreRecord = { id: string; data: Record<string, any> };

const verifyAuth = async (authHeader?: string): Promise<{ uid: string } | null> => {
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) return null;
  try {
    const decoded = await admin.auth().verifyIdToken(token);
    return { uid: decoded.uid };
  } catch {
    return null;
  }
};

const cleanString = (value: unknown): string => typeof value === 'string' ? value.trim() : '';

const finiteNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const asRecord = (value: unknown): Record<string, any> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, any>
    : {};

const withoutUndefined = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value
      .map((item) => withoutUndefined(item))
      .filter((item) => item !== undefined);
  }
  if (!value || typeof value !== 'object' || value instanceof Date || value instanceof admin.firestore.Timestamp) {
    return value;
  }
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .map(([key, item]) => [key, withoutUndefined(item)]),
  );
};

const establishedCoherenceScoreFromDocument = (document: Record<string, any>): number | null => {
  const methodologyVersion = cleanString(document.methodologyVersion);
  return methodologyVersion === PULSECHECK_SCORING_VERSION
    ? finiteNumber(document.coherence?.score)
    : null;
};

const membershipIsActive = (data: Record<string, any>): boolean => {
  const status = cleanString(data.status).toLowerCase();
  return (!status || status === 'active') && data.revokedAt == null;
};

const membershipHasCapability = (data: Record<string, any>, capability: string): boolean => {
  if (cleanString(data.role) === 'team-admin') return true;
  const configured = Array.isArray(data.staffCapabilities)
    ? data.staffCapabilities.map((value: unknown) => cleanString(value))
    : [];
  if (configured.includes(capability) || configured.includes('admin')) return true;
  if (configured.length > 0) return false;
  const role = cleanString(data.role);
  if (capability === 'coaching') return role === 'coach';
  if (capability === 'athletic_trainer') return ['performance-staff', 'clinician'].includes(role);
  return false;
};

const verifyStaffAthleteAccess = async (
  db: admin.firestore.Firestore,
  staffUserId: string,
  athleteUserId: string,
  teamId: string,
): Promise<{ organizationId: string } | null> => {
  if (!teamId) return null;
  const [teamDocument, staffDocument, athleteDocument] = await db.getAll(
    db.collection('pulsecheck-teams').doc(teamId),
    db.collection('pulsecheck-team-memberships').doc(`${teamId}_${staffUserId}`),
    db.collection('pulsecheck-team-memberships').doc(`${teamId}_${athleteUserId}`),
  );
  if (!teamDocument.exists || !staffDocument.exists || !athleteDocument.exists) return null;
  const team = teamDocument.data() || {};
  const staff = staffDocument.data() || {};
  const athlete = athleteDocument.data() || {};
  const organizationId = cleanString(team.organizationId);
  const organizationDocument = organizationId
    ? await db.collection('pulsecheck-organizations').doc(organizationId).get()
    : null;
  const organization = organizationDocument?.data() || {};
  const rosterScope = cleanString(staff.rosterVisibilityScope) || 'team';
  const allowedAthletes = Array.isArray(staff.allowedAthleteIds)
    ? staff.allowedAthleteIds.map((value: unknown) => cleanString(value))
    : [];
  const teamActive = cleanString(team.status).toLowerCase() === 'active'
    && team.archivedAt == null
    && team.deletedAt == null;
  const organizationActive = Boolean(organizationDocument?.exists)
    && cleanString(organization.status).toLowerCase() === 'active'
    && organization.archivedAt == null
    && organization.deletedAt == null;
  const staffAuthorized = cleanString(staff.userId) === staffUserId
    && cleanString(staff.teamId) === teamId
    && cleanString(staff.organizationId) === organizationId
    && cleanString(staff.role) !== 'athlete'
    && membershipIsActive(staff)
    && (membershipHasCapability(staff, 'coaching') || membershipHasCapability(staff, 'athletic_trainer'))
    && (rosterScope === 'team' || (rosterScope === 'assigned' && allowedAthletes.includes(athleteUserId)));
  const athleteAuthorized = cleanString(athlete.userId) === athleteUserId
    && cleanString(athlete.teamId) === teamId
    && cleanString(athlete.organizationId) === organizationId
    && cleanString(athlete.role) === 'athlete'
    && membershipIsActive(athlete);
  return teamActive && organizationActive && organizationId && staffAuthorized && athleteAuthorized
    ? { organizationId }
    : null;
};

const shiftDateKey = (dateKey: string, offset: number): string => {
  const date = new Date(`${dateKey}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
};

const dayDifferenceFromKeys = (laterDateKey: string, earlierDateKey: string): number | null => {
  const later = Date.parse(`${laterDateKey}T12:00:00.000Z`);
  const earlier = Date.parse(`${earlierDateKey}T12:00:00.000Z`);
  if (!Number.isFinite(later) || !Number.isFinite(earlier)) return null;
  return Math.max(0, Math.floor((later - earlier) / 86_400_000));
};

const dateKeyInTimeZone = (date: Date, timeZone: string): string => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value || '';
  return `${value('year')}-${value('month')}-${value('day')}`;
};

const mergeDomainData = (block: unknown): Record<string, any> => {
  if (!block || typeof block !== 'object') return {};
  const source = block as Record<string, any>;
  const nested = source.data && typeof source.data === 'object' ? source.data : {};
  const metadata = new Set(['data', 'freshness', 'provenance', 'sourceStatus', 'generatedAt', 'updatedAt']);
  const direct = Object.fromEntries(Object.entries(source).filter(([key]) => !metadata.has(key)));
  return { ...direct, ...nested };
};

const timestampMillis = (value: unknown): number | null => {
  if (value instanceof admin.firestore.Timestamp) return value.toMillis();
  if (value instanceof Date) return value.getTime();
  const numeric = finiteNumber(value);
  if (numeric !== null) return numeric > 10_000_000_000 ? numeric : numeric * 1000;
  const parsed = typeof value === 'string' ? Date.parse(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : null;
};

const sourceFamilyFrom = (snapshot: Record<string, any>, recoveryBlock: Record<string, any>): string =>
  cleanString(recoveryBlock.provenance?.primarySource)
  || cleanString(snapshot.provenance?.domainWinners?.recovery)
  || cleanString(snapshot.recoveryWinner)
  || 'unknown';

const defaultHrvMethod = (sourceFamily: string): 'sdnn' | 'rmssd' => {
  const normalized = sourceFamily.toLowerCase();
  return normalized.includes('healthkit') || normalized.includes('apple') ? 'sdnn' : 'rmssd';
};

const defaultMeasurementWindow = (
  sourceFamily: string,
  metric: 'hrv' | 'resting_heart_rate',
): PulseCheckAutonomicMeasurement['measurementWindow'] => {
  const normalized = sourceFamily.toLowerCase();
  if (['whoop', 'oura', 'polar'].some((source) => normalized.includes(source))) return 'sleep';
  if (normalized.includes('health_connect') && metric === 'hrv') return 'spot';
  if (normalized.includes('healthkit')) return 'full_day';
  return 'unknown';
};

const healthDayFromSnapshot = (record: FirestoreRecord): {
  dateKey: string;
  sleep: PulseCheckSleepSignal | null;
  autonomicMeasurements: PulseCheckAutonomicMeasurement[];
} | null => {
  const snapshot = record.data;
  const dateKey = cleanString(snapshot.snapshotDateKey || snapshot.snapshotDate || snapshot.dateKey)
    || record.id.match(/(\d{4}-\d{2}-\d{2})$/)?.[1]
    || '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return null;
  const recoveryBlock = snapshot.domains?.recovery || {};
  const recovery = mergeDomainData(recoveryBlock);
  const sourceFamily = sourceFamilyFrom(snapshot, recoveryBlock);
  const freshness = cleanString(
    recoveryBlock.freshness
    || snapshot.freshness?.perDomain?.recovery
    || snapshot.freshness?.recovery
    || snapshot.freshness?.overall,
  ) as PulseCheckSleepSignal['freshness'];
  const deviceId = cleanString(
    recovery.heartRateVariabilityDeviceId
    || recovery.rawDeviceId
    || recovery.deviceId,
  ) || null;
  const algorithmVersion = cleanString(
    recovery.heartRateVariabilityAlgorithmVersion
    || recovery.algorithmVersion
    || snapshot.payloadVersion,
  ) || 'source-native';
  const autonomicMeasurements: PulseCheckAutonomicMeasurement[] = [];
  const hrv = finiteNumber(recovery.heartRateVariability ?? recovery.rmssdMs ?? recovery.hrvMs);
  if (hrv !== null && hrv > 0) {
    const configuredMethod = cleanString(
      recovery.heartRateVariabilityMethod || recovery.hrvMethod || recovery.hrvMetricType,
    ).toLowerCase();
    const method = configuredMethod === 'sdnn' || configuredMethod === 'rmssd'
      ? configuredMethod
      : defaultHrvMethod(sourceFamily);
    autonomicMeasurements.push({
      dateKey,
      metric: 'hrv',
      value: hrv,
      sourceFamily,
      deviceId,
      method,
      measurementWindow: (cleanString(recovery.heartRateVariabilityMeasurementWindow)
        || cleanString(recovery.hrvMeasurementWindow)
        || defaultMeasurementWindow(sourceFamily, 'hrv')) as PulseCheckAutonomicMeasurement['measurementWindow'],
      algorithmVersion,
      freshness,
      isPrimary: true,
    });
  }
  const restingHeartRate = finiteNumber(
    recovery.heartRateResting ?? recovery.restingHeartRate ?? recovery.restingHeartRateBpm,
  );
  if (restingHeartRate !== null && restingHeartRate > 0) {
    autonomicMeasurements.push({
      dateKey,
      metric: 'resting_heart_rate',
      value: restingHeartRate,
      sourceFamily,
      deviceId: cleanString(recovery.restingHeartRateDeviceId) || deviceId,
      method: 'resting_heart_rate',
      measurementWindow: (cleanString(recovery.restingHeartRateMeasurementWindow)
        || defaultMeasurementWindow(sourceFamily, 'resting_heart_rate')) as PulseCheckAutonomicMeasurement['measurementWindow'],
      algorithmVersion: cleanString(recovery.restingHeartRateAlgorithmVersion) || algorithmVersion,
      freshness,
      isPrimary: true,
    });
  }
  const durationHours = finiteNumber(recovery.sleepDuration ?? recovery.totalSleepHours);
  const durationMinutes = finiteNumber(recovery.totalSleepMin ?? recovery.totalSleepMinutes);
  const sleep: PulseCheckSleepSignal | null = [
    durationHours,
    durationMinutes,
    finiteNumber(recovery.sleepEfficiency),
    finiteNumber(recovery.sleepMidpointShiftMinutes),
  ].some((value) => value !== null)
    ? {
      durationHours: durationHours ?? (durationMinutes === null ? null : durationMinutes / 60),
      targetHours: finiteNumber(recovery.sleepNeededHours ?? recovery.sleepTargetHours) ?? 8,
      efficiencyPercent: finiteNumber(recovery.sleepEfficiency),
      timingDeviationMinutes: finiteNumber(recovery.sleepMidpointShiftMinutes),
      sourceFamily,
      freshness,
    }
    : null;
  return { dateKey, sleep, autonomicMeasurements };
};

const whoFiveFromRecords = (records: FirestoreRecord[], throughDateKey: string): PulseCheckWhoFiveObservation | null => {
  const current = records
    .map((record) => {
      const data = record.data;
      const dateKey = cleanString(data.dateKey || data.completedDateKey || data.observedDateKey);
      const directPercent = finiteNumber(data.scorePercent);
      const rawScore = finiteNumber(data.rawScore ?? data.score);
      const scorePercent = directPercent ?? (rawScore === null ? null : rawScore <= 25 ? rawScore * 4 : rawScore);
      return {
        dateKey,
        scorePercent,
        instrumentVersion: cleanString(data.instrumentVersion || data.instrument) || 'periodic-wellbeing',
      };
    })
    .filter((record): record is PulseCheckWhoFiveObservation =>
      /^\d{4}-\d{2}-\d{2}$/.test(record.dateKey)
      && record.dateKey <= throughDateKey
      && record.scorePercent !== null,
    )
    .sort((left, right) => right.dateKey.localeCompare(left.dateKey))[0];
  return current || null;
};

const buildScoringDays = (input: {
  dateKeys: string[];
  checkIns: FirestoreRecord[];
  healthSnapshots: FirestoreRecord[];
  eligibleFromDateKey?: string | null;
}): PulseCheckScoringDay[] => {
  const checkInsByDate = new Map<string, Record<string, any>>();
  for (const record of input.checkIns) {
    const dateKey = cleanString(record.data.dayKey || record.data.date || record.data.sourceDate)
      || record.id.match(/(\d{4}-\d{2}-\d{2})$/)?.[1]
      || '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) checkInsByDate.set(dateKey, record.data);
  }
  const healthByDate = new Map(
    input.healthSnapshots
      .map(healthDayFromSnapshot)
      .filter((record): record is NonNullable<ReturnType<typeof healthDayFromSnapshot>> => Boolean(record))
      .map((record) => [record.dateKey, record]),
  );
  return input.dateKeys.map((dateKey): PulseCheckScoringDay => {
    const checkIn = checkInsByDate.get(dateKey) || {};
    const health = healthByDate.get(dateKey);
    return {
      dateKey,
      scheduledCheckIn: !input.eligibleFromDateKey || dateKey >= input.eligibleFromDateKey,
      wellbeingLevel: checkIn.level ?? checkIn.readinessLevel ?? null,
      subjectiveRecoveryLevel:
        checkIn.subjectiveRecoveryLevel
        ?? checkIn.recoveryLevel
        ?? checkIn.recovery?.level
        ?? null,
      sleep: health?.sleep || null,
      autonomicMeasurements: health?.autonomicMeasurements || [],
    };
  });
};

const athleteSafeScorecard = <T extends ReturnType<typeof calculatePulseCheckScorecardV2>>(scorecard: T): T => ({
  ...scorecard,
  autonomic: {
    hrv: { ...scorecard.autonomic.hrv, laneId: null, currentValue: null },
    restingHeartRate: { ...scorecard.autonomic.restingHeartRate, laneId: null, currentValue: null },
  },
}) as T;

const buildCoachContext = (
  scorecard: ReturnType<typeof calculatePulseCheckScorecardV2>,
  days: PulseCheckScoringDay[],
) => {
  const latestSubjectiveRecovery = [...days]
    .reverse()
    .map((day) => finiteNumber(day.subjectiveRecoveryLevel))
    .find((value): value is number => value !== null);
  const lowAutonomicSignal = [scorecard.autonomic.hrv.score, scorecard.autonomic.restingHeartRate.score]
    .some((score) => score !== null && score <= 35);
  const mixedRecoverySignals = latestSubjectiveRecovery !== undefined
    && latestSubjectiveRecovery >= 4
    && lowAutonomicSignal;
  return {
    mixedRecoverySignals,
    mixedSignalSummary: mixedRecoverySignals
      ? 'Mixed recovery signals. The athlete reports feeling recovered. One or more autonomic signals are outside the athlete’s current source-specific range. This is informational. Review it alongside workload, symptoms, and direct observation.'
      : null,
    physicalTrainingBoundary: 'PulseCheck reports evidence and uncertainty. Coaches and sports medicine staff make physical training decisions.',
    autonomic: scorecard.autonomic,
    sourceTransitions: scorecard.sourceTransitions,
  };
};

const reusableCachedScorecard = (
  document: Record<string, any>,
  throughDateKey: string,
  nowMillis: number,
  requireCoachContext: boolean,
): ReturnType<typeof calculatePulseCheckScorecardV2> | null => {
  const computedAtMillis = timestampMillis(document.computedAt);
  const adherenceComponents = Array.isArray(document.adherence?.components)
    ? document.adherence.components
    : [];
  const showingUpDays = adherenceComponents.find((component: Record<string, unknown>) =>
    Array.isArray(component.dayStates) && component.dayStates.length > 0)?.dayStates || [];
  const hasDetailedShowingUpDays = showingUpDays.length > 0
    && showingUpDays.every((day: unknown) => {
      const record = asRecord(day);
      return cleanString(record.checkInLabel).length > 0
        && cleanString(record.reason).length > 0;
    });
  if (
    cleanString(document.methodologyVersion) !== PULSECHECK_SCORING_VERSION
    || cleanString(document.throughDateKey) !== throughDateKey
    || computedAtMillis === null
    || computedAtMillis > nowMillis
    || nowMillis - computedAtMillis > SCORECARD_CACHE_TTL_MS
    || !document.wellbeing
    || !document.recovery
    || !document.adherence
    || !document.coherence
    || !document.autonomic
    || !Array.isArray(document.sourceTransitions)
    || !Array.isArray(document.limitations)
    || !hasDetailedShowingUpDays
    || (requireCoachContext && !document.coachContext)
  ) {
    return null;
  }

  return document as ReturnType<typeof calculatePulseCheckScorecardV2>;
};

const getDocumentsById = async (
  db: admin.firestore.Firestore,
  collectionName: string,
  ids: string[],
): Promise<FirestoreRecord[]> => {
  const records: FirestoreRecord[] = [];
  for (let index = 0; index < ids.length; index += 100) {
    const references = ids.slice(index, index + 100).map((id) => db.collection(collectionName).doc(id));
    const snapshots = await db.getAll(...references);
    snapshots.forEach((snapshot) => {
      if (snapshot.exists) records.push({ id: snapshot.id, data: snapshot.data() || {} });
    });
  }
  return records;
};

const WEARABLE_SOURCE_FAMILIES = new Set([
  'oura',
  'apple_health',
  'healthkit',
  'health_kit',
  'apple_watch',
  'healthconnect',
  'google_health',
  'polar',
  'fitbit',
  'whoop',
  'garmin',
]);

const timestampSeconds = (value: unknown): number | null => {
  const millis = timestampMillis(value);
  return millis === null ? null : millis / 1000;
};

const sourceRecordDateKey = (record: FirestoreRecord): string => {
  const provenance = asRecord(record.data.provenance);
  const candidates = [
    cleanString(provenance.rawDay),
    cleanString(provenance.rawDate),
    cleanString(record.data.dedupeKey).split('|').at(-1) || '',
    record.id.match(/(\d{4}-\d{2}-\d{2})(?:$|_)/)?.[1] || '',
  ];
  return candidates.find((value) => /^\d{4}-\d{2}-\d{2}$/.test(value)) || '';
};

const verifiedFitbitMetadata = (record: FirestoreRecord): boolean => {
  const payload = asRecord(record.data.payload);
  const provenance = asRecord(record.data.provenance);
  const deviceMetadata = {
    ...asRecord(provenance.deviceMetadata),
    ...asRecord(payload.deviceMetadata),
    ...asRecord(record.data.deviceMetadata),
  };
  return [
    deviceMetadata.manufacturer,
    deviceMetadata.brand,
    deviceMetadata.model,
    deviceMetadata.displayName,
  ].some((value) => typeof value === 'string' && value.toLowerCase().includes('fitbit'));
};

const qualifiedSourceFamily = (record: FirestoreRecord): string => {
  const sourceFamily = cleanString(record.data.sourceFamily).toLowerCase();
  if (sourceFamily !== 'fitbit') return sourceFamily;
  const payload = asRecord(record.data.payload);
  const provenance = asRecord(record.data.provenance);
  const providerTokens = [
    record.data.provider,
    provenance.provider,
    provenance.sourceProvider,
    payload.provider,
    payload.dataSourceFamily,
  ].map((value) => cleanString(value).toLowerCase());
  const genericGoogleHealth = providerTokens.some((value) =>
    value.includes('google_health')
    || value.includes('google-health')
    || value.includes('google-wearable')
    || value.includes('health_connect')
  );
  return genericGoogleHealth && !verifiedFitbitMetadata(record) ? 'google_health' : sourceFamily;
};

const projectMeasuredSourceRecord = (
  record: FirestoreRecord,
  dateKeys: Set<string>,
): Record<string, unknown> | null => {
  const status = cleanString(record.data.status).toLowerCase();
  if (status && status !== 'active') return null;
  const dateKey = sourceRecordDateKey(record);
  if (!dateKeys.has(dateKey)) return null;
  const sourceFamily = qualifiedSourceFamily(record);
  if (!WEARABLE_SOURCE_FAMILIES.has(sourceFamily)) return null;
  const domain = cleanString(record.data.domain).toLowerCase();
  const payload = asRecord(record.data.payload);
  const measuredFields = measuredFieldNames(domain, payload);
  if (measuredFields.length === 0) return null;

  const explicitFieldSources = asRecord(payload.fieldSources);
  const explicitFieldSourceLabels = asRecord(payload.fieldSourceLabels);
  const measuredPayload = Object.fromEntries(
    measuredFields.map((field) => [field, payload[field]]),
  );
  const fieldSources = Object.fromEntries(
    measuredFields.map((field) => {
      const explicit = cleanString(explicitFieldSources[field]).toLowerCase();
      return [field, WEARABLE_SOURCE_FAMILIES.has(explicit) ? explicit : sourceFamily];
    }),
  );
  const fieldSourceLabels = Object.fromEntries(
    measuredFields.flatMap((field) => {
      const label = cleanString(explicitFieldSourceLabels[field]);
      return label ? [[field, label]] : [];
    }),
  );

  return {
    id: record.id,
    athleteUserId: cleanString(record.data.athleteUserId),
    sourceFamily,
    domain,
    status: 'active',
    observedAt: timestampSeconds(record.data.observedAt),
    observedWindowStart: timestampSeconds(record.data.observedWindowStart),
    observedWindowEnd: timestampSeconds(record.data.observedWindowEnd),
    ingestedAt: timestampSeconds(record.data.ingestedAt),
    timezone: cleanString(record.data.timezone) || undefined,
    dedupeKey: cleanString(record.data.dedupeKey) || undefined,
    provenance: { rawDay: dateKey },
    payload: {
      ...measuredPayload,
      fieldSources,
      ...(Object.keys(fieldSourceLabels).length > 0 ? { fieldSourceLabels } : {}),
    },
  };
};

const loadCoachDeviceEvidence = async (
  db: admin.firestore.Firestore,
  athleteUserId: string,
  dateKeys: string[],
) => {
  const snapshotIds = dateKeys.map((dateKey) => `${athleteUserId}_daily_${dateKey}`);
  const snapshots = await getDocumentsById(db, HEALTH_COLLECTION, snapshotIds);
  const sourceRecordIds = Array.from(new Set(snapshots.flatMap((snapshot) => {
    const provenance = asRecord(snapshot.data.provenance);
    return Array.isArray(provenance.sourceRecordIds)
      ? provenance.sourceRecordIds.map((value: unknown) => cleanString(value)).filter(Boolean)
      : [];
  })));
  const sourceRecords = sourceRecordIds.length > 0
    ? await getDocumentsById(db, HEALTH_SOURCE_RECORD_COLLECTION, sourceRecordIds)
    : [];
  const dateKeySet = new Set(dateKeys);
  const records = sourceRecords
    .map((record) => projectMeasuredSourceRecord(record, dateKeySet))
    .filter((record): record is Record<string, unknown> => record !== null)
    .sort((left, right) => Number(right.observedAt || 0) - Number(left.observedAt || 0));
  const computedAt = Date.now() / 1000;
  const windowStart = Date.parse(`${dateKeys[0]}T00:00:00.000Z`) / 1000;
  return {
    records,
    windowDays: dateKeys.length,
    windowDateKeys: dateKeys,
    windowStart,
    computedAt,
    evidenceState: 'available' as const,
  };
};

const loadOptionalWellbeingRecords = async (
  db: admin.firestore.Firestore,
  athleteId: string,
): Promise<FirestoreRecord[]> => {
  try {
    const snapshot = await db.collection(WELLBEING_COLLECTION).where('athleteUserId', '==', athleteId).get();
    return snapshot.docs.map((document) => ({ id: document.id, data: document.data() || {} }));
  } catch {
    return [];
  }
};

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: RESPONSE_HEADERS, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: RESPONSE_HEADERS, body: JSON.stringify({ error: 'method_not_allowed' }) };
  }

  await initAdmin();
  const db = await getFirestore();
  const auth = await verifyAuth(event.headers?.authorization || event.headers?.Authorization);
  if (!auth) {
    return { statusCode: 401, headers: RESPONSE_HEADERS, body: JSON.stringify({ error: 'unauthenticated' }) };
  }

  let body: Record<string, unknown> = {};
  try {
    body = typeof event.body === 'string' && event.body ? JSON.parse(event.body) : {};
  } catch {
    return { statusCode: 400, headers: RESPONSE_HEADERS, body: JSON.stringify({ error: 'invalid_json' }) };
  }
  const requestedAthleteId = cleanString(body.athleteUserId) || auth.uid;
  const requestedTeamId = cleanString(body.teamId);
  let staffAccess: { organizationId: string } | null = null;
  if (requestedAthleteId !== auth.uid) {
    staffAccess = await verifyStaffAthleteAccess(db, auth.uid, requestedAthleteId, requestedTeamId);
    if (!staffAccess) {
      return { statusCode: 403, headers: RESPONSE_HEADERS, body: JSON.stringify({ error: 'scoped_staff_access_required' }) };
    }
  }
  const timezone = cleanString(body.timezone) || 'America/New_York';
  const throughDateKey = cleanString(body.throughDateKey) || dateKeyInTimeZone(new Date(), timezone);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(throughDateKey)) {
    return { statusCode: 400, headers: RESPONSE_HEADERS, body: JSON.stringify({ error: 'invalid_through_date' }) };
  }
  const dateKeys = Array.from({ length: SCORE_INPUT_DAYS }, (_, index) =>
    shiftDateKey(throughDateKey, -(SCORE_INPUT_DAYS - 1 - index)));
  const checkInIds = dateKeys.map((dateKey) => `${requestedAthleteId}_${dateKey}`);
  const healthIds = dateKeys.map((dateKey) => `${requestedAthleteId}_daily_${dateKey}`);
  const documentId = `${requestedAthleteId}_v${PULSECHECK_SCORING_VERSION.split('.')[0]}`;

  try {
    const scorecardReference = db.collection(SCORECARD_COLLECTION).doc(documentId);
    const [existingScorecardDocument, deviceEvidence] = await Promise.all([
      scorecardReference.get(),
      loadCoachDeviceEvidence(
        db,
        requestedAthleteId,
        dateKeys.slice(-DEVICE_EVIDENCE_DAYS),
      ).catch((error) => {
        console.warn('[get-pulsecheck-scorecard] Device evidence unavailable.', {
          athleteUserId: requestedAthleteId,
          message: error instanceof Error ? error.message : String(error),
        });
        const deviceDateKeys = dateKeys.slice(-DEVICE_EVIDENCE_DAYS);
        return {
          records: [],
          windowDays: deviceDateKeys.length,
          windowDateKeys: deviceDateKeys,
          windowStart: Date.parse(`${deviceDateKeys[0]}T00:00:00.000Z`) / 1000,
          computedAt: Date.now() / 1000,
          evidenceState: 'unavailable' as const,
        };
      }),
    ]);
    const existingScorecard = existingScorecardDocument.data() || {};
    const cachedScorecard = reusableCachedScorecard(
      existingScorecard,
      throughDateKey,
      Date.now(),
      Boolean(staffAccess),
    );
    if (cachedScorecard) {
      return {
        statusCode: 200,
        headers: RESPONSE_HEADERS,
        body: JSON.stringify({
          ok: true,
          scorecard: staffAccess ? cachedScorecard : athleteSafeScorecard(cachedScorecard),
          deviceEvidence,
          cached: true,
          ...(staffAccess ? {
            coachContext: existingScorecard.coachContext,
            accessScope: {
              teamId: requestedTeamId,
              organizationId: staffAccess.organizationId,
              athleteUserId: requestedAthleteId,
            },
          } : {}),
        }),
      };
    }

    const [
      checkIns,
      healthSnapshots,
      wellbeingRecords,
      userDocument,
    ] = await Promise.all([
      getDocumentsById(db, CHECKIN_COLLECTION, checkInIds),
      getDocumentsById(db, HEALTH_COLLECTION, healthIds),
      loadOptionalWellbeingRecords(db, requestedAthleteId),
      db.collection('users').doc(requestedAthleteId).get(),
    ]);
    const whoFive = whoFiveFromRecords(wellbeingRecords, throughDateKey);
    const generatedAt = new Date().toISOString();
    const userData = userDocument.data() || {};
    let accountCreatedAtMillis = timestampMillis(
      userData.createdAt
      ?? userData.joinedAt
      ?? userData.activatedAt,
    );
    if (accountCreatedAtMillis === null) {
      try {
        const authUser = await admin.auth().getUser(requestedAthleteId);
        accountCreatedAtMillis = Date.parse(authUser.metadata.creationTime);
      } catch {
        accountCreatedAtMillis = null;
      }
    }
    const accountCreatedDateKey = accountCreatedAtMillis !== null && Number.isFinite(accountCreatedAtMillis)
      ? dateKeyInTimeZone(new Date(accountCreatedAtMillis), timezone)
      : null;
    const adherenceEligibleAtMillis = timestampMillis(userData.activatedAt ?? userData.joinedAt)
      ?? accountCreatedAtMillis;
    const adherenceEligibleDateKey = adherenceEligibleAtMillis !== null && Number.isFinite(adherenceEligibleAtMillis)
      ? dateKeyInTimeZone(new Date(adherenceEligibleAtMillis), timezone)
      : null;
    const accountAgeDays = accountCreatedDateKey
      ? dayDifferenceFromKeys(throughDateKey, accountCreatedDateKey)
      : null;
    const days = buildScoringDays({
      dateKeys,
      checkIns,
      healthSnapshots,
      eligibleFromDateKey: adherenceEligibleDateKey,
    });
    const establishedCoherenceScore = establishedCoherenceScoreFromDocument(existingScorecard);
    const scorecard = calculatePulseCheckScorecardV2({
      days,
      whoFive,
      generatedAt,
      accountAgeDays,
      establishedCoherenceScore,
    });
    const coachContext = buildCoachContext(scorecard, days);
    try {
      await scorecardReference.set(withoutUndefined({
        ...scorecard,
        athleteUserId: requestedAthleteId,
        throughDateKey,
        timezone,
        coachContext,
        inputEvidence: {
          checkInDocuments: checkIns.length,
          healthSnapshotDocuments: healthSnapshots.length,
          periodicWellbeingDocuments: wellbeingRecords.length,
          accountAgeDays,
          adherenceEligibleFromDateKey: adherenceEligibleDateKey,
          establishedCoherenceScore: establishedCoherenceScore && establishedCoherenceScore > 0
            ? establishedCoherenceScore
            : null,
        },
        computedAt: admin.firestore.FieldValue.serverTimestamp(),
      }) as admin.firestore.DocumentData, { merge: true });
    } catch (error) {
      console.warn('[get-pulsecheck-scorecard] Cache write failed; returning the calculated scorecard.', {
        athleteUserId: requestedAthleteId,
        message: error instanceof Error ? error.message : String(error),
      });
    }

    return {
      statusCode: 200,
      headers: RESPONSE_HEADERS,
      body: JSON.stringify({
        ok: true,
        scorecard: staffAccess ? scorecard : athleteSafeScorecard(scorecard),
        deviceEvidence,
        ...(staffAccess ? {
          coachContext,
          accessScope: {
            teamId: requestedTeamId,
            organizationId: staffAccess.organizationId,
            athleteUserId: requestedAthleteId,
          },
        } : {}),
      }),
    };
  } catch (error) {
    console.error('[get-pulsecheck-scorecard] Failed to calculate scorecard.', error);
    return {
      statusCode: 500,
      headers: RESPONSE_HEADERS,
      body: JSON.stringify({
        error: 'scorecard_failed',
        detail: error instanceof Error ? error.message : String(error),
      }),
    };
  }
};

export const __internal = {
  buildScoringDays,
  athleteSafeScorecard,
  buildCoachContext,
  dateKeyInTimeZone,
  dayDifferenceFromKeys,
  defaultHrvMethod,
  defaultMeasurementWindow,
  establishedCoherenceScoreFromDocument,
  healthDayFromSnapshot,
  mergeDomainData,
  membershipHasCapability,
  membershipIsActive,
  projectMeasuredSourceRecord,
  qualifiedSourceFamily,
  reusableCachedScorecard,
  shiftDateKey,
  withoutUndefined,
  whoFiveFromRecords,
};
