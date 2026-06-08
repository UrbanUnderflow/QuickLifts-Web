const { admin } = require('./config/firebase');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { getSecretWithEnvFallback } = require('./google-secret-manager-utils');
const {
  upsertPulseCheckRevenueEvent,
  recalculatePulseCheckRevenueSummaries,
  readPulseCheckAttributionFromMetadata,
} = require('./utils/pulsecheck-revenue');
const {
  isMacraWebOfferContext,
  isMacraSubscriptionContext,
  mapMacraPriceIdToPlanType,
  mapMacraPriceIdToSubscriptionType,
  markMacraWebOfferState,
} = require('./utils/macraStripe');
const {
  MACRA_MIXPANEL_EVENTS,
  safeTrackMacraWebOfferEvent,
} = require('./utils/mixpanelAnalytics');

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

const db = admin.firestore();

async function syncPulseCheckRevenueFromAthleteSubscription(subscription, userId) {
  const pulseCheckAttribution = readPulseCheckAttributionFromMetadata(subscription?.metadata || {});
  if (!pulseCheckAttribution.teamId) {
    return;
  }

  const revenueEvent = await upsertPulseCheckRevenueEvent({
    db,
    admin,
    subscription,
    source: 'stripe-athlete-subscription',
    userId,
    metadata: subscription?.metadata || {},
  });

  if (!revenueEvent?.teamId) {
    return;
  }

  await recalculatePulseCheckRevenueSummaries({
    db,
    admin,
    teamIds: [revenueEvent.teamId],
    userIds: revenueEvent.revenueRecipientUserId ? [revenueEvent.revenueRecipientUserId] : [],
  });
}

// Price ID to subscription type mapping
function mapPriceIdToSubscriptionType(priceId) {
  console.log(`[Webhook] Mapping price ID: ${priceId}`);

  const macraSubscriptionType = mapMacraPriceIdToSubscriptionType(priceId, SubscriptionType);
  if (macraSubscriptionType) {
    console.log(`[Webhook] Mapped Macra price ${priceId} to ${macraSubscriptionType}`);
    return macraSubscriptionType;
  }

  // Live price IDs (from subscribe.tsx)
  const LIVE_MONTHLY_PRICE_ID = 'price_1TfN9QIkArZc741WdNmcTHPv';
  const LIVE_ANNUAL_PRICE_ID = 'price_1TfN8cIkArZc741WskOfYXhL';

  // Test price IDs (from subscribe.tsx)
  const TEST_MONTHLY_PRICE_ID = 'price_1TfOBPIkArZc741WGAWleQke';
  const TEST_ANNUAL_PRICE_ID = 'price_1TfOBPIkArZc741WwYxdNa8Q';

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

function mapPriceIdToPlanType(priceId) {
  const macraPlanType = mapMacraPriceIdToPlanType(priceId);
  if (macraPlanType) return macraPlanType;

  switch (priceId) {
    case 'price_1TfN9QIkArZc741WdNmcTHPv': return 'pulsecheck-monthly';
    case 'price_1TfN8cIkArZc741WskOfYXhL': return 'pulsecheck-annual';
    case 'price_1TfOBPIkArZc741WGAWleQke': return 'pulsecheck-monthly';
    case 'price_1TfOBPIkArZc741WwYxdNa8Q': return 'pulsecheck-annual';
    default: return null;
  }
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
    const endpointSecret = await getSecretWithEnvFallback('STRIPE_WEBHOOK_SECRET');
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
      case 'invoice.paid':
        await handleInvoicePaid(stripeEvent.data.object);
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
    // Coaching subscription → reconcile onto the training doc. The
    // checkout.session.completed handler already set the room active;
    // this keeps paymentStatus correct if events arrive out of order.
    if (await handleCoachingSubscriptionChange(subscription)) return;

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

    const planType = mapPriceIdToPlanType(priceId);
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

    await syncPulseCheckRevenueFromAthleteSubscription(subscription, userId);
    await markMacraWebOfferState({
      db,
      admin,
      userId,
      subscription,
      stage: 'converted',
    });

    console.log(`[Webhook] Successfully processed subscription created for user: ${userId}`);

  } catch (error) {
    console.error(`[Webhook] Error handling subscription created: ${error.message}`);
    throw error;
  }
}

