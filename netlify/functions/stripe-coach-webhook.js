/**
 * PulseCheck coach/team billing webhook.
 *
 * This endpoint keeps legacy coach-paid subscriptions compatible while routing
 * billing state and revenue attribution through the PulseCheck org/team model.
 */

const { admin } = require('./config/firebase');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET_COACH;
const {
  normalizeString,
  resolvePulseCheckCommercialContext,
  syncTeamCommercialConfigFromSubscription,
  upsertPulseCheckRevenueEvent,
  recalculatePulseCheckRevenueSummaries,
} = require('./utils/pulsecheck-revenue');

const db = admin.firestore();

async function syncLegacyCoachCompatibility(subscription, userId) {
  const stripeCustomerId =
    typeof subscription?.customer === 'string'
      ? normalizeString(subscription.customer)
      : normalizeString(subscription?.customer?.id);

  await db.collection('coaches').doc(userId).set(
    {
      userId,
      stripeCustomerId: stripeCustomerId || null,
      subscriptionStatus: normalizeString(subscription?.status) || null,
      userType: 'coach',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  await db.collection('users').doc(userId).set(
    {
      role: 'coach',
      stripeCustomerId: stripeCustomerId || null,
      stripeSubscriptionId: normalizeString(subscription?.id) || null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}

async function syncCoachBillingSubscription(subscription) {
  const userId = normalizeString(subscription?.metadata?.userId);
  if (!userId) {
    console.warn('[CoachWebhook] Missing metadata.userId on coach subscription:', subscription?.id);
    return null;
  }

  await syncLegacyCoachCompatibility(subscription, userId);

  const context = await resolvePulseCheckCommercialContext({
    db,
    userId,
    metadata: subscription?.metadata || {},
  });

  if (!context.teamId) {
    console.warn('[CoachWebhook] No PulseCheck team context for coach subscription:', {
      subscriptionId: subscription?.id,
      userId,
    });
    return null;
  }

  const commercialUpdate = await syncTeamCommercialConfigFromSubscription({
    db,
    admin,
    subscription,
    userId,
    context,
    forceTeamPlan: true,
  });

  const revenueEvent = await upsertPulseCheckRevenueEvent({
    db,
    admin,
    subscription,
    source: 'stripe-team-plan-subscription',
    userId,
    metadata: {
      ...(subscription?.metadata || {}),
      userType: 'coach',
      pulsecheckOrganizationId: context.organizationId || '',
      pulsecheckTeamId: context.teamId || '',
      pulsecheckCommercialModel: 'team-plan',
      pulsecheckTeamPlanStatus: normalizeString(subscription?.status) === 'active' ? 'active' : 'inactive',
      pulsecheckRevenueRecipientUserId: context.commercialConfig.revenueRecipientUserId || '',
      pulsecheckRevenueRecipientRole: context.commercialConfig.revenueRecipientRole || '',
    },
    context: {
      ...context,
      commercialConfig: commercialUpdate?.commercialConfig || {
        ...context.commercialConfig,
        commercialModel: 'team-plan',
      },
    },
  });

  await recalculatePulseCheckRevenueSummaries({
    db,
    admin,
    teamIds: [context.teamId],
    userIds: [
      context.commercialConfig.revenueRecipientUserId,
      context.commercialConfig.billingOwnerUserId,
      userId,
    ].filter(Boolean),
  });

  return {
    userId,
    teamId: context.teamId,
    organizationId: context.organizationId,
    revenueEventId: revenueEvent?.eventId || null,
  };
}

async function handleCoachCheckoutSessionCompleted(session) {
  console.log('[CoachWebhook] Processing coach checkout session completed:', session.id);

  const subscriptionId =
    typeof session.subscription === 'string'
      ? normalizeString(session.subscription)
      : normalizeString(session.subscription?.id);
  if (!subscriptionId) {
    console.warn('[CoachWebhook] checkout.session.completed missing subscription id');
    return null;
  }

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  return syncCoachBillingSubscription(subscription);
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
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
      body: JSON.stringify({ error: `Webhook Error: ${err.message}` }),
    };
  }

  console.log(`[CoachWebhook] Processing webhook event type: ${stripeEvent.type}`);

  try {
    switch (stripeEvent.type) {
      case 'checkout.session.completed': {
        const session = stripeEvent.data.object;
        if (session.metadata?.userType === 'coach') {
          await handleCoachCheckoutSessionCompleted(session);
        } else if (session.metadata?.linkedCoachId) {
          console.log('[CoachWebhook] Ignoring retired athlete->coach linkage event on checkout.session.completed');
        }
        break;
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subscription = stripeEvent.data.object;
        if (subscription.metadata?.userType === 'coach') {
          await syncCoachBillingSubscription(subscription);
        }
        break;
      }
      default:
        console.log(`[CoachWebhook] Unhandled event type: ${stripeEvent.type}`);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ received: true }),
    };
  } catch (error) {
    console.error('[CoachWebhook] Error processing webhook:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};
