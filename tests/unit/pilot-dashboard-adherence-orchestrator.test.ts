import test from 'node:test';
import assert from 'node:assert/strict';

const loadModules = async () =>
  import('../../src/api/firebase/pulsecheckPilotDashboard/adherenceOrchestrator');

test('adherence orchestrator resolves canonical athlete-day states', async () => {
  const { resolveAthleteDayAdherenceState } = await loadModules();

  assert.equal(resolveAthleteDayAdherenceState({
    expected: false,
    checkInCompleted: false,
    assignmentCompleted: false,
    assignmentStarted: false,
  }), 'excused');

  assert.equal(resolveAthleteDayAdherenceState({
    expected: true,
    checkInCompleted: true,
    assignmentCompleted: true,
    assignmentStarted: true,
  }), 'closed');

  assert.equal(resolveAthleteDayAdherenceState({
    expected: true,
    checkInCompleted: true,
    assignmentCompleted: true,
    assignmentStarted: true,
    rescued: true,
  }), 'rescued');

  assert.equal(resolveAthleteDayAdherenceState({
    expected: true,
    checkInCompleted: true,
    assignmentCompleted: false,
    assignmentStarted: false,
  }), 'checked_in');

  assert.equal(resolveAthleteDayAdherenceState({
    expected: true,
    checkInCompleted: false,
    assignmentCompleted: false,
    assignmentStarted: true,
  }), 'task_started');
});

test('adherence orchestrator summarizes dashboard counts without private content', async () => {
  const { buildPilotAdherenceOrchestratorSummary } = await loadModules();

  const summary = buildPilotAdherenceOrchestratorSummary({
    expectedAthleteDays: 6,
    completedCheckInDays: 5,
    completedAssignmentDays: 4,
    adheredDays: 3,
    activeAthleteCount: 2,
    orchestrator: {
      expectedDays: 6,
      closedDays: 3,
      rescuedDays: 1,
      missedDays: 1,
      excusedDays: 2,
      checkInOnlyDays: 2,
      taskOnlyDays: 1,
      taskStartedOnlyDays: 0,
      openDays: 4,
      atRiskAthleteCount: 2,
      byAthlete: {
        athleteA: { expectedDays: 3, closedDays: 3, openDays: 0 },
        athleteB: { expectedDays: 3, closedDays: 0, openDays: 3 },
      },
      privacyBoundary: {
        statement: 'Nora does not show coaches raw reflections, mental health disclosures, chat transcripts, or private sleep details.',
      },
      privateContentExposed: false,
    },
  });

  assert.equal(summary.expectedAthleteDays, 6);
  assert.equal(summary.closedDays, 3);
  assert.equal(summary.rescuedDays, 1);
  assert.equal(summary.checkInOnlyDays, 2);
  assert.equal(summary.taskOnlyDays, 1);
  assert.equal(summary.missedDays, 1);
  assert.equal(summary.excusedDays, 2);
  assert.equal(summary.atRiskAthleteCount, 2);
  assert.equal(summary.privateContentExposed, false);
  assert.match(summary.privacyBoundary, /does not show coaches raw reflections/i);
});

test('adherence orchestrator detects explicit rescue completion signals', async () => {
  const { isRescuedAdherenceCompletion } = await loadModules();

  assert.equal(isRescuedAdherenceCompletion({
    assignment: { status: 'completed' },
    completionEvent: { metricPayload: { completionSource: 'late_rescue_nudge' } },
  }), true);

  assert.equal(isRescuedAdherenceCompletion({
    assignment: { status: 'completed' },
    completionEvent: { metricPayload: { completionSource: 'normal_session' } },
  }), false);
});
