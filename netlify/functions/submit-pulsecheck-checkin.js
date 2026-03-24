const { initializeFirebaseAdmin, getFirebaseAdminApp, admin, headers } = require('./config/firebase');
const profileSnapshotRuntime = require('../../src/api/firebase/mentaltraining/profileSnapshotRuntime.js');
const protocolRegistryRuntime = require('../../src/api/firebase/mentaltraining/protocolRegistryRuntime.js');
const trainingPlanAuthoringShared = require('../../src/api/firebase/mentaltraining/trainingPlanAuthoringShared.js');

const RESPONSE_HEADERS = {
  ...headers,
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const CHECKINS_ROOT = 'mental-check-ins';
const PROGRESS_COLLECTION = 'athlete-mental-progress';
const DAILY_ASSIGNMENTS_COLLECTION = 'pulsecheck-daily-assignments';
const ASSIGNMENT_EVENTS_COLLECTION = 'pulsecheck-assignment-events';
const ASSIGNMENT_REVISIONS_SUBCOLLECTION = 'revisions';
const SNAPSHOTS_COLLECTION = 'state-snapshots';
const ASSIGNMENT_CANDIDATE_SETS_COLLECTION = 'pulsecheck-assignment-candidate-sets';
const TRAINING_PLANS_COLLECTION = 'pulsecheck-training-plans';
const PROTOCOLS_COLLECTION = 'pulsecheck-protocols';
const PROTOCOL_RESPONSIVENESS_COLLECTION = 'pulsecheck-protocol-responsiveness-profiles';
const TEAM_MEMBERSHIPS_COLLECTION = 'pulsecheck-team-memberships';
const SIM_MODULES_COLLECTION = 'sim-modules';
const DAY_MS = 24 * 60 * 60 * 1000;
const CURRENT_RESPONSIVENESS_WINDOW_DAYS = 21;
const DEGRADED_RESPONSIVENESS_WINDOW_DAYS = 45;
const SOURCE_DATE_ROLLOVER_HOUR = 4;
const PRIMARY_TRAINING_PLAN_ID_SUFFIX = 'primary-plan';

const VALID_ROUTING = new Set([
  'protocol_only',
  'sim_only',
  'trial_only',
  'protocol_then_sim',
  'sim_then_protocol',
  'defer_alternate_path',
]);

const VALID_PROTOCOL_CLASSES = new Set(['regulation', 'priming', 'recovery', 'none']);
const VALID_CONFIDENCE = new Set(['high', 'medium', 'low']);
const VALID_CANDIDATE_TYPES = new Set(['sim', 'protocol', 'trial']);
const VALID_PRIMARY_FACTORS = new Set([
  'activation',
  'focus_readiness',
  'emotional_load',
  'cognitive_fatigue',
  'mixed',
]);

const {
  buildProgramPrescriptionId,
  buildTrainingPlan,
  resolveNextDuePlanStep,
  resolvePlanAuthoringTrigger,
  syncTrainingPlanProgression,
} = trainingPlanAuthoringShared;

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function normalizeExplicitReadinessScore(readinessScore) {
  return clamp(((Number(readinessScore || 1) - 1) / 4) * 100);
}

function isValidSourceDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function compareSourceDateDesc(left, right) {
  return String(right || '').localeCompare(String(left || ''));
}

function humanizeRuntimeLabel(value) {
  return value ? String(value).replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim() : '';
}

function titleizeRuntimeLabel(value) {
  const normalized = humanizeRuntimeLabel(value);
  if (!normalized) return '';
  return normalized
    .split(' ')
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}

function normalizeTag(value) {
  return typeof value === 'string'
    ? value.trim().toLowerCase().replace(/[\s-]+/g, '_')
    : '';
}

function normalizeTimezone(value) {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  try {
    Intl.DateTimeFormat('en-US', { timeZone: value.trim() }).format(new Date());
    return value.trim();
  } catch (error) {
    return undefined;
  }
}

function formatSourceDateFromParts({ year, month, day }) {
  return [
    String(year).padStart(4, '0'),
    String(month).padStart(2, '0'),
    String(day).padStart(2, '0'),
  ].join('-');
}

function shiftSourceDate(sourceDate, deltaDays) {
  if (!isValidSourceDate(sourceDate) || !Number.isFinite(deltaDays)) {
    return sourceDate;
  }

  const [year, month, day] = sourceDate.split('-').map((segment) => Number(segment));
  const shifted = new Date(Date.UTC(year, month - 1, day + deltaDays));
  return shifted.toISOString().slice(0, 10);
}

function resolveTimezoneDateParts(timestampMs, timezone) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone || 'UTC',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const parts = formatter.formatToParts(new Date(timestampMs));
  const partMap = parts.reduce((accumulator, part) => {
    accumulator[part.type] = part.value;
    return accumulator;
  }, {});

  return {
    year: Number(partMap.year || 0),
    month: Number(partMap.month || 1),
    day: Number(partMap.day || 1),
    hour: Number(partMap.hour || 0),
    minute: Number(partMap.minute || 0),
    second: Number(partMap.second || 0),
  };
}

function resolveOperationalDay({
  explicitSourceDate,
  timezone,
  now = Date.now(),
}) {
  const normalizedTimezone = normalizeTimezone(timezone) || 'UTC';

  if (isValidSourceDate(explicitSourceDate)) {
    return {
      sourceDate: explicitSourceDate,
      timezone: normalizedTimezone,
    };
  }

  const localParts = resolveTimezoneDateParts(now, normalizedTimezone);
  let sourceDate = formatSourceDateFromParts(localParts);
  if (localParts.hour < SOURCE_DATE_ROLLOVER_HOUR) {
    sourceDate = shiftSourceDate(sourceDate, -1);
  }

  return {
    sourceDate,
    timezone: normalizedTimezone,
  };
}

function buildPrimaryTrainingPlanId(athleteId) {
  return `${athleteId}_${PRIMARY_TRAINING_PLAN_ID_SUFFIX}`;
}

function isAssignmentMutableForAutomaticRematerialization(assignment) {
  if (!assignment) return false;
  return String(assignment.status || '') === 'assigned' && !Boolean(assignment.executionLock?.coachFrozen);
}

function shouldExpireAtRollover(assignment) {
  if (!assignment || !isValidSourceDate(assignment.sourceDate)) return false;
  return ['assigned', 'viewed', 'paused'].includes(String(assignment.status || ''));
}

async function expireAssignmentsBeforeSourceDate({
  db,
  athleteId,
  sourceDate,
  expiredAt,
}) {
  if (!athleteId || !isValidSourceDate(sourceDate)) return [];

  const assignmentsSnap = await db.collection(DAILY_ASSIGNMENTS_COLLECTION).where('athleteId', '==', athleteId).get();
  const staleAssignments = assignmentsSnap.docs
    .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
    .filter((assignment) => assignment.sourceDate < sourceDate && shouldExpireAtRollover(assignment));

  if (!staleAssignments.length) return [];

  const batch = db.batch();
  staleAssignments.forEach((assignment) => {
    batch.set(
      db.collection(DAILY_ASSIGNMENTS_COLLECTION).doc(assignment.id),
      {
        status: 'expired',
        expiredAt,
        updatedAt: expiredAt,
      },
      { merge: true }
    );
  });
  await batch.commit();
  return staleAssignments.map((assignment) => assignment.id);
}

function resolveTrainingPlanType({ selectedCandidate, executionPattern }) {
  if (executionPattern === 'protocol_then_sim' || executionPattern === 'sim_then_protocol') return 'mixed';
  if (selectedCandidate?.type === 'protocol') return 'protocol_focused';
  if (selectedCandidate?.type === 'trial') return 'assessment';
  return 'sim_focused';
}

function resolveTrainingPlanPresentation({ activeProgram, selectedCandidate, executionPattern }) {
  const primarySkill = Array.isArray(activeProgram?.targetSkills) && activeProgram.targetSkills.length
    ? titleizeRuntimeLabel(activeProgram.targetSkills[0])
    : '';
  const fallbackLabel = titleizeRuntimeLabel(
    selectedCandidate?.label
    || selectedCandidate?.protocolLabel
    || selectedCandidate?.simSpecId
    || selectedCandidate?.legacyExerciseId
    || activeProgram?.sessionType
    || 'mental training'
  );

  return {
    title: primarySkill ? `${primarySkill} Build` : `${fallbackLabel || 'Mental Training'} Plan`,
    goal: activeProgram?.rationale || selectedCandidate?.rationale || `Build ${humanizeRuntimeLabel(primarySkill || fallbackLabel || 'mental training')}.`,
    planType: resolveTrainingPlanType({ selectedCandidate, executionPattern }),
    primaryMetric: primarySkill || fallbackLabel || null,
  };
}

function resolvePlanStepExerciseId({ selectedCandidate, activeProgram, actionType }) {
  return (
    selectedCandidate?.protocolId
    || selectedCandidate?.simSpecId
    || selectedCandidate?.legacyExerciseId
    || activeProgram?.recommendedSimId
    || activeProgram?.recommendedLegacyExerciseId
    || activeProgram?.sessionType
    || actionType
  );
}

function resolvePlanStepLabel({
  stepIndex,
  selectedCandidate,
  activeProgram,
  actionType,
}) {
  const label = titleizeRuntimeLabel(
    selectedCandidate?.label
    || selectedCandidate?.protocolLabel
    || selectedCandidate?.simSpecId
    || selectedCandidate?.legacyExerciseId
    || activeProgram?.recommendedSimId
    || activeProgram?.recommendedLegacyExerciseId
    || activeProgram?.sessionType
    || actionType
  );

  return label ? `Session ${stepIndex}: ${label}` : `Session ${stepIndex}`;
}

function nextPlanStepIndex(steps = []) {
  return steps.reduce((maximum, step) => Math.max(maximum, Number(step?.stepIndex || 0)), 0) + 1;
}

function clonePlanSteps(steps = []) {
  return steps.map((step) => ({ ...step }));
}

function pickPrimaryTrainingPlan(plans = []) {
  const sorted = [...(Array.isArray(plans) ? plans : [])].sort(
    (left, right) => Number(right?.updatedAt || right?.createdAt || 0) - Number(left?.updatedAt || left?.createdAt || 0)
  );

  return (
    sorted.find((plan) => plan?.isPrimary && (plan?.status === 'active' || plan?.status === 'paused'))
    || sorted.find((plan) => plan?.isPrimary)
    || null
  );
}

function buildTrainingPlanEventRecord({
  eventType,
  plan,
  actorType = 'system',
  actorUserId = 'pulsecheck-plan-authoring',
  eventAt,
  reason,
  step,
  metadata,
}) {
  return stripUndefinedDeep({
    assignmentId: plan?.sourceDailyTaskId || `plan:${plan?.id || 'unknown'}`,
    athleteId: plan?.athleteId || '',
    teamId: '',
    sourceDate: plan?.sourceDate || '',
    eventType,
    actorType,
    actorUserId,
    eventAt,
    trainingPlanId: plan?.id || null,
    trainingPlanStepId: step?.id || null,
    trainingPlanStepIndex: typeof step?.stepIndex === 'number' ? step.stepIndex : null,
    executionPattern: step?.executionPattern || null,
    metadata: {
      reason: reason || null,
      authoringTrigger: plan?.authoringTrigger || null,
      authoringArchetype: plan?.archetypeId || null,
      planType: plan?.planType || null,
      fallbackReason: plan?.inventoryFallbackReason || null,
      targetSkills: plan?.targetSkills || [],
      sourceStateSnapshotId: plan?.sourceStateSnapshotId || null,
      sourceProfileSnapshotId: plan?.sourceProfileSnapshotId || null,
      sourceProgramPrescriptionId: plan?.sourceProgramPrescriptionId || null,
      authoringRulesVersion: plan?.authoringRulesVersion || null,
      archetypeVersion: plan?.archetypeVersion || null,
      ...metadata,
    },
    createdAt: eventAt,
  });
}

async function writeTrainingPlanEvents(db, events = []) {
  const entries = (Array.isArray(events) ? events : []).filter(Boolean);
  if (!entries.length) return;

  const batch = db.batch();
  entries.forEach((entry) => {
    batch.set(db.collection(ASSIGNMENT_EVENTS_COLLECTION).doc(), entry);
  });
  await batch.commit();
}

async function writeTrainingPlanAuthoringFailureEvent({
  db,
  athleteId,
  sourceDate,
  trigger,
  reason,
  error,
  eventAt,
  actorType = 'system',
  actorUserId = 'pulsecheck-plan-authoring',
}) {
  await writeTrainingPlanEvents(db, [
    stripUndefinedDeep({
      assignmentId: `plan-authoring:${athleteId}:${sourceDate}`,
      athleteId,
      teamId: '',
      sourceDate,
      eventType: 'training_plan_authoring_failed',
      actorType,
      actorUserId,
      eventAt,
      metadata: {
        reason: reason || null,
        authoringTrigger: trigger || null,
        errorMessage: error?.message || String(error || ''),
      },
      createdAt: eventAt,
    }),
  ]);
}

async function ensurePrimaryTrainingPlan({
  db,
  athleteId,
  coachId,
  sourceDate,
  timezone,
  sourceStateSnapshotId,
  progress,
  snapshot,
  activeProgram,
  liveProtocolRegistry,
  liveSimRegistry,
  now,
}) {
  const [plansSnap, assignmentsSnap] = await Promise.all([
    db.collection(TRAINING_PLANS_COLLECTION).where('athleteId', '==', athleteId).get(),
    db.collection(DAILY_ASSIGNMENTS_COLLECTION).where('athleteId', '==', athleteId).get(),
  ]);

  const allPlans = plansSnap.docs
    .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
    .sort((left, right) => Number(right.updatedAt || right.createdAt || 0) - Number(left.updatedAt || left.createdAt || 0));
  const recentAssignments = assignmentsSnap.docs
    .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
    .sort((left, right) => {
      const bySourceDate = compareSourceDateDesc(left.sourceDate, right.sourceDate);
      if (bySourceDate !== 0) return bySourceDate;
      return Number(right.updatedAt || right.createdAt || 0) - Number(left.updatedAt || left.createdAt || 0);
    })
    .slice(0, 8);

  let primaryPlan = pickPrimaryTrainingPlan(allPlans);
  const authoringDecision = resolvePlanAuthoringTrigger({
    primaryPlan,
    recentPlans: allPlans,
    profile: progress?.taxonomyProfile,
    activeProgram,
    snapshot,
    recentAssignments,
    hasBaselineAssessment: Boolean(progress?.baselineAssessment),
  });

  if (!authoringDecision.shouldAuthor || !authoringDecision.trigger) {
    return {
      primaryPlan,
      recentAssignments,
      allPlans,
      authoringDecision,
      authoredPlan: null,
      supersededPlan: null,
    };
  }

  let authoredPlan;
  try {
    authoredPlan = buildTrainingPlan({
      athleteId,
      assignedBy: 'nora',
      coachId,
      trigger: authoringDecision.trigger,
      profile: progress?.taxonomyProfile,
      activeProgram,
      snapshot,
      sourceDate,
      timezone,
      sourceStateSnapshotId,
      sourceProgramPrescriptionId: buildProgramPrescriptionId(athleteId, activeProgram) || undefined,
      sourceProgramGeneratedAt: activeProgram?.generatedAt,
      exploratoryWindowRepCount: authoringDecision.exploratoryWindowRepCount,
      lowConfidence: authoringDecision.lowConfidence,
      recentPlans: allPlans,
      liveProtocolRegistry,
      liveSimRegistry,
      now,
    });
  } catch (error) {
    await writeTrainingPlanAuthoringFailureEvent({
      db,
      athleteId,
      sourceDate,
      trigger: authoringDecision.trigger,
      reason: authoringDecision.reason,
      error,
      eventAt: now,
    }).catch((eventError) => {
      console.error('[submit-pulsecheck-checkin] Failed to write training-plan authoring failure event:', eventError);
    });
    throw error;
  }

  let supersededPlan = null;
  const batch = db.batch();
  if (primaryPlan && primaryPlan.id !== authoredPlan.id) {
    const supersededStatus = primaryPlan.status === 'completed' ? 'completed' : 'superseded';
    supersededPlan = syncTrainingPlanProgression({
      ...primaryPlan,
      status: supersededStatus,
      isPrimary: false,
      supersededByPlanId: authoredPlan.id,
      supersededReason: authoringDecision.reason,
      updatedAt: now,
    });
    batch.set(
      db.collection(TRAINING_PLANS_COLLECTION).doc(primaryPlan.id),
      stripUndefinedDeep(supersededPlan),
      { merge: true }
    );
  }

  allPlans
    .filter((plan) => plan.id !== authoredPlan.id && plan.id !== primaryPlan?.id && plan.isPrimary)
    .forEach((plan) => {
      batch.set(
        db.collection(TRAINING_PLANS_COLLECTION).doc(plan.id),
        {
          isPrimary: false,
          updatedAt: now,
        },
        { merge: true }
      );
    });

  batch.set(
    db.collection(TRAINING_PLANS_COLLECTION).doc(authoredPlan.id),
    stripUndefinedDeep(authoredPlan),
    { merge: true }
  );
  await batch.commit();

  await writeTrainingPlanEvents(db, [
    buildTrainingPlanEventRecord({
      eventType: 'training_plan_authored',
      plan: authoredPlan,
      eventAt: now,
      reason: authoringDecision.reason,
    }),
    ...authoredPlan.steps.map((step) =>
      buildTrainingPlanEventRecord({
        eventType: 'training_plan_step_authored',
        plan: authoredPlan,
        step,
        eventAt: now,
        reason: authoringDecision.reason,
        metadata: {
          stepLabel: step.stepLabel,
          stepStatus: step.stepStatus,
          actionType: step.actionType,
          exerciseId: step.exerciseId,
        },
      })
    ),
    supersededPlan
      ? buildTrainingPlanEventRecord({
          eventType: 'training_plan_superseded',
          plan: supersededPlan,
          eventAt: now,
          reason: authoringDecision.reason,
          metadata: {
            supersededByPlanId: authoredPlan.id,
          },
        })
      : null,
  ]).catch((error) => {
    console.error('[submit-pulsecheck-checkin] Failed to write training-plan authoring events:', error);
  });

  primaryPlan = authoredPlan;
  return {
    primaryPlan,
    recentAssignments,
    allPlans,
    authoringDecision,
    authoredPlan,
    supersededPlan,
  };
}

