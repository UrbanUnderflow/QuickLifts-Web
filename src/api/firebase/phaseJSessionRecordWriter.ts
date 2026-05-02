// =============================================================================
// Phase J Session Record Writer
//
// Pure payload builder for canonical Phase J session records. This module does
// not import Firebase clients and deliberately returns the hold-back decision to
// the caller instead of writing or mutating storage state.
// =============================================================================

import {
  PHASE_J_ACTOR_PRECEDENCE,
  PHASE_J_SESSION_CONTRACT_VERSION,
  type PhaseJActorRole,
  type PhaseJConfidenceTier,
  type PhaseJContextConfirmationEvent,
  type PhaseJRecordProvenance,
  type PhaseJSessionCandidate,
  type PhaseJSessionRecord,
  type PhaseJSessionType,
} from './phaseJSessionContracts';

export interface PhaseJSessionRecordWriterContext {
  id?: string;
  now?: number;
  sportId?: string;
  contextRefs?: string[];
  loadContribution?: Record<string, unknown>;
  athleteVisibleSummary?: string;
  coachVisibleSummary?: string;
  athleteNote?: string;
  parsedLiftSummary?: Record<string, unknown>;
}

export interface PhaseJSessionTypeDecision {
  sessionType: PhaseJSessionType;
  confidenceTier: PhaseJConfidenceTier;
  source: 'confirmation_event' | 'candidate';
  actorRole: PhaseJActorRole;
  eventId?: string;
  reason: string;
}

export interface PhaseJSessionRecordWriterResult {
  record: PhaseJSessionRecord;
  shouldHoldBack: boolean;
  holdBackReasons: string[];
  sessionTypeDecision: PhaseJSessionTypeDecision;
  contextRefs: string[];
  provenance: PhaseJRecordProvenance;
}

const CONFIDENCE_RANK: Record<PhaseJConfidenceTier, number> = {
  strong_contextual: 5,
  confirmed: 4,
  usable: 3,
  directional: 2,
  hold_back: 1,
};

const DISPOSITION_RANK: Partial<Record<PhaseJContextConfirmationEvent['disposition'], number>> = {
  confirmed: 3,
  corrected: 3,
  needs_review: 1,
  not_sure: 0,
  dismissed: -1,
};

const nowSeconds = (): number => Math.round(Date.now() / 1000);

const roundSeconds = (value: number): number => Math.round(value);

const nonEmptyString = (value: unknown): string | undefined => {
  const normalized = typeof value === 'string' ? value.trim() : '';
  return normalized || undefined;
};

const requireString = (value: unknown, label: string): string => {
  const normalized = nonEmptyString(value);
  if (!normalized) {
    throw new Error(`[PhaseJSessionRecordWriter] ${label} is required.`);
  }
  return normalized;
};

const unique = (values: string[]): string[] => Array.from(new Set(values.filter(Boolean)));

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

const asRecord = (value: unknown): Record<string, unknown> | undefined =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;

const recordValue = (record: Record<string, unknown> | undefined, key: string): unknown =>
  record?.[key];

const stringFromContext = (
  events: PhaseJContextConfirmationEvent[],
  keys: string[],
): string | undefined => {
  for (const event of [...events].sort((a, b) => b.createdAt - a.createdAt)) {
    const parsedContext = asRecord(event.parsedContext);
    for (const key of keys) {
      const parsedValue = nonEmptyString(recordValue(parsedContext, key));
      if (parsedValue) return parsedValue;
    }
    const freeText = nonEmptyString(event.freeText);
    if (keys.includes('athleteNote') && freeText) return freeText;
  }
  return undefined;
};

const parsedLiftSummaryFromEvents = (
  events: PhaseJContextConfirmationEvent[],
): Record<string, unknown> | undefined => {
  for (const event of [...events].sort((a, b) => b.createdAt - a.createdAt)) {
    const parsedContext = asRecord(event.parsedContext);
    const parsedLiftSummary = asRecord(recordValue(parsedContext, 'parsedLiftSummary'));
    if (parsedLiftSummary) return parsedLiftSummary;
  }
  return undefined;
};

const actorRank = (role: PhaseJActorRole): number => {
  const rank = PHASE_J_ACTOR_PRECEDENCE.indexOf(role);
  return rank === -1 ? PHASE_J_ACTOR_PRECEDENCE.length : rank;
};

