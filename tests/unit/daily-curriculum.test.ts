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
  const [types, generator, taxonomy] = await Promise.all([
    import('../../src/api/firebase/dailyCurriculum/types'),
    import('../../src/api/firebase/dailyCurriculum/dailyAssignmentGenerator'),
    import('../../src/api/firebase/mentaltraining/taxonomy'),
  ]);
  return { types, generator, taxonomy };
};

// ──────────────────────────────────────────────────────────────────────────────
// Validation tests
// ──────────────────────────────────────────────────────────────────────────────

test('validatePillarWeights — accepts non-negative finite values', async () => {
  const { types } = await loadModules();
  const r = types.validatePillarWeights({ composure: 33, focus: 33, decision: 33 });
  assert.equal(r.ok, true);
  assert.equal(r.issues.length, 0);
});

test('validatePillarWeights — rejects negative + non-finite', async () => {
  const { types } = await loadModules();
  const r = types.validatePillarWeights({ composure: -1, focus: 33, decision: NaN });
  assert.equal(r.ok, false);
  assert.ok(r.issues.length >= 2);
});

test('validatePillarWeights — rejects all-zero (engine cannot normalize)', async () => {
  const { types } = await loadModules();
  const r = types.validatePillarWeights({ composure: 0, focus: 0, decision: 0 });
  assert.equal(r.ok, false);
  assert.ok(r.issues.find((i) => i.field === 'pillarWeights.sum'));
});

test('validateCurriculumOverride — rejects malformed yearMonth + missing required fields', async () => {
  const { types } = await loadModules();
  const r = types.validateCurriculumOverride({
    id: 'x',
    athleteUserId: '',
    yearMonth: 'bad',
    overrideType: 'pin-protocol',
    targetId: '',
    createdByUserId: 'u1',
    createdByRole: 'coach',
    createdAt: 0,
    expiresAt: 0,
    status: 'active',
  });
  assert.equal(r.ok, false);
  const fields = r.issues.map((i) => i.field);
  assert.ok(fields.includes('athleteUserId'));
  assert.ok(fields.includes('targetId'));
  assert.ok(fields.includes('yearMonth'));
});

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

test('normalizePillarWeights — sums to 1', async () => {
  const { types } = await loadModules();
  const n = types.normalizePillarWeights({ composure: 50, focus: 25, decision: 25 });
  const sum = n.composure + n.focus + n.decision;
  assert.ok(Math.abs(sum - 1) < 1e-9);
  assert.ok(Math.abs(n.composure - 0.5) < 1e-9);
});

test('normalizePillarWeights — falls back to even split when sum <= 0', async () => {
  const { types } = await loadModules();
  const n = types.normalizePillarWeights({ composure: 0, focus: 0, decision: 0 });
  assert.ok(Math.abs(n.composure - 1 / 3) < 1e-9);
});

test('yearMonthOf — extracts YYYY-MM from a date-key string', async () => {
  const { types } = await loadModules();
  assert.equal(types.yearMonthOf('2026-04-29'), '2026-04');
});

test('resolveFrequency — explicit field wins over level default', async () => {
  const { types } = await loadModules();
  const v = types.resolveFrequency(
    { recommendedFrequencyPer30Days: 6, progressionLevel: 'foundational' },
    { foundational: 12, intermediate: 8, advanced: 4 },
  );
  assert.equal(v, 6);
});

test('resolveFrequency — falls back to level default when explicit missing', async () => {
  const { types } = await loadModules();
  const v = types.resolveFrequency(
    { progressionLevel: 'intermediate' },
    { foundational: 12, intermediate: 8, advanced: 4 },
  );
  assert.equal(v, 8);
});

test('resolveFrequency — rejects negative explicit and falls back', async () => {
  const { types } = await loadModules();
  const v = types.resolveFrequency(
    { recommendedFrequencyPer30Days: -3, progressionLevel: 'advanced' },
    { foundational: 12, intermediate: 8, advanced: 4 },
  );
  assert.equal(v, 4);
});

// ──────────────────────────────────────────────────────────────────────────────
// Selection algorithm internals
// ──────────────────────────────────────────────────────────────────────────────

