// src/api/firebase/workoutCategoryMapping/service.ts

import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../config';
import { 
  WorkoutCategoryMappingConfig, 
  WorkoutType, 
  ExerciseCategoryIdentifier,
  GENERATION_SUPPORTED_TYPES 
} from './types';

/**
 * Default mapping used when Firestore config is unavailable.
 * Maps workout type identifiers to arrays of allowed exercise category identifiers.
 *
 * - lift: Weight training exercises (can expand to include physique-prep, body-weight in future)
 * - stretch: Mobility exercises (can expand to include a dedicated stretch category in future)
 */
const DEFAULT_MAPPING: WorkoutCategoryMappingConfig = {
  lift: ['weight-training'],
  stretch: ['mobility'],
  version: 1
};

/**
 * Firestore document path for the configuration
 */
const CONFIG_DOC_PATH = 'config/workoutCategoryMapping';

/**
 * Cache for the mapping configuration
 */
let cachedMapping: WorkoutCategoryMappingConfig | null = null;
let cacheTimestamp: number | null = null;
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Checks if the cache is still valid
 */
const isCacheValid = (): boolean => {
  if (!cachedMapping || !cacheTimestamp) return false;
  return Date.now() - cacheTimestamp < CACHE_DURATION_MS;
};

/**
 * Fetches the workout category mapping from Firestore.
 * Returns cached value if available and not expired.
 * Falls back to defaults if Firestore fetch fails.
 * 
 * @returns The mapping configuration
 */
export const fetchWorkoutCategoryMapping = async (): Promise<WorkoutCategoryMappingConfig> => {
  // Return cached value if valid
  if (isCacheValid() && cachedMapping) {
    return cachedMapping;
  }

  try {
    const docRef = doc(db, CONFIG_DOC_PATH);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data() as Partial<WorkoutCategoryMappingConfig>;
      
      // Validate and merge with defaults
      const mapping: WorkoutCategoryMappingConfig = {
        lift: Array.isArray(data.lift) ? data.lift : DEFAULT_MAPPING.lift,
        stretch: Array.isArray(data.stretch) ? data.stretch : DEFAULT_MAPPING.stretch,
        version: typeof data.version === 'number' ? data.version : DEFAULT_MAPPING.version,
        updatedAt: typeof data.updatedAt === 'number' ? data.updatedAt : undefined
      };

      // Update cache
      cachedMapping = mapping;
      cacheTimestamp = Date.now();

      console.log('[WorkoutCategoryMapping] Fetched from Firestore:', mapping);
      return mapping;
    } else {
      console.log('[WorkoutCategoryMapping] No config found in Firestore, using defaults');
      cachedMapping = DEFAULT_MAPPING;
      cacheTimestamp = Date.now();
      return DEFAULT_MAPPING;
    }
  } catch (error) {
    console.error('[WorkoutCategoryMapping] Error fetching from Firestore:', error);
    return DEFAULT_MAPPING;
  }
};

/**
 * Updates the workout category mapping in Firestore.
 * 
 * @param mapping - The new mapping configuration to save
 * @returns True if successful, false otherwise
 */
export const updateWorkoutCategoryMapping = async (
  mapping: Partial<WorkoutCategoryMappingConfig>
): Promise<boolean> => {
  try {
    const docRef = doc(db, CONFIG_DOC_PATH);
    
    const dataToSave: WorkoutCategoryMappingConfig = {
      lift: mapping.lift ?? DEFAULT_MAPPING.lift,
      stretch: mapping.stretch ?? DEFAULT_MAPPING.stretch,
      version: (mapping.version ?? 0) + 1,
      updatedAt: Math.floor(Date.now() / 1000) // Unix timestamp in seconds
    };

    await setDoc(docRef, dataToSave);

    // Update cache
    cachedMapping = dataToSave;
    cacheTimestamp = Date.now();

    console.log('[WorkoutCategoryMapping] Saved to Firestore:', dataToSave);
    return true;
  } catch (error) {
    console.error('[WorkoutCategoryMapping] Error saving to Firestore:', error);
    return false;
  }
};

/**
 * Returns the allowed exercise categories for a given workout type.
 * Uses cached mapping if available.
 * 
 * @param workoutType - The workout type to get categories for
 * @returns Array of allowed category identifiers
 */
export const getAllowedCategories = async (
  workoutType: WorkoutType
): Promise<ExerciseCategoryIdentifier[]> => {
  const mapping = await fetchWorkoutCategoryMapping();
  
  switch (workoutType) {
    case 'lift':
      return mapping.lift;
    case 'stretch':
      return mapping.stretch;
    default:
      return [];
  }
};

/**
 * Synchronous version using cached mapping.
 * Returns empty array if cache is not populated.
 * 
 * @param workoutType - The workout type to get categories for
 * @returns Array of allowed category identifiers
 */
export const getAllowedCategoriesSync = (
  workoutType: WorkoutType
): ExerciseCategoryIdentifier[] => {
  const mapping = cachedMapping ?? DEFAULT_MAPPING;
  
  switch (workoutType) {
    case 'lift':
      return mapping.lift;
    case 'stretch':
      return mapping.stretch;
    default:
      return [];
  }
};

/**
 * Checks if a workout type supports exercise generation.
 * 
 * @param workoutType - The workout type to check
 * @returns True if the workout type supports generation
 */
export const supportsGeneration = (workoutType: WorkoutType): boolean => {
  return GENERATION_SUPPORTED_TYPES.includes(workoutType);
};

/**
 * Checks if an exercise category is allowed for a given workout type.
 * 
 * @param category - The category identifier to check
 * @param workoutType - The workout type
 * @returns True if the category is allowed
 */
export const isCategoryAllowed = async (
  category: ExerciseCategoryIdentifier,
  workoutType: WorkoutType
): Promise<boolean> => {
  const allowedCategories = await getAllowedCategories(workoutType);
  return allowedCategories.includes(category);
};

/**
 * Filters an array of exercises by allowed categories for a workout type.
 * 
 * @param exercises - Array of exercises with category property
 * @param workoutType - The workout type to filter for
 * @returns Filtered array of exercises
 */
export const filterExercisesByCategory = async <T extends { category?: string }>(
  exercises: T[],
  workoutType: WorkoutType
): Promise<T[]> => {
  if (!supportsGeneration(workoutType)) {
    return [];
  }

  const allowedCategories = await getAllowedCategories(workoutType);
  
  return exercises.filter(exercise => {
    const category = exercise.category;
    if (!category) return false;
    return allowedCategories.includes(category as ExerciseCategoryIdentifier);
  });
};

/**
 * Gets the current mapping (synchronous, from cache or defaults).
 * Useful for admin UI to display current state.
 * 
 * @returns The current mapping configuration
 */
export const getCurrentMappingSync = (): WorkoutCategoryMappingConfig => {
  return cachedMapping ?? DEFAULT_MAPPING;
};

/**
 * Clears the cache, forcing the next request to fetch from Firestore.
 */
export const clearCache = (): void => {
  cachedMapping = null;
  cacheTimestamp = null;
};

/**
 * Gets the default mapping (for fallback or reset purposes).
 * 
 * @returns The default mapping configuration
 */
export const getDefaultMapping = (): WorkoutCategoryMappingConfig => {
  return { ...DEFAULT_MAPPING };
};
