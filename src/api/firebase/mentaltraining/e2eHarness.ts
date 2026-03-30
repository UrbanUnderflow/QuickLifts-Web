import {
  collection,
  deleteDoc,
  doc,
  documentId,
  endAt,
  getDoc,
  getDocs,
  getDocsFromServer,
  orderBy,
  query,
  setDoc,
  startAt,
  updateDoc,
  where,
} from 'firebase/firestore';

import type { Firestore } from 'firebase/firestore';

import {
  ATHLETE_PHYSIOLOGY_COGNITION_COLLECTION,
  ATHLETE_PATTERN_MODELS_SUBCOLLECTION,
  ATHLETE_MENTAL_PROGRESS_COLLECTION,
  CORRELATION_EVIDENCE_RECORDS_SUBCOLLECTION,
  PULSECHECK_ASSIGNMENT_EVENTS_COLLECTION,
  PULSECHECK_ASSIGNMENT_CANDIDATE_SETS_COLLECTION,
  PULSECHECK_DAILY_ASSIGNMENTS_COLLECTION,
  PULSECHECK_PROTOCOLS_COLLECTION,
  PULSECHECK_PROTOCOL_RESPONSIVENESS_PROFILES_COLLECTION,
  PULSECHECK_STATE_SNAPSHOTS_COLLECTION,
  PULSECHECK_PILOT_SURVEY_RESPONSES_COLLECTION,
  PULSECHECK_TRAINING_PLANS_COLLECTION,
  RECOMMENDATION_PROJECTIONS_SUBCOLLECTION,
  SIM_CHECKINS_ROOT,
  SIM_COMPLETIONS_ROOT,
  SIM_MODULES_COLLECTION,
  SIM_VARIANTS_COLLECTION,
} from './collections';
import { athleteProgressService } from './athleteProgressService';
import { assignmentOrchestratorService } from './assignmentOrchestratorService';
import { completionService } from './completionService';
import { simModuleLibraryService } from './exerciseLibraryService';
import { protocolRegistryService } from './protocolRegistryService';
import { stateSnapshotService } from './stateSnapshotService';
import { trainingPlanAuthoringService } from './trainingPlanAuthoringService';
import trainingPlanAuthoringShared from './trainingPlanAuthoringShared';
import { trainingPlanService } from './trainingPlanService';
import {
  BiggestChallenge,
  CheckInType,
  ExerciseCategory,
  PulseCheckDailyAssignmentStatus,
  checkInToFirestore,
  pulseCheckDailyAssignmentFromFirestore,
  pulseCheckStateSnapshotToFirestore,
  sanitizeFirestoreValue,
} from './types';

const E2E_HISTORY_COLLECTION = 'history';
const E2E_SPEC_VERSIONS_COLLECTION = 'spec_versions';
const USERS_COLLECTION = 'users';
const COACHES_COLLECTION = 'coaches';
const COACH_ATHLETES_COLLECTION = 'coachAthletes';
const COACH_REFERRALS_COLLECTION = 'coachReferrals';
const COACH_NOTIFICATIONS_COLLECTION = 'coach-notifications';
const PULSECHECK_ORGANIZATIONS_COLLECTION = 'pulsecheck-organizations';
const PULSECHECK_TEAMS_COLLECTION = 'pulsecheck-teams';
const PULSECHECK_PILOTS_COLLECTION = 'pulsecheck-pilots';
const PULSECHECK_PILOT_COHORTS_COLLECTION = 'pulsecheck-pilot-cohorts';
const PULSECHECK_PILOT_ENROLLMENTS_COLLECTION = 'pulsecheck-pilot-enrollments';
const PULSECHECK_TEAM_MEMBERSHIPS_COLLECTION = 'pulsecheck-team-memberships';
const PULSECHECK_ORGANIZATION_MEMBERSHIPS_COLLECTION = 'pulsecheck-organization-memberships';
const PULSECHECK_PILOT_HYPOTHESES_COLLECTION = 'pulsecheck-pilot-hypotheses';
const PULSECHECK_PILOT_RESEARCH_READOUTS_COLLECTION = 'pulsecheck-pilot-research-readouts';
const PULSECHECK_PILOT_METRIC_ROLLUPS_COLLECTION = 'pulsecheck-pilot-metric-rollups';
const PULSECHECK_PILOT_METRIC_ROLLUP_SUMMARY_SUBCOLLECTION = 'summary';
const PULSECHECK_PILOT_METRIC_OPS_COLLECTION = 'pulsecheck-pilot-metric-ops';
const PULSECHECK_PILOT_OUTCOME_RELEASE_SETTINGS_COLLECTION = 'pulsecheck-pilot-outcome-release-settings';
const PULSECHECK_LEGACY_MIGRATIONS_COLLECTION = 'pulsecheck-legacy-roster-migrations';
const REFERRAL_CODE_LOOKUP_COLLECTION = 'referralCodeLookup';
const {
  resolveNextDuePlanStep,
  syncTrainingPlanProgression,
} = trainingPlanAuthoringShared as unknown as {
  resolveNextDuePlanStep: (plan: Record<string, any>) => Record<string, any> | null;
  syncTrainingPlanProgression: (plan: Record<string, any>) => Record<string, any>;
};

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function sanitizeNamespace(namespace: string) {
  const normalized = slugify(namespace || 'e2e-registry');
  return normalized || 'e2e-registry';
}

function buildPrefix(namespace: string) {
  return `${sanitizeNamespace(namespace)}-`;
}

function buildFixtureName(sourceName: string) {
  return `[E2E] ${sourceName}`;
}