test('pickWorstGapPillar — returns the most-underrepped pillar', async () => {
  const { generator, taxonomy } = await loadModules();
  // Composure is way under target in this fixture.
  const worst = generator.__internal.pickWorstGapPillar(
    {
      [taxonomy.TaxonomyPillar.Composure]: 0,
      [taxonomy.TaxonomyPillar.Focus]: 100,
      [taxonomy.TaxonomyPillar.Decision]: 100,
    },
    { composure: 33, focus: 33, decision: 33 },
    { foundational: 12, intermediate: 8, advanced: 4 },
    [],
  );
  assert.equal(worst, taxonomy.TaxonomyPillar.Composure);
});

test('pickWorstGapPillar — respects per-sport heavy weight', async () => {
  const { generator, taxonomy } = await loadModules();
  // All pillars have equal reps, but decision has 5× weight → highest target → worst gap.
  const worst = generator.__internal.pickWorstGapPillar(
    {
      [taxonomy.TaxonomyPillar.Composure]: 5,
      [taxonomy.TaxonomyPillar.Focus]: 5,
      [taxonomy.TaxonomyPillar.Decision]: 5,
    },
    { composure: 10, focus: 10, decision: 50 },
    { foundational: 12, intermediate: 8, advanced: 4 },
    [],
  );
  assert.equal(worst, taxonomy.TaxonomyPillar.Decision);
});

test('pickAsset — picks foundational over intermediate when ratios tie', async () => {
  const { generator, taxonomy } = await loadModules();
  const fakeProtocols = [
    {
      id: 'p-intermediate',
      label: 'Intermediate Protocol',
      cognitivePillar: taxonomy.TaxonomyPillar.Composure,
      progressionLevel: 'intermediate',
      isActive: true,
    },
    {
      id: 'p-foundational',
      label: 'Foundational Protocol',
      cognitivePillar: taxonomy.TaxonomyPillar.Composure,
      progressionLevel: 'foundational',
      isActive: true,
    },
  ] as any[];

  const result = generator.__internal.pickAsset({
    pool: fakeProtocols,
    drivingPillar: taxonomy.TaxonomyPillar.Composure,
    completions: {
      byAssetId: new Map<string, number>(),
      byPillar: {
        [taxonomy.TaxonomyPillar.Composure]: 0,
        [taxonomy.TaxonomyPillar.Focus]: 0,
        [taxonomy.TaxonomyPillar.Decision]: 0,
      },
      recentlyAssignedIds: () => new Set<string>(),
    },
    overrides: [],
    recentlyAssigned: new Set<string>(),
    kind: 'protocol',
    frequencyDefaults: { foundational: 12, intermediate: 8, advanced: 4 },
  });

  assert.ok(result);
  // Both have ratio 0/12 = 0/8 = 0 — foundational wins on tiebreak.
  assert.equal(result!.asset.id, 'p-foundational');
});

test('pickAsset — coach pin overrides under-done preference', async () => {
  const { generator, taxonomy } = await loadModules();
  const fakeProtocols = [
    {
      id: 'p-A',
      label: 'A',
      cognitivePillar: taxonomy.TaxonomyPillar.Focus,
      progressionLevel: 'foundational',
      isActive: true,
    },
    {
      id: 'p-B',
      label: 'B',
      cognitivePillar: taxonomy.TaxonomyPillar.Focus,
      progressionLevel: 'foundational',
      isActive: true,
    },
  ] as any[];

  const result = generator.__internal.pickAsset({
    pool: fakeProtocols,
    drivingPillar: taxonomy.TaxonomyPillar.Focus,
    completions: {
      byAssetId: new Map([['p-A', 5]]), // A done more, B less — B would win normally
      byPillar: {
        [taxonomy.TaxonomyPillar.Composure]: 0,
        [taxonomy.TaxonomyPillar.Focus]: 5,
        [taxonomy.TaxonomyPillar.Decision]: 0,
      },
      recentlyAssignedIds: () => new Set<string>(),
    },
    overrides: [
      {
        id: 'override-1',
        athleteUserId: 'a1',
        yearMonth: '2026-04',
        overrideType: 'pin-protocol',
        targetId: 'p-A',
        createdByUserId: 'coach-1',
        createdByRole: 'coach',
        createdAt: 0,
        expiresAt: 0,
        status: 'active',
      },
    ] as any,
    recentlyAssigned: new Set<string>(),
    kind: 'protocol',
    frequencyDefaults: { foundational: 12, intermediate: 8, advanced: 4 },
  });

  assert.ok(result);
  assert.equal(result!.asset.id, 'p-A');
  assert.equal(result!.coachOverrideId, 'override-1');
});

