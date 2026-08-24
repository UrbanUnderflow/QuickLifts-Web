const DATE_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

type TimestampLike = {
  toDate?: () => Date;
  toMillis?: () => number;
  seconds?: number;
  nanoseconds?: number;
  _seconds?: number;
  _nanoseconds?: number;
};

export type PulseCheckPilotEnrollmentAcceptanceReason =
  | 'accepting'
  | 'inactive'
  | 'not-started'
  | 'ended'
  | 'invalid-schedule';

export interface PulseCheckPilotEnrollmentAcceptance {
  acceptsEnrollment: boolean;
  reason: PulseCheckPilotEnrollmentAcceptanceReason;
}

export interface PulseCheckPilotEnrollmentSchedule {
  status?: unknown;
  startAt?: unknown;
  endAt?: unknown;
}

/**
 * Converts the timestamp shapes used by live Firestore and the JSON-backed
 * dashboard demo store into one validated Date. Keeping this helper free of a
 * Firebase import also lets demo records survive a localStorage round trip,
 * where Timestamp methods are no longer available.
 */
export const toPulseCheckPilotScheduleDate = (value: unknown): Date | null => {
  if (value == null) return null;

  if (value instanceof Date) {
    return Number.isFinite(value.getTime()) ? value : null;
  }

  if (typeof value === 'number') {
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? date : null;
  }

  if (typeof value !== 'object') return null;

  const timestamp = value as TimestampLike;
  try {
    if (typeof timestamp.toDate === 'function') {
      const date = timestamp.toDate();
      return date instanceof Date && Number.isFinite(date.getTime()) ? date : null;
    }

    if (typeof timestamp.toMillis === 'function') {
      const date = new Date(timestamp.toMillis());
      return Number.isFinite(date.getTime()) ? date : null;
    }
  } catch {
    return null;
  }

  const seconds = timestamp.seconds ?? timestamp._seconds;
  const nanoseconds = timestamp.nanoseconds ?? timestamp._nanoseconds ?? 0;
  if (!Number.isFinite(seconds) || !Number.isFinite(nanoseconds)) return null;

  const date = new Date((seconds as number) * 1000 + (nanoseconds as number) / 1_000_000);
  return Number.isFinite(date.getTime()) ? date : null;
};

const hasScheduleValue = (value: unknown) =>
  value !== undefined && value !== null && value !== '';

/**
 * One enrollment gate shared by invite issuance and redemption. Active legacy
 * pilots without dates remain open, while an explicitly scheduled pilot only
 * accepts enrollment from its start instant through its end instant.
 */
export const resolvePulseCheckPilotEnrollmentAcceptance = (
  pilot: PulseCheckPilotEnrollmentSchedule,
  nowValue: unknown = new Date()
): PulseCheckPilotEnrollmentAcceptance => {
  if (String(pilot.status || '').trim().toLowerCase() !== 'active') {
    return { acceptsEnrollment: false, reason: 'inactive' };
  }

  const now = toPulseCheckPilotScheduleDate(nowValue);
  const startAt = toPulseCheckPilotScheduleDate(pilot.startAt);
  const endAt = toPulseCheckPilotScheduleDate(pilot.endAt);
  if (
    !now ||
    (hasScheduleValue(pilot.startAt) && !startAt) ||
    (hasScheduleValue(pilot.endAt) && !endAt) ||
    (startAt && endAt && startAt.getTime() > endAt.getTime())
  ) {
    return { acceptsEnrollment: false, reason: 'invalid-schedule' };
  }

  if (startAt && now.getTime() < startAt.getTime()) {
    return { acceptsEnrollment: false, reason: 'not-started' };
  }
  if (endAt && now.getTime() > endAt.getTime()) {
    return { acceptsEnrollment: false, reason: 'ended' };
  }

  return { acceptsEnrollment: true, reason: 'accepting' };
};

export const parsePulseCheckPilotDateKey = (value: string): Date | null => {
  const match = value.trim().match(DATE_KEY_PATTERN);
  if (!match) return null;

  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const day = Number(match[3]);
  const date = new Date(year, monthIndex, day, 0, 0, 0, 0);

  if (
    !Number.isFinite(date.getTime())
    || date.getFullYear() !== year
    || date.getMonth() !== monthIndex
    || date.getDate() !== day
  ) {
    return null;
  }

  return date;
};

export const validatePulseCheckPilotStartDate = (
  startAt: Date | null,
  endAt: Date | null
): string | null => {
  if (!startAt || !Number.isFinite(startAt.getTime())) {
    return 'Choose a valid pilot start date.';
  }

  if (endAt && Number.isFinite(endAt.getTime()) && startAt.getTime() > endAt.getTime()) {
    return 'Start date must be on or before the pilot end date.';
  }

  return null;
};
