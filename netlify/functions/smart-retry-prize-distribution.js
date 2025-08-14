const { db, headers } = require('./config/firebase');
const Stripe = require('stripe');
let stripe;
try {
  if (process.env.STRIPE_SECRET_KEY) {
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  }
} catch (e) {
  console.error('[SmartRetryPrizeDistribution] Failed to init Stripe:', e);
}

exports.handler = async (event, context) => {
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
  console.log('[SmartRetryPrizeDistribution] Starting smart retry check...');
  
  try {
    // Check current Stripe balance
    const balance = await stripe.balance.retrieve();
    const usdAvailable = balance.available.find(b => b.currency === 'usd')?.amount || 0;
    
    console.log(`[SmartRetryPrizeDistribution] Current available balance: $${usdAvailable/100}`);
    
    // If no available funds, skip retry
    if (usdAvailable === 0) {
      console.log('[SmartRetryPrizeDistribution] No available funds, skipping retry');
      return {
        statusCode: 200,
        body: JSON.stringify({ 
          success: true, 
          message: 'No available funds for retry',
          availableUSD: usdAvailable / 100
        })
      };
    }
    
    // Find all prize assignments that failed distribution and need retry
    const challengePrizesSnapshot = await db.collection('challenge-prizes')
      .where('hostConfirmed', '==', true)
      .where('distributionStatus', 'in', ['failed', 'partially_distributed'])
      .get();
    
    console.log(`[SmartRetryPrizeDistribution] Found ${challengePrizesSnapshot.size} failed prize distributions`);
    
    const retryResults = [];
    
    for (const prizeDoc of challengePrizesSnapshot.docs) {
      const prizeData = prizeDoc.data();
      const prizeId = prizeDoc.id;
      
      console.log(`[SmartRetryPrizeDistribution] Checking prize assignment: ${prizeId} (${prizeData.challengeTitle})`);
      
      // Check if this prize has failed records that need retry
      const failedRecordsSnapshot = await db.collection('prizeRecords')
        .where('prizeId', '==', prizeId)
        .where('status', 'in', ['failed', 'pending_funds'])
        .get();
      
      if (failedRecordsSnapshot.empty) {
        console.log(`[SmartRetryPrizeDistribution] No failed records for prize ${prizeId}, skipping`);
        continue;
      }
      
      // Calculate total amount needed for this prize
      let totalNeeded = 0;
      const recordsToRetry = [];
      
      for (const recordDoc of failedRecordsSnapshot.docs) {
        const record = recordDoc.data();
        totalNeeded += record.prizeAmount; // Already in cents
        recordsToRetry.push({ id: recordDoc.id, ...record });
      }
      
      console.log(`[SmartRetryPrizeDistribution] Prize ${prizeId} needs $${totalNeeded/100} for ${recordsToRetry.length} failed records`);
      
      // Check if we have enough available balance for this entire prize
      if (usdAvailable < totalNeeded) {
        console.log(`[SmartRetryPrizeDistribution] Insufficient funds for prize ${prizeId}. Need: $${totalNeeded/100}, Available: $${usdAvailable/100}`);
        continue;
      }
      
      // Sufficient funds available - send retry email to host
      try {
        console.log(`[SmartRetryPrizeDistribution] Sufficient funds available for ${prizeData.challengeTitle}. Sending retry email...`);
        
        // Call the send-host-validation-email function with retry flag
        const emailFunction = require('./send-host-validation-email');
        const emailEvent = {
          body: JSON.stringify({
            prizeAssignmentId: prizeId,
            isRetryAttempt: true
          }),
          headers: { 'Content-Type': 'application/json' }
        };
        
        const emailResponse = await emailFunction.handler(emailEvent, context);
        const emailResult = JSON.parse(emailResponse.body);
        
        if (emailResult.success) {
          console.log(`[SmartRetryPrizeDistribution] ✅ Retry email sent successfully for ${prizeData.challengeTitle}`);
          
          // Update prize assignment to track retry attempt
          await db.collection('challenge-prizes').doc(prizeId).update({
            lastRetryEmailSent: new Date(),
            retryEmailCount: db.FieldValue.increment(1),
            distributionStatus: 'retry_email_sent'
          });
          
          retryResults.push({
            prizeId,
            challengeTitle: prizeData.challengeTitle,
            action: 'retry_email_sent',
            totalNeeded: totalNeeded / 100,
            success: true
          });
          
        } else {
          console.log(`[SmartRetryPrizeDistribution] ❌ Failed to send retry email for ${prizeData.challengeTitle}: ${emailResult.error}`);
          retryResults.push({
            prizeId,
            challengeTitle: prizeData.challengeTitle,
            action: 'retry_email_failed',
            error: emailResult.error,
            success: false
          });
        }
        
      } catch (error) {
        console.error(`[SmartRetryPrizeDistribution] Error sending retry email for ${prizeData.challengeTitle}:`, error.message);
        retryResults.push({
          prizeId,
          challengeTitle: prizeData.challengeTitle,
          action: 'retry_email_error',
          error: error.message,
          success: false
        });
      }
    }
    
    // Log summary to Firestore for tracking
    if (retryResults.length > 0) {
      await db.collection('systemLogs').add({
        type: 'smart_retry_prize_distribution',
        timestamp: new Date(),
        balanceChecked: {
          availableUSD: usdAvailable / 100
        },
        retryResults,
        summary: {
          prizesProcessed: retryResults.length,
          totalSuccesses: retryResults.filter(r => r.success).length,
          totalFailures: retryResults.filter(r => !r.success).length,
          totalAmountAvailable: usdAvailable / 100
        }
      });
    }
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        success: true,
        message: 'Smart retry completed',
        balanceChecked: {
          availableUSD: usdAvailable / 100
        },
        retryResults,
        summary: {
          prizesProcessed: retryResults.length,
          totalSuccesses: retryResults.filter(r => r.success).length,
          totalFailures: retryResults.filter(r => !r.success).length
        }
      })
    };
    
  } catch (error) {
    console.error('[SmartRetryPrizeDistribution] Error:', error);
    
    // Log error to Firestore
    await db.collection('errorLogs').add({
      source: 'smart-retry-prize-distribution',
      error: error.message,
      stack: error.stack,
      timestamp: new Date()
    });
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        success: false,
        error: error.message
      })
    };
  }
};
