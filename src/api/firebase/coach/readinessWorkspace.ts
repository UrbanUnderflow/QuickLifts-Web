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

export interface ReadinessFirestoreRow {
  id: string;
  data: Record<string, unknown>;
}

interface BuildWorkspaceReadinessInput {
  athleteUserId: string;
  coachId: string;
  scope: PulseCheckWorkspaceScope;
  dateKeys: string[];
  checkIns: ReadinessFirestoreRow[];
  assignments: ReadinessFirestoreRow[];
}

const cleanString = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';

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
 * Builds the web coach cards from the same canonical evidence families used by
 * the universal app: team-scoped morning check-ins and team-scoped daily
 * assignments. Legacy mental-check-in, conversation, standalone-completion,
 * and junior-progress records intentionally do not participate here.
 */
export const buildWorkspaceReadinessDailyDetails = ({
  athleteUserId,
  coachId,
  scope,
  dateKeys,
  checkIns,
  assignments,
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
      !pulseCheckRecordMatchesWorkspace(row.data, scope)
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
        revision,
        dateKey,
        completed: status === 'completed' || row.data.completedAt != null,
      });
    }
  }

  for (const assignment of latestByLineage.values()) {
    const detail = byDate.get(assignment.dateKey);
    if (!detail) continue;
    detail.moduleAssignedCount += 1;
    detail.coherenceEligibleTaskCount += 1;
    if (assignment.completed) {
      detail.moduleCompletedCount += 1;
      detail.coherenceCompletedTaskCount += 1;
      detail.coherenceCompletedTraining = true;
    }
  }

  return dateKeys.map((date) => byDate.get(date) ?? emptyDay(date));
};
