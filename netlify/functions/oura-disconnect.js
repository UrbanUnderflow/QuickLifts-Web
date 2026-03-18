const { initializeFirebaseAdmin, admin } = require('./config/firebase');
const {
  CONNECTIONS_COLLECTION,
  RESPONSE_HEADERS,
  buildConnectionDocId,
  revokeAccessToken,
  toConnectionStatus,
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
    const docId = buildConnectionDocId(decoded.uid);
    const connectionRef = admin.firestore().collection(CONNECTIONS_COLLECTION).doc(docId);
    const connectionSnap = await connectionRef.get();

    if (!connectionSnap.exists) {
      return {
        statusCode: 200,
        headers: RESPONSE_HEADERS,
        body: JSON.stringify({
          disconnected: false,
          connection: toConnectionStatus(null),
        }),
      };
    }

    const existing = connectionSnap.data() || {};
    if (existing.accessToken) {
      try {
        await revokeAccessToken(existing.accessToken);
      } catch (error) {
        console.warn('[oura-disconnect] Revoke call failed, continuing with local disconnect:', error?.message || error);
      }
    }

    const now = Date.now();
    await connectionRef.set(
      {
        status: 'disconnected',
        disconnectedAt: now,
        updatedAt: now,
        accessToken: admin.firestore.FieldValue.delete(),
        refreshToken: admin.firestore.FieldValue.delete(),
        accessTokenExpiresAt: admin.firestore.FieldValue.delete(),
        accessTokenIssuedAt: admin.firestore.FieldValue.delete(),
        lastError: '',
        lastErrorAt: null,
      },
      { merge: true }
    );

    const nextSnap = await connectionRef.get();
    return {
      statusCode: 200,
      headers: RESPONSE_HEADERS,
      body: JSON.stringify({
        disconnected: true,
        connection: toConnectionStatus(nextSnap.data()),
      }),
    };
  } catch (error) {
    console.error('[oura-disconnect] Failed:', error);
    return {
      statusCode: error.statusCode || 500,
      headers: RESPONSE_HEADERS,
      body: JSON.stringify({
        error: error?.message || 'Failed to disconnect Oura.',
      }),
    };
  }
};
