const Stripe = require('stripe');
const { headers } = require('../config/firebase');
const {
  normalizeString,
  resolveServerStripeMode,
  verifyFirebaseUser,
} = require('./pulsecheck-coach-services');

const OWNERSHIP_METADATA_KEYS = [
  'userId',
  'user_id',
  'firebaseUid',
  'firebase_uid',
  'firebaseUserId',
  'athleteUserId',
  'subscriberUserId',
  'client_reference',
  'client_reference_id',
  'clientReference',
  'clientReferenceId',
];

const responseHeaders = {
  ...headers,
  'Content-Type': 'application/json',
};

const jsonResponse = (statusCode, body) => ({
  statusCode,
  headers: responseHeaders,
  body: JSON.stringify(body),
});

const emptyResponse = (statusCode = 204) => ({
  statusCode,
  headers: responseHeaders,
  body: '',
});

const errorResponse = (error) => {
  const statusCode = Number(error?.statusCode) || 500;
  return jsonResponse(statusCode, {
    message: statusCode >= 500
      ? (error?.message || 'Server error')
      : error.message,
  });
};

const permissionError = (message, statusCode = 403) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const getStripeClient = () => {
  const mode = resolveServerStripeMode();
  const key = mode === 'test'
    ? process.env.STRIPE_TEST_SECRET_KEY
    : process.env.STRIPE_SECRET_KEY;

  if (!key) {
    throw permissionError('Stripe subscription management is not configured.', 503);
  }

  return {
    mode,
    stripe: new Stripe(key),
  };
};

const stripeObjectId = (value) => (
  typeof value === 'string'
    ? normalizeString(value)
    : normalizeString(value?.id)
);

const addString = (target, value) => {
  const normalized = normalizeString(value);
  if (normalized) target.add(normalized);
};

const addModeSpecificIds = (target, value, stripeMode) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return;
  addString(target, value[stripeMode]);
};

const addSubscriptionRecordBindings = ({
  record,
  customerIds,
  subscriptionIds,
  stripeMode,
}) => {
  addString(customerIds, record?.stripeCustomerId);
  addModeSpecificIds(customerIds, record?.stripeCustomerIds, stripeMode);
  addString(subscriptionIds, record?.stripeSubscriptionId);
  if (Array.isArray(record?.stripeSubscriptionIds)) {
    record.stripeSubscriptionIds.forEach((id) => addString(subscriptionIds, id));
  } else {
    addModeSpecificIds(subscriptionIds, record?.stripeSubscriptionIds, stripeMode);
  }
};

const loadAuthenticatedBillingBindings = async ({ database, userId, stripeMode }) => {
  const userRef = database.collection('users').doc(userId);
  const directSubscriptionRef = database.collection('subscriptions').doc(userId);
  const [userSnap, directSubscriptionSnap, queriedSubscriptions] = await Promise.all([
    userRef.get(),
    directSubscriptionRef.get(),
    database.collection('subscriptions').where('userId', '==', userId).get(),
  ]);

  const userData = userSnap.exists ? userSnap.data() || {} : {};
  const customerIds = new Set();
  const subscriptionIds = new Set();
  const trustedCustomerIds = new Set();
  const trustedSubscriptionIds = new Set();

  addSubscriptionRecordBindings({
    record: userData,
    customerIds,
    subscriptionIds,
    stripeMode,
  });

  const subscriptionRecords = new Map();
  if (directSubscriptionSnap.exists) {
    subscriptionRecords.set(directSubscriptionSnap.id, directSubscriptionSnap.data() || {});
  }

  for (const doc of queriedSubscriptions.docs || []) {
    subscriptionRecords.set(doc.id, doc.data() || {});
  }

  for (const [recordId, record] of subscriptionRecords) {
    const recordUserId = normalizeString(record?.userId);
    if (recordUserId && recordUserId !== userId) {
      if (recordId === userId) {
        throw permissionError('The stored subscription belongs to a different user.', 409);
      }
      continue;
    }

    addSubscriptionRecordBindings({
      record,
      customerIds,
      subscriptionIds,
      stripeMode,
    });
    addSubscriptionRecordBindings({
      record,
      customerIds: trustedCustomerIds,
      subscriptionIds: trustedSubscriptionIds,
      stripeMode,
    });
  }

  return {
    customerIds,
    subscriptionIds,
    trustedCustomerIds,
    trustedSubscriptionIds,
    userData,
  };
};

