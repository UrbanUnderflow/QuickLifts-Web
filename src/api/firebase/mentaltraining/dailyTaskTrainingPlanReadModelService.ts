import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../config';
import { PULSECHECK_DAILY_ASSIGNMENTS_COLLECTION } from './collections';
import { assignmentService } from './assignmentService';
import { curriculumAssignmentService } from './curriculumAssignmentService';
import { trainingPlanService } from './trainingPlanService';
import {
  AssignmentSource,
  AssignmentStatus,
  CurriculumAssignmentStatus,
  type PulseCheckDailyAssignment,
  type PulseCheckTrainingPlan,
  pulseCheckDailyAssignmentFromFirestore,
} from './types';

export type AthleteWorkPlanSource = 'training_plan';
export type AthleteTodayState = 'has_daily_task' | 'no_task_yet' | 'between_programs';
export type AthleteLegacyAdapterKind = 'curriculum' | 'manual';

export interface AthleteLegacyAdapterEntry {
  id: string;
  kind: AthleteLegacyAdapterKind;
  title: string;
  status: string;
  source: string;
  updatedAt: number;
  active: boolean;
}

export interface AthleteWorkPlanEntry {
  plan: PulseCheckTrainingPlan;
  source: AthleteWorkPlanSource;
  isAdapter: boolean;
}

export interface AthleteLegacyMigrationSummary {
  curriculumPlanCount: number;
  secondaryWorkCount: number;
  primaryFallbackSuppressed: boolean;
  cutoverReadyForPrimaryFallbackRemoval: boolean;
}

export interface AthleteWorkReadModel {
  athleteId: string;
  timezone: string;
  sourceDate: string;
  todayState: AthleteTodayState;
  primarySurfaceSource: 'daily_task' | 'none';
  todayTask: PulseCheckDailyAssignment | null;
  activePlans: AthleteWorkPlanEntry[];
  legacyAdapters: AthleteLegacyAdapterEntry[];
  recentResults: PulseCheckDailyAssignment[];
  legacyMigration: AthleteLegacyMigrationSummary;
}

const DAILY_TASK_ROLLOVER_HOUR = 4;
const RECENT_RESULTS_LIMIT = 10;

function normalizeTimezone(value?: string | null): string {
  const candidate = typeof value === 'string' && value.trim()
    ? value.trim()
    : Intl.DateTimeFormat().resolvedOptions().timeZone;

  try {
    Intl.DateTimeFormat('en-US', { timeZone: candidate }).format(new Date());
    return candidate;
  } catch {
    return 'UTC';
  }
}

function formatSourceDateFromParts(parts: { year: number; month: number; day: number }): string {
  return [
    String(parts.year).padStart(4, '0'),
    String(parts.month).padStart(2, '0'),
    String(parts.day).padStart(2, '0'),
  ].join('-');
}

function shiftSourceDate(sourceDate: string, deltaDays: number): string {
  const [year, month, day] = sourceDate.split('-').map((segment) => Number(segment));
  const shifted = new Date(Date.UTC(year, month - 1, day + deltaDays));
  return shifted.toISOString().slice(0, 10);
}

function resolveOperationalDay(options?: { sourceDate?: string; timezone?: string }): {
  sourceDate: string;
  timezone: string;
} {
  const timezone = normalizeTimezone(options?.timezone);
  if (options?.sourceDate && /^\d{4}-\d{2}-\d{2}$/.test(options.sourceDate)) {
    return {
      sourceDate: options.sourceDate,
      timezone,
    };
  }

  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  });
  const parts = formatter.formatToParts(new Date()).reduce<Record<string, string>>((accumulator, part) => {
    accumulator[part.type] = part.value;
    return accumulator;
  }, {});

  let sourceDate = formatSourceDateFromParts({
    year: Number(parts.year || 0),
    month: Number(parts.month || 1),
    day: Number(parts.day || 1),
  });

  if (Number(parts.hour || 0) < DAILY_TASK_ROLLOVER_HOUR) {
    sourceDate = shiftSourceDate(sourceDate, -1);
  }

  return {
    sourceDate,
    timezone,
  };
}

function sortDailyAssignments(left: PulseCheckDailyAssignment, right: PulseCheckDailyAssignment): number {
  if (left.sourceDate !== right.sourceDate) {
    return String(right.sourceDate || '').localeCompare(String(left.sourceDate || ''));
  }
  return (right.updatedAt || right.createdAt) - (left.updatedAt || left.createdAt);
}

function sortPlanEntries(left: AthleteWorkPlanEntry, right: AthleteWorkPlanEntry): number {
  if (left.plan.isPrimary !== right.plan.isPrimary) {
    return left.plan.isPrimary ? -1 : 1;
  }

  return (right.plan.updatedAt || right.plan.createdAt) - (left.plan.updatedAt || left.plan.createdAt);
}

function sortLegacyAdapters(left: AthleteLegacyAdapterEntry, right: AthleteLegacyAdapterEntry): number {
  if (left.kind !== right.kind) {
    return left.kind === 'curriculum' ? -1 : 1;
  }

  return right.updatedAt - left.updatedAt;
}

function pickTodayTask(assignments: PulseCheckDailyAssignment[], sourceDate: string): PulseCheckDailyAssignment | null {
  const todaysAssignments = assignments
    .filter((assignment) => assignment.sourceDate === sourceDate && assignment.status !== 'superseded')
    .sort(sortDailyAssignments);

  return todaysAssignments.find((assignment) => assignment.isPrimaryForDate !== false) || todaysAssignments[0] || null;
}

