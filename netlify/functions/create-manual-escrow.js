// Temporary function to manually create escrow record for testing

const { db, headers } = require('./config/firebase');

const handler = async (event) => {
  console.log(`[CreateManualEscrow] Received ${event.httpMethod} request`);

  // Only accept POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Method not allowed'
      })
    };
  }

  try {
    const { challengeId, challengeTitle, prizeAmount, depositedBy } = JSON.parse(event.body);

    // Create escrow record manually (same structure as webhook)
    const escrowData = {
      challengeId,
      challengeTitle: challengeTitle || 'Morning Mobility Challenge',
      amount: prizeAmount * 100, // Convert to cents
      totalAmountCharged: Math.round((prizeAmount * 100) * 1.035) + 50, // With our fee structure
      currency: 'usd',
      status: 'held',
      paymentIntentId: 'manual_' + Date.now(),
      stripeChargeId: 'manual_charge_' + Date.now(),
      depositedBy: depositedBy || 'manual_admin',
      depositorName: 'Manual Test',
      depositorEmail: 'tre@fitwithpulse.ai',
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: {
        prizeAmount: prizeAmount * 100,
        platformFee: Math.round((prizeAmount * 100) * 0.035) + 50,
        totalAmountCharged: Math.round((prizeAmount * 100) * 1.035) + 50,
        fees: {
          stripeFee: Math.round(((prizeAmount * 100) * 1.035 + 50) * 0.029 + 30),
          platformFee: Math.round((prizeAmount * 100) * 0.035) + 50
        },
        paymentMethod: 'manual_test',
        paymentIntent: true,
        feeStructure: 'host_pays_platform_fee',
        manuallyCreated: true
      }
    };

    const escrowRef = await db.collection('prize-escrow').add(escrowData);
    console.log(`[CreateManualEscrow] Created escrow record: ${escrowRef.id}`);

    // Update challenge funding status
    try {
      const challengeDoc = await db.collection('challenges').doc(challengeId).get();
      if (challengeDoc.exists) {
        await db.collection('challenges').doc(challengeId).update({
          fundingStatus: 'funded',
          fundingDetails: {
            prizeAmount: prizeAmount * 100,
            totalAmountCharged: Math.round((prizeAmount * 100) * 1.035) + 50,
            platformFee: Math.round((prizeAmount * 100) * 0.035) + 50,
            escrowRecordId: escrowRef.id,
            fundedAt: new Date(),
            fundedBy: depositedBy || 'manual_admin'
          },
          updatedAt: new Date()
        });
        console.log(`[CreateManualEscrow] Updated challenge ${challengeId} funding status`);
      }
    } catch (updateError) {
      console.error(`[CreateManualEscrow] Failed to update challenge ${challengeId}:`, updateError);
    }

    // Update prize assignment status
    try {
      const prizeQuery = await db.collection('challenge-prizes')
        .where('challengeId', '==', challengeId)
        .limit(1)
        .get();
        
      if (!prizeQuery.empty) {
        const prizeDoc = prizeQuery.docs[0];
        await prizeDoc.ref.update({
          fundingStatus: 'funded',
          depositedAmount: prizeAmount * 100,
          totalAmountCharged: Math.round((prizeAmount * 100) * 1.035) + 50,
          platformFeeCollected: Math.round((prizeAmount * 100) * 0.035) + 50,
          escrowRecordId: escrowRef.id,
          depositedAt: new Date(),
          depositedBy: depositedBy || 'manual_admin',
          updatedAt: new Date()
        });
        console.log(`[CreateManualEscrow] Updated prize assignment funding status`);
      }
    } catch (prizeUpdateError) {
      console.error(`[CreateManualEscrow] Failed to update prize assignment:`, prizeUpdateError);
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        escrowRecordId: escrowRef.id,
        message: 'Manual escrow record created successfully'
      })
    };

  } catch (error) {
    console.error('[CreateManualEscrow] Error:', error);
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