const ownershipMarkers = (value) => {
  if (!value || typeof value !== 'object') return [];
  const containers = [value, value.metadata];
  const markers = [];

  for (const container of containers) {
    if (!container || typeof container !== 'object') continue;
    for (const key of OWNERSHIP_METADATA_KEYS) {
      const marker = normalizeString(container[key]);
      if (marker) markers.push(marker);
    }
  }

  return markers;
};

const ownershipMetadataStatus = (value, userId) => {
  const markers = ownershipMarkers(value);
  return {
    present: markers.length > 0,
    valid: markers.length === 0 || markers.every((marker) => marker === userId),
  };
};

const loadCandidateSubscriptions = async ({ stripe, customerIds, subscriptionIds }) => {
  const candidates = new Map();
  const expand = ['items.data.price.product'];

  for (const subscriptionId of subscriptionIds) {
    try {
      const subscription = await stripe.subscriptions.retrieve(subscriptionId, { expand });
      if (subscription?.id) candidates.set(subscription.id, subscription);
    } catch (error) {
      if (error?.code !== 'resource_missing') throw error;
    }
  }

  for (const customerId of customerIds) {
    let startingAfter = null;
    do {
      const result = await stripe.subscriptions.list({
        customer: customerId,
        status: 'all',
        limit: 100,
        ...(startingAfter ? { starting_after: startingAfter } : {}),
        expand: ['data.items.data.price.product'],
      });

      for (const subscription of result?.data || []) {
        if (subscription?.id) candidates.set(subscription.id, subscription);
      }

      const data = Array.isArray(result?.data) ? result.data : [];
      startingAfter = result?.has_more && data.length > 0
        ? data[data.length - 1].id
        : null;
    } while (startingAfter);
  }

  return Array.from(candidates.values());
};

const getVerifiedCustomer = async ({ stripe, customerId, customerCache, userId }) => {
  if (!customerId) return null;
  if (!customerCache.has(customerId)) {
    try {
      customerCache.set(customerId, await stripe.customers.retrieve(customerId));
    } catch (error) {
      if (error?.code === 'resource_missing') return null;
      throw error;
    }
  }

  const customer = customerCache.get(customerId);
  const metadataStatus = ownershipMetadataStatus(customer, userId);
  if (
    !customer
    || customer.deleted === true
    || normalizeString(customer.id) !== customerId
    || !metadataStatus.valid
  ) {
    return null;
  }

  return { customer, metadataStatus };
};

const filterOwnedSubscriptions = async ({
  stripe,
  candidates,
  customerIds,
  subscriptionIds,
  trustedCustomerIds,
  trustedSubscriptionIds,
  userId,
}) => {
  const customerCache = new Map();
  const owned = [];

  for (const subscription of candidates) {
    const subscriptionId = normalizeString(subscription?.id);
    const customerId = stripeObjectId(subscription?.customer);
    const isServerBound = subscriptionIds.has(subscriptionId) || customerIds.has(customerId);
    if (!subscriptionId || !customerId || !isServerBound) continue;

    const subscriptionMetadata = ownershipMetadataStatus(subscription, userId);
    if (!subscriptionMetadata.valid) continue;

    const verifiedCustomer = await getVerifiedCustomer({
      stripe,
      customerId,
      customerCache,
      userId,
    });
    if (!verifiedCustomer) continue;

    const hasTrustedFirestoreBinding = (
      trustedSubscriptionIds.has(subscriptionId)
      || trustedCustomerIds.has(customerId)
    );

    if (
      !hasTrustedFirestoreBinding
      && !subscriptionMetadata.present
      && !verifiedCustomer.metadataStatus.present
    ) continue;

    owned.push({
      subscription,
      subscriptionId,
      customerId,
      hasTrustedFirestoreBinding,
    });
  }

  return owned.sort((left, right) => {
    const leftActive = ['active', 'trialing'].includes(normalizeString(left.subscription?.status).toLowerCase()) ? 1 : 0;
    const rightActive = ['active', 'trialing'].includes(normalizeString(right.subscription?.status).toLowerCase()) ? 1 : 0;
    if (leftActive !== rightActive) return rightActive - leftActive;
    return (Number(right.subscription?.current_period_end) || 0) - (Number(left.subscription?.current_period_end) || 0);
  });
};

