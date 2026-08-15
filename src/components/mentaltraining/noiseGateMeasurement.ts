export type NoiseChannel = 'baseline' | 'visual' | 'audio' | 'combined';

export interface NoiseRound {
  id: string;
  pairId: number | null;
  isPractice: boolean;
  targetLabel: string;
  options: string[];
  correctOption: string;
  channel: NoiseChannel;
  tags: string[];
  audioCue?: string;
  distractorOption?: string;
}

export interface NoiseResponse {
  roundId: string;
  pairId: number | null;
  isPractice: boolean;
  channel: NoiseChannel;
  correct: boolean;
  response: string;
  latencyMs: number;
  wrongTap: boolean;
  selectedHighlightedDistractor: boolean;
  hadHighlightedDistractor: boolean;
  timedOut: boolean;
}

export interface NoiseGateMeasurement {
  referenceAccuracy: number;
  distractionAccuracy: number;
  accuracyCost: number;
  correctResponseRtShiftMs: number | null;
  wrongTapRate: number;
  highlightedDistractorTapRate: number | null;
  timeoutRate: number;
  matchedCorrectPairCount: number;
  scoredReferenceRounds: number;
  scoredDistractionRounds: number;
  correctWithDistractions: number;
  activeChannel: Exclude<NoiseChannel, 'baseline'> | null;
}

const MARKER_NUMBERS = ['7', '12', '17', '21', '24', '27', '41', '71', '72'];
const AUDIO_CUES = ['Crowd Surge', 'Commentary Burst', 'Whistle Blast', 'Buzzer Shock'];
const PRACTICE_ROUND_COUNT = 2;
export const MIN_VALID_RESPONSE_LATENCY_MS = 150;

function targetForSeed(seed: number) {
  return MARKER_NUMBERS[Math.abs((seed * 3) + Math.floor(seed / 2)) % MARKER_NUMBERS.length];
}

function optionsForSeed(seed: number) {
  const shift = Math.abs((seed * 2) + 1) % MARKER_NUMBERS.length;
  return [...MARKER_NUMBERS.slice(shift), ...MARKER_NUMBERS.slice(0, shift)];
}

function distractorForSeed(seed: number, target: string, options: string[]) {
  const candidates = options.filter((option) => option !== target);
  return candidates[Math.abs((seed * 3) + 1) % candidates.length];
}

export function parseNoiseGateRoundCount(targetSessionStructure?: string, durationMinutes?: number) {
  const match = targetSessionStructure?.match(/(\d+)/);
  if (match) return Math.max(12, Number(match[1]));
  return Math.max(16, (durationMinutes ?? 5) * 10);
}

export function resolveNoiseChannel(archetype?: string): Exclude<NoiseChannel, 'baseline'> {
  if (archetype === 'audio_channel') return 'audio';
  if (archetype === 'combined_channel') return 'combined';
  return 'visual';
}

export function buildNoiseGateRounds(config: {
  targetSessionStructure?: string;
  durationMinutes?: number;
  archetype?: string;
}): NoiseRound[] {
  const requestedRoundCount = parseNoiseGateRoundCount(
    config.targetSessionStructure,
    config.durationMinutes,
  );
  const channel = resolveNoiseChannel(config.archetype);
  const requestedScoredCount = Math.max(10, requestedRoundCount - PRACTICE_ROUND_COUNT);
  const scoredCount = requestedScoredCount % 2 === 0
    ? requestedScoredCount
    : requestedScoredCount + 1;
  const pairCount = scoredCount / 2;

  const practiceRounds = Array.from({ length: PRACTICE_ROUND_COUNT }, (_, index) => {
    const seed = index;
    const targetLabel = targetForSeed(seed);
    return {
      id: `noise-practice-${index + 1}`,
      pairId: null,
      isPractice: true,
      targetLabel,
      options: optionsForSeed(seed),
      correctOption: targetLabel,
      channel: 'baseline' as const,
      tags: ['practice', 'unscored', 'reference_condition'],
    };
  });

  const makeScoredRound = (
    pairIndex: number,
    passIndex: number,
    roundChannel: NoiseChannel,
  ): NoiseRound => {
    const targetSeed = pairIndex + PRACTICE_ROUND_COUNT;
    const layoutSeed = targetSeed + (passIndex * 3);
    const targetLabel = targetForSeed(targetSeed);
    const options = optionsForSeed(layoutSeed);
    const usesVisualDistractor = roundChannel === 'visual' || roundChannel === 'combined';
    const pairId = pairIndex + 1;

    return {
      id: `noise-pair-${pairId}-${roundChannel}`,
      pairId,
      isPractice: false,
      targetLabel,
      options,
      correctOption: targetLabel,
      channel: roundChannel,
      tags: [
        `matched_pair_${pairId}`,
        roundChannel === 'baseline' ? 'reference_condition' : 'distraction_condition',
        roundChannel,
      ],
      audioCue: roundChannel === 'audio' || roundChannel === 'combined'
        ? AUDIO_CUES[(pairIndex + passIndex) % AUDIO_CUES.length]
        : undefined,
      distractorOption: usesVisualDistractor
        ? distractorForSeed(layoutSeed, targetLabel, options)
        : undefined,
    };
  };

  const firstPass = Array.from({ length: pairCount }, (_, pairIndex) => {
    const firstCondition: NoiseChannel = pairIndex % 2 === 0 ? 'baseline' : channel;
    return makeScoredRound(pairIndex, 0, firstCondition);
  });
  const secondPass = Array.from({ length: pairCount }, (_, pairIndex) => {
    const secondCondition: NoiseChannel = pairIndex % 2 === 0 ? channel : 'baseline';
    return makeScoredRound(pairIndex, 1, secondCondition);
  });

  return [...practiceRounds, ...firstPass, ...secondPass];
}

