const { admin, db, headers } = require('./config/firebase');
const { normalizeEmailAddress } = require('./utils/emailSafety');
const { releaseDeletedAccountEmailSuppression } = require('./utils/emailSuppression');

const auth = admin.auth();

function json(statusCode, payload, extraHeaders = {}) {
  return {
    statusCode,
    headers: { ...headers, ...extraHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  };
}

function getHeader(event, name) {
  const wanted = name.toLowerCase();
  const found = Object.entries(event.headers || {}).find(([key]) => key.toLowerCase() === wanted);
  return found ? found[1] : '';
}

async function verifyCurrentUser(event) {
  const authHeader = String(getHeader(event, 'authorization') || '').trim();
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;

  const decoded = await auth.verifyIdToken(match[1]);
  return {
    uid: decoded.uid,
    email: normalizeEmailAddress(decoded.email || ''),
  };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return json(405, { success: false, message: 'Method Not Allowed' }, { Allow: 'POST' });
  }

  let currentUser;
  try {
    currentUser = await verifyCurrentUser(event);
  } catch (error) {
    console.error('[release-email-suppression] Token verification failed:', error);
    return json(401, { success: false, message: 'Unauthorized: could not verify current user.' });
  }

  if (!currentUser?.uid || !currentUser.email) {
    return json(403, { success: false, message: 'Forbidden: signed-in user email required.' });
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return json(400, { success: false, message: 'Invalid request body.' });
  }

  const userId = String(body.userId || currentUser.uid || '').trim();
  const email = normalizeEmailAddress(body.email || currentUser.email);
  if (!userId || !email) {
    return json(400, { success: false, message: 'Missing required userId or email.' });
  }
  if (userId !== currentUser.uid || email !== currentUser.email) {
    return json(403, { success: false, message: 'Forbidden: suppression can only be released by the matching signed-in account.' });
  }

  const userSnap = await db.collection('users').doc(userId).get();
  if (!userSnap.exists) {
    return json(404, { success: false, message: 'User document not found.' });
  }

  const userData = userSnap.data() || {};
  if (normalizeEmailAddress(userData.email) !== email) {
    return json(403, { success: false, message: 'Forbidden: user document email does not match signed-in account.' });
  }

  try {
    const release = await releaseDeletedAccountEmailSuppression({
      db,
      admin,
      email,
      userId,
      releaseReason: 'account_recreated',
      metadata: {
        source: 'release-email-suppression',
      },
    });

    return json(200, {
      success: true,
      ...release,
    });
  } catch (error) {
    console.error('[release-email-suppression] Failed:', error);
    return json(500, { success: false, message: error?.message || 'Failed to release suppression.' });
  }
};
