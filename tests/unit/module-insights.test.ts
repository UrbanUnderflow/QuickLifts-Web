import test from 'node:test';
import assert from 'node:assert/strict';
import { buildModuleInsights, type ModuleInsightsInput } from '../../src/api/firebase/dailyCurriculum/moduleInsights';
const fixture = (): ModuleInsightsInput => ({ window: { start: 100, end: 200 }, assignments: [], events: [], completions: [] });
const assignment = (id: string, athleteId = 'athlete') => ({ id, athleteId, simSpecId: 'reset' });
test('assignment and view alone never establish a start', () => {
  const input = fixture(); input.assignments = [assignment('a')];
  input.events = [{ id: 'v', assignmentId: 'a', athleteId: 'athlete', eventType: 'viewed', eventAt: 120 }];
  assert.deepEqual(buildModuleInsights(input), []);
});
test('completion-backfilled startedAt is not independently observed start', () => {
  const input = fixture(); input.assignments = [{ ...assignment('a'), startedAt: 120, completedAt: 120 }];
  const [row] = buildModuleInsights(input);
  assert.equal(row.uniqueStarters, 0); assert.equal(row.completionOfStarters.rate, null); assert.equal(row.completedSessions, 1);
  input.events.push({ id: 's', assignmentId: 'a', athleteId: 'athlete', eventType: 'started', eventAt: 110 });
  assert.equal(buildModuleInsights(input)[0].completionOfStarters.rate, 1);
});
test('completion cohort requires same assignment and start inside window', () => {
  const input = fixture(); input.assignments = [
    { ...assignment('a'), startedAt: 110 }, { ...assignment('b'), startedAt: 50, completedAt: 150 },
    { ...assignment('c', 'second'), startedAt: 120, completedAt: 180 },
    { ...assignment('d', 'third'), startedAt: 130, completedAt: 200 },
  ];
  const [row] = buildModuleInsights(input);
  assert.deepEqual(row.completionOfStarters, { numerator: 1, denominator: 3, rate: 1 / 3 });
  assert.equal(row.completedSessions, 2);
});
test('assignment completion, repeated completion events and linked completion record deduplicate', () => {
  const input = fixture(); input.assignments = [{ ...assignment('a'), startedAt: 101, completedAt: 150 }];
  input.events = [1, 2].map(n => ({ id: String(n), assignmentId: 'a', athleteId: 'athlete', eventType: 'completed', eventAt: 151 }));
  input.completions = [{ id: 'c', userId: 'athlete', exerciseId: 'legacy', dailyAssignmentId: 'a', completedAt: 152, helpfulnessRating: 4 }];
  const [row] = buildModuleInsights(input);
  assert.equal(row.completedSessions, 1); assert.deepEqual(row.usefulness, { average: 4, respondentRecords: 1 });
});
test('repeat use is additional completed sessions and repeaters over unique completers', () => {
  const input = fixture(); input.aliasMap = { old: 'reset' };
  input.assignments = [assignment('1', 'a'), assignment('2', 'a'), assignment('3', 'b'), assignment('4', 'b')];
  input.completions = [
    { id: '1', dailyAssignmentId: '1', userId: 'a', exerciseId: 'old', completedAt: 100, helpfulnessRating: 2 },
    { id: '2', dailyAssignmentId: '2', userId: 'a', exerciseId: 'reset', completedAt: 150, helpfulnessRating: 4 },
    { id: '3', dailyAssignmentId: '3', userId: 'b', exerciseId: 'reset', completedAt: 199, helpfulnessRating: 99 },
    { id: '4', dailyAssignmentId: '4', userId: 'b', exerciseId: 'reset', completedAt: 200 },
  ];
  const [row] = buildModuleInsights(input);
  assert.deepEqual(row.repeatUse, { additionalSessions: 1, numerator: 1, denominator: 2, rate: 0.5 });
  assert.deepEqual(row.usefulness, { average: 3, respondentRecords: 2 });
  assert.equal(row.uniqueStarters, 0); assert.equal(row.followOnAssessment.rate, null);
  assert.equal(JSON.stringify(row).includes('userId'), false);
});
test('missing assignment links and cross-athlete links are skipped rather than inferred', () => {
  const input = fixture(); input.assignments = [assignment('a')];
  input.completions = [
    { id: '1', userId: 'wrong', exerciseId: 'reset', dailyAssignmentId: 'a', completedAt: 150 },
    { id: '2', userId: 'athlete', exerciseId: 'reset', dailyAssignmentId: 'missing', completedAt: 150 },
  ];
  input.events = [{ id: '1', assignmentId: 'a', athleteId: 'wrong', eventType: 'started', eventAt: 120 }];
  assert.deepEqual(buildModuleInsights(input), []);
});
test('invalid window is rejected; empty observations produce no invented rows', () => {
  assert.deepEqual(buildModuleInsights(fixture()), []);
  assert.throws(() => buildModuleInsights({ ...fixture(), window: { start: 200, end: 100 } }));
});

test('unlinked completion cannot inflate assignment repeat counts or duplicate helpfulness', () => {
  const input = fixture();
  input.assignments = [{ ...assignment('a'), startedAt: 110, completedAt: 150 }];
  input.completions = [
    { id: 'linked', userId: 'athlete', exerciseId: 'reset', dailyAssignmentId: 'a', completedAt: 150, helpfulnessRating: 4 },
    { id: 'unlinked', userId: 'athlete', exerciseId: 'reset', completedAt: 150, helpfulnessRating: 4 },
  ];
  const [row] = buildModuleInsights(input);
  assert.equal(row.completedSessions, 1);
  assert.equal(row.repeatUse.additionalSessions, 0);
  assert.equal(row.repeatUse.rate, 0);
  assert.equal(row.usefulness.respondentRecords, 1);
});
