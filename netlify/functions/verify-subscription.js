const Stripe = require('stripe');
const { db, isDevMode, initializeFirebaseAdmin } = require('./config/firebase'); // Import Firebase helpers
const { SubscriptionPlatform, SubscriptionType } = require('./models/Subscription');
const { dateToUnixTimestamp } = require('./utils/formatDate');

// Helper to determine if the request is from localhost
const isLocalhostRequest = (event) => {
  const referer = event.headers.referer || event.headers.origin || '';
  return referer.includes('localhost') || referer.includes('127.0.0.1');
};

// Helper function to fix private key format issues
const fixPrivateKey = (key) => {
  // If there's no private key, return an empty string
  if (!key) return '';
  
  // If the key has literal \n characters, replace them with actual newlines
  if (key.includes('\\n')) {
    return key.replace(/\\n/g, '\n');
  }
  
  // If the key is already formatted properly, return it
  if (key.includes('-----BEGIN PRIVATE KEY-----') && key.includes('-----END PRIVATE KEY-----')) {
    return key;
  }
  
  // If it's just the key material without markers, add them
  return `-----BEGIN PRIVATE KEY-----\n${key}\n-----END PRIVATE KEY-----`;
};

// Initialize Stripe with the appropriate key based on environment
const getStripeInstance = (event) => {
  // Use test API key for localhost requests
  if (isLocalhostRequest(event)) {
    console.log('[VerifySubscription] Request from localhost, using TEST mode');
    return new Stripe(process.env.STRIPE_TEST_SECRET_KEY);
  }
  
  // Use live API key for production requests
  console.log('[VerifySubscription] Request from production, using LIVE mode');
  return new Stripe(process.env.STRIPE_SECRET_KEY);
};

// Helper to map Stripe Price ID to your SubscriptionType enum
const getSubscriptionTypeFromPriceId = (priceId, isTestMode) => {
    // --- IMPORTANT: Replace these with your ACTUAL Stripe Price IDs ---
    // Production price IDs
    const LIVE_MONTHLY_PRICE_ID = 'price_1PDq26RobSf56MUOucDIKLhd';
    const LIVE_ANNUAL_PRICE_ID = 'price_1PDq3LRobSf56MUOng0UxhCC';
    
    // Test price IDs
    const TEST_MONTHLY_PRICE_ID = 'price_1RMIUNRobSf56MUOfeB4gIot';
    const TEST_ANNUAL_PRICE_ID = 'price_1RMISFRobSf56MUOpcSoohjP';

    console.log(`[VerifySubscription] Mapping price ID: ${priceId}, isTestMode: ${isTestMode}`);
    
    // Check if we're in test mode
    if (isTestMode) {
        switch (priceId) {
            case TEST_MONTHLY_PRICE_ID:
                return SubscriptionType.monthly;
            case TEST_ANNUAL_PRICE_ID:
                return SubscriptionType.annual;
            default:
                console.warn(`[VerifySubscription] Unknown TEST Price ID encountered: ${priceId}`);
                // In test mode, be more lenient - assume it's a valid test price
                if (priceId.startsWith('price_')) {
                    console.log('[VerifySubscription] Assuming valid test price, defaulting to monthly');
                    return SubscriptionType.monthly;
                }
                return SubscriptionType.unsubscribed;
        }
    }

    // Production mode logic
    switch (priceId) {
        case LIVE_MONTHLY_PRICE_ID:
            return SubscriptionType.monthly;
        case LIVE_ANNUAL_PRICE_ID:
            return SubscriptionType.annual;
        default:
            console.warn(`[VerifySubscription] Unknown LIVE Price ID encountered: ${priceId}`);
            return SubscriptionType.unsubscribed;
    }
};

