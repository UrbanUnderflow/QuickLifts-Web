// =============================================================================
// Athlete Self-Report — fills biometric gaps for athletes without a
// performance device.
//
// When an athlete has no connected wearable (Apple Watch, Oura, etc.),
// Nora asks 4–6 lightweight subjective questions per check-in. Answers
// are normalized into the same Health Context Source Record shape an
// adapter would write, with `source: 'pulsecheck_self_report'` and a
// confidence cap of `emerging` per the spec rule:
//
//   "Self-reported only → allowed for context, cannot drive high-trust
//    coach recommendation."
//
// What Nora asks (and CAN reasonably extract):
//   - Sleep quality + duration (rough sleepEfficiency)
//   - Energy / readiness (subjective readiness)
//   - Soreness (per region or overall)
//   - Stress level
//   - Perceived effort from yesterday's training (sessionRpe)
//   - Hydration / fueling status
//
// What Nora does NOT ask (cannot self-report meaningfully):
//   - HRV (rmssdMs)
//   - Resting heart rate
//   - Detailed sleep stages (deep/REM minutes)
//   - GPS distance, sprint count, jump count, contact load
// =============================================================================

import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import { db } from './config';
import type { DataConfidence, FreshnessTier, SnapshotSourceId, SourceStatus } from './athleteContextSnapshot';
import { upsertHealthContextSourceRecord } from './healthContextSourceRecord';

// ──────────────────────────────────────────────────────────────────────────────
// Question schema
// ──────────────────────────────────────────────────────────────────────────────

export type SelfReportQuestionId =
  | 'sleep_quality'
  | 'sleep_duration_hours'
  | 'energy_level'
  | 'soreness_overall'
  | 'stress_level'
  | 'perceived_rpe_yesterday'
  | 'hydration_state'
  | 'fueling_state';

export type SelfReportQuestionScale = '1_to_5' | '1_to_10' | 'hours' | 'enum';

export interface SelfReportQuestion {
  id: SelfReportQuestionId;
  /** Coach-voice prompt Nora asks. */
  prompt: string;
  /** Plain-English label used in UI surfaces (reviewer screen, archive). */
  label: string;
  scale: SelfReportQuestionScale;
  /** Min/max for numeric scales. */
  min?: number;
  max?: number;
  /** Allowed values for enum scale. */
  options?: Array<{ value: string; label: string }>;
  /** Which HCSR domain this question informs. */
  targetDomain: 'recovery' | 'behavioral' | 'training' | 'nutrition';
  /** Whether to include this question every check-in or only when device data is missing. */
  cadence: 'every_checkin' | 'when_device_missing' | 'weekly';
}

/**
 * The canonical question set Nora draws from. Sequencing + which subset
 * is asked on a given day is the chat layer's responsibility — this file
 * just defines the contract.
 */
export const SELF_REPORT_QUESTIONS: SelfReportQuestion[] = [
  {
    id: 'sleep_quality',
    prompt: 'How did you sleep? 1 (rough) to 5 (great).',
    label: 'Sleep quality',
    scale: '1_to_5',
    min: 1,
    max: 5,
    targetDomain: 'recovery',
    cadence: 'when_device_missing',
  },
  {
    id: 'sleep_duration_hours',
    prompt: 'How many hours did you actually sleep last night?',
    label: 'Sleep duration',
    scale: 'hours',
    min: 0,
    max: 14,
    targetDomain: 'recovery',
    cadence: 'when_device_missing',
  },
  {
    id: 'energy_level',
    prompt: 'How would you rate your energy this morning? 1 (drained) to 5 (sharp).',
    label: 'Energy / readiness',
    scale: '1_to_5',
    min: 1,
    max: 5,
    targetDomain: 'behavioral',
    cadence: 'every_checkin',
  },
  {
    id: 'soreness_overall',
    prompt: 'Overall soreness right now? 1 (none) to 5 (heavy).',
    label: 'Soreness',
    scale: '1_to_5',
    min: 1,
    max: 5,
    targetDomain: 'recovery',
    cadence: 'every_checkin',
  },
  {
    id: 'stress_level',
    prompt: 'Stress level the last 24 hours? 1 (calm) to 5 (cooked).',
    label: 'Stress',
    scale: '1_to_5',
    min: 1,
    max: 5,
    targetDomain: 'behavioral',
    cadence: 'every_checkin',
  },
  {
    id: 'perceived_rpe_yesterday',
    prompt: 'How hard did yesterday\'s training feel? 1 (easy) to 10 (max).',
    label: 'Perceived RPE',
    scale: '1_to_10',
    min: 1,
    max: 10,
    targetDomain: 'training',
    cadence: 'every_checkin',
  },
  {
    id: 'hydration_state',
    prompt: 'How is your hydration today?',
    label: 'Hydration',
    scale: 'enum',
    options: [
      { value: 'low', label: 'Low — playing catch-up' },
      { value: 'okay', label: 'Okay — on plan' },
      { value: 'strong', label: 'Strong — well hydrated' },
    ],
    targetDomain: 'nutrition',
    cadence: 'when_device_missing',
  },
  {
    id: 'fueling_state',
    prompt: 'Have you been eating enough to fuel your training?',
    label: 'Fueling',
    scale: 'enum',
    options: [
      { value: 'under', label: 'Under — skipping meals' },
      { value: 'on_plan', label: 'On plan — fueling well' },
      { value: 'over', label: 'Over — eating heavier than planned' },
    ],
    targetDomain: 'nutrition',
    cadence: 'weekly',
  },
];

