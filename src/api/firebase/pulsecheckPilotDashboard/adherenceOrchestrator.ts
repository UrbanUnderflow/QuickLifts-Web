import type {
  PilotDashboardAdherenceOrchestratorSummary,
  PilotDashboardAthleteDayAdherenceState,
} from './types';

export const ADHERENCE_PRIVACY_BOUNDARY_COPY =
  'Nora does not show coaches raw reflections, mental health disclosures, chat transcripts, or private sleep details. Coach will not receive private Nora content because an athlete completes, misses, or rescues a day. The pilot dashboard uses completion state and aggregate adherence only.';

const normalizeString = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

const normalizeBoolean = (value: unknown) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  const normalized = normalizeString(value).toLowerCase();
  return normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'y';
};

const toFiniteNumber = (value: unknown, fallback = 0) => {
  const nextValue = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(nextValue) ? nextValue : fallback;
};

const truthyObjectValue = (value: any, keys: string[]) =>
  keys.some((key) => normalizeBoolean(value?.[key]));

const textContainsRescueSignal = (value: unknown) => {
  const normalized = normalizeString(value).toLowerCase();
  return ['rescue', 'rescued', 'short', 'short_version', 'late', 'nudge', 'reminder', 'comeback']
    .some((token) => normalized.includes(token));
};

export const isRescuedAdherenceCompletion = ({
  assignment,
  completionEvent,
}: {
  assignment?: Record<string, any> | null;
  completionEvent?: Record<string, any> | null;
}) => {
  const payload = completionEvent?.metricPayload || {};
  const metadata = completionEvent?.metadata || assignment?.metadata || assignment?.completionMetadata || {};

  return (
    truthyObjectValue(payload, ['adherenceRescue', 'rescued', 'rescue', 'shortVersion', 'short_version'])
    || truthyObjectValue(metadata, ['adherenceRescue', 'rescued', 'rescue', 'shortVersion', 'short_version'])
    || truthyObjectValue(assignment, ['adherenceRescue', 'rescued', 'shortVersion', 'short_version'])
    || normalizeString(assignment?.adherenceState).toLowerCase() === 'rescued'
    || textContainsRescueSignal(payload.source)
    || textContainsRescueSignal(payload.completionSource)
    || textContainsRescueSignal(metadata.source)
    || textContainsRescueSignal(metadata.nudgeSource)
    || textContainsRescueSignal(metadata.adherenceSource)
  );
};

export const resolveAthleteDayAdherenceState = ({
  expected,
  checkInCompleted,
  assignmentCompleted,
  assignmentStarted,
  rescued,
  dateKey,
  todayDateKey,
}: {
  expected: boolean;
  checkInCompleted: boolean;
  assignmentCompleted: boolean;
  assignmentStarted: boolean;
  rescued?: boolean;
  dateKey?: string | null;
  todayDateKey?: string | null;
}): PilotDashboardAthleteDayAdherenceState => {
  if (!expected) return 'excused';
  if (checkInCompleted && assignmentCompleted) return rescued ? 'rescued' : 'closed';
  if (checkInCompleted) return 'checked_in';
  if (assignmentCompleted) return 'task_only';
  if (assignmentStarted) return 'task_started';
  if (dateKey && todayDateKey && dateKey >= todayDateKey) return 'expected';
  return 'missed';
};

