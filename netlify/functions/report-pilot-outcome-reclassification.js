const { initializeFirebaseAdmin, getFirebaseAdminApp, admin, headers } = require('./config/firebase');
const {
  buildPilotSurveyReclassificationReport,
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

function buildOpsGuidance(report) {
  const blockedCount = Number(report?.blockedCount || 0);
  const applyReadyCount = Number(report?.applyReadyCount || 0);

  return {
    readiness: blockedCount > 0 ? 'hold_for_manual_review' : applyReadyCount > 0 ? 'ready_for_staged_apply' : 'already_canonical',
    dryRunReviewChecklist: [
      'Confirm blockedCount is zero, or document why each blocked row is acceptable before apply.',
      'Capture the pilot baseline for escalation totals, tier split, status buckets, and median minutes to care before apply.',
      'Review sample patchPreview rows for classifier or disposition side effects that could move escalation denominators.',
      'Use staged rollout first if classifier or disposition logic is changing in the same release window.',
    ],
    comparisonFields: ESCALATION_COMPARISON_FIELDS,
    rollbackCue: 'If escalation status buckets or speed-to-care move unexpectedly after apply, stop rollout, disable outcomes for the pilot if needed, restore exported source docs, and recompute pilot outcome rollups.',
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

  try {
    initializeFirebaseAdmin({ headers: event.headers || {} });
    const adminApp = getFirebaseAdminApp({ headers: event.headers || {} });
    const db = admin.firestore(adminApp);
    const decodedToken = await verifyAuth(event, adminApp);
    const body = JSON.parse(event.body || '{}');

    const pilotId = String(body.pilotId || '').trim();
    if (!pilotId) {
      throw createError(400, 'pilotId is required.');
    }

    const sampleLimit = Math.max(1, Math.min(50, Number(body.sampleLimit || 20)));
    const report = await buildPilotSurveyReclassificationReport({
      db,
      pilotId,
      sampleLimit,
      actorUserId: decodedToken.uid,
      persistRun: body.persistRun !== false,
    });

    return {
      statusCode: 200,
      headers: RESPONSE_HEADERS,
      body: JSON.stringify({
        success: true,
        report,
        opsGuidance: buildOpsGuidance(report),
      }),
    };
  } catch (error) {
    console.error('[report-pilot-outcome-reclassification] Failed:', error);
    return {
      statusCode: error?.statusCode || 500,
      headers: RESPONSE_HEADERS,
      body: JSON.stringify({
        error: error?.message || 'Failed to build pilot outcome reclassification report.',
      }),
    };
  }
};
