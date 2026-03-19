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

function createEnduranceVariantRecord(overrides = {}) {
  return createVariantRecord({
    id: 'endurance-lock-branch-late-pressure-endurance-lock',
    name: 'Late-Pressure Endurance Lock',
    family: 'Endurance Lock',
    runtimeConfig: {
      archetype: 'fatigue_load',
      session: {
        durationMinutes: 6,
        feedbackMode: 'coached',
      },
      analytics: {
        focus: ['degradation_slope'],
      },
    },
    moduleDraft: {
      moduleId: 'endurance-lock-module-1',
      name: 'Late-Pressure Endurance Lock',
      description: 'An endurance simulation.',
      category: 'focus',
      difficulty: 'advanced',
      durationMinutes: 6,
      benefits: ['finish cleaner'],
      bestFor: ['late session breakdowns'],
      origin: 'Pulse',
      neuroscience: 'Tracks sustained attention under fatigue.',
      overview: {
        when: 'When late pressure matters',
        focus: 'Degradation Slope',
        timeScale: '6 minutes',
        skill: 'Sustained Attention',
        analogy: 'Holding form late in the game',
      },
      iconName: 'timer',
      isActive: true,
      sortOrder: 1,
    },
    ...overrides,
  });
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

test('Endurance Lock late-pressure variants compile a named pressure profile and six-block schedule', () => {
  const built = simBuild.buildVariantRecordForBuild(createEnduranceVariantRecord());
  const runtimeProfile = built.buildArtifact.stimulusModel.runtimeProfile;

  assert.equal(built.engineKey, 'endurance_lock');
  assert.equal(runtimeProfile.flavor, 'late_pressure');
  assert.equal(runtimeProfile.profileId, 'clock_compression_v1');
  assert.equal(runtimeProfile.scheduleVersion, 'clock_compression_v1_schedule');
  assert.equal(runtimeProfile.blockPlans.length, 6);
  assert.equal(runtimeProfile.blockPlans[4].phaseTag, 'finish');
  assert.equal(runtimeProfile.blockPlans[5].windowMs, 320);
});

test('Endurance Lock visual-channel variants compile a named visual profile and fixed recipe', () => {
  const built = simBuild.buildVariantRecordForBuild(createEnduranceVariantRecord({
    id: 'endurance-lock-branch-clutter-fatigue-endurance-lock',
    name: 'Clutter-Fatigue Endurance Lock',
    runtimeConfig: {
      archetype: 'visual_channel',
      session: {
        durationMinutes: 6,
        feedbackMode: 'coached',
      },
      analytics: {
        focus: ['degradation_slope', 'visual_channel_performance'],
      },
    },
    moduleDraft: {
      moduleId: 'endurance-lock-module-2',
      name: 'Clutter-Fatigue Endurance Lock',
      description: 'A visual endurance simulation.',
      category: 'focus',
      difficulty: 'advanced',
      durationMinutes: 6,
      benefits: ['hold the target under clutter'],
      bestFor: ['visual interference'],
      origin: 'Pulse',
      neuroscience: 'Tracks sustained attention under visual interference.',
      overview: {
        when: 'When visual clutter breaks focus',
        focus: 'Degradation Slope',
        timeScale: '6 minutes',
        skill: 'Sustained Attention',
        analogy: 'Holding form through visual noise',
      },
      iconName: 'timer',
      isActive: true,
      sortOrder: 1,
    },
  }));
  const runtimeProfile = built.buildArtifact.stimulusModel.runtimeProfile;

  assert.equal(runtimeProfile.flavor, 'visual_channel');
  assert.equal(runtimeProfile.profileId, 'clutter_ramp_v1');
  assert.equal(runtimeProfile.scheduleVersion, 'clutter_ramp_v1_schedule');
  assert.equal(runtimeProfile.blockPlans.length, 6);
  assert.equal(runtimeProfile.blockPlans[2].visualDensityTier, 'medium');
  assert.equal(runtimeProfile.blockPlans[4].visualDensityTier, 'high');
  assert.deepEqual(runtimeProfile.blockPlans[4].activeModifiers, ['visual_density']);
});
