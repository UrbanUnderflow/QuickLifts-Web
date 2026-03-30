const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createPulsecheckFirestore,
  loadPulsecheckMetrics,
} = require('./pulsecheck-test-helpers.cjs');

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW_MS = Date.parse('2026-03-30T12:00:00.000Z');
const TODAY_KEY = '2026-03-30';

function runWithNow(nowMs, callback) {
  const originalNow = Date.now;
  Date.now = () => nowMs;
  return Promise.resolve()
    .then(callback)
    .finally(() => {
      Date.now = originalNow;
    });
}

function buildHypothesisEvaluationFixture() {
  const pilotId = 'pilot-hypothesis';
  const organizationId = 'org-hypothesis';
  const teamId = 'team-hypothesis';
  const cohorts = { alpha: 'alpha', beta: 'beta' };

  const athletes = [
    {
      athleteId: 'athlete-state-a',
      enrollmentId: 'enrollment-state-a',
      teamMembershipId: 'membership-state-a',
      cohortId: cohorts.alpha,
      stateAware: true,
      protocolCompleted: true,
      adherence: true,
      mentalPerformanceDelta: 10,
      trustScore: 9,
      npsScore: 8,
      coachTrustScore: 6,
      coachNpsScore: 6,
    },
    {
      athleteId: 'athlete-state-b',
      enrollmentId: 'enrollment-state-b',
      teamMembershipId: 'membership-state-b',
      cohortId: cohorts.beta,
      stateAware: true,
      protocolCompleted: true,
      adherence: true,
      mentalPerformanceDelta: 6,
      trustScore: 8,
      npsScore: 7,
      coachTrustScore: 7,
      coachNpsScore: 5,
    },
    {
      athleteId: 'athlete-fallback-a',
      enrollmentId: 'enrollment-fallback-a',
      teamMembershipId: 'membership-fallback-a',
      cohortId: cohorts.alpha,
      stateAware: false,
      protocolCompleted: false,
      adherence: false,
      mentalPerformanceDelta: 2,
      trustScore: 4,
      npsScore: 3,
      coachTrustScore: null,
      coachNpsScore: null,
    },
    {
      athleteId: 'athlete-fallback-b',
      enrollmentId: 'enrollment-fallback-b',
      teamMembershipId: 'membership-fallback-b',
      cohortId: cohorts.beta,
      stateAware: false,
      protocolCompleted: false,
      adherence: false,
      mentalPerformanceDelta: 1,
      trustScore: 3,
      npsScore: 4,
      coachTrustScore: null,
      coachNpsScore: null,
    },
  ];

  return {
    pilotId,
    organizationId,
    teamId,
    cohorts,
    athletes,
    windowStartMs: NOW_MS,
    windowEndMs: NOW_MS + DAY_MS,
    surveyDiagnostics: {
      minimumResponseThreshold: 5,
      coachTrust: { responseCount: 2, headlineValue: null },
      coachNps: { responseCount: 2, headlineValue: null },
    },
  };
}

function buildHypothesisEvaluationInput(fixture) {
  return {
    enrollments: fixture.athletes.map((athlete) => ({
      id: athlete.enrollmentId,
      pilotId: fixture.pilotId,
      userId: athlete.athleteId,
      organizationId: fixture.organizationId,
      teamId: fixture.teamId,
      cohortId: athlete.cohortId,
      teamMembershipId: athlete.teamMembershipId,
      status: 'active',
    })),
    adherenceSummary: {
      byAthlete: fixture.athletes.reduce((accumulator, athlete) => {
        accumulator[athlete.athleteId] = {
          expectedAthleteDays: 1,
          completedCheckInDays: 1,
          completedAssignmentDays: athlete.adherence ? 1 : 0,
          adheredDays: athlete.adherence ? 1 : 0,
        };
        return accumulator;
      }, {}),
    },
    surveyDiagnostics: fixture.surveyDiagnostics,
    responses: fixture.athletes.flatMap((athlete) => [
      {
        pilotId: fixture.pilotId,
        respondentUserId: athlete.athleteId,
        respondentRole: 'athlete',
        surveyKind: 'trust',
        score: athlete.trustScore,
        submittedAt: NOW_MS,
        athleteId: athlete.athleteId,
      },
      {
        pilotId: fixture.pilotId,
        respondentUserId: `${athlete.athleteId}-nps`,
        respondentRole: 'athlete',
        surveyKind: 'nps',
        score: athlete.npsScore,
        submittedAt: NOW_MS,
        athleteId: athlete.athleteId,
      },
    ]),
    assignments: fixture.athletes.map((athlete) => ({
      athleteId: athlete.athleteId,
      actionType: 'protocol',
      status: athlete.protocolCompleted ? 'completed' : 'assigned',
      sourceStateSnapshotId: athlete.stateAware ? `${athlete.athleteId}-state` : null,
      updatedAt: NOW_MS,
    })),
    snapshotSets: fixture.athletes.map((athlete) => ({
      current_latest_valid: {
        validity: { excludedFromHeadlineDelta: false },
        targetDeltaFromBaseline: { pillarComposite: athlete.mentalPerformanceDelta },
      },
    })),
    windowStartMs: fixture.windowStartMs,
    windowEndMs: fixture.windowEndMs,
  };
}

