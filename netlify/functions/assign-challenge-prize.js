// Function to assign prize money to challenges
const { db, headers } = require('./config/firebase');

const handler = async (event) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
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
    if (!db) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Firebase database not available'
        })
      };
    }

    const {
      challengeId,
      challengeTitle,
      prizeAmount,
      prizeStructure,
      description,
      customDistribution,
      createdBy,
      status = 'assigned'
    } = JSON.parse(event.body || '{}');

    console.log('[AssignChallengePrize] Processing request:', {
      challengeId,
      challengeTitle,
      prizeAmount,
      prizeStructure,
      createdBy
    });

    // Validate challengeId format
    if (!challengeId || typeof challengeId !== 'string' || challengeId.trim() === '') {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Invalid challengeId format'
        })
      };
    }

    // Validate required fields
    if (!challengeId || !challengeTitle || !prizeAmount || !prizeStructure || !createdBy) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Missing required fields: challengeId, challengeTitle, prizeAmount, prizeStructure, createdBy'
        })
      };
    }

    // Validate prize amount
    if (prizeAmount <= 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Prize amount must be greater than 0'
        })
      };
    }

    // Validate prize structure
    const validStructures = ['winner_takes_all', 'top_three_split', 'top_five_split', 'custom'];
    if (!validStructures.includes(prizeStructure)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Invalid prize structure'
        })
      };
    }

    // Validate custom distribution if needed
    if (prizeStructure === 'custom') {
      if (!customDistribution || !Array.isArray(customDistribution)) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            success: false,
            error: 'Custom distribution is required for custom prize structure'
          })
        };
      }

      const totalPercentage = customDistribution.reduce((sum, dist) => sum + (dist.percentage || 0), 0);
      if (Math.abs(totalPercentage - 100) > 0.01) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            success: false,
            error: `Custom distribution percentages must sum to 100% (currently ${totalPercentage}%)`
          })
        };
      }
    }

    // Check if challenge exists in the sweatlist-collection
    console.log(`[AssignChallengePrize] Checking if challenge exists: ${challengeId}`);
    const challengeDoc = await db.collection('sweatlist-collection').doc(challengeId).get();
    
    if (!challengeDoc.exists) {
      console.log(`[AssignChallengePrize] Challenge not found in sweatlist-collection: ${challengeId}`);
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Challenge not found'
        })
      };
    }
    
    console.log(`[AssignChallengePrize] Challenge found: ${challengeId}`);
    const challengeData = challengeDoc.data();
    console.log(`[AssignChallengePrize] Challenge data title: ${challengeData?.challenge?.title || 'No title'}`);
    
    // Verify it has challenge data structure
    if (!challengeData?.challenge) {
      console.log(`[AssignChallengePrize] Document exists but missing challenge data: ${challengeId}`);
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Challenge data not found in document'
        })
      };
    }

    // Check if prize is already assigned to this challenge
    const existingPrizeQuery = await db.collection('challenge-prizes')
      .where('challengeId', '==', challengeId)
      .where('status', '!=', 'cancelled')
      .get();

    if (!existingPrizeQuery.empty) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Prize money is already assigned to this challenge'
        })
      };
    }

    // Create prize assignment document
    const prizeData = {
      challengeId,
      challengeTitle,
      prizeAmount: Number(prizeAmount),
      prizeStructure,
      description: description || `Prize money for ${challengeTitle}`,
      customDistribution: prizeStructure === 'custom' ? customDistribution : null,
      status,
      createdBy,
      createdAt: new Date(),
      updatedAt: new Date(),
      
      // Additional metadata
      distributionStatus: 'pending', // pending, calculating, distributed, failed
      winnerConfirmed: false,
      hostConfirmed: false,
      
      // Calculate distribution based on structure
      distributionPlan: calculateDistributionPlan(prizeAmount, prizeStructure, customDistribution)
    };

    // Save to Firestore
    const prizeRef = await db.collection('challenge-prizes').add(prizeData);
    
    console.log(`[AssignChallengePrize] Prize assigned successfully with ID: ${prizeRef.id}`);

    // Also update the challenge document to mark it as having a prize
    await db.collection('sweatlist-collection').doc(challengeId).update({
      hasPrize: true,
      prizeAmount: Number(prizeAmount),
      prizeStructure,
      updatedAt: new Date()
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        prizeId: prizeRef.id,
        message: 'Prize money assigned successfully',
        prizeData: {
          ...prizeData,
          id: prizeRef.id
        }
      })
    };

  } catch (error) {
    console.error('[AssignChallengePrize] Error:', error);
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

// Helper function to calculate distribution plan
function calculateDistributionPlan(prizeAmount, structure, customDistribution = null) {
  const amount = Number(prizeAmount);
  
  switch (structure) {
    case 'winner_takes_all':
      return [
        { rank: 1, amount: amount, percentage: 100 }
      ];
      
    case 'top_three_split':
      return [
        { rank: 1, amount: amount * 0.6, percentage: 60 },
        { rank: 2, amount: amount * 0.25, percentage: 25 },
        { rank: 3, amount: amount * 0.15, percentage: 15 }
      ];
      
    case 'top_five_split':
      return [
        { rank: 1, amount: amount * 0.4, percentage: 40 },
        { rank: 2, amount: amount * 0.25, percentage: 25 },
        { rank: 3, amount: amount * 0.2, percentage: 20 },
        { rank: 4, amount: amount * 0.1, percentage: 10 },
        { rank: 5, amount: amount * 0.05, percentage: 5 }
      ];
      
    case 'custom':
      if (!customDistribution) return [];
      return customDistribution.map(dist => ({
        rank: dist.rank,
        amount: amount * (dist.percentage / 100),
        percentage: dist.percentage
      }));
      
    default:
      return [];
  }
}

module.exports = { handler }; 