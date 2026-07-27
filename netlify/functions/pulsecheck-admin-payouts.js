const { admin, db, headers } = require('./config/firebase');
const {
  PAYOUT_METHODS,
  PAYOUT_REQUESTS_COLLECTION,
  PAYOUT_STATES_COLLECTION,
  normalizeEmail,
  normalizeString,
  serializePayoutRequest,
} = require('./utils/pulsecheck-coach-payouts');

const jsonHeaders = {
  ...headers,
  'Content-Type': 'application/json',
  'Cache-Control': 'private, no-store',
};

const json = (statusCode, body) => ({
  statusCode,
  headers: jsonHeaders,
  body: JSON.stringify(body),
});

const bearerToken = (event) => normalizeString(
  event.headers?.authorization || event.headers?.Authorization
).replace(/^Bearer\s+/i, '');

const verifyAdmin = async (event) => {
  const token = bearerToken(event);
  if (!token) {
    const error = new Error('Sign in is required.');
    error.statusCode = 401;
    throw error;
  }

  const decoded = await admin.auth().verifyIdToken(token);
  if (decoded.admin === true || decoded.isAdmin === true || decoded.role === 'admin') {
    return decoded;
  }

  const email = normalizeEmail(decoded.email);
  const [adminSnapshot, userSnapshot] = await Promise.all([
    email ? db.collection('admin').doc(email).get() : Promise.resolve({ exists: false }),
    db.collection('users').doc(decoded.uid).get(),
  ]);
  if (!adminSnapshot.exists && userSnapshot.data()?.isAdmin !== true) {
    const error = new Error('Admin access is required.');
    error.statusCode = 403;
    throw error;
  }
  return decoded;
};

const listPayouts = async (event) => {
  const requestId = normalizeString(event.queryStringParameters?.requestId);
  if (requestId) {
    const snapshot = await db.collection(PAYOUT_REQUESTS_COLLECTION).doc(requestId).get();
    if (!snapshot.exists) {
      return json(404, { success: false, message: 'Payout request not found.' });
    }
    return json(200, {
      success: true,
      request: serializePayoutRequest(snapshot.id, snapshot.data() || {}),
    });
  }

  const snapshot = await db
    .collection(PAYOUT_REQUESTS_COLLECTION)
    .orderBy('requestedAt', 'desc')
    .limit(100)
    .get();
  return json(200, {
    success: true,
    requests: snapshot.docs.map((entry) =>
      serializePayoutRequest(entry.id, entry.data() || {})
    ),
  });
};

const completePayout = async ({ body, decoded }) => {
  const requestId = normalizeString(body.requestId);
  const paymentReference = normalizeString(body.paymentReference);
  const overrideMethod = normalizeString(body.paymentMethod).toLowerCase();
  if (!requestId) {
    return json(400, { success: false, message: 'Choose a payout request.' });
  }
  if (overrideMethod && !PAYOUT_METHODS.has(overrideMethod)) {
    return json(400, {
      success: false,
      message: 'Choose Zelle, Apple Pay, or Cash App.',
    });
  }
  if (paymentReference.length > 300) {
    return json(400, {
      success: false,
      message: 'The payment note must be 300 characters or less.',
    });
  }

  const requestRef = db.collection(PAYOUT_REQUESTS_COLLECTION).doc(requestId);
  let completedRequest;
  let alreadyComplete = false;

  await db.runTransaction(async (transaction) => {
    const requestSnapshot = await transaction.get(requestRef);
    if (!requestSnapshot.exists) {
      const error = new Error('Payout request not found.');
      error.statusCode = 404;
      throw error;
    }

    const request = requestSnapshot.data() || {};
    const status = normalizeString(request.status).toLowerCase();
    if (status === 'paid') {
      alreadyComplete = true;
      completedRequest = { id: requestSnapshot.id, ...request };
      return;
    }
    if (status !== 'requested') {
      const error = new Error('Only requested payouts can be marked complete.');
      error.statusCode = 409;
      throw error;
    }

    const coachUserId = normalizeString(request.coachUserId);
    const amountCents = Math.max(0, Number(request.amountCents) || 0);
    if (!coachUserId || amountCents <= 0) {
      const error = new Error('This payout request is missing its coach or amount.');
      error.statusCode = 409;
      throw error;
    }

    const stateRef = db.collection(PAYOUT_STATES_COLLECTION).doc(coachUserId);
    const stateSnapshot = await transaction.get(stateRef);
    const state = stateSnapshot.exists ? stateSnapshot.data() || {} : {};
    const activeRequestId = normalizeString(state.activeRequestId);
    if (activeRequestId && activeRequestId !== requestId) {
      const error = new Error('A newer payout request is active for this coach.');
      error.statusCode = 409;
      throw error;
    }

    const paidAt = new Date();
    const paymentMethod = overrideMethod || normalizeString(request.paymentMethod).toLowerCase();
    const paidByEmail = normalizeEmail(decoded.email);
    const paidByUserId = normalizeString(decoded.uid);
    const paidCents = Math.max(0, Number(state.paidCents) || 0) + amountCents;
    const requestUpdate = {
      status: 'paid',
      paymentMethod,
      paymentReference: paymentReference || null,
      paidAt,
      paidByEmail: paidByEmail || null,
      paidByUserId: paidByUserId || null,
      updatedAt: paidAt,
    };

    transaction.update(requestRef, requestUpdate);
    transaction.set(stateRef, {
      coachUserId,
      paidCents,
      requestedCents: 0,
      activeRequestId: null,
      lastPaidRequestId: requestId,
      lastPaidAt: paidAt,
      updatedAt: paidAt,
    }, { merge: true });

    completedRequest = {
      id: requestId,
      ...request,
      ...requestUpdate,
    };
  });

  return json(200, {
    success: true,
    alreadyComplete,
    request: serializePayoutRequest(completedRequest.id, completedRequest),
  });
};

const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: jsonHeaders, body: '' };
  }

  try {
    const decoded = await verifyAdmin(event);
    if (event.httpMethod === 'GET') {
      return listPayouts(event);
    }
    if (event.httpMethod === 'POST') {
      const body = JSON.parse(event.body || '{}');
      if (normalizeString(body.action).toLowerCase() !== 'complete') {
        return json(400, { success: false, message: 'Unsupported payout action.' });
      }
      return completePayout({ body, decoded });
    }
    return json(405, { success: false, message: 'Method Not Allowed' });
  } catch (error) {
    const statusCode = Number(error.statusCode) || 500;
    if (statusCode >= 500) {
      console.error('[PulseCheckAdminPayouts] Request failed:', error);
    }
    return json(statusCode, {
      success: false,
      message: error.message || 'Payout records could not be loaded.',
    });
  }
};

module.exports = {
  completePayout,
  handler,
  verifyAdmin,
};
