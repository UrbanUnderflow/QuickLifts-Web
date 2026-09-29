import test from 'node:test';
import assert from 'node:assert/strict';
import { calendarCopyIcs, googleCalendarCopyUrl } from '../../src/lib/groupMeetCalendarExport';
const meeting = { host: 'Host', name: 'Guest', start: '2099-10-01T15:00:00Z', end: '2099-10-01T15:30:00Z', meetLink: 'https://meet.google.com/example' };
test('Google Calendar copy has UTC times, meeting details and no invitation or management action', () => {
  const url = new URL(googleCalendarCopyUrl(meeting));
  assert.equal(url.searchParams.get('dates'), '20991001T150000Z/20991001T153000Z');
  assert.equal(url.searchParams.get('text'), 'Host / Guest');
  assert.equal(url.searchParams.get('location'), meeting.meetLink);
  assert.match(url.searchParams.get('details')!, /personal calendar copy/);
  assert.equal(url.searchParams.has('add'), false);
  assert.doesNotMatch(url.toString(), /management|booking\//);
});
test('ICS escapes injected properties, folds UTF8 lines, and does not send invitations', () => {
  const ics = calendarCopyIcs({ ...meeting, name: 'Guest,;\\\nATTENDEE:bad@example.test' + 'é'.repeat(90) }, new Date('2026-09-30T00:00:00Z'));
  assert.match(ics, /DTSTART:20991001T150000Z\r\nDTEND:20991001T153000Z/);
  assert.match(ics, /DTSTAMP:20260930T000000Z/);
  assert.doesNotMatch(ics, /\r\n(?:ATTENDEE|ORGANIZER|METHOD):/);
  assert.match(ics, /Guest\\,\\;\\\\\\nATTENDEE/);
  for (const line of ics.split('\r\n')) assert.ok(Buffer.byteLength(line) <= 75);
  assert.equal(ics.split('\r\n').filter(line => line.startsWith('BEGIN:VEVENT')).length, 1);
});
