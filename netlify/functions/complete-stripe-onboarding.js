// Import necessary modules
const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
if (admin.apps.length === 0) { // Prevents reinitializing the app
  try {
    // Check if we have the required environment variables
    if (!process.env.FIREBASE_SECRET_KEY_ALT) {
      console.warn('FIREBASE_SECRET_KEY_ALT environment variable is missing. Using dummy mode.');
      // In development, we'll just initialize with a placeholder
      admin.initializeApp({
        projectId: "quicklifts-dd3f1"
      });
    } else {
      // Initialize with the actual credentials
      admin.initializeApp({
        credential: admin.credential.cert({
          "type": "service_account",
          "project_id": "quicklifts-dd3f1",
          "private_key_id": process.env.FIREBASE_PRIVATE_KEY,
          "private_key": process.env.FIREBASE_SECRET_KEY.replace(/\\n/g, '\n'),
          "client_email": "firebase-adminsdk-1qxb0@quicklifts-dd3f1.iam.gserviceaccount.com",
          "client_id": "111494077667496751062",
          "auth_uri": "https://accounts.google.com/o/oauth2/auth",
          "token_uri": "https://oauth2.googleapis.com/token",
          "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
          "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-1qxb0@quicklifts-dd3f1.iam.gserviceaccount.com",
          "universe_domain": "googleapis.com"
        })
      });
    }
    console.log('Firebase Admin initialized successfully');
  } catch (error) {
    console.error('Error initializing Firebase Admin:', error);
  }
} 

const db = admin.firestore();

async function updateOnboardingStatus(userId) {
  // Skip DB update in development without Firebase credentials
  if (!process.env.FIREBASE_SECRET_KEY_ALT) {
    console.warn('Running in development mode without Firebase credentials - skipping DB update');
    return;
  }
  
  try {
    const userRef = db.collection("users").doc(userId);
    await userRef.update({
      'creator.onboardingStatus': 'complete', 
    });
    console.log(`Updated onboarding status to complete for user ${userId}`);
    return true;
  } catch (error) {
    console.error(`Error updating onboarding status for user ${userId}:`, error);
    return false;
  }
}

exports.handler = async function(event, context) {
  console.log(`Received ${event.httpMethod} request:`, {
    queryParams: event.queryStringParameters,
    body: event.body ? '(has body data)' : '(no body data)'
  });
  
  // Accept both GET and POST requests for flexibility
  try {
    // Safely access userId to avoid null reference errors
    const userId = event.queryStringParameters?.userId;
    console.log('Extracted userId:', userId);
    
    if (!userId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ success: false, error: 'Missing userId parameter' })
      };
    }
    
    // In development without Firebase creds, just return success
    if (!process.env.FIREBASE_SECRET_KEY_ALT) {
      return {
        statusCode: 200,
        body: JSON.stringify({ 
          success: true,
          message: 'Development mode: Simulated successful onboarding completion' 
        })
      };
    }
    
    const success = await updateOnboardingStatus(userId);
    
    if (success) {
      return {
        statusCode: 200,
        body: JSON.stringify({ 
          success: true,
          message: 'Onboarding status updated to complete' 
        })
      };
    } else {
      return {
        statusCode: 500,
        body: JSON.stringify({ 
          success: false,
          error: 'Failed to update onboarding status' 
        })
      };
    }
  } catch (error) {
    console.error('Error handling onboarding completion:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error.message || 'Internal server error'
      })
    };
  }
};