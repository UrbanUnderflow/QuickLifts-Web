const Stripe = require('stripe');
const { admin } = require('./config/firebase');
const {
  normalizeString,
  resolveServerStripeMode,
  verifyFirebaseUser,
} = require('./lib/pulsecheck-coach-services');

const ACTIVE_ACCESS_STATUSES = new Set(['active', 'trialing']);
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

function jsonResponse(statusCode, body) {
  return { statusCode, body: JSON.stringify(body) };
}

function errorResponse(error) {
  const statusCode = Number(error?.statusCode) || 500;
  return jsonResponse(statusCode, {
    message: statusCode >= 500
      ? (error?.message || 'Server error')
      : error.message,
  });
}

function permissionError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function getStripeClient() {
  const mode = resolveServerStripeMode();
  const key = mode === 'test'
    ? process.env.STRIPE_TEST_SECRET_KEY
    : process.env.STRIPE_SECRET_KEY;
  if (!key) throw permissionError('Stripe subscription sync is not configured.', 503);
  return { stripe: new Stripe(key), mode };
}

function mapPriceIdToPlanType(priceId) {
  const LIVE_MONTHLY_PRICE_ID = 'price_1TfN9QIkArZc741WdNmcTHPv';
  const LIVE_ANNUAL_PRICE_ID = 'price_1TfN8cIkArZc741WskOfYXhL';
  const TEST_MONTHLY_PRICE_ID = 'price_1TfOBPIkArZc741WGAWleQke';
  const TEST_ANNUAL_PRICE_ID = 'price_1TfOBPIkArZc741WwYxdNa8Q';
  const map = {
    [LIVE_MONTHLY_PRICE_ID]: 'pulsecheck-monthly',
    [LIVE_ANNUAL_PRICE_ID]: 'pulsecheck-annual',
    [TEST_MONTHLY_PRICE_ID]: 'pulsecheck-monthly',
    [TEST_ANNUAL_PRICE_ID]: 'pulsecheck-annual',
  };
  return map[normalizeString(priceId)];
}

function stripeObjectId(value) {
  return typeof value === 'string'
    ? normalizeString(value)
    : normalizeString(value?.id);
}

function addString(target, value) {
  const normalized = normalizeString(value);
  if (normalized) target.add(normalized);
}

function addModeSpecificIds(target, value, stripeMode) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return;
  addString(target, value[stripeMode]);
}

function addSubscriptionRecordBindings({
  record,
  customerIds,
  subscriptionIds,
  stripeMode,
}) {
  addString(customerIds, record?.stripeCustomerId);
  addModeSpecificIds(customerIds, record?.stripeCustomerIds, stripeMode);
  addString(subscriptionIds, record?.stripeSubscriptionId);
  if (Array.isArray(record?.stripeSubscriptionIds)) {
    record.stripeSubscriptionIds.forEach((id) => addString(subscriptionIds, id));
  } else {
    addModeSpecificIds(subscriptionIds, record?.stripeSubscriptionIds, stripeMode);
  }
}

async function loadAuthenticatedBillingBindings({ database, userId, stripeMode }) {
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
}

function ownershipMarkers(value) {
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
}

function ownershipMetadataStatus(value, userId) {
  const markers = ownershipMarkers(value);
  return {
    present: markers.length > 0,
    valid: markers.length === 0 || markers.every((marker) => marker === userId),
  };
}

async function loadCandidateSubscriptions({ stripe, customerIds, subscriptionIds }) {
  const candidates = new Map();

  for (const subscriptionId of subscriptionIds) {
    try {
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      if (subscription?.id) candidates.set(subscription.id, subscription);
    } catch (error) {
      if (error?.code !== 'resource_missing') throw error;
    }
  }

  for (const customerId of customerIds) {
    const result = await stripe.subscriptions.list({ customer: customerId, limit: 100 });
    for (const subscription of result?.data || []) {
      if (subscription?.id) candidates.set(subscription.id, subscription);
    }
  }

  return Array.from(candidates.values());
}

