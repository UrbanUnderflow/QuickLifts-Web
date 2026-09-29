/** Personal calendar copies. These do not send invitations or grant booking management access. */
export type CalendarCopy = { host: string; name: string; start: string; end: string; meetLink?: string };
const timestamp = (value: string) => new Date(value).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
const summary = (meeting: CalendarCopy) => `${meeting.host} / ${meeting.name}`;
const description = (meeting: CalendarCopy) => `Individual meeting booked through Group Meet.${meeting.meetLink ? `\nGoogle Meet: ${meeting.meetLink}` : ''}\nThis is a personal calendar copy. Update or remove it yourself if the booking changes.`;
export function googleCalendarCopyUrl(meeting: CalendarCopy) {
  const query = new URLSearchParams({ action: 'TEMPLATE', text: summary(meeting), dates: `${timestamp(meeting.start)}/${timestamp(meeting.end)}`, details: description(meeting) });
  if (meeting.meetLink) query.set('location', meeting.meetLink);
  return `https://calendar.google.com/calendar/render?${query.toString()}`;
}
const escapeText = (value: string) => value.replace(/\\/g, '\\\\').replace(/\r\n|\r|\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,');
function fold(line: string) {
  const encoder = new TextEncoder();
  let result = '', bytes = 0;
  for (const char of line) {
    const size = encoder.encode(char).length;
    if (bytes + size > 75) { result += '\r\n '; bytes = 1; }
    result += char; bytes += size;
  }
  return result;
}
export function calendarCopyIcs(meeting: CalendarCopy, now = new Date()) {
  // A stable, non-secret UID keeps repeat imports of this personal copy consistent.
  let hash = 2166136261;
  for (const char of `${meeting.host}|${meeting.name}|${meeting.start}`) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Group Meet//Personal Calendar Copy//EN', 'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT', `UID:groupmeet-${(hash >>> 0).toString(16)}-${Date.parse(meeting.start)}@fitwithpulse.ai`,
    `DTSTAMP:${timestamp(now.toISOString())}`, `DTSTART:${timestamp(meeting.start)}`, `DTEND:${timestamp(meeting.end)}`,
    `SUMMARY:${escapeText(summary(meeting))}`, `DESCRIPTION:${escapeText(description(meeting))}`,
    ...(meeting.meetLink ? [`LOCATION:${escapeText(meeting.meetLink)}`] : []),
    'END:VEVENT', 'END:VCALENDAR', '',
  ].map(fold).join('\r\n');
}
export function downloadCalendarCopy(meeting: CalendarCopy) {
  const url = URL.createObjectURL(new Blob([calendarCopyIcs(meeting)], { type: 'text/calendar;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url; link.download = 'group-meet.ics'; document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
