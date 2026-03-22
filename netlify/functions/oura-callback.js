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
  normalizeOuraError,
  redirectHtml,
  sanitizeReturnTo,
} = require('./oura-utils');

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
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: RESPONSE_HEADERS, body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return buildHtmlResponse(
      405,
      redirectHtml({
        title: 'Unsupported Request',
        message: 'The Oura callback only accepts GET requests.',
        redirectTo: buildRedirectTarget(DEFAULT_RETURN_TO, { status: 'error', error: 'method_not_allowed' }),
      })
    );
  }

  initializeFirebaseAdmin(event);

  const query = getQueryParams(event);
  const stateToken = typeof query.state === 'string' ? query.state : '';
  const code = typeof query.code === 'string' ? query.code : '';
  const grantedScopeString = typeof query.scope === 'string' ? query.scope : '';
  const returnedError = typeof query.error === 'string' ? query.error : '';
  const db = admin.firestore();
  let stateData = null;

  if (!stateToken) {
    return buildHtmlResponse(
      400,
      redirectHtml({
        title: 'Missing State',
        message: 'Pulse could not verify this Oura connection request.',
        redirectTo: buildRedirectTarget(DEFAULT_RETURN_TO, { status: 'error', error: 'missing_state' }),
      })
    );
  }

  try {
    stateData = await db.runTransaction(async (transaction) => {
      const stateRef = db.collection(OAUTH_STATES_COLLECTION).doc(stateToken);
      const stateSnap = await transaction.get(stateRef);
      if (!stateSnap.exists) {
        throw Object.assign(new Error('This Oura connection request was not found.'), { statusCode: 400 });
      }

      const data = stateSnap.data() || {};
      if (data.usedAt) {
        throw Object.assign(new Error('This Oura connection request has already been used.'), { statusCode: 400 });
      }

      if (typeof data.expiresAt === 'number' && Date.now() > data.expiresAt) {
        transaction.update(stateRef, {
          usedAt: Date.now(),
          result: 'expired',
        });
        throw Object.assign(new Error('This Oura connection request has expired. Please start again.'), { statusCode: 400 });
      }

      transaction.update(stateRef, {
        usedAt: Date.now(),
        callbackReceivedAt: Date.now(),
        callbackError: returnedError || null,
      });

      return { id: stateSnap.id, ...data };
    });
  } catch (error) {
    const resolvedError = normalizeOuraError(error, {
      errorCode: 'OURA_CALLBACK_INVALID_STATE',
      message: 'This Oura connection request is no longer active.',
      statusCode: 400,
    });
    return buildHtmlResponse(
      resolvedError.statusCode,
      redirectHtml({
        title: 'Connection Expired',
        message: resolvedError.message,
        redirectTo: buildRedirectTarget(DEFAULT_RETURN_TO, { status: 'error', error: resolvedError.errorCode }),
      })
    );
  }

  const returnTo = sanitizeReturnTo(stateData.returnTo || DEFAULT_RETURN_TO);
  if (returnedError) {
    const target = buildRedirectTarget(returnTo, { status: 'denied', error: returnedError });
    return buildHtmlResponse(
      200,
      redirectHtml({
        title: 'Oura Access Not Granted',
        message: 'No changes were made because Oura access was not granted.',
        redirectTo: target,
      })
    );
  }

  if (!code) {
    const target = buildRedirectTarget(returnTo, { status: 'error', error: 'missing_code' });
    return buildHtmlResponse(
      400,
      redirectHtml({
        title: 'Missing Authorization Code',
        message: 'Oura returned to Pulse without an authorization code.',
        redirectTo: target,
      })
    );
  }

  try {
    const tokenData = await exchangeCodeForToken({
      code,
      redirectUri: stateData.redirectUri || getRedirectUri(),
    });
    const grantedScopes = grantedScopeString
      ? grantedScopeString.split(/\s+/).map((value) => value.trim()).filter(Boolean)
      : Array.isArray(stateData.requestedScopes)
      ? stateData.requestedScopes
      : [];
    const now = Date.now();
    const connectionRef = db.collection(CONNECTIONS_COLLECTION).doc(buildConnectionDocId(stateData.userId));
    const payload = {
      provider: 'oura',
      userId: stateData.userId,
      status: 'connected',
      requestedScopes: Array.isArray(stateData.requestedScopes) ? stateData.requestedScopes : [],
      grantedScopes,
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
      lastError: '',
      lastErrorAt: null,
    };

    await connectionRef.set(payload, { merge: true });
    await db.collection(OAUTH_STATES_COLLECTION).doc(stateToken).set(
      {
        result: 'connected',
        completedAt: now,
        grantedScopes,
      },
      { merge: true }
    );

    const target = buildRedirectTarget(returnTo, { status: 'connected' });
    return buildHtmlResponse(
      200,
      redirectHtml({
        title: 'Oura Connected',
        message: 'Pulse linked your Oura account successfully.',
        redirectTo: target,
      })
    );
  } catch (error) {
    console.error('[oura-callback] Failed:', error);
    const resolvedError = normalizeOuraError(error, {
      errorCode: 'OURA_CALLBACK_FAILED',
      message: 'We could not finish the Oura connection right now.',
      statusCode: 500,
    });

    if (stateData?.userId) {
      await db.collection(CONNECTIONS_COLLECTION).doc(buildConnectionDocId(stateData.userId)).set(
        {
          provider: 'oura',
          userId: stateData.userId,
          status: 'error',
          requestedScopes: Array.isArray(stateData.requestedScopes) ? stateData.requestedScopes : [],
          grantedScopes: [],
          redirectUri: stateData.redirectUri || getRedirectUri(),
          updatedAt: Date.now(),
          lastError: error?.message || 'Callback failed',
          lastErrorAt: Date.now(),
        },
        { merge: true }
      );
    }

    await db.collection(OAUTH_STATES_COLLECTION).doc(stateToken).set(
      {
        result: 'error',
        completedAt: Date.now(),
        lastError: error?.message || 'Callback failed',
      },
      { merge: true }
    );

    return buildHtmlResponse(
      resolvedError.statusCode,
      redirectHtml({
        title: 'Connection Failed',
        message: resolvedError.message,
        redirectTo: buildRedirectTarget(returnTo, { status: 'error', error: resolvedError.errorCode }),
      })
    );
  }
};
