export type ShowingUpDailyEvidence = {
  dateKey: string;
  skillTraining: boolean;
  morningCheckIn: boolean;
  eveningCheckIn: boolean;
  wearable?: boolean;
  daytimeWearable?: boolean;
  overnightWearable?: boolean;
};

export type ShowingUpDailyScore = ShowingUpDailyEvidence & {
  points: number;
};

export type RankableShowingUpMember = {
  userId: string;
  displayName: string;
  totalPoints: number;
};

export type RankedShowingUpMember<T extends RankableShowingUpMember> = T & {
  rank: number;
};

export type CompletedShowingUpWindow = {
  isFinalized?: boolean;
  winnerAthleteIds?: unknown;
};

export type WearableCoverageEvidence = {
  hasDaytime: boolean;
  hasOvernight: boolean;
};

const NON_SCORING_ASSIGNMENT_STATUSES = new Set([
  'overridden',
  'deferred',
  'superseded',
  'expired',
]);

const DEFAULT_SPRINT_ANCHOR_DATE = '1970-01-05';
const SPRINT_LENGTH_DAYS = 14;

const numberValue = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
};

const dictionaryValue = (value: unknown): Record<string, any> => (
  value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, any>
    : {}
);

const normalizedString = (value: unknown): string => (
  typeof value === 'string' ? value.trim().toLowerCase() : ''
);

export const isShowingUpLeaderboardEnabled = (team: Record<string, any> | undefined): boolean => (
  team?.showingUpLeaderboard?.enabled !== false
);

export const isSkillAssignmentDueToday = (assignment: Record<string, any>): boolean => {
  const actionType = normalizedString(assignment.actionType);
  const status = normalizedString(assignment.status);
  if (actionType === 'defer' || actionType === 'check_in') return false;
  if (NON_SCORING_ASSIGNMENT_STATUSES.has(status)) return false;
  if (assignment.supersededByDailyTaskId) return false;

  if (typeof assignment.curriculumIsDueToday === 'boolean') {
    return assignment.curriculumIsDueToday;
  }

  const isCurriculumSlateItem = Boolean(assignment.curriculumSlateId)
    || typeof assignment.curriculumSlotIndex === 'number';
  if (isCurriculumSlateItem) {
    return assignment.curriculumSlotIndex === 1;
  }

  return assignment.isPrimaryForDate !== false;
};

export const resolveTimeZone = (value: unknown): string => {
  const candidate = typeof value === 'string' && value.trim() ? value.trim() : 'UTC';
  try {
    Intl.DateTimeFormat('en-US', { timeZone: candidate }).format(new Date());
    return candidate;
  } catch {
    return 'UTC';
  }
};

export const dateKeyInTimeZone = (date: Date, timezone: string): string => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: resolveTimeZone(timezone),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
};

