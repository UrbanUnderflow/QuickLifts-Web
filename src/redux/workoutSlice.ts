import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface WorkoutState {
  currentWorkout: Record<string, any> | null;
  currentExerciseLogs: Record<string, any>[];
  workoutSummary: Record<string, any> | null;
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
    clearWorkoutState: (_state) => {
      return initialState;
    },
    setCurrentWorkout: (state, action: PayloadAction<Record<string, any> | null>) => {
      state.currentWorkout = action.payload;
    },
    setCurrentExerciseLogs: (state, action: PayloadAction<Record<string, any>[]>) => {
      state.currentExerciseLogs = action.payload;
    },
    setWorkoutSummary: (state, action: PayloadAction<Record<string, any> | null>) => {
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