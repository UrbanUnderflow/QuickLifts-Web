// =============================================================================
// Phase J Pattern Learning
//
// Pure helpers for updating per-athlete session pattern memory from confirmed
// or corrected candidates/session records. Persistence is handled by callers.
// =============================================================================

import {
  PHASE_J_SESSION_CONTRACT_VERSION,
  type PhaseJAthleteSessionPattern,
  type PhaseJConfidenceTier,
  type PhaseJContextConfirmationEvent,
  type PhaseJPrimitiveSnapshot,
  type PhaseJSessionCandidate,
  type PhaseJSessionRecord,
  type PhaseJSessionType,
} from './phaseJSessionContracts';

export interface PhaseJPatternLearningInput {
  candidate: PhaseJSessionCandidate;
  sessionRecord?: PhaseJSessionRecord;
  confirmationEvent?: PhaseJContextConfirmationEvent;
  existingPattern?: PhaseJAthleteSessionPattern;
  now?: number;
}

export interface PhaseJPatternLookupInput {
  athleteUserId: string;
  sportId?: string;
  sessionType: PhaseJSessionType;
  startAt: number;
  timezone: string;
}

export interface PhaseJPatternDecayInput {
  pattern: PhaseJAthleteSessionPattern;
  now: number;
  halfLifeDays?: number;
  minimumConfidenceScore?: number;
}

const SECONDS_PER_DAY = 86_400;

const roundTo = (value: number, decimals = 3): number => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const unique = <T>(values: T[]): T[] => Array.from(new Set(values.filter(Boolean)));

const confidenceTierFromScore = (score: number): PhaseJConfidenceTier => {
  if (score >= 0.86) return 'strong_contextual';
  if (score >= 0.72) return 'confirmed';
  if (score >= 0.56) return 'usable';
  if (score >= 0.32) return 'directional';
  return 'hold_back';
};

const scoreFromTier = (tier: PhaseJConfidenceTier): number => ({
  strong_contextual: 0.9,
  confirmed: 0.75,
  usable: 0.58,
  directional: 0.38,
  hold_back: 0.18,
})[tier];

const sessionTypeForLearning = (
  candidate: PhaseJSessionCandidate,
  sessionRecord?: PhaseJSessionRecord,
  confirmationEvent?: PhaseJContextConfirmationEvent,
): PhaseJSessionType =>
  sessionRecord?.sessionType ||
  confirmationEvent?.selectedSessionType ||
  candidate.candidateKinds[0] ||
  'unknown';

const hourBucket = (epochSeconds: number): string => {
  const hour = new Date(epochSeconds * 1000).getUTCHours();
  if (hour < 6) return 'overnight';
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  if (hour < 21) return 'evening';
  return 'late';
};

export const buildPhaseJPatternKey = ({
  athleteUserId,
  sportId = 'unknown_sport',
  sessionType,
  startAt,
}: PhaseJPatternLookupInput): string =>
  `${athleteUserId}|${sportId}|${sessionType}|${hourBucket(startAt)}`;

const summarizePrimitiveSignature = (
  primitiveSnapshot: PhaseJPrimitiveSnapshot,
): Record<string, unknown> => ({
  durationBandMin: Math.round((primitiveSnapshot.durationSec / 60) / 10) * 10,
  avgHrBand: primitiveSnapshot.avgHrBpm ? Math.round(primitiveSnapshot.avgHrBpm / 10) * 10 : undefined,
  peakHrBand: primitiveSnapshot.peakHrBpm ? Math.round(primitiveSnapshot.peakHrBpm / 10) * 10 : undefined,
  movementDensityBand: primitiveSnapshot.movementDensity !== undefined
    ? roundTo(Math.round(primitiveSnapshot.movementDensity * 10) / 10, 1)
    : undefined,
  accelerationBurstBand: primitiveSnapshot.accelerationBurstCount !== undefined
    ? Math.round(primitiveSnapshot.accelerationBurstCount / 5) * 5
    : undefined,
  restGapBand: primitiveSnapshot.restGapCount !== undefined
    ? Math.round(primitiveSnapshot.restGapCount / 2) * 2
    : undefined,
  deviceCoverageBand: primitiveSnapshot.deviceCoveragePct !== undefined
    ? Math.round(primitiveSnapshot.deviceCoveragePct / 10) * 10
    : undefined,
  missingData: primitiveSnapshot.missingData,
  sourceFamilies: unique(primitiveSnapshot.sourceCoverage.map((source) => source.sourceFamily)),
});

const mergeSignature = (
  previous: Record<string, unknown> | undefined,
  next: Record<string, unknown>,
): Record<string, unknown> => ({
  ...(previous || {}),
  ...next,
  learnedAt: next.learnedAt || Math.round(Date.now() / 1000),
});

