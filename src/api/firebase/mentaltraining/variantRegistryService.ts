import { db } from '../config';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  writeBatch,
} from 'firebase/firestore';
import {
  MentalExercise,
  type SimBuildArtifact,
  type SimBuildStatus,
  type SimEngineKey,
  type SimSyncStatus,
  exerciseToFirestore,
} from './types';
import {
  SIM_MODULES_COLLECTION,
  SIM_VARIANTS_COLLECTION,
} from './collections';
import type { SimVariantBuildMeta, SimVariantPublishedSnapshot } from './simBuild';
import { applyDraftSyncState, buildPublishedVariantRecord, buildPublishedModuleFromVariant } from './simBuild';

const VISION_RUNTIME_PACKAGES_COLLECTION = 'vision-runtime-packages';

export type SimVariantSpecStatus = 'needs-spec' | 'in-progress' | 'complete' | 'not-required';
export type SimVariantFamilyStatus = 'locked' | 'candidate';
export type SimVariantMode = 'branch' | 'library' | 'hybrid';
export type SimVariantArchetype =
  | 'baseline'
  | 'trial'
  | 'short_daily'
  | 'visual_channel'
  | 'audio_channel'
  | 'combined_channel'
  | 'cognitive_pressure'
  | 'sport_context'
  | 'immersive'
  | 'fatigue_load'
  | 'decoy_discrimination';

export type SimVariantVisionStatus =
  | 'spec_only'
  | 'runtime_mapped'
  | 'in_package'
  | 'validated';

export interface VisionRuntimePackageVariantManifest {
  variantId: string;
  variantName: string;
  family: string;
  mode: SimVariantMode;
  archetype: SimVariantArchetype;
  specStatus: SimVariantSpecStatus;
  buildStatus: SimBuildStatus | null;
  engineKey: SimEngineKey | null;
  visionPackageStatus: SimVariantVisionStatus;
  surface: string | null;
  trialName: string;
  trialVersion: string;
  runtimeConfig: Record<string, any> | null;
}

export interface VisionRuntimeResetBlockManifest {
  pressureTags: string[];
  disruptionLabel: string;
  lockInSeconds: number;
  disruptionSeconds: number;
  responseWindowSeconds: number;
  interBlockGapSeconds: number;
}

export interface VisionRuntimeSignalBlockManifest {
  correctChoice: string;
  decoyChoice: string;
  pressureTags: string[];
  cueWindowSeconds: number;
  readySeconds: number;
  responseWindowSeconds: number;
  interBlockGapSeconds: number;
}

export interface VisionRuntimeNoiseGateBlockManifest {
  targetChoice: string;
  distractorChoice: string;
  noiseLabel: string;
  noiseIntensity: number;
  pressureTags: string[];
  readySeconds: number;
  exposureSeconds: number;
  responseWindowSeconds: number;
  interBlockGapSeconds: number;
}

export interface VisionRuntimeTrialPlanManifest {
  controlledBreakSeconds: number;
  totalSessionCapSeconds: number;
  resetBlocks: VisionRuntimeResetBlockManifest[];
  signalWindowBlocks: VisionRuntimeSignalBlockManifest[];
  noiseGateBlocks: VisionRuntimeNoiseGateBlockManifest[];
}

export interface VisionRuntimePackageManifest {
  packageId: string;
  packageName: string;
  surface: string;
  packageStatus: SimVariantVisionStatus;
  generatedAt: number;
  environmentVersion: string;
  trialPackageVersion: string;
  eventScriptVersion: string;
  metricMappingVersion: string;
  seedOrScriptId: string;
  variantCount: number;
  supportedFamilies: string[];
  runtimePlan: VisionRuntimeTrialPlanManifest | null;
  variants: VisionRuntimePackageVariantManifest[];
}

export interface VisionRuntimePackageRecord extends VisionRuntimePackageManifest {
  includedVariantIds: string[];
  validationNotes?: string;
  createdAt: number;
  updatedAt: number;
  publishedAt?: number;
}

function normalizeVisionRuntimePlan(
  plan?: Partial<VisionRuntimeTrialPlanManifest> | null
): VisionRuntimeTrialPlanManifest | null {
  if (!plan) return null;

  return {
    controlledBreakSeconds: typeof plan.controlledBreakSeconds === 'number' ? plan.controlledBreakSeconds : 60,
    totalSessionCapSeconds: typeof plan.totalSessionCapSeconds === 'number' ? plan.totalSessionCapSeconds : 20 * 60,
    resetBlocks: Array.isArray(plan.resetBlocks) ? plan.resetBlocks : [],
    signalWindowBlocks: Array.isArray(plan.signalWindowBlocks) ? plan.signalWindowBlocks : [],
    noiseGateBlocks: Array.isArray(plan.noiseGateBlocks) ? plan.noiseGateBlocks : [],
  };
}

export interface SimVariantSeed {
  name: string;
  family: string;
  familyStatus: SimVariantFamilyStatus;
  mode: SimVariantMode;
  specStatus: SimVariantSpecStatus;
  priority: 'high' | 'medium' | 'low';
}

export interface SimVariantModuleDraft {
  moduleId: string;
  name: string;
  description: string;
  category: MentalExercise['category'];
  difficulty: MentalExercise['difficulty'];
  durationMinutes: number;
  benefits: string[];
  bestFor: string[];
  origin: string;
  neuroscience: string;
  overview: MentalExercise['overview'];
  iconName: string;
  isActive: boolean;
  sortOrder: number;
}

