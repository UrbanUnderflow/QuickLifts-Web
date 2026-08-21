export const PULSECHECK_SCORING_VERSION = '2.2.2';
export const PULSECHECK_SCORE_WINDOW_DAYS = 14;
export const PULSECHECK_COHERENCE_BUILDING_DAYS = 3;
export const PULSECHECK_AUTONOMIC_BASELINE_MINIMUM = 14;
export const PULSECHECK_AUTONOMIC_BASELINE_WINDOW_DAYS = 28;
export const PULSECHECK_COHERENCE_WEIGHTS = {
  wellbeing: 45,
  recovery: 45,
  adherence: 10,
} as const;

export type PulseCheckScoreStatus =
  | 'building'
  | 'available'
  | 'recalibrating'
  | 'insufficient_evidence';

export type PulseCheckEvidenceConfidence = 'limited' | 'moderate' | 'strong';

export type PulseCheckCommitmentState =
  | 'accepted'
  | 'replacement_accepted'
  | 'completed'
  | 'planned_rest'
  | 'rest_over_plan'
  | 'missed'
  | 'coach_excused'
  | 'technical_failure'
  | 'no_assignment';

export type PulseCheckAutonomicMetric = 'hrv' | 'resting_heart_rate';
export type PulseCheckHrvMethod = 'sdnn' | 'rmssd';
export type PulseCheckMeasurementWindow = 'sleep' | 'overnight' | 'full_day' | 'spot' | 'unknown';

export interface PulseCheckAutonomicMeasurement {
  dateKey: string;
  metric: PulseCheckAutonomicMetric;
  value: number;
  sourceFamily: string;
  deviceId?: string | null;
  method: PulseCheckHrvMethod | 'resting_heart_rate';
  measurementWindow: PulseCheckMeasurementWindow;
  algorithmVersion?: string | null;
  freshness?: 'fresh' | 'recent' | 'historical_only' | 'stale' | 'missing' | 'unknown';
  isPrimary?: boolean;
}

export interface PulseCheckSleepSignal {
  durationHours?: number | null;
  targetHours?: number | null;
  efficiencyPercent?: number | null;
  timingDeviationMinutes?: number | null;
  sourceFamily?: string | null;
  freshness?: 'fresh' | 'recent' | 'historical_only' | 'stale' | 'missing' | 'unknown';
}

export interface PulseCheckCommitmentSignal {
  state: PulseCheckCommitmentState;
  commitmentId?: string | null;
  replacementForCommitmentId?: string | null;
  plannedRestWithinPlan?: boolean | null;
  weeklyFollowThroughMet?: boolean | null;
}

export interface PulseCheckScoringDay {
  dateKey: string;
  wellbeingLevel?: number | string | null;
  subjectiveRecoveryLevel?: number | string | null;
  scheduledCheckIn?: boolean;
  commitment?: PulseCheckCommitmentSignal | null;
  sleep?: PulseCheckSleepSignal | null;
  autonomicMeasurements?: PulseCheckAutonomicMeasurement[];
}

export interface PulseCheckWhoFiveObservation {
  dateKey: string;
  scorePercent: number;
  instrumentVersion: string;
}

export interface PulseCheckScoringInput {
  days: PulseCheckScoringDay[];
  whoFive?: PulseCheckWhoFiveObservation | null;
  windowDays?: number;
  generatedAt?: string;
  accountAgeDays?: number | null;
  establishedCoherenceScore?: number | null;
}

export interface PulseCheckScoreComponent {
  key: string;
  label: string;
  score: number | null;
  configuredWeightPercent: number;
  evidenceAvailable: boolean;
  detail: string;
  dayStates?: PulseCheckScoreComponentDayState[];
}

export interface PulseCheckScoreComponentDayState {
  dateKey: string;
  state: 'complete' | 'partial' | 'missed' | 'pending' | 'excused';
  label: string;
}

export interface PulseCheckScoreResult {
  score: number | null;
  status: PulseCheckScoreStatus;
  confidence: PulseCheckEvidenceConfidence;
  evidenceCoveragePercent: number;
  observedDays: number;
  windowDays: number;
  trendDelta: number | null;
  components: PulseCheckScoreComponent[];
  notes: string[];
}

export interface PulseCheckAutonomicLaneResult {
  metric: PulseCheckAutonomicMetric;
  score: number | null;
  status: 'available' | 'recalibrating' | 'missing';
  laneId: string | null;
  sourceFamily: string | null;
  method: string | null;
  measurementWindow: string | null;
  baselineCount: number;
  currentValue: number | null;
  sourceTransition: boolean;
}

