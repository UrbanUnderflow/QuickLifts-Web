// src/api/firebase/config.ts
import { initializeApp, getApps, deleteApp, FirebaseApp } from 'firebase/app';
import { getAuth, setPersistence, browserLocalPersistence, Auth } from "firebase/auth";
import { getFirestore, Firestore } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import { firebaseConfigs } from './firebase-config';

let firebaseApp: FirebaseApp;
let firebaseAuth: Auth;
let firebaseDb: Firestore;
let firebaseStorage: FirebaseStorage;

export const initializeFirebase = (isDev = false) => {
  console.log('[Firebase] Starting initialization:', {
    environment: isDev ? 'development' : 'production',
    timestamp: new Date().toISOString()
  });

  // Only delete app if it exists
  if (firebaseApp) {
    try {
      deleteApp(firebaseApp);
      console.log('[Firebase] Existing app deleted successfully');
    } catch (error) {
      console.error('[Firebase] Error deleting Firebase app:', error);
    }
  }

  try {
    const config = isDev ? firebaseConfigs.development : firebaseConfigs.production;

    firebaseApp = initializeApp(config);
    firebaseAuth = getAuth(firebaseApp);
    firebaseDb = getFirestore(firebaseApp);
    firebaseStorage = getStorage(firebaseApp);

    // Set persistence immediately after auth initialization
    if (typeof window !== 'undefined') {
      setPersistence(firebaseAuth, browserLocalPersistence)
        .then(() => console.log('[Firebase] Persistence set successfully to browserLocalPersistence'))
        .catch((error) => console.error('[Firebase] Error setting persistence:', error));
    } else {
      console.log('[Firebase] Skipping persistence setup (non-browser environment)');
    }

    console.log('[Firebase] Initialization complete:', {
      hasApp: !!firebaseApp,
      hasAuth: !!firebaseAuth,
      hasDb: !!firebaseDb,
      hasStorage: !!firebaseStorage,
      timestamp: new Date().toISOString()
    });

    return {
      app: firebaseApp,
      auth: firebaseAuth,
      db: firebaseDb,
      storage: firebaseStorage
    };
  } catch (error) {
    console.error('[Firebase] Error during initialization:', error);
    throw error;
  }
};

// Get initial mode from localStorage if available
const getInitialMode = () => {
  if (typeof window !== 'undefined') {
    const mode = window.localStorage.getItem('devMode') === 'true';
    console.log('[Firebase] Initial mode:', {
      isDev: mode,
      timestamp: new Date().toISOString()
    });
    return mode;
  }
  return false;
};

// Initialize with appropriate config
const { app, auth, db, storage } = initializeFirebase(getInitialMode());

// Ensure auth is available before exporting
if (!auth) {
  throw new Error('[Firebase] Auth was not properly initialized');
}

export { app, auth, db, storage };