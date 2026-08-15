import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildBrakePointRounds,
  buildEnduranceLockRounds,
  buildResetRounds,
  buildSequenceShiftRounds,
  buildSignalWindowRounds,
  calculateBrakePointMeasurement,
  calculateEnduranceLockMeasurement,
  calculateResetMeasurement,
  calculateSequenceShiftMeasurement,
  calculateSignalWindowMeasurement,
  nextBrakePointStopSignalDelay,
  type BrakePointResponseContract,
  type EnduranceLockResponseContract,
  type SequenceShiftResponseContract,
  type SignalWindowResponseContract,
} from '../../src/components/mentaltraining/simulationFamilyMeasurement';
import { resolveEnduranceLockRuntimeProfile } from '../../src/api/firebase/mentaltraining/enduranceLockProfiles';

const fixedRandom = () => 0.42;

test('Reset builds balanced matched reference and post-interruption trials', () => {
  const rounds = buildResetRounds(12, fixedRandom);
  const scored = rounds.filter((round) => !round.isPractice);

  assert.equal(rounds.filter((round) => round.isPractice).length, 2);
  assert.equal(scored.length, 24);
  assert.equal(scored.filter((round) => round.condition === 'reference').length, 12);
  assert.equal(scored.filter((round) => round.condition === 'post_disruption').length, 12);
  assert.equal(scored.filter((round) => round.direction === 'left').length, 12);
  assert.equal(scored.filter((round) => round.direction === 'right').length, 12);
  assert.equal(new Set(scored.map((round) => round.pairId)).size, 12);
  assert.deepEqual(new Set(scored.map((round) => round.preTargetDelayMs)), new Set([1700]));
  assert.ok(scored.filter((round) => round.condition === 'post_disruption').every((round) => round.resetIntervalMs === 800));
});

test('Reset withholds re-engagement cost until enough correct matched pairs are available', () => {
  const result = calculateResetMeasurement([
    { pairId: 'practice', condition: 'reference', isPractice: true, correct: true, latencyMs: 9000, outcome: 'response' },
    { pairId: 'a', condition: 'reference', isPractice: false, correct: true, latencyMs: 400, outcome: 'response' },
    { pairId: 'a', condition: 'post_disruption', isPractice: false, correct: true, latencyMs: 600, outcome: 'response', resetIntervalMs: 800 },
    { pairId: 'b', condition: 'reference', isPractice: false, correct: true, latencyMs: 500, outcome: 'response' },
    { pairId: 'b', condition: 'post_disruption', isPractice: false, correct: false, latencyMs: 1500, outcome: 'response', resetIntervalMs: 1000 },
    { pairId: 'c', condition: 'reference', isPractice: false, correct: true, latencyMs: 450, outcome: 'response' },
    { pairId: 'c', condition: 'post_disruption', isPractice: false, correct: false, latencyMs: null, outcome: 'timeout' },
  ]);

  assert.equal(result.matchedPairCount, 1);
  assert.equal(result.postDisruptionReengagementCostMs, null);
  assert.equal(result.referenceAccuracy, 1);
  assert.equal(result.postDisruptionAccuracy, 0.333);
  assert.equal(result.timeoutRate, 0.167);
  assert.equal(result.meanResetIntervalMs, 900);
});

