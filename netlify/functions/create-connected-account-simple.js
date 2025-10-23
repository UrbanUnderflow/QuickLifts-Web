// create-connected-account-simple.js
// Simplified version that just creates a new Stripe account

const { db, headers } = require('./config/firebase');
const Stripe = require('stripe');

// Initialize Stripe with your secret key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const handler = async (event) => {
  console.log(`[CreateConnectedAccountSimple] Received ${event.httpMethod} request:`, {
    queryParams: event.queryStringParameters,
    body: event.body ? '(has body data)' : '(no body data)'
  });
  
  try {
    const userId = event.queryStringParameters?.userId;
    console.log('[CreateConnectedAccountSimple] Processing for userId:', userId);
    
    if (!userId) {
      return { 
        statusCode: 400, 
        body: JSON.stringify({
          success: false,
          error: 'Missing userId parameter'
        })
      };
    }

    // Validate Stripe key exists
    if (!process.env.STRIPE_SECRET_KEY) {
      console.error('[CreateConnectedAccountSimple] STRIPE_SECRET_KEY not configured');
      return {
        statusCode: 500,
        body: JSON.stringify({
          success: false,
          error: 'Stripe configuration error. Please contact support.',
          details: 'STRIPE_SECRET_KEY not configured'
        })
      };
    }

    // Get user data from Firestore
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return {
        statusCode: 404,
        body: JSON.stringify({
          success: false,
          error: 'User not found'
        })
      };
    }

    const userData = userDoc.data();
    console.log(`[CreateConnectedAccountSimple] User data:`, {
      email: userData.email,
      username: userData.username,
      hasCreator: !!userData.creator
    });

    // Validate email
    if (!userData.email || userData.email.trim() === '') {
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          error: 'User does not have a valid email address'
        })
      };
    }

    // Create Stripe Express account (simplified)
    console.log(`[CreateConnectedAccountSimple] Creating Stripe account for: ${userData.email}`);
    
    const account = await stripe.accounts.create({
      type: 'express',
      email: userData.email,
      country: 'US',
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true }
      },
      business_type: 'individual'
    });

    console.log('[CreateConnectedAccountSimple] Account created:', account.id);

    // Create account link for onboarding
    const baseUrl = process.env.SITE_URL || 'https://fitwithpulse.ai';
    const refreshUrl = `${baseUrl}/coach/profile`;
    const returnUrl = `${baseUrl}/coach/profile?complete=true`;
    
    console.log(`[CreateConnectedAccountSimple] Creating account link with URLs:`, {
      refreshUrl,
      returnUrl
    });
    
    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: "account_onboarding",
    });

    console.log('[CreateConnectedAccountSimple] Account link created');

    // Update user document with Stripe account info
    try {
      const creatorData = {
        stripeAccountId: account.id,
        onboardingStatus: 'incomplete',
        onboardingLink: accountLink.url,
        onboardingExpirationDate: accountLink.expires_at,
        onboardingPayoutState: 'introduction'
      };
      
      await db.collection("users").doc(userId).set({
        creator: creatorData
      }, { merge: true });
      
      console.log(`[CreateConnectedAccountSimple] SUCCESS: Stripe account ID ${account.id} saved to Firestore for user ${userId}`);
    } catch (firestoreError) {
      console.error(`[CreateConnectedAccountSimple] FAILURE: Failed to save Stripe account ID to Firestore for user ${userId}:`, firestoreError);
      throw new Error(`Failed to save account information to database: ${firestoreError.message}`);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        accountLink: accountLink.url,
        accountId: account.id,
        expiresAt: accountLink.expires_at
      })
    };

  } catch (error) {
    console.error('[CreateConnectedAccountSimple] Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error.message,
        details: error.type || 'Unknown error',
        code: error.code || 'unknown'
      })
    };
  }
};

module.exports = { handler };
