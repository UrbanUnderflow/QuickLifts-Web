// =============================================================================
// Phase J Nora Clarification Router
//
// Pure TypeScript routing and payload builders. This module intentionally does
// not import Firebase clients or write to Firestore.
// =============================================================================

import {
  PHASE_J_ACTOR_PRECEDENCE,
  PHASE_J_SESSION_CONTRACT_VERSION,
  type PhaseJActorRef,
  type PhaseJActorRole,
  type PhaseJClarificationPrompt,
  type PhaseJConfidenceTier,
  type PhaseJConfirmationBasis,
  type PhaseJConfirmationDisposition,
  type PhaseJContextConfirmationEvent,
  type PhaseJPromptStatus,
  type PhaseJPromptTarget,
  type PhaseJQuestionType,
  type PhaseJRecordProvenance,
  type PhaseJSessionCandidate,
  type PhaseJSessionType,
} from './phaseJSessionContracts';

export type PhaseJClarificationSuppressionReason =
  | 'not_material'
  | 'daily_cap_reached'
  | 'cooldown_active'
  | 'candidate_expired'
  | 'candidate_already_terminal'
  | 'missing_route_context';

export interface PhaseJClarificationFrictionPolicy {
  dailyPromptCap: number;
  cooldownSeconds: number;
  promptTtlSeconds: number;
  dailyFrictionBucket?: string;
  enforceForTargets?: PhaseJPromptTarget[];
}

export interface PhaseJPriorClarificationPrompt {
  id: string;
  candidateId?: string;
  target: PhaseJPromptTarget;
  questionType?: PhaseJQuestionType;
  status: PhaseJPromptStatus;
  dailyFrictionBucket?: string;
  createdAt: number;
  answeredAt?: number;
}

export interface PhaseJPriorPromptHistory {
  prompts?: PhaseJPriorClarificationPrompt[];
  dailyPromptCount?: number;
  lastPromptCreatedAt?: number;
}

export interface PhaseJCoachContextAvailability {
  available: boolean;
  canResolveMissingContext?: boolean;
  availableMissingContext?: string[];
  preferredQuestionTypes?: PhaseJQuestionType[];
  coachActor?: PhaseJActorRef;
  reason?: string;
}

export interface PhaseJOperatorRoutingContext {
  enabled?: boolean;
  forceReview?: boolean;
  fallbackWhenSuppressed?: boolean;
  reasons?: string[];
}

export interface PhaseJClarificationMateriality {
  canChangeClassification?: boolean;
  canChangeConfidence?: boolean;
  canChangeLoad?: boolean;
  canChangeRecommendation?: boolean;
  canChangeReviewerPosture?: boolean;
  forced?: boolean;
  reason?: string;
}

export interface PhaseJClarificationRoutingContext {
  candidate: PhaseJSessionCandidate;
  now?: number;
  id?: string;
  preferredTarget?: PhaseJPromptTarget;
  questionType?: PhaseJQuestionType;
  promptText?: string;
  answerOptions?: string[];
  reason?: string;
  missingContext?: string[];
  frictionPolicy: PhaseJClarificationFrictionPolicy;
  priorPromptHistory?: PhaseJPriorPromptHistory;
  coachContext?: PhaseJCoachContextAvailability;
  operatorContext?: PhaseJOperatorRoutingContext;
  materiality?: PhaseJClarificationMateriality;
}

export interface PhaseJClarificationRouteDecision {
  target: PhaseJPromptTarget;
  questionType: PhaseJQuestionType;
  prompt: PhaseJClarificationPrompt;
  shouldPrompt: boolean;
  suppressionReason?: PhaseJClarificationSuppressionReason;
  fallbackTarget?: PhaseJPromptTarget;
  friction: {
    dailyFrictionBucket: string;
    dailyPromptCount: number;
    lastPromptCreatedAt?: number;
    cooldownRemainingSeconds: number;
  };
}

export interface PhaseJClarificationProvenanceInput {
  sourceFamily?: string;
  sourceType?: string;
  sourceRecordIds?: string[];
  adapter?: string;
  observedAt?: number;
  ingestedAt?: number;
  rawRef?: string;
  confidenceHints?: string[];
  qualityFlags?: string[];
}

