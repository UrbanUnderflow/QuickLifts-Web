const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createFirestoreMock,
  loadTrainingPlanAuthoringRuntime,
} = require('./_tsRuntimeHarness.cjs');

const shared = require('/Users/tremainegrant/Documents/GitHub/QuickLifts-Web/src/api/firebase/mentaltraining/trainingPlanAuthoringShared.js');

function loadAuthoringService({ dailyAssignments = [], trainingPlans = [] }) {
  const firestore = createFirestoreMock({
    'pulsecheck-daily-assignments': dailyAssignments.map((assignment) => ({
      id: assignment.id,
      data: assignment,
    })),
  });

  const savedPlans = [];
  const plans = [...trainingPlans];

  return {
    firestore,
    savedPlans,
    runtime: loadTrainingPlanAuthoringRuntime({
      'firebase/firestore': firestore.firestoreModule,
      '../config': { db: firestore.db },
      './trainingPlanService': {
        trainingPlanService: {
          listForAthlete: async () => plans,
          save: async (plan) => {
            const nextPlan = JSON.parse(JSON.stringify(plan));
            savedPlans.push(nextPlan);
            const existingIndex = plans.findIndex((entry) => entry.id === nextPlan.id);
            if (existingIndex >= 0) {
              plans[existingIndex] = nextPlan;
            } else {
              plans.push(nextPlan);
            }
            return nextPlan;
          },
        },
      },
    }),
  };
}

test('buildTrainingPlan selects the mixed archetype for protocol_then_sim and emits composite step metadata', () => {
  const plan = shared.buildTrainingPlan({
    athleteId: 'athlete-1',
    assignedBy: 'nora',
    trigger: 'baseline_complete',
    profile: {
      weakestSkills: ['sustained_attention'],
    },
    activeProgram: {
      recommendedSimId: 'endurance_lock',
      generatedAt: 1742420000000,
      sessionType: 'training_rep',
    },
    snapshot: {
      recommendedRouting: 'protocol_then_sim',
    },
    sourceDate: '2026-03-20',
    timezone: 'America/New_York',
    now: 1742420000000,
  });

  assert.equal(plan.planType, 'mixed');
  assert.equal(plan.archetypeId, 'mixed_regulate_then_build_v1');
  assert.equal(plan.targetCount, 4);
  assert.equal(plan.steps.length, 4);
  assert.equal(plan.steps[0].executionPattern, 'protocol_then_sim');
  assert.equal(plan.steps[0].simSpecId, 'endurance_lock');
  assert.match(plan.steps[0].stepLabel, /Downshift|Breathing|Endurance Lock/);
});

test('resolvePlanAuthoringTrigger waits for the exploratory window before authoring a low-confidence first plan', () => {
  const waiting = shared.resolvePlanAuthoringTrigger({
    primaryPlan: null,
    profile: null,
    activeProgram: null,
    snapshot: null,
    recentAssignments: [
      { status: 'completed' },
    ],
    hasBaselineAssessment: true,
  });

  assert.equal(waiting.shouldAuthor, false);
  assert.equal(waiting.trigger, null);
  assert.equal(waiting.reason, 'awaiting_exploratory_window');
  assert.equal(waiting.exploratoryWindowRepCount, 1);

  const ready = shared.resolvePlanAuthoringTrigger({
    primaryPlan: null,
    profile: null,
    activeProgram: {
      recommendedSimId: 'endurance_lock',
    },
    snapshot: null,
    recentAssignments: [
      { status: 'completed' },
      { status: 'completed' },
    ],
    hasBaselineAssessment: true,
  });

  assert.equal(ready.shouldAuthor, true);
  assert.equal(ready.trigger, 'exploratory_window_complete');
  assert.equal(ready.exploratoryWindowRepCount, 2);
  assert.match(ready.reason, /Exploratory window completed/);
});

