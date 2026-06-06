const { admin, getFirebaseAdminApp, headers, initializeFirebaseAdmin } = require('./config/firebase');

const REPORTS_ROOT_COLLECTION = 'teams';
const REPORTS_SUBCOLLECTION = 'coachReports';

const RESPONSE_HEADERS = {
  ...headers,
  'Content-Type': 'application/json',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-PulseCheck-Firebase-Mode, X-Force-Dev-Firebase, X-PulseCheck-Dev-Firebase',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Brevo transactional event types, ordered weakest -> strongest so we can surface
// the most meaningful state when several events exist for one message.
const EVENT_RANK = {
  requests: 1,
  deferred: 2,
  delivered: 3,
  opened: 4,
  clicks: 5,
};
const FAILURE_EVENTS = new Set(['hardBounces', 'softBounces', 'blocked', 'spam', 'invalid', 'error', 'unsubscribed']);

function json(statusCode, body) {
  return { statusCode, headers: RESPONSE_HEADERS, body: JSON.stringify(body) };
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

// Collapse a recipient's Brevo events into a single, coach-readable status.
function summarizeEvents(events) {
  if (!Array.isArray(events) || events.length === 0) return null;
  let failure = null;
  let best = null;
  let bestRank = 0;
  for (const entry of events) {
    const event = normalizeString(entry?.event);
    if (FAILURE_EVENTS.has(event)) {
      // Keep the first failure we see (events come back newest-first).
      if (!failure) failure = { event, date: entry?.date || null };
      continue;
    }
    const rank = EVENT_RANK[event] || 0;
    if (rank > bestRank) {
      bestRank = rank;
      best = { event, date: entry?.date || null };
    }
  }
  if (failure) return { status: failure.event, date: failure.date, ok: false };
  if (best) return { status: best.event, date: best.date, ok: true };
  return null;
}

async function fetchBrevoEventsForMessage(apiKey, messageId) {
  const url = `https://api.brevo.com/v3/smtp/statistics/events?messageId=${encodeURIComponent(messageId)}&limit=50&sort=desc`;
  const response = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json', 'api-key': apiKey },
  });
  if (!response.ok) {
    // 404 = Brevo has no events yet (too early, or message expired from event log).
    return { ok: false, status: response.status, events: [] };
  }
  const data = await response.json().catch(() => ({}));
  return { ok: true, status: 200, events: Array.isArray(data?.events) ? data.events : [] };
}

exports.handler = async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: RESPONSE_HEADERS, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return json(405, { success: false, error: 'Method not allowed' });
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const teamId = normalizeString(body.teamId);
    const reportId = normalizeString(body.reportId);
    if (!teamId || !reportId) {
      return json(400, { success: false, error: 'teamId and reportId are required.' });
    }

    initializeFirebaseAdmin({ headers: event.headers || {} });
    const adminApp = getFirebaseAdminApp({ headers: event.headers || {} });
    const db = admin.firestore(adminApp);

    const snap = await db
      .collection(REPORTS_ROOT_COLLECTION)
      .doc(teamId)
      .collection(REPORTS_SUBCOLLECTION)
      .doc(reportId)
      .get();
    if (!snap.exists) {
      return json(404, { success: false, error: 'Report was not found.' });
    }
    const report = snap.data() || {};
    const sentTo = Array.isArray(report.sentTo) ? report.sentTo : [];

    const apiKey = process.env.BREVO_MARKETING_KEY || process.env.BREVO_API_KEY;
    if (!apiKey) {
      return json(500, { success: false, error: 'Email service is not configured (missing Brevo API key).' });
    }

    const recipients = await Promise.all(
      sentTo.map(async (entry) => {
        const email = normalizeString(entry?.email);
        const messageId = normalizeString(entry?.messageId);
        const base = {
          email,
          role: normalizeString(entry?.role) || null,
          skipped: Boolean(entry?.skipped),
          messageId: messageId || null,
        };
        if (!messageId || base.skipped) {
          return { ...base, status: base.skipped ? 'skipped' : 'unknown', ok: !base.skipped, date: null };
        }
        const result = await fetchBrevoEventsForMessage(apiKey, messageId);
        const summary = summarizeEvents(result.events);
        if (summary) return { ...base, ...summary };
        // No events found yet — treat as accepted-but-pending.
        return { ...base, status: result.ok ? 'sent' : 'pending', ok: true, date: null };
      })
    );

    return json(200, {
      success: true,
      deliveryStatus: normalizeString(report.deliveryStatus) || 'not_sent',
      sentAt: report.sentAt || null,
      sentCount: report.emailDelivery?.sentCount ?? recipients.filter((r) => !r.skipped).length,
      recipients,
    });
  } catch (error) {
    console.error('[pulsecheck-report-delivery-status] Unexpected error:', error);
    return json(500, {
      success: false,
      error: error?.message || 'Internal server error while checking delivery status.',
    });
  }
};
