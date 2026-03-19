import {
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
} from 'firebase/firestore';
import { correlationEngineService } from './correlationEngineService';
import type {
  AthletePatternModel,
  AthletePatternModelRevision,
  CorrelationConfidenceTier,
  CorrelationConsumer,
  CorrelationEvidenceRecord,
  CorrelationPatternFamily,
  CorrelationRecommendationEligibility,
  CorrelationTargetDomain,
  CorrelationThresholdWindow,
} from './correlationEngineTypes';
import { sanitizeFirestoreValue } from './types';
import { TaxonomyPillar, TaxonomySkill } from './taxonomy';

const ENGINE_VERSION = 'correlation_engine_v0_1';
const DAY_MS = 24 * 60 * 60 * 1000;

type PatternSample = {
  evidenceId: string;
  athleteLocalDate: string;
  sessionTimestamp: number;
  inputValue: number;
  outcomeValue: number;
};

type PatternDefinition = {
  family: CorrelationPatternFamily;
  targetDomain: CorrelationTargetDomain;
  unit: string;
  summaryLabel: string;
  athleteLabel: string;
  coachLabel: string;
  extractInput: (record: CorrelationEvidenceRecord) => number | null;
  extractOutcome: (record: CorrelationEvidenceRecord) => number | null;
  matchesDomain?: (record: CorrelationEvidenceRecord) => boolean;
  deriveBestTrainingWindow?: boolean;
};

function numericValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function extractFromMap(
  value: Record<string, number | string | boolean | null> | undefined,
  keys: string[]
): number | null {
  if (!value) return null;
  for (const key of keys) {
    const exact = numericValue(value[key]);
    if (exact != null) return exact;
    const matchedKey = Object.keys(value).find((entry) => entry.toLowerCase() === key.toLowerCase());
    if (matchedKey) {
      const matched = numericValue(value[matchedKey]);
      if (matched != null) return matched;
    }
  }
  return null;
}

function hasDecisionDomain(record: CorrelationEvidenceRecord): boolean {
  const skill = record.simOutcome.skillDomain;
  const family = `${record.simOutcome.simFamily || ''} ${record.simOutcome.simVariant || ''}`.toLowerCase();
  return (
    skill === TaxonomySkill.ResponseInhibition ||
    skill === TaxonomySkill.CueDiscrimination ||
    skill === TaxonomySkill.WorkingMemoryUpdating ||
    family.includes('decision') ||
    family.includes('brake') ||
    family.includes('sequence')
  );
}

function hasFocusDomain(record: CorrelationEvidenceRecord): boolean {
  const skill = record.simOutcome.skillDomain;
  const family = `${record.simOutcome.simFamily || ''} ${record.simOutcome.simVariant || ''}`.toLowerCase();
  return (
    skill === TaxonomySkill.SustainedAttention ||
    skill === TaxonomySkill.SelectiveAttention ||
    skill === TaxonomySkill.AttentionalShifting ||
    family.includes('focus') ||
    family.includes('signal') ||
    family.includes('noise')
  );
}

function hasComposureDomain(record: CorrelationEvidenceRecord): boolean {
  const skill = record.simOutcome.skillDomain;
  const family = `${record.simOutcome.simFamily || ''} ${record.simOutcome.simVariant || ''}`.toLowerCase();
  const coreMetric = `${record.simOutcome.coreMetricName || ''}`.toLowerCase();
  return (
    skill === TaxonomySkill.ErrorRecoverySpeed ||
    skill === TaxonomySkill.EmotionalInterferenceControl ||
    skill === TaxonomySkill.PressureStability ||
    family.includes('reset') ||
    family.includes('composure') ||
    coreMetric.includes('recovery')
  );
}

function extractNormalizedScore(record: CorrelationEvidenceRecord): number | null {
  return extractFromMap(record.simOutcome.scores, ['normalizedScore']);
}