function resolvePlanDrivenCandidateType(plan, step) {
  if (plan?.planType === 'assessment' || step?.archetypeStepKey?.includes('reassessment') || /reassessment|probe/i.test(step?.stepLabel || '')) {
    return 'trial';
  }

  return step?.actionType === 'protocol' ? 'protocol' : 'sim';
}

function buildPlanDrivenCandidate({
  athleteId,
  sourceDate,
  primaryPlan,
  liveProtocolRegistry,
  liveSimRegistry,
}) {
  if (!primaryPlan || primaryPlan.status === 'completed' || primaryPlan.status === 'superseded') {
    return null;
  }

  const step = resolveNextDuePlanStep(primaryPlan);
  if (!step) return null;

  const liveProtocol = step.protocolId
    ? (Array.isArray(liveProtocolRegistry) ? liveProtocolRegistry.find((record) => record.id === step.protocolId) : null)
    : null;
  const liveSim = step.simSpecId
    ? (Array.isArray(liveSimRegistry)
      ? liveSimRegistry.find((record) => record.simSpecId === step.simSpecId || record.id === step.simSpecId)
      : null)
    : null;

  return {
    id: `${athleteId}_${sourceDate}_${primaryPlan.id}_${step.id}`,
    type: resolvePlanDrivenCandidateType(primaryPlan, step),
    label: step.stepLabel || liveProtocol?.label || liveSim?.name || humanizeRuntimeLabel(step.exerciseId),
    actionType: step.actionType || 'sim',
    rationale: `Primary training plan step ${step.stepIndex} directs today's work before any state-based override is considered.`,
    legacyExerciseId: liveProtocol?.legacyExerciseId || liveSim?.id || undefined,
    protocolId: step.protocolId || undefined,
    protocolFamilyId: liveProtocol?.familyId,
    protocolVariantId: liveProtocol?.variantId,
    protocolVariantLabel: liveProtocol?.variantLabel,
    protocolVariantVersion: liveProtocol?.variantVersion,
    protocolPublishedAt: liveProtocol?.publishedAt,
    protocolPublishedRevisionId: liveProtocol?.publishedRevisionId,
    protocolLabel: liveProtocol?.label,
    protocolClass: step.protocolClass || liveProtocol?.protocolClass,
    protocolCategory: liveProtocol?.category,
    protocolResponseFamily: liveProtocol?.responseFamily,
    protocolDeliveryMode: liveProtocol?.deliveryMode,
    simSpecId: step.simSpecId || undefined,
    durationSeconds: step.plannedDurationSeconds || liveProtocol?.durationSeconds || undefined,
    executionPattern: step.executionPattern || 'single',
    trainingPlanId: primaryPlan.id,
    trainingPlanStepId: step.id,
    trainingPlanStepIndex: step.stepIndex,
  };
}

function candidateMatchesPlanStep(step, selectedCandidate, actionType, executionPattern) {
  if (!step) return false;

  const candidateActionType = actionType || selectedCandidate?.actionType || 'sim';
  const candidateExecutionPattern = selectedCandidate?.executionPattern || executionPattern || 'single';
  const candidateProtocolId = selectedCandidate?.protocolId || null;
  const candidateSimSpecId = selectedCandidate?.simSpecId || null;

  return (
    String(step.actionType || 'sim') === String(candidateActionType || 'sim')
    && String(step.executionPattern || 'single') === String(candidateExecutionPattern || 'single')
    && String(step.protocolId || '') === String(candidateProtocolId || '')
    && String(step.simSpecId || '') === String(candidateSimSpecId || '')
  );
}

async function resolvePlanBackedAssignment({
  db,
  athleteId,
  coachId,
  sourceDate,
  timezone,
  sourceStateSnapshotId,
  assignmentId,
  existingAssignment,
  progress,
  snapshot,
  activeProgram,
  selectedCandidate,
  actionType,
  executionPattern,
  lineageChanged,
  primaryPlan: seededPrimaryPlan,
  now,
}) {
  let primaryPlan = seededPrimaryPlan;

  if (!primaryPlan) {
    const ensuredPlan = await ensurePrimaryTrainingPlan({
      db,
      athleteId,
      coachId,
      sourceDate,
      timezone,
      sourceStateSnapshotId,
      progress,
      snapshot,
      activeProgram,
      liveProtocolRegistry: [],
      liveSimRegistry: [],
      now,
    });
    primaryPlan = ensuredPlan.primaryPlan;
  }

  if (!primaryPlan) {
    return null;
  }

  const planId = primaryPlan.id;
  const steps = clonePlanSteps(primaryPlan.steps || []);
  const existingStep = existingAssignment?.trainingPlanStepId
    ? steps.find((step) => step.id === existingAssignment.trainingPlanStepId)
    : steps.find((step) => step.linkedDailyTaskSourceDate === sourceDate && step.linkedDailyTaskId === assignmentId);
  const plannedStep = steps.find((step) => Number(step.stepIndex || 0) === Number(primaryPlan.nextDueStepIndex || primaryPlan.currentStepIndex || 0))
    || steps.find((step) => step.stepStatus === 'planned')
    || null;

  let overrideMetadata;
  let isPlanOverride = false;
  let activeStep = existingStep || plannedStep;

  if (existingStep && lineageChanged && activeStep && existingStep.id !== activeStep.id) {
    isPlanOverride = true;
    overrideMetadata = {
      overrideType: 'state_based_adjustment',
      overriddenBy: 'nora_runtime',
      overriddenByRole: 'system',
      overrideReason: `Same-day state rematerialization replaced ${existingStep.stepLabel || 'the planned step'}.`,
      originalAssignmentId: assignmentId,
      originalActionType: existingAssignment?.actionType,
      originalTrainingPlanId: planId,
      originalPlanStepId: existingStep.id,
      originalPlanStepIndex: existingStep.stepIndex,
    };
    const existingIndex = steps.findIndex((step) => step.id === existingStep.id);
    if (existingIndex >= 0) {
      steps.splice(existingIndex, 1, {
        ...existingStep,
        stepStatus: 'overridden',
        overrideReason: overrideMetadata.overrideReason,
      });
    }
  } else if (existingStep && lineageChanged) {
    isPlanOverride = true;
    overrideMetadata = {
      overrideType: 'state_based_adjustment',
      overriddenBy: 'nora_runtime',
      overriddenByRole: 'system',
      overrideReason: `Same-day state rematerialization updated ${existingStep.stepLabel || 'the planned step'}.`,
      originalAssignmentId: assignmentId,
      originalActionType: existingAssignment?.actionType,
      originalTrainingPlanId: planId,
      originalPlanStepId: existingStep.id,
      originalPlanStepIndex: existingStep.stepIndex,
    };
  }

  const selectedCandidateDiffersFromPlannedStep =
    !existingStep
    && plannedStep
    && !candidateMatchesPlanStep(plannedStep, selectedCandidate, actionType, executionPattern);

  if (selectedCandidateDiffersFromPlannedStep) {
    isPlanOverride = true;
    overrideMetadata = {
      overrideType: 'state_based_adjustment',
      overriddenBy: 'nora_runtime',
      overriddenByRole: 'system',
      overrideReason: `Today's state selection replaced ${plannedStep.stepLabel || 'the planned step'}.`,
      originalAssignmentId: assignmentId,
      originalActionType: plannedStep.actionType,
      originalTrainingPlanId: planId,
      originalPlanStepId: plannedStep.id,
      originalPlanStepIndex: plannedStep.stepIndex,
    };

    const plannedIndex = steps.findIndex((step) => step.id === plannedStep.id);
    if (plannedIndex >= 0) {
      steps.splice(plannedIndex, 1, {
        ...plannedStep,
        stepStatus: 'overridden',
        overrideReason: overrideMetadata.overrideReason,
      });
    }
    activeStep = null;
  }

  if (!activeStep) {
    const stepIndex = nextPlanStepIndex(steps);
    activeStep = {
      id: `${planId}_step_${String(stepIndex).padStart(4, '0')}`,
      stepIndex,
      stepLabel: resolvePlanStepLabel({
        stepIndex,
        selectedCandidate,
        activeProgram,
        actionType,
      }),
      stepStatus: 'planned',
      actionType,
      exerciseId: resolvePlanStepExerciseId({ selectedCandidate, activeProgram, actionType }),
      simSpecId: selectedCandidate?.simSpecId || activeProgram?.recommendedSimId || null,
      protocolId: selectedCandidate?.protocolId || null,
      executionPattern,
      targetSkills: activeProgram?.targetSkills || [],
      dueSourceDate: sourceDate,
      timezone,
      plannedDurationSeconds: selectedCandidate?.durationSeconds || activeProgram?.durationSeconds || null,
    };
    steps.push(activeStep);
  }

  const resolvedStep = {
    ...activeStep,
    stepLabel: activeStep.stepLabel || resolvePlanStepLabel({
      stepIndex: activeStep.stepIndex,
      selectedCandidate,
      activeProgram,
      actionType,
    }),
    stepStatus: actionType === 'defer' ? 'deferred' : 'active_today',
    actionType,
    exerciseId: resolvePlanStepExerciseId({ selectedCandidate, activeProgram, actionType }),
    simSpecId: selectedCandidate?.simSpecId || activeStep.simSpecId || activeProgram?.recommendedSimId || null,
    protocolId: selectedCandidate?.protocolId || activeStep.protocolId || null,
    executionPattern: activeStep.executionPattern || executionPattern || 'single',
    targetSkills: activeStep.targetSkills || activeProgram?.targetSkills || [],
    linkedDailyTaskId: assignmentId,
    linkedDailyTaskSourceDate: sourceDate,
    dueSourceDate: activeStep.dueSourceDate || sourceDate,
    timezone: activeStep.timezone || timezone,
    plannedDurationSeconds: selectedCandidate?.durationSeconds || activeProgram?.durationSeconds || activeStep.plannedDurationSeconds || null,
  };

  const nextSteps = steps
    .map((step) => {
      if (step.id === resolvedStep.id) {
        return resolvedStep;
      }
      if (step.stepStatus === 'active_today') {
        return {
          ...step,
          stepStatus: 'planned',
        };
      }
      return step;
    })
    .sort((left, right) => Number(left.stepIndex || 0) - Number(right.stepIndex || 0));

  const nextPlan = syncTrainingPlanProgression({
    ...primaryPlan,
    status: 'active',
    isPrimary: true,
    steps: nextSteps,
    sourceStateSnapshotId: sourceStateSnapshotId || primaryPlan.sourceStateSnapshotId || null,
    sourceDailyTaskId: assignmentId,
    sourceDate: primaryPlan.sourceDate || sourceDate,
    timezone: primaryPlan.timezone || timezone,
    currentStepIndex: resolvedStep.stepIndex,
    nextDueStepIndex: resolvedStep.stepIndex,
    resumedAt: primaryPlan.status === 'paused' ? now : (primaryPlan.resumedAt || null),
    updatedAt: now,
  });

  await db.collection(TRAINING_PLANS_COLLECTION).doc(planId).set(stripUndefinedDeep(nextPlan), { merge: true });

  return {
    trainingPlanId: planId,
    trainingPlanStepId: resolvedStep?.id,
    trainingPlanStepIndex: resolvedStep?.stepIndex,
    trainingPlanStepLabel: resolvedStep?.stepLabel,
    trainingPlanIsPrimary: true,
    isPlanOverride: isPlanOverride || Boolean(existingAssignment?.isPlanOverride),
    overrideMetadata: overrideMetadata || existingAssignment?.overrideMetadata,
  };
}

function derivePublishedRevisionId(protocolId, publishedAt) {
  if (!protocolId || typeof publishedAt !== 'number' || !Number.isFinite(publishedAt)) return undefined;
  return `${protocolId}@${publishedAt}`;
}

function hasNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function normalizeSimModuleRecord(id, data) {
  return {
    id,
    ...data,
  };
}

function isPublishedSimModuleRecord(record) {
  const buildArtifact = record?.buildArtifact && typeof record.buildArtifact === 'object'
    ? record.buildArtifact
    : null;
  const variantSource = record?.variantSource && typeof record.variantSource === 'object'
    ? record.variantSource
    : null;

  return Boolean(
    record
    && record.isActive !== false
    && hasNonEmptyString(record.id)
    && hasNonEmptyString(record.publishedFingerprint)
    && record.syncStatus === 'in_sync'
    && buildArtifact
    && hasNonEmptyString(buildArtifact.sourceFingerprint)
    && hasNonEmptyString(record.engineKey || buildArtifact.engineKey)
    && record.runtimeConfig
    && typeof record.runtimeConfig === 'object'
    && variantSource
    && typeof variantSource.publishedAt === 'number'
    && Number.isFinite(variantSource.publishedAt)
  );
}

async function listLivePublishedSimModules(db) {
  const snap = await db.collection(SIM_MODULES_COLLECTION).get();
  if (snap.empty) {
    return [];
  }

  return snap.docs
    .map((entry) => normalizeSimModuleRecord(entry.id, entry.data()))
    .filter((record) => isPublishedSimModuleRecord(record))
    .sort((left, right) => {
      if ((left.sortOrder || 999) !== (right.sortOrder || 999)) {
        return (left.sortOrder || 999) - (right.sortOrder || 999);
      }
      return String(left.name || '').localeCompare(String(right.name || ''));
    });
}

function normalizeActiveProgramContext(activeProgram) {
  if (!activeProgram || typeof activeProgram !== 'object') {
    return null;
  }

  const normalized = {};

  if (hasNonEmptyString(activeProgram.recommendedSimId)) {
    normalized.recommendedSimId = activeProgram.recommendedSimId.trim();
  }

  if (hasNonEmptyString(activeProgram.recommendedLegacyExerciseId)) {
    normalized.recommendedLegacyExerciseId = activeProgram.recommendedLegacyExerciseId.trim();
  }

  if (hasNonEmptyString(activeProgram.sessionType)) {
    normalized.sessionType = activeProgram.sessionType.trim();
  }

  if (hasNonEmptyString(activeProgram.durationMode)) {
    normalized.durationMode = activeProgram.durationMode.trim();
  }

  if (typeof activeProgram.durationSeconds === 'number' && Number.isFinite(activeProgram.durationSeconds)) {
    normalized.durationSeconds = activeProgram.durationSeconds;
  }

  if (hasNonEmptyString(activeProgram.rationale)) {
    normalized.rationale = activeProgram.rationale.trim();
  }

  return Object.keys(normalized).length ? normalized : null;
}

function resolveActiveProgramContext({ snapshot, progress }) {
  const progressActiveProgram = normalizeActiveProgramContext(progress?.activeProgram);
  const snapshotActiveProgram = normalizeActiveProgramContext(snapshot?.rawSignalSummary?.activeProgramContext);

  if (progressActiveProgram && snapshotActiveProgram) {
    return {
      ...progressActiveProgram,
      ...snapshotActiveProgram,
    };
  }

  return snapshotActiveProgram || progressActiveProgram || null;
}