const candidateFallbackSessionType = (candidate: PhaseJSessionCandidate): PhaseJSessionType =>
  candidate.candidateKinds.find((kind) => kind !== 'unknown') || candidate.candidateKinds[0] || 'unknown';

const chooseSessionType = (
  candidate: PhaseJSessionCandidate,
  events: PhaseJContextConfirmationEvent[],
): PhaseJSessionTypeDecision => {
  const confirmingEvents = events
    .filter((event) => {
      if (!event.selectedSessionType) return false;
      return event.disposition === 'confirmed' || event.disposition === 'corrected';
    })
    .sort((a, b) => {
      const actorDelta = actorRank(a.actor.actorRole) - actorRank(b.actor.actorRole);
      if (actorDelta !== 0) return actorDelta;
      const confidenceDelta = CONFIDENCE_RANK[b.confidenceImpact] - CONFIDENCE_RANK[a.confidenceImpact];
      if (confidenceDelta !== 0) return confidenceDelta;
      const dispositionDelta = (DISPOSITION_RANK[b.disposition] || 0) - (DISPOSITION_RANK[a.disposition] || 0);
      if (dispositionDelta !== 0) return dispositionDelta;
      return b.createdAt - a.createdAt;
    });

  const selectedEvent = confirmingEvents[0];
  if (selectedEvent?.selectedSessionType) {
    return {
      sessionType: selectedEvent.selectedSessionType,
      confidenceTier: selectedEvent.confidenceImpact,
      source: 'confirmation_event',
      actorRole: selectedEvent.actor.actorRole,
      eventId: selectedEvent.id,
      reason: `${selectedEvent.actor.actorRole} ${selectedEvent.disposition} via ${selectedEvent.confirmationBasis}.`,
    };
  }

  return {
    sessionType: candidateFallbackSessionType(candidate),
    confidenceTier: candidate.confidenceTier,
    source: 'candidate',
    actorRole: 'system',
    reason: 'No higher-precedence confirmation event selected a final session type.',
  };
};

const mergeProvenance = (
  candidate: PhaseJSessionCandidate,
  events: PhaseJContextConfirmationEvent[],
  decision: PhaseJSessionTypeDecision,
): PhaseJRecordProvenance => ({
  ...candidate.provenance,
  sourceRecordIds: unique([
    ...candidate.provenance.sourceRecordIds,
    candidate.id,
    ...candidate.evidenceRefs,
    ...events.map((event) => event.id),
    ...events.flatMap((event) => event.provenance.sourceRecordIds),
  ]),
  observedAt: Math.min(
    candidate.provenance.observedAt,
    candidate.detectedStartAt,
    ...events.map((event) => event.provenance.observedAt),
  ),
  ingestedAt: Math.max(
    candidate.provenance.ingestedAt,
    ...events.map((event) => event.provenance.ingestedAt),
  ),
  confidenceHints: unique([
    ...candidate.provenance.confidenceHints,
    `record_session_type:${decision.sessionType}`,
    `record_decision_source:${decision.source}`,
    `record_decision_actor:${decision.actorRole}`,
    ...events.flatMap((event) => event.provenance.confidenceHints),
  ]),
  qualityFlags: unique([
    ...candidate.provenance.qualityFlags,
    ...events.flatMap((event) => event.provenance.qualityFlags),
  ]),
});

const collectContextRefs = (
  candidate: PhaseJSessionCandidate,
  events: PhaseJContextConfirmationEvent[],
  extraRefs: string[] = [],
): string[] => unique([
  ...extraRefs,
  ...candidate.evidenceRefs,
  candidate.scheduleEventId || '',
  candidate.prescribedSessionId || '',
  candidate.latestPromptId || '',
  ...events.map((event) => event.promptId || ''),
  ...events.map((event) => event.provenance.rawRef || ''),
]);

