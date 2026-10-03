/** Five distinct local completion days, preserved across planning windows and gaps. */
export interface PhaseProgressionInput {
  phaseStartedOn: string;
  asOf: string;
  timezone: string;
  completions: Array<{ id: string; completedAt: number }>;
}
export interface PhaseProgression {
  currentWindowStart: string;
  currentWindowEnd: string;
  uniqueCompletionDays: string[];
  count: number;
  completedOn: string | null;
  /** Retained for older clients. Earned progress never restarts. */
  restartCount: number;
  refresherSuggested: boolean;
}
const DAY = 86_400_000;
function dayNumber(value: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Expected a calendar date in YYYY-MM-DD format');
  const time = Date.parse(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(time) || new Date(time).toISOString().slice(0, 10) !== value) throw new Error('Invalid calendar date');
  return time / DAY;
}
const dateFor = (day: number) => new Date(day * DAY).toISOString().slice(0, 10);
export function addLocalCalendarDays(date: string, days: number): string {
  if (!Number.isInteger(days)) throw new Error('Calendar-day offset must be an integer');
  return dateFor(dayNumber(date) + days);
}
export function evaluatePhaseProgression(input: PhaseProgressionInput): PhaseProgression {
  const start = dayNumber(input.phaseStartedOn), asOf = dayNumber(input.asOf);
  // Construct once so invalid IANA zones fail explicitly instead of silently using the host zone.
  const formatter = new Intl.DateTimeFormat('en-US', { timeZone: input.timezone, year: 'numeric', month: '2-digit', day: '2-digit' });
  const localDay = (timestamp: number) => {
    const parts = formatter.formatToParts(new Date(timestamp));
    const part = (name: string) => parts.find(p => p.type === name)!.value;
    return dayNumber(`${part('year')}-${part('month')}-${part('day')}`);
  };
  const completionDays = new Set<number>();
  // A duplicate event id represents one event. Earliest valid timestamp wins regardless of input order.
  const eventDays = new Map<string, number>();
  for (const event of input.completions) {
    if (typeof event.id !== 'string' || !event.id.trim() || !Number.isFinite(event.completedAt)) continue;
    let day: number;
    try { day = localDay(event.completedAt); } catch { continue; }
    eventDays.set(event.id, Math.min(eventDays.get(event.id) ?? Infinity, day));
  }
  for (const day of eventDays.values()) {
    if (day < start || day > asOf) continue;
    completionDays.add(day);
  }
  const days = [...completionDays].sort((a, b) => a - b);
  const completedOn = days.length >= 5 ? dateFor(days[4]) : null;
  const uniqueCompletionDays = days.slice(0, 5).map(dateFor);
  // Legacy window fields are planning dates only. Keep the original start so stored
  // assignment ids and old clients cannot mistake a gap for a fresh phase.
  const planningDay = completedOn ? dayNumber(completedOn) : asOf;
  const planningWindow = Math.max(0, Math.floor((planningDay - start) / 14));
  const lastPracticeDay = days.length ? days[days.length - 1] : start;
  return { currentWindowStart: dateFor(start), currentWindowEnd: dateFor(start + planningWindow * 14 + 13),
    uniqueCompletionDays, count: uniqueCompletionDays.length, completedOn, restartCount: 0,
    refresherSuggested: !completedOn && asOf - lastPracticeDay >= 14 };
}
