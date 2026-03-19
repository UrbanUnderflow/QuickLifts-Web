const { initializeFirebaseAdmin, admin, headers } = require('./config/firebase');
const { runtimeHelpers: pulseCheckSubmissionRuntime } = require('./submit-pulsecheck-checkin');

const RESPONSE_HEADERS = {
  ...headers,
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const DAILY_ASSIGNMENTS_COLLECTION = 'pulsecheck-daily-assignments';
const MENTAL_EXERCISES_COLLECTION = 'mental-exercises';

function isValidSourceDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function todayDateString() {
  return new Date().toISOString().split('T')[0];
}

function asNonEmptyString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function parseBoolean(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes'].includes(normalized)) return true;
    if (['false', '0', 'no'].includes(normalized)) return false;
  }
  return false;
}

function humanizeRuntimeLabel(value) {
  return value
    ? String(value)
      .replace(/[-_]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\b\w/g, (char) => char.toUpperCase())
    : '';
}

function candidateMatchesAssignment(candidate, assignment) {
  if (!candidate || !assignment) return false;

  const candidateId = asNonEmptyString(candidate.id);
  const chosenCandidateId = asNonEmptyString(assignment.chosenCandidateId);
  if (candidateId && chosenCandidateId && candidateId === chosenCandidateId) {
    return true;
  }

  const candidateSimSpecId = asNonEmptyString(candidate.simSpecId)?.toLowerCase();
  const assignmentSimSpecId = asNonEmptyString(assignment.simSpecId)?.toLowerCase();
  if (candidateSimSpecId && assignmentSimSpecId && candidateSimSpecId === assignmentSimSpecId) {
    return true;
  }

  const candidateLegacyExerciseId = asNonEmptyString(candidate.legacyExerciseId)?.toLowerCase();
  const assignmentLegacyExerciseId = asNonEmptyString(assignment.legacyExerciseId)?.toLowerCase();
  if (candidateLegacyExerciseId && assignmentLegacyExerciseId && candidateLegacyExerciseId === assignmentLegacyExerciseId) {
    return true;
  }

  const candidateProtocolId = asNonEmptyString(candidate.protocolId);
  const assignmentProtocolId = asNonEmptyString(assignment.protocolId);
  if (candidateProtocolId && assignmentProtocolId && candidateProtocolId === assignmentProtocolId) {
    return true;
  }

  return false;
}

async function hasLaunchableExerciseForCandidate(db, candidate) {
  const legacyExerciseId = asNonEmptyString(candidate?.legacyExerciseId);
  if (legacyExerciseId) {
    const legacySnap = await db.collection(MENTAL_EXERCISES_COLLECTION).doc(legacyExerciseId).get();
    if (legacySnap.exists && legacySnap.data()?.isActive !== false) {
      return true;
    }
  }

  const simSpecId = asNonEmptyString(candidate?.simSpecId)?.toLowerCase();
  if (simSpecId) {
    const simSpecSnap = await db.collection(MENTAL_EXERCISES_COLLECTION)
      .where('simSpecId', '==', simSpecId)
      .where('isActive', '==', true)
      .limit(1)
      .get();
    if (!simSpecSnap.empty) {
      return true;
    }
  }

  const labelCandidates = [
    asNonEmptyString(candidate?.protocolLabel),
    asNonEmptyString(candidate?.variantLabel),
    asNonEmptyString(candidate?.label),
    simSpecId ? humanizeRuntimeLabel(simSpecId) : null,
  ].filter(Boolean);

  for (const label of new Set(labelCandidates)) {
    const nameSnap = await db.collection(MENTAL_EXERCISES_COLLECTION)
      .where('name', '==', label)
      .where('isActive', '==', true)
      .limit(1)
      .get();
    if (!nameSnap.empty) {
      return true;
    }
  }

  return false;
}

