const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createPulsecheckFirestore,
  loadPulsecheckMetrics,
} = require('./pulsecheck-test-helpers.cjs');

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW_MS = Date.parse('2026-03-30T12:00:00.000Z');

function seedBasePilotContext(db, overrides = {}) {
  const pilotId = overrides.pilotId || 'pilot-1';
  const pilotEnrollmentId = overrides.pilotEnrollmentId || 'pilot-enrollment-1';
  const athleteId = overrides.athleteId || 'athlete-1';
  const teamId = overrides.teamId || 'team-1';
  const organizationId = overrides.organizationId || 'org-1';
  const cohortId = overrides.cohortId || 'alpha';
  const teamMembershipId = overrides.teamMembershipId || 'membership-1';

  db.seedDoc('pulsecheck-pilots', pilotId, {
    id: pilotId,
    organizationId,
    teamId,
    status: 'active',
    startAt: overrides.pilotStartAt || NOW_MS - DAY_MS,
    endAt: overrides.pilotEndAt || NOW_MS + DAY_MS,
  });

  db.seedDoc('pulsecheck-team-memberships', teamMembershipId, {
    id: teamMembershipId,
    userId: athleteId,
    role: 'athlete',
    organizationId,
    teamId,
    athleteOnboarding: {
      baselinePathStatus: 'complete',
      entryOnboardingStep: 'complete',
      productConsentAccepted: true,
      completedConsentIds: [],
      requiredConsentIds: [],
    },
  });

  db.seedDoc('pulsecheck-pilot-enrollments', pilotEnrollmentId, {
    id: pilotEnrollmentId,
    pilotId,
    userId: athleteId,
    organizationId,
    teamId,
    cohortId,
    teamMembershipId,
    status: 'active',
    createdAt: overrides.enrollmentCreatedAt || NOW_MS - DAY_MS,
    updatedAt: overrides.enrollmentUpdatedAt || NOW_MS - DAY_MS,
  });

  db.seedDoc(`pulsecheck-pilot-enrollments/${pilotEnrollmentId}/mental-performance-snapshots`, 'baseline', {
    id: 'baseline',
    pilotEnrollmentId,
    pilotId,
    organizationId,
    teamId,
    athleteId,
    snapshotType: 'baseline',
    status: 'valid',
    capturedAt: overrides.baselineCapturedAt || NOW_MS - 7 * DAY_MS,
    computedAt: overrides.baselineComputedAt || NOW_MS - 7 * DAY_MS,
    sourceProfileVersion: 'taxonomy-v1',
    sourceWriterVersion: 'profile-snapshot-writer-v1',
    taxonomyProfile: overrides.baselineProfile || {
      overallScore: 51,
      pillarScores: { focus: 50, composure: 50, decision: 50 },
      skillScores: {},
      modifierScores: {},
      strongestSkills: [],
      weakestSkills: [],
      trendSummary: [],
      updatedAt: overrides.baselineCapturedAt || NOW_MS - 7 * DAY_MS,
    },
    pillarCompositeScore: 50,
    targetDeltaFromBaseline: { focus: 0, composure: 0, decision: 0, pillarComposite: 0 },
    validity: {
      hasBaselineAssessment: true,
      hasRecentProfile: true,
      excludedFromHeadlineDelta: false,
      exclusionReason: null,
    },
    endpointFreeze: {
      frozen: false,
      frozenAt: null,
      freezeReason: null,
    },
  });

  return {
    pilotId,
    pilotEnrollmentId,
    athleteId,
    teamId,
    organizationId,
    cohortId,
    teamMembershipId,
  };
}

function eventDocTypes(db) {
  return db.getCollectionDocs('pulsecheck-pilot-metric-events').map((entry) => entry.data.eventType).sort();
}

async function runWithNow(nowMs, callback) {
  const originalNow = Date.now;
  Date.now = () => nowMs;
  try {
    return await callback();
  } finally {
    Date.now = originalNow;
  }
}

test('buildTrustBatteryPayload supplies the canonical five-item battery when no answers are present', () => {
  const { buildTrustBatteryPayload } = loadPulsecheckMetrics();

  const payload = buildTrustBatteryPayload({});

  assert.equal(payload.version, 'athlete_trust_battery_v1');
  assert.equal(payload.items.length, 5);
  assert.deepEqual(payload.items.map((item) => item.key), [
    'credibility',
    'reliability',
    'honesty_safety',
    'athlete_interest',
    'practical_usefulness',
  ]);
  assert.equal(payload.completedItemCount, 0);
  assert.equal(payload.totalItemCount, 5);
  assert.equal(payload.completionStatus, 'empty');
  assert.equal(payload.averageScore, null);
});

test('buildTrustBatteryPayload averages only completed items and drops invalid responses', () => {
  const { buildTrustBatteryPayload } = loadPulsecheckMetrics();

  const payload = buildTrustBatteryPayload({
    version: 'athlete_trust_battery_v1',
    items: [
      { key: 'credibility', score: 9, prompt: 'Credibility' },
      { key: 'reliability', score: 8, prompt: 'Reliability' },
      { key: 'honesty_safety', prompt: 'Safety' },
      { key: 'not_a_real_item', score: 10, prompt: 'Invalid' },
      { key: 'athlete_interest', score: 11, prompt: 'Too high' },
    ],
  });

  assert.equal(payload.completedItemCount, 2);
  assert.equal(payload.totalItemCount, 5);
  assert.equal(payload.completionStatus, 'partial');
  assert.equal(payload.averageScore, 8.5);
  assert.deepEqual(payload.items.map((item) => item.key), [
    'credibility',
    'reliability',
    'honesty_safety',
    'athlete_interest',
  ]);
});

test('savePilotSurveyResponse persists the trust battery payload and emits matching metric events', async () => {
  const { savePilotSurveyResponse } = loadPulsecheckMetrics();
  const { db } = createPulsecheckFirestore();
  const context = seedBasePilotContext(db);

  await runWithNow(NOW_MS, async () => {
    const response = await savePilotSurveyResponse({
      db,
      authUserId: context.athleteId,
      surveyKind: 'trust',
      score: 8.4,
      respondentRole: 'athlete',
      source: 'ios',
      comment: '  Great work  ',
      pilotId: context.pilotId,
      pilotEnrollmentId: context.pilotEnrollmentId,
      cohortId: context.cohortId,
      teamId: context.teamId,
      organizationId: context.organizationId,
      athleteId: context.athleteId,
      diagnosticBattery: {
        version: 'athlete_trust_battery_v1',
        items: [
          { key: 'credibility', score: 9, prompt: 'Credibility' },
          { key: 'reliability', score: 8, prompt: 'Reliability' },
          { key: 'honesty_safety', score: 7, prompt: 'Safety' },
          { key: 'athlete_interest', prompt: 'Interest' },
          { key: 'practical_usefulness', prompt: 'Utility' },
        ],
      },
    });

    assert.equal(response.comment, 'Great work');
  });

  const surveyDocs = db.getCollectionDocs('pulsecheck-pilot-survey-responses');
  assert.equal(surveyDocs.length, 1);
  assert.equal(surveyDocs[0].data.trustBattery.averageScore, 8);
  assert.equal(surveyDocs[0].data.trustBattery.completedItemCount, 3);
  assert.equal(surveyDocs[0].data.trustBattery.completionStatus, 'partial');

  assert.deepEqual(eventDocTypes(db), ['survey_submitted', 'trust_submitted']);
});

test('buildPilotSurveyReclassificationReport flags legacy trust responses for normalization and event backfill', async () => {
  const { buildPilotSurveyReclassificationReport } = loadPulsecheckMetrics();
  const { db } = createPulsecheckFirestore();
  const context = seedBasePilotContext(db);

  db.seedDoc('pulsecheck-pilot-survey-responses', 'legacy-trust-1', {
    id: 'legacy-trust-1',
    pilotId: context.pilotId,
    pilotEnrollmentId: '',
    organizationId: '',
    teamId: '',
    respondentUserId: context.athleteId,
    role: 'player',
    kind: 'athlete_trust',
    rating: 7.6,
    source: '',
    createdAt: NOW_MS - DAY_MS,
    diagnosticBattery: {
      items: [
        { key: 'credibility', score: 8 },
        { key: 'reliability', score: 7 },
      ],
    },
  });

  const report = await runWithNow(NOW_MS, async () => buildPilotSurveyReclassificationReport({
    db,
    pilotId: context.pilotId,
    sampleLimit: 5,
    actorUserId: 'admin-1',
    persistRun: false,
  }));

  assert.equal(report.totalSurveyResponseCount, 1);
  assert.equal(report.applyReadyCount, 1);
  assert.equal(report.needsDocumentUpdateCount, 1);
  assert.equal(report.needsEventBackfillCount, 1);
  assert.equal(report.blockedCount, 0);
  assert.deepEqual(report.samples[0].missingEventTypes.sort(), ['survey_submitted', 'trust_submitted']);
  assert.equal(report.samples[0].patchPreview.surveyKind, 'trust');
  assert.equal(report.samples[0].patchPreview.respondentRole, 'athlete');
  assert.equal(report.samples[0].patchPreview.organizationId, context.organizationId);
  assert.equal(report.samples[0].patchPreview.teamId, context.teamId);
});

test('applyPilotSurveyReclassification normalizes legacy survey docs, backfills events, and can skip recompute', async () => {
  const { applyPilotSurveyReclassification } = loadPulsecheckMetrics();
  const { db } = createPulsecheckFirestore();
  const context = seedBasePilotContext(db);

  db.seedDoc('pulsecheck-pilot-survey-responses', 'legacy-nps-1', {
    id: 'legacy-nps-1',
    pilotId: context.pilotId,
    organizationId: context.organizationId,
    teamId: context.teamId,
    respondentUserId: context.athleteId,
    role: 'student-athlete',
    type: 'recommendation',
    value: 9,
    submittedAtMs: NOW_MS - (2 * DAY_MS),
    source: 'ios',
  });

  const result = await runWithNow(NOW_MS, async () => applyPilotSurveyReclassification({
    db,
    pilotId: context.pilotId,
    actorUserId: 'admin-1',
    sampleLimit: 5,
    recomputeRollups: false,
  }));

  assert.equal(result.appliedCount, 1);
  assert.equal(result.recompute, null);

  const updatedDoc = db.getDoc('pulsecheck-pilot-survey-responses', 'legacy-nps-1');
  assert.equal(updatedDoc.surveyKind, 'nps');
  assert.equal(updatedDoc.respondentRole, 'athlete');
  assert.equal(updatedDoc.score, 9);
  assert.equal(updatedDoc.athleteId, context.athleteId);
  assert.equal(updatedDoc.migration.lastAppliedKey, 'pilot_outcome_survey_reclassification_v1');

  assert.deepEqual(eventDocTypes(db), ['nps_submitted', 'survey_submitted']);

  const migrationRuns = db.getCollectionDocs(`pulsecheck-pilot-metric-ops/${context.pilotId}/migrations`);
  assert.equal(migrationRuns.length, 1);
  assert.equal(migrationRuns[0].data.mode, 'apply');
});

test('buildPilotEscalationReclassificationReport flags benign support records and same-conversation duplicate care escalations', async () => {
  const { buildPilotEscalationReclassificationReport } = loadPulsecheckMetrics();
  const { db } = createPulsecheckFirestore();
  const context = seedBasePilotContext(db, {
    pilotId: 'pilot-escalation-migration-report',
    pilotEnrollmentId: 'pilot-enrollment-escalation-migration-report',
    pilotStartAt: NOW_MS - 14 * DAY_MS,
    pilotEndAt: NOW_MS + DAY_MS,
  });

  db.seedDoc('escalation-records', 'legacy-benign', {
    id: 'legacy-benign',
    userId: context.athleteId,
    conversationId: 'conversation-benign',
    tier: 1,
    category: 'general',
    status: 'active',
    createdAt: NOW_MS - 3 * DAY_MS,
    triggerContent: 'I feel nervous about competition and want help regulating my focus before I compete.',
    classificationReason: 'Competition stress',
  });

  db.seedDoc('escalation-records', 'legacy-care-primary', {
    id: 'legacy-care-primary',
    userId: context.athleteId,
    conversationId: 'conversation-care',
    tier: 2,
    category: 'general',
    status: 'active',
    createdAt: NOW_MS - 2 * DAY_MS,
    triggerContent: 'I cannot stay safe and need help right now.',
    classificationReason: 'Safety concern',
  });

  db.seedDoc('escalation-records', 'legacy-care-duplicate', {
    id: 'legacy-care-duplicate',
    userId: context.athleteId,
    conversationId: 'conversation-care',
    tier: 2,
    category: 'general',
    status: 'active',
    createdAt: NOW_MS - 2 * DAY_MS + 10 * 60 * 1000,
    triggerContent: 'I still cannot stay safe and need help again.',
    classificationReason: 'Safety concern',
  });

  const report = await runWithNow(NOW_MS, () => buildPilotEscalationReclassificationReport({
    db,
    pilotId: context.pilotId,
    sampleLimit: 10,
    persistRun: false,
  }));

  assert.equal(report.totalEscalationRecordCount, 3);
  assert.equal(report.needsDocumentUpdateCount, 3);
  assert.equal(report.mergedCount, 1);
  assert.equal(report.groupedIncidentCount, 1);

  const benignSample = report.samples.find((entry) => entry.recordId === 'legacy-benign');
  assert.ok(benignSample);
  assert.equal(benignSample.targetTier, 0);
  assert.equal(benignSample.targetDisposition, 'none');
  assert.equal(benignSample.targetClassificationFamily, 'performance_support');

  const duplicateSample = report.samples.find((entry) => entry.recordId === 'legacy-care-duplicate');
  assert.ok(duplicateSample);
  assert.equal(duplicateSample.mergedIntoIncidentKey, 'legacy-care-primary');
  assert.equal(duplicateSample.patchPreview.excludedFromHeadlineMetrics, true);
});

