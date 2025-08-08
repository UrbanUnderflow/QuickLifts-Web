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

    // Only short-circuit as "already confirmed" when distribution reached a terminal state
    if (prizeData.hostConfirmed && ['distributed', 'partially_distributed'].includes(prizeData.distributionStatus)) {
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

    // Mark as host confirmed (idempotent) and move into processing state
    await db.collection('challenge-prizes').doc(prizeId).update({
      hostConfirmed: true,
      hostConfirmedAt: prizeData.hostConfirmedAt || new Date(),
      distributionStatus: 'processing',
      updatedAt: new Date()
    });

    console.log(`[ConfirmPrizeDistribution] Host confirmed prize ${prizeId}`);

    // Use stored winner data from email instead of re-determining
    console.log('[ConfirmPrizeDistribution] Checking for stored winner data...');
    
    let winners = [];
    if (prizeData.winnerDataSnapshot && prizeData.winnerDataSnapshot.length > 0) {
      console.log('[ConfirmPrizeDistribution] Using stored winner data:', prizeData.winnerDataSnapshot);
      
      // Convert stored winner data to the format expected by distributePrizes
      winners = prizeData.winnerDataSnapshot.map((winner, index) => {
        // Calculate prize amount based on structure
        const prizeAmount = calculatePrizeForRank(index + 1, prizeData.prizeAmount, prizeData.prizeStructure);
        return {
          userId: winner.userId,
          username: winner.username,
          rank: winner.rank,
          score: winner.score,
          prizeAmount: prizeAmount,
          percentage: (prizeAmount / prizeData.prizeAmount) * 100,
          userChallengeId: `${prizeData.challengeId}_${winner.userId}` // Construct if needed
        };
      }).filter(winner => winner.prizeAmount > 0); // Only include winners with prize money
      
      console.log('[ConfirmPrizeDistribution] Processed winners:', winners);
    } else {
      console.log('[ConfirmPrizeDistribution] No stored winner data, falling back to live determination...');
      // Fallback to original method if no stored data
      winners = await determineWinners(prizeData.challengeId, prizeData.distributionPlan);
    }
    
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

    // If nothing succeeded, keep link actionable and do not claim completion
    const anySuccess = distributionResults.some(r => r.success);
    if (!anySuccess) {
      await db.collection('challenge-prizes').doc(prizeId).update({
        distributionStatus: 'failed',
        distributionResults,
        updatedAt: new Date()
      });
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'text/html' },
        body: generateErrorPage(
          'Transfer Failed',
          'We could not complete any prize transfers. Please fix the highlighted issues (e.g., missing Stripe setup) and re-open this link to retry.'
        )
      };
    }

    // Send winner notification emails
    try {
      console.log(`[ConfirmPrizeDistribution] Sending winner notification emails...`);
      
      const winnerNotificationPayload = {
        winners: winners.map(winner => ({
          userId: winner.userId,
          username: winner.username,
          rank: winner.rank,
          prizeAmount: Math.round(winner.prizeAmount * 100) // Convert to cents
        })),
        challengeTitle: prizeData.challengeTitle,
        challengeId: prizeData.challengeId
      };

      // Call the winner notification function
      const notificationResponse = await fetch(`https://fitwithpulse.ai/.netlify/functions/send-winner-notification-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(winnerNotificationPayload)
      });

      if (notificationResponse.ok) {
        const notificationData = await notificationResponse.json();
        console.log(`[ConfirmPrizeDistribution] Winner notifications sent: ${notificationData.emailsSent}/${notificationData.totalWinners}`);
      } else {
        console.error(`[ConfirmPrizeDistribution] Failed to send winner notifications:`, notificationResponse.status);
      }
    } catch (error) {
      console.error(`[ConfirmPrizeDistribution] Error sending winner notifications:`, error);
      // Don't fail the whole process if email sending fails
    }

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
        `Successfully distributed prizes to ${distributionResults.filter(r => r.success).length} winner(s). Winner notification emails have been sent.`,
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

      // First, verify the winner has a valid Stripe Connect account
      const userDoc = await db.collection('users').doc(winner.userId).get();
      if (!userDoc.exists) {
        throw new Error(`User ${winner.userId} not found`);
      }

      const userData = userDoc.data();
      const winnerStripeAccountId = userData.winner?.stripeAccountId;

      if (!winnerStripeAccountId) {
        throw new Error(`User ${winner.userId} does not have a connected Stripe account`);
      }

      // Validate that the Stripe account email matches the user's Pulse email
      try {
        const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
        const stripeAccount = await stripe.accounts.retrieve(winnerStripeAccountId);
        
        if (stripeAccount.email && stripeAccount.email !== userData.email) {
          console.warn(`[DistributePrizes] Email mismatch for user ${winner.userId}: Stripe(${stripeAccount.email}) vs Pulse(${userData.email})`);
          throw new Error(`Email mismatch: Stripe account email (${stripeAccount.email}) does not match Pulse profile email (${userData.email}). Please update your Stripe account to use the same email.`);
        }

        // Check if the account is properly set up for payouts
        if (!stripeAccount.payouts_enabled) {
          throw new Error(`Stripe account ${winnerStripeAccountId} is not enabled for payouts. Please complete your account setup.`);
        }

      } catch (stripeError) {
        console.error(`[DistributePrizes] Stripe account validation failed for ${winner.userId}:`, stripeError.message);
        throw new Error(`Invalid Stripe account: ${stripeError.message}`);
      }

      // Create a prize record in the prizeRecords collection (matching the payout-prize-money function expectation)
      const prizeRecord = {
        challengeId: prizeData.challengeId,
        challengeTitle: prizeData.challengeTitle,
        userId: winner.userId,
        username: winner.username,
        placement: winner.rank,
        score: winner.score,
        prizeAmount: Math.round(winner.prizeAmount * 100), // Convert to cents for consistency
        status: 'pending', // Will be processed by payout function
        createdAt: new Date(),
        updatedAt: new Date(),
        // Additional metadata
        prizeAssignmentId: prizeId,
        distributionPercentage: winner.percentage,
        distributionType: prizeData.prizeStructure,
        userChallengeId: winner.userChallengeId
      };

      // Save to prizeRecords collection (matching what payout-prize-money expects)
      const prizeRecordRef = await db.collection('prizeRecords').add(prizeRecord);
      console.log(`[DistributePrizes] Created prize record ${prizeRecordRef.id} for user ${winner.userId}`);

      // Now actually transfer the money using the payout function
      try {
        const payoutResponse = await fetch(`https://fitwithpulse.ai/.netlify/functions/payout-prize-money`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prizeRecordId: prizeRecordRef.id,
            challengeId: prizeData.challengeId
          })
        });

        const payoutData = await payoutResponse.json();
        
        if (!payoutResponse.ok || !payoutData.success) {
          throw new Error(payoutData.error || `Payout failed with status ${payoutResponse.status}`);
        }

        console.log(`[DistributePrizes] Successfully paid out $${winner.prizeAmount} to ${winner.userId} via transfer ${payoutData.transferId}`);

        results.push({
          userId: winner.userId,
          username: winner.username,
          rank: winner.rank,
          prizeAmount: winner.prizeAmount,
          prizeRecordId: prizeRecordRef.id,
          transferId: payoutData.transferId,
          success: true,
          message: 'Prize transferred successfully',
          stripeAccountId: winnerStripeAccountId
        });

      } catch (payoutError) {
        console.error(`[DistributePrizes] Payout failed for ${winner.userId}:`, payoutError.message);
        
        // Update the prize record to reflect the failure
        await db.collection('prizeRecords').doc(prizeRecordRef.id).update({
          status: 'failed',
          failureReason: payoutError.message,
          updatedAt: new Date()
        });

        results.push({
          userId: winner.userId,
          username: winner.username,
          rank: winner.rank,
          prizeAmount: winner.prizeAmount,
          prizeRecordId: prizeRecordRef.id,
          success: false,
          error: `Payout failed: ${payoutError.message}`,
          stripeAccountId: winnerStripeAccountId
        });
      }

    } catch (error) {
      console.error(`[DistributePrizes] Error processing prize for user ${winner.userId}:`, error);
      results.push({
        userId: winner.userId,
        username: winner.username || 'Unknown',
        rank: winner.rank,
        prizeAmount: winner.prizeAmount,
        success: false,
        error: error.message
      });
    }
  }

  return results;
}

