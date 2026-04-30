/**
 * Nora Mental Training System - Data Types
 * 
 * Core data models for exercises, assignments, completions, streaks, and check-ins.
 */

import type {
  DurationMode,
  PressureType,
  ProfileSnapshotMilestone,
  ProgramPrescription,
  SessionType,
  SimEvidenceStatus,
  SimPrescriptionRole,
  TaxonomyCheckInState,
  TaxonomyPillar,
  TaxonomyProfile,
  TaxonomySkill,
} from './taxonomy';

// ============================================================================
// EXERCISE TYPES
// ============================================================================

export enum ExerciseCategory {
  Breathing = 'breathing',
  Visualization = 'visualization',
  Focus = 'focus',
  Mindset = 'mindset',
  Confidence = 'confidence',
}

export enum ExerciseDifficulty {
  Beginner = 'beginner',
  Intermediate = 'intermediate',
  Advanced = 'advanced',
}

export enum BreathingPattern {
  BoxBreathing = 'box_breathing',           // 4-4-4-4
  PhysiologicalSigh = 'physiological_sigh', // Double inhale, long exhale
  FourSevenEight = '4_7_8',                 // 4-7-8 relaxation
  ArousalControl = 'arousal_control',       // Variable for activation/calming
  Recovery = 'recovery',                     // Post-competition recovery
}

export interface BreathingPhase {
  name: 'inhale' | 'hold' | 'exhale' | 'holdEmpty';
  duration: number; // seconds
  instruction: string;
}

export interface BreathingExerciseConfig {
  pattern: BreathingPattern;
  phases: BreathingPhase[];
  cycles: number;
  totalDuration: number; // seconds
}

export interface VisualizationExerciseConfig {
  prompts: string[];
  guidedAudioUrl?: string;
  imageryType: 'competition' | 'execution' | 'highlight' | 'adversity';
  duration: number; // seconds
}

export interface FocusExerciseConfig {
  type: 'single_point' | 'distraction' | 'cue_word' | 'body_scan' | 'reset';
  duration: number; // seconds
  progressionLevel: number; // 1-5
  instructions: string[];
}

export interface MindsetExerciseConfig {
  type: 'reframe' | 'growth_mindset' | 'process_focus';
  prompts: string[];
  journalRequired: boolean;
}

export interface ConfidenceExerciseConfig {
  type: 'evidence_journal' | 'inventory' | 'power_pose' | 'affirmations';
  prompts: string[];
  duration?: number;
}

export type ExerciseConfig =
  | { type: 'breathing'; config: BreathingExerciseConfig }
  | { type: 'visualization'; config: VisualizationExerciseConfig }
  | { type: 'focus'; config: FocusExerciseConfig }
  | { type: 'mindset'; config: MindsetExerciseConfig }
  | { type: 'confidence'; config: ConfidenceExerciseConfig };

export interface ExerciseOverview {
  when: string;      // When to use this exercise
  focus: string;     // What it focuses on
  timeScale: string; // How long it takes
  skill: string;     // What mental skill it builds
  analogy: string;   // Relatable analogy for understanding
}

export type SimEngineKey =
  | 'reset'
  | 'noise_gate'
  | 'brake_point'
  | 'signal_window'
  | 'sequence_shift'
  | 'endurance_lock';

export type SimBuildStatus = 'not_built' | 'built' | 'published' | 'out_of_sync' | 'build_error';
export type SimSyncStatus = 'in_sync' | 'spec_changed' | 'config_changed' | 'module_changed' | 'build_stale';

export interface SimBuildArtifact {
  engineKey: SimEngineKey;
  engineVersion: string;
  family: string;
  variantId: string;
  variantName: string;
  moduleId: string;
  sessionModel: Record<string, any>;
  stimulusModel: Record<string, any>;
  scoringModel: Record<string, any>;
  feedbackModel: Record<string, any>;
  analyticsModel: Record<string, any>;
  uiModel: Record<string, any>;
  safeguards: string[];
  sourceFingerprint: string;
}

/**
 * SimModule - A reusable simulation module template
 * Collection: sim-modules
 */
export interface MentalExercise {
  id: string;
  name: string;
  description: string;
  category: ExerciseCategory;
  difficulty: ExerciseDifficulty;
  durationMinutes: number;
  exerciseConfig: ExerciseConfig;
  benefits: string[];
  bestFor: string[]; // e.g., ['pre-competition', 'anxiety', 'focus issues']
  origin: string; // Who uses this technique — e.g., 'Navy SEALs', 'Stanford Neuroscience Lab'
  neuroscience: string; // The science behind why this works
  overview: ExerciseOverview; // Quick-glance table for athlete understanding
  iconName: string;
  isActive: boolean;
  sortOrder: number;
  simSpecId?: string;

  // ── Phase I · Daily Curriculum Layer additive fields ─────────────────────
  // Sims already carry `taxonomy.primaryPillar`; these are about
  // assignment cadence, not pillar mapping.
  /** Recommended reps in a 30-day window. Falls back to per-progression
   *  default. */
  recommendedFrequencyPer30Days?: number;
  /** Progression level — gates assignment. */
  progressionLevel?: 'foundational' | 'intermediate' | 'advanced';
  /** Per-pillar prerequisite rep counts before this sim becomes
   *  assignable. */
  prerequisitePillarReps?: Partial<Record<TaxonomyPillar, number>>;

  taxonomy?: {
    primaryPillar: TaxonomyPillar;
    secondaryPillar?: TaxonomyPillar;
    targetSkills: TaxonomySkill[];
    pressureTypes: PressureType[];
    coreMetric: string;
    supportingMetrics: string[];
    evidenceStatus: SimEvidenceStatus;
    prescriptionRoles: SimPrescriptionRole[];
    scientificBasis: string;
    transferHypothesis: string;
    validationPlan: string;
  };
  runtimeConfig?: Record<string, any>;
  engineKey?: SimEngineKey;
  buildArtifact?: SimBuildArtifact;
  syncStatus?: SimSyncStatus;
  publishedFingerprint?: string;
  variantSource?: {
    variantId: string;
    variantName: string;
    family: string;
    mode: string;
    archetype?: string;
    publishedAt?: number;
  };
  createdAt: number; // Unix timestamp
  updatedAt: number;
}

// ============================================================================
// ASSIGNMENT TYPES
// ============================================================================

export enum AssignmentStatus {
  Pending = 'pending',
  InProgress = 'in_progress',
  Completed = 'completed',
  Skipped = 'skipped',
  Expired = 'expired',
}

export enum AssignmentSource {
  Coach = 'coach',
  Nora = 'nora',       // AI-assigned based on mental notes
  SelfSelected = 'self',
  Program = 'program', // Part of a structured program
}

/**
 * ExerciseAssignment - A sim assignment delivered to an athlete
 * Collection: sim-assignments
 */
export interface ExerciseAssignment {
  id: string;
  athleteUserId: string;
  exerciseId: string;
  exercise?: MentalExercise; // Denormalized for quick access

  // Assignment details
  source: AssignmentSource;
  assignedBy?: string; // Coach ID or 'nora' or 'self'
  assignedByName?: string;
  reason?: string; // Why this was assigned
  profileSnapshotMilestone?: Extract<ProfileSnapshotMilestone, 'midpoint' | 'endpoint' | 'retention'>;

  // Scheduling
  dueDate?: number; // Unix timestamp
  scheduledTime?: string; // e.g., 'morning', 'pre-workout', 'evening'
  isRecurring: boolean;
  recurringPattern?: 'daily' | 'weekdays' | 'custom';
  recurringDays?: number[]; // 0-6, Sunday-Saturday

  // Status
  status: AssignmentStatus;
  completedAt?: number;
  skippedAt?: number;
  skippedReason?: string;

  // Metadata
  createdAt: number;
  updatedAt: number;
}

// ============================================================================
// COMPLETION TYPES
// ============================================================================

/**
 * ExerciseCompletion - Record of a completed sim module
 * Collection: sim-completions/{userId}/completions
 */
export interface SessionProgramUpdateSummary {
  completedActionLabel: string;
  previousActionLabel?: string;
  nextActionLabel: string;
  athleteHeadline: string;
  athleteBody: string;
  coachHeadline: string;
  coachBody: string;
  nextRationale?: string;
  targetSkills: string[];
  moodDelta?: number;
  programChanged: boolean;
  generatedAt: number;
}

export interface ExerciseCompletion {
  id: string;
  userId: string;
  exerciseId: string;
  exerciseName: string;
  exerciseCategory: ExerciseCategory;
  assignmentId?: string; // If completed from an assignment
  dailyAssignmentId?: string; // If completed from a Nora daily assignment

  // Completion details
  completedAt: number;
  durationSeconds: number;

  // Self-assessment
  preExerciseMood?: number; // 1-10
  postExerciseMood?: number; // 1-10
  difficultyRating?: number; // 1-5
  helpfulnessRating?: number; // 1-5
  notes?: string;

  // Context
  context?: 'morning' | 'pre-workout' | 'post-workout' | 'evening' | 'competition';
  sessionSummary?: SessionProgramUpdateSummary;

  createdAt: number;
}

// ============================================================================
// GAME LEVEL PROGRESS TYPES
// ============================================================================

/**
 * TierSessionRecord — Record of a single session at a specific tier
 * Used to track qualifying sessions for tier advancement
 */
export interface TierSessionRecord {
  sessionDate: number;
  tier: number;
  avgRecoveryTime: number;
  consistencyIndex: number;      // standard deviation of recovery times
  resilienceScore: number;       // accuracy post-disruption vs pre-disruption (0-100)
  metTarget: boolean;            // was recovery under the tier's target?
  roundCount: number;
}

/**
 * GameLevelProgress — Per-user, per-game level/tier progression
 * Collection: game-level-progress/{userId}/games/{gameType}
 * 
 * This is game-agnostic infrastructure — any game with tiers/levels stores
 * its progression data here. The gameType string identifies which game.
 */
export interface GameLevelProgress {
  userId: string;
  gameType: string;                    // 'reset', etc.
  currentTier: number;                 // 1-4 (tier number)
  tierHistory: TierSessionRecord[];    // last N sessions at current tier (keep last 10)
  totalSessions: number;
  bestAvgRecoveryTime?: number;        // personal best across all sessions
  lastPlayedAt: number;
  unlockedTiers: number[];             // e.g. [1] → [1,2] → [1,2,3] → [1,2,3,4]
  createdAt: number;
  updatedAt: number;
}

/**
 * Advancement check result
 */
export interface TierAdvancementResult {
  canAdvance: boolean;
  nextTier: number | null;
  qualifyingSessions: number;          // how many of last 3 qualify
  requiredSessions: number;            // always 3
  metTargetCount: number;
  consistencyCount: number;
  resilienceCount: number;
  reasons: string[];                   // human-readable reasons for not advancing
}

// ============================================================================
// STREAK & PROGRESS TYPES
// ============================================================================


/**
 * MentalTrainingStreak - User's streak and progress data
 * Collection: mental-training-streaks/{userId}
 */
export interface MentalTrainingStreak {
  userId: string;

  // Streaks
  currentStreak: number;
  longestStreak: number;
  lastActivityDate: string; // YYYY-MM-DD format for easy comparison

  // Totals
  totalExercisesCompleted: number;
  totalMinutesTrained: number;

  // Category breakdown
  categoryCompletions: {
    [key in ExerciseCategory]?: number;
  };

  // Achievements
  achievements: Achievement[];

  // Weekly stats (rolling 7 days)
  weeklyCompletions: number;
  weeklyMinutes: number;

  updatedAt: number;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  iconName: string;
  unlockedAt: number;
  category?: ExerciseCategory;
}

// ============================================================================
// CHECK-IN TYPES
// ============================================================================

export enum CheckInType {
  Morning = 'morning',
  PreWorkout = 'pre_workout',
  PostWorkout = 'post_workout',
  Evening = 'evening',
  Competition = 'competition',
}

/**
 * MentalCheckIn - Daily/scheduled mental state check-ins
 * Collection: mental-check-ins/{userId}/check-ins
 */
export interface MentalCheckIn {
  id: string;
  userId: string;
  type: CheckInType;

  // Responses
  readinessScore: number; // 1-5
  moodWord?: string; // Single word describing mindset
  energyLevel?: number; // 1-5
  stressLevel?: number; // 1-5
  sleepQuality?: number; // 1-5 (for morning check-ins)

  // Optional notes
  notes?: string;

  // Follow-up
  suggestedExerciseId?: string;
  exerciseCompleted?: boolean;
  taxonomyState?: TaxonomyCheckInState;
  timezone?: string;

  createdAt: number;
  date: string; // YYYY-MM-DD for grouping
}

export interface SubmitPulseCheckCheckInInput {
  userId: string;
  type: CheckInType;
  readinessScore: number;
  moodWord?: string;
  energyLevel?: number;
  stressLevel?: number;
  sleepQuality?: number;
  notes?: string;
  taxonomyState?: TaxonomyCheckInState;
  sourceDate?: string;
  timezone?: string;
}

// ============================================================================
// PROGRAM TYPES (Future)
// ============================================================================

export enum ProgramStatus {
  NotStarted = 'not_started',
  InProgress = 'in_progress',
  Completed = 'completed',
  Paused = 'paused',
}

/**
 * MentalTrainingProgram - Structured multi-week program
 * Collection: mental-training-programs
 */
export interface MentalTrainingProgram {
  id: string;
  name: string;
  description: string;
  durationWeeks: number;
  difficulty: ExerciseDifficulty;
  targetGoals: string[]; // e.g., ['pressure performance', 'confidence']

  // Weekly structure
  weeks: ProgramWeek[];

