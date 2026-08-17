import {
  ExerciseCategory,
  ExerciseDifficulty,
  type MentalExercise,
  type SimBuildArtifact,
  type SimBuildStatus,
  type SimEngineKey,
  type SimSyncStatus,
} from './types';
import { getDisplayFamilyName, getDisplaySimText, getDisplayVariantName } from './displayNames';
import type {
  SimVariantArchetype,
  SimVariantLockedSpec,
  SimVariantModuleDraft,
  SimVariantRecord,
} from './variantRegistryService';

const ENGINE_VERSION = 'registry-runtime/v1';

export interface SimVariantPublishedSnapshot {
  specRaw: string;
  runtimeConfig: Record<string, any> | null;
  moduleDraft: SimVariantModuleDraft | null;
  sourceFingerprint: string;
  publishedAt: number;
}

export interface SimVariantBuildMeta {
  builtAt?: number;
  builtFromHistoryId?: string | null;
  engineVersion: string;
  warnings: string[];
  lastError?: string | null;
}

export function stableStringify(value: any): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }
  const keys = Object.keys(value).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
}

function hashString(input: string) {
  let hash = 5381;
  for (let index = 0; index < input.length; index += 1) {
    hash = ((hash << 5) + hash) ^ input.charCodeAt(index);
  }
  return `fp_${(hash >>> 0).toString(16)}`;
}

export function inferEngineKey(record: Pick<SimVariantRecord, 'family'>): SimEngineKey {
  switch (record.family) {
    case 'Reset':
      return 'reset';
    case 'Noise Gate':
      return 'noise_gate';
    case 'Brake Point':
      return 'brake_point';
    case 'Signal Window':
      return 'signal_window';
    case 'Sequence Shift':
      return 'sequence_shift';
    case 'Endurance Lock':
      return 'endurance_lock';
    default:
      return 'reset';
  }
}

export function buildVariantSourceFingerprint(record: Pick<SimVariantRecord, 'specRaw' | 'lockedSpec' | 'runtimeConfig' | 'moduleDraft' | 'family' | 'name' | 'mode'>) {
  return hashString(stableStringify({
    family: record.family,
    name: record.name,
    mode: record.mode,
    specRaw: record.specRaw || '',
    lockedSpec: record.lockedSpec || null,
    runtimeConfig: record.runtimeConfig || null,
    moduleDraft: record.moduleDraft || null,
  }));
}

export function buildPublishedSnapshot(record: SimVariantRecord): SimVariantPublishedSnapshot {
  return {
    specRaw: record.specRaw || '',
    runtimeConfig: record.runtimeConfig || null,
    moduleDraft: record.moduleDraft || null,
    sourceFingerprint: buildVariantSourceFingerprint(record),
    publishedAt: Date.now(),
  };
}

function valuesEqual(left: any, right: any) {
  return stableStringify(left) === stableStringify(right);
}

export function determineSyncStatus(record: Pick<SimVariantRecord, 'publishedModuleId' | 'publishedSnapshot' | 'specRaw' | 'runtimeConfig' | 'moduleDraft'> & { sourceFingerprint?: string; lastPublishedFingerprint?: string }): SimSyncStatus {
  if (!record.publishedModuleId || !record.publishedSnapshot) {
    return 'in_sync';
  }
  const nextFingerprint = record.sourceFingerprint ?? buildVariantSourceFingerprint(record as SimVariantRecord);
  if (record.lastPublishedFingerprint && record.lastPublishedFingerprint === nextFingerprint) {
    return 'in_sync';
  }
  if (!valuesEqual(record.specRaw || '', record.publishedSnapshot.specRaw || '')) {
    return 'spec_changed';
  }
  if (!valuesEqual(record.runtimeConfig || null, record.publishedSnapshot.runtimeConfig || null)) {
    return 'config_changed';
  }
  if (!valuesEqual(record.moduleDraft || null, record.publishedSnapshot.moduleDraft || null)) {
    return 'module_changed';
  }
  return 'build_stale';
}

export function determineBuildStatus(record: Pick<SimVariantRecord, 'publishedModuleId' | 'buildArtifact' | 'syncStatus' | 'buildMeta'>): SimBuildStatus {
  if (record.buildMeta?.lastError) return 'build_error';
  if (record.publishedModuleId && record.syncStatus && record.syncStatus !== 'in_sync') return 'out_of_sync';
  if (record.publishedModuleId && record.buildArtifact) return 'published';
  if (record.buildArtifact) return 'built';
  return 'not_built';
}