test('pickAsset — exclude override removes asset from pool', async () => {
  const { generator, taxonomy } = await loadModules();
  const fakeProtocols = [
    { id: 'p-ok', label: 'OK', cognitivePillar: taxonomy.TaxonomyPillar.Focus, progressionLevel: 'foundational', isActive: true },
    { id: 'p-blocked', label: 'BLOCKED', cognitivePillar: taxonomy.TaxonomyPillar.Focus, progressionLevel: 'foundational', isActive: true },
  ] as any[];

  const result = generator.__internal.pickAsset({
    pool: fakeProtocols,
    drivingPillar: taxonomy.TaxonomyPillar.Focus,
    completions: {
      byAssetId: new Map(),
      byPillar: {
        [taxonomy.TaxonomyPillar.Composure]: 0,
        [taxonomy.TaxonomyPillar.Focus]: 0,
        [taxonomy.TaxonomyPillar.Decision]: 0,
      },
      recentlyAssignedIds: () => new Set<string>(),
    },
    overrides: [
      {
        id: 'override-2',
        athleteUserId: 'a1',
        yearMonth: '2026-04',
        overrideType: 'exclude-protocol',
        targetId: 'p-blocked',
        createdByUserId: 'coach-1',
        createdByRole: 'coach',
        createdAt: 0,
        expiresAt: 0,
        status: 'active',
      },
    ] as any,
    recentlyAssigned: new Set<string>(),
    kind: 'protocol',
    frequencyDefaults: { foundational: 12, intermediate: 8, advanced: 4 },
  });

  assert.ok(result);
  assert.equal(result!.asset.id, 'p-ok');
});

test('pickAsset — recently-assigned (variety filter) skips repeats within 2 days', async () => {
  const { generator, taxonomy } = await loadModules();
  const fakeProtocols = [
    { id: 'p-recent', label: 'Recent', cognitivePillar: taxonomy.TaxonomyPillar.Focus, progressionLevel: 'foundational', isActive: true },
    { id: 'p-fresh', label: 'Fresh', cognitivePillar: taxonomy.TaxonomyPillar.Focus, progressionLevel: 'foundational', isActive: true },
  ] as any[];

  const result = generator.__internal.pickAsset({
    pool: fakeProtocols,
    drivingPillar: taxonomy.TaxonomyPillar.Focus,
    completions: {
      byAssetId: new Map(),
      byPillar: {
        [taxonomy.TaxonomyPillar.Composure]: 0,
        [taxonomy.TaxonomyPillar.Focus]: 0,
        [taxonomy.TaxonomyPillar.Decision]: 0,
      },
      recentlyAssignedIds: () => new Set(['p-recent']),
    },
    overrides: [],
    recentlyAssigned: new Set(['p-recent']),
    kind: 'protocol',
    frequencyDefaults: { foundational: 12, intermediate: 8, advanced: 4 },
  });

  assert.ok(result);
  assert.equal(result!.asset.id, 'p-fresh');
});

