const { initializeFirebaseAdmin, getFirebaseAdminApp, admin, headers } = require('./config/firebase');
const {
  clearPilotWatchList,
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

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function hasStaffPrivileges(decodedToken = {}) {
  const role = normalizeString(
    decodedToken.role
    || decodedToken.staffRole
    || decodedToken.claims?.role
    || decodedToken.claims?.staffRole
  ).toLowerCase();

  return decodedToken.admin === true
    || decodedToken.staff === true
    || ['admin', 'team-admin', 'coach', 'performance-staff', 'support-staff', 'clinician', 'staff'].includes(role);
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
    if (!hasStaffPrivileges(decodedToken)) {
      throw createError(403, 'Watch list clearing requires staff privileges.');
    }

    const body = JSON.parse(event.body || '{}');
    const athleteId = normalizeString(body.athleteId);
    if (!athleteId) {
      throw createError(400, 'athleteId is required.');
    }

    pilotId = normalizeString(body.pilotId || '');
    const state = await clearPilotWatchList({
      db,
      athleteId,
      preferredPilotEnrollmentId: normalizeString(body.pilotEnrollmentId) || null,
      preferredPilotId: pilotId || null,
      preferredTeamMembershipId: normalizeString(body.teamMembershipId) || null,
      actorUserId: decodedToken.uid,
      actorRole: normalizeString(body.actorRole) || 'staff',
      reasonCode: normalizeString(body.reasonCode) || null,
      reason: normalizeString(body.reason) || null,
      watchListSource: normalizeString(body.watchListSource) || null,
      linkedIncidentIds: Array.isArray(body.linkedIncidentIds) ? body.linkedIncidentIds : [],
      createdAt: Date.now(),
    });

    return {
      statusCode: 200,
      headers: RESPONSE_HEADERS,
      body: JSON.stringify({
        success: true,
        state,
      }),
    };
  } catch (error) {
    console.error('[clear-pilot-watch-list] Failed:', error);
    try {
      if (pilotId) {
        initializeFirebaseAdmin({ headers: event.headers || {} });
        const adminApp = getFirebaseAdminApp({ headers: event.headers || {} });
        const db = admin.firestore(adminApp);
        await recordPilotMetricAlert({
          db,
          pilotId,
          scope: 'operational_state_clear',
          severity: 'error',
          message: error?.message || 'Pilot watch list clear failed.',
        });
      }
    } catch (nestedError) {
      console.error('[clear-pilot-watch-list] Failed to record alert:', nestedError);
    }

    return {
      statusCode: error?.statusCode || 500,
      headers: RESPONSE_HEADERS,
      body: JSON.stringify({
        error: error?.message || 'Failed to clear pilot watch list.',
      }),
    };
  }
};
