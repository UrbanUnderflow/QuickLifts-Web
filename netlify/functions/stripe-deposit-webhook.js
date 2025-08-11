const admin = require('firebase-admin');
const functions = require('firebase-functions');

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      type: "service_account",
      project_id: "quicklifts-dd3f1",
      private_key_id: process.env.FIREBASE_PRIVATE_KEY,
      private_key: process.env.FIREBASE_SECRET_KEY.replace(/\\n/g, '\n'),
      client_email: "firebase-adminsdk-1qxb0@quicklifts-dd3f1.iam.gserviceaccount.com",
      client_id: "111494077667496751062",
      auth_uri: "https://accounts.google.com/o/oauth2/auth",
      token_uri: "https://oauth2.googleapis.com/token",
      auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
      client_x509_cert_url: "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-1qxb0%40quicklifts-dd3f1.iam.gserviceaccount.com"
    }),
  });
}

const db = admin.firestore();

// Initialize Stripe
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
};

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const sig = event.headers['stripe-signature'];
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let stripeEvent;

    try {
      stripeEvent = stripe.webhooks.constructEvent(event.body, sig, endpointSecret);
    } catch (err) {
      console.error('[StripeDepositWebhook] Webhook signature verification failed:', err.message);
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Webhook signature verification failed' })
      };
    }

    console.log(`[StripeDepositWebhook] Received event: ${stripeEvent.type}`);

    // Handle successful payment intent (like round purchases)
    if (stripeEvent.type === 'payment_intent.succeeded') {
      const paymentIntent = stripeEvent.data.object;
      
      // Check if this is a prize deposit
      if (paymentIntent.metadata.type === 'prize_deposit') {
        console.log(`[StripeDepositWebhook] Processing prize deposit: ${paymentIntent.id}`);
        
        const {
          challengeId,
          challengeTitle,
          depositedBy,
          depositorName,
          depositorEmail,
          // New partial deposit fields
          fullPrizeAmount,
          existingEscrowAmount,
          amountToDeposit,
          platformFee,
          totalChargeAmount,
          existingEscrowRecordId,
          // Legacy fields for backward compatibility
          prizeAmount,
          totalAmount
        } = paymentIntent.metadata;

        // Parse amounts from metadata (handle both new and legacy formats)
        const fullPrizeAmountCents = parseInt(fullPrizeAmount || prizeAmount) || paymentIntent.amount;
        const existingEscrowAmountCents = parseInt(existingEscrowAmount) || 0;
        const amountToDepositCents = parseInt(amountToDeposit || prizeAmount) || paymentIntent.amount;
        const platformFeeCents = parseInt(platformFee) || 0;
        const totalChargeAmountCents = parseInt(totalChargeAmount || totalAmount) || paymentIntent.amount;
        const isPartialDeposit = existingEscrowAmountCents > 0;

        console.log(`[StripeDepositWebhook] Processing ${isPartialDeposit ? 'partial' : 'full'} deposit:`, {
          fullPrizeAmount: fullPrizeAmountCents,
          existingEscrowAmount: existingEscrowAmountCents,
          amountToDeposit: amountToDepositCents,
          platformFee: platformFeeCents,
          totalCharged: totalChargeAmountCents,
          paymentIntentAmount: paymentIntent.amount,
          isPartialDeposit: isPartialDeposit,
          existingEscrowRecordId: existingEscrowRecordId
        });

        let escrowRecordId;
        let existingEscrowDoc = null;

          if (isPartialDeposit && existingEscrowRecordId) {
          // Update existing escrow record
          console.log(`[StripeDepositWebhook] Updating existing escrow record: ${existingEscrowRecordId}`);
          
          const escrowRef = db.collection('prize-escrow').doc(existingEscrowRecordId);
          existingEscrowDoc = await escrowRef.get();
          
          if (existingEscrowDoc.exists) {
            const existingData = existingEscrowDoc.data();
            const newTotalAmount = existingData.amount + amountToDepositCents;
            const newTotalCharged = (existingData.totalAmountCharged || 0) + totalChargeAmountCents;
            
            await escrowRef.update({
              amount: newTotalAmount, // Combined amount held in escrow
              totalAmountCharged: newTotalCharged, // Combined amount charged to host
              updatedAt: new Date(),
              additionalDeposits: admin.firestore.FieldValue.arrayUnion({
                paymentIntentId: paymentIntent.id,
                stripeChargeId: paymentIntent.latest_charge,
                amountAdded: amountToDepositCents,
                platformFeeCharged: platformFeeCents,
                totalChargedForThis: totalChargeAmountCents,
                depositedAt: new Date()
              })
            });
            
            escrowRecordId = existingEscrowRecordId;
            console.log(`[StripeDepositWebhook] Updated escrow record ${escrowRecordId} - new total: $${newTotalAmount/100}`);
          } else {
            throw new Error(`Existing escrow record ${existingEscrowRecordId} not found`);
          }
          } else {
          // Create new escrow record
          const escrowData = {
            challengeId,
            challengeTitle,
            amount: fullPrizeAmountCents, // Full prize amount (what winners get)
            totalAmountCharged: totalChargeAmountCents, // Total amount charged to host so far
            currency: paymentIntent.currency,
            status: 'held',
            paymentIntentId: paymentIntent.id,
            stripeChargeId: paymentIntent.latest_charge,
            depositedBy,
            depositorName,
            depositorEmail,
              prizeAssignmentId: assignmentIdMeta || null,
            createdAt: new Date(),
            updatedAt: new Date(),
            metadata: {
              fullPrizeAmount: fullPrizeAmountCents,
              platformFee: platformFeeCents,
              totalAmountCharged: totalChargeAmountCents,
              fees: {
                stripeFee: Math.round(totalChargeAmountCents * 0.029 + 30), // Estimated Stripe fee on total
                platformFee: platformFeeCents // Platform fee paid by host
              },
              paymentMethod: paymentIntent.payment_method,
              paymentIntent: true,
              feeStructure: 'host_pays_platform_fee'
            }
          };

          const escrowRef = await db.collection('prize-escrow').add(escrowData);
          escrowRecordId = escrowRef.id;
          console.log(`[StripeDepositWebhook] Created new escrow record: ${escrowRecordId}`);
        }

        // Update challenge funding status (if challenge exists in main collection)
        try {
          const challengeDoc = await db.collection('challenges').doc(challengeId).get();
          if (challengeDoc.exists) {
            await db.collection('challenges').doc(challengeId).update({
              fundingStatus: 'funded',
              fundingDetails: {
                prizeAmount: fullPrizeAmountCents, // Full prize amount available to winners
                totalAmountCharged: isPartialDeposit ? 
                  (existingEscrowDoc.data().totalAmountCharged || 0) + totalChargeAmountCents : 
                  totalChargeAmountCents, // Total charged to host
                platformFee: platformFeeCents, // Platform fee for this deposit
                escrowRecordId: escrowRecordId,
                fundedAt: new Date(),
                fundedBy: depositedBy
              },
              updatedAt: new Date()
            });
            console.log(`[StripeDepositWebhook] Updated challenge ${challengeId} funding status`);
          }
        } catch (updateError) {
          console.error(`[StripeDepositWebhook] Failed to update challenge ${challengeId}:`, updateError);
          // Don't fail the webhook for this
        }

        // Update prize assignment status
        try {
          // Prefer direct assignmentId when provided to avoid updating older versions
          let prizeDoc = null;
          const assignmentIdMeta = paymentIntent.metadata?.prizeAssignmentId;
          if (assignmentIdMeta) {
            const direct = await db.collection('challenge-prizes').doc(assignmentIdMeta).get();
            if (direct.exists) prizeDoc = direct;
          }
          if (!prizeDoc) {
            const querySnap = await db.collection('challenge-prizes')
              .where('challengeId', '==', challengeId)
              .orderBy('createdAt', 'desc')
              .limit(1)
              .get();
            if (!querySnap.empty) prizeDoc = querySnap.docs[0];
          }
            
          if (prizeDoc) {
            await prizeDoc.ref.update({
              fundingStatus: 'funded',
              depositedAmount: fullPrizeAmountCents, // Full prize amount (what winners get)
              totalAmountCharged: isPartialDeposit && existingEscrowDoc ? 
                (existingEscrowDoc.data().totalAmountCharged || 0) + totalChargeAmountCents : 
                totalChargeAmountCents, // Total charged to host
              platformFeeCollected: platformFeeCents, // Platform fee for this deposit
              escrowRecordId: escrowRecordId,
              depositedAt: new Date(),
              depositedBy,
              updatedAt: new Date()
            });
            console.log(`[StripeDepositWebhook] Updated prize assignment funding status`);
          }
        } catch (prizeUpdateError) {
          console.error(`[StripeDepositWebhook] Failed to update prize assignment:`, prizeUpdateError);
        }

        console.log(`[StripeDepositWebhook] Successfully processed prize deposit for challenge ${challengeId}`);
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ received: true })
    };

  } catch (error) {
    console.error('[StripeDepositWebhook] Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};