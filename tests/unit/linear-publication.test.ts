import test from 'node:test';
import assert from 'node:assert/strict';
import { buildLinearVersion, previewLinearAssignment, validateLinearPublication, type LinearPublicationDraft, type LinearCompletionEvidence } from '../../src/api/firebase/dailyCurriculum/linearPublication';
import type { LinearCurriculumEntry } from '../../src/api/firebase/dailyCurriculum/linearCurriculum';
const active: LinearCurriculumEntry[] = [
  { id: 'protocol-478-breathing', name: '4-7-8 Breathing', type: 'protocol', readiness: 'review required', rationale: '', sourceRefs: [], aliases: [], catalogType: 'protocol', classificationReason: '' },
  { id: 'reset', name: 'Reset', type: 'simulation', readiness: 'adaptation required', rationale: '', sourceRefs: [], aliases: [], catalogType: 'simulation', classificationReason: '' },
];
const draft = (): LinearPublicationDraft => ({ orderedIds: active.map(item => item.id), rationales: {}, audience: { mode: 'explicit_athlete_ids', confirmed: true }, progressionBasis: 'five_days_in_fourteen', protocolDays: [5, 5, 5], simulationDays: { practice: 5, useIt: 5 } });
const version = (changes: Partial<LinearPublicationDraft> = {}, ready = ['protocol-478-breathing']) => buildLinearVersion({ id: 'v1', publishedAt: '2026-09-13T12:00:00Z', draft: { ...draft(), ...changes }, active, runtimeReadySkillIds: ready });
const enrollment = { athleteId: 'a1', versionId: 'v1', optedIn: true as const, startedOn: '2026-09-01', timezone: 'America/New_York', historyPolicy: 'preserve' as const };
const completion = (day: string, phase: LinearCompletionEvidence['phase'] = 'learn'): LinearCompletionEvidence => ({ id: `${phase}-${day}`, athleteId: 'a1', versionId: 'v1', skillId: active[0].id, phase, status: 'completed', completedAt: Date.parse(`${day}T12:00:00Z`) });
const preview = (asOf: string, completions: LinearCompletionEvidence[] = []) => previewLinearAssignment({ featureEnabled: true, athleteId: 'a1', version: version(), enrollment, asOf, completions });
test('new publications require chosen policy, preserve simulation and audience decisions', () => {
  assert.equal(validateLinearPublication({ ...draft(), audience: null, simulationDays: null }, active).errors.length, 2);
  assert.throws(() => version({ progressionBasis: 'calendar_days' }), /five distinct/);
  assert.throws(() => version({ progressionBasis: 'completed_sessions' }), /five distinct/);
});
test('published snapshot remains detached and frozen; no implicit runtime approval', () => {
  const source = draft(); const built = buildLinearVersion({ id: 'v1', publishedAt: '2026-09-13', draft: source, active });
  source.orderedIds.reverse(); assert.equal(built.content.orderedIds[0], active[0].id);
  assert.equal(Object.isFrozen(built.content.orderedIds), true); assert.deepEqual(built.runtimeReadySkillIds, []);
});
test('feature gate, pinned opt-in and timezone remain required', () => {
  const input = { athleteId: 'a1', version: version(), enrollment, asOf: '2026-09-13' };
  assert.equal(previewLinearAssignment(input).kind, 'blocked');
  assert.equal(previewLinearAssignment({ ...input, featureEnabled: true, enrollment: { ...enrollment, timezone: undefined } }).kind, 'blocked');
  assert.equal(previewLinearAssignment({ ...input, featureEnabled: true, enrollment: { ...enrollment, versionId: 'other' } }).kind, 'blocked');
});
test('five nonconsecutive days qualify on day14; next phase starts day15', () => {
  const history = ['01','03','07','10','14'].map(d => completion(`2026-09-${d}`));
  const day14 = preview('2026-09-14', history); assert.equal(day14.kind, 'assignment');
  if (day14.kind === 'assignment') { assert.equal(day14.phase, 'learn'); assert.equal(day14.verifiedCompletions, 5); assert.equal(day14.phaseCompletedToday, true); }
  const day15 = preview('2026-09-15', history); assert.equal(day15.kind, 'assignment');
  if (day15.kind === 'assignment') { assert.equal(day15.phase, 'practice'); assert.equal(day15.windowStart, '2026-09-15'); assert.equal(day15.verifiedCompletions, 0); }
});
test('day15 restarts only unfinished phase; old history and replays cannot count in new window', () => {
  const history = ['01','03','07','14'].map(d => completion(`2026-09-${d}`)); const before = JSON.stringify(history);
  const result = preview('2026-09-15', [...history, ...history, completion('2026-09-15')]);
  assert.equal(result.kind, 'assignment'); if (result.kind === 'assignment') { assert.equal(result.phase, 'learn'); assert.equal(result.restartCount, 1); assert.equal(result.verifiedCompletions, 1); }
  assert.equal(JSON.stringify(history), before);
});
test('same-day duplicates, other versions and future evidence never accelerate phases', () => {
  const one = completion('2026-09-01');
  const result = preview('2026-09-02', [one, one, { ...one, id: 'replay' }, { ...one, id: 'legacy', versionId: 'old' }, completion('2026-09-20')]);
  assert.equal(result.kind, 'assignment'); if (result.kind === 'assignment') assert.equal(result.verifiedCompletions, 1);
  assert.equal(preview('2026-09-02', [{ ...one, completedAt: undefined }]).kind, 'blocked');
});
test('completed prior phases remain complete after an unsuccessful later window', () => {
  const history = ['01','02','03','04','05'].map(d => completion(`2026-09-${d}`));
  history.push(completion('2026-09-06','practice'));
  const result = preview('2026-09-20', history); assert.equal(result.kind, 'assignment');
  if (result.kind === 'assignment') { assert.equal(result.phase, 'practice'); assert.equal(result.restartCount, 1); assert.equal(result.windowStart, '2026-09-20'); assert.equal(result.verifiedCompletions, 0); }
});
test('phase entry filters previewed future-phase evidence and simulation readiness remains a gate', () => {
  const history = ['01','02','03','04','05'].map(d => completion(`2026-09-${d}`));
  history.push(...['01','02','03','04','05'].map(d => completion(`2026-09-${d}`, 'practice')));
  const result = preview('2026-09-06', history); assert.equal(result.kind, 'assignment');
  if (result.kind === 'assignment') assert.equal(result.verifiedCompletions, 0);
  history.push(...['06','07','08','09','10'].map(d => completion(`2026-09-${d}`, 'practice')));
  history.push(...['11','12','13','14','15'].map(d => completion(`2026-09-${d}`, 'use_it')));
  const nextSkill = preview('2026-09-16', history); assert.equal(nextSkill.kind, 'blocked');
  if (nextSkill.kind === 'blocked') assert.match(nextSkill.reason, /Reset needs runtime review/);
});
test('releases cannot replace a mid-skill phase, window, or content; transition follows whole skill only', async () => {
  const { previewPinnedSkillAssignment } = await import('../../src/api/firebase/dailyCurriculum/linearPublication');
  const latest = buildLinearVersion({ id: 'v3', publishedAt: '2026-09-13', draft: draft(), active: active.map(s => ({ ...s, name: `${s.name} revised` })), runtimeReadySkillIds: active.map(s => s.id) });
  const input = { featureEnabled: true, athleteId: 'a1', enrollment, currentSkill: { skillId: active[0].id, versionId: 'v1', startedOn: '2026-09-01' }, pinnedVersion: version(), latestApplicableVersion: latest, completedSkillIds: [], asOf: '2026-09-08', completions: ['01','02','03','04','05'].map(d => completion(`2026-09-${d}`)) };
  const mid = previewPinnedSkillAssignment(input); assert.equal(mid.nextPin, undefined); assert.equal(mid.result.kind, 'assignment');
  if (mid.result.kind === 'assignment') { assert.equal(mid.result.phase, 'practice'); assert.equal(mid.result.skillName, '4-7-8 Breathing'); assert.equal(mid.result.windowStart, '2026-09-06'); assert.equal(mid.result.versionId, 'v1'); }
  const history = [...input.completions, ...['06','07','08','09','10'].map(d => completion(`2026-09-${d}`, 'practice')), ...['11','12','13','14','15'].map(d => completion(`2026-09-${d}`, 'use_it'))];
  const boundary = { ...input, asOf: '2026-09-16', completions: history }; const before = JSON.stringify(boundary);
  const next = previewPinnedSkillAssignment(boundary); assert.deepEqual(next.nextPin, { skillId: 'reset', versionId: 'v3', startedOn: '2026-09-16' });
  assert.equal(next.result.kind, 'assignment'); if (next.result.kind === 'assignment') { assert.equal(next.result.phase, 'practice'); assert.equal(next.result.skillName, 'Reset revised'); }
  assert.deepEqual(previewPinnedSkillAssignment(boundary), next); assert.equal(JSON.stringify(boundary), before);
  const pinnedRetry = previewPinnedSkillAssignment({ ...boundary, currentSkill: next.nextPin!, pinnedVersion: latest, latestApplicableVersion: null, completedSkillIds: [active[0].id] });
  assert.equal(pinnedRetry.result.kind, 'assignment'); assert.equal(pinnedRetry.nextPin, undefined);
  const missing = previewPinnedSkillAssignment({ ...input, pinnedVersion: null }); assert.equal(missing.result.kind, 'blocked');
});
