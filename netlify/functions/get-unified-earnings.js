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
    
    // STRICT definition: user MUST have a real stripeAccountId to be considered as having an account
    // We still expose onboardingStatus in the response for UI/repair flows
    const hasCreatorAccount = !!(userData.creator && userData.creator.stripeAccountId);
    const hasWinnerAccount = !!(userData.winner && userData.winner.stripeAccountId);
    
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
      recentSalesCount: (unifiedEarnings.recentSales || []).length,
      prizeRecordsCount: (unifiedEarnings.prizeRecords || []).length,
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
      console.log('Creator earnings fetched successfully:', {
        hasRecentSales: !!responseData.earnings.recentSales,
        recentSalesLength: responseData.earnings.recentSales ? responseData.earnings.recentSales.length : 0,
        earningsKeys: Object.keys(responseData.earnings),
        firstSale: responseData.earnings.recentSales ? responseData.earnings.recentSales[0] : null
      });
      return responseData.earnings;
    } else {
      console.warn('Creator earnings fetch failed:', responseData.error);
      // Return empty structure instead of null to ensure recentSales property exists
      return {
        totalEarned: 0,
        availableBalance: 0,
        pendingPayout: 0,
        roundsSold: 0,
        recentSales: [],
        lastUpdated: new Date().toISOString(),
        isNewAccount: true
      };
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

  // Return raw data - let frontend format transactions as needed
  // No more server-side transaction building complexity!

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
    
    // Raw transaction data for frontend formatting
    recentSales: creatorData.recentSales || [],
    prizeRecords: winnerData.prizeRecords || [],
    
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
    isNewAccount: totalEarned === 0 && (creatorData.recentSales || []).length === 0 && (winnerData.prizeRecords || []).length === 0
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
      recentSales: [],
      prizeRecords: [],
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

// Removed complex server-side transaction building
// Frontend will handle formatting of recentSales and prizeRecords

module.exports = { handler }; 