  isActive: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface ProgramWeek {
  weekNumber: number;
  theme: string;
  description: string;
  dailyExercises: {
    dayOfWeek: number; // 0-6
    exerciseIds: string[];
    isRestDay: boolean;
  }[];
}

/**
 * UserProgramEnrollment - User's enrollment in a program
 * Collection: mental-program-enrollments/{userId}/enrollments
 */
export interface UserProgramEnrollment {
  id: string;
  userId: string;
  programId: string;
  programName: string;

  status: ProgramStatus;
  startDate: string; // YYYY-MM-DD
  currentWeek: number;
  currentDay: number;

  // Progress
  completedExercises: number;
  totalExercises: number;
  completionPercentage: number;

  createdAt: number;
  updatedAt: number;
}

// ============================================================================
// CURRICULUM TYPES (14-Day Assignment Cycle)
// ============================================================================

/**
 * Mental training pathways based on athlete's primary challenge
 */
export enum MentalPathway {
  Foundation = 'foundation',           // Universal starting point
  ArousalMastery = 'arousal_mastery', // For anxiety/energy management
  FocusMastery = 'focus_mastery',     // For concentration issues
  ConfidenceResilience = 'confidence_resilience', // For belief/bouncing back
  PressurePerformance = 'pressure_performance', // For underperforming under pressure
  EliteRefinement = 'elite_refinement', // For MPR 8+ athletes
}

/**
 * Status of a curriculum assignment (14-day cycle)
 */
export enum CurriculumAssignmentStatus {
  Active = 'active',
  Extended = 'extended',   // Below 80%, extended 7 more days
  Completed = 'completed', // Mastery achieved
  Paused = 'paused',      // Temporarily stopped
}

/**
 * Confidence level for Nora's recommendations
 */
export enum RecommendationConfidence {
  High = 'high',     // Clear pattern, proven intervention
  Medium = 'medium', // Some indicators, worth trying
  Low = 'low',       // Limited data, coach judgment needed
}

/**
 * Status of a recommendation
 */
export enum RecommendationStatus {
  Pending = 'pending',
  Accepted = 'accepted',
  Modified = 'modified',
  Dismissed = 'dismissed',
}

/**
 * Baseline assessment biggest challenge options
 */
export enum BiggestChallenge {
  PreCompetitionAnxiety = 'pre_competition_anxiety',
  FocusDuringCompetition = 'focus_during_competition',
  ConfidenceInAbilities = 'confidence_in_abilities',
  BouncingBackFromSetbacks = 'bouncing_back_from_setbacks',
  PerformingUnderPressure = 'performing_under_pressure',
  Other = 'other',
}

/**
 * Baseline Assessment - Initial mental training quiz
 * Part of athlete-mental-progress document
 */
export interface BaselineAssessment {
  // Section 1: Current Mental Training
  mentalTrainingExperience: 'never' | 'self_tried' | 'worked_with_professional' | 'consistent_6_months';
  currentPracticeFrequency: 'never' | 'occasionally_when_stressed' | 'weekly' | 'daily';

  // Section 2: Self-Assessment by Domain (1-5)
  arousalControlRating: number;
  focusRating: number;
  confidenceRating: number;
  visualizationRating: number;
  resilienceRating: number;

  // Section 3: Pressure Response
  pressureResponse: 'freeze_perform_worse' | 'anxious_push_through' | 'same_as_training' | 'rise_to_occasion';
  setbackRecovery: 'dwell_for_days' | 'struggle_same_day' | 'move_on_after_time' | 'let_go_immediately';

  // Section 4: Goals
  biggestChallenge: BiggestChallenge;
  biggestChallengeOther?: string;

  // Metadata
  completedAt: number;
}

export interface BaselineProbe {
  completedAt?: number | { seconds?: number; nanoseconds?: number; toMillis?: () => number } | null;
  composureRecoveryMs?: number;
  composureConsistency?: number;
  focusAccuracy?: number;
  focusDistractorCost?: number;
  decisionAccuracy?: number;
  decisionFalseStarts?: number;
  sessionType?: string;
}

/**
 * MentalRecommendation - Nora's exercise recommendation for an athlete
 * Collection: mental-recommendations
 */
export interface MentalRecommendation {
  id: string;
  athleteId: string;
  coachId: string;
  exerciseId: string;
  exercise?: MentalExercise; // Denormalized
  programRecommendation?: ProgramPrescription;

  // Recommendation details
  reason: string;
  confidence: RecommendationConfidence;
  pathway: MentalPathway;
  pathwayStep: number; // Position in pathway sequence

  // Trigger info
  triggerType: 'assessment_complete' | 'assignment_complete' | 'manual_request' | 'intervention' | 'competition_prep';
  previousAssignmentId?: string; // If triggered by completion

  // Status
  status: RecommendationStatus;
  coachOverrideReason?: string; // If coach modified/dismissed

  createdAt: number;
  updatedAt: number;
}

/**
 * DailyCompletion - Record of daily exercise completion
 * Subcollection: mental-curriculum-assignments/{assignmentId}/daily-completions
 */
export interface DailyCompletion {
  id: string; // YYYY-MM-DD format
  date: string; // YYYY-MM-DD
  completed: boolean;
  completionCount: number; // How many times completed that day
  targetCount: number; // Required completions per day

  // Completion records
  completions: {
    completedAt: number;
    durationSeconds: number;
    postMood?: number; // 1-5
  }[];

  createdAt: number;
  updatedAt: number;
}

/**
 * CurriculumAssignment - Enhanced 14-day exercise assignment
 * Collection: mental-curriculum-assignments
 */
export interface CurriculumAssignment {
  id: string;
  athleteId: string;
  coachId: string;
  exerciseId: string;
  exercise?: MentalExercise; // Denormalized
  simSpecId?: string;

  // Source tracking
  recommendationId?: string; // If created from a recommendation
  source: AssignmentSource;

  // Curriculum tracking
  durationDays: number; // Default 14
  frequency: number; // Times per day (default 1-2)
  startDate: number; // Unix timestamp
  endDate: number; // Unix timestamp (startDate + durationDays)

  // Progress (updated from daily-completions subcollection)
  completedDays: number;
  targetDays: number; // = durationDays
  completionRate: number; // 0-100
  currentDayNumber: number; // 1-14

  // Status
  status: CurriculumAssignmentStatus;
  masteryAchieved: boolean;
  extendedCount: number; // How many times extended

  // Coach note
  coachNote?: string;

  // Reminder settings
  reminderEnabled: boolean;
  reminderTimes: string[]; // ['08:00', '20:00']

  // Pathway info
  pathway: MentalPathway;
  pathwayStep: number;

