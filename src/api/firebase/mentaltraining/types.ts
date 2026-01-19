/**
 * Nora Mental Training System - Data Types
 * 
 * Core data models for exercises, assignments, completions, streaks, and check-ins.
 */

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
  type: 'single_point' | 'distraction' | 'cue_word' | 'body_scan';
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

/**
 * MentalExercise - A reusable exercise template
 * Collection: mental-exercises
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
  iconName: string;
  isActive: boolean;
  sortOrder: number;
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
 * ExerciseAssignment - An exercise assigned to an athlete
 * Collection: mental-exercise-assignments
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
 * ExerciseCompletion - Record of a completed exercise
 * Collection: mental-exercise-completions/{userId}/completions
 */
export interface ExerciseCompletion {
  id: string;
  userId: string;
  exerciseId: string;
  exerciseName: string;
  exerciseCategory: ExerciseCategory;
  assignmentId?: string; // If completed from an assignment
  
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
  
  createdAt: number;
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
  
  createdAt: number;
  date: string; // YYYY-MM-DD for grouping
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
  assessmentNeeded: boolean;
  
  // Stats
  totalExercisesMastered: number;
  totalAssignmentsCompleted: number;
  currentStreak: number;
  longestStreak: number;
  
  // Active assignment tracking
  activeAssignmentId?: string;
  activeAssignmentExerciseName?: string;
  
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

export function exerciseToFirestore(exercise: MentalExercise): Record<string, any> {
  return {
    name: exercise.name,
    description: exercise.description,
    category: exercise.category,
    difficulty: exercise.difficulty,
    durationMinutes: exercise.durationMinutes,
    exerciseConfig: exercise.exerciseConfig,
    benefits: exercise.benefits,
    bestFor: exercise.bestFor,
    iconName: exercise.iconName,
    isActive: exercise.isActive,
    sortOrder: exercise.sortOrder,
    createdAt: exercise.createdAt,
    updatedAt: exercise.updatedAt,
  };
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
    iconName: data.iconName || 'brain',
    isActive: data.isActive ?? true,
    sortOrder: data.sortOrder || 0,
    createdAt: data.createdAt || Date.now(),
    updatedAt: data.updatedAt || Date.now(),
  };
}

export function assignmentToFirestore(assignment: ExerciseAssignment): Record<string, any> {
  return {
    athleteUserId: assignment.athleteUserId,
    exerciseId: assignment.exerciseId,
    exercise: assignment.exercise ? exerciseToFirestore(assignment.exercise) : null,
    source: assignment.source,
    assignedBy: assignment.assignedBy,
    assignedByName: assignment.assignedByName,
    reason: assignment.reason,
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
  return {
    userId: completion.userId,
    exerciseId: completion.exerciseId,
    exerciseName: completion.exerciseName,
    exerciseCategory: completion.exerciseCategory,
    assignmentId: completion.assignmentId,
    completedAt: completion.completedAt,
    durationSeconds: completion.durationSeconds,
    preExerciseMood: completion.preExerciseMood,
    postExerciseMood: completion.postExerciseMood,
    difficultyRating: completion.difficultyRating,
    helpfulnessRating: completion.helpfulnessRating,
    notes: completion.notes,
    context: completion.context,
    createdAt: completion.createdAt,
  };
}

export function completionFromFirestore(id: string, data: Record<string, any>): ExerciseCompletion {
  return {
    id,
    userId: data.userId || '',
    exerciseId: data.exerciseId || '',
    exerciseName: data.exerciseName || '',
    exerciseCategory: data.exerciseCategory || ExerciseCategory.Breathing,
    assignmentId: data.assignmentId,
    completedAt: data.completedAt || Date.now(),
    durationSeconds: data.durationSeconds || 0,
    preExerciseMood: data.preExerciseMood,
    postExerciseMood: data.postExerciseMood,
    difficultyRating: data.difficultyRating,
    helpfulnessRating: data.helpfulnessRating,
    notes: data.notes,
    context: data.context,
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
  return {
    userId: checkIn.userId,
    type: checkIn.type,
    readinessScore: checkIn.readinessScore,
    moodWord: checkIn.moodWord,
    energyLevel: checkIn.energyLevel,
    stressLevel: checkIn.stressLevel,
    sleepQuality: checkIn.sleepQuality,
    notes: checkIn.notes,
    suggestedExerciseId: checkIn.suggestedExerciseId,
    exerciseCompleted: checkIn.exerciseCompleted,
    createdAt: checkIn.createdAt,
    date: checkIn.date,
  };
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

  return data;
}

export function curriculumAssignmentFromFirestore(id: string, data: Record<string, any>): CurriculumAssignment {
  return {
    id,
    athleteId: data.athleteId || '',
    coachId: data.coachId || '',
    exerciseId: data.exerciseId || '',
    exercise: data.exercise ? exerciseFromFirestore(data.exerciseId, data.exercise) : undefined,
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
  if (progress.activeAssignmentId) {
    data.activeAssignmentId = progress.activeAssignmentId;
  }
  if (progress.activeAssignmentExerciseName) {
    data.activeAssignmentExerciseName = progress.activeAssignmentExerciseName;
  }

  return data;
}

export function athleteProgressFromFirestore(athleteId: string, data: Record<string, any>): AthleteMentalProgress {
  return {
    athleteId,
    coachId: data.coachId,
    mprScore: data.mprScore || 1,
    mprLastCalculated: data.mprLastCalculated || Date.now(),
    currentPathway: data.currentPathway || MentalPathway.Foundation,
    pathwayStep: data.pathwayStep || 0,
    completedPathways: data.completedPathways || [],
    foundationComplete: data.foundationComplete || false,
    foundationBoxBreathingComplete: data.foundationBoxBreathingComplete || false,
    foundationCheckInsComplete: data.foundationCheckInsComplete || false,
    baselineAssessment: data.baselineAssessment,
    assessmentNeeded: data.assessmentNeeded ?? true,
    totalExercisesMastered: data.totalExercisesMastered || 0,
    totalAssignmentsCompleted: data.totalAssignmentsCompleted || 0,
    currentStreak: data.currentStreak || 0,
    longestStreak: data.longestStreak || 0,
    activeAssignmentId: data.activeAssignmentId,
    activeAssignmentExerciseName: data.activeAssignmentExerciseName,
    createdAt: data.createdAt || Date.now(),
    updatedAt: data.updatedAt || Date.now(),
  };
}