test('applyPilotEscalationReclassification normalizes historical escalation records and recomputes care-escalation headline counts', async () => {
  const { applyPilotEscalationReclassification } = loadPulsecheckMetrics();
  const { db } = createPulsecheckFirestore();
  const context = seedBasePilotContext(db, {
    pilotId: 'pilot-escalation-migration-apply',
    pilotEnrollmentId: 'pilot-enrollment-escalation-migration-apply',
    pilotStartAt: NOW_MS - 14 * DAY_MS,
    pilotEndAt: NOW_MS + DAY_MS,
  });

  db.seedDoc('escalation-records', 'legacy-benign', {
    id: 'legacy-benign',
    userId: context.athleteId,
    conversationId: 'conversation-benign',
    tier: 1,
    category: 'general',
    status: 'active',
    createdAt: NOW_MS - 3 * DAY_MS,
    triggerContent: 'I am nervous about competition and my sleep has been off.',
    classificationReason: 'Performance stress',
  });

  db.seedDoc('escalation-records', 'legacy-care-primary', {
    id: 'legacy-care-primary',
    userId: context.athleteId,
    conversationId: 'conversation-care',
    tier: 2,
    category: 'general',
    status: 'active',
    createdAt: NOW_MS - 2 * DAY_MS,
    triggerContent: 'I cannot stay safe and need help right now.',
    classificationReason: 'Safety concern',
  });

  db.seedDoc('escalation-records', 'legacy-care-duplicate', {
    id: 'legacy-care-duplicate',
    userId: context.athleteId,
    conversationId: 'conversation-care',
    tier: 2,
    category: 'general',
    status: 'active',
    createdAt: NOW_MS - 2 * DAY_MS + 10 * 60 * 1000,
    triggerContent: 'I still cannot stay safe and need help again.',
    classificationReason: 'Safety concern',
  });

  const result = await runWithNow(NOW_MS, () => applyPilotEscalationReclassification({
    db,
    pilotId: context.pilotId,
    actorUserId: 'admin-user',
    sampleLimit: 10,
    recomputeRollups: true,
    recomputeLookbackDays: 30,
  }));

  assert.equal(result.appliedCount, 3);

  const benign = db.getDoc('escalation-records', 'legacy-benign');
  assert.equal(benign.disposition, 'none');
  assert.equal(benign.classificationFamily, 'performance_support');
  assert.equal(benign.tier, 0);
  assert.equal(benign.excludedFromHeadlineMetrics, true);
  assert.equal(benign.legacyClassification, true);

  const duplicate = db.getDoc('escalation-records', 'legacy-care-duplicate');
  assert.equal(duplicate.disposition, 'coach_review');
  assert.equal(duplicate.classificationFamily, 'coach_review');
  assert.equal(duplicate.tier, 1);
  assert.equal(duplicate.mergedIntoIncidentKey, 'legacy-care-primary');
  assert.equal(duplicate.supersededByIncidentKey, 'legacy-care-primary');
  assert.equal(duplicate.excludedFromHeadlineMetrics, true);

  const primary = db.getDoc('escalation-records', 'legacy-care-primary');
  assert.equal(primary.disposition, 'clinical_handoff');
  assert.equal(primary.classificationFamily, 'critical_safety');
  assert.equal(primary.incidentId, 'legacy-care-primary');
  assert.equal(primary.incidentRecordCount, 2);

  assert.ok(result.recompute);
  assert.equal(result.recompute.rollups.current.metrics.escalationsTotal, 1);
  assert.equal(result.recompute.rollups.current.diagnostics.escalations.coachReviewOnlyTotal, 2);
  assert.equal(result.recompute.rollups.current.diagnostics.escalations.allOperationalEscalationsTotal, 3);

  const migrationRuns = db.getCollectionDocs(`pulsecheck-pilot-metric-ops/${context.pilotId}/migrations`);
  assert.ok(migrationRuns.some((entry) => entry.data.migrationKey === 'pilot_outcome_escalation_reclassification_v1'));
});

test('applyPilotSurveyReclassification is repeat-safe and preserves migration audit metadata on rerun', async () => {
  const { applyPilotSurveyReclassification } = loadPulsecheckMetrics();
  const { db } = createPulsecheckFirestore();
  const context = seedBasePilotContext(db);

  db.seedDoc('pulsecheck-pilot-survey-responses', 'legacy-nps-1', {
    id: 'legacy-nps-1',
    pilotId: context.pilotId,
    organizationId: context.organizationId,
    teamId: context.teamId,
    respondentUserId: context.athleteId,
    role: 'student-athlete',
    type: 'recommendation',
    value: 9,
    submittedAtMs: NOW_MS - (2 * DAY_MS),
    source: 'ios',
  });

  const first = await runWithNow(NOW_MS, async () => applyPilotSurveyReclassification({
    db,
    pilotId: context.pilotId,
    actorUserId: 'admin-1',
    sampleLimit: 5,
    recomputeRollups: false,
  }));

  const firstDoc = db.getDoc('pulsecheck-pilot-survey-responses', 'legacy-nps-1');
  const firstMigrationStamp = firstDoc.migration.lastAppliedAtMs;

  const second = await runWithNow(NOW_MS, async () => applyPilotSurveyReclassification({
    db,
    pilotId: context.pilotId,
    actorUserId: 'admin-1',
    sampleLimit: 5,
    recomputeRollups: false,
  }));

  assert.equal(first.appliedCount, 1);
  assert.equal(first.recompute, null);
  assert.equal(second.appliedCount, 0);
  assert.equal(second.recompute, null);
  assert.equal(db.getCollectionDocs('pulsecheck-pilot-metric-events').length, 2);
  assert.equal(db.getCollectionDocs(`pulsecheck-pilot-metric-ops/${context.pilotId}/migrations`).length, 2);

  const secondDoc = db.getDoc('pulsecheck-pilot-survey-responses', 'legacy-nps-1');
  assert.equal(secondDoc.migration.lastAppliedKey, 'pilot_outcome_survey_reclassification_v1');
  assert.equal(secondDoc.migration.lastAppliedAtMs, firstMigrationStamp);
  assert.equal(secondDoc.migration.lastAppliedBy, 'admin-1');
  assert.equal(second.report.applyReadyCount, 0);
  assert.equal(second.report.needsDocumentUpdateCount, 0);
  assert.equal(second.report.needsEventBackfillCount, 0);
  assert.equal(db.getCollectionDocs(`pulsecheck-pilot-metric-ops/${context.pilotId}/migrations`)[1].data.appliedMutationIds.length, 0);
});

test('computePilotOutcomeRollup keeps empty denominators finite and zeroed', async () => {
  const { computePilotOutcomeRollup } = loadPulsecheckMetrics();
  const { db } = createPulsecheckFirestore();

  const rollup = await computePilotOutcomeRollup({
    db,
    pilotId: 'pilot-empty',
    window: 'current',
  });

  assert.equal(rollup.metrics.enrollmentRate, 0);
  assert.equal(rollup.metrics.consentCompletionRate, 0);
  assert.equal(rollup.metrics.baselineCompletionRate, 0);
  assert.equal(rollup.metrics.adherenceRate, 0);
  assert.equal(rollup.metrics.dailyCheckInRate, 0);
  assert.equal(rollup.metrics.assignmentCompletionRate, 0);
  assert.equal(rollup.metrics.mentalPerformanceDelta, 0);
  assert.equal(rollup.metrics.escalationsTotal, 0);
  assert.equal(rollup.metrics.escalationsTier1, 0);
  assert.equal(rollup.metrics.escalationsTier2, 0);
  assert.equal(rollup.metrics.escalationsTier3, 0);
  assert.equal(rollup.metrics.medianMinutesToCare, null);
  assert.equal(rollup.metrics.athleteTrust, null);
  assert.equal(rollup.metrics.coachTrust, null);
  assert.equal(rollup.metrics.clinicianTrust, null);
  assert.equal(rollup.diagnostics.enrollment.totalEnrollmentCount, 0);
  assert.equal(rollup.diagnostics.adherence.expectedAthleteDays, 0);
  assert.equal(rollup.diagnostics.mentalPerformance.eligibleAthleteCount, 0);
});

test('upsertPilotMentalPerformanceSnapshot marks stale current snapshots as excluded from headline delta', async () => {
  const { upsertPilotMentalPerformanceSnapshot } = loadPulsecheckMetrics();
  const { db } = createPulsecheckFirestore();
  const context = seedBasePilotContext(db, {
    enrollmentCreatedAt: NOW_MS - 2 * DAY_MS,
    enrollmentUpdatedAt: NOW_MS - 2 * DAY_MS,
  });

  db.seedDoc('athlete-mental-progress', context.athleteId, {
    baselineProbe: null,
    taxonomyProfile: {
      overallScore: 62,
      pillarScores: { focus: 64, composure: 61, decision: 63 },
      skillScores: {},
      modifierScores: {},
      strongestSkills: [],
      weakestSkills: [],
      trendSummary: [],
      updatedAt: NOW_MS - 15 * DAY_MS,
    },
    lastProfileSyncAt: NOW_MS - 15 * DAY_MS,
    updatedAt: NOW_MS - 15 * DAY_MS,
  });

  await runWithNow(NOW_MS, async () => {
    const snapshot = await upsertPilotMentalPerformanceSnapshot({
      db,
      athleteId: context.athleteId,
      snapshotType: 'current_latest_valid',
      preferredPilotEnrollmentId: context.pilotEnrollmentId,
      preferredPilotId: context.pilotId,
      preferredTeamMembershipId: context.teamMembershipId,
      sourceEventId: 'event-1',
    });

    assert.equal(snapshot.status, 'stale');
    assert.equal(snapshot.validity.excludedFromHeadlineDelta, true);
    assert.equal(snapshot.validity.exclusionReason, 'stale_current');
    assert.equal(snapshot.freshnessWindowDays, 14);
  });
});

