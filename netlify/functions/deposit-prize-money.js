// Function to handle prize money deposits into Pulse escrow account

const Stripe = require('stripe');
const { db, admin, headers } = require('./config/firebase');

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const handler = async (event) => {
  console.log(`[DepositPrizeMoney] Received ${event.httpMethod} request`);

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
      body: JSON.stringify({
        success: false,
        error: 'Method not allowed'
      })
    };
  }

  try {
    const { 
      challengeId, 
      prizeAmount, // in cents
      paymentMethodId,
      depositedBy, // userId
      hostStripeCustomerId, // optional - for saved payment methods
      depositorName,
      depositorEmail
    } = JSON.parse(event.body);

    console.log(`[DepositPrizeMoney] Processing deposit for challenge ${challengeId}: $${prizeAmount / 100}`);

    // Validation
    if (!challengeId || !prizeAmount || !paymentMethodId || !depositedBy) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Missing required fields: challengeId, prizeAmount, paymentMethodId, depositedBy'
        })
      };
    }

    if (prizeAmount < 100) { // Minimum $1
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Minimum prize amount is $1.00'
        })
      };
    }

    // Get challenge to verify it exists and check current funding status
    console.log(`[DepositPrizeMoney] Looking for challenge: ${challengeId}`);
    const challengeDoc = await db.collection('challenges').doc(challengeId).get();
    
    if (!challengeDoc.exists) {
      console.error(`[DepositPrizeMoney] Challenge ${challengeId} not found in challenges collection`);
      
      // Try to get challenge info from prize assignment instead
      console.log(`[DepositPrizeMoney] Attempting to find challenge info from prize assignments...`);
      const prizeQuery = await db.collection('challenge-prizes')
        .where('challengeId', '==', challengeId)
        .limit(1)
        .get();
      
      if (!prizeQuery.empty) {
        const prizeDoc = prizeQuery.docs[0];
        const prizeData = prizeDoc.data();
        console.log(`[DepositPrizeMoney] Found prize assignment with challenge title: ${prizeData.challengeTitle}`);
        
        // Create a mock challenge object for the deposit process
        var challengeData = {
          title: prizeData.challengeTitle,
          id: challengeId
        };
      } else {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({
            success: false,
            error: `Challenge not found: ${challengeId}. Check that the challenge exists and the ID is correct.`,
            debug: {
              searchedChallengeId: challengeId,
              searchedInCollection: 'challenges'
            }
          })
        };
      }
    } else {
      var challengeData = challengeDoc.data();
    }

    console.log(`[DepositPrizeMoney] Challenge: ${challengeData.title}`);

    // Check if challenge already has funding (skip for mock challenges)
    if (challengeData.prizeMoney?.fundingStatus === 'funded') {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Challenge prize pool is already funded'
        })
      };
    }

    // Get user making the deposit
    const userDoc = await db.collection('users').doc(depositedBy).get();
    if (!userDoc.exists) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'User not found'
        })
      };
    }

    const userData = userDoc.data();
    console.log(`[DepositPrizeMoney] Deposit by: ${userData.username}`);

    // Handle live test card creation
    let actualPaymentMethodId = paymentMethodId;
    if (paymentMethodId === 'live_test_card') {
      console.log(`[DepositPrizeMoney] Creating live test payment method...`);
      
      try {
        // Create payment method with test card details
        const paymentMethod = await stripe.paymentMethods.create({
          type: 'card',
          card: {
            number: '4242424242424242',
            exp_month: 12,
            exp_year: 2030,
            cvc: '123',
          },
          billing_details: {
            name: depositorName || userData.username || 'Prize Depositor',
            email: depositorEmail || userData.email || 'admin@fitwithpulse.ai'
          }
        });
        
        actualPaymentMethodId = paymentMethod.id;
        console.log(`[DepositPrizeMoney] Created payment method: ${actualPaymentMethodId}`);
      } catch (pmError) {
        console.error('[DepositPrizeMoney] Payment method creation failed:', pmError);
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            success: false,
            error: `Payment method creation failed: ${pmError.message}`
          })
        };
      }
    }

    // Create Stripe customer if needed
    let customerId = hostStripeCustomerId;
    if (!customerId && userData.stripeCustomerId) {
      customerId = userData.stripeCustomerId;
    }

    // Create payment intent for escrow deposit
    const paymentIntentData = {
      amount: prizeAmount,
      currency: 'usd',
      payment_method: actualPaymentMethodId,
      confirm: true,
      automatic_payment_methods: {
        enabled: true,
        allow_redirects: 'never'
      },
      description: `Prize pool deposit for challenge: ${challengeData.title}`,
      metadata: {
        platform: 'pulse',
        payment_type: 'prize_escrow',
        challenge_id: challengeId,
        challenge_title: challengeData.title,
        deposited_by_user_id: depositedBy,
        deposited_by_username: userData.username,
        prize_amount_cents: prizeAmount.toString(),
        escrow_type: 'challenge_prize',
        funding_timestamp: new Date().toISOString()
      }
    };

    // Add customer if available
    if (customerId) {
      paymentIntentData.customer = customerId;
    }

    console.log(`[DepositPrizeMoney] Creating payment intent for $${prizeAmount / 100}`);

    // Create and confirm payment intent
    const paymentIntent = await stripe.paymentIntents.create(paymentIntentData);

    console.log(`[DepositPrizeMoney] Payment intent created: ${paymentIntent.id}, status: ${paymentIntent.status}`);

    // Check payment status
    if (paymentIntent.status !== 'succeeded') {
      return {
        statusCode: 402,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Payment failed',
          paymentStatus: paymentIntent.status,
          paymentIntentId: paymentIntent.id,
          clientSecret: paymentIntent.client_secret
        })
      };
    }

    // Payment succeeded - create escrow record and update challenge
    const escrowRecord = {
      challengeId: challengeId,
      challengeTitle: challengeData.title,
      totalAmount: prizeAmount,
      remainingAmount: prizeAmount, // Will decrease as prizes are distributed
      distributedAmount: 0,
      stripePaymentIntentId: paymentIntent.id,
      stripeChargeId: paymentIntent.latest_charge,
      depositedBy: depositedBy,
      depositedByUsername: userData.username,
      status: 'held', // held -> distributing -> distributed -> refunded
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      metadata: {
        originalPrizeStructure: challengeData.prizeMoney?.prizeStructure || '100% to 1st place',
        platformFeeWaived: true, // No platform fee for prize money
        escrowType: 'challenge_prize'
      }
    };

    // Use batch to update both challenge and create escrow record atomically
    const batch = db.batch();

    // Create escrow record
    const escrowRef = db.collection('prize-escrow').doc();
    batch.set(escrowRef, escrowRecord);

    // Update challenge with funding info (only if challenge exists in main collection)
    if (challengeDoc.exists) {
      const challengeRef = db.collection('challenges').doc(challengeId);
      batch.update(challengeRef, {
        'prizeMoney.fundingStatus': 'funded',
        'prizeMoney.depositedAmount': prizeAmount,
        'prizeMoney.escrowPaymentIntentId': paymentIntent.id,
        'prizeMoney.escrowRecordId': escrowRef.id,
        'prizeMoney.depositedAt': admin.firestore.FieldValue.serverTimestamp(),
        'prizeMoney.depositedBy': depositedBy,
        'prizeMoney.depositedByUsername': userData.username,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    } else {
      console.log(`[DepositPrizeMoney] Skipping challenge update - challenge ${challengeId} not found in main collection`);
    }

    // Commit batch
    await batch.commit();

    console.log(`[DepositPrizeMoney] Successfully deposited $${prizeAmount / 100} for challenge ${challengeId}`);
    console.log(`[DepositPrizeMoney] Escrow record created: ${escrowRef.id}`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Prize money deposited successfully',
        paymentIntentId: paymentIntent.id,
        escrowRecordId: escrowRef.id,
        amount: prizeAmount,
        challengeId: challengeId,
        challengeTitle: challengeData.title,
        depositedBy: userData.username,
        fundingStatus: 'funded'
      })
    };

  } catch (error) {
    console.error('[DepositPrizeMoney] Error:', error);

    // Handle specific Stripe errors
    if (error.type === 'StripeCardError') {
      return {
        statusCode: 402,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Payment failed',
          details: error.message,
          code: error.code
        })
      };
    }

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