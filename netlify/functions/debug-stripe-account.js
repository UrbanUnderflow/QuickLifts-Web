// Debug function to test a specific Stripe account
const { db, headers } = require('./config/firebase');
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

const handler = async (event) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
      },
      body: ''
    };
  }

  try {
    const userId = event.queryStringParameters?.userId;
    const stripeAccountId = event.queryStringParameters?.stripeAccountId;
    
    console.log('Debug request:', { userId, stripeAccountId });
    
    if (!userId && !stripeAccountId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          success: false, 
          error: 'Either userId or stripeAccountId parameter required' 
        })
      };
    }

    const results = {
      timestamp: new Date().toISOString(),
      environment: {
        hasStripeKey: !!process.env.STRIPE_SECRET_KEY,
        stripeInitialized: !!stripe,
        keyPrefix: process.env.STRIPE_SECRET_KEY ? process.env.STRIPE_SECRET_KEY.substring(0, 10) + '...' : 'none'
      },
      tests: {}
    };

    // Get user data if userId provided
    if (userId) {
      try {
        const userDoc = await db.collection('users').doc(userId).get();
        if (userDoc.exists) {
          const userData = userDoc.data();
          results.user = {
            id: userId,
            email: userData.email,
            hasCreator: !!userData.creator,
            stripeAccountId: userData.creator?.stripeAccountId || null,
            onboardingStatus: userData.creator?.onboardingStatus || null
          };
          
          // Use the account ID from user data if not provided
          if (!stripeAccountId && userData.creator?.stripeAccountId) {
            results.usingAccountId = userData.creator.stripeAccountId;
          }
        } else {
          results.user = { error: 'User not found' };
        }
      } catch (userError) {
        results.user = { error: userError.message };
      }
    }

    const accountIdToTest = stripeAccountId || results.usingAccountId;
    
    if (accountIdToTest && stripe) {
      console.log('Testing Stripe account:', accountIdToTest);
      
      // Test 1: Account retrieval
      try {
        const account = await stripe.accounts.retrieve(accountIdToTest);
        results.tests.accountRetrieval = {
          success: true,
          data: {
            id: account.id,
            object: account.object,
            country: account.country,
            charges_enabled: account.charges_enabled,
            payouts_enabled: account.payouts_enabled,
            details_submitted: account.details_submitted,
            restricted: account.restricted,
            type: account.type
          }
        };
      } catch (error) {
        results.tests.accountRetrieval = {
          success: false,
          error: error.message,
          code: error.code,
          type: error.type
        };
      }

      // Test 2: Balance retrieval
      try {
        const balance = await stripe.balance.retrieve({
          stripeAccount: accountIdToTest
        });
        results.tests.balanceRetrieval = {
          success: true,
          data: {
            available: balance.available,
            pending: balance.pending,
            connect_reserved: balance.connect_reserved
          }
        };
      } catch (error) {
        results.tests.balanceRetrieval = {
          success: false,
          error: error.message,
          code: error.code,
          type: error.type
        };
      }

      // Test 3: Payment intents list
      try {
        const paymentIntents = await stripe.paymentIntents.list({
          limit: 10
        }, {
          stripeAccount: accountIdToTest
        });
        results.tests.paymentIntentsList = {
          success: true,
          count: paymentIntents.data.length,
          recent: paymentIntents.data.slice(0, 3).map(pi => ({
            id: pi.id,
            amount: pi.amount,
            currency: pi.currency,
            status: pi.status,
            created: new Date(pi.created * 1000).toISOString()
          }))
        };
      } catch (error) {
        results.tests.paymentIntentsList = {
          success: false,
          error: error.message,
          code: error.code,
          type: error.type
        };
      }

      // Test 4: Transfers to this account
      try {
        const transfers = await stripe.transfers.list({
          destination: accountIdToTest,
          limit: 10
        });
        results.tests.transfersToAccount = {
          success: true,
          count: transfers.data.length,
          totalAmount: transfers.data.reduce((sum, transfer) => sum + transfer.amount, 0),
          recent: transfers.data.slice(0, 3).map(transfer => ({
            id: transfer.id,
            amount: transfer.amount,
            currency: transfer.currency,
            created: new Date(transfer.created * 1000).toISOString()
          }))
        };
      } catch (error) {
        results.tests.transfersToAccount = {
          success: false,
          error: error.message,
          code: error.code,
          type: error.type
        };
      }

      // Test 5: Charges for this account
      try {
        const charges = await stripe.charges.list({
          limit: 10
        }, {
          stripeAccount: accountIdToTest
        });
        results.tests.chargesOnAccount = {
          success: true,
          count: charges.data.length,
          totalAmount: charges.data.reduce((sum, charge) => sum + charge.amount, 0),
          recent: charges.data.slice(0, 3).map(charge => ({
            id: charge.id,
            amount: charge.amount,
            currency: charge.currency,
            status: charge.status,
            created: new Date(charge.created * 1000).toISOString()
          }))
        };
      } catch (error) {
        results.tests.chargesOnAccount = {
          success: false,
          error: error.message,
          code: error.code,
          type: error.type
        };
      }

      // Test 6: Search for accounts with your email to see if there are others
      try {
        const allAccounts = await stripe.accounts.list({ limit: 100 });
        const userEmail = results.user?.email;
        const matchingAccounts = allAccounts.data.filter(account => 
          account.email === userEmail || 
          (account.business_profile && account.business_profile.support_email === userEmail)
        );
        results.tests.allMatchingAccounts = {
          success: true,
          count: matchingAccounts.length,
          accounts: matchingAccounts.map(account => ({
            id: account.id,
            email: account.email,
            type: account.type,
            charges_enabled: account.charges_enabled,
            payouts_enabled: account.payouts_enabled,
            created: new Date(account.created * 1000).toISOString()
          }))
        };
      } catch (error) {
        results.tests.allMatchingAccounts = {
          success: false,
          error: error.message,
          code: error.code,
          type: error.type
        };
      }
    } else {
      results.tests.error = 'No account ID to test or Stripe not initialized';
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        debug: results
      }, null, 2)
    };

  } catch (error) {
    console.error('Debug function error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message
      })
    };
  }
};

module.exports = { handler };