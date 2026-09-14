/** Current practice work is separate from the retained assignment history. */
export interface PracticeBacklog {
  dueToday: number;
  overdue: number;
  upcoming: number;
  additionalDue: number;
  undated: number;
}

export const emptyPracticeBacklog = (): PracticeBacklog => ({
  dueToday: 0, overdue: 0, upcoming: 0, additionalDue: 0, undated: 0,
});

const validDay = (value: unknown): value is string => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};

// Match the athlete-local 4 a.m. rollover used by the daily-task runtime.
export const practiceOperationalDay = (now: number, timezone: string): string => {
  let formatter: Intl.DateTimeFormat;
  try {
    formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23',
    });
  } catch {
    return practiceOperationalDay(now, 'America/New_York');
  }
  const parts = Object.fromEntries(formatter.formatToParts(new Date(now)).map((part) => [part.type, part.value]));
  const date = new Date(`${parts.year}-${parts.month}-${parts.day}T12:00:00Z`);
  if (Number(parts.hour) < 4) date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
};

export const summarizePracticeBacklog = (
  assignments: ReadonlyArray<Record<string, any>>,
  now = Date.now(),
  fallbackTimezone = 'America/New_York'
): PracticeBacklog => {
  const result = emptyPracticeBacklog();
  for (const assignment of assignments) {
    const status = String(assignment.status || 'assigned').toLowerCase();
    if (!['assigned', 'viewed', 'started'].includes(status)
      || assignment.actionType === 'defer'
      || assignment.completedAt || assignment.completedDateKey || assignment.completedOn
      || assignment.expiredAt || assignment.supersededAt || assignment.supersededByDailyTaskId
      || assignment.supersededByRevision) continue;
    const day = assignment.sourceDate;
    if (!validDay(day)) { result.undated += 1; continue; }
    const today = practiceOperationalDay(now, assignment.timezone || fallbackTimezone);
    // Assigned/viewed tasks expire at rollover. A started task may still be finished.
    if (day < today && status !== 'started') continue;
    if (assignment.isPrimaryForDate === false) {
      // Secondary curriculum simulations are legitimate, but are not primary backlog.
      if (day <= today) result.additionalDue += 1;
      continue;
    }
    if (day > today) result.upcoming += 1;
    else if (day < today) result.overdue += 1;
    else result.dueToday += 1;
  }
  return result;
};
