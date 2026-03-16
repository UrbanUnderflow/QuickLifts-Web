/**
 * Pulse Check Taxonomy
 *
 * Canonical system model for Pulse Check simulations, scoring, programs, and trials.
 * This layer sits above the legacy exercise/pathway model so existing surfaces can
 * migrate without a flag day rewrite.
 */

export enum TaxonomyPillar {
  Focus = 'focus',
  Composure = 'composure',
  Decision = 'decision',
}

export enum TaxonomySkill {
  SustainedAttention = 'sustained_attention',
  SelectiveAttention = 'selective_attention',
  AttentionalShifting = 'attentional_shifting',
  ErrorRecoverySpeed = 'error_recovery_speed',
  EmotionalInterferenceControl = 'emotional_interference_control',
  PressureStability = 'pressure_stability',
  ResponseInhibition = 'response_inhibition',
  WorkingMemoryUpdating = 'working_memory_updating',
  CueDiscrimination = 'cue_discrimination',
}

export enum TaxonomyModifier {
  Readiness = 'readiness',
  Fatigability = 'fatigability',
  Consistency = 'consistency',
  PressureSensitivity = 'pressure_sensitivity',
}

export enum PressureType {
  Time = 'time_pressure',
  Visual = 'visual_distraction',
  Audio = 'audio_distraction',
  Evaluative = 'evaluative_threat',
  Uncertainty = 'uncertainty',
  CompoundingError = 'compounding_error',
  Fatigue = 'fatigue',
}

export enum SimEvidenceStatus {
  Foundational = 'foundational',
  Adjacent = 'adjacent',
  Internal = 'internal',
  Validated = 'validated',
}

export enum SimPrescriptionRole {
  DailyProbe = 'daily_probe',
  SkillRep = 'skill_rep',
  PressureExposure = 'pressure_exposure',
  Reassessment = 'reassessment',
  FatigabilityTest = 'fatigability_test',
}

export enum SessionType {
  Probe = 'probe',
  TrainingRep = 'training_rep',
  RecoveryRep = 'recovery_rep',
  Reassessment = 'reassessment',
  PressureExposure = 'pressure_exposure',
}

export enum DurationMode {
  QuickProbe = 'quick_probe',
  StandardRep = 'standard_rep',
  ExtendedStressTest = 'extended_stress_test',
}

export enum TrialType {
  Baseline = 'baseline_trial',
  ImmersiveTransfer = 'immersive_transfer_trial',
  FieldTransfer = 'field_transfer_trial',
}

export type ProfileSnapshotMilestone =
  | 'onboarding'
  | 'baseline'
  | 'midpoint'
  | 'endpoint'
  | 'retention'
  | 'manual_staff_checkpoint';

export interface SimSpec {
  id: string;
  legacyExerciseId?: string;
  name: string;
  purpose: string;
  primaryPillar: TaxonomyPillar;
  secondaryPillar?: TaxonomyPillar;
  targetSkills: TaxonomySkill[];
  pressureTypes: PressureType[];
  executionTask: string;
  coreMetric: string;
  supportingMetrics: string[];
  prescriptionRoles: SimPrescriptionRole[];
  scientificBasis: string;
  evidenceStatus: SimEvidenceStatus;
  transferHypothesis: string;
  validationPlan: string;
  recommendedDurations: Record<DurationMode, number>;
}

export interface TaxonomyCheckInState {
  readinessScore: number;
  energyLevel?: number;
  stressLevel?: number;
  sleepQuality?: number;
  moodWord?: string;
  modifierScores: Record<TaxonomyModifier, number>;
  likelyPressureSensitivity: PressureType[];
  recommendedSessionType: SessionType;
  recommendedDurationMode: DurationMode;
  generatedAt: number;
}

export interface TaxonomyProfile {
  overallScore: number;
  pillarScores: Record<TaxonomyPillar, number>;
  skillScores: Record<TaxonomySkill, number>;
  modifierScores: Record<TaxonomyModifier, number>;
  pressureSensitivity: Partial<Record<PressureType, number>>;
  strongestSkills: TaxonomySkill[];
  weakestSkills: TaxonomySkill[];
  trendSummary: string[];
  updatedAt: number;
}