// Reconciles a coaching subscription's Stripe status back onto the
// training doc so the member's room locks/unlocks automatically:
//   active/trialing → paymentStatus 'active' (room unlocked)
//   past_due/unpaid → 'pastDue' (locked)
//   canceled/incomplete_expired → 'canceled' (locked, host keeps room)
// Returns true when the subscription belongs to a coaching room.
async function handleCoachingSubscriptionChange(subscription) {
  const trainingId = subscription.metadata?.trainingId;
  if (!trainingId || subscription.metadata?.payment_type !== 'coaching_subscription') return false;

  let paymentStatus;
  switch (subscription.status) {
    case 'active':
    case 'trialing':
      paymentStatus = 'active';
      break;
    case 'past_due':
    case 'unpaid':
      paymentStatus = 'pastDue';
      break;
    default: // canceled, incomplete_expired, incomplete
      paymentStatus = 'canceled';
  }

  try {
    await db.collection('one-on-one-trainings').doc(trainingId).set({
      paymentStatus,
      stripeSubscriptionId: subscription.id,
      updatedAt: new Date()
    }, { merge: true });
    console.log(`[Webhook] Coaching subscription ${subscription.id} → training ${trainingId} paymentStatus=${paymentStatus}`);
  } catch (error) {
    console.error(`[Webhook] Error reconciling coaching subscription ${subscription.id}: ${error.message}`);
  }
  return true;
}

// Handle subscription updated event
async function handleSubscriptionUpdated(subscription) {
  console.log(`[Webhook] Processing subscription updated: ${subscription.id}`);

  try {
    // Coaching subscriptions route to the training doc, not the user's
    // platform subscription record.
    if (await handleCoachingSubscriptionChange(subscription)) return;

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

    const planType = mapPriceIdToPlanType(priceId);
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

    await syncPulseCheckRevenueFromAthleteSubscription(subscription, userId);
    await markMacraWebOfferState({
      db,
      admin,
      userId,
      subscription,
      stage: subscription.status === 'trialing' || subscription.status === 'active' ? 'converted' : subscription.status,
    });

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
    // Coaching subscription canceled → lock the member out of the room.
    if (await handleCoachingSubscriptionChange(subscription)) return;

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

    await syncPulseCheckRevenueFromAthleteSubscription(subscription, userId);
    await markMacraWebOfferState({
      db,
      admin,
      userId,
      subscription,
      stage: 'subscription_deleted',
    });

    console.log(`[Webhook] Successfully processed subscription deleted for user: ${userId}`);

  } catch (error) {
    console.error(`[Webhook] Error handling subscription deleted: ${error.message}`);
    throw error;
  }
}

function getStripeObjectId(value) {
  if (!value) return null;
  if (typeof value === 'string') return value;
  return value.id || null;
}

