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

function getValueAtPath<T = any>(value: Record<string, any> | null | undefined, path: string): T | undefined {
  const parts = path.split('.');
  let current: any = value ?? undefined;
  for (const part of parts) {
    if (!current || typeof current !== 'object' || !(part in current)) return undefined;
    current = current[part];
  }
  return current as T | undefined;
}

function buildBlockPlan(
  blockIndex: number,
  phaseTag: EnduranceLockPhaseTag,
  cadenceMs: number,
  windowMs: number,
  prompt: string,
  visualDensityTier: EnduranceLockVisualDensityTier,
  peripheralLoadTier: EnduranceLockPeripheralLoadTier,
  contrastProfile: EnduranceLockContrastProfile,
  activeModifiers: string[],
  scoreWeight = 1,
  errorPenaltyWeight = 1,
): EnduranceLockBlockPlan {
  return {
    blockIndex,
    blockKey: ['baseline_1', 'baseline_2', 'mid_1', 'mid_2', 'finish_1', 'finish_2'][blockIndex] ?? `block_${blockIndex + 1}`,
    blockLabel: ['Baseline 1', 'Baseline 2', 'Mid 1', 'Mid 2', 'Finish 1', 'Finish 2'][blockIndex] ?? `Block ${blockIndex + 1}`,
    phaseTag,
    pressureTag: phaseTag === 'finish' ? 'pressure' : 'neutral',
    cadenceMs,
    windowMs,
    prompt,
    visualDensityTier,
    peripheralLoadTier,
    contrastProfile,
    activeModifiers,
    scoreWeight,
    errorPenaltyWeight,
  };
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

function resolveLatePressureProfileId(params: ResolveEnduranceLockRuntimeProfileParams): EnduranceLockLatePressureProfileId {
  const explicit = (
    getValueAtPath<string>(params.stimulusModel, 'runtimeProfile.profileId')
    ?? getValueAtPath<string>(params.runtimeConfig, 'stimuli.modifierProfileId')
    ?? getValueAtPath<string>(params.runtimeConfig, 'stimuli.profileId')
  );
  if (explicit === 'clock_compression_v1' || explicit === 'score_weight_v1' || explicit === 'error_consequence_v1') {
    return explicit;
  }
  const normalizedName = String(params.variantName ?? '').toLowerCase();
  if (normalizedName.includes('score')) return 'score_weight_v1';
  if (normalizedName.includes('error') || normalizedName.includes('consequence')) return 'error_consequence_v1';
  return 'clock_compression_v1';
}

function resolveVisualProfileId(params: ResolveEnduranceLockRuntimeProfileParams): EnduranceLockVisualProfileId {
  const explicit = (
    getValueAtPath<string>(params.stimulusModel, 'runtimeProfile.profileId')
    ?? getValueAtPath<string>(params.runtimeConfig, 'stimuli.visualProfileId')
    ?? getValueAtPath<string>(params.runtimeConfig, 'stimuli.profileId')
  );
  if (explicit === 'clutter_ramp_v1' || explicit === 'peripheral_bait_v1' || explicit === 'contrast_decay_v1') {
    return explicit;
  }
  const normalizedName = String(params.variantName ?? '').toLowerCase();
  if (normalizedName.includes('peripheral')) return 'peripheral_bait_v1';
  if (normalizedName.includes('contrast')) return 'contrast_decay_v1';
  return 'clutter_ramp_v1';
}

function buildLatePressureProfile(profileId: EnduranceLockLatePressureProfileId): EnduranceLockRuntimeProfile {
  const shared = {
    flavor: 'late_pressure' as const,
    profileId,
    scheduleVersion: `${profileId}_schedule`,
    blockStructureVersion: 'six_block_v1' as const,
    title: 'Late-Pressure Endurance Lock',
    summaryLabel: 'Finish-phase pressure profile',
    introLabel: 'Hold form while the final blocks become more consequential.',
  };

  switch (profileId) {
    case 'score_weight_v1':
      return {
        ...shared,
        blockPlans: [
          buildBlockPlan(0, 'baseline', 1320, 520, 'Anchor the baseline cadence.', 'low', 'low', 'normal_contrast', ['sustained_load']),
          buildBlockPlan(1, 'baseline', 1260, 500, 'Keep the same clean rhythm.', 'low', 'low', 'normal_contrast', ['sustained_load']),
          buildBlockPlan(2, 'middle', 1180, 460, 'Load is building. Stay efficient.', 'medium', 'low', 'normal_contrast', ['sustained_load']),
          buildBlockPlan(3, 'middle', 1100, 430, 'Stay clean as the run settles in.', 'medium', 'low', 'normal_contrast', ['sustained_load']),
          buildBlockPlan(4, 'finish', 1040, 420, 'Final blocks count double. Keep execution clean.', 'medium', 'low', 'normal_contrast', ['sustained_load', 'late_pressure_profile', 'stakes_messaging'], 2, 1),
          buildBlockPlan(5, 'finish', 980, 400, 'Double-value finish block. Hold the line.', 'medium', 'low', 'normal_contrast', ['sustained_load', 'late_pressure_profile', 'stakes_messaging'], 2, 1),
        ],
      };
    case 'error_consequence_v1':
      return {
        ...shared,
        blockPlans: [
          buildBlockPlan(0, 'baseline', 1320, 520, 'Anchor the baseline cadence.', 'low', 'low', 'normal_contrast', ['sustained_load']),
          buildBlockPlan(1, 'baseline', 1260, 500, 'Keep the same clean rhythm.', 'low', 'low', 'normal_contrast', ['sustained_load']),
          buildBlockPlan(2, 'middle', 1180, 460, 'Load is building. Stay efficient.', 'medium', 'low', 'normal_contrast', ['sustained_load']),
          buildBlockPlan(3, 'middle', 1100, 430, 'Stay clean as the run settles in.', 'medium', 'low', 'normal_contrast', ['sustained_load']),
          buildBlockPlan(4, 'finish', 1000, 390, 'Late misses sting here. Lock in.', 'medium', 'low', 'normal_contrast', ['sustained_load', 'late_pressure_profile', 'stakes_messaging'], 1, 2),
          buildBlockPlan(5, 'finish', 940, 360, 'Every miss carries consequence now.', 'medium', 'low', 'normal_contrast', ['sustained_load', 'late_pressure_profile', 'stakes_messaging'], 1, 2),
        ],
      };
    case 'clock_compression_v1':
    default:
      return {
        ...shared,
        blockPlans: [
          buildBlockPlan(0, 'baseline', 1320, 520, 'Anchor the baseline cadence.', 'low', 'low', 'normal_contrast', ['sustained_load']),
          buildBlockPlan(1, 'baseline', 1260, 500, 'Keep the same clean rhythm.', 'low', 'low', 'normal_contrast', ['sustained_load']),
          buildBlockPlan(2, 'middle', 1180, 460, 'Load is building. Stay efficient.', 'medium', 'low', 'normal_contrast', ['sustained_load']),
          buildBlockPlan(3, 'middle', 1100, 430, 'Stay clean as the run settles in.', 'medium', 'low', 'normal_contrast', ['sustained_load']),
          buildBlockPlan(4, 'finish', 920, 360, 'Clock is tighter. Finish clean.', 'medium', 'low', 'normal_contrast', ['sustained_load', 'late_pressure_profile', 'stakes_messaging']),
          buildBlockPlan(5, 'finish', 840, 320, 'Final cadence compresses. Keep control.', 'medium', 'low', 'normal_contrast', ['sustained_load', 'late_pressure_profile', 'stakes_messaging']),
        ],
      };
  }
}

function buildVisualChannelProfile(profileId: EnduranceLockVisualProfileId): EnduranceLockRuntimeProfile {
  const shared = {
    flavor: 'visual_channel' as const,
    profileId,
    scheduleVersion: `${profileId}_schedule`,
    blockStructureVersion: 'six_block_v1' as const,
    title: 'Clutter-Fatigue Endurance Lock',
    summaryLabel: 'Visual endurance profile',
    introLabel: 'Hold the same task cleanly while the display state gets noisier.',
  };

  switch (profileId) {
    case 'peripheral_bait_v1':
      return {
        ...shared,
        blockPlans: [
          buildBlockPlan(0, 'baseline', 1260, 500, 'Clean-reference baseline. Ignore the edges.', 'low', 'low', 'normal_contrast', ['visual_density']),
          buildBlockPlan(1, 'baseline', 1220, 480, 'Keep the center stable.', 'low', 'low', 'normal_contrast', ['visual_density']),
          buildBlockPlan(2, 'middle', 1160, 450, 'Peripheral bait comes online. Stay centered.', 'medium', 'medium', 'normal_contrast', ['visual_density', 'peripheral_bait']),
          buildBlockPlan(3, 'middle', 1120, 430, 'Decoys compete at the edges. Do not chase them.', 'medium', 'medium', 'normal_contrast', ['visual_density', 'peripheral_bait']),
          buildBlockPlan(4, 'finish', 1060, 410, 'Finish with strong edge competition. Keep the target.', 'medium', 'high', 'normal_contrast', ['visual_density', 'peripheral_bait']),
          buildBlockPlan(5, 'finish', 1020, 390, 'Peripheral bait stays hot. Finish clean.', 'medium', 'high', 'normal_contrast', ['visual_density', 'peripheral_bait']),
        ],
      };
    case 'contrast_decay_v1':
      return {
        ...shared,
        blockPlans: [
          buildBlockPlan(0, 'baseline', 1260, 500, 'Clean-reference baseline. Hold the target.', 'low', 'low', 'normal_contrast', ['visual_density']),
          buildBlockPlan(1, 'baseline', 1220, 480, 'Keep the same centered read.', 'low', 'low', 'normal_contrast', ['visual_density']),
          buildBlockPlan(2, 'middle', 1160, 450, 'Cue salience drops. Stay precise.', 'medium', 'low', 'reduced_contrast', ['visual_density', 'contrast_drift']),
          buildBlockPlan(3, 'middle', 1120, 430, 'Reduced contrast continues. Do not oversearch.', 'medium', 'low', 'reduced_contrast', ['visual_density', 'contrast_drift']),
          buildBlockPlan(4, 'finish', 1060, 410, 'Low-salience finish block. Keep the target alive.', 'medium', 'low', 'glare_wash', ['visual_density', 'contrast_drift']),
          buildBlockPlan(5, 'finish', 1020, 390, 'Glare-wash continuation. Finish clean.', 'medium', 'low', 'glare_wash', ['visual_density', 'contrast_drift']),
        ],
      };
    case 'clutter_ramp_v1':
    default:
      return {
        ...shared,
        blockPlans: [
          buildBlockPlan(0, 'baseline', 1260, 500, 'Clean-reference baseline. Hold the target.', 'low', 'low', 'normal_contrast', ['visual_density']),
          buildBlockPlan(1, 'baseline', 1220, 480, 'Stay clean in the baseline state.', 'low', 'low', 'normal_contrast', ['visual_density']),
          buildBlockPlan(2, 'middle', 1160, 450, 'Clutter rises to medium. Keep the same rule.', 'medium', 'low', 'normal_contrast', ['visual_density']),
          buildBlockPlan(3, 'middle', 1120, 430, 'Medium clutter continues. Do not chase noise.', 'medium', 'low', 'normal_contrast', ['visual_density']),
          buildBlockPlan(4, 'finish', 1060, 410, 'High clutter finish block. Stay exact.', 'high', 'low', 'normal_contrast', ['visual_density']),
          buildBlockPlan(5, 'finish', 1020, 390, 'High clutter continuation. Finish clean.', 'high', 'low', 'normal_contrast', ['visual_density']),
        ],
      };
  }
}

function buildGenericProfile(): EnduranceLockRuntimeProfile {
  return {
    flavor: 'generic',
    profileId: 'sustained_load_v1',
    scheduleVersion: 'sustained_load_v1_schedule',
    blockStructureVersion: 'six_block_v1',
    title: 'Endurance Lock',
    summaryLabel: 'Sustained-load profile',
    introLabel: 'Hold clean execution as fatigue accumulates across the session.',
    blockPlans: [
      buildBlockPlan(0, 'baseline', 1320, 520, 'Anchor the baseline cadence.', 'low', 'low', 'normal_contrast', ['sustained_load']),
      buildBlockPlan(1, 'baseline', 1260, 500, 'Keep the same clean rhythm.', 'low', 'low', 'normal_contrast', ['sustained_load']),
      buildBlockPlan(2, 'middle', 1180, 460, 'Load is building. Stay precise.', 'medium', 'low', 'normal_contrast', ['sustained_load']),
      buildBlockPlan(3, 'middle', 1120, 430, 'Stay clean through the middle blocks.', 'medium', 'low', 'normal_contrast', ['sustained_load']),
      buildBlockPlan(4, 'finish', 1060, 390, 'Finish phase begins. Hold form.', 'medium', 'low', 'normal_contrast', ['sustained_load']),
      buildBlockPlan(5, 'finish', 1000, 360, 'Finish clean under load.', 'medium', 'low', 'normal_contrast', ['sustained_load']),
    ],
  };
}

export function resolveEnduranceLockRuntimeProfile(params: ResolveEnduranceLockRuntimeProfileParams): EnduranceLockRuntimeProfile {
  const explicitProfile = getValueAtPath<EnduranceLockRuntimeProfile>(params.stimulusModel, 'runtimeProfile');
  if (explicitProfile?.blockPlans?.length === 6) {
    return explicitProfile;
  }

  const flavor = inferFlavor(params.archetype, params.variantName);
  if (flavor === 'visual_channel') {
    return buildVisualChannelProfile(resolveVisualProfileId(params));
  }
  if (flavor === 'late_pressure') {
    return buildLatePressureProfile(resolveLatePressureProfileId(params));
  }
  return buildGenericProfile();
}