test('Reset uses the median matched-pair difference rather than an outlier-sensitive mean', () => {
  const result = calculateResetMeasurement([
    { pairId: 'a', condition: 'reference', isPractice: false, correct: true, latencyMs: 400, outcome: 'response' },
    { pairId: 'a', condition: 'post_disruption', isPractice: false, correct: true, latencyMs: 500, outcome: 'response', resetIntervalMs: 800 },
    { pairId: 'b', condition: 'reference', isPractice: false, correct: true, latencyMs: 400, outcome: 'response' },
    { pairId: 'b', condition: 'post_disruption', isPractice: false, correct: true, latencyMs: 600, outcome: 'response', resetIntervalMs: 800 },
    { pairId: 'c', condition: 'reference', isPractice: false, correct: true, latencyMs: 400, outcome: 'response' },
    { pairId: 'c', condition: 'post_disruption', isPractice: false, correct: true, latencyMs: 1400, outcome: 'response', resetIntervalMs: 800 },
    { pairId: 'd', condition: 'reference', isPractice: false, correct: true, latencyMs: 400, outcome: 'response' },
    { pairId: 'd', condition: 'post_disruption', isPractice: false, correct: true, latencyMs: 550, outcome: 'response', resetIntervalMs: 800 },
    { pairId: 'e', condition: 'reference', isPractice: false, correct: true, latencyMs: 400, outcome: 'response' },
    { pairId: 'e', condition: 'post_disruption', isPractice: false, correct: true, latencyMs: 600, outcome: 'response', resetIntervalMs: 800 },
    { pairId: 'f', condition: 'reference', isPractice: false, correct: true, latencyMs: 400, outcome: 'response' },
    { pairId: 'f', condition: 'post_disruption', isPractice: false, correct: true, latencyMs: 650, outcome: 'response', resetIntervalMs: 800 },
  ]);

  assert.equal(result.postDisruptionReengagementCostMs, 200);
});

test('Brake Point schedule reserves one quarter of scored trials for stop signals', () => {
  const rounds = buildBrakePointRounds(64, fixedRandom);
  const scored = rounds.filter((round) => !round.isPractice);

  assert.equal(rounds.filter((round) => round.isPractice).length, 4);
  assert.equal(scored.length, 64);
  assert.equal(scored.filter((round) => round.trialKind === 'stop').length, 16);
  assert.equal(scored.filter((round) => round.trialKind === 'go').length, 48);
  assert.equal(scored.filter((round) => round.direction === 'left').length, 32);
  assert.equal(scored.filter((round) => round.direction === 'right').length, 32);
});

test('Brake Point staircase moves only after valid stop outcomes and stays in range', () => {
  assert.equal(nextBrakePointStopSignalDelay(250, 'withheld'), 300);
  assert.equal(nextBrakePointStopSignalDelay(250, 'responded'), 200);
  assert.equal(nextBrakePointStopSignalDelay(250, 'invalid'), 250);
  assert.equal(nextBrakePointStopSignalDelay(700, 'withheld'), 700);
  assert.equal(nextBrakePointStopSignalDelay(100, 'responded'), 100);
});

test('Brake Point computes a provisional SSRT only when quality requirements pass', () => {
  const rounds = buildBrakePointRounds(200, fixedRandom);
  let stopIndex = 0;
  const responses: BrakePointResponseContract[] = rounds.map((round) => {
    if (round.isPractice) {
      return { ...round, responseDirection: round.direction, responseLatencyMs: 500, stopSignalDelayMs: round.trialKind === 'stop' ? 250 : null, outcome: 'response' };
    }
    if (round.trialKind === 'go') {
      return { ...round, responseDirection: round.direction, responseLatencyMs: 500, stopSignalDelayMs: null, outcome: 'response' };
    }
    const withheld = stopIndex++ % 2 === 0;
    return {
      ...round,
      responseDirection: withheld ? null : round.direction,
      responseLatencyMs: withheld ? null : 400,
      stopSignalDelayMs: 250,
      outcome: withheld ? 'withheld' : 'response',
    };
  });

  const result = calculateBrakePointMeasurement(responses);

  assert.equal(result.estimateAvailable, true);
  assert.equal(result.provisionalSsrtMs, 250);
  assert.equal(result.stopSuccessRate, 0.5);
  assert.equal(result.goAccuracy, 1);
  assert.equal(result.raceModelCheckPassed, true);
});

