const test = require('node:test');
const assert = require('node:assert/strict');

const { loadPulsecheckMetrics } = require('./pulsecheck-test-helpers.cjs');

const DAY_MS = 24 * 60 * 60 * 1000;
const CREATED_AT = Date.parse('2026-03-29T09:00:00.000Z');

test('adherence orchestrator classifies the canonical athlete-day states', () => {
  const { classifyAthleteDayAdherenceState } = loadPulsecheckMetrics();

  assert.equal(classifyAthleteDayAdherenceState({ expected: false }), 'excused');
  assert.equal(classifyAthleteDayAdherenceState({
    expected: true,
    checkInCompleted: true,
    assignmentCompleted: true,
  }), 'closed');
  assert.equal(classifyAthleteDayAdherenceState({
    expected: true,
    checkInCompleted: true,
    assignmentCompleted: true,
    completionEvent: { metricPayload: { adherenceRescue: true } },
  }), 'rescued');
  assert.equal(classifyAthleteDayAdherenceState({
    expected: true,
    checkInCompleted: true,
    assignmentCompleted: false,
  }), 'checked_in');
  assert.equal(classifyAthleteDayAdherenceState({
    expected: true,
    checkInCompleted: false,
    assignmentCompleted: true,
  }), 'task_only');
  assert.equal(classifyAthleteDayAdherenceState({
    expected: true,
    checkInCompleted: false,
    assignmentCompleted: false,
    assignment: { status: 'started' },
  }), 'task_started');
  assert.equal(classifyAthleteDayAdherenceState({
    expected: true,
    checkInCompleted: false,
    assignmentCompleted: false,
  }), 'missed');
});

test('adherence orchestrator counts closed, rescued, partial, missed, excused, and at-risk days without private content', () => {
  const { computeAdherenceSummary } = loadPulsecheckMetrics();
  const dateKey = '2026-03-30';
  const athletes = ['closed-rescue', 'checkin-only', 'task-only', 'excused-rest', 'missed'];
  const enrollments = athletes.map((athleteId) => ({
    id: `enrollment-${athleteId}`,
    userId: athleteId,
    teamMembershipId: `membership-${athleteId}`,
    status: 'active',
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
  }));
  const membershipMap = new Map(
    athletes.map((athleteId) => [
      `membership-${athleteId}`,
      {
        id: `membership-${athleteId}`,
        userId: athleteId,
        athleteOnboarding: { timezone: 'UTC' },
      },
    ]),
  );
  const assignmentList = [
    {
      athleteId: 'closed-rescue',
      sourceDate: dateKey,
      status: 'completed',
      actionType: 'sim',
      updatedAt: CREATED_AT + DAY_MS,
      metadata: {
        privateReflection: 'I am worried coach will punish poor sleep.',
        rawReflection: 'Keep this with Nora.',
      },
    },
    {
      athleteId: 'checkin-only',
      sourceDate: dateKey,
      status: 'assigned',
      actionType: 'protocol',
      updatedAt: CREATED_AT + DAY_MS,
    },
    {
      athleteId: 'task-only',
      sourceDate: dateKey,
      status: 'completed',
      actionType: 'lighter_sim',
      updatedAt: CREATED_AT + DAY_MS,
    },
    {
      athleteId: 'excused-rest',
      sourceDate: dateKey,
      status: 'deferred',
      actionType: 'defer',
      updatedAt: CREATED_AT + DAY_MS,
    },
  ];
  const assignmentsByAthlete = assignmentList.reduce((accumulator, assignment) => {
    const current = accumulator.get(assignment.athleteId) || [];
    current.push(assignment);
    accumulator.set(assignment.athleteId, current);
    return accumulator;
  }, new Map());
  const dailyAssignmentState = assignmentList.reduce((accumulator, assignment) => {
    accumulator.set(`${assignment.athleteId}::${assignment.sourceDate}`, assignment);
    return accumulator;
  }, new Map());
  const checkIns = new Map([
    ['closed-rescue::2026-03-30', { eventType: 'daily_checkin_completed' }],
    ['checkin-only::2026-03-30', { eventType: 'daily_checkin_completed' }],
  ]);
  const assignmentCompletions = new Map([
    ['closed-rescue::2026-03-30', {
      eventType: 'daily_assignment_completed',
      metricPayload: {
        adherenceRescue: true,
        mentalHealthDisclosure: 'Private disclosure must stay out of diagnostics.',
      },
    }],
    ['task-only::2026-03-30', { eventType: 'daily_assignment_completed' }],
  ]);

  const summary = computeAdherenceSummary({
    enrollments,
    membershipMap,
    assignmentsByAthlete,
    dailyAssignmentState,
    checkIns,
    assignmentCompletions,
    activationEvents: new Map(),
    withdrawalEvents: new Map(),
    operationalRestrictionsByEnrollmentId: new Map(),
    windowStartDate: dateKey,
    windowEndDate: dateKey,
  });

  assert.equal(summary.expectedAthleteDays, 4);
  assert.equal(summary.completedCheckInDays, 2);
  assert.equal(summary.completedAssignmentDays, 2);
  assert.equal(summary.adheredDays, 1);
  assert.equal(summary.orchestrator.closedDays, 1);
  assert.equal(summary.orchestrator.rescuedDays, 1);
  assert.equal(summary.orchestrator.checkInOnlyDays, 1);
  assert.equal(summary.orchestrator.taskOnlyDays, 1);
  assert.equal(summary.orchestrator.missedDays, 1);
  assert.equal(summary.orchestrator.excusedDays, 1);
  assert.equal(summary.orchestrator.atRiskAthleteCount, 3);
  assert.equal(summary.orchestrator.privateContentExposed, false);

  const coachFacingJson = JSON.stringify(summary.orchestrator);
  assert.equal(coachFacingJson.includes('punish poor sleep'), false);
  assert.equal(coachFacingJson.includes('Keep this with Nora'), false);
  assert.equal(coachFacingJson.includes('Private disclosure'), false);
  assert.ok(coachFacingJson.includes('Nora does not show coaches raw reflections'));
});