export interface PhaseJClarificationAnswerInput {
  id?: string;
  prompt: PhaseJClarificationPrompt;
  actor: PhaseJActorRef;
  answer: string;
  selectedSessionType?: PhaseJSessionType;
  disposition?: PhaseJConfirmationDisposition;
  confirmationBasis?: PhaseJConfirmationBasis;
  confidenceImpact?: PhaseJConfidenceTier;
  freeText?: string;
  voiceTranscript?: string;
  parsedContext?: Record<string, unknown>;
  createdAt?: number;
  expiresAt?: number;
  provenance?: PhaseJRecordProvenance;
  provenanceInput?: PhaseJClarificationProvenanceInput;
}

const TERMINAL_STATUSES = new Set<PhaseJSessionCandidate['status']>([
  'confirmed',
  'converted',
  'dismissed',
  'expired',
  'held_back',
]);

const DEFAULT_ANSWER_OPTIONS: Partial<Record<PhaseJQuestionType, string[]>> = {
  session_type: ['Lift', 'Practice', 'Conditioning', 'Game', 'Recovery', 'Other', 'Not sure'],
  session_intent: ['Training', 'Recovery', 'Competition', 'Warmup', 'Other', 'Not sure'],
  rpe: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'],
  soreness: ['None', 'Mild', 'Moderate', 'High'],
  device_absent: ['Yes, I trained', 'No training', 'Device was off', 'Not sure'],
  schedule_mismatch: ['Schedule is correct', 'This was different', 'No session happened', 'Not sure'],
  coach_intent: ['As planned', 'Modified', 'Cancelled', 'Different session', 'Not sure'],
};

const QUESTION_CONTEXT_KEYS: Record<PhaseJQuestionType, string[]> = {
  session_type: ['session_type'],
  session_intent: ['session_intent', 'session_type'],
  lift_summary: ['lift_summary'],
  rpe: ['rpe'],
  soreness: ['soreness'],
  device_absent: ['device_coverage', 'device_absent', 'heart_rate'],
  schedule_mismatch: ['schedule', 'schedule_mismatch'],
  coach_intent: ['coach_intent', 'prescribed_session', 'prescribed_plan'],
  other: [],
};

const nowSeconds = (): number => Math.round(Date.now() / 1000);

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const nonEmptyString = (value: unknown): string | undefined => {
  const normalized = typeof value === 'string' ? value.trim() : '';
  return normalized || undefined;
};

const requireString = (value: unknown, label: string): string => {
  const normalized = nonEmptyString(value);
  if (!normalized) {
    throw new Error(`[PhaseJClarificationRouter] ${label} is required.`);
  }
  return normalized;
};

const stripUndefinedDeep = <T>(value: T): T => {
  if (Array.isArray(value)) {
    return value
      .map((entry) => stripUndefinedDeep(entry))
      .filter((entry) => entry !== undefined) as unknown as T;
  }
  if (!value || typeof value !== 'object') return value;

  const output: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (entry === undefined) continue;
    output[key] = stripUndefinedDeep(entry);
  }
  return output as T;
};

const unique = (values: string[]): string[] => Array.from(new Set(values.filter(Boolean)));

const roundSeconds = (value: number): number => Math.round(value);

const targetToActorRole = (target: PhaseJPromptTarget): PhaseJActorRole => target;

const toDayKey = (epochSeconds: number, timezone?: string): string => {
  const date = new Date(epochSeconds * 1000);
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone || 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);
    const year = parts.find((part) => part.type === 'year')?.value;
    const month = parts.find((part) => part.type === 'month')?.value;
    const day = parts.find((part) => part.type === 'day')?.value;
    if (year && month && day) return `${year}-${month}-${day}`;
  } catch {
    // Fall through to UTC when an upstream timezone is malformed.
  }
  return date.toISOString().slice(0, 10);
};

const defaultDailyFrictionBucket = (
  candidate: PhaseJSessionCandidate,
  now: number,
): string => `${candidate.athleteUserId}:${toDayKey(now, candidate.timezone)}`;

