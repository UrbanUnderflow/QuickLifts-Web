// Manual repair function for failed deposit webhooks
const { db, admin, headers } = require('./config/firebase');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

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
    const { paymentIntentId, assignmentId } = JSON.parse(event.body);

    if (!paymentIntentId || !assignmentId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          success: false, 
          error: 'paymentIntentId and assignmentId are required' 
        })
      };
    }

    console.log(`[ManualDepositRepair] Repairing failed deposit for assignment ${assignmentId}, payment ${paymentIntentId}`);

    // Get the payment intent from Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status !== 'succeeded') {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          success: false, 
          error: `Payment intent status is ${paymentIntent.status}, not succeeded` 
        })
      };
    }

    // Get assignment data
    const assignmentDoc = await db.collection('challenge-prizes').doc(assignmentId).get();
    if (!assignmentDoc.exists) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ 
          success: false, 
          error: 'Assignment not found' 
        })
      };
    }

    const assignmentData = assignmentDoc.data();
    
    // Extract data from payment intent
    const metadata = paymentIntent.metadata;
    const totalAmountCharged = paymentIntent.amount; // in cents
    const prizeAmount = parseInt(metadata.fullPrizeAmount) || (assignmentData.prizeAmount * 100);
    const platformFeeCollected = totalAmountCharged - prizeAmount;

    // Create escrow record
    const escrowData = {
      challengeId: assignmentData.challengeId,
      challengeTitle: assignmentData.challengeTitle || 'Unknown Challenge',
      amount: prizeAmount, // in cents
      totalAmountCharged: totalAmountCharged,
      currency: paymentIntent.currency,
      status: 'held',
      paymentIntentId: paymentIntent.id,
      stripeChargeId: paymentIntent.latest_charge || `charge_${paymentIntent.id}`,
      depositedBy: metadata.depositorEmail || metadata.depositorName || 'admin',
      depositorName: metadata.depositorName || 'Admin',
      depositorEmail: metadata.depositorEmail || '',
      createdAt: new Date(paymentIntent.created * 1000),
      prizeAssignmentId: assignmentId,
      metadata: {
        prizeAmount: prizeAmount,
        platformFee: platformFeeCollected,
        totalAmountCharged: totalAmountCharged,
        fees: {
          stripeFee: Math.round(totalAmountCharged * 0.029) + 30, // Estimate
          platformFee: platformFeeCollected
        },
        paymentMethod: paymentIntent.payment_method_types?.[0] || 'card',
        paymentIntent: true,
        feeStructure: 'host_pays_platform_fee',
        manuallyRepaired: true,
        repairedAt: new Date()
      }
    };

    // Save escrow record
    const escrowRef = await db.collection('prize-escrow').add(escrowData);
    const escrowRecordId = escrowRef.id;

    console.log(`[ManualDepositRepair] Created escrow record: ${escrowRecordId}`);

    // Update prize assignment
    await assignmentDoc.ref.update({
      fundingStatus: 'funded',
      depositedAmount: prizeAmount,
      totalAmountCharged: totalAmountCharged,
      platformFeeCollected: platformFeeCollected,
      escrowRecordId: escrowRecordId,
      depositedAt: new Date(paymentIntent.created * 1000),
      depositedBy: metadata.depositorEmail || metadata.depositorName || 'admin',
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log(`[ManualDepositRepair] Updated assignment ${assignmentId} with funding info`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Deposit manually repaired successfully',
        details: {
          assignmentId,
          escrowRecordId,
          prizeAmount: prizeAmount / 100,
          totalCharged: totalAmountCharged / 100,
          platformFee: platformFeeCollected / 100
        }
      })
    };

  } catch (error) {
    console.error('[ManualDepositRepair] Error:', error);
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
