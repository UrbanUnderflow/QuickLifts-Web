// Auto-repair function for failed deposit webhooks
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
        'Access-Control-Allow-Methods': 'GET, OPTIONS'
      },
      body: ''
    };
  }

  // Only accept GET requests
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ success: false, error: 'Method not allowed' })
    };
  }

  try {
    console.log('[AutoRepairDeposits] Starting auto-repair scan...');

    // Get all prize assignments that should be funded but aren't
    const assignmentsSnapshot = await db.collection('challenge-prizes').get();
    const repairResults = [];

    // Get recent successful payment intents from Stripe (last 24 hours)
    const oneDayAgo = Math.floor((Date.now() - 24 * 60 * 60 * 1000) / 1000);
    const paymentIntents = await stripe.paymentIntents.list({
      created: { gte: oneDayAgo },
      limit: 100
    });

    const successfulPayments = paymentIntents.data.filter(pi => 
      pi.status === 'succeeded' && 
      pi.metadata.payment_type === 'escrow_deposit' &&
      pi.metadata.prizeAssignmentId
    );

    console.log(`[AutoRepairDeposits] Found ${successfulPayments.length} successful deposit payments in last 24h`);

    for (const doc of assignmentsSnapshot.docs) {
      const assignmentData = doc.data();
      const assignmentId = doc.id;

      // Check if assignment needs repair (no depositedBy/depositedAt but should be funded)
      if (!assignmentData.depositedBy || !assignmentData.depositedAt) {
        // Look for a successful payment intent for this assignment
        const matchingPayment = successfulPayments.find(pi => 
          pi.metadata.prizeAssignmentId === assignmentId
        );

        if (matchingPayment) {
          console.log(`[AutoRepairDeposits] Found orphaned payment for assignment ${assignmentId}: ${matchingPayment.id}`);

          // Check if escrow record already exists for this assignment
          const existingEscrowQuery = await db.collection('prize-escrow')
            .where('prizeAssignmentId', '==', assignmentId)
            .limit(1)
            .get();

          if (existingEscrowQuery.empty) {
            // Repair this assignment
            const metadata = matchingPayment.metadata;
            const totalAmountCharged = matchingPayment.amount; // in cents
            const prizeAmount = parseInt(metadata.fullPrizeAmount) || (assignmentData.prizeAmount * 100);
            const platformFeeCollected = totalAmountCharged - prizeAmount;

            // Create escrow record
            const escrowData = {
              challengeId: assignmentData.challengeId,
              challengeTitle: assignmentData.challengeTitle || 'Unknown Challenge',
              amount: prizeAmount, // in cents
              totalAmountCharged: totalAmountCharged,
              currency: matchingPayment.currency,
              status: 'held',
              paymentIntentId: matchingPayment.id,
              stripeChargeId: matchingPayment.latest_charge || `charge_${matchingPayment.id}`,
              depositedBy: metadata.depositorEmail || metadata.depositorName || 'admin',
              depositorName: metadata.depositorName || 'Admin',
              depositorEmail: metadata.depositorEmail || '',
              createdAt: new Date(matchingPayment.created * 1000),
              prizeAssignmentId: assignmentId,
              metadata: {
                prizeAmount: prizeAmount,
                platformFee: platformFeeCollected,
                totalAmountCharged: totalAmountCharged,
                fees: {
                  stripeFee: Math.round(totalAmountCharged * 0.029) + 30, // Estimate
                  platformFee: platformFeeCollected
                },
                paymentMethod: matchingPayment.payment_method_types?.[0] || 'card',
                paymentIntent: true,
                feeStructure: 'host_pays_platform_fee',
                autoRepaired: true,
                repairedAt: new Date()
              }
            };

            // Save escrow record
            const escrowRef = await db.collection('prize-escrow').add(escrowData);
            const escrowRecordId = escrowRef.id;

            // Update prize assignment
            await doc.ref.update({
              fundingStatus: 'funded',
              depositedAmount: prizeAmount,
              totalAmountCharged: totalAmountCharged,
              platformFeeCollected: platformFeeCollected,
              escrowRecordId: escrowRecordId,
              depositedAt: new Date(matchingPayment.created * 1000),
              depositedBy: metadata.depositorEmail || metadata.depositorName || 'admin',
              updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });

            repairResults.push({
              assignmentId,
              paymentIntentId: matchingPayment.id,
              escrowRecordId,
              status: 'repaired',
              prizeAmount: prizeAmount / 100,
              totalCharged: totalAmountCharged / 100
            });

            console.log(`[AutoRepairDeposits] Auto-repaired assignment ${assignmentId}`);
          } else {
            console.log(`[AutoRepairDeposits] Assignment ${assignmentId} already has escrow record, skipping`);
          }
        }
      }
    }

    console.log(`[AutoRepairDeposits] Auto-repair complete. Repaired ${repairResults.length} assignments`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: `Auto-repair completed. Repaired ${repairResults.length} assignments`,
        repaired: repairResults,
        scannedPayments: successfulPayments.length
      })
    };

  } catch (error) {
    console.error('[AutoRepairDeposits] Error:', error);
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
