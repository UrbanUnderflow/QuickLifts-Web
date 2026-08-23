// =============================================================================
// PulseCheck Device Monitor — derives per-athlete device sync + wear status for
// the launch-day Device Dashboard.
//
// There is no pre-aggregated per-athlete device-status document today, so this
// module derives everything live from `health-context-source-records`: for each
// athlete on a team we pull their active records inside a rolling window and
// compute the currently-synced device, last sync time, and how consistently the
// athlete is actually wearing it (distinct days with data / window length).
//
// For team-sized rosters (tens of athletes) the per-athlete fan-out is cheap.
// If/when this needs to scale to large orgs, swap loadTeamDeviceStatuses() for a
// nightly server aggregator that writes a status doc the dashboard can read.
// =============================================================================

import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from './config';
import {
  listHealthContextSourceRecordsForWindow,
  type HealthContextSourceFamily,
  type HealthContextSourceRecord,
} from './healthContextSourceRecord';
import { pulseCheckProvisioningService } from './pulsecheckProvisioning/service';
import type { PulseCheckTeamMembership } from './pulsecheckProvisioning/types';
import { userService } from './user/service';
import type { User } from './user/types';
import {
  normalizePulseCheckWorkspaceScope,
  pulseCheckRecordMatchesWorkspace,
  type PulseCheckWorkspaceScope,
} from './pulsecheckWorkspaceScope';

// ──────────────────────────────────────────────────────────────────────────────
// Public contract
// ──────────────────────────────────────────────────────────────────────────────

/** Coarse connection state an operator can act on at a glance. */
export type AthleteDeviceConnectionStatus = 'synced' | 'stale' | 'not_connected';
export type AthleteDeviceEvidenceState = 'available' | 'partial' | 'unavailable';

/**
 * A single day's data snapshot for one wearable source, surfaced on hover over a
 * presence-bar cell in the coach dashboard. Built only from days that actually
 * produced ≥1 record for that source family.
 */
export interface AthleteDeviceDayDetail {
  dayIndex: number;
  dateLabel: string;
  /** Merged measured observation time for this source on the day, in seconds. */
  observedSeconds: number;
  recordCount: number;
  domains: string[];
  metrics: Array<{ label: string; value: string }>;
  /**
   * Short wear-context note inferred from which metric families landed that day
   * (overnight recovery vs daytime activity) — e.g. "Daytime only · not worn
   * overnight". Null when the pattern is ambiguous.
   */
  wearNote: string | null;
}

/**
 * Per-source device status. An athlete can have several wearables connected at
 * once (e.g. Oura + Fitbit + Polar); each gets its own coverage + freshness so
 * the coach dashboard can show a dead device alongside a healthy one instead of
 * collapsing everything into a single "current device".
 */
export interface AthleteDevicePerSourceStatus {
  sourceFamily: HealthContextSourceFamily;
  label: string;
  connectionStatus: AthleteDeviceConnectionStatus;
  lastObservedAt: number | null;
  lastSyncedAt: number | null;
  wearDaysCovered: number;
  windowDays: number;
  wearCoveragePct: number;
  /** Days with OVERNIGHT recovery data (sleep stages, HRV, resting HR…). */
  overnightDaysCovered: number;
  overnightCoveragePct: number;
  overnightPresence: boolean[];
  /** Days with DAYTIME activity data (steps, active calories, avg HR). */
  daytimeDaysCovered: number;
  daytimeCoveragePct: number;
  daytimePresence: boolean[];
  dailyPresence: boolean[];
  /**
   * Per-day data snapshot aligned 1:1 with `dailyPresence` (oldest→newest, length
   * === windowDays). `null` for a day with no records; non-null exactly where
   * `dailyPresence[i] === true`.
   */
  dailyDetails: (AthleteDeviceDayDetail | null)[];
}

export interface AthleteDeviceStatus {
  athleteUserId: string;
  displayName: string;
  email?: string;
  /** Most-recent wearable source family seen in the window, or null if none. */
  currentDeviceFamily: HealthContextSourceFamily | null;
  /** Human label for the current device (e.g. "Polar", "Oura Ring"). */
  currentDeviceLabel: string;
  connectionStatus: AthleteDeviceConnectionStatus;
  /** Whether the backing device evidence could actually be read. */
  evidenceState: AthleteDeviceEvidenceState;
  /** Unix seconds of the most recent observed wearable data point, or null. */
  lastObservedAt: number | null;
  /** Unix seconds of the most recent ingestion (sync) of wearable data, or null. */
  lastSyncedAt: number | null;
  /** Distinct days inside the window that have at least one wearable record. */
  wearDaysCovered: number;
  /** Length of the analysis window in days. */
  windowDays: number;
  /** wearDaysCovered / windowDays as a 0–100 integer. */
  wearCoveragePct: number;
  /** Oldest→newest per-day presence flags, length === windowDays. */
  dailyPresence: boolean[];
  /** Count of wearable records pulled for this athlete in the window. */
  totalRecords: number;
  /**
   * Every wearable source seen for this athlete (records or a connected
   * source-status), each with its own coverage + freshness. Sorted by most
   * recent data first. The top-level summary fields above mirror devices[0].
   */
  devices: AthleteDevicePerSourceStatus[];
}

export interface TeamDeviceStatusResult {
  statuses: AthleteDeviceStatus[];
  windowDays: number;
  /** Unix seconds the snapshot was computed at. */
  computedAt: number;
  athleteCount: number;
}

export interface AthleteDeviceEvidencePayload {
  records: HealthContextSourceRecord[];
  windowDays: number;
  windowDateKeys: string[];
  windowStart: number;
  computedAt: number;
  evidenceState: AthleteDeviceEvidenceState;
}

export const DEVICE_MONITOR_DEFAULT_WINDOW_DAYS = 14;

const SECONDS_PER_DAY = 24 * 60 * 60;
// A device that hasn't produced data in 36h is treated as stale — matches the
// Phase J onboarding default (see phaseJDeviceOnboardingSelfReport.ts).
const STALE_AFTER_SEC = 36 * 60 * 60;
const MAX_RECORDS_PER_ATHLETE = 200;
const QUERY_CONCURRENCY = 6;
const HEALTH_CONTEXT_SNAPSHOTS_COLLECTION = 'health-context-snapshots';

/**
 * Source families that represent a real worn/integrated device. Self-report and
 * coach-entered lanes are excluded from "current device" / wear-coverage so an
 * athlete who only self-reports doesn't read as "synced".
 */
const WEARABLE_FAMILY_LIST: HealthContextSourceFamily[] = [
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
];

const WEARABLE_FAMILIES = new Set<HealthContextSourceFamily>(WEARABLE_FAMILY_LIST);

const CONNECTED_SOURCE_STATES = new Set([
  'connected_synced',
  'connectedsynced',
  'connected_waiting_data',
  'connectedwaitingdata',
  'connected_waiting_for_data',
  'connected_stale',
  'connectedstale',
  'connected_error',
  'connectederror',
  'connected',
  'synced',
  'stale',
]);

const DEVICE_FAMILY_LABELS: Record<HealthContextSourceFamily, string> = {
  oura: 'Oura Ring',
  apple_health: 'Apple Watch / Health',
  healthkit: 'Apple Watch / HealthKit',
  health_kit: 'Apple Watch / HealthKit',
  apple_watch: 'Apple Watch',
  healthconnect: 'Health Connect',
  google_health: 'Google Health',
  polar: 'Polar',
  fitbit: 'Fitbit',
  whoop: 'Whoop',
  garmin: 'Garmin',
  pulsecheck_self_report: 'Self-report',
  coach_entered: 'Coach-entered',
  fit_with_pulse: 'Fit With Pulse',
  macra: 'Macra',
};