export interface PulseCheckScorecardV2 {
  methodologyVersion: string;
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  wellbeing: PulseCheckScoreResult;
  recovery: PulseCheckScoreResult;
  adherence: PulseCheckScoreResult;
  coherence: PulseCheckScoreResult;
  autonomic: {
    hrv: PulseCheckAutonomicLaneResult;
    restingHeartRate: PulseCheckAutonomicLaneResult;
  };
  sourceTransitions: Array<{
    metric: PulseCheckAutonomicMetric;
    activeLaneId: string;
    sourceFamily: string;
  }>;
  limitations: string[];
}

type WindowCalculation = Omit<PulseCheckScoreResult, 'trendDelta'>;

const LEVEL_MAP: Record<string, number> = {
  drained: 0,
  low: 25,
  off: 25,
  okay: 50,
  solid: 75,
  good: 75,
  locked: 100,
  locked_in: 100,
};

const clamp = (value: number, minimum = 0, maximum = 100): number =>
  Math.min(maximum, Math.max(minimum, value));

const rounded = (value: number): number => Math.round(clamp(value));

const mean = (values: number[]): number | null =>
  values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : null;

const standardDeviation = (values: number[]): number | null => {
  const average = mean(values);
  if (average === null || values.length < 2) return null;
  const variance = values.reduce((sum, value) => sum + ((value - average) ** 2), 0) / values.length;
  return Math.sqrt(variance);
};

const normalizeLevel = (value: number | string | null | undefined): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    if (value >= 1 && value <= 5) return (value - 1) * 25;
    if (value >= 0 && value <= 100) return value;
    return null;
  }
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[- ]/g, '_');
  return Object.prototype.hasOwnProperty.call(LEVEL_MAP, normalized) ? LEVEL_MAP[normalized] : null;
};

const dateFromKey = (dateKey: string): Date | null => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return null;
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) ? date : null;
};

const dayDifference = (later: string, earlier: string): number | null => {
  const laterDate = dateFromKey(later);
  const earlierDate = dateFromKey(earlier);
  if (!laterDate || !earlierDate) return null;
  return Math.round((laterDate.getTime() - earlierDate.getTime()) / 86_400_000);
};

const sortDays = (days: PulseCheckScoringDay[]): PulseCheckScoringDay[] =>
  [...days]
    .filter((day) => dateFromKey(day.dateKey))
    .sort((left, right) => left.dateKey.localeCompare(right.dateKey));

const confidenceFor = (
  coveragePercent: number,
  observedDays: number,
  status: PulseCheckScoreStatus,
): PulseCheckEvidenceConfidence => {
  if (status !== 'available' || coveragePercent < 50 || observedDays < 3) return 'limited';
  if (coveragePercent >= 80 && observedDays >= 7) return 'strong';
  return 'moderate';
};

const weightedScore = (
  entries: Array<{ score: number | null; weight: number }>,
): number | null => {
  const available = entries.filter((entry): entry is { score: number; weight: number } => entry.score !== null);
  const availableWeight = available.reduce((sum, entry) => sum + entry.weight, 0);
  if (availableWeight <= 0) return null;
  return rounded(available.reduce((sum, entry) => sum + entry.score * entry.weight, 0) / availableWeight);
};

export const calculatePulseCheckCoherenceScore = (
  wellbeingScore: number | null,
  recoveryScore: number | null,
  adherenceScore: number | null,
): number | null => {
  if (wellbeingScore === null || recoveryScore === null) return null;
  return weightedScore([
    { score: wellbeingScore, weight: PULSECHECK_COHERENCE_WEIGHTS.wellbeing },
    { score: recoveryScore, weight: PULSECHECK_COHERENCE_WEIGHTS.recovery },
    { score: adherenceScore, weight: PULSECHECK_COHERENCE_WEIGHTS.adherence },
  ]);
};

const scoreResult = (
  calculation: WindowCalculation,
  previousScore: number | null,
): PulseCheckScoreResult => ({
  ...calculation,
  trendDelta:
    calculation.score !== null && previousScore !== null
      ? calculation.score - previousScore
      : null,
});

