// =============================================================================
// Phase J Device Onboarding + Self-Report Foundation
//
// Pure TypeScript helpers for deciding whether a Pulse Check athlete has enough
// device/onboarding coverage for Phase J, and for preparing self-report payloads
// when device data is absent. This module intentionally does not import Firebase
// clients or write to Firestore.
// =============================================================================

import {
  getPulseCheckDeviceRegistryEntryByFamily,
  PULSECHECK_DEVICE_REGISTRY_SEED_ENTRIES,
  type PulseCheckDeviceFamily,
  type PulseCheckDeviceRegistryDataType,
  type PulseCheckDeviceRegistryEntry,
} from './pulsecheckDeviceRegistry';
import {
  PHASE_J_SESSION_CONTRACT_VERSION,
  type PhaseJActorRef,
  type PhaseJConfidenceTier,
  type PhaseJPrimitiveSnapshot,
  type PhaseJRecordProvenance,
  type PhaseJSessionCandidate,
  type PhaseJSessionType,
  type PhaseJSourceCoverage,
} from './phaseJSessionContracts';

export const PHASE_J_DEVICE_ONBOARDING_SELF_REPORT_CONTRACT_VERSION =
  'phase-j-device-onboarding-self-report-v0.1';

export type PhaseJDeviceConnectionStatus =
  | 'not_connected'
  | 'pending_auth'
  | 'connected'
  | 'connected_waiting_for_data'
  | 'synced'
  | 'stale'
  | 'denied'
  | 'error';

export type PhaseJDevicePermissionStatus = 'granted' | 'missing' | 'denied' | 'unknown';

export type PhaseJDeviceOnboardingAction =
  | 'none'
  | 'connect_device'
  | 'grant_permissions'
  | 'wait_for_first_sync'
  | 'refresh_stale_device'
  | 'use_self_report'
  | 'ask_device_absent_confirmation'
  | 'coach_schedule_review'
  | 'operator_review';

export type PhaseJDeviceRequirementMode = 'any_supported_device' | 'required_data_types' | 'live_session_device';

export type PhaseJSelfReportConfidenceReason =
  | 'self_report_only'
  | 'device_absent'
  | 'device_stale'
  | 'athlete_context_seeded'
  | 'coach_context_supported'
  | 'schedule_context_supported'
  | 'coach_and_schedule_supported';

export type PhaseJSelfReportQuestionId =
  | 'session_happened'
  | 'session_type'
  | 'session_rpe'
  | 'session_summary'
  | 'sleep_quality'
  | 'sleep_duration_hours'
  | 'energy_level'
  | 'soreness_overall'
  | 'stress_level'
  | 'hydration_state'
  | 'fueling_state';

export type PhaseJSelfReportDomain = 'training' | 'recovery' | 'behavioral' | 'nutrition' | 'summary';

export interface PhaseJDevicePermissionSnapshot {
  dataType: PulseCheckDeviceRegistryDataType;
  status: PhaseJDevicePermissionStatus;
}

export interface PhaseJAthleteDeviceSnapshot {
  deviceFamily: PulseCheckDeviceFamily;
  connectionStatus: PhaseJDeviceConnectionStatus;
  permissions?: PhaseJDevicePermissionSnapshot[];
  lastSyncedAt?: number;
  lastObservedAt?: number;
  coveragePct?: number;
  sourceRecordIds?: string[];
  adapter?: string;
  errorCode?: string;
}

export interface PhaseJDeviceRequirementPolicy {
  mode?: PhaseJDeviceRequirementMode;
  requiredDataTypes?: PulseCheckDeviceRegistryDataType[];
  minCoveragePct?: number;
  maxStalenessSec?: number;
  allowedDeviceFamilies?: PulseCheckDeviceFamily[];
  allowPlannedDevices?: boolean;
  requireLiveStreaming?: boolean;
}

export interface PhaseJAthletePreSeededContext {
  athleteUserId: string;
  teamId?: string;
  sportId?: string;
  sportName?: string;
  position?: string;
  timezone?: string;
  coachActor?: PhaseJActorRef;
  coachContextAvailable?: boolean;
  coachContextSummary?: string;
  scheduleEventId?: string;
  prescribedSessionId?: string;
  scheduleSessionType?: PhaseJSessionType;
  scheduleStartsAt?: number;
  scheduleEndsAt?: number;
  scheduleConfidenceTier?: PhaseJConfidenceTier;
}

export interface PhaseJDeviceOnboardingEvaluationInput {
  athleteUserId: string;
  devices?: PhaseJAthleteDeviceSnapshot[];
  policy?: PhaseJDeviceRequirementPolicy;
  context?: PhaseJAthletePreSeededContext;
  now?: number;
}