  createdAt: number;
  updatedAt: number;
}

export enum PulseCheckDailyAssignmentStatus {
  Assigned = 'assigned',
  Viewed = 'viewed',
  Started = 'started',
  Paused = 'paused',
  Completed = 'completed',
  Overridden = 'overridden',
  Deferred = 'deferred',
  Superseded = 'superseded',
  Expired = 'expired',
}

export type PulseCheckDailyAssignmentActionType = 'sim' | 'lighter_sim' | 'protocol' | 'defer';
export type PulseCheckAssignmentEventType =
  | 'daily_task_materialized'
  | 'daily_task_superseded'
  | 'training_plan_authored'
  | 'training_plan_superseded'
  | 'training_plan_completed'
  | 'training_plan_paused'
  | 'training_plan_resumed'
  | 'training_plan_authoring_failed'
  | 'training_plan_step_authored'
  | 'viewed'
  | 'started'
  | 'paused'
  | 'resumed'
  | 'completed'
  | 'deferred'
  | 'overridden'
  | 'expired'
  | 'plan_step_activated'
  | 'plan_step_completed'
  | 'plan_step_overridden';
export type PulseCheckAssignmentEventActorType = 'athlete' | 'coach' | 'staff' | 'system';
export type PulseCheckStateConfidence = 'high' | 'medium' | 'low';
export type PulseCheckStateFreshness = 'current' | 'degraded' | 'refresh_required';
export type PulseCheckOverallReadiness = 'green' | 'yellow' | 'red';
export type PulseCheckAssignmentCandidateType = 'sim' | 'protocol' | 'trial';
export type PulseCheckDecisionSource = 'ai' | 'fallback_rules';
export type PulseCheckProtocolClass = 'regulation' | 'priming' | 'recovery' | 'none';
export type PulseCheckProtocolPublishStatus = 'draft' | 'published' | 'archived';
export type PulseCheckProtocolFamilyStatus = 'candidate' | 'locked';
export type PulseCheckProtocolGovernanceStage =
  | 'nominated'
  | 'structured'
  | 'sandbox'
  | 'pilot'
  | 'published'
  | 'restricted'
  | 'archived';
export type PulseCheckProtocolResponseFamily =
  | 'acute_downshift'
  | 'steady_regulation'
  | 'activation_upshift'
  | 'focus_narrowing'
  | 'confidence_priming'
  | 'imagery_priming'
  | 'recovery_downregulation'
  | 'recovery_reflection'
  | 'cognitive_reframe';
export type PulseCheckProtocolDeliveryMode =
  | 'guided_breathing'
  | 'guided_focus'
  | 'guided_imagery'
  | 'guided_reframe'
  | 'guided_reflection'
  | 'embodied_reset';
export type PulseCheckProtocolHistoryAction =
  | 'created'
  | 'saved'
  | 'published'
  | 'archived'
  | 'seeded';
export type PulseCheckProtocolReviewStatus = 'not_started' | 'in_review' | 'approved' | 'blocked';
export type PulseCheckProtocolEvidenceStatus = 'insufficient' | 'developing' | 'credible' | 'watch';
export type PulseCheckProtocolReviewGateStatus = 'pending' | 'passed' | 'blocked';
export type PulseCheckRoutingRecommendation =
  | 'protocol_only'
  | 'sim_only'
  | 'trial_only'
  | 'protocol_then_sim'
  | 'sim_then_protocol'
  | 'defer_alternate_path';

export interface PulseCheckProtocolReviewGate {
  key: string;
  label: string;
  status: PulseCheckProtocolReviewGateStatus;
  note?: string;
}

export interface PulseCheckProtocolEvidenceSummary {
  sampleSize: number;
  positiveSignals: number;
  neutralSignals: number;
  negativeSignals: number;
  responseDirection: 'positive' | 'neutral' | 'negative' | 'mixed';
  confidence: PulseCheckStateConfidence;
  lastObservedAt?: number;
  freshness?: PulseCheckProtocolEvidenceFreshness;
  downstreamImpact?: PulseCheckProtocolDownstreamImpactSummary;
  explanation?: string;
}

export interface PulseCheckProtocolEvidenceFreshness {
  freshness: PulseCheckStateFreshness;
  lastObservedAt?: number;
  lastConfirmedAt?: number;
  ageDays?: number;
  staleAt?: number;
  explanation?: string;
}

export interface PulseCheckProtocolDownstreamImpactSummary {
  sampleSize: number;
  positiveSignals: number;
  neutralSignals: number;
  negativeSignals: number;
  responseDirection: 'positive' | 'neutral' | 'negative' | 'mixed';
  confidence: PulseCheckStateConfidence;
  lastObservedAt?: number;
  lastConfirmedAt?: number;
  explanation?: string;
}

export interface PulseCheckProtocolResponsivenessSummary {
  protocolFamilyId?: string;
  protocolFamilyLabel?: string;
  variantId?: string;
  variantLabel?: string;
  protocolClass?: Exclude<PulseCheckProtocolClass, 'none'>;
  responseFamily?: PulseCheckProtocolResponseFamily;
  responseDirection: 'positive' | 'neutral' | 'negative' | 'mixed';
  confidence: PulseCheckStateConfidence;
  freshness: PulseCheckStateFreshness;
  sampleSize: number;
  positiveSignals: number;
  neutralSignals: number;
  negativeSignals: number;
  stateFit: string[];
  supportingEvidence: string[];
  lastObservedAt?: number;
  lastConfirmedAt?: number;
}

export interface PulseCheckProtocolResponsivenessProfile {
  id: string;
  athleteId: string;
  familyResponses: Record<string, PulseCheckProtocolResponsivenessSummary>;
  variantResponses: Record<string, PulseCheckProtocolResponsivenessSummary>;
  sourceEventIds: string[];
  staleAt: number;
  lastUpdatedAt: number;
  createdAt: number;
  updatedAt: number;
}

export interface PulseCheckProtocolFamily {
  id: string;
  label: string;
  protocolClass: Exclude<PulseCheckProtocolClass, 'none'>;
  responseFamily: PulseCheckProtocolResponseFamily;
  familyStatus: PulseCheckProtocolFamilyStatus;
  governanceStage: PulseCheckProtocolGovernanceStage;
  mechanismSummary: string;
  targetBottleneck: string;
  expectedStateShift: string;
  useWindowTags: string[];
  avoidWindowTags: string[];
  contraindicationTags: string[];
  evidenceSummary?: string;
  sourceReferences: string[];
  reviewNotes?: string;
  reviewStatus: PulseCheckProtocolReviewStatus;
  reviewChecklist: PulseCheckProtocolReviewGate[];
  evidenceStatus: PulseCheckProtocolEvidenceStatus;
  evidencePanel?: PulseCheckProtocolEvidenceSummary;
  reviewCadenceDays: number;
  lastReviewedAt?: number;
  nextReviewAt?: number;
  createdAt: number;
  updatedAt: number;
}

export interface PulseCheckProtocolVariant {
  id: string;
  familyId: string;
  label: string;
  variantKey: string;
  variantVersion: string;
  category: ExerciseCategory;
  deliveryMode: PulseCheckProtocolDeliveryMode;
  legacyExerciseId: string;
  rationale: string;
  scriptSummary: string;
  durationSeconds: number;
  triggerTags: string[];
  preferredContextTags: string[];
  useWindowTags: string[];
  avoidWindowTags: string[];
  contraindicationTags: string[];
  evidenceSummary?: string;
  sourceReferences: string[];
  reviewNotes?: string;
  approvalStatus: PulseCheckProtocolReviewStatus;
  reviewChecklist: PulseCheckProtocolReviewGate[];
  evidenceStatus: PulseCheckProtocolEvidenceStatus;
  evidencePanel?: PulseCheckProtocolEvidenceSummary;
  reviewCadenceDays: number;
  lastReviewedAt?: number;
  nextReviewAt?: number;
  governanceStage: PulseCheckProtocolGovernanceStage;
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface PulseCheckProtocolDefinition {
  id: string;
  label: string;
  familyId: string;
  familyLabel: string;
  familyStatus: PulseCheckProtocolFamilyStatus;
  variantId: string;
  variantKey: string;
  variantLabel: string;
  variantVersion: string;
  publishedRevisionId?: string;
  governanceStage: PulseCheckProtocolGovernanceStage;
  legacyExerciseId: string;
  protocolClass: Exclude<PulseCheckProtocolClass, 'none'>;
  category: ExerciseCategory;
  responseFamily: PulseCheckProtocolResponseFamily;
  deliveryMode: PulseCheckProtocolDeliveryMode;
  triggerTags: string[];
  preferredContextTags: string[];
  useWindowTags: string[];
  avoidWindowTags: string[];
  contraindicationTags: string[];
  rationale: string;
  mechanism: string;
  expectedStateShift: string;
  reviewNotes?: string;
  evidenceSummary?: string;
  durationSeconds: number;
  sortOrder: number;
  publishStatus: PulseCheckProtocolPublishStatus;
  isActive: boolean;
  reviewStatus: PulseCheckProtocolReviewStatus;
  reviewChecklist: PulseCheckProtocolReviewGate[];
  evidenceStatus: PulseCheckProtocolEvidenceStatus;
  evidencePanel?: PulseCheckProtocolEvidenceSummary;
  reviewCadenceDays: number;
  lastReviewedAt?: number;
  nextReviewAt?: number;
  publishedAt?: number;
  archivedAt?: number;
  createdAt: number;
  updatedAt: number;

  // ── Phase I · Daily Curriculum Layer additive fields ─────────────────────
  // Optional today; the daily-assignment generator falls back to safe
  // defaults when absent, so existing protocol docs continue to work.
  // Admin UI (/admin/curriculumLayer) lets operators fill these in.
  /** Cognitive pillar this protocol trains. Drives pillar-balance
   *  selection in the daily generator. */
  cognitivePillar?: TaxonomyPillar;
  /** Recommended reps in a 30-day window. Falls back to a per-progression
   *  default (see DEFAULT_FREQUENCY_PER_30_DAYS in dailyCurriculum/types.ts). */
  recommendedFrequencyPer30Days?: number;
  /** Progression level — gates assignment. Foundational protocols are
   *  free to assign; intermediate/advanced require prerequisitePillarReps. */
  progressionLevel?: 'foundational' | 'intermediate' | 'advanced';
  /** Per-pillar prerequisite rep counts before this protocol becomes
   *  assignable. Only meaningful for intermediate + advanced. */
  prerequisitePillarReps?: Partial<Record<TaxonomyPillar, number>>;
}

export interface PulseCheckProtocolHistoryEntry {
  id: string;
  protocolId: string;
  action: PulseCheckProtocolHistoryAction;
  summary: string;
  createdAt: number;
  snapshot: PulseCheckProtocolDefinition;
}

export interface PulseCheckProtocolFamilyHistoryEntry {
  id: string;
  familyId: string;
  action: Exclude<PulseCheckProtocolHistoryAction, 'published' | 'archived'>;
  summary: string;
  createdAt: number;
  snapshot: PulseCheckProtocolFamily;
}

export interface PulseCheckProtocolVariantHistoryEntry {
  id: string;
  variantId: string;
  action: Exclude<PulseCheckProtocolHistoryAction, 'published' | 'archived'>;
  summary: string;
  createdAt: number;
  snapshot: PulseCheckProtocolVariant;
}

export interface PulseCheckStateDimensions {
  activation: number;
  focusReadiness: number;
  emotionalLoad: number;
  cognitiveFatigue: number;
}

export interface PulseCheckRawSignalSummary {
  explicitSelfReport: {
    readinessScore: number;
    moodWord?: string;
    energyLevel?: number;
    stressLevel?: number;
    sleepQuality?: number;
    notes?: string;
  };
  activeProgramContext?: {
    sessionType?: SessionType;
    durationMode?: DurationMode;
    recommendedSimId?: string;
    recommendedLegacyExerciseId?: string;
  };
  normalizedReadinessScore?: number;
  signalCount: number;
  contradictionFlags: string[];
}

export interface PulseCheckEnrichedInterpretation {
  summary: string;
  likelyPrimaryFactor:
    | 'activation'
    | 'focus_readiness'
    | 'emotional_load'
    | 'cognitive_fatigue'
    | 'mixed';
  supportingSignals: string[];
  contradictions: string[];
  plannerNotes: string[];
  confidenceRationale?: string;
  supportFlag?: boolean;
  modelSource: PulseCheckDecisionSource;
}

export interface PulseCheckAssignmentCandidate {
  id: string;
  type: PulseCheckAssignmentCandidateType;
  label: string;
  actionType: PulseCheckDailyAssignmentActionType;
  rationale: string;
  simSpecId?: string;
  legacyExerciseId?: string;
  protocolId?: string;
  protocolFamilyId?: string;
  protocolVariantId?: string;
  protocolVariantLabel?: string;
  protocolVariantVersion?: string;
  protocolPublishedAt?: number;
  protocolPublishedRevisionId?: string;
  protocolLabel?: string;
  protocolClass?: PulseCheckProtocolClass;
  protocolCategory?: ExerciseCategory;
  protocolResponseFamily?: PulseCheckProtocolResponseFamily;
  protocolDeliveryMode?: PulseCheckProtocolDeliveryMode;
  responsivenessDirection?: PulseCheckProtocolResponsivenessSummary['responseDirection'];
  responsivenessConfidence?: PulseCheckStateConfidence;
  responsivenessFreshness?: PulseCheckStateFreshness;
  responsivenessSummary?: string;
  responsivenessStateFit?: string[];
  executionPattern?: PulseCheckDailyTaskExecutionPattern;
  trainingPlanId?: string | null;
  trainingPlanStepId?: string | null;
  trainingPlanStepIndex?: number | null;
  sessionType?: SessionType;
  durationMode?: DurationMode;
  durationSeconds?: number;
}

export interface PulseCheckAssignmentCandidateSet {
  id: string;
  athleteId: string;
  sourceDate: string;
  sourceStateSnapshotId: string;
  trainingPlanId?: string | null;
  trainingPlanStepId?: string | null;
  trainingPlanStepIndex?: number | null;
  planDrivenCandidateId?: string | null;
  candidates: PulseCheckAssignmentCandidate[];
  candidateIds: string[];
  candidateClassHints: PulseCheckAssignmentCandidateType[];
  constraintReasons: string[];
  inventoryGaps: string[];
  plannerEligible: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface PulseCheckAssignmentPlannerDecision {
  decisionSource: PulseCheckDecisionSource;
  selectedCandidateId?: string;
  selectedCandidateType?: PulseCheckAssignmentCandidateType;
  actionType: PulseCheckDailyAssignmentActionType;
  confidence: PulseCheckStateConfidence;
  rationaleSummary: string;
  supportFlag: boolean;
}

export interface PulseCheckPlannerAuditCandidate {
  candidateId: string;
  label: string;
  type: PulseCheckAssignmentCandidateType;
  actionType: PulseCheckDailyAssignmentActionType;
  rationale: string;
  selected?: boolean;
  protocolId?: string;
  protocolFamilyId?: string;
  protocolVariantId?: string;
  protocolVariantLabel?: string;
  protocolVariantVersion?: string;
  protocolPublishedAt?: number;
  protocolPublishedRevisionId?: string;
  responsivenessDirection?: PulseCheckProtocolResponsivenessSummary['responseDirection'];
  responsivenessConfidence?: PulseCheckStateConfidence;
  responsivenessFreshness?: PulseCheckStateFreshness;
  responsivenessSummary?: string;
}

export interface PulseCheckPlannerAudit {
  generatedAt: number;
  stateConfidence: PulseCheckStateConfidence;
  responsivenessApplied: boolean;
  selectedCandidateId?: string;
  rankedCandidates: PulseCheckPlannerAuditCandidate[];
}

export type PulseCheckProtocolPracticeInputMode = 'text' | 'voice' | 'mixed';

export interface PulseCheckProtocolPracticeVoiceSignals {
  responseDurationMs?: number;
  transcriptConfidence?: number;
  confidenceQualified?: boolean;
  wordsPerMinute?: number;
  confidenceExplanation?: string;
}

export interface PulseCheckProtocolPracticeDimensionScores {
  signalAwareness: number;
  techniqueFidelity: number;
  languageQuality: number;
  shiftQuality: number;
  coachability: number;
}

export interface PulseCheckProtocolPracticeTurn {
  id: string;
  promptId: string;
  promptLabel?: string;
  promptText: string;
  responseText: string;
  modality: 'text' | 'voice';
  followUpPromptId?: string;
  followUpPromptText?: string;
  usedAdaptiveFollowUp?: boolean;
  transcriptReviewed?: boolean;
  voiceSignals?: PulseCheckProtocolPracticeVoiceSignals;
  scores: PulseCheckProtocolPracticeDimensionScores;
  strengths: string[];
  misses: string[];
  noraFeedback: string;
  evaluationSource?: 'ai' | 'heuristic';
  evaluationModel?: string;
  evaluationLatencyMs?: number;
  submittedAt: number;
}

export interface PulseCheckProtocolPracticeScorecard {
  overallScore: number;
  dimensionScores: PulseCheckProtocolPracticeDimensionScores;
  strengths: string[];
  improvementAreas: string[];
  evaluationSummary: string;
  nextRepFocus: string;
  coachabilityTrend: 'improving' | 'steady' | 'needs_support';
  voiceSignalsSummary?: string;
  evaluationSource?: 'ai' | 'heuristic';
  evaluationModel?: string;
  evaluationLatencyMs?: number;
}

export interface PulseCheckProtocolPracticeSession {
  specId: string;
  specVersion: string;
  protocolId?: string;
  protocolFamilyId?: string;
  protocolVariantId?: string;
  inputModesAllowed: PulseCheckProtocolPracticeInputMode[];
  inputModeUsed?: PulseCheckProtocolPracticeInputMode;
  teachCompletedAt?: number;
  practiceStartedAt?: number;
  completedAt?: number;
  transcriptReviewEnabled: boolean;
  transcriptReviewUsed: boolean;
  adaptiveFollowUpsUsed: number;
  turns: PulseCheckProtocolPracticeTurn[];
  scorecard?: PulseCheckProtocolPracticeScorecard;
}

export type PulseCheckDailyTaskMaterializedBy = 'nora_runtime' | 'coach_manual' | 'system_scheduled';
export type PulseCheckDailyTaskSourceDateMode = 'athlete_local_day' | 'calendar_day' | 'manual_override';
export type PulseCheckDailyTaskExecutionPattern = 'single' | 'protocol_then_sim' | 'sim_then_protocol';
export type PulseCheckTrainingPlanStatus = 'active' | 'paused' | 'completed' | 'superseded';
export type PulseCheckTrainingPlanType = 'sim_focused' | 'protocol_focused' | 'mixed' | 'assessment';
export type PulseCheckTrainingPlanProgressMode = 'days' | 'sessions' | 'open_ended';
export type PulseCheckTrainingPlanAssignedBy = 'nora' | 'coach' | 'system';
export type PulseCheckTrainingPlanAuthoringTrigger =
  | 'baseline_complete'
  | 'exploratory_window_complete'
  | 'plan_completed'
  | 'significant_profile_change'
  | 'coach_manual';
export type PulseCheckPlanStepStatus = 'planned' | 'active_today' | 'completed' | 'deferred' | 'overridden' | 'skipped' | 'superseded';

export interface PulseCheckMetricSummary {
  key: string;
  label: string;
  value: string | number;
  unit?: string;
  detail?: string;
  trend?: 'up' | 'down' | 'flat' | 'mixed';
}

export interface PulseCheckDailyTaskPhaseProgress {
  currentPhaseIndex: number;
  totalPhases: number;
  currentPhaseLabel?: string;
  phaseLabels?: string[];
}

export interface PulseCheckDailyTaskCompletionSummary {
  primaryMetric?: PulseCheckMetricSummary;
  secondaryMetrics?: PulseCheckMetricSummary[];
  noraTakeaway?: string;
  followUpPrompt?: string;
  durationSeconds?: number;
  phaseProgress?: PulseCheckDailyTaskPhaseProgress;
  resultNotes?: string;
}

export interface PulseCheckDailyTaskOverrideMetadata {
  overrideType?: 'state_based_adjustment' | 'coach_manual' | 'inventory_gap' | 'safety' | 'program_update';
  overriddenBy?: string;
  overriddenByRole?: PulseCheckAssignmentEventActorType;
  overrideReason?: string;
  originalAssignmentId?: string;
  originalActionType?: PulseCheckDailyAssignmentActionType;
  originalTrainingPlanId?: string;
  originalPlanStepId?: string;
  originalPlanStepIndex?: number;
}

export interface PulseCheckDailyTaskExecutionLock {
  coachFrozen?: boolean; // Execution-lock metadata lives on the task record, not the plan record.
  lockedAt?: number;
  lockedBy?: string;
  lockedByRole?: PulseCheckAssignmentEventActorType;
  lockReason?: string;
}

export interface PulseCheckPlanStepResultSummary {
  primaryMetric?: PulseCheckMetricSummary;
  secondaryMetrics?: PulseCheckMetricSummary[];
  noraTakeaway?: string;
  followUpPrompt?: string;
  completedAt?: number;
}

export interface PulseCheckPlanStep {
  id: string;
  stepIndex: number;
  stepLabel: string;
  stepStatus: PulseCheckPlanStepStatus;
  actionType: PulseCheckDailyAssignmentActionType;
  exerciseId: string;
  simSpecId?: string;
  protocolId?: string;
  protocolClass?: PulseCheckProtocolClass;
  executionPattern?: PulseCheckDailyTaskExecutionPattern;
  targetSkills?: TaxonomySkill[];
  archetypeStepKey?: string;
  linkedDailyTaskId?: string;
  linkedDailyTaskSourceDate?: string;
  overrideReason?: string;
  resultSummary?: PulseCheckPlanStepResultSummary;
  plannedDurationSeconds?: number;
  startedAt?: number;
  completedAt?: number;
  skippedAt?: number;
  dueSourceDate?: string;
  timezone?: string;
}

export interface PulseCheckTrainingPlan {
  id: string;
  athleteId: string;
  title: string;
  goal: string;
  planType: PulseCheckTrainingPlanType;
  status: PulseCheckTrainingPlanStatus;
  isPrimary: boolean; // Exactly one active plan per athlete should be primary.
  progressMode: PulseCheckTrainingPlanProgressMode;
  targetCount: number | null;
  completedCount: number;
  steps: PulseCheckPlanStep[];
  assignedBy: PulseCheckTrainingPlanAssignedBy;
  coachId?: string;
  targetSkills?: TaxonomySkill[];
  authoringTrigger?: PulseCheckTrainingPlanAuthoringTrigger;
  authoringFocusSkill?: TaxonomySkill | null;
  archetypeId?: string | null;
  archetypeVersion?: string | null;
  authoringRulesVersion?: string | null;
  sourceStateSnapshotId?: string;
  sourceProfileSnapshotId?: string | null;
  sourceProgramPrescriptionId?: string | null;
  sourceProgramGeneratedAt?: number | null;
  sourceDailyTaskId?: string;
  primaryPlanId?: string; // Secondary coach work can point back to the primary plan it accompanies.
  sourceDate?: string;
  timezone?: string;
  startDate?: string | null;
  endDate?: string | null;
  cadence?: string | null;
  primaryPlanMetric?: string | null;
  latestResultSummary?: string | null;
  latestResultAt?: number | null;
  nextDueStepIndex?: number | null;
  currentStepIndex?: number | null;
  lastCompletedStepIndex?: number | null;
  exploratoryWindowRepCount?: number | null;
  inventoryFallbackReason?: string | null;
  supersededByPlanId?: string | null;
  supersededReason?: string | null;
  pausedAt?: number | null;
  resumedAt?: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface PulseCheckStateSnapshot {
  id: string;
  athleteId: string;
  sourceDate: string;
  sourceCheckInId: string;
  rawSignalSummary?: PulseCheckRawSignalSummary;
  stateDimensions: PulseCheckStateDimensions;
  overallReadiness: PulseCheckOverallReadiness;
  confidence: PulseCheckStateConfidence;
  freshness: PulseCheckStateFreshness;
  enrichedInterpretation?: PulseCheckEnrichedInterpretation;
  sourcesUsed: string[];
  sourceEventIds: string[];
  contextTags: string[];
  recommendedRouting: PulseCheckRoutingRecommendation;
  recommendedProtocolClass?: PulseCheckProtocolClass;
  candidateClassHints?: PulseCheckAssignmentCandidateType[];
  readinessScore?: number;
  supportFlag?: boolean;
  decisionSource?: PulseCheckDecisionSource;
  executionLink?: string;
  createdAt: number;
  updatedAt: number;
}

/**
 * PulseCheckDailyAssignment - Nora's concrete post-check-in daily task
 * Collection: pulsecheck-daily-assignments
 */
export interface PulseCheckDailyAssignment {
  id: string;
  lineageId: string;
  revision: number;
  previousRevision?: number;
  athleteId: string;
  teamId: string;
  teamMembershipId: string;
  coachId?: string;
  sourceCheckInId: string;
  sourceStateSnapshotId?: string;
  sourceCandidateSetId?: string;
  sourceDate: string; // YYYY-MM-DD
  timezone?: string;
  sourceDateMode?: PulseCheckDailyTaskSourceDateMode;
  assignedBy: 'nora' | 'curriculum-engine' | 'coach-override';
  materializedAt?: number;
  materializedBy?: PulseCheckDailyTaskMaterializedBy;
  isPrimaryForDate?: boolean;
  status: PulseCheckDailyAssignmentStatus;
  actionType: PulseCheckDailyAssignmentActionType;
  executionPattern?: PulseCheckDailyTaskExecutionPattern;
  chosenCandidateId?: string;
  chosenCandidateType?: PulseCheckAssignmentCandidateType;
  simSpecId?: string;
  legacyExerciseId?: string;
  simFamilyLabel?: string;
  simVariantLabel?: string;
  protocolId?: string;
  protocolFamilyId?: string;
  protocolVariantId?: string;
  protocolVariantLabel?: string;
  protocolVariantVersion?: string;
  protocolPublishedAt?: number;
  protocolPublishedRevisionId?: string;
  protocolLabel?: string;
  protocolClass?: PulseCheckProtocolClass;
  protocolCategory?: ExerciseCategory;
  protocolResponseFamily?: PulseCheckProtocolResponseFamily;
  protocolDeliveryMode?: PulseCheckProtocolDeliveryMode;
  sessionType?: SessionType;
  durationMode?: DurationMode;
  durationSeconds?: number;
  rationale: string;
  plannerSummary?: string;
  plannerAudit?: PulseCheckPlannerAudit;
  plannerConfidence?: PulseCheckStateConfidence;
  decisionSource?: PulseCheckDecisionSource;
  readinessScore?: number;
  readinessBand?: 'low' | 'medium' | 'high';
  escalationTier?: number;
  supportFlag?: boolean;
  programSnapshot?: ProgramPrescription;
  protocolPracticeSession?: PulseCheckProtocolPracticeSession;
  trainingPlanId?: string;
  trainingPlanStepId?: string;
  trainingPlanStepIndex?: number;
  trainingPlanStepLabel?: string;
  trainingPlanIsPrimary?: boolean;
  isPlanOverride?: boolean;
  overrideMetadata?: PulseCheckDailyTaskOverrideMetadata;
  supersededByDailyTaskId?: string;
  supersededReason?: string;
  executionLock?: PulseCheckDailyTaskExecutionLock;
  phaseProgress?: PulseCheckDailyTaskPhaseProgress;
  completionSummary?: PulseCheckDailyTaskCompletionSummary;
  pausedAt?: number;
  resumedAt?: number;
  expiredAt?: number;
  coachNotifiedAt?: number;
  startedAt?: number;
  completedAt?: number;
  overriddenBy?: string;
  overrideReason?: string;
  supersededAt?: number;
  supersededByRevision?: number;
  createdAt: number;
  updatedAt: number;
}

export type DailyTask = PulseCheckDailyAssignment;
export type TrainingPlan = PulseCheckTrainingPlan;
export type PlanStep = PulseCheckPlanStep;

export interface PulseCheckCheckInSubmissionResult {
  checkIn: MentalCheckIn;
  stateSnapshot: PulseCheckStateSnapshot;
  candidateSet?: PulseCheckAssignmentCandidateSet;
  dailyAssignment: PulseCheckDailyAssignment | null;
}

export interface RecordPulseCheckAssignmentEventInput {
  assignmentId: string;
  eventType: PulseCheckAssignmentEventType;
  reason?: string;
  actorUserId?: string;
  metadata?: Record<string, unknown>;
}

export interface PulseCheckAssignmentEvent {
  id: string;
  assignmentId: string;
  athleteId: string;
  teamId: string;
  sourceDate: string;
  eventType: PulseCheckAssignmentEventType;
  actorType: PulseCheckAssignmentEventActorType;
  actorUserId: string;
  eventAt: number;
  trainingPlanId?: string;
  trainingPlanStepId?: string;
  trainingPlanStepIndex?: number;
  executionPattern?: PulseCheckDailyTaskExecutionPattern;
  phaseProgress?: PulseCheckDailyTaskPhaseProgress;
  executionLock?: PulseCheckDailyTaskExecutionLock;
  completionSummary?: PulseCheckDailyTaskCompletionSummary;
  metadata?: Record<string, unknown>;
  createdAt: number;
}

export interface PulseCheckAssignmentEventRecordResult {
  assignment: PulseCheckDailyAssignment;
  event: PulseCheckAssignmentEvent;
  stateSnapshot?: PulseCheckStateSnapshot | null;
  planSideEffect?: {
    plan: PulseCheckTrainingPlan;
    step: PulseCheckPlanStep;
    event: PulseCheckAssignmentEvent;
  } | null;
}

export interface PulseCheckConversationDerivedSignalDelta {
  activationDelta?: number;
  focusReadinessDelta?: number;
  emotionalLoadDelta?: number;
  cognitiveFatigueDelta?: number;
  overallReadiness?: PulseCheckOverallReadiness;
  recommendedRouting?: PulseCheckRoutingRecommendation;
  recommendedProtocolClass?: 'regulation' | 'priming' | 'recovery' | 'none';
  supportFlag?: boolean;
  summary?: string;
  contradictionSummary?: string;
  supportingEvidence?: string[];
  contextTags?: string[];
}

export interface PulseCheckConversationDerivedSignalEvent {
  id: string;
  athleteId: string;
  conversationId: string;
  messageId: string;
  sourceDate: string;
  sourceAssignmentId?: string;
  sourceStateSnapshotId: string;
  supersedesSnapshotId?: string;
  confidence: PulseCheckStateConfidence;
  inferredDelta: PulseCheckConversationDerivedSignalDelta;
  eventAt: number;
  createdAt: number;
  decisionSource?: PulseCheckDecisionSource;
}

/**
 * AthleteMentalProgress - Athlete's overall mental training progress
 * Collection: athlete-mental-progress/{athleteId}
 */
export interface AthleteMentalProgress {
  athleteId: string;
  coachId?: string; // Primary coach

