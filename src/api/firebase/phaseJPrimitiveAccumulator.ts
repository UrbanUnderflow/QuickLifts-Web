// =============================================================================
// Phase J Primitive Accumulator
//
// Pure helpers for turning normalized device/source signals into the frozen
// primitive snapshot carried by Phase J session candidates and session records.
// This file intentionally has no Firebase/runtime dependency.
// =============================================================================

import type {
  PhaseJPrimitiveSnapshot,
  PhaseJSourceCoverage,
} from './phaseJSessionContracts';

export interface PhaseJHeartRateSample {
  observedAt: number;
  bpm: number;
  /** Optional explicit sample span. If absent, the accumulator infers spans from neighboring samples. */
  durationSec?: number;
}

export interface PhaseJHeartRateInput {
  samples?: PhaseJHeartRateSample[];
  avgBpm?: number;
  peakBpm?: number;
  hrZoneMinutes?: Record<string, number>;
  rrSampleCount?: number;
  hrvRmssdMs?: number;
  sampleIntervalSec?: number;
}

export interface PhaseJHrZoneDefinition {
  id: string;
  minBpm?: number;
  maxBpm?: number;
}

export interface PhaseJMovementSample {
  observedAt: number;
  /** Source-normalized 0..1 activity intensity when available. */
  activityScore?: number;
  /** Source-normalized acceleration magnitude when available. */
  accelerationMagnitude?: number;
  isActive?: boolean;
  durationSec?: number;
}

export interface PhaseJRestGapInput {
  startAt: number;
  endAt: number;
}

export interface PhaseJMovementInput {
  samples?: PhaseJMovementSample[];
  movementDensity?: number;
  accelerationBurstCount?: number;
  restGaps?: PhaseJRestGapInput[];
  restGapCount?: number;
  longestRestGapSec?: number;
  stepCount?: number;
  distanceMeters?: number;
  /** Defaults to 0.8 for accelerationMagnitude or activityScore burst detection. */
  accelerationBurstThreshold?: number;
  /** Defaults to 45 seconds when deriving rest gaps from movement samples. */
  minRestGapSec?: number;
}

export interface PhaseJEnergyInput {
  activeEnergyKcal?: number;
}

export interface PhaseJPrimitiveAccumulatorInput {
  detectedStartAt: number;
  detectedEndAt: number;
  timezone: string;
  heartRate?: PhaseJHeartRateInput;
  movement?: PhaseJMovementInput;
  energy?: PhaseJEnergyInput;
  sourceCoverage?: PhaseJSourceCoverage[];
  /** Optional top-level override; otherwise derived from sourceCoverage coveragePct values. */
  deviceCoveragePct?: number;
  missingData?: string[];
  hrZones?: PhaseJHrZoneDefinition[];
}

export const PHASE_J_DEFAULT_HR_ZONES: PhaseJHrZoneDefinition[] = [
  { id: 'rest', maxBpm: 99 },
  { id: 'zone1', minBpm: 100, maxBpm: 119 },
  { id: 'zone2', minBpm: 120, maxBpm: 139 },
  { id: 'zone3', minBpm: 140, maxBpm: 159 },
  { id: 'zone4', minBpm: 160, maxBpm: 179 },
  { id: 'zone5', minBpm: 180 },
];

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const roundTo = (value: number, decimals = 2): number => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const positiveNumber = (value: unknown): number | undefined =>
  isFiniteNumber(value) && value >= 0 ? value : undefined;

const normalizeCoveragePct = (value: unknown): number | undefined => {
  if (!isFiniteNumber(value)) return undefined;
  return roundTo(clamp(value, 0, 100), 1);
};

const unique = (values: string[]): string[] => Array.from(new Set(values.filter(Boolean)));

const sanitizeSourceCoverage = (coverage: PhaseJSourceCoverage[] = []): PhaseJSourceCoverage[] =>
  coverage
    .filter((entry) => entry.sourceFamily && entry.sourceType)
    .map((entry) => ({
      ...entry,
      coveragePct: normalizeCoveragePct(entry.coveragePct),
      sampleCount: positiveNumber(entry.sampleCount),
      firstObservedAt: positiveNumber(entry.firstObservedAt),
      lastObservedAt: positiveNumber(entry.lastObservedAt),
    }));

