const { initializeFirebaseAdmin, getFirebaseAdminApp, admin, headers } = require('./config/firebase');
const {
  loadPilotOperationalState,
  recordPilotMetricAlert,
  resolvePilotEnrollmentContext,
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
    const body = JSON.parse(event.body || '{}');
    const athleteId = normalizeString(body.athleteId || decodedToken.uid);
    const allowedSelfLookup = athleteId && athleteId === decodedToken.uid;

    if (!hasStaffPrivileges(decodedToken) && !allowedSelfLookup) {
      throw createError(403, 'Not authorized to view this pilot operational state.');
    }

    const context = await resolvePilotEnrollmentContext({
      db,
      athleteId,
      preferredPilotEnrollmentId: normalizeString(body.pilotEnrollmentId) || null,
      preferredPilotId: normalizeString(body.pilotId) || null,
      preferredTeamMembershipId: normalizeString(body.teamMembershipId) || null,
      allowMembershipFallback: false,
    });

    pilotId = normalizeString(context?.pilotId || body.pilotId || '');
    if (!context?.pilotEnrollmentId) {
      throw createError(404, 'Unable to resolve a pilot enrollment for this athlete.');
    }

    const state = await loadPilotOperationalState(db, context.pilotEnrollmentId, {
      pilotEnrollment: context.pilotEnrollment,
      teamMembership: context.teamMembership,
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
    console.error('[get-pilot-operational-state] Failed:', error);
    try {
      if (pilotId) {
        initializeFirebaseAdmin({ headers: event.headers || {} });
        const adminApp = getFirebaseAdminApp({ headers: event.headers || {} });
        const db = admin.firestore(adminApp);
        await recordPilotMetricAlert({
          db,
          pilotId,
          scope: 'operational_state_read',
          severity: 'error',
          message: error?.message || 'Pilot operational state read failed.',
        });
      }
    } catch (nestedError) {
      console.error('[get-pilot-operational-state] Failed to record alert:', nestedError);
    }

    return {
      statusCode: error?.statusCode || 500,
      headers: RESPONSE_HEADERS,
      body: JSON.stringify({
        error: error?.message || 'Failed to load pilot operational state.',
      }),
    };
  }
};
