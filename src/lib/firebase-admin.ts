import * as admin from 'firebase-admin';

const isE2EDevFirebase = process.env.NEXT_PUBLIC_E2E_FORCE_DEV_FIREBASE === 'true';
const selectedProjectId = isE2EDevFirebase
  ? process.env.NEXT_PUBLIC_DEV_FIREBASE_PROJECT_ID || 'quicklifts-dev-01'
  : 'quicklifts-dd3f1';
const shouldUseCertCredentials =
  Boolean(process.env.FIREBASE_SECRET_KEY) && selectedProjectId === 'quicklifts-dd3f1';

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  try {
    if (!shouldUseCertCredentials) {
      if (!process.env.FIREBASE_SECRET_KEY) {
        console.error('ERROR: FIREBASE_SECRET_KEY environment variable is missing');
      }

      // For local/dev and Playwright E2E we rely on ADC plus an explicit project id.
      admin.initializeApp({
        projectId: selectedProjectId,
        credential: admin.credential.applicationDefault(),
      });
    } else {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: selectedProjectId,
          privateKey: process.env.FIREBASE_SECRET_KEY.replace(/\\n/g, '\n'),
          clientEmail: "firebase-adminsdk-1qxb0@quicklifts-dd3f1.iam.gserviceaccount.com",
        }),
        projectId: selectedProjectId,
      });
      console.log('[Firebase Admin] Initialization complete with credentials');
    }
  } catch (error) {
    console.error('Firebase admin initialization error:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    // Initialize with a fallback in development mode
    if (process.env.NODE_ENV === 'development') {
      try {
        admin.initializeApp({
          projectId: selectedProjectId,
        });
        console.log('[Firebase Admin] Initialized with fallback options for development');
      } catch (fallbackError) {
        console.error('Even fallback initialization failed:', fallbackError);
      }
    }
  }
}

export default admin; 