function extractConsistencyScore(record: CorrelationEvidenceRecord): number | null {
  return (
    extractFromMap(record.simOutcome.scores, ['consistencyIndex', 'consistency_index']) ??
    extractNormalizedScore(record)
  );
}

function extractSleepDurationMinutes(record: CorrelationEvidenceRecord): number | null {
  const minutes = extractFromMap(record.physiology.sleep, [
    'totalSleepMinutes',
    'total_sleep_minutes',
    'sleepDurationMinutes',
    'sleep_duration_minutes',
    'totalSleepDurationMinutes',
  ]);
  if (minutes != null) return minutes;
  const hours = extractFromMap(record.physiology.sleep, ['totalSleepHours', 'sleepHours']);
  return hours != null ? Math.round(hours * 60) : null;
}

function extractDeepSleepMinutes(record: CorrelationEvidenceRecord): number | null {
  return extractFromMap(record.physiology.sleep, [
    'deepSleepMinutes',
    'deep_sleep_minutes',
    'deepSleepDurationMinutes',
    'deepSleepDuration',
  ]);
}

function extractHrvMs(record: CorrelationEvidenceRecord): number | null {
  return extractFromMap(record.physiology.recovery, [
    'hrv',
    'hrvMs',
    'averageHrv',
    'avgHrv',
    'rmssd',
  ]);
}

function extractRecoveryPostureScore(record: CorrelationEvidenceRecord): number | null {
  const direct = extractFromMap(record.physiology.recovery, [
    'readinessScore',
    'normalizedReadinessScore',
    'focusReadiness',
  ]);
  if (direct != null) return direct;

  const overall = `${record.physiology.recovery?.overallReadiness || ''}`.toLowerCase();
  if (overall === 'green') return 85;
  if (overall === 'yellow') return 60;
  if (overall === 'red') return 35;
  return null;
}

function extractSleepTimingHour(record: CorrelationEvidenceRecord): number | null {
  return extractFromMap(record.physiology.sleep, [
    'bedtimeHour',
    'sleepStartHour',
    'sleepMidpointHour',
    'sleep_timing_hour',
  ]);
}

function extractResetSpeedOutcome(record: CorrelationEvidenceRecord): number | null {
  const metricName = `${record.simOutcome.coreMetricName || ''}`.toLowerCase();
  const coreMetric = extractFromMap(record.simOutcome.scores, ['coreMetricValue']);
  if (metricName.includes('recovery') || metricName.includes('reset') || metricName.includes('time')) {
    if (coreMetric != null && coreMetric > 0) {
      return Math.max(0, 100 - coreMetric);
    }
  }
  return extractNormalizedScore(record);
}

function extractSessionHour(timestamp: number): number {
  return new Date(timestamp).getUTCHours();
}

function quantifyWindowLabel(hour: number): string {
  if (hour < 6) return 'overnight';
  if (hour < 11) return 'morning';
  if (hour < 15) return 'midday';
  if (hour < 19) return 'afternoon';
  return 'evening';
}