const calculateWellbeingWindow = (
  days: PulseCheckScoringDay[],
  whoFive: PulseCheckWhoFiveObservation | null,
  windowDays: number,
): WindowCalculation => {
  const scheduledDays = days.filter((day) => day.scheduledCheckIn !== false);
  const dailyScores = days.map((day) => normalizeLevel(day.wellbeingLevel)).filter((value): value is number => value !== null);
  const dailyScore = mean(dailyScores);
  const windowEnd = days[days.length - 1]?.dateKey;
  const whoFiveAge = whoFive && windowEnd ? dayDifference(windowEnd, whoFive.dateKey) : null;
  const whoFiveIsCurrent = whoFiveAge !== null && whoFiveAge >= 0 && whoFiveAge < windowDays;
  const whoFiveScore = whoFiveIsCurrent ? rounded(whoFive!.scorePercent) : null;
  const score = weightedScore([
    { score: dailyScore, weight: 50 },
    { score: whoFiveScore, weight: 50 },
  ]);
  const dailyCoverage = scheduledDays.length > 0 ? dailyScores.length / scheduledDays.length : 0;
  const evidenceCoveragePercent = rounded((dailyCoverage * 50) + (whoFiveScore === null ? 0 : 50));
  const status: PulseCheckScoreStatus = score === null
    ? 'insufficient_evidence'
    : dailyScores.length < 3 && whoFiveScore === null
      ? 'building'
      : 'available';
  const notes: string[] = [];
  if (!whoFive) notes.push('The periodic wellbeing instrument has not been completed.');
  else if (!whoFiveIsCurrent) notes.push('The periodic wellbeing instrument is outside the current window.');
  if (dailyScores.length < scheduledDays.length) notes.push('Missing daily check-ins were left missing and were not scored as zero.');

  return {
    score: status === 'building' ? null : score,
    status,
    confidence: confidenceFor(evidenceCoveragePercent, dailyScores.length, status),
    evidenceCoveragePercent,
    observedDays: dailyScores.length,
    windowDays,
    components: [
      {
        key: 'daily_wellbeing',
        label: 'Daily wellbeing check-ins',
        score: dailyScore === null ? null : rounded(dailyScore),
        configuredWeightPercent: 50,
        evidenceAvailable: dailyScore !== null,
        detail: `${dailyScores.length} of ${scheduledDays.length} scheduled check-ins reported.`,
      },
      {
        key: 'periodic_wellbeing_instrument',
        label: 'Periodic wellbeing instrument',
        score: whoFiveScore,
        configuredWeightPercent: 50,
        evidenceAvailable: whoFiveScore !== null,
        detail: whoFiveScore === null
          ? 'No current instrument score is included.'
          : `${whoFive!.instrumentVersion} completed ${whoFive!.dateKey}.`,
      },
    ],
    notes,
  };
};

const calculateSleepScore = (days: PulseCheckScoringDay[]): {
  score: number | null;
  evidenceWeightPercent: number;
  detail: string;
} => {
  const latest = [...days].reverse().find((day) => {
    const sleep = day.sleep;
    return Boolean(
      sleep &&
      sleep.freshness !== 'stale' &&
      sleep.freshness !== 'missing' &&
      (sleep.durationHours != null || sleep.efficiencyPercent != null || sleep.timingDeviationMinutes != null),
    );
  });
  if (!latest?.sleep) {
    return { score: null, evidenceWeightPercent: 0, detail: 'No recent sleep signal is available.' };
  }
  const sleep = latest.sleep;
  const targetHours = sleep.targetHours && sleep.targetHours > 0 ? sleep.targetHours : 8;
  const durationScore = sleep.durationHours != null && sleep.durationHours >= 0
    ? rounded((sleep.durationHours / targetHours) * 100)
    : null;
  const efficiencyScore = sleep.efficiencyPercent != null
    ? rounded(sleep.efficiencyPercent)
    : null;
  const timingScore = sleep.timingDeviationMinutes != null
    ? rounded(100 - (Math.abs(sleep.timingDeviationMinutes) / 120) * 100)
    : null;
  const score = weightedScore([
    { score: durationScore, weight: 50 },
    { score: efficiencyScore, weight: 25 },
    { score: timingScore, weight: 25 },
  ]);
  const evidenceWeightPercent =
    (durationScore === null ? 0 : 50) +
    (efficiencyScore === null ? 0 : 25) +
    (timingScore === null ? 0 : 25);
  return {
    score,
    evidenceWeightPercent,
    detail: `${latest.dateKey} sleep from ${sleep.sourceFamily || 'the connected source'}; sleep stages are not scored.`,
  };
};

export const pulseCheckMeasurementLaneId = (measurement: PulseCheckAutonomicMeasurement): string =>
  [
    measurement.sourceFamily.trim().toLowerCase(),
    String(measurement.deviceId || 'unknown-device').trim().toLowerCase(),
    measurement.metric,
    measurement.method,
    measurement.measurementWindow,
    String(measurement.algorithmVersion || 'source-native').trim().toLowerCase(),
  ].join('|');