export interface SimVariantLockedSpec {
  fixedTier: string;
  fixedDuration: string;
  targetSessionStructure: string;
  buildVersionPolicy: string;
  seedPolicy: string;
  modifierProfile: string;
  environmentRequirements: string;
  fixedProfileDetails: string;
  validResponseRule: string;
  artifactFloorRule: string;
  maxWindowRule: string;
  failedRoundRule: string;
  falseStartRule: string;
  validSessionRule: string;
  partialSessionRule: string;
  invalidSessionRule: string;
  dropoutRule: string;
  retryRule: string;
  transferMetricDefinition: string;
  transferMetricReporting: string;
  validationStage: string;
  nextValidationMilestone: string;
  motorBaselineRule: string;
  deviceCovariateRule: string;
  exportRequirements: string;
}

export interface SimVariantRecord extends SimVariantSeed {
  id: string;
  specRaw?: string;
  archetypeOverride?: SimVariantArchetype;
  visionPackageStatus?: SimVariantVisionStatus;
  visionPackageId?: string;
  visionSurface?: string;
  visionRuntimePlan?: VisionRuntimeTrialPlanManifest;
  visionValidationNotes?: string;
  visionPublishedAt?: number;
  lockedSpec?: SimVariantLockedSpec;
  engineKey?: SimEngineKey;
  buildStatus?: SimBuildStatus;
  syncStatus?: SimSyncStatus;
  sourceFingerprint?: string;
  lastBuiltFingerprint?: string;
  lastPublishedFingerprint?: string;
  buildArtifact?: SimBuildArtifact;
  buildMeta?: SimVariantBuildMeta;
  publishedSnapshot?: SimVariantPublishedSnapshot;
  runtimeConfig?: Record<string, any>;
  moduleDraft?: SimVariantModuleDraft;
  publishedModuleId?: string;
  publishedAt?: number;
  createdAt: number;
  updatedAt: number;
}

export type SimVariantHistoryAction = 'created' | 'saved' | 'published' | 'seeded' | 'seed_synced' | 'vision_promoted';

