const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const repoRoot = '/Users/tremainegrant/Documents/GitHub/QuickLifts-Web';
const recordPath = path.join(repoRoot, 'netlify/functions/record-pulsecheck-assignment-event.js');
const configPath = path.join(repoRoot, 'netlify/functions/config/firebase.js');
const submitPath = path.join(repoRoot, 'netlify/functions/submit-pulsecheck-checkin.js');

function loadHandler({ db, decodedUid = 'athlete-1', runtimeHelpersMock = {} }) {
  delete require.cache[recordPath];
  delete require.cache[configPath];
  delete require.cache[submitPath];

  const firestoreFn = () => db;
  firestoreFn.FieldValue = {
    serverTimestamp: () => 'server-timestamp',
  };

  require.cache[configPath] = {
    id: configPath,
    filename: configPath,
    loaded: true,
    exports: {
      initializeFirebaseAdmin: () => {},
      getFirebaseAdminApp: () => ({}),
      admin: {
        auth: () => ({
          verifyIdToken: async () => ({ uid: decodedUid }),
        }),
        firestore: firestoreFn,
      },
      headers: {},
    },
  };

  require.cache[submitPath] = {
    id: submitPath,
    filename: submitPath,
    loaded: true,
    exports: {
      runtimeHelpers: {
        listLiveProtocolRegistry: async () => [],
        getOrRefreshProtocolResponsivenessProfile: async () => ({
          athleteId: 'athlete-1',
          familyResponses: {},
          variantResponses: {},
        }),
        ...runtimeHelpersMock,
      },
    },
  };

  return require(recordPath).handler;
}

function createDb({
  assignment,
  trainingPlan,
  snapshot,
  memberships = [],
}) {
  const writes = {
    assignments: [],
    events: [],
    plans: [],
    snapshots: [],
    profiles: [],
  };

  const assignmentStore = new Map([[assignment.id, assignment]]);
  const trainingPlanStore = new Map([[trainingPlan.id, trainingPlan]]);
  const snapshotStore = new Map([[snapshot.id, snapshot]]);
  const membershipStore = new Map(memberships.map((entry) => [entry.id, entry]));
  const profileStore = new Map();
  let eventCounter = 0;

  const getDocResult = (store, id) => {
    const data = store.get(id);
    if (!data) {
      return { exists: false, id, data: () => undefined };
    }
    return { exists: true, id, data: () => data };
  };

  return {
    writes,
    collection(name) {
      if (name === 'pulsecheck-daily-assignments') {
        return {
          doc(id) {
            return {
              async get() {
                return getDocResult(assignmentStore, id);
              },
              async set(data) {
                const next = { ...(assignmentStore.get(id) || { id }), ...data };
                assignmentStore.set(id, next);
                writes.assignments.push({ id, data: next });
              },
            };
          },
        };
      }

      if (name === 'pulsecheck-training-plans') {
        return {
          doc(id) {
            return {
              async get() {
                return getDocResult(trainingPlanStore, id);
              },
              async set(data) {
                const next = { ...(trainingPlanStore.get(id) || { id }), ...data };
                trainingPlanStore.set(id, next);
                writes.plans.push({ id, data: next });
              },
            };
          },
        };
      }

      if (name === 'state-snapshots') {
        return {
          doc(id) {
            return {
              async get() {
                return getDocResult(snapshotStore, id);
              },
              async set(data) {
                const next = { ...(snapshotStore.get(id) || { id }), ...data };
                snapshotStore.set(id, next);
                writes.snapshots.push({ id, data: next });
              },
            };
          },
        };
      }

      if (name === 'pulsecheck-team-memberships') {
        return {
          doc(id) {
            return {
              async get() {
                return getDocResult(membershipStore, id);
              },
            };
          },
        };
      }

      if (name === 'pulsecheck-assignment-events') {
        return {
          doc(id = `event-${++eventCounter}`) {
            return {
              id,
              async set(data) {
                writes.events.push({ id, data });
              },
            };
          },
        };
      }

      if (name === 'pulsecheck-protocol-responsiveness-profiles') {
        return {
          doc(id) {
            return {
              async get() {
                return getDocResult(profileStore, id);
              },
              async set(data) {
                const next = { ...(profileStore.get(id) || { id }), ...data };
                profileStore.set(id, next);
                writes.profiles.push({ id, data: next });
              },
            };
          },
        };
      }

      throw new Error(`Unexpected collection: ${name}`);
    },
  };
}

function parseBody(response) {
  assert.equal(response.statusCode, 200);
  return JSON.parse(response.body);
}