const directSourceRank = (sourceFamily: string): number => {
  const normalized = sourceFamily.trim().toLowerCase();
  return ['whoop', 'oura', 'polar'].includes(normalized) ? 2 : 1;
};

export const calculateAutonomicLane = (
  measurements: PulseCheckAutonomicMeasurement[],
  metric: PulseCheckAutonomicMetric,
  latestWindowDateKey: string | null,
): PulseCheckAutonomicLaneResult => {
  const valid = measurements
    .filter((measurement) =>
      measurement.metric === metric &&
      Number.isFinite(measurement.value) &&
      measurement.value > 0 &&
      measurement.freshness !== 'stale' &&
      measurement.freshness !== 'missing' &&
      dateFromKey(measurement.dateKey),
    )
    .sort((left, right) => left.dateKey.localeCompare(right.dateKey));
  if (valid.length === 0) {
    return {
      metric,
      score: null,
      status: 'missing',
      laneId: null,
      sourceFamily: null,
      method: null,
      measurementWindow: null,
      baselineCount: 0,
      currentValue: null,
      sourceTransition: false,
    };
  }

  const mostRecentDate = valid[valid.length - 1].dateKey;
  const onMostRecentDate = valid.filter((measurement) => measurement.dateKey === mostRecentDate);
  const explicitPrimary = onMostRecentDate.filter((measurement) => measurement.isPrimary);
  const candidates = explicitPrimary.length > 0 ? explicitPrimary : onMostRecentDate;
  const countsByLane = valid.reduce((map, measurement) => {
    const id = pulseCheckMeasurementLaneId(measurement);
    map.set(id, (map.get(id) || 0) + 1);
    return map;
  }, new Map<string, number>());
  const current = [...candidates].sort((left, right) => {
    const countDelta = (countsByLane.get(pulseCheckMeasurementLaneId(right)) || 0) -
      (countsByLane.get(pulseCheckMeasurementLaneId(left)) || 0);
    if (countDelta !== 0) return countDelta;
    return directSourceRank(right.sourceFamily) - directSourceRank(left.sourceFamily);
  })[0];
  const laneId = pulseCheckMeasurementLaneId(current);
  const lane = valid.filter((measurement) => pulseCheckMeasurementLaneId(measurement) === laneId);
  const baseline = lane.filter((measurement) => {
    const age = dayDifference(current.dateKey, measurement.dateKey);
    return age !== null && age >= 1 && age <= PULSECHECK_AUTONOMIC_BASELINE_WINDOW_DAYS;
  });
  const baselineValues = baseline.map((measurement) => measurement.value);
  const otherLaneHasHistory = valid.some((measurement) => {
    const age = dayDifference(current.dateKey, measurement.dateKey);
    return pulseCheckMeasurementLaneId(measurement) !== laneId && age !== null && age >= 1 && age <= 28;
  });
  const currentIsRecent = latestWindowDateKey
    ? (dayDifference(latestWindowDateKey, current.dateKey) ?? 999) <= 2
    : true;

  if (baselineValues.length < PULSECHECK_AUTONOMIC_BASELINE_MINIMUM || !currentIsRecent) {
    return {
      metric,
      score: null,
      status: 'recalibrating',
      laneId,
      sourceFamily: current.sourceFamily,
      method: current.method,
      measurementWindow: current.measurementWindow,
      baselineCount: baselineValues.length,
      currentValue: current.value,
      sourceTransition: otherLaneHasHistory,
    };
  }

  const baselineMean = mean(baselineValues)!;
  const baselineDeviation = standardDeviation(baselineValues);
  const zScore = baselineDeviation && baselineDeviation > 0.0001
    ? (current.value - baselineMean) / baselineDeviation
    : 0;
  const directionalZ = metric === 'hrv' ? zScore : -zScore;
  const score = rounded(50 + (directionalZ * 15));

  return {
    metric,
    score,
    status: 'available',
    laneId,
    sourceFamily: current.sourceFamily,
    method: current.method,
    measurementWindow: current.measurementWindow,
    baselineCount: baselineValues.length,
    currentValue: current.value,
    sourceTransition: otherLaneHasHistory,
  };
};