export const buildPilotAdherenceOrchestratorSummary = (
  diagnostics?: Record<string, any> | null,
): PilotDashboardAdherenceOrchestratorSummary => {
  const adherence = diagnostics || {};
  const orchestrator = adherence.orchestrator && typeof adherence.orchestrator === 'object'
    ? adherence.orchestrator
    : adherence;
  const expectedAthleteDays = Math.max(0, toFiniteNumber(
    orchestrator.expectedAthleteDays,
    toFiniteNumber(orchestrator.expectedDays, toFiniteNumber(adherence.expectedAthleteDays)),
  ));
  const closedDays = Math.max(0, toFiniteNumber(
    orchestrator.closedDays,
    toFiniteNumber(adherence.adheredDays),
  ));
  const completedCheckInDays = Math.max(0, toFiniteNumber(adherence.completedCheckInDays));
  const completedAssignmentDays = Math.max(0, toFiniteNumber(adherence.completedAssignmentDays));
  const rescuedDays = Math.max(0, toFiniteNumber(orchestrator.rescuedDays, toFiniteNumber(adherence.rescuedDays)));
  const checkInOnlyDays = Math.max(0, toFiniteNumber(
    orchestrator.checkInOnlyDays,
    Math.max(0, completedCheckInDays - closedDays),
  ));
  const taskOnlyDays = Math.max(0, toFiniteNumber(
    orchestrator.taskOnlyDays,
    Math.max(0, completedAssignmentDays - closedDays),
  ));
  const taskStartedOnlyDays = Math.max(0, toFiniteNumber(orchestrator.taskStartedOnlyDays));
  const missedDays = Math.max(0, toFiniteNumber(
    orchestrator.missedDays,
    Math.max(0, expectedAthleteDays - closedDays - checkInOnlyDays - taskOnlyDays - taskStartedOnlyDays),
  ));
  const excusedDays = Math.max(0, toFiniteNumber(orchestrator.excusedDays, toFiniteNumber(adherence.excusedDays)));
  const openDays = Math.max(0, toFiniteNumber(
    orchestrator.openDays,
    missedDays + checkInOnlyDays + taskOnlyDays + taskStartedOnlyDays,
  ));
  const activeAthleteCount = Math.max(0, toFiniteNumber(adherence.activeAthleteCount));
  const byAthlete = orchestrator.byAthlete && typeof orchestrator.byAthlete === 'object'
    ? orchestrator.byAthlete
    : adherence.byAthlete && typeof adherence.byAthlete === 'object'
      ? adherence.byAthlete
      : {};
  const atRiskAthleteCount = Math.max(0, toFiniteNumber(
    orchestrator.atRiskAthleteCount,
    Object.values(byAthlete).filter((entry: any) => {
      const expectedDays = toFiniteNumber(entry?.expectedAthleteDays, toFiniteNumber(entry?.expectedDays));
      const adheredDays = toFiniteNumber(entry?.adheredDays, toFiniteNumber(entry?.closedDays));
      const explicitOpenDays = toFiniteNumber(entry?.openDays);
      return explicitOpenDays > 0 || (expectedDays > 0 && adheredDays < expectedDays);
    }).length,
  ));

  return {
    expectedAthleteDays,
    closedDays,
    rescuedDays,
    missedDays,
    excusedDays,
    checkInOnlyDays,
    taskOnlyDays,
    taskStartedOnlyDays,
    openDays,
    closedRate: expectedAthleteDays ? Number(((closedDays / expectedAthleteDays) * 100).toFixed(1)) : 0,
    atRiskAthleteCount,
    activeAthleteCount,
    privacyBoundary: normalizeString(orchestrator.privacyBoundary?.statement) || ADHERENCE_PRIVACY_BOUNDARY_COPY,
    privateContentExposed: false,
  };
};

export const buildPilotAdherenceOrchestratorByCohort = (
  diagnosticsByCohort?: Record<string, any> | null,
): Record<string, PilotDashboardAdherenceOrchestratorSummary> => {
  if (!diagnosticsByCohort || typeof diagnosticsByCohort !== 'object') return {};
  return Object.entries(diagnosticsByCohort).reduce<Record<string, PilotDashboardAdherenceOrchestratorSummary>>(
    (accumulator, [cohortId, diagnostics]) => {
      if (!cohortId) return accumulator;
      accumulator[cohortId] = buildPilotAdherenceOrchestratorSummary(diagnostics as Record<string, any>);
      return accumulator;
    },
    {},
  );
};
