import { useSelector } from 'react-redux';
import { useMemo } from 'react';
import { RootState } from '../redux/store';
import { Workout } from '../api/firebase/workout/types';
import { ExerciseLog } from '../api/firebase/exercise/types';

// Import memoized selectors (will create shortly)
import {
  selectCurrentWorkoutDict,
  selectCurrentExerciseLogsDict,
} from '../redux/workoutSelectors';

export const useCurrentWorkout = (): Workout | null => {
  const workoutDict = useSelector(selectCurrentWorkoutDict);

  // Memoize transformation to avoid new object on every render
  const workout = useMemo(() => {
    return workoutDict ? new Workout(workoutDict) : null;
  }, [workoutDict]);

  return workout;
};

export const useCurrentExerciseLogs = (): ExerciseLog[] => {
  const logsDict: Record<string, any>[] = useSelector(selectCurrentExerciseLogsDict) as Record<string, any>[];

  const logs = useMemo(() => {
    return logsDict.map((log) => new ExerciseLog(log));
  }, [logsDict]);

  return logs;
}; 