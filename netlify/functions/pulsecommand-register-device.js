const crypto = require('crypto');
const { admin, headers, initializeFirebaseAdmin } = require('./config/firebase');

const DEVICES_COLLECTION = 'pulsecommand-operator-devices';

const jsonHeaders = {
  ...headers,
  'Content-Type': 'application/json',
};

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeBoolean(value, fallback = null) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true' || normalized === '1') return true;
    if (normalized === 'false' || normalized === '0') return false;
  }
  return fallback;
}

function stableHash(value) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex').slice(0, 32);
}

function resolveDeviceDocId(body = {}) {
  const deviceId = normalizeString(body.deviceId);
  if (deviceId) return deviceId.replace(/[^A-Za-z0-9_.-]/g, '_').slice(0, 120);

  const token = normalizeString(body.fcmToken);
  if (token) return `token_${stableHash(token)}`;

  const fallback = [
    normalizeString(body.bundleId),
    normalizeString(body.deviceName),
    normalizeString(body.deviceModel),
    normalizeString(body.systemVersion),
  ].filter(Boolean).join('|');

  return `device_${stableHash(fallback || Date.now())}`;
}

function buildDevicePayload(body = {}) {
  const FieldValue = admin.firestore.FieldValue;
  const fcmToken = normalizeString(body.fcmToken);
  const notificationsAuthorized = normalizeBoolean(body.notificationsAuthorized);
  const authorizationRequested = normalizeBoolean(body.notificationsAuthorizationRequested);

  const payload = {
    ownerId: 'admin',
    app: 'PulseCommand',
    platform: normalizeString(body.platform) || 'ios',
    bundleId: normalizeString(body.bundleId),
    deviceName: normalizeString(body.deviceName),
    deviceModel: normalizeString(body.deviceModel),
    systemName: normalizeString(body.systemName),
    systemVersion: normalizeString(body.systemVersion),
    appVersion: normalizeString(body.appVersion),
    buildNumber: normalizeString(body.buildNumber),
    enabled: body.enabled === false ? false : true,
    clientUpdatedAt: normalizeString(body.clientUpdatedAt),
    updatedAt: FieldValue.serverTimestamp(),
  };

  if (fcmToken) {
    payload.fcmToken = fcmToken;
    payload.tokenPreview = `${fcmToken.slice(0, 18)}...`;
    payload.tokenUpdatedAt = FieldValue.serverTimestamp();
  }

  if (notificationsAuthorized !== null) {
    payload.notificationsAuthorized = notificationsAuthorized;
    payload.authorizationUpdatedAt = FieldValue.serverTimestamp();
  }

  if (authorizationRequested !== null) {
    payload.notificationsAuthorizationRequested = authorizationRequested;
    payload.registrationAttemptedAt = FieldValue.serverTimestamp();
  }

  return payload;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: jsonHeaders, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: jsonHeaders,
      body: JSON.stringify({ success: false, error: 'Method not allowed' }),
    };
  }

  try {
    initializeFirebaseAdmin({ headers: event.headers || {} });
    const db = admin.firestore();
    const body = event.body ? JSON.parse(event.body) : {};
    const bundleId = normalizeString(body.bundleId);

    if (bundleId && bundleId !== 'com.fitwithpulse.command') {
      return {
        statusCode: 400,
        headers: jsonHeaders,
        body: JSON.stringify({ success: false, error: 'Invalid PulseCommand bundle id' }),
      };
    }

    const docId = resolveDeviceDocId(body);
    const payload = buildDevicePayload(body);
    const docRef = db.collection(DEVICES_COLLECTION).doc(docId);
    const snap = await docRef.get();

    await docRef.set({
      ...payload,
      createdAt: snap.exists ? (snap.data() || {}).createdAt || admin.firestore.FieldValue.serverTimestamp() : admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    return {
      statusCode: 200,
      headers: jsonHeaders,
      body: JSON.stringify({
        success: true,
        deviceId: docId,
        registered: true,
        hasToken: Boolean(payload.fcmToken),
      }),
    };
  } catch (error) {
    console.error('[pulsecommand-register-device] Error:', error);
    return {
      statusCode: 500,
      headers: jsonHeaders,
      body: JSON.stringify({
        success: false,
        error: error.message || 'Failed to register PulseCommand device',
      }),
    };
  }
};