export interface SimVariantHistoryEntry {
  id: string;
  variantId: string;
  action: SimVariantHistoryAction;
  summary: string;
  createdAt: number;
  moduleId?: string;
  snapshot: SimVariantRecord;
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function isVisionVariant(record: Pick<SimVariantRecord, 'name' | 'archetypeOverride'>) {
  if (record.archetypeOverride === 'immersive') return true;
  const name = record.name.trim().toLowerCase();
  return (
    name.includes('immersive') ||
    name.includes('vision pro') ||
    name.includes('chamber') ||
    name.includes('tunnel') ||
    name.includes('spatial')
  );
}

function resolveVisionArchetype(record: Pick<SimVariantRecord, 'name' | 'archetypeOverride'>): SimVariantArchetype {
  if (record.archetypeOverride) return record.archetypeOverride;
  return isVisionVariant(record) ? 'immersive' : 'baseline';
}

function normalizeFamilySlug(family: string) {
  return slugify(family);
}

function buildDefaultVisionPackageName(packageId: string) {
  if (packageId === 'vision_pro_football_package') {
    return 'Vision Pro Football Package';
  }

  return packageId
    .split(/[-_]+/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function buildDefaultVisionPackageMetadata(packageId: string) {
  if (packageId === 'vision_pro_football_package') {
    return {
      packageName: 'Vision Pro Football Package',
      surface: 'football_stadium',
      environmentVersion: 'football-stadium-v1',
      trialPackageVersion: 'vision-pro-football-package-v1',
      eventScriptVersion: 'vision-pro-football-event-script-v1',
      metricMappingVersion: 'vision-pro-football-metric-map-v1',
      seedOrScriptId: 'football-package-seed-v1',
    };
  }

  const slug = slugify(packageId || 'vision-package');
  return {
    packageName: buildDefaultVisionPackageName(packageId),
    surface: 'immersive',
    environmentVersion: `${slug}-environment-v1`,
    trialPackageVersion: `${slug}-package-v1`,
    eventScriptVersion: `${slug}-event-script-v1`,
    metricMappingVersion: `${slug}-metric-map-v1`,
    seedOrScriptId: `${slug}-seed-v1`,
  };
}

export function buildDefaultVisionRuntimePlan(packageId: string): VisionRuntimeTrialPlanManifest | null {
  if (packageId !== 'vision_pro_football_package') {
    return null;
  }

  return {
    controlledBreakSeconds: 60,
    totalSessionCapSeconds: 20 * 60,
    resetBlocks: [
      { pressureTags: ['pressure:crowd', 'immersive:scoreboard-shift'], disruptionLabel: 'Crowd surge after a bad rep', lockInSeconds: 4.5, disruptionSeconds: 1.2, responseWindowSeconds: 3.0, interBlockGapSeconds: 2.0 },
      { pressureTags: ['pressure:evaluative', 'immersive:peripheral-motion'], disruptionLabel: 'Evaluative pressure callout', lockInSeconds: 5.0, disruptionSeconds: 1.4, responseWindowSeconds: 3.0, interBlockGapSeconds: 2.0 },
      { pressureTags: ['pressure:consequence', 'immersive:scoreboard-shift'], disruptionLabel: 'Scoreboard consequence pulse', lockInSeconds: 4.0, disruptionSeconds: 1.4, responseWindowSeconds: 3.0, interBlockGapSeconds: 2.0 },
      { pressureTags: ['pressure:crowd', 'pressure:clutter'], disruptionLabel: 'Crowd plus clutter hit', lockInSeconds: 4.8, disruptionSeconds: 1.5, responseWindowSeconds: 3.0, interBlockGapSeconds: 2.0 },
      { pressureTags: ['pressure:evaluative', 'pressure:consequence'], disruptionLabel: 'Coach and consequence spike', lockInSeconds: 4.3, disruptionSeconds: 1.3, responseWindowSeconds: 3.0, interBlockGapSeconds: 2.0 },
      { pressureTags: ['pressure:crowd', 'immersive:spatial-audio'], disruptionLabel: 'Directional noise swell', lockInSeconds: 4.6, disruptionSeconds: 1.2, responseWindowSeconds: 3.0, interBlockGapSeconds: 2.0 },
      { pressureTags: ['pressure:clutter', 'immersive:peripheral-motion'], disruptionLabel: 'Peripheral distraction surge', lockInSeconds: 4.9, disruptionSeconds: 1.5, responseWindowSeconds: 3.0, interBlockGapSeconds: 2.0 },
      { pressureTags: ['pressure:consequence', 'pressure:time'], disruptionLabel: 'Urgency overlay spike', lockInSeconds: 4.2, disruptionSeconds: 1.4, responseWindowSeconds: 3.0, interBlockGapSeconds: 2.0 },
    ],
    signalWindowBlocks: [
      { correctChoice: 'left', decoyChoice: 'right', pressureTags: ['pressure:time', 'immersive:depth-separated-cues'], cueWindowSeconds: 1.2, readySeconds: 2.0, responseWindowSeconds: 2.0, interBlockGapSeconds: 2.0 },
      { correctChoice: 'center', decoyChoice: 'left', pressureTags: ['pressure:clutter', 'immersive:peripheral-motion'], cueWindowSeconds: 1.2, readySeconds: 2.0, responseWindowSeconds: 2.0, interBlockGapSeconds: 2.0 },
      { correctChoice: 'right', decoyChoice: 'center', pressureTags: ['pressure:ambiguity', 'immersive:spatial-audio'], cueWindowSeconds: 1.2, readySeconds: 2.0, responseWindowSeconds: 2.0, interBlockGapSeconds: 2.0 },
      { correctChoice: 'left', decoyChoice: 'center', pressureTags: ['pressure:time', 'pressure:clutter'], cueWindowSeconds: 1.1, readySeconds: 2.0, responseWindowSeconds: 2.0, interBlockGapSeconds: 2.0 },
      { correctChoice: 'center', decoyChoice: 'right', pressureTags: ['pressure:ambiguity', 'immersive:depth-separated-cues'], cueWindowSeconds: 1.1, readySeconds: 2.0, responseWindowSeconds: 2.0, interBlockGapSeconds: 2.0 },
      { correctChoice: 'right', decoyChoice: 'left', pressureTags: ['pressure:clutter', 'immersive:spatial-audio'], cueWindowSeconds: 1.0, readySeconds: 2.0, responseWindowSeconds: 2.0, interBlockGapSeconds: 2.0 },
      { correctChoice: 'left', decoyChoice: 'right', pressureTags: ['pressure:time', 'pressure:ambiguity'], cueWindowSeconds: 1.0, readySeconds: 2.0, responseWindowSeconds: 2.0, interBlockGapSeconds: 2.0 },
      { correctChoice: 'center', decoyChoice: 'left', pressureTags: ['pressure:clutter', 'immersive:depth-separated-cues'], cueWindowSeconds: 1.0, readySeconds: 2.0, responseWindowSeconds: 2.0, interBlockGapSeconds: 2.0 },
      { correctChoice: 'right', decoyChoice: 'center', pressureTags: ['pressure:time', 'immersive:peripheral-motion'], cueWindowSeconds: 1.1, readySeconds: 2.0, responseWindowSeconds: 2.0, interBlockGapSeconds: 2.0 },
      { correctChoice: 'left', decoyChoice: 'center', pressureTags: ['pressure:clutter', 'pressure:ambiguity'], cueWindowSeconds: 1.1, readySeconds: 2.0, responseWindowSeconds: 2.0, interBlockGapSeconds: 2.0 },
      { correctChoice: 'center', decoyChoice: 'right', pressureTags: ['pressure:time', 'immersive:spatial-audio'], cueWindowSeconds: 1.2, readySeconds: 2.0, responseWindowSeconds: 2.0, interBlockGapSeconds: 2.0 },
      { correctChoice: 'right', decoyChoice: 'left', pressureTags: ['pressure:ambiguity', 'immersive:depth-separated-cues'], cueWindowSeconds: 1.2, readySeconds: 2.0, responseWindowSeconds: 2.0, interBlockGapSeconds: 2.0 },
      { correctChoice: 'left', decoyChoice: 'right', pressureTags: ['pressure:time', 'pressure:clutter'], cueWindowSeconds: 1.0, readySeconds: 2.0, responseWindowSeconds: 2.0, interBlockGapSeconds: 2.0 },
      { correctChoice: 'center', decoyChoice: 'left', pressureTags: ['pressure:ambiguity', 'immersive:peripheral-motion'], cueWindowSeconds: 1.0, readySeconds: 2.0, responseWindowSeconds: 2.0, interBlockGapSeconds: 2.0 },
      { correctChoice: 'right', decoyChoice: 'center', pressureTags: ['pressure:time', 'immersive:spatial-audio'], cueWindowSeconds: 1.1, readySeconds: 2.0, responseWindowSeconds: 2.0, interBlockGapSeconds: 2.0 },
      { correctChoice: 'center', decoyChoice: 'right', pressureTags: ['pressure:clutter', 'pressure:ambiguity'], cueWindowSeconds: 1.0, readySeconds: 2.0, responseWindowSeconds: 2.0, interBlockGapSeconds: 2.0 },
    ],
    noiseGateBlocks: [],
  };
}

function buildDefaultVisionTrialName(record: Pick<SimVariantRecord, 'family' | 'name'>) {
  const family = normalizeFamilySlug(record.family);
  if (family === 'reset') return 'Next Play';
  if (family === 'signal-window') return 'Spatial Read';
  if (family === 'noise-gate') return 'Crowd Tunnel';
  if (family === 'brake-point') return 'Spatial Brake';
  return record.name.trim();
}

function buildDefaultVisionTrialVersion(record: Pick<SimVariantRecord, 'family' | 'name'>) {
  const family = normalizeFamilySlug(record.family);
  if (family === 'reset') return 'reset-next-play-v1';
  if (family === 'signal-window') return 'signal-window-v1';
  if (family === 'noise-gate') return 'crowd-tunnel-v1';
  if (family === 'brake-point') return 'spatial-brake-v1';
  return `${slugify(record.name)}-v1`;
}

function coerceVisionStatus(value?: SimVariantVisionStatus): SimVariantVisionStatus {
  return value ?? 'spec_only';
}

function aggregateVisionPackageStatus(variants: Array<Pick<SimVariantRecord, 'visionPackageStatus'>>) {
  const statuses = variants.map((variant) => coerceVisionStatus(variant.visionPackageStatus));
  if (!statuses.length) return 'spec_only' as const;
  if (statuses.every((status) => status === 'validated')) return 'validated' as const;
  if (statuses.every((status) => status === 'in_package' || status === 'validated')) return 'in_package' as const;
  if (statuses.some((status) => status === 'runtime_mapped' || status === 'in_package' || status === 'validated')) return 'runtime_mapped' as const;
  return 'spec_only' as const;
}

export function resolveDefaultVisionPackageId(record: Pick<SimVariantRecord, 'family' | 'name' | 'archetypeOverride'>) {
  const family = normalizeFamilySlug(record.family);
  const name = record.name.trim().toLowerCase();

  if (
    (family === 'reset' && name.includes('chamber')) ||
    (family === 'signal-window' && (name.includes('spatial read') || name.includes('vision pro')))
  ) {
    return 'vision_pro_football_package';
  }

  return `vision-${family}-${slugify(record.name)}`;
}

export interface VisionRuntimePackageManifestOverrides {
  packageName?: string | null;
  preferredSurface?: string | null;
  packageStatus?: SimVariantVisionStatus | null;
  authoredRuntimePlan?: VisionRuntimeTrialPlanManifest | null;
  environmentVersion?: string | null;
  trialPackageVersion?: string | null;
  eventScriptVersion?: string | null;
  metricMappingVersion?: string | null;
  seedOrScriptId?: string | null;
}

export function buildVisionRuntimePackageManifest(
  variants: SimVariantRecord[],
  packageId: string,
  overrides: VisionRuntimePackageManifestOverrides = {}
): VisionRuntimePackageManifest {
  const packageVariants = variants
    .filter((variant) => isVisionVariant(variant))
    .filter((variant) => (variant.visionPackageId || resolveDefaultVisionPackageId(variant)) === packageId)
    .sort((left, right) => {
      if (left.family !== right.family) return left.family.localeCompare(right.family);
      return left.name.localeCompare(right.name);
    });

  const metadata = buildDefaultVisionPackageMetadata(packageId);
  const surface = overrides.preferredSurface || packageVariants.find((variant) => variant.visionSurface)?.visionSurface || metadata.surface;
  const runtimePlan = normalizeVisionRuntimePlan(
    overrides.authoredRuntimePlan
      ?? packageVariants.find((variant) => variant.visionRuntimePlan)?.visionRuntimePlan
      ?? buildDefaultVisionRuntimePlan(packageId)
  );
  const manifestVariants: VisionRuntimePackageVariantManifest[] = packageVariants.map((variant) => ({
    variantId: variant.id,
    variantName: variant.name,
    family: variant.family,
    mode: variant.mode,
    archetype: resolveVisionArchetype(variant),
    specStatus: variant.specStatus,
    buildStatus: variant.buildStatus || null,
    engineKey: variant.engineKey || null,
    visionPackageStatus: coerceVisionStatus(variant.visionPackageStatus),
    surface: variant.visionSurface || surface || null,
    trialName: buildDefaultVisionTrialName(variant),
    trialVersion: buildDefaultVisionTrialVersion(variant),
    runtimeConfig: variant.runtimeConfig || null,
  }));

  return {
    packageId,
    packageName: overrides.packageName || metadata.packageName,
    surface,
    packageStatus: overrides.packageStatus || aggregateVisionPackageStatus(packageVariants),
    generatedAt: Date.now(),
    environmentVersion: overrides.environmentVersion || metadata.environmentVersion,
    trialPackageVersion: overrides.trialPackageVersion || metadata.trialPackageVersion,
    eventScriptVersion: overrides.eventScriptVersion || metadata.eventScriptVersion,
    metricMappingVersion: overrides.metricMappingVersion || metadata.metricMappingVersion,
    seedOrScriptId: overrides.seedOrScriptId || metadata.seedOrScriptId,
    variantCount: manifestVariants.length,
    supportedFamilies: Array.from(new Set(manifestVariants.map((variant) => variant.family))).filter(Boolean),
    runtimePlan,
    variants: manifestVariants,
  };
}

export function buildSimVariantId(seed: SimVariantSeed) {
  return `${slugify(seed.family)}-${seed.mode}-${slugify(seed.name)}`;
}

function visionPackageRecordFromFirestore(
  id: string,
  data: Record<string, any>,
  variants: SimVariantRecord[]
): VisionRuntimePackageRecord {
  const packageVariants = variants
    .filter((variant) => isVisionVariant(variant))
    .filter((variant) => (variant.visionPackageId || resolveDefaultVisionPackageId(variant)) === id);
  const includedVariantIds = Array.isArray(data.includedVariantIds) && data.includedVariantIds.length
    ? data.includedVariantIds.filter((value: unknown): value is string => typeof value === 'string')
    : packageVariants.map((variant) => variant.id);
  const includedVariants = variants.filter((variant) => includedVariantIds.includes(variant.id));
  const manifest = buildVisionRuntimePackageManifest(includedVariants, id, {
    packageName: data.packageName || null,
    preferredSurface: data.surface || null,
    packageStatus: data.packageStatus || null,
    authoredRuntimePlan: normalizeVisionRuntimePlan(data.runtimePlan),
    environmentVersion: data.environmentVersion || null,
    trialPackageVersion: data.trialPackageVersion || null,
    eventScriptVersion: data.eventScriptVersion || null,
    metricMappingVersion: data.metricMappingVersion || null,
    seedOrScriptId: data.seedOrScriptId || null,
  });

  return {
    ...manifest,
    includedVariantIds,
    validationNotes: data.validationNotes || undefined,
    createdAt: data.createdAt || Date.now(),
    updatedAt: data.updatedAt || Date.now(),
    publishedAt: data.publishedAt || undefined,
  };
}

function visionPackageRecordToFirestore(record: VisionRuntimePackageRecord): Record<string, any> {
  return {
    packageName: record.packageName,
    surface: record.surface,
    packageStatus: record.packageStatus,
    environmentVersion: record.environmentVersion,
    trialPackageVersion: record.trialPackageVersion,
    eventScriptVersion: record.eventScriptVersion,
    metricMappingVersion: record.metricMappingVersion,
    seedOrScriptId: record.seedOrScriptId,
    includedVariantIds: record.includedVariantIds,
    validationNotes: record.validationNotes || null,
    runtimePlan: record.runtimePlan || null,
    variants: record.variants,
    variantCount: record.variantCount,
    supportedFamilies: record.supportedFamilies,
    generatedAt: record.generatedAt,
    publishedAt: record.publishedAt || null,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function variantFromFirestore(id: string, data: Record<string, any>): SimVariantRecord {
  return {
    id,
    name: data.name || '',
    family: data.family || '',
    familyStatus: data.familyStatus || 'candidate',
    mode: data.mode || 'branch',
    specStatus: data.specStatus || 'needs-spec',
    priority: data.priority || 'medium',
    specRaw: data.specRaw || '',
    archetypeOverride: data.archetypeOverride || undefined,
    lockedSpec: data.lockedSpec || undefined,
    visionPackageStatus: data.visionPackageStatus || undefined,
    visionPackageId: data.visionPackageId || undefined,
    visionSurface: data.visionSurface || undefined,
    visionRuntimePlan: data.visionRuntimePlan || undefined,
    visionValidationNotes: data.visionValidationNotes || undefined,
    visionPublishedAt: data.visionPublishedAt || undefined,
    engineKey: data.engineKey || undefined,
    buildStatus: data.buildStatus || undefined,
    syncStatus: data.syncStatus || undefined,
    sourceFingerprint: data.sourceFingerprint || undefined,
    lastBuiltFingerprint: data.lastBuiltFingerprint || undefined,
    lastPublishedFingerprint: data.lastPublishedFingerprint || undefined,
    buildArtifact: data.buildArtifact || undefined,
    buildMeta: data.buildMeta || undefined,
    publishedSnapshot: data.publishedSnapshot || undefined,
    runtimeConfig: data.runtimeConfig || undefined,
    moduleDraft: data.moduleDraft || undefined,
    publishedModuleId: data.publishedModuleId || undefined,
    publishedAt: data.publishedAt || undefined,
    createdAt: data.createdAt || Date.now(),
    updatedAt: data.updatedAt || Date.now(),
  };
}

function variantToFirestore(record: SimVariantRecord): Record<string, any> {
  return {
    name: record.name,
    family: record.family,
    familyStatus: record.familyStatus,
    mode: record.mode,
    specStatus: record.specStatus,
    priority: record.priority,
    specRaw: record.specRaw || '',
    archetypeOverride: record.archetypeOverride || null,
    visionPackageStatus: record.visionPackageStatus || null,
    visionPackageId: record.visionPackageId || null,
    visionSurface: record.visionSurface || null,
    visionRuntimePlan: record.visionRuntimePlan || null,
    visionValidationNotes: record.visionValidationNotes || null,
    visionPublishedAt: record.visionPublishedAt || null,
    lockedSpec: record.lockedSpec || null,
    engineKey: record.engineKey || null,
    buildStatus: record.buildStatus || null,
    syncStatus: record.syncStatus || null,
    sourceFingerprint: record.sourceFingerprint || null,
    lastBuiltFingerprint: record.lastBuiltFingerprint || null,
    lastPublishedFingerprint: record.lastPublishedFingerprint || null,
    buildArtifact: record.buildArtifact || null,
    buildMeta: record.buildMeta || null,
    publishedSnapshot: record.publishedSnapshot || null,
    runtimeConfig: record.runtimeConfig || null,
    moduleDraft: record.moduleDraft || null,
    publishedModuleId: record.publishedModuleId || null,
    publishedAt: record.publishedAt || null,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function buildHistorySummary(action: SimVariantHistoryAction, record: SimVariantRecord, moduleId?: string) {
  switch (action) {
    case 'created':
      return `Created ${record.name} in the variant registry.`;
    case 'saved':
      return `Saved ${record.name} workspace changes.`;
    case 'published':
      return `Published ${record.name} to sim-modules${moduleId ? ` as ${moduleId}` : ''}.`;
    case 'seeded':
      return `Seeded ${record.name} from the static registry baseline.`;
    case 'seed_synced':
      return `Reconciled ${record.name} with the static registry baseline.`;
    case 'vision_promoted':
      return `Promoted ${record.name} in the Vision package pipeline${record.visionPackageStatus ? ` to ${record.visionPackageStatus}` : ''}.`;
    default:
      return `${record.name} updated.`;
  }
}

function historyToFirestore(entry: Omit<SimVariantHistoryEntry, 'id'>): Record<string, any> {
  return {
    variantId: entry.variantId,
    action: entry.action,
    summary: entry.summary,
    createdAt: entry.createdAt,
    moduleId: entry.moduleId || null,
    snapshot: variantToFirestore(entry.snapshot),
  };
}

function historyFromFirestore(id: string, data: Record<string, any>): SimVariantHistoryEntry {
  return {
    id,
    variantId: data.variantId || '',
    action: data.action || 'saved',
    summary: data.summary || '',
    createdAt: data.createdAt || Date.now(),
    moduleId: data.moduleId || undefined,
    snapshot: variantFromFirestore(data.variantId || '', data.snapshot || {}),
  };
}

function buildHistoryRef(variantId: string) {
  return collection(db, SIM_VARIANTS_COLLECTION, variantId, 'history');
}

async function deleteVariantHistory(variantId: string) {
  const historySnap = await getDocs(buildHistoryRef(variantId));
  await Promise.all(historySnap.docs.map((entry) => deleteDoc(entry.ref)));
}

function includesResetSwitchToken(value?: string | null) {
  if (!value) return false;
  return value.includes('Reset Switch')
    || value.includes('The Reset Switch');
}

function isLegacyResetVariant(record: SimVariantRecord) {
  return (
    includesResetSwitchToken(record.id)
    || record.family === 'The Reset Switch'
    || (record.engineKey as string | undefined) === 'reset'
    || includesResetSwitchToken(record.name)
    || includesResetSwitchToken(record.publishedModuleId)
    || includesResetSwitchToken(record.moduleDraft?.moduleId)
    || includesResetSwitchToken(record.buildArtifact?.engineKey)
    || includesResetSwitchToken(record.buildArtifact?.family)
    || includesResetSwitchToken(record.buildArtifact?.moduleId)
  );
}

function isLegacyResetModule(id: string, data: Record<string, any>) {
  return (
    includesResetSwitchToken(id)
    || includesResetSwitchToken(data?.name)
    || includesResetSwitchToken(data?.description)
    || includesResetSwitchToken(data?.exerciseConfig?.config?.type)
    || includesResetSwitchToken(data?.engineKey)
    || includesResetSwitchToken(data?.buildArtifact?.engineKey)
    || includesResetSwitchToken(data?.buildArtifact?.family)
    || includesResetSwitchToken(data?.buildArtifact?.moduleId)
    || includesResetSwitchToken(data?.variantSource?.family)
  );
}

async function purgeLegacyResetArtifacts(existingVariants: SimVariantRecord[]) {
  const legacyVariants = existingVariants.filter(isLegacyResetVariant);
  const moduleSnap = await getDocs(collection(db, SIM_MODULES_COLLECTION));
  const moduleIds = new Set(
    moduleSnap.docs
      .filter((entry) => isLegacyResetModule(entry.id, entry.data() || {}))
      .map((entry) => entry.id)
  );

  legacyVariants.forEach((record) => {
    if (record.publishedModuleId) {
      moduleIds.add(record.publishedModuleId);
    }
    if (record.moduleDraft?.moduleId) {
      moduleIds.add(record.moduleDraft.moduleId);
    }
  });

  if (!legacyVariants.length && !moduleIds.size) {
    return existingVariants;
  }

  await Promise.all(legacyVariants.map((record) => deleteVariantHistory(record.id)));

  const batch = writeBatch(db);
  legacyVariants.forEach((record) => {
    batch.delete(doc(db, SIM_VARIANTS_COLLECTION, record.id));
  });
  moduleIds.forEach((moduleId) => {
    batch.delete(doc(db, SIM_MODULES_COLLECTION, moduleId));
  });
  await batch.commit();

  return existingVariants.filter((record) => !isLegacyResetVariant(record));
}

function writeVariantHistory(
  batch: ReturnType<typeof writeBatch>,
  record: SimVariantRecord,
  action: SimVariantHistoryAction,
  moduleId?: string
) {
  const historyDoc = doc(buildHistoryRef(record.id));
  const createdAt = Date.now();
  batch.set(
    historyDoc,
    historyToFirestore({
      variantId: record.id,
      action,
      summary: buildHistorySummary(action, record, moduleId),
      createdAt,
      moduleId,
      snapshot: record,
    })
  );
}

export const simVariantRegistryService = {
  async list(): Promise<SimVariantRecord[]> {
    const snap = await getDocs(collection(db, SIM_VARIANTS_COLLECTION));
    return snap.docs.map((entry) => variantFromFirestore(entry.id, entry.data()));
  },

  async listVisionPackages(): Promise<VisionRuntimePackageRecord[]> {
    const variants = await this.list();
    const docsSnap = await getDocs(collection(db, VISION_RUNTIME_PACKAGES_COLLECTION));
    const docsById = new Map(docsSnap.docs.map((entry) => [entry.id, entry.data() || {}]));
    const packageIds = new Set<string>(docsSnap.docs.map((entry) => entry.id));

    variants
      .filter((variant) => isVisionVariant(variant))
      .forEach((variant) => {
        packageIds.add(variant.visionPackageId || resolveDefaultVisionPackageId(variant));
      });

    return Array.from(packageIds)
      .map((packageId) => visionPackageRecordFromFirestore(packageId, docsById.get(packageId) || {}, variants))
      .sort((left, right) => left.packageName.localeCompare(right.packageName));
  },

  async syncSeeds(seeds: SimVariantSeed[]): Promise<{ records: SimVariantRecord[]; created: number; updated: number }> {
    const existing = await purgeLegacyResetArtifacts(await this.list());
    const existingById = new Map(existing.map((record) => [record.id, record]));
    const now = Date.now();
    const batch = writeBatch(db);
    let created = 0;
    let updated = 0;

    seeds.forEach((seed) => {
      const id = buildSimVariantId(seed);
      const existingRecord = existingById.get(id);
      if (existingRecord) {
        const canonicalChanged =
          existingRecord.name !== seed.name
          || existingRecord.family !== seed.family
          || existingRecord.familyStatus !== seed.familyStatus
          || existingRecord.mode !== seed.mode
          || existingRecord.specStatus !== seed.specStatus
          || existingRecord.priority !== seed.priority;

        if (!canonicalChanged) {
          return;
        }

        const reconciledRecord = applyDraftSyncState({
          ...existingRecord,
          ...seed,
          updatedAt: now,
        });

        batch.set(doc(db, SIM_VARIANTS_COLLECTION, id), variantToFirestore(reconciledRecord), { merge: true });
        writeVariantHistory(batch, reconciledRecord, 'seed_synced');
        existingById.set(id, reconciledRecord);
        updated += 1;
        return;
      }

      const record: SimVariantRecord = {
        id,
        ...seed,
        createdAt: now,
        updatedAt: now,
      };
      const nextRecord = applyDraftSyncState(record);

      batch.set(doc(db, SIM_VARIANTS_COLLECTION, id), variantToFirestore(nextRecord));
      writeVariantHistory(batch, nextRecord, 'seeded');
      existingById.set(id, nextRecord);
      created += 1;
    });

    if (created > 0 || updated > 0) {
      await batch.commit();
    }

    return {
      created,
      updated,
      records: Array.from(existingById.values()),
    };
  },

  async save(record: SimVariantRecord): Promise<void> {
    const variantRef = doc(db, SIM_VARIANTS_COLLECTION, record.id);
    const existing = await getDoc(variantRef);
    const now = Date.now();
    const nextRecord = applyDraftSyncState({
      ...record,
      createdAt: existing.exists() ? (existing.data()?.createdAt || record.createdAt) : now,
      updatedAt: now,
    });
    const batch = writeBatch(db);
    batch.set(variantRef, variantToFirestore(nextRecord), { merge: true });
    writeVariantHistory(batch, nextRecord, existing.exists() ? 'saved' : 'created');
    await batch.commit();
  },

  async publish(record: SimVariantRecord, module: MentalExercise): Promise<string> {
    const publishedAt = Date.now();
    const recordForPublish: SimVariantRecord = {
      ...record,
      publishedModuleId: module.id,
      moduleDraft: record.moduleDraft
        ? {
          ...record.moduleDraft,
          moduleId: module.id,
        }
        : record.moduleDraft,
    };
    const nextRecord = buildPublishedVariantRecord(
      recordForPublish,
      publishedAt
    );
    const publishedModule = buildPublishedModuleFromVariant(nextRecord, {
      ...module,
      updatedAt: publishedAt,
    });
    const batch = writeBatch(db);

    batch.set(
      doc(db, SIM_MODULES_COLLECTION, module.id),
      exerciseToFirestore({
        ...publishedModule,
        variantSource: {
          ...(publishedModule.variantSource || {}),
          variantId: record.id,
          variantName: record.name,
          family: record.family,
          mode: record.mode,
          publishedAt,
        },
      }),
      { merge: true }
    );

    batch.set(
      doc(db, SIM_VARIANTS_COLLECTION, record.id),
      variantToFirestore(nextRecord),
      { merge: true }
    );
    writeVariantHistory(batch, nextRecord, 'published', module.id);
    await batch.commit();

    return module.id;
  },

  async saveVisionPackage(record: SimVariantRecord): Promise<void> {
    const variantRef = doc(db, SIM_VARIANTS_COLLECTION, record.id);
    const existing = await getDoc(variantRef);
    const existingVariants = await this.list();
    const now = Date.now();
    const packageId = record.visionPackageId || resolveDefaultVisionPackageId(record);
    const packageRef = doc(db, VISION_RUNTIME_PACKAGES_COLLECTION, packageId);
    const existingPackage = await getDoc(packageRef);
    const persistedRuntimePlan = existingPackage.exists()
      ? normalizeVisionRuntimePlan((existingPackage.data()?.runtimePlan as VisionRuntimeTrialPlanManifest | null | undefined) ?? null)
      : null;
    const nextRecord: SimVariantRecord = {
      ...record,
      createdAt: existing.exists() ? record.createdAt : now,
      updatedAt: now,
      visionPublishedAt: record.visionPackageStatus ? now : record.visionPublishedAt,
      visionPackageId: packageId,
      visionRuntimePlan: record.visionRuntimePlan ?? persistedRuntimePlan ?? undefined,
    };
    const batch = writeBatch(db);
    batch.set(variantRef, variantToFirestore(nextRecord), { merge: true });
    if (isVisionVariant(nextRecord)) {
      const packageData = existingPackage.exists() ? (existingPackage.data() || {}) : {};
      const manifest = buildVisionRuntimePackageManifest(
        [
          ...existingVariants.filter((variant) => variant.id !== nextRecord.id),
          {
            ...nextRecord,
            visionPackageId: packageId,
          },
        ],
        packageId,
        {
          packageName: packageData.packageName || null,
          preferredSurface: nextRecord.visionSurface || packageData.surface || null,
          packageStatus: nextRecord.visionPackageStatus || packageData.packageStatus || null,
          authoredRuntimePlan: nextRecord.visionRuntimePlan ?? persistedRuntimePlan ?? undefined,
          environmentVersion: packageData.environmentVersion || null,
          trialPackageVersion: packageData.trialPackageVersion || null,
          eventScriptVersion: packageData.eventScriptVersion || null,
          metricMappingVersion: packageData.metricMappingVersion || null,
          seedOrScriptId: packageData.seedOrScriptId || null,
        }
      );
      batch.set(packageRef, manifest, { merge: true });
    }
    writeVariantHistory(batch, nextRecord, 'vision_promoted');
    await batch.commit();
  },

  async saveVisionPackageRecord(record: VisionRuntimePackageRecord): Promise<void> {
    const packageRef = doc(db, VISION_RUNTIME_PACKAGES_COLLECTION, record.packageId);
    const existingVariants = await this.list();
    const now = Date.now();
    const includedSet = new Set(record.includedVariantIds);
    const includedVariants = existingVariants.filter((variant) => includedSet.has(variant.id));
    const manifest = buildVisionRuntimePackageManifest(includedVariants, record.packageId, {
      packageName: record.packageName,
      preferredSurface: record.surface,
      packageStatus: record.packageStatus,
      authoredRuntimePlan: record.runtimePlan,
      environmentVersion: record.environmentVersion,
      trialPackageVersion: record.trialPackageVersion,
      eventScriptVersion: record.eventScriptVersion,
      metricMappingVersion: record.metricMappingVersion,
      seedOrScriptId: record.seedOrScriptId,
    });
    const nextRecord: VisionRuntimePackageRecord = {
      ...record,
      ...manifest,
      updatedAt: now,
      createdAt: record.createdAt || now,
    };

    const batch = writeBatch(db);
    batch.set(packageRef, visionPackageRecordToFirestore(nextRecord), { merge: true });

    existingVariants
      .filter((variant) => isVisionVariant(variant))
      .forEach((variant) => {
        const variantRef = doc(db, SIM_VARIANTS_COLLECTION, variant.id);
        const inPackage = includedSet.has(variant.id);
        if (inPackage) {
          const updatedVariant: SimVariantRecord = {
            ...variant,
            visionPackageId: record.packageId,
            visionSurface: record.surface,
            visionPackageStatus: record.packageStatus,
            visionRuntimePlan: record.runtimePlan || undefined,
            visionPublishedAt: now,
            updatedAt: now,
          };
          batch.set(variantRef, variantToFirestore(updatedVariant), { merge: true });
          writeVariantHistory(batch, updatedVariant, 'vision_promoted');
        } else if ((variant.visionPackageId || resolveDefaultVisionPackageId(variant)) === record.packageId) {
          const removedVariant: SimVariantRecord = {
            ...variant,
            visionPackageId: undefined,
            visionSurface: undefined,
            visionPackageStatus: 'spec_only',
            visionRuntimePlan: undefined,
            updatedAt: now,
          };
          batch.set(variantRef, variantToFirestore(removedVariant), { merge: true });
          writeVariantHistory(batch, removedVariant, 'vision_promoted');
        }
      });

    await batch.commit();
  },

  async listHistory(variantId: string): Promise<SimVariantHistoryEntry[]> {
    const snap = await getDocs(query(buildHistoryRef(variantId), orderBy('createdAt', 'desc')));
    return snap.docs.map((entry) => historyFromFirestore(entry.id, entry.data()));
  },
};
