const { initializeFirebaseAdmin, admin } = require('./config/firebase');
const {
  CONNECTIONS_COLLECTION,
  RESPONSE_HEADERS,
  buildConnectionDocId,
  buildPolarErrorResponse,
  toConnectionStatus,
  verifyAuth,
} = require('./polar-utils');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: RESPONSE_HEADERS, body: '' };
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers: RESPONSE_HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    initializeFirebaseAdmin(event);
    const decoded = await verifyAuth(event);
    const snapshot = await admin.firestore().collection(CONNECTIONS_COLLECTION).doc(buildConnectionDocId(decoded.uid)).get();
    return {
      statusCode: 200,
      headers: RESPONSE_HEADERS,
      body: JSON.stringify(toConnectionStatus(snapshot.exists ? snapshot.data() : null)),
    };
  } catch (error) {
    console.error('[polar-status] Failed:', error);
    return buildPolarErrorResponse(error, {
      errorCode: 'POLAR_STATUS_FAILED',
      message: 'We could not load your Polar connection right now.',
    });
  }
};
