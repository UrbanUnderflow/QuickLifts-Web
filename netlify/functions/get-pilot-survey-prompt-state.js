const { initializeFirebaseAdmin, getFirebaseAdminApp, admin, headers } = require('./config/firebase');
const { getAthletePilotSurveyPromptState } = require('./utils/pulsecheck-pilot-metrics');

const RESPONSE_HEADERS = {
  ...headers,
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function createError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

async function verifyAuth(event, adminApp) {
  const authHeader = event.headers?.authorization || event.headers?.Authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw createError(401, 'Missing Authorization header');
  }

  return admin.auth(adminApp).verifyIdToken(authHeader.slice('Bearer '.length));
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

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
    initializeFirebaseAdmin({ headers: event.headers || {} });
    const adminApp = getFirebaseAdminApp({ headers: event.headers || {} });
    const db = admin.firestore(adminApp);
    const decodedToken = await verifyAuth(event, adminApp);
    const body = JSON.parse(event.body || '{}');

    const athleteId = normalizeString(body.athleteId || decodedToken.uid);
    if (!athleteId || athleteId !== decodedToken.uid) {
      throw createError(403, 'Authenticated user does not match requested athlete.');
    }

    const promptState = await getAthletePilotSurveyPromptState({
      db,
      athleteId,
      preferredPilotEnrollmentId: normalizeString(body.pilotEnrollmentId) || null,
      preferredPilotId: normalizeString(body.pilotId) || null,
    });

    return {
      statusCode: 200,
      headers: RESPONSE_HEADERS,
      body: JSON.stringify({
        success: true,
        promptState,
      }),
    };
  } catch (error) {
    console.error('[get-pilot-survey-prompt-state] Failed:', error);
    return {
      statusCode: error?.statusCode || 500,
      headers: RESPONSE_HEADERS,
      body: JSON.stringify({
        error: error?.message || 'Failed to load pilot survey prompt state.',
      }),
    };
  }
};
