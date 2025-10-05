const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const admin = require('firebase-admin');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

// Subscription type mappings
const SubscriptionType = {
  unsubscribed: "Unsubscribed",
  beta: "Beta User",
  monthly: "Monthly Subscriber",
  annual: "Annual Subscriber",
  sweatEquityPartner: "Sweat Equity Partner",
  executivePartner: "Executive Partner",
};

const SubscriptionPlatform = {
  iOS: "ios",
  Web: "web",
};

// Initialize Firebase if not already initialized
let db;
if (!global.firebaseInitialized) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  initializeApp({
    credential: cert(serviceAccount)
  });
  global.firebaseInitialized = true;
}
db = getFirestore();

// Price ID to subscription type mapping
function mapPriceIdToSubscriptionType(priceId) {
  console.log(`[Webhook] Mapping price ID: ${priceId}`);
  
  // Live price IDs (from subscribe.tsx)
  const LIVE_MONTHLY_PRICE_ID = 'price_1PDq26RobSf56MUOucDIKLhd';
  const LIVE_ANNUAL_PRICE_ID = 'price_1PDq3LRobSf56MUOng0UxhCC';
  
  // Test price IDs (from subscribe.tsx)
  const TEST_MONTHLY_PRICE_ID = 'price_1RMIUNRobSf56MUOfeB4gIot';
  const TEST_ANNUAL_PRICE_ID = 'price_1RMISFRobSf56MUOpcSoohjP';
  
  const priceMapping = {
    [LIVE_MONTHLY_PRICE_ID]: SubscriptionType.monthly,
    [LIVE_ANNUAL_PRICE_ID]: SubscriptionType.annual,
    [TEST_MONTHLY_PRICE_ID]: SubscriptionType.monthly,
    [TEST_ANNUAL_PRICE_ID]: SubscriptionType.annual,
  };
  
  const mappedType = priceMapping[priceId] || SubscriptionType.unsubscribed;
  console.log(`[Webhook] Mapped ${priceId} to ${mappedType}`);
  return mappedType;
}

// Helper function to get user ID from subscription
async function getUserIdFromSubscription(subscription) {
  console.log(`[Webhook] Getting user ID for subscription: ${subscription.id}`);
  
  // Try client_reference_id first (set during checkout)
  if (subscription.metadata?.userId) {
    console.log(`[Webhook] Found userId in metadata: ${subscription.metadata.userId}`);
    return subscription.metadata.userId;
  }
  
  // Try to find user by customer ID
  if (subscription.customer) {
    const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;
    console.log(`[Webhook] Looking up user by customer ID: ${customerId}`);
    
    const userQuery = await db.collection('users').where('stripeCustomerId', '==', customerId).limit(1).get();
    if (!userQuery.empty) {
      const userId = userQuery.docs[0].id;
      console.log(`[Webhook] Found user by customer ID: ${userId}`);
      return userId;
    }
  }
  
  console.error(`[Webhook] Could not determine user ID for subscription: ${subscription.id}`);
  return null;
}

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
    console.error(`Webhook signature verification failed: ${err.message}`);
    return {
      statusCode: 400,
      body: JSON.stringify({ error: `Webhook Error: ${err.message}` })
    };
  }

  // Handle the event
  console.log(`Processing webhook event type: ${stripeEvent.type}`);
  
  try {
    switch (stripeEvent.type) {
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(stripeEvent.data.object);
        break;
      case 'customer.subscription.created':
        await handleSubscriptionCreated(stripeEvent.data.object);
        break;
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(stripeEvent.data.object);
        break;
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(stripeEvent.data.object);
        break;
      case 'account.updated':
        await handleAccountUpdated(stripeEvent.data.object);
        break;
      // Handle other event types as needed
      default:
        console.log(`Unhandled event type: ${stripeEvent.type}`);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ received: true })
    };
  } catch (error) {
    console.error(`Error processing webhook: ${error.message}`);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: `Server Error: ${error.message}` })
    };
  }
};