export const updatePhaseJAthleteSessionPattern = ({
  candidate,
  sessionRecord,
  confirmationEvent,
  existingPattern,
  now = Math.round(Date.now() / 1000),
}: PhaseJPatternLearningInput): PhaseJAthleteSessionPattern => {
  const sessionType = sessionTypeForLearning(candidate, sessionRecord, confirmationEvent);
  const sportId = sessionRecord?.sportId || candidate.sportId || 'unknown_sport';
  const patternKey = existingPattern?.patternKey || buildPhaseJPatternKey({
    athleteUserId: candidate.athleteUserId,
    sportId,
    sessionType,
    startAt: candidate.detectedStartAt,
    timezone: candidate.timezone,
  });
  const wasCorrection = confirmationEvent?.disposition === 'corrected' || confirmationEvent?.disposition === 'dismissed';
  const positiveConfirmation = confirmationEvent?.disposition === 'confirmed' || Boolean(sessionRecord);
  const confirmedCount = (existingPattern?.confirmedCount || 0) + (positiveConfirmation && !wasCorrection ? 1 : 0);
  const correctionCount = (existingPattern?.correctionCount || 0) + (wasCorrection ? 1 : 0);
  const baseScore = existingPattern?.confidenceScore ?? scoreFromTier(candidate.confidenceTier);
  const nextScore = clamp(
    baseScore + (positiveConfirmation ? 0.08 : 0) - (wasCorrection ? 0.16 : 0) + (confirmedCount >= 3 ? 0.06 : 0),
    0,
    1,
  );

  return {
    id: existingPattern?.id || `${candidate.athleteUserId}_${sportId}_${sessionType}_${hourBucket(candidate.detectedStartAt)}`,
    athleteUserId: candidate.athleteUserId,
    teamId: candidate.teamId || existingPattern?.teamId,
    sportId,
    patternKey,
    sessionType,
    signature: mergeSignature(existingPattern?.signature, {
      ...summarizePrimitiveSignature(sessionRecord?.primitiveSnapshot || candidate.primitiveSnapshot),
      latestCandidateKind: candidate.candidateKinds[0],
      latestConfidenceTier: sessionRecord?.confidenceTier || candidate.confidenceTier,
      learnedAt: now,
    }),
    confirmedCount,
    correctionCount,
    confidenceTier: confidenceTierFromScore(nextScore),
    confidenceScore: roundTo(nextScore),
    lastConfirmedAt: positiveConfirmation && !wasCorrection ? now : existingPattern?.lastConfirmedAt,
    lastCorrectedAt: wasCorrection ? now : existingPattern?.lastCorrectedAt,
    exampleCandidateIds: unique([
      ...(existingPattern?.exampleCandidateIds || []),
      candidate.id,
    ]).slice(-10),
    exampleSessionRecordIds: unique([
      ...(existingPattern?.exampleSessionRecordIds || []),
      ...(sessionRecord ? [sessionRecord.id] : []),
    ]).slice(-10),
    decayAppliedAt: existingPattern?.decayAppliedAt,
    createdAt: existingPattern?.createdAt || now,
    updatedAt: now,
    contractVersion: PHASE_J_SESSION_CONTRACT_VERSION,
  };
};

export const decayPhaseJAthleteSessionPatternConfidence = ({
  pattern,
  now,
  halfLifeDays = 45,
  minimumConfidenceScore = 0.2,
}: PhaseJPatternDecayInput): PhaseJAthleteSessionPattern => {
  const lastEvidenceAt = pattern.lastConfirmedAt || pattern.updatedAt || pattern.createdAt;
  const elapsedDays = Math.max(0, (now - lastEvidenceAt) / SECONDS_PER_DAY);
  const decayFactor = 0.5 ** (elapsedDays / halfLifeDays);
  const currentScore = pattern.confidenceScore ?? scoreFromTier(pattern.confidenceTier);
  const nextScore = Math.max(minimumConfidenceScore, currentScore * decayFactor);

  return {
    ...pattern,
    confidenceScore: roundTo(nextScore),
    confidenceTier: confidenceTierFromScore(nextScore),
    decayAppliedAt: now,
    updatedAt: now,
  };
};

export const shouldSuppressClarificationFromPattern = (
  pattern: PhaseJAthleteSessionPattern | undefined,
  candidate: PhaseJSessionCandidate,
): boolean => {
  if (!pattern) return false;
  if (pattern.sessionType !== candidate.candidateKinds[0]) return false;
  if ((pattern.confidenceScore ?? scoreFromTier(pattern.confidenceTier)) < 0.78) return false;
  if (candidate.confidenceTier === 'hold_back') return false;
  if (candidate.missingContext.includes('coach_intent') || candidate.missingContext.includes('rpe')) return false;
  return true;
};
