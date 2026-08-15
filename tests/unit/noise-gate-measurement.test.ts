import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildNoiseGateRounds,
  calculateNoiseGateMeasurement,
  type NoiseResponse,
  type NoiseRound,
} from '../../src/components/mentaltraining/noiseGateMeasurement';

const responseFor = (
  round: NoiseRound,
  overrides: Partial<NoiseResponse> = {},
): NoiseResponse => ({
  roundId: round.id,
  pairId: round.pairId,
  isPractice: round.isPractice,
  channel: round.channel,
  correct: true,
  response: round.correctOption,
  latencyMs: 500,
  wrongTap: false,
  selectedHighlightedDistractor: false,
  hadHighlightedDistractor: Boolean(round.distractorOption),
  timedOut: false,
  ...overrides,
});

test('builds two practice rounds followed by balanced matched conditions', () => {
  const rounds = buildNoiseGateRounds({
    targetSessionStructure: '12 rounds',
    archetype: 'visual_channel',
  });
  const practice = rounds.filter((round) => round.isPractice);
  const scored = rounds.filter((round) => !round.isPractice);

  assert.equal(rounds.length, 12);
  assert.equal(practice.length, 2);
  assert.ok(practice.every((round) => round.channel === 'baseline'));
  assert.equal(scored.filter((round) => round.channel === 'baseline').length, 5);
  assert.equal(scored.filter((round) => round.channel === 'visual').length, 5);

  const pairs = Map.groupBy(scored, (round) => round.pairId);
  for (const [pairId, pair] of pairs) {
    assert.notEqual(pairId, null);
    assert.equal(pair.length, 2);
    assert.deepEqual(new Set(pair.map((round) => round.channel)), new Set(['baseline', 'visual']));
    assert.equal(pair[0].targetLabel, pair[1].targetLabel);
    assert.notDeepEqual(pair[0].options, pair[1].options);
  }
});

test('uses only correct matched pairs for the response-time comparison', () => {
  const rounds = buildNoiseGateRounds({
    targetSessionStructure: '12 rounds',
    archetype: 'visual_channel',
  });
  const practice = rounds.find((round) => round.isPractice)!;
  const scored = rounds.filter((round) => !round.isPractice);
  const pair = (pairId: number) => scored.filter((round) => round.pairId === pairId);
  const baseline = (pairId: number) => pair(pairId).find((round) => round.channel === 'baseline')!;
  const distraction = (pairId: number) => pair(pairId).find((round) => round.channel === 'visual')!;
  const responses = [
    responseFor(practice, { latencyMs: 10_000 }),
    responseFor(baseline(1), { latencyMs: 400 }),
    responseFor(distraction(1), { latencyMs: 700 }),
    responseFor(baseline(2), { latencyMs: 600 }),
    responseFor(distraction(2), { latencyMs: 800 }),
    responseFor(baseline(3), { latencyMs: 500 }),
    responseFor(distraction(3), { latencyMs: 600 }),
    responseFor(baseline(4), { latencyMs: 500 }),
    responseFor(distraction(4), {
      correct: false,
      response: '12',
      latencyMs: 2_000,
      wrongTap: true,
    }),
    responseFor(baseline(5), { latencyMs: 500 }),
    responseFor(distraction(5), {
      correct: false,
      response: 'Timed Out',
      latencyMs: 2_800,
      timedOut: true,
    }),
  ];

  const result = calculateNoiseGateMeasurement(responses);

  assert.equal(result.correctResponseRtShiftMs, 200);
  assert.equal(result.matchedCorrectPairCount, 3);
  assert.equal(result.scoredReferenceRounds, 5);
  assert.equal(result.scoredDistractionRounds, 5);
  assert.equal(result.wrongTapRate, 0.2);
  assert.equal(result.timeoutRate, 0.2);
});

test('distinguishes every wrong tap from taps on the highlighted distractor', () => {
  const rounds = buildNoiseGateRounds({
    targetSessionStructure: '12 rounds',
    archetype: 'visual_channel',
  });
  const distraction = rounds.filter((round) => !round.isPractice && round.channel === 'visual');
  const responses = distraction.slice(0, 3).map((round, index) => responseFor(round, index === 0
    ? {
      correct: false,
      response: round.distractorOption!,
      wrongTap: true,
      selectedHighlightedDistractor: true,
    }
    : index === 1
      ? {
        correct: false,
        response: round.options.find((option) => option !== round.correctOption && option !== round.distractorOption)!,
        wrongTap: true,
      }
      : {}));

  const result = calculateNoiseGateMeasurement(responses);

  assert.equal(result.wrongTapRate, 0.667);
  assert.equal(result.highlightedDistractorTapRate, 0.333);
});

test('does not invent a highlighted-distractor rate for audio-only trials', () => {
  const rounds = buildNoiseGateRounds({
    targetSessionStructure: '12 rounds',
    archetype: 'audio_channel',
  });
  const responses = rounds.map((round) => responseFor(round));

  const result = calculateNoiseGateMeasurement(responses);

  assert.equal(result.activeChannel, 'audio');
  assert.equal(result.highlightedDistractorTapRate, null);
});
