// =============================================================================
// Athlete Health Context Snapshot — canonical contract + Firestore service.
//
// Implementation of the spec at:
//   src/components/admin/system-overview/PulseCheckAthleteHealthContextSnapshotSpecTab.tsx
//
// This artifact is the single normalized health-context object that every
// downstream consumer (Macra daily insight, Nora chat, coach reports,
// proactive alerts) should read from. Source adapters write source records
// upstream of this; the snapshot assembler (Slice 3 — inference engine)
// merges them into a snapshot. Self-report intake also feeds in via the
// athleteSelfReport service.
//
// Today, only the contract + Firestore service are implemented. The
// assembler that automatically produces a snapshot from raw signals is
// Slice 3 work; the inference engine will plug into upsertSnapshot() as
// part of that build. Until then, the reviewer screen + manually-curated
// flows can write snapshots directly through the same service.
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

// ──────────────────────────────────────────────────────────────────────────────
// Enums
// ──────────────────────────────────────────────────────────────────────────────

export type SnapshotType = 'daily' | 'rolling_7d' | 'rolling_14d' | 'rolling_30d' | 'point_in_time';

export type SourceStatus =
  | 'not_connected'
  | 'permission_denied'
  | 'connected_waiting_for_data'
  | 'connected_synced'
  | 'connected_stale'
  | 'error';

export type FreshnessTier = 'fresh' | 'recent' | 'historical_only' | 'stale' | 'missing' | 'inferred';

export type SummaryMode = 'direct' | 'merged_direct' | 'historical_contextual' | 'inferred_partial' | 'empty';

/**
 * Canonical source identifiers. Adapters and the self-report intake must
 * use these exact ids when writing source records and provenance entries.
 *
 * Build state (2026-04-25):
 * - `health_kit`, `apple_watch`, `oura`, `fit_with_pulse`, `macra`,
 *   `pulsecheck_self_report`, `coach_entered` → ACTIVE.
 * - `polar`, `whoop`, `garmin` → planned future devices, not yet implemented.
 */
export type SnapshotSourceId =
  | 'fit_with_pulse'
  | 'macra'
  | 'health_kit'
  | 'apple_watch'
  | 'oura'
  | 'polar'
  | 'whoop'
  | 'garmin'
  | 'pulsecheck_self_report'
  | 'coach_entered';

export type DomainKey =
  | 'identity'
  | 'training'
  | 'recovery'
  | 'activity'
  | 'nutrition'
  | 'biometrics'
  | 'behavioral'
  | 'summary';

/**
 * Confidence ladder used by the Aggregation + Inference Contract.
 * Self-reported data may not exceed `emerging` because the spec forbids
 * self-report from driving high-trust coach claims.
 */
export type DataConfidence =
  | 'directional'
  | 'emerging'
  | 'stable'
  | 'high_confidence'
  | 'degraded';

// ──────────────────────────────────────────────────────────────────────────────
// Domain shapes
// ──────────────────────────────────────────────────────────────────────────────

export interface IdentityContext {
  athleteUserId: string;
  athleteSport?: string;
  athleteSportName?: string;
  athleteSportPosition?: string;
  teamIds: string[];
  organizationIds: string[];
  pilotIds?: string[];
  timezone?: string;
  ageBand?: string;
  competitiveLevel?: string;
  seasonPhase?: string;
}

export interface TrainingContext {
  recentWorkoutCount?: number;
  trailingVolumeAU?: number;
  acuteLoad7dAU?: number;
  chronicLoad28dAU?: number;
  acwr?: number;
  microcycleLoadDelta?: number;
  bodyPartsWorked?: string[];
  recentSessionRpe?: number;
  trainingRecencyDays?: number;
  adherence7d?: number;
  prescribedDeviation7d?: number;
}

export interface RecoveryContext {
  totalSleepMin?: number;
  deepSleepMin?: number;
  remSleepMin?: number;
  sleepEfficiency?: number;
  sleepConsistencyScore?: number;
  sleepLatencyMin?: number;
  rmssdMs?: number;
  hrvBaselineDeltaPct?: number;
  hrvTrend7d?: number;
  restingHr?: number;
  restingHrTrend7d?: number;
  recoveryScore?: number;
  readinessScore?: number;
  recoveryTrend7d?: number;
}