test('computePilotOutcomeRollup excludes stale current snapshots from the headline delta', async () => {
  const { computePilotOutcomeRollup } = loadPulsecheckMetrics();
  const { db } = createPulsecheckFirestore();
  const pilot = seedBasePilotContext(db);
  const staleEnrollmentId = 'pilot-enrollment-stale';
  const validEnrollmentId = 'pilot-enrollment-valid';

  db.seedDoc('pulsecheck-pilot-enrollments', validEnrollmentId, {
    id: validEnrollmentId,
    pilotId: pilot.pilotId,
    userId: 'athlete-valid',
    organizationId: pilot.organizationId,
    teamId: pilot.teamId,
    cohortId: 'alpha',
    teamMembershipId: 'membership-valid',
    status: 'active',
    createdAt: NOW_MS - DAY_MS,
    updatedAt: NOW_MS - DAY_MS,
  });
  db.seedDoc('pulsecheck-pilot-enrollments', staleEnrollmentId, {
    id: staleEnrollmentId,
    pilotId: pilot.pilotId,
    userId: 'athlete-stale',
    organizationId: pilot.organizationId,
    teamId: pilot.teamId,
    cohortId: 'beta',
    teamMembershipId: 'membership-stale',
    status: 'active',
    createdAt: NOW_MS - DAY_MS,
    updatedAt: NOW_MS - DAY_MS,
  });
  db.seedDoc(`pulsecheck-pilot-enrollments/${validEnrollmentId}/mental-performance-snapshots`, 'baseline', {
    id: 'baseline',
    pilotEnrollmentId: validEnrollmentId,
    pilotId: pilot.pilotId,
    organizationId: pilot.organizationId,
    teamId: pilot.teamId,
    athleteId: 'athlete-valid',
    snapshotType: 'baseline',
    status: 'valid',
    capturedAt: NOW_MS - 3 * DAY_MS,
    computedAt: NOW_MS - 3 * DAY_MS,
    sourceProfileVersion: 'taxonomy-v1',
    sourceWriterVersion: 'profile-snapshot-writer-v1',
    taxonomyProfile: { overallScore: 50, pillarScores: { focus: 50, composure: 50, decision: 50 }, skillScores: {}, modifierScores: {}, strongestSkills: [], weakestSkills: [], trendSummary: [], updatedAt: NOW_MS - 3 * DAY_MS },
    pillarCompositeScore: 50,
    targetDeltaFromBaseline: { focus: 0, composure: 0, decision: 0, pillarComposite: 0 },
    validity: { hasBaselineAssessment: true, hasRecentProfile: true, excludedFromHeadlineDelta: false, exclusionReason: null },
    endpointFreeze: { frozen: false, frozenAt: null, freezeReason: null },
  });
  db.seedDoc(`pulsecheck-pilot-enrollments/${staleEnrollmentId}/mental-performance-snapshots`, 'baseline', {
    id: 'baseline',
    pilotEnrollmentId: staleEnrollmentId,
    pilotId: pilot.pilotId,
    organizationId: pilot.organizationId,
    teamId: pilot.teamId,
    athleteId: 'athlete-stale',
    snapshotType: 'baseline',
    status: 'valid',
    capturedAt: NOW_MS - 3 * DAY_MS,
    computedAt: NOW_MS - 3 * DAY_MS,
    sourceProfileVersion: 'taxonomy-v1',
    sourceWriterVersion: 'profile-snapshot-writer-v1',
    taxonomyProfile: { overallScore: 50, pillarScores: { focus: 50, composure: 50, decision: 50 }, skillScores: {}, modifierScores: {}, strongestSkills: [], weakestSkills: [], trendSummary: [], updatedAt: NOW_MS - 3 * DAY_MS },
    pillarCompositeScore: 50,
    targetDeltaFromBaseline: { focus: 0, composure: 0, decision: 0, pillarComposite: 0 },
    validity: { hasBaselineAssessment: true, hasRecentProfile: true, excludedFromHeadlineDelta: false, exclusionReason: null },
    endpointFreeze: { frozen: false, frozenAt: null, freezeReason: null },
  });
  db.seedDoc(`pulsecheck-pilot-enrollments/${validEnrollmentId}/mental-performance-snapshots`, 'current_latest_valid', {
    id: 'current_latest_valid',
    pilotEnrollmentId: validEnrollmentId,
    pilotId: pilot.pilotId,
    organizationId: pilot.organizationId,
    teamId: pilot.teamId,
    athleteId: 'athlete-valid',
    snapshotType: 'current_latest_valid',
    status: 'valid',
    capturedAt: NOW_MS - 2 * DAY_MS,
    computedAt: NOW_MS - 2 * DAY_MS,
    sourceProfileVersion: 'taxonomy-v1',
    sourceWriterVersion: 'profile-snapshot-writer-v1',
    taxonomyProfile: { overallScore: 60, pillarScores: { focus: 62, composure: 60, decision: 58 }, skillScores: {}, modifierScores: {}, strongestSkills: [], weakestSkills: [], trendSummary: [], updatedAt: NOW_MS - 2 * DAY_MS },
    pillarCompositeScore: 60,
    targetDeltaFromBaseline: { focus: 10, composure: 8, decision: 6, pillarComposite: 8 },
    validity: { hasBaselineAssessment: true, hasRecentProfile: true, excludedFromHeadlineDelta: false, exclusionReason: null },
    endpointFreeze: { frozen: false, frozenAt: null, freezeReason: null },
  });
  db.seedDoc(`pulsecheck-pilot-enrollments/${staleEnrollmentId}/mental-performance-snapshots`, 'current_latest_valid', {
    id: 'current_latest_valid',
    pilotEnrollmentId: staleEnrollmentId,
    pilotId: pilot.pilotId,
    organizationId: pilot.organizationId,
    teamId: pilot.teamId,
    athleteId: 'athlete-stale',
    snapshotType: 'current_latest_valid',
    status: 'stale',
    capturedAt: NOW_MS - 20 * DAY_MS,
    computedAt: NOW_MS - 20 * DAY_MS,
    sourceProfileVersion: 'taxonomy-v1',
    sourceWriterVersion: 'profile-snapshot-writer-v1',
    taxonomyProfile: { overallScore: 40, pillarScores: { focus: 40, composure: 40, decision: 40 }, skillScores: {}, modifierScores: {}, strongestSkills: [], weakestSkills: [], trendSummary: [], updatedAt: NOW_MS - 20 * DAY_MS },
    pillarCompositeScore: 40,
    targetDeltaFromBaseline: { focus: -10, composure: -10, decision: -10, pillarComposite: -10 },
    validity: { hasBaselineAssessment: true, hasRecentProfile: false, excludedFromHeadlineDelta: true, exclusionReason: 'stale_current' },
    endpointFreeze: { frozen: false, frozenAt: null, freezeReason: null },
  });

  const rollup = await computePilotOutcomeRollup({
    db,
    pilotId: pilot.pilotId,
    window: 'current',
    pilot: {
      id: pilot.pilotId,
      organizationId: pilot.organizationId,
      teamId: pilot.teamId,
      status: 'active',
      startAt: NOW_MS - DAY_MS,
      endAt: NOW_MS + DAY_MS,
    },
  });

  assert.equal(rollup.diagnostics.mentalPerformance.eligibleAthleteCount, 1);
  assert.equal(rollup.diagnostics.mentalPerformance.headlineDelta, 8);
  assert.equal(rollup.metrics.mentalPerformanceDelta, 8);
});

test('computePilotOutcomeRollup excludes withdrawn, paused, escalation-hold, and no-task rest-day denominator edges', async () => {
  const { computePilotOutcomeRollup } = loadPulsecheckMetrics();
  const { db } = createPulsecheckFirestore();
  const pilotId = 'pilot-denominator-edges';
  const organizationId = 'org-denominator-edges';
  const teamId = 'team-denominator-edges';
  const day29Ms = NOW_MS - DAY_MS;
  const day30Ms = NOW_MS;

  db.seedDoc('pulsecheck-pilots', pilotId, {
    id: pilotId,
    organizationId,
    teamId,
    status: 'active',
    startAt: day29Ms,
    endAt: day30Ms,
  });

  const athletes = [
    {
      athleteId: 'athlete-withdrawn',
      enrollmentId: 'enrollment-withdrawn',
      teamMembershipId: 'membership-withdrawn',
      cohortId: 'alpha',
      status: 'withdrawn',
      manualPauseWindows: [],
      assignment29: 'completed',
      assignment30: null,
      checkIn29: true,
      checkIn30: false,
      updateAtMs: day29Ms,
      escalation: null,
    },
    {
      athleteId: 'athlete-paused',
      enrollmentId: 'enrollment-paused',
      teamMembershipId: 'membership-paused',
      cohortId: 'alpha',
      status: 'paused',
      manualPauseWindows: [],
      assignment29: 'completed',
      assignment30: null,
      checkIn29: true,
      checkIn30: false,
      updateAtMs: day30Ms,
      escalation: null,
    },
    {
      athleteId: 'athlete-escalation-hold',
      enrollmentId: 'enrollment-escalation-hold',
      teamMembershipId: 'membership-escalation-hold',
      cohortId: 'beta',
      status: 'active',
      manualPauseWindows: [],
      assignment29: null,
      assignment30: 'completed',
      checkIn29: false,
      checkIn30: true,
      updateAtMs: day30Ms,
      escalation: {
        status: 'active',
        tier: 2,
        createdAt: day29Ms + 8 * 60 * 60 * 1000,
        resolvedAt: day29Ms + 10 * 60 * 60 * 1000,
        handoffInitiatedAt: day29Ms + 9 * 60 * 60 * 1000,
      },
    },
    {
      athleteId: 'athlete-rest-day',
      enrollmentId: 'enrollment-rest-day',
      teamMembershipId: 'membership-rest-day',
      cohortId: 'beta',
      status: 'active',
      manualPauseWindows: [],
      assignment29: 'rest',
      assignment30: 'completed',
      checkIn29: false,
      checkIn30: true,
      updateAtMs: day30Ms,
      escalation: null,
    },
  ];

  athletes.forEach((athlete) => {
    db.seedDoc('pulsecheck-team-memberships', athlete.teamMembershipId, {
      id: athlete.teamMembershipId,
      userId: athlete.athleteId,
      role: 'athlete',
      organizationId,
      teamId,
      athleteOnboarding: {
        baselinePathStatus: 'complete',
        entryOnboardingStep: 'complete',
        productConsentAccepted: true,
        completedConsentIds: [],
        requiredConsentIds: [],
        manualPauseWindows: athlete.manualPauseWindows,
      },
    });

    db.seedDoc('pulsecheck-pilot-enrollments', athlete.enrollmentId, {
      id: athlete.enrollmentId,
      pilotId,
      userId: athlete.athleteId,
      organizationId,
      teamId,
      cohortId: athlete.cohortId,
      teamMembershipId: athlete.teamMembershipId,
      status: athlete.status,
      createdAt: day29Ms,
      updatedAt: athlete.updateAtMs,
    });

    db.seedDoc(`pulsecheck-pilot-enrollments/${athlete.enrollmentId}/mental-performance-snapshots`, 'baseline', {
      id: 'baseline',
      pilotEnrollmentId: athlete.enrollmentId,
      pilotId,
      organizationId,
      teamId,
      athleteId: athlete.athleteId,
      snapshotType: 'baseline',
      status: 'valid',
      capturedAt: day29Ms,
      computedAt: day29Ms,
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
        updatedAt: day29Ms,
      },
      pillarCompositeScore: 50,
      targetDeltaFromBaseline: { focus: 0, composure: 0, decision: 0, pillarComposite: 0 },
      validity: { hasBaselineAssessment: true, hasRecentProfile: true, excludedFromHeadlineDelta: false, exclusionReason: null },
      endpointFreeze: { frozen: false, frozenAt: null, freezeReason: null },
    });

    db.seedDoc(`pulsecheck-pilot-enrollments/${athlete.enrollmentId}/mental-performance-snapshots`, 'current_latest_valid', {
      id: 'current_latest_valid',
      pilotEnrollmentId: athlete.enrollmentId,
      pilotId,
      organizationId,
      teamId,
      athleteId: athlete.athleteId,
      snapshotType: 'current_latest_valid',
      status: 'valid',
      capturedAt: day30Ms,
      computedAt: day30Ms,
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
        updatedAt: day30Ms,
      },
      pillarCompositeScore: 60,
      targetDeltaFromBaseline: { focus: 10, composure: 10, decision: 10, pillarComposite: 10 },
      validity: { hasBaselineAssessment: true, hasRecentProfile: true, excludedFromHeadlineDelta: false, exclusionReason: null },
      endpointFreeze: { frozen: false, frozenAt: null, freezeReason: null },
    });

    db.seedDoc('pulsecheck-pilot-metric-events', `${athlete.athleteId}-activate`, {
      id: `${athlete.athleteId}-activate`,
      pilotId,
      pilotEnrollmentId: athlete.enrollmentId,
      organizationId,
      teamId,
      cohortId: athlete.cohortId,
      athleteId: athlete.athleteId,
      actorRole: 'system',
      eventType: 'pilot_enrollment_activated',
      sourceCollection: 'pulsecheck-pilot-enrollments',
      sourceDocumentId: athlete.enrollmentId,
      sourceDate: '2026-03-29',
      metricPayload: {},
      createdAt: day29Ms + 8 * 60 * 60 * 1000,
    });

    if (athlete.checkIn29) {
      db.seedDoc('pulsecheck-pilot-metric-events', `${athlete.athleteId}-checkin-29`, {
        id: `${athlete.athleteId}-checkin-29`,
        pilotId,
        pilotEnrollmentId: athlete.enrollmentId,
        organizationId,
        teamId,
        cohortId: athlete.cohortId,
        athleteId: athlete.athleteId,
        actorRole: 'athlete',
        eventType: 'daily_checkin_completed',
        sourceCollection: 'state-snapshots',
        sourceDocumentId: `${athlete.athleteId}-checkin-29`,
        sourceDate: '2026-03-29',
        metricPayload: { readinessScore: 7 },
        createdAt: day29Ms + 10 * 60 * 60 * 1000,
      });
    }
      if (athlete.assignment29) {
        db.seedDoc('pulsecheck-daily-assignments', `${athlete.athleteId}-assignment-29`, {
          id: `${athlete.athleteId}-assignment-29`,
        pilotId,
        pilotEnrollmentId: athlete.enrollmentId,
        organizationId,
          teamId,
          athleteId: athlete.athleteId,
          sourceDate: '2026-03-29',
          actionType: athlete.assignment29 === 'deferred' ? 'defer' : athlete.assignment29 === 'rest' ? 'no_task' : 'protocol',
          status: athlete.assignment29,
          sourceStateSnapshotId: null,
          updatedAt: day29Ms + 11 * 60 * 60 * 1000,
      });
      if (athlete.assignment29 === 'completed') {
        db.seedDoc('pulsecheck-pilot-metric-events', `${athlete.athleteId}-assignment-29-complete`, {
          id: `${athlete.athleteId}-assignment-29-complete`,
          pilotId,
          pilotEnrollmentId: athlete.enrollmentId,
          organizationId,
          teamId,
          cohortId: athlete.cohortId,
          athleteId: athlete.athleteId,
          actorRole: 'athlete',
          eventType: 'daily_assignment_completed',
          sourceCollection: 'pulsecheck-daily-assignments',
          sourceDocumentId: `${athlete.athleteId}-assignment-29`,
          sourceDate: '2026-03-29',
          metricPayload: { actionType: 'protocol' },
          createdAt: day29Ms + 11 * 60 * 60 * 1000,
        });
      }
    }
    if (athlete.checkIn30) {
      db.seedDoc('pulsecheck-pilot-metric-events', `${athlete.athleteId}-checkin-30`, {
        id: `${athlete.athleteId}-checkin-30`,
        pilotId,
        pilotEnrollmentId: athlete.enrollmentId,
        organizationId,
        teamId,
        cohortId: athlete.cohortId,
        athleteId: athlete.athleteId,
        actorRole: 'athlete',
        eventType: 'daily_checkin_completed',
        sourceCollection: 'state-snapshots',
        sourceDocumentId: `${athlete.athleteId}-checkin-30`,
        sourceDate: '2026-03-30',
        metricPayload: { readinessScore: 7 },
        createdAt: day30Ms + 10 * 60 * 60 * 1000,
      });
    }
    if (athlete.assignment30) {
      db.seedDoc('pulsecheck-daily-assignments', `${athlete.athleteId}-assignment-30`, {
        id: `${athlete.athleteId}-assignment-30`,
        pilotId,
        pilotEnrollmentId: athlete.enrollmentId,
        organizationId,
        teamId,
        athleteId: athlete.athleteId,
        sourceDate: '2026-03-30',
        actionType: 'protocol',
        status: athlete.assignment30,
        sourceStateSnapshotId: null,
        updatedAt: day30Ms + 11 * 60 * 60 * 1000,
      });
      if (athlete.assignment30 === 'completed') {
        db.seedDoc('pulsecheck-pilot-metric-events', `${athlete.athleteId}-assignment-30-complete`, {
          id: `${athlete.athleteId}-assignment-30-complete`,
          pilotId,
          pilotEnrollmentId: athlete.enrollmentId,
          organizationId,
          teamId,
          cohortId: athlete.cohortId,
          athleteId: athlete.athleteId,
          actorRole: 'athlete',
          eventType: 'daily_assignment_completed',
          sourceCollection: 'pulsecheck-daily-assignments',
          sourceDocumentId: `${athlete.athleteId}-assignment-30`,
          sourceDate: '2026-03-30',
          metricPayload: { actionType: 'protocol' },
          createdAt: day30Ms + 11 * 60 * 60 * 1000,
        });
      }
    }
    if (athlete.escalation) {
      db.seedDoc('escalation-records', `${athlete.athleteId}-escalation`, {
        id: `${athlete.athleteId}-escalation`,
        userId: athlete.athleteId,
        tier: athlete.escalation.tier,
        category: 'general',
        status: athlete.escalation.status,
        createdAt: athlete.escalation.createdAt,
        handoffInitiatedAt: athlete.escalation.handoffInitiatedAt,
        handoffCompletedAt: athlete.escalation.resolvedAt,
        resolvedAt: athlete.escalation.resolvedAt,
      });
    }
  });

  const rollup = await runWithNow(NOW_MS, async () => computePilotOutcomeRollup({
    db,
    pilotId,
    window: 'current',
    pilot: {
      id: pilotId,
      organizationId,
      teamId,
      status: 'active',
      startAt: day29Ms,
      endAt: day30Ms,
    },
  }));

  assert.equal(rollup.diagnostics.adherence.expectedAthleteDays, 4);
  assert.equal(rollup.diagnostics.adherence.activeAthleteCount, 4);
  assert.equal(rollup.diagnostics.adherence.completedCheckInDays, 4);
  assert.equal(rollup.diagnostics.adherence.completedAssignmentDays, 4);
  assert.equal(rollup.diagnostics.adherence.adheredDays, 4);
  assert.equal(rollup.metrics.adherenceRate, 100);
  assert.equal(rollup.metrics.dailyCheckInRate, 100);
  assert.equal(rollup.metrics.assignmentCompletionRate, 100);
});