export const getSelfReportQuestion = (id: SelfReportQuestionId): SelfReportQuestion | undefined =>
  SELF_REPORT_QUESTIONS.find((q) => q.id === id);

export const pickSelfReportQuestionsForCheckin = (
  options: { hasConnectedWearable: boolean; weekly?: boolean },
): SelfReportQuestion[] =>
  SELF_REPORT_QUESTIONS.filter((q) => {
    if (q.cadence === 'every_checkin') return true;
    if (q.cadence === 'when_device_missing') return !options.hasConnectedWearable;
    if (q.cadence === 'weekly') return Boolean(options.weekly);
    return false;
  });

// ──────────────────────────────────────────────────────────────────────────────
// Submission shape + ingestion
// ──────────────────────────────────────────────────────────────────────────────

export interface SelfReportAnswer {
  questionId: SelfReportQuestionId;
  /** Numeric value for scaled questions. */
  numericValue?: number;
  /** Enum value for enum-scale questions. */
  enumValue?: string;
  /** Free-text follow-up (optional). */
  notes?: string;
}

export interface SelfReportSubmissionInput {
  athleteUserId: string;
  /** YYYY-MM-DD athlete-local. The day this submission describes. */
  observationDate: string;
  /** Why this self-report is happening — informs confidence + cadence. */
  trigger: 'nora_checkin' | 'manual_entry' | 'reviewer_seeded';
  /** Whether the athlete had a connected wearable at the time of submission. */
  hasConnectedWearable: boolean;
  answers: SelfReportAnswer[];
}

export interface SelfReportRecord {
  recordId: string;
  athleteUserId: string;
  observationDate: string;
  submittedAt: string;
  source: SnapshotSourceId; // always 'pulsecheck_self_report'
  trigger: SelfReportSubmissionInput['trigger'];
  hasConnectedWearable: boolean;
  answers: SelfReportAnswer[];
  /** Confidence floor enforced on this submission per spec. */
  confidenceCap: DataConfidence;
  /** Normalized HCSR-shaped fields the inference engine can read directly. */
  derivedSignals: SelfReportDerivedSignals;
}

export interface SelfReportDerivedSignals {
  /** 0–1 sleep efficiency proxy (rough — never high confidence). */
  sleepEfficiencyProxy?: number;
  totalSleepMinProxy?: number;
  /** 0–100 readiness proxy. */
  readinessScoreProxy?: number;
  /** 1–10 perceived effort. */
  sessionRpe?: number;
  /** 1–5 soreness. */
  sorenessScore?: number;
  /** 1–5 stress. */
  stressScore?: number;
  hydrationLabel?: 'low' | 'okay' | 'strong';
  fuelingLabel?: 'under' | 'on_plan' | 'over';
  /** Domain-level freshness tag for use by the snapshot assembler. */
  freshness: FreshnessTier;
  /** Source-status label that the snapshot assembler will fold into the
   * recovery / behavioral / nutrition source-status maps. */
  sourceStatus: SourceStatus;
}