function seedHypothesisEvaluationDb(db, fixture) {
  db.seedDoc('pulsecheck-pilots', fixture.pilotId, {
    id: fixture.pilotId,
    organizationId: fixture.organizationId,
    teamId: fixture.teamId,
    status: 'active',
    startAt: fixture.windowStartMs,
    endAt: fixture.windowEndMs,
  });

  fixture.athletes.forEach((athlete) => {
    db.seedDoc('pulsecheck-team-memberships', athlete.teamMembershipId, {
      id: athlete.teamMembershipId,
      userId: athlete.athleteId,
      role: 'athlete',
      organizationId: fixture.organizationId,
      teamId: fixture.teamId,
      athleteOnboarding: {
        baselinePathStatus: 'complete',
        entryOnboardingStep: 'complete',
        productConsentAccepted: true,
        completedConsentIds: [],
        requiredConsentIds: [],
      },
    });

    db.seedDoc('pulsecheck-pilot-enrollments', athlete.enrollmentId, {
      id: athlete.enrollmentId,
      pilotId: fixture.pilotId,
      userId: athlete.athleteId,
      organizationId: fixture.organizationId,
      teamId: fixture.teamId,
      cohortId: athlete.cohortId,
      teamMembershipId: athlete.teamMembershipId,
      status: 'active',
      createdAt: fixture.windowStartMs,
      updatedAt: fixture.windowStartMs,
    });

    db.seedDoc(`pulsecheck-pilot-enrollments/${athlete.enrollmentId}/mental-performance-snapshots`, 'baseline', {
      id: 'baseline',
      pilotEnrollmentId: athlete.enrollmentId,
      pilotId: fixture.pilotId,
      organizationId: fixture.organizationId,
      teamId: fixture.teamId,
      athleteId: athlete.athleteId,
      snapshotType: 'baseline',
      status: 'valid',
      capturedAt: fixture.windowStartMs,
      computedAt: fixture.windowStartMs,
      sourceProfileVersion: 'taxonomy-v1',
      sourceWriterVersion: 'profile-snapshot-writer-v1',
      taxonomyProfile: {
        overallScore: 50,
        pillarScores: { focus: 50, composure: 50, decision: 50 },
        skillScores: {},
        modifierScores: {},
        strongestSkills: [],
        weakestSkills: [],
        trendSummary: [],
        updatedAt: fixture.windowStartMs,
      },
      pillarCompositeScore: 50,
      targetDeltaFromBaseline: { focus: 0, composure: 0, decision: 0, pillarComposite: 0 },
      validity: {
        hasBaselineAssessment: true,
        hasRecentProfile: true,
        excludedFromHeadlineDelta: false,
        exclusionReason: null,
      },
      endpointFreeze: { frozen: false, frozenAt: null, freezeReason: null },
    });

    db.seedDoc(`pulsecheck-pilot-enrollments/${athlete.enrollmentId}/mental-performance-snapshots`, 'current_latest_valid', {
      id: 'current_latest_valid',
      pilotEnrollmentId: athlete.enrollmentId,
      pilotId: fixture.pilotId,
      organizationId: fixture.organizationId,
      teamId: fixture.teamId,
      athleteId: athlete.athleteId,
      snapshotType: 'current_latest_valid',
      status: 'valid',
      capturedAt: fixture.windowStartMs,
      computedAt: fixture.windowStartMs,
      sourceProfileVersion: 'taxonomy-v1',
      sourceWriterVersion: 'profile-snapshot-writer-v1',
      taxonomyProfile: {
        overallScore: 60,
        pillarScores: { focus: 60, composure: 60, decision: 60 },
        skillScores: {},
        modifierScores: {},
        strongestSkills: [],
        weakestSkills: [],
        trendSummary: [],
        updatedAt: fixture.windowStartMs,
      },
      pillarCompositeScore: athlete.mentalPerformanceDelta,
      targetDeltaFromBaseline: {
        focus: athlete.mentalPerformanceDelta,
        composure: athlete.mentalPerformanceDelta,
        decision: athlete.mentalPerformanceDelta,
        pillarComposite: athlete.mentalPerformanceDelta,
      },
      validity: {
        hasBaselineAssessment: true,
        hasRecentProfile: true,
        excludedFromHeadlineDelta: false,
        exclusionReason: null,
      },
      endpointFreeze: { frozen: false, frozenAt: null, freezeReason: null },
    });

    db.seedDoc('pulsecheck-daily-assignments', `${athlete.athleteId}-assignment`, {
      id: `${athlete.athleteId}-assignment`,
      pilotId: fixture.pilotId,
      pilotEnrollmentId: athlete.enrollmentId,
      organizationId: fixture.organizationId,
      teamId: fixture.teamId,
      athleteId: athlete.athleteId,
      sourceDate: TODAY_KEY,
      actionType: 'protocol',
      status: athlete.protocolCompleted ? 'completed' : 'assigned',
      sourceStateSnapshotId: athlete.stateAware ? `${athlete.athleteId}-state` : null,
      updatedAt: fixture.windowStartMs,
    });

    db.seedDoc('pulsecheck-pilot-metric-events', `${athlete.athleteId}-checkin`, {
      id: `${athlete.athleteId}-checkin`,
      pilotId: fixture.pilotId,
      pilotEnrollmentId: athlete.enrollmentId,
      organizationId: fixture.organizationId,
      teamId: fixture.teamId,
      cohortId: athlete.cohortId,
      athleteId: athlete.athleteId,
      actorRole: 'athlete',
      eventType: 'daily_checkin_completed',
      sourceCollection: 'state-snapshots',
      sourceDocumentId: `${athlete.athleteId}-checkin`,
      sourceDate: TODAY_KEY,
      metricPayload: { readinessScore: 7 },
      createdAt: fixture.windowStartMs,
    });

    if (athlete.adherence) {
      db.seedDoc('pulsecheck-pilot-metric-events', `${athlete.athleteId}-assignment-complete`, {
        id: `${athlete.athleteId}-assignment-complete`,
        pilotId: fixture.pilotId,
        pilotEnrollmentId: athlete.enrollmentId,
        organizationId: fixture.organizationId,
        teamId: fixture.teamId,
        cohortId: athlete.cohortId,
        athleteId: athlete.athleteId,
        actorRole: 'athlete',
        eventType: 'daily_assignment_completed',
        sourceCollection: 'pulsecheck-daily-assignments',
        sourceDocumentId: `${athlete.athleteId}-assignment`,
        sourceDate: TODAY_KEY,
        metricPayload: { actionType: 'protocol' },
        createdAt: fixture.windowStartMs,
      });
    }

    db.seedDoc('pulsecheck-pilot-survey-responses', `${athlete.athleteId}-trust`, {
      id: `${athlete.athleteId}-trust`,
      pilotId: fixture.pilotId,
      pilotEnrollmentId: athlete.enrollmentId,
      organizationId: fixture.organizationId,
      teamId: fixture.teamId,
      cohortId: athlete.cohortId,
      respondentUserId: athlete.athleteId,
      respondentRole: 'athlete',
      athleteId: athlete.athleteId,
      surveyKind: 'trust',
      score: athlete.trustScore,
      source: 'web-admin',
      submittedAt: fixture.windowStartMs,
      trustBattery: {
        version: 'athlete_trust_battery_v1',
        items: [],
        averageScore: athlete.trustScore,
        totalItemCount: 5,
        completedItemCount: 0,
        completionStatus: 'empty',
      },
    });

    db.seedDoc('pulsecheck-pilot-survey-responses', `${athlete.athleteId}-nps`, {
      id: `${athlete.athleteId}-nps`,
      pilotId: fixture.pilotId,
      pilotEnrollmentId: athlete.enrollmentId,
      organizationId: fixture.organizationId,
      teamId: fixture.teamId,
      cohortId: athlete.cohortId,
      respondentUserId: `${athlete.athleteId}-nps`,
      respondentRole: 'athlete',
      athleteId: athlete.athleteId,
      surveyKind: 'nps',
      score: athlete.npsScore,
      source: 'web-admin',
      submittedAt: fixture.windowStartMs,
      trustBattery: null,
    });

    if (athlete.coachTrustScore !== null) {
      db.seedDoc('pulsecheck-pilot-survey-responses', `${athlete.athleteId}-coach-trust`, {
        id: `${athlete.athleteId}-coach-trust`,
        pilotId: fixture.pilotId,
        pilotEnrollmentId: athlete.enrollmentId,
        organizationId: fixture.organizationId,
        teamId: fixture.teamId,
        cohortId: athlete.cohortId,
        respondentUserId: `${athlete.athleteId}-coach`,
        respondentRole: 'coach',
        athleteId: null,
        surveyKind: 'trust',
        score: athlete.coachTrustScore,
        source: 'web-admin',
        submittedAt: fixture.windowStartMs,
        trustBattery: null,
      });
    }

    if (athlete.coachNpsScore !== null) {
      db.seedDoc('pulsecheck-pilot-survey-responses', `${athlete.athleteId}-coach-nps`, {
        id: `${athlete.athleteId}-coach-nps`,
        pilotId: fixture.pilotId,
        pilotEnrollmentId: athlete.enrollmentId,
        organizationId: fixture.organizationId,
        teamId: fixture.teamId,
        cohortId: athlete.cohortId,
        respondentUserId: `${athlete.athleteId}-coach-nps`,
        respondentRole: 'coach',
        athleteId: null,
        surveyKind: 'nps',
        score: athlete.coachNpsScore,
        source: 'web-admin',
        submittedAt: fixture.windowStartMs,
        trustBattery: null,
      });
    }
  });
}

