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

    // Check if already paid
    if (prizeRecord.status === 'paid') {
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          error: 'Prize already paid'
        })
      };
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
      // Create Stripe transfer for prize money (from escrow)
      const transfer = await stripe.transfers.create({
          amount: winnerAmount, // Full amount (no platform fee for prizes)
          currency: 'usd',
          destination: winnerStripeAccountId,
          description: `Prize money from escrow: ${prizeRecord.challengeTitle}`,
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
      });

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

      // PHASE 2: Update escrow record to mark funds as distributed
      const escrowRef = db.collection('prize-escrow').doc(escrowRecord.id);
      batch.update(escrowRef, {
        status: 'distributed',
        distributedAmount: (escrowData.distributedAmount || 0) + winnerAmount,
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

      batch.update(userRef, {
        'winner.challengeWins': updatedWins,
        'winner.updatedAt': admin.firestore.FieldValue.serverTimestamp()
      });

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

      // Update prize record with failure
      await db.collection("prizeRecords").doc(prizeRecordId).update({
        status: 'failed',
        failureReason: stripeError.message,
        stripeErrorCode: stripeError.code,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      return {
        statusCode: 500,
        body: JSON.stringify({
          success: false,
          error: `Transfer failed: ${stripeError.message}`
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