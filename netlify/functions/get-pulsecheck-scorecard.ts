import type { Handler } from '@netlify/functions';
import * as admin from 'firebase-admin';
import { getFirestore, initAdmin } from './utils/getServiceAccount';
import {
  calculatePulseCheckScorecardV2,
  PULSECHECK_SCORING_VERSION,
  type PulseCheckAutonomicMeasurement,
  type PulseCheckCommitmentSignal,
  type PulseCheckCommitmentState,
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
const ASSIGNMENT_COLLECTION = 'pulsecheck-daily-assignments';
const HEALTH_COLLECTION = 'health-context-snapshots';
const WELLBEING_COLLECTION = 'pulsecheck-wellbeing-assessments';
const SCORE_INPUT_DAYS = 60;

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

const booleanValue = (value: unknown): boolean | null =>
  typeof value === 'boolean' ? value : null;

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

const commitmentStateFrom = (data: Record<string, any>): PulseCheckCommitmentState => {
  const explicit = cleanString(data.commitmentOutcomeState || data.adherenceState).toLowerCase();
  const valid: PulseCheckCommitmentState[] = [
    'accepted',
    'replacement_accepted',
    'completed',
    'planned_rest',
    'rest_over_plan',
    'missed',
    'coach_excused',
    'technical_failure',
    'no_assignment',
  ];
  if (valid.includes(explicit as PulseCheckCommitmentState)) return explicit as PulseCheckCommitmentState;
  const status = cleanString(data.status).toLowerCase();
  if (status === 'completed' || data.completedAt != null) return 'completed';
  if (['expired', 'missed', 'skipped'].includes(status)) return 'missed';
  if (['superseded', 'overridden'].includes(status) && Number(data.revision || 1) > 1) return 'replacement_accepted';
  if (['assigned', 'viewed', 'started', 'paused'].includes(status)) {
    return Number(data.revision || 1) > 1 ? 'replacement_accepted' : 'accepted';
  }
  return 'no_assignment';
};

const commitmentFromAssignment = (data: Record<string, any>): PulseCheckCommitmentSignal | null => {
  const actionType = cleanString(data.actionType).toLowerCase().replace(/-/g, '_');
  if (actionType === 'check_in' || actionType === 'checkin') return null;
  const state = commitmentStateFrom(data);
  if (state === 'no_assignment' && !cleanString(data.id)) return null;
  return {
    state,
    commitmentId: cleanString(data.id || data.assignmentId) || null,
    replacementForCommitmentId: cleanString(
      data.replacementForCommitmentId || data.supersedesDailyTaskId || data.lineageId,
    ) || null,
    plannedRestWithinPlan: booleanValue(data.plannedRestWithinPlan),
    weeklyFollowThroughMet: booleanValue(data.weeklyFollowThroughMet),
  };
};

const latestAssignmentsByDay = (records: FirestoreRecord[]): Map<string, PulseCheckCommitmentSignal> => {
  const byLineage = new Map<string, FirestoreRecord>();
  for (const record of records) {
    const dateKey = cleanString(record.data.sourceDate || record.data.dateKey);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) continue;
    const lineage = cleanString(record.data.lineageId) || record.id;
    const key = `${dateKey}|${lineage}`;
    const current = byLineage.get(key);
    if (!current || Number(record.data.revision || 1) >= Number(current.data.revision || 1)) {
      byLineage.set(key, { id: record.id, data: { ...record.data, id: record.id } });
    }
  }
  const byDay = new Map<string, PulseCheckCommitmentSignal>();
  for (const record of byLineage.values()) {
    const dateKey = cleanString(record.data.sourceDate || record.data.dateKey);
    const commitment = commitmentFromAssignment(record.data);
    if (!commitment) continue;
    const current = byDay.get(dateKey);
    if (!current || current.state === 'no_assignment') byDay.set(dateKey, commitment);
  }
  return byDay;
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
  assignments: FirestoreRecord[];
  healthSnapshots: FirestoreRecord[];
}): PulseCheckScoringDay[] => {
  const checkInsByDate = new Map<string, Record<string, any>>();
  for (const record of input.checkIns) {
    const dateKey = cleanString(record.data.dayKey || record.data.date || record.data.sourceDate)
      || record.id.match(/(\d{4}-\d{2}-\d{2})$/)?.[1]
      || '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) checkInsByDate.set(dateKey, record.data);
  }
  const assignmentsByDate = latestAssignmentsByDay(input.assignments);
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
      scheduledCheckIn: true,
      wellbeingLevel: checkIn.level ?? checkIn.readinessLevel ?? null,
      subjectiveRecoveryLevel:
        checkIn.subjectiveRecoveryLevel
        ?? checkIn.recoveryLevel
        ?? checkIn.recovery?.level
        ?? null,
      commitment: assignmentsByDate.get(dateKey) || null,
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

  try {
    const [checkIns, healthSnapshots, assignmentSnapshot, wellbeingRecords] = await Promise.all([
      getDocumentsById(db, CHECKIN_COLLECTION, checkInIds),
      getDocumentsById(db, HEALTH_COLLECTION, healthIds),
      db.collection(ASSIGNMENT_COLLECTION).where('athleteId', '==', requestedAthleteId).get(),
      loadOptionalWellbeingRecords(db, requestedAthleteId),
    ]);
    const assignments = assignmentSnapshot.docs.map((document) => ({
      id: document.id,
      data: document.data() || {},
    }));
    const days = buildScoringDays({ dateKeys, checkIns, assignments, healthSnapshots });
    const whoFive = whoFiveFromRecords(wellbeingRecords, throughDateKey);
    const generatedAt = new Date().toISOString();
    const scorecard = calculatePulseCheckScorecardV2({
      days,
      whoFive,
      generatedAt,
    });
    const documentId = `${requestedAthleteId}_v${PULSECHECK_SCORING_VERSION.split('.')[0]}`;
    await db.collection(SCORECARD_COLLECTION).doc(documentId).set({
      ...scorecard,
      athleteUserId: requestedAthleteId,
      throughDateKey,
      timezone,
      inputEvidence: {
        checkInDocuments: checkIns.length,
        assignmentDocuments: assignments.length,
        healthSnapshotDocuments: healthSnapshots.length,
        periodicWellbeingDocuments: wellbeingRecords.length,
      },
      computedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    return {
      statusCode: 200,
      headers: RESPONSE_HEADERS,
      body: JSON.stringify({
        ok: true,
        scorecard: staffAccess ? scorecard : athleteSafeScorecard(scorecard),
        ...(staffAccess ? {
          coachContext: buildCoachContext(scorecard, days),
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
  commitmentFromAssignment,
  commitmentStateFrom,
  dateKeyInTimeZone,
  defaultHrvMethod,
  defaultMeasurementWindow,
  healthDayFromSnapshot,
  latestAssignmentsByDay,
  mergeDomainData,
  membershipHasCapability,
  membershipIsActive,
  shiftDateKey,
  whoFiveFromRecords,
};
