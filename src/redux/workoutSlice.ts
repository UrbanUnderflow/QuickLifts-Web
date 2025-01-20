import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Workout } from '../api/firebase/workout/types';
import { ExerciseLog } from '../api/firebase/exercise/types';

interface WorkoutState {
  currentWorkout: Workout | null;
  currentExerciseLogs: ExerciseLog[];
}

const initialState: WorkoutState = {
  currentWorkout: null,
  currentExerciseLogs: [],
};

const workoutSlice = createSlice({
  name: 'workout',
  initialState,
  reducers: {
    setCurrentWorkout: (state, action: PayloadAction<Workout | null>) => {
      state.currentWorkout = action.payload;
    },
    setCurrentExerciseLogs: (state, action: PayloadAction<ExerciseLog[]>) => {
      state.currentExerciseLogs = action.payload;
    },
  },
});

export const { setCurrentWorkout, setCurrentExerciseLogs } = workoutSlice.actions;
export default workoutSlice.reducer;