/**
 * Manage Subscription
 * 
 * Handles subscription management operations like cancel, pause, update billing,
 * and plan changes for both coaches and athletes.
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
    console.log('[ManageSubscription] Request from localhost, using TEST mode');
    return new Stripe(process.env.STRIPE_TEST_SECRET_KEY || process.env.STRIPE_SECRET_KEY);
  }
  
  console.log('[ManageSubscription] Request from production, using LIVE mode');
  return new Stripe(process.env.STRIPE_SECRET_KEY);
};

// Get user's subscription from Stripe
const getUserSubscription = async (stripe, userId) => {
  try {
    // First, get the user's Stripe customer ID
    const userDoc = await db.collection('users').doc(userId).get();
    
    if (!userDoc.exists) {
      throw new Error('User not found');
    }

    const userData = userDoc.data();
    let customerId = userData.stripeCustomerId;

    // If no customer ID in user doc, check coach collection
    if (!customerId && userData.role === 'coach') {
      const coachDoc = await db.collection('coaches').doc(userId).get();
      if (coachDoc.exists) {
        customerId = coachDoc.data().stripeCustomerId;
      }
    }

    if (!customerId) {
      throw new Error('No Stripe customer ID found for user');
    }

    // Get active subscriptions for this customer
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: 'active',
      limit: 1
    });

    if (subscriptions.data.length === 0) {
      throw new Error('No active subscription found');
    }

    return subscriptions.data[0];
  } catch (error) {
    console.error('[ManageSubscription] Error getting user subscription:', error);
    throw error;
  }
};

// Cancel subscription
const cancelSubscription = async (stripe, subscriptionId, immediately = false) => {
  try {
    if (immediately) {
      // Cancel immediately
      const subscription = await stripe.subscriptions.del(subscriptionId);
      return { 
        success: true, 
        subscription,
        message: 'Subscription cancelled immediately' 
      };
    } else {
      // Cancel at period end
      const subscription = await stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: true
      });
      return { 
        success: true, 
        subscription,
        message: 'Subscription will cancel at the end of the current billing period' 
      };
    }
  } catch (error) {
    console.error('[ManageSubscription] Error cancelling subscription:', error);
    throw error;
  }
};

// Update subscription (change plan)
const updateSubscriptionPlan = async (stripe, subscriptionId, newPriceId) => {
  try {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    
    const updatedSubscription = await stripe.subscriptions.update(subscriptionId, {
      items: [
        {
          id: subscription.items.data[0].id,
          price: newPriceId,
        },
      ],
      proration_behavior: 'create_prorations',
    });

    return { 
      success: true, 
      subscription: updatedSubscription,
      message: 'Subscription plan updated successfully' 
    };
  } catch (error) {
    console.error('[ManageSubscription] Error updating subscription plan:', error);
    throw error;
  }
};

// Reactivate cancelled subscription
const reactivateSubscription = async (stripe, subscriptionId) => {
  try {
    const subscription = await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: false
    });

    return { 
      success: true, 
      subscription,
      message: 'Subscription reactivated successfully' 
    };
  } catch (error) {
    console.error('[ManageSubscription] Error reactivating subscription:', error);
    throw error;
  }
};

// Create billing portal session
const createBillingPortalSession = async (stripe, customerId, returnUrl) => {
  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });

    return { 
      success: true, 
      url: session.url,
      message: 'Billing portal session created successfully' 
    };
  } catch (error) {
    console.error('[ManageSubscription] Error creating billing portal session:', error);
    throw error;
  }
};

const handler = async (event) => {
  console.log(`[ManageSubscription] Received ${event.httpMethod} request.`);

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
    console.error("[ManageSubscription] Error parsing request body:", e);
    return { 
      statusCode: 400, 
      headers,
      body: JSON.stringify({ message: 'Invalid request body.' }) 
    };
  }

  const { 
    action, 
    userId,
    newPriceId,
    immediately,
    returnUrl
  } = body;

  if (!action || !userId) {
    console.warn('[ManageSubscription] Missing parameters:', { 
      action: !!action, 
      userId: !!userId 
    });
    return { 
      statusCode: 400, 
      headers,
      body: JSON.stringify({ 
        message: 'Missing required parameters: action and userId' 
      }) 
    };
  }

  const siteUrl = process.env.SITE_URL || 'https://fitwithpulse.ai';
  const defaultReturnUrl = returnUrl || `${siteUrl}/profile`;

  console.log(`[ManageSubscription] Processing ${action} for user: ${userId}`);

  try {
    let result;

    switch (action) {
      case 'cancel':
        const subscription = await getUserSubscription(stripe, userId);
        result = await cancelSubscription(stripe, subscription.id, immediately);
        break;

      case 'reactivate':
        const reactivateSubscription_sub = await getUserSubscription(stripe, userId);
        result = await reactivateSubscription(stripe, reactivateSubscription_sub.id);
        break;

      case 'update_plan':
        if (!newPriceId) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ 
              message: 'newPriceId is required for update_plan action' 
            })
          };
        }
        const updateSubscription_sub = await getUserSubscription(stripe, userId);
        result = await updateSubscriptionPlan(stripe, updateSubscription_sub.id, newPriceId);
        break;

      case 'billing_portal':
        const userDoc = await db.collection('users').doc(userId).get();
        if (!userDoc.exists) {
          return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ message: 'User not found' })
          };
        }

        const userData = userDoc.data();
        let customerId = userData.stripeCustomerId;

        // Check coach collection if not found in user doc
        if (!customerId && userData.role === 'coach') {
          const coachDoc = await db.collection('coaches').doc(userId).get();
          if (coachDoc.exists) {
            customerId = coachDoc.data().stripeCustomerId;
          }
        }

        if (!customerId) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ 
              message: 'No Stripe customer ID found for user' 
            })
          };
        }

        result = await createBillingPortalSession(stripe, customerId, defaultReturnUrl);
        break;

      case 'get_status':
        const statusSubscription = await getUserSubscription(stripe, userId);
        result = {
          success: true,
          subscription: statusSubscription,
          message: 'Subscription status retrieved successfully'
        };
        break;

      default:
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ 
            message: `Invalid action: ${action}. Valid actions: cancel, reactivate, update_plan, billing_portal, get_status` 
          })
        };
    }

    console.log(`[ManageSubscription] ${action} completed successfully for user: ${userId}`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(result),
    };

  } catch (error) {
    console.error(`[ManageSubscription] Error processing ${action}:`, error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        message: error.message || `Failed to ${action} subscription.` 
      }),
    };
  }
};

module.exports = { handler };
