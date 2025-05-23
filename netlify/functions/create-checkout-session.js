const Stripe = require('stripe');
const { db } = require('./config/firebase'); // Assuming firebase config is in netlify/functions/config

// Helper to determine if the request is from localhost
const isLocalhostRequest = (event) => {
  const referer = event.headers.referer || event.headers.origin || '';
  return referer.includes('localhost') || referer.includes('127.0.0.1');
};

// Initialize Stripe with the appropriate key based on environment
const getStripeInstance = (event) => {
  // Use test API key for localhost requests
  if (isLocalhostRequest(event)) {
    console.log('[CreateCheckoutSession] Request from localhost, using TEST mode');
    return new Stripe(process.env.STRIPE_TEST_SECRET_KEY);
  }
  
  // Use live API key for production requests
  console.log('[CreateCheckoutSession] Request from production, using LIVE mode');
  return new Stripe(process.env.STRIPE_SECRET_KEY);
};

const handler = async (event) => {
  console.log(`[CreateCheckoutSession] Received ${event.httpMethod} request.`);

  // Initialize Stripe with the appropriate key based on origin
  const stripe = getStripeInstance(event);

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ message: 'Method Not Allowed' }),
      headers: { 'Allow': 'POST' },
    };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch (e) {
    console.error("[CreateCheckoutSession] Error parsing request body:", e);
    return { statusCode: 400, body: JSON.stringify({ message: 'Invalid request body.' }) };
  }

  const { priceId, userId } = body; // Expect priceId and userId from frontend

  if (!priceId || !userId) {
    console.warn('[CreateCheckoutSession] Missing parameters:', { priceId: !!priceId, userId: !!userId });
    return { statusCode: 400, body: JSON.stringify({ message: 'Missing required parameters: priceId and userId' }) };
  }

  // Ensure SITE_URL is configured in Netlify environment variables
  const siteUrl = process.env.SITE_URL || 'https://fitwithpulse.ai'; // Fallback URL

  console.log(`[CreateCheckoutSession] Creating session for user: ${userId}, price: ${priceId}`);

  try {
    // Determine the base URL for success and cancel redirects
    const isLocalhost = isLocalhostRequest(event);
    const baseUrl = isLocalhost ? 
      (event.headers.origin || 'http://localhost:8888') : // Use the origin or default to localhost:8888
      siteUrl; // Use the site URL for production
    
    console.log(`[CreateCheckoutSession] Using baseUrl for redirects: ${baseUrl}, isLocalhost: ${isLocalhost}`);
    
    // Create a Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId, // The Price ID of the plan selected
          quantity: 1,
        },
      ],
      mode: 'subscription', // Important for recurring payments
      client_reference_id: userId, // Link the session to your internal user ID
      success_url: `${baseUrl}/subscription-success?session_id={CHECKOUT_SESSION_ID}`, // Redirect URL on success
      cancel_url: `${baseUrl}/subscribe`, // Redirect URL on cancellation
      // Optional: Add metadata if needed beyond client_reference_id
      // metadata: {
      //   userId: userId,
      // }
    });

    console.log(`[CreateCheckoutSession] Stripe session created successfully: ${session.id}`);

    // Return the session ID to the frontend
    return {
      statusCode: 200,
      body: JSON.stringify({ sessionId: session.id }),
    };

  } catch (error) {
    console.error('[CreateCheckoutSession] Error creating Stripe session:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: error.message || 'Failed to create checkout session.' }),
    };
  }
};

module.exports = { handler }; 