  // MPR Score (1-10)
  mprScore: number;
  mprLastCalculated: number; // Unix timestamp

  // Pathway progress
  currentPathway: MentalPathway;
  pathwayStep: number;
  completedPathways: MentalPathway[];
  foundationComplete: boolean;

  // Foundation tracking
  foundationBoxBreathingComplete: boolean;
  foundationCheckInsComplete: boolean;

  // Assessment
  baselineAssessment?: BaselineAssessment;
  baselineProbe?: BaselineProbe;
  assessmentNeeded: boolean;

  // Stats
  totalExercisesMastered: number;
  totalAssignmentsCompleted: number;
  currentStreak: number;
  longestStreak: number;

  // Active assignment tracking
  activeAssignmentId?: string;
  activeAssignmentExerciseName?: string;
  taxonomyProfile?: TaxonomyProfile;
  activeProgram?: ProgramPrescription;
  lastProfileSyncAt?: number;
  profileVersion?: string;

  createdAt: number;
  updatedAt: number;
}

/**
 * Pathway definition with exercise sequence
 */
export interface PathwayDefinition {
  pathway: MentalPathway;
  name: string;
  description: string;
  exerciseSequence: {
    step: number;
    exerciseId: string;
    exerciseName: string;
    weeksRange: string; // e.g., "5-6", "7-8"
    isFoundation: boolean;
    isApplication: boolean;
  }[];
  graduationCriteria: string[];
}

// ============================================================================
// FIRESTORE HELPERS
// ============================================================================

export function sanitizeFirestoreValue<T>(value: T): T {
  if (Array.isArray(value)) {
    return value
      .map((entry) => sanitizeFirestoreValue(entry))
      .filter((entry) => entry !== undefined) as T;
  }

  if (value && typeof value === 'object') {
    const cleaned = Object.entries(value as Record<string, unknown>).reduce<Record<string, unknown>>((accumulator, [key, entry]) => {
      const sanitized = sanitizeFirestoreValue(entry);
      if (sanitized !== undefined) {
        accumulator[key] = sanitized;
      }
      return accumulator;
    }, {});

    return cleaned as T;
  }

  return value;
}

export function exerciseToFirestore(exercise: MentalExercise): Record<string, any> {
  const data: Record<string, any> = {
    name: exercise.name,
    description: exercise.description,
    category: exercise.category,
    difficulty: exercise.difficulty,
    durationMinutes: exercise.durationMinutes,
    exerciseConfig: exercise.exerciseConfig,
    benefits: exercise.benefits,
    bestFor: exercise.bestFor,
    origin: exercise.origin,
    neuroscience: exercise.neuroscience,
    overview: exercise.overview,
    iconName: exercise.iconName,
    isActive: exercise.isActive,
    sortOrder: exercise.sortOrder,
    createdAt: exercise.createdAt,
    updatedAt: exercise.updatedAt,
  };

  if (exercise.simSpecId) {
    data.simSpecId = exercise.simSpecId;
  }
  if (exercise.taxonomy) {
    data.taxonomy = exercise.taxonomy;
  }
  if (exercise.runtimeConfig) {
    data.runtimeConfig = exercise.runtimeConfig;
  }
  if (exercise.engineKey) {
    data.engineKey = exercise.engineKey;
  }
  if (exercise.buildArtifact) {
    data.buildArtifact = exercise.buildArtifact;
  }
  if (exercise.syncStatus) {
    data.syncStatus = exercise.syncStatus;
  }
  if (exercise.publishedFingerprint) {
    data.publishedFingerprint = exercise.publishedFingerprint;
  }
  if (exercise.variantSource) {
    data.variantSource = exercise.variantSource;
  }

  return data;
}

export function exerciseFromFirestore(id: string, data: Record<string, any>): MentalExercise {
  return {
    id,
    name: data.name || '',
    description: data.description || '',
    category: data.category || ExerciseCategory.Breathing,
    difficulty: data.difficulty || ExerciseDifficulty.Beginner,
    durationMinutes: data.durationMinutes || 5,
    exerciseConfig: data.exerciseConfig,
    benefits: data.benefits || [],
    bestFor: data.bestFor || [],
    origin: data.origin || '',
    neuroscience: data.neuroscience || '',
    overview: data.overview || { when: '', focus: '', timeScale: '', skill: '', analogy: '' },
    iconName: data.iconName || 'brain',
    isActive: data.isActive ?? true,
    sortOrder: data.sortOrder || 0,
    simSpecId: data.simSpecId,
    taxonomy: data.taxonomy,
    runtimeConfig: data.runtimeConfig,
    engineKey: data.engineKey,
    buildArtifact: data.buildArtifact,
    syncStatus: data.syncStatus,
    publishedFingerprint: data.publishedFingerprint,
    variantSource: data.variantSource,
    createdAt: data.createdAt || Date.now(),
    updatedAt: data.updatedAt || Date.now(),
  };
}

export type SimModule = MentalExercise;
export type SimAssignment = ExerciseAssignment;
export type SimCompletion = ExerciseCompletion;

export function assignmentToFirestore(assignment: ExerciseAssignment): Record<string, any> {
  return {
    athleteUserId: assignment.athleteUserId,
    exerciseId: assignment.exerciseId,
    exercise: assignment.exercise ? exerciseToFirestore(assignment.exercise) : null,
    source: assignment.source,
    assignedBy: assignment.assignedBy,
    assignedByName: assignment.assignedByName,
    reason: assignment.reason,
    profileSnapshotMilestone: assignment.profileSnapshotMilestone,
    dueDate: assignment.dueDate,
    scheduledTime: assignment.scheduledTime,
    isRecurring: assignment.isRecurring,
    recurringPattern: assignment.recurringPattern,
    recurringDays: assignment.recurringDays,
    status: assignment.status,
    completedAt: assignment.completedAt,
    skippedAt: assignment.skippedAt,
    skippedReason: assignment.skippedReason,
    createdAt: assignment.createdAt,
    updatedAt: assignment.updatedAt,
  };
}

export function assignmentFromFirestore(id: string, data: Record<string, any>): ExerciseAssignment {
  return {
    id,
    athleteUserId: data.athleteUserId || '',
    exerciseId: data.exerciseId || '',
    exercise: data.exercise ? exerciseFromFirestore(data.exercise.id || data.exerciseId, data.exercise) : undefined,
    source: data.source || AssignmentSource.Coach,
    assignedBy: data.assignedBy,
    assignedByName: data.assignedByName,
    reason: data.reason,
    profileSnapshotMilestone: data.profileSnapshotMilestone,
    dueDate: data.dueDate,
    scheduledTime: data.scheduledTime,
    isRecurring: data.isRecurring ?? false,
    recurringPattern: data.recurringPattern,
    recurringDays: data.recurringDays,
    status: data.status || AssignmentStatus.Pending,
    completedAt: data.completedAt,
    skippedAt: data.skippedAt,
    skippedReason: data.skippedReason,
    createdAt: data.createdAt || Date.now(),
    updatedAt: data.updatedAt || Date.now(),
  };
}

export function completionToFirestore(completion: ExerciseCompletion): Record<string, any> {
  const data: Record<string, any> = {
    userId: completion.userId,
    exerciseId: completion.exerciseId,
    exerciseName: completion.exerciseName,
    exerciseCategory: completion.exerciseCategory,
    completedAt: completion.completedAt,
    durationSeconds: completion.durationSeconds,
    createdAt: completion.createdAt,
  };

  if (completion.assignmentId) data.assignmentId = completion.assignmentId;
  if (completion.dailyAssignmentId) data.dailyAssignmentId = completion.dailyAssignmentId;
  if (typeof completion.preExerciseMood === 'number') data.preExerciseMood = completion.preExerciseMood;
  if (typeof completion.postExerciseMood === 'number') data.postExerciseMood = completion.postExerciseMood;
  if (typeof completion.difficultyRating === 'number') data.difficultyRating = completion.difficultyRating;
  if (typeof completion.helpfulnessRating === 'number') data.helpfulnessRating = completion.helpfulnessRating;
  if (completion.notes) data.notes = completion.notes;
  if (completion.context) data.context = completion.context;
  if (completion.sessionSummary) data.sessionSummary = sanitizeFirestoreValue(completion.sessionSummary);

  return data;
}

export function completionFromFirestore(id: string, data: Record<string, any>): ExerciseCompletion {
  return {
    id,
    userId: data.userId || '',
    exerciseId: data.exerciseId || '',
    exerciseName: data.exerciseName || '',
    exerciseCategory: data.exerciseCategory || ExerciseCategory.Breathing,
    assignmentId: data.assignmentId,
    dailyAssignmentId: data.dailyAssignmentId,
    completedAt: data.completedAt || Date.now(),
    durationSeconds: data.durationSeconds || 0,
    preExerciseMood: data.preExerciseMood,
    postExerciseMood: data.postExerciseMood,
    difficultyRating: data.difficultyRating,
    helpfulnessRating: data.helpfulnessRating,
    notes: data.notes,
    context: data.context,
    sessionSummary: data.sessionSummary,
    createdAt: data.createdAt || Date.now(),
  };
}

export function streakToFirestore(streak: MentalTrainingStreak): Record<string, any> {
  return {
    userId: streak.userId,
    currentStreak: streak.currentStreak,
    longestStreak: streak.longestStreak,
    lastActivityDate: streak.lastActivityDate,
    totalExercisesCompleted: streak.totalExercisesCompleted,
    totalMinutesTrained: streak.totalMinutesTrained,
    categoryCompletions: streak.categoryCompletions,
    achievements: streak.achievements,
    weeklyCompletions: streak.weeklyCompletions,
    weeklyMinutes: streak.weeklyMinutes,
    updatedAt: streak.updatedAt,
  };
}

export function streakFromFirestore(userId: string, data: Record<string, any>): MentalTrainingStreak {
  return {
    userId,
    currentStreak: data.currentStreak || 0,
    longestStreak: data.longestStreak || 0,
    lastActivityDate: data.lastActivityDate || '',
    totalExercisesCompleted: data.totalExercisesCompleted || 0,
    totalMinutesTrained: data.totalMinutesTrained || 0,
    categoryCompletions: data.categoryCompletions || {},
    achievements: data.achievements || [],
    weeklyCompletions: data.weeklyCompletions || 0,
    weeklyMinutes: data.weeklyMinutes || 0,
    updatedAt: data.updatedAt || Date.now(),
  };
}

export function checkInToFirestore(checkIn: MentalCheckIn): Record<string, any> {
  const data: Record<string, any> = {
    userId: checkIn.userId,
    type: checkIn.type,
    readinessScore: checkIn.readinessScore,
    createdAt: checkIn.createdAt,
    date: checkIn.date,
  };

  if (checkIn.moodWord) data.moodWord = checkIn.moodWord;
  if (typeof checkIn.energyLevel === 'number') data.energyLevel = checkIn.energyLevel;
  if (typeof checkIn.stressLevel === 'number') data.stressLevel = checkIn.stressLevel;
  if (typeof checkIn.sleepQuality === 'number') data.sleepQuality = checkIn.sleepQuality;
  if (checkIn.notes) data.notes = checkIn.notes;
  if (checkIn.suggestedExerciseId) data.suggestedExerciseId = checkIn.suggestedExerciseId;
  if (typeof checkIn.exerciseCompleted === 'boolean') data.exerciseCompleted = checkIn.exerciseCompleted;
  if (checkIn.taxonomyState) data.taxonomyState = sanitizeFirestoreValue(checkIn.taxonomyState);
  if (checkIn.timezone) data.timezone = checkIn.timezone;

  return data;
}

export function checkInFromFirestore(id: string, data: Record<string, any>): MentalCheckIn {
  return {
    id,
    userId: data.userId || '',
    type: data.type || CheckInType.Morning,
    readinessScore: data.readinessScore || 3,
    moodWord: data.moodWord,
    energyLevel: data.energyLevel,
    stressLevel: data.stressLevel,
    sleepQuality: data.sleepQuality,
    notes: data.notes,
    suggestedExerciseId: data.suggestedExerciseId,
    exerciseCompleted: data.exerciseCompleted,
    taxonomyState: data.taxonomyState,
    timezone: data.timezone,
    createdAt: data.createdAt || Date.now(),
    date: data.date || new Date().toISOString().split('T')[0],
  };
}

// ============================================================================
// CURRICULUM FIRESTORE HELPERS
// ============================================================================

export function recommendationToFirestore(rec: MentalRecommendation): Record<string, any> {
  const data: Record<string, any> = {
    athleteId: rec.athleteId,
    coachId: rec.coachId,
    exerciseId: rec.exerciseId,
    exercise: rec.exercise ? exerciseToFirestore(rec.exercise) : null,
    reason: rec.reason,
    confidence: rec.confidence,
    pathway: rec.pathway,
    pathwayStep: rec.pathwayStep,
    triggerType: rec.triggerType,
    status: rec.status,
    createdAt: rec.createdAt,
    updatedAt: rec.updatedAt,
  };

  // Only include optional fields if they have values (Firestore doesn't allow undefined)
  if (rec.previousAssignmentId) {
    data.previousAssignmentId = rec.previousAssignmentId;
  }
  if (rec.coachOverrideReason) {
    data.coachOverrideReason = rec.coachOverrideReason;
  }
  if (rec.programRecommendation) {
    data.programRecommendation = rec.programRecommendation;
  }

  return data;
}

export function recommendationFromFirestore(id: string, data: Record<string, any>): MentalRecommendation {
  return {
    id,
    athleteId: data.athleteId || '',
    coachId: data.coachId || '',
    exerciseId: data.exerciseId || '',
    exercise: data.exercise ? exerciseFromFirestore(data.exerciseId, data.exercise) : undefined,
    reason: data.reason || '',
    confidence: data.confidence || RecommendationConfidence.Medium,
    pathway: data.pathway || MentalPathway.Foundation,
    pathwayStep: data.pathwayStep || 1,
    triggerType: data.triggerType || 'manual_request',
    programRecommendation: data.programRecommendation,
    previousAssignmentId: data.previousAssignmentId,
    status: data.status || RecommendationStatus.Pending,
    coachOverrideReason: data.coachOverrideReason,
    createdAt: data.createdAt || Date.now(),
    updatedAt: data.updatedAt || Date.now(),
  };
}

export function curriculumAssignmentToFirestore(assignment: CurriculumAssignment): Record<string, any> {
  const data: Record<string, any> = {
    athleteId: assignment.athleteId,
    coachId: assignment.coachId,
    exerciseId: assignment.exerciseId,
    exercise: assignment.exercise ? exerciseToFirestore(assignment.exercise) : null,
    recommendationId: assignment.recommendationId,
    source: assignment.source,
    durationDays: assignment.durationDays,
    frequency: assignment.frequency,
    startDate: assignment.startDate,
    endDate: assignment.endDate,
    completedDays: assignment.completedDays,
    targetDays: assignment.targetDays,
    completionRate: assignment.completionRate,
    currentDayNumber: assignment.currentDayNumber,
    status: assignment.status,
    masteryAchieved: assignment.masteryAchieved,
    extendedCount: assignment.extendedCount,
    reminderEnabled: assignment.reminderEnabled,
    reminderTimes: assignment.reminderTimes,
    pathway: assignment.pathway,
    pathwayStep: assignment.pathwayStep,
    createdAt: assignment.createdAt,
    updatedAt: assignment.updatedAt,
  };

  // Only include optional fields if they have values (Firestore doesn't allow undefined)
  if (assignment.coachNote) {
    data.coachNote = assignment.coachNote;
  }
  if (assignment.recommendationId) {
    data.recommendationId = assignment.recommendationId;
  }
  if (assignment.simSpecId) {
    data.simSpecId = assignment.simSpecId;
  }

  return data;
}

export function curriculumAssignmentFromFirestore(id: string, data: Record<string, any>): CurriculumAssignment {
  return {
    id,
    athleteId: data.athleteId || '',
    coachId: data.coachId || '',
    exerciseId: data.exerciseId || '',
    exercise: data.exercise ? exerciseFromFirestore(data.exerciseId, data.exercise) : undefined,
    simSpecId: data.simSpecId,
    recommendationId: data.recommendationId,
    source: data.source || AssignmentSource.Coach,
    durationDays: data.durationDays || 14,
    frequency: data.frequency || 1,
    startDate: data.startDate || Date.now(),
    endDate: data.endDate || Date.now() + 14 * 24 * 60 * 60 * 1000,
    completedDays: data.completedDays || 0,
    targetDays: data.targetDays || 14,
    completionRate: data.completionRate || 0,
    currentDayNumber: data.currentDayNumber || 1,
    status: data.status || CurriculumAssignmentStatus.Active,
    masteryAchieved: data.masteryAchieved || false,
    extendedCount: data.extendedCount || 0,
    coachNote: data.coachNote,
    reminderEnabled: data.reminderEnabled ?? true,
    reminderTimes: data.reminderTimes || ['08:00', '20:00'],
    pathway: data.pathway || MentalPathway.Foundation,
    pathwayStep: data.pathwayStep || 1,
    createdAt: data.createdAt || Date.now(),
    updatedAt: data.updatedAt || Date.now(),
  };
}

export function pulseCheckPlanStepToFirestore(step: PulseCheckPlanStep): Record<string, any> {
  return stripUndefinedDeep({
    id: step.id,
    stepIndex: step.stepIndex,
    stepLabel: step.stepLabel,
    stepStatus: step.stepStatus,
    actionType: step.actionType,
    exerciseId: step.exerciseId,
    simSpecId: step.simSpecId || null,
    protocolId: step.protocolId || null,
    protocolClass: step.protocolClass || null,
    executionPattern: step.executionPattern || null,
    targetSkills: Array.isArray(step.targetSkills) ? step.targetSkills : null,
    archetypeStepKey: step.archetypeStepKey || null,
    linkedDailyTaskId: step.linkedDailyTaskId || null,
    linkedDailyTaskSourceDate: step.linkedDailyTaskSourceDate || null,
    overrideReason: step.overrideReason || null,
    resultSummary: step.resultSummary || null,
    plannedDurationSeconds: step.plannedDurationSeconds || null,
    startedAt: step.startedAt || null,
    completedAt: step.completedAt || null,
    skippedAt: step.skippedAt || null,
    dueSourceDate: step.dueSourceDate || null,
    timezone: step.timezone || null,
  });
}

export function pulseCheckPlanStepFromFirestore(id: string, data: Record<string, any>): PulseCheckPlanStep {
  return {
    id: data.id || id,
    stepIndex: typeof data.stepIndex === 'number' ? data.stepIndex : 0,
    stepLabel: data.stepLabel || '',
    stepStatus: data.stepStatus || 'planned',
    actionType: data.actionType || 'sim',
    exerciseId: data.exerciseId || '',
    simSpecId: data.simSpecId || undefined,
    protocolId: data.protocolId || undefined,
    protocolClass: data.protocolClass || undefined,
    executionPattern: data.executionPattern || undefined,
    targetSkills: Array.isArray(data.targetSkills) ? data.targetSkills : undefined,
    archetypeStepKey: data.archetypeStepKey || undefined,
    linkedDailyTaskId: data.linkedDailyTaskId || undefined,
    linkedDailyTaskSourceDate: data.linkedDailyTaskSourceDate || undefined,
    overrideReason: data.overrideReason || undefined,
    resultSummary: data.resultSummary || undefined,
    plannedDurationSeconds: typeof data.plannedDurationSeconds === 'number' ? data.plannedDurationSeconds : undefined,
    startedAt: typeof data.startedAt === 'number' ? data.startedAt : undefined,
    completedAt: typeof data.completedAt === 'number' ? data.completedAt : undefined,
    skippedAt: typeof data.skippedAt === 'number' ? data.skippedAt : undefined,
    dueSourceDate: data.dueSourceDate || undefined,
    timezone: data.timezone || undefined,
  };
}

export function pulseCheckTrainingPlanToFirestore(plan: PulseCheckTrainingPlan): Record<string, any> {
  return stripUndefinedDeep({
    athleteId: plan.athleteId,
    title: plan.title,
    goal: plan.goal,
    planType: plan.planType,
    status: plan.status,
    isPrimary: plan.isPrimary,
    progressMode: plan.progressMode,
    targetCount: plan.targetCount,
    completedCount: plan.completedCount,
    steps: Array.isArray(plan.steps) ? plan.steps.map((step) => pulseCheckPlanStepToFirestore(step)) : [],
    assignedBy: plan.assignedBy,
    coachId: plan.coachId || null,
    targetSkills: Array.isArray(plan.targetSkills) ? plan.targetSkills : null,
    authoringTrigger: plan.authoringTrigger || null,
    authoringFocusSkill: plan.authoringFocusSkill || null,
    archetypeId: plan.archetypeId || null,
    archetypeVersion: plan.archetypeVersion || null,
    authoringRulesVersion: plan.authoringRulesVersion || null,
    sourceStateSnapshotId: plan.sourceStateSnapshotId || null,
    sourceProfileSnapshotId: plan.sourceProfileSnapshotId || null,
    sourceProgramPrescriptionId: plan.sourceProgramPrescriptionId || null,
    sourceProgramGeneratedAt: plan.sourceProgramGeneratedAt || null,
    sourceDailyTaskId: plan.sourceDailyTaskId || null,
    primaryPlanId: plan.primaryPlanId || null,
    sourceDate: plan.sourceDate || null,
    timezone: plan.timezone || null,
    startDate: plan.startDate || null,
    endDate: plan.endDate || null,
    cadence: plan.cadence || null,
    primaryPlanMetric: plan.primaryPlanMetric || null,
    latestResultSummary: plan.latestResultSummary || null,
    latestResultAt: plan.latestResultAt || null,
    nextDueStepIndex: plan.nextDueStepIndex || null,
    currentStepIndex: plan.currentStepIndex || null,
    lastCompletedStepIndex: plan.lastCompletedStepIndex || null,
    exploratoryWindowRepCount: plan.exploratoryWindowRepCount || null,
    inventoryFallbackReason: plan.inventoryFallbackReason || null,
    supersededByPlanId: plan.supersededByPlanId || null,
    supersededReason: plan.supersededReason || null,
    pausedAt: plan.pausedAt || null,
    resumedAt: plan.resumedAt || null,
    createdAt: plan.createdAt,
    updatedAt: plan.updatedAt,
  });
}

export function pulseCheckTrainingPlanFromFirestore(id: string, data: Record<string, any>): PulseCheckTrainingPlan {
  return {
    id,
    athleteId: data.athleteId || '',
    title: data.title || '',
    goal: data.goal || '',
    planType: data.planType || 'mixed',
    status: data.status || 'active',
    isPrimary: data.isPrimary ?? true,
    progressMode: data.progressMode || 'sessions',
    targetCount: typeof data.targetCount === 'number' ? data.targetCount : null,
    completedCount: typeof data.completedCount === 'number' ? data.completedCount : 0,
    steps: Array.isArray(data.steps)
      ? data.steps.map((entry: Record<string, any>, index: number) => pulseCheckPlanStepFromFirestore(entry?.id || `${id}_step_${index + 1}`, entry))
      : [],
    assignedBy: data.assignedBy || 'nora',
    coachId: data.coachId || undefined,
    targetSkills: Array.isArray(data.targetSkills) ? data.targetSkills : undefined,
    authoringTrigger: data.authoringTrigger || undefined,
    authoringFocusSkill: data.authoringFocusSkill || null,
    archetypeId: data.archetypeId || null,
    archetypeVersion: data.archetypeVersion || null,
    authoringRulesVersion: data.authoringRulesVersion || null,
    sourceStateSnapshotId: data.sourceStateSnapshotId || undefined,
    sourceProfileSnapshotId: data.sourceProfileSnapshotId || null,
    sourceProgramPrescriptionId: data.sourceProgramPrescriptionId || null,
    sourceProgramGeneratedAt: typeof data.sourceProgramGeneratedAt === 'number' ? data.sourceProgramGeneratedAt : null,
    sourceDailyTaskId: data.sourceDailyTaskId || undefined,
    primaryPlanId: data.primaryPlanId || undefined,
    sourceDate: data.sourceDate || undefined,
    timezone: data.timezone || undefined,
    startDate: data.startDate || null,
    endDate: data.endDate || null,
    cadence: data.cadence || null,
    primaryPlanMetric: data.primaryPlanMetric || null,
    latestResultSummary: data.latestResultSummary || null,
    latestResultAt: typeof data.latestResultAt === 'number' ? data.latestResultAt : null,
    nextDueStepIndex: typeof data.nextDueStepIndex === 'number' ? data.nextDueStepIndex : null,
    currentStepIndex: typeof data.currentStepIndex === 'number' ? data.currentStepIndex : null,
    lastCompletedStepIndex: typeof data.lastCompletedStepIndex === 'number' ? data.lastCompletedStepIndex : null,
    exploratoryWindowRepCount: typeof data.exploratoryWindowRepCount === 'number' ? data.exploratoryWindowRepCount : null,
    inventoryFallbackReason: data.inventoryFallbackReason || null,
    supersededByPlanId: data.supersededByPlanId || null,
    supersededReason: data.supersededReason || null,
    pausedAt: typeof data.pausedAt === 'number' ? data.pausedAt : null,
    resumedAt: typeof data.resumedAt === 'number' ? data.resumedAt : null,
    createdAt: data.createdAt || Date.now(),
    updatedAt: data.updatedAt || Date.now(),
  };
}

export function pulseCheckDailyAssignmentToFirestore(
  assignment: PulseCheckDailyAssignment
): Record<string, any> {
  const data: Record<string, any> = {
    lineageId: assignment.lineageId,
    revision: assignment.revision,
    athleteId: assignment.athleteId,
    teamId: assignment.teamId,
    teamMembershipId: assignment.teamMembershipId,
    sourceCheckInId: assignment.sourceCheckInId,
    sourceDate: assignment.sourceDate,
    assignedBy: assignment.assignedBy,
    status: assignment.status,
    actionType: assignment.actionType,
    rationale: assignment.rationale,
    createdAt: assignment.createdAt,
    updatedAt: assignment.updatedAt,
  };

  if (assignment.coachId) data.coachId = assignment.coachId;
  if (typeof assignment.previousRevision === 'number') data.previousRevision = assignment.previousRevision;
  if (assignment.sourceStateSnapshotId) data.sourceStateSnapshotId = assignment.sourceStateSnapshotId;
  if (assignment.simSpecId) data.simSpecId = assignment.simSpecId;
  if (assignment.legacyExerciseId) data.legacyExerciseId = assignment.legacyExerciseId;
  if (assignment.timezone) data.timezone = assignment.timezone;
  if (assignment.sourceDateMode) data.sourceDateMode = assignment.sourceDateMode;
  if (typeof assignment.materializedAt === 'number') data.materializedAt = assignment.materializedAt;
  if (assignment.materializedBy) data.materializedBy = assignment.materializedBy;
  if (typeof assignment.isPrimaryForDate === 'boolean') data.isPrimaryForDate = assignment.isPrimaryForDate;
  if (assignment.executionPattern) data.executionPattern = assignment.executionPattern;
  if (assignment.simFamilyLabel) data.simFamilyLabel = assignment.simFamilyLabel;
  if (assignment.simVariantLabel) data.simVariantLabel = assignment.simVariantLabel;
  if (assignment.protocolId) data.protocolId = assignment.protocolId;
  if (assignment.protocolFamilyId) data.protocolFamilyId = assignment.protocolFamilyId;
  if (assignment.protocolVariantId) data.protocolVariantId = assignment.protocolVariantId;
  if (assignment.protocolVariantLabel) data.protocolVariantLabel = assignment.protocolVariantLabel;
  if (assignment.protocolVariantVersion) data.protocolVariantVersion = assignment.protocolVariantVersion;
  if (typeof assignment.protocolPublishedAt === 'number') data.protocolPublishedAt = assignment.protocolPublishedAt;
  if (assignment.protocolPublishedRevisionId) data.protocolPublishedRevisionId = assignment.protocolPublishedRevisionId;
  if (assignment.protocolLabel) data.protocolLabel = assignment.protocolLabel;
  if (assignment.protocolClass) data.protocolClass = assignment.protocolClass;
  if (assignment.protocolCategory) data.protocolCategory = assignment.protocolCategory;
  if (assignment.protocolResponseFamily) data.protocolResponseFamily = assignment.protocolResponseFamily;
  if (assignment.protocolDeliveryMode) data.protocolDeliveryMode = assignment.protocolDeliveryMode;
  if (assignment.sessionType) data.sessionType = assignment.sessionType;
  if (assignment.durationMode) data.durationMode = assignment.durationMode;
  if (typeof assignment.durationSeconds === 'number') data.durationSeconds = assignment.durationSeconds;
  if (assignment.sourceCandidateSetId) data.sourceCandidateSetId = assignment.sourceCandidateSetId;
  if (assignment.chosenCandidateId) data.chosenCandidateId = assignment.chosenCandidateId;
  if (assignment.chosenCandidateType) data.chosenCandidateType = assignment.chosenCandidateType;
  if (assignment.plannerSummary) data.plannerSummary = assignment.plannerSummary;
  if (assignment.plannerAudit) data.plannerAudit = sanitizeFirestoreValue(assignment.plannerAudit);
  if (assignment.plannerConfidence) data.plannerConfidence = assignment.plannerConfidence;
  if (assignment.decisionSource) data.decisionSource = assignment.decisionSource;
  if (typeof assignment.readinessScore === 'number') data.readinessScore = assignment.readinessScore;
  if (assignment.readinessBand) data.readinessBand = assignment.readinessBand;
  if (typeof assignment.escalationTier === 'number') data.escalationTier = assignment.escalationTier;
  if (typeof assignment.supportFlag === 'boolean') data.supportFlag = assignment.supportFlag;
  if (assignment.programSnapshot) data.programSnapshot = sanitizeFirestoreValue(assignment.programSnapshot);
  if (assignment.protocolPracticeSession) data.protocolPracticeSession = sanitizeFirestoreValue(assignment.protocolPracticeSession);
  if (assignment.trainingPlanId) data.trainingPlanId = assignment.trainingPlanId;
  if (assignment.trainingPlanStepId) data.trainingPlanStepId = assignment.trainingPlanStepId;
  if (typeof assignment.trainingPlanStepIndex === 'number') data.trainingPlanStepIndex = assignment.trainingPlanStepIndex;
  if (assignment.trainingPlanStepLabel) data.trainingPlanStepLabel = assignment.trainingPlanStepLabel;
  if (typeof assignment.trainingPlanIsPrimary === 'boolean') data.trainingPlanIsPrimary = assignment.trainingPlanIsPrimary;
  if (typeof assignment.isPlanOverride === 'boolean') data.isPlanOverride = assignment.isPlanOverride;
  if (assignment.overrideMetadata) data.overrideMetadata = sanitizeFirestoreValue(assignment.overrideMetadata);
  if (assignment.supersededByDailyTaskId) data.supersededByDailyTaskId = assignment.supersededByDailyTaskId;
  if (assignment.supersededReason) data.supersededReason = assignment.supersededReason;
  if (assignment.executionLock) data.executionLock = sanitizeFirestoreValue(assignment.executionLock);
  if (assignment.phaseProgress) data.phaseProgress = sanitizeFirestoreValue(assignment.phaseProgress);
  if (assignment.completionSummary) data.completionSummary = sanitizeFirestoreValue(assignment.completionSummary);
  if (typeof assignment.pausedAt === 'number') data.pausedAt = assignment.pausedAt;
  if (typeof assignment.resumedAt === 'number') data.resumedAt = assignment.resumedAt;
  if (typeof assignment.expiredAt === 'number') data.expiredAt = assignment.expiredAt;
  if (typeof assignment.coachNotifiedAt === 'number') data.coachNotifiedAt = assignment.coachNotifiedAt;
  if (typeof assignment.startedAt === 'number') data.startedAt = assignment.startedAt;
  if (typeof assignment.completedAt === 'number') data.completedAt = assignment.completedAt;
  if (assignment.overriddenBy) data.overriddenBy = assignment.overriddenBy;
  if (assignment.overrideReason) data.overrideReason = assignment.overrideReason;
  if (typeof assignment.supersededAt === 'number') data.supersededAt = assignment.supersededAt;
  if (typeof assignment.supersededByRevision === 'number') data.supersededByRevision = assignment.supersededByRevision;

  return data;
}

export function pulseCheckDailyAssignmentFromFirestore(
  id: string,
  data: Record<string, any>
): PulseCheckDailyAssignment {
  return {
    id,
    lineageId: data.lineageId || id,
    revision: typeof data.revision === 'number' ? data.revision : 1,
    previousRevision: data.previousRevision,
    athleteId: data.athleteId || '',
    teamId: data.teamId || '',
    teamMembershipId: data.teamMembershipId || '',
    coachId: data.coachId,
    sourceCheckInId: data.sourceCheckInId || '',
    sourceStateSnapshotId: data.sourceStateSnapshotId,
    sourceCandidateSetId: data.sourceCandidateSetId,
    sourceDate: data.sourceDate || '',
    timezone: data.timezone,
    sourceDateMode: data.sourceDateMode || 'athlete_local_day',
    assignedBy: 'nora',
    materializedAt: data.materializedAt || data.createdAt || Date.now(),
    materializedBy: data.materializedBy || 'nora_runtime',
    isPrimaryForDate: data.isPrimaryForDate ?? true,
    status: data.status || PulseCheckDailyAssignmentStatus.Assigned,
    actionType: data.actionType || 'sim',
    executionPattern: data.executionPattern || 'single',
    chosenCandidateId: data.chosenCandidateId,
    chosenCandidateType: data.chosenCandidateType,
    simSpecId: data.simSpecId,
    legacyExerciseId: data.legacyExerciseId,
    simFamilyLabel: data.simFamilyLabel,
    simVariantLabel: data.simVariantLabel,
    protocolId: data.protocolId,
    protocolFamilyId: data.protocolFamilyId,
    protocolVariantId: data.protocolVariantId,
    protocolVariantLabel: data.protocolVariantLabel,
    protocolVariantVersion: data.protocolVariantVersion,
    protocolPublishedAt: data.protocolPublishedAt,
    protocolPublishedRevisionId: data.protocolPublishedRevisionId,
    protocolLabel: data.protocolLabel,
    protocolClass: data.protocolClass,
    protocolCategory: data.protocolCategory,
    protocolResponseFamily: data.protocolResponseFamily,
    protocolDeliveryMode: data.protocolDeliveryMode,
    sessionType: data.sessionType,
    durationMode: data.durationMode,
    durationSeconds: data.durationSeconds,
    rationale: data.rationale || '',
    plannerSummary: data.plannerSummary,
    plannerAudit: data.plannerAudit,
    plannerConfidence: data.plannerConfidence,
    decisionSource: data.decisionSource,
    readinessScore: data.readinessScore,
    readinessBand: data.readinessBand,
    escalationTier: data.escalationTier,
    supportFlag: data.supportFlag,
    programSnapshot: data.programSnapshot,
    protocolPracticeSession: data.protocolPracticeSession,
    trainingPlanId: data.trainingPlanId,
    trainingPlanStepId: data.trainingPlanStepId,
    trainingPlanStepIndex: typeof data.trainingPlanStepIndex === 'number' ? data.trainingPlanStepIndex : undefined,
    trainingPlanStepLabel: data.trainingPlanStepLabel,
    trainingPlanIsPrimary: typeof data.trainingPlanIsPrimary === 'boolean' ? data.trainingPlanIsPrimary : undefined,
    isPlanOverride: data.isPlanOverride,
    overrideMetadata: data.overrideMetadata,
    supersededByDailyTaskId: data.supersededByDailyTaskId,
    supersededReason: data.supersededReason,
    executionLock: data.executionLock,
    phaseProgress: data.phaseProgress,
    completionSummary: data.completionSummary,
    pausedAt: typeof data.pausedAt === 'number' ? data.pausedAt : undefined,
    resumedAt: typeof data.resumedAt === 'number' ? data.resumedAt : undefined,
    expiredAt: typeof data.expiredAt === 'number' ? data.expiredAt : undefined,
    coachNotifiedAt: data.coachNotifiedAt,
    startedAt: data.startedAt,
    completedAt: data.completedAt,
    overriddenBy: data.overriddenBy,
    overrideReason: data.overrideReason,
    supersededAt: data.supersededAt,
    supersededByRevision: data.supersededByRevision,
    createdAt: data.createdAt || Date.now(),
    updatedAt: data.updatedAt || Date.now(),
  };
}

function stripUndefinedDeep<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((entry) => stripUndefinedDeep(entry)) as T;
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, entry]) => entry !== undefined)
        .map(([key, entry]) => [key, stripUndefinedDeep(entry)])
    ) as T;
  }

  return value;
}

