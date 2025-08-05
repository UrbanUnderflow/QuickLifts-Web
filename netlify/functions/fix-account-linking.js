// Function to fix account linking issues by retrieving Stripe account info
const Stripe = require('stripe');
const { db, headers } = require('./config/firebase');

// Initialize Stripe
let stripe;
try {
  if (process.env.STRIPE_SECRET_KEY) {
    stripe = Stripe(process.env.STRIPE_SECRET_KEY);
    console.log('Stripe initialized for account fixing');
  } else {
    console.warn('STRIPE_SECRET_KEY environment variable is missing');
  }
} catch (error) {
  console.error('Error initializing Stripe:', error);
}

const handler = async (event) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: ''
    };
  }

  // Only accept POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ success: false, error: 'Method not allowed' })
    };
  }

  try {
    if (!stripe) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Stripe not properly configured'
        })
      };
    }

    const { userId, userEmail } = JSON.parse(event.body || '{}');
    console.log('Attempting to fix account linking for userId:', userId);
    
    if (!userId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, error: 'Missing userId parameter' })
      };
    }

    // Get user document from Firestore
    const userDoc = await db.collection('users').doc(userId).get();
    
    if (!userDoc.exists) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'User not found'
        })
      };
    }

    const userData = userDoc.data();
    const userEmailFromDoc = userData.email || userEmail;
    
    if (!userEmailFromDoc) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'User email not found'
        })
      };
    }

    console.log('Searching for Stripe accounts for email:', userEmailFromDoc);

    // Search for connected accounts using the user's email
    const accounts = await stripe.accounts.list({
      limit: 100
    });

    console.log(`Found ${accounts.data.length} total accounts, searching for user's account...`);

    // Find account(s) that match the user's email
    const userAccounts = accounts.data.filter(account => 
      account.email === userEmailFromDoc || 
      (account.business_profile && account.business_profile.support_email === userEmailFromDoc)
    );

    console.log(`Found ${userAccounts.length} accounts matching email`);

    if (userAccounts.length === 0) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'No Stripe accounts found for this email'
        })
      };
    }

    // Use the first matching account (or we could let user choose if multiple)
    const stripeAccount = userAccounts[0];
    console.log('Found Stripe account:', stripeAccount.id);

    // Update the user's Firestore document with the Stripe account ID
    const updateData = {
      creator: {
        ...userData.creator,
        stripeAccountId: stripeAccount.id,
        onboardingStatus: stripeAccount.details_submitted ? 'complete' : 'incomplete',
        lastLinked: new Date(),
        accountType: stripeAccount.type
      }
    };

    await db.collection('users').doc(userId).update(updateData);

    console.log('Successfully updated user profile with Stripe account ID');

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Account linking fixed successfully',
        accountInfo: {
          stripeAccountId: stripeAccount.id,
          accountType: stripeAccount.type,
          onboardingComplete: stripeAccount.details_submitted,
          businessType: stripeAccount.business_type,
          capabilities: stripeAccount.capabilities
        }
      })
    };

  } catch (error) {
    console.error('Error fixing account linking:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message || 'Internal server error'
      })
    };
  }
};

module.exports = { handler }; 