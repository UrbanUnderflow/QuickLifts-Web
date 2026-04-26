// =============================================================================
// Health Context Source Record — TypeScript contract aligned with the live
// shape already written by `netlify/functions/oura-sync.js`.
//
// This file is the TS-side mirror of an existing Firestore contract that
// the Oura adapter has been writing for some time. Codifying it in TS
// lets future adapters (HealthKit-bridged from iOS, self-report from
// Nora check-ins, future Polar/Whoop/Garmin) target the same shape.
//
// **Storage**: `health-context-source-records/{recordId}` at the ROOT of
// Firestore (not nested under athlete) so the snapshot assembler can
// query by athlete + window in a single read. Athletic-tenancy is
// enforced via the `athleteUserId` field on each record.
//
// **Dedup**: every record carries a `dedupeKey` of the form
// `{userId}|{sourceFamily}|{domain}|{dateKey}` so the assembler can
// idempotently overwrite same-window same-source writes.
// =============================================================================

import {
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import { db } from './config';

// ──────────────────────────────────────────────────────────────────────────────
// Enums and identifiers
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Vendor-level family. One per real-world data source. Self-report and
 * coach-entered ride alongside device families because the assembler
 * treats them as canonical lanes.
 *
 * Active families (writing to HCSR today):
 *   - oura
 *   - apple_health (HealthKit / Apple Watch — iOS adapter rewrite in flight)
 *   - pulsecheck_self_report
 *   - coach_entered
 *
 * Planned future families:
 *   - polar
 *   - whoop
 *   - garmin
 */
export type HealthContextSourceFamily =
  | 'oura'
  | 'apple_health'
  | 'polar'
  | 'whoop'
  | 'garmin'
  | 'pulsecheck_self_report'
  | 'coach_entered'
  | 'fit_with_pulse'
  | 'macra';

/**
 * Specific lane within a source family — fine-grained enough to carry
 * the meaning a domain-aware assembler needs. Examples:
 *   - `pulsecheck_oura_recovery`
 *   - `pulsecheck_oura_readiness`
 *   - `pulsecheck_self_report_recovery`
 *   - `apple_health_activity`
 *
 * Adapters MUST namespace their sourceTypes with their family prefix.
 */
export type HealthContextSourceType = string;

export type HealthContextRecordType = 'summary_input' | 'session_input' | 'event_input' | 'context_input';

export type HealthContextDomain =
  | 'identity'
  | 'training'
  | 'recovery'
  | 'activity'
  | 'nutrition'
  | 'biometrics'
  | 'behavioral'
  | 'summary';

export type HealthContextRecordStatus = 'active' | 'superseded' | 'invalid';

export type HealthContextProvenanceMode = 'direct' | 'inferred' | 'self_reported' | 'coach_entered';

// ──────────────────────────────────────────────────────────────────────────────
// Source record shape
// ──────────────────────────────────────────────────────────────────────────────

export interface HealthContextSourceMetadata {
  syncOrigin: string;
  writer: string;
  /** Optional revision/version of the upstream payload that produced this record. */
  upstreamRevision?: string;
  notes?: string[];
}

export interface HealthContextSourceProvenance {
  mode: HealthContextProvenanceMode;
  sourceSystem: string;
  /** Optional pass-through of the raw vendor day key for audit. */
  rawDay?: string;
  /** Confidence label the adapter wants to publish to consumers. */
  confidenceLabel?: 'directional' | 'emerging' | 'stable' | 'high_confidence' | 'degraded';
  notes?: string[];
}

export interface HealthContextSourceRecord<TPayload = Record<string, unknown>> {
  id: string;
  athleteUserId: string;
  sourceFamily: HealthContextSourceFamily;
  sourceType: HealthContextSourceType;
  recordType: HealthContextRecordType;
  domain: HealthContextDomain;
  /** Unix seconds (matches existing JS adapters). */
  observedAt: number;
  observedWindowStart: number;
  observedWindowEnd: number;
  ingestedAt: number;
  timezone: string;
  status: HealthContextRecordStatus;
  dedupeKey: string;
  payloadVersion: string;
  payload: TPayload;
  sourceMetadata: HealthContextSourceMetadata;
  provenance: HealthContextSourceProvenance;
}

// ──────────────────────────────────────────────────────────────────────────────
// Firestore service (write target for future TS-side adapters)
// ──────────────────────────────────────────────────────────────────────────────

export const HEALTH_CONTEXT_SOURCE_RECORDS_COLLECTION = 'health-context-source-records';
export const HEALTH_CONTEXT_SOURCE_RECORD_CONTRACT_VERSION = '1.0';

const sourceRecordsCollection = () => collection(db, HEALTH_CONTEXT_SOURCE_RECORDS_COLLECTION);
const sourceRecordDocRef = (recordId: string) => doc(db, HEALTH_CONTEXT_SOURCE_RECORDS_COLLECTION, recordId);

const stripUndefinedDeep = <T>(value: T): T => {
  if (Array.isArray(value)) {
    return value
      .map((entry) => stripUndefinedDeep(entry))
      .filter((entry) => entry !== undefined) as unknown as T;
  }
  if (!value || typeof value !== 'object') {
    return value;
  }
  const output: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (entry === undefined) continue;
    output[key] = stripUndefinedDeep(entry);
  }
  return output as T;
};

const requireString = (value: unknown, label: string): string => {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized) {
    throw new Error(`[HealthContextSourceRecord] ${label} is required.`);
  }
  return normalized;
};