export interface ActivityContext {
  steps?: number;
  activeCalories?: number;
  distanceMeters?: number;
  exerciseMinutes?: number;
  standHours?: number;
  cardioMinutes?: number;
}

export interface NutritionContext {
  mealCount?: number;
  caloriesConsumed?: number;
  caloriesTarget?: number;
  proteinG?: number;
  carbsG?: number;
  fatG?: number;
  hydrationMl?: number;
  energyBalance?: 'surplus' | 'deficit' | 'maintenance' | 'unknown';
  journalConfidence?: DataConfidence;
}

export interface BiometricsContext {
  weightKg?: number;
  bodyFatPct?: number;
  muscleMassKg?: number;
  respiratoryRate?: number;
  oxygenSaturationPct?: number;
  vo2MaxMl?: number;
}

export interface BehavioralContext {
  recentCheckinAt?: string;
  sentimentRollingAvg?: number;
  subjectiveReadiness?: number;
  moodTone?: 'positive' | 'neutral' | 'concerned' | 'distressed' | 'unknown';
  sorenessReports?: Record<string, number>;
  riskFlags?: string[];
  protocolCompletion7d?: number;
  simulationCompletion7d?: number;
  noraCheckinCompletion7d?: number;
  recentSelfReport?: {
    submittedAt: string;
    sleepQualityScore?: number;
    energyScore?: number;
    stressScore?: number;
    sorenessScore?: number;
    perceivedRpe?: number;
    notes?: string;
  };
}

export interface SummaryContext {
  headline?: string;
  toneLabel?: string;
  surfacedFlags: string[];
  driverDomains: DomainKey[];
}

// ──────────────────────────────────────────────────────────────────────────────
// Per-domain block + provenance
// ──────────────────────────────────────────────────────────────────────────────

export interface DomainProvenance {
  primarySource?: SnapshotSourceId;
  contributingSources: SnapshotSourceId[];
  observationTimes?: Partial<Record<SnapshotSourceId, string>>;
  notes?: string[];
  dataConfidence?: DataConfidence;
}

export interface DomainBlock<T> {
  freshness: FreshnessTier;
  data: T;
  provenance: DomainProvenance;
  sourceStatus: Partial<Record<SnapshotSourceId, SourceStatus>>;
}

// ──────────────────────────────────────────────────────────────────────────────
// Top-level snapshot
// ──────────────────────────────────────────────────────────────────────────────

export interface SnapshotPermissions {
  productConsent: boolean;
  researchConsent?: boolean;
  consentVersionIds: string[];
  scopedConsumers: string[];
}

export interface SnapshotSourceWindow {
  startsAt: string; // ISO
  endsAt: string;   // ISO
  timezone?: string;
}

export interface SnapshotProvenanceTop {
  sourcesUsed: SnapshotSourceId[];
  domainWinners: Partial<Record<DomainKey, SnapshotSourceId>>;
  summaryMode: SummaryMode;
  sourceObservationTimes: Partial<Record<SnapshotSourceId, string>>;
  mergeNotes?: string[];
  dataConfidence?: Partial<Record<DomainKey, DataConfidence>>;
}

export interface SnapshotAudit {
  assemblyNotes?: string[];
  missingSourceReasons?: Partial<Record<SnapshotSourceId, string>>;
  missingDomains?: DomainKey[];
  qaFlags?: string[];
}

export interface AthleteHealthContextSnapshot {
  snapshotId: string;
  athleteUserId: string;
  snapshotDate: string;            // YYYY-MM-DD athlete-local
  snapshotType: SnapshotType;
  generatedAt: string;             // ISO
  sourceWindow: SnapshotSourceWindow;
  revision: number;
  permissions: SnapshotPermissions;
  sourceStatus: Partial<Record<SnapshotSourceId, SourceStatus>>;
  freshness: {
    overall: FreshnessTier;
    perDomain: Partial<Record<DomainKey, FreshnessTier>>;
  };
  provenance: SnapshotProvenanceTop;
  domains: {
    identity: DomainBlock<IdentityContext>;
    training?: DomainBlock<TrainingContext>;
    recovery?: DomainBlock<RecoveryContext>;
    activity?: DomainBlock<ActivityContext>;
    nutrition?: DomainBlock<NutritionContext>;
    biometrics?: DomainBlock<BiometricsContext>;
    behavioral?: DomainBlock<BehavioralContext>;
    summary: DomainBlock<SummaryContext>;
  };
  audit?: SnapshotAudit;
}

