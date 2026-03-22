const { initializeFirebaseAdmin, admin } = require('./config/firebase');
const {
  CONNECTIONS_COLLECTION,
  RESPONSE_HEADERS,
  buildOuraErrorResponse,
  buildConnectionDocId,
  toConnectionStatus,
  verifyAuth,
} = require('./oura-utils');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: RESPONSE_HEADERS, body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: RESPONSE_HEADERS,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    initializeFirebaseAdmin(event);
    const decoded = await verifyAuth(event);
    const snapshot = await admin
      .firestore()
      .collection(CONNECTIONS_COLLECTION)
      .doc(buildConnectionDocId(decoded.uid))
      .get();

    return {
      statusCode: 200,
      headers: RESPONSE_HEADERS,
      body: JSON.stringify(toConnectionStatus(snapshot.exists ? snapshot.data() : null)),
    };
  } catch (error) {
    console.error('[oura-status] Failed:', error);
    return buildOuraErrorResponse(error, {
      errorCode: 'OURA_STATUS_FAILED',
      message: 'We could not load your Oura connection right now.',
    });
  }
};
