// Compatibility layer for unified earnings system
// This allows existing endpoints to continue working while gradually transitioning to unified system

const console = require('console');

/**
 * Compatibility wrapper for existing get-earnings function
 * Maintains existing response format while internally using unified system
 */
async function getTrainerEarningsCompatibility(userId) {
  try {
    console.log('Using compatibility layer for trainer earnings:', userId);
    
    // Import and call the unified earnings function
    const { handler: getUnifiedEarningsHandler } = require('../get-unified-earnings');
    
    const response = await getUnifiedEarningsHandler({
      httpMethod: 'GET',
      queryStringParameters: { userId }
    });
    
    const responseData = JSON.parse(response.body);
    
    if (responseData.success && responseData.earnings) {
      const unifiedEarnings = responseData.earnings;
      
      // Convert unified response back to legacy trainer earnings format
      const legacyEarnings = {
        totalEarned: unifiedEarnings.creatorEarnings.totalEarned,
        pendingPayout: unifiedEarnings.creatorEarnings.pendingPayout,
        availableBalance: unifiedEarnings.creatorEarnings.availableBalance,
        roundsSold: unifiedEarnings.creatorEarnings.roundsSold,
        recentSales: unifiedEarnings.transactions
          .filter(t => t.type === 'creator_sale')
          .map(t => ({
            date: t.date,
            roundTitle: t.metadata?.programTitle || t.description,
            amount: t.amount,
            status: t.status,
            buyerId: t.metadata?.buyerId || 'anonymous',
            source: t.metadata?.source || 'unified'
          })),
        lastUpdated: unifiedEarnings.lastUpdated,
        isNewAccount: unifiedEarnings.isNewAccount && unifiedEarnings.creatorEarnings.totalEarned === 0
      };
      
      console.log('Compatibility layer: converted unified to legacy format');
      return {
        success: true,
        earnings: legacyEarnings
      };
    } else {
      console.warn('Compatibility layer: unified earnings failed:', responseData.error);
      return responseData;
    }
  } catch (error) {
    console.error('Compatibility layer error for trainer earnings:', error);
    throw error;
  }
}

/**
 * Compatibility wrapper for existing get-winner-prize-history function
 * Maintains existing response format while internally using unified system
 */
async function getWinnerPrizeHistoryCompatibility(userId) {
  try {
    console.log('Using compatibility layer for winner prize history:', userId);
    
    // Import and call the unified earnings function
    const { handler: getUnifiedEarningsHandler } = require('../get-unified-earnings');
    
    const response = await getUnifiedEarningsHandler({
      httpMethod: 'GET',
      queryStringParameters: { userId }
    });
    
    const responseData = JSON.parse(response.body);
    
    if (responseData.success && responseData.earnings) {
      const unifiedEarnings = responseData.earnings;
      
      // Convert unified response back to legacy winner format
      const prizeRecords = unifiedEarnings.transactions
        .filter(t => t.type === 'prize_winning')
        .map(t => ({
          id: t.id,
          challengeId: t.metadata?.challengeId || '',
          challengeTitle: t.metadata?.challengeTitle || t.description,
          placement: t.metadata?.placement || 1,
          score: t.metadata?.score || 0,
          prizeAmount: Math.round(t.amount * 100), // Convert back to cents
          status: t.status,
          createdAt: { toDate: () => new Date(t.date) },
          updatedAt: { toDate: () => new Date(t.date) },
          paidAt: t.status === 'paid' ? { toDate: () => new Date(t.date) } : null
        }));

      const summary = {
        totalEarnings: Math.round(unifiedEarnings.prizeWinnings.totalEarned * 100), // Convert to cents
        totalWins: unifiedEarnings.prizeWinnings.totalWins || prizeRecords.length,
        pendingAmount: Math.round(unifiedEarnings.prizeWinnings.pendingPayout * 100), // Convert to cents
        paidAmount: Math.round(unifiedEarnings.prizeWinnings.availableBalance * 100), // Convert to cents
        onboardingStatus: unifiedEarnings.prizeWinnings.onboardingStatus,
        stripeAccountId: unifiedEarnings.prizeWinnings.stripeAccountId,
        lastPayoutDate: prizeRecords
          .filter(record => record.status === 'paid' && record.paidAt)
          .map(record => record.paidAt.toDate().getTime() / 1000)
          .sort((a, b) => b - a)[0] || null
      };
      
      console.log('Compatibility layer: converted unified to legacy winner format');
      return {
        success: true,
        prizeRecords,
        summary,
        timestamp: unifiedEarnings.lastUpdated
      };
    } else {
      console.warn('Compatibility layer: unified earnings failed:', responseData.error);
      return responseData;
    }
  } catch (error) {
    console.error('Compatibility layer error for winner prize history:', error);
    throw error;
  }
}

