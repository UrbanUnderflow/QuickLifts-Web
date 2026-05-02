// =============================================================================
// Phase J Lift Session Helpers
//
// Pure payload builders for lift session candidates, confirmation events, and
// canonical session records. These helpers do not write to Firestore.
// =============================================================================

import {
  PHASE_J_SESSION_CONTRACT_VERSION,
  type PhaseJActorRef,
  type PhaseJCandidateStatus,
  type PhaseJConfidenceTier,
  type PhaseJConfirmationBasis,
  type PhaseJConfirmationDisposition,
  type PhaseJContextConfirmationEvent,
  type PhaseJPrimitiveSnapshot,
  type PhaseJRecordProvenance,
  type PhaseJSessionCandidate,
  type PhaseJSessionRecord,
} from './phaseJSessionContracts';

export type PhaseJLiftWeightUnit = 'lb' | 'kg' | 'bodyweight' | 'unknown';

export interface PhaseJLiftSetInput {
  setIndex?: number;
  reps?: number;
  weight?: number;
  weightUnit?: PhaseJLiftWeightUnit;
  rpe?: number;
  completed?: boolean;
}

export interface PhaseJLiftExerciseInput {
  name: string;
  sets: PhaseJLiftSetInput[];
  bodyAreas?: string[];
  notes?: string;
}

export interface PhaseJParsedLiftSet {
  setIndex: number;
  reps?: number;
  weight?: number;
  weightUnit?: PhaseJLiftWeightUnit;
  rpe?: number;
  completed?: boolean;
}

export interface PhaseJParsedLiftExercise {
  name: string;
  sets: PhaseJParsedLiftSet[];
  bodyAreas?: string[];
  notes?: string;
}

export interface PhaseJParsedLiftSummary {
  sessionType: 'lift';
  exercises: PhaseJParsedLiftExercise[];
  totalExercises: number;
  totalSets: number;
  totalReps?: number;
  weightUnit?: PhaseJLiftWeightUnit;
  averageRpe?: number;
  peakRpe?: number;
  athleteVisibleNote?: string;
  freeText?: string;
}

export interface PhaseJLiftProvenanceInput {
  sourceFamily?: string;
  sourceType?: string;
  sourceRecordIds?: string[];
  adapter?: string;
  observedAt: number;
  ingestedAt?: number;
  rawRef?: string;
  confidenceHints?: string[];
  qualityFlags?: string[];
}

export interface BuildPhaseJLiftSessionCandidateInput {
  id: string;
  athleteUserId: string;
  teamId?: string;
  sportId?: string;
  primitiveSnapshot: PhaseJPrimitiveSnapshot;
  provenance?: PhaseJRecordProvenance;
  provenanceInput?: PhaseJLiftProvenanceInput;
  confidenceTier?: PhaseJConfidenceTier;
  confidenceScore?: number;
  status?: PhaseJCandidateStatus;
  missingContext?: string[];
  evidenceRefs?: string[];
  scheduleEventId?: string;
  prescribedSessionId?: string;
  latestPromptId?: string;
  confirmationEventIds?: string[];
  createdAt?: number;
  updatedAt?: number;
  expiresAt?: number;
}

export interface BuildPhaseJLiftConfirmationEventInput {
  id: string;
  candidateId: string;
  athleteUserId: string;
  teamId?: string;
  actor: PhaseJActorRef;
  answer?: string;
  freeText?: string;
  voiceTranscript?: string;
  promptId?: string;
  parsedLiftSummary?: PhaseJParsedLiftSummary;
  athleteVisibleNote?: string;
  disposition?: PhaseJConfirmationDisposition;
  confirmationBasis?: PhaseJConfirmationBasis;
  confidenceImpact?: PhaseJConfidenceTier;
  createdAt?: number;
  expiresAt?: number;
  provenance?: PhaseJRecordProvenance;
  provenanceInput?: PhaseJLiftProvenanceInput;
}

export interface BuildPhaseJLiftSessionRecordInput {
  id: string;
  candidate?: PhaseJSessionCandidate;
  athleteUserId?: string;
  teamId?: string;
  sportId?: string;
  startAt?: number;
  endAt?: number;
  timezone?: string;
  candidateId?: string;
  primitiveSnapshot?: PhaseJPrimitiveSnapshot;
  contextRefs?: string[];
  confirmationEventIds?: string[];
  scheduleEventId?: string;
  prescribedSessionId?: string;
  confidenceTier?: PhaseJConfidenceTier;
  loadContribution?: Record<string, unknown>;
  athleteVisibleSummary?: string;
  coachVisibleSummary?: string;
  athleteNote?: string;
  parsedLiftSummary?: PhaseJParsedLiftSummary;
  provenance?: PhaseJRecordProvenance;
  provenanceInput?: PhaseJLiftProvenanceInput;
  createdAt?: number;
  updatedAt?: number;
}

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const nowSeconds = (): number => Math.round(Date.now() / 1000);