const deriveDeviceCoveragePct = (
  explicitCoveragePct: number | undefined,
  sourceCoverage: PhaseJSourceCoverage[],
): number | undefined => {
  const explicit = normalizeCoveragePct(explicitCoveragePct);
  if (explicit !== undefined) return explicit;

  const coverageValues = sourceCoverage
    .map((entry) => normalizeCoveragePct(entry.coveragePct))
    .filter((value): value is number => value !== undefined);

  if (coverageValues.length === 0) return undefined;
  return roundTo(
    coverageValues.reduce((sum, value) => sum + value, 0) / coverageValues.length,
    1,
  );
};

const sampleDurationAt = <T extends { observedAt: number; durationSec?: number }>(
  samples: T[],
  index: number,
  windowEnd: number,
  fallbackIntervalSec = 0,
): number => {
  const sample = samples[index];
  const explicit = positiveNumber(sample.durationSec);
  if (explicit !== undefined) return explicit;
  const next = samples[index + 1];
  if (next && next.observedAt > sample.observedAt) {
    return next.observedAt - sample.observedAt;
  }
  return Math.max(0, Math.min(fallbackIntervalSec, windowEnd - sample.observedAt));
};

const normalizeHeartRateSamples = (
  samples: PhaseJHeartRateSample[] | undefined,
  windowStart: number,
  windowEnd: number,
): PhaseJHeartRateSample[] =>
  (samples || [])
    .filter((sample) => isFiniteNumber(sample.observedAt) && isFiniteNumber(sample.bpm))
    .filter((sample) => sample.observedAt >= windowStart && sample.observedAt <= windowEnd)
    .sort((a, b) => a.observedAt - b.observedAt);

const zoneIdForBpm = (bpm: number, zones: PhaseJHrZoneDefinition[]): string | undefined =>
  zones.find((zone) => {
    const aboveMin = zone.minBpm === undefined || bpm >= zone.minBpm;
    const belowMax = zone.maxBpm === undefined || bpm <= zone.maxBpm;
    return aboveMin && belowMax;
  })?.id;

const deriveHrStats = (
  heartRate: PhaseJHeartRateInput | undefined,
  windowStart: number,
  windowEnd: number,
  zones: PhaseJHrZoneDefinition[],
): Pick<PhaseJPrimitiveSnapshot, 'avgHrBpm' | 'peakHrBpm' | 'hrZoneMinutes'> => {
  const samples = normalizeHeartRateSamples(heartRate?.samples, windowStart, windowEnd);
  const explicitAvg = positiveNumber(heartRate?.avgBpm);
  const explicitPeak = positiveNumber(heartRate?.peakBpm);

  let computedAvg: number | undefined;
  let computedPeak: number | undefined;
  let computedZoneMinutes: Record<string, number> | undefined;

  if (samples.length > 0) {
    let weightedBpm = 0;
    let totalDurationSec = 0;
    computedPeak = samples.reduce((max, sample) => Math.max(max, sample.bpm), 0);

    const zoneSeconds: Record<string, number> = {};
    samples.forEach((sample, index) => {
      const durationSec = sampleDurationAt(
        samples,
        index,
        windowEnd,
        heartRate?.sampleIntervalSec || 0,
      );
      const durationForAverage = durationSec > 0 ? durationSec : 1;
      weightedBpm += sample.bpm * durationForAverage;
      totalDurationSec += durationForAverage;

      const zoneId = zoneIdForBpm(sample.bpm, zones);
      if (zoneId && durationSec > 0) {
        zoneSeconds[zoneId] = (zoneSeconds[zoneId] || 0) + durationSec;
      }
    });

    if (totalDurationSec > 0) {
      computedAvg = Math.round(weightedBpm / totalDurationSec);
    }

    const zoneEntries = Object.entries(zoneSeconds)
      .map(([zoneId, seconds]) => [zoneId, roundTo(seconds / 60, 2)] as const)
      .filter(([, minutes]) => minutes > 0);
    if (zoneEntries.length > 0) {
      computedZoneMinutes = Object.fromEntries(zoneEntries);
    }
  }

  return {
    avgHrBpm: explicitAvg !== undefined ? Math.round(explicitAvg) : computedAvg,
    peakHrBpm: explicitPeak !== undefined ? Math.round(explicitPeak) : computedPeak,
    hrZoneMinutes: heartRate?.hrZoneMinutes || computedZoneMinutes,
  };
};