async function filterLaunchableCandidates(db, candidates, existingAssignment) {
  const launchable = [];

  for (const candidate of candidates || []) {
    if (candidateMatchesAssignment(candidate, existingAssignment)) {
      continue;
    }

    if (await hasLaunchableExerciseForCandidate(db, candidate)) {
      launchable.push(candidate);
    }
  }

  return launchable;
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
    const preferLaunchableAlternative = parseBoolean(body.preferLaunchableAlternative);
    const assignmentId = `${userId}_${sourceDate}`;
    const db = admin.firestore();

    console.info('[repair-pulsecheck-daily-assignment] Repair requested', {
      userId,
      sourceDate,
      assignmentId,
      preferLaunchableAlternative,
    });

    const existingAssignmentSnap = await db.collection(DAILY_ASSIGNMENTS_COLLECTION).doc(assignmentId).get();
    const existingAssignment = existingAssignmentSnap.exists
      ? { id: existingAssignmentSnap.id, ...existingAssignmentSnap.data() }
      : null;
    const existingSnapshot = await pulseCheckSubmissionRuntime.getSnapshotById(db, assignmentId);

    console.info('[repair-pulsecheck-daily-assignment] Existing runtime state', {
      userId,
      sourceDate,
      hasAssignment: Boolean(existingAssignment),
      hasSnapshot: Boolean(existingSnapshot),
      snapshotId: existingSnapshot?.id || null,
    });

    if (existingAssignment && !preferLaunchableAlternative) {
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
    let rematerialized;

    if (preferLaunchableAlternative) {
      const liveProtocolRegistry = await pulseCheckSubmissionRuntime.listLiveProtocolRegistry(db);
      const liveSimRegistry = await pulseCheckSubmissionRuntime.listLivePublishedSimModules(db);
      const responsivenessProfile = await pulseCheckSubmissionRuntime.getOrRefreshProtocolResponsivenessProfile({
        db,
        athleteId: userId,
        protocolRegistry: liveProtocolRegistry,
      });

      const baseCandidateSet = pulseCheckSubmissionRuntime.buildAssignmentCandidateSet({
        athleteId: userId,
        sourceDate,
        snapshot: existingSnapshot,
        progress: syncedProgress,
        liveProtocolRegistry,
        liveSimRegistry,
        responsivenessProfile,
      });

      const launchableCandidates = await filterLaunchableCandidates(
        db,
        baseCandidateSet.candidates,
        existingAssignment
      );

      if (!launchableCandidates.length) {
        return {
          statusCode: 200,
          headers: RESPONSE_HEADERS,
          body: JSON.stringify({
            stateSnapshot: existingSnapshot,
            candidateSet: baseCandidateSet,
            dailyAssignment: existingAssignment,
            repairApplied: false,
            detail: 'No alternate launchable PulseCheck assignment is ready right now.',
          }),
        };
      }

      const filteredCandidateSet = {
        ...baseCandidateSet,
        id: `${baseCandidateSet.id}-launchable-refresh`,
        candidates: launchableCandidates,
        candidateIds: launchableCandidates.map((candidate) => candidate.id),
        candidateClassHints: Array.from(new Set(launchableCandidates.map((candidate) => candidate.type).filter(Boolean))),
        plannerEligible: true,
        updatedAt: Date.now(),
      };

      await db.collection('pulsecheck-assignment-candidate-sets')
        .doc(filteredCandidateSet.id)
        .set(pulseCheckSubmissionRuntime.stripUndefinedDeep(filteredCandidateSet), { merge: true });

      const plannerDecision = await pulseCheckSubmissionRuntime.planAssignmentWithAI({
        snapshot: existingSnapshot,
        candidateSet: filteredCandidateSet,
        progress: syncedProgress,
        responsivenessProfile,
      });

      const dailyAssignment = await pulseCheckSubmissionRuntime.orchestratePostCheckIn({
        db,
        athleteId: userId,
        sourceCheckInId:
          existingAssignment?.sourceCheckInId
          || existingSnapshot.sourceCheckInId
          || existingSnapshot.rawSignalSummary?.explicitSelfReport?.id
          || '',
        sourceStateSnapshotId: existingSnapshot.id,
        sourceCandidateSetId: filteredCandidateSet.id,
        sourceDate,
        progress: syncedProgress,
        candidateSet: filteredCandidateSet,
        plannerDecision,
        liveProtocolRegistry,
        liveSimRegistry,
      });

      rematerialized = {
        stateSnapshot: dailyAssignment ? { ...existingSnapshot, executionLink: dailyAssignment.id } : existingSnapshot,
        candidateSet: filteredCandidateSet,
        plannerDecision,
        dailyAssignment,
      };
    } else {
      rematerialized = await pulseCheckSubmissionRuntime.rematerializeAssignmentFromSnapshot({
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
    }

    console.info('[repair-pulsecheck-daily-assignment] Repair result', {
      userId,
      sourceDate,
      preferLaunchableAlternative,
      repairApplied: Boolean(rematerialized?.dailyAssignment),
      candidateCount: rematerialized?.candidateSet?.candidates?.length || 0,
      dailyAssignmentId: rematerialized?.dailyAssignment?.id || null,
      dailyAssignmentActionType: rematerialized?.dailyAssignment?.actionType || null,
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
