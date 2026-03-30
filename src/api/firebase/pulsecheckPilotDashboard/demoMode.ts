import type {
  PilotDashboardAthleteDetail,
  PilotDashboardAthleteSummary,
  PilotDashboardCohortSummary,
  PilotDashboardCoverageMetrics,
  PilotDashboardDetail,
  PilotDashboardDirectoryEntry,
  PilotDashboardEngineSummary,
  PilotDashboardHypothesisSummary,
  PilotDashboardMetrics,
  PilotDashboardRecentEvidence,
  PilotDashboardRecentPattern,
  PilotDashboardRecentProjection,
  PilotDashboardSnapshotHistoryItem,
  PilotResearchReadout,
  PilotResearchReadoutGenerationInput,
  PilotResearchReadoutReviewInput,
  PilotResearchReadoutSection,
  PulseCheckPilotHypothesis,
  PulseCheckPilotHypothesisInput,
  PulseCheckPilotInviteConfig,
  PulseCheckPilotInviteConfigInput,
  PulseCheckPilotInviteDefaultConfig,
  PulseCheckPilotInviteDefaultConfigInput,
} from './types';
import type {
  PulseCheckInviteLink,
  PulseCheckOrganization,
  PulseCheckPilot,
  PulseCheckPilotCohort,
  PulseCheckPilotEnrollment,
  PulseCheckTeam,
  PulseCheckTeamMembership,
} from '../pulsecheckProvisioning/types';

const DEMO_MODE_KEY = 'pulsecheckPilotDashboardDemoMode';
const DEMO_STORE_KEY = 'pulsecheckPilotDashboardDemoStore';
const DEMO_PILOT_ID = 'demo-pilot-correlation-2026';
const DEMO_ORGANIZATION_ID = 'demo-org-pulsecheck-labs';
const DEMO_TEAM_ID = 'demo-team-quicklifts-performance';

interface PilotDashboardDemoStore {
  organization: PulseCheckOrganization;
  team: PulseCheckTeam;
  pilot: PulseCheckPilot;
  cohorts: PulseCheckPilotCohort[];
  athletes: Array<{
    summary: PilotDashboardAthleteSummary;
    athleteDetail: PilotDashboardAthleteDetail;
  }>;
  hypotheses: PulseCheckPilotHypothesis[];
  inviteConfig: PulseCheckPilotInviteConfig;
  hasPilotInviteConfigOverride: boolean;
  teamInviteConfigDefault: PulseCheckPilotInviteDefaultConfig | null;
  organizationInviteConfigDefault: PulseCheckPilotInviteDefaultConfig | null;
  researchReadouts: PilotResearchReadout[];
  inviteLinks: PulseCheckInviteLink[];
}

const normalizeString = (value?: string | null) => value?.trim() || '';
const toPercentage = (numerator: number, denominator: number) => (denominator > 0 ? Number(((numerator / denominator) * 100).toFixed(1)) : 0);
const toAverage = (total: number, count: number) => (count > 0 ? Number((total / count).toFixed(1)) : 0);
const asTimestamp = (value: number | null | undefined) => value as any;

function canUseStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function buildEngineSummary(input: {
  evidenceRecordCount: number;
  patternModelCount: number;
  stablePatternCount: number;
  highConfidencePatternCount: number;
  degradedPatternCount: number;
  recommendationProjectionCount: number;
  recommendationProjectionCountsByConsumer?: Record<string, number>;
  lastEngineRefreshAt: number;
  activePatternKeys?: string[];
  activeProjectionKeys?: string[];
}): PilotDashboardEngineSummary {
  return {
    hasEngineRecord: input.evidenceRecordCount > 0 || input.patternModelCount > 0 || input.recommendationProjectionCount > 0,
    engineVersion: 'demo-engine-v1',
    lastEvidenceAt: input.lastEngineRefreshAt,
    lastPatternRefreshAt: input.lastEngineRefreshAt,
    lastProjectionRefreshAt: input.lastEngineRefreshAt,
    lastEngineRefreshAt: input.lastEngineRefreshAt,
    activePatternKeys: input.activePatternKeys || [],
    activeProjectionKeys: input.activeProjectionKeys || [],
    evidenceRecordCount: input.evidenceRecordCount,
    patternModelCount: input.patternModelCount,
    stablePatternCount: input.stablePatternCount,
    highConfidencePatternCount: input.highConfidencePatternCount,
    degradedPatternCount: input.degradedPatternCount,
    recommendationProjectionCount: input.recommendationProjectionCount,
    recommendationProjectionCountsByConsumer: input.recommendationProjectionCountsByConsumer || {},
  };
}

function buildHypothesisSummary(hypotheses: PulseCheckPilotHypothesis[]): PilotDashboardHypothesisSummary {
  return {
    notEnoughDataCount: hypotheses.filter((hypothesis) => hypothesis.status === 'not-enough-data').length,
    promisingCount: hypotheses.filter((hypothesis) => hypothesis.status === 'promising').length,
    mixedCount: hypotheses.filter((hypothesis) => hypothesis.status === 'mixed').length,
    notSupportedCount: hypotheses.filter((hypothesis) => hypothesis.status === 'not-supported').length,
    highConfidenceCount: hypotheses.filter((hypothesis) => hypothesis.confidenceLevel === 'high').length,
  };
}

function buildMetrics(athletes: PilotDashboardAthleteSummary[], cohorts: PulseCheckPilotCohort[], hypotheses: PulseCheckPilotHypothesis[]): PilotDashboardMetrics {
  const totalEvidenceRecords = athletes.reduce((sum, athlete) => sum + athlete.engineSummary.evidenceRecordCount, 0);
  const totalPatternModels = athletes.reduce((sum, athlete) => sum + athlete.engineSummary.patternModelCount, 0);
  const totalRecommendationProjections = athletes.reduce((sum, athlete) => sum + athlete.engineSummary.recommendationProjectionCount, 0);
  const athletesWithEngineRecord = athletes.filter((athlete) => athlete.engineSummary.hasEngineRecord).length;
  const athletesWithStablePatterns = athletes.filter((athlete) => athlete.engineSummary.stablePatternCount > 0).length;

  return {
    totalEnrollmentCount: athletes.length,
    activeAthleteCount: athletes.length,
    cohortCount: cohorts.length,
    athletesWithEngineRecord,
    athletesWithStablePatterns,
    totalEvidenceRecords,
    totalPatternModels,
    totalRecommendationProjections,
    unsupportedHypotheses: hypotheses.filter((hypothesis) => hypothesis.status === 'not-supported').length,
    hypothesisCount: hypotheses.length,
  };
}

function buildCoverage(metrics: PilotDashboardMetrics): PilotDashboardCoverageMetrics {
  return {
    engineCoverageRate: toPercentage(metrics.athletesWithEngineRecord, metrics.activeAthleteCount),
    stablePatternRate: toPercentage(metrics.athletesWithStablePatterns, metrics.activeAthleteCount),
    avgEvidenceRecordsPerActiveAthlete: toAverage(metrics.totalEvidenceRecords, metrics.activeAthleteCount),
    avgPatternModelsPerActiveAthlete: toAverage(metrics.totalPatternModels, metrics.activeAthleteCount),
    avgRecommendationProjectionsPerActiveAthlete: toAverage(metrics.totalRecommendationProjections, metrics.activeAthleteCount),
  };
}

