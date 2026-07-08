// =============================================================================
// Clinical status webhook receiver — clinical handoff operational mirror.
//
// Endpoint: POST /.netlify/functions/clinical-callback
//
// This is the `pulseApiCallback` URL advertised in every clinical handoff
// packet (see performClinicalHandoff in pulsecheck-escalation.js and
// buildPulseCallbackUrl in netlify/functions/lib/clinical-bridge.js). The
// clinical provider posts signed status events here; each event carries a
// unique `webhookEventId` and is retried until we acknowledge with a 2xx.
//
// Contract (admin page /admin/systemOverview#auntedna-escalation-data-exchange-contract):
//   escalation.created    -> store clinical case id, status, receipt timestamp, event id
//   triage.requested      -> flag operator follow-up, no clinical detail
//   clinician.assigned    -> store display-safe assignment label + timestamp only
//   appointment.booked    -> operational follow-up state, no appointment notes
//   crisis.invoked        -> record crisis pathway state (safety mode stays on)
//   watchlist.entered     -> record protective workflow state only
//   watchlist.removed     -> clear protective workflow state only
//   checkin.*             -> record check-in workflow timestamp only
//   case.resolved         -> record resolved/closed status category + timestamp
//
// What it does, in order:
//   1. Verifies the HMAC-SHA256 signature against CLINICAL_BRIDGE_WEBHOOK_SECRET.
//      Fails closed (503) when the secret is unset, unless CLINICAL_BRIDGE_MOCK=true.
//   2. Dedupes on `webhookEventId` — an already-processed event is re-acked
//      with 200 so AuntEdna's retry loop stops.
//   3. Resolves the matching `escalation-records` doc (doc id from
//      `pulseEscalationId`, falling back to `clinicalReferenceId` ==
//      `clinicalCaseId`).
//   4. Mirrors ONLY coarse operational state onto the escalation record:
//      clinicalCaseId, status category, display-safe assignment label, and
//      timestamps. Fields are allow-listed — clinical content (notes, intake
//      answers, appointment details, PHI) is never persisted, even if a
//      payload over-sends it.
//   5. Records a sanitized receipt in `pulsecheck-clinical-webhook-events`
//      for idempotency and incident review (signature mode, match status).
//
// What it does NOT do:
//   - Flip Pulse-owned lifecycle state (status, incidentStatus, handoff
//     machinery) — those stay owned by pulsecheck-escalation.js flows.
//   - Store the raw payload. Only allow-listed operational fields persist.
//
// Acknowledgement posture:
//   - 200 for processed, deduped, AND unmatched events (retrying an event we
//     cannot match will never succeed, so we ack and keep the receipt for
//     operator reconciliation — same posture as polar-webhook.js).
//   - 401 invalid signature, 400 malformed event, 503 secret not configured.
//     Non-2xx responses leave the event unclaimed so the provider retries.
// =============================================================================

const crypto = require('crypto');
const { initializeFirebaseAdmin, admin, headers } = require('./config/firebase');

const WEBHOOK_EVENTS_COLLECTION = 'pulsecheck-clinical-webhook-events';
const ESCALATION_RECORDS_COLLECTION = 'escalation-records';