test('computePilotOutcomeRollup excludes the day after withdrawal from the daily denominator', async () => {
  const { computePilotOutcomeRollup } = loadPulsecheckMetrics();
  const { db } = createPulsecheckFirestore();
  const pilotId = 'pilot-withdrawal-boundary';
  const organizationId = 'org-withdrawal-boundary';
  const teamId = 'team-withdrawal-boundary';
  const day29Ms = NOW_MS - DAY_MS;
  const day30Ms = NOW_MS;

  db.seedDoc('pulsecheck-pilots', pilotId, {
    id: pilotId,
    organizationId,
    teamId,
    status: 'active',
    startAt: day29Ms,
    endAt: day30Ms,
  });

  db.seedDoc('pulsecheck-team-memberships', 'membership-withdrawal-boundary', {
    id: 'membership-withdrawal-boundary',
    userId: 'athlete-withdrawal-boundary',
    role: 'athlete',
    organizationId,
    teamId,
    athleteOnboarding: {
      baselinePathStatus: 'complete',
      entryOnboardingStep: 'complete',
      productConsentAccepted: true,
      completedConsentIds: [],
      requiredConsentIds: [],
    },
  });

  db.seedDoc('pulsecheck-pilot-enrollments', 'enrollment-withdrawal-boundary', {
    id: 'enrollment-withdrawal-boundary',
    pilotId,
    userId: 'athlete-withdrawal-boundary',
    organizationId,
    teamId,
    cohortId: 'alpha',
    teamMembershipId: 'membership-withdrawal-boundary',
    status: 'withdrawn',
    createdAt: day29Ms,
    updatedAt: day29Ms,
  });

  db.seedDoc('pulsecheck-pilot-metric-events', 'withdrawal-boundary-activate', {
    id: 'withdrawal-boundary-activate',
    pilotId,
    pilotEnrollmentId: 'enrollment-withdrawal-boundary',
    organizationId,
    teamId,
    cohortId: 'alpha',
    athleteId: 'athlete-withdrawal-boundary',
    actorRole: 'system',
    eventType: 'pilot_enrollment_activated',
    sourceCollection: 'pulsecheck-pilot-enrollments',
    sourceDocumentId: 'enrollment-withdrawal-boundary',
    sourceDate: '2026-03-29',
    metricPayload: {},
    createdAt: day29Ms + 8 * 60 * 60 * 1000,
  });

  db.seedDoc('pulsecheck-pilot-metric-events', 'withdrawal-boundary-checkin-29', {
    id: 'withdrawal-boundary-checkin-29',
    pilotId,
    pilotEnrollmentId: 'enrollment-withdrawal-boundary',
    organizationId,
    teamId,
    cohortId: 'alpha',
    athleteId: 'athlete-withdrawal-boundary',
    actorRole: 'athlete',
    eventType: 'daily_checkin_completed',
    sourceCollection: 'state-snapshots',
    sourceDocumentId: 'withdrawal-boundary-checkin-29',
    sourceDate: '2026-03-29',
    metricPayload: { readinessScore: 7 },
    createdAt: day29Ms + 10 * 60 * 60 * 1000,
  });

  db.seedDoc('pulsecheck-daily-assignments', 'withdrawal-boundary-assignment-29', {
    id: 'withdrawal-boundary-assignment-29',
    pilotId,
    pilotEnrollmentId: 'enrollment-withdrawal-boundary',
    organizationId,
    teamId,
    athleteId: 'athlete-withdrawal-boundary',
    sourceDate: '2026-03-29',
    actionType: 'protocol',
    status: 'completed',
    sourceStateSnapshotId: null,
    updatedAt: day29Ms + 11 * 60 * 60 * 1000,
  });

  db.seedDoc('pulsecheck-pilot-metric-events', 'withdrawal-boundary-assignment-29-complete', {
    id: 'withdrawal-boundary-assignment-29-complete',
    pilotId,
    pilotEnrollmentId: 'enrollment-withdrawal-boundary',
    organizationId,
    teamId,
    cohortId: 'alpha',
    athleteId: 'athlete-withdrawal-boundary',
    actorRole: 'athlete',
    eventType: 'daily_assignment_completed',
    sourceCollection: 'pulsecheck-daily-assignments',
    sourceDocumentId: 'withdrawal-boundary-assignment-29',
    sourceDate: '2026-03-29',
    metricPayload: { actionType: 'protocol' },
    createdAt: day29Ms + 11 * 60 * 60 * 1000,
  });

  const day29Rollup = await runWithNow(NOW_MS, () => computePilotOutcomeRollup({
    db,
    pilotId,
    window: 'daily',
    explicitDateKey: '2026-03-29',
    pilot: {
      id: pilotId,
      organizationId,
      teamId,
      status: 'active',
      startAt: day29Ms,
      endAt: day30Ms,
    },
  }));

  const day30Rollup = await runWithNow(NOW_MS, () => computePilotOutcomeRollup({
    db,
    pilotId,
    window: 'daily',
    explicitDateKey: '2026-03-30',
    pilot: {
      id: pilotId,
      organizationId,
      teamId,
      status: 'active',
      startAt: day29Ms,
      endAt: day30Ms,
    },
  }));

  assert.equal(day29Rollup.diagnostics.adherence.expectedAthleteDays, 1);
  assert.equal(day29Rollup.diagnostics.adherence.completedCheckInDays, 1);
  assert.equal(day29Rollup.diagnostics.adherence.completedAssignmentDays, 1);
  assert.equal(day30Rollup.diagnostics.adherence.expectedAthleteDays, 0);
  assert.equal(day30Rollup.diagnostics.adherence.completedCheckInDays, 0);
  assert.equal(day30Rollup.diagnostics.adherence.completedAssignmentDays, 0);
});

test('computePilotOutcomeRollup counts care escalations separately from coach-review-only records and preserves headline speed-to-care metrics', async () => {
  const { computePilotOutcomeRollup } = loadPulsecheckMetrics();
  const { db } = createPulsecheckFirestore();
  const context = seedBasePilotContext(db, {
    pilotStartAt: NOW_MS - DAY_MS,
    pilotEndAt: NOW_MS + DAY_MS,
    enrollmentCreatedAt: NOW_MS - DAY_MS,
    enrollmentUpdatedAt: NOW_MS - DAY_MS,
  });

  db.seedDoc('escalation-records', 'escalation-tier-1', {
    id: 'escalation-tier-1',
    userId: context.athleteId,
    tier: 1,
    category: 'general',
    disposition: 'coach_review',
    classificationFamily: 'performance_stress',
    status: 'active',
    createdAt: NOW_MS - 90 * 60 * 1000,
    handoffInitiatedAt: NOW_MS - 60 * 60 * 1000,
    handoffCompletedAt: NOW_MS - 30 * 60 * 1000,
    resolvedAt: NOW_MS - 30 * 60 * 1000,
  });
  db.seedDoc('escalation-records', 'escalation-tier-2', {
    id: 'escalation-tier-2',
    userId: context.athleteId,
    tier: 2,
    category: 'general',
    disposition: 'clinical_handoff',
    classificationFamily: 'care_escalation',
    status: 'resolved',
    createdAt: NOW_MS - 120 * 60 * 1000,
    handoffInitiatedAt: NOW_MS - 75 * 60 * 1000,
    handoffCompletedAt: NOW_MS - 45 * 60 * 1000,
    resolvedAt: NOW_MS - 45 * 60 * 1000,
  });
  db.seedDoc('escalation-records', 'escalation-tier-3', {
    id: 'escalation-tier-3',
    userId: context.athleteId,
    tier: 3,
    category: 'general',
    disposition: 'clinical_handoff',
    classificationFamily: 'care_escalation',
    status: 'active',
    createdAt: NOW_MS - 150 * 60 * 1000,
    handoffInitiatedAt: NOW_MS - 90 * 60 * 1000,
    handoffCompletedAt: NOW_MS - 60 * 60 * 1000,
    resolvedAt: NOW_MS - 60 * 60 * 1000,
  });

  const rollup = await runWithNow(NOW_MS, () => computePilotOutcomeRollup({
    db,
    pilotId: context.pilotId,
    window: 'current',
    pilot: {
      id: context.pilotId,
      organizationId: context.organizationId,
      teamId: context.teamId,
      status: 'active',
      startAt: NOW_MS - DAY_MS,
      endAt: NOW_MS + DAY_MS,
    },
  }));

  assert.equal(rollup.metrics.escalationsTotal, 2);
  assert.equal(rollup.metrics.escalationsTier1, 0);
  assert.equal(rollup.metrics.escalationsTier2, 1);
  assert.equal(rollup.metrics.escalationsTier3, 1);
  assert.equal(rollup.metrics.medianMinutesToCare, 52.5);
  assert.equal(rollup.diagnostics.escalations.ratePer100ActiveAthletes, 200);
  assert.equal(rollup.diagnostics.escalations.coachReviewOnlyTotal, 1);
  assert.equal(rollup.diagnostics.escalations.allOperationalEscalationsTotal, 3);
});

