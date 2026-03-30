const { initializeFirebaseAdmin, getFirebaseAdminApp, admin, headers } = require('./config/firebase');
const {
  recordPilotMetricAlert,
  recomputePilotMetricRollups,
  upsertPilotMentalPerformanceSnapshot,
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

  let pilotId = '';

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

    const snapshotType = normalizeString(body.snapshotType);
    if (!['baseline', 'current_latest_valid', 'endpoint'].includes(snapshotType)) {
      throw createError(400, 'snapshotType must be baseline, current_latest_valid, or endpoint.');
    }

    const pilotContext = await resolvePilotEnrollmentContext({
      db,
      athleteId,
      preferredPilotEnrollmentId: normalizeString(body.pilotEnrollmentId) || null,
      preferredPilotId: normalizeString(body.pilotId) || null,
      preferredTeamMembershipId: normalizeString(body.teamMembershipId) || null,
      allowMembershipFallback: false,
    });

    if (!pilotContext?.pilotEnrollmentId) {
      throw createError(404, 'Pilot enrollment context not found for athlete.');
    }
    pilotId = pilotContext.pilotId || '';

    const freezeReason = normalizeString(body.freezeReason) || null;
    const frozenAt = Date.now();
    const snapshot = await upsertPilotMentalPerformanceSnapshot({
      db,
      athleteId,
      snapshotType,
      preferredPilotEnrollmentId: pilotContext.pilotEnrollmentId,
      preferredPilotId: pilotContext.pilotId,
      preferredTeamMembershipId: pilotContext.teamMembershipId,
      sourceEventId: normalizeString(body.sourceEventId) || `manual_snapshot_sync:${snapshotType}:${athleteId}:${frozenAt}`,
      endpointFreeze:
        snapshotType === 'endpoint'
          ? {
              frozen: true,
              frozenAt,
              freezeReason: freezeReason || 'manual_override',
            }
          : null,
    });

    if (pilotContext?.pilotId) {
      const candidateDateKey = new Date(
        Number(snapshot?.capturedAt || snapshot?.computedAt || Date.now())
      ).toISOString().slice(0, 10);
      await recomputePilotMetricRollups({
        db,
        pilotId: pilotContext.pilotId,
        explicitDateKeys: [candidateDateKey],
      });
    }

    return {
      statusCode: 200,
      headers: RESPONSE_HEADERS,
      body: JSON.stringify({
        success: true,
        snapshot,
      }),
    };
  } catch (error) {
    console.error('[sync-pilot-mental-performance-snapshot] Failed:', error);
    try {
      if (pilotId) {
        initializeFirebaseAdmin({ headers: event.headers || {} });
        const adminApp = getFirebaseAdminApp({ headers: event.headers || {} });
        const db = admin.firestore(adminApp);
        await recordPilotMetricAlert({
          db,
          pilotId,
          scope: 'snapshot_sync',
          severity: 'error',
          message: error?.message || 'Failed to sync pilot mental performance snapshot.',
        });
      }
    } catch (nestedError) {
      console.error('[sync-pilot-mental-performance-snapshot] Failed to record alert:', nestedError);
    }
    return {
      statusCode: error?.statusCode || 500,
      headers: RESPONSE_HEADERS,
      body: JSON.stringify({
        error: error?.message || 'Failed to sync pilot mental performance snapshot.',
      }),
    };
  }
};