export function pulseCheckProtocolDefinitionToFirestore(
  protocol: PulseCheckProtocolDefinition
): Record<string, any> {
  return stripUndefinedDeep({
    label: protocol.label,
    familyId: protocol.familyId,
    familyLabel: protocol.familyLabel,
    familyStatus: protocol.familyStatus,
    variantId: protocol.variantId,
    variantKey: protocol.variantKey,
    variantLabel: protocol.variantLabel,
    variantVersion: protocol.variantVersion,
    publishedRevisionId: protocol.publishedRevisionId || null,
    governanceStage: protocol.governanceStage,
    legacyExerciseId: protocol.legacyExerciseId,
    protocolClass: protocol.protocolClass,
    category: protocol.category,
    responseFamily: protocol.responseFamily,
    deliveryMode: protocol.deliveryMode,
    triggerTags: protocol.triggerTags,
    preferredContextTags: protocol.preferredContextTags,
    useWindowTags: protocol.useWindowTags,
    avoidWindowTags: protocol.avoidWindowTags,
    contraindicationTags: protocol.contraindicationTags,
    rationale: protocol.rationale,
    mechanism: protocol.mechanism,
    expectedStateShift: protocol.expectedStateShift,
    reviewNotes: protocol.reviewNotes || null,
    evidenceSummary: protocol.evidenceSummary || null,
    durationSeconds: protocol.durationSeconds,
    sortOrder: protocol.sortOrder,
    publishStatus: protocol.publishStatus,
    isActive: protocol.isActive,
    reviewStatus: protocol.reviewStatus,
    reviewChecklist: protocol.reviewChecklist,
    evidenceStatus: protocol.evidenceStatus,
    evidencePanel: protocol.evidencePanel || null,
    reviewCadenceDays: protocol.reviewCadenceDays,
    lastReviewedAt: protocol.lastReviewedAt || null,
    nextReviewAt: protocol.nextReviewAt || null,
    publishedAt: protocol.publishedAt || null,
    archivedAt: protocol.archivedAt || null,
    createdAt: protocol.createdAt,
    updatedAt: protocol.updatedAt,
  });
}