test('pickAsset — intermediate gated by prerequisitePillarReps when not met', async () => {
  const { generator, taxonomy } = await loadModules();
  const fakeProtocols = [
    {
      id: 'p-intermediate-gated',
      label: 'Gated Intermediate',
      cognitivePillar: taxonomy.TaxonomyPillar.Decision,
      progressionLevel: 'intermediate',
      prerequisitePillarReps: { [taxonomy.TaxonomyPillar.Focus]: 8 },
      isActive: true,
    },
    {
      id: 'p-foundational-fallback',
      label: 'Foundational',
      cognitivePillar: taxonomy.TaxonomyPillar.Decision,
      progressionLevel: 'foundational',
      isActive: true,
    },
  ] as any[];

  const result = generator.__internal.pickAsset({
    pool: fakeProtocols,
    drivingPillar: taxonomy.TaxonomyPillar.Decision,
    completions: {
      byAssetId: new Map(),
      byPillar: {
        [taxonomy.TaxonomyPillar.Composure]: 0,
        [taxonomy.TaxonomyPillar.Focus]: 3, // < 8 prereq
        [taxonomy.TaxonomyPillar.Decision]: 0,
      },
      recentlyAssignedIds: () => new Set<string>(),
    },
    overrides: [],
    recentlyAssigned: new Set<string>(),
    kind: 'protocol',
    frequencyDefaults: { foundational: 12, intermediate: 8, advanced: 4 },
  });

  assert.ok(result);
  assert.equal(result!.asset.id, 'p-foundational-fallback');
});

test('pickAsset — returns null when pool is empty', async () => {
  const { generator, taxonomy } = await loadModules();
  const result = generator.__internal.pickAsset({
    pool: [],
    drivingPillar: taxonomy.TaxonomyPillar.Composure,
    completions: {
      byAssetId: new Map(),
      byPillar: {
        [taxonomy.TaxonomyPillar.Composure]: 0,
        [taxonomy.TaxonomyPillar.Focus]: 0,
        [taxonomy.TaxonomyPillar.Decision]: 0,
      },
      recentlyAssignedIds: () => new Set<string>(),
    },
    overrides: [],
    recentlyAssigned: new Set<string>(),
    kind: 'protocol',
    frequencyDefaults: { foundational: 12, intermediate: 8, advanced: 4 },
  });
  assert.equal(result, null);
});

// ──────────────────────────────────────────────────────────────────────────────
// Asset metadata helpers
// ──────────────────────────────────────────────────────────────────────────────

test('assetPillar — reads cognitivePillar on protocols', async () => {
  const { generator, taxonomy } = await loadModules();
  const p = generator.__internal.assetPillar({ id: 'p1', cognitivePillar: taxonomy.TaxonomyPillar.Focus } as any);
  assert.equal(p, taxonomy.TaxonomyPillar.Focus);
});

test('assetPillar — falls back to taxonomy.primaryPillar on sims', async () => {
  const { generator, taxonomy } = await loadModules();
  const p = generator.__internal.assetPillar({
    id: 's1',
    name: 'sim',
    taxonomy: { primaryPillar: taxonomy.TaxonomyPillar.Decision },
  } as any);
  assert.equal(p, taxonomy.TaxonomyPillar.Decision);
});

test('assetProgression — defaults to foundational when unset', async () => {
  const { generator } = await loadModules();
  const p = generator.__internal.assetProgression({ id: 'p1' } as any);
  assert.equal(p, 'foundational');
});

test('default frequencies match doctrine: foundational=12, intermediate=8, advanced=4', async () => {
  const { types } = await loadModules();
  assert.equal(types.DEFAULT_FREQUENCY_PER_30_DAYS.foundational, 12);
  assert.equal(types.DEFAULT_FREQUENCY_PER_30_DAYS.intermediate, 8);
  assert.equal(types.DEFAULT_FREQUENCY_PER_30_DAYS.advanced, 4);
});

test('default pillar weights are equal (33/33/33)', async () => {
  const { types } = await loadModules();
  assert.equal(types.EQUAL_PILLAR_WEIGHTS.composure, 33);
  assert.equal(types.EQUAL_PILLAR_WEIGHTS.focus, 33);
  assert.equal(types.EQUAL_PILLAR_WEIGHTS.decision, 33);
});

test('default notification cadence — morning 8am, midday 1pm, evening 8pm local', async () => {
  const { types } = await loadModules();
  assert.equal(types.DEFAULT_NOTIFICATION_CADENCE.morningHourLocal, 8);
  assert.equal(types.DEFAULT_NOTIFICATION_CADENCE.middayHourLocal, 13);
  assert.equal(types.DEFAULT_NOTIFICATION_CADENCE.eveningHourLocal, 20);
});
