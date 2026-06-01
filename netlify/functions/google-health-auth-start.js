const { initializeFirebaseAdmin, admin } = require('./config/firebase');
const {
  CONNECTIONS_COLLECTION,
  DEFAULT_RETURN_TO,
  OAUTH_STATES_COLLECTION,
  RESPONSE_HEADERS,
  buildAuthorizeUrl,
  buildConnectionDocId,
  buildGoogleHealthErrorResponse,
  buildStateToken,
  getConfiguredScopes,
  getOauthCredentials,
  getRedirectUri,
  normalizeScopes,
  parseJsonBody,
  sanitizeReturnTo,
  verifyAuth,
} = require('./google-health-utils');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: RESPONSE_HEADERS, body: '' };
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: RESPONSE_HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) };
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
    const db = admin.firestore();

    await db.collection(OAUTH_STATES_COLLECTION).doc(state).set({
      provider: 'google_health',
      sourceFamily: 'fitbit',
      userId: decoded.uid,
      requestedScopes,
      redirectUri,
      returnTo,
      createdAt: now,
      expiresAt: now + 10 * 60 * 1000,
      usedAt: null,
      productsEnabled: {
        pulsecheck: true,
        fit_with_pulse: true,
      },
    });

    const existingConnection = await db.collection(CONNECTIONS_COLLECTION).doc(buildConnectionDocId(decoded.uid)).get();
    return {
      statusCode: 200,
      headers: RESPONSE_HEADERS,
      body: JSON.stringify({
        authorizeUrl: buildAuthorizeUrl({ clientId, redirectUri, scopes: requestedScopes, state }),
        state,
        requestedScopes,
        redirectUri,
        existingStatus: existingConnection.exists ? existingConnection.data()?.status || 'not_connected' : 'not_connected',
      }),
    };
  } catch (error) {
    console.error('[google-health-auth-start] Failed:', error);
    return buildGoogleHealthErrorResponse(error, {
      errorCode: 'GOOGLE_HEALTH_CONNECT_FAILED',
      message: 'We could not start the Fitbit connection right now.',
    });
  }
};