async function getVerifiedCustomer({ stripe, customerId, customerCache, userId }) {
  if (!customerId) return null;
  if (!customerCache.has(customerId)) {
    customerCache.set(customerId, await stripe.customers.retrieve(customerId));
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
}

async function selectActiveOwnedSubscription({
  stripe,
  candidates,
  customerIds,
  subscriptionIds,
  trustedCustomerIds,
  trustedSubscriptionIds,
  userId,
  nowSec,
}) {
  const customerCache = new Map();
  let selected = null;

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

    const status = normalizeString(subscription.status).toLowerCase();
    const expiration = Number(subscription.current_period_end) || 0;
    if (!ACTIVE_ACCESS_STATUSES.has(status) || expiration <= nowSec) continue;

    const priceId = normalizeString(subscription.items?.data?.[0]?.price?.id);
    const planType = mapPriceIdToPlanType(priceId);
    if (!planType) continue;

    if (!selected || expiration > selected.expiration) {
      selected = {
        subscription,
        subscriptionId,
        customerId,
        status,
        expiration,
        priceId,
        planType,
      };
    }
  }

  return selected;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { message: 'Method Not Allowed' });
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (_error) {
    return jsonResponse(400, { message: 'Invalid JSON' });
  }

  try {
    const authenticated = await verifyFirebaseUser(event, {
      authErrorMessage: 'Sign in is required to sync your Stripe subscription.',
    });
    const userId = normalizeString(authenticated.userId);
    const requestedUserId = normalizeString(body?.userId);
    if (requestedUserId && requestedUserId !== userId) {
      throw permissionError('You can only sync your own Stripe subscription.', 403);
    }

    const database = authenticated.app.firestore();
    const { stripe, mode: stripeMode } = getStripeClient();
    const {
      customerIds,
      subscriptionIds,
      trustedCustomerIds,
      trustedSubscriptionIds,
      userData,
    } = await loadAuthenticatedBillingBindings({
      database,
      userId,
      stripeMode,
    });

    if (customerIds.size === 0 && subscriptionIds.size === 0) {
      return jsonResponse(200, {
        message: 'No server-linked Stripe subscription found',
        userId,
      });
    }

    const candidates = await loadCandidateSubscriptions({
      stripe,
      customerIds,
      subscriptionIds,
    });
    const nowSec = Math.floor(Date.now() / 1000);
    const selected = await selectActiveOwnedSubscription({
      stripe,
      candidates,
      customerIds,
      subscriptionIds,
      trustedCustomerIds,
      trustedSubscriptionIds,
      userId,
      nowSec,
    });

    if (!selected) {
      return jsonResponse(200, {
        message: 'No active server-linked Stripe subscription found',
        userId,
      });
    }

    const subRef = database.collection('subscriptions').doc(userId);
    await subRef.set({
      userId,
      username: userData?.username || null,
      userEmail: userData?.email || null,
      platform: 'web',
      source: 'stripe-sync',
      stripeCustomerId: selected.customerId,
      stripeSubscriptionId: selected.subscriptionId,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    const snap = await subRef.get();
    const data = snap.data() || {};
    const plans = Array.isArray(data.plans) ? data.plans : [];
    const latestSame = plans
      .filter((plan) => plan && plan.type === selected.planType)
      .reduce((latest, plan) => {
        const expiration = typeof plan.expiration === 'number' ? plan.expiration : 0;
        return Math.max(latest, expiration);
      }, 0);

    if (Math.abs(latestSame - selected.expiration) >= 1) {
      await subRef.update({
        plans: admin.firestore.FieldValue.arrayUnion({
          type: selected.planType,
          expiration: selected.expiration,
          createdAt: nowSec,
          updatedAt: nowSec,
          platform: 'web',
          productId: selected.priceId,
        }),
      });
    }

    return jsonResponse(200, {
      message: 'Synced',
      latestEnd: new Date(selected.expiration * 1000).toISOString(),
      latestStatus: selected.status,
      planType: selected.planType,
    });
  } catch (error) {
    if ((Number(error?.statusCode) || 500) >= 500) {
      console.error('[SyncStripe] Error:', error);
    }
    return errorResponse(error);
  }
};
