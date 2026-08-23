import {
  pulseCheckRecordMatchesWorkspace,
  type PulseCheckWorkspaceScope,
} from '../pulsecheckWorkspaceScope';

export interface AthleteReadinessDailyDetail {
  date: string;
  checkInCompleted: boolean;
  checkInCount: number;
  noraChatCount: number;
  noraMessageCount: number;
  noraSentimentScore: number | null;
  moduleAssignedCount: number;
  moduleCompletedCount: number;
  moduleDurationSeconds: number;
  coherenceMorningLevel: string | null;
  coherenceEveningLevel: string | null;
  coherenceCompletedTraining: boolean;
  coherenceEligibleTaskCount: number;
  coherenceCompletedTaskCount: number;
}

export type ReadinessEvidenceAvailability = 'available' | 'partial' | 'unavailable';

export interface AthleteReadinessWorkspaceSnapshot {
  details: AthleteReadinessDailyDetail[];
  availability: {
    checkIns: ReadinessEvidenceAvailability;
    modules: ReadinessEvidenceAvailability;
    nora: ReadinessEvidenceAvailability;
  };
}

export interface ReadinessFirestoreRow {
  id: string;
  data: Record<string, unknown>;
  source?: string;
}

interface BuildWorkspaceReadinessInput {
  athleteUserId: string;
  coachId: string;
  viewerUserId: string;
  scope: PulseCheckWorkspaceScope;
  dateKeys: string[];
  checkIns: ReadinessFirestoreRow[];
  assignments: ReadinessFirestoreRow[];
  completions?: ReadinessFirestoreRow[];
  conversations?: ReadinessFirestoreRow[];
  allowUnscopedRosterEvidence?: boolean;
}

const cleanString = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';

const toMillis = (value: unknown): number | null => {
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.getTime() : null;
  if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
    const date = value.toDate();
    return date instanceof Date && Number.isFinite(date.getTime()) ? date.getTime() : null;
  }
  if (value && typeof value === 'object' && 'seconds' in value) {
    const seconds = Number(value.seconds);
    return Number.isFinite(seconds) ? seconds * 1000 : null;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.abs(value) < 10_000_000_000 ? value * 1000 : value;
  }
  const parsed = typeof value === 'string' ? Date.parse(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : null;
};

const localDateKey = (value: unknown): string => {
  const millis = toMillis(value);
  if (millis === null) return '';
  const date = new Date(millis);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const recordDateKey = (data: Record<string, unknown>): string => {
  const explicit = cleanString(
    data.date || data.dayKey || data.sourceDate || data.completedDateKey || data.snapshotDateKey
  );
  if (/^\d{4}-\d{2}-\d{2}$/.test(explicit)) return explicit;
  return localDateKey(
    data.completedAt || data.endedAt || data.finishedAt || data.timestamp || data.sentAt || data.createdAt || data.updatedAt
  );
};

const matchesWorkspaceOrUnscopedSelf = (
  data: Record<string, unknown>,
  scope: PulseCheckWorkspaceScope,
  viewerUserId: string,
  athleteUserId: string,
  allowUnscopedRosterEvidence: boolean = false
): boolean => {
  if (pulseCheckRecordMatchesWorkspace(data, scope)) return true;
  if (viewerUserId !== athleteUserId && !allowUnscopedRosterEvidence) return false;
  const teamId = cleanString(data.teamId);
  const organizationId = cleanString(data.organizationId);
  return (!teamId || teamId === scope.teamId)
    && (!organizationId || organizationId === scope.organizationId);
};

const conversationMatchesWorkspace = (
  data: Record<string, unknown>,
  scope: PulseCheckWorkspaceScope,
  viewerUserId: string,
  athleteUserId: string,
  allowUnscopedRosterEvidence: boolean = false
): boolean => {
  if (pulseCheckRecordMatchesWorkspace(data, scope)) return true;
  const teamId = cleanString(data.teamId);
  const organizationId = cleanString(data.organizationId);
  if (teamId === scope.teamId && !organizationId) return true;
  return matchesWorkspaceOrUnscopedSelf(
    data,
    scope,
    viewerUserId,
    athleteUserId,
    allowUnscopedRosterEvidence
  );
};

const isCompletedActivity = (data: Record<string, unknown>): boolean => {
  const status = cleanString(data.status || data.sessionOutcome).toLowerCase();
  if (['aborted', 'cancelled', 'canceled', 'queued', 'assigned', 'pending'].includes(status)) return false;
  if (['completed', 'complete', 'done', 'finished', 'success', 'succeeded', 'passed'].includes(status)) return true;
  return data.completed === true
    || data.isCompleted === true
    || toMillis(data.completedAt || data.endedAt || data.finishedAt) !== null;
};

const positiveDurationSeconds = (data: Record<string, unknown>): number => {
  const summary = data.completionSummary && typeof data.completionSummary === 'object'
    ? data.completionSummary as Record<string, unknown>
    : {};
  for (const value of [data.durationSeconds, summary.durationSeconds, data.elapsedSeconds]) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) return Math.round(parsed);
  }
  return 0;
};

