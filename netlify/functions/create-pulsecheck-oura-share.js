const crypto = require('crypto');
const { initializeFirebaseAdmin, admin } = require('./config/firebase');
const { RESPONSE_HEADERS, createError, getBaseSiteUrl, verifyAuth } = require('./oura-utils');

const COLLECTION = 'pulsecheck-oura-recovery-shares';
const MAX_METRICS = 8;

function parseJsonBody(event) {
  if (!event?.body) return {};
  try {
    return typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
  } catch (error) {
    throw createError(400, 'Request body must be valid JSON.');
  }
}

function sanitizeText(value, maxLength = 280) {
  if (typeof value !== 'string') return '';
  return value.replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function sanitizeMultilineText(value, maxLength = 1200) {
  if (typeof value !== 'string') return '';
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n\n')
    .slice(0, maxLength);
}

function sanitizeMetric(metric) {
  if (!metric || typeof metric !== 'object') return null;

  const title = sanitizeText(metric.title, 80);
  const value = sanitizeText(metric.value, 40);
  const statusLabel = sanitizeText(metric.statusLabel, 40);
  const explanation = sanitizeMultilineText(metric.explanation, 360);
  const comparisonDetail = sanitizeMultilineText(metric.comparisonDetail, 520);
  const personalDetail = sanitizeMultilineText(metric.personalDetail, 520);

  if (!title || !value || !statusLabel) return null;

  return {
    title,
    value,
    statusLabel,
    explanation,
    comparisonDetail,
    personalDetail,
  };
}

function buildToken() {
  return crypto.randomBytes(18).toString('hex');
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: RESPONSE_HEADERS, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: RESPONSE_HEADERS,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    initializeFirebaseAdmin(event);
    const decoded = await verifyAuth(event);
    const body = parseJsonBody(event);

    const athleteName = sanitizeText(body.athleteName, 40) || 'Athlete';
    const profileHeadline = sanitizeMultilineText(body.profileHeadline, 220);
    const edge = sanitizeMultilineText(body.edge, 360);
    const risk = sanitizeMultilineText(body.risk, 360);
    const bestMove = sanitizeMultilineText(body.bestMove, 360);
    const syncLabel = sanitizeText(body.syncLabel, 40);
    const metrics = Array.isArray(body.metrics)
      ? body.metrics.map(sanitizeMetric).filter(Boolean).slice(0, MAX_METRICS)
      : [];

    if (!profileHeadline || !edge || !risk || !bestMove || metrics.length === 0) {
      throw createError(400, 'The Oura recovery share payload is incomplete.');
    }

    const token = buildToken();
    const shareUrl = `${getBaseSiteUrl()}/shared/oura-recovery/${token}`;

    await admin
      .firestore()
      .collection(COLLECTION)
      .doc(token)
      .set({
        token,
        shareType: 'pulsecheck-oura-recovery-v1',
        athleteName,
        profileHeadline,
        edge,
        risk,
        bestMove,
        syncLabel: syncLabel || null,
        metrics,
        sharedByUserId: decoded.uid,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

    return {
      statusCode: 200,
      headers: RESPONSE_HEADERS,
      body: JSON.stringify({
        ok: true,
        token,
        shareUrl,
      }),
    };
  } catch (error) {
    console.error('[create-pulsecheck-oura-share] Failed:', error);
    return {
      statusCode: error.statusCode || 500,
      headers: RESPONSE_HEADERS,
      body: JSON.stringify({
        error: error?.message || 'Failed to create Oura recovery share link.',
      }),
    };
  }
};
