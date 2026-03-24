const { initializeFirebaseAdmin, getFirebaseAdminApp, admin, headers } = require('./config/firebase');
const { runtimeHelpers: pulseCheckSubmissionRuntime } = require('./submit-pulsecheck-checkin');
const { syncTrainingPlanProgression } = require('../../src/api/firebase/mentaltraining/trainingPlanAuthoringShared.js');

const RESPONSE_HEADERS = {
  ...headers,
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const DAILY_ASSIGNMENTS_COLLECTION = 'pulsecheck-daily-assignments';
const ASSIGNMENT_EVENTS_COLLECTION = 'pulsecheck-assignment-events';
const TRAINING_PLANS_COLLECTION = 'pulsecheck-training-plans';
const SNAPSHOTS_COLLECTION = 'state-snapshots';
const TEAM_MEMBERSHIPS_COLLECTION = 'pulsecheck-team-memberships';

const STAFF_ROLES = new Set(['team-admin', 'coach', 'performance-staff', 'support-staff', 'clinician']);
const TERMINAL_STATUSES = new Set(['completed', 'overridden', 'deferred', 'superseded', 'expired']);

async function verifyAuth(event, adminApp) {
  const authHeader = event.headers?.authorization || event.headers?.Authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw createError(401, 'Missing Authorization header');
  }

  const idToken = authHeader.slice('Bearer '.length);
  return admin.auth(adminApp).verifyIdToken(idToken);
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
    case 'paused':
      return `Execution refresh: the athlete paused ${actionText}.${reasonText}`;
    case 'resumed':
      return `Execution refresh: the athlete resumed ${actionText}.${reasonText}`;
    case 'completed':
      return `Execution refresh: the athlete completed ${actionText}.${reasonText}`;
    case 'deferred':
      return `Execution refresh: the assignment was deferred.${reasonText}`;
    case 'overridden':
      return `Execution refresh: the assignment was coach-adjusted.${reasonText}`;
    case 'expired':
      return `Execution refresh: the assignment expired.${reasonText}`;
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
    trainingPlanId: assignment.trainingPlanId || null,
    trainingPlanStepIndex: typeof assignment.trainingPlanStepIndex === 'number' ? assignment.trainingPlanStepIndex : null,
    trainingPlanStepId: assignment.trainingPlanStepId || null,
    executionPattern: assignment.executionPattern || null,
    phaseProgress: assignment.phaseProgress || null,
    executionLock: assignment.executionLock || null,
    completionSummary: assignment.completionSummary || null,
    updatedAt: assignment.updatedAt || null,
  });
}

function resolveTrainingPlanStepIndex(assignment) {
  if (typeof assignment?.trainingPlanStepIndex === 'number') {
    return assignment.trainingPlanStepIndex;
  }

  return null;
}

