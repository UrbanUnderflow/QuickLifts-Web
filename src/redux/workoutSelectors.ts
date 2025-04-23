import { createSelector } from 'reselect';
import { RootState } from './store';

// Base selector for the workout state slice
const selectWorkoutState = (state: RootState) => state.workout;

// Selector for the current workout dictionary
export const selectCurrentWorkoutDict = createSelector(
  [selectWorkoutState],
  (workoutState) => workoutState.currentWorkout
);

// Selector for the current exercise logs dictionary array
export const selectCurrentExerciseLogsDict = createSelector(
  [selectWorkoutState],
  (workoutState) => workoutState.currentExerciseLogs || [] // Default to empty array if null/undefined
);

export const selectWorkoutSummaryDict = createSelector(
  (state: RootState) => state.workout.workoutSummary,
  (summary) => summary ?? null
); 