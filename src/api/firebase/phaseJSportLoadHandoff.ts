// =============================================================================
// Phase J Sport Load Handoff
//
// Pure deterministic helpers for turning a canonical primitive snapshot plus a
// sport detection profile into the load payload consumed by later Phase J work.
// =============================================================================

import type {
  PhaseJConfidenceTier,
  PhaseJPrimitiveSnapshot,
  PhaseJSessionType,
} from './phaseJSessionContracts';
import type {
  PhaseJPrimitiveProfileKey,
  PhaseJSportDetectionLoadInput,
  PhaseJSportDetectionProfile,
} from './phaseJSportDetectionProfiles';

export interface PhaseJPrescribedLoadDeviation {
  executedRepsFraction?: number;
  paceDeviation?: number;
  restDeviation?: number;
  volumeDeviation?: number;
  modalityDrift?: number;
}

export interface PhaseJSportLoadHandoffContext {
  sessionType?: PhaseJSessionType;
  sessionRpe?: number;
  parsedLiftSummary?: Record<string, unknown>;
  prescribedDeviation?: PhaseJPrescribedLoadDeviation;
}

export interface PhaseJSportLoadHandoffInput {
  primitiveSnapshot: PhaseJPrimitiveSnapshot;
  profile: Pick<PhaseJSportDetectionProfile, 'sportId' | 'sportName' | 'loadInputs'>;
  context?: PhaseJSportLoadHandoffContext;
}

export interface PhaseJSportLoadContributionInput {
  key: string;
  weight: number;
  source: string;
  primitiveKey?: PhaseJPrimitiveProfileKey;
  rawValue: number;
  normalizedValue: number;
  contribution: number;
  required: boolean;
}

export interface PhaseJSportLoadModifier {
  key: string;
  value: number;
  multiplier: number;
  reason: string;
}

export interface PhaseJSportLoadExclusion {
  key: string;
  reason: string;
  required: boolean;
}

export interface PhaseJSportLoadHandoffResult {
  sportId: string;
  sportName: string;
  score: number;
  baseScore: number;
  inputs: PhaseJSportLoadContributionInput[];
  modifiers: PhaseJSportLoadModifier[];
  exclusions: PhaseJSportLoadExclusion[];
  confidence: {
    tier: PhaseJConfidenceTier;
    score: number;
    requiredInputsPresent: boolean;
    includedInputCount: number;
    excludedRequiredInputCount: number;
  };
}

const roundTo = (value: number, decimals = 3): number => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const sum = (values: number[]): number => values.reduce((total, value) => total + value, 0);

const numericRecordValue = (record: Record<string, unknown> | undefined, key: string): number | undefined => {
  const value = record?.[key];
  return isFiniteNumber(value) ? value : undefined;
};

const hrZoneMinutes = (snapshot: PhaseJPrimitiveSnapshot): Record<string, number> =>
  snapshot.hrZoneMinutes || {};

const totalHrZoneMinutes = (snapshot: PhaseJPrimitiveSnapshot): number =>
  sum(Object.values(hrZoneMinutes(snapshot)).filter(isFiniteNumber));

const activeHrZoneMinutes = (snapshot: PhaseJPrimitiveSnapshot): number =>
  sum(
    Object.entries(hrZoneMinutes(snapshot))
      .filter(([zone]) => !['0', '1', 'z0', 'z1', 'zone0', 'zone1'].includes(zone.toLowerCase()))
      .map(([, minutes]) => minutes)
      .filter(isFiniteNumber),
  );

const highIntensityMinutes = (snapshot: PhaseJPrimitiveSnapshot): number =>
  sum(
    Object.entries(hrZoneMinutes(snapshot))
      .filter(([zone]) => {
        const normalized = zone.toLowerCase();
        return normalized.includes('4') || normalized.includes('5') || normalized.includes('high');
      })
      .map(([, minutes]) => minutes)
      .filter(isFiniteNumber),
  );

