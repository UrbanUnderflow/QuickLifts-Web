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
