/**
 * Coach-Specific Stripe Webhook Handler
 * 
 * Handles Stripe webhook events specifically related to coach subscriptions,
 * revenue sharing, and coach management in the partnership system.
 */

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const admin = require('firebase-admin');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET_COACH;

// Initialize Firebase if not already initialized
let db;
if (!global.firebaseCoachWebhookInitialized) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  initializeApp({
    credential: cert(serviceAccount)
  }, 'coach-webhook');
  global.firebaseCoachWebhookInitialized = true;
  db = getFirestore(admin.app('coach-webhook'));
} else {
  db = getFirestore(admin.app('coach-webhook'));
}

// Generate a unique referral code
const generateReferralCode = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

// Handle successful coach subscription
const handleCoachSubscriptionCreated = async (subscription) => {
  console.log('[CoachWebhook] Processing coach subscription created:', subscription.id);

  try {
    const userId = subscription.metadata.userId;
    const referralCode = subscription.metadata.referralCode || await generateUniqueReferralCode();
    const partnerCode = subscription.metadata.partnerCode || null;

    if (!userId) {
      console.error('[CoachWebhook] No userId in subscription metadata');
      return;
    }

    // Validate partner code if provided
    let linkedPartnerId = null;
    if (partnerCode) {
      console.log('[CoachWebhook] Validating partner code:', partnerCode);
      
      const partnerQuery = await db.collection('coaches')
        .where('referralCode', '==', partnerCode.toUpperCase())
        .where('subscriptionStatus', '==', 'partner')
        .limit(1)
        .get();

      if (!partnerQuery.empty) {
        linkedPartnerId = partnerQuery.docs[0].id;
        console.log('[CoachWebhook] Linked to partner:', linkedPartnerId);
      } else {
        console.warn('[CoachWebhook] Invalid partner code provided:', partnerCode);
      }
    }

    // Create or update coach document
    const coachData = {
      userId: userId,
      referralCode: referralCode,
      linkedPartnerId: linkedPartnerId, // Link to partner for revenue sharing
      stripeCustomerId: subscription.customer,
      subscriptionStatus: subscription.status,
      userType: 'coach',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    // Use userId as the coach document ID for easy lookup
    await db.collection('coaches').doc(userId).set(coachData);

    // Update user role to coach
    await db.collection('users').doc(userId).update({
      role: 'coach',
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // If this coach was referred by another coach, create the referral relationship
    if (referredByCoachId) {
      await db.collection('coachReferrals').add({
        referrerCoachId: referredByCoachId,
        referredCoachId: userId,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      console.log(`[CoachWebhook] Created referral relationship: ${referredByCoachId} -> ${userId}`);
    }

    console.log(`[CoachWebhook] Coach ${userId} successfully created with referral code: ${referralCode}`);

  } catch (error) {
    console.error('[CoachWebhook] Error handling coach subscription created:', error);
    throw error;
  }
};

// Generate a unique referral code
const generateUniqueReferralCode = async (attempts = 0) => {
  if (attempts > 10) {
    throw new Error('Unable to generate unique referral code after 10 attempts');
  }

  const code = generateReferralCode();
  
  // Check if code already exists
  const existingCoach = await db.collection('coaches')
    .where('referralCode', '==', code)
    .limit(1)
    .get();

  if (existingCoach.empty) {
    return code;
  } else {
    return generateUniqueReferralCode(attempts + 1);
  }
};

// Handle subscription status changes
const handleCoachSubscriptionUpdated = async (subscription) => {
  console.log('[CoachWebhook] Processing coach subscription updated:', subscription.id);

  try {
    const userId = subscription.metadata.userId;
    
    if (!userId) {
      console.error('[CoachWebhook] No userId in subscription metadata');
      return;
    }

    // Update coach subscription status
    await db.collection('coaches').doc(userId).update({
      subscriptionStatus: subscription.status,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log(`[CoachWebhook] Updated coach ${userId} subscription status to: ${subscription.status}`);

    // If subscription is cancelled or past_due, handle accordingly
    if (subscription.status === 'canceled' || subscription.status === 'past_due') {
      console.log(`[CoachWebhook] Coach ${userId} subscription is ${subscription.status} - may need to disable coach features`);
      
      // Note: You might want to add logic here to handle:
      // - Disabling coach dashboard access
      // - Notifying linked athletes
      // - Pausing revenue sharing calculations
    }

  } catch (error) {
    console.error('[CoachWebhook] Error handling coach subscription updated:', error);
    throw error;
  }
};

// Handle successful checkout session for coaches
const handleCoachCheckoutSessionCompleted = async (session) => {
  console.log('[CoachWebhook] Processing coach checkout session completed:', session.id);

  try {
    const subscription = await stripe.subscriptions.retrieve(session.subscription);
    await handleCoachSubscriptionCreated(subscription);
  } catch (error) {
    console.error('[CoachWebhook] Error handling coach checkout session completed:', error);
    throw error;
  }
};

// Handle athlete subscription events that affect coach revenue
const handleAthleteSubscriptionForRevenue = async (subscription) => {
  console.log('[CoachWebhook] Processing athlete subscription for revenue sharing:', subscription.id);

  try {
    const userId = subscription.metadata.userId;
    const linkedCoachId = subscription.metadata.linkedCoachId;

    if (!userId || !linkedCoachId) {
      console.log('[CoachWebhook] No coach linked to this athlete subscription');
      return;
    }

    // Create or update coach-athlete relationship
    const coachAthleteData = {
      coachId: linkedCoachId,
      athleteUserId: userId,
      linkedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    // Use a compound ID for easy querying
    const relationshipId = `${linkedCoachId}_${userId}`;
    await db.collection('coachAthletes').doc(relationshipId).set(coachAthleteData);

    console.log(`[CoachWebhook] Created coach-athlete relationship: ${linkedCoachId} -> ${userId}`);

    // Note: Revenue calculation could be triggered here or handled by a separate scheduled function

  } catch (error) {
    console.error('[CoachWebhook] Error handling athlete subscription for revenue:', error);
    throw error;
  }
};

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  let stripeEvent;
  
  try {
    const sig = event.headers['stripe-signature'];
    stripeEvent = stripe.webhooks.constructEvent(event.body, sig, endpointSecret);
  } catch (err) {
    console.error(`[CoachWebhook] Webhook signature verification failed: ${err.message}`);
    return {
      statusCode: 400,
      body: JSON.stringify({ error: `Webhook Error: ${err.message}` })
    };
  }

  console.log(`[CoachWebhook] Processing webhook event type: ${stripeEvent.type}`);
  
  try {
    switch (stripeEvent.type) {
      // Coach-specific events
      case 'checkout.session.completed':
        const session = stripeEvent.data.object;
        if (session.metadata && session.metadata.userType === 'coach') {
          await handleCoachCheckoutSessionCompleted(session);
        } else if (session.metadata && session.metadata.userType === 'athlete' && session.metadata.linkedCoachId) {
          // Handle athlete subscription that affects coach revenue
          const subscription = await stripe.subscriptions.retrieve(session.subscription);
          await handleAthleteSubscriptionForRevenue(subscription);
        }
        break;

      case 'customer.subscription.created':
        const createdSubscription = stripeEvent.data.object;
        if (createdSubscription.metadata && createdSubscription.metadata.userType === 'coach') {
          await handleCoachSubscriptionCreated(createdSubscription);
        } else if (createdSubscription.metadata && createdSubscription.metadata.linkedCoachId) {
          await handleAthleteSubscriptionForRevenue(createdSubscription);
        }
        break;

      case 'customer.subscription.updated':
        const updatedSubscription = stripeEvent.data.object;
        if (updatedSubscription.metadata && updatedSubscription.metadata.userType === 'coach') {
          await handleCoachSubscriptionUpdated(updatedSubscription);
        }
        break;

      case 'customer.subscription.deleted':
        const deletedSubscription = stripeEvent.data.object;
        if (deletedSubscription.metadata && deletedSubscription.metadata.userType === 'coach') {
          await handleCoachSubscriptionUpdated(deletedSubscription);
        }
        break;

      default:
        console.log(`[CoachWebhook] Unhandled event type: ${stripeEvent.type}`);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ received: true })
    };

  } catch (error) {
    console.error(`[CoachWebhook] Error processing webhook:`, error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};
