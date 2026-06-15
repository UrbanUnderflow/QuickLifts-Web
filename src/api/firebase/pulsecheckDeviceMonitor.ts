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
import { db } from './config';
import {
  listHealthContextSourceRecordsForWindow,
  type HealthContextSourceFamily,
  type HealthContextSourceRecord,
} from './healthContextSourceRecord';
import { pulseCheckProvisioningService } from './pulsecheckProvisioning/service';
import type { PulseCheckTeamMembership } from './pulsecheckProvisioning/types';
import { userService } from './user/service';
import type { User } from './user/types';

// ──────────────────────────────────────────────────────────────────────────────
// Public contract
// ──────────────────────────────────────────────────────────────────────────────

/** Coarse connection state an operator can act on at a glance. */
export type AthleteDeviceConnectionStatus = 'synced' | 'stale' | 'not_connected';

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

export const DEVICE_MONITOR_DEFAULT_WINDOW_DAYS = 14;

const SECONDS_PER_DAY = 24 * 60 * 60;
// A device that hasn't produced data in 36h is treated as stale — matches the
// Phase J onboarding default (see phaseJDeviceOnboardingSelfReport.ts).
const STALE_AFTER_SEC = 36 * 60 * 60;
const MAX_RECORDS_PER_ATHLETE = 200;
const QUERY_CONCURRENCY = 6;

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

  const metrics: Array<{ label: string; value: string }> = [];
  const push = (label: string, value: string) => metrics.push({ label, value });

  const sleepDuration = toFiniteNumber(merged.sleepDuration);
  if (sleepDuration !== null) push('Sleep', formatHoursToHm(sleepDuration));

  const sleepEfficiency = toFiniteNumber(merged.sleepEfficiency);
  if (sleepEfficiency !== null) push('Sleep efficiency', `${Math.round(sleepEfficiency)}%`);

  const heartRateResting = toFiniteNumber(merged.heartRateResting);
  if (heartRateResting !== null) push('Resting HR', `${Math.round(heartRateResting)} bpm`);

  const averageHeartRate = toFiniteNumber(
    merged.averageHeartRate ?? merged.avgHeartRate ?? merged.heartRateAverage ?? merged.averageHr,
  );
  if (averageHeartRate !== null) push('Avg HR', `${Math.round(averageHeartRate)} bpm`);

  const heartRateVariability = toFiniteNumber(merged.heartRateVariability);
  if (heartRateVariability !== null) push('HRV', `${Math.round(heartRateVariability)} ms`);

  const respiratoryRate = toFiniteNumber(merged.respiratoryRate);
  if (respiratoryRate !== null) push('Respiratory', `${respiratoryRate.toFixed(1)} /min`);

  const readinessScore = toFiniteNumber(merged.readinessScore);
  if (readinessScore !== null) push('Readiness', `${Math.round(readinessScore)}`);

  const deepSleepDuration = toFiniteNumber(merged.deepSleepDuration);
  if (deepSleepDuration !== null) push('Deep sleep', formatHoursToHm(deepSleepDuration));

  const remSleepDuration = toFiniteNumber(merged.remSleepDuration);
  if (remSleepDuration !== null) push('REM', formatHoursToHm(remSleepDuration));

  const steps = toFiniteNumber(merged.steps);
  if (steps !== null) push('Steps', Math.round(steps).toLocaleString());

  const activeCalories = toFiniteNumber(merged.activeCalories);
  if (activeCalories !== null) push('Active cal', `${Math.round(activeCalories)}`);

  return metrics;
};

/**
 * True only when a record carries at least one MEASURED value. A day whose only
 * records have empty payloads (e.g. an Oura record written when the ring wasn't
 * worn, or a placeholder training/summary record) is NOT "worn" — those must not
 * light a presence cell green or count toward coverage.
 */
const recordHasMeasuredData = (record: HealthContextSourceRecord): boolean =>
  extractDayMetrics([record]).length > 0;

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
const DAYTIME_METRIC_LABELS = new Set(['Steps', 'Active cal', 'Avg HR']);

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
  now: number;
  windowStart: number;
  windowDays: number;
}

