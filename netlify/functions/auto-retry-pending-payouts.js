const admin = require('firebase-admin');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const db = admin.firestore();

exports.handler = async (event, context) => {
  console.log('[AutoRetryPendingPayouts] Starting automated retry check...');
  
  try {
    // Check current Stripe balance
    const balance = await stripe.balance.retrieve();
    const usdAvailable = balance.available.find(b => b.currency === 'usd')?.amount || 0;
    const usdPending = balance.pending.find(b => b.currency === 'usd')?.amount || 0;
    
    console.log(`[AutoRetryPendingPayouts] Current balance - Available: $${usdAvailable/100}, Pending: $${usdPending/100}`);
    
    // If no available funds, skip retry
    if (usdAvailable === 0) {
      console.log('[AutoRetryPendingPayouts] No available funds, skipping retry');
      return {
        statusCode: 200,
        body: JSON.stringify({ 
          success: true, 
          message: 'No available funds for retry',
          availableUSD: usdAvailable / 100
        })
      };
    }
    
    // Find all prize assignments that are confirmed but not yet distributed
    const challengePrizesSnapshot = await db.collection('challenge-prizes')
      .where('hostConfirmed', '==', true)
      .where('distributionStatus', 'in', ['pending', 'failed'])
      .get();
    
    console.log(`[AutoRetryPendingPayouts] Found ${challengePrizesSnapshot.size} confirmed but undistributed prize assignments`);
    
    const retryResults = [];
    
    for (const prizeDoc of challengePrizesSnapshot.docs) {
      const prizeData = prizeDoc.data();
      const prizeId = prizeDoc.id;
      
      console.log(`[AutoRetryPendingPayouts] Checking prize assignment: ${prizeId} (${prizeData.challengeTitle})`);
      
      // Check if this prize has pending_funds prize records that need retry
      const pendingRecordsSnapshot = await db.collection('prizeRecords')
        .where('prizeId', '==', prizeId)
        .where('status', '==', 'pending_funds')
        .get();
      
      if (pendingRecordsSnapshot.empty) {
        console.log(`[AutoRetryPendingPayouts] No pending_funds records for prize ${prizeId}, skipping`);
        continue;
      }
      
      // Calculate total amount needed for this prize
      let totalNeeded = 0;
      const recordsToRetry = [];
      
      for (const recordDoc of pendingRecordsSnapshot.docs) {
        const record = recordDoc.data();
        totalNeeded += Math.round(record.prizeAmount * 100); // Convert to cents
        recordsToRetry.push({ id: recordDoc.id, ...record });
      }
      
      console.log(`[AutoRetryPendingPayouts] Prize ${prizeId} needs $${totalNeeded/100} for ${recordsToRetry.length} failed records`);
      
      // Check if we have enough available balance for this entire prize
      if (usdAvailable < totalNeeded) {
        console.log(`[AutoRetryPendingPayouts] Insufficient funds for prize ${prizeId}. Need: $${totalNeeded/100}, Available: $${usdAvailable/100}`);
        continue;
      }
      
      // Retry payouts for this prize
      let successCount = 0;
      let failCount = 0;
      
      for (const record of recordsToRetry) {
        try {
          console.log(`[AutoRetryPendingPayouts] Retrying payout for record ${record.id} (${record.username})`);
          
          // Call the payout-prize-money function directly (internal call)
          const payoutFunction = require('./payout-prize-money');
          const payoutEvent = {
            body: JSON.stringify({
              prizeRecordId: record.id,
              isRetry: true
            }),
            headers: { 'Content-Type': 'application/json' }
          };
          
          const payoutResponse = await payoutFunction.handler(payoutEvent, context);
          const payoutResult = JSON.parse(payoutResponse.body);
          
          if (payoutResult.success) {
            successCount++;
            console.log(`[AutoRetryPendingPayouts] ✅ Successfully retried payout for ${record.username}`);
          } else {
            failCount++;
            console.log(`[AutoRetryPendingPayouts] ❌ Retry failed for ${record.username}: ${payoutResult.error}`);
          }
          
        } catch (error) {
          failCount++;
          console.error(`[AutoRetryPendingPayouts] Error retrying payout for ${record.username}:`, error.message);
        }
      }
      
      retryResults.push({
        prizeId,
        challengeTitle: prizeData.challengeTitle,
        totalRecords: recordsToRetry.length,
        successCount,
        failCount
      });
      
      // Update prize assignment status if all payouts succeeded
      if (successCount === recordsToRetry.length && failCount === 0) {
        await db.collection('challenge-prizes').doc(prizeId).update({
          distributionStatus: 'distributed',
          autoRetryCompletedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log(`[AutoRetryPendingPayouts] ✅ Updated prize ${prizeId} status to 'distributed'`);
      }
    }
    
    // Log summary to Firestore for tracking
    if (retryResults.length > 0) {
      await db.collection('systemLogs').add({
        type: 'auto_retry_payouts',
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        balanceChecked: {
          availableUSD: usdAvailable / 100,
          pendingUSD: usdPending / 100
        },
        retryResults,
        summary: {
          prizesProcessed: retryResults.length,
          totalSuccesses: retryResults.reduce((sum, r) => sum + r.successCount, 0),
          totalFailures: retryResults.reduce((sum, r) => sum + r.failCount, 0)
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
        message: 'Auto-retry completed',
        balanceChecked: {
          availableUSD: usdAvailable / 100,
          pendingUSD: usdPending / 100
        },
        retryResults,
        summary: {
          prizesProcessed: retryResults.length,
          totalSuccesses: retryResults.reduce((sum, r) => sum + r.successCount, 0),
          totalFailures: retryResults.reduce((sum, r) => sum + r.failCount, 0)
        }
      })
    };
    
  } catch (error) {
    console.error('[AutoRetryPendingPayouts] Error:', error);
    
    // Log error to Firestore
    await db.collection('errorLogs').add({
      source: 'auto-retry-pending-payouts',
      error: error.message,
      stack: error.stack,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
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