const nowSeconds = () => Math.round(Date.now() / 1000);

export const buildSourceRecordId = (
  athleteUserId: string,
  sourceFamily: HealthContextSourceFamily,
  domain: HealthContextDomain,
  dateKey: string,
): string => `${athleteUserId}_${sourceFamily}_${domain}_${dateKey}`;

export const buildSourceRecordDedupeKey = (
  athleteUserId: string,
  sourceFamily: HealthContextSourceFamily,
  domain: HealthContextDomain,
  dateKey: string,
): string => `${athleteUserId}|${sourceFamily}|${domain}|${dateKey}`;

export interface UpsertSourceRecordInput<TPayload = Record<string, unknown>> {
  athleteUserId: string;
  sourceFamily: HealthContextSourceFamily;
  sourceType: HealthContextSourceType;
  recordType?: HealthContextRecordType;
  domain: HealthContextDomain;
  observedAt: number;
  observedWindowStart: number;
  observedWindowEnd: number;
  timezone: string;
  /** Stable date key (YYYY-MM-DD) used for record id and dedupe. */
  dateKey: string;
  payload: TPayload;
  sourceMetadata: HealthContextSourceMetadata;
  provenance: HealthContextSourceProvenance;
  /** Override the auto-generated id when the adapter needs custom segmentation. */
  recordIdOverride?: string;
}

/**
 * Idempotent writer. Computes a deterministic record id from
 * (athleteUserId, sourceFamily, domain, dateKey) so re-runs overwrite
 * the same row. Adapters can pass `recordIdOverride` for finer-grained
 * windows (e.g., per-session records inside a day).
 */
export const upsertHealthContextSourceRecord = async <TPayload>(
  input: UpsertSourceRecordInput<TPayload>,
): Promise<HealthContextSourceRecord<TPayload>> => {
  const athleteUserId = requireString(input.athleteUserId, 'athleteUserId');
  const sourceFamily = requireString(input.sourceFamily, 'sourceFamily') as HealthContextSourceFamily;
  const sourceType = requireString(input.sourceType, 'sourceType');
  const dateKey = requireString(input.dateKey, 'dateKey');

  const recordId = input.recordIdOverride
    || buildSourceRecordId(athleteUserId, sourceFamily, input.domain, dateKey);

  const record: HealthContextSourceRecord<TPayload> = {
    id: recordId,
    athleteUserId,
    sourceFamily,
    sourceType,
    recordType: input.recordType || 'summary_input',
    domain: input.domain,
    observedAt: input.observedAt,
    observedWindowStart: input.observedWindowStart,
    observedWindowEnd: input.observedWindowEnd,
    ingestedAt: nowSeconds(),
    timezone: input.timezone,
    status: 'active',
    dedupeKey: buildSourceRecordDedupeKey(athleteUserId, sourceFamily, input.domain, dateKey),
    payloadVersion: HEALTH_CONTEXT_SOURCE_RECORD_CONTRACT_VERSION,
    payload: input.payload,
    sourceMetadata: input.sourceMetadata,
    provenance: input.provenance,
  };

  await setDoc(
    sourceRecordDocRef(recordId),
    stripUndefinedDeep({
      ...record,
      updatedAt: serverTimestamp(),
    }),
    { merge: true },
  );

  return record;
};

/**
 * Fetch source records for an athlete inside a window. Used by the
 * snapshot assembler — bypasses Firestore's collectionGroup-by-id since
 * source records are flat.
 */
export const listHealthContextSourceRecordsForWindow = async (
  athleteUserId: string,
  windowStart: number,
  windowEnd: number,
  options: { sourceFamily?: HealthContextSourceFamily; domain?: HealthContextDomain; max?: number } = {},
): Promise<HealthContextSourceRecord[]> => {
  const scopedAthleteId = requireString(athleteUserId, 'athleteUserId');
  const constraints: Parameters<typeof query>[1][] = [
    where('athleteUserId', '==', scopedAthleteId),
    where('observedAt', '>=', windowStart),
    where('observedAt', '<=', windowEnd),
    where('status', '==', 'active'),
  ];
  if (options.sourceFamily) {
    constraints.push(where('sourceFamily', '==', options.sourceFamily));
  }
  if (options.domain) {
    constraints.push(where('domain', '==', options.domain));
  }
  constraints.push(orderBy('observedAt', 'desc'));
  if (options.max && Number.isFinite(options.max)) {
    constraints.push(limit(Math.max(1, Math.min(Math.floor(options.max), 200))));
  }

  const snap = await getDocs(query(sourceRecordsCollection(), ...constraints));
  return snap.docs.map((docSnap) => ({ ...(docSnap.data() as HealthContextSourceRecord), id: docSnap.id }));
};

/**
 * Mark a previously-active record as superseded. Used when an adapter
 * detects that a vendor revised its own record (e.g., Oura back-corrects
 * a sleep window) and the assembler should treat the new record as
 * canonical.
 */
export const supersedeHealthContextSourceRecord = async (recordId: string): Promise<void> => {
  const normalizedId = requireString(recordId, 'recordId');
  await setDoc(
    sourceRecordDocRef(normalizedId),
    {
      status: 'superseded',
      supersededAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
};

export const healthContextSourceRecordService = {
  upsert: upsertHealthContextSourceRecord,
  listForWindow: listHealthContextSourceRecordsForWindow,
  supersede: supersedeHealthContextSourceRecord,
  buildId: buildSourceRecordId,
  buildDedupeKey: buildSourceRecordDedupeKey,
};
