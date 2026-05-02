// =============================================================================
// Phase J Unlabeled Session Detection
//
// Pure helpers for turning primitive snapshots plus optional athlete/coach
// context into honest session candidates. This module does not write to
// Firestore and deliberately favors hold_back over noisy over-detection.
// =============================================================================

import {
  PHASE_J_SESSION_CONTRACT_VERSION,
  type PhaseJConfidenceTier,
  type PhaseJPrimitiveSnapshot,
  type PhaseJRecordProvenance,
  type PhaseJSessionCandidate,
  type PhaseJSessionType,
} from './phaseJSessionContracts';

export interface PhaseJUnlabeledDetectionContext {
  athleteUserId: string;
  teamId?: string;
  sportId?: string;
  candidateId: string;
  evidenceRefs?: string[];
  scheduleEventId?: string;
  prescribedSessionId?: string;
  hasScheduleMatch?: boolean;
  scheduleSessionType?: PhaseJSessionType;
  hasCoachContext?: boolean;
  athleteKnownLiftWindow?: boolean;
  deviceAbsent?: boolean;
  now?: number;
  expiresAt?: number;
  provenance: PhaseJRecordProvenance;
}

export interface PhaseJUnlabeledDetectionResult {
  candidateKinds: PhaseJSessionType[];
  confidenceTier: PhaseJConfidenceTier;
  confidenceScore: number;
  missingContext: string[];
  rejectionReasons: string[];
  shouldEmitCandidate: boolean;
}

export interface BuildPhaseJUnlabeledSessionCandidateInput {
  primitiveSnapshot: PhaseJPrimitiveSnapshot;
  context: PhaseJUnlabeledDetectionContext;
  detection?: PhaseJUnlabeledDetectionResult;
}

const METERS_PER_MILE = 1609.344;

const roundTo = (value: number, decimals = 2): number => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const unique = <T>(values: T[]): T[] => Array.from(new Set(values.filter(Boolean)));
const uniqueSessionTypes = (values: PhaseJSessionType[]): PhaseJSessionType[] => unique(values);

const minutes = (seconds: number): number => seconds / 60;

const stepsPerMinute = (snapshot: PhaseJPrimitiveSnapshot): number | undefined => {
  if (!snapshot.stepCount || snapshot.durationSec <= 0) return undefined;
  return roundTo(snapshot.stepCount / minutes(snapshot.durationSec), 1);
};

const paceMinutesPerMile = (snapshot: PhaseJPrimitiveSnapshot): number | undefined => {
  if (!snapshot.distanceMeters || snapshot.distanceMeters <= 0 || snapshot.durationSec <= 0) return undefined;
  const miles = snapshot.distanceMeters / METERS_PER_MILE;
  return miles > 0 ? roundTo(minutes(snapshot.durationSec) / miles, 1) : undefined;
};

const scoreHrElevation = (snapshot: PhaseJPrimitiveSnapshot): number => {
  const avgScore = snapshot.avgHrBpm ? clamp((snapshot.avgHrBpm - 80) / 80, 0, 1) : 0;
  const peakScore = snapshot.peakHrBpm ? clamp((snapshot.peakHrBpm - 100) / 90, 0, 1) : 0;
  return roundTo(Math.max(avgScore, peakScore), 3);
};

const scoreLiftLike = (
  snapshot: PhaseJPrimitiveSnapshot,
  context: PhaseJUnlabeledDetectionContext,
): number => {
  const durationMin = minutes(snapshot.durationSec);
  const durationScore = clamp((durationMin - 12) / 35, 0, 1);
  const restScore = clamp((snapshot.restGapCount || 0) / 8, 0, 1);
  const burstScore = clamp((snapshot.accelerationBurstCount || 0) / 24, 0, 1);
  const density = snapshot.movementDensity ?? 0;
  const densityScore = density > 0.02 && density < 0.72 ? 0.7 : density >= 0.72 ? 0.25 : 0;
  const distancePenalty = snapshot.distanceMeters && snapshot.distanceMeters > 1200 ? 0.25 : 0;
  const contextBoost = context.athleteKnownLiftWindow || context.scheduleSessionType === 'lift' ? 0.18 : 0;

  return roundTo(clamp(
    (durationScore * 0.24) + (restScore * 0.24) + (burstScore * 0.2) + (densityScore * 0.18) +
      (scoreHrElevation(snapshot) * 0.14) + contextBoost - distancePenalty,
    0,
    1,
  ), 3);
};

const scoreRunLike = (snapshot: PhaseJPrimitiveSnapshot): number => {
  const durationMin = minutes(snapshot.durationSec);
  const cadence = stepsPerMinute(snapshot);
  const pace = paceMinutesPerMile(snapshot);
  const distanceScore = snapshot.distanceMeters ? clamp((snapshot.distanceMeters - 800) / 2400, 0, 1) : 0;
  const cadenceScore = cadence ? clamp((cadence - 115) / 55, 0, 1) : 0;
  const paceScore = pace ? clamp((18 - pace) / 9, 0, 1) : 0;
  const durationScore = clamp((durationMin - 8) / 35, 0, 1);

  return roundTo(clamp(
    (distanceScore * 0.28) + (cadenceScore * 0.3) + (paceScore * 0.22) +
      (durationScore * 0.1) + (scoreHrElevation(snapshot) * 0.1),
    0,
    1,
  ), 3);
};

const scoreConditioningLike = (snapshot: PhaseJPrimitiveSnapshot): number => {
  const durationMin = minutes(snapshot.durationSec);
  const durationScore = clamp((durationMin - 10) / 45, 0, 1);
  const burstScore = clamp((snapshot.accelerationBurstCount || 0) / 35, 0, 1);
  const densityScore = clamp((snapshot.movementDensity || 0) / 0.75, 0, 1);
  return roundTo(clamp(
    (scoreHrElevation(snapshot) * 0.35) + (burstScore * 0.25) + (densityScore * 0.2) +
      (durationScore * 0.2),
    0,
    1,
  ), 3);
};

