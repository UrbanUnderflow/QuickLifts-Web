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
          account: userData.creator?.stripeAccountId || userData.winner?.stripeAccountId,
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

    // CRITICAL: Check if account already exists before creating new one
    console.log(`[CreateWinnerConnectedAccount] Checking for existing accounts for email: ${userData.email}`);
    
    let account;
    try {
      // Search for existing Connect accounts with this email
      const existingAccounts = await stripe.accounts.list({ limit: 100 });
      const userAccounts = existingAccounts.data.filter(acc => 
        acc.email === userData.email || 
        (acc.business_profile && acc.business_profile.support_email === userData.email)
      );
      
      if (userAccounts.length > 0) {
        console.log(`[CreateWinnerConnectedAccount] Found ${userAccounts.length} existing accounts for ${userData.email}`);
        
        // Use smart selection logic to pick the best account
        if (userAccounts.length === 1) {
          account = userAccounts[0];
          console.log(`[CreateWinnerConnectedAccount] Using existing account: ${account.id}`);
        } else {
          // Priority 1: Account with activity (balance or transfers)
          for (const existingAccount of userAccounts) {
            try {
              const balance = await stripe.balance.retrieve({ stripeAccount: existingAccount.id });
              const hasBalance = balance.available.some(b => b.amount > 0) || balance.pending.some(b => b.amount > 0);
              
              if (hasBalance) {
                account = existingAccount;
                console.log(`[CreateWinnerConnectedAccount] Using existing account with balance: ${account.id}`);
                break;
              }
              
              const transfers = await stripe.transfers.list({ 
                destination: existingAccount.id, 
                limit: 1 
              });
              
              if (transfers.data.length > 0) {
                account = existingAccount;
                console.log(`[CreateWinnerConnectedAccount] Using existing account with transfers: ${account.id}`);
                break;
              }
            } catch (error) {
              console.warn(`[CreateWinnerConnectedAccount] Could not check activity for ${existingAccount.id}:`, error.message);
            }
          }
          
          // Priority 2: Most recent account if no activity found
          if (!account) {
            account = userAccounts.reduce((latest, current) => 
              current.created > latest.created ? current : latest
            );
            console.log(`[CreateWinnerConnectedAccount] Using most recent existing account: ${account.id}`);
          }
        }
      } else {
        console.log(`[CreateWinnerConnectedAccount] No existing accounts found, creating new account`);
        
        // CRITICAL: Validate email before creating account
        const pulseEmail = userData.email;
        if (!pulseEmail) {
          throw new Error('User does not have a valid email address in their Pulse profile');
        }

        console.log(`[CreateWinnerConnectedAccount] Creating account with Pulse email: ${pulseEmail}`);

        // Create Stripe Express account for winner with tax reporting capabilities
        account = await stripe.accounts.create({
            type: 'express',
            email: pulseEmail, // FORCE same email as Pulse profile
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
                purpose: 'prize_money',
                pulse_email: pulseEmail // Store for verification
            }
        });
        
        console.log('[CreateWinnerConnectedAccount] New account created:', account.id);
      }
    } catch (error) {
      console.error('[CreateWinnerConnectedAccount] Error checking/creating account:', error);
      throw error;
    }

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
      'creator.stripeAccountId': account.id,
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