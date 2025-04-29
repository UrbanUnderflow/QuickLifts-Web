const Stripe = require('stripe');
const { db } = require('./config/firebase'); // Assuming firebase config is in netlify/functions/config
const { SubscriptionPlatform, SubscriptionType } = require('./models/Subscription'); // Assuming models are defined/required separately
const { dateToUnixTimestamp } = require('./utils/formatDate'); // Assuming utils are defined/required separately

// Initialize Stripe with your secret key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Helper to map Stripe Price ID to your SubscriptionType enum
const getSubscriptionTypeFromPriceId = (priceId) => {
    // --- IMPORTANT: Replace these with your ACTUAL Stripe Price IDs ---
    const monthlyPriceId = 'price_1PDq26RobSf56MUOucDIKLhd';
    const annualPriceId = 'price_1PDq3LRobSf56MUOng0UxhCC';
    // Add more price IDs if needed
    // --- ---

    switch (priceId) {
        case monthlyPriceId:
            return SubscriptionType.monthly;
        case annualPriceId:
            return SubscriptionType.annual;
        // Add more cases as needed
        default:
            console.warn(`[VerifySubscription] Unknown Stripe Price ID encountered: ${priceId}`);
            return SubscriptionType.unsubscribed; // Or handle as an error
    }
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

    const subscriptionType = getSubscriptionTypeFromPriceId(priceId);
    if (subscriptionType === SubscriptionType.unsubscribed) {
        console.error(`[VerifySubscription] Could not map Price ID ${priceId} to SubscriptionType.`);
        return { statusCode: 500, body: JSON.stringify({ message: 'Internal error: Unknown subscription plan.' }) };
    }
    console.log('[VerifySubscription] Extracted data:', { stripeSubscriptionId, stripeCustomerId, priceId, subscriptionType });

    // 5. Update Firestore
    console.log('[VerifySubscription] Preparing Firestore updates...');
    const batch = db.batch();
    const now = new Date();
    // Note: Firestore Admin SDK usually handles Date objects directly, no need for manual conversion to timestamp usually
    // const nowTimestamp = dateToUnixTimestamp(now); // Use if your types/logic require it

    // 5a. Subscription record
    const subscriptionRef = db.collection('subscriptions').doc(stripeSubscriptionId);
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

    // 5b. User record
    const userRef = db.collection('users').doc(userId);
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