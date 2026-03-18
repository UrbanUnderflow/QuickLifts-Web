const { initializeFirebaseAdmin, admin, headers } = require('./config/firebase');
const { runtimeHelpers: pulseCheckSubmissionRuntime } = require('./submit-pulsecheck-checkin');

const RESPONSE_HEADERS = {
  ...headers,
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const DAILY_ASSIGNMENTS_COLLECTION = 'pulsecheck-daily-assignments';
const ASSIGNMENT_EVENTS_COLLECTION = 'pulsecheck-assignment-events';
const SNAPSHOTS_COLLECTION = 'state-snapshots';
const TEAM_MEMBERSHIPS_COLLECTION = 'pulsecheck-team-memberships';

const STAFF_ROLES = new Set(['team-admin', 'coach', 'performance-staff', 'support-staff', 'clinician']);
const TERMINAL_STATUSES = new Set(['completed', 'overridden', 'deferred', 'superseded']);

async function verifyAuth(event) {
  const authHeader = event.headers?.authorization || event.headers?.Authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw createError(401, 'Missing Authorization header');
  }

  const idToken = authHeader.slice('Bearer '.length);
  return admin.auth().verifyIdToken(idToken);
}

function createError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function normalizeReason(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function stripUndefinedDeep(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => stripUndefinedDeep(entry)).filter((entry) => entry !== undefined);
  }

  if (value && typeof value === 'object') {
    return Object.entries(value).reduce((accumulator, [key, entry]) => {
      const cleaned = stripUndefinedDeep(entry);
      if (cleaned !== undefined) {
        accumulator[key] = cleaned;
      }
      return accumulator;
    }, {});
  }

  return value === undefined ? undefined : value;
}

function humanizeRuntimeLabel(value) {
  return value ? String(value).replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim() : '';
}

function deriveOverallReadiness({ readinessScore, dimensions }) {
  if (readinessScore >= 70 && dimensions.focusReadiness >= 65 && dimensions.cognitiveFatigue <= 45) return 'green';
  if (readinessScore < 45 || dimensions.cognitiveFatigue >= 70 || dimensions.emotionalLoad >= 70) return 'red';
  return 'yellow';
}

function deriveProtocolClass(dimensions) {
  if ((dimensions.cognitiveFatigue ?? 0) >= 70) return 'recovery';
  if ((dimensions.activation ?? 0) >= 65 || (dimensions.emotionalLoad ?? 0) >= 65) return 'regulation';
  if ((dimensions.focusReadiness ?? 0) <= 45) return 'priming';
  return 'none';
}

function appendUnique(values, additions) {
  return Array.from(new Set([...(Array.isArray(values) ? values : []), ...(Array.isArray(additions) ? additions : [])].filter(Boolean)));
}

function buildCandidateHints({ routing, assignment }) {
  if (routing === 'trial_only') return ['trial'];
  if (routing === 'protocol_only') return ['protocol'];
  if (routing === 'protocol_then_sim' || routing === 'sim_then_protocol') return ['protocol', 'sim'];
  if (routing === 'defer_alternate_path') return [];
  if (assignment?.actionType === 'protocol') return ['protocol'];
  if (assignment?.actionType === 'defer') return [];
  return ['sim'];
}

function buildRefreshNote({ assignment, eventType, reason }) {
  const actionLabel =
    assignment.protocolLabel
    || assignment.legacyExerciseId
    || assignment.simSpecId
    || assignment.protocolId
    || assignment.actionType
    || 'nora task';
  const actionText = humanizeRuntimeLabel(actionLabel);
  const reasonText = reason ? ` Reason: ${reason}` : '';

  switch (eventType) {
    case 'started':
      return `Execution refresh: the athlete started ${actionText}.${reasonText}`;
    case 'completed':
      return `Execution refresh: the athlete completed ${actionText}.${reasonText}`;
    case 'deferred':
      return `Execution refresh: the assignment was deferred.${reasonText}`;
    case 'overridden':
      return `Execution refresh: the assignment was coach-adjusted.${reasonText}`;
    default:
      return `Execution refresh: ${eventType} for ${actionText}.${reasonText}`;
  }
}