const confidenceFromScore = (
  score: number,
  missingContext: string[],
  hasContext: boolean,
): PhaseJConfidenceTier => {
  if (score >= 0.82 && missingContext.length === 0 && hasContext) return 'strong_contextual';
  if (score >= 0.72 && missingContext.length <= 1) return 'usable';
  if (score >= 0.55) return 'directional';
  return 'hold_back';
};

export const detectPhaseJUnlabeledSession = (
  snapshot: PhaseJPrimitiveSnapshot,
  context: PhaseJUnlabeledDetectionContext,
): PhaseJUnlabeledDetectionResult => {
  const missingContext = [...snapshot.missingData];
  const rejectionReasons: string[] = [];

  if (context.deviceAbsent) {
    missingContext.push('device_confirmation', 'rpe', 'session_summary');
    const scheduledKind = context.scheduleSessionType || 'practice';
    return {
      candidateKinds: [scheduledKind],
      confidenceTier: 'directional',
      confidenceScore: 0.42,
      missingContext: unique(missingContext),
      rejectionReasons: ['device_absent'],
      shouldEmitCandidate: Boolean(context.hasScheduleMatch),
    };
  }

  const liftScore = scoreLiftLike(snapshot, context);
  const runScore = scoreRunLike(snapshot);
  const conditioningScore = scoreConditioningLike(snapshot);
  const scheduleScore = context.hasScheduleMatch ? 0.72 : 0;

  const scoredKinds: Array<{ kind: PhaseJSessionType; score: number }> = [
    { kind: 'lift', score: liftScore },
    { kind: 'run', score: runScore },
    { kind: 'conditioning', score: conditioningScore },
  ];

  if (context.hasScheduleMatch && context.scheduleSessionType) {
    scoredKinds.push({ kind: context.scheduleSessionType, score: scheduleScore });
  } else if (context.hasScheduleMatch) {
    scoredKinds.push({ kind: 'practice', score: scheduleScore });
  }

  const sorted = scoredKinds.sort((a, b) => b.score - a.score);
  const best = sorted[0];
  const candidateKinds = uniqueSessionTypes(
    sorted
      .filter((entry) => entry.score >= Math.max(0.5, best.score - 0.12))
      .map((entry) => entry.kind),
  );

  if (runScore < 0.65 && candidateKinds.includes('run')) {
    rejectionReasons.push('run_requires_distance_cadence_pace_alignment');
  }
  if (liftScore < 0.55 && candidateKinds.includes('lift')) {
    rejectionReasons.push('lift_requires_duration_bursts_or_rest_gaps');
  }
  if (!context.hasScheduleMatch && candidateKinds.includes('practice')) {
    missingContext.push('practice_schedule_or_coach_confirmation');
  }
  if (!context.hasCoachContext && (candidateKinds.includes('practice') || candidateKinds.includes('conditioning'))) {
    missingContext.push('coach_intent');
  }
  if (candidateKinds.length === 0 || best.score < 0.45) {
    rejectionReasons.push('no_session_shape_above_threshold');
  }

  const cleanCandidateKinds: PhaseJSessionType[] = candidateKinds.length > 0 ? candidateKinds : ['unknown'];
  const confidenceTier = confidenceFromScore(
    best.score,
    unique(missingContext),
    Boolean(context.hasScheduleMatch || context.hasCoachContext || context.athleteKnownLiftWindow),
  );

  return {
    candidateKinds: cleanCandidateKinds,
    confidenceTier,
    confidenceScore: roundTo(best.score, 3),
    missingContext: unique(missingContext),
    rejectionReasons: unique(rejectionReasons),
    shouldEmitCandidate: best.score >= 0.45 || Boolean(context.hasScheduleMatch),
  };
};

export const buildPhaseJUnlabeledSessionCandidate = ({
  primitiveSnapshot,
  context,
  detection = detectPhaseJUnlabeledSession(primitiveSnapshot, context),
}: BuildPhaseJUnlabeledSessionCandidateInput): PhaseJSessionCandidate => {
  const now = Math.round(context.now || Date.now() / 1000);
  return {
    id: context.candidateId,
    athleteUserId: context.athleteUserId,
    teamId: context.teamId,
    sportId: context.sportId,
    candidateKinds: detection.candidateKinds,
    status: detection.confidenceTier === 'hold_back' ? 'held_back' : 'detected',
    confidenceTier: detection.confidenceTier,
    confidenceScore: detection.confidenceScore,
    detectedStartAt: primitiveSnapshot.detectedStartAt,
    detectedEndAt: primitiveSnapshot.detectedEndAt,
    timezone: primitiveSnapshot.timezone,
    primitiveSnapshot,
    missingContext: detection.missingContext,
    evidenceRefs: context.evidenceRefs || context.provenance.sourceRecordIds,
    scheduleEventId: context.scheduleEventId,
    prescribedSessionId: context.prescribedSessionId,
    confirmationEventIds: [],
    provenance: {
      ...context.provenance,
      confidenceHints: unique([
        ...context.provenance.confidenceHints,
        `unlabeled_score:${detection.confidenceScore}`,
        ...detection.candidateKinds.map((kind) => `candidate_kind:${kind}`),
      ]),
      qualityFlags: unique([
        ...context.provenance.qualityFlags,
        ...detection.rejectionReasons,
      ]),
    },
    contractVersion: PHASE_J_SESSION_CONTRACT_VERSION,
    createdAt: now,
    updatedAt: now,
    expiresAt: context.expiresAt,
  };
};