export function pulseCheckProtocolDefinitionFromFirestore(
  id: string,
  data: Record<string, any>
): PulseCheckProtocolDefinition {
  return {
    id,
    label: data.label || id,
    familyId: data.familyId || id,
    familyLabel: data.familyLabel || data.label || id,
    familyStatus: data.familyStatus || 'candidate',
    variantId: data.variantId || id,
    variantKey: data.variantKey || id,
    variantLabel: data.variantLabel || data.label || id,
    variantVersion: data.variantVersion || 'v1',
    publishedRevisionId: data.publishedRevisionId || undefined,
    governanceStage: data.governanceStage || (data.publishStatus === 'published' ? 'published' : data.publishStatus === 'archived' ? 'archived' : 'structured'),
    legacyExerciseId: data.legacyExerciseId || '',
    protocolClass: data.protocolClass || 'regulation',
    category: data.category || ExerciseCategory.Breathing,
    responseFamily: data.responseFamily || 'steady_regulation',
    deliveryMode: data.deliveryMode || 'guided_breathing',
    triggerTags: Array.isArray(data.triggerTags) ? data.triggerTags : [],
    preferredContextTags: Array.isArray(data.preferredContextTags) ? data.preferredContextTags : [],
    useWindowTags: Array.isArray(data.useWindowTags) ? data.useWindowTags : (Array.isArray(data.preferredContextTags) ? data.preferredContextTags : []),
    avoidWindowTags: Array.isArray(data.avoidWindowTags) ? data.avoidWindowTags : [],
    contraindicationTags: Array.isArray(data.contraindicationTags) ? data.contraindicationTags : [],
    rationale: data.rationale || '',
    mechanism: data.mechanism || data.rationale || '',
    expectedStateShift: data.expectedStateShift || '',
    reviewNotes: data.reviewNotes || undefined,
    evidenceSummary: data.evidenceSummary || undefined,
    durationSeconds: typeof data.durationSeconds === 'number' ? data.durationSeconds : 180,
    sortOrder: typeof data.sortOrder === 'number' ? data.sortOrder : 999,
    publishStatus: data.publishStatus || 'draft',
    isActive: data.isActive ?? true,
    reviewStatus: data.reviewStatus || 'not_started',
    reviewChecklist: Array.isArray(data.reviewChecklist) ? data.reviewChecklist : [],
    evidenceStatus: data.evidenceStatus || 'insufficient',
    evidencePanel: data.evidencePanel || undefined,
    reviewCadenceDays: typeof data.reviewCadenceDays === 'number' ? data.reviewCadenceDays : 30,
    lastReviewedAt: data.lastReviewedAt || undefined,
    nextReviewAt: data.nextReviewAt || undefined,
    publishedAt: data.publishedAt || undefined,
    archivedAt: data.archivedAt || undefined,
    createdAt: data.createdAt || Date.now(),
    updatedAt: data.updatedAt || Date.now(),
  };
}

