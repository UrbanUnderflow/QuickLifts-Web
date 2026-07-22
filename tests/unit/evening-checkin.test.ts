import test from 'node:test';
import assert from 'node:assert/strict';
import { __internal } from '../../netlify/functions/record-evening-checkin';

test('evening check-in only accepts authored reflection choices', () => {
  assert.equal(__internal.sanitizeReflection('My energy'), 'My energy');
  assert.equal(__internal.sanitizeReflection('I handled something well'), 'I handled something well');
  assert.equal(__internal.sanitizeReflection('Training or a competition'), 'Training or a competition');
  assert.equal(__internal.sanitizeReflection('Practice or a match'), 'Practice or a match');
  assert.equal(__internal.sanitizeReflection('Here is an unbounded disclosure'), undefined);
  assert.equal(__internal.sanitizeReflection(null), undefined);
});

test('evening check-in day key follows the athlete timezone', () => {
  const nearMidnightUtc = new Date('2026-07-20T01:30:00.000Z');
  assert.equal(__internal.formatYmdInTz(nearMidnightUtc, 'America/New_York'), '2026-07-19');
  assert.equal(__internal.formatYmdInTz(nearMidnightUtc, 'Europe/London'), '2026-07-20');
});

test('evening check-in authored copy rejects oversized client text', () => {
  assert.equal(__internal.sanitizeText('  Clear   copy  ', 'fallback', 40), 'Clear copy');
  assert.equal(__internal.sanitizeText('x'.repeat(41), 'fallback', 40), 'fallback');
});
