const Stripe = require('stripe');
const { db, headers } = require('./config/firebase');

console.log('Starting create-payment-intent-test function initialization...');

// Initialize Stripe with test key
console.log('Initializing Stripe with test key...');
const stripe = new Stripe(process.env.STRIPE_TEST_SECRET_KEY, {
  apiVersion: '2023-10-16'
});
console.log('Stripe initialized successfully');

const handler = async (event) => {
  console.log('Handler called with event:', {
    httpMethod: event.httpMethod,
    body: event.body ? JSON.parse(event.body) : null
  });

  // Handle CORS preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return { 
      statusCode: 200, 
      headers,
      body: '' 
    };
  }

  // Only accept POST requests
  if (event.httpMethod !== 'POST') {
    console.log('Invalid HTTP method:', event.httpMethod);
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ success: false, error: 'Method not allowed' })
    };
  }

  try {
    // Parse the request body
    const data = JSON.parse(event.body);
    console.log('Parsed request data:', data);
    
    const { challengeId, amount, currency, trainerId } = data;
    console.log('Extracted parameters:', { challengeId, amount, currency, trainerId });

    if (!challengeId || !amount || !currency) {
      console.log('Missing required parameters:', { challengeId, amount, currency });
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, error: 'Missing required parameters' })
      };
    }

    // Get the trainer's Stripe account ID if trainerId is provided
    let connectedAccountId = null;
    if (trainerId) {
      console.log('Fetching trainer data for ID:', trainerId);
      try {
        const trainerDoc = await db.collection('users').doc(trainerId).get();
        console.log('Trainer document exists:', trainerDoc.exists);
        
        if (trainerDoc.exists) {
          const trainerData = trainerDoc.data();
          console.log('Trainer data:', {
            hasCreator: !!trainerData.creator,
            hasStripeAccountId: !!(trainerData.creator && trainerData.creator.stripeAccountId)
          });
          
          if (trainerData.creator && trainerData.creator.stripeAccountId) {
            connectedAccountId = trainerData.creator.stripeAccountId;
            console.log('Found trainer Stripe account ID:', connectedAccountId);
          }
        }
      } catch (error) {
        console.error('Error fetching trainer data:', error);
      }
    }

    // Create options for payment intent
    const paymentIntentOptions = {
      amount: parseInt(amount),
      currency: currency.toLowerCase(),
      metadata: {
        challengeId,
        trainerId,
        environment: 'test'
      },
      description: `Test Payment for challenge ${challengeId}`
    };
    console.log('Payment intent options:', paymentIntentOptions);

    // Add connected account as destination if available
    if (connectedAccountId) {
      // Use direct charges with application fee
      const applicationFeeAmount = Math.round(amount * 0.2); // 20% platform fee

      paymentIntentOptions.application_fee_amount = applicationFeeAmount;
      paymentIntentOptions.transfer_data = {
        destination: connectedAccountId
      };

      console.log(
        'Setting up test payment with application fee:',
        applicationFeeAmount,
        'for account:',
        connectedAccountId
      );
    } else {
      console.warn('No connected account ID found for trainer, payment will go to platform account');
    }

    // Create a payment intent
    console.log('Creating payment intent with options:', paymentIntentOptions);
    const paymentIntent = await stripe.paymentIntents.create(paymentIntentOptions);
    console.log('Payment intent created successfully:', {
      id: paymentIntent.id,
      status: paymentIntent.status,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency
    });

    // Return the client secret to the client
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        clientSecret: paymentIntent.client_secret
      })
    };
  } catch (error) {
    console.error('Error creating test payment intent:', error);
    console.error('Error details:', {
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
        error: error.message || 'An error occurred creating the test payment'
      })
    };
  }
};

module.exports = { handler };