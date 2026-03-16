const { initializeFirebaseAdmin } = require('./config/firebase');

const COLLECTION = 'vision-runtime-packages';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Content-Type': 'application/json',
};

function json(statusCode, body) {
  return {
    statusCode,
    headers,
    body: JSON.stringify(body),
  };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return json(200, { ok: true });
  }

  if (event.httpMethod !== 'GET') {
    return json(405, { error: 'Method not allowed' });
  }

  const packageId = event.queryStringParameters?.packageId?.trim();
  if (!packageId) {
    return json(400, { error: 'packageId is required' });
  }

  try {
    const admin = initializeFirebaseAdmin({ headers: event.headers || {} });
    const db = admin.firestore();
    const snapshot = await db.collection(COLLECTION).doc(packageId).get();

    if (!snapshot.exists) {
      return json(404, { error: 'Vision runtime package manifest not found' });
    }

    return json(200, {
      manifest: {
        packageId: snapshot.id,
        ...snapshot.data(),
      },
    });
  } catch (error) {
    console.error('[get-vision-runtime-package-manifest] Error:', error);
    return json(500, {
      error: error.message || 'Failed to load Vision runtime package manifest',
    });
  }
};
