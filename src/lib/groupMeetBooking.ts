/** Shared, side-effect-free individual booking rules. All instants use UTC. */
export type BookingProfile = {
  enabled: boolean; slug: string; name: string; description: string; timezone: string;
  durations: number[]; days: number[]; startMinutes: number; endMinutes: number;
  bufferMinutes: number; minNoticeHours: number; horizonDays: number;
};
export type BookingSlot = { start: string; end: string };
export const DEFAULT_BOOKING_PROFILE: BookingProfile = {
  enabled: false, slug: 'tremaine', name: 'Tremaine', description: 'Choose a time to meet.',
  timezone: 'America/New_York', durations: [15, 30, 60], days: [1, 2, 3, 4, 5],
  startMinutes: 540, endMinutes: 1020, bufferMinutes: 15, minNoticeHours: 24, horizonDays: 30,
};
export class BookingError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export function validateBookingProfile(input: unknown): BookingProfile {
  const p = input as BookingProfile;
  if (!p || typeof p !== 'object' || typeof p.enabled !== 'boolean' ||
      typeof p.slug !== 'string' || !/^[a-z0-9][a-z0-9-]{2,49}$/.test(p.slug) ||
      typeof p.name !== 'string' || !p.name.trim() || p.name.length > 100 ||
      typeof p.description !== 'string' || p.description.length > 500 ||
      typeof p.timezone !== 'string') throw new BookingError('Check the name, link, and description.');
  try { new Intl.DateTimeFormat('en-US', { timeZone: p.timezone }); }
  catch { throw new BookingError('Choose a valid timezone.'); }
  if (!Array.isArray(p.durations) || !p.durations.length || p.durations.length > 3 ||
      !p.durations.every(v => [15, 30, 60].includes(v)) ||
      !Array.isArray(p.days) || !p.days.length || p.days.length > 7 ||
      !p.days.every(v => Number.isInteger(v) && v >= 0 && v <= 6))
    throw new BookingError('Choose meeting lengths and available days.');
  for (const [key, min, max] of [
    ['startMinutes', 0, 1425], ['endMinutes', 15, 1440], ['bufferMinutes', 0, 120],
    ['minNoticeHours', 0, 168], ['horizonDays', 1, 60],
  ] as const) {
    if (!Number.isInteger(p[key]) || p[key] < min || p[key] > max)
      throw new BookingError(`Invalid ${key}.`);
  }
  if (p.startMinutes % 15 || p.endMinutes % 15 || p.endMinutes - p.startMinutes < Math.max(...p.durations))
    throw new BookingError('Available hours must fit your longest meeting and use 15-minute increments.');
  return { enabled: p.enabled, slug: p.slug, name: p.name.trim(), description: p.description.trim(),
    timezone: p.timezone, durations: [...new Set(p.durations)].sort((a,b)=>a-b), days: [...new Set(p.days)].sort(),
    startMinutes: p.startMinutes, endMinutes: p.endMinutes, bufferMinutes: p.bufferMinutes,
    minNoticeHours: p.minNoticeHours, horizonDays: p.horizonDays };
}
export function overlaps(a: BookingSlot, b: BookingSlot, bufferMinutes = 0) {
  const buffer = bufferMinutes * 60000;
  return Date.parse(a.start) < Date.parse(b.end) + buffer && Date.parse(a.end) + buffer > Date.parse(b.start);
}
/** Iterate real UTC instants so DST gaps never create fictitious local slots. */
export function generateBookingSlots(profile: BookingProfile, duration: number, busy: BookingSlot[], now = Date.now()): BookingSlot[] {
  if (!profile.durations.includes(duration)) throw new BookingError('Choose an available meeting length.');
  const formatter = new Intl.DateTimeFormat('en-US', { timeZone: profile.timezone, weekday: 'short',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const local = (instant: number) => Object.fromEntries(formatter.formatToParts(instant).map(p => [p.type, p.value]));
  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const slots: BookingSlot[] = [];
  const earliest = now + profile.minNoticeHours * 3600000;
  const latest = now + profile.horizonDays * 86400000;
  for (let start = Math.ceil(earliest / 900000) * 900000; start + duration * 60000 <= latest; start += 900000) {
    const parts = local(start);
    const minute = Number(parts.hour) * 60 + Number(parts.minute);
    if (!profile.days.includes(weekdays.indexOf(parts.weekday)) || minute < profile.startMinutes ||
        minute + duration > profile.endMinutes) continue;
    // Skip meetings crossing a DST transition; elapsed and displayed duration must agree.
    const endParts = local(start + duration * 60000);
    const localDateMs = (p: Record<string, string>) => Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute));
    if (localDateMs(endParts) - localDateMs(parts) !== duration * 60000) continue;
    const slot = { start: new Date(start).toISOString(), end: new Date(start + duration * 60000).toISOString() };
    if (!busy.some(block => overlaps(slot, block, profile.bufferMinutes))) slots.push(slot);
  }
  return slots;
}
export function publicBookingProfile(p: BookingProfile) {
  return { name: p.name, description: p.description, slug: p.slug, durations: p.durations, timezone: p.timezone };
}
