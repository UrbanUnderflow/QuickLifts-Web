import { useSelector } from 'react-redux';
import { RootState } from '../redux/store';
import { Workout } from '../api/firebase/workout/types';
import { ExerciseLog } from '../api/firebase/exercise/types';

export const useCurrentWorkout = (): Workout | null => {
  const workoutDict = useSelector((state: RootState) => state.workout.currentWorkout);
  return workoutDict ? new Workout(workoutDict) : null;
};

export const useCurrentExerciseLogs = (): ExerciseLog[] => {
  const logsDict = useSelector((state: RootState) => state.workout.currentExerciseLogs);
  return logsDict.map(log => new ExerciseLog(log));
}; 