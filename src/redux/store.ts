import { configureStore, combineReducers } from '@reduxjs/toolkit';
import userReducer from './userSlice';
import workoutReducer from './workoutSlice';
import devModeReducer from './devModeSlice';
import toastReducer from './toastSlice';
import loadingReducer from './loadingSlice';
import tempRedirectReducer from './tempRedirectSlice';
import { persistStore, persistReducer } from 'redux-persist';
import storage from 'redux-persist-indexeddb-storage';

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

// Root reducer with all persisted reducers AND non-persisted reducers
const rootReducer = combineReducers({
  user: persistedUserReducer,
  workout: persistedWorkoutReducer,
  devMode: persistedDevModeReducer,
  toast: toastReducer,
  loading: loadingReducer,
  tempRedirect: tempRedirectReducer,
});

// Create the store with the persisted reducer
export const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Ignore these action types
        ignoredActions: [
          'user/setUser', 
          'tempRedirect/setRoundIdRedirect', // Can ignore if payload is just string
          'tempRedirect/clearRoundIdRedirect'
        ],
        // Ignore these field paths in all actions
        ignoredActionPaths: [
          'meta.arg', 
          'payload.createdAt', 
          'payload.updatedAt', 
          'payload.birthdate'
        ],
        // Ignore these paths in the state
        ignoredPaths: [
          'user.currentUser.createdAt',
          'user.currentUser.updatedAt',
          'user.currentUser.birthdate',
          'user.currentUser.lastActive',
          'user.currentUser.bodyWeight', 
          'user.currentUser.macros' 
        ],
      },
    }),
});

export const persistor = persistStore(store);

export type RootState = ReturnType<typeof rootReducer>;
export type AppDispatch = typeof store.dispatch;