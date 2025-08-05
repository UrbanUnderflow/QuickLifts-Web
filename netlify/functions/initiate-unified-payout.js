// Function to initiate unified payouts combining creator earnings and winner prize money

const Stripe = require('stripe');
const { db, headers } = require('./config/firebase');

console.log('Starting initiate-unified-payout function initialization...');

// Initialize Stripe
let stripe;
try {
  if (process.env.STRIPE_SECRET_KEY) {
    stripe = Stripe(process.env.STRIPE_SECRET_KEY);
    console.log('Stripe initialized successfully for unified payouts');
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
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
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
    // Check if Stripe is available
    if (!stripe) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          success: false, 
          error: 'Stripe is not available. Configuration error.' 
        })
      };
    }

    // Check if db is available
    if (!db) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          success: false, 
          error: 'Firebase database is not available. Configuration error.' 
        })
      };
    }

    const requestBody = JSON.parse(event.body || '{}');
    const { userId, amount, currency = 'usd' } = requestBody;

    console.log('Received unified payout request:', {
      userId,
      amount,
      currency,
      timestamp: new Date().toISOString()
    });

    if (!userId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, error: 'Missing userId parameter' })
      };
    }

    if (!amount || amount < 10) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          success: false, 
          error: 'Invalid amount. Minimum payout is $10.00' 
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
        headers,
        body: JSON.stringify({
          success: false,
          error: 'User not found'
        })
      };
    }

    const userData = userDoc.data();
    console.log('User data retrieved, checking for payout accounts...');
    
    const hasCreatorAccount = !!(userData.creator && userData.creator.stripeAccountId);
    const hasWinnerAccount = !!(userData.winner && userData.winner.stripeAccountId);
    
    console.log('Payout accounts available:', {
      hasCreatorAccount,
      hasWinnerAccount,
      creatorAccountId: userData.creator?.stripeAccountId || 'none',
      winnerAccountId: userData.winner?.stripeAccountId || 'none'
    });

    if (!hasCreatorAccount && !hasWinnerAccount) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'No Stripe account found. Please complete account setup first.'
        })
      };
    }

    // Get current earnings data to determine available balances
    const { handler: getUnifiedEarningsHandler } = require('./get-unified-earnings');
    const earningsResponse = await getUnifiedEarningsHandler({
      httpMethod: 'GET',
      queryStringParameters: { userId }
    });

    const earningsData = JSON.parse(earningsResponse.body);
    if (!earningsData.success) {
      throw new Error('Unable to fetch current earnings data');
    }

    const earnings = earningsData.earnings;
    console.log('Current earnings data:', {
      totalBalance: earnings.totalBalance,
      creatorBalance: earnings.creatorEarnings.availableBalance,
      winnerBalance: earnings.prizeWinnings.availableBalance
    });

    // Validate payout amount against available balance
    if (amount > earnings.totalBalance) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: `Insufficient balance. Available: $${earnings.totalBalance.toFixed(2)}, Requested: $${amount.toFixed(2)}`
        })
      };
    }

    // Determine payout strategy based on available balances and accounts
    const payoutStrategy = determinePayoutStrategy({
      amount,
      creatorBalance: earnings.creatorEarnings.availableBalance,
      winnerBalance: earnings.prizeWinnings.availableBalance,
      hasCreatorAccount,
      hasWinnerAccount,
      creatorAccountId: userData.creator?.stripeAccountId,
      winnerAccountId: userData.winner?.stripeAccountId
    });

    console.log('Payout strategy determined:', payoutStrategy);

    // Execute the payout(s) based on strategy
    const payoutResults = await executePayoutStrategy(payoutStrategy, stripe);

    // Log the payout for record keeping
    await logPayoutRecord({
      userId,
      amount,
      currency,
      strategy: payoutStrategy,
      results: payoutResults,
      timestamp: new Date()
    });

    console.log('Unified payout completed successfully:', payoutResults);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        payout: {
          amount,
          currency,
          strategy: payoutStrategy.type,
          results: payoutResults,
          estimatedArrival: calculateEstimatedArrival()
        },
        message: 'Payout initiated successfully',
        timestamp: new Date().toISOString()
      })
    };

  } catch (error) {
    console.error('Error initiating unified payout:', error);
    console.error('Error details:', error.message, error.stack);
    
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

// Helper function to determine the best payout strategy
function determinePayoutStrategy({ amount, creatorBalance, winnerBalance, hasCreatorAccount, hasWinnerAccount, creatorAccountId, winnerAccountId }) {
  console.log('Determining payout strategy for:', {
    requestedAmount: amount,
    creatorBalance,
    winnerBalance,
    hasCreatorAccount,
    hasWinnerAccount
  });

  // Strategy 1: Single source payout (easiest)
  if (creatorBalance >= amount && hasCreatorAccount) {
    return {
      type: 'single_creator',
      payouts: [{
        accountId: creatorAccountId,
        amount: amount,
        source: 'creator'
      }]
    };
  }

  if (winnerBalance >= amount && hasWinnerAccount) {
    return {
      type: 'single_winner', 
      payouts: [{
        accountId: winnerAccountId,
        amount: amount,
        source: 'winner'
      }]
    };
  }

  // Strategy 2: Combined payout (split across both sources)
  if (hasCreatorAccount && hasWinnerAccount && (creatorBalance + winnerBalance >= amount)) {
    const payouts = [];
    let remainingAmount = amount;

    // Prioritize the account with larger balance
    if (creatorBalance >= winnerBalance) {
      // Use creator balance first
      if (creatorBalance > 0) {
        const creatorAmount = Math.min(creatorBalance, remainingAmount);
        payouts.push({
          accountId: creatorAccountId,
          amount: creatorAmount,
          source: 'creator'
        });
        remainingAmount -= creatorAmount;
      }
      
      // Use winner balance for remainder
      if (remainingAmount > 0 && winnerBalance > 0) {
        payouts.push({
          accountId: winnerAccountId,
          amount: remainingAmount,
          source: 'winner'
        });
      }
    } else {
      // Use winner balance first
      if (winnerBalance > 0) {
        const winnerAmount = Math.min(winnerBalance, remainingAmount);
        payouts.push({
          accountId: winnerAccountId,
          amount: winnerAmount,
          source: 'winner'
        });
        remainingAmount -= winnerAmount;
      }
      
      // Use creator balance for remainder
      if (remainingAmount > 0 && creatorBalance > 0) {
        payouts.push({
          accountId: creatorAccountId,
          amount: remainingAmount,
          source: 'creator'
        });
      }
    }

    return {
      type: 'combined',
      payouts
    };
  }

  // No valid strategy found
  throw new Error('Insufficient balance across all accounts for requested payout amount');
}

// Helper function to execute the determined payout strategy
async function executePayoutStrategy(strategy, stripe) {
  console.log('Executing payout strategy:', strategy.type);
  const results = [];

  for (const payout of strategy.payouts) {
    try {
      console.log(`Creating payout: $${payout.amount} to ${payout.source} account ${payout.accountId}`);
      
      const stripePayoutAmount = Math.round(payout.amount * 100); // Convert to cents
      
      const stripePayout = await stripe.payouts.create({
        amount: stripePayoutAmount,
        currency: 'usd',
        method: 'standard', // Standard payout timing
        statement_descriptor: 'Pulse Earnings'
      }, {
        stripeAccount: payout.accountId
      });

      console.log(`Payout created successfully: ${stripePayout.id}`);
      
      results.push({
        source: payout.source,
        amount: payout.amount,
        stripePayoutId: stripePayout.id,
        status: stripePayout.status,
        estimatedArrival: stripePayout.arrival_date,
        success: true
      });

    } catch (error) {
      console.error(`Error creating payout for ${payout.source}:`, error);
      
      results.push({
        source: payout.source,
        amount: payout.amount,
        error: error.message,
        success: false
      });
      
      // If this is a critical error, we might want to rollback successful payouts
      // For now, we'll continue and let the caller handle partial failures
    }
  }

  return results;
}

// Helper function to log payout records
async function logPayoutRecord({ userId, amount, currency, strategy, results, timestamp }) {
  try {
    const payoutRecord = {
      id: `unified_payout_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      amount,
      currency,
      strategy: strategy.type,
      results,
      requestedAt: timestamp.getTime() / 1000, // Unix timestamp for Firestore compatibility
      createdAt: timestamp.getTime() / 1000,
      updatedAt: timestamp.getTime() / 1000,
      type: 'unified_payout'
    };

    await db.collection('payoutRecords').doc(payoutRecord.id).set(payoutRecord);
    console.log('Payout record logged successfully:', payoutRecord.id);
    
  } catch (error) {
    console.error('Error logging payout record:', error);
    // Don't throw error here as payout was successful, just logging failed
  }
}

// Helper function to calculate estimated arrival date
function calculateEstimatedArrival() {
  // Stripe standard payouts typically take 2-7 business days
  const estimatedDate = new Date();
  estimatedDate.setDate(estimatedDate.getDate() + 3); // 3 business days estimate
  
  return {
    date: estimatedDate.toISOString().split('T')[0],
    businessDays: '2-7 business days',
    note: 'Actual timing may vary based on your bank and Stripe processing'
  };
}

module.exports = { handler }; 