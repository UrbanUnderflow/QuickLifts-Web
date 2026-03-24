const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createFirestoreMock,
  loadDailyTaskTrainingPlanRuntime,
} = require('./_tsRuntimeHarness.cjs');

function loadReadModel({ dailyAssignments = [], activePlans = [], curriculumAssignments = [], legacyAssignments = [] }) {
  const firestore = createFirestoreMock({
    'pulsecheck-daily-assignments': dailyAssignments.map((assignment) => ({
      id: assignment.id,
      data: assignment,
    })),
  });

  return {
    firestore,
    service: loadDailyTaskTrainingPlanRuntime({
      'firebase/firestore': firestore.firestoreModule,
      '../config': { db: firestore.db },
      './trainingPlanService': {
        trainingPlanService: {
          listActiveForAthlete: async () => activePlans,
        },
      },
      './curriculumAssignmentService': {
        curriculumAssignmentService: {
          getAllForAthlete: async () => curriculumAssignments,
        },
      },
      './assignmentService': {
        assignmentService: {
          getForAthlete: async () => legacyAssignments,
        },
      },
    }).service.dailyTaskTrainingPlanReadModelService,
  };
}

test('loadForAthlete surfaces a daily task from the unified runtime model only', async () => {
  const { service } = loadReadModel({
    dailyAssignments: [
      {
        id: 'athlete-1_2026-03-20',
        athleteId: 'athlete-1',
        sourceDate: '2026-03-20',
        status: 'assigned',
        actionType: 'sim',
        simSpecId: 'endurance_lock',
        legacyExerciseId: 'focus-endurance-lock',
        simFamilyLabel: 'Endurance Lock',
        simVariantLabel: 'Steady Pressure',
        rationale: 'Keep the rep steady and build from there.',
        createdAt: 1742420000000,
        updatedAt: 1742420600000,
        isPrimaryForDate: true,
        trainingPlanId: 'training-plan-1',
        trainingPlanStepId: 'training-plan-1_step_1',
        trainingPlanStepIndex: 1,
        trainingPlanStepLabel: 'Endurance Lock',
      },
      {
        id: 'athlete-1_2026-03-19',
        athleteId: 'athlete-1',
        sourceDate: '2026-03-19',
        status: 'completed',
        actionType: 'sim',
        simSpecId: 'noise_gate',
        rationale: 'Yesterday was completed cleanly.',
        createdAt: 1742330000000,
        updatedAt: 1742330600000,
        isPrimaryForDate: true,
        completionSummary: {
          primaryMetric: {
            key: 'focus_hold',
            label: 'Focus Hold',
            value: 81,
            unit: '%',
          },
          noraTakeaway: 'Steady finish.',
        },
      },
    ],
    activePlans: [
      {
        id: 'training-plan-1',
        athleteId: 'athlete-1',
        title: 'Steady Focus Build',
        goal: 'Hold steady focus without forcing pace.',
        planType: 'sim_focused',
        status: 'active',
        isPrimary: true,
        progressMode: 'sessions',
        targetCount: 5,
        completedCount: 1,
        steps: [
          {
            id: 'training-plan-1_step_1',
            stepIndex: 1,
            stepLabel: 'Endurance Lock',
            stepStatus: 'planned',
            actionType: 'sim',
            exerciseId: 'endurance_lock',
            plannedDurationSeconds: 480,
          },
        ],
        assignedBy: 'nora',
        createdAt: 1742420000000,
        updatedAt: 1742420600000,
      },
    ],
    curriculumAssignments: [
      {
        id: 'curriculum-1',
        athleteId: 'athlete-1',
        coachId: 'coach-1',
        exerciseId: 'focus-endurance-lock',
        exercise: {
          id: 'focus-endurance-lock',
          name: 'Focus Endurance Lock',
        },
        source: 'coach',
        durationDays: 14,
        frequency: 1,
        startDate: 1742330000000,
        endDate: 1743530000000,
        completedDays: 3,
        targetDays: 14,
        completionRate: 21,
        currentDayNumber: 4,
        status: 'active',
        masteryAchieved: false,
        extendedCount: 0,
        reminderEnabled: true,
        reminderTimes: ['08:00'],
        pathway: 'foundation',
        pathwayStep: 2,
        createdAt: 1742330000000,
        updatedAt: 1742420300000,
      },
    ],
    legacyAssignments: [
      {
        id: 'legacy-1',
        athleteUserId: 'athlete-1',
        exerciseId: 'reset-focus',
        exercise: {
          id: 'reset-focus',
          name: 'Reset Focus',
        },
        source: 'coach',
        assignedBy: 'coach-1',
        assignedByName: 'Coach One',
        reason: 'Legacy manual work still in progress.',
        isRecurring: false,
        status: 'pending',
        createdAt: 1742420100000,
        updatedAt: 1742420200000,
      },
    ],
  });

  const model = await service.loadForAthlete('athlete-1', {
    sourceDate: '2026-03-20',
    timezone: 'America/New_York',
  });

  assert.equal(model.todayState, 'has_daily_task');
  assert.equal(model.primarySurfaceSource, 'daily_task');
  assert.equal(model.todayTask?.id, 'athlete-1_2026-03-20');
  assert.equal(model.todayTask?.trainingPlanId, 'training-plan-1');
  assert.equal(model.todayTask?.trainingPlanStepId, 'training-plan-1_step_1');
  assert.equal(model.activePlans.length, 1);
  assert.equal(model.activePlans[0].source, 'training_plan');
  assert.equal(model.activePlans[0].plan.steps[0].stepLabel, 'Endurance Lock');
  assert.equal(model.activePlans[0].plan.steps[0].stepStatus, 'planned');
  assert.equal(model.legacyAdapters.length, 2);
  assert.equal(model.legacyAdapters[0].kind, 'curriculum');
  assert.equal(model.legacyAdapters[1].kind, 'manual');
  assert.equal(model.legacyMigration.curriculumPlanCount, 1);
  assert.equal(model.legacyMigration.secondaryWorkCount, 1);
  assert.equal(model.legacyMigration.primaryFallbackSuppressed, true);
  assert.equal(model.legacyMigration.cutoverReadyForPrimaryFallbackRemoval, false);
  assert.equal(model.recentResults.length, 1);
  assert.equal(model.recentResults[0].status, 'completed');
});

