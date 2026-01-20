/**
 * Fetches Firebase service account from Firestore using minimal credentials.
 * This allows us to bypass Netlify's 4KB environment variable limit.
 * 
 * Setup:
 * 1. Run the upload script to store your service account in Firestore
 * 2. Set these small env vars in Netlify:
 *    - FIREBASE_PROJECT_ID
 *    - FIREBASE_CLIENT_EMAIL  
 *    - FIREBASE_PRIVATE_KEY (can be split if needed)
 */

import * as admin from 'firebase-admin';

// Cache the service account to avoid repeated Firestore reads
let cachedServiceAccount: admin.ServiceAccount | null = null;
let adminApp: admin.app.App | null = null;

/**
 * Synchronous initializer used by some Netlify functions.
 *
 * Note: This intentionally returns the `firebase-admin` namespace so callers can
 * use `admin.messaging()`, `admin.firestore()`, etc. It shares the same env var
 * parsing logic as `getFirebaseAdmin()` and avoids double-initialization.
 */
export function initAdmin(): typeof admin {
  // If we've already initialized (either via this module or elsewhere), reuse it.
  if (adminApp) return admin;
  if (admin.apps?.length) {
    adminApp = admin.app();
    return admin;
  }

  // First, try to use the full service account if it exists and fits.
  const fullServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (fullServiceAccount) {
    try {
      const serviceAccount = JSON.parse(fullServiceAccount);
      adminApp = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      console.log('[initAdmin] Initialized with full service account');
      return admin;
    } catch (e) {
      console.warn('[initAdmin] Failed to parse full service account, trying split method');
    }
  }

  // Try split environment variables method.
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;

  // Handle split private key (for very long keys).
  if (!privateKey && process.env.FIREBASE_PRIVATE_KEY_1) {
    privateKey = [
      process.env.FIREBASE_PRIVATE_KEY_1 || '',
      process.env.FIREBASE_PRIVATE_KEY_2 || '',
      process.env.FIREBASE_PRIVATE_KEY_3 || '',
      process.env.FIREBASE_PRIVATE_KEY_4 || '',
    ].join('');
  }

  if (projectId && clientEmail && privateKey) {
    let formattedPrivateKey = privateKey;

    // If the key contains literal \n strings, replace them with actual newlines.
    if (formattedPrivateKey.includes('\\n')) {
      formattedPrivateKey = formattedPrivateKey.replace(/\\n/g, '\n');
    }

    // If it's been double-escaped (\\\\n), handle that too.
    if (formattedPrivateKey.includes('\\\\n')) {
      formattedPrivateKey = formattedPrivateKey.replace(/\\\\n/g, '\n');
    }

    if (!formattedPrivateKey.includes('-----BEGIN')) {
      console.error('[initAdmin] Private key missing PEM headers');
      throw new Error('Invalid private key format - missing PEM headers');
    }

    try {
      adminApp = admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey: formattedPrivateKey,
        } as admin.ServiceAccount),
      });
      console.log('[initAdmin] Initialized with split credentials');
      return admin;
    } catch (e: any) {
      console.error('[initAdmin] Failed to initialize with split credentials:', e.message);
      throw new Error(`Failed to parse private key: ${e.message}`);
    }
  }

  throw new Error(
    'Firebase Admin credentials not found. Set either FIREBASE_SERVICE_ACCOUNT or FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY'
  );
}

/**
 * Initialize Firebase Admin with minimal credentials or fetch from Firestore
 */
export async function getFirebaseAdmin(): Promise<admin.app.App> {
  if (adminApp) {
    return adminApp;
  }

  // First, try to use the full service account if it exists and fits
  const fullServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (fullServiceAccount) {
    try {
      const serviceAccount = JSON.parse(fullServiceAccount);
      adminApp = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      console.log('[getFirebaseAdmin] Initialized with full service account');
      return adminApp;
    } catch (e) {
      console.warn('[getFirebaseAdmin] Failed to parse full service account, trying split method');
    }
  }

  // Try split environment variables method
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;

  // Handle split private key (for very long keys)
  if (!privateKey && process.env.FIREBASE_PRIVATE_KEY_1) {
    privateKey = [
      process.env.FIREBASE_PRIVATE_KEY_1 || '',
      process.env.FIREBASE_PRIVATE_KEY_2 || '',
      process.env.FIREBASE_PRIVATE_KEY_3 || '',
      process.env.FIREBASE_PRIVATE_KEY_4 || '',
    ].join('');
  }

  if (projectId && clientEmail && privateKey) {
    // Handle various formats of the private key
    let formattedPrivateKey = privateKey.trim();
    
    // Remove surrounding quotes if present
    if (formattedPrivateKey.startsWith('"') && formattedPrivateKey.endsWith('"')) {
      formattedPrivateKey = formattedPrivateKey.slice(1, -1);
    }
    if (formattedPrivateKey.startsWith("'") && formattedPrivateKey.endsWith("'")) {
      formattedPrivateKey = formattedPrivateKey.slice(1, -1);
    }
    
    // If the key contains literal \n strings, replace them with actual newlines
    if (formattedPrivateKey.includes('\\n')) {
      formattedPrivateKey = formattedPrivateKey.replace(/\\n/g, '\n');
    }
    
    // If it's been double-escaped (\\\\n), handle that too
    if (formattedPrivateKey.includes('\\\\n')) {
      formattedPrivateKey = formattedPrivateKey.replace(/\\\\n/g, '\n');
    }
    
    // If the key is missing proper PEM headers/footers, try to add them
    if (!formattedPrivateKey.includes('-----BEGIN')) {
      // If it's just the key material without markers, add them
      if (!formattedPrivateKey.includes('-----BEGIN') && !formattedPrivateKey.includes('-----END')) {
        formattedPrivateKey = `-----BEGIN PRIVATE KEY-----\n${formattedPrivateKey}\n-----END PRIVATE KEY-----`;
      } else {
        console.error('[getFirebaseAdmin] Private key missing PEM headers');
        throw new Error('Invalid private key format - missing PEM headers');
      }
    }
    
    try {
      adminApp = admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey: formattedPrivateKey,
        } as admin.ServiceAccount),
      });
      console.log('[getFirebaseAdmin] Initialized with split credentials');
      return adminApp;
    } catch (e: any) {
      console.error('[getFirebaseAdmin] Failed to initialize with split credentials:', e.message);
      throw new Error(`Failed to parse private key: ${e.message}`);
    }
  }

  throw new Error(
    'Firebase Admin credentials not found. Set either FIREBASE_SERVICE_ACCOUNT or FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY'
  );
}

/**
 * Get Firestore instance
 */
export async function getFirestore(): Promise<admin.firestore.Firestore> {
  const app = await getFirebaseAdmin();
  return app.firestore();
}
