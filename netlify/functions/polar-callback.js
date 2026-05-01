const { initializeFirebaseAdmin, admin } = require('./config/firebase');
const {
  CONNECTIONS_COLLECTION,
  DEFAULT_RETURN_TO,
  OAUTH_STATES_COLLECTION,
  RESPONSE_HEADERS,
  appendQueryParams,
  buildConnectionDocId,
  exchangeCodeForToken,
  getQueryParams,
  getRedirectUri,
  normalizePolarError,
  redirectHtml,
  registerPolarUser,
  sanitizeReturnTo,
} = require('./polar-utils');

function buildHtmlResponse(statusCode, html) {
  return {
    statusCode,
    headers: {
      ...RESPONSE_HEADERS,
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
    body: html,
  };
}

function buildRedirectTarget(returnTo, params) {
  return appendQueryParams(returnTo || DEFAULT_RETURN_TO, params);
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: RESPONSE_HEADERS, body: '' };
  if (event.httpMethod !== 'GET') {
    return buildHtmlResponse(405, redirectHtml({
      title: 'Unsupported Request',
      message: 'The Polar callback only accepts GET requests.',
      redirectTo: buildRedirectTarget(DEFAULT_RETURN_TO, { status: 'error', error: 'method_not_allowed' }),
    }));
  }

  initializeFirebaseAdmin(event);
  const query = getQueryParams(event);
  const stateToken = typeof query.state === 'string' ? query.state : '';
  const code = typeof query.code === 'string' ? query.code : '';
  const returnedError = typeof query.error === 'string' ? query.error : '';
  const db = admin.firestore();
  let stateData = null;

  if (!stateToken) {
    return buildHtmlResponse(400, redirectHtml({
      title: 'Missing State',
      message: 'Pulse could not verify this Polar connection request.',
      redirectTo: buildRedirectTarget(DEFAULT_RETURN_TO, { status: 'error', error: 'missing_state' }),
    }));
  }

  try {
    stateData = await db.runTransaction(async (transaction) => {
      const stateRef = db.collection(OAUTH_STATES_COLLECTION).doc(stateToken);
      const stateSnap = await transaction.get(stateRef);
      if (!stateSnap.exists) throw Object.assign(new Error('This Polar connection request was not found.'), { statusCode: 400 });
      const data = stateSnap.data() || {};
      if (data.usedAt) throw Object.assign(new Error('This Polar connection request has already been used.'), { statusCode: 400 });
      if (typeof data.expiresAt === 'number' && Date.now() > data.expiresAt) {
        transaction.update(stateRef, { usedAt: Date.now(), result: 'expired' });
        throw Object.assign(new Error('This Polar connection request has expired. Please start again.'), { statusCode: 400 });
      }
      transaction.update(stateRef, { usedAt: Date.now(), callbackReceivedAt: Date.now(), callbackError: returnedError || null });
      return { id: stateSnap.id, ...data };
    });
  } catch (error) {
    const resolved = normalizePolarError(error, {
      errorCode: 'POLAR_CALLBACK_INVALID_STATE',
      message: 'This Polar connection request is no longer active.',
      statusCode: 400,
    });
    return buildHtmlResponse(resolved.statusCode, redirectHtml({
      title: 'Connection Expired',
      message: resolved.message,
      redirectTo: buildRedirectTarget(DEFAULT_RETURN_TO, { status: 'error', error: resolved.errorCode }),
    }));
  }

  const returnTo = sanitizeReturnTo(stateData.returnTo || DEFAULT_RETURN_TO);
  if (returnedError) {
    return buildHtmlResponse(200, redirectHtml({
      title: 'Polar Access Not Granted',
      message: 'No changes were made because Polar access was not granted.',
      redirectTo: buildRedirectTarget(returnTo, { status: 'denied', error: returnedError }),
    }));
  }

  if (!code) {
    return buildHtmlResponse(400, redirectHtml({
      title: 'Missing Authorization Code',
      message: 'Polar returned to Pulse without an authorization code.',
      redirectTo: buildRedirectTarget(returnTo, { status: 'error', error: 'missing_code' }),
    }));
  }

  try {
    const tokenData = await exchangeCodeForToken({ code, redirectUri: stateData.redirectUri || getRedirectUri() });
    const registration = await registerPolarUser(tokenData.access_token || '', stateData.userId);
    const now = Date.now();
    const connectionRef = db.collection(CONNECTIONS_COLLECTION).doc(buildConnectionDocId(stateData.userId));
    const payload = {
      provider: 'polar',
      userId: stateData.userId,
      status: 'connected',
      requestedScopes: Array.isArray(stateData.requestedScopes) ? stateData.requestedScopes : [],
      grantedScopes: ['accesslink.read_all'],
      tokenType: tokenData.token_type || 'bearer',
      accessToken: tokenData.access_token || '',
      refreshToken: tokenData.refresh_token || '',
      accessTokenExpiresAt: typeof tokenData.expires_in === 'number' ? now + tokenData.expires_in * 1000 : null,
      accessTokenIssuedAt: now,
      connectedAt: now,
      disconnectedAt: null,
      updatedAt: now,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      redirectUri: stateData.redirectUri || getRedirectUri(),
      polarUserId: registration?.['polar-user-id'] || registration?.['polar_user_id'] || tokenData.x_user_id || null,
      memberId: registration?.['member-id'] || registration?.memberId || stateData.userId,
      firstName: registration?.['first-name'] || null,
      lastName: registration?.['last-name'] || null,
      registration,
      lastError: '',
      lastErrorAt: null,
    };

    await connectionRef.set(payload, { merge: true });
    await db.collection(OAUTH_STATES_COLLECTION).doc(stateToken).set({ result: 'connected', completedAt: now }, { merge: true });

    return buildHtmlResponse(200, redirectHtml({
      title: 'Polar Connected',
      message: 'Pulse linked your Polar account successfully.',
      redirectTo: buildRedirectTarget(returnTo, { status: 'connected' }),
    }));
  } catch (error) {
    console.error('[polar-callback] Failed:', error);
    const resolved = normalizePolarError(error, {
      errorCode: 'POLAR_CALLBACK_FAILED',
      message: 'We could not finish the Polar connection right now.',
      statusCode: 500,
    });
    if (stateData?.userId) {
      await db.collection(CONNECTIONS_COLLECTION).doc(buildConnectionDocId(stateData.userId)).set({
        provider: 'polar',
        userId: stateData.userId,
        status: 'error',
        updatedAt: Date.now(),
        lastError: error?.message || 'Callback failed',
        lastErrorAt: Date.now(),
      }, { merge: true });
    }
    return buildHtmlResponse(resolved.statusCode, redirectHtml({
      title: 'Connection Failed',
      message: resolved.message,
      redirectTo: buildRedirectTarget(returnTo, { status: 'error', error: resolved.errorCode }),
    }));
  }
};
