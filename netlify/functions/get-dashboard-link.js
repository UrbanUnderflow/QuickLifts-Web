// Function to get a Stripe dashboard link for a creator account

const Stripe = require('stripe');
const admin = require('firebase-admin');

// Initialize Firebase Admin if not already initialized
if (admin.apps.length === 0) {
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
          "private_key": process.env.FIREBASE_SECRET_KEY_ALT.replace(/\\n/g, '\n'),
          "client_email": "firebase-adminsdk-1qxb0@quicklifts-dd3f1.iam.gserviceaccount.com",
          "client_id": "111494077667496751062",
          "auth_uri": "https://accounts.google.com/o/oauth2/auth",
          "token_uri": "https://oauth2.googleapis.com/token",
          "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
          "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-1qxb0@quicklifts-dd3f1.iam.gserviceaccount.com"
        })
      });
    }
    console.log('Firebase Admin initialized successfully');
  } catch (error) {
    console.error('Error initializing Firebase Admin:', error);
  }
}

const db = admin.firestore();

// Initialize Stripe with better error handling
let stripe;
try {
  // Log environment variables for debugging (without exposing sensitive data)
  console.log('Environment variables available:', {
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY ? 'Set' : 'Not set',
    FIREBASE_SECRET_KEY_ALT: process.env.FIREBASE_SECRET_KEY_ALT ? 'Set' : 'Not set',
    FIREBASE_PRIVATE_KEY_ALT: process.env.FIREBASE_PRIVATE_KEY ? 'Set' : 'Not set',
    NODE_ENV: process.env.NODE_ENV
  });

  if (process.env.STRIPE_SECRET_KEY) {
    stripe = Stripe(process.env.STRIPE_SECRET_KEY);
    console.log('Stripe initialized successfully with API key');
  } else {
    console.warn('STRIPE_SECRET_KEY environment variable is missing');
  }
} catch (error) {
  console.error('Error initializing Stripe:', error);
}

const handler = async (event) => {
  console.log(`Received ${event.httpMethod} request:`, {
    queryParams: event.queryStringParameters,
    body: event.body ? '(has body data)' : '(no body data)'
  });

  // Accept both GET and POST requests for flexibility
  try {
    let userId;
    
    // Check for userId in different locations
    if (event.httpMethod === 'GET') {
      userId = event.queryStringParameters?.userId;
    } else if (event.httpMethod === 'POST') {
      // First try to parse the body if it exists
      if (event.body) {
        try {
          const body = JSON.parse(event.body);
          userId = body.userId;
        } catch (parseError) {
          console.error('Error parsing request body:', parseError);
        }
      }
      
      // If userId not found in body, check query parameters as fallback
      if (!userId && event.queryStringParameters) {
        userId = event.queryStringParameters.userId;
      }
    } else {
      return {
        statusCode: 405,
        body: JSON.stringify({ success: false, error: 'Method not allowed' })
      };
    }

    console.log('Extracted userId:', userId);
    
    if (!userId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ success: false, error: 'Missing userId parameter' })
      };
    }

    // Check if Stripe API is available
    if (!stripe) {
      console.error('Stripe API not available');
      return {
        statusCode: 500,
        body: JSON.stringify({
          success: false,
          error: 'Stripe API not available'
        })
      };
    }

    // Get user document from Firestore
    console.log('Fetching user document from Firestore...');
    const userDoc = await db.collection('users').doc(userId).get();
    
    if (!userDoc.exists) {
      console.warn(`User document not found for userId: ${userId}`);
      return {
        statusCode: 404,
        body: JSON.stringify({
          success: false,
          error: 'User not found'
        })
      };
    }

    const userData = userDoc.data();
    console.log('User data retrieved, checking for Stripe account...');
    
    // Check if user has a Stripe account
    if (!userData.creator || !userData.creator.stripeAccountId) {
      console.warn('User has no Stripe account');
      return {
        statusCode: 400,
        body: JSON.stringify({ 
          success: false, 
          error: 'No Stripe account found for this user'
        })
      };
    }

    console.log('Found Stripe account, creating login link...');
    // Create a login link for the Stripe Connect account
    try {
      const loginLink = await stripe.accounts.createLoginLink(
        userData.creator.stripeAccountId
      );

      // Return the dashboard URL
      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          url: loginLink.url
        })
      };
    } catch (stripeError) {
      console.error('Error creating Stripe login link:', stripeError);
      return {
        statusCode: 500,
        body: JSON.stringify({
          success: false,
          error: stripeError.message || 'Error creating Stripe login link'
        })
      };
    }
  } catch (error) {
    console.error('Error getting dashboard link:', error);
    
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error.message || 'Internal server error'
      })
    };
  }
};

module.exports = { handler }; 