function deriveTodayState(params: {
  todayTask: PulseCheckDailyAssignment | null;
  activePlans: AthleteWorkPlanEntry[];
  legacyAdapters: AthleteLegacyAdapterEntry[];
  recentResults: PulseCheckDailyAssignment[];
}): AthleteTodayState {
  if (params.todayTask) return 'has_daily_task';
  if (params.activePlans.length > 0) return 'no_task_yet';
  if (params.legacyAdapters.length > 0) return 'no_task_yet';
  if (params.recentResults.length > 0) return 'between_programs';
  return 'no_task_yet';
}

function isActiveCurriculumStatus(status?: CurriculumAssignmentStatus | string): boolean {
  return status === CurriculumAssignmentStatus.Active || status === CurriculumAssignmentStatus.Extended;
}

function isActiveLegacyAssignmentStatus(status?: AssignmentStatus | string): boolean {
  return status === AssignmentStatus.Pending || status === AssignmentStatus.InProgress;
}

function summarizeLegacyMigration({
  todayTask,
  activePlans,
  legacyAdapters,
}: {
  todayTask: PulseCheckDailyAssignment | null;
  activePlans: AthleteWorkPlanEntry[];
  legacyAdapters: AthleteLegacyAdapterEntry[];
}): AthleteLegacyMigrationSummary {
  const hasPrimaryRuntimeTruth = Boolean(todayTask || activePlans.length > 0);

  return {
    curriculumPlanCount: legacyAdapters.filter((entry) => entry.kind === 'curriculum').length,
    secondaryWorkCount: legacyAdapters.filter((entry) => entry.kind === 'manual').length,
    primaryFallbackSuppressed: hasPrimaryRuntimeTruth,
    cutoverReadyForPrimaryFallbackRemoval: hasPrimaryRuntimeTruth && legacyAdapters.length === 0,
  };
}

export const dailyTaskTrainingPlanReadModelService = {
  async loadForAthlete(
    athleteId: string,
    options?: {
      sourceDate?: string;
      timezone?: string;
      recentResultsLimit?: number;
    }
  ): Promise<AthleteWorkReadModel> {
    const { sourceDate, timezone } = resolveOperationalDay(options);
    const recentResultsLimit = options?.recentResultsLimit || RECENT_RESULTS_LIMIT;

    const [dailyAssignmentsSnap, realPlans] = await Promise.all([
      getDocs(query(collection(db, PULSECHECK_DAILY_ASSIGNMENTS_COLLECTION), where('athleteId', '==', athleteId))),
      trainingPlanService.listActiveForAthlete(athleteId),
    ]);

    const [curriculumAssignments, legacyAssignments] = await Promise.all([
      curriculumAssignmentService.getAllForAthlete(athleteId).catch(() => []),
      assignmentService.getForAthlete(athleteId).catch(() => []),
    ]);

    const dailyAssignments = dailyAssignmentsSnap.docs
      .map((docSnap) => pulseCheckDailyAssignmentFromFirestore(docSnap.id, docSnap.data() as Record<string, any>))
      .sort(sortDailyAssignments);

    const todayTask = pickTodayTask(dailyAssignments, sourceDate);
    const recentResults = dailyAssignments
      .filter((assignment) => assignment.status === 'completed')
      .sort(sortDailyAssignments)
      .slice(0, recentResultsLimit);

    const activePlans: AthleteWorkPlanEntry[] = realPlans
      .map((plan) => ({
        plan,
        source: 'training_plan' as const,
        isAdapter: false,
      }))
      .sort(sortPlanEntries);

    const legacyAdapters: AthleteLegacyAdapterEntry[] = [
      ...curriculumAssignments
        .filter((assignment) => isActiveCurriculumStatus(assignment.status))
        .map((assignment) => ({
          id: assignment.id,
          kind: 'curriculum' as const,
          title: assignment.exercise?.name || assignment.exerciseId,
          status: assignment.status,
          source: assignment.source || AssignmentSource.Program,
          updatedAt: assignment.updatedAt || assignment.createdAt,
          active: true,
        })),
      ...legacyAssignments
        .filter((assignment) => isActiveLegacyAssignmentStatus(assignment.status) && assignment.source !== AssignmentSource.Nora)
        .map((assignment) => ({
          id: assignment.id,
          kind: 'manual' as const,
          title: assignment.exercise?.name || assignment.exerciseId,
          status: assignment.status,
          source: assignment.source || AssignmentSource.Coach,
          updatedAt: assignment.updatedAt || assignment.createdAt,
          active: true,
        })),
    ].sort(sortLegacyAdapters);

    const todayState = deriveTodayState({
      todayTask,
      activePlans,
      legacyAdapters,
      recentResults,
    });
    const primarySurfaceSource: AthleteWorkReadModel['primarySurfaceSource'] = todayTask ? 'daily_task' : 'none';

    return {
      athleteId,
      timezone,
      sourceDate,
      todayState,
      primarySurfaceSource,
      todayTask,
      activePlans,
      legacyAdapters,
      recentResults,
      legacyMigration: summarizeLegacyMigration({
        todayTask,
        activePlans,
        legacyAdapters,
      }),
    };
  },
};
