export const SIMULATION_ARTIFACT_FLOOR_MS = 150;
export const MIN_RESET_MATCHED_PAIRS = 6;
export const MIN_BRAKE_GO_TRIALS_FOR_SSRT = 150;
export const MIN_BRAKE_STOP_TRIALS_FOR_SSRT = 50;
export const MIN_SEQUENCE_VALID_TRIALS_PER_CONDITION = 8;
export const MIN_ENDURANCE_VALID_RESPONSES = 24;
export const MIN_ENDURANCE_VALID_RESPONSES_PER_BLOCK = 3;

type RandomSource = () => number;

function shuffled<T>(values: T[], random: RandomSource): T[] {
  const copy = [...values];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function average(values: number[]): number | null {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function standardDeviation(values: number[]): number | null {
  const mean = average(values);
  if (mean === null || values.length < 2) return null;
  const variance = values.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const ordered = [...values].sort((left, right) => left - right);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 === 0
    ? (ordered[middle - 1] + ordered[middle]) / 2
    : ordered[middle];
}

function rate(numerator: number, denominator: number): number | null {
  return denominator > 0 ? numerator / denominator : null;
}

function rounded(value: number | null, digits = 3): number | null {
  return value === null ? null : Number(value.toFixed(digits));
}

function regressionSlope(points: Array<{ x: number; y: number }>): number | null {
  if (points.length < 2) return null;
  const meanX = points.reduce((sum, point) => sum + point.x, 0) / points.length;
  const meanY = points.reduce((sum, point) => sum + point.y, 0) / points.length;
  const denominator = points.reduce((sum, point) => sum + ((point.x - meanX) ** 2), 0);
  if (denominator === 0) return null;
  return points.reduce((sum, point) => sum + ((point.x - meanX) * (point.y - meanY)), 0) / denominator;
}

export type ResetCondition = 'reference' | 'post_disruption';
export type ResetDirection = 'left' | 'right';

export interface ResetRoundContract {
  index: number;
  pairId: string;
  condition: ResetCondition;
  isPractice: boolean;
  direction: ResetDirection;
  responseWindowMs: number;
  preTargetDelayMs: number;
  interruptionDurationMs: number;
  resetIntervalMs: number | null;
}

export interface ResetMeasurementResponse {
  pairId: string;
  condition: ResetCondition;
  isPractice: boolean;
  correct: boolean;
  latencyMs: number | null;
  outcome: 'response' | 'timeout' | 'premature';
  resetIntervalMs?: number | null;
}

export interface ResetResponseContract extends ResetRoundContract {
  correct: boolean;
  latencyMs: number | null;
  outcome: 'response' | 'timeout' | 'premature';
}

export interface ResetMeasurement {
  matchedPairCount: number;
  postDisruptionReengagementCostMs: number | null;
  referenceAccuracy: number | null;
  postDisruptionAccuracy: number | null;
  postDisruptionAccuracyCost: number | null;
  firstPostDisruptionCorrectRate: number | null;
  prematureResponseRate: number | null;
  timeoutRate: number | null;
  meanResetIntervalMs: number | null;
}

export function buildResetRounds(
  scoredPairCount = 12,
  random: RandomSource = Math.random
): ResetRoundContract[] {
  const makeRound = (
    index: number,
    pairId: string,
    condition: ResetCondition,
    isPractice: boolean,
    direction: ResetDirection
  ): ResetRoundContract => ({
    index,
    pairId,
    condition,
    isPractice,
    direction,
    responseWindowMs: 1500,
    preTargetDelayMs: 1700,
    interruptionDurationMs: condition === 'post_disruption' ? 900 : 0,
    resetIntervalMs: condition === 'post_disruption' ? 800 : null,
  });

  const practice = [
    makeRound(0, 'practice-1', 'reference', true, 'left'),
    makeRound(1, 'practice-1', 'post_disruption', true, 'left'),
  ];
  const totalPairs = Math.max(6, Math.ceil(scoredPairCount / 2) * 2);
  const postFirstOffset = random() < 0.5 ? 0 : 1;
  const scored = Array.from({ length: totalPairs }, (_, pairIndex) => {
    const direction: ResetDirection = pairIndex % 2 === 0 ? 'left' : 'right';
    const postFirst = (pairIndex + postFirstOffset) % 2 === 0;
    const conditions: ResetCondition[] = postFirst
      ? ['post_disruption', 'reference']
      : ['reference', 'post_disruption'];
    return conditions.map((condition, conditionIndex) => makeRound(
      practice.length + (pairIndex * 2) + conditionIndex,
      `pair-${pairIndex + 1}`,
      condition,
      false,
      direction
    ));
  }).flat();

  return [...practice, ...scored];
}

export function calculateResetMeasurement(responses: ResetMeasurementResponse[]): ResetMeasurement {
  const scored = responses.filter((response) => !response.isPractice);
  const reference = scored.filter((response) => response.condition === 'reference');
  const postDisruption = scored.filter((response) => response.condition === 'post_disruption');
  const pairs = new Map<string, Partial<Record<ResetCondition, ResetMeasurementResponse>>>();

  scored.forEach((response) => {
    const pair = pairs.get(response.pairId) ?? {};
    pair[response.condition] = response;
    pairs.set(response.pairId, pair);
  });

  const matchedCosts = [...pairs.values()].flatMap((pair) => {
    const referenceResponse = pair.reference;
    const postResponse = pair.post_disruption;
    if (
      !referenceResponse?.correct
      || !postResponse?.correct
      || referenceResponse.latencyMs === null
      || postResponse.latencyMs === null
      || referenceResponse.latencyMs < SIMULATION_ARTIFACT_FLOOR_MS
      || postResponse.latencyMs < SIMULATION_ARTIFACT_FLOOR_MS
    ) {
      return [];
    }
    return [postResponse.latencyMs - referenceResponse.latencyMs];
  });

  const referenceAccuracy = rate(reference.filter((response) => response.correct).length, reference.length);
  const postDisruptionAccuracy = rate(postDisruption.filter((response) => response.correct).length, postDisruption.length);
  const resetIntervals = postDisruption.flatMap((response) => response.resetIntervalMs == null ? [] : [response.resetIntervalMs]);

  return {
    matchedPairCount: matchedCosts.length,
    postDisruptionReengagementCostMs: rounded(
      matchedCosts.length >= MIN_RESET_MATCHED_PAIRS ? median(matchedCosts) : null,
      0
    ),
    referenceAccuracy: rounded(referenceAccuracy),
    postDisruptionAccuracy: rounded(postDisruptionAccuracy),
    postDisruptionAccuracyCost: rounded(
      referenceAccuracy === null || postDisruptionAccuracy === null
        ? null
        : referenceAccuracy - postDisruptionAccuracy
    ),
    firstPostDisruptionCorrectRate: rounded(rate(postDisruption.filter((response) => response.correct).length, postDisruption.length)),
    prematureResponseRate: rounded(rate(scored.filter((response) => response.outcome === 'premature').length, scored.length)),
    timeoutRate: rounded(rate(scored.filter((response) => response.outcome === 'timeout').length, scored.length)),
    meanResetIntervalMs: rounded(average(resetIntervals), 0),
  };
}

export type BrakeDirection = 'left' | 'right';
export type BrakeTrialKind = 'go' | 'stop';

export interface BrakePointRoundContract {
  index: number;
  isPractice: boolean;
  direction: BrakeDirection;
  trialKind: BrakeTrialKind;
  responseWindowMs: number;
}

export interface BrakePointResponseContract extends BrakePointRoundContract {
  responseDirection: BrakeDirection | null;
  responseLatencyMs: number | null;
  stopSignalDelayMs: number | null;
  outcome: 'response' | 'withheld' | 'timeout' | 'premature';
}

export interface BrakePointMeasurement {
  estimateAvailable: boolean;
  estimateUnavailableReason: string | null;
  provisionalSsrtMs: number | null;
  goAccuracy: number | null;
  correctGoRtMs: number | null;
  goOmissionRate: number | null;
  stopSuccessRate: number | null;
  meanStopSignalDelayMs: number | null;
  goChoiceErrorRate: number | null;
  failedStopRtMs: number | null;
  raceModelCheckPassed: boolean;
  prematureResponseRate: number | null;
  validGoTrials: number;
  validStopTrials: number;
}

export function nextBrakePointStopSignalDelay(
  currentDelayMs: number,
  outcome: 'withheld' | 'responded' | 'invalid'
) {
  if (outcome === 'invalid') return currentDelayMs;
  const adjustment = outcome === 'withheld' ? 50 : -50;
  return Math.max(100, Math.min(700, currentDelayMs + adjustment));
}

export function buildBrakePointRounds(
  scoredTrialCount = 64,
  random: RandomSource = Math.random
): BrakePointRoundContract[] {
  const practice: BrakePointRoundContract[] = [
    { index: 0, isPractice: true, direction: 'left', trialKind: 'go', responseWindowMs: 1200 },
    { index: 1, isPractice: true, direction: 'right', trialKind: 'go', responseWindowMs: 1200 },
    { index: 2, isPractice: true, direction: 'left', trialKind: 'stop', responseWindowMs: 1200 },
    { index: 3, isPractice: true, direction: 'right', trialKind: 'stop', responseWindowMs: 1200 },
  ];
  const total = Math.max(16, Math.ceil(scoredTrialCount / 8) * 8);
  const templates = Array.from({ length: total / 8 }, () => [
    { direction: 'left' as const, trialKind: 'go' as const },
    { direction: 'left' as const, trialKind: 'go' as const },
    { direction: 'left' as const, trialKind: 'go' as const },
    { direction: 'right' as const, trialKind: 'go' as const },
    { direction: 'right' as const, trialKind: 'go' as const },
    { direction: 'right' as const, trialKind: 'go' as const },
    { direction: 'left' as const, trialKind: 'stop' as const },
    { direction: 'right' as const, trialKind: 'stop' as const },
  ]).flat();
  const scored = shuffled(templates, random).map((template, offset) => ({
    ...template,
    index: practice.length + offset,
    isPractice: false,
    responseWindowMs: 1200,
  }));
  return [...practice, ...scored];
}

export function calculateBrakePointMeasurement(
  responses: BrakePointResponseContract[]
): BrakePointMeasurement {
  const allScored = responses.filter((response) => !response.isPractice);
  const goTrials = allScored.filter((response) => response.trialKind === 'go' && response.outcome !== 'premature');
  const stopTrials = allScored.filter((response) => response.trialKind === 'stop');
  const correctGo = goTrials.filter((response) => (
    response.outcome === 'response'
    && response.responseDirection === response.direction
    && response.responseLatencyMs !== null
    && response.responseLatencyMs >= SIMULATION_ARTIFACT_FLOOR_MS
  ));
  const goChoiceErrors = goTrials.filter((response) => (
    response.outcome === 'response'
    && response.responseDirection !== null
    && response.responseDirection !== response.direction
    && response.responseLatencyMs !== null
    && response.responseLatencyMs >= SIMULATION_ARTIFACT_FLOOR_MS
  ));
  const goOmissions = goTrials.filter((response) => response.outcome === 'timeout' || response.responseDirection === null).length;
  const stopSuccesses = stopTrials.filter((response) => response.outcome === 'withheld' || response.outcome === 'timeout').length;
  const stopFailures = stopTrials.length - stopSuccesses;
  const failedStopResponses = stopTrials.filter((response) => (
    (response.outcome === 'response' || response.outcome === 'premature')
    && response.responseLatencyMs !== null
  ));
  const stopSuccessRate = rate(stopSuccesses, stopTrials.length);
  const probabilityRespondOnStop = rate(stopFailures, stopTrials.length);
  const goDistribution = goTrials
    .map((response) => response.responseLatencyMs ?? response.responseWindowMs)
    .sort((left, right) => left - right);
  const stopSignalDelays = stopTrials.flatMap((response) => response.stopSignalDelayMs == null ? [] : [response.stopSignalDelayMs]);
  const meanStopSignalDelay = average(stopSignalDelays);
  const goOmissionRate = rate(goOmissions, goTrials.length);
  const goAccuracy = rate(correctGo.length, goTrials.length);
  const correctGoRt = average(correctGo.map((response) => response.responseLatencyMs as number));
  const failedStopRt = average(failedStopResponses.map((response) => response.responseLatencyMs as number));
  const raceModelCheckPassed = correctGoRt !== null && failedStopRt !== null && failedStopRt < correctGoRt;

  let estimateUnavailableReason: string | null = null;
  if (goTrials.length < MIN_BRAKE_GO_TRIALS_FOR_SSRT || stopTrials.length < MIN_BRAKE_STOP_TRIALS_FOR_SSRT) {
    estimateUnavailableReason = 'A stop-time estimate requires at least 150 valid go trials and 50 stop trials.';
  } else if (stopSignalDelays.length !== stopTrials.length) {
    estimateUnavailableReason = 'Stop-signal delay was not recorded for every stop trial.';
  } else if (stopSuccessRate === null || stopSuccessRate < 0.25 || stopSuccessRate > 0.75) {
    estimateUnavailableReason = 'Stop success must remain between 25% and 75%.';
  } else if (goOmissionRate === null || goOmissionRate > 0.10) {
    estimateUnavailableReason = 'Too many go trials were omitted.';
  } else if (goAccuracy === null || goAccuracy < 0.80) {
    estimateUnavailableReason = 'Go-trial accuracy must be at least 80%.';
  } else if (!raceModelCheckPassed) {
    estimateUnavailableReason = 'Failed-stop responses were not faster than correct go responses.';
  }

  let provisionalSsrtMs: number | null = null;
  if (!estimateUnavailableReason && probabilityRespondOnStop !== null && meanStopSignalDelay !== null) {
    const percentileIndex = Math.min(
      goDistribution.length - 1,
      Math.max(0, Math.ceil(probabilityRespondOnStop * goDistribution.length) - 1)
    );
    provisionalSsrtMs = Math.max(0, goDistribution[percentileIndex] - meanStopSignalDelay);
  }

  return {
    estimateAvailable: estimateUnavailableReason === null,
    estimateUnavailableReason,
    provisionalSsrtMs: rounded(provisionalSsrtMs, 0),
    goAccuracy: rounded(goAccuracy),
    correctGoRtMs: rounded(correctGoRt, 0),
    goOmissionRate: rounded(goOmissionRate),
    stopSuccessRate: rounded(stopSuccessRate),
    meanStopSignalDelayMs: rounded(meanStopSignalDelay, 0),
    goChoiceErrorRate: rounded(rate(goChoiceErrors.length, goTrials.length)),
    failedStopRtMs: rounded(failedStopRt, 0),
    raceModelCheckPassed,
    prematureResponseRate: rounded(rate(allScored.filter((response) => response.outcome === 'premature').length, allScored.length)),
    validGoTrials: goTrials.length,
    validStopTrials: stopTrials.length,
  };
}

export type SignalDirection = 'left' | 'right';
export type SignalEvidenceCount = 5 | 6 | 7;

export interface SignalWindowRoundContract {
  index: number;
  isPractice: boolean;
  direction: SignalDirection;
  evidenceCount: SignalEvidenceCount;
  arrowDirections: SignalDirection[];
  exposureMs: number;
  responseWindowMs: number;
}

export interface SignalWindowResponseContract extends SignalWindowRoundContract {
  responseDirection: SignalDirection | null;
  correct: boolean;
  responseLatencyMs: number | null;
  outcome: 'response' | 'timeout' | 'premature';
}

export interface SignalWindowMeasurement {
  decisionAccuracy: number | null;
  correctDecisionRtMs: number | null;
  wrongChoiceRate: number | null;
  timeoutRate: number | null;
  prematureResponseRate: number | null;
  accuracyByEvidence: Record<SignalEvidenceCount, number | null>;
  correctRtByEvidenceMs: Record<SignalEvidenceCount, number | null>;
}

export const SIGNAL_WINDOW_TIMING = Object.freeze({
  protocolVersionMetric: 3.1,
  readyMs: 1000,
  practiceExposureMs: 2000,
  scoredExposureMs: 1400,
  practiceResponseWindowMs: 4000,
  scoredResponseWindowMs: 3000,
  practiceFeedbackMs: 1200,
  scoredFeedbackMs: 900,
});

function buildArrowField(direction: SignalDirection, evidenceCount: SignalEvidenceCount, random: RandomSource) {
  const opposite: SignalDirection = direction === 'left' ? 'right' : 'left';
  return shuffled([
    ...Array.from({ length: evidenceCount }, () => direction),
    ...Array.from({ length: 9 - evidenceCount }, () => opposite),
  ], random);
}

export function buildSignalWindowRounds(
  scoredTrialCount = 24,
  random: RandomSource = Math.random
): SignalWindowRoundContract[] {
  const practiceTemplates: Array<[SignalDirection, SignalEvidenceCount]> = [
    ['left', 7],
    ['right', 7],
    ['left', 6],
    ['right', 6],
  ];
  const practice = practiceTemplates.map(([direction, evidenceCount], index) => ({
    index,
    isPractice: true,
    direction,
    evidenceCount,
    arrowDirections: buildArrowField(direction, evidenceCount, random),
    exposureMs: SIGNAL_WINDOW_TIMING.practiceExposureMs,
    responseWindowMs: SIGNAL_WINDOW_TIMING.practiceResponseWindowMs,
  }));
  const total = Math.max(12, Math.ceil(scoredTrialCount / 6) * 6);
  const templates = Array.from({ length: total / 6 }, () => ([5, 6, 7] as SignalEvidenceCount[]).flatMap((evidenceCount) => [
    { direction: 'left' as const, evidenceCount },
    { direction: 'right' as const, evidenceCount },
  ])).flat();
  const scored = shuffled(templates, random).map((template, offset) => ({
    ...template,
    index: practice.length + offset,
    isPractice: false,
    arrowDirections: buildArrowField(template.direction, template.evidenceCount, random),
    exposureMs: SIGNAL_WINDOW_TIMING.scoredExposureMs,
    responseWindowMs: SIGNAL_WINDOW_TIMING.scoredResponseWindowMs,
  }));
  return [...practice, ...scored];
}

export function calculateSignalWindowMeasurement(
  responses: SignalWindowResponseContract[]
): SignalWindowMeasurement {
  const scored = responses.filter((response) => !response.isPractice);
  const validCorrect = scored.filter((response) => (
    response.correct
    && response.outcome === 'response'
    && response.responseLatencyMs !== null
    && response.responseLatencyMs >= SIMULATION_ARTIFACT_FLOOR_MS
  ));
  const accuracyByEvidence = {} as Record<SignalEvidenceCount, number | null>;
  const correctRtByEvidenceMs = {} as Record<SignalEvidenceCount, number | null>;
  ([5, 6, 7] as SignalEvidenceCount[]).forEach((evidenceCount) => {
    const condition = scored.filter((response) => response.evidenceCount === evidenceCount);
    const conditionCorrect = validCorrect.filter((response) => response.evidenceCount === evidenceCount);
    accuracyByEvidence[evidenceCount] = rounded(rate(condition.filter((response) => response.correct).length, condition.length));
    correctRtByEvidenceMs[evidenceCount] = rounded(
      conditionCorrect.length >= 2
        ? average(conditionCorrect.map((response) => response.responseLatencyMs as number))
        : null,
      0
    );
  });

  return {
    decisionAccuracy: rounded(rate(scored.filter((response) => response.correct).length, scored.length)),
    correctDecisionRtMs: rounded(
      validCorrect.length >= 6
        ? average(validCorrect.map((response) => response.responseLatencyMs as number))
        : null,
      0
    ),
    wrongChoiceRate: rounded(rate(scored.filter((response) => response.outcome === 'response' && !response.correct).length, scored.length)),
    timeoutRate: rounded(rate(scored.filter((response) => response.outcome === 'timeout').length, scored.length)),
    prematureResponseRate: rounded(rate(scored.filter((response) => response.outcome === 'premature').length, scored.length)),
    accuracyByEvidence,
    correctRtByEvidenceMs,
  };
}

export type SequenceRule = 'letter' | 'number';
export type SequenceSide = 'left' | 'right';

export interface SequenceShiftRoundContract {
  index: number;
  isPractice: boolean;
  rule: SequenceRule;
  previousRule: SequenceRule | null;
  trialType: 'practice' | 'repeat' | 'switch';
  letter: string;
  number: number;
  correctSide: SequenceSide;
  previousRuleSide: SequenceSide | null;
  congruent: boolean;
  cueStimulusIntervalMs: number;
  responseWindowMs: number;
}

export interface SequenceShiftResponseContract extends SequenceShiftRoundContract {
  responseSide: SequenceSide | null;
  correct: boolean;
  responseLatencyMs: number | null;
  outcome: 'response' | 'timeout' | 'premature';
}

export interface SequenceShiftMeasurement {
  switchRtCostMs: number | null;
  switchAccuracyCost: number | null;
  repeatAccuracy: number | null;
  switchAccuracy: number | null;
  perseverativeErrorRate: number | null;
  timeoutRate: number | null;
  prematureResponseRate: number | null;
  validRepeatRtCount: number;
  validSwitchRtCount: number;
}

const VOWELS = ['A', 'E', 'I', 'U'];
const CONSONANTS = ['G', 'K', 'M', 'R'];
const ODDS = [3, 5, 7, 9];
const EVENS = [2, 4, 6, 8];

function sideForLetter(letter: string): SequenceSide {
  return VOWELS.includes(letter) ? 'left' : 'right';
}

function sideForNumber(number: number): SequenceSide {
  return number % 2 === 1 ? 'left' : 'right';
}

function buildSequenceStimulus(
  index: number,
  rule: SequenceRule,
  congruent: boolean,
  correctSide: SequenceSide
) {
  const leftLetter = VOWELS[index % VOWELS.length];
  const rightLetter = CONSONANTS[index % CONSONANTS.length];
  const leftNumber = ODDS[index % ODDS.length];
  const rightNumber = EVENS[index % EVENS.length];
  const otherSide: SequenceSide = correctSide === 'left' ? 'right' : 'left';
  const letterSide: SequenceSide = rule === 'letter' ? correctSide : congruent ? correctSide : otherSide;
  const numberSide: SequenceSide = rule === 'number' ? correctSide : congruent ? correctSide : otherSide;
  return {
    letter: letterSide === 'left' ? leftLetter : rightLetter,
    number: numberSide === 'left' ? leftNumber : rightNumber,
  };
}

const BALANCED_SWITCH_PATTERNS: Array<Array<'repeat' | 'switch'>> = [
  ['repeat', 'switch', 'repeat', 'switch', 'switch', 'repeat', 'switch', 'repeat'],
  ['switch', 'repeat', 'switch', 'repeat', 'repeat', 'switch', 'repeat', 'switch'],
  ['repeat', 'switch', 'switch', 'repeat', 'switch', 'repeat', 'repeat', 'switch'],
  ['switch', 'repeat', 'repeat', 'switch', 'repeat', 'switch', 'switch', 'repeat'],
];

export function buildSequenceShiftRounds(
  scoredTrialCount = 48,
  random: RandomSource = Math.random
): SequenceShiftRoundContract[] {
  const practiceRules: SequenceRule[] = ['letter', 'letter', 'number', 'number', 'letter', 'number'];
  const practice = practiceRules.map((rule, index) => {
    const correctSide: SequenceSide = index % 2 === 0 ? 'left' : 'right';
    const stimulus = buildSequenceStimulus(index, rule, index % 2 === 0, correctSide);
    return {
      index,
      isPractice: true,
      rule,
      previousRule: index > 0 ? practiceRules[index - 1] : null,
      trialType: 'practice' as const,
      ...stimulus,
      correctSide,
      previousRuleSide: null,
      congruent: sideForLetter(stimulus.letter) === sideForNumber(stimulus.number),
      cueStimulusIntervalMs: 400,
      responseWindowMs: 1800,
    };
  });

  const total = Math.max(16, Math.ceil(scoredTrialCount / 8) * 8);
  let previousRule: SequenceRule = random() < 0.5 ? 'letter' : 'number';
  const scored: SequenceShiftRoundContract[] = [];
  Array.from({ length: total / 8 }, (_, blockIndex) => {
    const pattern = BALANCED_SWITCH_PATTERNS[Math.floor(random() * BALANCED_SWITCH_PATTERNS.length)];
    const groupOccurrences = new Map<string, number>();
    pattern.forEach((trialType, patternIndex) => {
      const rule: SequenceRule = trialType === 'switch'
        ? (previousRule === 'letter' ? 'number' : 'letter')
        : previousRule;
      const groupKey = `${trialType}-${rule}`;
      const occurrence = groupOccurrences.get(groupKey) ?? 0;
      groupOccurrences.set(groupKey, occurrence + 1);
      const congruent = occurrence % 2 === 0;
      const correctSide: SequenceSide = (occurrence + blockIndex) % 2 === 0 ? 'left' : 'right';
      const offset = scored.length;
      const stimulus = buildSequenceStimulus(offset + practice.length, rule, congruent, correctSide);
      const previousRuleSide = previousRule === 'letter' ? sideForLetter(stimulus.letter) : sideForNumber(stimulus.number);
      scored.push({
        index: practice.length + offset,
        isPractice: false,
        rule,
        previousRule,
        trialType,
        ...stimulus,
        correctSide,
        previousRuleSide,
        congruent,
        cueStimulusIntervalMs: 400,
        responseWindowMs: 1800,
      });
      previousRule = rule;
    });
  });
  return [...practice, ...scored];
}

export function calculateSequenceShiftMeasurement(
  responses: SequenceShiftResponseContract[]
): SequenceShiftMeasurement {
  const scored = responses.filter((response) => !response.isPractice);
  const repeat = scored.filter((response) => response.trialType === 'repeat');
  const switched = scored.filter((response) => response.trialType === 'switch');
  const validRt = (response: SequenceShiftResponseContract) => (
    response.correct
    && response.outcome === 'response'
    && response.responseLatencyMs !== null
    && response.responseLatencyMs >= SIMULATION_ARTIFACT_FLOOR_MS
  );
  const repeatRt = repeat.filter(validRt).map((response) => response.responseLatencyMs as number);
  const switchRt = switched.filter(validRt).map((response) => response.responseLatencyMs as number);
  const repeatAccuracy = rate(repeat.filter((response) => response.correct).length, repeat.length);
  const switchAccuracy = rate(switched.filter((response) => response.correct).length, switched.length);
  const eligiblePerseveration = switched.filter((response) => !response.congruent && response.previousRuleSide !== null);
  const perseverativeErrors = eligiblePerseveration.filter((response) => (
    !response.correct
    && response.outcome === 'response'
    && response.responseSide === response.previousRuleSide
  )).length;
  const repeatMean = average(repeatRt);
  const switchMean = average(switchRt);

  return {
    switchRtCostMs: rounded(
      repeatRt.length >= MIN_SEQUENCE_VALID_TRIALS_PER_CONDITION
        && switchRt.length >= MIN_SEQUENCE_VALID_TRIALS_PER_CONDITION
        && repeatMean !== null
        && switchMean !== null
        ? switchMean - repeatMean
        : null,
      0
    ),
    switchAccuracyCost: rounded(repeatAccuracy === null || switchAccuracy === null ? null : repeatAccuracy - switchAccuracy),
    repeatAccuracy: rounded(repeatAccuracy),
    switchAccuracy: rounded(switchAccuracy),
    perseverativeErrorRate: rounded(rate(perseverativeErrors, eligiblePerseveration.length)),
    timeoutRate: rounded(rate(scored.filter((response) => response.outcome === 'timeout').length, scored.length)),
    prematureResponseRate: rounded(rate(scored.filter((response) => response.outcome === 'premature').length, scored.length)),
    validRepeatRtCount: repeatRt.length,
    validSwitchRtCount: switchRt.length,
  };
}

export interface EnduranceLockRoundContract {
  index: number;
  isPractice: boolean;
  blockIndex: number;
  foreperiodMs: number;
  responseWindowMs: number;
}

export interface EnduranceLockResponseContract extends EnduranceLockRoundContract {
  onsetMs: number;
  responseLatencyMs: number | null;
  outcome: 'response' | 'timeout' | 'false_start';
}

export interface EnduranceLockMeasurement {
  estimateAvailable: boolean;
  correctRtSlopeMsPerMin: number | null;
  medianCorrectRtMs: number | null;
  rtVariabilityMs: number | null;
  lapseRate: number | null;
  falseStartRate: number | null;
  timeoutRate: number | null;
  validResponseCount: number;
  blockMedianRtMs: Array<number | null>;
  blockValidTrialCounts: number[];
}

export function buildEnduranceLockRounds(
  scoredTrialCount = 36,
  random: RandomSource = Math.random
): EnduranceLockRoundContract[] {
  const foreperiod = () => 1500 + Math.floor(random() * 2001);
  const practice = Array.from({ length: 4 }, (_, index) => ({
    index,
    isPractice: true,
    blockIndex: -1,
    foreperiodMs: foreperiod(),
    responseWindowMs: 1500,
  }));
  const total = Math.max(18, Math.ceil(scoredTrialCount / 6) * 6);
  const perBlock = total / 6;
  const scored = Array.from({ length: total }, (_, offset) => ({
    index: practice.length + offset,
    isPractice: false,
    blockIndex: Math.floor(offset / perBlock),
    foreperiodMs: foreperiod(),
    responseWindowMs: 1500,
  }));
  return [...practice, ...scored];
}

export function calculateEnduranceLockMeasurement(
  responses: EnduranceLockResponseContract[],
  lapseThresholdMs = 500
): EnduranceLockMeasurement {
  const scored = responses.filter((response) => !response.isPractice);
  const valid = scored.filter((response) => (
    response.outcome === 'response'
    && response.responseLatencyMs !== null
    && response.responseLatencyMs >= SIMULATION_ARTIFACT_FLOOR_MS
  ));
  const validLatencies = valid.map((response) => response.responseLatencyMs as number);
  const slope = regressionSlope(valid.map((response) => ({
    x: response.onsetMs / 60_000,
    y: response.responseLatencyMs as number,
  })));
  const blockMedianRtMs = Array.from({ length: 6 }, (_, blockIndex) => median(
    valid.filter((response) => response.blockIndex === blockIndex).map((response) => response.responseLatencyMs as number)
  )).map((value) => rounded(value, 0));
  const blockValidTrialCounts = Array.from({ length: 6 }, (_, blockIndex) => (
    valid.filter((response) => response.blockIndex === blockIndex).length
  ));

  const estimateAvailable = valid.length >= MIN_ENDURANCE_VALID_RESPONSES
    && blockValidTrialCounts.every((count) => count >= MIN_ENDURANCE_VALID_RESPONSES_PER_BLOCK);

  return {
    estimateAvailable,
    correctRtSlopeMsPerMin: rounded(estimateAvailable ? slope : null, 1),
    medianCorrectRtMs: rounded(median(validLatencies), 0),
    rtVariabilityMs: rounded(standardDeviation(validLatencies), 0),
    lapseRate: rounded(rate(valid.filter((response) => (response.responseLatencyMs as number) >= lapseThresholdMs).length, scored.length)),
    falseStartRate: rounded(rate(scored.filter((response) => response.outcome === 'false_start').length, scored.length)),
    timeoutRate: rounded(rate(scored.filter((response) => response.outcome === 'timeout').length, scored.length)),
    validResponseCount: valid.length,
    blockMedianRtMs,
    blockValidTrialCounts,
  };
}