const PATTERN_DEFINITIONS: PatternDefinition[] = [
  {
    family: 'sleep_duration_to_decision_quality',
    targetDomain: 'decision_quality',
    unit: 'minutes',
    summaryLabel: 'sleep duration',
    athleteLabel: 'sleep',
    coachLabel: 'sleep duration',
    extractInput: extractSleepDurationMinutes,
    extractOutcome: extractNormalizedScore,
    matchesDomain: (record) => hasDecisionDomain(record) || !record.simOutcome.skillDomain,
  },
  {
    family: 'sleep_duration_to_focus_stability',
    targetDomain: 'focus_stability',
    unit: 'minutes',
    summaryLabel: 'sleep duration',
    athleteLabel: 'sleep',
    coachLabel: 'sleep duration',
    extractInput: extractSleepDurationMinutes,
    extractOutcome: extractNormalizedScore,
    matchesDomain: (record) => hasFocusDomain(record) || !record.simOutcome.skillDomain,
  },
  {
    family: 'deep_sleep_to_reset_speed',
    targetDomain: 'reset_speed',
    unit: 'minutes',
    summaryLabel: 'deep sleep',
    athleteLabel: 'deep sleep',
    coachLabel: 'deep sleep',
    extractInput: extractDeepSleepMinutes,
    extractOutcome: extractResetSpeedOutcome,
    matchesDomain: hasComposureDomain,
  },
  {
    family: 'hrv_to_focus_stability',
    targetDomain: 'focus_stability',
    unit: 'ms',
    summaryLabel: 'HRV',
    athleteLabel: 'HRV',
    coachLabel: 'HRV',
    extractInput: extractHrvMs,
    extractOutcome: extractNormalizedScore,
    matchesDomain: (record) => hasFocusDomain(record) || !record.simOutcome.skillDomain,
  },
  {
    family: 'hrv_to_composure',
    targetDomain: TaxonomyPillar.Composure,
    unit: 'ms',
    summaryLabel: 'HRV',
    athleteLabel: 'HRV',
    coachLabel: 'HRV',
    extractInput: extractHrvMs,
    extractOutcome: extractNormalizedScore,
    matchesDomain: hasComposureDomain,
  },
  {
    family: 'recovery_posture_to_consistency',
    targetDomain: 'consistency',
    unit: 'score',
    summaryLabel: 'recovery posture',
    athleteLabel: 'recovery',
    coachLabel: 'recovery posture',
    extractInput: extractRecoveryPostureScore,
    extractOutcome: extractConsistencyScore,
  },
  {
    family: 'sleep_timing_to_best_performance_window',
    targetDomain: 'best_training_window',
    unit: 'hour',
    summaryLabel: 'sleep timing',
    athleteLabel: 'sleep timing',
    coachLabel: 'sleep timing',
    extractInput: extractSleepTimingHour,
    extractOutcome: extractNormalizedScore,
    deriveBestTrainingWindow: true,
  },
];

function average(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function standardDeviation(values: number[]): number {
  if (values.length <= 1) return 0;
  const mean = average(values);
  const variance = average(values.map((value) => (value - mean) ** 2));
  return Math.sqrt(variance);
}

function percentile(sorted: number[], ratio: number): number | null {
  if (!sorted.length) return null;
  const index = Math.max(0, Math.min(sorted.length - 1, Math.round((sorted.length - 1) * ratio)));
  return sorted[index] ?? null;
}

function computeCorrelation(samples: PatternSample[]): number {
  if (samples.length < 2) return 0;
  const x = samples.map((sample) => sample.inputValue);
  const y = samples.map((sample) => sample.outcomeValue);
  const xMean = average(x);
  const yMean = average(y);
  const numerator = samples.reduce((sum, sample) => sum + (sample.inputValue - xMean) * (sample.outcomeValue - yMean), 0);
  const xVariance = samples.reduce((sum, sample) => sum + (sample.inputValue - xMean) ** 2, 0);
  const yVariance = samples.reduce((sum, sample) => sum + (sample.outcomeValue - yMean) ** 2, 0);
  if (xVariance <= 0 || yVariance <= 0) return 0;
  return numerator / Math.sqrt(xVariance * yVariance);
}

function bucketize(samples: PatternSample[]): PatternSample[][] {
  if (!samples.length) return [];
  const sorted = [...samples].sort((left, right) => left.inputValue - right.inputValue);
  const size = Math.max(1, Math.ceil(sorted.length / 3));
  return [sorted.slice(0, size), sorted.slice(size, size * 2), sorted.slice(size * 2)].filter((bucket) => bucket.length);
}

function computeStateDiversityScore(samples: PatternSample[]): number {
  if (samples.length < 2) return samples.length ? 25 : 0;
  const values = samples.map((sample) => sample.inputValue);
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max) return 25;
  const bucketWidth = (max - min) / 4 || 1;
  const distinctBuckets = new Set(
    values.map((value) => Math.min(3, Math.max(0, Math.floor((value - min) / bucketWidth))))
  );
  return Math.round((distinctBuckets.size / 4) * 100);
}