test('started, paused, resumed, and completed events keep plan and assignment status in sync', async () => {
  const db = createDb({
      assignment: {
        id: 'athlete-1_2026-03-20',
        athleteId: 'athlete-1',
        teamId: 'team-1',
        sourceDate: '2026-03-20',
        status: 'assigned',
        actionType: 'sim',
        trainingPlanId: 'training-plan-1',
        trainingPlanStepId: 'training-plan-1_step_1',
        trainingPlanStepIndex: 1,
        trainingPlanStepLabel: 'Endurance Lock',
        executionPattern: 'protocol_then_sim',
        phaseProgress: {
          currentPhaseIndex: 1,
          totalPhases: 2,
          currentPhaseLabel: 'Protocol',
          phaseLabels: ['Protocol', 'Sim'],
        },
        completionSummary: null,
        createdAt: 1742420000000,
        updatedAt: 1742420000000,
      },
      trainingPlan: {
        id: 'training-plan-1',
        athleteId: 'athlete-1',
        title: 'Steady Focus Build',
        goal: 'Hold steady focus without forcing pace.',
        planType: 'mixed',
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
            linkedDailyTaskId: 'athlete-1_2026-03-20',
            linkedDailyTaskSourceDate: '2026-03-20',
            dueSourceDate: '2026-03-20',
            timezone: 'America/New_York',
          },
        ],
        assignedBy: 'nora',
        createdAt: 1742420000000,
        updatedAt: 1742420000000,
      },
      snapshot: {
        id: 'athlete-1_2026-03-20',
        sourceDate: '2026-03-20',
        overallReadiness: 'yellow',
        confidence: 'medium',
        recommendedRouting: 'protocol_then_sim',
        recommendedProtocolClass: 'regulation',
        stateDimensions: {
          activation: 64,
          focusReadiness: 58,
          emotionalLoad: 44,
          cognitiveFatigue: 30,
        },
      },
  });

  const handler = loadHandler({
    db,
    runtimeHelpersMock: {
      listLiveProtocolRegistry: async () => [],
      getOrRefreshProtocolResponsivenessProfile: async () => ({
        athleteId: 'athlete-1',
        familyResponses: {},
        variantResponses: {},
      }),
    },
  });

  const started = parseBody(await handler({
    httpMethod: 'POST',
    headers: { authorization: 'Bearer token' },
    body: JSON.stringify({
      assignmentId: 'athlete-1_2026-03-20',
      eventType: 'started',
      actorUserId: 'athlete-1',
    }),
  }));

  assert.equal(started.assignment.status, 'started');
  assert.equal(started.event.eventType, 'started');
  assert.equal(started.planSideEffect.event.eventType, 'plan_step_activated');
  assert.equal(started.planSideEffect.step.stepStatus, 'active_today');

  const paused = parseBody(await handler({
    httpMethod: 'POST',
    headers: { authorization: 'Bearer token' },
    body: JSON.stringify({
      assignmentId: 'athlete-1_2026-03-20',
      eventType: 'paused',
      actorUserId: 'athlete-1',
    }),
  }));

  assert.equal(paused.assignment.status, 'paused');
  assert.equal(paused.event.eventType, 'paused');
  if (paused.planSideEffect) {
    assert.equal(paused.planSideEffect.event.eventType, 'plan_step_activated');
    assert.equal(paused.planSideEffect.step.stepStatus, 'active_today');
  }

  const resumed = parseBody(await handler({
    httpMethod: 'POST',
    headers: { authorization: 'Bearer token' },
    body: JSON.stringify({
      assignmentId: 'athlete-1_2026-03-20',
      eventType: 'resumed',
      actorUserId: 'athlete-1',
    }),
  }));

  assert.equal(resumed.assignment.status, 'started');
  assert.equal(resumed.assignment.resumedAt > 0, true);
  if (resumed.planSideEffect) {
    assert.equal(resumed.planSideEffect.event.eventType, 'plan_step_activated');
    assert.equal(resumed.planSideEffect.step.stepStatus, 'active_today');
  }

  const completed = parseBody(await handler({
    httpMethod: 'POST',
    headers: { authorization: 'Bearer token' },
    body: JSON.stringify({
      assignmentId: 'athlete-1_2026-03-20',
      eventType: 'completed',
      actorUserId: 'athlete-1',
      metadata: {
        completionSummary: {
          primaryMetric: {
            key: 'focus_hold',
            label: 'Focus Hold',
            value: 84,
            unit: '%',
          },
          noraTakeaway: 'That was steady and clean.',
          durationSeconds: 480,
        },
      },
    }),
  }));

  assert.equal(completed.assignment.status, 'completed');
  assert.equal(completed.assignment.completionSummary.noraTakeaway, 'That was steady and clean.');
  assert.equal(completed.event.eventType, 'completed');
  assert.equal(completed.planSideEffect.event.eventType, 'plan_step_completed');
  assert.equal(completed.planSideEffect.step.stepStatus, 'completed');
  assert.equal(completed.planSideEffect.plan.status, 'active');
  assert.equal(completed.planSideEffect.plan.latestResultSummary, 'That was steady and clean.');
  assert.equal(completed.stateSnapshot.stateDimensions.focusReadiness > started.stateSnapshot.stateDimensions.focusReadiness, true);
  assert.deepEqual(
    db.writes.events.map((entry) => entry.data.eventType),
    [
      'started',
      'plan_step_activated',
      'paused',
      'plan_step_activated',
      'training_plan_paused',
      'resumed',
      'plan_step_activated',
      'training_plan_resumed',
      'completed',
      'plan_step_completed',
    ]
  );
  assert.equal(db.writes.events.some((entry) => entry.data.eventType === 'plan_step_activated'), true);
});

