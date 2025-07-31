// Function to get challenge and prize information for winners

const { db } = require('./config/firebase');

const handler = async (event) => {
  console.log(`[GetWinnerPrizeInfo] Received ${event.httpMethod} request`);

  // Only accept GET requests
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: JSON.stringify({
        success: false,
        error: 'Method not allowed'
      })
    };
  }

  try {
    const { challengeId, placement } = event.queryStringParameters || {};
    console.log(`[GetWinnerPrizeInfo] Challenge: ${challengeId}, Placement: ${placement}`);

    if (!challengeId || !placement) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          error: 'Missing challengeId or placement parameter'
        })
      };
    }

    // Get challenge document
    const challengeDoc = await db.collection("challenges").doc(challengeId).get();
    if (!challengeDoc.exists) {
      return {
        statusCode: 404,
        body: JSON.stringify({
          success: false,
          error: 'Challenge not found'
        })
      };
    }

    const challengeData = challengeDoc.data();
    console.log(`[GetWinnerPrizeInfo] Challenge: ${challengeData.title}`);

    // Check if challenge has prize money enabled
    if (!challengeData.prizeMoney?.isEnabled || !challengeData.prizeMoney?.totalAmount) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          error: 'Challenge does not have prize money enabled'
        })
      };
    }

    const prizeMoney = challengeData.prizeMoney;
    
    // Calculate prize distribution
    const prizeDistribution = calculatePrizeDistribution(prizeMoney);
    console.log(`[GetWinnerPrizeInfo] Prize distribution:`, prizeDistribution);

    const placementIndex = parseInt(placement) - 1; // Convert to 0-based index
    
    if (placementIndex < 0 || placementIndex >= prizeDistribution.length) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          error: 'Invalid placement for this prize structure'
        })
      };
    }

    const prizeAmount = prizeDistribution[placementIndex];

    const challengeInfo = {
      title: challengeData.title,
      subtitle: challengeData.subtitle,
      prizeAmount: prizeAmount,
      placement: parseInt(placement),
      startDate: challengeData.startDate,
      endDate: challengeData.endDate,
      totalPrizePool: prizeMoney.totalAmount,
      distributionType: prizeMoney.distributionType,
      winnerCount: prizeMoney.winnerCount
    };

    console.log(`[GetWinnerPrizeInfo] Prize info for placement ${placement}: $${prizeAmount / 100}`);

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        challengeInfo: challengeInfo
      })
    };

  } catch (error) {
    console.error('[GetWinnerPrizeInfo] Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error.message
      })
    };
  }
};

// Helper function to calculate prize distribution (same as in calculate-winners.js)
function calculatePrizeDistribution(prizeMoney) {
  const { totalAmount, distributionType, winnerCount, customDistribution } = prizeMoney;
  
  switch (distributionType) {
    case 'winner_takes_all':
      return [totalAmount];
    
    case 'top_three_equal':
      const amountPerWinner = Math.floor(totalAmount / 3);
      return [amountPerWinner, amountPerWinner, amountPerWinner];
    
    case 'top_three_weighted':
      const first = Math.floor(totalAmount * 0.5);  // 50%
      const second = Math.floor(totalAmount * 0.3); // 30%
      const third = totalAmount - first - second;   // 20%
      return [first, second, third];
    
    case 'custom':
      if (customDistribution && customDistribution.length === winnerCount &&
          customDistribution.reduce((sum, pct) => sum + pct, 0) === 100) {
        return customDistribution.map(pct => 
          Math.floor(totalAmount * pct / 100.0)
        );
      } else {
        // Fallback to equal distribution if custom is invalid
        const equalAmount = Math.floor(totalAmount / winnerCount);
        return Array(winnerCount).fill(equalAmount);
      }
    
    default:
      return [totalAmount];
  }
}

module.exports = { handler }; 