function computeRecentContradictionRate(samples: PatternSample[], correlation: number): number {
  if (samples.length < 3) return 0;
  const expected = correlation >= 0 ? 1 : -1;
  if (Math.abs(correlation) < 0.1) return 0.5;
  const sorted = [...samples].sort((left, right) => left.inputValue - right.inputValue);
  let contradictions = 0;
  let comparisons = 0;
  for (let index = 1; index < sorted.length; index += 1) {
    const previous = sorted[index - 1];
    const current = sorted[index];
    const inputDelta = current.inputValue - previous.inputValue;
    const outcomeDelta = current.outcomeValue - previous.outcomeValue;
    if (Math.abs(inputDelta) < 0.001) continue;
    comparisons += 1;
    if (outcomeDelta * expected < 0) contradictions += 1;
  }
  if (!comparisons) return 0;
  return contradictions / comparisons;
}

function computeFreshnessTier(lastValidatedAt: number): AthletePatternModel['freshnessTier'] {
  const ageDays = (Date.now() - lastValidatedAt) / DAY_MS;
  if (ageDays <= 7) return 'fresh';
  if (ageDays <= 21) return 'aging';
  if (ageDays <= 45) return 'stale';
  return 'expired';
}

function computeConfidenceTier(params: {
  sampleSizeDays: number;
  sampleSizeSims: number;
  stateDiversityScore: number;
  contradictionRate: number;
  freshnessTier: AthletePatternModel['freshnessTier'];
}): CorrelationConfidenceTier {
  const { sampleSizeDays, sampleSizeSims, stateDiversityScore, contradictionRate, freshnessTier } = params;
  if (freshnessTier === 'expired' || contradictionRate >= 0.6) return 'degraded';
  if (sampleSizeDays >= 75 && sampleSizeSims >= 40 && stateDiversityScore >= 75 && contradictionRate <= 0.2) return 'high_confidence';
  if (sampleSizeDays >= 45 && sampleSizeSims >= 24 && stateDiversityScore >= 50 && contradictionRate <= 0.35) return 'stable';
  if (sampleSizeDays >= 21 && sampleSizeSims >= 12 && stateDiversityScore >= 30 && contradictionRate <= 0.5) return 'emerging';
  return 'directional';
}

function computeConfidenceScore(params: {
  sampleSizeDays: number;
  sampleSizeSims: number;
  stateDiversityScore: number;
  contradictionRate: number;
  freshnessTier: AthletePatternModel['freshnessTier'];
}): number {
  const freshnessScore =
    params.freshnessTier === 'fresh' ? 1 :
    params.freshnessTier === 'aging' ? 0.75 :
    params.freshnessTier === 'stale' ? 0.4 :
    0.15;
  const sampleScore = Math.min(1, (params.sampleSizeDays / 75) * 0.5 + (params.sampleSizeSims / 40) * 0.5);
  const diversityScore = Math.min(1, params.stateDiversityScore / 100);
  const contradictionScore = Math.max(0, 1 - params.contradictionRate);
  return Math.round(((sampleScore * 0.4) + (diversityScore * 0.25) + (contradictionScore * 0.2) + (freshnessScore * 0.15)) * 100) / 100;
}

function mapEligibility(tier: CorrelationConfidenceTier): CorrelationRecommendationEligibility {
  switch (tier) {
    case 'high_confidence':
      return 'coach_ready';
    case 'stable':
      return 'runtime_ready';
    case 'emerging':
      return 'athlete_safe';
    case 'directional':
      return 'monitor_only';
    default:
      return 'not_eligible';
  }
}

function mapSupportedConsumers(eligibility: CorrelationRecommendationEligibility): CorrelationConsumer[] {
  switch (eligibility) {
    case 'coach_ready':
      return ['profile', 'nora', 'coach', 'protocol_planner', 'ops', 'research'];
    case 'runtime_ready':
      return ['profile', 'nora', 'protocol_planner', 'research'];
    case 'athlete_safe':
      return ['profile', 'nora', 'research'];
    case 'monitor_only':
      return ['research'];
    default:
      return ['ops', 'research'];
  }
}