function resolvePublishedSimCandidate(activeProgram, liveSimRegistry) {
  if (!activeProgram || (!activeProgram.recommendedSimId && !activeProgram.recommendedLegacyExerciseId)) {
    return {
      simModule: null,
      inventoryGap: null,
    };
  }

  const registry = Array.isArray(liveSimRegistry) ? liveSimRegistry : [];
  const recommendedSimId = hasNonEmptyString(activeProgram.recommendedSimId)
    ? activeProgram.recommendedSimId.trim().toLowerCase()
    : null;
  const recommendedLegacyExerciseId = hasNonEmptyString(activeProgram.recommendedLegacyExerciseId)
    ? activeProgram.recommendedLegacyExerciseId.trim().toLowerCase()
    : null;

  const simModule = registry.find((record) => {
    const recordId = hasNonEmptyString(record.id) ? record.id.trim().toLowerCase() : null;
    const recordSimSpecId = hasNonEmptyString(record.simSpecId) ? record.simSpecId.trim().toLowerCase() : null;

    return (
      (recommendedLegacyExerciseId && recordId === recommendedLegacyExerciseId)
      || (recommendedSimId && recordSimSpecId === recommendedSimId)
      || (recommendedSimId && recordId === recommendedSimId)
    );
  }) || null;

  if (simModule) {
    return {
      simModule,
      inventoryGap: null,
    };
  }

  const familyLookupTags = Array.from(new Set([
    normalizeTag(activeProgram.recommendedSimId),
    normalizeTag(activeProgram.recommendedLegacyExerciseId),
    normalizeTag(activeProgram.recommendedLegacyExerciseId).replace(/^focus_/, ''),
  ].filter(Boolean)));

  const familyFallback = registry.find((record) => {
    const recordId = normalizeTag(record.id);
    const recordSimSpecId = normalizeTag(record.simSpecId);
    const recordEngineKey = normalizeTag(record.engineKey || record?.buildArtifact?.engineKey);
    const recordFamily = normalizeTag(record?.variantSource?.family);

    return familyLookupTags.some((lookupTag) => (
      (recordEngineKey && recordEngineKey === lookupTag)
      || (recordFamily && recordFamily === lookupTag)
      || (recordId && recordId.startsWith(`${lookupTag}_`))
      || (recordSimSpecId && recordSimSpecId.startsWith(`${lookupTag}_`))
    ));
  }) || null;

  if (familyFallback) {
    return {
      simModule: familyFallback,
      inventoryGap: null,
    };
  }

  const requestedLabel = humanizeRuntimeLabel(
    activeProgram.recommendedSimId
    || activeProgram.recommendedLegacyExerciseId
    || activeProgram.sessionType
    || 'simulation'
  );

  return {
    simModule: null,
    inventoryGap: `${requestedLabel} is not currently published and launchable, so Nora should not assign it yet.`,
  };
}

function uniqueStrings(values) {
  return Array.from(new Set((Array.isArray(values) ? values : []).filter((value) => typeof value === 'string' && value.trim()).map((value) => value.trim())));
}

async function listRecentDailyAssignments({ db, athleteId, sourceDate, limit = 5 }) {
  if (!db || !athleteId || !isValidSourceDate(sourceDate)) {
    return [];
  }

  const assignmentsSnap = await db.collection(DAILY_ASSIGNMENTS_COLLECTION).where('athleteId', '==', athleteId).get();
  return assignmentsSnap.docs
    .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
    .filter((assignment) => isValidSourceDate(assignment.sourceDate) && assignment.sourceDate < sourceDate)
    .sort((left, right) => {
      const sourceDateComparison = compareSourceDateDesc(left.sourceDate, right.sourceDate);
      if (sourceDateComparison !== 0) return sourceDateComparison;
      return (right.updatedAt || right.createdAt || 0) - (left.updatedAt || left.createdAt || 0);
    })
    .slice(0, limit);
}

function deriveRecentAssignmentHistoryContext(assignments = []) {
  const orderedAssignments = (Array.isArray(assignments) ? assignments : [])
    .filter((assignment) => assignment && isValidSourceDate(assignment.sourceDate))
    .sort((left, right) => {
      const sourceDateComparison = compareSourceDateDesc(left.sourceDate, right.sourceDate);
      if (sourceDateComparison !== 0) return sourceDateComparison;
      return (right.updatedAt || right.createdAt || 0) - (left.updatedAt || left.createdAt || 0);
    });

  let consecutiveTier0Defers = 0;
  for (const assignment of orderedAssignments) {
    const isTier0 = Number(assignment.escalationTier || 0) === 0;
    const isDeferred = assignment.actionType === 'defer' || assignment.status === 'deferred';
    if (isTier0 && isDeferred) {
      consecutiveTier0Defers += 1;
      continue;
    }
    break;
  }

  const recentWindow = orderedAssignments.slice(0, 3);
  const recentTier0DeferCount = recentWindow.filter((assignment) =>
    Number(assignment.escalationTier || 0) === 0
    && (assignment.actionType === 'defer' || assignment.status === 'deferred')
  ).length;
  const recentProtocolAssigned = recentWindow.some((assignment) =>
    assignment.actionType === 'protocol' && assignment.status !== 'deferred' && assignment.status !== 'overridden'
  );
  const recentCompletedCount = recentWindow.filter((assignment) => assignment.status === 'completed').length;
  const latestAssignment = orderedAssignments[0] || null;

  return {
    recentAssignmentsConsidered: orderedAssignments.length,
    recentTier0DeferCount,
    consecutiveTier0Defers,
    recentProtocolAssigned,
    recentCompletedCount,
    latestAssignmentActionType: latestAssignment?.actionType,
    latestAssignmentStatus: latestAssignment?.status,
    latestAssignmentDate: latestAssignment?.sourceDate,
    shouldAvoidRepeatDefer: consecutiveTier0Defers >= 1,
  };
}

