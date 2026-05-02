// =============================================================================
// Phase J Session Contracts — Contextual Sports Detection Engine
//
// These TypeScript contracts lock the Firestore boundary for Phase J before
// detection, Nora clarification, canonical session writing, and sport-load
// consumers build against assumed shapes.
// =============================================================================

export const PHASE_J_SESSION_CONTRACT_VERSION = 'phase-j-session-v0.1';

export const PHASE_J_SESSION_CANDIDATES_COLLECTION = 'phase-j-session-candidates';
export const PHASE_J_CONTEXT_CONFIRMATION_EVENTS_COLLECTION = 'phase-j-context-confirmation-events';
export const PHASE_J_CLARIFICATION_PROMPTS_COLLECTION = 'phase-j-clarification-prompts';
export const PHASE_J_SESSION_RECORDS_COLLECTION = 'phase-j-session-records';
export const PHASE_J_ATHLETE_SESSION_PATTERNS_COLLECTION = 'phase-j-athlete-session-patterns';

export type PhaseJActorRole = 'athlete' | 'coach' | 'operator' | 'vendor' | 'system';

export type PhaseJConfidenceTier =
  | 'strong_contextual'
  | 'confirmed'
  | 'usable'
  | 'directional'
  | 'hold_back';

export type PhaseJCandidateStatus =
  | 'detected'
  | 'contextualized'
  | 'needs_clarification'
  | 'confirmed'
  | 'converted'
  | 'dismissed'
  | 'expired'
  | 'held_back';

export type PhaseJSessionType =
  | 'lift'
  | 'practice'
  | 'conditioning'
  | 'game'
  | 'recovery'
  | 'individual_training'
  | 'walk'
  | 'run'
  | 'bike'
  | 'other'
  | 'unknown';

export type PhaseJPromptStatus = 'pending' | 'answered' | 'expired' | 'suppressed' | 'cancelled';

export type PhaseJPromptTarget = 'athlete' | 'coach' | 'operator';

export type PhaseJQuestionType =
  | 'session_type'
  | 'session_intent'
  | 'lift_summary'
  | 'rpe'
  | 'soreness'
  | 'device_absent'
  | 'schedule_mismatch'
  | 'coach_intent'
  | 'other';

export type PhaseJConfirmationBasis =
  | 'direct_answer'
  | 'explicit_start_label'
  | 'coach_schedule_confirm'
  | 'coach_observation'
  | 'vendor_classification'
  | 'operator_review'
  | 'team_majority_context';

export type PhaseJConfirmationDisposition =
  | 'confirmed'
  | 'corrected'
  | 'dismissed'
  | 'not_sure'
  | 'needs_review';

export interface PhaseJActorRef {
  actorId: string;
  actorRole: PhaseJActorRole;
  displayName?: string;
}

export interface PhaseJRecordProvenance {
  sourceFamily: string;
  sourceType: string;
  sourceRecordIds: string[];
  adapter?: string;
  observedAt: number;
  ingestedAt: number;
  rawRef?: string;
  confidenceHints: string[];
  qualityFlags: string[];
}

export interface PhaseJSourceCoverage {
  sourceFamily: string;
  sourceType: string;
  coveragePct?: number;
  sampleCount?: number;
  firstObservedAt?: number;
  lastObservedAt?: number;
}

export interface PhaseJPrimitiveSnapshot {
  durationSec: number;
  detectedStartAt: number;
  detectedEndAt: number;
  timezone: string;
  avgHrBpm?: number;
  peakHrBpm?: number;
  hrZoneMinutes?: Record<string, number>;
  rrSampleCount?: number;
  hrvRmssdMs?: number;
  movementDensity?: number;
  accelerationBurstCount?: number;
  restGapCount?: number;
  longestRestGapSec?: number;
  stepCount?: number;
  distanceMeters?: number;
  activeEnergyKcal?: number;
  deviceCoveragePct?: number;
  missingData: string[];
  sourceCoverage: PhaseJSourceCoverage[];
}