function deriveDirectionality(correlation: number, contradictionRate: number): AthletePatternModel['directionality'] {
  if (Math.abs(correlation) < 0.12) return 'mixed';
  if (contradictionRate >= 0.45) return 'contextual';
  return correlation > 0 ? 'positive' : 'negative';
}

function summarizeRelationship(definition: PatternDefinition, directionality: AthletePatternModel['directionality'], eligibility: CorrelationRecommendationEligibility): { observed: string; athlete: string; coach: string } {
  if (eligibility === 'not_eligible') {
    return {
      observed: `PulseCheck does not have enough linked ${definition.summaryLabel} evidence yet.`,
      athlete: `Nora is still learning how your ${definition.athleteLabel} relates to this part of your game.`,
      coach: `Insufficient linked ${definition.coachLabel} evidence to estimate an athlete-specific pattern yet.`,
    };
  }

  if (directionality === 'positive') {
    return {
      observed: `Higher ${definition.summaryLabel} is generally associated with stronger ${definition.targetDomain}.`,
      athlete: `When your ${definition.athleteLabel} is stronger, this part of your game usually looks sharper.`,
      coach: `Positive relationship observed: stronger ${definition.coachLabel} tends to coincide with stronger ${definition.targetDomain}.`,
    };
  }

  if (directionality === 'negative') {
    return {
      observed: `Higher ${definition.summaryLabel} is generally associated with weaker ${definition.targetDomain}.`,
      athlete: `When your ${definition.athleteLabel} drifts higher, this part of your game usually gets less stable.`,
      coach: `Negative relationship observed: elevated ${definition.coachLabel} tends to coincide with weaker ${definition.targetDomain}.`,
    };
  }

  return {
    observed: `${definition.summaryLabel} appears to matter, but the pattern is still mixed or context-dependent.`,
    athlete: `Your ${definition.athleteLabel} seems to matter here, but Nora needs more reps before calling it a stable pattern.`,
    coach: `Relationship is present but currently mixed or context-dependent; avoid treating it as a settled threshold yet.`,
  };
}

function buildSweetSpotRange(samples: PatternSample[], unit: string): CorrelationThresholdWindow | null {
  const buckets = bucketize(samples);
  if (!buckets.length) return null;
  const ranked = buckets
    .map((bucket) => ({ bucket, mean: average(bucket.map((sample) => sample.outcomeValue)) }))
    .sort((left, right) => right.mean - left.mean)[0];
  if (!ranked?.bucket.length) return null;
  return {
    min: Math.round(Math.min(...ranked.bucket.map((sample) => sample.inputValue))),
    max: Math.round(Math.max(...ranked.bucket.map((sample) => sample.inputValue))),
    unit,
    label: 'sweet_spot',
  };
}

function buildMinimumFloor(samples: PatternSample[], unit: string, directionality: AthletePatternModel['directionality']): CorrelationThresholdWindow | null {
  if (!samples.length || directionality === 'mixed' || directionality === 'contextual') return null;
  const sorted = [...samples].sort((left, right) => left.inputValue - right.inputValue).map((sample) => sample.inputValue);
  const p33 = percentile(sorted, 0.33);
  const p66 = percentile(sorted, 0.66);
  if (directionality === 'positive' && p33 != null) {
    return { min: Math.round(p33), unit, label: 'minimum_floor' };
  }
  if (directionality === 'negative' && p66 != null) {
    return { max: Math.round(p66), unit, label: 'protective_ceiling' };
  }
  return null;
}