const SELF_REPORTS_COLLECTION = 'health-context-self-reports';

const requireString = (value: unknown, label: string): string => {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized) {
    throw new Error(`[AthleteSelfReport] ${label} is required.`);
  }
  return normalized;
};

const clampNumber = (value: number | undefined, min: number, max: number): number | undefined => {
  if (value === undefined || !Number.isFinite(value)) return undefined;
  return Math.max(min, Math.min(max, value));
};

const buildRecordId = (athleteUserId: string, observationDate: string, submittedAtIso: string) => {
  const ms = new Date(submittedAtIso).getTime() || Date.now();
  return `${athleteUserId}__${observationDate}__${ms}`;
};

/**
 * Compute derived HCSR-shaped signals from raw answers. This is where
 * subjective scales become best-effort proxies for the canonical fields
 * the inference engine reads. Confidence is capped at `emerging` so
 * downstream consumers know to hedge their language.
 */
export const computeSelfReportDerivedSignals = (
  input: SelfReportSubmissionInput,
): SelfReportDerivedSignals => {
  const answersById = new Map<SelfReportQuestionId, SelfReportAnswer>();
  for (const answer of input.answers) {
    answersById.set(answer.questionId, answer);
  }

  const sleepQuality = answersById.get('sleep_quality')?.numericValue;
  const sleepHours = answersById.get('sleep_duration_hours')?.numericValue;
  const energy = answersById.get('energy_level')?.numericValue;
  const soreness = answersById.get('soreness_overall')?.numericValue;
  const stress = answersById.get('stress_level')?.numericValue;
  const perceivedRpe = answersById.get('perceived_rpe_yesterday')?.numericValue;
  const hydration = answersById.get('hydration_state')?.enumValue;
  const fueling = answersById.get('fueling_state')?.enumValue;

  const sleepEfficiencyProxy =
    sleepQuality !== undefined ? clampNumber((sleepQuality - 1) / 4, 0, 1) : undefined;
  const totalSleepMinProxy = sleepHours !== undefined ? Math.round((sleepHours || 0) * 60) : undefined;
  const readinessScoreProxy =
    energy !== undefined ? clampNumber(((energy - 1) / 4) * 100, 0, 100) : undefined;

  const hasAnyData = input.answers.some((answer) => answer.numericValue !== undefined || answer.enumValue);

  return {
    sleepEfficiencyProxy,
    totalSleepMinProxy,
    readinessScoreProxy,
    sessionRpe: clampNumber(perceivedRpe, 1, 10),
    sorenessScore: clampNumber(soreness, 1, 5),
    stressScore: clampNumber(stress, 1, 5),
    hydrationLabel: hydration === 'low' || hydration === 'okay' || hydration === 'strong' ? hydration : undefined,
    fuelingLabel: fueling === 'under' || fueling === 'on_plan' || fueling === 'over' ? fueling : undefined,
    freshness: hasAnyData ? 'fresh' : 'missing',
    sourceStatus: hasAnyData ? 'connected_synced' : 'connected_waiting_for_data',
  };
};

/**
 * Persist a self-report submission. Idempotent at the per-record level
 * because record ids include the submission timestamp.
 *
 * Side effect: writes canonical Health Context Source Records so the
 * snapshot assembler can read self-report alongside Oura/HealthKit
 * data. Two records get written when the answers cover them: one for
 * the recovery domain (sleep + soreness) and one for the behavioral
 * domain (energy + stress + RPE). Provenance is `self_reported` and
 * confidence labels honor the spec cap.
 */