export interface ProgramPrescription {
  recommendedSimId: string;
  recommendedLegacyExerciseId?: string;
  sessionType: SessionType;
  durationMode: DurationMode;
  durationSeconds: number;
  rationale: string;
  targetSkills: TaxonomySkill[];
  targetPressureTypes: PressureType[];
  generatedAt: number;
}

export interface SimSessionRecord {
  id?: string;
  userId: string;
  simId: string;
  simName: string;
  legacyExerciseId?: string;
  sessionType: SessionType;
  durationMode: DurationMode;
  durationSeconds: number;
  trialType?: TrialType;
  profileSnapshotMilestone?: ProfileSnapshotMilestone;
  coreMetricName: string;
  coreMetricValue: number;
  supportingMetrics: Record<string, number>;
  normalizedScore: number;
  targetSkills: TaxonomySkill[];
  pressureTypes: PressureType[];
  notes?: string;
  createdAt: number;
}

const allPillars = Object.values(TaxonomyPillar);
const allSkills = Object.values(TaxonomySkill);
const allModifiers = Object.values(TaxonomyModifier);

export function createEmptyPillarScores(initial = 50): Record<TaxonomyPillar, number> {
  return allPillars.reduce((acc, pillar) => {
    acc[pillar] = initial;
    return acc;
  }, {} as Record<TaxonomyPillar, number>);
}

export function createEmptySkillScores(initial = 50): Record<TaxonomySkill, number> {
  return allSkills.reduce((acc, skill) => {
    acc[skill] = initial;
    return acc;
  }, {} as Record<TaxonomySkill, number>);
}

export function createEmptyModifierScores(initial = 50): Record<TaxonomyModifier, number> {
  return allModifiers.reduce((acc, modifier) => {
    acc[modifier] = initial;
    return acc;
  }, {} as Record<TaxonomyModifier, number>);
}