// ──────────────────────────────────────────────────────────────────────────────
// Firestore service
// ──────────────────────────────────────────────────────────────────────────────

// Storage path: ROOT collection `health-context-snapshots`. This matches the
// path the existing Oura adapter (netlify/functions/oura-sync.js) and the
// PulseCheck iOS HealthKit writer (PulseCheckFirebaseService.persistNativeHealthKitContext)
// already use, so consumers don't have to choose between two snapshot stores.
//
// Snapshot id format `{userId}_{snapshotType}_{date}` (single underscore) also
// matches what the existing adapters write. Tenancy is enforced by the
// `athleteUserId` field on each document, queried via `where(...)` filters.
export const HEALTH_CONTEXT_SNAPSHOTS_COLLECTION = 'health-context-snapshots';
export const HEALTH_CONTEXT_SNAPSHOT_REVISIONS_COLLECTION = 'health-context-snapshot-revisions';

const buildSnapshotId = (athleteUserId: string, snapshotType: SnapshotType, snapshotDate: string) =>
  `${athleteUserId}_${snapshotType}_${snapshotDate}`;

const snapshotsCollectionRef = () => collection(db, HEALTH_CONTEXT_SNAPSHOTS_COLLECTION);

const snapshotDocRef = (snapshotId: string) =>
  doc(db, HEALTH_CONTEXT_SNAPSHOTS_COLLECTION, snapshotId);

const revisionsCollectionRef = (snapshotId: string) =>
  collection(db, HEALTH_CONTEXT_SNAPSHOTS_COLLECTION, snapshotId, HEALTH_CONTEXT_SNAPSHOT_REVISIONS_COLLECTION);

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

const requireString = (value: string, label: string) => {
  const normalized = String(value || '').trim();
  if (!normalized) {
    throw new Error(`[AthleteContextSnapshot] ${label} is required.`);
  }
  return normalized;
};

const fromSnapshotDoc = (snap: { id: string; data: () => unknown }): AthleteHealthContextSnapshot => ({
  ...(snap.data() as AthleteHealthContextSnapshot),
  snapshotId: snap.id,
});

export interface UpsertSnapshotInput {
  athleteUserId: string;
  snapshotDate: string;
  snapshotType: SnapshotType;
  generatedAt?: string;
  sourceWindow: SnapshotSourceWindow;
  permissions: SnapshotPermissions;
  sourceStatus?: Partial<Record<SnapshotSourceId, SourceStatus>>;
  freshness: AthleteHealthContextSnapshot['freshness'];
  provenance: SnapshotProvenanceTop;
  domains: AthleteHealthContextSnapshot['domains'];
  audit?: SnapshotAudit;
}

/**
 * Idempotent writer. Computes a deterministic snapshot id from
 * (athleteUserId, snapshotType, snapshotDate) so re-runs of the same
 * window overwrite the same row. Bumps `revision` and copies the prior
 * snapshot into the revisions sub-collection for audit.
 */
export const upsertAthleteContextSnapshot = async (
  input: UpsertSnapshotInput,
): Promise<AthleteHealthContextSnapshot> => {
  const athleteUserId = requireString(input.athleteUserId, 'athleteUserId');
  const snapshotDate = requireString(input.snapshotDate, 'snapshotDate');
  const snapshotType = input.snapshotType;
  const snapshotId = buildSnapshotId(athleteUserId, snapshotType, snapshotDate);
  const generatedAt = input.generatedAt || new Date().toISOString();

  const ref = snapshotDocRef(snapshotId);
  const existingSnap = await getDoc(ref);
  const previous = existingSnap.exists() ? (existingSnap.data() as AthleteHealthContextSnapshot) : null;
  const revision = (previous?.revision || 0) + 1;

  const next: AthleteHealthContextSnapshot = {
    snapshotId,
    athleteUserId,
    snapshotDate,
    snapshotType,
    generatedAt,
    sourceWindow: input.sourceWindow,
    revision,
    permissions: input.permissions,
    sourceStatus: input.sourceStatus || {},
    freshness: input.freshness,
    provenance: input.provenance,
    domains: input.domains,
    audit: input.audit,
  };

  await setDoc(
    ref,
    stripUndefinedDeep({
      ...next,
      updatedAt: serverTimestamp(),
      ...(previous ? {} : { createdAt: serverTimestamp() }),
    }),
    { merge: true },
  );

  if (previous) {
    const revisionRef = doc(revisionsCollectionRef(snapshotId), String(previous.revision || 0));
    await setDoc(
      revisionRef,
      stripUndefinedDeep({
        ...previous,
        archivedAt: serverTimestamp(),
        archivedReason: 'superseded_by_revision',
      }),
      { merge: false },
    );
  }

  return next;
};

