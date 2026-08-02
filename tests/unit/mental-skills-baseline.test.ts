import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BASELINE_BODY_AWARENESS_RESPONSE_PROFILES,
  BASELINE_BREATH_PRACTICE_RESPONSE_PROFILES,
  BASELINE_REFLECTION_RESPONSE_PROFILES,
  BASELINE_SETBACK_RESPONSE_PROFILES,
  MENTAL_SKILLS_BASELINE_VERSION,
  MENTAL_SKILL_FAMILIARITY_LEVELS,
  MENTAL_SKILL_FAMILIES,
  baselineAttentionResponseProfiles,
  baselineSelfTalkResponseProfiles,
  baselineSportPack,
  scoreSequenceOrder,
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
    assert.equal(score.score, 95);
  }
});

test('every supported sport archetype has a complete baseline challenge pack', () => {
  for (const archetype of archetypes) {
    const pack = baselineSportPack(archetype);
    assert.ok(pack.setting.trim(), `${archetype} needs a setting`);
    assert.ok(pack.setbackPrompt.trim(), `${archetype} needs a setback prompt`);
    assert.match(pack.setbackPrompt, /closest to what would go through your mind first/i);
    assert.ok(pack.pressurePrompt.trim(), `${archetype} needs a pressure prompt`);
    assert.ok(pack.bodyPrompt.trim(), `${archetype} needs a body prompt`);
    assert.ok(pack.controllableCue.trim(), `${archetype} needs a controllable cue`);
    assert.equal(pack.mentalRehearsalSteps.length, 4, `${archetype} needs four rehearsal scenes`);
    assert.ok(pack.mentalRehearsalSteps.every((line) => line.trim()));
    assert.match(pack.reflectionPrompt, /what would you most likely do first/i);
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

test('setback responses form a stable, nuanced competency scale', () => {
  assert.equal(MENTAL_SKILLS_BASELINE_VERSION, 5);
  assert.equal(BASELINE_SETBACK_RESPONSE_PROFILES.length, 6);
  assert.equal(
    new Set(BASELINE_SETBACK_RESPONSE_PROFILES.map((response) => response.id)).size,
    BASELINE_SETBACK_RESPONSE_PROFILES.length,
  );

  const beliefScores = BASELINE_SETBACK_RESPONSE_PROFILES.map((response) => response.beliefScore);
  assert.ok(new Set(beliefScores).size >= 5, 'responses should cover at least five belief levels');
  assert.ok(Math.min(...beliefScores) <= 20, 'scale needs a low competency anchor');
  assert.ok(Math.max(...beliefScores) >= 95, 'scale needs a high competency anchor');
  assert.ok(BASELINE_SETBACK_RESPONSE_PROFILES.every((response) => response.label.startsWith('I would')));
});

test('skill familiarity uses five distinct experience levels', () => {
  assert.equal(MENTAL_SKILL_FAMILIARITY_LEVELS.length, 5);
  assert.equal(new Set(MENTAL_SKILL_FAMILIARITY_LEVELS.map((level) => level.id)).size, 5);
  assert.equal(new Set(MENTAL_SKILL_FAMILIARITY_LEVELS.map((level) => level.score)).size, 5);
  assert.deepEqual(
    MENTAL_SKILL_FAMILIARITY_LEVELS.map((level) => level.score),
    [15, 35, 55, 75, 95],
  );
});

test('every behavior question uses a graduated response scale', () => {
  const staticScales = [
    {
      name: 'setback',
      responses: BASELINE_SETBACK_RESPONSE_PROFILES,
      scores: BASELINE_SETBACK_RESPONSE_PROFILES.map((response) => response.beliefScore),
    },
    {
      name: 'reflection',
      responses: BASELINE_REFLECTION_RESPONSE_PROFILES,
      scores: BASELINE_REFLECTION_RESPONSE_PROFILES.map((response) => response.reflectionScore),
    },
    {
      name: 'body awareness',
      responses: BASELINE_BODY_AWARENESS_RESPONSE_PROFILES,
      scores: BASELINE_BODY_AWARENESS_RESPONSE_PROFILES.map((response) => response.bodyAwarenessScore),
    },
    {
      name: 'breath practice',
      responses: BASELINE_BREATH_PRACTICE_RESPONSE_PROFILES,
      scores: BASELINE_BREATH_PRACTICE_RESPONSE_PROFILES.map((response) => response.breathingScore),
    },
  ];

  for (const scale of staticScales) {
    assert.ok(scale.responses.length >= 6, `${scale.name} needs at least six responses`);
    assert.equal(new Set(scale.responses.map((response) => response.id)).size, scale.responses.length);
    assert.ok(new Set(scale.scores).size >= 5, `${scale.name} needs at least five score levels`);
    assert.ok(Math.min(...scale.scores) <= 20, `${scale.name} needs a low anchor`);
    assert.ok(Math.max(...scale.scores) >= 90, `${scale.name} needs a high anchor`);
  }

  for (const archetype of archetypes) {
    const pack = baselineSportPack(archetype);
    const dynamicScales = [
      { name: `${archetype} attention`, responses: baselineAttentionResponseProfiles(pack) },
      { name: `${archetype} self-talk`, responses: baselineSelfTalkResponseProfiles(pack) },
    ];
    for (const scale of dynamicScales) {
      assert.ok(scale.responses.length >= 6, `${scale.name} needs at least six responses`);
      assert.equal(new Set(scale.responses.map((response) => response.id)).size, scale.responses.length);
      const scores = scale.responses.map((response) => (
        'score' in response ? response.score : response.selfTalkScore
      ));
      assert.ok(new Set(scores).size >= 5, `${scale.name} needs at least five score levels`);
      assert.ok(Math.min(...scores) <= 20, `${scale.name} needs a low anchor`);
      assert.ok(Math.max(...scores) >= 95, `${scale.name} needs a high anchor`);
    }
  }
});

test('sequence challenges award partial credit across a continuous scale', () => {
  const permutations = <T>(items: T[]): T[][] => (
    items.length <= 1
      ? [items]
      : items.flatMap((item, index) => permutations(items.filter((_, itemIndex) => itemIndex !== index))
        .map((rest) => [item, ...rest]))
  );
  const expected = ['signal', 'breath', 'thought', 'action'];
  const scores = permutations(expected).map((order) => scoreSequenceOrder(order, expected));

  assert.equal(scoreSequenceOrder(expected, expected), 100);
  assert.equal(scoreSequenceOrder([...expected].reverse(), expected), 30);
  assert.equal(new Set(scores).size, 7);
  assert.equal(scoreSequenceOrder(['signal', 'breath'], expected), 0);
});