function buildCohortSummaries(cohorts: PulseCheckPilotCohort[], athletes: PilotDashboardAthleteSummary[]): PilotDashboardCohortSummary[] {
  return cohorts.map((cohort) => {
    const cohortAthletes = athletes.filter((athlete) => athlete.pilotEnrollment.cohortId === cohort.id);
    return {
      cohortId: cohort.id,
      cohortName: cohort.name,
      cohortStatus: cohort.status,
      activeAthleteCount: cohortAthletes.length,
      athletesWithEngineRecord: cohortAthletes.filter((athlete) => athlete.engineSummary.hasEngineRecord).length,
      athletesWithStablePatterns: cohortAthletes.filter((athlete) => athlete.engineSummary.stablePatternCount > 0).length,
      totalEvidenceRecords: cohortAthletes.reduce((sum, athlete) => sum + athlete.engineSummary.evidenceRecordCount, 0),
      totalPatternModels: cohortAthletes.reduce((sum, athlete) => sum + athlete.engineSummary.patternModelCount, 0),
      totalRecommendationProjections: cohortAthletes.reduce((sum, athlete) => sum + athlete.engineSummary.recommendationProjectionCount, 0),
    };
  });
}

function buildInviteConfig(now: number): PulseCheckPilotInviteConfig {
  return {
    id: DEMO_PILOT_ID,
    pilotId: DEMO_PILOT_ID,
    organizationId: DEMO_ORGANIZATION_ID,
    teamId: DEMO_TEAM_ID,
    welcomeHeadline: 'Welcome to the Correlation Engine Pilot Demo',
    welcomeBody:
      'This demo athlete invite flow shows the exact onboarding guidance an admin would configure for a live pilot, but it stays fully inside a safe mock environment.',
    existingAthleteInstructions:
      'Open PulseCheck on your phone.\nSign in with your existing account.\nConfirm the demo team and pilot appear, then review the pilot-specific next steps.',
    newAthleteInstructions:
      'Download the PulseCheck app.\nCreate an account with the invited email.\nComplete consent, onboarding, and the baseline path before entering the demo pilot.',
    wearableRequirements:
      'For the demo we show Oura and Apple Health as the preferred sources, with a manual fallback path for athletes who are not yet connected.',
    baselineExpectations:
      'Athletes should finish baseline setup within 48 hours so the pilot can start collecting usable evidence and body-state context.',
    supportName: 'PulseCheck Demo Ops',
    supportEmail: 'demo-ops@pulsecheck.test',
    supportPhone: '555-0106',
    iosAppUrl: 'https://apps.apple.com/ca/app/pulse-community-workouts/id6451497729',
    androidAppUrl: 'https://play.google.com/store/apps/details?id=ai.fitwithpulse.pulse',
    createdAt: asTimestamp(now),
    updatedAt: asTimestamp(now),
  } as PulseCheckPilotInviteConfig;
}

function buildResearchReadoutSectionSet(now: number): PilotResearchReadoutSection[] {
  return [
    {
      sectionKey: 'pilot-summary',
      title: 'Pilot Summary',
      readinessStatus: 'ready',
      summary:
        'This demo frame suggests the pilot is learning meaningful structure for part of the enrolled population, with stronger signal in the starters cohort and weaker coverage in the emerging cohort. The safe interpretation is that the pilot is operationally healthy enough for review, but not yet broad enough for stronger generalized claims.',
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
          statement: 'Six active pilot athletes are included in the current demo evidence frame.',
          denominatorLabel: 'active pilot athletes',
          denominatorValue: 6,
          evidenceSources: ['pilot overview metrics', 'pilot enrollment scope'],
          confidenceLevel: 'high',
          baselineMode: 'no-baseline',
          caveatFlag: false,
        },
      ],
      suggestedReviewerResolution: 'accepted',
      reviewerResolution: 'accepted',
      reviewerNotes: 'Good opening posture for a live demo.',
    },
    {
      sectionKey: 'hypothesis-mapper',
      title: 'Hypothesis Mapper',
      readinessStatus: 'ready',
      summary:
        'H1 and H2 look directionally promising in the demo frame, while H3 remains mixed because the pilot is learning unevenly across cohorts. H4 should stay in not-enough-data posture until downstream validation and milestone interpretation joins are richer.',
      citations: [
        {
          blockKey: 'hypothesis-governance',
          blockLabel: 'Pilot Hypotheses',
          hypothesisCodes: ['H1', 'H2', 'H3', 'H4'],
          limitationKeys: ['freshness-telemetry', 'cohort-imbalance'],
        },
      ],
      claims: [
        {
          claimKey: 'promising-hypotheses',
          claimType: 'observed',
          statement: 'Two of four active hypotheses are currently in a promising posture in the demo dashboard state.',
          denominatorLabel: 'pilot hypotheses',
          denominatorValue: 4,
          evidenceSources: ['manual hypothesis records'],
          confidenceLevel: 'medium',
          baselineMode: 'no-baseline',
          caveatFlag: true,
        },
      ],
      suggestedReviewerResolution: 'accepted',
      reviewerResolution: 'accepted',
    },
    {
      sectionKey: 'findings-interpreter',
      title: 'Findings Interpreter',
      readinessStatus: 'ready',
      summary:
        'The strongest V1 interpretation is that the pilot is already learning enough to justify pilot-scoped body-state review, especially for athletes with complete wearable coverage. The weaker point is breadth: signal quality is still concentrated in the better-instrumented cohort and should not be described as whole-pilot certainty.',
      citations: [
        {
          blockKey: 'findings-layer',
          blockLabel: 'Pilot Findings',
          hypothesisCodes: ['H1', 'H2'],
          limitationKeys: ['cohort-imbalance'],
        },
      ],
      claims: [
        {
          claimKey: 'stable-pattern-rate',
          claimType: 'observed',
          statement: 'Stable body-state patterns are currently visible in four of the six active pilot athletes.',
          denominatorLabel: 'active pilot athletes',
          denominatorValue: 6,
          evidenceSources: ['stable pattern coverage', 'pattern model counts'],
          confidenceLevel: 'medium',
          baselineMode: 'no-baseline',
          caveatFlag: true,
        },
      ],
      suggestedReviewerResolution: 'accepted',
    },
    {
      sectionKey: 'research-notes',
      title: 'Candidate Publishable Findings',
      readinessStatus: 'ready',
      summary:
        'A plausible publishable-finding candidate is that stable body-state learning may appear first in the most complete-wearable cohort before it becomes whole-pilot wide. That is worth discussion, but it still needs stronger replication and outcome validation before it should be described as a research finding.',
      citations: [
        {
          blockKey: 'research-notes',
          blockLabel: 'Research Notes',
          hypothesisCodes: ['H1', 'H2'],
          limitationKeys: ['cohort-imbalance', 'freshness-telemetry'],
        },
      ],
      claims: [
        {
          claimKey: 'candidate-finding',
          claimType: 'speculative',
          statement: 'Differences in data completeness across cohorts may shape when stable body-state patterns first become reviewable inside a pilot.',
          denominatorLabel: 'active cohorts',
          denominatorValue: 2,
          evidenceSources: ['cohort rollup', 'stable pattern rate'],
          confidenceLevel: 'low',
          baselineMode: 'cross-cohort',
          caveatFlag: true,
        },
      ],
      suggestedReviewerResolution: 'carry-forward',
      reviewerResolution: 'carry-forward',
      reviewerNotes: 'Great demo example of disciplined candidate language.',
    },
    {
      sectionKey: 'limitations',
      title: 'Limitations',
      readinessStatus: 'ready',
      summary:
        'This frame still has real limits: one cohort is better instrumented than the other, freshness telemetry is not fully materialized, and the current demo does not support stronger causal claims about recommendation efficacy.',
      citations: [
        {
          blockKey: 'limitations',
          blockLabel: 'Readiness Gates',
          hypothesisCodes: [],
          limitationKeys: ['cohort-imbalance', 'freshness-telemetry'],
        },
      ],
      claims: [],
      suggestedReviewerResolution: 'accepted',
      reviewerResolution: 'accepted',
    },
  ];
}

