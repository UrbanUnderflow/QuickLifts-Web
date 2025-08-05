// Function to handle host confirmation and distribute prizes to winners
const { db, headers } = require('./config/firebase');

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

  // Accept both GET and POST requests
  if (!['GET', 'POST'].includes(event.httpMethod)) {
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
        headers: {
          'Content-Type': 'text/html'
        },
        body: generateErrorPage('Service Unavailable', 'The prize distribution service is currently unavailable. Please try again later.')
      };
    }

    // Get parameters from query string
    const prizeId = event.queryStringParameters?.prizeId;
    const token = event.queryStringParameters?.token;

    console.log('[ConfirmPrizeDistribution] Processing confirmation:', {
      prizeId,
      token: token ? token.substring(0, 8) + '...' : 'missing'
    });

    if (!prizeId || !token) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'text/html'
        },
        body: generateErrorPage('Invalid Request', 'Missing required parameters. Please use the link from your email.')
      };
    }

    // Get the prize assignment
    const prizeDoc = await db.collection('challenge-prizes').doc(prizeId).get();
    if (!prizeDoc.exists) {
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'text/html'
        },
        body: generateErrorPage('Prize Not Found', 'The prize assignment could not be found. It may have been deleted or expired.')
      };
    }

    const prizeData = prizeDoc.data();

    // Verify the token
    const expectedToken = generateSecureToken(prizeId);
    if (token !== prizeData.confirmationToken && token !== expectedToken) {
      return {
        statusCode: 403,
        headers: {
          'Content-Type': 'text/html'
        },
        body: generateErrorPage('Invalid Token', 'The confirmation link is invalid or has expired. Please request a new confirmation email.')
      };
    }

    // Check if confirmation has expired
    const now = new Date();
    const expiresAt = prizeData.confirmationExpires?.toDate?.() || new Date(prizeData.confirmationExpires);
    if (expiresAt && now > expiresAt) {
      return {
        statusCode: 410,
        headers: {
          'Content-Type': 'text/html'
        },
        body: generateErrorPage('Link Expired', 'This confirmation link has expired. Please contact support for assistance.')
      };
    }

    // Check if already confirmed
    if (prizeData.hostConfirmed) {
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'text/html'
        },
        body: generateSuccessPage(
          'Already Confirmed',
          'This prize distribution has already been confirmed and processed.',
          prizeData,
          true // already processed
        )
      };
    }

    // Mark as host confirmed
    await db.collection('challenge-prizes').doc(prizeId).update({
      hostConfirmed: true,
      hostConfirmedAt: new Date(),
      distributionStatus: 'processing',
      updatedAt: new Date()
    });

    console.log(`[ConfirmPrizeDistribution] Host confirmed prize ${prizeId}`);

    // Get challenge participants and determine winners
    const winners = await determineWinners(prizeData.challengeId, prizeData.distributionPlan);
    
    if (winners.length === 0) {
      // No winners found, update status
      await db.collection('challenge-prizes').doc(prizeId).update({
        distributionStatus: 'failed',
        distributionError: 'No winners found for this challenge',
        updatedAt: new Date()
      });

      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'text/html'
        },
        body: generateErrorPage(
          'No Winners Found',
          'No eligible winners were found for this challenge. Please check the challenge results and try again.'
        )
      };
    }

    // Distribute prizes to winners
    const distributionResults = await distributePrizes(prizeId, winners, prizeData);

    // Update final status
    const allSuccessful = distributionResults.every(result => result.success);
    await db.collection('challenge-prizes').doc(prizeId).update({
      distributionStatus: allSuccessful ? 'distributed' : 'partially_distributed',
      distributionResults: distributionResults,
      distributionCompletedAt: new Date(),
      updatedAt: new Date()
    });

    console.log(`[ConfirmPrizeDistribution] Prize distribution completed for ${prizeId}:`, {
      totalWinners: winners.length,
      successful: distributionResults.filter(r => r.success).length,
      failed: distributionResults.filter(r => !r.success).length
    });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/html'
      },
      body: generateSuccessPage(
        'Prize Distribution Confirmed!',
        `Successfully distributed prizes to ${distributionResults.filter(r => r.success).length} winner(s).`,
        prizeData,
        false,
        distributionResults
      )
    };

  } catch (error) {
    console.error('[ConfirmPrizeDistribution] Error:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'text/html'
      },
      body: generateErrorPage('Server Error', 'An unexpected error occurred while processing your confirmation. Please try again or contact support.')
    };
  }
};

// Helper function to determine winners based on challenge results
async function determineWinners(challengeId, distributionPlan) {
  try {
    console.log(`[DetermineWinners] Finding winners for challenge ${challengeId}`);

    // Get all participants for this challenge
    const participantsSnapshot = await db.collection('user-challenge')
      .where('challengeId', '==', challengeId)
      .get();

    if (participantsSnapshot.empty) {
      console.log(`[DetermineWinners] No participants found for challenge ${challengeId}`);
      return [];
    }

    // Extract participants with scores
    const participants = participantsSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        userId: data.userId,
        challengeId: data.challengeId,
        score: data.totalScore || data.score || 0,
        isComplete: data.isComplete || false,
        completedAt: data.completedAt,
        updatedAt: data.updatedAt
      };
    });

    // Filter to only completed challenges and sort by score (highest first)
    const completedParticipants = participants
      .filter(p => p.isComplete)
      .sort((a, b) => b.score - a.score);

    console.log(`[DetermineWinners] Found ${completedParticipants.length} completed participants`);

    if (completedParticipants.length === 0) {
      return [];
    }

    // Assign ranks and match with distribution plan
    const winners = [];
    for (let i = 0; i < completedParticipants.length && i < distributionPlan.length; i++) {
      const participant = completedParticipants[i];
      const distributionInfo = distributionPlan[i];

      if (distributionInfo.amount > 0) {
        winners.push({
          userId: participant.userId,
          rank: distributionInfo.rank,
          score: participant.score,
          prizeAmount: distributionInfo.amount,
          percentage: distributionInfo.percentage,
          userChallengeId: participant.id
        });
      }
    }

    console.log(`[DetermineWinners] Determined ${winners.length} winners:`, winners.map(w => ({
      userId: w.userId,
      rank: w.rank,
      score: w.score,
      prizeAmount: w.prizeAmount
    })));

    return winners;

  } catch (error) {
    console.error('[DetermineWinners] Error determining winners:', error);
    return [];
  }
}