test('computePilotOutcomeRollup exposes escalation status buckets and supporting speed-to-care metrics', async () => {
  const { computePilotOutcomeRollup } = loadPulsecheckMetrics();
  const { db } = createPulsecheckFirestore();
  const context = seedBasePilotContext(db, {
    pilotId: 'pilot-escalation-support',
    pilotEnrollmentId: 'pilot-enrollment-escalation-support',
    pilotStartAt: NOW_MS - DAY_MS,
    pilotEndAt: NOW_MS + DAY_MS,
  });

  db.seedDoc('escalation-records', 'support-active', {
    id: 'support-active',
    userId: context.athleteId,
    tier: 1,
    category: 'general',
    disposition: 'coach_review',
    classificationFamily: 'performance_stress',
    status: 'active',
    createdAt: NOW_MS - 60 * 60 * 1000,
    coachNotifiedAt: NOW_MS - 55 * 60 * 1000,
    handoffInitiatedAt: NOW_MS - 40 * 60 * 1000,
  });
  db.seedDoc('escalation-records', 'support-resolved', {
    id: 'support-resolved',
    userId: context.athleteId,
    tier: 2,
    category: 'general',
    disposition: 'clinical_handoff',
    classificationFamily: 'care_escalation',
    status: 'resolved',
    createdAt: NOW_MS - 120 * 60 * 1000,
    coachNotifiedAt: NOW_MS - 115 * 60 * 1000,
    consentTimestamp: NOW_MS - 110 * 60 * 1000,
    handoffInitiatedAt: NOW_MS - 90 * 60 * 1000,
    handoffAcceptedAt: NOW_MS - 80 * 60 * 1000,
    firstClinicianResponseAt: NOW_MS - 75 * 60 * 1000,
    handoffCompletedAt: NOW_MS - 45 * 60 * 1000,
    resolvedAt: NOW_MS - 45 * 60 * 1000,
  });
  db.seedDoc('escalation-records', 'support-declined', {
    id: 'support-declined',
    userId: context.athleteId,
    tier: 3,
    category: 'general',
    disposition: 'clinical_handoff',
    classificationFamily: 'care_escalation',
    status: 'declined',
    createdAt: NOW_MS - 180 * 60 * 1000,
    coachNotifiedAt: NOW_MS - 175 * 60 * 1000,
  });

  const rollup = await runWithNow(NOW_MS, () => computePilotOutcomeRollup({
    db,
    pilotId: context.pilotId,
    window: 'current',
    pilot: {
      id: context.pilotId,
      organizationId: context.organizationId,
      teamId: context.teamId,
      status: 'active',
      startAt: NOW_MS - DAY_MS,
      endAt: NOW_MS + DAY_MS,
    },
  }));

  assert.deepEqual(rollup.diagnostics.escalations.statusCounts, {
    active: 0,
    resolved: 1,
    declined: 1,
  });
  assert.deepEqual(rollup.diagnostics.escalations.tierByStatus, {
    tier1: { total: 0, active: 0, resolved: 0, declined: 0 },
    tier2: { total: 1, active: 0, resolved: 1, declined: 0 },
    tier3: { total: 1, active: 0, resolved: 0, declined: 1 },
  });
  assert.equal(rollup.diagnostics.escalations.coachReviewOnlyTotal, 1);
  assert.equal(rollup.diagnostics.escalations.allOperationalEscalationsTotal, 3);
  assert.equal(rollup.diagnostics.escalations.supportingSpeedToCare.coachNotification.medianMinutes, 5);
  assert.equal(rollup.diagnostics.escalations.supportingSpeedToCare.consentAccepted.medianMinutes, 10);
  assert.equal(rollup.diagnostics.escalations.supportingSpeedToCare.handoffInitiated.medianMinutes, 30);
  assert.equal(rollup.diagnostics.escalations.supportingSpeedToCare.handoffAccepted.medianMinutes, 40);
  assert.equal(rollup.diagnostics.escalations.supportingSpeedToCare.firstClinicianResponse.medianMinutes, 45);
  assert.equal(rollup.diagnostics.escalations.supportingSpeedToCare.careCompleted.medianMinutes, 75);
  assert.equal(rollup.diagnostics.escalations.workflowContinuity.manualReviewRequired, false);
  assert.equal(rollup.diagnostics.escalations.workflowContinuity.coachWorkflowVisibleTotal, 1);
  assert.equal(rollup.diagnostics.escalations.workflowContinuity.coachWorkflowActionableTotal, 1);
});

test('buildCoachWorkflowContinuityReport flags active coach-review items that lose coach visibility after disposition changes', () => {
  const { buildCoachWorkflowContinuityReport } = loadPulsecheckMetrics();

  const report = buildCoachWorkflowContinuityReport([
    {
      id: 'coach-review-visible',
      userId: 'athlete-1',
      tier: 1,
      disposition: 'coach_review',
      classificationFamily: 'coach_review',
      status: 'active',
      requiresCoachReview: true,
      createdAt: NOW_MS - 60 * 60 * 1000,
    },
    {
      id: 'coach-review-lost',
      userId: 'athlete-1',
      tier: 2,
      disposition: 'clinical_handoff',
      classificationFamily: 'care_escalation',
      status: 'active',
      requiresCoachReview: true,
      createdAt: NOW_MS - 90 * 60 * 1000,
    },
  ], { sampleLimit: 5 });

  assert.equal(report.coachWorkflowEligibleTotal, 2);
  assert.equal(report.coachWorkflowVisibleTotal, 1);
  assert.equal(report.coachWorkflowActionableTotal, 1);
  assert.equal(report.coachWorkflowVisibilityGapTotal, 1);
  assert.equal(report.manualReviewRequired, true);
  assert.equal(report.continuityStatus, 'needs_manual_review');
  assert.equal(report.samples.length, 2);
  assert.equal(report.samples[0].visibleToCoach, true);
  assert.equal(report.samples[1].visibleToCoach, false);
});

test('upsertPilotMentalPerformanceSnapshot preserves endpoint freeze metadata when endpoint snapshots are written', async () => {
  const { upsertPilotMentalPerformanceSnapshot } = loadPulsecheckMetrics();
  const { db } = createPulsecheckFirestore();
  const context = seedBasePilotContext(db, {
    enrollmentCreatedAt: NOW_MS - DAY_MS,
    enrollmentUpdatedAt: NOW_MS - DAY_MS,
  });

  db.seedDoc('athlete-mental-progress', context.athleteId, {
    baselineProbe: null,
    lastProfileSyncAt: NOW_MS,
    updatedAt: NOW_MS,
    taxonomyProfile: {
      overallScore: 60,
      pillarScores: { focus: 61, composure: 60, decision: 59 },
      skillScores: {},
      modifierScores: {},
      strongestSkills: [],
      weakestSkills: [],
      trendSummary: [],
      updatedAt: NOW_MS,
    },
  });

  const snapshot = await runWithNow(NOW_MS, () => upsertPilotMentalPerformanceSnapshot({
    db,
    athleteId: context.athleteId,
    snapshotType: 'endpoint',
    preferredPilotEnrollmentId: context.pilotEnrollmentId,
    preferredPilotId: context.pilotId,
    preferredTeamMembershipId: context.teamMembershipId,
    endpointFreeze: {
      frozen: true,
      frozenAt: NOW_MS,
      freezeReason: 'manual_override',
    },
  }));

  assert.equal(snapshot.endpointFreeze.frozen, true);
  assert.equal(snapshot.endpointFreeze.freezeReason, 'manual_override');
  assert.equal(snapshot.validity.excludedFromHeadlineDelta, false);
  assert.equal(
    db.getDoc(`pulsecheck-pilot-enrollments/${context.pilotEnrollmentId}/mental-performance-snapshots`, 'endpoint').endpointFreeze.frozen,
    true
  );
});

test('computePilotOutcomeRollup auto-freezes endpoint snapshots for pilot end date and completed enrollments', async () => {
  const { computePilotOutcomeRollup } = loadPulsecheckMetrics();
  const { db } = createPulsecheckFirestore();
  const pilotId = 'pilot-endpoint-freeze';
  const organizationId = 'org-endpoint-freeze';
  const teamId = 'team-endpoint-freeze';

  db.seedDoc('pulsecheck-pilots', pilotId, {
    id: pilotId,
    organizationId,
    teamId,
    status: 'completed',
    startAt: NOW_MS - (10 * DAY_MS),
    endAt: NOW_MS - DAY_MS,
  });

  [
    { athleteId: 'athlete-pilot-end', enrollmentId: 'enrollment-pilot-end', teamMembershipId: 'membership-pilot-end', status: 'active' },
    { athleteId: 'athlete-complete', enrollmentId: 'enrollment-complete', teamMembershipId: 'membership-complete', status: 'completed' },
  ].forEach((entry) => {
    db.seedDoc('pulsecheck-team-memberships', entry.teamMembershipId, {
      id: entry.teamMembershipId,
      userId: entry.athleteId,
      role: 'athlete',
      organizationId,
      teamId,
      athleteOnboarding: {
        baselinePathStatus: 'complete',
        entryOnboardingStep: 'complete',
        productConsentAccepted: true,
        completedConsentIds: [],
        requiredConsentIds: [],
      },
    });

    db.seedDoc('pulsecheck-pilot-enrollments', entry.enrollmentId, {
      id: entry.enrollmentId,
      pilotId,
      userId: entry.athleteId,
      organizationId,
      teamId,
      cohortId: 'alpha',
      teamMembershipId: entry.teamMembershipId,
      status: entry.status,
      createdAt: NOW_MS - (8 * DAY_MS),
      updatedAt: NOW_MS - (2 * DAY_MS),
      completedAt: entry.status === 'completed' ? NOW_MS - (2 * DAY_MS) : null,
    });

    db.seedDoc(`pulsecheck-pilot-enrollments/${entry.enrollmentId}/mental-performance-snapshots`, 'baseline', {
      id: 'baseline',
      pilotEnrollmentId: entry.enrollmentId,
      pilotId,
      organizationId,
      teamId,
      athleteId: entry.athleteId,
      snapshotType: 'baseline',
      status: 'valid',
      capturedAt: NOW_MS - (7 * DAY_MS),
      computedAt: NOW_MS - (7 * DAY_MS),
      sourceProfileVersion: 'taxonomy-v1',
      sourceWriterVersion: 'profile-snapshot-writer-v1',
      taxonomyProfile: { overallScore: 50, pillarScores: { focus: 50, composure: 50, decision: 50 }, skillScores: {}, modifierScores: {}, strongestSkills: [], weakestSkills: [], trendSummary: [], updatedAt: NOW_MS - (7 * DAY_MS) },
      pillarCompositeScore: 50,
      targetDeltaFromBaseline: { focus: 0, composure: 0, decision: 0, pillarComposite: 0 },
      validity: { hasBaselineAssessment: true, hasRecentProfile: true, excludedFromHeadlineDelta: false, exclusionReason: null },
      endpointFreeze: { frozen: false, frozenAt: null, freezeReason: null },
    });

    db.seedDoc('athlete-mental-progress', entry.athleteId, {
      taxonomyProfile: {
        overallScore: 62,
        pillarScores: { focus: 63, composure: 62, decision: 61 },
        skillScores: {},
        modifierScores: {},
        strongestSkills: [],
        weakestSkills: [],
        trendSummary: [],
        updatedAt: NOW_MS - DAY_MS,
      },
      lastProfileSyncAt: NOW_MS - DAY_MS,
      updatedAt: NOW_MS - DAY_MS,
    });
  });

  await runWithNow(NOW_MS, () => computePilotOutcomeRollup({
    db,
    pilotId,
    window: 'current',
  }));

  assert.equal(
    db.getDoc('pulsecheck-pilot-enrollments/enrollment-pilot-end/mental-performance-snapshots', 'endpoint').endpointFreeze.freezeReason,
    'pilot_end_date'
  );
  assert.equal(
    db.getDoc('pulsecheck-pilot-enrollments/enrollment-complete/mental-performance-snapshots', 'endpoint').endpointFreeze.freezeReason,
    'athlete_completion'
  );
});