function deriveProtocolPolicySnapshotTags(snapshot) {
  const tags = new Set(uniqueStrings([
    ...(snapshot?.contextTags || []),
    snapshot?.recommendedRouting || '',
    snapshot?.recommendedProtocolClass || '',
    snapshot?.overallReadiness ? `${snapshot.overallReadiness}_snapshot` : '',
    typeof snapshot?.readinessScore === 'number'
      ? (snapshot.readinessScore < 45 ? 'low_readiness' : snapshot.readinessScore < 65 ? 'medium_readiness' : 'high_readiness')
      : '',
    snapshot?.supportFlag ? 'support_flag' : '',
    snapshot?.rawSignalSummary?.activeProgramContext?.sessionType || '',
    snapshot?.rawSignalSummary?.activeProgramContext?.durationMode || '',
    ...(snapshot?.rawSignalSummary?.contradictionFlags || []),
  ]).map((tag) => normalizeTag(tag)));

  const explicit = snapshot?.rawSignalSummary?.explicitSelfReport || {};
  const dimensions = snapshot?.stateDimensions || {};
  const sessionType = normalizeTag(snapshot?.rawSignalSummary?.activeProgramContext?.sessionType);
  const durationMode = normalizeTag(snapshot?.rawSignalSummary?.activeProgramContext?.durationMode);
  const moodWord = normalizeTag(explicit.moodWord);

  if (moodWord) tags.add(moodWord);

  if (sessionType === 'training_rep') {
    tags.add('pre_training');
    tags.add('pre_technical_work');
    tags.add('pre_rep_prep');
  }

  if (sessionType === 'pressure_exposure' || durationMode === 'extended_stress_test') {
    tags.add('competition_window');
    tags.add('high_stakes_week');
    tags.add('pre_competition');
  }

  if (sessionType === 'recovery_rep') {
    tags.add('recovery_day');
    tags.add('post_load');
    tags.add('post_competition');
  }

  if (sessionType === 'reassessment') {
    tags.add('post_trial');
  }

  if (snapshot?.recommendedProtocolClass === 'priming') {
    tags.add('pre_training');
    tags.add('pre_rep_prep');
  }

  if (snapshot?.recommendedProtocolClass === 'recovery') {
    tags.add('recovery_day');
    tags.add('post_load');
  }

  if (typeof explicit.energyLevel === 'number' && explicit.energyLevel <= 2) {
    ['low_energy', 'flatness', 'underactivation', 'slow_start'].forEach((tag) => tags.add(tag));
  }

  if (typeof explicit.stressLevel === 'number' && explicit.stressLevel >= 4) {
    ['acute_stress', 'anxiety', 'pressure_spike', 'mental_noise'].forEach((tag) => tags.add(tag));
  }

  if (typeof explicit.sleepQuality === 'number' && explicit.sleepQuality <= 2) {
    ['sleep_sensitive', 'heavy_fatigue', 'cognitive_depletion'].forEach((tag) => tags.add(tag));
  }

  if (dimensions.activation >= 80) {
    ['activation_spike', 'overactivation', 'panic_spike', 'racing_heart', 'racing_thoughts', 'somatic_noise', 'hidden_tension'].forEach((tag) => tags.add(tag));
  } else if (dimensions.activation >= 65) {
    ['activation_spike', 'overactivation', 'hidden_tension', 'somatic_noise'].forEach((tag) => tags.add(tag));
  } else if (dimensions.activation <= 35) {
    ['underactivation', 'low_presence'].forEach((tag) => tags.add(tag));
  }

  if (dimensions.focusReadiness <= 45) {
    ['scattered_focus', 'mental_noise', 'technical_rust'].forEach((tag) => tags.add(tag));
  }

  if (dimensions.emotionalLoad >= 70) {
    ['anxiety', 'mental_noise', 'hidden_tension'].forEach((tag) => tags.add(tag));
  }

  if (dimensions.cognitiveFatigue >= 70) {
    ['heavy_fatigue', 'cognitive_depletion', 'sleep_sensitive'].forEach((tag) => tags.add(tag));
  }

  return tags;
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

function buildCandidateSetId(athleteId, sourceDate) {
  return `${athleteId}_${sourceDate}_candidates`;
}

function normalizeProtocolRegistryRecord(record, now = Date.now()) {
  return protocolRegistryRuntime.normalizeProtocolRecord(record, now);
}

async function listLiveProtocolRegistry(db) {
  const collectionRef = db.collection(PROTOCOLS_COLLECTION);
  const snap = await collectionRef.get();

  if (snap.empty) {
    const seededRecords = protocolRegistryRuntime.listPulseCheckProtocolSeedRecords(Date.now());
    const batch = db.batch();
    seededRecords.forEach((record) => {
      batch.set(collectionRef.doc(record.id), record, { merge: true });
    });
    await batch.commit();
    return seededRecords.filter((record) => (
      record.isActive
      && record.publishStatus === 'published'
      && record.governanceStage !== 'restricted'
      && record.familyId
      && record.variantId
      && record.label
      && record.legacyExerciseId
    ));
  }

  return snap.docs
    .map((entry) => normalizeProtocolRegistryRecord({ id: entry.id, ...entry.data() }))
    .filter((record) => (
      record.isActive
      && record.publishStatus === 'published'
      && record.governanceStage !== 'restricted'
      && record.familyId
      && record.variantId
      && record.label
      && record.legacyExerciseId
    ))
    .sort((left, right) => {
      if ((left.sortOrder || 999) !== (right.sortOrder || 999)) {
        return (left.sortOrder || 999) - (right.sortOrder || 999);
      }
      return String(left.label || '').localeCompare(String(right.label || ''));
    });
}

function deriveResponsivenessDirection(positiveSignals, negativeSignals) {
  if (negativeSignals > positiveSignals && negativeSignals > 0) return 'negative';
  if (positiveSignals > negativeSignals && positiveSignals > 0) return 'positive';
  if (positiveSignals > 0 && negativeSignals > 0) return 'mixed';
  return 'neutral';
}

function deriveResponsivenessConfidence(sampleSize, positiveSignals, negativeSignals) {
  const decisiveSignals = positiveSignals + negativeSignals;
  const dominantSignals = Math.max(positiveSignals, negativeSignals);
  const dominance = decisiveSignals > 0 ? dominantSignals / decisiveSignals : 0;

  if (sampleSize >= 6 && decisiveSignals >= 4 && dominance >= 0.66) return 'high';
  if (sampleSize >= 3 && decisiveSignals >= 2) return 'medium';
  return 'low';
}

function deriveResponsivenessFreshness(lastObservedAt) {
  if (!lastObservedAt) return 'refresh_required';
  const ageDays = (Date.now() - lastObservedAt) / DAY_MS;
  if (ageDays <= CURRENT_RESPONSIVENESS_WINDOW_DAYS) return 'current';
  if (ageDays <= DEGRADED_RESPONSIVENESS_WINDOW_DAYS) return 'degraded';
  return 'refresh_required';
}

function buildResponsivenessStaleAt(lastObservedAt) {
  const anchor = lastObservedAt || Date.now();
  return anchor + DEGRADED_RESPONSIVENESS_WINDOW_DAYS * DAY_MS;
}

function buildResponsivenessSummary(bucket) {
  return {
    protocolFamilyId: bucket.protocolFamilyId,
    protocolFamilyLabel: bucket.protocolFamilyLabel,
    variantId: bucket.variantId,
    variantLabel: bucket.variantLabel,
    protocolClass: bucket.protocolClass,
    responseFamily: bucket.responseFamily,
    responseDirection: deriveResponsivenessDirection(bucket.positiveSignals, bucket.negativeSignals),
    confidence: deriveResponsivenessConfidence(bucket.sampleSize, bucket.positiveSignals, bucket.negativeSignals),
    freshness: deriveResponsivenessFreshness(bucket.lastConfirmedAt || bucket.lastObservedAt),
    sampleSize: bucket.sampleSize,
    positiveSignals: bucket.positiveSignals,
    neutralSignals: bucket.neutralSignals,
    negativeSignals: bucket.negativeSignals,
    stateFit: Array.from(bucket.stateFit || []).slice(0, 8),
    supportingEvidence: (bucket.supportingEvidence || []).slice(0, 6),
    lastObservedAt: bucket.lastObservedAt || undefined,
    lastConfirmedAt: bucket.lastConfirmedAt || undefined,
  };
}

function classifyResponsivenessWindow({ assignment, runtime, events, snapshot, downstreamAssignments }) {
  const supportingEvidence = [];
  const sourceEventIds = events.map((entry) => entry.id);
  const latestMeaningfulEvent = events.find((entry) =>
    entry.eventType === 'completed' || entry.eventType === 'deferred' || entry.eventType === 'overridden'
  );

  let score = 0;
  let lastObservedAt = latestMeaningfulEvent?.eventAt || assignment.updatedAt || assignment.createdAt || Date.now();
  let lastConfirmedAt;

  if (latestMeaningfulEvent?.eventType === 'completed' || assignment.status === 'completed') {
    score += 1;
    lastConfirmedAt = Math.max(lastConfirmedAt || 0, latestMeaningfulEvent?.eventAt || assignment.completedAt || assignment.updatedAt || assignment.createdAt);
    supportingEvidence.push('Protocol assignment completed successfully.');
  } else if (
    latestMeaningfulEvent?.eventType === 'deferred'
    || latestMeaningfulEvent?.eventType === 'overridden'
    || assignment.status === 'deferred'
    || assignment.status === 'overridden'
  ) {
    score -= 1;
    lastConfirmedAt = Math.max(lastConfirmedAt || 0, latestMeaningfulEvent?.eventAt || assignment.updatedAt || assignment.createdAt);
    supportingEvidence.push('Protocol was deferred or replaced before a clean completion.');
  } else if (assignment.status === 'started' || assignment.status === 'viewed') {
    supportingEvidence.push('Protocol was engaged but the outcome is still incomplete.');
  } else {
    supportingEvidence.push('Protocol was assigned without enough outcome signal yet.');
  }

  if (snapshot && typeof assignment.readinessScore === 'number' && typeof snapshot.readinessScore === 'number') {
    const readinessDelta = snapshot.readinessScore - assignment.readinessScore;
    lastObservedAt = Math.max(lastObservedAt, snapshot.updatedAt || 0);

    if (readinessDelta >= 5) {
      score += 1;
      lastConfirmedAt = Math.max(lastConfirmedAt || 0, snapshot.updatedAt || 0);
      supportingEvidence.push(`Same-day readiness improved from ${assignment.readinessScore} to ${snapshot.readinessScore}.`);
    } else if (readinessDelta <= -5) {
      score -= 1;
      lastConfirmedAt = Math.max(lastConfirmedAt || 0, snapshot.updatedAt || 0);
      supportingEvidence.push(`Same-day readiness dropped from ${assignment.readinessScore} to ${snapshot.readinessScore}.`);
    } else {
      supportingEvidence.push('Same-day readiness stayed near baseline after the protocol.');
    }
  }

  const downstreamSim = downstreamAssignments
    .slice()
    .sort((left, right) => (right.updatedAt || 0) - (left.updatedAt || 0))[0];

  if (downstreamSim) {
    lastObservedAt = Math.max(lastObservedAt, downstreamSim.updatedAt || downstreamSim.createdAt || 0);
    if (downstreamSim.status === 'completed') {
      score += 1;
      lastConfirmedAt = Math.max(lastConfirmedAt || 0, downstreamSim.completedAt || downstreamSim.updatedAt || 0);
      supportingEvidence.push(`Downstream ${downstreamSim.actionType === 'lighter_sim' ? 'lighter sim' : 'sim'} completed on the same day.`);
    } else if (downstreamSim.status === 'deferred' || downstreamSim.status === 'overridden') {
      score -= 1;
      lastConfirmedAt = Math.max(lastConfirmedAt || 0, downstreamSim.updatedAt || 0);
      supportingEvidence.push(`Downstream ${downstreamSim.actionType === 'lighter_sim' ? 'lighter sim' : 'sim'} was deferred or overridden.`);
    } else {
      supportingEvidence.push('Downstream execution exists but is still inconclusive.');
    }
  }

  return {
    responseDirection: score > 0 ? 'positive' : score < 0 ? 'negative' : 'neutral',
    stateFit: uniqueStrings([
      assignment.readinessBand ? `${assignment.readinessBand}_readiness` : '',
      snapshot?.overallReadiness ? `${snapshot.overallReadiness}_snapshot` : '',
      snapshot?.recommendedRouting || '',
      snapshot?.recommendedProtocolClass && snapshot.recommendedProtocolClass !== 'none'
        ? snapshot.recommendedProtocolClass
        : '',
      ...(snapshot?.contextTags || []),
      ...(runtime.preferredContextTags || []),
    ]),
    supportingEvidence: uniqueStrings(supportingEvidence).slice(0, 6),
    sourceEventIds,
    lastObservedAt,
    lastConfirmedAt,
  };
}

async function getOrRefreshProtocolResponsivenessProfile({ db, athleteId, protocolRegistry }) {
  const profileRef = db.collection(PROTOCOL_RESPONSIVENESS_COLLECTION).doc(athleteId);
  const existingSnap = await profileRef.get();
  const existing = existingSnap.exists ? { id: existingSnap.id, ...existingSnap.data() } : null;
  if (existing && typeof existing.staleAt === 'number' && existing.staleAt > Date.now()) {
    return existing;
  }

  const [assignmentsSnap, eventsSnap, snapshotsSnap] = await Promise.all([
    db.collection(DAILY_ASSIGNMENTS_COLLECTION).where('athleteId', '==', athleteId).get(),
    db.collection(ASSIGNMENT_EVENTS_COLLECTION).where('athleteId', '==', athleteId).get(),
    db.collection(SNAPSHOTS_COLLECTION).where('athleteId', '==', athleteId).get(),
  ]);

  const assignments = assignmentsSnap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
  const eventsByAssignmentId = new Map();
  eventsSnap.docs.forEach((docSnap) => {
    const event = { id: docSnap.id, ...docSnap.data() };
    const existingEvents = eventsByAssignmentId.get(event.assignmentId) || [];
    existingEvents.push(event);
    existingEvents.sort((left, right) => (right.eventAt || 0) - (left.eventAt || 0));
    eventsByAssignmentId.set(event.assignmentId, existingEvents);
  });
  const snapshotsById = new Map();
  const snapshotsByDate = new Map();
  snapshotsSnap.docs.forEach((docSnap) => {
    const snapshot = { id: docSnap.id, ...docSnap.data() };
    snapshotsById.set(snapshot.id, snapshot);
    snapshotsByDate.set(snapshot.sourceDate, snapshot);
  });

  const runtimeById = new Map((Array.isArray(protocolRegistry) ? protocolRegistry : []).map((runtime) => [runtime.id, runtime]));
  const familyBuckets = new Map();
  const variantBuckets = new Map();
  const sourceEventIds = new Set();
  let latestObservedAt = 0;

  assignments
    .filter((assignment) => assignment.actionType === 'protocol' && assignment.protocolId && runtimeById.has(assignment.protocolId))
    .forEach((assignment) => {
      const runtime = runtimeById.get(assignment.protocolId);
      if (!runtime) return;

      const snapshot = assignment.sourceStateSnapshotId
        ? (snapshotsById.get(assignment.sourceStateSnapshotId) || snapshotsByDate.get(assignment.sourceDate) || null)
        : (snapshotsByDate.get(assignment.sourceDate) || null);
      const downstreamAssignments = assignments.filter((candidate) =>
        candidate.athleteId === assignment.athleteId
        && candidate.sourceDate === assignment.sourceDate
        && candidate.id !== assignment.id
        && (candidate.actionType === 'sim' || candidate.actionType === 'lighter_sim')
      );
      const window = classifyResponsivenessWindow({
        assignment,
        runtime,
        events: eventsByAssignmentId.get(assignment.id) || [],
        snapshot,
        downstreamAssignments,
      });

      latestObservedAt = Math.max(latestObservedAt, window.lastObservedAt || 0);
      window.sourceEventIds.forEach((eventId) => sourceEventIds.add(eventId));

      const familyBucket = familyBuckets.get(runtime.familyId) || {
        protocolFamilyId: runtime.familyId,
        protocolFamilyLabel: runtime.familyLabel,
        protocolClass: runtime.protocolClass,
        responseFamily: runtime.responseFamily,
        sampleSize: 0,
        positiveSignals: 0,
        neutralSignals: 0,
        negativeSignals: 0,
        stateFit: new Set(),
        supportingEvidence: [],
        lastObservedAt: 0,
        lastConfirmedAt: undefined,
      };
      familyBucket.sampleSize += 1;
      if (window.responseDirection === 'positive') familyBucket.positiveSignals += 1;
      else if (window.responseDirection === 'negative') familyBucket.negativeSignals += 1;
      else familyBucket.neutralSignals += 1;
      window.stateFit.forEach((tag) => familyBucket.stateFit.add(tag));
      familyBucket.supportingEvidence = uniqueStrings([...familyBucket.supportingEvidence, ...window.supportingEvidence]).slice(0, 6);
      familyBucket.lastObservedAt = Math.max(familyBucket.lastObservedAt, window.lastObservedAt || 0);
      if (window.lastConfirmedAt) familyBucket.lastConfirmedAt = Math.max(familyBucket.lastConfirmedAt || 0, window.lastConfirmedAt);
      familyBuckets.set(runtime.familyId, familyBucket);

      const variantBucket = variantBuckets.get(runtime.variantId) || {
        protocolFamilyId: runtime.familyId,
        protocolFamilyLabel: runtime.familyLabel,
        variantId: runtime.variantId,
        variantLabel: runtime.variantLabel,
        protocolClass: runtime.protocolClass,
        responseFamily: runtime.responseFamily,
        sampleSize: 0,
        positiveSignals: 0,
        neutralSignals: 0,
        negativeSignals: 0,
        stateFit: new Set(),
        supportingEvidence: [],
        lastObservedAt: 0,
        lastConfirmedAt: undefined,
      };
      variantBucket.sampleSize += 1;
      if (window.responseDirection === 'positive') variantBucket.positiveSignals += 1;
      else if (window.responseDirection === 'negative') variantBucket.negativeSignals += 1;
      else variantBucket.neutralSignals += 1;
      window.stateFit.forEach((tag) => variantBucket.stateFit.add(tag));
      variantBucket.supportingEvidence = uniqueStrings([...variantBucket.supportingEvidence, ...window.supportingEvidence]).slice(0, 6);
      variantBucket.lastObservedAt = Math.max(variantBucket.lastObservedAt, window.lastObservedAt || 0);
      if (window.lastConfirmedAt) variantBucket.lastConfirmedAt = Math.max(variantBucket.lastConfirmedAt || 0, window.lastConfirmedAt);
      variantBuckets.set(runtime.variantId, variantBucket);
    });

  const profile = {
    id: athleteId,
    athleteId,
    familyResponses: Object.fromEntries(Array.from(familyBuckets.entries()).map(([familyId, bucket]) => [familyId, buildResponsivenessSummary(bucket)])),
    variantResponses: Object.fromEntries(Array.from(variantBuckets.entries()).map(([variantId, bucket]) => [variantId, buildResponsivenessSummary(bucket)])),
    sourceEventIds: Array.from(sourceEventIds).slice(0, 100),
    staleAt: buildResponsivenessStaleAt(latestObservedAt || existing?.updatedAt),
    lastUpdatedAt: Date.now(),
    createdAt: existing?.createdAt || Date.now(),
    updatedAt: Date.now(),
  };

  await profileRef.set(stripUndefinedDeep(profile), { merge: true });
  return profile;
}

function buildProtocolResponsivenessScore({ snapshot, runtime, responsivenessProfile }) {
  if (!responsivenessProfile) return 0;

  const familySummary = responsivenessProfile.familyResponses?.[runtime.familyId];
  const variantSummary = responsivenessProfile.variantResponses?.[runtime.variantId];
  const summary = variantSummary || familySummary;
  if (!summary) return 0;

  const confidenceWeight = summary.confidence === 'high' ? 1 : summary.confidence === 'medium' ? 0.6 : 0.3;
  const freshnessWeight = summary.freshness === 'current' ? 1 : summary.freshness === 'degraded' ? 0.55 : 0.2;
  const stateWeight = snapshot.confidence === 'high' ? 1 : snapshot.confidence === 'medium' ? 0.72 : 0.45;
  const fitTags = new Set([
    snapshot.overallReadiness ? `${snapshot.overallReadiness}_snapshot` : '',
    snapshot.recommendedRouting || '',
    snapshot.recommendedProtocolClass || '',
    ...(snapshot.contextTags || []),
    snapshot.readinessScore < 45 ? 'low_readiness' : snapshot.readinessScore < 65 ? 'medium_readiness' : 'high_readiness',
  ]);
  const fitBonus = Math.min((summary.stateFit || []).filter((tag) => fitTags.has(tag)).length * 4, 12);

  let base = 0;
  switch (summary.responseDirection) {
    case 'positive':
      base = 18;
      break;
    case 'negative':
      base = -24;
      break;
    case 'mixed':
      base = -6;
      break;
    default:
      base = 0;
      break;
  }

  const weighted = (base + fitBonus) * confidenceWeight * freshnessWeight * stateWeight;
  if (summary.responseDirection === 'negative' && summary.confidence === 'high') {
    return weighted - 10;
  }
  return weighted;
}

function buildResponsivenessPlannerSummary(runtime, responsivenessProfile) {
  if (!responsivenessProfile) return undefined;
  const summary =
    responsivenessProfile.variantResponses?.[runtime.variantId]
    || responsivenessProfile.familyResponses?.[runtime.familyId];
  if (!summary) return undefined;

  const evidenceLead = summary.supportingEvidence?.[0];
  const posture = `${summary.freshness} ${summary.confidence}-confidence ${summary.responseDirection}`;
  return evidenceLead
    ? `Athlete responsiveness is ${posture} for ${runtime.variantLabel || runtime.label}. ${evidenceLead}`
    : `Athlete responsiveness is ${posture} for ${runtime.variantLabel || runtime.label}.`;
}

function extractJsonObject(text) {
  if (!text || typeof text !== 'string') return null;

  try {
    return JSON.parse(text);
  } catch (error) {
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      try {
        return JSON.parse(text.slice(firstBrace, lastBrace + 1));
      } catch (nestedError) {
        return null;
      }
    }
  }

  return null;
}

function toTimestampMillis(value) {
  if (!value) return 0;
  if (typeof value === 'number') return value;
  if (value instanceof Date) return value.getTime();
  if (value instanceof admin.firestore.Timestamp) return value.toMillis();
  if (typeof value === 'object' && typeof value.seconds === 'number') {
    return Number(value.seconds) * 1000;
  }
  return 0;
}

function normalizeReadinessScore({ checkIn, progress }) {
  const explicitReadiness = normalizeExplicitReadinessScore(checkIn?.readinessScore);
  const profileReadiness = progress?.taxonomyProfile?.modifierScores?.readiness;

  if (typeof profileReadiness === 'number' && Number.isFinite(profileReadiness)) {
    const boundedProfileReadiness = clamp(profileReadiness);
    const gap = Math.abs(explicitReadiness - boundedProfileReadiness);
    const profileWeight = gap >= 30 ? 0.15 : 0.25;

    return clamp(explicitReadiness * (1 - profileWeight) + boundedProfileReadiness * profileWeight);
  }

  return explicitReadiness;
}

function deriveStateDimensions({ checkIn, progress }) {
  const readiness = normalizeReadinessScore({ checkIn, progress });
  const energy = typeof checkIn.energyLevel === 'number' ? ((checkIn.energyLevel - 1) / 4) * 100 : readiness;
  const stress = typeof checkIn.stressLevel === 'number' ? ((checkIn.stressLevel - 1) / 4) * 100 : 100 - readiness;
  const sleep = typeof checkIn.sleepQuality === 'number' ? ((checkIn.sleepQuality - 1) / 4) * 100 : readiness;
  const fatigability = progress?.taxonomyProfile?.modifierScores?.fatigability;
  const pressureSensitivity = progress?.taxonomyProfile?.modifierScores?.pressure_sensitivity;

  return {
    activation: clamp(stress * 0.65 + (pressureSensitivity ?? stress) * 0.35),
    focusReadiness: clamp(readiness * 0.55 + energy * 0.3 + sleep * 0.15),
    emotionalLoad: clamp(stress * 0.7 + (100 - readiness) * 0.3),
    cognitiveFatigue: clamp((100 - sleep) * 0.55 + (100 - energy) * 0.3 + (fatigability ?? (100 - readiness)) * 0.15),
  };
}

function deriveOverallReadiness({ readinessScore, dimensions }) {
  if (readinessScore >= 70 && dimensions.focusReadiness >= 65 && dimensions.cognitiveFatigue <= 45) return 'green';
  if (readinessScore < 45 || dimensions.cognitiveFatigue >= 70 || dimensions.emotionalLoad >= 70) return 'red';
  return 'yellow';
}

function deriveConfidence({ checkIn, progress, contradictionFlags = [] }) {
  let signalCount = 1;
  if (typeof checkIn.energyLevel === 'number') signalCount += 1;
  if (typeof checkIn.stressLevel === 'number') signalCount += 1;
  if (typeof checkIn.sleepQuality === 'number') signalCount += 1;
  if (checkIn.taxonomyState) signalCount += 1;
  if (progress?.taxonomyProfile) signalCount += 1;

  let confidence = 'low';
  if (signalCount >= 4) confidence = 'high';
  else if (signalCount >= 2) confidence = 'medium';

  if (contradictionFlags.length >= 2) {
    return 'low';
  }

  if (contradictionFlags.length === 1 && confidence === 'high') {
    return 'medium';
  }

  return confidence;
}

function deriveRouting({ readiness, readinessScore, dimensions, confidence, contradictionFlags = [], progress, recentAssignmentHistory }) {
  const sessionType = progress?.activeProgram?.sessionType;
  const durationMode = progress?.activeProgram?.durationMode;
  const severeRedState =
    readinessScore < 30
    || dimensions.activation >= 85
    || dimensions.emotionalLoad >= 85
    || dimensions.cognitiveFatigue >= 85;
  const criticalRedState =
    readinessScore < 20
    || [dimensions.activation, dimensions.emotionalLoad, dimensions.cognitiveFatigue].filter((value) => value >= 90).length >= 2;
  const highCostDay =
    sessionType === 'reassessment'
    || sessionType === 'pressure_exposure'
    || durationMode === 'extended_stress_test';
  const fragileEvidence = confidence === 'low' || contradictionFlags.length >= 2;
  const shouldAvoidRepeatDefer = Boolean(recentAssignmentHistory?.shouldAvoidRepeatDefer);

  if (readiness === 'red') {
    if (sessionType === 'recovery_rep') {
      return 'protocol_only';
    }

    if (shouldAvoidRepeatDefer && !criticalRedState) {
      return 'protocol_only';
    }

    if ((severeRedState && highCostDay) || (severeRedState && fragileEvidence)) {
      return 'defer_alternate_path';
    }

    return 'protocol_only';
  }
  if (readiness === 'yellow') {
    return 'protocol_then_sim';
  }
  if (sessionType === 'reassessment') return 'trial_only';
  return 'sim_only';
}

function deriveProtocolClass({ dimensions, progress }) {
  const sessionType = progress?.activeProgram?.sessionType;
  if (sessionType === 'recovery_rep' || dimensions.cognitiveFatigue >= 70) return 'recovery';
  if (dimensions.activation >= 65 || dimensions.emotionalLoad >= 65) return 'regulation';
  if (dimensions.focusReadiness <= 45) return 'priming';
  return 'none';
}

