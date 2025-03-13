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
    
    // Debug the configuration being used (without showing API keys)
    console.log('[Firebase] Configuration check:', {
      environment: isDev ? 'development' : 'production',
      apiKeyExists: !!config.apiKey,
      authDomainExists: !!config.authDomain,
      projectIdExists: !!config.projectId,
      storageBucketExists: !!config.storageBucket,
      messagingSenderIdExists: !!config.messagingSenderId,
      appIdExists: !!config.appId
    });

    // Check if required configuration exists
    if (!config.apiKey) {
      console.error('[Firebase] API key is missing. Please check your environment variables and ensure NEXT_PUBLIC_FIREBASE_API_KEY is set.');
      throw new Error('Firebase API key is missing. Check your environment configuration.');
    }
    
    const missingConfigs = [];
    if (!config.authDomain) missingConfigs.push('authDomain');
    if (!config.projectId) missingConfigs.push('projectId');
    if (!config.storageBucket) missingConfigs.push('storageBucket');
    
    if (missingConfigs.length > 0) {
      console.error(`[Firebase] Essential configuration is missing: ${missingConfigs.join(', ')}. Please check your environment variables.`);
      throw new Error(`Firebase configuration is incomplete. Missing: ${missingConfigs.join(', ')}`);
    }

    // Initialize Firebase app
    firebaseApp = initializeApp(config);
    
    // Initialize Firebase auth with error handling
    try {
      firebaseAuth = getAuth(firebaseApp);
      console.log('[Firebase] Auth service initialized successfully');
    } catch (authError) {
      console.error('[Firebase] Error initializing auth service:', authError);
      throw authError;
    }
    
    // Initialize Firestore and Storage
    firebaseDb = getFirestore(firebaseApp);
    firebaseStorage = getStorage(firebaseApp);

    // Set persistence only in browser environment
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
    try {
      const mode = window.localStorage.getItem('devMode') === 'true';
      console.log('[Firebase] Initial mode:', {
        isDev: mode,
        timestamp: new Date().toISOString()
      });
      return mode;
    } catch (error) {
      console.error('[Firebase] Error accessing localStorage:', error);
      return false;
    }
  }
  return false;
};

let app: FirebaseApp;
let auth: Auth;
let db: Firestore;
let storage: FirebaseStorage;

try {
  // Initialize with appropriate config
  const services = initializeFirebase(getInitialMode());
  
  app = services.app;
  auth = services.auth;
  db = services.db;
  storage = services.storage;

  // Ensure auth is available before exporting
  if (!auth) {
    throw new Error('[Firebase] Auth was not properly initialized');
  }
} catch (error) {
  console.error('[Firebase] Fatal initialization error:', error);
  
  // We need to provide fallback exports to prevent app from crashing completely
  // These services will throw appropriate errors when used
  const mockApp = {} as FirebaseApp;
  app = mockApp;
  auth = {} as Auth;
  db = {} as Firestore;
  storage = {} as FirebaseStorage;
}

export { app, auth, db, storage };