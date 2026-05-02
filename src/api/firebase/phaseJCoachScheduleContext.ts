// =============================================================================
// Phase J Coach Schedule + Context Helpers
//
// Pure TypeScript foundation for the coach-context side of Phase J. These
// helpers model schedule, prescribed-session, and coach-observation payloads,
// match device-derived candidates to coach context, and build confirmation
// event payloads. They intentionally do not write to Firebase.
// =============================================================================

import {
  PHASE_J_SESSION_CONTRACT_VERSION,
  type PhaseJActorRef,
  type PhaseJConfidenceTier,
  type PhaseJConfirmationBasis,
  type PhaseJContextConfirmationEvent,
  type PhaseJRecordProvenance,
  type PhaseJSessionCandidate,
  type PhaseJSessionType,
} from './phaseJSessionContracts';

export type PhaseJCoachScheduleSource =
  | 'upload'
  | 'voice'
  | 'calendar_sync'
  | 'email_forward'
  | 'whiteboard_photo'
  | 'manual'
  | 'system';

export type PhaseJCoachScheduleEventKind =
  | 'practice'
  | 'lift'
  | 'game'
  | 'competition'
  | 'film'
  | 'travel'
  | 'recovery'
  | 'other';

export type PhaseJCoachScheduleRecurrenceFrequency = 'none' | 'daily' | 'weekly';

export type PhaseJCoachScheduleWindowKind = 'single' | 'recurring_practice' | 'recurring_lift' | 'recurring_game';

export interface PhaseJCoachScheduleRecurrenceException {
  occurrenceStartAt: number;
  cancelled?: boolean;
  movedStartAt?: number;
  movedEndAt?: number;
  reason?: string;
}

export interface PhaseJCoachScheduleRecurrence {
  frequency: PhaseJCoachScheduleRecurrenceFrequency;
  interval?: number;
  /**
   * UTC day numbers, Sunday = 0. This keeps the helper dependency-free; callers
   * that need local-time expansion should pre-materialize event occurrences.
   */
  daysOfWeek?: number[];
  startsAt?: number;
  untilAt?: number;
  maxOccurrences?: number;
  exceptions?: PhaseJCoachScheduleRecurrenceException[];
}

export interface PhaseJCoachScheduleEvent {
  id: string;
  teamId: string;
  sportId?: string;
  kind: PhaseJCoachScheduleEventKind;
  startsAt: number;
  endsAt: number;
  timezone: string;
  title?: string;
  location?: string;
  venueLat?: number;
  venueLng?: number;
  opponent?: string;
  athleteUserIds?: string[];
  source: PhaseJCoachScheduleSource;
  sourceFreshness?: 'fresh' | 'recent' | 'stale' | 'historical';
  parserConfidence?: number;
  recurrence?: PhaseJCoachScheduleRecurrence;
  createdAt?: number;
  updatedAt?: number;
}

export type PhaseJPrescribedSessionSource =
  | 'pdf_upload'
  | 'voice'
  | 'whiteboard_photo'
  | 'calendar_sync'
  | 'manual'
  | 'system';

export type PhaseJPrescribedBlockKind =
  | 'warmup'
  | 'skill'
  | 'conditioning'
  | 'lift'
  | 'interval'
  | 'scrimmage'
  | 'game_plan'
  | 'recovery'
  | 'other';

export interface PhaseJPrescribedSessionBlock {
  id?: string;
  kind: PhaseJPrescribedBlockKind;
  target?: string;
  count?: number;
  intensity?: string;
  restSec?: number;
  durationSec?: number;
  distanceMeters?: number;
  notes?: string;
}

export interface PhaseJPrescribedSession {
  id: string;
  teamId: string;
  sportId?: string;
  scheduleEventId?: string;
  athleteUserId?: string;
  athleteUserIds?: string[];
  sessionType?: PhaseJSessionType;
  startsAt?: number;
  endsAt?: number;
  timezone?: string;
  blocks: PhaseJPrescribedSessionBlock[];
  source: PhaseJPrescribedSessionSource;
  parserConfidence?: number;
  recurrence?: PhaseJCoachScheduleRecurrence;
  createdAt?: number;
  updatedAt?: number;
}

export type PhaseJCoachObservationSource = 'voice' | 'text' | 'manual' | 'system';

export type PhaseJCoachTempoFlag =
  | 'lighter_than_usual'
  | 'normal'
  | 'harder_than_usual'
  | 'sluggish'
  | 'sharp'
  | 'mixed'
  | 'unknown';

export interface PhaseJCoachObservationAthleteFlag {
  athleteUserId?: string;
  displayName?: string;
  aliasUsed?: string;
  flag: string;
  severity?: 'low' | 'medium' | 'high';
}

export interface PhaseJCoachObservationExtracted {
  athleteFlags: PhaseJCoachObservationAthleteFlag[];
  topicTags: string[];
  tempoFlag?: PhaseJCoachTempoFlag;
  freeText?: string;
}

