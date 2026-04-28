import test from 'node:test';
import assert from 'node:assert/strict';

const installFirebaseEnv = () => {
  const required = {
    NEXT_PUBLIC_FIREBASE_API_KEY: 'test-api-key',
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: 'test.firebaseapp.com',
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'quicklifts-test',
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: 'quicklifts-test.appspot.com',
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: '123456789',
    NEXT_PUBLIC_FIREBASE_APP_ID: '1:123456789:web:test',
  };
  for (const [key, value] of Object.entries(required)) {
    process.env[key] ||= value;
  }
};

const loadModules = async () => {
  installFirebaseEnv();
  const [inference, generator, orchestrator, sportConfig] = await Promise.all([
    import('../../src/api/firebase/sportsIntelligenceInferenceEngine'),
    import('../../src/api/firebase/sportsIntelligenceReportGenerator'),
    import('../../src/api/firebase/sportsIntelligenceDraftOrchestrator'),
    import('../../src/api/firebase/pulsecheckSportConfig'),
  ]);
  return { inference, generator, orchestrator, sportConfig };
};

const buildSnapshot = (overrides: Record<string, any> = {}) => ({
  snapshotId: 'athlete-1_daily_2026-04-25',
  athleteUserId: 'athlete-1',
  snapshotDate: '2026-04-25',
  snapshotType: 'daily',
  generatedAt: '2026-04-25T20:00:00Z',
  sourceWindow: {
    startsAt: '2026-04-25T00:00:00Z',
    endsAt: '2026-04-25T23:59:59Z',
    timezone: 'America/New_York',
  },
  revision: 1,
  permissions: { productConsent: true, consentVersionIds: [], scopedConsumers: [] },
  sourceStatus: { oura: 'connected_synced' },
  freshness: {
    overall: 'fresh',
    perDomain: { recovery: 'fresh', training: 'fresh', behavioral: 'fresh' },
  },
  provenance: {
    sourcesUsed: ['oura'],
    domainWinners: { recovery: 'oura', training: 'oura' },
    summaryMode: 'merged_direct',
    sourceObservationTimes: { oura: '2026-04-25T20:00:00Z' },
  },
  domains: {
    identity: {
      freshness: 'fresh',
      data: { athleteUserId: 'athlete-1', teamIds: ['team-1'], organizationIds: [] },
      provenance: { contributingSources: [] },
      sourceStatus: {},
    },
    summary: {
      freshness: 'fresh',
      data: { surfacedFlags: [], driverDomains: ['recovery'] },
      provenance: { contributingSources: ['oura'] },
      sourceStatus: { oura: 'connected_synced' },
    },
    ...overrides,
  },
});

const fetchSport = async (sportId: string) => {
  const { sportConfig } = await loadModules();
  const sport = sportConfig.getDefaultPulseCheckSports().find((entry) => entry.id === sportId);
  if (!sport) throw new Error(`Sport ${sportId} not found`);
  return sport;
};

test('inference — readiness band derives from recoveryScore + sleep efficiency', async () => {
  const { inference } = await loadModules();
  const sport = await fetchSport('basketball');
  const snapshot = buildSnapshot({
    recovery: {
      freshness: 'fresh',
      data: { recoveryScore: 85, sleepEfficiency: 0.92, totalSleepMin: 460 },
      provenance: { contributingSources: ['oura'], primarySource: 'oura', dataConfidence: 'stable' },
      sourceStatus: { oura: 'connected_synced' },
    },
  });
  const result = inference.runSportsIntelligenceInference({ snapshot: snapshot as any, sport });
  assert.equal(result.readiness.readinessBand, 'fresh');
  assert.equal(result.readiness.confidenceTier, 'stable');
  assert.ok(result.readiness.evidence.length >= 2);
});

test('inference — concerning band when recoveryScore is below 40', async () => {
  const { inference } = await loadModules();
  const sport = await fetchSport('basketball');
  const snapshot = buildSnapshot({
    recovery: {
      freshness: 'fresh',
      data: { recoveryScore: 35, sleepEfficiency: 0.75 },
      provenance: { contributingSources: ['oura'], primarySource: 'oura', dataConfidence: 'stable' },
      sourceStatus: { oura: 'connected_synced' },
    },
  });
  const result = inference.runSportsIntelligenceInference({ snapshot: snapshot as any, sport });
  assert.equal(result.readiness.readinessBand, 'concerning');
});