const shouldTreatAsMaterial = (
  candidate: PhaseJSessionCandidate,
  missingContext: string[],
  materiality?: PhaseJClarificationMateriality,
): boolean => {
  if (materiality?.forced) return true;
  if (materiality) {
    return Boolean(
      materiality.canChangeClassification ||
      materiality.canChangeConfidence ||
      materiality.canChangeLoad ||
      materiality.canChangeRecommendation ||
      materiality.canChangeReviewerPosture,
    );
  }
  return (
    missingContext.length > 0 ||
    candidate.status === 'needs_clarification' ||
    candidate.confidenceTier === 'directional' ||
    candidate.confidenceTier === 'hold_back' ||
    candidate.candidateKinds.length !== 1 ||
    candidate.candidateKinds.includes('unknown')
  );
};

const inferQuestionType = (
  candidate: PhaseJSessionCandidate,
  missingContext: string[],
): PhaseJQuestionType => {
  const normalized = new Set(missingContext.map((entry) => entry.toLowerCase()));
  if (normalized.has('session_type') || candidate.candidateKinds.length !== 1) return 'session_type';
  if (normalized.has('session_intent')) return 'session_intent';
  if (normalized.has('lift_summary')) return 'lift_summary';
  if (normalized.has('rpe')) return 'rpe';
  if (normalized.has('soreness')) return 'soreness';
  if (normalized.has('schedule') || normalized.has('schedule_mismatch')) return 'schedule_mismatch';
  if (normalized.has('coach_intent') || normalized.has('prescribed_plan')) return 'coach_intent';
  if (
    normalized.has('device_absent') ||
    normalized.has('device_coverage') ||
    normalized.has('heart_rate')
  ) {
    return 'device_absent';
  }
  return 'other';
};

const canCoachResolve = (
  coachContext: PhaseJCoachContextAvailability | undefined,
  questionType: PhaseJQuestionType,
  missingContext: string[],
): boolean => {
  if (!coachContext?.available) return false;
  if (coachContext.canResolveMissingContext === false) return false;
  if (coachContext.preferredQuestionTypes?.includes(questionType)) return true;

  const availableMissingContext = coachContext.availableMissingContext || [];
  if (availableMissingContext.length === 0) return true;
  return missingContext.some((entry) => availableMissingContext.includes(entry));
};

const chooseTarget = (
  input: PhaseJClarificationRoutingContext,
  questionType: PhaseJQuestionType,
  missingContext: string[],
): PhaseJPromptTarget => {
  if (input.operatorContext?.forceReview) return 'operator';
  if (input.preferredTarget) return input.preferredTarget;
  if (canCoachResolve(input.coachContext, questionType, missingContext)) return 'coach';
  return 'athlete';
};

const isFrictionEnforcedForTarget = (
  policy: PhaseJClarificationFrictionPolicy,
  target: PhaseJPromptTarget,
): boolean => (policy.enforceForTargets || ['athlete', 'coach']).includes(target);

const resolveHistoryStats = (
  history: PhaseJPriorPromptHistory | undefined,
  bucket: string,
  target: PhaseJPromptTarget,
): { dailyPromptCount: number; lastPromptCreatedAt?: number } => {
  const prompts = history?.prompts || [];
  const matchingPrompts = prompts.filter(
    (prompt) =>
      prompt.target === target &&
      prompt.status !== 'cancelled' &&
      (!prompt.dailyFrictionBucket || prompt.dailyFrictionBucket === bucket),
  );
  const computedDailyCount = matchingPrompts.filter(
    (prompt) => prompt.dailyFrictionBucket === bucket || !prompt.dailyFrictionBucket,
  ).length;
  const computedLastPromptAt = matchingPrompts.reduce<number | undefined>(
    (latest, prompt) => latest === undefined ? prompt.createdAt : Math.max(latest, prompt.createdAt),
    undefined,
  );

  return {
    dailyPromptCount: history?.dailyPromptCount ?? computedDailyCount,
    lastPromptCreatedAt: history?.lastPromptCreatedAt ?? computedLastPromptAt,
  };
};

