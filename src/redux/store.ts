import { configureStore, combineReducers } from '@reduxjs/toolkit';
import userReducer from './userSlice';
import workoutReducer from './workoutSlice';
import devModeReducer from './devModeSlice';
import toastReducer from './toastSlice';
import loadingReducer from './loadingSlice';
import tempRedirectReducer from './tempRedirectSlice';
import { persistStore, persistReducer, FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER } from 'redux-persist';
import storage from 'redux-persist-indexeddb-storage';

// Next.js SSR-safe storage wrapper
const createNoopStorage = () => {
  return {
    getItem(_key: string) {
      return Promise.resolve(null);
    },
    setItem(_key: string, value: any) {
      return Promise.resolve(value);
    },
    removeItem(_key: string) {
      return Promise.resolve();
    },
  };
};

const appStorage = typeof window !== 'undefined' ? storage('quickliftsDB') : createNoopStorage();

// Create persist config for each reducer that needs persistence
const userPersistConfig = {
  key: 'user',
  storage: appStorage,
  whitelist: ['currentUser', 'isAuthenticated'], // Only persist these user state items
};

const workoutPersistConfig = {
  key: 'workout',
  storage: appStorage,
};

const devModePersistConfig = {
  key: 'devMode',
  storage: appStorage,
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
        ignoredActions: [
          FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER,
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