const calculateRecoveryWindow = (
  days: PulseCheckScoringDay[],
  allMeasurements: PulseCheckAutonomicMeasurement[],
  windowDays: number,
): WindowCalculation & { autonomic: { hrv: PulseCheckAutonomicLaneResult; restingHeartRate: PulseCheckAutonomicLaneResult } } => {
  const subjectiveScores = days
    .map((day) => normalizeLevel(day.subjectiveRecoveryLevel))
    .filter((value): value is number => value !== null);
  const subjectiveScore = subjectiveScores.length > 0 ? subjectiveScores[subjectiveScores.length - 1] : null;
  const sleep = calculateSleepScore(days);
  const latestDateKey = days[days.length - 1]?.dateKey || null;
  const hrv = calculateAutonomicLane(allMeasurements, 'hrv', latestDateKey);
  const restingHeartRate = calculateAutonomicLane(allMeasurements, 'resting_heart_rate', latestDateKey);
  const autonomicScore = weightedScore([
    { score: hrv.score, weight: 50 },
    { score: restingHeartRate.score, weight: 50 },
  ]);
  const score = weightedScore([
    { score: subjectiveScore, weight: 40 },
    { score: sleep.score, weight: 35 },
    { score: autonomicScore, weight: 25 },
  ]);
  const evidenceCoveragePercent = rounded(
    (subjectiveScore === null ? 0 : 40) +
    ((sleep.evidenceWeightPercent / 100) * 35) +
    (autonomicScore === null ? 0 : 25),
  );
  const status: PulseCheckScoreStatus = score === null ? 'insufficient_evidence' : 'available';
  const notes: string[] = [];
  if (hrv.status === 'recalibrating' || restingHeartRate.status === 'recalibrating') {
    notes.push('One or more autonomic lanes are recalibrating and do not contribute to the score yet.');
  }
  if (hrv.sourceTransition || restingHeartRate.sourceTransition) {
    notes.push('A source transition was detected. Raw values from different measurement lanes were not combined.');
  }
  if (sleep.score === null) notes.push('Missing sleep data was left missing and was not scored as zero.');

  return {
    score,
    status,
    confidence: confidenceFor(evidenceCoveragePercent, subjectiveScores.length, status),
    evidenceCoveragePercent,
    observedDays: subjectiveScores.length,
    windowDays,
    components: [
      {
        key: 'subjective_recovery',
        label: 'Athlete-reported recovery',
        score: subjectiveScore,
        configuredWeightPercent: 40,
        evidenceAvailable: subjectiveScore !== null,
        detail: subjectiveScore === null ? 'No recovery response is available.' : 'Latest recovery response in the window.',
      },
      {
        key: 'sleep',
        label: 'Sleep',
        score: sleep.score,
        configuredWeightPercent: 35,
        evidenceAvailable: sleep.score !== null,
        detail: sleep.detail,
      },
      {
        key: 'autonomic_stability',
        label: 'Autonomic stability',
        score: autonomicScore,
        configuredWeightPercent: 25,
        evidenceAvailable: autonomicScore !== null,
        detail: autonomicScore === null
          ? 'HRV and resting heart rate need enough same-lane history before scoring.'
          : 'Source-normalized HRV and resting heart rate, each contributing half of this component.',
      },
    ],
    notes,
    autonomic: { hrv, restingHeartRate },
  };
};

const commitmentOutcome = (
  commitment: PulseCheckCommitmentSignal,
  dateKey: string,
  latestDateKey: string,
): number | null => {
  switch (commitment.state) {
    case 'completed':
      return 1;
    case 'planned_rest':
      return commitment.plannedRestWithinPlan !== false && commitment.weeklyFollowThroughMet !== false ? 1 : 0;
    case 'missed':
    case 'rest_over_plan':
      return 0;
    case 'accepted':
    case 'replacement_accepted':
      return dateKey < latestDateKey ? 0 : null;
    case 'coach_excused':
    case 'technical_failure':
    case 'no_assignment':
      return null;
  }
};

const commitmentStateLabel = (state: PulseCheckCommitmentState): string => {
  switch (state) {
    case 'completed':
      return 'Commitment completed';
    case 'planned_rest':
      return 'Planned rest within plan';
    case 'rest_over_plan':
      return 'Planned rest over plan';
    case 'missed':
      return 'Commitment missed';
    case 'accepted':
    case 'replacement_accepted':
      return 'Commitment pending';
    case 'coach_excused':
      return 'Coach excused';
    case 'technical_failure':
      return 'Technical failure';
    case 'no_assignment':
      return 'No assignment';
  }
};

