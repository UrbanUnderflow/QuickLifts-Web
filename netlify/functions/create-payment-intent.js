// Create a payment intent that directs funds to a trainer's connected Stripe account

const Stripe = require('stripe');
const admin = require('firebase-admin');

// Initialize Firebase Admin if not already initialized
if (admin.apps.length === 0) {
  try {
    // Check if we have the required environment variables
    if (!process.env.FIREBASE_SECRET_KEY_ALT) {
      console.warn('FIREBASE_SECRET_KEY_ALT environment variable is missing. Using dummy mode.');
      // In development, we'll just initialize with a placeholder
      admin.initializeApp({
        projectId: "quicklifts-dd3f1"
      });
    } else {
      // Initialize with the actual credentials
      admin.initializeApp({
        credential: admin.credential.cert({
          "type": "service_account",
          "project_id": "quicklifts-dd3f1",
          "private_key_id": process.env.FIREBASE_PRIVATE_KEY_ALT,
          "private_key": process.env.FIREBASE_SECRET_KEY_ALT.replace(/\\n/g, '\n'),
          "client_email": "firebase-adminsdk-1qxb0@quicklifts-dd3f1.iam.gserviceaccount.com",
          "client_id": "111494077667496751062",
          "auth_uri": "https://accounts.google.com/o/oauth2/auth",
          "token_uri": "https://oauth2.googleapis.com/token",
          "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
          "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-1qxb0@quicklifts-dd3f1.iam.gserviceaccount.com"
        })
      });
    }
    console.log('Firebase Admin initialized successfully');
  } catch (error) {
    console.error('Error initializing Firebase Admin:', error);
  }
}

const db = admin.firestore();

// Initialize Stripe with error handling
let stripe;
try {
  if (process.env.STRIPE_SECRET_KEY) {
    stripe = Stripe(process.env.STRIPE_SECRET_KEY);
    console.log('Stripe initialized successfully with API key');
  } else {
    console.warn('STRIPE_SECRET_KEY environment variable is missing');
  }
} catch (error) {
  console.error('Error initializing Stripe:', error);
}

const handler = async (event) => {
  // Only accept POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ success: false, error: 'Method not allowed' })
    };
  }

  try {
    // Parse the request body
    const data = JSON.parse(event.body);
    const { challengeId, amount, currency, trainerId } = data;
    
    console.log('Creating payment intent for challenge:', challengeId, 'amount:', amount, 'trainer:', trainerId);
    
    if (!challengeId || !amount || !currency) {
      return {
        statusCode: 400,
        body: JSON.stringify({ success: false, error: 'Missing required parameters' })
      };
    }
    
    // If no stripe secret key, return dummy data for local development
    if (!stripe) {
      console.warn('No Stripe API key available, returning dummy client secret');
      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          clientSecret: 'pi_dummy_client_secret_for_development'
        })
      };
    }
    
    // Get the trainer's Stripe account ID if trainerId is provided
    let connectedAccountId = null;
    if (trainerId) {
      try {
        const trainerDoc = await db.collection('users').doc(trainerId).get();
        if (trainerDoc.exists) {
          const trainerData = trainerDoc.data();
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
        trainerId
      },
      description: `Payment for challenge ${challengeId}`
    };
    
    // Add connected account as destination if available
    if (connectedAccountId) {
      // Use direct charges with application fee
      const applicationFeeAmount = Math.round(amount * 0.2); // 20% platform fee
      
      paymentIntentOptions.application_fee_amount = applicationFeeAmount;
      paymentIntentOptions.transfer_data = {
        destination: connectedAccountId,
      };
      
      console.log('Setting up payment with application fee:', applicationFeeAmount, 'for account:', connectedAccountId);
    } else {
      console.warn('No connected account ID found for trainer, payment will go to platform account');
    }
    
    // Create a payment intent
    const paymentIntent = await stripe.paymentIntents.create(paymentIntentOptions);
    
    console.log('Payment intent created:', paymentIntent.id);
    
    // Return the client secret to the client
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        clientSecret: paymentIntent.client_secret
      })
    };
  } catch (error) {
    console.error('Error creating payment intent:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error.message || 'An error occurred creating the payment'
      })
    };
  }
};

module.exports = { handler }; 