function deriveContextTags(progress, assignmentHistoryContext) {
  const tags = new Set();
  const sessionType = progress?.activeProgram?.sessionType;
  const durationMode = progress?.activeProgram?.durationMode;
  if (sessionType) tags.add(sessionType);
  if (durationMode) tags.add(durationMode);
  if (durationMode === 'extended_stress_test') tags.add('high_load_window');
  if (assignmentHistoryContext?.recentTier0DeferCount >= 1) tags.add('recent_tier0_defer');
  if (assignmentHistoryContext?.consecutiveTier0Defers >= 2) tags.add('consecutive_tier0_defers');
  if (assignmentHistoryContext?.shouldAvoidRepeatDefer) tags.add('avoid_repeat_defer');
  return Array.from(tags);
}

function detectContradictionFlags({ checkIn, normalizedScore, dimensions }) {
  const contradictions = [];
  const explicitReadiness = Number(checkIn.readinessScore || 0);

  if (explicitReadiness >= 4 && (dimensions.emotionalLoad >= 70 || dimensions.cognitiveFatigue >= 70)) {
    contradictions.push('high_self_report_vs_heavy_state_markers');
  }

  if (explicitReadiness <= 2 && dimensions.focusReadiness >= 70) {
    contradictions.push('low_self_report_vs_high_focus_markers');
  }

  if (typeof checkIn.sleepQuality === 'number' && checkIn.sleepQuality <= 2 && explicitReadiness >= 4) {
    contradictions.push('high_readiness_vs_poor_sleep');
  }

  if (typeof checkIn.stressLevel === 'number' && checkIn.stressLevel >= 4 && explicitReadiness >= 4) {
    contradictions.push('high_readiness_vs_high_stress');
  }

  if (normalizedScore >= 75 && dimensions.activation >= 70) {
    contradictions.push('profile_readiness_vs_activation_spike');
  }

  return uniqueStrings(contradictions);
}

function buildRawSignalSummary({ checkIn, progress, normalizedScore, contradictionFlags }) {
  let signalCount = 1;
  if (typeof checkIn.energyLevel === 'number') signalCount += 1;
  if (typeof checkIn.stressLevel === 'number') signalCount += 1;
  if (typeof checkIn.sleepQuality === 'number') signalCount += 1;
  if (checkIn.taxonomyState) signalCount += 1;
  if (progress?.taxonomyProfile) signalCount += 1;
  if (progress?.activeProgram) signalCount += 1;

  return {
    explicitSelfReport: {
      readinessScore: Number(checkIn.readinessScore || 1),
      moodWord: typeof checkIn.moodWord === 'string' ? checkIn.moodWord : undefined,
      energyLevel: typeof checkIn.energyLevel === 'number' ? checkIn.energyLevel : undefined,
      stressLevel: typeof checkIn.stressLevel === 'number' ? checkIn.stressLevel : undefined,
      sleepQuality: typeof checkIn.sleepQuality === 'number' ? checkIn.sleepQuality : undefined,
      notes: typeof checkIn.notes === 'string' ? checkIn.notes : undefined,
    },
    activeProgramContext: progress?.activeProgram
      ? {
          sessionType: progress.activeProgram.sessionType,
          durationMode: progress.activeProgram.durationMode,
          recommendedSimId: progress.activeProgram.recommendedSimId,
          recommendedLegacyExerciseId: progress.activeProgram.recommendedLegacyExerciseId,
        }
      : undefined,
    assignmentHistoryContext: progress?.recentAssignmentHistoryContext
      ? {
          recentAssignmentsConsidered: progress.recentAssignmentHistoryContext.recentAssignmentsConsidered,
          recentTier0DeferCount: progress.recentAssignmentHistoryContext.recentTier0DeferCount,
          consecutiveTier0Defers: progress.recentAssignmentHistoryContext.consecutiveTier0Defers,
          latestAssignmentActionType: progress.recentAssignmentHistoryContext.latestAssignmentActionType,
          latestAssignmentStatus: progress.recentAssignmentHistoryContext.latestAssignmentStatus,
          latestAssignmentDate: progress.recentAssignmentHistoryContext.latestAssignmentDate,
          shouldAvoidRepeatDefer: progress.recentAssignmentHistoryContext.shouldAvoidRepeatDefer,
        }
      : undefined,
    normalizedReadinessScore: normalizedScore,
    signalCount,
    contradictionFlags,
  };
}

function buildFallbackInterpretation({ snapshot }) {
  const dimensions = snapshot.stateDimensions || {};
  const dimensionEntries = [
    ['activation', dimensions.activation ?? 0],
    ['focus_readiness', dimensions.focusReadiness ?? 0],
    ['emotional_load', dimensions.emotionalLoad ?? 0],
    ['cognitive_fatigue', dimensions.cognitiveFatigue ?? 0],
  ].sort((left, right) => right[1] - left[1]);

  const primaryFactor = VALID_PRIMARY_FACTORS.has(dimensionEntries[0]?.[0]) ? dimensionEntries[0][0] : 'mixed';
  const supportingSignals = [];

  if ((dimensions.activation ?? 0) >= 65) supportingSignals.push('activation is elevated');
  if ((dimensions.focusReadiness ?? 0) <= 45) supportingSignals.push('focus readiness looks limited');
  if ((dimensions.emotionalLoad ?? 0) >= 65) supportingSignals.push('emotional load is elevated');
  if ((dimensions.cognitiveFatigue ?? 0) >= 65) supportingSignals.push('cognitive fatigue markers are elevated');
  if (!supportingSignals.length) supportingSignals.push(`overall readiness reads ${snapshot.overallReadiness}`);

  const contradictions = uniqueStrings(snapshot.rawSignalSummary?.contradictionFlags);
  const candidateClassHints =
    snapshot.recommendedRouting === 'trial_only'
      ? ['trial']
      : snapshot.recommendedRouting === 'protocol_only'
        ? ['protocol']
        : snapshot.recommendedRouting === 'protocol_then_sim' || snapshot.recommendedRouting === 'sim_then_protocol'
          ? ['protocol', 'sim']
          : snapshot.recommendedRouting === 'defer_alternate_path'
            ? []
            : ['sim'];

  return {
    summary: `Fallback interpretation: today's signal most likely reflects ${humanizeRuntimeLabel(primaryFactor)} pressure inside a ${snapshot.overallReadiness} readiness posture.`,
    likelyPrimaryFactor: primaryFactor,
    supportingSignals,
    contradictions,
    plannerNotes: contradictions.length
      ? ['Contradictions are present, so Nora should prefer bounded and reversible decisions.']
      : ['Signals are reasonably aligned for a bounded assignment decision.'],
    confidence: snapshot.confidence,
    confidenceRationale:
      snapshot.confidence === 'high'
        ? 'Multiple aligned signals are present.'
        : snapshot.confidence === 'medium'
          ? 'Some support exists, but the evidence is not fully dense.'
          : 'Evidence is sparse or conflicting.',
    recommendedRouting: snapshot.recommendedRouting,
    recommendedProtocolClass: snapshot.recommendedProtocolClass || 'none',
    candidateClassHints,
    supportFlag: snapshot.overallReadiness === 'red' && contradictions.length > 0,
    modelSource: 'fallback_rules',
  };
}

async function callOpenAiJson({ systemPrompt, userPayload }) {
  const apiKey = process.env.OPEN_AI_SECRET_KEY;
  if (!apiKey) return null;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0.2,
      max_tokens: 700,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: JSON.stringify(userPayload) },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`OpenAI request failed (${response.status}): ${errorText.slice(0, 240)}`);
  }

  const completion = await response.json();
  const content = completion?.choices?.[0]?.message?.content;
  return extractJsonObject(content);
}

async function enrichStateSnapshotWithAI({ snapshot, progress }) {
  const fallback = buildFallbackInterpretation({ snapshot });

  try {
    const raw = await callOpenAiJson({
      systemPrompt: [
        'You are enriching a sports mental-performance state snapshot for Nora.',
        'Return only valid JSON.',
        'Do not invent medical claims.',
        'Use only the evidence provided.',
        'You may adjust confidence, routing recommendation, protocol class hint, and candidate class hints.',
        'Allowed confidence: high, medium, low.',
        'Allowed routing: protocol_only, sim_only, trial_only, protocol_then_sim, sim_then_protocol, defer_alternate_path.',
        'Allowed protocolClass: regulation, priming, recovery, none.',
        'Allowed candidateClassHints values: sim, protocol, trial.',
        'Allowed likelyPrimaryFactor: activation, focus_readiness, emotional_load, cognitive_fatigue, mixed.',
        'JSON shape: {"summary":"","likelyPrimaryFactor":"","supportingSignals":[],"contradictions":[],"plannerNotes":[],"confidence":"","confidenceRationale":"","recommendedRouting":"","recommendedProtocolClass":"","candidateClassHints":[],"supportFlag":false}',
      ].join(' '),
      userPayload: {
        stateSnapshot: snapshot,
        activeProgram: progress?.activeProgram || null,
      },
    });

    if (!raw || typeof raw !== 'object') {
      return {
        ...snapshot,
        enrichedInterpretation: {
          summary: fallback.summary,
          likelyPrimaryFactor: fallback.likelyPrimaryFactor,
          supportingSignals: fallback.supportingSignals,
          contradictions: fallback.contradictions,
          plannerNotes: fallback.plannerNotes,
          confidenceRationale: fallback.confidenceRationale,
          supportFlag: fallback.supportFlag,
          modelSource: fallback.modelSource,
        },
        candidateClassHints: fallback.candidateClassHints,
        decisionSource: fallback.modelSource,
        supportFlag: fallback.supportFlag,
      };
    }

    const confidence = VALID_CONFIDENCE.has(raw.confidence) ? raw.confidence : fallback.confidence;
    const recommendedRouting = VALID_ROUTING.has(raw.recommendedRouting)
      ? raw.recommendedRouting
      : fallback.recommendedRouting;
    const recommendedProtocolClass = VALID_PROTOCOL_CLASSES.has(raw.recommendedProtocolClass)
      ? raw.recommendedProtocolClass
      : fallback.recommendedProtocolClass;
    const candidateClassHints = uniqueStrings(raw.candidateClassHints).filter((value) => VALID_CANDIDATE_TYPES.has(value));

    return {
      ...snapshot,
      confidence,
      recommendedRouting,
      recommendedProtocolClass,
      candidateClassHints: candidateClassHints.length ? candidateClassHints : fallback.candidateClassHints,
      supportFlag: typeof raw.supportFlag === 'boolean' ? raw.supportFlag : fallback.supportFlag,
      decisionSource: 'ai',
      enrichedInterpretation: {
        summary: typeof raw.summary === 'string' && raw.summary.trim() ? raw.summary.trim() : fallback.summary,
        likelyPrimaryFactor: VALID_PRIMARY_FACTORS.has(raw.likelyPrimaryFactor)
          ? raw.likelyPrimaryFactor
          : fallback.likelyPrimaryFactor,
        supportingSignals: uniqueStrings(raw.supportingSignals).length
          ? uniqueStrings(raw.supportingSignals)
          : fallback.supportingSignals,
        contradictions: uniqueStrings(raw.contradictions).length
          ? uniqueStrings(raw.contradictions)
          : fallback.contradictions,
        plannerNotes: uniqueStrings(raw.plannerNotes).length
          ? uniqueStrings(raw.plannerNotes)
          : fallback.plannerNotes,
        confidenceRationale:
          typeof raw.confidenceRationale === 'string' && raw.confidenceRationale.trim()
            ? raw.confidenceRationale.trim()
            : fallback.confidenceRationale,
        supportFlag: typeof raw.supportFlag === 'boolean' ? raw.supportFlag : fallback.supportFlag,
        modelSource: 'ai',
      },
    };
  } catch (error) {
    console.warn('[submit-pulsecheck-checkin] AI snapshot enrichment failed, using fallback interpretation:', error?.message || error);
    return {
      ...snapshot,
      candidateClassHints: fallback.candidateClassHints,
      decisionSource: fallback.modelSource,
      supportFlag: fallback.supportFlag,
      enrichedInterpretation: {
        summary: fallback.summary,
        likelyPrimaryFactor: fallback.likelyPrimaryFactor,
        supportingSignals: fallback.supportingSignals,
        contradictions: fallback.contradictions,
        plannerNotes: fallback.plannerNotes,
        confidenceRationale: fallback.confidenceRationale,
        supportFlag: fallback.supportFlag,
        modelSource: fallback.modelSource,
      },
    };
  }
}

function buildProtocolCandidates({ snapshot, liveProtocolRegistry, responsivenessProfile }) {
  const protocolClass = snapshot.recommendedProtocolClass;
  if (!protocolClass || protocolClass === 'none') {
    return { candidates: [], inventoryGap: null };
  }

  const snapshotTags = deriveProtocolPolicySnapshotTags(snapshot);

  const inventoryGapReasons = new Set();
  const protocols = (Array.isArray(liveProtocolRegistry) ? liveProtocolRegistry : [])
    .filter((entry) => entry.protocolClass === protocolClass)
    .map((protocol) => {
      const triggerTags = uniqueStrings(protocol.triggerTags).map((tag) => normalizeTag(tag));
      const useWindowTags = uniqueStrings(protocol.useWindowTags).map((tag) => normalizeTag(tag));
      const preferredContextTags = uniqueStrings(protocol.preferredContextTags).map((tag) => normalizeTag(tag));
      const avoidWindowTags = uniqueStrings(protocol.avoidWindowTags).map((tag) => normalizeTag(tag));
      const contraindicationTags = uniqueStrings(protocol.contraindicationTags).map((tag) => normalizeTag(tag));

      const matchedTriggerTags = triggerTags.filter((tag) => snapshotTags.has(tag));
      const matchedUseWindowTags = useWindowTags.filter((tag) => snapshotTags.has(tag));
      const matchedPreferredContextTags = preferredContextTags.filter((tag) => snapshotTags.has(tag));
      const matchedAvoidWindowTags = avoidWindowTags.filter((tag) => snapshotTags.has(tag));
      const matchedContraindicationTags = contraindicationTags.filter((tag) => snapshotTags.has(tag));
      const categoryTag = normalizeTag(protocol.category);

      if (!protocol.familyId || !protocol.variantId || !protocol.legacyExerciseId) {
        inventoryGapReasons.add('One or more published protocols are missing required runtime linkage or asset metadata.');
        return null;
      }

      if (matchedAvoidWindowTags.length) {
        return null;
      }

      if (matchedContraindicationTags.length) {
        return null;
      }

      if (triggerTags.length && !matchedTriggerTags.length) {
        inventoryGapReasons.add('Protocol trigger policy excluded candidates because no live runtime trigger matched the current athlete snapshot.');
        return null;
      }

      if (useWindowTags.length && !matchedUseWindowTags.length) {
        inventoryGapReasons.add('Protocol use-window policy excluded candidates because no live runtime use window matched the current athlete snapshot.');
        return null;
      }

      const responsivenessSummary = buildResponsivenessPlannerSummary(protocol, responsivenessProfile);
      const responsivenessScore = buildProtocolResponsivenessScore({
        snapshot,
        runtime: protocol,
        responsivenessProfile,
      });
      const categoryFitScore = categoryTag && snapshotTags.has(categoryTag) ? 12 : 0;
      const contextFitScore = matchedTriggerTags.length * 6 + matchedUseWindowTags.length * 8 + matchedPreferredContextTags.length * 5 + categoryFitScore;
      const contextFitSummary = [
        matchedTriggerTags.length ? `Trigger fit: ${matchedTriggerTags.map((tag) => humanizeRuntimeLabel(tag)).join(', ')}.` : '',
        matchedUseWindowTags.length ? `Window fit: ${matchedUseWindowTags.map((tag) => humanizeRuntimeLabel(tag)).join(', ')}.` : '',
        matchedPreferredContextTags.length ? `Context fit: ${matchedPreferredContextTags.map((tag) => humanizeRuntimeLabel(tag)).join(', ')}.` : '',
        categoryFitScore ? `Athlete preference fit: ${humanizeRuntimeLabel(protocol.category)}.` : '',
      ].filter(Boolean).join(' ');

      return {
        protocol,
        responsivenessSummary,
        responsivenessScore,
        contextFitScore,
        contextFitSummary,
      };
    })
    .filter(Boolean)
    .sort((left, right) => {
      const rightScore = right.responsivenessScore + right.contextFitScore;
      const leftScore = left.responsivenessScore + left.contextFitScore;
      if (rightScore !== leftScore) {
        return rightScore - leftScore;
      }
      return (left.protocol.sortOrder || 999) - (right.protocol.sortOrder || 999);
    });

  if (!protocols.length) {
    return {
      candidates: [],
      inventoryGap: inventoryGapReasons.size
        ? Array.from(inventoryGapReasons).join(' ')
        : `No live ${protocolClass} protocol is currently eligible for the bounded planner inventory.`,
    };
  }

  const candidates = protocols.map(({ protocol, responsivenessSummary, contextFitSummary }) => {
    const summary =
      responsivenessProfile?.variantResponses?.[protocol.variantId]
      || responsivenessProfile?.familyResponses?.[protocol.familyId];

    return {
      id: `${snapshot.athleteId}_${snapshot.sourceDate}_${protocol.id}`,
      type: 'protocol',
      label: protocol.label,
      actionType: 'protocol',
      rationale: [
        protocol.rationale || `Bounded protocol candidate for ${protocolClass} work from the live protocol registry.`,
        contextFitSummary,
        responsivenessSummary,
      ]
        .filter(Boolean)
        .join(' '),
      legacyExerciseId: protocol.legacyExerciseId,
      protocolId: protocol.id,
      protocolFamilyId: protocol.familyId,
      protocolVariantId: protocol.variantId,
      protocolVariantLabel: protocol.variantLabel,
      protocolVariantVersion: protocol.variantVersion,
      protocolPublishedAt: protocol.publishedAt,
      protocolPublishedRevisionId: protocol.publishedRevisionId || derivePublishedRevisionId(protocol.id, protocol.publishedAt),
      protocolLabel: protocol.label,
      protocolClass,
      protocolCategory: protocol.category,
      protocolResponseFamily: protocol.responseFamily,
      protocolDeliveryMode: protocol.deliveryMode,
      responsivenessDirection: summary?.responseDirection,
      responsivenessConfidence: summary?.confidence,
      responsivenessFreshness: summary?.freshness,
      responsivenessSummary,
      responsivenessStateFit: summary?.stateFit,
      durationSeconds: protocol.durationSeconds,
    };
  });

  const excludedProtocolIds = new Set(candidates.map((candidate) => candidate.protocolId));
  const filteredCount = (Array.isArray(liveProtocolRegistry) ? liveProtocolRegistry : [])
    .filter((entry) => entry.protocolClass === protocolClass && !excludedProtocolIds.has(entry.id))
    .length;

  return {
    candidates,
    inventoryGap: filteredCount > 0
      ? `${filteredCount} ${protocolClass} protocol candidate${filteredCount === 1 ? ' was' : 's were'} excluded by launch policy filters for the current state posture.`
      : null,
  };
}

