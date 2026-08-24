import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parsePulseCheckPilotDateKey,
  resolvePulseCheckPilotEnrollmentAcceptance,
  toPulseCheckPilotScheduleDate,
  validatePulseCheckPilotStartDate,
} from '../../src/utils/pulseCheckPilotSchedule';

test('restores a JSON-round-tripped Firestore timestamp shape', () => {
  const expectedTime = Date.UTC(2026, 7, 4, 4, 30, 15, 123);
  const restored = toPulseCheckPilotScheduleDate({
    seconds: Math.floor(expectedTime / 1000),
    nanoseconds: 123_000_000,
  });

  assert.ok(restored);
  assert.equal(restored.getTime(), expectedTime);
});

test('rejects timestamp methods that throw or return an invalid date', () => {
  assert.equal(
    toPulseCheckPilotScheduleDate({
      toDate() {
        throw new Error('timestamp unavailable');
      },
    }),
    null
  );
  assert.equal(toPulseCheckPilotScheduleDate({ toDate: () => new Date(Number.NaN) }), null);
});

test('parses an exact pilot date key at local midnight', () => {
  const parsed = parsePulseCheckPilotDateKey('2026-08-04');

  assert.ok(parsed);
  assert.equal(parsed.getFullYear(), 2026);
  assert.equal(parsed.getMonth(), 7);
  assert.equal(parsed.getDate(), 4);
  assert.equal(parsed.getHours(), 0);
  assert.equal(parsed.getMinutes(), 0);
  assert.equal(parsed.getSeconds(), 0);
  assert.equal(parsed.getMilliseconds(), 0);
});

test('trims valid input and rejects malformed or impossible pilot date keys', () => {
  assert.ok(parsePulseCheckPilotDateKey(' 2028-02-29 '));

  for (const value of [
    '',
    '2026-2-03',
    '2026-02-30',
    '2026-02-29',
    '2026-00-10',
    '2026-13-01',
    'not-a-date',
  ]) {
    assert.equal(parsePulseCheckPilotDateKey(value), null, `${value || 'empty input'} should be rejected`);
  }
});

test('requires a valid pilot start date', () => {
  assert.equal(
    validatePulseCheckPilotStartDate(null, new Date(2026, 7, 31)),
    'Choose a valid pilot start date.'
  );
  assert.equal(
    validatePulseCheckPilotStartDate(new Date(Number.NaN), null),
    'Choose a valid pilot start date.'
  );
});

test('accepts a start date before or on the fixed end date', () => {
  const endAt = new Date(2026, 7, 31, 23, 59, 59, 999);

  assert.equal(validatePulseCheckPilotStartDate(new Date(2026, 7, 1), endAt), null);
  assert.equal(validatePulseCheckPilotStartDate(new Date(2026, 7, 31), endAt), null);
  assert.equal(validatePulseCheckPilotStartDate(new Date(2030, 0, 1), null), null);
});

test('rejects a start date after the fixed end date', () => {
  assert.equal(
    validatePulseCheckPilotStartDate(
      new Date(2026, 8, 1),
      new Date(2026, 7, 31, 23, 59, 59, 999)
    ),
    'Start date must be on or before the pilot end date.'
  );
});

test('accepts enrollment only inside an active pilot schedule window', () => {
  const now = new Date('2026-08-24T04:00:00.000Z');

  assert.deepEqual(
    resolvePulseCheckPilotEnrollmentAcceptance(
      {
        status: 'active',
        startAt: new Date('2026-08-23T04:00:00.000Z'),
        endAt: new Date('2026-08-25T04:00:00.000Z'),
      },
      now
    ),
    { acceptsEnrollment: true, reason: 'accepting' }
  );
  assert.deepEqual(
    resolvePulseCheckPilotEnrollmentAcceptance(
      { status: 'active', startAt: now, endAt: now },
      now
    ),
    { acceptsEnrollment: true, reason: 'accepting' },
    'the schedule boundaries are inclusive'
  );
  assert.deepEqual(
    resolvePulseCheckPilotEnrollmentAcceptance({ status: 'active' }, now),
    { acceptsEnrollment: true, reason: 'accepting' },
    'active legacy pilots without schedule dates remain compatible'
  );
});

test('rejects active pilots before their start and after their end', () => {
  const now = new Date('2026-08-24T04:00:00.000Z');

  assert.deepEqual(
    resolvePulseCheckPilotEnrollmentAcceptance(
      { status: 'active', startAt: new Date('2026-08-25T04:00:00.000Z') },
      now
    ),
    { acceptsEnrollment: false, reason: 'not-started' }
  );
  assert.deepEqual(
    resolvePulseCheckPilotEnrollmentAcceptance(
      { status: 'active', endAt: new Date('2026-08-23T04:00:00.000Z') },
      now
    ),
    { acceptsEnrollment: false, reason: 'ended' }
  );
});

test('rejects inactive pilots and invalid schedule values', () => {
  const now = new Date('2026-08-24T04:00:00.000Z');

  for (const status of ['draft', 'paused', 'completed', 'archived', '']) {
    assert.deepEqual(
      resolvePulseCheckPilotEnrollmentAcceptance({ status }, now),
      { acceptsEnrollment: false, reason: 'inactive' },
      `${status || 'missing status'} should reject enrollment`
    );
  }
  assert.deepEqual(
    resolvePulseCheckPilotEnrollmentAcceptance(
      { status: 'active', startAt: 'not-a-firestore-date' },
      now
    ),
    { acceptsEnrollment: false, reason: 'invalid-schedule' }
  );
  assert.deepEqual(
    resolvePulseCheckPilotEnrollmentAcceptance(
      {
        status: 'active',
        startAt: new Date('2026-08-26T04:00:00.000Z'),
        endAt: new Date('2026-08-25T04:00:00.000Z'),
      },
      now
    ),
    { acceptsEnrollment: false, reason: 'invalid-schedule' }
  );
});