function buildBaseDemoStore(): PilotDashboardDemoStore {
  const now = Date.now();
  const oneHour = 1000 * 60 * 60;
  const oneDay = oneHour * 24;
  const organization = {
    id: DEMO_ORGANIZATION_ID,
    displayName: 'PulseCheck Demo Labs',
    legalName: 'PulseCheck Demo Labs',
    organizationType: 'performance-lab',
    status: 'active',
    implementationOwnerUserId: 'demo-admin-user',
    implementationOwnerEmail: 'demo-admin@pulsecheck.test',
    primaryCustomerAdminName: 'Demo Admin',
    primaryCustomerAdminEmail: 'demo-admin@pulsecheck.test',
    additionalAdminContacts: [{ name: 'Research Ops', email: 'research-ops@pulsecheck.test' }],
    defaultStudyPosture: 'pilot',
    defaultClinicianBridgeMode: 'optional',
    notes: 'Demo organization for pilot dashboard walkthroughs.',
    createdAt: asTimestamp(now - oneDay * 45),
    updatedAt: asTimestamp(now - oneHour),
  } as PulseCheckOrganization;
  const team = {
    id: DEMO_TEAM_ID,
    organizationId: organization.id,
    displayName: 'QuickLifts Performance Demo Team',
    teamType: 'basketball',
    sportOrProgram: 'Performance demo roster',
    defaultAdminName: 'Demo Admin',
    defaultAdminEmail: 'demo-admin@pulsecheck.test',
    status: 'active',
    defaultInvitePolicy: 'admin-staff-and-coaches',
    notes: 'Demo team used for pilot dashboard walkthroughs.',
    createdAt: asTimestamp(now - oneDay * 40),
    updatedAt: asTimestamp(now - oneHour),
  } as PulseCheckTeam;
  const pilot = {
    id: DEMO_PILOT_ID,
    organizationId: organization.id,
    teamId: team.id,
    name: 'Correlation Engine Spring Pilot Demo',
    objective: 'Demonstrate how pilot-scoped monitoring, hypothesis review, and research interpretation work together for an active correlation-engine pilot.',
    status: 'active',
    studyMode: 'pilot',
    ownerInternalUserId: 'demo-admin-user',
    ownerInternalEmail: 'demo-admin@pulsecheck.test',
    checkpointCadence: 'Weekly review',
    startAt: asTimestamp(now - oneDay * 21),
    endAt: asTimestamp(now + oneDay * 28),
    notes: 'Demo pilot used for walkthroughs and QA.',
    createdAt: asTimestamp(now - oneDay * 28),
    updatedAt: asTimestamp(now - oneHour),
  } as PulseCheckPilot;
  const cohorts = [
    {
      id: 'demo-cohort-starters',
      organizationId: organization.id,
      teamId: team.id,
      pilotId: pilot.id,
      name: 'Starters',
      cohortType: 'starting-group',
      assignmentRule: 'manual',
      reportingTags: ['high-load', 'travel-heavy'],
      status: 'active',
      notes: 'Higher wearable coverage cohort.',
      createdAt: asTimestamp(now - oneDay * 20),
      updatedAt: asTimestamp(now - oneHour),
    },
    {
      id: 'demo-cohort-emerging',
      organizationId: organization.id,
      teamId: team.id,
      pilotId: pilot.id,
      name: 'Emerging Rotation',
      cohortType: 'development-group',
      assignmentRule: 'manual',
      reportingTags: ['lighter-minutes'],
      status: 'active',
      notes: 'More uneven evidence maturity cohort.',
      createdAt: asTimestamp(now - oneDay * 20),
      updatedAt: asTimestamp(now - oneHour),
    },
  ] as PulseCheckPilotCohort[];

  const athleteProfiles = [
    {
      athleteId: 'demo-athlete-avery',
      displayName: 'Avery Brooks',
      email: 'avery@pulsecheck.test',
      cohortId: cohorts[0].id,
      evidenceCount: 14,
      patternCount: 5,
      stableCount: 2,
      highConfidenceCount: 1,
      degradedCount: 0,
      projections: 8,
      assessmentContextStatus: 'advantaged',
      recentEvidence: [
        {
          evidenceId: 'demo-evidence-sleep-1',
          athleteLocalDate: '2026-03-18',
          sourceFamily: 'oura',
          freshness: 'fresh',
          dataConfidence: 'high_confidence',
          alignmentType: 'same_day',
          sessionTimestamp: now - oneDay,
          skillDomain: 'decision_quality',
          pillarDomain: 'recovery',
          coreMetricName: 'sleep duration',
        },
      ] as unknown as PilotDashboardRecentEvidence[],
      recentPatterns: [
        {
          patternKey: 'demo-pattern-avery-sleep-floor',
          patternFamily: 'sleep_floor',
          targetDomain: 'sim_performance',
          confidenceTier: 'stable',
          confidenceScore: 0.83,
          freshnessTier: 'fresh',
          recommendationEligibility: 'eligible',
          athleteSummary: 'Avery tends to produce steadier sim outcomes when sleep stays above 7h 20m.',
          coachSummary: 'Sleep floor appears stable enough for coach-facing review.',
          observedRelationship: 'Higher sleep duration co-occurs with steadier decision quality.',
          lastValidatedAt: now - oneDay,
          updatedAt: now - oneHour * 3,
        },
      ] as unknown as PilotDashboardRecentPattern[],
      recentProjections: [
        {
          projectionKey: 'demo-projection-avery-coach',
          consumer: 'coach',
          projectionDate: '2026-03-20',
          generatedAt: now - oneHour * 2,
          warningLevel: 'watch',
          confidenceTier: 'stable',
          confidenceDisplay: 'Stable',
          summaryTitle: 'Steady day recommendation',
          summaryBody: 'Avery looks ready for a normal decision-load day if sleep remains in the current range.',
          sourceSummary: 'Driven by stable sleep-floor and HRV-window patterns.',
        },
      ] as unknown as PilotDashboardRecentProjection[],
      snapshotHistory: [
        {
          snapshotKey: 'demo-snapshot-avery-1',
          milestoneType: 'Weekly checkpoint',
          capturedAt: now - oneDay * 2,
          currentEmphasis: 'Protect sleep consistency during travel.',
          nextMilestone: 'Validate steady-day recommendation against next sim cycle.',
          trendSummary: 'Readiness and decision quality are trending positively when sleep is stable.',
          assessmentContextStatus: 'advantaged',
          athleteSafeSummary: 'Body-state context is supporting steady work.',
          coachDetailSummary: 'Best current signal is sleep-floor consistency.',
        },
      ] as PilotDashboardSnapshotHistoryItem[],
    },
    {
      athleteId: 'demo-athlete-jordan',
      displayName: 'Jordan Ellis',
      email: 'jordan@pulsecheck.test',
      cohortId: cohorts[0].id,
      evidenceCount: 11,
      patternCount: 4,
      stableCount: 1,
      highConfidenceCount: 1,
      degradedCount: 0,
      projections: 6,
      assessmentContextStatus: 'normal',
      recentEvidence: [
        {
          evidenceId: 'demo-evidence-jordan-hrv',
          athleteLocalDate: '2026-03-19',
          sourceFamily: 'oura',
          freshness: 'fresh',
          dataConfidence: 'stable',
          alignmentType: 'same_day',
          sessionTimestamp: now - oneHour * 30,
          skillDomain: 'focus_stability',
          pillarDomain: 'recovery',
          coreMetricName: 'hrv trend',
        },
      ],
      recentPatterns: [
        {
          patternKey: 'demo-pattern-jordan-hrv-window',
          patternFamily: 'hrv_window',
          targetDomain: 'focus_stability',
          confidenceTier: 'high_confidence',
          confidenceScore: 0.88,
          freshnessTier: 'fresh',
          recommendationEligibility: 'eligible',
          athleteSummary: 'Jordan holds focus more consistently when HRV stays above the current sweet spot.',
          coachSummary: 'HRV-linked focus window is strong enough for review.',
          observedRelationship: 'Higher HRV co-occurs with better focus stability.',
          lastValidatedAt: now - oneDay,
          updatedAt: now - oneHour * 5,
        },
      ],
      recentProjections: [
        {
          projectionKey: 'demo-projection-jordan-profile',
          consumer: 'profile',
          projectionDate: '2026-03-20',
          generatedAt: now - oneHour * 4,
          warningLevel: 'none',
          confidenceTier: 'high_confidence',
          confidenceDisplay: 'High confidence',
          summaryTitle: 'Focus window is open',
          summaryBody: 'Jordan is currently inside a more favorable HRV band for clean focus work.',
          sourceSummary: 'Based on repeated HRV-linked focus patterns.',
        },
      ],
      snapshotHistory: [
        {
          snapshotKey: 'demo-snapshot-jordan-1',
          milestoneType: 'Weekly checkpoint',
          capturedAt: now - oneDay * 3,
          currentEmphasis: 'Use higher-HRV windows for skill-demanding work.',
          nextMilestone: 'Watch whether lower-HRV days keep showing the same focus drop.',
          trendSummary: 'Focus stability remains favorable on recovered days.',
          assessmentContextStatus: 'normal',
        },
      ],
    },
    {
      athleteId: 'demo-athlete-morgan',
      displayName: 'Morgan Chen',
      email: 'morgan@pulsecheck.test',
      cohortId: cohorts[0].id,
      evidenceCount: 9,
      patternCount: 3,
      stableCount: 1,
      highConfidenceCount: 0,
      degradedCount: 1,
      projections: 4,
      assessmentContextStatus: 'compromised',
      recentEvidence: [],
      recentPatterns: [],
      recentProjections: [],
      snapshotHistory: [],
    },
    {
      athleteId: 'demo-athlete-riley',
      displayName: 'Riley Carter',
      email: 'riley@pulsecheck.test',
      cohortId: cohorts[1].id,
      evidenceCount: 6,
      patternCount: 2,
      stableCount: 1,
      highConfidenceCount: 0,
      degradedCount: 0,
      projections: 3,
      assessmentContextStatus: 'normal',
      recentEvidence: [],
      recentPatterns: [],
      recentProjections: [],
      snapshotHistory: [],
    },
    {
      athleteId: 'demo-athlete-kai',
      displayName: 'Kai Watson',
      email: 'kai@pulsecheck.test',
      cohortId: cohorts[1].id,
      evidenceCount: 3,
      patternCount: 1,
      stableCount: 0,
      highConfidenceCount: 0,
      degradedCount: 1,
      projections: 1,
      assessmentContextStatus: 'unknown',
      recentEvidence: [],
      recentPatterns: [],
      recentProjections: [],
      snapshotHistory: [],
    },
    {
      athleteId: 'demo-athlete-sam',
      displayName: 'Sam Patel',
      email: 'sam@pulsecheck.test',
      cohortId: cohorts[1].id,
      evidenceCount: 0,
      patternCount: 0,
      stableCount: 0,
      highConfidenceCount: 0,
      degradedCount: 0,
      projections: 0,
      assessmentContextStatus: 'unknown',
      recentEvidence: [],
      recentPatterns: [],
      recentProjections: [],
      snapshotHistory: [],
    },
  ] as Array<any>;

  const athletes = athleteProfiles.map((athlete, index) => {
    const enrollment = {
      id: `${pilot.id}_${athlete.athleteId}`,
      organizationId: organization.id,
      teamId: team.id,
      pilotId: pilot.id,
      cohortId: athlete.cohortId,
      userId: athlete.athleteId,
      teamMembershipId: `${team.id}_${athlete.athleteId}`,
      studyMode: 'pilot',
      enrollmentMode: 'pilot',
      status: 'active',
      productConsentAccepted: true,
      productConsentAcceptedAt: asTimestamp(now - oneDay * 15),
      productConsentVersion: 'demo-v1',
      researchConsentStatus: 'not-required',
      researchConsentVersion: '',
      researchConsentRespondedAt: null,
      eligibleForResearchDataset: false,
      createdAt: asTimestamp(now - oneDay * (18 - index)),
      updatedAt: asTimestamp(now - oneHour * (index + 1)),
    } as PulseCheckPilotEnrollment;
    const teamMembership = {
      id: enrollment.teamMembershipId,
      organizationId: organization.id,
      teamId: team.id,
      userId: athlete.athleteId,
      email: athlete.email,
      role: 'athlete',
      permissionSetId: 'pulsecheck-athlete-v1',
      rosterVisibilityScope: 'none',
      allowedAthleteIds: [],
      athleteOnboarding: {
        productConsentAccepted: true,
        productConsentAcceptedAt: asTimestamp(now - oneDay * 15),
        productConsentVersion: 'demo-v1',
        entryOnboardingStep: 'complete',
        entryOnboardingName: athlete.displayName,
        researchConsentStatus: 'not-required',
        eligibleForResearchDataset: false,
        enrollmentMode: 'pilot',
        targetPilotId: pilot.id,
        targetPilotName: pilot.name,
        targetCohortId: athlete.cohortId,
        targetCohortName: cohorts.find((cohort) => cohort.id === athlete.cohortId)?.name || '',
        baselinePathStatus: 'complete',
        baselinePathwayId: 'pulsecheck-core-baseline-v1',
      },
      onboardingStatus: 'complete',
      postActivationCompletedAt: asTimestamp(now - oneDay * 14),
      grantedAt: asTimestamp(now - oneDay * 16),
      createdAt: asTimestamp(now - oneDay * 16),
      updatedAt: asTimestamp(now - oneHour),
    } as PulseCheckTeamMembership;
    const recommendationProjectionCountsByConsumer = athlete.recentProjections.reduce(
      (accumulator: Record<string, number>, projection: PilotDashboardRecentProjection) => {
        accumulator[projection.consumer] = (accumulator[projection.consumer] || 0) + 1;
        return accumulator;
      },
      {}
    );
    const engineSummary = buildEngineSummary({
      evidenceRecordCount: athlete.evidenceCount,
      patternModelCount: athlete.patternCount,
      stablePatternCount: athlete.stableCount,
      highConfidencePatternCount: athlete.highConfidenceCount,
      degradedPatternCount: athlete.degradedCount,
      recommendationProjectionCount: athlete.projections,
      recommendationProjectionCountsByConsumer,
      lastEngineRefreshAt: now - oneHour * (index + 1),
      activePatternKeys: athlete.recentPatterns.map((pattern: PilotDashboardRecentPattern) => pattern.patternKey),
      activeProjectionKeys: athlete.recentProjections.map((projection: PilotDashboardRecentProjection) => projection.projectionKey),
    });
    const cohort = cohorts.find((entry) => entry.id === athlete.cohortId) || null;
    const summary = {
      athleteId: athlete.athleteId,
      displayName: athlete.displayName,
      email: athlete.email,
      pilotEnrollment: enrollment,
      teamMembership,
      cohort,
      engineSummary,
    } as PilotDashboardAthleteSummary;
    const athleteDetail = {
      organization,
      team,
      pilot,
      cohort,
      pilotEnrollment: enrollment,
      teamMembership,
      displayName: athlete.displayName,
      email: athlete.email,
      engineSummary,
      profileSnapshotCount: athlete.snapshotHistory.length,
      latestAssessmentContextFlagStatus: athlete.assessmentContextStatus,
      latestAssessmentCapturedAt: athlete.snapshotHistory[0]?.capturedAt || null,
      recentPatterns: athlete.recentPatterns,
      recentProjections: athlete.recentProjections,
      recentEvidence: athlete.recentEvidence,
      snapshotHistory: athlete.snapshotHistory,
    } as PilotDashboardAthleteDetail;
    return { summary, athleteDetail };
  });

  const hypotheses = [
    {
      id: `${pilot.id}__h1`,
      pilotId: pilot.id,
      code: 'H1',
      statement: 'Athletes with linked physiology and sim evidence will show more personalized guidance over time.',
      leadingIndicator: 'Share of active pilot athletes reaching strong engine coverage and at least one stable pattern.',
      status: 'promising',
      confidenceLevel: 'medium',
      keyEvidence: 'Two best-instrumented athletes already have stable coach-facing patterns.',
      notes: 'Directional only; still needs broader cohort coverage.',
      lastReviewedAt: asTimestamp(now - oneDay),
      createdAt: asTimestamp(now - oneDay * 18),
      updatedAt: asTimestamp(now - oneDay),
    },
    {
      id: `${pilot.id}__h2`,
      pilotId: pilot.id,
      code: 'H2',
      statement: 'Stable correlation patterns will emerge for a meaningful share of athletes within the pilot window.',
      leadingIndicator: 'At least 50% of active athletes have one stable pattern by midpoint review.',
      status: 'promising',
      confidenceLevel: 'high',
      keyEvidence: 'Four of six active athletes already show at least one stable pattern.',
      notes: 'Best current hypothesis for demo walkthroughs.',
      lastReviewedAt: asTimestamp(now - oneDay),
      createdAt: asTimestamp(now - oneDay * 18),
      updatedAt: asTimestamp(now - oneDay),
    },
    {
      id: `${pilot.id}__h3`,
      pilotId: pilot.id,
      code: 'H3',
      statement: 'Recommendations based on body-state-specific patterns will outperform generic recommendations.',
      leadingIndicator: 'Outcome delta between personalized recommendation days and generic recommendation days.',
      status: 'mixed',
      confidenceLevel: 'medium',
      keyEvidence: 'Coach-facing logic looks plausible, but direct validation remains incomplete.',
      notes: 'Do not overclaim causal efficacy from current pilot evidence.',
      lastReviewedAt: asTimestamp(now - oneDay * 2),
      createdAt: asTimestamp(now - oneDay * 18),
      updatedAt: asTimestamp(now - oneDay * 2),
    },
    {
      id: `${pilot.id}__h4`,
      pilotId: pilot.id,
      code: 'H4',
      statement: 'Milestone interpretation will improve when physiological context is included.',
      leadingIndicator: 'More useful milestone review language when assessment context flags are present.',
      status: 'not-enough-data',
      confidenceLevel: 'low',
      keyEvidence: 'Assessment context flags are visible, but milestone outcome linkage still needs more completed snapshots.',
      notes: 'Good example of a disciplined hold.',
      lastReviewedAt: asTimestamp(now - oneDay * 3),
      createdAt: asTimestamp(now - oneDay * 18),
      updatedAt: asTimestamp(now - oneDay * 3),
    },
  ] as PulseCheckPilotHypothesis[];

  const readoutSections = buildResearchReadoutSectionSet(now);
  const researchReadouts = [
    {
      id: 'demo-readout-older',
      pilotId: pilot.id,
      organizationId: organization.id,
      teamId: team.id,
      cohortId: null,
      dateWindowStart: '2026-02-24',
      dateWindowEnd: '2026-03-10',
      baselineMode: 'no-baseline',
      reviewState: 'approved',
      modelVersion: 'demo-research-copilot-v1',
      promptVersion: 'pilot-research-readout-v2',
      readModelVersion: 'pilot-dashboard-v1',
      readiness: [
        { gateKey: 'pilot-status', status: 'passed', summary: 'Pilot is active.' },
        { gateKey: 'sample-size', status: 'passed', summary: 'Active athlete denominator is available.' },
        { gateKey: 'telemetry-completeness', status: 'passed', summary: 'Telemetry coverage is sufficient for a demo readout.' },
        { gateKey: 'freshness-telemetry', status: 'suppressed', summary: 'Freshness-sensitive interpretation should remain cautious.' },
        { gateKey: 'denominator-availability', status: 'passed', summary: 'Pilot-scoped denominators are available.' },
      ],
      sections: readoutSections.map((section) => ({ ...section })),
      frozenEvidenceFrame: {
        pilotId: pilot.id,
        activeAthleteCount: athletes.length,
        cohortFilter: null,
      },
      generatedAt: asTimestamp(now - oneDay * 3),
      reviewedAt: asTimestamp(now - oneDay * 2),
      reviewedByUserId: 'demo-admin-user',
      reviewedByEmail: 'demo-admin@pulsecheck.test',
      createdAt: asTimestamp(now - oneDay * 3),
      updatedAt: asTimestamp(now - oneDay * 2),
    },
    {
      id: 'demo-readout-latest',
      pilotId: pilot.id,
      organizationId: organization.id,
      teamId: team.id,
      cohortId: null,
      dateWindowStart: '2026-03-01',
      dateWindowEnd: '2026-03-20',
      baselineMode: 'cross-cohort',
      reviewState: 'reviewed',
      modelVersion: 'demo-research-copilot-v1',
      promptVersion: 'pilot-research-readout-v2',
      readModelVersion: 'pilot-dashboard-v1',
      readiness: [
        { gateKey: 'pilot-status', status: 'passed', summary: 'Pilot is active.' },
        { gateKey: 'sample-size', status: 'passed', summary: 'Active athlete denominator is available.' },
        { gateKey: 'telemetry-completeness', status: 'passed', summary: 'Telemetry coverage is sufficient for a demo readout.' },
        { gateKey: 'freshness-telemetry', status: 'suppressed', summary: 'Freshness-sensitive interpretation should remain cautious.' },
        { gateKey: 'denominator-availability', status: 'passed', summary: 'Pilot-scoped denominators are available.' },
      ],
      sections: readoutSections.map((section) => ({ ...section })),
      frozenEvidenceFrame: {
        pilotId: pilot.id,
        activeAthleteCount: athletes.length,
        cohortFilter: null,
      },
      generatedAt: asTimestamp(now - oneDay),
      reviewedAt: asTimestamp(now - oneHour * 8),
      reviewedByUserId: 'demo-admin-user',
      reviewedByEmail: 'demo-admin@pulsecheck.test',
      createdAt: asTimestamp(now - oneDay),
      updatedAt: asTimestamp(now - oneHour * 8),
    },
  ] as PilotResearchReadout[];

  const inviteConfig = buildInviteConfig(now);
  const teamInviteConfigDefault = {
    ...inviteConfig,
    id: team.id,
    scopeType: 'team',
    organizationId: organization.id,
    teamId: team.id,
  } as PulseCheckPilotInviteDefaultConfig;
  const organizationInviteConfigDefault = {
    ...inviteConfig,
    id: organization.id,
    scopeType: 'organization',
    organizationId: organization.id,
    teamId: team.id,
  } as PulseCheckPilotInviteDefaultConfig;
  const inviteLinks = [
    {
      id: 'demo-invite-link',
      inviteType: 'team-access',
      status: 'active',
      organizationId: organization.id,
      teamId: team.id,
      pilotId: pilot.id,
      pilotName: pilot.name,
      teamMembershipRole: 'athlete',
      token: 'demo-token',
      activationUrl: `/PulseCheck/team-invite/demo-token?demo=1`,
      createdByUserId: 'demo-admin-user',
      createdByEmail: 'demo-admin@pulsecheck.test',
      createdAt: asTimestamp(now - oneDay),
      updatedAt: asTimestamp(now - oneHour),
    },
  ] as PulseCheckInviteLink[];

  return {
    organization,
    team,
    pilot,
    cohorts,
    athletes,
    hypotheses,
    inviteConfig,
    hasPilotInviteConfigOverride: true,
    teamInviteConfigDefault,
    organizationInviteConfigDefault,
    researchReadouts,
    inviteLinks,
  };
}

