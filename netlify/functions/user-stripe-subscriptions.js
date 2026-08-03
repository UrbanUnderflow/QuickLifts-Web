const {
  emptyResponse,
  errorResponse,
  jsonResponse,
  loadOwnedStripeSubscriptions,
  serializeSubscription,
} = require('./lib/user-stripe-subscription-access');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return emptyResponse();
  }

  if (event.httpMethod !== 'GET' && event.httpMethod !== 'POST') {
    return jsonResponse(405, { message: 'Method Not Allowed' });
  }

  try {
    const {
      stripeMode,
      userId,
      userData,
      ownedSubscriptions,
    } = await loadOwnedStripeSubscriptions(event);

    return jsonResponse(200, {
      stripeMode,
      userId,
      email: userData?.email || null,
      subscriptions: ownedSubscriptions.map(({ subscription }) => serializeSubscription(subscription)),
    });
  } catch (error) {
    if ((Number(error?.statusCode) || 500) >= 500) {
      console.error('[UserStripeSubscriptions] Error:', error);
    }
    return errorResponse(error);
  }
};
