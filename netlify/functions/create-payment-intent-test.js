const Stripe = require('stripe');
const { db, headers } = require('./config/firebase');

console.log('Starting create-payment-intent-test function initialization...');

// Initialize Stripe with test key
console.log('Initializing Stripe with test key...');
const stripe = new Stripe(process.env.STRIPE_TEST_SECRET_KEY, {
  apiVersion: '2023-10-16'
});
console.log('Stripe test initialized successfully');

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
    
    const { challengeId, amount, currency } = data;
    // Normalize ownerId: can come in as string, array, or object/hash from certain clients
    let ownerId = data.ownerId;
    if (Array.isArray(ownerId)) {
      ownerId = ownerId[0];
    } else if (ownerId && typeof ownerId === 'object') {
      // Some clients may send a hash-like object; pick first value
      const firstKey = Object.keys(ownerId)[0];
      ownerId = ownerId[firstKey];
    }
    const buyerId = data.buyerId;
    console.log('Extracted parameters:', { challengeId, amount, currency, ownerId, buyerId });

    if (!challengeId || !amount || !currency) {
      console.log('Missing required parameters:', { challengeId, amount, currency });
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, error: 'Missing required parameters' })
      };
    }

    // Get the owner's Stripe account ID if ownerId is provided
    let connectedAccountId = null;
    if (ownerId) {
      console.log('Fetching owner data for ID:', ownerId);
      
      // Handle both string and array ownerId
      const ownerIds = Array.isArray(ownerId) ? ownerId : [ownerId];
      
      for (const id of ownerIds) {
        try {
          const ownerDoc = await db.collection('users').doc(id).get();
          console.log('Owner document exists:', ownerDoc.exists);
          
          if (ownerDoc.exists) {
            const ownerData = ownerDoc.data();
            console.log('Owner data:', {
              hasCreator: !!ownerData.creator,
              hasStripeAccountId: !!(ownerData.creator && ownerData.creator.stripeAccountId)
            });
            
            if (ownerData.creator && ownerData.creator.stripeAccountId) {
              connectedAccountId = ownerData.creator.stripeAccountId;
              console.log('Found owner Stripe account ID:', connectedAccountId);
              
              // Create a backup in the stripeConnect collection if it doesn't exist
              const stripeConnectDoc = await db.collection('stripeConnect').doc(id).get();
              if (!stripeConnectDoc.exists) {
                await db.collection('stripeConnect').doc(id).set({
                  userId: id,
                  stripeAccountId: connectedAccountId,
                  email: ownerData.email || '',
                  createdAt: new Date(),
                  updatedAt: new Date()
                });
                console.log('Created backup in stripeConnect collection for owner:', id);
              }
              
              break; // Found a valid account, no need to check others
            }
          }
        } catch (error) {
          console.error('Error fetching owner data:', error);
        }
      }
    }

    // Create options for payment intent
    const paymentIntentOptions = {
      amount: parseInt(amount),
      currency: currency.toLowerCase(),
      metadata: {
        challengeId,
        ownerId,
        environment: 'test',
        buyerId: buyerId || 'unknown',
        createdAt: new Date().toISOString(),
        source: 'fitwithpulse-web-test'
      },
      description: `Test Payment for challenge ${challengeId}`
    };
    console.log('Payment intent options:', paymentIntentOptions);

    // Add connected account as destination if available
    if (connectedAccountId) {
      // Use direct charges with application fee
      const applicationFeeAmount = Math.round(amount * 0.03); // 3% platform fee

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
      console.warn('No connected account ID found for owner, payment will go to platform account');
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