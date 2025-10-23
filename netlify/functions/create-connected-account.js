// Docs on event and context https://docs.netlify.com/functions/build/#code-your-function-2

const Stripe = require('stripe');
const { db } = require('./config/firebase');

// Initialize Stripe with your secret key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

async function updateOnboardingLink(userId, link, expiration) {
  try {
    const userRef = db.collection("users").doc(userId);
    
    // Use set with merge to handle null creator objects
    await userRef.set({
      creator: {
        onboardingLink: link,
        onboardingExpirationDate: expiration,
        onboardingPayoutState: 'introduction'
      }
    }, { merge: true });
    
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

    // Validate Stripe key exists
    if (!process.env.STRIPE_SECRET_KEY) {
      console.error('[CreateConnectedAccount] STRIPE_SECRET_KEY not configured');
      return {
        statusCode: 500,
        body: JSON.stringify({
          success: false,
          error: 'Stripe configuration error. Please contact support.',
          details: 'STRIPE_SECRET_KEY not configured'
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
    
    // CRITICAL: Validate email exists
    if (!userData.email) {
      console.error(`[CreateConnectedAccount] User ${userId} does not have an email in Firestore`);
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          error: 'Your account is missing an email address. Please update your profile with a valid email.',
          details: 'No email found in user document'
        })
      };
    }
    
    console.log('[CreateConnectedAccount] User data loaded:', {
      userId,
      email: userData.email,
      username: userData.username,
      hasCreator: !!userData.creator,
      hasStripeAccountId: !!userData.creator?.stripeAccountId
    });
    
    // If user already has a Stripe account, create a new onboarding link for it
    if (userData.creator?.stripeAccountId) {
      console.log('[CreateConnectedAccount] User already has Stripe account, creating new onboarding link');
      try {
        const accountLink = await stripe.accountLinks.create({
          account: userData.creator.stripeAccountId,
          refresh_url: `${process.env.SITE_URL || 'https://fitwithpulse.ai'}/trainer/connect-account`,
          return_url: `${process.env.SITE_URL || 'https://fitwithpulse.ai'}/${userData.username}/earnings?complete=true`,
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

    // CRITICAL: Check if account already exists before creating new one
    console.log(`[CreateConnectedAccount] Checking for existing accounts for email: ${userData.email}`);
    
    let account;
    try {
      // Search for existing Connect accounts with this email
      const existingAccounts = await stripe.accounts.list({ limit: 100 });
      const userAccounts = existingAccounts.data.filter(acc => 
        acc.email === userData.email || 
        (acc.business_profile && acc.business_profile.support_email === userData.email)
      );
      
      if (userAccounts.length > 0) {
        console.log(`[CreateConnectedAccount] Found ${userAccounts.length} existing accounts for ${userData.email}`);
        
        // Use smart selection logic to pick the best account
        if (userAccounts.length === 1) {
          account = userAccounts[0];
          console.log(`[CreateConnectedAccount] Using existing account: ${account.id}`);
        } else {
          // Priority 1: Account with activity (balance or transfers)
          for (const existingAccount of userAccounts) {
            try {
              const balance = await stripe.balance.retrieve({ stripeAccount: existingAccount.id });
              const hasBalance = balance.available.some(b => b.amount > 0) || balance.pending.some(b => b.amount > 0);
              
              if (hasBalance) {
                account = existingAccount;
                console.log(`[CreateConnectedAccount] Using existing account with balance: ${account.id}`);
                break;
              }
              
              const transfers = await stripe.transfers.list({ 
                destination: existingAccount.id, 
                limit: 1 
              });
              
              if (transfers.data.length > 0) {
                account = existingAccount;
                console.log(`[CreateConnectedAccount] Using existing account with transfers: ${account.id}`);
                break;
              }
            } catch (error) {
              console.warn(`[CreateConnectedAccount] Could not check activity for ${existingAccount.id}:`, error.message);
            }
          }
          
          // Priority 2: Most recent account if no activity found
          if (!account) {
            account = userAccounts.reduce((latest, current) => 
              current.created > latest.created ? current : latest
            );
            console.log(`[CreateConnectedAccount] Using most recent existing account: ${account.id}`);
          }
        }
      } else {
        console.log(`[CreateConnectedAccount] No existing accounts found, creating new account`);
        
        // CRITICAL: Validate email before creating account
        const pulseEmail = userData.email;
        if (!pulseEmail) {
          throw new Error('User does not have a valid email address in their Pulse profile');
        }

        console.log(`[CreateConnectedAccount] Creating account with Pulse email: ${pulseEmail}`);

        // Create Stripe Express account with tax reporting capabilities
        console.log(`[CreateConnectedAccount] About to create Stripe account with:`, {
          type: 'express',
          email: pulseEmail,
          country: 'US',
          capabilities: {
            card_payments: { requested: true },
            transfers: { requested: true }
          },
          business_type: 'individual',
          settings: {
            payouts: {
              schedule: {
                interval: 'daily'
              }
            }
          }
        });
        
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
                product_description: 'Fitness training and workout programs',
                url: `https://fitwithpulse.ai/profile/${userData.username}`,
                mcc: '7991' // Physical fitness facilities
            },
            metadata: {
                platform: 'pulse',
                account_type: 'trainer',
                user_id: userId,
                username: userData.username,
                purpose: 'creator_earnings',
                pulse_email: pulseEmail // Store for verification
            }
        });
        
        console.log('[CreateConnectedAccount] New account created:', account.id);
      }
    } catch (error) {
      console.error('[CreateConnectedAccount] Error checking/creating account:', error);
      throw error;
    }

    console.log('[CreateConnectedAccount] Account created:', account.id);

    // Create account link for onboarding
    // Use username if available, otherwise use userId as fallback
    const usernameOrId = userData.username && userData.username.trim() !== '' 
      ? userData.username 
      : userId;
    
    // Ensure we have a valid base URL
    const baseUrl = process.env.SITE_URL || 'https://fitwithpulse.ai';
    console.log(`[CreateConnectedAccount] Using base URL: ${baseUrl}`);
    
    const refreshUrl = `${baseUrl}/coach/profile`;
    const returnUrl = `${baseUrl}/coach/profile?complete=true`;
    
    console.log(`[CreateConnectedAccount] Generated URLs:`, {
      refreshUrl,
      returnUrl,
      refreshUrlValid: refreshUrl.startsWith('http'),
      returnUrlValid: returnUrl.startsWith('http')
    });
    
    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: "account_onboarding",
    });

    console.log('[CreateConnectedAccount] Account link created');

    // CRITICAL: Update user document with Stripe account info
    // This is the most important step - if this fails, the user will lose their account linking
    try {
      // Initialize creator object if it's null or doesn't exist
      const creatorData = {
        stripeAccountId: account.id,
        onboardingStatus: 'incomplete',
        onboardingLink: accountLink.url,
        onboardingExpirationDate: accountLink.expires_at,
        onboardingPayoutState: 'introduction'
      };
      
      // Use set with merge to handle null creator objects
      await db.collection("users").doc(userId).set({
        creator: creatorData
      }, { merge: true });
      
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
    console.error('[CreateConnectedAccount] Error:', {
      message: error.message,
      type: error.type,
      code: error.code,
      stack: error.stack,
      raw: error
    });
    
    // Provide more helpful error messages based on error type
    let userMessage = error.message || 'An unexpected error occurred';
    let errorDetails = error.code || error.type || 'unknown_error';
    
    // Handle specific Stripe errors
    if (error.type === 'StripeInvalidRequestError') {
      userMessage = 'Invalid request to Stripe. Please contact support.';
      errorDetails = `Stripe: ${error.message}`;
    } else if (error.type === 'StripeAPIError') {
      userMessage = 'Stripe API error. Please try again or contact support.';
      errorDetails = `Stripe API: ${error.message}`;
    } else if (error.code === 'permission-denied') {
      userMessage = 'Database permission error. Please contact support.';
      errorDetails = `Firestore: ${error.message}`;
    }
    
    return { 
      statusCode: 500, 
      body: JSON.stringify({
        success: false,
        error: userMessage,
        details: errorDetails,
        code: error.code || error.type || 'UNKNOWN'
      })
    };
  }
};

module.exports = { handler };