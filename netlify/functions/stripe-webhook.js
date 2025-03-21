const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const axios = require('axios');
const getRawBody = require('raw-body');
const admin = require('firebase-admin');

// Initialize Firebase if not already initialized
if (admin.apps.length === 0) {
  try {
    // Check if we have the required environment variables
    if (!process.env.FIREBASE_SECRET_KEY_ALT) {
      console.warn('FIREBASE_SECRET_KEY_ALT environment variable is missing.');
      // Initialize with a placeholder for development
      admin.initializeApp({
        projectId: "quicklifts-dd3f1"
      });
    } else {
      // Initialize with the actual credentials
      admin.initializeApp({
        credential: admin.credential.cert({
          "type": "service_account",
          "project_id": "quicklifts-dd3f1",
          "private_key_id": process.env.FIREBASE_PRIVATE_KEY,
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

exports.handler = async (event) => {
  const sig = event.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_ENDPOINT_SECRET;

  let stripeEvent;

  try {
    const rawBody = await getRawBody(event.body, {
      length: event.headers['content-length'],
      limit: '1mb',
      encoding: 'utf-8',
    });

    stripeEvent = stripe.webhooks.constructEvent(rawBody, sig, endpointSecret);
  } catch (err) {
    console.error(`⚠️  Webhook signature verification failed.`, err.message);
    return {
      statusCode: 400,
      body: `Webhook Error: ${err.message}`,
    };
  }

  const eventType = stripeEvent.type;
  const eventObject = stripeEvent.data.object;

  console.log(`Received event: ${eventType}`);

  // Handle payment intent events specifically for updating dashboard data
  let paymentIntent;
  
  if (eventType.startsWith('payment_intent.')) {
    paymentIntent = eventObject;
    
    try {
      await updatePaymentRecord(paymentIntent, eventType);
    } catch (error) {
      console.error('Error updating payment record:', error);
    }
  }
  
  // Handle charge events specifically for updating dashboard data
  if (eventType.startsWith('charge.')) {
    const charge = eventObject;
    
    // If the charge has a payment intent, update the payment record
    if (charge.payment_intent) {
      try {
        const relatedPaymentIntent = await stripe.paymentIntents.retrieve(charge.payment_intent);
        await updatePaymentRecord(relatedPaymentIntent, eventType, charge);
      } catch (error) {
        console.error('Error updating payment record from charge:', error);
      }
    } else {
      // This is a direct charge without payment intent
      try {
        await createOrUpdateChargeRecord(charge, eventType);
      } catch (error) {
        console.error('Error updating charge record:', error);
      }
    }
  }

  let message;

  switch (eventType) {
    case 'invoice.payment_succeeded':
      try {
        const customer = await stripe.customers.retrieve(eventObject.customer);
        message = {
          text: `🎉 A new subscription was purchased by ${customer.email}!`,
        };
      } catch (err) {
        console.error('Error retrieving customer:', err);
        return {
          statusCode: 500,
          body: 'Internal Server Error',
        };
      }
      break;

    // Add cases for all other event types you are listening to
    case 'charge.captured':
    case 'charge.dispute.closed':
    case 'charge.dispute.created':
    case 'charge.dispute.funds_reinstated':
    case 'charge.dispute.funds_withdrawn':
    case 'charge.dispute.updated':
    case 'charge.expired':
    case 'charge.failed':
    case 'charge.pending':
    case 'charge.refund.updated':
    case 'charge.refunded':
    case 'charge.succeeded':
    case 'charge.updated':
    case 'checkout.session.async_payment_failed':
    case 'checkout.session.async_payment_succeeded':
    case 'checkout.session.completed':
    case 'checkout.session.expired':
    case 'customer.bank_account.created':
    case 'customer.bank_account.deleted':
    case 'customer.bank_account.updated':
    case 'customer.card.created':
    case 'customer.card.deleted':
    case 'customer.card.updated':
    case 'customer.created':
    case 'customer.deleted':
    case 'customer.discount.created':
    case 'customer.discount.deleted':
    case 'customer.discount.updated':
    case 'customer.source.created':
    case 'customer.source.deleted':
    case 'customer.source.expiring':
    case 'customer.source.updated':
    case 'customer.subscription.created':
    case 'customer.subscription.deleted':
    case 'customer.subscription.paused':
    case 'customer.subscription.pending_update_applied':
    case 'customer.subscription.pending_update_expired':
    case 'customer.subscription.resumed':
    case 'customer.subscription.trial_will_end':
    case 'customer.subscription.updated':
    case 'customer.tax_id.created':
    case 'customer.tax_id.deleted':
    case 'customer.tax_id.updated':
    case 'customer.updated':
    case 'payment_link.created':
    case 'payment_link.updated':
    case 'payout.canceled':
    case 'payout.created':
    case 'payout.failed':
    case 'payout.paid':
    case 'payout.reconciliation_completed':
    case 'payout.updated':
    case 'payment_intent.succeeded':
    case 'payment_intent.payment_failed':
    case 'payment_intent.created':
    case 'payment_intent.canceled':
    case 'subscription_schedule.aborted':
    case 'subscription_schedule.canceled':
    case 'subscription_schedule.completed':
    case 'subscription_schedule.created':
    case 'subscription_schedule.expiring':
    case 'subscription_schedule.released':
    case 'subscription_schedule.updated':
      message = {
        text: `Event received: ${eventType}`,
        event: JSON.stringify(eventObject, null, 2),
      };
      break;

    default:
      message = {
        text: `Unhandled event type: ${eventType}`,
        event: JSON.stringify(eventObject, null, 2),
      };
      break;
  }

  console.log(`Sending message to Slack: ${JSON.stringify(message)}`);

  try {
    await axios.post("https://hooks.slack.com/services/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", message);
    console.log('Message sent to Slack successfully.');
  } catch (err) {
    console.error('Error sending message to Slack:', err);
    return {
      statusCode: 500,
      body: 'Internal Server Error',
    };
  }

  return {
    statusCode: 200,
    body: 'Success',
  };
};

/**
 * Updates a payment record in Firestore based on a Stripe payment intent event
 * @param {Object} paymentIntent - The Stripe payment intent object
 * @param {string} eventType - The Stripe event type
 * @param {Object} charge - Optional charge object if this update is from a charge event
 */
async function updatePaymentRecord(paymentIntent, eventType, charge = null) {
  try {
    const paymentId = paymentIntent.id;
    console.log(`Processing payment record update for ${paymentId} from ${eventType}`);
    
    // Check if a payment record exists in round-payments
    const paymentRef = db.collection('round-payments').doc(paymentId);
    const paymentDoc = await paymentRef.get();
    
    // Map stripe event types to our status values
    let status = 'pending';
    if (eventType === 'payment_intent.succeeded' || eventType === 'charge.succeeded') {
      status = 'succeeded';
    } else if (eventType === 'payment_intent.payment_failed' || eventType === 'charge.failed') {
      status = 'failed';
    } else if (eventType === 'payment_intent.canceled' || eventType === 'charge.expired') {
      status = 'canceled';
    } else if (eventType === 'charge.refunded') {
      status = 'refunded';
    }
    
    if (paymentDoc.exists) {
      // Update existing payment record
      const updateData = {
        status,
        updatedAt: new Date(),
        stripeEventType: eventType
      };
      
      // If this is from a charge, add the charge ID
      if (charge) {
        updateData.chargeId = charge.id;
        
        // Only update amount if not already set
        if (!paymentDoc.data().amount && charge.amount) {
          updateData.amount = charge.amount;
        }
      }
      
      await paymentRef.update(updateData);
      console.log(`Updated round-payment record ${paymentId} with status: ${status}`);
    } else {
      // Also check the legacy 'payments' collection
      const legacyPaymentRef = db.collection('payments').doc(paymentId);
      const legacyPaymentDoc = await legacyPaymentRef.get();
      
      if (legacyPaymentDoc.exists) {
        // Legacy payment exists - migrate to round-payments and update
        const legacyData = legacyPaymentDoc.data();
        
        // Migrate data to new collection with correct field names
        const migratedData = {
          ...legacyData,
          ownerId: legacyData.trainerId || legacyData.ownerId,
          ownerAmount: legacyData.trainerAmount || legacyData.ownerAmount,
          status,
          updatedAt: new Date(),
          stripeEventType: eventType,
          migratedFromLegacy: true
        };
        
        // Remove old fields if they exist
        delete migratedData.trainerId;
        delete migratedData.trainerAmount;
        
        // If this is from a charge, add the charge ID
        if (charge) {
          migratedData.chargeId = charge.id;
        }
        
        await paymentRef.set(migratedData);
        console.log(`Migrated and updated payment from legacy collection to round-payments: ${paymentId}`);
      } else {
        // No payment record found in either collection - create a new one
        console.log(`No payment record found for ${paymentId}, creating one in round-payments`);
        
        // Extract challenge ID and owner ID from metadata if available
        const challengeId = paymentIntent.metadata?.challengeId || '';
        const ownerId = paymentIntent.metadata?.ownerId || paymentIntent.metadata?.trainerId || '';
        
        // Try to get challenge details if we have a challenge ID
        let challengeTitle = 'Fitness Round';
        if (challengeId) {
          try {
            const challengeDoc = await db.collection('challenges').doc(challengeId).get();
            if (challengeDoc.exists) {
              challengeTitle = challengeDoc.data().title || challengeTitle;
            }
          } catch (error) {
            console.error(`Error fetching challenge details: ${error.message}`);
          }
        }
        
        // If we don't have an owner ID but have a destination, try to find the owner
        let resolvedOwnerId = ownerId;
        if (!resolvedOwnerId && paymentIntent.transfer_data?.destination) {
          try {
            const accountId = paymentIntent.transfer_data.destination;
            const ownerQuery = await db.collection('users')
              .where('creator.stripeAccountId', '==', accountId)
              .limit(1)
              .get();
              
            if (!ownerQuery.empty) {
              resolvedOwnerId = ownerQuery.docs[0].id;
              console.log(`Resolved owner ID ${resolvedOwnerId} from account ID ${accountId}`);
            }
          } catch (error) {
            console.error(`Error finding owner for account: ${error.message}`);
          }
        }
        
        // Calculate fee and owner amount if available
        let platformFee = 0;
        let ownerAmount = 0;
        
        if (paymentIntent.application_fee_amount) {
          platformFee = paymentIntent.application_fee_amount;
          ownerAmount = paymentIntent.amount - platformFee;
        }
        
        // Create new payment record
        const paymentData = {
          paymentId,
          amount: paymentIntent.amount,
          currency: paymentIntent.currency,
          status,
          challengeId,
          ownerId: resolvedOwnerId,
          challengeTitle,
          createdAt: new Date(),
          updatedAt: new Date(),
          stripeEventType: eventType,
          stripeAccountId: paymentIntent.transfer_data?.destination || null,
          platformFee,
          ownerAmount
        };
        
        // If this is from a charge, add the charge ID
        if (charge) {
          paymentData.chargeId = charge.id;
        }
        
        await paymentRef.set(paymentData);
        console.log(`Created new round-payment record for ${paymentId}`);
      }
    }
  } catch (error) {
    console.error(`Error updating payment record: ${error.message}`);
    throw error;
  }
}

/**
 * Creates or updates a record directly from a charge object
 * @param {Object} charge - The Stripe charge object
 * @param {string} eventType - The Stripe event type
 */
async function createOrUpdateChargeRecord(charge, eventType) {
  try {
    const chargeId = charge.id;
    console.log(`Processing charge record update for ${chargeId} from ${eventType}`);
    
    // Look for an existing charge record in round-payments
    const chargeRef = db.collection('round-payments').doc(chargeId);
    const chargeDoc = await chargeRef.get();
    
    // Map stripe event types to our status values
    let status = 'pending';
    if (eventType === 'charge.succeeded') {
      status = 'succeeded';
    } else if (eventType === 'charge.failed') {
      status = 'failed';
    } else if (eventType === 'charge.expired') {
      status = 'canceled';
    } else if (eventType === 'charge.refunded') {
      status = 'refunded';
    }
    
    if (chargeDoc.exists) {
      // Update existing charge record
      await chargeRef.update({
        status,
        updatedAt: new Date(),
        stripeEventType: eventType
      });
      console.log(`Updated round-payment charge record ${chargeId} with status: ${status}`);
    } else {
      // Check legacy 'payments' collection
      const legacyChargeRef = db.collection('payments').doc(chargeId);
      const legacyChargeDoc = await legacyChargeRef.get();
      
      if (legacyChargeDoc.exists) {
        // Migrate from legacy collection
        const legacyData = legacyChargeDoc.data();
        
        // Migrate data to new collection with correct field names
        const migratedData = {
          ...legacyData,
          ownerId: legacyData.trainerId || legacyData.ownerId,
          ownerAmount: legacyData.trainerAmount || legacyData.ownerAmount,
          status,
          updatedAt: new Date(),
          stripeEventType: eventType,
          migratedFromLegacy: true
        };
        
        // Remove old fields if they exist
        delete migratedData.trainerId;
        delete migratedData.trainerAmount;
        
        await chargeRef.set(migratedData);
        console.log(`Migrated and updated charge from legacy collection to round-payments: ${chargeId}`);
      } else {
        // Create new charge record
        // Extract destination account ID if this is a connected account charge
        const destAccountId = charge.destination || null;
        
        // If we have a destination account, try to find the owner
        let ownerId = null;
        if (destAccountId) {
          try {
            const accountQuery = await db.collection('users')
              .where('creator.stripeAccountId', '==', destAccountId)
              .limit(1)
              .get();
              
            if (!accountQuery.empty) {
              ownerId = accountQuery.docs[0].id;
            }
          } catch (error) {
            console.error(`Error finding owner for account ${destAccountId}: ${error.message}`);
          }
        }
        
        // Calculate fee and owner amount if available
        let platformFee = 0;
        let ownerAmount = 0;
        
        if (charge.application_fee_amount) {
          platformFee = charge.application_fee_amount;
          ownerAmount = charge.amount - platformFee;
        }
        
        // Create basic charge record
        const chargeData = {
          paymentId: chargeId,
          chargeId,
          amount: charge.amount,
          currency: charge.currency,
          status,
          ownerId,
          stripeAccountId: destAccountId,
          challengeTitle: charge.description || 'Fitness Round',
          createdAt: new Date(),
          updatedAt: new Date(),
          stripeEventType: eventType,
          source: 'direct_charge',
          platformFee,
          ownerAmount
        };
        
        await chargeRef.set(chargeData);
        console.log(`Created new round-payment charge record for ${chargeId}`);
      }
    }
  } catch (error) {
    console.error(`Error updating charge record: ${error.message}`);
    throw error;
  }
}