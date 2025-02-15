import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Workout, WorkoutSummary } from '../api/firebase/workout/types';
import { ExerciseLog } from '../api/firebase/exercise/types';

interface WorkoutState {
  currentWorkout: Workout | null;
  currentExerciseLogs: ExerciseLog[];
  workoutSummary: WorkoutSummary | null;
}

const initialState: WorkoutState = {
  currentWorkout: null,
  currentExerciseLogs: [],
  workoutSummary: null
};

const workoutSlice = createSlice({
  name: 'workout',
  initialState,
  reducers: {
    clearWorkoutState: (state) => {
      return initialState;
    },
    setCurrentWorkout: (state, action: PayloadAction<Workout | null>) => {
      state.currentWorkout = action.payload;
    },
    setCurrentExerciseLogs: (state, action: PayloadAction<ExerciseLog[]>) => {
      state.currentExerciseLogs = action.payload;
    },
    setWorkoutSummary: (state, action: PayloadAction<WorkoutSummary | null>) => {
      state.workoutSummary = action.payload;
    },
    resetWorkoutState: (state) => {
      state.currentWorkout = null;
      state.currentExerciseLogs = [];
      state.workoutSummary = null;
    },
  },
});

export const { setCurrentWorkout, setCurrentExerciseLogs, setWorkoutSummary, resetWorkoutState } = workoutSlice.actions;
export default workoutSlice.reducer;