// Debug function to check prize distribution issues
const { db } = require('./config/firebase');

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Content-Type': 'application/json'
};

const handler = async (event) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, OPTIONS'
      },
      body: ''
    };
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ success: false, error: 'Method not allowed' })
    };
  }

  try {
    const { prizeId } = event.queryStringParameters || {};
    
    if (!prizeId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, error: 'prizeId parameter required' })
      };
    }

    // Get prize assignment
    const prizeDoc = await db.collection('challenge-prizes').doc(prizeId).get();
    if (!prizeDoc.exists) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ success: false, error: 'Prize assignment not found' })
      };
    }

    const prizeData = prizeDoc.data();
    console.log('Prize data:', prizeData);

    // Check for participants in the challenge
    const participantsSnapshot = await db.collection('user-challenge')
      .where('challengeId', '==', prizeData.challengeId)
      .get();

    const participants = [];
    for (const doc of participantsSnapshot.docs) {
      const data = doc.data();
      participants.push({
        userId: data.userId,
        username: data.username,
        score: data.totalScore || data.score || 0,
        isComplete: data.isComplete || false,
        completedAt: data.completedAt,
        pulsePoints: data.pulsePoints
      });
    }

    // Check completed participants
    const completedParticipants = participants
      .filter(p => p.isComplete)
      .sort((a, b) => b.score - a.score);

    // Check winner's Stripe accounts
    const winnerChecks = [];
    for (const participant of completedParticipants.slice(0, 3)) { // Check top 3
      try {
        const userDoc = await db.collection('users').doc(participant.userId).get();
        if (userDoc.exists) {
          const userData = userDoc.data();
          const creatorStripeId = userData.creator?.stripeAccountId;
          const winnerStripeId = userData.winner?.stripeAccountId;
          
          winnerChecks.push({
            userId: participant.userId,
            username: participant.username,
            email: userData.email,
            hasCreatorStripe: !!creatorStripeId,
            hasWinnerStripe: !!winnerStripeId,
            creatorStripeId,
            winnerStripeId,
            score: participant.score
          });
        }
      } catch (error) {
        winnerChecks.push({
          userId: participant.userId,
          username: participant.username,
          error: error.message
        });
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        prizeData: {
          id: prizeId,
          challengeId: prizeData.challengeId,
          prizeAmount: prizeData.prizeAmount,
          distributionStatus: prizeData.distributionStatus,
          winnerDataSnapshot: prizeData.winnerDataSnapshot
        },
        participants: {
          total: participants.length,
          completed: completedParticipants.length,
          details: participants
        },
        topWinners: winnerChecks,
        distributionPlan: prizeData.distributionPlan
      })
    };

  } catch (error) {
    console.error('[DebugPrizeDistribution] Error:', error);
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

module.exports = { handler };