const handler = async (event) => {
  console.log(`[VerifySubscription] Received ${event.httpMethod} request.`);
  
  // Check if we're in development mode (localhost)
  const isDevRequest = isLocalhostRequest(event);
  console.log(`[VerifySubscription] Environment: ${isDevRequest ? 'DEVELOPMENT' : 'PRODUCTION'}`);
  
  // Fix environment variables for private keys
  if (isDevRequest && process.env.DEV_FIREBASE_SECRET_KEY) {
    process.env.DEV_FIREBASE_SECRET_KEY = fixPrivateKey(process.env.DEV_FIREBASE_SECRET_KEY);
    console.log('[VerifySubscription] Fixed DEV_FIREBASE_SECRET_KEY format');
  }
  
  if (process.env.FIREBASE_SECRET_KEY) {
    process.env.FIREBASE_SECRET_KEY = fixPrivateKey(process.env.FIREBASE_SECRET_KEY);
    console.log('[VerifySubscription] Fixed FIREBASE_SECRET_KEY format');
  }
  
  let admin;
  let dynamicDb;
  
  try {
    // Initialize Firebase with the appropriate project based on the request
    admin = initializeFirebaseAdmin(event);
    dynamicDb = admin.firestore();
    console.log('[VerifySubscription] Firebase initialized for request');
  } catch (error) {
    console.error('[VerifySubscription] Error initializing Firebase:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: error.message || 'An unexpected error occurred.' }),
    };
  }

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
    console.error("[VerifySubscription] Error parsing request body:", e);
    return { statusCode: 400, body: JSON.stringify({ message: 'Invalid request body.' }) };
  }

  const { sessionId, userId } = body;

  if (!sessionId || !userId) {
    console.warn('[VerifySubscription] Missing parameters:', { sessionId: !!sessionId, userId: !!userId });
    return { statusCode: 400, body: JSON.stringify({ message: 'Missing required parameters: sessionId and userId' }) };
  }

  console.log(`[VerifySubscription] Processing request for session: ${sessionId}, user: ${userId}`);

  try {
    // 1. Retrieve the session from Stripe
    console.log('[VerifySubscription] Retrieving session from Stripe...');
    const stripe = getStripeInstance(event);
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription', 'customer', 'line_items.data.price.product'],
    });
    console.log('[VerifySubscription] Stripe session retrieved.');

    // 2. Validate the session
    console.log('[VerifySubscription] Validating session...');
    if (session.status !== 'complete' || session.payment_status !== 'paid') {
      console.error(`[VerifySubscription] Session not complete/paid. Status: ${session.status}, PaymentStatus: ${session.payment_status}`);
      return { statusCode: 400, body: JSON.stringify({ message: 'Payment session not complete or not paid.' }) };
    }

    // 3. IMPORTANT Security Check: Verify the user ID
    const clientReferenceId = session.client_reference_id;
    const metadataUserId = session.metadata?.userId;

    if (clientReferenceId !== userId && metadataUserId !== userId) {
        console.error(`[VerifySubscription] User ID mismatch! Session client_ref: ${clientReferenceId}, metadata: ${metadataUserId}, Request: ${userId}`);
        return { statusCode: 403, body: JSON.stringify({ message: 'User ID does not match session.' }) };
    }
    console.log('[VerifySubscription] User ID verified.');

    // 4. Extract data
    const stripeSubscriptionId = typeof session.subscription === 'object' ? session.subscription?.id : session.subscription;
    const stripeCustomerId = typeof session.customer === 'object' ? session.customer?.id : session.customer;
    const priceId = session.line_items?.data[0]?.price?.id;

    if (!stripeSubscriptionId || !stripeCustomerId || !priceId) {
        console.error('[VerifySubscription] Missing critical Stripe data:', { stripeSubscriptionId, stripeCustomerId, priceId });
        return { statusCode: 500, body: JSON.stringify({ message: 'Could not retrieve necessary subscription details from Stripe.' }) };
    }

    const isTestMode = isLocalhostRequest(event);
    const subscriptionType = getSubscriptionTypeFromPriceId(priceId, isTestMode);
    if (subscriptionType === SubscriptionType.unsubscribed) {
        console.error(`[VerifySubscription] Could not map Price ID ${priceId} to SubscriptionType.`);
        return { statusCode: 500, body: JSON.stringify({ message: 'Internal error: Unknown subscription plan.' }) };
    }
    console.log('[VerifySubscription] Extracted data:', { stripeSubscriptionId, stripeCustomerId, priceId, subscriptionType });

    // 5. Update Firestore
    console.log('[VerifySubscription] Preparing Firestore updates...');
    const batch = dynamicDb.batch();
    const now = new Date();
    // Note: Firestore Admin SDK usually handles Date objects directly, no need for manual conversion to timestamp usually
    // const nowTimestamp = dateToUnixTimestamp(now); // Use if your types/logic require it

    // 5a. Subscription record
    const subscriptionRef = dynamicDb.collection('subscriptions').doc(stripeSubscriptionId);
    const subscriptionData = {
        userId: userId,
        subscriptionType: subscriptionType, // Use the mapped enum value
        platform: SubscriptionPlatform.Web, // Use the enum value
        stripeSubscriptionId: stripeSubscriptionId,
        stripeCustomerId: stripeCustomerId,
        createdAt: now, // Use Date object directly
        updatedAt: now, // Use Date object directly
    };
    batch.set(subscriptionRef, subscriptionData, { merge: true });
    console.log(`[VerifySubscription] Setting subscription doc: ${subscriptionRef.path}`);

    // 5b. User record - First check if user exists
    const userRef = dynamicDb.collection('users').doc(userId);
    const userDoc = await userRef.get();
    
    if (!userDoc.exists) {
      console.error(`[VerifySubscription] User document not found: ${userRef.path}`);
      return {
        statusCode: 404,
        body: JSON.stringify({
          message: 'User document not found. If you are in development mode, please ensure you have created a user account first.',
          error: 'NOT_FOUND',
          details: 'The subscription was created in Stripe but could not be attached to your user account.'
        })
      };
    }
    
    // User exists, proceed with update
    const userUpdateData = {
        subscriptionType: subscriptionType, // Use the mapped enum value
        subscriptionPlatform: SubscriptionPlatform.Web, // Use the enum value
        stripeCustomerId: stripeCustomerId,
        stripeSubscriptionId: stripeSubscriptionId,
        updatedAt: now, // Use Date object directly
    };
    batch.update(userRef, userUpdateData);
    console.log(`[VerifySubscription] Updating user doc: ${userRef.path}`);

    // 6. Commit batch
    await batch.commit();
    console.log('[VerifySubscription] Firestore updates committed successfully.');

    // 7. Return success
    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Subscription verified and updated successfully.' }),
    };

  } catch (error) {
    console.error('[VerifySubscription] Error:', error);
    // Check for specific Stripe error types if needed
    if (error.type === 'StripeCardError') { // Example specific error handling
         return { statusCode: 400, body: JSON.stringify({ message: error.message }) };
    }
    return {
      statusCode: 500,
      body: JSON.stringify({ message: error.message || 'An unexpected error occurred.' }),
    };
  }
};

module.exports = { handler }; 