test('inference — degraded confidence when no recovery + behavioral data', async () => {
  const { inference } = await loadModules();
  const sport = await fetchSport('basketball');
  const snapshot = buildSnapshot();
  const result = inference.runSportsIntelligenceInference({ snapshot: snapshot as any, sport });
  assert.equal(result.readiness.confidenceTier, 'degraded');
  assert.ok(result.readiness.missingInputs.some((m: any) => m.domain === 'recovery'));
});

test('inference — load band reflects sport-specific ACWR ceiling', async () => {
  const { inference } = await loadModules();
  // Track-Field has acwrCeiling 1.4 (sprinter-leaning)
  const sport = await fetchSport('track-field');
  const snapshot = buildSnapshot({
    training: {
      freshness: 'fresh',
      data: { acwr: 1.5, acuteLoad7dAU: 600, chronicLoad28dAU: 400 },
      provenance: { contributingSources: ['oura'], primarySource: 'oura', dataConfidence: 'stable' },
      sourceStatus: { oura: 'connected_synced' },
    },
  });
  const result = inference.runSportsIntelligenceInference({ snapshot: snapshot as any, sport });
  assert.equal(result.trainingLoad.loadBand, 'concerning');
  assert.equal(result.trainingLoad.acwr, 1.5);
});

test('inference — load band low when ACWR is well under sport ceiling', async () => {
  const { inference } = await loadModules();
  const sport = await fetchSport('basketball');
  const snapshot = buildSnapshot({
    training: {
      freshness: 'fresh',
      data: { acwr: 0.4, acuteLoad7dAU: 200, chronicLoad28dAU: 500 },
      provenance: { contributingSources: ['oura'], primarySource: 'oura', dataConfidence: 'stable' },
      sourceStatus: { oura: 'connected_synced' },
    },
  });
  const result = inference.runSportsIntelligenceInference({ snapshot: snapshot as any, sport });
  assert.equal(result.trainingLoad.loadBand, 'low');
});

test('inference — concerning load band produces a recommendation', async () => {
  const { inference } = await loadModules();
  const sport = await fetchSport('basketball');
  const snapshot = buildSnapshot({
    training: {
      freshness: 'fresh',
      data: { acwr: 1.7 },
      provenance: { contributingSources: ['oura'], primarySource: 'oura', dataConfidence: 'high_confidence' },
      sourceStatus: { oura: 'connected_synced' },
    },
  });
  const result = inference.runSportsIntelligenceInference({ snapshot: snapshot as any, sport });
  assert.ok(result.recommendations.length >= 1);
  const loadRec = result.recommendations.find((r: any) => r.actionType === 'load');
  assert.ok(loadRec);
  assert.equal(loadRec.recommendationStrength, 'high');
});

test('generator — empty athleteResults produces team-on-plan top line', async () => {
  const { generator } = await loadModules();
  const sport = await fetchSport('basketball');
  const draft = generator.generateCoachReportDraft({
    athleteResults: [],
    sport,
    team: { teamId: 'team-1', weekStart: '2026-04-21' },
  });
  assert.ok(draft.coachSurface.topLine.whatChanged.includes('on plan'));
  assert.ok(draft.generatorNotes.length > 0);
});

test('generator — concerning-readiness athlete lands in watchlist with stable+ confidence', async () => {
  const { inference, generator } = await loadModules();
  const sport = await fetchSport('basketball');
  const snapshot = buildSnapshot({
    recovery: {
      freshness: 'fresh',
      data: { recoveryScore: 30, sleepEfficiency: 0.65 },
      provenance: { contributingSources: ['oura'], primarySource: 'oura', dataConfidence: 'stable' },
      sourceStatus: { oura: 'connected_synced' },
    },
  });
  const inferenceResult = inference.runSportsIntelligenceInference({ snapshot: snapshot as any, sport });
  const draft = generator.generateCoachReportDraft({
    athleteResults: [
      { athleteName: 'M. Johnson', role: 'Point Guard', inference: inferenceResult, snapshot: snapshot as any },
    ],
    sport,
    team: { teamId: 'team-1', weekStart: '2026-04-21' },
  });
  assert.equal(draft.coachSurface.watchlist.length, 1);
  assert.equal(draft.coachSurface.watchlist[0].athleteName, 'M. Johnson');
  assert.equal(draft.coachSurface.watchlist[0].confidenceTier, 'stable');
});