/**
 * Fetch the active snapshot for a given athlete + window. Returns null if
 * no snapshot has been assembled yet (consumers should branch on missing
 * snapshot the same way they branch on `summaryMode === 'empty'`).
 */
export const getActiveAthleteContextSnapshot = async (
  athleteUserId: string,
  snapshotType: SnapshotType,
  snapshotDate: string,
): Promise<AthleteHealthContextSnapshot | null> => {
  const scopedAthleteId = requireString(athleteUserId, 'athleteUserId');
  const normalizedDate = requireString(snapshotDate, 'snapshotDate');
  const snapshotId = buildSnapshotId(scopedAthleteId, snapshotType, normalizedDate);
  const snap = await getDoc(snapshotDocRef(snapshotId));
  if (!snap.exists()) return null;
  return fromSnapshotDoc(snap);
};

/**
 * List the most recent snapshots of the given type for an athlete. Used by
 * dashboards and the inference engine when it needs trailing context.
 */
export const listRecentAthleteContextSnapshots = async (
  athleteUserId: string,
  snapshotType: SnapshotType,
  maxResults = 14,
): Promise<AthleteHealthContextSnapshot[]> => {
  const scopedAthleteId = requireString(athleteUserId, 'athleteUserId');
  const normalizedLimit = Math.min(Math.max(Math.floor(maxResults), 1), 60);
  const snap = await getDocs(
    query(
      snapshotsCollectionRef(),
      where('athleteUserId', '==', scopedAthleteId),
      where('snapshotType', '==', snapshotType),
      orderBy('snapshotDate', 'desc'),
      limit(normalizedLimit),
    ),
  );
  return snap.docs.map(fromSnapshotDoc);
};

/**
 * Build an `empty` snapshot — used when no source has produced data yet.
 * Consumers should treat this exactly like a missing snapshot but it lets
 * us write a deterministic "we ran and found nothing" record so reviewers
 * can audit assembly attempts.
 */
export const buildEmptyAthleteContextSnapshot = (
  athleteUserId: string,
  snapshotType: SnapshotType,
  snapshotDate: string,
  sourceWindow: SnapshotSourceWindow,
): UpsertSnapshotInput => ({
  athleteUserId,
  snapshotDate,
  snapshotType,
  sourceWindow,
  permissions: {
    productConsent: false,
    researchConsent: undefined,
    consentVersionIds: [],
    scopedConsumers: [],
  },
  sourceStatus: {},
  freshness: {
    overall: 'missing',
    perDomain: {},
  },
  provenance: {
    sourcesUsed: [],
    domainWinners: {},
    summaryMode: 'empty',
    sourceObservationTimes: {},
  },
  domains: {
    identity: {
      freshness: 'missing',
      data: {
        athleteUserId,
        teamIds: [],
        organizationIds: [],
      },
      provenance: { contributingSources: [] },
      sourceStatus: {},
    },
    summary: {
      freshness: 'missing',
      data: {
        surfacedFlags: ['snapshot_empty'],
        driverDomains: [],
      },
      provenance: { contributingSources: [] },
      sourceStatus: {},
    },
  },
  audit: {
    assemblyNotes: ['No source produced data for this window.'],
    missingDomains: ['training', 'recovery', 'activity', 'nutrition', 'biometrics', 'behavioral'],
  },
});

export const athleteContextSnapshotService = {
  upsert: upsertAthleteContextSnapshot,
  getActive: getActiveAthleteContextSnapshot,
  listRecent: listRecentAthleteContextSnapshots,
  buildEmpty: buildEmptyAthleteContextSnapshot,
};