export interface PhaseJSessionCandidate {
  id: string;
  athleteUserId: string;
  teamId?: string;
  sportId?: string;
  candidateKinds: PhaseJSessionType[];
  status: PhaseJCandidateStatus;
  confidenceTier: PhaseJConfidenceTier;
  confidenceScore?: number;
  detectedStartAt: number;
  detectedEndAt: number;
  timezone: string;
  primitiveSnapshot: PhaseJPrimitiveSnapshot;
  missingContext: string[];
  evidenceRefs: string[];
  scheduleEventId?: string;
  prescribedSessionId?: string;
  latestPromptId?: string;
  confirmationEventIds: string[];
  provenance: PhaseJRecordProvenance;
  contractVersion: typeof PHASE_J_SESSION_CONTRACT_VERSION;
  createdAt: number;
  updatedAt: number;
  expiresAt?: number;
}

export interface PhaseJClarificationPrompt {
  id: string;
  candidateId: string;
  athleteUserId: string;
  teamId?: string;
  target: PhaseJPromptTarget;
  questionType: PhaseJQuestionType;
  promptText: string;
  answerOptions?: string[];
  reason: string;
  status: PhaseJPromptStatus;
  missingContextResolved: string[];
  dailyFrictionBucket: string;
  actorPrecedenceApplied: PhaseJActorRole[];
  createdAt: number;
  expiresAt: number;
  answeredAt?: number;
  answerEventId?: string;
  suppressedReason?: string;
  contractVersion: typeof PHASE_J_SESSION_CONTRACT_VERSION;
}

export interface PhaseJContextConfirmationEvent {
  id: string;
  candidateId: string;
  athleteUserId: string;
  teamId?: string;
  actor: PhaseJActorRef;
  disposition: PhaseJConfirmationDisposition;
  confirmationBasis: PhaseJConfirmationBasis;
  confidenceImpact: PhaseJConfidenceTier;
  answer: string;
  selectedSessionType?: PhaseJSessionType;
  freeText?: string;
  voiceTranscript?: string;
  parsedContext?: Record<string, unknown>;
  promptId?: string;
  createdAt: number;
  expiresAt?: number;
  provenance: PhaseJRecordProvenance;
  contractVersion: typeof PHASE_J_SESSION_CONTRACT_VERSION;
}

export interface PhaseJSessionRecord {
  id: string;
  athleteUserId: string;
  teamId?: string;
  sportId: string;
  sessionType: PhaseJSessionType;
  startAt: number;
  endAt: number;
  timezone: string;
  candidateId: string;
  primitiveSnapshot: PhaseJPrimitiveSnapshot;
  contextRefs: string[];
  confirmationEventIds: string[];
  scheduleEventId?: string;
  prescribedSessionId?: string;
  confidenceTier: PhaseJConfidenceTier;
  loadContribution?: Record<string, unknown>;
  athleteVisibleSummary?: string;
  coachVisibleSummary?: string;
  athleteNote?: string;
  parsedLiftSummary?: Record<string, unknown>;
  provenance: PhaseJRecordProvenance;
  contractVersion: typeof PHASE_J_SESSION_CONTRACT_VERSION;
  createdAt: number;
  updatedAt: number;
}

export interface PhaseJAthleteSessionPattern {
  id: string;
  athleteUserId: string;
  teamId?: string;
  sportId: string;
  patternKey: string;
  sessionType: PhaseJSessionType;
  signature: Record<string, unknown>;
  confirmedCount: number;
  correctionCount: number;
  confidenceTier: PhaseJConfidenceTier;
  confidenceScore?: number;
  lastConfirmedAt?: number;
  lastCorrectedAt?: number;
  exampleCandidateIds: string[];
  exampleSessionRecordIds: string[];
  decayAppliedAt?: number;
  createdAt: number;
  updatedAt: number;
  contractVersion: typeof PHASE_J_SESSION_CONTRACT_VERSION;
}

export const PHASE_J_CONFIDENCE_TIERS: PhaseJConfidenceTier[] = [
  'strong_contextual',
  'confirmed',
  'usable',
  'directional',
  'hold_back',
];