const frictionSuppressionReason = (
  policy: PhaseJClarificationFrictionPolicy,
  stats: { dailyPromptCount: number; lastPromptCreatedAt?: number },
  now: number,
): { reason?: PhaseJClarificationSuppressionReason; cooldownRemainingSeconds: number } => {
  const cooldownRemainingSeconds = stats.lastPromptCreatedAt
    ? Math.max(0, roundSeconds(policy.cooldownSeconds - (now - stats.lastPromptCreatedAt)))
    : 0;
  if (stats.dailyPromptCount >= policy.dailyPromptCap) {
    return { reason: 'daily_cap_reached', cooldownRemainingSeconds };
  }
  if (cooldownRemainingSeconds > 0) {
    return { reason: 'cooldown_active', cooldownRemainingSeconds };
  }
  return { cooldownRemainingSeconds };
};

const resolveMissingContextForQuestion = (
  questionType: PhaseJQuestionType,
  missingContext: string[],
): string[] => {
  const knownKeys = QUESTION_CONTEXT_KEYS[questionType];
  if (knownKeys.length === 0) return unique(missingContext);

  const resolved = missingContext.filter((entry) => knownKeys.includes(entry));
  return resolved.length > 0 ? unique(resolved) : knownKeys;
};

const promptTextFor = (
  target: PhaseJPromptTarget,
  questionType: PhaseJQuestionType,
  candidate: PhaseJSessionCandidate,
): string => {
  const timeHint = candidate.timezone ? ' for this detected window' : '';
  const targetPrefix = target === 'coach' ? 'Coach check: ' : target === 'operator' ? 'Review needed: ' : '';

  switch (questionType) {
    case 'session_type':
      return `${targetPrefix}What kind of session was this${timeHint}?`;
    case 'session_intent':
      return `${targetPrefix}What was the intent of this session${timeHint}?`;
    case 'lift_summary':
      return `${targetPrefix}What lifts or main work should be attached to this session?`;
    case 'rpe':
      return `${targetPrefix}How hard was this session from 1 to 10?`;
    case 'soreness':
      return `${targetPrefix}How much soreness should Nora account for after this session?`;
    case 'device_absent':
      return `${targetPrefix}Did a session happen while device data was missing or incomplete?`;
    case 'schedule_mismatch':
      return `${targetPrefix}Did this detected window match the scheduled session?`;
    case 'coach_intent':
      return `${targetPrefix}Was this completed as planned, modified, or cancelled?`;
    case 'other':
      return `${targetPrefix}What context would make this session read accurate?`;
    default:
      return `${targetPrefix}What context would make this session read accurate?`;
  }
};

const answerOptionsFor = (
  questionType: PhaseJQuestionType,
  candidate: PhaseJSessionCandidate,
): string[] | undefined => {
  if (questionType === 'session_type') {
    const candidateOptions = candidate.candidateKinds
      .filter((kind) => kind !== 'unknown')
      .map((kind) => kind.replace(/_/g, ' '));
    return unique([...candidateOptions, ...(DEFAULT_ANSWER_OPTIONS.session_type || [])]);
  }
  return DEFAULT_ANSWER_OPTIONS[questionType];
};

const actorPrecedenceForTarget = (target: PhaseJPromptTarget): PhaseJActorRole[] => {
  const targetRole = targetToActorRole(target);
  return PHASE_J_ACTOR_PRECEDENCE.filter((role) => {
    if (role === 'vendor' || role === 'system') return false;
    return role === targetRole || role === 'operator' || role === 'coach' || role === 'athlete';
  });
};

const buildPromptPayload = (
  input: PhaseJClarificationRoutingContext,
  target: PhaseJPromptTarget,
  questionType: PhaseJQuestionType,
  dailyFrictionBucket: string,
  status: PhaseJPromptStatus,
  suppressionReason?: PhaseJClarificationSuppressionReason,
): PhaseJClarificationPrompt => {
  const now = roundSeconds(input.now || nowSeconds());
  const candidate = input.candidate;
  const missingContext = input.missingContext || candidate.missingContext || [];
  const id = input.id || [
    'phase-j-clarification',
    candidate.id,
    target,
    questionType,
    now,
  ].join(':');

  return stripUndefinedDeep({
    id,
    candidateId: requireString(candidate.id, 'candidate.id'),
    athleteUserId: requireString(candidate.athleteUserId, 'candidate.athleteUserId'),
    teamId: nonEmptyString(candidate.teamId),
    target,
    questionType,
    promptText: input.promptText || promptTextFor(target, questionType, candidate),
    answerOptions: input.answerOptions || answerOptionsFor(questionType, candidate),
    reason: input.reason || input.materiality?.reason || input.coachContext?.reason || 'Missing context can change the Phase J session read.',
    status,
    missingContextResolved: resolveMissingContextForQuestion(questionType, missingContext),
    dailyFrictionBucket,
    actorPrecedenceApplied: actorPrecedenceForTarget(target),
    createdAt: now,
    expiresAt: now + Math.max(60, roundSeconds(input.frictionPolicy.promptTtlSeconds)),
    suppressedReason: suppressionReason,
    contractVersion: PHASE_J_SESSION_CONTRACT_VERSION,
  });
};

