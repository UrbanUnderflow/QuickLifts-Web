// src/api/firebase/config.ts
import { initializeApp, deleteApp, FirebaseApp } from 'firebase/app';
import { getAuth, setPersistence, browserLocalPersistence, Auth } from "firebase/auth";
import { getFirestore, Firestore } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import { installPulseE2EHarness } from './mentaltraining/e2eHarness';

let firebaseApp: FirebaseApp;
let firebaseAuth: Auth;
let firebaseDb: Firestore;
let firebaseStorage: FirebaseStorage;

const FIREBASE_REQUIRED_FIELDS = [
  'apiKey',
  'authDomain',
  'projectId',
  'storageBucket',
  'messagingSenderId',
  'appId',
] as const;

const isBrowserLocalhost = () =>
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

const hasFirebaseConfigForPrefix = (prefix: 'NEXT_PUBLIC_FIREBASE_' | 'NEXT_PUBLIC_DEV_FIREBASE_') =>
  FIREBASE_REQUIRED_FIELDS.every((field) => {
    const envKey = `${prefix}${field.replace(/[A-Z]/g, (match) => `_${match}`).toUpperCase()}`;
    return !!process.env[envKey];
  });

const getPreferredServerMode = () => {
  if (process.env.NEXT_PUBLIC_E2E_FORCE_DEV_FIREBASE === 'true') {
    return true;
  }

  if (process.env.NODE_ENV !== 'development') {
    return false;
  }

  const hasDevConfig = hasFirebaseConfigForPrefix('NEXT_PUBLIC_DEV_FIREBASE_');
  if (hasDevConfig) {
    return true;
  }

  const hasProdConfig = hasFirebaseConfigForPrefix('NEXT_PUBLIC_FIREBASE_');
  if (hasProdConfig) {
    return false;
  }

  return true;
};

const getFirebaseConfig = (isDev: boolean) => {
  const isLocalhost = isBrowserLocalhost();
  
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
  
  const missingFields = FIREBASE_REQUIRED_FIELDS.filter(field => !config[field]);
  
  if (missingFields.length > 0) {
    const errorMessage = `
    Missing required Firebase configuration for ${mode} mode.
    Please ensure these environment variables are available in local dev:
    ${missingFields.map(field => `${prefix}${field.replace(/[A-Z]/g, (match) => `_${match}`).toUpperCase()}`).join('\n')}

    If these values live in Netlify already, make sure this machine is logged in and linked:
    1. netlify login
    2. netlify link
    3. Restart your Next.js development server

    If you use local env files instead, make sure to:
    1. Create a .env.local file in your project root
    2. Add all required Firebase environment variables
    3. Restart your Next.js development server
        `;
    throw new Error(errorMessage);
  }
};

export const initializeFirebase = (isDev = false) => {
  const isLocalhost = isBrowserLocalhost();

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
  if (process.env.NEXT_PUBLIC_E2E_FORCE_DEV_FIREBASE === 'true') {
    console.log('[Firebase] E2E mode forcing development Firebase config');
    return true;
  }
  if (typeof window !== 'undefined') {
    const isLocalhost = isBrowserLocalhost();
    const forceDevFirebase = window.localStorage.getItem('forceDevFirebase') === 'true';
    const savedDevMode = window.localStorage.getItem('devMode');
    const hasExplicitDevMode = savedDevMode !== null;
    let mode = forceDevFirebase
      || (hasExplicitDevMode ? savedDevMode === 'true' : isLocalhost);
      
    // Fall back to production config if dev keys are missing
    const hasDevKeys = !!process.env.NEXT_PUBLIC_DEV_FIREBASE_API_KEY;
    const hasProdKeys = !!process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
    if (mode && !hasDevKeys && hasProdKeys) {
      mode = false;
    }
    console.log('[Firebase] Initial mode:', {
      isDev: mode,
      source: forceDevFirebase
        ? 'forceDevFirebase'
        : (hasExplicitDevMode ? 'devMode localStorage' : (isLocalhost ? 'localhost default' : 'production default')),
      timestamp: new Date().toISOString()
    });
    return mode;
  }
  const serverMode = getPreferredServerMode();
  console.log('[Firebase] Initial mode (server):', {
    isDev: serverMode,
    source: process.env.NODE_ENV === 'development'
      ? 'server development fallback'
      : 'server production default',
    timestamp: new Date().toISOString()
  });
  return serverMode;
};

// Initialize with appropriate config
const { app, auth, db, storage } = initializeFirebase(getInitialMode());

// Ensure auth is available before exporting
if (!auth) {
  throw new Error('[Firebase] Auth was not properly initialized');
}

if (typeof window !== 'undefined') {
  const isLocalhost = isBrowserLocalhost();
  const shouldInstallE2EHarness =
    isLocalhost ||
    process.env.NEXT_PUBLIC_E2E_FORCE_DEV_FIREBASE === 'true' ||
    window.localStorage.getItem('forceDevFirebase') === 'true';

  if (shouldInstallE2EHarness) {
    installPulseE2EHarness(db);
  }
}

export { app, auth, db, storage };