function buildAssignmentCandidateSet({
  athleteId,
  sourceDate,
  snapshot,
  progress,
  liveProtocolRegistry,
  liveSimRegistry,
  responsivenessProfile,
  primaryPlan,
}) {
  const id = buildCandidateSetId(athleteId, sourceDate);
  const candidates = [];
  const constraintReasons = [];
  const inventoryGaps = [];
  const activeProgram = resolveActiveProgramContext({ snapshot, progress });
  const planDrivenCandidate = buildPlanDrivenCandidate({
    athleteId,
    sourceDate,
    primaryPlan,
    liveProtocolRegistry,
    liveSimRegistry,
  });

  if (planDrivenCandidate) {
    candidates.push(planDrivenCandidate);
    constraintReasons.push('The authored training plan supplied the default next-due candidate.');
  }

  const wantsProtocol = (snapshot.candidateClassHints || []).includes('protocol')
    || snapshot.recommendedRouting === 'protocol_only'
    || snapshot.recommendedRouting === 'protocol_then_sim'
    || snapshot.recommendedRouting === 'sim_then_protocol'
    || snapshot.recommendedRouting === 'defer_alternate_path';

  if (wantsProtocol) {
    const protocolResult = buildProtocolCandidates({ snapshot, liveProtocolRegistry, responsivenessProfile });
    if (protocolResult.candidates.length) {
      protocolResult.candidates.forEach((candidate) => {
        if (!candidates.some((existing) => existing.id === candidate.id)) {
          candidates.push(candidate);
        }
      });
    } else if (protocolResult.inventoryGap) {
      inventoryGaps.push(protocolResult.inventoryGap);
    }
  }

  const publishedSimResolution = resolvePublishedSimCandidate(activeProgram, liveSimRegistry);

  if (publishedSimResolution.simModule) {
    const simModule = publishedSimResolution.simModule;
    const isTrial = activeProgram.sessionType === 'reassessment';
    const simCandidate = {
      id: `${athleteId}_${sourceDate}_${simModule.simSpecId || simModule.id}`,
      type: isTrial ? 'trial' : 'sim',
      label: simModule.name || humanizeRuntimeLabel(
        simModule.simSpecId || simModule.id || activeProgram.sessionType || 'sim'
      ),
      familyLabel:
        simModule?.variantSource?.family
        || titleizeRuntimeLabel(simModule.simSpecId || activeProgram.recommendedSimId || simModule.id),
      variantLabel:
        simModule?.variantSource?.variantName
        || simModule.name
        || titleizeRuntimeLabel(simModule.simSpecId || simModule.id || activeProgram.sessionType || 'sim'),
      actionType:
        snapshot.recommendedRouting === 'protocol_then_sim'
        || snapshot.recommendedRouting === 'defer_alternate_path'
        || snapshot.overallReadiness === 'yellow'
          ? 'lighter_sim'
          : 'sim',
      rationale: 'Bounded simulation candidate from the active program recommendation and published sim inventory.',
      simSpecId: simModule.simSpecId || activeProgram.recommendedSimId,
      legacyExerciseId: simModule.id || activeProgram.recommendedLegacyExerciseId,
      sessionType: activeProgram.sessionType,
      durationMode: activeProgram.durationMode,
      durationSeconds: activeProgram.durationSeconds,
    };

    if (!candidates.some((candidate) => candidate.id === simCandidate.id)) {
      candidates.push(simCandidate);
    }
  } else if (publishedSimResolution.inventoryGap) {
    inventoryGaps.push(publishedSimResolution.inventoryGap);
  } else {
    constraintReasons.push('No active program simulation candidate is currently available.');
  }

  if (snapshot.recommendedRouting === 'trial_only' && !candidates.some((candidate) => candidate.type === 'trial')) {
    inventoryGaps.push('The state recommends a trial-style day, but the active program did not resolve a trial candidate.');
  }

  const candidateClassHints = uniqueStrings([
    ...(snapshot.candidateClassHints || []),
    ...candidates.map((candidate) => candidate.type),
  ]).filter((value) => VALID_CANDIDATE_TYPES.has(value));

  return {
    id,
    athleteId,
    sourceDate,
    sourceStateSnapshotId: snapshot.id,
    trainingPlanId: primaryPlan?.id || null,
    trainingPlanStepId: planDrivenCandidate?.trainingPlanStepId || null,
    trainingPlanStepIndex: planDrivenCandidate?.trainingPlanStepIndex || null,
    planDrivenCandidateId: planDrivenCandidate?.id || null,
    candidates,
    candidateIds: candidates.map((candidate) => candidate.id),
    candidateClassHints,
    constraintReasons,
    inventoryGaps,
    plannerEligible: candidates.length > 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

function buildFallbackPlannerDecision({ snapshot, candidateSet }) {
  const planCandidate = candidateSet.candidates.find((candidate) => candidate.id === candidateSet.planDrivenCandidateId);
  const protocolCandidate = candidateSet.candidates.find((candidate) => candidate.type === 'protocol');
  const simCandidate = candidateSet.candidates.find((candidate) => candidate.type === 'sim' || candidate.type === 'trial');

  if (planCandidate) {
    return {
      decisionSource: 'fallback_rules',
      selectedCandidateId: planCandidate.id,
      selectedCandidateType: planCandidate.type,
      actionType: planCandidate.actionType,
      confidence: snapshot.confidence,
      rationaleSummary: `Fallback planner honored the authored training plan step: ${planCandidate.label}.`,
      supportFlag: Boolean(snapshot.supportFlag),
    };
  }

  if ((snapshot.overallReadiness === 'red' || snapshot.recommendedRouting === 'protocol_only') && protocolCandidate) {
    return {
      decisionSource: 'fallback_rules',
      selectedCandidateId: protocolCandidate.id,
      selectedCandidateType: protocolCandidate.type,
      actionType: protocolCandidate.actionType,
      confidence: snapshot.confidence,
      rationaleSummary: `Fallback planner selected ${protocolCandidate.label} because the enriched snapshot favors protocol-first work today.`,
      supportFlag: Boolean(snapshot.supportFlag),
    };
  }

  if (simCandidate) {
    return {
      decisionSource: 'fallback_rules',
      selectedCandidateId: simCandidate.id,
      selectedCandidateType: simCandidate.type,
      actionType: simCandidate.actionType,
      confidence: snapshot.confidence,
      rationaleSummary: `Fallback planner selected ${simCandidate.label} from the bounded candidate set.`,
      supportFlag: Boolean(snapshot.supportFlag),
    };
  }

  if (protocolCandidate) {
    return {
      decisionSource: 'fallback_rules',
      selectedCandidateId: protocolCandidate.id,
      selectedCandidateType: protocolCandidate.type,
      actionType: protocolCandidate.actionType,
      confidence: 'low',
      rationaleSummary: `Fallback planner selected ${protocolCandidate.label} because no simulation candidate was available.`,
      supportFlag: true,
    };
  }

  return {
    decisionSource: 'fallback_rules',
    actionType: 'defer',
    confidence: 'low',
    rationaleSummary: 'No valid bounded candidate was available, so Nora deferred today’s main task.',
    supportFlag: true,
  };
}

async function planAssignmentWithAI({ snapshot, candidateSet, progress, responsivenessProfile }) {
  const fallback = buildFallbackPlannerDecision({ snapshot, candidateSet });
  if (!candidateSet.plannerEligible) {
    return fallback;
  }

  try {
    const raw = await callOpenAiJson({
      systemPrompt: [
        'You are Nora’s bounded assignment planner.',
        'Return only valid JSON.',
        'You must choose only from the provided candidate ids or defer.',
        'Never invent a new exercise, protocol, or candidate id.',
        'If a primary training-plan candidate is present, treat it as the default unless the state evidence clearly justifies overriding it.',
        'Treat protocol responsiveness as a ranking input inside the current state posture, not as permission to ignore a strong current-state signal.',
        'Allowed actionType values: sim, lighter_sim, protocol, defer.',
        'Allowed confidence values: high, medium, low.',
        'JSON shape: {"selectedCandidateId":"","selectedCandidateType":"","actionType":"","confidence":"","rationaleSummary":"","supportFlag":false}',
      ].join(' '),
      userPayload: {
        stateSnapshot: snapshot,
        candidateSet,
        activeProgram: resolveActiveProgramContext({ snapshot, progress }),
        activeTrainingPlan: candidateSet?.trainingPlanId
          ? {
              trainingPlanId: candidateSet.trainingPlanId,
              trainingPlanStepId: candidateSet.trainingPlanStepId || null,
              trainingPlanStepIndex: candidateSet.trainingPlanStepIndex || null,
              preferredCandidateId: candidateSet.planDrivenCandidateId || null,
            }
          : null,
        protocolResponsivenessProfile: responsivenessProfile || null,
      },
    });

    if (!raw || typeof raw !== 'object') {
      return fallback;
    }

    return {
      decisionSource: 'ai',
      selectedCandidateId: typeof raw.selectedCandidateId === 'string' ? raw.selectedCandidateId : undefined,
      selectedCandidateType: VALID_CANDIDATE_TYPES.has(raw.selectedCandidateType) ? raw.selectedCandidateType : undefined,
      actionType: ['sim', 'lighter_sim', 'protocol', 'defer'].includes(raw.actionType) ? raw.actionType : fallback.actionType,
      confidence: VALID_CONFIDENCE.has(raw.confidence) ? raw.confidence : fallback.confidence,
      rationaleSummary:
        typeof raw.rationaleSummary === 'string' && raw.rationaleSummary.trim()
          ? raw.rationaleSummary.trim()
          : fallback.rationaleSummary,
      supportFlag: typeof raw.supportFlag === 'boolean' ? raw.supportFlag : fallback.supportFlag,
    };
  } catch (error) {
    console.warn('[submit-pulsecheck-checkin] AI assignment planner failed, using fallback decision:', error?.message || error);
    return fallback;
  }
}

function validatePlannerDecision({ decision, candidateSet, snapshot }) {
  if (decision.actionType === 'defer' || !decision.selectedCandidateId) {
    if ((candidateSet?.candidates || []).length > 0) {
      const fallback = buildFallbackPlannerDecision({ snapshot, candidateSet });
      if (fallback.actionType !== 'defer' && fallback.selectedCandidateId) {
        console.info('[submit-pulsecheck-checkin] Planner defer overridden by bounded fallback candidate', {
          athleteId: snapshot?.athleteId || null,
          sourceDate: snapshot?.sourceDate || null,
          candidateCount: candidateSet.candidates.length,
          plannerActionType: decision.actionType || null,
          plannerSelectedCandidateId: decision.selectedCandidateId || null,
          fallbackActionType: fallback.actionType || null,
          fallbackSelectedCandidateId: fallback.selectedCandidateId || null,
          fallbackSelectedCandidateType: fallback.selectedCandidateType || null,
        });
        return validatePlannerDecision({ decision: fallback, candidateSet, snapshot });
      }
    }

    return {
      decision: {
        ...decision,
        selectedCandidateId: undefined,
        selectedCandidateType: undefined,
        actionType: 'defer',
      },
      selectedCandidate: null,
    };
  }

  const selectedCandidate = candidateSet.candidates.find((candidate) => candidate.id === decision.selectedCandidateId);
  if (!selectedCandidate) {
    const fallback = buildFallbackPlannerDecision({ snapshot, candidateSet });
    return validatePlannerDecision({ decision: fallback, candidateSet, snapshot });
  }

  return {
    decision: {
      decisionSource: decision.decisionSource || 'fallback_rules',
      selectedCandidateId: selectedCandidate.id,
      selectedCandidateType: selectedCandidate.type,
      actionType: selectedCandidate.actionType,
      confidence: VALID_CONFIDENCE.has(decision.confidence) ? decision.confidence : snapshot.confidence,
      rationaleSummary: decision.rationaleSummary || `Selected ${selectedCandidate.label} from the bounded candidate set.`,
      supportFlag: Boolean(decision.supportFlag),
    },
    selectedCandidate,
  };
}

function buildPlannerAudit({ snapshot, candidateSet, plannerOutput, selectedCandidate }) {
  const rankedCandidates = (candidateSet?.candidates || []).slice(0, 5).map((candidate) => ({
    candidateId: candidate.id,
    label: candidate.label,
    type: candidate.type,
    actionType: candidate.actionType,
    rationale: candidate.rationale,
    selected: candidate.id === selectedCandidate?.id,
    protocolId: candidate.protocolId,
    protocolFamilyId: candidate.protocolFamilyId,
    protocolVariantId: candidate.protocolVariantId,
    protocolVariantLabel: candidate.protocolVariantLabel,
    protocolVariantVersion: candidate.protocolVariantVersion,
    protocolPublishedAt: candidate.protocolPublishedAt,
    protocolPublishedRevisionId: candidate.protocolPublishedRevisionId,
    responsivenessDirection: candidate.responsivenessDirection,
    responsivenessConfidence: candidate.responsivenessConfidence,
    responsivenessFreshness: candidate.responsivenessFreshness,
    responsivenessSummary: candidate.responsivenessSummary,
  }));

  return {
    generatedAt: Date.now(),
    stateConfidence: snapshot?.confidence || plannerOutput?.confidence || 'low',
    responsivenessApplied: rankedCandidates.some((candidate) => Boolean(candidate.responsivenessDirection || candidate.responsivenessSummary)),
    selectedCandidateId: selectedCandidate?.id,
    rankedCandidates,
  };
}

function toReadinessBand(readinessScore) {
  if (typeof readinessScore !== 'number') return undefined;
  if (readinessScore < 45) return 'low';
  if (readinessScore < 65) return 'medium';
  return 'high';
}

function resolveSnapshotDrivenActionType({ snapshot, hasResolvedExercise, fallbackActionType }) {
  if (!snapshot) return fallbackActionType;

  switch (snapshot.recommendedRouting) {
    case 'defer_alternate_path':
      return 'defer';
    case 'protocol_only':
    case 'protocol_then_sim':
      return hasResolvedExercise ? 'lighter_sim' : 'defer';
    case 'sim_only':
    case 'sim_then_protocol':
    case 'trial_only':
    default:
      return hasResolvedExercise ? 'sim' : 'defer';
  }
}

function buildSnapshotDrivenRationale({ snapshot, actionType, fallbackRationale }) {
  if (!snapshot) return fallbackRationale || '';

  const confidenceLabel = humanizeRuntimeLabel(snapshot.confidence) || 'current';
  const routingLabel = humanizeRuntimeLabel(snapshot.recommendedRouting) || 'sim only';
  const readinessLabel = snapshot.overallReadiness ? `${snapshot.overallReadiness} readiness` : 'current readiness';
  const protocolLabel =
    snapshot.recommendedProtocolClass && snapshot.recommendedProtocolClass !== 'none'
      ? `${humanizeRuntimeLabel(snapshot.recommendedProtocolClass)} protocol`
      : '';

  let runtimeLead = '';
  switch (actionType) {
    case 'defer':
      runtimeLead = `Nora paused the main task because today's state snapshot reads ${readinessLabel} with ${confidenceLabel} confidence.`;
      break;
    case 'lighter_sim':
      runtimeLead = protocolLabel
        ? `Nora is front-loading ${protocolLabel} work because today's state snapshot reads ${readinessLabel} and routes ${routingLabel}.`
        : `Nora softened today's entry because the state snapshot reads ${readinessLabel} and routes ${routingLabel}.`;
      break;
    case 'sim':
    default:
      runtimeLead = `Nora kept today's task live because the state snapshot reads ${readinessLabel} and routes ${routingLabel}.`;
      break;
  }

  return fallbackRationale ? `${runtimeLead} ${fallbackRationale}` : runtimeLead;
}

async function verifyAuth(event, adminApp) {
  const authHeader = event.headers?.authorization || event.headers?.Authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Missing Authorization header');
  }

  const idToken = authHeader.slice('Bearer '.length);
  return admin.auth(adminApp).verifyIdToken(idToken);
}

async function loadOrInitializeProgress(db, athleteId) {
  const progressRef = db.collection(PROGRESS_COLLECTION).doc(athleteId);
  const progressSnap = await progressRef.get();
  if (progressSnap.exists) {
    return progressSnap.data() || {};
  }

  const initialProgress = profileSnapshotRuntime.buildInitialAthleteProgress(athleteId, Date.now());
  await progressRef.set(initialProgress, { merge: true });
  return initialProgress;
}

async function syncTaxonomyProfile(db, athleteId, currentProgress) {
  const [checkInsSnap, simSessionsSnap] = await Promise.all([
    db.collection(CHECKINS_ROOT).doc(athleteId).collection('check-ins').orderBy('createdAt', 'desc').limit(20).get(),
    db.collection('sim-sessions').doc(athleteId).collection('sessions').orderBy('createdAt', 'desc').limit(30).get(),
  ]);

  const checkIns = checkInsSnap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
  const simSessions = simSessionsSnap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));

  const taxonomyProfile = profileSnapshotRuntime.deriveTaxonomyProfile({
    baselineAssessment: currentProgress?.baselineAssessment,
    checkIns,
    simSessions,
  });

  const latestCheckIn = checkIns[0];
  const activeProgram = profileSnapshotRuntime.prescribeNextSession({
    profile: taxonomyProfile,
    checkInState: latestCheckIn?.taxonomyState,
  });

  const updates = {
    taxonomyProfile,
    activeProgram,
    lastProfileSyncAt: Date.now(),
    profileVersion: profileSnapshotRuntime.PROFILE_VERSION,
    updatedAt: Date.now(),
  };

  await db.collection(PROGRESS_COLLECTION).doc(athleteId).set(updates, { merge: true });
  return { ...currentProgress, ...updates };
}