export const SIM_REGISTRY: SimSpec[] = [
  {
    id: 'reset',
    legacyExerciseId: 'focus-3-second-reset',
    name: 'Reset',
    purpose: 'Train rapid recovery and re-engagement after disruption.',
    primaryPillar: TaxonomyPillar.Composure,
    secondaryPillar: TaxonomyPillar.Focus,
    targetSkills: [
      TaxonomySkill.ErrorRecoverySpeed,
      TaxonomySkill.AttentionalShifting,
      TaxonomySkill.PressureStability,
    ],
    pressureTypes: [
      PressureType.Evaluative,
      PressureType.CompoundingError,
      PressureType.Visual,
    ],
    executionTask: 'Tracking, tapping, and re-locking onto the live task after disruption.',
    coreMetric: 'recovery_time',
    supportingMetrics: [
      'recovery_trend',
      'disruption_resilience_score',
      'consistency_index',
      'worst_to_best_delta',
    ],
    prescriptionRoles: [
      SimPrescriptionRole.DailyProbe,
      SimPrescriptionRole.SkillRep,
      SimPrescriptionRole.PressureExposure,
      SimPrescriptionRole.Reassessment,
    ],
    scientificBasis: 'Attentional Control Theory, stress inoculation, and distraction-refocusing drills.',
    evidenceStatus: SimEvidenceStatus.Adjacent,
    transferHypothesis: 'Athletes reset faster after mistakes and return to execution with less dwell time.',
    validationPlan: 'Compare recovery time against coach-rated reset quality and video-coded re-engagement after errors.',
    recommendedDurations: {
      [DurationMode.QuickProbe]: 120,
      [DurationMode.StandardRep]: 180,
      [DurationMode.ExtendedStressTest]: 360,
    },
  },
  {
    id: 'noise_gate',
    legacyExerciseId: 'focus-noise-gate',
    name: 'Noise Gate',
    purpose: 'Train selective attention under clutter and interference.',
    primaryPillar: TaxonomyPillar.Focus,
    secondaryPillar: TaxonomyPillar.Decision,
    targetSkills: [
      TaxonomySkill.SelectiveAttention,
      TaxonomySkill.CueDiscrimination,
    ],
    pressureTypes: [PressureType.Visual, PressureType.Audio],
    executionTask: 'Read the correct cue while filtering noise, bait, and irrelevant signals.',
    coreMetric: 'distractor_cost',
    supportingMetrics: ['accuracy_under_clutter', 'lapse_rate', 'channel_variance'],
    prescriptionRoles: [SimPrescriptionRole.SkillRep, SimPrescriptionRole.PressureExposure],
    scientificBasis: 'Attention systems research and sport concentration training.',
    evidenceStatus: SimEvidenceStatus.Foundational,
    transferHypothesis: 'Athletes hold the right cue more effectively in noisy and cluttered environments.',
    validationPlan: 'Compare distractor cost to coach-designed drills with crowd noise, motion clutter, and visual bait.',
    recommendedDurations: {
      [DurationMode.QuickProbe]: 110,
      [DurationMode.StandardRep]: 180,
      [DurationMode.ExtendedStressTest]: 330,
    },
  },
  {
    id: 'brake_point',
    legacyExerciseId: 'decision-brake-point',
    name: 'Brake Point',
    purpose: 'Train response inhibition and cleaner cancellation of bad actions.',
    primaryPillar: TaxonomyPillar.Decision,
    secondaryPillar: TaxonomyPillar.Composure,
    targetSkills: [TaxonomySkill.ResponseInhibition],
    pressureTypes: [PressureType.Time, PressureType.Uncertainty],
    executionTask: 'Cancel prepotent responses in go/no-go and fake-out sequences.',
    coreMetric: 'stop_latency',
    supportingMetrics: ['commission_errors', 'false_start_rate', 'recovery_after_cancel'],
    prescriptionRoles: [SimPrescriptionRole.SkillRep, SimPrescriptionRole.Reassessment],
    scientificBasis: 'Executive-function research on inhibitory control.',
    evidenceStatus: SimEvidenceStatus.Foundational,
    transferHypothesis: 'Athletes show fewer impulsive errors and cleaner cancellation of bad actions.',
    validationPlan: 'Relate stop latency and false starts to practice film and coach ratings of impulsive errors.',
    recommendedDurations: {
      [DurationMode.QuickProbe]: 90,
      [DurationMode.StandardRep]: 150,
      [DurationMode.ExtendedStressTest]: 300,
    },
  },
  {
    id: 'signal_window',
    legacyExerciseId: 'decision-signal-window',
    name: 'Signal Window',
    purpose: 'Train cue discrimination and decision clarity in compressed time windows.',
    primaryPillar: TaxonomyPillar.Decision,
    secondaryPillar: TaxonomyPillar.Focus,
    targetSkills: [
      TaxonomySkill.CueDiscrimination,
      TaxonomySkill.SelectiveAttention,
    ],
    pressureTypes: [PressureType.Time, PressureType.Uncertainty, PressureType.Visual],
    executionTask: 'Read the live signal from decoys and ambiguity before the window closes.',
    coreMetric: 'correct_read_under_time_pressure',
    supportingMetrics: ['choice_latency', 'decision_accuracy', 'decoy_susceptibility'],
    prescriptionRoles: [SimPrescriptionRole.SkillRep, SimPrescriptionRole.Reassessment],
    scientificBasis: 'Attention systems, cue selection, and executive-function diversity.',
    evidenceStatus: SimEvidenceStatus.Adjacent,
    transferHypothesis: 'Athletes make cleaner reads faster when time windows are tight.',
    validationPlan: 'Compare results against coach-graded video decision tasks and recognition drills.',
    recommendedDurations: {
      [DurationMode.QuickProbe]: 100,
      [DurationMode.StandardRep]: 165,
      [DurationMode.ExtendedStressTest]: 300,
    },
  },
  {
    id: 'sequence_shift',
    legacyExerciseId: 'decision-sequence-shift',
    name: 'Sequence Shift',
    purpose: 'Train working-memory updating and rapid re-stabilization after rule changes.',
    primaryPillar: TaxonomyPillar.Decision,
    secondaryPillar: TaxonomyPillar.Focus,
    targetSkills: [
      TaxonomySkill.WorkingMemoryUpdating,
      TaxonomySkill.AttentionalShifting,
    ],
    pressureTypes: [PressureType.Uncertainty, PressureType.CompoundingError],
    executionTask: 'Update rules, sequences, and priorities in-flight while continuing execution.',
    coreMetric: 'update_accuracy_after_rule_change',
    supportingMetrics: ['update_latency', 'post_change_accuracy', 'invalid_sequence_recovery'],
    prescriptionRoles: [SimPrescriptionRole.SkillRep, SimPrescriptionRole.Reassessment],
    scientificBasis: 'Executive-function research on updating and shifting.',
    evidenceStatus: SimEvidenceStatus.Foundational,
    transferHypothesis: 'Athletes re-stabilize faster after assignments, patterns, or play rules change.',
    validationPlan: 'Compare against install work, audible-change drills, and coach observations after mid-rep changes.',
    recommendedDurations: {
      [DurationMode.QuickProbe]: 100,
      [DurationMode.StandardRep]: 180,
      [DurationMode.ExtendedStressTest]: 320,
    },
  },
  {
    id: 'endurance_lock',
    legacyExerciseId: 'focus-endurance-lock',
    name: 'Endurance Lock',
    purpose: 'Reveal fatigability and late-session breakdown that short reps can hide.',
    primaryPillar: TaxonomyPillar.Focus,
    secondaryPillar: TaxonomyPillar.Composure,
    targetSkills: [
      TaxonomySkill.SustainedAttention,
      TaxonomySkill.PressureStability,
    ],
    pressureTypes: [PressureType.Fatigue, PressureType.Time],
    executionTask: 'Maintain disciplined attention and choice quality as time-on-task accumulates.',
    coreMetric: 'degradation_slope_over_time',
    supportingMetrics: ['reaction_time_variability', 'lapse_rate', 'accuracy_decay'],
    prescriptionRoles: [SimPrescriptionRole.FatigabilityTest, SimPrescriptionRole.Reassessment],
    scientificBasis: 'Attention systems, concentration training, and mental-fatigue literature.',
    evidenceStatus: SimEvidenceStatus.Adjacent,
    transferHypothesis: 'Athletes preserve cleaner execution late in practice, games, and cognitively demanding sessions.',
    validationPlan: 'Compare degradation slope to late-practice error rates and coach evaluations of late-session sharpness.',
    recommendedDurations: {
      [DurationMode.QuickProbe]: 120,
      [DurationMode.StandardRep]: 240,
      [DurationMode.ExtendedStressTest]: 480,
    },
  },
];