export const PHASE_J_ALLOWED_CONFIDENCE_TRANSITIONS: Record<PhaseJConfidenceTier, PhaseJConfidenceTier[]> = {
  strong_contextual: ['strong_contextual', 'confirmed', 'usable', 'directional', 'hold_back'],
  confirmed: ['strong_contextual', 'confirmed', 'usable', 'directional', 'hold_back'],
  usable: ['strong_contextual', 'confirmed', 'usable', 'directional', 'hold_back'],
  directional: ['confirmed', 'usable', 'directional', 'hold_back'],
  hold_back: ['confirmed', 'usable', 'directional', 'hold_back'],
};

export const PHASE_J_ACTOR_PRECEDENCE: PhaseJActorRole[] = [
  'operator',
  'coach',
  'athlete',
  'vendor',
  'system',
];

export const PHASE_J_REQUIRED_PROVENANCE_FIELDS: Array<keyof PhaseJRecordProvenance> = [
  'sourceFamily',
  'sourceType',
  'sourceRecordIds',
  'observedAt',
  'ingestedAt',
  'confidenceHints',
  'qualityFlags',
];

export const PHASE_J_TERMINAL_CANDIDATE_STATUSES: PhaseJCandidateStatus[] = [
  'converted',
  'dismissed',
  'expired',
  'held_back',
];

export interface PhaseJIndexRequirement {
  collection: string;
  fields: string;
  purpose: string;
}

export const PHASE_J_INDEX_REQUIREMENTS: PhaseJIndexRequirement[] = [
  {
    collection: PHASE_J_SESSION_CANDIDATES_COLLECTION,
    fields: 'athleteUserId ASC, status ASC, detectedStartAt DESC',
    purpose: 'Athlete-scoped candidate review, prompt routing, and stale candidate cleanup.',
  },
  {
    collection: PHASE_J_SESSION_CANDIDATES_COLLECTION,
    fields: 'teamId ASC, status ASC, detectedStartAt DESC',
    purpose: 'Team/operator reviewer queues and coach context reconciliation.',
  },
  {
    collection: PHASE_J_CLARIFICATION_PROMPTS_COLLECTION,
    fields: 'athleteUserId ASC, status ASC, expiresAt ASC',
    purpose: 'Athlete-facing pending prompts and expiration sweeps.',
  },
  {
    collection: PHASE_J_CLARIFICATION_PROMPTS_COLLECTION,
    fields: 'teamId ASC, target ASC, status ASC, createdAt DESC',
    purpose: 'Coach/operator prompt queues.',
  },
  {
    collection: PHASE_J_CONTEXT_CONFIRMATION_EVENTS_COLLECTION,
    fields: 'candidateId ASC, createdAt DESC',
    purpose: 'Candidate-to-confirmation audit trace.',
  },
  {
    collection: PHASE_J_SESSION_RECORDS_COLLECTION,
    fields: 'athleteUserId ASC, startAt DESC',
    purpose: 'Athlete timeline and load model ingestion.',
  },
  {
    collection: PHASE_J_SESSION_RECORDS_COLLECTION,
    fields: 'teamId ASC, sportId ASC, startAt DESC',
    purpose: 'Coach reports and team/sport review surfaces.',
  },
  {
    collection: PHASE_J_ATHLETE_SESSION_PATTERNS_COLLECTION,
    fields: 'athleteUserId ASC, sportId ASC, patternKey ASC',
    purpose: 'Runtime pattern lookup before clarification routing.',
  },
];

export const isPhaseJConfidenceTier = (value: unknown): value is PhaseJConfidenceTier =>
  typeof value === 'string' && PHASE_J_CONFIDENCE_TIERS.includes(value as PhaseJConfidenceTier);

export const isTerminalPhaseJCandidateStatus = (status: PhaseJCandidateStatus): boolean =>
  PHASE_J_TERMINAL_CANDIDATE_STATUSES.includes(status);

export const canTransitionPhaseJConfidence = (
  from: PhaseJConfidenceTier,
  to: PhaseJConfidenceTier,
): boolean => PHASE_J_ALLOWED_CONFIDENCE_TRANSITIONS[from].includes(to);
