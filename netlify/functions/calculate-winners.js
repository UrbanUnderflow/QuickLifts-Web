// Function to calculate challenge winners and distribute prize money

const Stripe = require('stripe');
const { db, admin } = require('./config/firebase');

// Initialize Stripe with your secret key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const handler = async (event) => {
  console.log(`[CalculateWinners] Received ${event.httpMethod} request`);

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
    const { challengeId } = JSON.parse(event.body);
    console.log(`[CalculateWinners] Calculating winners for challenge ${challengeId}`);

    if (!challengeId) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          error: 'Missing challengeId'
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
    console.log(`[CalculateWinners] Challenge: ${challengeData.title}`);

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
    console.log(`[CalculateWinners] Prize money total: $${prizeMoney.totalAmount / 100}`);
    
    // Calculate prize distribution
    const prizeDistribution = calculatePrizeDistribution(prizeMoney);
    console.log(`[CalculateWinners] Prize distribution:`, prizeDistribution);

    // Get all participants for this challenge
    const participantsSnapshot = await db.collection('user-challenge')
      .where('challengeId', '==', challengeId)
      .get();

    if (participantsSnapshot.empty) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          error: 'No participants found for this challenge'
        })
      };
    }

    const participants = [];
    for (const doc of participantsSnapshot.docs) {
      const participantData = doc.data();
      participants.push({
        userId: participantData.userId,
        username: participantData.username,
        userChallengeId: doc.id,
        score: participantData.pulsePoints?.totalPoints || 0
      });
    }

    console.log(`[CalculateWinners] Found ${participants.length} participants`);

    // Sort participants by score descending
    participants.sort((a, b) => b.score - a.score);

    // Calculate winners based on prize distribution
    const winners = [];
    const numWinners = Math.min(prizeDistribution.length, participants.length);

    for (let i = 0; i < numWinners; i++) {
      const participant = participants[i];
      const prizeAmount = prizeDistribution[i];
      
      if (prizeAmount > 0) {
        winners.push({
          userId: participant.userId,
          username: participant.username,
          userChallengeId: participant.userChallengeId,
          placement: i + 1,
          score: participant.score,
          prizeAmount: prizeAmount // Amount in cents
        });
      }
    }

    console.log(`[CalculateWinners] Winners:`, winners);

    // Create prize records and update winners
    const batch = db.batch();
    const prizeRecords = [];

    for (const winner of winners) {
      // Create prize record
      const prizeRecordId = `${challengeId}_${winner.userId}_${Date.now()}`;
      const prizeRecord = {
        id: prizeRecordId,
        challengeId: challengeId,
        challengeTitle: challengeData.title,
        userId: winner.userId,
        username: winner.username,
        placement: winner.placement,
        score: winner.score,
        prizeAmount: winner.prizeAmount,
        status: 'pending', // pending, processing, paid, failed
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      const prizeRef = db.collection('prizeRecords').doc(prizeRecordId);
      batch.set(prizeRef, prizeRecord);
      prizeRecords.push(prizeRecord);

      // Update user's winner field
      const userRef = db.collection('users').doc(winner.userId);
      batch.update(userRef, {
        'winner.challengeWins': admin.firestore.FieldValue.arrayUnion({
          challengeId: challengeId,
          challengeTitle: challengeData.title,
          placement: winner.placement,
          prizeAmount: winner.prizeAmount,
          status: 'pending',
          awardedAt: admin.firestore.FieldValue.serverTimestamp()
        }),
        'winner.totalEarnings': admin.firestore.FieldValue.increment(winner.prizeAmount),
        'winner.updatedAt': admin.firestore.FieldValue.serverTimestamp()
      });

      console.log(`[CalculateWinners] Created prize record for ${winner.username}: $${winner.prizeAmount / 100}`);
    }

    // Update challenge with winner information
    const challengeRef = db.collection('challenges').doc(challengeId);
    batch.update(challengeRef, {
      'prizeMoney.winnersCalculated': true,
      'prizeMoney.calculatedAt': admin.firestore.FieldValue.serverTimestamp(),
      'prizeMoney.winners': winners.map(w => ({
        userId: w.userId,
        username: w.username,
        placement: w.placement,
        prizeAmount: w.prizeAmount
      })),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Commit all changes
    await batch.commit();
    console.log(`[CalculateWinners] Successfully created ${winners.length} prize records`);

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        winners: winners,
        totalPrizeAmount: prizeMoney.totalAmount,
        prizeRecords: prizeRecords
      })
    };

  } catch (error) {
    console.error('[CalculateWinners] Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error.message
      })
    };
  }
};

// Helper function to calculate prize distribution
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