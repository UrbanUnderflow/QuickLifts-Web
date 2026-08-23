import type { Handler } from '@netlify/functions';
import * as admin from 'firebase-admin';
import { getFirestore, initAdmin } from './utils/getServiceAccount';

const RESPONSE_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const HEALTH_COLLECTION = 'health-context-snapshots';
const HEALTH_SOURCE_RECORD_COLLECTION = 'health-context-source-records';
const HEALTH_SOURCE_STATUS_COLLECTION = 'health-context-source-status';
const MAX_OBSERVATIONS = 60;

interface HealthConnectObservation {
  dateKey: string;
  sourcePackage: string;
  observedAt: string;
  freshness: 'fresh' | 'recent' | 'historical_only';
  hrvRmssdMs: number | null;
  hrvMethod: 'rmssd' | null;
  hrvMeasurementWindow: 'spot' | 'overnight' | 'sleep' | null;
  hrvAlgorithmVersion: string | null;
  restingHeartRateBpm: number | null;
  restingHeartRateMeasurementWindow: 'full_day' | 'spot' | 'sleep' | 'overnight' | null;
  restingHeartRateAlgorithmVersion: string | null;
  sleepDurationMinutes: number | null;
  sleepDurationBasis: 'session_window' | null;
  sleepMidpointLocalMinutes: number | null;
  sleepTimingDeviationMinutes: number | null;
}

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

const cleanString = (value: unknown, maxLength = 180): string =>
  typeof value === 'string' ? value.trim().slice(0, maxLength) : '';

const boundedNumber = (value: unknown, minimum: number, maximum: number): number | null => {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) && parsed >= minimum && parsed <= maximum ? parsed : null;
};

const allowedValue = <T extends string>(value: unknown, allowed: readonly T[]): T | null => {
  const normalized = cleanString(value, 40).toLowerCase() as T;
  return allowed.includes(normalized) ? normalized : null;
};

const normalizeObservation = (value: unknown): HealthConnectObservation | null => {
  if (!value || typeof value !== 'object') return null;
  const input = value as Record<string, unknown>;
  const dateKey = cleanString(input.dateKey, 10);
  const observedAt = cleanString(input.observedAt, 40);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey) || !Number.isFinite(Date.parse(observedAt))) return null;
  const sourcePackage = cleanString(input.sourcePackage, 160)
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '') || 'unknown_android_source';
  const freshness = allowedValue(input.freshness, ['fresh', 'recent', 'historical_only'] as const)
    || 'historical_only';
  const hrvRmssdMs = boundedNumber(input.hrvRmssdMs, 1, 500);
  const restingHeartRateBpm = boundedNumber(input.restingHeartRateBpm, 25, 220);
  const sleepDurationMinutes = boundedNumber(input.sleepDurationMinutes, 1, 1_200);
  if (hrvRmssdMs === null && restingHeartRateBpm === null && sleepDurationMinutes === null) return null;
  return {
    dateKey,
    sourcePackage,
    observedAt,
    freshness,
    hrvRmssdMs,
    hrvMethod: hrvRmssdMs === null ? null : 'rmssd',
    hrvMeasurementWindow: hrvRmssdMs === null
      ? null
      : allowedValue(input.hrvMeasurementWindow, ['spot', 'overnight', 'sleep'] as const) || 'spot',
    hrvAlgorithmVersion: hrvRmssdMs === null
      ? null
      : cleanString(input.hrvAlgorithmVersion, 80) || 'health-connect-rmssd-v1',
    restingHeartRateBpm,
    restingHeartRateMeasurementWindow: restingHeartRateBpm === null
      ? null
      : allowedValue(input.restingHeartRateMeasurementWindow, ['full_day', 'spot', 'sleep', 'overnight'] as const)
        || 'full_day',
    restingHeartRateAlgorithmVersion: restingHeartRateBpm === null
      ? null
      : cleanString(input.restingHeartRateAlgorithmVersion, 80) || 'health-connect-rhr-v1',
    sleepDurationMinutes,
    sleepDurationBasis: sleepDurationMinutes === null ? null : 'session_window',
    sleepMidpointLocalMinutes: boundedNumber(input.sleepMidpointLocalMinutes, 0, 1_439),
    sleepTimingDeviationMinutes: boundedNumber(input.sleepTimingDeviationMinutes, 0, 720),
  };
};

const sourceFromSnapshot = (data: Record<string, any>): string =>
  cleanString(data.domains?.recovery?.provenance?.primarySource)
  || cleanString(data.provenance?.domainWinners?.recovery)
  || cleanString(data.recoveryWinner);

const isDirectWearableSource = (source: string): boolean => {
  const normalized = source.toLowerCase();
  if (!normalized || normalized.startsWith('health_connect')) return false;
  return ['whoop', 'oura', 'polar', 'fitbit', 'garmin'].some((name) => normalized.includes(name));
};