interface HealthContextSourceStatus {
  sourceFamily: HealthContextSourceFamily;
  lifecycleState?: string;
  status?: string;
  connectionState?: string;
  lastObservedRecordAt?: number;
  lastSuccessfulSyncAt?: number;
  lastSyncedAt?: number;
  lastAttemptedSyncAt?: number;
}

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
    sourceFamily: (data.sourceFamily || family) as HealthContextSourceFamily,
    lifecycleState: data.lifecycleState as string | undefined,
    status: data.status as string | undefined,
    connectionState: data.connectionState as string | undefined,
    lastObservedRecordAt: toUnixSeconds(data.lastObservedRecordAt) || undefined,
    lastSuccessfulSyncAt: toUnixSeconds(data.lastSuccessfulSyncAt) || undefined,
    lastSyncedAt: toUnixSeconds(data.lastSyncedAt) || undefined,
    lastAttemptedSyncAt: toUnixSeconds(data.lastAttemptedSyncAt) || undefined,
  };
};

const loadSharedSourceStatusMap = async (athleteUserId: string): Promise<HealthContextSourceStatus[]> => {
  try {
    const snap = await getDoc(doc(db, 'health-context-source-status', athleteUserId));
    if (!snap.exists()) return [];
    const data = snap.data() as Record<string, unknown>;
    const sourceStatuses = (data.sourceStatuses && typeof data.sourceStatuses === 'object')
      ? data.sourceStatuses as Record<string, unknown>
      : data;
    return WEARABLE_FAMILY_LIST
      .map((family) => buildSourceStatusFromEntry(family, sourceStatuses[family]))
      .filter((entry): entry is HealthContextSourceStatus => !!entry);
  } catch {
    return [];
  }
};

const loadNestedAthleteSourceStatus = async (athleteUserId: string): Promise<HealthContextSourceStatus[]> => {
  try {
    const snap = await getDoc(doc(db, 'athletes', athleteUserId, 'health-context-source-status', 'current'));
    if (!snap.exists()) return [];
    const data = snap.data() as Record<string, unknown>;
    return WEARABLE_FAMILY_LIST
      .map((family) => buildSourceStatusFromEntry(family, data[family]))
      .filter((entry): entry is HealthContextSourceStatus => !!entry);
  } catch {
    return [];
  }
};

const loadWearableSourceStatuses = async (athleteUserId: string): Promise<HealthContextSourceStatus[]> => {
  const [sharedEntries, nestedEntries, familyEntries] = await Promise.all([
    loadSharedSourceStatusMap(athleteUserId),
    loadNestedAthleteSourceStatus(athleteUserId),
    Promise.all(
      WEARABLE_FAMILY_LIST.map(async (family): Promise<HealthContextSourceStatus | null> => {
        try {
          const snap = await getDoc(doc(db, 'health-context-source-status', `${athleteUserId}_${family}`));
          if (!snap.exists()) return null;
          const data = snap.data() as Record<string, unknown>;
          const status: HealthContextSourceStatus = {
            sourceFamily: (data.sourceFamily || family) as HealthContextSourceFamily,
            lifecycleState: data.lifecycleState as string | undefined,
            status: data.status as string | undefined,
            connectionState: data.connectionState as string | undefined,
            lastObservedRecordAt: toUnixSeconds(data.lastObservedRecordAt) || undefined,
            lastSuccessfulSyncAt: toUnixSeconds(data.lastSuccessfulSyncAt) || undefined,
            lastSyncedAt: toUnixSeconds(data.lastSyncedAt) || undefined,
            lastAttemptedSyncAt: toUnixSeconds(data.lastAttemptedSyncAt) || undefined,
          };
          return status;
        } catch {
          return null;
        }
      })
    ),
  ]);
  return [
    ...sharedEntries,
    ...nestedEntries,
    ...familyEntries.filter((entry): entry is HealthContextSourceStatus => !!entry),
  ];
};