const adherenceDayStates = (days: PulseCheckScoringDay[]): PulseCheckScoreComponentDayState[] => {
  const latestDateKey = days[days.length - 1]?.dateKey || '';
  return days.map((day) => {
    if (day.scheduledCheckIn === false) {
      return {
        dateKey: day.dateKey,
        state: 'excused',
        label: `${day.dateKey}: no scheduled check-in.`,
      };
    }

    const checkedIn = normalizeLevel(day.wellbeingLevel) !== null;
    const outcome = day.commitment ? commitmentOutcome(day.commitment, day.dateKey, latestDateKey) : null;
    const commitmentLabel = day.commitment ? commitmentStateLabel(day.commitment.state) : 'No commitment assigned';
    const commitmentPending = day.commitment?.state === 'accepted'
      || day.commitment?.state === 'replacement_accepted';

    if (checkedIn && !commitmentPending && (outcome === 1 || outcome === null)) {
      return {
        dateKey: day.dateKey,
        state: 'complete',
        label: `${day.dateKey}: check-in completed. ${commitmentLabel}.`,
      };
    }
    if (commitmentPending && outcome === null) {
      return {
        dateKey: day.dateKey,
        state: 'pending',
        label: `${day.dateKey}: ${checkedIn ? 'check-in completed' : 'check-in pending'}. ${commitmentLabel}.`,
      };
    }
    if (checkedIn || outcome === 1) {
      return {
        dateKey: day.dateKey,
        state: 'partial',
        label: `${day.dateKey}: partial follow-through. ${checkedIn ? 'Check-in completed' : 'Check-in missing'}. ${commitmentLabel}.`,
      };
    }
    if (outcome === null && day.dateKey >= latestDateKey) {
      return {
        dateKey: day.dateKey,
        state: 'pending',
        label: `${day.dateKey}: still pending. ${commitmentLabel}.`,
      };
    }
    return {
      dateKey: day.dateKey,
      state: 'missed',
      label: `${day.dateKey}: check-in missing. ${commitmentLabel}.`,
    };
  });
};

const calculateAdherenceWindow = (
  days: PulseCheckScoringDay[],
  windowDays: number,
): WindowCalculation => {
  const latestDateKey = days[days.length - 1]?.dateKey || '';
  const scheduledDays = days.filter((day) => day.scheduledCheckIn !== false);
  const scorableScheduledDays = scheduledDays.filter((day) =>
    normalizeLevel(day.wellbeingLevel) !== null || day.dateKey < latestDateKey);
  const checkedInDays = scorableScheduledDays.filter((day) => normalizeLevel(day.wellbeingLevel) !== null);
  const checkInPercent = scorableScheduledDays.length > 0
    ? rounded((checkedInDays.length / scorableScheduledDays.length) * 100)
    : null;
  const commitmentOutcomes = days
    .map((day) => day.commitment ? commitmentOutcome(day.commitment, day.dateKey, latestDateKey) : null)
    .filter((value): value is number => value !== null);
  const commitmentPercent = commitmentOutcomes.length > 0
    ? rounded((commitmentOutcomes.reduce((sum, value) => sum + value, 0) / commitmentOutcomes.length) * 100)
    : null;
  const score = weightedScore([
    { score: checkInPercent, weight: 40 },
    { score: commitmentPercent, weight: 60 },
  ]);
  const evidenceCoveragePercent = rounded(
    (checkInPercent === null ? 0 : 40) + (commitmentPercent === null ? 0 : 60),
  );
  const status: PulseCheckScoreStatus = scheduledDays.length > 0 && scheduledDays.length < 3
    ? 'building'
    : score === null
      ? 'insufficient_evidence'
      : 'available';
  const dayStates = adherenceDayStates(days);
  const notes: string[] = [];
  if (commitmentPercent === null) notes.push('No verified commitment outcomes are available in this window.');
  notes.push('Connected-device wear does not contribute to Adherence.');

  return {
    score: status === 'building' ? null : score,
    status,
    confidence: confidenceFor(evidenceCoveragePercent, Math.max(checkedInDays.length, commitmentOutcomes.length), status),
    evidenceCoveragePercent,
    observedDays: Math.max(checkedInDays.length, commitmentOutcomes.length),
    windowDays,
    components: [
      {
        key: 'check_in_follow_through',
        label: 'Scheduled check-ins',
        score: checkInPercent,
        configuredWeightPercent: 40,
        evidenceAvailable: checkInPercent !== null,
        detail: `${checkedInDays.length} of ${scorableScheduledDays.length} scorable scheduled check-ins completed.`,
        dayStates,
      },
      {
        key: 'commitment_follow_through',
        label: 'Verified commitments',
        score: commitmentPercent,
        configuredWeightPercent: 60,
        evidenceAvailable: commitmentPercent !== null,
        detail: `${commitmentOutcomes.filter((value) => value === 1).length} of ${commitmentOutcomes.length} scorable commitments followed through.`,
        dayStates,
      },
    ],
    notes,
  };
};

