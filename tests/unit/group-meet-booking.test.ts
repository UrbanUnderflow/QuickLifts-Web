import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BookingError, DEFAULT_BOOKING_PROFILE, generateBookingSlots, overlaps,
  publicBookingProfile, validateBookingProfile, type BookingProfile,
} from '../../src/lib/groupMeetBooking';

const profile = (overrides: Partial<BookingProfile> = {}): BookingProfile => ({
  ...DEFAULT_BOOKING_PROFILE, enabled: true, timezone: 'UTC', minNoticeHours: 0,
  horizonDays: 1, bufferMinutes: 0, ...overrides,
});
const starts = (p: BookingProfile, now: string, duration = 30) =>
  generateBookingSlots(p, duration, [], Date.parse(now)).map(slot => slot.start);

test('normalizes valid profiles and exposes only public booking details', () => {
  const p = validateBookingProfile(profile({ name: ' Host ', description: ' Hello ', durations: [60, 15, 15], days: [5, 1, 1] }));
  assert.deepEqual(p.durations, [15, 60]);
  assert.deepEqual(p.days, [1, 5]);
  assert.equal(p.name, 'Host');
  assert.equal(p.description, 'Hello');
  assert.deepEqual(Object.keys(publicBookingProfile(p)).sort(), ['description', 'durations', 'name', 'slug', 'timezone']);
});

test('rejects malformed profiles and unavailable meeting durations', () => {
  for (const input of [null, {}, profile({ slug: '../private' }), profile({ name: ' ' }),
    profile({ timezone: 'Not/AZone' }), profile({ durations: [] }), profile({ durations: [45] }),
    profile({ days: [] }), profile({ days: [7] }), profile({ days: [1.5] }),
    profile({ bufferMinutes: -1 }), profile({ minNoticeHours: 169 }), profile({ horizonDays: 0 }),
    profile({ horizonDays: 61 }), profile({ startMinutes: 541 }), profile({ endMinutes: 570 }),
    profile({ endMinutes: 1441 }), profile({ startMinutes: Number.NaN })]) {
    assert.throws(() => validateBookingProfile(input), BookingError);
  }
  for (const duration of [0, -15, 45, Number.NaN]) {
    assert.throws(() => generateBookingSlots(profile(), duration, [], Date.parse('2026-09-28T00:00:00Z')), BookingError);
  }
});

test('default weekdays exclude weekends and meetings fit fully within working hours', () => {
  assert.deepEqual(starts(profile(), '2026-09-26T00:00:00Z'), []);
  const slots = starts(profile(), '2026-09-28T00:00:00Z', 60);
  assert.equal(slots[0], '2026-09-28T09:00:00.000Z');
  assert.equal(slots.at(-1), '2026-09-28T16:00:00.000Z');
  assert.equal(slots.length, 29);
});

test('notice is inclusive, rounded up to a quarter hour, and horizon limits meeting end', () => {
  const p = profile({ days: [0, 1, 2, 3, 4, 5, 6], startMinutes: 0, endMinutes: 1440, minNoticeHours: 2 });
  const exact = generateBookingSlots(p, 30, [], Date.parse('2026-09-28T09:00:00Z'));
  assert.equal(exact[0].start, '2026-09-28T11:00:00.000Z');
  assert.equal(exact.at(-1)?.end, '2026-09-29T09:00:00.000Z');
  const rounded = starts(p, '2026-09-28T09:01:00Z');
  assert.equal(rounded[0], '2026-09-28T11:15:00.000Z');
  assert.deepEqual(starts(profile({ minNoticeHours: 25 }), '2026-09-28T00:00:00Z'), []);
});

test('busy periods enforce buffers on both sides while allowing exact boundary contact', () => {
  const block = { start: '2026-09-28T10:00:00Z', end: '2026-09-28T11:00:00Z' };
  const slot = (start: string, end: string) => ({ start: `2026-09-28T${start}:00Z`, end: `2026-09-28T${end}:00Z` });
  assert.equal(overlaps(slot('09:15', '09:45'), block, 15), false);
  assert.equal(overlaps(slot('09:30', '10:00'), block, 15), true);
  assert.equal(overlaps(slot('11:00', '11:30'), block, 15), true);
  assert.equal(overlaps(slot('11:15', '11:45'), block, 15), false);
  assert.equal(overlaps(slot('09:30', '10:00'), block), false);
  const available = generateBookingSlots(profile({ bufferMinutes: 15 }), 30, [block], Date.parse('2026-09-28T00:00:00Z')).map(s => s.start);
  assert.ok(available.includes('2026-09-28T09:15:00.000Z'));
  assert.ok(!available.includes('2026-09-28T09:30:00.000Z'));
  assert.ok(!available.includes('2026-09-28T11:00:00.000Z'));
  assert.ok(available.includes('2026-09-28T11:15:00.000Z'));
});

test('spring DST preserves host hours and omits meetings crossing the skipped hour', () => {
  const p = profile({ timezone: 'America/New_York', days: [0], startMinutes: 60, endMinutes: 240 });
  const slots = starts(p, '2026-03-08T05:00:00Z');
  assert.ok(slots.includes('2026-03-08T06:00:00.000Z')); // 01:00 EST
  assert.ok(!slots.includes('2026-03-08T06:45:00.000Z')); // 01:45 to 03:15
  assert.ok(slots.includes('2026-03-08T07:00:00.000Z')); // 03:00 EDT
  assert.equal(slots.at(-1), '2026-03-08T07:30:00.000Z');
});

test('fall DST produces distinct real instants for repeated hours and omits crossing meetings', () => {
  const p = profile({ timezone: 'America/New_York', days: [0], startMinutes: 60, endMinutes: 180 });
  const slots = starts(p, '2026-11-01T04:00:00Z');
  assert.ok(slots.includes('2026-11-01T05:00:00.000Z')); // first 01:00
  assert.ok(slots.includes('2026-11-01T06:00:00.000Z')); // second 01:00
  assert.ok(!slots.includes('2026-11-01T05:45:00.000Z'));
  assert.equal(new Set(slots).size, slots.length);
});

test('host working hours support half-hour and quarter-hour timezones', () => {
  for (const [timezone, expected] of [['Asia/Kolkata', '03:30'], ['Asia/Kathmandu', '03:15']]) {
    const slots = starts(profile({ timezone, startMinutes: 540, endMinutes: 600 }), '2026-09-28T00:00:00Z');
    assert.equal(slots[0], `2026-09-28T${expected}:00.000Z`);
    assert.equal(slots.length, 3);
  }
});

test('a meeting ending exactly at a DST transition must retain its displayed duration', () => {
  const p = profile({ timezone: 'America/New_York', days: [0], startMinutes: 60, endMinutes: 240 });
  assert.ok(!starts(p, '2026-03-08T05:00:00Z', 15).includes('2026-03-08T06:45:00.000Z'));
  assert.ok(!starts(p, '2026-11-01T04:00:00Z', 15).includes('2026-11-01T05:45:00.000Z'));
});
