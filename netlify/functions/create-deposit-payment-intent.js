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
    const { 
      assignmentId,
      challengeId, 
      prizeAmount, // in cents
      depositedBy, // userId
      depositorName,
      depositorEmail
    } = JSON.parse(event.body);

    console.log(`[CreateDepositPaymentIntent] Creating checkout session for challenge ${challengeId}: $${prizeAmount / 100}`);
    console.log(`[CreateDepositPaymentIntent] Request data:`, {
      challengeId,
      prizeAmount,
      depositedBy,
      depositorName,
      depositorEmail
    });

    // Validation
    if (!challengeId || !prizeAmount || !depositedBy) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Missing required fields: challengeId, prizeAmount, depositedBy'
        })
      };
    }

    // Get user data for depositor
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
    console.log(`[CreateDepositPaymentIntent] Payment intent by: ${userData.username}`);

    // Check if challenge exists (with fallback logic)
    let challengeData;
    const challengeDoc = await db.collection('challenges').doc(challengeId).get();
    
    if (!challengeDoc.exists) {
      // Fallback: try to find in prize-assignments
      const prizeQuery = await db.collection('challenge-prizes')
        .where('challengeId', '==', challengeId)
        .limit(1)
        .get();
        
      if (!prizeQuery.empty) {
        const prizeData = prizeQuery.docs[0].data();
        challengeData = { title: prizeData.challengeTitle, id: challengeId };
        console.log(`[CreateDepositPaymentIntent] Challenge found in prize-assignments: ${challengeData.title}`);
      } else {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({
            success: false,
            error: `Challenge ${challengeId} not found`
          })
        };
      }
    } else {
      challengeData = challengeDoc.data();
    }

    // Check for existing escrow record for THIS assignment (not the whole challenge)
    let existingEscrowAmount = 0;
    let existingEscrowRecord = null;
    if (assignmentId) {
      const escrowQuery = await db.collection('prize-escrow')
        .where('challengeId', '==', challengeId)
        .where('prizeAssignmentId', '==', assignmentId)
        .where('status', '==', 'held')
        .limit(1)
        .get();
      if (!escrowQuery.empty) {
        existingEscrowRecord = escrowQuery.docs[0];
        const existingData = existingEscrowRecord.data();
        existingEscrowAmount = existingData.amount || 0;
        console.log(`[CreateDepositPaymentIntent] Found existing escrow for assignment ${assignmentId}: $${existingEscrowAmount / 100}`);
      }
    }

    // Calculate the difference needed
    const amountToDeposit = prizeAmount - existingEscrowAmount; // both in cents
    
    if (amountToDeposit <= 0) {
      console.log(`[CreateDepositPaymentIntent] No additional deposit needed. Prize: $${prizeAmount / 100}, Existing: $${existingEscrowAmount / 100}`);
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: `Prize is already fully funded. Current escrow: $${(existingEscrowAmount / 100).toFixed(2)}, Requested: $${(prizeAmount / 100).toFixed(2)}`,
          existingAmount: existingEscrowAmount,
          requestedAmount: prizeAmount
        })
      };
    }

    console.log(`[CreateDepositPaymentIntent] Partial deposit: Prize $${prizeAmount / 100}, Existing $${existingEscrowAmount / 100}, Need to deposit: $${amountToDeposit / 100}`);

    // Create Stripe customer if needed
    let customerId = userData.stripeCustomerId;
    if (!customerId) {
      console.log(`[CreateDepositPaymentIntent] Creating Stripe customer for ${userData.email}`);
      const customer = await stripe.customers.create({
        email: depositorEmail || userData.email,
        name: depositorName || userData.username,
        metadata: {
          userId: depositedBy,
          type: 'prize_depositor'
        }
      });
      customerId = customer.id;
      
      // Update user with customer ID
      await db.collection('users').doc(depositedBy).update({
        stripeCustomerId: customerId
      });
    }

    // Calculate fee based on amount being deposited (not full prize amount)
    const platformFeeRate = 0.035; // 3.5%
    const platformFixedFee = 50; // $0.50 fixed fee to cover Stripe's $0.30 + profit
    const platformFee = Math.round(amountToDeposit * platformFeeRate) + platformFixedFee;
    const totalChargeAmount = amountToDeposit + platformFee;

    console.log(`[CreateDepositPaymentIntent] Partial deposit fee calculation:`, {
      fullPrizeAmount: prizeAmount,
      existingEscrowAmount: existingEscrowAmount,
      amountToDeposit: amountToDeposit,
      platformFee: platformFee,
      totalChargeAmount: totalChargeAmount,
      feeStructure: '3.5% + $0.50 on deposit amount only'
    });

    // Create Payment Intent exactly like round purchases (supports Link automatically)
    // Host pays: deposit amount + platform fee, winner gets: full prize amount (from combined escrow)
    const paymentIntent = await stripe.paymentIntents.create({
      amount: totalChargeAmount, // Deposit amount + platform fee
      currency: 'usd',
      customer: customerId,
      automatic_payment_methods: {
        enabled: true, // This enables Link automatically
      },
      metadata: {
        type: 'prize_deposit',
        platform: 'pulse',
        challengeId: challengeId,
        challengeTitle: challengeData.title,
        depositedBy: depositedBy,
        depositorName: depositorName || userData.username,
        depositorEmail: depositorEmail || userData.email,
        payment_type: 'escrow_deposit',
        prizeAssignmentId: assignmentId || '',
        // Full prize amount information
        fullPrizeAmount: prizeAmount.toString(),
        existingEscrowAmount: existingEscrowAmount.toString(),
        // This deposit information
        amountToDeposit: amountToDeposit.toString(),
        platformFee: platformFee.toString(),
        totalChargeAmount: totalChargeAmount.toString(),
        // Escrow record reference (if updating existing)
        existingEscrowRecordId: existingEscrowRecord ? existingEscrowRecord.id : null
      },
      description: `Prize deposit: $${amountToDeposit/100} + $${platformFee/100} service fee for "${challengeData.title}" ${existingEscrowAmount > 0 ? `(additional to existing $${existingEscrowAmount/100})` : ''}`,
      receipt_email: depositorEmail || userData.email,
    });

    console.log(`[CreateDepositPaymentIntent] Payment intent created: ${paymentIntent.id}`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        challengeTitle: challengeData.title,
        // Full prize information
        fullPrizeAmount: prizeAmount,
        existingEscrowAmount: existingEscrowAmount,
        // This deposit information
        amountToDeposit: amountToDeposit,
        platformFee: platformFee,
        totalChargeAmount: totalChargeAmount,
        // Display breakdown
        breakdown: {
          depositAmount: `$${amountToDeposit/100}`,
          serviceFee: `$${platformFee/100}`,
          totalCharged: `$${totalChargeAmount/100}`
        },
        // Additional context
        isPartialDeposit: existingEscrowAmount > 0,
        existingEscrowRecordId: existingEscrowRecord ? existingEscrowRecord.id : null
      })
    };

  } catch (error) {
    console.error('[CreateDepositPaymentIntent] Error:', error);
    console.error('[CreateDepositPaymentIntent] Error details:', {
      message: error.message,
      type: error.type,
      code: error.code,
      stack: error.stack
    });
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message || 'Internal server error',
        details: error.type || 'Unknown error type'
      })
    };
  }
};