// Helper function to distribute prizes to winners
async function distributePrizes(prizeId, winners, prizeData) {
  const results = [];

  for (const winner of winners) {
    try {
      console.log(`[DistributePrizes] Processing prize for user ${winner.userId}: $${winner.prizeAmount}`);

      // Create a prize record in the winners collection (similar to existing system)
      const prizeRecord = {
        challengeId: prizeData.challengeId,
        challengeTitle: prizeData.challengeTitle,
        userId: winner.userId,
        placement: winner.rank,
        score: winner.score,
        prizeAmount: Math.round(winner.prizeAmount * 100), // Convert to cents for consistency
        status: 'pending', // Will be processed by existing winner payout system
        createdAt: new Date(),
        updatedAt: new Date(),
        // Additional metadata
        prizeAssignmentId: prizeId,
        distributionPercentage: winner.percentage,
        distributionType: prizeData.prizeStructure,
        userChallengeId: winner.userChallengeId
      };

      // Save to winners collection (or whatever collection you use for prize records)
      const prizeRecordRef = await db.collection('challenge-prize-winners').add(prizeRecord);

      console.log(`[DistributePrizes] Created prize record ${prizeRecordRef.id} for user ${winner.userId}`);

      results.push({
        userId: winner.userId,
        rank: winner.rank,
        prizeAmount: winner.prizeAmount,
        prizeRecordId: prizeRecordRef.id,
        success: true,
        message: 'Prize record created successfully'
      });

    } catch (error) {
      console.error(`[DistributePrizes] Error processing prize for user ${winner.userId}:`, error);
      results.push({
        userId: winner.userId,
        rank: winner.rank,
        prizeAmount: winner.prizeAmount,
        success: false,
        error: error.message
      });
    }
  }

  return results;
}

// Helper function to generate secure token (same as in email sender)
function generateSecureToken(prizeAssignmentId) {
  const crypto = require('crypto');
  const secret = process.env.JWT_SECRET || 'fallback-secret-key';
  return crypto
    .createHmac('sha256', secret)
    .update(prizeAssignmentId + Date.now())
    .digest('hex')
    .substring(0, 32);
}

// Helper functions to generate HTML pages
function generateSuccessPage(title, message, prizeData, alreadyProcessed = false, distributionResults = []) {
  const resultsHtml = distributionResults.length > 0 ? `
    <div style="background: #f8f9fa; border-radius: 8px; padding: 20px; margin: 20px 0;">
      <h3 style="color: #1a1a1a; margin: 0 0 15px 0;">Distribution Results:</h3>
      ${distributionResults.map((result, index) => `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #e0e0e0;">
          <span>Rank ${result.rank}: User ${result.userId}</span>
          <span style="color: ${result.success ? '#4caf50' : '#f44336'};">
            ${result.success ? `$${result.prizeAmount.toFixed(2)} ✓` : 'Failed ✗'}
          </span>
        </div>
      `).join('')}
    </div>
  ` : '';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${title} - Pulse</title>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #4caf50 0%, #45a049 100%); color: white; padding: 40px 30px; text-align: center; }
        .content { padding: 40px 30px; }
        .challenge-info { background: #f8f9fa; border-radius: 8px; padding: 20px; margin: 20px 0; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin: 0; font-size: 28px;">🎉 ${title}</h1>
          <p style="margin: 10px 0 0 0; opacity: 0.9;">${message}</p>
        </div>
        <div class="content">
          <div class="challenge-info">
            <h3 style="margin: 0 0 15px 0; color: #1a1a1a;">Challenge Details</h3>
            <p style="margin: 5px 0;"><strong>Challenge:</strong> ${prizeData.challengeTitle}</p>
            <p style="margin: 5px 0;"><strong>Prize Pool:</strong> $${prizeData.prizeAmount.toFixed(2)}</p>
            <p style="margin: 5px 0;"><strong>Structure:</strong> ${prizeData.prizeStructure}</p>
          </div>
          ${resultsHtml}
          ${alreadyProcessed ? 
            '<p style="color: #666;">This confirmation was processed earlier. No further action is needed.</p>' :
            '<p style="color: #4caf50; font-weight: 500;">✅ Prize distribution has been confirmed and processed successfully!</p>'
          }
          <p style="margin-top: 30px;">The winners will be notified automatically and can view their prizes in their unified earnings dashboard.</p>
        </div>
        <div class="footer">
          <p>Pulse Prize Distribution System</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

function generateErrorPage(title, message) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${title} - Pulse</title>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #f44336 0%, #d32f2f 100%); color: white; padding: 40px 30px; text-align: center; }
        .content { padding: 40px 30px; text-align: center; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin: 0; font-size: 28px;">⚠️ ${title}</h1>
        </div>
        <div class="content">
          <p style="font-size: 16px; line-height: 1.6; color: #333;">${message}</p>
          <p style="margin-top: 30px; color: #666;">If you continue to experience issues, please contact support at tre@fitwithpulse.ai</p>
        </div>
        <div class="footer">
          <p>Pulse Prize Distribution System</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

module.exports = { handler }; 