test('computePilotOutcomeRollup exposes rollup-backed hypothesis comparisons and cohort survey diagnostics', async () => {
  const { computePilotOutcomeRollup, savePilotSurveyResponse } = loadPulsecheckMetrics();
  const { db } = createPulsecheckFirestore();
  const alpha = seedBasePilotContext(db, {
    pilotId: 'pilot-hypothesis',
    pilotEnrollmentId: 'pilot-enrollment-alpha',
    athleteId: 'athlete-alpha',
    teamMembershipId: 'membership-alpha',
    cohortId: 'alpha',
    pilotStartAt: NOW_MS - DAY_MS,
    pilotEndAt: NOW_MS + DAY_MS,
    enrollmentCreatedAt: NOW_MS - DAY_MS,
    enrollmentUpdatedAt: NOW_MS - DAY_MS,
  });
  const beta = seedBasePilotContext(db, {
    pilotId: alpha.pilotId,
    pilotEnrollmentId: 'pilot-enrollment-beta',
    athleteId: 'athlete-beta',
    teamMembershipId: 'membership-beta',
    cohortId: 'beta',
    teamId: alpha.teamId,
    organizationId: alpha.organizationId,
    pilotStartAt: NOW_MS - DAY_MS,
    pilotEndAt: NOW_MS + DAY_MS,
    enrollmentCreatedAt: NOW_MS - DAY_MS,
    enrollmentUpdatedAt: NOW_MS - DAY_MS,
  });

  db.seedDoc('pulsecheck-pilot-enrollments', alpha.pilotEnrollmentId, {
    ...db.getDoc('pulsecheck-pilot-enrollments', alpha.pilotEnrollmentId),
    optionalBaselineCovariates: {
      trustDispositionBaseline: {
        kind: 'ptt',
        version: 'ptt_v1',
        score: 7,
        capturedAt: NOW_MS - DAY_MS,
        source: 'ios',
      },
    },
  });
  db.seedDoc('pulsecheck-pilot-enrollments', beta.pilotEnrollmentId, {
    ...db.getDoc('pulsecheck-pilot-enrollments', beta.pilotEnrollmentId),
    optionalBaselineCovariates: {
      trustDispositionBaseline: {
        kind: 'ptt',
        version: 'ptt_v1',
        score: 4,
        capturedAt: NOW_MS - DAY_MS,
        source: 'ios',
      },
    },
  });

  db.seedDoc(`pulsecheck-pilot-enrollments/${alpha.pilotEnrollmentId}/mental-performance-snapshots`, 'current_latest_valid', {
    id: 'current_latest_valid',
    pilotEnrollmentId: alpha.pilotEnrollmentId,
    pilotId: alpha.pilotId,
    organizationId: alpha.organizationId,
    teamId: alpha.teamId,
    athleteId: alpha.athleteId,
    snapshotType: 'current_latest_valid',
    status: 'valid',
    capturedAt: NOW_MS,
    computedAt: NOW_MS,
    sourceProfileVersion: 'taxonomy-v1',
    sourceWriterVersion: 'profile-snapshot-writer-v1',
    taxonomyProfile: { overallScore: 60, pillarScores: { focus: 60, composure: 58, decision: 56 }, skillScores: {}, modifierScores: {}, strongestSkills: [], weakestSkills: [], trendSummary: [], updatedAt: NOW_MS },
    pillarCompositeScore: 58,
    targetDeltaFromBaseline: { focus: 10, composure: 8, decision: 6, pillarComposite: 8 },
    validity: { hasBaselineAssessment: true, hasRecentProfile: true, excludedFromHeadlineDelta: false, exclusionReason: null },
    endpointFreeze: { frozen: false, frozenAt: null, freezeReason: null },
  });
  db.seedDoc(`pulsecheck-pilot-enrollments/${beta.pilotEnrollmentId}/mental-performance-snapshots`, 'current_latest_valid', {
    id: 'current_latest_valid',
    pilotEnrollmentId: beta.pilotEnrollmentId,
    pilotId: beta.pilotId,
    organizationId: beta.organizationId,
    teamId: beta.teamId,
    athleteId: beta.athleteId,
    snapshotType: 'current_latest_valid',
    status: 'valid',
    capturedAt: NOW_MS,
    computedAt: NOW_MS,
    sourceProfileVersion: 'taxonomy-v1',
    sourceWriterVersion: 'profile-snapshot-writer-v1',
    taxonomyProfile: { overallScore: 52, pillarScores: { focus: 51, composure: 51, decision: 51 }, skillScores: {}, modifierScores: {}, strongestSkills: [], weakestSkills: [], trendSummary: [], updatedAt: NOW_MS },
    pillarCompositeScore: 51,
    targetDeltaFromBaseline: { focus: 1, composure: 1, decision: 1, pillarComposite: 1 },
    validity: { hasBaselineAssessment: true, hasRecentProfile: true, excludedFromHeadlineDelta: false, exclusionReason: null },
    endpointFreeze: { frozen: false, frozenAt: null, freezeReason: null },
  });

  db.seedDoc('pulsecheck-daily-assignments', 'assignment-alpha', {
    id: 'assignment-alpha',
    pilotId: alpha.pilotId,
    athleteId: alpha.athleteId,
    teamId: alpha.teamId,
    organizationId: alpha.organizationId,
    cohortId: alpha.cohortId,
    sourceDate: '2026-03-30',
    actionType: 'protocol',
    status: 'completed',
    sourceStateSnapshotId: 'state-alpha',
    updatedAt: NOW_MS,
  });
  db.seedDoc('pulsecheck-daily-assignments', 'assignment-beta', {
    id: 'assignment-beta',
    pilotId: beta.pilotId,
    athleteId: beta.athleteId,
    teamId: beta.teamId,
    organizationId: beta.organizationId,
    cohortId: beta.cohortId,
    sourceDate: '2026-03-30',
    actionType: 'protocol',
    status: 'assigned',
    updatedAt: NOW_MS,
  });

  db.seedDoc('pulsecheck-pilot-metric-events', 'checkin-alpha', {
    id: 'checkin-alpha',
    pilotId: alpha.pilotId,
    pilotEnrollmentId: alpha.pilotEnrollmentId,
    organizationId: alpha.organizationId,
    teamId: alpha.teamId,
    cohortId: alpha.cohortId,
    athleteId: alpha.athleteId,
    actorUserId: alpha.athleteId,
    actorRole: 'athlete',
    eventType: 'daily_checkin_completed',
    sourceCollection: 'state-snapshots',
    sourceDocumentId: 'state-alpha',
    sourceDate: '2026-03-30',
    metricPayload: {},
    createdAt: NOW_MS,
  });
  db.seedDoc('pulsecheck-pilot-metric-events', 'assignment-complete-alpha', {
    id: 'assignment-complete-alpha',
    pilotId: alpha.pilotId,
    pilotEnrollmentId: alpha.pilotEnrollmentId,
    organizationId: alpha.organizationId,
    teamId: alpha.teamId,
    cohortId: alpha.cohortId,
    athleteId: alpha.athleteId,
    actorUserId: alpha.athleteId,
    actorRole: 'athlete',
    eventType: 'daily_assignment_completed',
    sourceCollection: 'pulsecheck-daily-assignments',
    sourceDocumentId: 'assignment-alpha',
    sourceDate: '2026-03-30',
    metricPayload: { actionType: 'protocol' },
    createdAt: NOW_MS,
  });

  await runWithNow(NOW_MS, async () => {
    await savePilotSurveyResponse({
      db,
      authUserId: alpha.athleteId,
      surveyKind: 'trust',
      score: 9,
      respondentRole: 'athlete',
      source: 'ios',
      pilotId: alpha.pilotId,
      pilotEnrollmentId: alpha.pilotEnrollmentId,
      cohortId: alpha.cohortId,
      teamId: alpha.teamId,
      organizationId: alpha.organizationId,
      athleteId: alpha.athleteId,
    });
    await savePilotSurveyResponse({
      db,
      authUserId: beta.athleteId,
      surveyKind: 'trust',
      score: 5,
      respondentRole: 'athlete',
      source: 'ios',
      pilotId: beta.pilotId,
      pilotEnrollmentId: beta.pilotEnrollmentId,
      cohortId: beta.cohortId,
      teamId: beta.teamId,
      organizationId: beta.organizationId,
      athleteId: beta.athleteId,
    });
    await savePilotSurveyResponse({
      db,
      authUserId: 'coach-1',
      surveyKind: 'trust',
      score: 8,
      respondentRole: 'coach',
      source: 'web-admin',
      pilotId: alpha.pilotId,
      cohortId: alpha.cohortId,
      teamId: alpha.teamId,
      organizationId: alpha.organizationId,
    });
  });

  const rollup = await computePilotOutcomeRollup({
    db,
    pilotId: alpha.pilotId,
    window: 'current',
    pilot: {
      id: alpha.pilotId,
      organizationId: alpha.organizationId,
      teamId: alpha.teamId,
      status: 'active',
      startAt: NOW_MS - DAY_MS,
      endAt: NOW_MS + DAY_MS,
    },
  });

  assert.equal(rollup.diagnostics.hypothesisEvaluation.h3.stateAware.athleteCount, 1);
  assert.equal(rollup.diagnostics.hypothesisEvaluation.h3.fallbackOrNone.athleteCount, 1);
  assert.equal(rollup.diagnostics.hypothesisEvaluation.h3.delta.adherenceRate, 50);
  assert.equal(rollup.diagnostics.hypothesisEvaluation.h3.delta.mentalPerformanceDelta, 7);
  assert.equal(rollup.diagnostics.hypothesisEvaluation.h3.delta.athleteTrust, 4);
  assert.equal(rollup.diagnostics.hypothesisEvaluation.h5.coachResponseCount, 1);
  assert.equal(rollup.diagnostics.hypothesisEvaluation.h6.completedProtocol.athleteCount, 1);
  assert.equal(rollup.diagnostics.hypothesisEvaluation.h6.incompleteOrSkippedProtocol.athleteCount, 1);
  assert.equal(rollup.diagnostics.recommendationTypeSlices.stateAwareVsFallback.delta.adherenceRate, 50);
  assert.equal(rollup.diagnostics.recommendationTypeSlices.stateAwareVsFallback.delta.athleteTrust, 4);
  assert.equal(rollup.diagnostics.recommendationTypeSlices.protocolCompletion.delta.adherenceRate, 50);
  assert.equal(rollup.diagnostics.trustDispositionBaseline.responseCount, 2);
  assert.equal(rollup.diagnostics.trustDispositionBaseline.averageScore, 5.5);
  assert.equal(rollup.diagnostics.surveysByCohort.alpha.athleteTrust.responseCount, 1);
  assert.equal(rollup.diagnostics.surveysByCohort.beta.athleteTrust.responseCount, 1);
  assert.equal(rollup.outcomeByCohort.alpha.athleteTrust, null);
});

