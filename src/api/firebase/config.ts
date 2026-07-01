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

type FirebaseConfigPrefix = 'NEXT_PUBLIC_FIREBASE_' | 'NEXT_PUBLIC_DEV_FIREBASE_';
type FirebaseConfigField = typeof FIREBASE_REQUIRED_FIELDS[number];
type FirebaseEnvConfig = Record<FirebaseConfigField, string | undefined>;

const PRODUCTION_FIREBASE_ENV: FirebaseEnvConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const DEVELOPMENT_FIREBASE_ENV: FirebaseEnvConfig = {
  apiKey: process.env.NEXT_PUBLIC_DEV_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_DEV_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_DEV_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_DEV_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_DEV_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_DEV_FIREBASE_APP_ID,
};

const isBrowserLocalhost = () =>
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

const getEnvKeyForFirebaseField = (prefix: FirebaseConfigPrefix, field: FirebaseConfigField) =>
  `${prefix}${field.replace(/[A-Z]/g, (match) => `_${match}`).toUpperCase()}`;

const getFirebaseEnvConfigForPrefix = (prefix: FirebaseConfigPrefix) =>
  prefix === 'NEXT_PUBLIC_DEV_FIREBASE_' ? DEVELOPMENT_FIREBASE_ENV : PRODUCTION_FIREBASE_ENV;

const isPlaceholderFirebaseValue = (value: string | undefined) => {
  if (!value) return true;

  const normalizedValue = value.trim().toLowerCase();
  return (
    normalizedValue === '' ||
    normalizedValue === 'set' ||
    normalizedValue.includes('placeholder') ||
    normalizedValue.includes('your_') ||
    normalizedValue.includes('000000000000') ||
    normalizedValue === 'local-preview.firebaseapp.com'
  );
};

const getFirebaseConfigStatusForPrefix = (prefix: FirebaseConfigPrefix) => {
  const envConfig = getFirebaseEnvConfigForPrefix(prefix);

  return FIREBASE_REQUIRED_FIELDS.every((field) => !isPlaceholderFirebaseValue(envConfig[field]));
};

const hasUsableFirebaseConfigForPrefix = getFirebaseConfigStatusForPrefix;

const getPreferredServerMode = () => {
  if (process.env.NEXT_PUBLIC_E2E_FORCE_DEV_FIREBASE === 'true') {
    return true;
  }

  if (process.env.NODE_ENV !== 'development') {
    return false;
  }

  const hasDevConfig = hasUsableFirebaseConfigForPrefix('NEXT_PUBLIC_DEV_FIREBASE_');
  if (hasDevConfig) {
    return true;
  }

  const hasProdConfig = hasUsableFirebaseConfigForPrefix('NEXT_PUBLIC_FIREBASE_');
  if (hasProdConfig) {
    return false;
  }

  return true;
};

const resolveClientFirebaseMode = () => {
  if (process.env.NEXT_PUBLIC_E2E_FORCE_DEV_FIREBASE === 'true') {
    return true;
  }

  if (typeof window === 'undefined') {
    return getPreferredServerMode();
  }

  const isLocalhost = isBrowserLocalhost();
  const forceDevFirebase = window.localStorage.getItem('forceDevFirebase') === 'true';
  const savedDevMode = window.localStorage.getItem('devMode');
  const hasExplicitDevMode = savedDevMode !== null;
  let mode = forceDevFirebase || (hasExplicitDevMode ? savedDevMode === 'true' : isLocalhost);

  const hasDevConfig = hasUsableFirebaseConfigForPrefix('NEXT_PUBLIC_DEV_FIREBASE_');
  const hasProdConfig = hasUsableFirebaseConfigForPrefix('NEXT_PUBLIC_FIREBASE_');
  if (mode && !hasDevConfig && hasProdConfig) {
    mode = false;
  }

  return mode;
};

