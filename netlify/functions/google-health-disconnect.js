const { initializeFirebaseAdmin, admin } = require('./config/firebase');
const {
  CONNECTIONS_COLLECTION,
  RESPONSE_HEADERS,
  buildConnectionDocId,
  buildGoogleHealthErrorResponse,
  revokeGoogleToken,
  toConnectionStatus,
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
    const connectionRef = admin.firestore().collection(CONNECTIONS_COLLECTION).doc(buildConnectionDocId(decoded.uid));
    const connectionSnap = await connectionRef.get();
    if (!connectionSnap.exists) {
      return {
        statusCode: 200,
        headers: RESPONSE_HEADERS,
        body: JSON.stringify({ disconnected: false, connection: toConnectionStatus(null) }),
      };
    }

    const connection = connectionSnap.data() || {};
    const revokeResult = await revokeGoogleToken(connection.refreshToken || connection.accessToken).catch((error) => ({
      revoked: false,
      error: error?.message || String(error),
    }));
    const now = Date.now();
    await connectionRef.set({
      status: 'disconnected',
      disconnectedAt: now,
      updatedAt: now,
      lastRevokeResult: revokeResult,
      accessToken: admin.firestore.FieldValue.delete(),
      refreshToken: admin.firestore.FieldValue.delete(),
      accessTokenExpiresAt: admin.firestore.FieldValue.delete(),
      accessTokenIssuedAt: admin.firestore.FieldValue.delete(),
      lastError: '',
      lastErrorAt: null,
    }, { merge: true });

    const nextSnap = await connectionRef.get();
    return {
      statusCode: 200,
      headers: RESPONSE_HEADERS,
      body: JSON.stringify({ disconnected: true, connection: toConnectionStatus(nextSnap.data()) }),
    };
  } catch (error) {
    console.error('[google-health-disconnect] Failed:', error);
    return buildGoogleHealthErrorResponse(error, {
      errorCode: 'GOOGLE_HEALTH_DISCONNECT_FAILED',
      message: 'We could not disconnect Fitbit right now.',
    });
  }
};