test('generator — coach-action gate suppresses generic actions', async () => {
  const { inference, generator } = await loadModules();
  const sport = await fetchSport('basketball');
  const snapshot = buildSnapshot({
    training: {
      freshness: 'fresh',
      data: { acwr: 1.6 },
      provenance: { contributingSources: ['oura'], primarySource: 'oura', dataConfidence: 'stable' },
      sourceStatus: { oura: 'connected_synced' },
    },
  });
  const inferenceResult = inference.runSportsIntelligenceInference({ snapshot: snapshot as any, sport });
  const draft = generator.generateCoachReportDraft({
    athleteResults: [
      { athleteName: 'T. Davis', role: 'Point Guard', inference: inferenceResult, snapshot: snapshot as any },
    ],
    sport,
    team: { teamId: 'team-1', weekStart: '2026-04-21' },
  });
  // Generated coach actions must reference an athlete or session per the spec
  for (const action of draft.coachSurface.coachActions) {
    assert.ok(
      Boolean(action.appliesTo) || Boolean(action.session),
      `coach action "${action.action}" must reference athlete or session`,
    );
  }
});

test('generator — banned vocabulary does not leak into coach surface (smoke check on team synthesis)', async () => {
  const { inference, generator } = await loadModules();
  const sport = await fetchSport('basketball');
  const snapshot = buildSnapshot({
    training: {
      freshness: 'fresh',
      data: { acwr: 1.6 },
      provenance: { contributingSources: ['oura'], primarySource: 'oura', dataConfidence: 'stable' },
      sourceStatus: { oura: 'connected_synced' },
    },
  });
  const inferenceResult = inference.runSportsIntelligenceInference({ snapshot: snapshot as any, sport });
  const draft = generator.generateCoachReportDraft({
    athleteResults: [
      { athleteName: 'M. Johnson', role: 'Point Guard', inference: inferenceResult, snapshot: snapshot as any },
    ],
    sport,
    team: { teamId: 'team-1', weekStart: '2026-04-21' },
  });
  const surfaceText = JSON.stringify(draft.coachSurface);
  for (const banned of ['ACWR', 'load_au', 'high_confidence', 'degraded']) {
    assert.equal(surfaceText.includes(banned), false, `banned phrase "${banned}" leaked into coach surface`);
  }
});

test('orchestrator — preview mode skips Firestore writes and surfaces athlete trace', async () => {
  const { orchestrator } = await loadModules();
  const sport = await fetchSport('basketball');
  const snapshot = buildSnapshot({
    recovery: {
      freshness: 'fresh',
      data: { recoveryScore: 78, sleepEfficiency: 0.88 },
      provenance: { contributingSources: ['oura'], primarySource: 'oura', dataConfidence: 'stable' },
      sourceStatus: { oura: 'connected_synced' },
    },
  });
  const result = await orchestrator.orchestrateGeneratedReportDraft({
    teamId: 'team-1',
    sportId: 'basketball',
    weekStart: '2026-04-25',
    sport,
    athletesOverride: [
      { athleteUserId: 'athlete-1', athleteName: 'M. Johnson', role: 'Point Guard' },
      { athleteUserId: 'athlete-2', athleteName: 'T. Davis', role: 'Point Guard' },
    ],
    snapshotsByAthlete: {
      'athlete-1': snapshot as any,
      'athlete-2': null,
    },
    preview: true,
  });
  assert.equal(result.reportId, undefined);
  assert.equal(result.athleteTrace.length, 2);
  assert.equal(result.athleteTrace[0].snapshotLoaded, true);
  assert.equal(result.athleteTrace[1].snapshotLoaded, false);
  assert.ok(result.generatedDraft.coachSurface.meta.source === 'generated');
});

test('orchestrator — surfaces a thin-read note when athletes exist but no snapshots', async () => {
  const { orchestrator } = await loadModules();
  const sport = await fetchSport('basketball');
  const result = await orchestrator.orchestrateGeneratedReportDraft({
    teamId: 'team-1',
    sportId: 'basketball',
    weekStart: '2026-04-25',
    sport,
    athletesOverride: [
      { athleteUserId: 'athlete-1', athleteName: 'M. Johnson', role: 'Point Guard' },
    ],
    snapshotsByAthlete: { 'athlete-1': null },
    skipAdherenceCompute: true,
    preview: true,
  });
  assert.ok(
    result.generatorNotes.some((note: string) => note.includes('thin')),
    'thin-read note must appear in generator notes',
  );
});