const RESPONSE_HEADERS = {
  ...headers,
  'Content-Type': 'application/json',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-AuntEdna-Signature',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Shared webhook event vocabulary from the data exchange contract.
const EVENT_STATUS_CATEGORY = {
  'escalation.created': 'created',
  'triage.requested': 'triage_requested',
  'clinician.assigned': 'assigned',
  'appointment.booked': 'appointment_booked',
  'crisis.invoked': 'crisis_invoked',
  'watchlist.entered': 'watchlist_entered',
  'watchlist.updated': 'watchlist_updated',
  'watchlist.removed': 'watchlist_removed',
  'watchlist.cleared_for_training': 'cleared_for_training',
  'checkin.scheduled': 'checkin_scheduled',
  'checkin.completed': 'checkin_completed',
  'checkin.missed': 'checkin_missed',
  'case.resolved': 'resolved',
};

const STATUS_CATEGORIES = new Set([
  'created',
  'triage_requested',
  'assigned',
  'appointment_booked',
  'crisis_invoked',
  'watchlist_entered',
  'watchlist_updated',
  'watchlist_removed',
  'cleared_for_training',
  'checkin_scheduled',
  'checkin_completed',
  'checkin_missed',
  'resolved',
  'closed',
]);

function json(statusCode, body) {
  return {
    statusCode,
    headers: RESPONSE_HEADERS,
    body: JSON.stringify(body),
  };
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function getRawBody(event) {
  if (!event?.body) return '';
  if (event.isBase64Encoded) return Buffer.from(event.body, 'base64').toString('utf8');
  return typeof event.body === 'string' ? event.body : JSON.stringify(event.body);
}

function getHeader(headerBag, name) {
  const normalizedName = name.toLowerCase();
  const entry = Object.entries(headerBag || {}).find(([key]) => key.toLowerCase() === normalizedName);
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
  const secret = String(process.env.CLINICAL_BRIDGE_WEBHOOK_SECRET || '').trim();
  if (!secret) {
    // Clinical bridge fails closed: never accept unsigned partner traffic in
    // a real deployment. Mock mode is the only exception.
    if (process.env.CLINICAL_BRIDGE_MOCK === 'true' || process.env.AUNTEDNA_MOCK === 'true') {
      return { ok: true, required: false, mode: 'mock_unsigned' };
    }
    return { ok: false, required: true, mode: 'not_configured' };
  }

  const signature =
    getHeader(event.headers, 'x-auntedna-signature')
    || getHeader(event.headers, 'auntedna-signature')
    || getHeader(event.headers, 'x-webhook-signature');

  const normalizedSignature = normalizeSignature(signature);
  if (!normalizedSignature) return { ok: false, required: true, mode: 'missing_signature' };

  const expectedHex = crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');
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
  if (!rawBody) {
    const err = new Error('Webhook body is required.');
    err.statusCode = 400;
    throw err;
  }
  try {
    return JSON.parse(rawBody);
  } catch (_) {
    const err = new Error('Webhook body must be valid JSON.');
    err.statusCode = 400;
    throw err;
  }
}

// Accepts unix seconds, unix milliseconds, or an ISO string; returns unix seconds.
function toUnixSeconds(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value > 1e12 ? Math.round(value / 1000) : Math.round(value);
  }
  const asString = normalizeString(value);
  if (asString) {
    const parsed = Date.parse(asString);
    if (Number.isFinite(parsed)) return Math.round(parsed / 1000);
  }
  return null;
}

// Allow-list extraction: only coarse operational fields ever leave the raw
// payload. Clinical content in any over-sent field is dropped here.
function normalizeWebhookEvent(payload) {
  const body = payload && typeof payload === 'object' ? payload : {};
  const data = body.data && typeof body.data === 'object' ? body.data : {};
  const pick = (...keys) => {
    for (const key of keys) {
      const fromBody = normalizeString(body[key]);
      if (fromBody) return fromBody;
      const fromData = normalizeString(data[key]);
      if (fromData) return fromData;
    }
    return '';
  };

  const eventType = pick('event', 'eventType', 'type').toLowerCase();
  const rawStatus = pick('statusCategory', 'status').toLowerCase();

  return {
    eventType,
    webhookEventId: pick('webhookEventId', 'eventId', 'id'),
    pulseEscalationId: pick('pulseEscalationId', 'escalationRecordId'),
    clinicalCaseId: pick('clinicalCaseId', 'auntEdnaCaseId', 'caseId', 'escalationId'),
    handoffId: pick('handoffId') || null,
    pulseUserId: pick('pulseUserId', 'userId') || null,
    assignmentLabel: pick('assignmentLabel', 'assignedLane', 'providerLabel', 'displayLabel') || null,
    statusCategory: STATUS_CATEGORIES.has(rawStatus) ? rawStatus : (EVENT_STATUS_CATEGORY[eventType] || null),
    occurredAt: toUnixSeconds(body.occurredAt ?? body.timestamp ?? data.occurredAt ?? data.timestamp),
  };
}

// Firestore doc ids cannot contain '/'; partner event ids are opaque strings.
function buildEventDocId(webhookEventId) {
  return `clinical_${webhookEventId.replace(/[/]/g, '_').slice(0, 480)}`;
}

async function resolveEscalationRef(db, webhookEvent) {
  if (webhookEvent.pulseEscalationId) {
    const ref = db.collection(ESCALATION_RECORDS_COLLECTION).doc(webhookEvent.pulseEscalationId);
    const snap = await ref.get();
    if (snap.exists) return { ref, matchedBy: 'pulseEscalationId' };
  }
  if (webhookEvent.clinicalCaseId) {
    const snap = await db
      .collection(ESCALATION_RECORDS_COLLECTION)
      .where('clinicalReferenceId', '==', webhookEvent.clinicalCaseId)
      .limit(1)
      .get();
    if (!snap.empty) return { ref: snap.docs[0].ref, matchedBy: 'clinicalReferenceId' };
  }
  return null;
}

// The coarse operational mirror per the contract's "PulseCheck mirror
// behavior" column. Everything lands under the `clinicalCase` map so the
// Pulse-owned lifecycle fields on the record stay untouched.
function buildEscalationMirror(webhookEvent, receivedAtSeconds) {
  const occurredAt = webhookEvent.occurredAt || receivedAtSeconds;
  const caseMirror = {
    caseId: webhookEvent.clinicalCaseId || null,
    statusCategory: webhookEvent.statusCategory,
    statusUpdatedAt: occurredAt,
    lastEventType: webhookEvent.eventType,
    lastEventId: webhookEvent.webhookEventId,
    lastEventReceivedAt: receivedAtSeconds,
  };
  if (webhookEvent.handoffId) caseMirror.handoffId = webhookEvent.handoffId;

  switch (webhookEvent.eventType) {
    case 'escalation.created':
      caseMirror.createdAt = occurredAt;
      break;
    case 'triage.requested':
      caseMirror.triageRequestedAt = occurredAt;
      caseMirror.followUpRequired = true;
      break;
    case 'clinician.assigned':
      caseMirror.assignedAt = occurredAt;
      if (webhookEvent.assignmentLabel) caseMirror.assignmentLabel = webhookEvent.assignmentLabel;
      break;
    case 'appointment.booked':
      caseMirror.appointmentBookedAt = occurredAt;
      caseMirror.followUpRequired = false;
      break;
    case 'crisis.invoked':
      caseMirror.crisisInvokedAt = occurredAt;
      caseMirror.appState = 'protective';
      caseMirror.returnToTrainingStatus = 'not_cleared';
      break;
    case 'watchlist.entered':
      caseMirror.watchList = true;
      caseMirror.watchListEnteredAt = occurredAt;
      caseMirror.appState = 'protective';
      caseMirror.returnToTrainingStatus = 'not_cleared';
      break;
    case 'watchlist.updated':
      caseMirror.watchListUpdatedAt = occurredAt;
      caseMirror.watchList = true;
      break;
    case 'watchlist.cleared_for_training':
      caseMirror.clearedForTrainingAt = occurredAt;
      caseMirror.returnToTrainingStatus = 'cleared';
      caseMirror.followUpRequired = false;
      break;
    case 'watchlist.removed':
      caseMirror.watchList = false;
      caseMirror.watchListRemovedAt = occurredAt;
      caseMirror.appState = 'normal';
      caseMirror.followUpRequired = false;
      break;
    case 'checkin.scheduled':
      caseMirror.checkInScheduledAt = occurredAt;
      break;
    case 'checkin.completed':
      caseMirror.checkInCompletedAt = occurredAt;
      break;
    case 'checkin.missed':
      caseMirror.checkInMissedAt = occurredAt;
      caseMirror.followUpRequired = true;
      break;
    case 'case.resolved':
      caseMirror.resolvedAt = occurredAt;
      caseMirror.followUpRequired = false;
      caseMirror.returnToTrainingStatus = 'pending_review';
      break;
    default:
      break;
  }

  const update = {
    clinicalCase: caseMirror,
    incidentLastActivityAt: receivedAtSeconds,
  };
  if (webhookEvent.clinicalCaseId) {
    update.clinicalCaseId = webhookEvent.clinicalCaseId;
  }
  return update;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: RESPONSE_HEADERS, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method not allowed' });
  }

  try {
    initializeFirebaseAdmin(event);
    const db = admin.firestore();

    const rawBody = getRawBody(event);
    const verification = verifyWebhookSignature(event, rawBody);
    if (!verification.ok) {
      if (verification.mode === 'not_configured') {
        console.error('[clinical-callback] CLINICAL_BRIDGE_WEBHOOK_SECRET is not configured; rejecting webhook.');
        return json(503, {
          error: 'Webhook signing secret is not configured on the PulseCheck side.',
          errorCode: 'CLINICAL_WEBHOOK_SECRET_MISSING',
        });
      }
      return json(401, {
        error: 'Invalid clinical webhook signature.',
        errorCode: 'CLINICAL_WEBHOOK_SIGNATURE_INVALID',
      });
    }

    const webhookEvent = normalizeWebhookEvent(parsePayload(rawBody));
    if (!webhookEvent.webhookEventId) {
      return json(400, { error: 'webhookEventId is required.', errorCode: 'CLINICAL_WEBHOOK_EVENT_ID_MISSING' });
    }
    if (!EVENT_STATUS_CATEGORY[webhookEvent.eventType]) {
      return json(400, {
        error: `Unsupported event type "${webhookEvent.eventType || '(empty)'}". Expected one of: ${Object.keys(EVENT_STATUS_CATEGORY).join(', ')}.`,
        errorCode: 'CLINICAL_WEBHOOK_EVENT_TYPE_UNSUPPORTED',
      });
    }

    const receivedAtSeconds = Math.round(Date.now() / 1000);
    const eventRef = db.collection(WEBHOOK_EVENTS_COLLECTION).doc(buildEventDocId(webhookEvent.webhookEventId));
    const escalation = await resolveEscalationRef(db, webhookEvent);

    // Single transaction: idempotency claim + mirror write. A failed mirror
    // leaves the event unclaimed so the provider retry can reprocess it.
    const outcome = await db.runTransaction(async (txn) => {
      const existing = await txn.get(eventRef);
      if (existing.exists && existing.data()?.processingStatus === 'processed') {
        return { deduped: true, matched: Boolean(existing.data()?.escalationRecordId) };
      }

      if (escalation) {
        txn.set(escalation.ref, buildEscalationMirror(webhookEvent, receivedAtSeconds), { merge: true });
      }

      txn.set(eventRef, {
        id: webhookEvent.webhookEventId,
        provider: 'auntedna',
        eventType: webhookEvent.eventType,
        statusCategory: webhookEvent.statusCategory,
        pulseEscalationId: webhookEvent.pulseEscalationId || null,
        clinicalCaseId: webhookEvent.clinicalCaseId || null,
        handoffId: webhookEvent.handoffId,
        pulseUserId: webhookEvent.pulseUserId,
        assignmentLabel: webhookEvent.assignmentLabel,
        occurredAt: webhookEvent.occurredAt,
        receivedAt: admin.firestore.FieldValue.serverTimestamp(),
        verification,
        escalationRecordId: escalation ? escalation.ref.id : null,
        matchedBy: escalation ? escalation.matchedBy : null,
        processingStatus: 'processed',
      }, { merge: true });

      return { deduped: false, matched: Boolean(escalation) };
    });

    if (!outcome.matched && !outcome.deduped) {
      console.warn(
        `[clinical-callback] No escalation record matched event ${webhookEvent.webhookEventId} (pulseEscalationId=${webhookEvent.pulseEscalationId || 'none'}, clinicalCaseId=${webhookEvent.clinicalCaseId || 'none'}).`,
      );
    }

    return json(200, {
      ok: true,
      eventId: webhookEvent.webhookEventId,
      deduped: outcome.deduped,
      matched: outcome.matched,
      escalationRecordId: escalation ? escalation.ref.id : null,
    });
  } catch (error) {
    console.error('[clinical-callback] Failed:', error);
    const status = Number.isFinite(error?.statusCode) ? error.statusCode : 500;
    return json(status, {
      error: error?.message || 'Clinical webhook handling failed.',
      errorCode: 'CLINICAL_WEBHOOK_FAILED',
    });
  }
};

exports.__test = {
  buildEscalationMirror,
  buildEventDocId,
  normalizeWebhookEvent,
  toUnixSeconds,
  verifyWebhookSignature,
};
