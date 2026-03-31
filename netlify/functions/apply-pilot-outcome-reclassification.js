const { initializeFirebaseAdmin, getFirebaseAdminApp, admin, headers } = require('./config/firebase');
const {
  applyPilotSurveyReclassification,
  recordPilotMetricAlert,
} = require('./utils/pulsecheck-pilot-metrics');

const RESPONSE_HEADERS = {
  ...headers,
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const ESCALATION_COMPARISON_FIELDS = [
  'outcomeMetrics.escalationsTotal',
  'outcomeMetrics.escalationsTier1',
  'outcomeMetrics.escalationsTier2',
  'outcomeMetrics.escalationsTier3',
  'outcomeMetrics.medianMinutesToCare',
  'outcomeOperationalDiagnostics.escalations.statusCounts.active',
  'outcomeOperationalDiagnostics.escalations.statusCounts.resolved',
  'outcomeOperationalDiagnostics.escalations.statusCounts.declined',
];

function buildOpsGuidance(result) {
  const blockedCount = Number(result?.blockedCount || 0);
  const appliedCount = Number(result?.appliedCount || 0);

  return {
    readiness: blockedCount > 0 ? 'staged_follow_up_required' : appliedCount > 0 ? 'compare_before_widening' : 'no_apply_needed',
    comparisonFields: ESCALATION_COMPARISON_FIELDS,
    stagedValidationSteps: [
      'Compare the pilot dashboard before and after apply for escalation totals, tier split, status buckets, and median minutes to care.',
      'Confirm the rollup recompute completed successfully before promoting from staged to live.',
      'If classifier or disposition logic shipped in the same release, validate one pilot through at least one repair cycle before widening rollout.',
      'Hold rollout if active, resolved, or declined counts move unexpectedly without a known classifier or disposition explanation.',
    ],
    rollbackGuidance: [
      'Disable outcomes for the pilot if operators need immediate containment.',
      'Revert classifier or disposition logic to the prior release if the migration changed escalation meaning unexpectedly.',
      'Restore exported source docs and remove backfilled events only when they are outside the exported baseline.',
      'Recompute pilot outcome rollups after restoration and re-check the same escalation comparison fields.',
    ],
  };
}

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
    if (!pilotId) {
      throw createError(400, 'pilotId is required.');
    }

    const sampleLimit = Math.max(1, Math.min(50, Number(body.sampleLimit || 20)));
    const recomputeLookbackDays = Math.max(1, Math.min(90, Number(body.recomputeLookbackDays || 30)));
    const result = await applyPilotSurveyReclassification({
      db,
      pilotId,
      actorUserId: decodedToken.uid,
      sampleLimit,
      recomputeRollups: body.recomputeRollups !== false,
      recomputeLookbackDays,
    });

    return {
      statusCode: 200,
      headers: RESPONSE_HEADERS,
      body: JSON.stringify({
        success: true,
        result,
        opsGuidance: buildOpsGuidance(result),
      }),
    };
  } catch (error) {
    console.error('[apply-pilot-outcome-reclassification] Failed:', error);
    try {
      if (pilotId) {
        initializeFirebaseAdmin({ headers: event.headers || {} });
        const adminApp = getFirebaseAdminApp({ headers: event.headers || {} });
        const db = admin.firestore(adminApp);
        await recordPilotMetricAlert({
          db,
          pilotId,
          scope: 'outcome_reclassification_apply',
          severity: 'error',
          message: error?.message || 'Pilot outcome reclassification apply failed.',
        });
      }
    } catch (nestedError) {
      console.error('[apply-pilot-outcome-reclassification] Failed to record alert:', nestedError);
    }

    return {
      statusCode: error?.statusCode || 500,
      headers: RESPONSE_HEADERS,
      body: JSON.stringify({
        error: error?.message || 'Failed to apply pilot outcome reclassification.',
      }),
    };
  }
};
