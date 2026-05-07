import assert from 'node:assert/strict';
import test from 'node:test';
import {
  defaultNoraVoiceRubricFallback,
  enforceNoraVoiceRubric,
  validateNoraVoiceRubric,
} from '../../src/api/firebase/noraVoiceRubric';

test('Nora voice rubric flags the screenshot recovery copy failures', () => {
  const issues = validateNoraVoiceRubric(
    "7.5 hours of sleep, HRV 88, RHR 52. Recovery's workable — keep the rep clean.",
  );

  assert.ok(issues.some((issue) => issue.field === 'noraVoiceRubric.noMysteryPronouns'));
  assert.ok(issues.some((issue) => issue.field === 'noraVoiceRubric.concreteAction'));
});

test('Nora voice rubric rejects technical sports-intel filler', () => {
  const issues = validateNoraVoiceRubric(
    'This is a normal-start read, not a push signal. Keep the first block at baseline and skip optional accessories.',
  );

  assert.ok(issues.some((issue) => issue.field === 'noraVoiceRubric.plainAthleteLanguage'));
});

test('Nora voice rubric rejects physical programming prescriptions in sports intel', () => {
  const issues = validateNoraVoiceRubric(
    'Use less weight, do fewer hard reps, and add extra cardio if the warmup feels good.',
  );

  assert.ok(issues.some((issue) => issue.field === 'noraVoiceRubric.plainAthleteLanguage'));
});

test('Nora voice rubric rewrites generic feeling questions into a specific trade', () => {
  const repaired = enforceNoraVoiceRubric('How you feeling?', {
    fallback: defaultNoraVoiceRubricFallback('How you feeling?'),
  });

  assert.equal(
    repaired,
    "How are you feeling right now so I can set the pace for today's session?",
  );
  assert.deepEqual(validateNoraVoiceRubric(repaired), []);
});

test('Nora voice rubric accepts session-specific check-in questions', () => {
  const text = 'How are you feeling right now so I can set the pace for lateral reset intervals?';

  assert.deepEqual(validateNoraVoiceRubric(text), []);
});

test('Nora voice rubric flags repetitive headspace reads across adjacent turns', () => {
  const previous = "That's great to hear. Sounds like you're in a solid headspace. How do you want to channel that positive energy into training today?";
  const current = "It sounds like you're in a great headspace. Keep channeling that energy into your training and preparation.";

  const issues = validateNoraVoiceRubric(current, { previousAssistantMessages: [previous] });

  assert.ok(issues.some((issue) => issue.field === 'noraVoiceRubric.noRepetitiveDialogue'));
});

test('Nora voice rubric requires assignment rationale before start CTA', () => {
  const issues = validateNoraVoiceRubric("Let's start Visual Disruption Reset right here.");

  assert.ok(issues.some((issue) => issue.field === 'noraVoiceRubric.decisionRationale'));
});

test('Nora voice rubric accepts assignment copy that explains why', () => {
  const text = "Because you told me competition prep is close and today is about posing, I'm choosing Visual Disruption Reset as the next step.";

  assert.deepEqual(validateNoraVoiceRubric(text), []);
});