function buildInstabilityBand(samples: PatternSample[], unit: string): CorrelationThresholdWindow | null {
  const buckets = bucketize(samples);
  if (buckets.length < 2) return null;
  const worst = buckets
    .map((bucket) => ({
      bucket,
      variance: standardDeviation(bucket.map((sample) => sample.outcomeValue)),
      mean: average(bucket.map((sample) => sample.outcomeValue)),
    }))
    .sort((left, right) => {
      if (right.variance !== left.variance) return right.variance - left.variance;
      return left.mean - right.mean;
    })[0];
  if (!worst?.bucket.length) return null;
  return {
    min: Math.round(Math.min(...worst.bucket.map((sample) => sample.inputValue))),
    max: Math.round(Math.max(...worst.bucket.map((sample) => sample.inputValue))),
    unit,
    label: 'instability_band',
  };
}

function buildBestTrainingWindow(samples: PatternSample[]): string | null {
  if (!samples.length) return null;
  const buckets = new Map<string, number[]>();
  samples.forEach((sample) => {
    const label = quantifyWindowLabel(extractSessionHour(sample.sessionTimestamp));
    const existing = buckets.get(label) || [];
    existing.push(sample.outcomeValue);
    buckets.set(label, existing);
  });
  const best = Array.from(buckets.entries())
    .map(([label, values]) => ({ label, mean: average(values), count: values.length }))
    .sort((left, right) => {
      if (right.mean !== left.mean) return right.mean - left.mean;
      return right.count - left.count;
    })[0];
  return best ? `${best.label} tends to be your cleanest window.` : null;
}

function domainFallback(samples: PatternSample[], allSamples: PatternSample[]): PatternSample[] {
  return samples.length ? samples : allSamples;
}

function materialPatternChange(existing: AthletePatternModel | null, next: AthletePatternModel): boolean {
  if (!existing) return true;
  const keys: Array<keyof AthletePatternModel> = [
    'confidenceTier',
    'recommendationEligibility',
    'observedRelationship',
    'directionality',
    'bestTrainingWindow',
    'athleteSummary',
    'coachSummary',
  ];

  for (const key of keys) {
    if (existing[key] !== next[key]) return true;
  }

  const thresholdFields: Array<keyof Pick<AthletePatternModel, 'sweetSpotRange' | 'minimumFloor' | 'instabilityBand'>> = [
    'sweetSpotRange',
    'minimumFloor',
    'instabilityBand',
  ];
  return thresholdFields.some((field) => JSON.stringify(existing[field] || null) !== JSON.stringify(next[field] || null));
}

async function loadEvidenceForAthlete(athleteId: string, limitCount = 300): Promise<CorrelationEvidenceRecord[]> {
  const snap = await getDocs(
    query(
      correlationEngineService.evidenceCollectionRef(athleteId),
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    )
  );
  return snap.docs
    .map((entry) => entry.data() as CorrelationEvidenceRecord)
    .sort((left, right) => left.createdAt - right.createdAt);
}

function buildSamples(definition: PatternDefinition, evidence: CorrelationEvidenceRecord[]): { allSamples: PatternSample[]; matchedSamples: PatternSample[] } {
  const allSamples: PatternSample[] = [];
  const matchedSamples: PatternSample[] = [];

  evidence.forEach((record) => {
    const inputValue = definition.extractInput(record);
    const outcomeValue = definition.extractOutcome(record);
    if (inputValue == null || outcomeValue == null) return;
    const sample: PatternSample = {
      evidenceId: record.evidenceId,
      athleteLocalDate: record.athleteLocalDate,
      sessionTimestamp: record.simOutcome.sessionTimestamp,
      inputValue,
      outcomeValue,
    };
    allSamples.push(sample);
    if (!definition.matchesDomain || definition.matchesDomain(record)) {
      matchedSamples.push(sample);
    }
  });

  return { allSamples, matchedSamples };
}