export const getDeviceFamilyLabel = (family: HealthContextSourceFamily | null): string =>
  family ? DEVICE_FAMILY_LABELS[family] || family : 'No device';

// ──────────────────────────────────────────────────────────────────────────────
// Per-day metric extraction (drives the presence-bar hover snapshot)
// ──────────────────────────────────────────────────────────────────────────────

/** Format decimal hours as "Xh Ym" (e.g. 6.27 → "6h 16m"). */
const formatHoursToHm = (hours: number): string => {
  const totalMinutes = Math.round(hours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}h ${m}m`;
};

/** Coerce an unknown payload value to a finite number, or null. */
const toFiniteNumber = (value: unknown): number | null => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const humanizeDomain = (domain: string): string => {
  const trimmed = String(domain || '').trim();
  if (!trimmed) return '';
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
};

/**
 * Merge a day's records (later `observedAt` wins per universal payload key) then
 * emit the ordered metric label/value list. Only keys actually present are
 * emitted — no invented values.
 */
const metricsFromPayload = (merged: Record<string, unknown>): Array<{ label: string; value: string }> => {
  const metrics: Array<{ label: string; value: string }> = [];
  const push = (label: string, value: string) => metrics.push({ label, value });

  const sleepDuration = toFiniteNumber(merged.sleepDuration);
  if (sleepDuration !== null && sleepDuration > 0) push('Sleep', formatHoursToHm(sleepDuration));

  const sleepEfficiency = toFiniteNumber(merged.sleepEfficiency);
  if (sleepEfficiency !== null && sleepEfficiency > 0) push('Sleep efficiency', `${Math.round(sleepEfficiency)}%`);

  const heartRateResting = toFiniteNumber(merged.heartRateResting);
  if (heartRateResting !== null && heartRateResting > 0) push('Resting HR', `${Math.round(heartRateResting)} bpm`);

  const averageHeartRate = toFiniteNumber(
    merged.averageHeartRate ?? merged.avgHeartRate ?? merged.heartRateAvg ?? merged.heartRateAverage ?? merged.averageHr,
  );
  if (averageHeartRate !== null && averageHeartRate > 0) push('Avg HR', `${Math.round(averageHeartRate)} bpm`);

  const heartRateVariability = toFiniteNumber(merged.heartRateVariability);
  if (heartRateVariability !== null && heartRateVariability > 0) push('HRV', `${Math.round(heartRateVariability)} ms`);

  const respiratoryRate = toFiniteNumber(merged.respiratoryRate);
  if (respiratoryRate !== null && respiratoryRate > 0) push('Respiratory', `${respiratoryRate.toFixed(1)} /min`);

  const readinessScore = toFiniteNumber(merged.readinessScore);
  if (readinessScore !== null && readinessScore > 0) push('Readiness', `${Math.round(readinessScore)}`);

  const deepSleepDuration = toFiniteNumber(merged.deepSleepDuration);
  if (deepSleepDuration !== null && deepSleepDuration > 0) push('Deep sleep', formatHoursToHm(deepSleepDuration));

  const remSleepDuration = toFiniteNumber(merged.remSleepDuration);
  if (remSleepDuration !== null && remSleepDuration > 0) push('REM', formatHoursToHm(remSleepDuration));

  const steps = toFiniteNumber(merged.steps);
  if (steps !== null && steps > 0) push('Steps', Math.round(steps).toLocaleString());

  const activeCalories = toFiniteNumber(merged.activeCalories);
  if (activeCalories !== null && activeCalories > 0) push('Active cal', `${Math.round(activeCalories)}`);

  const activeMinutes = toFiniteNumber(
    merged.activeMinutes
      ?? merged.exerciseMinutes
      ?? merged.totalDurationMinutes
      ?? merged.totalWorkoutDurationMinutes,
  );
  if (activeMinutes !== null && activeMinutes > 0) push('Active min', `${Math.round(activeMinutes)} min`);

  const distanceKm = toFiniteNumber(merged.distance ?? merged.distanceKm);
  const distanceMeters = toFiniteNumber(merged.distanceMeters);
  const resolvedDistanceKm = distanceKm ?? (distanceMeters !== null ? distanceMeters / 1000 : null);
  if (resolvedDistanceKm !== null && resolvedDistanceKm > 0) push('Distance', `${resolvedDistanceKm.toFixed(1)} km`);

  return metrics;
};

const extractDayMetrics = (
  records: HealthContextSourceRecord[],
): Array<{ label: string; value: string }> => {
  const merged: Record<string, unknown> = {};
  const ordered = [...records].sort(
    (left, right) => (left.observedAt ?? 0) - (right.observedAt ?? 0),
  );
  for (const record of ordered) {
    const payload = (record.payload && typeof record.payload === 'object')
      ? record.payload as Record<string, unknown>
      : {};
    for (const [key, value] of Object.entries(payload)) {
      if (value !== undefined && value !== null) merged[key] = value;
    }
  }
  return metricsFromPayload(merged);
};

/**
 * True only when a record carries at least one MEASURED value. A day whose only
 * records have empty payloads (e.g. an Oura record written when the ring wasn't
 * worn, or a placeholder training/summary record) is NOT "worn" — those must not
 * light a presence cell green or count toward coverage.
 */
const recordHasMeasuredData = (record: HealthContextSourceRecord): boolean =>
  extractDayMetrics([record]).length > 0;

const normalizedWearableFamily = (value: unknown): HealthContextSourceFamily | null => {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase() as HealthContextSourceFamily;
  return WEARABLE_FAMILIES.has(normalized) ? normalized : null;
};

const attributeRecordsByMeasuredSource = (
  records: HealthContextSourceRecord[],
): HealthContextSourceRecord[] => records.flatMap((record) => {
  const payload = asRecord(record.payload) || {};
  const fieldSources = asRecord(payload.fieldSources);
  const fieldSourceLabels = asRecord(payload.fieldSourceLabels) || {};
  if (!fieldSources || Object.keys(fieldSources).length === 0) {
    return recordHasMeasuredData(record) ? [record] : [];
  }

  const payloadsBySource = new Map<HealthContextSourceFamily, Record<string, unknown>>();
  const labelsBySource = new Map<HealthContextSourceFamily, Record<string, string>>();
  for (const [field, value] of Object.entries(payload)) {
    if (field === 'fieldSources' || field === 'fieldSourceLabels') continue;
    const sourceFamily = normalizedWearableFamily(fieldSources[field]) || record.sourceFamily;
    if (!WEARABLE_FAMILIES.has(sourceFamily)) continue;
    const attributedPayload = payloadsBySource.get(sourceFamily) || {};
    attributedPayload[field] = value;
    payloadsBySource.set(sourceFamily, attributedPayload);
    const explicitLabel = fieldSourceLabels[field];
    if (typeof explicitLabel === 'string' && explicitLabel.trim()) {
      const attributedLabels = labelsBySource.get(sourceFamily) || {};
      attributedLabels[field] = explicitLabel.trim();
      labelsBySource.set(sourceFamily, attributedLabels);
    }
  }

  return Array.from(payloadsBySource.entries()).flatMap(([sourceFamily, attributedPayload]) => {
    const attributedLabels = labelsBySource.get(sourceFamily);
    if (attributedLabels && Object.keys(attributedLabels).length > 0) {
      attributedPayload.fieldSourceLabels = attributedLabels;
    }
    const attributedRecord: HealthContextSourceRecord = {
      ...record,
      id: `${record.id}::${sourceFamily}`,
      sourceFamily,
      payload: attributedPayload,
    };
    return recordHasMeasuredData(attributedRecord) ? [attributedRecord] : [];
  });
});

const observedSecondsForRecords = (records: HealthContextSourceRecord[]): number => {
  const intervals = records
    .filter(recordHasMeasuredData)
    .map((record) => ({
      start: typeof record.observedWindowStart === 'number' ? record.observedWindowStart : null,
      end: typeof record.observedWindowEnd === 'number' ? record.observedWindowEnd : null,
    }))
    .filter((interval): interval is { start: number; end: number } =>
      interval.start !== null &&
      interval.end !== null &&
      Number.isFinite(interval.start) &&
      Number.isFinite(interval.end) &&
      interval.end > interval.start
    )
    .sort((left, right) => left.start - right.start);

  let total = 0;
  let mergedStart: number | null = null;
  let mergedEnd: number | null = null;

  for (const interval of intervals) {
    if (mergedStart === null || mergedEnd === null) {
      mergedStart = interval.start;
      mergedEnd = interval.end;
      continue;
    }
    if (interval.start <= mergedEnd) {
      mergedEnd = Math.max(mergedEnd, interval.end);
      continue;
    }
    total += mergedEnd - mergedStart;
    mergedStart = interval.start;
    mergedEnd = interval.end;
  }

  if (mergedStart !== null && mergedEnd !== null) {
    total += mergedEnd - mergedStart;
  }

  return Math.max(0, Math.min(SECONDS_PER_DAY, Math.round(total)));
};

/**
 * Infer a short wear-context note from which metric families a day produced.
 * Overnight recovery (sleep stages, HRV) vs daytime activity (steps, active cal)
 * lets the coach see *why* a metric is missing — "not worn overnight" — instead
 * of the sleep block silently disappearing.
 */
// "Worn overnight" means actual SLEEP was tracked — only sleep-stage metrics
// prove the device was on the body through the night. Secondary readings like
// resting HR / respiratory / readiness can show up from a daytime-only day on
// some devices (e.g. Fitbit), so they must NOT, on their own, imply overnight
// wear. Daytime wear shows up as activity. Drives the hover note + coverage split.
const OVERNIGHT_METRIC_LABELS = new Set([
  'Sleep', 'Deep sleep', 'REM', 'Sleep efficiency',
]);
const DAYTIME_METRIC_LABELS = new Set(['Steps', 'Active cal', 'Avg HR', 'Active min', 'Distance']);

const classifyDayWear = (
  metrics: Array<{ label: string; value: string }>,
): { hasOvernight: boolean; hasDaytime: boolean } => {
  let hasOvernight = false;
  let hasDaytime = false;
  for (const metric of metrics) {
    if (OVERNIGHT_METRIC_LABELS.has(metric.label)) hasOvernight = true;
    if (DAYTIME_METRIC_LABELS.has(metric.label)) hasDaytime = true;
  }
  return { hasOvernight, hasDaytime };
};

const deriveWearNote = (metrics: Array<{ label: string; value: string }>): string | null => {
  const { hasOvernight, hasDaytime } = classifyDayWear(metrics);
  if (hasOvernight && hasDaytime) return 'Worn day & night';
  if (hasDaytime && !hasOvernight) return 'Daytime only · not worn overnight';
  if (hasOvernight && !hasDaytime) return 'Overnight only · little daytime wear';
  return null;
};

/** Format a unix-seconds instant as "Mon D" (e.g. "Jun 13"), honoring a tz if given. */
const formatDayLabel = (unixSeconds: number, timezone?: string): string => {
  const date = new Date(unixSeconds * 1000);
  if (Number.isNaN(date.getTime())) return '';
  try {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      ...(timezone ? { timeZone: timezone } : {}),
    });
  } catch {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
};

const sourceRecordDateKey = (record: HealthContextSourceRecord): string => {
  const provenance = record.provenance as HealthContextSourceRecord['provenance'] & { rawDate?: string };
  const candidates = [
    provenance.rawDay,
    provenance.rawDate,
    record.dedupeKey?.split('|').at(-1),
    record.id?.match(/(\d{4}-\d{2}-\d{2})(?:$|::)/)?.[1],
  ];
  return candidates.find((value) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) || '';
};

// ──────────────────────────────────────────────────────────────────────────────
// Derivation
// ──────────────────────────────────────────────────────────────────────────────

const resolveDisplayName = (
  membership: PulseCheckTeamMembership,
  user: User | undefined,
): string =>
  (user?.displayName && user.displayName.trim()) ||
  (user?.username && user.username.trim()) ||
  (membership.athleteOnboarding?.entryOnboardingName?.trim()) ||
  user?.email ||
  membership.email ||
  membership.userId;

interface DeriveInput {
  membership: PulseCheckTeamMembership;
  user: User | undefined;
  records: HealthContextSourceRecord[];
  sourceStatuses?: HealthContextSourceStatus[];
  snapshotCoverageDays?: SnapshotWearableCoverageDay[];
  now: number;
  windowStart: number;
  windowDays: number;
  windowDateKeys?: string[];
  evidenceState?: AthleteDeviceEvidenceState;
}

interface HealthContextSourceStatus {
  sourceFamily: HealthContextSourceFamily;
  teamId?: string;
  organizationId?: string;
  lifecycleState?: string;
  status?: string;
  connectionState?: string;
  lastObservedRecordAt?: number;
  lastSuccessfulSyncAt?: number;
  lastSyncedAt?: number;
  lastAttemptedSyncAt?: number;
}

interface SnapshotWearableCoverageDay {
  dayIndex: number;
  dateKey: string;
  observedAt: number | null;
  sourceFamily: HealthContextSourceFamily;
  sourceLabel: string;
  domains: string[];
  metrics: Array<{ label: string; value: string }>;
}

interface EvidenceLoadResult<T> {
  value: T;
  state: AthleteDeviceEvidenceState;
}

const evidenceStateFromSettled = (
  results: PromiseSettledResult<unknown>[]
): AthleteDeviceEvidenceState => {
  const fulfilled = results.filter((result) => result.status === 'fulfilled').length;
  if (fulfilled === results.length) return 'available';
  return fulfilled > 0 ? 'partial' : 'unavailable';
};

const matchesWorkspaceOrUnscopedSelf = (
  data: Record<string, unknown>,
  workspace: PulseCheckWorkspaceScope | undefined,
  allowUnscopedSelf: boolean
): boolean => {
  if (!workspace || pulseCheckRecordMatchesWorkspace(data, workspace)) return true;
  if (!allowUnscopedSelf) return false;
  const teamId = typeof data.teamId === 'string' ? data.teamId.trim() : '';
  const organizationId = typeof data.organizationId === 'string'
    ? data.organizationId.trim()
    : '';
  return (!teamId || teamId === workspace.teamId)
    && (!organizationId || organizationId === workspace.organizationId);
};

const toUnixSeconds = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value > 10_000_000_000 ? Math.round(value / 1000) : Math.round(value);
  }
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    return Math.round(value.getTime() / 1000);
  }
  if (value && typeof value === 'object') {
    const maybeTimestamp = value as { seconds?: number; toDate?: () => Date };
    if (typeof maybeTimestamp.seconds === 'number') return maybeTimestamp.seconds;
    if (typeof maybeTimestamp.toDate === 'function') {
      const date = maybeTimestamp.toDate();
      return date instanceof Date && Number.isFinite(date.getTime()) ? Math.round(date.getTime() / 1000) : null;
    }
  }
  return null;
};

const sourceStatusTime = (status: HealthContextSourceStatus): number =>
  toUnixSeconds(status.lastObservedRecordAt) ||
  toUnixSeconds(status.lastSuccessfulSyncAt) ||
  toUnixSeconds(status.lastSyncedAt) ||
  toUnixSeconds(status.lastAttemptedSyncAt) ||
  0;

const normalizeLifecycleState = (value: string): string =>
  value.trim().replace(/-/g, '_').toLowerCase();

const isConnectedSourceStatus = (status: HealthContextSourceStatus): boolean => {
  const raw = String(status.lifecycleState || status.status || status.connectionState || '').trim();
  if (!raw) return false;
  const normalized = normalizeLifecycleState(raw);
  return CONNECTED_SOURCE_STATES.has(normalized) || normalized.startsWith('connected_');
};

const buildSourceStatusFromEntry = (
  family: HealthContextSourceFamily,
  entry: unknown,
): HealthContextSourceStatus | null => {
  if (!entry) return null;
  if (typeof entry === 'string') {
    return { sourceFamily: family, lifecycleState: entry, status: entry };
  }
  if (typeof entry !== 'object') return null;
  const data = entry as Record<string, unknown>;
  return {
    sourceFamily: sourceFamilyForStatus(data, family),
    teamId: typeof data.teamId === 'string' ? data.teamId : undefined,
    organizationId:
      typeof data.organizationId === 'string' ? data.organizationId : undefined,
    lifecycleState: data.lifecycleState as string | undefined,
    status: data.status as string | undefined,
    connectionState: data.connectionState as string | undefined,
    lastObservedRecordAt: toUnixSeconds(data.lastObservedRecordAt) || undefined,
    lastSuccessfulSyncAt: toUnixSeconds(data.lastSuccessfulSyncAt) || undefined,
    lastSyncedAt: toUnixSeconds(data.lastSyncedAt) || undefined,
    lastAttemptedSyncAt: toUnixSeconds(data.lastAttemptedSyncAt) || undefined,
  };
};

const sourceFamilyForStatus = (
  data: Record<string, unknown>,
  fallback: HealthContextSourceFamily,
): HealthContextSourceFamily => {
  const rawFamily = normalizedWearableFamily(data.sourceFamily) || fallback;
  if (rawFamily !== 'fitbit') return rawFamily;

  const consentMetadata = asRecord(data.consentMetadata) || {};
  const provider = String(consentMetadata.provider || data.provider || '').trim().toLowerCase();
  if (provider !== 'google_health') return rawFamily;

  const deviceMetadata = asRecord(data.deviceMetadata)
    || asRecord(consentMetadata.deviceMetadata)
    || {};
  const verifiedFitbitIdentity = [
    deviceMetadata.manufacturer,
    deviceMetadata.brand,
    deviceMetadata.model,
    deviceMetadata.displayName,
  ].some((value) => typeof value === 'string' && value.toLowerCase().includes('fitbit'));
  return verifiedFitbitIdentity ? 'fitbit' : 'google_health';
};

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;

const normalizeSnapshotToken = (value: unknown): string =>
  typeof value === 'string'
    ? value.trim().replace(/[-_\s]/g, '').toLowerCase()
    : '';

const freshnessIsUsable = (value: unknown): boolean => {
  const normalized = normalizeSnapshotToken(value);
  return !normalized || ![
    'missing',
    'stale',
    'error',
    'permissiondenied',
    'notconnected',
  ].includes(normalized);
};

const DAYTIME_WEARABLE_METRIC_KEYS = new Set([
  'steps',
  'activecalories',
  'totalcalories',
  'distance',
  'distancemeters',
  'exerciseminutes',
  'activeminutes',
  'standhours',
  'workoutcount',
  'heartrateavg',
  'avgheartrate',
  'averageheartrate',
  'heartrateaverage',
  'heartratebpm',
  'liveheartratebpm',
  'samplecount',
  'heartratesamples',
]);

const OVERNIGHT_WEARABLE_METRIC_KEYS = new Set([
  'sleepduration',
  'sleepdurationhours',
  'totalsleephours',
  'totalsleepmin',
  'totalsleepminutes',
  'sleepefficiency',
  'sleepscore',
  'timeinbedhours',
  'bedtimestart',
  'bedtimeend',
  'sleepmidpoint',
  'recoveryscore',
  'readinessscore',
  'heartratevariability',
  'hrv',
  'hrvms',
  'hrvrmssd',
  'rmssdms',
  'restingheartrate',
  'heartrateresting',
  'restingheartratebpm',
]);

const sourceCanRepresentWearable = (sourceFamily: unknown): boolean => {
  const normalized = normalizeSnapshotToken(sourceFamily);
  if (!normalized) return true;
  if ([
    'quicklifts',
    'fitwithpulse',
    'pulsecheckselfreport',
    'coachentered',
    'manual',
  ].includes(normalized)) {
    return false;
  }
  return WEARABLE_FAMILY_LIST.some((family) => normalizeSnapshotToken(family) === normalized)
    || normalized.includes('wearable');
};

const flattenedSnapshotMetricPayload = (block: Record<string, unknown>): Record<string, unknown> => {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(block)) {
    if (![
      'data',
      'payload',
      'rollup',
      'freshness',
      'provenance',
      'sourceStatus',
      'generatedAt',
      'updatedAt',
    ].includes(key)) {
      result[key.toLowerCase()] = value;
    }
  }
  for (const nestedKey of ['data', 'payload', 'rollup']) {
    const nested = asRecord(block[nestedKey]);
    if (!nested) continue;
    for (const [key, value] of Object.entries(nested)) {
      result[key.toLowerCase()] = value;
    }
  }
  return result;
};

const snapshotMetricPayload = (block: Record<string, unknown>): Record<string, unknown> => {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(block)) {
    if (!['data', 'payload', 'rollup', 'freshness', 'provenance', 'sourceStatus'].includes(key)) {
      result[key] = value;
    }
  }
  for (const nestedKey of ['data', 'payload', 'rollup']) {
    const nested = asRecord(block[nestedKey]);
    if (nested) Object.assign(result, nested);
  }
  return result;
};

const snapshotBlockHasUsableMetric = (
  block: Record<string, unknown>,
  keys: Set<string>,
): boolean => {
  const flattened = flattenedSnapshotMetricPayload(block);
  return Array.from(keys).some((key) => {
    const value = flattened[key];
    if (value === undefined || value === null) return false;
    const numeric = toFiniteNumber(value);
    if (numeric !== null) return numeric > 0;
    if (typeof value === 'string') return value.trim().length > 0;
    if (Array.isArray(value)) return value.length > 0;
    return false;
  });
};

const snapshotHasWearableCoverage = (data: Record<string, unknown>): boolean => {
  const domains = asRecord(data.domains) || {};
  const provenance = asRecord(data.provenance) || {};
  const domainWinners = asRecord(provenance.domainWinners) || {};
  const freshness = asRecord(data.freshness) || {};
  const perDomainFreshness = asRecord(freshness.perDomain) || {};

  const blockFor = (domain: string): Record<string, unknown> => {
    const domainBlock = asRecord(domains[domain]) || {};
    return Object.keys(domainBlock).length > 0 ? domainBlock : asRecord(data[domain]) || {};
  };

  const sourceFamilyFor = (domain: string, block: Record<string, unknown>): unknown => {
    const blockProvenance = asRecord(block.provenance) || {};
    return blockProvenance.primarySource
      ?? domainWinners[domain]
      ?? block.sourceFamily
      ?? data.sourceFamily;
  };

  for (const domain of ['activity', 'training', 'workout', 'biometrics', 'cardio', 'heart']) {
    const block = blockFor(domain);
    if (
      Object.keys(block).length > 0
      && sourceCanRepresentWearable(sourceFamilyFor(domain, block))
      && freshnessIsUsable(block.freshness ?? perDomainFreshness[domain] ?? freshness[domain])
      && snapshotBlockHasUsableMetric(block, DAYTIME_WEARABLE_METRIC_KEYS)
    ) {
      return true;
    }
  }

  for (const domain of ['recovery', 'sleep']) {
    const block = blockFor(domain);
    if (
      Object.keys(block).length > 0
      && sourceCanRepresentWearable(sourceFamilyFor(domain, block))
      && freshnessIsUsable(block.freshness ?? perDomainFreshness[domain] ?? freshness[domain])
      && snapshotBlockHasUsableMetric(block, OVERNIGHT_WEARABLE_METRIC_KEYS)
    ) {
      return true;
    }
  }

  return false;
};

const latestSnapshotObservationTime = (data: Record<string, unknown>): number | null => {
  const provenance = asRecord(data.provenance) || {};
  const observationTimes = asRecord(provenance.sourceObservationTimes) || {};
  const domains = asRecord(data.domains) || {};
  const candidates = [
    ...Object.values(observationTimes),
    ...Object.values(domains).flatMap((value) => {
      const block = asRecord(value);
      return block ? [block.observedAt, block.updatedAt, block.generatedAt] : [];
    }),
    data.latestObservedAt,
    data.generatedAt,
    data.updatedAt,
  ].map(toUnixSeconds).filter((value): value is number => value !== null);
  return candidates.length ? Math.max(...candidates) : null;
};

const attributedSnapshotCoverageDays = (
  data: Record<string, unknown>,
  dayIndex: number,
  dateKey: string,
): SnapshotWearableCoverageDay[] => {
  const domains = asRecord(data.domains) || {};
  const freshness = asRecord(data.freshness) || {};
  const perDomainFreshness = asRecord(freshness.perDomain) || {};
  const grouped = new Map<HealthContextSourceFamily, {
    sourceLabel: string;
    domains: Set<string>;
    payload: Record<string, unknown>;
  }>();

  for (const domain of ['recovery', 'activity', 'training', 'biometrics']) {
    const block = asRecord(domains[domain]) || asRecord(data[domain]) || {};
    if (!freshnessIsUsable(block.freshness ?? perDomainFreshness[domain] ?? freshness[domain])) continue;
    const payload = snapshotMetricPayload(block);
    const fieldSources = asRecord(payload.fieldSources);
    const fieldSourceLabels = asRecord(payload.fieldSourceLabels) || {};
    if (!fieldSources) continue;

    for (const [field, rawSource] of Object.entries(fieldSources)) {
      const sourceFamily = normalizedWearableFamily(rawSource);
      if (!sourceFamily || payload[field] === undefined || payload[field] === null) continue;
      const entry = grouped.get(sourceFamily) || {
        sourceLabel: getDeviceFamilyLabel(sourceFamily),
        domains: new Set<string>(),
        payload: {},
      };
      entry.payload[field] = payload[field];
      entry.domains.add(humanizeDomain(domain));
      const explicitLabel = fieldSourceLabels[field];
      if (typeof explicitLabel === 'string' && explicitLabel.trim()) {
        entry.sourceLabel = explicitLabel.trim();
      }
      grouped.set(sourceFamily, entry);
    }
  }

  const observedAt = latestSnapshotObservationTime(data);
  return Array.from(grouped.entries()).flatMap(([sourceFamily, entry]) => {
    const metrics = metricsFromPayload(entry.payload);
    if (metrics.length === 0) return [];
    return [{
      dayIndex,
      dateKey,
      observedAt,
      sourceFamily,
      sourceLabel: entry.sourceLabel,
      domains: Array.from(entry.domains),
      metrics,
    }];
  });
};

const loadSnapshotWearableCoverageDays = async (
  athleteUserId: string,
  windowDateKeys: string[],
  workspace?: PulseCheckWorkspaceScope,
  allowUnscopedSelf: boolean = false,
): Promise<EvidenceLoadResult<SnapshotWearableCoverageDay[]>> => {
  const entries = await Promise.allSettled(
    windowDateKeys.map(async (dateKey, dayIndex): Promise<SnapshotWearableCoverageDay[]> => {
      const snap = await getDoc(
        doc(db, HEALTH_CONTEXT_SNAPSHOTS_COLLECTION, `${athleteUserId}_daily_${dateKey}`)
      );
      if (!snap.exists()) return [];
      const data = snap.data() as Record<string, unknown>;
      if (!matchesWorkspaceOrUnscopedSelf(data, workspace, allowUnscopedSelf)) return [];
      if (!snapshotHasWearableCoverage(data)) return [];
      return attributedSnapshotCoverageDays(data, dayIndex, dateKey);
    })
  );
  return {
    value: entries.flatMap((entry) =>
      entry.status === 'fulfilled' ? entry.value : []
    ),
    state: evidenceStateFromSettled(entries),
  };
};

const loadSharedSourceStatusMap = async (
  athleteUserId: string,
  workspace?: PulseCheckWorkspaceScope,
  allowUnscopedSelf: boolean = false,
): Promise<HealthContextSourceStatus[]> => {
  const snap = await getDoc(doc(db, 'health-context-source-status', athleteUserId));
  if (!snap.exists()) return [];
  const data = snap.data() as Record<string, unknown>;
  if (!matchesWorkspaceOrUnscopedSelf(data, workspace, allowUnscopedSelf)) return [];
  const sourceStatuses = (data.sourceStatuses && typeof data.sourceStatuses === 'object')
    ? data.sourceStatuses as Record<string, unknown>
    : data;
  return WEARABLE_FAMILY_LIST
    .map((family) => buildSourceStatusFromEntry(family, sourceStatuses[family]))
    .filter((entry): entry is HealthContextSourceStatus => !!entry);
};

const loadNestedAthleteSourceStatus = async (
  athleteUserId: string,
  workspace?: PulseCheckWorkspaceScope,
  allowUnscopedSelf: boolean = false,
): Promise<HealthContextSourceStatus[]> => {
  const snap = await getDoc(doc(db, 'athletes', athleteUserId, 'health-context-source-status', 'current'));
  if (!snap.exists()) return [];
  const data = snap.data() as Record<string, unknown>;
  if (!matchesWorkspaceOrUnscopedSelf(data, workspace, allowUnscopedSelf)) return [];
  return WEARABLE_FAMILY_LIST
    .map((family) => buildSourceStatusFromEntry(family, data[family]))
    .filter((entry): entry is HealthContextSourceStatus => !!entry);
};

const loadWearableSourceStatuses = async (
  athleteUserId: string,
  workspace?: PulseCheckWorkspaceScope,
  allowUnscopedSelf: boolean = false,
): Promise<EvidenceLoadResult<HealthContextSourceStatus[]>> => {
  const operations: Array<Promise<HealthContextSourceStatus[]>> = [
    loadSharedSourceStatusMap(athleteUserId, workspace, allowUnscopedSelf),
    loadNestedAthleteSourceStatus(athleteUserId, workspace, allowUnscopedSelf),
    ...WEARABLE_FAMILY_LIST.map(async (family): Promise<HealthContextSourceStatus[]> => {
      const snap = await getDoc(doc(db, 'health-context-source-status', `${athleteUserId}_${family}`));
      if (!snap.exists()) return [];
      const data = snap.data() as Record<string, unknown>;
      if (!matchesWorkspaceOrUnscopedSelf(data, workspace, allowUnscopedSelf)) return [];
      return [{
        sourceFamily: sourceFamilyForStatus(data, family),
        teamId: typeof data.teamId === 'string' ? data.teamId : undefined,
        organizationId: typeof data.organizationId === 'string' ? data.organizationId : undefined,
        lifecycleState: data.lifecycleState as string | undefined,
        status: data.status as string | undefined,
        connectionState: data.connectionState as string | undefined,
        lastObservedRecordAt: toUnixSeconds(data.lastObservedRecordAt) || undefined,
        lastSuccessfulSyncAt: toUnixSeconds(data.lastSuccessfulSyncAt) || undefined,
        lastSyncedAt: toUnixSeconds(data.lastSyncedAt) || undefined,
        lastAttemptedSyncAt: toUnixSeconds(data.lastAttemptedSyncAt) || undefined,
      }];
    }),
  ];
  const settled = await Promise.allSettled(operations);
  return {
    value: settled.flatMap((entry) => entry.status === 'fulfilled' ? entry.value : []),
    state: evidenceStateFromSettled(settled),
  };
};

export const deriveAthleteDeviceStatus = ({
  membership,
  user,
  records,
  sourceStatuses = [],
  snapshotCoverageDays = [],
  now,
  windowStart,
  windowDays,
  windowDateKeys,
  evidenceState = 'available',
}: DeriveInput): AthleteDeviceStatus => {
  const wearableRecords = attributeRecordsByMeasuredSource(
    records.filter((record) => WEARABLE_FAMILIES.has(record.sourceFamily))
  );
  const connectedStatuses = sourceStatuses.filter(isConnectedSourceStatus);

  // Pick the freshest connected source-status per family (an athlete can have
  // several status writes for the same family across the status collections).
  const connectedStatusByFamily = new Map<HealthContextSourceFamily, HealthContextSourceStatus>();
  for (const status of connectedStatuses) {
    const existing = connectedStatusByFamily.get(status.sourceFamily);
    if (!existing || sourceStatusTime(status) > sourceStatusTime(existing)) {
      connectedStatusByFamily.set(status.sourceFamily, status);
    }
  }

  // Families to surface = every family that produced records UNION every family
  // with a connected source-status (so a connected-but-no-data-yet device shows).
  const families = new Set<HealthContextSourceFamily>();
  for (const record of wearableRecords) families.add(record.sourceFamily);
  for (const family of connectedStatusByFamily.keys()) families.add(family);
  for (const day of snapshotCoverageDays) families.add(day.sourceFamily);
  const dateIndexByKey = windowDateKeys
    ? new Map(windowDateKeys.map((dateKey, index) => [dateKey, index]))
    : null;

  const devices: AthleteDevicePerSourceStatus[] = Array.from(families).map((family) => {
    const familyRecords = wearableRecords.filter((record) => record.sourceFamily === family);
    const status = connectedStatusByFamily.get(family) || null;
    const familySnapshotDays = snapshotCoverageDays.filter((day) => day.sourceFamily === family);
    const snapshotDayByIndex = new Map(familySnapshotDays.map((day) => [day.dayIndex, day]));
    const sourceRecordLabel = familyRecords.reduce<string | null>((label, record) => {
      if (label) return label;
      const labels = asRecord(asRecord(record.payload)?.fieldSourceLabels);
      if (!labels) return null;
      const explicitLabel = Object.values(labels).find(
        (value) => typeof value === 'string' && value.trim()
      );
      return typeof explicitLabel === 'string' ? explicitLabel.trim() : null;
    }, null);
    const sourceLabel = familySnapshotDays.find((day) => day.sourceLabel)?.sourceLabel
      || sourceRecordLabel
      || getDeviceFamilyLabel(family);

    let lastObservedAt: number | null = null;
    let lastSyncedAt: number | null = null;
    // Bucket this family's records by day index within the window so we can build
    // a per-day data snapshot for the presence-bar hover tooltip.
    const recordsByDay = new Map<number, HealthContextSourceRecord[]>();

    for (const record of familyRecords) {
      if (typeof record.observedAt === 'number') {
        // "Last data" must reflect the most recent record that actually carried
        // measured values — not an empty placeholder/sync record.
        if (recordHasMeasuredData(record) && (lastObservedAt === null || record.observedAt > lastObservedAt)) {
          lastObservedAt = record.observedAt;
        }
        const observedDate = new Date(record.observedAt * 1000);
        const observedDateKey = sourceRecordDateKey(record) || (Number.isNaN(observedDate.getTime())
          ? ''
          : `${observedDate.getFullYear()}-${String(observedDate.getMonth() + 1).padStart(2, '0')}-${String(observedDate.getDate()).padStart(2, '0')}`);
        const dayIndex = dateIndexByKey
          ? dateIndexByKey.get(observedDateKey)
          : Math.floor((record.observedAt - windowStart) / SECONDS_PER_DAY);
        if (dayIndex !== undefined && dayIndex >= 0 && dayIndex < windowDays) {
          const bucket = recordsByDay.get(dayIndex);
          if (bucket) bucket.push(record);
          else recordsByDay.set(dayIndex, [record]);
        }
      }
      if (typeof record.ingestedAt === 'number' && (lastSyncedAt === null || record.ingestedAt > lastSyncedAt)) {
        lastSyncedAt = record.ingestedAt;
      }
    }

    for (const snapshotDay of familySnapshotDays) {
      if (
        snapshotDay.observedAt !== null
        && (lastObservedAt === null || snapshotDay.observedAt > lastObservedAt)
      ) {
        lastObservedAt = snapshotDay.observedAt;
      }
    }
    if (lastSyncedAt === null && status) {
      lastSyncedAt = toUnixSeconds(status.lastSuccessfulSyncAt)
        || toUnixSeconds(status.lastSyncedAt)
        || toUnixSeconds(status.lastAttemptedSyncAt);
    }

    let connectionStatus: AthleteDeviceConnectionStatus;
    if (lastObservedAt !== null && now - lastObservedAt <= STALE_AFTER_SEC) {
      connectionStatus = 'synced';
    } else if (status) {
      // Connected source, but data is old or none has arrived yet.
      connectionStatus = 'stale';
    } else {
      connectionStatus = 'not_connected';
    }

    // A day counts as worn only when this source produced a measured value.
    const dailyDetails: (AthleteDeviceDayDetail | null)[] = Array.from(
      { length: windowDays },
      (_, day): AthleteDeviceDayDetail | null => {
        const dayRecords = recordsByDay.get(day);
        if (!dayRecords || dayRecords.length === 0) {
          const snapshotDay = snapshotDayByIndex.get(day);
          if (!snapshotDay) return null;
          return {
            dayIndex: day,
            dateLabel: formatDayLabel(snapshotDay.observedAt || windowStart + day * SECONDS_PER_DAY),
            observedSeconds: 0,
            recordCount: 0,
            domains: snapshotDay.domains,
            metrics: snapshotDay.metrics,
            wearNote: deriveWearNote(snapshotDay.metrics),
          };
        }
        const metrics = extractDayMetrics(dayRecords);
        if (metrics.length === 0) return null;
        const maxObservedAt = dayRecords.reduce(
          (max, record) => (typeof record.observedAt === 'number' && record.observedAt > max ? record.observedAt : max),
          0,
        );
        const latestRecord = dayRecords.find((record) => record.observedAt === maxObservedAt);
        const domains = Array.from(
          new Set(dayRecords.map((record) => humanizeDomain(record.domain)).filter(Boolean)),
        );
        return {
          dayIndex: day,
          dateLabel: formatDayLabel(maxObservedAt, latestRecord?.timezone),
          observedSeconds: observedSecondsForRecords(dayRecords),
          recordCount: dayRecords.length,
          domains,
          metrics,
          wearNote: deriveWearNote(metrics),
        };
      },
    );

    const dailyPresence = dailyDetails.map((detail) => detail !== null);
    const wearDaysCovered = dailyPresence.reduce((sum, present) => sum + (present ? 1 : 0), 0);
    const wearCoveragePct = windowDays > 0 ? Math.round((wearDaysCovered / windowDays) * 100) : 0;

    // Split wear into overnight (recovery) vs daytime (activity) so a device that
    // logs steps all day but is taken off at night reads honestly.
    const overnightPresence = dailyDetails.map((detail) => (detail ? classifyDayWear(detail.metrics).hasOvernight : false));
    const daytimePresence = dailyDetails.map((detail) => (detail ? classifyDayWear(detail.metrics).hasDaytime : false));
    const overnightDaysCovered = overnightPresence.reduce((sum, present) => sum + (present ? 1 : 0), 0);
    const daytimeDaysCovered = daytimePresence.reduce((sum, present) => sum + (present ? 1 : 0), 0);
    const overnightCoveragePct = windowDays > 0 ? Math.round((overnightDaysCovered / windowDays) * 100) : 0;
    const daytimeCoveragePct = windowDays > 0 ? Math.round((daytimeDaysCovered / windowDays) * 100) : 0;

    return {
      sourceFamily: family,
      label: sourceLabel,
      connectionStatus,
      lastObservedAt,
      lastSyncedAt,
      wearDaysCovered,
      windowDays,
      wearCoveragePct,
      overnightDaysCovered,
      overnightCoveragePct,
      overnightPresence,
      daytimeDaysCovered,
      daytimeCoveragePct,
      daytimePresence,
      dailyPresence,
      dailyDetails,
    };
  });

  // Best device first: most-recent data (nulls last), then synced before stale.
  const connectionRank: Record<AthleteDeviceConnectionStatus, number> = {
    synced: 0,
    stale: 1,
    not_connected: 2,
  };
  devices.sort((left, right) => {
    const leftObs = left.lastObservedAt ?? -1;
    const rightObs = right.lastObservedAt ?? -1;
    if (leftObs !== rightObs) return rightObs - leftObs;
    return connectionRank[left.connectionStatus] - connectionRank[right.connectionStatus];
  });

  const best = devices[0] ?? null;
  const dailyPresence = Array.from(
    { length: windowDays },
    (_, dayIndex) => devices.some((device) => device.dailyPresence[dayIndex])
  );
  const wearDaysCovered = dailyPresence.reduce((sum, present) => sum + (present ? 1 : 0), 0);
  const lastObservedAt = devices.reduce<number | null>(
    (latest, device) => device.lastObservedAt !== null && (latest === null || device.lastObservedAt > latest)
      ? device.lastObservedAt
      : latest,
    null
  );
  const connectionStatus: AthleteDeviceConnectionStatus = best
    ? best.connectionStatus
    : lastObservedAt !== null && now - lastObservedAt <= STALE_AFTER_SEC
      ? 'synced'
      : wearDaysCovered > 0
        ? 'stale'
        : 'not_connected';

  return {
    athleteUserId: membership.userId,
    displayName: resolveDisplayName(membership, user),
    email: user?.email || membership.email,
    currentDeviceFamily: best?.sourceFamily ?? null,
    currentDeviceLabel: best ? best.label : getDeviceFamilyLabel(null),
    connectionStatus,
    evidenceState,
    lastObservedAt,
    lastSyncedAt: best?.lastSyncedAt ?? null,
    wearDaysCovered,
    windowDays,
    wearCoveragePct: windowDays > 0 ? Math.round((wearDaysCovered / windowDays) * 100) : 0,
    dailyPresence,
    totalRecords: wearableRecords.length,
    devices,
  };
};

export const deriveAthleteDeviceStatusFromEvidence = (
  evidence: AthleteDeviceEvidencePayload,
  athlete: {
    id: string;
    displayName?: string;
    username?: string;
    email?: string;
  },
): AthleteDeviceStatus => {
  const windowDays = safeWindow(evidence.windowDays || evidence.windowDateKeys?.length || 14);
  const computedAt = Number.isFinite(evidence.computedAt)
    ? evidence.computedAt
    : Math.round(Date.now() / 1000);
  const windowDateKeys = Array.isArray(evidence.windowDateKeys)
    ? evidence.windowDateKeys
        .filter((value) => /^\d{4}-\d{2}-\d{2}$/.test(value))
        .slice(-windowDays)
    : [];
  const windowStart = Number.isFinite(evidence.windowStart)
    ? evidence.windowStart
    : computedAt - windowDays * SECONDS_PER_DAY;
  const evidenceState: AthleteDeviceEvidenceState = [
    'available',
    'partial',
    'unavailable',
  ].includes(evidence.evidenceState)
    ? evidence.evidenceState
    : 'unavailable';

  return deriveAthleteDeviceStatus({
    membership: {
      userId: athlete.id,
      role: 'athlete',
      email: athlete.email,
    } as PulseCheckTeamMembership,
    user: {
      id: athlete.id,
      displayName: athlete.displayName,
      username: athlete.username,
      email: athlete.email,
    } as User,
    records: Array.isArray(evidence.records) ? evidence.records : [],
    now: computedAt,
    windowStart,
    windowDays,
    windowDateKeys: windowDateKeys.length === windowDays ? windowDateKeys : undefined,
    evidenceState,
  });
};

const latestUnixSeconds = (...values: Array<number | null>): number | null => {
  const finiteValues = values.filter((value): value is number =>
    typeof value === 'number' && Number.isFinite(value)
  );
  return finiteValues.length > 0 ? Math.max(...finiteValues) : null;
};

/**
 * Coach device evidence is projected server-side so staff can read measured
 * days without receiving an athlete's raw wearable records. Connection state
 * remains a separate client-readable lane. Merge the lanes so the secure
 * projection does not erase a connected device, or vice versa.
 */
export const mergeAthleteDeviceStatusEvidence = (
  measured: AthleteDeviceStatus,
  connectionContext?: AthleteDeviceStatus,
): AthleteDeviceStatus => {
  if (!connectionContext) return measured;
  if (measured.evidenceState === 'unavailable') {
    return { ...connectionContext, evidenceState: 'unavailable' };
  }

  const connectionByFamily = new Map(
    connectionContext.devices.map((device) => [device.sourceFamily, device])
  );
  const measuredFamilies = new Set(measured.devices.map((device) => device.sourceFamily));
  const devices = measured.devices.map((device) => {
    const connection = connectionByFamily.get(device.sourceFamily);
    if (!connection) return device;
    return {
      ...device,
      label: device.label || connection.label,
      connectionStatus: connection.connectionStatus !== 'not_connected'
        ? connection.connectionStatus
        : device.connectionStatus,
      lastObservedAt: latestUnixSeconds(device.lastObservedAt, connection.lastObservedAt),
      lastSyncedAt: latestUnixSeconds(device.lastSyncedAt, connection.lastSyncedAt),
    };
  });
  devices.push(
    ...connectionContext.devices.filter((device) => !measuredFamilies.has(device.sourceFamily))
  );

  const connectionStatus: AthleteDeviceConnectionStatus = devices.some(
    (device) => device.connectionStatus === 'synced'
  )
    ? 'synced'
    : devices.some((device) => device.connectionStatus === 'stale')
      ? 'stale'
      : 'not_connected';
  const primaryDevice = devices.find(
    (device) => device.sourceFamily === measured.currentDeviceFamily
  ) || devices[0] || null;

  return {
    ...measured,
    currentDeviceFamily: primaryDevice?.sourceFamily ?? null,
    currentDeviceLabel: primaryDevice?.label ?? getDeviceFamilyLabel(null),
    connectionStatus,
    lastObservedAt: latestUnixSeconds(measured.lastObservedAt, connectionContext.lastObservedAt),
    lastSyncedAt: latestUnixSeconds(measured.lastSyncedAt, connectionContext.lastSyncedAt),
    devices,
  };
};

// ──────────────────────────────────────────────────────────────────────────────
// Team-level loader
// ──────────────────────────────────────────────────────────────────────────────

const mapWithConcurrency = async <TIn, TOut>(
  items: TIn[],
  concurrency: number,
  worker: (item: TIn, index: number) => Promise<TOut>,
): Promise<TOut[]> => {
  const results: TOut[] = new Array(items.length);
  let cursor = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index], index);
    }
  });
  await Promise.all(runners);
  return results;
};

const safeWindow = (windowDays: number): number => Math.max(1, Math.min(Math.floor(windowDays), 90));

const loadDeviceStatusesForMemberships = async (
  athletes: PulseCheckTeamMembership[],
  windowDays: number,
  preloadedUserById?: Map<string, User>,
  workspace?: PulseCheckWorkspaceScope,
  allowUnscopedRosterEvidence: boolean = false,
): Promise<TeamDeviceStatusResult> => {
  const safeWindowDays = safeWindow(windowDays);
  const now = Math.round(Date.now() / 1000);
  const scopedWindowDates = workspace
    ? Array.from({ length: safeWindowDays }, (_, index) => {
        const date = new Date();
        date.setHours(0, 0, 0, 0);
        date.setDate(date.getDate() - (safeWindowDays - 1 - index));
        return date;
      })
    : null;
  const windowDateKeys = scopedWindowDates?.map(
    (date) =>
      `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  );
  const windowStart = scopedWindowDates?.[0]
    ? Math.round(scopedWindowDates[0].getTime() / 1000)
    : now - safeWindowDays * SECONDS_PER_DAY;

  const athleteIds = athletes.map((membership) => membership.userId);
  const userById = preloadedUserById || new Map(
    (athleteIds.length ? await userService.getUsersByIds(athleteIds) : []).map((user) => [user.id, user])
  );

  const statuses = await mapWithConcurrency(athletes, QUERY_CONCURRENCY, async (membership) => {
    const allowUnscopedSelf = auth.currentUser?.uid === membership.userId;
    const allowUnscopedCompatibleEvidence = allowUnscopedSelf || allowUnscopedRosterEvidence;
    const sourceRecordWorkspace = allowUnscopedSelf ? undefined : workspace;
    const [recordsLoad, sourceStatusesLoad, snapshotCoverageLoad] = await Promise.all([
      listHealthContextSourceRecordsForWindow(membership.userId, windowStart, now, {
        max: MAX_RECORDS_PER_ATHLETE,
        indexIndependent: allowUnscopedSelf,
        ...(sourceRecordWorkspace ? { workspace: sourceRecordWorkspace } : {}),
      }).then((records): EvidenceLoadResult<HealthContextSourceRecord[]> => ({
        value: records.filter((record) => allowUnscopedSelf || matchesWorkspaceOrUnscopedSelf(
            record as unknown as Record<string, unknown>,
            workspace,
            false
          )
        ),
        state: 'available',
      })).catch((error): EvidenceLoadResult<HealthContextSourceRecord[]> => {
        console.warn(
          `[pulsecheckDeviceMonitor] health-context-source-records unavailable for ${membership.userId}`,
          error,
        );
        return { value: [], state: 'unavailable' };
      }),
      loadWearableSourceStatuses(
        membership.userId,
        workspace,
        allowUnscopedCompatibleEvidence
      ),
      workspace && windowDateKeys
        ? loadSnapshotWearableCoverageDays(
            membership.userId,
            windowDateKeys,
            workspace,
            allowUnscopedCompatibleEvidence
          )
        : Promise.resolve({
            value: [] as SnapshotWearableCoverageDay[],
            state: 'available' as const,
          }),
    ]);
    const laneStates = [recordsLoad.state, sourceStatusesLoad.state, snapshotCoverageLoad.state];
    const hasReadableDeviceEvidence = recordsLoad.value.length > 0
      || sourceStatusesLoad.value.length > 0
      || snapshotCoverageLoad.value.length > 0;
    const evidenceState: AthleteDeviceEvidenceState = !hasReadableDeviceEvidence
      ? 'unavailable'
      : laneStates.every((state) => state === 'available')
        ? 'available'
        : laneStates.every((state) => state === 'unavailable')
          ? 'unavailable'
          : 'partial';
    return deriveAthleteDeviceStatus({
      membership,
      user: userById.get(membership.userId),
      records: recordsLoad.value,
      sourceStatuses: sourceStatusesLoad.value,
      snapshotCoverageDays: snapshotCoverageLoad.value,
      now,
      windowStart,
      windowDays: safeWindowDays,
      windowDateKeys: windowDateKeys || undefined,
      evidenceState,
    });
  });

  // Most-recently-active athletes first, then everyone never-connected at the bottom.
  statuses.sort((left, right) => (right.lastObservedAt ?? 0) - (left.lastObservedAt ?? 0));

  return {
    statuses,
    windowDays: safeWindowDays,
    computedAt: now,
    athleteCount: athletes.length,
  };
};

