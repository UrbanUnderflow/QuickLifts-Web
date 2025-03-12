/**
 * Utility functions for string formatting
 */

/**
 * Capitalizes first letter of each word in a string
 * Used for consistent exercise name formatting
 * 
 * @param text The string to capitalize
 * @returns The capitalized string
 */
export function capitalizeWords(text: string): string {
  if (!text) return '';
  
  return text
    .trim()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Formats an exercise name consistently for use as a document ID
 * 
 * @param exerciseName The exercise name to format
 * @returns The formatted exercise name
 */
export function formatExerciseNameForId(exerciseName: string): string {
  return capitalizeWords(exerciseName);
} 