test('recomputePilotMetricRollups is replay-safe and keeps a single deterministic rollup document per window', async () => {
  const { emitPilotMetricEvent, recomputePilotMetricRollups } = loadPulsecheckMetrics();
  const { db } = createPulsecheckFirestore();
  const context = seedBasePilotContext(db, {
    pilotStartAt: NOW_MS,
    pilotEndAt: NOW_MS + DAY_MS,
    enrollmentCreatedAt: NOW_MS,
    enrollmentUpdatedAt: NOW_MS,
  });

  db.seedDoc('athlete-mental-progress', context.athleteId, {
    taxonomyProfile: {
      overallScore: 61,
      pillarScores: { focus: 63, composure: 60, decision: 58 },
      skillScores: {},
      modifierScores: {},
      strongestSkills: [],
      weakestSkills: [],
      trendSummary: [],
      updatedAt: NOW_MS,
    },
    lastProfileSyncAt: NOW_MS,
    updatedAt: NOW_MS,
  });
  db.seedDoc(`pulsecheck-pilot-enrollments/${context.pilotEnrollmentId}/mental-performance-snapshots`, 'current_latest_valid', {
    id: 'current_latest_valid',
    pilotEnrollmentId: context.pilotEnrollmentId,
    pilotId: context.pilotId,
    organizationId: context.organizationId,
    teamId: context.teamId,
    athleteId: context.athleteId,
    snapshotType: 'current_latest_valid',
    status: 'valid',
    capturedAt: NOW_MS,
    computedAt: NOW_MS,
    sourceProfileVersion: 'taxonomy-v1',
    sourceWriterVersion: 'profile-snapshot-writer-v1',
    taxonomyProfile: {
      overallScore: 61,
      pillarScores: { focus: 63, composure: 60, decision: 58 },
      skillScores: {},
      modifierScores: {},
      strongestSkills: [],
      weakestSkills: [],
      trendSummary: [],
      updatedAt: NOW_MS,
    },
    pillarCompositeScore: 60.3,
    targetDeltaFromBaseline: { focus: 13, composure: 10, decision: 8, pillarComposite: 11 },
    validity: {
      hasBaselineAssessment: true,
      hasRecentProfile: true,
      excludedFromHeadlineDelta: false,
      exclusionReason: null,
    },
    endpointFreeze: {
      frozen: false,
      frozenAt: null,
      freezeReason: null,
    },
  });

  await runWithNow(NOW_MS, async () => {
    await emitPilotMetricEvent({
      db,
      pilotContext: context,
      eventType: 'daily_checkin_completed',
      actorRole: 'athlete',
      actorUserId: context.athleteId,
      athleteId: context.athleteId,
      sourceCollection: 'state-snapshots',
      sourceDocumentId: 'snapshot-1',
      sourceDate: '2026-03-30',
      metricPayload: { readinessScore: 7 },
      createdAt: NOW_MS,
    });

    await emitPilotMetricEvent({
      db,
      pilotContext: context,
      eventType: 'daily_checkin_completed',
      actorRole: 'athlete',
      actorUserId: context.athleteId,
      athleteId: context.athleteId,
      sourceCollection: 'state-snapshots',
      sourceDocumentId: 'snapshot-1',
      sourceDate: '2026-03-30',
      metricPayload: { readinessScore: 7 },
      createdAt: NOW_MS,
    });

    await emitPilotMetricEvent({
      db,
      pilotContext: context,
      eventType: 'daily_assignment_completed',
      actorRole: 'athlete',
      actorUserId: context.athleteId,
      athleteId: context.athleteId,
      sourceCollection: 'pulsecheck-daily-assignments',
      sourceDocumentId: 'assignment-1',
      sourceDate: '2026-03-30',
      metricPayload: { actionType: 'sim' },
      createdAt: NOW_MS,
    });

    await emitPilotMetricEvent({
      db,
      pilotContext: context,
      eventType: 'daily_assignment_completed',
      actorRole: 'athlete',
      actorUserId: context.athleteId,
      athleteId: context.athleteId,
      sourceCollection: 'pulsecheck-daily-assignments',
      sourceDocumentId: 'assignment-1',
      sourceDate: '2026-03-30',
      metricPayload: { actionType: 'sim' },
      createdAt: NOW_MS,
    });
  });

  const first = await runWithNow(NOW_MS, () => recomputePilotMetricRollups({
    db,
    pilotId: context.pilotId,
    explicitDateKeys: ['2026-03-30'],
  }));
  const second = await runWithNow(NOW_MS, () => recomputePilotMetricRollups({
    db,
    pilotId: context.pilotId,
    explicitDateKeys: ['2026-03-30'],
  }));

  assert.equal(first.current.metrics.adherenceRate, 100);
  assert.equal(first.current.metrics.dailyCheckInRate, 100);
  assert.equal(first.current.metrics.assignmentCompletionRate, 100);
  assert.equal(first.current.metrics.mentalPerformanceDelta, 11);
  assert.equal(second.current.metrics.adherenceRate, 100);
  assert.equal(db.getCollectionDocs('pulsecheck-pilot-metric-events').length, 2);
  assert.equal(db.getCollectionDocs(`pulsecheck-pilot-metric-rollups/${context.pilotId}/summary`).length, 3);
  assert.equal(db.getCollectionDocs(`pulsecheck-pilot-metric-rollups/${context.pilotId}/daily`).length, 1);
});

test('recomputePilotMetricRollups records ops status for admin debugging', async () => {
  const { recomputePilotMetricRollups } = loadPulsecheckMetrics();
  const { db } = createPulsecheckFirestore();
  const context = seedBasePilotContext(db, {
    pilotId: 'pilot-ops-status',
    pilotEnrollmentId: 'pilot-enrollment-ops-status',
    enrollmentCreatedAt: NOW_MS - DAY_MS,
    enrollmentUpdatedAt: NOW_MS - DAY_MS,
  });

  await runWithNow(NOW_MS, () => recomputePilotMetricRollups({
    db,
    pilotId: context.pilotId,
    explicitDateKeys: ['2026-03-30'],
  }));

  const scopeDoc = db.getDoc(`pulsecheck-pilot-metric-ops/${context.pilotId}/scopes`, 'rollup_recompute');
  assert.equal(scopeDoc.pilotId, context.pilotId);
  assert.equal(scopeDoc.scope, 'rollup_recompute');
  assert.equal(scopeDoc.status, 'succeeded');
  assert.equal(scopeDoc.repairedDailyCount, 1);
});

test('getAthletePilotSurveyPromptState suppresses prompts during active escalation and resumes after resolution', async () => {
  const { getAthletePilotSurveyPromptState, computePilotOutcomeRollup } = loadPulsecheckMetrics();
  const { db } = createPulsecheckFirestore();
  const context = seedBasePilotContext(db, {
    pilotStartAt: NOW_MS - 3 * DAY_MS,
    pilotEndAt: NOW_MS + 3 * DAY_MS,
  });

  db.seedDoc('pulsecheck-pilot-metric-events', 'session-1', {
    id: 'session-1',
    pilotId: context.pilotId,
    pilotEnrollmentId: context.pilotEnrollmentId,
    organizationId: context.organizationId,
    teamId: context.teamId,
    athleteId: context.athleteId,
    actorUserId: context.athleteId,
    actorRole: 'athlete',
    eventType: 'daily_assignment_completed',
    sourceCollection: 'pulsecheck-daily-assignments',
    sourceDocumentId: 'assignment-1',
    sourceDate: '2026-03-29',
    metricPayload: {},
    createdAt: NOW_MS - DAY_MS,
  });
  db.seedDoc('pulsecheck-pilot-metric-events', 'session-2', {
    id: 'session-2',
    pilotId: context.pilotId,
    pilotEnrollmentId: context.pilotEnrollmentId,
    organizationId: context.organizationId,
    teamId: context.teamId,
    athleteId: context.athleteId,
    actorUserId: context.athleteId,
    actorRole: 'athlete',
    eventType: 'daily_assignment_completed',
    sourceCollection: 'pulsecheck-daily-assignments',
    sourceDocumentId: 'assignment-2',
    sourceDate: '2026-03-30',
    metricPayload: {},
    createdAt: NOW_MS,
  });
  db.seedDoc('pulsecheck-pilot-metric-events', 'session-3', {
    id: 'session-3',
    pilotId: context.pilotId,
    pilotEnrollmentId: context.pilotEnrollmentId,
    organizationId: context.organizationId,
    teamId: context.teamId,
    athleteId: context.athleteId,
    actorUserId: context.athleteId,
    actorRole: 'athlete',
    eventType: 'daily_assignment_completed',
    sourceCollection: 'pulsecheck-daily-assignments',
    sourceDocumentId: 'assignment-3',
    sourceDate: '2026-03-30',
    metricPayload: {},
    createdAt: NOW_MS,
  });

  db.seedDoc('escalation-records', 'escalation-1', {
    id: 'escalation-1',
    userId: context.athleteId,
    tier: 2,
    category: 'general',
    status: 'active',
    createdAt: NOW_MS - 45 * 60 * 1000,
    handoffInitiatedAt: NOW_MS - 15 * 60 * 1000,
    handoffCompletedAt: null,
    resolvedAt: null,
  });

  const beforeResolution = await runWithNow(NOW_MS, async () => computePilotOutcomeRollup({
    db,
    pilotId: context.pilotId,
    window: 'current',
    pilot: {
      id: context.pilotId,
      organizationId: context.organizationId,
      teamId: context.teamId,
      status: 'active',
      startAt: NOW_MS - 3 * DAY_MS,
      endAt: NOW_MS + 3 * DAY_MS,
    },
  }));
  assert.equal(beforeResolution.metrics.escalationsTotal, 1);
  assert.equal(beforeResolution.metrics.medianMinutesToCare, 30);

  const promptStateBefore = await runWithNow(NOW_MS, () => getAthletePilotSurveyPromptState({
    db,
    athleteId: context.athleteId,
    preferredPilotEnrollmentId: context.pilotEnrollmentId,
    preferredPilotId: context.pilotId,
  }));
  assert.equal(promptStateBefore.suppressionReason, 'active_escalation');
  assert.equal(promptStateBefore.pendingPrompts.length, 0);

  db.seedDoc('escalation-records', 'escalation-1', {
    id: 'escalation-1',
    userId: context.athleteId,
    tier: 2,
    category: 'general',
    status: 'resolved',
    createdAt: NOW_MS - 45 * 60 * 1000,
    handoffInitiatedAt: NOW_MS - 15 * 60 * 1000,
    handoffCompletedAt: NOW_MS - 10 * 60 * 1000,
    resolvedAt: NOW_MS,
  });

  const promptStateAfter = await runWithNow(NOW_MS, () => getAthletePilotSurveyPromptState({
    db,
    athleteId: context.athleteId,
    preferredPilotEnrollmentId: context.pilotEnrollmentId,
    preferredPilotId: context.pilotId,
  }));

  assert.equal(promptStateAfter.suppressionReason, null);
  assert.equal(promptStateAfter.endpointEligible, false);
  assert.equal(promptStateAfter.midpointEligible, true);
  assert.ok(promptStateAfter.pendingPrompts.some((prompt) => prompt.surveyKind === 'trust'));
  assert.ok(promptStateAfter.pendingPrompts.some((prompt) => prompt.surveyKind === 'nps'));
});

test('getAthletePilotSurveyPromptState does not suppress prompts for downgraded active support-only escalations', async () => {
  const { getAthletePilotSurveyPromptState } = loadPulsecheckMetrics();
  const { db } = createPulsecheckFirestore();
  const context = seedBasePilotContext(db, {
    pilotStartAt: NOW_MS - 3 * DAY_MS,
    pilotEndAt: NOW_MS + 3 * DAY_MS,
  });

  db.seedDoc('pulsecheck-pilot-metric-events', 'support-session-1', {
    id: 'support-session-1',
    pilotId: context.pilotId,
    pilotEnrollmentId: context.pilotEnrollmentId,
    organizationId: context.organizationId,
    teamId: context.teamId,
    athleteId: context.athleteId,
    actorUserId: context.athleteId,
    actorRole: 'athlete',
    eventType: 'daily_assignment_completed',
    sourceCollection: 'pulsecheck-daily-assignments',
    sourceDocumentId: 'support-assignment-1',
    sourceDate: '2026-03-29',
    metricPayload: {},
    createdAt: NOW_MS - DAY_MS,
  });
  db.seedDoc('pulsecheck-pilot-metric-events', 'support-session-2', {
    id: 'support-session-2',
    pilotId: context.pilotId,
    pilotEnrollmentId: context.pilotEnrollmentId,
    organizationId: context.organizationId,
    teamId: context.teamId,
    athleteId: context.athleteId,
    actorUserId: context.athleteId,
    actorRole: 'athlete',
    eventType: 'daily_assignment_completed',
    sourceCollection: 'pulsecheck-daily-assignments',
    sourceDocumentId: 'support-assignment-2',
    sourceDate: '2026-03-30',
    metricPayload: {},
    createdAt: NOW_MS,
  });
  db.seedDoc('pulsecheck-pilot-metric-events', 'support-session-3', {
    id: 'support-session-3',
    pilotId: context.pilotId,
    pilotEnrollmentId: context.pilotEnrollmentId,
    organizationId: context.organizationId,
    teamId: context.teamId,
    athleteId: context.athleteId,
    actorUserId: context.athleteId,
    actorRole: 'athlete',
    eventType: 'daily_assignment_completed',
    sourceCollection: 'pulsecheck-daily-assignments',
    sourceDocumentId: 'support-assignment-3',
    sourceDate: '2026-03-30',
    metricPayload: {},
    createdAt: NOW_MS,
  });

  db.seedDoc('escalation-records', 'support-only-escalation', {
    id: 'support-only-escalation',
    userId: context.athleteId,
    conversationId: 'conversation-support',
    tier: 0,
    category: 'general',
    status: 'active',
    disposition: 'none',
    classificationFamily: 'performance_support',
    excludedFromHeadlineMetrics: true,
    createdAt: NOW_MS - 45 * 60 * 1000,
    triggerContent: 'I feel nervous about competing and want help regulating it.',
    classificationReason: 'Performance support only',
  });

  const promptState = await runWithNow(NOW_MS, () => getAthletePilotSurveyPromptState({
    db,
    athleteId: context.athleteId,
    preferredPilotEnrollmentId: context.pilotEnrollmentId,
    preferredPilotId: context.pilotId,
  }));

  assert.equal(promptState.suppressionReason, null);
  assert.equal(promptState.completedSessions, 3);
  assert.equal(promptState.endpointEligible, false);
  assert.equal(promptState.midpointEligible, true);
  assert.ok(promptState.pendingPrompts.some((prompt) => prompt.surveyKind === 'trust'));
  assert.ok(promptState.pendingPrompts.some((prompt) => prompt.surveyKind === 'nps'));
});

