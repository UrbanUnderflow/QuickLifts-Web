import test from 'node:test';
import assert from 'node:assert/strict';
import { selectLinearSkillTransition, type LinearSkillTransitionInput } from '../../src/api/firebase/dailyCurriculum/linearSkillTransition';
import type { LinearPublishedVersion } from '../../src/api/firebase/dailyCurriculum/linearPublication';
const version = (id: string, order: string[], ready = order): LinearPublishedVersion => ({ id, status: 'published', publishedAt: '2026-09-01T00:00:00Z', content: { orderedIds: order, rationales: {}, audience: { mode: 'explicit_athlete_ids', confirmed: true }, progressionBasis: 'five_days_in_fourteen', protocolDays: [5, 5, 5], simulationDays: { practice: 5, useIt: 5 } }, skills: order.map(id => ({ id })) as LinearPublishedVersion['skills'], runtimeReadySkillIds: ready });
const fixture = (): LinearSkillTransitionInput => ({ currentSkill: { skillId: 'a', versionId: 'v1', startedOn: '2026-09-01' }, pinnedVersion: version('v1', ['a', 'b', 'c']), latestApplicableVersion: version('v2', ['c', 'b']), completedSkillIds: [], skillComplete: false, nextStartedOn: '2026-09-20' });
test('mid-skill removal/reorder/publication preserves exact pin and original version', () => {
  const input = fixture();
  for (const latest of [null, version('v2', ['c', 'b']), version('v3', ['b', 'c'])]) {
    const result = selectLinearSkillTransition({ ...input, latestApplicableVersion: latest });
    assert.equal(result.kind, 'keep_current');
    if (result.kind === 'keep_current') { assert.equal(result.pin, input.currentSkill); assert.equal(result.version, input.pinnedVersion); }
  }
});
test('verified boundary uses latest order, skips completed skills and unavailable runtime', () => {
  const input = { ...fixture(), skillComplete: true, latestApplicableVersion: version('v3', ['d', 'c', 'b'], ['c', 'b']), completedSkillIds: ['c'] };
  const result = selectLinearSkillTransition(input);
  assert.equal(result.kind, 'next_skill');
  if (result.kind === 'next_skill') assert.deepEqual(result.pin, { skillId: 'b', versionId: 'v3', startedOn: '2026-09-20' });
});
test('current completed skill is skipped even before completion-id projection catches up', () => {
  const result = selectLinearSkillTransition({ ...fixture(), skillComplete: true, latestApplicableVersion: version('v2', ['a', 'b']) });
  assert.equal(result.kind, 'next_skill'); if (result.kind === 'next_skill') assert.equal(result.pin.skillId, 'b');
});
test('missing or mismatched pinned version fails closed even mid-skill', () => {
  for (const pinnedVersion of [null, version('wrong', ['a']), version('v1', ['b'])]) assert.equal(selectLinearSkillTransition({ ...fixture(), pinnedVersion }).kind, 'blocked');
});
test('missing latest and no ready remaining skill block at boundary', () => {
  for (const latestApplicableVersion of [null, version('v2', ['b'], [])]) assert.equal(selectLinearSkillTransition({ ...fixture(), skillComplete: true, latestApplicableVersion }).kind, 'blocked');
});
test('all latest skills previously complete returns complete, not restart', () => {
  assert.equal(selectLinearSkillTransition({ ...fixture(), skillComplete: true, completedSkillIds: ['b', 'c'] }).kind, 'complete');
});
test('invalid dates, reviewed versions, or inconsistent snapshots cannot transition', () => {
  for (const nextStartedOn of ['bad', '2026-02-30', '2026-09-01']) assert.equal(selectLinearSkillTransition({ ...fixture(), skillComplete: true, nextStartedOn }).kind, 'blocked');
  const malformed = { ...version('v2', ['b']), status: 'reviewed' as const };
  assert.equal(selectLinearSkillTransition({ ...fixture(), skillComplete: true, latestApplicableVersion: malformed }).kind, 'blocked');
});
test('retry is deterministic and leaves all input history and snapshots untouched', () => {
  const input = { ...fixture(), skillComplete: true };
  const before = JSON.stringify(input);
  assert.deepEqual(selectLinearSkillTransition(input), selectLinearSkillTransition(input));
  assert.equal(JSON.stringify(input), before);
});