export function pulseCheckProtocolFamilyToFirestore(
  family: PulseCheckProtocolFamily
): Record<string, any> {
  return stripUndefinedDeep({
    label: family.label,
    protocolClass: family.protocolClass,
    responseFamily: family.responseFamily,
    familyStatus: family.familyStatus,
    governanceStage: family.governanceStage,
    mechanismSummary: family.mechanismSummary,
    targetBottleneck: family.targetBottleneck,
    expectedStateShift: family.expectedStateShift,
    useWindowTags: family.useWindowTags,
    avoidWindowTags: family.avoidWindowTags,
    contraindicationTags: family.contraindicationTags,
    evidenceSummary: family.evidenceSummary || null,
    sourceReferences: family.sourceReferences,
    reviewNotes: family.reviewNotes || null,
    reviewStatus: family.reviewStatus,
    reviewChecklist: family.reviewChecklist,
    evidenceStatus: family.evidenceStatus,
    evidencePanel: family.evidencePanel || null,
    reviewCadenceDays: family.reviewCadenceDays,
    lastReviewedAt: family.lastReviewedAt || null,
    nextReviewAt: family.nextReviewAt || null,
    createdAt: family.createdAt,
    updatedAt: family.updatedAt,
  });
}

export function pulseCheckProtocolFamilyFromFirestore(
  id: string,
  data: Record<string, any>
): PulseCheckProtocolFamily {
  return {
    id,
    label: data.label || id,
    protocolClass: data.protocolClass || 'regulation',
    responseFamily: data.responseFamily || 'steady_regulation',
    familyStatus: data.familyStatus || 'candidate',
    governanceStage: data.governanceStage || 'structured',
    mechanismSummary: data.mechanismSummary || '',
    targetBottleneck: data.targetBottleneck || '',
    expectedStateShift: data.expectedStateShift || '',
    useWindowTags: Array.isArray(data.useWindowTags) ? data.useWindowTags : [],
    avoidWindowTags: Array.isArray(data.avoidWindowTags) ? data.avoidWindowTags : [],
    contraindicationTags: Array.isArray(data.contraindicationTags) ? data.contraindicationTags : [],
    evidenceSummary: data.evidenceSummary || undefined,
    sourceReferences: Array.isArray(data.sourceReferences) ? data.sourceReferences : [],
    reviewNotes: data.reviewNotes || undefined,
    reviewStatus: data.reviewStatus || 'not_started',
    reviewChecklist: Array.isArray(data.reviewChecklist) ? data.reviewChecklist : [],
    evidenceStatus: data.evidenceStatus || 'insufficient',
    evidencePanel: data.evidencePanel || undefined,
    reviewCadenceDays: typeof data.reviewCadenceDays === 'number' ? data.reviewCadenceDays : 30,
    lastReviewedAt: data.lastReviewedAt || undefined,
    nextReviewAt: data.nextReviewAt || undefined,
    createdAt: data.createdAt || Date.now(),
    updatedAt: data.updatedAt || Date.now(),
  };
}