/**
 * Compatibility wrapper for existing dashboard link generation
 * Routes to appropriate account based on context
 */
async function getDashboardLinkCompatibility(userId, accountType = 'auto') {
  try {
    console.log('Using compatibility layer for dashboard link:', userId, accountType);
    
    // Import and call the unified dashboard link function
    const { handler: getUnifiedDashboardLinkHandler } = require('../get-dashboard-link-unified');
    
    const response = await getUnifiedDashboardLinkHandler({
      httpMethod: 'POST',
      body: JSON.stringify({ userId, accountType })
    });
    
    const responseData = JSON.parse(response.body);
    
    if (responseData.success) {
      console.log('Compatibility layer: dashboard link generated successfully');
      return {
        success: true,
        url: responseData.url,
        accountType: responseData.accountInfo?.type,
        expiresAt: responseData.expiresAt
      };
    } else {
      console.warn('Compatibility layer: dashboard link generation failed:', responseData.error);
      return responseData;
    }
  } catch (error) {
    console.error('Compatibility layer error for dashboard link:', error);
    throw error;
  }
}

/**
 * Compatibility wrapper for payout functions
 * Routes to unified payout system while maintaining response format
 */
async function initiatePayoutCompatibility(userId, amount, currency = 'usd', sourceType = 'auto') {
  try {
    console.log('Using compatibility layer for payout:', userId, amount, sourceType);
    
    // Import and call the unified payout function
    const { handler: initiateUnifiedPayoutHandler } = require('../initiate-unified-payout');
    
    const response = await initiateUnifiedPayoutHandler({
      httpMethod: 'POST',
      body: JSON.stringify({ userId, amount, currency })
    });
    
    const responseData = JSON.parse(response.body);
    
    if (responseData.success) {
      const payout = responseData.payout;
      
      console.log('Compatibility layer: payout initiated successfully');
      return {
        success: true,
        payout: {
          amount: payout.amount,
          currency: payout.currency,
          strategy: payout.strategy,
          estimatedArrival: payout.estimatedArrival.date,
          payoutIds: payout.results
            .filter(r => r.success)
            .map(r => r.stripePayoutId)
        },
        message: 'Payout initiated successfully'
      };
    } else {
      console.warn('Compatibility layer: payout initiation failed:', responseData.error);
      return responseData;
    }
  } catch (error) {
    console.error('Compatibility layer error for payout:', error);
    throw error;
  }
}

/**
 * Helper function to determine if a user should use unified system
 * This allows for gradual rollout and A/B testing
 */
function shouldUseUnifiedSystem(userId, featureFlag = 'unified_earnings') {
  // For now, enable for all users
  // In production, this could check feature flags, user segments, etc.
  
  try {
    // Simple hash-based rollout (optional)
    if (process.env.UNIFIED_EARNINGS_ROLLOUT_PERCENTAGE) {
      const rolloutPercentage = parseInt(process.env.UNIFIED_EARNINGS_ROLLOUT_PERCENTAGE);
      if (rolloutPercentage < 100) {
        const hash = hashString(userId);
        const userPercentage = hash % 100;
        const shouldUse = userPercentage < rolloutPercentage;
        console.log(`Unified system rollout check: ${userPercentage}% < ${rolloutPercentage}% = ${shouldUse}`);
        return shouldUse;
      }
    }
    
    // Default to enabled for all users
    return true;
  } catch (error) {
    console.error('Error checking unified system rollout:', error);
    return false; // Fallback to legacy system on error
  }
}

/**
 * Simple string hash function for rollout percentage
 */
function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

/**
 * Migration helper to log usage patterns for analytics
 */
function logCompatibilityUsage(functionName, userId, usedUnified = true) {
  try {
    console.log(`COMPATIBILITY_USAGE: ${functionName}`, {
      userId: userId.substring(0, 8) + '...', // Partial ID for privacy
      usedUnified,
      timestamp: new Date().toISOString(),
      function: functionName
    });
  } catch (error) {
    // Silent fail on logging
  }
}

module.exports = {
  getTrainerEarningsCompatibility,
  getWinnerPrizeHistoryCompatibility,
  getDashboardLinkCompatibility,
  initiatePayoutCompatibility,
  shouldUseUnifiedSystem,
  logCompatibilityUsage
}; 