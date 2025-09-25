const Stripe = require('stripe');
const admin = require('firebase-admin');

// Helper to determine if the request is from localhost
const isLocalhostRequest = (event) => {
  const referer = event.headers.referer || event.headers.origin || '';
  return referer.includes('localhost') || referer.includes('127.0.0.1');
};

// Initialize Firebase Admin if not already initialized
if (admin.apps.length === 0) {
  try {
    // Use the same pattern as other working functions
    const projectId = "quicklifts-dd3f1"; // Use the consistent project ID
    const privateKey = process.env.FIREBASE_SECRET_KEY ? 
      process.env.FIREBASE_SECRET_KEY.replace(/\\n/g, '\n') : '';
    const clientEmail = "firebase-adminsdk-1qxb0@quicklifts-dd3f1.iam.gserviceaccount.com";
    
    if (!privateKey) {
      console.warn('[VerifySubscription] FIREBASE_SECRET_KEY missing, using fallback');
      admin.initializeApp({
        projectId: projectId
      });
    } else {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: projectId,
          privateKey: privateKey,
          clientEmail: clientEmail,
        })
      });
    }
    console.log('[VerifySubscription] Firebase Admin initialized successfully');
  } catch (error) {
    console.error('[VerifySubscription] Firebase initialization error:', error);
  }
}

const db = admin.firestore();

// Subscription type mappings
const SubscriptionType = {
  unsubscribed: "Unsubscribed",
  monthly: "Monthly Subscriber",
  annual: "Annual Subscriber",
};

const SubscriptionPlatform = {
  Web: "Web",
  iOS: "iOS",
};

// Price ID mappings
const mapPriceIdToSubscriptionType = (priceId, isTestMode) => {
  const LIVE_MONTHLY_PRICE_ID = 'price_1PDq26RobSf56MUOucDIKLhd';
  const LIVE_ANNUAL_PRICE_ID = 'price_1PDq3LRobSf56MUOng0UxhCC';
  const TEST_MONTHLY_PRICE_ID = 'price_1RMIUNRobSf56MUOfeB4gIot';
  const TEST_ANNUAL_PRICE_ID = 'price_1RMISFRobSf56MUOpcSoohjP';
  
  const priceMapping = {
    [LIVE_MONTHLY_PRICE_ID]: SubscriptionType.monthly,
    [LIVE_ANNUAL_PRICE_ID]: SubscriptionType.annual,
    [TEST_MONTHLY_PRICE_ID]: SubscriptionType.monthly,
    [TEST_ANNUAL_PRICE_ID]: SubscriptionType.annual,
  };
  
  return priceMapping[priceId] || SubscriptionType.unsubscribed;
};