export function pulseCheckProtocolVariantToFirestore(
  variant: PulseCheckProtocolVariant
): Record<string, any> {
  return stripUndefinedDeep({
    familyId: variant.familyId,
    label: variant.label,
    variantKey: variant.variantKey,
    variantVersion: variant.variantVersion,
    category: variant.category,
    deliveryMode: variant.deliveryMode,
    legacyExerciseId: variant.legacyExerciseId,
    rationale: variant.rationale,
    scriptSummary: variant.scriptSummary,
    durationSeconds: variant.durationSeconds,
    triggerTags: variant.triggerTags,
    preferredContextTags: variant.preferredContextTags,
    useWindowTags: variant.useWindowTags,
    avoidWindowTags: variant.avoidWindowTags,
    contraindicationTags: variant.contraindicationTags,
    evidenceSummary: variant.evidenceSummary || null,
    sourceReferences: variant.sourceReferences,
    reviewNotes: variant.reviewNotes || null,
    approvalStatus: variant.approvalStatus,
    reviewChecklist: variant.reviewChecklist,
    evidenceStatus: variant.evidenceStatus,
    evidencePanel: variant.evidencePanel || null,
    reviewCadenceDays: variant.reviewCadenceDays,
    lastReviewedAt: variant.lastReviewedAt || null,
    nextReviewAt: variant.nextReviewAt || null,
    governanceStage: variant.governanceStage,
    isActive: variant.isActive,
    createdAt: variant.createdAt,
    updatedAt: variant.updatedAt,
  });
}

export function pulseCheckProtocolVariantFromFirestore(
  id: string,
  data: Record<string, any>
): PulseCheckProtocolVariant {
  return {
    id,
    familyId: data.familyId || '',
    label: data.label || id,
    variantKey: data.variantKey || id,
    variantVersion: data.variantVersion || 'v1',
    category: data.category || ExerciseCategory.Breathing,
    deliveryMode: data.deliveryMode || 'guided_breathing',
    legacyExerciseId: data.legacyExerciseId || '',
    rationale: data.rationale || '',
    scriptSummary: data.scriptSummary || '',
    durationSeconds: typeof data.durationSeconds === 'number' ? data.durationSeconds : 180,
    triggerTags: Array.isArray(data.triggerTags) ? data.triggerTags : [],
    preferredContextTags: Array.isArray(data.preferredContextTags) ? data.preferredContextTags : [],
    useWindowTags: Array.isArray(data.useWindowTags) ? data.useWindowTags : [],
    avoidWindowTags: Array.isArray(data.avoidWindowTags) ? data.avoidWindowTags : [],
    contraindicationTags: Array.isArray(data.contraindicationTags) ? data.contraindicationTags : [],
    evidenceSummary: data.evidenceSummary || undefined,
    sourceReferences: Array.isArray(data.sourceReferences) ? data.sourceReferences : [],
    reviewNotes: data.reviewNotes || undefined,
    approvalStatus: data.approvalStatus || 'not_started',
    reviewChecklist: Array.isArray(data.reviewChecklist) ? data.reviewChecklist : [],
    evidenceStatus: data.evidenceStatus || 'insufficient',
    evidencePanel: data.evidencePanel || undefined,
    reviewCadenceDays: typeof data.reviewCadenceDays === 'number' ? data.reviewCadenceDays : 30,
    lastReviewedAt: data.lastReviewedAt || undefined,
    nextReviewAt: data.nextReviewAt || undefined,
    governanceStage: data.governanceStage || 'structured',
    isActive: data.isActive ?? true,
    createdAt: data.createdAt || Date.now(),
    updatedAt: data.updatedAt || Date.now(),
  };
}

export function pulseCheckProtocolResponsivenessProfileToFirestore(
  profile: PulseCheckProtocolResponsivenessProfile
): Record<string, any> {
  return {
    athleteId: profile.athleteId,
    familyResponses: profile.familyResponses,
    variantResponses: profile.variantResponses,
    sourceEventIds: profile.sourceEventIds,
    staleAt: profile.staleAt,
    lastUpdatedAt: profile.lastUpdatedAt,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
  };
}

export function pulseCheckProtocolResponsivenessProfileFromFirestore(
  id: string,
  data: Record<string, any>
): PulseCheckProtocolResponsivenessProfile {
  return {
    id,
    athleteId: data.athleteId || id,
    familyResponses: data.familyResponses && typeof data.familyResponses === 'object' ? data.familyResponses : {},
    variantResponses: data.variantResponses && typeof data.variantResponses === 'object' ? data.variantResponses : {},
    sourceEventIds: Array.isArray(data.sourceEventIds) ? data.sourceEventIds : [],
    staleAt: typeof data.staleAt === 'number' ? data.staleAt : Date.now(),
    lastUpdatedAt: typeof data.lastUpdatedAt === 'number' ? data.lastUpdatedAt : (typeof data.updatedAt === 'number' ? data.updatedAt : Date.now()),
    createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now(),
    updatedAt: typeof data.updatedAt === 'number' ? data.updatedAt : Date.now(),
  };
}

export function pulseCheckStateSnapshotToFirestore(
  snapshot: PulseCheckStateSnapshot
): Record<string, any> {
  const data: Record<string, any> = {
    athleteId: snapshot.athleteId,
    sourceDate: snapshot.sourceDate,
    sourceCheckInId: snapshot.sourceCheckInId,
    stateDimensions: sanitizeFirestoreValue(snapshot.stateDimensions),
    overallReadiness: snapshot.overallReadiness,
    confidence: snapshot.confidence,
    freshness: snapshot.freshness,
    sourcesUsed: snapshot.sourcesUsed,
    sourceEventIds: snapshot.sourceEventIds,
    contextTags: snapshot.contextTags,
    recommendedRouting: snapshot.recommendedRouting,
    createdAt: snapshot.createdAt,
    updatedAt: snapshot.updatedAt,
  };

  if (snapshot.rawSignalSummary) data.rawSignalSummary = sanitizeFirestoreValue(snapshot.rawSignalSummary);
  if (snapshot.enrichedInterpretation) data.enrichedInterpretation = sanitizeFirestoreValue(snapshot.enrichedInterpretation);
  if (snapshot.recommendedProtocolClass) data.recommendedProtocolClass = snapshot.recommendedProtocolClass;
  if (snapshot.candidateClassHints) data.candidateClassHints = snapshot.candidateClassHints;
  if (typeof snapshot.readinessScore === 'number') data.readinessScore = snapshot.readinessScore;
  if (typeof snapshot.supportFlag === 'boolean') data.supportFlag = snapshot.supportFlag;
  if (snapshot.decisionSource) data.decisionSource = snapshot.decisionSource;
  if (snapshot.executionLink) data.executionLink = snapshot.executionLink;

  return data;
}

export function pulseCheckStateSnapshotFromFirestore(
  id: string,
  data: Record<string, any>
): PulseCheckStateSnapshot {
  return {
    id,
    athleteId: data.athleteId || '',
    sourceDate: data.sourceDate || '',
    sourceCheckInId: data.sourceCheckInId || '',
    rawSignalSummary: data.rawSignalSummary,
    stateDimensions: {
      activation: data.stateDimensions?.activation ?? 50,
      focusReadiness: data.stateDimensions?.focusReadiness ?? 50,
      emotionalLoad: data.stateDimensions?.emotionalLoad ?? 50,
      cognitiveFatigue: data.stateDimensions?.cognitiveFatigue ?? 50,
    },
    overallReadiness: data.overallReadiness || 'yellow',
    confidence: data.confidence || 'low',
    freshness: data.freshness || 'degraded',
    enrichedInterpretation: data.enrichedInterpretation,
    sourcesUsed: Array.isArray(data.sourcesUsed) ? data.sourcesUsed : [],
    sourceEventIds: Array.isArray(data.sourceEventIds) ? data.sourceEventIds : [],
    contextTags: Array.isArray(data.contextTags) ? data.contextTags : [],
    recommendedRouting: data.recommendedRouting || 'sim_only',
    recommendedProtocolClass: data.recommendedProtocolClass,
    candidateClassHints: Array.isArray(data.candidateClassHints) ? data.candidateClassHints : [],
    readinessScore: data.readinessScore,
    supportFlag: typeof data.supportFlag === 'boolean' ? data.supportFlag : undefined,
    decisionSource: data.decisionSource,
    executionLink: data.executionLink,
    createdAt: data.createdAt || Date.now(),
    updatedAt: data.updatedAt || Date.now(),
  };
}

export function dailyCompletionToFirestore(completion: DailyCompletion): Record<string, any> {
  return {
    date: completion.date,
    completed: completion.completed,
    completionCount: completion.completionCount,
    targetCount: completion.targetCount,
    completions: completion.completions,
    createdAt: completion.createdAt,
    updatedAt: completion.updatedAt,
  };
}

export function dailyCompletionFromFirestore(id: string, data: Record<string, any>): DailyCompletion {
  return {
    id,
    date: data.date || id,
    completed: data.completed || false,
    completionCount: data.completionCount || 0,
    targetCount: data.targetCount || 1,
    completions: data.completions || [],
    createdAt: data.createdAt || Date.now(),
    updatedAt: data.updatedAt || Date.now(),
  };
}

export function athleteProgressToFirestore(progress: AthleteMentalProgress): Record<string, any> {
  const data: Record<string, any> = {
    athleteId: progress.athleteId,
    mprScore: progress.mprScore,
    mprLastCalculated: progress.mprLastCalculated,
    currentPathway: progress.currentPathway,
    pathwayStep: progress.pathwayStep,
    completedPathways: progress.completedPathways,
    foundationComplete: progress.foundationComplete,
    foundationBoxBreathingComplete: progress.foundationBoxBreathingComplete,
    foundationCheckInsComplete: progress.foundationCheckInsComplete,
    assessmentNeeded: progress.assessmentNeeded,
    totalExercisesMastered: progress.totalExercisesMastered,
    totalAssignmentsCompleted: progress.totalAssignmentsCompleted,
    currentStreak: progress.currentStreak,
    longestStreak: progress.longestStreak,
    createdAt: progress.createdAt,
    updatedAt: progress.updatedAt,
  };

  // Only include optional fields if they have values (Firestore doesn't allow undefined)
  if (progress.coachId) {
    data.coachId = progress.coachId;
  }
  if (progress.baselineAssessment) {
    data.baselineAssessment = progress.baselineAssessment;
  }
  if (progress.baselineProbe) {
    data.baselineProbe = progress.baselineProbe;
  }
  if (progress.activeAssignmentId) {
    data.activeAssignmentId = progress.activeAssignmentId;
  }
  if (progress.activeAssignmentExerciseName) {
    data.activeAssignmentExerciseName = progress.activeAssignmentExerciseName;
  }
  if (progress.taxonomyProfile) {
    data.taxonomyProfile = sanitizeFirestoreValue(progress.taxonomyProfile);
  }
  if (progress.activeProgram) {
    data.activeProgram = sanitizeFirestoreValue(progress.activeProgram);
  }
  if (typeof progress.lastProfileSyncAt === 'number') {
    data.lastProfileSyncAt = progress.lastProfileSyncAt;
  }
  if (progress.profileVersion) {
    data.profileVersion = progress.profileVersion;
  }

  return data;
}

function coerceMillis(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (value instanceof Date) {
    return value.getTime();
  }
  if (value && typeof value === 'object') {
    const candidate = value as { toMillis?: () => number; seconds?: number; nanoseconds?: number };
    if (typeof candidate.toMillis === 'function') {
      return candidate.toMillis();
    }
    if (typeof candidate.seconds === 'number') {
      const nanos = typeof candidate.nanoseconds === 'number' ? candidate.nanoseconds : 0;
      return candidate.seconds * 1000 + Math.floor(nanos / 1_000_000);
    }
  }
  return fallback;
}

export function athleteProgressFromFirestore(athleteId: string, data: Record<string, any>): AthleteMentalProgress {
  const now = Date.now();
  return {
    athleteId,
    coachId: data.coachId,
    mprScore: data.mprScore || 1,
    mprLastCalculated: coerceMillis(data.mprLastCalculated, now),
    currentPathway: data.currentPathway || MentalPathway.Foundation,
    pathwayStep: data.pathwayStep || 0,
    completedPathways: data.completedPathways || [],
    foundationComplete: data.foundationComplete || false,
    foundationBoxBreathingComplete: data.foundationBoxBreathingComplete || false,
    foundationCheckInsComplete: data.foundationCheckInsComplete || false,
    baselineAssessment: data.baselineAssessment,
    baselineProbe: data.baselineProbe,
    assessmentNeeded: data.assessmentNeeded ?? true,
    totalExercisesMastered: data.totalExercisesMastered || 0,
    totalAssignmentsCompleted: data.totalAssignmentsCompleted || 0,
    currentStreak: data.currentStreak || 0,
    longestStreak: data.longestStreak || 0,
    activeAssignmentId: data.activeAssignmentId,
    activeAssignmentExerciseName: data.activeAssignmentExerciseName,
    taxonomyProfile: data.taxonomyProfile,
    activeProgram: data.activeProgram,
    lastProfileSyncAt: data.lastProfileSyncAt ? coerceMillis(data.lastProfileSyncAt, now) : undefined,
    profileVersion: data.profileVersion,
    createdAt: coerceMillis(data.createdAt, now),
    updatedAt: coerceMillis(data.updatedAt, now),
  };
}