test('buildOutcomeHypothesisEvaluation compares H3, H5, and H6 slices from exposure and rollup-backed summaries', () => {
  const { buildOutcomeHypothesisEvaluation } = loadPulsecheckMetrics();
  const fixture = buildHypothesisEvaluationFixture();
  const evaluation = buildOutcomeHypothesisEvaluation(buildHypothesisEvaluationInput(fixture));

  assert.equal(evaluation.usesRollupWindow, 'current');
  assert.equal(evaluation.h3.stateAware.athleteCount, 2);
  assert.equal(evaluation.h3.fallbackOrNone.athleteCount, 2);
  assert.equal(evaluation.h3.stateAware.adherenceRate, 100);
  assert.equal(evaluation.h3.fallbackOrNone.adherenceRate, 0);
  assert.equal(evaluation.h3.stateAware.mentalPerformanceDelta, 8);
  assert.equal(evaluation.h3.fallbackOrNone.mentalPerformanceDelta, 1.5);
  assert.equal(evaluation.h3.delta.adherenceRate, 100);
  assert.equal(evaluation.h3.delta.mentalPerformanceDelta, 6.5);
  assert.equal(evaluation.h3.delta.athleteTrust, 5);

  assert.equal(evaluation.h5.bodyStateAwareExposure.athleteCount, 2);
  assert.equal(evaluation.h5.profileOnlyOrNone.athleteCount, 2);
  assert.equal(evaluation.h5.coachTrust, null);
  assert.equal(evaluation.h5.coachNps, null);
  assert.equal(evaluation.h5.coachResponseCount, 2);
  assert.equal(evaluation.h5.delta.adherenceRate, 100);
  assert.equal(evaluation.h5.delta.athleteTrust, 5);

  assert.equal(evaluation.h6.completedProtocol.athleteCount, 2);
  assert.equal(evaluation.h6.incompleteOrSkippedProtocol.athleteCount, 2);
  assert.equal(evaluation.h6.completedProtocol.adherenceRate, 100);
  assert.equal(evaluation.h6.incompleteOrSkippedProtocol.adherenceRate, 0);
  assert.equal(evaluation.h6.delta.adherenceRate, 100);
  assert.equal(evaluation.h6.delta.mentalPerformanceDelta, 6.5);
  assert.equal(evaluation.h6.delta.athleteTrust, 5);
});

