// Function to get unified earnings data combining trainer earnings and winner prize money

const { db, headers } = require('./config/firebase');

console.log('Starting get-unified-earnings function initialization...');

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

  // Only accept GET requests
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ success: false, error: 'Method not allowed' })
    };
  }

  try {
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
    
    const userId = event.queryStringParameters?.userId;
    console.log('Received GET request for unified earnings, userId:', userId);
    
    if (!userId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, error: 'Missing userId parameter' })
      };
    }

    // Get user document from Firestore to check what earning types they have
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
    console.log('User data retrieved, checking for earnings sources...');
    
    // Consider someone as having an account if they've completed onboarding, even if stripeAccountId is temporarily missing
    // This allows auto-fix logic to trigger when stripeAccountId goes missing
    const hasCreatorAccount = !!(userData.creator && 
      (userData.creator.stripeAccountId || userData.creator.onboardingStatus === 'complete'));
    const hasWinnerAccount = !!(userData.winner && 
      (userData.winner.stripeAccountId || userData.winner.onboardingStatus === 'complete'));
    
    console.log('Earnings sources available:', {
      hasCreatorAccount,
      hasWinnerAccount,
      creatorOnboardingStatus: userData.creator?.onboardingStatus || 'none',
      winnerOnboardingStatus: userData.winner?.onboardingStatus || 'none',
      creatorStripeAccountId: userData.creator?.stripeAccountId || 'missing',
      winnerStripeAccountId: userData.winner?.stripeAccountId || 'missing'
    });

    // Fetch earnings data from both sources in parallel
    const [creatorEarningsData, winnerPrizeData] = await Promise.allSettled([
      // Fetch creator earnings (only if they have a creator account)
      hasCreatorAccount ? fetchCreatorEarnings(userId, userData.creator?.stripeAccountId) : Promise.resolve(null),
      
      // Fetch winner prize data (always fetch, as they might have pending prizes)
      fetchWinnerPrizeData(userId)
    ]);

    // Process results
    const creatorEarnings = creatorEarningsData.status === 'fulfilled' ? creatorEarningsData.value : null;
    const winnerPrizes = winnerPrizeData.status === 'fulfilled' ? winnerPrizeData.value : null;

    if (creatorEarningsData.status === 'rejected') {
      console.warn('Error fetching creator earnings:', creatorEarningsData.reason);
    }
    if (winnerPrizeData.status === 'rejected') {
      console.warn('Error fetching winner prize data:', winnerPrizeData.reason);
    }

    // Build unified earnings response
    const unifiedEarnings = buildUnifiedEarningsResponse({
      userId,
      userData,
      creatorEarnings,
      winnerPrizes,
      hasCreatorAccount,
      hasWinnerAccount
    });

    console.log('Returning unified earnings data:', {
      totalBalance: unifiedEarnings.totalBalance,
      totalEarned: unifiedEarnings.totalEarned,
      transactionCount: unifiedEarnings.transactions.length,
      hasCreatorEarnings: !!creatorEarnings,
      hasWinnerPrizes: !!winnerPrizes
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        earnings: unifiedEarnings,
        timestamp: new Date().toISOString()
      })
    };

  } catch (error) {
    console.error('Error getting unified earnings data:', error);
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

// Helper function to fetch creator earnings data
async function fetchCreatorEarnings(userId, stripeAccountId) {
  try {
    console.log('Fetching creator earnings for userId:', userId, 'stripeAccountId:', stripeAccountId || 'missing');
    
    // If stripeAccountId is missing, return empty earnings data (new account state)
    // This allows auto-fix logic to trigger instead of failing
    if (!stripeAccountId) {
      console.warn('No stripeAccountId found for creator - returning empty earnings (triggers auto-fix)');
      return {
        totalEarned: 0,
        pendingPayout: 0,
        availableBalance: 0,
        roundsSold: 0,
        recentSales: [],
        lastUpdated: new Date().toISOString(),
        isNewAccount: true,
        missingStripeAccount: true // Flag to indicate this is due to missing stripeAccountId
      };
    }
    
    // Import and call the existing get-earnings function
    const { handler: getEarningsHandler } = require('./get-earnings');
    
    const mockEvent = {
      httpMethod: 'GET',
      queryStringParameters: { userId }
    };
    
    const response = await getEarningsHandler(mockEvent);
    const responseData = JSON.parse(response.body);
    
    if (responseData.success && responseData.earnings) {
      console.log('Creator earnings fetched successfully');
      return responseData.earnings;
    } else {
      console.warn('Creator earnings fetch failed:', responseData.error);
      return null;
    }
  } catch (error) {
    console.error('Error fetching creator earnings:', error);
    throw error;
  }
}

// Helper function to fetch winner prize data
async function fetchWinnerPrizeData(userId) {
  try {
    console.log('Fetching winner prize data for userId:', userId);
    
    // Import and call the existing get-winner-prize-history function
    const { handler: getWinnerHistoryHandler } = require('./get-winner-prize-history');
    
    const mockEvent = {
      httpMethod: 'GET',
      queryStringParameters: { userId }
    };
    
    const response = await getWinnerHistoryHandler(mockEvent);
    const responseData = JSON.parse(response.body);
    
    if (responseData.success) {
      console.log('Winner prize data fetched successfully');
      return {
        prizeRecords: responseData.prizeRecords || [],
        summary: responseData.summary || {}
      };
    } else {
      console.warn('Winner prize data fetch failed:', responseData.error);
      return { prizeRecords: [], summary: {} };
    }
  } catch (error) {
    console.error('Error fetching winner prize data:', error);
    throw error;
  }
}

// Helper function to build unified earnings response
function buildUnifiedEarningsResponse({ userId, userData, creatorEarnings, winnerPrizes, hasCreatorAccount, hasWinnerAccount }) {
  console.log('Building unified earnings response...');
  
  try {

  // Initialize earnings data with defaults
  const creatorData = {
    totalEarned: 0,
    availableBalance: 0,
    pendingPayout: 0,
    roundsSold: 0,
    stripeAccountId: userData.creator?.stripeAccountId || null,
    onboardingStatus: userData.creator?.onboardingStatus || 'not_started',
    recentSales: []
  };

  const winnerData = {
    totalEarned: 0,
    availableBalance: 0,
    pendingPayout: 0,
    totalWins: 0,
    stripeAccountId: userData.winner?.stripeAccountId || null,
    onboardingStatus: userData.winner?.onboardingStatus || 'not_started',
    prizeRecords: []
  };

  // Populate creator earnings data
  if (creatorEarnings) {
    creatorData.totalEarned = creatorEarnings.totalEarned || 0;
    creatorData.availableBalance = creatorEarnings.availableBalance || 0;
    creatorData.pendingPayout = creatorEarnings.pendingPayout || 0;
    creatorData.roundsSold = creatorEarnings.roundsSold || 0;
    creatorData.recentSales = creatorEarnings.recentSales || [];
  }

  // Populate winner prize data (convert cents to dollars)
  if (winnerPrizes && winnerPrizes.summary) {
    const summary = winnerPrizes.summary;
    winnerData.totalEarned = (summary.totalEarnings || 0) / 100; // Convert cents to dollars
    winnerData.availableBalance = (summary.paidAmount || 0) / 100; // Paid amount is what's available
    winnerData.pendingPayout = (summary.pendingAmount || 0) / 100; // Convert cents to dollars  
    winnerData.totalWins = summary.totalWins || 0;
    winnerData.prizeRecords = winnerPrizes.prizeRecords || [];
  }

  // Calculate combined totals
  const totalBalance = creatorData.availableBalance + winnerData.availableBalance;
  const totalEarned = creatorData.totalEarned + winnerData.totalEarned;
  const pendingPayout = creatorData.pendingPayout + winnerData.pendingPayout;

  // Build combined transaction history (with error handling)
  let transactions = [];
  try {
    transactions = buildCombinedTransactionHistory(creatorData.recentSales, winnerData.prizeRecords);
  } catch (transactionError) {
    console.error('Error building transaction history:', transactionError);
    transactions = []; // Fallback to empty array
  }

  // Determine payout capabilities
  const canRequestPayout = totalBalance >= 10.00; // Minimum $10 payout
  const minimumPayoutAmount = 10.00;

  // Build the unified response
  const unifiedEarnings = {
    // Combined totals
    totalBalance,
    totalEarned,
    pendingPayout,
    
    // Breakdown by earning type
    creatorEarnings: {
      totalEarned: creatorData.totalEarned,
      availableBalance: creatorData.availableBalance,
      pendingPayout: creatorData.pendingPayout,
      roundsSold: creatorData.roundsSold,
      stripeAccountId: creatorData.stripeAccountId,
      onboardingStatus: creatorData.onboardingStatus
    },
    
    prizeWinnings: {
      totalEarned: winnerData.totalEarned,
      availableBalance: winnerData.availableBalance,
      pendingPayout: winnerData.pendingPayout,
      totalWins: winnerData.totalWins,
      stripeAccountId: winnerData.stripeAccountId,
      onboardingStatus: winnerData.onboardingStatus
    },
    
    // Combined transaction history
    transactions,
    
    // Payout capabilities
    canRequestPayout,
    minimumPayoutAmount,
    nextPayoutDate: totalBalance >= 10 ? 'Available now' : 'When balance reaches $10',
    
    // Account status
    hasCreatorAccount,
    hasWinnerAccount,
    needsAccountSetup: !hasCreatorAccount && !hasWinnerAccount && (creatorData.roundsSold > 0 || winnerData.totalWins > 0),
    
    // Metadata
    lastUpdated: new Date().toISOString(),
    isNewAccount: totalEarned === 0 && transactions.length === 0
  };

  return unifiedEarnings;
  
  } catch (error) {
    console.error('Error in buildUnifiedEarningsResponse:', error);
    // Return a safe fallback response
    return {
      totalBalance: 0,
      totalEarned: 0,
      pendingPayout: 0,
      creatorEarnings: {
        totalEarned: 0,
        availableBalance: 0,
        pendingPayout: 0,
        roundsSold: 0,
        stripeAccountId: userData.creator?.stripeAccountId || null,
        onboardingStatus: userData.creator?.onboardingStatus || 'not_started'
      },
      prizeWinnings: {
        totalEarned: 0,
        availableBalance: 0,
        pendingPayout: 0,
        totalWins: 0,
        stripeAccountId: userData.winner?.stripeAccountId || null,
        onboardingStatus: userData.winner?.onboardingStatus || 'not_started'
      },
      transactions: [],
      canRequestPayout: false,
      minimumPayoutAmount: 10.00,
      nextPayoutDate: 'When balance reaches $10',
      hasCreatorAccount: hasCreatorAccount || false,
      hasWinnerAccount: hasWinnerAccount || false,
      needsAccountSetup: false,
      lastUpdated: new Date().toISOString(),
      isNewAccount: true,
      error: 'Error building earnings response'
    };
  }
}

// Helper function to build combined transaction history
function buildCombinedTransactionHistory(creatorSales, prizeRecords) {
  const transactions = [];

  // Add creator sales to transaction history
  if (creatorSales && Array.isArray(creatorSales)) {
    creatorSales.forEach(sale => {
      transactions.push({
        id: sale.id || `creator_${Date.now()}_${Math.random()}`,
        type: 'creator_sale',
        date: sale.date || new Date().toISOString().split('T')[0],
        amount: sale.amount || 0,
        description: sale.roundTitle || 'Training Program',
        status: sale.status || 'completed',
        metadata: {
          buyerId: sale.buyerId || 'anonymous',
          programTitle: sale.roundTitle || 'Training Program',
          source: sale.source || 'stripe'
        }
      });
    });
  }

  // Add prize winnings to transaction history
  if (prizeRecords && Array.isArray(prizeRecords)) {
    prizeRecords.forEach(record => {
      transactions.push({
        id: record.id || `prize_${Date.now()}_${Math.random()}`,
        type: 'prize_winning',
        date: record.createdAt?.toDate ? 
          record.createdAt.toDate().toISOString().split('T')[0] : 
          new Date(record.createdAt).toISOString().split('T')[0],
        amount: (record.prizeAmount || 0) / 100, // Convert cents to dollars
        description: `${getPlacementText(record.placement)} - ${record.challengeTitle}`,
        status: record.status || 'pending',
        metadata: {
          challengeId: record.challengeId,
          challengeTitle: record.challengeTitle,
          placement: record.placement,
          score: record.score
        }
      });
    });
  }

  // Sort transactions by date (newest first)
  transactions.sort((a, b) => new Date(b.date) - new Date(a.date));

  // Limit to most recent 20 transactions for performance
  return transactions.slice(0, 20);
}

// Helper function to get placement text
function getPlacementText(placement) {
  switch (placement) {
    case 1: return '🥇 1st Place';
    case 2: return '🥈 2nd Place';
    case 3: return '🥉 3rd Place';
    default: return `🏆 ${placement}th Place`;
  }
}

// Helper function to calculate next payout date
function calculateNextPayoutDate(totalBalance) {
  if (totalBalance < 10.00) {
    return null; // Not eligible for payout
  }
  
  // Stripe typically processes payouts within 2-7 business days
  const nextPayout = new Date();
  nextPayout.setDate(nextPayout.getDate() + 3); // 3 business days estimate
  
  return nextPayout.toISOString().split('T')[0];
}

module.exports = { handler }; 