test('Brake Point withholds an SSRT estimate for a standard short training rep', () => {
  const rounds = buildBrakePointRounds(64, fixedRandom);
  const responses: BrakePointResponseContract[] = rounds.map((round) => ({
    ...round,
    responseDirection: round.trialKind === 'go' ? round.direction : null,
    responseLatencyMs: round.trialKind === 'go' ? 500 : null,
    stopSignalDelayMs: round.trialKind === 'stop' ? 250 : null,
    outcome: round.trialKind === 'go' ? 'response' : 'withheld',
  }));

  const result = calculateBrakePointMeasurement(responses);

  assert.equal(result.estimateAvailable, false);
  assert.equal(result.provisionalSsrtMs, null);
});

test('Signal Window balances direction and evidence without revealing a fixed answer position', () => {
  const rounds = buildSignalWindowRounds(24, fixedRandom);
  const scored = rounds.filter((round) => !round.isPractice);

  assert.equal(rounds.filter((round) => round.isPractice).length, 4);
  assert.equal(scored.filter((round) => round.direction === 'left').length, 12);
  assert.equal(scored.filter((round) => round.direction === 'right').length, 12);
  for (const evidenceCount of [5, 6, 7] as const) {
    assert.equal(scored.filter((round) => round.evidenceCount === evidenceCount).length, 8);
  }
  assert.ok(scored.every((round) => round.arrowDirections.filter((direction) => direction === round.direction).length === round.evidenceCount));
});

test('Signal Window keeps error and timeout trials out of correct-response RT', () => {
  const rounds = buildSignalWindowRounds(12, fixedRandom).filter((round) => !round.isPractice);
  const responses: SignalWindowResponseContract[] = rounds.map((round, index) => ({
    ...round,
    responseDirection: index === 1 ? (round.direction === 'left' ? 'right' : 'left') : index === 2 ? null : round.direction,
    correct: index !== 1 && index !== 2,
    responseLatencyMs: index === 0 ? 400 : index === 1 ? 1400 : index === 2 ? null : 600,
    outcome: index === 2 ? 'timeout' : 'response',
  }));

  const result = calculateSignalWindowMeasurement(responses);

  assert.equal(result.correctDecisionRtMs, 580);
  assert.equal(result.wrongChoiceRate, 0.083);
  assert.equal(result.timeoutRate, 0.083);
});

test('Sequence Shift builds balanced switch and repeat trials with a stable response window', () => {
  const rounds = buildSequenceShiftRounds(48, fixedRandom);
  const scored = rounds.filter((round) => !round.isPractice);

  assert.equal(rounds.filter((round) => round.isPractice).length, 6);
  assert.equal(scored.filter((round) => round.trialType === 'switch').length, 24);
  assert.equal(scored.filter((round) => round.trialType === 'repeat').length, 24);
  assert.equal(scored.filter((round) => round.trialType === 'switch' && round.congruent).length, 12);
  assert.equal(scored.filter((round) => round.trialType === 'switch' && !round.congruent).length, 12);
  assert.equal(scored.filter((round) => round.trialType === 'repeat' && round.congruent).length, 12);
  assert.equal(scored.filter((round) => round.trialType === 'repeat' && !round.congruent).length, 12);
  assert.equal(scored.filter((round) => round.correctSide === 'left').length, 24);
  assert.equal(scored.filter((round) => round.correctSide === 'right').length, 24);
  assert.equal(scored.filter((round) => round.rule === 'letter').length, 24);
  assert.equal(scored.filter((round) => round.rule === 'number').length, 24);
  assert.deepEqual(new Set(scored.map((round) => round.cueStimulusIntervalMs)), new Set([400]));
  assert.deepEqual(new Set(scored.map((round) => round.responseWindowMs)), new Set([1800]));
});