function getRuntimeConfigValue<T = any>(record: SimVariantRecord, path: string, fallback: T): T {
  const parts = path.split('.');
  let current: any = record.runtimeConfig ?? {};
  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = current[part];
    } else {
      return fallback;
    }
  }
  return (current as T) ?? fallback;
}

function buildSessionModel(record: SimVariantRecord, engineKey: SimEngineKey, archetype: SimVariantArchetype) {
  const runtimeSession = getRuntimeConfigValue<Record<string, any>>(record, 'session', {});
  const minutes = record.moduleDraft?.durationMinutes ?? getRuntimeConfigValue(record, 'session.durationMinutes', 5);
  const lockedDuration = (record.lockedSpec as SimVariantLockedSpec | undefined)?.fixedDuration;
  return {
    ...runtimeSession,
    durationMinutes: minutes,
    durationSeconds: minutes * 60,
    feedbackMode: getRuntimeConfigValue(record, 'session.feedbackMode', 'coached'),
    adaptiveDifficulty: false,
    targetSessionStructure: record.lockedSpec?.targetSessionStructure ?? getRuntimeConfigValue(record, 'session.targetSessionStructure', `${Math.max(12, minutes * 10)} rounds`),
    archetype,
    engineKey,
    lockedDuration: lockedDuration ?? null,
  };
}

function buildStimulusModel(record: SimVariantRecord, engineKey: SimEngineKey) {
  const runtimeStimuli = getRuntimeConfigValue<Record<string, any>>(record, 'stimuli', {});
  const emphasis = getRuntimeConfigValue<string[]>(record, 'stimuli.emphasis', []);
  const variantType = typeof runtimeStimuli.variantType === 'string' ? runtimeStimuli.variantType : undefined;
  const priority = record.priority === 'high' ? 'high' : record.priority === 'medium' ? 'medium' : 'low';
  const archetype = record.archetypeOverride ?? record.runtimeConfig?.archetype ?? 'baseline';
  const defaults: Record<SimEngineKey, Record<string, any>> = {
    reset: {
      primaryTask: 'matched_left_right_arrow_classification',
      conditions: ['reference', 'post_disruption'],
      disruptionChannels: ['visual', 'audio'],
      resetIntervalMs: 800,
    },
    noise_gate: {
      primaryTask: 'visible_number_match_visual_search',
      conditions: ['reference', 'visual_distraction', 'audio_distraction'],
      distractorChannels: ['visual', 'audio'],
      overlapProfile: emphasis,
    },
    brake_point: {
      primaryTask: 'two_choice_stop_signal',
      goToStopRatio: '3:1',
      stopSignalProfile: 'adaptive_50_ms_staircase',
      stopSignalDelayRangeMs: [100, 700],
    },
    signal_window: {
      primaryTask: 'nine_arrow_majority_discrimination',
      evidenceCounts: [5, 6, 7],
      protocolVersion: '3.1',
      practiceStimulusExposureMs: 2000,
      practiceResponseWindowMs: 4000,
      stimulusExposureMs: 1400,
      responseWindowMs: 3000,
      latencyOrigin: 'stimulus_onset',
    },
    sequence_shift: {
      primaryTask: 'cued_letter_number_task_switching',
      cueStimulusIntervalMs: 400,
      responseWindowMs: 1800,
      conditions: ['repeat_congruent', 'repeat_incongruent', 'switch_congruent', 'switch_incongruent'],
    },
    endurance_lock: {
      primaryTask: 'constant_visual_signal_detection',
      blockCount: 6,
      foreperiodRangeMs: [1500, 3500],
      responseWindowMs: 1500,
      cueChannel: 'visual_only',
    },
  };

  return {
    ...defaults[engineKey],
    ...(variantType ? { variantType } : {}),
    priority,
    emphasis,
    audioAssets: getRuntimeConfigValue<Record<string, any>>(record, 'audioAssets', {}),
  };
}