function summarizeAssignmentForEvent(assignment, executionTruthOwner) {
  if (!assignment) {
    return null;
  }

  return stripUndefinedDeep({
    id: assignment.id,
    status: assignment.status || null,
    actionType: assignment.actionType || null,
    actionLabel: humanizeRuntimeLabel(
      assignment.protocolLabel
      || assignment.legacyExerciseId
      || assignment.simSpecId
      || assignment.protocolId
      || assignment.sessionType
      || assignment.actionType
    ) || 'Nora task',
    chosenCandidateId: assignment.chosenCandidateId || null,
    sourceStateSnapshotId: assignment.sourceStateSnapshotId || null,
    rationale: assignment.rationale || null,
    plannerSummary: assignment.plannerSummary || null,
    readinessBand: assignment.readinessBand || null,
    supportFlag: typeof assignment.supportFlag === 'boolean' ? assignment.supportFlag : null,
    decisionSource: assignment.decisionSource || null,
    executionTruthOwner: executionTruthOwner || 'nora',
    updatedAt: assignment.updatedAt || null,
  });
}

function resolveExecutionTruthOwner({ assignment, eventType, actorType }) {
  if (eventType === 'overridden' || eventType === 'deferred') {
    return actorType === 'coach' ? 'coach' : 'staff';
  }

  if (assignment?.status === 'overridden' || assignment?.status === 'deferred') {
    return assignment?.overriddenBy ? 'coach' : 'staff';
  }

  return 'nora';
}

function refreshSnapshotFromAssignmentEvent({ snapshot, assignment, eventType, eventId, eventAt, reason }) {
  if (!snapshot || !eventType || eventType === 'viewed') {
    return null;
  }

  const currentDimensions = snapshot.stateDimensions || {
    activation: 50,
    focusReadiness: 50,
    emotionalLoad: 50,
    cognitiveFatigue: 50,
  };
  const nextDimensions = { ...currentDimensions };
  let nextReadinessScore = typeof snapshot.readinessScore === 'number'
    ? snapshot.readinessScore
    : clamp((currentDimensions.focusReadiness || 50) - ((currentDimensions.cognitiveFatigue || 50) - 50) * 0.35);
  let nextRouting = snapshot.recommendedRouting || 'sim_only';
  let nextSupportFlag = Boolean(snapshot.supportFlag);

  switch (eventType) {
    case 'started':
      if (assignment.actionType === 'protocol') {
        nextDimensions.focusReadiness = clamp((nextDimensions.focusReadiness || 50) + 4);
      }
      break;
    case 'completed':
      if (assignment.actionType === 'protocol') {
        nextDimensions.activation = clamp((nextDimensions.activation || 50) - 12);
        nextDimensions.emotionalLoad = clamp((nextDimensions.emotionalLoad || 50) - 12);
        nextDimensions.focusReadiness = clamp((nextDimensions.focusReadiness || 50) + 10);
        nextDimensions.cognitiveFatigue = clamp((nextDimensions.cognitiveFatigue || 50) - 4);
        nextReadinessScore = clamp(nextReadinessScore + 8);
        nextRouting = assignment.programSnapshot?.recommendedSimId || assignment.programSnapshot?.recommendedLegacyExerciseId
          ? 'sim_only'
          : 'protocol_only';
        nextSupportFlag = false;
      } else if (assignment.actionType === 'sim' || assignment.actionType === 'lighter_sim') {
        nextDimensions.focusReadiness = clamp((nextDimensions.focusReadiness || 50) + 4);
        nextDimensions.cognitiveFatigue = clamp((nextDimensions.cognitiveFatigue || 50) + (assignment.actionType === 'lighter_sim' ? 2 : 6));
        nextReadinessScore = clamp(nextReadinessScore + 3);
        nextRouting = nextDimensions.cognitiveFatigue >= 70 ? 'sim_then_protocol' : snapshot.recommendedRouting || 'sim_only';
      }
      break;
    case 'deferred':
    case 'overridden':
      nextRouting = 'defer_alternate_path';
      nextSupportFlag = true;
      break;
    default:
      break;
  }

  const overallReadiness = deriveOverallReadiness({
    readinessScore: nextReadinessScore,
    dimensions: nextDimensions,
  });
  const recommendedProtocolClass = deriveProtocolClass(nextDimensions);
  const refreshNote = buildRefreshNote({ assignment, eventType, reason });
  const previousInterpretation = snapshot.enrichedInterpretation || {};

  return {
    ...snapshot,
    stateDimensions: nextDimensions,
    overallReadiness,
    confidence: eventType === 'completed' ? 'high' : snapshot.confidence || 'medium',
    freshness: 'current',
    sourcesUsed: appendUnique(snapshot.sourcesUsed, ['assignment_event_runtime']),
    sourceEventIds: appendUnique(snapshot.sourceEventIds, [eventId]),
    contextTags: appendUnique(snapshot.contextTags, [`assignment_${eventType}`]),
    recommendedRouting: nextRouting,
    recommendedProtocolClass,
    candidateClassHints: buildCandidateHints({ routing: nextRouting, assignment }),
    readinessScore: nextReadinessScore,
    supportFlag: nextSupportFlag,
    decisionSource: snapshot.decisionSource || 'fallback_rules',
    enrichedInterpretation: {
      summary: previousInterpretation.summary || `Execution-aware snapshot refresh after ${eventType}.`,
      likelyPrimaryFactor: previousInterpretation.likelyPrimaryFactor || 'mixed',
      supportingSignals: appendUnique(previousInterpretation.supportingSignals, [`Assignment event: ${eventType}`]),
      contradictions: Array.isArray(previousInterpretation.contradictions) ? previousInterpretation.contradictions : [],
      plannerNotes: appendUnique(previousInterpretation.plannerNotes, [refreshNote]),
      confidenceRationale:
        previousInterpretation.confidenceRationale
        || 'Execution events were incorporated into the current-day state snapshot.',
      supportFlag: nextSupportFlag,
      modelSource: previousInterpretation.modelSource || 'fallback_rules',
    },
    updatedAt: eventAt,
  };
}