function cloneStore<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function readStore(): PilotDashboardDemoStore {
  if (!canUseStorage()) {
    return buildBaseDemoStore();
  }

  const raw = window.localStorage.getItem(DEMO_STORE_KEY);
  if (!raw) {
    const nextStore = buildBaseDemoStore();
    window.localStorage.setItem(DEMO_STORE_KEY, JSON.stringify(nextStore));
    return nextStore;
  }

  try {
    return JSON.parse(raw) as PilotDashboardDemoStore;
  } catch {
    const nextStore = buildBaseDemoStore();
    window.localStorage.setItem(DEMO_STORE_KEY, JSON.stringify(nextStore));
    return nextStore;
  }
}

function writeStore(store: PilotDashboardDemoStore) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(DEMO_STORE_KEY, JSON.stringify(store));
}

function buildDetailFromStore(store: PilotDashboardDemoStore): PilotDashboardDetail {
  const athletes = store.athletes.map((entry) => entry.summary);
  const metrics = buildMetrics(athletes, store.cohorts, store.hypotheses);
  const coverage = buildCoverage(metrics);
  const cohortSummaries = buildCohortSummaries(store.cohorts, athletes);
  const sortedReadouts = [...store.researchReadouts].sort((left, right) => Number(right.generatedAt || 0) - Number(left.generatedAt || 0));

  return {
    organization: store.organization,
    team: store.team,
    pilot: store.pilot,
    cohorts: store.cohorts,
    athletes,
    hypotheses: [...store.hypotheses].sort((left, right) => left.code.localeCompare(right.code)),
    metrics,
    coverage,
    cohortSummaries,
    hypothesisSummary: buildHypothesisSummary(store.hypotheses),
    inviteConfig: store.inviteConfig,
    hasPilotInviteConfigOverride: store.hasPilotInviteConfigOverride,
    teamInviteConfigDefault: store.teamInviteConfigDefault,
    organizationInviteConfigDefault: store.organizationInviteConfigDefault,
    latestResearchReadout: sortedReadouts[0] || null,
    researchReadouts: sortedReadouts,
  };
}