const calculateCoherenceWindow = (
  adherence: WindowCalculation,
  wellbeing: WindowCalculation,
  recovery: WindowCalculation,
  windowDays: number,
  options: {
    isInitialBuildingPeriod?: boolean;
    establishedScore?: number | null;
  } = {},
): WindowCalculation => {
  const stateSignals = [
    {
      key: 'wellbeing',
      label: 'Feeling good',
      weight: PULSECHECK_COHERENCE_WEIGHTS.wellbeing,
      result: wellbeing,
      detail: 'Wellbeing contributes to the 90% state core for the same 14-day window.',
    },
    {
      key: 'recovery',
      label: 'Body agreement',
      weight: PULSECHECK_COHERENCE_WEIGHTS.recovery,
      result: recovery,
      detail: 'Recovery contributes to the 90% state core for the same 14-day window.',
    },
  ];
  const adherenceSignal = {
    key: 'adherence',
    label: 'Showing up',
    weight: PULSECHECK_COHERENCE_WEIGHTS.adherence,
    result: adherence,
    detail: 'A bounded contribution from scheduled check-ins and verified commitment follow-through.',
  };
  const scoringSignals = [...stateSignals, adherenceSignal];
  const availableSignals = scoringSignals.filter((signal) => signal.result.score !== null);
  const availableStateSignals = stateSignals.filter((signal) => signal.result.score !== null);
  const hasEnoughEvidence = availableStateSignals.length === stateSignals.length;
  const rawCoherenceScore = hasEnoughEvidence
    ? calculatePulseCheckCoherenceScore(wellbeing.score, recovery.score, adherence.score)
    : null;
  const evidenceCoveragePercent = rounded(
    scoringSignals.reduce(
      (sum, signal) => sum + (
        signal.result.score !== null
          ? signal.result.evidenceCoveragePercent * (signal.weight / 100)
          : 0
      ),
      0,
    ),
  );
  const currentWindowScore = rawCoherenceScore === null
    ? null
    : rawCoherenceScore === 0 && evidenceCoveragePercent < 80
      ? null
      : rawCoherenceScore === 0
        ? 1
        : rawCoherenceScore;
  const establishedScore = options.establishedScore !== null && options.establishedScore !== undefined
    && Number.isFinite(options.establishedScore)
    && options.establishedScore > 0
    ? rounded(options.establishedScore)
    : null;
  const coherenceScore = options.isInitialBuildingPeriod
    ? null
    : currentWindowScore ?? establishedScore;
  const carriedEstablishedScore = coherenceScore !== null && currentWindowScore === null && establishedScore !== null;
  const status: PulseCheckScoreStatus = options.isInitialBuildingPeriod
    ? 'building'
    : coherenceScore !== null
    ? 'available'
    : 'insufficient_evidence';
  const observedDays = availableSignals.length > 0
    ? Math.min(...availableSignals.map((signal) => signal.result.observedDays))
    : 0;
  const components = [adherenceSignal, ...stateSignals];

  return {
    score: coherenceScore,
    status,
    confidence: confidenceFor(evidenceCoveragePercent, observedDays, status),
    evidenceCoveragePercent,
    observedDays,
    windowDays,
    components: components.map((signal) => ({
      key: signal.key,
      label: signal.label,
      score: signal.result.score,
      configuredWeightPercent: signal.weight,
      evidenceAvailable: signal.result.score !== null,
      detail: signal.detail,
      dayStates: signal.key === 'adherence'
        ? signal.result.components.find((component) => component.dayStates?.length)?.dayStates
        : undefined,
    })),
    notes: [
      'Coherence uses a 90% state core from Wellbeing and Recovery plus a bounded 10% contribution from Adherence.',
      'Adherence can move the headline score by no more than 10 points; no disagreement multiplier is applied.',
      'Wellbeing and Recovery must both be independently available. Missing Adherence is reweighted and lowers evidence coverage; it never becomes zero.',
      'The latest 14 days update an established Coherence read; they do not restart it.',
      ...(carriedEstablishedScore
        ? ['Recent evidence is thin, so the last established Coherence read is carried forward.']
        : []),
    ],
  };
};

const measurementsFromDays = (days: PulseCheckScoringDay[]): PulseCheckAutonomicMeasurement[] =>
  days.flatMap((day) => day.autonomicMeasurements || []);