export interface PhaseJDeviceCoverageSummary {
  bestDevice?: PhaseJAthleteDeviceSnapshot;
  registryEntry?: PulseCheckDeviceRegistryEntry;
  usableDeviceFamilies: PulseCheckDeviceFamily[];
  missingDataTypes: PulseCheckDeviceRegistryDataType[];
  deniedDataTypes: PulseCheckDeviceRegistryDataType[];
  staleDeviceFamilies: PulseCheckDeviceFamily[];
  waitingDeviceFamilies: PulseCheckDeviceFamily[];
  coveragePct: number;
  lastObservedAt?: number;
  hasLiveSessionDevice: boolean;
  hasAnyConnectedDevice: boolean;
}

export interface PhaseJDeviceOnboardingEvaluation {
  athleteUserId: string;
  satisfiesRequirements: boolean;
  action: PhaseJDeviceOnboardingAction;
  confidenceTier: PhaseJConfidenceTier;
  confidenceScore: number;
  selfReportAllowed: boolean;
  selfReportConfidenceCap: PhaseJConfidenceTier;
  confidenceReasons: PhaseJSelfReportConfidenceReason[];
  missingContext: string[];
  requirementSummary: string[];
  coverage: PhaseJDeviceCoverageSummary;
  preSeededContext?: PhaseJAthletePreSeededContext;
  contractVersion: typeof PHASE_J_DEVICE_ONBOARDING_SELF_REPORT_CONTRACT_VERSION;
}

export interface PhaseJSelfReportAnswerInput {
  questionId: PhaseJSelfReportQuestionId;
  numericValue?: number;
  enumValue?: string;
  booleanValue?: boolean;
  textValue?: string;
}

export interface PhaseJSelfReportPayloadInput {
  athleteUserId: string;
  observationDate: string;
  observedAt?: number;
  observedWindowStart?: number;
  observedWindowEnd?: number;
  timezone?: string;
  answers: PhaseJSelfReportAnswerInput[];
  evaluation?: PhaseJDeviceOnboardingEvaluation;
  context?: PhaseJAthletePreSeededContext;
}

export interface PhaseJSelfReportDerivedPayload {
  sessionHappened?: boolean;
  sessionType?: PhaseJSessionType;
  sessionRpe?: number;
  sessionSummary?: string;
  sleepQualityProxy?: number;
  totalSleepMinProxy?: number;
  readinessScoreProxy?: number;
  sorenessScore?: number;
  stressScore?: number;
  hydrationLabel?: 'low' | 'okay' | 'strong';
  fuelingLabel?: 'under' | 'on_plan' | 'over';
  athleteContext?: {
    sportId?: string;
    sportName?: string;
    position?: string;
    teamId?: string;
  };
  coachContext?: {
    coachActor?: PhaseJActorRef;
    summary?: string;
    scheduleEventId?: string;
    prescribedSessionId?: string;
    scheduleSessionType?: PhaseJSessionType;
  };
}

export interface PhaseJSelfReportSourcePayload {
  id: string;
  athleteUserId: string;
  sourceFamily: 'pulsecheck_self_report';
  sourceType: `phase_j_self_report_${PhaseJSelfReportDomain}`;
  recordType: 'summary_input' | 'session_input' | 'context_input';
  domain: PhaseJSelfReportDomain;
  observedAt: number;
  observedWindowStart: number;
  observedWindowEnd: number;
  ingestedAt: number;
  timezone: string;
  status: 'active';
  dedupeKey: string;
  payloadVersion: typeof PHASE_J_DEVICE_ONBOARDING_SELF_REPORT_CONTRACT_VERSION;
  payload: PhaseJSelfReportDerivedPayload;
  sourceMetadata: {
    syncOrigin: 'phase_j_device_absent_self_report';
    writer: 'phaseJDeviceOnboardingSelfReport.buildPhaseJSelfReportSourcePayloads';
    notes: string[];
  };
  provenance: {
    mode: 'self_reported';
    sourceSystem: 'pulsecheck_self_report';
    confidenceLabel: PhaseJConfidenceTier;
    notes: string[];
  };
}

export interface BuildPhaseJDeviceAbsentCandidateInput {
  id: string;
  athleteUserId: string;
  teamId?: string;
  sportId?: string;
  timezone?: string;
  detectedStartAt: number;
  detectedEndAt: number;
  candidateKinds?: PhaseJSessionType[];
  selfReportPayloads?: PhaseJSelfReportSourcePayload[];
  evaluation?: PhaseJDeviceOnboardingEvaluation;
  context?: PhaseJAthletePreSeededContext;
  now?: number;
  expiresAt?: number;
}

export interface PhaseJDeviceAbsentCandidateBuildResult {
  candidate: PhaseJSessionCandidate;
  primitiveSnapshot: PhaseJPrimitiveSnapshot;
  provenance: PhaseJRecordProvenance;
}

const DEFAULT_REQUIRED_DATA_TYPES: PulseCheckDeviceRegistryDataType[] = [
  'hr_continuous',
  'workouts',
  'activity_samples',
];