export const ingestSelfReportSubmission = async (
  input: SelfReportSubmissionInput,
): Promise<SelfReportRecord> => {
  const athleteUserId = requireString(input.athleteUserId, 'athleteUserId');
  const observationDate = requireString(input.observationDate, 'observationDate');
  const submittedAt = new Date().toISOString();
  const recordId = buildRecordId(athleteUserId, observationDate, submittedAt);
  const derivedSignals = computeSelfReportDerivedSignals(input);

  // Spec rule: self-reported data may not exceed `emerging` confidence.
  const confidenceCap: DataConfidence = input.hasConnectedWearable ? 'directional' : 'emerging';

  const record: SelfReportRecord = {
    recordId,
    athleteUserId,
    observationDate,
    submittedAt,
    source: 'pulsecheck_self_report',
    trigger: input.trigger,
    hasConnectedWearable: input.hasConnectedWearable,
    answers: input.answers,
    confidenceCap,
    derivedSignals,
  };

  await setDoc(
    doc(db, 'athletes', athleteUserId, SELF_REPORTS_COLLECTION, recordId),
    {
      ...record,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: false },
  );

  // Side effect: write canonical Health Context Source Records so the
  // snapshot assembler treats self-report as a first-class lane.
  await writeSelfReportSourceRecords({
    athleteUserId,
    observationDate,
    submittedAtIso: submittedAt,
    derivedSignals,
    confidenceCap,
    answers: input.answers,
  });

  return record;
};

const SELF_REPORT_TIMEZONE_FALLBACK = 'UTC';

const buildDayWindowSeconds = (observationDate: string): { startSec: number; endSec: number } => {
  const start = new Date(`${observationDate}T00:00:00Z`).getTime();
  const end = new Date(`${observationDate}T23:59:59Z`).getTime();
  return {
    startSec: Math.round((Number.isFinite(start) ? start : Date.now()) / 1000),
    endSec: Math.round((Number.isFinite(end) ? end : Date.now()) / 1000),
  };
};

const writeSelfReportSourceRecords = async (input: {
  athleteUserId: string;
  observationDate: string;
  submittedAtIso: string;
  derivedSignals: SelfReportDerivedSignals;
  confidenceCap: DataConfidence;
  answers: SelfReportAnswer[];
}): Promise<void> => {
  if (input.derivedSignals.freshness === 'missing') return;

  const window = buildDayWindowSeconds(input.observationDate);
  const observedAt = Math.round(new Date(input.submittedAtIso).getTime() / 1000);
  const baseMetadata = {
    syncOrigin: 'pulsecheck_self_report',
    writer: 'athleteSelfReport.ingestSelfReportSubmission',
  };
  const baseProvenance = {
    mode: 'self_reported' as const,
    sourceSystem: 'pulsecheck_self_report',
    confidenceLabel: input.confidenceCap,
  };

  const recoveryPayload: Record<string, unknown> = {};
  if (input.derivedSignals.sleepEfficiencyProxy !== undefined) {
    recoveryPayload.sleepEfficiencyProxy = input.derivedSignals.sleepEfficiencyProxy;
  }
  if (input.derivedSignals.totalSleepMinProxy !== undefined) {
    recoveryPayload.totalSleepMinProxy = input.derivedSignals.totalSleepMinProxy;
  }
  if (input.derivedSignals.sorenessScore !== undefined) {
    recoveryPayload.sorenessScore = input.derivedSignals.sorenessScore;
  }

  const behavioralPayload: Record<string, unknown> = {};
  if (input.derivedSignals.readinessScoreProxy !== undefined) {
    behavioralPayload.readinessScoreProxy = input.derivedSignals.readinessScoreProxy;
  }
  if (input.derivedSignals.stressScore !== undefined) {
    behavioralPayload.stressScore = input.derivedSignals.stressScore;
  }
  if (input.derivedSignals.sessionRpe !== undefined) {
    behavioralPayload.perceivedRpeYesterday = input.derivedSignals.sessionRpe;
  }

  const nutritionPayload: Record<string, unknown> = {};
  if (input.derivedSignals.hydrationLabel !== undefined) {
    nutritionPayload.hydrationLabel = input.derivedSignals.hydrationLabel;
  }
  if (input.derivedSignals.fuelingLabel !== undefined) {
    nutritionPayload.fuelingLabel = input.derivedSignals.fuelingLabel;
  }

  const writes: Promise<unknown>[] = [];

  if (Object.keys(recoveryPayload).length > 0) {
    writes.push(
      upsertHealthContextSourceRecord({
        athleteUserId: input.athleteUserId,
        sourceFamily: 'pulsecheck_self_report',
        sourceType: 'pulsecheck_self_report_recovery',
        domain: 'recovery',
        observedAt,
        observedWindowStart: window.startSec,
        observedWindowEnd: window.endSec,
        timezone: SELF_REPORT_TIMEZONE_FALLBACK,
        dateKey: input.observationDate,
        payload: recoveryPayload,
        sourceMetadata: baseMetadata,
        provenance: baseProvenance,
      }),
    );
  }

  if (Object.keys(behavioralPayload).length > 0) {
    writes.push(
      upsertHealthContextSourceRecord({
        athleteUserId: input.athleteUserId,
        sourceFamily: 'pulsecheck_self_report',
        sourceType: 'pulsecheck_self_report_behavioral',
        domain: 'behavioral',
        observedAt,
        observedWindowStart: window.startSec,
        observedWindowEnd: window.endSec,
        timezone: SELF_REPORT_TIMEZONE_FALLBACK,
        dateKey: input.observationDate,
        payload: behavioralPayload,
        sourceMetadata: baseMetadata,
        provenance: baseProvenance,
      }),
    );
  }

  if (Object.keys(nutritionPayload).length > 0) {
    writes.push(
      upsertHealthContextSourceRecord({
        athleteUserId: input.athleteUserId,
        sourceFamily: 'pulsecheck_self_report',
        sourceType: 'pulsecheck_self_report_nutrition',
        domain: 'nutrition',
        observedAt,
        observedWindowStart: window.startSec,
        observedWindowEnd: window.endSec,
        timezone: SELF_REPORT_TIMEZONE_FALLBACK,
        dateKey: input.observationDate,
        payload: nutritionPayload,
        sourceMetadata: baseMetadata,
        provenance: baseProvenance,
      }),
    );
  }

  await Promise.all(writes);
};