const loadOwnedStripeSubscriptions = async (event) => {
  const authenticated = await verifyFirebaseUser(event, {
    authErrorMessage: 'Sign in is required to manage your Stripe subscription.',
  });
  const userId = normalizeString(authenticated.userId);
  const database = authenticated.app.firestore();
  const { stripe, mode: stripeMode } = getStripeClient();
  const bindings = await loadAuthenticatedBillingBindings({
    database,
    userId,
    stripeMode,
  });

  if (bindings.customerIds.size === 0 && bindings.subscriptionIds.size === 0) {
    return {
      database,
      stripe,
      stripeMode,
      userId,
      userData: bindings.userData,
      ownedSubscriptions: [],
    };
  }

  const candidates = await loadCandidateSubscriptions({
    stripe,
    customerIds: bindings.customerIds,
    subscriptionIds: bindings.subscriptionIds,
  });
  const ownedSubscriptions = await filterOwnedSubscriptions({
    stripe,
    candidates,
    customerIds: bindings.customerIds,
    subscriptionIds: bindings.subscriptionIds,
    trustedCustomerIds: bindings.trustedCustomerIds,
    trustedSubscriptionIds: bindings.trustedSubscriptionIds,
    userId,
  });

  return {
    database,
    stripe,
    stripeMode,
    userId,
    userData: bindings.userData,
    ownedSubscriptions,
  };
};

const timestampToIso = (value) => {
  const numeric = Math.floor(Number(value) || 0);
  return numeric > 0 ? new Date(numeric * 1000).toISOString() : null;
};

const serializeSubscription = (subscription) => {
  const lineItem = subscription?.items?.data?.[0] || {};
  const price = lineItem.price || {};
  const product = price.product || {};
  const productName = (
    typeof product === 'object'
    && product
    && product.deleted !== true
  )
    ? normalizeString(product.name)
    : '';
  const metadata = subscription?.metadata || {};
  const teamId = normalizeString(metadata.pulsecheckTeamId || metadata.teamId);
  const organizationId = normalizeString(metadata.pulsecheckOrganizationId || metadata.organizationId);
  const offerId = normalizeString(metadata.pulsecheckOfferId || metadata.offerId);
  const status = normalizeString(subscription?.status).toLowerCase();
  const amountCents = Number.isFinite(Number(price.unit_amount))
    ? Number(price.unit_amount)
    : Number(lineItem.plan?.amount) || 0;
  const currency = normalizeString(price.currency || lineItem.plan?.currency || 'usd').toUpperCase();
  const interval = normalizeString(price.recurring?.interval || lineItem.plan?.interval);

  return {
    id: normalizeString(subscription?.id),
    status,
    cancelAtPeriodEnd: Boolean(subscription?.cancel_at_period_end),
    currentPeriodStart: Number(subscription?.current_period_start) || null,
    currentPeriodStartIso: timestampToIso(subscription?.current_period_start),
    currentPeriodEnd: Number(subscription?.current_period_end) || null,
    currentPeriodEndIso: timestampToIso(subscription?.current_period_end),
    cancelAt: Number(subscription?.cancel_at) || null,
    cancelAtIso: timestampToIso(subscription?.cancel_at),
    canceledAt: Number(subscription?.canceled_at) || null,
    canceledAtIso: timestampToIso(subscription?.canceled_at),
    customerId: stripeObjectId(subscription?.customer),
    priceId: normalizeString(price.id),
    productId: stripeObjectId(product),
    productName: productName || normalizeString(metadata.productName) || 'Pulse subscription',
    amountCents,
    currency,
    interval,
    pulseCheckTeamId: teamId || null,
    pulseCheckOrganizationId: organizationId || null,
    pulseCheckOfferId: offerId || null,
    sourceLabel: teamId
      ? 'PulseCheck team subscription'
      : normalizeString(metadata.sourceLabel) || 'Pulse subscription',
  };
};

module.exports = {
  emptyResponse,
  errorResponse,
  jsonResponse,
  loadOwnedStripeSubscriptions,
  permissionError,
  serializeSubscription,
};