function proportion(numerator: number, denominator: number) {
  return denominator > 0 ? numerator / denominator : 0;
}

function rounded(value: number, places = 3) {
  const scale = 10 ** places;
  return Math.round(value * scale) / scale;
}

function median(values: number[]) {
  if (values.length === 0) return null;
  const ordered = [...values].sort((left, right) => left - right);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 === 0
    ? (ordered[middle - 1] + ordered[middle]) / 2
    : ordered[middle];
}

export function calculateNoiseGateMeasurement(
  responses: NoiseResponse[],
): NoiseGateMeasurement {
  const scored = responses.filter((response) => !response.isPractice);
  const reference = scored.filter((response) => response.channel === 'baseline');
  const distraction = scored.filter((response) => response.channel !== 'baseline');
  const visualDistractorTrials = distraction.filter((response) => response.hadHighlightedDistractor);
  const matchedCorrectRtShifts = [...Map.groupBy(
    scored.filter((response) => response.pairId !== null),
    (response) => response.pairId,
  ).values()].flatMap((pair) => {
    const referenceResponse = pair.find((response) => response.channel === 'baseline');
    const distractionResponse = pair.find((response) => response.channel !== 'baseline');
    if (
      !referenceResponse?.correct
      || !distractionResponse?.correct
      || referenceResponse.timedOut
      || distractionResponse.timedOut
      || referenceResponse.latencyMs < MIN_VALID_RESPONSE_LATENCY_MS
      || distractionResponse.latencyMs < MIN_VALID_RESPONSE_LATENCY_MS
    ) {
      return [];
    }
    return [distractionResponse.latencyMs - referenceResponse.latencyMs];
  });
  const activeChannel = distraction.find((response) => response.channel !== 'baseline')
    ?.channel as Exclude<NoiseChannel, 'baseline'> | undefined;
  const referenceAccuracy = proportion(reference.filter((response) => response.correct).length, reference.length);
  const distractionAccuracy = proportion(distraction.filter((response) => response.correct).length, distraction.length);

  return {
    referenceAccuracy: rounded(referenceAccuracy),
    distractionAccuracy: rounded(distractionAccuracy),
    accuracyCost: rounded(referenceAccuracy - distractionAccuracy),
    correctResponseRtShiftMs: matchedCorrectRtShifts.length >= 3
      ? Math.round(median(matchedCorrectRtShifts) as number)
      : null,
    wrongTapRate: rounded(proportion(
      distraction.filter((response) => response.wrongTap).length,
      distraction.length,
    )),
    highlightedDistractorTapRate: visualDistractorTrials.length === 0
      ? null
      : rounded(proportion(
        visualDistractorTrials.filter((response) => response.selectedHighlightedDistractor).length,
        visualDistractorTrials.length,
      )),
    timeoutRate: rounded(proportion(
      distraction.filter((response) => response.timedOut).length,
      distraction.length,
    )),
    matchedCorrectPairCount: matchedCorrectRtShifts.length,
    scoredReferenceRounds: reference.length,
    scoredDistractionRounds: distraction.length,
    correctWithDistractions: distraction.filter((response) => response.correct).length,
    activeChannel: activeChannel ?? null,
  };
}
