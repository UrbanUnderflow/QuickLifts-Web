export type ShowingUpDailyEvidence = {
  dateKey: string;
  skillTraining: boolean;
  morningCheckIn: boolean;
  eveningCheckIn: boolean;
  wearable: boolean;
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

const normalizedString = (value: unknown): string => (
  typeof value === 'string' ? value.trim().toLowerCase() : ''
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
  points: Number(evidence.skillTraining)
    + Number(evidence.morningCheckIn)
    + Number(evidence.eveningCheckIn)
    + Number(evidence.wearable),
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
