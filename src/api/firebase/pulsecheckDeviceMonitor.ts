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
  const connectedStatus = sourceStatuses
    .filter(isConnectedSourceStatus)
    .sort((left, right) => sourceStatusTime(right) - sourceStatusTime(left))[0] || null;

  // Most-recent wearable record (records arrive observedAt-desc, but be defensive).
  let latest: HealthContextSourceRecord | null = null;
  let lastObservedAt: number | null = null;
  let lastSyncedAt: number | null = null;
  const presentDays = new Set<number>();

  for (const record of wearableRecords) {
    if (typeof record.observedAt === 'number') {
      if (lastObservedAt === null || record.observedAt > lastObservedAt) {
        lastObservedAt = record.observedAt;
        latest = record;
      }
      const dayIndex = Math.floor((record.observedAt - windowStart) / SECONDS_PER_DAY);
      if (dayIndex >= 0 && dayIndex < windowDays) {
        presentDays.add(dayIndex);
      }
    }
    if (typeof record.ingestedAt === 'number' && (lastSyncedAt === null || record.ingestedAt > lastSyncedAt)) {
      lastSyncedAt = record.ingestedAt;
    }
  }

  const currentDeviceFamily = latest?.sourceFamily ?? connectedStatus?.sourceFamily ?? null;
  const statusObservedAt = connectedStatus ? toUnixSeconds(connectedStatus.lastObservedRecordAt) : null;
  const statusSyncedAt = connectedStatus
    ? toUnixSeconds(connectedStatus.lastSuccessfulSyncAt)
      || toUnixSeconds(connectedStatus.lastSyncedAt)
      || toUnixSeconds(connectedStatus.lastAttemptedSyncAt)
    : null;
  lastObservedAt = lastObservedAt ?? statusObservedAt;
  lastSyncedAt = lastSyncedAt ?? statusSyncedAt;

  let connectionStatus: AthleteDeviceConnectionStatus;
  if (!currentDeviceFamily || (lastObservedAt === null && !connectedStatus)) {
    connectionStatus = 'not_connected';
  } else if (lastObservedAt !== null && now - lastObservedAt <= STALE_AFTER_SEC) {
    connectionStatus = 'synced';
  } else if (connectedStatus) {
    connectionStatus = 'synced';
  } else {
    connectionStatus = 'stale';
  }

  const dailyPresence = Array.from({ length: windowDays }, (_, day) => presentDays.has(day));
  const wearDaysCovered = presentDays.size;
  const wearCoveragePct = windowDays > 0 ? Math.round((wearDaysCovered / windowDays) * 100) : 0;

  return {
    athleteUserId: membership.userId,
    displayName: resolveDisplayName(membership, user),
    email: user?.email || membership.email,
    currentDeviceFamily,
    currentDeviceLabel: getDeviceFamilyLabel(currentDeviceFamily),
    connectionStatus,
    lastObservedAt,
    lastSyncedAt,
    wearDaysCovered,
    windowDays,
    wearCoveragePct,
    dailyPresence,
    totalRecords: wearableRecords.length,
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
