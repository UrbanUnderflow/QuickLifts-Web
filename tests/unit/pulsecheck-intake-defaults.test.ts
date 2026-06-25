import test from 'node:test';
import assert from 'node:assert/strict';

import { getDefaultPulseCheckIntakeForm } from '../../src/api/firebase/pulsecheckProvisioning/types';

test('athlete intake starter splits life and training load questions', () => {
  const form = getDefaultPulseCheckIntakeForm('athlete');
  const byId = new Map(form.questions.map((question) => [question.id, question]));

  assert.equal(byId.get('athlete-load'), undefined);
  assert.deepEqual(
    {
      type: byId.get('athlete-life-load')?.type,
      question: byId.get('athlete-life-load')?.question,
      minValue: byId.get('athlete-life-load')?.minValue,
      maxValue: byId.get('athlete-life-load')?.maxValue,
    },
    {
      type: 'number',
      question: 'How heavy does life feel right now? (1 = light, 5 = very heavy)',
      minValue: 1,
      maxValue: 5,
    }
  );
  assert.deepEqual(
    {
      type: byId.get('athlete-training-load')?.type,
      question: byId.get('athlete-training-load')?.question,
      minValue: byId.get('athlete-training-load')?.minValue,
      maxValue: byId.get('athlete-training-load')?.maxValue,
    },
    {
      type: 'number',
      question: 'How heavy does training feel right now? (1 = light, 5 = very heavy)',
      minValue: 1,
      maxValue: 5,
    }
  );
});

test('coach intake starter includes role and season multiple choice questions with other write-ins', () => {
  const form = getDefaultPulseCheckIntakeForm('coach');
  const byId = new Map(form.questions.map((question) => [question.id, question]));

  const roleQuestion = byId.get('coach-role');
  assert.equal(roleQuestion?.type, 'multiple_choice');
  assert.deepEqual(
    roleQuestion?.options?.map((option) => option.text),
    [
      'Head coach',
      'Assistant coach',
      'Associate head coach',
      'Position coach',
      'Strength & conditioning',
      'Athletic trainer',
      'Sports medicine',
      'Performance staff',
      'Team administrator',
      'Mental performance coach',
      'Other',
    ]
  );
  assert.equal(byId.get('coach-role-other')?.type, 'text');

  const seasonQuestion = byId.get('coach-season-phase');
  assert.equal(seasonQuestion?.type, 'multiple_choice');
  assert.deepEqual(
    seasonQuestion?.options?.map((option) => option.text),
    [
      'Pre-season',
      'In-season',
      'Championship / playoffs',
      'Post-season',
      'Off-season',
      'Return to play / rehab block',
      'Other',
    ]
  );
  assert.equal(byId.get('coach-season-phase-other')?.type, 'text');
});

test('coach intake starter includes mental health, tracking, and meeting one prompts', () => {
  const questions = getDefaultPulseCheckIntakeForm('coach').questions;
  const questionText = questions.map((question) => question.question);

  assert.ok(questionText.includes('Tell us about your team.'));
  assert.ok(questionText.includes('What more do you want to know about your team?'));
  assert.ok(questionText.includes('What mental health or wellbeing concern feels most important for your athletes right now?'));
  assert.ok(questionText.includes('How do you currently track your athletes\' performance, readiness, and wellbeing?'));
  assert.ok(questionText.includes('Who is the main coach or point person?'));
  assert.ok(questionText.includes('Who else needs to be included? Any other support staff?'));
  assert.ok(questionText.includes('What team or group is piloting PulseCheck?'));
  assert.ok(questionText.includes('What specific challenges are you hoping PulseCheck helps solve?'));
  assert.ok(questionText.includes('What would success look like after the pilot?'));
  assert.ok(questionText.includes('When will athletes check in?'));
  assert.ok(questionText.includes('How often will coaches review data?'));
  assert.ok(questionText.includes('What normally happens when concerning patterns show up with your athletes or team?'));
  assert.ok(questionText.includes('What existing team routines can PulseCheck plug into?'));
  assert.ok(questionText.includes('What support staff should be looped in, and who should have access in PulseCheck?'));
});
