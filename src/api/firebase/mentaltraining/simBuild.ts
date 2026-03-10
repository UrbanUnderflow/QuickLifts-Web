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
    case 'The Kill Switch':
      return 'kill_switch';
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
      return 'kill_switch';
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
  const minutes = record.moduleDraft?.durationMinutes ?? getRuntimeConfigValue(record, 'session.durationMinutes', 5);
  const lockedDuration = (record.lockedSpec as SimVariantLockedSpec | undefined)?.fixedDuration;
  return {
    durationMinutes: minutes,
    durationSeconds: minutes * 60,
    feedbackMode: getRuntimeConfigValue(record, 'session.feedbackMode', 'coached'),
    adaptiveDifficulty: getRuntimeConfigValue(record, 'session.adaptiveDifficulty', true),
    targetSessionStructure: record.lockedSpec?.targetSessionStructure ?? getRuntimeConfigValue(record, 'session.targetSessionStructure', `${Math.max(12, minutes * 10)} rounds`),
    archetype,
    engineKey,
    lockedDuration: lockedDuration ?? null,
  };
}

function buildStimulusModel(record: SimVariantRecord, engineKey: SimEngineKey) {
  const emphasis = getRuntimeConfigValue<string[]>(record, 'stimuli.emphasis', []);
  const priority = record.priority === 'high' ? 'high' : record.priority === 'medium' ? 'medium' : 'low';
  const defaults: Record<SimEngineKey, Record<string, any>> = {
    kill_switch: {
      primaryTask: 'reset_to_same_task',
      disruptionChannels: ['visual', 'audio', 'cognitive'],
      resetCue: 're-engage immediately',
    },
    noise_gate: {
      primaryTask: 'maintain_live_target',
      distractorChannels: ['visual', 'audio'],
      overlapProfile: emphasis,
    },
    brake_point: {
      primaryTask: 'go_no_go',
      stopSignalProfile: 'fixed_distribution',
      lureTypes: ['obvious', 'fakeout', 'late-reveal'],
    },
    signal_window: {
      primaryTask: 'cue_discrimination',
      cueWindowProfile: 'shrinking_or_fixed_window',
      decoyProfile: ['plausible_wrong', 'neutral_miss'],
    },
    sequence_shift: {
      primaryTask: 'rule_update',
      shiftProfile: 'scheduled_rule_changes',
      intrusionProfile: ['old_rule', 'novel_error'],
    },
    endurance_lock: {
      primaryTask: 'sustained_execution',
      blockProfile: 'baseline_mid_final',
      fatigueProfile: emphasis,
    },
  };

  return {
    priority,
    emphasis,
    ...defaults[engineKey],
  };
}

function buildScoringModel(record: SimVariantRecord, engineKey: SimEngineKey) {
  const scoringByEngine: Record<SimEngineKey, Record<string, any>> = {
    kill_switch: {
      coreMetricName: 'recovery_time',
      supportingMetrics: ['first_post_reset_accuracy', 'false_start_count', 'pressure_stability'],
    },
    noise_gate: {
      coreMetricName: 'distractor_cost',
      supportingMetrics: ['rt_shift', 'false_alarm_rate', 'channel_vulnerability'],
    },
    brake_point: {
      coreMetricName: 'stop_latency',
      supportingMetrics: ['false_alarm_rate', 'over_inhibition', 'go_rt_balance'],
    },
    signal_window: {
      coreMetricName: 'correct_read_under_time_pressure',
      supportingMetrics: ['decision_latency', 'decoy_susceptibility', 'window_utilization'],
    },
    sequence_shift: {
      coreMetricName: 'update_accuracy_after_rule_change',
      supportingMetrics: ['switch_cost', 'old_rule_intrusion_rate', 'post_shift_accuracy'],
    },
    endurance_lock: {
      coreMetricName: 'degradation_slope',
      supportingMetrics: ['baseline_performance', 'degradation_onset', 'final_phase_challenge'],
    },
  };

  return {
    ...scoringByEngine[engineKey],
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
  const archetype = record.archetypeOverride ?? 'baseline';
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
    publishedModuleId: builtRecord.moduleDraft?.moduleId ?? builtRecord.publishedModuleId,
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