function buildDirectoryEntryFromStore(store: PilotDashboardDemoStore): PilotDashboardDirectoryEntry {
  const detail = buildDetailFromStore(store);
  return {
    organization: detail.organization,
    team: detail.team,
    pilot: detail.pilot,
    cohorts: detail.cohorts,
    totalEnrollmentCount: detail.metrics.totalEnrollmentCount,
    activeEnrollmentCount: detail.metrics.activeAthleteCount,
    activeCohortCount: detail.cohorts.filter((cohort) => cohort.status === 'active').length,
    hypothesisCount: detail.metrics.hypothesisCount,
    unsupportedHypothesisCount: detail.metrics.unsupportedHypotheses,
    promisingHypothesisCount: detail.hypothesisSummary.promisingCount,
    highConfidenceHypothesisCount: detail.hypothesisSummary.highConfidenceCount,
    engineCoverageRate: detail.coverage.engineCoverageRate,
    stablePatternRate: detail.coverage.stablePatternRate,
    avgEvidenceRecordsPerActiveAthlete: detail.coverage.avgEvidenceRecordsPerActiveAthlete,
    avgRecommendationProjectionsPerActiveAthlete: detail.coverage.avgRecommendationProjectionsPerActiveAthlete,
  };
}

function nextResearchSections(frame: Record<string, any>, hypotheses: PulseCheckPilotHypothesis[]): PilotResearchReadoutSection[] {
  const activeAthleteCount = Number(frame?.metrics?.activeAthleteCount) || hypotheses.length || 0;
  const stablePatternCount = Number(frame?.metrics?.athletesWithStablePatterns) || 0;
  const hypothesisCodes = hypotheses.map((hypothesis) => hypothesis.code);
  const promisingCount = hypotheses.filter((hypothesis) => hypothesis.status === 'promising').length;
  const mixedCount = hypotheses.filter((hypothesis) => hypothesis.status === 'mixed').length;

  return [
    {
      sectionKey: 'pilot-summary',
      title: 'Pilot Summary',
      readinessStatus: activeAthleteCount > 0 ? 'ready' : 'suppressed',
      summary:
        activeAthleteCount > 0
          ? `This demo readout was generated for ${activeAthleteCount} active pilot athletes. The useful question is not whether the pilot is “done,” but whether the current evidence frame is strong enough to support disciplined interpretation and next-step research review.`
          : 'Insufficient evidence for interpretation because no active pilot-athlete denominator was available.',
      citations: [{ blockKey: 'overview-metrics', blockLabel: 'Pilot Overview Metrics', hypothesisCodes: [], limitationKeys: ['demo-mode'] }],
      claims:
        activeAthleteCount > 0
          ? [
              {
                claimKey: 'demo-active-athletes',
                claimType: 'observed',
                statement: `${activeAthleteCount} active pilot athletes are included in this generated demo frame.`,
                denominatorLabel: 'active pilot athletes',
                denominatorValue: activeAthleteCount,
                evidenceSources: ['pilot overview metrics'],
                confidenceLevel: 'high',
                baselineMode: frame?.baselineMode || 'no-baseline',
                caveatFlag: false,
              },
            ]
          : [],
      suggestedReviewerResolution: 'accepted',
    },
    {
      sectionKey: 'hypothesis-mapper',
      title: 'Hypothesis Mapper',
      readinessStatus: hypotheses.length > 0 ? 'ready' : 'suppressed',
      summary:
        hypotheses.length > 0
          ? `${promisingCount} hypotheses remain promising and ${mixedCount} remain mixed in this demo frame. This section is strongest when it helps the reviewer see which ideas are gaining support versus which ones still need a more cautious posture.`
          : 'No pilot hypotheses were available for this generated frame.',
      citations: [{ blockKey: 'hypothesis-governance', blockLabel: 'Pilot Hypotheses', hypothesisCodes, limitationKeys: ['demo-mode'] }],
      claims: [],
      suggestedReviewerResolution: 'accepted',
    },
    {
      sectionKey: 'findings-interpreter',
      title: 'Findings Interpreter',
      readinessStatus: activeAthleteCount > 0 ? 'ready' : 'suppressed',
      summary:
        activeAthleteCount > 0
          ? `The current demo frame shows ${stablePatternCount} athletes with at least one stable pattern. That is enough to discuss what the pilot may be learning, but not enough to blur cohort differences or overstate recommendation efficacy.`
          : 'Insufficient evidence for a findings interpretation because the denominator is not available.',
      citations: [{ blockKey: 'findings-layer', blockLabel: 'Pilot Findings', hypothesisCodes, limitationKeys: ['demo-mode'] }],
      claims: [],
      suggestedReviewerResolution: 'accepted',
    },
    {
      sectionKey: 'research-notes',
      title: 'Candidate Publishable Findings',
      readinessStatus: 'ready',
      summary:
        'Candidate finding only: body-state learning may emerge first in the best-instrumented subset of a pilot before broader generalization becomes responsible. Keep this in “worth discussing” posture until stronger validation and replication are available.',
      citations: [{ blockKey: 'research-notes', blockLabel: 'Research Notes', hypothesisCodes, limitationKeys: ['demo-mode'] }],
      claims: [],
      suggestedReviewerResolution: 'carry-forward',
    },
    {
      sectionKey: 'limitations',
      title: 'Limitations',
      readinessStatus: 'ready',
      summary:
        'This readout was generated in demo mode using mock pilot data. It is useful for walkthroughs and QA, but it should never be confused with a governed analysis of a live pilot.',
      citations: [{ blockKey: 'limitations', blockLabel: 'Demo Mode', hypothesisCodes: [], limitationKeys: ['demo-mode'] }],
      claims: [],
      suggestedReviewerResolution: 'accepted',
    },
  ];
}

