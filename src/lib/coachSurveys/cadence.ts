export const DEFAULT_CADENCE_DAYS = 21;
export type TeamCadence = { cadenceDays?: number | null; changedAtMs?: number };
export function cadenceDays(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 365) throw Error('Choose a whole number of days from 1 to 365, or inherit the default.');
  return value;
}
export function cadenceLabel(days: number) { return days === 21 ? 'three weeks' : days % 7 === 0 ? `${days / 7} ${days === 7 ? 'week' : 'weeks'}` : `${days} ${days === 1 ? 'day' : 'days'}`; }
export function localDay(now: Date, timeZone: string) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now).map(p=>[p.type,p.value]));return `${p.year}-${p.month}-${p.day}`;
}
export function addDays(day: string, days: number) { return new Date(Date.parse(day) + days * 86400000).toISOString().slice(0,10); }
export function effectiveSchedule(v: {cadenceDaysOverride?: number|null; cadenceChangedAtMs?:number; startDate:string;timeZone:string}, team: TeamCadence = {}) {
  const coach = cadenceDays(v.cadenceDaysOverride), inherited = cadenceDays(team.cadenceDays);
  const days = coach ?? inherited ?? DEFAULT_CADENCE_DAYS;
  const source = coach !== null ? 'coach' : inherited !== null ? 'team' : 'default';
  const changedAtMs = Math.max(v.cadenceChangedAtMs || 0, coach === null ? team.changedAtMs || 0 : 0);
  // A changed cadence starts a fresh full interval from the local change date.
  // Never catch up an overdue old schedule or send immediately on save.
  const startDate = changedAtMs ? [v.startDate,addDays(localDay(new Date(changedAtMs),v.timeZone),days)].sort().at(-1)! : v.startDate;
  return { days, source, startDate, changedAtMs };
}
export function nextScheduledDate(v: {startDate:string;endDate:string;timeZone:string;sendHour:number;cadenceDaysOverride?:number|null;cadenceChangedAtMs?:number}, team:TeamCadence={}, now=new Date()) {
  const schedule=effectiveSchedule(v,team),today=localDay(now,v.timeZone);
  let date=schedule.startDate;
  while(date<today) date=addDays(date,schedule.days);
  return date<=v.endDate?date:null;
}
