const { initializeFirebaseAdmin, admin } = require('./config/firebase');
const {
  CONNECTIONS_COLLECTION,
  DEFAULT_RETURN_TO,
  OAUTH_STATES_COLLECTION,
  RESPONSE_HEADERS,
  buildAuthorizeUrl,
  buildStateToken,
  getConfiguredScopes,
  getOauthCredentials,
  getRedirectUri,
  normalizeScopes,
  parseJsonBody,
  sanitizeReturnTo,
  verifyAuth,
} = require('./oura-utils');

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
    const requestedScopes = normalizeScopes(body.scopes || getConfiguredScopes());
    const returnTo = sanitizeReturnTo(body.returnTo || DEFAULT_RETURN_TO);
    const redirectUri = getRedirectUri();
    const { clientId } = getOauthCredentials();
    const state = buildStateToken();
    const now = Date.now();
    const expiresAt = now + 10 * 60 * 1000;
    const db = admin.firestore();

    await db.collection(OAUTH_STATES_COLLECTION).doc(state).set({
      provider: 'oura',
      userId: decoded.uid,
      requestedScopes,
      redirectUri,
      returnTo,
      createdAt: now,
      expiresAt,
      usedAt: null,
    });

    const existingConnection = await db.collection(CONNECTIONS_COLLECTION).doc(decoded.uid).get();
    const connectionStatus = existingConnection.exists ? existingConnection.data()?.status || '' : '';
    const authorizeUrl = buildAuthorizeUrl({
      clientId,
      redirectUri,
      scopes: requestedScopes,
      state,
    });

    return {
      statusCode: 200,
      headers: RESPONSE_HEADERS,
      body: JSON.stringify({
        authorizeUrl,
        state,
        requestedScopes,
        redirectUri,
        existingStatus: connectionStatus || 'not_connected',
      }),
    };
  } catch (error) {
    console.error('[oura-auth-start] Failed:', error);
    return {
      statusCode: error.statusCode || 500,
      headers: RESPONSE_HEADERS,
      body: JSON.stringify({
        error: error?.message || 'Failed to start Oura authentication.',
      }),
    };
  }
};
