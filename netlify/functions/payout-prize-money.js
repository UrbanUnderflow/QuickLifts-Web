// Function to payout prize money to winners' Stripe Connect accounts

const Stripe = require('stripe');
const { db, admin } = require('./config/firebase');

// Initialize Stripe with your secret key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const handler = async (event) => {
  console.log(`[PayoutPrizeMoney] Received ${event.httpMethod} request`);

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
    const { prizeRecordId, challengeId } = JSON.parse(event.body);
    console.log(`[PayoutPrizeMoney] Processing payout for prize record ${prizeRecordId}`);

    if (!prizeRecordId) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          error: 'Missing prizeRecordId'
        })
      };
    }

    // Get prize record
    const prizeRecordDoc = await db.collection("prizeRecords").doc(prizeRecordId).get();
    if (!prizeRecordDoc.exists) {
      return {
        statusCode: 404,
        body: JSON.stringify({
          success: false,
          error: 'Prize record not found'
        })
      };
    }

    const prizeRecord = prizeRecordDoc.data();
    console.log(`[PayoutPrizeMoney] Prize record: ${prizeRecord.username} - $${prizeRecord.prizeAmount / 100}`);

    // If already paid AND we have a transferId, verify it on Stripe, else allow retry (idempotent)
    if (prizeRecord.status === 'paid' && prizeRecord.stripeTransferId) {
      try {
        const existing = await stripe.transfers.retrieve(prizeRecord.stripeTransferId);
        if (existing && existing.status === 'paid') {
          return {
            statusCode: 200,
            body: JSON.stringify({ success: true, transferId: existing.id, message: 'Already paid' })
          };
        }
      } catch (e) {
        console.warn('[PayoutPrizeMoney] Could not verify existing transfer, will reattempt with idempotency:', e.message);
      }
    }

    // Get user document to check Stripe account
    const userDoc = await db.collection("users").doc(prizeRecord.userId).get();
    if (!userDoc.exists) {
      return {
        statusCode: 404,
        body: JSON.stringify({
          success: false,
          error: 'User not found'
        })
      };
    }

    const userData = userDoc.data();
    const winnerStripeAccountId = userData.winner?.stripeAccountId;

    if (!winnerStripeAccountId) {
      // Update prize record status to indicate missing account
      await db.collection("prizeRecords").doc(prizeRecordId).update({
        status: 'failed',
        failureReason: 'No Stripe account found for winner',
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          error: 'Winner has not set up payment account'
        })
      };
    }

    console.log(`[PayoutPrizeMoney] Winner Stripe account: ${winnerStripeAccountId}`);

    // PHASE 2: Verify escrow funds are available for this challenge
    const escrowQuery = await db.collection('prize-escrow')
      .where('challengeId', '==', prizeRecord.challengeId || challengeId)
      .where('status', '==', 'held')
      .limit(1)
      .get();

    if (escrowQuery.empty) {
      await db.collection("prizeRecords").doc(prizeRecordId).update({
        status: 'failed',
        failureReason: 'No escrow funds found for this challenge',
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          error: 'No escrow funds available for this challenge'
        })
      };
    }

    const escrowRecord = escrowQuery.docs[0];
    const escrowData = escrowRecord.data();
    
    console.log(`[PayoutPrizeMoney] Found escrow record: ${escrowRecord.id}, amount: $${escrowData.amount / 100}`);

    // Update prize record to processing
    await db.collection("prizeRecords").doc(prizeRecordId).update({
      status: 'processing',
      processingStartedAt: admin.firestore.FieldValue.serverTimestamp(),
      escrowRecordId: escrowRecord.id, // Link to escrow record
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // For prize money: NO platform fee (Phase 2 requirement)
    const transferAmount = prizeRecord.prizeAmount; // Amount in cents
    const platformFee = 0; // NO FEE for prize money
    const winnerAmount = transferAmount; // Winner gets full amount

    console.log(`[PayoutPrizeMoney] Prize transfer breakdown:`, {
      totalPrize: transferAmount,
      platformFee: platformFee,
      winnerAmount: winnerAmount,
      type: 'prize_money_escrow'
    });

    try {
      // Check platform balance before attempting transfer
      try {
        const balance = await stripe.balance.retrieve();
        console.log(`[PayoutPrizeMoney] Current Stripe balance:`, balance.available, balance.pending);
        
        const usdAvailable = balance.available.find(b => b.currency === 'usd')?.amount || 0;
        const usdPending = balance.pending.find(b => b.currency === 'usd')?.amount || 0;
        
        console.log(`[PayoutPrizeMoney] USD available: $${usdAvailable/100}, pending: $${usdPending/100}, transfer needed: $${winnerAmount/100}`);
        
        if (usdAvailable < winnerAmount) {
          console.warn(`[PayoutPrizeMoney] Insufficient available balance! Available: $${usdAvailable/100}, needed: $${winnerAmount/100}`);
        }
      } catch (balanceError) {
        console.error('[PayoutPrizeMoney] Could not retrieve balance:', balanceError.message);
      }

      // Create Stripe transfer for prize money (from escrow) with robust idempotency strategy
      const baseIdempotencyKey = `${prizeRecordId}:${winnerStripeAccountId}:${winnerAmount}:${escrowRecord.id}`;

      async function createTransferWithKey(key) {
        console.log(`[PayoutPrizeMoney] Creating transfer with idempotency key: ${key}`);
        return await stripe.transfers.create({
          amount: winnerAmount, // Full amount (no platform fee for prizes)
          currency: 'usd',
          destination: winnerStripeAccountId,
          description: `Prize money from escrow: ${prizeRecord.challengeTitle}`,
          source_type: 'card', // Use available balance from card payments
          metadata: {
            platform: 'pulse',
            challenge_id: prizeRecord.challengeId,
            prize_record_id: prizeRecordId,
            winner_user_id: prizeRecord.userId,
            winner_placement: prizeRecord.placement,
            original_amount: prizeRecord.prizeAmount,
            platform_fee: platformFee, // 0 for prizes
            payment_type: 'prize_money_escrow',
            escrow_record_id: escrowRecord.id,
            transfer_source: 'platform_escrow',
            tax_classification: 'prize_income' // For 1099-MISC box 3
          }
        }, { idempotencyKey: key });
      }

      let transfer;
      try {
        transfer = await createTransferWithKey(baseIdempotencyKey);
      } catch (e) {
        // If Stripe complains about idempotency due to previous params, retry once with a new suffix
        const isIdempotencyError = e?.type === 'StripeIdempotencyError' || e?.code === 'idempotency_error';
        if (isIdempotencyError) {
          console.warn('[PayoutPrizeMoney] Idempotency error, retrying with new key…');
          const retryKey = `${baseIdempotencyKey}:r${Date.now()}`;
          transfer = await createTransferWithKey(retryKey);
        } else {
          throw e;
        }
      }

      console.log(`[PayoutPrizeMoney] Transfer created: ${transfer.id}`);

      // Update records with success
      const batch = db.batch();
      
      // Update prize record
      const prizeRef = db.collection("prizeRecords").doc(prizeRecordId);
      batch.update(prizeRef, {
        status: 'paid',
        stripeTransferId: transfer.id,
        winnerAmount: winnerAmount,
        platformFee: platformFee, // 0 for prizes
        paidAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        escrowRecordId: escrowRecord.id
      });

      // Update escrow record status based on remaining funds
      const escrowRef = db.collection('prize-escrow').doc(escrowRecord.id);
      const newDistributedAmount = (escrowData.distributedAmount || 0) + winnerAmount;
      const remaining = Math.max((escrowData.amount || 0) - newDistributedAmount, 0);
      const newStatus = remaining > 0 ? 'held' : 'distributed';
      batch.update(escrowRef, {
        status: newStatus,
        distributedAmount: newDistributedAmount,
        distributedTo: admin.firestore.FieldValue.arrayUnion({
          userId: prizeRecord.userId,
          amount: winnerAmount,
          transferId: transfer.id,
          distributedAt: new Date()
        }),
        updatedAt: new Date()
      });

      // Update user's winner field
      const userRef = db.collection("users").doc(prizeRecord.userId);
      
      // Find and update the specific challenge win in the array
      const challengeWins = userData.winner?.challengeWins || [];
      const updatedWins = challengeWins.map(win => {
        if (win.challengeId === prizeRecord.challengeId && win.placement === prizeRecord.placement) {
          return {
            ...win,
            status: 'paid',
            paidAt: admin.firestore.FieldValue.serverTimestamp(),
            stripeTransferId: transfer.id,
            winnerAmount: winnerAmount,
            platformFee: platformFee
          };
        }
        return win;
      });

      // Use set with merge to handle null winner objects
      batch.set(userRef, {
        winner: {
          challengeWins: updatedWins,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }
      }, { merge: true });

      // Commit all updates
      await batch.commit();

      console.log(`[PayoutPrizeMoney] Successfully paid $${winnerAmount / 100} from escrow to ${prizeRecord.username}`);

      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          transferId: transfer.id,
          winnerAmount: winnerAmount,
          platformFee: platformFee, // 0 for prizes
          recipient: prizeRecord.username,
          challengeTitle: prizeRecord.challengeTitle,
          escrowRecordId: escrowRecord.id,
          transferType: 'prize_money_escrow',
          message: 'Prize money transferred from escrow successfully'
        })
      };

    } catch (stripeError) {
      console.error('[PayoutPrizeMoney] Stripe transfer error:', stripeError);

      // Determine if this is an insufficient funds error
      const isInsufficientFunds = stripeError?.message?.includes('insufficient funds');
      
      // Enhanced error message for insufficient funds
      let enhancedErrorMessage = stripeError?.message || 'Stripe transfer error';
      if (isInsufficientFunds) {
        enhancedErrorMessage = `Insufficient funds in platform Stripe account. The deposited prize money likely hasn't cleared yet. This payout will be automatically retried once funds are available. Current error: ${stripeError.message}`;
      }

      // Build Firestore-safe update object (no undefined fields)
      const failureUpdate = {
        status: isInsufficientFunds ? 'pending_funds' : 'failed',
        failureReason: enhancedErrorMessage,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };
      
      // Add auto-retry flag for insufficient funds
      if (isInsufficientFunds) {
        failureUpdate.autoRetryEligible = true;
        failureUpdate.nextRetryAfter = admin.firestore.FieldValue.serverTimestamp();
        console.log(`[PayoutPrizeMoney] Marked record ${prizeRecordId} as pending_funds for auto-retry`);
      }
      if (stripeError && typeof stripeError.code !== 'undefined' && stripeError.code !== null) {
        failureUpdate.stripeErrorCode = stripeError.code;
      }
      if (stripeError && typeof stripeError.decline_code !== 'undefined' && stripeError.decline_code !== null) {
        failureUpdate.stripeDeclineCode = stripeError.decline_code;
      }
      if (stripeError && typeof stripeError.type !== 'undefined' && stripeError.type !== null) {
        failureUpdate.stripeErrorType = stripeError.type;
      }

      // Update prize record with sanitized failure fields
      await db.collection("prizeRecords").doc(prizeRecordId).update(failureUpdate);

      // Also log to errorLogs for admin visibility (non-blocking)
      try {
        await db.collection('errorLogs').doc(`${new Date().toISOString()}-payout-${prizeRecordId}`).set({
          username: prizeRecord.username || 'unknown',
          userId: prizeRecord.userId,
          errorMessage: `[PayoutPrizeMoney] ${failureUpdate.failureReason}`,
          createdAt: new Date().toISOString(),
          context: {
            source: 'payout-prize-money',
            prizeRecordId,
            challengeId: prizeRecord.challengeId,
            prizeAmountCents: prizeRecord.prizeAmount,
            stripeAccountId: winnerStripeAccountId || null,
            errorCode: failureUpdate.stripeErrorCode || null,
            declineCode: failureUpdate.stripeDeclineCode || null,
            errorType: failureUpdate.stripeErrorType || null
          }
        }, { merge: true });
      } catch (e) {
        console.warn('[PayoutPrizeMoney] Failed to write error log:', e.message);
      }

      return {
        statusCode: 500,
        body: JSON.stringify({
          success: false,
          error: `Transfer failed: ${failureUpdate.failureReason}`
        })
      };
    }

  } catch (error) {
    console.error('[PayoutPrizeMoney] Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error.message
      })
    };
  }
};

module.exports = { handler }; 