export const calculatePulseCheckScorecardV2 = (input: PulseCheckScoringInput): PulseCheckScorecardV2 => {
  const windowDays = Math.max(3, Math.min(28, Math.round(input.windowDays || PULSECHECK_SCORE_WINDOW_DAYS)));
  const sorted = sortDays(input.days);
  const currentDays = sorted.slice(-windowDays);
  const previousDays = sorted.slice(-(windowDays * 2), -windowDays);
  const allMeasurements = measurementsFromDays(sorted);
  const previousWindowEnd = previousDays[previousDays.length - 1]?.dateKey || null;
  const previousMeasurements = previousWindowEnd
    ? allMeasurements.filter((measurement) => measurement.dateKey <= previousWindowEnd)
    : [];

  const currentWellbeing = calculateWellbeingWindow(currentDays, input.whoFive || null, windowDays);
  const previousWellbeing = calculateWellbeingWindow(previousDays, null, windowDays);
  const currentRecovery = calculateRecoveryWindow(currentDays, allMeasurements, windowDays);
  const previousRecovery = calculateRecoveryWindow(previousDays, previousMeasurements, windowDays);
  const currentAdherence = calculateAdherenceWindow(currentDays, windowDays);
  const previousAdherence = calculateAdherenceWindow(previousDays, windowDays);
  const historyDays = sorted.slice(0, Math.max(0, sorted.length - windowDays));
  const historicalWindowDays = Math.max(windowDays, historyDays.length);
  const historicalMeasurements = measurementsFromDays(historyDays);
  const historicalAdherence = historyDays.length > 0
    ? calculateAdherenceWindow(historyDays, historicalWindowDays)
    : null;
  const historicalWellbeing = historyDays.length > 0
    ? calculateWellbeingWindow(historyDays, null, historicalWindowDays)
    : null;
  const historicalRecovery = historyDays.length > 0
    ? calculateRecoveryWindow(historyDays, historicalMeasurements, historicalWindowDays)
    : null;
  const historicalCoherence = historicalAdherence && historicalWellbeing && historicalRecovery
    ? calculateCoherenceWindow(historicalAdherence, historicalWellbeing, historicalRecovery, historicalWindowDays)
    : null;
  const persistedEstablishedCoherenceScore = input.establishedCoherenceScore !== null
    && input.establishedCoherenceScore !== undefined
    && Number.isFinite(input.establishedCoherenceScore)
    && input.establishedCoherenceScore > 0
    ? rounded(input.establishedCoherenceScore)
    : null;
  const establishedCoherenceScore = persistedEstablishedCoherenceScore
    ?? historicalCoherence?.score
    ?? null;
  const isInitialBuildingPeriod = input.accountAgeDays !== null
    && input.accountAgeDays !== undefined
    && input.accountAgeDays < PULSECHECK_COHERENCE_BUILDING_DAYS;
  const currentCoherence = calculateCoherenceWindow(currentAdherence, currentWellbeing, currentRecovery, windowDays, {
    isInitialBuildingPeriod,
    establishedScore: establishedCoherenceScore,
  });
  const previousCoherence = calculateCoherenceWindow(previousAdherence, previousWellbeing, previousRecovery, windowDays);

  const sourceTransitions = [currentRecovery.autonomic.hrv, currentRecovery.autonomic.restingHeartRate]
    .filter((lane): lane is PulseCheckAutonomicLaneResult & { laneId: string; sourceFamily: string } =>
      lane.sourceTransition && Boolean(lane.laneId) && Boolean(lane.sourceFamily),
    )
    .map((lane) => ({
      metric: lane.metric,
      activeLaneId: lane.laneId,
      sourceFamily: lane.sourceFamily,
    }));

  return {
    methodologyVersion: PULSECHECK_SCORING_VERSION,
    generatedAt: input.generatedAt || new Date().toISOString(),
    windowStart: currentDays[0]?.dateKey || null,
    windowEnd: currentDays[currentDays.length - 1]?.dateKey || null,
    wellbeing: scoreResult(currentWellbeing, previousWellbeing.score),
    recovery: scoreResult(currentRecovery, previousRecovery.score),
    adherence: scoreResult(currentAdherence, previousAdherence.score),
    coherence: scoreResult(currentCoherence, previousCoherence.score),
    autonomic: currentRecovery.autonomic,
    sourceTransitions,
    limitations: [
      'These scores are evidence-informed proprietary indices. They are not diagnoses, medical clearance, or validated clinical outcomes.',
      'Scores describe the available PulseCheck record. Missing evidence lowers coverage and is never converted to zero.',
      'HRV and resting heart rate are compared only within the same source, device, method, measurement window, and algorithm lane.',
      'Training decisions remain with the athlete care and coaching team.',
    ],
  };
};