/**
 * Load the live device + wear status for every athlete on a team.
 * Pulls the roster from team memberships (role === 'athlete'), resolves names
 * from the users collection, then derives each athlete's status from their
 * health-context-source-records inside the rolling window.
 */
export const loadTeamDeviceStatuses = async (
  teamId: string,
  windowDays: number = DEVICE_MONITOR_DEFAULT_WINDOW_DAYS,
): Promise<TeamDeviceStatusResult> => {
  const memberships = await pulseCheckProvisioningService.listTeamMemberships(teamId);
  const athletes = memberships.filter((membership) => membership.role === 'athlete');
  return loadDeviceStatusesForMemberships(athletes, windowDays);
};

/**
 * Load device + wear status for a known visible athlete set. Coach surfaces use
 * this after roster access is already resolved, so newly-added athletes can
 * backfill from their own PulseCheck history without re-discovering the team.
 */
export const loadAthleteDeviceStatuses = async (
  athleteUserIds: string[],
  windowDays: number = DEVICE_MONITOR_DEFAULT_WINDOW_DAYS,
  scope?: PulseCheckWorkspaceScope,
): Promise<TeamDeviceStatusResult> => {
  const workspace = scope ? normalizePulseCheckWorkspaceScope(scope) : null;
  if (scope && !workspace) {
    throw new Error(
      '[pulsecheckDeviceMonitor] teamId and organizationId are required together.'
    );
  }
  const athleteIds = Array.from(new Set(athleteUserIds.map((id) => id.trim()).filter(Boolean)));
  const users = athleteIds.length
    ? await userService.getUsersByIds(athleteIds).catch((error) => {
        console.warn('[pulsecheckDeviceMonitor] athlete profiles unavailable; continuing with roster IDs', error);
        return [];
      })
    : [];
  const userById = new Map(users.map((user) => [user.id, user]));
  const athletes = athleteIds.map((athleteUserId) => ({
    userId: athleteUserId,
    role: 'athlete',
    email: userById.get(athleteUserId)?.email,
  } as PulseCheckTeamMembership));
  return loadDeviceStatusesForMemberships(
    athletes,
    windowDays,
    userById,
    workspace || undefined,
    true
  );
};

export interface TeamDeviceStatusSummary {
  athletes: number;
  synced: number;
  stale: number;
  notConnected: number;
  avgWearCoveragePct: number;
}

export const summarizeDeviceStatuses = (statuses: AthleteDeviceStatus[]): TeamDeviceStatusSummary => {
  const athletes = statuses.length;
  let synced = 0;
  let stale = 0;
  let notConnected = 0;
  let coverageSum = 0;
  for (const status of statuses) {
    if (status.connectionStatus === 'synced') synced += 1;
    else if (status.connectionStatus === 'stale') stale += 1;
    else notConnected += 1;
    coverageSum += status.wearCoveragePct;
  }
  return {
    athletes,
    synced,
    stale,
    notConnected,
    avgWearCoveragePct: athletes > 0 ? Math.round(coverageSum / athletes) : 0,
  };
};