const requireString = (value: unknown, label: string): string => {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized) {
    throw new Error(`[PhaseJLiftSession] ${label} is required.`);
  }
  return normalized;
};

const nonEmptyString = (value: unknown): string | undefined => {
  const normalized = typeof value === 'string' ? value.trim() : '';
  return normalized || undefined;
};

const positiveNumber = (value: unknown): number | undefined =>
  isFiniteNumber(value) && value >= 0 ? value : undefined;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const roundTo = (value: number, decimals = 2): number => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
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

const toRecord = (value: unknown): Record<string, unknown> =>
  stripUndefinedDeep(value || {}) as Record<string, unknown>;

export const buildPhaseJLiftProvenance = (
  input: PhaseJLiftProvenanceInput,
): PhaseJRecordProvenance => ({
  sourceFamily: input.sourceFamily || 'phase_j',
  sourceType: input.sourceType || 'lift_session_helper',
  sourceRecordIds: input.sourceRecordIds || [],
  adapter: input.adapter,
  observedAt: Math.round(input.observedAt),
  ingestedAt: Math.round(input.ingestedAt || nowSeconds()),
  rawRef: input.rawRef,
  confidenceHints: input.confidenceHints || [],
  qualityFlags: input.qualityFlags || [],
});

const resolveProvenance = (
  provenance: PhaseJRecordProvenance | undefined,
  provenanceInput: PhaseJLiftProvenanceInput | undefined,
  observedAt: number,
): PhaseJRecordProvenance =>
  provenance || buildPhaseJLiftProvenance({ observedAt, ...provenanceInput });

export const buildPhaseJParsedLiftSummary = (
  exercises: PhaseJLiftExerciseInput[],
  options: { athleteVisibleNote?: string; freeText?: string } = {},
): PhaseJParsedLiftSummary => {
  const parsedExercises = exercises
    .map((exercise) => {
      const name = nonEmptyString(exercise.name);
      if (!name) return undefined;

      const sets = (exercise.sets || [])
        .map((set, index) => {
          const setIndex = positiveNumber(set.setIndex) !== undefined
            ? Math.max(1, Math.round(set.setIndex as number))
            : index + 1;
          const reps = positiveNumber(set.reps) !== undefined ? Math.round(set.reps as number) : undefined;
          const weight = positiveNumber(set.weight) !== undefined ? roundTo(set.weight as number, 2) : undefined;
          const rpe = positiveNumber(set.rpe) !== undefined ? roundTo(clamp(set.rpe as number, 0, 10), 1) : undefined;

          return stripUndefinedDeep({
            setIndex,
            reps,
            weight,
            weightUnit: set.weightUnit,
            rpe,
            completed: set.completed,
          }) as PhaseJParsedLiftSet;
        });

      return stripUndefinedDeep({
        name,
        sets,
        bodyAreas: exercise.bodyAreas?.filter(Boolean),
        notes: nonEmptyString(exercise.notes),
      }) as PhaseJParsedLiftExercise;
    })
    .filter((exercise): exercise is PhaseJParsedLiftExercise => Boolean(exercise));

  const allSets = parsedExercises.flatMap((exercise) => exercise.sets);
  const reps = allSets
    .map((set) => set.reps)
    .filter((value): value is number => value !== undefined);
  const rpes = allSets
    .map((set) => set.rpe)
    .filter((value): value is number => value !== undefined);
  const weightUnit = allSets.find((set) => set.weightUnit)?.weightUnit;

  const summary: PhaseJParsedLiftSummary = {
    sessionType: 'lift',
    exercises: parsedExercises,
    totalExercises: parsedExercises.length,
    totalSets: allSets.length,
    totalReps: reps.length > 0 ? reps.reduce((sum, value) => sum + value, 0) : undefined,
    weightUnit,
    averageRpe: rpes.length > 0 ? roundTo(rpes.reduce((sum, value) => sum + value, 0) / rpes.length, 1) : undefined,
    peakRpe: rpes.length > 0 ? Math.max(...rpes) : undefined,
    athleteVisibleNote: nonEmptyString(options.athleteVisibleNote),
    freeText: nonEmptyString(options.freeText),
  };

  return stripUndefinedDeep(summary);
};

