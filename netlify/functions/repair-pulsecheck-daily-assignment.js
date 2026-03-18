const { initializeFirebaseAdmin, admin, headers } = require('./config/firebase');
const { runtimeHelpers: pulseCheckSubmissionRuntime } = require('./submit-pulsecheck-checkin');

const RESPONSE_HEADERS = {
  ...headers,
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const DAILY_ASSIGNMENTS_COLLECTION = 'pulsecheck-daily-assignments';

function isValidSourceDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function todayDateString() {
  return new Date().toISOString().split('T')[0];
}

async function verifyAuth(event) {
  const authHeader = event.headers?.authorization || event.headers?.Authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    const error = new Error('Missing Authorization header');
    error.statusCode = 401;
    throw error;
  }

  const idToken = authHeader.slice('Bearer '.length);
  return admin.auth().verifyIdToken(idToken);
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
    initializeFirebaseAdmin(event);
    const decoded = await verifyAuth(event);
    const body = event.body ? JSON.parse(event.body) : {};
    const userId = body.userId || decoded.uid;
    const sourceDate = isValidSourceDate(body.sourceDate) ? body.sourceDate : todayDateString();
    const assignmentId = `${userId}_${sourceDate}`;
    const db = admin.firestore();

    const existingAssignmentSnap = await db.collection(DAILY_ASSIGNMENTS_COLLECTION).doc(assignmentId).get();
    const existingAssignment = existingAssignmentSnap.exists
      ? { id: existingAssignmentSnap.id, ...existingAssignmentSnap.data() }
      : null;
    const existingSnapshot = await pulseCheckSubmissionRuntime.getSnapshotById(db, assignmentId);

    if (existingAssignment) {
      return {
        statusCode: 200,
        headers: RESPONSE_HEADERS,
        body: JSON.stringify({
          stateSnapshot: existingSnapshot,
          candidateSet: null,
          dailyAssignment: existingAssignment,
          repairApplied: false,
        }),
      };
    }

    if (!existingSnapshot) {
      return {
        statusCode: 200,
        headers: RESPONSE_HEADERS,
        body: JSON.stringify({
          stateSnapshot: null,
          candidateSet: null,
          dailyAssignment: null,
          repairApplied: false,
          detail: 'No shared Pulse Check snapshot exists for that date yet.',
        }),
      };
    }

    const priorProgress = await pulseCheckSubmissionRuntime.loadOrInitializeProgress(db, userId);
    const syncedProgress = await pulseCheckSubmissionRuntime.syncTaxonomyProfile(db, userId, priorProgress);
    const rematerialized = await pulseCheckSubmissionRuntime.rematerializeAssignmentFromSnapshot({
      db,
      athleteId: userId,
      sourceCheckInId:
        existingSnapshot.sourceCheckInId
        || existingSnapshot.rawSignalSummary?.explicitSelfReport?.id
        || '',
      sourceStateSnapshotId: existingSnapshot.id,
      sourceDate,
      progress: syncedProgress,
    });

    return {
      statusCode: 200,
      headers: RESPONSE_HEADERS,
      body: JSON.stringify({
        stateSnapshot: rematerialized?.stateSnapshot || existingSnapshot,
        candidateSet: rematerialized?.candidateSet || null,
        dailyAssignment: rematerialized?.dailyAssignment || null,
        repairApplied: Boolean(rematerialized?.dailyAssignment),
      }),
    };
  } catch (error) {
    console.error('[repair-pulsecheck-daily-assignment] Failed:', error);
    return {
      statusCode: error.statusCode || 500,
      headers: RESPONSE_HEADERS,
      body: JSON.stringify({
        error: error?.message || 'Failed to repair Pulse Check daily assignment.',
      }),
    };
  }
};