test('Sequence Shift calculates switch cost from correct trials only', () => {
  const rounds = buildSequenceShiftRounds(48, fixedRandom).filter((round) => !round.isPractice);
  const responses: SequenceShiftResponseContract[] = rounds.map((round, index) => {
    const wrong = index === 0;
    return {
      ...round,
      responseSide: wrong ? (round.correctSide === 'left' ? 'right' : 'left') : round.correctSide,
      correct: !wrong,
      responseLatencyMs: wrong ? 5000 : round.trialType === 'switch' ? 700 : 500,
      outcome: 'response',
    };
  });

  const result = calculateSequenceShiftMeasurement(responses);

  assert.equal(result.switchRtCostMs, 200);
  assert.equal(result.validSwitchRtCount + result.validRepeatRtCount, 47);
});

test('Endurance Lock keeps the scored task constant across six blocks', () => {
  const rounds = buildEnduranceLockRounds(36, fixedRandom);
  const scored = rounds.filter((round) => !round.isPractice);

  assert.equal(rounds.filter((round) => round.isPractice).length, 4);
  assert.deepEqual(new Set(scored.map((round) => round.responseWindowMs)), new Set([1500]));
  assert.deepEqual(scored.map((round) => round.blockIndex).reduce<Record<number, number>>((counts, block) => ({
    ...counts,
    [block]: (counts[block] ?? 0) + 1,
  }), {}), { 0: 6, 1: 6, 2: 6, 3: 6, 4: 6, 5: 6 });
});

test('Endurance Lock fits response-time change only with coverage across all blocks', () => {
  const rounds = buildEnduranceLockRounds(36, fixedRandom).filter((round) => !round.isPractice);
  const responses: EnduranceLockResponseContract[] = rounds.map((round, index) => ({
    ...round,
    onsetMs: index * 10_000,
    responseLatencyMs: index === 35 ? null : 300 + (index * 10),
    outcome: index === 35 ? 'timeout' : 'response',
  }));

  const result = calculateEnduranceLockMeasurement(responses, 450);

  assert.equal(result.estimateAvailable, true);
  assert.equal(result.correctRtSlopeMsPerMin, 60);
  assert.equal(result.timeoutRate, 0.028);
  assert.equal(result.lapseRate, 0.556);
  assert.equal(result.validResponseCount, 35);
});

test('Endurance Lock withholds a trend when any block lacks minimum coverage', () => {
  const rounds = buildEnduranceLockRounds(36, fixedRandom).filter((round) => !round.isPractice);
  const responses: EnduranceLockResponseContract[] = rounds.map((round, index) => ({
    ...round,
    onsetMs: index * 10_000,
    responseLatencyMs: round.blockIndex === 5 && index % 3 !== 0 ? null : 400,
    outcome: round.blockIndex === 5 && index % 3 !== 0 ? 'timeout' : 'response',
  }));

  const result = calculateEnduranceLockMeasurement(responses);

  assert.equal(result.blockValidTrialCounts[5], 2);
  assert.equal(result.estimateAvailable, false);
  assert.equal(result.correctRtSlopeMsPerMin, null);
});

test('legacy Endurance variant names cannot reintroduce changing scored blocks', () => {
  for (const variantName of ['Late-Pressure Endurance Lock', 'Clutter-Fatigue Endurance Lock', 'Endurance Lock']) {
    const profile = resolveEnduranceLockRuntimeProfile({ variantName });
    assert.equal(profile.profileId, 'constant_visual_v2');
    assert.equal(profile.blockPlans.length, 6);
    assert.deepEqual(new Set(profile.blockPlans.map((block) => block.windowMs)), new Set([1500]));
    assert.deepEqual(new Set(profile.blockPlans.map((block) => block.cadenceMs)), new Set([2500]));
    assert.deepEqual(new Set(profile.blockPlans.map((block) => block.contrastProfile)), new Set(['normal_contrast']));
    assert.deepEqual(new Set(profile.blockPlans.map((block) => block.scoreWeight)), new Set([1]));
    assert.ok(profile.blockPlans.every((block) => block.pressureTag === 'neutral'));
  }
});