const summarizeExerciseForNote = (exercise: PhaseJParsedLiftExercise): string => {
  const completedSets = exercise.sets.filter((set) => set.completed !== false);
  const reps = completedSets.map((set) => set.reps).filter((value): value is number => value !== undefined);
  const weights = completedSets.map((set) => set.weight).filter((value): value is number => value !== undefined);
  const weightUnit = completedSets.find((set) => set.weightUnit)?.weightUnit;
  const setCount = completedSets.length || exercise.sets.length;

  const repPart = reps.length > 0 && reps.every((rep) => rep === reps[0])
    ? `${setCount}x${reps[0]}`
    : `${setCount} sets`;
  const weightPart = weights.length > 0
    ? ` @ ${Math.max(...weights)} ${weightUnit && weightUnit !== 'unknown' ? weightUnit : ''}`.trimEnd()
    : '';

  return `${exercise.name} ${repPart}${weightPart}`;
};

export const buildPhaseJLiftAthleteVisibleNote = (
  summary?: PhaseJParsedLiftSummary,
  fallbackNote?: string,
): string | undefined => {
  const explicitNote = nonEmptyString(summary?.athleteVisibleNote) || nonEmptyString(fallbackNote);
  if (explicitNote) return explicitNote;
  if (!summary || summary.exercises.length === 0) return undefined;

  const exerciseSummary = summary.exercises.slice(0, 3).map(summarizeExerciseForNote).join(', ');
  const rpePart = summary.peakRpe !== undefined ? ` Peak RPE ${summary.peakRpe}.` : '';
  return `Lift logged: ${exerciseSummary}.${rpePart}`;
};

const inferMissingLiftContext = (
  primitiveSnapshot: PhaseJPrimitiveSnapshot,
  providedMissingContext: string[] = [],
  parsedLiftSummary?: PhaseJParsedLiftSummary,
): string[] => {
  const missing = [...providedMissingContext];
  if (!parsedLiftSummary || parsedLiftSummary.exercises.length === 0) {
    missing.push('lift_summary');
  }
  if (!parsedLiftSummary?.peakRpe && !parsedLiftSummary?.averageRpe) {
    missing.push('rpe');
  }
  if (primitiveSnapshot.missingData.includes('heart_rate')) {
    missing.push('heart_rate');
  }
  if (primitiveSnapshot.missingData.includes('device_coverage')) {
    missing.push('device_coverage');
  }
  return unique(missing);
};

export const buildPhaseJLiftSessionCandidate = (
  input: BuildPhaseJLiftSessionCandidateInput & { parsedLiftSummary?: PhaseJParsedLiftSummary },
): PhaseJSessionCandidate => {
  const createdAt = Math.round(input.createdAt || nowSeconds());
  const updatedAt = Math.round(input.updatedAt || createdAt);
  const provenance = resolveProvenance(
    input.provenance,
    input.provenanceInput,
    input.primitiveSnapshot.detectedStartAt,
  );

  return stripUndefinedDeep({
    id: requireString(input.id, 'id'),
    athleteUserId: requireString(input.athleteUserId, 'athleteUserId'),
    teamId: nonEmptyString(input.teamId),
    sportId: nonEmptyString(input.sportId),
    candidateKinds: ['lift'],
    status: input.status || 'detected',
    confidenceTier: input.confidenceTier || 'directional',
    confidenceScore: positiveNumber(input.confidenceScore),
    detectedStartAt: input.primitiveSnapshot.detectedStartAt,
    detectedEndAt: input.primitiveSnapshot.detectedEndAt,
    timezone: input.primitiveSnapshot.timezone,
    primitiveSnapshot: input.primitiveSnapshot,
    missingContext: inferMissingLiftContext(
      input.primitiveSnapshot,
      input.missingContext,
      input.parsedLiftSummary,
    ),
    evidenceRefs: input.evidenceRefs || provenance.sourceRecordIds,
    scheduleEventId: nonEmptyString(input.scheduleEventId),
    prescribedSessionId: nonEmptyString(input.prescribedSessionId),
    latestPromptId: nonEmptyString(input.latestPromptId),
    confirmationEventIds: input.confirmationEventIds || [],
    provenance,
    contractVersion: PHASE_J_SESSION_CONTRACT_VERSION,
    createdAt,
    updatedAt,
    expiresAt: positiveNumber(input.expiresAt),
  });
};

