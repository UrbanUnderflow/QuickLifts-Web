const { initializeFirebaseAdmin, admin } = require('./config/firebase');
const {
  CONNECTIONS_COLLECTION,
  DEFAULT_RETURN_TO,
  OAUTH_STATES_COLLECTION,
  RESPONSE_HEADERS,
  appendQueryParams,
  buildConnectionDocId,
  exchangeCodeForToken,
  getGoogleHealthIdentity,
  getQueryParams,
  getRedirectUri,
  normalizeGoogleHealthError,
  redirectHtml,
  sanitizeReturnTo,
} = require('./google-health-utils');

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
      message: 'The Fitbit callback only accepts GET requests.',
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
      message: 'Pulse could not verify this Fitbit connection request.',
      redirectTo: buildRedirectTarget(DEFAULT_RETURN_TO, { status: 'error', error: 'missing_state' }),
    }));
  }

  try {
    stateData = await db.runTransaction(async (transaction) => {
      const stateRef = db.collection(OAUTH_STATES_COLLECTION).doc(stateToken);
      const stateSnap = await transaction.get(stateRef);
      if (!stateSnap.exists) throw Object.assign(new Error('This Fitbit connection request was not found.'), { statusCode: 400 });
      const data = stateSnap.data() || {};
      if (data.provider !== 'google_health') {
        throw Object.assign(new Error('This Fitbit connection request is no longer active.'), { statusCode: 400 });
      }
      if (data.usedAt) throw Object.assign(new Error('This Fitbit connection request has already been used.'), { statusCode: 400 });
      if (typeof data.expiresAt === 'number' && Date.now() > data.expiresAt) {
        transaction.update(stateRef, { usedAt: Date.now(), result: 'expired' });
        throw Object.assign(new Error('This Fitbit connection request has expired. Please start again.'), { statusCode: 400 });
      }
      transaction.update(stateRef, { usedAt: Date.now(), callbackReceivedAt: Date.now(), callbackError: returnedError || null });
      return { id: stateSnap.id, ...data };
    });
  } catch (error) {
    const resolved = normalizeGoogleHealthError(error, {
      errorCode: 'GOOGLE_HEALTH_CALLBACK_INVALID_STATE',
      message: 'This Fitbit connection request is no longer active.',
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
      title: 'Fitbit Access Not Granted',
      message: 'No changes were made because Google Health access was not granted.',
      redirectTo: buildRedirectTarget(returnTo, { status: 'denied', error: returnedError }),
    }));
  }

  if (!code) {
    return buildHtmlResponse(400, redirectHtml({
      title: 'Missing Authorization Code',
      message: 'Google returned to Pulse without an authorization code.',
      redirectTo: buildRedirectTarget(returnTo, { status: 'error', error: 'missing_code' }),
    }));
  }

  try {
    const tokenData = await exchangeCodeForToken({ code, redirectUri: stateData.redirectUri || getRedirectUri() });
    const identity = tokenData.access_token ? await getGoogleHealthIdentity(tokenData.access_token) : {};
    const now = Date.now();
    const grantedScopes = typeof tokenData.scope === 'string'
      ? tokenData.scope.split(/\s+/).filter(Boolean)
      : Array.isArray(stateData.requestedScopes)
        ? stateData.requestedScopes
        : [];
    const connectionRef = db.collection(CONNECTIONS_COLLECTION).doc(buildConnectionDocId(stateData.userId));
    const existingConnectionSnap = await connectionRef.get();
    const existingConnection = existingConnectionSnap.exists ? existingConnectionSnap.data() || {} : {};
    const payload = {
      provider: 'google_health',
      sourceFamily: 'fitbit',
      userId: stateData.userId,
      status: 'connected',
      requestedScopes: Array.isArray(stateData.requestedScopes) ? stateData.requestedScopes : [],
      grantedScopes,
      tokenType: tokenData.token_type || 'Bearer',
      accessToken: tokenData.access_token || '',
      refreshToken: tokenData.refresh_token || existingConnection.refreshToken || '',
      accessTokenExpiresAt: typeof tokenData.expires_in === 'number' ? Math.floor(now / 1000) + tokenData.expires_in : null,
      accessTokenIssuedAt: Math.floor(now / 1000),
      connectedAt: now,
      disconnectedAt: null,
      updatedAt: now,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      redirectUri: stateData.redirectUri || getRedirectUri(),
      healthUserId: identity?.healthUserId || null,
      legacyUserId: identity?.legacyUserId || null,
      identityName: identity?.name || null,
      productsEnabled: stateData.productsEnabled || {
        pulsecheck: true,
        fit_with_pulse: true,
      },
      lastError: '',
      lastErrorAt: null,
    };

    await connectionRef.set(payload, { merge: true });
    await db.collection(OAUTH_STATES_COLLECTION).doc(stateToken).set({ result: 'connected', completedAt: now }, { merge: true });

    return buildHtmlResponse(200, redirectHtml({
      title: 'Fitbit Connected',
      message: 'Pulse linked your Google Health account successfully.',
      redirectTo: buildRedirectTarget(returnTo, { status: 'connected' }),
    }));
  } catch (error) {
    console.error('[google-health-callback] Failed:', error);
    const resolved = normalizeGoogleHealthError(error, {
      errorCode: 'GOOGLE_HEALTH_CALLBACK_FAILED',
      message: 'We could not finish the Fitbit connection right now.',
      statusCode: 500,
    });
    if (stateData?.userId) {
      await db.collection(CONNECTIONS_COLLECTION).doc(buildConnectionDocId(stateData.userId)).set({
        provider: 'google_health',
        sourceFamily: 'fitbit',
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
