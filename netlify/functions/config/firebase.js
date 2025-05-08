const admin = require('firebase-admin');

// Helper to determine if the request is from localhost (can be passed in when importing the module)
const isDevMode = (request) => {
  if (!request) return false;
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

// Initialize Firebase dynamically based on request (if provided)
const initializeFirebaseAdmin = (request) => {
  // Check if we're in dev mode
  const isDev = isDevMode(request);
  
  // Log for debugging
  console.log(`[Firebase Admin] Initializing with mode: ${isDev ? 'DEVELOPMENT' : 'PRODUCTION'}`);
  
  // Get the appropriate Firebase project configuration
  const projectId = isDev 
    ? (process.env.DEV_FIREBASE_PROJECT_ID || 'quicklifts-dev-01') 
    : (process.env.FIREBASE_PROJECT_ID || 'quicklifts-db4f1');
    
  const privateKeyId = isDev
    ? (process.env.DEV_FIREBASE_PRIVATE_KEY || process.env.FIREBASE_PRIVATE_KEY)
    : process.env.FIREBASE_PRIVATE_KEY;
  
  // Use the helper function to format the private key correctly
  const rawPrivateKey = isDev
    ? (process.env.DEV_FIREBASE_SECRET_KEY || process.env.FIREBASE_SECRET_KEY || '')
    : (process.env.FIREBASE_SECRET_KEY || '');
    
  const privateKey = formatPrivateKey(rawPrivateKey);
  
  const clientEmail = isDev
    ? (process.env.DEV_FIREBASE_CLIENT_EMAIL || process.env.FIREBASE_CLIENT_EMAIL)
    : (process.env.FIREBASE_CLIENT_EMAIL || "firebase-adminsdk-1qxb0@quicklifts-db4f1.iam.gserviceaccount.com");
  
  // Check if dev credentials are missing but needed
  if (isDev && 
      (!process.env.DEV_FIREBASE_PROJECT_ID || 
       !process.env.DEV_FIREBASE_SECRET_KEY || 
       !process.env.DEV_FIREBASE_CLIENT_EMAIL)) {
    console.warn(`[Firebase Admin] WARNING: Development mode active but some dev credentials are missing!
      - DEV_FIREBASE_PROJECT_ID: ${process.env.DEV_FIREBASE_PROJECT_ID ? 'Present' : 'MISSING'}
      - DEV_FIREBASE_SECRET_KEY: ${process.env.DEV_FIREBASE_SECRET_KEY ? 'Present' : 'MISSING'}
      - DEV_FIREBASE_CLIENT_EMAIL: ${process.env.DEV_FIREBASE_CLIENT_EMAIL ? 'Present' : 'MISSING'}
      Falling back to production credentials for missing values which may cause permission issues.
    `);
  }
  
  console.log(`[Firebase Admin] Initializing with project: ${projectId} (${isDev ? 'DEV' : 'PROD'} mode)`);
  
  // If already initialized, delete the app and reinitialize
  if (admin.apps.length > 0) {
    try {
      admin.app().delete().then(() => {
        console.log('[Firebase Admin] Previous app instance deleted');
      }).catch(error => {
        console.error('[Firebase Admin] Error deleting previous app:', error);
      });
    } catch (error) {
      console.error('[Firebase Admin] Error deleting previous app:', error);
    }
  }
  
  // Validate required credentials
  if (!privateKey || !clientEmail) {
    const missingCreds = [];
    if (!privateKey) missingCreds.push('private key');
    if (!clientEmail) missingCreds.push('client email');
    
    console.error(`[Firebase Admin] ERROR: Missing required credentials: ${missingCreds.join(', ')}`);
    throw new Error(`Cannot initialize Firebase: Missing ${missingCreds.join(', ')}. This is required for Firebase Admin SDK to authenticate.`);
  }
  
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
    
    console.log('[Firebase Admin] App initialized successfully');
    return admin;
  } catch (error) {
    console.error('[Firebase Admin] Initialization error:', error);
    
    // Add specific error info for permissions
    if (error.message && error.message.includes('PERMISSION_DENIED')) {
      console.error(`[Firebase Admin] PERMISSION DENIED ERROR: The service account ${clientEmail} does not have permission to access project ${projectId}.
        If in development mode, please make sure you have added the correct service account credentials in your environment variables:
        - DEV_FIREBASE_PROJECT_ID
        - DEV_FIREBASE_SECRET_KEY
        - DEV_FIREBASE_CLIENT_EMAIL
      `);
    }
    
    // Add specific handling for DENOBUILT:DECODER error
    if (error.message && (error.message.includes('DENOBUILT:DECODER') || error.message.includes('error:DENOBUILT'))) {
      console.error(`[Firebase Admin] PRIVATE KEY FORMAT ERROR: There is an issue with the format of the private key.
        This is likely due to the private key not being properly formatted with the correct newlines.
        Please make sure your private key:
        1. Includes the "-----BEGIN PRIVATE KEY-----" and "-----END PRIVATE KEY-----" markers
        2. Has proper newline characters between the markers and the key content
        3. Is properly escaped in your environment variables
        
        Try recreating your service account key in the Firebase console and updating your environment variables.
      `);
    }
    
    throw error;
  }
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

const db = admin.firestore();

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
  initializeFirebaseAdmin
}; 