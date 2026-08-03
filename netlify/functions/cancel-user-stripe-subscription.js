const { admin } = require('./config/firebase');
const {
  emptyResponse,
  errorResponse,
  jsonResponse,
  loadOwnedStripeSubscriptions,
  permissionError,
  serializeSubscription,
} = require('./lib/user-stripe-subscription-access');

const CANCELABLE_STATUSES = new Set(['active', 'trialing', 'past_due', 'unpaid']);
const TERMINAL_STATUSES = new Set(['canceled', 'incomplete_expired']);

const normalizeString = (value) => (typeof value === 'string' ? value.trim() : '');

const parseBody = (event) => {
  try {
    return JSON.parse(event.body || '{}');
  } catch (_error) {
    throw permissionError('Invalid JSON.', 400);
  }
};

const markCancellationRequested = async ({
  database,
  userId,
  subscriptionId,
  customerId,
  updatedSubscription,
}) => {
  const now = admin.firestore.FieldValue.serverTimestamp();
  const currentPeriodEnd = Math.floor(Number(updatedSubscription?.current_period_end) || 0) || null;
  const status = normalizeString(updatedSubscription?.status).toLowerCase() || null;
  const subscriptionPayload = {
    cancelAtPeriodEnd: Boolean(updatedSubscription?.cancel_at_period_end),
    cancellationRequestedAt: now,
    currentPeriodEnd,
    status,
    stripeCustomerId: customerId || null,
    stripeSubscriptionId: subscriptionId,
    updatedAt: now,
  };

  const userPayload = {
    stripeSubscriptionCancelAtPeriodEnd: Boolean(updatedSubscription?.cancel_at_period_end),
    stripeSubscriptionCancellationRequestedAt: now,
    updatedAt: now,
  };

  const batch = database.batch();
  batch.set(database.collection('users').doc(userId), userPayload, { merge: true });
  batch.set(database.collection('subscriptions').doc(userId), subscriptionPayload, { merge: true });

  const matchingSubscriptionDocs = await database
    .collection('subscriptions')
    .where('stripeSubscriptionId', '==', subscriptionId)
    .get();

  for (const doc of matchingSubscriptionDocs.docs || []) {
    batch.set(doc.ref, subscriptionPayload, { merge: true });
  }

  await batch.commit();
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return emptyResponse();
  }

  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { message: 'Method Not Allowed' });
  }

  try {
    const body = parseBody(event);
    const requestedSubscriptionId = normalizeString(body?.subscriptionId);
    if (!requestedSubscriptionId) {
      throw permissionError('A subscription id is required.', 400);
    }

    const {
      database,
      stripe,
      userId,
      ownedSubscriptions,
    } = await loadOwnedStripeSubscriptions(event);

    const match = ownedSubscriptions.find(
      ({ subscriptionId }) => subscriptionId === requestedSubscriptionId
    );
    if (!match) {
      throw permissionError('This subscription was not found on your account.', 404);
    }

    const currentStatus = normalizeString(match.subscription?.status).toLowerCase();
    if (TERMINAL_STATUSES.has(currentStatus)) {
      return jsonResponse(200, {
        message: 'This subscription is already canceled.',
        subscription: serializeSubscription(match.subscription),
      });
    }

    if (!CANCELABLE_STATUSES.has(currentStatus)) {
      throw permissionError('This subscription cannot be canceled from the self-service page yet.', 409);
    }

    let updatedSubscription = match.subscription;
    if (!updatedSubscription.cancel_at_period_end) {
      updatedSubscription = await stripe.subscriptions.update(
        requestedSubscriptionId,
        { cancel_at_period_end: true },
        { idempotencyKey: `cancel-renewal:${userId}:${requestedSubscriptionId}` }
      );
      updatedSubscription = await stripe.subscriptions.retrieve(requestedSubscriptionId, {
        expand: ['items.data.price.product'],
      });
    }

    await markCancellationRequested({
      database,
      userId,
      subscriptionId: requestedSubscriptionId,
      customerId: match.customerId,
      updatedSubscription,
    });

    return jsonResponse(200, {
      message: 'Your subscription renewal has been canceled. Access stays active until the current billing period ends.',
      subscription: serializeSubscription(updatedSubscription),
    });
  } catch (error) {
    if ((Number(error?.statusCode) || 500) >= 500) {
      console.error('[CancelUserStripeSubscription] Error:', error);
    }
    return errorResponse(error);
  }
};
