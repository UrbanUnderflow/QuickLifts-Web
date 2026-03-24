import { addDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../config';
import { PULSECHECK_ASSIGNMENT_EVENTS_COLLECTION, PULSECHECK_DAILY_ASSIGNMENTS_COLLECTION } from './collections';
import { simModuleLibraryService, isLaunchablePublishedExercise } from './exerciseLibraryService';
import { protocolRegistryService } from './protocolRegistryService';
import { trainingPlanService } from './trainingPlanService';
import type { ProgramPrescription, TaxonomyProfile } from './taxonomy';
import type {
  PulseCheckDailyAssignment,
  PulseCheckStateSnapshot,
  PulseCheckTrainingPlan,
  PulseCheckTrainingPlanAssignedBy,
  PulseCheckTrainingPlanAuthoringTrigger,
} from './types';
import { pulseCheckDailyAssignmentFromFirestore } from './types';
import trainingPlanAuthoringShared from './trainingPlanAuthoringShared';

const {
  buildProgramPrescriptionId,
  buildTrainingPlan,
  resolvePlanAuthoringTrigger,
  syncTrainingPlanProgression,
} = trainingPlanAuthoringShared as unknown as {
  buildProgramPrescriptionId: (athleteId: string, activeProgram?: ProgramPrescription | null) => string | null;
  buildTrainingPlan: (input: Record<string, unknown>) => PulseCheckTrainingPlan;
  resolvePlanAuthoringTrigger: (input: Record<string, unknown>) => {
    shouldAuthor: boolean;
    trigger: PulseCheckTrainingPlanAuthoringTrigger | null;
    reason: string;
    exploratoryWindowRepCount: number;
    lowConfidence: boolean;
  };
  syncTrainingPlanProgression: (plan: PulseCheckTrainingPlan) => PulseCheckTrainingPlan;
};

export interface MaybeAuthorPrimaryPlanInput {
  athleteId: string;
  profile?: TaxonomyProfile | null;
  hasBaselineAssessment?: boolean;
  activeProgram?: ProgramPrescription | null;
  snapshot?: PulseCheckStateSnapshot | null;
  coachId?: string;
  sourceDate: string;
  timezone?: string;
  sourceStateSnapshotId?: string | null;
  sourceProfileSnapshotId?: string | null;
  triggerOverride?: PulseCheckTrainingPlanAuthoringTrigger | null;
  assignedBy?: PulseCheckTrainingPlanAssignedBy;
  now?: number;
}

export interface TrainingPlanAuthoringResult {
  action: 'noop' | 'authored' | 'superseded';
  plan: PulseCheckTrainingPlan | null;
  supersededPlan: PulseCheckTrainingPlan | null;
  reason: string;
}

const sortPlans = (left: PulseCheckTrainingPlan, right: PulseCheckTrainingPlan) =>
  (right.updatedAt || right.createdAt) - (left.updatedAt || left.createdAt);

function stripUndefinedDeep<T>(value: T): T {
  if (Array.isArray(value)) {
    return value
      .map((entry) => stripUndefinedDeep(entry))
      .filter((entry) => entry !== undefined) as T;
  }

  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).reduce((accumulator, [key, entry]) => {
      const cleaned = stripUndefinedDeep(entry);
      if (cleaned !== undefined) {
        (accumulator as Record<string, unknown>)[key] = cleaned;
      }
      return accumulator;
    }, {} as Record<string, unknown>) as T;
  }

  return (value === undefined ? undefined : value) as T;
}

const sortAssignments = (left: PulseCheckDailyAssignment, right: PulseCheckDailyAssignment) => {
  if (left.sourceDate !== right.sourceDate) {
    return String(right.sourceDate || '').localeCompare(String(left.sourceDate || ''));
  }
  return (right.updatedAt || right.createdAt) - (left.updatedAt || left.createdAt);
};

async function listRecentAssignments(athleteId: string): Promise<PulseCheckDailyAssignment[]> {
  const snapshot = await getDocs(
    query(collection(db, PULSECHECK_DAILY_ASSIGNMENTS_COLLECTION), where('athleteId', '==', athleteId))
  );

  return snapshot.docs
    .map((docSnap) =>
      pulseCheckDailyAssignmentFromFirestore(docSnap.id, docSnap.data() as Record<string, any>)
    )
    .sort(sortAssignments)
    .slice(0, 8);
}

