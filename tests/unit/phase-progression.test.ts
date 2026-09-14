import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluatePhaseProgression, addLocalCalendarDays } from '../../src/api/firebase/dailyCurriculum/phaseProgression';
const events = (days: string[]) => days.map((day, i) => ({ id: `event-${i}`, completedAt: Date.parse(`${day}T12:00:00Z`) }));
const evaluate = (asOf: string, days: string[] = []) => evaluatePhaseProgression({ phaseStartedOn: '2026-09-01', asOf, timezone: 'UTC', completions: events(days) });
test('day one and day fourteen count inclusively; missed days do not break progress', () => {
  const row = evaluate('2026-09-14', ['2026-09-01', '2026-09-04', '2026-09-08', '2026-09-12', '2026-09-14']);
  assert.equal(row.completedOn, '2026-09-14'); assert.equal(row.count, 5);
  assert.equal(row.currentWindowStart, '2026-09-01'); assert.equal(row.currentWindowEnd, '2026-09-14'); assert.equal(row.restartCount, 0);
});
test('day fifteen starts a fresh fixed window without rolling old days forward', () => {
  const row = evaluate('2026-09-15', ['2026-09-01', '2026-09-04', '2026-09-08', '2026-09-14', '2026-09-15']);
  assert.equal(row.completedOn, null); assert.equal(row.count, 1); assert.equal(row.restartCount, 1);
  assert.equal(row.currentWindowStart, '2026-09-15'); assert.equal(row.currentWindowEnd, '2026-09-28');
});
test('a qualifying fifth day remains permanently completed months later', () => {
  const row = evaluate('2026-12-01', ['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04', '2026-09-05']);
  assert.equal(row.completedOn, '2026-09-05'); assert.equal(row.count, 5); assert.equal(row.restartCount, 0);
  assert.equal(row.currentWindowEnd, '2026-09-14');
});
test('later qualifying windows work and earliest qualifying window wins', () => {
  const row = evaluate('2026-10-14', ['2026-09-01', '2026-09-15', '2026-09-18', '2026-09-20', '2026-09-24', '2026-09-28', '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05']);
  assert.equal(row.completedOn, '2026-09-28');
});
test('duplicate event ids and replays on one local day count once, order independently', () => {
  const completions = [...events(['2026-09-01', '2026-09-01', '2026-09-02']), { id: 'event-0', completedAt: Date.parse('2026-09-03T12:00:00Z') }];
  const input = { phaseStartedOn: '2026-09-01', asOf: '2026-09-14', timezone: 'UTC', completions };
  assert.equal(evaluatePhaseProgression(input).count, 2);
  assert.deepEqual(evaluatePhaseProgression(input), evaluatePhaseProgression({ ...input, completions: [...completions].reverse() }));
});
test('invalid, future, before-start and blank-id records do not count', () => {
  const completions = [...events(['2026-08-31', '2026-09-15']), { id: 'bad', completedAt: NaN }, { id: '', completedAt: Date.parse('2026-09-02T12:00:00Z') }];
  assert.equal(evaluatePhaseProgression({ phaseStartedOn: '2026-09-01', asOf: '2026-09-14', timezone: 'UTC', completions }).count, 0);
});
test('timezone defines completion day rather than UTC date', () => {
  const completions = [{ id: 'a', completedAt: Date.parse('2026-09-02T02:00:00Z') }];
  const row = evaluatePhaseProgression({ phaseStartedOn: '2026-09-01', asOf: '2026-09-01', timezone: 'America/New_York', completions });
  assert.deepEqual(row.uniqueCompletionDays, ['2026-09-01']);
});
test('fall DST repeated hour is one day and windows remain fourteen calendar days', () => {
  const completions = ['2026-11-01T05:30:00Z', '2026-11-01T06:30:00Z', '2026-11-02T05:30:00Z'].map((time, i) => ({ id: String(i), completedAt: Date.parse(time) }));
  const row = evaluatePhaseProgression({ phaseStartedOn: '2026-10-25', asOf: '2026-11-07', timezone: 'America/New_York', completions });
  assert.equal(row.count, 2); assert.equal(row.currentWindowEnd, '2026-11-07'); assert.equal(row.restartCount, 0);
});
test('bad date or timezone fails explicitly; before phase entry has empty progress', () => {
  assert.throws(() => evaluate('2026-02-30'));
  assert.throws(() => evaluatePhaseProgression({ phaseStartedOn: '2026-09-01', asOf: '2026-09-02', timezone: 'Invalid/Zone', completions: [] }));
  assert.equal(evaluate('2026-08-31').count, 0);
});

test('completion freezes at five despite later practice; calendar addition crosses DST and leap days', () => {
  const row = evaluate('2026-09-28', ['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04', '2026-09-05', '2026-09-06', '2026-09-20']);
  assert.equal(row.count, 5); assert.equal(row.completedOn, '2026-09-05');
  assert.equal(addLocalCalendarDays('2028-02-28', 1), '2028-02-29');
  assert.equal(addLocalCalendarDays('2026-11-01', 1), '2026-11-02');
  assert.throws(() => addLocalCalendarDays('2026-09-01', 0.5));
});
test('an old event id replayed with a new timestamp cannot gain phase credit', () => {
  const result = evaluatePhaseProgression({ phaseStartedOn: '2026-09-15', asOf: '2026-09-16', timezone: 'UTC', completions: [{ id: 'old', completedAt: Date.parse('2026-09-01T12:00:00Z') }, { id: 'old', completedAt: Date.parse('2026-09-16T12:00:00Z') }] });
  assert.equal(result.count, 0);
});
