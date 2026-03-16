const test = require('node:test');
const assert = require('node:assert/strict');

const firebaseConfigPath = require.resolve('../config/firebase');
require.cache[firebaseConfigPath] = {
  id: firebaseConfigPath,
  filename: firebaseConfigPath,
  loaded: true,
  exports: {
    initializeFirebaseAdmin: () => ({
      firestore: () => ({}),
    }),
  },
};

const {
  BASELINE_RECENCY_WINDOW_DAYS,
  EVENT_LOG_SCHEMA_VERSION,
  REQUIRED_EVENT_TYPES,
  buildResultSummary,
  buildTransferGapSummaryFromSources,
  buildVisionProProtocolIssues,
  buildVisionProReportSummary,
  normalizeEventLogReference,
  normalizeValiditySummary,
  normalizeVersionMetadata,
  sanitizeSession,
} = require('../vision-pro-trials-utils');

test('normalizeVersionMetadata preserves the spec version trail shape', () => {
  const metadata = normalizeVersionMetadata({
    environmentVersion: 'football-stadium-v1',
    trialPackageVersion: 'football-package-v1',
    resetTrialVersion: 'reset-next-play-v1',
    noiseGateTrialVersion: 'noise-gate-v1',
    signalWindowTrialVersion: 'signal-window-v1',
    eventScriptVersion: 'event-script-v1',
    metricMappingVersion: 'metric-map-v1',
    seedOrScriptId: 'script-seed-001',
  });

  assert.deepEqual(metadata, {
    environmentVersion: 'football-stadium-v1',
    trialPackageVersion: 'football-package-v1',
    resetTrialVersion: 'reset-next-play-v1',
    noiseGateTrialVersion: 'noise-gate-v1',
    signalWindowTrialVersion: 'signal-window-v1',
    eventScriptVersion: 'event-script-v1',
    metricMappingVersion: 'metric-map-v1',
    seedOrScriptId: 'script-seed-001',
  });
});

test('normalizeEventLogReference defaults to the spec schema version and required event types', () => {
  const eventLog = normalizeEventLogReference({});

  assert.equal(eventLog.schemaVersion, EVENT_LOG_SCHEMA_VERSION);
  assert.deepEqual(eventLog.requiredEventTypes, REQUIRED_EVENT_TYPES);
  assert.equal(eventLog.rawEventLogUri, null);
});

test('buildResultSummary falls back to familyMetricSummary when top-level metrics are absent', () => {
  const summary = buildResultSummary({
    durationSeconds: 412,
    familyMetricSummary: [
      {
        family: 'reset',
        coreMetricName: 'Recovery Time',
        coreMetricValue: 1.82,
        normalizedScore: 73,
      },
    ],
  });

  assert.equal(summary.coreMetricName, 'Recovery Time');
  assert.equal(summary.coreMetricValue, 1.82);
  assert.equal(summary.normalizedScore, 73);
  assert.equal(summary.durationSeconds, 412);
});

test('sanitizeSession exposes the locked Vision Pro schema shape', () => {
  const session = sanitizeSession('session_123', {
    assignmentId: 'assignment_123',
    assignmentCollection: 'sim-assignments',
    athleteUserId: 'athlete_123',
    simId: 'vision_pro_football_package',
    simName: 'Vision Pro Football Package',
    status: 'completed',
    versionMetadata: {
      environmentVersion: 'football-stadium-v1',
      trialPackageVersion: 'football-package-v1',
    },
    validitySummary: {
      status: 'valid',
      flags: ['valid:yes'],
      eventLogComplete: true,
    },
    transferGapSummary: [
      {
        family: 'reset',
        trialName: 'Next Play',
        transferGap: 0.24,
      },
    ],
    reportSummary: {
      athleteHeadline: 'Small transfer gap.',
      coachHeadline: 'Transfer looks stable.',
      transferReadiness: 'strong_transfer',
      familyCards: [
        {
          family: 'reset',
          trialName: 'Next Play',
          interpretation: 'small_gap',
        },
      ],
    },
    operatorReconciliation: {
      status: 'reviewed',
      reviewedAt: 1742054400000,
      reviewedByName: 'Ops Lead',
      note: 'Version trail and event log verified.',
      checklist: {
        versionTrailVerified: true,
        calibrationVerified: true,
        baselineLinkageVerified: true,
        validityVerified: true,
        eventLogVerified: true,
        incidentDispositionVerified: true,
      },
    },
  });

  assert.equal(session.id, 'session_123');
  assert.equal(session.versionMetadata.environmentVersion, 'football-stadium-v1');
  assert.equal(session.validitySummary.status, 'valid');
  assert.equal(session.transferGapSummary[0].family, 'reset');
  assert.equal(session.reportSummary.transferReadiness, 'strong_transfer');
  assert.deepEqual(session.eventLog.requiredEventTypes, REQUIRED_EVENT_TYPES);
  assert.equal(session.operatorReconciliation?.status, 'reviewed');
  assert.equal(session.operatorReconciliation?.checklist?.eventLogVerified, true);
});

