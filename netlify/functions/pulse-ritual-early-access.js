const crypto = require('crypto');
const { initializeFirebaseAdmin, admin, headers } = require('./config/firebase');

const COLLECTION_NAME = 'pulse-ritual-early-access';
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const responseHeaders = {
  ...headers,
  'Content-Type': 'application/json',
};

const normalizeEmail = (email) => String(email || '').trim().toLowerCase();

const buildEmailDocId = (email) => crypto
  .createHash('sha256')
  .update(email)
  .digest('hex');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: responseHeaders, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: responseHeaders,
      body: JSON.stringify({ success: false, error: 'Method not allowed' }),
    };
  }

  try {
    initializeFirebaseAdmin(event);

    const body = JSON.parse(event.body || '{}');
    const email = normalizeEmail(body.email);
    const name = String(body.name || '').trim();
    const source = String(body.source || 'ritual-landing').trim();
    const pageUrl = String(body.pageUrl || '').trim();
    const referrer = String(body.referrer || '').trim();

    if (!email || !EMAIL_PATTERN.test(email)) {
      return {
        statusCode: 400,
        headers: responseHeaders,
        body: JSON.stringify({ success: false, error: 'Enter a valid email address.' }),
      };
    }

    const firestore = admin.firestore();
    const docId = buildEmailDocId(email);
    const docRef = firestore.collection(COLLECTION_NAME).doc(docId);
    const existing = await docRef.get();
    const now = admin.firestore.FieldValue.serverTimestamp();

    const payload = {
      id: docId,
      email,
      source,
      pageUrl,
      referrer,
      product: 'Pulse Ritual',
      status: 'early-access-requested',
      tags: ['pulse-ritual', 'early-access'],
      updatedAt: now,
      lastSubmittedAt: now,
      signupCount: admin.firestore.FieldValue.increment(1),
      userAgent: event.headers?.['user-agent'] || event.headers?.['User-Agent'] || '',
    };

    if (name) {
      payload.name = name;
    }

    if (!existing.exists) {
      payload.createdAt = now;
    }

    await docRef.set(payload, { merge: true });

    return {
      statusCode: 200,
      headers: responseHeaders,
      body: JSON.stringify({
        success: true,
        id: docId,
        alreadyJoined: existing.exists,
      }),
    };
  } catch (error) {
    console.error('[pulse-ritual-early-access] Failed:', error);
    return {
      statusCode: 500,
      headers: responseHeaders,
      body: JSON.stringify({
        success: false,
        error: 'We could not save your early access request right now.',
      }),
    };
  }
};
