const { admin } = require('./config/firebase');
const {
  normalizeString,
  verifyFirebaseUser,
} = require('./lib/pulsecheck-coach-services');

const ACTIVE_ACCESS_STATUSES = new Set(['active', 'trialing']);

function jsonResponse(statusCode, body) {
  return { statusCode, body: JSON.stringify(body) };
}

function permissionError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function errorResponse(error) {
  const statusCode = Number(error?.statusCode) || 500;
  return jsonResponse(statusCode, {
    message: statusCode >= 500
      ? (error?.message || 'Server error')
      : error.message,
  });
}

async function fetchRevenueCatSubscriberWithKey(userId, apiKey, projectLabel, projectId) {
  const url = projectId
    ? `https://api.revenuecat.com/v2/projects/${encodeURIComponent(projectId)}/customers/${encodeURIComponent(userId)}`
    : `https://api.revenuecat.com/v2/customers/${encodeURIComponent(userId)}`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/json',
    },
  });

  if (response.status === 404) {
    console.warn(`[SyncRevenueCat] ${projectLabel} customer not found`, { userId });
    return null;
  }
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`RevenueCat V2 error ${response.status}: ${text}`);
  }
  return response.json();
}

function normalizedEmail(value) {
  return normalizeString(value).toLowerCase();
}

function addIdentity(target, value) {
  const identity = normalizeString(value);
  if (identity) target.add(identity);
}

function addIdentityValues(target, value) {
  if (Array.isArray(value)) {
    value.forEach((candidate) => {
      if (typeof candidate === 'string') addIdentity(target, candidate);
      else addIdentity(target, candidate?.id || candidate?.value || candidate?.app_user_id);
    });
    return;
  }
  addIdentity(target, value);
}

function revenueCatCustomer(rcJson) {
  return rcJson?.customer || rcJson?.subscriber || rcJson || {};
}

function extractRevenueCatIdentity(rcJson) {
  const customer = revenueCatCustomer(rcJson);
  const ids = new Set();
  addIdentity(ids, customer.id);
  addIdentity(ids, customer.app_user_id);
  addIdentity(ids, customer.original_app_user_id);
  addIdentityValues(ids, customer.aliases);
  addIdentityValues(ids, customer.app_user_ids);

  const attributes = customer.attributes || customer.subscriber_attributes || {};
  const email = normalizedEmail(
    attributes.email?.value
    || attributes.email_address?.value
    || attributes['E - mail']?.value
  );
  return { ids, email };
}

function responseBelongsToAuthenticatedUser(rcJson, trustedIds, verifiedEmail) {
  const identity = extractRevenueCatIdentity(rcJson);
  if (Array.from(identity.ids).some((id) => trustedIds.has(id))) return true;
  if (
    verifiedEmail
    && Array.from(identity.ids).some((id) => (
      id.includes('@') && normalizedEmail(id) === verifiedEmail
    ))
  ) return true;
  return Boolean(verifiedEmail && identity.email && identity.email === verifiedEmail);
}

function toDate(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'number') {
    const millis = value > 10_000_000_000 ? value : value * 1000;
    const date = new Date(millis);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function recordHasActiveAccess(record) {
  if (!record || typeof record !== 'object') return false;
  if (record.is_active === false) return false;
  if (record.is_active === true) return true;
  const status = normalizeString(record.status || record.state).toLowerCase();
  return ACTIVE_ACCESS_STATUSES.has(status);
}

function collectionEntries(value) {
  if (Array.isArray(value)) {
    return value.map((record, index) => [normalizeString(record?.id) || String(index), record]);
  }
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value);
}

function findLatestActiveRevenueCatAccess(rcJson, now = new Date()) {
  const customer = revenueCatCustomer(rcJson);
  let latest = null;

  const consider = (record, fallbackProductId = '') => {
    if (!recordHasActiveAccess(record)) return;
    const expiration = toDate(
      record.expires_date
      || record.expiration_date
      || record.expires_at
      || record.expiration_at
    );
    if (!expiration || expiration <= now) return;
    const productId = normalizeString(
      record.product_identifier
      || record.productId
      || record.product_id
      || fallbackProductId
    );
    if (!latest || expiration > latest.expiration) {
      latest = { expiration, productId };
    }
  };

  for (const [, entitlement] of collectionEntries(customer.entitlements)) {
    consider(entitlement);
  }
  for (const [productId, subscription] of collectionEntries(customer.subscriptions)) {
    consider(subscription, productId);
  }
  return latest;
}

function planTypeForProduct(productId) {
  switch (normalizeString(productId)) {
    case 'pc_1w':
      return 'pulsecheck-weekly';
    case 'pc_1m':
      return 'pulsecheck-monthly';
    case 'pc_1y':
      return 'pulsecheck-annual';
    default:
      return 'ios-revenuecat';
  }
}

async function loadAuthenticatedRevenueCatContext({ database, userId, decoded }) {
  const [userSnap, directSubscriptionSnap, queriedSubscriptions] = await Promise.all([
    database.collection('users').doc(userId).get(),
    database.collection('subscriptions').doc(userId).get(),
    database.collection('subscriptions').where('userId', '==', userId).get(),
  ]);

  const userData = userSnap.exists ? userSnap.data() || {} : {};
  const trustedIds = new Set();
  addIdentity(trustedIds, userId);

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
    addIdentity(trustedIds, record?.rcAppUserId);
    addIdentityValues(trustedIds, record?.rcAliases);
  }

  const verifiedEmail = decoded?.email_verified === true
    ? normalizedEmail(decoded.email)
    : '';
  if (verifiedEmail) trustedIds.add(verifiedEmail);

  return {
    trustedIds,
    verifiedEmail,
    userData,
  };
}