const holdBackReasons = (
  candidate: PhaseJSessionCandidate,
  events: PhaseJContextConfirmationEvent[],
  decision: PhaseJSessionTypeDecision,
): string[] => {
  const reasons: string[] = [];
  if (candidate.status === 'held_back') reasons.push('candidate_status_held_back');
  if (candidate.status === 'dismissed') reasons.push('candidate_status_dismissed');
  if (candidate.status === 'expired') reasons.push('candidate_status_expired');
  if (candidate.confidenceTier === 'hold_back') reasons.push('candidate_confidence_hold_back');
  if (decision.confidenceTier === 'hold_back') reasons.push('decision_confidence_hold_back');
  if (decision.sessionType === 'unknown') reasons.push('session_type_unknown');
  if (candidate.missingContext.length > 0 && decision.source === 'candidate') {
    reasons.push('missing_context_without_confirmation');
  }
  if (events.some((event) => event.disposition === 'dismissed')) {
    reasons.push('confirmation_event_dismissed');
  }
  if (events.some((event) => event.disposition === 'needs_review')) {
    reasons.push('confirmation_event_needs_review');
  }
  return unique(reasons);
};

const summaryFallback = (
  candidate: PhaseJSessionCandidate,
  decision: PhaseJSessionTypeDecision,
): string => {
  const durationMin = Math.max(1, Math.round((candidate.detectedEndAt - candidate.detectedStartAt) / 60));
  return `${decision.sessionType} session detected for ${durationMin} min.`;
};

export const buildPhaseJSessionRecordPayload = (
  candidate: PhaseJSessionCandidate,
  confirmationEvents: PhaseJContextConfirmationEvent[] = [],
  context: PhaseJSessionRecordWriterContext = {},
): PhaseJSessionRecordWriterResult => {
  const events = confirmationEvents
    .filter((event) => event.candidateId === candidate.id)
    .sort((a, b) => a.createdAt - b.createdAt);
  const decision = chooseSessionType(candidate, events);
  const createdAt = roundSeconds(context.now || nowSeconds());
  const updatedAt = createdAt;
  const contextRefs = collectContextRefs(candidate, events, context.contextRefs);
  const provenance = mergeProvenance(candidate, events, decision);
  const parsedLiftSummary = context.parsedLiftSummary || parsedLiftSummaryFromEvents(events);
  const athleteNote = nonEmptyString(context.athleteNote) ||
    stringFromContext(events, ['athleteNote', 'athleteVisibleNote']);
  const athleteVisibleSummary = nonEmptyString(context.athleteVisibleSummary) ||
    stringFromContext(events, ['athleteVisibleSummary', 'summary', 'athleteVisibleNote']) ||
    athleteNote ||
    summaryFallback(candidate, decision);
  const coachVisibleSummary = nonEmptyString(context.coachVisibleSummary) ||
    stringFromContext(events, ['coachVisibleSummary', 'coachSummary']);
  const confirmationEventIds = unique([
    ...candidate.confirmationEventIds,
    ...events.map((event) => event.id),
  ]);

  const record: PhaseJSessionRecord = stripUndefinedDeep({
    id: requireString(context.id || `phaseJSessionRecord:${candidate.id}`, 'id'),
    athleteUserId: requireString(candidate.athleteUserId, 'athleteUserId'),
    teamId: nonEmptyString(candidate.teamId),
    sportId: requireString(context.sportId || candidate.sportId || decision.sessionType, 'sportId'),
    sessionType: decision.sessionType,
    startAt: roundSeconds(candidate.detectedStartAt),
    endAt: roundSeconds(candidate.detectedEndAt),
    timezone: requireString(candidate.timezone || candidate.primitiveSnapshot.timezone, 'timezone'),
    candidateId: candidate.id,
    primitiveSnapshot: candidate.primitiveSnapshot,
    contextRefs,
    confirmationEventIds,
    scheduleEventId: nonEmptyString(candidate.scheduleEventId),
    prescribedSessionId: nonEmptyString(candidate.prescribedSessionId),
    confidenceTier: decision.confidenceTier,
    loadContribution: context.loadContribution,
    athleteVisibleSummary,
    coachVisibleSummary,
    athleteNote,
    parsedLiftSummary,
    provenance,
    contractVersion: PHASE_J_SESSION_CONTRACT_VERSION,
    createdAt,
    updatedAt,
  });
  const reasons = holdBackReasons(candidate, events, decision);

  return {
    record,
    shouldHoldBack: reasons.length > 0,
    holdBackReasons: reasons,
    sessionTypeDecision: decision,
    contextRefs,
    provenance,
  };
};

export const buildPhaseJSessionRecord = buildPhaseJSessionRecordPayload;
