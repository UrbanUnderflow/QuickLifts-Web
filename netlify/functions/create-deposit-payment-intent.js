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

    // Calculate total amount: prize + platform fee (covers Stripe + profit)
    const platformFeeRate = 0.035; // 3.5%
    const platformFixedFee = 50; // $0.50 fixed fee to cover Stripe's $0.30 + profit
    const platformFee = Math.round(prizeAmount * platformFeeRate) + platformFixedFee;
    const totalAmount = prizeAmount + platformFee;

    console.log(`[CreateDepositPaymentIntent] Fee calculation:`, {
      prizeAmount: prizeAmount,
      platformFee: platformFee,
      totalAmount: totalAmount,
      feeStructure: '3.5% + $0.50 (internal calculation)'
    });

    // Create Payment Intent exactly like round purchases (supports Link automatically)
    // Host pays: prize amount + platform fee, winner gets: full prize amount
    const paymentIntent = await stripe.paymentIntents.create({
      amount: totalAmount, // Prize + platform fee
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
        prizeAmount: prizeAmount.toString(),
        platformFee: platformFee.toString(),
        totalAmount: totalAmount.toString()
      },
      description: `Prize deposit: $${prizeAmount/100} + $${platformFee/100} service fee for "${challengeData.title}"`,
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
        prizeAmount: prizeAmount,
        platformFee: platformFee,
        totalAmount: totalAmount,
        breakdown: {
          prizeAmount: `$${prizeAmount/100}`,
          platformFee: `$${platformFee/100}`,
          totalCharged: `$${totalAmount/100}`
        }
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