function pickPrimaryPlan(plans: PulseCheckTrainingPlan[]): PulseCheckTrainingPlan | null {
  return plans
    .filter((plan) => plan.isPrimary)
    .sort(sortPlans)[0] || plans.sort(sortPlans)[0] || null;
}

async function supersedeExistingPrimaryPlan(
  plan: PulseCheckTrainingPlan,
  replacementPlanId: string,
  reason: string,
  now: number
): Promise<PulseCheckTrainingPlan> {
  const supersededPlan = syncTrainingPlanProgression({
    ...plan,
    status: 'superseded',
    isPrimary: false,
    supersededByPlanId: replacementPlanId,
    supersededReason: reason,
    updatedAt: now,
  });

  await trainingPlanService.save(supersededPlan);
  return supersededPlan;
}

async function loadLiveAuthoringInventory() {
  const [liveProtocolRegistry, liveSimRegistry] = await Promise.all([
    protocolRegistryService.listPublished(),
    simModuleLibraryService.getAll(),
  ]);

  return {
    liveProtocolRegistry,
    liveSimRegistry: liveSimRegistry.filter((exercise) => isLaunchablePublishedExercise(exercise)),
  };
}

function buildPlanEventRecord({
  eventType,
  plan,
  actorType,
  actorUserId,
  eventAt,
  reason,
  step,
  metadata,
}: {
  eventType: string;
  plan?: PulseCheckTrainingPlan | null;
  actorType: 'coach' | 'system';
  actorUserId: string;
  eventAt: number;
  reason?: string;
  step?: PulseCheckTrainingPlan['steps'][number] | null;
  metadata?: Record<string, unknown>;
}) {
  const sourceDate = plan?.sourceDate || '';
  return stripUndefinedDeep({
    assignmentId: plan?.sourceDailyTaskId || `plan:${plan?.id || 'unknown'}`,
    athleteId: plan?.athleteId || '',
    teamId: '',
    sourceDate,
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

async function writePlanAuthoringEvents({
  plan,
  supersededPlan,
  actorType,
  actorUserId,
  eventAt,
  reason,
}: {
  plan: PulseCheckTrainingPlan;
  supersededPlan?: PulseCheckTrainingPlan | null;
  actorType: 'coach' | 'system';
  actorUserId: string;
  eventAt: number;
  reason: string;
}) {
  const events = [
    buildPlanEventRecord({
      eventType: 'training_plan_authored',
      plan,
      actorType,
      actorUserId,
      eventAt,
      reason,
    }),
    ...plan.steps.map((step) =>
      buildPlanEventRecord({
        eventType: 'training_plan_step_authored',
        plan,
        actorType,
        actorUserId,
        eventAt,
        reason,
        step,
        metadata: {
          stepLabel: step.stepLabel,
          stepStatus: step.stepStatus,
          actionType: step.actionType,
          exerciseId: step.exerciseId,
        },
      })
    ),
  ];

  if (supersededPlan) {
    events.push(
      buildPlanEventRecord({
        eventType: 'training_plan_superseded',
        plan: supersededPlan,
        actorType,
        actorUserId,
        eventAt,
        reason,
        metadata: {
          supersededByPlanId: plan.id,
        },
      })
    );
  }

  await Promise.all(
    events.map((entry) => addDoc(collection(db, PULSECHECK_ASSIGNMENT_EVENTS_COLLECTION), entry))
  );
}

async function writePlanAuthoringFailureEvent({
  athleteId,
  sourceDate,
  trigger,
  actorType,
  actorUserId,
  eventAt,
  reason,
  error,
}: {
  athleteId: string;
  sourceDate: string;
  trigger?: PulseCheckTrainingPlanAuthoringTrigger | null;
  actorType: 'coach' | 'system';
  actorUserId: string;
  eventAt: number;
  reason: string;
  error: unknown;
}) {
  await addDoc(
    collection(db, PULSECHECK_ASSIGNMENT_EVENTS_COLLECTION),
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
        reason,
        authoringTrigger: trigger || null,
        errorMessage: error instanceof Error ? error.message : String(error || ''),
      },
      createdAt: eventAt,
    })
  );
}