const DEFAULT_POLICY: Required<
  Pick<
    PhaseJDeviceRequirementPolicy,
    'mode' | 'requiredDataTypes' | 'minCoveragePct' | 'maxStalenessSec' | 'allowPlannedDevices' | 'requireLiveStreaming'
  >
> = {
  mode: 'required_data_types',
  requiredDataTypes: DEFAULT_REQUIRED_DATA_TYPES,
  minCoveragePct: 0.6,
  maxStalenessSec: 36 * 60 * 60,
  allowPlannedDevices: false,
  requireLiveStreaming: false,
};

const SESSION_TYPE_ANSWERS = new Set<PhaseJSessionType>([
  'lift',
  'practice',
  'conditioning',
  'game',
  'recovery',
  'individual_training',
  'walk',
  'run',
  'bike',
  'other',
  'unknown',
]);

const nowSeconds = (): number => Math.round(Date.now() / 1000);

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const roundTo = (value: number, decimals = 3): number => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

const requireString = (value: unknown, label: string): string => {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized) {
    throw new Error(`[PhaseJDeviceOnboardingSelfReport] ${label} is required.`);
  }
  return normalized;
};

const nonEmptyString = (value: unknown): string | undefined => {
  const normalized = typeof value === 'string' ? value.trim() : '';
  return normalized || undefined;
};

const unique = <T>(values: T[]): T[] => Array.from(new Set(values.filter(Boolean)));

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

const normalizePolicy = (policy?: PhaseJDeviceRequirementPolicy): PhaseJDeviceRequirementPolicy & typeof DEFAULT_POLICY => ({
  ...DEFAULT_POLICY,
  ...policy,
  requiredDataTypes: policy?.requiredDataTypes || DEFAULT_POLICY.requiredDataTypes,
});

const isDeviceFamilyAllowed = (
  entry: PulseCheckDeviceRegistryEntry,
  policy: PhaseJDeviceRequirementPolicy & typeof DEFAULT_POLICY,
): boolean => {
  if (policy.allowedDeviceFamilies && !policy.allowedDeviceFamilies.includes(entry.deviceFamily)) return false;
  if (entry.integrationStatus === 'not-supported') return false;
  if (!policy.allowPlannedDevices && entry.integrationStatus === 'planned') return false;
  if (policy.requireLiveStreaming && !entry.liveStreamingSupported) return false;
  return true;
};

const isConnectedStatus = (status: PhaseJDeviceConnectionStatus): boolean =>
  status === 'connected' || status === 'connected_waiting_for_data' || status === 'synced' || status === 'stale';

const permissionStatusFor = (
  device: PhaseJAthleteDeviceSnapshot,
  dataType: PulseCheckDeviceRegistryDataType,
): PhaseJDevicePermissionStatus => {
  const permission = device.permissions?.find((entry) => entry.dataType === dataType);
  return permission?.status || 'unknown';
};

const deviceProvidesDataType = (
  device: PhaseJAthleteDeviceSnapshot,
  entry: PulseCheckDeviceRegistryEntry,
  dataType: PulseCheckDeviceRegistryDataType,
): boolean => {
  if (!entry.dataTypesProvided.includes(dataType)) return false;
  const permissionStatus = permissionStatusFor(device, dataType);
  return permissionStatus !== 'missing' && permissionStatus !== 'denied';
};

const deviceCoverageScore = (
  device: PhaseJAthleteDeviceSnapshot,
  entry: PulseCheckDeviceRegistryEntry,
  policy: PhaseJDeviceRequirementPolicy & typeof DEFAULT_POLICY,
  now: number,
): number => {
  if (!isConnectedStatus(device.connectionStatus)) return 0;
  const requiredCoverage = policy.requiredDataTypes.length > 0
    ? policy.requiredDataTypes.filter((dataType) => deviceProvidesDataType(device, entry, dataType)).length /
      policy.requiredDataTypes.length
    : 1;
  const explicitCoverage = isFiniteNumber(device.coveragePct) ? clamp(device.coveragePct, 0, 1) : requiredCoverage;
  const observedAt = device.lastObservedAt || device.lastSyncedAt;
  const freshness = observedAt ? clamp(1 - ((now - observedAt) / policy.maxStalenessSec), 0, 1) : 0.35;
  const statusPenalty = device.connectionStatus === 'stale' ? 0.35 : device.connectionStatus === 'connected_waiting_for_data' ? 0.55 : 1;
  const registryPenalty = entry.integrationStatus === 'experimental' ? 0.8 : entry.integrationStatus === 'pilot' ? 0.9 : 1;

  return roundTo(((requiredCoverage * 0.5) + (explicitCoverage * 0.3) + (freshness * 0.2)) * statusPenalty * registryPenalty);
};

const confidenceTierForScore = (
  score: number,
  hasCoachOrScheduleSupport: boolean,
): PhaseJConfidenceTier => {
  if (score >= 0.86 && hasCoachOrScheduleSupport) return 'strong_contextual';
  if (score >= 0.72) return 'usable';
  if (score >= 0.38) return 'directional';
  return 'hold_back';
};