function resolvePlanStepEventType(eventType) {
  switch (eventType) {
    case 'started':
    case 'viewed':
    case 'paused':
    case 'resumed':
      return 'plan_step_activated';
    case 'completed':
      return 'plan_step_completed';
    case 'overridden':
    case 'deferred':
    case 'expired':
      return 'plan_step_overridden';
    default:
      return null;
  }
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
  if (!snapshot || !eventType || eventType === 'viewed' || eventType === 'paused' || eventType === 'resumed') {
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
  if (!['started', 'completed', 'deferred', 'overridden', 'expired'].includes(eventType)) {
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
  if (!['started', 'completed', 'deferred', 'overridden', 'expired'].includes(eventType)) {
    return null;
  }

  const liveProtocolRegistry = await pulseCheckSubmissionRuntime.listLiveProtocolRegistry(db);
  return pulseCheckSubmissionRuntime.getOrRefreshProtocolResponsivenessProfile({
    db,
    athleteId: assignment.athleteId,
    protocolRegistry: liveProtocolRegistry,
  });
}

async function maybeApplyPlanStepSideEffects({
  db,
  assignment,
  nextAssignment,
  eventType,
  actorType,
  actorUserId,
  eventAt,
  reason,
  assignmentEventId,
}) {
  const sideEffectEventType = resolvePlanStepEventType(eventType);
  if (!sideEffectEventType || !assignment?.trainingPlanId) {
    return null;
  }

  const planRef = db.collection(TRAINING_PLANS_COLLECTION).doc(assignment.trainingPlanId);
  const planSnap = await planRef.get();
  if (!planSnap.exists) {
    return null;
  }

  const plan = { id: planSnap.id, ...(planSnap.data() || {}) };
  const steps = Array.isArray(plan.steps) ? plan.steps.map((entry) => ({ ...entry })) : [];
  if (!steps.length) {
    return null;
  }

  const candidateIndex = resolveTrainingPlanStepIndex(assignment);
  const resolvedIndex =
    candidateIndex !== null
      ? steps.findIndex((entry) => Number(entry.stepIndex) === Number(candidateIndex))
      : steps.findIndex((entry) => entry.id === assignment.trainingPlanStepId);

  if (resolvedIndex < 0 || resolvedIndex >= steps.length) {
    return null;
  }

  const currentStep = steps[resolvedIndex] || {};
  const nextStep = { ...currentStep };
  const nextPlan = {
    ...plan,
    steps,
  };

  let shouldWritePlan = false;
  let shouldWritePlanEvent = false;
  const lifecycleEvents = [];
  const executionTruthOwner = resolveExecutionTruthOwner({ assignment: nextAssignment, actorType, eventType });
  const assignmentSummary = summarizeAssignmentForEvent(nextAssignment || assignment, executionTruthOwner);
  const completionSummary = nextAssignment?.completionSummary || assignment.completionSummary || null;
  const resolvedPlanStepIndex = Number(currentStep.stepIndex || candidateIndex || 0) || null;

  switch (eventType) {
    case 'viewed':
    case 'started':
      if (!['completed', 'overridden', 'skipped'].includes(String(currentStep.stepStatus || ''))) {
        if (currentStep.stepStatus !== 'active_today') {
          nextStep.stepStatus = 'active_today';
          nextStep.linkedDailyTaskId = assignment.id;
          nextStep.linkedDailyTaskSourceDate = assignment.sourceDate || undefined;
          nextStep.startedAt = currentStep.startedAt || eventAt;
          shouldWritePlan = true;
          shouldWritePlanEvent = true;
        }
      }
      break;
    case 'paused':
      if (nextPlan.status !== 'paused') {
        nextPlan.status = 'paused';
        nextPlan.pausedAt = eventAt;
        shouldWritePlan = true;
        lifecycleEvents.push('training_plan_paused');
      }
      if (!['completed', 'overridden', 'skipped'].includes(String(currentStep.stepStatus || '')) && currentStep.stepStatus !== 'active_today') {
        nextStep.stepStatus = 'active_today';
        nextStep.linkedDailyTaskId = assignment.id;
        nextStep.linkedDailyTaskSourceDate = assignment.sourceDate || undefined;
        nextStep.startedAt = currentStep.startedAt || eventAt;
        shouldWritePlan = true;
      }
      shouldWritePlanEvent = true;
      break;
    case 'resumed':
      if (nextPlan.status === 'paused') {
        nextPlan.status = 'active';
        nextPlan.resumedAt = eventAt;
        shouldWritePlan = true;
        lifecycleEvents.push('training_plan_resumed');
      }
      if (!['completed', 'overridden', 'skipped'].includes(String(currentStep.stepStatus || '')) && currentStep.stepStatus !== 'active_today') {
        nextStep.stepStatus = 'active_today';
        nextStep.linkedDailyTaskId = assignment.id;
        nextStep.linkedDailyTaskSourceDate = assignment.sourceDate || undefined;
        nextStep.startedAt = currentStep.startedAt || eventAt;
        shouldWritePlan = true;
      }
      shouldWritePlanEvent = true;
      break;
    case 'completed':
      if (currentStep.stepStatus !== 'completed') {
        nextStep.stepStatus = 'completed';
        nextStep.linkedDailyTaskId = assignment.id;
        nextStep.linkedDailyTaskSourceDate = assignment.sourceDate || undefined;
        nextStep.completedAt = currentStep.completedAt || eventAt;
        nextStep.resultSummary = completionSummary || currentStep.resultSummary || undefined;
        nextPlan.completedCount = Math.max(Number(plan.completedCount || 0) + 1, Number(plan.completedCount || 0));
        nextPlan.latestResultSummary =
          completionSummary?.noraTakeaway
          || assignmentSummary?.completionSummary?.noraTakeaway
          || assignmentSummary?.rationale
          || reason
          || currentStep.resultSummary?.noraTakeaway
          || currentStep.stepLabel
          || null;
        nextPlan.latestResultAt = eventAt;
        nextPlan.nextDueStepIndex = (Number(nextStep.stepIndex || resolvedPlanStepIndex || 0) || 0) + 1;
        if (typeof nextPlan.targetCount === 'number' && nextPlan.completedCount >= nextPlan.targetCount) {
          nextPlan.status = 'completed';
        }
        shouldWritePlan = true;
        shouldWritePlanEvent = true;
      }
      break;
    case 'overridden':
    case 'deferred':
    case 'expired':
      if (currentStep.stepStatus !== 'overridden') {
        nextStep.stepStatus = eventType === 'deferred' ? 'deferred' : 'overridden';
        nextStep.linkedDailyTaskId = assignment.id;
        nextStep.linkedDailyTaskSourceDate = assignment.sourceDate || undefined;
        nextStep.overrideReason = reason || assignment.overrideReason || currentStep.overrideReason || 'Assignment adjusted.';
        nextStep.resultSummary = currentStep.resultSummary || undefined;
        nextPlan.latestResultSummary = nextStep.overrideReason;
        nextPlan.latestResultAt = eventAt;
        shouldWritePlan = true;
        shouldWritePlanEvent = true;
      }
      break;
    default:
      break;
  }

  if (!shouldWritePlanEvent && !lifecycleEvents.length) {
    return null;
  }

  steps[resolvedIndex] = stripUndefinedDeep(nextStep);
  nextPlan.steps = steps;

  if (!nextPlan.sourceDailyTaskId) {
    nextPlan.sourceDailyTaskId = assignment.id;
  }

  if (!nextPlan.sourceDate) {
    nextPlan.sourceDate = assignment.sourceDate || undefined;
  }

  if (assignment.timezone && !nextPlan.timezone) {
    nextPlan.timezone = assignment.timezone;
  }

  const normalizedPlan = syncTrainingPlanProgression(nextPlan);
  if (normalizedPlan.status === 'completed' && plan.status !== 'completed') {
    lifecycleEvents.push('training_plan_completed');
  }

  if (shouldWritePlan) {
    await planRef.set(
      stripUndefinedDeep({
        ...normalizedPlan,
        steps: normalizedPlan.steps,
      }),
      { merge: true }
    );
  }

  let planEvent = null;
  let planEventRef = null;
  if (shouldWritePlanEvent) {
    planEventRef = db.collection(ASSIGNMENT_EVENTS_COLLECTION).doc();
    planEvent = stripUndefinedDeep({
      assignmentId: assignment.id,
      athleteId: assignment.athleteId || '',
      teamId: assignment.teamId || '',
      sourceDate: assignment.sourceDate || '',
      trainingPlanId: assignment.trainingPlanId,
      trainingPlanStepId: assignment.trainingPlanStepId || null,
      trainingPlanStepIndex: resolvedPlanStepIndex,
      eventType: sideEffectEventType,
      actorType,
      actorUserId,
      eventAt,
      executionPattern: assignment.executionPattern || null,
      phaseProgress: assignment.phaseProgress || null,
      executionLock: assignment.executionLock || null,
      completionSummary: completionSummary || null,
      metadata: {
        relatedAssignmentEventId: assignmentEventId,
        relatedAssignmentEventType: eventType,
        planStatusBefore: plan.status || null,
        planStatusAfter: normalizedPlan.status || plan.status || null,
        planStepBefore: currentStep.stepStatus || null,
        planStepAfter: nextStep.stepStatus || null,
        planStepLabel: currentStep.stepLabel || assignment.trainingPlanStepLabel || null,
        trainingPlanStepId: assignment.trainingPlanStepId || null,
        trainingPlanStepIndex: resolvedPlanStepIndex,
        linkedDailyTaskId: assignment.id,
        linkedDailyTaskSourceDate: assignment.sourceDate || null,
        executionTruthOwner,
        assignmentSummary,
        completionSummary,
        reason: reason || null,
      },
      createdAt: eventAt,
    });
    await planEventRef.set(planEvent);
  }

  for (const lifecycleEventType of lifecycleEvents) {
    const lifecycleEventRef = db.collection(ASSIGNMENT_EVENTS_COLLECTION).doc();
    await lifecycleEventRef.set(
      stripUndefinedDeep({
        assignmentId: assignment.id,
        athleteId: assignment.athleteId || '',
        teamId: assignment.teamId || '',
        sourceDate: assignment.sourceDate || '',
        trainingPlanId: assignment.trainingPlanId,
        trainingPlanStepId: assignment.trainingPlanStepId || null,
        trainingPlanStepIndex: resolvedPlanStepIndex,
        eventType: lifecycleEventType,
        actorType,
        actorUserId,
        eventAt,
        metadata: {
          relatedAssignmentEventId: assignmentEventId,
          relatedAssignmentEventType: eventType,
          planStatusBefore: plan.status || null,
          planStatusAfter: normalizedPlan.status || null,
          linkedDailyTaskId: assignment.id,
          linkedDailyTaskSourceDate: assignment.sourceDate || null,
          reason: reason || null,
        },
        createdAt: eventAt,
      })
    );
  }

  return {
    plan: normalizedPlan,
    step: nextStep,
    event: planEvent && planEventRef
      ? {
          id: planEventRef.id,
          ...planEvent,
        }
      : null,
  };
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
    case 'paused':
      if (TERMINAL_STATUSES.has(existing.status)) return null;
      return {
        status: 'paused',
        pausedAt: existing.pausedAt || eventAt,
        updatedAt: eventAt,
      };
    case 'resumed':
      if (TERMINAL_STATUSES.has(existing.status)) return null;
      return {
        status: existing.status === 'paused' ? 'started' : existing.status || 'started',
        resumedAt: eventAt,
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
    case 'expired':
      if (TERMINAL_STATUSES.has(existing.status)) return null;
      return {
        status: 'expired',
        expiredAt: eventAt,
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
  const athleteEvent =
    eventType === 'viewed'
    || eventType === 'started'
    || eventType === 'paused'
    || eventType === 'resumed'
    || eventType === 'completed';

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
  if (eventType === 'viewed' || eventType === 'started' || eventType === 'paused' || eventType === 'resumed' || eventType === 'completed') {
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
    const adminApp = getFirebaseAdminApp({ headers: event.headers || {} });
    const db = admin.firestore(adminApp);
    const decodedToken = await verifyAuth(event, adminApp);
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

    if (!['viewed', 'started', 'paused', 'resumed', 'completed', 'deferred', 'overridden', 'expired'].includes(eventType)) {
      throw createError(400, 'eventType must be one of viewed, started, paused, resumed, completed, deferred, overridden, or expired.');
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
    if (updates && eventType === 'completed' && metadata?.completionSummary) {
      updates.completionSummary = metadata.completionSummary;
    }
    if (updates && metadata?.executionLock) {
      updates.executionLock = {
        ...(assignment.executionLock || {}),
        ...metadata.executionLock,
      };
    }
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
      trainingPlanId: assignment.trainingPlanId || null,
      trainingPlanStepId: assignment.trainingPlanStepId || null,
      trainingPlanStepIndex: typeof assignment.trainingPlanStepIndex === 'number' ? assignment.trainingPlanStepIndex : null,
      executionPattern: assignment.executionPattern || null,
      phaseProgress: assignment.phaseProgress || null,
      executionLock: nextAssignment.executionLock || assignment.executionLock || null,
      completionSummary: nextAssignment.completionSummary || assignment.completionSummary || null,
      metadata: {
        ...(metadata || {}),
        ...(reason ? { reason } : {}),
        previousStatus: assignment.status || null,
        nextStatus: nextAssignment.status || assignment.status || null,
        previousAssignmentSummary: summarizeAssignmentForEvent(assignment, previousExecutionTruthOwner),
        nextAssignmentSummary: summarizeAssignmentForEvent(nextAssignment, nextExecutionTruthOwner),
        previousExecutionTruthOwner,
        nextExecutionTruthOwner,
        trainingPlanId: assignment.trainingPlanId || null,
        trainingPlanStepIndex: typeof assignment.trainingPlanStepIndex === 'number' ? assignment.trainingPlanStepIndex : null,
        trainingPlanStepId: assignment.trainingPlanStepId || null,
        executionPattern: assignment.executionPattern || null,
        phaseProgress: assignment.phaseProgress || null,
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
    const planSideEffect = await maybeApplyPlanStepSideEffects({
      db,
      assignment,
      nextAssignment,
      eventType,
      actorType,
      actorUserId,
      eventAt,
      reason,
      assignmentEventId: eventRef.id,
    }).catch((error) => {
      console.warn('[record-pulsecheck-assignment-event] Plan-step side effect failed:', error);
      return null;
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
        planSideEffect,
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