export const buildPhaseJLiftConfirmationEventPayload = (
  input: BuildPhaseJLiftConfirmationEventInput,
): PhaseJContextConfirmationEvent => {
  const createdAt = Math.round(input.createdAt || nowSeconds());
  const athleteVisibleNote = buildPhaseJLiftAthleteVisibleNote(
    input.parsedLiftSummary,
    input.athleteVisibleNote,
  );
  const provenance = resolveProvenance(input.provenance, input.provenanceInput, createdAt);

  return stripUndefinedDeep({
    id: requireString(input.id, 'id'),
    candidateId: requireString(input.candidateId, 'candidateId'),
    athleteUserId: requireString(input.athleteUserId, 'athleteUserId'),
    teamId: nonEmptyString(input.teamId),
    actor: input.actor,
    disposition: input.disposition || 'confirmed',
    confirmationBasis: input.confirmationBasis || 'direct_answer',
    confidenceImpact: input.confidenceImpact || 'confirmed',
    answer: input.answer || athleteVisibleNote || 'Confirmed lift session.',
    selectedSessionType: 'lift',
    freeText: nonEmptyString(input.freeText),
    voiceTranscript: nonEmptyString(input.voiceTranscript),
    parsedContext: toRecord({
      sessionType: 'lift',
      parsedLiftSummary: input.parsedLiftSummary,
      athleteVisibleNote,
    }),
    promptId: nonEmptyString(input.promptId),
    createdAt,
    expiresAt: positiveNumber(input.expiresAt),
    provenance,
    contractVersion: PHASE_J_SESSION_CONTRACT_VERSION,
  });
};

export const buildPhaseJLiftSessionRecordPayload = (
  input: BuildPhaseJLiftSessionRecordInput,
): PhaseJSessionRecord => {
  const candidate = input.candidate;
  const primitiveSnapshot = input.primitiveSnapshot || candidate?.primitiveSnapshot;
  if (!primitiveSnapshot) {
    throw new Error('[PhaseJLiftSession] primitiveSnapshot is required.');
  }

  const createdAt = Math.round(input.createdAt || nowSeconds());
  const updatedAt = Math.round(input.updatedAt || createdAt);
  const candidateId = requireString(input.candidateId || candidate?.id, 'candidateId');
  const parsedLiftSummary = input.parsedLiftSummary;
  const athleteNote = buildPhaseJLiftAthleteVisibleNote(parsedLiftSummary, input.athleteNote);
  const provenance = resolveProvenance(
    input.provenance || candidate?.provenance,
    input.provenanceInput,
    primitiveSnapshot.detectedStartAt,
  );

  return stripUndefinedDeep({
    id: requireString(input.id, 'id'),
    athleteUserId: requireString(input.athleteUserId || candidate?.athleteUserId, 'athleteUserId'),
    teamId: nonEmptyString(input.teamId || candidate?.teamId),
    sportId: requireString(input.sportId || candidate?.sportId || 'strength_training', 'sportId'),
    sessionType: 'lift',
    startAt: Math.round(input.startAt || candidate?.detectedStartAt || primitiveSnapshot.detectedStartAt),
    endAt: Math.round(input.endAt || candidate?.detectedEndAt || primitiveSnapshot.detectedEndAt),
    timezone: requireString(input.timezone || candidate?.timezone || primitiveSnapshot.timezone, 'timezone'),
    candidateId,
    primitiveSnapshot,
    contextRefs: input.contextRefs || [],
    confirmationEventIds: input.confirmationEventIds || candidate?.confirmationEventIds || [],
    scheduleEventId: nonEmptyString(input.scheduleEventId || candidate?.scheduleEventId),
    prescribedSessionId: nonEmptyString(input.prescribedSessionId || candidate?.prescribedSessionId),
    confidenceTier: input.confidenceTier || candidate?.confidenceTier || 'confirmed',
    loadContribution: input.loadContribution,
    athleteVisibleSummary: nonEmptyString(input.athleteVisibleSummary) || athleteNote,
    coachVisibleSummary: nonEmptyString(input.coachVisibleSummary),
    athleteNote,
    parsedLiftSummary: parsedLiftSummary ? toRecord(parsedLiftSummary) : undefined,
    provenance,
    contractVersion: PHASE_J_SESSION_CONTRACT_VERSION,
    createdAt,
    updatedAt,
  });
};

export const buildPhaseJLiftConfirmationEvent = buildPhaseJLiftConfirmationEventPayload;
export const buildPhaseJLiftSessionRecord = buildPhaseJLiftSessionRecordPayload;
