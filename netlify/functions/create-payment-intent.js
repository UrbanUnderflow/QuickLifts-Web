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
    const { challengeId, amount, currency, ownerId, buyerId, buyerEmail } = JSON.parse(event.body);
    
    console.log('Creating payment intent with params:', {
      challengeId,
      amount,
      currency,
      ownerId,
      buyerId,
      buyerEmail,
      ownerIdType: ownerId ? (Array.isArray(ownerId) ? 'array' : typeof ownerId) : 'undefined',
      hasBuyerId: !!buyerId,
      buyerIdType: buyerId ? typeof buyerId : 'null',
      buyerIdValue: buyerId || 'not provided',
      buyerEmail: buyerEmail || 'not provided'
    });

    // Validate required parameters
    if (!challengeId || !amount || !currency) {
      return {
        statusCode: 400,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'Missing required parameters' })
      };
    }

    // Get the owner IDs
    let ownerIds = [];
    if (ownerId) {
      if (Array.isArray(ownerId)) {
        ownerIds = ownerId;
        console.log('Owner ID is an array with length:', ownerIds.length);
      } else {
        ownerIds = [ownerId];
        console.log('Owner ID is a string:', ownerId);
      }
    }

    // If ownerId is not provided or empty, fetch it from the challenge data
    if (ownerIds.length === 0 && challengeId) {
      console.log('No owner ID provided, getting owner from challenge:', challengeId);
      
      // Try to get data from 'challenges' collection first
      const challengeDoc = await db.collection('challenges').doc(challengeId).get();
      
      if (challengeDoc.exists) {
        console.log('Found challenge in challenges collection');
        const challengeData = challengeDoc.data();
        if (challengeData.ownerId) {
          if (Array.isArray(challengeData.ownerId)) {
            ownerIds = challengeData.ownerId;
          } else {
            ownerIds = [challengeData.ownerId];
          }
          console.log('Retrieved owner IDs from challenges collection:', ownerIds);
        }
      } else {
        // If not found in challenges, try sweatlist-collection
        console.log('Challenge not found in challenges collection, checking sweatlist-collection');
        const sweatlistQuery = await db.collection('sweatlist-collection').where('challenge.id', '==', challengeId).limit(1).get();
        
        if (!sweatlistQuery.empty) {
          console.log('Found challenge in sweatlist-collection');
          const sweatlistDoc = sweatlistQuery.docs[0];
          const sweatlistData = sweatlistDoc.data();
          
          if (sweatlistData.ownerId) {
            if (Array.isArray(sweatlistData.ownerId)) {
              ownerIds = sweatlistData.ownerId;
            } else {
              ownerIds = [sweatlistData.ownerId];
            }
            console.log('Retrieved owner IDs from sweatlist-collection:', ownerIds);
          } else if (sweatlistData.challenge && sweatlistData.challenge.ownerId) {
            if (Array.isArray(sweatlistData.challenge.ownerId)) {
              ownerIds = sweatlistData.challenge.ownerId;
            } else {
              ownerIds = [sweatlistData.challenge.ownerId];
            }
            console.log('Retrieved owner IDs from challenge in sweatlist-collection:', ownerIds);
          }
        } else {
          console.log('Challenge not found in either collection');
        }
      }
    }

    // If we still don't have any owner IDs, return an error
    if (ownerIds.length === 0) {
      console.error('No owner ID provided or found in challenge');
      return {
        statusCode: 400,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'Unable to determine challenge owner account' })
      };
    }

    // Try to find a valid Stripe account ID from any of the owners
    let connectedAccountId = null;
    let selectedOwnerId = null;
    
    for (const currentOwnerId of ownerIds) {
      console.log('Checking Stripe account for owner ID:', currentOwnerId);
      const ownerDoc = await db.collection('users').doc(currentOwnerId).get();
      
      if (ownerDoc.exists) {
        const ownerData = ownerDoc.data();
        if (ownerData?.creator?.stripeAccountId) {
          connectedAccountId = ownerData.creator.stripeAccountId;
          selectedOwnerId = currentOwnerId; // Save the owner's ID for payment record
          console.log('Found owner Stripe account:', connectedAccountId);
          
          // Also check if this account exists in the stripeConnect collection
          const stripeConnectDoc = await db.collection('stripeConnect').doc(currentOwnerId).get();
          if (!stripeConnectDoc.exists) {
            // Create a backup in the stripeConnect collection
            await db.collection('stripeConnect').doc(currentOwnerId).set({
              userId: currentOwnerId,
              stripeAccountId: connectedAccountId,
              email: ownerData.email || '',
              createdAt: new Date(),
              updatedAt: new Date()
            });
            console.log('Created backup in stripeConnect collection for owner:', currentOwnerId);
          }
          
          break; // We found a valid Stripe account, no need to check other owners
        } else {
          console.log('Owner has no Stripe account:', currentOwnerId);
        }
      } else {
        console.log('Owner document not found:', currentOwnerId);
      }
    }

    // If no owner has a Stripe account, return an error
    if (!connectedAccountId) {
      console.error('No owner has a Stripe account');
      return {
        statusCode: 400,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'Round owner has not connected a Stripe account' })
      };
    }

    // Calculate platform fee (3%)
    const platformFee = Math.round(amount * 0.03);
    const ownerAmount = amount - platformFee;

    console.log('Payment split:', {
      totalAmount: amount,
      platformFee,
      ownerAmount
    });

    // Create payment intent with transfer data
    const paymentIntentOptions = {
      amount: amount,
      currency: currency.toLowerCase(),
      metadata: {
        challengeId,
        ownerId: selectedOwnerId,
        environment: 'live',
        buyerId: buyerId || 'unknown',
        buyerEmail: buyerEmail || 'unknown',
        createdAt: new Date().toISOString(),
        source: 'fitwithpulse-web'
      }
    };

    // Only add transfer_data and application_fee_amount if we have a connected account
    if (connectedAccountId) {
      paymentIntentOptions.transfer_data = {
        destination: connectedAccountId
      };
      paymentIntentOptions.application_fee_amount = platformFee;
    }

    console.log('Creating payment intent with options:', paymentIntentOptions);

    const paymentIntent = await stripe.paymentIntents.create(paymentIntentOptions);

    console.log('Payment intent created successfully:', {
      id: paymentIntent.id,
      amount: paymentIntent.amount,
      status: paymentIntent.status
    });

    // Create a record in the payments collection for dashboard display
    try {
      // Get challenge info for the payment record
      let challengeTitle = 'Fitness Round';
      
      const challengeDoc = await db.collection('challenges').doc(challengeId).get();
      if (challengeDoc.exists) {
        const challengeData = challengeDoc.data();
        challengeTitle = challengeData.title || challengeTitle;
      }
      
      // Create payment record in Firestore
      const paymentRecord = {
        paymentId: paymentIntent.id,
        amount: amount,
        currency: currency.toLowerCase(),
        status: 'incomplete', // Will be updated to 'succeeded' by webhook
        challengeId: challengeId,
        ownerId: selectedOwnerId,
        buyerId: buyerId || null,
        buyerEmail: buyerEmail || null,
        challengeTitle: challengeTitle,
        createdAt: new Date(),
        updatedAt: new Date(),
        platformFee: platformFee,
        ownerAmount: ownerAmount,
        stripeAccountId: connectedAccountId
      };
      
      await db.collection('payments').doc(paymentIntent.id).set(paymentRecord);
      console.log('Created payment record in Firestore:', paymentIntent.id);
    } catch (recordError) {
      console.error('Error creating payment record:', recordError);
      // Don't fail the whole request if just the record creation fails
    }

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