const handler = async (event) => {
  console.log(`[VerifySubscription] Received ${event.httpMethod} request.`);
  
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
    // Initialize Stripe
    const isLocalhost = isLocalhostRequest(event);
    const stripe = isLocalhost ? 
      new Stripe(process.env.STRIPE_TEST_SECRET_KEY) :
      new Stripe(process.env.STRIPE_SECRET_KEY);
    
    console.log(`[VerifySubscription] Using ${isLocalhost ? 'TEST' : 'LIVE'} Stripe mode`);

    // 1. Retrieve the session from Stripe
    console.log('[VerifySubscription] Retrieving session from Stripe...');
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

    // 3. Verify the user ID
    const clientReferenceId = session.client_reference_id;
    const subscriptionMetadataUserId = session.subscription?.metadata?.userId;

    console.log(`[VerifySubscription] Checking user ID verification:`, {
      clientReferenceId,
      subscriptionMetadataUserId,
      requestUserId: userId
    });

    const isUserIdValid = clientReferenceId === userId || subscriptionMetadataUserId === userId;

    if (!isUserIdValid) {
        console.error(`[VerifySubscription] User ID mismatch! Session client_ref: ${clientReferenceId}, subscription metadata: ${subscriptionMetadataUserId}, Request: ${userId}`);
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

    const subscriptionType = mapPriceIdToSubscriptionType(priceId, isLocalhost);
    if (subscriptionType === SubscriptionType.unsubscribed) {
        console.error(`[VerifySubscription] Could not map Price ID ${priceId} to SubscriptionType.`);
        return { statusCode: 500, body: JSON.stringify({ message: 'Internal error: Unknown subscription plan.' }) };
    }
    console.log('[VerifySubscription] Extracted data:', { stripeSubscriptionId, stripeCustomerId, priceId, subscriptionType });

    // 5. Update Firestore
    console.log('[VerifySubscription] Preparing Firestore updates...');
    const batch = db.batch();
    const now = new Date();

    // Check if subscription is in trial period
    const isTrialing = session.subscription?.status === 'trialing';
    const trialEnd = session.subscription?.trial_end ? new Date(session.subscription.trial_end * 1000) : null;

    // 5a. User record - First check if user exists
    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();
    
    if (!userDoc.exists) {
      console.error(`[VerifySubscription] User document not found: ${userRef.path}`);
      return {
        statusCode: 404,
        body: JSON.stringify({
          message: 'User document not found. Please ensure you have created a user account first.',
          error: 'USER_NOT_FOUND'
        })
      };
    }
    
    // User exists, proceed with update
    const userUpdateData = {
        subscriptionType: subscriptionType,
        subscriptionPlatform: SubscriptionPlatform.Web,
        stripeCustomerId: stripeCustomerId,
        stripeSubscriptionId: stripeSubscriptionId,
        isTrialing: isTrialing,
        trialEndDate: trialEnd,
        updatedAt: now,
    };
    batch.update(userRef, userUpdateData);
    console.log(`[VerifySubscription] Updating user doc: ${userRef.path}`);

    // 5b. Subscription record (append-only plans model)
    // Use userId as the subscription document ID
    const subscriptionRef = db.collection('subscriptions').doc(userId);
    const userData = userDoc.data() || {};
    const baseData = {
        userId: userId,
        userEmail: userData.email || null,
        username: userData.username || null,
        platform: SubscriptionPlatform.Web,
        stripeSubscriptionId: stripeSubscriptionId,
        stripeCustomerId: stripeCustomerId,
        updatedAt: now,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    batch.set(subscriptionRef, baseData, { merge: true });

    // Determine plan type and expiration
    const priceId = session.subscription?.items?.data?.[0]?.price?.id;
    const planTypeMap = (pid) => {
      switch (pid) {
        case 'price_1PDq26RobSf56MUOucDIKLhd': return 'pulsecheck-monthly';
        case 'price_1PDq3LRobSf56MUOng0UxhCC': return 'pulsecheck-annual';
        case 'price_1RMIUNRobSf56MUOfeB4gIot': return 'pulsecheck-monthly';
        case 'price_1RMISFRobSf56MUOpcSoohjP': return 'pulsecheck-annual';
        default: return null;
      }
    };
    const planType = planTypeMap(priceId);
    const currentPeriodEnd = session.subscription?.current_period_end;
    if (planType && currentPeriodEnd) {
      const expSec = currentPeriodEnd;
      const nowSec = Math.floor(Date.now() / 1000);
      const snap = await subscriptionRef.get();
      const data = snap.data() || {};
      const plans = Array.isArray(data.plans) ? data.plans : [];
      const sameType = plans.filter(p => p && p.type === planType);
      const latestSame = sameType.reduce((acc, p) => {
        const e = typeof p.expiration === 'number' ? p.expiration : 0;
        return !acc || e > acc ? e : acc;
      }, 0);
      if (Math.abs(latestSame - expSec) >= 1) {
        await subscriptionRef.update({
          plans: admin.firestore.FieldValue.arrayUnion({
            type: planType,
            expiration: expSec,
            createdAt: nowSec,
            updatedAt: nowSec,
            platform: 'web',
            productId: priceId || null,
          })
        });
      }
    }
    console.log(`[VerifySubscription] Setting subscription doc: ${subscriptionRef.path}`);

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
    return {
      statusCode: 500,
      body: JSON.stringify({ message: error.message || 'An unexpected error occurred.' }),
    };
  }
};

module.exports = { handler };
