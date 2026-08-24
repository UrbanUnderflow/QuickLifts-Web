import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parsePulseCheckPilotDateKey,
  resolvePulseCheckPilotEnrollmentAcceptance,
  resolvePulseCheckPilotDateKeyEndOfDay,
  shouldReopenPulseCheckPilotAfterScheduleUpdate,
  shiftPulseCheckPilotDateKey,
  toPulseCheckPilotScheduleDate,
  validatePulseCheckPilotSchedule,
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

test('computes inclusive preset pilot end date keys', () => {
  assert.equal(shiftPulseCheckPilotDateKey('2026-04-08', 13), '2026-04-21');
  assert.equal(shiftPulseCheckPilotDateKey('2026-04-08', 29), '2026-05-07');
  assert.equal(shiftPulseCheckPilotDateKey('2026-04-08', 59), '2026-06-06');
  assert.equal(shiftPulseCheckPilotDateKey('2026-04-08', 89), '2026-07-06');
});

test('resolves a selected pilot end date through the end of that day', () => {
  const endOfDay = resolvePulseCheckPilotDateKeyEndOfDay('2026-07-06');

  assert.ok(endOfDay);
  assert.equal(endOfDay.getFullYear(), 2026);
  assert.equal(endOfDay.getMonth(), 6);
  assert.equal(endOfDay.getDate(), 6);
  assert.equal(endOfDay.getHours(), 23);
  assert.equal(endOfDay.getMinutes(), 59);
  assert.equal(endOfDay.getSeconds(), 59);
  assert.equal(endOfDay.getMilliseconds(), 999);
});

test('allows clearing both pilot schedule dates', () => {
  assert.equal(validatePulseCheckPilotSchedule(null, null), null);
  assert.equal(validatePulseCheckPilotSchedule(new Date(2026, 3, 8), null), null);
  assert.equal(validatePulseCheckPilotSchedule(null, new Date(2026, 6, 6)), null);
  assert.equal(
    validatePulseCheckPilotSchedule(new Date(2026, 6, 7), new Date(2026, 6, 6)),
    'Start date must be on or before the pilot end date.'
  );
});

test('explicit schedule edits reopen only completed pilots with a non-ended window', () => {
  const now = new Date('2026-08-24T12:00:00.000Z');

  assert.equal(
    shouldReopenPulseCheckPilotAfterScheduleUpdate(
      'completed',
      new Date('2026-08-31T23:59:59.999Z'),
      true,
      now
    ),
    true
  );
  assert.equal(
    shouldReopenPulseCheckPilotAfterScheduleUpdate('completed', null, true, now),
    true,
    'clearing the end date creates an open-ended schedule'
  );
  assert.equal(
    shouldReopenPulseCheckPilotAfterScheduleUpdate(
      'completed',
      new Date('2026-08-23T23:59:59.999Z'),
      true,
      now
    ),
    false,
    'a completed pilot must stay completed when the replacement window already ended'
  );

  for (const status of ['draft', 'active', 'paused', 'archived']) {
    assert.equal(
      shouldReopenPulseCheckPilotAfterScheduleUpdate(
        status,
        new Date('2026-08-31T23:59:59.999Z'),
        true,
        now
      ),
      false,
      `${status} must not be changed by the completed-pilot reopen intent`
    );
  }

  assert.equal(
    shouldReopenPulseCheckPilotAfterScheduleUpdate(
      'completed',
      new Date('2026-08-31T23:59:59.999Z'),
      false,
      now
    ),
    false,
    'callers must opt into reopening a completed pilot'
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
