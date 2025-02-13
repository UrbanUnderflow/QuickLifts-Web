import { configureStore } from '@reduxjs/toolkit';
import userReducer from './userSlice';
import workoutReducer from './workoutSlice';
import devModeReducer from './devModeSlice';

export const store = configureStore({
  reducer: {
    user: userReducer,
    workout: workoutReducer,
    devMode: devModeReducer,
    // Add other reducers here as your app grows
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;