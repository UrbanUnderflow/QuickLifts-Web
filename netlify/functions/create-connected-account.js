// Docs on event and context https://docs.netlify.com/functions/build/#code-your-function-2

const Stripe = require('stripe');
const { db } = require('./config/firebase');

// Initialize Stripe with your secret key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

async function updateOnboardingLink(userId, link, expiration) {
  try {
    const userRef = db.collection("users").doc(userId);
    await userRef.update({
      'creator.onboardingLink': link, 
      'creator.onboardingExpirationDate': expiration,
      'creator.onboardingPayoutState': 'introduction'
    });
    console.log(`[CreateConnectedAccount] Updated onboarding link for user ${userId}`);
  } catch (error) {
    console.error(`[CreateConnectedAccount] Error updating onboarding link for user ${userId}:`, error);
    throw error;
  }
}

async function createOrUpdateStripeConnect(userId, stripeAccountId, email) {
  try {
    const stripeConnectRef = db.collection("stripeConnect").doc(userId);
    const stripeConnectDoc = await stripeConnectRef.get();

    if (stripeConnectDoc.exists) {
      // Update existing document
      await stripeConnectRef.update({
        stripeAccountId,
        updatedAt: new Date(),
      });
      console.log(`[CreateConnectedAccount] Updated StripeConnect document for user ${userId}`);
    } else {
      // Create new document
      await stripeConnectRef.set({
        userId,
        stripeAccountId,
        email,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      console.log(`[CreateConnectedAccount] Created new StripeConnect document for user ${userId}`);
    }
  } catch (error) {
    console.error(`[CreateConnectedAccount] Error managing StripeConnect document for user ${userId}:`, error);
    throw error;
  }
}

const handler = async (event) => {
  console.log(`[CreateConnectedAccount] Received ${event.httpMethod} request:`, {
    queryParams: event.queryStringParameters,
    body: event.body ? '(has body data)' : '(no body data)'
  });
  
  try {
    const userId = event.queryStringParameters?.userId;
    console.log('[CreateConnectedAccount] Processing for userId:', userId);
    
    if (!userId) {
      return { 
        statusCode: 400, 
        body: JSON.stringify({
          success: false,
          error: 'Missing userId parameter'
        })
      };
    }

    // Get user document to check if they already have a Stripe account
    const userDoc = await db.collection("users").doc(userId).get();
    if (!userDoc.exists) {
      console.error(`[CreateConnectedAccount] User document not found for userId: ${userId}`);
      return {
        statusCode: 404,
        body: JSON.stringify({
          success: false,
          error: 'User not found'
        })
      };
    }

    const userData = userDoc.data();
    
    // If user already has a Stripe account, create a new onboarding link for it
    if (userData.creator?.stripeAccountId) {
      console.log('[CreateConnectedAccount] User already has Stripe account, creating new onboarding link');
      try {
        const accountLink = await stripe.accountLinks.create({
          account: userData.creator.stripeAccountId,
          refresh_url: `${process.env.SITE_URL || 'https://fitwithpulse.ai'}/trainer/connect-account`,
          return_url: `${process.env.SITE_URL || 'https://fitwithpulse.ai'}/trainer/dashboard?complete=true`,
          type: "account_onboarding",
        });

        await updateOnboardingLink(userId, accountLink.url, accountLink.expires_at);

        return {
          statusCode: 200,
          body: JSON.stringify({ 
            success: true,
            accountLink: accountLink.url
          })
        };
      } catch (error) {
        console.error('[CreateConnectedAccount] Error creating account link for existing account:', error);
        return {
          statusCode: 500,
          body: JSON.stringify({
            success: false,
            error: error.message
          })
        };
      }
    }

    // Create Stripe Express account with tax reporting capabilities
    const account = await stripe.accounts.create({
        type: 'express',
        country: 'US',
        capabilities: {
            card_payments: { requested: true },
            transfers: { requested: true },
            tax_reporting_us_1099_k: { requested: true },
            tax_reporting_us_1099_misc: { requested: true }
        },
        business_type: 'individual',
        business_profile: {
            product_description: 'Fitness training and workout programs',
            url: `https://fitwithpulse.ai/profile/${userData.username}`,
            mcc: '7991' // Physical fitness facilities
        },
        metadata: {
            platform: 'pulse',
            account_type: 'trainer',
            user_id: userId,
            username: userData.username,
            purpose: 'creator_earnings'
        }
    });

    console.log('[CreateConnectedAccount] Account created:', account.id);

    // Create account link for onboarding
    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: `${process.env.SITE_URL || 'https://fitwithpulse.ai'}/trainer/connect-account`,
      return_url: `${process.env.SITE_URL || 'https://fitwithpulse.ai'}/trainer/dashboard?complete=true`,
      type: "account_onboarding",
    });

    console.log('[CreateConnectedAccount] Account link created');

    // CRITICAL: Update user document with Stripe account info
    // This is the most important step - if this fails, the user will lose their account linking
    try {
      await db.collection("users").doc(userId).update({
        'creator.stripeAccountId': account.id,
        'creator.onboardingStatus': 'incomplete',
        'creator.onboardingLink': accountLink.url,
        'creator.onboardingExpirationDate': accountLink.expires_at,
        'creator.onboardingPayoutState': 'introduction'
      });
      console.log(`[CreateConnectedAccount] CRITICAL SUCCESS: Stripe account ID ${account.id} saved to Firestore for user ${userId}`);
    } catch (firestoreError) {
      console.error(`[CreateConnectedAccount] CRITICAL FAILURE: Failed to save Stripe account ID to Firestore for user ${userId}:`, firestoreError);
      
      // This is a critical failure - the Stripe account was created but we can't link it
      // We should return an error so the user knows something went wrong
      throw new Error(`Failed to save account information to database: ${firestoreError.message}`);
    }

    // Create or update StripeConnect document (less critical, can fail without breaking the flow)
    try {
      await createOrUpdateStripeConnect(userId, account.id, userData.email);
      console.log('[CreateConnectedAccount] StripeConnect document updated successfully');
    } catch (stripeConnectError) {
      console.warn('[CreateConnectedAccount] StripeConnect document update failed (non-critical):', stripeConnectError);
      // Don't throw here - the main account linking succeeded
    }

    console.log('[CreateConnectedAccount] Account creation and linking completed successfully');

    return {
      statusCode: 200,
      body: JSON.stringify({ 
        success: true,
        accountLink: accountLink.url
      })
    };
  } catch (error) {
    console.error('[CreateConnectedAccount] Error:', error);
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