function getRevenueCatKeyConfigs() {
  const configs = [];
  if (process.env.REVENUECAT_API_KEY_QUICKLIFTS) {
    configs.push({
      key: process.env.REVENUECAT_API_KEY_QUICKLIFTS,
      label: 'quicklifts',
      projectId: process.env.REVENUECAT_PROJECT_ID_QUICKLIFTS || process.env.REVENUECAT_PROJECT_ID,
    });
  }
  if (process.env.REVENUECAT_API_KEY_PULSECHECK) {
    configs.push({
      key: process.env.REVENUECAT_API_KEY_PULSECHECK,
      label: 'pulsecheck',
      projectId: process.env.REVENUECAT_PROJECT_ID_PULSECHECK || process.env.REVENUECAT_PROJECT_ID,
    });
  }
  if (
    process.env.REVENUECAT_API_KEY
    && !configs.some((config) => config.key === process.env.REVENUECAT_API_KEY)
  ) {
    configs.push({
      key: process.env.REVENUECAT_API_KEY,
      label: 'default',
      projectId: process.env.REVENUECAT_PROJECT_ID || null,
    });
  }
  return configs;
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
      authErrorMessage: 'Sign in is required to sync your App Store subscription.',
    });
    const userId = normalizeString(authenticated.userId);
    const requestedUserId = normalizeString(body?.userId);
    if (requestedUserId && requestedUserId !== userId) {
      throw permissionError('You can only sync your own App Store subscription.', 403);
    }

    const keyConfigs = getRevenueCatKeyConfigs();
    if (keyConfigs.length === 0) {
      throw permissionError('RevenueCat subscription sync is not configured.', 503);
    }

    const database = authenticated.app.firestore();
    const { trustedIds, verifiedEmail, userData } = await loadAuthenticatedRevenueCatContext({
      database,
      userId,
      decoded: authenticated.decoded,
    });
    const candidates = Array.from(trustedIds);
    let selected = null;
    let selectedIdentity = null;

    for (const config of keyConfigs) {
      for (const candidate of candidates) {
        try {
          const response = await fetchRevenueCatSubscriberWithKey(
            candidate,
            config.key,
            config.label,
            config.projectId || null
          );
          if (!response) continue;
          if (!responseBelongsToAuthenticatedUser(response, trustedIds, verifiedEmail)) {
            console.warn('[SyncRevenueCat] Ignored customer with conflicting ownership', {
              project: config.label,
              candidate,
              userId,
            });
            continue;
          }

          const activeAccess = findLatestActiveRevenueCatAccess(response);
          if (!activeAccess) continue;
          if (!selected || activeAccess.expiration > selected.activeAccess.expiration) {
            selected = { config, response, activeAccess };
            selectedIdentity = extractRevenueCatIdentity(response);
          }
          break;
        } catch (error) {
          console.warn('[SyncRevenueCat] Customer lookup failed', {
            project: config.label,
            candidate,
            message: error.message,
          });
        }
      }
    }

    if (!selected) {
      return jsonResponse(200, {
        message: 'No active server-linked RevenueCat entitlement found',
        userId,
      });
    }

    const nowSec = Math.floor(Date.now() / 1000);
    const expirationSec = Math.floor(selected.activeAccess.expiration.getTime() / 1000);
    if (expirationSec <= nowSec) {
      return jsonResponse(200, {
        message: 'No active server-linked RevenueCat entitlement found',
        userId,
      });
    }

    const discoveredIds = Array.from(selectedIdentity?.ids || []);
    const planType = planTypeForProduct(selected.activeAccess.productId);
    const subRef = database.collection('subscriptions').doc(userId);
    await subRef.set({
      userId,
      userEmail: userData?.email || null,
      username: userData?.username || null,
      platform: 'ios',
      source: 'revenuecat',
      sourceProject: selected.config.label,
      rcAppUserId: discoveredIds[0] || userId,
      rcAliases: discoveredIds,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    const snap = await subRef.get();
    const subscriptionData = snap.data() || {};
    const plans = Array.isArray(subscriptionData.plans) ? subscriptionData.plans : [];
    const latestSame = plans
      .filter((plan) => plan && plan.type === planType)
      .reduce((latest, plan) => {
        const expiration = typeof plan.expiration === 'number' ? plan.expiration : 0;
        return Math.max(latest, expiration);
      }, 0);

    if (Math.abs(latestSame - expirationSec) >= 1) {
      await subRef.update({
        plans: admin.firestore.FieldValue.arrayUnion({
          type: planType,
          expiration: expirationSec,
          createdAt: nowSec,
          updatedAt: nowSec,
          platform: 'ios',
          productId: selected.activeAccess.productId || null,
        }),
      });
    }

    await database.collection('users').doc(userId).set({
      revenuecat: {
        appUserId: discoveredIds[0] || userId,
        aliases: discoveredIds,
        email: selectedIdentity?.email || userData?.email || null,
        lastSyncedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
    }, { merge: true });

    return jsonResponse(200, {
      message: 'Synced',
      latestExpiration: selected.activeAccess.expiration.toISOString(),
      sourceProject: selected.config.label,
      planType,
    });
  } catch (error) {
    if ((Number(error?.statusCode) || 500) >= 500) {
      console.error('[SyncRevenueCat] Error:', error);
    }
    return errorResponse(error);
  }
};
