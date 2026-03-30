const { initializeFirebaseAdmin, getFirebaseAdminApp, admin, headers } = require('./config/firebase');
const {
  buildRepairDateKeys,
  recomputePilotMetricRollups,
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
    await verifyAuth(event, adminApp);
    const body = JSON.parse(event.body || '{}');

    pilotId = String(body.pilotId || '').trim();
    if (!pilotId) {
      throw createError(400, 'pilotId is required.');
    }

    const lookbackDays = Math.max(1, Math.min(90, Number(body.lookbackDays || 30)));
    const explicitDateKeys = buildRepairDateKeys(lookbackDays);
    const rollups = await recomputePilotMetricRollups({
      db,
      pilotId,
      explicitDateKeys,
    });

    return {
      statusCode: 200,
      headers: RESPONSE_HEADERS,
      body: JSON.stringify({
        success: true,
        pilotId,
        lookbackDays,
        explicitDateKeys,
        rollups,
      }),
    };
  } catch (error) {
    console.error('[recompute-pilot-outcome-rollups] Failed:', error);
    try {
      if (pilotId) {
        initializeFirebaseAdmin({ headers: event.headers || {} });
        const adminApp = getFirebaseAdminApp({ headers: event.headers || {} });
        const db = admin.firestore(adminApp);
        await recordPilotMetricAlert({
          db,
          pilotId,
          scope: 'manual_recompute',
          severity: 'error',
          message: error?.message || 'Manual pilot outcome recompute failed.',
        });
      }
    } catch (nestedError) {
      console.error('[recompute-pilot-outcome-rollups] Failed to record alert:', nestedError);
    }

    return {
      statusCode: error?.statusCode || 500,
      headers: RESPONSE_HEADERS,
      body: JSON.stringify({
        error: error?.message || 'Failed to recompute pilot outcome rollups.',
      }),
    };
  }
};