const ingestionPlanFor = (previousSource: string) => {
  const preserveExistingSnapshot = isDirectWearableSource(previousSource);
  return {
    writeSourceRecord: true,
    writeSnapshot: !preserveExistingSnapshot,
    linkSourceRecordToExistingSnapshot: preserveExistingSnapshot,
  };
};

const recoveryDataFor = (observation: HealthConnectObservation): Record<string, unknown> => {
  const sourceFamily = 'healthconnect';
  const data: Record<string, unknown> = {
    rawDeviceId: observation.sourcePackage,
    deviceId: observation.sourcePackage,
    sourcePackage: observation.sourcePackage,
    observedAt: observation.observedAt,
  };
  if (observation.hrvRmssdMs !== null) {
    Object.assign(data, {
      heartRateVariability: observation.hrvRmssdMs,
      hrvMs: observation.hrvRmssdMs,
      rmssdMs: observation.hrvRmssdMs,
      heartRateVariabilityMethod: observation.hrvMethod,
      hrvMethod: observation.hrvMethod,
      heartRateVariabilityMeasurementWindow: observation.hrvMeasurementWindow,
      hrvMeasurementWindow: observation.hrvMeasurementWindow,
      heartRateVariabilityAlgorithmVersion: observation.hrvAlgorithmVersion,
    });
  }
  if (observation.restingHeartRateBpm !== null) {
    Object.assign(data, {
      heartRateResting: observation.restingHeartRateBpm,
      restingHeartRate: observation.restingHeartRateBpm,
      restingHeartRateBpm: observation.restingHeartRateBpm,
      restingHeartRateMeasurementWindow: observation.restingHeartRateMeasurementWindow,
      restingHeartRateAlgorithmVersion: observation.restingHeartRateAlgorithmVersion,
    });
  }
  if (observation.sleepDurationMinutes !== null) {
    Object.assign(data, {
      totalSleepMin: observation.sleepDurationMinutes,
      totalSleepMinutes: observation.sleepDurationMinutes,
      sleepDurationBasis: observation.sleepDurationBasis,
      sleepMidpointLocalMinutes: observation.sleepMidpointLocalMinutes,
      sleepMidpointShiftMinutes: observation.sleepTimingDeviationMinutes,
    });
  }
  const measuredFields = Object.keys(data).filter((key) => ![
    'rawDeviceId',
    'deviceId',
    'sourcePackage',
    'observedAt',
  ].includes(key));
  data.fieldSources = Object.fromEntries(measuredFields.map((key) => [key, sourceFamily]));
  data.fieldSourceLabels = Object.fromEntries(measuredFields.map((key) => [key, 'Health Connect']));
  return data;
};

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: RESPONSE_HEADERS, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: RESPONSE_HEADERS, body: JSON.stringify({ error: 'method_not_allowed' }) };
  }
  await initAdmin();
  const auth = await verifyAuth(event.headers?.authorization || event.headers?.Authorization);
  if (!auth) {
    return { statusCode: 401, headers: RESPONSE_HEADERS, body: JSON.stringify({ error: 'unauthenticated' }) };
  }
  let body: Record<string, unknown>;
  try {
    body = typeof event.body === 'string' && event.body ? JSON.parse(event.body) : {};
  } catch {
    return { statusCode: 400, headers: RESPONSE_HEADERS, body: JSON.stringify({ error: 'invalid_json' }) };
  }
  const rawObservations = Array.isArray(body.observations) ? body.observations.slice(0, MAX_OBSERVATIONS) : [];
  const observations = rawObservations.map(normalizeObservation).filter((item): item is HealthConnectObservation => Boolean(item));
  if (observations.length === 0) {
    return { statusCode: 400, headers: RESPONSE_HEADERS, body: JSON.stringify({ error: 'no_valid_observations' }) };
  }

  const db = await getFirestore();
  let written = 0;
  let preservedDirectSource = 0;
  const acknowledgedDateKeys: string[] = [];
  const writtenSnapshotDateKeys: string[] = [];
  const preservedDirectSourceDateKeys: string[] = [];
  const batch = db.batch();
  for (const observation of observations) {
    const reference = db.collection(HEALTH_COLLECTION).doc(`${auth.uid}_daily_${observation.dateKey}`);
    const existing = await reference.get();
    const existingData = existing.data() || {};
    const previousSource = sourceFromSnapshot(existingData);
    const ingestionPlan = ingestionPlanFor(previousSource);
    const sourceFamily = `health_connect:${observation.sourcePackage}`;
    const sourceRecordId = `${auth.uid}_healthconnect_recovery_${observation.dateKey}`;
    const recoveryData = recoveryDataFor(observation);
    const transition = previousSource && previousSource !== sourceFamily
      ? { from: previousSource, to: sourceFamily, observedAt: observation.observedAt }
      : null;
    if (ingestionPlan.writeSourceRecord) batch.set(db.collection(HEALTH_SOURCE_RECORD_COLLECTION).doc(sourceRecordId), {
      id: sourceRecordId,
      athleteUserId: auth.uid,
      sourceFamily: 'healthconnect',
      sourceType: 'healthconnect_recovery',
      recordType: 'summary_input',
      domain: 'recovery',
      observedAt: new Date(observation.observedAt),
      ingestedAt: admin.firestore.FieldValue.serverTimestamp(),
      timezone: cleanString(body.timezone, 80) || 'UTC',
      status: 'active',
      dedupeKey: `${auth.uid}|health_connect|recovery|${observation.dateKey}`,
      payloadVersion: 'health-connect-recovery-v1',
      payload: recoveryData,
      sourceMetadata: {
        sourcePackage: observation.sourcePackage,
        transport: 'health_connect',
        writer: 'ingest-health-connect-recovery',
      },
      provenance: {
        mode: 'direct',
        sourceSystem: sourceFamily,
        writer: 'PulseCheck Android',
      },
    }, { merge: true });
    if (!ingestionPlan.writeSnapshot) {
      if (ingestionPlan.linkSourceRecordToExistingSnapshot) {
        batch.set(reference, {
          provenance: {
            sourceRecordIds: admin.firestore.FieldValue.arrayUnion(sourceRecordId),
            sourcesUsed: admin.firestore.FieldValue.arrayUnion(sourceFamily),
          },
          sourceStatus: {
            healthconnect: {
              sourceFamily: 'healthconnect',
              lifecycleState: 'connected_synced',
              lastObservedRecordAt: observation.observedAt,
            },
          },
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
      }
      preservedDirectSource += 1;
      acknowledgedDateKeys.push(observation.dateKey);
      preservedDirectSourceDateKeys.push(observation.dateKey);
      continue;
    }
    batch.set(reference, {
      id: `${auth.uid}_daily_${observation.dateKey}`,
      userId: auth.uid,
      athleteUserId: auth.uid,
      snapshotType: 'daily',
      snapshotDateKey: observation.dateKey,
      snapshotDate: observation.dateKey,
      payloadVersion: 'health-connect-recovery-v1',
      domains: {
        recovery: {
          data: recoveryData,
          freshness: observation.freshness,
          provenance: {
            primarySource: sourceFamily,
            observedAt: observation.observedAt,
            transport: 'health_connect',
          },
        },
      },
      provenance: {
        domainWinners: { recovery: sourceFamily },
        sourcesUsed: [sourceFamily],
        sourceRecordIds: [sourceRecordId],
      },
      freshness: {
        overall: observation.freshness,
        recovery: observation.freshness,
        perDomain: { recovery: observation.freshness },
        evaluatedAt: observation.observedAt,
      },
      sourceWindow: {
        timezone: cleanString(body.timezone, 80) || 'UTC',
        windowType: 'daily',
      },
      sourceStatus: {
        healthconnect: {
          sourceFamily: 'healthconnect',
          lifecycleState: 'connected_synced',
          lastObservedRecordAt: observation.observedAt,
        },
      },
      recoveryWinner: sourceFamily,
      lastObservedRecordAt: observation.observedAt,
      ...(transition ? { latestRecoverySourceTransition: transition } : {}),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    written += 1;
    acknowledgedDateKeys.push(observation.dateKey);
    writtenSnapshotDateKeys.push(observation.dateKey);
  }
  const newestObservation = observations.reduce((latest, observation) =>
    Date.parse(observation.observedAt) > Date.parse(latest.observedAt) ? observation : latest);
  const statusId = `${auth.uid}_healthconnect`;
  batch.set(db.collection(HEALTH_SOURCE_STATUS_COLLECTION).doc(statusId), {
    id: statusId,
    userId: auth.uid,
    athleteUserId: auth.uid,
    sourceFamily: 'healthconnect',
    family: 'healthconnect',
    transport: 'health_connect',
    platform: 'android',
    lifecycleState: 'connected_synced',
    status: 'connected_synced',
    lastObservedRecordAt: new Date(newestObservation.observedAt),
    lastSuccessfulSyncAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });
  await batch.commit();
  return {
    statusCode: 200,
    headers: RESPONSE_HEADERS,
    body: JSON.stringify({
      ok: true,
      received: observations.length,
      written,
      preservedDirectSource,
      acknowledgedDateKeys: Array.from(new Set(acknowledgedDateKeys)).sort(),
      writtenSnapshotDateKeys: Array.from(new Set(writtenSnapshotDateKeys)).sort(),
      preservedDirectSourceDateKeys: Array.from(new Set(preservedDirectSourceDateKeys)).sort(),
    }),
  };
};

export const __internal = {
  ingestionPlanFor,
  isDirectWearableSource,
  normalizeObservation,
  recoveryDataFor,
  sourceFromSnapshot,
};