test('getAthletePilotSurveyPromptState honors historical completed assignments inside the pilot window', async () => {
  const { getAthletePilotSurveyPromptState } = loadPulsecheckMetrics();
  const { db } = createPulsecheckFirestore();
  const context = seedBasePilotContext(db, {
    pilotStartAt: NOW_MS - 10 * DAY_MS,
    pilotEndAt: NOW_MS + 10 * DAY_MS,
    enrollmentCreatedAt: NOW_MS - DAY_MS,
    enrollmentUpdatedAt: NOW_MS - DAY_MS,
  });

  for (let index = 0; index < 7; index += 1) {
    const sourceDate = new Date(NOW_MS - (index * DAY_MS)).toISOString().slice(0, 10);
    const createdAt = NOW_MS - (index * DAY_MS);
    db.seedDoc('pulsecheck-daily-assignments', `${context.athleteId}_historical_${sourceDate}`, {
      id: `${context.athleteId}_historical_${sourceDate}`,
      athleteId: context.athleteId,
      teamId: context.teamId,
      teamMembershipId: context.teamMembershipId,
      sourceDate,
      status: 'completed',
      actionType: 'sim',
      createdAt,
      updatedAt: createdAt + 30 * 60 * 1000,
    });
  }

  const promptState = await runWithNow(NOW_MS, () => getAthletePilotSurveyPromptState({
    db,
    athleteId: context.athleteId,
    preferredPilotEnrollmentId: context.pilotEnrollmentId,
    preferredPilotId: context.pilotId,
  }));

  assert.equal(promptState.suppressionReason, null);
  assert.equal(promptState.completedSessions, 7);
  assert.ok(promptState.pendingPrompts.some((prompt) => (
    prompt.surveyKind === 'trust' && prompt.promptStage === 'initial'
  )));
});

test('recomputePilotMetricRollups reads emitted events back into the rollup summary', async () => {
  const { emitPilotMetricEvent, recomputePilotMetricRollups } = loadPulsecheckMetrics();
  const { db } = createPulsecheckFirestore();
  const context = seedBasePilotContext(db, {
    pilotStartAt: NOW_MS,
    pilotEndAt: NOW_MS + DAY_MS,
    enrollmentCreatedAt: NOW_MS,
    enrollmentUpdatedAt: NOW_MS,
  });

  db.seedDoc('athlete-mental-progress', context.athleteId, {
    taxonomyProfile: {
      overallScore: 64,
      pillarScores: { focus: 66, composure: 63, decision: 62 },
      skillScores: {},
      modifierScores: {},
      strongestSkills: [],
      weakestSkills: [],
      trendSummary: [],
      updatedAt: NOW_MS,
    },
    lastProfileSyncAt: NOW_MS,
    updatedAt: NOW_MS,
  });
  db.seedDoc(`pulsecheck-pilot-enrollments/${context.pilotEnrollmentId}/mental-performance-snapshots`, 'current_latest_valid', {
    id: 'current_latest_valid',
    pilotEnrollmentId: context.pilotEnrollmentId,
    pilotId: context.pilotId,
    organizationId: context.organizationId,
    teamId: context.teamId,
    athleteId: context.athleteId,
    snapshotType: 'current_latest_valid',
    status: 'valid',
    capturedAt: NOW_MS,
    computedAt: NOW_MS,
    sourceProfileVersion: 'taxonomy-v1',
    sourceWriterVersion: 'profile-snapshot-writer-v1',
    taxonomyProfile: {
      overallScore: 64,
      pillarScores: { focus: 66, composure: 63, decision: 62 },
      skillScores: {},
      modifierScores: {},
      strongestSkills: [],
      weakestSkills: [],
      trendSummary: [],
      updatedAt: NOW_MS,
    },
    pillarCompositeScore: 63.7,
    targetDeltaFromBaseline: { focus: 12, composure: 11, decision: 9, pillarComposite: 11 },
    validity: {
      hasBaselineAssessment: true,
      hasRecentProfile: true,
      excludedFromHeadlineDelta: false,
      exclusionReason: null,
    },
    endpointFreeze: {
      frozen: false,
      frozenAt: null,
      freezeReason: null,
    },
  });

  await runWithNow(NOW_MS, async () => {
    await emitPilotMetricEvent({
      db,
      pilotContext: context,
      eventType: 'daily_checkin_completed',
      actorRole: 'athlete',
      actorUserId: context.athleteId,
      athleteId: context.athleteId,
      sourceCollection: 'state-snapshots',
      sourceDocumentId: 'snapshot-1',
      sourceDate: '2026-03-30',
      metricPayload: { readinessScore: 7 },
      createdAt: NOW_MS,
    });

    await emitPilotMetricEvent({
      db,
      pilotContext: context,
      eventType: 'daily_checkin_completed',
      actorRole: 'athlete',
      actorUserId: context.athleteId,
      athleteId: context.athleteId,
      sourceCollection: 'state-snapshots',
      sourceDocumentId: 'snapshot-1',
      sourceDate: '2026-03-30',
      metricPayload: { readinessScore: 7 },
      createdAt: NOW_MS,
    });

    await emitPilotMetricEvent({
      db,
      pilotContext: context,
      eventType: 'daily_assignment_completed',
      actorRole: 'athlete',
      actorUserId: context.athleteId,
      athleteId: context.athleteId,
      sourceCollection: 'pulsecheck-daily-assignments',
      sourceDocumentId: 'assignment-1',
      sourceDate: '2026-03-30',
      metricPayload: { actionType: 'sim' },
      createdAt: NOW_MS,
    });

    await emitPilotMetricEvent({
      db,
      pilotContext: context,
      eventType: 'daily_assignment_completed',
      actorRole: 'athlete',
      actorUserId: context.athleteId,
      athleteId: context.athleteId,
      sourceCollection: 'pulsecheck-daily-assignments',
      sourceDocumentId: 'assignment-1',
      sourceDate: '2026-03-30',
      metricPayload: { actionType: 'sim' },
      createdAt: NOW_MS,
    });
  });

  const first = await runWithNow(NOW_MS, () => recomputePilotMetricRollups({
    db,
    pilotId: context.pilotId,
    explicitDateKeys: ['2026-03-30'],
  }));
  const second = await runWithNow(NOW_MS, () => recomputePilotMetricRollups({
    db,
    pilotId: context.pilotId,
    explicitDateKeys: ['2026-03-30'],
  }));

  assert.equal(first.current.metrics.adherenceRate, 100);
  assert.equal(first.current.metrics.dailyCheckInRate, 100);
  assert.equal(first.current.metrics.assignmentCompletionRate, 100);
  assert.equal(first.current.metrics.mentalPerformanceDelta, 11);
  assert.equal(second.current.metrics.mentalPerformanceDelta, 11);
  assert.equal(db.getCollectionDocs('pulsecheck-pilot-metric-events').length, 2);
  assert.equal(db.getCollectionDocs(`pulsecheck-pilot-metric-rollups/${context.pilotId}/summary`).length, 3);
  assert.equal(db.getCollectionDocs(`pulsecheck-pilot-metric-rollups/${context.pilotId}/daily`).length, 1);
});

test('backfillPilotAthleteOutcomeHistory seeds the last 14 days of late-added athlete activity into pilot scope and stays replay-safe', async () => {
  const { backfillPilotAthleteOutcomeHistory } = loadPulsecheckMetrics();
  const { db } = createPulsecheckFirestore();
  const context = seedBasePilotContext(db, {
    enrollmentCreatedAt: NOW_MS,
    enrollmentUpdatedAt: NOW_MS,
    pilotStartAt: NOW_MS + DAY_MS,
  });

  for (let index = 0; index < 16; index += 1) {
    const sourceDate = new Date(NOW_MS - (index * DAY_MS)).toISOString().slice(0, 10);
    const createdAt = NOW_MS - (index * DAY_MS);
    db.seedDoc(`mental-check-ins/${context.athleteId}/check-ins`, `checkin-${sourceDate}`, {
      id: `checkin-${sourceDate}`,
      userId: context.athleteId,
      readinessScore: 7,
      createdAt,
      date: sourceDate,
    });
    db.seedDoc('pulsecheck-daily-assignments', `${context.athleteId}_${sourceDate}`, {
      id: `${context.athleteId}_${sourceDate}`,
      athleteId: context.athleteId,
      teamId: context.teamId,
      teamMembershipId: context.teamMembershipId,
      sourceDate,
      status: 'completed',
      actionType: 'sim',
      createdAt,
      updatedAt: createdAt + 60 * 60 * 1000,
    });
  }

  const first = await runWithNow(NOW_MS, () => backfillPilotAthleteOutcomeHistory({
    db,
    athleteId: context.athleteId,
    preferredPilotEnrollmentId: context.pilotEnrollmentId,
    preferredPilotId: context.pilotId,
    preferredTeamMembershipId: context.teamMembershipId,
    lookbackDays: 14,
    actorRole: 'admin',
    actorUserId: 'admin-1',
    source: 'test_seed',
    recompute: true,
  }));

  assert.equal(first.backfilledCheckInCount, 14);
  assert.equal(first.backfilledAssignmentCount, 14);
  assert.equal(first.explicitDateKeys.length, 14);

  const enrollmentDoc = db.getDoc('pulsecheck-pilot-enrollments', context.pilotEnrollmentId);
  assert.equal(enrollmentDoc.outcomeBackfillLookbackDays, 15);
  assert.equal(enrollmentDoc.outcomeBackfillStartAtMs, Date.parse(first.startDateKey + 'T00:00:00.000Z'));

  const stampedAssignment = db.getDoc('pulsecheck-daily-assignments', `${context.athleteId}_${first.startDateKey}`);
  assert.equal(stampedAssignment.pilotId, context.pilotId);
  assert.equal(stampedAssignment.pilotEnrollmentId, context.pilotEnrollmentId);

  const currentRollup = db.getDoc(`pulsecheck-pilot-metric-rollups/${context.pilotId}/summary`, 'current');
  assert.ok(currentRollup);
  assert.equal(currentRollup.diagnostics.adherence.expectedAthleteDays, 14);
  assert.equal(currentRollup.metrics.dailyCheckInRate, 100);
  assert.equal(currentRollup.metrics.assignmentCompletionRate, 100);
  assert.equal(currentRollup.metrics.adherenceRate, 100);

  const eventCountAfterFirstRun = db.getCollectionDocs('pulsecheck-pilot-metric-events').length;
  const second = await runWithNow(NOW_MS, () => backfillPilotAthleteOutcomeHistory({
    db,
    athleteId: context.athleteId,
    preferredPilotEnrollmentId: context.pilotEnrollmentId,
    preferredPilotId: context.pilotId,
    preferredTeamMembershipId: context.teamMembershipId,
    lookbackDays: 14,
    actorRole: 'admin',
    actorUserId: 'admin-1',
    source: 'test_seed',
    recompute: true,
  }));

  assert.equal(second.explicitDateKeys.length, 14);
  assert.equal(db.getCollectionDocs('pulsecheck-pilot-metric-events').length, eventCountAfterFirstRun);
  assert.equal(db.getCollectionDocs(`pulsecheck-pilot-metric-rollups/${context.pilotId}/daily`).length, 14);
});
