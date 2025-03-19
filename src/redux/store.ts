import { configureStore } from '@reduxjs/toolkit';
import userReducer from './userSlice';
import workoutReducer from './workoutSlice';
import devModeReducer from './devModeSlice';
import { persistStore, persistReducer } from 'redux-persist';
import storage from 'redux-persist-indexeddb-storage';
import { combineReducers } from 'redux';

// Create persist config for each reducer that needs persistence
const userPersistConfig = {
  key: 'user',
  storage: storage('quickliftsDB'),
  whitelist: ['currentUser', 'isAuthenticated'], // Only persist these user state items
};

const workoutPersistConfig = {
  key: 'workout',
  storage: storage('quickliftsDB'),
};

const devModePersistConfig = {
  key: 'devMode',
  storage: storage('quickliftsDB'),
};

// Create persisted reducers
const persistedUserReducer = persistReducer(userPersistConfig, userReducer);
const persistedWorkoutReducer = persistReducer(workoutPersistConfig, workoutReducer);
const persistedDevModeReducer = persistReducer(devModePersistConfig, devModeReducer);

// Root reducer with all persisted reducers
const rootReducer = combineReducers({
  user: persistedUserReducer,
  workout: persistedWorkoutReducer,
  devMode: persistedDevModeReducer,
});

// Create the store with the persisted reducer
export const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Ignore non-serializable values in the persist/REGISTER action
        ignoredActions: ['persist/REGISTER', 'persist/REHYDRATE', 'persist/PERSIST'],
      },
    }),
});

export const persistor = persistStore(store);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;