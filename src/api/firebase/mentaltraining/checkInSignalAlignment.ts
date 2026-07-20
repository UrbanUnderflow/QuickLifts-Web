export type SignalAlignmentClassification =
  | 'aligned'
  | 'not_aligned'
  | 'mixed'
  | 'insufficient_data';

export type SleepReportDirection = 'positive' | 'negative';

export type SleepObjectiveSignals = {
  sleepDurationHours?: number;
  sleepEfficiencyPct?: number;
  sleepScore?: number;
  recoveryScore?: number;
  readinessScore?: number;
  personalBaselineHours?: number;
};

export type SleepAlignmentResult = {
  classification: SignalAlignmentClassification;
  favorableSignals: string[];
  unfavorableSignals: string[];
  observedSignals: string[];
  confidence: 'degraded' | 'directional' | 'stable';
  ruleVersion: 'sleep_self_report_alignment_v1';
};

const finiteNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
};

const firstNumber = (record: Record<string, unknown>, keys: string[]): number | undefined => {
  for (const key of keys) {
    const value = finiteNumber(record[key]);
    if (value !== undefined) return value;
  }
  return undefined;
};

export const normalizeSleepEfficiencyPct = (value: unknown): number | undefined => {
  const number = finiteNumber(value);
  if (number === undefined || number <= 0) return undefined;
  return number <= 1 ? number * 100 : number;
};

export const extractSleepObjectiveSignals = (
  recovery: Record<string, unknown>,
  personalBaselineHours?: number,
): SleepObjectiveSignals => {
  const totalSleepMin = firstNumber(recovery, ['totalSleepMin', 'totalSleepMinutes', 'sleepDurationMinutes']);
  const directHours = firstNumber(recovery, ['sleepDuration', 'sleepDurationHours', 'totalSleepHours']);
  return {
    sleepDurationHours: directHours ?? (totalSleepMin !== undefined ? totalSleepMin / 60 : undefined),
    sleepEfficiencyPct: normalizeSleepEfficiencyPct(recovery.sleepEfficiency),
    sleepScore: firstNumber(recovery, ['sleepScore', 'sleepQualityScore']),
    recoveryScore: finiteNumber(recovery.recoveryScore),
    readinessScore: finiteNumber(recovery.readinessScore),
    personalBaselineHours,
  };
};

export const classifySleepSelfReportAlignment = (
  direction: SleepReportDirection,
  signals: SleepObjectiveSignals,
): SleepAlignmentResult => {
  const favorableSignals: string[] = [];
  const unfavorableSignals: string[] = [];
  const observedSignals: string[] = [];

  const normalizedScores = [
    ['sleep_score', signals.sleepScore],
    ['recovery_score', signals.recoveryScore],
    ['readiness_score', signals.readinessScore],
  ] as const;
  for (const [name, value] of normalizedScores) {
    if (value === undefined) continue;
    observedSignals.push(name);
    if (value >= 75) favorableSignals.push(name);
    else if (value <= 55) unfavorableSignals.push(name);
  }

  if (signals.sleepEfficiencyPct !== undefined) {
    observedSignals.push('sleep_efficiency');
    if (signals.sleepEfficiencyPct >= 85) favorableSignals.push('sleep_efficiency');
    else if (signals.sleepEfficiencyPct < 75) unfavorableSignals.push('sleep_efficiency');
  }

  if (signals.sleepDurationHours !== undefined) {
    observedSignals.push('sleep_duration');
    if (signals.personalBaselineHours !== undefined && signals.personalBaselineHours > 0) {
      const baselineRatio = signals.sleepDurationHours / signals.personalBaselineHours;
      if (baselineRatio >= 0.9) favorableSignals.push('sleep_duration_vs_personal_baseline');
      else if (baselineRatio < 0.8) unfavorableSignals.push('sleep_duration_vs_personal_baseline');
    }
  }

  const supportive = direction === 'positive' ? favorableSignals : unfavorableSignals;
  const contradictory = direction === 'positive' ? unfavorableSignals : favorableSignals;
  let classification: SignalAlignmentClassification;
  if (supportive.length > 0 && contradictory.length === 0) classification = 'aligned';
  else if (contradictory.length > 0 && supportive.length === 0) classification = 'not_aligned';
  else if (supportive.length > 0 && contradictory.length > 0) classification = 'mixed';
  else classification = 'insufficient_data';

  const classifiedSignalCount = favorableSignals.length + unfavorableSignals.length;
  const confidence = classifiedSignalCount >= 2
    ? 'stable'
    : classifiedSignalCount === 1
      ? 'directional'
      : 'degraded';

  return {
    classification,
    favorableSignals,
    unfavorableSignals,
    observedSignals,
    confidence,
    ruleVersion: 'sleep_self_report_alignment_v1',
  };
};

export const __internal = {
  finiteNumber,
  firstNumber,
};
