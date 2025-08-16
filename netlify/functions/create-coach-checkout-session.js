/**
 * Create Coach Checkout Session
 * 
 * Creates Stripe checkout sessions for coach subscriptions with proper metadata
 * and webhook configuration for the coach partnership system.
 */

const Stripe = require('stripe');
const { db, headers } = require('./config/firebase');

// Helper to determine if the request is from localhost
const isLocalhostRequest = (event) => {
  const referer = event.headers.referer || event.headers.origin || '';
  return referer.includes('localhost') || referer.includes('127.0.0.1');
};

// Initialize Stripe with the appropriate key based on environment
const getStripeInstance = (event) => {
  if (isLocalhostRequest(event)) {
    console.log('[CoachCheckout] Request from localhost, using TEST mode');
    return new Stripe(process.env.STRIPE_TEST_SECRET_KEY || process.env.STRIPE_SECRET_KEY);
  }
  
  console.log('[CoachCheckout] Request from production, using LIVE mode');
  return new Stripe(process.env.STRIPE_SECRET_KEY);
};

const handler = async (event) => {
  console.log(`[CoachCheckout] Received ${event.httpMethod} request.`);

  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  // Initialize Stripe with the appropriate key based on origin
  const stripe = getStripeInstance(event);

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ message: 'Method Not Allowed' }),
    };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch (e) {
    console.error("[CoachCheckout] Error parsing request body:", e);
    return { 
      statusCode: 400, 
      headers,
      body: JSON.stringify({ message: 'Invalid request body.' }) 
    };
  }

  const { 
    priceId, 
    userId, 
    referralCode,
    partnerCode
  } = body;

  if (!priceId || !userId) {
    console.warn('[CoachCheckout] Missing parameters:', { 
      priceId: !!priceId, 
      userId: !!userId 
    });
    return { 
      statusCode: 400, 
      headers,
      body: JSON.stringify({ 
        message: 'Missing required parameters: priceId and userId' 
      }) 
    };
  }

  // Validate that this is a coach price ID
  const validCoachPrices = [
    process.env.STRIPE_PRICE_COACH_MONTHLY,
    process.env.STRIPE_PRICE_COACH_ANNUAL
  ];

  if (!validCoachPrices.includes(priceId)) {
    console.warn('[CoachCheckout] Invalid coach price ID:', priceId);
    return { 
      statusCode: 400, 
      headers,
      body: JSON.stringify({ 
        message: 'Invalid coach price ID provided' 
      }) 
    };
  }

  const siteUrl = process.env.SITE_URL || 'https://fitwithpulse.ai';

  console.log(`[CoachCheckout] Creating coach session for user: ${userId}, price: ${priceId}`);

  try {
    // Determine the base URL for success and cancel redirects
    const isLocalhost = isLocalhostRequest(event);
    const baseUrl = isLocalhost ? 
      (event.headers.origin || 'http://localhost:8888') : 
      siteUrl;
    
    console.log(`[CoachCheckout] Using baseUrl: ${baseUrl}, isLocalhost: ${isLocalhost}`);

    // Check if referral code is unique (if provided)
    if (referralCode) {
      const existingCoach = await db.collection('coaches')
        .where('referralCode', '==', referralCode)
        .limit(1)
        .get();

      if (!existingCoach.empty) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ 
            message: 'Referral code already exists. Please choose a different code.' 
          })
        };
      }
    }
    
    // Create a Checkout Session with coach-specific metadata
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      client_reference_id: userId,
      success_url: `${baseUrl}/coach/onboarding-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/PulseCheck/coach`,
      metadata: {
        userId: userId,
        userType: 'coach',
        referralCode: referralCode || '',
        partnerCode: partnerCode || '',
        createdAt: Date.now().toString()
      },
      subscription_data: {
        metadata: {
          userId: userId,
          userType: 'coach',
          referralCode: referralCode || '',
          partnerCode: partnerCode || ''
        }
      }
    });

    console.log(`[CoachCheckout] Coach session created successfully: ${session.id}`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        sessionId: session.id,
        url: session.url 
      }),
    };

  } catch (error) {
    console.error('[CoachCheckout] Error creating Stripe session:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        message: error.message || 'Failed to create coach checkout session.' 
      }),
    };
  }
};

module.exports = { handler };