async function getSnapshotById(db, id) {
  const snap = await db.collection(SNAPSHOTS_COLLECTION).doc(id).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...snap.data() };
}

async function upsertStateSnapshot({ db, athleteId, checkIn, progress, recentAssignmentHistoryContext = null }) {
  const snapshotId = `${athleteId}_${checkIn.date}`;
  const existing = await getSnapshotById(db, snapshotId);
  const readinessScore = normalizeReadinessScore({ checkIn, progress });
  const stateDimensions = deriveStateDimensions({ checkIn, progress });
  const overallReadiness = deriveOverallReadiness({ readinessScore, dimensions: stateDimensions });
  const contradictionFlags = detectContradictionFlags({ checkIn, normalizedScore: readinessScore, dimensions: stateDimensions });
  const confidence = deriveConfidence({ checkIn, progress, contradictionFlags });
  const rawSignalSummary = buildRawSignalSummary({
    checkIn,
    progress: {
      ...progress,
      recentAssignmentHistoryContext,
    },
    normalizedScore: readinessScore,
    contradictionFlags,
  });
  const now = Date.now();

  const nextSnapshot = {
    id: snapshotId,
    athleteId,
    sourceDate: checkIn.date,
    sourceCheckInId: checkIn.id,
    rawSignalSummary,
    stateDimensions,
    overallReadiness,
    confidence,
    freshness: 'current',
    sourcesUsed: [
      'explicit_self_report',
      ...(checkIn.taxonomyState ? ['taxonomy_checkin_state'] : []),
      ...(progress?.taxonomyProfile ? ['taxonomy_profile'] : []),
      ...(progress?.activeProgram ? ['active_program_context'] : []),
    ],
    sourceEventIds: Array.from(new Set([...(existing?.sourceEventIds || []), checkIn.id])),
    contextTags: deriveContextTags(progress, recentAssignmentHistoryContext),
    recommendedRouting: deriveRouting({
      readiness: overallReadiness,
      readinessScore,
      dimensions: stateDimensions,
      confidence,
      contradictionFlags,
      progress,
      recentAssignmentHistory: recentAssignmentHistoryContext,
    }),
    recommendedProtocolClass: deriveProtocolClass({ dimensions: stateDimensions, progress }),
    candidateClassHints: [],
    readinessScore,
    supportFlag: false,
    decisionSource: 'fallback_rules',
    executionLink: existing?.executionLink,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };

  await db.collection(SNAPSHOTS_COLLECTION).doc(snapshotId).set(stripUndefinedDeep(nextSnapshot), { merge: true });
  return nextSnapshot;
}

async function resolveActiveAthleteMembership(db, athleteId) {
  const membershipSnap = await db
    .collection(TEAM_MEMBERSHIPS_COLLECTION)
    .where('userId', '==', athleteId)
    .where('role', '==', 'athlete')
    .get();

  const memberships = membershipSnap.docs
    .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
    .sort((left, right) => toTimestampMillis(right.grantedAt) - toTimestampMillis(left.grantedAt));

  return memberships[0] || null;
}

function rolePriority(role) {
  switch (role) {
    case 'coach':
      return 0;
    case 'team-admin':
      return 1;
    case 'performance-staff':
      return 2;
    case 'support-staff':
      return 3;
    default:
      return 9;
  }
}

async function resolveCoachId(db, athleteId, athleteMembership, existingCoachId) {
  if (existingCoachId && existingCoachId !== athleteId) {
    return existingCoachId;
  }

  if (athleteMembership?.legacyCoachId && athleteMembership.legacyCoachId !== athleteId) {
    return athleteMembership.legacyCoachId;
  }

  if (!athleteMembership?.teamId) {
    return undefined;
  }

  const teamMembershipSnap = await db
    .collection(TEAM_MEMBERSHIPS_COLLECTION)
    .where('teamId', '==', athleteMembership.teamId)
    .get();

  const candidate = teamMembershipSnap.docs
    .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
    .filter((membership) => membership.userId !== athleteId && membership.role !== 'athlete' && membership.role !== 'clinician')
    .sort((left, right) => {
      const byRole = rolePriority(left.role) - rolePriority(right.role);
      if (byRole !== 0) return byRole;
      return toTimestampMillis(right.grantedAt) - toTimestampMillis(left.grantedAt);
    })[0];

  return candidate?.userId;
}

async function attachExecutionLink(db, snapshotId, assignmentId) {
  if (!snapshotId || !assignmentId) return;
  await db.collection(SNAPSHOTS_COLLECTION).doc(snapshotId).set({
    executionLink: assignmentId,
    updatedAt: Date.now(),
  }, { merge: true });
}

function assignmentLineageChanged(existing, nextAssignment) {
  if (!existing) return true;

  const comparableKeys = [
    'actionType',
    'executionPattern',
    'chosenCandidateId',
    'chosenCandidateType',
    'simSpecId',
    'simFamilyLabel',
    'simVariantLabel',
    'legacyExerciseId',
    'protocolId',
    'protocolFamilyId',
    'protocolVariantId',
    'protocolVariantLabel',
    'protocolPublishedRevisionId',
    'protocolLabel',
    'protocolClass',
    'protocolCategory',
    'protocolResponseFamily',
    'protocolDeliveryMode',
    'sessionType',
    'durationMode',
    'durationSeconds',
    'rationale',
    'plannerSummary',
    'plannerConfidence',
    'decisionSource',
    'readinessScore',
    'readinessBand',
    'supportFlag',
    'sourceCheckInId',
    'sourceStateSnapshotId',
    'sourceCandidateSetId',
  ];

  return comparableKeys.some((key) => {
    const left = existing[key];
    const right = nextAssignment[key];
    if (typeof left === 'object' || typeof right === 'object') {
      return JSON.stringify(left || null) !== JSON.stringify(right || null);
    }
    return left !== right;
  });
}

async function archiveAssignmentRevision({
  db,
  assignmentRef,
  existing,
  nextRevision,
  now,
}) {
  if (!existing) return;

  const currentRevision = typeof existing.revision === 'number' ? existing.revision : 1;
  const revisionId = `r${String(currentRevision).padStart(4, '0')}`;
  await assignmentRef.collection(ASSIGNMENT_REVISIONS_SUBCOLLECTION).doc(revisionId).set(stripUndefinedDeep({
    ...existing,
    lineageId: existing.lineageId || assignmentRef.id,
    revision: currentRevision,
    supersededAt: now,
    supersededByRevision: nextRevision,
    archivedAt: now,
  }), { merge: true });
}

function summarizeAssignmentForSystemEvent(assignment) {
  if (!assignment) return null;

  return stripUndefinedDeep({
    id: assignment.id,
    status: assignment.status || null,
    actionType: assignment.actionType || null,
    chosenCandidateId: assignment.chosenCandidateId || null,
    sourceStateSnapshotId: assignment.sourceStateSnapshotId || null,
    rationale: assignment.rationale || null,
    plannerSummary: assignment.plannerSummary || null,
    trainingPlanId: assignment.trainingPlanId || null,
    trainingPlanStepId: assignment.trainingPlanStepId || null,
    trainingPlanStepIndex: typeof assignment.trainingPlanStepIndex === 'number' ? assignment.trainingPlanStepIndex : null,
    executionPattern: assignment.executionPattern || null,
    phaseProgress: assignment.phaseProgress || null,
    materializedBy: assignment.materializedBy || null,
    updatedAt: assignment.updatedAt || null,
  });
}

async function recordDailyTaskMaterializationEvents({
  db,
  assignment,
  existing,
  lineageChanged,
  eventAt,
}) {
  if (!assignment || (!lineageChanged && existing)) {
    return null;
  }

  const batch = db.batch();
  const materializedEventRef = db.collection(ASSIGNMENT_EVENTS_COLLECTION).doc();
  const materializedEvent = stripUndefinedDeep({
    assignmentId: assignment.id,
    athleteId: assignment.athleteId || '',
    teamId: assignment.teamId || '',
    sourceDate: assignment.sourceDate || '',
    eventType: 'daily_task_materialized',
    actorType: 'system',
    actorUserId: 'nora_runtime',
    eventAt,
    trainingPlanId: assignment.trainingPlanId || null,
    trainingPlanStepId: assignment.trainingPlanStepId || null,
    trainingPlanStepIndex: typeof assignment.trainingPlanStepIndex === 'number' ? assignment.trainingPlanStepIndex : null,
    executionPattern: assignment.executionPattern || null,
    phaseProgress: assignment.phaseProgress || null,
    executionLock: assignment.executionLock || null,
    completionSummary: assignment.completionSummary || null,
    metadata: {
      materializedBy: assignment.materializedBy || 'nora_runtime',
      lineageId: assignment.lineageId || assignment.id,
      revision: assignment.revision || 1,
      previousRevision: assignment.previousRevision || null,
      sourceCheckInId: assignment.sourceCheckInId || null,
      sourceStateSnapshotId: assignment.sourceStateSnapshotId || null,
      sourceCandidateSetId: assignment.sourceCandidateSetId || null,
      isPrimaryForDate: assignment.isPrimaryForDate !== false,
      isPlanOverride: Boolean(assignment.isPlanOverride),
      overrideMetadata: assignment.overrideMetadata || null,
      assignmentSummary: summarizeAssignmentForSystemEvent(assignment),
    },
    createdAt: eventAt,
  });
  batch.set(materializedEventRef, materializedEvent);

  let supersededEventRef = null;
  if (existing && lineageChanged) {
    supersededEventRef = db.collection(ASSIGNMENT_EVENTS_COLLECTION).doc();
    const supersededEvent = stripUndefinedDeep({
      assignmentId: assignment.id,
      athleteId: assignment.athleteId || '',
      teamId: assignment.teamId || '',
      sourceDate: assignment.sourceDate || '',
      eventType: 'daily_task_superseded',
      actorType: 'system',
      actorUserId: 'nora_runtime',
      eventAt,
      trainingPlanId: existing.trainingPlanId || assignment.trainingPlanId || null,
      trainingPlanStepId: existing.trainingPlanStepId || null,
      trainingPlanStepIndex: typeof existing.trainingPlanStepIndex === 'number' ? existing.trainingPlanStepIndex : null,
      executionPattern: existing.executionPattern || null,
      phaseProgress: existing.phaseProgress || null,
      executionLock: existing.executionLock || null,
      completionSummary: existing.completionSummary || null,
      metadata: {
        lineageId: existing.lineageId || assignment.lineageId || assignment.id,
        previousRevision: existing.revision || null,
        nextRevision: assignment.revision || null,
        supersededByDailyTaskId: assignment.id,
        supersededReason:
          assignment.overrideMetadata?.overrideReason
          || assignment.rationale
          || 'Same-day state rematerialization superseded the prior task state.',
        previousAssignmentSummary: summarizeAssignmentForSystemEvent(existing),
        nextAssignmentSummary: summarizeAssignmentForSystemEvent(assignment),
      },
      createdAt: eventAt,
    });
    batch.set(supersededEventRef, supersededEvent);
  }

  await batch.commit();

  return {
    materializedEventId: materializedEventRef.id,
    supersededEventId: supersededEventRef?.id || null,
  };
}

