/**
 * Create Athlete Checkout Session
 * 
 * Creates Stripe checkout sessions for athlete subscriptions.
 * Handles both independent athletes ($12.99) and coach-connected athletes (free, paid by coach).
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
    console.log('[AthleteCheckout] Request from localhost, using TEST mode');
    return new Stripe(process.env.STRIPE_TEST_SECRET_KEY || process.env.STRIPE_SECRET_KEY);
  }
  
  console.log('[AthleteCheckout] Request from production, using LIVE mode');
  return new Stripe(process.env.STRIPE_SECRET_KEY);
};

const handler = async (event) => {
  console.log(`[AthleteCheckout] Received ${event.httpMethod} request.`);

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

  // Support server-side redirect flow for better mobile behavior
  if (event.httpMethod === 'GET') {
    const qp = event.queryStringParameters || {};
    const priceId = qp.priceId;
    const userId = qp.userId;
    const email = qp.email;
    const coachReferralCode = qp.coachReferralCode;
    const debug = qp.debug === '1' || qp.debug === 'true';

    if (!priceId || !userId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ message: 'Missing required parameters: priceId and userId' })
      };
    }

    try {
      const siteUrl = process.env.SITE_URL || 'https://fitwithpulse.ai';
      const isLocalhost = isLocalhostRequest(event);
      const baseUrl = isLocalhost ? (event.headers.origin || 'http://localhost:8888') : siteUrl;

      // Lookup coach if referral code provided (optional)
      let coachId = '';
      try {
        if (coachReferralCode) {
          const coachQuery = await db.collection('coaches')
            .where('referralCode', '==', coachReferralCode)
            .limit(1)
            .get();
          if (!coachQuery.empty) coachId = coachQuery.docs[0].id;
        }
      } catch {}

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [ { price: priceId, quantity: 1 } ],
        mode: 'subscription',
        client_reference_id: userId,
        ...(email ? { customer_email: email } : {}),
        success_url: `${baseUrl}/subscription-success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${baseUrl}/subscribe`,
        metadata: {
          userId,
          userType: 'athlete',
          linkedCoachId: coachId,
          coachReferralCode: coachReferralCode || ''
        },
        subscription_data: {
          metadata: { userId, userType: 'athlete', linkedCoachId: coachId || '' }
        }
      });

      return {
        statusCode: 302,
        headers: {
          ...headers,
          Location: session.url,
          'Cache-Control': 'no-store'
        },
        body: ''
      };
    } catch (err) {
      console.error('[AthleteCheckout][GET] Error creating session:', err);
      return { 
        statusCode: 500, 
        headers, 
        body: JSON.stringify({ 
          message: 'Failed to create athlete checkout session.',
          ...(debug ? { error: err?.message, code: err?.code } : {})
        }) 
      };
    }
  }

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
    console.error("[AthleteCheckout] Error parsing request body:", e);
    return { 
      statusCode: 400, 
      headers,
      body: JSON.stringify({ message: 'Invalid request body.' }) 
    };
  }

  const { 
    priceId, 
    userId,
    email, // Optional: prefill Checkout email
    coachReferralCode // Optional: if athlete is signing up through a coach
  } = body || {};

  if (!priceId || !userId) {
    console.warn('[AthleteCheckout] Missing parameters:', { 
      priceId: !!priceId, 
      userId: !!userId 
    });
    return { 
      statusCode: 400, 
      headers,
      body: JSON.stringify({ 
        message: 'Missing required parameters: priceId and userId',
        debug: { priceId, userId }
      }) 
    };
  }

  // Validate that this is an athlete price ID
  // Accept both legacy Pulse (athlete) and PulseCheck price envs (if set).
  // NOTE: We do not hard fail if priceId is not in this list; client provides the exact Stripe Price ID.
  const validAthletePrices = [
    process.env.STRIPE_PRICE_ATHLETE_MONTHLY,
    process.env.STRIPE_PRICE_ATHLETE_ANNUAL,
    process.env.STRIPE_PRICE_PULSECHECK_WEEKLY,
    process.env.STRIPE_PRICE_PULSECHECK_MONTHLY,
    process.env.STRIPE_PRICE_PULSECHECK_ANNUAL
  ].filter(Boolean);

  if (validAthletePrices.length > 0 && !validAthletePrices.includes(priceId)) {
    console.warn('[AthleteCheckout] PriceId not in known env list; proceeding anyway for flexibility:', priceId);
  }

  const siteUrl = process.env.SITE_URL || 'https://fitwithpulse.ai';

  console.log(`[AthleteCheckout] Creating athlete session for user: ${userId}, price: ${priceId}`);

  try {
    // Check if athlete is linked to a coach (which would change the flow)
    const userDoc = await db.collection('users').doc(userId).get();
    
    if (!userDoc.exists) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ 
          message: 'User not found' 
        })
      };
    }

    const userData = userDoc.data();
    let coachId = userData.linkedCoachId;

    // If coach referral code provided, look up the coach
    if (coachReferralCode && !coachId) {
      const coachQuery = await db.collection('coaches')
        .where('referralCode', '==', coachReferralCode)
        .limit(1)
        .get();

      if (!coachQuery.empty) {
        coachId = coachQuery.docs[0].id;
        console.log(`[AthleteCheckout] Found coach ${coachId} for referral code: ${coachReferralCode}`);
      }
    }

    // Determine the base URL for success and cancel redirects
    const isLocalhost = isLocalhostRequest(event);
    const baseUrl = isLocalhost ? 
      (event.headers.origin || 'http://localhost:8888') : 
      siteUrl;
    
    console.log(`[AthleteCheckout] Using baseUrl: ${baseUrl}, isLocalhost: ${isLocalhost}`);
    
    // Create metadata for the session
    const metadata = {
      userId: userId,
      userType: 'athlete',
      createdAt: Date.now().toString()
    };

    if (coachId) {
      metadata.linkedCoachId = coachId;
      metadata.coachReferralCode = coachReferralCode || '';
    }

    // Create a Checkout Session
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
      ...(email ? { customer_email: email } : {}),
      success_url: `${baseUrl}/subscription-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/subscribe`,
      metadata: metadata,
      subscription_data: {
        metadata: {
          userId: userId,
          userType: 'athlete',
          linkedCoachId: coachId || ''
        }
      }
    });

    console.log(`[AthleteCheckout] Athlete session created successfully: ${session.id}`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        sessionId: session.id,
        url: session.url 
      }),
    };

  } catch (error) {
    console.error('[AthleteCheckout] Error creating Stripe session:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        message: error.message || 'Failed to create athlete checkout session.' 
      }),
    };
  }
};

module.exports = { handler };
