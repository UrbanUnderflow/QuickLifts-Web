const crypto = require('crypto');
const { initializeFirebaseAdmin, admin } = require('./config/firebase');
const { RESPONSE_HEADERS } = require('./google-health-utils');

const WEBHOOK_EVENTS_COLLECTION = 'google-health-webhook-events';
const CONNECTIONS_COLLECTION = 'health-provider-connections';
const HEALTH_CONTEXT_JOBS_COLLECTION = 'health-context-jobs';
const GOOGLE_HEALTH_WEBHOOK_KEYSET_URL =
  'https://www.gstatic.com/googlehealthapi/webhooks/webhooks_public_keyset.json';

let cachedKeyset = null;
let cachedKeysetFetchedAt = 0;

function getRawBody(event) {
  if (!event?.body) return '';
  if (event.isBase64Encoded) return Buffer.from(event.body, 'base64').toString('utf8');
  return typeof event.body === 'string' ? event.body : JSON.stringify(event.body);
}

function getHeader(headers, name) {
  const normalizedName = name.toLowerCase();
  const entry = Object.entries(headers || {}).find(([key]) => key.toLowerCase() === normalizedName);
  return entry ? String(entry[1] || '') : '';
}

function timingSafeEqualString(left, right) {
  const leftBuffer = Buffer.from(String(left || ''));
  const rightBuffer = Buffer.from(String(right || ''));
  if (leftBuffer.length !== rightBuffer.length) return false;
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function expectedAuthorizationValues() {
  const explicit = String(process.env.GOOGLE_HEALTH_WEBHOOK_AUTHORIZATION || '').trim();
  const secret = String(process.env.GOOGLE_HEALTH_WEBHOOK_SECRET || '').trim();
  return [
    explicit,
    secret ? `Bearer ${secret}` : '',
    secret,
  ].filter(Boolean);
}

function verifyWebhookAuthorization(event) {
  const expectedValues = expectedAuthorizationValues();
  if (expectedValues.length === 0) return { ok: true, required: false, mode: 'not_configured' };
  const authorization = getHeader(event.headers, 'authorization');
  const ok = expectedValues.some((expected) => timingSafeEqualString(authorization, expected));
  return { ok, required: true, mode: ok ? 'endpoint_authorization' : 'invalid_authorization' };
}

function base64Url(buffer) {
  return Buffer.from(buffer)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function readProtoVarint(buffer, startOffset) {
  let result = 0;
  let shift = 0;
  let offset = startOffset;
  while (offset < buffer.length) {
    const byte = buffer[offset];
    result += (byte & 0x7f) * (2 ** shift);
    offset += 1;
    if ((byte & 0x80) === 0) return { value: result, offset };
    shift += 7;
  }
  throw new Error('Invalid protobuf varint.');
}

function parseProtoFields(buffer) {
  const fields = new Map();
  let offset = 0;
  while (offset < buffer.length) {
    const key = readProtoVarint(buffer, offset);
    offset = key.offset;
    const fieldNumber = key.value >> 3;
    const wireType = key.value & 0x07;
    let value;

    if (wireType === 0) {
      const decoded = readProtoVarint(buffer, offset);
      value = decoded.value;
      offset = decoded.offset;
    } else if (wireType === 1) {
      value = buffer.subarray(offset, offset + 8);
      offset += 8;
    } else if (wireType === 2) {
      const length = readProtoVarint(buffer, offset);
      offset = length.offset;
      value = buffer.subarray(offset, offset + length.value);
      offset += length.value;
    } else if (wireType === 5) {
      value = buffer.subarray(offset, offset + 4);
      offset += 4;
    } else {
      throw new Error(`Unsupported protobuf wire type: ${wireType}`);
    }

    const list = fields.get(fieldNumber) || [];
    list.push(value);
    fields.set(fieldNumber, list);
  }
  return fields;
}

function extractEcdsaPublicKeyCoordinates(serializedPublicKey) {
  const fields = parseProtoFields(Buffer.from(serializedPublicKey));
  const xValues = fields.get(3) || [];
  const yValues = fields.get(4) || [];
  const x = xValues[xValues.length - 1];
  const y = yValues[yValues.length - 1];
  if (!Buffer.isBuffer(x) || !Buffer.isBuffer(y)) {
    throw new Error('Google Health webhook keyset did not contain ECDSA coordinates.');
  }
  return { x, y };
}

function parseTinkSignatureHeader(signatureHeader) {
  const signatureBuffer = Buffer.from(String(signatureHeader || '').trim(), 'base64');
  if (signatureBuffer.length <= 5) {
    throw new Error('Google Health webhook signature is too short.');
  }
  return {
    outputPrefixType: signatureBuffer[0],
    keyId: signatureBuffer.readUInt32BE(1),
    signatureDer: signatureBuffer.subarray(5),
  };
}

async function loadGoogleHealthWebhookKeyset() {
  const now = Date.now();
  if (cachedKeyset && now - cachedKeysetFetchedAt < 30 * 60 * 1000) {
    return cachedKeyset;
  }
  const response = await fetch(GOOGLE_HEALTH_WEBHOOK_KEYSET_URL, {
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    throw new Error(`Google Health webhook keyset fetch failed with status ${response.status}.`);
  }
  cachedKeyset = await response.json();
  cachedKeysetFetchedAt = now;
  return cachedKeyset;
}

async function verifyGoogleHealthSignature(rawBody, signatureHeader) {
  if (!signatureHeader) {
    return { ok: false, required: false, mode: 'missing_signature' };
  }

  try {
    const parsedSignature = parseTinkSignatureHeader(signatureHeader);
    const keyset = await loadGoogleHealthWebhookKeyset();
    const key = (Array.isArray(keyset?.key) ? keyset.key : [])
      .find((entry) => Number(entry?.keyId) === parsedSignature.keyId && String(entry?.status || '').toUpperCase() === 'ENABLED');
    if (!key?.keyData?.value) {
      return { ok: false, required: true, mode: 'key_not_found', keyId: parsedSignature.keyId };
    }

    const coordinates = extractEcdsaPublicKeyCoordinates(Buffer.from(key.keyData.value, 'base64'));
    const publicKey = crypto.createPublicKey({
      key: {
        kty: 'EC',
        crv: 'P-256',
        x: base64Url(coordinates.x),
        y: base64Url(coordinates.y),
      },
      format: 'jwk',
    });
    const ok = crypto.verify('sha256', Buffer.from(rawBody, 'utf8'), publicKey, parsedSignature.signatureDer);
    return {
      ok,
      required: true,
      mode: ok ? 'tink_ecdsa_p256' : 'invalid_signature',
      keyId: parsedSignature.keyId,
      outputPrefixType: parsedSignature.outputPrefixType,
    };
  } catch (error) {
    return {
      ok: false,
      required: true,
      mode: 'signature_verification_error',
      error: error?.message || String(error),
    };
  }
}

function parsePayload(rawBody) {
  if (!rawBody) return {};
  try {
    return JSON.parse(rawBody);
  } catch (error) {
    const err = new Error('Webhook body must be valid JSON.');
    err.statusCode = 400;
    throw err;
  }
}

function isVerificationPayload(payload) {
  return String(payload?.type || '').toLowerCase() === 'verification';
}

function firstString(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return '';
}

function civilDateToDateKey(value) {
  const date = value?.date || value;
  if (!date?.year || !date?.month || !date?.day) return '';
  return [
    String(date.year).padStart(4, '0'),
    String(date.month).padStart(2, '0'),
    String(date.day).padStart(2, '0'),
  ].join('-');
}

function dateKeyFromAny(value) {
  if (!value) return '';
  const raw = typeof value === 'number' && Number.isFinite(value)
    ? new Date(value > 9999999999 ? value : value * 1000)
    : new Date(String(value));
  if (Number.isNaN(raw.getTime())) return '';
  return raw.toISOString().slice(0, 10);
}

function normalizeNotification(payload) {
  const data = payload?.data || payload || {};
  const interval = Array.isArray(data.intervals) ? data.intervals[0] || {} : {};
  const civilStart = interval?.civilDateTimeInterval?.startDateTime;
  return {
    healthUserId: firstString(data.healthUserId, data.health_user_id, payload.healthUserId),
    dataType: firstString(data.dataType, data.data_type, payload.dataType),
    operation: firstString(data.operation, payload.operation) || 'UPSERT',
    subscriptionName: firstString(data.clientProvidedSubscriptionName, data.client_provided_subscription_name, payload.clientProvidedSubscriptionName),
    dateKey: civilDateToDateKey(civilStart)
      || dateKeyFromAny(interval?.physicalTimeInterval?.startTime)
      || dateKeyFromAny(interval?.civilIso8601TimeInterval?.startTime),
  };
}

function buildStableEventId(notification, rawBody) {
  const hash = crypto.createHash('sha256')
    .update(JSON.stringify(notification))
    .update(rawBody)
    .digest('hex')
    .slice(0, 24);
  return `google_health_${hash}`;
}

async function findConnection(healthUserId) {
  if (!healthUserId) return null;
  const snap = await admin.firestore()
    .collection(CONNECTIONS_COLLECTION)
    .where('provider', '==', 'google_health')
    .where('healthUserId', '==', healthUserId)
    .limit(1)
    .get();
  return snap.empty ? null : snap.docs[0];
}

function buildJobId({ userId, dateKey, eventId }) {
  return `google_health_webhook_sync_${userId}_${dateKey || 'latest'}_${eventId.slice(-16)}`;
}

async function persistNotificationAndQueueSync({ notification, rawBody, verification, signatureVerification, signatureHeader }) {
  const now = admin.firestore.FieldValue.serverTimestamp();
  const eventId = buildStableEventId(notification, rawBody);
  const eventRef = admin.firestore().collection(WEBHOOK_EVENTS_COLLECTION).doc(eventId);
  const connectionDoc = await findConnection(notification.healthUserId);
  const connection = connectionDoc?.data() || null;
  const userId = connection?.userId || (connectionDoc?.id ? connectionDoc.id.replace(/_google_health$/, '') : '');
  const batch = admin.firestore().batch();

  batch.set(eventRef, {
    id: eventId,
    provider: 'google_health',
    sourceFamily: 'fitbit',
    receivedAt: now,
    healthUserId: notification.healthUserId || null,
    athleteUserId: userId || null,
    dataType: notification.dataType || null,
    operation: notification.operation || null,
    dateKey: notification.dateKey || null,
    subscriptionName: notification.subscriptionName || null,
    payload: notification,
    rawBody,
    verification,
    signatureVerification,
    signatureHeader: signatureHeader || null,
    status: connectionDoc ? 'matched' : 'unmatched',
  }, { merge: true });

  let jobId = '';
  if (connectionDoc && userId) {
    jobId = buildJobId({ userId, dateKey: notification.dateKey, eventId });
    batch.set(connectionDoc.ref, {
      lastWebhookAt: now,
      lastWebhookDataType: notification.dataType || null,
      lastWebhookOperation: notification.operation || null,
      pendingWebhookSync: true,
      pendingWebhookDateKey: notification.dateKey || null,
      updatedAt: now,
    }, { merge: true });
    batch.set(admin.firestore().collection(HEALTH_CONTEXT_JOBS_COLLECTION).doc(jobId), {
      id: jobId,
      athleteUserId: userId,
      sourceFamily: 'fitbit',
      provider: 'google_health',
      jobType: 'google_health_webhook_sync',
      status: 'queued',
      scheduledAt: now,
      createdAt: now,
      updatedAt: now,
      triggerReason: 'google_health_webhook',
      providerEventId: eventId,
      dataType: notification.dataType || null,
      operation: notification.operation || null,
      snapshotDateKey: notification.dateKey || null,
      healthUserId: notification.healthUserId || connection?.healthUserId || null,
    }, { merge: true });
  }

  await batch.commit();
  return { eventId, jobId, matched: Boolean(connectionDoc), dataType: notification.dataType || null, dateKey: notification.dateKey || null };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: RESPONSE_HEADERS, body: '' };
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: RESPONSE_HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    initializeFirebaseAdmin(event);
    const rawBody = getRawBody(event);
    const payload = parsePayload(rawBody);
    const verification = verifyWebhookAuthorization(event);

    if (isVerificationPayload(payload)) {
      if (!verification.ok) {
        return { statusCode: 401, headers: RESPONSE_HEADERS, body: JSON.stringify({ error: 'Unauthorized verification request.' }) };
      }
      return { statusCode: 200, headers: RESPONSE_HEADERS, body: JSON.stringify({ ok: true }) };
    }

    if (!verification.ok) {
      return {
        statusCode: 401,
        headers: RESPONSE_HEADERS,
        body: JSON.stringify({ error: 'Invalid Google Health webhook authorization.', errorCode: 'GOOGLE_HEALTH_WEBHOOK_AUTH_INVALID' }),
      };
    }

    const notification = normalizeNotification(payload);
    const signatureHeader = getHeader(event.headers, 'google-health-api-signature');
    const signatureVerification = await verifyGoogleHealthSignature(rawBody, signatureHeader);
    const requireSignature = String(process.env.GOOGLE_HEALTH_WEBHOOK_REQUIRE_SIGNATURE || '').toLowerCase() === 'true';
    if ((signatureHeader || requireSignature) && !signatureVerification.ok) {
      return {
        statusCode: 401,
        headers: RESPONSE_HEADERS,
        body: JSON.stringify({
          error: 'Invalid Google Health webhook signature.',
          errorCode: 'GOOGLE_HEALTH_WEBHOOK_SIGNATURE_INVALID',
        }),
      };
    }

    await persistNotificationAndQueueSync({ notification, rawBody, verification, signatureVerification, signatureHeader });

    return {
      statusCode: 204,
      headers: RESPONSE_HEADERS,
      body: '',
    };
  } catch (error) {
    console.error('[google-health-webhook] Failed:', error);
    return {
      statusCode: error?.statusCode || 500,
      headers: RESPONSE_HEADERS,
      body: JSON.stringify({
        error: error?.message || 'Google Health webhook handling failed.',
        errorCode: 'GOOGLE_HEALTH_WEBHOOK_FAILED',
      }),
    };
  }
};

exports.__test = {
  civilDateToDateKey,
  parseTinkSignatureHeader,
  normalizeNotification,
  verifyGoogleHealthSignature,
  verifyWebhookAuthorization,
};
