export type EnduranceLockFlavor = 'generic' | 'late_pressure' | 'visual_channel';
export type EnduranceLockPhaseTag = 'baseline' | 'middle' | 'finish';
export type EnduranceLockPressureTag = 'neutral' | 'pressure';
export type EnduranceLockVisualDensityTier = 'low' | 'medium' | 'high';
export type EnduranceLockPeripheralLoadTier = 'low' | 'medium' | 'high';
export type EnduranceLockContrastProfile = 'normal_contrast' | 'reduced_contrast' | 'glare_wash';
export type EnduranceLockLatePressureProfileId = 'clock_compression_v1' | 'score_weight_v1' | 'error_consequence_v1';
export type EnduranceLockVisualProfileId = 'clutter_ramp_v1' | 'peripheral_bait_v1' | 'contrast_decay_v1';

export interface EnduranceLockBlockPlan {
  blockIndex: number;
  blockKey: string;
  blockLabel: string;
  phaseTag: EnduranceLockPhaseTag;
  pressureTag: EnduranceLockPressureTag;
  cadenceMs: number;
  windowMs: number;
  prompt: string;
  visualDensityTier: EnduranceLockVisualDensityTier;
  peripheralLoadTier: EnduranceLockPeripheralLoadTier;
  contrastProfile: EnduranceLockContrastProfile;
  activeModifiers: string[];
  scoreWeight: number;
  errorPenaltyWeight: number;
}

export interface EnduranceLockRuntimeProfile {
  flavor: EnduranceLockFlavor;
  profileId: string;
  scheduleVersion: string;
  blockStructureVersion: 'six_block_v1';
  title: string;
  summaryLabel: string;
  introLabel: string;
  blockPlans: EnduranceLockBlockPlan[];
}

interface ResolveEnduranceLockRuntimeProfileParams {
  archetype?: string | null;
  variantName?: string | null;
  runtimeConfig?: Record<string, any> | null;
  stimulusModel?: Record<string, any> | null;
}

function inferFlavor(archetype?: string | null, variantName?: string | null): EnduranceLockFlavor {
  const normalizedArchetype = String(archetype ?? '').toLowerCase();
  const normalizedName = String(variantName ?? '').toLowerCase();
  if (normalizedArchetype === 'visual_channel' || normalizedName.includes('clutter') || normalizedName.includes('visual')) {
    return 'visual_channel';
  }
  if (normalizedName.includes('late-pressure') || normalizedName.includes('late pressure')) {
    return 'late_pressure';
  }
  return 'generic';
}

function buildConstantBlock(blockIndex: number): EnduranceLockBlockPlan {
  const phaseTag: EnduranceLockPhaseTag = blockIndex < 2 ? 'baseline' : blockIndex < 4 ? 'middle' : 'finish';
  return {
    blockIndex,
    blockKey: `block_${blockIndex + 1}`,
    blockLabel: `Block ${blockIndex + 1}`,
    phaseTag,
    pressureTag: 'neutral',
    cadenceMs: 2500,
    windowMs: 1500,
    prompt: 'Tap when the center signal appears.',
    visualDensityTier: 'low',
    peripheralLoadTier: 'low',
    contrastProfile: 'normal_contrast',
    activeModifiers: ['variable_foreperiod'],
    scoreWeight: 1,
    errorPenaltyWeight: 1,
  };
}

/**
 * Compatibility resolver for older callers. Variant names may still describe
 * packaging, but the scored six-block task is always constant. Late pressure,
 * visual ramps, cadence changes, and score-weight changes require a separate,
 * counterbalanced protocol and are not Endurance Lock runtime profiles.
 */
export function resolveEnduranceLockRuntimeProfile(
  params: ResolveEnduranceLockRuntimeProfileParams
): EnduranceLockRuntimeProfile {
  return {
    flavor: inferFlavor(params.archetype, params.variantName),
    profileId: 'constant_visual_v2',
    scheduleVersion: 'constant_visual_v2_schedule',
    blockStructureVersion: 'six_block_v1',
    title: 'Endurance Lock',
    summaryLabel: 'Sustained-attention task profile',
    introLabel: 'Tap when the same center signal appears. The task stays the same for all six blocks.',
    blockPlans: Array.from({ length: 6 }, (_, blockIndex) => buildConstantBlock(blockIndex)),
  };
}