test('maybeAuthorPrimaryPlan supersedes the existing primary plan when the athlete focus shifts', async () => {
  const existingPlan = {
    id: 'athlete-1_plan_nora_1742410000000',
    athleteId: 'athlete-1',
    title: 'Steady Focus Build',
    goal: 'Hold steady focus without forcing pace.',
    planType: 'sim_focused',
    status: 'active',
    isPrimary: true,
    progressMode: 'sessions',
    targetCount: 5,
    completedCount: 2,
    steps: [
      {
        id: 'athlete-1_plan_nora_1742410000000_step_0001',
        stepIndex: 1,
        stepLabel: 'Endurance Lock',
        stepStatus: 'completed',
        actionType: 'sim',
        exerciseId: 'endurance_lock',
      },
    ],
    assignedBy: 'nora',
    authoringFocusSkill: 'sustained_attention',
    createdAt: 1742410000000,
    updatedAt: 1742410000000,
  };

  const { runtime, savedPlans } = loadAuthoringService({
    dailyAssignments: [
      {
        id: 'athlete-1_2026-03-18',
        athleteId: 'athlete-1',
        sourceDate: '2026-03-18',
        status: 'completed',
        actionType: 'sim',
        createdAt: 1742330000000,
        updatedAt: 1742330600000,
        isPrimaryForDate: true,
      },
      {
        id: 'athlete-1_2026-03-19',
        athleteId: 'athlete-1',
        sourceDate: '2026-03-19',
        status: 'completed',
        actionType: 'sim',
        createdAt: 1742416400000,
        updatedAt: 1742416600000,
        isPrimaryForDate: true,
      },
    ],
    trainingPlans: [existingPlan],
  });

  const result = await runtime.service.trainingPlanAuthoringService.maybeAuthorPrimaryPlan({
    athleteId: 'athlete-1',
    profile: {
      weakestSkills: ['cue_discrimination'],
      updatedAt: 1742420000000,
    },
    hasBaselineAssessment: true,
    activeProgram: {
      recommendedSimId: 'signal_window',
      generatedAt: 1742420000000,
      sessionType: 'training_rep',
    },
    snapshot: {
      overallReadiness: 'yellow',
      recommendedRouting: 'sim_only',
    },
    sourceDate: '2026-03-20',
    timezone: 'America/New_York',
    now: 1742420000000,
  });

  assert.equal(result.action, 'superseded');
  assert.equal(result.supersededPlan?.status, 'superseded');
  assert.equal(result.plan?.status, 'active');
  assert.equal(result.plan?.authoringFocusSkill, 'cue_discrimination');
  assert.equal(savedPlans.length, 2);
  assert.equal(savedPlans[0].status, 'superseded');
  assert.equal(savedPlans[1].status, 'active');
});

test('syncTrainingPlanProgression counts composite protocol_then_sim steps as part of one progression chain', () => {
  const basePlan = shared.buildTrainingPlan({
    athleteId: 'athlete-1',
    assignedBy: 'nora',
    trigger: 'baseline_complete',
    profile: {
      weakestSkills: ['sustained_attention'],
    },
    activeProgram: {
      recommendedSimId: 'endurance_lock',
      generatedAt: 1742420000000,
      sessionType: 'training_rep',
    },
    snapshot: {
      recommendedRouting: 'protocol_then_sim',
    },
    sourceDate: '2026-03-20',
    timezone: 'America/New_York',
    now: 1742420000000,
  });

  const progressedPlan = shared.syncTrainingPlanProgression({
    ...basePlan,
    steps: basePlan.steps.map((step, index) => {
      if (index === 0) {
        return {
          ...step,
          stepStatus: 'completed',
          completedAt: 1742420300000,
        };
      }

      if (index === 1) {
        return {
          ...step,
          stepStatus: 'active_today',
          startedAt: 1742420400000,
        };
      }

      return step;
    }),
  });

  assert.equal(progressedPlan.completedCount, 1);
  assert.equal(progressedPlan.currentStepIndex, 2);
  assert.equal(progressedPlan.nextDueStepIndex, 2);
  assert.equal(progressedPlan.lastCompletedStepIndex, 1);
  assert.equal(progressedPlan.steps[0].executionPattern, 'protocol_then_sim');
  assert.equal(progressedPlan.steps[0].stepStatus, 'completed');
});