// Helper function to calculate prize amount for a specific rank
function calculatePrizeForRank(rank, totalPrizeAmount, prizeStructure) {
  console.log(`[CalculatePrizeForRank] Rank: ${rank}, Total: ${totalPrizeAmount}, Structure: ${prizeStructure}`);
  
  switch (prizeStructure) {
    case 'winner_takes_all':
      return rank === 1 ? totalPrizeAmount : 0;
    
    case 'top_three_split':
      if (rank === 1) return totalPrizeAmount * 0.60; // 60%
      if (rank === 2) return totalPrizeAmount * 0.25; // 25%
      if (rank === 3) return totalPrizeAmount * 0.15; // 15%
      return 0;
    
    case 'top_five_split':
      if (rank === 1) return totalPrizeAmount * 0.40; // 40%
      if (rank === 2) return totalPrizeAmount * 0.25; // 25%
      if (rank === 3) return totalPrizeAmount * 0.20; // 20%
      if (rank === 4) return totalPrizeAmount * 0.10; // 10%
      if (rank === 5) return totalPrizeAmount * 0.05; // 5%
      return 0;
    
    default:
      // For custom or unknown structures, winner takes all
      return rank === 1 ? totalPrizeAmount : 0;
  }
}

// Helper function to generate secure token (same as in email sender)
function generateSecureToken(prizeAssignmentId) {
  const crypto = require('crypto');
  const secret = process.env.JWT_SECRET || 'fallback-secret-key';
  return crypto
    .createHmac('sha256', secret)
    .update(prizeAssignmentId)
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