const hasCoachSupport = (context?: PhaseJAthletePreSeededContext): boolean =>
  Boolean(context?.coachContextAvailable || context?.coachActor);

const hasScheduleSupport = (context?: PhaseJAthletePreSeededContext): boolean =>
  Boolean(context?.scheduleEventId || context?.prescribedSessionId || context?.scheduleSessionType);

const selfReportConfidenceCapFor = (
  context: PhaseJAthletePreSeededContext | undefined,
): { cap: PhaseJConfidenceTier; reasons: PhaseJSelfReportConfidenceReason[] } => {
  const coach = hasCoachSupport(context);
  const schedule = hasScheduleSupport(context);
  const reasons: PhaseJSelfReportConfidenceReason[] = ['self_report_only'];

  if (context?.sportId || context?.sportName || context?.position) reasons.push('athlete_context_seeded');
  if (coach && schedule) {
    reasons.push('coach_and_schedule_supported');
    return { cap: 'usable', reasons };
  }
  if (coach) reasons.push('coach_context_supported');
  if (schedule) reasons.push('schedule_context_supported');
  return { cap: coach || schedule ? 'usable' : 'directional', reasons };
};

const chooseAction = (
  coverage: PhaseJDeviceCoverageSummary,
  satisfiesRequirements: boolean,
  context: PhaseJAthletePreSeededContext | undefined,
): PhaseJDeviceOnboardingAction => {
  if (satisfiesRequirements) return 'none';
  if (!coverage.hasAnyConnectedDevice) return hasCoachSupport(context) || hasScheduleSupport(context)
    ? 'use_self_report'
    : 'connect_device';
  if (coverage.deniedDataTypes.length > 0) return 'grant_permissions';
  if (coverage.waitingDeviceFamilies.length > 0) return 'wait_for_first_sync';
  if (coverage.staleDeviceFamilies.length > 0) return hasScheduleSupport(context)
    ? 'ask_device_absent_confirmation'
    : 'refresh_stale_device';
  if (hasCoachSupport(context) || hasScheduleSupport(context)) return 'use_self_report';
  return 'operator_review';
};

const buildRequirementSummary = (
  coverage: PhaseJDeviceCoverageSummary,
  policy: PhaseJDeviceRequirementPolicy & typeof DEFAULT_POLICY,
): string[] => {
  const summary: string[] = [];
  summary.push(`mode:${policy.mode}`);
  summary.push(`min_coverage:${policy.minCoveragePct}`);
  if (policy.requiredDataTypes.length > 0) {
    summary.push(`required_data_types:${policy.requiredDataTypes.join(',')}`);
  }
  if (coverage.bestDevice) summary.push(`best_device:${coverage.bestDevice.deviceFamily}`);
  if (coverage.missingDataTypes.length > 0) summary.push(`missing:${coverage.missingDataTypes.join(',')}`);
  if (coverage.deniedDataTypes.length > 0) summary.push(`denied:${coverage.deniedDataTypes.join(',')}`);
  return summary;
};

