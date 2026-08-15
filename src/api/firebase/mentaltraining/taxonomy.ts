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
  /** Plain athlete-facing description of the scored task. */
  athleteTaskDescription: string;
  /** Plain athlete-facing label for the core metric. */
  athleteMetricLabel: string;
  /** The strongest interpretation the current product may make from one session. */
  resultBoundary: string;
  measurementScope: 'task_specific_session';
  sportTransferStatus: 'requires_validation';
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
  taskEvidence?: TaxonomyTaskEvidenceSummary;
  trendSummary: string[];
  updatedAt: number;
}

export interface TaxonomyTaskEvidenceObservation {
  simId: string;
  coreMetricName: string;
  coreMetricValue: number;
  observedAt: number;
}

export interface TaxonomyTaskEvidenceSummary {
  sessionCount: number;
  usableSessionCount: number;
  excludedSessionCount: number;
  metricNames: string[];
  latestObservedAt: number | null;
  interpretation: 'task_specific_session_evidence';
  sportTransferStatus: 'requires_validation';
  observations: TaxonomyTaskEvidenceObservation[];
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
    purpose: 'Rehearse a consistent reset routine and observe task re-entry after a controlled interruption.',
    primaryPillar: TaxonomyPillar.Composure,
    secondaryPillar: TaxonomyPillar.Focus,
    targetSkills: [
      TaxonomySkill.AttentionalShifting,
    ],
    pressureTypes: [
      PressureType.Visual,
    ],
    executionTask: 'Classify the same left-or-right arrow task in matched reference and post-interruption trials, with a fixed reset interval before the post-interruption arrow.',
    coreMetric: 'post_disruption_reengagement_cost_ms',
    athleteTaskDescription: 'Match the same left-or-right arrow task after a neutral hold and after a brief interruption plus a fixed reset interval.',
    athleteMetricLabel: 'Post-interruption response-time difference',
    resultBoundary: 'This result describes response time and accuracy on the matched arrow task. Emotional recovery, readiness, resilience, and sport transfer require separate evidence.',
    measurementScope: 'task_specific_session',
    sportTransferStatus: 'requires_validation',
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
    prescriptionRoles: [
      SimPrescriptionRole.DailyProbe,
      SimPrescriptionRole.SkillRep,
      SimPrescriptionRole.PressureExposure,
      SimPrescriptionRole.Reassessment,
    ],
    scientificBasis: 'Experimental work on post-error behavior, attentional reorientation, and response caution.',
    evidenceStatus: SimEvidenceStatus.Adjacent,
    transferHypothesis: 'Practicing a reset-and-return routine may make that routine easier to use after sport disruptions; transfer must be demonstrated.',
    validationPlan: 'Establish task reliability, then compare task-specific re-entry measures with blinded video coding of sport-relevant post-error behavior.',
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
    purpose: 'Practice goal-directed visual search while salient, irrelevant cues compete for attention.',
    primaryPillar: TaxonomyPillar.Focus,
    secondaryPillar: TaxonomyPillar.Decision,
    targetSkills: [
      TaxonomySkill.SelectiveAttention,
      TaxonomySkill.CueDiscrimination,
    ],
    pressureTypes: [PressureType.Visual, PressureType.Audio],
    executionTask: 'Keep a called number visible, find its exact match in a field of similar markers, and ignore a flashing wrong marker or crowd sound.',
    coreMetric: 'distractor_cost',
    athleteTaskDescription: 'Keep the number at the top in view, find its exact match, and ignore a flashing wrong marker or crowd sound.',
    athleteMetricLabel: 'Distraction accuracy difference',
    resultBoundary: 'This result describes accuracy and response-time changes in the number-search task. General attention, readiness, and sport transfer require separate evidence.',
    measurementScope: 'task_specific_session',
    sportTransferStatus: 'requires_validation',
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
    prescriptionRoles: [SimPrescriptionRole.SkillRep, SimPrescriptionRole.PressureExposure],
    scientificBasis: 'Attentional Control Theory, visual-search inhibition training, and representative learning design.',
    evidenceStatus: SimEvidenceStatus.Adjacent,
    transferHypothesis: 'Repeated visual-search practice may reduce task-specific distraction effects; transfer to sport performance must be demonstrated.',
    validationPlan: 'Establish test-retest reliability, then compare distraction effects with coach-designed sport tasks that preserve relevant information and actions.',
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
    purpose: 'Practice withholding an initiated response when a delayed stop signal appears.',
    primaryPillar: TaxonomyPillar.Decision,
    secondaryPillar: TaxonomyPillar.Composure,
    targetSkills: [TaxonomySkill.ResponseInhibition],
    pressureTypes: [PressureType.Time, PressureType.Uncertainty],
    executionTask: 'Make fast left/right go responses, but withhold the response when a delayed stop signal appears.',
    coreMetric: 'stop_success_rate',
    athleteTaskDescription: 'Match each arrow with left or right, then withhold the response when a delayed red STOP signal appears.',
    athleteMetricLabel: 'Stop success',
    resultBoundary: 'This result describes stopping and going on the arrow task. Impulsivity, competition behavior, readiness, and sport transfer require separate evidence.',
    measurementScope: 'task_specific_session',
    sportTransferStatus: 'requires_validation',
    supportingMetrics: ['provisional_ssrt_ms', 'ssrt_estimate_available', 'go_accuracy', 'correct_go_rt_ms', 'go_omission_rate', 'go_choice_error_rate', 'mean_stop_signal_delay_ms', 'failed_stop_rt_ms', 'race_model_check_passed', 'valid_go_trials', 'valid_stop_trials'],
    prescriptionRoles: [SimPrescriptionRole.SkillRep, SimPrescriptionRole.Reassessment],
    scientificBasis: 'Independent race-model research and consensus methods for the stop-signal task.',
    evidenceStatus: SimEvidenceStatus.Adjacent,
    transferHypothesis: 'Task practice may improve performance on similar stopping tasks; reduced impulsive sport errors must be demonstrated separately.',
    validationPlan: 'Verify implementation assumptions and reliability against an established stop-signal task before testing associations with blinded sport-film coding.',
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
    purpose: 'Practice a two-alternative perceptual decision while visual evidence is brief and imperfect.',
    primaryPillar: TaxonomyPillar.Decision,
    secondaryPillar: TaxonomyPillar.Focus,
    targetSkills: [
      TaxonomySkill.CueDiscrimination,
      TaxonomySkill.SelectiveAttention,
    ],
    pressureTypes: [PressureType.Time, PressureType.Uncertainty, PressureType.Visual],
    executionTask: 'View nine arrows and choose the majority direction; response time starts when the arrow field appears.',
    coreMetric: 'decision_accuracy',
    athleteTaskDescription: 'Read a field of nine arrows and choose whether most point left or right.',
    athleteMetricLabel: 'Decision accuracy',
    resultBoundary: 'This result describes choices on the nine-arrow task. Tactical judgment, sport intelligence, readiness, and sport transfer require separate evidence.',
    measurementScope: 'task_specific_session',
    sportTransferStatus: 'requires_validation',
    supportingMetrics: ['correct_decision_rt_ms', 'wrong_choice_rate', 'timeout_rate', 'accuracy_by_evidence', 'scored_trial_count'],
    prescriptionRoles: [SimPrescriptionRole.SkillRep, SimPrescriptionRole.Reassessment],
    scientificBasis: 'Psychophysical research on sensory evidence strength, response time, and decision accuracy.',
    evidenceStatus: SimEvidenceStatus.Adjacent,
    transferHypothesis: 'Task practice may improve similar brief perceptual discriminations; sport decision transfer must be demonstrated.',
    validationPlan: 'Establish psychometric sensitivity and reliability before comparison with representative coach-graded video decision tasks.',
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
    purpose: 'Practice switching between two cued classification rules while response keys remain stable.',
    primaryPillar: TaxonomyPillar.Decision,
    secondaryPillar: TaxonomyPillar.Focus,
    targetSkills: [
      TaxonomySkill.AttentionalShifting,
    ],
    pressureTypes: [PressureType.Uncertainty, PressureType.CompoundingError],
    executionTask: 'Classify bivalent letter-number stimuli using balanced repeat and switch trials.',
    coreMetric: 'switch_rt_cost_ms',
    athleteTaskDescription: 'Use the shown letter or number rule while the left and right response keys stay in the same place.',
    athleteMetricLabel: 'Switch response-time difference',
    resultBoundary: 'This result describes switching between letter and number rules. General flexibility, working-memory capacity, readiness, and sport transfer require separate evidence.',
    measurementScope: 'task_specific_session',
    sportTransferStatus: 'requires_validation',
    supportingMetrics: ['switch_accuracy_cost', 'repeat_accuracy', 'switch_accuracy', 'perseverative_error_rate'],
    prescriptionRoles: [SimPrescriptionRole.SkillRep, SimPrescriptionRole.Reassessment],
    scientificBasis: 'Experimental task-switching research on repeat and switch costs.',
    evidenceStatus: SimEvidenceStatus.Adjacent,
    transferHypothesis: 'Task practice may improve similar cued rule switching; transfer to sport assignments or play changes must be demonstrated.',
    validationPlan: 'Establish task reliability and convergent behavior with an established task-switching paradigm before representative sport tests.',
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
    purpose: 'Observe response speed, variability, responses at or above a declared threshold, and early responses while one task remains constant over time.',
    primaryPillar: TaxonomyPillar.Focus,
    secondaryPillar: TaxonomyPillar.Composure,
    targetSkills: [
      TaxonomySkill.SustainedAttention,
    ],
    pressureTypes: [PressureType.Time],
    executionTask: 'Respond to the same visual signal across six blocks with a constant response window and variable foreperiod.',
    coreMetric: 'correct_rt_slope_ms_per_min',
    athleteTaskDescription: 'Wait for the same visual signal and tap once when it appears while the rule and response window stay constant.',
    athleteMetricLabel: 'Within-session response-time change',
    resultBoundary: 'This result describes response changes during the visual task. Fatigue, sleep loss, motivation, readiness, and sport transfer require separate evidence.',
    measurementScope: 'task_specific_session',
    sportTransferStatus: 'requires_validation',
    supportingMetrics: ['median_correct_rt_ms', 'rt_variability_ms', 'lapse_rate', 'false_start_rate', 'timeout_rate'],
    prescriptionRoles: [SimPrescriptionRole.FatigabilityTest, SimPrescriptionRole.Reassessment],
    scientificBasis: 'Psychomotor-vigilance and sustained-attention research using response-time thresholds and variability.',
    evidenceStatus: SimEvidenceStatus.Adjacent,
    transferHypothesis: 'Task practice may improve performance on similar vigilance tasks; late-practice and competition transfer must be demonstrated.',
    validationPlan: 'Establish task reliability and sensitivity while holding difficulty constant, then compare with prespecified late-practice measures.',
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

export function getSimSpecByCoreMetric(coreMetric?: string | null): SimSpec | undefined {
  if (!coreMetric) return undefined;
  return SIM_REGISTRY.find((spec) => spec.coreMetric === coreMetric);
}

export const CANONICAL_SIMULATION_CORE_METRICS = new Set(
  SIM_REGISTRY.map((spec) => spec.coreMetric)
);

export function clampScore(score: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(score * 10) / 10));
}

export function scoreToLabel(score: number): 'building' | 'developing' | 'strong' {
  if (score >= 70) return 'strong';
  if (score >= 45) return 'developing';
  return 'building';
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
