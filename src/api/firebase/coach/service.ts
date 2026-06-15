import { doc, getDoc, setDoc, collection, query, where, getDocs, deleteDoc, orderBy, limit, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config';
import { CoachModel, CoachFirestoreData } from '../../../types/Coach';
import { convertFirestoreTimestamp, dateToUnixTimestamp } from '../../../utils/formatDate';
import { privacyService } from '../privacy/service';
import { pulseCheckProvisioningService } from '../pulsecheckProvisioning/service';
import type { PulseCheckRosterVisibilityScope, PulseCheckTeamMembership, PulseCheckTeamMembershipRole } from '../pulsecheckProvisioning/types';
import {
  CurriculumAssignmentStatus,
  PulseCheckDailyAssignmentStatus,
  athleteProgressFromFirestore,
  curriculumAssignmentFromFirestore,
  pulseCheckDailyAssignmentFromFirestore,
  type AthleteMentalProgress,
  type CurriculumAssignment,
  type PulseCheckDailyAssignment,
} from '../mentaltraining/types';

export interface DailySentimentRecord {
  id: string;
  userId: string;
  date: string; // YYYY-MM-DD
  sentimentScore: number; // -1 to 1
  messageCount: number;
  lastAnalyzedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface AthleteReadinessDailyDetail {
  date: string; // YYYY-MM-DD
  checkInCompleted: boolean;
  checkInCount: number;
  noraChatCount: number;
  noraMessageCount: number;
  noraSentimentScore: number | null;
  moduleAssignedCount: number;
  moduleCompletedCount: number;
  moduleDurationSeconds: number;
}

export interface ConversationMessage {
  id: string;
  content: string;
  sender: 'user' | 'ai' | 'system';
  timestamp: Date;
  type: 'text' | 'image' | 'system';
}

export interface ConversationSession {
  id: string;
  athleteUserId: string;
  startTime: Date;
  endTime: Date;
  messages: ConversationMessage[];
}

export type CoachAthleteCurriculumItemKind = 'protocol' | 'simulation' | 'curriculum' | 'program';
export type CoachAthleteCurriculumItemStatus = 'assigned' | 'in-progress' | 'completed' | 'paused';
export type CoachAthleteCurriculumItemSource = 'daily-assignment' | 'curriculum-assignment' | 'athlete-progress';

export interface CoachAthleteCurriculumItem {
  id: string;
  kind: CoachAthleteCurriculumItemKind;
  source: CoachAthleteCurriculumItemSource;
  title: string;
  detail: string;
  /** Library identifier (protocolId / exerciseId / simSpecId) used to resolve
   *  the per-module accent color. See utils/pulseCheckModuleVisuals. */
  moduleKey?: string;
  status: CoachAthleteCurriculumItemStatus;
  progressPct: number;
  dueToday?: boolean;
  assignedAt?: Date;
  dueAt?: Date;
  completedCount?: number;
  targetCount?: number;
  expectedCount?: number;
  missedCount?: number;
  daysElapsed?: number;
  daysRemaining?: number;
  windowDays?: number;
  lastCompletedAt?: Date;
  updatedAt?: Date;
}

export interface CoachAthleteCurriculumSnapshot {
  athleteId: string;
  items: CoachAthleteCurriculumItem[];
  completedCount: number;
  totalCount: number;
  currentPathway?: string;
  pathwayStep?: number;
  totalAssignmentsCompleted?: number;
  totalExercisesMastered?: number;
  activeProgramTitle?: string;
  lastUpdatedAt?: Date;
}

const PULSECHECK_ORGANIZATIONS_COLLECTION = 'pulsecheck-organizations';
const PULSECHECK_TEAMS_COLLECTION = 'pulsecheck-teams';
const PULSECHECK_ORGANIZATION_MEMBERSHIPS_COLLECTION = 'pulsecheck-organization-memberships';
const PULSECHECK_TEAM_MEMBERSHIPS_COLLECTION = 'pulsecheck-team-memberships';
const PULSECHECK_MORNING_CHECKINS_COLLECTION = 'pulsecheck-morning-checkins';
const PULSECHECK_NORA_CONVERSATIONS_COLLECTION = 'pulsecheck-nora-conversations';
const MENTAL_CHECKINS_ROOT = 'mental-check-ins';
const SIM_COMPLETIONS_ROOT = 'sim-completions';
const IOS_MENTAL_COMPLETIONS_ROOT = 'mental-exercise-completions';
const SIM_SESSIONS_ROOT = 'sim-sessions';
const MENTAL_TRAINING_STREAKS_COLLECTION = 'mental-training-streaks';
const PULSECHECK_DAILY_ASSIGNMENTS_COLLECTION = 'pulsecheck-daily-assignments';
const MENTAL_CURRICULUM_ASSIGNMENTS_COLLECTION = 'mental-curriculum-assignments';
const ATHLETE_MENTAL_PROGRESS_COLLECTION = 'athlete-mental-progress';

const DIRECT_COACH_ROLES = new Set<PulseCheckTeamMembershipRole>(['team-admin', 'coach']);
const COACH_ACCESS_ROLES = new Set<PulseCheckTeamMembershipRole>(['team-admin', 'coach', 'performance-staff', 'support-staff']);

type DailySignalAggregate = {
  scoreSum: number;
  scoreCount: number;
  messageCount: number;
  latestAt: Date;
};

const toMillis = (value: any): number | null => {
  if (value == null) return null;
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.getTime() : null;
  if (typeof value?.toDate === 'function') {
    const date = value.toDate();
    return date instanceof Date && Number.isFinite(date.getTime()) ? date.getTime() : null;
  }
  if (typeof value?.seconds === 'number') return value.seconds * 1000;

  const parsed = typeof value === 'string' ? Number.parseFloat(value) : value;
  if (typeof parsed !== 'number' || !Number.isFinite(parsed)) return null;
  return Math.abs(parsed) < 10_000_000_000 ? parsed * 1000 : parsed;
};

const toDateOrNull = (value: any): Date | null => {
  const millis = toMillis(value);
  if (millis == null) return null;
  const date = new Date(millis);
  return Number.isFinite(date.getTime()) ? date : null;
};

const toFiniteNumber = (value: any): number | null => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const positiveDurationSeconds = (...values: any[]): number => {
  for (const value of values) {
    const parsed = toFiniteNumber(value);
    if (parsed !== null && parsed > 0) return Math.round(parsed);
  }
  return 0;
};

const latestDateOf = (...dates: Array<Date | null | undefined>): Date | undefined => {
  const valid = dates.filter((date): date is Date => !!date && Number.isFinite(date.getTime()));
  if (valid.length === 0) return undefined;
  return new Date(Math.max(...valid.map((date) => date.getTime())));
};

const ymd = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const resolveDayKey = (data: Record<string, any>): string | null => {
  const explicit = String(data.date || data.dayKey || data.sourceDate || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(explicit)) return explicit;

  const date = toDateOrNull(data.createdAt || data.updatedAt || data.completedAt);
  return date ? ymd(date) : null;
};

const clampSentiment = (value: number): number => Math.max(-1, Math.min(1, value));

const readinessToSentiment = (value: any): number | null => {
  const score = typeof value === 'number' ? value : Number.parseFloat(String(value ?? ''));
  if (!Number.isFinite(score)) return null;
  if (score >= 1 && score <= 5) return clampSentiment((score - 3) / 2);
  if (score >= 0 && score <= 100) return clampSentiment((score - 50) / 50);
  if (score >= -1 && score <= 1) return clampSentiment(score);
  return null;
};

const moodWordToSentiment = (value: any): number | null => {
  const word = String(value || '').trim().toLowerCase();
  if (!word) return null;
  if (['drained', 'terrible', 'awful', 'low'].includes(word)) return -0.8;
  if (['rough', 'stressed', 'anxious', 'tired'].includes(word)) return -0.45;
  if (['okay', 'ok', 'mixed', 'neutral'].includes(word)) return 0;
  if (['solid', 'good', 'calm', 'ready'].includes(word)) return 0.45;
  if (['locked', 'great', 'excellent', 'strong'].includes(word)) return 0.85;
  return null;
};

const resolveCheckInSentiment = (data: Record<string, any>): number =>
  readinessToSentiment(data.readinessScore ?? data.levelScore ?? data.score) ??
  moodWordToSentiment(data.moodWord ?? data.level ?? data.levelLabel) ??
  0;

const countPulseCheckConversationTurns = (turns: any[]): number =>
  turns.filter((turn) => {
    const role = String(turn?.role || '').toLowerCase();
    return role === 'athlete' || role === 'user' || role === 'athlete-reply';
  }).length;

const extractPulseCheckConversationTexts = (turns: any[]): string[] =>
  turns
    .filter((turn) => {
      const role = String(turn?.role || '').toLowerCase();
      return role === 'athlete' || role === 'user' || role === 'athlete-reply';
    })
    .map((turn) => String(turn?.text || turn?.content || '').trim())
    .filter(Boolean);

const countCompletedDocs = (docs: Array<{ data: () => Record<string, any> }>): number =>
  docs.filter((docSnapshot) => {
    const data = docSnapshot.data();
    const status = String(data.status || data.sessionOutcome || '').toLowerCase();
    if (status && ['aborted', 'cancelled', 'canceled', 'queued', 'assigned', 'pending'].includes(status)) return false;
    return true;
  }).length;

const humanizeToken = (value: any): string =>
  String(value || '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (match) => match.toUpperCase());

const compactText = (value: any, maxLength = 120): string => {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  return text.length > maxLength ? `${text.slice(0, maxLength - 1).trim()}…` : text;
};

const dateKeyToCoachLabel = (dateKey?: string): string => {
  if (!dateKey || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return '';
  const date = new Date(`${dateKey}T12:00:00`);
  if (!Number.isFinite(date.getTime())) return '';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const dateFromDateKey = (dateKey?: string): Date | null => {
  if (!dateKey || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return null;
  const date = new Date(`${dateKey}T12:00:00`);
  return Number.isFinite(date.getTime()) ? date : null;
};

const startOfDayMillis = (date: Date): number => {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy.getTime();
};

const daysBetween = (left: Date, right: Date): number =>
  Math.floor((startOfDayMillis(left) - startOfDayMillis(right)) / 86400000);

const sanitizeCoachCopy = (value: any): string =>
  compactText(value, 140)
    .replace(/\bReps\b/g, 'Practices')
    .replace(/\breps\b/g, 'practices')
    .replace(/\bRep\b/g, 'Practice')
    .replace(/\brep\b/g, 'practice');

const dateFromUnixSecondsOrMillis = (value: any): Date | null => toDateOrNull(value);

const isDailyCurriculumRecord = (assignment: PulseCheckDailyAssignment): boolean =>
  assignment.assignedBy === 'curriculum-engine' || Boolean(assignment.curriculumIntent);

// A curriculum module (e.g. "4-7-8 Relaxation Breathing") is re-materialized as
// a fresh daily-assignment doc each day it's pinned, so an athlete accumulates
// many docs per module over time. The coach panel wants ONE row per module -
// the current slate, mirroring the athlete's "Active toolkit" - not one row per
// day. This collapses docs that refer to the same curriculum slot / module,
// keeping the most recent (latest sourceDate, then due-today, then revision).
const normalizeCurriculumModuleKeyPart = (value?: string | null): string =>
  compactText(value, 120)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const dailyAssignmentModuleKindKey = (assignment: PulseCheckDailyAssignment): CoachAthleteCurriculumItemKind => {
  if (assignment.actionType === 'protocol') return 'protocol';
  if (assignment.actionType === 'sim' || assignment.actionType === 'simulation' || assignment.actionType === 'lighter_sim') {
    return 'simulation';
  }
  return assignment.curriculumIntent?.artifactKind === 'protocol' ? 'protocol' : 'curriculum';
};

const dailyAssignmentModuleIdentity = (assignment: PulseCheckDailyAssignment): string => {
  const intent = assignment.curriculumIntent as Record<string, any> | undefined;
  return normalizeCurriculumModuleKeyPart(
    assignment.protocolLabel ||
      assignment.protocolVariantLabel ||
      assignment.simName ||
      assignment.simFamilyLabel ||
      assignment.trainingPlanStepLabel ||
      intent?.badgeLabel ||
      intent?.focusName ||
      assignment.protocolId ||
      assignment.legacyExerciseId ||
      assignment.simSpecId ||
      intent?.moduleId ||
      intent?.targetId ||
      intent?.assetId
  );
};

const dailyAssignmentModuleDedupKey = (assignment: PulseCheckDailyAssignment): string => {
  const moduleIdentity = dailyAssignmentModuleIdentity(assignment);
  if (moduleIdentity) return `module:${dailyAssignmentModuleKindKey(assignment)}:${moduleIdentity}`;
  if (assignment.curriculumSlotId) return `slot:${assignment.curriculumSlotId}`;
  if (assignment.lineageId) return `lineage:${assignment.lineageId}`;
  return `assignment:${assignment.id}`;
};

const dailyAssignmentSlateRank = (assignment: PulseCheckDailyAssignment): number =>
  Number((assignment.sourceDate || '').replace(/-/g, '')) || 0;

const dedupeDailyAssignmentsByModule = (
  assignments: PulseCheckDailyAssignment[]
): PulseCheckDailyAssignment[] => {
  const bestByModule = new Map<string, PulseCheckDailyAssignment>();
  for (const assignment of assignments) {
    const key = dailyAssignmentModuleDedupKey(assignment);
    const current = bestByModule.get(key);
    if (!current) {
      bestByModule.set(key, assignment);
      continue;
    }
    const incomingRank = dailyAssignmentSlateRank(assignment);
    const currentRank = dailyAssignmentSlateRank(current);
    const isMoreRecent =
      incomingRank > currentRank ||
      (incomingRank === currentRank &&
        Number(Boolean(assignment.curriculumIsDueToday)) - Number(Boolean(current.curriculumIsDueToday)) > 0) ||
      (incomingRank === currentRank &&
        Boolean(assignment.curriculumIsDueToday) === Boolean(current.curriculumIsDueToday) &&
        (assignment.revision || 0) > (current.revision || 0));
    if (isMoreRecent) bestByModule.set(key, assignment);
  }
  return Array.from(bestByModule.values());
};

const isDailyAssignmentComplete = (assignment: PulseCheckDailyAssignment): boolean => {
  if (assignment.status === PulseCheckDailyAssignmentStatus.Completed || typeof assignment.completedAt === 'number') return true;
  const session = assignment.protocolPracticeSession as Record<string, any> | undefined;
  if (!session) return false;
  if (toMillis(session.completedAt) != null) return true;
  return Boolean(session.scorecard && Object.keys(session.scorecard).length > 0);
};

const dailyAssignmentKind = (assignment: PulseCheckDailyAssignment): CoachAthleteCurriculumItemKind => {
  if (assignment.actionType === 'protocol') return 'protocol';
  if (assignment.actionType === 'sim' || assignment.actionType === 'simulation' || assignment.actionType === 'lighter_sim') {
    return 'simulation';
  }
  return assignment.curriculumIntent?.artifactKind === 'protocol' ? 'protocol' : 'curriculum';
};

const dailyAssignmentTitle = (assignment: PulseCheckDailyAssignment): string =>
  compactText(
    assignment.protocolLabel ||
      assignment.protocolVariantLabel ||
      assignment.simName ||
      assignment.simFamilyLabel ||
      assignment.trainingPlanStepLabel ||
      assignment.curriculumIntent?.focusName ||
      humanizeToken(assignment.legacyExerciseId || assignment.protocolId || assignment.simSpecId || assignment.actionType),
    80
  ) || 'Assigned practice';

const curriculumItemDedupKey = (item: CoachAthleteCurriculumItem): string => {
  const moduleIdentity = normalizeCurriculumModuleKeyPart(item.title || item.moduleKey);
  return moduleIdentity ? `module:${item.kind}:${moduleIdentity}` : `${item.source}:${item.id}`;
};

const dailyAssignmentStatus = (assignment: PulseCheckDailyAssignment): CoachAthleteCurriculumItemStatus => {
  if (isDailyAssignmentComplete(assignment)) return 'completed';
  if (
    assignment.status === PulseCheckDailyAssignmentStatus.Paused ||
    assignment.status === PulseCheckDailyAssignmentStatus.Deferred ||
    assignment.status === PulseCheckDailyAssignmentStatus.Expired
  ) {
    return 'paused';
  }
  if (assignment.status === PulseCheckDailyAssignmentStatus.Started || assignment.status === PulseCheckDailyAssignmentStatus.Viewed) {
    return 'in-progress';
  }
  return 'assigned';
};

const dailyAssignmentProgressPct = (assignment: PulseCheckDailyAssignment): number => {
  if (isDailyAssignmentComplete(assignment)) return 100;
  const intent = assignment.curriculumIntent;
  if (intent && Number.isFinite(intent.currentRep) && Number.isFinite(intent.targetReps) && intent.targetReps > 0) {
    const completed = Math.max(0, (isDailyAssignmentComplete(assignment) ? intent.currentRep : intent.currentRep - 1));
    return Math.max(0, Math.min(99, Math.round((completed / intent.targetReps) * 100)));
  }
  const phases = assignment.phaseProgress || assignment.completionSummary?.phaseProgress;
  if (phases && phases.totalPhases > 0) {
    return Math.max(0, Math.min(99, Math.round((phases.currentPhaseIndex / phases.totalPhases) * 100)));
  }
  return dailyAssignmentStatus(assignment) === 'in-progress' ? 35 : 0;
};

const dailyAssignmentDetail = (assignment: PulseCheckDailyAssignment): string => {
  const dateLabel = dateKeyToCoachLabel(assignment.sourceDate);
  const intentDetail = assignment.curriculumIntent?.progressLabel || assignment.curriculumIntent?.whyThisToday;
  return [dateLabel, sanitizeCoachCopy(intentDetail || assignment.plannerSummary || assignment.rationale)]
    .filter(Boolean)
    .join(' • ');
};

const dailyAssignmentCompletionCounts = (
  assignment: PulseCheckDailyAssignment
): Pick<CoachAthleteCurriculumItem, 'completedCount' | 'targetCount' | 'expectedCount' | 'missedCount' | 'windowDays' | 'assignedAt' | 'dueAt' | 'lastCompletedAt'> => {
  const intent = assignment.curriculumIntent as Record<string, any> | undefined;
  const targetCount = Number.isFinite(intent?.targetReps) && intent!.targetReps > 0 ? Math.round(intent!.targetReps) : 1;
  const currentPlanned = Number.isFinite(intent?.currentRep) && intent!.currentRep > 0 ? Math.round(intent!.currentRep) : 1;
  const completed = isDailyAssignmentComplete(assignment);
  const completedCount = targetCount > 1 ? Math.max(0, completed ? currentPlanned : currentPlanned - 1) : completed ? 1 : 0;
  const dueAt = dateFromDateKey(assignment.sourceDate);
  const assignedAt =
    dateFromUnixSecondsOrMillis(assignment.materializedAt) ||
    dateFromUnixSecondsOrMillis((assignment as any).createdAt) ||
    dueAt ||
    undefined;
  const lastCompletedAt = dateFromUnixSecondsOrMillis(assignment.completedAt) || undefined;
  const dueDayPassed = dueAt ? daysBetween(new Date(), dueAt) > 0 : false;
  const expectedCount = dueDayPassed || completed ? Math.min(targetCount, currentPlanned) : Math.max(0, currentPlanned - 1);
  const missedCount = completed ? 0 : Math.max(0, expectedCount - completedCount);
  return {
    assignedAt,
    dueAt: dueAt || undefined,
    completedCount,
    targetCount,
    expectedCount,
    missedCount,
    windowDays: Number.isFinite(intent?.windowDays) ? Math.round(intent!.windowDays) : undefined,
    lastCompletedAt,
  };
};

const curriculumAssignmentStatus = (assignment: CurriculumAssignment): CoachAthleteCurriculumItemStatus => {
  if (assignment.status === CurriculumAssignmentStatus.Completed || assignment.masteryAchieved) return 'completed';
  if (assignment.status === CurriculumAssignmentStatus.Paused) return 'paused';
  if (assignment.completedDays > 0 || assignment.status === CurriculumAssignmentStatus.Active || assignment.status === CurriculumAssignmentStatus.Extended) {
    return 'in-progress';
  }
  return 'assigned';
};

const curriculumAssignmentProgressPct = (assignment: CurriculumAssignment): number => {
  if (curriculumAssignmentStatus(assignment) === 'completed') return 100;
  if (Number.isFinite(assignment.completionRate) && assignment.completionRate > 0) {
    return Math.max(0, Math.min(99, Math.round(assignment.completionRate)));
  }
  if (assignment.targetDays > 0) {
    return Math.max(0, Math.min(99, Math.round((assignment.completedDays / assignment.targetDays) * 100)));
  }
  return 0;
};

const curriculumAssignmentDetail = (assignment: CurriculumAssignment): string => {
  const parts = [
    humanizeToken(assignment.pathway) || 'Curriculum',
    assignment.currentDayNumber > 0 && assignment.durationDays > 0
      ? `Day ${Math.min(assignment.currentDayNumber, assignment.durationDays)} of ${assignment.durationDays}`
      : '',
    assignment.status === CurriculumAssignmentStatus.Extended ? 'Extended' : '',
  ];
  return parts.filter(Boolean).join(' • ');
};

const curriculumAssignmentCompletionCounts = (
  assignment: CurriculumAssignment
): Pick<CoachAthleteCurriculumItem, 'assignedAt' | 'dueAt' | 'completedCount' | 'targetCount' | 'expectedCount' | 'missedCount' | 'daysElapsed' | 'daysRemaining'> => {
  const assignedAt = dateFromUnixSecondsOrMillis(assignment.startDate) || undefined;
  const dueAt = dateFromUnixSecondsOrMillis(assignment.endDate) || undefined;
  const targetCount = Math.max(0, Math.round(assignment.targetDays || assignment.durationDays || 0));
  const completedCount = Math.max(0, Math.round(assignment.completedDays || 0));
  const today = new Date();
  const daysElapsed = assignedAt ? Math.max(0, Math.min(targetCount || 999, daysBetween(today, assignedAt) + 1)) : assignment.currentDayNumber || 0;
  const expectedCount = assignedAt
    ? Math.max(0, Math.min(targetCount, daysBetween(today, assignedAt)))
    : Math.max(0, Math.min(targetCount, (assignment.currentDayNumber || 1) - 1));
  const missedCount = assignment.status === CurriculumAssignmentStatus.Completed
    ? 0
    : Math.max(0, expectedCount - completedCount);
  const daysRemaining = dueAt ? Math.max(0, daysBetween(dueAt, today)) : undefined;
  return {
    assignedAt,
    dueAt,
    completedCount,
    targetCount,
    expectedCount,
    missedCount,
    daysElapsed,
    daysRemaining,
  };
};

const progressProgramTitle = (progress?: AthleteMentalProgress | null): string => {
  const activeProgram = progress?.activeProgram as Record<string, any> | undefined;
  return compactText(
    progress?.activeAssignmentExerciseName ||
      activeProgram?.title ||
      activeProgram?.name ||
      activeProgram?.recommendedSimName ||
      humanizeToken(activeProgram?.recommendedLegacyExerciseId || activeProgram?.recommendedSimId),
    80
  );
};

const dailyAssignmentUpdatedAt = (assignment: PulseCheckDailyAssignment): Date | undefined =>
  latestDateOf(
    toDateOrNull(assignment.completedAt),
    toDateOrNull(assignment.updatedAt),
    toDateOrNull(assignment.createdAt),
    dateFromDateKey(assignment.sourceDate)
  );

const dailyAssignmentCompletionDurationSeconds = (assignment: PulseCheckDailyAssignment): number => {
  const session = assignment.protocolPracticeSession as Record<string, any> | undefined;
  const direct = positiveDurationSeconds(
    assignment.completionSummary?.durationSeconds,
    assignment.durationSeconds,
  );
  if (direct > 0) return direct;

  const startedAt = toMillis(session?.practiceStartedAt || assignment.startedAt);
  const completedAt = toMillis(session?.completedAt || assignment.completedAt);
  if (startedAt !== null && completedAt !== null && completedAt > startedAt) {
    return Math.round((completedAt - startedAt) / 1000);
  }
  return 0;
};

const curriculumAssignmentUpdatedAt = (assignment: CurriculumAssignment): Date | undefined =>
  latestDateOf(
    toDateOrNull(assignment.updatedAt),
    toDateOrNull(assignment.createdAt),
    toDateOrNull(assignment.endDate),
    toDateOrNull(assignment.startDate)
  );

const toMembershipMillis = (value: any) => {
  if (!value) return 0;
  if (value instanceof Date) return value.getTime();
  if (typeof value?.toDate === 'function') return value.toDate().getTime();
  if (typeof value?.seconds === 'number') return value.seconds * 1000;
  if (typeof value === 'number') return value;
  return 0;
};

const membershipPriority = (membership: PulseCheckTeamMembership) => {
  switch (membership.role) {
    case 'team-admin':
      return 0;
    case 'coach':
      return 1;
    case 'performance-staff':
      return 2;
    case 'support-staff':
      return 3;
    default:
      return 9;
  }
};

const choosePrimaryOperatingMembership = (memberships: PulseCheckTeamMembership[]) =>
  [...memberships]
    .filter((membership) => COACH_ACCESS_ROLES.has(membership.role))
    .sort((left, right) => {
      const roleDelta = membershipPriority(left) - membershipPriority(right);
      if (roleDelta !== 0) return roleDelta;
      return toMembershipMillis(right.updatedAt || right.createdAt || right.grantedAt) - toMembershipMillis(left.updatedAt || left.createdAt || left.grantedAt);
    })[0] || null;

const canCoachMembershipSeeAthlete = (
  coachMembership: PulseCheckTeamMembership,
  athleteMembership: PulseCheckTeamMembership
) => {
  const scope = (coachMembership.rosterVisibilityScope || 'team') as PulseCheckRosterVisibilityScope;
  if (scope === 'none') return false;
  if (scope === 'assigned') {
    return (coachMembership.allowedAthleteIds || []).includes(athleteMembership.userId);
  }
  return true;
};

const defaultPulseCheckAthleteOnboarding = () => ({
  productConsentAccepted: false,
  productConsentAcceptedAt: null,
  productConsentVersion: '',
  entryOnboardingStep: 'name' as const,
  entryOnboardingName: '',
  researchConsentStatus: 'not-required' as const,
  researchConsentVersion: '',
  researchConsentRespondedAt: null,
  eligibleForResearchDataset: false,
  enrollmentMode: 'product-only' as const,
  targetPilotId: '',
  targetPilotName: '',
  targetCohortId: '',
  targetCohortName: '',
  requiredConsents: [],
  completedConsentIds: [],
  baselinePathStatus: 'pending' as const,
  baselinePathwayId: '',
});

class CoachService {
  private async listCoachTeamMemberships(coachId: string): Promise<PulseCheckTeamMembership[]> {
    const memberships = await pulseCheckProvisioningService.listUserTeamMemberships(coachId);
    return memberships.filter((membership) => COACH_ACCESS_ROLES.has(membership.role));
  }

  private async listPulseCheckAthleteConnectionsForCoach(
    coachId: string
  ): Promise<Array<{ athleteMembership: PulseCheckTeamMembership; coachMembership: PulseCheckTeamMembership; linkedAt: Date | null }>> {
    const coachMemberships = await this.listCoachTeamMemberships(coachId);
    if (coachMemberships.length === 0) return [];

    const byAthleteId = new Map<string, { athleteMembership: PulseCheckTeamMembership; coachMembership: PulseCheckTeamMembership; linkedAt: Date | null }>();

    const teamMembershipsByTeam = await Promise.all(
      coachMemberships.map(async (coachMembership) => ({
        coachMembership,
        members: await pulseCheckProvisioningService.listTeamMemberships(coachMembership.teamId),
      }))
    );

    for (const { coachMembership, members } of teamMembershipsByTeam) {
      const athleteMembers = members.filter(
        (membership) => membership.role === 'athlete' && canCoachMembershipSeeAthlete(coachMembership, membership)
      );

      for (const athleteMembership of athleteMembers) {
        const linkedAt = convertFirestoreTimestamp(
          athleteMembership.grantedAt || athleteMembership.createdAt || athleteMembership.updatedAt
        );
        const existing = byAthleteId.get(athleteMembership.userId);
        const existingTime = existing?.linkedAt?.getTime() || 0;
        const nextTime = linkedAt?.getTime() || 0;
        if (!existing || nextTime >= existingTime) {
          byAthleteId.set(athleteMembership.userId, {
            athleteMembership,
            coachMembership,
            linkedAt,
          });
        }
      }
    }

    return Array.from(byAthleteId.values());
  }

  private async ensureCoachOperatingContext(coachId: string): Promise<{ organizationId: string; teamId: string }> {
    const existingMembership = choosePrimaryOperatingMembership(await this.listCoachTeamMemberships(coachId));
    if (existingMembership) {
      return {
        organizationId: existingMembership.organizationId,
        teamId: existingMembership.teamId,
      };
    }

    const organizationId = `legacy-coach-org-${coachId}`;
    const teamId = `legacy-coach-team-${coachId}`;
    const now = serverTimestamp();

    const [userSnap, coachSnap] = await Promise.all([
      getDoc(doc(db, 'users', coachId)),
      getDoc(doc(db, 'coaches', coachId)),
    ]);

    const userData = userSnap.exists() ? (userSnap.data() as Record<string, any>) : {};
    const coachData = coachSnap.exists() ? (coachSnap.data() as Record<string, any>) : {};
    const coachName =
      String(userData.displayName || userData.username || coachData.username || userData.email || coachId).trim() || 'Coach';
    const coachEmail = String(userData.email || coachData.email || '').trim().toLowerCase();

    await Promise.all([
      setDoc(
        doc(db, PULSECHECK_ORGANIZATIONS_COLLECTION, organizationId),
        {
          displayName: `${coachName} Coaching`,
          legalName: `${coachName} Coaching`,
          organizationType: 'coach-led',
          status: 'active',
          legacySource: 'legacy-coach-roster',
          legacyCoachId: coachId,
          primaryCustomerAdminName: coachName,
          primaryCustomerAdminEmail: coachEmail,
          defaultStudyPosture: 'operational',
          defaultClinicianBridgeMode: 'none',
          notes: `Auto-created from coach-service bridge for ${coachName}.`,
          createdAt: now,
          updatedAt: now,
        },
        { merge: true }
      ),
      setDoc(
        doc(db, PULSECHECK_TEAMS_COLLECTION, teamId),
        {
          organizationId,
          displayName: `${coachName} Team`,
          teamType: 'coach-led',
          sportOrProgram: 'Coach-led organization',
          status: 'active',
          legacySource: 'legacy-coach-roster',
          legacyCoachId: coachId,
          defaultAdminName: coachName,
          defaultAdminEmail: coachEmail,
          defaultInvitePolicy: 'admin-staff-and-coaches',
          notes: `Auto-created from coach-service bridge for ${coachName}.`,
          createdAt: now,
          updatedAt: now,
        },
        { merge: true }
      ),
      setDoc(
        doc(db, PULSECHECK_ORGANIZATION_MEMBERSHIPS_COLLECTION, `${organizationId}_${coachId}`),
        {
          organizationId,
          userId: coachId,
          email: coachEmail,
          role: 'org-admin',
          status: 'active',
          grantedAt: now,
          createdAt: now,
          updatedAt: now,
        },
        { merge: true }
      ),
      setDoc(
        doc(db, PULSECHECK_TEAM_MEMBERSHIPS_COLLECTION, `${teamId}_${coachId}`),
        {
          organizationId,
          teamId,
          userId: coachId,
          email: coachEmail,
          role: 'team-admin',
          title: 'Coach',
          permissionSetId: 'pulsecheck-team-admin-v1',
          rosterVisibilityScope: 'team',
          allowedAthleteIds: [],
          onboardingStatus: 'pending-profile',
          grantedAt: now,
          createdAt: now,
          updatedAt: now,
        },
        { merge: true }
      ),
    ]);

    return { organizationId, teamId };
  }

  /**
   * Get a coach profile by user ID
   */
  async getCoachProfile(userId: string): Promise<CoachModel | null> {
    try {
      // First check if user has activeCoachAccount flag
      const userRef = doc(db, 'users', userId);
      const userDoc = await getDoc(userRef);
      
      if (!userDoc.exists()) {
        console.log('[CoachService] User document not found:', userId, '— falling back to coaches collection.');
        // Fallback: if a coach profile exists, allow access and backfill activeCoachAccount flag
        const coachRef = doc(db, 'coaches', userId);
        const coachDoc = await getDoc(coachRef);
        if (coachDoc.exists()) {
          try {
            // Attempt to set activeCoachAccount=true if users doc exists later
            const userRef = doc(db, 'users', userId);
            await setDoc(userRef, { activeCoachAccount: true, updatedAt: dateToUnixTimestamp(new Date()) }, { merge: true });
          } catch (_) { /* non-blocking */ }
          return new CoachModel(coachDoc.id, coachDoc.data() as CoachFirestoreData);
        }
        return null;
      }
      
      const userData = userDoc.data();
      
      // Check if user has activeCoachAccount flag OR if they have a coach profile
      if (!userData.activeCoachAccount) {
        // Fallback: Check if coach profile exists directly
        const coachRef = doc(db, 'coaches', userId);
        const coachDoc = await getDoc(coachRef);
        
        if (!coachDoc.exists()) {
          console.log('[CoachService] No activeCoachAccount flag and no coach profile found');
          return null;
        }
        
        // Coach profile exists, so update the user document
        console.log('[CoachService] Coach profile found, updating user activeCoachAccount flag');
        await updateDoc(userRef, { activeCoachAccount: true });
      }
      
      // Get coach profile using same userId as document ID
      const coachRef = doc(db, 'coaches', userId);
      const coachDoc = await getDoc(coachRef);
      
      if (!coachDoc.exists()) {
        return null;
      }
      
      const data = coachDoc.data();
      
      return new CoachModel(coachDoc.id, data as CoachFirestoreData);
    } catch (error) {
      console.error('Error fetching coach profile:', error);
      throw error;
    }
  }

  /**
   * Disconnect athlete from coach and remove legacy-sourced team memberships tied to that coach.
   */
  async disconnectAthleteFromCoach(coachId: string, athleteUserId: string): Promise<void> {
    try {
      const athleteMemberships = (await pulseCheckProvisioningService.listUserTeamMemberships(athleteUserId)).filter(
        (membership) =>
          membership.role === 'athlete' &&
          membership.legacySource === 'coach-athletes' &&
          membership.legacyCoachId === coachId
      );

      await Promise.all(
        athleteMemberships.map((membership) =>
          deleteDoc(doc(db, PULSECHECK_TEAM_MEMBERSHIPS_COLLECTION, membership.id))
        )
      );
    } catch (error) {
      console.error('Error disconnecting athlete from coach:', error);
      throw error;
    }
  }

  /**
   * List coaches connected to an athlete
   */
  async getConnectedCoaches(athleteUserId: string): Promise<Array<{ id: string; data: CoachFirestoreData }>> {
    try {
      const athleteMemberships = (await pulseCheckProvisioningService.listUserTeamMemberships(athleteUserId)).filter(
        (membership) => membership.role === 'athlete'
      );
      const activeCoachIds = new Set<string>();

      for (const athleteMembership of athleteMemberships) {
        const teamMemberships = await pulseCheckProvisioningService.listTeamMemberships(athleteMembership.teamId);
        teamMemberships
          .filter(
            (membership) =>
              DIRECT_COACH_ROLES.has(membership.role) &&
              membership.userId !== athleteUserId &&
              canCoachMembershipSeeAthlete(membership, athleteMembership)
          )
          .forEach((membership) => activeCoachIds.add(membership.userId));
      }

      const coachIds = Array.from(activeCoachIds);
      if (coachIds.length === 0) return [];
      const coachesRef = collection(db, 'coaches');
      const result: Array<{ id: string; data: CoachFirestoreData }> = [];
      for (const coachId of coachIds) {
        const cDoc = await getDoc(doc(coachesRef, coachId));
        if (cDoc.exists()) result.push({ id: cDoc.id, data: cDoc.data() as CoachFirestoreData });
      }
      return result;
    } catch (error) {
      console.error('Error getting connected coaches:', error);
      return [];
    }
  }

  /** Privacy helpers */
  async getPrivacyForCoach(athleteUserId: string, coachId: string): Promise<any | null> {
    try {
      const ref = doc(db, 'athlete-privacy-settings', athleteUserId, 'coaches', coachId);
      const snap = await getDoc(ref);
      return snap.exists() ? snap.data() : null;
    } catch (error) {
      console.error('Error fetching privacy for coach:', error);
      return null;
    }
  }

  async setPrivacyForCoach(athleteUserId: string, coachId: string, partial: Record<string, any>): Promise<void> {
    const now = dateToUnixTimestamp(new Date());
    const ref = doc(db, 'athlete-privacy-settings', athleteUserId, 'coaches', coachId);
    await setDoc(ref, { ...partial, updatedAt: now, createdAt: partial.createdAt ?? now }, { merge: true });
  }

  /**
   * Update coach subscription status
   */
  async updateSubscriptionStatus(userId: string, status: string): Promise<void> {
    try {
      const coachRef = doc(db, 'coaches', userId);
      await setDoc(coachRef, {
        subscriptionStatus: status,
        updatedAt: dateToUnixTimestamp(new Date())
      }, { merge: true });
    } catch (error) {
      console.error('Error updating subscription status:', error);
      throw error;
    }
  }

  /**
   * Link athlete to coach
   */
  async linkAthleteToCoach(coachId: string, athleteUserId: string): Promise<void> {
    try {
      const { organizationId, teamId } = await this.ensureCoachOperatingContext(coachId);
      await setDoc(
        doc(db, PULSECHECK_TEAM_MEMBERSHIPS_COLLECTION, `${teamId}_${athleteUserId}`),
        {
          organizationId,
          teamId,
          userId: athleteUserId,
          role: 'athlete',
          permissionSetId: 'pulsecheck-athlete-v1',
          rosterVisibilityScope: 'none',
          allowedAthleteIds: [],
          legacySource: 'coach-athletes',
          legacyCoachId: coachId,
          athleteOnboarding: defaultPulseCheckAthleteOnboarding(),
          onboardingStatus: 'pending-consent',
          grantedAt: serverTimestamp(),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      const privacyRef = doc(db, 'athlete-privacy-settings', athleteUserId, 'coaches', coachId);
      await setDoc(privacyRef, {
        athleteUserId,
        coachId,
        shareConversations: true,
        shareSentiment: true,
        shareActivity: true,
        consentGivenAt: serverTimestamp(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }, { merge: true });
    } catch (error) {
      console.error('Error linking athlete to coach:', error);
      throw error;
    }
  }

  /**
   * Get coach's athletes (simple list of IDs)
   */
  async getCoachAthletes(coachId: string): Promise<string[]> {
    try {
      const connections = await this.listPulseCheckAthleteConnectionsForCoach(coachId);
      return connections.map((entry) => entry.athleteMembership.userId);
    } catch (error) {
      console.error('Error fetching coach athletes:', error);
      throw error;
    }
  }

  /**
   * Get detailed athlete data for coach dashboard
   */
  async getConnectedAthletes(coachId: string): Promise<any[]> {
    try {
      console.log(`[CoachService] Fetching connected athletes for coach: ${coachId}`);
      const connections = await this.listPulseCheckAthleteConnectionsForCoach(coachId);
      console.log(`[CoachService] Found ${connections.length} PulseCheck athlete memberships for coach`);

      const athletes = [];
      for (const connection of connections) {
        const athleteUserId = connection.athleteMembership.userId;

        // Fetch user profile for each athlete
        const userRef = doc(db, 'users', athleteUserId);
        const userDoc = await getDoc(userRef);
        
        if (userDoc.exists()) {
          const userData = userDoc.data();
          
          // Get additional stats (conversations, sessions, etc.)
          // Defensive: ensure we have a valid instance context; fallback to singleton
          const self = (this as CoachService | undefined) || coachService;
          const athleteStats = await self.getAthleteStats(athleteUserId);

          // Last active should reflect the athlete's own PulseCheck history,
          // not when this team membership was created.
          const linkUpdated = toDateOrNull(
            connection.athleteMembership.updatedAt || connection.athleteMembership.grantedAt || connection.athleteMembership.createdAt
          );
          const lastActive =
            latestDateOf(athleteStats.lastCheckInDate, athleteStats.lastConversationDate) ||
            linkUpdated;
          
          // Honor the athlete's own profile image first (stored nested on the
          // User doc); fall back to the coach-preloaded invite image carried onto
          // the membership at redeem time. The flat `userData.profileImageUrl`
          // never existed, so every athlete fell through to initials.
          const membership = connection.athleteMembership as Record<string, any> | undefined;
          const ownProfileImage =
            userData.profileImage?.profileImageURL || userData.profileImageUrl || '';
          const preloadedInviteImage =
            membership?.prefilledProfileImageUrl ||
            membership?.athleteOnboarding?.prefilledProfileImageUrl ||
            '';

          athletes.push({
            id: athleteUserId,
            displayName: userData.displayName || userData.username || 'Unknown User',
            email: userData.email || '',
            profileImageUrl: ownProfileImage || preloadedInviteImage || undefined,
            linkedAt: connection.linkedAt,
            lastActiveDate: lastActive,
            ...athleteStats
          });
        }
      }

      console.log(`[CoachService] Found ${athletes.length} unique connected athletes`);
      return athletes;

    } catch (error) {
      console.error('[CoachService] Error fetching connected athletes:', error);
      return [];
    }
  }

  /**
   * Get athlete statistics and sentiment analysis
   */
  private async getAthleteStats(athleteUserId: string): Promise<{
    conversationCount: number;
    totalSessions: number;
    weeklyGoalProgress: number;
    sentimentScore: number;
    lastConversationDate?: Date;
    lastCheckInDate?: Date;
    lastTrainingDate?: Date;
  }> {
    try {
      console.log(`[CoachService] Fetching PulseCheck lifetime stats for athlete: ${athleteUserId}`);

      const [
        conversationSnapshot,
        noraConversationSnapshot,
        mentalCheckInSnapshot,
        morningCheckInSnapshot,
        simCompletionSnapshot,
        iosCompletionSnapshot,
        simSessionSnapshot,
        streakSnapshot,
        history,
      ] = await Promise.all([
        getDocs(query(collection(db, 'conversations'), where('userId', '==', athleteUserId))).catch(() => null),
        getDocs(query(collection(db, PULSECHECK_NORA_CONVERSATIONS_COLLECTION), where('athleteUserId', '==', athleteUserId))).catch(() => null),
        getDocs(collection(db, MENTAL_CHECKINS_ROOT, athleteUserId, 'check-ins')).catch(() => null),
        getDocs(query(collection(db, PULSECHECK_MORNING_CHECKINS_COLLECTION), where('athleteUserId', '==', athleteUserId))).catch(() => null),
        getDocs(collection(db, SIM_COMPLETIONS_ROOT, athleteUserId, 'completions')).catch(() => null),
        getDocs(collection(db, IOS_MENTAL_COMPLETIONS_ROOT, athleteUserId, 'completions')).catch(() => null),
        getDocs(collection(db, SIM_SESSIONS_ROOT, athleteUserId, 'sessions')).catch(() => null),
        getDoc(doc(db, MENTAL_TRAINING_STREAKS_COLLECTION, athleteUserId)).catch(() => null),
        this.getDailySentimentHistory(athleteUserId, 28).catch(() => []),
      ]);

      const conversationDates: Date[] = [];
      const addConversationDate = (data: Record<string, any>) => {
        const date = toDateOrNull(data.updatedAt || data.createdAt || data.lastTurnAt);
        if (date) conversationDates.push(date);
      };

      conversationSnapshot?.docs.forEach((docSnapshot) => addConversationDate(docSnapshot.data()));
      noraConversationSnapshot?.docs.forEach((docSnapshot) => addConversationDate(docSnapshot.data()));
      const lastConversationDate = latestDateOf(...conversationDates);

      const checkInDates = new Set<string>();
      const checkInDateValues: Date[] = [];
      const addCheckIn = (data: Record<string, any>) => {
        const dateKey = resolveDayKey(data);
        if (dateKey) checkInDates.add(dateKey);
        const date = toDateOrNull(data.createdAt || data.updatedAt) || (dateKey ? new Date(`${dateKey}T12:00:00`) : null);
        if (date) checkInDateValues.push(date);
      };
      mentalCheckInSnapshot?.docs.forEach((docSnapshot) => addCheckIn(docSnapshot.data()));
      morningCheckInSnapshot?.docs.forEach((docSnapshot) => addCheckIn(docSnapshot.data()));
      const lastCheckInDate = latestDateOf(...checkInDateValues);

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const rolling7Start = new Date(todayStart);
      rolling7Start.setDate(todayStart.getDate() - 6);
      const checkInsLast7 = Array.from(checkInDates).filter((dateKey) => {
        const date = new Date(`${dateKey}T12:00:00`);
        return date >= rolling7Start && date <= new Date(todayStart.getTime() + 86_399_999);
      }).length;
      const weeklyGoalProgress = Math.min(100, Math.round((checkInsLast7 / 7) * 100));

      const trainingDates: Date[] = [];
      const addTrainingDate = (data: Record<string, any>) => {
        const date = toDateOrNull(data.completedAt || data.updatedAt || data.createdAt);
        if (date) trainingDates.push(date);
      };
      simCompletionSnapshot?.docs.forEach((docSnapshot) => addTrainingDate(docSnapshot.data()));
      iosCompletionSnapshot?.docs.forEach((docSnapshot) => addTrainingDate(docSnapshot.data()));
      simSessionSnapshot?.docs.forEach((docSnapshot) => addTrainingDate(docSnapshot.data()));
      const lastTrainingDate = latestDateOf(...trainingDates);

      const completionTotal =
        countCompletedDocs(simCompletionSnapshot?.docs || []) +
        countCompletedDocs(iosCompletionSnapshot?.docs || []) +
        countCompletedDocs(simSessionSnapshot?.docs || []);
      const streakTotal = Number(streakSnapshot?.exists() ? streakSnapshot.data()?.totalExercisesCompleted : 0);
      const totalSessions = Math.max(completionTotal, Number.isFinite(streakTotal) ? streakTotal : 0);

      const conversationCount =
        (conversationSnapshot?.docs.length || 0) +
        (noraConversationSnapshot?.docs.length || 0);

      const latestHistoryRow = history.find((record) => record.messageCount > 0);
      const sentimentScore = latestHistoryRow?.sentimentScore ?? 0;

      const stats = {
        conversationCount,
        totalSessions,
        weeklyGoalProgress,
        sentimentScore,
        lastConversationDate,
        lastCheckInDate,
        lastTrainingDate,
      };

      console.log(`[CoachService] Calculated stats for ${athleteUserId}:`, stats);
      return stats;

    } catch (error) {
      console.error('[CoachService] Error fetching athlete stats:', error);
      return {
        conversationCount: 0,
        totalSessions: 0,
        weeklyGoalProgress: 0,
        sentimentScore: 0
      };
    }
  }

  /**
   * Get the athlete's real PulseCheck curriculum/assignment state for the coach profile drawer.
   * This mirrors the iOS read paths instead of synthesizing placeholder modules.
   */
  async getAthleteCurriculumSnapshot(athleteUserId: string): Promise<CoachAthleteCurriculumSnapshot> {
    try {
      const [dailySnapshot, curriculumSnapshot, progressSnapshot] = await Promise.all([
        getDocs(query(collection(db, PULSECHECK_DAILY_ASSIGNMENTS_COLLECTION), where('athleteId', '==', athleteUserId))).catch(() => null),
        getDocs(query(collection(db, MENTAL_CURRICULUM_ASSIGNMENTS_COLLECTION), where('athleteId', '==', athleteUserId))).catch(() => null),
        getDoc(doc(db, ATHLETE_MENTAL_PROGRESS_COLLECTION, athleteUserId)).catch(() => null),
      ]);

      const progress = progressSnapshot?.exists()
        ? athleteProgressFromFirestore(athleteUserId, progressSnapshot.data() as Record<string, any>)
        : null;

      const dailyAssignmentRecords = (dailySnapshot?.docs || [])
        .map((docSnapshot) => pulseCheckDailyAssignmentFromFirestore(docSnapshot.id, docSnapshot.data() as Record<string, any>))
        .filter(isDailyCurriculumRecord)
        .filter(
          (assignment) =>
            assignment.status !== PulseCheckDailyAssignmentStatus.Superseded &&
            assignment.status !== PulseCheckDailyAssignmentStatus.Overridden
        );

      // Collapse to one row per curriculum module (current slate), so a module
      // re-pinned across days doesn't show twice and crowd out other modules.
      const dailyItems: CoachAthleteCurriculumItem[] = dedupeDailyAssignmentsByModule(dailyAssignmentRecords)
        .map((assignment) => {
          const counts = dailyAssignmentCompletionCounts(assignment);
          return {
            id: assignment.id,
            kind: dailyAssignmentKind(assignment),
            source: 'daily-assignment' as const,
            title: dailyAssignmentTitle(assignment),
            detail: dailyAssignmentDetail(assignment),
            moduleKey: assignment.legacyExerciseId || assignment.protocolId || assignment.simSpecId || undefined,
            status: dailyAssignmentStatus(assignment),
            progressPct: dailyAssignmentProgressPct(assignment),
            dueToday: assignment.curriculumIsDueToday,
            updatedAt: dailyAssignmentUpdatedAt(assignment),
            ...counts,
          };
        });

      const curriculumItems: CoachAthleteCurriculumItem[] = (curriculumSnapshot?.docs || [])
        .map((docSnapshot) => {
          const raw = docSnapshot.data() as Record<string, any>;
          const assignment = curriculumAssignmentFromFirestore(docSnapshot.id, raw);
          const title = compactText(
            assignment.exercise?.name ||
              raw.exerciseName ||
              raw.exercise?.name ||
              assignment.exerciseId,
            80
          ) || 'Assigned practice';

          return {
            id: assignment.id,
            kind: 'curriculum' as const,
            source: 'curriculum-assignment' as const,
            title,
            detail: curriculumAssignmentDetail(assignment),
            moduleKey: assignment.exerciseId || undefined,
            status: curriculumAssignmentStatus(assignment),
            progressPct: curriculumAssignmentProgressPct(assignment),
            dueToday: assignment.status === CurriculumAssignmentStatus.Active || assignment.status === CurriculumAssignmentStatus.Extended,
            updatedAt: curriculumAssignmentUpdatedAt(assignment),
            ...curriculumAssignmentCompletionCounts(assignment),
          };
        });

      const activeAssignmentId = progress?.activeAssignmentId;
      const hasActiveAssignmentRow = Boolean(
        activeAssignmentId &&
          curriculumItems.some((item) => item.id === activeAssignmentId && item.status !== 'completed')
      );
      const activeProgramTitle = progressProgramTitle(progress);
      const progressItem: CoachAthleteCurriculumItem | null =
        activeProgramTitle && !hasActiveAssignmentRow
          ? {
              id: `athlete-progress:${athleteUserId}`,
              kind: 'program',
              source: 'athlete-progress',
              title: activeProgramTitle,
              detail: [
                humanizeToken(progress?.currentPathway) || 'Current pathway',
                typeof progress?.pathwayStep === 'number' && progress.pathwayStep > 0 ? `Step ${progress.pathwayStep}` : '',
                typeof progress?.currentStreak === 'number' && progress.currentStreak > 0 ? `${progress.currentStreak}-day streak` : '',
              ]
                .filter(Boolean)
                .join(' • '),
              status: 'in-progress',
              progressPct: 0,
              dueToday: true,
              updatedAt: toDateOrNull(progress?.updatedAt) || undefined,
            }
          : null;

      const sortByUpdatedAt = (left: CoachAthleteCurriculumItem, right: CoachAthleteCurriculumItem) =>
        (right.updatedAt?.getTime() || 0) - (left.updatedAt?.getTime() || 0);

      const activeDaily = dailyItems
        .filter((item) => item.status !== 'completed' && item.status !== 'paused')
        .sort((left, right) => Number(right.dueToday) - Number(left.dueToday) || sortByUpdatedAt(left, right));
      const activeCurriculum = curriculumItems
        .filter((item) => item.status !== 'completed' && item.status !== 'paused')
        .sort(sortByUpdatedAt);
      const recentCompleted = [...dailyItems, ...curriculumItems]
        .filter((item) => item.status === 'completed')
        .sort(sortByUpdatedAt);
      const paused = [...dailyItems, ...curriculumItems]
        .filter((item) => item.status === 'paused')
        .sort(sortByUpdatedAt);

      const seen = new Set<string>();
      const items = [...activeDaily, ...activeCurriculum, ...(progressItem ? [progressItem] : []), ...recentCompleted, ...paused]
        .filter((item) => {
          const key = curriculumItemDedupKey(item);
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .slice(0, 6);

      return {
        athleteId: athleteUserId,
        items,
        completedCount: items.filter((item) => item.status === 'completed').length,
        totalCount: items.length,
        currentPathway: progress?.currentPathway,
        pathwayStep: progress?.pathwayStep,
        totalAssignmentsCompleted: progress?.totalAssignmentsCompleted,
        totalExercisesMastered: progress?.totalExercisesMastered,
        activeProgramTitle: activeProgramTitle || undefined,
        lastUpdatedAt: latestDateOf(
          ...items.map((item) => item.updatedAt),
          toDateOrNull(progress?.updatedAt)
        ),
      };
    } catch (error) {
      console.error('[CoachService] Error fetching athlete curriculum snapshot:', error);
      return {
        athleteId: athleteUserId,
        items: [],
        completedCount: 0,
        totalCount: 0,
      };
    }
  }

  async getAthleteReadinessDailyDetails(athleteUserId: string, days: number = 14): Promise<AthleteReadinessDailyDetail[]> {
    try {
      const windowDays = Math.max(1, Math.min(60, Math.round(days || 14)));
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const dateKeys = Array.from({ length: windowDays }, (_, index) => {
        const date = new Date(today);
        date.setDate(today.getDate() - (windowDays - 1 - index));
        return ymd(date);
      });
      const allowedDates = new Set(dateKeys);

      type DailyAccumulator = AthleteReadinessDailyDetail & {
        noraTexts: string[];
        completedDailyAssignmentIds: Set<string>;
        countedCompletionKeys: Set<string>;
      };

      const byDate = new Map<string, DailyAccumulator>(
        dateKeys.map((date): [string, DailyAccumulator] => [
          date,
          {
            date,
            checkInCompleted: false,
            checkInCount: 0,
            noraChatCount: 0,
            noraMessageCount: 0,
            noraSentimentScore: null,
            moduleAssignedCount: 0,
            moduleCompletedCount: 0,
            moduleDurationSeconds: 0,
            noraTexts: [],
            completedDailyAssignmentIds: new Set<string>(),
            countedCompletionKeys: new Set<string>(),
          },
        ])
      );

      const getDay = (dateKey: string | null): DailyAccumulator | null => {
        if (!dateKey || !allowedDates.has(dateKey)) return null;
        return byDate.get(dateKey) || null;
      };

      const markCheckIn = (data: Record<string, any>) => {
        const detail = getDay(resolveDayKey(data));
        if (!detail) return;
        detail.checkInCompleted = true;
        detail.checkInCount += 1;
      };

      const addNoraMessages = (dateKey: string | null, messages: string[]) => {
        const detail = getDay(dateKey);
        if (!detail || messages.length === 0) return;
        detail.noraChatCount += 1;
        detail.noraMessageCount += messages.length;
        detail.noraTexts.push(...messages);
      };

      const isCompletedActivity = (data: Record<string, any>): boolean => {
        const status = String(data.status || data.sessionOutcome || '').toLowerCase();
        if (status && ['aborted', 'cancelled', 'canceled', 'queued', 'assigned', 'pending'].includes(status)) {
          return false;
        }
        if (status && ['completed', 'complete', 'done', 'finished', 'success', 'succeeded', 'passed'].includes(status)) {
          return true;
        }
        if (data.completed === true || data.isCompleted === true) return true;
        return toMillis(data.completedAt || data.endedAt || data.finishedAt) !== null;
      };

      const addStandaloneCompletion = (
        dateKey: string | null,
        source: string,
        rawId: string,
        data: Record<string, any>
      ) => {
        const detail = getDay(dateKey);
        if (!detail) return;

        const dailyAssignmentId = String(data.dailyAssignmentId || data.assignmentId || data.pulseCheckDailyAssignmentId || '').trim();
        if (dailyAssignmentId && detail.completedDailyAssignmentIds.has(dailyAssignmentId)) return;

        const key = `${source}:${rawId || dailyAssignmentId || detail.countedCompletionKeys.size}`;
        if (detail.countedCompletionKeys.has(key)) return;
        detail.countedCompletionKeys.add(key);

        detail.moduleCompletedCount += 1;
        detail.moduleDurationSeconds += positiveDurationSeconds(
          data.durationSeconds,
          data.completionSummary?.durationSeconds,
          data.elapsedSeconds,
        );
      };

      const [
        mentalCheckInSnapshot,
        morningCheckInSnapshot,
        conversationSnapshot,
        noraConversationSnapshot,
        dailyAssignmentSnapshot,
        simCompletionSnapshot,
        iosCompletionSnapshot,
        simSessionSnapshot,
      ] = await Promise.all([
        getDocs(collection(db, MENTAL_CHECKINS_ROOT, athleteUserId, 'check-ins')).catch(() => null),
        getDocs(query(collection(db, PULSECHECK_MORNING_CHECKINS_COLLECTION), where('athleteUserId', '==', athleteUserId))).catch(() => null),
        getDocs(query(collection(db, 'conversations'), where('userId', '==', athleteUserId))).catch(() => null),
        getDocs(query(collection(db, PULSECHECK_NORA_CONVERSATIONS_COLLECTION), where('athleteUserId', '==', athleteUserId))).catch(() => null),
        getDocs(query(collection(db, PULSECHECK_DAILY_ASSIGNMENTS_COLLECTION), where('athleteId', '==', athleteUserId))).catch(() => null),
        getDocs(collection(db, SIM_COMPLETIONS_ROOT, athleteUserId, 'completions')).catch(() => null),
        getDocs(collection(db, IOS_MENTAL_COMPLETIONS_ROOT, athleteUserId, 'completions')).catch(() => null),
        getDocs(collection(db, SIM_SESSIONS_ROOT, athleteUserId, 'sessions')).catch(() => null),
      ]);

      mentalCheckInSnapshot?.docs.forEach((docSnapshot) => markCheckIn(docSnapshot.data()));
      morningCheckInSnapshot?.docs.forEach((docSnapshot) => markCheckIn(docSnapshot.data()));

      conversationSnapshot?.docs.forEach((docSnapshot) => {
        const data = docSnapshot.data();
        const messages = Array.isArray(data.messages)
          ? data.messages
              .filter((message: any) => {
                const sender = String(message?.sender || message?.role || '').toLowerCase();
                return message?.isFromUser === true || sender === 'user' || sender === 'athlete';
              })
              .map((message: any) => String(message?.content || '').trim())
              .filter(Boolean)
          : [];
        addNoraMessages(
          resolveDayKey({ ...data, createdAt: data.createdAt || data.updatedAt || data.lastTurnAt }),
          messages
        );
      });

      noraConversationSnapshot?.docs.forEach((docSnapshot) => {
        const data = docSnapshot.data();
        const turns = Array.isArray(data.turns) ? data.turns : [];
        addNoraMessages(
          resolveDayKey({ ...data, createdAt: data.createdAt || data.updatedAt || data.lastTurnAt }),
          extractPulseCheckConversationTexts(turns)
        );
      });

      dailyAssignmentSnapshot?.docs.forEach((docSnapshot) => {
        const assignment = pulseCheckDailyAssignmentFromFirestore(
          docSnapshot.id,
          docSnapshot.data() as Record<string, any>
        );
        if (!isDailyCurriculumRecord(assignment)) return;
        if (
          assignment.status === PulseCheckDailyAssignmentStatus.Superseded ||
          assignment.status === PulseCheckDailyAssignmentStatus.Overridden
        ) {
          return;
        }

        const detail = getDay(assignment.sourceDate || resolveDayKey(assignment as unknown as Record<string, any>));
        if (!detail) return;
        detail.moduleAssignedCount += 1;
        if (isDailyAssignmentComplete(assignment)) {
          detail.moduleCompletedCount += 1;
          detail.completedDailyAssignmentIds.add(assignment.id);
          if (assignment.lineageId) detail.completedDailyAssignmentIds.add(assignment.lineageId);
          detail.moduleDurationSeconds += dailyAssignmentCompletionDurationSeconds(assignment);
        }
      });

      simCompletionSnapshot?.docs.forEach((docSnapshot) => {
        const data = docSnapshot.data();
        if (!isCompletedActivity(data)) return;
        addStandaloneCompletion(
          resolveDayKey({ ...data, completedAt: data.completedAt || data.updatedAt || data.createdAt }),
          'sim-completion',
          docSnapshot.id,
          data
        );
      });

      iosCompletionSnapshot?.docs.forEach((docSnapshot) => {
        const data = docSnapshot.data();
        if (!isCompletedActivity(data)) return;
        addStandaloneCompletion(
          resolveDayKey({ ...data, completedAt: data.completedAt || data.updatedAt || data.createdAt }),
          'exercise-completion',
          docSnapshot.id,
          data
        );
      });

      simSessionSnapshot?.docs.forEach((docSnapshot) => {
        const data = docSnapshot.data();
        if (!isCompletedActivity(data)) return;
        addStandaloneCompletion(
          resolveDayKey({ ...data, completedAt: data.completedAt || data.endedAt || data.updatedAt || data.createdAt }),
          'sim-session',
          docSnapshot.id,
          data
        );
      });

      return dateKeys.map((date) => {
        const detail = byDate.get(date)!;
        return {
          date,
          checkInCompleted: detail.checkInCompleted,
          checkInCount: detail.checkInCount,
          noraChatCount: detail.noraChatCount,
          noraMessageCount: detail.noraMessageCount,
          noraSentimentScore: detail.noraTexts.length ? this.calculateBasicSentiment(detail.noraTexts) : null,
          moduleAssignedCount: detail.moduleAssignedCount,
          moduleCompletedCount: detail.moduleCompletedCount,
          moduleDurationSeconds: detail.moduleDurationSeconds,
        };
      });
    } catch (error) {
      console.error('[CoachService] Error fetching athlete readiness daily details:', error);
      return [];
    }
  }

  /**
   * Advanced sentiment analysis using Hugging Face API
   */
  private async analyzeSentimentWithHF(messages: string[]): Promise<number> {
    try {
      console.log(`[CoachService] Analyzing sentiment for ${messages.length} messages using Hugging Face`);
      
      // Call our Netlify function
      const response = await fetch('/.netlify/functions/analyze-sentiment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ messages })
      });
      
      if (!response.ok) {
        throw new Error(`Sentiment API responded with status: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (result.error) {
        throw new Error(`Sentiment API error: ${result.error}`);
      }
      
      console.log(`[CoachService] HF Sentiment analysis result:`, result);
      return result.sentimentScore || 0;
      
    } catch (error) {
      console.error('[CoachService] Hugging Face sentiment analysis failed:', error);
      throw error; // Re-throw to trigger fallback
    }
  }

  /**
   * Analyze sentiment using unified API endpoint
   */
  private async analyzeSentimentWithAPI(messages: string[], userId: string): Promise<number> {
    try {
      console.log(`[CoachService] Calling sentiment API for ${messages.length} messages`);
      
      const response = await fetch('/.netlify/functions/analyze-sentiment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages,
          userId,
          platform: 'web',
          strategy: 'hybrid'
        })
      });

      if (!response.ok) {
        throw new Error(`Sentiment API error: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.error) {
        throw new Error(`Sentiment API error: ${result.error}`);
      }

      console.log(`[CoachService] Sentiment API result: ${result.sentimentScore} (${result.metadata?.strategy})`);
      return result.sentimentScore;

    } catch (error) {
      console.error('[CoachService] Sentiment API failed, using fallback:', error);
      // Fallback to basic analysis if API fails
      return this.calculateBasicSentiment(messages);
    }
  }

  /**
   * Basic sentiment analysis using keyword matching (fallback)
   */
  private calculateBasicSentiment(messages: string[]): number {
    const positiveWords = [
      // Basic positive
      'good', 'great', 'awesome', 'excellent', 'happy', 'love', 'amazing', 'perfect', 'wonderful', 'fantastic',
      // Emotions & feelings
      'excited', 'motivated', 'proud', 'confident', 'strong', 'energetic', 'optimistic', 'cheerful', 'joyful',
      'grateful', 'blessed', 'content', 'satisfied', 'pleased', 'delighted', 'thrilled', 'ecstatic',
      // Performance & achievement
      'successful', 'accomplished', 'achieved', 'improved', 'progress', 'better', 'best', 'winning', 'victory',
      'breakthrough', 'milestone', 'personal record', 'pr', 'crushed', 'nailed', 'killed it', 'smashed',
      // Physical & mental state
      'strong', 'powerful', 'fit', 'healthy', 'energized', 'refreshed', 'recovered', 'ready', 'focused',
      'determined', 'committed', 'dedicated', 'disciplined', 'consistent', 'resilient',
      // Social & support
      'supported', 'encouraged', 'inspired', 'uplifted', 'connected', 'understood', 'appreciated',
      // General positive
      'yes', 'absolutely', 'definitely', 'certainly', 'outstanding', 'incredible', 'remarkable', 'impressive'
    ];
    
    const negativeWords = [
      // Basic negative
      'bad', 'terrible', 'awful', 'hate', 'sad', 'angry', 'frustrated', 'disappointed', 'horrible', 'worst',
      // Emotions & feelings
      'depressed', 'anxious', 'worried', 'stressed', 'overwhelmed', 'discouraged', 'hopeless', 'defeated',
      'miserable', 'upset', 'annoyed', 'irritated', 'furious', 'devastated', 'heartbroken', 'lonely',
      // Physical & mental state
      'tired', 'exhausted', 'weak', 'sick', 'injured', 'hurt', 'pain', 'painful', 'sore', 'aching',
      'drained', 'burnt out', 'burnout', 'fatigued', 'sluggish', 'unmotivated', 'lazy', 'lethargic',
      // Performance & setbacks
      'failed', 'failure', 'struggling', 'stuck', 'plateau', 'regression', 'setback', 'disappointed',
      'underperformed', 'missed', 'skipped', 'quit', 'gave up', 'surrender', 'defeated', 'lost',
      // Mental challenges
      'confused', 'lost', 'uncertain', 'doubtful', 'insecure', 'self-doubt', 'imposter', 'inadequate',
      'worthless', 'useless', 'hopeless', 'helpless', 'powerless', 'overwhelmed', 'stressed out',
      // Social & isolation
      'alone', 'isolated', 'unsupported', 'misunderstood', 'ignored', 'rejected', 'abandoned',
      // General negative
      'no', 'never', 'impossible', 'can\'t', 'won\'t', 'shouldn\'t', 'terrible', 'disaster', 'nightmare'
    ];
    
    let positiveCount = 0;
    let negativeCount = 0;
    let totalWords = 0;
    
    messages.forEach(message => {
      const words = message.toLowerCase().split(/\s+/);
      totalWords += words.length;
      
      words.forEach(word => {
        if (positiveWords.includes(word)) positiveCount++;
        if (negativeWords.includes(word)) negativeCount++;
      });
    });
    
    if (totalWords === 0) return 0;
    
    // Calculate sentiment score between -1 and 1
    const sentimentRatio = (positiveCount - negativeCount) / totalWords;
    return Math.max(-1, Math.min(1, sentimentRatio * 10)); // Scale and clamp
  }

  /**
   * Process sentiment analysis for the last N days for a specific athlete
   */
  async processSentimentForAthlete(athleteUserId: string, days: number = 28): Promise<DailySentimentRecord[]> {
    try {
      console.log(`🔄 [CoachService] STEP 1: Starting sentiment processing for athlete ${athleteUserId} for last ${days} days`);
      console.log(`📅 [CoachService] Current date: ${new Date().toISOString()}`);
      
      // First, get all conversation dates for this user
      const conversationDates = await this.getConversationDates(athleteUserId);
      console.log(`📊 [CoachService] STEP 2: Found ${conversationDates.length} unique conversation dates:`, conversationDates);
      
      // Process ALL conversation dates (no filtering)
      const today = new Date();
      
      console.log(`🗓️ [CoachService] STEP 3: Processing ALL conversation dates - Today: ${today.toISOString().split('T')[0]}`);
      
      const recentDates = conversationDates.map(dateString => {
        const conversationDate = new Date(dateString);
        const daysAgo = Math.floor((today.getTime() - conversationDate.getTime()) / (1000 * 60 * 60 * 24));
        console.log(`   📅 Date ${dateString}: ✅ INCLUDED (${daysAgo} days ago)`);
        return dateString;
      });
      
      console.log(`🎯 [CoachService] STEP 4: Processing ${recentDates.length} conversation dates:`, recentDates);
      
      // Generate complete date range for the last N days (including days with no conversations)
      const completeDateRange: string[] = [];
      for (let i = 0; i < days; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() - i);
        const dateString = date.toISOString().split('T')[0];
        completeDateRange.push(dateString);
      }
      
      console.log(`📅 [CoachService] STEP 4b: Complete ${days}-day range:`, completeDateRange);
      
      const results: DailySentimentRecord[] = [];
      
      // Process each day in the complete range
      for (let i = 0; i < completeDateRange.length; i++) {
        const dateString = completeDateRange[i];
        const hasConversation = recentDates.includes(dateString);
        
        console.log(`\n🔍 [CoachService] STEP 5.${i + 1}: Processing ${dateString} ${hasConversation ? '(HAS CONVERSATIONS)' : '(NO CONVERSATIONS)'}`);
        
        let messagesForDate: string[] = [];
        
        if (hasConversation) {
          // Get messages for this specific date
          messagesForDate = await this.getMessagesForDate(athleteUserId, dateString);
          console.log(`📝 [CoachService] STEP 5.${i + 1}a: Found ${messagesForDate.length} messages for ${dateString}`);
        } else {
          console.log(`📝 [CoachService] STEP 5.${i + 1}a: No conversations on ${dateString} - will create "No Data" record`);
        }
        
        // Create or update sentiment record (will be "No Data" if no messages)
        const sentimentRecord = await this.createOrUpdateDailySentiment(athleteUserId, dateString, messagesForDate);
        console.log(`💭 [CoachService] STEP 5.${i + 1}b: Sentiment record for ${dateString}:`, sentimentRecord ? `✅ Created (sentiment: ${sentimentRecord.sentimentScore}, messages: ${sentimentRecord.messageCount})` : '❌ Failed');
        
        if (sentimentRecord) {
          results.push(sentimentRecord);
        }
      }
      
      // Sort results by date (newest first)
      results.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
      console.log(`\n🎉 [CoachService] STEP 6: FINAL RESULTS - Processed ${results.length} days of sentiment data:`);
      results.forEach((result, index) => {
        console.log(`   ${index + 1}. ${result.date}: ${result.sentimentScore.toFixed(3)} sentiment (${result.messageCount} messages)`);
      });
      
      return results;
      
    } catch (error) {
      console.error('❌ [CoachService] Error processing sentiment for athlete:', error);
      return [];
    }
  }

  /**
   * Get all unique conversation dates for a user - USING SAME LOGIC AS CONVERSATION MODAL
   */
  private async getConversationDates(userId: string): Promise<string[]> {
    try {
      console.log(`🔍 [CoachService] Getting conversation dates for user: ${userId} - USING CONVERSATION MODAL LOGIC`);
      
      // Use EXACT same logic as getAthleteConversations
      const conversationsRef = collection(db, 'conversations');
      const conversationQuery = query(conversationsRef, where('userId', '==', userId));
      const conversationSnapshot = await getDocs(conversationQuery);
      
      console.log(`📄 [CoachService] Found ${conversationSnapshot.docs.length} conversation documents`);
      
      const dates = new Set<string>();
      const sessions: Array<{id: string, startTime: Date}> = [];
      
      // Create sessions EXACTLY like the conversation modal does
      conversationSnapshot.docs.forEach(docSnapshot => {
        const conversationData = docSnapshot.data();
        
        if (conversationData.messages && Array.isArray(conversationData.messages)) {
          const session = {
            id: docSnapshot.id,
            startTime: convertFirestoreTimestamp(conversationData.createdAt)
          };
          sessions.push(session);
        }
      });
      
      // Sort sessions by start time (newest first) - SAME as conversation modal
      sessions.sort((a, b) => b.startTime.getTime() - a.startTime.getTime());
      
      // Extract dates from sessions - SAME display logic as conversation modal
      sessions.forEach((session, index) => {
        // Use LOCAL DATE STRING like the conversation modal displays
        const localDateString = session.startTime.toLocaleDateString('en-CA'); // YYYY-MM-DD format
        
        console.log(`   📅 Session ${index + 1} (${session.id}): startTime=${session.startTime.toISOString()}, localDate=${localDateString}`);
        
        // Special logging for Aug 11
        if (localDateString === '2025-08-11') {
          console.log(`🚨 FOUND AUG 11 SESSION: ${session.id} at ${session.startTime.toISOString()}`);
        }
        
        dates.add(localDateString);
      });
      
      const sortedDates = Array.from(dates).sort((a, b) => b.localeCompare(a));
      console.log(`📊 [CoachService] Extracted ${dates.size} unique LOCAL dates from ${sessions.length} sessions:`, sortedDates);
      
      return sortedDates;
    } catch (error) {
      console.error('❌ [CoachService] Error getting conversation dates:', error);
      return [];
    }
  }

  /**
   * Get messages for a specific date - USING SAME LOCAL DATE LOGIC AS CONVERSATION MODAL
   * Public method for accessing message content for coach tooltips
   */
  async getMessagesForDate(userId: string, dateString: string): Promise<string[]> {
    try {
      console.log(`🔍 [CoachService] Searching for messages for user ${userId} on date ${dateString}`);
      
      const conversationsRef = collection(db, 'conversations');
      const conversationQuery = query(conversationsRef, where('userId', '==', userId));
      const conversationSnapshot = await getDocs(conversationQuery);
      
      console.log(`📄 [CoachService] Found ${conversationSnapshot.docs.length} conversation documents to check`);
      
      const messagesForDate: string[] = [];
      let totalMessagesChecked = 0;
      let userMessagesFound = 0;
      let conversationsMatchingDate = 0;
      let conversationsProcessed = 0;
      
      conversationSnapshot.docs.forEach(docSnapshot => {
        conversationsProcessed++;
        const conversationData = docSnapshot.data();
        
        // Use SAME LOCAL DATE logic as conversation modal
        const conversationDate = convertFirestoreTimestamp(conversationData.createdAt);
        const localDateString = conversationDate.toLocaleDateString('en-CA'); // YYYY-MM-DD format
        
        const matches = localDateString === dateString;
        console.log(`   📅 Conversation ${conversationsProcessed} (${docSnapshot.id.substring(0, 8)}...): ${localDateString} ${matches ? '✅ MATCHES' : '❌ NO MATCH'} (target: ${dateString})`);
        
        // Only process conversations that match the target date
        if (matches && conversationData.messages && Array.isArray(conversationData.messages)) {
          conversationsMatchingDate++;
          console.log(`      📝 Processing ${conversationData.messages.length} messages from matching conversation`);
          
          conversationData.messages.forEach((message: any, index: number) => {
            totalMessagesChecked++;
            
            if (message.isFromUser === true && message.content) {
              userMessagesFound++;
              messagesForDate.push(message.content);
              
              console.log(`      ✅ Message ${index + 1}: "${message.content.substring(0, 30)}..." (${message.content.length} chars)`);
            } else {
              console.log(`      ⏭️ Message ${index + 1}: ${!message.isFromUser ? 'AI message' : 'No content'} - skipped`);
            }
          });
        }
      });
      
      console.log(`📊 [CoachService] SUMMARY for ${dateString}:`);
      console.log(`   📄 Conversations processed: ${conversationsProcessed}`);
      console.log(`   ✅ Conversations matching date: ${conversationsMatchingDate}`);
      console.log(`   📝 Total messages checked: ${totalMessagesChecked}`);
      console.log(`   👤 User messages found: ${userMessagesFound}`);
      console.log(`   💬 Final message count: ${messagesForDate.length}`);
      
      return messagesForDate;
    } catch (error) {
      console.error(`❌ [CoachService] Error getting messages for ${dateString}:`, error);
      return [];
    }
  }

  /**
   * Create or update daily sentiment record
   */
  private async createOrUpdateDailySentiment(userId: string, dateString: string, messages: string[]): Promise<DailySentimentRecord | null> {
    try {
      const recordId = `${userId}_${dateString}`;
      const sentimentRef = doc(db, 'dailySentimentAnalysis', recordId);
      
      // Analyze sentiment using unified API
      console.log(`🤖 [CoachService] Analyzing sentiment for ${messages.length} messages on ${dateString}`);
      const sentimentScore = messages.length > 0 ? await this.analyzeSentimentWithAPI(messages, userId) : 0;
      console.log(`📊 [CoachService] Sentiment analysis result for ${dateString}: ${sentimentScore}`);
      
      const recordData = {
        id: recordId,
        userId,
        date: dateString,
        sentimentScore,
        messageCount: messages.length,
        lastAnalyzedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      
      // Check if record exists
      const existingDoc = await getDoc(sentimentRef);
      
      if (existingDoc.exists()) {
        // Update existing record
        await setDoc(sentimentRef, recordData, { merge: true });
        console.log(`[CoachService] Updated sentiment for ${dateString}: ${sentimentScore} (${messages.length} messages)`);
      } else {
        // Create new record
        await setDoc(sentimentRef, {
          ...recordData,
          createdAt: serverTimestamp()
        });
        console.log(`[CoachService] Created sentiment for ${dateString}: ${sentimentScore} (${messages.length} messages)`);
      }
      
      // Return the record with proper dates
      return {
        id: recordId,
        userId,
        date: dateString,
        sentimentScore,
        messageCount: messages.length,
        lastAnalyzedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
    } catch (error) {
      console.error(`[CoachService] Error creating/updating sentiment for ${dateString}:`, error);
      return null;
    }
  }

  /**
   * Get sentiment history for a user. This is intentionally athlete-history
   * scoped, not team-membership scoped: once a coach can see the athlete, the
   * chart backfills the athlete's PulseCheck check-ins and Nora sessions.
   */
  async getDailySentimentHistory(userId: string, days: number = 28, coachId?: string): Promise<DailySentimentRecord[]> {
    try {
      console.log(`📊 [CoachService] Loading PulseCheck sentiment history for user: ${userId}`);
      
      // Check privacy settings if coachId is provided
      if (coachId) {
        const canAccess = await privacyService.canCoachAccessSentiment(userId, coachId);
        if (!canAccess) {
          console.log(`[CoachService] Coach ${coachId} does not have permission to access sentiment data for athlete ${userId}`);
          return []; // Return empty array if no permission
        }
      }

      const now = new Date();
      const oldest = new Date(now);
      oldest.setHours(0, 0, 0, 0);
      oldest.setDate(oldest.getDate() - Math.max(0, days - 1));
      const aggregates = new Map<string, DailySignalAggregate>();

      const addAggregate = (dateKey: string | null, sentimentScore: number, messageCount = 1, at?: Date | null) => {
        if (!dateKey || messageCount <= 0) return;
        const date = new Date(`${dateKey}T12:00:00`);
        if (!Number.isFinite(date.getTime()) || date < oldest) return;
        const latestAt = at && Number.isFinite(at.getTime()) ? at : date;
        const existing = aggregates.get(dateKey) || {
          scoreSum: 0,
          scoreCount: 0,
          messageCount: 0,
          latestAt,
        };
        existing.scoreSum += clampSentiment(sentimentScore);
        existing.scoreCount += 1;
        existing.messageCount += messageCount;
        if (latestAt > existing.latestAt) existing.latestAt = latestAt;
        aggregates.set(dateKey, existing);
      };

      const [
        existingSentimentSnapshot,
        mentalCheckInSnapshot,
        morningCheckInSnapshot,
        conversationSnapshot,
        noraConversationSnapshot,
      ] = await Promise.all([
        getDocs(
          query(
            collection(db, 'dailySentimentAnalysis'),
            where('userId', '==', userId),
            orderBy('date', 'desc'),
            limit(days)
          )
        ).catch(() => null),
        getDocs(collection(db, MENTAL_CHECKINS_ROOT, userId, 'check-ins')).catch(() => null),
        getDocs(query(collection(db, PULSECHECK_MORNING_CHECKINS_COLLECTION), where('athleteUserId', '==', userId))).catch(() => null),
        getDocs(query(collection(db, 'conversations'), where('userId', '==', userId))).catch(() => null),
        getDocs(query(collection(db, PULSECHECK_NORA_CONVERSATIONS_COLLECTION), where('athleteUserId', '==', userId))).catch(() => null),
      ]);

      existingSentimentSnapshot?.docs.forEach((docSnapshot) => {
        const data = docSnapshot.data();
        const messageCount = Number(data.messageCount || 0);
        if (messageCount > 0) {
          addAggregate(
            String(data.date || '').trim(),
            Number(data.sentimentScore || 0),
            messageCount,
            toDateOrNull(data.updatedAt || data.lastAnalyzedAt || data.createdAt)
          );
        }
      });

      mentalCheckInSnapshot?.docs.forEach((docSnapshot) => {
        const data = docSnapshot.data();
        addAggregate(
          resolveDayKey(data),
          resolveCheckInSentiment(data),
          1,
          toDateOrNull(data.createdAt || data.updatedAt)
        );
      });

      morningCheckInSnapshot?.docs.forEach((docSnapshot) => {
        const data = docSnapshot.data();
        addAggregate(
          resolveDayKey(data),
          resolveCheckInSentiment(data),
          1,
          toDateOrNull(data.createdAt || data.updatedAt)
        );
      });

      conversationSnapshot?.docs.forEach((docSnapshot) => {
        const data = docSnapshot.data();
        const messages = Array.isArray(data.messages)
          ? data.messages
              .filter((message: any) => {
                const sender = String(message?.sender || message?.role || '').toLowerCase();
                return message?.isFromUser === true || sender === 'user' || sender === 'athlete';
              })
              .map((message: any) => String(message?.content || '').trim())
              .filter(Boolean)
          : [];
        const dateKey = resolveDayKey({ ...data, createdAt: data.createdAt || data.updatedAt });
        addAggregate(
          dateKey,
          messages.length ? this.calculateBasicSentiment(messages) : 0,
          messages.length,
          toDateOrNull(data.updatedAt || data.createdAt)
        );
      });

      noraConversationSnapshot?.docs.forEach((docSnapshot) => {
        const data = docSnapshot.data();
        const turns = Array.isArray(data.turns) ? data.turns : [];
        const texts = extractPulseCheckConversationTexts(turns);
        const messageCount = countPulseCheckConversationTurns(turns);
        addAggregate(
          resolveDayKey({ ...data, createdAt: data.createdAt || data.updatedAt }),
          texts.length ? this.calculateBasicSentiment(texts) : 0,
          messageCount,
          toDateOrNull(data.updatedAt || data.createdAt)
        );
      });

      const sentimentHistory = Array.from(aggregates.entries())
        .map(([date, aggregate]) => {
          const score = aggregate.scoreCount > 0 ? aggregate.scoreSum / aggregate.scoreCount : 0;
          return {
            id: `${userId}_${date}`,
            userId,
            date,
            sentimentScore: clampSentiment(score),
            messageCount: aggregate.messageCount,
            lastAnalyzedAt: aggregate.latestAt,
            createdAt: aggregate.latestAt,
            updatedAt: aggregate.latestAt,
          };
        })
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, days);

      console.log(`📊 [CoachService] Loaded ${sentimentHistory.length} PulseCheck history rows, dates: ${sentimentHistory.map(r => r.date).join(', ')}`);

      return sentimentHistory; // Return in reverse chronological order (newest first)
    } catch (error) {
      console.error('[CoachService] Error fetching sentiment history:', error);
      return [];
    }
  }

  /**
   * Get conversation history for an athlete
   */
  async getAthleteConversations(athleteUserId: string, coachId?: string): Promise<ConversationSession[]> {
    try {
      console.log(`[CoachService] Fetching conversations for athlete: ${athleteUserId}`);
      
      // Check privacy settings if coachId is provided
      if (coachId) {
        const canAccess = await privacyService.canCoachAccessConversations(athleteUserId, coachId);
        if (!canAccess) {
          console.log(`[CoachService] Coach ${coachId} does not have permission to access conversations for athlete ${athleteUserId}`);
          return []; // Return empty array if no permission
        }
      }
      
      const conversationsRef = collection(db, 'conversations');
      const conversationQuery = query(conversationsRef, where('userId', '==', athleteUserId));
      const conversationSnapshot = await getDocs(conversationQuery);
      
      const sessions: ConversationSession[] = [];
      
      conversationSnapshot.docs.forEach(docSnapshot => {
        const conversationData = docSnapshot.data();
        
        if (conversationData.messages && Array.isArray(conversationData.messages)) {
          // Group messages by session (assuming each conversation document is a session)
          const session: ConversationSession = {
            id: docSnapshot.id,
            athleteUserId,
            startTime: convertFirestoreTimestamp(conversationData.createdAt),
            endTime: convertFirestoreTimestamp(conversationData.updatedAt),
            messages: conversationData.messages.map((msg: any) => ({
              id: msg.id || `${docSnapshot.id}_${msg.timestamp}`,
              content: msg.content || '',
              sender: msg.sender || (msg.isFromUser === false ? 'ai' : 'user'),
              timestamp: convertFirestoreTimestamp(msg.timestamp),
              type: msg.type || 'text'
            }))
          };
          
          // Sort messages by timestamp
          session.messages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
          
          sessions.push(session);
        }
      });
      
      // Sort sessions by start time (newest first)
      sessions.sort((a, b) => b.startTime.getTime() - a.startTime.getTime());
      
      console.log(`[CoachService] Found ${sessions.length} conversation sessions with ${sessions.reduce((total, session) => total + session.messages.length, 0)} total messages`);
      
      return sessions;
    } catch (error) {
      console.error('[CoachService] Error fetching athlete conversations:', error);
      return [];
    }
  }

  /**
   * Create mock athlete data for testing (temporary method)
   */
  async createMockAthlete(coachId: string, athleteName: string, athleteEmail: string): Promise<void> {
    try {
      // Create a mock user document
      const mockUserId = `mock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const userRef = doc(db, 'users', mockUserId);
      
      const now = dateToUnixTimestamp(new Date());
      await setDoc(userRef, {
        id: mockUserId,
        displayName: athleteName,
        email: athleteEmail,
        username: athleteName.toLowerCase().replace(/\s+/g, ''),
        profileImageUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(athleteName)}&background=E0FE10&color=000000&size=128`,
        createdAt: now,
        updatedAt: now
      });

      await this.linkAthleteToCoach(coachId, mockUserId);

      console.log(`[CoachService] Created mock athlete: ${athleteName} (${mockUserId})`);
    } catch (error) {
      console.error('[CoachService] Error creating mock athlete:', error);
      throw error;
    }
  }
}

export const coachService = new CoachService();