const normalizeMovementSamples = (
  samples: PhaseJMovementSample[] | undefined,
  windowStart: number,
  windowEnd: number,
): PhaseJMovementSample[] =>
  (samples || [])
    .filter((sample) => isFiniteNumber(sample.observedAt))
    .filter((sample) => sample.observedAt >= windowStart && sample.observedAt <= windowEnd)
    .sort((a, b) => a.observedAt - b.observedAt);

const isActiveMovementSample = (sample: PhaseJMovementSample): boolean => {
  if (typeof sample.isActive === 'boolean') return sample.isActive;
  if (isFiniteNumber(sample.activityScore)) return sample.activityScore > 0.15;
  if (isFiniteNumber(sample.accelerationMagnitude)) return sample.accelerationMagnitude > 0.05;
  return false;
};

const deriveMovementStats = (
  movement: PhaseJMovementInput | undefined,
  windowStart: number,
  windowEnd: number,
): Pick<
  PhaseJPrimitiveSnapshot,
  'movementDensity' | 'accelerationBurstCount' | 'restGapCount' | 'longestRestGapSec' | 'stepCount' | 'distanceMeters'
> => {
  const samples = normalizeMovementSamples(movement?.samples, windowStart, windowEnd);
  const durationSec = Math.max(0, windowEnd - windowStart);
  const burstThreshold = movement?.accelerationBurstThreshold ?? 0.8;
  const minRestGapSec = movement?.minRestGapSec ?? 45;

  let computedDensity: number | undefined;
  let computedBursts: number | undefined;
  let computedRestGapCount: number | undefined;
  let computedLongestRestGapSec: number | undefined;

  if (samples.length > 0) {
    let activeSec = 0;
    let burstCount = 0;
    const activeObservedAt: number[] = [];

    samples.forEach((sample, index) => {
      const sampleDurationSec = sampleDurationAt(samples, index, windowEnd);
      if (isActiveMovementSample(sample)) {
        activeObservedAt.push(sample.observedAt);
        activeSec += sampleDurationSec > 0 ? sampleDurationSec : 1;
      }

      const burstValue = isFiniteNumber(sample.accelerationMagnitude)
        ? sample.accelerationMagnitude
        : sample.activityScore;
      if (isFiniteNumber(burstValue) && burstValue >= burstThreshold) {
        burstCount += 1;
      }
    });

    computedBursts = burstCount;
    computedDensity = durationSec > 0 ? roundTo(clamp(activeSec / durationSec, 0, 1), 3) : undefined;

    let longestRest = 0;
    let restGapCount = 0;
    for (let i = 1; i < activeObservedAt.length; i += 1) {
      const gapSec = activeObservedAt[i] - activeObservedAt[i - 1];
      if (gapSec >= minRestGapSec) {
        restGapCount += 1;
        longestRest = Math.max(longestRest, gapSec);
      }
    }
    computedRestGapCount = restGapCount;
    computedLongestRestGapSec = longestRest > 0 ? Math.round(longestRest) : undefined;
  }

  const restGaps = (movement?.restGaps || [])
    .map((gap) => Math.max(0, gap.endAt - gap.startAt))
    .filter((gapSec) => gapSec > 0);

  return {
    movementDensity: positiveNumber(movement?.movementDensity) !== undefined
      ? roundTo(clamp(movement?.movementDensity as number, 0, 1), 3)
      : computedDensity,
    accelerationBurstCount: positiveNumber(movement?.accelerationBurstCount) !== undefined
      ? Math.round(movement?.accelerationBurstCount as number)
      : computedBursts,
    restGapCount: positiveNumber(movement?.restGapCount) !== undefined
      ? Math.round(movement?.restGapCount as number)
      : restGaps.length > 0
        ? restGaps.length
        : computedRestGapCount,
    longestRestGapSec: positiveNumber(movement?.longestRestGapSec) !== undefined
      ? Math.round(movement?.longestRestGapSec as number)
      : restGaps.length > 0
        ? Math.round(Math.max(...restGaps))
        : computedLongestRestGapSec,
    stepCount: positiveNumber(movement?.stepCount) !== undefined ? Math.round(movement?.stepCount as number) : undefined,
    distanceMeters: positiveNumber(movement?.distanceMeters) !== undefined
      ? roundTo(movement?.distanceMeters as number, 1)
      : undefined,
  };
};

