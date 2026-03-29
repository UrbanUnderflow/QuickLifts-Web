const { admin } = require('./config/firebase');

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
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({})
    };
  }

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
    const { paymentIntentId, testCard } = JSON.parse(event.body);

    console.log(`[ConfirmTestPayment] Confirming payment intent: ${paymentIntentId}`);

    if (!paymentIntentId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Missing paymentIntentId'
        })
      };
    }

    // Create a test payment method (Stripe test card)
    const paymentMethod = await stripe.paymentMethods.create({
      type: 'card',
      card: {
        number: '4242424242424242',
        exp_month: 12,
        exp_year: 2030,
        cvc: '123',
      },
      billing_details: {
        name: 'Test Depositor',
        email: 'test@fitwithpulse.ai'
      }
    });

    console.log(`[ConfirmTestPayment] Created test payment method: ${paymentMethod.id}`);

    // Confirm the payment intent with the test payment method
    const confirmedPayment = await stripe.paymentIntents.confirm(paymentIntentId, {
      payment_method: paymentMethod.id,
      return_url: 'http://localhost:8888/admin/assign-prize-money?test_success=true'
    });

    console.log(`[ConfirmTestPayment] Payment confirmed: ${confirmedPayment.status}`);

    if (confirmedPayment.status === 'succeeded') {
      // Payment succeeded, trigger our webhook logic manually
      const escrowData = {
        challengeId: confirmedPayment.metadata.challengeId,
        challengeTitle: confirmedPayment.metadata.challengeTitle,
        amount: confirmedPayment.amount,
        currency: confirmedPayment.currency,
        status: 'held',
        paymentIntentId: confirmedPayment.id,
        stripeChargeId: confirmedPayment.latest_charge,
        depositedBy: confirmedPayment.metadata.depositedBy,
        depositorName: confirmedPayment.metadata.depositorName,
        depositorEmail: confirmedPayment.metadata.depositorEmail,
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: {
          originalAmount: confirmedPayment.amount,
          fees: {
            stripeFee: Math.round(confirmedPayment.amount * 0.029 + 30),
            platformFee: 0
          },
          paymentMethod: paymentMethod.id,
          testPayment: true
        }
      };

      const escrowRef = await db.collection('prize-escrow').add(escrowData);
      console.log(`[ConfirmTestPayment] Created escrow record: ${escrowRef.id}`);

      // Update prize assignment funding status
      const challengeId = confirmedPayment.metadata.challengeId;
      const prizeQuery = await db.collection('challenge-prizes')
        .where('challengeId', '==', challengeId)
        .limit(1)
        .get();
        
      if (!prizeQuery.empty) {
        const prizeDoc = prizeQuery.docs[0];
        await prizeDoc.ref.update({
          fundingStatus: 'funded',
          depositedAmount: confirmedPayment.amount,
          escrowRecordId: escrowRef.id,
          depositedAt: new Date(),
          depositedBy: confirmedPayment.metadata.depositedBy,
          updatedAt: new Date()
        });
        console.log(`[ConfirmTestPayment] Updated prize assignment funding status`);
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          paymentIntentId: confirmedPayment.id,
          escrowRecordId: escrowRef.id,
          amount: confirmedPayment.amount,
          status: confirmedPayment.status
        })
      };
    } else {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: `Payment failed with status: ${confirmedPayment.status}`
        })
      };
    }

  } catch (error) {
    console.error('[ConfirmTestPayment] Error:', error);
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
