const { initializeFirebaseAdmin, getFirebaseAdminApp, admin, headers } = require('./config/firebase');
const {
  recomputePilotMetricRollups,
  recordPilotMetricAlert,
  savePilotSurveyResponse,
} = require('./utils/pulsecheck-pilot-metrics');

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

  let pilotId = '';

  try {
    initializeFirebaseAdmin({ headers: event.headers || {} });
    const adminApp = getFirebaseAdminApp({ headers: event.headers || {} });
    const db = admin.firestore(adminApp);
    const decodedToken = await verifyAuth(event, adminApp);
    const body = JSON.parse(event.body || '{}');
    pilotId = String(body.pilotId || '').trim();

    const response = await savePilotSurveyResponse({
      db,
      authUserId: decodedToken.uid,
      surveyKind: body.surveyKind,
      score: body.score,
      respondentRole: body.respondentRole,
      source: body.source,
      comment: body.comment,
      pilotId: body.pilotId,
      pilotEnrollmentId: body.pilotEnrollmentId,
      cohortId: body.cohortId,
      teamId: body.teamId,
      organizationId: body.organizationId,
      athleteId: body.athleteId,
      diagnosticBattery: body.trustBattery,
    });

    await recomputePilotMetricRollups({
      db,
      pilotId: response.pilotId,
      explicitDateKeys: [new Date(Number(response.submittedAtMs || Date.now())).toISOString().slice(0, 10)],
    });

    return {
      statusCode: 200,
      headers: RESPONSE_HEADERS,
      body: JSON.stringify({
        success: true,
        response,
      }),
    };
  } catch (error) {
    console.error('[record-pilot-survey-response] Failed:', error);
    try {
      if (pilotId) {
        initializeFirebaseAdmin({ headers: event.headers || {} });
        const adminApp = getFirebaseAdminApp({ headers: event.headers || {} });
        const db = admin.firestore(adminApp);
        await recordPilotMetricAlert({
          db,
          pilotId,
          scope: 'survey_write',
          severity: 'error',
          message: error?.message || 'Failed to record pilot survey response.',
        });
      }
    } catch (nestedError) {
      console.error('[record-pilot-survey-response] Failed to record alert:', nestedError);
    }
    return {
      statusCode: error?.statusCode || 500,
      headers: RESPONSE_HEADERS,
      body: JSON.stringify({
        error: error?.message || 'Failed to record pilot survey response.',
      }),
    };
  }
};
