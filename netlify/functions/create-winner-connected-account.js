// Function to create Stripe Connect accounts for challenge winners

const Stripe = require('stripe');
const { db } = require('./config/firebase');

// Initialize Stripe with your secret key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

async function updateOnboardingLink(userId, link, expiration) {
  try {
    const userRef = db.collection("users").doc(userId);
    await userRef.update({
      'winner.onboardingLink': link, 
      'winner.onboardingExpirationDate': expiration,
      'winner.onboardingPayoutState': 'introduction'
    });
    console.log(`[CreateWinnerConnectedAccount] Updated onboarding link for user ${userId}`);
  } catch (error) {
    console.error(`[CreateWinnerConnectedAccount] Error updating onboarding link for user ${userId}:`, error);
    throw error;
  }
}

async function createOrUpdateWinnerStripeConnect(userId, stripeAccountId, email) {
  try {
    const winnerStripeRef = db.collection("winnerStripeConnect").doc(userId);
    await winnerStripeRef.set({
      userId: userId,
      stripeAccountId: stripeAccountId,
      email: email,
      createdAt: new Date(),
      updatedAt: new Date()
    }, { merge: true });
    console.log(`[CreateWinnerConnectedAccount] Created/updated winnerStripeConnect document for user ${userId}`);
  } catch (error) {
    console.error(`[CreateWinnerConnectedAccount] Error creating/updating winnerStripeConnect document:`, error);
    throw error;
  }
}

const handler = async (event) => {
  console.log(`[CreateWinnerConnectedAccount] Received ${event.httpMethod} request`);

  // Only accept POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({
        success: false,
        error: 'Method not allowed'
      })
    };
  }

  try {
    const { userId, challengeId, placement } = JSON.parse(event.body);
    console.log(`[CreateWinnerConnectedAccount] Creating account for user ${userId}, challenge ${challengeId}, placement ${placement}`);

    if (!userId) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          error: 'Missing userId'
        })
      };
    }

    // Get user document
    const userDoc = await db.collection("users").doc(userId).get();
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
    
    // If user already has a Stripe account in winner field, create a new onboarding link for it
    if (userData.winner?.stripeAccountId) {
      console.log('[CreateWinnerConnectedAccount] User already has Stripe account, creating new onboarding link');
      try {
        const accountLink = await stripe.accountLinks.create({
          account: userData.winner.stripeAccountId,
          refresh_url: `${process.env.SITE_URL || 'https://fitwithpulse.ai'}/winner/connect-account?challengeId=${challengeId}&placement=${placement}`,
          return_url: `${process.env.SITE_URL || 'https://fitwithpulse.ai'}/winner/dashboard?complete=true`,
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
        console.error('[CreateWinnerConnectedAccount] Error creating account link for existing account:', error);
        return {
          statusCode: 500,
          body: JSON.stringify({
            success: false,
            error: error.message
          })
        };
      }
    }

    // Create Stripe Express account for winner with tax reporting capabilities
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
            product_description: 'Challenge winner prize money recipient',
            url: `https://fitwithpulse.ai/profile/${userData.username}`,
            mcc: '7991' // Physical fitness facilities
        },
        metadata: {
            platform: 'pulse',
            account_type: 'winner',
            user_id: userId,
            username: userData.username,
            purpose: 'prize_money'
        }
    });

    console.log('[CreateWinnerConnectedAccount] Account created:', account.id);

    // Create account link for onboarding
    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: `${process.env.SITE_URL || 'https://fitwithpulse.ai'}/winner/connect-account?challengeId=${challengeId}&placement=${placement}`,
      return_url: `${process.env.SITE_URL || 'https://fitwithpulse.ai'}/winner/dashboard?complete=true`,
      type: "account_onboarding",
    });

    console.log('[CreateWinnerConnectedAccount] Account link created');

    // Update user document with Stripe account info in winner field
    await db.collection("users").doc(userId).update({
      'winner.stripeAccountId': account.id,
      'winner.onboardingStatus': 'incomplete',
      'winner.onboardingLink': accountLink.url,
      'winner.onboardingExpirationDate': accountLink.expires_at,
      'winner.onboardingPayoutState': 'introduction'
    });

    // Create or update WinnerStripeConnect document
    await createOrUpdateWinnerStripeConnect(userId, account.id, userData.email);

    console.log('[CreateWinnerConnectedAccount] User document and WinnerStripeConnect document updated successfully');

    return {
      statusCode: 200,
      body: JSON.stringify({ 
        success: true,
        accountLink: accountLink.url
      })
    };
  } catch (error) {
    console.error('[CreateWinnerConnectedAccount] Error:', error);
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