async function maybeRefreshStateSnapshot({ db, assignment, eventType, eventId, eventAt, reason }) {
  if (!['started', 'completed', 'deferred', 'overridden'].includes(eventType)) {
    return null;
  }

  const snapshotId = assignment.sourceStateSnapshotId || `${assignment.athleteId}_${assignment.sourceDate}`;
  if (!snapshotId) {
    return null;
  }

  const snapshotRef = db.collection(SNAPSHOTS_COLLECTION).doc(snapshotId);
  const snapshotSnap = await snapshotRef.get();
  if (!snapshotSnap.exists) {
    return null;
  }

  const snapshot = { id: snapshotSnap.id, ...(snapshotSnap.data() || {}) };
  const refreshedSnapshot = refreshSnapshotFromAssignmentEvent({
    snapshot,
    assignment,
    eventType,
    eventId,
    eventAt,
    reason,
  });

  if (!refreshedSnapshot) {
    return null;
  }

  await snapshotRef.set(stripUndefinedDeep(refreshedSnapshot), { merge: true });
  return refreshedSnapshot;
}

async function maybeRefreshResponsivenessProfile({ db, assignment, eventType }) {
  if (!['started', 'completed', 'deferred', 'overridden'].includes(eventType)) {
    return null;
  }

  const liveProtocolRegistry = await pulseCheckSubmissionRuntime.listLiveProtocolRegistry(db);
  return pulseCheckSubmissionRuntime.getOrRefreshProtocolResponsivenessProfile({
    db,
    athleteId: assignment.athleteId,
    protocolRegistry: liveProtocolRegistry,
  });
}

function buildAssignmentUpdates(existing, eventType, actorUserId, reason, eventAt) {
  switch (eventType) {
    case 'viewed':
      if (existing.status !== 'assigned') return null;
      return {
        status: 'viewed',
        updatedAt: eventAt,
      };
    case 'started':
      if (TERMINAL_STATUSES.has(existing.status)) return null;
      return {
        status: 'started',
        startedAt: existing.startedAt || eventAt,
        updatedAt: eventAt,
      };
    case 'completed':
      if (existing.status === 'overridden' || existing.status === 'deferred' || existing.status === 'superseded') {
        return null;
      }
      return {
        status: 'completed',
        startedAt: existing.startedAt || eventAt,
        completedAt: existing.completedAt || eventAt,
        updatedAt: eventAt,
      };
    case 'overridden':
      return {
        status: 'overridden',
        overriddenBy: actorUserId,
        overrideReason: reason || existing.overrideReason || 'Assignment overridden.',
        updatedAt: eventAt,
      };
    case 'deferred':
      return {
        status: 'deferred',
        overriddenBy: actorUserId,
        overrideReason: reason || existing.overrideReason || 'Assignment deferred.',
        updatedAt: eventAt,
      };
    default:
      return null;
  }
}

async function resolveRequesterRole(db, assignment, requesterId) {
  if (requesterId === assignment.athleteId) {
    return 'athlete';
  }

  if (!assignment.teamId) {
    return null;
  }

  const membershipRef = db.collection(TEAM_MEMBERSHIPS_COLLECTION).doc(`${assignment.teamId}_${requesterId}`);
  const membershipSnap = await membershipRef.get();
  if (!membershipSnap.exists) {
    return null;
  }

  return membershipSnap.data()?.role || null;
}

async function assertAuthorized(db, assignment, eventType, requesterId) {
  const requesterRole = await resolveRequesterRole(db, assignment, requesterId);
  const athleteEvent = eventType === 'viewed' || eventType === 'started' || eventType === 'completed';

  if (athleteEvent) {
    if (requesterId !== assignment.athleteId) {
      throw createError(403, 'Only the assigned athlete can record this assignment event.');
    }
    return requesterRole;
  }

  if (!STAFF_ROLES.has(requesterRole || '')) {
    throw createError(403, 'Only authorized staff can override or defer this assignment.');
  }

  return requesterRole;
}