export function getSimSpec(simId: string): SimSpec | undefined {
  return SIM_REGISTRY.find((spec) => spec.id === simId);
}

export function getSimSpecByLegacyExerciseId(exerciseId?: string | null): SimSpec | undefined {
  if (!exerciseId) return undefined;
  return SIM_REGISTRY.find((spec) => spec.legacyExerciseId === exerciseId);
}

export function clampScore(score: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(score * 10) / 10));
}

export function scoreToLabel(score: number): 'weak' | 'developing' | 'strong' {
  if (score >= 70) return 'strong';
  if (score >= 45) return 'developing';
  return 'weak';
}

export function computePillarScores(
  skillScores: Record<TaxonomySkill, number>
): Record<TaxonomyPillar, number> {
  const focusSkills = [
    TaxonomySkill.SustainedAttention,
    TaxonomySkill.SelectiveAttention,
    TaxonomySkill.AttentionalShifting,
  ];
  const composureSkills = [
    TaxonomySkill.ErrorRecoverySpeed,
    TaxonomySkill.EmotionalInterferenceControl,
    TaxonomySkill.PressureStability,
  ];
  const decisionSkills = [
    TaxonomySkill.ResponseInhibition,
    TaxonomySkill.WorkingMemoryUpdating,
    TaxonomySkill.CueDiscrimination,
  ];

  const average = (skills: TaxonomySkill[]) =>
    clampScore(skills.reduce((sum, skill) => sum + (skillScores[skill] ?? 50), 0) / skills.length);

  return {
    [TaxonomyPillar.Focus]: average(focusSkills),
    [TaxonomyPillar.Composure]: average(composureSkills),
    [TaxonomyPillar.Decision]: average(decisionSkills),
  };
}

export function rankSkills(
  skillScores: Record<TaxonomySkill, number>,
  direction: 'asc' | 'desc'
): TaxonomySkill[] {
  return [...allSkills].sort((a, b) =>
    direction === 'asc'
      ? (skillScores[a] ?? 0) - (skillScores[b] ?? 0)
      : (skillScores[b] ?? 0) - (skillScores[a] ?? 0)
  );
}
