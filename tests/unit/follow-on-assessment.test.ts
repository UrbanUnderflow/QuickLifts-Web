import test from 'node:test';
import assert from 'node:assert/strict';
import { aggregateFollowOnAssessment, validateFollowOnAssessmentLink, followOnAssessmentLinkKey, APPROVED_FOLLOW_ON_ASSESSMENTS } from '../../src/api/firebase/dailyCurriculum/followOnAssessment';
const eligibility = { id: 'eligible', athleteId: 'a', assignmentId: 'assignment', moduleId: 'module', instrumentId: 'instrument', instrumentVersion: 'v1', eligibilityPolicyId: 'policy', eligibleAt: 100 };
const response = { responseId: 'response', eligibilityId: 'eligible', athleteId: 'a', assignmentId: 'assignment', moduleId: 'module', instrumentId: 'instrument', instrumentVersion: 'v1', completedAt: 150 };
test('no existing questionnaire is silently approved for module follow-on', () => {
  assert.equal(APPROVED_FOLLOW_ON_ASSESSMENTS.length, 0);
  const metric = aggregateFollowOnAssessment({ moduleId: 'module', window: { start: 100, end: 200 }, eligibility: [eligibility], responses: [response] });
  assert.equal(metric.status, 'unavailable'); assert.equal(metric.denominator, null); assert.equal(metric.rate, null);
});
test('link validator requires exact athlete, assignment, module, instrument version and eligibility', () => {
  assert.equal(validateFollowOnAssessmentLink({ authenticatedAthleteId: 'a', eligibility, response }), true);
  for (const field of ['athleteId', 'assignmentId', 'moduleId', 'instrumentId', 'instrumentVersion', 'eligibilityId']) {
    assert.equal(validateFollowOnAssessmentLink({ authenticatedAthleteId: 'a', eligibility, response: { ...response, [field]: 'different' } }), false);
  }
  assert.equal(validateFollowOnAssessmentLink({ authenticatedAthleteId: 'other', eligibility, response }), false);
});
test('pre-eligibility or invalid completion cannot establish follow-on completion', () => {
  for (const completedAt of [99, NaN, Infinity]) assert.equal(validateFollowOnAssessmentLink({ authenticatedAthleteId: 'a', eligibility, response: { ...response, completedAt } }), false);
});
test('retry keys are deterministic and unambiguous without date inference', () => {
  assert.equal(followOnAssessmentLinkKey('a', 'b'), followOnAssessmentLinkKey('a', 'b'));
  assert.notEqual(followOnAssessmentLinkKey('a:b', 'c'), followOnAssessmentLinkKey('a', 'b:c'));
  assert.throws(() => followOnAssessmentLinkKey('', 'b'));
});