export const trainingPlanAuthoringService = {
  async maybeAuthorPrimaryPlan(input: MaybeAuthorPrimaryPlanInput): Promise<TrainingPlanAuthoringResult> {
    const now = input.now || Date.now();
    const [allPlans, recentAssignments, inventory] = await Promise.all([
      trainingPlanService.listForAthlete(input.athleteId),
      listRecentAssignments(input.athleteId),
      loadLiveAuthoringInventory(),
    ]);

    const primaryPlan = pickPrimaryPlan(allPlans);
    const hasBaselineAssessment = input.hasBaselineAssessment ?? Boolean(input.profile && input.profile.updatedAt);
    const triggerDecision = resolvePlanAuthoringTrigger({
      primaryPlan,
      recentPlans: allPlans,
      profile: input.profile,
      activeProgram: input.activeProgram,
      snapshot: input.snapshot,
      recentAssignments,
      hasBaselineAssessment,
    });

    const trigger = input.triggerOverride || triggerDecision.trigger;
    if (!triggerDecision.shouldAuthor || !trigger) {
      return {
        action: 'noop',
        plan: primaryPlan,
        supersededPlan: null,
        reason: triggerDecision.reason,
      };
    }

    const actorType: 'coach' | 'system' = (input.assignedBy || 'nora') === 'coach' ? 'coach' : 'system';
    const actorUserId = input.coachId || (actorType === 'coach' ? input.athleteId : 'pulsecheck-plan-authoring');

    let nextPlan: PulseCheckTrainingPlan;
    try {
      nextPlan = buildTrainingPlan({
        athleteId: input.athleteId,
        assignedBy: input.assignedBy || 'nora',
        coachId: input.coachId,
        trigger,
        profile: input.profile,
        activeProgram: input.activeProgram,
        snapshot: input.snapshot,
        sourceDate: input.sourceDate,
        timezone: input.timezone,
        sourceStateSnapshotId: input.sourceStateSnapshotId,
        sourceProfileSnapshotId: input.sourceProfileSnapshotId,
        sourceProgramPrescriptionId:
          buildProgramPrescriptionId(input.athleteId, input.activeProgram) || undefined,
        sourceProgramGeneratedAt: input.activeProgram?.generatedAt,
        exploratoryWindowRepCount: triggerDecision.exploratoryWindowRepCount,
        lowConfidence: triggerDecision.lowConfidence,
        recentPlans: allPlans,
        liveProtocolRegistry: inventory.liveProtocolRegistry,
        liveSimRegistry: inventory.liveSimRegistry,
        now,
      });
    } catch (error) {
      await writePlanAuthoringFailureEvent({
        athleteId: input.athleteId,
        sourceDate: input.sourceDate,
        trigger,
        actorType,
        actorUserId,
        eventAt: now,
        reason: triggerDecision.reason,
        error,
      }).catch((eventError) => {
        console.error('[trainingPlanAuthoringService] Failed to write authoring failure event:', eventError);
      });
      throw error;
    }

    let supersededPlan: PulseCheckTrainingPlan | null = null;
    if (primaryPlan && primaryPlan.id !== nextPlan.id && primaryPlan.status !== 'completed') {
      supersededPlan = await supersedeExistingPrimaryPlan(
        primaryPlan,
        nextPlan.id,
        triggerDecision.reason,
        now
      );
    }

    await trainingPlanService.save(nextPlan);
    await writePlanAuthoringEvents({
      plan: nextPlan,
      supersededPlan,
      actorType,
      actorUserId,
      eventAt: now,
      reason: triggerDecision.reason,
    }).catch((error) => {
      console.error('[trainingPlanAuthoringService] Failed to write training-plan authoring events:', error);
    });

    return {
      action: supersededPlan ? 'superseded' : 'authored',
      plan: nextPlan,
      supersededPlan,
      reason: triggerDecision.reason,
    };
  },

  async authorCoachPrimaryPlan(
    input: Omit<MaybeAuthorPrimaryPlanInput, 'assignedBy' | 'triggerOverride'> & {
      coachId: string;
    }
  ): Promise<TrainingPlanAuthoringResult> {
    return this.maybeAuthorPrimaryPlan({
      ...input,
      assignedBy: 'coach',
      triggerOverride: 'coach_manual',
    });
  },
};
