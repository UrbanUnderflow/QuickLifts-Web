// Function to get a Stripe dashboard link for a creator account

const Stripe = require('stripe');
const { admin } = require('./config/firebase');

const db = admin.firestore();

// Initialize Stripe with better error handling
let stripe;
try {
  // Log environment variables for debugging (without exposing sensitive data)
  console.log('Environment variables available:', {
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY ? 'Set' : 'Not set',
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