export const evaluatePhaseJDeviceOnboarding = (
  input: PhaseJDeviceOnboardingEvaluationInput,
): PhaseJDeviceOnboardingEvaluation => {
  const athleteUserId = requireString(input.athleteUserId, 'athleteUserId');
  const now = Math.round(input.now || nowSeconds());
  const policy = normalizePolicy(input.policy);
  const devices = input.devices || [];
  const scoredDevices = devices
    .map((device) => {
      const entry = getPulseCheckDeviceRegistryEntryByFamily(device.deviceFamily);
      if (!entry || !isDeviceFamilyAllowed(entry, policy)) return undefined;
      return {
        device,
        entry,
        score: deviceCoverageScore(device, entry, policy, now),
      };
    })
    .filter((entry): entry is { device: PhaseJAthleteDeviceSnapshot; entry: PulseCheckDeviceRegistryEntry; score: number } =>
      Boolean(entry))
    .sort((left, right) => right.score - left.score);
  const best = scoredDevices[0];
  const usableDevices = scoredDevices.filter((entry) => entry.score >= policy.minCoveragePct);
  const providedDataTypes = new Set<PulseCheckDeviceRegistryDataType>();
  const deniedDataTypes = new Set<PulseCheckDeviceRegistryDataType>();

  for (const { device, entry } of scoredDevices) {
    for (const dataType of policy.requiredDataTypes) {
      if (permissionStatusFor(device, dataType) === 'denied') deniedDataTypes.add(dataType);
      if (deviceProvidesDataType(device, entry, dataType)) providedDataTypes.add(dataType);
    }
  }

  const missingDataTypes = policy.requiredDataTypes.filter((dataType) => !providedDataTypes.has(dataType));
  const staleDeviceFamilies = scoredDevices
    .filter(({ device }) => {
      const observedAt = device.lastObservedAt || device.lastSyncedAt;
      return device.connectionStatus === 'stale' || Boolean(observedAt && now - observedAt > policy.maxStalenessSec);
    })
    .map(({ device }) => device.deviceFamily);
  const waitingDeviceFamilies = scoredDevices
    .filter(({ device }) => device.connectionStatus === 'connected_waiting_for_data')
    .map(({ device }) => device.deviceFamily);
  const hasLiveSessionDevice = scoredDevices.some(({ entry }) => entry.liveStreamingSupported);
  const hasAnyConnectedDevice = scoredDevices.some(({ device }) => isConnectedStatus(device.connectionStatus));
  const coveragePct = best?.score || 0;
  const satisfiesByMode =
    policy.mode === 'any_supported_device'
      ? usableDevices.length > 0
      : policy.mode === 'live_session_device'
        ? usableDevices.some(({ entry }) => entry.liveStreamingSupported)
        : missingDataTypes.length === 0 && coveragePct >= policy.minCoveragePct;
  const satisfiesRequirements = Boolean(satisfiesByMode && (!policy.requireLiveStreaming || hasLiveSessionDevice));
  const selfReport = selfReportConfidenceCapFor(input.context);
  const confidenceReasons = unique([
    ...(hasAnyConnectedDevice ? [] : ['device_absent' as const]),
    ...(staleDeviceFamilies.length > 0 ? ['device_stale' as const] : []),
    ...selfReport.reasons,
  ]);
  const action = chooseAction(
    {
      bestDevice: best?.device,
      registryEntry: best?.entry,
      usableDeviceFamilies: usableDevices.map(({ device }) => device.deviceFamily),
      missingDataTypes,
      deniedDataTypes: Array.from(deniedDataTypes),
      staleDeviceFamilies: unique(staleDeviceFamilies),
      waitingDeviceFamilies: unique(waitingDeviceFamilies),
      coveragePct,
      lastObservedAt: best?.device.lastObservedAt || best?.device.lastSyncedAt,
      hasLiveSessionDevice,
      hasAnyConnectedDevice,
    },
    satisfiesRequirements,
    input.context,
  );
  const missingContext = unique([
    ...missingDataTypes.map((dataType) => `device_data:${dataType}`),
    ...(hasAnyConnectedDevice ? [] : ['device_absent']),
    ...(input.context?.sportId || input.context?.sportName ? [] : ['sport']),
    ...(input.context?.position ? [] : ['position']),
    ...(hasCoachSupport(input.context) || hasScheduleSupport(input.context) ? [] : ['coach_or_schedule_context']),
  ]);
  const confidenceScore = satisfiesRequirements
    ? coveragePct
    : roundTo(Math.min(selfReport.cap === 'usable' ? 0.68 : 0.48, 0.28 + (coveragePct * 0.3)));

  const coverage: PhaseJDeviceCoverageSummary = {
    bestDevice: best?.device,
    registryEntry: best?.entry,
    usableDeviceFamilies: usableDevices.map(({ device }) => device.deviceFamily),
    missingDataTypes,
    deniedDataTypes: Array.from(deniedDataTypes),
    staleDeviceFamilies: unique(staleDeviceFamilies),
    waitingDeviceFamilies: unique(waitingDeviceFamilies),
    coveragePct,
    lastObservedAt: best?.device.lastObservedAt || best?.device.lastSyncedAt,
    hasLiveSessionDevice,
    hasAnyConnectedDevice,
  };

  return stripUndefinedDeep({
    athleteUserId,
    satisfiesRequirements,
    action,
    confidenceTier: satisfiesRequirements
      ? confidenceTierForScore(coveragePct, hasCoachSupport(input.context) || hasScheduleSupport(input.context))
      : selfReport.cap,
    confidenceScore,
    selfReportAllowed: !satisfiesRequirements,
    selfReportConfidenceCap: selfReport.cap,
    confidenceReasons,
    missingContext,
    requirementSummary: buildRequirementSummary(coverage, policy),
    coverage,
    preSeededContext: input.context,
    contractVersion: PHASE_J_DEVICE_ONBOARDING_SELF_REPORT_CONTRACT_VERSION,
  });
};

export const listPhaseJOnboardingEligibleDevices = (
  policy: PhaseJDeviceRequirementPolicy = {},
): PulseCheckDeviceRegistryEntry[] => {
  const normalizedPolicy = normalizePolicy(policy);
  return PULSECHECK_DEVICE_REGISTRY_SEED_ENTRIES.filter((entry) => isDeviceFamilyAllowed(entry, normalizedPolicy));
};

const answerById = (
  answers: PhaseJSelfReportAnswerInput[],
  questionId: PhaseJSelfReportQuestionId,
): PhaseJSelfReportAnswerInput | undefined => answers.find((answer) => answer.questionId === questionId);

