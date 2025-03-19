import { ExerciseLog } from '../api/firebase/exercise/types';

export const calculateWorkoutDuration = (exerciseLogs: ExerciseLog[]): number => {
  return exerciseLogs.reduce((total, log) => {
    const screenTime = log.exercise.category?.details?.screenTime || 0;
    return total + screenTime;
  }, 0) / 60; // Convert seconds to minutes
}; 