function buildNamespacedId(namespace: string, sourceId: string) {
  return `${buildPrefix(namespace)}${sourceId}`;
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function normalizeTag(value: unknown) {
  return typeof value === 'string'
    ? value.trim().toLowerCase().replace(/[\s-]+/g, '_')
    : '';
}

function humanizeRuntimeLabel(value: unknown) {
  return typeof value === 'string' && value.trim()
    ? value.trim().replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim()
    : '';
}

function averageScores(scores: number[]) {
  if (!scores.length) return null;
  return Number((scores.reduce((sum, score) => sum + score, 0) / scores.length).toFixed(1));
}

function medianScores(scores: number[]) {
  if (!scores.length) return null;
  const ordered = [...scores].sort((left, right) => left - right);
  const midpoint = Math.floor(ordered.length / 2);
  const value =
    ordered.length % 2 === 0 ? (ordered[midpoint - 1] + ordered[midpoint]) / 2 : ordered[midpoint];
  return Number(value.toFixed(1));
}

function buildHarnessSurveySummary(scores: number[], minimumResponseThreshold = 5) {
  const averageScore = averageScores(scores);
  const responseCount = scores.length;
  const minimumSampleMet = responseCount >= minimumResponseThreshold;
  return {
    responseCount,
    minimumSampleMet,
    averageScore,
    medianScore: medianScores(scores),
    lowScoreShare: responseCount ? Number(((scores.filter((score) => score <= 6).length / responseCount) * 100).toFixed(1)) : null,
    highScoreShare: responseCount ? Number(((scores.filter((score) => score >= 9).length / responseCount) * 100).toFixed(1)) : null,
    headlineValue: minimumSampleMet ? averageScore : null,
  };
}

function buildHarnessSurveyDiagnostics(
  responses: Array<{
    respondentRole: 'athlete' | 'coach' | 'clinician';
    surveyKind: 'trust' | 'nps';
    score: number;
  }>,
  minimumResponseThreshold = 5
) {
  const scoresFor = (respondentRole: 'athlete' | 'coach' | 'clinician', surveyKind: 'trust' | 'nps') =>
    responses
      .filter((response) => response.respondentRole === respondentRole && response.surveyKind === surveyKind)
      .map((response) => response.score);

  return {
    minimumResponseThreshold,
    athleteTrust: buildHarnessSurveySummary(scoresFor('athlete', 'trust'), minimumResponseThreshold),
    coachTrust: buildHarnessSurveySummary(scoresFor('coach', 'trust'), minimumResponseThreshold),
    clinicianTrust: buildHarnessSurveySummary(scoresFor('clinician', 'trust'), minimumResponseThreshold),
    athleteNps: buildHarnessSurveySummary(scoresFor('athlete', 'nps'), minimumResponseThreshold),
    coachNps: buildHarnessSurveySummary(scoresFor('coach', 'nps'), minimumResponseThreshold),
    clinicianNps: buildHarnessSurveySummary(scoresFor('clinician', 'nps'), minimumResponseThreshold),
  };
}

function buildHarnessOutcomeMetrics(surveys: ReturnType<typeof buildHarnessSurveyDiagnostics>) {
  return {
    enrollmentRate: 100,
    consentCompletionRate: 100,
    baselineCompletionRate: 100,
    adherenceRate: 66.7,
    dailyCheckInRate: 66.7,
    assignmentCompletionRate: 66.7,
    mentalPerformanceDelta: 4.2,
    escalationsTotal: 0,
    escalationsTier1: 0,
    escalationsTier2: 0,
    escalationsTier3: 0,
    medianMinutesToCare: null,
    athleteNps: surveys.athleteNps.headlineValue,
    coachNps: surveys.coachNps.headlineValue,
    clinicianNps: surveys.clinicianNps.headlineValue,
    athleteTrust: surveys.athleteTrust.headlineValue,
    coachTrust: surveys.coachTrust.headlineValue,
    clinicianTrust: surveys.clinicianTrust.headlineValue,
  };
}

function buildHarnessRecommendationTypeSlices(
  variant: 'whole-pilot' | 'cohort-alpha' | 'cohort-beta' = 'whole-pilot'
) {
  const variants = {
    'whole-pilot': {
      stateAwareAdherence: 88,
      stateAwareTrust: 7.9,
      fallbackAdherence: 67,
      fallbackTrust: 6.8,
      protocolCompletedAdherence: 91,
      protocolCompletedTrust: 8.1,
      protocolSkippedAdherence: 64,
      protocolSkippedTrust: 6.5,
    },
    'cohort-alpha': {
      stateAwareAdherence: 92,
      stateAwareTrust: 8.3,
      fallbackAdherence: 71,
      fallbackTrust: 7.1,
      protocolCompletedAdherence: 94,
      protocolCompletedTrust: 8.4,
      protocolSkippedAdherence: 69,
      protocolSkippedTrust: 6.9,
    },
    'cohort-beta': {
      stateAwareAdherence: 79,
      stateAwareTrust: 6.7,
      fallbackAdherence: 58,
      fallbackTrust: 5.9,
      protocolCompletedAdherence: 83,
      protocolCompletedTrust: 7.0,
      protocolSkippedAdherence: 51,
      protocolSkippedTrust: 5.6,
    },
  } as const;

  const selected = variants[variant];
  return {
    stateAwareVsFallback: {
      stateAware: {
        athleteCount: 2,
        adherenceRate: selected.stateAwareAdherence,
        mentalPerformanceDelta: 4.1,
        athleteTrust: selected.stateAwareTrust,
        athleteNps: 42,
      },
      fallbackOrNone: {
        athleteCount: 1,
        adherenceRate: selected.fallbackAdherence,
        mentalPerformanceDelta: 2.4,
        athleteTrust: selected.fallbackTrust,
        athleteNps: 28,
      },
      delta: {
        adherenceRate: Number((selected.stateAwareAdherence - selected.fallbackAdherence).toFixed(1)),
        mentalPerformanceDelta: 1.7,
        athleteTrust: Number((selected.stateAwareTrust - selected.fallbackTrust).toFixed(1)),
      },
    },
    protocolCompletion: {
      completedProtocol: {
        athleteCount: 2,
        adherenceRate: selected.protocolCompletedAdherence,
        mentalPerformanceDelta: 4.4,
        athleteTrust: selected.protocolCompletedTrust,
        athleteNps: 44,
      },
      incompleteOrSkippedProtocol: {
        athleteCount: 1,
        adherenceRate: selected.protocolSkippedAdherence,
        mentalPerformanceDelta: 2.2,
        athleteTrust: selected.protocolSkippedTrust,
        athleteNps: 24,
      },
      delta: {
        adherenceRate: Number((selected.protocolCompletedAdherence - selected.protocolSkippedAdherence).toFixed(1)),
        mentalPerformanceDelta: 2.2,
        athleteTrust: Number((selected.protocolCompletedTrust - selected.protocolSkippedTrust).toFixed(1)),
      },
    },
  };
}

function buildHarnessOperationalDiagnostics() {
  const speedToCare = {
    coachNotification: { medianMinutes: 15, p75Minutes: 22, sampleCount: 3 },
    consentAccepted: { medianMinutes: 18, p75Minutes: 26, sampleCount: 3 },
    handoffInitiated: { medianMinutes: 24, p75Minutes: 31, sampleCount: 3 },
    handoffAccepted: { medianMinutes: 31, p75Minutes: 38, sampleCount: 3 },
    firstClinicianResponse: { medianMinutes: 36, p75Minutes: 44, sampleCount: 3 },
    careCompleted: { medianMinutes: 51, p75Minutes: 58, sampleCount: 3 },
  };

  return {
    escalations: {
      statusCounts: {
        active: 1,
        resolved: 1,
        declined: 1,
      },
      supportingSpeedToCare: speedToCare,
    },
  };
}

function intersectsTags(left: string[], right: string[]) {
  if (!left.length || !right.length) return false;
  const rightSet = new Set(right.map((value) => normalizeTag(value)).filter(Boolean));
  return left.some((value) => rightSet.has(normalizeTag(value)));
}

function sortEventsByFreshness(left: Record<string, any>, right: Record<string, any>) {
  return Number(right.eventAt || right.updatedAt || right.createdAt || 0) - Number(left.eventAt || left.updatedAt || left.createdAt || 0);
}

function sortPlansByFreshness(left: Record<string, any>, right: Record<string, any>) {
  if (Boolean(left.isPrimary) !== Boolean(right.isPrimary)) {
    return left.isPrimary ? -1 : 1;
  }

  return Number(right.updatedAt || right.createdAt || 0) - Number(left.updatedAt || left.createdAt || 0);
}

function resolveHarnessPlanStepEventType(eventType: string) {
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

function resolveHarnessActorType(assignment: Record<string, any>, input: {
  eventType: string;
  actorUserId?: string;
}) {
  if (!input.actorUserId) {
    return 'system';
  }

  if (input.actorUserId === assignment.athleteId) {
    return 'athlete';
  }

  if (input.eventType === 'overridden' || input.eventType === 'deferred') {
    return 'coach';
  }

  return 'staff';
}

function buildHarnessPhaseProgress(executionPattern?: string | null) {
  if (!executionPattern || executionPattern === 'single') {
    return null;
  }

  return {
    currentPhaseIndex: 1,
    totalPhases: 2,
    currentPhaseLabel: executionPattern === 'protocol_then_sim' ? 'Protocol' : 'Sim',
    phaseLabels: executionPattern === 'protocol_then_sim' ? ['Protocol', 'Sim'] : ['Sim', 'Protocol'],
  };
}

function findTrainingPlanStepIndex(plan: Record<string, any>, assignment: Record<string, any>) {
  const steps = Array.isArray(plan?.steps) ? plan.steps : [];

  if (typeof assignment?.trainingPlanStepIndex === 'number') {
    const index = steps.findIndex((step) => Number(step?.stepIndex) === Number(assignment.trainingPlanStepIndex));
    if (index >= 0) {
      return index;
    }
  }

  if (assignment?.trainingPlanStepId) {
    return steps.findIndex((step) => step?.id === assignment.trainingPlanStepId);
  }

  return -1;
}

async function resolveHarnessPlanDrivenCandidate(input: {
  athleteId: string;
  sourceDate: string;
  primaryPlan: Record<string, any> | null;
  protocolRecords: Array<Record<string, any>>;
}) {
  const { athleteId, sourceDate, primaryPlan, protocolRecords } = input;
  if (!primaryPlan || primaryPlan.status === 'completed' || primaryPlan.status === 'superseded') {
    return null;
  }

  const step = resolveNextDuePlanStep(primaryPlan);
  if (!step) {
    return null;
  }

  const liveProtocol = step.protocolId
    ? protocolRecords.find((record) => record.id === step.protocolId)
    : null;
  const liveSim = step.simSpecId
    ? (
        await simModuleLibraryService.getPublishedBySimSpecId(step.simSpecId).catch(() => null)
      )
      || (
        await simModuleLibraryService.getPublishedById(step.simSpecId).catch(() => null)
      )
      || (
        await simModuleLibraryService.getBySimSpecId(step.simSpecId).catch(() => null)
      )
      || (
        await simModuleLibraryService.getById(step.simSpecId).catch(() => null)
      )
    : null;
  const isTrial =
    primaryPlan.planType === 'assessment'
    || /reassessment|probe/i.test(String(step.stepLabel || ''))
    || String(step.archetypeStepKey || '').includes('reassessment');

  return {
    id: `${athleteId}_${sourceDate}_${primaryPlan.id}_${step.id}`,
    type: isTrial ? 'trial' : step.actionType === 'protocol' ? 'protocol' : 'sim',
    label:
      step.stepLabel
      || liveProtocol?.label
      || liveSim?.name
      || humanizeRuntimeLabel(step.exerciseId)
      || 'Authored plan step',
    actionType: step.actionType || 'sim',
    rationale: `Authored plan step ${step.stepIndex} is the default next-due rep for this athlete.`,
    legacyExerciseId: liveProtocol?.legacyExerciseId || liveSim?.id || null,
    protocolId: step.protocolId || null,
    protocolLabel: liveProtocol?.label || null,
    protocolClass: step.protocolClass || liveProtocol?.protocolClass || null,
    protocolCategory: liveProtocol?.category || null,
    protocolResponseFamily: liveProtocol?.responseFamily || null,
    protocolDeliveryMode: liveProtocol?.deliveryMode || null,
    simSpecId: step.simSpecId || liveSim?.simSpecId || null,
    durationSeconds: step.plannedDurationSeconds || liveProtocol?.durationSeconds || null,
    executionPattern: step.executionPattern || 'single',
    trainingPlanId: primaryPlan.id,
    trainingPlanStepId: step.id,
    trainingPlanStepIndex: step.stepIndex,
    trainingPlanStepLabel: step.stepLabel || null,
  };
}

async function syncHarnessPlanWithAssignment(input: {
  plan: Record<string, any>;
  assignment: Record<string, any>;
  eventAt: number;
}) {
  const { plan, assignment, eventAt } = input;
  const stepIndex = findTrainingPlanStepIndex(plan, assignment);
  if (stepIndex < 0) {
    return plan;
  }

  const steps = Array.isArray(plan.steps) ? plan.steps.map((step) => ({ ...step })) : [];
  const targetStep = {
    ...steps[stepIndex],
    stepStatus: assignment.actionType === 'defer' ? 'deferred' : 'active_today',
    linkedDailyTaskId: assignment.id,
    linkedDailyTaskSourceDate: assignment.sourceDate || steps[stepIndex]?.linkedDailyTaskSourceDate,
    dueSourceDate: steps[stepIndex]?.dueSourceDate || assignment.sourceDate,
    timezone: assignment.timezone || steps[stepIndex]?.timezone,
    startedAt: steps[stepIndex]?.startedAt || eventAt,
  };

  steps[stepIndex] = targetStep;

  const nextPlan = syncTrainingPlanProgression({
    ...plan,
    status: assignment.actionType === 'defer' ? 'paused' : 'active',
    pausedAt: assignment.actionType === 'defer' ? eventAt : (plan.pausedAt || null),
    resumedAt: assignment.actionType === 'defer' ? (plan.resumedAt || null) : (plan.status === 'paused' ? eventAt : (plan.resumedAt || null)),
    sourceDailyTaskId: assignment.id,
    sourceDate: plan.sourceDate || assignment.sourceDate,
    timezone: plan.timezone || assignment.timezone,
    sourceStateSnapshotId: assignment.sourceStateSnapshotId || plan.sourceStateSnapshotId || null,
    currentStepIndex: typeof targetStep.stepIndex === 'number' ? targetStep.stepIndex : plan.currentStepIndex,
    nextDueStepIndex: typeof targetStep.stepIndex === 'number' ? targetStep.stepIndex : plan.nextDueStepIndex,
    steps,
    updatedAt: eventAt,
  });

  await trainingPlanService.save(nextPlan as any);
  return nextPlan;
}

async function writeHarnessTrainingPlanEvent(
  db: Firestore,
  payload: Record<string, any>
) {
  const eventAt = Number(payload.eventAt || Date.now());
  const eventId = `${payload.assignmentId || 'training-plan'}_${payload.eventType}_${eventAt}_${Math.random().toString(36).slice(2, 8)}`;

  await setDoc(
    doc(db, PULSECHECK_ASSIGNMENT_EVENTS_COLLECTION, eventId),
    sanitizeFirestoreValue({
      ...payload,
      createdAt: payload.createdAt || eventAt,
    }),
    { merge: true }
  );

  return eventId;
}

async function applyHarnessTrainingPlanEventSideEffects(
  db: Firestore,
  input: {
    assignment: Record<string, any>;
    nextAssignment: Record<string, any>;
    eventType: string;
    actorType: string;
    actorUserId: string;
    reason?: string;
    eventAt: number;
    assignmentEventId: string;
  }
) {
  const sideEffectEventType = resolveHarnessPlanStepEventType(input.eventType);
  if (!sideEffectEventType || !input.assignment.trainingPlanId) {
    return null;
  }

  const plan = await trainingPlanService.getById(input.assignment.trainingPlanId);
  if (!plan) {
    return null;
  }

  const stepIndex = findTrainingPlanStepIndex(plan as Record<string, any>, input.assignment);
  if (stepIndex < 0) {
    return null;
  }

  const steps = Array.isArray(plan.steps) ? plan.steps.map((entry) => ({ ...entry })) : [];
  const currentStep = { ...steps[stepIndex] };
  const nextStep = { ...currentStep };
  const nextPlanBase: Record<string, any> = { ...(plan as Record<string, any>), steps };
  const lifecycleEvents: string[] = [];
  const completionSummary =
    input.nextAssignment?.completionSummary
    || input.assignment?.completionSummary
    || null;

  switch (input.eventType) {
    case 'viewed':
    case 'started':
      if (!['completed', 'overridden', 'skipped'].includes(String(currentStep.stepStatus || ''))) {
        nextStep.stepStatus = 'active_today';
        nextStep.linkedDailyTaskId = input.assignment.id;
        nextStep.linkedDailyTaskSourceDate = input.assignment.sourceDate || undefined;
        nextStep.startedAt = currentStep.startedAt || input.eventAt;
      }
      break;
    case 'paused':
      nextPlanBase.status = 'paused';
      nextPlanBase.pausedAt = input.eventAt;
      if (!['completed', 'overridden', 'skipped'].includes(String(currentStep.stepStatus || ''))) {
        nextStep.stepStatus = 'active_today';
        nextStep.linkedDailyTaskId = input.assignment.id;
        nextStep.linkedDailyTaskSourceDate = input.assignment.sourceDate || undefined;
        nextStep.startedAt = currentStep.startedAt || input.eventAt;
      }
      lifecycleEvents.push('training_plan_paused');
      break;
    case 'resumed':
      nextPlanBase.status = 'active';
      nextPlanBase.resumedAt = input.eventAt;
      if (!['completed', 'overridden', 'skipped'].includes(String(currentStep.stepStatus || ''))) {
        nextStep.stepStatus = 'active_today';
        nextStep.linkedDailyTaskId = input.assignment.id;
        nextStep.linkedDailyTaskSourceDate = input.assignment.sourceDate || undefined;
        nextStep.startedAt = currentStep.startedAt || input.eventAt;
      }
      lifecycleEvents.push('training_plan_resumed');
      break;
    case 'completed':
      nextStep.stepStatus = 'completed';
      nextStep.linkedDailyTaskId = input.assignment.id;
      nextStep.linkedDailyTaskSourceDate = input.assignment.sourceDate || undefined;
      nextStep.completedAt = currentStep.completedAt || input.eventAt;
      nextStep.resultSummary = completionSummary || currentStep.resultSummary || undefined;
      nextPlanBase.latestResultSummary =
        completionSummary?.noraTakeaway
        || completionSummary?.athleteHeadline
        || input.reason
        || currentStep.stepLabel
        || null;
      nextPlanBase.latestResultAt = input.eventAt;
      break;
    case 'deferred':
    case 'overridden':
    case 'expired':
      nextStep.stepStatus = input.eventType === 'deferred' ? 'deferred' : 'overridden';
      nextStep.linkedDailyTaskId = input.assignment.id;
      nextStep.linkedDailyTaskSourceDate = input.assignment.sourceDate || undefined;
      nextStep.overrideReason = input.reason || currentStep.overrideReason || 'Assignment adjusted.';
      nextPlanBase.latestResultSummary = nextStep.overrideReason;
      nextPlanBase.latestResultAt = input.eventAt;
      break;
    default:
      break;
  }

  steps[stepIndex] = nextStep;
  const normalizedPlan = syncTrainingPlanProgression({
    ...nextPlanBase,
    steps,
    sourceDailyTaskId: nextPlanBase.sourceDailyTaskId || input.assignment.id,
    sourceDate: nextPlanBase.sourceDate || input.assignment.sourceDate,
    timezone: nextPlanBase.timezone || input.assignment.timezone,
    updatedAt: input.eventAt,
  });

  if (normalizedPlan.status === 'completed' && plan.status !== 'completed') {
    lifecycleEvents.push('training_plan_completed');
  }

  await trainingPlanService.save(normalizedPlan as any);

  await writeHarnessTrainingPlanEvent(db, {
    assignmentId: input.assignment.id,
    athleteId: input.assignment.athleteId || '',
    teamId: input.assignment.teamId || '',
    sourceDate: input.assignment.sourceDate || '',
    trainingPlanId: input.assignment.trainingPlanId,
    trainingPlanStepId: input.assignment.trainingPlanStepId || null,
    trainingPlanStepIndex: typeof input.assignment.trainingPlanStepIndex === 'number' ? input.assignment.trainingPlanStepIndex : null,
    eventType: sideEffectEventType,
    actorType: input.actorType,
    actorUserId: input.actorUserId,
    eventAt: input.eventAt,
    executionPattern: input.assignment.executionPattern || null,
    phaseProgress: input.assignment.phaseProgress || null,
    completionSummary: completionSummary || null,
    metadata: {
      relatedAssignmentEventId: input.assignmentEventId,
      relatedAssignmentEventType: input.eventType,
      planStatusBefore: plan.status || null,
      planStatusAfter: normalizedPlan.status || null,
      planStepBefore: currentStep.stepStatus || null,
      planStepAfter: nextStep.stepStatus || null,
      planStepLabel: currentStep.stepLabel || input.assignment.trainingPlanStepLabel || null,
      linkedDailyTaskId: input.assignment.id,
      linkedDailyTaskSourceDate: input.assignment.sourceDate || null,
      reason: input.reason || null,
    },
  });

  for (const lifecycleEventType of lifecycleEvents) {
    await writeHarnessTrainingPlanEvent(db, {
      assignmentId: input.assignment.id,
      athleteId: input.assignment.athleteId || '',
      teamId: input.assignment.teamId || '',
      sourceDate: input.assignment.sourceDate || '',
      trainingPlanId: input.assignment.trainingPlanId,
      trainingPlanStepId: input.assignment.trainingPlanStepId || null,
      trainingPlanStepIndex: typeof input.assignment.trainingPlanStepIndex === 'number' ? input.assignment.trainingPlanStepIndex : null,
      eventType: lifecycleEventType,
      actorType: input.actorType,
      actorUserId: input.actorUserId,
      eventAt: input.eventAt,
      metadata: {
        relatedAssignmentEventId: input.assignmentEventId,
        relatedAssignmentEventType: input.eventType,
        planStatusBefore: plan.status || null,
        planStatusAfter: normalizedPlan.status || null,
        linkedDailyTaskId: input.assignment.id,
        linkedDailyTaskSourceDate: input.assignment.sourceDate || null,
        reason: input.reason || null,
      },
    });
  }

  return normalizedPlan;
}

function buildLegacyRosterFixtureIds(namespace: string) {
  const prefix = buildPrefix(namespace);
  const label = sanitizeNamespace(namespace).replace(/-/g, ' ');
  return {
    namespace: sanitizeNamespace(namespace),
    coachId: `${prefix}coach`,
    athleteOneId: `${prefix}athlete-a`,
    athleteTwoId: `${prefix}athlete-b`,
    coachEmail: `${prefix}coach@pulse.test`,
    athleteOneEmail: `${prefix}athlete-a@pulse.test`,
    athleteTwoEmail: `${prefix}athlete-b@pulse.test`,
    coachDisplayName: `E2E Legacy Coach ${label}`,
    athleteOneName: `E2E Legacy Athlete A ${label}`,
    athleteTwoName: `E2E Legacy Athlete B ${label}`,
    coachReferralCode: sanitizeNamespace(namespace).replace(/-/g, '').slice(0, 12).toUpperCase() || 'E2ELEGACY',
    existingOrganizationId: `${prefix}org`,
    existingTeamId: `${prefix}team`,
    existingOrganizationName: `E2E Existing Org ${label}`,
    existingTeamName: `E2E Existing Team ${label}`,
    connectionOneId: `${prefix}link-a`,
    connectionTwoId: `${prefix}link-b`,
  };
}

function buildAdminWorkspaceFixtureIds(namespace: string) {
  const prefix = buildPrefix(namespace);
  const label = sanitizeNamespace(namespace).replace(/-/g, ' ');

  return {
    namespace: sanitizeNamespace(namespace),
    organizationId: `${prefix}org`,
    teamId: `${prefix}team`,
    organizationName: `E2E Workspace Org ${label}`,
    teamName: `E2E Workspace Team ${label}`,
  };
}

function buildAthleteJourneyFixtureIds(namespace: string) {
  const workspace = buildAdminWorkspaceFixtureIds(`${namespace}-journey`);
  const prefix = buildPrefix(namespace);

  return {
    namespace: sanitizeNamespace(namespace),
    referralCode: sanitizeNamespace(namespace).replace(/-/g, '').slice(0, 12).toUpperCase() || 'PULSEE2E',
    organizationId: workspace.organizationId,
    teamId: workspace.teamId,
    coachAthleteLinkId: `${prefix}coach-athlete-link`,
  };
}

function buildPilotDashboardFixtureIds(namespace: string) {
  const workspace = buildAdminWorkspaceFixtureIds(`${namespace}-pilot-dashboard`);
  const prefix = buildPrefix(namespace);
  const label = sanitizeNamespace(namespace).replace(/-/g, ' ');
  const pilotId = `${prefix}pilot`;
  const cohortAlphaId = `${prefix}cohort-alpha`;
  const cohortBetaId = `${prefix}cohort-beta`;
  const athleteOneId = `${prefix}athlete-a`;
  const athleteTwoId = `${prefix}athlete-b`;
  const athleteThreeId = `${prefix}athlete-c`;

  return {
    namespace: sanitizeNamespace(namespace),
    organizationId: workspace.organizationId,
    teamId: workspace.teamId,
    organizationName: workspace.organizationName,
    teamName: workspace.teamName,
    pilotId,
    pilotName: `E2E Pilot Dashboard ${label}`,
    pilotObjective: 'Validate whether the correlation engine is learning enough inside the active pilot population to support disciplined pilot review.',
    cohortAlphaId,
    cohortBetaId,
    cohortAlphaName: `Alpha Cohort ${label}`,
    cohortBetaName: `Beta Cohort ${label}`,
    athleteOneId,
    athleteTwoId,
    athleteThreeId,
    athleteOneEmail: `${prefix}athlete-a@pulse.test`,
    athleteTwoEmail: `${prefix}athlete-b@pulse.test`,
    athleteThreeEmail: `${prefix}athlete-c@pulse.test`,
    athleteOneName: `E2E Pilot Athlete A ${label}`,
    athleteTwoName: `E2E Pilot Athlete B ${label}`,
    athleteThreeName: `E2E Pilot Athlete C ${label}`,
    hypothesisIds: ['h1', 'h2', 'h3'].map((suffix) => `${prefix}${suffix}`),
    readoutIds: ['readout-1', 'readout-2'].map((suffix) => `${prefix}${suffix}`),
  };
}

function resolveProtocolFixture(protocolId?: string): {
  id: string;
  label: string;
  legacyExerciseId: string;
  protocolClass: 'priming' | 'regulation' | 'recovery';
  protocolCategory: ExerciseCategory;
  protocolResponseFamily: string;
  protocolDeliveryMode: string;
  durationSeconds: number;
  responsivenessDirection?: 'positive' | 'neutral' | 'negative';
} {
  switch (protocolId) {
    case 'protocol-power-pose':
      return {
        id: 'protocol-power-pose',
        label: 'Power Posing',
        legacyExerciseId: 'confidence-power-pose',
        protocolClass: 'priming',
        protocolCategory: ExerciseCategory.Confidence,
        protocolResponseFamily: 'confidence_priming',
        protocolDeliveryMode: 'embodied_reset',
        durationSeconds: 120,
      };
    case 'protocol-cue-word-anchoring':
    default:
      return {
        id: 'protocol-cue-word-anchoring',
        label: 'Cue Word Anchoring',
        legacyExerciseId: 'focus-cue-word',
        protocolClass: 'priming',
        protocolCategory: ExerciseCategory.Focus,
        protocolResponseFamily: 'focus_narrowing',
        protocolDeliveryMode: 'guided_focus',
        durationSeconds: 300,
      };
  }
}

async function listPrefixedDocIds(db: Firestore, collectionName: string, prefix: string) {
  const snap = await getDocs(
    query(
      collection(db, collectionName),
      orderBy(documentId()),
      startAt(prefix),
      endAt(`${prefix}\uf8ff`)
    )
  );

  return snap.docs.map((entry) => entry.id);
}

async function deleteVariantHistory(db: Firestore, variantId: string) {
  const historySnap = await getDocs(collection(db, SIM_VARIANTS_COLLECTION, variantId, E2E_HISTORY_COLLECTION));
  await Promise.all(historySnap.docs.map((entry) => deleteDoc(entry.ref)));
}

async function deleteVariantSpecVersions(db: Firestore, variantId: string) {
  const specVersionSnap = await getDocs(collection(db, SIM_VARIANTS_COLLECTION, variantId, E2E_SPEC_VERSIONS_COLLECTION));
  await Promise.all(specVersionSnap.docs.map((entry) => deleteDoc(entry.ref)));
}

async function cleanupRegistryFixtures(db: Firestore, namespace: string) {
  const prefix = buildPrefix(namespace);

  const [moduleIds, variantIds] = await Promise.all([
    listPrefixedDocIds(db, SIM_MODULES_COLLECTION, prefix),
    listPrefixedDocIds(db, SIM_VARIANTS_COLLECTION, prefix),
  ]);

  await Promise.all(moduleIds.map((id) => deleteDoc(doc(db, SIM_MODULES_COLLECTION, id))));

  for (const variantId of variantIds) {
    await deleteVariantHistory(db, variantId);
    await deleteVariantSpecVersions(db, variantId);
    await deleteDoc(doc(db, SIM_VARIANTS_COLLECTION, variantId));
  }

  return {
    namespace: sanitizeNamespace(namespace),
    deletedModules: moduleIds.length,
    deletedVariants: variantIds.length,
  };
}

async function findVariantByName(db: Firestore, sourceName: string) {
  const snap = await getDocs(collection(db, SIM_VARIANTS_COLLECTION));
  const match = snap.docs.find((entry) => entry.data()?.name === sourceName);
  if (!match) {
    throw new Error(`Unable to find sim-variant named "${sourceName}" for E2E fixture cloning.`);
  }
  return match;
}

async function cloneVariantFixtureByName(db: Firestore, sourceName: string, namespace: string) {
  const sourceDoc = await findVariantByName(db, sourceName);
  const sourceData = sourceDoc.data() || {};
  const fixtureId = buildNamespacedId(namespace, sourceDoc.id);
  const fixtureModuleId = buildNamespacedId(namespace, sourceData?.moduleDraft?.moduleId || sourceDoc.id);
  const fixtureName = buildFixtureName(sourceData?.name || sourceName);
  const now = Date.now();

  const fixtureData = {
    ...sourceData,
    name: fixtureName,
    moduleDraft: {
      ...(sourceData.moduleDraft || {}),
      moduleId: fixtureModuleId,
      name: fixtureName,
    },
    publishedModuleId: null,
    publishedAt: null,
    publishedSnapshot: null,
    buildArtifact: null,
    buildMeta: null,
    buildStatus: 'not_built',
    syncStatus: 'in_sync',
    sourceFingerprint: null,
    lastBuiltFingerprint: null,
    lastPublishedFingerprint: null,
    createdAt: now,
    updatedAt: now,
  };

  await setDoc(doc(db, SIM_VARIANTS_COLLECTION, fixtureId), fixtureData);

  return {
    namespace: sanitizeNamespace(namespace),
    sourceVariantId: sourceDoc.id,
    variantId: fixtureId,
    variantName: fixtureName,
    moduleId: fixtureModuleId,
  };
}

async function seedLegacyCoachRosterFixture(
  db: Firestore,
  namespace: string,
  mode: 'new-container' | 'existing-team'
) {
  const fixture = buildLegacyRosterFixtureIds(namespace);
  const now = Date.now();

  await setDoc(
    doc(db, USERS_COLLECTION, fixture.coachId),
    {
      email: fixture.coachEmail,
      displayName: fixture.coachDisplayName,
      username: fixture.coachDisplayName.toLowerCase().replace(/[^a-z0-9]+/g, ''),
      activeCoachAccount: true,
      createdAt: now,
      updatedAt: now,
    },
    { merge: true }
  );

  await setDoc(
    doc(db, COACHES_COLLECTION, fixture.coachId),
    {
      userId: fixture.coachId,
      email: fixture.coachEmail,
      username: fixture.coachDisplayName,
      referralCode: fixture.coachReferralCode,
      subscriptionStatus: 'partner',
      userType: 'partner',
      createdAt: now,
      updatedAt: now,
    },
    { merge: true }
  );

  await Promise.all([
    setDoc(
      doc(db, USERS_COLLECTION, fixture.athleteOneId),
      {
        email: fixture.athleteOneEmail,
        displayName: fixture.athleteOneName,
        username: fixture.athleteOneName.toLowerCase().replace(/[^a-z0-9]+/g, ''),
        createdAt: now,
        updatedAt: now,
      },
      { merge: true }
    ),
    setDoc(
      doc(db, USERS_COLLECTION, fixture.athleteTwoId),
      {
        email: fixture.athleteTwoEmail,
        displayName: fixture.athleteTwoName,
        username: fixture.athleteTwoName.toLowerCase().replace(/[^a-z0-9]+/g, ''),
        createdAt: now,
        updatedAt: now,
      },
      { merge: true }
    ),
  ]);

  await Promise.all([
    setDoc(
      doc(db, COACH_ATHLETES_COLLECTION, fixture.connectionOneId),
      {
        coachId: fixture.coachId,
        athleteUserId: fixture.athleteOneId,
        status: 'active',
        linkedAt: now,
        updatedAt: now,
      },
      { merge: true }
    ),
    setDoc(
      doc(db, COACH_ATHLETES_COLLECTION, fixture.connectionTwoId),
      {
        coachId: fixture.coachId,
        athleteUserId: fixture.athleteTwoId,
        status: 'active',
        linkedAt: now,
        updatedAt: now,
      },
      { merge: true }
    ),
  ]);

  if (mode === 'existing-team') {
    await Promise.all([
      setDoc(
        doc(db, PULSECHECK_ORGANIZATIONS_COLLECTION, fixture.existingOrganizationId),
        {
          displayName: fixture.existingOrganizationName,
          legalName: fixture.existingOrganizationName,
          organizationType: 'other',
          status: 'active',
          defaultStudyPosture: 'operational',
          defaultClinicianBridgeMode: 'none',
          createdAt: now,
          updatedAt: now,
        },
        { merge: true }
      ),
      setDoc(
        doc(db, PULSECHECK_TEAMS_COLLECTION, fixture.existingTeamId),
        {
          organizationId: fixture.existingOrganizationId,
          displayName: fixture.existingTeamName,
          teamType: 'other',
          sportOrProgram: 'Existing legacy migration team',
          status: 'active',
          defaultInvitePolicy: 'admin-staff-and-coaches',
          createdAt: now,
          updatedAt: now,
        },
        { merge: true }
      ),
      setDoc(
        doc(db, PULSECHECK_ORGANIZATION_MEMBERSHIPS_COLLECTION, `${fixture.existingOrganizationId}_${fixture.coachId}`),
        {
          organizationId: fixture.existingOrganizationId,
          userId: fixture.coachId,
          email: fixture.coachEmail,
          role: 'implementation-observer',
          status: 'active',
          createdAt: now,
          updatedAt: now,
        },
        { merge: true }
      ),
      setDoc(
        doc(db, PULSECHECK_TEAM_MEMBERSHIPS_COLLECTION, `${fixture.existingTeamId}_${fixture.coachId}`),
        {
          organizationId: fixture.existingOrganizationId,
          teamId: fixture.existingTeamId,
          userId: fixture.coachId,
          email: fixture.coachEmail,
          role: 'coach',
          title: 'Coach',
          permissionSetId: 'pulsecheck-coach-v1',
          rosterVisibilityScope: 'team',
          allowedAthleteIds: [],
          onboardingStatus: 'complete',
          createdAt: now,
          updatedAt: now,
        },
        { merge: true }
      ),
      setDoc(
        doc(db, PULSECHECK_TEAM_MEMBERSHIPS_COLLECTION, `${fixture.existingTeamId}_${fixture.athleteOneId}`),
        {
          organizationId: fixture.existingOrganizationId,
          teamId: fixture.existingTeamId,
          userId: fixture.athleteOneId,
          email: fixture.athleteOneEmail,
          role: 'athlete',
          permissionSetId: 'pulsecheck-athlete-v1',
          rosterVisibilityScope: 'none',
          allowedAthleteIds: [],
          onboardingStatus: 'pending-consent',
          athleteOnboarding: {
            productConsentAccepted: false,
            productConsentAcceptedAt: null,
            productConsentVersion: '',
            researchConsentStatus: 'not-required',
            eligibleForResearchDataset: false,
            enrollmentMode: 'product-only',
            targetPilotId: '',
            targetPilotName: '',
            targetCohortId: '',
            targetCohortName: '',
            baselinePathStatus: 'pending',
            baselinePathwayId: '',
          },
          createdAt: now,
          updatedAt: now,
        },
        { merge: true }
      ),
    ]);
  }

  return {
    ...fixture,
    mode,
  };
}

async function seedPulseCheckAdminWorkspaceFixture(
  db: Firestore,
  namespace: string,
  adminUserId: string,
  adminEmail: string
) {
  const fixture = buildAdminWorkspaceFixtureIds(namespace);
  const now = Date.now();
  const normalizedEmail = (adminEmail || '').trim().toLowerCase();
  const displayName = normalizedEmail.split('@')[0] || 'e2e-admin';

  if (!adminUserId || !normalizedEmail) {
    throw new Error('An admin user id and email are required to seed a PulseCheck workspace fixture.');
  }

  await Promise.all([
    setDoc(
      doc(db, USERS_COLLECTION, adminUserId),
      {
        email: normalizedEmail,
        displayName,
        username: displayName.replace(/[^a-z0-9]+/g, ''),
        updatedAt: now,
      },
      { merge: true }
    ),
    setDoc(
      doc(db, PULSECHECK_ORGANIZATIONS_COLLECTION, fixture.organizationId),
      {
        displayName: fixture.organizationName,
        legalName: fixture.organizationName,
        organizationType: 'other',
        status: 'active',
        implementationOwnerUserId: adminUserId,
        implementationOwnerEmail: normalizedEmail,
        primaryCustomerAdminName: displayName,
        primaryCustomerAdminEmail: normalizedEmail,
        defaultStudyPosture: 'operational',
        defaultClinicianBridgeMode: 'none',
        createdAt: now,
        updatedAt: now,
      },
      { merge: true }
    ),
    setDoc(
      doc(db, PULSECHECK_TEAMS_COLLECTION, fixture.teamId),
      {
        organizationId: fixture.organizationId,
        displayName: fixture.teamName,
        teamType: 'other',
        sportOrProgram: 'E2E PulseCheck Workspace',
        defaultAdminName: displayName,
        defaultAdminEmail: normalizedEmail,
        status: 'active',
        defaultInvitePolicy: 'admin-staff-and-coaches',
        createdAt: now,
        updatedAt: now,
      },
      { merge: true }
    ),
    setDoc(
      doc(db, PULSECHECK_ORGANIZATION_MEMBERSHIPS_COLLECTION, `${fixture.organizationId}_${adminUserId}`),
      {
        organizationId: fixture.organizationId,
        userId: adminUserId,
        email: normalizedEmail,
        role: 'org-admin',
        status: 'active',
        grantedAt: now,
        createdAt: now,
        updatedAt: now,
      },
      { merge: true }
    ),
    setDoc(
      doc(db, PULSECHECK_TEAM_MEMBERSHIPS_COLLECTION, `${fixture.teamId}_${adminUserId}`),
      {
        organizationId: fixture.organizationId,
        teamId: fixture.teamId,
        userId: adminUserId,
        email: normalizedEmail,
        role: 'team-admin',
        title: 'Team Admin',
        permissionSetId: 'pulsecheck-team-admin-v1',
        rosterVisibilityScope: 'team',
        allowedAthleteIds: [],
        onboardingStatus: 'complete',
        postActivationCompletedAt: now,
        grantedAt: now,
        createdAt: now,
        updatedAt: now,
      },
      { merge: true }
    ),
  ]);

  return {
    ...fixture,
    adminUserId,
    adminEmail: normalizedEmail,
  };
}

async function seedPulseCheckPilotDashboardFixture(
  db: Firestore,
  input: {
    namespace: string;
    adminUserId: string;
    adminEmail: string;
    surveyResponses?: Array<{
      id?: string;
      respondentUserId: string;
      respondentRole: 'athlete' | 'coach' | 'clinician';
      surveyKind: 'trust' | 'nps';
      score: number;
      athleteId?: string | null;
      pilotEnrollmentId?: string | null;
      cohortId?: string | null;
      source?: 'ios' | 'android' | 'web-admin';
      submittedAt?: Date | number;
    }>;
  }
) {
  const fixture = buildPilotDashboardFixtureIds(input.namespace);
  const now = new Date();
  const nowMs = now.getTime();
  const pilotStart = new Date(nowMs - 1000 * 60 * 60 * 24 * 14);
  const pilotEnd = new Date(nowMs + 1000 * 60 * 60 * 24 * 21);
  const olderGeneratedAt = new Date(nowMs - 1000 * 60 * 60 * 24 * 4);
  const latestGeneratedAt = new Date(nowMs - 1000 * 60 * 60 * 3);
  const latestReviewedAt = new Date(nowMs - 1000 * 60 * 45);

  await cleanupPulseCheckPilotDashboardFixture(db, input).catch(() => undefined);
  await seedPulseCheckAdminWorkspaceFixture(db, `${input.namespace}-pilot-dashboard`, input.adminUserId, input.adminEmail);

  const athleteRecords = [
    {
      userId: fixture.athleteOneId,
      email: fixture.athleteOneEmail,
      displayName: fixture.athleteOneName,
      cohortId: fixture.cohortAlphaId,
      cohortName: fixture.cohortAlphaName,
      evidenceCount: 4,
      patternModels: [
        { id: 'pattern-sleep-floor', confidenceTier: 'stable', targetDomain: 'sim_performance', patternFamily: 'sleep_floor' },
        { id: 'pattern-hrv-window', confidenceTier: 'high_confidence', targetDomain: 'decision_quality', patternFamily: 'hrv_window' },
      ],
      projections: [
        { id: 'projection-profile', consumer: 'profile', warningLevel: 'watch' },
        { id: 'projection-coach', consumer: 'coach', warningLevel: 'none' },
      ],
    },
    {
      userId: fixture.athleteTwoId,
      email: fixture.athleteTwoEmail,
      displayName: fixture.athleteTwoName,
      cohortId: fixture.cohortAlphaId,
      cohortName: fixture.cohortAlphaName,
      evidenceCount: 2,
      patternModels: [
        { id: 'pattern-fatigue', confidenceTier: 'stable', targetDomain: 'focus_stability', patternFamily: 'fatigue_load' },
      ],
      projections: [{ id: 'projection-nora', consumer: 'nora', warningLevel: 'caution' }],
    },
    {
      userId: fixture.athleteThreeId,
      email: fixture.athleteThreeEmail,
      displayName: fixture.athleteThreeName,
      cohortId: fixture.cohortBetaId,
      cohortName: fixture.cohortBetaName,
      evidenceCount: 0,
      patternModels: [],
      projections: [],
    },
  ];

  await Promise.all(
    athleteRecords.map((athlete) =>
      setDoc(
        doc(db, USERS_COLLECTION, athlete.userId),
        {
          email: athlete.email,
          displayName: athlete.displayName,
          username: athlete.displayName.toLowerCase().replace(/[^a-z0-9]+/g, ''),
          role: 'athlete',
          createdAt: now,
          updatedAt: now,
        },
        { merge: true }
      )
    )
  );

  await setDoc(
    doc(db, PULSECHECK_PILOTS_COLLECTION, fixture.pilotId),
    {
      organizationId: fixture.organizationId,
      teamId: fixture.teamId,
      name: fixture.pilotName,
      objective: fixture.pilotObjective,
      status: 'active',
      studyMode: 'pilot',
      checkpointCadence: 'weekly',
      ownerInternalUserId: input.adminUserId,
      ownerInternalEmail: input.adminEmail.trim().toLowerCase(),
      startAt: pilotStart,
      endAt: pilotEnd,
      notes: 'E2E pilot dashboard fixture',
      createdAt: now,
      updatedAt: now,
    },
    { merge: true }
  );

  await Promise.all([
    setDoc(
      doc(db, PULSECHECK_PILOT_COHORTS_COLLECTION, fixture.cohortAlphaId),
      {
        organizationId: fixture.organizationId,
        teamId: fixture.teamId,
        pilotId: fixture.pilotId,
        name: fixture.cohortAlphaName,
        cohortType: 'training-group',
        assignmentRule: 'manual',
        reportingTags: ['alpha'],
        status: 'active',
        notes: 'Primary cohort for E2E pilot dashboard coverage.',
        createdAt: now,
        updatedAt: now,
      },
      { merge: true }
    ),
    setDoc(
      doc(db, PULSECHECK_PILOT_COHORTS_COLLECTION, fixture.cohortBetaId),
      {
        organizationId: fixture.organizationId,
        teamId: fixture.teamId,
        pilotId: fixture.pilotId,
        name: fixture.cohortBetaName,
        cohortType: 'comparison-group',
        assignmentRule: 'manual',
        reportingTags: ['beta'],
        status: 'active',
        notes: 'Secondary cohort for E2E pilot dashboard coverage.',
        createdAt: now,
        updatedAt: now,
      },
      { merge: true }
    ),
  ]);

  const surveyResponses = Array.isArray(input.surveyResponses) ? input.surveyResponses : [];
  const wholePilotSurveyDiagnostics = buildHarnessSurveyDiagnostics(surveyResponses);
  const surveyDiagnosticsByCohort = Object.fromEntries(
    uniqueStrings(surveyResponses.map((response) => response.cohortId || ''))
      .filter(Boolean)
      .map((cohortId) => [
        cohortId,
        buildHarnessSurveyDiagnostics(surveyResponses.filter((response) => response.cohortId === cohortId)),
      ])
  );
  const outcomeByCohort = Object.fromEntries(
    Object.entries(surveyDiagnosticsByCohort).map(([cohortId, diagnostics]) => [cohortId, buildHarnessOutcomeMetrics(diagnostics)])
  );
  const recommendationTypeSlices = buildHarnessRecommendationTypeSlices();
  const recommendationTypeSlicesByCohort = {
    [fixture.cohortAlphaId]: buildHarnessRecommendationTypeSlices('cohort-alpha'),
    [fixture.cohortBetaId]: buildHarnessRecommendationTypeSlices('cohort-beta'),
  };
  const operationalDiagnostics = buildHarnessOperationalDiagnostics();
  const trustDispositionBaseline = {
    averageScore: 6.9,
    responseCount: 3,
  };

  if (surveyResponses.length > 0) {
    await Promise.all(
      surveyResponses.map((response, index) =>
        setDoc(
          doc(db, PULSECHECK_PILOT_SURVEY_RESPONSES_COLLECTION, response.id || `${fixture.pilotId}-survey-${index + 1}`),
          {
            id: response.id || `${fixture.pilotId}-survey-${index + 1}`,
            pilotId: fixture.pilotId,
            pilotEnrollmentId: response.pilotEnrollmentId || null,
            organizationId: fixture.organizationId,
            teamId: fixture.teamId,
            cohortId: response.cohortId || null,
            respondentUserId: response.respondentUserId,
            respondentRole: response.respondentRole,
            athleteId: response.athleteId || null,
            surveyKind: response.surveyKind,
            score: response.score,
            source: response.source || 'web-admin',
            submittedAt: response.submittedAt || now,
            trustBattery: null,
          },
          { merge: true }
        )
      )
    );
  }

  await Promise.all([
    setDoc(
      doc(db, PULSECHECK_PILOT_OUTCOME_RELEASE_SETTINGS_COLLECTION, fixture.pilotId),
      {
        pilotId: fixture.pilotId,
        outcomesEnabled: true,
        rolloutStage: 'staged',
        rolloutNotes: 'Seeded E2E staged rollout state.',
        updatedAt: now,
        updatedByUserId: input.adminUserId,
        updatedByEmail: input.adminEmail.trim().toLowerCase(),
      },
      { merge: true }
    ),
    setDoc(
      doc(db, PULSECHECK_PILOT_METRIC_OPS_COLLECTION, fixture.pilotId),
      {
        pilotId: fixture.pilotId,
        updatedAt: now,
      },
      { merge: true }
    ),
    setDoc(
      doc(db, PULSECHECK_PILOT_METRIC_OPS_COLLECTION, fixture.pilotId, 'scopes', 'rollup_recompute'),
      {
        pilotId: fixture.pilotId,
        scope: 'rollup_recompute',
        status: 'succeeded',
        startedAt: new Date(nowMs - 1000 * 60 * 6),
        completedAt: new Date(nowMs - 1000 * 60 * 5),
        durationMs: 1100,
        lastError: null,
      },
      { merge: true }
    ),
    setDoc(
      doc(db, PULSECHECK_PILOT_METRIC_OPS_COLLECTION, fixture.pilotId, 'scopes', 'scheduled_rollup_repair'),
      {
        pilotId: fixture.pilotId,
        scope: 'scheduled_rollup_repair',
        status: 'succeeded',
        startedAt: new Date(nowMs - 1000 * 60 * 18),
        completedAt: new Date(nowMs - 1000 * 60 * 17),
        durationMs: 2200,
        lastError: null,
      },
      { merge: true }
    ),
    setDoc(
      doc(db, PULSECHECK_PILOT_METRIC_ROLLUPS_COLLECTION, fixture.pilotId),
      {
        id: fixture.pilotId,
        pilotId: fixture.pilotId,
        organizationId: fixture.organizationId,
        teamId: fixture.teamId,
        updatedAt: now,
        updatedAtMs: nowMs,
      },
      { merge: true }
    ),
    setDoc(
      doc(
        db,
        PULSECHECK_PILOT_METRIC_ROLLUPS_COLLECTION,
        fixture.pilotId,
        PULSECHECK_PILOT_METRIC_ROLLUP_SUMMARY_SUBCOLLECTION,
        'current'
      ),
      {
        pilotId: fixture.pilotId,
        organizationId: fixture.organizationId,
        teamId: fixture.teamId,
        cohortId: null,
        window: 'current',
        metrics: buildHarnessOutcomeMetrics(wholePilotSurveyDiagnostics),
          diagnostics: {
            surveys: wholePilotSurveyDiagnostics,
            surveysByCohort: surveyDiagnosticsByCohort,
            recommendationTypeSlices,
            recommendationTypeSlicesByCohort,
            trustDispositionBaseline,
            ...operationalDiagnostics,
          },
        outcomeByCohort,
        computedAt: now,
        computedAtMs: nowMs,
      },
      { merge: true }
    ),
  ]);

  await Promise.all(
    athleteRecords.flatMap((athlete) => {
      const teamMembershipId = `${fixture.teamId}_${athlete.userId}`;
      const enrollmentId = `${fixture.pilotId}_${athlete.userId}`;
      return [
        setDoc(
          doc(db, PULSECHECK_ORGANIZATION_MEMBERSHIPS_COLLECTION, `${fixture.organizationId}_${athlete.userId}`),
          {
            organizationId: fixture.organizationId,
            userId: athlete.userId,
            email: athlete.email,
            role: 'athlete',
            status: 'active',
            grantedAt: now,
            createdAt: now,
            updatedAt: now,
          },
          { merge: true }
        ),
        setDoc(
          doc(db, PULSECHECK_TEAM_MEMBERSHIPS_COLLECTION, teamMembershipId),
          {
            organizationId: fixture.organizationId,
            teamId: fixture.teamId,
            userId: athlete.userId,
            email: athlete.email,
            role: 'athlete',
            permissionSetId: 'pulsecheck-athlete-v1',
            rosterVisibilityScope: 'none',
            allowedAthleteIds: [],
            onboardingStatus: 'complete',
            athleteOnboarding: {
              productConsentAccepted: true,
              productConsentAcceptedAt: now,
              productConsentVersion: 'e2e-v1',
              researchConsentStatus: 'not-required',
              eligibleForResearchDataset: false,
              enrollmentMode: 'pilot',
              targetPilotId: fixture.pilotId,
              targetPilotName: fixture.pilotName,
              targetCohortId: athlete.cohortId,
              targetCohortName: athlete.cohortName,
              baselinePathStatus: 'complete',
              baselinePathwayId: 'pulsecheck-core-baseline-v1',
              entryOnboardingName: athlete.displayName,
            },
            createdAt: now,
            updatedAt: now,
          },
          { merge: true }
        ),
        setDoc(
          doc(db, PULSECHECK_PILOT_ENROLLMENTS_COLLECTION, enrollmentId),
          {
            organizationId: fixture.organizationId,
            teamId: fixture.teamId,
            pilotId: fixture.pilotId,
            cohortId: athlete.cohortId,
            userId: athlete.userId,
            teamMembershipId,
            studyMode: 'pilot',
            enrollmentMode: 'pilot',
            status: 'active',
            productConsentAccepted: true,
            productConsentAcceptedAt: now,
            productConsentVersion: 'e2e-v1',
            researchConsentStatus: 'not-required',
            eligibleForResearchDataset: false,
            createdAt: now,
            updatedAt: now,
          },
          { merge: true }
        ),
      ];
    })
  );

  await Promise.all([
    setDoc(
      doc(db, PULSECHECK_PILOT_HYPOTHESES_COLLECTION, fixture.hypothesisIds[0]),
      {
        pilotId: fixture.pilotId,
        code: 'H1',
        statement: 'Athletes with linked physiology and sim evidence will show more personalized guidance over time.',
        leadingIndicator: 'Percentage of athletes reaching meaningful engine coverage and stable pattern readiness within the pilot window.',
        status: 'promising',
        confidenceLevel: 'medium',
        keyEvidence: 'Two of three active pilot athletes already have engine coverage and stable patterns inside the frozen frame.',
        notes: 'Signal is directional, but still needs stronger outcome validation before stronger claims.',
        lastReviewedAt: now,
        createdAt: now,
        updatedAt: now,
      },
      { merge: true }
    ),
    setDoc(
      doc(db, PULSECHECK_PILOT_HYPOTHESES_COLLECTION, fixture.hypothesisIds[1]),
      {
        pilotId: fixture.pilotId,
        code: 'H2',
        statement: 'Stable correlation patterns will emerge for a meaningful share of athletes within the pilot window.',
        leadingIndicator: 'At least 30% of eligible athletes have one stable pattern by week 6.',
        status: 'mixed',
        confidenceLevel: 'medium',
        keyEvidence: 'Alpha cohort shows stable patterns, while beta cohort remains underpowered.',
        notes: 'Cohort imbalance is the main reason this remains mixed instead of promising.',
        lastReviewedAt: now,
        createdAt: now,
        updatedAt: now,
      },
      { merge: true }
    ),
    setDoc(
      doc(db, PULSECHECK_PILOT_HYPOTHESES_COLLECTION, fixture.hypothesisIds[2]),
      {
        pilotId: fixture.pilotId,
        code: 'H3',
        statement: 'Recommendations based on body-state-specific patterns will outperform generic recommendations.',
        leadingIndicator: 'Matched outcome delta between personalized and generic recommendation windows.',
        status: 'not-enough-data',
        confidenceLevel: 'low',
        keyEvidence: 'Outcome validation telemetry is not yet complete enough for stronger interpretation.',
        notes: 'Hold this in a not-enough-data posture until downstream validation joins are present.',
        lastReviewedAt: now,
        createdAt: now,
        updatedAt: now,
      },
      { merge: true }
    ),
  ]);

  await Promise.all(
    athleteRecords
      .filter((athlete) => athlete.evidenceCount > 0)
      .map(async (athlete, athleteIndex) => {
        await setDoc(
          doc(db, ATHLETE_PHYSIOLOGY_COGNITION_COLLECTION, athlete.userId),
          {
            athleteId: athlete.userId,
            engineVersion: 'e2e-v1',
            lastEvidenceAt: now,
            lastPatternRefreshAt: now,
            lastProjectionRefreshAt: now,
            lastEngineRefreshAt: now,
            activePatternKeys: athlete.patternModels.map((pattern) => pattern.id),
            activeProjectionKeys: athlete.projections.map((projection) => projection.id),
            createdAt: now,
            updatedAt: now,
          },
          { merge: true }
        );

        await Promise.all([
          ...Array.from({ length: athlete.evidenceCount }).map((_, index) =>
            setDoc(
              doc(
                db,
                ATHLETE_PHYSIOLOGY_COGNITION_COLLECTION,
                athlete.userId,
                CORRELATION_EVIDENCE_RECORDS_SUBCOLLECTION,
                `${athlete.userId}_evidence_${index + 1}`
              ),
              {
                athleteId: athlete.userId,
                evidenceKey: `${athlete.userId}_evidence_${index + 1}`,
                createdAt: new Date(nowMs - (athleteIndex + index + 1) * 1000 * 60 * 60),
                sourceDay: `2026-03-${`${10 + index}`.padStart(2, '0')}`,
              },
              { merge: true }
            )
          ),
          ...athlete.patternModels.map((pattern, index) =>
            setDoc(
              doc(
                db,
                ATHLETE_PHYSIOLOGY_COGNITION_COLLECTION,
                athlete.userId,
                ATHLETE_PATTERN_MODELS_SUBCOLLECTION,
                `${athlete.userId}_${pattern.id}`
              ),
              {
                athleteId: athlete.userId,
                patternKey: `${athlete.userId}_${pattern.id}`,
                confidenceTier: pattern.confidenceTier,
                targetDomain: pattern.targetDomain,
                patternFamily: pattern.patternFamily,
                confidenceScore: 0.72 + index * 0.08,
                updatedAt: new Date(nowMs - index * 1000 * 60 * 30),
                lastValidatedAt: new Date(nowMs - index * 1000 * 60 * 45),
              },
              { merge: true }
            )
          ),
          ...athlete.projections.map((projection, index) =>
            setDoc(
              doc(
                db,
                ATHLETE_PHYSIOLOGY_COGNITION_COLLECTION,
                athlete.userId,
                RECOMMENDATION_PROJECTIONS_SUBCOLLECTION,
                `${athlete.userId}_${projection.id}`
              ),
              {
                athleteId: athlete.userId,
                projectionKey: `${athlete.userId}_${projection.id}`,
                consumer: projection.consumer,
                projectionDate: '2026-03-20',
                warningLevel: projection.warningLevel,
                confidenceTier: index === 0 ? 'stable' : 'high_confidence',
                generatedAt: new Date(nowMs - index * 1000 * 60 * 20),
              },
              { merge: true }
            )
          ),
        ]);
      })
  );

  const sharedReadiness = [
    {
      gateKey: 'pilot-status',
      status: 'passed',
      summary: 'Pilot status active is eligible for readout generation.',
    },
    {
      gateKey: 'sample-size',
      status: 'passed',
      summary: 'Three active pilot athletes are included in this frozen frame.',
    },
    {
      gateKey: 'telemetry-completeness',
      status: 'passed',
      summary: 'Engine coverage is above the current V1 minimum for readout generation.',
    },
    {
      gateKey: 'freshness-telemetry',
      status: 'suppressed',
      summary: 'Freshness-sensitive claims should remain cautious because stale-data telemetry is still partially materialized in V1.',
    },
    {
      gateKey: 'denominator-availability',
      status: 'passed',
      summary: 'Pilot-scoped denominators are available for the selected frame.',
    },
  ];

  const makeSections = (summaryVariant: 'older' | 'latest') => [
    {
      sectionKey: 'pilot-summary',
      title: 'Pilot Summary',
      readinessStatus: 'ready',
      summary:
        summaryVariant === 'latest'
          ? 'This frozen frame suggests the pilot is learning meaningful structure for part of the active population, especially in the alpha cohort where engine coverage and stable patterns are already visible.'
          : 'The earlier frame showed directional learning, but the evidence was still concentrated in a smaller subset of the pilot population.',
      citations: [
        {
          blockKey: 'overview-metrics',
          blockLabel: 'Pilot Overview Metrics',
          hypothesisCodes: [],
          limitationKeys: ['freshness-telemetry'],
        },
      ],
      claims: [
        {
          claimKey: 'active-athletes',
          claimType: 'observed',
          statement: 'Three active pilot athletes were included in the frozen evidence frame.',
          denominatorLabel: 'active pilot athletes',
          denominatorValue: 3,
          evidenceSources: ['pilot overview metrics', 'pilot enrollment scope'],
          confidenceLevel: 'high',
          baselineMode: 'no-baseline',
          caveatFlag: false,
        },
      ],
      suggestedReviewerResolution: 'accepted',
    },
    {
      sectionKey: 'hypothesis-mapper',
      title: 'Hypothesis Mapper',
      readinessStatus: 'ready',
      summary:
        summaryVariant === 'latest'
          ? 'H1 looks directionally promising, H2 remains mixed because the beta cohort is still sparse, and H3 should stay in a not-enough-data posture until stronger outcome validation arrives.'
          : 'The earlier readout could only say H1 was directionally interesting while H2 and H3 still lacked enough structure for stronger posture changes.',
      citations: [
        {
          blockKey: 'hypothesis-governance',
          blockLabel: 'Pilot Hypotheses',
          hypothesisCodes: ['H1', 'H2', 'H3'],
          limitationKeys: ['freshness-telemetry'],
        },
      ],
      claims: [
        {
          claimKey: 'promising-hypothesis-count',
          claimType: 'observed',
          statement: 'One of three active pilot hypotheses is currently marked promising in the governed dashboard state.',
          denominatorLabel: 'pilot hypotheses',
          denominatorValue: 3,
          evidenceSources: ['manual hypothesis records'],
          confidenceLevel: 'medium',
          baselineMode: 'no-baseline',
          caveatFlag: true,
        },
      ],
      suggestedReviewerResolution: 'accepted',
    },
    {
      sectionKey: 'findings-interpreter',
      title: 'Findings Interpreter',
      readinessStatus: 'ready',
      summary:
        summaryVariant === 'latest'
          ? 'The most credible V1 interpretation is that the pilot is learning enough in one cohort to justify continued monitoring, but not enough across the whole pilot to generalize aggressively.'
          : 'The earlier frame suggested potential signal concentration in the alpha cohort, but the denominator was still too thin for stronger interpretation.',
      citations: [
        {
          blockKey: 'findings-layer',
          blockLabel: 'Pilot Findings',
          hypothesisCodes: ['H1', 'H2'],
          limitationKeys: ['freshness-telemetry'],
        },
      ],
      claims: [
        {
          claimKey: 'engine-coverage',
          claimType: 'observed',
          statement: 'Engine coverage is currently concentrated in two of the three active pilot athletes.',
          denominatorLabel: 'active pilot athletes',
          denominatorValue: 3,
          evidenceSources: ['engine coverage rate', 'stable pattern coverage'],
          confidenceLevel: 'medium',
          baselineMode: 'no-baseline',
          caveatFlag: true,
        },
      ],
      suggestedReviewerResolution: 'accepted',
    },
    {
      sectionKey: 'research-notes',
      title: 'Research Notes',
      readinessStatus: 'ready',
      summary:
        summaryVariant === 'latest'
          ? 'A plausible publishable-finding candidate is that stable pilot learning may emerge unevenly across cohorts before it becomes whole-pilot wide, but that candidate still needs stronger outcome validation and replication.'
          : 'The earlier frame suggested a possible finding around early cohort divergence, but it was too early to frame that as more than a directional candidate.',
      citations: [
        {
          blockKey: 'research-notes',
          blockLabel: 'Research Notes',
          hypothesisCodes: ['H1', 'H2'],
          limitationKeys: ['freshness-telemetry'],
        },
      ],
      claims: [
        {
          claimKey: 'candidate-finding',
          claimType: 'speculative',
          statement: 'Cohort-level differences in stable-pattern emergence may become a publishable candidate if stronger validation and replication continue to support the same direction.',
          denominatorLabel: 'active cohorts',
          denominatorValue: 2,
          evidenceSources: ['cohort rollup', 'stable pattern rate'],
          confidenceLevel: 'low',
          baselineMode: 'cross-cohort',
          caveatFlag: true,
        },
      ],
      suggestedReviewerResolution: 'carry-forward',
    },
    {
      sectionKey: 'limitations',
      title: 'Limitations',
      readinessStatus: 'ready',
      summary:
        'This frame still has meaningful limitations: one athlete lacks engine coverage, the beta cohort remains sparse, freshness telemetry is only partially materialized, and no stronger causal language should be used from this V1 evidence frame.',
      citations: [
        {
          blockKey: 'limitations',
          blockLabel: 'Readiness Gates',
          hypothesisCodes: [],
          limitationKeys: ['freshness-telemetry', 'sample-size'],
        },
      ],
      claims: [],
      suggestedReviewerResolution: 'accepted',
    },
  ];

  await Promise.all([
    setDoc(
      doc(db, PULSECHECK_PILOT_RESEARCH_READOUTS_COLLECTION, fixture.readoutIds[0]),
      {
        pilotId: fixture.pilotId,
        organizationId: fixture.organizationId,
        teamId: fixture.teamId,
        cohortId: '',
        dateWindowStart: '2026-03-01',
        dateWindowEnd: '2026-03-14',
        baselineMode: 'no-baseline',
        reviewState: 'approved',
        modelVersion: 'e2e-fixture-model',
        promptVersion: 'pilot-research-readout-v2',
        readModelVersion: 'pilot-dashboard-v1',
        readiness: sharedReadiness,
        sections: makeSections('older'),
        frozenEvidenceFrame: {
          pilotId: fixture.pilotId,
          cohortId: '',
          activeAthleteCount: 3,
          stablePatternRate: 66.7,
        },
        generatedAt: olderGeneratedAt,
        reviewedAt: new Date(olderGeneratedAt.getTime() + 1000 * 60 * 90),
        reviewedByUserId: input.adminUserId,
        reviewedByEmail: input.adminEmail.trim().toLowerCase(),
        createdAt: olderGeneratedAt,
        updatedAt: olderGeneratedAt,
      },
      { merge: true }
    ),
    setDoc(
      doc(db, PULSECHECK_PILOT_RESEARCH_READOUTS_COLLECTION, fixture.readoutIds[1]),
      {
        pilotId: fixture.pilotId,
        organizationId: fixture.organizationId,
        teamId: fixture.teamId,
        cohortId: '',
        dateWindowStart: '2026-03-08',
        dateWindowEnd: '2026-03-20',
        baselineMode: 'cross-cohort',
        reviewState: 'reviewed',
        modelVersion: 'e2e-fixture-model',
        promptVersion: 'pilot-research-readout-v2',
        readModelVersion: 'pilot-dashboard-v1',
        readiness: sharedReadiness,
        sections: makeSections('latest'),
        frozenEvidenceFrame: {
          pilotId: fixture.pilotId,
          cohortId: '',
          activeAthleteCount: 3,
          stablePatternRate: 66.7,
        },
        generatedAt: latestGeneratedAt,
        reviewedAt: latestReviewedAt,
        reviewedByUserId: input.adminUserId,
        reviewedByEmail: input.adminEmail.trim().toLowerCase(),
        createdAt: latestGeneratedAt,
        updatedAt: latestReviewedAt,
      },
      { merge: true }
    ),
  ]);

  return {
    namespace: fixture.namespace,
    organizationId: fixture.organizationId,
    teamId: fixture.teamId,
    pilotId: fixture.pilotId,
    pilotName: fixture.pilotName,
    cohortIds: [fixture.cohortAlphaId, fixture.cohortBetaId],
    athleteIds: athleteRecords.map((athlete) => athlete.userId),
    athleteNames: athleteRecords.map((athlete) => athlete.displayName),
    athleteEmails: athleteRecords.map((athlete) => athlete.email),
    readoutIds: fixture.readoutIds,
  };
}

async function cleanupPulseCheckPilotDashboardFixture(
  db: Firestore,
  input: {
    namespace: string;
    adminUserId: string;
  }
) {
  const fixture = buildPilotDashboardFixtureIds(input.namespace);
  const athleteIds = [fixture.athleteOneId, fixture.athleteTwoId, fixture.athleteThreeId];

  await Promise.all([
    deleteQueryDocs(db, PULSECHECK_PILOT_RESEARCH_READOUTS_COLLECTION, 'pilotId', fixture.pilotId),
    deleteQueryDocs(db, PULSECHECK_PILOT_HYPOTHESES_COLLECTION, 'pilotId', fixture.pilotId),
    deleteQueryDocs(db, PULSECHECK_PILOT_ENROLLMENTS_COLLECTION, 'pilotId', fixture.pilotId),
    deleteQueryDocs(db, PULSECHECK_PILOT_COHORTS_COLLECTION, 'pilotId', fixture.pilotId),
    deleteQueryDocs(db, PULSECHECK_PILOT_SURVEY_RESPONSES_COLLECTION, 'pilotId', fixture.pilotId),
    deleteDoc(doc(db, PULSECHECK_PILOT_METRIC_ROLLUPS_COLLECTION, fixture.pilotId, PULSECHECK_PILOT_METRIC_ROLLUP_SUMMARY_SUBCOLLECTION, 'current')).catch(() => undefined),
    deleteDoc(doc(db, PULSECHECK_PILOT_METRIC_ROLLUPS_COLLECTION, fixture.pilotId)).catch(() => undefined),
    deleteDoc(doc(db, PULSECHECK_PILOT_OUTCOME_RELEASE_SETTINGS_COLLECTION, fixture.pilotId)).catch(() => undefined),
    deleteDoc(doc(db, PULSECHECK_PILOT_METRIC_OPS_COLLECTION, fixture.pilotId, 'scopes', 'rollup_recompute')).catch(() => undefined),
    deleteDoc(doc(db, PULSECHECK_PILOT_METRIC_OPS_COLLECTION, fixture.pilotId, 'scopes', 'scheduled_rollup_repair')).catch(() => undefined),
    deleteDoc(doc(db, PULSECHECK_PILOT_METRIC_OPS_COLLECTION, fixture.pilotId)).catch(() => undefined),
  ]);

  await Promise.all(
    athleteIds.flatMap((athleteId) => [
      deleteNestedDocsByParent(db, ATHLETE_PHYSIOLOGY_COGNITION_COLLECTION, athleteId, CORRELATION_EVIDENCE_RECORDS_SUBCOLLECTION),
      deleteNestedDocsByParent(db, ATHLETE_PHYSIOLOGY_COGNITION_COLLECTION, athleteId, ATHLETE_PATTERN_MODELS_SUBCOLLECTION),
      deleteNestedDocsByParent(db, ATHLETE_PHYSIOLOGY_COGNITION_COLLECTION, athleteId, RECOMMENDATION_PROJECTIONS_SUBCOLLECTION),
    ])
  );

  await Promise.all([
    deleteDoc(doc(db, PULSECHECK_PILOTS_COLLECTION, fixture.pilotId)).catch(() => undefined),
    deleteDoc(doc(db, PULSECHECK_PILOT_COHORTS_COLLECTION, fixture.cohortAlphaId)).catch(() => undefined),
    deleteDoc(doc(db, PULSECHECK_PILOT_COHORTS_COLLECTION, fixture.cohortBetaId)).catch(() => undefined),
    ...athleteIds.flatMap((athleteId) => [
      deleteDoc(doc(db, ATHLETE_PHYSIOLOGY_COGNITION_COLLECTION, athleteId)).catch(() => undefined),
      deleteDoc(doc(db, PULSECHECK_TEAM_MEMBERSHIPS_COLLECTION, `${fixture.teamId}_${athleteId}`)).catch(() => undefined),
      deleteDoc(doc(db, PULSECHECK_ORGANIZATION_MEMBERSHIPS_COLLECTION, `${fixture.organizationId}_${athleteId}`)).catch(() => undefined),
      deleteDoc(doc(db, USERS_COLLECTION, athleteId)).catch(() => undefined),
    ]),
    deleteDoc(doc(db, PULSECHECK_TEAM_MEMBERSHIPS_COLLECTION, `${fixture.teamId}_${input.adminUserId}`)).catch(() => undefined),
    deleteDoc(doc(db, PULSECHECK_ORGANIZATION_MEMBERSHIPS_COLLECTION, `${fixture.organizationId}_${input.adminUserId}`)).catch(() => undefined),
    deleteDoc(doc(db, PULSECHECK_TEAMS_COLLECTION, fixture.teamId)).catch(() => undefined),
    deleteDoc(doc(db, PULSECHECK_ORGANIZATIONS_COLLECTION, fixture.organizationId)).catch(() => undefined),
  ]);

  return {
    namespace: fixture.namespace,
    organizationId: fixture.organizationId,
    teamId: fixture.teamId,
    pilotId: fixture.pilotId,
    athleteIds,
  };
}

async function cleanupLegacyCoachRosterFixtures(db: Firestore, namespace: string) {
  const fixture = buildLegacyRosterFixtureIds(namespace);
  const teamMembershipsToDelete = new Set<string>();
  const organizationMembershipsToDelete = new Set<string>();
  const teamIdsToDelete = new Set<string>([fixture.existingTeamId]);
  const organizationIdsToDelete = new Set<string>([fixture.existingOrganizationId]);

  const [legacyTeamsSnap, legacyOrganizationsSnap, legacyMembershipsSnap, migrationSnap] = await Promise.all([
    getDocs(query(collection(db, PULSECHECK_TEAMS_COLLECTION), where('legacyCoachId', '==', fixture.coachId))),
    getDocs(query(collection(db, PULSECHECK_ORGANIZATIONS_COLLECTION), where('legacyCoachId', '==', fixture.coachId))),
    getDocs(query(collection(db, PULSECHECK_TEAM_MEMBERSHIPS_COLLECTION), where('legacyCoachId', '==', fixture.coachId))),
    getDocs(query(collection(db, PULSECHECK_LEGACY_MIGRATIONS_COLLECTION), where('coachId', '==', fixture.coachId))),
  ]);

  legacyTeamsSnap.docs.forEach((entry) => teamIdsToDelete.add(entry.id));
  legacyOrganizationsSnap.docs.forEach((entry) => organizationIdsToDelete.add(entry.id));
  legacyMembershipsSnap.docs.forEach((entry) => teamMembershipsToDelete.add(entry.id));

  for (const teamId of teamIdsToDelete) {
    if (!teamId) continue;
    teamMembershipsToDelete.add(`${teamId}_${fixture.coachId}`);
    teamMembershipsToDelete.add(`${teamId}_${fixture.athleteOneId}`);
    teamMembershipsToDelete.add(`${teamId}_${fixture.athleteTwoId}`);
  }

  for (const organizationId of organizationIdsToDelete) {
    if (!organizationId) continue;
    organizationMembershipsToDelete.add(`${organizationId}_${fixture.coachId}`);
  }

  await Promise.all([
    ...Array.from(teamMembershipsToDelete).map(async (id) => {
      const ref = doc(db, PULSECHECK_TEAM_MEMBERSHIPS_COLLECTION, id);
      const snap = await getDoc(ref);
      if (snap.exists()) await deleteDoc(ref);
    }),
    ...Array.from(organizationMembershipsToDelete).map(async (id) => {
      const ref = doc(db, PULSECHECK_ORGANIZATION_MEMBERSHIPS_COLLECTION, id);
      const snap = await getDoc(ref);
      if (snap.exists()) await deleteDoc(ref);
    }),
    ...legacyTeamsSnap.docs.map((entry) => deleteDoc(entry.ref)),
    ...legacyOrganizationsSnap.docs.map((entry) => deleteDoc(entry.ref)),
    ...migrationSnap.docs.map((entry) => deleteDoc(entry.ref)),
  ]);

  await Promise.all([
    ...Array.from(teamIdsToDelete).map(async (id) => {
      const ref = doc(db, PULSECHECK_TEAMS_COLLECTION, id);
      const snap = await getDoc(ref);
      if (snap.exists()) await deleteDoc(ref);
    }),
    ...Array.from(organizationIdsToDelete).map(async (id) => {
      const ref = doc(db, PULSECHECK_ORGANIZATIONS_COLLECTION, id);
      const snap = await getDoc(ref);
      if (snap.exists()) await deleteDoc(ref);
    }),
  ]);

  await Promise.all([
    deleteDoc(doc(db, COACH_ATHLETES_COLLECTION, fixture.connectionOneId)).catch(() => undefined),
    deleteDoc(doc(db, COACH_ATHLETES_COLLECTION, fixture.connectionTwoId)).catch(() => undefined),
    deleteDoc(doc(db, COACH_REFERRALS_COLLECTION, `${fixture.coachId}_${fixture.athleteOneId}`)).catch(() => undefined),
    deleteDoc(doc(db, COACH_REFERRALS_COLLECTION, `${fixture.coachId}_${fixture.athleteTwoId}`)).catch(() => undefined),
    deleteDoc(doc(db, COACHES_COLLECTION, fixture.coachId)).catch(() => undefined),
    deleteDoc(doc(db, USERS_COLLECTION, fixture.coachId)).catch(() => undefined),
    deleteDoc(doc(db, USERS_COLLECTION, fixture.athleteOneId)).catch(() => undefined),
    deleteDoc(doc(db, USERS_COLLECTION, fixture.athleteTwoId)).catch(() => undefined),
  ]);

  return {
    namespace: fixture.namespace,
    coachId: fixture.coachId,
    deletedTeams: Array.from(teamIdsToDelete).filter(Boolean).length,
    deletedOrganizations: Array.from(organizationIdsToDelete).filter(Boolean).length,
    deletedTeamMemberships: Array.from(teamMembershipsToDelete).filter(Boolean).length,
  };
}

async function inspectLegacyCoachRosterFixture(db: Firestore, namespace: string) {
  const fixture = buildLegacyRosterFixtureIds(namespace);
  const [legacyTeamsSnap, legacyOrganizationsSnap, legacyMembershipsSnap, migrationSnap] = await Promise.all([
    getDocs(query(collection(db, PULSECHECK_TEAMS_COLLECTION), where('legacyCoachId', '==', fixture.coachId))),
    getDocs(query(collection(db, PULSECHECK_ORGANIZATIONS_COLLECTION), where('legacyCoachId', '==', fixture.coachId))),
    getDocs(query(collection(db, PULSECHECK_TEAM_MEMBERSHIPS_COLLECTION), where('legacyCoachId', '==', fixture.coachId))),
    getDocs(query(collection(db, PULSECHECK_LEGACY_MIGRATIONS_COLLECTION), where('coachId', '==', fixture.coachId))),
  ]);

  const explicitDocs = await Promise.all([
    getDoc(doc(db, PULSECHECK_ORGANIZATIONS_COLLECTION, fixture.existingOrganizationId)),
    getDoc(doc(db, PULSECHECK_TEAMS_COLLECTION, fixture.existingTeamId)),
    getDoc(doc(db, PULSECHECK_TEAM_MEMBERSHIPS_COLLECTION, `${fixture.existingTeamId}_${fixture.coachId}`)),
    getDoc(doc(db, PULSECHECK_TEAM_MEMBERSHIPS_COLLECTION, `${fixture.existingTeamId}_${fixture.athleteOneId}`)),
    getDoc(doc(db, PULSECHECK_TEAM_MEMBERSHIPS_COLLECTION, `${fixture.existingTeamId}_${fixture.athleteTwoId}`)),
  ]);

  return {
    fixture,
    legacyOrganizations: legacyOrganizationsSnap.docs.map((entry) => ({ id: entry.id, ...entry.data() })),
    legacyTeams: legacyTeamsSnap.docs.map((entry) => ({ id: entry.id, ...entry.data() })),
    legacyAthleteMemberships: legacyMembershipsSnap.docs.map((entry) => ({ id: entry.id, ...entry.data() })),
    migrationEntries: migrationSnap.docs.map((entry) => ({ id: entry.id, ...entry.data() })),
    explicitExistingOrganization: explicitDocs[0].exists() ? { id: explicitDocs[0].id, ...explicitDocs[0].data() } : null,
    explicitExistingTeam: explicitDocs[1].exists() ? { id: explicitDocs[1].id, ...explicitDocs[1].data() } : null,
    explicitCoachMembership: explicitDocs[2].exists() ? { id: explicitDocs[2].id, ...explicitDocs[2].data() } : null,
    explicitAthleteOneMembership: explicitDocs[3].exists() ? { id: explicitDocs[3].id, ...explicitDocs[3].data() } : null,
    explicitAthleteTwoMembership: explicitDocs[4].exists() ? { id: explicitDocs[4].id, ...explicitDocs[4].data() } : null,
  };
}

async function deleteNestedDocsByParent(
  db: Firestore,
  parentCollection: string,
  parentId: string,
  nestedCollection: string
) {
  const nestedSnap = await getDocs(collection(db, parentCollection, parentId, nestedCollection));
  await Promise.all(nestedSnap.docs.map((entry) => deleteDoc(entry.ref).catch(() => undefined)));
}

async function deleteQueryDocs(
  db: Firestore,
  collectionName: string,
  fieldName: string,
  value: string
) {
  const snap = await getDocs(query(collection(db, collectionName), where(fieldName, '==', value)));
  await Promise.all(snap.docs.map((entry) => deleteDoc(entry.ref).catch(() => undefined)));
}

async function seedPulseCheckAthleteJourneyFixture(
  db: Firestore,
  input: {
    namespace: string;
    adminUserId: string;
    adminEmail: string;
    coachUserId: string;
    coachEmail: string;
    athleteUserId: string;
    athleteEmail: string;
  }
) {
  const fixture = buildAthleteJourneyFixtureIds(input.namespace);
  const now = Date.now();

  if (!input.adminUserId || !input.adminEmail || !input.coachUserId || !input.coachEmail || !input.athleteUserId || !input.athleteEmail) {
    throw new Error('Admin, coach, and athlete ids/emails are required to seed the PulseCheck athlete journey fixture.');
  }

  await seedPulseCheckAdminWorkspaceFixture(db, `${input.namespace}-journey`, input.adminUserId, input.adminEmail);
  await simModuleLibraryService.seedExercises().catch(() => undefined);

  const normalizedCoachEmail = input.coachEmail.trim().toLowerCase();
  const normalizedAthleteEmail = input.athleteEmail.trim().toLowerCase();
  const [existingCoachUserSnap, existingAthleteUserSnap] = await Promise.all([
    getDoc(doc(db, USERS_COLLECTION, input.coachUserId)),
    getDoc(doc(db, USERS_COLLECTION, input.athleteUserId)),
  ]);
  const coachDisplayName =
    (existingCoachUserSnap.exists() ? existingCoachUserSnap.data()?.displayName || existingCoachUserSnap.data()?.username : null) ||
    normalizedCoachEmail.split('@')[0] ||
    'pulse-coach';
  const athleteDisplayName =
    (existingAthleteUserSnap.exists() ? existingAthleteUserSnap.data()?.displayName || existingAthleteUserSnap.data()?.username : null) ||
    normalizedAthleteEmail.split('@')[0] ||
    'pulse-athlete';

  await Promise.all([
    setDoc(
      doc(db, USERS_COLLECTION, input.coachUserId),
      {
        email: normalizedCoachEmail,
        displayName: coachDisplayName,
        username: coachDisplayName.replace(/[^a-z0-9]+/g, ''),
        activeCoachAccount: true,
        role: 'coach',
        updatedAt: now,
      },
      { merge: true }
    ),
    setDoc(
      doc(db, USERS_COLLECTION, input.athleteUserId),
      {
        email: normalizedAthleteEmail,
        displayName: athleteDisplayName,
        username: athleteDisplayName.replace(/[^a-z0-9]+/g, ''),
        role: 'athlete',
        linkedCoachId: input.coachUserId,
        updatedAt: now,
      },
      { merge: true }
    ),
    setDoc(
      doc(db, COACHES_COLLECTION, input.coachUserId),
      {
        userId: input.coachUserId,
        email: normalizedCoachEmail,
        username: coachDisplayName,
        referralCode: fixture.referralCode,
        subscriptionStatus: 'partner',
        userType: 'partner',
        earningsAccess: true,
        createdAt: now,
        updatedAt: now,
      },
      { merge: true }
    ),
    setDoc(
      doc(db, REFERRAL_CODE_LOOKUP_COLLECTION, fixture.referralCode),
      {
        referralCode: fixture.referralCode,
        coachId: input.coachUserId,
        createdAt: now,
        updatedAt: now,
      },
      { merge: true }
    ),
    setDoc(
      doc(db, COACH_ATHLETES_COLLECTION, fixture.coachAthleteLinkId),
      {
        coachId: input.coachUserId,
        athleteUserId: input.athleteUserId,
        status: 'active',
        linkedAt: now,
        updatedAt: now,
      },
      { merge: true }
    ),
    setDoc(
      doc(db, COACH_REFERRALS_COLLECTION, `${input.coachUserId}_${input.athleteUserId}`),
      {
        referrerCoachId: input.coachUserId,
        referredCoachId: input.athleteUserId,
        referredCoachEmail: normalizedAthleteEmail,
        referralCode: fixture.referralCode,
        createdAt: now,
        updatedAt: now,
      },
      { merge: true }
    ),
    setDoc(
      doc(db, PULSECHECK_TEAM_MEMBERSHIPS_COLLECTION, `${fixture.teamId}_${input.coachUserId}`),
      {
        organizationId: fixture.organizationId,
        teamId: fixture.teamId,
        userId: input.coachUserId,
        email: normalizedCoachEmail,
        role: 'coach',
        title: 'Coach',
        permissionSetId: 'pulsecheck-coach-v1',
        rosterVisibilityScope: 'team',
        allowedAthleteIds: [],
        onboardingStatus: 'complete',
        grantedAt: now,
        createdAt: now,
        updatedAt: now,
      },
      { merge: true }
    ),
    setDoc(
      doc(db, PULSECHECK_TEAM_MEMBERSHIPS_COLLECTION, `${fixture.teamId}_${input.athleteUserId}`),
      {
        organizationId: fixture.organizationId,
        teamId: fixture.teamId,
        userId: input.athleteUserId,
        email: normalizedAthleteEmail,
        role: 'athlete',
        permissionSetId: 'pulsecheck-athlete-v1',
        rosterVisibilityScope: 'none',
        allowedAthleteIds: [],
        onboardingStatus: 'complete',
        legacyCoachId: input.coachUserId,
        athleteOnboarding: {
          productConsentAccepted: true,
          productConsentAcceptedAt: now,
          productConsentVersion: 'e2e-v1',
          researchConsentStatus: 'not-required',
          eligibleForResearchDataset: false,
          enrollmentMode: 'product-only',
          targetPilotId: '',
          targetPilotName: '',
          targetCohortId: '',
          targetCohortName: '',
          baselinePathStatus: 'complete',
          baselinePathwayId: 'pulsecheck-core-baseline-v1',
        },
        createdAt: now,
        updatedAt: now,
      },
      { merge: true }
    ),
  ]);

  await athleteProgressService.initialize(input.athleteUserId, input.coachUserId);
  const progress = await athleteProgressService.saveBaselineAssessment(input.athleteUserId, {
    mentalTrainingExperience: 'self_tried',
    currentPracticeFrequency: 'weekly',
    arousalControlRating: 2,
    focusRating: 3,
    confidenceRating: 3,
    visualizationRating: 2,
    resilienceRating: 3,
    pressureResponse: 'anxious_push_through',
    setbackRecovery: 'struggle_same_day',
    biggestChallenge: BiggestChallenge.PreCompetitionAnxiety,
  });

  await setDoc(
    doc(db, ATHLETE_MENTAL_PROGRESS_COLLECTION, input.athleteUserId),
    {
      coachId: input.coachUserId,
      assessmentNeeded: false,
      updatedAt: Date.now(),
    },
    { merge: true }
  );

  return {
    ...fixture,
    athleteUserId: input.athleteUserId,
    athleteEmail: normalizedAthleteEmail,
    coachUserId: input.coachUserId,
    coachEmail: normalizedCoachEmail,
    activeProgram: progress.activeProgram,
  };
}

async function cleanupPulseCheckAthleteJourneyFixture(
  db: Firestore,
  input: {
    namespace: string;
    athleteUserId: string;
    coachUserId: string;
  }
) {
  const fixture = buildAthleteJourneyFixtureIds(input.namespace);

  await Promise.all([
    deleteNestedDocsByParent(db, SIM_CHECKINS_ROOT, input.athleteUserId, 'check-ins'),
    deleteNestedDocsByParent(db, SIM_COMPLETIONS_ROOT, input.athleteUserId, 'completions'),
    deleteQueryDocs(db, PULSECHECK_DAILY_ASSIGNMENTS_COLLECTION, 'athleteId', input.athleteUserId),
    deleteQueryDocs(db, PULSECHECK_ASSIGNMENT_CANDIDATE_SETS_COLLECTION, 'athleteId', input.athleteUserId),
    deleteQueryDocs(db, PULSECHECK_ASSIGNMENT_EVENTS_COLLECTION, 'athleteId', input.athleteUserId),
    deleteQueryDocs(db, PULSECHECK_STATE_SNAPSHOTS_COLLECTION, 'athleteId', input.athleteUserId),
    deleteQueryDocs(db, PULSECHECK_TRAINING_PLANS_COLLECTION, 'athleteId', input.athleteUserId),
    deleteQueryDocs(db, COACH_NOTIFICATIONS_COLLECTION, 'coachId', input.coachUserId),
  ]);

  const protocolIds = await listPrefixedDocIds(db, PULSECHECK_PROTOCOLS_COLLECTION, buildPrefix(input.namespace));
  await Promise.all(protocolIds.map((id) => deleteDoc(doc(db, PULSECHECK_PROTOCOLS_COLLECTION, id)).catch(() => undefined)));

  await Promise.all([
    deleteDoc(doc(db, PULSECHECK_PROTOCOL_RESPONSIVENESS_PROFILES_COLLECTION, input.athleteUserId)).catch(() => undefined),
    deleteDoc(doc(db, ATHLETE_MENTAL_PROGRESS_COLLECTION, input.athleteUserId)).catch(() => undefined),
    deleteDoc(doc(db, COACH_ATHLETES_COLLECTION, fixture.coachAthleteLinkId)).catch(() => undefined),
    deleteDoc(doc(db, COACH_REFERRALS_COLLECTION, `${input.coachUserId}_${input.athleteUserId}`)).catch(() => undefined),
    deleteDoc(doc(db, REFERRAL_CODE_LOOKUP_COLLECTION, fixture.referralCode)).catch(() => undefined),
    deleteDoc(doc(db, PULSECHECK_TEAM_MEMBERSHIPS_COLLECTION, `${fixture.teamId}_${input.coachUserId}`)).catch(() => undefined),
    deleteDoc(doc(db, PULSECHECK_TEAM_MEMBERSHIPS_COLLECTION, `${fixture.teamId}_${input.athleteUserId}`)).catch(() => undefined),
    deleteDoc(doc(db, PULSECHECK_ORGANIZATION_MEMBERSHIPS_COLLECTION, `${fixture.organizationId}_${input.coachUserId}`)).catch(() => undefined),
    deleteDoc(doc(db, PULSECHECK_ORGANIZATION_MEMBERSHIPS_COLLECTION, `${fixture.organizationId}_${input.athleteUserId}`)).catch(() => undefined),
    deleteDoc(doc(db, PULSECHECK_TEAMS_COLLECTION, fixture.teamId)).catch(() => undefined),
    deleteDoc(doc(db, PULSECHECK_ORGANIZATIONS_COLLECTION, fixture.organizationId)).catch(() => undefined),
  ]);

  return {
    namespace: fixture.namespace,
    athleteUserId: input.athleteUserId,
    coachUserId: input.coachUserId,
  };
}

async function inspectPulseCheckAthleteJourneyState(
  db: Firestore,
  input: {
    athleteUserId: string;
    coachUserId: string;
  }
) {
  const [progressSnap, latestAssignment, latestCompletion, latestCheckIns, coachNotificationsSnap, trainingPlansSnap, assignmentEventsSnap] = await Promise.all([
    getDoc(doc(db, ATHLETE_MENTAL_PROGRESS_COLLECTION, input.athleteUserId)),
    assignmentOrchestratorService.getLatestForAthlete(input.athleteUserId),
    completionService.getLatestCompletion(input.athleteUserId),
    completionService.getCheckIns(input.athleteUserId, 3),
    getDocs(query(collection(db, COACH_NOTIFICATIONS_COLLECTION), where('coachId', '==', input.coachUserId))),
    getDocs(query(collection(db, PULSECHECK_TRAINING_PLANS_COLLECTION), where('athleteId', '==', input.athleteUserId))),
    getDocs(query(collection(db, PULSECHECK_ASSIGNMENT_EVENTS_COLLECTION), where('athleteId', '==', input.athleteUserId))),
  ]);

  const [stateSnapshotSnap, candidateSetSnap, responsivenessProfileSnap] = await Promise.all([
    latestAssignment?.sourceStateSnapshotId
      ? getDoc(doc(db, PULSECHECK_STATE_SNAPSHOTS_COLLECTION, latestAssignment.sourceStateSnapshotId))
      : getDoc(doc(db, PULSECHECK_STATE_SNAPSHOTS_COLLECTION, `${input.athleteUserId}_${latestAssignment?.sourceDate || ''}`)),
    latestAssignment?.sourceCandidateSetId
      ? getDoc(doc(db, PULSECHECK_ASSIGNMENT_CANDIDATE_SETS_COLLECTION, latestAssignment.sourceCandidateSetId))
      : getDoc(doc(db, PULSECHECK_ASSIGNMENT_CANDIDATE_SETS_COLLECTION, `${input.athleteUserId}_${latestAssignment?.sourceDate || ''}_candidates`)),
    getDoc(doc(db, PULSECHECK_PROTOCOL_RESPONSIVENESS_PROFILES_COLLECTION, input.athleteUserId)),
  ]);

  const coachNotifications = coachNotificationsSnap.docs
    .map((entry) => ({ id: entry.id, ...(entry.data() as Record<string, any>) }) as Record<string, any> & { id: string })
    .sort((left, right) => (Number(right.createdAt) || 0) - (Number(left.createdAt) || 0));
  const trainingPlans = trainingPlansSnap.docs
    .map((entry) => ({ id: entry.id, ...(entry.data() as Record<string, any>) }) as Record<string, any> & { id: string })
    .sort(sortPlansByFreshness);
  const assignmentEvents = assignmentEventsSnap.docs
    .map((entry) => ({ id: entry.id, ...(entry.data() as Record<string, any>) }) as Record<string, any> & { id: string })
    .sort(sortEventsByFreshness);
  const trainingPlanEvents = assignmentEvents.filter((event) =>
    Boolean(event.trainingPlanId)
    || String(event.eventType || '').startsWith('training_plan_')
    || String(event.eventType || '').startsWith('plan_step_')
  );

  return {
    athleteProgress: progressSnap.exists() ? { id: progressSnap.id, ...progressSnap.data() } : null,
    latestAssignment,
    latestStateSnapshot: stateSnapshotSnap.exists() ? { id: stateSnapshotSnap.id, ...stateSnapshotSnap.data() } : null,
    latestCandidateSet: candidateSetSnap.exists() ? { id: candidateSetSnap.id, ...candidateSetSnap.data() } : null,
    responsivenessProfile: responsivenessProfileSnap.exists() ? { id: responsivenessProfileSnap.id, ...responsivenessProfileSnap.data() } : null,
    trainingPlans,
    latestTrainingPlan: trainingPlans.find((plan) => plan.isPrimary) || trainingPlans[0] || null,
    recentTrainingPlanEvents: trainingPlanEvents.slice(0, 12),
    recentAssignmentEvents: assignmentEvents.slice(0, 12),
    latestCompletion,
    recentCheckIns: latestCheckIns,
    coachNotifications,
  };
}

async function listPublishedProtocolRuntimeRecords(
  db: Firestore,
  protocolClass?: 'priming' | 'regulation' | 'recovery' | 'none'
): Promise<Array<Record<string, any>>> {
  const snapshot = await getDocsFromServer(collection(db, PULSECHECK_PROTOCOLS_COLLECTION)).catch(() =>
    getDocs(collection(db, PULSECHECK_PROTOCOLS_COLLECTION))
  );
  const firestoreRecords: Array<Record<string, any>> = snapshot.docs
    .map((entry) => ({ id: entry.id, ...(entry.data() as Record<string, any>) }) as Record<string, any>)
    .filter((record) => record.publishStatus === 'published' && record.isActive !== false);

  const records: Array<Record<string, any>> = firestoreRecords.length > 0
    ? firestoreRecords
    : await protocolRegistryService.list() as Array<Record<string, any>>;
  return records.filter((record) =>
    protocolClass && protocolClass !== 'none' ? record.protocolClass === protocolClass : true
  );
}

function deriveLocalPolicyTags(
  snapshot: Record<string, any>,
  checkIn: {
    energyLevel?: number;
    stressLevel?: number;
    sleepQuality?: number;
    moodWord?: string;
  }
) {
  const tags = new Set<string>((snapshot?.contextTags || []).map((value: string) => normalizeTag(value)).filter(Boolean));
  const sessionType = normalizeTag(snapshot?.programSnapshot?.sessionType || snapshot?.rawSignalSummary?.activeProgramContext?.sessionType);
  const durationMode = normalizeTag(snapshot?.programSnapshot?.durationMode || snapshot?.rawSignalSummary?.activeProgramContext?.durationMode);
  const protocolClass = normalizeTag(snapshot?.recommendedProtocolClass);

  if (sessionType) tags.add(sessionType);
  if (durationMode) tags.add(durationMode);
  if (protocolClass) tags.add(protocolClass);
  if (snapshot?.recommendedRouting) tags.add(normalizeTag(snapshot.recommendedRouting));
  if (snapshot?.overallReadiness) tags.add(`${normalizeTag(snapshot.overallReadiness)}_snapshot`);

  if (sessionType === 'training_rep') {
    ['pre_training', 'pre_technical_work', 'pre_rep_prep'].forEach((tag) => tags.add(tag));
  }

  if (sessionType === 'recovery_rep') {
    ['recovery_day', 'post_load', 'post_competition'].forEach((tag) => tags.add(tag));
  }

  if (protocolClass === 'priming') {
    ['pre_training', 'pre_rep_prep'].forEach((tag) => tags.add(tag));
  }

  if (protocolClass === 'recovery') {
    ['recovery_day', 'post_load'].forEach((tag) => tags.add(tag));
  }

  if (typeof checkIn.energyLevel === 'number' && checkIn.energyLevel <= 2) {
    ['low_energy', 'flatness', 'underactivation', 'slow_start'].forEach((tag) => tags.add(tag));
  }

  if (typeof checkIn.stressLevel === 'number' && checkIn.stressLevel >= 4) {
    ['acute_stress', 'anxiety', 'pressure_spike', 'mental_noise'].forEach((tag) => tags.add(tag));
  }

  if (typeof checkIn.sleepQuality === 'number' && checkIn.sleepQuality <= 2) {
    ['sleep_sensitive', 'heavy_fatigue', 'cognitive_depletion'].forEach((tag) => tags.add(tag));
  }

  if (typeof checkIn.moodWord === 'string' && checkIn.moodWord.trim()) {
    tags.add(normalizeTag(checkIn.moodWord));
  }

  return Array.from(tags);
}

async function submitPulseCheckCheckInViaHarness(
  db: Firestore,
  input: {
    userId: string;
    type: string;
    readinessScore: number;
    moodWord?: string;
    energyLevel?: number;
    stressLevel?: number;
    sleepQuality?: number;
    notes?: string;
    taxonomyState?: Record<string, any>;
    sourceDate?: string;
    protocolRuntimeOverrides?: Array<Record<string, any>>;
  }
) {
  const athleteId = input.userId;
  const now = Date.now();
  const sourceDate = input.sourceDate || new Date().toISOString().split('T')[0];
  const checkInId = `${athleteId}_${sourceDate}_${now}`;
  const checkIn = {
    id: checkInId,
    userId: athleteId,
    type: (input.type as CheckInType) || CheckInType.Morning,
    readinessScore: input.readinessScore,
    moodWord: input.moodWord,
    energyLevel: input.energyLevel,
    stressLevel: input.stressLevel,
    sleepQuality: input.sleepQuality,
    notes: input.notes,
    taxonomyState: input.taxonomyState as any,
    createdAt: now,
    date: sourceDate,
  };

  await setDoc(
    doc(db, SIM_CHECKINS_ROOT, athleteId, 'check-ins', checkInId),
    checkInToFirestore(checkIn),
    { merge: true }
  );

  const progress = await athleteProgressService.get(athleteId);
  let snapshot = await stateSnapshotService.upsertFromCheckIn({
    athleteId,
    checkIn,
    progress,
  });

  if (snapshot.recommendedRouting === 'protocol_then_sim' && (!snapshot.recommendedProtocolClass || snapshot.recommendedProtocolClass === 'none')) {
    snapshot = {
      ...snapshot,
      recommendedProtocolClass: 'priming',
      updatedAt: Date.now(),
    };
    await setDoc(
      doc(db, PULSECHECK_STATE_SNAPSHOTS_COLLECTION, snapshot.id),
      pulseCheckStateSnapshotToFirestore(snapshot),
      { merge: true }
    );
  }

  const protocolClass = snapshot.recommendedProtocolClass && snapshot.recommendedProtocolClass !== 'none'
    ? snapshot.recommendedProtocolClass
    : undefined;
  const allProtocolRecords = Array.isArray(input.protocolRuntimeOverrides)
    ? input.protocolRuntimeOverrides
    : await listPublishedProtocolRuntimeRecords(db, protocolClass);
  console.log('[PulseE2E] protocol inventory for local check-in fallback', JSON.stringify({
    athleteId,
    protocolClass,
    protocolIds: allProtocolRecords.map((record) => record.id),
  }));
  const responsivenessProfileSnap = await getDoc(doc(db, PULSECHECK_PROTOCOL_RESPONSIVENESS_PROFILES_COLLECTION, athleteId));
  const responsivenessProfile = responsivenessProfileSnap.exists() ? responsivenessProfileSnap.data() as Record<string, any> : null;
  const policyTags = deriveLocalPolicyTags({
    ...snapshot,
    programSnapshot: progress?.activeProgram || null,
  }, checkIn);

  const eligibleProtocolCandidates = allProtocolRecords
    .filter((record) => {
      const publishStatus = String(record.publishStatus || '').toLowerCase();
      const governanceStage = String(record.governanceStage || '').toLowerCase();
      const triggerTags = Array.isArray(record.triggerTags) ? record.triggerTags : [];
      const useWindowTags = Array.isArray(record.useWindowTags) ? record.useWindowTags : [];
      const avoidWindowTags = Array.isArray(record.avoidWindowTags) ? record.avoidWindowTags : [];
      const contraindicationTags = Array.isArray(record.contraindicationTags) ? record.contraindicationTags : [];

      if (record.isActive === false) return false;
      if (publishStatus && publishStatus !== 'published') return false;
      if (governanceStage === 'archived' || governanceStage === 'restricted') return false;
      if (protocolClass && record.protocolClass && record.protocolClass !== protocolClass) return false;
      if (triggerTags.length > 0 && !intersectsTags(triggerTags, policyTags)) return false;
      if (useWindowTags.length > 0 && !intersectsTags(useWindowTags, policyTags)) return false;
      if (avoidWindowTags.length > 0 && intersectsTags(avoidWindowTags, policyTags)) return false;
      if (contraindicationTags.length > 0 && intersectsTags(contraindicationTags, policyTags)) return false;
      return true;
    })
    .map((record) => {
      const familyResponse = responsivenessProfile?.familyResponses?.[record.familyId];
      const freshness = familyResponse?.freshness;
      const responsivenessDirection =
        freshness && freshness !== 'refresh_required'
          ? familyResponse?.responseDirection
          : undefined;
      const preferredBoost = intersectsTags(Array.isArray(record.preferredContextTags) ? record.preferredContextTags : [], policyTags) ? 5 : 0;
      const responsivenessBoost =
        responsivenessDirection === 'positive'
          ? 15
          : responsivenessDirection === 'negative'
            ? -15
            : 0;

      return {
        id: `${athleteId}_${sourceDate}_${record.id}`,
        type: 'protocol',
        label: record.label,
        actionType: 'protocol',
        rationale: record.rationale || `[E2E] ${record.label} matched the current protocol policy.`,
        protocolId: record.id,
        protocolLabel: record.label,
        protocolClass: record.protocolClass,
        protocolCategory: record.category,
        protocolResponseFamily: record.responseFamily,
        protocolDeliveryMode: record.deliveryMode,
        durationSeconds: record.durationSeconds,
        legacyExerciseId: record.legacyExerciseId || '',
        responsivenessDirection,
        __score: 1000 - Number(record.sortOrder || 999) + preferredBoost + responsivenessBoost,
      };
    })
    .sort((left, right) => {
      if (right.__score !== left.__score) return right.__score - left.__score;
      return String(left.protocolId || '').localeCompare(String(right.protocolId || ''));
    });
  console.log('[PulseE2E] eligible protocol candidates for local check-in fallback', JSON.stringify({
    athleteId,
    policyTags,
    protocolIds: eligibleProtocolCandidates.map((candidate) => candidate.protocolId),
  }));

  const publishedExercise =
    (progress?.activeProgram?.recommendedLegacyExerciseId
      ? await simModuleLibraryService.getPublishedById(progress.activeProgram.recommendedLegacyExerciseId)
      : null) ||
    (progress?.activeProgram?.recommendedSimId
      ? await simModuleLibraryService.getPublishedBySimSpecId(progress.activeProgram.recommendedSimId)
      : null);
  const resolvedExercise = publishedExercise
    || (progress?.activeProgram?.recommendedLegacyExerciseId
      ? await simModuleLibraryService.getById(progress.activeProgram.recommendedLegacyExerciseId)
      : null)
    || (progress?.activeProgram?.recommendedSimId
      ? await simModuleLibraryService.getBySimSpecId(progress.activeProgram.recommendedSimId)
      : null);

  const simCandidate: Record<string, any> | null = resolvedExercise
    ? {
        id: `${athleteId}_${sourceDate}_${resolvedExercise.id}`,
        type: 'sim',
        label: resolvedExercise.name,
        actionType: snapshot.recommendedRouting === 'protocol_then_sim' ? 'lighter_sim' : 'sim',
        rationale: progress?.activeProgram?.rationale || '[E2E] Active program simulation candidate.',
        legacyExerciseId: resolvedExercise.id,
        simSpecId: resolvedExercise.simSpecId,
        durationSeconds: progress?.activeProgram?.durationSeconds || resolvedExercise.durationMinutes * 60,
      }
    : null;

  const candidateSetId = `${athleteId}_${sourceDate}_candidates`;
  const authoringResult = await trainingPlanAuthoringService.maybeAuthorPrimaryPlan({
    athleteId,
    profile: progress?.taxonomyProfile || null,
    hasBaselineAssessment: Boolean(progress?.baselineAssessment),
    activeProgram: progress?.activeProgram || null,
    snapshot,
    sourceDate,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    sourceStateSnapshotId: snapshot.id,
    sourceProfileSnapshotId: progress?.profileVersion || null,
    now,
  }).catch((error) => {
    console.warn('[PulseE2E] training-plan authoring fallback failed during local check-in harness:', error);
    return null;
  });
  const primaryPlan =
    authoringResult?.plan
    || (await trainingPlanService.getPrimaryForAthlete(athleteId).catch(() => null));
  const planDrivenCandidate = await resolveHarnessPlanDrivenCandidate({
    athleteId,
    sourceDate,
    primaryPlan: primaryPlan as Record<string, any> | null,
    protocolRecords: allProtocolRecords,
  });
  const candidates: Array<Record<string, any>> = [
    ...(planDrivenCandidate ? [planDrivenCandidate] : []),
    ...eligibleProtocolCandidates
      .map(({ __score, ...candidate }) => candidate)
      .filter((candidate) => !planDrivenCandidate || candidate.id !== planDrivenCandidate.id),
    ...(simCandidate && (!planDrivenCandidate || simCandidate.id !== planDrivenCandidate.id) ? [simCandidate] : []),
  ] as Array<Record<string, any>>;
  const inventoryGaps =
    protocolClass && eligibleProtocolCandidates.length === 0
      ? [`No live ${protocolClass} protocol remains eligible for this check-in.`]
      : [];

  await setDoc(
    doc(db, PULSECHECK_ASSIGNMENT_CANDIDATE_SETS_COLLECTION, candidateSetId),
    sanitizeFirestoreValue({
      athleteId,
      sourceDate,
      sourceStateSnapshotId: snapshot.id,
      trainingPlanId: primaryPlan?.id || null,
      trainingPlanStepId: planDrivenCandidate?.trainingPlanStepId || null,
      trainingPlanStepIndex: planDrivenCandidate?.trainingPlanStepIndex || null,
      planDrivenCandidateId: planDrivenCandidate?.id || null,
      candidates,
      candidateIds: candidates.map((candidate) => candidate.id),
      candidateClassHints: uniqueStrings(candidates.map((candidate) => candidate.type)),
      constraintReasons: planDrivenCandidate ? ['The authored training plan supplied the next-due candidate.'] : [],
      inventoryGaps,
      plannerEligible: true,
      createdAt: now,
      updatedAt: now,
    }),
    { merge: true }
  );

  const assignment = await assignmentOrchestratorService.orchestratePostCheckIn({
    athleteId,
    sourceCheckInId: checkIn.id,
    sourceStateSnapshotId: snapshot.id,
    sourceDate,
  });

  if (Array.isArray(input.protocolRuntimeOverrides) && input.protocolRuntimeOverrides.length > 0) {
    await setDoc(
      doc(db, PULSECHECK_ASSIGNMENT_CANDIDATE_SETS_COLLECTION, candidateSetId),
      sanitizeFirestoreValue({
        athleteId,
        sourceDate,
        sourceStateSnapshotId: snapshot.id,
        trainingPlanId: primaryPlan?.id || null,
        trainingPlanStepId: planDrivenCandidate?.trainingPlanStepId || null,
        trainingPlanStepIndex: planDrivenCandidate?.trainingPlanStepIndex || null,
        planDrivenCandidateId: planDrivenCandidate?.id || null,
        candidates,
        candidateIds: candidates.map((candidate) => candidate.id),
        candidateClassHints: uniqueStrings(candidates.map((candidate) => candidate.type)),
        constraintReasons: planDrivenCandidate ? ['The authored training plan supplied the next-due candidate.'] : [],
        inventoryGaps,
        plannerEligible: true,
        createdAt: now,
        updatedAt: now,
      }),
      { merge: true }
    );
  }

  if (assignment) {
    const selectedCandidate = (planDrivenCandidate || candidates[0] || null) as Record<string, any> | null;
    const shouldKeepAssignmentLive = assignment.status === PulseCheckDailyAssignmentStatus.Deferred && Boolean(resolvedExercise);
    const nextStatus =
      selectedCandidate
        ? (selectedCandidate.actionType === 'defer'
            ? PulseCheckDailyAssignmentStatus.Deferred
            : PulseCheckDailyAssignmentStatus.Assigned)
        : (shouldKeepAssignmentLive ? PulseCheckDailyAssignmentStatus.Assigned : assignment.status);
    const nextActionType =
      selectedCandidate?.actionType
      || (shouldKeepAssignmentLive ? (snapshot.recommendedRouting === 'protocol_then_sim' ? 'lighter_sim' : 'sim') : assignment.actionType);
    const nextExecutionPattern = selectedCandidate?.executionPattern || assignment.executionPattern || 'single';
    const nextDurationSeconds =
      selectedCandidate?.durationSeconds
      || progress?.activeProgram?.durationSeconds
      || (resolvedExercise?.durationMinutes ? resolvedExercise.durationMinutes * 60 : null);

    await setDoc(
      doc(db, PULSECHECK_DAILY_ASSIGNMENTS_COLLECTION, assignment.id),
      sanitizeFirestoreValue({
        sourceCandidateSetId: candidateSetId,
        plannerAudit: {
          rankedCandidates: candidates.map((candidate, index) => ({
            ...candidate,
            rank: index + 1,
          })),
        },
        chosenCandidateId: selectedCandidate?.id || null,
        chosenCandidateType: selectedCandidate?.type || null,
        status: nextStatus,
        actionType: nextActionType,
        executionPattern: nextExecutionPattern,
        phaseProgress: buildHarnessPhaseProgress(nextExecutionPattern),
        rationale: selectedCandidate?.rationale || assignment.rationale || null,
        plannerSummary: selectedCandidate?.rationale || assignment.plannerSummary || null,
        plannerConfidence: 'medium',
        decisionSource: 'fallback_rules',
        legacyExerciseId:
          selectedCandidate?.legacyExerciseId
          || (shouldKeepAssignmentLive ? resolvedExercise?.id || null : assignment.legacyExerciseId || null),
        simSpecId:
          selectedCandidate?.simSpecId
          || (shouldKeepAssignmentLive ? resolvedExercise?.simSpecId || null : assignment.simSpecId || null),
        simFamilyLabel:
          selectedCandidate?.simSpecId
            ? humanizeRuntimeLabel(selectedCandidate.simSpecId)
            : (selectedCandidate?.legacyExerciseId
              ? humanizeRuntimeLabel(selectedCandidate.legacyExerciseId)
              : assignment.simFamilyLabel || null),
        simVariantLabel:
          selectedCandidate?.label
          || (resolvedExercise?.name && shouldKeepAssignmentLive ? resolvedExercise.name : assignment.simVariantLabel || null),
        protocolId: selectedCandidate?.protocolId || null,
        protocolLabel: selectedCandidate?.protocolLabel || null,
        protocolClass: selectedCandidate?.protocolClass || null,
        protocolCategory: selectedCandidate?.protocolCategory || null,
        protocolResponseFamily: selectedCandidate?.protocolResponseFamily || null,
        protocolDeliveryMode: selectedCandidate?.protocolDeliveryMode || null,
        durationSeconds: nextDurationSeconds,
        trainingPlanId: selectedCandidate?.trainingPlanId || null,
        trainingPlanStepId: selectedCandidate?.trainingPlanStepId || null,
        trainingPlanStepIndex: selectedCandidate?.trainingPlanStepIndex || null,
        trainingPlanStepLabel: selectedCandidate?.trainingPlanStepLabel || selectedCandidate?.label || null,
        trainingPlanIsPrimary: Boolean(selectedCandidate?.trainingPlanId),
        updatedAt: Date.now(),
      }),
      { merge: true }
    );

    if (primaryPlan && selectedCandidate?.trainingPlanId) {
      const refreshedAssignmentSnap = await getDoc(doc(db, PULSECHECK_DAILY_ASSIGNMENTS_COLLECTION, assignment.id));
      const refreshedAssignment = refreshedAssignmentSnap.exists()
        ? ({ id: refreshedAssignmentSnap.id, ...refreshedAssignmentSnap.data() } as Record<string, any>)
        : { ...assignment, trainingPlanId: selectedCandidate.trainingPlanId };
      await syncHarnessPlanWithAssignment({
        plan: primaryPlan as Record<string, any>,
        assignment: refreshedAssignment,
        eventAt: Date.now(),
      });
    }

    if (Array.isArray(input.protocolRuntimeOverrides)) {
      await setDoc(
        doc(db, PULSECHECK_ASSIGNMENT_CANDIDATE_SETS_COLLECTION, candidateSetId),
        sanitizeFirestoreValue({
          athleteId,
          sourceDate,
          sourceStateSnapshotId: snapshot.id,
          trainingPlanId: primaryPlan?.id || null,
          trainingPlanStepId: planDrivenCandidate?.trainingPlanStepId || null,
          trainingPlanStepIndex: planDrivenCandidate?.trainingPlanStepIndex || null,
          planDrivenCandidateId: planDrivenCandidate?.id || null,
          candidates,
          candidateIds: candidates.map((candidate) => candidate.id),
          candidateClassHints: uniqueStrings(candidates.map((candidate) => candidate.type)),
          constraintReasons: planDrivenCandidate ? ['The authored training plan supplied the next-due candidate.'] : [],
          inventoryGaps,
          plannerEligible: true,
          createdAt: now,
          updatedAt: Date.now(),
        }),
        { merge: true }
      );
    }
  }

  const latestAssignment = assignment
    ? await assignmentOrchestratorService.getById(assignment.id)
    : null;

  return {
    checkIn,
    stateSnapshot: snapshot,
    candidateSet: {
      id: candidateSetId,
      athleteId,
      sourceDate,
      sourceStateSnapshotId: snapshot.id,
      trainingPlanId: primaryPlan?.id || null,
      trainingPlanStepId: planDrivenCandidate?.trainingPlanStepId || null,
      trainingPlanStepIndex: planDrivenCandidate?.trainingPlanStepIndex || null,
      planDrivenCandidateId: planDrivenCandidate?.id || null,
      candidates,
      candidateIds: candidates.map((candidate) => candidate.id),
      candidateClassHints: uniqueStrings(candidates.map((candidate) => candidate.type)),
      constraintReasons: planDrivenCandidate ? ['The authored training plan supplied the next-due candidate.'] : [],
      inventoryGaps,
      plannerEligible: true,
      createdAt: now,
      updatedAt: now,
    },
    dailyAssignment: latestAssignment,
  };
}

async function recordPulseCheckAssignmentEventViaHarness(
  db: Firestore,
  input: {
    assignmentId: string;
    eventType: string;
    actorUserId?: string;
    reason?: string;
    metadata?: Record<string, unknown>;
  }
) {
  const assignment = await assignmentOrchestratorService.getById(input.assignmentId);
  if (!assignment) {
    throw new Error(`Assignment ${input.assignmentId} not found.`);
  }

  const now = Date.now();
  const eventId = `${input.assignmentId}_${input.eventType}_${now}`;
  const eventMetadata = sanitizeFirestoreValue(
    input.reason || input.metadata ? { reason: input.reason, ...(input.metadata || {}) } : undefined
  );
  const actorUserId = input.actorUserId || 'local-e2e-harness';
  const actorType = resolveHarnessActorType(assignment as Record<string, any>, input);
  const status =
    input.eventType === 'completed'
      ? PulseCheckDailyAssignmentStatus.Completed
      : input.eventType === 'started'
        ? PulseCheckDailyAssignmentStatus.Started
        : input.eventType === 'viewed'
          ? PulseCheckDailyAssignmentStatus.Viewed
          : input.eventType === 'overridden'
            ? PulseCheckDailyAssignmentStatus.Overridden
            : input.eventType === 'deferred'
              ? PulseCheckDailyAssignmentStatus.Deferred
              : assignment.status;

  await setDoc(
    doc(db, PULSECHECK_ASSIGNMENT_EVENTS_COLLECTION, eventId),
    sanitizeFirestoreValue({
      assignmentId: assignment.id,
      athleteId: assignment.athleteId,
      teamId: assignment.teamId,
      sourceDate: assignment.sourceDate,
      eventType: input.eventType,
      actorType,
      actorUserId,
      eventAt: now,
      metadata: eventMetadata,
      createdAt: now,
    }),
    { merge: true }
  );

  await setDoc(
    doc(db, PULSECHECK_DAILY_ASSIGNMENTS_COLLECTION, assignment.id),
    sanitizeFirestoreValue({
      status,
      updatedAt: now,
      ...(input.eventType === 'completed' && input.metadata?.completionSummary
        ? { completionSummary: input.metadata.completionSummary }
        : {}),
      ...(input.eventType === 'completed' ? { completedAt: now } : {}),
      ...(input.eventType === 'started' ? { startedAt: now } : {}),
      ...(input.eventType === 'viewed' ? { viewedAt: now } : {}),
    }),
    { merge: true }
  );

  const updatedAssignmentSnap = await getDoc(doc(db, PULSECHECK_DAILY_ASSIGNMENTS_COLLECTION, assignment.id));
  const updatedAssignment = updatedAssignmentSnap.exists()
    ? pulseCheckDailyAssignmentFromFirestore(updatedAssignmentSnap.id, updatedAssignmentSnap.data() as Record<string, any>)
    : assignment;
  const updatedPlan = await applyHarnessTrainingPlanEventSideEffects(db, {
    assignment: assignment as unknown as Record<string, any>,
    nextAssignment: updatedAssignment as unknown as Record<string, any>,
    eventType: input.eventType,
    actorType,
    actorUserId,
    reason: input.reason,
    eventAt: now,
    assignmentEventId: eventId,
  });
  const snapshot = assignment.sourceStateSnapshotId
    ? await stateSnapshotService.getById(assignment.sourceStateSnapshotId)
    : null;

  return {
    assignment: updatedAssignment,
    trainingPlan: updatedPlan,
    event: {
      id: eventId,
      assignmentId: assignment.id,
      athleteId: assignment.athleteId,
      teamId: assignment.teamId,
      sourceDate: assignment.sourceDate,
      eventType: input.eventType,
      actorType,
      actorUserId,
      eventAt: now,
      metadata: eventMetadata,
      createdAt: now,
    },
    stateSnapshot: snapshot,
  };
}

async function seedPulseCheckProtocolResponsivenessProfile(
  db: Firestore,
  input: {
    athleteUserId: string;
    familyResponses?: Record<string, any>;
    variantResponses?: Record<string, any>;
    staleAt?: number;
  }
) {
  const now = Date.now();
  const profile = {
    athleteId: input.athleteUserId,
    familyResponses: input.familyResponses || {},
    variantResponses: input.variantResponses || {},
    sourceEventIds: [],
    staleAt: input.staleAt || now + 14 * 24 * 60 * 60 * 1000,
    lastUpdatedAt: now,
    createdAt: now,
    updatedAt: now,
  };

  await setDoc(
    doc(db, PULSECHECK_PROTOCOL_RESPONSIVENESS_PROFILES_COLLECTION, input.athleteUserId),
    profile,
    { merge: true }
  );

  return { id: input.athleteUserId, ...profile };
}

async function capturePulseCheckProtocolRuntimeRecords(
  db: Firestore,
  input: {
    protocolIds?: string[];
    protocolClass?: string;
  }
) {
  const protocolIds = Array.isArray(input.protocolIds) ? new Set(input.protocolIds.filter(Boolean)) : null;
  const snap = await getDocs(collection(db, PULSECHECK_PROTOCOLS_COLLECTION));

  return snap.docs
    .map((entry) => ({ id: entry.id, ...(entry.data() as Record<string, any>) } as Record<string, any> & { id: string }))
    .filter((record) => {
      if (protocolIds && !protocolIds.has(record.id)) {
        return false;
      }
      if (input.protocolClass && record.protocolClass !== input.protocolClass) {
        return false;
      }
      return true;
    });
}

async function upsertPulseCheckProtocolRuntimeRecords(
  db: Firestore,
  input: {
    records: Array<Record<string, any>>;
  }
) {
  const records = Array.isArray(input.records) ? input.records.filter((record) => record && typeof record.id === 'string' && record.id.trim()) : [];
  await Promise.all(
    records.map((record) =>
      setDoc(doc(db, PULSECHECK_PROTOCOLS_COLLECTION, record.id), record, { merge: true })
    )
  );

  return { updatedIds: records.map((record) => record.id) };
}

async function deletePulseCheckProtocolRuntimeRecords(
  db: Firestore,
  input: {
    protocolIds: string[];
  }
) {
  const protocolIds = Array.isArray(input.protocolIds) ? input.protocolIds.filter(Boolean) : [];
  await Promise.all(protocolIds.map((protocolId) => deleteDoc(doc(db, PULSECHECK_PROTOCOLS_COLLECTION, protocolId))));
  return { deletedIds: protocolIds };
}

async function syncPulseCheckProtocolRegistrySeeds() {
  return protocolRegistryService.syncSeedProtocols();
}

async function seedPulseCheckProtocolAssignmentFixture(
  db: Firestore,
  input: {
    namespace: string;
    athleteUserId: string;
    coachUserId: string;
    protocolId?: string;
    sourceDate?: string;
    candidateProtocols?: Array<{
      id: string;
      label: string;
      legacyExerciseId: string;
      protocolClass: 'priming' | 'regulation' | 'recovery';
      protocolCategory: ExerciseCategory;
      protocolResponseFamily: string;
      protocolDeliveryMode: string;
      durationSeconds: number;
      responsivenessDirection?: 'positive' | 'neutral' | 'negative';
    }>;
  }
) {
  const fixture = buildAthleteJourneyFixtureIds(input.namespace);
  const candidateProtocols = Array.isArray(input.candidateProtocols) && input.candidateProtocols.length > 0
    ? input.candidateProtocols
    : [resolveProtocolFixture(input.protocolId)];
  const now = Date.now();
  const sourceDate = input.sourceDate || new Date().toISOString().split('T')[0];
  const snapshotId = `${input.athleteUserId}_${sourceDate}`;
  const candidateSetId = `${input.athleteUserId}_${sourceDate}_candidates`;
  const assignmentId = `${input.athleteUserId}_${sourceDate}`;
  const candidates = candidateProtocols.map((protocol, index) => {
    const candidateId = `${input.athleteUserId}_${sourceDate}_${protocol.id}`;
    return {
      id: candidateId,
      type: 'protocol',
      label: protocol.label,
      actionType: 'protocol',
      rationale: `[E2E] Seeded protocol candidate ${protocol.label}.`,
      legacyExerciseId: protocol.legacyExerciseId,
      protocolId: protocol.id,
      protocolLabel: protocol.label,
      protocolClass: protocol.protocolClass,
      protocolCategory: protocol.protocolCategory,
      protocolResponseFamily: protocol.protocolResponseFamily,
      protocolDeliveryMode: protocol.protocolDeliveryMode,
      durationSeconds: protocol.durationSeconds,
      responsivenessDirection: protocol.responsivenessDirection || (index === 0 ? 'positive' : 'negative'),
    };
  });

  await setDoc(
    doc(db, PULSECHECK_STATE_SNAPSHOTS_COLLECTION, snapshotId),
    {
      athleteId: input.athleteUserId,
      sourceDate,
      sourceCheckInId: 'e2e-protocol-seed-checkin',
      stateDimensions: {
        activation: 54,
        focusReadiness: 48,
        emotionalLoad: 44,
        cognitiveFatigue: 41,
      },
      overallReadiness: 'yellow',
      confidence: 'medium',
      freshness: 'current',
      sourcesUsed: ['e2e_fixture'],
      sourceEventIds: [],
      contextTags: ['competition_window', 'between_reps'],
      recommendedRouting: 'protocol_then_sim',
      recommendedProtocolClass: candidates[0]?.protocolClass || 'priming',
      candidateClassHints: ['protocol', 'sim'],
      readinessScore: 52,
      supportFlag: false,
      decisionSource: 'fallback_rules',
      executionLink: assignmentId,
      createdAt: now,
      updatedAt: now,
    },
    { merge: true }
  );

  await setDoc(
    doc(db, PULSECHECK_ASSIGNMENT_CANDIDATE_SETS_COLLECTION, candidateSetId),
    {
      athleteId: input.athleteUserId,
      sourceDate,
      sourceStateSnapshotId: snapshotId,
      candidates,
      candidateIds: candidates.map((candidate) => candidate.id),
      candidateClassHints: ['protocol'],
      constraintReasons: [],
      inventoryGaps: [],
      plannerEligible: true,
      createdAt: now,
      updatedAt: now,
    },
    { merge: true }
  );

  await setDoc(
    doc(db, PULSECHECK_DAILY_ASSIGNMENTS_COLLECTION, assignmentId),
    {
      lineageId: assignmentId,
      revision: 1,
      athleteId: input.athleteUserId,
      teamId: fixture.teamId,
      teamMembershipId: `${fixture.teamId}_${input.athleteUserId}`,
      coachId: input.coachUserId,
      sourceCheckInId: 'e2e-protocol-seed-checkin',
      sourceStateSnapshotId: snapshotId,
      sourceCandidateSetId: candidateSetId,
      sourceDate,
      assignedBy: 'nora',
      status: 'assigned',
      actionType: 'protocol',
      chosenCandidateId: candidates[0]?.id,
      chosenCandidateType: 'protocol',
      legacyExerciseId: candidates[0]?.legacyExerciseId,
      protocolId: candidates[0]?.protocolId,
      protocolLabel: candidates[0]?.protocolLabel,
      protocolClass: candidates[0]?.protocolClass,
      protocolCategory: candidates[0]?.protocolCategory,
      protocolResponseFamily: candidates[0]?.protocolResponseFamily,
      protocolDeliveryMode: candidates[0]?.protocolDeliveryMode,
      durationSeconds: candidates[0]?.durationSeconds,
      rationale: `[E2E] Seeded protocol assignment for ${candidates[0]?.label}.`,
      plannerSummary: `[E2E] Seeded protocol assignment for ${candidates[0]?.label}.`,
      plannerConfidence: 'medium',
      decisionSource: 'fallback_rules',
      readinessScore: 52,
      readinessBand: 'medium',
      supportFlag: false,
      plannerAudit: {
        rankedCandidates: candidates.map((candidate, index) => ({
          ...candidate,
          rank: index + 1,
        })),
      },
      createdAt: now,
      updatedAt: now,
    },
    { merge: true }
  );

  return {
    assignmentId,
    candidateSetId,
    snapshotId,
    sourceDate,
    protocolId: candidates[0]?.protocolId || null,
  };
}

async function recordPulseCheckJourneyCompletion(
  db: Firestore,
  input: {
    athleteUserId: string;
    dailyAssignmentId: string;
    exerciseId?: string;
    exerciseName?: string;
    durationSeconds?: number;
    helpfulnessRating?: number;
  }
) {
  const assignmentSnap = await getDoc(doc(db, PULSECHECK_DAILY_ASSIGNMENTS_COLLECTION, input.dailyAssignmentId));
  const assignment = assignmentSnap.exists() ? { id: assignmentSnap.id, ...assignmentSnap.data() } as Record<string, any> : null;
  const fallbackExerciseId =
    input.exerciseId ||
    assignment?.legacyExerciseId ||
    assignment?.simSpecId ||
    'focus-3-second-reset';
  const fallbackExerciseName =
    input.exerciseName ||
    assignment?.legacyExerciseId ||
    assignment?.simSpecId ||
    assignment?.sessionType ||
    assignment?.actionType ||
    'Reset';
  const now = Date.now();
  const durationSeconds = input.durationSeconds || Math.max(60, assignment?.durationSeconds || 180);
  const completionId = `${input.athleteUserId}_${input.dailyAssignmentId}_completion`;
  const sessionSummary = {
    completedActionLabel: fallbackExerciseName,
    nextActionLabel: 'Continue building with Nora',
    athleteHeadline: `Strong practice rep on ${fallbackExerciseName}`,
    athleteBody: `You completed ${fallbackExerciseName} with good intent. Keep using the same cues on the next rep.`,
    coachHeadline: `Athlete completed ${fallbackExerciseName}`,
    coachBody: `The athlete completed ${fallbackExerciseName} and should keep reinforcing the same execution cues.`,
    targetSkills: ['signal recognition', 'execution rehearsal'],
    programChanged: false,
    generatedAt: now,
  };

  await setDoc(
    doc(db, SIM_COMPLETIONS_ROOT, input.athleteUserId, 'completions', completionId),
    {
      userId: input.athleteUserId,
      exerciseId: fallbackExerciseId,
      exerciseName: fallbackExerciseName,
      exerciseCategory: ExerciseCategory.Focus,
      dailyAssignmentId: input.dailyAssignmentId,
      completedAt: now,
      durationSeconds,
      helpfulnessRating: input.helpfulnessRating || 4,
      createdAt: now,
      sessionSummary,
    },
    { merge: true }
  );
  const completionEvent = await recordPulseCheckAssignmentEventViaHarness(db, {
    assignmentId: input.dailyAssignmentId,
    eventType: 'completed',
    metadata: {
      exerciseId: fallbackExerciseId,
      exerciseName: fallbackExerciseName,
      completionSummary: sessionSummary,
    },
  });
  const completionEventId = completionEvent.event.id;

  const profileSnap = await getDoc(doc(db, PULSECHECK_PROTOCOL_RESPONSIVENESS_PROFILES_COLLECTION, input.athleteUserId));
  const existingProfile = profileSnap.exists() ? (profileSnap.data() as Record<string, any>) : {};
  const existingSourceEventIds = Array.isArray(existingProfile.sourceEventIds)
    ? existingProfile.sourceEventIds
    : [];
  const existingFamilyResponses = existingProfile.familyResponses && typeof existingProfile.familyResponses === 'object'
    ? existingProfile.familyResponses
    : {};
  const familyId =
    assignment?.protocolFamilyId ||
    (assignment?.protocolClass && assignment?.protocolResponseFamily
      ? `${assignment.protocolClass}-${assignment.protocolResponseFamily}`
      : '');
  const existingFamilyResponse = familyId ? (existingFamilyResponses[familyId] || {}) : null;
  const nextFamilyResponses = familyId
    ? {
        ...existingFamilyResponses,
        [familyId]: {
          ...existingFamilyResponse,
          protocolFamilyId: familyId,
          protocolFamilyLabel:
            existingFamilyResponse?.protocolFamilyLabel ||
            assignment?.protocolLabel ||
            familyId,
          protocolClass: assignment?.protocolClass || existingFamilyResponse?.protocolClass,
          responseFamily: assignment?.protocolResponseFamily || existingFamilyResponse?.responseFamily,
          responseDirection: 'positive',
          confidence: existingFamilyResponse?.confidence || 'medium',
          freshness: 'current',
          sampleSize: Number(existingFamilyResponse?.sampleSize || 0) + 1,
          positiveSignals: Number(existingFamilyResponse?.positiveSignals || 0) + 1,
          neutralSignals: Number(existingFamilyResponse?.neutralSignals || 0),
          negativeSignals: Number(existingFamilyResponse?.negativeSignals || 0),
          stateFit: uniqueStrings([
            ...(Array.isArray(existingFamilyResponse?.stateFit) ? existingFamilyResponse.stateFit : []),
            assignment?.readinessBand ? `${assignment.readinessBand}_readiness` : '',
            assignment?.protocolClass || '',
          ]),
          supportingEvidence: uniqueStrings([
            ...(Array.isArray(existingFamilyResponse?.supportingEvidence) ? existingFamilyResponse.supportingEvidence : []),
            `E2E completion recorded for ${fallbackExerciseName}.`,
          ]).slice(0, 6),
          lastObservedAt: now,
          lastConfirmedAt: now,
        },
      }
    : existingFamilyResponses;

  await setDoc(
    doc(db, PULSECHECK_PROTOCOL_RESPONSIVENESS_PROFILES_COLLECTION, input.athleteUserId),
    {
      familyResponses: nextFamilyResponses,
      sourceEventIds: uniqueStrings([...existingSourceEventIds, completionEventId]),
      lastUpdatedAt: now,
      updatedAt: now,
    },
    { merge: true }
  );

  return {
    id: completionId,
    userId: input.athleteUserId,
    exerciseId: fallbackExerciseId,
    exerciseName: fallbackExerciseName,
    exerciseCategory: ExerciseCategory.Focus,
    dailyAssignmentId: input.dailyAssignmentId,
    completedAt: now,
    durationSeconds,
    helpfulnessRating: input.helpfulnessRating || 4,
    createdAt: now,
    sessionSummary,
  };
}

async function savePulseCheckProtocolPracticeSession(
  db: Firestore,
  input: {
    assignmentId: string;
    session: Record<string, any>;
  }
) {
  await assignmentOrchestratorService.saveProtocolPracticeSession(input.assignmentId, input.session as any);
  const snapshot = await getDoc(doc(db, PULSECHECK_DAILY_ASSIGNMENTS_COLLECTION, input.assignmentId));

  return snapshot.exists()
    ? { id: snapshot.id, ...snapshot.data() }
    : { id: input.assignmentId, protocolPracticeSession: input.session };
}

async function upsertCoachNotificationDocs(
  db: Firestore,
  input: {
    coachUserId: string;
    athleteUserId: string;
  }
) {
  const state = await inspectPulseCheckAthleteJourneyState(db, input);
  const athleteDoc = await getDoc(doc(db, USERS_COLLECTION, input.athleteUserId));
  const athleteName =
    (athleteDoc.exists() ? athleteDoc.data()?.displayName || athleteDoc.data()?.username : null) || 'Athlete';
  const now = Date.now();

  if (state.latestAssignment) {
    const assignment = state.latestAssignment;
    const assignmentLabel = assignment.simSpecId || assignment.legacyExerciseId || assignment.sessionType || assignment.actionType;
    await setDoc(
      doc(db, COACH_NOTIFICATIONS_COLLECTION, `pulsecheck_nora_auto_assignment_${assignment.id}`),
      {
        coachId: input.coachUserId,
        athleteId: input.athleteUserId,
        type: 'pulsecheck_nora_auto_assignment',
        category: 'athlete',
        title: assignment.actionType === 'defer' ? 'Pulse Check paused today\'s task' : 'Nora assigned today\'s task',
        message: `${athleteName}: Nora ${assignmentLabel}. Review or override in Mental Training.`,
        actionRequired: assignment.actionType !== 'defer',
        read: false,
        archived: false,
        sourceId: assignment.id,
        target: 'coach_mental_training',
        webUrl: '/coach/mentalGames?tab=assignments',
        metadata: {
          sourceDate: assignment.sourceDate || new Date().toISOString().split('T')[0],
          actionType: assignment.actionType || 'sim',
        },
        createdAt: now,
        updatedAt: now,
      },
      { merge: true }
    );
  }

  if (state.latestCompletion?.sessionSummary) {
    const summary = state.latestCompletion.sessionSummary;
    await setDoc(
      doc(db, COACH_NOTIFICATIONS_COLLECTION, `pulsecheck_session_update_${state.latestCompletion.id}`),
      {
        coachId: input.coachUserId,
        athleteId: input.athleteUserId,
        type: 'pulsecheck_session_update',
        category: 'athlete',
        title: summary.programChanged ? 'Pulse Check updated the next rep' : 'Pulse Check logged a completed rep',
        message: `${athleteName}: ${summary.coachBody || 'A new session update is ready in Mental Training.'}`,
        actionRequired: Boolean(summary.programChanged),
        read: false,
        archived: false,
        sourceId: state.latestCompletion.id,
        target: 'coach_mental_training',
        webUrl: '/coach/mentalGames',
        metadata: {
          dailyAssignmentId: state.latestCompletion.dailyAssignmentId || '',
          completedActionLabel: summary.completedActionLabel || '',
          nextActionLabel: summary.nextActionLabel || '',
          programChanged: Boolean(summary.programChanged),
        },
        createdAt: now,
        updatedAt: now,
      },
      { merge: true }
    );
  }

  return inspectPulseCheckAthleteJourneyState(db, input);
}

export interface PulseE2EHarness {
  ensureAdminRecord: (email: string) => Promise<{
    email: string;
    existed: boolean;
  }>;
  cleanupRegistryFixtures: (namespace: string) => Promise<{
    namespace: string;
    deletedModules: number;
    deletedVariants: number;
  }>;
  cloneVariantFixtureByName: (
    sourceName: string,
    namespace: string
  ) => Promise<{
    namespace: string;
    sourceVariantId: string;
    variantId: string;
    variantName: string;
    moduleId: string;
  }>;
  seedLegacyCoachRosterFixture: (
    namespace: string,
    mode: 'new-container' | 'existing-team'
  ) => Promise<{
    namespace: string;
    coachId: string;
    athleteOneId: string;
    athleteTwoId: string;
    coachEmail: string;
    athleteOneEmail: string;
    athleteTwoEmail: string;
    coachDisplayName: string;
    athleteOneName: string;
    athleteTwoName: string;
    coachReferralCode: string;
    existingOrganizationId: string;
    existingTeamId: string;
    existingOrganizationName: string;
    existingTeamName: string;
    connectionOneId: string;
    connectionTwoId: string;
    mode: 'new-container' | 'existing-team';
  }>;
  seedPulseCheckAdminWorkspaceFixture: (
    namespace: string,
    adminUserId: string,
    adminEmail: string
  ) => Promise<{
    namespace: string;
    organizationId: string;
    teamId: string;
    organizationName: string;
    teamName: string;
    adminUserId: string;
    adminEmail: string;
  }>;
  seedPulseCheckPilotDashboardFixture: (input: {
    namespace: string;
    adminUserId: string;
    adminEmail: string;
  }) => Promise<{
    namespace: string;
    organizationId: string;
    teamId: string;
    pilotId: string;
    pilotName: string;
    cohortIds: string[];
    athleteIds: string[];
    athleteNames: string[];
    athleteEmails: string[];
    readoutIds: string[];
  }>;
  cleanupPulseCheckPilotDashboardFixture: (input: {
    namespace: string;
    adminUserId: string;
  }) => Promise<{
    namespace: string;
    organizationId: string;
    teamId: string;
    pilotId: string;
    athleteIds: string[];
  }>;
  cleanupLegacyCoachRosterFixtures: (namespace: string) => Promise<{
    namespace: string;
    coachId: string;
    deletedTeams: number;
    deletedOrganizations: number;
    deletedTeamMemberships: number;
  }>;
  seedPulseCheckAthleteJourneyFixture: (input: {
    namespace: string;
    adminUserId: string;
    adminEmail: string;
    coachUserId: string;
    coachEmail: string;
    athleteUserId: string;
    athleteEmail: string;
  }) => Promise<{
    namespace: string;
    referralCode: string;
    organizationId: string;
    teamId: string;
    coachAthleteLinkId: string;
    athleteUserId: string;
    athleteEmail: string;
    coachUserId: string;
    coachEmail: string;
    activeProgram?: Record<string, any>;
  }>;
  cleanupPulseCheckAthleteJourneyFixture: (input: {
    namespace: string;
    athleteUserId: string;
    coachUserId: string;
  }) => Promise<{
    namespace: string;
    athleteUserId: string;
    coachUserId: string;
  }>;
  inspectPulseCheckAthleteJourneyState: (input: {
    athleteUserId: string;
    coachUserId: string;
  }) => Promise<Record<string, any>>;
  submitPulseCheckCheckIn: (input: {
    userId: string;
    type: string;
    readinessScore: number;
    moodWord?: string;
    energyLevel?: number;
    stressLevel?: number;
    sleepQuality?: number;
    notes?: string;
    taxonomyState?: Record<string, any>;
    sourceDate?: string;
    protocolRuntimeOverrides?: Array<Record<string, any>>;
  }) => Promise<Record<string, any>>;
  recordPulseCheckAssignmentEvent: (input: {
    assignmentId: string;
    eventType: string;
    actorUserId?: string;
    reason?: string;
    metadata?: Record<string, unknown>;
  }) => Promise<Record<string, any>>;
  recordPulseCheckJourneyCompletion: (input: {
    athleteUserId: string;
    dailyAssignmentId: string;
    exerciseId?: string;
    exerciseName?: string;
    durationSeconds?: number;
    helpfulnessRating?: number;
  }) => Promise<Record<string, any>>;
  savePulseCheckProtocolPracticeSession: (input: {
    assignmentId: string;
    session: Record<string, any>;
  }) => Promise<Record<string, any>>;
  upsertPulseCheckCoachNotifications: (input: {
    coachUserId: string;
    athleteUserId: string;
  }) => Promise<Record<string, any>>;
  seedPulseCheckProtocolResponsivenessProfile: (input: {
    athleteUserId: string;
    familyResponses?: Record<string, any>;
    variantResponses?: Record<string, any>;
    staleAt?: number;
  }) => Promise<Record<string, any>>;
  seedPulseCheckProtocolAssignmentFixture: (input: {
    namespace: string;
    athleteUserId: string;
    coachUserId: string;
    protocolId?: string;
    sourceDate?: string;
  }) => Promise<Record<string, any>>;
  capturePulseCheckProtocolRuntimeRecords: (input: {
    protocolIds?: string[];
    protocolClass?: string;
  }) => Promise<Record<string, any>[]>;
  upsertPulseCheckProtocolRuntimeRecords: (input: {
    records: Array<Record<string, any>>;
  }) => Promise<Record<string, any>>;
  deletePulseCheckProtocolRuntimeRecords: (input: {
    protocolIds: string[];
  }) => Promise<Record<string, any>>;
  syncPulseCheckProtocolRegistrySeeds: () => Promise<Record<string, any>>;
  inspectLegacyCoachRosterFixture: (namespace: string) => Promise<Record<string, any>>;
  inspectVariant: (variantId: string) => Promise<Record<string, any> | null>;
}

declare global {
  interface Window {
    __pulseE2E?: PulseE2EHarness;
  }
}

export function installPulseE2EHarness(db: Firestore) {
  if (typeof window === 'undefined') return;
  if (window.__pulseE2E) return;

  window.__pulseE2E = {
    ensureAdminRecord: async (email: string) => {
      const normalizedEmail = (email || '').trim().toLowerCase();
      if (!normalizedEmail) {
        throw new Error('An email is required to create or verify a dev admin record.');
      }

      const adminRef = doc(db, 'admin', normalizedEmail);
      const existing = await getDoc(adminRef);

      if (!existing.exists()) {
        await setDoc(adminRef, {
          email: normalizedEmail,
          createdAt: Date.now(),
          addedBy: 'admin-function',
          permissions: ['all'],
          source: 'playwright-e2e-harness',
        });
      } else {
        const existingData = existing.data() || {};
        await setDoc(adminRef, {
          ...existingData,
          email: normalizedEmail,
          addedBy: existingData.addedBy || 'admin-function',
          permissions: Array.isArray(existingData.permissions) && existingData.permissions.length > 0
            ? existingData.permissions
            : ['all'],
          source: existingData.source || 'playwright-e2e-harness',
        }, { merge: true });
      }

      return {
        email: normalizedEmail,
        existed: existing.exists(),
      };
    },
    cleanupRegistryFixtures: (namespace: string) => cleanupRegistryFixtures(db, namespace),
    cloneVariantFixtureByName: (sourceName: string, namespace: string) =>
      cloneVariantFixtureByName(db, sourceName, namespace),
    seedLegacyCoachRosterFixture: (namespace: string, mode: 'new-container' | 'existing-team') =>
      seedLegacyCoachRosterFixture(db, namespace, mode),
    seedPulseCheckAdminWorkspaceFixture: (namespace: string, adminUserId: string, adminEmail: string) =>
      seedPulseCheckAdminWorkspaceFixture(db, namespace, adminUserId, adminEmail),
    seedPulseCheckPilotDashboardFixture: (input) => seedPulseCheckPilotDashboardFixture(db, input),
    cleanupPulseCheckPilotDashboardFixture: (input) => cleanupPulseCheckPilotDashboardFixture(db, input),
    cleanupLegacyCoachRosterFixtures: (namespace: string) => cleanupLegacyCoachRosterFixtures(db, namespace),
    seedPulseCheckAthleteJourneyFixture: (input) => seedPulseCheckAthleteJourneyFixture(db, input),
    cleanupPulseCheckAthleteJourneyFixture: (input) => cleanupPulseCheckAthleteJourneyFixture(db, input),
    inspectPulseCheckAthleteJourneyState: (input) => inspectPulseCheckAthleteJourneyState(db, input),
    submitPulseCheckCheckIn: (input) => submitPulseCheckCheckInViaHarness(db, input),
    recordPulseCheckAssignmentEvent: (input) => recordPulseCheckAssignmentEventViaHarness(db, input),
    recordPulseCheckJourneyCompletion: (input) => recordPulseCheckJourneyCompletion(db, input),
    savePulseCheckProtocolPracticeSession: (input) => savePulseCheckProtocolPracticeSession(db, input),
    upsertPulseCheckCoachNotifications: (input) => upsertCoachNotificationDocs(db, input),
    seedPulseCheckProtocolResponsivenessProfile: (input) => seedPulseCheckProtocolResponsivenessProfile(db, input),
    seedPulseCheckProtocolAssignmentFixture: (input) => seedPulseCheckProtocolAssignmentFixture(db, input),
    capturePulseCheckProtocolRuntimeRecords: (input) => capturePulseCheckProtocolRuntimeRecords(db, input),
    upsertPulseCheckProtocolRuntimeRecords: (input) => upsertPulseCheckProtocolRuntimeRecords(db, input),
    deletePulseCheckProtocolRuntimeRecords: (input) => deletePulseCheckProtocolRuntimeRecords(db, input),
    syncPulseCheckProtocolRegistrySeeds: () => syncPulseCheckProtocolRegistrySeeds(),
    inspectLegacyCoachRosterFixture: (namespace: string) => inspectLegacyCoachRosterFixture(db, namespace),
    inspectVariant: async (variantId: string) => {
      const snap = await getDoc(doc(db, SIM_VARIANTS_COLLECTION, variantId));
      return snap.exists() ? { id: snap.id, ...snap.data() } : null;
    },
  };
}