export const routePhaseJClarificationPrompt = (
  input: PhaseJClarificationRoutingContext,
): PhaseJClarificationRouteDecision => {
  const now = roundSeconds(input.now || nowSeconds());
  const candidate = input.candidate;
  const missingContext = input.missingContext || candidate.missingContext || [];
  const questionType = input.questionType || inferQuestionType(candidate, missingContext);
  const dailyFrictionBucket = input.frictionPolicy.dailyFrictionBucket || defaultDailyFrictionBucket(candidate, now);
  const initialTarget = chooseTarget(input, questionType, missingContext);
  const stats = resolveHistoryStats(input.priorPromptHistory, dailyFrictionBucket, initialTarget);

  let target = initialTarget;
  let fallbackTarget: PhaseJPromptTarget | undefined;
  let suppressionReason: PhaseJClarificationSuppressionReason | undefined;
  let cooldownRemainingSeconds = 0;

  if (!candidate.id || !candidate.athleteUserId) {
    suppressionReason = 'missing_route_context';
  } else if (candidate.expiresAt && candidate.expiresAt <= now) {
    suppressionReason = 'candidate_expired';
  } else if (TERMINAL_STATUSES.has(candidate.status)) {
    suppressionReason = 'candidate_already_terminal';
  } else if (!shouldTreatAsMaterial(candidate, missingContext, input.materiality)) {
    suppressionReason = 'not_material';
  } else if (isFrictionEnforcedForTarget(input.frictionPolicy, target)) {
    const frictionResult = frictionSuppressionReason(input.frictionPolicy, stats, now);
    suppressionReason = frictionResult.reason;
    cooldownRemainingSeconds = frictionResult.cooldownRemainingSeconds;
  }

  if (suppressionReason && input.operatorContext?.fallbackWhenSuppressed && input.operatorContext.enabled) {
    fallbackTarget = 'operator';
    target = 'operator';
    suppressionReason = undefined;
    cooldownRemainingSeconds = 0;
  }

  const prompt = buildPromptPayload(
    input,
    target,
    questionType,
    dailyFrictionBucket,
    suppressionReason ? 'suppressed' : 'pending',
    suppressionReason,
  );

  return {
    target,
    questionType,
    prompt,
    shouldPrompt: !suppressionReason,
    suppressionReason,
    fallbackTarget,
    friction: {
      dailyFrictionBucket,
      dailyPromptCount: stats.dailyPromptCount,
      lastPromptCreatedAt: stats.lastPromptCreatedAt,
      cooldownRemainingSeconds,
    },
  };
};

export const buildPhaseJClarificationProvenance = (
  input: PhaseJClarificationProvenanceInput,
): PhaseJRecordProvenance => {
  const observedAt = roundSeconds(input.observedAt || nowSeconds());
  return stripUndefinedDeep({
    sourceFamily: input.sourceFamily || 'phase_j',
    sourceType: input.sourceType || 'nora_clarification_router',
    sourceRecordIds: input.sourceRecordIds || [],
    adapter: input.adapter,
    observedAt,
    ingestedAt: roundSeconds(input.ingestedAt || nowSeconds()),
    rawRef: input.rawRef,
    confidenceHints: input.confidenceHints || [],
    qualityFlags: input.qualityFlags || [],
  });
};