/**
 * Return the most recent self-report record for an athlete (any
 * observation date). Used by the snapshot assembler when assembling
 * behavioral + recovery context.
 */
export const getLatestSelfReportForAthlete = async (
  athleteUserId: string,
): Promise<SelfReportRecord | null> => {
  const scopedAthleteId = requireString(athleteUserId, 'athleteUserId');
  const snap = await getDocs(
    query(
      collection(db, 'athletes', scopedAthleteId, SELF_REPORTS_COLLECTION),
      orderBy('submittedAt', 'desc'),
      limit(1),
    ),
  );
  if (snap.empty) return null;
  const docSnap = snap.docs[0];
  return { ...(docSnap.data() as SelfReportRecord), recordId: docSnap.id };
};

export const listSelfReportsForObservationDate = async (
  athleteUserId: string,
  observationDate: string,
): Promise<SelfReportRecord[]> => {
  const scopedAthleteId = requireString(athleteUserId, 'athleteUserId');
  const normalizedDate = requireString(observationDate, 'observationDate');
  const snap = await getDocs(
    query(
      collection(db, 'athletes', scopedAthleteId, SELF_REPORTS_COLLECTION),
      where('observationDate', '==', normalizedDate),
      orderBy('submittedAt', 'desc'),
    ),
  );
  return snap.docs.map((docSnap) => ({
    ...(docSnap.data() as SelfReportRecord),
    recordId: docSnap.id,
  }));
};

/**
 * Convenience: read the athlete's connected-wearable status from their
 * health-context-source-status collection if present. Defaults to "no
 * device" (which is the safe assumption — Nora asks the device-missing
 * question set when in doubt).
 */
export const athleteHasConnectedWearable = async (athleteUserId: string): Promise<boolean> => {
  const scopedAthleteId = requireString(athleteUserId, 'athleteUserId');
  const statusDoc = await getDoc(
    doc(db, 'athletes', scopedAthleteId, 'health-context-source-status', 'current'),
  );
  if (!statusDoc.exists()) return false;
  const data = statusDoc.data() || {};
  const wearableSources: SnapshotSourceId[] = ['health_kit', 'apple_watch', 'oura', 'polar', 'whoop', 'garmin'];
  return wearableSources.some((sourceId) => {
    const status = (data as Record<string, unknown>)[sourceId];
    return status === 'connected_synced';
  });
};

export const athleteSelfReportService = {
  questions: SELF_REPORT_QUESTIONS,
  pick: pickSelfReportQuestionsForCheckin,
  computeDerivedSignals: computeSelfReportDerivedSignals,
  ingest: ingestSelfReportSubmission,
  getLatest: getLatestSelfReportForAthlete,
  listForDate: listSelfReportsForObservationDate,
  hasConnectedWearable: athleteHasConnectedWearable,
};
