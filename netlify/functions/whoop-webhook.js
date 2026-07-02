const { initializeFirebaseAdmin, admin } = require('./config/firebase');
const {
  CONNECTIONS_COLLECTION,
  RESPONSE_HEADERS,
  buildWhoopErrorResponse,
  getWebhookSecret,
  getRawBody,
  verifyWebhookSignature,
} = require('./whoop-utils');

const WEBHOOK_EVENTS_COLLECTION = 'pulsecheck-whoop-webhook-events';
const SYNC_JOBS_COLLECTION = 'pulsecheck-device-sync-jobs';

function parseRawJson(rawBody) {
  try {
    return rawBody ? JSON.parse(rawBody) : {};
  } catch {
    return {};
  }
}

function firstString(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return '';
}

function eventDateKey() {
  return new Date().toISOString().slice(0, 10);
}

async function findConnectionByWhoopUserId(firestore, whoopUserId) {
  if (!whoopUserId) return null;
  const candidates = Array.from(new Set([
    String(whoopUserId),
    Number.isFinite(Number(whoopUserId)) ? Number(whoopUserId) : null,
  ].filter((value) => value !== null && value !== '')));

  for (const candidate of candidates) {
    const snap = await firestore
      .collection(CONNECTIONS_COLLECTION)
      .where('whoopUserId', '==', candidate)
      .limit(1)
      .get();
    if (!snap.empty) return snap.docs[0];
  }
  return null;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: RESPONSE_HEADERS, body: '' };
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: RESPONSE_HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    initializeFirebaseAdmin(event);
    const rawBody = getRawBody(event);
    const webhookSecret = await getWebhookSecret();
    const isValidSignature = verifyWebhookSignature({
      headers: event.headers || {},
      rawBody,
      secret: webhookSecret,
    });
    if (!isValidSignature) {
      return {
        statusCode: 401,
        headers: RESPONSE_HEADERS,
        body: JSON.stringify({ error: 'Invalid WHOOP webhook signature', errorCode: 'WHOOP_WEBHOOK_SIGNATURE_INVALID' }),
      };
    }

    const payload = parseRawJson(rawBody);
    const firestore = admin.firestore();
    const whoopUserId = firstString(payload.user_id, payload.userId);
    const eventType = firstString(payload.type, payload.event_type, payload.eventType) || 'whoop.webhook';
    const eventId = firstString(payload.trace_id, payload.traceId, payload.id) || `whoop_${Date.now()}`;
    const eventRef = firestore.collection(WEBHOOK_EVENTS_COLLECTION).doc(eventId);
    await eventRef.set({
      provider: 'whoop',
      sourceFamily: 'whoop',
      eventType,
      whoopUserId: whoopUserId || null,
      objectId: firstString(payload.id) || null,
      traceId: firstString(payload.trace_id, payload.traceId) || null,
      rawPayload: payload,
      receivedAt: Date.now(),
    }, { merge: true });

    const connectionDoc = await findConnectionByWhoopUserId(firestore, whoopUserId);
    if (connectionDoc) {
      const connection = connectionDoc.data() || {};
      const userId = connection.userId || connectionDoc.id;
      await firestore.collection(SYNC_JOBS_COLLECTION).doc(`whoop_${userId}_${eventId}`).set({
        provider: 'whoop',
        sourceFamily: 'whoop',
        userId,
        jobType: 'whoop_webhook_sync',
        status: 'queued',
        triggerReason: eventType,
        requestedDateKey: eventDateKey(),
        providerEventId: eventId,
        rawObjectId: firstString(payload.id) || null,
        createdAt: Date.now(),
      }, { merge: true });
    }

    return {
      statusCode: 200,
      headers: RESPONSE_HEADERS,
      body: JSON.stringify({ ok: true, queued: Boolean(connectionDoc), eventId, eventType }),
    };
  } catch (error) {
    console.error('[whoop-webhook] Failed:', error);
    return buildWhoopErrorResponse(error, {
      errorCode: 'WHOOP_WEBHOOK_FAILED',
      message: 'WHOOP webhook failed.',
    });
  }
};
