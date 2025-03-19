import * as admin from 'firebase-admin';

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  try {
    // Check for required environment variables
    if (!process.env.FIREBASE_SECRET_KEY) {
      console.error('ERROR: FIREBASE_SECRET_KEY environment variable is missing');
      // Instead of throwing an error, we'll create a mock credential for development
      // This allows the app to initialize, but will still log errors for operations
      admin.initializeApp({
        projectId: "quicklifts-dd3f1",
        credential: admin.credential.applicationDefault()
      });
    } else {
      // Initialize with the actual credentials
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: "quicklifts-dd3f1",
          privateKey: process.env.FIREBASE_SECRET_KEY.replace(/\\n/g, '\n'),
          clientEmail: "firebase-adminsdk-1qxb0@quicklifts-dd3f1.iam.gserviceaccount.com",
        })
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
          projectId: "quicklifts-dd3f1"
        });
        console.log('[Firebase Admin] Initialized with fallback options for development');
      } catch (fallbackError) {
        console.error('Even fallback initialization failed:', fallbackError);
      }
    }
  }
}

export default admin; 