export interface PhaseJCoachObservation {
  id: string;
  teamId: string;
  coachUserId: string;
  recordedAt: number;
  source: PhaseJCoachObservationSource;
  transcript?: string;
  voiceMemoUrl?: string;
  scheduleEventId?: string;
  prescribedSessionId?: string;
  athleteUserIds?: string[];
  extracted: PhaseJCoachObservationExtracted;
  createdAt?: number;
}

export interface PhaseJCoachContextBundle {
  scheduleEvents: PhaseJCoachScheduleEvent[];
  prescribedSessions: PhaseJPrescribedSession[];
  coachObservations?: PhaseJCoachObservation[];
}

export interface PhaseJCoachScheduleOccurrenceWindow {
  scheduleEventId: string;
  occurrenceKey: string;
  kind: PhaseJCoachScheduleEventKind;
  sessionType?: PhaseJSessionType;
  windowKind: PhaseJCoachScheduleWindowKind;
  startsAt: number;
  endsAt: number;
  matchStartsAt: number;
  matchEndsAt: number;
  timezone: string;
  isRecurring: boolean;
  sourceEventStartsAt: number;
  sourceEventEndsAt: number;
}

export interface PhaseJCoachScheduleMatch {
  event: PhaseJCoachScheduleEvent;
  occurrence: PhaseJCoachScheduleOccurrenceWindow;
  overlapSec: number;
  overlapPctOfCandidate: number;
  overlapPctOfEvent: number;
  startDeltaSec: number;
  score: number;
  confidenceTier: PhaseJConfidenceTier;
  reasons: string[];
}

export interface PhaseJPrescribedSessionMatch {
  prescribedSession: PhaseJPrescribedSession;
  scheduleMatch?: PhaseJCoachScheduleMatch;
  overlapSec: number;
  overlapPctOfCandidate?: number;
  score: number;
  confidenceTier: PhaseJConfidenceTier;
  reasons: string[];
}

export interface PhaseJCoachScheduleMatchOptions {
  preWindowSec?: number;
  postWindowSec?: number;
  searchPaddingSec?: number;
  minScore?: number;
  minOverlapPct?: number;
}

export interface PhaseJPrescribedSessionMatchOptions extends PhaseJCoachScheduleMatchOptions {
  scheduleMatch?: PhaseJCoachScheduleMatch;
}

export interface BuildCoachContextConfirmationEventInput {
  id: string;
  candidate: PhaseJSessionCandidate;
  actor: PhaseJActorRef;
  scheduleMatch?: PhaseJCoachScheduleMatch;
  prescribedSessionMatch?: PhaseJPrescribedSessionMatch;
  coachObservations?: PhaseJCoachObservation[];
  answer?: string;
  freeText?: string;
  voiceTranscript?: string;
  promptId?: string;
  confirmationBasis?: PhaseJConfirmationBasis;
  confidenceImpact?: PhaseJConfidenceTier;
  createdAt?: number;
  expiresAt?: number;
  provenance?: PhaseJRecordProvenance;
  provenanceInput?: PhaseJCoachContextProvenanceInput;
}

export interface PhaseJCoachContextProvenanceInput {
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

export interface PhaseJCoachContextCandidateSummary {
  candidateId: string;
  selectedSessionType?: PhaseJSessionType;
  scheduleEventId?: string;
  scheduleOccurrenceKey?: string;
  prescribedSessionId?: string;
  confidenceTier: PhaseJConfidenceTier;
  missingContext: string[];
  coachVoiceSummary: string;
  scheduleMatch?: Pick<
    PhaseJCoachScheduleMatch,
    'overlapSec' | 'overlapPctOfCandidate' | 'startDeltaSec' | 'score' | 'confidenceTier' | 'reasons'
  >;
  prescribedSessionMatch?: Pick<
    PhaseJPrescribedSessionMatch,
    'overlapSec' | 'overlapPctOfCandidate' | 'score' | 'confidenceTier' | 'reasons'
  >;
  coachObservationIds: string[];
}

const DEFAULT_PRE_WINDOW_SEC = 30 * 60;
const DEFAULT_POST_WINDOW_SEC = 30 * 60;
const DEFAULT_SEARCH_PADDING_SEC = 8 * 24 * 60 * 60;
const SECONDS_PER_DAY = 24 * 60 * 60;
const SECONDS_PER_WEEK = 7 * SECONDS_PER_DAY;

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const nowSeconds = (): number => Math.round(Date.now() / 1000);

const requireString = (value: unknown, label: string): string => {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized) {
    throw new Error(`[PhaseJCoachScheduleContext] ${label} is required.`);
  }
  return normalized;
};

const nonEmptyString = (value: unknown): string | undefined => {
  const normalized = typeof value === 'string' ? value.trim() : '';
  return normalized || undefined;
};

