import { addMonths, eachDayOfInterval, endOfMonth, format, parse, startOfMonth } from 'date-fns';
import { convertLocalDateMinutesToUtcIso } from './googleCalendar';
import type { GroupMeetImportedAvailabilitySuggestion } from './groupMeet';

const DEFAULT_DAY_START_MINUTES = 6 * 60;
const DEFAULT_DAY_END_MINUTES = 22 * 60;
const ROUNDING_MINUTES = 15;

type BusyInterval = {
  start: string;
  end: string;
};

type ConvertGoogleBusyBlocksToAvailabilitySuggestionsArgs = {
  busyIntervals: BusyInterval[];
  targetMonth: string;
  timeZone: string;
  meetingDurationMinutes: number;
  importedAt?: string | null;
};

function roundUpToStep(totalMinutes: number, stepMinutes: number) {
  return Math.ceil(totalMinutes / stepMinutes) * stepMinutes;
}

function roundDownToStep(totalMinutes: number, stepMinutes: number) {
  return Math.floor(totalMinutes / stepMinutes) * stepMinutes;
}

function mergeBusyIntervals(
  intervals: Array<{
    startMs: number;
    endMs: number;
  }>
) {
  const merged: typeof intervals = [];

  for (const interval of intervals.sort((left, right) => left.startMs - right.startMs)) {
    const previous = merged[merged.length - 1];
    if (!previous || interval.startMs > previous.endMs) {
      merged.push({ ...interval });
      continue;
    }

    previous.endMs = Math.max(previous.endMs, interval.endMs);
  }

  return merged;
}

function buildMonthDates(targetMonth: string) {
  const monthStart = startOfMonth(parse(`${targetMonth}-01`, 'yyyy-MM-dd', new Date()));
  const monthEnd = endOfMonth(monthStart);
  return eachDayOfInterval({ start: monthStart, end: monthEnd });
}

export function convertGoogleBusyBlocksToAvailabilitySuggestions({
  busyIntervals,
  targetMonth,
  timeZone,
  meetingDurationMinutes,
  importedAt = null,
}: ConvertGoogleBusyBlocksToAvailabilitySuggestionsArgs): GroupMeetImportedAvailabilitySuggestion[] {
  if (!/^\d{4}-\d{2}$/.test((targetMonth || '').trim())) {
    return [];
  }

  const durationMinutes = Math.max(15, Math.min(240, Number(meetingDurationMinutes) || 30));
  const monthDates = buildMonthDates(targetMonth);
  const busyRanges = busyIntervals
    .map((interval) => ({
      startMs: new Date(interval.start).getTime(),
      endMs: new Date(interval.end).getTime(),
    }))
    .filter((interval) => Number.isFinite(interval.startMs) && Number.isFinite(interval.endMs))
    .filter((interval) => interval.endMs > interval.startMs);

  const nextSuggestions: GroupMeetImportedAvailabilitySuggestion[] = [];

  for (const day of monthDates) {
    const date = format(day, 'yyyy-MM-dd');
    const dayEnvelopeStartMinutes = DEFAULT_DAY_START_MINUTES;
    const dayEnvelopeEndMinutes = DEFAULT_DAY_END_MINUTES;
    const dayEnvelopeStartMs = new Date(
      convertLocalDateMinutesToUtcIso(date, dayEnvelopeStartMinutes, timeZone)
    ).getTime();
    const dayEnvelopeEndMs = new Date(
      convertLocalDateMinutesToUtcIso(date, dayEnvelopeEndMinutes, timeZone)
    ).getTime();

    if (!Number.isFinite(dayEnvelopeStartMs) || !Number.isFinite(dayEnvelopeEndMs)) {
      continue;
    }

    const busyForDay = mergeBusyIntervals(
      busyRanges
        .map((interval) => ({
          startMs: Math.max(interval.startMs, dayEnvelopeStartMs),
          endMs: Math.min(interval.endMs, dayEnvelopeEndMs),
        }))
        .filter((interval) => interval.endMs > interval.startMs)
    );

    let cursorMs = dayEnvelopeStartMs;

    const commitFreeWindow = (freeWindowEndMs: number) => {
      const rawStartMinutes =
        dayEnvelopeStartMinutes + Math.round((cursorMs - dayEnvelopeStartMs) / 60000);
      const rawEndMinutes =
        dayEnvelopeStartMinutes + Math.round((freeWindowEndMs - dayEnvelopeStartMs) / 60000);
      const startMinutes = roundUpToStep(rawStartMinutes, ROUNDING_MINUTES);
      const endMinutes = roundDownToStep(rawEndMinutes, ROUNDING_MINUTES);

      if (endMinutes - startMinutes < durationMinutes) {
        return;
      }

      nextSuggestions.push({
        date,
        startMinutes,
        endMinutes,
        source: 'google_calendar',
        importedAt,
      });
    };

    for (const busyInterval of busyForDay) {
      if (busyInterval.startMs > cursorMs) {
        commitFreeWindow(busyInterval.startMs);
      }
      cursorMs = Math.max(cursorMs, busyInterval.endMs);
    }

    if (cursorMs < dayEnvelopeEndMs) {
      commitFreeWindow(dayEnvelopeEndMs);
    }
  }

  const seen = new Set<string>();

  return nextSuggestions.filter((slot) => {
    const key = `${slot.date}:${slot.startMinutes}:${slot.endMinutes}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

export function buildGoogleBusyMonthRequestWindow(targetMonth: string, timeZone: string) {
  const monthStart = startOfMonth(parse(`${targetMonth}-01`, 'yyyy-MM-dd', new Date()));
  const nextMonthStart = startOfMonth(addMonths(monthStart, 1));
  const timeMin = convertLocalDateMinutesToUtcIso(
    format(monthStart, 'yyyy-MM-dd'),
    0,
    timeZone
  );
  const timeMax = convertLocalDateMinutesToUtcIso(
    format(nextMonthStart, 'yyyy-MM-dd'),
    0,
    timeZone
  );

  return { timeMin, timeMax };
}