const confirmationBasisForActor = (
  actorRole: PhaseJActorRole,
  questionType: PhaseJQuestionType,
): PhaseJConfirmationBasis => {
  if (actorRole === 'coach') {
    return questionType === 'coach_intent' || questionType === 'schedule_mismatch'
      ? 'coach_schedule_confirm'
      : 'coach_observation';
  }
  if (actorRole === 'operator') return 'operator_review';
  if (actorRole === 'vendor') return 'vendor_classification';
  if (actorRole === 'system') return 'team_majority_context';
  return 'direct_answer';
};

const dispositionFromAnswer = (answer: string): PhaseJConfirmationDisposition => {
  const normalized = answer.trim().toLowerCase();
  if (!normalized || normalized.includes('not sure')) return 'not_sure';
  if (normalized.includes('dismiss') || normalized.includes('no session') || normalized === 'no') {
    return 'dismissed';
  }
  if (normalized.includes('different') || normalized.includes('modified') || normalized.includes('correct')) {
    return 'corrected';
  }
  return 'confirmed';
};

const confidenceImpactFromDisposition = (
  disposition: PhaseJConfirmationDisposition,
): PhaseJConfidenceTier => {
  if (disposition === 'confirmed' || disposition === 'corrected') return 'confirmed';
  if (disposition === 'not_sure' || disposition === 'needs_review') return 'directional';
  return 'hold_back';
};

const maybeSelectedSessionType = (
  prompt: PhaseJClarificationPrompt,
  explicitSessionType: PhaseJSessionType | undefined,
  answer: string,
): PhaseJSessionType | undefined => {
  if (explicitSessionType) return explicitSessionType;
  if (prompt.questionType !== 'session_type') return undefined;

  const normalized = answer.trim().toLowerCase().replace(/\s+/g, '_');
  const knownTypes: PhaseJSessionType[] = [
    'lift',
    'practice',
    'conditioning',
    'game',
    'recovery',
    'individual_training',
    'walk',
    'run',
    'bike',
    'other',
    'unknown',
  ];
  return knownTypes.find((sessionType) => sessionType === normalized);
};

export const buildPhaseJContextConfirmationEventFromAnswer = (
  input: PhaseJClarificationAnswerInput,
): PhaseJContextConfirmationEvent => {
  const createdAt = roundSeconds(input.createdAt || nowSeconds());
  const answer = requireString(input.answer, 'answer');
  const disposition = input.disposition || dispositionFromAnswer(answer);
  const provenance = input.provenance || buildPhaseJClarificationProvenance({
    observedAt: createdAt,
    sourceRecordIds: [input.prompt.id],
    confidenceHints: [`prompt:${input.prompt.questionType}`, `target:${input.prompt.target}`],
    ...input.provenanceInput,
  });

  return stripUndefinedDeep({
    id: input.id || ['phase-j-context-confirmation', input.prompt.id, createdAt].join(':'),
    candidateId: requireString(input.prompt.candidateId, 'prompt.candidateId'),
    athleteUserId: requireString(input.prompt.athleteUserId, 'prompt.athleteUserId'),
    teamId: nonEmptyString(input.prompt.teamId),
    actor: input.actor,
    disposition,
    confirmationBasis: input.confirmationBasis || confirmationBasisForActor(
      input.actor.actorRole,
      input.prompt.questionType,
    ),
    confidenceImpact: input.confidenceImpact || confidenceImpactFromDisposition(disposition),
    answer,
    selectedSessionType: maybeSelectedSessionType(input.prompt, input.selectedSessionType, answer),
    freeText: nonEmptyString(input.freeText),
    voiceTranscript: nonEmptyString(input.voiceTranscript),
    parsedContext: input.parsedContext,
    promptId: input.prompt.id,
    createdAt,
    expiresAt: isFiniteNumber(input.expiresAt) ? roundSeconds(input.expiresAt) : undefined,
    provenance,
    contractVersion: PHASE_J_SESSION_CONTRACT_VERSION,
  });
};

export const buildPhaseJClarificationPromptPayload = (
  input: PhaseJClarificationRoutingContext,
): PhaseJClarificationPrompt => routePhaseJClarificationPrompt(input).prompt;

export const buildPhaseJClarificationAnswerEvent = buildPhaseJContextConfirmationEventFromAnswer;