const positiveNumber = (value: unknown): number | undefined =>
  isFiniteNumber(value) && value >= 0 ? Math.round(value) : undefined;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const roundTo = (value: number, decimals = 3): number => {
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

const durationSec = (startAt: number, endAt: number): number => Math.max(0, endAt - startAt);

const overlapSec = (aStart: number, aEnd: number, bStart: number, bEnd: number): number =>
  Math.max(0, Math.min(aEnd, bEnd) - Math.max(aStart, bStart));

const floorToUtcDay = (timestamp: number): number =>
  Math.floor(timestamp / SECONDS_PER_DAY) * SECONDS_PER_DAY;

const secondsIntoUtcDay = (timestamp: number): number =>
  ((Math.round(timestamp) % SECONDS_PER_DAY) + SECONDS_PER_DAY) % SECONDS_PER_DAY;

const utcDayOfWeek = (timestamp: number): number =>
  new Date(Math.round(timestamp) * 1000).getUTCDay();

const normalizeInterval = (value: unknown): number =>
  isFiniteNumber(value) && value > 0 ? Math.max(1, Math.round(value)) : 1;

const scheduleKindToSessionType = (kind: PhaseJCoachScheduleEventKind): PhaseJSessionType | undefined => {
  if (kind === 'competition') return 'game';
  if (kind === 'practice' || kind === 'lift' || kind === 'game' || kind === 'recovery') return kind;
  return undefined;
};

const scheduleWindowKindFor = (
  kind: PhaseJCoachScheduleEventKind,
  isRecurring: boolean,
): PhaseJCoachScheduleWindowKind => {
  if (!isRecurring) return 'single';
  if (kind === 'lift') return 'recurring_lift';
  if (kind === 'game' || kind === 'competition') return 'recurring_game';
  return 'recurring_practice';
};

const isCandidateAthleteEligible = (
  candidate: PhaseJSessionCandidate,
  athleteUserIds?: string[],
): boolean => !athleteUserIds || athleteUserIds.length === 0 || athleteUserIds.includes(candidate.athleteUserId);

const isScheduleKindPlausible = (
  candidate: PhaseJSessionCandidate,
  eventKind: PhaseJCoachScheduleEventKind,
): boolean => {
  const sessionType = scheduleKindToSessionType(eventKind);
  if (!sessionType) return true;
  if (candidate.candidateKinds.includes('unknown') || candidate.candidateKinds.includes('other')) return true;
  return candidate.candidateKinds.includes(sessionType);
};

const confidenceTierForScore = (score: number): PhaseJConfidenceTier => {
  if (score >= 0.86) return 'strong_contextual';
  if (score >= 0.68) return 'usable';
  if (score >= 0.42) return 'directional';
  return 'hold_back';
};

const compareByScore = <T extends { score: number }>(left: T, right: T): number =>
  right.score - left.score;

const applyRecurrenceException = (
  startAt: number,
  endAt: number,
  recurrence?: PhaseJCoachScheduleRecurrence,
): { startsAt: number; endsAt: number; cancelled: boolean } => {
  const exception = recurrence?.exceptions?.find((entry) => Math.abs(entry.occurrenceStartAt - startAt) <= 1);
  if (!exception) return { startsAt: startAt, endsAt: endAt, cancelled: false };
  if (exception.cancelled) return { startsAt: startAt, endsAt: endAt, cancelled: true };
  return {
    startsAt: positiveNumber(exception.movedStartAt) ?? startAt,
    endsAt: positiveNumber(exception.movedEndAt) ?? endAt,
    cancelled: false,
  };
};

const buildOccurrenceWindow = (
  event: PhaseJCoachScheduleEvent,
  startsAt: number,
  endsAt: number,
  isRecurring: boolean,
  options: PhaseJCoachScheduleMatchOptions,
): PhaseJCoachScheduleOccurrenceWindow => {
  const preWindowSec = positiveNumber(options.preWindowSec) ?? DEFAULT_PRE_WINDOW_SEC;
  const postWindowSec = positiveNumber(options.postWindowSec) ?? DEFAULT_POST_WINDOW_SEC;
  const normalizedStart = Math.round(startsAt);
  const normalizedEnd = Math.round(Math.max(endsAt, startsAt));

  return {
    scheduleEventId: event.id,
    occurrenceKey: isRecurring ? `${event.id}:${normalizedStart}` : event.id,
    kind: event.kind,
    sessionType: scheduleKindToSessionType(event.kind),
    windowKind: scheduleWindowKindFor(event.kind, isRecurring),
    startsAt: normalizedStart,
    endsAt: normalizedEnd,
    matchStartsAt: normalizedStart - preWindowSec,
    matchEndsAt: normalizedEnd + postWindowSec,
    timezone: event.timezone,
    isRecurring,
    sourceEventStartsAt: event.startsAt,
    sourceEventEndsAt: event.endsAt,
  };
};

export const expandCoachScheduleEventWindows = (
  event: PhaseJCoachScheduleEvent,
  rangeStartAt: number,
  rangeEndAt: number,
  options: PhaseJCoachScheduleMatchOptions = {},
): PhaseJCoachScheduleOccurrenceWindow[] => {
  if (!event.recurrence || event.recurrence.frequency === 'none') {
    if (event.endsAt < rangeStartAt || event.startsAt > rangeEndAt) return [];
    return [buildOccurrenceWindow(event, event.startsAt, event.endsAt, false, options)];
  }

  const recurrence = event.recurrence;
  const duration = durationSec(event.startsAt, event.endsAt);
  const recurrenceStart = positiveNumber(recurrence.startsAt) ?? event.startsAt;
  const recurrenceEnd = positiveNumber(recurrence.untilAt) ?? rangeEndAt;
  const boundedStart = Math.max(rangeStartAt, recurrenceStart);
  const boundedEnd = Math.min(rangeEndAt, recurrenceEnd);
  if (boundedEnd < boundedStart || duration <= 0) return [];

  const interval = normalizeInterval(recurrence.interval);
  const maxOccurrences = positiveNumber(recurrence.maxOccurrences) ?? 370;
  const windows: PhaseJCoachScheduleOccurrenceWindow[] = [];
  const baseDayStart = floorToUtcDay(event.startsAt);
  const eventSecondsIntoDay = secondsIntoUtcDay(event.startsAt);
  const scanStart = floorToUtcDay(boundedStart) - SECONDS_PER_WEEK;
  const scanEnd = floorToUtcDay(boundedEnd) + SECONDS_PER_WEEK;

  if (recurrence.frequency === 'daily') {
    for (
      let dayStart = scanStart;
      dayStart <= scanEnd && windows.length < maxOccurrences;
      dayStart += SECONDS_PER_DAY
    ) {
      const daysSinceBase = Math.floor((dayStart - baseDayStart) / SECONDS_PER_DAY);
      if (daysSinceBase < 0 || daysSinceBase % interval !== 0) continue;
      const occurrenceStart = dayStart + eventSecondsIntoDay;
      const occurrenceEnd = occurrenceStart + duration;
      if (occurrenceEnd < boundedStart || occurrenceStart > boundedEnd) continue;
      const adjusted = applyRecurrenceException(occurrenceStart, occurrenceEnd, recurrence);
      if (adjusted.cancelled) continue;
      windows.push(buildOccurrenceWindow(event, adjusted.startsAt, adjusted.endsAt, true, options));
    }
    return windows;
  }

  const baseWeekStart = baseDayStart - utcDayOfWeek(event.startsAt) * SECONDS_PER_DAY;
  const daysOfWeek = recurrence.daysOfWeek && recurrence.daysOfWeek.length > 0
    ? recurrence.daysOfWeek.map((day) => clamp(Math.round(day), 0, 6))
    : [utcDayOfWeek(event.startsAt)];

  for (
    let dayStart = scanStart;
    dayStart <= scanEnd && windows.length < maxOccurrences;
    dayStart += SECONDS_PER_DAY
  ) {
    if (!daysOfWeek.includes(utcDayOfWeek(dayStart))) continue;
    const weekStart = dayStart - utcDayOfWeek(dayStart) * SECONDS_PER_DAY;
    const weeksSinceBase = Math.floor((weekStart - baseWeekStart) / SECONDS_PER_WEEK);
    if (weeksSinceBase < 0 || weeksSinceBase % interval !== 0) continue;
    const occurrenceStart = dayStart + eventSecondsIntoDay;
    const occurrenceEnd = occurrenceStart + duration;
    if (occurrenceEnd < boundedStart || occurrenceStart > boundedEnd) continue;
    const adjusted = applyRecurrenceException(occurrenceStart, occurrenceEnd, recurrence);
    if (adjusted.cancelled) continue;
    windows.push(buildOccurrenceWindow(event, adjusted.startsAt, adjusted.endsAt, true, options));
  }

  return windows;
};

const scoreScheduleWindow = (
  candidate: PhaseJSessionCandidate,
  event: PhaseJCoachScheduleEvent,
  occurrence: PhaseJCoachScheduleOccurrenceWindow,
): PhaseJCoachScheduleMatch | undefined => {
  if (event.teamId && candidate.teamId && event.teamId !== candidate.teamId) return undefined;
  if (event.sportId && candidate.sportId && event.sportId !== candidate.sportId) return undefined;
  if (!isCandidateAthleteEligible(candidate, event.athleteUserIds)) return undefined;

  const candidateDuration = Math.max(1, durationSec(candidate.detectedStartAt, candidate.detectedEndAt));
  const eventDuration = Math.max(1, durationSec(occurrence.startsAt, occurrence.endsAt));
  const overlap = overlapSec(
    candidate.detectedStartAt,
    candidate.detectedEndAt,
    occurrence.matchStartsAt,
    occurrence.matchEndsAt,
  );
  if (overlap <= 0) return undefined;

  const overlapPctOfCandidate = overlap / candidateDuration;
  const overlapPctOfEvent = overlap / eventDuration;
  const startDeltaSec = Math.abs(candidate.detectedStartAt - occurrence.startsAt);
  const startDeltaScore = 1 - clamp(startDeltaSec / Math.max(DEFAULT_PRE_WINDOW_SEC, eventDuration), 0, 1);
  const kindPlausible = isScheduleKindPlausible(candidate, event.kind);
  const kindScore = kindPlausible ? 1 : 0.35;
  const sourceScore = event.sourceFreshness === 'stale' || event.sourceFreshness === 'historical' ? 0.75 : 1;
  const parserScore = isFiniteNumber(event.parserConfidence) ? clamp(event.parserConfidence, 0, 1) : 1;
  const recurringBoost = occurrence.isRecurring && kindPlausible ? 0.04 : 0;
  const score = roundTo(clamp(
    (overlapPctOfCandidate * 0.44)
      + (Math.min(1, overlapPctOfEvent) * 0.22)
      + (startDeltaScore * 0.16)
      + (kindScore * 0.12)
      + (sourceScore * 0.03)
      + (parserScore * 0.03)
      + recurringBoost,
    0,
    1,
  ));

  const reasons = [
    `overlap:${roundTo(overlapPctOfCandidate, 2)}`,
    `start_delta_sec:${Math.round(startDeltaSec)}`,
    occurrence.isRecurring ? `recurring:${occurrence.windowKind}` : 'single_window',
    kindPlausible ? `kind:${event.kind}` : `kind_mismatch:${event.kind}`,
  ];

  return {
    event,
    occurrence,
    overlapSec: Math.round(overlap),
    overlapPctOfCandidate: roundTo(overlapPctOfCandidate),
    overlapPctOfEvent: roundTo(overlapPctOfEvent),
    startDeltaSec: Math.round(startDeltaSec),
    score,
    confidenceTier: confidenceTierForScore(score),
    reasons,
  };
};

export const matchCandidateToScheduleEvent = (
  candidate: PhaseJSessionCandidate,
  events: PhaseJCoachScheduleEvent[],
  options: PhaseJCoachScheduleMatchOptions = {},
): PhaseJCoachScheduleMatch | undefined => {
  const searchPaddingSec = positiveNumber(options.searchPaddingSec) ?? DEFAULT_SEARCH_PADDING_SEC;
  const minScore = isFiniteNumber(options.minScore) ? options.minScore : 0.24;
  const minOverlapPct = isFiniteNumber(options.minOverlapPct) ? options.minOverlapPct : 0.05;
  const rangeStartAt = candidate.detectedStartAt - searchPaddingSec;
  const rangeEndAt = candidate.detectedEndAt + searchPaddingSec;

  const matches = events
    .flatMap((event) =>
      expandCoachScheduleEventWindows(event, rangeStartAt, rangeEndAt, options)
        .map((occurrence) => scoreScheduleWindow(candidate, event, occurrence))
        .filter((match): match is PhaseJCoachScheduleMatch => Boolean(match)))
    .filter((match) => match.score >= minScore && match.overlapPctOfCandidate >= minOverlapPct)
    .sort(compareByScore);

  return matches[0];
};

const prescribedSessionWindow = (
  session: PhaseJPrescribedSession,
  scheduleMatch?: PhaseJCoachScheduleMatch,
): { startsAt?: number; endsAt?: number } => {
  if (session.startsAt !== undefined && session.endsAt !== undefined) {
    return { startsAt: session.startsAt, endsAt: session.endsAt };
  }
  if (scheduleMatch && session.scheduleEventId && session.scheduleEventId === scheduleMatch.event.id) {
    return {
      startsAt: scheduleMatch.occurrence.startsAt,
      endsAt: scheduleMatch.occurrence.endsAt,
    };
  }
  return {};
};

const scorePrescribedSession = (
  candidate: PhaseJSessionCandidate,
  session: PhaseJPrescribedSession,
  options: PhaseJPrescribedSessionMatchOptions,
): PhaseJPrescribedSessionMatch | undefined => {
  if (session.teamId && candidate.teamId && session.teamId !== candidate.teamId) return undefined;
  if (session.sportId && candidate.sportId && session.sportId !== candidate.sportId) return undefined;
  if (session.athleteUserId && session.athleteUserId !== candidate.athleteUserId) return undefined;
  if (!isCandidateAthleteEligible(candidate, session.athleteUserIds)) return undefined;

  const scheduleMatch = options.scheduleMatch;
  const linkedByCandidate = Boolean(candidate.prescribedSessionId && candidate.prescribedSessionId === session.id);
  const linkedBySchedule = Boolean(
    scheduleMatch
      && session.scheduleEventId
      && session.scheduleEventId === scheduleMatch.event.id,
  );
  const linkedByCandidateSchedule = Boolean(
    candidate.scheduleEventId
      && session.scheduleEventId
      && session.scheduleEventId === candidate.scheduleEventId,
  );
  const sessionTypePlausible = !session.sessionType
    || candidate.candidateKinds.includes(session.sessionType)
    || candidate.candidateKinds.includes('unknown')
    || candidate.candidateKinds.includes('other');

  const preWindowSec = positiveNumber(options.preWindowSec) ?? DEFAULT_PRE_WINDOW_SEC;
  const postWindowSec = positiveNumber(options.postWindowSec) ?? DEFAULT_POST_WINDOW_SEC;
  const window = prescribedSessionWindow(session, scheduleMatch);
  const candidateDuration = Math.max(1, durationSec(candidate.detectedStartAt, candidate.detectedEndAt));
  let overlap = 0;
  let overlapPctOfCandidate: number | undefined;
  let windowScore = 0;

  if (window.startsAt !== undefined && window.endsAt !== undefined) {
    overlap = overlapSec(
      candidate.detectedStartAt,
      candidate.detectedEndAt,
      window.startsAt - preWindowSec,
      window.endsAt + postWindowSec,
    );
    overlapPctOfCandidate = overlap / candidateDuration;
    windowScore = overlapPctOfCandidate;
  }

  if (!linkedByCandidate && !linkedBySchedule && !linkedByCandidateSchedule && overlap <= 0) {
    return undefined;
  }

  const parserScore = isFiniteNumber(session.parserConfidence) ? clamp(session.parserConfidence, 0, 1) : 0.9;
  const planSpecificityScore = clamp(session.blocks.length / 4, 0.2, 1);
  const linkScore = linkedByCandidate ? 1 : linkedBySchedule || linkedByCandidateSchedule ? 0.88 : 0;
  const typeScore = sessionTypePlausible ? 1 : 0.25;
  const score = roundTo(clamp(
    (linkScore * 0.36)
      + (windowScore * 0.28)
      + (planSpecificityScore * 0.16)
      + (parserScore * 0.12)
      + (typeScore * 0.08),
    0,
    1,
  ));

  return {
    prescribedSession: session,
    scheduleMatch,
    overlapSec: Math.round(overlap),
    overlapPctOfCandidate: overlapPctOfCandidate !== undefined ? roundTo(overlapPctOfCandidate) : undefined,
    score,
    confidenceTier: confidenceTierForScore(score),
    reasons: [
      linkedByCandidate ? 'candidate_prescribed_session_id' : undefined,
      linkedBySchedule ? 'schedule_match_link' : undefined,
      linkedByCandidateSchedule ? 'candidate_schedule_event_id' : undefined,
      overlap > 0 ? `overlap:${roundTo(overlap / candidateDuration, 2)}` : undefined,
      session.recurrence ? `recurring_plan:${session.recurrence.frequency}` : undefined,
      sessionTypePlausible ? 'session_type_plausible' : 'session_type_mismatch',
    ].filter((reason): reason is string => Boolean(reason)),
  };
};

export const matchCandidateToPrescribedSession = (
  candidate: PhaseJSessionCandidate,
  prescribedSessions: PhaseJPrescribedSession[],
  options: PhaseJPrescribedSessionMatchOptions = {},
): PhaseJPrescribedSessionMatch | undefined => {
  const minScore = isFiniteNumber(options.minScore) ? options.minScore : 0.24;
  const matches = prescribedSessions
    .map((session) => scorePrescribedSession(candidate, session, options))
    .filter((match): match is PhaseJPrescribedSessionMatch => Boolean(match))
    .filter((match) => match.score >= minScore)
    .sort(compareByScore);

  return matches[0];
};

export const buildPhaseJCoachContextProvenance = (
  input: PhaseJCoachContextProvenanceInput,
): PhaseJRecordProvenance => ({
  sourceFamily: input.sourceFamily || 'phase_j',
  sourceType: input.sourceType || 'coach_schedule_context',
  sourceRecordIds: input.sourceRecordIds || [],
  adapter: input.adapter,
  observedAt: Math.round(input.observedAt),
  ingestedAt: Math.round(input.ingestedAt || nowSeconds()),
  rawRef: input.rawRef,
  confidenceHints: input.confidenceHints || [],
  qualityFlags: input.qualityFlags || [],
});

const buildParsedCoachContext = (
  input: BuildCoachContextConfirmationEventInput,
): Record<string, unknown> => stripUndefinedDeep({
  scheduleEvent: input.scheduleMatch
    ? {
      id: input.scheduleMatch.event.id,
      kind: input.scheduleMatch.event.kind,
      title: input.scheduleMatch.event.title,
      sportId: input.scheduleMatch.event.sportId,
      startsAt: input.scheduleMatch.occurrence.startsAt,
      endsAt: input.scheduleMatch.occurrence.endsAt,
      occurrenceKey: input.scheduleMatch.occurrence.occurrenceKey,
      windowKind: input.scheduleMatch.occurrence.windowKind,
      isRecurring: input.scheduleMatch.occurrence.isRecurring,
      overlapPctOfCandidate: input.scheduleMatch.overlapPctOfCandidate,
      score: input.scheduleMatch.score,
      confidenceTier: input.scheduleMatch.confidenceTier,
      reasons: input.scheduleMatch.reasons,
    }
    : undefined,
  prescribedSession: input.prescribedSessionMatch
    ? {
      id: input.prescribedSessionMatch.prescribedSession.id,
      scheduleEventId: input.prescribedSessionMatch.prescribedSession.scheduleEventId,
      sessionType: input.prescribedSessionMatch.prescribedSession.sessionType,
      blockCount: input.prescribedSessionMatch.prescribedSession.blocks.length,
      blocks: input.prescribedSessionMatch.prescribedSession.blocks,
      score: input.prescribedSessionMatch.score,
      confidenceTier: input.prescribedSessionMatch.confidenceTier,
      reasons: input.prescribedSessionMatch.reasons,
    }
    : undefined,
  coachObservations: input.coachObservations?.map((observation) => ({
    id: observation.id,
    coachUserId: observation.coachUserId,
    recordedAt: observation.recordedAt,
    source: observation.source,
    scheduleEventId: observation.scheduleEventId,
    prescribedSessionId: observation.prescribedSessionId,
    athleteUserIds: observation.athleteUserIds,
    extracted: observation.extracted,
  })),
});

const resolveConfirmationBasis = (
  input: BuildCoachContextConfirmationEventInput,
): PhaseJConfirmationBasis => {
  if (input.confirmationBasis) return input.confirmationBasis;
  if (input.coachObservations && input.coachObservations.length > 0 && !input.scheduleMatch) {
    return 'coach_observation';
  }
  return 'coach_schedule_confirm';
};

const selectedSessionTypeForContext = (
  scheduleMatch?: PhaseJCoachScheduleMatch,
  prescribedSessionMatch?: PhaseJPrescribedSessionMatch,
  candidate?: PhaseJSessionCandidate,
): PhaseJSessionType | undefined =>
  prescribedSessionMatch?.prescribedSession.sessionType
  || scheduleMatch?.occurrence.sessionType
  || candidate?.candidateKinds.find((kind) => kind !== 'unknown');

const coachVoiceSummaryForContext = (
  candidate: PhaseJSessionCandidate,
  scheduleMatch?: PhaseJCoachScheduleMatch,
  prescribedSessionMatch?: PhaseJPrescribedSessionMatch,
  coachObservations: PhaseJCoachObservation[] = [],
): string => {
  const sessionType = selectedSessionTypeForContext(scheduleMatch, prescribedSessionMatch, candidate);
  if (scheduleMatch && prescribedSessionMatch) {
    return `Matched this ${sessionType || 'session'} to the schedule and the uploaded practice plan.`;
  }
  if (scheduleMatch) {
    return `Matched this ${sessionType || 'session'} to the team schedule. Drop the practice plan and we can tighten the read.`;
  }
  if (prescribedSessionMatch) {
    return `Matched this ${sessionType || 'session'} to the uploaded plan, but the schedule window is still missing.`;
  }
  if (coachObservations.length > 0) {
    return 'Coach notes are attached, but this session still needs a schedule or plan match.';
  }
  return 'No coach schedule context matched this session yet.';
};

const resolveCoachContextConfidence = (
  scheduleMatch?: PhaseJCoachScheduleMatch,
  prescribedSessionMatch?: PhaseJPrescribedSessionMatch,
): PhaseJConfidenceTier => {
  if (scheduleMatch?.confidenceTier === 'strong_contextual' && prescribedSessionMatch) return 'strong_contextual';
  if (scheduleMatch || prescribedSessionMatch) return 'usable';
  return 'directional';
};

export const buildCoachContextConfirmationEvent = (
  input: BuildCoachContextConfirmationEventInput,
): PhaseJContextConfirmationEvent => {
  const createdAt = Math.round(input.createdAt || nowSeconds());
  const selectedSessionType = selectedSessionTypeForContext(
    input.scheduleMatch,
    input.prescribedSessionMatch,
    input.candidate,
  );
  const sourceRecordIds = unique([
    input.scheduleMatch?.event.id,
    input.prescribedSessionMatch?.prescribedSession.id,
    ...(input.coachObservations || []).map((observation) => observation.id),
  ].filter((id): id is string => Boolean(id)));
  const provenance = input.provenance || buildPhaseJCoachContextProvenance({
    observedAt: input.scheduleMatch?.occurrence.startsAt || input.candidate.detectedStartAt || createdAt,
    sourceRecordIds,
    confidenceHints: [
      input.scheduleMatch ? `schedule_score:${input.scheduleMatch.score}` : undefined,
      input.prescribedSessionMatch ? `prescribed_score:${input.prescribedSessionMatch.score}` : undefined,
    ].filter((hint): hint is string => Boolean(hint)),
    ...input.provenanceInput,
  });

  return stripUndefinedDeep({
    id: requireString(input.id, 'id'),
    candidateId: input.candidate.id,
    athleteUserId: input.candidate.athleteUserId,
    teamId: nonEmptyString(input.candidate.teamId),
    actor: input.actor,
    disposition: 'confirmed',
    confirmationBasis: resolveConfirmationBasis(input),
    confidenceImpact: input.confidenceImpact || resolveCoachContextConfidence(
      input.scheduleMatch,
      input.prescribedSessionMatch,
    ),
    answer: input.answer || coachVoiceSummaryForContext(
      input.candidate,
      input.scheduleMatch,
      input.prescribedSessionMatch,
      input.coachObservations,
    ),
    selectedSessionType,
    freeText: nonEmptyString(input.freeText),
    voiceTranscript: nonEmptyString(input.voiceTranscript),
    parsedContext: buildParsedCoachContext(input),
    promptId: nonEmptyString(input.promptId),
    createdAt,
    expiresAt: positiveNumber(input.expiresAt),
    provenance,
    contractVersion: PHASE_J_SESSION_CONTRACT_VERSION,
  });
};

export const summarizeCoachContextForCandidate = (
  candidate: PhaseJSessionCandidate,
  context: PhaseJCoachContextBundle,
  options: PhaseJCoachScheduleMatchOptions = {},
): PhaseJCoachContextCandidateSummary => {
  const scheduleMatch = matchCandidateToScheduleEvent(candidate, context.scheduleEvents, options);
  const prescribedSessionMatch = matchCandidateToPrescribedSession(candidate, context.prescribedSessions, {
    ...options,
    scheduleMatch,
  });
  const coachObservations = (context.coachObservations || []).filter((observation) => {
    const athleteMatch = !observation.athleteUserIds
      || observation.athleteUserIds.length === 0
      || observation.athleteUserIds.includes(candidate.athleteUserId);
    const scheduleMatchLinked = Boolean(
      scheduleMatch
        && observation.scheduleEventId
        && observation.scheduleEventId === scheduleMatch.event.id,
    );
    const prescribedMatchLinked = Boolean(
      prescribedSessionMatch
        && observation.prescribedSessionId
        && observation.prescribedSessionId === prescribedSessionMatch.prescribedSession.id,
    );
    const timeNearby = Math.abs(observation.recordedAt - candidate.detectedEndAt) <= 36 * 60 * 60;
    return athleteMatch && (scheduleMatchLinked || prescribedMatchLinked || timeNearby);
  });
  const missingContext = unique([
    ...candidate.missingContext,
    scheduleMatch ? '' : 'schedule_event',
    prescribedSessionMatch ? '' : 'prescribed_session',
  ]);

  return stripUndefinedDeep({
    candidateId: candidate.id,
    selectedSessionType: selectedSessionTypeForContext(scheduleMatch, prescribedSessionMatch, candidate),
    scheduleEventId: scheduleMatch?.event.id,
    scheduleOccurrenceKey: scheduleMatch?.occurrence.occurrenceKey,
    prescribedSessionId: prescribedSessionMatch?.prescribedSession.id,
    confidenceTier: resolveCoachContextConfidence(scheduleMatch, prescribedSessionMatch),
    missingContext,
    coachVoiceSummary: coachVoiceSummaryForContext(
      candidate,
      scheduleMatch,
      prescribedSessionMatch,
      coachObservations,
    ),
    scheduleMatch: scheduleMatch
      ? {
        overlapSec: scheduleMatch.overlapSec,
        overlapPctOfCandidate: scheduleMatch.overlapPctOfCandidate,
        startDeltaSec: scheduleMatch.startDeltaSec,
        score: scheduleMatch.score,
        confidenceTier: scheduleMatch.confidenceTier,
        reasons: scheduleMatch.reasons,
      }
      : undefined,
    prescribedSessionMatch: prescribedSessionMatch
      ? {
        overlapSec: prescribedSessionMatch.overlapSec,
        overlapPctOfCandidate: prescribedSessionMatch.overlapPctOfCandidate,
        score: prescribedSessionMatch.score,
        confidenceTier: prescribedSessionMatch.confidenceTier,
        reasons: prescribedSessionMatch.reasons,
      }
      : undefined,
    coachObservationIds: coachObservations.map((observation) => observation.id),
  });
};