function eventKey(eventName) {
  return String(eventName || 'event')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

async function getUserAnalyticsProfile(userId) {
  if (!userId) return {};
  try {
    const userSnap = await db.collection('users').doc(userId).get();
    if (!userSnap.exists) return {};
    const data = userSnap.data() || {};
    return {
      email: data.email || null,
      username: data.username || null,
      displayName: data.displayName || null,
    };
  } catch (error) {
    console.warn('[Webhook] Failed to load user analytics profile:', error?.message || error);
    return {};
  }
}

function resolveMacraPaidInvoiceEvent(invoice, subscription) {
  const amountPaid = Number(invoice.amount_paid || 0);
  if (amountPaid <= 0) return null;

  const paidAtSec = Number(invoice.status_transitions?.paid_at || invoice.created || Math.floor(Date.now() / 1000));
  const trialEndSec = Number(subscription?.trial_end || 0);
  const billingReason = String(invoice.billing_reason || '').toLowerCase();
  const paidNearTrialEnd = trialEndSec && Math.abs(paidAtSec - trialEndSec) <= 3 * 24 * 60 * 60;

  if (paidNearTrialEnd) return MACRA_MIXPANEL_EVENTS.trialConverted;
  if (billingReason === 'subscription_cycle') return MACRA_MIXPANEL_EVENTS.subscriptionRenewed;
  if (billingReason === 'subscription_create') return MACRA_MIXPANEL_EVENTS.purchaseCompleted;
  return MACRA_MIXPANEL_EVENTS.subscriptionRenewed;
}

async function persistMacraWebOfferPaidInvoice({ invoice, subscription, userId, profile, metadata, price, planType, eventName }) {
  if (!userId || !invoice?.id) return;

  const paidAtSec = Number(invoice.status_transitions?.paid_at || invoice.created || Math.floor(Date.now() / 1000));
  const paidAtMs = paidAtSec * 1000;
  const paidAtTimestamp = admin.firestore.Timestamp.fromMillis(paidAtMs);
  const amountPaid = Number(invoice.amount_paid || 0) / 100;
  const currency = invoice.currency || price?.currency || null;
  const subscriptionId = getStripeObjectId(subscription);
  const customerId = getStripeObjectId(invoice.customer || subscription?.customer);
  const normalizedPlan = metadata.checkoutPlan || (planType ? planType.replace(/^macra-/, '') : null);
  const status = eventName === MACRA_MIXPANEL_EVENTS.trialConverted ? 'paid_after_trial' : 'paid';

  await db.collection('users').doc(userId).set(
    {
      macraEmailSequenceState: {
        webOffer24hPaidAt: paidAtTimestamp,
        webOffer24hPaidInvoiceId: invoice.id,
        webOffer24hPaidAmount: amountPaid,
        webOffer24hPaidCurrency: currency,
        webOffer24hPaidBillingReason: invoice.billing_reason || null,
        webOffer24hStatus: status,
        webOffer24hLastUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
    },
    { merge: true }
  );

  await db.collection('Macra-purchase-logs').doc(`stripe_${invoice.id}`).set(
    {
      userId,
      email: profile?.email || invoice.customer_email || null,
      status: 'success',
      purchaseStatus: 'success',
      source: 'macra_retarget_email',
      app: 'macra',
      platform: 'web',
      provider: 'stripe',
      plan: {
        id: planType || normalizedPlan || null,
        title: normalizedPlan || planType || 'Macra web offer',
        productId: price?.id || null,
        period: normalizedPlan || null,
        price: amountPaid,
        priceLabel: amountPaid ? `$${amountPaid.toFixed(2).replace(/\.00$/, '')}` : null,
        trialDays: null,
        provider: 'stripe',
      },
      metadata: {
        checkout_source: metadata.checkoutSource || 'macra_retarget_email',
        campaignId: metadata.campaignId || null,
        offerId: metadata.offerId || null,
        stripe_invoice_id: invoice.id,
        stripe_subscription_id: subscriptionId,
        stripe_customer_id: customerId,
        stripe_price_id: price?.id || null,
        billing_reason: invoice.billing_reason || null,
        amount_paid: amountPaid,
        currency,
        macra_web_offer_event: eventName,
      },
      createdAt: paidAtTimestamp,
      createdAtEpoch: paidAtMs,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAtEpoch: Date.now(),
    },
    { merge: true }
  );
}

async function handleInvoicePaid(invoice) {
  console.log(`[Webhook] Processing invoice.paid event: ${invoice.id}`);

  try {
    const subscriptionId = getStripeObjectId(invoice.subscription);
    if (!subscriptionId) return;

    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const invoiceMetadata = {
      ...(invoice.subscription_details?.metadata || {}),
      ...(invoice.metadata || {}),
    };
    const sessionLike = { metadata: invoiceMetadata };
    if (!isMacraWebOfferContext({ subscription, session: sessionLike })) return;

    const eventName = resolveMacraPaidInvoiceEvent(invoice, subscription);
    if (!eventName) return;

    const metadata = {
      ...(subscription.metadata || {}),
      ...invoiceMetadata,
    };
    const userId = metadata.userId || (await getUserIdFromSubscription(subscription));
    const profile = await getUserAnalyticsProfile(userId);
    const price = subscription.items?.data?.[0]?.price || invoice.lines?.data?.[0]?.price || null;
    const planType = mapPriceIdToPlanType(price?.id);
    const amountPaid = Number(invoice.amount_paid || 0) / 100;

    await safeTrackMacraWebOfferEvent({
      eventName,
      userId,
      email: profile.email || invoice.customer_email || null,
      insertId: `macra-web-offer:${eventKey(eventName)}:${invoice.id || subscriptionId}`,
      properties: {
        plan: metadata.checkoutPlan || (planType ? planType.replace(/^macra-/, '') : null),
        subscription_status: subscription.status || null,
        stripe_invoice_id: invoice.id,
        stripe_subscription_id: subscriptionId,
        stripe_customer_id: getStripeObjectId(invoice.customer || subscription.customer),
        stripe_price_id: price?.id || null,
        billing_reason: invoice.billing_reason || null,
        amount_paid: amountPaid,
        revenue: amountPaid,
        currency: invoice.currency || price?.currency || null,
        paid_at: invoice.status_transitions?.paid_at || null,
        time: invoice.status_transitions?.paid_at || invoice.created || undefined,
        trial_days: subscription.trial_end ? 30 : undefined,
        trial_end: subscription.trial_end || null,
        current_period_end: subscription.current_period_end || null,
        checkout_source: metadata.checkoutSource || 'macra_retarget_email',
        offer_id: metadata.offerId || null,
        username: profile.username || null,
      },
    });

    await persistMacraWebOfferPaidInvoice({
      invoice,
      subscription,
      userId,
      profile,
      metadata,
      price,
      planType,
      eventName,
    });
  } catch (error) {
    console.warn('[Webhook] invoice.paid Macra web offer tracking skipped:', error?.message || error);
  }
}

// Grants access to a paid 1-on-1 coaching room once checkout completes.
// Flips the training doc to active + paid/active, locks the buyer in as
// the member, stores the subscription id for recurring rooms, and writes
// a transaction record. Mirrors the round recordPurchase pattern but
// targets the `one-on-one-trainings` collection.
async function handleCoachingCheckout(session) {
  const metadata = session.metadata || {};
  const trainingId = metadata.trainingId;
  if (!trainingId) return false;

  const buyerId = metadata.buyerId || session.client_reference_id;
  const hostId = metadata.hostId || '';
  const isSubscription = session.mode === 'subscription' || metadata.payment_type === 'coaching_subscription';

  try {
    const update = {
      status: 'active',
      paymentStatus: isSubscription ? 'active' : 'paid',
      acceptedAt: Date.now() / 1000,
      updatedAt: new Date()
    };
    if (buyerId) update.memberId = buyerId;
    if (session.subscription) update.stripeSubscriptionId = session.subscription;

    await db.collection('one-on-one-trainings').doc(trainingId).set(update, { merge: true });

    await db.collection('transactions').add({
      type: isSubscription ? 'coaching_subscription' : 'coaching_purchase',
      trainingId,
      ownerId: hostId,
      buyerId: buyerId || null,
      amount: (session.amount_total || 0) / 100,
      currency: session.currency || 'usd',
      sessionId: session.id,
      paymentIntentId: session.payment_intent || null,
      subscriptionId: session.subscription || null,
      status: 'completed',
      createdAt: new Date()
    });

    console.log(`[Webhook] Coaching checkout complete for training ${trainingId} (buyer ${buyerId}, subscription=${isSubscription})`);
    return true;
  } catch (error) {
    console.error(`[Webhook] Error handling coaching checkout for ${trainingId}: ${error.message}`);
    return true; // handled (don't fall through to challenge logic)
  }
}

async function handleCheckoutSessionCompleted(session) {
  console.log('Processing checkout.session.completed event');

  try {
    // 1-on-1 paid coaching takes priority — handle and return so it
    // doesn't fall through to the round/challenge purchase path.
    if (session.metadata?.trainingId) {
      await handleCoachingCheckout(session);
      return;
    }

    // Extract necessary information from the session
    const { metadata, customer_email, customer, client_reference_id } = session;
    const lineItems = await stripe.checkout.sessions.listLineItems(session.id);

    if (!lineItems || !lineItems.data || lineItems.data.length === 0) {
      console.error('No line items found in the checkout session');
      return;
    }

    const checkoutPriceId = lineItems.data[0]?.price?.id;
    if (isMacraSubscriptionContext({ session, priceId: checkoutPriceId })) {
      await markMacraWebOfferState({
        db,
        admin,
        userId: metadata?.userId || client_reference_id,
        session,
        stage: 'checkout_completed',
      });
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
