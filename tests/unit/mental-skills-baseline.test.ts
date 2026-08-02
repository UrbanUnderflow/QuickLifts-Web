import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MENTAL_SKILL_FAMILIES,
  baselineSportPack,
  scoreMentalSkillsBaseline,
  type MentalSkillEvidence,
  type MentalSkillsCurrentState,
} from '../../src/api/firebase/mentaltraining/mentalSkillsBaseline';
import type { SportScenarioArchetype } from '../../src/api/firebase/mentaltraining/types';

const archetypes: SportScenarioArchetype[] = [
  'invasion',
  'net_racket',
  'race',
  'judged',
  'stage',
  'precision',
  'combat',
  'attempt',
  'general',
];

const familiarity = Object.fromEntries(
  MENTAL_SKILL_FAMILIES.map((family) => [family, 'know_it']),
) as Parameters<typeof scoreMentalSkillsBaseline>[0]['familiarity'];

const state = (value: 1 | 5): MentalSkillsCurrentState => ({
  mood: value === 1 ? 'drained' : 'locked_in',
  rest: value,
  energy: value,
  confidence: value,
  motivation: value,
  sportConnection: value,
  selfBelief: value,
  improvementBelief: value,
});

const completeEvidence = (score: number): MentalSkillEvidence[] =>
  MENTAL_SKILL_FAMILIES.flatMap((family) =>
    (['recognize', 'understand', 'choose', 'rehearse'] as const).map((component) => ({
      challengeId: `${family}-${component}`,
      family,
      component,
      score,
      selectedOptionId: 'test',
    })),
  );

test('current mood and energy never change mental skill competency', () => {
  const shared = {
    source: 'test',
    sportName: "Men's physique",
    sportArchetype: 'stage' as const,
    familiarity,
    evidence: completeEvidence(80),
  };
  const lowState = scoreMentalSkillsBaseline({ ...shared, currentState: state(1) });
  const highState = scoreMentalSkillsBaseline({ ...shared, currentState: state(5) });

  assert.equal(lowState.overallCompetencyScore, highState.overallCompetencyScore);
  assert.deepEqual(lowState.familyScores, highState.familyScores);
});

test('family scoring is twenty percent familiarity and eighty percent challenge evidence', () => {
  const practiced = Object.fromEntries(
    MENTAL_SKILL_FAMILIES.map((family) => [family, 'practiced_it']),
  ) as Parameters<typeof scoreMentalSkillsBaseline>[0]['familiarity'];
  const result = scoreMentalSkillsBaseline({
    source: 'test',
    sportName: 'Tennis',
    sportArchetype: 'net_racket',
    currentState: state(5),
    familiarity: practiced,
    evidence: completeEvidence(100),
  });

  for (const score of Object.values(result.familyScores)) {
    assert.equal(score.score, 97);
  }
});

test('every supported sport archetype has a complete baseline challenge pack', () => {
  for (const archetype of archetypes) {
    const pack = baselineSportPack(archetype);
    assert.ok(pack.setting.trim(), `${archetype} needs a setting`);
    assert.ok(pack.setbackPrompt.trim(), `${archetype} needs a setback prompt`);
    assert.ok(pack.pressurePrompt.trim(), `${archetype} needs a pressure prompt`);
    assert.ok(pack.bodyPrompt.trim(), `${archetype} needs a body prompt`);
    assert.ok(pack.controllableCue.trim(), `${archetype} needs a controllable cue`);
    assert.equal(pack.mentalRehearsalSteps.length, 4, `${archetype} needs four rehearsal scenes`);
    assert.ok(pack.mentalRehearsalSteps.every((line) => line.trim()));
  }
});

test('stage sport baseline language never falls back to games or locker rooms', () => {
  const pack = baselineSportPack('stage');
  const copy = [
    pack.setting,
    pack.setbackPrompt,
    pack.pressurePrompt,
    pack.bodyPrompt,
    pack.controllableCue,
    pack.resultDistraction,
    pack.comparisonDistraction,
    pack.usefulPhrase,
    pack.reflectionPrompt,
    ...pack.mentalRehearsalSteps,
  ].join(' ').toLowerCase();

  assert.doesNotMatch(copy, /locker room/);
  assert.doesNotMatch(copy, /\bgame\b/);
  assert.doesNotMatch(copy, /\bplay\b/);
  assert.match(copy, /stage|show|callout/);
});