// Handle subscription created event
async function handleSubscriptionCreated(subscription) {
  console.log(`[Webhook] Processing subscription created: ${subscription.id}`);
  
  try {
    // Skip coach subscriptions (handled by coach webhook)
    if (subscription.metadata?.userType === 'coach') {
      console.log(`[Webhook] Skipping coach subscription: ${subscription.id}`);
      return;
    }
    
    const userId = await getUserIdFromSubscription(subscription);
    if (!userId) {
      console.error(`[Webhook] No user ID found for subscription: ${subscription.id}`);
      return;
    }
    
    // Get the price ID from the subscription
    const priceId = subscription.items.data[0]?.price?.id;
    if (!priceId) {
      console.error(`[Webhook] No price ID found for subscription: ${subscription.id}`);
      return;
    }
    
    const subscriptionType = mapPriceIdToSubscriptionType(priceId);
    const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;
    
    console.log(`[Webhook] Updating user ${userId} with subscription type: ${subscriptionType}`);
    
    // Check if subscription is in trial period
    const isTrialing = subscription.status === 'trialing';
    const trialEnd = subscription.trial_end ? new Date(subscription.trial_end * 1000) : null;
    
    console.log(`[Webhook] Subscription status: ${subscription.status}, trial end: ${trialEnd}`);
    
    // Load user for denormalized fields on subscription doc
    let userEmail = null;
    let username = null;
    try {
      const userSnap = await db.collection('users').doc(userId).get();
      if (userSnap.exists) {
        const ud = userSnap.data();
        userEmail = ud?.email || null;
        username = ud?.username || null;
      }
    } catch (e) {
      console.warn('[Webhook] Failed to read user doc for denormalized fields', e);
    }

    // Update user document
    const userUpdateData = {
      subscriptionType: subscriptionType,
      subscriptionPlatform: SubscriptionPlatform.Web,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscription.id,
      isTrialing: isTrialing,
      trialEndDate: trialEnd,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    await db.collection('users').doc(userId).update(userUpdateData);
    
    // Append-only plans model
    const subRef = db.collection('subscriptions').doc(userId);
    await subRef.set({
      userId,
      userEmail,
      username,
      platform: SubscriptionPlatform.Web,
      stripeSubscriptionId: subscription.id,
      stripeCustomerId: customerId,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    // reuse previously derived priceId for plan mapping
    const toPlanType = (pid) => {
      switch (pid) {
        case 'price_1PDq26RobSf56MUOucDIKLhd': return 'pulsecheck-monthly';
        case 'price_1PDq3LRobSf56MUOng0UxhCC': return 'pulsecheck-annual';
        case 'price_1RMIUNRobSf56MUOfeB4gIot': return 'pulsecheck-monthly';
        case 'price_1RMISFRobSf56MUOpcSoohjP': return 'pulsecheck-annual';
        default: return null;
      }
    };
    const planType = toPlanType(priceId);
    const expSec = subscription.current_period_end || null;
    if (planType && expSec) {
      const snap = await subRef.get();
      const data = snap.data() || {};
      const plans = Array.isArray(data.plans) ? data.plans : [];
      const sameType = plans.filter(p => p && p.type === planType);
      const latestSame = sameType.reduce((acc, p) => {
        const e = typeof p.expiration === 'number' ? p.expiration : 0;
        return !acc || e > acc ? e : acc;
      }, 0);
      if (Math.abs(latestSame - expSec) >= 1) {
        await subRef.update({
          plans: admin.firestore.FieldValue.arrayUnion({
            type: planType,
            expiration: expSec,
            createdAt: Math.floor(Date.now() / 1000),
            updatedAt: Math.floor(Date.now() / 1000),
            platform: 'web',
            productId: priceId || null,
          })
        });
      }
    }
    
    console.log(`[Webhook] Successfully processed subscription created for user: ${userId}`);
    
  } catch (error) {
    console.error(`[Webhook] Error handling subscription created: ${error.message}`);
    throw error;
  }
}

// Handle subscription updated event
async function handleSubscriptionUpdated(subscription) {
  console.log(`[Webhook] Processing subscription updated: ${subscription.id}`);
  
  try {
    // Skip coach subscriptions (handled by coach webhook)
    if (subscription.metadata?.userType === 'coach') {
      console.log(`[Webhook] Skipping coach subscription update: ${subscription.id}`);
      return;
    }
    
    const userId = await getUserIdFromSubscription(subscription);
    if (!userId) {
      console.error(`[Webhook] No user ID found for subscription: ${subscription.id}`);
      return;
    }
    
    // Get the price ID from the subscription
    const priceId = subscription.items.data[0]?.price?.id;
    if (!priceId) {
      console.error(`[Webhook] No price ID found for subscription: ${subscription.id}`);
      return;
    }
    
    const subscriptionType = mapPriceIdToSubscriptionType(priceId);
    const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;
    
    console.log(`[Webhook] Updating user ${userId} subscription status: ${subscription.status}, type: ${subscriptionType}`);
    
    // Check if subscription is in trial period
    const isTrialing = subscription.status === 'trialing';
    const trialEnd = subscription.trial_end ? new Date(subscription.trial_end * 1000) : null;
    
    // Determine subscription type based on status
    let finalSubscriptionType = subscriptionType;
    if (subscription.status === 'canceled' || subscription.status === 'incomplete_expired') {
      finalSubscriptionType = SubscriptionType.unsubscribed;
    }
    
    console.log(`[Webhook] Subscription status: ${subscription.status}, trial end: ${trialEnd}, final type: ${finalSubscriptionType}`);
    
    // Load user for denormalized fields on subscription doc
    let userEmail = null;
    let username = null;
    try {
      const userSnap = await db.collection('users').doc(userId).get();
      if (userSnap.exists) {
        const ud = userSnap.data();
        userEmail = ud?.email || null;
        username = ud?.username || null;
      }
    } catch (e) {
      console.warn('[Webhook] Failed to read user doc for denormalized fields', e);
    }

    // Update user document
    const userUpdateData = {
      subscriptionType: finalSubscriptionType,
      subscriptionPlatform: SubscriptionPlatform.Web,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscription.id,
      isTrialing: isTrialing,
      trialEndDate: trialEnd,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    await db.collection('users').doc(userId).update(userUpdateData);
    
    // Append-only plan update on subscription doc
    const subRef = db.collection('subscriptions').doc(userId);
    await subRef.set({
      userId,
      userEmail,
      username,
      platform: SubscriptionPlatform.Web,
      stripeSubscriptionId: subscription.id,
      stripeCustomerId: customerId,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    const toPlanType = (pid) => {
      switch (pid) {
        case 'price_1PDq26RobSf56MUOucDIKLhd': return 'pulsecheck-monthly';
        case 'price_1PDq3LRobSf56MUOng0UxhCC': return 'pulsecheck-annual';
        case 'price_1RMIUNRobSf56MUOfeB4gIot': return 'pulsecheck-monthly';
        case 'price_1RMISFRobSf56MUOpcSoohjP': return 'pulsecheck-annual';
        default: return null;
      }
    };
    // reuse previously derived priceId for plan mapping
    const planType = toPlanType(priceId);
    const expSec = subscription.current_period_end || null;
    if (planType && expSec) {
      const snap = await subRef.get();
      const data = snap.data() || {};
      const plans = Array.isArray(data.plans) ? data.plans : [];
      const sameType = plans.filter(p => p && p.type === planType);
      const latestSame = sameType.reduce((acc, p) => {
        const e = typeof p.expiration === 'number' ? p.expiration : 0;
        return !acc || e > acc ? e : acc;
      }, 0);
      if (Math.abs(latestSame - expSec) >= 1) {
        await subRef.update({
          plans: admin.firestore.FieldValue.arrayUnion({
            type: planType,
            expiration: expSec,
            createdAt: Math.floor(Date.now() / 1000),
            updatedAt: Math.floor(Date.now() / 1000),
            platform: 'web',
            productId: priceId || null,
          })
        });
      }
    }
    
    console.log(`[Webhook] Successfully processed subscription updated for user: ${userId}`);
    
  } catch (error) {
    console.error(`[Webhook] Error handling subscription updated: ${error.message}`);
    throw error;
  }
}

// Handle subscription deleted event
async function handleSubscriptionDeleted(subscription) {
  console.log(`[Webhook] Processing subscription deleted: ${subscription.id}`);
  
  try {
    // Skip coach subscriptions (handled by coach webhook)
    if (subscription.metadata?.userType === 'coach') {
      console.log(`[Webhook] Skipping coach subscription deletion: ${subscription.id}`);
      return;
    }
    
    const userId = await getUserIdFromSubscription(subscription);
    if (!userId) {
      console.error(`[Webhook] No user ID found for subscription: ${subscription.id}`);
      return;
    }
    
    console.log(`[Webhook] Setting user ${userId} to unsubscribed`);
    
    // Update user document to unsubscribed
    const userUpdateData = {
      subscriptionType: SubscriptionType.unsubscribed,
      subscriptionPlatform: SubscriptionPlatform.Web,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    await db.collection('users').doc(userId).update(userUpdateData);
    
    // Update subscription document
    const subscriptionData = {
      subscriptionType: SubscriptionType.unsubscribed,
      status: 'canceled',
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    await db.collection('subscriptions').doc(userId).update(subscriptionData);
    
    console.log(`[Webhook] Successfully processed subscription deleted for user: ${userId}`);
    
  } catch (error) {
    console.error(`[Webhook] Error handling subscription deleted: ${error.message}`);
    throw error;
  }
}

async function handleCheckoutSessionCompleted(session) {
  console.log('Processing checkout.session.completed event');
  
  try {
    // Extract necessary information from the session
    const { metadata, customer_email, customer, client_reference_id } = session;
    const lineItems = await stripe.checkout.sessions.listLineItems(session.id);
    
    if (!lineItems || !lineItems.data || lineItems.data.length === 0) {
      console.error('No line items found in the checkout session');
      return;
    }
    
    // Extract metadata
    // Round/challenge context
    const challengeId = metadata?.challengeId || metadata?.roundId;
    const challengeTitle = metadata?.challengeTitle;
    let ownerId = metadata?.ownerId;
    
    console.log(`Extracted challengeId: ${challengeId}, ownerId: ${ownerId}, challengeTitle: ${challengeTitle}`);
    
    // Resolve customer information
    let buyerEmail = customer_email;
    let buyerId = client_reference_id;
    
    // Resolve ownerId if not present in metadata
    let resolvedOwnerId = ownerId;
    if (!resolvedOwnerId && challengeId) {
      try {
        const challengeDoc = await db.collection('challenges').doc(challengeId).get();
        if (challengeDoc.exists) {
          resolvedOwnerId = challengeDoc.data().ownerId || '';
          console.log(`Resolved owner ID ${resolvedOwnerId} from challenge ID ${challengeId}`);
        }
      } catch (error) {
        console.error(`Error finding owner from challenge: ${error.message}`);
      }
    }
    
    // If we still don't have an owner ID, use the challenge title as the owner ID
    if (!resolvedOwnerId && challengeId) {
      resolvedOwnerId = challengeTitle;
      console.log(`Resolved owner ID ${resolvedOwnerId} from challenge title ${challengeTitle}`);
    }
    
    // Resolve buyer ID if not present in client_reference_id
    let resolvedBuyerId = buyerId;
    if (!resolvedBuyerId && buyerEmail) {
      try {
        const userQuery = await db.collection('users').where('email', '==', buyerEmail).limit(1).get();
        if (!userQuery.empty) {
          resolvedBuyerId = userQuery.docs[0].id;
          console.log(`Resolved buyer ID ${resolvedBuyerId} from email ${buyerEmail}`);
        }
      } catch (error) {
        console.error(`Error finding buyer by email: ${error.message}`);
      }
    }
    
    // Process purchase and record transaction (round access)
    if (resolvedOwnerId && resolvedBuyerId) {
      await recordPurchase({
        ownerId: resolvedOwnerId,
        buyerId: resolvedBuyerId,
        challengeId,
        amount: session.amount_total / 100, // Convert from cents to dollars
        currency: session.currency,
        sessionId: session.id,
        paymentIntentId: session.payment_intent,
        timestamp: new Date()
      });
    } else {
      console.error(`Unable to record purchase. Missing owner ID or buyer ID. ownerId: ${resolvedOwnerId}, buyerId: ${resolvedBuyerId}`);
    }

    // If a subscription was created via Checkout (combined flow), upsert subscription record
    try {
      if (session.subscription) {
        const sub = await stripe.subscriptions.retrieve(
          typeof session.subscription === 'string' ? session.subscription : session.subscription.id
        );
        await handleSubscriptionUpdated(sub);
      }
    } catch (e) {
      console.warn('[Webhook] Subscription upsert after checkout failed:', e?.message || e);
    }
  } catch (error) {
    console.error(`Error handling checkout session completed: ${error.message}`);
    throw error;
  }
}

async function handleAccountUpdated(account) {
  console.log('Processing account.updated event');
  
  try {
    // Process account updates as needed
    const { id, charges_enabled, payouts_enabled, details_submitted } = account;
    
    // Update user account info in Firestore
    const userQuery = await db.collection('users').where('stripeAccountId', '==', id).limit(1).get();
    if (!userQuery.empty) {
      const userId = userQuery.docs[0].id;
      await db.collection('users').doc(userId).update({
        'stripeAccountDetails.chargesEnabled': charges_enabled,
        'stripeAccountDetails.payoutsEnabled': payouts_enabled,
        'stripeAccountDetails.detailsSubmitted': details_submitted,
        'stripeAccountDetails.lastUpdated': new Date()
      });
      console.log(`Updated stripe account details for user ${userId}`);
    } else {
      console.log(`No user found with Stripe Account ID: ${id}`);
    }
  } catch (error) {
    console.error(`Error handling account updated: ${error.message}`);
    throw error;
  }
}

async function recordPurchase(purchaseData) {
  console.log(`Recording purchase: ${JSON.stringify(purchaseData)}`);
  
  try {
    // Create transaction record
    const transactionRef = await db.collection('transactions').add({
      ...purchaseData,
      type: 'challenge_purchase',
      status: 'completed'
    });
    
    console.log(`Transaction recorded with ID: ${transactionRef.id}`);
    
    // Update challenge purchases (if applicable)
    if (purchaseData.challengeId) {
      await db.collection('challenges').doc(purchaseData.challengeId).update({
        purchaseCount: admin.firestore.FieldValue.increment(1),
        totalRevenue: admin.firestore.FieldValue.increment(purchaseData.amount)
      });
      
      // Add buyer to authorized users
      await db.collection('challenges').doc(purchaseData.challengeId).collection('authorizedUsers').doc(purchaseData.buyerId).set({
        userId: purchaseData.buyerId,
        purchaseDate: purchaseData.timestamp,
        transactionId: transactionRef.id
      });
      
      console.log(`Updated challenge ${purchaseData.challengeId} with purchase info`);
    }
    
    return transactionRef.id;
  } catch (error) {
    console.error(`Error recording purchase: ${error.message}`);
    throw error;
  }
}