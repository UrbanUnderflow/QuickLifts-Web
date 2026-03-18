const admin = require('firebase-admin');

// Helper to determine if the request is from localhost (can be passed in when importing the module)
const isDevMode = (request) => {
  if (!request) return false;
  const forcedHeader =
    request.headers?.['x-force-dev-firebase']
    || request.headers?.['X-Force-Dev-Firebase']
    || request.headers?.['x-pulsecheck-dev-firebase']
    || request.headers?.['X-PulseCheck-Dev-Firebase'];
  if (String(forcedHeader || '').toLowerCase() === 'true' || String(forcedHeader || '') === '1') {
    return true;
  }

  const referer = request.headers?.referer || request.headers?.origin || '';
  return referer.includes('localhost') || referer.includes('127.0.0.1');
};

// Helper function to properly format private key
const formatPrivateKey = (key) => {
  if (!key) return '';
  
  // Remove surrounding quotes and whitespace
  key = key.trim();
  if (key.startsWith('"') && key.endsWith('"')) {
    key = key.slice(1, -1);
  }
  if (key.startsWith("'") && key.endsWith("'")) {
    key = key.slice(1, -1);
  }
  
  // If the key has literal \n characters, replace them with actual newlines
  if (key.includes('\\n')) {
    key = key.replace(/\\n/g, '\n');
  }
  
  // If the key is already formatted properly, return it
  if (key.includes('-----BEGIN PRIVATE KEY-----') && key.includes('-----END PRIVATE KEY-----')) {
    return key;
  }
  
  // If it's just the key material without markers, add them
  if (!key.includes('-----BEGIN') && !key.includes('-----END')) {
    return `-----BEGIN PRIVATE KEY-----\n${key}\n-----END PRIVATE KEY-----`;
  }
  
  return key;
};

function findAppByName(name) {
  return admin.apps.find((app) => app && app.name === name) || null;
}

function buildCredentialConfig(projectId, privateKeyId, privateKey, clientEmail) {
  return {
    credential: admin.credential.cert({
      type: 'service_account',
      project_id: projectId,
      private_key_id: privateKeyId,
      private_key: privateKey,
      client_email: clientEmail,
      client_id: '111494077667496751062',
      auth_uri: 'https://accounts.google.com/o/oauth2/auth',
      token_uri: 'https://oauth2.googleapis.com/token',
      auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
      client_x509_cert_url: `https://www.googleapis.com/robot/v1/metadata/x509/${clientEmail.replace('@', '%40')}`,
    }),
    projectId,
  };
}

function initializeNamedAdminApp({ isDev }) {
  const appName = isDev ? 'pulsecheck-dev-admin' : 'pulsecheck-prod-admin';
  const existing = findAppByName(appName);
  if (existing) {
    return existing;
  }

  const projectId = isDev
    ? (process.env.DEV_FIREBASE_PROJECT_ID || 'quicklifts-dev-01')
    : (process.env.FIREBASE_PROJECT_ID || 'quicklifts-db4f1');
  const privateKeyId = isDev
    ? process.env.DEV_FIREBASE_PRIVATE_KEY
    : process.env.FIREBASE_PRIVATE_KEY;
  const rawPrivateKey = isDev
    ? (process.env.DEV_FIREBASE_SECRET_KEY || '')
    : (process.env.FIREBASE_SECRET_KEY || '');
  const privateKey = formatPrivateKey(rawPrivateKey);
  const clientEmail = isDev
    ? process.env.DEV_FIREBASE_CLIENT_EMAIL
    : (process.env.FIREBASE_CLIENT_EMAIL || 'firebase-adminsdk-1qxb0@quicklifts-db4f1.iam.gserviceaccount.com');

  console.log(`[Firebase Admin] Initializing named app ${appName} for project ${projectId}`);

  if (privateKey && clientEmail) {
    return admin.initializeApp(
      buildCredentialConfig(projectId, privateKeyId, privateKey, clientEmail),
      appName
    );
  }

  if (isDev) {
    console.warn('[Firebase Admin] Dev Firebase credentials missing, using application default credentials for local PulseCheck functions.');
  }

  try {
    return admin.initializeApp(
      {
        projectId,
        credential: admin.credential.applicationDefault(),
      },
      appName
    );
  } catch (error) {
    console.error('[Firebase Admin] Named initialization with application default failed:', error);
    return admin.initializeApp({ projectId }, appName);
  }
}

function getFirebaseAdminApp(request) {
  return initializeNamedAdminApp({ isDev: isDevMode(request) });
}

// Initialize Firebase dynamically based on request (if provided)
const initializeFirebaseAdmin = (request) => {
  const app = getFirebaseAdminApp(request);
  console.log(`[Firebase Admin] Active app ready: ${app.name}`);
  return admin;
};

// Initialize with default settings (will be overridden on first request)
if (admin.apps.length === 0) {
  // Default to production credentials for initial setup
  const projectId = process.env.FIREBASE_PROJECT_ID || "quicklifts-db4f1";
  const privateKeyId = process.env.FIREBASE_PRIVATE_KEY;
  const rawPrivateKey = process.env.FIREBASE_SECRET_KEY || '';
  const privateKey = formatPrivateKey(rawPrivateKey);
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL || "firebase-adminsdk-1qxb0@quicklifts-db4f1.iam.gserviceaccount.com";
  
  console.log(`[Firebase Admin] Initial setup with project: ${projectId}`);
  
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        type: "service_account",
        project_id: projectId,
        private_key_id: privateKeyId,
        private_key: privateKey,
        client_email: clientEmail,
        client_id: "111494077667496751062",
        auth_uri: "https://accounts.google.com/o/oauth2/auth",
        token_uri: "https://oauth2.googleapis.com/token",
        auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
        client_x509_cert_url: `https://www.googleapis.com/robot/v1/metadata/x509/${clientEmail.replace('@', '%40')}`
      })
    });
  } catch (error) {
    console.error('[Firebase Admin] Initial setup error:', error);
    // Don't throw here, just log the error
  }
}

const db = new Proxy({}, {
  get(_target, property) {
    const firestore = admin.firestore();
    const value = firestore[property];
    return typeof value === 'function' ? value.bind(firestore) : value;
  }
});

// Helper function to convert timestamps
const convertTimestamp = (timestamp) => {
  if (!timestamp) return null;
  
  // If it's a number (Unix timestamp), convert it
  if (typeof timestamp === 'number') {
    return new Date(timestamp * 1000).toISOString();
  }
  
  // Handle already converted date
  if (timestamp instanceof Date) {
    return timestamp.toISOString();
  }
  
  return null;
};

// Common headers for CORS
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
};

module.exports = {
  admin,
  db,
  convertTimestamp,
  headers,
  isDevMode,
  initializeFirebaseAdmin,
  getFirebaseAdminApp,
}; 
