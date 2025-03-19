// src/api/firebase/config.ts
import { initializeApp, getApps, deleteApp, FirebaseApp } from 'firebase/app';
import { getAuth, setPersistence, browserLocalPersistence, Auth } from "firebase/auth";
import { getFirestore, Firestore } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';

let firebaseApp: FirebaseApp;
let firebaseAuth: Auth;
let firebaseDb: Firestore;
let firebaseStorage: FirebaseStorage;

const getFirebaseConfig = (isDev: boolean) => {
  const isLocalhost = typeof window !== 'undefined' && window.location.hostname === 'localhost';
  
  // Log specific environment variables we're interested in
  const envVarsToCheck = isDev ? [
    'NEXT_PUBLIC_DEV_FIREBASE_API_KEY',
    'NEXT_PUBLIC_DEV_FIREBASE_AUTH_DOMAIN',
    'NEXT_PUBLIC_DEV_FIREBASE_PROJECT_ID'
  ] : [
    'NEXT_PUBLIC_FIREBASE_API_KEY',
    'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
    'NEXT_PUBLIC_FIREBASE_PROJECT_ID'
  ];

  console.log('[Firebase Config] Environment Check:', {
    isDev,
    isLocalhost,
    nodeEnv: process.env.NODE_ENV,
    envVarsPresent: envVarsToCheck.reduce((acc, key) => {
      acc[key] = process.env[key] ? '✓ Present' : '✗ Missing';
      return acc;
    }, {} as Record<string, string>),
    timestamp: new Date().toISOString()
  });

  // Log the actual config we're going to use (without exposing full keys)
  const config = {
    apiKey: isDev ? process.env.NEXT_PUBLIC_DEV_FIREBASE_API_KEY : process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: isDev ? process.env.NEXT_PUBLIC_DEV_FIREBASE_AUTH_DOMAIN : process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: isDev ? process.env.NEXT_PUBLIC_DEV_FIREBASE_PROJECT_ID : process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: isDev ? process.env.NEXT_PUBLIC_DEV_FIREBASE_STORAGE_BUCKET : process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: isDev ? process.env.NEXT_PUBLIC_DEV_FIREBASE_MESSAGING_SENDER_ID : process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: isDev ? process.env.NEXT_PUBLIC_DEV_FIREBASE_APP_ID : process.env.NEXT_PUBLIC_FIREBASE_APP_ID
  };

  console.log('[Firebase Config] Final Configuration:', {
    mode: isDev ? 'development' : 'production',
    apiKey: config.apiKey,
    authDomain: config.authDomain,
    projectId: config.projectId,
    storageBucket: config.storageBucket,
    messagingSenderId: config.messagingSenderId,
    appId: config.appId,
    timestamp: new Date().toISOString()
  });

  return config;
};

const validateConfig = (config: any, isDev: boolean) => {
  const mode = isDev ? 'development' : 'production';
  const prefix = isDev ? 'NEXT_PUBLIC_DEV_FIREBASE_' : 'NEXT_PUBLIC_FIREBASE_';
  const requiredFields = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId'];
  
  const missingFields = requiredFields.filter(field => !config[field]);
  
  if (missingFields.length > 0) {
    const errorMessage = `
    Missing required Firebase configuration for ${mode} mode.
    Please check your .env.local file and ensure these environment variables are set:
    ${missingFields.map(field => `${prefix}${field.toUpperCase()}`).join('\n')}

    If you're running in development mode, make sure to:
    1. Create a .env.local file in your project root
    2. Add all required Firebase environment variables
    3. Restart your Next.js development server
        `;
    throw new Error(errorMessage);
  }
};

export const initializeFirebase = (isDev = false) => {
  const isLocalhost = typeof window !== 'undefined' && window.location.hostname === 'localhost';

  console.log('[Firebase] Starting initialization:', {
    environment: isDev ? 'development' : 'production',
    isLocalhost,
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
    // Get the configuration based on environment
    const config = getFirebaseConfig(isDev);
    
    // Validate configuration before proceeding
    validateConfig(config, isDev);
    
    // Log environment information
    console.log('[Firebase] Using configuration:', {
      mode: isDev ? 'development' : 'production',
      isLocalhost,
      projectId: config.projectId,
      hasApiKey: !!config.apiKey,
      hasAppId: !!config.appId,
      timestamp: new Date().toISOString()
    });

    // Initialize Firebase
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