const numericAnswer = (
  answers: PhaseJSelfReportAnswerInput[],
  questionId: PhaseJSelfReportQuestionId,
  min: number,
  max: number,
): number | undefined => {
  const value = answerById(answers, questionId)?.numericValue;
  return isFiniteNumber(value) ? clamp(value, min, max) : undefined;
};

const enumAnswer = (
  answers: PhaseJSelfReportAnswerInput[],
  questionId: PhaseJSelfReportQuestionId,
): string | undefined => nonEmptyString(answerById(answers, questionId)?.enumValue);

const textAnswer = (
  answers: PhaseJSelfReportAnswerInput[],
  questionId: PhaseJSelfReportQuestionId,
): string | undefined => nonEmptyString(answerById(answers, questionId)?.textValue);

const booleanAnswer = (
  answers: PhaseJSelfReportAnswerInput[],
  questionId: PhaseJSelfReportQuestionId,
): boolean | undefined => {
  const answer = answerById(answers, questionId);
  if (typeof answer?.booleanValue === 'boolean') return answer.booleanValue;
  if (answer?.enumValue === 'yes') return true;
  if (answer?.enumValue === 'no') return false;
  return undefined;
};

const sessionTypeAnswer = (answers: PhaseJSelfReportAnswerInput[]): PhaseJSessionType | undefined => {
  const value = enumAnswer(answers, 'session_type');
  return value && SESSION_TYPE_ANSWERS.has(value as PhaseJSessionType) ? value as PhaseJSessionType : undefined;
};

const buildDayWindowSeconds = (
  observationDate: string,
  observedWindowStart?: number,
  observedWindowEnd?: number,
): { startSec: number; endSec: number } => {
  if (isFiniteNumber(observedWindowStart) && isFiniteNumber(observedWindowEnd)) {
    return {
      startSec: Math.round(observedWindowStart),
      endSec: Math.round(Math.max(observedWindowEnd, observedWindowStart)),
    };
  }
  const start = new Date(`${observationDate}T00:00:00Z`).getTime();
  const end = new Date(`${observationDate}T23:59:59Z`).getTime();
  return {
    startSec: Math.round((Number.isFinite(start) ? start : Date.now()) / 1000),
    endSec: Math.round((Number.isFinite(end) ? end : Date.now()) / 1000),
  };
};

export const derivePhaseJSelfReportPayload = (
  input: Pick<PhaseJSelfReportPayloadInput, 'answers' | 'context'>,
): PhaseJSelfReportDerivedPayload => {
  const sleepQuality = numericAnswer(input.answers, 'sleep_quality', 1, 5);
  const sleepHours = numericAnswer(input.answers, 'sleep_duration_hours', 0, 14);
  const energy = numericAnswer(input.answers, 'energy_level', 1, 5);
  const soreness = numericAnswer(input.answers, 'soreness_overall', 1, 5);
  const stress = numericAnswer(input.answers, 'stress_level', 1, 5);
  const hydration = enumAnswer(input.answers, 'hydration_state');
  const fueling = enumAnswer(input.answers, 'fueling_state');
  const context = input.context;

  return stripUndefinedDeep({
    sessionHappened: booleanAnswer(input.answers, 'session_happened'),
    sessionType: sessionTypeAnswer(input.answers) || context?.scheduleSessionType,
    sessionRpe: numericAnswer(input.answers, 'session_rpe', 1, 10),
    sessionSummary: textAnswer(input.answers, 'session_summary'),
    sleepQualityProxy: sleepQuality !== undefined ? roundTo((sleepQuality - 1) / 4, 2) : undefined,
    totalSleepMinProxy: sleepHours !== undefined ? Math.round(sleepHours * 60) : undefined,
    readinessScoreProxy: energy !== undefined ? Math.round(((energy - 1) / 4) * 100) : undefined,
    sorenessScore: soreness,
    stressScore: stress,
    hydrationLabel: hydration === 'low' || hydration === 'okay' || hydration === 'strong' ? hydration : undefined,
    fuelingLabel: fueling === 'under' || fueling === 'on_plan' || fueling === 'over' ? fueling : undefined,
    athleteContext: {
      sportId: context?.sportId,
      sportName: context?.sportName,
      position: context?.position,
      teamId: context?.teamId,
    },
    coachContext: {
      coachActor: context?.coachActor,
      summary: context?.coachContextSummary,
      scheduleEventId: context?.scheduleEventId,
      prescribedSessionId: context?.prescribedSessionId,
      scheduleSessionType: context?.scheduleSessionType,
    },
  });
};

