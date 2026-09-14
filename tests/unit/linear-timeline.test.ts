import test from 'node:test';
import assert from 'node:assert/strict';
import { buildLinearTimeline, type LinearTimelineInput } from '../../src/api/firebase/dailyCurriculum/linearTimeline';
import type { LinearPublishedVersion } from '../../src/api/firebase/dailyCurriculum/linearPublication';
const version = (id: string, ids: string[], ready = ids) => ({ id, status: 'published', content: { orderedIds: ids }, skills: ids.map(id => ({ id, name: `Name ${id}` })), runtimeReadySkillIds: ready }) as LinearPublishedVersion;
const input = (): LinearTimelineInput => ({ completedSkillIds: ['old', 'old'], completedSkillSummaries: [{ skillId: 'old', name: 'Original name' }], currentAssignment: { skillId: 'current', skillName: 'Pinned skill', versionId: 'v1', skillType: 'protocol', phase: 'practice', completedDayCount: 2, requiredDays: 5, windowStart: '2026-09-01', windowEnd: '2026-09-14' }, pinnedVersion: version('v1', ['old', 'current']), latestApplicableVersion: version('v2', ['next', 'old', 'current', 'unready'], ['next', 'old', 'current']) });
test('preserves actual completed history and pinned current while using latest upcoming order', () => {
  const row = buildLinearTimeline(input());
  assert.deepEqual(row.completed, [{ skillId: 'old', name: 'Original name' }]);
  assert.equal(row.current?.name, 'Pinned skill'); assert.equal(row.current?.versionId, 'v1');
  assert.deepEqual(row.current?.phases.map(p => p.status), ['complete', 'current', 'upcoming']);
  assert.deepEqual(row.upcoming.map(s => s.skillId), ['next']); assert.equal(row.upcomingTotal, 1);
});
test('simulation has Practice and Use only; learning stays within existing game', () => {
  const data = input(); data.currentAssignment = { ...data.currentAssignment!, skillType: 'simulation', phase: 'practice' };
  assert.deepEqual(buildLinearTimeline(data).current?.phases.map(p => p.id), ['practice', 'use_it']);
});
test('missing latest leaves upcoming unavailable without hiding history/current', () => {
  const row = buildLinearTimeline({ ...input(), latestApplicableVersion: null });
  assert.equal(row.completed.length, 1); assert.ok(row.current); assert.equal(row.upcomingTotal, 0); assert.match(row.upcomingLabel, /unavailable/);
});
test('no completion is fabricated from prior order and names fall back to actual id', () => {
  const row = buildLinearTimeline({ ...input(), completedSkillIds: ['unknown'], completedSkillSummaries: [] });
  assert.deepEqual(row.completed, [{ skillId: 'unknown', name: 'unknown' }]);
});
test('bounds lists at200, keeps full upcoming total and excludes all completed ids before slicing', () => {
  const ids = Array.from({ length: 450 }, (_, i) => `skill-${i}`);
  const row = buildLinearTimeline({ ...input(), currentAssignment: null, completedSkillIds: ids.slice(0, 220), latestApplicableVersion: version('v3', ids) });
  assert.equal(row.completed.length, 200); assert.equal(row.upcoming.length, 200); assert.equal(row.upcomingTotal, 230); assert.equal(row.upcoming[0].skillId, 'skill-220');
});
test('clamps count to five and leaves inputs unchanged', () => {
  const data = input(); data.currentAssignment!.completedDayCount = 9;
  const before = JSON.stringify(data); assert.equal(buildLinearTimeline(data).current?.completedDayCount, 5); assert.equal(JSON.stringify(data), before);
});
