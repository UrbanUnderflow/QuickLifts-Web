// Docs on event and context https://docs.netlify.com/functions/build/#code-your-function-2

const Stripe = require('stripe');
const admin = require('firebase-admin'); // Install this 

// Dummy account link for development
const DUMMY_ACCOUNT_LINK = {
  url: 'https://dashboard.stripe.com/test/connect/overview',
  expires_at: Math.floor(Date.now() / 1000) + 86400 // 24 hours from now
};

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
          "private_key_id": process.env.FIREBASE_PRIVATE_KEY_ALT,
          "private_key": process.env.FIREBASE_SECRET_KEY_ALT.replace(/\\n/g, '\n'),
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

// Initialize Stripe with error handling
let stripe;
try {
  stripe = Stripe(process.env.STRIPE_SECRET_KEY);
} catch (error) {
  console.error('Error initializing Stripe:', error);
}

async function updateOnboardingLink(userId, link, expiration) {
  // Skip DB update in development without Firebase credentials
  if (!process.env.FIREBASE_SECRET_KEY_ALT) {
    console.warn('Running in development mode without Firebase credentials - skipping DB update');
    return;
  }
  
  try {
    const userRef = db.collection("users").doc(userId);
    await userRef.update({
      'creator.onboardingLink': link, 
      'creator.onboardingExpirationDate': expiration
    });
    console.log(`Updated onboarding link for user ${userId}`);
  } catch (error) {
    console.error(`Error updating onboarding link for user ${userId}:`, error);
    throw error;
  }
}

const handler = async (event) => {
  console.log(`Received ${event.httpMethod} request:`, {
    queryParams: event.queryStringParameters,
    body: event.body ? '(has body data)' : '(no body data)'
  });
  
  try {
    // Safely access userId to avoid null reference errors
    const userId = event.queryStringParameters?.userId;
    console.log('Extracted userId:', userId);
    
    if (!userId) {
      return { 
        statusCode: 400, 
        body: JSON.stringify({
          success: false,
          error: 'Missing userId parameter'
        })
      };
    }
    
    // In development, return dummy data if no Stripe or Firebase credentials
    if (!process.env.FIREBASE_SECRET_KEY_ALT || !stripe) {
      console.warn('Running in development mode without proper credentials. Returning dummy account link.');
      await updateOnboardingLink(userId, DUMMY_ACCOUNT_LINK.url, DUMMY_ACCOUNT_LINK.expires_at);
      return {
        statusCode: 200,
        body: JSON.stringify({ 
          success: true,
          accountLink: DUMMY_ACCOUNT_LINK.url
        }),
      };
    }

    try {
      console.log('Creating Stripe Express account...');
      const account = await stripe.accounts.create({
        type: 'express',
        country: 'US', // Replace with appropriate country
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
      });
      console.log('Stripe account created successfully with ID:', account.id);
      console.log('Stripe account object:', JSON.stringify(account));

      console.log('Creating account link...');
      const accountLink = await stripe.accountLinks.create({
        account: account.id,
        refresh_url: "https://fitwithpulse.ai",
        return_url: `https://fitwithpulse.ai/trainer/dashboard?complete=true&userId=${userId}`, // Include userId as query parameter
        type: "account_onboarding",
      });
      console.log('Account link created successfully:', accountLink.url);

      // Store the Stripe account ID in the user document (if we have Firebase credentials)
      if (process.env.FIREBASE_SECRET_KEY_ALT) {
        console.log('Updating user document with Stripe account ID:', account.id);
        const userRef = db.collection("users").doc(userId);
        
        // First get the current user doc to make sure it exists
        const userDoc = await userRef.get();
        if (!userDoc.exists) {
          console.error(`User document not found for userId: ${userId}`);
          throw new Error('User document not found');
        }
        
        // Update the user document
        await userRef.update({
          'creator.stripeAccountId': account.id,
          'creator.onboardingStatus': 'pending'
        });
        console.log('Updated user document with Stripe account ID successfully');
      } else {
        console.warn('DEV MODE: Would have updated Firebase with Stripe account ID:', account.id);
      }

      await updateOnboardingLink(userId, accountLink.url, accountLink.expires_at);

      return {
        statusCode: 200,
        body: JSON.stringify({ 
          success: true,
          accountLink: accountLink.url
        }),
      };
    } catch (error) {
      console.error('Error creating Stripe account or account link:', error);
      return {
        statusCode: 500,
        body: JSON.stringify({
          success: false,
          error: error.message
        })
      };
    }
  } catch (error) {
    console.error('Error handling request:', error);
    return { 
      statusCode: 500, 
      body: JSON.stringify({
        success: false,
        error: error.message
      })
    };
  }
};

module.exports = { handler };