// Create a payment intent that directs funds to a trainer's connected Stripe account

const Stripe = require('stripe');
const { db, headers } = require('./config/firebase');

console.log('Starting create-payment-intent function initialization...');

// Initialize Stripe with live key
console.log('Initializing Stripe with live key...');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16'
});
console.log('Stripe initialized successfully');

const handler = async (event, context) => {
  // Enable CORS
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      }
    };
  }

  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // Parse the request body
    const { challengeId, amount, currency, trainerId } = JSON.parse(event.body);
    
    console.log('Creating payment intent with params:', {
      challengeId,
      amount,
      currency,
      trainerId
    });

    // Validate required parameters
    if (!challengeId || !amount || !currency) {
      return {
        statusCode: 400,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'Missing required parameters' })
      };
    }

    // Initialize Stripe with platform account
    let stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2023-10-16'
    });

    // If trainerId is provided, get their Stripe account
    let connectedAccountId = null;
    if (trainerId) {
      const trainerDoc = await db.collection('users').doc(trainerId).get();
      const trainerData = trainerDoc.data();
      if (trainerData?.creator?.stripeAccountId) {
        connectedAccountId = trainerData.creator.stripeAccountId;
        console.log('Found trainer Stripe account:', connectedAccountId);
      }
    }

    // Calculate platform fee (3%)
    const platformFee = Math.round(amount * 0.03);
    const trainerAmount = amount - platformFee;

    console.log('Payment split:', {
      totalAmount: amount,
      platformFee,
      trainerAmount
    });

    // Create payment intent with transfer data
    const paymentIntentOptions = {
      amount: amount,
      currency: currency.toLowerCase(),
      metadata: {
        challengeId,
        environment: 'live'
      },
      transfer_data: connectedAccountId ? {
        destination: connectedAccountId,
        amount: trainerAmount
      } : undefined,
      application_fee_amount: platformFee
    };

    console.log('Creating payment intent with options:', paymentIntentOptions);

    const paymentIntent = await stripe.paymentIntents.create(paymentIntentOptions);

    console.log('Payment intent created successfully:', {
      id: paymentIntent.id,
      amount: paymentIntent.amount,
      status: paymentIntent.status
    });

    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        success: true,
        clientSecret: paymentIntent.client_secret
      })
    };

  } catch (error) {
    console.error('Error creating payment intent:', error);
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ 
        error: error.message,
        details: error.type || 'Unknown error'
      })
    };
  }
};

module.exports = { handler }; 