test('coach overrides mark the original step overridden and refresh the daily snapshot', async () => {
  const db = createDb({
      assignment: {
        id: 'athlete-1_2026-03-21',
        athleteId: 'athlete-1',
        teamId: 'team-1',
        sourceDate: '2026-03-21',
        status: 'assigned',
        actionType: 'sim',
        trainingPlanId: 'training-plan-2',
        trainingPlanStepId: 'training-plan-2_step_1',
        trainingPlanStepIndex: 1,
        trainingPlanStepLabel: 'Endurance Lock',
        createdAt: 1742500000000,
        updatedAt: 1742500000000,
      },
      trainingPlan: {
        id: 'training-plan-2',
        athleteId: 'athlete-1',
        title: 'Steady Focus Build',
        goal: 'Hold steady focus without forcing pace.',
        planType: 'mixed',
        status: 'active',
        isPrimary: true,
        progressMode: 'sessions',
        targetCount: 5,
        completedCount: 1,
        steps: [
          {
            id: 'training-plan-2_step_1',
            stepIndex: 1,
            stepLabel: 'Endurance Lock',
            stepStatus: 'planned',
            actionType: 'sim',
            exerciseId: 'endurance_lock',
            linkedDailyTaskId: 'athlete-1_2026-03-21',
            linkedDailyTaskSourceDate: '2026-03-21',
            dueSourceDate: '2026-03-21',
            timezone: 'America/New_York',
          },
        ],
        assignedBy: 'nora',
        createdAt: 1742500000000,
        updatedAt: 1742500000000,
      },
      snapshot: {
        id: 'athlete-1_2026-03-21',
        sourceDate: '2026-03-21',
        overallReadiness: 'red',
        confidence: 'medium',
        recommendedRouting: 'sim_only',
        recommendedProtocolClass: 'none',
        stateDimensions: {
          activation: 84,
          focusReadiness: 26,
          emotionalLoad: 78,
          cognitiveFatigue: 72,
        },
      },
      memberships: [
        {
          id: 'team-1_coach-1',
          role: 'coach',
          userId: 'coach-1',
        },
      ],
    });

  const handler = loadHandler({
    db,
    decodedUid: 'coach-1',
    runtimeHelpersMock: {
      listLiveProtocolRegistry: async () => [],
      getOrRefreshProtocolResponsivenessProfile: async () => ({
        athleteId: 'athlete-1',
        familyResponses: {},
        variantResponses: {},
      }),
    },
  });

  const overridden = parseBody(await handler({
    httpMethod: 'POST',
    headers: { authorization: 'Bearer token' },
    body: JSON.stringify({
      assignmentId: 'athlete-1_2026-03-21',
      eventType: 'overridden',
      actorUserId: 'coach-1',
      reason: 'Coach adjusted the rep for today.',
    }),
  }));

  assert.equal(overridden.assignment.status, 'overridden');
  assert.equal(overridden.assignment.overriddenBy, 'coach-1');
  assert.equal(overridden.event.eventType, 'overridden');
  assert.equal(overridden.planSideEffect.event.eventType, 'plan_step_overridden');
  assert.equal(overridden.planSideEffect.step.stepStatus, 'overridden');
  assert.equal(overridden.stateSnapshot.recommendedRouting, 'defer_alternate_path');
  assert.equal(overridden.stateSnapshot.supportFlag, true);
  assert.equal(db.writes.events.some((entry) => entry.data.eventType === 'overridden'), true);
  assert.equal(db.writes.events.some((entry) => entry.data.eventType === 'plan_step_overridden'), true);
});
