export type PulseCheckCoherenceDay = {
  dateKey: string;
  morningLevel?: string | null;
  eveningLevel?: string | null;
  completedTraining?: boolean;
  eligibleTaskCount?: number;
  completedTaskCount?: number;
};

export type PulseCheckCoherenceSnapshot = {
  windowDays: number;
  observedDays: number;
  showingUpDays: number;
  consistencyPercent: number | null;
  completedTrainingCount: number;
  eligibleTrainingCount: number;
  followThroughPercent: number | null;
  followThroughBasis: 'assigned-tasks' | 'checked-in-days' | 'unavailable';
  feelingGoodDays: number;
  feelingCheckInDays: number;
  feelingGoodPercent: number | null;
  coherencePercent: number | null;
};

export type PulseCheckTeamCoherenceSnapshot = {
  athleteCount: number;
  scoredAthleteCount: number;
  buildingAthleteCount: number;
  consistencyPercent: number | null;
  followThroughPercent: number | null;
  feelingGoodPercent: number | null;
  coherencePercent: number | null;
};

const MAXIMUM_ASSIGNED_SESSIONS_PER_DAY = 3;
const POSITIVE_LEVELS = new Set(['solid', 'locked', 'locked_in']);

const percentage = (value: number, total: number): number | null =>
  total > 0 ? Math.round((value / total) * 100) : null;

const averagePercent = (values: Array<number | null>): number | null => {
  const available = values.filter((value): value is number => value !== null);
  return available.length > 0
    ? Math.round(available.reduce((sum, value) => sum + value, 0) / available.length)
    : null;
};

const normalizeLevel = (value?: string | null): string =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[- ]/g, '_');

const isCheckedIn = (day: PulseCheckCoherenceDay): boolean =>
  Boolean(day.morningLevel || day.eveningLevel);

const hasEvidence = (day: PulseCheckCoherenceDay): boolean =>
  isCheckedIn(day) ||
  day.completedTraining === true ||
  Math.max(0, day.eligibleTaskCount || 0) > 0;

const reportedFeelingGood = (day: PulseCheckCoherenceDay): boolean | null => {
  const level = day.eveningLevel || day.morningLevel;
  return level ? POSITIVE_LEVELS.has(normalizeLevel(level)) : null;
};

export const calculatePulseCheckCoherence = (
  days: PulseCheckCoherenceDay[],
  windowDays = 14
): PulseCheckCoherenceSnapshot => {
  const sortedDays = [...days].sort((left, right) => left.dateKey.localeCompare(right.dateKey));
  const firstEvidenceIndex = sortedDays.findIndex(hasEvidence);

  if (firstEvidenceIndex < 0) {
    return {
      windowDays,
      observedDays: 0,
      showingUpDays: 0,
      consistencyPercent: null,
      completedTrainingCount: 0,
      eligibleTrainingCount: 0,
      followThroughPercent: null,
      followThroughBasis: 'unavailable',
      feelingGoodDays: 0,
      feelingCheckInDays: 0,
      feelingGoodPercent: null,
      coherencePercent: null,
    };
  }

  const observedDays = sortedDays.slice(firstEvidenceIndex);
  const showingUpDays = observedDays.filter(
    (day) => isCheckedIn(day) || day.completedTraining === true
  ).length;
  const consistencyPercent = percentage(showingUpDays, observedDays.length);

  const eligibleTaskCount = observedDays.reduce(
    (sum, day) =>
      sum + Math.min(Math.max(day.eligibleTaskCount || 0, 0), MAXIMUM_ASSIGNED_SESSIONS_PER_DAY),
    0
  );
  const completedTaskCount = observedDays.reduce((sum, day) => {
    const eligibleForDay = Math.min(
      Math.max(day.eligibleTaskCount || 0, 0),
      MAXIMUM_ASSIGNED_SESSIONS_PER_DAY
    );
    return sum + Math.min(Math.max(day.completedTaskCount || 0, 0), eligibleForDay);
  }, 0);

  let completedTrainingCount: number;
  let eligibleTrainingCount: number;
  let followThroughBasis: PulseCheckCoherenceSnapshot['followThroughBasis'];
  if (eligibleTaskCount > 0) {
    completedTrainingCount = completedTaskCount;
    eligibleTrainingCount = eligibleTaskCount;
    followThroughBasis = 'assigned-tasks';
  } else {
    const checkedInDays = observedDays.filter(isCheckedIn);
    completedTrainingCount = checkedInDays.filter((day) => day.completedTraining === true).length;
    eligibleTrainingCount = checkedInDays.length;
    followThroughBasis = checkedInDays.length > 0 ? 'checked-in-days' : 'unavailable';
  }
  const followThroughPercent = percentage(completedTrainingCount, eligibleTrainingCount);

  const feelingReports = observedDays
    .map(reportedFeelingGood)
    .filter((value): value is boolean => value !== null);
  const feelingGoodDays = feelingReports.filter(Boolean).length;
  const feelingGoodPercent = percentage(feelingGoodDays, feelingReports.length);

  const availableScores = [
    consistencyPercent,
    followThroughPercent,
    feelingGoodPercent,
  ].filter((value): value is number => value !== null);
  const coherencePercent =
    observedDays.length >= 3 && availableScores.length >= 2
      ? Math.round(availableScores.reduce((sum, value) => sum + value, 0) / availableScores.length)
      : null;

  return {
    windowDays,
    observedDays: observedDays.length,
    showingUpDays,
    consistencyPercent,
    completedTrainingCount,
    eligibleTrainingCount,
    followThroughPercent,
    followThroughBasis,
    feelingGoodDays,
    feelingCheckInDays: feelingReports.length,
    feelingGoodPercent,
    coherencePercent,
  };
};

export const calculatePulseCheckTeamCoherence = (
  snapshots: PulseCheckCoherenceSnapshot[]
): PulseCheckTeamCoherenceSnapshot => {
  const scoredSnapshots = snapshots.filter((snapshot) => snapshot.coherencePercent !== null);

  return {
    athleteCount: snapshots.length,
    scoredAthleteCount: scoredSnapshots.length,
    buildingAthleteCount: snapshots.length - scoredSnapshots.length,
    consistencyPercent: averagePercent(scoredSnapshots.map((snapshot) => snapshot.consistencyPercent)),
    followThroughPercent: averagePercent(
      scoredSnapshots.map((snapshot) => snapshot.followThroughPercent)
    ),
    feelingGoodPercent: averagePercent(scoredSnapshots.map((snapshot) => snapshot.feelingGoodPercent)),
    coherencePercent: averagePercent(scoredSnapshots.map((snapshot) => snapshot.coherencePercent)),
  };
};

