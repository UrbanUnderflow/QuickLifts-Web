import type { Handler } from '@netlify/functions';
import * as admin from 'firebase-admin';
import { getFirestore, initAdmin } from './utils/getServiceAccount';
import {
  classifySleepSelfReportAlignment,
  extractSleepObjectiveSignals,
  type SignalAlignmentClassification,
  type SleepReportDirection,
} from '../../src/api/firebase/mentaltraining/checkInSignalAlignment';

const RESPONSE_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const VALID_LEVELS = new Set(['drained', 'low', 'okay', 'solid', 'locked']);
const CLASSIFICATIONS: SignalAlignmentClassification[] = [
  'aligned',
  'not_aligned',
  'mixed',
  'insufficient_data',
];

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

const formatYmdInTz = (date: Date, timeZone: string): string => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value || '';
  return `${value('year')}-${value('month')}-${value('day')}`;
};

const shiftDayKey = (dayKey: string, days: number): string => {
  const date = new Date(`${dayKey}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

const reportDirection = (level: string, reason: string): SleepReportDirection | null => {
  if (reason === 'Good sleep' && (level === 'solid' || level === 'locked')) return 'positive';
  if (reason === 'Sleep' && (level === 'drained' || level === 'low')) return 'negative';
  return null;
};

const mergeDomainData = (block: unknown): Record<string, unknown> => {
  if (!block || typeof block !== 'object') return {};
  const source = block as Record<string, unknown>;
  const nested = source.data && typeof source.data === 'object'
    ? (source.data as Record<string, unknown>)
    : {};
  const metadata = new Set(['data', 'freshness', 'provenance', 'sourceStatus', 'generatedAt', 'updatedAt']);
  const direct = Object.fromEntries(Object.entries(source).filter(([key]) => !metadata.has(key)));
  return { ...direct, ...nested };
};

const snapshotFreshness = (snapshot: Record<string, any>): string => (
  snapshot.domains?.recovery?.freshness
  || snapshot.freshness?.perDomain?.recovery
  || snapshot.freshness?.recovery
  || 'unknown'
);

const loadRecoverySnapshot = async (
  db: admin.firestore.Firestore,
  uid: string,
  dayKey: string,
  personalBaselineHours?: number,
) => {
  for (const offset of [0, -1, -2]) {
    const candidateDay = shiftDayKey(dayKey, offset);
    const ref = db.collection('health-context-snapshots').doc(`${uid}_daily_${candidateDay}`);
    const snapshot = await ref.get();
    if (!snapshot.exists) continue;
    const data = snapshot.data() as Record<string, any>;
    const recovery = mergeDomainData(data.domains?.recovery);
    const signals = extractSleepObjectiveSignals(recovery, personalBaselineHours);
    const hasSleepEvidence = [
      signals.sleepDurationHours,
      signals.sleepEfficiencyPct,
      signals.sleepScore,
      signals.recoveryScore,
      signals.readinessScore,
    ].some((value) => value !== undefined);
    if (!hasSleepEvidence) continue;
    return {
      snapshotId: snapshot.id,
      snapshotDateKey: data.snapshotDateKey || data.snapshotDate || candidateDay,
      snapshotRevision: data.revision || null,
      freshness: snapshotFreshness(data),
      sourceFamily: data.domains?.recovery?.provenance?.primarySource || null,
      signals,
    };
  }
  return null;
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

  let body: Record<string, unknown>;
  try {
    body = typeof event.body === 'string' ? JSON.parse(event.body) : (event.body as Record<string, unknown>) || {};
  } catch {
    return { statusCode: 400, headers: RESPONSE_HEADERS, body: JSON.stringify({ error: 'invalid_json' }) };
  }

  const period = String(body.period || '').trim().toLowerCase();
  const level = String(body.level || '').trim().toLowerCase();
  const reason = String(body.reason || '').trim();
  const direction = period === 'morning' && VALID_LEVELS.has(level) ? reportDirection(level, reason) : null;
  if (!direction) {
    return { statusCode: 200, headers: RESPONSE_HEADERS, body: JSON.stringify({ ok: true, recorded: false }) };
  }

  let timezone = typeof body.timezone === 'string' && body.timezone ? body.timezone : 'America/New_York';
  try {
    const membership = await db
      .collection('pulsecheck-team-memberships')
      .where('userId', '==', auth.uid)
      .where('role', '==', 'athlete')
      .limit(1)
      .get();
    if (!body.timezone && !membership.empty && membership.docs[0].data().timezone) {
      timezone = String(membership.docs[0].data().timezone);
    }
  } catch {
    // The athlete's device timezone remains a valid fallback.
  }

  const dayKey = formatYmdInTz(new Date(), timezone);
  try {
    const baselineSnapshot = await db.collection('users').doc(auth.uid)
      .collection('personalBaselines').doc('sleep').get();
    const baselineData = baselineSnapshot.data() || {};
    const personalBaselineHours = typeof baselineData.hours === 'number' ? baselineData.hours : undefined;
    const recoverySnapshot = await loadRecoverySnapshot(db, auth.uid, dayKey, personalBaselineHours);
    const freshnessAllowsComparison = recoverySnapshot
      && ['fresh', 'recent'].includes(recoverySnapshot.freshness);
    const result = freshnessAllowsComparison
      ? classifySleepSelfReportAlignment(direction, recoverySnapshot.signals)
      : {
          classification: 'insufficient_data' as const,
          favorableSignals: [],
          unfavorableSignals: [],
          observedSignals: recoverySnapshot ? Object.keys(recoverySnapshot.signals) : [],
          confidence: 'degraded' as const,
          ruleVersion: 'sleep_self_report_alignment_v1' as const,
        };

    const recordId = `${dayKey}_morning_sleep`;
    const rootRef = db.collection('athlete-state-signal-alignments').doc(auth.uid);
    const recordRef = rootRef.collection('records').doc(recordId);
    const checkInRef = db.collection('pulsecheck-morning-checkins').doc(`${auth.uid}_${dayKey}`);
    const now = Date.now();

    await db.runTransaction(async (transaction) => {
      const previousSnapshot = await transaction.get(recordRef);
      const previous = previousSnapshot.data() || {};
      const previousClassification = previous.comparison?.classification as SignalAlignmentClassification | undefined;
      const isNew = !previousSnapshot.exists;

      transaction.set(recordRef, {
        recordId,
        athleteId: auth.uid,
        athleteLocalDate: dayKey,
        period: 'morning',
        domain: 'sleep',
        selfReport: {
          level,
          reason,
          direction,
          checkInRef: checkInRef.path,
        },
        objectiveEvidence: recoverySnapshot
          ? {
              status: freshnessAllowsComparison ? 'usable' : 'not_current_enough',
              snapshotId: recoverySnapshot.snapshotId,
              snapshotDateKey: recoverySnapshot.snapshotDateKey,
              snapshotRevision: recoverySnapshot.snapshotRevision,
              freshness: recoverySnapshot.freshness,
              sourceFamily: recoverySnapshot.sourceFamily,
              measurements: recoverySnapshot.signals,
            }
          : { status: 'missing' },
        comparison: result,
        createdAt: previous.createdAt || now,
        updatedAt: now,
      }, { merge: true });

      const classificationIncrements = Object.fromEntries(CLASSIFICATIONS.map((classification) => {
        let delta = 0;
        if (isNew && classification === result.classification) delta = 1;
        else if (!isNew && previousClassification !== result.classification) {
          if (classification === previousClassification) delta = -1;
          if (classification === result.classification) delta = 1;
        }
        return [classification, admin.firestore.FieldValue.increment(delta)];
      }));
      transaction.set(rootRef, {
        athleteId: auth.uid,
        updatedAt: now,
        domains: {
          sleep: {
            totalRecords: admin.firestore.FieldValue.increment(isNew ? 1 : 0),
            classifications: classificationIncrements,
            lastRecordId: recordId,
            lastClassification: result.classification,
            lastComparedAt: now,
          },
        },
      }, { merge: true });

      transaction.set(checkInRef, {
        signalValidation: {
          sleep: {
            recordId,
            classification: result.classification,
            confidence: result.confidence,
            ruleVersion: result.ruleVersion,
            updatedAt: now,
          },
        },
      }, { merge: true });
    });

    await db.collection('users').doc(auth.uid)
      .collection('biomarkerContext').doc(dayKey).set({
        userId: auth.uid,
        dayKey,
        sleepRestedness: direction === 'positive' ? 'well-rested' : 'not-rested',
        sleepRestednessSource: 'junior_morning_checkin',
        sleepRestednessUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });

    return {
      statusCode: 200,
      headers: RESPONSE_HEADERS,
      body: JSON.stringify({ ok: true, recorded: true, recordId }),
    };
  } catch (error: any) {
    return {
      statusCode: 500,
      headers: RESPONSE_HEADERS,
      body: JSON.stringify({ error: 'alignment_record_failed', detail: error?.message || String(error) }),
    };
  }
};

export const __internal = {
  formatYmdInTz,
  mergeDomainData,
  reportDirection,
  shiftDayKey,
  snapshotFreshness,
};