function resolveActorType({ eventType, requesterRole, assignment, requesterId }) {
  if (eventType === 'viewed' || eventType === 'started' || eventType === 'completed') {
    return requesterId === assignment.athleteId ? 'athlete' : 'system';
  }
  if (requesterRole === 'coach') return 'coach';
  if (requesterRole && requesterRole !== 'athlete') return 'staff';
  return 'system';
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
    const db = admin.firestore();
    const decodedToken = await verifyAuth(event);
    const body = JSON.parse(event.body || '{}');

    const assignmentId = typeof body.assignmentId === 'string' ? body.assignmentId.trim() : '';
    const eventType = typeof body.eventType === 'string' ? body.eventType.trim() : '';
    const actorUserId = typeof body.actorUserId === 'string' && body.actorUserId.trim()
      ? body.actorUserId.trim()
      : decodedToken.uid;
    const reason = normalizeReason(body.reason);
    const metadata = body.metadata && typeof body.metadata === 'object' ? body.metadata : undefined;

    if (!assignmentId) {
      throw createError(400, 'assignmentId is required.');
    }

    if (!['viewed', 'started', 'completed', 'deferred', 'overridden'].includes(eventType)) {
      throw createError(400, 'eventType must be one of viewed, started, completed, deferred, or overridden.');
    }

    if (actorUserId !== decodedToken.uid) {
      throw createError(403, 'Authenticated user does not match requested actor.');
    }

    const assignmentRef = db.collection(DAILY_ASSIGNMENTS_COLLECTION).doc(assignmentId);
    const assignmentSnap = await assignmentRef.get();
    if (!assignmentSnap.exists) {
      throw createError(404, 'PulseCheck daily assignment not found.');
    }

    const assignment = { id: assignmentSnap.id, ...(assignmentSnap.data() || {}) };
    const requesterRole = await assertAuthorized(db, assignment, eventType, decodedToken.uid);
    const eventAt = Date.now();
    const updates = buildAssignmentUpdates(assignment, eventType, actorUserId, reason, eventAt);
    const nextAssignment = updates ? { ...assignment, ...updates } : assignment;
    const actorType = resolveActorType({ eventType, requesterRole, assignment, requesterId: decodedToken.uid });
    const previousExecutionTruthOwner = resolveExecutionTruthOwner({ assignment, actorType, eventType: 'viewed' });
    const nextExecutionTruthOwner = resolveExecutionTruthOwner({ assignment: nextAssignment, actorType, eventType });

    if (updates) {
      await assignmentRef.set(updates, { merge: true });
    }

    const eventRef = db.collection(ASSIGNMENT_EVENTS_COLLECTION).doc();
    const nextEvent = {
      assignmentId,
      athleteId: assignment.athleteId || '',
      teamId: assignment.teamId || '',
      sourceDate: assignment.sourceDate || '',
      eventType,
      actorType,
      actorUserId,
      eventAt,
      metadata: {
        ...(metadata || {}),
        ...(reason ? { reason } : {}),
        previousStatus: assignment.status || null,
        nextStatus: nextAssignment.status || assignment.status || null,
        previousAssignmentSummary: summarizeAssignmentForEvent(assignment, previousExecutionTruthOwner),
        nextAssignmentSummary: summarizeAssignmentForEvent(nextAssignment, nextExecutionTruthOwner),
        previousExecutionTruthOwner,
        nextExecutionTruthOwner,
      },
      createdAt: eventAt,
    };
    await eventRef.set(nextEvent);
    const refreshedStateSnapshot = await maybeRefreshStateSnapshot({
      db,
      assignment: nextAssignment,
      eventType,
      eventId: eventRef.id,
      eventAt,
      reason,
    });
    const responsivenessProfile = await maybeRefreshResponsivenessProfile({
      db,
      assignment: nextAssignment,
      eventType,
    });

    return {
      statusCode: 200,
      headers: RESPONSE_HEADERS,
      body: JSON.stringify({
        assignment: nextAssignment,
        event: {
          id: eventRef.id,
          ...nextEvent,
        },
        stateSnapshot: refreshedStateSnapshot,
        responsivenessProfile,
      }),
    };
  } catch (error) {
    console.error('[record-pulsecheck-assignment-event] Failed:', error);
    return {
      statusCode: error?.statusCode || 500,
      headers: RESPONSE_HEADERS,
      body: JSON.stringify({
        error: error?.message || 'Failed to record PulseCheck assignment event.',
      }),
    };
  }
};