const sentimentFromTexts = (texts: string[]): number | null => {
  const words = texts.join(' ').toLowerCase().match(/[a-z']+/g) || [];
  if (words.length === 0) return null;
  const positive = new Set([
    'good', 'great', 'happy', 'strong', 'ready', 'focused', 'better', 'confident',
    'motivated', 'recovered', 'calm', 'proud', 'excited', 'progress',
  ]);
  const negative = new Set([
    'bad', 'sad', 'angry', 'frustrated', 'anxious', 'worried', 'stressed',
    'overwhelmed', 'tired', 'exhausted', 'weak', 'injured', 'hurt', 'pain',
    'sore', 'drained', 'fatigued', 'struggling', 'stuck',
  ]);
  const balance = words.reduce(
    (sum, word) => sum + (positive.has(word) ? 1 : 0) - (negative.has(word) ? 1 : 0),
    0
  );
  return Math.max(-1, Math.min(1, (balance / words.length) * 10));
};

const checkInDateKey = (
  row: ReadinessFirestoreRow,
  athleteUserId: string
): string => {
  const explicit = cleanString(row.data.date || row.data.sourceDate);
  if (/^\d{4}-\d{2}-\d{2}$/.test(explicit)) return explicit;
  const prefix = `${athleteUserId}_`;
  const fromID = row.id.startsWith(prefix) ? row.id.slice(prefix.length) : '';
  return /^\d{4}-\d{2}-\d{2}$/.test(fromID) ? fromID : '';
};

const emptyDay = (date: string): AthleteReadinessDailyDetail => ({
  date,
  checkInCompleted: false,
  checkInCount: 0,
  noraChatCount: 0,
  noraMessageCount: 0,
  noraSentimentScore: null,
  moduleAssignedCount: 0,
  moduleCompletedCount: 0,
  moduleDurationSeconds: 0,
  coherenceMorningLevel: null,
  coherenceEveningLevel: null,
  coherenceCompletedTraining: false,
  coherenceEligibleTaskCount: 0,
  coherenceCompletedTaskCount: 0,
});

/**
 * Builds selected-workspace coach cards from canonical check-ins and daily
 * assignments plus privacy-filtered completion and Nora evidence. Unscoped
 * records can participate for self-view or after the roster loader has already
 * verified the coach-athlete relationship, but never when a conflicting
 * workspace identifier is present.
 */
export const buildWorkspaceReadinessDailyDetails = ({
  athleteUserId,
  coachId,
  viewerUserId,
  scope,
  dateKeys,
  checkIns,
  assignments,
  completions = [],
  conversations = [],
  allowUnscopedRosterEvidence = false,
}: BuildWorkspaceReadinessInput): AthleteReadinessDailyDetail[] => {
  const allowedDates = new Set(dateKeys);
  const byDate = new Map(
    dateKeys.map((date): [string, AthleteReadinessDailyDetail] => [
      date,
      emptyDay(date),
    ])
  );

  for (const row of checkIns) {
    if (
      cleanString(row.data.athleteUserId) !== athleteUserId ||
      !matchesWorkspaceOrUnscopedSelf(
        row.data,
        scope,
        viewerUserId,
        athleteUserId,
        allowUnscopedRosterEvidence
      )
    ) {
      continue;
    }
    const dateKey = checkInDateKey(row, athleteUserId);
    if (!allowedDates.has(dateKey)) continue;
    const detail = byDate.get(dateKey);
    if (!detail) continue;
    const evening =
      row.data.eveningCheckIn && typeof row.data.eveningCheckIn === 'object'
        ? (row.data.eveningCheckIn as Record<string, unknown>)
        : null;
    detail.checkInCompleted = true;
    detail.checkInCount = 1;
    detail.coherenceMorningLevel = cleanString(row.data.level) || null;
    detail.coherenceEveningLevel = cleanString(evening?.level) || null;
  }

  type AssignmentRevision = {
    id: string;
    lineageId: string;
    revision: number;
    dateKey: string;
    completed: boolean;
  };
  const latestByLineage = new Map<string, AssignmentRevision>();

  for (const row of assignments) {
    if (
      cleanString(row.data.athleteId) !== athleteUserId ||
      cleanString(row.data.coachId) !== coachId ||
      !pulseCheckRecordMatchesWorkspace(row.data, scope)
    ) {
      continue;
    }
    const dateKey = cleanString(row.data.sourceDate);
    if (!allowedDates.has(dateKey)) continue;
    const status = cleanString(row.data.status || 'assigned').toLowerCase();
    const actionType = cleanString(row.data.actionType)
      .toLowerCase()
      .replace(/-/g, '_');
    if (
      ['superseded', 'overridden', 'deferred', 'cancelled', 'canceled'].includes(status) ||
      actionType === 'check_in' ||
      actionType === 'checkin'
    ) {
      continue;
    }
    const lineage = cleanString(row.data.lineageId) || row.id;
    const revisionValue = Number(row.data.revision);
    const revision = Number.isFinite(revisionValue) ? revisionValue : 1;
    const key = `${dateKey}|${lineage}`;
    const current = latestByLineage.get(key);
    if (!current || revision > current.revision) {
      latestByLineage.set(key, {
        id: row.id,
        lineageId: lineage,
        revision,
        dateKey,
        completed: status === 'completed' || row.data.completedAt != null,
      });
    }
  }

  const selectedAssignmentIds = new Set<string>();
  const countedCompletionIdsByDate = new Map<string, Set<string>>();
  for (const assignment of latestByLineage.values()) {
    const detail = byDate.get(assignment.dateKey);
    if (!detail) continue;
    selectedAssignmentIds.add(assignment.id);
    selectedAssignmentIds.add(assignment.lineageId);
    detail.moduleAssignedCount += 1;
    detail.coherenceEligibleTaskCount += 1;
    if (assignment.completed) {
      detail.moduleCompletedCount += 1;
      detail.coherenceCompletedTaskCount += 1;
      detail.coherenceCompletedTraining = true;
      const counted = countedCompletionIdsByDate.get(assignment.dateKey) || new Set<string>();
      counted.add(assignment.id);
      counted.add(assignment.lineageId);
      countedCompletionIdsByDate.set(assignment.dateKey, counted);
    }
  }

  for (const row of completions) {
    if (!isCompletedActivity(row.data)) continue;
    const linkedAssignmentId = cleanString(
      row.data.dailyAssignmentId || row.data.assignmentId || row.data.pulseCheckDailyAssignmentId
    );
    const hasSelectedAssignment = linkedAssignmentId && selectedAssignmentIds.has(linkedAssignmentId);
    if (
      !hasSelectedAssignment
      && !matchesWorkspaceOrUnscopedSelf(
        row.data,
        scope,
        viewerUserId,
        athleteUserId,
        allowUnscopedRosterEvidence
      )
    ) {
      continue;
    }
    const dateKey = recordDateKey(row.data);
    if (!allowedDates.has(dateKey)) continue;
    const detail = byDate.get(dateKey);
    if (!detail) continue;
    const counted = countedCompletionIdsByDate.get(dateKey) || new Set<string>();
    const identity = linkedAssignmentId || `${row.source || 'completion'}:${row.id}`;
    if (counted.has(identity)) continue;
    counted.add(identity);
    countedCompletionIdsByDate.set(dateKey, counted);
    detail.moduleCompletedCount += 1;
    detail.moduleDurationSeconds += positiveDurationSeconds(row.data);
    detail.coherenceCompletedTraining = true;
    detail.coherenceCompletedTaskCount = Math.min(3, detail.coherenceCompletedTaskCount + 1);
  }

  for (const row of conversations) {
    const recordedAthleteId = cleanString(row.data.athleteUserId || row.data.userId);
    if (recordedAthleteId && recordedAthleteId !== athleteUserId) continue;
    if (!conversationMatchesWorkspace(
      row.data,
      scope,
      viewerUserId,
      athleteUserId,
      allowUnscopedRosterEvidence
    )) continue;
    const turns = Array.isArray(row.data.turns)
      ? row.data.turns
      : Array.isArray(row.data.messages)
        ? row.data.messages
        : [];
    const fallbackDateKey = recordDateKey(row.data);
    const messagesByDate = new Map<string, string[]>();
    for (const rawTurn of turns) {
      if (!rawTurn || typeof rawTurn !== 'object') continue;
      const turn = rawTurn as Record<string, unknown>;
      const role = cleanString(turn.role || turn.sender).toLowerCase();
      if (!(turn.isFromUser === true || ['athlete', 'user', 'athlete-reply'].includes(role))) continue;
      const dateKey = recordDateKey(turn) || fallbackDateKey;
      if (!allowedDates.has(dateKey)) continue;
      const text = cleanString(turn.text || turn.content);
      const messages = messagesByDate.get(dateKey) || [];
      messages.push(text);
      messagesByDate.set(dateKey, messages);
    }
    for (const [dateKey, texts] of messagesByDate) {
      const detail = byDate.get(dateKey);
      if (!detail) continue;
      detail.noraChatCount += 1;
      detail.noraMessageCount += texts.length;
      const sentiment = sentimentFromTexts(texts.filter(Boolean));
      if (sentiment !== null) {
        const priorWeight = Math.max(0, detail.noraMessageCount - texts.length);
        const priorTotal = (detail.noraSentimentScore || 0) * priorWeight;
        detail.noraSentimentScore = (priorTotal + sentiment * texts.length) / Math.max(1, detail.noraMessageCount);
      }
    }
  }

  return dateKeys.map((date) => byDate.get(date) ?? emptyDay(date));
};
