/**
 * Utility functions for debugging environment variables
 * IMPORTANT: Only use during development and remove before production
 */

export const logEnvStatus = () => {
  if (process.env.NODE_ENV !== 'development') {
    console.warn('[EnvDebug] This function should only be used during development');
    return;
  }

  const isLocalhost = typeof window !== 'undefined' && window.location.hostname === 'localhost';
  const isDev = window.localStorage.getItem('devMode') === 'true';

  // Check which environment variables are available (without logging values)
  const envCheck = {
    production: {
      NEXT_PUBLIC_FIREBASE_API_KEY: !!process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: !!process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: !!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: !!process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: !!process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      NEXT_PUBLIC_FIREBASE_APP_ID: !!process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    },
    development: {
      NEXT_PUBLIC_DEV_FIREBASE_API_KEY: !!process.env.NEXT_PUBLIC_DEV_FIREBASE_API_KEY,
      NEXT_PUBLIC_DEV_FIREBASE_AUTH_DOMAIN: !!process.env.NEXT_PUBLIC_DEV_FIREBASE_AUTH_DOMAIN,
      NEXT_PUBLIC_DEV_FIREBASE_PROJECT_ID: !!process.env.NEXT_PUBLIC_DEV_FIREBASE_PROJECT_ID,
      NEXT_PUBLIC_DEV_FIREBASE_STORAGE_BUCKET: !!process.env.NEXT_PUBLIC_DEV_FIREBASE_STORAGE_BUCKET,
      NEXT_PUBLIC_DEV_FIREBASE_MESSAGING_SENDER_ID: !!process.env.NEXT_PUBLIC_DEV_FIREBASE_MESSAGING_SENDER_ID,
      NEXT_PUBLIC_DEV_FIREBASE_APP_ID: !!process.env.NEXT_PUBLIC_DEV_FIREBASE_APP_ID,
    },
    // Project IDs are safe to expose and useful for debugging
    projectIds: {
      production: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      development: process.env.NEXT_PUBLIC_DEV_FIREBASE_PROJECT_ID,
    }
  };

  // Log which config should be used based on current mode
  console.group('🔍 Environment Variables Status');
  
  console.log(`Environment: ${process.env.NODE_ENV}`);
  console.log(`Is Localhost: ${isLocalhost}`);
  console.log(`Mode: ${isDev ? 'Development' : 'Production'}`);
  console.log(`Config source: ${isLocalhost ? '.env.local' : (isDev ? 'firebaseConfigs' : 'Netlify')}`);
  
  if (isDev) {
    console.log('Development variables available:', envCheck.development);
    console.log('Using project ID:', envCheck.projectIds.development);
  } else {
    console.log('Production variables available:', envCheck.production);
    console.log('Using project ID:', envCheck.projectIds.production);
  }
  
  console.groupEnd();

  return {
    isLocalhost,
    isDev,
    configSource: isLocalhost ? '.env.local' : (isDev ? 'firebaseConfigs' : 'Netlify'),
    variables: isDev ? envCheck.development : envCheck.production,
    projectId: isDev ? envCheck.projectIds.development : envCheck.projectIds.production
  };
};

// Add to window object for easy console access during development
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  // @ts-ignore
  window.debugEnv = logEnvStatus;
  console.log('🛠️ Environment debug helper available! Run window.debugEnv() in console to check environment variables.');
} 