const domainPayloads = (
  payload: PhaseJSelfReportDerivedPayload,
): Array<{ domain: PhaseJSelfReportDomain; recordType: PhaseJSelfReportSourcePayload['recordType']; payload: PhaseJSelfReportDerivedPayload }> => {
  const records: Array<{ domain: PhaseJSelfReportDomain; recordType: PhaseJSelfReportSourcePayload['recordType']; payload: PhaseJSelfReportDerivedPayload }> = [];
  const trainingPayload = stripUndefinedDeep({
    sessionHappened: payload.sessionHappened,
    sessionType: payload.sessionType,
    sessionRpe: payload.sessionRpe,
    sessionSummary: payload.sessionSummary,
    athleteContext: payload.athleteContext,
    coachContext: payload.coachContext,
  });
  const recoveryPayload = stripUndefinedDeep({
    sleepQualityProxy: payload.sleepQualityProxy,
    totalSleepMinProxy: payload.totalSleepMinProxy,
    sorenessScore: payload.sorenessScore,
    athleteContext: payload.athleteContext,
  });
  const behavioralPayload = stripUndefinedDeep({
    readinessScoreProxy: payload.readinessScoreProxy,
    stressScore: payload.stressScore,
    athleteContext: payload.athleteContext,
  });
  const nutritionPayload = stripUndefinedDeep({
    hydrationLabel: payload.hydrationLabel,
    fuelingLabel: payload.fuelingLabel,
    athleteContext: payload.athleteContext,
  });

  if (Object.keys(trainingPayload).length > 0) {
    records.push({ domain: 'training', recordType: 'session_input', payload: trainingPayload });
  }
  if (Object.keys(recoveryPayload).length > 0) {
    records.push({ domain: 'recovery', recordType: 'summary_input', payload: recoveryPayload });
  }
  if (Object.keys(behavioralPayload).length > 0) {
    records.push({ domain: 'behavioral', recordType: 'summary_input', payload: behavioralPayload });
  }
  if (Object.keys(nutritionPayload).length > 0) {
    records.push({ domain: 'nutrition', recordType: 'summary_input', payload: nutritionPayload });
  }
  return records;
};

export const buildPhaseJSelfReportSourcePayloads = (
  input: PhaseJSelfReportPayloadInput,
): PhaseJSelfReportSourcePayload[] => {
  const athleteUserId = requireString(input.athleteUserId, 'athleteUserId');
  const observationDate = requireString(input.observationDate, 'observationDate');
  const observedAt = Math.round(input.observedAt || nowSeconds());
  const window = buildDayWindowSeconds(input.observationDate, input.observedWindowStart, input.observedWindowEnd);
  const timezone = input.timezone || input.context?.timezone || 'UTC';
  const context = input.context || input.evaluation?.preSeededContext;
  const derivedPayload = derivePhaseJSelfReportPayload({ answers: input.answers, context });
  const confidenceCap = input.evaluation?.selfReportConfidenceCap || selfReportConfidenceCapFor(context).cap;
  const confidenceNotes = unique([
    ...(input.evaluation?.confidenceReasons || selfReportConfidenceCapFor(context).reasons),
    input.evaluation?.action ? `action:${input.evaluation.action}` : '',
  ]);

  return domainPayloads(derivedPayload).map(({ domain, recordType, payload }) => {
    const sourceType: PhaseJSelfReportSourcePayload['sourceType'] = `phase_j_self_report_${domain}`;
    const id = `${athleteUserId}_phase_j_self_report_${domain}_${observationDate}`;
    return stripUndefinedDeep({
      id,
      athleteUserId,
      sourceFamily: 'pulsecheck_self_report',
      sourceType,
      recordType,
      domain,
      observedAt,
      observedWindowStart: window.startSec,
      observedWindowEnd: window.endSec,
      ingestedAt: observedAt,
      timezone,
      status: 'active',
      dedupeKey: `${athleteUserId}|pulsecheck_self_report|phase_j|${domain}|${observationDate}`,
      payloadVersion: PHASE_J_DEVICE_ONBOARDING_SELF_REPORT_CONTRACT_VERSION,
      payload,
      sourceMetadata: {
        syncOrigin: 'phase_j_device_absent_self_report',
        writer: 'phaseJDeviceOnboardingSelfReport.buildPhaseJSelfReportSourcePayloads',
        notes: [
          'Prepared only; caller owns persistence.',
          'Self-report confidence is capped unless coach or schedule context supports it.',
        ],
      },
      provenance: {
        mode: 'self_reported',
        sourceSystem: 'pulsecheck_self_report',
        confidenceLabel: confidenceCap,
        notes: confidenceNotes,
      },
    });
  });
};

const sourceCoverageFromPayloads = (
  payloads: PhaseJSelfReportSourcePayload[],
): PhaseJSourceCoverage[] =>
  payloads.map((payload) => ({
    sourceFamily: payload.sourceFamily,
    sourceType: payload.sourceType,
    coveragePct: payload.domain === 'training' ? 0.35 : 0.25,
    sampleCount: Object.keys(payload.payload).length,
    firstObservedAt: payload.observedWindowStart,
    lastObservedAt: payload.observedWindowEnd,
  }));