test('generator — adherence override flows verbatim into the coach surface', async () => {
  const { generator } = await loadModules();
  const sport = await fetchSport('basketball');
  const draft = generator.generateCoachReportDraft({
    athleteResults: [],
    sport,
    team: { teamId: 'team-1', weekStart: '2026-04-21' },
    adherence: {
      wearRate7d: 0.85,
      noraCheckinCompletion7d: 0.71,
      protocolOrSimCompletion7d: 0.78,
      trainingOrNutritionCoverage7d: 0.72,
      confidenceLabel: 'Strong read',
      categoriesReady: 4,
    },
  });
  assert.equal(draft.coachSurface.adherence.confidenceLabel, 'Strong read');
  assert.equal(draft.coachSurface.adherence.wearRate7d, 0.85);
  assert.equal(draft.coachSurface.adherence.noraCheckinCompletion7d, 0.71);
  assert.ok(draft.coachSurface.adherence.summary?.includes('strong read'));
  assert.ok(draft.coachSurface.adherence.summary?.includes('4/4'));
});

test('orchestrator — passes adherenceOverride straight through to the generator', async () => {
  const { orchestrator } = await loadModules();
  const sport = await fetchSport('basketball');
  const adherence = {
    teamId: 'team-1',
    window: { startDateKey: '2026-04-19', endDateKey: '2026-04-25', expectedDays: 7 },
    wearRate: 0.83,
    noraCheckinCompletion: 0.91,
    protocolOrSimCompletion: 0.74,
    trainingOrNutritionCoverage: 0.81,
    categoriesReady: 4,
    confidenceLabel: 'Strong read' as const,
    athletes: [],
    athleteCount: 0,
  };
  const result = await orchestrator.orchestrateGeneratedReportDraft({
    teamId: 'team-1',
    sportId: 'basketball',
    weekStart: '2026-04-25',
    sport,
    athletesOverride: [
      { athleteUserId: 'athlete-1', athleteName: 'M. Johnson', role: 'Point Guard' },
    ],
    snapshotsByAthlete: { 'athlete-1': null },
    adherenceOverride: adherence,
    preview: true,
  });
  assert.equal(result.adherenceSummary?.confidenceLabel, 'Strong read');
  assert.equal(result.generatedDraft.coachSurface.adherence.confidenceLabel, 'Strong read');
  assert.equal(result.generatedDraft.coachSurface.adherence.wearRate7d, 0.83);
});

// ────────────────────────────────────────────────────────────────────────────
// Phase A · Circadian / travel disruption inference + sleep-midpoint shift
// ────────────────────────────────────────────────────────────────────────────

test('circadian — settled when all signals are baseline-low', async () => {
  const { inference } = await loadModules();
  const sport = await fetchSport('basketball');
  const snapshot = buildSnapshot({
    recovery: {
      freshness: 'fresh',
      data: {
        sleepMidpointShiftMinutes: 10,
        daytimeAutonomicLoadMinutes: 30,
        temperatureDeviation: 0.05,
      },
      provenance: { contributingSources: ['oura'], primarySource: 'oura', dataConfidence: 'stable' },
      sourceStatus: { oura: 'connected_synced' },
    },
  });
  const result = inference.runSportsIntelligenceInference({ snapshot: snapshot as any, sport });
  assert.equal(result.circadianDisruption.disruptionBand, 'settled');
  assert.equal(result.circadianDisruption.contributingSignals.length, 3);
});

test('circadian — travel_signature when temperature dev hits 0.4°C even with mild others', async () => {
  const { inference } = await loadModules();
  const sport = await fetchSport('basketball');
  const snapshot = buildSnapshot({
    recovery: {
      freshness: 'fresh',
      data: {
        sleepMidpointShiftMinutes: 35, // mild_shift
        daytimeAutonomicLoadMinutes: 100, // mild_shift
        temperatureDeviation: 0.4, // travel_signature — worst-of wins
      },
      provenance: { contributingSources: ['oura'], primarySource: 'oura', dataConfidence: 'stable' },
      sourceStatus: { oura: 'connected_synced' },
    },
  });
  const result = inference.runSportsIntelligenceInference({ snapshot: snapshot as any, sport });
  assert.equal(result.circadianDisruption.disruptionBand, 'travel_signature');
});

