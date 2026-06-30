const { initializeFirebaseAdmin, admin } = require('./config/firebase');
const {
  CONNECTIONS_COLLECTION,
  RESPONSE_HEADERS,
  buildConnectionDocId,
  buildWhoopErrorResponse,
  toConnectionStatus,
  verifyAuth,
  whoopApiRequest,
} = require('./whoop-utils');

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
    if (connection.accessToken) {
      await whoopApiRequest(connection.accessToken, '/v2/user/access', { method: 'DELETE' }).catch((error) => {
        console.warn('[whoop-disconnect] WHOOP access revoke failed; clearing local token anyway:', error?.message || error);
      });
    }

    const now = Date.now();
    await connectionRef.set({
      status: 'disconnected',
      disconnectedAt: now,
      updatedAt: now,
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
    console.error('[whoop-disconnect] Failed:', error);
    return buildWhoopErrorResponse(error, {
      errorCode: 'WHOOP_DISCONNECT_FAILED',
      message: 'We could not disconnect WHOOP right now.',
    });
  }
};