test('computePilotOutcomeRollup carries hypothesisEvaluation slices and cohort comparisons from the rollup-backed data', async () => {
  const { buildOutcomeHypothesisEvaluation, computePilotOutcomeRollup } = loadPulsecheckMetrics();
  const { db } = createPulsecheckFirestore();
  const fixture = buildHypothesisEvaluationFixture();
  seedHypothesisEvaluationDb(db, fixture);

  const expected = buildOutcomeHypothesisEvaluation(buildHypothesisEvaluationInput(fixture));
  const rollup = await runWithNow(NOW_MS, () => computePilotOutcomeRollup({
    db,
    pilotId: fixture.pilotId,
    window: 'current',
  }));

  assert.deepEqual(rollup.diagnostics.hypothesisEvaluation, expected);
  assert.equal(rollup.diagnostics.hypothesisEvaluationByCohort.alpha.h3.stateAware.athleteCount, 1);
  assert.equal(rollup.diagnostics.hypothesisEvaluationByCohort.alpha.h3.fallbackOrNone.athleteCount, 1);
  assert.equal(rollup.diagnostics.hypothesisEvaluationByCohort.beta.h3.stateAware.athleteCount, 1);
  assert.equal(rollup.diagnostics.hypothesisEvaluationByCohort.beta.h3.fallbackOrNone.athleteCount, 1);
  assert.equal(rollup.diagnostics.hypothesisEvaluationByCohort.alpha.h6.completedProtocol.athleteCount, 1);
  assert.equal(rollup.diagnostics.hypothesisEvaluationByCohort.beta.h6.incompleteOrSkippedProtocol.athleteCount, 1);
});