export const pilotDashboardDemoMode = {
  isEnabled(): boolean {
    if (!canUseStorage()) return false;
    return window.localStorage.getItem(DEMO_MODE_KEY) === 'true';
  },

  setEnabled(enabled: boolean) {
    if (!canUseStorage()) return;
    window.localStorage.setItem(DEMO_MODE_KEY, enabled ? 'true' : 'false');
    if (enabled && !window.localStorage.getItem(DEMO_STORE_KEY)) {
      writeStore(buildBaseDemoStore());
    }
  },

  reset(): PilotDashboardDetail {
    const nextStore = buildBaseDemoStore();
    writeStore(nextStore);
    return buildDetailFromStore(nextStore);
  },

  getPilotId(): string {
    return DEMO_PILOT_ID;
  },

  listActivePilotDirectory(): PilotDashboardDirectoryEntry[] {
    return [buildDirectoryEntryFromStore(readStore())];
  },

  getPilotDashboardDetail(pilotId: string): PilotDashboardDetail | null {
    if (normalizeString(pilotId) !== DEMO_PILOT_ID) return null;
    return cloneStore(buildDetailFromStore(readStore()));
  },

  getPilotAthleteDetail(pilotId: string, athleteId: string): PilotDashboardAthleteDetail | null {
    if (normalizeString(pilotId) !== DEMO_PILOT_ID) return null;
    const athlete = readStore().athletes.find((entry) => entry.summary.athleteId === normalizeString(athleteId));
    return athlete ? cloneStore(athlete.athleteDetail) : null;
  },

  saveHypothesis(input: PulseCheckPilotHypothesisInput): string {
    const store = readStore();
    const hypothesisId = normalizeString(input.id) || `${normalizeString(input.pilotId)}__${normalizeString(input.code).toLowerCase()}`;
    const now = Date.now();
    const existingIndex = store.hypotheses.findIndex((hypothesis) => hypothesis.id === hypothesisId);
    const nextHypothesis = {
      id: hypothesisId,
      pilotId: normalizeString(input.pilotId),
      code: normalizeString(input.code),
      statement: normalizeString(input.statement),
      leadingIndicator: normalizeString(input.leadingIndicator),
      status: input.status,
      confidenceLevel: input.confidenceLevel,
      keyEvidence: normalizeString(input.keyEvidence),
      notes: normalizeString(input.notes),
      lastReviewedAt: asTimestamp(now),
      createdAt: existingIndex >= 0 ? store.hypotheses[existingIndex].createdAt : asTimestamp(now),
      updatedAt: asTimestamp(now),
    } as PulseCheckPilotHypothesis;
    if (existingIndex >= 0) {
      store.hypotheses[existingIndex] = nextHypothesis;
    } else {
      store.hypotheses.push(nextHypothesis);
    }
    writeStore(store);
    return hypothesisId;
  },

  seedDefaultHypotheses(defaults: Array<Pick<PulseCheckPilotHypothesis, 'code' | 'statement' | 'leadingIndicator'>>) {
    const store = readStore();
    if (store.hypotheses.length > 0) return;
    const now = Date.now();
    store.hypotheses = defaults.map((hypothesis) => ({
      id: `${store.pilot.id}__${hypothesis.code.toLowerCase()}`,
      pilotId: store.pilot.id,
      code: hypothesis.code,
      statement: hypothesis.statement,
      leadingIndicator: hypothesis.leadingIndicator,
      status: 'not-enough-data',
      confidenceLevel: 'low',
      keyEvidence: '',
      notes: '',
      lastReviewedAt: null,
      createdAt: asTimestamp(now),
      updatedAt: asTimestamp(now),
    })) as PulseCheckPilotHypothesis[];
    writeStore(store);
  },

  saveInviteConfig(input: PulseCheckPilotInviteConfigInput): string {
    const store = readStore();
    const now = Date.now();
    store.inviteConfig = {
      ...store.inviteConfig,
      pilotId: normalizeString(input.pilotId),
      organizationId: normalizeString(input.organizationId),
      teamId: normalizeString(input.teamId),
      welcomeHeadline: normalizeString(input.welcomeHeadline),
      welcomeBody: normalizeString(input.welcomeBody),
      existingAthleteInstructions: normalizeString(input.existingAthleteInstructions),
      newAthleteInstructions: normalizeString(input.newAthleteInstructions),
      wearableRequirements: normalizeString(input.wearableRequirements),
      baselineExpectations: normalizeString(input.baselineExpectations),
      supportName: normalizeString(input.supportName),
      supportEmail: normalizeString(input.supportEmail),
      supportPhone: normalizeString(input.supportPhone),
      iosAppUrl: normalizeString(input.iosAppUrl),
      androidAppUrl: normalizeString(input.androidAppUrl),
      updatedAt: asTimestamp(now),
    };
    store.hasPilotInviteConfigOverride = true;
    writeStore(store);
    return store.inviteConfig.id;
  },

  saveInviteDefault(input: PulseCheckPilotInviteDefaultConfigInput): string {
    const store = readStore();
    const now = Date.now();
    const nextDefault = {
      id: input.scopeType === 'team' ? normalizeString(input.teamId) : normalizeString(input.organizationId),
      scopeType: input.scopeType,
      organizationId: normalizeString(input.organizationId),
      teamId: normalizeString(input.teamId),
      welcomeHeadline: normalizeString(input.welcomeHeadline),
      welcomeBody: normalizeString(input.welcomeBody),
      existingAthleteInstructions: normalizeString(input.existingAthleteInstructions),
      newAthleteInstructions: normalizeString(input.newAthleteInstructions),
      wearableRequirements: normalizeString(input.wearableRequirements),
      baselineExpectations: normalizeString(input.baselineExpectations),
      supportName: normalizeString(input.supportName),
      supportEmail: normalizeString(input.supportEmail),
      supportPhone: normalizeString(input.supportPhone),
      iosAppUrl: normalizeString(input.iosAppUrl),
      androidAppUrl: normalizeString(input.androidAppUrl),
      createdAt: asTimestamp(now),
      updatedAt: asTimestamp(now),
    } as PulseCheckPilotInviteDefaultConfig;
    if (input.scopeType === 'team') {
      store.teamInviteConfigDefault = nextDefault;
    } else {
      store.organizationInviteConfigDefault = nextDefault;
    }
    writeStore(store);
    return nextDefault.id;
  },

  resetInviteConfigOverride() {
    const store = readStore();
    store.hasPilotInviteConfigOverride = false;
    if (store.teamInviteConfigDefault) {
      store.inviteConfig = {
        ...store.inviteConfig,
        ...store.teamInviteConfigDefault,
      };
    } else if (store.organizationInviteConfigDefault) {
      store.inviteConfig = {
        ...store.inviteConfig,
        ...store.organizationInviteConfigDefault,
      };
    }
    writeStore(store);
  },

  listInviteLinks(): PulseCheckInviteLink[] {
    return cloneStore(readStore().inviteLinks);
  },

  createInviteLink(input: {
    pilotId: string;
    pilotName: string;
    cohortId?: string;
    cohortName?: string;
    createdByUserId?: string;
    createdByEmail?: string;
  }): PulseCheckInviteLink {
    const store = readStore();
    const now = Date.now();
    const cohortSegment = normalizeString(input.cohortId) ? `-${normalizeString(input.cohortId)}` : '';
    const invite = {
      id: `demo-invite-${now}`,
      inviteType: 'team-access',
      status: 'active',
      organizationId: store.organization.id,
      teamId: store.team.id,
      pilotId: normalizeString(input.pilotId),
      pilotName: normalizeString(input.pilotName),
      cohortId: normalizeString(input.cohortId),
      cohortName: normalizeString(input.cohortName),
      teamMembershipRole: 'athlete',
      token: `demo-token-${now}`,
      activationUrl: `/PulseCheck/team-invite/demo-token-${now}?demo=1${cohortSegment ? `&cohort=${encodeURIComponent(cohortSegment)}` : ''}`,
      createdByUserId: normalizeString(input.createdByUserId) || 'demo-admin-user',
      createdByEmail: normalizeString(input.createdByEmail) || 'demo-admin@pulsecheck.test',
      createdAt: asTimestamp(now),
      updatedAt: asTimestamp(now),
    } as PulseCheckInviteLink;
    store.inviteLinks = [invite, ...store.inviteLinks];
    writeStore(store);
    return invite;
  },

  revokeInviteLink(inviteId: string): void {
    const store = readStore();
    store.inviteLinks = store.inviteLinks.map((invite) =>
      invite.id === normalizeString(inviteId)
        ? {
            ...invite,
            status: 'revoked',
            updatedAt: asTimestamp(Date.now()),
          }
        : invite
    );
    writeStore(store);
  },

  deleteInviteLink(inviteId: string): void {
    const store = readStore();
    store.inviteLinks = store.inviteLinks.filter((invite) => invite.id !== normalizeString(inviteId));
    writeStore(store);
  },

  assignAthleteToCohort(input: {
    athleteId: string;
    cohortId?: string;
    actorUserId?: string;
    actorEmail?: string;
  }): void {
    const store = readStore();
    const athleteId = normalizeString(input.athleteId);
    const cohortId = normalizeString(input.cohortId);
    const cohort = cohortId ? store.cohorts.find((entry) => entry.id === cohortId) || null : null;

    if (cohortId && !cohort) {
      throw new Error('The selected cohort could not be found in demo mode.');
    }

    const athleteIndex = store.athletes.findIndex((entry) => entry.summary.athleteId === athleteId);
    if (athleteIndex < 0) {
      throw new Error('Could not find that athlete in the demo pilot.');
    }

    const now = Date.now();
    const entry = store.athletes[athleteIndex];
    const nextTeamMembership = {
      ...entry.summary.teamMembership,
      athleteOnboarding: {
        ...(entry.summary.teamMembership?.athleteOnboarding || {}),
        targetCohortId: cohortId,
        targetCohortName: cohort?.name || '',
      },
      updatedAt: asTimestamp(now),
    } as PulseCheckTeamMembership;
    const nextPilotEnrollment = {
      ...entry.summary.pilotEnrollment,
      cohortId,
      updatedAt: asTimestamp(now),
    } as PulseCheckPilotEnrollment;

    const nextSummary = {
      ...entry.summary,
      cohort,
      teamMembership: nextTeamMembership,
      pilotEnrollment: nextPilotEnrollment,
    };
    const nextAthleteDetail = {
      ...entry.athleteDetail,
      cohort,
      teamMembership: nextTeamMembership,
      pilotEnrollment: nextPilotEnrollment,
    };

    store.athletes[athleteIndex] = {
      summary: nextSummary,
      athleteDetail: nextAthleteDetail,
    };
    writeStore(store);
  },

  generatePilotResearchReadout(input: { frame: Record<string, any>; options: PilotResearchReadoutGenerationInput }): { readoutId: string } {
    const store = readStore();
    const now = Date.now();
    const readoutId = `demo-generated-readout-${now}`;
    const readout = {
      id: readoutId,
      pilotId: normalizeString(input.options.pilotId),
      organizationId: store.organization.id,
      teamId: store.team.id,
      cohortId: normalizeString(input.options.cohortId) || null,
      dateWindowStart: normalizeString(input.options.dateWindowStart),
      dateWindowEnd: normalizeString(input.options.dateWindowEnd),
      baselineMode: input.options.baselineMode,
      reviewState: 'draft',
      modelVersion: 'demo-research-copilot-v1',
      promptVersion: 'pilot-research-readout-v2',
      readModelVersion: 'pilot-dashboard-v1',
      readiness: [
        { gateKey: 'pilot-status', status: 'passed', summary: 'Demo pilot is active and eligible.' },
        {
          gateKey: 'sample-size',
          status: Number(input.frame?.metrics?.activeAthleteCount) >= 3 ? 'passed' : 'failed',
          summary: Number(input.frame?.metrics?.activeAthleteCount) >= 3 ? 'Demo frame meets minimum sample size.' : 'Demo frame is below the minimum sample threshold.',
        },
        { gateKey: 'telemetry-completeness', status: 'passed', summary: 'Mock telemetry coverage is sufficient for demo generation.' },
        { gateKey: 'freshness-telemetry', status: 'suppressed', summary: 'Freshness-sensitive claims stay cautious in demo mode.' },
        { gateKey: 'denominator-availability', status: 'passed', summary: 'Pilot-scoped denominators are available in demo mode.' },
      ],
      sections: nextResearchSections(input.frame, store.hypotheses),
      frozenEvidenceFrame: input.frame,
      generatedAt: asTimestamp(now),
      reviewedAt: null,
      reviewedByUserId: '',
      reviewedByEmail: '',
      createdAt: asTimestamp(now),
      updatedAt: asTimestamp(now),
    } as PilotResearchReadout;
    store.researchReadouts = [readout, ...store.researchReadouts];
    writeStore(store);
    return { readoutId };
  },

  updatePilotResearchReadoutReview(input: PilotResearchReadoutReviewInput, reviewerEmail?: string) {
    const store = readStore();
    const now = Date.now();
    const readout = store.researchReadouts.find((entry) => entry.id === normalizeString(input.readoutId));
    if (!readout) {
      throw new Error('Demo readout not found.');
    }

    readout.reviewState = input.reviewState;
    readout.reviewedAt = asTimestamp(now);
    readout.reviewedByUserId = 'demo-admin-user';
    readout.reviewedByEmail = normalizeString(reviewerEmail) || 'demo-admin@pulsecheck.test';
    readout.updatedAt = asTimestamp(now);
    readout.sections = readout.sections.map((section) => {
      const patch = input.sections.find((item) => item.sectionKey === section.sectionKey);
      return patch
        ? {
            ...section,
            reviewerResolution: patch.reviewerResolution,
            reviewerNotes: normalizeString(patch.reviewerNotes),
          }
        : section;
    });

    if (input.reviewState === 'approved') {
      store.researchReadouts = store.researchReadouts.map((entry) => {
        if (entry.id !== readout.id && entry.pilotId === readout.pilotId && normalizeString(entry.cohortId) === normalizeString(readout.cohortId)) {
          return {
            ...entry,
            reviewState: 'superseded',
            updatedAt: asTimestamp(now),
          } as PilotResearchReadout;
        }
        return entry;
      });
    }

    writeStore(store);
  },
};