export const deriveAthleteDeviceStatus = ({
  membership,
  user,
  records,
  sourceStatuses = [],
  now,
  windowStart,
  windowDays,
}: DeriveInput): AthleteDeviceStatus => {
  const wearableRecords = records.filter((record) => WEARABLE_FAMILIES.has(record.sourceFamily));
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

  const devices: AthleteDevicePerSourceStatus[] = Array.from(families).map((family) => {
    const familyRecords = wearableRecords.filter((record) => record.sourceFamily === family);
    const status = connectedStatusByFamily.get(family) || null;

    let lastObservedAt: number | null = null;
    let lastSyncedAt: number | null = null;
    // Bucket this family's records by day index within the window so we can build
    // a per-day data snapshot for the presence-bar hover tooltip.
    const recordsByDay = new Map<number, HealthContextSourceRecord[]>();

    for (const record of familyRecords) {
      if (typeof record.observedAt === 'number') {
        // "Last data" must reflect the most recent record that actually carried
        // measured values — not an empty placeholder/sync record.
        if (
          recordHasMeasuredData(record) &&
          (lastObservedAt === null || record.observedAt > lastObservedAt)
        ) {
          lastObservedAt = record.observedAt;
        }
        const dayIndex = Math.floor((record.observedAt - windowStart) / SECONDS_PER_DAY);
        if (dayIndex >= 0 && dayIndex < windowDays) {
          const bucket = recordsByDay.get(dayIndex);
          if (bucket) bucket.push(record);
          else recordsByDay.set(dayIndex, [record]);
        }
      }
      if (typeof record.ingestedAt === 'number' && (lastSyncedAt === null || record.ingestedAt > lastSyncedAt)) {
        lastSyncedAt = record.ingestedAt;
      }
    }

    if (lastObservedAt === null && status) {
      lastObservedAt = toUnixSeconds(status.lastObservedRecordAt);
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

    // A day is only "worn"/present when its records actually produced measured
    // values — empty-payload records don't light the cell green or count toward
    // coverage. dailyDetails is the source of truth; presence mirrors it.
    const dailyDetails: (AthleteDeviceDayDetail | null)[] = Array.from(
      { length: windowDays },
      (_, day): AthleteDeviceDayDetail | null => {
        const dayRecords = recordsByDay.get(day);
        if (!dayRecords || dayRecords.length === 0) return null;
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
      label: getDeviceFamilyLabel(family),
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

  return {
    athleteUserId: membership.userId,
    displayName: resolveDisplayName(membership, user),
    email: user?.email || membership.email,
    currentDeviceFamily: best?.sourceFamily ?? null,
    currentDeviceLabel: best ? best.label : getDeviceFamilyLabel(null),
    connectionStatus: best?.connectionStatus ?? 'not_connected',
    lastObservedAt: best?.lastObservedAt ?? null,
    lastSyncedAt: best?.lastSyncedAt ?? null,
    wearDaysCovered: best?.wearDaysCovered ?? 0,
    windowDays,
    wearCoveragePct: best?.wearCoveragePct ?? 0,
    dailyPresence: best?.dailyPresence ?? Array.from({ length: windowDays }, () => false),
    totalRecords: wearableRecords.length,
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
): Promise<TeamDeviceStatusResult> => {
  const safeWindowDays = safeWindow(windowDays);
  const now = Math.round(Date.now() / 1000);
  const windowStart = now - safeWindowDays * SECONDS_PER_DAY;

  const athleteIds = athletes.map((membership) => membership.userId);
  const userById = preloadedUserById || new Map(
    (athleteIds.length ? await userService.getUsersByIds(athleteIds) : []).map((user) => [user.id, user])
  );

  const statuses = await mapWithConcurrency(athletes, QUERY_CONCURRENCY, async (membership) => {
    // Each lane is independently non-fatal: a failing HCSR window query (e.g. a
    // missing composite index) must NOT blank out device status for the athlete —
    // the simple source-status point-reads still detect a connected/fresh device.
    // Previously either throw rejected the whole load and the dashboard's
    // catch(() => null) reported "No device" for EVERY athlete.
    const [records, sourceStatuses] = await Promise.all([
      listHealthContextSourceRecordsForWindow(membership.userId, windowStart, now, {
        max: MAX_RECORDS_PER_ATHLETE,
      }).catch((error) => {
        console.warn(
          `[pulsecheckDeviceMonitor] health-context-source-records query failed for ${membership.userId}; falling back to source-status`,
          error,
        );
        return [] as HealthContextSourceRecord[];
      }),
      loadWearableSourceStatuses(membership.userId).catch((error) => {
        console.warn(
          `[pulsecheckDeviceMonitor] source-status load failed for ${membership.userId}`,
          error,
        );
        return [] as HealthContextSourceStatus[];
      }),
    ]);
    return deriveAthleteDeviceStatus({
      membership,
      user: userById.get(membership.userId),
      records,
      sourceStatuses,
      now,
      windowStart,
      windowDays: safeWindowDays,
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
): Promise<TeamDeviceStatusResult> => {
  const athleteIds = Array.from(new Set(athleteUserIds.map((id) => id.trim()).filter(Boolean)));
  const users = athleteIds.length ? await userService.getUsersByIds(athleteIds) : [];
  const userById = new Map(users.map((user) => [user.id, user]));
  const athletes = athleteIds.map((athleteUserId) => ({
    userId: athleteUserId,
    role: 'athlete',
    email: userById.get(athleteUserId)?.email,
  } as PulseCheckTeamMembership));
  return loadDeviceStatusesForMemberships(athletes, windowDays, userById);
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