const getFirebaseConfig = (isDev: boolean) => {
  const isLocalhost = isBrowserLocalhost();
  
  // Log specific environment variables we're interested in
  const envVarsToCheck = isDev ? [
    { key: 'NEXT_PUBLIC_DEV_FIREBASE_API_KEY', value: DEVELOPMENT_FIREBASE_ENV.apiKey },
    { key: 'NEXT_PUBLIC_DEV_FIREBASE_AUTH_DOMAIN', value: DEVELOPMENT_FIREBASE_ENV.authDomain },
    { key: 'NEXT_PUBLIC_DEV_FIREBASE_PROJECT_ID', value: DEVELOPMENT_FIREBASE_ENV.projectId }
  ] : [
    { key: 'NEXT_PUBLIC_FIREBASE_API_KEY', value: PRODUCTION_FIREBASE_ENV.apiKey },
    { key: 'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN', value: PRODUCTION_FIREBASE_ENV.authDomain },
    { key: 'NEXT_PUBLIC_FIREBASE_PROJECT_ID', value: PRODUCTION_FIREBASE_ENV.projectId }
  ];

  console.log('[Firebase Config] Environment Check:', {
    isDev,
    isLocalhost,
    nodeEnv: process.env.NODE_ENV,
    envVarsPresent: envVarsToCheck.reduce((acc, { key, value }) => {
      acc[key] = isPlaceholderFirebaseValue(value)
        ? '✗ Missing or placeholder'
        : '✓ Usable';
      return acc;
    }, {} as Record<string, string>),
    timestamp: new Date().toISOString()
  });

  // Log the actual config we're going to use (without exposing full keys)
  const config = isDev ? DEVELOPMENT_FIREBASE_ENV : PRODUCTION_FIREBASE_ENV;

  console.log('[Firebase Config] Final Configuration:', {
    mode: isDev ? 'development' : 'production',
    apiKey: config.apiKey ? `${config.apiKey.slice(0, 6)}...` : undefined,
    authDomain: config.authDomain,
    projectId: config.projectId,
    storageBucket: config.storageBucket,
    messagingSenderId: config.messagingSenderId ? 'configured' : undefined,
    appId: config.appId ? 'configured' : undefined,
    timestamp: new Date().toISOString()
  });

  return config;
};

const validateConfig = (config: any, isDev: boolean) => {
  const mode = isDev ? 'development' : 'production';
  const prefix = isDev ? 'NEXT_PUBLIC_DEV_FIREBASE_' : 'NEXT_PUBLIC_FIREBASE_';
  
  const invalidFields = FIREBASE_REQUIRED_FIELDS.filter(field => isPlaceholderFirebaseValue(config[field]));
  
  if (invalidFields.length > 0) {
    const errorMessage = `
    Missing or placeholder Firebase configuration for ${mode} mode.
    Please ensure these environment variables contain real Firebase web app values:
    ${invalidFields.map(field => getEnvKeyForFirebaseField(prefix, field)).join('\n')}

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
    const mode = resolveClientFirebaseMode();
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

export const isLocalFirebaseRuntime = () => isBrowserLocalhost();

export const isUsingDevFirebase = () => resolveClientFirebaseMode();

export const getActiveFirebaseProjectId = () =>
  resolveClientFirebaseMode()
    ? process.env.NEXT_PUBLIC_DEV_FIREBASE_PROJECT_ID || 'quicklifts-dev-01'
    : process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'quicklifts-dd3f1';

export const getFirebaseModeRequestHeaders = (): Record<string, string> => {
  const isDev = resolveClientFirebaseMode();
  return {
    'X-PulseCheck-Firebase-Mode': isDev ? 'dev' : 'prod',
    'X-PulseCheck-Dev-Firebase': isDev ? 'true' : 'false',
    'X-PulseCheck-Firebase-Project-Id': getActiveFirebaseProjectId(),
  };
};

export const setPreferredFirebaseMode = (isDev: boolean) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem('devMode', isDev ? 'true' : 'false');
  window.localStorage.setItem('dopplerConfig', isDev ? 'dev_backend' : 'prd_backend');
  if (!isDev) {
    window.localStorage.removeItem('forceDevFirebase');
  }
};