function buildScoringModel(record: SimVariantRecord, engineKey: SimEngineKey) {
  const runtimeScoring = getRuntimeConfigValue<Record<string, any>>(record, 'scoring', {});
  const scoringByEngine: Record<SimEngineKey, Record<string, any>> = {
    reset: {
      coreMetricName: 'post_disruption_reengagement_cost_ms',
      supportingMetrics: [
        'matched_pair_count',
        'reference_accuracy',
        'post_disruption_accuracy',
        'post_disruption_accuracy_cost',
        'first_post_disruption_correct_rate',
        'premature_response_rate',
        'timeout_rate',
        'mean_reset_interval_ms',
      ],
    },
    noise_gate: {
      coreMetricName: 'distractor_cost',
      supportingMetrics: [
        'correct_response_rt_shift',
        'wrong_tap_rate',
        'highlighted_distractor_tap_rate',
        'timeout_rate',
        'reference_accuracy',
        'distraction_accuracy',
        'scored_reference_rounds',
        'scored_distraction_rounds',
      ],
    },
    brake_point: {
      coreMetricName: 'stop_success_rate',
      supportingMetrics: ['provisional_ssrt_ms', 'ssrt_estimate_available', 'go_accuracy', 'correct_go_rt_ms', 'go_omission_rate', 'go_choice_error_rate', 'mean_stop_signal_delay_ms', 'failed_stop_rt_ms', 'race_model_check_passed', 'premature_response_rate', 'valid_go_trials', 'valid_stop_trials'],
    },
    signal_window: {
      coreMetricName: 'decision_accuracy',
      supportingMetrics: ['correct_decision_rt_ms', 'wrong_choice_rate', 'timeout_rate', 'premature_response_rate', 'accuracy_by_evidence', 'correct_rt_by_evidence_ms', 'scored_trial_count'],
    },
    sequence_shift: {
      coreMetricName: 'switch_rt_cost_ms',
      supportingMetrics: ['switch_rt_available', 'switch_accuracy_cost', 'repeat_accuracy', 'switch_accuracy', 'perseverative_error_rate', 'timeout_rate', 'premature_response_rate', 'valid_repeat_rt_count', 'valid_switch_rt_count'],
    },
    endurance_lock: {
      coreMetricName: 'correct_rt_slope_ms_per_min',
      supportingMetrics: ['slope_estimate_available', 'median_correct_rt_ms', 'rt_variability_ms', 'lapse_rate', 'false_start_rate', 'timeout_rate', 'valid_response_count', 'block_valid_trial_counts'],
    },
  };

  const canonical = scoringByEngine[engineKey];
  const additionalSupportingMetrics = Array.isArray(runtimeScoring.supportingMetrics)
    ? runtimeScoring.supportingMetrics.filter((metric: unknown): metric is string => typeof metric === 'string' && metric.trim().length > 0)
    : [];

  return {
    ...runtimeScoring,
    ...canonical,
    supportingMetrics: Array.from(new Set([
      ...canonical.supportingMetrics,
      ...additionalSupportingMetrics,
    ])),
    artifactFloorMs: 150,
    lockedRuleSet: record.lockedSpec ?? null,
  };
}

function buildFeedbackModel(record: SimVariantRecord, engineKey: SimEngineKey) {
  const category = record.moduleDraft?.category ?? ExerciseCategory.Focus;
  const difficulty = record.moduleDraft?.difficulty ?? ExerciseDifficulty.Intermediate;
  return {
    category,
    difficulty,
    feedbackMode: getRuntimeConfigValue(record, 'session.feedbackMode', 'coached'),
    tone: engineKey === 'endurance_lock' ? 'trend' : engineKey === 'signal_window' ? 'decision' : 'performance',
    athleteLabels: {
      title: getDisplayVariantName(record.moduleDraft?.name ?? record.name),
      description: getDisplaySimText(record.moduleDraft?.description ?? record.specRaw?.slice(0, 140) ?? ''),
    },
  };
}

function buildAnalyticsModel(record: SimVariantRecord, engineKey: SimEngineKey) {
  return {
    engineKey,
    focus: getRuntimeConfigValue<string[]>(record, 'analytics.focus', []),
    tags: getRuntimeConfigValue<string[]>(record, 'analytics.tags', []),
    telemetryVersion: ENGINE_VERSION,
  };
}

function buildUiModel(record: SimVariantRecord, engineKey: SimEngineKey) {
  return {
    iconName: record.moduleDraft?.iconName ?? 'brain',
    introTitle: getDisplayVariantName(record.moduleDraft?.name ?? record.name),
    introDescription: getDisplaySimText(record.moduleDraft?.description ?? ''),
    summaryStyle: engineKey === 'endurance_lock' ? 'blocks' : engineKey === 'noise_gate' ? 'channel_breakdown' : 'scorecard',
  };
}

