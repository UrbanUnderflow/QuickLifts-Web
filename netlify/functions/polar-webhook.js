const crypto = require('crypto');
const { initializeFirebaseAdmin, admin } = require('./config/firebase');
const { RESPONSE_HEADERS } = require('./polar-utils');

const WEBHOOK_EVENTS_COLLECTION = 'pulsecheck-polar-webhook-events';
const CONNECTIONS_COLLECTION = 'pulsecheck-polar-connections';
const HEALTH_CONTEXT_JOBS_COLLECTION = 'health-context-jobs';

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

function normalizeSignature(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '';
  const parts = trimmed.split(',');
  const sha256Part = parts.find((part) => part.trim().toLowerCase().startsWith('sha256='));
  return (sha256Part || trimmed).replace(/^sha256=/i, '').trim();
}

function verifyWebhookSignature(event, rawBody) {
  const secret = String(process.env.POLAR_WEBHOOK_SECRET || '').trim();
  if (!secret) return { ok: true, required: false, mode: 'not_configured' };

  const directSecret = getHeader(event.headers, 'x-polar-webhook-secret') || getHeader(event.headers, 'polar-webhook-secret');
  if (directSecret && timingSafeEqualString(directSecret, secret)) {
    return { ok: true, required: true, mode: 'shared_secret' };
  }

  const signature =
    getHeader(event.headers, 'polar-webhook-signature')
    || getHeader(event.headers, 'x-polar-webhook-signature')
    || getHeader(event.headers, 'polar-signature')
    || getHeader(event.headers, 'x-polar-signature')
    || getHeader(event.headers, 'x-webhook-signature');

  const normalizedSignature = normalizeSignature(signature);
  if (!normalizedSignature) return { ok: false, required: true, mode: 'missing_signature' };

  const hmac = crypto.createHmac('sha256', secret).update(rawBody, 'utf8');
  const expectedHex = hmac.digest('hex');
  const expectedBase64 = crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('base64');
  const matchesHex = timingSafeEqualString(normalizedSignature.toLowerCase(), expectedHex.toLowerCase());
  const matchesBase64 = timingSafeEqualString(normalizedSignature, expectedBase64);

  return {
    ok: matchesHex || matchesBase64,
    required: true,
    mode: matchesHex ? 'hmac_sha256_hex' : matchesBase64 ? 'hmac_sha256_base64' : 'invalid_signature',
  };
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

function asArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function extractEvents(payload) {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return [];
  return [
    ...asArray(payload.events),
    ...asArray(payload.notifications),
    ...asArray(payload.data),
    ...asArray(payload.event),
  ].filter(Boolean).length
    ? [
      ...asArray(payload.events),
      ...asArray(payload.notifications),
      ...asArray(payload.data),
      ...asArray(payload.event),
    ].filter(Boolean)
    : [payload];
}

function firstString(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return '';
}

function normalizeEventType(event) {
  return firstString(event.eventType, event.event_type, event.type, event.event, event.resource, event.url) || 'polar_webhook';
}

function normalizePolarUserId(event) {
  return firstString(
    event.polarUserId,
    event.polar_user_id,
    event.user_id,
    event['user-id'],
    event.userId,
    event.user?.id,
    event.user?.['user-id'],
  );
}

function normalizeMemberId(event) {
  return firstString(event.memberId, event.member_id, event['member-id'], event.user?.memberId, event.user?.['member-id']);
}

function dateKeyFromAny(value) {
  if (!value) return '';
  const raw = typeof value === 'number' && Number.isFinite(value)
    ? new Date(value > 9999999999 ? value : value * 1000)
    : new Date(String(value));
  if (Number.isNaN(raw.getTime())) return '';
  return raw.toISOString().slice(0, 10);
}

function normalizeDateKey(event) {
  return firstString(event.date, event.dateKey, event.day, event.sleep_date, event['sleep-date'])
    || dateKeyFromAny(firstString(event.timestamp, event.created, event.created_at, event['created-at'], event.time));
}

function buildStableEventId(event, index, rawBody) {
  const hash = crypto.createHash('sha256')
    .update(JSON.stringify(event))
    .update(rawBody)
    .digest('hex')
    .slice(0, 16);
  return `polar_${Date.now()}_${index}_${hash}`;
}

async function findConnection({ polarUserId, memberId }) {
  const collection = admin.firestore().collection(CONNECTIONS_COLLECTION);
  if (polarUserId) {
    const snap = await collection.where('polarUserId', '==', polarUserId).limit(1).get();
    if (!snap.empty) return snap.docs[0];
  }
  if (memberId) {
    const snap = await collection.where('memberId', '==', memberId).limit(1).get();
    if (!snap.empty) return snap.docs[0];
  }
  return null;
}

function buildJobId({ userId, dateKey, eventId }) {
  const safeDateKey = dateKey || 'latest';
  return `polar_webhook_sync_${userId}_${safeDateKey}_${eventId.slice(-16)}`;
}

async function persistEventAndQueueSync({ event, index, rawBody, verification, headerEventType }) {
  const now = admin.firestore.FieldValue.serverTimestamp();
  const eventType = headerEventType || normalizeEventType(event);
  const polarUserId = normalizePolarUserId(event);
  const memberId = normalizeMemberId(event);
  const dateKey = normalizeDateKey(event);
  const eventId = buildStableEventId(event, index, rawBody);
  const eventRef = admin.firestore().collection(WEBHOOK_EVENTS_COLLECTION).doc(eventId);
  const connectionDoc = await findConnection({ polarUserId, memberId });
  const connection = connectionDoc?.data() || null;
  const userId = connectionDoc?.id || connection?.userId || memberId || '';
  const batch = admin.firestore().batch();

  batch.set(eventRef, {
    id: eventId,
    provider: 'polar',
    receivedAt: now,
    eventType,
    polarUserId: polarUserId || null,
    memberId: memberId || null,
    athleteUserId: userId || null,
    dateKey: dateKey || null,
    payload: event,
    verification,
    status: connectionDoc ? 'matched' : 'unmatched',
  }, { merge: true });

  let jobId = '';
  if (connectionDoc && userId) {
    jobId = buildJobId({ userId, dateKey, eventId });
    batch.set(connectionDoc.ref, {
      lastWebhookAt: now,
      lastWebhookType: eventType,
      pendingWebhookSync: true,
      pendingWebhookDateKey: dateKey || null,
      updatedAt: now,
    }, { merge: true });
    batch.set(admin.firestore().collection(HEALTH_CONTEXT_JOBS_COLLECTION).doc(jobId), {
      id: jobId,
      athleteUserId: userId,
      sourceFamily: 'polar',
      jobType: 'polar_webhook_sync',
      status: 'queued',
      scheduledAt: now,
      createdAt: now,
      updatedAt: now,
      triggerReason: 'polar_webhook',
      providerEventId: eventId,
      eventType,
      snapshotDateKey: dateKey || null,
      polarUserId: polarUserId || connection?.polarUserId || null,
      memberId: memberId || connection?.memberId || null,
    }, { merge: true });
  }

  await batch.commit();
  return { eventId, jobId, matched: Boolean(connectionDoc), eventType, dateKey: dateKey || null };
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
    const events = extractEvents(payload);
    const headerEventType = firstString(getHeader(event.headers, 'polar-webhook-event'), getHeader(event.headers, 'x-polar-webhook-event'));
    const isPing = events.length > 0 && events.every((entry) => normalizeEventType(entry).toUpperCase() === 'PING' || headerEventType.toUpperCase() === 'PING');
    const verification = isPing
      ? { ok: true, required: false, mode: 'polar_ping' }
      : verifyWebhookSignature(event, rawBody);

    if (!verification.ok) {
      return {
        statusCode: 401,
        headers: RESPONSE_HEADERS,
        body: JSON.stringify({ error: 'Invalid Polar webhook signature.', errorCode: 'POLAR_WEBHOOK_SIGNATURE_INVALID' }),
      };
    }

    const results = [];
    for (const [index, entry] of events.entries()) {
      if (!entry || typeof entry !== 'object') continue;
      results.push(await persistEventAndQueueSync({ event: entry, index, rawBody, verification, headerEventType }));
    }

    return {
      statusCode: 200,
      headers: RESPONSE_HEADERS,
      body: JSON.stringify({
        ok: true,
        eventCount: results.length,
        matchedConnections: results.filter((result) => result.matched).length,
        queuedJobs: results.filter((result) => result.jobId).map((result) => result.jobId),
      }),
    };
  } catch (error) {
    console.error('[polar-webhook] Failed:', error);
    return {
      statusCode: error?.statusCode || 500,
      headers: RESPONSE_HEADERS,
      body: JSON.stringify({
        error: error?.message || 'Polar webhook handling failed.',
        errorCode: 'POLAR_WEBHOOK_FAILED',
      }),
    };
  }
};

exports.__test = {
  extractEvents,
  normalizeDateKey,
  normalizeEventType,
  verifyWebhookSignature,
};