test('normalizeValiditySummary only accepts known protocol statuses', () => {
  const summary = normalizeValiditySummary({
    status: 'partial',
    flags: ['valid:dropout'],
    abortClassification: 'aborted_mid_signal_window_trial',
  });

  assert.equal(summary.status, 'partial');
  assert.deepEqual(summary.flags, ['valid:dropout']);
  assert.equal(summary.abortClassification, 'aborted_mid_signal_window_trial');
});

test('buildTransferGapSummaryFromSources compares family metrics against baseline sources', () => {
  const summary = buildTransferGapSummaryFromSources(
    [
      {
        family: 'reset',
        trialName: 'Next Play',
        coreMetricName: 'Recovery Time',
        coreMetricValue: 1.82,
      },
      {
        family: 'signal-window',
        trialName: 'Spatial Read',
        coreMetricName: 'Correct Read Under Time Pressure',
        coreMetricValue: 0.74,
      },
    ],
    [
      {
        family: 'reset',
        surface: 'phone_web',
        referenceId: 'baseline_reset_1',
        isImmersiveBaseline: false,
      },
      {
        family: 'signal-window',
        surface: 'phone_web',
        referenceId: 'baseline_signal_1',
        isImmersiveBaseline: false,
      },
    ],
    new Map([
      ['reset:phone_web', 1.54],
      ['signal-window:phone_web', 0.89],
    ])
  );

  assert.equal(summary.length, 2);
  assert.equal(summary[0].transferGap, 0.28);
  assert.equal(summary[0].interpretation, 'small_gap');
  assert.equal(summary[1].transferGap, -0.15);
  assert.equal(summary[1].interpretation, 'moderate_gap');
});

test('buildVisionProReportSummary translates transfer gaps into athlete and coach summaries', () => {
  const summary = buildVisionProReportSummary({
    familyMetricSummary: [
      {
        family: 'reset',
        trialName: 'Next Play',
        coreMetricName: 'Recovery Time',
        coreMetricValue: 1.82,
      },
    ],
    transferGapSummary: [
      {
        family: 'reset',
        trialName: 'Next Play',
        comparisonSurface: 'phone_web',
        metricName: 'Recovery Time',
        currentValue: 1.82,
        baselineValue: 1.54,
        transferGap: 0.28,
        interpretation: 'small_gap',
        isImmersiveComparison: false,
      },
    ],
    isImmersiveBaseline: true,
  });

  assert.equal(summary.transferReadiness, 'strong_transfer');
  assert.equal(summary.immersiveBaselineMode, 'captured');
  assert.equal(summary.familyCards[0].family, 'reset');
  assert.match(summary.coachBody, /immersive baseline/i);
});

test('buildVisionProProtocolIssues blocks stale family baselines using the 14-day window', () => {
  const issues = buildVisionProProtocolIssues({
    trackedFamilies: [{ family: 'reset' }],
    baselineReferences: [
      {
        family: 'reset',
        withinRecencyWindow: false,
      },
    ],
    protocolContext: {
      membership: { id: 'membership_1' },
      onboarding: {
        productConsentAccepted: true,
        baselinePathStatus: 'complete',
      },
      enrollmentMode: 'product-only',
    },
  });

  assert.match(issues.join(' '), new RegExp(`${BASELINE_RECENCY_WINDOW_DAYS} days`));
});

test('buildVisionProProtocolIssues blocks athletes on an active escalation hold', () => {
  const issues = buildVisionProProtocolIssues({
    trackedFamilies: [{ family: 'reset' }],
    baselineReferences: [
      {
        family: 'reset',
        withinRecencyWindow: true,
      },
    ],
    protocolContext: {
      membership: { id: 'membership_1' },
      onboarding: {
        productConsentAccepted: true,
        baselinePathStatus: 'complete',
      },
      enrollmentMode: 'product-only',
      activeEscalation: {
        id: 'escalation_1',
        tier: 2,
      },
    },
  });

  assert.match(issues.join(' '), /Tier 2 escalation hold/i);
});

test('buildVisionProProtocolIssues requires a valid cohort record when cohort enrollment is targeted', () => {
  const issues = buildVisionProProtocolIssues({
    trackedFamilies: [{ family: 'reset' }],
    baselineReferences: [
      {
        family: 'reset',
        withinRecencyWindow: true,
      },
    ],
    protocolContext: {
      membership: { id: 'membership_1' },
      onboarding: {
        productConsentAccepted: true,
        baselinePathStatus: 'complete',
        targetCohortId: 'cohort_missing',
        researchConsentStatus: 'accepted',
      },
      enrollmentMode: 'research',
      pilot: { id: 'pilot_1' },
      pilotStatus: 'active',
      cohort: null,
    },
  });

  assert.match(issues.join(' '), /cohort record could not be found/i);
});

test('buildVisionProProtocolIssues requires operator comfort clearance before start', () => {
  const issues = buildVisionProProtocolIssues({
    trackedFamilies: [{ family: 'reset' }],
    baselineReferences: [
      {
        family: 'reset',
        withinRecencyWindow: true,
      },
    ],
    protocolContext: {
      membership: { id: 'membership_1' },
      onboarding: {
        productConsentAccepted: true,
        baselinePathStatus: 'complete',
      },
      enrollmentMode: 'product-only',
    },
    comfortCleared: false,
    requireComfortScreen: true,
  });

  assert.match(issues.join(' '), /comfort check must be completed/i);
});