function buildPatternModel(
  athleteId: string,
  definition: PatternDefinition,
  evidence: CorrelationEvidenceRecord[],
  existing: AthletePatternModel | null
): AthletePatternModel {
  const now = Date.now();
  const { allSamples, matchedSamples } = buildSamples(definition, evidence);
  const workingSamples = domainFallback(matchedSamples, allSamples);
  const distinctDays = new Set(workingSamples.map((sample) => sample.athleteLocalDate));
  const lastValidatedAt = workingSamples.length
    ? Math.max(...workingSamples.map((sample) => sample.sessionTimestamp))
    : now;
  const freshnessTier = computeFreshnessTier(lastValidatedAt);
  const correlation = computeCorrelation(workingSamples);
  const contradictionRate = computeRecentContradictionRate(workingSamples, correlation);
  const stateDiversityScore = computeStateDiversityScore(workingSamples);
  const confidenceTier = computeConfidenceTier({
    sampleSizeDays: distinctDays.size,
    sampleSizeSims: workingSamples.length,
    stateDiversityScore,
    contradictionRate,
    freshnessTier,
  });
  const recommendationEligibility =
    workingSamples.length === 0
      ? 'not_eligible'
      : mapEligibility(confidenceTier);
  const directionality =
    workingSamples.length === 0
      ? 'mixed'
      : deriveDirectionality(correlation, contradictionRate);
  const summaries = summarizeRelationship(definition, directionality, recommendationEligibility);

  const riskFlags = [
    ...(stateDiversityScore < 35 ? ['low_state_diversity'] : []),
    ...(contradictionRate >= 0.45 ? ['recent_contradiction'] : []),
    ...(freshnessTier === 'stale' || freshnessTier === 'expired' ? ['stale_evidence'] : []),
    ...(matchedSamples.length === 0 && allSamples.length > 0 ? ['domain_fallback_used'] : []),
  ];

  return {
    patternKey: correlationEngineService.buildPatternKey({
      patternFamily: definition.family,
      targetDomain: String(definition.targetDomain),
    }),
    athleteId,
    patternFamily: definition.family,
    targetDomain: definition.targetDomain,
    createdAt: existing?.createdAt ?? now,
    lastValidatedAt,
    engineVersion: ENGINE_VERSION,
    sampleSizeDays: distinctDays.size,
    sampleSizeSims: workingSamples.length,
    stateDiversityScore,
    recentContradictionRate: Math.round(contradictionRate * 100) / 100,
    coverageWindowDays: distinctDays.size,
    observedRelationship: summaries.observed,
    directionality,
    sweetSpotRange: workingSamples.length ? buildSweetSpotRange(workingSamples, definition.unit) : null,
    minimumFloor: workingSamples.length ? buildMinimumFloor(workingSamples, definition.unit, directionality) : null,
    instabilityBand: workingSamples.length ? buildInstabilityBand(workingSamples, definition.unit) : null,
    bestTrainingWindow:
      definition.deriveBestTrainingWindow && workingSamples.length
        ? buildBestTrainingWindow(workingSamples)
        : null,
    confidenceTier,
    confidenceScore: computeConfidenceScore({
      sampleSizeDays: distinctDays.size,
      sampleSizeSims: workingSamples.length,
      stateDiversityScore,
      contradictionRate,
      freshnessTier,
    }),
    freshnessTier,
    recommendationEligibility,
    degradedReason:
      confidenceTier === 'degraded'
        ? freshnessTier === 'expired'
          ? 'evidence_expired'
          : 'contradiction_pressure'
        : null,
    affectedDomains: [definition.targetDomain],
    supportedConsumers: mapSupportedConsumers(recommendationEligibility),
    protocolLinks: [],
    riskFlags,
    athleteSummary: summaries.athlete,
    coachSummary: summaries.coach,
    explanationTemplateIds: [`pattern_${definition.family}`],
    lastProjectionAt: existing?.lastProjectionAt ?? null,
    revision: existing?.revision ?? 1,
    trace: correlationEngineService.buildTraceMetadata({
      operation: 'pattern_recompute',
      actorType: 'system',
      trigger: 'event_driven',
      sourceRevisionIds: evidence.map((record) => record.evidenceId).slice(-25),
    }),
    updatedAt: now,
  };
}