export const shiftDateKey = (dateKey: string, offsetDays: number): string => {
  const date = new Date(`${dateKey}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
};

const dayDifference = (startDateKey: string, endDateKey: string): number => {
  const start = Date.parse(`${startDateKey}T12:00:00.000Z`);
  const end = Date.parse(`${endDateKey}T12:00:00.000Z`);
  return Math.floor((end - start) / (24 * 60 * 60 * 1000));
};

const safeAnchorDateKey = (value: unknown, throughDate: string): string => {
  const candidate = typeof value === 'string' ? value.trim() : '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(candidate) && dayDifference(candidate, throughDate) >= 0) {
    return candidate;
  }
  return DEFAULT_SPRINT_ANCHOR_DATE;
};

export const current14DaySprint = (
  now: Date,
  timezone: string,
  anchorDateKey?: string,
): {
  sprintId: string;
  sprintNumber: number;
  sprintStartDate: string;
  sprintEndDate: string;
  throughDate: string;
  dateKeys: string[];
  daysElapsed: number;
  daysRemaining: number;
} => {
  const safeTimezone = resolveTimeZone(timezone);
  const throughDate = dateKeyInTimeZone(now, safeTimezone);
  const anchor = safeAnchorDateKey(anchorDateKey, throughDate);
  const elapsedSinceAnchor = Math.max(0, dayDifference(anchor, throughDate));
  const sprintIndex = Math.floor(elapsedSinceAnchor / SPRINT_LENGTH_DAYS);
  const sprintStartDate = shiftDateKey(anchor, sprintIndex * SPRINT_LENGTH_DAYS);
  const sprintEndDate = shiftDateKey(sprintStartDate, SPRINT_LENGTH_DAYS - 1);
  const daysElapsed = dayDifference(sprintStartDate, throughDate) + 1;
  const dateKeys = Array.from(
    { length: daysElapsed },
    (_, index) => shiftDateKey(sprintStartDate, index),
  );
  return {
    sprintId: sprintStartDate,
    sprintNumber: sprintIndex + 1,
    sprintStartDate,
    sprintEndDate,
    throughDate,
    dateKeys,
    daysElapsed,
    daysRemaining: Math.max(0, SPRINT_LENGTH_DAYS - daysElapsed),
  };
};

export const scoreShowingUpDay = (evidence: ShowingUpDailyEvidence): ShowingUpDailyScore => ({
  ...evidence,
  wearable: evidence.wearable === true
    || evidence.daytimeWearable === true
    || evidence.overnightWearable === true,
  points: Number(evidence.skillTraining)
    + Number(evidence.morningCheckIn)
    + Number(evidence.eveningCheckIn)
    + Number(
      evidence.wearable === true
        || evidence.daytimeWearable === true
        || evidence.overnightWearable === true,
    ),
});

export const assignSharedRanks = <T extends RankableShowingUpMember>(
  members: T[],
): Array<RankedShowingUpMember<T>> => {
  const sorted = [...members].sort((left, right) => {
    if (left.totalPoints !== right.totalPoints) return right.totalPoints - left.totalPoints;
    return left.displayName.localeCompare(right.displayName, undefined, { sensitivity: 'base' });
  });

  let previousPoints: number | undefined;
  let currentRank = 0;
  return sorted.map((member, index) => {
    if (previousPoints === undefined || member.totalPoints !== previousPoints) {
      currentRank = index + 1;
      previousPoints = member.totalPoints;
    }
    return { ...member, rank: currentRank };
  });
};

export const countFinalizedLeaderWins = (
  windows: CompletedShowingUpWindow[],
): Map<string, number> => {
  const winsByAthlete = new Map<string, number>();
  for (const window of windows) {
    if (window.isFinalized !== true || !Array.isArray(window.winnerAthleteIds)) continue;
    for (const rawAthleteId of window.winnerAthleteIds) {
      const athleteId = typeof rawAthleteId === 'string' ? rawAthleteId.trim() : '';
      if (!athleteId) continue;
      winsByAthlete.set(athleteId, (winsByAthlete.get(athleteId) || 0) + 1);
    }
  }
  return winsByAthlete;
};

export type HistoricalShowingUpRecord = {
  userId: string;
  displayName: string;
  dateKey: string;
  points: number;
};

export const aggregateOverallStandings = (
  records: HistoricalShowingUpRecord[],
): Array<RankedShowingUpMember<RankableShowingUpMember & { daysScored: number; maxPoints: number }>> => {
  const byUser = new Map<string, {
    userId: string;
    displayName: string;
    totalPoints: number;
    dateKeys: Set<string>;
  }>();
  for (const record of records) {
    const current = byUser.get(record.userId) || {
      userId: record.userId,
      displayName: record.displayName,
      totalPoints: 0,
      dateKeys: new Set<string>(),
    };
    current.displayName = record.displayName || current.displayName;
    current.totalPoints += Math.max(0, Math.min(4, Number(record.points) || 0));
    current.dateKeys.add(record.dateKey);
    byUser.set(record.userId, current);
  }
  return assignSharedRanks(Array.from(byUser.values()).map((member) => ({
    userId: member.userId,
    displayName: member.displayName,
    totalPoints: member.totalPoints,
    daysScored: member.dateKeys.size,
    maxPoints: member.dateKeys.size * 4,
  })));
};

export const hasMorningCheckIn = (checkIn: Record<string, any> | undefined): boolean => (
  normalizedString(checkIn?.level).length > 0
);

export const hasEveningCheckIn = (checkIn: Record<string, any> | undefined): boolean => (
  normalizedString(checkIn?.eveningCheckIn?.level).length > 0
);

export const hasVerifiedOvernightData = (snapshot: Record<string, any> | undefined): boolean => {
  if (!snapshot) return false;
  const rawRecovery = snapshot.domains?.recovery || snapshot.recovery || {};
  const recovery = {
    ...rawRecovery,
    ...(rawRecovery.data || {}),
    ...(rawRecovery.payload || {}),
  };

  const sleepHours = [
    recovery.sleepDuration,
    recovery.sleepDurationHours,
    recovery.totalSleepHours,
  ].map(numberValue).find((value) => value !== undefined && value > 0);
  const sleepMinutes = [
    recovery.totalSleepMin,
    recovery.totalSleepMinutes,
    recovery.sleepDurationMinutes,
  ].map(numberValue).find((value) => value !== undefined && value > 0);
  const hasSleep = sleepHours !== undefined || sleepMinutes !== undefined;

  const recoverySignals = [
    recovery.recoveryScore,
    recovery.readinessScore,
    recovery.heartRateVariability,
    recovery.hrv,
    recovery.hrvMs,
    recovery.hrvRmssd,
    recovery.restingHeartRate,
    recovery.heartRateResting,
  ];
  const hasRecoverySignal = recoverySignals.some((value) => numberValue(value) !== undefined);

  return hasSleep && hasRecoverySignal;
};

const wearableSourceFamilies = new Set([
  'oura',
  'apple_health',
  'healthkit',
  'health_kit',
  'apple_watch',
  'healthconnect',
  'health_connect',
  'google_wearables',
  'google-wearables',
  'polar',
  'fitbit',
  'whoop',
  'garmin',
]);

const nonWearableSourceFamilies = new Set([
  'quicklifts',
  'fit_with_pulse',
  'pulsecheck_self_report',
  'coach_entered',
  'manual',
]);

const mergeBlockData = (block: unknown): Record<string, any> => {
  const source = dictionaryValue(block);
  const nestedData = dictionaryValue(source.data);
  const nestedPayload = dictionaryValue(source.payload);
  const nestedRollup = dictionaryValue(source.rollup);
  const direct = Object.fromEntries(
    Object.entries(source).filter(([key]) => ![
      'data',
      'payload',
      'rollup',
      'freshness',
      'provenance',
      'sourceStatus',
      'generatedAt',
      'updatedAt',
    ].includes(key)),
  );
  return { ...direct, ...nestedData, ...nestedPayload, ...nestedRollup };
};

const normalizedSourceFamily = (value: unknown): string => normalizedString(value).replace(/-/g, '_');

const sourceFamilyForDomain = (
  snapshot: Record<string, any>,
  domain: string,
  block: Record<string, any>,
): string => normalizedSourceFamily(
  block.provenance?.primarySource
  || snapshot.provenance?.domainWinners?.[domain]
  || block.sourceFamily
  || snapshot.provenance?.sourcesUsed?.[0]
  || snapshot.sourceFamily,
);

const sourceCanRepresentWearable = (sourceFamily: string): boolean => {
  if (!sourceFamily) return true;
  if (nonWearableSourceFamilies.has(sourceFamily)) return false;
  return wearableSourceFamilies.has(sourceFamily) || sourceFamily.includes('wearable');
};

const freshnessIsUsable = (value: unknown): boolean => {
  const freshness = normalizedString(value);
  return !freshness || !['missing', 'stale', 'error', 'permission_denied', 'not_connected'].includes(freshness);
};

const hasUsableMetric = (data: Record<string, any>, keys: string[]): boolean => {
  const normalizedData = Object.fromEntries(
    Object.entries(data).map(([key, value]) => [key.toLowerCase(), value]),
  );
  for (const key of keys) {
    const value = normalizedData[key.toLowerCase()];
    const numeric = numberValue(value);
    if (numeric !== undefined && numeric > 0) return true;
    if (typeof value === 'string' && value.trim()) return true;
    if (Array.isArray(value) && value.length > 0) return true;
  }
  return false;
};

export const resolveWearableCoverageFromSnapshot = (
  snapshot: Record<string, any> | undefined,
): WearableCoverageEvidence => {
  if (!snapshot) return { hasDaytime: false, hasOvernight: false };
  const domains = dictionaryValue(snapshot.domains);
  const freshness = dictionaryValue(snapshot.freshness);
  const perDomainFreshness = dictionaryValue(freshness.perDomain);
  const result: WearableCoverageEvidence = { hasDaytime: false, hasOvernight: false };
  const daytimeMetricKeys = [
    'steps',
    'activeCalories',
    'activecalories',
    'totalCalories',
    'totalcalories',
    'distance',
    'distanceMeters',
    'exerciseMinutes',
    'activeMinutes',
    'standHours',
    'workoutCount',
    'heartRateAvg',
    'avgHeartRate',
    'averageHeartRate',
    'heartRateAverage',
    'heartRateBpm',
    'liveHeartRateBpm',
    'sampleCount',
    'heartRateSamples',
  ];
  const overnightMetricKeys = [
    'sleepDuration',
    'sleepDurationHours',
    'totalSleepHours',
    'totalSleepMin',
    'totalSleepMinutes',
    'sleepEfficiency',
    'sleepScore',
    'timeInBedHours',
    'bedtimeStart',
    'bedtimeEnd',
    'sleepMidpoint',
    'recoveryScore',
    'readinessScore',
    'heartRateVariability',
    'hrv',
    'hrvMs',
    'hrvRmssd',
    'rmssdMs',
    'restingHeartRate',
    'heartRateResting',
    'restingHeartRateBpm',
  ];

  for (const domain of ['activity', 'training', 'workout', 'biometrics', 'cardio', 'heart']) {
    const block = dictionaryValue(domains[domain] || snapshot[domain]);
    if (!Object.keys(block).length) continue;
    const sourceFamily = sourceFamilyForDomain(snapshot, domain, block);
    if (!sourceCanRepresentWearable(sourceFamily)) continue;
    if (!freshnessIsUsable(block.freshness || perDomainFreshness[domain] || freshness[domain])) continue;
    if (hasUsableMetric(mergeBlockData(block), daytimeMetricKeys)) result.hasDaytime = true;
  }

  for (const domain of ['recovery', 'sleep']) {
    const block = dictionaryValue(domains[domain] || snapshot[domain]);
    if (!Object.keys(block).length) continue;
    const sourceFamily = sourceFamilyForDomain(snapshot, domain, block);
    if (!sourceCanRepresentWearable(sourceFamily)) continue;
    if (!freshnessIsUsable(block.freshness || perDomainFreshness[domain] || freshness[domain])) continue;
    if (hasUsableMetric(mergeBlockData(block), overnightMetricKeys)) result.hasOvernight = true;
  }

  return result;
};