const internalLoadHr = (snapshot: PhaseJPrimitiveSnapshot): number => {
  const zoneLoad = sum(
    Object.entries(hrZoneMinutes(snapshot)).map(([zone, minutes]) => {
      const numericZone = Number(zone.replace(/[^0-9.]/g, ''));
      const multiplier = Number.isFinite(numericZone) && numericZone > 0 ? numericZone : 1;
      return minutes * multiplier;
    }),
  );
  if (zoneLoad > 0) return zoneLoad;

  const durationMin = snapshot.durationSec / 60;
  const avgHrFactor = snapshot.avgHrBpm ? clamp((snapshot.avgHrBpm - 60) / 120, 0.2, 1.4) : 0.35;
  return durationMin * avgHrFactor;
};

const strengthVolume = (parsedLiftSummary?: Record<string, unknown>): number | undefined => {
  if (!parsedLiftSummary) return undefined;
  const explicitVolume = numericRecordValue(parsedLiftSummary, 'totalVolume');
  if (explicitVolume !== undefined) return explicitVolume;

  const totalSets = numericRecordValue(parsedLiftSummary, 'totalSets') || 0;
  const totalReps = numericRecordValue(parsedLiftSummary, 'totalReps') || 0;
  if (totalSets > 0 || totalReps > 0) return totalSets * 8 + totalReps;
  return undefined;
};

const primitiveValue = (
  snapshot: PhaseJPrimitiveSnapshot,
  key: PhaseJPrimitiveProfileKey | undefined,
  context?: PhaseJSportLoadHandoffContext,
): number | undefined => {
  if (!key) return undefined;
  if (key === 'durationMin') return snapshot.durationSec / 60;
  if (key === 'totalHrZoneMinutes') return totalHrZoneMinutes(snapshot);
  if (key === 'activeHrZoneMinutes') return activeHrZoneMinutes(snapshot);
  if (key === 'highIntensityMinutes') return highIntensityMinutes(snapshot);
  if (key === 'internalLoadHr') return internalLoadHr(snapshot);
  if (key === 'sessionRpe') return context?.sessionRpe;
  if (key === 'parsedLiftSummary') return strengthVolume(context?.parsedLiftSummary);
  if (key.startsWith('hrZoneMinutes.')) {
    return hrZoneMinutes(snapshot)[key.slice('hrZoneMinutes.'.length)];
  }
  const directValue = snapshot[key as keyof PhaseJPrimitiveSnapshot];
  return isFiniteNumber(directValue) ? directValue : undefined;
};

const normalizeLoadValue = (key: string, value: number, snapshot: PhaseJPrimitiveSnapshot): number => {
  const durationMin = Math.max(snapshot.durationSec / 60, 1);
  const normalizers: Record<string, number> = {
    durationMin: 120,
    internalLoadHr: 450,
    activeEnergyKcal: 900,
    sessionRpe: 10,
    accelerationBurstCount: 80,
    restGapCount: 30,
    longestRestGapSec: 300,
    movementDensity: 1,
    stepCount: 14000,
    distanceMeters: 12000,
    highIntensityMinutes: Math.max(durationMin * 0.45, 8),
    activeHrZoneMinutes: durationMin,
    totalHrZoneMinutes: durationMin,
    strengthVolume: 500,
    parsedLiftSummary: 500,
  };

  const normalizer = normalizers[key] || normalizers[key.split('.').pop() || ''] || 100;
  return roundTo(clamp(value / normalizer, 0, 1), 4);
};

const inputAppliesToSessionType = (
  input: PhaseJSportDetectionLoadInput,
  sessionType?: PhaseJSessionType,
): boolean => !input.candidateKinds || !sessionType || input.candidateKinds.includes(sessionType);

const rpeModifier = (sessionRpe: number | undefined): PhaseJSportLoadModifier | undefined => {
  if (!isFiniteNumber(sessionRpe)) return undefined;
  const normalized = clamp(sessionRpe, 1, 10);
  return {
    key: 'sessionRpe',
    value: roundTo(normalized, 2),
    multiplier: roundTo(0.85 + (normalized / 10) * 0.3, 3),
    reason: 'Athlete-reported effort adjusts the deterministic primitive load.',
  };
};