test('circadian — jetlag_significant when shift exceeds 180 min', async () => {
  const { inference } = await loadModules();
  const sport = await fetchSport('basketball');
  const snapshot = buildSnapshot({
    recovery: {
      freshness: 'fresh',
      data: {
        sleepMidpointShiftMinutes: -240, // shifted 4h earlier (westward travel)
        temperatureDeviation: 0.6,
      },
      provenance: { contributingSources: ['oura'], primarySource: 'oura', dataConfidence: 'stable' },
      sourceStatus: { oura: 'connected_synced' },
    },
  });
  const result = inference.runSportsIntelligenceInference({ snapshot: snapshot as any, sport });
  assert.equal(result.circadianDisruption.disruptionBand, 'jetlag_significant');
  assert.equal(result.circadianDisruption.sleepMidpointShiftMinutes, -240);
});

test('circadian — degraded confidence when no signals available', async () => {
  const { inference } = await loadModules();
  const sport = await fetchSport('basketball');
  const snapshot = buildSnapshot();
  const result = inference.runSportsIntelligenceInference({ snapshot: snapshot as any, sport });
  assert.equal(result.circadianDisruption.disruptionBand, 'settled');
  assert.equal(result.circadianDisruption.contributingSignals.length, 0);
  assert.equal(result.circadianDisruption.confidenceTier, 'degraded');
});

test('circadian — directional confidence with only one signal present', async () => {
  const { inference } = await loadModules();
  const sport = await fetchSport('basketball');
  const snapshot = buildSnapshot({
    recovery: {
      freshness: 'fresh',
      data: { temperatureDeviation: 0.35 },
      provenance: { contributingSources: ['oura'], primarySource: 'oura', dataConfidence: 'stable' },
      sourceStatus: { oura: 'connected_synced' },
    },
  });
  const result = inference.runSportsIntelligenceInference({ snapshot: snapshot as any, sport });
  assert.equal(result.circadianDisruption.contributingSignals.length, 1);
  assert.equal(result.circadianDisruption.confidenceTier, 'directional');
});

test('assembler — computeSleepMidpointShiftMinutes handles signed delta within window', async () => {
  installFirebaseEnv();
  const mod = await import('../../src/api/firebase/healthContextSnapshotAssembler');
  // Today at 03:00 UTC, baseline cluster around 04:30 UTC → shifted 90min earlier (negative).
  const oneDay = 86400;
  const baseDay = 1777200000; // arbitrary
  const today = baseDay + 3 * 60 * 60; // 03:00 UTC
  const baseline = [
    baseDay + 4.5 * 60 * 60,
    baseDay + 4.5 * 60 * 60 - oneDay,
    baseDay + 4.5 * 60 * 60 - 2 * oneDay,
  ];
  const shift = mod.computeSleepMidpointShiftMinutes(today, baseline);
  assert.equal(shift, -90);
});

test('assembler — computeSleepMidpointShiftMinutes wraps to shortest circular delta', async () => {
  installFirebaseEnv();
  const mod = await import('../../src/api/firebase/healthContextSnapshotAssembler');
  // Baseline at 23:00 UTC (82800s), today at 02:00 UTC (7200s).
  // Naive delta: 7200 - 82800 = -75600 (-21h). Circular shortest: +180 minutes.
  const baseDay = 1777200000;
  const today = baseDay + 2 * 60 * 60; // 02:00
  const baseline = [baseDay - 60 * 60, baseDay - 60 * 60 - 86400]; // 23:00 prior days
  const shift = mod.computeSleepMidpointShiftMinutes(today, baseline);
  assert.equal(shift, 180);
});

test('assembler — computeSleepMidpointShiftMinutes returns null with empty baseline', async () => {
  installFirebaseEnv();
  const mod = await import('../../src/api/firebase/healthContextSnapshotAssembler');
  const shift = mod.computeSleepMidpointShiftMinutes(1777200000, []);
  assert.equal(shift, null);
});