export function compileVariantBuildArtifact(record: SimVariantRecord): SimBuildArtifact {
  const engineKey = record.engineKey ?? inferEngineKey(record);
  const archetype = record.archetypeOverride ?? record.runtimeConfig?.archetype ?? 'baseline';
  const sourceFingerprint = buildVariantSourceFingerprint(record);

  return {
    engineKey,
    engineVersion: ENGINE_VERSION,
    family: getDisplayFamilyName(record.family),
    variantId: record.id,
    variantName: getDisplayVariantName(record.name),
    moduleId: record.moduleDraft?.moduleId ?? record.id,
    sessionModel: buildSessionModel(record, engineKey, archetype),
    stimulusModel: buildStimulusModel(record, engineKey),
    scoringModel: buildScoringModel(record, engineKey),
    feedbackModel: buildFeedbackModel(record, engineKey),
    analyticsModel: buildAnalyticsModel(record, engineKey),
    uiModel: buildUiModel(record, engineKey),
    safeguards: [
      'Registry variant is the canonical authoring source.',
      'Published module is derived output and may be marked out_of_sync.',
      ...(record.runtimeConfig?.safeguards ?? []),
    ],
    sourceFingerprint,
  };
}

export function buildVariantRecordForBuild(record: SimVariantRecord, buildArtifact?: SimBuildArtifact): SimVariantRecord {
  const artifact = buildArtifact ?? compileVariantBuildArtifact(record);
  const sourceFingerprint = artifact.sourceFingerprint;
  const lastPublishedFingerprint = record.lastPublishedFingerprint ?? record.publishedSnapshot?.sourceFingerprint;
  const nextRecord: SimVariantRecord = {
    ...record,
    engineKey: artifact.engineKey,
    sourceFingerprint,
    buildArtifact: artifact,
    lastBuiltFingerprint: sourceFingerprint,
    buildMeta: {
      engineVersion: artifact.engineVersion,
      builtAt: Date.now(),
      builtFromHistoryId: null,
      warnings: [],
      lastError: null,
    },
  };

  nextRecord.syncStatus = determineSyncStatus({
    ...nextRecord,
    lastPublishedFingerprint,
  });
  nextRecord.buildStatus = determineBuildStatus(nextRecord);
  return nextRecord;
}

export function applyDraftSyncState(record: SimVariantRecord): SimVariantRecord {
  const sourceFingerprint = buildVariantSourceFingerprint(record);
  const nextRecord: SimVariantRecord = {
    ...record,
    engineKey: record.engineKey ?? inferEngineKey(record),
    sourceFingerprint,
  };
  nextRecord.syncStatus = determineSyncStatus(nextRecord);
  nextRecord.buildStatus = determineBuildStatus(nextRecord);
  return nextRecord;
}

export function buildPublishedModuleFromVariant(record: SimVariantRecord, module: MentalExercise): MentalExercise {
  const buildArtifact = record.buildArtifact ?? compileVariantBuildArtifact(record);
  return {
    ...module,
    engineKey: buildArtifact.engineKey,
    name: getDisplayVariantName(module.name),
    description: getDisplaySimText(module.description),
    buildArtifact,
    syncStatus: 'in_sync',
    publishedFingerprint: buildArtifact.sourceFingerprint,
  };
}

export function buildPublishedVariantRecord(record: SimVariantRecord, publishedAt: number = Date.now()): SimVariantRecord {
  const builtRecord = buildVariantRecordForBuild(record);
  const publishedSnapshot = buildPublishedSnapshot(builtRecord);
  const nextRecord: SimVariantRecord = {
    ...builtRecord,
    publishedAt,
    publishedModuleId: builtRecord.publishedModuleId ?? builtRecord.moduleDraft?.moduleId,
    specStatus: builtRecord.specStatus === 'not-required' ? 'not-required' : 'complete',
    publishedSnapshot,
    lastPublishedFingerprint: builtRecord.sourceFingerprint,
    syncStatus: 'in_sync',
    buildStatus: 'published',
    updatedAt: publishedAt,
  };

  return nextRecord;
}

export function summarizeVariantSyncDiff(record: SimVariantRecord) {
  const publishedSnapshot = record.publishedSnapshot;
  if (!record.publishedModuleId || !publishedSnapshot) {
    return {
      hasPublishedSnapshot: false,
      specChanged: false,
      runtimeChanged: false,
      moduleChanged: false,
    };
  }

  return {
    hasPublishedSnapshot: true,
    specChanged: !valuesEqual(record.specRaw || '', publishedSnapshot.specRaw || ''),
    runtimeChanged: !valuesEqual(record.runtimeConfig || null, publishedSnapshot.runtimeConfig || null),
    moduleChanged: !valuesEqual(record.moduleDraft || null, publishedSnapshot.moduleDraft || null),
  };
}
