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

    // Update prize record to processing
    await db.collection("prizeRecords").doc(prizeRecordId).update({
      status: 'processing',
      processingStartedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Create transfer to winner's connected account
    const transferAmount = prizeRecord.prizeAmount; // Amount in cents
    const platformFee = Math.round(transferAmount * 0.03); // 3% platform fee
    const winnerAmount = transferAmount - platformFee;

    console.log(`[PayoutPrizeMoney] Transfer breakdown:`, {
      totalPrize: transferAmount,
      platformFee: platformFee,
      winnerAmount: winnerAmount
    });

    try {
      // Create Stripe transfer for prize money
      const transfer = await stripe.transfers.create({
          amount: winnerAmount, // Amount after platform fee
          currency: 'usd',
          destination: winnerStripeAccountId,
          description: `Prize money for challenge: ${prizeRecord.challengeTitle}`,
          metadata: {
              platform: 'pulse',
              challenge_id: prizeRecord.challengeId,
              prize_record_id: prizeRecordId,
              winner_user_id: prizeRecord.userId,
              winner_placement: prizeRecord.placement,
              original_amount: prizeRecord.prizeAmount,
              platform_fee: platformFee,
              payment_type: 'prize_money',
              tax_classification: 'prize_income' // For 1099-MISC box 3
          }
      });

      console.log(`[PayoutPrizeMoney] Transfer created: ${transfer.id}`);

      // Update prize record with success
      const batch = db.batch();
      
      const prizeRef = db.collection("prizeRecords").doc(prizeRecordId);
      batch.update(prizeRef, {
        status: 'paid',
        stripeTransferId: transfer.id,
        winnerAmount: winnerAmount,
        platformFee: platformFee,
        paidAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
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

      console.log(`[PayoutPrizeMoney] Successfully paid $${winnerAmount / 100} to ${prizeRecord.username}`);

      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          transferId: transfer.id,
          winnerAmount: winnerAmount,
          platformFee: platformFee,
          recipient: prizeRecord.username,
          challengeTitle: prizeRecord.challengeTitle
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