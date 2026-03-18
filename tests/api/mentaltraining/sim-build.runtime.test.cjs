const test = require('node:test');
const assert = require('node:assert/strict');

const { loadSimBuildRuntime } = require('./_tsRuntimeHarness.cjs');

const simBuild = loadSimBuildRuntime();

function createVariantRecord(overrides = {}) {
  return {
    id: 'reset-branch-sport-context-reset',
    name: 'Sport-Context Reset',
    family: 'Reset',
    familyStatus: 'locked',
    mode: 'branch',
    specStatus: 'needs-spec',
    priority: 'high',
    specRaw: 'Reset spec v1',
    runtimeConfig: {
      session: {
        durationMinutes: 5,
        feedbackMode: 'coached',
      },
      analytics: {
        focus: ['reset'],
      },
    },
    moduleDraft: {
      moduleId: 'reset-module-1',
      name: 'Sport-Context Reset',
      description: 'A live reset simulation.',
      category: 'focus',
      difficulty: 'advanced',
      durationMinutes: 5,
      benefits: ['reset faster'],
      bestFor: ['pregame'],
      origin: 'Pulse',
      neuroscience: 'Keeps attention flexible under pressure.',
      overview: {
        when: 'After mistakes',
        focus: 'Reset speed',
        timeScale: '5 minutes',
        skill: 'Recovery Time',
        analogy: 'Next play mindset',
      },
      iconName: 'rotate-ccw',
      isActive: true,
      sortOrder: 1,
    },
    createdAt: 100,
    updatedAt: 100,
    ...overrides,
  };
}

test('determineSyncStatus differentiates spec, config, module, and build-only drift', () => {
  const base = createVariantRecord();
  const publishedSnapshot = {
    specRaw: base.specRaw,
    runtimeConfig: base.runtimeConfig,
    moduleDraft: base.moduleDraft,
    sourceFingerprint: 'fp_original',
    publishedAt: 200,
  };

  assert.equal(
    simBuild.determineSyncStatus({
      ...base,
      publishedModuleId: 'reset-module-1',
      publishedSnapshot,
      specRaw: 'Reset spec v2',
    }),
    'spec_changed'
  );

  assert.equal(
    simBuild.determineSyncStatus({
      ...base,
      publishedModuleId: 'reset-module-1',
      publishedSnapshot,
      runtimeConfig: {
        ...base.runtimeConfig,
        session: {
          ...base.runtimeConfig.session,
          durationMinutes: 6,
        },
      },
    }),
    'config_changed'
  );

  assert.equal(
    simBuild.determineSyncStatus({
      ...base,
      publishedModuleId: 'reset-module-1',
      publishedSnapshot,
      moduleDraft: {
        ...base.moduleDraft,
        description: 'Updated athlete-facing description.',
      },
    }),
    'module_changed'
  );

  const sourceFingerprint = simBuild.buildVariantSourceFingerprint(base);
  assert.equal(
    simBuild.determineSyncStatus({
      ...base,
      publishedModuleId: 'reset-module-1',
      publishedSnapshot,
      sourceFingerprint,
      lastPublishedFingerprint: sourceFingerprint,
    }),
    'in_sync'
  );

  assert.equal(
    simBuild.determineSyncStatus({
      ...base,
      publishedModuleId: 'reset-module-1',
      publishedSnapshot,
      sourceFingerprint: 'fp_rebuilt_without_publish',
      lastPublishedFingerprint: 'fp_original',
    }),
    'build_stale'
  );
});

test('buildVariantRecordForBuild compiles a build artifact and updates status metadata', () => {
  const built = simBuild.buildVariantRecordForBuild(createVariantRecord());

  assert.equal(built.engineKey, 'reset');
  assert.equal(built.buildStatus, 'built');
  assert.equal(built.syncStatus, 'in_sync');
  assert.ok(built.sourceFingerprint);
  assert.equal(built.lastBuiltFingerprint, built.sourceFingerprint);
  assert.equal(built.buildArtifact.variantId, built.id);
  assert.equal(built.buildArtifact.moduleId, built.moduleDraft.moduleId);
  assert.equal(built.buildMeta.engineVersion, 'registry-runtime/v1');
});

test('buildPublishedVariantRecord stamps published snapshot, fingerprints, and status invariants', () => {
  const publishedAt = 123456789;
  const published = simBuild.buildPublishedVariantRecord(createVariantRecord(), publishedAt);

  assert.equal(published.publishedAt, publishedAt);
  assert.equal(published.publishedModuleId, 'reset-module-1');
  assert.equal(published.specStatus, 'complete');
  assert.equal(published.syncStatus, 'in_sync');
  assert.equal(published.buildStatus, 'published');
  assert.equal(published.lastPublishedFingerprint, published.sourceFingerprint);
  assert.equal(published.publishedSnapshot.sourceFingerprint, published.sourceFingerprint);
  assert.equal(published.buildArtifact.sourceFingerprint, published.sourceFingerprint);
});
