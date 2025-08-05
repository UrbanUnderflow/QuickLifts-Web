// Import necessary modules
const { db, admin } = require('./config/firebase');
const Stripe = require('stripe');

// Initialize Stripe
let stripe;
try {
  if (process.env.STRIPE_SECRET_KEY) {
    stripe = Stripe(process.env.STRIPE_SECRET_KEY);
  }
} catch (error) {
  console.error('Error initializing Stripe:', error);
}

async function verifyAndFixStripeAccount(userId, userData) {
  // If stripeAccountId is already present, we're good
  if (userData.creator?.stripeAccountId) {
    console.log(`User ${userId} already has stripeAccountId: ${userData.creator.stripeAccountId}`);
    return userData.creator.stripeAccountId;
  }

  // If missing, try to find and link the account
  console.warn(`User ${userId} missing stripeAccountId - attempting to find and link account`);
  
  if (!stripe) {
    throw new Error('Stripe not available to search for account');
  }

  try {
    // Search for connected accounts using the user's email
    const accounts = await stripe.accounts.list({ limit: 100 });
    const userEmail = userData.email;
    
    if (!userEmail) {
      throw new Error('User email not found for account search');
    }

    // Find account(s) that match the user's email
    const userAccounts = accounts.data.filter(account => 
      account.email === userEmail || 
      (account.business_profile && account.business_profile.support_email === userEmail)
    );

    if (userAccounts.length === 0) {
      throw new Error(`No Stripe accounts found for email: ${userEmail}`);
    }

    // Use the first matching account
    const stripeAccount = userAccounts[0];
    console.log(`Found and linking Stripe account: ${stripeAccount.id} for user ${userId} and setting onboarding to complete`);

    // Update the user's profile with the found account ID and set onboarding to complete
    await db.collection("users").doc(userId).update({
      'creator.stripeAccountId': stripeAccount.id,
      'creator.accountType': stripeAccount.type,
      'creator.onboardingStatus': 'complete', // Set to complete since Stripe account exists
      'creator.onboardingCompletedAt': new Date(),
      'creator.lastLinked': new Date()
    });

    return stripeAccount.id;
  } catch (error) {
    console.error(`Failed to find/link Stripe account for user ${userId}:`, error);
    throw error;
  }
}

async function updateOnboardingStatus(userId) {
  // Skip DB update in development without Firebase credentials
  if (!process.env.FIREBASE_SECRET_KEY) {
    console.warn('Running in development mode without Firebase credentials - skipping DB update');
    return { success: true, accountId: null };
  }
  
  try {
    // First, get the current user data to verify account linking
    const userDoc = await db.collection("users").doc(userId).get();
    
    if (!userDoc.exists) {
      throw new Error(`User document not found for userId: ${userId}`);
    }

    const userData = userDoc.data();
    
    // Verify and fix Stripe account linking if needed
    let stripeAccountId = null;
    try {
      stripeAccountId = await verifyAndFixStripeAccount(userId, userData);
    } catch (linkingError) {
      console.error(`Account linking verification failed for user ${userId}:`, linkingError);
      // Continue with onboarding completion even if linking fails
      // The user can fix this later via the debug tools
    }

    // Update onboarding status to complete
    const updateData = {
      'creator.onboardingStatus': 'complete',
      'creator.onboardingCompletedAt': new Date()
    };

    // Also update the account ID if we found/fixed it
    if (stripeAccountId) {
      updateData['creator.stripeAccountId'] = stripeAccountId;
    }

    await db.collection("users").doc(userId).update(updateData);
    
    console.log(`Updated onboarding status to complete for user ${userId}`, {
      hasStripeAccountId: !!stripeAccountId,
      stripeAccountId: stripeAccountId || 'Missing'
    });
    
    return { 
      success: true, 
      accountId: stripeAccountId,
      hasAccountId: !!stripeAccountId
    };
  } catch (error) {
    console.error(`Error updating onboarding status for user ${userId}:`, error);
    throw error;
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
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
        },
        body: JSON.stringify({ success: false, error: 'Missing userId parameter' })
      };
    }
    
    // In development without Firebase creds, just return success
    if (!process.env.FIREBASE_SECRET_KEY) {
      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
        },
        body: JSON.stringify({ 
          success: true,
          message: 'Development mode: Simulated successful onboarding completion' 
        })
      };
    }
    
    const result = await updateOnboardingStatus(userId);
    
    if (result.success) {
      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
        },
        body: JSON.stringify({ 
          success: true,
          message: 'Onboarding status updated to complete',
          hasStripeAccount: result.hasAccountId,
          stripeAccountId: result.accountId ? `${result.accountId.substring(0, 10)}...` : null,
          warning: !result.hasAccountId ? 'Stripe account ID is missing - user may need to use account linking tools' : null
        })
      };
    } else {
      return {
        statusCode: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
        },
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
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
      },
      body: JSON.stringify({
        success: false,
        error: error.message || 'Internal server error'
      })
    };
  }
};