const buildMissingData = (
  input: PhaseJPrimitiveAccumulatorInput,
  snapshotDraft: Omit<PhaseJPrimitiveSnapshot, 'missingData'>,
): string[] => {
  const missing: string[] = [...(input.missingData || [])];

  if (snapshotDraft.avgHrBpm === undefined && snapshotDraft.peakHrBpm === undefined) {
    missing.push('heart_rate');
  }
  if (!snapshotDraft.hrZoneMinutes) {
    missing.push('heart_rate_zones');
  }
  if (snapshotDraft.movementDensity === undefined) {
    missing.push('movement_density');
  }
  if (snapshotDraft.accelerationBurstCount === undefined) {
    missing.push('acceleration_bursts');
  }
  if (snapshotDraft.restGapCount === undefined && snapshotDraft.longestRestGapSec === undefined) {
    missing.push('rest_gaps');
  }
  if (snapshotDraft.activeEnergyKcal === undefined) {
    missing.push('active_energy');
  }
  if (snapshotDraft.deviceCoveragePct === undefined) {
    missing.push('device_coverage');
  } else if (snapshotDraft.deviceCoveragePct < 50) {
    missing.push('partial_device_coverage');
  }
  if (snapshotDraft.sourceCoverage.length === 0) {
    missing.push('source_coverage');
  }

  return unique(missing);
};

export const buildPhaseJPrimitiveSnapshot = (
  input: PhaseJPrimitiveAccumulatorInput,
): PhaseJPrimitiveSnapshot => {
  const detectedStartAt = Math.round(input.detectedStartAt);
  const detectedEndAt = Math.round(input.detectedEndAt);
  const durationSec = Math.max(0, detectedEndAt - detectedStartAt);
  const sourceCoverage = sanitizeSourceCoverage(input.sourceCoverage);
  const deviceCoveragePct = deriveDeviceCoveragePct(input.deviceCoveragePct, sourceCoverage);
  const hrStats = deriveHrStats(
    input.heartRate,
    detectedStartAt,
    detectedEndAt,
    input.hrZones || PHASE_J_DEFAULT_HR_ZONES,
  );
  const movementStats = deriveMovementStats(input.movement, detectedStartAt, detectedEndAt);

  const snapshotDraft: Omit<PhaseJPrimitiveSnapshot, 'missingData'> = {
    durationSec,
    detectedStartAt,
    detectedEndAt,
    timezone: input.timezone,
    ...hrStats,
    rrSampleCount: positiveNumber(input.heartRate?.rrSampleCount) !== undefined
      ? Math.round(input.heartRate?.rrSampleCount as number)
      : undefined,
    hrvRmssdMs: positiveNumber(input.heartRate?.hrvRmssdMs) !== undefined
      ? roundTo(input.heartRate?.hrvRmssdMs as number, 1)
      : undefined,
    ...movementStats,
    activeEnergyKcal: positiveNumber(input.energy?.activeEnergyKcal) !== undefined
      ? roundTo(input.energy?.activeEnergyKcal as number, 1)
      : undefined,
    deviceCoveragePct,
    sourceCoverage,
  };

  return {
    ...snapshotDraft,
    missingData: buildMissingData(input, snapshotDraft),
  };
};

export const accumulatePhaseJPrimitiveSnapshot = buildPhaseJPrimitiveSnapshot;
