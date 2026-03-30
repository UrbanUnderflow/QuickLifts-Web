const { initializeFirebaseAdmin, getFirebaseAdminApp, admin, headers } = require('./config/firebase');
const {
  OUTCOME_BACKFILL_LOOKBACK_DAYS,
  backfillPilotAthleteOutcomeHistory,
  recordPilotMetricAlert,
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
    const athleteId = String(body.athleteId || '').trim();
    if (!pilotId || !athleteId) {
      throw createError(400, 'pilotId and athleteId are required.');
    }

    const result = await backfillPilotAthleteOutcomeHistory({
      db,
      athleteId,
      preferredPilotId: pilotId,
      preferredPilotEnrollmentId: String(body.pilotEnrollmentId || '').trim() || null,
      preferredTeamMembershipId: String(body.teamMembershipId || '').trim() || null,
      lookbackDays: Math.max(1, Math.min(30, Number(body.lookbackDays || OUTCOME_BACKFILL_LOOKBACK_DAYS))),
      actorRole: body.actorRole === 'athlete' ? 'athlete' : 'admin',
      actorUserId: decodedToken.uid,
      source: String(body.source || 'manual_seed').trim() || 'manual_seed',
      stampAssignments: body.stampAssignments !== false,
      recompute: true,
    });

    return {
      statusCode: 200,
      headers: RESPONSE_HEADERS,
      body: JSON.stringify(result),
    };
  } catch (error) {
    console.error('[backfill-pilot-athlete-outcomes] Failed:', error);
    try {
      if (pilotId) {
        initializeFirebaseAdmin({ headers: event.headers || {} });
        const adminApp = getFirebaseAdminApp({ headers: event.headers || {} });
        const db = admin.firestore(adminApp);
        await recordPilotMetricAlert({
          db,
          pilotId,
          scope: 'pilot_athlete_backfill',
          severity: 'error',
          message: error?.message || 'Pilot athlete backfill failed.',
        });
      }
    } catch (nestedError) {
      console.error('[backfill-pilot-athlete-outcomes] Failed to record alert:', nestedError);
    }

    return {
      statusCode: error?.statusCode || 500,
      headers: RESPONSE_HEADERS,
      body: JSON.stringify({
        error: error?.message || 'Failed to backfill pilot athlete outcomes.',
      }),
    };
  }
};