test('loadForAthlete returns no_task_yet when there is a plan but no due-today task', async () => {
  const { service } = loadReadModel({
    dailyAssignments: [],
    activePlans: [
      {
        id: 'training-plan-2',
        athleteId: 'athlete-2',
        title: 'Build Plan',
        goal: 'Build steady reps.',
        planType: 'sim_focused',
        status: 'active',
        isPrimary: true,
        progressMode: 'days',
        targetCount: 14,
        completedCount: 2,
        steps: [],
        assignedBy: 'nora',
        createdAt: 1742420000000,
        updatedAt: 1742420600000,
      },
    ],
    curriculumAssignments: [],
    legacyAssignments: [],
  });

  const model = await service.loadForAthlete('athlete-2', {
    sourceDate: '2026-03-20',
    timezone: 'America/New_York',
  });

  assert.equal(model.todayState, 'no_task_yet');
  assert.equal(model.primarySurfaceSource, 'none');
  assert.equal(model.todayTask, null);
  assert.equal(model.activePlans.length >= 1, true);
  assert.equal(model.activePlans[0].source, 'training_plan');
});

test('loadForAthlete returns between_programs when there is recent completed work but no active plan', async () => {
  const { service } = loadReadModel({
    dailyAssignments: [
      {
        id: 'athlete-3_2026-03-19',
        athleteId: 'athlete-3',
        sourceDate: '2026-03-19',
        status: 'completed',
        actionType: 'sim',
        simSpecId: 'reset',
        rationale: 'Previous program finished cleanly.',
        createdAt: 1742330000000,
        updatedAt: 1742330600000,
        isPrimaryForDate: true,
        completionSummary: {
          primaryMetric: {
            key: 'recovery_time',
            label: 'Recovery Time',
            value: 1.84,
            unit: 's',
          },
          noraTakeaway: 'Good finish.',
        },
      },
    ],
    activePlans: [],
    curriculumAssignments: [],
    legacyAssignments: [],
  });

  const model = await service.loadForAthlete('athlete-3', {
    sourceDate: '2026-03-20',
    timezone: 'America/New_York',
  });

  assert.equal(model.todayState, 'between_programs');
  assert.equal(model.primarySurfaceSource, 'none');
  assert.equal(model.todayTask, null);
  assert.equal(model.activePlans.length, 0);
  assert.equal(model.recentResults.length, 1);
  assert.equal(model.recentResults[0].status, 'completed');
});

test('loadForAthlete includes legacy curriculum and manual adapters without letting them become the primary surface', async () => {
  const { service } = loadReadModel({
    dailyAssignments: [],
    activePlans: [],
    curriculumAssignments: [
      {
        id: 'curriculum-2',
        athleteId: 'athlete-4',
        coachId: 'coach-1',
        exerciseId: 'focus-endurance-lock',
        exercise: {
          id: 'focus-endurance-lock',
          name: 'Focus Endurance Lock',
        },
        source: 'coach',
        durationDays: 14,
        frequency: 1,
        startDate: 1742330000000,
        endDate: 1743530000000,
        completedDays: 1,
        targetDays: 14,
        completionRate: 7,
        currentDayNumber: 2,
        status: 'active',
        masteryAchieved: false,
        extendedCount: 0,
        reminderEnabled: true,
        reminderTimes: ['08:00'],
        pathway: 'foundation',
        pathwayStep: 1,
        createdAt: 1742330000000,
        updatedAt: 1742420300000,
      },
    ],
    legacyAssignments: [
      {
        id: 'legacy-2',
        athleteUserId: 'athlete-4',
        exerciseId: 'reset-focus',
        exercise: {
          id: 'reset-focus',
          name: 'Reset Focus',
        },
        source: 'self',
        assignedBy: 'athlete-4',
        isRecurring: false,
        status: 'in_progress',
        createdAt: 1742420100000,
        updatedAt: 1742420400000,
      },
    ],
  });

  const model = await service.loadForAthlete('athlete-4', {
    sourceDate: '2026-03-20',
    timezone: 'America/New_York',
  });

  assert.equal(model.todayState, 'no_task_yet');
  assert.equal(model.primarySurfaceSource, 'none');
  assert.equal(model.todayTask, null);
  assert.equal(model.legacyAdapters.length, 2);
  assert.equal(model.legacyMigration.curriculumPlanCount, 1);
  assert.equal(model.legacyMigration.secondaryWorkCount, 1);
  assert.equal(model.legacyMigration.primaryFallbackSuppressed, false);
  assert.equal(model.legacyMigration.cutoverReadyForPrimaryFallbackRemoval, false);
});
