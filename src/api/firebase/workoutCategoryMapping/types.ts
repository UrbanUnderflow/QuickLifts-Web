// src/api/firebase/workoutCategoryMapping/types.ts

/**
 * Workout types that can have exercise generation
 */
export type WorkoutType = 'lift' | 'stretch' | 'run' | 'fatBurn';

/**
 * Exercise category identifiers matching the iOS/Firestore schema
 */
export type ExerciseCategoryIdentifier = 
  | 'weight-training'
  | 'cardio'
  | 'mobility'
  | 'physique-prep'
  | 'body-weight';

/**
 * All available exercise categories
 */
export const ALL_EXERCISE_CATEGORIES: ExerciseCategoryIdentifier[] = [
  'weight-training',
  'cardio',
  'mobility',
  'physique-prep',
  'body-weight'
];

/**
 * Mapping configuration stored in Firestore
 */
export interface WorkoutCategoryMappingConfig {
  lift: ExerciseCategoryIdentifier[];
  stretch: ExerciseCategoryIdentifier[];
  version?: number;
  updatedAt?: number; // Unix timestamp
}

/**
 * Workout types that support exercise generation
 */
export const GENERATION_SUPPORTED_TYPES: WorkoutType[] = ['lift', 'stretch'];

/**
 * Display info for workout types
 */
export const WORKOUT_TYPE_INFO: Record<WorkoutType, {
  displayName: string;
  color: string;
  icon: string;
  supportsGeneration: boolean;
}> = {
  lift: {
    displayName: 'Lift',
    color: '#E0FE10', // Primary Green
    icon: 'dumbbell',
    supportsGeneration: true
  },
  stretch: {
    displayName: 'Stretch',
    color: '#A855F7', // Primary Purple
    icon: 'accessibility',
    supportsGeneration: true
  },
  run: {
    displayName: 'Run',
    color: '#3B82F6', // Primary Blue
    icon: 'directions_run',
    supportsGeneration: false
  },
  fatBurn: {
    displayName: 'Fat Burn',
    color: '#EF4444', // Secondary Red
    icon: 'local_fire_department',
    supportsGeneration: false
  }
};

/**
 * Display info for exercise categories
 */
export const EXERCISE_CATEGORY_INFO: Record<ExerciseCategoryIdentifier, {
  displayName: string;
  description: string;
}> = {
  'weight-training': {
    displayName: 'Weight Training',
    description: 'Resistance exercises using weights'
  },
  'cardio': {
    displayName: 'Cardio',
    description: 'Cardiovascular exercises'
  },
  'mobility': {
    displayName: 'Mobility',
    description: 'Flexibility and mobility exercises'
  },
  'physique-prep': {
    displayName: 'Physique Prep',
    description: 'Competition preparation exercises'
  },
  'body-weight': {
    displayName: 'Body Weight',
    description: 'Exercises using body weight only'
  }
};