const prescribedDeviationModifiers = (
  deviation?: PhaseJPrescribedLoadDeviation,
): PhaseJSportLoadModifier[] => {
  if (!deviation) return [];
  const modifiers: PhaseJSportLoadModifier[] = [];
  const addDeviation = (key: keyof PhaseJPrescribedLoadDeviation, weight: number, direction: 1 | -1 = 1): void => {
    const value = deviation[key];
    if (!isFiniteNumber(value)) return;
    const bounded = key === 'executedRepsFraction' ? clamp(value - 1, -0.6, 0.8) : clamp(value, -0.8, 0.8);
    modifiers.push({
      key,
      value: roundTo(value, 3),
      multiplier: roundTo(clamp(1 + bounded * weight * direction, 0.65, 1.45), 3),
      reason: 'Executed-vs-prescribed context adjusted the session load handoff.',
    });
  };

  addDeviation('executedRepsFraction', 0.35);
  addDeviation('volumeDeviation', 0.3);
  addDeviation('paceDeviation', 0.18);
  addDeviation('restDeviation', 0.15, -1);
  addDeviation('modalityDrift', 0.22);
  return modifiers;
};

const confidenceTierFromScore = (
  score: number,
  requiredInputsPresent: boolean,
  includedInputCount: number,
): PhaseJConfidenceTier => {
  if (!requiredInputsPresent) return includedInputCount > 0 ? 'directional' : 'hold_back';
  if (score >= 0.75 && includedInputCount >= 2) return 'strong_contextual';
  if (score >= 0.55) return 'usable';
  if (includedInputCount > 0) return 'directional';
  return 'hold_back';
};

export const computePhaseJSportLoadHandoff = ({
  primitiveSnapshot,
  profile,
  context,
}: PhaseJSportLoadHandoffInput): PhaseJSportLoadHandoffResult => {
  const inputs: PhaseJSportLoadContributionInput[] = [];
  const exclusions: PhaseJSportLoadExclusion[] = [];

  for (const loadInput of profile.loadInputs) {
    if (!inputAppliesToSessionType(loadInput, context?.sessionType)) {
      exclusions.push({
        key: loadInput.key,
        reason: `Not applicable to ${context?.sessionType || 'this session type'}.`,
        required: Boolean(loadInput.required),
      });
      continue;
    }

    const sourceKey = loadInput.primitiveKey || loadInput.key;
    const rawValue = primitiveValue(primitiveSnapshot, sourceKey, context);
    if (!isFiniteNumber(rawValue)) {
      exclusions.push({
        key: loadInput.key,
        reason: loadInput.required ? 'Required load input is missing.' : 'Primitive load input is unavailable.',
        required: Boolean(loadInput.required),
      });
      continue;
    }

    const normalizedValue = normalizeLoadValue(loadInput.key, rawValue, primitiveSnapshot);
    inputs.push({
      key: loadInput.key,
      weight: loadInput.weight,
      source: loadInput.source,
      primitiveKey: sourceKey,
      rawValue: roundTo(rawValue, 3),
      normalizedValue,
      contribution: roundTo(normalizedValue * loadInput.weight, 4),
      required: Boolean(loadInput.required),
    });
  }

  const totalWeight = sum(inputs.map((input) => input.weight));
  const baseScore = totalWeight > 0 ? sum(inputs.map((input) => input.contribution)) / totalWeight : 0;
  const modifiers = [
    rpeModifier(context?.sessionRpe),
    ...prescribedDeviationModifiers(context?.prescribedDeviation),
  ].filter((modifier): modifier is PhaseJSportLoadModifier => Boolean(modifier));
  const modifierMultiplier = modifiers.reduce((current, modifier) => current * modifier.multiplier, 1);
  const score = roundTo(clamp(baseScore * modifierMultiplier, 0, 1), 4);
  const excludedRequiredInputCount = exclusions.filter((exclusion) => exclusion.required).length;
  const requiredInputsPresent = excludedRequiredInputCount === 0;
  const confidenceScore = roundTo(clamp(
    (inputs.length / Math.max(profile.loadInputs.length, 1)) * 0.7 +
      (requiredInputsPresent ? 0.3 : 0),
    0,
    1,
  ), 3);

  return {
    sportId: profile.sportId,
    sportName: profile.sportName,
    score,
    baseScore: roundTo(baseScore, 4),
    inputs,
    modifiers,
    exclusions,
    confidence: {
      tier: confidenceTierFromScore(confidenceScore, requiredInputsPresent, inputs.length),
      score: confidenceScore,
      requiredInputsPresent,
      includedInputCount: inputs.length,
      excludedRequiredInputCount,
    },
  };
};

export const buildPhaseJSportLoadContribution = computePhaseJSportLoadHandoff;