function deriveChangeReason(existing: AthletePatternModel, next: AthletePatternModel): AthletePatternModelRevision['changeReason'] {
  if (existing.confidenceTier !== next.confidenceTier) return 'confidence_change';
  return 'threshold_change';
}

export const correlationPatternService = {
  async getByPatternKey(athleteId: string, patternKey: string): Promise<AthletePatternModel | null> {
    const snap = await getDoc(correlationEngineService.patternRef(athleteId, patternKey));
    if (!snap.exists()) return null;
    return snap.data() as AthletePatternModel;
  },

  async listForAthlete(athleteId: string, limitCount = 24): Promise<AthletePatternModel[]> {
    const snap = await getDocs(
      query(
        correlationEngineService.patternCollectionRef(athleteId),
        orderBy('updatedAt', 'desc'),
        limit(limitCount)
      )
    );

    return snap.docs.map((entry) => entry.data() as AthletePatternModel);
  },

  async recomputePatternFamilyForAthlete(athleteId: string, family: CorrelationPatternFamily): Promise<AthletePatternModel> {
    const definition = PATTERN_DEFINITIONS.find((entry) => entry.family === family);
    if (!definition) {
      throw new Error(`Unsupported pattern family: ${family}`);
    }

    const evidence = await loadEvidenceForAthlete(athleteId);
    const patternKey = correlationEngineService.buildPatternKey({
      patternFamily: definition.family,
      targetDomain: String(definition.targetDomain),
    });
    const existing = await this.getByPatternKey(athleteId, patternKey);
    const next = buildPatternModel(athleteId, definition, evidence, existing);

    if (existing && materialPatternChange(existing, next)) {
      const revisionId = correlationEngineService.buildPatternRevisionId(existing.revision);
      const revision: AthletePatternModelRevision = {
        ...existing,
        revisionId,
        supersededAt: next.updatedAt,
        supersededByRevision: existing.revision + 1,
        archivedAt: next.updatedAt,
        changeReason: deriveChangeReason(existing, next),
        previousThresholds: {
          sweetSpotRange: existing.sweetSpotRange,
          minimumFloor: existing.minimumFloor,
          instabilityBand: existing.instabilityBand,
          bestTrainingWindow: existing.bestTrainingWindow,
        },
      };
      next.revision = existing.revision + 1;
      await setDoc(
        correlationEngineService.patternRevisionRef(athleteId, patternKey, revisionId),
        sanitizeFirestoreValue(revision)
      );
    } else if (existing) {
      next.revision = existing.revision;
    }

    await setDoc(
      correlationEngineService.patternRef(athleteId, patternKey),
      sanitizeFirestoreValue(next)
    );

    const rootRef = correlationEngineService.rootRef(athleteId);
    const rootSnap = await getDoc(rootRef);
    const rootData = rootSnap.exists()
      ? (rootSnap.data() as Record<string, unknown>)
      : correlationEngineService.buildRoot(athleteId, ENGINE_VERSION, next.updatedAt);
    const activePatternKeys = new Set<string>(
      Array.isArray(rootData.activePatternKeys) ? (rootData.activePatternKeys as string[]) : []
    );
    activePatternKeys.add(patternKey);

    await setDoc(
      rootRef,
      sanitizeFirestoreValue({
        ...rootData,
        athleteId,
        engineVersion: ENGINE_VERSION,
        activePatternKeys: Array.from(activePatternKeys),
        lastPatternRefreshAt: next.updatedAt,
        lastEngineRefreshAt: next.updatedAt,
        updatedAt: next.updatedAt,
      }),
      { merge: true }
    );

    return next;
  },

  async recomputeCorePatternsForAthlete(athleteId: string): Promise<AthletePatternModel[]> {
    const results: AthletePatternModel[] = [];
    for (const definition of PATTERN_DEFINITIONS) {
      results.push(await this.recomputePatternFamilyForAthlete(athleteId, definition.family));
    }
    return results;
  },
};