async function orchestratePostCheckIn({
  db,
  athleteId,
  sourceCheckInId,
  sourceStateSnapshotId,
  sourceCandidateSetId,
  sourceDate,
  timezone,
  progress,
  candidateSet,
  plannerDecision,
  liveProtocolRegistry,
  liveSimRegistry,
  primaryPlan,
}) {
  const snapshot =
    (sourceStateSnapshotId ? await getSnapshotById(db, sourceStateSnapshotId) : null) ||
    await getSnapshotById(db, `${athleteId}_${sourceDate}`);

  if (!snapshot) {
    console.warn('[submit-pulsecheck-checkin] orchestratePostCheckIn skipped because no snapshot was found', {
      athleteId,
      sourceDate,
      sourceStateSnapshotId,
    });
    return null;
  }

  const athleteMembership = await resolveActiveAthleteMembership(db, athleteId);
  const coachId = await resolveCoachId(db, athleteId, athleteMembership, progress.coachId);
  if (coachId) {
    await db.collection(PROGRESS_COLLECTION).doc(athleteId).set({
      coachId,
      updatedAt: Date.now(),
    }, { merge: true });
  }

  const activeProgram = resolveActiveProgramContext({ snapshot, progress }) || null;
  if (!activeProgram) {
    console.warn('[submit-pulsecheck-checkin] No activeProgram was available during assignment orchestration; continuing with bounded candidates and fallback rules only.', {
      athleteId,
      sourceDate,
      recommendedRouting: snapshot.recommendedRouting,
      candidateCount: candidateSet?.candidates?.length || 0,
    });
  }

  const readinessScore = snapshot?.readinessScore ?? progress?.taxonomyProfile?.modifierScores?.readiness;
  const assignmentId = `${athleteId}_${sourceDate}`;
  const assignmentRef = db.collection(DAILY_ASSIGNMENTS_COLLECTION).doc(assignmentId);
  const existingSnap = await assignmentRef.get();
  const existing = existingSnap.exists ? { id: existingSnap.id, ...existingSnap.data() } : null;

  if (existing && !isAssignmentMutableForAutomaticRematerialization(existing)) {
    await attachExecutionLink(db, sourceStateSnapshotId, assignmentId);
    return existing;
  }

  const publishedSimResolution = resolvePublishedSimCandidate(activeProgram, liveSimRegistry);
  const hasPublishedSimCandidate = Boolean(publishedSimResolution.simModule);
  const fallbackActionType =
    hasPublishedSimCandidate
      ? (activeProgram.sessionType === 'recovery_rep' || activeProgram.sessionType === 'probe' ? 'lighter_sim' : 'sim')
      : undefined;
  const validatedPlannerDecision = validatePlannerDecision({
    decision: plannerDecision || buildFallbackPlannerDecision({ snapshot, candidateSet: candidateSet || buildAssignmentCandidateSet({ athleteId, sourceDate, snapshot, progress, liveProtocolRegistry, liveSimRegistry, responsivenessProfile: null, primaryPlan }) }),
    candidateSet: candidateSet || buildAssignmentCandidateSet({ athleteId, sourceDate, snapshot, progress, liveProtocolRegistry, liveSimRegistry, responsivenessProfile: null, primaryPlan }),
    snapshot,
  });
  const selectedCandidate = validatedPlannerDecision.selectedCandidate;
  const plannerOutput = validatedPlannerDecision.decision;
  const actionType =
    plannerOutput.actionType
    || (selectedCandidate?.actionType
      ? selectedCandidate.actionType
      : resolveSnapshotDrivenActionType({
          snapshot,
          hasResolvedExercise: Boolean(
            selectedCandidate?.simSpecId
            || selectedCandidate?.legacyExerciseId
            || hasPublishedSimCandidate
          ),
          fallbackActionType,
        }));

  console.info('[submit-pulsecheck-checkin] Assignment decision resolved', {
    athleteId,
    sourceDate,
    hasActiveProgram: Boolean(activeProgram),
    candidateCount: candidateSet?.candidates?.length || 0,
    selectedCandidateId: selectedCandidate?.id || null,
    selectedCandidateType: selectedCandidate?.type || null,
    actionType,
    plannerDecisionSource: plannerOutput.decisionSource || snapshot?.decisionSource || 'fallback_rules',
  });

  const now = Date.now();
  const executionPattern = selectedCandidate?.executionPattern
    || (snapshot?.recommendedRouting === 'protocol_then_sim' || snapshot?.recommendedRouting === 'sim_then_protocol'
      ? snapshot.recommendedRouting
      : 'single');
  const baselineRevision = typeof existing?.revision === 'number' ? existing.revision : 1;
  const materializationTimezone = existing?.timezone || timezone || 'UTC';
  const draftAssignment = {
    id: assignmentId,
    lineageId: existing?.lineageId || assignmentId,
    revision: baselineRevision,
    athleteId,
    teamId: athleteMembership?.teamId,
    teamMembershipId: athleteMembership?.id,
    coachId,
    sourceCheckInId,
    sourceStateSnapshotId,
    sourceCandidateSetId,
    sourceDate,
    timezone: materializationTimezone,
    sourceDateMode: 'athlete_local_day',
    assignedBy: 'nora',
    materializedAt: existing?.materializedAt || now,
    materializedBy: existing?.materializedBy || 'nora_runtime',
    isPrimaryForDate: true,
    status: actionType === 'defer' ? 'deferred' : (existing?.status || 'assigned'),
    actionType,
    executionPattern,
    chosenCandidateId: selectedCandidate?.id,
    chosenCandidateType: selectedCandidate?.type,
    simSpecId: selectedCandidate?.simSpecId,
    legacyExerciseId: selectedCandidate?.legacyExerciseId,
    simFamilyLabel: selectedCandidate?.familyLabel || titleizeRuntimeLabel(selectedCandidate?.simSpecId || selectedCandidate?.legacyExerciseId || null) || null,
    simVariantLabel: selectedCandidate?.variantLabel || selectedCandidate?.label || null,
    protocolId: selectedCandidate?.protocolId,
    protocolFamilyId: selectedCandidate?.protocolFamilyId,
    protocolVariantId: selectedCandidate?.protocolVariantId,
    protocolVariantLabel: selectedCandidate?.protocolVariantLabel,
    protocolVariantVersion: selectedCandidate?.protocolVariantVersion,
    protocolPublishedAt: selectedCandidate?.protocolPublishedAt,
    protocolPublishedRevisionId: selectedCandidate?.protocolPublishedRevisionId,
    protocolLabel: selectedCandidate?.protocolLabel,
    protocolClass: selectedCandidate?.protocolClass,
    protocolCategory: selectedCandidate?.protocolCategory,
    protocolResponseFamily: selectedCandidate?.protocolResponseFamily,
    protocolDeliveryMode: selectedCandidate?.protocolDeliveryMode,
    sessionType: selectedCandidate?.sessionType || activeProgram?.sessionType,
    durationMode: selectedCandidate?.durationMode || activeProgram?.durationMode,
    durationSeconds: selectedCandidate?.durationSeconds || activeProgram?.durationSeconds,
    rationale: plannerOutput.rationaleSummary || buildSnapshotDrivenRationale({
      snapshot,
      actionType,
      fallbackRationale: activeProgram?.rationale,
    }),
    plannerSummary: plannerOutput.rationaleSummary,
    plannerAudit: buildPlannerAudit({
      snapshot,
      candidateSet,
      plannerOutput,
      selectedCandidate,
    }),
    plannerConfidence: plannerOutput.confidence,
    decisionSource: plannerOutput.decisionSource || snapshot?.decisionSource || 'fallback_rules',
    readinessScore,
    readinessBand: toReadinessBand(readinessScore),
    escalationTier: existing?.escalationTier ?? 0,
    supportFlag: plannerOutput.supportFlag ?? existing?.supportFlag ?? snapshot?.supportFlag ?? false,
    programSnapshot: activeProgram || undefined,
    phaseProgress:
      executionPattern === 'single'
        ? undefined
        : {
            currentPhaseIndex: 1,
            totalPhases: 2,
            currentPhaseLabel: executionPattern === 'protocol_then_sim' ? 'Protocol' : 'Sim',
            phaseLabels: executionPattern === 'protocol_then_sim' ? ['Protocol', 'Sim'] : ['Sim', 'Protocol'],
          },
    coachNotifiedAt: existing?.coachNotifiedAt,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };

  const lineageChanged = assignmentLineageChanged(existing, draftAssignment);
  const planMetadata = await resolvePlanBackedAssignment({
    db,
    athleteId,
    coachId,
    sourceDate,
    timezone: materializationTimezone,
    sourceStateSnapshotId,
    assignmentId,
    existingAssignment: existing,
    progress,
    snapshot,
    activeProgram,
    selectedCandidate,
    actionType,
    executionPattern,
    lineageChanged,
    primaryPlan,
    now,
  });
  const nextRevision = existing ? (lineageChanged ? baselineRevision + 1 : baselineRevision) : 1;
  if (existing && lineageChanged) {
    await archiveAssignmentRevision({
      db,
      assignmentRef,
      existing,
      nextRevision,
      now,
    });
  }

  const assignment = {
    ...draftAssignment,
    ...(planMetadata || {}),
    revision: nextRevision,
    previousRevision: existing && lineageChanged ? baselineRevision : existing?.previousRevision,
    status:
      draftAssignment.actionType === 'defer'
        ? 'deferred'
        : existing && lineageChanged
          ? 'assigned'
          : draftAssignment.status,
    supersededAt: undefined,
    supersededByRevision: undefined,
  };

  await assignmentRef.set(stripUndefinedDeep(assignment), { merge: true });
  await recordDailyTaskMaterializationEvents({
    db,
    assignment,
    existing,
    lineageChanged,
    eventAt: now,
  });
  await attachExecutionLink(db, sourceStateSnapshotId, assignmentId);
  console.info('[submit-pulsecheck-checkin] Daily assignment persisted', {
    assignmentId,
    athleteId,
    sourceDate,
    status: assignment.status,
    actionType: assignment.actionType,
    simSpecId: assignment.simSpecId || null,
    protocolId: assignment.protocolId || null,
    hasActiveProgram: Boolean(activeProgram),
  });
  return assignment;
}

async function rematerializeAssignmentFromSnapshot({
  db,
  athleteId,
  sourceCheckInId,
  sourceStateSnapshotId,
  sourceDate,
  timezone,
  progress,
}) {
  const snapshot =
    (sourceStateSnapshotId ? await getSnapshotById(db, sourceStateSnapshotId) : null) ||
    await getSnapshotById(db, `${athleteId}_${sourceDate}`);

  if (!snapshot) {
    return {
      stateSnapshot: null,
      candidateSet: null,
      plannerDecision: null,
      dailyAssignment: null,
    };
  }

  const liveProtocolRegistry = await listLiveProtocolRegistry(db);
  const liveSimRegistry = await listLivePublishedSimModules(db);
  const responsivenessProfile = await getOrRefreshProtocolResponsivenessProfile({
    db,
    athleteId,
    protocolRegistry: liveProtocolRegistry,
  });
  const ensuredPlan = await ensurePrimaryTrainingPlan({
    db,
    athleteId,
    coachId: progress?.coachId,
    sourceDate,
    timezone,
    sourceStateSnapshotId: snapshot.id,
    progress,
    snapshot,
    activeProgram: resolveActiveProgramContext({ snapshot, progress }),
    liveProtocolRegistry,
    liveSimRegistry,
    now: Date.now(),
  });
  const candidateSet = buildAssignmentCandidateSet({
    athleteId,
    sourceDate,
    snapshot,
    progress,
    liveProtocolRegistry,
    liveSimRegistry,
    responsivenessProfile,
    primaryPlan: ensuredPlan.primaryPlan,
  });
  await db.collection(ASSIGNMENT_CANDIDATE_SETS_COLLECTION).doc(candidateSet.id).set(stripUndefinedDeep(candidateSet), { merge: true });

  const plannerDecision = await planAssignmentWithAI({
    snapshot,
    candidateSet,
    progress,
    responsivenessProfile,
  });

  const dailyAssignment = await orchestratePostCheckIn({
    db,
    athleteId,
    sourceCheckInId,
    sourceStateSnapshotId: snapshot.id,
    sourceCandidateSetId: candidateSet.id,
    sourceDate,
    timezone,
    progress,
    candidateSet,
    plannerDecision,
    liveProtocolRegistry,
    liveSimRegistry,
    primaryPlan: ensuredPlan.primaryPlan,
  });

  return {
    stateSnapshot: dailyAssignment ? { ...snapshot, executionLink: dailyAssignment.id } : snapshot,
    candidateSet,
    plannerDecision,
    dailyAssignment,
  };
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
    const userId = body.userId || decodedToken.uid;
    if (userId !== decodedToken.uid) {
      return {
        statusCode: 403,
        headers: RESPONSE_HEADERS,
        body: JSON.stringify({ error: 'Authenticated user does not match requested user.' }),
      };
    }

    const readinessScore = Number(body.readinessScore);
    if (!Number.isFinite(readinessScore) || readinessScore < 1 || readinessScore > 5) {
      return {
        statusCode: 400,
        headers: RESPONSE_HEADERS,
        body: JSON.stringify({ error: 'readinessScore must be a number from 1 to 5.' }),
      };
    }

    const { sourceDate, timezone } = resolveOperationalDay({
      explicitSourceDate: body.sourceDate,
      timezone: body.timezone,
      now: Date.now(),
    });

    console.info('[submit-pulsecheck-checkin] Received check-in submission', {
      userId,
      sourceDate,
      timezone,
      readinessScore,
      type: body.type || 'morning',
    });

    const now = Date.now();
    const priorProgress = await loadOrInitializeProgress(db, userId);
    const taxonomyState = body.taxonomyState || profileSnapshotRuntime.buildTaxonomyCheckInState({
      readinessScore,
      energyLevel: typeof body.energyLevel === 'number' ? body.energyLevel : undefined,
      stressLevel: typeof body.stressLevel === 'number' ? body.stressLevel : undefined,
      sleepQuality: typeof body.sleepQuality === 'number' ? body.sleepQuality : undefined,
      moodWord: typeof body.moodWord === 'string' ? body.moodWord : undefined,
      priorProfile: priorProgress?.taxonomyProfile,
    });

    const nextCheckIn = {
      userId,
      type: typeof body.type === 'string' && body.type.trim() ? body.type.trim() : 'morning',
      readinessScore,
      moodWord: typeof body.moodWord === 'string' ? body.moodWord : undefined,
      energyLevel: typeof body.energyLevel === 'number' ? body.energyLevel : undefined,
      stressLevel: typeof body.stressLevel === 'number' ? body.stressLevel : undefined,
      sleepQuality: typeof body.sleepQuality === 'number' ? body.sleepQuality : undefined,
      notes: typeof body.notes === 'string' ? body.notes : undefined,
      taxonomyState,
      timezone,
      createdAt: now,
      date: sourceDate,
    };

    const sanitizedCheckIn = stripUndefinedDeep(nextCheckIn);
    const checkInRef = await db.collection(CHECKINS_ROOT).doc(userId).collection('check-ins').add(sanitizedCheckIn);
    const persistedCheckIn = { id: checkInRef.id, ...sanitizedCheckIn };

    const syncedProgress = await syncTaxonomyProfile(db, userId, priorProgress);
    const recentAssignments = await listRecentDailyAssignments({
      db,
      athleteId: userId,
      sourceDate,
    });
    const recentAssignmentHistoryContext = deriveRecentAssignmentHistoryContext(recentAssignments);
    console.info('[submit-pulsecheck-checkin] Synced progress for submission', {
      userId,
      sourceDate,
      hasActiveProgram: Boolean(syncedProgress?.activeProgram),
      recommendedSimId: syncedProgress?.activeProgram?.recommendedSimId || null,
      recommendedLegacyExerciseId: syncedProgress?.activeProgram?.recommendedLegacyExerciseId || null,
      sessionType: syncedProgress?.activeProgram?.sessionType || null,
      recentTier0DeferCount: recentAssignmentHistoryContext.recentTier0DeferCount,
      consecutiveTier0Defers: recentAssignmentHistoryContext.consecutiveTier0Defers,
    });
    const rawStateSnapshot = await upsertStateSnapshot({
      db,
      athleteId: userId,
      checkIn: persistedCheckIn,
      progress: syncedProgress,
      recentAssignmentHistoryContext,
    });

    const stateSnapshot = await enrichStateSnapshotWithAI({
      snapshot: rawStateSnapshot,
      progress: syncedProgress,
    });
    await db.collection(SNAPSHOTS_COLLECTION).doc(stateSnapshot.id).set(stripUndefinedDeep(stateSnapshot), { merge: true });
    await expireAssignmentsBeforeSourceDate({
      db,
      athleteId: userId,
      sourceDate,
      expiredAt: now,
    });

    const {
      candidateSet,
      dailyAssignment,
    } = await rematerializeAssignmentFromSnapshot({
      db,
      athleteId: userId,
      sourceCheckInId: persistedCheckIn.id,
      sourceStateSnapshotId: stateSnapshot.id,
      sourceDate,
      timezone,
      progress: syncedProgress,
    });

    console.info('[submit-pulsecheck-checkin] Submission materialization complete', {
      userId,
      sourceDate,
      candidateCount: candidateSet?.candidates?.length || 0,
      plannerEligible: Boolean(candidateSet?.plannerEligible),
      dailyAssignmentId: dailyAssignment?.id || null,
      dailyAssignmentActionType: dailyAssignment?.actionType || null,
      dailyAssignmentStatus: dailyAssignment?.status || null,
    });

    await db.collection(PROGRESS_COLLECTION).doc(userId).collection('check-ins').add({
      date: admin.firestore.FieldValue.serverTimestamp(),
      readinessLevel: readinessScore,
      readinessLabel: body.moodWord || '',
    });

    const responseSnapshot = dailyAssignment
      ? { ...stateSnapshot, executionLink: dailyAssignment.id }
      : stateSnapshot;

    return {
      statusCode: 200,
      headers: RESPONSE_HEADERS,
      body: JSON.stringify({
        checkIn: persistedCheckIn,
        stateSnapshot: responseSnapshot,
        candidateSet,
        dailyAssignment,
      }),
    };
  } catch (error) {
    console.error('[submit-pulsecheck-checkin] Failed:', error);
    return {
      statusCode: 500,
      headers: RESPONSE_HEADERS,
      body: JSON.stringify({
        error: error?.message || 'Failed to submit PulseCheck check-in.',
      }),
    };
  }
};

exports.runtimeHelpers = {
  stripUndefinedDeep,
  loadOrInitializeProgress,
  syncTaxonomyProfile,
  getSnapshotById,
  listRecentDailyAssignments,
  deriveRecentAssignmentHistoryContext,
  normalizeReadinessScore,
  deriveStateDimensions,
  deriveOverallReadiness,
  deriveRouting,
  listLiveProtocolRegistry,
  listLivePublishedSimModules,
  isPublishedSimModuleRecord,
  resolveActiveProgramContext,
  resolvePublishedSimCandidate,
  getOrRefreshProtocolResponsivenessProfile,
  buildAssignmentCandidateSet,
  planAssignmentWithAI,
  orchestratePostCheckIn,
  rematerializeAssignmentFromSnapshot,
};