const buildDeviceAbsentPrimitiveSnapshot = (
  input: BuildPhaseJDeviceAbsentCandidateInput,
  payloads: PhaseJSelfReportSourcePayload[],
): PhaseJPrimitiveSnapshot => ({
  durationSec: Math.max(0, Math.round(input.detectedEndAt - input.detectedStartAt)),
  detectedStartAt: Math.round(input.detectedStartAt),
  detectedEndAt: Math.round(Math.max(input.detectedEndAt, input.detectedStartAt)),
  timezone: input.timezone || input.context?.timezone || input.evaluation?.preSeededContext?.timezone || 'UTC',
  deviceCoveragePct: 0,
  missingData: unique([
    'device_absent',
    'heart_rate',
    'movement_primitives',
    ...(input.evaluation?.missingContext || []),
  ]),
  sourceCoverage: sourceCoverageFromPayloads(payloads),
});

const buildDeviceAbsentProvenance = (
  input: BuildPhaseJDeviceAbsentCandidateInput,
  payloads: PhaseJSelfReportSourcePayload[],
): PhaseJRecordProvenance => {
  const now = Math.round(input.now || nowSeconds());
  return {
    sourceFamily: 'pulsecheck_self_report',
    sourceType: 'phase_j_device_absent_self_report',
    sourceRecordIds: payloads.map((payload) => payload.id),
    adapter: 'phaseJDeviceOnboardingSelfReport',
    observedAt: Math.round(input.detectedStartAt),
    ingestedAt: now,
    confidenceHints: unique([
      `confidence_cap:${input.evaluation?.selfReportConfidenceCap || selfReportConfidenceCapFor(input.context).cap}`,
      ...(input.context?.sportId ? [`sport:${input.context.sportId}`] : []),
      ...(input.context?.position ? [`position:${input.context.position}`] : []),
      ...(input.context?.scheduleEventId ? [`schedule_event:${input.context.scheduleEventId}`] : []),
      ...(input.context?.prescribedSessionId ? [`prescribed_session:${input.context.prescribedSessionId}`] : []),
    ]),
    qualityFlags: unique([
      'device_absent',
      'self_report_capped',
      ...(input.evaluation?.missingContext || []),
    ]),
  };
};

export const buildPhaseJDeviceAbsentCandidateInput = (
  input: BuildPhaseJDeviceAbsentCandidateInput,
): PhaseJDeviceAbsentCandidateBuildResult => {
  const athleteUserId = requireString(input.athleteUserId, 'athleteUserId');
  const now = Math.round(input.now || nowSeconds());
  const context = input.context || input.evaluation?.preSeededContext;
  const payloads = input.selfReportPayloads || [];
  const primitiveSnapshot = buildDeviceAbsentPrimitiveSnapshot({ ...input, context }, payloads);
  const provenance = buildDeviceAbsentProvenance({ ...input, context }, payloads);
  const selfReportCap = input.evaluation?.selfReportConfidenceCap || selfReportConfidenceCapFor(context).cap;
  const candidateKinds = unique([
    ...(input.candidateKinds || []),
    ...(context?.scheduleSessionType ? [context.scheduleSessionType] : []),
    'unknown' as PhaseJSessionType,
  ]);
  const confidenceScore = selfReportCap === 'usable' ? 0.62 : 0.42;

  return {
    primitiveSnapshot,
    provenance,
    candidate: stripUndefinedDeep({
      id: requireString(input.id, 'id'),
      athleteUserId,
      teamId: input.teamId || context?.teamId,
      sportId: input.sportId || context?.sportId,
      candidateKinds,
      status: 'needs_clarification',
      confidenceTier: selfReportCap,
      confidenceScore,
      detectedStartAt: primitiveSnapshot.detectedStartAt,
      detectedEndAt: primitiveSnapshot.detectedEndAt,
      timezone: primitiveSnapshot.timezone,
      primitiveSnapshot,
      missingContext: unique([
        ...primitiveSnapshot.missingData,
        'device_absent_confirmation',
        ...(context?.coachActor || context?.scheduleEventId ? [] : ['coach_or_schedule_context']),
      ]),
      evidenceRefs: payloads.map((payload) => payload.id),
      scheduleEventId: context?.scheduleEventId,
      prescribedSessionId: context?.prescribedSessionId,
      confirmationEventIds: [],
      provenance,
      contractVersion: PHASE_J_SESSION_CONTRACT_VERSION,
      createdAt: now,
      updatedAt: now,
      expiresAt: input.expiresAt,
    }),
  };
};

export const phaseJDeviceOnboardingSelfReport = {
  evaluate: evaluatePhaseJDeviceOnboarding,
  listEligibleDevices: listPhaseJOnboardingEligibleDevices,
  deriveSelfReportPayload: derivePhaseJSelfReportPayload,
  buildSelfReportSourcePayloads: buildPhaseJSelfReportSourcePayloads,
  buildDeviceAbsentCandidateInput: buildPhaseJDeviceAbsentCandidateInput,
};
