const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const admin = require('firebase-admin');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

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
    const challengeId = metadata?.challengeId;
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
    
    // Process purchase and record transaction
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